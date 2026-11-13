# Administration sur Railway

- **Clients** : annuaire privé issu des réservations, regroupement par e-mail sans distinction de casse. Les réservations sans e-mail restent séparées. Recherche par nom, e-mail ou téléphone et historique paginé. Les dates de création des réservations sont distinguées des dates de séjour.
- **Réservations** : un refus crée une notification client, avec état vérifiable et possibilité de relance. Les notes internes ne sont jamais incluses. Une même transition de refus ne provoque pas plusieurs envois.
- **E-mails auto** : deux modèles privés, « Informations d’arrivée » et « Message de bienvenue » (soir de l’arrivée). Chaque modèle possède son bouton d’enregistrement. Variables : `{prenom}`, `{nom}`, `{arrivee}`, `{depart}`, `{voyageurs}`.
- **Envoi manuel** : depuis une réservation confirmée, ouvrir le message, vérifier l’aperçu personnalisé, puis confirmer. Si les coordonnées ou le modèle changent entre aperçu et envoi, recharger l’aperçu. Aucune programmation automatique n’est activée pour ces deux modèles.
- **Messages** : filtres clients/propriétaire et pastilles avec libellés (bleu/ambre). Les envois désactivés sont journalisés comme « Non envoyé », jamais comme livrés.
- **Corbeilles** : messages reçus, e-mails envoyés et cartes cadeaux peuvent être restaurés. Supprimer un e-mail de l’administration ne le retire pas de la boîte du destinataire. Les cartes dans la corbeille sont inutilisables ; leurs soldes et utilisations restent conservés. Aucun remboursement n’est déclenché. Un paiement en cours doit être fermé avant l’archivage d’une carte.
- **Thèmes** : publier le thème avec le bouton visible en haut du sélecteur. Un motif discret apparaît aussi dans l’en-tête ; le menu mobile ouvert conserve un seul motif. Le retour dans un onglet public recharge la configuration publiée.

## Validation

Tests API dans `backend/tests/test_mail_workflow.py`, `test_clients_and_stay.py` et `test_gift_trash.py`. Tests interface supplémentaires dans `AdminWorkflow.test.jsx` et `Seasonal.test.jsx`. Les tests de transactions monétaires existants nécessitent un MongoDB de test en replica set ; ils ne doivent jamais cibler une base de production.
