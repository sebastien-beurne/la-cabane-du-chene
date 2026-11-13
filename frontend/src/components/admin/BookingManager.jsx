import {StayPreview} from "./StayMessages";
import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Mail, Phone, Plus, Trash2, Copy, History, Pencil, Send, Wallet } from "lucide-react";
import { toast } from "sonner";
import { http, errMsg } from "@/lib/api";
import { eur } from "@/components/site/QuoteSummary";

const STATUS = { nouvelle: "Nouvelle demande", en_cours: "En discussion", confirmee: "Confirmée (dates bloquées)", refusee: "Refusée", annulee: "Annulée" };
const PAY = {
  en_attente: ["En attente de paiement", "bg-[#B35432] text-white"], partiel: ["Paiement partiel", "bg-[#D4A373] text-[#1B2B24]"],
  acompte_paye: ["Acompte payé · solde restant dû", "bg-[#4A6B5D] text-white"], paye: ["Entièrement payé", "bg-[#2D4A3E] text-white"], annule: ["Annulé", "bg-gray-300 text-gray-800"],
  virement_attendu: ["Virement en attente (non payé)", "bg-[#C28B2C] text-[#1B2B24]"],
};
const SOURCES = { direct: "Site (direct)", airbnb: "Airbnb", booking: "Booking.com", abracadaroom: "AbracadaRoom", greengo: "GreenGo", autre: "Autre" };
const fld = "w-full rounded-md border border-[#2D4A3E]/25 bg-white px-3 py-2.5 text-base";
const btn = "inline-flex items-center gap-2 rounded-full border border-[#2D4A3E]/30 px-4 py-2.5 text-sm";
const d = (s) => { try { return format(parseISO(s), "EEE d MMM yyyy", { locale: fr }); } catch (e) { return s; } };
const dt = (s) => { try { return format(parseISO(s), "d MMM yyyy HH:mm", { locale: fr }); } catch (e) { return s; } };

function L({ label, children }) {
  return <label className="block space-y-1 text-xs font-semibold text-[#1B2B24]">{label}{children}</label>;
}

function Row({ k, v, strong }) {
  return <div className={`flex justify-between gap-3 py-1 ${strong ? "font-semibold text-[#1B2B24]" : "text-[#33423A]"}`}><span>{k}</span><span className="tabular-nums">{v}</span></div>;
}

function EditForm({ b, onSaved }) {
  const [f, setF] = useState({ name: b.name, email: b.email || "", phone: b.phone || "", check_in: b.check_in, check_out: b.check_out, guests: b.guests, tourist_tax_guests:b.tourist_tax_guests ?? b.quote?.tourist_tax_guests ?? b.guests, breakfasts: b.breakfasts || 0, total_override: "", note: "" });
  const save = async () => {
    const body = { ...f, guests: Number(f.guests), tourist_tax_guests:Number(f.tourist_tax_guests), breakfasts: Number(f.breakfasts), total_override: f.total_override === "" ? null : Number(String(f.total_override).replace(",", ".")) };
    if (!body.email) delete body.email;
    try { await http.patch(`/admin/booking-requests/${b.id}`, body); toast.success("Réservation modifiée, montants recalculés"); onSaved(); } catch (e) { toast.error(errMsg(e)); }
  };
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-[#FBF9F5] p-4" data-testid={`edit-form-${b.id}`}>
      <L label="Nom"><input value={f.name} onChange={s("name")} className={fld} /></L>
      <L label="Téléphone"><input value={f.phone} onChange={s("phone")} className={fld} /></L>
      <div className="col-span-2"><L label="E-mail"><input value={f.email} onChange={s("email")} className={fld} /></L></div>
      <L label="Arrivée"><input type="date" value={f.check_in} onChange={s("check_in")} className={fld} /></L>
      <L label="Départ"><input type="date" value={f.check_out} onChange={s("check_out")} className={fld} /></L>
      <L label="Personnes"><input type="number" min={1} value={f.guests} onChange={s("guests")} className={fld} /></L>
      <L label="Personnes assujetties (taxe de séjour)"><input type="number" min={0} max={f.guests} value={f.tourist_tax_guests} onChange={s("tourist_tax_guests")} className={fld} /></L>
      <L label="Petits-déjeuners"><input type="number" min={0} value={f.breakfasts} onChange={s("breakfasts")} className={fld} /></L>
      <div className="col-span-2"><L label="Forcer le montant total (facultatif, €)"><input inputMode="decimal" value={f.total_override} onChange={s("total_override")} className={fld} placeholder={String(b.total || "")} /></L></div>
      <div className="col-span-2"><L label="Motif / note (historique)"><input value={f.note} onChange={s("note")} className={fld} /></L></div>
      <button onClick={save} className="col-span-2 rounded-full bg-[#2D4A3E] py-3 font-semibold text-white" data-testid={`edit-save-${b.id}`}>Enregistrer les modifications</button>
    </div>
  );
}

function PaymentForm({ b, onSaved }) {
  const [f, setF] = useState({ amount: "", method: "virement", kind: "acompte", note: "" });
  const save = async () => {
    const amount = Number(String(f.amount).replace(",", "."));
    if (!amount) return toast.error("Indiquez un montant (négatif pour un remboursement)");
    try { await http.post(`/admin/booking-requests/${b.id}/payments`, { ...f, amount }); toast.success("Paiement enregistré"); onSaved(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-[#FBF9F5] p-4" data-testid={`payment-form-${b.id}`}>
      <L label="Montant (€)"><input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className={fld} data-testid={`manual-amount-${b.id}`} /></L>
      <L label="Moyen"><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className={fld}>{["virement", "espèces", "chèque", "chèque vacances", "carte", "plateforme"].map((m) => <option key={m}>{m}</option>)}</select></L>
      <L label="Type"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={fld}><option value="acompte">Acompte</option><option value="solde">Solde</option><option value="autre">Autre / remboursement</option></select></L>
      <L label="Note"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={fld} /></L>
      <button onClick={save} className="col-span-2 rounded-full bg-[#2D4A3E] py-3 font-semibold text-white" data-testid={`manual-save-${b.id}`}>Enregistrer le paiement</button>
    </div>
  );
}

function BookingCard({ b, reload }) {
  const [panel, setPanel] = useState("");
  const q = b.quote;
  const external = (b.source || "direct") !== "direct";
  const toggle = (p) => setPanel((x) => (x === p ? "" : p));
  const patch = async (body, msg) => { try { const r=await http.patch(`/admin/booking-requests/${b.id}`, body); if(body.status==='refusee'&&r.data.refusal_notification?.status!=='envoye'&&r.data.refusal_notification?.status!=='livre')toast.info('Réservation refusée. Notification client non envoyée : consultez son statut ci-dessous.');else toast.success(msg); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const retryRefusal=async()=>{try{const r=await http.post(`/admin/booking-requests/${b.id}/refusal-email`);toast[r.data.refusal_notification?.status==='envoye'?'success':'info'](r.data.refusal_notification?.status==='envoye'?'Notification prise en charge':'Notification enregistrée ; consultez son statut');reload();}catch(e){toast.error(errMsg(e));}};
  const setStatus = (status) => {
    if(status==='refusee'&&!window.confirm('Refuser cette demande et notifier le client par e-mail ?'))return;
    if (status === "annulee" && !window.confirm(external ? "Annuler ici ne l'annule PAS sur la plateforme : faites-le aussi sur la plateforme concernée. Continuer ?" : "Annuler cette réservation ? Aucun remboursement automatique ne sera fait.")) return;
    patch({ status }, "Statut mis à jour");
  };
  const ask = async (kind) => {
    try {
      const r = await http.post(`/admin/booking-requests/${b.id}/deposit`, { kind, origin_url: window.location.origin });
      navigator.clipboard?.writeText(r.data.link);
      toast.success(`${r.data.email_sent ? "E-mail envoyé" : "Lien créé (e-mail non envoyé)"} · ${eur(r.data.request.amount)} · lien copié`);
      reload();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const recap = async () => { try { const r = await http.post(`/admin/booking-requests/${b.id}/recap`); toast[r.data.ok ? "success" : "error"](r.data.ok ? "Récapitulatif envoyé" : "Échec de l'envoi"); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const del = async () => { if (window.confirm("Supprimer définitivement cette réservation et son historique ?")) { await http.delete(`/admin/booking-requests/${b.id}`); reload(); } };
  const [payLabel, payCls] = PAY[b.payment_status] || ["", ""];
  const confirmTransfer = async () => {
    if (!window.confirm(`Confirmer la réception du virement de ${b.balance_due} € (réf. ${b.transfer_ref || ""}) ?`)) return;
    try { await http.post(`/admin/booking-requests/${b.id}/payments`, { amount: b.balance_due, kind: "solde", method: "virement", note: `Virement reçu ${b.transfer_ref || ""}` }); toast.success("Virement confirmé"); reload(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <article className="rounded-md bg-white p-5 border border-[#2D4A3E]/10" data-testid={`booking-${b.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${external ? "bg-[#EFEAE1] text-[#6B4E3D]" : "bg-[#1B2B24] text-white"}`}>{SOURCES[b.source || "direct"]}</span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${payCls}`} data-testid={`pay-status-${b.id}`}>{payLabel}</span>
        {b.payment_method && <span className="rounded-full border border-[#2D4A3E]/25 px-3 py-1 text-xs" data-testid={`pay-method-${b.id}`}>{b.payment_method === "virement" ? `Virement · réf. ${b.transfer_ref || "—"}${b.transfer_sent ? " · instructions envoyées" : ""}` : "Carte bancaire"}</span>}
        {b.payment_status === "virement_attendu" && b.balance_due > 0 && <button onClick={confirmTransfer} className="rounded-full bg-[#2D4A3E] px-3 py-1 text-xs font-semibold text-white" data-testid={`confirm-transfer-${b.id}`}>Confirmer la réception du virement</button>}
      </div>
      {b.status==='refusee'&&<div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" data-testid={`refusal-notification-${b.id}`}><p>{['envoye','livre'].includes(b.refusal_notification?.status)?'Notification de refus prise en charge pour le client':b.refusal_notification?.error||'Le client n’a pas encore été notifié de ce refus.'}</p>{!['envoye','livre'].includes(b.refusal_notification?.status)&&<button type="button" className="mt-2 underline font-semibold" onClick={retryRefusal} data-testid={`retry-refusal-${b.id}`}>{b.refusal_notification?'Réessayer la notification':'Notifier le client du refus'}</button>}<p className="mt-1 text-xs">Détail dans Messages → Envoyés, filtre « Mails clients ».</p></div>}
      <h3 className="mt-3 font-display text-2xl text-[#1B2B24]">{b.name}</h3>
      <p className="text-[#1B2B24]">{d(b.check_in)} → {d(b.check_out)} · {b.nights} nuit{b.nights > 1 ? "s" : ""} · {b.guests} pers.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {b.email && <a href={`mailto:${b.email}`} className={btn}><Mail size={15} /> {b.email}</a>}
        {b.phone && <a href={`tel:${b.phone}`} className={btn}><Phone size={15} /> {b.phone}</a>}
      </div>
      {b.message && <p className="mt-3 whitespace-pre-line rounded bg-[#FBF9F5] p-3 text-sm text-[#33423A]">{b.message}</p>}
      <div className="mt-4 rounded-md border border-[#2D4A3E]/10 p-3 text-sm" data-testid={`amounts-${b.id}`}>
        {q && <Row k={`Hébergement (${q.nights} n.)`} v={eur(q.base)} />}
        {q?.supplement > 0 && <Row k={`Supplément ${q.extra_guests} pers.`} v={eur(q.supplement)} />}
        {q?.breakfast > 0 && <Row k={`Petits-déjeuners (${q.breakfasts})`} v={eur(q.breakfast)} />}
        {(q?.options || []).map((o) => <Row key={o.label} k={o.label} v={eur(o.amount)} />)}
        {q?.promo > 0 && <Row k={`Code ${q.promo_code}`} v={`- ${eur(q.promo)}`} />}
        {q?.gift > 0 && <Row k={`Carte cadeau ${q.gift_code} (comptée en paiement)`} v={eur(q.gift)} />}
        {q?.tourist_tax > 0 && <Row k={`Taxe de séjour (${q.tourist_tax_guests} pers. × ${q.nights} n.)`} v={eur(q.tourist_tax)} />}
        <Row k="Montant total" v={eur(b.total)} strong />
        {!external && (b.payment_method === "virement"
          ? <Row k="Règlement par virement (100 %)" v={eur(b.balance_due)} />
          : <Row k="Acompte demandé" v={eur(b.deposit_due)} />)}
        {b.commission ? <Row k="Commission plateforme" v={eur(b.commission)} /> : null}
        <Row k="Payé" v={eur(b.paid)} />
        <Row k="Solde restant" v={eur(b.balance_due)} strong />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <select value={b.status} onChange={(e) => setStatus(e.target.value)} data-testid={`status-${b.id}`} className="rounded-full border border-[#2D4A3E]/30 bg-white px-3 py-2.5 text-sm">
          {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button onClick={() => toggle("edit")} className={btn} data-testid={`edit-${b.id}`}><Pencil size={15} /> Modifier</button>
        <button onClick={() => toggle("pay")} className={btn} data-testid={`manual-${b.id}`}><Wallet size={15} /> Paiement reçu</button>
        {!external && b.status === "confirmee" && b.balance_due > 0 && (
          <>
            {b.paid < b.deposit_due && <button onClick={() => ask("acompte")} className="rounded-full bg-[#B35432] px-4 py-2.5 text-sm font-semibold text-white" data-testid={`ask-deposit-${b.id}`}>Demander l'acompte ({eur(Math.max(0, b.deposit_due - b.paid))})</button>}
            <button onClick={() => ask("solde")} className="rounded-full bg-[#2D4A3E] px-4 py-2.5 text-sm font-semibold text-white" data-testid={`ask-balance-${b.id}`}>Demander le solde ({eur(b.balance_due)})</button>
          </>
        )}
        {b.email && <><button type="button" disabled={b.status!=="confirmee"} onClick={()=>toggle("arrival")} className={btn} data-testid={`booking-arrival-${b.id}`}><Send size={15}/> Envoyer les informations d’arrivée</button>
        <button type="button" disabled={b.status!=="confirmee"} onClick={()=>toggle("welcome")} className={btn} data-testid={`booking-welcome-${b.id}`}><Mail size={15}/> Message de bienvenue</button>
        <button onClick={recap} className={btn} data-testid={`recap-${b.id}`}><Send size={15} /> Récapitulatif</button></>}
        <button onClick={() => toggle("hist")} className={btn} data-testid={`history-${b.id}`}><History size={15} /> Historique</button>
        <button onClick={del} className="grid h-10 w-10 place-items-center rounded-full border border-red-200 text-red-700" aria-label="Supprimer"><Trash2 size={15} /></button>
      </div>
      {["arrival","welcome"].includes(panel)&&<StayPreview key={panel} booking={b} kind={panel} onSent={reload}/>}
      {panel === "edit" && <EditForm b={b} onSaved={() => { setPanel(""); reload(); }} />}
      {panel === "pay" && <PaymentForm b={b} onSaved={() => { setPanel(""); reload(); }} />}
      {panel === "hist" && (
        <div className="mt-4 space-y-3 rounded-md bg-[#FBF9F5] p-4 text-sm" data-testid={`history-panel-${b.id}`}>
          {(b.payment_requests || []).map((r) => (
            <div key={r.token} className="flex items-center justify-between gap-2">
              <span>Lien {r.kind} · {eur(r.amount)} · {r.status === "payee" ? "payé" : "en attente"}</span>
              {r.status !== "payee" && <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/paiement/${r.token}`); toast.success("Lien copié"); }} className="text-[#2D4A3E]" aria-label="Copier"><Copy size={15} /></button>}
            </div>
          ))}
          {(b.payments || []).map((p) => <p key={p.id}>Paiement · {dt(p.at)} · {eur(p.amount)} · {p.method} ({p.kind}){p.note && !p.note.startsWith("cs_") ? ` · ${p.note}` : ""}</p>)}
          {[...(b.history || [])].reverse().map((h, i) => <p key={i} className="text-[#526058]">{dt(h.at)} · <strong className="text-[#1B2B24]">{h.action}</strong>{h.detail ? ` — ${h.detail}` : ""}</p>)}
        </div>
      )}
    </article>
  );
}

function AddBooking({ onSaved }) {
  const [f, setF] = useState({ source: "airbnb", name: "", email: "", phone: "", check_in: "", check_out: "", guests: 2, total: "", commission: "", note: "" });
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const n = (v) => (v === "" ? null : Number(String(v).replace(",", ".")));
    try { await http.post("/admin/bookings", { ...f, guests: Number(f.guests), total: n(f.total), commission: n(f.commission) }); toast.success("Réservation ajoutée, dates bloquées"); onSaved(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="grid grid-cols-2 gap-3 rounded-md bg-white p-5 border border-[#2D4A3E]/10" data-testid="add-booking-form">
      <div className="col-span-2"><L label="Plateforme"><select value={f.source} onChange={s("source")} className={fld}>{Object.entries(SOURCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></L></div>
      <L label="Nom"><input value={f.name} onChange={s("name")} className={fld} data-testid="add-name" /></L>
      <L label="Téléphone"><input value={f.phone} onChange={s("phone")} className={fld} /></L>
      <div className="col-span-2"><L label="E-mail (facultatif)"><input value={f.email} onChange={s("email")} className={fld} /></L></div>
      <L label="Arrivée"><input type="date" value={f.check_in} onChange={s("check_in")} className={fld} data-testid="add-in" /></L>
      <L label="Départ"><input type="date" value={f.check_out} onChange={s("check_out")} className={fld} data-testid="add-out" /></L>
      <L label="Personnes"><input type="number" min={1} value={f.guests} onChange={s("guests")} className={fld} /></L>
      <L label="Montant total (€)"><input inputMode="decimal" value={f.total} onChange={s("total")} className={fld} data-testid="add-total" /></L>
      <L label="Commission plateforme (€)"><input inputMode="decimal" value={f.commission} onChange={s("commission")} className={fld} /></L>
      <L label="Note"><input value={f.note} onChange={s("note")} className={fld} /></L>
      <button onClick={save} className="col-span-2 rounded-full bg-[#2D4A3E] py-3 font-semibold text-white" data-testid="add-save">Ajouter la réservation</button>
    </div>
  );
}

export function BookingManager() {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("avenir");
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => http.get("/admin/booking-requests").then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);
  if (!list) return <p className="text-sm text-[#526058]">Chargement…</p>;
  const today = new Date().toISOString().slice(0, 10);
  const shown = list.filter((b) => (filter === "avenir" ? b.check_out >= today && !["annulee", "refusee"].includes(b.status) : filter === "annulees" ? ["annulee", "refusee"].includes(b.status) : true))
    .sort((a, b) => (filter === "avenir" ? a.check_in.localeCompare(b.check_in) : b.check_in.localeCompare(a.check_in)));
  return (
    <div className="space-y-4" data-testid="booking-manager">
      <div className="flex flex-wrap items-center gap-2">
        {[["avenir", "À venir"], ["toutes", "Toutes"], ["annulees", "Annulées & refusées"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-4 py-2 text-sm ${filter === k ? "bg-[#2D4A3E] text-white" : "bg-white"}`} data-testid={`filter-${k}`}>{l}</button>
        ))}
        <button onClick={() => setAdding((a) => !a)} className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#B35432] px-4 py-2 text-sm font-semibold text-white" data-testid="add-booking"><Plus size={15} /> Ajouter</button>
      </div>
      <p className="text-sm text-[#526058]">Passez une demande en « Confirmée » pour bloquer les dates, puis demandez l'acompte en un clic. Les réservations des plateformes s'ajoutent avec « Ajouter » (les dates iCal sont, elles, bloquées automatiquement).</p>
      {adding && <AddBooking onSaved={() => { setAdding(false); load(); }} />}
      {!shown.length && <p data-testid="requests-empty" className="rounded-md bg-white p-6 text-[#526058]">Aucune réservation dans cette liste.</p>}
      {shown.map((b) => <BookingCard key={b.id} b={b} reload={load} />)}
    </div>
  );
}

