# Activités & Rencontres V1 — état du 18 octobre 2026

## Résultat réel

Phase A réalisée, socle de Phase B développé et socle SQL installé sur TEST avec autorisation explicite. La V1 complète n’est pas opérationnelle.
Migration unique `20261018191842` / `activities_rencontres_v1_foundation`, activation fermée. Voir [le bilan d’installation](INSTALLATION-TEST.md). Aucune donnée fictive créée à distance pendant cette installation. Aucun déploiement de production. Travail limité à `spegagnemarc-netizen/MyEvent`, branche `refactor-final`, départ `13d01fda3a74f1c6322216c909a30f51f2738a12`.

L’entrée accueil apparaît uniquement si la configuration runtime valide `isTest` et la référence `ahyyknfjsielnqyoxqgh`. Pas de stockage local faisant croire à une inscription réussie. Sans base installée et autorisation adulte serveur, l’interface montre un état d’attente et interdit la publication.

## Audit et réutilisation

| Domaine | Constat vérifié | Décision |
| --- | --- | --- |
| Configuration / authentification | `js/runtime-config.js`, `server/supabase-environment.mjs`, `myeventCameraContext()` | Réutiliser la session Supabase et la frontière TEST existantes. Aucun nouveau client, clé ou compte. |
| Événements / participants | `events`, `event_members`, nombreuses politiques permissives et restrictives | Ne pas transformer une activité en événement privé. Stockage distinct, aucune écriture dans ces tables. |
| Discussion / médias | `messages`, `media`, `voice_messages`, `discussion-runtime.js`, moteur principal dans `core-runtime.js`; accès lié à `event_id` | Pas de faux salon ni contournement par un événement miroir. Extraire ultérieurement un adaptateur de discussion partagé, puis contrôler les accès aux messages et objets Storage. Bouton désactivé en attendant. |
| Amis | `friendships` et RPC `friend_action`, `are_friends` disponibles sur TEST | Visibilité amis calculée côté SQL ; demande explicite avec acceptation réciproque. Aucun ajout automatique. |
| Carte / GPS | Leaflet et tuiles OSM dans `map-runtime.js` | Même bibliothèque et fournisseur, calque dédié évitant d’exposer la position des amis. GPS seulement sur action explicite, position de recherche gardée en mémoire. Points d’activité arrondis à 2 décimales. |
| Fil | Compositeur `socialOpenComposer`, `socialPostText` | Préremplir une publication avec lien de fiche ; l’utilisateur déclenche la publication existante. Refuser le partage public des activités amis. |
| Modération | `admin_reports`, outils Administration V2/V3 et contrôle `myevent_account_active` disponibles | Même file de signalements ; libellés activité/utilisateur ajoutés au rendu central. Extension SQL autorisée et appliquée sur TEST. Masquage admin d’activité à ajouter avant activation. |
| Notifications / DM | Code `social-inbox.js` et migration `202609280001_social_inbox.sql` présents, mais `social_inbox_snapshot`, `social_notifications` et `dm_conversations` absents de TEST lors de l’audit | Écart dépôt/base à résoudre explicitement. Les notices du projet SQL sont une boîte de sortie privée, pas une seconde messagerie ; aucun affichage ni double notification généré. Adaptateur vers la boîte sociale encore nécessaire. |
| Âge | `profiles` ne contient aucun contrôle d’âge serveur | Aucun parcours mineur activé. Autorisation adulte administrative fermée par défaut. Ce socle n’est pas une procédure de vérification d’âge validée, ni un badge « vérifié ». |
| Météo / sondages / IA | Modules existants liés aux événements | Pas d’appel automatique ni de copie de données ; intégration à réaliser après le contexte activité partagé. |

Audit distant en lecture seule : inventaire des tables et indicateurs RLS, colonnes de `events`, `event_members`, `messages`, `friendships`, `profiles`, `admin_reports`, politiques de ces tables, contraintes de participants et de signalements, recherche de notifications/DM/blocages dans les schémas applicatifs. Toutes les tables `public` inventoriées ont RLS activé. Cela ne signifie pas que toutes leurs politiques ont été auditées en profondeur. Aucun profil ou message utilisateur lu.

## Interface développée

- Entrée 🌍 Activités & Rencontres, panneau accessible avec fermeture, Échap, gestion du focus et verrouillage du défilement du fond.
- Découvrir, À proximité, Ce week-end, Mes activités, Créer ; cartes et état vide ; ville, catégorie, date, gratuité, places, rayon.
- Week-end calculé dans le fuseau du navigateur, dimanche compris. Recherche de proximité utilisant seulement le GPS demandé explicitement ; coordonnées affichées approximatives, donc limite de rayon indicative.
- Formulaire : titre, description, neuf catégories, date/heure locales, ville, lieu, adresse privée, coordonnées facultatives, capacité incluant l’organisateur, frais sur place, conditions, visibilité, inscription directe ou validation.
- Aperçu local de couverture JPEG/PNG/WebP (5 Mo maximum), sans téléversement. Toute publication avec photo est refusée explicitement tant que Storage n’est pas branché.
- Fiche et raccordement aux RPC proposées : inscription, demande, retrait, acceptation/refus organisateur, modification, annulation et retrait logique ; aucune réussite simulée.
- Signalement d’activité, blocage de l’organisateur, demandes d’amis et préparation d’un partage sur le fil. Ces actions ne sont pas annoncées comme validées sur TEST.

## SQL autorisé — installé sur TEST, réexécution contrôlée

Fichier : `docs/activities/proposal.sql`. Il est volontairement **hors** du dossier des migrations exécutables. Le script corrigé et son catalogue ont été vérifiés localement puis installés par le connecteur Supabase, dans une migration unique, après autorisation. Toute divergence lors d’une réexécution provoque un arrêt sans réparation automatique.

Effet exact du socle :

1. Nouveau schéma non exposé `activities_private`.
2. Sept tables : `settings`, `adult_access`, `activities`, `locations`, `members`, `blocks`, `notices`.
3. RLS activé avec refus par défaut et retrait de tous les privilèges directs des clients sur les sept tables et séquences. Aucun changement des RLS existantes.
4. Neuf fonctions privées, dont six points d’entrée autorisés : `capabilities`, `list`, `detail`, `save`, `participate`, `safety` ; aides internes non exécutables directement par les clients. Fonctions privilégiées à `search_path` vide, contrôle explicite de session, compte actif, autorisation adulte, visibilité, propriétaire et blocages.
5. Six enveloppes publiques SECURITY INVOKER : `activities_capabilities`, `activities_list`, `activities_detail`, `activities_save`, `activities_participate`, `activities_safety`, accessibles uniquement à `authenticated`.
6. Extension de la contrainte `admin_reports_target_kind_check` pour accepter `activity` et `user`. Aucune suppression de signalement existant.
7. Activation laissée à `false`, **aucune autorisation adulte créée**, aucune modification des comptes existants, aucun bucket, aucun salon, aucune modification de fonction existante, aucun paiement.

Transactions : unicité `(activity_id,user_id)`, verrou sur la ligne activité commun aux inscriptions/acceptations/modifications de capacité, organisateur compté dans la capacité, contrôle des demandes répétées, plafond de créations à cinq par jour sous verrou organisateur. Limite de vingt participations modifiées par heure et de cent demandes en attente par activité. Limite de dix signalements par heure.

Confidentialité : pas de lecture directe du stockage ; liste sans adresse, sans liste de membres ; fiche avec adresse seulement pour organisateur/acceptés ; coordonnées publiques arrondies ; participants visibles seulement aux acceptés, demandes en attente seulement à l’organisateur. Les textes libres peuvent toujours contenir des informations sensibles : avertissement et confirmation de l’organisateur, modération à compléter ; pas de garantie de détection automatique.

Suppression : retrait logique, purge immédiate de l’adresse/GPS lors de l’annulation ou du retrait. Données minimales de participation et signalements conservées pour modération. La durée de conservation et la purge planifiée doivent être fixées avant activation ; aucun délai légal n’est inventé.

Limites SQL connues avant activation : liste limitée aux 300 premières activités visibles (pagination et recherche serveur à compléter), aucune autorisation adulte réellement vérifiée, couverture/discussion/notifications non intégrées, modération de masquage et interface de déblocage à compléter. Une inscription simultanée réelle doit être vérifiée avec deux connexions PostgreSQL ; PGlite ne fournit pas cette preuve.

## Vérifications exécutées

Commande : `node --test tests/activities-core.test.mjs tests/activities-db.test.mjs tests/activities-ui.test.mjs`.

Les cinq tests initiaux passent, ainsi que trois tests de garde/atomicité décrits dans le bilan d’installation :

1. Filtres ville/catégorie/week-end dimanche, gratuité, disponibilité, distance, activités personnelles annulées.
2. Validation titre/description/date/capacité/GPS/frais.
3. PostgreSQL local PGlite : installation du projet SQL, activation fermée, contrôle adulte, confidentialité adresse/membres, coordonnées arrondies, refus de lecture directe, interdiction de modifier l’activité d’autrui, inscription idempotente, refus à capacité atteinte, retrait, demande, refus puis acceptation, signalement, annulation, retrait logique, refus d’accès anonyme.
4. Entrée et panneau absents lorsque la configuration est production.
5. Formulaire TEST accessible, publication bloquée si le stockage manque.

`node --check` des deux nouveaux scripts et `git diff --check` réussis. Capture Chromium en émulation mobile 390 × 844, sans erreur JavaScript ni débordement horizontal. Ce contrôle ne remplace pas Safari sur un vrai iPhone. Les captures proviennent d’un harnais local avec la vraie interface et **sans fausses activités ni faux parcours réussi**.

| Parcours demandé | Validation distante TEST |
| --- | --- |
| Création, persistance après actualisation | Non : activation volontairement fermée |
| Découverte, recherche | Logique locale validée ; stockage non validé |
| Inscription directe, demandes, capacité | PostgreSQL local validé ; pas de test concurrent distant |
| Discussion/photos des participants | Non intégrées, bouton fermé |
| Annulation/suppression | PostgreSQL local validé ; non validé à distance |
| Safari iPhone | Non exécuté ; émulation Chromium seulement |

## Suite conditionnée à l’autorisation

Le socle SQL est installé sur `ahyyknfjsielnqyoxqgh`, avec activation toujours fermée. L’autorisation ne couvre ni la production ni l’ouverture des rencontres. La finalisation et la revue des adaptateurs discussion/Storage/notifications et de la procédure adulte restent à réaliser avant activation et essai iPhone complet.

Documentation consultée : guide officiel Supabase RLS (https://supabase.com/docs/guides/database/postgres/row-level-security). Le changelog markdown n’a pas pu être récupéré dans cet environnement. Aucun nouveau SDK ou service externe ajouté.
