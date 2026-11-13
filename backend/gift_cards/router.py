import uuid
import random
import asyncio
import logging
from datetime import date, datetime, timezone, timedelta
from typing import Optional, Literal

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from .config import GiftConfig, cents
from .ledger import now, state

logger = logging.getLogger("giftcards")
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def gen_code(prefix="CADEAU"):
    part = lambda: "".join(random.SystemRandom().choice(ALPHABET) for _ in range(4))
    return f"{prefix}-{part()}-{part()}"


def public(g):
    if g.get("deleted_at"): raise HTTPException(404, "Carte indisponible")
    keys = ("code", "type", "nights", "amount", "balance", "recipient_name", "buyer_name", "message", "expires", "status", "email_sent", "currency")
    return {**{k: g.get(k) for k in keys}, "status": state(g)}


class GiftIn(BaseModel):
    type: Literal["montant", "sejour"] = "montant"
    amount: Optional[float] = None
    nights: Optional[int] = None
    buyer_name: str = Field(min_length=2, max_length=120)
    buyer_email: EmailStr
    recipient_name: str = Field(min_length=1, max_length=120)
    message: Optional[str] = Field(default="", max_length=600)
    consent: bool
    origin_url: str
    lang: Optional[str] = "fr"
    method: Literal["carte", "virement"] = "carte"


class GiftAdminIn(BaseModel):
    type: Literal["montant", "sejour"] = "montant"
    amount: Optional[float] = None
    nights: Optional[int] = None
    buyer_name: Optional[str] = ""
    buyer_email: Optional[str] = ""
    recipient_name: str = Field(min_length=1, max_length=120)
    message: Optional[str] = ""
    send_email: bool = False


class GiftPatch(BaseModel):
    balance: Optional[float] = Field(default=None, ge=0, allow_inf_nan=False)
    status: Optional[str] = None
    expires: Optional[date] = None


def build_router(db, current_user, *, config: GiftConfig, price_for_stay, get_bank, notify, can_sell=None, policy_provider=None):
    """No imports from the host site. Inject pricing, bank and e-mail adapters.

    notify(event, card, label, site_url, **context) -> awaitable bool
    Events: card, purchased, transfer, transfer_requested.
    """
    site_url = config.site_url
    r = APIRouter()

    async def policy():
        custom = await policy_provider() if policy_provider else {}
        try:
            days = int(custom.get("validity_days") or config.validity_days)
            low = cents(custom.get("min_amount") or config.min_amount) / 100
            high = cents(custom.get("max_amount") or config.max_amount) / 100
            if not 1 <= days <= 3650 or not 0 < low <= high:
                raise ValueError()
        except (TypeError, ValueError):
            raise HTTPException(503, "Les paramètres des cartes cadeaux doivent être vérifiés")
        return {"validity_days": days, "min_amount": low, "max_amount": high}

    async def price_of(body) -> float:
        if body.type == "sejour":
            rate = await price_for_stay(body.nights)
            if not body.nights or rate is None:
                raise HTTPException(status_code=400, detail="Durée de séjour non proposée")
            amount = cents(rate) / 100
            if amount <= 0:
                raise HTTPException(400, "Tarif de séjour invalide")
            return amount
        if body.type != "montant":
            raise HTTPException(status_code=400, detail="Type de carte inconnu")
        try:
            amount = cents(body.amount or 0) / 100
        except ValueError as exc:
            raise HTTPException(400, "Montant invalide") from exc
        limits = await policy()
        if amount < limits["min_amount"] or amount > limits["max_amount"]:
            raise HTTPException(status_code=400, detail=f"Montant entre {limits['min_amount']} et {limits['max_amount']} {config.currency.upper()}")
        return amount

    def label(g: dict) -> str:
        if g["type"] == "sejour":
            return f"Crédit cadeau — séjour de {g['nights']} nuit{'s' if g['nights'] > 1 else ''} pour {config.base_guests}"
        return f"Carte cadeau — {g['amount']:.2f} {config.currency.upper()}"

    async def send_card(g: dict, kind: str = "automatique"):
        try:
            return bool(await notify("card", g, label(g), config.site_url, kind=kind))
        except Exception:
            logger.exception("Gift-card e-mail failed for %s", g["id"])
            return False

    async def activate(g: dict, extra: dict) -> Optional[dict]:
        code = gen_code(config.code_prefix)
        while await db.gift_cards.find_one({"code": code}):
            code = gen_code(config.code_prefix)
        expires = (date.today() + timedelta(days=g.get("validity_days") or config.validity_days)).isoformat()
        res = await db.gift_cards.update_one({"id": g["id"], "status": g["status"], "refund_received": {"$ne": True}, "deleted_at": None},
                                             {"$set": {"status": "active", "code": code, "paid_at": now(), "expires": expires, **extra}})
        if not res.modified_count:
            return None
        g.update({"code": code, "expires": expires, "status": "active"})
        sent = await send_card(g)
        await db.gift_cards.update_one({"id": g["id"]}, {"$set": {"email_sent": sent}})
        g["email_sent"] = sent
        return g

    async def fulfill(session_id: str):
        g = await db.gift_cards.find_one({"session_id": session_id, "status": "en_attente"}, {"_id": 0})
        if not g:
            return
        # Both webhook and browser return use the same server-side verification.
        s = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
        if s.payment_status != "paid":
            return
        if (s.currency != config.currency.lower() or s.amount_subtotal != cents(g["amount"])
                or (s.metadata or {}).get("gift_id") != g["id"]):
            raise HTTPException(409, "Le paiement ne correspond pas à cette carte cadeau")
        g = await activate(g, {"stripe_payment_intent_id": s.payment_intent})
        if g:
            await notify("purchased", g, label(g), site_url)

    async def transfer_checkout(g: dict):
        bank = await get_bank()
        if not (bank.get("holder") and bank.get("iban")):
            raise HTTPException(status_code=400, detail="Le paiement par virement n'est pas disponible pour le moment.")
        g.update({"status": "virement_attendu", "method": "virement", "transfer_ref": f"CAD-{g['id'][:6].upper()}"})
        await db.gift_cards.insert_one(dict(g))
        sent = await notify("transfer", g, label(g), site_url, bank=bank)
        await notify("transfer_requested", g, label(g), site_url)
        await db.gift_cards.update_one({"id": g["id"]}, {"$set": {"transfer_sent": now() if sent else None}})
        return {"transfer": {"ref": g["transfer_ref"], "amount": g["amount"], "label": label(g), "email_sent": sent,
                             **{k: bank.get(k, "") for k in ("holder", "iban", "bic", "bank")}}}

    @r.get("/gift-cards/payment-options")
    async def payment_options():
        bank = await get_bank()
        return {"card": True, "transfer": bool(bank.get("holder") and bank.get("iban"))}

    @r.post("/gift-cards/checkout")
    async def checkout(body: GiftIn):
        if can_sell and not await can_sell():
            raise HTTPException(503, "Les cartes cadeaux seront disponibles prochainement. Contactez-nous.")
        if not body.consent:
            raise HTTPException(status_code=400, detail="Merci d'accepter le traitement de vos données.")
        amount = await price_of(body)
        terms = await policy()
        try:
            origin = config.origin(body.origin_url)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        g = {"id": str(uuid.uuid4()), "code": None, "type": body.type, "nights": body.nights if body.type == "sejour" else None,
             "amount": amount, "balance": amount, "currency": config.currency.lower(), "buyer_name": body.buyer_name.strip(), "buyer_email": body.buyer_email.lower(),
             "recipient_name": body.recipient_name.strip(), "message": (body.message or "").strip(), "status": "en_attente",
             "source": "en_ligne", "origin": origin, "lang": body.lang if body.lang in config.supported_languages else "fr", "uses": [], "created_at": now(), "validity_days": terms["validity_days"]}
        if body.method == "virement":
            return await transfer_checkout(g)
        try:
            session = await asyncio.to_thread(lambda: stripe.checkout.Session.create(
                mode="payment", locale=g["lang"], customer_email=g["buyer_email"],
                line_items=[{"quantity": 1, "price_data": {"currency": config.currency.lower(), "unit_amount": cents(amount),
                             "product_data": {"name": f"{config.brand_name} — {label(g)}", "description": f"Pour {g['recipient_name']} — valable {g['validity_days']} jours", "tax_code": "txcd_00000000"}}}],
                success_url=f"{origin}{config.success_path}?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{origin}{config.cancel_path}?annule=1",
                metadata={"type": "carte_cadeau", "gift_id": g["id"]},
                payment_intent_data={"metadata": {"type": "carte_cadeau", "gift_id": g["id"]}},
                automatic_tax={"enabled": True}, billing_address_collection="required"))
        except stripe.error.StripeError as e:
            logger.error(f"Stripe gift checkout error: {e}")
            raise HTTPException(status_code=502, detail="Le paiement est momentanément indisponible. Réessayez plus tard.")
        g["session_id"] = session.id
        await db.gift_cards.insert_one(dict(g))
        return {"checkout_url": session.url}

    @r.get("/gift-cards/status/{session_id}")
    async def status(session_id: str):
        g = await db.gift_cards.find_one({"session_id": session_id}, {"_id": 0})
        if not g:
            raise HTTPException(status_code=404, detail="Commande introuvable")
        if g["status"] == "en_attente":
            try:
                s = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
                if s.payment_status == "paid":
                    await fulfill(session_id)
                    g = await db.gift_cards.find_one({"session_id": session_id}, {"_id": 0})
            except stripe.error.StripeError:
                pass
        return public(g)

    @r.get("/admin/gift-cards")
    async def list_cards(trash: bool = False, user=Depends(current_user)):
        rows = await db.gift_cards.find({"deleted_at": {"$ne": None} if trash else None}, {"_id": 0, "session_id": 0}).sort("created_at", -1).to_list(1000)
        return [{**g, "status": state(g)} for g in rows]

    @r.post("/admin/gift-cards")
    async def create_card(body: GiftAdminIn, user=Depends(current_user)):
        amount = await price_of(body)
        terms = await policy()
        code = gen_code(config.code_prefix)
        while await db.gift_cards.find_one({"code": code}):
            code = gen_code(config.code_prefix)
        g = {"id": str(uuid.uuid4()), "code": code, "type": body.type, "nights": body.nights if body.type == "sejour" else None,
             "amount": amount, "balance": amount, "currency": config.currency.lower(), "buyer_name": (body.buyer_name or "").strip(), "buyer_email": (body.buyer_email or "").strip().lower(),
             "recipient_name": body.recipient_name.strip(), "message": (body.message or "").strip(), "status": "active", "source": "manuel",
             "uses": [], "created_at": now(), "paid_at": now(), "validity_days": terms["validity_days"], "expires": (date.today() + timedelta(days=terms["validity_days"])).isoformat()}
        await db.gift_cards.insert_one(dict(g))
        g.pop("_id", None)
        if body.send_email and g["buyer_email"]:
            g["email_sent"] = await send_card(g, "manuel")
        return g

    @r.patch("/admin/gift-cards/{gid}")
    async def patch_card(gid: str, body: GiftPatch, user=Depends(current_user)):
        upd = {k: v for k, v in body.model_dump(mode="json").items() if v is not None}
        if "balance" in upd:
            try:
                upd["balance"] = cents(upd["balance"]) / 100
            except ValueError as exc:
                raise HTTPException(400, "Solde invalide") from exc
        if "status" in upd and upd["status"] not in ("active", "annulee", "utilisee"):
            raise HTTPException(status_code=400, detail="Statut inconnu")
        res = await db.gift_cards.update_one({"id": gid, "code": {"$ne": None}, "refund_received": {"$ne": True}, "deleted_at": None}, {"$set": upd})
        if not res.matched_count:
            raise HTTPException(status_code=404, detail="Carte introuvable")
        return await db.gift_cards.find_one({"id": gid}, {"_id": 0, "session_id": 0})

    @r.post("/admin/gift-cards/{gid}/resend")
    async def resend(gid: str, user=Depends(current_user)):
        g = await db.gift_cards.find_one({"id": gid}, {"_id": 0})
        if not g or g.get("deleted_at") or not g.get("code"):
            raise HTTPException(status_code=404, detail="Carte introuvable")
        if not g.get("buyer_email"):
            raise HTTPException(status_code=400, detail="Aucune adresse e-mail pour cette carte")
        sent = await send_card(g, "manuel")
        await db.gift_cards.update_one({"id": gid}, {"$set": {"email_sent": sent}})
        return {"ok": sent}

    @r.post("/admin/gift-cards/{gid}/transfer-received")
    async def transfer_received(gid: str, user=Depends(current_user)):
        g = await db.gift_cards.find_one({"id": gid, "status": "virement_attendu", "deleted_at": None}, {"_id": 0})
        if not g:
            raise HTTPException(status_code=404, detail="Aucun virement en attente pour cette carte")
        g = await activate(g, {"transfer_received": now()})
        if not g:
            raise HTTPException(status_code=409, detail="Carte déjà activée")
        return {k: v for k, v in g.items() if k != "session_id"}

    @r.post("/admin/gift-cards/{gid}/trash")
    async def trash_card(gid: str, user=Depends(current_user)):
        card = await db.gift_cards.find_one({"id": gid})
        if not card: raise HTTPException(404, "Carte introuvable")
        if card.get("deleted_at"): return {"ok": True}
        if card.get("session_id") and card.get("status") == "en_attente":
            # Closing checkout prevents a payment after archiving; no refund is initiated.
            try:
                session = await asyncio.to_thread(stripe.checkout.Session.expire, card["session_id"])
            except stripe.error.StripeError:
                session = await asyncio.to_thread(stripe.checkout.Session.retrieve, card["session_id"])
            if session.payment_status == "paid":
                await fulfill(card["session_id"])
                raise HTTPException(409, "Paiement reçu : vérifiez la carte actualisée avant de la supprimer")
            if session.status != "expired": raise HTTPException(409, "Le paiement doit être expiré avant suppression")
        await db.gift_cards.update_one({"id": gid, "deleted_at": None}, {"$set": {"deleted_at": now(), "deleted_by": user.get("email", "proprietaire")}})
        return {"ok": True}

    @r.post("/admin/gift-cards/{gid}/restore")
    async def restore_card(gid: str, user=Depends(current_user)):
        card = await db.gift_cards.find_one({"id": gid})
        if not card: raise HTTPException(404, "Carte introuvable")
        await db.gift_cards.update_one({"id": gid}, {"$unset": {"deleted_at": "", "deleted_by": ""}})
        return {"ok": True}

    @r.delete("/admin/gift-cards/{gid}")
    async def delete_card(gid: str, user=Depends(current_user)):
        # Paid cards are accounting records; cancel them instead of deleting them.
        card = await db.gift_cards.find_one({"id": gid, "code": None,
            "status": {"$in": ["en_attente", "virement_attendu"]}})
        if not card:
            raise HTTPException(409, "Une carte activée doit être annulée, pas supprimée")
        if card.get("session_id"):
            # Do not delete a pending order while its checkout can still be paid.
            try:
                session = await asyncio.to_thread(stripe.checkout.Session.expire, card["session_id"])
            except stripe.error.StripeError:
                session = await asyncio.to_thread(stripe.checkout.Session.retrieve, card["session_id"])
            if session.payment_status == "paid":
                await fulfill(card["session_id"])
                raise HTTPException(409, "Ce paiement est réglé : la carte doit être conservée")
            if session.status != "expired":
                raise HTTPException(409, "Le paiement doit être expiré avant suppression")
        result = await db.gift_cards.delete_one({"id": gid, "code": None,
                                               "status": {"$in": ["en_attente", "virement_attendu"]}})
        if not result.deleted_count:
            raise HTTPException(409, "Une carte activée doit être annulée, pas supprimée")
        return {"ok": True}

    return r, fulfill


