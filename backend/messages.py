from mail_journal import audience_for, audience_query
"""Admin inbox (contact form messages), replies and the journal of e-mails sent by the site."""
import math
import re
from datetime import datetime, timezone
from html import escape

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import emailer

PER_PAGE = 20
LIST_FIELDS = {"_id": 0, "html": 0}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def search_filter(q: str, fields: list) -> dict:
    q = (q or "").strip()
    if not q:
        return {}
    rx = {"$regex": re.escape(q[:80]), "$options": "i"}
    return {"$or": [{f: rx} for f in fields]}


async def paginate(coll, flt: dict, page: int, per: int, projection: dict, sort_key: str = "created_at") -> dict:
    per = max(5, min(per, 50))
    total = await coll.count_documents(flt)
    pages = max(1, math.ceil(total / per))
    page = max(1, min(page, pages))
    items = await coll.find(flt, projection).sort(sort_key, -1).skip((page - 1) * per).limit(per).to_list(per)
    return {"items": items, "total": total, "page": page, "pages": pages}


def reply_email(m: dict, subject: str, body: str) -> tuple:
    paragraphs = "".join(f"<p>{escape(p)}</p>" for p in body.strip().split("\n") if p.strip())
    quoted = escape(m.get("message") or "").replace("\n", "<br/>")
    inner = (
        f"<p>Bonjour {escape(m.get('name') or '')},</p>{paragraphs}"
        "<p>À très bientôt,<br/>La Cabane du Chêne</p>"
        f'<p style="margin-top:24px;padding-left:12px;border-left:3px solid #ddd;color:#6b6b6b;font-size:13px">'
        f"Votre message du {escape((m.get('created_at') or '')[:10])} :<br/>{quoted}</p>"
    )
    return subject, emailer._wrap(subject, inner)


class ReadIn(BaseModel):
    read: bool


class ReplyIn(BaseModel):
    subject: str = Field(min_length=2, max_length=160)
    body: str = Field(min_length=2, max_length=5000)
    client_token: str = Field(min_length=6, max_length=64)


def build_router(db, current_user) -> APIRouter:
    r = APIRouter()

    async def get_msg(mid: str) -> dict:
        m = await db.messages.find_one({"id": mid}, {"_id": 0})
        if not m:
            raise HTTPException(status_code=404, detail="Message introuvable")
        return m

    @r.get("/admin/messages")
    async def list_messages(page: int = 1, per: int = PER_PAGE, q: str = "", status: str = "", trash: bool = False, user=Depends(current_user)):
        flt = {**search_filter(q, ["name", "email", "subject"]), "deleted_at": {"$ne": None} if trash else None}
        if status in ("lu", "non_lu"):
            flt["read"] = True if status == "lu" else {"$ne": True}
        res = await paginate(db.messages, flt, page, per, {"_id": 0})
        ids = [m["id"] for m in res["items"]]
        counts = {c["_id"]: c["n"] async for c in db.email_log.aggregate([
            {"$match": {"ref.type": "message", "ref.id": {"$in": ids}, "category":"reponse", "status":{"$in":["envoye","livre"]}}}, {"$group": {"_id": "$ref.id", "n": {"$sum": 1}}}])}
        for m in res["items"]:
            m["replies"] = counts.get(m["id"], 0)
        res["unread"] = await db.messages.count_documents({"read": {"$ne": True}, "deleted_at": None})
        return res

    @r.get("/admin/messages/{mid}")
    async def message_detail(mid: str, user=Depends(current_user)):
        m = await get_msg(mid)
        m["thread"] = await db.email_log.find({"ref.type": "message", "ref.id": mid, "deleted_at": None}, {"_id": 0}).sort("created_at", 1).to_list(100)
        return m

    @r.post("/admin/messages/{mid}/read")
    async def set_read(mid: str, body: ReadIn, user=Depends(current_user)):
        m = await get_msg(mid)
        if m.get("deleted_at"): raise HTTPException(409, "Restaurez ce message avant de le modifier")
        await db.messages.update_one({"id": mid}, {"$set": {"read": body.read, "read_at": now() if body.read else None}})
        return {"ok": True, "unread": await db.messages.count_documents({"read": {"$ne": True}, "deleted_at": None})}

    @r.post("/admin/messages/{mid}/reply")
    async def reply(mid: str, body: ReplyIn, user=Depends(current_user)):
        m = await get_msg(mid)
        if m.get("deleted_at"): raise HTTPException(409, "Restaurez ce message avant de répondre")
        s, h = reply_email(m, body.subject.strip(), body.body)
        key = f"reply:{mid}:{body.client_token}"
        ok = await emailer.send_email(to=m["email"], subject=s, html=h, lang="fr", kind="manuel", category="reponse",
                                      ref={"type": "message", "id": mid, "label": f"Message de {m.get('name')}"}, dedupe_key=key)
        rec = await db.email_log.find_one({"dedupe_key": key}, LIST_FIELDS)
        await db.messages.update_one({"id": mid}, {"$set": {"read": True, **({"replied_at": now()} if ok else {})}})
        return {"ok": ok, "email": rec, "recorded": bool(rec), "delivery_disabled": bool(rec and rec.get("status") == "non_envoye")}

    @r.delete("/admin/messages/{mid}")
    async def delete_message(mid: str, user=Depends(current_user)):
        await get_msg(mid)
        await db.messages.update_one({"id": mid, "deleted_at": None}, {"$set": {"deleted_at": now(), "deleted_by": user.get("email", "proprietaire")}})
        return {"ok": True}

    @r.post("/admin/messages/{mid}/restore")
    async def restore_message(mid: str, user=Depends(current_user)):
        await get_msg(mid)
        await db.messages.update_one({"id": mid}, {"$unset": {"deleted_at": "", "deleted_by": ""}})
        return {"ok": True}

    @r.get("/admin/emails")
    async def list_sent(page: int = 1, per: int = PER_PAGE, q: str = "", status: str = "", kind: str = "", audience: str = "", trash: bool = False, user=Depends(current_user)):
        flt = {**search_filter(q, ["to", "subject", "ref.label"]), "deleted_at": {"$ne": None} if trash else None}
        if status in ("en_cours", "envoye", "livre", "echec", "non_envoye"):
            flt["status"] = status
        if kind in ("manuel", "automatique"):
            flt["kind"] = kind
        if audience in ("owner","client"):
            flt = {"$and":[flt,audience_query(audience)]}
        res = await paginate(db.email_log, flt, page, per, LIST_FIELDS)
        for email in res["items"]:
            email["audience"] = audience_for(email)
        res["failed"] = await db.email_log.count_documents({"status": "echec", "deleted_at": None})
        return res

    @r.get("/admin/emails/{eid}")
    async def sent_detail(eid: str, user=Depends(current_user)):
        e = await db.email_log.find_one({"id": eid}, {"_id": 0})
        if not e:
            raise HTTPException(status_code=404, detail="E-mail introuvable")
        return e

    @r.post("/admin/emails/{eid}/retry")
    async def retry(eid: str, user=Depends(current_user)):
        e = await db.email_log.find_one({"id": eid}, {"_id": 0})
        if not e:
            raise HTTPException(status_code=404, detail="E-mail introuvable")
        if e.get("deleted_at"): raise HTTPException(409, "Restaurez cet e-mail avant de le renvoyer")
        if e["status"] not in ("echec","non_envoye"):
            raise HTTPException(status_code=409, detail="Seuls les envois en échec peuvent être relancés")
        key = e.get("dedupe_key") or f"log:{eid}"
        await db.email_log.update_one({"id": eid}, {"$set": {"dedupe_key": key}})
        # Same record is reused (dedupe_key), content already in its final language: no re-translation.
        ok = await emailer.send_email(to=e["to"], subject=e["subject"], html=e["html"], lang="fr", kind=e.get("kind") or "automatique",
                                      category=e.get("category") or "", ref=e.get("ref"), dedupe_key=key)
        record = await db.email_log.find_one({"id": eid}, LIST_FIELDS)
        return {"ok": ok, "email": record, "delivery_disabled": bool(record and record.get("status") == "non_envoye")}

    @r.delete("/admin/emails/{eid}")
    async def trash_email(eid: str, user=Depends(current_user)):
        e = await db.email_log.find_one({"id": eid})
        if not e: raise HTTPException(404, "E-mail introuvable")
        if e.get("status") == "en_cours": raise HTTPException(409, "Cet e-mail est en cours d’envoi")
        await db.email_log.update_one({"id": eid, "status": {"$ne": "en_cours"}, "deleted_at": None}, {"$set": {"deleted_at": now(), "deleted_by": user.get("email", "proprietaire")}})
        return {"ok": True}

    @r.post("/admin/emails/{eid}/restore")
    async def restore_email(eid: str, user=Depends(current_user)):
        e = await db.email_log.find_one({"id": eid})
        if not e: raise HTTPException(404, "E-mail introuvable")
        await db.email_log.update_one({"id": eid}, {"$unset": {"deleted_at": "", "deleted_by": ""}})
        return {"ok": True}

    return r


async def ensure_indexes(db) -> None:
    await db.email_log.create_index("id", unique=True)
    await db.email_log.create_index("created_at")
    await db.email_log.create_index([("ref.type", 1), ("ref.id", 1)])
    await db.email_log.create_index("dedupe_key", unique=True, partialFilterExpression={"dedupe_key": {"$type": "string"}})
    await db.messages.create_index("created_at")

