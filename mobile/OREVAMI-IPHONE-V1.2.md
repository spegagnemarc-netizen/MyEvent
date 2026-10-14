# ORÉVAMI iPhone V1.2 — préparation gratuite uniquement

Branche : `mobile/orevami-v1-store-preparation`. Base V1 : `3b154c6077c41792b18eef74312e841b342dbcc0`. Aucun build, achat, inscription Apple, certificat, profil de provisionnement ou publication. V1 reste la référence des parcours ; ce complément précise l'audit statique et les informations encore nécessaires.

## État technique au 14 octobre 2026

| Élément | Résultat statique |
| --- | --- |
| Expo / React Native / React | 57.0.26 / 0.86.3 / 19.2.3, versions conformes à la matrice intégrée du SDK |
| Modules | Caméra 57.0.6, galerie 57.0.20, manipulation d'image 57.0.20, fichiers 57.0.7, capteurs 57.0.3, splash 57.0.9, WebView 13.16.1, safe-area 5.7.0 : versions conformes à bundledNativeModules.json |
| iOS minimum | 16.4 dans Podfile et projet Xcode générés |
| Outils Apple futurs | Xcode 26.4 minimum pour SDK 57 ; image EAS iOS `sdk-57` pour éviter le changement de SDK de l'alias latest ; Node 24.19.0 sur les profils privés et store |
| Nom et identifiants | ORÉVAMI TEST / `app.myevent.mobile.dev` en privé ; ORÉVAMI / `app.myevent.mobile` en store. Un bundle ID ne doit pas être renommé pour refléter une marque ; sa disponibilité Apple reste à confirmer |
| Icône | Officielle, opaque RGB, 1024 × 1024 ; logo et splash inchangés |
| Profils | `private-test`, `production`, `store-candidate` et `development` conservés ; store-candidate hérite de production |
| Projet Expo | Compte spegagnemarc ; myevent-mobile ; ID réel déjà associé dans app.config.js |
| Préparation native | `expo prebuild --platform ios --no-install` réussi ; aucun CocoaPods installé, aucun Xcode/clang/Gradle exécuté |

Les sources iOS et podspecs des modules utilisés sont présents. Aucun module exclusivement Android ajouté. Les versions déclarées ont été comparées à la matrice locale du SDK ; la commande de cohérence hors ligne rapporte aussi des versions à jour, avec sa réserve habituelle sur le mode hors ligne. Ce n'est pas une validation de compilation : résolution des pods, linkage, SDK Apple et signature ne peuvent être prouvés ici sans chaîne Apple.

## Permissions et comportement conservés

Les Info.plist générés contiennent les descriptions françaises caméra, photos, mouvement, microphone et géolocalisation pendant l'utilisation. Caméra et mouvement sont demandés au moment de leur usage ; la galerie passe par le sélecteur iOS. Aucune sauvegarde automatique de photos ni localisation en arrière-plan ajoutée.

La WebView conserve les rubriques événements, discussions, musique, jeux et marketplace du service existant, ainsi que le pont caméra natif. Ce sont des fonctionnalités conservées par absence de modification du code, pas des parcours iPhone revalidés. La présence d'une description microphone ou position ne prouve pas une nouvelle fonction native d'appels/géolocalisation.

Notifications : aucune dépendance expo-notifications, aucun entitlement `aps-environment`, aucune clé APNs ni demande de permission de push. Le fichier d'entitlements généré est vide et aucun UIBackgroundModes n'est présent. Les notifications natives ne sont pas développées.

ATS : `NSAllowsArbitraryLoads=false`. Les entrées de découverte locale Expo présentes dans le projet généré sont destinées au client de développement ; le projet Xcode contient la phase de nettoyage des entrées de découverte en Release. Leur retrait dans un binaire signé n'est pas vérifié ici. Aucun contournement TLS/Vercel ajouté.

## Informations de signature à fournir ultérieurement

- Adhésion Apple Developer active, compte titulaire et Apple Team ID ; droits suffisants sur cette équipe.
- Disponibilité de l'App ID privé `app.myevent.mobile.dev` ; l'App ID store `app.myevent.mobile` sera confirmé séparément.
- iPhone sous iOS 16.4 ou ultérieur, nom de l'appareil et UDID recueilli par le parcours officiel EAS, jamais dans Git ni dans des captures publiques.
- Certificat Apple Distribution autorisé et clé privée correspondante, ou accord explicite pour qu'EAS les crée ; profil ad hoc contenant cet iPhone.
- Pour TestFlight/App Store uniquement : compte App Store Connect, rôle suffisant et app record. Aucun app record requis pour l'installation ad hoc.
- Déclaration de chiffrement/export à confirmer sur les usages réels avant distribution ; aucune déclaration légale fictive renseignée.

Aucun identifiant Apple, mot de passe, OTP, clé privée ou fichier p12 mobileprovision n'est enregistré dans ce dépôt. EAS garde les credentials uniquement après autorisation distincte.

## Installation future sur cet iPhone, sans Mac

**Aujourd'hui, sans Mac ni adhésion Apple Developer : préparation possible, installation native signée de ce projet non disponible.** Expo Go de l'App Store est limité au SDK 54 ; notre SDK 57 ne peut pas y être ouvert. Ne pas rétrograder le projet. Le compte Apple utilisé pour créer Expo n'est pas une adhésion Apple Developer.

Après confirmation d'une adhésion active et accord pour signature et compilation :

1. Sur la machine de travail, dans `mobile/app`, se connecter à Expo spegagnemarc par le parcours sécurisé et identifier l'équipe Apple autorisée.
2. Exécuter `eas device:create`, sélectionner l'enregistrement par site web et l'équipe Apple. Ouvrir sur cet iPhone le lien officiel affiché par EAS. Suivre les étapes de téléchargement/installation du profil d'enregistrement iOS pour recueillir son UDID. Ce profil d'enregistrement n'est pas encore l'application.
3. Confirmer l'iPhone enregistré dans cette équipe ; autoriser EAS à créer/réutiliser le certificat et le profil de provisionnement ad hoc, sans révoquer de certificat existant.
4. Vérifier le quota/coût EAS et obtenir l'accord pour une compilation iOS. La variable EAS preview `EXPO_PUBLIC_MYEVENT_WEB_URL` reste la Preview TEST réelle ; ne pas inclure de token de bypass.
5. Avec `MYEVENT_BUILD_PROFILE=release`, `OREVAMI_DISTRIBUTION=private` et la cible TEST connue, lancer seulement alors `eas build --platform ios --profile private-test`. Ne pas utiliser le contrôle réseau historique du wrapper pour désactiver la protection Vercel.
6. Quand l'IPA réussit, ouvrir son lien Expo depuis Safari sur l'iPhone enregistré, choisir Install et suivre les confirmations iOS. Activer le mode développeur si iOS le demande. Aucun upload TestFlight/App Store automatique.
7. L'accès au service TEST restera protégé par Vercel ; le parcours d'authentification dans la WebView iOS n'a pas été validé. La signature ne résout pas cette restriction. Toute évolution de l'accès TEST nécessitera un traitement séparé, sans baisse globale de protection.

Une adhésion Apple et le quota EAS sont deux prérequis distincts. Autoriser la signature ne constitue pas une autorisation d'achat ni de compilation payante.

## Brouillon App Store et captures

`store/app-store.fr.json` conserve les textes français, coordonnées publiques, icône et exclusions de promesses. Les IDs privés/store sont explicités ; Apple Team ID, App Store Connect App ID et Support URL restent null tant que non confirmés.

`store/app-store-screenshots.fr.json` prépare le jeu iPhone 6,9 pouces : 1 à 10 captures PNG/JPEG, portrait 1260 × 2736, 1290 × 2796 ou 1320 × 2868, sans alpha. Le plan couvre accueil, événements, discussions, caméra, musique, jeux et marketplace. Les seuls assets réutilisables identifiés dans le dépôt sont l'icône et le logo ; ils ne constituent pas des screenshots d'application. Aucune capture native iOS disponible ni inventée : `screenshots` reste vide.

Restent avant une publication : captures authentiques du binaire iOS, URL confidentialité et support vérifiées, suppression de compte effective, questionnaire d'âge et App Privacy fondés sur les données/partenaires réels, compte de revue fourni de façon sécurisée. La suppression d'événement sur PC reste à vérifier, non validée. Aucun audit fonctionnel ou collecte de données Production effectué.

## Sources

- https://docs.expo.dev/versions/latest/
- https://docs.expo.dev/build-reference/infrastructure/
- https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/
- https://docs.expo.dev/build/internal-distribution/
- https://docs.expo.dev/guides/ios-developer-mode/
- https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
