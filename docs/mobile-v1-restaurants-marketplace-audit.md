# Audit ciblé mobile / Explorer / Restaurants / Marketplace — 5 octobre 2026

Base web distante : `0d0af241d8e85852a7faa159ff9ec883bdc1082a`. Audit et correctifs sur `refactor-final`, sans migration ni déploiement production.

## Restaurants et réservations

Explorer comprend géolocalisation explicite, rayon 1–20 km, appel `/api/search-places?mode=nearby`, restaurants/cafés/fast-food issus d’OpenStreetMap/Overpass, fiches, carte et distances Haversine à vol d’oiseau. Un rayon vide est doublé une fois, plafonné à 20 km. Le site réel du lieu est proposé s’il existe ; il ne prouve ni disponibilité ni capacité de réservation. Les résultats sans géolocalisation exploitable ne créent pas de marqueur fiable. Les activités Viator signalent leurs centres approximatifs.

Le formulaire « Ajouter ma réservation » reprend le lieu et son site, demande les données manquantes et la confirmation. La réservation personnelle peut exister sans événement ; le rattachement conserve la même ligne et passe par les droits existants. Les réservations partagées alimentent planning/carte selon les règles de coordonnées vérifiées. Dans le mode événementiel, les parcours existants réutilisent le centre géographique de l’événement et les réservations manuelles.

Blocages concrets : aucune disponibilité restaurant en temps réel ni fournisseur de réservation restaurant identifié dans ce module ; plusieurs établissements n’ont pas de site réservable ; Overpass reste un fournisseur externe susceptible d’être indisponible ; l’élargissement n’itère pas jusqu’au plafond ; les distances routières ne sont pas calculées. Aucun fournisseur ni disponibilité fictif n’est ajouté.

Prochaine mission, dans l’ordre :
1. Valider quelques lieux réels sur la Preview accessible, et traiter rayon vide/erreurs géographiques avec un parcours manuel clair dans les deux modes.
2. Décider du partenaire restaurant réellement disponible et autorisé, puis intégrer son lien ou ses capacités contractuelles ; conserver la réservation manuelle si indisponible.
3. Valider recherche → site réel → confirmation déclarée → réservation personnelle → rattachement unique → planning, sur Android et iPhone. Afficher toujours « à vol d’oiseau » tant qu’aucun service routier n’est intégré.

## Marketplace

Recherche par secteur français géocodé via Nominatim, filtre radial Haversine, catégories/texte/prix/favoris. « Mes annonces » filtre par propriétaire. Dépôt et édition : brouillon, conversion photo JPEG, stockage privé puis publication. Messagerie : contact RPC, fils, messages, suivi lu/non lu, protection contre doublons. Notifications existantes : compteur de messages non lus, mises à jour Supabase Realtime et rafraîchissement de messagerie ; aucun push natif Android/iOS démontré par ce module.

Correction sûre : une annonce sans coordonnées ne doit pas apparaître autour de `(0,0)` via conversion de `null`. Le filtre exclut maintenant les coordonnées absentes/invalides ; le formulaire rejette paires incomplètes et valeurs hors bornes. Les véritables zéros restent valides. Aucune migration nécessaire.

Suite prioritaire : contrôler géocodage/annonces/messages avec deux comptes TEST sur OPPO ; préciser les limites des localisations de secteur et de la recherche française ; décider séparément si notifications système natives sont souhaitées. Pas de refonte ni nouveau système de messages.

## Non-régression et limites

59 tests Node web réussis : Explorer, réservation par lien, Marketplace, partenaires, routage, chargement événementiel, Musique et caméra web. Le budget Vercel reste 12 fonctions. Deux échecs initiaux Viator provenaient de fixtures anciennes sans destination explicite et d’un plafond de pagination obsolète : tests actualisés avec destination fournie, localisation marquée approximative et plafond actuel de 30 produits par destination ; ajout d’un test refusant les coordonnées inventées. Aucun code API Viator ni identifiant affilié modifié.

SQL local PGlite : Marketplace 34 contrôles ; Explorer (propriétaire/membre/extérieur/anonyme/rattachement/justificatif), Amis/Stories (confidentialité/transitions/suppression), permissions événementielles et Musique (idempotence/frontières/verrou/ordre atomique) réussis. Génération partenaires réussie sans changement de contenu.

Ces tests isolés ne prouvent pas l’état du schéma distant ni une session authentifiée sur OPPO. Pas de nouvelle écriture distante, pas de fournisseur appelé en production, pas de nouvel essai réel de paiement/réservation. Hotels.com, Expedia Séjours, Abritel, Omio, Expedia Vols, Viator, les widgets et Musique sont conservés.
