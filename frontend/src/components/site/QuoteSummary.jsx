import { Minus, Plus } from "lucide-react";
import { uiLocale, useT } from "@/lib/i18n";

export const eur = (n) => {
  const v = Number(n || 0);
  return new Intl.NumberFormat(uiLocale(), { style: "currency", currency: "EUR", minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
};

export function Stepper({ value, min = 0, max = 10, onChange, testid, label }) {
  const { t } = useT();
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[#2D4A3E]/25 bg-white p-1" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} data-testid={`${testid}-minus`}
        className="grid h-10 w-10 place-items-center rounded-full text-[#1B2B24] disabled:opacity-30 hover:bg-[#EFEAE1]" aria-label={t("step.less")}><Minus size={16} /></button>
      <span className="w-8 text-center font-semibold tabular-nums text-[#1B2B24]" data-testid={`${testid}-value`}>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} data-testid={`${testid}-plus`}
        className="grid h-10 w-10 place-items-center rounded-full text-[#1B2B24] disabled:opacity-30 hover:bg-[#EFEAE1]" aria-label={t("step.more")}><Plus size={16} /></button>
    </div>
  );
}

function Line({ label, value, muted, strong, testid }) {
  return (
    <div className={`flex justify-between gap-4 py-1.5 ${strong ? "text-lg font-semibold text-[#1B2B24]" : muted ? "text-[#2D4A3E]" : "text-[#33423A]"}`} data-testid={testid}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}

function PayNote({ q, method, t }) {
  let text;
  if (method === "virement") text = t("q.noteTransfer", { amount: eur(q.to_pay ?? q.total) });
  else if (q.gift > 0) text = q.deposit_left > 0 ? t("q.noteGiftLeft", { amount: eur(q.deposit_left) }) : t("q.noteGiftCovers");
  else text = t("q.noteDeposit", { card: method === "carte", pct: q.deposit_percent, deposit: eur(q.deposit), balance: eur(q.balance) });
  return <p className="mt-2 text-xs text-[#526058]" data-testid="quote-payment-note">{text}</p>;
}

export default function QuoteSummary({ q, method, stale, loading, error, onRetry }) {
  const { t, td } = useT();
  if (error) {
    return (
      <div data-testid="booking-quote-failed" role="alert" className="rounded-md bg-[#B35432]/10 p-4 text-sm text-[#944125]">
        <p>{error}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-2 font-semibold underline underline-offset-4" data-testid="booking-quote-retry">{t("q.retry")}</button>}
      </div>
    );
  }
  if (!q) {
    return loading ? <p data-testid="booking-quote-loading" role="status" className="rounded-md border border-[#2D4A3E]/15 bg-white p-5 text-sm text-[#526058]">{t("bk.calculating")}</p> : null;
  }
  return (
    <div data-testid="booking-quote" data-stale={stale ? "true" : "false"} aria-busy={loading} className="relative rounded-md border border-[#2D4A3E]/15 bg-white p-5 text-sm">
      {stale && (
        <p data-testid="booking-quote-loading" role="status" className="mb-3 rounded bg-[#EFEAE1] px-3 py-2 text-xs font-semibold text-[#6B4E3D]">
          {loading ? t("q.staleLoading") : t("q.stale")}
        </p>
      )}
      <div className={`transition-opacity duration-200 ${stale ? "opacity-40" : "opacity-100"}`}>
      <p className="mb-3 text-xs uppercase tracking-[0.2em] font-semibold text-[#B35432]">{t("q.summary")}</p>
      <Line label={t("q.basePrice", { n: q.nights })} value={eur(q.full_price)} />
      {q.reduction > 0 && <Line label={t("q.reduction")} value={`- ${eur(q.reduction)}`} muted testid="quote-reduction" />}
      <Line label={t("q.lodging")} value={eur(q.base)} testid="quote-base" />
      {q.supplement > 0 && <Line label={t("q.supplement", { g: q.extra_guests, n: q.nights })} value={eur(q.supplement)} testid="quote-supplement" />}
      {q.breakfast > 0 && <Line label={t("q.breakfasts", { n: q.breakfasts, unit: eur(q.breakfast_unit) })} value={eur(q.breakfast)} testid="quote-breakfast" />}
      {(q.options || []).map((o) => <Line key={o.label} label={td(o.label)} value={o.amount ? eur(o.amount) : t("q.onRequest")} />)}
      {q.promo > 0 && <Line label={t("q.promo", { code: q.promo_code })} value={`- ${eur(q.promo)}`} muted testid="quote-promo" />}
      <div className="my-2 border-t border-[#2D4A3E]/15" />
      <Line label={t("q.total")} value={eur(q.total)} strong testid="quote-total" />
      {q.gift > 0 && (
        <>
          <Line label={t("q.gift", { code: q.gift_code })} value={`- ${eur(q.gift)}`} muted testid="quote-gift" />
          <Line label={t("q.toPay")} value={eur(q.to_pay)} strong testid="quote-to-pay" />
        </>
      )}
      <PayNote q={q} method={method} t={t} />
      </div>
    </div>
  );
}

