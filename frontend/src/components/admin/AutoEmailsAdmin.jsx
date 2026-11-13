import {StayTemplate} from "./StayMessages";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, Play, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { http, errMsg } from "@/lib/api";
import { inputCls } from "@/components/site/FormBits";

const VARS = ["prenom", "nom", "arrivee", "depart", "nuits", "voyageurs", "heure_arrivee", "heure_depart", "lien_livret", "lien_avis"];
const day = (s) => { try { return format(parseISO(s), "EEE d MMM", { locale: fr }); } catch (e) { return s; } };
const LABEL = { reminder: "Rappel avant l'arrivée", after_stay: "Remerciement + avis" };

function TemplateCard({ kind, t, onChange, hasBooklet }) {
  const [busy, setBusy] = useState(false);
  const set = (k, v) => onChange({ ...t, [k]: v });
  const test = async () => {
    setBusy(true);
    try { const r = await http.post("/admin/auto-emails/test", { kind }); toast[r.data.ok ? "success" : "error"](r.data.ok ? `Test envoyé à ${r.data.to}` : "Échec de l'envoi"); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const isRem = kind === "reminder";
  return (
    <section className="space-y-4 rounded-md border border-[#2D4A3E]/10 bg-white p-5" data-testid={`auto-${kind}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-[#1B2B24]">{LABEL[kind]}</h2>
        <label className="flex items-center gap-2 text-sm font-semibold">{t.enabled ? "Activé" : "Désactivé"}
          <Switch checked={!!t.enabled} onCheckedChange={(v) => set("enabled", v)} data-testid={`auto-${kind}-enabled`} />
        </label>
      </div>
      <label className="flex flex-wrap items-center gap-2 text-sm text-[#33423A]">
        Envoyé
        <input type="number" min={isRem ? 1 : 0} max={30} value={isRem ? t.days_before : t.days_after} onChange={(e) => set(isRem ? "days_before" : "days_after", Number(e.target.value))}
          className="w-20 rounded-md border border-[#2D4A3E]/25 px-3 py-2" data-testid={`auto-${kind}-days`} />
        {isRem ? "jour(s) avant l'arrivée, vers 9 h" : "jour(s) après le départ, vers 9 h"}
      </label>
      <label className="block space-y-1 text-sm font-semibold">Objet<input value={t.subject} onChange={(e) => set("subject", e.target.value)} className={inputCls} data-testid={`auto-${kind}-subject`} /></label>
      <label className="block space-y-1 text-sm font-semibold">Message<textarea rows={10} value={t.body} onChange={(e) => set("body", e.target.value)} className={inputCls} data-testid={`auto-${kind}-body`} /></label>
      <div className="flex flex-wrap gap-1.5">
        {VARS.map((v) => <button type="button" key={v} onClick={() => set("body", `${t.body}{${v}}`)} className="rounded-full bg-[#EFEAE1] px-2.5 py-1 text-xs text-[#1B2B24] hover:bg-[#E3DCCF]">{`{${v}}`}</button>)}
      </div>
      <p className="text-xs text-[#526058]">Cliquez sur un mot entre accolades pour l'ajouter : il sera remplacé par les informations du séjour.</p>
      {isRem
        ? <p className="text-xs text-[#526058]">{hasBooklet ? "Un bouton « Ouvrir le livret d'accueil » est ajouté automatiquement en bas de l'e-mail." : "Aucun livret en ligne : envoyez-le dans l'onglet « Livret d'accueil » pour ajouter le bouton automatiquement."}</p>
        : (
          <label className="block space-y-1 text-sm font-semibold">Lien où laisser un avis (Google, Airbnb…)
            <input value={t.review_url || ""} onChange={(e) => set("review_url", e.target.value)} placeholder="https://…" className={inputCls} data-testid="auto-review-url" />
            <span className="block text-xs font-normal text-[#526058]">Un bouton « Laisser un avis » est ajouté automatiquement si le lien est renseigné.</span>
          </label>
        )}
      <button type="button" onClick={test} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-[#2D4A3E]/30 px-4 py-2.5 text-sm" data-testid={`auto-${kind}-test`}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} M'envoyer un test (version enregistrée)
      </button>
    </section>
  );
}

export default function AutoEmailsAdmin() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const load = () => http.get("/admin/auto-emails").then((r) => setCfg(r.data)).catch(() => setCfg(false));
  useEffect(() => { load(); }, []);
  if (cfg === null) return <p className="text-sm text-[#526058]">Chargement…</p>;
  if (!cfg) return <p className="text-sm text-[#944125]">Impossible de charger les réglages.</p>;
  const save = async () => {
    setSaving(true);
    try { const r = await http.put("/admin/auto-emails", { site_url: window.location.origin, reminder: cfg.reminder, after_stay: cfg.after_stay }); setCfg(r.data); toast.success("E-mails automatiques enregistrés"); } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };
  const run = async () => {
    try { const r = await http.post("/admin/auto-emails/run"); toast.success(`Envoyés : ${r.data.report.reminder} rappel(s), ${r.data.report.after_stay} remerciement(s)`); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-5 pb-24" data-testid="auto-emails-admin">
      <StayTemplate kind="arrival"/>
      <StayTemplate kind="welcome"/>
      <p className="text-sm text-[#526058]">Envoyés chaque matin vers 9 h aux réservations <strong>confirmées</strong> qui ont une adresse e-mail (site et plateformes si vous l'avez saisie). Chaque voyageur ne reçoit chaque e-mail qu'une fois ; l'envoi est noté dans l'historique de la réservation.</p>
      <TemplateCard kind="reminder" t={cfg.reminder} hasBooklet={cfg.has_booklet} onChange={(v) => setCfg({ ...cfg, reminder: v })} />
      <TemplateCard kind="after_stay" t={cfg.after_stay} onChange={(v) => setCfg({ ...cfg, after_stay: v })} />
      <section className="space-y-2 rounded-md border border-[#2D4A3E]/10 bg-white p-5" data-testid="auto-planned">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl text-[#1B2B24]">Prochains envois</h2>
          <button onClick={run} className="inline-flex items-center gap-2 rounded-full border border-[#2D4A3E]/30 px-4 py-2 text-sm" data-testid="auto-run-now"><Play size={14} /> Lancer la vérification maintenant</button>
        </div>
        {!(cfg.planned || []).length && <p className="text-sm text-[#526058]">Aucun envoi prévu.</p>}
        {(cfg.planned || []).map((p, i) => (
          <div key={i} className="flex justify-between gap-3 border-b border-[#2D4A3E]/10 py-2 text-sm last:border-0">
            <span><strong className="text-[#1B2B24]">{p.name}</strong> · {LABEL[p.kind]}</span>
            <span className="shrink-0 text-[#33423A]">{p.sent ? "envoyé ✓" : cfg[p.kind]?.enabled ? day(p.date) : "désactivé"}</span>
          </div>
        ))}
        {cfg.last_run?.at && <p className="pt-2 text-xs text-[#526058]">Dernière vérification : {new Date(cfg.last_run.at).toLocaleString("fr-FR")}</p>}
      </section>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#2D4A3E]/10 bg-[#F8F5F0]/95 p-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <button onClick={save} disabled={saving} data-testid="auto-save" className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2 rounded-full bg-[#B35432] py-3.5 font-semibold text-white disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
        </button>
      </div>
    </div>
  );
}

