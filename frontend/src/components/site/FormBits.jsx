import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { useT } from "@/lib/i18n";

export const inputCls =
  "w-full rounded-md border border-[#2D4A3E]/25 bg-white px-4 py-3 text-base text-[#1B2B24] placeholder:text-[#7a857f] outline-none transition-[border-color,box-shadow] focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/15";

export function Field({ label, htmlFor, children }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-[#1B2B24]">{label}</label>
      {children}
    </div>
  );
}

export function Honeypot({ value, onChange }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label htmlFor="website">Site web</label>
      <input id="website" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={onChange} />
    </div>
  );
}

export function Consent({ checked, onChange, testid }) {
  const { t } = useT();
  return (
    <label className="flex items-start gap-3 text-sm leading-relaxed text-[#33423A]" data-no-translate>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} data-testid={testid} className="mt-0.5" />
      <span>
        {t("form.consent")}{" "}
        <Link to="/confidentialite" className="underline underline-offset-4">{t("form.privacy")}</Link>
      </span>
    </label>
  );
}

