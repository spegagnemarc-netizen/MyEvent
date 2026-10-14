# ORÉVAMI iPhone V1 — préparation, sans compilation

Branche exclusive : `mobile/orevami-v1-store-preparation`. Projet EAS existant : `spegagnemarc/myevent-mobile`, ID `643c0641-f24a-439d-af9f-bd3f75c77b29`. Aucun nouveau projet. Ce document complète et actualise les prérequis historiques de V1.1.

## Configuration conservée

- Expo 57.0.26 / React Native 0.86.3, WebView et caméra natives existantes.
- Logo officiel, icône opaque 1024 × 1024 et écran de lancement conservés.
- Identité privée : ORÉVAMI TEST, `app.myevent.mobile.dev`. Identité store réservée : ORÉVAMI, `app.myevent.mobile`.
- `private-test` : distribution interne, client de développement désactivé, environnement EAS `preview`, signature distante, iPhone physique (`ios.simulator: false`), image iOS `latest`, Node 24.19.0.
- Variable publique EAS Preview : `EXPO_PUBLIC_MYEVENT_WEB_URL=https://my-event-oszlsftmf-spegagnemarc-netizen.vercel.app`. Aucun secret de contournement Vercel dans le binaire.
- Protection Vercel conservée : compiler ne demande pas un accès à la Preview. Après installation, l'accès au site TEST exige toujours l'authentification Vercel. Le fonctionnement de cette connexion en WebView iOS n'est pas validé.
- Pas de push natif, APNs, RA, géolocalisation en arrière-plan ni nouvelles fonctions annoncées.

## Permissions iOS

| Permission | Usage actuel / portée |
| --- | --- |
| Caméra | Photo native ; demande utilisateur via expo-camera |
| Photos | Sélection d'une photo avec expo-image-picker ; aucune sauvegarde automatique dans la photothèque |
| Mouvement | Niveau de la caméra, demandé lorsque le niveau est activé |
| Position pendant l'utilisation | Description préparée pour la géolocalisation web ; intégration native et parcours non validés |
| Microphone | Description existante réservée aux appels web ; aucun nouvel appel ou enregistrement audio natif développé |

Les descriptions caméra/photos/mouvement sont générées par les plugins Expo ; les descriptions microphone/position sont dans `ios.infoPlist`. Il ne faut pas demander ces permissions au démarrage sans usage. Aucun entitlement de push ou mode d'arrière-plan ajouté.

## Ce qui est gratuit, et ce qui demande Apple Developer

Au 14 octobre 2026, Expo Go de l'App Store reste au SDK 54. Notre SDK 57 n'est pas compatible avec cette version. Ne pas rétrograder le projet ni promettre un simple QR Expo Go gratuit sur cet iPhone. Une version Expo Go compatible via `eas go` et TestFlight exige aussi une adhésion Apple Developer. Expo Go reste un conteneur de développement, sans installation autonome avec l'icône ORÉVAMI ni vérification des réglages natifs propres au projet.

Une installation locale gratuite du projet sur un iPhone est possible avec un **Mac**, Xcode et un compte Apple gratuit (Personal Team). La signature expire après 7 jours, puis il faut reconstruire/réinstaller. Windows ou Linux ne remplacent pas Xcode pour ce parcours. Certains services/capacités Apple ne sont pas disponibles avec Personal Team.

Une IPA privée EAS ad hoc et TestFlight demandent une adhésion Apple Developer active (Apple annonce 99 USD/an, ou tarif local). Le quota EAS et l'adhésion Apple sont deux choses distinctes. Aucun achat, abonnement, inscription Apple ni compilation effectué dans cette mission.

## Parcours gratuit avec un Mac — commandes préparées, non exécutées

1. Installer Xcode et ajouter son compte Apple gratuit dans Xcode.
2. Récupérer le dépôt et sélectionner uniquement la branche mobile, puis `cd mobile/app` et `npm ci`.
3. Définir `EXPO_PUBLIC_MYEVENT_WEB_URL` sur la Preview TEST ci-dessus, `MYEVENT_BUILD_PROFILE=release` et `OREVAMI_DISTRIBUTION=private` dans le terminal local (aucun secret).
4. Connecter et approuver l'iPhone, générer le projet iOS : `npx expo prebuild --platform ios`.
5. Ouvrir le workspace généré dans Xcode. Choisir l'iPhone et sa Personal Team dans Signing & Capabilities ; conserver l'identifiant TEST si disponible. Laisser Xcode gérer la signature puis Run.
6. Activer le mode développeur iOS si demandé. Si un serveur de développement est nécessaire, lancer `npx expo start --dev-client` dans ce même environnement TEST. Le serveur doit rester accessible depuis l'iPhone.
7. Après 7 jours, reconstruire et réinstaller. Aucun certificat ni projet Xcode généré ne doit être ajouté dans Git.

## Parcours EAS privé — seulement après autorisation distincte

1. Confirmer une adhésion Apple Developer active, l'équipe et les droits de signature. Authentification sécurisée, jamais de mot de passe/code dans le chat.
2. Enregistrer cet iPhone avec `eas device:create` et ouvrir le lien officiel sur l'appareil ; l'UDID sera inscrit dans le profil ad hoc.
3. Autoriser séparément EAS à créer/réutiliser le certificat Apple Distribution et le profil ad hoc, puis autoriser une compilation après vérification du quota/coût.
4. Depuis `mobile/app`, avec la cible TEST renseignée : `eas build --platform ios --profile private-test`. Ne pas utiliser le wrapper historique `build:private` pour forcer un accès Vercel : ce contrôle réseau n'est pas requis pour compiler.
5. Une fois le build réussi, ouvrir le lien Expo sur l'iPhone enregistré et installer l'IPA. Activer le mode développeur si demandé. Aucune soumission App Store ou TestFlight automatique.

TestFlight serait un parcours séparé : profil store, App Store Connect, autorisation d'upload et testeurs. Il n'est pas lancé ici.

## Vérification et limites

Résolution de la configuration iOS et des descriptions de permissions uniquement ; aucun build IPA, aucun simulateur ni test fonctionnel. L'APK Android déjà réussi reste inchangé. Suppression d'événement sur PC : toujours à vérifier, non validée. Main, Production, Supabase, Vercel, DNS et Stripe inchangés.

## Prochaine action utilisateur

Indiquer si un Mac avec Xcode est disponible pour l'installation gratuite temporaire. Sinon, confirmer l'existence d'une adhésion Apple Developer active ; aucune souscription ne sera créée automatiquement.

Sources officielles :
- https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/
- https://docs.expo.dev/develop/development-builds/introduction/
- https://developer.apple.com/help/account/basics/about-your-developer-account/
- https://developer.apple.com/programs/whats-included/
- https://docs.expo.dev/build/internal-distribution/
- https://docs.expo.dev/guides/ios-developer-mode/
