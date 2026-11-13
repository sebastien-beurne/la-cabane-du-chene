# Railway — la-cabane-du-chene

Branche : `deploy/railway`. Configuration technique normale pour ce dépôt, distincte du POC des Folies. Aucune fusion vers `main`, aucune donnée des Folies et aucune ressource Railway ne sont créées automatiquement.

## Installation

1. Créer un projet Railway distinct pour ce dépôt.
2. Créer `Mongo`, branché sur `deploy/railway`, fichier de configuration `deploy/railway/mongo.railway.json`, volume `/data/db`. Définir `MONGO_ADMIN_PASSWORD` (secret hexadécimal aléatoire, pour éviter les caractères réservés dans l’URI) et `MONGO_KEYFILE` (clé aléatoire en base64). Aucun port Mongo public.
3. Pour Mongo, limiter les watch patterns à `/deploy/railway/mongo-start.sh` et `/deploy/railway/mongo.Dockerfile`.
4. Créer `Site`, branché sur `deploy/railway`, fichier de configuration `deploy/railway/site.railway.json`, volume `/app/media`. L’URL publique utilise le port 8080.
5. Renseigner les variables de `site.env.example` : e-mail administrateur/propriétaire, mot de passe initial d’au moins 12 caractères, JWT_SECRET aléatoire d’au moins 32 caractères, SITE_URL et CORS_ORIGINS égaux à l’URL HTTPS du site sans slash final. Les références Mongo désignent le nouveau service de ce projet, et la base doit s’appeler `chene_railway`.
6. Vérifier `/api/health`, connexion administrateur, médias et disponibilités avant toute bascule de domaine.

Le Mongo authentifié utilise une réplique unique `rs0`, un utilisateur `appadmin`, un membre `localhost:27017` et `directConnection=true` côté application. Ce montage prend en charge les transactions des cartes cadeaux. Il ne fournit pas de haute disponibilité ; prévoir sauvegardes et restauration testée. Une seule instance du site utilise son volume média local.

## Paiements et e-mails

La configuration standard conserve les synchronisations iCal normales, sans bannière d’essai ni en-tête `noindex` ajouté par le serveur. Les clés Stripe de test **ou réelles** sont prises en charge ; sans clé, le checkout est refusé avec 503.

Les exemples laissent Stripe et les e-mails non configurés. Avant activation : utiliser le compte Stripe propre à ce site, enregistrer le webhook correspondant et son secret, tester les parcours. Pour les e-mails, renseigner la clé du fournisseur existant `EMERGENT_EMAIL_KEY`, les coordonnées d’expédition puis passer `EMAIL_DELIVERY_MODE` de `disabled` à `enabled`. La migration n’a pas remplacé ce fournisseur d’e-mails. Les traductions locales et le stockage média fonctionnent sans crédits Emergent.

Le cron d’e-mails reste protégé par un secret `WEBHOOK_CRON_SECRET` aléatoire. L’accès administratif conserve l’authentification. Ne copier aucune clé de production des Folies.

## Contenus et sauvegardes

Le contenu, les images intégrées et les règles métier du dépôt sont conservés. Le template reste vierge et démarre par l’administration avant activation du site public.
Les photos, PDF et vidéos téléversés sont stockés dans `/app/media`, indépendamment du stockage objet Emergent ; les tailles d’image manquantes se régénèrent. Sauvegarder **MongoDB avec ses index ET le volume média**, puis tester une restauration dans un environnement distinct. Aucun import de données de production n’est lancé par cette branche.

## Validation

```sh
PYTHONPATH=backend python -m pytest backend/tests -q
npm --prefix frontend ci --legacy-peer-deps
REACT_APP_RAILWAY=true npm --prefix frontend run build
```

Les tests transactionnels nécessitent un Mongo de test jetable via `GIFT_TEST_MONGO_URL` ; sinon ils sont explicitement ignorés. Docker n’est pas requis pour les tests applicatifs locaux mais reste nécessaire pour vérifier l’image complète avant déploiement.

## Branches et intégrations

`main` conserve la compatibilité avec les imports/synchronisations Emergent. Aucun renommage de `main` n’est appliqué tant que la branche cible de ces intégrations n’est pas vérifiée. Les branches Railway des Folies restent inchangées.

Validation du 13 novembre 2026 : 40 tests réussis, 26 tests transactionnels ignorés faute de MongoDB de test dédié ; compilation Vite réussie avec le mode Railway. L’image Docker complète n’a pas été exécutée localement (Docker indisponible). Aucun déploiement Railway de ce dépôt n’a été lancé.
