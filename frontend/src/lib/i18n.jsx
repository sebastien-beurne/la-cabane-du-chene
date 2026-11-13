import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import { de, enGB, fr, nl } from "date-fns/locale";
import { DATE_FMT, MESSAGES } from "@/lib/messages";

export const LANGS = ["fr", "en", "de", "nl"];
export const LOCALES = { fr: "fr-FR", en: "en-GB", nl: "nl-NL", de: "de-DE" };

/** Saved choice, else the visitor's browser language (country locale), else English. */
export function initialLang() {
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (LANGS.includes(requested)) return requested;
  try {
    const s = localStorage.getItem("site_lang");
    if (LANGS.includes(s)) return s;
  } catch (e) { /* private mode */ }
  if (/bot|crawl|spider|slurp|lighthouse|google|bing/i.test(navigator.userAgent || "")) return "fr";
  const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]);
  const hit = prefs.map((l) => String(l).slice(0, 2).toLowerCase()).find((l) => LANGS.includes(l));
  return hit || "fr";
}

let currentLang = "fr";
/** Language used for dates / numbers formatting (public site). */
export const uiLocale = () => LOCALES[currentLang] || "fr-FR";
const DF = { fr, en: enGB, nl, de };
/** date-fns locale of the current language (calendar months, written dates). */
export const dfLocale = () => DF[currentLang] || fr;

const LangCtx = createContext({ lang: "fr", setLang: () => {} });
const DynCtx = createContext(0);
export const useLang = () => useContext(LangCtx);

/** Fixed UI text by stable key, in the given language (French as fallback). */
export function msg(lang, key, p) {
  const e = MESSAGES[key];
  if (!e) return key;
  const v = e[lang] ?? e.fr;
  return typeof v === "function" ? v(p ?? {}) : v;
}

const ATTRS = ["placeholder", "aria-label", "title", "alt"];
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "TEXTAREA", "IFRAME"]);
const worth = (s) => s.length > 1 && /[A-Za-zÀ-ÿ]{2}/.test(s) && !/^[\w.+-]+@[\w.-]+$/.test(s) && !/^https?:\/\//.test(s);

const store = {
  load(l) { try { return JSON.parse(localStorage.getItem(`chene_i18n_20261112_${l}`) || "{}"); } catch (e) { return {}; } },
  save(l, m) { try { localStorage.setItem(`chene_i18n_20261112_${l}`, JSON.stringify(m)); } catch (e) { /* quota */ } },
};
const caches = {};
const cacheOf = (l) => { if (!caches[l]) caches[l] = store.load(l); return caches[l]; };
const bundles = {};
/** Prepared translations of the fixed texts and site content, shipped with the site (public/i18n/<lang>.json). */
function loadBundle(l) {
  if (!bundles[l]) {
    bundles[l] = fetch(`/i18n/${l}.json?v=cabane-20261113-r7`, { cache: "force-cache" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  }
  return bundles[l];
}
let active = null; // translator of the public site, if mounted

/** Owner-entered / server text (French) in the given language: prepared or cached translation, else asked in background. */
function dynText(lang, s) {
  if (lang === "fr" || typeof s !== "string") return s;
  const core = s.trim();
  if (!core) return s;
  const tr = cacheOf(lang)[core];
  if (tr) return s.replace(core, tr);
  if (active) active.want(core);
  return s;
}

/** Hook for components that render their texts themselves (menus, calendar, forms, quotes). */
export function useT() {
  const { lang } = useContext(LangCtx);
  useContext(DynCtx); // re-render when background translations of owner texts arrive
  const t = (key, p) => msg(lang, key, p);
  const td = (s) => dynText(lang, s);
  const fmtDate = (d, kind = "day") => format(d, DATE_FMT[kind][lang] || DATE_FMT[kind].fr, { locale: DF[lang] || fr });
  return { lang, t, td, fmtDate, dateLocale: DF[lang] || fr };
}

/** Translates the remaining visible texts of the public site (page contents) in place.
 *  Zones marked data-no-translate render their own texts and are never touched nor observed. */
function createTranslator(root, onStatus, onDyn) {
  const recs = new Map();
  let lang = "fr";
  let gen = 0;
  const pending = new Set();
  const failed = new Set();
  const ctrls = new Set();
  let timer = null;
  let inflight = 0;
  let bundleReady = true;
  let stopped = false;
  let lastStatus = "idle";

  // Only notify React when the visible status really changes (a new object each time re-rendered the app on every mutation).
  const report = () => {
    let s = { state: "idle" };
    if (lang !== "fr" && (!bundleReady || inflight || pending.size)) s = { state: "loading" };
    else if (lang !== "fr" && failed.size) s = { state: "error", count: failed.size };
    const key = `${s.state}:${s.count || 0}`;
    if (key === lastStatus || stopped) return;
    lastStatus = key;
    if (s.state === "error" && import.meta.env.DEV) console.warn("Missing prepared translations", lang, JSON.stringify([...failed]));
    onStatus(s);
  };
  const skipEl = (el) => !el || el.closest?.("[data-no-translate]") || SKIP.has(el.tagName?.toUpperCase());

  const apply = (rec) => {
    const core = rec.orig.trim();
    const tr = lang === "fr" ? null : cacheOf(lang)[core];
    const next = tr ? rec.orig.replace(core, tr) : rec.orig;
    rec.tr = next;
    if (rec.get() !== next) rec.set(next);
    if (lang !== "fr" && !tr && worth(core) && !failed.has(core)) pending.add(core);
  };

  const track = (key, get, set) => {
    const cur = get();
    if (cur == null) return;
    let rec = recs.get(key);
    if (rec && cur === rec.tr) return; // our own write
    if (!rec) { rec = { get, set }; recs.set(key, rec); }
    rec.orig = cur;
    apply(rec);
  };

  const attrKeys = new WeakMap();
  const trackAttr = (el, a) => {
    let m = attrKeys.get(el);
    if (!m) { m = {}; attrKeys.set(el, m); }
    if (!m[a]) m[a] = { el, a };
    track(m[a], () => el.getAttribute(a), (v) => el.setAttribute(a, v));
  };
  const scan = (node) => {
    if (node.nodeType === 3) {
      if (!skipEl(node.parentElement)) track(node, () => node.nodeValue, (v) => { node.nodeValue = v; });
      return;
    }
    if (node.nodeType !== 1 || skipEl(node)) return;
    ATTRS.forEach((a) => { if (node.hasAttribute(a)) trackAttr(node, a); });
    node.childNodes.forEach(scan);
  };

  const flush = async () => {
    timer = null;
    if (stopped || lang === "fr" || !bundleReady || !pending.size) return report();
    const l = lang;
    const g = gen;
    const want = [...pending].slice(0, 150);
    want.forEach((t) => pending.delete(t));
    const ctrl = new AbortController();
    ctrls.add(ctrl);
    inflight += 1;
    report();
    try {
      const prepared = await loadBundle(l);
      const map = Object.fromEntries(want.filter((source) => prepared[source]).map((source) => [source, prepared[source]]));
      Object.assign(cacheOf(l), map);
      store.save(l, cacheOf(l));
      if (g !== gen || l !== lang) return; // obsolete answer (language or page changed meanwhile)
      want.filter((source) => !map[source]).forEach((source) => failed.add(source));
      recs.forEach((rec) => { if (map[rec.orig.trim()]) apply(rec); });
      if (Object.keys(map).length) onDyn();
    } catch (e) {
      if (g === gen && l === lang && !ctrl.signal.aborted) want.forEach((t) => failed.add(t));
    } finally {
      ctrls.delete(ctrl);
      if (g === gen) inflight -= 1;
    }
    if (g !== gen || stopped) return;
    if (pending.size) schedule(); else report();
  };
  const schedule = () => { if (!timer && !stopped) timer = setTimeout(flush, 120); report(); };
  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    ctrls.forEach((c) => c.abort());
    ctrls.clear();
    inflight = 0;
  };

  const obs = new MutationObserver((muts) => {
    let removed = false;
    muts.forEach((m) => {
      if (m.type === "childList") { m.addedNodes.forEach(scan); if (m.removedNodes.length) removed = true; } else scan(m.target);
    });
    if (removed) for (const k of recs.keys()) if ((k.nodeType && !k.isConnected) || (k.el && !k.el.isConnected)) recs.delete(k);
    if (pending.size) schedule();
  });

  let wantTimer = null;
  return {
    async setLang(l) {
      lang = l;
      gen += 1;
      const g = gen;
      cancel();
      pending.clear();
      failed.clear();
      if (l !== "fr" && !Object.keys(cacheOf(l)).length) {
        bundleReady = false;
        report();
      }
      if (l !== "fr") {
        const b = await loadBundle(l);
        if (g !== gen || stopped) return; // a newer language was chosen meanwhile
        caches[l] = { ...cacheOf(l), ...b };
      }
      bundleReady = true;
      recs.forEach(apply);
      scan(root);
      onDyn();
      if (pending.size) schedule(); else report();
    },
    /** Text rendered by a component (owner content) without translation yet: queue it, outside React's render. */
    want(core) {
      if (stopped || lang === "fr" || !bundleReady || !worth(core) || failed.has(core) || pending.has(core)) return;
      pending.add(core);
      if (!wantTimer) wantTimer = setTimeout(() => { wantTimer = null; schedule(); }, 0);
    },
    retry() {
      failed.forEach((t) => pending.add(t));
      failed.clear();
      schedule();
    },
    start() { obs.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); scan(root); },
    stop() {
      stopped = true;
      obs.disconnect();
      cancel();
      if (wantTimer) clearTimeout(wantTimer);
      gen += 1;
      lang = "fr";
      recs.forEach(apply);
      recs.clear();
      pending.clear();
    },
  };
}

const STATUS_TXT = {
  en: { loading: "Translating…", error: "Some texts could not be translated.", retry: "Retry" },
  nl: { loading: "Vertalen…", error: "Sommige teksten konden niet worden vertaald.", retry: "Opnieuw" },
  de: { loading: "Übersetzung läuft…", error: "Einige Texte konnten nicht übersetzt werden.", retry: "Erneut versuchen" },
};

function TranslationStatus({ lang, status, onRetry }) {
  const t = STATUS_TXT[lang];
  if (!t || status.state === "idle") return null;
  return (
    <div data-no-translate role="status" aria-live="polite" data-testid={`translation-status-${status.state}`}
      className="pointer-events-none fixed bottom-4 right-4 z-[90] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full bg-[#1B2B24]/95 px-4 py-2 text-xs text-white shadow-lg">
      {status.state === "loading" ? (
        <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />{t.loading}</>
      ) : (
        <>{t.error}<button type="button" onClick={onRetry} className="pointer-events-auto rounded-full bg-white px-3 py-1 font-semibold text-[#1B2B24]" data-testid="translation-retry">{t.retry}</button></>
      )}
    </div>
  );
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);
  const { pathname } = useLocation();
  const admin = pathname.startsWith("/admin");
  const setLang = useCallback((l) => { try { localStorage.setItem("site_lang", l); } catch (e) { /* private */ } setLangState(l); }, []);
  const [tr, setTr] = useState(null);
  const [status, setStatus] = useState({ state: "idle" });
  const [dyn, setDyn] = useState(0);
  const eff = admin ? "fr" : lang;
  currentLang = eff; // formatting helpers must already use the new language during this render

  useEffect(() => {
    if (admin) return undefined;
    const t = createTranslator(document.body, setStatus, () => setDyn((v) => v + 1));
    active = t;
    t.start();
    setTr(t);
    return () => { t.stop(); if (active === t) active = null; setTr(null); setStatus({ state: "idle" }); };
  }, [admin]);
  useEffect(() => {
    document.documentElement.lang = eff;
    if (tr) tr.setLang(eff);
  }, [eff, tr]);

  const value = useMemo(() => ({ lang: eff, setLang }), [eff, setLang]);
  return (
    <LangCtx.Provider value={value}>
      <DynCtx.Provider value={dyn}>
        {children}
        {!admin && <TranslationStatus lang={lang} status={status} onRetry={() => tr?.retry()} />}
      </DynCtx.Provider>
    </LangCtx.Provider>
  );
}

