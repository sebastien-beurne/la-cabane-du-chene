import { useState } from "react";
import { Car, KeyRound, Mail, MapPin, Navigation, Phone, Clock } from "lucide-react";
import { useSite } from "@/lib/site";
import Seo from "@/components/site/Seo";
import PageHeader from "@/components/site/PageHeader";
import ContactForm from "@/components/site/ContactForm";
import { Reveal, Eyebrow } from "@/components/site/Motion";

function MapBlock({ query }) {
  const [show, setShow] = useState(false);
  const q = encodeURIComponent(query || "8 rue de la forêt, 57220 Valmunster");
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-brand" data-testid="contact-map">
      {show ? (
        <iframe title="Carte de Valmunster" src={`https://www.google.com/maps?q=${q}&output=embed`} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <MapPin className="mx-auto text-gold" size={30} />
            <p className="mt-4 text-sm text-[#D9DFDA] max-w-xs">La carte est fournie par Google Maps, qui peut déposer des cookies.</p>
            <button onClick={() => setShow(true)} data-testid="contact-map-load" className="mt-5 rounded-full bg-paper px-5 py-3 text-sm font-semibold text-ink">Afficher la carte</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Contact() {
  const site = useSite();
  const g = site?.content?.general || {};
  const pr = site?.content?.practical || {};
  const dest = encodeURIComponent(g.public_address || g.maps_query || "8 rue de la forêt, 57220 Valmunster");
  const infos = [
    [Clock, "Arrivée", pr.arrival],
    [Car, "Stationnement", pr.parking],
    [KeyRound, "Accès & boîte à clés", pr.keybox],
    [Navigation, "Itinéraire", pr.directions],
  ].filter(([, , v]) => v);
  return (
    <>
      <Seo title="Contact et accès — La Cabane du Chêne, gîte insolite à Valmunster"
        description="Contactez La Cabane du Chêne, location de charme à Valmunster (Moselle) : formulaire, e-mail, carte et informations pratiques d'arrivée."
        path="/contact" />
      <PageHeader testid="contact-header" eyebrow="Contact & accès" title="Une question ? Écrivez-nous" photo={site?.pick("pergola", "jardin")} />
      <section className="bg-canvas py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 md:px-10 grid gap-16 lg:grid-cols-12">
          <Reveal className="lg:col-span-5 space-y-8">
            <div>
              <Eyebrow>La Cabane du Chêne</Eyebrow>
              <p className="mt-4 flex items-center gap-3 text-lg text-ink"><MapPin size={18} /> {g.public_address || `${g.city || "Valmunster"}, Moselle, ${g.country || "France"}`}</p>
              {g.email && <a href={`mailto:${g.email}`} data-testid="contact-email" className="mt-3 flex items-center gap-3 text-lg text-ink hover:text-action"><Mail size={18} /> {g.email}</a>}
              {g.phone && <a href={`tel:${g.phone.replace(/\s/g, "")}`} data-testid="contact-phone" className="mt-3 flex items-center gap-3 text-lg text-ink hover:text-action"><Phone size={18} /> {g.phone}</a>}
            </div>
            <MapBlock query={g.public_address || g.maps_query} />
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${dest}`} target="_blank" rel="noreferrer" data-testid="contact-directions"
              className="inline-flex items-center gap-2 rounded-full border border-brand/30 px-5 py-3 text-sm font-semibold text-ink hover:bg-brand hover:text-on-dark transition-colors">
              <Navigation size={16} /> Itinéraire Google Maps
            </a>
            {infos.length > 0 && (
              <div data-testid="practical-info" className="rounded-md bg-sand p-6 space-y-5">
                <h2 className="text-2xl font-medium text-ink">Informations pratiques</h2>
                {infos.map(([I, l, v]) => (
                  <div key={l} className="flex gap-4"><I size={18} className="mt-1 shrink-0 text-action" /><div><p className="text-sm font-semibold text-ink">{l}</p><p className="text-sm leading-relaxed text-body">{v}</p></div></div>
                ))}
              </div>
            )}
          </Reveal>
          <Reveal className="lg:col-span-7" delay={0.1}>
            <h2 className="text-4xl md:text-5xl font-medium text-ink mb-8">Envoyer un message</h2>
            <ContactForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}

