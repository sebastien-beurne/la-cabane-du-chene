import { Link } from "react-router-dom";
import { Instagram, Facebook, Mail, MapPin, Phone, ArrowUpRight } from "lucide-react";
import { useSite } from "@/lib/site";
import { Logo } from "./Logo";
import { NAV } from "./Navbar";
import { useT } from "@/lib/i18n";

const LEGAL = [
  { to: "/mentions-legales", key: "legal.mentions" },
  { to: "/confidentialite", key: "legal.privacy" },
  { to: "/conditions", key: "legal.terms" },
];

export default function Footer() {
  const { t, td } = useT();
  const g = useSite()?.content?.general || {};
  const platforms = [
    { url: g.airbnb_url, label: "Airbnb" },
    { url: g.booking_url, label: "Booking.com" },
    { url: g.abracadaroom_url, label: "AbracadaRoom" },
    { url: g.greengo_url, label: "GreenGo" },
  ].filter((p) => p.url);

  return (
    <footer data-testid="site-footer" data-no-translate className="relative bg-[#1B2B24] text-[#D9DFDA] pb-28 md:pb-10">
      <div className="mx-auto max-w-7xl px-5 md:px-10 pt-20 grid gap-12 md:grid-cols-12">
        <div className="md:col-span-5 space-y-5">
          <Logo light />
          <p className="max-w-sm text-sm leading-relaxed text-[#C3CCC6]">
            {t("footer.tagline")}
          </p>
          <div className="flex gap-3">
            {g.instagram && (
              <a href={g.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" data-testid="footer-instagram" className="grid h-10 w-10 place-items-center rounded-full border border-white/20 hover:bg-white/10">
                <Instagram size={16} />
              </a>
            )}
            {g.facebook && (
              <a href={g.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" data-testid="footer-facebook" className="grid h-10 w-10 place-items-center rounded-full border border-white/20 hover:bg-white/10">
                <Facebook size={16} />
              </a>
            )}
          </div>
        </div>
        <div className="md:col-span-3">
          <p className="text-xs uppercase tracking-[0.24em] text-[#E3B48A] mb-5">{t("footer.gite")}</p>
          <ul className="space-y-3 text-sm">
            {NAV.map((n) => (
              <li key={n.to}><Link to={n.to} className="hover:text-white" data-testid={`footer-link-${n.id}`}>{t(`nav.${n.id}`)}</Link></li>
            ))}
            <li><Link to="/tarifs-disponibilites#faq" className="hover:text-white" data-testid="footer-link-faq">{t("footer.faq")}</Link></li>
            <li><Link to="/livret-accueil" className="hover:text-white" data-testid="footer-link-livret">{t("footer.livret")}</Link></li>
          </ul>
        </div>
        <div className="md:col-span-4 space-y-3 text-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-[#E3B48A] mb-5">{t("footer.reach")}</p>
          <p className="flex items-center gap-3"><MapPin size={16} /> {td(g.city || "Valmunster")}, {td(g.region || "Moselle, Lorraine")}, {td(g.country || "France")}</p>
          {g.email && <a href={`mailto:${g.email}`} data-testid="footer-email" className="flex items-center gap-3 hover:text-white"><Mail size={16} /> {g.email}</a>}
          {g.phone && <a href={`tel:${g.phone.replace(/\s/g, "")}`} data-testid="footer-phone" className="flex items-center gap-3 hover:text-white"><Phone size={16} /> {g.phone}</a>}
          {platforms.length > 0 && (
            <div className="pt-4 flex flex-wrap gap-2">
              {platforms.map((p) => (
                <a key={p.label} href={p.url} target="_blank" rel="noreferrer" data-testid={`footer-platform-${p.label.toLowerCase()}`} className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">
                  {p.label} <ArrowUpRight size={12} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-5 md:px-10 mt-16 pt-6 border-t border-white/10 flex flex-col md:flex-row gap-4 justify-between text-xs text-[#AEB9B2]">
        <p>© {new Date().getFullYear()} La Cabane du Chêne — Valmunster</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {LEGAL.map((l) => <Link key={l.to} to={l.to} className="hover:text-white">{t(l.key)}</Link>)}
          <Link to="/admin" data-testid="footer-admin-link" className="hover:text-white">{t("footer.owner")}</Link>
        </div>
      </div>
    </footer>
  );
}

