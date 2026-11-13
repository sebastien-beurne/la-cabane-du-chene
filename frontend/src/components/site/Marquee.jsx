import { LogoMark } from "./Logo";

const ITEMS = ["Spa nordique privatif", "Petit déjeuner inclus", "Cabane en bois climatisée", "Terrasse au jardin", "Valmunster · Moselle · Lorraine"];

export default function Marquee({ dark = false }) {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div data-testid="editorial-marquee" className={`overflow-hidden py-8 md:py-10 border-y ${dark ? "bg-ink border-white/10" : "bg-paper border-brand/10"}`} aria-hidden="true">
      <div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap">
        {[...row, ...row].map((t, i) => (
          <span key={i} className="flex items-center gap-10">
            <span className={`font-display italic text-4xl md:text-6xl ${dark ? "text-on-dark" : "text-brand"}`}>{t}</span>
            <LogoMark className="h-7 w-7 md:h-9 md:w-9 opacity-70" light={dark} />
          </span>
        ))}
      </div>
    </div>
  );
}

