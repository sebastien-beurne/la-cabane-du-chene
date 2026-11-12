import os
import copy
import hmac
import logging
from datetime import date, datetime, timedelta, timezone
from html import escape
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field

import emailer
from bookings import log

logger = logging.getLogger("autoemails")
TZ = ZoneInfo("Europe/Paris")

DEFAULTS = {
    "site_url": "",
    "reminder": {
        "enabled": False, "days_before": 3,
        "subject": "Votre séjour à La Cabane du Chêne approche",
        "body": ("Bonjour {prenom},\n\nPlus que quelques jours avant votre séjour à La Cabane du Chêne, du {arrivee} au {depart} !\n\n"
                 "Vous trouverez toutes les informations utiles (accès, équipements, bain nordique, bonnes adresses) dans notre livret d'accueil.\n\n"
                 "Une question ? Répondez simplement à cet e-mail.\n\nÀ très bientôt,\nLa Cabane du Chêne"),
    },
    "after_stay": {
        "enabled": False, "days_after": 1, "review_url": "",
        "subject": "Merci pour votre séjour à La Cabane du Chêne",
        "body": ("Bonjour {prenom},\n\nMerci d'avoir séjourné à La Cabane du Chêne ! Nous espérons que vous avez profité du calme, de la cabane et du bain nordique.\n\n"
                 "Si vous avez apprécié votre séjour, votre avis nous aiderait beaucoup : il ne prend qu'une minute.\n\n"
                 "Au plaisir de vous accueillir à nouveau,\nLa Cabane du Chêne"),
    },
}
KINDS = {"reminder": "rappel", "after_stay": "apres"}
MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def today() -> date:
    return datetime.now(TZ).date()


def fr_date(s: str) -> str:
    try:
        d = date.fromisoformat(s)
        return f"{DAYS[d.weekday()]} {d.day} {MONTHS[d.month - 1]} {d.year}"
    except Exception:
        return s


class Tpl(BaseModel):
    enabled: bool = True
    subject: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=10, max_length=6000)


class Reminder(Tpl):
    days_before: int = Field(default=3, ge=1, le=30)


class AfterStay(Tpl):
    days_after: int = Field(default=1, ge=0, le=30)
    review_url: Optional[str] = ""


class AutoIn(BaseModel):
    site_url: Optional[str] = ""
    reminder: Reminder
    after_stay: AfterStay


class TestIn(BaseModel):
    kind: str


def build_router(db, current_user, get_content, owner_email: str, site_url: str) -> APIRouter:
    r = APIRouter()

    async def settings() -> dict:
        doc = await db.settings.find_one({"key": "auto_emails"}, {"_id": 0})
        out = copy.deepcopy(DEFAULTS)
        for k, v in ((doc or {}).get("data") or {}).items():
            out[k] = {**out[k], **v} if isinstance(out.get(k), dict) else v
        return out

    async def render(kind: str, b: dict, cfg: dict) -> tuple[str, str]:
        t = cfg[kind]
        base = (cfg.get("site_url") or site_url).rstrip("/")
        booklet = (await db.settings.find_one({"key": "booklet"}) or {}).get("data")
        p = (await get_content()).get("pricing") or {}
        nights = (date.fromisoformat(b["check_out"]) - date.fromisoformat(b["check_in"])).days
        values = {
            "prenom": (b.get("name") or "").split(" ")[0], "nom": b.get("name") or "", "arrivee": fr_date(b["check_in"]),
            "depart": fr_date(b["check_out"]), "nuits": str(nights), "voyageurs": str(b.get("guests") or ""),
            "heure_arrivee": p.get("checkin") or "", "heure_depart": p.get("checkout") or "",
            "lien_livret": f"{base}/livret-accueil" if booklet else "", "lien_avis": t.get("review_url") or "",
        }
        body, subject = escape(t["body"]), t["subject"]
        for k, v in values.items():
            body = body.replace("{" + k + "}", escape(v))
            subject = subject.replace("{" + k + "}", v)
        html = f'<p style="white-space:pre-wrap">{body}</p>'.replace("\n", "<br/>")
        btn = ""
        if kind == "reminder" and booklet:
            btn = (f"{base}/livret-accueil", "Ouvrir le livret d'accueil")
        if kind == "after_stay" and (t.get("review_url") or "").startswith("https://"):
            btn = (t["review_url"], "Laisser un avis")
        if btn:
            html += (f'<p style="margin:24px 0"><a href="{escape(btn[0])}" style="background:#B35432;color:#ffffff;padding:14px 22px;'
                     f'border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block;white-space:nowrap;line-height:1.3">{btn[1]}</a></p>')
        return subject, emailer._wrap(subject, html)

    def due(kind: str, cfg: dict, rows: list) -> list:
        t, d0 = cfg[kind], today()
        out = []
        for b in rows:
            if b.get("status") != "confirmee" or not b.get("email") or (b.get("auto") or {}).get(KINDS[kind]):
                continue
            ci, co = date.fromisoformat(b["check_in"]), date.fromisoformat(b["check_out"])
            if kind == "reminder" and d0 < ci <= d0 + timedelta(days=int(t["days_before"])):
                out.append(b)
            if kind == "after_stay" and d0 - timedelta(days=int(t["days_after"]) + 7) <= co <= d0 - timedelta(days=int(t["days_after"])):
                out.append(b)
        return out

    async def run_all() -> dict:
        cfg = await settings()
        rows = await db.bookings.find({"status": "confirmee"}, {"_id": 0}).to_list(5000)
        report = {}
        for kind, flag in KINDS.items():
            sent = 0
            if cfg[kind].get("enabled"):
                for b in due(kind, cfg, rows):
                    claim = await db.bookings.update_one({"id": b["id"], f"auto.{flag}": {"$exists": False}}, {"$set": {f"auto.{flag}": datetime.now(timezone.utc).isoformat()}})
                    if not claim.modified_count:
                        continue
                    s, h = await render(kind, b, cfg)
                    ok = await emailer.send_email(to=b["email"], subject=s, html=h, lang=b.get("lang") or "fr", category=f"auto_{kind}",
                                                  ref=emailer.bref(b), dedupe_key=f"auto:{kind}:{b['id']}")
                    label = "Rappel avant l'arrivée" if kind == "reminder" else "Remerciement + demande d'avis"
                    await db.bookings.update_one({"id": b["id"]}, {"$push": {"history": log(f"E-mail automatique : {label}", "envoyé" if ok else "échec de l'envoi")}})
                    sent += 1 if ok else 0
            report[kind] = sent
        await db.settings.update_one({"key": "auto_emails_last"}, {"$set": {"at": datetime.now(timezone.utc).isoformat(), "report": report}}, upsert=True)
        return report

    async def run_safe():
        try:
            await run_all()
        except Exception as e:
            logger.error(f"auto emails run failed: {e}")

    @r.post("/cron/auto-emails")
    async def cron_auto_emails(request: Request, background: BackgroundTasks):
        # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
        auth = request.headers.get("authorization", "")
        secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
        if not secret or not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:].encode(), secret.encode()):
            raise HTTPException(status_code=401, detail="Unauthorized")
        try:
            env = await request.json()
        except Exception:
            env = {}
        if not isinstance(env, dict):
            raise HTTPException(status_code=400, detail="Invalid body")
        run_id = request.headers.get("x-webhook-id") or env.get("run_id") or datetime.now(timezone.utc).isoformat()
        res = await db.cron_runs.update_one({"run_id": run_id}, {"$setOnInsert": {"run_id": run_id, "at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
        if res.upserted_id is not None:
            background.add_task(run_safe)
        return {"accepted": True}

    @r.get("/admin/auto-emails")
    async def get_auto(user=Depends(current_user)):
        cfg = await settings()
        rows = await db.bookings.find({"status": "confirmee", "email": {"$nin": ["", None]}}, {"_id": 0}).to_list(5000)
        d0 = today()
        upcoming = []
        for b in rows:
            ci, co = date.fromisoformat(b["check_in"]), date.fromisoformat(b["check_out"])
            auto = b.get("auto") or {}
            if ci > d0:
                upcoming.append({"name": b["name"], "kind": "reminder", "date": (ci - timedelta(days=int(cfg["reminder"]["days_before"]))).isoformat(), "sent": auto.get("rappel")})
            if co >= d0 - timedelta(days=7):
                upcoming.append({"name": b["name"], "kind": "after_stay", "date": (co + timedelta(days=int(cfg["after_stay"]["days_after"]))).isoformat(), "sent": auto.get("apres")})
        last = await db.settings.find_one({"key": "auto_emails_last"}, {"_id": 0})
        booklet = bool((await db.settings.find_one({"key": "booklet"}) or {}).get("data"))
        return {**cfg, "planned": sorted(upcoming, key=lambda x: x["date"])[:20], "last_run": last, "has_booklet": booklet}

    @r.put("/admin/auto-emails")
    async def put_auto(body: AutoIn, user=Depends(current_user)):
        url = (body.after_stay.review_url or "").strip()
        if url and not url.startswith("https://"):
            raise HTTPException(status_code=400, detail="Le lien d'avis doit commencer par https://")
        data = body.model_dump()
        data["after_stay"]["review_url"] = url
        data["site_url"] = (body.site_url or "").rstrip("/") if (body.site_url or "").startswith("https://") else ""
        await db.settings.update_one({"key": "auto_emails"}, {"$set": {"data": data}}, upsert=True)
        return await get_auto(user)

    @r.post("/admin/auto-emails/test")
    async def test_auto(body: TestIn, user=Depends(current_user)):
        if body.kind not in KINDS:
            raise HTTPException(status_code=400, detail="Type inconnu")
        d0 = today()
        sample = {"name": "Camille Exemple", "guests": 2, "check_in": (d0 + timedelta(days=3)).isoformat(), "check_out": (d0 + timedelta(days=5)).isoformat()}
        s, h = await render(body.kind, sample, await settings())
        return {"ok": await emailer.send_email(to=owner_email, subject=f"[Test] {s}", html=h, kind="manuel", category="test"), "to": owner_email}

    @r.post("/admin/auto-emails/run")
    async def run_now(user=Depends(current_user)):
        return {"report": await run_all()}

    return r

