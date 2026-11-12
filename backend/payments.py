import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Optional
from pydantic import BaseModel, Field

import emailer
from bookings import enrich, log

logger = logging.getLogger("payments")
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
TAX_MODE = "calc_only"


def now():
    return datetime.now(timezone.utc).isoformat()


def check_origin(origin: str) -> str:
    origin = (origin or "").rstrip("/")
    if not origin.startswith("https://") and not origin.startswith("http://localhost"):
        raise HTTPException(status_code=400, detail="Adresse du site invalide")
    return origin


class DepositIn(BaseModel):
    kind: str = "acompte"
    amount: Optional[float] = Field(default=None, gt=0, le=10000)
    origin_url: str


class OriginIn(BaseModel):
    origin_url: str


def build_router(db, current_user, owner_email: str, on_other_paid=None, on_gift_refund=None) -> APIRouter:
    r = APIRouter()

    async def mark_paid(session_id: str, payment_intent=None):
        res = await db.payment_transactions.update_one(
            {"session_id": session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": "paid", "stripe_payment_intent_id": payment_intent, "updated_at": now()}},
        )
        if not res.modified_count:
            return
        tx = await db.payment_transactions.find_one({"session_id": session_id})
        b = await db.bookings.find_one({"id": tx["booking_id"]}, {"_id": 0})
        req = next((x for x in (b or {}).get("payment_requests") or [] if x["token"] == tx.get("token")), None)
        kind = (req or {}).get("kind", "acompte")
        pay = {"id": str(uuid.uuid4()), "amount": float(tx["amount"]), "kind": kind, "method": "carte (Stripe)",
               "note": session_id, "at": now()}
        await db.bookings.update_one(
            {"id": tx["booking_id"], "payment_requests.token": tx.get("token")},
            {"$set": {"payment_requests.$.status": "payee", "payment_requests.$.paid_at": now()},
             "$push": {"payments": pay, "history": log("Paiement en ligne reçu", f"{pay['amount']} € ({kind})")}})
        b = await db.bookings.find_one({"id": tx["booking_id"]}, {"_id": 0})
        if b:
            b = enrich(b)
            b["deposit"] = {"amount": pay["amount"], "kind": kind}
            s1, h1 = emailer.deposit_paid_owner_email(b)
            s2, h2 = emailer.deposit_paid_guest_email(b)
            await asyncio.gather(emailer.send_email(to=owner_email, subject=s1, html=h1, category="paiement_recu_proprietaire", ref=emailer.bref(b),
                                                    dedupe_key=f"paid-owner:{session_id}"),
                                 emailer.send_email(to=b["email"], subject=s2, html=h2, lang=b.get("lang") or "fr", category="paiement_recu",
                                                    ref=emailer.bref(b), dedupe_key=f"paid-guest:{session_id}"))

    @r.post("/admin/booking-requests/{bid}/deposit")
    async def request_deposit(bid: str, body: DepositIn, user=Depends(current_user)):
        b = await db.bookings.find_one({"id": bid}, {"_id": 0})
        if not b:
            raise HTTPException(status_code=404, detail="Demande introuvable")
        if b.get("status") != "confirmee":
            raise HTTPException(status_code=400, detail="Confirmez d'abord le séjour avant de demander un paiement.")
        if body.kind not in ("acompte", "solde"):
            raise HTTPException(status_code=400, detail="Type de paiement inconnu")
        b = enrich(b)
        due = b["balance_due"] if body.kind == "solde" else max(0.0, round(float(b.get("deposit_due") or 0) - b["paid"], 2))
        amount = round(body.amount or due, 2)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Aucun montant à demander : indiquez un montant.")
        origin = check_origin(body.origin_url)
        token = uuid.uuid4().hex
        req = {"token": token, "kind": body.kind, "amount": amount, "status": "en_attente", "requested_at": now()}
        await db.bookings.update_one({"id": bid}, {"$push": {"payment_requests": req, "history": log(f"Demande de paiement ({body.kind})", f"{amount} €")}})
        link = f"{origin}/paiement/{token}"
        s, h = emailer.deposit_request_email({**b, "deposit": req}, link)
        sent = await emailer.send_email(to=b["email"], subject=s, html=h, lang=b.get("lang") or "fr", kind="manuel", category=f"demande_{body.kind}",
                                        ref=emailer.bref(b), dedupe_key=f"payreq:{token}") if b.get("email") else False
        return {"ok": True, "link": link, "email_sent": sent, "request": req}

    async def by_token(token):
        b = await db.bookings.find_one({"payment_requests.token": token}, {"_id": 0})
        if not b:
            raise HTTPException(status_code=404, detail="Lien de paiement introuvable")
        return b, next(x for x in b["payment_requests"] if x["token"] == token)

    @r.get("/deposits/{token}")
    async def get_deposit(token: str):
        b, d = await by_token(token)
        return {"first_name": b["name"].split(" ")[0], "check_in": b["check_in"], "check_out": b["check_out"],
                "guests": b["guests"], "amount": d["amount"], "status": d["status"], "kind": d["kind"],
                "total": b.get("total"), "quote": b.get("quote")}

    @r.post("/deposits/{token}/checkout")
    async def deposit_checkout(token: str, body: OriginIn):
        b, d = await by_token(token)
        if d["status"] == "payee":
            raise HTTPException(status_code=400, detail="Ce paiement est déjà réglé.")
        if b.get("status") != "confirmee":
            raise HTTPException(status_code=400, detail="Ce séjour n'est plus confirmé. Contactez-nous.")
        origin = check_origin(body.origin_url)
        kwargs = dict(
            mode="payment",
            line_items=[{"quantity": 1, "price_data": {
                "currency": "eur", "unit_amount": int(round(d["amount"] * 100)),
                "product_data": {"name": f"{'Solde' if d['kind'] == 'solde' else 'Acompte'} séjour du {b['check_in']} au {b['check_out']}",
                                 "description": "La Cabane du Chêne — Valmunster", "tax_code": "txcd_20030000"}}}],
            customer_email=b["email"],
            success_url=f"{origin}/paiement/{token}?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/paiement/{token}?annule=1",
            metadata={"booking_id": b["id"], "type": "acompte"},
            locale="fr",
        )
        try:
            session = await asyncio.to_thread(lambda: stripe.checkout.Session.create(
                **kwargs, automatic_tax={"enabled": True}, billing_address_collection="required"))
        except stripe.error.StripeError as e:
            logger.error(f"Stripe checkout error: {e}")
            raise HTTPException(status_code=502, detail="Le paiement est momentanément indisponible. Réessayez plus tard.")
        await db.payment_transactions.insert_one({
            "session_id": session.id, "booking_id": b["id"], "token": token, "amount": float(d["amount"]), "currency": "eur",
            "status": "initiated", "payment_status": "pending", "created_at": now(), "updated_at": now()})
        return {"checkout_url": session.url, "session_id": session.id}

    @r.get("/payments/status/{session_id}")
    async def payment_status(session_id: str):
        rec = await db.payment_transactions.find_one({"session_id": session_id})
        if not rec:
            raise HTTPException(status_code=404, detail="Transaction introuvable")
        if rec.get("payment_status") != "paid":
            try:
                s = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
                if s.payment_status == "paid":
                    await mark_paid(session_id, s.payment_intent)
                elif s.status == "expired":
                    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {"status": "expired", "payment_status": "expired"}})
                rec = await db.payment_transactions.find_one({"session_id": session_id})
            except stripe.error.StripeError:
                pass
        return {"session_id": rec["session_id"], "status": rec["status"], "payment_status": rec["payment_status"]}

    @r.post("/stripe/webhook")
    async def stripe_webhook(request: Request):
        payload = await request.body()
        try:
            event = stripe.Webhook.construct_event(payload, request.headers.get("stripe-signature", ""), WEBHOOK_SECRET)
        except (stripe.error.SignatureVerificationError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid signature")
        obj, t = event["data"]["object"], event["type"]
        if t in ("checkout.session.completed", "checkout.session.async_payment_succeeded") and obj.get("payment_status") == "paid":
            await mark_paid(obj["id"], obj.get("payment_intent"))
            if on_other_paid and (obj.get("metadata") or {}).get("type") == "carte_cadeau":
                await on_other_paid(obj["id"])
        elif t == "checkout.session.async_payment_failed":
            await db.payment_transactions.update_one({"session_id": obj["id"]}, {"$set": {"status": "failed", "payment_status": "failed"}})
        elif t == "checkout.session.expired":
            await db.payment_transactions.update_one({"session_id": obj["id"], "payment_status": {"$ne": "paid"}}, {"$set": {"status": "expired", "payment_status": "expired"}})
        elif t == "charge.refunded":
            if on_gift_refund and await on_gift_refund(obj):
                return {"status": "ok"}
            tx = await db.payment_transactions.find_one({"stripe_payment_intent_id": obj.get("payment_intent")})
            if tx:
                await db.payment_transactions.update_one({"_id": tx["_id"]}, {"$set": {"status": "refunded", "payment_status": "refunded"}})
                await db.bookings.update_one({"id": tx["booking_id"]}, {"$push": {"history": log("Remboursement signalé par Stripe", f"{tx['amount']} € — à enregistrer en paiement négatif si besoin")}})
        return {"status": "ok"}

    return r

