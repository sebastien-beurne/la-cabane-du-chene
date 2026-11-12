import { useEffect, useState } from "react";
import { BookOpen, Download, ExternalLink, Loader2 } from "lucide-react";
import Seo from "@/components/site/Seo";
import { Eyebrow } from "@/components/site/Motion";
import { http, img } from "@/lib/api";

export default function Livret() {
  const [b, setB] = useState(null);
  useEffect(() => {
    http.get("/booklet").then((r) => setB(r.data || {})).catch(() => setB({}));
  }, []);
  const url = b?.url ? img(b.url) : "";
  return (
    <>
      <Seo title="Livret d'accueil — La Cabane du Chêne" description="Le livret d'accueil numérique de La Cabane du Chêne à Valmunster : arrivée, équipements, bain nordique et bonnes adresses." path="/livret-accueil" />
      <section data-testid="booklet-page" className="min-h-[100svh] bg-[#FBF9F5] pt-32 md:pt-44 pb-24">
        <div className="mx-auto max-w-5xl px-5">
          <Eyebrow>Livret d'accueil</Eyebrow>
          <h1 className="mt-4 text-4xl sm:text-5xl font-medium leading-[1.05] text-[#1B2B24]">Bienvenue à la cabane</h1>
          <p className="mt-5 max-w-xl text-[#33423A]">Toutes les informations utiles pour votre séjour : arrivée, équipements, bain nordique et nos bonnes adresses autour de Valmunster.</p>
          {!b && <Loader2 className="mt-10 animate-spin text-[#2D4A3E]" />}
          {b && !url && <p className="mt-10 rounded-md bg-white p-6 text-[#526058]" data-testid="booklet-empty">Le livret d'accueil sera bientôt disponible ici.</p>}
          {url && (
            <div className="mt-10 space-y-6">
              <div className="flex flex-wrap gap-3">
                <a href={url} target="_blank" rel="noreferrer" data-testid="booklet-open" className="inline-flex items-center gap-2 rounded-full bg-[#B35432] px-6 py-4 font-semibold text-[#F8F5F0] transition-colors hover:bg-[#944125]">
                  <BookOpen size={18} /> Ouvrir le livret <ExternalLink size={14} />
                </a>
                <a href={url} download="livret-accueil-cabane-du-chene.pdf" data-testid="booklet-download" className="inline-flex items-center gap-2 rounded-full border border-[#2D4A3E]/30 bg-white px-6 py-4 font-semibold text-[#1B2B24] hover:bg-[#EFEAE1]">
                  <Download size={18} /> Télécharger (PDF)
                </a>
              </div>
              <iframe title="Livret d'accueil" src={url} className="hidden md:block h-[80vh] w-full rounded-md border border-[#2D4A3E]/15 bg-white" data-testid="booklet-viewer" />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

