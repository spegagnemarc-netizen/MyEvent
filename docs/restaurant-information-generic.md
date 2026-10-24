# Enrichissement générique des restaurants

Branche `refactor-final`, dans la continuité de `d64a084`. Aucun nouveau catalogue par restaurant.
Le Pasturier reste l'exemple initial ; le même lecteur fonctionne avec tout site HTTPS déclaré
dans les résultats existants Geoapify/OpenStreetMap, quelle que soit la ville française recherchée.

## Parcours

- Ouvrir une fiche restaurant dans la recherche de lieux, ou « Voir horaires, carte et réservations » dans une carte Restaurants/Sorties.
- La fiche existante consulte automatiquement le site déclaré, à l'ouverture seulement.
- Le lecteur existant extrait horaires structurés/visibles, liens de carte/menu (HTML/PDF), prix publiés et liens de réservation. Il suit au maximum deux pages pertinentes et deux PDF depuis la page initiale, sans exploration récursive.
- Chaque page réellement consultée conserve son URL et sa date. Les résultats absents, les sites bloqués, les cartes en image et les sites nécessitant JavaScript affichent « Information non disponible ». Les liens vers ces cartes peuvent rester consultables manuellement.
- Les données extraites remplacent l'ancien relevé du pilote dans la fiche ouverte ; aucune disponibilité n'est déduite des horaires. Les liens externes restent des démarches auprès du prestataire, sans confirmation ORÉVAMI.

Le rattachement du site provient du fournisseur de recherche ou de la référence existante du pilote.
Il ne constitue pas une certification automatique de l'identité du restaurateur.
Aucun lien officiel n'est deviné lorsque le fournisseur ne renseigne pas de site.
Les sites annuaires et réseaux sociaux identifiés sont refusés pour cette lecture automatique.

## Coûts, sécurité et limites

Cache mémoire borné à 100 URL : six heures pour un relevé, cinq minutes pour une indisponibilité.
Les consultations simultanées d'une même URL sont regroupées, avec deux analyses concurrentes au maximum par instance.
Le cache conserve la date initiale de consultation ; il est éphémère et propre à chaque instance serveur.
Une réinstanciation peut donc occasionner une nouvelle lecture. Aucun stockage Supabase ajouté.

Réutilisation du lecteur HTTPS : contrôle DNS et IP publiques, connexions épinglées, redirections limitées au même site,
respect de robots.txt, limites de volume et de temps, aucun cookie ni identifiant transmis.
Les URL et les données affichées passent par les protections de liens et de texte existantes.
Lecture publique uniquement, sans compte partenaire, achat ou nouveau service payant.

Date, heure et nombre de personnes des formulaires de préparation existants sont conservés.
L'instantané d'une activité conserve aussi les données et sources consultées.
Aucune API partenaire de disponibilités n'est configurée : le module renvoie toujours `not_provided`.
Une connexion partenaire future devra prouver ses créneaux dans un parcours distinct ; aucun stock n'est inventé ici.

## Validation ciblée

`node --test tests/restaurant-information.test.cjs` : lecture de pages menu/contact,
provenance, cache et expiration, erreurs, URLs interdites, absence de stock et réutilisation de l'interface
dans plusieurs villes, y compris une réponse tardive lors du changement de fiche.
Aucun audit général ni batterie de tests complète.
Pas de push, de déploiement, de modification de MyEvent-API ni de base de production.
