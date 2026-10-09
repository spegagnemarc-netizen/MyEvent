# Diagnostic administrateur Sabre CERT — préparation Preview

HEAD local et distant vérifiés : `b53ceb3d29e196b9c32629e3b6c933f1c97af36d`, branche `refactor-final`.

## Implémentation

Administration → Diagnostic Sabre dans `index.html`, avec connexion OAuth, recherche Paris et comparaison sans PCC explicite / PCC S5OM (lettre O). Dates préremplies : 10–12 novembre 2026 ; 2 adultes, 1 chambre. Les dates restent modifiables et doivent être futures. Les hôtels normalisés affichent uniquement les informations fournies : adresse, distance, tarif du séjour, devise, disponibilité déclarée, équipements et image si présente. Aucun parcours de réservation.

Le POST `/api/admin-sabre-diagnostic` réutilise `api/[search].js` : 12 fonctions API au total. Budget de durée fixé à 180 secondes pour permettre deux recherches et la relance existante de WARN.0366. Le navigateur abandonne après 110 secondes et ne prétend pas avoir obtenu un résultat.

L'origine doit être exactement `https://api.cert.platform.sabre.com`. L'adaptateur existant utilise `/v2/auth/token` puis `/v5/get/hotelavail`. Le PCC est ajouté dans `GetHotelAvailRQ.POS.Source.PseudoCityCode` uniquement pour S5OM ; aucun POS explicite n'est ajouté à l'autre recherche. L'acceptation de ce format par le compte CERT reste à confirmer avec l'appel réel. OAuth est renouvelé pour chaque diagnostic. Les HTTP des tentatives, le statut applicatif, les codes de warning et les erreurs de permissions restent visibles ; aucun corps Sabre brut ni jeton n'est envoyé au navigateur. WARN.0366 persistant ne constitue pas une preuve d'absence d'hôtels.

## Contrôles d'accès

Le serveur exige `VERCEL_ENV=preview`, le projet Supabase TEST validé par le contrôle d'environnement existant, un JWT utilisateur Supabase vérifié par `/auth/v1/user`, l'UUID exact du propriétaire, puis deux RPC retournant strictement `true` : `myevent_is_admin` et `myevent_account_active`. Toute absence de confirmation refuse l'accès. Aucun service-role ni rôle communiqué par le client n'est utilisé.

Le propriétaire est épinglé exclusivement dans `server/sabre-admin-policy.json` : `cfd3f5c6-afd7-46a5-890e-d1e8ad14102c`, compte TEST `test-b@example.com`, confirmé par l'utilisateur. Une vérification réelle en lecture seule dans le tableau de bord MyEvent-Admin-Test a confirmé le 9 octobre 2026 : rôle `super_admin`, compte actif (non banni, non suspendu), droits EXECUTE pour `authenticated` sur les deux RPC. Aucun rôle ou donnée Supabase n'a été modifié. Le chemin de la politique et le module serveur sont bloqués par les routes Vercel ; le client ne choisit pas son identité administrateur.

Limites en mémoire par instance : 20 vérifications de session par minute, trois diagnostics par dix minutes et une opération Sabre simultanée. Une comparaison représente deux recherches et leurs éventuelles relances bornées. Ces limites ne constituent pas un quota distribué entre plusieurs instances Vercel. Le contrôle propriétaire reste obligatoire sur chaque appel.

Les réponses ne sont pas mises en cache. Les changements de session annulent les appels navigateur et effacent leurs résultats. L'interface échappe les données via textContent et ne transmet aucun identifiant Sabre. Aucun journal de diagnostic ne contient les secrets.

## Vérifications et limites

Les tests automatisés serveur couvrent les refus d'accès, le projet TEST, les permissions, la configuration CERT exacte, les corps PCC, les dates/occupations, les erreurs OAuth/HTTP, WARN.0366, les résultats vides, la non-divulgation des secrets et les quotas. Les tests UI couvrent la connexion, la comparaison, les tarifs, l'injection HTML, l'interdiction hors Preview et les changements de compte.

Résultat `node --test tests/*.test.mjs` : 170 tests, 169 réussis, 0 échec, 1 ignoré. Les 15 nouveaux tests serveur/UI sont inclus. Les migrations utilisées par certains tests existants tournent uniquement dans les fixtures locales PGlite, jamais contre les données Supabase distantes.

Le test navigateur local utilise explicitement des réponses simulées de QA, jamais des hôtels réels. Chromium est vérifié à 390 × 744 et 1280 × 800, avec les scripts et styles réels de l'administration : ouverture, boutons, appels POST, erreurs, absence de débordement et bandeau TEST. Le haut de l'administration suit désormais la hauteur réelle du bandeau, y compris sur deux lignes. Safari iPhone réel reste à tester.

Le dépôt ne fournit pas de script build, lint ou TypeScript. Les fichiers JavaScript modifiés passent node --check ; git diff --check contrôle les erreurs de patch. Le build Vercel et le nombre de fonctions effectivement générées devront être vérifiés sur la Preview après levée du verrou propriétaire.

## Préparation de livraison autorisée

Aucun appel Sabre réel n'a encore été effectué pendant la préparation : aucun hôtel ou tarif CERT confirmé. Aucune variable Vercel modifiée. Aucun changement main, Production, données ou rôles Supabase, MyEvent-API, ni activation publique Sabre. L'autorisation de livraison Preview est conditionnée aux contrôles d'accès et aux tests réussis.

Après le contrôle du HEAD distant, commit/push normal sur refactor-final et Preview uniquement. Depuis le compte TEST B déjà administrateur, ouvrir Profil → Administration → Diagnostic Sabre, tester OAuth, puis comparer Paris avec/sans S5OM. Un refus du rôle ou du compte actif reste bloquant ; cette mission ne modifie aucun rôle Supabase. L'URL exacte et le statut Ready sont à relever après le build Vercel ; ne pas confondre les réponses de fixtures avec des appels réels.
