# ORÉVAMI — restauration ciblée des recherches

Branche : `fix/orevami-place-searches`. Base Production examinée : `7d2a33388987c3b9486c965483ee189602ec9f63`.

## Constats en Production (15 octobre 2026)

Contrôles GET uniquement, centre de référence public Paris (48.8566, 2.3522), rayon 5 km. Aucun compte, événement ni donnée utilisateur modifié.

- `/api/search-places?mode=nearby` : HTTP 200, Geoapify, 141 lieux. Types : 131 `artwork`, 6 `attraction`, 2 `viewpoint`, 1 `drinking_water`, 1 `pedestrian`. Aucun restaurant. La requête générale unique (dont `tourism`) remplit sa limite de 150 avant de fournir les familles nécessaires. Une réponse HTTP 200 ne garantit donc pas des restaurants/activités exploitables.
- Même route à 50 km : HTTP 400 « Rayon de proximité invalide ». Limite codée à 20 km.
- `/api/search-halls` : HTTP 200, 82 résultats avant limite de réponse, source Overpass. L'erreur signalée n'a pas été reproduite à cet instant. Ce message précis n'est produit qu'après échec de tous les miroirs Overpass ; il indique une panne fournisseur/transport, et non zéro salle. L'ancien chemin ignorait la clé Geoapify et pouvait cumuler quatre attentes de sept secondes. Aucun journal historique ne permet d'identifier lequel de ces échecs s'est produit sur l'iPhone.
- `/api/search-places?mode=viator&count=5` : HTTP 200, 5 activités, sans élargissement partenaire. Intégration conservée.
- Sortie IA : le message signalé est déclenché côté navigateur avant l'appel au modèle quand un restaurant ou une activité manque. Le jeu de candidats observé explique ce blocage ; aucune requête OpenAI payante n'a été lancée pour le diagnostic.
- `GEOAPIFY_API_KEY` existe dans les cibles Production/Preview de Vercel, de type sensible. La réponse Geoapify réussie confirme son fonctionnement pour le déploiement courant. Aucune erreur 401/403/429 observée. Le solde du quota et les restrictions du compte fournisseur n'ont pas été consultés. Aucun secret affiché ni variable modifiée.

## Corrections préparées

- Deux requêtes Geoapify distinctes, restauration et activités (culture/loisirs/sport), sans la famille touristique générale qui saturait les résultats. Plafond réservé par famille ; catégories et coordonnées conservées, dédoublonnage et filtre de distance réels maintenus. Deux appels fournisseur par recherche de proximité, au lieu d'un : à intégrer au suivi de quota.
- Catégorisation restauration issue des catégories Geoapify ; coordonnées obligatoires, noms absents exclus, contact/site préservés.
- Salles : utilisation de Geoapify déjà configuré, catégories documentées `activity.events_venue` et `activity.community_center`, puis filtre strict des lieux événementiels. Pas de promesse de disponibilité à la location ; capacité et tarif inconnus restent inconnus. Ancien repli Overpass uniquement si aucune clé Geoapify n'est configurée, avec délai borné.
- Rayons 5/10/20/50 km acceptés ; conversion km → mètres vérifiée. Option 50 km ajoutée aux sélecteurs concernés.
- Sortie IA : jusqu'à 60 candidats de chaque famille, afin que la troncature ne supprime pas toutes les activités. Résultats réellement insuffisants : décompte explicite et proposition du prochain rayon, sans inventer de lieu ou appeler le modèle inutilement.
- Panne/authentification/quota fournisseur distingués des résultats vides ; aucune erreur HTTP mise en cache CDN. Aucun corps d'erreur externe ni URL contenant une clé renvoyé au client ou journalisé.
- Partenariats Viator et autres intégrations conservés ; aucun changement de contrat ni de lien affilié.

## Validation et remise en service

20 contrôles Node ciblés réussis : recherches salles/lieux, rayons, filtrage, erreurs fournisseur, protection des secrets, équilibre des candidats IA et non-régression Viator. Un contrôle DOM ciblé supplémentaire confirme l'élargissement de rayon et l'absence de marqueur exact pour une activité approximative. Aucun test des jeux ni campagne de navigation.

Les contrôles des nouveaux appels fournisseur sont simulés localement ; les résultats réels de la correction restent à confirmer sur une Preview avant promotion. Les catégories utilisées sont celles de la documentation officielle Geoapify : https://apidocs.geoapify.com/docs/places/.

Pour rétablir la Production : contrôler les deux nouvelles recherches et les salles sur la Preview de cette branche, puis obtenir l'autorisation de déployer le commit validé. Confirmer ensuite par quelques GET ciblés sur le centre/rayon signalés par l'utilisateur. Aucun changement de clé n'est actuellement justifié. Aucun déploiement Production, modification de main, Supabase, Stripe, SMTP ou DNS dans cette mission.
