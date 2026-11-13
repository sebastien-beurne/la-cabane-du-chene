from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

import os
import io
import re
import uuid
import copy
import hashlib
import secrets
import time
import asyncio
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List

import httpx
from PIL import Image
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form
from fastapi.responses import PlainTextResponse, StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

import emailer
import messages
import payments
import bookings
import clients
import stay_messages
import giftcards
import dashboard
import autoemails
import translate
import storage
import deployment_config
deployment_config.validate()
from auth import (hash_password, verify_password, create_access_token, create_refresh_token,
                  decode, set_auth_cookies, make_current_user)
from defaults import DEFAULT_CONTENT, DEFAULT_PHOTOS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("cabane")

if os.environ.get("PREVIEW_MEMORY_DB") == "true":
    if os.environ.get("APP_ENV") != "preview":
        raise RuntimeError("The memory database is restricted to local preview")
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
else:
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="La Cabane du Chêne")


@app.middleware("http")
async def payment_configuration(request: Request, call_next):
    if deployment_config.enabled() and request.method != 'GET' and 'checkout' in request.url.path and not os.environ.get('STRIPE_SECRET_KEY'):
        return Response(content='{"detail":"Configurer Stripe avant d’activer les paiements"}', status_code=503, media_type='application/json')
    return await call_next(request)


@app.middleware("http")
async def fresh_content(request: Request, call_next):
    response=await call_next(request)
    if request.url.path in {'/api/content','/api/admin/content'}:
        response.headers['Cache-Control']='no-store'
    return response

@app.middleware("http")
async def server_timing(request: Request, call_next):
    """Exposes the backend processing time (Server-Timing header) to tell server time from network time."""
    t0 = time.perf_counter()
    response = await call_next(request)
    response.headers["Server-Timing"] = f"app;dur={(time.perf_counter() - t0) * 1000:.1f}"
    return response

api = APIRouter(prefix="/api")

@api.get('/health')
async def health():
    try:
        await client.admin.command('ping')
    except Exception:
        raise HTTPException(503, 'Base de données indisponible')
    return {'status':'ok','environment':'railway' if deployment_config.enabled() else 'site'}

current_user = make_current_user(db)
OWNER_EMAIL = os.environ["OWNER_EMAIL"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


def merge(defaults, stored):
    if isinstance(defaults, dict) and isinstance(stored, dict):
        out = copy.deepcopy(defaults)
        for k, v in stored.items():
            out[k] = merge(defaults.get(k), v) if k in defaults else v
        return out
    return stored if stored is not None else copy.deepcopy(defaults)


# ---------------- Auth ----------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class PasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10)


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ident = f"{client_ip(request)}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and att.get("locked_until") and datetime.fromisoformat(att["locked_until"]) > datetime.now(timezone.utc):
        raise HTTPException(status_code=429, detail="Trop de tentatives. Réessayez dans 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        count = (att or {}).get("count", 0) + 1
        upd = {"count": count}
        if count >= 5:
            upd["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": ident}, {"$set": upd}, upsert=True)
        raise HTTPException(status_code=401, detail="E-mail ou mot de passe incorrect")
    await db.login_attempts.delete_many({"identifier": ident})
    uid = str(user["_id"])
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return {"id": uid, "email": email, "name": user.get("name"), "role": user.get("role")}


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    payload = decode(token, "refresh")
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    set_auth_cookies(response, create_access_token(payload["sub"], user["email"]))
    return {"ok": True}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", secure=True, samesite="none")
    response.delete_cookie("refresh_token", path="/", secure=True, samesite="none")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


@api.post("/auth/change-password")
async def change_password(body: PasswordIn, user=Depends(current_user)):
    doc = await db.users.find_one({"email": user["email"]})
    if not verify_password(body.current_password, doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
    await db.users.update_one({"email": user["email"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}


# ---------------- Content ----------------
async def get_content() -> dict:
    doc = await db.settings.find_one({"key": "content"}, {"_id": 0})
    return merge({**DEFAULT_CONTENT, "appearance": {"theme": "signature"}}, (doc or {}).get("data", {}))


@api.get("/content")
async def read_content():
    return await get_content()


@api.put("/admin/content")
async def update_content(data: dict, user=Depends(current_user)):
    clean = {k: v for k, v in data.items() if k in DEFAULT_CONTENT and k != "appearance"}
    await db.settings.update_one({"key": "content"}, {"$set": {**{f"data.{k}": v for k, v in clean.items()}, "updated_at": now_iso()}}, upsert=True)
    return await get_content()


THEME_IDS = {'valentine', 'winter', 'signature', 'easter', 'halloween', 'spring', 'summer', 'christmas', 'autumn'}
class AppearanceIn(BaseModel):
    theme: str

@api.put('/admin/appearance')
async def update_appearance(body: AppearanceIn, user=Depends(current_user)):
    if body.theme not in THEME_IDS:
        raise HTTPException(422, 'Thème inconnu')
    await db.settings.update_one({'key':'content'},{'$set':{'data.appearance.theme':body.theme,'updated_at':now_iso()}},upsert=True)
    return await get_content()


# ---------------- Photos ----------------
CATEGORIES = {"accueil", "jardin", "salon", "interieur", "chambre", "cuisine", "salle-de-bains",
              "terrasse", "pergola", "bain", "vue", "guide", "autre"}


class PhotoPatch(BaseModel):
    category: Optional[str] = None
    alt: Optional[str] = None
    order: Optional[int] = None


@api.get("/photos")
async def list_photos():
    return await db.photos.find({"deleted": False}, {"_id": 0}).sort("order", 1).to_list(500)


@api.post("/admin/photos")
async def upload_photo(file: UploadFile = File(...), category: str = Form("autre"), alt: str = Form(""),
                       user=Depends(current_user)):
    if category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Catégorie inconnue")
    raw = await file.read()
    if len(raw) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image trop lourde (20 Mo maximum)")
    try:
        im = Image.open(io.BytesIO(raw))
        im = im.convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Fichier image non reconnu")
    im.thumbnail((2000, 2000))
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=80)
    path = f"{storage.APP_NAME}/photos/{uuid.uuid4()}.webp"
    try:
        result = await asyncio.to_thread(storage.put_object, path, buf.getvalue(), "image/webp")
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=502, detail="Échec de l'envoi de la photo, réessayez")
    last = await db.photos.find_one({"deleted": False}, sort=[("order", -1)])
    photo = {"id": str(uuid.uuid4()), "url": f"/api/files/{result['path']}", "storage_path": result["path"],
             "category": category, "alt": alt.strip() or "Photo de La Cabane du Chêne",
             "order": (last or {}).get("order", 0) + 1, "illustration": False, "deleted": False, "created_at": now_iso()}
    await db.photos.insert_one(dict(photo))
    photo.pop("_id", None)
    return photo


@api.patch("/admin/photos/{photo_id}")
async def patch_photo(photo_id: str, body: PhotoPatch, user=Depends(current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "category" in upd and upd["category"] not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Catégorie inconnue")
    res = await db.photos.update_one({"id": photo_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Photo introuvable")
    return await db.photos.find_one({"id": photo_id}, {"_id": 0})


@api.delete("/admin/photos/{photo_id}")
async def delete_photo(photo_id: str, user=Depends(current_user)):
    await db.photos.update_one({"id": photo_id}, {"$set": {"deleted": True}})
    return {"ok": True}


@api.post("/admin/videos")
async def upload_video(file: UploadFile = File(...), user=Depends(current_user)):
    ctype = file.content_type or ""
    if ctype not in ("video/mp4", "video/quicktime", "video/webm"):
        raise HTTPException(status_code=400, detail="Format vidéo accepté : MP4, MOV ou WebM")
    size = file.size if file.size is not None else await asyncio.to_thread(lambda: file.file.seek(0, 2))
    if size > 150 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Vidéo trop lourde (150 Mo maximum). Préférez YouTube pour les longues vidéos.")
    ext = {"video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm"}[ctype]
    path = f"{storage.APP_NAME}/videos/{uuid.uuid4()}.{ext}"
    try:
        result = await asyncio.to_thread(storage.put_stream, path, file.file, ctype)
    except Exception as e:
        logger.error(f"Video upload failed: {e}")
        raise HTTPException(status_code=502, detail="Échec de l'envoi de la vidéo, réessayez")
    await db.media.insert_one({"storage_path": result["path"], "content_type": ctype, "size": size, "created_at": now_iso()})
    return {"url": f"/api/files/{result['path']}"}


# ---------------- Livret d'accueil (PDF) ----------------
class BankIn(BaseModel):
    holder: str = Field(default="", max_length=120)
    iban: str = Field(default="", max_length=40)
    bic: str = Field(default="", max_length=15)
    bank: str = Field(default="", max_length=120)


async def bank_ready() -> bool:
    d = ((await db.settings.find_one({"key": "bank"})) or {}).get("data") or {}
    return bool(d.get("holder") and d.get("iban"))


@api.get("/payment-options")
async def payment_options():
    return {"card": True, "transfer": await bank_ready()}


@api.get("/admin/bank")
async def get_bank(user=Depends(current_user)):
    return ((await db.settings.find_one({"key": "bank"})) or {}).get("data") or {}


@api.put("/admin/bank")
async def put_bank(body: BankIn, user=Depends(current_user)):
    iban = re.sub(r"\s+", "", body.iban).upper()
    if iban and not re.fullmatch(r"[A-Z]{2}\d{2}[A-Z0-9]{10,30}", iban):
        raise HTTPException(status_code=400, detail="IBAN invalide")
    data = {"holder": body.holder.strip(), "iban": " ".join(iban[i:i + 4] for i in range(0, len(iban), 4)), "bic": body.bic.strip().upper(), "bank": body.bank.strip()}
    await db.settings.update_one({"key": "bank"}, {"$set": {"data": data}}, upsert=True)
    return data


# ---------------- Livret d'accueil (PDF) ----------------
@api.get("/booklet")
async def get_booklet():
    doc = await db.settings.find_one({"key": "booklet"}, {"_id": 0})
    return (doc or {}).get("data") or {}


@api.post("/admin/booklet")
async def upload_booklet(file: UploadFile = File(...), user=Depends(current_user)):
    head = await file.read(4)
    if not head.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Merci d'envoyer un fichier PDF")
    size = file.size if file.size is not None else await asyncio.to_thread(lambda: file.file.seek(0, 2))
    if size > 40 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF trop lourd (40 Mo maximum)")
    path = f"{storage.APP_NAME}/livret/{uuid.uuid4()}.pdf"
    try:
        result = await asyncio.to_thread(storage.put_stream, path, file.file, "application/pdf")
    except Exception as e:
        logger.error(f"Booklet upload failed: {e}")
        raise HTTPException(status_code=502, detail="Échec de l'envoi du PDF, réessayez")
    await db.media.insert_one({"storage_path": result["path"], "content_type": "application/pdf", "size": size, "created_at": now_iso()})
    data = {"url": f"/api/files/{result['path']}", "filename": (file.filename or "livret.pdf")[:120], "size": size, "updated_at": now_iso()}
    await db.settings.update_one({"key": "booklet"}, {"$set": {"data": data}}, upsert=True)
    return data


@api.delete("/admin/booklet")
async def delete_booklet(user=Depends(current_user)):
    await db.settings.delete_one({"key": "booklet"})
    return {"ok": True}


MEDIA_DIR = Path("/tmp/media_cache")
MEDIA_DIR.mkdir(parents=True, exist_ok=True)


@api.get("/files/{path:path}")
async def serve_file(path: str, request: Request):
    media = await db.media.find_one({"storage_path": path})
    rec = media or await db.photos.find_one({"storage_path": path, "deleted": False})
    if not rec:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    if not media:
        w = request.query_params.get("w", "")
        w = min((400, 1000, 1600), key=lambda v: abs(v - int(w))) if w.isdigit() and 200 <= int(w) <= 2000 else 0
        # Photos: no pod-local cache (its page cache is billed as pod memory). Resized copies are made once and kept in object storage.
        variant = f"{path}.w{w}.webp"
        data = None
        if w and w in (rec.get("variants") or []):
            try:
                data, _ = await asyncio.to_thread(storage.get_object, variant)
            except FileNotFoundError:
                pass  # Restored original: recreate the missing cached size below.
        if data is None:
            data, _ = await asyncio.to_thread(storage.get_object, path)
            if w:
                def shrink(raw):
                    with Image.open(io.BytesIO(raw)) as im:
                        im.draft("RGB", (w, w * 2))
                        im.thumbnail((w, w * 2))
                        out = io.BytesIO()
                        im.save(out, "WEBP", quality=78)
                    return out.getvalue()
                data = await asyncio.to_thread(shrink, data)
                storage.release_memory()
                try:
                    await asyncio.to_thread(storage.put_object, variant, data, "image/webp")
                    await db.photos.update_one({"storage_path": path}, {"$addToSet": {"variants": w}})
                except Exception as e:
                    logger.warning(f"Photo variant not stored: {e}")
        return Response(content=data, media_type="image/webp",
                        headers={"Cache-Control": "public, max-age=31536000, immutable"})
    # Large media (videos, PDF) are cached on disk, never kept in RAM, and streamed in 512 KB chunks.
    local = MEDIA_DIR / hashlib.sha1(path.encode()).hexdigest()
    if not local.exists():
        await asyncio.to_thread(storage.download_to, path, local)
    size = local.stat().st_size
    rng = request.headers.get("range", "")
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"}
    if media["content_type"] == "application/pdf":
        headers["Content-Disposition"] = 'inline; filename="livret-accueil-cabane-du-chene.pdf"'
    start, end, status = 0, size - 1, 200
    if rng.startswith("bytes="):
        a, _, b = rng[6:].partition("-")
        start = int(a) if a else 0
        end = min(int(b) if b else size - 1, size - 1)
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        status = 206
    headers["Content-Length"] = str(end - start + 1)

    def chunks():
        with open(local, "rb") as f:
            f.seek(start)
            left = end - start + 1
            n = 0
            try:
                while left > 0:
                    buf = f.read(min(524288, left))
                    if not buf:
                        break
                    left -= len(buf)
                    n += 1
                    if n % 8 == 0:
                        storage.drop_cache(f)
                    yield buf
            finally:
                storage.drop_cache(f)
    return StreamingResponse(chunks(), status_code=status, media_type=media["content_type"], headers=headers)


# ---------------- Availability ----------------
def parse_day(s: str) -> date:
    try:
        return date.fromisoformat(s)
    except Exception:
        raise HTTPException(status_code=400, detail="Date invalide")


class BlockIn(BaseModel):
    start: str
    end: str
    note: Optional[str] = ""


async def blocked_ranges(exclude: str = "", since: str = ""):
    today = since or date.today().isoformat()
    q = {"end": {"$gt": today}}
    if exclude:
        q["source"] = {"$ne": f"ical:{exclude}"}
    ranges = await db.blocks.find(q, {"_id": 0}).to_list(2000)
    for r in ranges:
        r["platform"] = dashboard.platform_of_block(r.get("source"))
        r["kind"] = "blocage" if r["platform"] == "manuel" else r.get("kind") or "reservation"
    bq = {"status": "confirmee", "check_out": {"$gt": today}}
    if exclude:
        bq["source"] = {"$ne": exclude}
    booked = await db.bookings.find(bq, {"_id": 0}).to_list(2000)
    ranges += [{"id": b["id"], "start": b["check_in"], "end": b["check_out"], "booking": True, "platform": b.get("source") or "direct", "kind": "reservation",
                "source": f"réservation {b.get('source') or 'direct'}", "note": f"{b['name']} · {b.get('guests', '')} pers."} for b in booked]
    return sorted(ranges, key=lambda r: r["start"])


@api.get("/availability")
async def availability():
    ranges = await blocked_ranges()
    sync = await db.settings.find_one({"key": "ical_sync"}, {"_id": 0})
    return {"blocked": [{"start": r["start"], "end": r["end"]} for r in ranges],
            "last_sync": (sync or {}).get("at")}


@api.get("/admin/ical/status")
async def ical_status(user=Depends(current_user)):
    return await db.settings.find_one({"key": "ical_sync"}, {"_id": 0}) or {}


@api.get("/admin/blocks")
async def list_blocks(since: str = "", user=Depends(current_user)):
    return await blocked_ranges(since=parse_day(since).isoformat() if since else "")


@api.post("/admin/blocks")
async def add_block(body: BlockIn, user=Depends(current_user)):
    if parse_day(body.end) <= parse_day(body.start):
        raise HTTPException(status_code=400, detail="La date de fin doit suivre la date de début")
    blk = {"id": str(uuid.uuid4()), "start": body.start, "end": body.end, "note": body.note or "", "source": "manuel"}
    await db.blocks.insert_one(dict(blk))
    return blk


@api.delete("/admin/blocks/{block_id}")
async def delete_block(block_id: str, user=Depends(current_user)):
    await db.blocks.delete_one({"id": block_id, "source": "manuel"})
    return {"ok": True}


def parse_ics(text: str) -> list:
    events, cur = [], None
    for line in text.replace("\r\n ", "").splitlines():
        if line.startswith("BEGIN:VEVENT"):
            cur = {}
        elif line.startswith("END:VEVENT") and cur is not None:
            if cur.get("start") and cur.get("end"):
                events.append(cur)
            cur = None
        elif cur is not None and line.startswith("SUMMARY"):
            cur["summary"] = line.split(":", 1)[-1].strip()[:120]
        elif cur is not None and (line.startswith("DTSTART") or line.startswith("DTEND")):
            v = line.split(":", 1)[-1].strip()[:8]
            try:
                d = datetime.strptime(v, "%Y%m%d").date().isoformat()
                cur["start" if line.startswith("DTSTART") else "end"] = d
            except ValueError:
                pass
    return events


def ical_kind(src: str, summary: str) -> str:
    """'reservation' = a guest stays, 'blocage' = nights closed by the owner on the platform."""
    s = (summary or "").lower()
    if any(w in s for w in ("reserved", "réserv", "booked", "reservation")):
        return "reservation"
    if src != "booking" and any(w in s for w in ("not available", "unavailable", "blocked", "bloqu", "indisponible", "closed")):
        return "blocage"
    return "reservation"


async def sync_ical() -> dict:
    content = await get_content()
    report = {}
    async with httpx.AsyncClient(timeout=30, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0 CabaneDuChene-iCal"}) as http:
        for src, url in (content.get("ical") or {}).items():
            if not url:
                continue
            try:
                r = await http.get(url.strip())
                r.raise_for_status()
                if "BEGIN:VCALENDAR" not in r.text[:500]:
                    raise ValueError("le lien ne renvoie pas un calendrier iCal")
                evs = parse_ics(r.text)
                # Platforms drop past stays from their feeds: keep what we already stored for the past.
                today = date.today().isoformat()
                await db.blocks.delete_many({"source": f"ical:{src}", "end": {"$gt": today}})
                kept = {(b["start"], b["end"]) async for b in db.blocks.find({"source": f"ical:{src}"}, {"_id": 0, "start": 1, "end": 1})}
                evs = [e for e in evs if e["end"] > today or (e["start"], e["end"]) not in kept]
                if evs:
                    await db.blocks.insert_many([{"id": str(uuid.uuid4()), "start": e["start"], "end": e["end"],
                                                  "note": e.get("summary") or f"Importé de {src}", "kind": ical_kind(src, e.get("summary")),
                                                  "source": f"ical:{src}"} for e in evs])
                report[src] = {"ok": True, "count": len(evs), "at": now_iso()}
            except Exception as e:
                logger.warning(f"iCal sync {src} failed: {e}")
                msg = f"erreur HTTP {e.response.status_code}" if isinstance(e, httpx.HTTPStatusError) else str(e)[:120]
                report[src] = {"ok": False, "error": msg, "at": now_iso()}
    await db.settings.update_one({"key": "ical_sync"}, {"$set": {"at": now_iso(), "report": report}}, upsert=True)
    return report


@api.post("/admin/ical/sync")
async def ical_sync(user=Depends(current_user)):
    return {"report": await sync_ical()}


@api.get("/calendar.ics")
async def export_ics(pour: str = ""):
    ranges = await blocked_ranges(exclude=pour)
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//La Cabane du Chêne//FR", "CALSCALE:GREGORIAN"]
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    for r in ranges:
        lines += ["BEGIN:VEVENT", f"UID:{r['id']}@lacabaneduchene", f"DTSTAMP:{stamp}",
                  f"DTSTART;VALUE=DATE:{r['start'].replace('-', '')}", f"DTEND;VALUE=DATE:{r['end'].replace('-', '')}",
                  "SUMMARY:Indisponible", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return PlainTextResponse("\r\n".join(lines), media_type="text/calendar")


async def private_ical_token(rotate: bool = False) -> str:
    doc = await db.settings.find_one({"key": "ical_private"}, {"_id": 0})
    if rotate or not (doc or {}).get("token"):
        tok = secrets.token_urlsafe(24)
        await db.settings.update_one({"key": "ical_private"}, {"$set": {"token": tok}}, upsert=True)
        return tok
    return doc["token"]


@api.get("/admin/ical/private")
async def get_private_ical(user=Depends(current_user)):
    return {"token": await private_ical_token()}


@api.post("/admin/ical/private/rotate")
async def rotate_private_ical(user=Depends(current_user)):
    return {"token": await private_ical_token(rotate=True)}


def ics_text(s) -> str:
    return str(s or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r", "").replace("\n", "\\n")


@api.get("/reservations.ics")
async def export_private_ics(token: str = ""):
    if not token or not secrets.compare_digest(token, await private_ical_token()):
        raise HTTPException(status_code=404, detail="Not found")
    since = (date.today() - timedelta(days=365)).isoformat()
    ranges = await blocked_ranges(since=since)
    full = {b["id"]: b for b in await db.bookings.find({"status": "confirmee", "check_out": {"$gt": since}}, {"_id": 0}).to_list(2000)}
    names = {"direct": "Site", "airbnb": "Airbnb", "booking": "Booking", "greengo": "GreenGo", "abracadaroom": "AbracadaRoom", "manuel": "Bloqué", "autre": "Autre"}
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//La Cabane du Chêne//Reservations//FR", "CALSCALE:GREGORIAN",
             "X-WR-CALNAME:La Cabane du Chêne - Réservations"]
    for r in ranges:
        plat = names.get(r.get("platform"), r.get("platform") or "")
        b = full.get(r["id"]) if r.get("booking") else None
        if b:
            b = bookings.enrich(b)
            summary = f"{b['name']} ({plat}) - {b.get('guests', '')} pers."
            desc = "\n".join(x for x in [f"E-mail : {b.get('email', '')}", f"Téléphone : {b.get('phone')}" if b.get("phone") else "",
                                          f"Total : {b.get('total', 0)} €", f"Reste à payer : {b.get('balance_due', 0)} €",
                                          f"Message : {b.get('message')}" if b.get("message") else ""] if x)
        else:
            kind = "Blocage" if r.get("kind") == "blocage" else "Réservation"
            summary = f"{kind} {plat}".strip()
            desc = r.get("note") or ""
        lines += ["BEGIN:VEVENT", f"UID:{r['id']}@lacabaneduchene-prive", f"DTSTAMP:{stamp}",
                  f"DTSTART;VALUE=DATE:{r['start'].replace('-', '')}", f"DTEND;VALUE=DATE:{r['end'].replace('-', '')}",
                  f"SUMMARY:{ics_text(summary)}", f"DESCRIPTION:{ics_text(desc)}", "TRANSP:OPAQUE", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return PlainTextResponse("\r\n".join(lines), media_type="text/calendar", headers={"Cache-Control": "no-store"})


@api.get("/admin/readiness")
async def readiness(user=Depends(current_user)):
    try:
        info = await db.command("hello")
        transactional = bool(info.get("setName") or info.get("msg") == "isdbgrid")
    except Exception:
        transactional = False
    return {"stripe_configured": bool(os.environ.get("STRIPE_SECRET_KEY")),
            "email_configured": bool(os.environ.get("EMERGENT_EMAIL_KEY")) and os.environ.get("EMAIL_DELIVERY_MODE") != "disabled",
            "mongo_transactions": transactional,
            "preview": os.environ.get("APP_ENV") == "preview"}


# ---------------- Forms ----------------
async def guard_spam(request: Request, honeypot: str, elapsed_ms: int, kind: str):
    if honeypot:
        return False
    if elapsed_ms < 2500:
        raise HTTPException(status_code=400, detail="Envoi trop rapide, merci de réessayer.")
    ip = client_ip(request)
    since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    if await db.rate_limits.count_documents({"ip": ip, "kind": kind, "at": {"$gt": since}}) >= 5:
        raise HTTPException(status_code=429, detail="Trop de demandes envoyées. Réessayez plus tard.")
    await db.rate_limits.insert_one({"ip": ip, "kind": kind, "at": now_iso()})
    return True


class BookingIn(BaseModel):
    check_in: str
    check_out: str
    guests: int = Field(ge=1, le=12)
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=40)
    street: str = Field(min_length=3, max_length=160)
    postal_code: str = Field(min_length=2, max_length=20)
    city: str = Field(min_length=1, max_length=80)
    country: str = Field(min_length=2, max_length=60)
    message: Optional[str] = Field(default="", max_length=2000)
    options: List[str] = []
    breakfasts: int = Field(default=0, ge=0, le=40)
    promo_code: Optional[str] = ""
    consent: bool
    website: Optional[str] = ""
    elapsed_ms: int = 0
    lang: Optional[str] = "fr"
    payment_method: Optional[str] = "carte"


@api.post("/booking-requests")
async def create_booking(body: BookingIn, request: Request):
    pricing = (await get_content()).get("pricing") or {}
    if not pricing.get("confirmed") or not pricing.get("calendar_confirmed"):
        raise HTTPException(503, "La réservation en ligne est en préparation. Envoyez-nous une demande de séjour.")
    if not body.consent:
        raise HTTPException(status_code=400, detail="Merci d'accepter le traitement de vos données.")
    ci, co = parse_day(body.check_in), parse_day(body.check_out)
    if ci < date.today():
        raise HTTPException(status_code=400, detail="La date d'arrivée est déjà passée.")
    if co <= ci:
        raise HTTPException(status_code=400, detail="La date de départ doit suivre la date d'arrivée.")
    for r in await blocked_ranges():
        if body.check_in < r["end"] and r["start"] < body.check_out:
            raise HTTPException(status_code=409, detail="Ces dates ne sont pas disponibles. Merci d'en choisir d'autres.")
    promo, gift = await giftcards.resolve_code(db, body.promo_code)
    q = bookings.compute_quote((await get_content()).get("pricing") or {}, (co - ci).days, body.guests, body.breakfasts, body.options, promo, gift)
    if not await guard_spam(request, body.website, body.elapsed_ms, "booking"):
        return {"ok": True}
    b = body.model_dump(exclude={"website", "elapsed_ms", "consent", "promo_code"})
    for k in ("first_name", "last_name", "phone", "street", "postal_code", "city", "country"):
        b[k] = b[k].strip()
    if not all(b[k] for k in ("first_name", "last_name", "street", "city")) or len(re.sub(r"\D", "", b["phone"])) < 6:
        raise HTTPException(status_code=400, detail="Merci de renseigner vos nom, prénom, téléphone et adresse postale.")
    b["name"] = f"{b['first_name']} {b['last_name']}"
    b["address"] = f"{b['street']}, {b['postal_code']} {b['city']}, {b['country']}"
    b["lang"] = body.lang if body.lang in ("en", "nl", "de") else "fr"
    if body.payment_method == "virement":
        if not await bank_ready():
            raise HTTPException(status_code=400, detail="Le virement n'est pas disponible pour le moment.")
    else:
        b["payment_method"] = "carte"
    bid = str(uuid.uuid4())
    b.update({"id": bid, "status": "nouvelle", "created_at": now_iso(), "email": body.email.lower(),
              "source": "direct", "quote": q, "total": q["total"], "deposit_due": q["deposit"],
              "payment_requests": [], "transfer_ref": f"CDF-{bid[:6].upper()}"})

    async def save_request(session=None):
        pays = [await giftcards.consume(db, gift, q["gift"], bid, session=session)] if gift and q["gift"] > 0 else []
        hist = [bookings.log("Demande reçue sur le site", f"{q['total']} €")]
        if pays:
            hist.append(bookings.log("Carte cadeau utilisée", f"{q['gift']} € ({gift['code']})"))
        b.update({"payments": pays, "history": hist})
        await db.bookings.insert_one(dict(b), **({"session": session} if session else {}))

    if gift and q["gift"] > 0:
        await giftcards.transact(db, save_request)
    else:
        await save_request()
    if promo:
        await db.promo_codes.update_one({"code": promo["code"]}, {"$inc": {"uses": 1}})
    s1, h1 = emailer.booking_owner_email(b)
    s2, h2 = emailer.booking_guest_email(b)
    sent = await asyncio.gather(emailer.send_email(to=OWNER_EMAIL, subject=s1, html=h1, category="demande_reservation_proprietaire", ref=emailer.bref(b)),
                                emailer.send_email(to=b["email"], subject=s2, html=h2, lang=b["lang"], category="demande_reservation_accuse", ref=emailer.bref(b)))
    await db.bookings.update_one({"id": b["id"]}, {"$set": {"emails_sent": all(sent)}})
    return {"ok": True, "id": b["id"]}


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: Optional[str] = Field(default="", max_length=40)
    subject: Optional[str] = Field(default="", max_length=160)
    message: str = Field(min_length=5, max_length=3000)
    consent: bool
    website: Optional[str] = ""
    elapsed_ms: int = 0
    lang: Optional[str] = "fr"


@api.post("/contact")
async def contact(body: ContactIn, request: Request):
    if not body.consent:
        raise HTTPException(status_code=400, detail="Merci d'accepter le traitement de vos données.")
    if not await guard_spam(request, body.website, body.elapsed_ms, "contact"):
        return {"ok": True}
    m = body.model_dump(exclude={"website", "elapsed_ms", "consent"})
    m.update({"id": str(uuid.uuid4()), "read": False, "created_at": now_iso(), "email": body.email.lower()})
    await db.messages.insert_one(dict(m))
    s1, h1 = emailer.contact_owner_email(m)
    s2, h2 = emailer.contact_guest_email(m)
    await asyncio.gather(emailer.send_email(to=OWNER_EMAIL, subject=s1, html=h1, category="contact_proprietaire",
                                            ref={"type": "message", "id": m["id"], "label": f"Message de {m['name']}"}),
                         emailer.send_email(to=m["email"], subject=s2, html=h2, lang=body.lang or "fr", category="contact_accuse",
                                            ref={"type": "message", "id": m["id"], "label": f"Message de {m['name']}"}))
    return {"ok": True}


@api.get("/")
async def root():
    return {"status": "ok"}


gift_router, gift_fulfill = giftcards.build_router(db, current_user, get_content, payments.check_origin, os.environ["SITE_URL"], OWNER_EMAIL)
api.include_router(payments.build_router(db, current_user, OWNER_EMAIL, gift_fulfill, lambda charge: giftcards.refund_charge(db, charge)))
api.include_router(bookings.build_router(db, current_user, get_content, OWNER_EMAIL))
api.include_router(gift_router)
api.include_router(translate.build_router(db))
api.include_router(dashboard.build_router(db, current_user))
api.include_router(autoemails.build_router(db, current_user, get_content, OWNER_EMAIL, os.environ["SITE_URL"]))
api.include_router(messages.build_router(db, current_user))
api.include_router(clients.build_router(db, current_user))
api.include_router(stay_messages.build_router(db, current_user))
emailer.db = db
app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ["CORS_ORIGINS"].split(","),
                   allow_methods=["*"], allow_headers=["*"])


async def ical_loop():
    while True:
        await asyncio.sleep(3600)
        try:
            await sync_ical()
        except Exception as e:
            logger.warning(f"iCal loop: {e}")


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.gift_cards.create_index("code", unique=True, partialFilterExpression={"code": {"$type": "string"}})
    await db.cron_runs.create_index("run_id", unique=True)
    await db.translations.create_index([("lang", 1), ("h", 1)], unique=True)
    await messages.ensure_indexes(db)
    email = os.environ["ADMIN_EMAIL"].lower()
    if not await db.users.find_one({"email": email}):
        await db.users.insert_one({"email": email, "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
                                   "name": "Administrateur", "role": "admin", "created_at": now_iso()})
    if not await db.photos.count_documents({}):
        await db.photos.insert_many([{"id": str(uuid.uuid4()), "illustration": False, "deleted": False,
                                      "created_at": now_iso(), **p} for p in DEFAULT_PHOTOS])
    try:
        if deployment_config.enabled() or os.environ.get("EMERGENT_LLM_KEY"):
            await asyncio.to_thread(storage.init_storage)
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    if os.environ.get("APP_ENV") != "preview":
        asyncio.create_task(ical_loop())


@app.on_event("shutdown")
async def shutdown():
    client.close()

