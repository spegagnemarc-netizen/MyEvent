# Lancer MyEvent Android depuis Windows 11

Projet : `mobile/app`, branche `mobile-v1-native-camera`. Cette procédure utilise uniquement la Preview et Supabase TEST. Pas de compte Expo/cloud nécessaire pour le build local.

## Outils à installer

1. Node.js avec npm, version 24.13 ou ultérieure compatible avec le package. Le poste actuel possède un runtime Node embarqué, mais pas un npm utilisateur détecté ; une installation Node habituelle fournit les deux.
2. JDK 17 et définir JAVA_HOME vers son dossier, puis ajouter `%JAVA_HOME%\bin` au PATH.
3. Android Studio. Dans SDK Manager, installer Android SDK Platform 36, Android SDK Build-Tools 36.0.0, Platform-Tools et Command-line Tools. Le projet généré utilise également les versions Kotlin/NDK/CMake définies dans Gradle/Expo ; laisser Android Studio installer celles demandées, sans inventer ni modifier leurs numéros.
4. Définir ANDROID_HOME sur le dossier SDK affiché par Android Studio (souvent `%LOCALAPPDATA%\Android\Sdk`) et ajouter ses dossiers platform-tools et emulator au PATH.
5. Téléphone Android : activer Options développeur et Débogage USB, connecter un câble de données, accepter la clé RSA du PC. Installer le pilote USB constructeur si nécessaire. Sinon créer un émulateur dans Device Manager (API 36).

Ouvrir ensuite un **nouveau** terminal PowerShell et vérifier :

```powershell
node --version
npm --version
java -version
adb devices
```

Le téléphone doit apparaître avec état `device`, pas `unauthorized`. Les variables d'environnement à définir concernent seulement les outils locaux, jamais Vercel/Supabase.

## Installation et lancement sur le téléphone

Depuis le dépôt :

```powershell
git switch mobile-v1-native-camera
cd mobile/app
npm ci
npm run typecheck
npm test
npm run android
```

La dernière commande génère Android si nécessaire, compile le build de développement, propose le téléphone, installe l'application **MyEvent TEST** et démarre Metro. Accepter seulement les permissions souhaitées. Se connecter avec un compte fictif TEST dans la WebView.

Pour les sessions suivantes avec l'app de développement déjà installée :

```powershell
npm start
```

En USB, si le téléphone ne rejoint pas Metro :

```powershell
adb reverse tcp:8081 tcp:8081
```

Débloquer le pare-feu uniquement pour le réseau local si le mode LAN est utilisé. Pas d'ouverture d'un service public nécessaire.

## Produire et installer un APK debug explicitement

```powershell
npm run prebuild:android
cd android
.\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

Ce build debug attend Metro pour son JavaScript ; lancer `npm start` depuis mobile/app et la redirection USB si nécessaire. Ce n'est ni un APK release autonome ni une publication Google Play. Le build local ne requiert aucun changement de production.

## Essai plus rapide avec Expo Go

Le socle actuel utilise des modules compatibles Expo, sans moteur Lens custom installé. Pour un premier essai, installer Expo Go compatible SDK 57 sur Android, lancer `npm run start:go` et scanner le QR sur le même réseau. Ce parcours ne construit pas une application MyEvent autonome et ne permet pas de valider les futurs modules Lens natifs ; préférer le development build ci-dessus pour la suite.

## Contrôles réels à effectuer

- Caméra avant/arrière, refus/accord permission, photo, galerie, reprise, zoom/pinch, timer, grille/niveau et ratios.
- Vérifier le cadrage, orientation et miroir du JPEG par rapport à l'aperçu ; le recadrage commun ne remplace pas ce contrôle matériel.
- Fermer pendant un timer/capture, mettre en arrière-plan, ouvrir/annuler la galerie, vérifier l'arrêt caméra.
- Transférer puis valider explicitement le parcours web Fil ou Story ; vérifier session et persistance TEST.
- Vérifier Explorer, widgets partenaires/retour, permission géolocalisation et caméra web de secours.
- Les Lens/filtres natifs live et la vidéo restent désactivés/non raccordés ; ne pas les considérer testés.

## iOS séparément

Même code dans mobile/app. Sur Mac avec Xcode compatible SDK 57 (matrice Expo : Xcode 26.4+) et l'équipe Apple : `npm ci`, puis `npm run ios`. Le dossier iOS généré est mobile/app/ios, le prototype mobile/ios reste intact.

Un service EAS Build pourra produire un build iOS à partir de Windows avec compte Expo, certificats/profils Apple et appareil enregistré, après configuration et autorisation distinctes. Aucune tâche cloud, création de projet Expo ou signature Apple n'a été lancée ici. Les bundles iOS exportés sous Windows ne constituent pas une IPA compilée/signée.

Références : [build local Expo](https://docs.expo.dev/guides/local-app-overview/), [environnement React Native](https://reactnative.dev/docs/set-up-your-environment), [matrice SDK/outils](https://docs.expo.dev/versions/latest/).
