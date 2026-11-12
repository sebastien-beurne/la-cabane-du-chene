import { useEffect, useState } from "react";
import { toast } from "sonner";
import { http, errMsg } from "@/lib/api";
import { inputCls } from "@/components/site/FormBits";

/** Bank details for bank-transfer bookings (admin only, never exposed on public pages). */
export default function BankAdmin() {
  const [f, setF] = useState({ holder: "", iban: "", bic: "", bank: "" });
  useEffect(() => { http.get("/admin/bank").then((r) => setF((x) => ({ ...x, ...(r.data || {}) }))).catch(() => {}); }, []);
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try { const r = await http.put("/admin/bank", f); setF(r.data); toast.success("Coordonnées bancaires enregistrées"); } catch (x) { toast.error(errMsg(x)); }
  };
  return (
    <form onSubmit={save} className="grid gap-3 rounded-md border border-[#2D4A3E]/10 bg-white p-5 sm:grid-cols-2" data-testid="bank-admin">
      <h3 className="font-display text-xl text-[#1B2B24] sm:col-span-2">Virement bancaire (RIB)</h3>
      <p className="text-xs text-[#526058] sm:col-span-2">Envoyé uniquement aux voyageurs qui choisissent le virement, après votre confirmation des dates. Tant que le titulaire et l'IBAN sont vides, l'option virement n'est pas proposée.</p>
      <input placeholder="Titulaire du compte" value={f.holder} onChange={s("holder")} className={inputCls} data-testid="bank-holder" />
      <input placeholder="Banque" value={f.bank} onChange={s("bank")} className={inputCls} data-testid="bank-name" />
      <input placeholder="IBAN" value={f.iban} onChange={s("iban")} className={inputCls} data-testid="bank-iban" />
      <input placeholder="BIC" value={f.bic} onChange={s("bic")} className={inputCls} data-testid="bank-bic" />
      <button className="rounded-full bg-[#2D4A3E] py-3 font-semibold text-white sm:col-span-2" data-testid="bank-save">Enregistrer le RIB</button>
    </form>
  );
}

