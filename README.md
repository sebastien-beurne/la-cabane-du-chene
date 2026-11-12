# La Cabane du Chêne

Application autonome pour le gîte de Valmunster. Source React / FastAPI / MongoDB réutilisée de La Cabane des Folies, adaptée avec les contenus et photos du site `https://lacabaneduchene.fr`. Ce dossier constitue la racine du **nouveau dépôt** ; il n'est pas à fusionner dans le projet Folies.

## Ce qui est livré

- Pages accueil, cabane, spa, environs avec carte, tarifs/demande de séjour, contact, avis, carte cadeau et pages légales.
- Administration modulaire préremplie : textes, 15 photos (9 hébergement et 6 visites), fond d'accueil, guide, tarifs/options, réservations, calendriers, messages, cartes cadeaux et préparation du lancement. Un logo complète les 16 fichiers média locaux.
- Traductions FR / EN / DE / NL préparées dans le code. Aucun moteur IA, génération à la visite ni abonnement de traduction nécessaire. Les cartes cadeaux ont leur propre adaptateur de traduction réutilisable.
- Photos WebP locales : environ 3,29 Mo au total au lieu de 12,89 Mo pour les originaux. Administration et carte chargées à la demande.
- Modules financiers des cartes cadeaux conservés : débits atomiques, remboursements et re-crédits idempotents, contrôles de paiement et de validité.

## Prévisualiser sans MongoDB

```bash
python -m pip install -r backend/requirements-dev.txt
npm ci --prefix frontend
npm run dev
```

Ouvrir `http://127.0.0.1:3000`. Cette commande utilise `backend/preview_api.py` avec une **base en mémoire jetable** et un administrateur de démonstration accessible à `/admin`. E-mails et paiements externes sont désactivés ; les changements disparaissent au redémarrage. Ne jamais utiliser ce lanceur en production et ne pas le rendre public avec des données clients.

## Héberger

Voir [INSTALL_EMERGENT.md](INSTALL_EMERGENT.md). La version persistante requiert MongoDB ; un replica set ou un cluster compatible transactions est nécessaire pour les opérations de cartes cadeaux liées aux réservations. `backend/server.py` n'active pas la session propriétaire de démonstration.

## Modifier les traductions sans crédits

Les textes source français sont dans `backend/seed/content.json` et `frontend/src/data/site.json`, les libellés dans les composants et `frontend/src/lib/i18n.jsx`. Les catalogues sont dans :

```text
frontend/public/i18n/en.json     backend/i18n/en.json
frontend/public/i18n/de.json     backend/i18n/de.json
frontend/public/i18n/nl.json     backend/i18n/nl.json
```

Les clés sont les textes français. Lorsqu'un texte français change, ajouter sa traduction dans les trois catalogues et copier les mêmes fichiers côté backend pour les e-mails. Mettre à jour la version de cache dans `i18n.jsx`, vérifier les pages puis reconstruire le frontend. Une modification française depuis l'administration ne génère volontairement aucune traduction : il faut préparer les trois versions correspondantes. Les noms propres et les coordonnées restent identiques. L'administration propriétaire est en français.

## Avant de vendre

La grille de prix et les suppléments n'ont pas été inventés. Les demandes de dates sont possibles ; la réservation payante est verrouillée tant que prix et calendriers ne sont pas validés. Les ventes de cartes cadeaux sont désactivées jusqu'à validation des conditions, durée, compte Stripe et service d'e-mails.

À reprendre depuis HBook/WordPress : réservations existantes, dates bloquées, données clients autorisées, flux iCal et éventuelles cartes cadeaux en circulation. Aucun accès privé ni compte Stripe de La Cabane des Folies n'a été copié. ANCV n'est pas encore intégré.

Les pages légales contiennent les données publiques disponibles et des champs à compléter : hébergeur, médiateur, SIRET et validation des conditions. Vérifier aussi les indications d'adresse et de petit déjeuner signalées dans [docs/IMPORT_NOTES.md](docs/IMPORT_NOTES.md).

## Vérifications

```bash
python -m pytest backend/tests/test_migration.py -q
# Pour les tests financiers : MongoDB en replica set jetable, jamais une base réelle.
GIFT_TEST_MONGO_URL='mongodb://127.0.0.1:27017/?replicaSet=test' python -m pytest backend/tests/test_gift_module.py -q
npm ci --prefix validation/gift-cards
npm test --prefix validation/gift-cards -- --runInBand
npm run build --prefix frontend
```

La préparation a passé 51 tests backend (dont 36 financiers sur MongoDB 7 en replica set) et 9 tests React. Voir [docs/VALIDATION.md](docs/VALIDATION.md) pour le périmètre et les limites. Les sources, crédits et empreintes des images figurent dans [docs/assets-manifest.json](docs/assets-manifest.json).
