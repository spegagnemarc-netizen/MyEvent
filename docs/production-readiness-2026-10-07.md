# Préparation Production — 7 octobre 2026

## Références et périmètre

Base web et main distants : `b95ae44b886bbbead07fe21d476cb73d61f039d9`. Base mobile : `b5a9cf24b5497b37818ef6ee3587d8a9f3a85df7`. Checkout parent conservé avec ses changements locaux, HEAD `ea7ecd0e23ff844a0acf5a97905098a162a34efa`. Travail réalisé dans deux copies isolées. Aucun merge, modification de main, écriture Supabase Production, changement de variables, domaine ou déploiement Production.

Production réellement constatée : `dpl_6me4xNTpe4ueHn8pxL6BArAvC9Hk`, URL `https://my-event-8iylvuxyo-spegagnemarc-netizen.vercel.app`, SHA `b95ae44b886bbbead07fe21d476cb73d61f039d9`, référence Git main. La branche de Production Vercel est main. La référence historique `GiSMHGJAh` correspond à `dpl_GiSMHGJAhBATPy4KDEzFK9j59cNH`, SHA `1cf57714baf09b0b383ee34ba328dc6e482c5c4d`. Le web initial est identique à main ; il comporte 97 fichiers modifiés, 4928 insertions et 101 suppressions depuis cette ancienne version. Revenir à cette version complète ferait perdre les nouveautés déjà présentes.

## Partenaires et fonctionnalités

Widgets conservés sans changement : Hotels.com `fr-hcom`, camref `1110lR6fx`, pubref `myevent-hebergement` ; Expedia Séjours/Vols `fr-expedia`, camref `1011l6tumI`, pubref `myevent-expedia` ; Abritel `abritel`, camref `1100l6v4qo`, pubref `myevent-abritel`. Omio conserve `omio-affiliates` et `https://omio.sjv.io/c/7865634/3963000/7385?u=`. Viator, TicketNetwork et « Ajouter ma réservation par lien » restent présents. Les tests contrôlent les widgets, identifiants et formulaires existants ; aucune réservation externe réelle n'a été effectuée pendant cette mission.

Restaurants : recherche OSM/Overpass, géolocalisation/rayon 1–20 km, distances à vol d'oiseau, site réel du lieu et réservation déclarée manuellement. Aucun partenaire restaurant contractuel ni disponibilité en temps réel identifié. Voir `mobile-v1-restaurants-marketplace-audit.md` ; ses limites restent valables.

## Vercel

Les noms Production lus sont SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VIATOR_API_KEY, VIATOR_API_ENV, YOUTUBE_API_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, SNCF_API_TOKEN et OPENAI_API_KEY. Aucune valeur reproduite. **SUPABASE_PUBLISHABLE_KEY est présente** ; le runtime public confirme Production et publishableKeyPresent=true, projet `nxxvadbliinhvkirqkkl`.

Build local Vercel réussi, exactement **12 fonctions** : `[search]`, analyze-poll, camera-ai, create-payment-session, generate-avatar, generate-materials, generate-outing-plan, search-halls, search-music, search-places, stripe-webhook, summarize-event. `/api/runtime-config` réutilise camera-ai. Le routeur `[search]` regroupe les routes prévues sans fonction supplémentaire. Les anciennes URL serveur accommodation/transport sont refusées, les routes API inconnues retournent 404. Tests méthodes/routage exécutés. Plus aucune marge pour une treizième fonction.

## Inventaire réel Supabase Production, lecture seule

Projet Healthy/NANO. Transactions `BEGIN READ ONLY ... ROLLBACK`, exclusivement métadonnées et état de configuration. Catalogue observé : **74 tables (toutes RLS activées), 162 index, 299 politiques, 92 fonctions, 14 triggers, 7 buckets, 29 tables Realtime**. Le total de la requête catalogue, incluant registre et configurations de rôles, est 659 lignes. Colonnes/types/nullabilité/défauts, contraintes, corps/signatures/ACL/search_path des fonctions, politiques, triggers et buckets ont été interrogés dans l'éditeur SQL.

Groupes couverts : événements/membres/lieux/sorties/plans/réservations/tâches/fournitures/caisse, profils/messages/polls/media/voix, Musique, Marketplace, Amis/Stories/feed/DM, jeux et secrets game_private, Admin V1/V2/V3, réservations personnelles. Le registre `supabase_migrations.schema_migrations` est absent : impossible d'attester l'application historique d'un fichier seulement par son numéro. La présence des objets ne prouve pas l'identité intégrale de chaque migration passée.

Buckets : event-media privé, event-voices privé, profile-avatars public (ces trois sans limite MIME/taille configurée) ; social-media privé 15 Mo JPEG/PNG/WebP ; story-media privé 50 Mo JPEG/PNG/WebP/MP4/QuickTime/WebM ; marketplace-images privé 5 Mo JPEG ; dm-media privé 10 Mo JPEG/PNG/WebP.

Admin V1/V2/V3 et personal_reservations sont maintenant présents, contrairement à l'audit du 5 octobre. RPC Admin protégées par leurs droits, sans accès anon ; RLS Admin active. Les quatre politiques et trois index des réservations personnelles sont présents. Story music est présente, y compris une colonne plus récente `display_duration_seconds` à préserver. Gate de suspension non prêt (`myevent_suspension_gate_ready()=false`) et aucun hook PostgREST actif : conserver l'activation des suspensions verrouillée.

L'export intégral CSV de l'éditeur n'a pas pu être récupéré localement. Les constatations ci-dessus sont issues des résultats réels affichés ; **aucun snapshot complet restaurable n'est livré**. La requête reproductible `supabase/admin/catalog-readonly.sql` permet de conserver un export contrôlé avant toute intervention. Requête privée de l'audit : `https://supabase.com/dashboard/project/nxxvadbliinhvkirqkkl/sql/7cc2ccb5-707b-4611-baac-a15c31d8f513`. Aucune donnée métier ou secret exporté. L'interface ne fournit pas de sauvegarde/restauration validée pour ce projet.

## Écarts SQL et ordre préparé, non exécuté

Ne pas lancer `supabase db push` : baseline incomplète et numéro `202609280002` dupliqué. Refaire le catalogue juste avant toute migration, exporter définitions/ACL/politiques originales et valider une sauvegarde restaurable. Exécuter chaque fichier explicitement après revue de ses préconditions, d'abord sur TEST.

1. **Storage** : quatre politiques résolvent `name` en `events.name` dans leurs sous-requêtes. Média bloqué ; comparaison cover incorrecte et risque de cast UUID sur les voix. Correction ciblée `202610070001_storage_event_path_scope.sql`, dépendances storage.objects/events et fonctions de visibilité/appartenance existantes. ALTER POLICY conserve rôles, commandes et caractère permissif/restrictif ; aucune donnée ni bucket supprimé. Le test local reproduit le défaut et contrôle propriétaire/membre/visiteur et chemins invalides.
2. **Musique** : `20260924_music_integrity.sql` absent au niveau de ses objets : music_guard_item, music_guard_vote, music_reorder_queue, deux index composites et FK composites manquants. Dépend de music_v1 et des helpers événementiels déjà présents. Auditer les incohérences existantes avant validation des FK NOT VALID ; cette migration impose aussi les nouvelles écritures. Aucune correction/suppression automatique de données.
3. **Annuaire compatible** : event_member_directory existe ; ancien RPC event_member_profiles(uuid) absent, encore référencé comme secours. Examiner `202609270004_event_member_profiles.sql` face aux helpers actuels avant installation isolée. Ne pas rejouer les migrations de rôles plus anciennes qui remplaceraient l'identité actuelle.
4. **Défis** : game_challenges, game_private.defis_catalog et les RPC defis manquent. `202609270003_defis_game.sql` dépend du moteur `202609270002_games_engine.sql` déjà installé et des droits membres existants. Tester création/action/quitter avant activation du parcours.
5. **Suspension Admin** : étape séparée, pas activation automatique. Examiner `202610030004_admin_v21_request_gate.sql` et l'état des hooks avant toute décision. Les tests locaux ne prouvent pas la barrière réelle Data API/Storage.

Retour arrière SQL : capturer à l'avance pg_get_functiondef, ACL, pg_get_triggerdef et pg_policies pour chaque objet touché. Pour Storage, restaurer les quatre qual/with_check exacts par ALTER POLICY dans une transaction (le défaut initial réapparaîtrait). Pour Musique, restaurer définitions/triggers/droits initiaux et examiner les contraintes ajoutées avant retour ; conserver playlists/votes. Pour Défis, désactiver l'entrée applicative et conserver catalogues/parties/données ; ne pas DROP les tables. Pour le hook Admin, restaurer la configuration authenticator initiale sans supprimer les comptes. Un revert Git ne restaure pas SQL. Les commandes de retour ne sont pas exécutées ici et nécessitent l'autorisation correspondant à Production.

## Correctifs et validations

Deux anomalies applicatives constatées et corrigées : listener fermeture détail Admin sorti de son IIFE (`$` non défini), et actions/quitter du client Défis envoyées au RPC game_action au lieu du namespace configuré. Les anciennes fixtures Preview et un test HTML tronquant une section imbriquée ont été corrigés pour tester l'état courant.

**120/120 tests web**, zéro échec/zéro skip ; **11 suites RLS locales** réussies (Marketplace, Explorer, réservation par lien, Amis/Stories, inbox, story/feed interactions, rôles événements, jeux, Défis, invitations). Les tests Musique et Admin V3 exécutent réellement leurs migrations avec PGlite. Build Vercel réussi. Les politiques Storage préparées sont testées avec PostgreSQL local PGlite, dont idempotence. Pas de changement Lens/AR. Aucun parcours authentifié complet Production ni essai physique iPhone/Android pendant cette mission.

## Procédure de publication et retour web, seulement après autorisation

1. Vérifier à nouveau HEAD, sauvegarde SQL, état public et variables sans afficher leurs valeurs ; valider les migrations nécessaires sur TEST et obtenir l'autorisation SQL distincte.
2. Partir du SHA final de refactor-final dans un checkout propre. `vercel pull --yes --environment=production`, puis `vercel build --prod` ; contrôler exactement 12 fonctions. Cela prépare localement l'environnement ; ne modifier aucune variable distante.
3. Après validation explicite : `vercel deploy --prebuilt --prod` depuis ce checkout, sans merge main ; vérifier l'association SHA de la candidate et le domaine. La branche Git de Production reste main. Ce déploiement doit contenir tout le HEAD courant, jamais l'ancienne version complète GiSMHGJAh.
4. Contrôles réels : connexion/deconnexion, Explorer/réservations, trois hébergements + Expedia Vols + Omio + Viator, Admin, Marketplace à deux comptes, Amis/Stories, événements, musique et caméra sur appareils. Vérifier scopes/suspensions selon fonctions activées et API erreurs. Aucun paiement réel sans périmètre dédié.
5. En cas de défaut, restaurer le déploiement stable capturé juste avant publication via `vercel rollback <URL-stable>` ; actuellement la référence stable est `https://my-event-8iylvuxyo-spegagnemarc-netizen.vercel.app`. Vérifier domaine/SHA. Faire le retour SQL séparément à partir du snapshot sans perdre les écritures intervenues.

**NO-GO PRODUCTION** : écarts SQL confirmés (Musique/Défis/Storage), snapshot/restauration non validés et validations authentifiées/appareils encore nécessaires. Les tests et builds réussis ne lèvent pas ces blocages.
