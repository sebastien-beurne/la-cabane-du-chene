import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { useSite } from '@/lib/site';
import { http } from '@/lib/api';

export default function LaunchChecklist() {
  const { content, photos } = useSite();
  const [runtime, setRuntime] = useState({});
  useEffect(() => { http.get('/admin/readiness').then((r) => setRuntime(r.data)).catch(() => {}); }, []);
  const p = content?.pricing || {}, g = content?.gifts || {}, legal = content?.legal || {};
  const items = [
    ['Textes et coordonnées de Valmunster', !!content?.general?.email, 'Préremplis depuis le site existant.'],
    ['Photos du Chêne importées', photos.length >= 10, `${photos.length} visuels disponibles dans la photothèque.`],
    ['Tarifs et suppléments validés', p.confirmed && p.rates?.some((r) => Number(r.price) > 0), 'Renseigner la grille réelle dans Tarifs & options.'],
    ['Réservations et calendriers repris', p.calendar_confirmed, 'Reprendre les réservations HBook et les flux iCal avant d’ouvrir les disponibilités.'],
    ['Compte de paiement connecté', runtime.stripe_configured, 'Utiliser le compte Stripe propre au Chêne ; ANCV nécessite une intégration séparée.'],
    ['Envoi d’e-mails connecté', runtime.email_configured, 'Vérifier l’expéditeur et un envoi réel de test.'],
    ['Transactions MongoDB disponibles', runtime.mongo_transactions, 'Requis pour débiter et recréditer les cartes cadeaux avec une réservation.'],
    ['Conditions des cartes cadeaux validées', g.conditions_confirmed && Number(g.validity_days) > 0, 'Définir la validité et les conditions avant d’activer la vente.'],
    ['Informations légales complétées', !!(legal.siret && legal.mediator && legal.host_name), 'SIRET, hébergeur, médiateur et mentions à faire confirmer.'],
  ];
  return <section data-testid="launch-checklist" className="space-y-5">
    <div className="rounded-md bg-[#2D4A3E] p-7 text-white"><p className="text-xs uppercase tracking-[.24em] text-[#E3B48A]">Migration préparée</p><h1 className="mt-3 font-display text-4xl">Le Chêne, prêt à prendre racine.</h1><p className="mt-4 text-sm leading-relaxed text-[#D9DFDA]">Les contenus et les modules sont installés. Cette liste distingue ce qui est prérempli des connexions et paramètres à finaliser avant la mise en ligne.</p></div>
    <div className="divide-y divide-[#2D4A3E]/10 rounded-md bg-white px-6">{items.map(([label, ok, note]) => {
      const Icon = ok ? CheckCircle2 : Circle;
      return <div key={label} className="flex gap-4 py-5"><Icon size={22} className={`mt-1 shrink-0 ${ok?'text-[#2D4A3E]':'text-[#B35432]'}`} /><div><h2 className="font-semibold text-[#1B2B24]">{label}</h2><p className="mt-1 text-sm text-[#526058]">{note}</p><span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs ${ok?'bg-[#2D4A3E]/10 text-[#2D4A3E]':'bg-[#B35432]/10 text-[#944125]'}`}>{ok?'Préparé / vérifié':'À compléter'}</span></div></div>;
    })}</div>
  </section>;
}
