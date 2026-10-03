# Admin V2.1 — rapport avant activation

État de départ contrôlé : `74588a061b3bd0bd3cd59bfeb7d0c5c61b4a7472` sur `refactor-final` (local et GitHub identiques). Aucun changement de `main`, de MyEvent-API, de domaine de production ou de base distante.

**Statut : sécurisation validée localement ; activation et validation Supabase réelles encore à effectuer.** La migration 003 est corrigée avant sa première exécution, conformément à la mission. Si une copie antérieure de 003 a déjà été exécutée, arrêter : ces fichiers ne constituent pas une mise à niveau de cette copie.

## Résultats de l'audit

| Risque | Correction |
| --- | --- |
| Politique restrictive appliquée aveuglément à tout `public` | Liste explicite des tables MyEvent ; les tables optionnelles absentes sont ignorées, une table applicative sans RLS provoque un arrêt transactionnel. Les politiques existantes ne sont pas remplacées. |
| RLS contournée par une ancienne RPC `SECURITY DEFINER` | Précontrôle PostgREST sur chaque requête Data API (004 séparée). Impossible de suspendre par Admin tant que ce hook n'est pas configuré. Aucun ancien module réécrit. |
| Risque de récursion des politiques | Helper `SECURITY DEFINER`, `search_path=''`, lecture des tables privées Auth/contrôles ; expression RLS non corrélée, sans lecture de la table protégée. |
| Ban Auth externe supprimé à la réactivation | Sauvegarde du ban précédent ; restauration uniquement si le ban actuel est toujours celui géré par MyEvent. Une modification externe ultérieure est préservée. |
| Jeton existant encore valable après ban | RLS + précontrôle Data API ; `storage.objects` a sa propre restriction. Le ban Auth empêche les nouvelles connexions. |
| Hook PostgREST existant écrasé | 004 refuse un hook différent ou une configuration par base ; aucune substitution automatique. |
| Colonnes/permissions différentes en base réelle | Précontrôle en lecture seule fourni ; 003 vérifie les colonnes obligatoires et le droit de modifier `banned_until`, et s'arrête en cas d'écart. |
| Contournement de l'audit via modification directe de visibilité | Trigger exige le contexte du propriétaire de la RPC pour l'exception Admin ; propriétaire d'événement toujours protégé. |
| Accès direct aux contrôles/journal/séquence | Tables privées RLS, privilèges retirés aux clients ; RPC administratives vérifient super_admin actif. Fonctions de trigger et helpers internes non exécutables par le client. |
| Audit bloquant une future suppression Auth | Identifiant acteur conservé sans FK ; références facultatives des signalements mises à NULL lors d'une suppression. |
| Retour tardif d'une requête après changement de compte | Génération de session contrôlée, purge immédiate de l'écran et rejet des réponses obsolètes. |
| Double action ou erreur réseau masquée | Blocage des mutations concurrentes, confirmations, erreurs de RPC/rechargement affichées, aucune réussite fictive. |

### Limites de sécurité à valider réellement

Le hook PostgREST ne couvre pas Realtime ni Storage ; Storage est protégé séparément. Vérifier Realtime avec un jeton déjà obtenu (y compris Broadcast/Presence s'ils sont employés). Les fichiers publics et URL signées déjà délivrées ne sont pas révoqués rétroactivement par une RLS ; les contenus déjà téléchargés ne peuvent pas être retirés. Les services utilisant `service_role`/un propriétaire SQL sont des chemins serveur de confiance et contournent la RLS : leur autorisation propre doit être contrôlée avant une activation globale. `MyEvent-API` n'a pas été modifié ni validé dans cette mission.

La valeur `suspension_gate_ready` indique la configuration SQL, pas une preuve de rechargement effectif de PostgREST. Un essai HTTP réel reste obligatoire.

## Tests réalisés

| Vérification | Résultat |
| --- | --- |
| `tests/admin-v21-regression.test.mjs` | 170 contrôles réussis : trois identités, migrations réelles du dépôt, permissions, anciennes RPC, tables privées, séquences, RLS directe, Storage, bannissements externes, restauration. |
| `tests/admin-v21-activation.test.mjs` | 11 contrôles réussis : colonnes manquantes, RLS désactivée, atomicité après rollback, hook existant, suspension avant activation refusée, paramètres invalides et ban externe. |
| `tests/admin-v2.test.mjs` | Rôles Admin, suspension/réactivation, modération, signalements, configuration et journal réussis. |
| `tests/admin-v2-ui.test.mjs` | Sept rubriques, recherche, annulation, double clic, erreur/reprise, audit et changement de compte réussis (JSDOM). |
| Suites RLS existantes | Amis/Stories, invitations (20), interactions Stories, likes/commentaires du fil, messagerie (68), rôles événements, Marketplace (34), Jeux (68), Défis (19) : réussies. |
| Tests Node existants | 44/47 réussis. Trois échecs reproduits également sur le HEAD initial dans un worktree détaché : namespace Défis (`defis_action`), deux attentes Viator (`website`, `price`). Hors périmètre, non corrigés. |
| Intégrité Musique | Test exécuté avec PGlite activé, réussi sans skip. |
| Syntaxe / diff | `node --check js/admin-runtime.js`, `git diff --check` : réussis. |

PGlite utilise PostgreSQL isolé, des données fictives et les migrations du dépôt ; le précontrôle HTTP y est appelé explicitement pour modéliser PostgREST. Cela ne valide ni le schéma réel distant, ni GoTrue, ni le rechargement HTTP, ni Safari natif.

Le banc visuel `tests/admin-v21-preview.html` affiche le vrai fragment Admin de `index.html`, ses styles et le vrai `admin-runtime.js`, avec RPC fictives clairement signalées et aucune connexion Supabase. Largeurs 320/390/430 px sélectionnables. Sert aux vérifications sur la Preview uniquement ; ne prouve pas les permissions distantes.

## Opérations manuelles Supabase — ordre impératif

1. **Identifier un projet Supabase de TEST isolé.** L'application a actuellement `nxxvadbliinhvkirqkkl.supabase.co` codé dans sa configuration ; une Preview Vercel seule ne sépare donc pas la base. Ne pas exécuter ces migrations sur cette base partagée/production pour tester cette mission. Vérifier la configuration de toutes les pages autonomes avant connexion des trois comptes de test.
2. Sauvegarder le projet de test (schéma, données, Auth, configuration du rôle `authenticator`, politiques, fonctions et grants). Confirmer une restauration utilisable. Les fichiers Storage nécessitent leur propre copie ; un dump SQL seul ne copie pas les médias. Sauvegarder le résultat complet de `supabase/admin/preflight.sql` et contrôler ses résultats. Ne pas transmettre de secrets ni de données personnelles inutiles.
3. Confirmer que 001 et 002 Admin sont déjà présentes et que **003 n'a jamais été appliquée**. Comparer les colonnes, signatures de fonctions, politiques et tables avec le précontrôle. Un écart nécessite une correction ciblée avant de poursuivre.
4. Exécuter **`supabase/migrations/202610030003_admin_v2.sql` corrigée**, en entier, dans le SQL Editor du projet de test. Installation transactionnelle ; si erreur, effectuer `ROLLBACK` et diagnostiquer sans contourner le précontrôle.
5. Exécuter **`supabase/migrations/202610030004_admin_v21_request_gate.sql`** en entier. Si hook préexistant ou privilège `ALTER ROLE` absent, arrêter et faire revoir la configuration ; ne pas remplacer manuellement un autre hook. Contrôler le rechargement PostgREST par une vraie requête HTTP.
6. Sur la Preview associée au projet de test, réaliser le protocole A/B/C ci-dessous. Aucun test sensible sur le domaine de production.
7. Ne demander une activation réelle qu'après validation documentée de ces tests. Aucune promotion de déploiement n'est prévue ici.

### Protocole A/B/C

- A : super_admin de test, B : utilisateur actif, C : utilisateur à suspendre. Se connecter sur trois sessions séparées et conserver le JWT de C **avant** suspension pour les requêtes de contrôle.
- B : profils, invitation d'ami, création/lecture Story, like/réponse privée, message, création et gestion événement, annonce Marketplace, playlist/vote Musique, sortie/réservation. Reconnexion : données persistantes. RPC Admin, contrôle direct des tables Admin et tentative de modification d'autres utilisateurs doivent échouer.
- A : parcourir les sept rubriques, rechercher un profil, consulter dates/statuts, annuler une action sensible, puis confirmer une suspension avec motif. Le journal contient acteur/action/cible/date. Vérifier une erreur réseau et une reprise sans double action.
- C suspendu : nouvelle connexion refusée ; avec son **ancien** JWT, requêtes Data API tables et anciennes RPC Amis/DM/événement/Jeux/Musique refusées. Upload/lecture Storage privés refusés. Tester reconnexion Realtime et abonnement déjà ouvert ; vérifier qu'aucune nouvelle donnée privée ne reste reçue. Les contenus de B restent fonctionnels.
- A réactive C : nouvelle connexion et données antérieures récupérées ; le journal conserve les deux actions. Répéter suspension/réactivation ; tester un ban Auth externe dans le projet jetable et vérifier qu'il n'est jamais effacé par MyEvent.
- A masque/réactive événement et annonce : découverte non-membre cohérente, droits propriétaire/membre préservés, aucun transfert de propriété ni suppression définitive. Tester signalement de contenu inaccessible refusé, résolution/réouverture journalisée.
- Partenaires/paramètres : état et note persistants avec confirmations/journal. Les paramètres de modules sont une configuration préparatoire, ils n'interrompent pas automatiquement les modules existants.
- iPhone réel : sept onglets accessibles par défilement horizontal, rubrique active identifiable, formulaires sans zoom automatique ni débordement, fermeture et retours de navigation, erreurs lisibles. Banc visuel sans données réelles : `/tests/admin-v21-preview.html`.

## Retour arrière

Préférer la restauration vérifiée du projet de test si installation partielle ou incompatibilité de schéma. Pour un retrait ciblé après installation réussie : exporter le journal, réactiver les suspensions MyEvent (les bans Auth externes restent protégés), puis exécuter `supabase/admin/rollback.sql`. Le script refuse de poursuivre s'il reste une suspension gérée, retire uniquement les politiques ajoutées, révoque les mutations Admin, restaure les trois fonctions sauvegardées et retire uniquement notre hook. Il garde les tables/données/journal. Il n'annule pas individuellement les changements de visibilité/modération ; les rétablir explicitement si nécessaire. Ne pas réexécuter 003 après ce retrait : restauration ou nouvelle migration de reprise.

## Fichiers

- Interface : `index.html`, `css/admin-v2.css`, `js/admin-runtime.js`.
- SQL : 003 corrigée, 004 nouvelle, `supabase/admin/preflight.sql`, `supabase/admin/rollback.sql`.
- Tests : deux tests Admin existants ajustés ; fixture DB, régression, activation et deux pages visuelles V2.1 ajoutées.
- Ce rapport : `docs/admin-v21.md`.
