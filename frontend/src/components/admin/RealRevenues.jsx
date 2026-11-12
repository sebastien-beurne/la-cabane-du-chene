import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { http, errMsg } from "@/lib/api";
import { eur } from "@/components/site/QuoteSummary";
import { plat } from "./platforms";

const PLATFORMS = [["airbnb", "Airbnb"], ["booking", "Booking.com"], ["greengo", "GreenGo"], ["abracadaroom", "AbracadaRoom"], ["direct", "Réservation directe"]];
const dfr = (s) => (s ? s.split("-").reverse().join("/") : "");
const num = (v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", ".")));
const n0 = (v) => Number(v) || 0;

function Card({ title, children, testid, action }) {
  return (
    <section className="rounded-md bg-white p-4 md:p-5" data-testid={testid}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl text-[#1B2B24]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChartTip({ active, payload, mode }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-md border border-[#2D4A3E]/15 bg-white p-3 text-xs shadow" role="status">
      <p className="mb-1 font-semibold text-[#1B2B24]">{r.name} ({mode})</p>
      <p>Réel : <strong>{eur(r.real)}</strong>{r.incomplete ? " (brut incomplet)" : ""}</p>
      <p>Estimé : <strong>{eur(r.est)}</strong></p>
      <p className="mt-1 border-t border-[#2D4A3E]/10 pt-1">Total : <strong>{eur(r.real + r.est)}</strong></p>
    </div>
  );
}

const nightsText = (v) => {
  const parts = [`${v.nights} nuits`];
  if (v.real_nights_declared) parts.push(`dont ${v.real_nights_declared} déclarées`);
  if (v.nights_calendar || v.real_nights_calendar) parts.push(`${v.nights_calendar + v.real_nights_calendar} issues du calendrier`);
  return parts.join(" · ");
};

/** « Revenus par plateforme » : real (entered + recorded bookings) vs estimated (iCal + price grid), gross or net. */
export function RevenueBySource({ year, sources }) {
  const [mode, setMode] = useState("net");
  const rows = sources.map(([s, v]) => {
    const real = mode === "net" ? n0(v.real_net) + n0(v.revenue_net) : n0(v.real_gross) + n0(v.revenue);
    const est = mode === "net" ? n0(v.estimated_net) : n0(v.estimated);
    return { s, v, name: plat(s).label, real, est, incomplete: mode === "brut" && v.real_gross_missing > 0 };
  }).filter((r) => r.real || r.est || r.v.unpriced || (r.v.coverage || []).length || (r.v.partial || []).length);
  const sum = (k) => rows.reduce((t, r) => t + r[k], 0);
  const grossMissing = rows.some((r) => r.v.real_gross_missing > 0);
  const partial = rows.flatMap((r) => (r.v.partial || []).map((e) => ({ ...e, s: r.s })));
  return (
    <Card title={`Revenus par plateforme en ${year}`} testid="dash-revenue-sources"
      action={(
        <div className="flex rounded-full border border-[#2D4A3E]/20 p-1 text-xs" role="group" aria-label="Montants affichés">
          {[["net", "Net pour vous"], ["brut", "Brut"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k} data-testid={`dash-revenue-mode-${k}`}
              className={`rounded-full px-3 py-1.5 transition-colors ${mode === k ? "bg-[#2D4A3E] text-white" : "text-[#1B2B24]"}`}>{l}</button>
          ))}
        </div>
      )}>
      {!rows.length ? <p className="text-sm text-[#526058]">Aucun séjour enregistré cette année.</p> : (
        <>
          <dl className="mb-3 grid grid-cols-3 gap-2 text-sm" data-testid="dash-revenue-totals">
            <div className="rounded-md bg-[#F4F1EA] p-3"><dt className="text-xs text-[#526058]">Réel</dt><dd className="font-semibold tabular-nums" data-testid="dash-revenue-total-real">{eur(sum("real"))}</dd></div>
            <div className="rounded-md bg-[#F4F1EA] p-3"><dt className="text-xs text-[#526058]">Estimé</dt><dd className="font-semibold tabular-nums" data-testid="dash-revenue-total-est">{eur(sum("est"))}</dd></div>
            <div className="rounded-md bg-[#2D4A3E] p-3 text-white"><dt className="text-xs opacity-80">Total {mode === "net" ? "net" : "brut"}</dt><dd className="font-semibold tabular-nums" data-testid={mode === "net" ? "dash-revenue-total-net" : "dash-revenue-total"}>{eur(sum("real") + sum("est"))}</dd></div>
          </dl>
          {mode === "brut" && grossMissing && <p className="mb-3 rounded-md bg-[#D4A373]/25 p-3 text-xs text-[#6B4E3D]" data-testid="dash-gross-incomplete">Total brut incomplet : au moins une saisie de revenus réels n'a pas de brut renseigné (elle compte pour 0 € en brut, son net est bien pris en compte en mode « Net »).</p>}
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#2D4A3E" strokeOpacity={0.08} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#526058" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#526058" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip mode={mode === "net" ? "net" : "brut"} />} cursor={{ fill: "#2D4A3E", fillOpacity: 0.05 }} />
                <Bar dataKey="real" stackId="a" name="Réel">{rows.map((r) => <Cell key={r.s} fill={plat(r.s).color} />)}</Bar>
                <Bar dataKey="est" stackId="a" name="Estimé" radius={[4, 4, 0, 0]}>{rows.map((r) => <Cell key={r.s} fill={plat(r.s).color} fillOpacity={0.4} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#526058]" data-testid="dash-revenue-legend">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#2D4A3E]" />Teinte foncée : réel (saisi ou réservation enregistrée)</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#2D4A3E]/40" />Teinte claire : estimé (iCal + grille de prix)</span>
            <span>Touchez une barre pour le détail.</span>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {rows.map((r) => (
              <li key={r.s} data-testid={`dash-revenue-${r.s}`}>
                <p className="flex flex-wrap items-center gap-x-2">
                  <span className="h-3 w-3 rounded-sm" style={{ background: plat(r.s).color }} /><strong>{plat(r.s).label}</strong> :
                  <span className="tabular-nums">total {mode} <strong data-testid={`dash-revenue-${mode}-${r.s}`}>{eur(r.real + r.est)}</strong></span>
                </p>
                <p className="text-xs text-[#526058]">
                  {[n0(mode === "net" ? r.v.real_net : r.v.real_gross) || r.v.coverage?.length ? `saisi ${eur(mode === "net" ? r.v.real_net : r.v.real_gross)}${mode === "brut" && r.v.real_gross_missing ? " (brut non renseigné pour une partie)" : ""}` : "",
                    n0(mode === "net" ? r.v.revenue_net : r.v.revenue) ? `réservations enregistrées ${eur(mode === "net" ? r.v.revenue_net : r.v.revenue)} (${r.v.bookings})` : "",
                    r.est ? `estimé ${eur(r.est)} (${r.v.estimated_stays} séjour${r.v.estimated_stays > 1 ? "s" : ""} iCal)` : "",
                    r.v.unpriced ? `${r.v.unpriced} séjour(s) sans prix dans la grille` : ""].filter(Boolean).join(" · ")}
                </p>
                <p className="text-xs text-[#526058]" data-testid={`dash-nights-${r.s}`}>{nightsText(r.v)}</p>
                {(r.v.coverage || []).map((e) => (
                  <p key={e.id} className="text-xs text-[#2D4A3E]" data-testid={`dash-coverage-${e.id}`}>
                    Revenus réels du {dfr(e.start)} au {dfr(e.end)} : {eur(e.net)} net · {e.gross == null ? "Brut non renseigné" : `${eur(e.gross)} brut`} · {e.nights == null ? `${e.calendar_nights} nuits du calendrier (non déclarées, historique possiblement incomplet)` : `${e.nights} nuits déclarées (calendrier : ${e.calendar_nights})`}
                  </p>
                ))}
              </li>
            ))}
          </ul>
          {!!partial.length && (
            <div className="mt-3 rounded-md bg-[#D4A373]/25 p-3 text-xs text-[#6B4E3D]" data-testid="dash-partial-warning">
              {partial.map((e) => <p key={e.id}>{plat(e.s).label} : la saisie du {dfr(e.start)} au {dfr(e.end)} déborde de {year}. Un montant global ne peut pas être réparti par année : il n'est pas compté ici, et les nuits de {year} restent estimées. Pour un total exact, saisissez un montant réel détaillé limité à {year}.</p>)}
            </div>
          )}
          <p className="mt-3 text-xs text-[#526058]">Net = montant pour vous : brut moins commission et taxe de séjour (grille « prix par plateforme ») ; un net saisi est pris tel quel. Les montants sont répartis par nuit (arrivée incluse, départ exclu, au prorata du prix du séjour). Sur une période couverte par des revenus réels, le montant saisi remplace ceux des réservations et estimations de la même plateforme ; rien n'est supprimé dans les réservations ni dans le calendrier.</p>
        </>
      )}
    </Card>
  );
}

const EMPTY = { platform: "airbnb", start: "", end: "", net: "", gross: "", nights: "", note: "" };
const inp = "h-11 w-full rounded-md border border-[#2D4A3E]/20 bg-white px-3 text-sm";

function EntryForm({ initial, onDone, onCancel }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    if (!f.start || !f.end || f.net === "") return toast.error("Renseignez la période et le revenu net reçu.");
    setBusy(true);
    try {
      const body = { platform: f.platform, start: f.start, end: f.end, net: num(f.net), gross: num(f.gross), nights: f.nights === "" ? null : parseInt(f.nights, 10), note: f.note };
      if (f.id) await http.put(`/admin/real-revenues/${f.id}`, body); else await http.post("/admin/real-revenues", body);
      toast.success("Revenus réels enregistrés");
      onDone();
    } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); }
  };
  const field = (label, el) => <label className="block text-xs font-semibold text-[#33423A]">{label}<div className="mt-1 font-normal">{el}</div></label>;
  return (
    <form onSubmit={save} className="space-y-3 rounded-md bg-[#F4F1EA] p-4" data-testid="real-form">
      <div className="flex items-center justify-between"><h4 className="font-semibold text-[#1B2B24]">{f.id ? "Modifier la saisie" : "Ajouter des revenus réels"}</h4>
        <button type="button" onClick={onCancel} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full border border-[#2D4A3E]/20" data-testid="real-form-cancel"><X size={15} /></button></div>
      <p className="text-xs text-[#526058]">La période correspond aux <strong>nuits de séjour</strong> couvertes par le montant (dates incluses), même si les versements sont arrivés à d'autres dates.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {field("Plateforme *", <select value={f.platform} onChange={set("platform")} className={inp} data-testid="real-platform">{PLATFORMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>)}
        {field("Première nuit *", <input type="date" value={f.start} onChange={set("start")} className={inp} data-testid="real-start" />)}
        {field("Dernière nuit (incluse) *", <input type="date" value={f.end} onChange={set("end")} min={f.start || undefined} className={inp} data-testid="real-end" />)}
        {field("Revenu net reçu (€) *", <input inputMode="decimal" value={f.net} onChange={set("net")} className={inp} data-testid="real-net" />)}
        {field("Revenu brut réel (€)", <input inputMode="decimal" value={f.gross} onChange={set("gross")} placeholder="facultatif" className={inp} data-testid="real-gross" />)}
        {field("Nuits réservées", <input inputMode="numeric" value={f.nights} onChange={set("nights")} placeholder="facultatif" className={inp} data-testid="real-nights" />)}
      </div>
      {field("Note", <input value={f.note} onChange={set("note")} maxLength={300} placeholder="facultatif (ex. relevé de versements Airbnb)" className={inp} data-testid="real-note" />)}
      <button disabled={busy} className="rounded-full bg-[#B35432] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" data-testid="real-save">{busy ? "Enregistrement…" : "Enregistrer"}</button>
    </form>
  );
}

/** Table of real revenue entries (add / edit / delete). */
export function RealRevenues({ onChange }) {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => http.get("/admin/real-revenues").then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);
  const done = () => { setEdit(null); load(); onChange(); };
  const del = async (e) => {
    if (!window.confirm(`Supprimer les revenus réels ${plat(e.platform).label} du ${dfr(e.start)} au ${dfr(e.end)} ? Les estimations habituelles seront rétablies.`)) return;
    try { await http.delete(`/admin/real-revenues/${e.id}`); toast.success("Saisie supprimée"); done(); } catch (x) { toast.error(errMsg(x)); }
  };
  return (
    <Card title="Revenus réels saisis" testid="real-revenues"
      action={!edit && <button type="button" onClick={() => setEdit(EMPTY)} className="inline-flex items-center gap-2 rounded-full bg-[#2D4A3E] px-4 py-2 text-sm text-white" data-testid="real-add"><Plus size={15} /> Ajouter des revenus réels</button>}>
      {edit && <EntryForm initial={edit} onDone={done} onCancel={() => setEdit(null)} />}
      {!list ? <p className="text-sm text-[#526058]">Chargement…</p> : !list.length ? (
        <p className="text-sm text-[#526058]" data-testid="real-empty">Aucune saisie. Ajoutez le montant réellement reçu d'une plateforme sur une période pour remplacer les estimations correspondantes.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#2D4A3E]/10" data-testid="real-list">
          {list.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm" data-testid={`real-row-${e.id}`}>
              <div className="min-w-0">
                <p><span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: plat(e.platform).color }} /><strong>{plat(e.platform).label}</strong> · du {dfr(e.start)} au {dfr(e.end)}</p>
                <p className="text-xs text-[#526058]">{eur(e.net)} net · {e.gross == null ? "brut non renseigné" : `${eur(e.gross)} brut`} · {e.nights == null ? "nuits non renseignées" : `${e.nights} nuits`}{e.note ? ` · ${e.note}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEdit({ ...e, net: String(e.net), gross: e.gross == null ? "" : String(e.gross), nights: e.nights == null ? "" : String(e.nights), note: e.note || "" })} aria-label="Modifier" className="grid h-10 w-10 place-items-center rounded-full border border-[#2D4A3E]/25" data-testid={`real-edit-${e.id}`}><Pencil size={15} /></button>
                <button type="button" onClick={() => del(e)} aria-label="Supprimer" className="grid h-10 w-10 place-items-center rounded-full border border-red-200 text-red-700" data-testid={`real-delete-${e.id}`}><Trash2 size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

