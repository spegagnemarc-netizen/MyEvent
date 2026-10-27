# Fiches restaurants — conservation et chargement des informations

Base : fix/restaurant-parity-20261027, 0f47f76097b9c5ae7f78c9685cc2b6914aeadcfc.
Correctif : fix/restaurant-sheet-information-20261027. Aucun déploiement autorisé ou effectué.

## Diagnostic ciblé

Les deux parcours ouvrent bien OrevamiRestaurantSheet. Le raccordement social ne nécessitait donc pas une nouvelle API, mais la chaîne partagée perdait certaines données :

- La description n'était ni normalisée depuis Geoapify, ni sérialisée dans les boutons V3/dépliant, ni retournée par le lecteur officiel, ni fusionnée à la fiche.
- Le dialogue avait une fusion différente de celle des miniatures et remplaçait horaires/prix/menu/réservation par des valeurs absentes après une réponse partielle. Le catalogue pouvait aussi écraser un horaire Geoapify lorsqu'il n'avait pas cet horaire.
- Le dépliant appelait la vérification du site sans identité du restaurant : cette vérification conservatrice pouvait légitimement refuser les informations.
- La découverte externe était lancée même quand le catalogue ou un site à vérifier étaient déjà disponibles. Des résultats incomplets pouvaient rester en cache navigateur.
- La présentation affichait plusieurs sections vides et un onglet Avis sans contenu publié.

La Luye, Gap, n'est pas dans le catalogue local des 20 restaurants. Aucune réponse fournisseur réelle ni consultation du site réel de cet établissement n'a été exécutée pour ce correctif. On ne peut donc pas affirmer que ses horaires, prix ou menus existent dans les données actuellement retournées. Les faits fictifs du test portant ce nom ne constituent pas une fiche éditoriale et ne sont pas utilisés par l'application.

## Correctif

Transmission des descriptions déjà fournies par Geoapify et le lecteur officiel existant. Fusion commune applyInformation pour les cartes et les dialogues des deux rubriques, conservant tous les champs déjà disponibles lorsqu'une source supplémentaire ne fournit pas de valeur. Conservation analogue au passage par le catalogue. Aucun changement aux contrôles conservateurs d'identité ou de site officiel : un site non vérifié ne devient pas vérifié par ce correctif.

Catalogue d'abord, sans requête supplémentaire. Site déjà renseigné : appel du lecteur vérifié avec identité complète, sans détour par Wikidata. Découverte existante conservée en l'absence de site et de fiche disponible. Le dépliant utilise le même enrichissement, le même cache et les mêmes données de repli ; les consultations concurrentes restent dédupliquées. Nouvelle version du cache public pour ignorer les anciennes réponses incomplètes.

Les sections restaurants sans information sont retirées ; un récapitulatif unique liste les champs absents. La galerie de remplacement, la fiche V2, la miniature V3, le dépliant et la carte GPS restent disponibles. Le caractère déclaré, sourcé et à reconfirmer reste explicite. Aucune disponibilité, réservation, photo, description ou donnée commerciale n'est créée ou déduite.

## Vérifications

Commande ciblée : node --test --test-isolation=none tests/restaurant-sheet-information.test.cjs.

Trois scénarios :
1. Ouverture depuis les cartes Événements et sociales du même restaurant hors catalogue ; contenu identique, description, horaires, prix, menu, réservation et carte ; le dépliant réutilise la réponse vérifiée ; une seule consultation simulée pour les deux parcours.
2. Réutilisation sans réseau des 20 fiches du catalogue, conservation des champs Geoapify après catalogue/réponse partielle, et suppression des sections vides répétitives.
3. Transmission de description depuis la normalisation Geoapify et le lecteur officiel existant, cache serveur et analyse simulée.

Aucun fournisseur réel appelé et aucune écriture en base. Les anciennes suites n'ont pas été rejouées. Dépendances locales existantes réutilisées, aucune installation. Contrôle de syntaxe des modules changés et git diff --check.

Recherche, filtres, rayons, sorties et inscriptions : leurs modules ne sont pas modifiés. Aucune modification de main, refactor-final, Supabase, paiements ou MyEvent-API. Déploiement automatique désactivé pour la branche dédiée.

## Restant avant validation

Déployer uniquement après autorisation explicite ; vérifier visuellement les deux rubriques sur Preview TEST, dont iPhone, et relever une réponse réelle unique pour La Luye afin de distinguer champs absents du fournisseur et contenu réellement fourni par un site dont l'identité est confirmée. Pas de validation visuelle ou réelle en ligne revendiquée par ces tests simulés.
