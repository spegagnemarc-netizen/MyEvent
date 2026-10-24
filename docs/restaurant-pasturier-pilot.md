# Première fiche restaurant enrichie — Le Pasturier, Gap

Lot réalisé sur `refactor-final`, sans déploiement ni modification de base ou de MyEvent-API.

## Identité et sources

Le connecteur Photon existant a retourné le 24 octobre 2026 le restaurant
`osm-node-4744015021`, rue Pérolière à Gap (44.5603045, 6.0799698).
Il ne s'agit pas d'une nouvelle fiche injectée dans les résultats.
L'enrichissement exige le nom, la localisation et, pour OSM, cet identifiant exact.
Le connecteur Geoapify réutilise le même relevé si le nom et la localisation concordent.

Sources officielles consultées le **24 octobre 2026** :

- [Horaires et formulaire de demande](https://www.restaurantlepasturier.com/contact-et-reservation/) : mardi–samedi, 12 h–13 h 15 et 19 h 30–21 h 15 ; dimanche/lundi fermés.
- [Carte publiée](https://www.restaurantlepasturier.com/carte-tradtionnelle-et-de-saison/) : exemples de plats à 15 €, 27 € et 9,50 €. Le lien donne accès à la carte complète et aux allergènes.

La suggestion datée du 14 octobre et le menu de fête des mères ne sont pas présentés comme des offres actuelles.
Le relevé est manuel et daté : aucune synchronisation automatique ni garantie de prix actuel.
Une mise à jour exige une nouvelle consultation du site et une modification de la date du relevé.
Les dates des fournisseurs OSM restent distinctes des dates des deux sources officielles.

## Parcours

Rechercher « Pasturier » à Gap dans l'interface existante, puis ouvrir sa fiche.
Les résultats Restaurants/Sorties utilisant Geoapify affichent également le relevé via la carte existante.
La fiche et son instantané d'activité gardent les sources, la carte et le caractère « demande externe » du lien.
Le formulaire officiel reçoit une demande soumise à la réponse du restaurant ; aucun créneau ni stock n'est fourni.
Aucun transfert automatique des coordonnées des membres, aucune demande envoyée pendant la vérification.

Les champs date, heure et personnes des formulaires existants sont conservés.
Le bouton de préparation de la sortie sélectionnée s'intitule « Préparer la demande » pour ne pas annoncer une réservation réelle.
La connexion à un inventaire restaurateur autorisé et à MyEvent-API reste hors de ce lot.

## Vérification ciblée

`node --test tests/restaurant-official-details.test.cjs` vérifie le ciblage du restaurant,
les trois chemins de données existants, les deux présentations et la conservation des sources.
Aucun test en base, aucun déploiement et aucun appel à une API de réservation.
