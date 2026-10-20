# ORÉVAMI — Activités & Rencontres, 20 octobre 2026

## Reprise et vérification

Le candidat cee926fd46f5d154f1f5facae881133596eee34d, absent de GitHub, a été retrouvé dans le clone local du 18 octobre. Son histoire (222fea1 puis cee926f) a été importée par archive Git et fusionnée dans work/orevami-majority-audit-20261020. Le travail antérieur est conservé. Aucun changement sur main.

Lecture ciblée de Production nxxvadbliinhvkirqkkl : le catalogue complet du module correspond exactement à la référence du script corrigé du candidat récupéré ; enabled=false, registrations_enabled=false ; zéro accès adulte non révoqué. Sept tables RLS, six RPC existantes. Aucun ancien script d'installation réexécuté.

## Changements préparés

- Client : plus de compte TEST nominatif ; toute personne éligible reçoit ses capacités du serveur V3. Création, consultation, inscription, désinscription, acceptation/refus et participants utilisent les RPC existantes, sans seconde base Activités. Les capacités V2/manuelles ne permettent aucune nouvelle écriture dans ce client. Le bouton d'amitié existant est conservé et raccordé à sa RPC déjà utilisée ailleurs.
- Interface et styles conservés ; ajout du bouton d'acceptation manquant pour les demandes. Photos toujours en aperçu local, discussion toujours indisponible : ces limites préexistantes ne sont pas présentées comme terminées.
- Proposition SQL 003 : enrichit adult_access, sans autre table d'activités ni copie de données. Preuve automatique horodatée et expirante, référence de session hachée, source ; approved_by n'est plus inventé pour une vérification automatique. allowed() et capabilities() exigent une preuve automatique valide ; l'acceptation vérifie également celle du participant.
- Les deux RPC de preuve sont réservées à service_role. Les fonctions privilégiées restent privées ; les façades publiques sont SECURITY INVOKER et refusent anon/authenticated. Aucun droit direct aux tables ajouté. Les contrôles existants de capacité, verrouillage, visibilité, adresses et signalements sont conservés.
- Traitement serveur préparé dans server/majority-verification.mjs : désactivé par défaut, authentification getUser côté serveur, identifiant de liaison aléatoire sans nom/email/UID transmis au prestataire, relecture du résultat prestataire, seuil 18 explicite et correspondance de session. Une preuve négative, expirée ou révoquée ne devient pas positive par rejeu.

## Ce qui reste fermé et non intégré

**Aucun parcours de vérification fournisseur réel n'est opérationnel.** Le service est un composant préparé avec adaptateur injecté : il ne contient ni adaptateur réseau Yoti finalisé, ni route HTTP publique, ni bouton de lancement. Il ne peut pas fonctionner avec de simples variables d'environnement. Le consentement au prestataire, les paramètres du contrat et les identifiants sécurisés sont nécessaires pour finaliser ces éléments. Aucune promesse de majorité vérifiée sur un vrai compte n'est faite.

Les opérations Activités sont vérifiées sur PostgreSQL local et sur le client avec réponses contrôlées, pas avec des personnes ou des données Production. Aucun parcours distant authentifié, nouvelle Preview, essai fournisseur, activation ou écriture Production. Le nouveau SQL est une proposition non appliquée.

## Choix proposé, sans engagement externe

Yoti Age Verification est le candidat proposé : attribut de seuil 18+ via Digital ID, avec alternative hébergée à définir selon disponibilité France/UE. Ne pas utiliser une estimation faciale seule sans méthode et seuil de sécurité validés. La documentation prévoit le résultat de seuil et la minimisation :

- https://developers.yoti.com/age-verification
- https://developers.yoti.com/age-verification/methods
- https://developers.yoti.com/age-verification/data-privacy
- https://www.yoti.com/terms/age-verification/organisations/
- https://www.yoti.com/contact/

Coût courant non établi : **devis nécessaire**, tarif par vérification et éventuels minimums/abonnement à confirmer. Les conditions prévoient une facturation possible hors bon de commande ; aucun compte, essai payant ou appel réel n'est créé. Aucun contact commercial envoyé.

Ce choix technique n'est pas une certification RGPD. Avant engagement : confirmer DPA, sous-traitants, hébergement, transferts, rétention, méthode de preuve et accessibilité en France/UE ; documenter finalité/base légale et information utilisateur. Le principe de minimisation de la CNIL motive le choix d'un attribut de majorité plutôt qu'une identité complète : https://www.cnil.fr/fr/comprendre-le-rgpd/les-six-grands-principes-du-rgpd . Les règles sectorielles des sites pornographiques ne sont pas présentées comme automatiquement applicables à ORÉVAMI.

## Données et contrat à finaliser

ORÉVAMI ne reçoit ni ne stocke pièce, selfie, date de naissance ou résultat brut dans cette préparation. Le stockage applicatif contient UID interne, source, horodatages, indicateur de traitement et empreinte de session. L'URL et le reçu opaque de session transitent au navigateur ; ne pas les journaliser. Le fournisseur traite ses propres données selon le contrat à approuver.

La proposition utilise 15 minutes pour terminer une session et 90 jours de validité pour une preuve : ce sont des paramètres techniques proposés, pas des durées imposées par la loi. Il faudra approuver la durée utile et la purge des tentatives/preuves avant mise en service. Pas de purge automatique déployée. La suppression de compte efface déjà adult_access par sa FK existante.

Avant exposition d'une route réelle : adaptateur réseau officiel (authentification et vérification des réponses), méthodes de preuve autorisées, contrôle d'origine/CSRF pour les routes utilisateur, limitation persistante avant tout appel fournisseur facturable, durée des requêtes, messages d'erreur sans secrets et logs sans corps de preuve. Si un webhook est utilisé, vérifier son authentification officielle et relire le résultat côté serveur ; ne jamais attribuer un statut depuis son contenu seul. Une route de finalisation authentifiée peut servir sans webhook. La fonction SQL limite les débuts par compte, mais ne remplace pas le contrôle avant appel facturable.

## Contrôles ciblés

Sept contrôles distincts couvrent les parcours modifiés : SQL local, orchestration serveur, client join/accept, sauvegarde des champs existants, filtres déjà associés à ce test, isolation exacte Production et conservation des 347 fichiers/corps de recherche. Tous passent. L'échec initial du contrôle de conservation venait de sa normalisation CRLF effectuée après retrait de l'aiguillage ; ordre corrigé, corps applicatif inchangé. Rejeux limités aux fichiers corrigés et aux nouvelles vérifications. Aucune campagne générale ni test des Jeux.

La proposition 003 refuse toute divergence du catalogue V2 ou état ouvert. Elle n'est pas réexécutable après installation : un second passage s'arrête sans modification. Elle ne change aucun réglage d'ouverture et n'insère aucun utilisateur. Le générateur scripts/prepare-majority-proposal.mjs ne fait que produire le fichier local ; ce n'est pas une migration appliquée.

## Autorisations restantes, distinctes

1. Validation du prestataire et de son devis/contrat avant compte externe ou frais. Finaliser ensuite l'adaptateur et le parcours avec environnement fournisseur de test isolé, sans compte réel activé.
2. Autorisation explicite du SQL exact 003-automatic-majority-proposal.sql sur la cible convenue, après revue de la durée de preuve et de la rétention. Aucun script n'a été exécuté à distance. Commencer par une validation isolée autorisée ; ne pas réinstaller le socle.
3. Activation réelle de comptes, ouverture du module/inscriptions et publication restent des opérations ultérieures séparées, hors autorisation actuelle. La mission n'autorise aucun déploiement.

Sauvegarde : commit local sur branche de travail et archive Git autonome remise dans outputs. Aucun push effectué, pour éviter de déclencher un déploiement automatique. Aucun secret affiché ou ajouté.
