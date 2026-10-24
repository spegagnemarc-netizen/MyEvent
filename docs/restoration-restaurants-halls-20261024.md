# Restauration des recherches validées

Branche locale : `restore/restaurants-halls-20261024`.
Base : production `2958ca8f347b24689d16e1689e2a6f883abd3064`, qui inclut le module générique Restaurants.
Comparaison avec la tête GitHub de `main` : `c5184ca4ea408c82a5817f3e38f042b4e3c7d497`.

## Versions retrouvées et cause

- `31546cb74370650f7611dc3074af239f7e302780` : recherche mixte existante `mode=outings`, combinant Geoapify Restaurants, activités Viator et lieux OSM, avec résultats partiels et erreurs par source. Fichiers : `api/search-places.js`, `lib/geoapify-restaurants.js`, `js/sorties-reservations-runtime.js`.
- `2e943322e0658f64e0ab30e0f2f539321ddb3aa2` : boutons Salles et Restaurants du carrousel, icônes et couleurs. Fichiers : `js/events-workspace.js`, `css/events-workspace.css`, `assets/ui/me-card-{hall,outings}.svg`.
- `9f0f1302b90b24d40d3bf566cf285ffdc0c1840b` : moteur Geoapify/OSM des salles, dans `api/search-halls.js` et `server/geoapify-places.js` ; il existe toujours dans main et n'a pas besoin d'être remplacé.

Les commits `31546cb` et `2e94332` ne sont pas ancêtres de la tête actuelle de main.
Il s'agit de fonctionnalités de la branche TEST non reprises dans cette lignée : main conserve dix outils dans le carrousel et une recherche Sorties exclusivement Viator.
La consolidation `0b314cf` a conservé cette version du workspace. Les accès secondaires aux salles sont encore présents ; le moteur n'a pas disparu.

## Reprise minimale

Copie des deux blocs API `outings` et `restaurant` et de la fonction `searchOutings` depuis `31546cb`.
Copie des déclarations des boutons et des ressources visuelles depuis `2e94332`.
Les liens secondaires et tous les autres outils de production sont conservés.
Les références des fichiers modifiés dans index.html sont actualisées.

Les activités Viator restent dans le résultat mixte. La recherche des salles réutilise son endpoint et ses gestionnaires actuels.
Le module d'enrichissement générique, les formulaires de préparation, la pagination du programme IA et les autres corrections de production sont conservés.

La recherche par nom reste le filtre local historique sur les lieux trouvés autour du centre et dans le rayon choisi.
Ce lot ne crée pas de moteur national de recherche textuelle et ne modifie pas les règles historiques de filtrage de la carte.

## Contrôles

Comparaison des blocs repris avec les versions Git historiques, contrôle de syntaxe des trois fichiers JavaScript modifiés et contrôle du diff.
Pas de nouveau test réseau, pas de répétition de la batterie validée, pas d'écriture en base.
Aucun push ni déploiement ; aucune modification de MyEvent-API, de Supabase Production ou de main.
