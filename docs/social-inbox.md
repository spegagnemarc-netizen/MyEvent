# Messages privés et notifications sociales

## Installation

Branche de départ : `refactor-final`, HEAD vérifié `1005acdc2291123a84b5030bcb7dd7978d2d7859`.
Appliquer **une fois**, dans l'éditeur SQL Supabase, la migration
`supabase/migrations/202609280001_social_inbox.sql`, après les migrations existantes.
Elle est transactionnelle et crée ses propres tables, fonctions, politiques, déclencheurs
et le bucket privé `dm-media`. Aucune clé à ajouter au navigateur.
Elle ajoute les tables de messagerie à `supabase_realtime` si cette publication existe.
En son absence, l'actualisation de secours reste active ; activer Realtime sur
`dm_messages`, `dm_conversations` et `social_notifications` pour les mises à jour immédiates.

Aucune migration antérieure, règle d'événement, visibilité, rôle ou table de cagnotte
n'est modifiée. Les déclencheurs sur `friendships` et `game_invitations` ajoutent
uniquement les notifications correspondant aux actions futures. Pas de faux historique.

## Fonctionnement

- Conversation unique par paire de vrais comptes Supabase. Profils et avatars proviennent de `profiles`.
- Démarrage depuis Messages → Nouveau message ou Amis → nom de l'ami → Envoyer un message.
- Création et envoi réservés aux amis acceptés. Après retrait de l'amitié : historique lisible,
  nouvel envoi et upload refusés côté serveur.
- Texte de 4 000 caractères maximum. Heure/date, dernier message, compteurs persistants.
- Historique chargé par pages de 50 ; listes des 100 conversations et notifications les plus récentes.
  Les badges comptent tous les non-lus, y compris hors de ces listes.
- Photos JPG/PNG/WebP, 10 Mo maximum. Bucket privé, URLs signées de 10 minutes, renouvelées
  lors des actualisations. Ces liens temporaires peuvent être consultés par une personne à
  laquelle le destinataire les transmet ; ce n'est pas du chiffrement de bout en bout.
- Notification pour demande d'ami, acceptation (y compris lien), message privé et invitation
  Infiltré/Défis. Les messages d'une même conversation sont regroupés en une notification
  persistante actualisée. Les notifications d'événements restent séparées.
- Lecture validée sur le dernier message de l'instantané affiché, panneau visible et au bas
  de la conversation. Un message arrivé plus tard reste non lu.
- Supabase Realtime avec actualisation de secours toutes les 15 secondes, retour au premier
  plan et reconnexion réseau. Le brouillon en mémoire reste intact pendant les actualisations.
- Un envoi échoué propose de réessayer avec le même identifiant : pas de doublon si la réponse
  réseau est perdue après l'écriture. Les brouillons ne survivent pas au rechargement.
- Un changement de compte efface les conversations, brouillons et URLs de photos en mémoire,
  retire l'ancien abonnement et ignore ses réponses tardives.

## Sécurité

RLS obligatoire sur toutes les nouvelles tables. Les clients n'ont que SELECT sous RLS.
Les écritures passent par des fonctions à `search_path=''`, qui utilisent `auth.uid()` :
aucun paramètre `sender_id` fourni par le client. Aucune insertion directe de notification,
aucune modification directe d'un message, aucun accès anonyme. Les compteurs et les profils
renvoyés sont limités au compte connecté et aux membres de ses conversations.

Stockage : upload dans le dossier de l'expéditeur et d'une conversation dont il est membre
et ami ; lecture par le destinataire seulement après rattachement à un message ; aucun
accès d'un tiers. Une photo attachée ne peut pas être supprimée par le client. Les éventuels
uploads abandonnés restent privés chez leur auteur ; pas de tâche de purge ajoutée ici.

## Vérifications locales

- `node tests/social-inbox-rls.mjs` : PostgreSQL isolé, RLS, quatre comptes, usurpation,
  lecture inter-conversations, non-lus, rejeu, pagination, photos et retrait d'amitié.
- `node tests/event-roles-rls.mjs` : régression rôles/visibilité/fil social existants.
- `node tests/social-inbox-preview.mjs` : interfaces de production reliées à une base
  PostgreSQL locale isolée, comptes de test A (`?user=0`) et B (`?user=1`), port 4174.
  Cet outil de test n'est jamais chargé dans l'application et n'utilise aucun compte réel.
  Il teste le rafraîchissement de secours ; pas les WebSockets ni le transport Storage réel.
- Essai navigateur A/B : ouverture, envoi, réception, réponse, dernier message, badges,
  ouverture via notification, conservation d'un brouillon et rechargement.

## Protocole réel A/B après migration

1. Ouvrir la même URL Preview sur deux appareils avec deux comptes distincts ayant un profil.
2. Si nécessaire, A envoie une demande d'ami à B. B voit sa notification sociale et son badge.
   B accepte : A reçoit la notification d'acceptation. Tester aussi un lien d'invitation ami.
3. A ouvre Amis, touche le nom de B puis « Envoyer un message ». Envoyer un texte.
   B doit voir Messages +1 et Notifications +1 sans rechargement (ou en 15 s en secours).
4. B ouvre la notification : seul l'échange A/B apparaît, l'heure/date et l'auteur sont exacts.
   Les badges disparaissent après lecture. B répond ; A reçoit et retrouve le dernier message.
5. Envoyer une photo JPG/PNG/WebP. Vérifier l'affichage sur B, puis recharger les deux appareils :
   historique conservé. Une photo HEIC ou supérieure à 10 Mo doit être refusée avec explication.
6. Garder un brouillon sur A pendant que B écrit : le brouillon ne doit pas disparaître.
   Couper/rétablir le réseau ; réessayer un envoi échoué et vérifier l'absence de doublon.
7. Mettre B en arrière-plan, envoyer depuis A, revenir : badge et nouveaux messages à jour.
   Changer de compte : aucun contenu de l'ancien compte ne doit rester affiché.
8. Retirer l'amitié : historique conservé, nouvel envoi impossible. Rétablir l'amitié pour continuer.
9. Inviter B à Infiltré ou Défis : notification sociale persistante, ouvrant le Salon Jeux.
10. Vérifier séparément une discussion et les notifications d'événement, ainsi que les visibilités
    Privé / Amis / Public et les droits organisateur/co-organisateur/participant.

Un troisième compte C permet un contrôle complémentaire : l'UUID de la conversation A/B
ne doit donner accès à aucun message ni photo. Les tests locaux vérifient déjà ce refus.

## Périmètre de livraison

Nouveaux : migration SQL, `js/social-inbox.js`, `css/social-inbox.css`,
`tests/social-inbox-rls.mjs`, `tests/social-inbox-preview.mjs`, ce document.
Modifiés : `index.html` (chargement et suppression des contenus provisoires),
`js/home-social-runtime.js` (routage des panneaux sociaux),
`js/social-friends-stories.js` (lien profil d'ami et bouton de message uniquement).

Les illustrations locales en cours sont préservées séparément dans le stash
`Illustrations originales en cours avant messagerie sociale` ; elles ne font pas partie
ce commit. Aucun changement de Musique, caméra, contenu Stories, rôles, événements,
cagnotte, Stripe ou Marketplace.
