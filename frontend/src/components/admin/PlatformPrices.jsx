import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { http, errMsg } from "@/lib/api";
import { useSite } from "@/lib/site";
import { eur } from "@/components/site/QuoteSummary";
import { plat } from "./platforms";

const KEYS = ["direct", "airbnb", "booking", "greengo", "abracadaroom"];
const NIGHTS = [1, 2, 3, 4];
const num = (v) => Number(String(v ?? "").replace(",", ".")) || 0;
const cell = "w-full rounded-md border border-[#2D4A3E]/20 px-2 py-1.5 text-sm tabular-nums";

function useRows(cfg, rates) {
  return useMemo(() => {
    const tax = num(cfg?.tourist_tax);
    return NIGHTS.map((n) => {
      const row = { name: `${n} nuit${n > 1 ? "s" : ""}`, n, detail: {} };
      KEYS.forEach((k) => {
        const p = cfg?.platforms?.[k] || {};
        const gross = k === "direct" ? num(rates[n]) : num(p.prices?.[n]);
        if (!gross) return;
        const ded = Math.min(gross, (gross * num(p.commission)) / 100 + tax * 2 * n);
        row[`${k}_net`] = Math.round((gross - ded) * 100) / 100;
        row[`${k}_ded`] = Math.round(ded * 100) / 100;
        row.detail[k] = { gross, net: row[`${k}_net`] };
      });
      return row;
    });
  }, [cfg, rates]);
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload.detail;
  return (
    <div className="rounded-md border border-[#2D4A3E]/15 bg-white p-3 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-[#1B2B24]">{label} · 2 personnes</p>
      {Object.entries(d).map(([k, v]) => (
        <p key={k} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: plat(k).color }} />{plat(k).label} : brut {eur(v.gross)} → net {eur(v.net)}</p>
      ))}
    </div>
  );
}

function Editor({ cfg, setCfg, rates, onSave, saving }) {
  const setP = (k, patch) => setCfg({ ...cfg, platforms: { ...cfg.platforms, [k]: { ...(cfg.platforms?.[k] || {}), ...patch } } });
  return (
    <div className="mt-4 space-y-3" data-testid="pp-editor">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="text-left text-xs text-[#526058]"><th className="py-1 pr-2">Plateforme</th><th className="pr-2">Commission %</th>{NIGHTS.map((n) => <th key={n} className="pr-2">{n} nuit{n > 1 ? "s" : ""} (€)</th>)}</tr></thead>
          <tbody>
            {KEYS.map((k) => {
              const p = cfg.platforms?.[k] || {};
              return (
                <tr key={k} className="border-t border-[#2D4A3E]/10">
                  <td className="py-2 pr-2"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: plat(k).color }} />{plat(k).label}</span></td>
                  <td className="pr-2"><input inputMode="decimal" value={p.commission ?? ""} onChange={(e) => setP(k, { commission: e.target.value })} className={cell} data-testid={`pp-${k}-commission`} /></td>
                  {NIGHTS.map((n) => (
                    <td key={n} className="pr-2">
                      {k === "direct" ? <span className="block px-2 py-1.5 tabular-nums text-[#526058]">{rates[n] ? eur(rates[n]) : "—"}</span>
                        : <input inputMode="decimal" value={p.prices?.[n] ?? ""} onChange={(e) => setP(k, { prices: { ...(p.prices || {}), [n]: e.target.value } })} className={cell} data-testid={`pp-${k}-${n}`} />}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="flex flex-wrap items-center gap-2 text-sm">Taxe de séjour (€ par personne et par nuit, incluse dans les prix)
        <input inputMode="decimal" value={cfg.tourist_tax ?? ""} onChange={(e) => setCfg({ ...cfg, tourist_tax: e.target.value })} className="w-24 rounded-md border border-[#2D4A3E]/20 px-2 py-1.5" data-testid="pp-tourist-tax" />
      </label>
      <p className="text-xs text-[#526058]">Prix pour 2 personnes, tels que payés par le voyageur. Les prix « Ce site » viennent de l'onglet Tarifs. Laissez une case vide si la durée n'est pas proposée sur la plateforme. Commission : la part prélevée par la plateforme (ou les frais de paiement Stripe pour ce site).</p>
      <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[#2D4A3E] px-5 py-2.5 text-sm font-semibold text-white" data-testid="pp-save">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
      </button>
    </div>
  );
}

export default function PlatformPrices() {
  const site = useSite();
  const rates = useMemo(() => Object.fromEntries((site?.content?.pricing?.rates || []).map((r) => [Number(r.nights), num(r.price)])), [site?.content]);
  const [cfg, setCfg] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { http.get("/admin/platform-prices").then((r) => setCfg(r.data || { platforms: {} })).catch(() => setCfg({ platforms: {} })); }, []);
  const rows = useRows(cfg, rates);
  const shown = KEYS.filter((k) => rows.some((r) => r[`${k}_net`] !== undefined));
  const save = async () => {
    setSaving(true);
    const body = { tourist_tax: num(cfg.tourist_tax), platforms: Object.fromEntries(KEYS.map((k) => [k, { commission: num(cfg.platforms?.[k]?.commission), prices: cfg.platforms?.[k]?.prices || {} }])) };
    try { const r = await http.put("/admin/platform-prices", body); setCfg(r.data); toast.success("Prix par plateforme enregistrés"); } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };
  if (!cfg) return null;
  return (
    <section className="rounded-md bg-white p-4 md:p-5" data-testid="dash-platform-prices">
      <h3 className="font-display text-xl text-[#1B2B24]">Prix par plateforme : brut et net pour vous</h3>
      <p className="mt-1 text-xs text-[#526058]">Couleur pleine = ce qu'il vous reste (net) · partie claire = commission et taxe de séjour. Survolez ou touchez une barre pour le détail.</p>
      <div className="mt-3 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 5, right: 0, left: -10, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke="#2D4A3E" strokeOpacity={0.08} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#526058" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#526058" }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} cursor={{ fill: "#2D4A3E", fillOpacity: 0.05 }} />
            {shown.flatMap((k) => [
              <Bar key={`${k}n`} dataKey={`${k}_net`} stackId={k} fill={plat(k).color} />,
              <Bar key={`${k}d`} dataKey={`${k}_ded`} stackId={k} fill={plat(k).color} fillOpacity={0.3} radius={[4, 4, 0, 0]} />,
            ])}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#33423A]">
        {shown.map((k) => <span key={k} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: plat(k).color }} />{plat(k).label}</span>)}
      </div>
      <div className="mt-4 overflow-x-auto" data-testid="pp-table">
        <table className="w-full min-w-[480px] text-xs">
          <thead><tr className="text-left text-[#526058]"><th className="py-1">Durée</th>{shown.map((k) => <th key={k}>{plat(k).label}</th>)}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.n} className="border-t border-[#2D4A3E]/10">
              <td className="py-1.5 font-semibold text-[#1B2B24]">{r.name}</td>
              {shown.map((k) => <td key={k} className="tabular-nums">{r.detail[k] ? <>{eur(r.detail[k].gross)} <span className="text-[#526058]">→</span> <strong>{eur(r.detail[k].net)}</strong></> : "—"}</td>)}
            </tr>
          ))}</tbody>
        </table>
        <p className="mt-1 text-[11px] text-[#526058]">brut → <strong>net</strong> (2 personnes)</p>
      </div>
      <button onClick={() => setOpen((o) => !o)} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#B35432]" data-testid="pp-toggle">
        Modifier les prix et commissions <ChevronDown size={15} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && <Editor cfg={cfg} setCfg={setCfg} rates={rates} onSave={save} saving={saving} />}
    </section>
  );
}

