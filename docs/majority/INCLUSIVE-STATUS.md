# Activités & Rencontres — accès général, restrictions ciblées

Décision utilisateur du 20 octobre 2026 : pas de Yoti obligatoire et pas d'exclusion générale des moins de 18 ans. Le travail antérieur est conservé dans l'histoire Git ; les modules Yoti ne sont appelés par aucune route. Aucun compte ou contrat fournisseur requis pour le parcours général.

## Code préparé

Les six RPC, tables et RLS Activités existantes sont réutilisées. Le client V4 distingue account_access et adult_access. Un compte actif peut créer, consulter et demander à participer à une activité ordinaire, sans entrée adult_access et sans Yoti.

Chaque activité possède une restriction adults_only : le formulaire permet aux organisateurs disposant déjà d'un accès adulte de la sélectionner. Les apéritifs sont toujours classés adultes côté serveur, même si le client omet la case. Toute activité déjà stockée conserve par défaut la restriction adulte tant qu'elle n'est pas réexaminée. Pour changer la restriction d'une activité existante, créer une nouvelle activité : pas de reclassement silencieux d'une sortie avec participants.

Le contrôle adulte existant reste utilisé **uniquement pour les activités réservées aux adultes**. Il n'est pas une vérification Yoti ni une preuve produite par une case déclarative. Sans ce droit serveur, aucune consultation, création, inscription ou acceptation sur une activité adulte. Aucun droit adulte n'est attribué par ce lot.

## Protection des comptes sans majorité établie

Le schéma profils relu ne possède pas de date de naissance ou de statut mineur fiable. Par défaut, tous les comptes sans droit adulte reçoivent les protections suivantes, sans devoir prouver leur âge pour accéder à la rubrique :

- une participation ordinaire est une demande à accepter par l'organisateur, même lorsque la sortie propose l'inscription directe ;
- l'adresse précise et le GPS exact ne sont pas communiqués à ces participants, même acceptés ; position arrondie seulement. L'organisateur conserve l'accès aux données qu'il a lui-même saisies ;
- le raccourci d'amitié dans les fiches est disponible seulement sur les sorties adultes autorisées ; le parcours Amis existant et ses règles ne sont pas modifiés. Ce bouton désactivé n'est pas présenté comme une garantie serveur contre tous les contacts du site ;
- blocage, signalement, visibilité amis/public, contrôle propriétaire, limites et verrouillage de capacité restent ceux des RPC existantes. Pas de nouvelle messagerie, photo publique ou profil présenté comme vérifié.

Les organisateurs restent responsables du bon classement des sorties adultes. Le type apéritif est forcé, mais le texte libre n'est pas soumis à un système automatique de classification. La modération et les signalements restent nécessaires pour les sorties mal déclarées. Ce lot ne certifie pas à lui seul toutes les protections mineurs de l'ensemble du site.

## Supabase : état et proposition

Lecture Production nxxvadbliinhvkirqkkl effectuée : schéma V2, enabled=false et registrations_enabled=false ; profils sans champ d'âge fiable. Aucune écriture distante.

004-inclusive-activities-proposal.sql remplace le projet 003 et se base sur le catalogue exact de V2, sans appliquer le projet Yoti. Transaction, verrou d'installation et refus en cas de divergence ; aucun réglage d'ouverture modifié. Une colonne et un helper privé ajoutés, implementations allowed/capabilities/visible/save/participate/detail adaptées. Les RPC publiques, GRANT existants et RLS restent conservés. Le script ne doit pas être appliqué après 003 et n'est pas réexécutable après installation sans refus de catalogue.

Le fonctionnement réel distant ne peut pas être annoncé ouvert : le nouveau SQL est non appliqué, la base et les inscriptions restent fermées, le client V4 refuse les anciennes capacités. Il reste à autoriser l'installation exacte du SQL puis les réglages d'ouverture sur la cible convenue. Les autorisations antérieures n'autorisent ni données réelles Production ni publication ; aucune de ces opérations n'a été effectuée.

## Vérification limitée au changement

Un seul nouveau test local de politique V4, réussi : accès sans preuve, création ordinaire, demande/acceptation, masquage de précision, exclusion des sorties adultes, apéritif forcé, impossibilité de retirer la restriction, révocation du droit adulte sans fermeture générale et conservation des politiques RLS. Aucun test précédemment validé rejoué. Les anciennes fixtures client ont été alignées sur le contrat V4 sans exécuter leurs suites. Contrôle de syntaxe du client réussi. Pas de certification de navigateur réel ou de parcours distant authentifié dans cette étape.

## Sauvegarde et limites conservées

Branche dédiée work/activities-inclusive-20261020. Aucun changement de main ; aucune publication ni activation distante. Les versions retrouvées, la sauvegarde exacte 24dc92d et la préparation Yoti sont conservées dans l'histoire. Photos de couverture et discussion restent aux limites déjà documentées ; ce lot ne les annonce pas finalisées.
