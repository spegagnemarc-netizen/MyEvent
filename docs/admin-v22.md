# Admin V2.2 — environnement indépendant préparé, non activé

Départ vérifié local/GitHub : `9f4a8f95cb9226c4ce7c0e72d7fccba383ce5dc1`, branche `refactor-final`. Aucun changement de main, du déploiement de production, de MyEvent-API ou de Supabase distant.

## Ce qui fonctionne / ce qui reste

La connexion de l'accueil, de Marketplace et de la caméra IA utilise désormais une configuration commune par environnement. Le webhook serveur vérifie aussi sa destination avant toute écriture. Preview et Development refusent le projet actuel `nxxvadbliinhvkirqkkl`, même si ses variables sont héritées. Une référence explicite de test doit correspondre exactement à l'URL. Pas de fallback, ni de saisie de clé/URL client, ni de récupération de configuration depuis localStorage. Les sessions de test sont séparées de celles de production ; les deux pages du même environnement partagent leur session. Toutes les rubriques Admin V2.1 sont conservées.

**La Preview livrée est bloquée par défaut. Elle n'est PAS encore connectée à une nouvelle base.** Aucun projet de test, compte distant ou migration distante n'a été créé. Les tests réels nécessitent les opérations ci-dessous et une autorisation explicite avant leur exécution par Work.

Le dépôt ne contient pas la création initiale des tables historiques (profiles, events, messages, sondages, réservations, finances...). Rejouer uniquement `supabase/migrations` sur une base vierge ne suffit pas. Les fixtures de tests ne remplacent pas ce schéma. Deux migrations ont aussi le même numéro `202609280002` : ne pas lancer un `supabase db push` aveugle. Les fichiers historiques ne sont pas modifiés.

La voie sûre préparée est **un export complet du schéma courant, sans données**. Il inclut les évolutions historiques et Admin 001/002 déjà présentes ; on ne les réexécute pas sur ce schéma. Il faudra examiner cet export avant de l'approuver. Sans lui, aucun SQL initial complet ne peut être certifié.

## Configuration

| Variable | Development | Preview `refactor-final` | Production |
| --- | --- | --- | --- |
| `VERCEL_ENV` | Fourni par Vercel CLI si utilisé | `preview` fourni par Vercel | `production` fourni par Vercel |
| `MYEVENT_ENV` | `development` hors Vercel | Inutile ; ne remplace pas VERCEL_ENV | Inutile |
| `SUPABASE_URL` | Projet TEST ou http://127.0.0.1:54321 | URL du NOUVEAU projet TEST | Variables propres à la production, jamais changées ici |
| `SUPABASE_PUBLISHABLE_KEY` | Clé publique du TEST | Clé publique du TEST | Clé publique de sa propre base |
| `MYEVENT_TEST_SUPABASE_REF` | Référence TEST, ou `local` | Référence TEST exacte | Non utilisée |

`.env.example` donne les noms, sans clé réelle. `.env*`, `.vercel` et `supabase/test/private` sont ignorés par Git. La route `/api/runtime-config` (réécrite vers un GET dédié de la fonction caméra, handler `server/runtime-config-handler.mjs`) expose uniquement URL, référence, environnement, indicateur de test, clé **publishable publique** et nom de session. Il n'expose jamais service_role, clé secrète, clé OpenAI, mot de passe DB ou variables d'environnement complètes. La clé publishable est un identifiant public requis par le SDK navigateur ; elle ne donne aucun contournement de RLS. Seules les clés `sb_publishable_` sont acceptées, pas les anciennes clés JWT ni `sb_secret_`.

L'endpoint est `no-store`. En cas d'erreur, le message ne recopie aucune valeur de variable. Le bandeau TEST reste au-dessus de l'interface, y compris Admin et Marketplace ; si configuration absente, bandeau CONNEXION BLOQUÉE. Pas de service worker identifié dans ce dépôt. Les anciens déploiements ont encore leur ancienne configuration : ne tester que la nouvelle URL Preview.

## Étapes manuelles — ne rien appliquer au projet actuel

### 1. Nouveau Supabase

1. Dans Supabase Dashboard, créer un projet neuf nommé `MyEvent-Admin-Test`, dans une région appropriée. Vérifier le coût/quota affiché avant de valider. Utiliser un mot de passe DB distinct conservé dans un gestionnaire de mots de passe, jamais dans le chat/GitHub/logs.
2. Noter la nouvelle référence du projet dans l'URL du Dashboard et son URL API. Elle doit être différente de `nxxvadbliinhvkirqkkl`. Dans Settings → API Keys, récupérer uniquement la clé **publishable** pour le raccordement navigateur.
3. Ne pas utiliser une restauration/clonage incluant les données. Ne copier ni Auth utilisateurs/sessions, ni données de tables, ni objets Storage, ni clés du projet actuel.
4. Auth : utiliser le fournisseur Email/Password. Pour les trois comptes fictifs créés manuellement, les confirmer via le Dashboard ; ne pas désactiver la validation d'email globalement et ne pas créer de comptes avec les emails de personnes réelles. Les tests d'email/invitation pourront utiliser ultérieurement une boîte de test dédiée.

### 2. Obtenir la base initiale, en lecture seule

Ces extractions nécessitent uniquement des lectures du projet actuel, aucune migration/écriture. Ne pas les exécuter sans avoir vérifié le projet source et les options.

- Avec la CLI officielle Supabase, utiliser **`supabase db dump --schema public,game_private -f supabase/test/private/current-schema-only.sql`**, sur une connexion source configurée localement. Un dump sans `--data-only` est un dump de schéma ; vérifier son contenu. Ne jamais ajouter `--data-only`, `--use-copy`, exporter auth.users ni un dump de données. Ne pas publier la connexion DB ou cet export avant inspection.
- Le CLI/link n'est pas effectué par Work ici. Employer un terminal local, ne pas fournir la connexion DB en chat ou l'écrire dans l'historique de commande ; suivre la procédure sécurisée officielle. Si des fonctions vivent dans d'autres schémas applicatifs, inclure ces schémas après inventaire.
- Exécuter en lecture seule `supabase/test/storage-policy-export.sql` et `supabase/test/metadata-export.sql` sur la source. Conserver leur résultat localement : seuls configurations de buckets, politiques Storage, triggers Auth applicatifs et publication Realtime sont concernés. Inspecter les définitions : aucune clé, UUID utilisateur codé en dur, URL de webhook ou référence à une donnée personnelle ne doit être recopiée.
- Vérifier les droits par défaut et extensions nécessaires. Ne pas remplacer les tables gérées auth/storage ni importer leurs données. Les triggers Auth personnalisés doivent être recréés séparément après leurs fonctions publiques.
- Le schéma attendu contient déjà les migrations historiques jusqu'à 002 Admin ; **003 ne doit pas avoir été exécutée**. Si `admin_account_controls` existe, arrêter et adapter la procédure.

Préparation locale (sans connexion réseau/SQL) :

```sh
node scripts/prepare-admin-test.mjs supabase/test/private/current-schema-only.sql supabase/test/private/pack
```

Le script refuse les instructions de données top-level, les marqueurs de clés/connexions et un schéma manifestement incomplet ; ce filtre est une protection supplémentaire, pas une certification de tout le SQL. Il écrit un inventaire ordonné et des SHA-256. Le fichier `02-storage-policies.sql` est la **requête d'export source**, pas le résultat à appliquer : sauvegarder séparément le résultat inspecté. Aucun script n'applique du SQL distant.

### 3. SQL définitif — ordre sur la cible TEST, après approbation

| Ordre | Fichier/opération | Condition |
| --- | --- | --- |
| 1 | Schéma initial courant exporté et inspecté (pack `01-current-schema-only.sql`) | Schéma seul, cible neuve, restauration transactionnelle selon la CLI officielle ; schémas/extensions/owners/grants contrôlés. |
| 2 | Résultats inspectés des exports Storage/Auth/Realtime | Uniquement configuration ; ajouter les politiques/triggers/publications manquants, éviter les doublons. Buckets vides. |
| 3 | `supabase/test/readiness.sql` | Lecture seule ; tout objet obligatoire absent bloque la suite. |
| 4 | Vérifier `202610030001_platform_admin.sql`, puis `202610030002_admin_partner_content.sql` | Leur schéma est déjà inclus dans l'export : NE PAS les rejouer. Si absentes, arrêter et diagnostiquer l'export ; ces migrations restent disponibles pour une véritable baseline pré-Admin certifiée. |
| 5 | `supabase/admin/preflight.sql` | Lecture seule ; sauver/contrôler le résultat et un backup de la cible TEST. |
| 6 | `supabase/migrations/202610030003_admin_v2.sql` | Version V2.1 corrigée, inchangée dans V2.2 ; exécuter en entier seulement si jamais appliquée. |
| 7 | `supabase/migrations/202610030004_admin_v21_request_gate.sql` | Version corrigée inchangée ; refuse de remplacer un hook différent. Vérifier ensuite le reload HTTP. |
| 8 | Trois nouveaux comptes Auth puis `supabase/test/accounts.sql` personnalisé | Instructions ci-dessous. |

Ne pas lancer ces fichiers à la suite sans lire les résultats des étapes de contrôle. Pas de script automatiquement connecté à la source ou cible. Les migrations historiques peuvent contenir des graines statiques de jeux ; un schéma seul ne recopie pas ces lignes. Reconstituer uniquement les graines statiques revues si nécessaires à des tests Jeux ultérieurs, jamais les données de parties/utilisateurs. Cela ne bloque pas les sept rubriques Admin.

### 4. Comptes fictifs A/B/C

Dans Authentication → Users du **nouveau** projet, créer trois comptes nouveaux avec trois mots de passe de test différents (ne pas les communiquer à Work) :

- A : `myevent-a@example.invalid`, Admin Test A.
- B : `myevent-b@example.invalid`, Membre Test B.
- C : `myevent-c@example.invalid`, Membre Test C.

Confirmer ces comptes par le Dashboard, sans envoi d'email aux adresses invalides. Copier leurs UUID **du projet neuf** dans une copie locale de `supabase/test/accounts.sql`. Le script refuse les placeholders, les UUID non distincts, les emails différents, un projet sans confirmation et une base qui ne contient pas exactement ces trois comptes. Préfixer l'exécution par `select set_config('myevent.test_project_ref','<REF_TEST>',false);`, puis exécuter dans la même fenêtre. Vérifier encore la référence réelle dans le Dashboard : cette confirmation opérateur ne peut pas la détecter seule. Seul A reçoit super_admin ; B et C restent classiques.

Ne pas utiliser les UUID, email ou profil du propriétaire réel et de sa famille. Ne pas modifier auth.users directement.

### 5. Vercel — Preview uniquement

1. Projet `my-event` → Settings → Environment Variables. Pour **Preview seulement, branche `refactor-final`**, définir URL, publishable et référence TEST du tableau. Ne cocher ni Production ni toutes les branches inutilement.
2. Ne pas saisir `SUPABASE_SERVICE_ROLE_KEY` pour le fonctionnement Admin : les RPC utilisent le JWT utilisateur. Ne pas copier les credentials Stripe/OpenAI/SNCF/partenaires de production. Pour ce test, ne pas appeler leurs fonctions payantes ; désactiver/retirer leurs éventuelles valeurs héritées **dans la portée Preview uniquement**, avec contrôle avant validation. Le webhook Supabase est bloqué si la destination est la base actuelle.
3. Redeployer la branche en environnement Preview. Ne pas choisir Promote to Production, ne pas changer le domaine public, ne pas modifier la branche de production.
4. Ouvrir le nouveau déploiement : bandeau `MYEVENT TEST · preview · <REF_TEST>`. Si CONNEXION BLOQUÉE, ne pas contourner : corriger les trois variables puis redeployer.
5. Configurer Auth → URL Configuration du TEST avec cette URL Preview pour Site URL et les redirections exactes nécessaires. Aucune redirection vers la production. Les invitations conservent le deep link actuel ; vérifier le retour avec ses paramètres. Mettre à jour les redirections si une nouvelle URL immuable est utilisée.
6. Contrôle sans Auth ni écriture : `node scripts/check-test-environment.mjs https://<PREVIEW>.vercel.app <REF_TEST>`. Le script n'affiche jamais la clé ; il vérifie environnement, destination, séparation de session et no-store. Vérifier l'accueil ET `marketplace.html` sur iPhone, Safari puis navigation privée. Une session de production déjà ouverte ne doit pas être récupérée.

## Tests réels après autorisation / raccordement

Utiliser le protocole complet `docs/admin-v21.md` avec A/B/C. Suppléments V2.2 :

1. A, B, C se connectent sur trois sessions séparées ; noms fictifs et bandeau TEST partout. B/C ne peuvent pas lire les contrôles privés, la séquence d'audit ni exécuter les RPC Admin. A voit exactement trois comptes, recherche chacun, annule puis confirme une action.
2. B/C : amis/invitation, Story/like/réponse DM, événement/rôle, annonce et photo ; reconnexion conserve les données. Le contenu de B n'est pas récupérable par un non-ami selon les règles actuelles. Musique et planning/réservations internes conservent leur comportement.
3. Avant suspension, conserver localement un JWT de C, sans l'imprimer ni l'envoyer en chat. A suspend C : nouveau login refusé, anciens JWT refusés en Data API (tables ET anciennes RPC), lecture/upload Storage privés refusés. Tester Storage avec téléchargement privé réel, pas uniquement une URL déjà signée.
4. Realtime : B écoute les messages/Stories du TEST, C ouvre un abonnement avant suspension. B publie une nouvelle donnée fictive après suspension de C. Vérifier ce que reçoit C puis reconnecter son abonnement. Tester aussi Broadcast/Presence si utilisés : le précontrôle PostgREST ne couvre pas ces chemins. Ne pas annoncer la suspension globale validée si l'un d'eux transmet encore des informations privées.
5. A réactive C : login et fonctions récupérés, historique Admin conservé ; répéter le cycle, puis tester un ban Auth externe uniquement sur ce compte jetable. Vérifier qu'une réactivation Admin ne l'efface pas.
6. iPhone Safari 320/390/430 : sept onglets Admin par défilement horizontal, sélection visible, formulaires/recherches, confirmations annulées et confirmées, erreur réseau/reprise, fermeture, pas de débordement ni d'interface sous le bandeau. La fixture `/tests/admin-v21-preview.html` reste un contrôle VISUEL fictif, pas une preuve Supabase.

Ne pas publier des tokens, réponses contenant des profils personnels ou clés dans le rapport. Rapporter uniquement code HTTP/résultat attendu, nom fictif et statut de chaque test.

## Résultats réalisables maintenant

- Configuration : validation de l'URL et de la référence ; refus du projet actuel, des clés secrètes/JWT et des destinations arbitraires ; distinction Production/Preview/Development et sessions ; endpoint public sans secrets, no-store et erreur générique.
- Client : bandeau et refus de connexion si absent ; même clé de session dans les deux entrées.
- Préparation SQL : refus d'exports de données/secrets, détection d'une installation 003 déjà présente, inventaire des fichiers historiques et contrôle byte-identique de 003 dans le pack.
- Caméra IA/webhook : suites avec destinations fictives, sans réseau réel.
- Tests Admin V2.1 conservés : 170 contrôles de régression, 11 activation, sept rubriques UI. Aucune modification de SQL 003/004 ou du lecteur Stories/Musique.

Les résultats distants Auth/RLS/Storage/Realtime, le schéma historique complet, le reload PostgREST et Safari natif restent NON VALIDÉS tant que le TEST neuf n'est pas créé/configuré. Une Preview bloquée confirme l'absence de fallback, pas l'existence d'une base de test.

## Retour arrière

- Configuration TEST erronée : retirer les trois variables **Preview/refactor-final seulement** et redeployer ; la connexion revient à l'état bloqué. Ne jamais rétablir la base actuelle comme fallback.
- SQL TEST : sauvegarder d'abord, utiliser la procédure `docs/admin-v21.md` et `supabase/admin/rollback.sql`. Réactiver les suspensions gérées avant ce retrait ; le script garde l'audit et les données. Pour un TEST jetable neuf, recréer un projet neuf peut être préférable à une restauration partielle, mais toute suppression distante exige une validation explicite.
- Code : préparer un revert sur refactor-final après validation ; revenir à la version précédente remettrait ses connexions codées en dur et NE constitue PAS un retour sûr pour les tests. Aucune action sur main/domaine de production.

## Fichiers

Configuration : `server/supabase-environment.mjs`, `server/runtime-config-handler.mjs`, `vercel.json`, `js/runtime-config.js`, `.env.example`, `.gitignore` ; intégrations minimales dans `index.html`, `marketplace.html`, `js/core-runtime.js`, `js/marketplace-config.mjs`, `js/marketplace.mjs`, `api/camera-ai.js`, `api/stripe-webhook.js`. Préparation : deux scripts hors ligne/lecture seule, quatre SQL sous `supabase/test`. Tests : `tests/admin-v22-environment.test.mjs`, fixtures d'environnement caméra/webhook adaptées. Aucun secret réel ajouté.

Sources officielles : https://supabase.com/docs/guides/getting-started/api-keys ; https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore ; https://supabase.com/docs/guides/local-development/database-migrations ; https://vercel.com/docs/environment-variables .

Le premier build a atteint la limite Vercel Hobby de 12 fonctions. La route de configuration réutilise désormais la fonction caméra existante sur un GET dédié, sans modifier ses POST ni ajouter une treizième fonction.
