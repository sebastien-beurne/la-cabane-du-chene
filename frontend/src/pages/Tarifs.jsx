import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ArrowUpRight, Clock, Moon, Tag, ShieldCheck } from "lucide-react";
import { useSite } from "@/lib/site";
import Seo from "@/components/site/Seo";
import { eur } from "@/components/site/QuoteSummary";
import PageHeader from "@/components/site/PageHeader";
import QuoteRequest from "@/components/site/QuoteRequest";
import { lazy, Suspense } from "react";
const BookingForm = lazy(() => import("@/components/site/BookingForm"));
import GreenGoLink from "@/components/site/GreenGo";
import Faq from "@/components/site/Faq";
import { Reveal, Eyebrow } from "@/components/site/Motion";
import { useT } from "@/lib/i18n";

function Row({ icon: I, label, value, testid }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-brand/15 py-4" data-testid={testid}>
      <span className="flex items-center gap-3 text-sm text-muted-ink"><I size={16} strokeWidth={1.6} /> {label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

function PriceCard() {
  const { t, td } = useT();
  const site = useSite();
  const p = site?.content?.pricing || {};
  const seasons = (p.seasons || []).filter((s) => s?.name);
  const fees = (p.fees || []).filter((f) => f?.label);
  const options = (p.options || []).filter((o) => o?.active && o?.label);
  const rates = (p.rates || []).filter((r) => Number(r?.nights) > 0 && r?.price);
  const extra = Number(p.extra_guest_per_night) || 0;
  return (
    <div className="space-y-10" data-no-translate data-testid="price-card">
      <div data-testid="price-main" className="rounded-md bg-brand p-7 md:p-9 text-on-dark">
        <Eyebrow light>{p.base_guests ? t("pc.title", { n: p.base_guests }) : t("pc.titleShort")}</Eyebrow>
        {rates.length > 0 ? (
          <div className="mt-5 divide-y divide-white/15" data-testid="price-rates">
            {rates.map((r) => (
              <div key={r.nights} className="flex items-baseline justify-between py-3">
                <span className="text-[#D9DFDA]">{t("nights", Number(r.nights))}</span>
                <span className="font-display text-3xl md:text-4xl">{r.price} €</span>
              </div>
            ))}
          </div>
        ) : p.price_per_night ? (
          <p className="mt-4 font-display text-5xl md:text-6xl">{p.price_per_night}<span className="ml-2 text-lg text-[#D9DFDA]">{t("pc.perNight")}</span></p>
        ) : (
          <p className="mt-4 font-display text-3xl md:text-4xl leading-tight">{t("pc.onDates")}</p>
        )}
        <div className="mt-4 space-y-1 text-sm text-[#D9DFDA]">
          {extra > 0 && <p data-testid="price-extra">{t("pc.extra", { amount: extra, from: Number(p.base_guests || 2) + 1 })}</p>}
          {p.breakfast_included && <p data-testid="breakfast-included">{td("Petit déjeuner sucré inclus pour les occupants.")}</p>}
          {Number(p.breakfast_price) > 0 && <p data-testid="price-breakfast">{t("pc.breakfast", { price: p.breakfast_price })}</p>}
          {rates.length > 0 && <p>{t("pc.max", { n: Math.max(...rates.map((r) => Number(r.nights))) })}</p>}
        </div>
      </div>
      <div>
        <Row icon={Clock} label={t("pc.checkin")} value={td(p.checkin || "À partir de 16 h")} testid="price-checkin" />
        <Row icon={Clock} label={t("pc.checkout")} value={td(p.checkout || "Précisé à la confirmation")} testid="price-checkout" />
        {p.min_nights && <Row icon={Moon} label={t("pc.min")} value={td(p.min_nights)} testid="price-min-nights" />}
      </div>
      {seasons.length > 0 && (
        <div data-testid="price-seasons">
          <h3 className="text-2xl font-medium text-ink mb-2">{t("pc.season")}</h3>
          {seasons.map((s, i) => <Row key={i} icon={Tag} label={`${td(s.name)}${s.period ? ` · ${td(s.period)}` : ""}`} value={s.price ? td(s.price) : t("q.onRequest")} />)}
        </div>
      )}
      {fees.length > 0 && (
        <div data-testid="price-fees">
          <h3 className="text-2xl font-medium text-ink mb-2">{t("pc.fees")}</h3>
          {fees.map((f, i) => <Row key={i} icon={Tag} label={td(f.label)} value={td(f.amount) || "—"} />)}
        </div>
      )}
      {options.length > 0 && (
        <div data-testid="price-options">
          <h3 className="text-2xl font-medium text-ink mb-2">{t("pc.options")}</h3>
          {options.map((o, i) => (
            <div key={i} className="border-b border-brand/15 py-4">
              <div className="flex justify-between gap-6"><span className="text-ink font-medium">{td(o.label)}</span><span className="text-ink">{o.price ? (Number.isFinite(Number(o.price)) ? eur(o.price) : td(o.price)) : t("q.onRequest")}</span></div>
              {o.note && <p className="mt-1 text-xs text-muted-ink">{td(o.note)}</p>}
            </div>
          ))}
        </div>
      )}
      <div data-testid="price-cancellation" className="rounded-md bg-sand p-6 text-sm leading-relaxed text-body space-y-3">
        <p className="flex items-center gap-2 font-semibold text-ink"><ShieldCheck size={16} /> {t("pc.cancel")}</p>
        <p>{td(p.cancellation || "Les conditions d'annulation vous sont communiquées avec la confirmation de votre séjour.")}</p>
        <p>{td(p.payment_note)}</p>
      </div>
    </div>
  );
}

const pReady = (p) => p?.confirmed && p?.calendar_confirmed && (p?.rates || []).some((r) => Number(r.price) > 0);

export default function Tarifs() {
  const site = useSite();
  const g = site?.content?.general || {};
  const { hash } = useLocation();
  const platforms = [["Airbnb", g.airbnb_url], ["Booking.com", g.booking_url], ["AbracadaRoom", g.abracadaroom_url], ["GreenGo", g.greengo_url]].filter(([, u]) => u);

  useEffect(() => {
    if (hash !== "#reserver" && hash !== "#faq") return undefined;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 600);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <>
      <Seo title="Tarifs et disponibilités — Réservez votre séjour à La Cabane du Chêne"
        description="Consultez les disponibilités et envoyez votre demande de réservation directe pour La Cabane du Chêne, gîte avec bain nordique à Valmunster, en Moselle."
        path="/tarifs-disponibilites" />
      <PageHeader testid="tarifs-header" eyebrow="Tarifs & disponibilités" title="Choisissez vos dates, on s'occupe du reste" photo={site?.pick("terrasse", "jardin")}
        intro="Réservez en direct : une demande simple, une réponse personnelle, et aucune donnée bancaire collectée en ligne." />
      <section className="bg-canvas py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 md:px-10 grid gap-16 lg:grid-cols-12">
          <Reveal className="lg:col-span-5 order-2 lg:order-1"><PriceCard /></Reveal>
          <div id="reserver" className="lg:col-span-7 order-1 lg:order-2 scroll-mt-24">
            <Eyebrow>Demande de réservation</Eyebrow>
            <h2 className="mt-4 mb-3 text-4xl md:text-5xl font-medium leading-[1.05] text-ink">Vos dates à la cabane</h2>
            <p className="mb-8 text-muted-ink leading-relaxed">Vos dates et le tarif sont confirmés personnellement. Votre demande ne vaut pas réservation tant que nous ne l’avons pas validée.</p>
            {(site?.content?.pricing?.rates || []).some(r => Number(r.price)>0) ? <Suspense fallback={<p>Chargement…</p>}><BookingForm enabled={pReady(site?.content?.pricing)} /></Suspense> : <QuoteRequest />}
            <GreenGoLink className="mt-10" testid="tarifs-greengo" />
            {platforms.length > 0 && (
              <div className="mt-12 border-t border-brand/15 pt-8">
                <p className="text-sm text-muted-ink mb-4">Vous préférez passer par une plateforme ?</p>
                <div className="flex flex-wrap gap-3">
                  {platforms.map(([l, u]) => (
                    <a key={l} href={u} target="_blank" rel="noreferrer" data-testid={`platform-${l.toLowerCase()}`} className="inline-flex items-center gap-1 rounded-full border border-brand/25 px-4 py-2 text-sm text-ink hover:bg-sand">
                      {l} <ArrowUpRight size={14} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      <Faq />
    </>
  );
}

