# Quatre corrections iPhone — préparation du 16 octobre 2026

Branche de travail : `refactor-final`. Base de branche : `eb7a2921a81a1285c1d628198f8df581b0c1cdf1`.
Production de référence : `3eba1e974d515e668841b0603f3cab09a84e8f30`.
Pas de modification de main, déploiement Production, migration Production ou suppression réelle.
Les quatre captures annoncées ne sont pas accessibles dans cette conversation.

## 1. Emplacement publicitaire : CORRIGÉ dans la préparation

La publication du fil a exclu les scripts et le balisage de la régie pour ne pas activer la publicité. L'intégration précédente dépendait en outre de la Preview TEST et d'un retour de campagnes : ce n'était pas un emplacement permanent indépendant.

`ads-placement.js` rétablit un cadre distinct, après la cinquième publication ou après le fil lorsqu'il est court. Il dit explicitement « Emplacement réservé · aucune campagne diffusée actuellement ». Aucun annonceur, prix, lien, visuel de campagne, suivi, requête fournisseur ou paiement simulé. Les publications et leurs gestionnaires sont conservés.

Les modules de gestion Ads, le serveur, les formulaires, les migrations archivées et les restrictions TEST de refactor-final sont conservés sans modification ni activation. Aucun réglage distant publicitaire n'est changé.

## 2. Signatures : CORRIGÉ dans la préparation

Les libellés étaient ORÉVAMI, mais les anciens tracés manuscrits dessinaient toujours MyEvent. Les sept lettres O R É V A M I sont maintenant vectorielles, accent compris. Le cœur se place après la largeur mesurée du nom ; la couronne est centrée au-dessus. Les vignettes, la boîte de sélection et la zone tactile tiennent compte des décorations. Le rendu interactif et l'export photo utilisent toujours la même fonction.

Quatre styles conservés : classique, cœur, couronne, manuscrite. Sélection annoncée par aria-pressed. Cache des scripts actualisé. Une autre mention visible dans le message de participation du webhook a été remplacée par ORÉVAMI ; aucun identifiant, contrat ou mécanisme de paiement changé.

## 3. Actions : CORRIGÉ dans la préparation

Le menu clonait les boutons sans style dédié. Ajout d'une grille sombre, contours lumineux violets (modifier), turquoise (inviter), rose (supprimer/quitter), cibles tactiles de 58 px, focus visible et colonne unique sous 350 px. Les boutons déclenchent toujours les commandes originales ; aucune autorisation ni confirmation n'est modifiée.

## 4. Suppression : correction préparée ; Production BLOQUÉE sans autorisation SQL

Audit Production en lecture seule :

- Les clés étrangères des sondages, options, votes, événements et programmes sont déjà en CASCADE ; les réservations personnelles sont en SET NULL.
- Les deux événements appartiennent au même créateur. Aucun chemin média/vocal hors du dossier de l'événement et aucun job de suppression préexistant.
- « Test » : un programme IA, aucun sondage, aucun objet binaire dans les deux buckets d'événement.
- « Anniversaire alizee » : deux sondages et neuf objets binaires dans le périmètre des buckets d'événement. Ces fichiers n'ont pas été lus ni supprimés.
- RLS actives. La fonction delete_event authentifie le propriétaire, verrouille la ligne, refuse les anciens chemins non attribuables et crée un job de nettoyage durable.

Cause reproduite sur TEST : au cours de la suppression du parent, event_admin_guard appelle event_is_manager alors que l'événement n'existe plus. Les programmes IA et sondages dépendants lèvent « Gestion réservée au créateur ou aux co-organisateurs » et annulent toute la transaction. La correction précédente des clés étrangères ne corrige pas ce déclencheur.

Proposition : `supabase/corrections/event-admin-guard-owner-cascade.sql`. Autoriser uniquement la cascade imbriquée, exécutée sous le propriétaire SQL de delete_event, après disparition du parent et en présence du job durable lié à auth.uid(). Aucune désactivation de déclencheur ou RLS, aucun nouveau SECURITY DEFINER, aucun accès élargi aux fichiers. Les suppressions autonomes gardent le contrôle de gestion existant.

TEST réel transactionnel : propriétaire et dépendances sondage/options + programme/items, refus d'un tiers, protection de l'appartenance propriétaire, reprise idempotente et job Storage passent. La fonction proposée et toutes les données synthétiques ont été annulées par ROLLBACK. Aucun schéma ou enregistrement TEST n'a été conservé par cette vérification. Le nettoyage physique Storage n'a pas été exécuté.

## Contrôles et limites

Trois nouveaux contrôles DOM/canvas simulés : emplacement inactif sans réseau, menu réutilisant les commandes et confirmation, quatre signatures sélectionnables puis déplacées et exportées aux coordonnées modifiées. Syntaxe JavaScript et diff vérifiés. Pas de rejeu des anciennes campagnes de tests.

Safari iPhone physique, fidélité typographique réelle et captures utilisateur : NON VÉRIFIÉS ici. Aucune réussite sur appareil physique n'est revendiquée.

## Publication future

refactor-final contient de nombreux travaux antérieurs et ne doit pas être promue en bloc sur Production. Un patch ciblé est fourni séparément contre le SHA Production de référence, pour conserver strictement le fil publié, Sortie IA et la sélection d'événement. Avant une publication autorisée : vérifier le HEAD distant et appliquer/revoir uniquement ce patch. Les fonctions de gestion publicitaire restent conservées sur refactor-final ; leur activation Production constitue une mission distincte.

Autorisations encore requises : application de la proposition SQL en Production ; déploiement Production des changements ciblés. La suppression des deux événements réels nécessite une autorisation distincte ou leur suppression par le propriétaire dans l'interface, après publication du correctif.
