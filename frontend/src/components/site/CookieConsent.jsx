import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSite } from "@/lib/site";
import { useT } from "@/lib/i18n";

const KEY = "cdf-cookie-consent";

function loadGa(id) {
  if (!id || document.getElementById("ga-script")) return;
  window.dataLayer = window.dataLayer || [];
  const s = document.createElement("script");
  s.id = "ga-script";
  s.async = true;
  if (id.toUpperCase().startsWith("GTM-")) {
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);
    return;
  }
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id, { anonymize_ip: true });
}

export default function CookieConsent() {
  const { t } = useT();
  const pat = /^(G|GTM)-[A-Z0-9]{4,}$/i;
  const pick = (v) => { const s = (v || "").trim(); return pat.test(s) ? s : ""; };
  const gaId = pick(useSite()?.content?.general?.ga_id) || pick(process.env.REACT_APP_GTM_ID);
  const [choice, setChoice] = useState(() => localStorage.getItem(KEY));

  useEffect(() => {
    if (gaId && choice === "accept") loadGa(gaId);
  }, [gaId, choice]);

  if (!gaId || choice) return null;
  const decide = (v) => { localStorage.setItem(KEY, v); setChoice(v); };
  return (
    <div data-testid="cookie-banner" data-no-translate role="dialog" aria-label={t("cookie.label")} className="fixed bottom-24 md:bottom-5 left-3 right-3 md:left-5 md:right-auto md:max-w-md z-50 rounded-md bg-[#F8F5F0] p-5 shadow-2xl border border-[#2D4A3E]/15">
      <p className="text-sm text-[#33423A] leading-relaxed">
        {t("cookie.text")} <Link to="/confidentialite" className="underline">{t("cookie.more")}</Link>
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={() => decide("refuse")} data-testid="cookie-refuse" className="flex-1 rounded-full border border-[#2D4A3E]/30 px-4 py-2.5 text-sm">{t("cookie.refuse")}</button>
        <button onClick={() => decide("accept")} data-testid="cookie-accept" className="flex-1 rounded-full bg-[#2D4A3E] px-4 py-2.5 text-sm text-[#F8F5F0]">{t("cookie.accept")}</button>
      </div>
    </div>
  );
}

