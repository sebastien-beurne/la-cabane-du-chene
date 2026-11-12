import { useEffect, useState } from "react";
import { CreditCard, Landmark } from "lucide-react";
import { http } from "@/lib/api";
import { eur } from "./QuoteSummary";
import { useT } from "@/lib/i18n";

/** Mandatory payment-method choice; bank transfer only offered once the owner has entered his bank details. */
export default function PaymentChoice({ value, onChange, quote }) {
  const { t } = useT();
  const [transfer, setTransfer] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    http.get("/payment-options", { signal: ctrl.signal }).then((r) => setTransfer(!!r.data?.transfer)).catch(() => { if (!ctrl.signal.aborted) setTransfer(false); });
    return () => ctrl.abort();
  }, []);
  useEffect(() => {
    if (!transfer && value === "virement") onChange("");
  }, [transfer, value, onChange]);
  const total = quote?.to_pay ?? quote?.total;
  const card = (on) => `flex w-full items-start gap-3 rounded-md border p-4 text-left transition-colors ${on ? "border-[#2D4A3E] bg-[#2D4A3E]/5 ring-1 ring-[#2D4A3E]" : "border-[#2D4A3E]/20 bg-white hover:bg-[#F4F1EA]"}`;
  return (
    <fieldset className="space-y-2" data-testid="payment-choice" role="radiogroup">
      <legend className="mb-2 text-sm font-semibold text-[#1B2B24]">{t("pay.legend")} <span className="text-[#B35432]">*</span></legend>
      <button type="button" role="radio" aria-checked={value === "carte"} onClick={() => onChange("carte")} className={card(value === "carte")} data-testid="payment-method-carte">
        <CreditCard size={20} className="mt-0.5 shrink-0 text-[#B35432]" />
        <span className="text-sm text-[#33423A]"><strong className="block text-[#1B2B24]">{t("pay.card")}</strong>
          {quote ? t("pay.cardQuote", { deposit: eur(quote.deposit_left ?? quote.deposit), balance: eur(quote.balance) }) : t("pay.cardNoQuote")}</span>
      </button>
      {transfer && (
        <button type="button" role="radio" aria-checked={value === "virement"} onClick={() => onChange("virement")} className={card(value === "virement")} data-testid="payment-method-virement">
          <Landmark size={20} className="mt-0.5 shrink-0 text-[#B35432]" />
          <span className="text-sm text-[#33423A]"><strong className="block text-[#1B2B24]">{t("pay.transfer")}</strong>
            {t("pay.transferText", { total: total ? eur(total) : "" })}</span>
        </button>
      )}
    </fieldset>
  );
}

