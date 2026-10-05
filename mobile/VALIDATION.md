# Validation de la première livraison — 5 octobre 2026

## Réellement exécuté sous Windows

- Vérification HEAD GitHub avant intervention : refactor-final `0d0af241d8e85852a7faa159ff9ec883bdc1082a`, dépôt propre ; main `3aa93be774225817a5494ee987f6bcfb03809c08`.
- `node --check mobile/bridge/native-camera.js` : réussi.
- Suite `mobile/tests/native-bridge.test.mjs` + `tests/camera-appearance.test.mjs` + `tests/camera-ai.test.mjs` + `tests/explorer.test.mjs` + `tests/accommodation-widget.test.mjs` + `tests/travel-partners.test.mjs` : **35 tests réussis, aucun échec** après corrections de fixtures.
- `mobile/tests/project-config.test.mjs` : **2 tests réussis**, parsing YAML XcodeGen et JSON/schema Lens ; chemins ressources existants.
- Comparaison Git : aucune modification des écrans/scripts applicatifs web, API, server, Supabase ni vercel.json. La fixture caméra IA uniquement est alignée sur la référence TEST autorisée ; tous les appels externes y sont mockés.
- `git diff --check` : réussi.

La première exécution avait une assertion inter-contextes JSDOM erronée et cinq tests caméra IA refusés par le garde d'environnement existant (ancienne référence fictive). Corrections limitées aux tests ; aucun affaiblissement du serveur. Le parseur YAML a été trouvé dans les dépendances déjà installées et les versions des outils de test sont déclarées séparément dans mobile/package.json.

## Non exécuté / non validé

Swift, xcodebuild et XcodeGen ne sont pas installés sur cet environnement Windows. Aucune compilation/signature native, caméra iPhone, permission physique, Core Image natif, XCTest, ARKit/RealityKit ou mesure de performances réelle. Le code Swift est un socle à compiler sur Mac, pas une application native déclarée prête à publier. Aucun nouveau build/déploiement Vercel nécessaire pour ce dossier mobile ; aucun endpoint ajouté et configuration web inchangée.

Les sept tests du pont exécutent réellement le JavaScript dans JSDOM avec un transport WebKit simulé : ils prouvent import, annulation, validation et verrouillage du JS, pas le fonctionnement de WKWebView sur appareil. Les contrôles de configuration ne constituent pas une compilation Xcode.

## Reproduction

Sous Node 24.13+ : installer les dépendances de test dans mobile (`npm install`), puis `npm test` depuis ce dossier. Les régressions web existantes nécessitent aussi leur environnement de test habituel. Les tests ne contactent pas Supabase/OpenAI réels.

Sur Mac : XcodeGen + Xcode ; lister les simulateurs installés avec `xcrun simctl list devices available`, renseigner `MYEVENT_SIMULATOR_ID`, puis `sh mobile/scripts/verify-macos.sh`. Ce script crée le projet local et lance les XCTest préparés sans signature sur simulateur. La caméra/RA et la publication authentifiée nécessitent ensuite un iPhone et une session TEST réelle.

## Gates avant livraison iPhone

1. Compiler, traiter tous les diagnostics Swift/Xcode et exécuter XCTest.
2. Tester les permissions, capture/galerie/reprise, zoom/timer/grille/niveau/ratios et suspension après fermeture/arrière-plan.
3. Vérifier les pixels preview/JPEG, miroir avant, orientation et limites de taille.
4. Tester le pont sur WKWebView réel, import puis publication explicitement validée Fil et Story ; vérifier les liens affiliés target blank et retour partenaire.
5. Finaliser la liaison événement existante, encore incomplète ; ne pas annoncer son succès.
6. Brancher une Lens USDZ licenciée réelle et tester son support, suivi/occlusion et capture composée. La vidéo et les effets avancés restent une étape ultérieure.

Production, main, Supabase distant et domaine public inchangés. Aucun résultat natif/RA simulé présenté comme réel.
