import { ICONS } from "@/components/site/Icon";
import { CAT_LABELS } from "@/components/site/Gallery";

const T = (key, label, extra = {}) => ({ key, label, type: "text", ...extra });
const A = (key, label, extra = {}) => ({ key, label, type: "textarea", ...extra });
const CATS = Object.entries(CAT_LABELS).map(([value, label]) => ({ value, label }));
const GUIDE = ["Visites culturelles", "Villages de charme", "Nature", "Gastronomie", "Sorties"];

export const PRICING = [
  {title:"Taxe de séjour",base:"pricing",help:"Montant fixe par personne assujettie et par nuit, taxes additionnelles incluses. Vérifiez le barème de votre collectivité avant activation. Les moins de 18 ans et autres personnes exonérées ne sont pas comptés. Si votre barème est proportionnel (hébergement non classé), ne pas activer ce calcul fixe.",fields:[
    {key:"tourist_tax_enabled",label:"Ajouter la taxe de séjour au prix final",type:"bool"},
    T("tourist_tax_per_night","Tarif total par personne et par nuit (€)",{placeholder:"ex. 0,88"}),
  ]},
  { title: "Cartes cadeaux", base: "gifts", help: "Les ventes sont bloquées jusqu’à validation des conditions et connexion du compte Stripe et de l’envoi d’e-mails.", fields: [
    T("amounts", "Montants proposés (séparés par des virgules)"), T("min_amount", "Montant minimum (€)"), T("max_amount", "Montant maximum (€)"),
    T("validity_days", "Validité en jours (à faire confirmer)"), A("terms", "Conditions spécifiques des cartes cadeaux"),
    { key: "conditions_confirmed", label: "Conditions et validité confirmées", type: "bool" },
    { key: "sales_enabled", label: "Activer la vente en ligne (connexions requises)", type: "bool" },
  ] },
  {
    title: "Tarifs", base: "pricing", help: "Laissez vide ce qui n'est pas encore défini : rien d'inventé ne s'affichera sur le site.",
    fields: [
      { key: "rates", label: "Grille pour 1 à 2 personnes (prix total du séjour)", help: "La plus grande durée de la grille = durée maximale réservable en direct.", type: "list", item: [T("nights", "Nombre de nuits"), T("price", "Prix total (€)")] },
      T("base_guests", "Personnes incluses dans le prix de base"),
      T("extra_guest_per_night", "Supplément par personne supplémentaire et par nuit (€)"),
      T("max_guests", "Nombre maximum de personnes"),
      T("breakfast_price", "Prix petit-déjeuner supplémentaire (0 € si inclus)"),
      T("deposit_percent", "Règlement demandé (% du total ; Chêne : 100 %)"),
      T("price_per_night", "Ancien tarif par nuit (affiché seulement si la grille est vide)", { placeholder: "ex. 120 €" }),
      T("min_nights", "Nombre minimum de nuits", { placeholder: "ex. 2 nuits" }),
      { key: "breakfast_included", label: "Petit déjeuner inclus", type: "bool" },
      { key: "confirmed", label: "Grille tarifaire validée pour la réservation en ligne", type: "bool" },
      { key: "calendar_confirmed", label: "Réservations et calendriers repris / vérifiés", type: "bool" },
      T("checkin", "Heure d'arrivée"),
      T("checkout", "Heure de départ", { placeholder: "ex. Avant 11 h" }),
      { key: "seasons", label: "Variations selon la saison", type: "list", item: [T("name", "Nom (ex. Haute saison)"), T("period", "Période"), T("price", "Tarif")] },
      { key: "fees", label: "Frais éventuels", type: "list", item: [T("label", "Libellé (ex. Ménage)"), T("amount", "Montant")] },
      { key: "options", label: "Options payantes", type: "list", item: [T("label", "Option"), T("price", "Prix"), T("note", "Précision"), { key: "active", label: "Proposée actuellement", type: "bool" }] },
      A("cancellation", "Conditions d'annulation et de remboursement"),
      A("payment_note", "Information paiement"),
    ],
  },
];

export const CONTENT = [
  { title: "Page d'accueil", base: "home", fields: [T("intro_title", "Titre concept"), A("intro_text", "Texte concept"), T("bath_title", "Titre bain nordique"), A("bath_text", "Texte bain nordique"), T("surroundings_title", "Titre des environs"), A("surroundings_text", "Texte des environs"), T("cta_title", "Titre appel final"), A("cta_text", "Texte appel final", { rows: 3 })] },
  {
    title: "La cabane", base: "cabin",
    fields: [
      A("intro", "Introduction", { rows: 3 }), T("capacity", "Capacité (affichée si renseignée)", { placeholder: "ex. 4 personnes" }), T("surface", "Surface (affichée si renseignée)"), T("equipment", "Équipements principaux (séparés par des virgules, vider pour masquer)", { placeholder: "Terrasse & pergola, Bain nordique, Cuisine tout équipée, Climatisation" }), A("shared_garden", "Texte jardin & extérieurs"),
      { key: "spaces", label: "Espaces", type: "list", item: [T("title", "Titre"), A("text", "Description", { rows: 3 }), { key: "category", label: "Photo utilisée (catégorie)", type: "select", options: CATS }, T("features", "Équipements (séparés par des virgules)")] },
    ],
  },
  { title: "Équipements", base: null, fields: [{ key: "equipments", label: "Liste des équipements", type: "list", item: [{ key: "icon", label: "Icône", type: "select", options: Object.keys(ICONS) }, T("label", "Libellé")] }] },
  {
    title: "Bain nordique", base: "bath",
    fields: [A("intro", "Introduction"), A("heating", "Chauffe et préparation"), { key: "moments", label: "Moments", type: "list", item: [T("title", "Titre"), A("text", "Texte", { rows: 2 })] }, { key: "rules", label: "Règles d'utilisation", type: "strings" }, { key: "safety", label: "Consignes de sécurité", type: "strings" }],
  },
  { title: "Questions fréquentes", base: null, fields: [{ key: "faq", label: "Questions", type: "list", item: [T("q", "Question"), A("a", "Réponse", { rows: 3 })] }] },
];

export const REVIEWS = [
  { title: "Avis clients", base: null, help: "Cliquez sur « Ajouter » pour chaque avis, puis sur « Enregistrer » en bas. Ajoutez uniquement des avis authentiques (copiés depuis Airbnb, Google…). Les flèches changent l'ordre d'affichage.", fields: [{ key: "reviews", label: "Avis", type: "list", item: [T("author", "Prénom"), A("text", "Avis", { rows: 3 }), { key: "rating", label: "Note", type: "select", options: ["5", "4", "3", "2", "1"] }, T("date", "Date du séjour (facultatif)"), T("source", "Source (ex. Airbnb)"), { key: "active", label: "Afficher sur le site", type: "bool" }] }] },
];

export const VIDEOS = [
  { title: "Vidéos de présentation", base: null, help: "Cliquez sur « Ajouter », puis collez un lien YouTube ou envoyez un fichier vidéo depuis votre ordinateur ou téléphone (MP4, MOV ou WebM, 150 Mo max.). Pensez à « Enregistrer » en bas. Aucune lecture automatique.", fields: [{ key: "videos", label: "Vidéos", type: "list", item: [T("title", "Titre"), { key: "url", label: "Vidéo", type: "video" }, { key: "active", label: "Afficher", type: "bool" }] }] },
  { title: "Titre de la section", base: "home", fields: [T("videos_title", "Titre de la section vidéo (page d'accueil)")] },
];

export const HERO = [
  {
    title: "Fond de la page d'accueil", base: "home", help: "Choisissez une photo (ajoutez-la d'abord dans l'onglet Photos), puis réglez le rendu. L'aperçu se met à jour avant publication.",
    fields: [
      { key: "hero_image", label: "Photo de fond", type: "image" },
      { key: "hero_overlay", label: "Voile sombre (lisibilité du texte)", type: "range", min: 0, max: 90 },
      { key: "hero_position", label: "Cadrage de l'image", type: "select", options: [{ value: "center", label: "Centré" }, { value: "top", label: "Haut" }, { value: "bottom", label: "Bas" }, { value: "left", label: "Gauche" }, { value: "right", label: "Droite" }] },
      { key: "hero_watermark", label: "Filigrane du logo", type: "bool" },
      T("hero_title", "Grand titre"), A("hero_subtitle", "Sous-titre", { rows: 3 }),
    ],
  },
];

export const GUIDE_BLOCKS = [
  { title: "Guide Moselle & environs", base: null, help: "Images : choisissez parmi votre photothèque (onglet Photos, catégorie « Guide »).", fields: [{ key: "places", label: "Lieux", type: "list", item: [T("name", "Nom du lieu"), { key: "category", label: "Catégorie", type: "select", options: GUIDE }, A("text", "Présentation", { rows: 3 }), { key: "image", label: "Image", type: "image" }, T("url", "Site officiel (https://…)"), T("maps", "Lien Google Maps"), T("coords", "Position sur la carte de la page (latitude, longitude — vide = absent de la carte)", { placeholder: "49.243239, 6.503507" })] }] },
];

export const SETTINGS = [
  {
    title: "Coordonnées & liens", base: "general",
    fields: [T("email", "E-mail affiché"), T("phone", "Téléphone (facultatif)"), T("public_address", "Adresse publique (laisser vide pour ne pas l'afficher)"), T("maps_query", "Recherche carte (ex. Valmunster, France)"), T("instagram", "Instagram (URL)"), T("facebook", "Facebook (URL)"), T("airbnb_url", "Annonce Airbnb"), T("booking_url", "Annonce Booking.com"), T("abracadaroom_url", "Annonce AbracadaRoom"), T("greengo_url", "Annonce GreenGo (bouton « Retrouvez-nous également sur GreenGo »)"), T("ga_id", "Google Analytics / Tag Manager (facultatif, vide = désactivé)"), T("gsc_verification", "Google Search Console (code de vérification)")],
  },
  { title: "Informations pratiques d'arrivée", base: "practical", fields: [A("arrival", "Arrivée", { rows: 3 }), A("parking", "Stationnement", { rows: 2 }), A("keybox", "Accès / boîte à clés (public)", { rows: 2, help: "Ne mettez pas le code de la boîte à clés ici : ce texte est public." }), A("directions", "Itinéraire", { rows: 2 })] },
  { title: "Calendriers externes (iCal)", base: "ical", help: "Collez les liens d'export iCal de vos annonces pour bloquer automatiquement les dates déjà réservées.", fields: [T("airbnb", "Lien iCal Airbnb"), T("booking", "Lien iCal Booking.com"), T("abracadaroom", "Lien iCal AbracadaRoom"), T("greengo", "Lien iCal GreenGo"), T("other", "Autre lien iCal")] },
  { title: "Informations légales", base: "legal", fields: [T("operator_name", "Nom / raison sociale de l'exploitant"), T("legal_status", "Statut juridique"), T("siret", "SIRET"), T("address", "Adresse de l'exploitant (mentions légales)"), T("registration_number", "N° d'enregistrement meublé de tourisme"), T("publication_director", "Directeur de la publication"), T("host_name", "Hébergeur du site"), T("host_address", "Adresse de l'hébergeur"), T("mediator", "Médiateur de la consommation"), A("cgv_extra", "Conditions complémentaires")] },
];

