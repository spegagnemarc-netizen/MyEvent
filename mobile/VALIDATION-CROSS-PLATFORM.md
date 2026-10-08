# Validation Android + iOS — 5 octobre 2026

## État et limites

La correction transforme le socle général en React Native/Expo. Le prototype `mobile/ios` et son pont sont conservés sans modification. Ce rapport ne remplace pas une exécution sur téléphone : aucun Android/iPhone ni moteur Lens natif n'a été exécuté ici.

## Contrôles réellement exécutés

- HEAD GitHub initial mobile : `c68a693d47ff53fd3f71a93ae409342b0e90c20d`, dépôt propre. `refactor-final` : `0d0af241d8e85852a7faa159ff9ec883bdc1082a`. `main` : `3aa93be774225817a5494ee987f6bcfb03809c08`.
- Installation locale npm des dépendances, versions verrouillées dans `mobile/app/package-lock.json`. Aucune installation globale ou secret nécessaire.
- TypeScript : `tsc --noEmit`, réussi.
- Contrôle Expo en ligne `expo install --check` : réussi après alignement de @types/react et TypeScript sur les versions recommandées. Le contrôle offline ne suffisait pas ; il a été complété en ligne.
- Génération réelle Android `expo prebuild --platform android --no-install` : réussie. Gradle wrapper, projet Android et manifest existent localement dans le dossier généré ignoré.
- Contrôle du manifest généré `scripts/verify-android-config.mjs` : permissions caméra, microphone et localisation présentes et non bloquées. Ces déclarations n'accordent aucune permission utilisateur.
- Bundles **Android et iOS** Expo/Metro avec bytecode Hermes : réussis. Aucun export n'a été envoyé sur un service distant. Ce sont des bundles applicatifs, pas APK/IPA.
- Suite commune/mobile/prototype/caméra web/Explorer/partenaires : **44 tests réussis**, puis **2 contrôles d'isolation supplémentaires réussis** ; total **46 tests distincts**. Les 9 tests de l'app ont ensuite été relancés avec succès.
- Comparaison Git : prototype Swift, pont existant, écrans/scripts web, API, serveur et Supabase inchangés. Copie du logo ME vérifiée par SHA-256 identique.
- `git diff --check` réussi (avertissements de conversion LF/CRLF sans erreurs de contenu).

Les tests exécutent réellement le JS du pont, les transformations RGBA, les contrôles de landmarks/manifests et les parcours simulés JSDOM existants. Les landmarks de fixtures ne proviennent pas d'une inférence sur téléphone. Aucun transfert/publication physique mobile ni suivi facial réel n'est annoncé.

## Anomalies constatées et corrigées

- Premier export Android échoué sur un chemin incorrect du logo ; corrigé, exports Android/iOS réussis.
- Config initiale du sélecteur photo bloquait globalement CAMERA/RECORD_AUDIO via tools:node=remove ; corrigée, Android régénéré et manifest réellement contrôlé.
- Dépendances de développement non recommandées par Expo : alignées et contrôle en ligne réussi.
- Retour de galerie système : l'invalidation AppState d'une capture ne doit pas jeter le résultat du picker ; cycle de galerie séparé, invalidation à la fermeture du composant conservée.
- Attente d'import web avec accusé de réception et timeout ; en cas d'échec, l'aperçu natif reste disponible pour réessayer, sans prétendre à une publication.

## Build natif bloqué

Tentative réelle `android/gradlew.bat assembleDebug` : **échec avant compilation**, « JAVA_HOME is not set and no java command could be found ». Java/JDK, SDK Android et ADB ne sont pas détectés dans cet environnement. Aucun APK n'est fourni, aucune installation appareil prétendue. La procédure d'installation des outils et de compilation se trouve dans WINDOWS-ANDROID.md.

Xcode/macOS absents : pas de build natif iOS, signature ou IPA. Aucun build cloud ni projet cloud Expo créé. Les interfaces natives Kotlin/Swift de l'app sont des contrats préparés, pas des modules intégrés/compilés.

## Fonctions encore à raccorder / valider

- Appareil : permissions, avant/arrière, orientation/miroir, zoom matériel, ratios/crop exact, timer, niveau, arrière-plan, galerie et transfert WebView.
- Authentification dans WebView, retour partenaires, Fil/Story et persistance TEST ; OAuth et téléchargements exigent des essais/intégrations propres.
- Moteurs natifs de frame-processing et Lens Android/iOS, vérification des assets, preview/export composé, segmentation, vidéo/audio. Actuellement capacités natives false, fallback effets web conservé.
- Le rattachement réel d'une photo à un événement conserve sa limite existante ; aucune donnée ni migration créée pour la masquer.

## Fichiers de cette correction

- Modifiés : mobile/.gitignore et mobile/README.md (orientation générale corrigée, prototype préservé).
- Nouveaux documents : CROSS-PLATFORM.md, WINDOWS-ANDROID.md, VALIDATION-CROSS-PLATFORM.md.
- Projet : mobile/app/package.json, package-lock.json, app.json, tsconfig.json, index.ts, eas.json.
- Coque/pont : src/App.tsx, src/config.ts, src/bridge/protocol.mjs.
- Caméra : src/camera/CameraScreen.tsx, contract.ts, geometry.mjs ; src/assets/camera-me-logo.jpeg copié à l'identique.
- Effets : src/effects/nativeAdapter.ts, policy.mjs, color-pipeline.mjs ; src/platform/android.ts, ios.ts.
- Ports natifs : native-adapters/android/EffectsBackend.kt et native-adapters/ios/EffectsBackend.swift.
- Tests/outils : tests/bridge.test.mjs, camera-contract.test.mjs, isolation.test.mjs ; scripts/verify-android-config.mjs.

Tout le travail reste sur la branche mobile. Aucun push forcé, changement main/refactor-final, déploiement Production, variable Vercel ou écriture Supabase.
