import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Bar, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { http } from "@/lib/api";
import { eur } from "@/components/site/QuoteSummary";
import { plat } from "./platforms";
import PlatformPrices from "./PlatformPrices";
import { RealRevenues, RevenueBySource } from "./RealRevenues";

const MONTHS = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const short = (s) => { try { return format(parseISO(s), "d MMM", { locale: fr }); } catch (e) { return s; } };

function Kpi({ label, value, hint, testid, accent }) {
  return (
    <div className={`rounded-md p-4 ${accent ? "bg-[#1B2B24] text-white" : "bg-white text-[#1B2B24]"}`} data-testid={testid}>
      <p className={`text-xs ${accent ? "text-[#D9DFDA]" : "text-[#526058]"}`}>{label}</p>
      <p className="mt-1 font-display text-2xl md:text-3xl tabular-nums">{value}</p>
      {hint && <p className={`mt-1 text-xs ${accent ? "text-[#D9DFDA]" : "text-[#526058]"}`}>{hint}</p>}
    </div>
  );
}

function Card({ title, children, testid }) {
  return (
    <section className="rounded-md bg-white p-4 md:p-5" data-testid={testid}>
      <h3 className="mb-3 font-display text-xl text-[#1B2B24]">{title}</h3>
      {children}
    </section>
  );
}

function StayRow({ b, right }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#2D4A3E]/10 py-2 last:border-0 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: plat(b.source || "direct").color }} />
        <span className="truncate"><strong className="text-[#1B2B24]">{b.name}</strong> · {short(b.check_in)} → {short(b.check_out)}</span>
      </div>
      <span className="shrink-0 tabular-nums text-[#33423A]">{right}</span>
    </div>
  );
}

export default function Dashboard({ goTo }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [d, setD] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    http.get("/admin/dashboard", { params: { year } }).then((r) => setD(r.data)).catch(() => setD({}));
  }, [year, tick]);
  if (!d) return <p className="text-sm text-[#526058]">Chargement…</p>;
  const k = d.kpis || {};
  const months = (Array.isArray(d.months) ? d.months : []).map((m) => ({ ...m, name: MONTHS[m.month - 1] }));
  const sources = Object.entries(d.by_source || {}).sort((a, b) => b[1].nights - a[1].nights);
  const totalNights = sources.reduce((s, [, v]) => s + v.nights, 0) || 1;

  return (
    <div className="space-y-5" data-testid="dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-3xl text-[#1B2B24]">Tableau de bord</h2>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-full border border-[#2D4A3E]/30 bg-white px-4 py-2 text-sm" data-testid="dash-year">
          {(d.years || [year]).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi accent label="Chiffre d'affaires" value={eur(k.revenue)} hint={`${k.bookings || 0} séjour(s) confirmé(s)`} testid="kpi-revenue" />
        <Kpi label="Taux d'occupation" value={`${String(k.occupancy ?? 0).replace(".", ",")} %`} hint={`${k.nights || 0} nuits occupées`} testid="kpi-occupancy" />
        <Kpi label="Encaissé" value={eur(k.collected)} hint="paiements + cartes cadeaux" testid="kpi-collected" />
        <Kpi label="Reste à encaisser" value={eur(k.outstanding)} hint="séjours à venir" testid="kpi-outstanding" />
        <button onClick={() => goTo?.("demandes")} className="text-left" data-testid="kpi-pending-link"><Kpi label="Demandes à traiter" value={k.pending_requests || 0} hint="voir les réservations →" testid="kpi-pending" /></button>
        <Kpi label="Panier moyen" value={eur(k.avg_basket)} hint={`${String(k.avg_nights ?? 0).replace(".", ",")} nuit(s) en moyenne`} testid="kpi-basket" />
        <Kpi label="Cartes cadeaux vendues" value={k.gift_sold || 0} hint={eur(k.gift_sold_amount)} testid="kpi-gifts" />
        <Kpi label="Cartes à utiliser" value={eur(k.gift_outstanding)} hint="solde des cartes actives" testid="kpi-gift-outstanding" />
      </div>

      <Card title="Chiffre d'affaires et occupation par mois" testid="dash-chart">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={months} margin={{ top: 5, right: 0, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#2D4A3E" strokeOpacity={0.08} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#526058" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="e" tick={{ fontSize: 11, fill: "#526058" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="p" orientation="right" domain={[0, 100]} hide />
              <Tooltip formatter={(v, n) => (n === "occupancy" ? [`${v} %`, "Occupation"] : [eur(v), n === "revenue" ? "Chiffre d'affaires" : "Encaissé"])} />
              <Bar yAxisId="e" dataKey="revenue" fill="#B35432" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="e" dataKey="collected" fill="#4A6B5D" radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" dataKey="occupancy" stroke="#1B2B24" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#526058]">
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#B35432]" />Chiffre d'affaires (par mois d'arrivée)</span>
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#4A6B5D]" />Encaissé</span>
          <span className="flex items-center gap-2"><span className="h-0.5 w-4 bg-[#1B2B24]" />Occupation (%)</span>
        </div>
      </Card>

      <PlatformPrices />

      <RevenueBySource year={d.year} sources={sources} />
      <RealRevenues onChange={() => setTick((t) => t + 1)} />

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Nuits par plateforme" testid="dash-sources">
          {!sources.length && <p className="text-sm text-[#526058]">Aucune nuit occupée cette année.</p>}
          <div className="space-y-3">
            {sources.map(([s, v]) => (
              <div key={s} className="text-sm" data-testid={`dash-source-${s}`}>
                <div className="flex justify-between"><span className="text-[#1B2B24]">{plat(s).label}</span><span className="tabular-nums text-[#33423A]" data-testid={`dash-source-nights-${s}`}>{v.nights} nuits{v.net_total ? ` · ${eur(v.net_total)} net` : ""}</span></div>
                {(v.real_nights_declared > 0 || v.real_nights_unknown > 0) && <p className="text-xs text-[#526058]">{v.real_nights_declared} déclarées + {v.nights_calendar + v.real_nights_calendar} issues du calendrier{v.real_nights_unknown ? " (historique du calendrier possiblement incomplet)" : ""}</p>}
                <div className="mt-1 h-2 rounded-full bg-[#F4F1EA]"><div className="h-2 rounded-full" style={{ width: `${(v.nights * 100) / totalNights}%`, background: plat(s).color }} /></div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#526058]">Nuits du calendrier (réservations et iCal). Sur une période avec revenus réels et nuits déclarées, le nombre déclaré remplace celui du calendrier.</p>
        </Card>
        <Card title="Prochaines arrivées" testid="dash-upcoming">
          {!(d.upcoming || []).length && <p className="text-sm text-[#526058]">Aucune arrivée prévue.</p>}
          {(d.upcoming || []).map((b) => <StayRow key={b.id} b={b} right={`${b.guests} pers.`} />)}
        </Card>
      </div>
      <Card title="Paiements à encaisser" testid="dash-to-collect">
        {!(d.to_collect || []).length && <p className="text-sm text-[#526058]">Rien en attente : tout est réglé.</p>}
        {(d.to_collect || []).map((b) => <StayRow key={b.id} b={b} right={`reste ${eur(b.balance_due)}`} />)}
      </Card>
    </div>
  );
}

