# Apparence locale

Base: `eeda7b297bbf04a38c84847142caf10c8c7d655a`, branche `refactor-final`.

## Ressources et confidentialité

- `@mediapipe/tasks-vision` **0.10.21**, distribution npm officielle vérifiée avec son SHA-512.
- Face Landmarker **float16, version 1**. Les fichiers JavaScript, WASM SIMD et sans SIMD, le modèle et la licence sont hébergés dans `assets/vendor/mediapipe/`.
- `manifest.json` contient les tailles, sources et SHA-256. Aucun CDN, fournisseur, appel génératif, nouvelle clé API, envoi d'image ou stockage de landmarks à l'exécution.
- Le petit module UI charge à l'ouverture du panneau. Le moteur et le modèle chargent seulement au choix d'un effet local.

## Pipeline

Un seul visage, sans blendshapes ni matrices inutilisées. Worker classique avec import dynamique du module MediaPipe, backend CPU, OffscreenCanvas et un vrai test d'inférence avant utilisation. Une erreur de démarrage, transfert ou détection déclenche le fallback sur le thread principal. Aucun test d'user-agent ne prétend garantir Safari.

Cadence cible initiale: 12 détections/s; pas de nouvelle inférence pour la même frame. Une seule requête à la fois. L'estimation glissante du coût réduit la cadence (jusqu'à environ 1 Hz sur appareil lent); le fallback est plafonné à 8 Hz. La boucle est suspendue en arrière-plan et pendant la préparation d'une photo. L'affichage n'utilise jamais les landmarks d'une autre prise, d'un ancien cadrage ou d'une session fermée.

`cameraDrawFrame` réutilise le cadrage de capture existant: ratio et crop du zoom visuel; le zoom matériel est déjà présent dans la vidéo. Les caméras avant et arrière conservent leur orientation existante, sans ajouter un miroir. Le canvas transparent de l'aperçu occupe le même cadre que la vidéo. Analyse limitée à 640 px en live, 1024 px pour une photo; export conservé à la résolution source. Les photos importées passent par la même composition.

`drawAppearance` est le compositeur commun au live et au JPEG. Lunettes rondes/soleil, étoiles/couronne et maquillage rose/corail utilisent réellement les landmarks. Le maquillage est graphique (lèvres et joues), sans lissage ni retouche générative. Le filtre photo est appliqué à la source, puis les effets sont dessinés, une seule fois. Les changements repartent toujours de la source non filtrée. L'absence de visage retire les effets; une défaillance du moteur conserve la photo sans Apparence avec un message explicite.

Cheveux, Barbe, Looks et Créatif IA restent indiqués non connectés. Les catégories sont défilantes et les choix locaux ont des vignettes rondes tactiles. « Aucun » retire la catégorie; « Retirer tous les effets » ferme le moteur.

À la fermeture: arrêt des timers, invalidation des résultats en attente, arrêt du worker, fermeture du FaceLandmarker de secours, annulation du téléchargement explicite du modèle, suppression des canvas et des caches de landmarks. Les modules JavaScript déjà importés restent dans le cache normal du navigateur; aucune instance du moteur n'est conservée. Une initialisation du fallback déjà engagée est fermée dès sa résolution.

## Vérifications

`node --test tests/camera-appearance.test.mjs`: sérialisation live/photo, fermeture pendant une requête ou un transfert, composition sans visage et à plusieurs résolutions, intégrité des ressources.

Contrôles JS: `node --check` sur les scripts/modules caméra et `js/home-social-runtime.js`. Contrôle Git: `git diff --check`.

Essais navigateur avec une caméra synthétique et le portrait de test officiel MediaPipe (hors dépôt): vrai modèle dans worker et fallback principal, effet absent sans visage, JPEG composé, suppression des effets, publication locale, import, ratio carré, fermeture en cours de chargement. Régression des huit filtres photo, retour Original sans cumul, galerie, reprise et fermeture. Ces essais ne remplacent pas un iPhone physique.

À vérifier sur iPhone Safari: premier chargement en réseau lent, chemin worker/fallback effectif, consommation mémoire/chauffe sur plusieurs minutes, perte/réapparition et rotation du visage, maquillage bouche ouverte, gestes de zoom 1–4×, zoom matériel quand disponible, ratios 9:16/4:3/1:1, avant/arrière, permissions, minuteur, arrière-plan/retour, fermeture pendant chargement, import portrait orienté EXIF/HEIC ou très grande photo, correspondance aperçu/JPEG, safe-area et vignettes sur petit écran.

## Limites existantes volontairement conservées

- « Ajouter à un événement » ne joint actuellement pas réellement la photo.
- Il n'existe pas encore de fonction « Enregistrer ».
- `api/generate-avatar.js` n'est pas modifié. Aucun changement de ces limites dans ce commit.

Référence: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
