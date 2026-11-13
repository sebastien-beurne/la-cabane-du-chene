from booking_refusal import notify_refusal
import re
import uuid
import asyncio
from datetime import date, datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

import emailer

SOURCES = ["direct", "airbnb", "booking", "abracadaroom", "greengo", "autre"]
STATUSES = {"nouvelle", "en_cours", "confirmee", "refusee", "annulee"}


def now():
    return datetime.now(timezone.utc).isoformat()


def num(v, default=0.0) -> float:
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r"-?\d+(?:[.,]\d+)?", str(v or ""))
    return float(m.group(0).replace(",", ".")) if m else default


def nights_between(ci: str, co: str) -> int:
    try:
        return (date.fromisoformat(co) - date.fromisoformat(ci)).days
    except Exception:
        raise HTTPException(status_code=400, detail="Date invalide")


def rate_table(p: dict) -> dict:
    return {int(num(r.get("nights"))): num(r.get("price")) for r in (p.get("rates") or []) if num(r.get("nights")) > 0}


async def find_promo(db, code: str):
    if not code:
        return None
    promo = await db.promo_codes.find_one({"code": code.strip().upper(), "active": True}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=400, detail="Code promo inconnu ou inactif")
    if promo.get("expires") and promo["expires"] < date.today().isoformat():
        raise HTTPException(status_code=400, detail="Ce code promo a expiré")
    if promo.get("max_uses") and promo.get("uses", 0) >= int(promo["max_uses"]):
        raise HTTPException(status_code=400, detail="Ce code promo n'est plus disponible")
    return promo


def compute_quote(p: dict, nights: int, guests: int, breakfasts: int = 0, options: List[str] = (), promo: Optional[dict] = None,
                  gift: Optional[dict] = None) -> dict:
    rates = rate_table(p)
    if not rates:
        raise HTTPException(status_code=400, detail="Tarifs non configurés")
    max_n = max(rates)
    if nights < 1 or nights > max_n:
        raise HTTPException(status_code=400, detail=f"La durée d'un séjour réservé en direct est de 1 à {max_n} nuits.")
    max_g = int(num(p.get("max_guests"), 4))
    if guests < 1 or guests > max_g:
        raise HTTPException(status_code=400, detail=f"La cabane accueille jusqu'à {max_g} personnes.")
    one = rates.get(1, 0)
    base = rates.get(nights) or one * nights
    reduction = max(0.0, one * nights - base)
    extra_n = max(0, guests - int(num(p.get("base_guests"), 2)))
    supplement = extra_n * num(p.get("extra_guest_per_night"), 12) * nights
    bf_price = num(p.get("breakfast_price"), 13)
    breakfast = max(0, int(breakfasts)) * bf_price
    opt_lines = []
    for o in p.get("options") or []:
        if o.get("active") and o.get("label") in (options or []):
            opt_lines.append({"label": o["label"], "amount": num(o.get("price"))})
    subtotal = base + supplement + breakfast + sum(o["amount"] for o in opt_lines)
    promo_amount = 0.0
    if promo:
        promo_amount = subtotal * num(promo["value"]) / 100 if promo["type"] == "percent" else num(promo["value"])
        promo_amount = round(min(promo_amount, subtotal), 2)
    total = round(subtotal - promo_amount, 2)
    pct = num(p.get("deposit_percent"), 30)
    deposit = round(total * pct / 100, 2)
    gift_amount = round(min(float(gift.get("balance") or 0), total), 2) if gift else 0.0
    return {
        "nights": nights, "guests": guests, "full_price": round(one * nights, 2), "reduction": round(reduction, 2),
        "base": round(base, 2), "extra_guests": extra_n, "supplement": round(supplement, 2),
        "breakfasts": max(0, int(breakfasts)), "breakfast_unit": bf_price, "breakfast": round(breakfast, 2),
        "options": opt_lines, "promo_code": (promo or {}).get("code", ""), "promo": promo_amount,
        "total": total, "deposit_percent": pct, "deposit": deposit, "balance": round(total - deposit, 2),
        "gift_code": (gift or {}).get("code", ""), "gift": gift_amount, "to_pay": round(total - gift_amount, 2),
        "deposit_left": round(max(0.0, deposit - gift_amount), 2),
    }


def paid_total(b: dict) -> float:
    return round(sum(x["amount"] for x in b.get("payments") or []), 2)


def payment_status(b: dict) -> str:
    if b.get("status") in ("annulee", "refusee"):
        return "annule"
    total, paid = float(b.get("total") or 0), paid_total(b)
    dep = float(b.get("deposit_due") or 0)
    if total and paid >= total - 0.01:
        return "paye"
    if b.get("payment_method") == "virement":
        return "virement_attendu"
    if paid <= 0:
        return "en_attente"
    if paid >= dep - 0.01:
        return "acompte_paye"
    return "partiel"


def enrich(b: dict) -> dict:
    b["paid"] = paid_total(b)
    b["balance_due"] = round(max(0.0, float(b.get("total") or 0) - b["paid"]), 2)
    b["payment_status"] = payment_status(b)
    b["nights"] = nights_between(b["check_in"], b["check_out"])
    return b


def log(action: str, detail: str = "") -> dict:
    return {"at": now(), "action": action, "detail": detail}


class QuoteIn(BaseModel):
    check_in: str
    check_out: str
    guests: int = 2
    breakfasts: int = 0
    options: List[str] = []
    promo_code: Optional[str] = ""


class BookingEdit(BaseModel):
    status: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    guests: Optional[int] = None
    breakfasts: Optional[int] = None
    options: Optional[List[str]] = None
    total_override: Optional[float] = None
    note: Optional[str] = None


class ManualBooking(BaseModel):
    source: str
    name: str = Field(min_length=1)
    email: Optional[str] = ""
    phone: Optional[str] = ""
    check_in: str
    check_out: str
    guests: int = 2
    total: Optional[float] = None
    commission: Optional[float] = None
    note: Optional[str] = ""


class PaymentIn(BaseModel):
    amount: float = Field(gt=-10000, le=10000)
    kind: str = "acompte"
    method: str = "virement"
    note: Optional[str] = ""


class PromoIn(BaseModel):
    code: str = Field(min_length=2, max_length=30)
    type: str = "percent"
    value: float = Field(gt=0)
    active: bool = True
    expires: Optional[str] = ""
    max_uses: Optional[int] = None


def build_router(db, current_user, get_content, owner_email) -> APIRouter:
    r = APIRouter()

    async def pricing():
        return (await get_content()).get("pricing") or {}

    async def get_b(bid):
        b = await db.bookings.find_one({"id": bid}, {"_id": 0})
        if not b:
            raise HTTPException(status_code=404, detail="Réservation introuvable")
        return b

    @r.post("/quote")
    async def quote(body: QuoteIn):
        import giftcards
        promo, gift = await giftcards.resolve_code(db, body.promo_code)
        return compute_quote(await pricing(), nights_between(body.check_in, body.check_out), body.guests, body.breakfasts, body.options, promo, gift)

    @r.get("/admin/booking-requests")
    async def list_bookings(user=Depends(current_user)):
        rows = await db.bookings.find({}, {"_id": 0}).sort("check_in", -1).to_list(1000)
        return [enrich(b) for b in rows]

    @r.post("/admin/bookings")
    async def add_manual(body: ManualBooking, user=Depends(current_user)):
        if body.source not in SOURCES:
            raise HTTPException(status_code=400, detail="Plateforme inconnue")
        if nights_between(body.check_in, body.check_out) < 1:
            raise HTTPException(status_code=400, detail="Le départ doit suivre l'arrivée")
        b = {"id": str(uuid.uuid4()), "source": body.source, "name": body.name, "email": (body.email or "").lower(), "phone": body.phone,
             "check_in": body.check_in, "check_out": body.check_out, "guests": body.guests, "message": body.note or "",
             "options": [], "breakfasts": 0, "quote": None, "total": body.total or 0, "deposit_due": 0, "commission": body.commission,
             "status": "confirmee", "payments": [], "payment_requests": [], "created_at": now(),
             "history": [log("Réservation ajoutée manuellement", body.source)]}
        await db.bookings.insert_one(dict(b))
        return enrich(b)

    @r.patch("/admin/booking-requests/{bid}")
    async def edit_booking(bid: str, body: BookingEdit, user=Depends(current_user)):
        b = await get_b(bid)
        changes = {k: v for k, v in body.model_dump().items() if v is not None and k not in ("note", "total_override")}
        if "status" in changes and changes["status"] not in STATUSES:
            raise HTTPException(status_code=400, detail="Statut inconnu")
        new = {**b, **changes}
        if nights_between(new["check_in"], new["check_out"]) < 1:
            raise HTTPException(status_code=400, detail="Le départ doit suivre l'arrivée")
        upd = dict(changes)
        if (b.get("source") or "direct") == "direct" and any(k in changes for k in ("check_in", "check_out", "guests", "breakfasts", "options")):
            promo = None
            code = (b.get("quote") or {}).get("promo_code")
            if code:
                promo = await db.promo_codes.find_one({"code": code}, {"_id": 0})
            p = await pricing()
            n = nights_between(new["check_in"], new["check_out"])
            if n > max(rate_table(p) or {0: 0}):
                if body.total_override is None:
                    raise HTTPException(status_code=400, detail="Séjour plus long que la grille tarifaire : indiquez le montant total.")
            else:
                q = compute_quote(p, n, new["guests"], new.get("breakfasts", 0), new.get("options") or [], promo)
                upd.update({"quote": q, "total": q["total"], "deposit_due": q["deposit"]})
        if body.total_override is not None:
            pct = num((await pricing()).get("deposit_percent"), 30)
            upd.update({"total": round(body.total_override, 2), "deposit_due": round(body.total_override * pct / 100, 2) if (b.get("source") or "direct") == "direct" else 0})
        detail = ", ".join(f"{k} : {b.get(k)} → {v}" for k, v in {**changes, **({"total": upd["total"]} if "total" in upd else {})}.items() if b.get(k) != v)
        hist = [log("Modification", (detail + (f" — {body.note}" if body.note else "")) or "aucun changement")]
        async def save_changes(session=None):
            import giftcards
            push = []
            updated = dict(upd)
            if changes.get("status") in ("annulee", "refusee"):
                fresh = await db.bookings.find_one({"id": bid}, {"_id": 0}, **({"session": session} if session else {}))
                if not fresh:
                    raise HTTPException(404, "Réservation introuvable")
                if changes.get("status") == "refusee" and fresh.get("status") != "refusee":
                    updated["refusal_generation"] = int(fresh.get("refusal_generation") or 0) + 1
                if not fresh.get("gift_recredited"):
                    push = await giftcards.recredit(db, fresh, session=session)
                    if push:
                        updated["gift_recredited"] = True
            history = hist + [log("Carte cadeau recréditée", f"{-p['amount']} € sur {p['note']}") for p in push]
            await db.bookings.update_one({"id": bid}, {"$set": updated,
                "$push": {"history": {"$each": history}, "payments": {"$each": push}}},
                **({"session": session} if session else {}))

        has_gift = any(p.get("kind") == "carte cadeau" and p.get("amount", 0) > 0 for p in b.get("payments") or [])
        if changes.get("status") in ("annulee", "refusee") and has_gift:
            import giftcards
            await giftcards.transact(db, save_changes)
        else:
            await save_changes()
        nb = await get_b(bid)
        if changes.get("status") == "refusee" and b.get("status") != "refusee":
            await notify_refusal(db, nb, await get_content())
        if changes.get("status") == "confirmee" and nb.get("payment_method") == "virement" and not nb.get("transfer_sent"):
            bank = ((await db.settings.find_one({"key": "bank"})) or {}).get("data") or {}
            s, h = emailer.transfer_request_email(enrich(dict(nb)), bank)
            ok = await emailer.send_email(to=nb["email"], subject=s, html=h, lang=nb.get("lang") or "fr", category="instructions_virement",
                                          ref=emailer.bref(nb), dedupe_key=f"virement:{bid}")
            await db.bookings.update_one({"id": bid}, {"$set": {"transfer_sent": now()}, "$push": {"history": log("Instructions de virement envoyées", "e-mail envoyé" if ok else "échec de l'envoi")}})
        return enrich(await get_b(bid))

    @r.post('/admin/booking-requests/{bid}/refusal-email')
    async def retry_refusal(bid: str, user=Depends(current_user)):
        b=await get_b(bid)
        if b.get('status')!='refusee':
            raise HTTPException(409,'Seule une réservation refusée peut recevoir cette notification')
        await notify_refusal(db,b,await get_content())
        return enrich(await get_b(bid))

    @r.delete("/admin/booking-requests/{bid}")
    async def delete_booking(bid: str, user=Depends(current_user)):
        b = await get_b(bid)
        if any(p.get("kind") == "carte cadeau" for p in b.get("payments") or []):
            raise HTTPException(409, "Annulez la réservation pour conserver la trace de la carte cadeau")
        await db.bookings.delete_one({"id": bid})
        return {"ok": True}

    @r.post("/admin/booking-requests/{bid}/payments")
    async def add_payment(bid: str, body: PaymentIn, user=Depends(current_user)):
        await get_b(bid)
        pay = {"id": str(uuid.uuid4()), "amount": round(body.amount, 2), "kind": body.kind, "method": body.method, "note": body.note or "", "at": now()}
        await db.bookings.update_one({"id": bid}, {"$push": {"payments": pay, "history": log("Paiement enregistré", f"{pay['amount']} € ({body.method}, {body.kind})")}})
        return enrich(await get_b(bid))

    @r.post("/admin/booking-requests/{bid}/recap")
    async def send_recap(bid: str, user=Depends(current_user)):
        b = enrich(await get_b(bid))
        if not b.get("email"):
            raise HTTPException(status_code=400, detail="Aucune adresse e-mail pour ce client")
        s, h = emailer.recap_email(b)
        ok = await emailer.send_email(to=b["email"], subject=s, html=h, lang=b.get("lang") or "fr", kind="manuel", category="recapitulatif", ref=emailer.bref(b))
        await db.bookings.update_one({"id": bid}, {"$push": {"history": log("Récapitulatif envoyé" if ok else "Échec envoi récapitulatif")}})
        return {"ok": ok}

    @r.get("/admin/promo-codes")
    async def list_promos(user=Depends(current_user)):
        return await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

    @r.post("/admin/promo-codes")
    async def save_promo(body: PromoIn, user=Depends(current_user)):
        if body.type not in ("percent", "amount"):
            raise HTTPException(status_code=400, detail="Type inconnu")
        if body.type == "percent" and body.value > 100:
            raise HTTPException(status_code=400, detail="Pourcentage trop élevé")
        code = body.code.strip().upper()
        doc = {**body.model_dump(), "code": code}
        await db.promo_codes.update_one({"code": code}, {"$set": doc, "$setOnInsert": {"uses": 0, "created_at": now()}}, upsert=True)
        return await db.promo_codes.find_one({"code": code}, {"_id": 0})

    @r.delete("/admin/promo-codes/{code}")
    async def del_promo(code: str, user=Depends(current_user)):
        await db.promo_codes.delete_one({"code": code.upper()})
        return {"ok": True}

    return r

