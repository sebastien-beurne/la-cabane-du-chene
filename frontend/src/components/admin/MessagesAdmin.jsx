import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Mail, MailOpen, Phone, RotateCw, Search, Send, Trash2 } from "lucide-react";
import { http, errMsg } from "@/lib/api";

const when = (s) => (s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "—");
const STATUS = {
  non_envoye: ["Non envoyé · envoi désactivé", "bg-amber-100 text-amber-900"],
  en_cours: ["En cours", "bg-[#EFEAE1] text-[#6B4E3D]"],
  envoye: ["Envoyé (pris en charge)", "bg-[#2D4A3E]/10 text-[#2D4A3E]"],
  livre: ["Livré", "bg-green-100 text-green-800"],
  echec: ["Échec", "bg-red-100 text-red-800"],
};
const CATEGORY = {
  stay_arrival: "Informations d’arrivée", stay_welcome: "Message de bienvenue",
  reservation_refusee: "Refus de réservation (client)", reponse: "Réponse à un message", contact_proprietaire: "Notification message (vous)", contact_accuse: "Accusé de réception message",
  demande_reservation_proprietaire: "Nouvelle demande (vous)", demande_reservation_accuse: "Accusé de demande de réservation",
  instructions_virement: "Instructions de virement", recapitulatif: "Récapitulatif de séjour", paiement_recu: "Confirmation de paiement",
  paiement_recu_proprietaire: "Paiement reçu (vous)", demande_acompte: "Demande d'acompte", demande_solde: "Demande de solde",
  carte_cadeau: "Carte cadeau", carte_cadeau_virement: "Carte cadeau : instructions de virement", carte_cadeau_proprietaire: "Carte cadeau (vous)",
  auto_reminder: "Rappel avant l'arrivée", auto_review: "Remerciement + avis", test: "Test",
};

export function AudienceBadge({audience}) {
  const owner=audience==='owner';
  return <span data-testid="mail-audience-badge" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${owner?'bg-amber-100 text-amber-900':'bg-sky-100 text-sky-900'}`}>{owner?'Propriétaire':'Client'}</span>;
}

export function StatusBadge({ s, testid }) {
  const [label, cls] = STATUS[s] || [s, "bg-[#EFEAE1]"];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`} data-testid={testid}>{label}</span>;
}

/** Paginated + searchable list loader shared by both sub-tabs. */
function usePaged(url, extra, initialQ = "") {
  const [q, setQ] = useState(initialQ);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const qRef = useRef(initialQ);
  const revision = useRef(0);
  const load = useCallback((p = page, query = qRef.current) => {
    const ticket=++revision.current;
    setErr("");
    return http.get(url, { params: { page: p, q: query, ...extra } })
      .then((r) => {if(ticket===revision.current)setData({ items: Array.isArray(r.data?.items) ? r.data.items : [], ...r.data });})
      .catch((e) => {if(ticket===revision.current)setErr(errMsg(e));});
  }, [url, page, JSON.stringify(extra)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(page); }, [page, load]);
  useEffect(() => {
    const t = setTimeout(() => { qRef.current = q; setPage(1); load(1, q); }, 300);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  return { q, setQ, page, setPage, data, err, reload: () => load(page) };
}

function Toolbar({ q, setQ, placeholder, testid, children }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#526058]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} data-testid={testid}
          className="h-11 w-full rounded-full border border-[#2D4A3E]/20 bg-white pl-9 pr-4 text-sm outline-none focus:border-[#2D4A3E]" />
      </label>
      {children}
    </div>
  );
}

function Pager({ data, setPage, testid }) {
  if (!data || data.pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 text-sm" data-testid={testid}>
      <button type="button" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)} className="grid h-10 w-10 place-items-center rounded-full border border-[#2D4A3E]/25 disabled:opacity-30" aria-label="Page précédente" data-testid={`${testid}-prev`}><ChevronLeft size={16} /></button>
      <span data-testid={`${testid}-label`}>Page {data.page} / {data.pages} · {data.total} au total</span>
      <button type="button" disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)} className="grid h-10 w-10 place-items-center rounded-full border border-[#2D4A3E]/25 disabled:opacity-30" aria-label="Page suivante" data-testid={`${testid}-next`}><ChevronRight size={16} /></button>
    </div>
  );
}

function Composer({ m, onSent }) {
  const [subject, setSubject] = useState(`Re: ${m.subject || "Votre message"}`);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const token = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const send = async () => {
    if (body.trim().length < 2) return toast.error("Écrivez votre réponse avant d'envoyer.");
    setBusy(true);
    try {
      const r = await http.post(`/admin/messages/${m.id}/reply`, { subject, body, client_token: token.current });
      if (r.data?.ok) { toast.success("Réponse prise en charge par le service d'envoi"); setBody(""); token.current = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
      else if(r.data?.delivery_disabled) toast.info("Réponse enregistrée dans l’historique, sans envoi externe : l’envoi est désactivé.");
      else toast.error(`Échec de l'envoi${r.data?.email?.error ? ` : ${r.data.email.error}` : ""}. Vous pouvez réessayer.`);
      onSent();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="mt-4 space-y-2 rounded-md bg-[#F4F1EA] p-4" data-testid={`reply-composer-${m.id}`}>
      <p className="text-xs text-[#526058]">À : <strong>{m.name}</strong> &lt;{m.email}&gt;</p>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} className="h-11 w-full rounded-md border border-[#2D4A3E]/20 bg-white px-3 text-sm" data-testid="reply-subject" aria-label="Sujet" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={5000} placeholder="Votre réponse…" className="w-full rounded-md border border-[#2D4A3E]/20 bg-white p-3 text-sm" data-testid="reply-body" aria-label="Réponse" />
      <button type="button" onClick={send} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[#B35432] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" data-testid="reply-send">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer la réponse
      </button>
    </div>
  );
}

function Thread({ items }) {
  if (!items.length) return <p className="mt-3 text-xs text-[#526058]">Aucun e-mail enregistré pour ce message.</p>;
  return (
    <ul className="mt-3 space-y-2" data-testid="message-thread">
      {items.map((e) => (
        <li key={e.id} className="rounded-md border border-[#2D4A3E]/10 p-3 text-sm" data-testid={`thread-item-${e.id}`}>
          <div className="flex flex-wrap items-center gap-2"><StatusBadge s={e.status} /><span className="text-xs text-[#526058]">{when(e.created_at)} · {CATEGORY[e.category] || e.category} · à {e.to}</span></div>
          <p className="mt-1 font-semibold text-[#1B2B24]">{e.subject}</p>
          {e.error && <p className="mt-1 text-xs text-red-700">{e.error}</p>}
        </li>
      ))}
    </ul>
  );
}

function MessageCard({ m, onChange }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState(false);
  const loadDetail = () => http.get(`/admin/messages/${m.id}`).then((r) => setDetail(r.data)).catch(() => setDetail({ thread: [] }));
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      loadDetail();
      if (!m.read && !m.deleted_at) { await http.post(`/admin/messages/${m.id}/read`, { read: true }).catch(() => null); onChange(); }
    }
  };
  const markUnread = async () => { await http.post(`/admin/messages/${m.id}/read`, { read: !m.read }); onChange(); };
  const del = async () => { try { if(m.deleted_at)await http.post(`/admin/messages/${m.id}/restore`);else if(window.confirm("Déplacer ce message dans la corbeille ? Il pourra être restauré."))await http.delete(`/admin/messages/${m.id}`);else return;onChange(); }catch(e){toast.error(errMsg(e));} };
  return (
    <article className={`rounded-md border bg-white p-4 md:p-5 ${m.read ? "border-[#2D4A3E]/10" : "border-[#B35432]/40"}`} data-testid={`message-${m.id}`} data-read={m.read ? "true" : "false"}>
      <button type="button" onClick={toggle} className="flex w-full items-start gap-3 text-left" data-testid={`message-toggle-${m.id}`}>
        {m.read ? <MailOpen size={18} className="mt-1 shrink-0 text-[#526058]" /> : <Mail size={18} className="mt-1 shrink-0 text-[#B35432]" />}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className={`text-[#1B2B24] ${m.read ? "" : "font-bold"}`}>{m.name} <span className="font-normal text-[#526058] break-all">&lt;{m.email}&gt;</span></span>
            <span className="text-xs text-[#526058]">{when(m.created_at)}</span>
          </span>
          <span className={`mt-0.5 block text-sm ${m.read ? "text-[#33423A]" : "font-semibold text-[#1B2B24]"}`}>{m.subject || "Sans sujet"}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-[#526058]">
            <span data-testid={`message-status-${m.id}`}>{m.read ? "Lu" : "Non lu"}</span>{m.replies > 0 && <span>· {m.replies} e-mail{m.replies > 1 ? "s" : ""} envoyé{m.replies > 1 ? "s" : ""}</span>}
          </span>
        </span>
        <ChevronDown size={18} className={`mt-1 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 border-t border-[#2D4A3E]/10 pt-3">
          <p className="whitespace-pre-line text-sm text-[#33423A]" data-testid={`message-body-${m.id}`}>{m.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!!m.deleted_at} onClick={() => setReply((v) => !v)} className="inline-flex items-center gap-2 rounded-full bg-[#2D4A3E] px-4 py-2.5 text-sm text-white" data-testid={`message-reply-${m.id}`}><Send size={15} /> Répondre</button>
            {m.phone && <a href={`tel:${m.phone}`} className="inline-flex items-center gap-2 rounded-full border border-[#2D4A3E]/30 px-4 py-2.5 text-sm"><Phone size={15} /> {m.phone}</a>}
            <button type="button" disabled={!!m.deleted_at} onClick={markUnread} className="rounded-full border border-[#2D4A3E]/30 px-4 py-2.5 text-sm" data-testid={`message-mark-${m.id}`}>{m.read ? "Marquer non lu" : "Marquer lu"}</button>
            <button type="button" onClick={del} className="grid h-10 w-10 place-items-center rounded-full border border-red-200 text-red-700" aria-label={m.deleted_at?"Restaurer":"Supprimer"} data-testid={`message-delete-${m.id}`}>{m.deleted_at?<RotateCw size={15}/>:<Trash2 size={15} />}</button>
          </div>
          {reply && <Composer m={m} onSent={() => { loadDetail(); onChange(); }} />}
          <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#526058]">Historique des e-mails liés à ce message</h4>
          {detail ? <Thread items={Array.isArray(detail.thread) ? detail.thread : []} /> : <p className="mt-2 text-xs text-[#526058]">Chargement…</p>}
        </div>
      )}
    </article>
  );
}

function Received({ onUnread, initialQ }) {
  const [status, setStatus] = useState("");
  const [trash,setTrash]=useState(false);
  const p = usePaged("/admin/messages", { status, trash }, initialQ);
  useEffect(() => { if (p.data) onUnread(p.data.unread ?? 0); }, [p.data, onUnread]);
  return (
    <div className="space-y-4" data-testid="messages-received"><button type="button" className="rounded-full border px-4 py-2 text-sm" data-testid="messages-trash-toggle" onClick={()=>{setTrash(!trash);p.setPage(1);}}>{trash?"Retour aux messages reçus":"Corbeille des reçus"}</button>
      <p className="text-xs text-[#526058]">Messages envoyés par les visiteurs via le formulaire de contact du site (ce n'est pas votre boîte Gmail).</p>
      <Toolbar q={p.q} setQ={p.setQ} placeholder="Rechercher un nom, un e-mail, un sujet…" testid="messages-search">
        <select value={status} onChange={(e) => { setStatus(e.target.value); p.setPage(1); }} className="h-11 rounded-full border border-[#2D4A3E]/20 bg-white px-4 text-sm" data-testid="messages-filter">
          <option value="">Tous</option><option value="non_lu">Non lus</option><option value="lu">Lus</option>
        </select>
      </Toolbar>
      {p.err && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{p.err} <button type="button" className="underline" onClick={p.reload}>Réessayer</button></p>}
      {!p.data ? <p className="text-sm text-[#526058]">Chargement…</p> : !p.data.items.length ? (
        <p data-testid="messages-empty" className="rounded-md bg-white p-6 text-[#526058]">{p.q || status ? "Aucun message ne correspond." : "Aucun message pour le moment."}</p>
      ) : (
        <div className="space-y-3" data-testid="messages-list">{p.data.items.map((m) => <MessageCard key={m.id} m={m} onChange={p.reload} />)}</div>
      )}
      <Pager data={p.data} setPage={p.setPage} testid="messages-pager" />
    </div>
  );
}

function SentRow({ e, onRetried, openMessage }) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = () => {
    setOpen(!open);
    if (!open && !html) http.get(`/admin/emails/${e.id}`).then((r) => setHtml(r.data?.html || "")).catch(() => setHtml("<p>Contenu indisponible</p>"));
  };
  const remove = async()=>{try{if(e.deleted_at)await http.post(`/admin/emails/${e.id}/restore`);else if(window.confirm("Déplacer cet e-mail dans la corbeille ? Cela ne le retire pas de la boîte du destinataire."))await http.delete(`/admin/emails/${e.id}`);else return;onRetried();}catch(x){toast.error(errMsg(x));}};
  const retry = async () => {
    setBusy(true);
    try { const r = await http.post(`/admin/emails/${e.id}/retry`); toast[r.data?.ok ? "success" : r.data?.delivery_disabled ? "info" : "error"](r.data?.ok ? "Renvoi pris en charge" : r.data?.delivery_disabled ? "Envoi toujours désactivé : la trace est conservée" : "Nouvel échec de l'envoi"); onRetried(); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <article className={`rounded-md border bg-white p-4 ${e.status === "echec" ? "border-red-300" : "border-[#2D4A3E]/10"}`} data-testid={`sent-${e.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge s={e.status} testid={`sent-status-${e.id}`} /><AudienceBadge audience={e.audience}/>
        <span className="rounded-full border border-[#2D4A3E]/20 px-2.5 py-1 text-xs">{e.kind === "manuel" ? "Manuel" : "Automatique"}</span>
        <span className="text-xs text-[#526058]">{when(e.created_at)}</span>
      </div>
      <p className="mt-2 font-semibold text-[#1B2B24]">{e.subject}</p>
      <p className="text-sm text-[#33423A] break-all">À : {e.to}{e.redirected_to ? ` (test : redirigé vers ${e.redirected_to})` : ""}</p>
      <p className="text-xs text-[#526058]">{CATEGORY[e.category] || e.category || "—"}{e.ref?.label ? ` · ${e.ref.label}` : ""}{e.attempts > 1 ? ` · ${e.attempts} tentatives` : ""}</p>
      {["echec","non_envoye"].includes(e.status) && <p className="mt-1 text-xs text-red-700" data-testid={`sent-error-${e.id}`}>Non envoyé : {e.error || "raison inconnue"}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy||e.status==='en_cours'} onClick={remove} className="rounded-full border border-red-200 px-4 py-2 text-xs disabled:opacity-40" data-testid={`sent-delete-${e.id}`}>{e.deleted_at?"Restaurer":"Supprimer"}</button><button type="button" onClick={toggle} className="rounded-full border border-[#2D4A3E]/30 px-4 py-2 text-xs" data-testid={`sent-view-${e.id}`}>{open ? "Masquer le contenu" : "Voir le contenu enregistré"}</button>
        {e.ref?.type === "message" && <button type="button" onClick={() => openMessage(e)} className="rounded-full border border-[#2D4A3E]/30 px-4 py-2 text-xs" data-testid={`sent-open-message-${e.id}`}>Voir le message reçu</button>}
        {!e.deleted_at&&["echec","non_envoye"].includes(e.status) && <button type="button" onClick={retry} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-[#B35432] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60" data-testid={`sent-retry-${e.id}`}>{busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />} Réessayer</button>}
      </div>
      {open && <iframe title={`Contenu ${e.subject}`} sandbox="" srcDoc={html} className="mt-3 h-96 w-full rounded border border-[#2D4A3E]/10 bg-white" data-testid={`sent-content-${e.id}`} />}
    </article>
  );
}

function Sent({ onFailed, openMessage }) {
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [audience,setAudience]=useState("");
  const [trash,setTrash]=useState(false);
  const p = usePaged("/admin/emails", { status, kind, audience, trash });
  useEffect(() => { if (p.data) onFailed(p.data.failed ?? 0); }, [p.data, onFailed]);
  return (
    <div className="space-y-4" data-testid="messages-sent"><button type="button" className="rounded-full border px-4 py-2 text-sm" data-testid="sent-trash-toggle" onClick={()=>{setTrash(!trash);p.setPage(1);}}>{trash?"Retour aux e-mails envoyés":"Corbeille des envoyés"}</button>
      <p className="text-xs text-[#526058]">« Envoyé » signifie que le service d'envoi a pris l'e-mail en charge, pas qu'il a été livré : ce service ne transmet pas de confirmation de livraison. Les envois désactivés sont conservés comme « Non envoyé ». Le filtre distingue les mails clients (bleu) et propriétaire (ambre).</p>
      <Toolbar q={p.q} setQ={p.setQ} placeholder="Rechercher un destinataire, un sujet, une réservation…" testid="sent-search">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select aria-label="Destinataire des e-mails" data-testid="sent-filter-audience" value={audience} onChange={e=>{setAudience(e.target.value);p.setPage(1);}} className="h-11 min-w-0 rounded-full border border-[#2D4A3E]/20 bg-white px-3 text-sm"><option value="">Clients et propriétaire</option><option value="client">Mails clients</option><option value="owner">Mails propriétaire</option></select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); p.setPage(1); }} className="h-11 flex-1 rounded-full border border-[#2D4A3E]/20 bg-white px-4 text-sm" data-testid="sent-filter-status">
            <option value="">Tous statuts</option><option value="envoye">Envoyés</option><option value="non_envoye">Non envoyés (désactivé)</option><option value="echec">Échecs</option><option value="en_cours">En cours</option>
          </select>
          <select value={kind} onChange={(e) => { setKind(e.target.value); p.setPage(1); }} className="h-11 flex-1 rounded-full border border-[#2D4A3E]/20 bg-white px-4 text-sm" data-testid="sent-filter-kind">
            <option value="">Tous types</option><option value="manuel">Manuels</option><option value="automatique">Automatiques</option>
          </select>
        </div>
      </Toolbar>
      {p.err && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{p.err} <button type="button" className="underline" onClick={p.reload}>Réessayer</button></p>}
      {!p.data ? <p className="text-sm text-[#526058]">Chargement…</p> : !p.data.items.length ? (
        <p data-testid="sent-empty" className="rounded-md bg-white p-6 text-[#526058]">Aucun e-mail enregistré{p.q || status || kind ? " pour cette recherche" : " pour le moment"}.</p>
      ) : (
        <div className="space-y-3" data-testid="sent-list">{p.data.items.map((e) => <SentRow key={e.id} e={e} onRetried={p.reload} openMessage={openMessage} />)}</div>
      )}
      <Pager data={p.data} setPage={p.setPage} testid="sent-pager" />
    </div>
  );
}

export default function MessagesAdmin() {
  const [sub, setSub] = useState("recus");
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(0);
  const [jump, setJump] = useState({ n: 0, q: "" });
  const tab = (k, label, n, testid, suffix = "") => (
    <button type="button" onClick={() => setSub(k)} data-testid={testid}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${sub === k ? "bg-[#2D4A3E] text-white" : "border border-[#2D4A3E]/25 text-[#1B2B24]"}`}>
      {label}{n > 0 && <span className="rounded-full bg-[#B35432] px-2 py-0.5 text-xs font-semibold text-white" data-testid={`${testid}-count`}>{n}{suffix}</span>}
    </button>
  );
  return (
    <div className="space-y-5" data-testid="messages-admin">
      <div className="flex flex-wrap gap-2">
        {tab("recus", "Reçus", unread, "messages-tab-recus", " non lu" + (unread > 1 ? "s" : ""))}
        {tab("envoyes", "Envoyés", failed, "messages-tab-envoyes", " échec" + (failed > 1 ? "s" : ""))}
      </div>
      {sub === "recus" ? <Received key={jump.n} initialQ={jump.q} onUnread={setUnread} />
        : <Sent onFailed={setFailed} openMessage={(e) => { setJump((j) => ({ n: j.n + 1, q: e.to })); setSub("recus"); }} />}
    </div>
  );
}

