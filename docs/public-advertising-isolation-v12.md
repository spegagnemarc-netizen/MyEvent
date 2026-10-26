# ORÉVAMI — zone publique isolée V1.2

26 octobre 2026 · branche `feat/public-ads-isolation-v12-20261026` · base `c01b7df67e3fe1d6778731938914a98e96615992`.

## Résultat livré

Application publique autonome dans `public-discovery/`, avec recherche, filtres Nature / Restaurants / Culture / Jeux / Rencontres / Concerts, fiches accessibles, mise en page ordinateur/mobile et douze propositions **explicitement fictives**. Aucun restaurant réel, compte utilisateur, profil, photo privée, événement privé ou donnée de paiement n'est importé.

Aucun SDK publicitaire ou CMP tierce n'est chargé. La diffusion réelle reste impossible dans cette version : pas de chargeur de régie, pas d'identifiants configurés, CSP fermée aux tiers, `releaseEnabled: false` et `ads.txt` non servi. Le code de l'application authentifiée et sa navigation sont inchangés.

**Exécuté uniquement sur deux origines locales de TEST. Aucun hébergement distant, domaine, DNS, migration ou déploiement n'a été créé/modifié.** La mise sur une origine distante distincte reste une opération à autoriser. La configuration Vercel de la nouvelle branche interdit son déploiement automatique.

## Architecture retenue

Une **page publique en document principal**, à héberger séparément de la SPA privée, et non une iframe AdSense dans le fil connecté.

- Origine privée : application ORÉVAMI actuelle, comptes, profils, événements, discussions, appels, paiements. Le chargeur automatique reste bloqué comme en V1.1.
- Origine publique : paquet autonome `index.html` + `headers.json` + serveur dédié. Aucun client Supabase, code d'authentification, variable d'environnement, proxy, import de l'application privée ou accès à sa base.
- Build : seuls les helpers purs de politique d'inventaire et le pont CMP sans réseau sont réutilisés depuis la V1.1. Ils sont compilés dans le fichier autonome ; aucune importation de module privé à l'exécution.
- Pas de bridge `postMessage`, pas de partage de cookies/session/localStorage, pas de `document.domain`, service worker ou stockage de jeton. L'origine publique garde seulement une préférence locale de refus, sous une clé propre.
- Refus d'une requête contenant `Authorization`, un cookie ou un paramètre de requête ; aucune route privée, mutation HTTP ou lecture arbitraire du dépôt. Pas de CORS permissif, pas de `Set-Cookie`.
- Routes locales autorisées : `/`, `/index.html`, `/health`, `/control-events` (GET en lecture seule). `/ads.txt` renvoie 404 tant qu'il n'existe aucune configuration approuvée.
- CSP avec hashes exacts : scripts et styles intégrés uniquement, `default-src 'none'`, `connect-src 'self'`, frames/workers/objets/formulaires interdits. Les headers imposent aussi `frame-ancestors 'none'`, X-Frame-Options DENY, COOP same-origin, referrer absent et permissions caméra/micro/GPS/paiement désactivées.
- Le serveur local écoute exclusivement sur 127.0.0.1. Pour un futur hébergement, copier le paquet public seul et conserver tous ses headers sur une origine dédiée. Aucun secret de l'application privée ne doit être fourni à ce service.
- Le routage principal reçoit une protection préparatoire 404 sur `/public-discovery/...` : ne pas servir ce paquet par erreur depuis l'origine de l'application privée. Ce changement est seulement sur la branche de travail, pas sur Production.

Une origine distincte est indispensable ; un autre chemin URL ne suffit pas. Pour le futur choix de domaine, préférer un site enregistrable distinct, ou vérifier strictement les cookies de domaine, les règles d'authentification et les accès API si un sous-domaine est choisi. Des ports différents démontrent la séparation d'origine en laboratoire, pas l'ensemble des garanties d'un hébergement réel.

## Limite AdSense et parcours produit

La FAQ officielle AdSense consultée interdit le placement d'annonces dans une frame d'une autre page :
https://support.google.com/adsense/answer/3394713?hl=en-GB

Il n'est donc pas présenté d'iframe artisanale « compatible AdSense ». Le paquet interdit lui-même l'embarquement par iframe. La validation du compte, de la surface publique et du parcours doit venir de Google avant toute monétisation. Les exigences de certaines WebView mobiles sont un autre cas ; elles n'autorisent pas par défaut une iframe web dans ORÉVAMI.

**Conséquence produit :** cette V1.2 ne place pas de publicité Google au milieu du fil connecté actuel. La zone publique se visite indépendamment ; aucune navigation existante n'a été modifiée. Un futur lien de navigation devra être revu puis utiliser une ouverture sans relation d'opener et sans referrer, sans code d'événement ni identifiant dans l'URL. Si la présence dans le fil privé est impérative, obtenir d'abord une solution officiellement prise en charge par une régie et compatible avec une isolation réellement vérifiée. Ne pas contourner l'interdiction de frame.

Les contenus fictifs rendent le parcours vérifiable mais ne constituent pas une surface éditoriale réelle admissible à AdSense. L'approbation et les revenus ne sont pas acquis.

## Inventaire, Sponsorisé et administration

L'atelier TEST est fermé par défaut. Un bouton explicite affiche des emplacements simulés, avec indication « Sponsorisé · exemple fictif » et « Publicité · simulation locale » ; aucune annonce Google n'est imitée ni cliquable.

Le même helper `planSlots` que la V1 est réutilisé : priorité au Sponsorisé éligible simulé, intervalle configuré de 5 ou 6 publications pour la démonstration, plafond **partagé de deux**. IntersectionObserver diffère le montage à proximité des publications ; hors atelier, aucune case ou cadre vide. Les catégories et recherches recalculent l'inventaire sans remplacer les propositions.

La partie Sponsorisé existante (campagnes, tarifs, paiements, validation, compteurs) n'est ni copiée ni modifiée. La zone publique ne possède aucun espace d'achat ou de gestion de campagne. Un futur flux serveur ne devra lui transmettre que des créations publicitaires approuvées et leur éligibilité, jamais l'identité ou les données privées des annonceurs/utilisateurs.

Le contrôle local serveur expose seulement `{adsEnabled:false, suspended:boolean}` par SSE. Sa méthode `suspend()` est uniquement appelable par le code serveur, sans endpoint de mutation public. La suspension retire immédiatement les simulations ; l'interface de démonstration ne peut pas la lever. Une coupure du canal place l'interface en mode suspendu. Aucun intervalle Supabase, service externe ni polling payant.

**Limite explicite :** ce canal a été vérifié avec une commande opérateur locale, pas raccordé à l'administration Supabase existante. Avant une diffusion réelle, un adaptateur serveur de confiance devra propager l'état validé de l'administration vers ce canal et fournir les campagnes publiques. Ne jamais envoyer un JWT administrateur au navigateur public ni ajouter une API de suspension publique non protégée. Les droits d'administration de la V1.1 restent inchangés sur Supabase TEST.

## Consentement et préparation de la régie

- Préférence locale de refus mémorisée, distincte de celle de l'application privée et de la suspension serveur.
- Bouton de préférences disponible. Tant que la CMP manque, l'acceptation reste désactivée et le texte indique l'absence de CMP réelle. Aucun faux enregistrement TCF.
- Pont `createTcfConsentBridge` réutilisé sans chargeur : un signal CMP peut mettre à jour le statut, mais ne peut jamais charger une annonce dans cette livraison.
- Point candidat : Google Privacy & messaging, CMP300, à configurer et revérifier auprès de Google sur l'origine publique réelle. Aucun abonnement souscrit.
- `integration-plan.json` conserve origine, identifiants éditeur/bloc et contenu ads.txt à `null`. Aucune fausse valeur n'est publiée. Il décrit une préparation ; ce n'est pas un interrupteur permettant de lever la sécurité.
- Une future intégration nécessitera une modification revue du code et de la CSP après accord, validation de l'origine, des traitements, du consentement et de Google. Les domaines à autoriser devront provenir de l'intégration officielle réelle.

## Vérifications effectuées

### Tests serveur/build : 4 réussis

`node --test tests/public-discovery.test.cjs`

1. Catalogue fictif avec champs autorisés, aucun chargeur tiers ou bridge privé dans le paquet.
2. Hashes CSP conformes au script/style réels ; réseau externe et frames bloqués.
3. Serveur public : refus des credentials, routes privées, paramètres d'exfiltration, mutations ; aucun CORS permissif/cookie émis.
4. Signal de suspension serveur immédiat et minimal ; aucun moyen d'activer les annonces réelles.

### Navigateur réel, deux origines locales : PASS

`tests/public-discovery.browser.cjs`, Playwright avec Chromium `153.0.8010.0`, protections web et séparation d'origine activées. Le script rejette les options qui désactivent la sécurité web ou l'isolation des sites. Une distribution temporaire de Chromium a été nécessaire car le téléchargement du navigateur par défaut a échoué ; aucune dépendance de l'application n'a été ajoutée.

| Contrôle | Résultat |
|---|---|
| Catalogue, filtres, recherche et fiche | 12 exemples, filtres et état vide fonctionnels |
| Responsive | Pas de débordement à 320, 390 et 1440 px |
| Inventaire différé | Sponsorisé avant automatique, 2 emplacements maximum |
| Suspension locale et serveur | Emplacements supprimés ; suspension serveur non contournable par le bouton TEST |
| Délai de suppression après suspension serveur | **6 ms dans ce test local**, pas une garantie de latence Internet |
| Refus persistant | Conservé après rechargement ; acceptation impossible sans CMP |
| Cookie/session et stockage privés simulés | Absents de l'origine publique |
| Fetch vers une route de données privées simulées | Bloqué par CSP avant d'atteindre le serveur privé |
| Injection de script tiers simulée | Bloquée par CSP ; aucun code injecté exécuté |
| Nouvelle fenêtre | `window.opener === null` avec COOP et ouverture sans relation d'opener |
| Iframe de la page publique depuis l'origine privée | Chargement bloqué par headers |
| Marqueur privé fictif | Jamais reçu par le serveur public (URL ou headers) |
| Erreurs JS de la page | Aucune |
| Annonces Google / clics artificiels | Aucun |

Les marqueurs et cookies utilisés sont exclusivement des fixtures locales, pas des identifiants réels. Aucun compte ORÉVAMI, domaine réel, Supabase ou Vercel n'a été appelé par le parcours de test. Les premières vérifications ont révélé un débordement décoratif sur mobile, corrigé avant le passage final. Les tests ne couvrent pas un vrai SDK publicitaire ou une vraie CMP, absents par construction.

Preuves : [résultats JSON](../public-discovery/qa/results.json), [ordinateur](../public-discovery/qa/discovery-desktop.png), [mobile](../public-discovery/qa/discovery-mobile.png).

## Aperçu et reproduction locale

Depuis la racine du dépôt :

```
node public-discovery/build.cjs
node public-discovery/server.cjs 4178
```

Ouvrir `http://127.0.0.1:4178` uniquement dans l'environnement local où tourne le serveur. `public-discovery/index.html` est aussi autonome à ouvrir comme fichier ; dans ce cas le canal serveur n'existe pas et seule la simulation locale est disponible. Ne pas confondre le serveur de laboratoire avec un hébergement accessible sur Internet.

Tests navigateur avec Playwright disponible :

```
PLAYWRIGHT_MODULE=/chemin/vers/playwright CHROMIUM_PATH=/chemin/vers/chromium node tests/public-discovery.browser.cjs
```

Ne jamais fournir `--disable-web-security` ni désactiver l'isolation des sites pour ces tests. Il n'est pas nécessaire de rejouer les tests des jeux, restaurants, paiements ou de la base pour cette livraison : ils ne sont pas modifiés.

## Restant avant mise en service réelle

1. Valider le parcours produit public séparé et autoriser un hébergement TEST sur une origine réellement distincte. Aucun déploiement ni DNS n'est autorisé par cette livraison.
2. Installer le paquet seul avec ses headers sur cette origine. Vérifier les cookies, CORS, redirections, cache, API et absence de secrets dans cet environnement réel, puis répéter les contrôles d'origine ciblés.
3. Raccorder le contrôle administratif serveur (suspension) et un flux public minimal de campagnes approuvées/contenus autorisés. Aucun accès direct du navigateur public à la base privée. L'origine publique doit rester sûre même si son JavaScript tiers est compromis.
4. Remplacer les exemples par du contenu public original, utile, autorisé et modéré, sans extraire d'événements, discussions, profils ou données privées.
5. Faire approuver le compte/site et le parcours AdSense, configurer la CMP certifiée et vérifier acceptation/refus/retrait et les exigences TCF réelles.
6. Compléter la confidentialité selon les traitements réels. Fournir ensuite les identifiants de régie approuvés et l'ads.txt exact du compte ; les valeurs restent absentes jusque-là.
7. Revoir l'ajout du SDK et les domaines CSP nécessaires sur la seule origine publique. Demander une autorisation explicite avant tout déploiement puis toute activation réelle. Ne pas modifier `main`, Production, les paiements ou MyEvent-API dans cette mission.

Sources primaires :
- https://support.google.com/adsense/answer/3394713?hl=en-GB
- https://support.google.com/adsense/answer/13554116
- https://developers.google.com/funding-choices/fc-api-docs
- https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy
