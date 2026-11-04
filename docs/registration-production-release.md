# Publication fiche membre — opération de base à valider

Production vérifiée le 4 novembre 2026 : orevami.com, projet Vercel `my-event` (`prj_njkjpiO5evwffsbcqwfTpSHxJd8C`), déploiement `dpl_2zwFMaxSLYqb5GCcAHf1bWyfNE3v`, commit `16abbafb5502b6869a9d3c4be80c862341b87a44`. Configuration Web : Production / Supabase `nxxvadbliinhvkirqkkl`. Réglages publics Auth : e-mail activé, confirmation obligatoire, téléphone désactivé. Aucune modification de ces réglages.

Le correctif `18b63b1` est reporté sur cette base réelle, en préservant les fonctions existantes. Le diff de publication porte uniquement sur la fiche, ses points d’entrée et les textes associés ; aucune reprise globale de sa vieille base `213c203`. Les conflits sur accueil, runtime et confidentialité ont été résolus en conservant la Production et en appliquant les seules insertions nécessaires.

## Installation nouvelle, absente de 18b63b1

`registration-production-v1.sql` crée un schéma privé et trois tables (fiche, choix de consentement, brouillons temporaires), quatre fonctions privées et sept RPC limitées, un déclencheur d’inscription sur `auth.users`, un bucket photo privé limité à 2 Mo et cinq politiques de stockage. La purge toutes les 15 minutes réutilise pg_cron, déjà installé. Les brouillons expirent après 15 minutes ; aucun mot de passe n’y est conservé. Aucun service payant.

La Production ne possède actuellement aucune de ces tables/fonctions : le script TEST de modification de quatre fonctions ne peut pas s’y appliquer. Cette installation dépasse donc la simple publication du commit testé et est présentée comme l’unique opération supplémentaire à valider.

Le script s’exécute en transaction sur le projet exact `nxxvadbliinhvkirqkkl`, avec `select set_config('app.settings.project_ref','nxxvadbliinhvkirqkkl',false);` dans la session d’installation. Il refuse une installation existante ou des helpers de sécurité manquants. Il ne modifie ni comptes/profils existants, ni index historiques, ni réglages Auth/SMTP, ni garde globale d’accès, ni droits adultes. Les nouvelles écritures de profil résultent seulement d’une inscription ou modification demandée par le membre. Les comptes incomplets ne sont pas bloqués.

## Vérifications limitées aux blocages

Les RLS des profils Production sont actives et limitent écriture/lecture directe au propriétaire, avec restriction supplémentaire des comptes suspendus. Les nouvelles tables privées sont sous RLS et sans accès direct aux rôles visiteurs/membres. Les fonctions contrôlent le compte actif et l’identité du demandeur ; les adresses privées et naissances ne sont jamais dans la projection partagée.

Les comptes sans droit adulte établi gardent une fiche privée même s’ils choisissent une option de partage. Le partage facultatif photo/intérêts/présentation nécessite le droit adulte existant des deux comptes, une relation autorisée et l’absence de blocage de sorties. Déclarer/modifier une naissance n’accorde aucun droit adulte. Les activités générales et restrictions existantes sont conservées ; aucun nouvel âge minimal global arbitraire.

Des politiques de stockage historiques peuvent être permissives : le nouveau bucket est protégé par une politique restrictive dédiée et une exclusion anonyme, en plus des politiques propriétaires. La vérification PostgreSQL locale a démontré qu’une ancienne lecture large ne donne pas accès à la nouvelle photo privée.

Vérification locale nouvelle de la migration : compte historique préservé, consommation atomique du brouillon au déclenchement d’inscription, absence du jeton dans les métadonnées finales, fiche personnelle modifiable, isolement des données privées, restrictions mineurs/adultes et blocage des photos malgré une politique permissive simulée. Aucun test des six déjà validés n’a été relancé. Aucun compte, e-mail ou SMS réel créé/envoyé ; aucune écriture Production effectuée à ce stade.

## Exécution après validation de cette seule opération

Appliquer la transaction SQL sur la cible vérifiée, contrôler le catalogue/droits et le déclencheur, puis publier le candidat adapté en Production Vercel. Vérifier en lecture seule l’alias orevami.com, son SHA et les fichiers réellement servis. Pour certifier toute la chaîne d’inscription, effectuer une unique inscription technique contrôlée avec réception réelle de l’e-mail et modification de fiche ; ne pas qualifier la livraison d’e-mail de validée sans cette preuve. Android et ORÉVAMI Pro restent hors périmètre.

En cas d’erreur avant commit SQL, la transaction ne laisse aucun objet partiel. Après installation, le retour arrière Web revient au déploiement ci-dessus. Si le nouveau déclencheur perturbe Auth, désactiver uniquement `registration_signup_v1` sur `auth.users`. Garder les nouvelles tables et politiques privées pour préserver les éventuelles fiches créées ; conserver la purge des brouillons. Aucune suppression de données automatique prévue dans le retour arrière.
