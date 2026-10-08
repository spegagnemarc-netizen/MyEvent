# Caméra V1 et Explorer TEST — 5 octobre 2026

## Base et périmètre

HEAD distants initiaux : mobile `1bf438996071f0539856e2daee3f5bbcbf0b4a14`, web `0d0af241d8e85852a7faa159ff9ec883bdc1082a`, main `3aa93be774225817a5494ee987f6bcfb03809c08`.

Les branches restent séparées. Aucun changement distant de Supabase, Vercel ou MyEvent-API, aucune publication production. Le prototype Swift et tous les fichiers web de la branche mobile sont conservés.

## Caméra

Accueil → bouton Photo → caméra native → aperçu → Reprendre / Publier / Ajouter à un événement. Les deux dernières actions demandent confirmation. Les fonctions photo, galerie, avant/arrière, zoom/pinch, timer, grille, niveau et ratios sont conservées.

Le bridge importe la photo dans le moteur existant sans ouvrir son interface ni démarrer sa caméra web, puis attend `camera-preview-ready`. Il déclenche les boutons existants de publication ou de destination événementielle. Il conserve donc leurs contrôles Supabase, leur persistance, leur rendu du Fil et le routage Story. La réussite de publication est annoncée après fermeture par le handler ; les erreurs restent dans l’aperçu natif. Une requête répétée avec le même identifiant ne relance pas une publication en cours ou déjà confirmée pendant la session WebView.

L’ajout événementiel affiche ensuite le sélecteur existant : la photo n’est attachée qu’après sélection d’un événement et réponse du service existant. Sans événement affiché, une erreur garde la photo native. Le sélecteur reste web ; il n’est pas reconstruit. Ne pas confondre « sélecteur prêt » avec « photo enregistrée ».

Les mentions Lens et le bouton provisoire Filtres/Apparence/Stickers sont retirés de la caméra native. Une entrée explicite « Caméra web de secours » conserve le fallback. Le parcours Safari/Chrome n’est pas modifié.

Pas de publication distante exécutée pendant cette intervention. Une interruption réseau peut rendre le résultat incertain : vérifier le Fil avant de recommencer, surtout après navigation/rechargement qui perd le cache de déduplication. Aucun test de cette nouvelle version sur appareil pendant cette intervention ; clôture fonctionnelle finale conditionnée au contrôle OPPO.

## Explorer absent du téléphone : cause et solution

Le `WEB_URL` par défaut est le site public, conservé depuis `f47316b`. Ce site ne contient pas encore Explorer. Le raccourci boussole existe dans le carrousel supérieur de `refactor-final`, et les six catégories existent dans `explorer.html`.

Vérification HTTP réelle de l’ancienne Preview `my-event-ii2zetly5` : redirection vers `vercel.com/login` / SSO. La connexion MyEvent ne résout pas cette protection Vercel, et une session du navigateur PC ne se transmet pas à la WebView OPPO.

Solution préparée : `npm run start:test`, avec URL Preview explicite. Avant de démarrer Metro, il contrôle par GET sans redirection : configuration `environment=preview`, `isTest=true`, projet `ahyyknfjsielnqyoxqgh`, URL Supabase TEST exacte, raccourci de l’accueil et page Explorer. Il refuse la production, une page de login, les paramètres de contournement, une cible non TEST ou une page manquante. Aucun secret n’est inscrit dans l’application.

Action externe encore nécessaire, dans le projet Vercel **existant** : disposer d’une Preview récente de `refactor-final` dont les variables **Preview uniquement** configurent Supabase TEST (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `MYEVENT_TEST_SUPABASE_REF`). Ne pas modifier les variables Production ni définir manuellement `VERCEL_ENV`. Si la protection empêche la WebView, un administrateur Vercel peut approuver une **Deployment Protection Exception limitée au domaine Preview TEST choisi**, puis la retirer après les tests. Cette exception rend ce domaine TEST publiquement accessible ; l’authentification MyEvent et les RLS restent obligatoires pour les données privées. Ne pas désactiver globalement la protection et ne pas embarquer de secret de bypass.

Procédure officielle : https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions . Aucune exception ni variable n’a été modifiée ici. La configuration réelle de la Preview protégée ne peut pas être lue sans accès Vercel ; sa conformité TEST doit être vérifiée après ouverture. Aucune URL accessible finale ne peut être annoncée à ce stade.

## Contrôles exécutés

- TypeScript : réussi ; 23 tests mobile réussis, dont publication asynchrone, doublons, erreurs, absence d’événement, origine, Story, fallback et garde TEST.
- Export Expo Android et iOS : bundles Hermes réussis. Pas de nouveau module natif ni dépendance ajouté.
- Tests web : 59 réussis ; Musique SQL : 1 réussi. Marketplace SQL : 34 contrôles réussis ; Explorer, Amis/Stories et permissions événementielles SQL locaux réussis.
- Génération des pages partenaires : réussie, aucun changement de contenu. Budget de 12 fonctions contrôlé par le test de routage.
- Tests de bridge/UI avec doubles JSDOM et migrations avec PostgreSQL local PGlite ; ils ne constituent pas une session authentifiée sur téléphone ni un appel fournisseur réel.
- Pas de nouvel APK validé : la tentative précédente sous JDK 25 avait échoué dans Prefab ; sous JDK 17, CMake régénérait avec chemins trop longs dans ce workspace. Ce problème local n’est pas contourné par une modification du projet. Les bundles suffisent à recharger le client déjà installé pour ce changement JavaScript. Aucun build natif iOS sous Windows.

## Windows / OPPO

```powershell
Set-Location C:\Users\spega\MyEvent-Mobile
git status --short
git switch mobile-v1-native-camera
git pull --ff-only origin mobile-v1-native-camera
git fetch origin refactor-final
Set-Location mobile\app
npm ci
npm run typecheck
npm test
# Remplacer uniquement après obtention de la Preview TEST accessible :
$env:EXPO_PUBLIC_MYEVENT_WEB_URL='https://DOMAINE-PREVIEW-TEST/index.html'
npm run start:test
```

Le lancement bloque tant que l’URL n’est pas réellement vérifiée. Ouvrir le client MyEvent déjà installé et recharger Metro. Pour Expo Go, après le même contrôle, `npm run start:test -- --go`.

Ne pas utiliser la cible publique par défaut pour ces essais fictifs. Aucun reset, revert, merge entre branches ou push forcé.

## Test OPPO, écran par écran

1. Accueil TEST : connexion fictive B, bandeau TEST et Explorer ; ouvrir ses six catégories.
2. Photo : avant/arrière, galerie, zoom, timer, grille/niveau, ratios ; prendre puis Reprendre.
3. Aperçu : Publier → Annuler ne crée rien ; Publier → confirmer, retour au Fil sans ancien panneau, photo présente après rechargement.
4. Nouvelle photo : Ajouter à un événement → confirmer → sélectionner un événement fictif → vérifier son souvenir après rechargement. Tester le cas sans événement.
5. Story : photo → Publier → confirmer → vérifier la Story ; puis annulation et nouvelle photo normale. Vérifier le fallback web et le bouton Retour Android.
6. Explorer : réservation fictive personnelle, rattachement/retrait explicite, déconnexion/reconnexion ; vérifier Amis et Musique sans les reconstruire.
