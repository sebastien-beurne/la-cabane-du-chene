import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { useT } from "@/lib/i18n";

export default function MobileBookBar() {
  const { t } = useT();
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pathname.startsWith("/tarifs")) return null;
  return (
    <div
      data-testid="mobile-book-bar"
      data-no-translate
      className={`md:hidden fixed inset-x-3 bottom-3 z-40 transition-[transform,opacity] duration-500 ${show ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0"}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-between gap-3 rounded-full bg-[#1B2B24]/95 backdrop-blur-xl pl-5 pr-1.5 py-1.5 shadow-2xl">
        <span className="flex items-center gap-2 text-sm text-[#F8F5F0]"><CalendarDays size={16} /> {t("bar.dates")}</span>
        <Link to="/tarifs-disponibilites#reserver" data-testid="sticky-mobile-cta-book" className="rounded-full bg-[#B35432] px-5 py-3 text-sm font-semibold text-[#F8F5F0]">
          {t("bar.book")}
        </Link>
      </div>
    </div>
  );
}

