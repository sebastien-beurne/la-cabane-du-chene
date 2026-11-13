import { useState } from 'react';
import { CalendarDays, Coffee } from 'lucide-react';
import ContactForm from './ContactForm';
import { useT } from '@/lib/i18n';
import { Field, inputCls } from './FormBits';

export default function QuoteRequest() {
  const { td } = useT();
  const tr = (source, params = {}) => td(source).replace(/\{(\w+)\}/g, (whole,key) => params[key] ?? whole);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [guests, setGuests] = useState('2');
  const [ready, setReady] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  return <div data-no-translate data-testid="quote-request" className="space-y-7 rounded-md border border-brand/15 bg-white p-5 md:p-8">
    <div className="flex gap-3 rounded-md bg-sand p-4 text-sm leading-relaxed text-body">
      <CalendarDays size={21} className="shrink-0 text-action" />
      <p>{tr('Partagez vos dates : nous vous confirmons personnellement les disponibilités et le tarif de votre séjour. Aucun paiement à cette étape.')}</p>
    </div>
    {!ready ? <form onSubmit={(e) => {
      e.preventDefault();
      const values = new FormData(e.currentTarget);
      const arrival = String(values.get('check_in') || from);
      const departure = String(values.get('check_out') || to);
      if (!arrival || !departure || departure <= arrival) return;
      setFrom(arrival); setTo(departure); setReady(true);
    }} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={tr('Arrivée souhaitée')} htmlFor="request-from"><input id="request-from" name="check_in" data-testid="request-from" type="date" required min={today} value={from} onInput={(e) => setFrom(e.currentTarget.value)} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></Field>
        <Field label={tr('Départ souhaité')} htmlFor="request-to"><input id="request-to" name="check_out" data-testid="request-to" type="date" required min={from ? new Date(new Date(from).getTime() + 86400000).toISOString().slice(0, 10) : today} value={to} onInput={(e) => setTo(e.currentTarget.value)} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label={tr('Nombre de personnes')} htmlFor="request-guests"><select id="request-guests" value={guests} onChange={(e) => setGuests(e.target.value)} className={inputCls}>{[1,2,3,4].map((n)=><option key={n} value={n}>{tr(n===1 ? "1 personne" : "{guests} personnes", { guests: n })}</option>)}</select></Field>
      <p className="flex items-center gap-2 text-sm text-brand"><Coffee size={18} /> {tr("Petit déjeuner sucré inclus")}</p>
      <button data-testid="request-continue" className="w-full rounded-full bg-brand px-6 py-4 font-semibold text-white">{tr('Préparer ma demande')}</button>
    </form> : <div>
      <p className="mb-5 text-sm text-muted-ink">{tr("Du {from} au {to} · {guests} personne(s)", { from: from.split("-").reverse().join("/"), to: to.split("-").reverse().join("/"), guests })} <button onClick={() => setReady(false)} className="ml-2 underline">{tr('Modifier')}</button></p>
      <ContactForm initialSubject={tr("Demande de séjour")} initialMessage={tr("Bonjour, nous souhaitons séjourner du {from} au {to}, pour {guests} personne(s). Pouvez-vous nous confirmer le tarif et la disponibilité ?", { from, to, guests })} />
    </div>}
  </div>;
}
