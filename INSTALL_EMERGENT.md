# Importer le projet dans Emergent

## Import initial

1. Utiliser le dépôt indépendant `sebastien-beurne/la-cabane-du-chene`, déjà créé et rempli. Ne pas fusionner ce code dans La Cabane des Folies. Pour une copie ultérieure, importer **le contenu de cette racine**, sans `node_modules`, `.git`, les builds ou les fichiers `.env`.
2. Autoriser ce nouveau dépôt dans les intégrations GitHub de ChatGPT et d'Emergent si l'accès est limité à certains dépôts.
3. Dans un nouveau projet Emergent, importer ce dépôt. Demander l'exécution de l'application existante avec [PROMPT_EMERGENT.md](PROMPT_EMERGENT.md), sans régénération graphique ni nouvelle traduction IA.
4. Installer `backend/requirements.txt` et `frontend` avec son `package-lock.json` (`npm ci`).
5. Renseigner les secrets du backend à partir de `backend/.env.example` et l'URL publique dans les valeurs frontend. Chaque projet doit avoir sa base et ses comptes propres.

## Processus attendus

Backend : depuis `backend`, `uvicorn server:app --host 0.0.0.0 --port 8001`.

Frontend en aperçu Emergent : depuis `frontend`, `npm start` (port 3000 ; proxy `/api` vers le backend). En production : `npm run build`, servir `frontend/build` avec fallback SPA vers `index.html`, router `/api/*` vers FastAPI. Les chemins `/images/*` et `/i18n/*` doivent être servis tels quels. Si l'API est sur un domaine différent, définir `REACT_APP_BACKEND_URL` **avant le build**, puis ajouter l'origine frontend à `CORS_ORIGINS`. Ne jamais injecter de secret backend dans le frontend.

Ne pas utiliser `npm run dev` à la racine en production : ce script est un bac à sable jetable avec un propriétaire de démonstration. Le point d'entrée de production est exclusivement **`server:app`**, jamais `preview_api:app`. `PREVIEW_MEMORY_DB` doit être `false`, et `APP_ENV=production`.

## Base et comptes

- MongoDB : base distincte `cabane_du_chene`. Le mode sans Mongo sert uniquement à l'aperçu local. Les cartes cadeaux utilisent des transactions : cluster MongoDB/replica set requis avant activation.
- Administrateur : `ADMIN_EMAIL`, `ADMIN_PASSWORD` (fort et inédit), `JWT_SECRET` (aléatoire, au moins 32 octets). Le premier lancement crée le propriétaire ; changer `ADMIN_PASSWORD` ensuite ne réinitialise pas un compte déjà créé.
- Stripe : nouvelles clés de test du compte Chêne, signature webhook et validation des événements. Voir `backend/payments.py` et les routes du module cartes cadeaux pour le routage. Les paiements réels doivent être activés seulement après une recette Stripe complète et des prix confirmés.
- E-mail : clé, expéditeur autorisé et test vers `EMAIL_TEST_RECIPIENT`. Retirer cette redirection après validation. Sans clé, le message de contact est enregistré, mais aucun envoi ne part.
- Téléversements futurs : stockage objet de l'intégration Emergent, namespace `cabane-du-chene`. La clé `EMERGENT_LLM_KEY` est ici utilisée par le stockage hérité, **pas par un moteur de traduction**. Les 16 médias initiaux sont déjà locaux et n'ont pas besoin de cette clé.

## Ordre avant ouverture

1. Remplir la vraie grille de tarifs, suppléments, taxe et règles de séjour. Petit déjeuner sucré inclus ; option salée publiée à 9 € pour deux. Règlement total à la réservation selon les CGV consultées.
2. Exporter HBook et reprendre les réservations et blocages. Brancher et contrôler chaque iCal. Les flux iCal ne remplacent pas l'historique clients/paiements.
3. Connecter Stripe et l'e-mail du Chêne, tester réservation, confirmation, annulation/remboursement et messages.
4. Valider les conditions et la durée des cartes cadeaux puis tester achat, réception, utilisation partielle et remboursement avant leur activation. Les anciennes cartes éventuelles nécessitent une reprise séparée.
5. Finaliser mentions légales/CGV et vérifier textes FR/EN/DE/NL après toute modification. La traduction des futurs messages libres n'est pas automatique.
6. Recette mobile et paiements sur l'URL de test Emergent. Basculer le domaine seulement après validation ; conserver une sauvegarde WordPress/HBook et un plan de retour.

ANCV : le site historique le mentionne ; cette intégration n'est pas incluse et ne doit pas être présentée comme un moyen de paiement opérationnel.

## Réduire les crédits de construction

Importer ces fichiers terminés. Faire corriger uniquement les incompatibilités de lancement constatées. Réutiliser les dictionnaires et les images fournis. Ne pas relancer une refonte complète ou une traduction IA. Les frais d'hébergement, stockage, e-mails et paiement restent ceux des services choisis ; ils ne sont pas supprimés par les dictionnaires.
