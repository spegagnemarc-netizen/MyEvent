# Socle Activités & Rencontres V1 — installation TEST

Installation réussie exclusivement sur `ahyyknfjsielnqyoxqgh` (MyEvent-Admin-Test).
Migration unique : `20261018191842` / `activities_rencontres_v1_foundation`.
SQL appliqué : `docs/activities/proposal.sql`.
SHA-256 UTF-8 : `29a03187061a63663577e7e36eb66b3630f381977179bfc61b82a24ca708ff45`.

## Autorisation et périmètre

L’utilisateur a autorisé l’installation, la garde de réexécution et une exception limitée au remplacement de `public.admin_reports.admin_reports_target_kind_check`, en conservant `event`/`listing` et en ajoutant seulement `activity`/`user`.

Le corps d’installation est identique au SQL proposé au commit `26334e02127788634ceb2bece8aa5869daf50a95`. Seule son enveloppe de contrôle a changé. Aucun objet métier supplémentaire, aucune fonctionnalité supplémentaire et aucun changement aux fonctions existantes.

La migration contient un seul bloc DO atomique. Toute exception annule les créations et le remplacement de contrainte. Verrou transactionnel pour sérialiser les installations ; verrou sur la file de signalements pour préserver les données pendant le changement de contrainte.

## Garde de réexécution

- Catalogue de référence généré et commité dans `expected-catalog.json` : schéma, sept tables, index, séquence, colonnes/types/défauts/nullabilité, contraintes, RLS, politiques, fonctions/signatures/corps/attributs et ACL effectives.
- Installation complète et exactement conforme : retour sans écriture, sans modification des OID, données, séquence ou état d’activation.
- Installation partielle, objet supplémentaire dans le périmètre ou différence de définition/permission : arrêt sans réparation automatique.
- Première installation : vérification des dépendances et de la contrainte initiale avant les créations ; contrôle du catalogue après création avant validation.
- Empreinte des définitions/permissions/RLS des objets `public` existants, hors seule contrainte autorisée, identique avant/après dans la transaction.
- Empreinte des signalements identique avant/après. La file contenait zéro ligne au contrôle initial ; aucune donnée existante n’a été supprimée.
- Aucun `DROP` hormis le `DROP CONSTRAINT` expressément autorisé. Aucun TRUNCATE, aucune remise à zéro des données. Pas de table/fonction persistante ajoutée pour la garde.

Générateur reproductible local : `node scripts/build-activities-migration.mjs`. Il repart du SQL autorisé au commit `26334e0`, utilise exclusivement PGlite local, puis génère le script et son catalogue. Il ne contacte pas Supabase et n’applique aucune migration distante.

## Résultats distants après installation

| Contrôle | Résultat |
| --- | --- |
| Sept tables | Présentes : settings, adult_access, activities, locations, members, blocks, notices |
| Six RPC publiques | Présentes : activities_capabilities, activities_list, activities_detail, activities_save, activities_participate, activities_safety |
| Neuf fonctions privées d’origine | Présentes et conformes |
| Catalogue complet vs référence | Aucune différence |
| RLS | Activé sur les sept tables ; aucune politique permissive ; refus par défaut |
| Accès direct tables/colonnes anon et authenticated | Aucun |
| RPC publiques | SECURITY INVOKER ; EXECUTE autorisé à authenticated, refusé à anon |
| Contrainte signalements | event, listing, activity, user exclusivement |
| Réexécution distante | Réussie, sans nouvelle migration ni changement d’état |
| Contrôle sous rôle authenticated avec identité fictive non autorisée | Lecture vide ; capabilities fermées ; création refusée |
| Nombre de migrations de ce nom | Une seule |
| Settings | Une ligne, enabled=false |
| Autorisations adultes / activités | 0 / 0 |

Le contrôle de refus n’a créé aucun compte, aucune activité et aucun signalement. Aucun token, mot de passe ou profil réel n’a été lu ou affiché.

## Tests locaux

Huit tests passent : filtres, validation, parcours SQL du socle, installation/réexécution/refus des divergences, refus d’une installation partielle, rollback après erreur injectée, interface fermée en production, publication TEST bloquée sans autorisation.

La réexécution est testée avec une activité fictive persistée et un état d’activation volontairement changé **uniquement en local**. Six divergences sont injectées localement puis annulées : RLS désactivé, colonne ajoutée, privilège de table, politique permissive, RPC passée en SECURITY DEFINER, exécution anonyme accordée.

Commande : `node --test tests/activities-core.test.mjs tests/activities-ui.test.mjs tests/activities-db.test.mjs tests/activities-migration.test.mjs`.

## État du produit

Le socle est installé. **La V1 complète n’est pas encore opérationnelle.** Activation et inscriptions restent fermées ; aucune autorisation adulte n’a été créée.

Discussion, couverture/photos Storage, notifications, procédure adulte et essai Safari iPhone restent à finaliser/valider dans une étape ultérieure. Aucun de ces parcours n’est annoncé comme opérationnel.

Aucune modification de Supabase Production, de main ou de MyEvent-API ; aucun déploiement public. Interface Preview inchangée : https://my-event-bd3hbyez8-spegagnemarc-netizen.vercel.app.
