import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { img } from "@/lib/api";
import Lightbox from "./Lightbox";
import { Reveal } from "./Motion";
import { useT } from "@/lib/i18n";

export const CAT_LABELS = {
  accueil: "Photo d'accueil", jardin: "Jardin", salon: "Salon", interieur: "Intérieur", chambre: "Chambre",
  cuisine: "Cuisine", "salle-de-bains": "Salle de bains", terrasse: "Terrasse", pergola: "Pergola",
  bain: "Bain nordique", vue: "Jardin & nature", guide: "Guide & découvertes", autre: "Autre",
};

const catName = (t, c) => (CAT_LABELS[c] ? t(`cat.${c}`) : c);

export function Tile({ p, onClick, className = "", testid }) {
  const { t, td } = useT();
  return (
    <button type="button" onClick={onClick} data-testid={testid} data-no-translate
      className={`group relative overflow-hidden rounded-md bg-sand ${className}`} aria-label={t("gal.enlarge", { alt: td(p.alt) })}>
      <img src={img(p.url)} alt={td(p.alt)} loading="lazy" decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <span className="absolute bottom-3 left-3 text-left text-xs font-medium text-white opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        {CAT_LABELS[p.category] ? t(`cat.${p.category}`) : ""}
      </span>
    </button>
  );
}

export function Bento({ photos }) {
  const [open, setOpen] = useState(null);
  const five = photos.slice(0, 5);
  const spans = ["col-span-2 row-span-2", "", "", "col-span-2", ""];
  return (
    <>
      <div data-testid="bento-gallery" className="grid grid-cols-2 md:grid-cols-4 auto-rows-[170px] sm:auto-rows-[220px] md:auto-rows-[250px] gap-3 md:gap-4">
        {five.map((p, i) => (
          <Reveal key={p.id || p.url} delay={i * 0.06} className={`${spans[i] || ""} ${five.length === 5 && i === 4 ? "col-span-2 md:col-span-1 md:hidden" : ""}`}>
            <Tile p={p} onClick={() => setOpen(i)} className="h-full w-full" testid={`bento-tile-${i}`} />
          </Reveal>
        ))}
      </div>
      <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** One room: a touch-swipeable photo strip (native scroll-snap), dots, desktop arrows, tap to enlarge. */
function RoomCarousel({ cat, photos, onOpen }) {
  const { t } = useT();
  const track = useRef(null);
  const [at, setAt] = useState(0);
  const slideW = () => track.current?.firstElementChild?.offsetWidth || 1;
  const onScroll = () => setAt(Math.min(photos.length - 1, Math.round(track.current.scrollLeft / (slideW() + 12))));
  const goTo = (i) => track.current?.scrollTo({ left: i * (slideW() + 12), behavior: "smooth" });
  const many = photos.length > 1;
  return (
    <section className="min-w-0" data-testid={`room-${cat}`} data-no-translate>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-2xl text-ink">{catName(t, cat)}</h3>
        <span className="flex items-center gap-1.5 text-xs text-muted-ink" data-testid={`room-${cat}-count`}><Images size={14} /> {many ? `${at + 1} / ${photos.length}` : t("gal.one")}</span>
      </div>
      <div className="group/room relative">
        <div ref={track} onScroll={onScroll} data-testid={`room-${cat}-track`}
          className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth">
          {photos.map((p, i) => (
            <Tile key={p.id || p.url} p={p} onClick={() => onOpen(photos, i)} testid={`room-${cat}-photo-${i}`}
              className={`aspect-[4/3] shrink-0 snap-center ${many ? "w-[88%] sm:w-full" : "w-full"}`} />
          ))}
        </div>
        {many && (
          <>
            <button type="button" onClick={() => goTo(Math.max(0, at - 1))} disabled={at === 0} aria-label={t("lb.prev")} data-testid={`room-${cat}-prev`}
              className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow transition-opacity disabled:opacity-0 sm:grid"><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => goTo(Math.min(photos.length - 1, at + 1))} disabled={at === photos.length - 1} aria-label={t("lb.next")} data-testid={`room-${cat}-next`}
              className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow transition-opacity disabled:opacity-0 sm:grid"><ChevronRight size={18} /></button>
          </>
        )}
      </div>
      {many && (
        <div className="mt-3 flex justify-center gap-1.5">
          {photos.map((p, i) => (
            <button key={p.id || p.url} type="button" onClick={() => goTo(i)} aria-label={t("gal.photoN", { n: i + 1 })} data-testid={`room-${cat}-dot-${i}`}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${i === at ? "w-6 bg-action" : "w-1.5 bg-brand/25"}`} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Gallery({ photos }) {
  const { t } = useT();
  const cats = useMemo(() => Array.from(new Set(photos.map((p) => p.category))), [photos]);
  const [cat, setCat] = useState("tout");
  const [box, setBox] = useState({ list: [], i: null });
  const shown = cat === "tout" ? cats : [cat];
  return (
    <div data-testid="photo-gallery">
      <div className="no-scrollbar -mx-5 px-5 mb-8 flex gap-2 overflow-x-auto" role="group" aria-label={t("gal.filters")} data-no-translate>
        {["tout", ...cats].map((c) => (
          <button key={c} onClick={() => setCat(c)} data-testid={`gallery-filter-${c}`} aria-pressed={cat === c}
            className={`shrink-0 rounded-full px-4 py-2 text-sm transition-colors duration-300 ${cat === c ? "bg-brand text-on-dark" : "border border-brand/25 text-ink hover:bg-sand"}`}>
            {c === "tout" ? t("gal.all") : catName(t, c)}
          </button>
        ))}
      </div>
      <p className="mb-6 text-sm text-muted-ink sm:hidden" data-no-translate>{t("gal.swipe")}</p>
      <div className={`grid gap-x-6 gap-y-10 ${shown.length > 1 ? "md:grid-cols-2" : ""}`}>
        {shown.map((c) => (
          <RoomCarousel key={c} cat={c} photos={photos.filter((p) => p.category === c)} onOpen={(list, i) => setBox({ list, i })} />
        ))}
      </div>
      <Lightbox photos={box.list} index={box.i} onClose={() => setBox((b) => ({ ...b, i: null }))} />
    </div>
  );
}

