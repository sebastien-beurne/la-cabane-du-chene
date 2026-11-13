from mail_journal import record_blocked
from pymongo.errors import DuplicateKeyError
import os
import re
import ipaddress
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "La Cabane du Chêne")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
EMAIL_TEST_RECIPIENT = os.environ.get("EMAIL_TEST_RECIPIENT")  # optional, tests only: every send goes there instead

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


db = None  # set by server.py at startup: every send is journaled in db.email_log


def bref(b: dict) -> dict:
    return {"type": "booking", "id": b.get("id"), "label": f"{b.get('name') or 'Client'} · {b.get('check_in')} → {b.get('check_out')}"}


def gref(g: dict) -> dict:
    return {"type": "gift", "id": g.get("id"), "label": f"Carte cadeau {g.get('code') or g.get('transfer_ref') or ''} · {g.get('recipient_name') or ''}".strip()}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def send_email(*, to: str, subject: str, html: str, lang: str = "fr", kind: str = "automatique",
                     category: str = "", ref: Optional[dict] = None, dedupe_key: Optional[str] = None) -> bool:
    """Returns True only if the provider accepted the e-mail; never raises (forms must still succeed).
    Journal statuses: en_cours -> envoye (provider returned an id) | echec. The provider exposes no delivery
    events, so 'livre' is never set without proof."""
    if os.environ.get("EMAIL_DELIVERY_MODE") == "disabled" or not EMAIL_KEY:
        await record_blocked(db,to=to,subject=subject,html=html,lang=lang,kind=kind,category=category,ref=ref,dedupe_key=dedupe_key)
        return False
    if lang and lang != "fr":
        try:
            import translate
            subject, html = await translate.translate_email(lang, subject, html)
        except Exception as e:
            logger.error(f"Email translation error: {e}")
    log_id = None
    if db is not None:
        if dedupe_key:
            prev = await db.email_log.find_one({"dedupe_key": dedupe_key}, {"_id": 0, "id": 1, "status": 1, "deleted_at": 1})
            if prev and prev.get("deleted_at"): return False
            if prev and prev["status"] in ("envoye", "livre", "en_cours"):
                return prev["status"] != "en_cours"
            log_id = prev["id"] if prev else None
        rec = {"to": to, "subject": subject, "html": html, "kind": kind, "category": category, "ref": ref,
               "redirected_to": EMAIL_TEST_RECIPIENT or None,
               "lang": lang or "fr", "status": "en_cours", "error": "", "provider_id": None, "updated_at": _now()}
        try:
            if log_id:
                claim = await db.email_log.update_one({"id": log_id, "deleted_at": None, "status": {"$in": ["echec", "non_envoye"]}}, {"$set": rec, "$inc": {"attempts": 1}})
                if not claim.modified_count:
                    current = await db.email_log.find_one({"id":log_id}) or {}
                    return current.get("status") in ("envoye","livre")
            else:
                log_id = str(uuid.uuid4())
                await db.email_log.insert_one({**rec, "id": log_id, "dedupe_key": dedupe_key, "attempts": 1, "created_at": _now()})
        except DuplicateKeyError:
            current = await db.email_log.find_one({"dedupe_key":dedupe_key}) or {}
            return current.get("status") in ("envoye","livre")
        except Exception as e:
            logger.error(f"Email journal error: {e}")
            return False
    ok, provider_id, error = False, None, ""
    try:
        _assert_safe_email(subject, html)
    except ValueError as e:
        if log_id:
            await db.email_log.update_one({"id": log_id}, {"$set": {"status": "echec", "error": f"Bloqué par le contrôle de sécurité : {e}", "updated_at": _now()}})
        raise
    try:
        payload = {"to": [EMAIL_TEST_RECIPIENT or to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
        if EMAIL_REPLY_TO:
            payload["contact_email"] = EMAIL_REPLY_TO
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                     headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        try:
            provider_id = (resp.json() or {}).get("id")
        except ValueError:
            provider_id = None
        ok = bool(provider_id) or resp.status_code in (200, 202)
    except httpx.HTTPStatusError as e:
        try:
            info = e.response.json()
            error = f"{e.response.status_code} {info.get('code') or ''} {info.get('message') or info.get('error') or ''}".strip()
        except ValueError:
            error = f"{e.response.status_code} {e.response.text[:200]}"
        logger.warning(f"Email send refused: {error}")
    except Exception as e:
        error = str(e)[:300] or e.__class__.__name__
        logger.error(f"Email send error: {error}")
    if log_id:
        await db.email_log.update_one({"id": log_id}, {"$set": {"status": "envoye" if ok else "echec", "provider_id": provider_id,
                                                               "error": "" if ok else (error or "refusé par le prestataire"),
                                                               "sent_at": _now() if ok else None, "updated_at": _now()}})
    return ok


def _wrap(title: str, inner: str) -> str:
    return (
        '<table role="presentation" width="100%" style="background:#F8F5F0"><tr><td style="padding:32px 20px">'
        '<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:6px">'
        f'<tr><td style="padding:28px;font-family:Georgia,serif;font-size:22px;color:#1B2B24">{escape(title)}</td></tr>'
        f'<tr><td style="padding:0 28px 28px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#33423A">{inner}</td></tr>'
        f'<tr><td style="padding:16px 28px;font-family:Arial,sans-serif;font-size:12px;color:#6b6b6b;border-top:1px solid #eee">'
        f'{escape(EMAIL_FROM_NAME)} · Valmunster, Moselle. <span>Nous ne vous demanderons jamais vos coordonnées bancaires par e-mail.</span></td></tr>'
        '</table></td></tr></table>'
    )


def _rows(pairs) -> str:
    return "".join(
        f'<tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">{escape(k)}</td><td style="padding:4px 0">{escape(str(v or "—"))}</td></tr>'
        for k, v in pairs
    )


def _payment_row(b: dict) -> list:
    q = b.get("quote") or {}
    if b.get("payment_method") == "virement":
        return [("Moyen de paiement", f"Virement bancaire : règlement de 100 % ({eur(q.get('to_pay', b.get('total')))}) après confirmation de vos dates")]
    if not q:
        return []
    dep = q.get("deposit_left", q.get("deposit"))
    return [("Moyen de paiement", f"Carte bancaire : acompte de {q.get('deposit_percent', 30)} % ({eur(dep)}) après confirmation de vos dates, puis solde de {eur(q.get('balance'))} avant l'arrivée")]


def booking_owner_email(b: dict) -> tuple[str, str]:
    inner = (
        "<p>Une nouvelle demande de réservation vient d'arriver depuis le site.</p>"
        f'<table role="presentation">{_rows([("Arrivée", b["check_in"]), ("Départ", b["check_out"]), ("Voyageurs", b["guests"]), ("Nom", b["name"]), ("E-mail", b["email"]), ("Téléphone", b.get("phone")), ("Adresse", b.get("address")), ("Options", ", ".join(b.get("options") or [])), ("Message", b.get("message"))] + _quote_rows(b.get("quote")) + [("Total estimé", eur(b.get("total")))] + _payment_row(b))}</table>'
        "<p>Répondez au voyageur pour confirmer ou décliner, puis mettez à jour le statut dans l'espace administration.</p>"
    )
    return f"Nouvelle demande de réservation — {b['check_in']} au {b['check_out']}", _wrap("Nouvelle demande de réservation", inner)


def booking_guest_email(b: dict) -> tuple[str, str]:
    inner = (
        f"<p>Bonjour {escape(b['name'])},</p>"
        "<p>Merci pour votre demande. Nous l'avons bien reçue et revenons vers vous rapidement.</p>"
        "<p><strong>Important :</strong> il s'agit d'une demande de réservation. Votre séjour sera confirmé uniquement après notre réponse.</p>"
        f'<table role="presentation">{_rows([("Arrivée", b["check_in"]), ("Départ", b["check_out"]), ("Voyageurs", b["guests"])] + _quote_rows(b.get("quote")) + [("Total estimé", eur(b.get("total")))] + _payment_row(b))}</table>'
        "<p>Aucun paiement n'est demandé avant la confirmation de vos dates.</p>"
        "<p>À très bientôt,<br/>La Cabane du Chêne</p>"
    )
    return "Nous avons bien reçu votre demande de réservation", _wrap("Demande bien reçue", inner)


def _stay(b: dict) -> str:
    amount = f"{b['deposit']['amount']:.2f} €".replace(".", ",")
    label = "Solde" if b["deposit"].get("kind") == "solde" else "Acompte"
    return f'<table role="presentation">{_rows([("Arrivée", b["check_in"]), ("Départ", b["check_out"]), (label, amount)])}</table>'


def eur(v) -> str:
    return f"{float(v or 0):.2f} €".replace(".", ",")


def _quote_rows(q: dict) -> list:
    if not q:
        return []
    rows = [(f"Hébergement ({q['nights']} nuit{'s' if q['nights'] > 1 else ''})", eur(q["base"]))]
    if q.get("supplement"):
        rows.append((f"Supplément {q['extra_guests']} pers.", eur(q["supplement"])))
    if q.get("breakfast"):
        rows.append((f"Petits-déjeuners ({q['breakfasts']})", eur(q["breakfast"])))
    rows += [(o["label"], eur(o["amount"])) for o in q.get("options") or []]
    if q.get("promo"):
        rows.append((f"Code promo {q.get('promo_code', '')}", "-" + eur(q["promo"])))
    if q.get("gift"):
        rows.append((f"Carte cadeau {q.get('gift_code', '')}", "-" + eur(q["gift"])))
    return rows


def recap_email(b: dict) -> tuple[str, str]:
    rows = [("Arrivée", b["check_in"]), ("Départ", b["check_out"]), ("Voyageurs", b["guests"])] + _quote_rows(b.get("quote"))
    rows += [("Total du séjour", eur(b.get("total"))), ("Déjà réglé", eur(b.get("paid"))), ("Reste à régler", eur(b.get("balance_due")))]
    inner = (f"<p>Bonjour {escape(b['name'])},</p><p>Voici le récapitulatif de votre séjour à La Cabane du Chêne.</p>"
             f'<table role="presentation">{_rows(rows)}</table><p>À très bientôt,<br/>La Cabane du Chêne</p>')
    return "Récapitulatif de votre séjour — La Cabane du Chêne", _wrap("Récapitulatif de votre séjour", inner)


def transfer_request_email(b: dict, bank: dict) -> tuple[str, str]:
    ref = b.get("transfer_ref") or b["id"][:8].upper()
    rows = [("Montant à virer (100 %)", eur(b["balance_due"])), ("Référence à indiquer", ref), ("Titulaire", bank.get("holder", "")),
            ("IBAN", bank.get("iban", "")), ("BIC", bank.get("bic", "")), ("Banque", bank.get("bank", "")),
            ("Séjour", f"du {b['check_in']} au {b['check_out']} · {b.get('guests', '')} pers.")]
    inner = (
        f"<p>Bonjour {escape(b.get('name') or '')},</p>"
        "<p>Bonne nouvelle : vos dates sont confirmées ! Vous avez choisi le règlement par virement bancaire. "
        "Merci de virer la totalité du séjour avec les coordonnées ci-dessous, en indiquant bien la référence.</p>"
        f'<table role="presentation">{_rows([(k, v) for k, v in rows if v])}</table>'
        "<p>Votre réservation est définitivement validée dès réception du virement : nous vous enverrons une confirmation.</p>"
        "<p>À très bientôt,<br/>La Cabane du Chêne</p>"
    )
    return f"Instructions de virement — réservation {ref}", _wrap("Règlement par virement", inner)


def deposit_request_email(b: dict, link: str) -> tuple[str, str]:
    solde = b["deposit"].get("kind") == "solde"
    what = "le solde de votre séjour" if solde else "l'acompte"
    inner = (
        f"<p>Bonjour {escape(b['name'])},</p>"
        + ("<p>Votre séjour approche ! Vous pouvez régler le solde en ligne ci-dessous.</p>" if solde else
           "<p>Bonne nouvelle : votre séjour à La Cabane du Chêne est confirmé. Pour le réserver définitivement, merci de régler l'acompte ci-dessous.</p>")
        + f"{_stay(b)}"
        f'<p style="margin:24px 0"><a href="{escape(link)}" style="background:#B35432;color:#ffffff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block;white-space:nowrap;line-height:1.3">Régler {what} en ligne</a></p>'
        "<p>Le paiement est sécurisé par Stripe : vos coordonnées bancaires ne sont jamais transmises ni conservées par notre site.</p>"
        "<p>À très bientôt,<br/>La Cabane du Chêne</p>"
    )
    return ("Solde de votre séjour à régler" if solde else "Votre séjour est confirmé — acompte à régler"), _wrap("Votre séjour à la cabane", inner)


def deposit_paid_guest_email(b: dict) -> tuple[str, str]:
    inner = (
        f"<p>Bonjour {escape(b['name'])},</p>"
        "<p>Nous avons bien reçu votre paiement. Merci ! Votre séjour est réservé.</p>"
        f"{_stay(b)}"
        f"<p>Reste à régler : {eur(b.get('balance_due'))}</p>"
        "<p>Les informations d'arrivée vous seront envoyées avant votre séjour.</p><p>La Cabane du Chêne</p>"
    )
    return "Paiement reçu — votre séjour est réservé", _wrap("Paiement bien reçu", inner)


def deposit_paid_owner_email(b: dict) -> tuple[str, str]:
    inner = f"<p>{escape(b['name'])} vient de régler un paiement en ligne.</p>{_stay(b)}<p>Reste dû : {eur(b.get('balance_due'))}</p>"
    return f"Paiement reçu — {b['name']} ({b['check_in']})", _wrap("Paiement reçu", inner)


VALID = "Valable jusqu'au"


def gift_card_email(g: dict, label: str, site: str) -> tuple[str, str]:
    msg = f'<p style="font-style:italic;white-space:pre-wrap">« {escape(g["message"])} »</p>' if g.get("message") else ""
    value = f"Crédit séjour de {eur(g['amount'])} (correspondant à {g['nights']} nuit(s) au tarif d'achat)" if g["type"] == "sejour" else eur(g["amount"])
    inner = (
        f"<p>Bonjour {escape(g.get('buyer_name') or '')},</p>"
        f"<p>Merci ! Voici la carte cadeau à offrir à <strong>{escape(g['recipient_name'])}</strong>.</p>"
        f'<p style="margin:24px 0;padding:18px;border:2px dashed #B35432;border-radius:6px;text-align:center;font-family:Georgia,serif">'
        f'<span style="display:block;font-size:13px;color:#6b6b6b">Code cadeau</span>'
        f'<span style="display:block;font-size:26px;letter-spacing:2px;color:#1B2B24">{escape(g["code"])}</span>'
        f'<span style="display:block;margin-top:8px;font-size:15px;color:#33423A">{escape(value)}</span></p>'
        f"{msg}"
        f'<table role="presentation">{_rows([(VALID, g["expires"])])}</table>'
        "<p>Pour l'utiliser : choisir ses dates sur le site, puis saisir ce code dans le champ « Code promo ou bon cadeau » du formulaire de réservation. "
        "Le montant est déduit du séjour ; un solde éventuel reste disponible sur la carte. "
        "Pour un crédit séjour, le tarif applicable est celui de la réservation : un complément peut être nécessaire.</p>"
        f'<p style="margin:24px 0"><a href="{escape(site)}/tarifs-disponibilites" style="background:#B35432;color:#ffffff;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block;white-space:nowrap;line-height:1.3">Voir les disponibilités</a></p>'
        "<p>À très bientôt,<br/>La Cabane du Chêne</p>"
    )
    return f"Votre carte cadeau La Cabane du Chêne — {g['code']}", _wrap(label, inner)


def gift_owner_email(g: dict, label: str) -> tuple[str, str]:
    inner = (f"<p>Une carte cadeau vient d'être achetée en ligne.</p>"
             f'<table role="presentation">{_rows([("Carte", label), ("Code", g["code"]), ("Acheteur", g.get("buyer_name")), ("E-mail", g.get("buyer_email")), ("Bénéficiaire", g["recipient_name"]), (VALID, g["expires"])])}</table>')
    return f"Carte cadeau vendue — {eur(g['amount'])}", _wrap("Nouvelle carte cadeau", inner)


def gift_transfer_email(g: dict, label: str, bank: dict) -> tuple[str, str]:
    rows = [("Carte", label), ("Montant à virer", eur(g["amount"])), ("Référence à indiquer", g["transfer_ref"]),
            ("Titulaire", bank.get("holder", "")), ("IBAN", bank.get("iban", "")), ("BIC", bank.get("bic", "")), ("Banque", bank.get("bank", ""))]
    inner = (
        f"<p>Bonjour {escape(g.get('buyer_name') or '')},</p>"
        f"<p>Merci pour votre commande d'une carte cadeau pour <strong>{escape(g['recipient_name'])}</strong>. "
        "Vous avez choisi le règlement par virement bancaire : merci de virer le montant ci-dessous en indiquant bien la référence.</p>"
        f'<table role="presentation">{_rows([(k, v) for k, v in rows if v])}</table>'
        "<p>Dès réception du virement, nous vous envoyons la carte cadeau par e-mail. La validité est précisée sur la carte.</p>"
        "<p>À très bientôt,<br/>La Cabane du Chêne</p>"
    )
    return f"Instructions de virement — carte cadeau {g['transfer_ref']}", _wrap("Règlement par virement", inner)


def gift_transfer_owner_email(g: dict, label: str) -> tuple[str, str]:
    inner = ("<p>Une carte cadeau a été commandée avec paiement par virement. Elle sera envoyée à l'acheteur quand vous cliquerez sur "
             "« Confirmer la réception du virement » dans l'espace propriétaire (Cartes cadeaux).</p>"
             f'<table role="presentation">{_rows([("Carte", label), ("Montant", eur(g["amount"])), ("Référence", g["transfer_ref"]), ("Acheteur", g.get("buyer_name")), ("E-mail", g.get("buyer_email")), ("Bénéficiaire", g["recipient_name"])])}</table>')
    return f"Carte cadeau commandée par virement — {eur(g['amount'])} ({g['transfer_ref']})", _wrap("Virement attendu", inner)



def contact_owner_email(m: dict) -> tuple[str, str]:
    inner = (
        "<p>Nouveau message reçu via le formulaire de contact.</p>"
        f'<table role="presentation">{_rows([("Nom", m["name"]), ("E-mail", m["email"]), ("Téléphone", m.get("phone")), ("Sujet", m.get("subject"))])}</table>'
        f'<p style="white-space:pre-wrap">{escape(m["message"])}</p>'
    )
    return f"Nouveau message de {m['name']}", _wrap("Nouveau message", inner)


def contact_guest_email(m: dict) -> tuple[str, str]:
    inner = (
        f"<p>Bonjour {escape(m['name'])},</p>"
        "<p>Merci pour votre message, nous l'avons bien reçu et vous répondrons dans les meilleurs délais.</p>"
        "<p>La Cabane du Chêne</p>"
    )
    return "Nous avons bien reçu votre message", _wrap("Message bien reçu", inner)

