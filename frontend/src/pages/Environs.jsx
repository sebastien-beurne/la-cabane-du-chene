import { useMemo, useState } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import { useSite } from "@/lib/site";
import { img } from "@/lib/api";
import Seo from "@/components/site/Seo";
import PageHeader from "@/components/site/PageHeader";
import CtaBand from "@/components/site/CtaBand";
import ValmunsterMap from "@/components/site/RegionMap";
import { Reveal, Eyebrow } from "@/components/site/Motion";

const ORDER = ["Visites culturelles", "Villages de charme", "Nature", "Gastronomie", "Sorties"];

function PlaceCard({ p, i, illustration }) {
  return (
    <Reveal delay={(i % 3) * 0.06} className="group flex flex-col" data-testid={`place-card-${i}`}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-sand">
        {p.image && <img src={img(p.image)} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-105" />}
        <span className="absolute left-3 top-3 rounded-full bg-paper/95 px-3 py-1 text-xs font-medium text-brand">{p.category}</span>
        {illustration && <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-xs text-white">Image d'illustration</span>}
      </div>
      <h3 className="mt-5 text-2xl md:text-3xl font-medium text-ink">{p.name}</h3>
      <p className="mt-2 flex-1 leading-relaxed text-body">{p.text}</p>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
        {p.url && <a href={p.url} target="_blank" rel="noreferrer" data-testid={`place-site-${i}`} className="inline-flex items-center gap-1 text-action hover:underline underline-offset-4">Site officiel <ArrowUpRight size={14} /></a>}
        {p.maps && <a href={p.maps} target="_blank" rel="noreferrer" data-testid={`place-map-${i}`} className="inline-flex items-center gap-1 text-brand hover:underline underline-offset-4"><MapPin size={14} /> Voir sur la carte</a>}
      </div>
    </Reveal>
  );
}

export default function Valmunster() {
  const site = useSite();
  const places = Array.isArray(site?.content?.places) ? site.content.places : [];
  const illus = useMemo(() => new Set((site?.photos || []).filter((p) => p.illustration).map((p) => p.url)), [site?.photos]);
  const cats = useMemo(() => {
    const present = Array.from(new Set(places.map((p) => p.category).filter(Boolean)));
    return ["Tout", ...ORDER.filter((c) => present.includes(c)), ...present.filter((c) => !ORDER.includes(c))];
  }, [places]);
  const [cat, setCat] = useState("Tout");
  const list = cat === "Tout" ? places : places.filter((p) => p.category === cat);
  const header = site?.photos?.find((p) => p.url === "/images/chene/metz-cathedrale.webp") || site?.pick("vue", "jardin");
  return (
    <>
      <Seo title="Explorer la Moselle et ses environs — Week-end insolite en Lorraine"
        description="Metz, Saarlouis, château de Malbrouck, Centre Pompidou-Metz, Fort aux Fresques et Amnéville : préparez vos découvertes en Moselle."
        path="/a-voir-dans-les-environs" />
      <PageHeader testid="surroundings-header" eyebrow="Mini-guide" title="Explorer la Moselle et ses environs" photo={header}
        intro="Patrimoine, villages de caractère, nature et bonnes adresses : nos idées pour composer votre séjour, de part et d'autre de la frontière." />
      <section className="bg-canvas py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <div className="no-scrollbar -mx-5 px-5 mb-12 flex gap-2 overflow-x-auto" role="tablist">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)} role="tab" aria-selected={cat === c} data-testid={`guide-filter-${c.toLowerCase().replace(/\s+/g, "-")}`}
                className={`shrink-0 rounded-full px-5 py-2.5 text-sm transition-colors duration-300 ${cat === c ? "bg-brand text-on-dark" : "border border-brand/25 text-ink hover:bg-sand"}`}>
                {c}
              </button>
            ))}
          </div>
          <div className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p, i) => <PlaceCard key={`${p.name}-${i}`} p={p} i={i} illustration={illus.has(p.image)} />)}
          </div>
          <Reveal className="mt-20 rounded-md bg-sand p-6 md:p-8 text-sm leading-relaxed text-body">
            <Eyebrow className="mb-3">À noter</Eyebrow>
            Horaires, tarifs et conditions de visite évoluent selon les saisons : pensez à les vérifier sur les sites officiels avant de vous déplacer. Sur place, nous vous partageons volontiers nos conseils.
          </Reveal>
        </div>
      </section>
      <ValmunsterMap places={places} />
      <CtaBand />
    </>
  );
}

