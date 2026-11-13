"""Owner-only templates and explicitly confirmed sends for arrival and welcome messages."""
import hashlib
import json
import os
import re
from datetime import date, datetime, timezone
from html import escape
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import emailer

KINDS = {'arrival': 'Informations d’arrivée', 'welcome': 'Message de bienvenue'}
VARS = {'prenom', 'nom', 'arrivee', 'depart', 'voyageurs'}

def now(): return datetime.now(timezone.utc).isoformat()

def day(value):
    try: return date.fromisoformat(value).strftime('%d/%m/%Y')
    except (ValueError, TypeError): return value or ''

class Template(BaseModel):
    subject: str = Field(default='', max_length=200)
    body: str = Field(default='', max_length=8000)

class SendIn(BaseModel):
    client_token: str = Field(min_length=8, max_length=80)
    preview_hash: str = Field(min_length=64, max_length=64)


def build_router(db, current_user, defaults=None):
    router = APIRouter()

    async def settings(kind):
        if kind not in KINDS: raise HTTPException(404, 'Modèle introuvable')
        doc = await db.settings.find_one({'key': 'stay_message_'+kind}, {'_id': 0})
        # Property access information belongs in private configuration, never frontend content.
        private_defaults = json.loads(os.environ.get('STAY_MESSAGE_DEFAULTS_JSON') or '{}')
        return (doc or {}).get('data') or (defaults or private_defaults).get(kind) or {'subject': KINDS[kind], 'body': ''}

    async def preview(bid, kind):
        cfg = await settings(kind)
        booking = await db.bookings.find_one({'id': bid}, {'_id': 0})
        if not booking: raise HTTPException(404, 'Réservation introuvable')
        if booking.get('status') != 'confirmee': raise HTTPException(409, 'Ces informations sont réservées aux séjours confirmés')
        if not booking.get('email'): raise HTTPException(400, 'Renseignez l’adresse e-mail du client dans la réservation')
        if not cfg.get('body', '').strip(): raise HTTPException(409, 'Complétez ce modèle dans E-mails auto avant de l’envoyer')
        values = {'prenom': (booking.get('name') or '').split(' ')[0], 'nom': booking.get('name') or '',
                  'arrivee': day(booking.get('check_in')), 'depart': day(booking.get('check_out')), 'voyageurs': str(booking.get('guests') or '')}
        def render(text): return re.sub(r'\{(prenom|nom|arrivee|depart|voyageurs)\}', lambda m: values[m.group(1)], text)
        subject, body = render(cfg['subject']), render(cfg['body'])
        digest = hashlib.sha256((booking['email']+'\0'+subject+'\0'+body).encode()).hexdigest()
        return booking, {'to': booking['email'], 'subject': subject, 'body': body, 'preview_hash': digest}

    @router.get('/admin/stay-messages/{kind}')
    async def get_template(kind: str, user=Depends(current_user)): return await settings(kind)

    @router.put('/admin/stay-messages/{kind}')
    async def put_template(kind: str, body: Template, user=Depends(current_user)):
        await settings(kind)
        if body.body.strip() and not body.subject.strip(): raise HTTPException(400, 'Indiquez un objet')
        unknown = set(re.findall(r'\{([^{}]+)\}', body.subject+body.body))-VARS
        if unknown: raise HTTPException(400, 'Variables inconnues : '+', '.join(sorted(unknown)))
        data = body.model_dump()
        await db.settings.update_one({'key': 'stay_message_'+kind}, {'$set': {'data': data}}, upsert=True)
        return data

    @router.get('/admin/booking-requests/{bid}/stay-message/{kind}')
    async def get_preview(bid: str, kind: str, user=Depends(current_user)):
        _, result = await preview(bid, kind)
        return result

    @router.post('/admin/booking-requests/{bid}/stay-message/{kind}')
    async def send(bid: str, kind: str, body: SendIn, user=Depends(current_user)):
        booking, result = await preview(bid, kind)
        if body.preview_hash != result['preview_hash']: raise HTTPException(409, 'Le modèle ou la réservation a changé. Rechargez l’aperçu avant envoi.')
        key = f'stay:{bid}:{kind}:{body.client_token}:{result["preview_hash"]}'
        html = emailer._wrap(result['subject'], '<p style="white-space:pre-wrap">'+escape(result['body']).replace('\n', '<br/>')+'</p>')
        ok = await emailer.send_email(to=result['to'], subject=result['subject'], html=html, lang='fr', kind='manuel', category='stay_'+kind,
            ref={'type': 'booking', 'id': bid, 'label': f'{KINDS[kind]} · {booking.get("name", "")}'}, dedupe_key=key)
        record = await db.email_log.find_one({'dedupe_key': key}, {'_id': 0, 'html': 0}) or {}
        # One history entry per journal record, even after retry/double click.
        await db.bookings.update_one({'id': bid, 'history.email_id': {'$ne': record.get('id')}}, {'$push': {'history': {
            'at': now(), 'action': KINDS[kind]+' : '+('pris en charge' if ok else 'non envoyé'),
            'detail': record.get('error') or '', 'email_id': record.get('id')}}, '$set': {'stay_messages.'+kind: {
            'at': now(), 'status': record.get('status', 'echec'), 'email_id': record.get('id'), 'error': record.get('error', '')}}})
        return {'ok': ok, 'email': record, 'delivery_disabled': record.get('status') == 'non_envoye'}

    return router
