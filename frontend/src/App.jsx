import ThemeFrame from '@/components/site/ThemeFrame';
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { SiteProvider } from "@/lib/site";
import { LangProvider } from "@/lib/i18n";
import Navbar from "@/components/site/Navbar";
import Footer from "@/components/site/Footer";
import MobileBookBar from "@/components/site/MobileBookBar";
import SmoothScroll from "@/components/site/SmoothScroll";
import CookieConsent from "@/components/site/CookieConsent";
import Home from "@/pages/Home";
const Cabane = lazy(() => import("@/pages/Cabane"));
const Bain = lazy(() => import("@/pages/Bain"));
const Tarifs = lazy(() => import("@/pages/Tarifs"));
const Contact = lazy(() => import("@/pages/Contact"));

// Heavy or rarely visited pages are loaded on demand (map, charts, admin, payment).
const Valmunster = lazy(() => import("@/pages/Environs"));
const Legal = lazy(() => import("@/pages/Legal"));
const Admin = lazy(() => import("@/pages/Admin"));
const Paiement = lazy(() => import("@/pages/Paiement"));
const Avis = lazy(() => import("@/pages/Avis"));
const CarteCadeau = lazy(() => import("@/pages/CarteCadeau"));
const Livret = lazy(() => import("@/pages/Livret"));

function Shell() {
  const { pathname } = useLocation();
  const admin = pathname.startsWith("/admin");
  return (
    <ThemeFrame>
      <SmoothScroll />
      {!admin && <Navbar />}
      <main>
        <Suspense fallback={<div className="min-h-[100svh] bg-[#FBF9F5]" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/la-cabane" element={<Cabane />} />
          <Route path="/bain-nordique" element={<Bain />} />
          <Route path="/a-voir-dans-les-environs" element={<Valmunster />} />
          <Route path="/tarifs-disponibilites" element={<Tarifs />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/mentions-legales" element={<Legal slug="mentions-legales" />} />
          <Route path="/confidentialite" element={<Legal slug="confidentialite" />} />
          <Route path="/conditions" element={<Legal slug="conditions" />} />
          <Route path="/avis-clients" element={<Avis />} />
          <Route path="/carte-cadeau" element={<CarteCadeau />} />
          <Route path="/carte-cadeau/merci" element={<CarteCadeau />} />
          <Route path="/livret-accueil" element={<Livret />} />
          <Route path="/paiement/:token" element={<Paiement />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Home />} />
        </Routes>
        </Suspense>
      </main>
      {!admin && <Footer />}
      {!admin && <MobileBookBar />}
      {!admin && <CookieConsent />}
      <div data-no-translate><Toaster position="top-center" richColors /></div>
    </ThemeFrame>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SiteProvider>
        <LangProvider>
          <Shell />
        </LangProvider>
      </SiteProvider>
    </BrowserRouter>
  );
}

