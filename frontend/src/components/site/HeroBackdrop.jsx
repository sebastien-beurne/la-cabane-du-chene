import { img } from "@/lib/api";
import { LogoMark } from "./Logo";

const POS = { center: "50% 50%", top: "50% 20%", bottom: "50% 80%", left: "25% 50%", right: "75% 50%" };

export function heroSettings(home = {}) {
  const o = Number(home.hero_overlay);
  return { overlay: Number.isFinite(o) ? Math.min(90, Math.max(0, o)) : 45, position: POS[home.hero_position] || POS.center, watermark: !!home.hero_watermark };
}

export default function HeroBackdrop({ photo, home, priority = false }) {
  const s = heroSettings(home);
  return (
    <>
      <img src={img(photo.url)} alt={photo.alt} fetchPriority={priority ? "high" : undefined} style={{ objectPosition: s.position }} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[#0f1813]" style={{ opacity: s.overlay / 100 }} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f1813]/80 via-transparent to-transparent" />
      {s.watermark && <LogoMark className="pointer-events-none absolute -right-[6%] -bottom-[10%] h-[70%] w-auto opacity-[0.09]" light />}
    </>
  );
}

