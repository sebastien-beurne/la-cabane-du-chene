import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { http, errMsg, img } from "@/lib/api";
import { useSite } from "@/lib/site";
import { CAT_LABELS } from "@/components/site/Gallery";
import { inputCls } from "@/components/site/FormBits";

const sel = "rounded-md border border-[#2D4A3E]/25 bg-white px-3 py-2.5 text-sm w-full";

export default function PhotosAdmin() {
  const site = useSite();
  const photos = site?.photos || [];
  const [file, setFile] = useState(null);
  const [cat, setCat] = useState("interieur");
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Choisissez une photo");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", cat);
    fd.append("alt", alt);
    setBusy(true);
    try { await http.post("/admin/photos", fd); toast.success("Photo ajoutée"); setFile(null); setAlt(""); e.target.reset(); site.reload(); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  const patch = async (id, body) => { try { await http.patch(`/admin/photos/${id}`, body); site.reload(); } catch (err) { toast.error(errMsg(err)); } };
  const swap = async (i, j) => {
    const a = photos[i], b = photos[j];
    if (!a || !b) return;
    const oa = a.order === b.order ? b.order + 1 : b.order;
    await Promise.all([http.patch(`/admin/photos/${a.id}`, { order: oa }), http.patch(`/admin/photos/${b.id}`, { order: a.order })]);
    site.reload();
  };
  const del = async (id) => { if (window.confirm("Retirer cette photo du site ?")) { await http.delete(`/admin/photos/${id}`); site.reload(); } };

  return (
    <div className="space-y-6">
      <form onSubmit={upload} className="rounded-md bg-white p-5 border border-[#2D4A3E]/10 space-y-4" data-testid="photo-upload-form">
        <h2 className="font-display text-2xl text-[#1B2B24]">Ajouter une photo</h2>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid="photo-file" className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#EFEAE1] file:px-4 file:py-2.5" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className={sel} data-testid="photo-category">
          {Object.entries(CAT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Description courte (ex. Chambre avec lit double)" className={inputCls} data-testid="photo-alt" />
        <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#2D4A3E] py-3 font-semibold text-white disabled:opacity-60" data-testid="photo-upload-submit">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Envoyer
        </button>
        <p className="text-xs text-[#526058]">Les photos sont automatiquement optimisées. La première photo de chaque catégorie est utilisée sur le site (ex. « Photo d'accueil » pour le grand visuel).</p>
      </form>
      <div className="grid gap-4 sm:grid-cols-2" data-testid="photos-admin-list">
        {photos.map((p, i) => (
          <div key={p.id} className="rounded-md bg-white p-3 border border-[#2D4A3E]/10 space-y-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded">
              <img src={img(p.url)} alt={p.alt} loading="lazy" className="h-full w-full object-cover" />
              {p.illustration && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">Illustration</span>}
            </div>
            <select value={p.category} onChange={(e) => patch(p.id, { category: e.target.value })} className={sel}>
              {Object.entries(CAT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input defaultValue={p.alt} onBlur={(e) => e.target.value !== p.alt && patch(p.id, { alt: e.target.value })} className={sel} aria-label="Description" />
            <div className="flex gap-2">
              <button onClick={() => swap(i, i - 1)} className="grid h-10 flex-1 place-items-center rounded border border-[#2D4A3E]/15" aria-label="Avancer"><ArrowUp size={16} /></button>
              <button onClick={() => swap(i, i + 1)} className="grid h-10 flex-1 place-items-center rounded border border-[#2D4A3E]/15" aria-label="Reculer"><ArrowDown size={16} /></button>
              <button onClick={() => del(p.id)} className="grid h-10 flex-1 place-items-center rounded border border-red-200 text-red-700" aria-label="Supprimer" data-testid={`photo-delete-${i}`}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

