"""One refusal notification per refusal transition; never include private admin notes."""
import os
from html import escape
import emailer
from mail_journal import record_blocked

COPY={
 'fr':('Votre demande de séjour — {brand}','Bonjour {name},','Nous sommes désolés de ne pas pouvoir accepter votre demande de séjour du {start} au {end}.','Votre réservation n’est pas confirmée. Merci de votre compréhension.','Au plaisir de vous accueillir une autre fois,'),
 'en':('Your stay request — {brand}','Hello {name},','We are sorry that we cannot accept your request to stay from {start} to {end}.','Your booking is not confirmed. Thank you for your understanding.','We hope to welcome you another time,'),
 'de':('Ihre Aufenthaltsanfrage — {brand}','Guten Tag {name},','Leider können wir Ihre Anfrage für den Aufenthalt vom {start} bis {end} nicht annehmen.','Ihre Buchung ist nicht bestätigt. Vielen Dank für Ihr Verständnis.','Wir hoffen, Sie ein anderes Mal begrüßen zu dürfen,'),
 'nl':('Uw verblijfsaanvraag — {brand}','Beste {name},','Helaas kunnen wij uw aanvraag voor een verblijf van {start} tot {end} niet aanvaarden.','Uw boeking is niet bevestigd. Bedankt voor uw begrip.','We hopen u een andere keer te mogen verwelkomen,')}

def refusal_email(booking,content):
    brand=(content.get('general') or {}).get('name') or os.environ.get('EMAIL_FROM_NAME') or 'Votre hébergement'
    lang=booking.get('lang') if booking.get('lang') in COPY else 'fr'
    subject,*parts=COPY[lang]
    values={'name':booking.get('name') or '', 'start':booking.get('check_in') or '', 'end':booking.get('check_out') or '', 'brand':brand}
    title=subject.format(**values)
    html=''.join('<p>'+escape(p.format(**values))+'</p>' for p in parts)+'<p>'+escape(brand)+'</p>'
    return title,emailer._wrap(title,html)

async def notify_refusal(db,booking,content):
    key=f"booking-refusal:{booking['id']}:{booking.get('refusal_generation',1)}"
    subject,html=refusal_email(booking,content)
    target=booking.get('email') or ''
    if target:
        ok=await emailer.send_email(to=target,subject=subject,html=html,lang='fr',category='reservation_refusee',ref=emailer.bref(booking),dedupe_key=key)
    else:
        ok=False
        await record_blocked(db,to='',subject=subject,html=html,category='reservation_refusee',ref=emailer.bref(booking),dedupe_key=key,reason='Adresse e-mail du client manquante')
    entry=await db.email_log.find_one({'dedupe_key':key},{'_id':0}) or {}
    result={'status':entry.get('status') or ('envoye' if ok else 'echec'),'email_id':entry.get('id'),'error':entry.get('error') or '', 'to':target}
    await db.bookings.update_one({'id':booking['id']},{'$set':{'refusal_notification':result},'$push':{'history':{'at':entry.get('updated_at'),'action':'Notification du refus au client','detail':'E-mail pris en charge' if ok else result['error'] or 'Échec de notification'}}})
    return result
