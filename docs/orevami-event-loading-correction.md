# Correction ciblée du chargement Événements

Branche : `fix/outing-plan-active-event`. Base locale : `53f3a5b75184d167e56be0801c791ec54e00dfe8` (contenu identique à la Preview `90450261fdbe1f5ddc2c17bbf2748b1f7a18de3e`). Aucune publication dans cette mission.

## Observations et causes

L'enregistrement iPhone fourni dure 168,4 secondes. Les images examinées montrent d'abord « Chargement de vos événements », puis un sélecteur qui change alors que la fiche précédente et « Ouverture de l’événement… » persistent. Le décalage est également présent à 150 secondes. Les durées par requête ne peuvent pas être mesurées avec cette vidéo : elle ne contient ni journal réseau ni trace Supabase.

- `loadEvents` enchaînait les lectures des événements créés et des appartenances. Il attendait ensuite les signatures des couvertures et le rendu du planning/réservations, avant de rendre la main à l'espace Événements. Plusieurs entrées concurrentes pouvaient répéter ces lectures.
- `selectEvent` attendait successivement la sortie choisie, la réservation, le thème de discussion, cinq panneaux, le planning, les réservations, la météo et les notifications. Plusieurs lectures n'avaient aucun délai applicatif. La durée d'une fonction annexe conditionnait donc la fin de l'ouverture.
- Pendant toute cette attente, `busy` empêchait `render` de synchroniser le sélecteur et la fiche. Le navigateur affichait immédiatement l'option choisie, même si l'ancien événement restait affiché. Les choix suivants étaient ignorés par le verrou.
- Les gardes existantes entre grandes étapes ne protégeaient pas les écritures internes de plusieurs chargeurs : messages, médias, sondages, participants, réservation, météo et notifications pouvaient encore traiter une réponse tardive.
- Le rafraîchissement des notifications toutes les quatre secondes pouvait accumuler des chaînes de requêtes concurrentes. Les rendus successifs de la fiche redemandaient aussi les signatures des mêmes couvertures.

La vidéo et le code établissent ces défauts. Ils ne permettent pas d'affirmer qu'une table Supabase, une politique RLS ou un fournisseur précis est responsable des 20 secondes initiales. Aucun appel réel supplémentaire n'a été effectué pour le déterminer.

## Correction

- Lectures initiales événements/appartenances parallèles ; un seul chargement de liste partagé pour les ouvertures concurrentes. Cache mémoire de liste de 15 secondes, isolé par utilisateur. Les rechargements métier explicites continuent de forcer la lecture. Les réponses de listes remplacées sont ignorées.
- Les métadonnées déjà disponibles sont rendues immédiatement. Couvertures non bloquantes, signatures mutualisées pendant cinq minutes et isolées par utilisateur. Une erreur de revalidation conserve la liste déjà disponible.
- La sélection réutilise la ligne autorisée de la liste du compte ; sinon elle vérifie l'événement et son rôle par lecture bornée. Le sélecteur et la fiche utilisent le même identifiant validé. Les changements rapides sont autorisés ; seul le dernier résultat de sélection est applicable. Réouvrir le même événement conserve ses données et ne relance pas toute son ouverture.
- Les panneaux annexes sont hydratés indépendamment avec `Promise.allSettled`. Leur réussite n'est plus une condition de fin de sélection. Le planning commence à afficher ses métadonnées avant ses lectures facultatives.
- Les lectures concernées passent par une garde utilisateur + événement + génération de sélection. Les réponses tardives, y compris celles reçues après A → B → A, ne sont pas appliquées. Les chemins d'erreur sont également protégés. Les panneaux partagés précédents sont vidés au changement d'événement.
- Délai de 15 secondes par attente protégée, annulation des requêtes Supabase lorsque leur interface le permet ; un avertissement français remplace une attente sans fin. Ce n'est pas une limite globale de 15 secondes pour tous les panneaux : leurs chaînes restent indépendantes. Les rubriques discussion/sondages/photos/participants peuvent être rouvertes pour réessayer.
- Rafraîchissements de notifications identiques mutualisés pendant leur exécution, par utilisateur/événement/génération.
- Personnalisation de discussion et réservations protégées contre une réponse provenant de la sélection précédente. Aucun changement de signature, de paiement ou de configuration externe.

## Validation ciblée

39 contrôles simulés : chargement et erreurs de liste (5), concurrence/délais/cache/notifications (6), sélection persistante et isolation (9), espace Événements (9), fiabilité Sortie IA (10). Syntaxe des scripts modifiés et vérification du diff.

Les vérifications couvrent notamment une requête qui ne répond jamais, un rejet réseau, une réponse arrivée après changement de compte ou d'événement, la cohérence sélecteur/fiche pendant une sélection échouée, le rendu avant fin de revalidation et la sélection alors qu'un panneau annexe reste bloqué.

Aucun appel Supabase, Geoapify ou IA réel, aucune campagne de jeux, aucune nouvelle Preview et aucun déploiement Production. Les améliorations réelles de durée restent à confirmer sur iPhone après autorisation de publication d'une Preview.
