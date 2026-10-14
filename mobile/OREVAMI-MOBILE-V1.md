# ORÉVAMI Mobile V1 — préparation stores

Historique V1 : les assets et profils privés décrits ci-dessous sont remplacés par `OREVAMI-MOBILE-V1.1.md`.

## Décision et architecture

Reprendre `mobile/app` (Expo SDK 57, React Native 0.86, react-native-webview, caméra Expo), déjà développé dans `mobile-v1-native-camera`, plutôt que créer une deuxième fondation Capacitor. La branche dédiée est `mobile/orevami-v1-store-preparation`, base `f2f5e86`.

Le site est une application HTML/JavaScript avec endpoints Vercel `/api/…`, authentification et données Supabase. La WebView charge désormais `https://orevami.com` : elle réutilise l’interface mobile et ses comptes sans recopier de tables ni embarquer de secret. Les chemins API restent sur la même origine. Les noms techniques `MyEvent`, les contrats du bridge et les identifiants existants sont conservés.

Capacitor serait adapté au site, mais une migration de la caméra et des bridges Expo ajouterait du travail sans bénéfice immédiat. Ne pas compiler le prototype Swift historique de `mobile/ios` comme une seconde application officielle : la source iOS/Android retenue est `mobile/app`.

## Préparation effectuée

- Nom public ORÉVAMI et version 1.0.0 ; libellés natifs et permissions en français.
- Identifiants release conservés : `app.myevent.mobile` pour iOS et Android ; développement `app.myevent.mobile.dev`. Vérifier leur éventuelle réservation dans les comptes stores avant signature. Le nom public est indépendant du package.
- Logo officiel et icône copiés depuis les assets ORÉVAMI de la branche Production, sans modifier le web.
- Écran de lancement : logo ORÉVAMI sur fond sombre.
- Profil EAS `production` pour App Store et Android AAB, incrémentation des versions distante, URL officielle explicite et garde contre une cible store différente.
- Profils privés/développement préexistants conservés ; aucune signature créée, aucun build cloud payé/lancé, aucune soumission automatique.
- Projets natifs iOS et Android générables par Expo Prebuild, non committés selon la convention existante. La configuration et le verrou npm sont la source reproductible.
- Brouillon de fiche française : `store/metadata.fr.json`.

## Capacités : faits et limites

| Capacité | Code/configuration | Validation restante |
| --- | --- | --- |
| Interface, comptes, événements | WebView existante, même backend | Session et navigation sur appareils TEST |
| Caméra photo, galerie, avant/arrière, zoom, timer | Écran Expo et bridge existants conservés | Permissions et transfert sur iPhone/Android réels |
| Microphone | Déclaration native, fonctions web existantes | Appels/permissions sur appareils ; pas de nouveau moteur vidéo |
| Géolocalisation | WebView autorisée + permissions au premier plan | Comportement WKWebView/Android et refus ; pas de suivi arrière-plan |
| Notifications push | Non implémentées dans cette fondation | Module, consentement, tokens, APNs/FCM, envoi serveur et désinscription |
| Réalité augmentée / IA native | Non livrées | Travail ultérieur ; ne pas les annoncer |
| Hors ligne | Non livré ; le site est chargé à distance | Écran réseau et stratégie hors ligne à définir |

Les permissions ne sont pas accordées par la déclaration : les demandes doivent rester liées à une action de l’utilisateur. Aucune permission contacts, localisation arrière-plan ou suivi publicitaire ajoutée. Notifications non annoncées comme opérationnelles et aucune fausse demande de permission.

## Blocages de publication

1. Comptes Apple Developer/App Store Connect, Google Play Console et projet EAS à identifier/lier avec autorisation. Réutiliser les clés existantes si disponibles ; ne pas générer de clé ou signer en debug pour une soumission commerciale.
2. Icône source actuelle 512 × 512 : remplacer par un export officiel opaque 1024 × 1024 avant soumission Apple. Préparer aussi un premier plan adaptatif Android transparent et un visuel Play 1024 × 500. Le logo de splash est réutilisé sans retouche.
3. Compiler et signer : IPA avec macOS/Xcode ou EAS, AAB Android avec JDK/SDK ou EAS. Prebuild et export JS ne prouvent pas une compilation native ni l’exécution sur appareil.
4. Vérification ciblée sur un iPhone et un Android avec Supabase TEST, comptes fictifs et URL TEST vérifiée : démarrage, login/logout, refus de caméra/photos/localisation, bridge photo, retour Android et liens externes. Ne pas rejouer les 159 tests de jeux.
5. Auth : le compte Supabase reste compatible, mais la session Safari/Chrome n’est pas automatiquement partagée avec la WebView. Vérifier OAuth et liens de confirmation/reset ; aucun deep link/universal link natif livré dans cette mission. Toute nouvelle URL Supabase ou association de domaine nécessite une mission autorisée séparée.
6. Finaliser les URLs de confidentialité et suppression de compte, déclarations App Privacy/Data Safety, captures réelles, classification d’âge et compte de revue. Les null dans le brouillon sont des champs manquants, pas des valeurs finales.
7. Vérifier modération, signalement et blocage des utilisateurs pour les contenus sociaux (Apple 1.2), suppression de compte (5.1.1), valeur native suffisante (4.2), et conformité des paiements numériques (3.1.1). Ne pas modifier Stripe ici. Les prestations physiques et contenus numériques doivent être examinés selon leur parcours réel ; aucune approbation store garantie.
8. Dépendances : le rapport historique de la branche signalait des alertes npm. Une revue compatible reste nécessaire avant release publique ; pas d’audit fix forcé.

**Suppression d’événement sur PC : toujours en attente, non validée. Aucune donnée de Production modifiée pour ce contrôle.**

## Commandes reproductibles (aucune publication)

Depuis `mobile/app` :

```sh
npm ci
npm run typecheck
# Seulement les contrôles de configuration mobile, pas npm test à la racine :
node --test tests/release.test.mjs
MYEVENT_BUILD_PROFILE=release OREVAMI_DISTRIBUTION=store EXPO_PUBLIC_MYEVENT_WEB_URL=https://orevami.com npx expo prebuild --no-install --platform all
node scripts/verify-android-config.mjs
npm run export:android
npm run export:ios
```

Sous PowerShell, définir les trois variables avec `$env:…` avant Prebuild. Installer les pods sur Mac avant compilation iOS. Pour des essais fictifs, fournir une Preview TEST dédiée et utiliser `npm run start:test` ; ne pas utiliser `orevami.com` comme bac à sable.

Après résolution des blocages et autorisation de compilation signée seulement : `eas build --platform android --profile production` et `eas build --platform ios --profile production`. Ces commandes peuvent engager des frais et créer/consommer des credentials : elles n’ont pas été exécutées. Aucun `eas submit` prévu automatiquement.

## Sources

- https://docs.expo.dev/build/setup/
- https://docs.expo.dev/build/eas-json/
- https://docs.expo.dev/build-reference/app-versions/
- https://docs.expo.dev/push-notifications/push-notifications-setup/
- https://developer.apple.com/app-store/review/guidelines/

## Validation de cette préparation

TypeScript, deux contrôles de configuration/retour Android, génération des deux projets et vérification des permissions Android. Exports JavaScript Android/iOS Hermes réussis (654/656 modules). Aucun test de jeu, compte Production, appel Supabase de mutation ou publication store.
