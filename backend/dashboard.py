import calendar
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from bookings import enrich

PLATFORM_KEYS = ("direct", "airbnb", "booking", "greengo", "abracadaroom")
PLATFORM_LABELS = {"direct": "réservation directe", "airbnb": "Airbnb", "booking": "Booking.com", "greengo": "GreenGo", "abracadaroom": "AbracadaRoom"}


class PlatformPrice(BaseModel):
    commission: float = Field(default=0, ge=0, le=60)
    prices: dict = {}


class PlatformPricesIn(BaseModel):
    tourist_tax: float = Field(default=0, ge=0, le=20)
    platforms: dict[str, PlatformPrice] = {}


class RealRevenueIn(BaseModel):
    platform: str
    start: str  # first night covered (inclusive)
    end: str    # last night covered (inclusive)
    net: float = Field(ge=0, le=10_000_000)
    gross: Optional[float] = Field(default=None, ge=0, le=10_000_000)
    nights: Optional[int] = Field(default=None, ge=0, le=3660)
    note: str = Field(default="", max_length=300)


def stay_nights_by_platform(rows: list) -> dict:
    """{platform: [(night, gross_per_night, net_per_night, stay_key)]} — one entry per night (arrival in, departure out)."""
    out = defaultdict(list)
    for p, ci, co, gross, net, key in rows:
        n = (date.fromisoformat(co) - date.fromisoformat(ci)).days
        if n <= 0:
            continue
        for d in nights(ci, co):
            out[p].append((d, gross / n, net / n, key))
    return out


def platform_of_block(source: str) -> str:
    if source == "manuel":
        return "manuel"
    p = (source or "").replace("ical:", "")
    return "autre" if p in ("other", "") else p


def nights(ci: str, co: str):
    d, end = date.fromisoformat(ci), date.fromisoformat(co)
    while d < end:
        yield d
        d += timedelta(days=1)


def estimate_stay(prices: dict, n: int) -> float:
    """Gross price of an n-night stay from the owner's platform price grid (1-4 nights, longer stays prorated)."""
    known = sorted((int(k), float(v)) for k, v in (prices or {}).items() if float(v or 0) > 0)
    if not known or n <= 0:
        return 0.0
    exact = dict(known).get(n)
    if exact:
        return exact
    k, v = max((kv for kv in known if kv[0] <= n), default=known[0])
    return round(v / k * n, 2)


def build_router(db, current_user) -> APIRouter:
    r = APIRouter()

    @r.get("/admin/platform-prices")
    async def get_platform_prices(user=Depends(current_user)):
        doc = await db.settings.find_one({"key": "platform_prices"}, {"_id": 0})
        return (doc or {}).get("data") or {"tourist_tax": 0, "platforms": {}}

    @r.put("/admin/platform-prices")
    async def put_platform_prices(body: PlatformPricesIn, user=Depends(current_user)):
        clean = {"tourist_tax": round(body.tourist_tax, 2), "platforms": {}}
        for k, p in body.platforms.items():
            if k not in PLATFORM_KEYS:
                continue
            prices = {}
            for n in ("1", "2", "3", "4"):
                try:
                    v = float(str(p.prices.get(n, "")).replace(",", "."))
                    if 0 < v < 100000:
                        prices[n] = round(v, 2)
                except ValueError:
                    pass
            clean["platforms"][k] = {"commission": round(p.commission, 2), "prices": prices}
        await db.settings.update_one({"key": "platform_prices"}, {"$set": {"data": clean}}, upsert=True)
        return clean

    @r.get("/admin/real-revenues")
    async def list_real(user=Depends(current_user)):
        return await db.real_revenues.find({}, {"_id": 0}).sort([("platform", 1), ("start", 1)]).to_list(1000)

    async def check_real(body: RealRevenueIn, rid: Optional[str] = None) -> dict:
        if body.platform not in PLATFORM_KEYS:
            raise HTTPException(status_code=400, detail="Plateforme inconnue")
        try:
            s, e = date.fromisoformat(body.start), date.fromisoformat(body.end)
        except ValueError:
            raise HTTPException(status_code=400, detail="Dates invalides")
        if e < s:
            raise HTTPException(status_code=400, detail="La date de fin doit être postérieure ou égale à la date de début.")
        days = (e - s).days + 1
        if body.nights is not None and body.nights > days:
            raise HTTPException(status_code=400, detail=f"{body.nights} nuits déclarées pour une période de {days} nuits : impossible.")
        flt = {"platform": body.platform, "start": {"$lte": body.end}, "end": {"$gte": body.start}}
        if rid:
            flt["id"] = {"$ne": rid}
        clash = await db.real_revenues.find_one(flt, {"_id": 0})
        if clash:
            raise HTTPException(status_code=409, detail=f"Cette période chevauche une saisie {PLATFORM_LABELS[body.platform]} existante (du {clash['start']} au {clash['end']}). Modifiez-la ou choisissez des dates distinctes.")
        return {"platform": body.platform, "start": body.start, "end": body.end, "net": round(body.net, 2),
                "gross": None if body.gross is None else round(body.gross, 2), "nights": body.nights, "note": body.note.strip()}

    @r.post("/admin/real-revenues")
    async def add_real(body: RealRevenueIn, user=Depends(current_user)):
        doc = {**await check_real(body), "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}
        await db.real_revenues.insert_one(dict(doc))
        return doc

    @r.put("/admin/real-revenues/{rid}")
    async def edit_real(rid: str, body: RealRevenueIn, user=Depends(current_user)):
        if not await db.real_revenues.find_one({"id": rid}):
            raise HTTPException(status_code=404, detail="Saisie introuvable")
        doc = {**await check_real(body, rid), "updated_at": datetime.now(timezone.utc).isoformat()}
        await db.real_revenues.update_one({"id": rid}, {"$set": doc})
        return await db.real_revenues.find_one({"id": rid}, {"_id": 0})

    @r.delete("/admin/real-revenues/{rid}")
    async def delete_real(rid: str, user=Depends(current_user)):
        await db.real_revenues.delete_one({"id": rid})
        return {"ok": True}

    async def platform_revenue(y, confirmed, est_rows, estimated, cal_nights, net_of) -> dict:
        """Per platform for year y: real entries replace known/estimated revenue AND nights on the nights they cover."""
        known_rows = [((b.get("source") or "direct"), b["check_in"], b["check_out"], float(b.get("total") or 0),
                       net_of(b.get("source") or "direct", float(b.get("total") or 0), b.get("guests"), b.get("nights") or 0), f"bk:{b['id']}")
                      for b in confirmed]
        for b in confirmed:
            for d in nights(b["check_in"], b["check_out"]):
                if d.year == y:
                    cal_nights[b.get("source") or "direct"].add(d)
        known_n, est_n = stay_nights_by_platform(known_rows), stay_nights_by_platform(est_rows)
        y0, y1 = date(y, 1, 1), date(y, 12, 31)
        entries = await db.real_revenues.find({"start": {"$lte": y1.isoformat()}, "end": {"$gte": y0.isoformat()}}, {"_id": 0}).sort("start", 1).to_list(1000)
        out = {}
        for p in set(known_n) | set(est_n) | set(cal_nights) | {e["platform"] for e in entries}:
            mine = [e for e in entries if e["platform"] == p]
            full = [e for e in mine if e["start"] >= y0.isoformat() and e["end"] <= y1.isoformat()]
            partial = [e for e in mine if e not in full]
            covered = set()
            for e in full:
                covered |= set(nights(e["start"], (date.fromisoformat(e["end"]) + timedelta(days=1)).isoformat()))
            s = {"real_net": 0.0, "real_gross": 0.0, "real_gross_missing": 0, "real_nights_declared": 0, "real_nights_calendar": 0,
                 "real_nights_unknown": 0, "coverage": [], "partial": [], "bookings": 0, "revenue": 0.0, "revenue_net": 0.0,
                 "estimated": 0.0, "estimated_net": 0.0, "estimated_stays": 0, "unpriced": estimated[p]["unpriced"] if p in estimated else 0,
                 "nights_calendar": 0}
            for e in full:
                s["real_net"] += e["net"]
                if e.get("gross") is None:
                    s["real_gross_missing"] += 1
                else:
                    s["real_gross"] += e["gross"]
                span = set(nights(e["start"], (date.fromisoformat(e["end"]) + timedelta(days=1)).isoformat()))
                cal_in = len(span & cal_nights.get(p, set()))
                if e.get("nights") is None:
                    s["real_nights_calendar"] += cal_in
                    s["real_nights_unknown"] += 1
                else:
                    s["real_nights_declared"] += e["nights"]
                s["coverage"].append({**e, "calendar_nights": cal_in})
            s["partial"] = partial
            for src, kg, kn, kc in ((known_n, "revenue", "revenue_net", "bookings"), (est_n, "estimated", "estimated_net", "estimated_stays")):
                stays = set()
                for d, g, n, key in src.get(p, []):
                    if d.year == y and d not in covered:
                        s[kg] += g
                        s[kn] += n
                        stays.add(key)
                s[kc] = len(stays)
            s["nights_calendar"] = len({d for d in cal_nights.get(p, set()) if d not in covered})
            s["nights"] = s["nights_calendar"] + s["real_nights_declared"] + s["real_nights_calendar"]
            s["net_total"] = s["real_net"] + s["revenue_net"] + s["estimated_net"]
            s["gross_total"] = s["real_gross"] + s["revenue"] + s["estimated"]
            out[p] = {k: (round(v, 2) if isinstance(v, float) else v) for k, v in s.items()}
        return out

    @r.get("/admin/dashboard")
    async def dashboard(year: Optional[int] = None, user=Depends(current_user)):
        today = date.today()
        y = year or today.year
        y0, y1 = f"{y}-01-01", f"{y + 1}-01-01"
        rows = [enrich(b) for b in await db.bookings.find({}, {"_id": 0}).to_list(5000)]
        confirmed = [b for b in rows if b.get("status") == "confirmee"]
        occupied = defaultdict(set)
        for b in confirmed:
            for d in nights(b["check_in"], b["check_out"]):
                if d.year == y:
                    occupied[d].add(b.get("source") or "direct")
        prices_cfg = ((await db.settings.find_one({"key": "platform_prices"})) or {}).get("data") or {}
        grid = prices_cfg.get("platforms") or {}
        tax = float(prices_cfg.get("tourist_tax") or 0)

        def net_of(p, gross, guests, n):
            ded = gross * float((grid.get(p) or {}).get("commission") or 0) / 100 + tax * (guests or 2) * n
            return round(max(0.0, gross - min(gross, ded)), 2)

        known_stays = {((b.get("source") or "direct"), b["check_in"]) for b in confirmed}
        estimated = defaultdict(lambda: {"stays": 0, "revenue": 0.0, "net": 0.0, "unpriced": 0})
        est_rows, cal_nights = [], defaultdict(set)
        for blk in await db.blocks.find({"start": {"$lt": y1}, "end": {"$gt": y0}}, {"_id": 0}).to_list(5000):
            p = platform_of_block(blk.get("source"))
            if p == "manuel" or blk.get("kind") == "blocage":
                continue
            n = (date.fromisoformat(blk["end"]) - date.fromisoformat(blk["start"])).days
            closed = "not available" in (blk.get("note") or "").lower() or "closed" in (blk.get("note") or "").lower()
            if (p, blk["start"]) not in known_stays and not closed and n <= 30:
                v = estimate_stay((grid.get(p) or {}).get("prices"), n)
                est_rows.append((p, blk["start"], blk["end"], v, net_of(p, v, 2, n), f"blk:{blk.get('id') or blk['start']}"))
                if not v:
                    estimated[p]["unpriced"] += 1
            for d in nights(blk["start"], blk["end"]):
                if d.year == y:
                    occupied[d].add(p)
                    cal_nights[p].add(d)

        months = []
        for m in range(1, 13):
            dim = calendar.monthrange(y, m)[1]
            occ = sum(1 for d in occupied if d.month == m)
            in_month = [b for b in confirmed if b["check_in"][:7] == f"{y}-{m:02d}"]
            collected = sum(p["amount"] for b in rows for p in b.get("payments") or []
                            if p.get("kind") != "carte cadeau" and (p.get("at") or "")[:7] == f"{y}-{m:02d}")
            months.append({"month": m, "nights": occ, "days": dim, "occupancy": round(occ * 100 / dim, 1),
                           "revenue": round(sum(float(b.get("total") or 0) for b in in_month), 2), "collected": round(collected, 2)})

        by_source = await platform_revenue(y, confirmed, est_rows, estimated, cal_nights, net_of)

        year_b = [b for b in confirmed if b["check_in"][:4] == str(y)]
        tiso = today.isoformat()
        upcoming = sorted([b for b in confirmed if b["check_out"] >= tiso], key=lambda b: b["check_in"])
        gifts = await db.gift_cards.find({"code": {"$ne": None}}, {"_id": 0}).to_list(5000)
        sold = [g for g in gifts if (g.get("paid_at") or "")[:4] == str(y) and g.get("source") == "en_ligne"]
        days_year = 366 if calendar.isleap(y) else 365
        pick = lambda b: {k: b.get(k) for k in ("id", "name", "check_in", "check_out", "source", "guests", "total", "paid", "balance_due", "payment_status", "nights")}  # noqa: E731
        return {
            "year": y,
            "kpis": {
                "revenue": round(sum(float(b.get("total") or 0) for b in year_b), 2),
                "collected": round(sum(m["collected"] for m in months) + sum(float(g["amount"]) for g in sold), 2),
                "outstanding": round(sum(b["balance_due"] for b in upcoming), 2),
                "occupancy": round(len(occupied) * 100 / days_year, 1),
                "nights": len(occupied),
                "bookings": len(year_b),
                "avg_nights": round(sum(b["nights"] for b in year_b) / len(year_b), 1) if year_b else 0,
                "avg_basket": round(sum(float(b.get("total") or 0) for b in year_b) / len(year_b), 2) if year_b else 0,
                "pending_requests": sum(1 for b in rows if b.get("status") in ("nouvelle", "en_cours")),
                "gift_sold": len(sold), "gift_sold_amount": round(sum(float(g["amount"]) for g in sold), 2),
                "gift_outstanding": round(sum(float(g.get("balance") or 0) for g in gifts if g.get("status") == "active" and (g.get("expires") or "9") >= tiso), 2),
            },
            "months": months,
            "by_source": by_source,
            "upcoming": [pick(b) for b in upcoming[:6]],
            "to_collect": [pick(b) for b in upcoming if b["balance_due"] > 0][:10],
            "years": sorted({int(b["check_in"][:4]) for b in rows} | {today.year, today.year + 1}),
        }

    return r

