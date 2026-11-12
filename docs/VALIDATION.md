# Recette du 12 novembre 2026

## Vérifié

- Build Vite de production réussi. Les cartes et l'administration sont dans des chunks séparés. Le build signale encore des chunks supérieurs à 500 Ko : ce n'est pas un audit Lighthouse ni une garantie de performance d'hébergement.
- 15 tests de migration : contenus du Chêne, règles commerciales, médias locaux et séparation galerie/guide, cohérence des catalogues, API publique, authentification, modification du contenu, enregistrement des messages, garde de vente et refus du propriétaire de démonstration hors du bac à sable.
- 36 tests financiers du module cartes cadeaux sur un MongoDB 7.0.14 en replica set jetable : validations, débit concurrent, idempotence, re-crédit, remboursement et contraintes de validité.
- 9 tests React du module cartes cadeaux.
- Contrôles de navigateur : pages publiques, administration Préparation/Textes/Tarifs, versions EN/DE/NL de l'accueil et des cartes cadeaux, dates en anglais et passage au formulaire de contact avec les dates conservées. 33 contrôles des pages secondaires EN/DE/NL n’ont plus d’avertissement de texte manquant ; les détails sont dans browser-validation.json. Les captures du dossier PDF proviennent du navigateur exécutant le projet.

Les tests financiers n'appellent pas un vrai paiement Stripe : les dépendances de paiement sont simulées. La prévisualisation utilise des données jetables sans e-mails externes. La vue mobile vérifiée est une iframe de 390 px de largeur ; elle ne remplace pas une recette sur iPhone/Android physiques.

## Non validé en production

Pas de déploiement réel, connexion Stripe, envoi e-mail réel, import HBook, reprise de cartes cadeaux existantes ni ANCV. Les indisponibilités réelles et la grille tarifaire n'ont pas été reprises depuis des accès privés. Pas de charge/concurrence d'hébergement, de mesure mémoire du serveur Emergent ou de garantie d'absence d'erreur sur tous les futurs contenus édités.

La traduction est préparée dans le code, sans appel IA. Après un changement des textes français depuis l'administration, les traductions correspondantes doivent être préparées dans les catalogues et reconstruites ; elles ne sont pas générées automatiquement. Les e-mails et erreurs dynamiques doivent être relus dans les quatre langues pendant la recette des transactions connectées.

## Ouverture

Utiliser la page administrative Préparation et INSTALL_EMERGENT.md. Ouvrir les paiements uniquement après validation des prix, calendriers, connexions et conditions.
