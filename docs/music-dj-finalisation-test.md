# Musique/DJ — audit et finalisation TEST

## Corrections

- Le lecteur YouTube existant est conservé, avec vidéo visible. Fin de titre raccordée à l’enchaînement de la file, option pour le désactiver, précédent/suivant, lecture/pause, répétition du titre ou de la file et aléatoire sans répétition dans un cycle.
- Le bouton DJ agit sur le morceau courant au lieu de reprendre systématiquement le premier. Le titre affiché suit les changements du lecteur. Retrait/réorganisation actualisent sa file active.
- Réglage du volume via `setVolume` officiel ; le contrôle matériel iPhone peut rester nécessaire. Les restrictions d’autoplay et les vidéos refusées par YouTube restent signalées. Aucun téléchargement, mixage, fondu ou lecteur audio masqué ajouté.
- Playlists personnelles : création même vide, renommage, ajout via le menu d’un morceau, retrait, changement d’ordre et suppression. Files, ambiance et paramètres DJ persistent dans le stockage local existant, isolé par compte. Pas de synchronisation multiappareil promise.
- Export vers l’événement : le nombre réellement ajouté est affiché ; arrêt au premier échec ou changement de compte/événement, sans confirmation trompeuse de succès total.
- Le statut du lecteur ciblait par erreur le premier `small` (artiste) : il cible désormais `[role=status]`.

## Blocage vérifié en lecture seule sur ahyyknfjsielnqyoxqgh

Tables absentes : `music_playlists`, `music_playlist_items`, `music_votes`, `music_favorites`.
Fonction absente : `music_reorder_queue`.
`music_tracks` et `event_music_settings` existent. La politique SELECT observée sur `music_tracks` est `story_track_read` ; les règles d’écriture Musique et les règles des nouvelles tables doivent être revues avant activation.

Conséquences : favoris synchronisés, import/export événement, votes et réorganisation commune ne peuvent pas être déclarés opérationnels sur ce TEST. Les appels existants renvoient leur échec ; aucune nouvelle table, RLS ou migration n’a été appliquée. Les éléments personnels restent locaux, comme avant.

Étape soumise à autorisation : préparer puis présenter un SQL TEST tenant compte du schéma actuel, à partir des migrations existantes `20260923_music_v1.sql` et `20260924_music_integrity.sql`, avant toute application. Ne pas les exécuter aveuglément : des objets existent déjà et leurs permissions doivent être préservées. Aucune intervention Production nécessaire à cette livraison.

## Vérifications et limites

Quatre contrôles ciblés DOM/lecteur doublé : enchaînement et répétition ; aléatoire et isolation des paramètres ; arrêt automatique et file sans doublons ; CRUD/réorganisation des playlists personnelles. Aucun appel réel de recherche ou de lecture YouTube dans ces contrôles, aucune écriture Supabase.
Preview runtime confirmé TEST. Le navigateur connecté à la Preview atteint l’authentification : session fictive non disponible. Lecture réelle YouTube et rendu Safari iPhone matériel restent NON VÉRIFIÉS. Le moteur WebKit local a des dépendances système manquantes ; ne pas confondre tests DOM et contrôle visuel.

Références consultées :
- https://developers.google.com/youtube/iframe_api_reference
- https://developers.google.com/youtube/terms/developer-policies
