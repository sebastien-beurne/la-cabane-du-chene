import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { inputCls } from "@/components/site/FormBits";
import { img, http, errMsg } from "@/lib/api";

const small = inputCls.replace("py-3", "py-2.5");

function Photopick({ value, onChange, photos }) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {photos.map((p) => (
        <button type="button" key={p.id} onClick={() => onChange(p.url)} title={p.alt}
          className={`relative h-16 w-20 shrink-0 overflow-hidden rounded border-2 ${value === p.url ? "border-[#B35432]" : "border-transparent"}`}>
          <img src={img(p.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
        </button>
      ))}
    </div>
  );
}

function VideoField({ value, onChange, testid }) {
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const up = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 150 * 1024 * 1024) { e.target.value = ""; toast.error("Vidéo trop lourde (150 Mo maximum). Préférez YouTube pour les longues vidéos."); return; }
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true); setPct(0);
    try { const r = await http.post("/admin/videos", fd, { onUploadProgress: (p) => p.total && setPct(Math.round((p.loaded * 100) / p.total)) }); onChange(r.data.url); window.dispatchEvent(new Event("admin-autosave")); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); e.target.value = ""; }
  };
  return (
    <div className="space-y-2">
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={small} placeholder="Lien YouTube (https://youtu.be/…)" data-testid={testid} />
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#2D4A3E]/30 px-4 py-2 text-sm">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {busy ? `Envoi en cours… ${pct} %` : value && value.startsWith("/api/") ? "Vidéo envoyée ✓ — remplacer le fichier" : "ou envoyer un fichier vidéo"}
        <input type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={up} disabled={busy} data-testid={`${testid}-file`} />
      </label>
    </div>
  );
}

function Input({ f, value, onChange, photos, testid }) {
  if (f.type === "video") return <VideoField value={value} onChange={onChange} testid={testid} />;
  if (f.type === "range")
    return (
      <div className="flex items-center gap-3">
        <input type="range" min={f.min ?? 0} max={f.max ?? 100} value={Number(value ?? 0)} onChange={(e) => onChange(e.target.value)} className="flex-1 accent-[#2D4A3E]" data-testid={testid} />
        <span className="w-12 text-right text-sm tabular-nums">{value ?? 0} %</span>
      </div>
    );
  if (f.type === "textarea") return <textarea rows={f.rows || 4} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={small} data-testid={testid} />;
  if (f.type === "bool") return <Switch checked={!!value} onCheckedChange={onChange} data-testid={testid} />;
  if (f.type === "select")
    return (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={small} data-testid={testid}>
        {f.options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    );
  if (f.type === "image") return <Photopick value={value} onChange={onChange} photos={photos} />;
  if (f.type === "strings" || f.type === "list") return <ListField f={f} value={value} onChange={onChange} photos={photos} testid={testid} />;
  return <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={small} placeholder={f.placeholder} data-testid={testid} />;
}

function ListField({ f, value, onChange, photos, testid }) {
  const list = Array.isArray(value) ? value : [];
  const isStr = f.type === "strings";
  const upd = (i, v) => onChange(list.map((x, j) => (j === i ? v : x)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const n = [...list];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  const blank = isStr ? "" : Object.fromEntries(f.item.map((it) => [it.key, it.type === "bool" ? true : it.type === "select" ? (it.options[0]?.value ?? it.options[0]) : ""]));
  return (
    <div className="space-y-3">
      {list.map((row, i) => (
        <div key={i} className="rounded-md border border-[#2D4A3E]/15 bg-[#FBF9F5] p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#526058]">#{i + 1}</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(i, -1)} className="grid h-9 w-9 place-items-center rounded border border-[#2D4A3E]/15" aria-label="Monter"><ChevronUp size={16} /></button>
              <button type="button" onClick={() => move(i, 1)} className="grid h-9 w-9 place-items-center rounded border border-[#2D4A3E]/15" aria-label="Descendre"><ChevronDown size={16} /></button>
              <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded border border-red-200 text-red-700" aria-label="Supprimer" data-testid={`${testid}-remove-${i}`}><Trash2 size={16} /></button>
            </div>
          </div>
          {isStr ? (
            <textarea rows={2} value={row} onChange={(e) => upd(i, e.target.value)} className={small} />
          ) : (
            f.item.map((it) => (
              <label key={it.key} className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#1B2B24]">{it.label}</span>
                <Input f={it} value={row?.[it.key]} onChange={(v) => upd(i, { ...row, [it.key]: v })} photos={photos} testid={`${testid}-${i}-${it.key}`} />
              </label>
            ))
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...list, blank])} data-testid={`${testid}-add`}
        className="inline-flex items-center gap-2 rounded-full border border-dashed border-[#2D4A3E]/40 px-4 py-2 text-sm text-[#2D4A3E]">
        <Plus size={16} /> Ajouter
      </button>
    </div>
  );
}

export default function SchemaEditor({ blocks, draft, setDraft, photos }) {
  const get = (b, k) => (b.base ? draft?.[b.base]?.[k] : draft?.[k]);
  const set = (b, k, v) =>
    setDraft((d) => (b.base ? { ...d, [b.base]: { ...(d[b.base] || {}), [k]: v } } : { ...d, [k]: v }));
  return (
    <div className="space-y-6">
      {blocks.map((b) => (
        <section key={b.title} className="rounded-md bg-white p-4 md:p-6 border border-[#2D4A3E]/10">
          <h2 className="font-display text-2xl text-[#1B2B24]">{b.title}</h2>
          {b.help && <p className="mt-1 text-sm text-[#526058]">{b.help}</p>}
          <div className="mt-5 space-y-5">
            {b.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <span className="block text-sm font-semibold text-[#1B2B24]">{f.label}</span>
                {f.help && <span className="block text-xs text-[#526058]">{f.help}</span>}
                <Input f={f} value={get(b, f.key)} onChange={(v) => set(b, f.key, v)} photos={photos} testid={`field-${b.base || "root"}-${f.key}`} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

