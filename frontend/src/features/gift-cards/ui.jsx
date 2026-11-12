import { useGiftCards } from "./context";

export const inputCls = "w-full rounded-md border border-[rgb(var(--gift-primary-rgb))]/25 bg-white px-4 py-3 text-base text-[rgb(var(--gift-ink-rgb))] placeholder:text-[#7a857f] outline-none focus:ring-2 focus:ring-[rgb(var(--gift-primary-rgb))]/15";

export function Field({ label, htmlFor, children }) {
  return <div className="space-y-2"><label htmlFor={htmlFor} className="block text-sm font-semibold">{label}</label>{children}</div>;
}

export function Consent({ checked, onChange, testid }) {
  const { renderConsent, privacyUrl } = useGiftCards();
  if (renderConsent) return renderConsent({ checked, onChange, testid });
  return <label className="flex items-start gap-3 text-sm leading-relaxed">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testid} />
    <span>J’accepte le traitement de mes données pour cette commande. <a href={privacyUrl} className="underline">Confidentialité</a></span>
  </label>;
}

