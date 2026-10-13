# ORÉVAMI — audit avant publication, 13 octobre 2026

Décision : NO-GO. Aucun push, déploiement ou changement DNS effectué.

## Références vérifiées
- main distant : 04a46ed9366c7a68bbfb21d3ed6391ca28bb6eaf
- refactor-final distant et Preview validée : eb7a2921a81a1285c1d628198f8df581b0c1cdf1
- Preview Ready : dpl_CYsXBJ99sTYxLvKTReoWV2hV2S9p
- Production Ready existante : dpl_Ffye6muVhaio2vDZ8Dx5jynHUFeK, my-event-r0i7vs2w4-spegagnemarc-netizen.vercel.app
- Site public inchangé : https://my-event-eosin.vercel.app/

## Intégration préparée, non publiée
La comparaison complète comporte 206 fichiers. L'identité ORÉVAMI a été extraite de la série 283957a, 3bd5d25, 70ab5aa, 4ace0a3, 4fd905e, a3e4b73, 1b22da0, 53181e5, dfe55bb et eb7a292, puis appliquée au main actuel. Les fichiers et tests hors périmètre ne sont pas transférés. Les conflits ont été résolus pour préserver les comportements de main : photos compactes et visionneuse, Marketplace sans documents de location ni annonces TEST. Aucun transfert des modifications Sabre/Geoapify, du code natif ou des migrations de refactor-final.

Nom, slogan, logo transparent, métadonnées, icônes PWA, en-têtes partagés et bouton Photo sont préparés. Les identifiants techniques et les liens générés depuis location.origin sont conservés. Les fonctionnalités de récupération de mot de passe absentes de main n'ont pas été importées sous couvert de marque.

## Vérifications
- 35 tests ciblés réussis : marque, navigation, caméra/publication, 24 styles IA simulés, isolation Supabase et permissions. Les tests SQL utilisent PGlite isolé, aucune migration distante.
- Suite complète : 149 tests, 136 réussis, 12 échecs, 1 ignoré.
- Deux anomalies fonctionnelles reproduites également sur main : accès à $ hors IIFE à la fin de js/admin-runtime.js ; GameSession.act utilise game_action malgré le namespace defis.
- Neuf assertions Stripe échouent également sur main (HTTP 500 au lieu de 200 dans les fixtures). Cause de ces échecs non confirmée, aucun paiement réel exécuté.
- Une assertion historique Transport ne peut pas lire index.html dans le commit d876c658... disponible localement. Ce problème de fixture n'est pas une preuve de panne fournisseur.
- Syntaxe Node des fichiers modifiés et résolution des références locales : OK. Aucun script build/TypeScript/lint disponible dans package.json ; aucun build Vercel de la candidature effectué puisque la publication est arrêtée.
- 12 fichiers de fonctions API, configuration Vercel conservée. Nombre du nouveau build non vérifié : aucun déploiement nouveau.
- GET réel /api/runtime-config public : HTTP 200, environment production, isTest false, projet nxxvadbliinhvkirqkkl, clé de session Production conservée. Clé publique non incluse dans ce rapport. Les variables Production et Preview ont des portées séparées ; aucune valeur secrète déchiffrée ou modifiée.
- Page publique réelle dans Chrome : écran de connexion, aucune bannière TEST visible. Aucun compte Production connecté. Les parcours connectés, caméra physique et iPhone Safari après publication ne sont donc pas vérifiés.

## Domaines, proposition à approuver ultérieurement
orevami.com et orevami.fr utilisent dns103.ovh.net / ns103.ovh.net et l'adresse A 213.186.33.5 selon la lecture Vercel. Ils ne figurent pas parmi les domaines du projet Vercel.

Après sauvegarde et inventaire complet de la zone OVH, proposer de remplacer l'enregistrement A web à la racine par les recommandations Vercel de rang 1 : 216.198.79.1 et 64.29.17.1. Pour www, CNAME recommandé : 40427b988b782cc0.vercel-dns-017.com. Revérifier ces valeurs juste avant application. Inventaire MX/TXT/DKIM/DMARC non accessible ici : ne rien supprimer ni remplacer dans la messagerie. Garder les NS OVH. Lier ensuite les domaines au projet, orevami.com principal et orevami.fr redirigé vers https://orevami.com, avec conservation des chemins et paramètres. La redirection HTTPS de .fr se configure sur Vercel, pas par un simple DNS.

Avant activation : conserver les anciennes URL Auth, ajouter les nouvelles origines et callbacks nécessaires, vérifier les invitations générées sur la nouvelle origine et les retours partenaires. Aucune nouvelle origine ou configuration Auth appliquée. Aucune activation Stripe LIVE.

## Retour arrière
Le déploiement précédent reste présent et Ready. Après une future publication, revenir à dpl_Ffye6muVhaio2vDZ8Dx5jynHUFeK via Vercel Instant Rollback ; le rollback peut désactiver l'affectation automatique des prochaines productions jusqu'à une nouvelle promotion. Pour le code : git revert du futur commit de publication, push normal après vérification du HEAD. Aucune restauration de base de données n'est nécessaire pour une modification de marque seule. Aucun retour DNS nécessaire aujourd'hui puisque les DNS sont inchangés.

## Prochaine étape
Corriger et vérifier les anomalies Administration/Jeux dans une mission séparément autorisée, expliquer les échecs Stripe, puis reprendre les tests connectés et le build avant publication. Ne pas fusionner toute refactor-final.

## Fichiers de l'intégration préparée
- api/analyze-poll.js
- api/create-payment-session.js
- api/generate-materials.js
- api/generate-outing-plan.js
- api/search-music.js
- api/search-places.js
- api/stripe-webhook.js
- api/summarize-event.js
- assets/orevami/README.md
- assets/orevami/icon-180.png
- assets/orevami/icon-192.png
- assets/orevami/icon-32.png
- assets/orevami/icon-512.png
- assets/orevami/logo-dark.png
- assets/orevami/logo-light.png
- assets/orevami/logo-transparent.png
- assets/orevami/symbol-dark.png
- assets/orevami/symbol-light.png
- css/orevami-brand.css
- explorer-partners-accommodation.html
- explorer-partners-ticket.html
- explorer-partners-transport.html
- explorer-partners.html
- explorer.html
- index.html
- js/admin-runtime.js
- js/camera-ai-lenses.mjs
- js/camera-annotations.js
- js/camera-capture2-final.js
- js/core-runtime.js
- js/entertainment-lounge.js
- js/event-social-feed.js
- js/explorer.mjs
- js/game-session.js
- js/home-social-runtime.js
- js/marketplace.mjs
- js/music-runtime.js
- js/music-workspace.js
- js/orevami-brand.js
- js/planning-transport-runtime.js
- js/runtime-config.js
- js/section-navigation.js
- js/social-friends-stories.js
- js/social-inbox.js
- js/sorties-reservations-runtime.js
- manifest.webmanifest
- marketplace.html
- scripts/generate-explorer-partners.cjs
- server/search-transport.js
- server/supabase-environment.mjs
- tests/admin-v22-environment.test.mjs
- tests/explorer.test.mjs
- tests/orevami-brand.test.mjs
- tests/section-navigation.test.mjs
