import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useSite, FALLBACK } from "@/lib/site";
import { img } from "@/lib/api";
import Seo from "@/components/site/Seo";
import Marquee from "@/components/site/Marquee";
import Equipments from "@/components/site/Equipments";
import CtaBand, { Btn } from "@/components/site/CtaBand";
import { Bento } from "@/components/site/Gallery";
import HeroBackdrop from "@/components/site/HeroBackdrop";
import Videos from "@/components/site/Videos";
import ReviewsSection from "@/components/site/Reviews";
import { MaskLines, splitLines, Reveal, Eyebrow } from "@/components/site/Motion";

const EASE = [0.22, 1, 0.36, 1];

function Hero() {
  const site = useSite();
  const h = site?.content?.home || {};
  const photo = (h.hero_image && { url: h.hero_image, alt: "La Cabane du Chêne à Valmunster" }) || site?.pick("accueil", "jardin") || { url: "/images/chene/cabane-jardin.webp", alt: "La Cabane du Chêne dans son jardin" };
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [2.5, -2.5]), { stiffness: 60, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-3.5, 3.5]), { stiffness: 60, damping: 20 });
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  return (
    <section ref={ref} onMouseMove={onMove} data-testid="hero-section" className="relative min-h-[100svh] overflow-hidden bg-[#1B2B24] [perspective:1400px]">
      <motion.div
        style={{ y, rotateX: rx, rotateY: ry }}
        initial={{ clipPath: "inset(12% 8% 12% 8% round 24px)", scale: 1.25 }}
        animate={{ clipPath: "inset(0% 0% 0% 0% round 0px)", scale: 1.08 }}
        transition={{ duration: 1.8, ease: EASE }}
        className="absolute inset-0 will-change-transform"
      >
        <HeroBackdrop photo={photo} home={h} priority />
      </motion.div>
      <div className="grain absolute inset-0" />
      <motion.div style={{ y: textY, opacity: fade }} className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-5 md:px-10 pt-36 md:pt-52 pb-16 md:pb-20">
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8 }}
          className="mb-6 text-xs uppercase tracking-[0.3em] text-[#E8DCCB]">
          Gîte insolite · Valmunster · Moselle
        </motion.p>
        <h1 data-testid="hero-title" className="max-w-5xl text-[2.9rem] leading-[0.95] sm:text-6xl lg:text-[6.5rem] font-medium tracking-tight text-[#F8F5F0]">
          <MaskLines lines={splitLines(h.hero_title || FALLBACK.hero_title, 20)} onLoad delay={0.55} />
        </h1>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 0.9, ease: EASE }}
          className="mt-8 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p className="max-w-lg text-base md:text-lg leading-relaxed text-[#ECE7DE]">{h.hero_subtitle || FALLBACK.hero_subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Btn to="/la-cabane" variant="ghostLight" testid="hero-cta-discover">Découvrir la cabane</Btn>
            <Btn to="/tarifs-disponibilites#reserver" testid="hero-cta-book">Réserver votre séjour</Btn>
          </div>
        </motion.div>
      </motion.div>
      <div className="pointer-events-none absolute right-8 top-32 hidden lg:block z-10">
        <div className="relative h-36 w-36">
          <svg viewBox="0 0 200 200" className="spin-slow absolute inset-0 h-full w-full">
            <defs><path id="circ" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" /></defs>
            <text fill="#F8F5F0" fontSize="13" letterSpacing="4" fontFamily="Plus Jakarta Sans">
              <textPath href="#circ">SPA PRIVATIF · PETIT DÉJEUNER INCLUS ·</textPath>
            </text>
          </svg>
          <span className="absolute inset-0 grid place-items-center font-display italic text-3xl text-[#E3B48A]">&amp;</span>
        </div>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-2 text-[#E8DCCB]">
        <ArrowDown size={16} className="animate-bounce" />
      </motion.div>
    </section>
  );
}

function Concept() {
  const site = useSite();
  const h = site?.content?.home || {};
  const big = site?.pick("terrasse", "jardin");
  const small = site?.pick("interieur", "salon");
  const facts = [["01", "Petit déjeuner inclus"], ["02", "Bain nordique privatif"], ["03", "Cabane en bois climatisée"]];
  return (
    <section data-testid="concept-section" className="bg-[#F8F5F0] py-24 md:py-36 overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 md:px-10 grid gap-16 lg:grid-cols-12 items-center">
        <div className="lg:col-span-5">
          <Eyebrow>Le concept</Eyebrow>
          <h2 className="mt-5 text-4xl sm:text-5xl font-medium leading-[1.02] text-[#1B2B24]">
            <MaskLines lines={splitLines(h.intro_title, 22)} />
          </h2>
          <Reveal delay={0.15}>
            <p className="mt-7 text-base md:text-lg leading-relaxed text-[#33423A]">{h.intro_text}</p>
            <ul className="mt-10 border-t border-[#2D4A3E]/15">
              {facts.map(([n, t]) => (
                <li key={n} className="flex items-baseline gap-6 border-b border-[#2D4A3E]/15 py-4">
                  <span className="font-display italic text-[#B35432] text-lg">{n}</span>
                  <span className="font-display text-2xl text-[#1B2B24]">{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10"><Btn to="/la-cabane" variant="ghost" testid="concept-cta">Visiter la cabane</Btn></div>
          </Reveal>
        </div>
        <div className="lg:col-span-7 relative">
          {big && (
            <Reveal>
              <div className="relative ml-auto aspect-[4/5] w-[88%] overflow-hidden rounded-t-[999px] rounded-b-md">
                <img src={img(big.url)} alt={big.alt} loading="lazy" className="h-full w-full object-cover" />
              </div>
            </Reveal>
          )}
          {small && (
            <Reveal delay={0.25} className="absolute -bottom-10 left-0 w-[46%]">
              <div className="aspect-square overflow-hidden rounded-md border-[6px] border-[#F8F5F0] shadow-2xl">
                <img src={img(small.url)} alt={small.alt} loading="lazy" className="h-full w-full object-cover" />
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

function BathSpotlight() {
  const site = useSite();
  const h = site?.content?.home || {};
  const photo = site?.pick("bain", "pergola");
  const [pos, setPos] = useState({ x: 50, y: 45 });
  if (!photo) return null;
  return (
    <section data-testid="bath-section" className="relative bg-[#1B2B24] py-24 md:py-36 overflow-hidden grain">
      <div className="mx-auto max-w-7xl px-5 md:px-10 grid gap-14 lg:grid-cols-12 items-center">
        <Reveal className="lg:col-span-7 order-1 lg:order-none">
          <div
            onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
            className="relative aspect-[4/3] overflow-hidden rounded-md [clip-path:polygon(0_6%,100%_0,100%_94%,0_100%)]"
          >
            <img src={img(photo.url)} alt={photo.alt} loading="lazy" className="h-full w-full object-cover scale-105" />
            <div className="pointer-events-none absolute inset-0 transition-[background] duration-300"
              style={{ background: `radial-gradient(circle at ${pos.x}% ${pos.y}%, rgba(255,240,215,0.18) 0%, rgba(15,24,19,0) 30%, rgba(15,24,19,0.55) 75%)` }} />
          </div>
        </Reveal>
        <div className="lg:col-span-5">
          <Eyebrow light>L'expérience bien-être</Eyebrow>
          <h2 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-medium leading-[1.02] text-[#F8F5F0]">
            <MaskLines lines={splitLines(h.bath_title, 18)} />
          </h2>
          <Reveal delay={0.15}>
            <p className="mt-7 text-base md:text-lg leading-relaxed text-[#D9DFDA]">{h.bath_text}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Btn to="/bain-nordique" variant="light" testid="bath-cta">Le bain nordique</Btn>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function GallerySection() {
  const gallery = useSite()?.gallery || [];
  if (!gallery.length) return null;
  return (
    <section data-testid="gallery-section" className="bg-[#FBF9F5] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <Reveal className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow>En images</Eyebrow>
            <h2 className="mt-4 text-4xl md:text-5xl font-medium leading-[1.05] text-[#1B2B24]">Le bois, le jardin, la lumière</h2>
          </div>
          <Link to="/la-cabane#galerie" data-testid="gallery-see-all" className="inline-flex items-center gap-2 text-sm font-semibold text-[#2D4A3E] underline-offset-4 hover:underline">
            Voir toute la galerie <ArrowUpRight size={16} />
          </Link>
        </Reveal>
        <Bento photos={gallery} />
      </div>
    </section>
  );
}

function ValmunsterTeaser() {
  const site = useSite();
  const h = site?.content?.home || {};
  const places = (site?.content?.places || []).slice(0, 4);
  const photo = site?.photos?.find((p) => p.url === "/images/chene/metz-cathedrale.webp") || site?.pick("vue");
  return (
    <section data-testid="surroundings-section" className="bg-[#F8F5F0] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-10 grid gap-14 lg:grid-cols-12 items-center">
        <div className="lg:col-span-6 order-2 lg:order-1">
          <Eyebrow>La Moselle & ses environs</Eyebrow>
          <h2 className="mt-5 text-4xl sm:text-5xl font-medium leading-[1.02] text-[#1B2B24]">
            <MaskLines lines={splitLines(h.surroundings_title, 22)} />
          </h2>
          <Reveal delay={0.15}>
            <p className="mt-7 text-base md:text-lg leading-relaxed text-[#33423A]">{h.surroundings_text}</p>
            <ul className="mt-8 flex flex-wrap gap-2">
              {places.map((p) => (
                <li key={p.name} className="rounded-full border border-[#2D4A3E]/20 px-4 py-2 text-sm text-[#1B2B24]">{p.name}</li>
              ))}
            </ul>
            <div className="mt-10"><Btn to="/a-voir-dans-les-environs" variant="ghost" testid="surroundings-cta">Préparer mes visites</Btn></div>
          </Reveal>
        </div>
        {photo && (
          <Reveal className="lg:col-span-6 order-1 lg:order-2">
            <figure className="relative aspect-[5/4] overflow-hidden rounded-md">
              <img src={img(photo.url)} alt={photo.alt} loading="lazy" className="h-full w-full object-cover" />
              {photo.illustration && <figcaption className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-xs text-white">Image d'illustration</figcaption>}
            </figure>
          </Reveal>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const g = useSite()?.content?.general || {};
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: "La Cabane du Chêne",
    description: "Cabane en bois brûlé à Valmunster, 32 m², bain nordique privatif et petit déjeuner inclus.",
    url: process.env.REACT_APP_SITE_URL,
    image: `${process.env.REACT_APP_SITE_URL}/images/chene/bain-nordique.webp`,
    address: { "@type": "PostalAddress", addressLocality: "Valmunster", addressRegion: "Grand Est", addressCountry: "FR" },
    ...(g.email ? { email: g.email } : {}),
    ...(g.phone ? { telephone: g.phone } : {}),
    checkinTime: "17:00", checkoutTime: "11:00",
    amenityFeature: ["Bain nordique", "Climatisation", "Cuisine équipée", "Terrasse", "Petit déjeuner inclus"].map((n) => ({ "@type": "LocationFeatureSpecification", name: n, value: true })),
  };
  return (
    <>
      <Seo title="La Cabane du Chêne — Gîte insolite avec bain nordique à Valmunster (Moselle)"
        description="Séjournez à Valmunster dans une cabane de 32 m² avec spa privatif et petit déjeuner inclus. Une parenthèse au vert en Moselle."
        path="/" jsonLd={jsonLd} />
      <Hero />
      <Marquee />
      <Concept />
      <BathSpotlight />
      <GallerySection />
      <Videos />
      <Equipments />
      <ValmunsterTeaser />
      <ReviewsSection />
      <CtaBand />
    </>
  );
}

