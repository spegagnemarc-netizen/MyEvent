# ORÉVAMI — sécurité et validation TEST des publicités automatiques V1

26 octobre 2026 · branche `feat/automatic-ads-v1-20261026` · correctif du commit `f9efea0e4ad82f24a8bcf71fba72f1f1271fe8c4`.

## Décision de sécurité

**Pas d'AdSense ni de CMP tierce chargés dans le document de l'application privée.** Le chargeur Google antérieur a été supprimé de `js/ads-providers.mjs`. L'adaptateur AdSense retourne systématiquement indisponible, même si les identifiants, la CMP et tous les indicateurs d'approbation sont fournis. Aucun changement de réglage administrateur ne peut réintroduire un SDK. AdMob reste indisponible. Le verrou de livraison reste également `false`.

Cela garantit l'absence d'accès aux données privées **par le nouveau module de régie automatique livré**, puisqu'il n'exécute aucun code de régie. Cela ne constitue pas une garantie générale sur tous les scripts préexistants de l'application, ni sur une intégration publicitaire future.

Le code d'inventaire et les tests de placement sont conservés pour préparer la suite. Une configuration enregistrée ne signifie ni annonce disponible, ni compte Google connecté, ni autorisation de diffuser.

## Audit des risques

| Risque | Constat | Mesure et limite |
|---|---|---|
| Script tiers dans la SPA authentifiée | Un script importé dans la page bénéficie du contexte du document : DOM, variables accessibles, stockage de même origine, jetons accessibles au JavaScript et requêtes authentifiées possibles. Un hash `#home` ne crée pas d'isolation. | Chargeur de régie supprimé, pas simplement désactivé par configuration. |
| Données cachées | Événements, discussions, profils et écrans de paiement peuvent rester présents ou accessibles après changement de rubrique. | Aucun script publicitaire dans ce document. Aucun sélecteur ou masque CSS présenté comme frontière de sécurité. |
| Retrait après exécution | Retirer une balise script ne stoppe pas nécessairement son code déjà exécuté. | Aucune exécution dans cette V1 sécurisée. Refus local persistant et blocage CMP préparés ; pas de promesse d'annulation rétroactive. |
| Faux consentement | Une checkbox, un événement JS ou un CMP ID saisi ne prouve pas la validité juridique d'un consentement. | Aucun signal de consentement ne permet de lever le blocage du fournisseur. Le pont TCF est préparatoire et testé avec données simulées. |
| Iframe artisanale | Une iframe de même origine ne garantit pas la séparation. Une iframe sandbox opaque peut être incompatible avec la régie ; Google restreint le placement d'AdSense dans une frame d'une autre page. | Aucun contournement par iframe, `srcdoc`, postMessage ou SDK relayé depuis la page privée. |
| Scripts existants | La branche contient déjà des scripts GetYourGuide, Expedia, TicketNetwork, Omio et des bibliothèques CDN. Leur insertion dans le même document partage le risque de confiance. | Ils n'ont pas été modifiés pour préserver les modules existants. Leurs contenus distants et leur conformité ne sont pas certifiés par cette mission. Ce reliquat interdit une promesse de sécurité globale de la SPA. |
| Réglages par un non-administrateur | L'interface seule peut être contournée. | Droits SQL minimaux + RLS SELECT et UPDATE, contrôle d'administrateur actif côté base. |
| Suspension confondue avec consentement | La V1 enregistrait un refus utilisateur permanent lors d'une suspension d'administration. | Corrigé : suspension administrative et retrait du consentement sont distincts. |

## Architecture recommandée avant toute activation

Une **surface publique de découverte en document principal, sur une origine distincte** est nécessaire. Elle doit afficher du contenu public réel, pas uniquement une annonce dans une page vide.

1. Site/app privée actuelle : compte, profils, événements privés, discussions, appels, paiements ; jamais de SDK automatique ni de CMP publicitaire tierce dans ce document. Les campagnes Sponsorisé restent des cartes de contenu servies par ORÉVAMI.
2. Surface publique monétisable : autre origine, idéalement autre site enregistrable pour éviter l'héritage de cookies de domaine. Aucun SDK d'authentification, jeton Supabase, cookie de session partagé, service worker partagé ou contenu personnel. Pas d'identité de profil, de contenu d'événement privé ou de paramètre d'URL personnel.
3. Source de contenu : endpoint serveur en lecture seule, réponse limitée à des champs publics autorisés et modérés ; aucune donnée d'utilisateur ni donnée privée hydratée puis masquée. Ne jamais livrer de clé privilégiée. Vérifier également réponses, caches, erreurs et journaux.
4. Liens entre les deux surfaces : navigation de premier niveau sans contenu privé dans l'URL ; `noopener` et politique de referrer appropriée. Aucun pont exposant stockage, session, DOM ou API privée. CORS et autorisation serveur doivent interdire la lecture des API privées ; revoir CSRF et cookies avant activation.
5. CMP certifiée configurée sur cette surface publique seulement. Google Privacy & messaging (CMP ID 300, présent dans la liste officielle consultée) est le premier candidat ; vérifier sa configuration et la certification au moment de l'intégration. SDK publicitaire uniquement après les conditions requises.
6. Politique CSP et headers propres à cette origine, contrôle des ouvertures de fenêtre, filtrage des endpoints publics et validation réseau avant intégration. Faire valider l'usage par la régie ; aucun iframe artisanal AdSense.

Cette architecture est **proposée, pas déployée ni certifiée**. Elle nécessite une décision produit : le fil connecté actuel ne pourra pas recevoir directement du code AdSense tout en conservant cette garantie de séparation. Si le placement dans ce document privé est indispensable, il faut réévaluer le fournisseur et obtenir une intégration isolée officiellement prise en charge, avec revue de sécurité distincte. Aucune modification des paiements ou migration des profils n'est effectuée ici.

## Supabase TEST : installation effective

Cible confirmée par Management API avant mutation :

- Référence : `ahyyknfjsielnqyoxqgh`.
- Nom : `MyEvent-Admin-Test`.
- Région : `eu-west-3` ; projet actif ; PostgreSQL `17.11.0.002`.
- Table absente avant installation ; fonctions `myevent_is_admin()` et `myevent_account_active()` présentes, définitions contrôlées.

Migration créée avec Supabase CLI **2.122.0** puis appliquée exclusivement à ce projet :
`supabase/migrations/20261026164922_automatic_ads_v1_test_settings.sql`.

La version du fichier est alignée sur `20261026164922`, confirmée dans l’historique distant après application. Elle crée uniquement `public.automatic_ad_settings`. Aucun changement aux tables Sponsorisé, événements, utilisateurs, paiements ou API indépendante. Elle révoque les grants implicites, active RLS, autorise SELECT aux comptes actifs et UPDATE des seuls champs de configuration aux administrateurs actifs. La colonne d'identité n'est pas modifiable ; INSERT/DELETE ne sont pas accordés aux clients. Pas de nouvelle fonction SECURITY DEFINER.

Contrôle final sur la base distante :

| Élément | Résultat |
|---|---|
| `enabled` / `approved` | `false` / `false` |
| Identifiants éditeur/bloc | Vides |
| Espacement / plafond | 8 publications / 2 annonces |
| RLS | Activée ; 2 politiques |
| SELECT anonyme | Refusé |
| INSERT / DELETE client | Non accordés |
| UPDATE colonne identité | Non accordé |
| UPDATE configuration | Colonnes autorisées, puis filtrage administrateur actif par RLS |

Tests distants `tests/automatic-ads-test-rls.sql` : **PASS**. Ils utilisent des identités TEST existantes sélectionnées dans la base, sans les afficher ni les modifier. Vérifiés : lecture d'un compte actif, refus de modification par un non-administrateur, enregistrement et suspension par l'administrateur, contraintes de fréquence/plafond/identifiants, identité non modifiable, refus d'une identité inactive et d'un anonyme. **Toutes les mutations de test sont dans une transaction annulée par ROLLBACK**. L'état final a été relu séparément.

Une première tentative a été interrompue par expiration de la session d'outil ; la tentative suivante a renvoyé PASS. Aucune répétition après ce résultat.

Security Advisors avant/après : aucun signalement concernant `automatic_ad_settings`, aucun nouveau groupe de signalements. Les constats préexistants restent : 54 tables RLS sans politique (souvent privées ou contrôlées par RPC), 1 fonction au search_path mutable, 3 fonctions SECURITY DEFINER exécutables par anon, 92 par authenticated, protection contre mots de passe compromis désactivée. Ces catégories ne prouvent pas chacune une fuite ; elles n'ont pas été corrigées hors périmètre. Références :
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Consentement préparé, pas de CMP fictive

`js/ads-consent.mjs` n'insère aucun script et ne fait aucun appel réseau. Il prépare :

- abonnement `__tcfapi('addEventListener', 2, ...)`, désabonnement et rejet des callbacks tardifs ;
- vérification conservatrice de la CMP attendue, statut chargé, champ TC présent, événement prêt, région RGPD explicite, consentements Google/finalités 1/3/4 et restrictions éditeur contradictoires ;
- absence de CMP, refus, erreur et paramètres incomplets : signal bloqué ;
- ouverture des préférences Google seulement si l'API officielle est déjà installée, via `callbackQueue` et `showRevocationMessage` ; aucune stub ni script Google injecté ;
- bouton de préférences honnête lorsque la CMP n'est pas configurée, et bouton de refus/retrait utilisable immédiatement ;
- le refus local reste prioritaire. Il ne peut être effacé qu'après démarche explicite dans les préférences et nouveau signal `useractioncomplete`, jamais par un consentement ancien `tcloaded`.

La sélection CMP300 reste une préparation ; les paramètres d'administration n'attestent pas une connexion effective. Cette vérification de signal ne décode ni n'audite intégralement un vrai enregistrement TCF. Acceptation/refus réels doivent être collectés par la CMP certifiée configurée sur la surface publique ; conservation des preuves, finalités, fournisseurs, restrictions, accessibilité des choix et contenu juridique doivent y être vérifiés. Aucun booléen local n'autorise la diffusion. Le consentement ne neutralise pas la nécessité d'isolation.

## Vérifications ciblées

Commande locale :
`node --test tests/automatic-ads.test.mjs tests/ads-consent.test.mjs tests/ads-providers.test.mjs`

**13 tests locaux réussis** : blocage inconditionnel du fournisseur, absence de chargeur dormant, transitions CMP simulées, retrait persistant, nouvelle acceptation explicite, suspension distincte du consentement, RLS/contraintes sur PostgreSQL local, droits UI, priorité Sponsorisé, espacement, plafond partagé de deux, chargement différé et sortie des rubriques. Le test d'inventaire injecte un fournisseur factice local, jamais un SDK réel.

Vérification syntaxique des deux modules UI et `git diff --check` réussis. Aucun nouveau test des jeux, restaurants, musique ou paiements. Pas de navigation Preview, déploiement TEST, annonce réelle, clic artificiel, compte créé ni achat. La validation distante porte sur la base et ses rôles SQL réels ; elle ne constitue pas un test navigateur du parcours connecté ou du SDK Supabase via HTTPS.

## Démarches restantes, dans l'ordre

1. Valider le choix d'architecture publique séparée et le placement produit ; construire puis tester cette surface uniquement sur TEST, sans régie réelle.
2. Revoir ses API publiques, absence de session et de données privées, headers, stockage, liens, modération et chemins de retour vers l'application. Examiner séparément les scripts tiers existants si une garantie globale de la SPA est recherchée.
3. Ouvrir/configurer AdSense pour le titulaire, soumettre la surface éditoriale réelle, attendre l'approbation du site et vérifier l'usage proposé auprès de Google. Aucun compte ni abonnement ouvert ici.
4. Configurer Google Privacy & messaging ou une autre CMP certifiée retenue, sur l'origine publique, avec acceptation, refus et retrait accessibles. Vérifier les vrais signaux TCF, restrictions et preuves ; les tests actuels utilisent seulement des simulations.
5. Compléter la politique de confidentialité selon les traitements réels, fournisseurs, transferts, durées et droits. Renseigner les identifiants approuvés et publier uniquement l'ads.txt fourni par le compte ; pas d'ads.txt inventé.
6. Vérifier le parcours d'administration connecté sur TEST. Aucune installation SQL Production ni activation Production n'est autorisée par cette mission ; les demander séparément lorsque la solution est concrète et revue.
7. Après validations, obtenir autorisation explicite pour l'intégration Production puis l'activation réelle. Consulter ensuite les rapports officiels de la régie ; aucun revenu disponible ou estimé dans cette mission.

## Sources primaires consultées

- https://support.google.com/adsense/answer/13554116 (CMP certifiées, dont Google CMP300)
- https://developers.google.com/funding-choices/fc-api-docs (API officielle de préférences)
- https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework (API TCF)
- https://support.google.com/adsense/answer/3394713 (restriction des frames)
- https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

Le changelog Supabase a été contrôlé : grants explicites intégrés ; aucun usage de ltree, pgcrypto ou opérateur personnalisé dans cette migration.
