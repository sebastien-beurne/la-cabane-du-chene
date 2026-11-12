import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { http } from "@/lib/api";
import { PLATFORMS, plat } from "./platforms";

const iso = (d) => format(d, "yyyy-MM-dd");
const nice = (s) => { try { return format(parseISO(s), "EEE d MMM yyyy", { locale: fr }); } catch (e) { return s; } };
const WEEK = ["L", "M", "M", "J", "V", "S", "D"];

function useDayMap(ranges) {
  return useMemo(() => {
    const m = {};
    ranges.forEach((r) => {
      for (let d = parseISO(r.start); iso(d) < r.end; d = addDays(d, 1)) (m[iso(d)] = m[iso(d)] || []).push(r);
    });
    return m;
  }, [ranges]);
}

const conflict = (list = []) => new Set(list.filter((r) => r.kind !== "blocage").map((r) => r.platform)).size > 1;
const hatch = (c) => `repeating-linear-gradient(135deg, ${c} 0 4px, ${c}33 4px 9px)`;

function bg(list) {
  const res = list.filter((r) => r.kind !== "blocage");
  if (!res.length) return { background: hatch(plat(list[0].platform).color) };
  const cols = [...new Set(res.map((r) => plat(r.platform).color))];
  if (cols.length === 1) return { background: cols[0] };
  const step = 100 / cols.length;
  return { background: `linear-gradient(135deg, ${cols.map((c, i) => `${c} ${i * step}%, ${c} ${(i + 1) * step}%`).join(", ")})` };
}

export const rangeLabel = (r) => (r.platform === "manuel" ? "Bloqué par vous sur ce site" : `${r.kind === "blocage" ? "Nuits bloquées (sans voyageur)" : "Réservation"} · ${plat(r.platform).label}`);

function Month({ month, map, selected, onPick }) {
  const first = startOfMonth(month);
  const pad = (first.getDay() + 6) % 7;
  const days = Array.from({ length: endOfMonth(month).getDate() }, (_, i) => addDays(first, i));
  const today = iso(new Date());
  return (
    <div data-testid={`cal-month-${format(month, "yyyy-MM")}`}>
      <p className="mb-3 text-center font-display text-xl capitalize text-[#1B2B24]">{format(month, "MMMM yyyy", { locale: fr })}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#526058]">{WEEK.map((w, i) => <span key={i}>{w}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: pad }, (_, i) => <span key={`p${i}`} />)}
        {days.map((d) => {
          const k = iso(d);
          const list = map[k] || [];
          const busy = list.length > 0;
          const onlyBlocked = busy && list.every((r) => r.kind === "blocage");
          const clash = conflict(list);
          return (
            <button type="button" key={k} onClick={() => onPick(k)} data-testid={`cal-day-${k}`} data-kind={busy ? (onlyBlocked ? "blocage" : "reservation") : "libre"}
              aria-label={`${nice(k)}${busy ? ` : ${list.map(rangeLabel).join(", ")}` : " : libre"}`}
              title={busy ? list.map((r) => `${rangeLabel(r)}${r.booking && r.note ? ` — ${r.note}` : ""}`).join("\n") : undefined}
              style={busy ? bg(list) : undefined}
              className={`relative grid aspect-square place-items-center rounded-md text-sm tabular-nums transition-transform hover:scale-105 ${busy ? (onlyBlocked ? "font-semibold text-[#1B2B24]" : "font-semibold text-white") : "bg-[#F4F1EA] text-[#1B2B24]"} ${selected === k ? "ring-2 ring-offset-1 ring-[#1B2B24]" : ""} ${k === today ? "outline outline-2 outline-[#B35432]" : ""} ${k < today ? "opacity-60" : ""}`}>
              <span className={onlyBlocked ? "rounded bg-white/85 px-1" : ""}>{d.getDate()}</span>
              {clash && <AlertTriangle size={11} className="absolute right-0.5 top-0.5 text-yellow-300" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RangeRow({ r, onDelete }) {
  const p = plat(r.platform);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[#2D4A3E]/10 bg-white p-3" data-testid={`range-${r.id}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: r.kind === "blocage" ? hatch(p.color) : p.color }} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1B2B24]">{nice(r.start)} → {nice(r.end)}</p>
          <p className="truncate text-xs text-[#526058]" data-testid={`range-label-${r.id}`}>{rangeLabel(r)}{r.note && (r.booking || r.platform === "manuel") ? ` · ${r.note}` : ""}</p>
        </div>
      </div>
      {r.platform === "manuel" && <button onClick={() => onDelete(r.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-red-200 text-red-700" aria-label="Débloquer" data-testid={`range-delete-${r.id}`}><Trash2 size={14} /></button>}
    </div>
  );
}

export default function AvailabilityCalendar() {
  const [ranges, setRanges] = useState([]);
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState("");
  const load = useCallback(() => {
    http.get("/admin/blocks", { params: { since: iso(subMonths(new Date(), 12)) } })
      .then((r) => setRanges(Array.isArray(r.data) ? r.data : [])).catch(() => setRanges([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  const map = useDayMap(ranges);
  const del = async (id) => { if (window.confirm("Débloquer cette période ?")) { await http.delete(`/admin/blocks/${id}`); load(); } };
  const m2 = addMonths(month, 1);
  const lo = iso(month), hi = iso(addMonths(month, 2));
  const visible = ranges.filter((r) => r.start < hi && r.end > lo);
  const dayList = selected ? map[selected] || [] : null;
  const clashes = Object.entries(map).filter(([k, l]) => k >= iso(new Date()) && conflict(l)).length;

  return (
    <div className="space-y-5" data-testid="availability-calendar-admin">
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md bg-white p-4 text-xs text-[#33423A]" data-testid="cal-legend">
        {Object.entries(PLATFORMS).map(([k, p]) => <span key={k} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: k === "manuel" ? hatch(p.color) : p.color }} />{p.label}</span>)}
        <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#F4F1EA] border border-[#2D4A3E]/20" />Libre</span>
        <span className="flex w-full flex-wrap gap-x-4 gap-y-2 border-t border-[#2D4A3E]/10 pt-2">
          <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm bg-[#4A6B5D]" />Couleur pleine = vraie réservation</span>
          <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-sm" style={{ background: hatch("#4A6B5D") }} />Hachuré = nuits bloquées sans voyageur</span>
        </span>
        <span className="w-full text-[#526058]">Booking.com ne précise pas la différence : ses périodes s'affichent toujours comme réservations.</span>
      </div>
      {clashes > 0 && (
        <p className="flex items-start gap-2 rounded-md bg-[#B35432]/10 p-3 text-sm text-[#944125]" data-testid="cal-conflicts">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {clashes} nuit(s) à venir réservée(s) sur plusieurs plateformes à la fois (case avec ⚠). Vérifiez qu'il ne s'agit pas d'une double réservation.
        </p>
      )}
      <div className="rounded-md bg-white p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <button onClick={() => setMonth(subMonths(month, 1))} className="grid h-10 w-10 place-items-center rounded-full border border-[#2D4A3E]/25" aria-label="Mois précédent" data-testid="cal-prev"><ChevronLeft size={18} /></button>
          <button onClick={() => setMonth(startOfMonth(new Date()))} className="rounded-full border border-[#2D4A3E]/25 px-4 py-2 text-sm" data-testid="cal-today">Aujourd'hui</button>
          <button onClick={() => setMonth(addMonths(month, 1))} className="grid h-10 w-10 place-items-center rounded-full border border-[#2D4A3E]/25" aria-label="Mois suivant" data-testid="cal-next"><ChevronRight size={18} /></button>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <Month month={month} map={map} selected={selected} onPick={setSelected} />
          <div className="hidden sm:block"><Month month={m2} map={map} selected={selected} onPick={setSelected} /></div>
        </div>
      </div>
      {dayList && (
        <div className="space-y-2" data-testid="cal-day-details">
          <p className="text-sm font-semibold text-[#1B2B24]">Nuit du {nice(selected)} : {dayList.length ? "" : "libre"}</p>
          {dayList.map((r) => <RangeRow key={`d${r.id}`} r={r} onDelete={del} />)}
        </div>
      )}
      <div className="space-y-2" data-testid="cal-period-list">
        <h3 className="font-display text-xl text-[#1B2B24]">Périodes affichées</h3>
        {!visible.length && <p className="rounded-md bg-white p-4 text-sm text-[#526058]">Aucune période indisponible sur ces mois.</p>}
        {visible.map((r) => <RangeRow key={r.id} r={r} onDelete={del} />)}
      </div>
    </div>
  );
}

