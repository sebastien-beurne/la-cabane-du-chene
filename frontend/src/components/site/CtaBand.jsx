import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useSite } from "@/lib/site";
import { img } from "@/lib/api";
import { MaskLines, splitLines, Reveal, Eyebrow } from "./Motion";

export function Btn({ to, href, children, variant = "rust", testid, className = "" }) {
  const styles = {
    rust: "bg-[#B35432] text-[#F8F5F0] hover:bg-[#944125]",
    light: "bg-[#F8F5F0] text-[#1B2B24] hover:bg-white",
    ghostLight: "border border-[#F8F5F0]/50 text-[#F8F5F0] hover:bg-[#F8F5F0]/10",
    ghost: "border border-[#2D4A3E]/30 text-[#1B2B24] hover:bg-[#2D4A3E] hover:text-[#F8F5F0]",
  };
  const cls = `group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-[background-color,color,transform] duration-300 hover:-translate-y-0.5 ${styles[variant]} ${className}`;
  const inner = (<>{children}<ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" /></>);
  if (href) return <a href={href} target="_blank" rel="noreferrer" data-testid={testid} className={cls}>{inner}</a>;
  return <Link to={to} data-testid={testid} className={cls}>{inner}</Link>;
}

export default function CtaBand() {
  const site = useSite();
  const h = site?.content?.home || {};
  const photo = site?.pick("pergola", "bain", "jardin");
  return (
    <section data-testid="final-cta" className="relative overflow-hidden bg-[#1B2B24] grain">
      <div className="mx-auto max-w-7xl px-5 md:px-10 py-24 md:py-32 grid gap-12 lg:grid-cols-12 items-center">
        <div className="lg:col-span-7 relative z-10">
          <Eyebrow light>Réservation directe</Eyebrow>
          <h2 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-medium leading-[1.02] text-[#F8F5F0]">
            <MaskLines lines={splitLines(h.cta_title || "Et si votre prochaine escapade commençait ici ?", 24)} />
          </h2>
          <Reveal delay={0.2}>
            <p className="mt-6 max-w-lg text-[#D9DFDA] leading-relaxed">{h.cta_text}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Btn to="/tarifs-disponibilites#reserver" testid="final-cta-book">Demander mes dates</Btn>
              <Btn to="/contact" variant="ghostLight" testid="final-cta-contact">Nous écrire</Btn>
            </div>
          </Reveal>
        </div>
        {photo && (
          <Reveal className="lg:col-span-5" delay={0.15}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-md">
              <img src={img(photo.url)} alt={photo.alt} loading="lazy" className="h-full w-full object-cover" />
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

