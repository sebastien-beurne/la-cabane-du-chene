import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LANGS, useLang, useT } from "@/lib/i18n";

const NAMES = { fr: "Français", en: "English", nl: "Nederlands", de: "Deutsch" };

function Flag({ code, className = "h-4 w-6" }) {
  const svg = {
    fr: <><rect width="1" height="2" fill="#0055A4" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#EF4135" /></>,
    nl: <><rect width="3" height="0.667" fill="#AE1C28" /><rect y="0.667" width="3" height="0.667" fill="#fff" /><rect y="1.333" width="3" height="0.667" fill="#21468B" /></>,
    de: <><rect width="3" height="0.667" fill="#000" /><rect y="0.667" width="3" height="0.667" fill="#DD0000" /><rect y="1.333" width="3" height="0.667" fill="#FFCE00" /></>,
    en: <><rect width="3" height="2" fill="#012169" /><path d="M0 0L3 2M3 0L0 2" stroke="#fff" strokeWidth="0.4" /><path d="M0 0L3 2M3 0L0 2" stroke="#C8102E" strokeWidth="0.15" /><path d="M1.5 0V2M0 1H3" stroke="#fff" strokeWidth="0.6" /><path d="M1.5 0V2M0 1H3" stroke="#C8102E" strokeWidth="0.35" /></>,
  }[code];
  return <svg viewBox="0 0 3 2" className={`${className} shrink-0 rounded-[2px] shadow-sm ring-1 ring-black/10`} aria-hidden>{svg}</svg>;
}

export default function LangSwitcher({ light }) {
  const { lang, setLang } = useLang();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (LANGS.length < 2) return null;
  return (
    <div ref={ref} className="relative" data-no-translate data-testid="lang-switcher">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={t("lang.current", { name: NAMES[lang] })} title={t("lang.choose")} aria-haspopup="listbox" aria-expanded={open} data-testid="lang-current"
        className={`flex h-11 items-center gap-1 sm:gap-1.5 rounded-full px-1.5 sm:px-2.5 transition-colors ${light ? "hover:bg-white/10 text-white" : "hover:bg-brand/10 text-ink"}`}>
        <Flag code={lang} /><ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && (
        <ul className="absolute right-0 top-12 z-[60] w-44 overflow-hidden rounded-md border border-brand/15 bg-white py-1 shadow-xl" role="listbox" aria-label={t("lang.choose")}>
          {LANGS.map((l) => (
            <li key={l} role="option" aria-selected={l === lang} lang={l}>
              <button type="button" onClick={() => { setLang(l); setOpen(false); }} data-testid={`lang-option-${l}`}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink hover:bg-sand ${l === lang ? "font-semibold" : ""}`}>
                <Flag code={l} /> {NAMES[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

