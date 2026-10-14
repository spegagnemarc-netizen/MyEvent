# ORÉVAMI Mobile V1.1 — candidates privées

Branche distante : `mobile/orevami-v1-store-preparation`. Base V1 : `332d6ad0808d391609f80f92f7bcb59a8799885a`. Le site officiel, main, DNS, Stripe et Supabase ne sont pas modifiés.

## Livré

Icône opaque 1024 × 1024, premier plan adaptatif Android 1024 × 1024 sur fond blanc et wordmark officiel pour les splash iOS/Android. Visuel Google Play 1024 × 500. Sources/proportions conservées, sans génération ni redessin ; la source est une capture, pas un master vectoriel. Fiches séparées App Store et Google Play en brouillon dans `store/`. Aucun screenshot d’appareil inventé.

## Profils de compilation

| Profil | iPhone | Android | Cible / identité |
| --- | --- | --- | --- |
| `private-test` | IPA ad hoc, appareil enregistré requis | APK signé, installable directement | Preview Supabase TEST vérifiée ; `app.myevent.mobile.dev`, ORÉVAMI TEST |
| `store-candidate` | IPA distribution App Store, TestFlight après upload distinct | AAB signé, piste privée Play après upload distinct | `https://orevami.com`, `app.myevent.mobile`, ORÉVAMI |
| `development` | Client de développement existant | Client de développement existant | Développement uniquement |

Le profil sans credentials de V1 est retiré : aucune candidate privée n’est annoncée signée avec une clé debug. Les numéros de build restent gérés par EAS à partir de l’historique réel. Un IPA store n’est pas une IPA ad hoc, et un AAB n’est pas un APK installable.

Le profil `private-test` utilise l’environnement EAS `preview`. Définir là les vraies variables `EXPO_PUBLIC_MYEVENT_WEB_URL`, `OREVAMI_EXPO_OWNER` et `OREVAMI_EAS_PROJECT_ID` après liaison du projet. Aucune valeur fictive, aucun ID EAS inventé. Le contrôle de syntaxe dans app.config ne démontre pas l’isolation Supabase ; le wrapper `build-private.mjs` vérifie la configuration réelle avant le lancement. Une Preview protégée/inaccessible bloque ce contrôle. Ne pas embarquer de secret de bypass et ne pas lever la protection globale.

## Comptes et signatures nécessaires

| Élément | Usage | État dans ce workspace |
| --- | --- | --- |
| Compte Expo et projet EAS réel | Lier le dépôt, compiler, stocker les credentials autorisés | Aucun EXPO_TOKEN ni projectId identifié ; utilisateur/organisation à confirmer |
| Apple Developer Program actif et équipe Apple | Signer l’IPA ; App ID ; profil de provisioning | Équipe, certificat et profil non fournis |
| UDID iPhone | Inscrire l’iPhone dans le profil ad hoc privé | À enregistrer via EAS/Apple, sans publication |
| Certificat Apple Distribution + clé privée associée | Signature ad hoc ou store | Réutiliser un certificat autorisé existant ou obtenir autorisation séparée de création |
| App Store Connect, rôle App Manager/Admin adéquat | Fiche app et upload TestFlight | App record et droits non identifiés ; pas nécessaire pour simple ad hoc |
| Keystore Android + alias + mots de passe | APK/AAB release | Aucun credentials.json ni clé release identifié ; ne pas utiliser debug.keystore |
| Google Play Console, app record et Play App Signing | Distribution AAB sur piste interne puis publique | Non identifiés ; pas nécessaire pour installer directement un APK privé |
| Clé d’upload Android | Soumettre AAB à Play | Réutiliser celle du package si enregistré ; ne pas remplacer la clé existante |
| API App Store Connect / service account Google | Automatisation d’upload éventuelle | Optionnels pour les premiers uploads manuels ; ne pas créer ici |

Conserver `app.myevent.mobile` pour une continuité éventuelle, même si le nom public est ORÉVAMI. Confirmer que ces IDs n’appartiennent pas déjà à un autre projet/compte avant signature. Les .dev privées ne remplacent pas une installation release. Les sessions utilisateurs restent dans la WebView du build correspondant, sans migration de données serveur.

## Commandes préparées, non exécutées

Depuis `mobile/app`, après liaison réelle du compte/projet et configuration EAS preview :

```sh
# URL réelle HTTPS de la Preview TEST autorisée, jamais un placeholder exécuté :
# EXPO_PUBLIC_MYEVENT_WEB_URL, OREVAMI_EXPO_OWNER, OREVAMI_EAS_PROJECT_ID
npm run build:private -- android --prepare-only
npm run build:private -- ios --prepare-only
# Après accord pour un build signé et credentials déjà configurés :
npm run build:private -- android
npm run build:private -- ios
# Après accord distinct pour construire une candidate store :
eas build --platform android --profile store-candidate --non-interactive
eas build --platform ios --profile store-candidate --non-interactive
```

Le wrapper ne fait qu’un GET de configuration pour confirmer Supabase TEST puis appelle EAS en mode non interactif. Aucun envoi Supabase, aucun auto-submit ; si le CLI/compte/credentials manquent, il échoue. Ne pas lancer de création de credentials ni acheter une adhésion sans autorisation. L’utilisateur peut se connecter via les pages officielles ; aucun mot de passe, certificat privé ou mot de passe de keystore dans le chat/Git.

Pour iOS ad hoc : enregistrement de l’appareil puis provisionnement privé. Pour TestFlight ou piste interne Play : une autorisation explicite d’upload/distribution reste nécessaire, même sans publication publique. Les comptes/testeurs et leurs invitations doivent être approuvés séparément.

## Fiches et état de livraison

Les descriptions et informations de contact sont préparées, sans promesse de push ou RA. Restent : vraie URL de confidentialité, URL/parcours de suppression de compte, inventaire App Privacy/Data Safety, âge, screenshots réels et compte de revue si soumission. Notifications push toujours non implémentées ; APNs/FCM ne sont pas nécessaires pour compiler la V1.1 sans push. Caméra native et permissions existantes conservées.

Aucun IPA/APK/AAB signé produit dans cette mission, aucun compte développeur créé, aucun build EAS lancé, aucun upload store. Les 159 tests de jeux et les tests mobiles déjà passés ne sont pas relancés. Contrôles nouveaux limités aux dimensions/alpha des assets et à la résolution des profils Expo. Aucun essai fonctionnel ni données Production.

**Suppression d’événement sur PC : à vérifier ultérieurement, non validée.**

## Prochaine action utilisateur

Indiquer si des comptes Expo, Apple Developer et Google Play Console existent déjà, et si une clé Android release existe. Commencer par connecter/identifier Expo + Apple Developer pour l’iPhone et enregistrer son appareil ; Android peut démarrer en APK privé sans Google Play. L’autorisation pour utiliser/créer les signatures et lancer les premières compilations signées sera demandée avec le compte, le profil et le coût/quota identifiés.

## Sources officielles

- https://docs.expo.dev/build/internal-distribution/
- https://docs.expo.dev/build/eas-json/
- https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/
- https://docs.expo.dev/submit/testflight/
- https://developer.apple.com/help/account/provisioning-profiles/create-an-ad-hoc-provisioning-profile
