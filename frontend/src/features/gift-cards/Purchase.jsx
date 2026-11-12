import { useGiftCards, errMsg } from "./context";
import { useEffect, useRef, useState } from "react";
import { Gift, Landmark, Loader2, Lock, CreditCard } from "lucide-react";
import { Field, inputCls, Consent } from "./ui";
import GiftCardView from "./GiftCardView";

const chip = (on) => `rounded-full border px-5 py-3 text-sm font-semibold transition-colors ${on ? "border-[rgb(var(--gift-primary-rgb))] bg-[rgb(var(--gift-primary-rgb))] text-white" : "border-[rgb(var(--gift-primary-rgb))]/25 bg-white text-[rgb(var(--gift-ink-rgb))] hover:bg-[#EFEAE1]"}`;

function Choice({ f, setF, stays }) {
  const { amounts, baseGuests, money: eur, text: tr } = useGiftCards();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tr('Type de carte')}>
        <button type="button" className={chip(f.type === "montant")} onClick={() => setF({ ...f, type: "montant" })} data-testid="gift-type-montant">{tr('Un montant')}</button>
        {stays.length > 0 && <button type="button" className={chip(f.type === "sejour")} onClick={() => setF({ ...f, type: "sejour", nights: f.nights || stays[0].nights })} data-testid="gift-type-sejour">{tr('Un crédit séjour')}</button>}
      </div>
      {f.type === "montant" ? (
        <div className="flex flex-wrap items-center gap-2">
          {amounts.map((a) => <button type="button" key={a} className={chip(Number(f.amount) === a)} onClick={() => setF({ ...f, amount: String(a) })} data-testid={`gift-amount-${a}`}>{eur(a)}</button>)}
          <label className="flex items-center gap-2 text-sm text-[#33423A]">{tr("ou")}
            <input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.,]/g, "") })} aria-label={tr('Montant personnalisé')} className={`${inputCls} w-28`} placeholder={tr("Montant")} data-testid="gift-amount-custom" />
          </label>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {stays.map((s) => (
            <button type="button" key={s.nights} className={`${chip(f.nights === s.nights)} flex justify-between rounded-md text-left`} onClick={() => setF({ ...f, nights: s.nights })} data-testid={`gift-stay-${s.nights}`}>
              <span>{tr(s.nights === 1 ? "1 nuit pour {guests}" : "{nights} nuits pour {guests}", { nights: s.nights, guests: baseGuests })}</span><span>{eur(s.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PayMethod({ value, onChange }) {
  const { api: http, text: tr } = useGiftCards();
  const [transfer, setTransfer] = useState(false);
  useEffect(() => {
    http.get("/gift-cards/payment-options").then((r) => setTransfer(!!r.data?.transfer)).catch(() => setTransfer(false));
  }, [http]);
  if (!transfer) return null;
  const opt = (k, Icon, title, text) => (
    <button type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} data-testid={`gift-method-${k}`}
      className={`flex w-full items-start gap-3 rounded-md border p-4 text-left transition-colors ${value === k ? "border-[rgb(var(--gift-primary-rgb))] bg-[rgb(var(--gift-primary-rgb))]/5 ring-1 ring-[rgb(var(--gift-primary-rgb))]" : "border-[rgb(var(--gift-primary-rgb))]/20 bg-white hover:bg-[#F4F1EA]"}`}>
      <Icon size={20} className="mt-0.5 shrink-0 text-[rgb(var(--gift-accent-rgb))]" />
      <span className="text-sm text-[#33423A]"><strong className="block text-[rgb(var(--gift-ink-rgb))]">{tr(title)}</strong>{tr(text)}</span>
    </button>
  );
  return (
    <fieldset className="space-y-2" data-testid="gift-payment-choice">
      <legend className="mb-2 text-sm font-semibold text-[rgb(var(--gift-ink-rgb))]">{tr('Moyen de paiement')}</legend>
      {opt("carte", CreditCard, "Carte bancaire", "Paiement sécurisé, carte envoyée immédiatement par e-mail.")}
      {opt("virement", Landmark, "Virement bancaire", "Vous recevez nos coordonnées bancaires ; la carte vous est envoyée par e-mail dès réception du virement.")}
    </fieldset>
  );
}

function TransferDone({ t }) {
  const { money: eur, text: tr } = useGiftCards();
  const rows = [["Montant à virer", eur(t.amount)], ["Référence à indiquer", t.ref], ["Titulaire", t.holder], ["IBAN", t.iban], ["BIC", t.bic], ["Banque", t.bank]].filter(([, v]) => v);
  return (
    <div className="space-y-4 rounded-md border border-[rgb(var(--gift-primary-rgb))]/15 bg-white p-5 md:p-8" data-testid="gift-transfer-done">
      <h2 className="font-display text-2xl text-[rgb(var(--gift-ink-rgb))]">{tr('Merci ! Votre commande est enregistrée')}</h2>
      <p className="text-sm text-[#33423A]">{t.label}. {tr("Merci d’effectuer le virement en indiquant la référence. La carte est envoyée après réception du paiement.")}{t.email_sent ? tr("Ces informations vous ont aussi été envoyées par e-mail.") : ""}</p>
      <dl className="divide-y divide-[rgb(var(--gift-primary-rgb))]/10 text-sm">
        {rows.map(([k, v]) => <div key={k} className="flex flex-wrap justify-between gap-2 py-2"><dt className="text-[#526058]">{tr(k)}</dt><dd className="font-semibold text-[rgb(var(--gift-ink-rgb))] break-all" data-no-translate>{v}</dd></div>)}
      </dl>
    </div>
  );
}

function OrderForm({ cancelled }) {
  const { offers: stays, api: http, money: eur, validityDays, minAmount, maxAmount, checkoutEnabled, text: tr } = useGiftCards();
  const [f, setF] = useState({ type: "montant", amount: "100", nights: 0, buyer_name: "", buyer_email: "", recipient_name: "", message: "", consent: false, method: "carte" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [transfer, setTransfer] = useState(null);
  const value = f.type === "sejour" ? stays.find((s) => s.nights === f.nights)?.price : Number(String(f.amount).replace(",", "."));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!checkoutEnabled) return;
    setErr("");
    if (f.type === "montant" && (!Number.isFinite(value) || value < minAmount || value > maxAmount)) return setErr(tr("Montant entre {min} et {max}.", { min: eur(minAmount), max: eur(maxAmount) }));
    if (!f.consent) return setErr(tr("Merci d’accepter le traitement de vos données."));
    setBusy(true);
    try {
      const r = await http.post("/gift-cards/checkout", { ...f, amount: f.type === "montant" ? value : null, nights: f.type === "sejour" ? f.nights : null, origin_url: window.location.origin });
      if (r.data?.transfer) { setTransfer(r.data.transfer); setBusy(false); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      if (r.data?.checkout_url) { window.location.href = r.data.checkout_url; return; }
      throw new Error("Réponse de commande invalide");
    } catch (x) { setErr(errMsg(x)); setBusy(false); }
  };

  if (transfer) return <TransferDone t={transfer} />;
  const byCard = f.method !== "virement";

  return (
    <form onSubmit={submit} className="space-y-7 rounded-md border border-[rgb(var(--gift-primary-rgb))]/15 bg-white p-5 md:p-8" data-testid="gift-form">
      {cancelled && <p className="rounded-md bg-[rgb(var(--gift-accent-rgb))]/10 p-3 text-sm text-[#944125]" data-testid="gift-cancelled">{tr("Le paiement a été annulé. Vous pouvez réessayer quand vous le souhaitez.")}</p>}
      <Choice f={f} setF={setF} stays={stays} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={tr('Votre nom')} htmlFor="g-buyer"><input id="g-buyer" required value={f.buyer_name} onChange={set("buyer_name")} className={inputCls} autoComplete="name" data-testid="gift-buyer-name" /></Field>
        <Field label={tr('Votre e-mail (réception de la carte)')} htmlFor="g-email"><input id="g-email" type="email" required value={f.buyer_email} onChange={set("buyer_email")} className={inputCls} autoComplete="email" data-testid="gift-buyer-email" /></Field>
        <Field label={tr("Prénom de la personne à qui vous l'offrez")} htmlFor="g-to"><input id="g-to" required value={f.recipient_name} onChange={set("recipient_name")} className={inputCls} data-testid="gift-recipient" /></Field>
      </div>
      <Field label={tr('Petit mot (facultatif, imprimé sur la carte)')} htmlFor="g-msg"><textarea id="g-msg" rows={3} maxLength={600} value={f.message} onChange={set("message")} className={inputCls} data-testid="gift-message" /></Field>
      {f.type === "sejour" && <p className="text-sm">{tr("Ce cadeau est un crédit de {amount}. Un complément peut être nécessaire selon le tarif à la réservation.", { amount: eur(value) })}</p>}
      <PayMethod value={f.method} onChange={(m) => setF({ ...f, method: m })} />
      <Consent checked={f.consent} onChange={(v) => setF({ ...f, consent: v })} testid="gift-consent" />
      {err && <p className="rounded-md bg-[rgb(var(--gift-accent-rgb))]/10 p-3 text-sm text-[#944125]" data-testid="gift-error">{tr(err)}</p>}
      <button disabled={busy || !checkoutEnabled} data-testid="gift-submit" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[rgb(var(--gift-accent-rgb))] px-6 py-4 font-semibold text-[#F8F5F0] transition-colors hover:bg-[#944125] disabled:opacity-60">
        {busy ? <Loader2 size={18} className="animate-spin" /> : byCard ? <Lock size={16} /> : <Landmark size={16} />} {!checkoutEnabled ? tr("Bientôt disponible en ligne") : byCard ? tr("Payer {amount} par carte", { amount: value > 0 ? eur(value) : "" }) : tr("Commander et payer {amount} par virement", { amount: value > 0 ? eur(value) : "" })}
      </button>
      <p className="text-center text-xs text-[#526058]">{!checkoutEnabled ? tr("Pour offrir un séjour, contactez-nous : nous vous précisons les possibilités et les modalités.") : byCard ? tr("Paiement sécurisé par Stripe. Carte valable {days} jours, envoyée par e-mail et imprimable.", { days: validityDays }) : tr("Carte valable {days} jours, envoyée par e-mail dès réception du virement.", { days: validityDays })}</p>
    </form>
  );
}

function Thanks({ sessionId }) {
  const { api: http, text: tr } = useGiftCards();
  const [g, setG] = useState(null);
  const [done, setDone] = useState(false);
  const tries = useRef(0);
  useEffect(() => {
    let timer;
    let cancelled = false;
    tries.current = 0;
    setDone(false);
    setG(null);
    const poll = async () => {
      try {
        const r = await http.get(`/gift-cards/status/${sessionId}`);
        if (cancelled) return;
        setG(r.data);
        if (r.data?.code) { setDone(true); return; }
      } catch (e) { /* retry */ }
      if (cancelled) return;
      tries.current += 1;
      if (tries.current < 15) timer = setTimeout(poll, 2000); else setDone(true);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId]);
  if (!done) return <p className="flex items-center gap-3 text-[#526058]" data-testid="gift-checking"><Loader2 size={16} className="animate-spin" /> Vérification du paiement…</p>;
  if (!g?.code) return <p className="rounded-md bg-[rgb(var(--gift-accent-rgb))]/10 p-4 text-[#944125]" data-testid="gift-not-paid">{tr("Le paiement n'a pas encore été confirmé. Si vous avez été débité, contactez-nous : nous vous enverrons votre carte.")}</p>;
  if (g.status === "annulee") return <p role="alert">{tr('Cette carte cadeau a été annulée. Contactez-nous pour vérifier son remboursement.')}</p>;
  return (
    <div className="space-y-6" data-testid="gift-success">
      <p className="text-[#33423A]">{g.email_sent ? tr("Merci ! La carte a été envoyée à votre adresse e-mail.") : tr("Merci ! Votre carte est prête. L’envoi par e-mail n’est pas confirmé ; vous pouvez l’imprimer ci-dessous.")}</p>
      <GiftCardView g={g} />
      <button type="button" onClick={() => window.print()} data-print-hide className="rounded-full border border-[rgb(var(--gift-primary-rgb))]/30 px-6 py-3 text-sm font-semibold" data-testid="gift-print">{tr('Imprimer la carte')}</button>
    </div>
  );
}

export default function GiftCardPurchase({ sessionId, cancelled = false }) {
  const { title, description, validityDays, checkoutEnabled, text: tr } = useGiftCards();
  return <section data-no-translate data-testid="gift-page" className="bg-[#FBF9F5] pb-12">
    <div data-print-hide>
      <h1 className="flex items-center gap-4 text-4xl font-medium text-[rgb(var(--gift-ink-rgb))]"><Gift size={36} />{tr(title)}</h1>
      {!sessionId && <p className="mt-5 text-[#33423A]">{tr(description)} {checkoutEnabled ? tr("Validité : {days} jours.", { days: validityDays }) : tr("Les modalités de l’offre vous seront précisées avant tout achat.")}</p>}
    </div>
    <div className="mt-10">{sessionId ? <Thanks sessionId={sessionId} /> : <OrderForm cancelled={cancelled} />}</div>
  </section>;
}

