import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { img } from "@/lib/api";
import { useT } from "@/lib/i18n";

const FADE_MS = 220;

export default function Lightbox({ photos, index, onClose }) {
  const { t, td } = useT();
  const [i, setI] = useState(index ?? 0);
  const [zoom, setZoom] = useState(false);
  const open = index !== null && index !== undefined;
  // Own mount cycle (no AnimatePresence): on close the layer stops catching clicks at once,
  // then it is unmounted by a timer — it can never stay in the page invisible.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const n = photos.length;

  useEffect(() => {
    if (open) { setI(index); setZoom(false); }
  }, [index, open]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    setZoom(false);
    const t = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(t);
  }, [open]);

  const go = useCallback((d) => { setZoom(false); setI((v) => (v + d + n) % n); }, [n]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    const prevOverflow = document.body.style.overflow;
    window.__lenis?.stop();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow === "hidden" ? "" : prevOverflow;
      window.__lenis?.start();
    };
  }, [open, go]);

  const p = photos[Math.min(i, n - 1)];
  if (!mounted || !p) return null;
  return (
        <div
          data-testid="lightbox"
          data-no-translate
          data-state={open ? "open" : "closing"}
          data-lenis-prevent
          role="dialog"
          aria-modal="true"
          aria-hidden={!open}
          aria-label={t("lb.label")}
          className={`fixed inset-0 z-[100] bg-[#0f1813]/95 backdrop-blur-md flex flex-col transition-opacity duration-200 ${open && shown ? "opacity-100" : "opacity-0"} ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        >
          <div className="flex items-center justify-between px-4 py-3 text-on-dark">
            <span className="text-sm tabular-nums" data-testid="lightbox-counter">{i + 1} / {n}</span>
            <div className="flex gap-2">
              <button data-testid="lightbox-zoom" onClick={() => setZoom((z) => !z)} className="grid h-11 w-11 place-items-center rounded-full border border-white/20" aria-label={zoom ? t("lb.zoomOut") : t("lb.zoomIn")}>
                {zoom ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
              </button>
              <button data-testid="lightbox-close" onClick={() => closeRef.current()} className="grid h-11 w-11 place-items-center rounded-full border border-white/20" aria-label={t("lb.close")}>
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="relative flex-1 overflow-hidden flex items-center justify-center px-2 md:px-16">
            <motion.img
              key={p.url}
              src={img(p.url)}
              alt={td(p.alt)}
              drag={zoom ? true : "x"}
              dragConstraints={zoom ? { left: -400, right: 400, top: -300, bottom: 300 } : { left: 0, right: 0 }}
              dragElastic={zoom ? 0.2 : 0.6}
              onDragEnd={(_, info) => { if (!zoom && Math.abs(info.offset.x) > 80) go(info.offset.x < 0 ? 1 : -1); }}
              onDoubleClick={() => setZoom((z) => !z)}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: zoom ? 2 : 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className={`max-h-full max-w-full object-contain select-none ${zoom ? "cursor-grab" : "cursor-zoom-in"}`}
              draggable={false}
            />
            <button data-testid="lightbox-prev" onClick={() => go(-1)} aria-label={t("lb.prev")} className="absolute left-2 md:left-5 grid h-12 w-12 place-items-center rounded-full bg-black/40 text-white">
              <ChevronLeft />
            </button>
            <button data-testid="lightbox-next" onClick={() => go(1)} aria-label={t("lb.next")} className="absolute right-2 md:right-5 grid h-12 w-12 place-items-center rounded-full bg-black/40 text-white">
              <ChevronRight />
            </button>
          </div>
          <p className="px-5 py-4 text-center text-sm text-[#D9DFDA]">{td(p.alt)}{p.illustration ? ` — ${t("lb.illus")}` : ""}</p>
        </div>
  );
}

