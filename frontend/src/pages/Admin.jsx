import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, LogOut, Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { http, errMsg } from "@/lib/api";
import { useSite } from "@/lib/site";
import { Logo } from "@/components/site/Logo";
import { inputCls } from "@/components/site/FormBits";
import SchemaEditor from "@/components/admin/SchemaEditor";
import { PRICING, CONTENT, GUIDE_BLOCKS, SETTINGS, HERO, REVIEWS, VIDEOS } from "@/components/admin/schemas";
import { HeroPreview, PromoCodes } from "@/components/admin/Extras";
import MessagesAdmin from "@/components/admin/MessagesAdmin";
import { BookingManager } from "@/components/admin/BookingManager";
import CalendarAdmin from "@/components/admin/CalendarAdmin";
import PhotosAdmin from "@/components/admin/PhotosAdmin";
import Dashboard from "@/components/admin/Dashboard";
import GiftCardsAdmin from "@/components/admin/GiftCardsAdmin";
import BookletAdmin from "@/components/admin/BookletAdmin";
import AutoEmailsAdmin from "@/components/admin/AutoEmailsAdmin";
import BankAdmin from "@/components/admin/BankAdmin";
import LaunchChecklist from "@/components/admin/LaunchChecklist";

const GROUPS = [
  ["Activité", [["preparation", "Préparation"], ["bord", "Tableau de bord"], ["demandes", "Réservations"], ["calendrier", "Calendrier"], ["messages", "Messages"], ["emails", "E-mails auto"], ["cadeaux", "Cartes cadeaux"]]],
  ["Contenu du site", [["photos", "Photos"], ["videos", "Vidéos"], ["avis", "Avis"], ["visuel", "Fond d'accueil"], ["contenus", "Textes"], ["livret", "Livret d'accueil"], ["guide", "Guide"]]],
  ["Paramètres", [["tarifs", "Tarifs & options"], ["promos", "Codes promo"], ["reglages", "Réglages & liens iCal"]]],
];
const TAB_KEYS = GROUPS.flatMap(([, t]) => t.map(([k]) => k));
const EDIT = { tarifs: PRICING, contenus: CONTENT, guide: GUIDE_BLOCKS, reglages: SETTINGS, visuel: HERO, avis: REVIEWS, videos: VIDEOS };

function Login({ onDone }) {
  const [f, setF] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { const r = await http.post("/auth/login", f); onDone(r.data); } catch (x) { setErr(errMsg(x, "Connexion impossible")); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-[100svh] grid place-items-center bg-[#1B2B24] px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-md bg-[#F8F5F0] p-7 space-y-5" data-testid="admin-login-form">
        <Logo />
        <h1 className="text-3xl font-medium text-[#1B2B24]">Espace propriétaire</h1>
        <input type="email" autoComplete="username" placeholder="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} data-testid="admin-login-email" />
        <input type="password" autoComplete="current-password" placeholder="Mot de passe" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={inputCls} data-testid="admin-login-password" />
        {err && <p className="text-sm text-red-700" data-testid="admin-login-error">{err}</p>}
        <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#2D4A3E] py-3.5 font-semibold text-white" data-testid="admin-login-button">
          {busy && <Loader2 size={16} className="animate-spin" />} Se connecter
        </button>
        <Link to="/" className="block text-center text-sm text-[#526058] underline">Retour au site</Link>
      </form>
    </div>
  );
}

function Password() {
  const [f, setF] = useState({ current_password: "", new_password: "" });
  const submit = async (e) => {
    e.preventDefault();
    try { await http.post("/auth/change-password", f); toast.success("Mot de passe modifié"); setF({ current_password: "", new_password: "" }); } catch (x) { toast.error(errMsg(x, "Le nouveau mot de passe doit faire au moins 10 caractères")); }
  };
  return (
    <form onSubmit={submit} className="rounded-md bg-white p-5 border border-[#2D4A3E]/10 space-y-3 mt-6" data-testid="password-form">
      <h2 className="font-display text-2xl text-[#1B2B24]">Changer mon mot de passe</h2>
      <input type="password" placeholder="Mot de passe actuel" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} className={inputCls} />
      <input type="password" placeholder="Nouveau mot de passe (10 caractères min.)" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} className={inputCls} />
      <button className="w-full rounded-full border border-[#2D4A3E]/30 py-3 text-sm font-semibold">Mettre à jour</button>
    </form>
  );
}

function Editor({ blocks, extra, before }) {
  const site = useSite();
  const [draft, setDraft] = useState(site?.content || {});
  const [saving, setSaving] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => { if (site?.content) setDraft(site.content); }, [site?.content]);
  const save = async (silent) => {
    setSaving(true);
    try { const r = await http.put("/admin/content", draftRef.current); site.setContent(r.data); toast.success(silent === true ? "Vidéo enregistrée et publiée sur le site" : "Modifications enregistrées et publiées"); } catch (x) { toast.error(errMsg(x)); } finally { setSaving(false); }
  };
  useEffect(() => {
    const h = () => { setTimeout(() => save(true), 50); };
    window.addEventListener("admin-autosave", h);
    return () => window.removeEventListener("admin-autosave", h);
  });
  return (
    <div className="pb-24">
      {before && before(draft)}
      <SchemaEditor blocks={blocks} draft={draft} setDraft={setDraft} photos={site?.photos || []} />
      {extra}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-[#F8F5F0]/95 backdrop-blur border-t border-[#2D4A3E]/10 p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <button onClick={save} disabled={saving} data-testid="admin-save" className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2 rounded-full bg-[#B35432] py-3.5 font-semibold text-white disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  const [user, setUser] = useState(null);
  const [tab, setTabState] = useState(() => (TAB_KEYS.includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : "preparation"));
  const setTab = (k) => { setTabState(k); window.history.replaceState(null, "", `#${k}`); window.scrollTo(0, 0); };

  useEffect(() => {
    document.title = "Espace propriétaire — La Cabane du Chêne";
    http.post("/auth/refresh").catch(() => null).finally(() => {
      http.get("/auth/me").then((r) => setUser(r.data)).catch(() => setUser(false));
    });
  }, []);

  if (user === null) return <div className="min-h-[100svh] grid place-items-center"><Loader2 className="animate-spin text-[#2D4A3E]" /></div>;
  if (!user) return <Login onDone={setUser} />;

  const logout = async () => { await http.post("/auth/logout"); setUser(false); };
  return (
    <div className="min-h-[100svh] bg-[#EFEAE1]" data-testid="admin-dashboard">
      <header className="z-30 bg-[#1B2B24] text-white md:sticky md:top-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo light />
          <div className="flex gap-2">
            <Link to="/" target="_blank" className="grid h-10 w-10 place-items-center rounded-full border border-white/20" aria-label="Voir le site"><ExternalLink size={16} /></Link>
            <button onClick={logout} data-testid="admin-logout" className="grid h-10 w-10 place-items-center rounded-full border border-white/20" aria-label="Déconnexion"><LogOut size={16} /></button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl flex-col gap-2 px-3 pb-3 lg:flex-row lg:flex-wrap lg:gap-x-6" data-testid="admin-tabs">
          {GROUPS.map(([g, tabs]) => (
            <div key={g} className="flex flex-wrap items-center gap-1">
              <span className="w-full px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E3B48A] lg:w-auto">{g}</span>
              {tabs.map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} data-testid={`admin-tab-${k}`}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${tab === k ? "bg-[#F8F5F0] text-[#1B2B24] font-semibold" : "text-[#D9DFDA] hover:bg-white/10"}`}>{l}</button>
              ))}
            </div>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {tab === "preparation" && <LaunchChecklist />}
        {tab === "bord" && <Dashboard goTo={setTab} />}
        {tab === "demandes" && <BookingManager />}
        {tab === "cadeaux" && <GiftCardsAdmin />}
        {tab === "livret" && <BookletAdmin />}
        {tab === "emails" && <AutoEmailsAdmin />}
        {tab === "messages" && <MessagesAdmin />}
        {tab === "calendrier" && <CalendarAdmin goTo={setTab} />}
        {tab === "photos" && <PhotosAdmin />}
        {tab === "promos" && <PromoCodes />}
        {EDIT[tab] && <Editor key={tab} blocks={EDIT[tab]} extra={tab === "reglages" ? <><BankAdmin /><Password /></> : null} before={tab === "visuel" ? (d) => <HeroPreview draft={d} /> : null} />}
      </main>
    </div>
  );
}

