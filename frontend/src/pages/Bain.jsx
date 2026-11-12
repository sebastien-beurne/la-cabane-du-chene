import { Flame, ShieldCheck, ListChecks } from "lucide-react";
import { useSite } from "@/lib/site";
import { img } from "@/lib/api";
import Seo from "@/components/site/Seo";
import PageHeader from "@/components/site/PageHeader";
import Marquee from "@/components/site/Marquee";
import CtaBand from "@/components/site/CtaBand";
import { Reveal, Eyebrow, MaskLines, splitLines } from "@/components/site/Motion";

function RuleList({ title, icon: I, items, testid }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return null;
  return (
    <Reveal className="rounded-md bg-[#F8F5F0] p-7 md:p-9" data-testid={testid}>
      <div className="flex items-center gap-3 text-[#2D4A3E]"><I size={22} strokeWidth={1.5} /><h3 className="text-2xl md:text-3xl font-medium text-[#1B2B24]">{title}</h3></div>
      <ul className="mt-6 space-y-4">
        {list.map((r, i) => (
          <li key={i} className="flex gap-4 text-[#33423A] leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#B35432]" />{r}
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

export default function Bain() {
  const site = useSite();
  const b = site?.content?.bath || {};
  const moments = Array.isArray(b.moments) ? b.moments : [];
  const second = site?.pick("pergola", "terrasse");
  return (
    <>
      <Seo title="Cabane avec bain nordique en Lorraine — La Cabane du Chêne, Valmunster"
        description="Un spa nordique privatif chauffé toute l’année à La Cabane du Chêne, à Valmunster en Moselle."
        path="/bain-nordique" />
      <PageHeader testid="bain-header" eyebrow="Le bain nordique" title="Un moment à soi, à ciel ouvert" intro={b.intro} photo={site?.pick("bain", "pergola")} />
      <section className="bg-[#1B2B24] py-24 md:py-32 grain relative">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <Eyebrow light>Trois moments</Eyebrow>
          <h2 className="mt-5 max-w-3xl text-4xl md:text-6xl font-medium leading-[1.02] text-[#F8F5F0]">
            <MaskLines lines={splitLines("Le jour, le soir, puis les étoiles", 20)} />
          </h2>
          <div className="mt-16 grid gap-10 md:grid-cols-3">
            {moments.map((m, i) => (
              <Reveal key={i} delay={i * 0.1} className="border-t border-white/15 pt-7" data-testid={`bath-moment-${i}`}>
                <span className="font-display italic text-5xl text-[#E3B48A]">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-4 text-3xl font-medium text-[#F8F5F0]">{m.title}</h3>
                <p className="mt-3 leading-relaxed text-[#D9DFDA]">{m.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-[#F8F5F0] py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 md:px-10 grid gap-12 lg:grid-cols-12 items-center">
          {second && (
            <Reveal className="lg:col-span-6">
              <div className="aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-md">
                <img src={img(second.url)} alt={second.alt} loading="lazy" className="h-full w-full object-cover" />
              </div>
            </Reveal>
          )}
          <Reveal className="lg:col-span-6" delay={0.1}>
            <Eyebrow>Chauffé toute l’année</Eyebrow>
            <h2 className="mt-5 text-4xl md:text-5xl font-medium leading-[1.05] text-[#1B2B24]">La chaleur de l'eau, la fraîcheur du soir</h2>
            <p className="mt-6 flex gap-4 text-base md:text-lg leading-relaxed text-[#33423A]">
              <Flame className="mt-1 shrink-0 text-[#B35432]" size={22} strokeWidth={1.5} /> {b.heating}
            </p>
          </Reveal>
        </div>
      </section>
      <Marquee dark />
      <section data-testid="bath-rules" className="bg-[#EFEAE1] py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <Reveal className="mb-12 max-w-2xl">
            <Eyebrow>Bon à savoir</Eyebrow>
            <h2 className="mt-4 text-4xl md:text-5xl font-medium text-[#1B2B24]">Règles d'utilisation & sécurité</h2>
            <p className="mt-4 text-[#526058]">Pour profiter du bain en toute sérénité, merci de respecter ces consignes. Les modalités précises vous sont expliquées sur place.</p>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-2">
            <RuleList title="Règles d'utilisation" icon={ListChecks} items={b.rules} testid="bath-rules-list" />
            <RuleList title="Consignes de sécurité" icon={ShieldCheck} items={b.safety} testid="bath-safety-list" />
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  );
}

