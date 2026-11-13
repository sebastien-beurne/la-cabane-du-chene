import { useEffect } from "react";
import { useSite } from "@/lib/site";
import { useT } from "@/lib/i18n";

const SITE = process.env.REACT_APP_RAILWAY === 'true' ? window.location.origin : process.env.REACT_APP_SITE_URL || "https://lacabaneduchene.fr";

function setMeta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

export default function Seo({ title, description, path = "/", jsonLd }) {
  const { td, lang } = useT();
  title = td(title);
  description = td(description);
  const site = useSite();
  const raw = String(site?.content?.general?.gsc_verification || "").trim();
  // Accepts the bare code or the full <meta ...> tag pasted from Google; updates the tag already in index.html (no duplicate).
  const verification = (raw.match(/content=["']([^"']+)["']/i)?.[1] || raw).replace(/[^A-Za-z0-9_-]/g, "");

  useEffect(() => {
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", SITE + path);
    if (verification && !document.head.querySelector('meta[name="google-site-verification"]')?.content) setMeta("name", "google-site-verification", verification);
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = SITE + path + (lang === "fr" ? "" : `?lang=${lang}`);
    let script = document.getElementById("jsonld");
    if (jsonLd) {
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "jsonld";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    } else if (script) script.remove();
  }, [title, description, path, jsonLd, verification, lang]);

  return null;
}

