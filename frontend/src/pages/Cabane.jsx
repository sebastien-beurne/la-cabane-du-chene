import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Check, ChefHat, Car, ImageOff, Snowflake, Sun, Tv, Users, Waves, Wifi, Flame, Trees } from "lucide-react";

const EQUIP_ICONS = [[/bain|jacuzzi|spa/i, Waves], [/terrasse|pergola/i, Sun], [/cuisine/i, ChefHat], [/clim/i, Snowflake], [/wifi|internet/i, Wifi], [/parking|stationnement/i, Car], [/télé|tv/i, Tv], [/chauff|poêle|cheminée/i, Flame], [/jardin/i, Trees]];
const equipIcon = (label) => (EQUIP_ICONS.find(([re]) => re.test(label)) || [null, Check])[1];
const TITLE_CATS = [[/salon|séjour/i, ["salon", "interieur"]], [/chambre/i, ["chambre"]], [/cuisine/i, ["cuisine"]], [/salle de bain|douche/i, ["salle-de-bains"]], [/bain nordique|jacuzzi/i, ["bain"]], [/terrasse|pergola/i, ["terrasse", "pergola"]], [/vue|citadelle/i, ["vue"]], [/jardin/i, ["jardin"]]];
// The chosen category wins; the title is a fallback so a space never stays without photo (e.g. category left on « Autre »).
const spaceCats = (s) => [s.category, ...TITLE_CATS.filter(([re]) => re.test(s.title || "")).flatMap(([, c]) => c)].filter(Boolean);
import { useSite } from "@/lib/site";
import { img } from "@/lib/api";
import Seo from "@/components/site/Seo";
import PageHeader from "@/components/site/PageHeader";
import Equipments from "@/components/site/Equipments";
import Gallery from "@/components/site/Gallery";
import CtaBand from "@/components/site/CtaBand";
import { Reveal, Eyebrow, MaskLines, splitLines } from "@/components/site/Motion";

function SpaceRow({ s, i, photo }) {
  const flip = i % 2 === 1;
  const feats = String(s.features || "").split(",").map((f) => f.trim()).filter(Boolean);
  return (
    <article data-testid={`space-${i}`} className="grid gap-8 md:gap-14 md:grid-cols-12 items-center">
      <Reveal className={`md:col-span-7 ${flip ? "md:order-2" : ""}`}>
        {photo ? (
          <div className="aspect-[4/3] overflow-hidden rounded-md">
            <img src={img(photo.url)} alt={photo.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1400ms] hover:scale-105" />
          </div>
        ) : (
          <div className="aspect-[4/3] rounded-md border border-dashed border-brand/30 bg-sand grid place-items-center text-center p-6">
            <span className="flex flex-col items-center gap-3 text-sm text-muted-ink"><ImageOff size={26} /> Photo à venir</span>
          </div>
        )}
      </Reveal>
      <Reveal delay={0.1} className="md:col-span-5">
        <span className="font-display italic text-xl text-action">{String(i + 1).padStart(2, "0")}</span>
        <h3 className="mt-2 text-3xl md:text-4xl font-medium text-ink">{s.title}</h3>
        <p className="mt-4 text-base leading-relaxed text-body">{s.text}</p>
        {feats.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {feats.map((f) => <li key={f} className="rounded-full bg-sand px-3 py-1.5 text-xs font-medium text-brand">{f}</li>)}
          </ul>
        )}
      </Reveal>
    </article>
  );
}

export default function Cabane() {
  const site = useSite();
  const cab = site?.content?.cabin || {};
  const spaces = Array.isArray(cab.spaces) ? cab.spaces : [];
  const { hash } = useLocation();
  const garden = site?.pick("jardin");

  useEffect(() => {
    if (hash !== "#galerie" || !site?.ready) return undefined;
    const t = setTimeout(() => document.getElementById("galerie")?.scrollIntoView({ behavior: "smooth" }), 400);
    return () => clearTimeout(t);
  }, [hash, site?.ready]);

  const facts = [["Surface", cab.surface], ["Capacité", cab.capacity, Users]].filter(([, v]) => v);
  const equipment = String(cab.equipment ?? "Terrasse au jardin, Bain nordique, Cuisine équipée, Climatisation").split(",").map((x) => x.trim()).filter(Boolean);
  return (
    <>
      <Seo title="La cabane — Location de charme en bois à Valmunster | La Cabane du Chêne"
        description="Une cabane en bois brûlé de 32 m² : chambre en mezzanine, cuisine équipée, terrasse au jardin et spa privatif."
        path="/la-cabane" />
      <PageHeader testid="cabane-header" eyebrow="La cabane" title="Le charme du bois, le confort en plus" intro={cab.intro} photo={site?.pick("pergola", "terrasse", "jardin")} />
      {(facts.length > 0 || equipment.length > 0) && (
        <div className="bg-brand text-on-dark" data-testid="cabane-facts">
          <div className="mx-auto max-w-7xl px-5 md:px-10 py-6 flex flex-wrap items-center gap-x-12 gap-y-4">
            {facts.map(([k, v, Icon]) => <p key={k} className="flex items-center text-sm" data-testid={`cabane-fact-${k === "Surface" ? "surface" : "capacity"}`}><span className="text-gold uppercase tracking-[0.2em] text-xs mr-3">{k}</span>{Icon && <Icon size={16} aria-hidden className="mr-1.5 text-gold" />}{v}</p>)}
            {equipment.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" data-testid="cabane-equipment">
                <span className="text-gold uppercase tracking-[0.2em] text-xs mr-1">Équipements</span>
                {equipment.map((e) => { const Icon = equipIcon(e); return <span key={e} className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3 py-1 text-sm" data-testid="cabane-equipment-chip"><Icon size={14} aria-hidden className="text-gold" />{e}</span>; })}
              </div>
            )}
          </div>
        </div>
      )}
      <section className="bg-canvas py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 md:px-10 space-y-24 md:space-y-32">
          {spaces.map((s, i) => <SpaceRow key={`${s.title}-${i}`} s={s} i={i} photo={site?.pick(...spaceCats(s))} />)}
        </div>
      </section>
      <section data-testid="shared-garden" className="bg-sand py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-5 md:px-10 grid gap-12 lg:grid-cols-12 items-center">
          <div className="lg:col-span-5">
            <Eyebrow>La terrasse et le jardin</Eyebrow>
            <h2 className="mt-5 text-4xl md:text-5xl font-medium leading-[1.05] text-ink">
              <MaskLines lines={splitLines("Votre parenthèse au grand air", 22)} />
            </h2>
            <Reveal delay={0.1}><p className="mt-6 text-base md:text-lg leading-relaxed text-body">{cab.shared_garden}</p></Reveal>
          </div>
          {garden && (
            <Reveal className="lg:col-span-7">
              <div className="aspect-[16/10] overflow-hidden rounded-md">
                <img src={img(garden.url)} alt={garden.alt} loading="lazy" className="h-full w-full object-cover" />
              </div>
            </Reveal>
          )}
        </div>
      </section>
      <Equipments eyebrow="Tout ce qui vous attend" />
      <section id="galerie" data-testid="cabane-gallery" className="bg-canvas py-24 md:py-32 scroll-mt-24">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <Reveal className="mb-10">
            <Eyebrow>Galerie</Eyebrow>
            <h2 className="mt-4 text-4xl md:text-5xl font-medium text-ink">La cabane en photos</h2>
          </Reveal>
          <Gallery photos={site?.gallery || []} />
        </div>
      </section>
      <CtaBand />
    </>
  );
}

