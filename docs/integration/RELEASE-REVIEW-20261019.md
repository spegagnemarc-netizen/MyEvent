# ORÉVAMI — revue avant Production, 19 octobre 2026

Décision : **publication déconseillée en l'état**. Aucun changement de main, du
domaine, de Supabase Production ou de MyEvent-API n'a été effectué. Aucun script
SQL V1.5 ni activation de compte n'a été appliqué.

## Références vérifiées

| Élément | Référence |
| --- | --- |
| Candidat examiné | `411f933a6dac7b7f1d6aba9447666509f9b5ec86` |
| Branche | `integration/production-preserved-20261019` |
| Preview READY | https://my-event-4mo6au1r1-spegagnemarc-netizen.vercel.app/ |
| Atelier de composants | https://my-event-4mo6au1r1-spegagnemarc-netizen.vercel.app/tests/integration-preview.html |
| Production réellement servie par orevami.com | `14b89e021906071bcb56f81c340f6cb839f54423` |
| Déploiement Production conservé | `dpl_4NKRbJpZNkhvuHWHQSWH8eJXpcKs` |
| URL immuable du déploiement précédent | https://my-event-dpzclvqqo-spegagnemarc-netizen.vercel.app |

La référence Production a été relue après la reprise. Elle est ancêtre du
candidat. La branche n'est pas une fusion globale de refactor-final.

## Conservation et tests

37 tests ciblés réussis, zéro échec, sur les 16 fichiers de tests des composants
Activités, navigation, géographie, fiches, analyse publique et conservation.
Ils ont été exécutés une fois pour cette revue ; les jeux n'ont pas été rejoués.

Le contrôle de conservation confirme 347 fichiers Production identiques : jeux,
Musique, caméra, Stories, événements, discussions, sondages, Marketplace,
fil, styles et SQL existants. Le HTML initial, les routes et le corps de recherche
existant sont préservés. Cela prouve la conservation du code ; cela ne certifie
pas tous les parcours authentifiés ni les interactions avec des fournisseurs.

Le delta contient 40 fichiers, 2529 lignes ajoutées et une ligne remplacée.
Cinq fichiers existants évoluent : index.html, package.json, pnpm-lock.yaml,
api/search-places.js et vercel.json. Les autres sont nouveaux. Quatre dépendances
sont ajoutées pour l'analyse : canvas 1.0.11, cheerio 1.2.0, ipaddr.js 2.5.0 et
pdfjs-dist 6.4.299. La résolution Stripe 22.6.2 est conservée. La déclaration
Stripe `latest` et le CDN Supabase JS `@2` restent des risques de reproductibilité
préexistants ; aucun audit de vulnérabilités complet n'est revendiqué.

Parcours navigateur réel confirmé sur l'atelier Preview : cadre Sorties → grande
page sombre → création en brouillon → « Patinoire à Gap » → Alp'Arena → fiche →
« Organiser une sortie ici » → récapitulatif prérempli → retour au fil.
Les 42 catégories sont présentes. Le lien GPS contient les coordonnées OSM
44.5604719, 6.0856607 ; aucune géolocalisation personnelle n'a été demandée.
Le lien d'itinéraire a été inspecté, pas parcouru dans Google Maps.

L'analyse réelle du site municipal récupère adresse, téléphone, horaires et un
PDF tarifaire daté du 01/05/2023. La fiche signale sa validité non confirmée,
le lien de réservation non confirmé et la différence entre adresse OSM et site.
Aucune réservation ni publication n'a été faite. Le préremplissage demeure un
brouillon, sans persistance revendiquée. Capture : review-20261019/alparena-desktop.jpg.

Marseille, repli fournisseur, non-effacement d'adresse et erreurs d'enrichissement
sont couverts par les tests locaux ; ils n'ont pas été rejoués en navigateur.

## Blocages et portée publiable

1. `activities-runtime.js`, `activity-social-feed.js` et
   `server/integration-venues.js` exigent Preview et le projet TEST exact.
   En Production, le cadre, la grande page et la nouvelle API ne sont pas
   disponibles. Publier ce SHA ne rendrait pas ces nouveautés visibles.
2. Création, participation et modifications sont bloquées intentionnellement
   par le dispatcher en lecture seule. Les catégories fines, les frais séparés,
   le catalogue de lieux et les photos ne sont pas validés en stockage complet.
   Les propositions V1.5 du checkout refactor-final sont exclues du candidat.
3. L'application complète Preview arrive sur la connexion, sans session TEST
   authentifiée disponible pour cette revue. Les parcours privés des anciens
   modules ne sont donc pas certifiés de bout en bout.
4. Aucun test Safari/iPhone physique n'a été effectué. Le contrôle local à
   largeur 390 px n'a pas pu être ouvert par le navigateur de contrôle ; aucun
   contournement n'a été tenté. Le rendu mobile reste à valider.
5. Les évolutions Musique locale/DJ et PDF location sont explicitement hors de
   ce lot. La version Musique de Production reste conservée.

Les composants visuels et de recherche sont validés pour Preview. **Aucune
nouveauté Sorties n'est prête à être annoncée comme accessible en Production
avec ce commit.** Préparer un lot public distinct, éventuellement limité à la
recherche de lieux sans création ni inscription, puis refaire uniquement les
contrôles affectés avant de demander l'autorisation de publication.

## Supabase et permissions — lecture seule

TEST : PostgreSQL 17.11, sept tables Activités avec RLS et six RPC publiques.
Production : PostgreSQL 17.6, schéma activities_private absent, zéro RPC
Activités. Toutes les tables examinées dans public et game_private ont la RLS
activée. L'historique de migrations Production renvoie une liste vide : ce n'est
pas une preuve d'absence des schémas installés manuellement.

TEST manque notamment de tables Production utilisées par Musique, notifications,
DM et interactions Stories. À l'inverse, TEST possède des tables de régie et le
socle Activités absents de Production. Il ne faut pas déduire la parité des bases
du seul code identique, ni recopier des migrations TEST en Production.

L'advisor Production signale des éléments préexistants : 39 fonctions SECURITY
DEFINER exécutables par anon, un search_path mutable et la protection des mots
de passe compromis désactivée. Les tables privées sans politique restent en
refus par défaut ; ce constat seul n'est pas une fuite. Les autorisations des
fonctions doivent être évaluées avec leurs gardes internes avant conclusion.
Aucune correction RLS ou permission n'est appliquée par cette mission.

Références : https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
et https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

Pour conserver les nouvelles fonctions masquées : **aucun SQL Production
nécessaire**. Pour publier de vraies activités persistantes : conception et
validation séparées du socle, des droits, de la modération et du verrou serveur
d'inscription avant toute migration Production autorisée. Le SQL TEST V1.5 ne
constitue pas un script Production prêt à exécuter.

## Publication et retour arrière — procédure proposée, non exécutée

1. Résoudre les blocages, fixer le périmètre public et son SHA exact. Préserver
   la base Production ci-dessus ; exclure données fictives, activation adulte
   TEST et scripts de démonstration.
2. Valider une session fictive TEST et Safari iPhone. Examiner les dépendances
   et permissions nécessaires au lot retenu. Vérifier le nouveau diff depuis la
   Production réelle, pas seulement depuis main.
3. Obtenir la confirmation finale pour ce SHA, les changements main éventuels
   et le plan exact de déploiement. Sans cette confirmation, aucun build cible
   Production, promotion de domaine, changement main ou SQL Production.
4. Après autorisation seulement : construire un déploiement cible Production
   sans lui affecter le domaine, vérifier la configuration Production sans
   afficher de secrets, réaliser les contrôles non destructifs puis promouvoir
   ce même déploiement. Une Preview n'est pas l'artefact Production validé.
5. En cas d'anomalie, remettre le domaine sur
   `dpl_4NKRbJpZNkhvuHWHQSWH8eJXpcKs` avec le rollback Vercel autorisé, puis
   vérifier connexion, accueil et recherche. Suspendre toute nouvelle promotion
   automatique ; le rollback Vercel peut désactiver l'affectation automatique.
6. Un rollback applicatif ne restaure ni données ni schéma. Aucun SQL n'est prévu
   pour le lot actuellement fermé ; toute future migration requiert son propre
   plan de compatibilité et de restauration. Ne jamais détruire de données pour
   revenir à la version précédente.

Cette revue n'autorise pas la publication. Le SHA candidat reste inchangé ; ce
rapport et sa capture sont des pièces de revue locales, non déployées.
