import { LogoMark } from "./Logo";

const ITEMS = ["Spa nordique privatif", "Petit déjeuner inclus", "Cabane en bois climatisée", "Terrasse au jardin", "Valmunster · Moselle · Lorraine"];

export default function Marquee({ dark = false }) {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div data-testid="editorial-marquee" className={`overflow-hidden py-8 md:py-10 border-y ${dark ? "bg-[#1B2B24] border-white/10" : "bg-[#F8F5F0] border-[#2D4A3E]/10"}`} aria-hidden="true">
      <div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap">
        {[...row, ...row].map((t, i) => (
          <span key={i} className="flex items-center gap-10">
            <span className={`font-display italic text-4xl md:text-6xl ${dark ? "text-[#F8F5F0]" : "text-[#2D4A3E]"}`}>{t}</span>
            <LogoMark className="h-7 w-7 md:h-9 md:w-9 opacity-70" light={dark} />
          </span>
        ))}
      </div>
    </div>
  );
}

