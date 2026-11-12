# Import public La Cabane du Chêne

Collecte : 12 novembre 2026.

- `content.json` : contenu structuré réécrit, équipements, contacts, FAQ, carte, environs, règles et incertitudes.
- `assets-manifest.json` : URLs d’origine, chemins `/images/chene/`, dimensions, empreintes SHA-256 et notes de droits.
- `assets/` : 16 WebP locaux (9 photos réelles de la cabane, 6 lieux touristiques, un logo), total 3,29 Mo contre 12,89 Mo d’origine.
- `contact-sheet.jpg` : aperçu technique des médias.

Les tarifs n’ont pas été inventés. Le moteur HBook expose publiquement les saisons mais pas de grille statique suffisante. Les seuls appels effectués au moteur sont des recherches de disponibilité `hb_get_available_accom` : aucune création de réservation, aucun paiement, aucun e-mail. Toute politique commerciale de carte cadeau reste à confirmer ; la vente est à préparer désactivée.

Le site existant affiche ANCV Connect, mais cela ne vaut pas intégration disponible dans le nouveau backend. Les réservations et données clients, flux iCal, secrets Stripe et de messagerie ne sont pas importés. Le repas salé est une option à 9 € par assiette pour deux, le petit-déjeuner sucré est compris. 100 % du séjour à la réservation selon les CGV actuelles.

Incohérences à confirmer : adresse 8 rue de la forêt pour le contact contre 10 rue de la forêt pour les réclamations ; livraison du petit-déjeuner avant 8h30 en FAQ contre à partir de 8h15 en CGV. Les conditions anciennes doivent être relues pour la nouvelle version. Le visuel de Malbrouck mentionne Guillaume Ramon dans son nom de fichier d’origine. Réutiliser les droits existants du site source, sans prétendre acquérir de nouveaux droits.
