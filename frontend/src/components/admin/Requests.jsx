import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Mail, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { http, errMsg } from "@/lib/api";

const STATUS = {
  nouvelle: ["Nouvelle", "bg-[#B35432] text-white"],
  en_cours: ["En discussion", "bg-[#D4A373] text-[#1B2B24]"],
  confirmee: ["Confirmée (bloque les dates)", "bg-[#2D4A3E] text-white"],
  refusee: ["Refusée", "bg-gray-300 text-gray-800"],
  annulee: ["Annulée", "bg-gray-300 text-gray-800"],
};
const d = (s) => { try { return format(parseISO(s), "EEE d MMM yyyy", { locale: fr }); } catch (e) { return s; } };

const DEP = { en_attente: "Acompte demandé", payee: "Acompte payé", remboursee: "Acompte remboursé" };

function DepositBox({ b, onDone }) {
  const dep = b.deposit;
  const [amount, setAmount] = useState(dep?.amount ? String(dep.amount) : "");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  if (dep?.status === "payee" || dep?.status === "remboursee") {
    return <p data-testid={`deposit-status-${b.id}`} className="mt-4 rounded bg-[#2D4A3E]/10 p-3 text-sm font-semibold text-[#2D4A3E]">{DEP[dep.status]} : {dep.amount} €</p>;
  }
  if (b.status !== "confirmee") return null;
  const send = async () => {
    const n = parseFloat(String(amount).replace(",", "."));
    if (!n || n <= 0) return toast.error("Indiquez le montant de l'acompte");
    setBusy(true);
    try {
      const r = await http.post(`/admin/booking-requests/${b.id}/deposit`, { amount: n, origin_url: window.location.origin });
      setLink(r.data?.link || "");
      toast.success(r.data?.email_sent ? "Lien de paiement envoyé au voyageur par e-mail" : "Lien créé (e-mail non envoyé : copiez-le)");
      onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="mt-4 rounded-md border border-[#D4A373]/60 bg-[#FBF9F5] p-4 space-y-3" data-testid={`deposit-box-${b.id}`}>
      <p className="text-sm font-semibold text-[#1B2B24]">{dep?.status === "en_attente" ? `Acompte demandé : ${dep.amount} € — en attente de paiement` : "Demander un acompte en ligne"}</p>
      <div className="flex gap-2">
        <input inputMode="decimal" placeholder="Montant en €" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid={`deposit-amount-${b.id}`} className="w-32 rounded-md border border-[#2D4A3E]/25 bg-white px-3 py-2.5 text-base" />
        <button onClick={send} disabled={busy} data-testid={`deposit-send-${b.id}`} className="flex-1 rounded-full bg-[#B35432] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {dep?.status === "en_attente" ? "Renvoyer le lien" : "Envoyer le lien de paiement"}
        </button>
      </div>
      {(link || dep?.token) && (
        <button type="button" onClick={() => { navigator.clipboard?.writeText(link || `${window.location.origin}/paiement/${dep.token}`); toast.success("Lien copié : collez-le dans un SMS ou WhatsApp"); }}
          className="text-xs text-[#2D4A3E] underline underline-offset-4">Copier le lien de paiement</button>
      )}
    </div>
  );
}

export function Requests() {
  const [list, setList] = useState(null);
  const load = useCallback(() => http.get("/admin/booking-requests").then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    try { await http.patch(`/admin/booking-requests/${id}`, { status }); toast.success("Statut mis à jour"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (id) => {
    if (!window.confirm("Supprimer définitivement cette demande ?")) return;
    await http.delete(`/admin/booking-requests/${id}`); load();
  };
  if (!list) return <p className="text-sm text-[#526058]">Chargement…</p>;
  if (!list.length) return <p data-testid="requests-empty" className="rounded-md bg-white p-6 text-[#526058]">Aucune demande de réservation pour le moment.</p>;
  return (
    <div className="space-y-4" data-testid="requests-list">
      <p className="text-sm text-[#526058]">Passez une demande en « Confirmée » une fois le séjour validé avec le voyageur : les dates deviennent alors indisponibles sur le site.</p>
      {list.map((b) => (
        <article key={b.id} className="rounded-md bg-white p-5 border border-[#2D4A3E]/10" data-testid={`request-${b.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[b.status]?.[1] || ""}`}>{STATUS[b.status]?.[0] || b.status}</span>
            <span className="text-xs text-[#526058]">Reçue le {d(b.created_at?.slice(0, 10))}</span>
          </div>
          <h3 className="mt-3 font-display text-2xl text-[#1B2B24]">{b.name} · {b.guests} voyageur{b.guests > 1 ? "s" : ""}</h3>
          <p className="mt-1 text-[#1B2B24]">Du {d(b.check_in)} au {d(b.check_out)}</p>
          {b.address && <p className="mt-1 text-sm text-[#33423A]" data-testid={`request-address-${b.id}`}>Adresse : {b.address}</p>}
          {b.options?.length > 0 && <p className="mt-1 text-sm text-[#33423A]">Options : {b.options.join(", ")}</p>}
          {b.message && <p className="mt-3 whitespace-pre-line rounded bg-[#FBF9F5] p-3 text-sm text-[#33423A]">{b.message}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`mailto:${b.email}?subject=${encodeURIComponent("Votre séjour à La Cabane du Chêne")}`} className="inline-flex items-center gap-2 rounded-full bg-[#2D4A3E] px-4 py-2.5 text-sm text-white"><Mail size={15} /> Répondre</a>
            {b.phone && <a href={`tel:${b.phone}`} className="inline-flex items-center gap-2 rounded-full border border-[#2D4A3E]/30 px-4 py-2.5 text-sm"><Phone size={15} /> {b.phone}</a>}
            <select value={b.status} onChange={(e) => setStatus(b.id, e.target.value)} data-testid={`request-status-${b.id}`} className="rounded-full border border-[#2D4A3E]/30 bg-white px-3 py-2.5 text-sm">
              {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button onClick={() => del(b.id)} className="grid h-10 w-10 place-items-center rounded-full border border-red-200 text-red-700" aria-label="Supprimer"><Trash2 size={15} /></button>
          </div>
          {b.emails_sent === false && <p className="mt-3 text-xs text-[#944125]">L'e-mail automatique n'a pas pu être envoyé pour cette demande.</p>}
          <DepositBox b={b} onDone={load} />
        </article>
      ))}
    </div>
  );
}

