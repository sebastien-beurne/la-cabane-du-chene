import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { http, errMsg } from "@/lib/api";
import { useSite } from "@/lib/site";
import { inputCls } from "@/components/site/FormBits";
import HeroBackdrop from "@/components/site/HeroBackdrop";

export function HeroPreview({ draft }) {
  const site = useSite();
  const h = draft?.home || {};
  const photo = (h.hero_image && { url: h.hero_image, alt: "" }) || site?.pick("accueil", "jardin") || { url: "/images/jardin.webp", alt: "" };
  return (
    <div className="mb-6 rounded-md bg-white p-4 border border-[#2D4A3E]/10" data-testid="hero-preview">
      <p className="mb-3 text-sm font-semibold text-[#1B2B24]">Aperçu (non publié tant que vous n'enregistrez pas)</p>
      <div className="relative aspect-[9/12] sm:aspect-video overflow-hidden rounded bg-[#1B2B24]">
        <HeroBackdrop photo={photo} home={h} />
        <div className="absolute inset-x-4 bottom-4">
          <p className="font-display text-3xl leading-tight text-[#F8F5F0]">{h.hero_title}</p>
          <p className="mt-2 text-xs text-[#ECE7DE] line-clamp-3">{h.hero_subtitle}</p>
        </div>
      </div>
    </div>
  );
}

const EMPTY = { code: "", type: "percent", value: "", expires: "", max_uses: "", active: true };

export function PromoCodes() {
  const [list, setList] = useState([]);
  const [f, setF] = useState(EMPTY);
  const load = useCallback(() => http.get("/admin/promo-codes").then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);
  const save = async (body) => {
    try {
      await http.post("/admin/promo-codes", { ...body, value: Number(String(body.value).replace(",", ".")), max_uses: body.max_uses ? Number(body.max_uses) : null });
      toast.success("Code enregistré"); setF(EMPTY); load();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (code) => { if (window.confirm(`Supprimer le code ${code} ?`)) { await http.delete(`/admin/promo-codes/${code}`); load(); } };
  return (
    <div className="space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); save(f); }} className="rounded-md bg-white p-5 border border-[#2D4A3E]/10 space-y-3" data-testid="promo-form">
        <h2 className="font-display text-2xl text-[#1B2B24]">Nouveau code promo</h2>
        <input placeholder="CODE (ex. AUTOMNE10)" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className={inputCls} data-testid="promo-code" />
        <div className="grid grid-cols-2 gap-3">
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inputCls} data-testid="promo-type">
            <option value="percent">Pourcentage (%)</option><option value="amount">Montant (€)</option>
          </select>
          <input inputMode="decimal" placeholder="Valeur" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} className={inputCls} data-testid="promo-value" />
          <label className="text-xs font-semibold space-y-1">Expire le (facultatif)<input type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} className={inputCls} /></label>
          <label className="text-xs font-semibold space-y-1">Utilisations max.<input inputMode="numeric" value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value })} className={inputCls} /></label>
        </div>
        <button className="w-full rounded-full bg-[#2D4A3E] py-3 font-semibold text-white" data-testid="promo-submit">Créer le code</button>
      </form>
      {list.map((p) => (
        <div key={p.code} className="flex items-center justify-between gap-3 rounded-md bg-white p-4 border border-[#2D4A3E]/10" data-testid={`promo-${p.code}`}>
          <div>
            <p className="font-semibold text-[#1B2B24]">{p.code} · {p.type === "percent" ? `-${p.value} %` : `-${p.value} €`}</p>
            <p className="text-xs text-[#526058]">{p.uses || 0} utilisation(s){p.max_uses ? ` / ${p.max_uses}` : ""}{p.expires ? ` · expire le ${p.expires}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => save({ ...p, active: !p.active })} className={`rounded-full px-3 py-2 text-xs font-semibold ${p.active ? "bg-[#2D4A3E] text-white" : "bg-gray-200 text-gray-700"}`}>{p.active ? "Actif" : "Inactif"}</button>
            <button onClick={() => del(p.code)} className="grid h-9 w-9 place-items-center rounded-full border border-red-200 text-red-700" aria-label="Supprimer"><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

