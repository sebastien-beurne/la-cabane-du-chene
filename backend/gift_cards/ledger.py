"""Atomic monetary operations and host transaction boundary (Motor / MongoDB)."""
import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException
from pymongo.errors import ConfigurationError, OperationFailure

from .config import cents


def now():
    return datetime.now(timezone.utc).isoformat()


def state(g):
    if g.get("deleted_at"): return "supprimee"
    if g.get("status") == "active" and g.get("expires") and g["expires"] < date.today().isoformat():
        return "expiree"
    return g.get("status", "en_attente")


async def transact(db, callback):
    """No network/e-mail side effects in callback: Motor may retry it on conflicts.

    Requires a replica set or sharded MongoDB. Fail closed on standalone MongoDB.
    """
    try:
        async with await db.client.start_session() as session:
            return await session.with_transaction(callback)
    except (ConfigurationError, OperationFailure) as exc:
        if isinstance(exc, ConfigurationError) or exc.code in (20, 303):
            raise HTTPException(503, "L'utilisation des cartes cadeaux nécessite MongoDB avec transactions.") from exc
        raise


async def find_gift(db, code):
    g = await db.gift_cards.find_one({"code": code.strip().upper()}, {"_id": 0})
    if not g:
        raise HTTPException(400, "Code promo ou carte cadeau inconnu")
    if state(g) == "expiree":
        raise HTTPException(400, "Cette carte cadeau a expiré")
    if state(g) != "active" or cents(g.get("balance") or 0) <= 0:
        raise HTTPException(400, "Cette carte cadeau n'est plus utilisable")
    return g


async def consume(db, gift, amount, booking_id, *, session):
    """Debit and booking insert must share this session/transaction in the host."""
    units = cents(amount)
    if units <= 0:
        raise HTTPException(400, "Montant à débiter invalide")
    amount = units / 100
    current = await db.gift_cards.find_one({"id": gift["id"]}, session=session)
    if not current or cents(current.get("balance") or 0) < units:
        raise HTTPException(409, "Solde de carte cadeau insuffisant")
    balance = (cents(current["balance"]) - units) / 100
    # Read and update in the same transaction; calculate in cents, including legacy floats.
    res = await db.gift_cards.update_one(
        {"id": gift["id"], "status": "active", "deleted_at": None, "balance": current["balance"],
         "uses.booking_id": {"$ne": booking_id},
         "$or": [{"expires": {"$gte": date.today().isoformat()}}, {"expires": None}]},
        {"$set": {"balance": balance, "status": "utilisee" if balance == 0 else "active"}, "$push": {"uses": {
            "booking_id": booking_id, "amount": amount, "at": now()}}}, session=session)
    if not res.modified_count:
        raise HTTPException(409, "Cette carte cadeau a changé. Vérifiez son solde et sa validité.")
    return {"id": str(uuid.uuid4()), "amount": amount, "kind": "carte cadeau",
            "method": "carte cadeau", "note": gift["code"], "at": now()}


async def recredit(db, booking, *, session):
    """Idempotent per original payment, in the booking cancellation transaction."""
    lines = []
    for payment in booking.get("payments") or []:
        if payment.get("kind") != "carte cadeau" or payment.get("amount", 0) <= 0:
            continue
        # Existing cards/payments keep their identifiers. No migration required.
        key = f"{booking['id']}:{payment['id']}"
        card = await db.gift_cards.find_one({"code": payment["note"]}, session=session)
        if not card:
            raise HTTPException(409, "Carte cadeau introuvable pour le recrédit")
        if card.get("refund_received"):
            raise HTTPException(409, "Carte remboursée par Stripe : régularisation manuelle nécessaire")
        res = await db.gift_cards.update_one(
            {"code": payment["note"], "recredits.key": {"$ne": key}, "refund_received": {"$ne": True}},
            {"$set": {"balance": (cents(card.get("balance") or 0) + cents(payment["amount"])) / 100,
                      "status": "active" if card["status"] == "utilisee" else card["status"]},
             "$push": {"recredits": {"key": key, "amount": payment["amount"], "at": now()}}}, session=session)
        if res.modified_count:
            lines.append({"id": str(uuid.uuid4()), "amount": -payment["amount"],
                          "kind": "carte cadeau", "method": "carte cadeau recréditée",
                          "note": payment["note"], "at": now()})
    return lines

