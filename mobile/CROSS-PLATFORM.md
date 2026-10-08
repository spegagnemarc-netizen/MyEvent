# MyEvent Mobile — Android et iOS

La base générale est maintenant **React Native + Expo**, dans `mobile/app`. Branche : `mobile-v1-native-camera`, base distante initiale vérifiée `c68a693d47ff53fd3f71a93ae409342b0e90c20d`. `main` et `refactor-final` restent inchangées.

## Audit de la première livraison et réutilisation

La coque SwiftUI/WKWebView était spécifique iOS : elle n'est plus la base de l'application. `mobile/ios` et `mobile/bridge` sont conservés intégralement comme prototype et référence. Sont réutilisables : règles de confiance du pont, absence de clés Supabase au natif, import JPEG dans l'aperçu existant, logique permissions/capture, recettes Core Image, contrôle de support et intégrité des assets Lens. Les interfaces SwiftUI et le handler WebKit ne sont pas des écrans communs et ne sont pas chargés par la nouvelle app.

Le logo ME provient du même fichier existant, copié dans les ressources de l'app. La caméra web, ses scripts, MediaPipe, ressources, API, Supabase et partenaires ne sont ni supprimés ni modifiés.

## Architecture commune

- React Native / TypeScript pour coque, navigation caméra, états, aperçu et permissions.
- Expo SDK **57.0.26**, React **19.2.3**, React Native **0.86.3**, modules choisis dans bundledNativeModules et verrouillés par package-lock.json.
- WebView pour les écrans MyEvent existants et leur client Supabase authentifié. URL fixe de la Preview TEST existante ; aucun secret, service_role ou JWT n'est transmis au natif.
- Expo Camera pour capture Android/iOS, ImagePicker pour la galerie, ImageManipulator pour JPEG/crop, DeviceMotion pour le niveau. Le code est partagé ; les permissions et matériels restent spécifiques.
- Contrats communs pour capacités du moteur, frames/landmarks, manifests Lens et export composé. Les ports Android et iOS restent séparés derrière la même interface.

Choix retenu parce qu'il permet le développement TypeScript commun et la compilation Android sous Windows, conserve les écrans existants et laisse des extensions natives possibles. Expo n'impose pas un moteur Lens exclusif. Aucune réécriture de MyEvent ou nouveau backend.

## Caméra raccordée dans le code

Le bouton de la coque ouvre la caméra commune : avant/arrière, capture photo, import galerie, aperçu/reprise, zoom normalisé et pinch, timer 0/3/10 s, grille, niveau selon support/permission, crop 4:3 portrait, carré ou 9:16. Le déclencheur réutilise le logo ME. Fermeture/arrière-plan invalident les captures en cours et retirent la vue caméra ; la galerie système peut revenir sans perdre son résultat.

« Continuer dans MyEvent » transforme la photo en JPEG local, limite le transfert à 4 Mo, vérifie son format puis injecte un File dans l'import existant sur l'origine HTTPS exacte. La photo n'est pas publiée automatiquement. L'utilisateur valide le parcours web Fil/Story ; les contrôles Supabase existants restent responsables des écritures. Aucun accès Supabase natif ajouté.

La limite existante du rattachement réel d'une photo à un événement reste ouverte. Les sessions Chrome/Safari et WebView ne sont pas automatiquement partagées : connexion TEST nécessaire dans l'app. OAuth, téléchargements, appels, redirections partenaires et persistance doivent être vérifiés sur appareils. Aucun succès physique de caméra ou de publication mobile n'est annoncé ici.

## Filtres et Lens multiplateformes

Le suivi facial visé est **MediaPipe Face Landmarker**, utilisable sur plusieurs plateformes ; iOS peut aussi proposer ARKit/RealityKit derrière l'adaptateur. ARKit n'est jamais une dépendance de l'architecture générale. Les coordonnées sont normalisées, orientées et non miroir, associées à un frameId et un timestamp. Les résultats d'une autre frame, périmés ou invalides sont rejetés.

`color-pipeline.mjs` traite réellement des pixels RGBA : chaud/froid, monochrome, vintage, cinéma, contraste et grain déterministe. Il sert de référence partagée et testable pour les backends natifs. Il n'est PAS encore raccordé aux frames live Expo Camera. L'app n'affiche donc pas de faux filtre natif ; elle propose le fallback caméra web pour les effets déjà existants.

Le manifest commun exprime les assets locaux + SHA-256 et les capacités requises. Une Lens exige un export composé ; une simple surimpression qui disparaîtrait du JPEG ne peut pas être annoncée comme disponible. Les moteurs futurs doivent vérifier l'intégrité des assets avant chargement, limiter leur taille, afficher et exporter la même composition. Aucun code distant exécutable. Landmarks traités localement, sans stockage ni envoi par défaut.

Android : CameraX/ImageAnalysis + MediaPipe puis compositeur GPU pour photo/vidéo, textures/objets GLB, overlays 2D et masque/occlusion. iOS : AVCaptureVideoDataOutput + MediaPipe/Core Image/Metal ; reprendre les recettes du prototype Swift ; ARKit optionnel pour capacités supplémentaires, session caméra exclusive. Les interfaces Kotlin/Swift dans `native-adapters` sont des contrats non enregistrés/non compilés, pas des moteurs déclarés fonctionnels.

Les adaptateurs TS recherchent un module natif enregistré par plateforme ; actuellement absent, toutes les capacités sont false. Lunettes/chapeaux/oreilles, maquillage, barbe/cheveux, 3D, particules et thèmes pourront ajouter des assets et compositeurs, avec gates de support réel. Segmentation cheveux/personne, beauté, vidéo, audio/musique mixée et capture Lens native restent à implémenter. Les tests de pixels et contrats ne prouvent pas ces fonctions sur téléphone.

## Ce qui est spécifique

Android : JDK/SDK/Gradle, permissions Android, caméra matérielle, backend CameraX et moteur de rendu Android, APK de développement. iOS : Xcode/signature Apple, permissions iOS, adaptation du prototype et éventuel ARKit, IPA/TestFlight ultérieure. L'expérience, la logique caméra, les manifests, la politique de confiance et l'interface de capacités sont communs.

## Organisation Git et backend

Tout le nouveau code est dans mobile/app et les documents mobile. Aucun nouveau endpoint Vercel ou projet Vercel, aucun déploiement demandé, aucune migration distante. Le web continue sur refactor-final ; synchroniser plus tard uniquement après examen de ses interfaces, sans écraser ses nouveaux commits.

Les dossiers `mobile/app/android` et `mobile/app/ios` sont générés par Expo et ignorés : ils ne doivent pas être confondus avec le prototype conservé `mobile/ios`. Pas de `prebuild --clean` sur le prototype. Les modules natifs futurs seront intégrés via un module/plugin versionné, pour ne pas perdre des changements lors de la génération.

## Références vérifiées

[Matrice SDK Expo](https://docs.expo.dev/versions/latest/), [builds locaux](https://docs.expo.dev/guides/local-app-overview/), [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/), [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker).
