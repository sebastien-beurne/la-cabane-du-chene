import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { http, errMsg, img } from "@/lib/api";
import { inputCls } from "@/components/site/FormBits";

const mb = (n) => `${(Number(n || 0) / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;

export default function BookletAdmin() {
  const [b, setB] = useState(null);
  const [busy, setBusy] = useState(false);
  const qr = useRef(null);
  const link = `${window.location.origin}/livret-accueil`;
  const load = () => http.get("/booklet").then((r) => setB(r.data || {})).catch(() => setB({}));
  useEffect(() => { load(); }, []);

  const up = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) return toast.error("PDF trop lourd (40 Mo maximum)");
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try { const r = await http.post("/admin/booklet", fd); setB(r.data); toast.success("Livret publié"); } catch (x) { toast.error(errMsg(x)); } finally { setBusy(false); }
  };
  const del = async () => { if (window.confirm("Retirer le livret du site ?")) { await http.delete("/admin/booklet"); load(); } };
  const downloadQr = () => {
    const c = qr.current?.querySelector("canvas");
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "qr-livret-accueil.png";
    a.click();
  };

  return (
    <div className="space-y-5" data-testid="booklet-admin">
      <section className="space-y-4 rounded-md border border-[#2D4A3E]/10 bg-white p-5">
        <h2 className="font-display text-2xl text-[#1B2B24]">Livret d'accueil (PDF)</h2>
        <p className="text-sm text-[#526058]">Envoyez votre livret au format PDF. Pour le mettre à jour, envoyez simplement la nouvelle version : le lien et le QR code restent les mêmes.</p>
        {b?.url ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[#FBF9F5] p-4" data-testid="booklet-current">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="shrink-0 text-[#B35432]" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#1B2B24]">{b.filename}</p>
                <p className="text-xs text-[#526058]">{mb(b.size)} · mis en ligne le {new Date(b.updated_at).toLocaleDateString("fr-FR")}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a href={img(b.url)} target="_blank" rel="noreferrer" className="grid h-10 w-10 place-items-center rounded-full border border-[#2D4A3E]/25" aria-label="Voir le PDF"><ExternalLink size={15} /></a>
              <button onClick={del} className="grid h-10 w-10 place-items-center rounded-full border border-red-200 text-red-700" aria-label="Retirer le livret" data-testid="booklet-delete"><Trash2 size={15} /></button>
            </div>
          </div>
        ) : b && <p className="rounded-md bg-[#FBF9F5] p-4 text-sm text-[#526058]" data-testid="booklet-none">Aucun livret en ligne pour le moment.</p>}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#2D4A3E] px-5 py-3 text-sm font-semibold text-white" data-testid="booklet-upload-label">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {b?.url ? "Remplacer le PDF" : "Envoyer le PDF"}
          <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={up} disabled={busy} data-testid="booklet-upload-input" />
        </label>
      </section>

      <section className="space-y-4 rounded-md border border-[#2D4A3E]/10 bg-white p-5" data-testid="booklet-share">
        <h2 className="font-display text-2xl text-[#1B2B24]">Lien et QR code</h2>
        <p className="text-sm text-[#526058]">Le lien est aussi dans le pied de page du site. Imprimez le QR code et posez-le dans la cabane : vos voyageurs n'ont qu'à le scanner avec leur téléphone.</p>
        <div className="flex gap-2">
          <input readOnly value={link} className={`${inputCls} text-sm`} data-testid="booklet-link" />
          <button onClick={() => { navigator.clipboard?.writeText(link); toast.success("Lien copié"); }} className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-[#2D4A3E]/25" aria-label="Copier le lien" data-testid="booklet-copy"><Copy size={16} /></button>
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <div ref={qr} className="rounded-md border border-[#2D4A3E]/15 bg-white p-3" data-testid="booklet-qr">
            <QRCodeCanvas value={link} size={600} style={{ width: 180, height: 180 }} level="M" fgColor="#1B2B24" marginSize={2} />
          </div>
          <button onClick={downloadQr} className="inline-flex items-center gap-2 rounded-full border border-[#2D4A3E]/30 px-5 py-3 text-sm font-semibold" data-testid="booklet-qr-download"><Download size={15} /> Télécharger le QR code</button>
        </div>
      </section>
    </div>
  );
}

