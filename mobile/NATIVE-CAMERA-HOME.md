# Bouton caméra de l’accueil — mobile uniquement

Rapport historique du premier raccordement. La finalisation du parcours sans panneau web intermédiaire est décrite dans `V1-FINALISATION-TEST.md`.

Base distante vérifiée : `f47316bafdde9413441fcf15581f993a36bef95f`, branche `mobile-v1-native-camera`.

## Raccordement

Le déclencheur existant est `#socialBottomCreate` dans `js/home-social-runtime.js`. Le parcours Story utilise aussi ce bouton. Le shell injecte un listener uniquement dans sa WebView sur l’origine configurée. Le clic demande la caméra native ; le retour photo utilise le bridge d’import existant, avec un bypass explicite pour ouvrir l’aperçu web sans relancer la caméra native.

Les messages sont contrôlés par origine HTTPS, version et identifiant renouvelé à chaque navigation. Un verrou empêche les ouvertures répétées. L’annulation libère le verrou et réinitialise l’intention Story. Le fallback « Filtres / Apparence / Stickers : caméra web » reste disponible. Le bouton temporaire « Caméra ME » est masqué seulement après réception de la confirmation que le bouton normal existe ; il reste disponible si le raccordement n’est pas prêt.

Aucun fichier web déployé, configuration Supabase, partenaire, service API, prototype Swift ou fonction caméra n’est modifié. Safari/Chrome conservent leur comportement. La cible WebView approuvée par le commit précédent reste inchangée : URL configurée ou domaine public existant. Le transfert ouvre un aperçu ; il ne publie rien automatiquement.

## Vérifications

- TypeScript : `tsc --noEmit`, réussi.
- Tests Node : 16 réussis, aucun échec. Couverture du déclencheur, double clic, import sans boucle, Story et annulation, fallback, réinjection, chargement tardif, navigateur normal et validation des messages.
- Export Expo Android et iOS : réussi, bundles Hermes générés.
- `git diff --check` : réussi.
- APK Android (`gradlew.bat assembleDebug`) : première tentative échouée dans Prefab/CMake sous JDK 25 (restriction Java/JNA). Relance sous JDK 17 : configuration franchie, puis régénération CMake répétée avec avertissements de chemins dépassant la limite de 250 caractères dans ce workspace. Relance interrompue ; aucun APK validé. Aucune modification du build ou des dépendances pour contourner cette limite locale.
- Aucun téléphone connecté à ADB : le nouveau déclencheur n’a pas été exécuté sur OPPO pendant cette intervention. Aucun build natif iOS sous Windows.

## Tester sur Windows / OPPO

Depuis PowerShell, avec le checkout existant et Node/npm installés :

```powershell
Set-Location C:\Users\spega\MyEvent-Mobile
git status --short
git switch mobile-v1-native-camera
git pull --ff-only origin mobile-v1-native-camera
Set-Location mobile\app
npm ci
npm run typecheck
npm test
npm start -- --clear
```

Ouvrir le client MyEvent déjà installé sur OPPO, puis recharger le bundle depuis Metro. Si le test précédent utilisait Expo Go, remplacer la dernière commande par `npm run start:go -- --clear` et scanner le QR code avec Expo Go. Aucun module natif ni dépendance n’a été ajouté ; le client existant peut charger ce changement JavaScript.

Vérifier le bouton Photo/Caméra normal → caméra native → capture → aperçu natif → Continuer dans MyEvent → aperçu web. Le bouton temporaire doit disparaître lorsque l’accueil est prêt. Vérifier ensuite annulation, nouvelle capture, Story et fallback web. La validation de publication/ajout à un événement reste l’action explicite de l’utilisateur.

Si Git signale une divergence ou des modifications locales incompatibles, ne pas employer reset, revert ou push forcé.
