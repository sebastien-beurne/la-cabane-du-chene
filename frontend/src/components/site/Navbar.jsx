import {useSite} from '@/lib/site';
import SeasonalDecor, {SeasonalBadge} from './SeasonalDecor';
import {themeById} from '@/lib/themes';
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LangSwitcher from "./LangSwitcher";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import GreenGoLink from "./GreenGo";
import { useT } from "@/lib/i18n";

// Labels are translation keys (nav.<id>).
export const NAV = [
  { to: "/la-cabane", id: "cabane" },
  { to: "/bain-nordique", id: "bain" },
  { to: "/a-voir-dans-les-environs", id: "surroundings" },
  { to: "/tarifs-disponibilites", id: "tarifs" },
  { to: "/avis-clients", id: "avis" },
  { to: "/carte-cadeau", id: "cadeau", Icon: Gift },
  { to: "/contact", id: "contact" },
];

export default function Navbar() {const seasonalSite=useSite();const seasonalQuery=new URLSearchParams(useLocation().search).get('theme-preview');const seasonalTheme=seasonalQuery&&themeById(seasonalQuery).id===seasonalQuery?seasonalQuery:seasonalSite.previewTheme||seasonalSite.content?.appearance?.theme;const seasonalActive=['spring','summer','autumn','winter','halloween','christmas','easter','valentine'].includes(themeById(seasonalTheme).id);
  const { t } = useT();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const solid = ["/mentions-legales", "/confidentialite", "/conditions", "/avis-clients", "/livret-accueil"].includes(pathname)
    || pathname.startsWith("/paiement") || pathname.startsWith("/carte-cadeau");
  const overHero = !scrolled && !open && !solid && !seasonalActive;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      data-testid="site-header" data-seasonal-header={seasonalActive}
      data-no-translate
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,padding] duration-500 ${
        overHero ? "bg-transparent py-5" : "bg-paper/85 backdrop-blur-xl shadow-[0_1px_0_rgba(45,74,62,0.12)] py-3"
      }`}
    >
      <div className="mx-auto flex max-w-7xl flex-nowrap md:flex-wrap items-center justify-between gap-x-2 gap-y-3 px-4 sm:px-5 md:px-10">
        <Link to="/" data-testid="nav-brand-logo" aria-label={t("nav.homeAria")} className="min-w-0 shrink">
          <span className="seasonal-brand"><Logo light={overHero}/>{!open&&<SeasonalBadge theme={seasonalTheme}/>}</span>
        </Link>
        <nav data-testid="desktop-nav" aria-label={t("nav.main")}
          className={`hidden md:flex order-last w-full flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t pt-3 2xl:order-none 2xl:w-auto 2xl:border-0 2xl:pt-0 2xl:gap-7 ${overHero ? "border-white/20" : "border-brand/10"}`}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={`nav-link-${n.id}`}
              className={({ isActive }) =>
                `relative inline-flex items-center gap-1.5 text-sm font-medium transition-colors after:absolute after:-bottom-1 after:left-0 after:h-px after:bg-current after:transition-[width] after:duration-500 hover:after:w-full ${
                  isActive ? "after:w-full" : "after:w-0"
                } ${overHero ? "text-on-dark" : "text-ink"}`
              }
            >
              {n.Icon && <n.Icon size={15} aria-hidden className={overHero ? "text-gold" : "text-action"} />}
              {t(`nav.${n.id}`)}
            </NavLink>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <LangSwitcher light={overHero} />
          <Link
            to="/tarifs-disponibilites#reserver"
            data-testid="nav-cta-reserve"
            className="hidden sm:inline-flex items-center rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-on-dark transition-[background-color,transform] duration-300 hover:bg-action-strong hover:-translate-y-0.5"
          >
            {t("nav.book")}
          </Link>
          <button
            type="button"
            data-testid="nav-mobile-toggle"
            aria-label={open ? t("nav.close") : t("nav.open")}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={`md:hidden grid h-11 w-11 place-items-center rounded-full border ${
              overHero ? "border-white/40 text-on-dark" : "border-brand/25 text-ink"
            }`}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {createPortal(<AnimatePresence>
        {open && (
          <motion.div
            data-testid="mobile-menu"
            data-no-translate
            role="dialog"
            aria-label={t("nav.mobile")}
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden fixed inset-x-0 top-[68px] bottom-0 z-[45] bg-ink px-6 pt-10 pb-10 flex flex-col overflow-y-auto"
          >
            <SeasonalDecor theme={seasonalTheme} variant="menu"/><nav className="flex flex-col gap-5" aria-label={t("nav.mobile")}>
              {[{ to: "/", id: "home", tid: "accueil" }, ...NAV].map((n, i) => (
                <motion.div key={n.to} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                  <Link to={n.to} data-testid={`mobile-nav-${n.tid || n.id}`} className="inline-flex items-center gap-3 font-display text-4xl text-on-dark">
                    {n.Icon && <n.Icon size={28} aria-hidden className="text-gold" />}
                    {t(`nav.${n.id}`)}
                  </Link>
                </motion.div>
              ))}
            </nav>
            <GreenGoLink light className="mt-8 self-start" testid="mobile-menu-greengo" />
            <Link
              to="/tarifs-disponibilites#reserver"
              data-testid="mobile-menu-book"
              className="mt-auto inline-flex justify-center rounded-full bg-action px-6 py-4 font-semibold text-on-dark"
            >
              {t("nav.book")}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </header>
  );
}

