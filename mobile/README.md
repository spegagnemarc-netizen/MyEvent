# MyEvent Mobile V1 — socle iPhone

**Architecture remplacée par le socle Android + iOS React Native/Expo dans `mobile/app`.** Voir [architecture commune](CROSS-PLATFORM.md) et [lancement Android sous Windows](WINDOWS-ANDROID.md). Ce document décrit le prototype iOS conservé comme référence ; il n'est plus l'architecture générale de l'application.

Base web vérifiée le 5 octobre 2026 : `refactor-final` / `0d0af241d8e85852a7faa159ff9ec883bdc1082a`. Branche isolée : `mobile-v1-native-camera`. Les sources nouvelles sont dans `mobile/` ; seule la fixture de `tests/camera-ai.test.mjs` est alignée sur la référence TEST déjà imposée par le serveur, sans appel réseau réel. Aucun fichier applicatif web, API, variable, table ou policy Supabase modifié. Aucun déploiement requis.

## Architecture retenue

Coque SwiftUI + WKWebView persistante pour les écrans existants, module caméra AVFoundation, traitement Core Image, import PhotosPicker, enregistrement PhotoKit et niveau Core Motion. Un moteur séparé ARKit/RealityKit prépare les Lens ; il ne doit jamais partager la caméra avec AVFoundation. Pas de réécriture Swift des événements, Explorer, profil, stickers ou publication. Pas de framework hybride supplémentaire nécessaire pour ce premier module iOS.

La configuration initiale pointe explicitement sur la Preview TEST existante. Une session Safari n'est pas automatiquement celle de WKWebView : se connecter dans la coque. Aucun secret Supabase, JWT ou mot de passe n'est transmis au natif. La configuration réelle/publication production reste une mission ultérieure autorisée séparément.

## Audit caméra existante

- `index.html` : modal et commandes, bouton ME, galerie, avant/arrière, timer, grille, niveau, ratios, outils créatifs.
- `js/home-social-runtime.js` : getUserMedia, zoom, capture/import, aperçu/reprise et appel `myeventPublishCameraPost`. La vidéo web est enregistrée localement ; ce n'est pas une garantie de publication vidéo complète.
- `js/camera-capture2-final.js` : filtres photo, retouches, beauté légère et stickers. Ne pas confondre transformation CSS du live et rendu final pixel ; notamment la chaleur est calculée au rendu photo.
- `js/camera-appearance*.mjs`, moteur/worker de visage : MediaPipe local et composition existante ; conserver les ressources et leur confidentialité.
- `js/social-friends-stories.js` : parcours Story et contrôle du client authentifié, stockage `story-media`, table `social_stories`, suppression du fichier si insertion échoue.
- La commande événement actuelle ne garantit pas l'attachement effectif d'une photo (limite déjà documentée dans `docs/camera-appearance.md`). Ce socle ne prétend pas corriger cette limite.

## Ce que le code prépare

Caméra avant/arrière portrait, affichage d'images traitées, capture de la frame effectivement affichée, reprise, pinch-to-zoom 1–4× limité au matériel, timers 3/10 s, grille, niveau, ratios 4:3/carré/9:16. Les huit filtres proposés emploient la même fonction Core Image pour l'aperçu et la photo. La capture est une frame 720p recadrée, pas encore une photo capteur pleine résolution. Orientation portrait fixée ; rotation paysage, performances, interruptions et qualité doivent être vérifiées sur appareil.

Galerie via PhotosPicker (sélection ponctuelle, sans lecture complète de la photothèque) ; permission PhotoKit addOnly demandée au moment d'enregistrer. L'import garde l'orientation UIImage, sans appliquer silencieusement les filtres natifs ; les retouches web restent accessibles ensuite. Import maximum 20 Mo ; transfert JPEG maximum 4 Mo, avec refus explicite si trop volumineux.

Apparence, stickers et musique restent dans les écrans web existants. Musique/audio mixée, enregistrement vidéo natif, grain et beauté native ne sont pas implémentés. Les prochains filtres doivent ajouter une recette au pipeline commun, pas un overlay d'aperçu uniquement. Pour la vidéo, prévoir AVCaptureVideoDataOutput → composition → AVAssetWriter et synchronisation audio, avec export puis aperçu explicite.

## Pont natif / web / Supabase

`bridge/native-camera.js` est une ressource injectée uniquement par WKWebView ; elle n'est pas chargée par le site web. Le bouton « Caméra iPhone » est ajouté près de Galerie dans la caméra existante. La caméra web reste disponible.

1. JS envoie uniquement `{version:1, action:"capturePhoto"}` à `myeventCamera`.
2. Swift contrôle main frame, origine HTTPS exacte configurée, port standard, action/version, absence de requête concurrente. Les partenaires externes s'ouvrent hors de la coque dans SafariViewController ; ils n'ont pas ce pont.
3. Le flux vidéo web est arrêté avant l'ouverture native. La caméra native renvoie soit une annulation, soit un JPEG après le choix explicite « Continuer dans MyEvent ».
4. JS vérifie format, taille, en-tête/fin JPEG et crée un File local. L'import existant `cameraFileInput` traite cette photo et affiche l'aperçu. Ce transfert ne publie rien.
5. L'utilisateur valide ensuite le parcours web actuel Fil ou Story ; la session web et les contrôles Supabase existants restent responsables de l'écriture. Le parcours événement réel reste à finaliser avant de le déclarer disponible.

Le contrôle d'origine n'est pas une protection contre un script malveillant sur l'origine MyEvent elle-même : conserver la sécurité web/CSP. Aucun lecteur universel de fichiers, téléchargement d'URL arbitraire ou commande SQL n'est exposé. Navigation/fermeture annule une requête native en cours. Pas d'evaluateJavaScript construite avec une photo non échappée.

## Lens et effets futurs

`LensEngine.swift` prépare une vraie session face-tracking, AnchorEntity(.face), chargement USDZ, vérification SHA-256 et snapshot RealityKit. Support et permission caméra sont contrôlés. Le moteur est volontairement non branché à l'UI : aucun asset factice ni résultat ARKit simulé. Il faudra créer une première Lens licenciée et l'essayer sur matériel compatible.

`lenses/manifest.schema.json` définit version, ID, libellé, type de tracking, asset, empreinte et échelle. Le moteur V1 accepte seulement des ressources locales embarquées validées, maximum 20 Mo. Le catalogue dynamique futur devra vérifier manifest, origine autorisée, empreinte et versions ; aucun code distant exécutable. Lunettes/chapeaux/oreilles/objets 3D peuvent employer des entités attachées au visage. Maquillage/déformations exigent mesh, occlusion et shaders ; particules/décors/personne exigent des backends/capacités distincts. Une promesse de capacité dans le catalogue doit correspondre au support réellement mesuré.

La capture AR finale doit inclure le rendu RealityKit ; enregistrer ARFrame.capturedImage seul perdrait les Lens. Le snapshot est le début du chemin photo ; vidéo RA et filtres sur ARView nécessitent un compositeur commun preview/export puis AVAssetWriter. Ni vidéo RA ni correspondance aperçu/export Lens ne sont validés ici.

## Windows et Mac

Sous Windows : audit, structure, contrat/pont JS, tests JS réels, modèles de manifest et sources Swift. Les frameworks Apple ne peuvent pas être compilés ou exécutés dans cet environnement : aucun résultat caméra native/ARKit réel annoncé.

Sur Mac : installer Xcode et XcodeGen, puis depuis `mobile/ios` lancer `xcodegen generate`. Ouvrir `MyEventMobile.xcodeproj`, sélectionner son équipe Apple, ajuster si nécessaire l'identifiant bundle de développement et connecter l'iPhone. Aucun compte Apple, certificat, profil ou équipe n'est inventé/commité. Xcode construit les sources et le plist avec permissions ; compiler avant d'accepter les API Swift et corriger les diagnostics éventuels. Le simulateur sert aux écrans/pont, pas à prouver la caméra/face tracking réel. La distribution TestFlight exige ensuite l'inscription et la signature adaptées.

Les tests XCTest du pipeline sont préparés dans `ios/Tests` mais non exécutés sous Windows. Connexion e-mail/mot de passe à tester dans WKWebView ; OAuth, liens universels et retour d'authentification depuis Safari nécessitent une intégration distincte et ne sont pas validés.

Les déclarations microphone et localisation préservent les demandes de permission des services web existants ; ce socle ne déclenche ni écoute ni géolocalisation. Le partage/téléchargement de fichiers web dans WKWebView, les appels et les widgets doivent être vérifiés sur iPhone avant de déclarer la coque complète. Aucun token n'est partagé automatiquement avec Safari.

## Organisation et prochaine étape

Le web continue sur `refactor-final`. Les changements mobiles restent sur `mobile-v1-native-camera`, sans fusion dans main. Lors d'une synchronisation, examiner les nouvelles interfaces caméra/publication avant de prendre les commits web ; ne jamais écraser ces commits. Aucune API ni fonction Vercel supplémentaire. Ne pas configurer un déploiement Vercel de cette branche mobile.

Prochaine étape : compilation Mac et session iPhone TEST, permission refusée/autorisée, avant/arrière, zoom, timer, ratios, arrière-plan, import orienté, correspondance preview/JPEG, annulation/navigation et publication explicite Fil/Story. Ensuite seulement brancher une Lens USDZ réelle, tester suivi, perte du visage, occlusion et snapshot ; finaliser le rattachement événement et la vidéo par étapes distinctes.

Références Apple : [pont WebKit avec réponse](https://developer.apple.com/documentation/webkit/wkscriptmessagehandlerwithreply), [frames AVFoundation](https://developer.apple.com/documentation/avfoundation/avcapturevideodataoutput), [suivi facial ARKit](https://developer.apple.com/documentation/arkit/arfacetrackingconfiguration).
