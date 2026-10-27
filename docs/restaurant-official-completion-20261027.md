# Enrichissement officiel additionnel — 27 octobre 2026

Base : 03095cf264df1f5fc3c4956863ff70e2c191c85d. Branche : fix/restaurant-enrichment-official-20261027.

## Informations récupérées

Le Pasturier : ajout au catalogue d'une description reformulée depuis la carte officielle : restaurant du centre de Gap, cuisine saisonnière utilisant des produits frais et locaux, inspirée du terroir des Hautes-Alpes. Provenance : https://www.restaurantlepasturier.com/carte-tradtionnelle-et-de-saison/ ; consultation du contenu source dans la mission précédente du même jour. Les horaires, tarifs, menus, téléphone disponible dans Geoapify, lien de demande de réservation et dates précédentes ne sont pas remplacés. La description a sa propre date du 27 octobre et sa propre source.

La Luye : aucune nouvelle information métier n'a été confirmée. Une recherche manuelle gratuite a trouvé une piste sur la page officielle https://all.accor.com/hotel/1120/index.fr.shtml : restaurant de l'ibis Gap Centre, aujourd'hui nommé Le Restaurant / Ibis Kitchen, adresse 5/7 boulevard Georges Pompidou. Le point Geoapify porte le nom Le Restaurant la Luye et les reprises OpenStreetMap indiquent une autre numérotation. Malgré la proximité, cela ne suffit pas à confirmer l'identité. Aucun horaire, prix, téléphone ou lien de réservation de l'hôtel n'est transféré à La Luye. Les résultats concernant SAS LA LUYE au boulevard d'Orient sont un homonyme distinct et ne sont pas utilisés.

Une seule exécution réelle du moteur amélioré, sur la fiche Geoapify conservée, a lu au maximum deux candidats : website=null, reason=identity_not_confirmed, candidates_checked=2. Aucun nouvel appel Geoapify. Le résultat est conservé en fichier de travail, sans modification de base.

## Amélioration commune aux deux rubriques

Le catalogue reste la base. Les miniatures ne lancent aucune consultation additionnelle pour un restaurant du catalogue. À l'ouverture explicite de la fiche ou du dépliant, un champ manquant peut désormais être complété depuis le lecteur officiel, avec l'identité complète du lieu. Les champs du catalogue déjà présents restent prioritaires ; les sources sont cumulées et les photos autorisées sont conservées. Les demandes partagent cache et requête en cours ; une fiche déjà complète ne déclenche pas de lecture. Les échecs de complément sont conservés cinq minutes sans effacer les faits connus.

Le lecteur consulte aussi un site déjà corroboré avant de revenir à la corroboration seule en cas d'identité non confirmée ou de source inaccessible. Aucune information brute non vérifiée n'est transférée par ce repli.

La recherche gratuite évite le nom dupliqué dans l'adresse et normalise les préfixes génériques (Le Restaurant la Luye / La Luye). Le domaine n'est plus obligé de contenir le préfixe Restaurant. Les pages de la chaîne officielle Accor peuvent être examinées, mais restent des candidates uniquement : le lecteur général ne doit pas importer des tarifs d'hôtel dans une fiche restaurant. Les contrôles d'adresse, ville et distance restent stricts. Les noms entièrement génériques sont refusés. Budget conservé : une recherche RSS, maximum deux pages candidates, cache six heures pour une correspondance et cinq minutes pour un échec ; pas d'API payante.

V2/V3, dépliant et carte : composants conservés. Recherche Geoapify, rayons, filtres, sorties, inscriptions, réservations, Supabase et MyEvent-API inchangés.

## Validation

Quatre nouveaux scénarios ciblés réussis : complément à la demande et déduplication ; conservation du catalogue, des sources et photos ; description sourcée du Pasturier et identité des anciens champs des 20 fiches ; recherche avec préfixes et refus d'une mauvaise identité/chaîne ambiguë ; lecture avant repli de corroboration. Commande : node --test --test-isolation=none tests/restaurant-official-completion.test.cjs. Données simulées dans ces tests. Les anciens tests n'ont pas été rejoués. Le garde historique du catalogue a été ajusté pour tolérer uniquement les trois nouveaux champs de description.

Contrôle de syntaxe et diff. Aucune nouvelle dépendance, aucun abonnement, aucune écriture en base.

## Informations toujours manquantes et limites

La Luye : description, site confirmé, horaires, téléphone, menu, prix et réservation restent non confirmés. Le point GPS et l'adresse de recherche sont conservés.

Le Pasturier : description désormais disponible ; photo réutilisable toujours absente. Les deux établissements n'ont aucune disponibilité de réservation fournie. Les photos des sites officiels ne constituent pas une autorisation de réutilisation.

Aucun déploiement réalisé. La Preview existante sert toujours 03095cf et n'affichera pas ce nouveau correctif avant un déploiement explicitement autorisé. Validation visuelle finale de ce correctif restant à faire sur Preview TEST ; aucune validation sur appareil réel revendiquée. Aucun changement de Production, main, refactor-final, Supabase Production, paiements ou MyEvent-API.
