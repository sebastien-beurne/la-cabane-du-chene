# Thèmes saisonniers et publication

Collections : printemps, été, automne, hiver, Halloween, Noël, Pâques et Saint-Valentin. Les chartes d’origine du dépôt sont conservées. Le template reste vierge.

Les dessins au trait sont limités à deux motifs par zone. Le menu mobile affiche un seul motif dans une bande latérale réservée. Les décorations n’interceptent aucun clic et ne sont pas annoncées aux lecteurs d’écran. Sur les petites pages, aucun décor flottant ne recouvre le contenu ; le bandeau saisonnier réserve sa marge.

Le choix se publie via `PUT /api/admin/appearance`, réservé au propriétaire. Les éditeurs de textes/tarifs ne peuvent plus écraser un thème publié depuis un autre écran. L’aperçu complet utilise `?theme-preview=<identifiant>` et ne publie rien. Le template utilise `/apercu` pour respecter son accueil fermé tant qu’il n’est pas configuré.

Un changement publié rafraîchit les onglets publics. Le retour dans l’administration ne remplace plus les brouillons par une réponse publique. Une réponse réseau ancienne ne peut pas écraser un thème récemment publié et une panne passagère garde le dernier contenu chargé.

Validation : compilation des trois interfaces, tests des palettes et des décorations, conservation des brouillons et du contenu chargé, refus des thèmes inconnus et conservation des données métier. Les tests transactionnels Mongo restent conditionnés à un serveur de test dédié. Seul le POC Railway des Folies est redéployé pour la recette en ligne.
