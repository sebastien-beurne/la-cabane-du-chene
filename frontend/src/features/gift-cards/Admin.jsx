import { useGiftCards, errMsg } from "./context";
import { useCallback, useEffect, useState } from "react";
import { Copy, Mail, Plus, Trash2 } from "lucide-react";
import { inputCls } from "./ui";

const ST = {
  supprimee: ["Corbeille · inutilisable", "bg-gray-200 text-gray-800"],
  active: ["Active", "bg-[rgb(var(--gift-primary-rgb))] text-white"], utilisee: ["Utilisée", "bg-gray-200 text-gray-800"], expiree: ["Expirée", "bg-[#D4A373] text-[rgb(var(--gift-ink-rgb))]"],
  annulee: ["Annulée", "bg-red-100 text-red-800"], en_attente: ["Paiement non finalisé", "bg-[#EFEAE1] text-[#6B4E3D]"],
  virement_attendu: ["Virement en attente", "bg-[#D4A373]/40 text-[#6B4E3D]"],
};
const EMPTY = { type: "montant", amount: "", nights: 2, recipient_name: "", buyer_name: "", buyer_email: "", message: "", send_email: false };

function NewCard({ onSaved }) {
  const { api: http, notify: toast, offers, baseGuests } = useGiftCards();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ ...EMPTY, nights: offers[0]?.nights || 0 });
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await http.post("/admin/gift-cards", { ...f, amount: f.type === "montant" ? Number(String(f.amount).replace(",", ".")) : null, nights: f.type === "sejour" ? Number(f.nights) : null });
      toast.success(`Carte ${r.data.code} créée`); setF({ ...EMPTY, nights: offers[0]?.nights || 0 }); onSaved();
    } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-3 rounded-md border border-[rgb(var(--gift-primary-rgb))]/10 bg-white p-5" data-testid="gift-admin-form">
      <h3 className="col-span-2 font-display text-xl text-[rgb(var(--gift-ink-rgb))]">Créer une carte (offerte ou vendue sur place)</h3>
      <select value={f.type} onChange={s("type")} className={inputCls} data-testid="gift-admin-type"><option value="montant">Montant</option>{offers.length > 0 && <option value="sejour">Crédit séjour</option>}</select>
      {f.type === "montant"
        ? <input inputMode="decimal" placeholder="Montant (€)" value={f.amount} onChange={s("amount")} className={inputCls} data-testid="gift-admin-amount" />
        : <select value={f.nights} onChange={s("nights")} className={inputCls} data-testid="gift-admin-nights">{offers.map(({ nights: n }) => <option key={n} value={n}>{n} nuit{n > 1 ? "s" : ""} pour {baseGuests}</option>)}</select>}
      <input required placeholder="Bénéficiaire" value={f.recipient_name} onChange={s("recipient_name")} className={inputCls} data-testid="gift-admin-recipient" />
      <input placeholder="De la part de" value={f.buyer_name} onChange={s("buyer_name")} className={inputCls} />
      <input type="email" placeholder="E-mail d'envoi (facultatif)" value={f.buyer_email} onChange={s("buyer_email")} className={`${inputCls} col-span-2`} />
      <textarea rows={2} placeholder="Petit mot (facultatif)" value={f.message} onChange={s("message")} className={`${inputCls} col-span-2`} />
      <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.send_email} onChange={(e) => setF({ ...f, send_email: e.target.checked })} /> Envoyer la carte par e-mail</label>
      <button disabled={busy} className="col-span-2 rounded-full bg-[rgb(var(--gift-primary-rgb))] py-3 font-semibold text-white" data-testid="gift-admin-submit">Créer la carte</button>
    </form>
  );
}

function CardRow({ g, reload }) {
  const { api: http, notify: toast, money: eur, day } = useGiftCards();
  const [bal, setBal] = useState(String(g.balance ?? ""));
  useEffect(() => { setBal(String(g.balance ?? "")); }, [g.balance]);
  const [label, cls] = ST[g.status] || ST.active;
  const patch = async (body, msg) => { try { await http.patch(`/admin/gift-cards/${g.id}`, body); toast.success(msg); reload(); } catch (x) { toast.error(errMsg(x)); } };
  const resend = async () => { try { const r = await http.post(`/admin/gift-cards/${g.id}/resend`); toast[r.data.ok ? "success" : "error"](r.data.ok ? "E-mail renvoyé" : "Échec de l'envoi"); } catch (x) { toast.error(errMsg(x)); } };
  const del = async () => { if (!g.deleted_at && !window.confirm("Déplacer cette carte dans la corbeille ? Elle deviendra inutilisable. Le solde et l’historique seront conservés ; aucun remboursement ne sera effectué.")) return;try { await http.post(`/admin/gift-cards/${g.id}/${g.deleted_at?'restore':'trash'}`); reload(); } catch (x) { toast.error(errMsg(x)); } };
  const received = async () => {
    if (!window.confirm(`Confirmer la réception du virement de ${eur(g.amount)} (réf. ${g.transfer_ref}) ? La carte sera créée et envoyée à l'acheteur.`)) return;
    try { const r = await http.post(`/admin/gift-cards/${g.id}/transfer-received`); toast.success(`Carte ${r.data.code} activée${r.data.email_sent ? " et envoyée" : " (échec de l'e-mail : utilisez Renvoyer)"}`); reload(); } catch (x) { toast.error(errMsg(x)); }
  };
  return (
    <article className="rounded-md border border-[rgb(var(--gift-primary-rgb))]/10 bg-white p-4" data-testid={`gift-row-${g.code || g.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>
        <span className="text-xs text-[#526058]">{g.source === "manuel" ? "Créée par vous" : "Achetée en ligne"}{g.method === "virement" ? ` par virement (réf. ${g.transfer_ref})` : ""} · {day(g.paid_at || g.created_at)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="font-mono text-lg tracking-wider text-[rgb(var(--gift-ink-rgb))]">{g.code || "—"}</p>
        {g.code && <button onClick={() => { navigator.clipboard?.writeText(g.code); toast.success("Code copié"); }} aria-label="Copier le code" className="text-[rgb(var(--gift-primary-rgb))]"><Copy size={15} /></button>}
      </div>
      <p className="text-sm text-[#33423A]">{g.type === "sejour" ? `Séjour ${g.nights} nuit(s) · ` : ""}valeur {eur(g.amount)} · <strong>solde {eur(g.balance)}</strong>{g.expires ? ` · jusqu'au ${day(g.expires)}` : ""}</p>
      <p className="text-xs text-[#526058]">Pour {g.recipient_name}{g.buyer_name ? ` · de ${g.buyer_name}` : ""}{g.buyer_email ? ` (${g.buyer_email})` : ""}</p>
      {(g.uses || []).length > 0 && <p className="mt-1 text-xs text-[#526058]">Utilisée : {g.uses.map((u) => `${eur(u.amount)} le ${day(u.at)}`).join(", ")}</p>}
      {g.refund_received && <p role="status" className="mt-3 text-sm text-red-700">Remboursement Stripe détecté : carte bloquée, régularisation à vérifier.</p>}
      {g.code && !g.refund_received && !g.deleted_at && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value)} className="w-24 rounded-md border border-[rgb(var(--gift-primary-rgb))]/25 px-3 py-2 text-sm" aria-label="Solde" data-testid={`gift-balance-${g.code}`} />
          <button onClick={() => patch({ balance: Number(String(bal).replace(",", ".")) }, "Solde mis à jour")} className="rounded-full border border-[rgb(var(--gift-primary-rgb))]/30 px-3 py-2 text-xs">Corriger le solde</button>
          {g.status !== "annulee" ? <button onClick={() => patch({ status: "annulee" }, "Carte annulée")} className="rounded-full border border-red-200 px-3 py-2 text-xs text-red-700">Annuler</button>
            : <button onClick={() => patch({ status: "active" }, "Carte réactivée")} className="rounded-full border border-[rgb(var(--gift-primary-rgb))]/30 px-3 py-2 text-xs">Réactiver</button>}
          {g.buyer_email && <button onClick={resend} className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--gift-primary-rgb))]/30 px-3 py-2 text-xs"><Mail size={13} /> Renvoyer</button>}
        </div>
      )}
      {!g.deleted_at && g.status === "virement_attendu" && <button onClick={received} className="mt-3 rounded-full bg-[rgb(var(--gift-primary-rgb))] px-4 py-2 text-xs font-semibold text-white" data-testid={`gift-transfer-received-${g.id}`}>Confirmer la réception du virement</button>}
      {<button onClick={del} className="mt-2 inline-flex items-center gap-1 text-xs text-red-700" data-testid={`gift-delete-${g.code || g.id}`}><Trash2 size={13} /> {g.deleted_at?"Restaurer":"Supprimer"}</button>}
    </article>
  );
}

export default function GiftCardsAdmin() {
  const { api: http } = useGiftCards();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [trash,setTrash]=useState(false);
  const load = useCallback(() => http.get("/admin/gift-cards", {params:{trash}}).then((r) => setList(Array.isArray(r.data) ? r.data : [])).then(() => setError("")).catch((x) => setError(errMsg(x))), [http,trash]);
  useEffect(() => { load(); }, [load]);
  if (error) return <p role="alert">{error} <button onClick={load}>Réessayer</button></p>;
  if (!list) return <p className="text-sm text-[#526058]">Chargement…</p>;
  const pending = list.filter((g) => g.status === "en_attente").length;
  const shown = list.filter((g) => trash || showPending || g.status !== "en_attente");
  return (
    <div className="space-y-4" data-testid="gift-admin"><button className="rounded-full border px-4 py-2 text-sm" data-testid="gift-trash-toggle" onClick={()=>{setTrash(!trash);setAdding(false);}}>{trash?"Retour aux cartes cadeaux":"Corbeille des cartes cadeaux"}</button>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-[#526058]">Les clients achètent sur la page « Carte cadeau ». Le code se saisit dans le champ « Code promo ou bon cadeau » à la réservation : le montant est compté comme un paiement (recrédité si la demande est refusée ou annulée).</p>
        <button disabled={trash} onClick={() => setAdding((a) => !a)} className="ml-auto inline-flex items-center gap-1 rounded-full bg-[rgb(var(--gift-accent-rgb))] px-4 py-2 text-sm font-semibold text-white" data-testid="gift-admin-add"><Plus size={15} /> Créer une carte</button>
      </div>
      {adding && !trash && <NewCard onSaved={() => { setAdding(false); load(); }} />}
      {pending > 0 && <button onClick={() => setShowPending((v) => !v)} className="text-xs text-[rgb(var(--gift-primary-rgb))] underline" data-testid="gift-toggle-pending">{showPending ? "Masquer" : "Afficher"} les {pending} paiement(s) non finalisé(s)</button>}
      {!shown.length && <p className="rounded-md bg-white p-5 text-sm text-[#526058]" data-testid="gift-empty">Aucune carte cadeau pour le moment.</p>}
      {shown.map((g) => <CardRow key={g.id} g={g} reload={load} />)}
    </div>
  );
}


