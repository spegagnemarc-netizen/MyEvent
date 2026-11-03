# ORÉVAMI — fiche membre minimale en TEST

Branche locale `test/member-registration-safety-20261103`, base Web `213c2036403ca742afaac27af3548f232bebccd2`. Aucun push, merge, déploiement, build Android, modification SMTP/Auth ou service payant.

## Existant réutilisé

Profil Web modifiable (pseudo, nom affiché, avatar facultatif), authentification Supabase, demande de suppression manuelle et lien confidentialité. Les sorties ont déjà Signaler / Bloquer l’organisateur. La base TEST possède aussi les fonctions de signalement/blocage de membres ; leur présence ne démontre pas une protection complète de tous les parcours du Web actuel.

V1 retrouvée dans le chantier local du 23 octobre : page d’inscription séparée sans scripts partenaires, SDK local et schéma `registration_private` déjà installé sur TEST `ahyyknfjsielnqyoxqgh`. Pas de réinstallation globale de cette V1, ni de reprise de ses changements de messagerie/appels.

## Corrections réalisées

- Reprise du formulaire V1 : pseudo et naissance déclarée requis ; prénom et ville facultatifs. Nom civil, téléphone et contact d’urgence non demandés. E-mail privé ; statut de confirmation issu d’Auth, aucune fausse vérification de téléphone ou d’identité.
- Centres d’intérêt et présentation facultatifs dès l’inscription ; photo privée facultative après connexion/confirmation, supprimable depuis la fiche. Visibilité privée par défaut. Une projection serveur restreinte affiche uniquement les éléments volontairement partagés dans la fiche d’un membre. Avatar public historique distinct, explicitement indiqué.
- Modification de la fiche depuis le profil, e-mail de connexion en lecture seule, contrôle des formats et dates côté serveur. Aucune majorité attribuée par la date déclarée ; droits et restrictions des sorties adultes conservés. Pas de nouvel âge minimal global inventé : la politique inclusive existante reste inchangée.
- Fin de l’obligation de double confirmation e-mail/téléphone en TEST. Une fiche incomplète n’entraîne plus le blocage global des requêtes ; le contrôle des comptes suspendus est conservé. Les profils historiques restent accessibles et peuvent compléter leur fiche.
- Message « Demande prise en compte », sans promettre création, livraison d’e-mail ou confirmation. Erreurs Auth affichées. Aucun réglage d’envoi changé.
- Suppression de l’utilisation automatique de la partie locale de l’e-mail pour le nom public des nouveaux profils Web. Les anciens noms ne sont pas réécrits automatiquement.
- Consentements TEST et marketing séparé, décoché ; information publique/privée, accès/rectification et suppression accessibles. Anciennes coordonnées/identités éventuelles conservées sans nouvelle collecte ; leur nettoyage demande une décision de conservation.

Le SQL `docs/registration-minimal-test-v2.sql` adapte quatre fonctions existantes, sans ajouter de table ni élargir les droits. Il exige la confirmation explicite de la cible TEST et a été appliqué uniquement avec l’identifiant de projet TEST. Le script de retour arrière restaure leurs définitions exactes antérieures. Ces scripts ne sont pas une migration Production : celle-ci ne possède pas l’ensemble de la V1 et nécessite un lot séparé.

## Vérification ciblée

Six tests Node/DOM réussis : inscription minimale et brouillon privé, consentement/date future, erreur Auth, édition d’un compte incomplet et deux tests existants de conservation des invitations. Vérification syntaxique des fichiers modifiés et contrôle du diff réussis.

Test transactionnel PostgreSQL réel sur TEST, intégralement annulé : validation, refus date future et absence de consentement, enregistrement/lecture personnelle, impossibilité de lire la fiche privée d’un autre membre, absence de droits directs sur le schéma privé, confirmation e-mail suffisante sans téléphone, accès maintenu pour fiche manquante. Une première exécution a correctement refusé un faux utilisateur inexistant ; test corrigé avec deux utilisateurs fictifs transactionnels. Contrôle après installation : zéro compte fictif restant, RLS active, aucun droit de lecture directe des fiches privées.

Advisors relus sur TEST : protections privées par fonctions contrôlées et schémas sans droits directs ; avertissements hérités à examiner avant publication. Aucun ajout de privilège ou de fonction publique dans ce lot. Pas de validation de livraison d’e-mail/SMS, de recette sur appareil ou de déploiement Preview annoncée.

## Android et limites restantes

`spegagnemarc/myevent-mobile` renvoie 404 via GitHub connecté et « Repository not found » via Git. Aucun dépôt de remplacement supposé. Le cache du 2 novembre permet seulement une lecture historique : WebView vers orevami.com, HTTPS même origine embarqué, autres liens ouverts dans le navigateur système, sans retour Auth natif démontré. Il ne prouve pas le comportement de l’Alpha actuellement distribué.

Le problème de confirmation Android reste séparé : ni cause SMTP prouvée, ni correction native certifiée. Le nouveau texte Web évite la fausse réussite dans le candidat ; il ne répare pas la livraison d’e-mail. Retour de lien dans la bonne session, URL de redirection TEST autorisée et éventuel deep link devront être vérifiés sur l’Alpha réel. Aucun build lancé.

Dans les sorties, signalement et blocage organisateur sont présents dans les sources. L’interface générale Amis du Web de base ne raccorde pas encore les boutons de blocage/signalement de la V1 retrouvée : manque identifié, pas de garantie globale de sécurité annoncée. Les anciennes protections de sorties et les fonctions TEST sont conservées.

## Avant publication

1. Donner accès au dépôt mobile exact et à l’Alpha de test pour vérifier le retour de confirmation, sans build implicite.
2. Autoriser un déploiement de cette branche en Preview TEST et confirmer uniquement ses URL de retour si elles manquent. Effectuer une seule recette inscription → e-mail réel → connexion → modification/photo, puis visibilité avec deux comptes TEST. Rien n’a été publié dans cette mission.
3. Valider le public mineur, les règles d’âge adaptées, les textes CGU/confidentialité, conservation/purge des brouillons et anciennes coordonnées, traitement effectif des demandes d’accès et suppression (Storage compris). La fiche déclarative ne constitue pas une garantie de sécurité des rencontres.
4. Raccorder et vérifier la sécurité des membres hors sorties avant de promettre une couverture générale. Préparer une migration Production complète et compatible séparément ; demander l’autorisation explicite avant migration, publication ou build Android.

Références techniques consultées : https://supabase.com/docs/reference/javascript/auth-signup et https://supabase.com/docs/guides/database/postgres/row-level-security.
