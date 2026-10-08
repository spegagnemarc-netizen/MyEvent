# Android Release privé — 7 octobre 2026

Branche exclusive `mobile-v1-native-camera`, base `b5a9cf24b5497b37818ef6ee3587d8a9f3a85df7`. Aucun fichier web, Supabase, iOS natif existant ou autre dépôt modifié. Caméra native V1 et secours web conservés ; aucun développement Lens/AR. Les tests d'isolation passent.

## Configuration et contrôles

`MYEVENT_BUILD_PROFILE=release` sélectionne nom **MyEvent**, package/bundle ID **app.myevent.mobile** ; le développement garde son identité `.dev`. Version 0.1.0, versionCode 1, Android minimum 24/cible 36. Logo existant converti en PNG 1024×1024, icône adaptative et splash fond #07131c. Plugin splash chargé une seule fois. Header TEST et bouton temporaire Caméra ME limités à `__DEV__`. Retour Android protège un transfert, ferme la caméra, revient dans l'historique WebView puis laisse Android quitter à la racine. Modal garde sa protection onRequestClose.

APK assembleRelease arm64 : bundle Hermes `assets/index.android.bundle` réellement présent, pas de propriété debuggable dans le manifeste Release, allowBackup=false, mises à jour Expo désactivées, SYSTEM_ALERT_WINDOW absent. Il fonctionne comme application compilée sans serveur Metro ; sa WebView et ses services nécessitent toujours Internet. La cible web reste le domaine public existant ; ce build ne déploie aucune modification web.

Permissions fusionnées contrôlées : caméra, audio, localisation précise/approximative, Internet/réseau, vibration ; lecture/écriture stockage jusqu'à Android 12L seulement ; ACTIVITY_RECOGNITION ajoutée par la dépendance sensors existante (niveau caméra DeviceMotion), permission interne receiver non exporté. Aucun nouveau parcours capteur développé. Les permissions refusées et le rendu réel icône/splash/caméra doivent encore être vérifiés sur appareil.

## Signature et artefact

APK privé **38 293 104 octets**, chemin de livraison local `outputs/MyEvent-release-private-arm64.apk` dans le workspace parent. SHA-256 : `668AA4D8F5E7C1A48C170BAA02C5C1FF2DEA7CA2AD2A88D1778BCBC9D40B3F76`.

Signature APK v2 vérifiée : certificat **Android Debug**, SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Le keystore modèle est identique à la clé de test déjà existante (comparaison SHA-256 fichier). **Aucune nouvelle clé privée générée. Cet APK est réservé au test privé et ne constitue pas un artefact Google Play signé pour publication.** Ne pas diffuser cette signature de test comme signature commerciale.

Le profil EAS release-private est sans developmentClient et withoutCredentials=true ; aucun build cloud ni création de credentials EAS lancé. Pour une livraison store : fournir/identifier la clé de signature autorisée existante ou demander l'autorisation explicite avant d'en créer une, augmenter versionCode selon historique Play et tester une candidate AAB. L'identité du package doit être confirmée avec le compte Play avant publication.

## Reproduction locale

Node >=24.13, JDK 17, Android SDK/NDK/CMake. Utiliser un **chemin physique court** pour éviter les erreurs Windows codegen/autolinking ; ne pas utiliser de lecteur subst mélangeant racines physiques et virtuelles.

```powershell
cd mobile/app
npm ci
$env:MYEVENT_BUILD_PROFILE='release'
npm run typecheck
npm test
npm run export:android
npm run export:ios
npx expo prebuild --platform android --no-install
# Vérifier AndroidManifest, identité et configuration de signature AVANT compilation.
# Pour le seul APK privé, réutiliser la clé debug préexistante identifiée.
cd android
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2 --console=plain
```

Le build de cette mission a réussi dans `C:\Users\spega\MERelease-20261007` (copie des sources/package/configuration, npm ci, prebuild, clé comparée). L'APK n'est pas commité. Le lecteur temporaire de compilation a été retiré. Vérifier `aapt dump badging`, manifeste et bundle, puis `apksigner verify --verbose --print-certs` avant toute installation.

## Validations et limites

TypeScript réussi ; **25 tests app + 9 tests fondation mobile** réussis. Bundles Android et iOS Hermes exportés ; assembleRelease Android réussi (581 tâches, 6 min 53). Pas d'IPA ni compilation native iOS : Windows ne fournit pas Xcode/macOS. Aucun appareil adb connecté, aucune installation ou exécution sur téléphone prétendue. Test privé à faire : lancement sans Metro, connexion, Explorer/réservations/partenaires, native V1 → publication/événement, secours caméra web, refus de permissions, Retour Android, liens externes et reconnexion.

`npm audit` constate 24 alertes (16 élevées, 8 modérées), notamment chaîne Expo/Metro ; le correctif automatique proposé implique des versions incompatibles plus anciennes. Aucun `audit fix --force` effectué. Analyser portée runtime/build et mettre à jour seulement vers des versions compatibles après contrôle. Signature store, revue dépendances et tests appareil restent des blocages Release publique.

Retour privé : revenir au commit mobile stable après sauvegarde des changements, reconstruire avec la même identité et même clé autorisée ; ne pas désinstaller en supprimant les données comme procédure automatique. Le retour web est indépendant. Aucun déploiement store ni changement du domaine n'est autorisé par cette mission.
