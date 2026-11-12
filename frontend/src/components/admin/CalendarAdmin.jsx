import { useCallback, useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { http, errMsg, API } from "@/lib/api";
import { inputCls } from "@/components/site/FormBits";
import AvailabilityCalendar from "./AvailabilityCalendar";

const SUB = [["vue", "Calendrier des disponibilités"], ["sync", "Synchronisation & blocage"]];

/** Clipboard copy that also works where the Clipboard API is blocked (embedded preview, older phones). */
async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (!ok) { window.prompt("Copiez ce lien :", text); return; }
  }
  toast.success(okMsg);
}

export default function CalendarAdmin({ goTo }) {
  const [sub, setSub] = useState("vue");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SUB.map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} className={`rounded-full px-4 py-2 text-sm ${sub === k ? "bg-[#2D4A3E] text-white" : "bg-white"}`} data-testid={`cal-sub-${k}`}>{l}</button>
        ))}
      </div>
      {sub === "vue" ? <AvailabilityCalendar /> : <SyncPanel goTo={goTo} />}
    </div>
  );
}

function SyncPanel({ goTo }) {
  const [form, setForm] = useState({ start: "", end: "", note: "" });
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState({});
  const load = useCallback(() => {
    http.get("/admin/ical/status").then((r) => setStatus(r.data || {})).catch(() => setStatus({}));
  }, []);
  useEffect(() => { load(); }, [load]);
  const exportUrl = `${API}/calendar.ics`;
  const PLATFORMS = [["airbnb", "Airbnb"], ["booking", "Booking.com"], ["abracadaroom", "AbracadaRoom"], ["greengo", "GreenGo"]];
  const report = status.report || {};

  const add = async (e) => {
    e.preventDefault();
    try { await http.post("/admin/blocks", form); setForm({ start: "", end: "", note: "" }); toast.success("Dates bloquées (visibles dans le calendrier)"); load(); } catch (err) { toast.error(errMsg(err)); }
  };
  const sync = async () => {
    setSyncing(true);
    try {
      const r = await http.post("/admin/ical/sync");
      const rep = r.data?.report || {};
      const bad = Object.entries(rep).filter(([, v]) => !v.ok);
      if (!Object.keys(rep).length) toast.error("Aucun lien iCal renseigné (onglet Réglages)");
      else if (bad.length) toast.error(`Erreur : ${bad.map(([k, v]) => `${k} (${v.error})`).join(", ")}`);
      else toast.success("Synchronisation réussie");
      load();
    } catch (err) { toast.error(errMsg(err)); } finally { setSyncing(false); }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="rounded-md bg-white p-5 border border-[#2D4A3E]/10 space-y-4" data-testid="block-form">
        <h2 className="font-display text-2xl text-[#1B2B24]">Bloquer des dates</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5 text-sm font-semibold">Arrivée<input type="date" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={inputCls} data-testid="block-start" /></label>
          <label className="space-y-1.5 text-sm font-semibold">Départ<input type="date" required value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className={inputCls} data-testid="block-end" /></label>
        </div>
        <input placeholder="Note (ex. réservation par téléphone)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} data-testid="block-note" />
        <button className="w-full rounded-full bg-[#2D4A3E] py-3 font-semibold text-white" data-testid="block-submit">Bloquer ces dates</button>
      </form>

      <div className="rounded-md bg-white p-5 border border-[#2D4A3E]/10 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-[#1B2B24]">Synchronisation des plateformes</h2>
          <button onClick={sync} disabled={syncing} data-testid="ical-sync" className="inline-flex items-center gap-2 rounded-full border border-[#2D4A3E]/30 px-4 py-2 text-sm"><RefreshCw size={15} className={syncing ? "animate-spin" : ""} /> Synchroniser</button>
        </div>
        <p className="text-sm text-[#526058]">Import automatique environ toutes les heures (et à la demande). L'iCal n'est pas instantané : chaque plateforme relit aussi les calendriers à son propre rythme (souvent toutes les 1 à 6 h). Vérifiez toujours avant de confirmer.</p>
        <button onClick={() => goTo?.("reglages")} className="text-sm font-semibold text-[#B35432] underline underline-offset-4" data-testid="ical-edit-links">Modifier les liens iCal (Airbnb, Booking, GreenGo…) →</button>
        <p className="text-sm text-[#526058]">Pour que vos plateformes voient vos réservations, collez dans chacune le lien « à importer dans … » ci-dessous (rubrique Calendrier, puis « Importer / synchroniser un calendrier »). Ces liens n'affichent que « Indisponible », sans données personnelles.</p>
        <div className="divide-y divide-[#2D4A3E]/10" data-testid="ical-status">
          {PLATFORMS.map(([k, l]) => {
            const s = report[k];
            return (
              <div key={k} className="py-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-[#1B2B24]">{l}</span>
                  <span className={s ? (s.ok ? "text-[#2D4A3E]" : "text-[#944125] font-semibold") : "text-[#526058]"} data-testid={`ical-status-${k}`}>
                    {s ? (s.ok ? `OK · ${s.count} période(s) · ${new Date(s.at).toLocaleString("fr-FR")}` : `Erreur : ${s.error}`) : "Lien iCal non renseigné"}
                  </span>
                </div>
                <button onClick={() => copyText(`${exportUrl}?pour=${k}`, `Lien à coller dans ${l} copié`)} className="inline-flex items-center gap-1 text-xs text-[#2D4A3E] underline underline-offset-4" data-testid={`ical-export-${k}`}>
                  <Copy size={12} /> Copier le lien à importer dans {l}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-[#526058]">Lien général (toutes les dates bloquées) :</p>
        <div className="flex gap-2">
          <input readOnly value={exportUrl} className={`${inputCls} text-xs`} data-testid="ical-export-url" />
          <button onClick={() => copyText(exportUrl, "Lien copié")} className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-[#2D4A3E]/25" aria-label="Copier"><Copy size={16} /></button>
        </div>
      </div>
      <PrivateFeed />
    </div>
  );
}

function PrivateFeed() {
  const [token, setToken] = useState("");
  useEffect(() => {
    http.get("/admin/ical/private").then((r) => setToken(r.data?.token || "")).catch(() => setToken(""));
  }, []);
  const url = token ? `${API}/reservations.ics?token=${token}` : "";
  const rotate = async () => {
    if (!window.confirm("Créer un nouveau lien ? L'ancien cessera de fonctionner dans les agendas où il est ajouté.")) return;
    try { const r = await http.post("/admin/ical/private/rotate"); setToken(r.data?.token || ""); toast.success("Nouveau lien créé"); } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <div className="rounded-md bg-white p-5 border border-[#2D4A3E]/10 space-y-3" data-testid="ical-private">
      <h2 className="font-display text-2xl text-[#1B2B24]">Export de mon calendrier des réservations</h2>
      <p className="text-sm text-[#526058]">Lien privé à ajouter dans Google Agenda, Outlook ou le calendrier de votre téléphone (« Ajouter un agenda par URL »). Il contient toutes les réservations (site, Airbnb, Booking…) et vos blocages, avec le nom, le nombre de personnes et les montants pour les réservations directes. Ne le partagez pas et ne le collez pas dans les plateformes.</p>
      <div className="flex gap-2">
        <input readOnly value={url || "Chargement…"} className={`${inputCls} text-xs`} data-testid="ical-private-url" />
        <button onClick={() => copyText(url, "Lien privé copié")} disabled={!url} className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-[#2D4A3E]/25" aria-label="Copier le lien privé" data-testid="ical-private-copy"><Copy size={16} /></button>
      </div>
      <button onClick={rotate} className="text-xs text-[#944125] underline underline-offset-4" data-testid="ical-private-rotate">Créer un nouveau lien (désactive l'ancien)</button>
    </div>
  );
}

