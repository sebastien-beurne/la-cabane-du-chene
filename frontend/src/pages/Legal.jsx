import { useSite } from "@/lib/site";
import Seo from "@/components/site/Seo";

function Fill({ v, label }) {
  if (v) return <>{v}</>;
  return <mark className="rounded bg-[#B35432]/10 px-1.5 py-0.5 text-[#944125]">[À compléter : {label}]</mark>;
}

function Sec({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl md:text-3xl font-medium text-[#1B2B24]">{title}</h2>
      <div className="space-y-3 leading-relaxed text-[#33423A]">{children}</div>
    </section>
  );
}

function Mentions({ l, g }) {
  return (
    <>
      <Sec title="Éditeur du site">
        <p>Nom ou raison sociale : <Fill v={l.operator_name} label="nom de l'exploitant" /></p>
        <p>Statut juridique : <Fill v={l.legal_status} label="statut juridique" /></p>
        <p>SIRET : <Fill v={l.siret} label="numéro SIRET" /></p>
        <p>Adresse : <Fill v={l.address} label="adresse de l'exploitant" /></p>
        <p>Contact : {g.email}</p>
        <p>Numéro d'enregistrement du meublé de tourisme : <Fill v={l.registration_number} label="numéro d'enregistrement (si applicable)" /></p>
        <p>Directeur de la publication : <Fill v={l.publication_director} label="nom du directeur de la publication" /></p>
      </Sec>
      <Sec title="Hébergement du site">
        <p>Hébergeur : <Fill v={l.host_name} label="nom de l'hébergeur" /></p>
        <p>Adresse : <Fill v={l.host_address} label="adresse de l'hébergeur" /></p>
      </Sec>
      <Sec title="Propriété intellectuelle">
        <p>Les textes et photographies de La Cabane du Chêne sont la propriété de l'exploitant, sauf mention contraire. Certaines images signalées « image d'illustration » ne représentent pas le gîte.</p>
      </Sec>
    </>
  );
}

function Privacy({ g, l }) {
  return (
    <>
      <Sec title="Responsable du traitement">
        <p><Fill v={l.operator_name} label="nom de l'exploitant" />, joignable à {g.email}.</p>
      </Sec>
      <Sec title="Données collectées">
        <p>Via le formulaire de contact : nom, adresse e-mail, téléphone (facultatif) et message. Via la demande de réservation : nom, prénom, adresse e-mail, téléphone, adresse postale, dates de séjour, nombre de voyageurs et message. Aucune donnée bancaire n'est collectée sur ce site.</p>
        <p>Finalité : répondre à votre demande et organiser votre séjour. Base légale : mesures précontractuelles prises à votre demande.</p>
      </Sec>
      <Sec title="Durée de conservation">
        <p>Les demandes sont conservées le temps nécessaire au traitement de votre demande puis au maximum 3 ans après le dernier contact, sauf obligation légale contraire.</p>
      </Sec>
      <Sec title="Destinataires">
        <p>Vos données sont destinées uniquement à l'exploitant. Elles transitent par nos prestataires techniques (hébergement du site, envoi d'e-mails) et ne sont jamais revendues.</p>
      </Sec>
      <Sec title="Vos droits">
        <p>Vous disposez d'un droit d'accès, de rectification, d'effacement, d'opposition et de limitation. Pour l'exercer, écrivez à {g.email}. Vous pouvez également saisir la CNIL (www.cnil.fr).</p>
      </Sec>
      <Sec title="Cookies">
        <p>Ce site n'utilise pas de cookies publicitaires. Un cookie technique sert uniquement à l'espace propriétaire. La carte Google Maps n'est chargée qu'à votre demande.{g.ga_id || process.env.REACT_APP_GTM_ID ? " La mesure d'audience Google Analytics n'est activée qu'avec votre consentement, que vous pouvez retirer en effaçant les données de navigation de ce site." : ""}</p>
      </Sec>
    </>
  );
}

function Conditions({ p, l }) {
  return (
    <>
      <Sec title="Demande et confirmation de réservation">
        <p>Le formulaire du site permet d'envoyer une demande de réservation. Cette demande ne constitue pas une réservation : le séjour est confirmé uniquement après acceptation écrite de l'exploitant, par e-mail.</p>
      </Sec>
      <Sec title="Arrivée et départ">
        <p>Arrivée : {p.checkin || "à partir de 16 h"}. Départ : <Fill v={p.checkout} label="heure de départ" />.</p>
      </Sec>
      <Sec title="Tarifs et paiement">
        <p>Tarif : <Fill v={p.price_per_night} label="tarif par nuit" />. Séjour minimum : <Fill v={p.min_nights} label="nombre minimum de nuits" />.</p>
        <p>{p.payment_note}</p>
      </Sec>
      <Sec title="Annulation et remboursement">
        <p><Fill v={p.cancellation} label="conditions d'annulation et de remboursement" /></p>
      </Sec>
      <Sec title="Bain nordique">
        <p>L'utilisation du bain nordique se fait sous la responsabilité des voyageurs, dans le respect des règles d'utilisation et des consignes de sécurité communiquées.</p>
      </Sec>
      <Sec title="Médiation">
        <p>Médiateur de la consommation : <Fill v={l.mediator} label="médiateur de la consommation" /></p>
      </Sec>
      {l.cgv_extra && <Sec title="Conditions complémentaires"><p className="whitespace-pre-line">{l.cgv_extra}</p></Sec>}
    </>
  );
}

const PAGES = {
  "mentions-legales": { title: "Mentions légales", C: Mentions },
  confidentialite: { title: "Politique de confidentialité & cookies", C: Privacy },
  conditions: { title: "Conditions de réservation & annulation", C: Conditions },
};

export default function Legal({ slug }) {
  const c = useSite()?.content || {};
  const page = PAGES[slug];
  const { C } = page;
  return (
    <>
      <Seo title={`${page.title} — La Cabane du Chêne`} description={`${page.title} du site de La Cabane du Chêne, gîte insolite à Valmunster.`} path={`/${slug}`} />
      <section data-testid={`legal-${slug}`} className="bg-[#FBF9F5] pt-36 pb-24">
        <div className="mx-auto max-w-3xl px-5 md:px-10 space-y-10">
          <h1 className="text-5xl md:text-6xl font-medium leading-[1.02] text-[#1B2B24]">{page.title}</h1>
          <C l={c.legal || {}} g={c.general || {}} p={c.pricing || {}} />
        </div>
      </section>
    </>
  );
}

