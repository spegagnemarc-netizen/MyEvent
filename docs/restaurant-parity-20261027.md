# ORÉVAMI — parité restaurants, 27 octobre 2026

Branche dédiée : fix/restaurant-parity-20261027. Base exacte : 9195b58777219c8d3d845830fa078a2e8a2af934.

## Audit et choix de base

Événements → Sorties appelle mode=outings : Geoapify restaurants, Viator et activités OpenStreetMap. Les restaurants Geoapify sont normalisés/enrichis par lib/geoapify-restaurants.js ; catalogue conservateur de 20 correspondances, aucune injection ni restriction aux 20. Le moteur demande au maximum 200 résultats au fournisseur. Le rendu coupait auparavant tous les résultats à 30.

Sorties & Rencontres utilisait uniquement activities_list et le filtre des sorties organisées. Le sélecteur Restaurant ne recherchait aucun établissement. Son formulaire dispose déjà de la création de sortie avec fiche de lieu ; les inscriptions restent dans le détail des sorties existantes.

main (213c203) et refactor-final (3c1e014) sont ancêtres de 9195b58. La base retient donc leur état courant et la restauration explicitement validée, sans réintroduire les anciennes branches de release. Les branches publicitaires c01b7df / 77f4708 divergent et retireraient une grande partie de la restauration dans une substitution globale : elles ne sont pas fusionnées. Leurs travaux restent sur leurs branches. Aucun audit exhaustif fonctionnel de tous les modules n'est revendiqué : inventaire des têtes ci-dessous, inspection ciblée des parcours et différences pertinentes.

## Changement

Ajout d'une section Restaurants à découvrir dans la catégorie Restaurant du parcours social, conservant la liste des sorties de membres et ses filtres/inscriptions. Recherche explicite par ville (géocodage existant Nominatim, mémorisé pendant la session du panneau) ou position consentie, rayons 5/20/50/100 km, puis même moteur Geoapify via mode=restaurant sans appeler Viator/Overpass. Résultat mémorisé par paramètres, filtres nom/adresse et budget locaux. Les filtres date, gratuité et places restent propres aux sorties organisées et sont expliqués dans l'interface. Ville renseignée prioritaire sur GPS ; effacer la ville pour rechercher autour de sa position.

Miniatures MyEventPlaceCard, fiche OrevamiRestaurantSheet V2 et dépliant communs. Photos seulement autorisées, sinon illustration. Action événement conservée ; action sociale Créer une sortie ici préremplit le formulaire et sa fiche, sans publication automatique. Rejoindre reste l'action des sorties organisées. Enrichissement des fiches sociales à l'ouverture, sans préchargement de masse. Tous les restaurants reçus restent affichables des deux côtés ; la limite d'affichage de 30 reste pour les autres types d'Événements.

Aucun changement des API, de Supabase, de MyEvent-API, des paiements ou des réservations. Les 12 fonctions sont conservées. Déploiement Git automatique désactivé pour la nouvelle branche avant tout push. Aucun déploiement demandé.

## Validation

3 scénarios ciblés réussis : 45 restaurants simulés dont 20 enrichis et 25 hors catalogue ; miniature → fiche V2 → action sociale ; filtrage local sans nouvel appel ; ouverture du panneau réel et maintien d'une sortie membre, création du formulaire prérempli sans écriture ; restauration V3 → V2 → dépliant horaires/menu/réservation et préservation des recherches, réservations, autres fiches et 12 fonctions. Les appels réseau des scénarios sont simulés. Vérifications de syntaxe des cinq modules modifiés et diff sans erreur. Aucun appel fournisseur réel, aucune écriture distante de données métier.

Commande : node --test --test-isolation=none tests/restaurant-parity.test.cjs tests/restaurant-restoration.test.cjs. Dépendance JSDOM locale réutilisée via NODE_PATH ; aucune installation nécessaire. Le test historique a été adapté aux fins de ligne Windows et aux deux différences de rendu explicitement autorisées.

## Restant avant validation

Pas de Preview créée. Vérifier visuellement sur Preview TEST et mobile : catégorie Restaurant, ville/GPS/rayon équivalents, résultats et ordre à réponse fournisseur identique, nom/budget, fiches et dépliants, photos autorisées, création et sauvegarde TEST de la fiche, inscription à une sortie existante, retours/fermetures et sessions. Vérifier le géocodage ville ambiguë et erreurs/annulation réseau. Les disponibilités fournisseurs réelles ne sont pas testées. Les autres modules ne font pas l'objet d'une régression exhaustive. Aucun déploiement en Production autorisé par ce travail.

## Inventaire des branches distantes au début de mission

```text
origin | 213c2036403ca742afaac27af3548f232bebccd2 | fix(restaurants): publish corroborated website validation (b1d02aa)
origin/backup/production-before-orevami-20261013 | 04a46ed9366c7a68bbfb21d3ed6391ca28bb6eaf | fix(accent): remove WebKit favorite text color and fixed member link hue
origin/consolidation/orevami-priorites-20261024 | c5184ca4ea408c82a5817f3e38f042b4e3c7d497 | Prepare privacy texts and gated authenticated deletion requests [skip ci]
origin/design/orevami-couleurs-rubriques-20261022 | 8f75f89f66b763d74c2ec407507a26817ebb6251 | fix: cibler les reflets or et argent des deux cartes stories
origin/diagnostic/geoapify-gap-once | 9f1e92a01bf749ddb43e2bb6fa7b71f61a01bbfa | diagnostic: isolate one expiring Preview-only Geoapify measurement
origin/docs/orevami-politique-confidentialite-20261021 | c5fc92aff6b130e6cb1144e1fb4ef01e6f23dab2 | docs: lier la procédure de demande de suppression
origin/feat/automatic-ads-v1-20261026 | c01b7df67e3fe1d6778731938914a98e96615992 | fix(ads): block private-document SDKs and validate TEST settings RLS
origin/feat/outing-plan-more-options | eff1fec6ddd517466a6ce3f38a1f017b1379dd38 | fix: recover outing pagination and retain recent partial place results
origin/feat/public-ads-isolation-v12-20261026 | 77f47085e5404229d943451c63fa94c93c0e5e32 | feat(ads): prepare isolated Preview package and document Vercel creation permission blocker
origin/feat/test-video-filming | f0711a3cadf0d462b3452420c2b32e9772791d21 | feat: add opt-in TEST-only filming mode and iPhone recording routes
origin/fix/activities-mobile-20261021 | 39703756f01251fdb56be0310f4920b568e9df0a | Fix mobile activity sizing, date overflow and consistent cover loading
origin/fix/compact-activities-feed-20261021 | b34fe2be5217e7a4b37c359674dd8bcbf02585c5 | Reorder section appending in activity feed
origin/fix/compact-feed-media | be01b26b0995aa3d461430837bbf41396c3d5927 | fix: compact feed media and add zoomable photo viewer
origin/fix/events-mobile-navigation | 4bd1e08a3f6181902c716d8e938d2960c243972e | fix(events): unify secondary navigation carousel
origin/fix/orevami-place-searches | 4979f12ff79965f3a494e24a749016ce6a54aa84 | fix: reserve outing candidates for cultural activities alongside parks
origin/fix/outing-plan-active-event | a6ccc01f86ea3b16c2d84db326dbe54d40f928ab | fix: separate event selection from guarded background loading
origin/fix/profile-logout-music-labels | 0d4def74c3c55a50b3855a136a0bf934b4db5610 | fix(ui): restore profile sign-out and remove duplicate music labels
origin/fix/restaurant-v2-v3-restore-20261026 | 9195b58777219c8d3d845830fa078a2e8a2af934 | fix(restaurants): restore V2 sheets V3 cards and practical accordion
origin/fix/sorties-detail-reference-20261020 | ef242b88f14c834bc883c8a3659c745cbbab8823 | Keep home outing cards narrow and show up to three matching activities
origin/fix/sorties-home-showcase-20261020 | fe9714f20d7e76170d2c32defe0287befc2e120c | Apply approved violet styling to outings controls
origin/integrate/compact-feed-ads-test | f0711a3cadf0d462b3452420c2b32e9772791d21 | feat: add opt-in TEST-only filming mode and iPhone recording routes
origin/integration/production-preserved-20261019 | 5c857f2a795e3e724ba42f28de0d65e46a978cac | feat(activities): prepare guarded TEST persistence, filters and session preferences
origin/integration/real-rollout-20261020 | 4d67bf3c8f55d0f5428dd6f8f5d41488a7180771 | chore(release): version integrated music and rental entry assets
origin/integration/ticketmaster-production-20261023 | 42b7da94db2ae797d3c5d73170848ffd34f95184 | feat(ticketing): add server-side Ticketmaster Discovery for France
origin/main | 213c2036403ca742afaac27af3548f232bebccd2 | fix(restaurants): publish corroborated website validation (b1d02aa)
origin/mobile-v1-native-camera | f2f5e861c364331c5cad81fabaa2d9511ff6d4dd | Prepare autonomous private Android release without new signing credentials
origin/mobile/orevami-v1-store-preparation | e7edd622f3ff2973eb5aff42e7b3845081f3271d | Prepare OREVAMI iPhone V1.2 static compatibility and distribution drafts
origin/omio-production-only-20261003 | b956ddaac7dd27109c97cd9e9fbdf0232019630d | Add Omio official booking widget and mobile sizing to current production
origin/prepare/orevami-launch | b9fff9f7ca23ddeff5704e9cb2b1ca9b74a7256b | fix(launch): prepare safe event deletion, AI loading and account recovery
origin/prepare/orevami-production | 2a1547942bc59c45425ff980b4ce12f6e3d49992 | fix(games): activate TEST schema with event membership safeguards
origin/prepare/orevami-ui-combined | 40468101e48d95307c497452c4b7a0679d0111a5 | Merge validated Events and Profile/Music UI fixes for preview
origin/refactor-final | 3c1e014557cddf032d1cddab06a4b390a4e49649 | Connect Preview restaurant requests to staging through authenticated relay
origin/release-events-2026-10-11 | edc3742b85378dbe54635c246798dc9e3faa9324 | release(events): load event workspace in production build
origin/release/compact-feed-production-20261016 | 3eba1e974d515e668841b0603f3cab09a84e8f30 | feat: prepare validated compact feed and photo/video publishing for production without ads
origin/release/iphone-20261021 | 593f6ed797926b011c80a75d14becc9b8e7df3be | Correct category photo sizing on wide production displays
origin/release/orevami-approved-20261022 | 3b6c1b512ea711006871d6dad3c8f5adc4e9c380 | release: publish approved metallic stories and automatic venue sheets from refactor-final 9e8adcc
origin/release/pasturier-20261024 | 7f7c7002eb177911744333e82803065a1e5dc37d | Publish validated Pasturier enrichment on current production [skip ci]
origin/release/restaurants-generic-20261024 | 2958ca8f347b24689d16e1689e2a6f883abd3064 | Publish generic Restaurants module preserving current production [skip ci]
origin/temp/orevami-sorties-api-audit-20261025 | 616c7e7b0a56142f367057fc8de175747601c325 | fix(audit): reuse dynamic router within Hobby function limit
origin/work/activities-inclusive-20261020 | 06bb2678dd82dbcad66f2d26f7431a8f81bd9f02 | feat(activities): allow general access with targeted adult restrictions and protected participation
origin/work/orevami-majority-audit-20261020 | 24dc92d3a5413112d99d69c50216c26f86fbcfef | chore: preserve exact majority SQL proposal bytes
```
