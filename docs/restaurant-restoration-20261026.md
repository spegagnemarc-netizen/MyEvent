# Restauration ciblée des restaurants V2/V3

Base : refactor-final, 3c1e014557cddf032d1cddab06a4b390a4e49649.
Source des composants : main, 213c2036403ca742afaac27af3548f232bebccd2.
Branche : fix/restaurant-v2-v3-restore-20261026.

## Périmètre

Le rendu des restaurants Geoapify retrouve la miniature V3, une entrée vers la fiche V2 et le dépliant Horaires, menus et réservation (également accessible dans la fiche). Le catalogue public de 20 restaurants est repris sans modification. Le raccordement Geoapify applique les correspondances conservatrices du catalogue, sans injecter de nouveaux résultats.

La fiche et le lecteur de sites restaurés utilisent des modules propres aux restaurants afin de conserver intégralement la fiche et le lecteur actuels des autres activités. Les recherches, filtres, rayons, boutons de sélection et de carte, réservations et paiements de la base sont conservés. Aucun changement Supabase ou MyEvent-API.

Les deux modes d'information restaurant passent par api/search-places.js et un module server/, sans nouvelle fonction Vercel. Les 12 points d'entrée api/*.js sont identiques à ceux de la base. Le déploiement Git automatique est désactivé pour cette branche uniquement.

## Vérification ciblée hors réseau

Commande : node --test tests/restaurant-restoration.test.cjs.
Résultat final : 1 scénario réussi. Les anciennes batteries de tests ne sont pas relancées.
Le premier passage s'est arrêté sur un rayon de fixture trop court (5 km, 16 résultats) ; correction du rayon de référence à 20 km, puis exécution réussie. Aucun défaut applicatif ni rayon de production modifié.

Contrôles : 20 correspondances enrichies sur 20 avec réponse Geoapify simulée ; catalogue identique à la source ; rendu mixte restaurant/activité ; clic miniature vers dialog V2 ; ouverture du dépliant et présence des horaires, prix, menu et réservation ; conservation exacte des recherches/filtres/réservations ; mêmes 12 fonctions ; chargement des modules et configuration de branche.
Tous les appels d'information sont simulés, le réseau externe est interdit dans le scénario. Aucune écriture en base ni appel fournisseur. Contrôle de syntaxe des nouveaux modules et du diff avant publication.

## Limites

Pas de build Vercel ni de déploiement réalisé : le budget de 12 fonctions est vérifié par l'identité des points d'entrée. Le navigateur est simulé (JSDOM), sans validation visuelle sur appareil réel. Les photos restent conditionnées à une autorisation documentée ; sinon la couverture graphique ORÉVAMI apparaît. L'enrichissement public ne garantit ni actualité des tarifs ni disponibilité de réservation. Les modules restaurants isolés reprennent du code existant : leurs évolutions devront être coordonnées avec les modules activités.
