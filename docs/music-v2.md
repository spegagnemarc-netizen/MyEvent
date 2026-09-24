# Music V2 — état et vérification

Base inspectée : `8082142002b178a81a853349575b5327a61d5635`, branche `refactor-final` exclusivement.

## Fonctionnement

- Navigation Music interne avec retour : Bibliothèque, Découvrir, Playlist événement, DJ, Music IA. Le lecteur conserve sa présentation et son menu. La navigation principale de l’application reste en place.
- Recherche par `/api/search-music`, favoris Supabase, playlist et votes existants conservés. Le registre expose le contrôleur YouTube.
- Un seul lecteur YouTube IFrame API est attaché au document. Fermer une vue ne le détruit pas. Commandes précédent, suivant, lecture/pause, position, arrêt et réouverture. La vidéo reste visible (minimum 200 px de haut), y compris dans le lecteur flottant. L’ouverture de la caméra arrête la lecture, sans changer ses fichiers. La sortie de compte détruit le lecteur.
- Historique alimenté uniquement par l’événement de lecture effective. Recherche, écran interne, morceau et position sont conservés par compte. La restauration n’allume pas le son. Le fournisseur peut refuser une reprise ou exiger un geste supplémentaire sur iPhone.
- Bibliothèque : favoris synchronisés, playlists personnelles modifiables, artistes suivis, historique. Les trois derniers sont enregistrés localement par compte, sans prétendre à une synchronisation multiappareil.
- Menu commun : favori, playlist personnelle, événement, file DJ, recherche artiste/similaires, partage YouTube. L’usage Selfie est explicitement indisponible ; un contrat de sélection prépare segment, durée, volumes, fades et métadonnées, sans exporter d’audio.
- Music IA : description mémorisée, recherche réelle pour ajouter/remplacer, retirer, déplacer, verrouiller, sauvegarder localement, transférer vers événement ou DJ. Les commandes de génération restent désactivées car aucun backend Music IA n’existe dans le dépôt. `registerRecommendationProvider` réserve le raccordement futur ; aucune recommandation IA n’est simulée.
- DJ : file locale, import de l’événement, commandes manuelles, verrouillage et édition. La playlist événement affiche votes, participants et ordre commun, avec commandes du propriétaire. Pas de lecture synchronisée entre appareils.
- Cartes illustrées avec deux ressources SVG locales. Les recherches par ambiance restent fonctionnelles.
- Thème : variables globales d’accent, RGB, intensité et opacité, utilisées progressivement par Accueil/Music. Sélecteurs et réinitialisation dans Apparence. Persistance locale par compte. Aucun changement du schéma `profiles`, aucune substitution des couleurs fonctionnelles ni des styles caméra.

## Base Supabase

Seules les migrations présentes dans le dépôt et les usages du profil ont pu être inspectés. Le schéma effectivement déployé n’a pas été interrogé. Aucune migration n’a été exécutée en production.

`20260924_music_integrity.sql` est transactionnelle et rejouable. Elle ajoute :

- Index uniques et FK composites pour lier chaque item à sa playlist et chaque vote à son item **dans le même événement**.
- FK `NOT VALID` : les nouvelles écritures sont contrôlées ; les données historiques ne sont ni effacées ni corrigées automatiquement. Auditer puis valider les contraintes après résolution explicite d’éventuelles incohérences.
- Contrôle des verrouillages et des paramètres propositions/votes ; identité des items/votes immuable.
- Fonction `music_reorder_queue` : propriétaire uniquement, ordre complet, transaction atomique, rejet des listes incomplètes et des déplacements d’items verrouillés. Deux réorganisations concurrentes complètes peuvent se succéder ; aucune fusion d’ordres n’est promise.

Appliquer cette migration après comparaison du schéma distant pour activer la réorganisation commune et les contrôles serveur renforcés. L’interface remonte les erreurs si la fonction n’existe pas encore. Les nouvelles garanties de verrouillage ne sont pas actives côté serveur tant que cette migration n’est pas déployée.

## Tests

- `node --test tests/*.test.mjs` : tests caméra existants et sessions Music.
- Le test SQL nécessite PGlite : installer `@electric-sql/pglite` dans un dossier de test puis définir `PGLITE_MODULE` sur son `dist/index.js` avant la commande. Sans cette variable, le test SQL est marqué ignoré, jamais prétendu exécuté. Version utilisée : 0.5.8.
- Le test SQL exécute réellement les deux migrations dans PostgreSQL embarqué, rejoue la seconde, vérifie les RLS entre événements, les FK composites, les votes désactivés, les verrouillages et l’ordre atomique. Le schéma de base `auth`, `events`, `event_members` est une fixture, pas un clone de production. `pgcrypto` est omis dans cette fixture car `gen_random_uuid` est disponible dans le moteur.
- Servir le dépôt en HTTP et ouvrir `tests/music-runtime.html?run` puis `tests/music-workspace.html?run`. Ces pages utilisent des doubles déterministes pour Supabase, la recherche et YouTube. Elles couvrent métadonnées/XSS, favoris, erreurs, ajout/votes, navigation, persistance, changement de compte, verrous de brouillon, position et thème.
- Inspection du rendu à 390 × 844. Pas de validation matérielle sur Safari/iPhone ni de lecture YouTube réelle dans ces fixtures. Une vérification connectée reste nécessaire sur le déploiement avec les clés et la migration réelles.

## Limites assumées

Pas de backend IA inventé, pas de téléchargement YouTube, pas de promesse de lecture système en arrière-plan, pas de mixage/transitions/normalisation simulés. Le bloc Pour vous fournit l’accès aux écoutes et ambiances, sans moteur de recommandations personnalisé. Tendances utilise une recherche YouTube, pas un classement mesuré par MyEvent. L’ensemble de la caméra V1 est conservé sans modification de fichiers.

Référence du contrôleur : https://developers.google.com/youtube/iframe_api_reference
