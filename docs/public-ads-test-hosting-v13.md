# ORÉVAMI — hébergement TEST isolé V1.3

26 octobre 2026 · branche `feat/public-ads-isolation-v12-20261026` · base `be73e3648b728bcb28f5fe546e0199660010af69`.

## Résultat

**Paquet Preview prêt, création du projet refusée par Vercel. Aucun déploiement effectué, aucune URL TEST créée.** La vérification d'isolation sur un hébergement réel n'a donc pas pu être effectuée ; les preuves locales de la V1.2 restent des preuves locales uniquement.

L'appel de création du projet indépendant `orevami-public-ads-test`, dans l'espace Vercel `spegagnemarc-netizen`, a renvoyé :

```
HTTP 403 · forbidden
You don't have permission to create the project.
POST /v11/projects
```

L'accès disponible permet de lire les projets mais n'a pas permis d'en créer un. Cette erreur ne prouve pas que le propriétaire du compte est dépourvu du droit dans son tableau de bord ; elle décrit le refus de l'accès utilisé ici. Ne pas prétendre qu'une reconnexion suffira à le résoudre.

Le repli CLI proposé par l'outil ne dispose d'aucune authentification existante : CLI non installé, aucune session CLI détectée, variable de jeton non configurée. Aucun secret n'a été recherché ou affiché, aucune connexion interactive ni changement de permissions n'a été lancé. Aucun nouvel essai de création avec un autre espace ou le projet ORÉVAMI n'est effectué.

## Préparation avant la tentative

- Compte personnel et espace par défaut identifiés ; offre Hobby active observée. Aucun essai Pro, changement d'abonnement, achat de ressource ou fonction facturée demandé.
- Nom de projet vérifié libre par recherche avant création.
- Projet `my-event` identifié séparément et consulté uniquement en lecture. Sa configuration, ses variables et sa protection n'ont pas été modifiées.
- Création préparée sans connexion Git, variable d'environnement, domaine personnalisé, code privé, Supabase ou secret ORÉVAMI.
- Preview prévue par upload explicite des fichiers publics, sans importation du dépôt ni déploiement de `main`.

Le site préparé est une démonstration fictive, sans publicité réelle, paiement ou revenu. La documentation Hobby indique une offre gratuite et sans facturation de dépassement : les quotas bloquent les opérations. Une réponse du personnel Vercel précise que des sites de démonstration sans revenu sont généralement acceptables. Il s'agit d'une appréciation pour cette seule Preview fictive, pas d'une autorisation de monétiser ORÉVAMI sur Hobby. L'usage commercial futur nécessitera de vérifier l'offre adéquate et d'obtenir une autorisation séparée avant toute dépense. Aucun coût nul futur n'est garanti.

## Paquet indépendant préparé

`public-discovery/prepare-vercel-preview.cjs` génère une liste blanche de **deux fichiers seulement** :

1. `index.html` autonome, issu de `public-discovery/`, avec douze exemples fictifs.
2. `vercel.json` avec les headers de sécurité du paquet public.

Ni serveur local, ni source privée, ni client Supabase, ni fichier d'environnement, ni cookies ou jetons de l'application privée. Framework, commande d'installation et build distants non requis. Aucun SDK publicitaire, traceur ou CMP fictive. Les identifiants publicitaires restent absents et la diffusion désactivée.

Dans ce mode `static-preview`, le navigateur n'ouvre pas le canal SSE local et ne contacte aucune API. Le panneau indique explicitement que l'administration n'est pas raccordée. Les emplacements restent des simulations locales activables volontairement, jamais des campagnes ou impressions réelles.

Le manifest des tailles et empreintes SHA-256 est enregistré dans `public-discovery/qa/preview-package-manifest.json`. Le paquet n'est pas déployé.

## Sécurité conservée

- CSP avec hashes exacts des scripts/styles ; réseau externe, frames, workers, objets et formulaires bloqués.
- `frame-ancestors 'none'`, X-Frame-Options DENY, COOP same-origin, politique de referrer absente, permissions caméra/micro/GPS/paiement interdites.
- Aucun bridge entre l'origine privée et la Preview ; aucun partage de session ou stockage d'authentification.
- Refus publicitaire mémorisé sur la seule origine publique ; acceptation désactivée tant que la CMP manque.
- Priorité Sponsorisé, plafond partagé de deux et chargement différé conservés dans la simulation, sans modification du module Sponsorisé réel.
- Aucune modification de `main`, Production, DNS, paiements, bases ou MyEvent-API.

Les protections de plateforme Vercel auraient été conservées par défaut, sans désactivation pour faciliter les tests. Une éventuelle page Vercel Authentication n'est pas une session ORÉVAMI ; il aurait fallu la traverser avec un accès autorisé avant d'attester l'isolation du document public.

## Raccordement futur à la suspension administrative

Le contrôle opérateur serveur défini en V1.2 reste la frontière de confiance. Un futur adaptateur devra vérifier l'autorisation administrateur sur le backend privé, puis transmettre au backend public uniquement un état minimal de diffusion/suspension. Aucun JWT ou identifiant administrateur dans l'URL, le JavaScript public ou les messages inter-origines.

Une Preview purement statique ne peut pas recevoir une suspension administrative instantanée sans un service de contrôle. Cette V1.3 n'invente donc pas ce raccordement et ne prétend pas qu'il est actif. Pour une future diffusion réelle, ce service et son comportement fermé en cas de panne devront être configurés et vérifiés séparément, avec contrôle du coût avant toute création. À ce stade, toutes les annonces réelles sont déjà bloquées par absence de chargeur.

## Vérifications ciblées

`node --test tests/public-discovery-preview.test.cjs` : **2 tests réussis**.

- Liste d'upload strictement limitée aux deux fichiers publics ; conservation des headers CSP/COOP/referrer et absence de build/framework requis.
- Exécution du document de Preview en DOM simulé : douze exemples, aucune annonce, aucun chargement tiers, aucun fetch ni SSE ; statut d'administration non raccordée explicite.

Build public et `git diff --check` réussis. Aucun test des jeux, restaurants, musique, paiements ou base rejoué.

**Isolation réelle entre ORÉVAMI et un nouvel hébergement : NON TESTÉE**, faute de projet et d'URL. Ne pas réétiqueter les tests locaux V1.2 comme des tests distants V1.3.

## Déblocage nécessaire

Il faut soit :

- rendre disponible un accès Vercel ayant effectivement le droit de créer ce projet dans l'espace prévu ;
- soit faire créer par le propriétaire un projet indépendant vide `orevami-public-ads-test`, sans dépôt connecté, variable, domaine personnalisé ou intégration payante, puis fournir son identifiant pour vérifier les droits de déploiement Preview.

Aucune nouvelle autorisation fonctionnelle n'est nécessaire pour le périmètre déjà demandé ; c'est l'accès technique qui bloque. Ne pas demander de coller un jeton dans le chat. Une création manuelle ne garantit pas à elle seule que l'accès actuel pourra déployer : vérifier ce droit ensuite.

## Suite après déblocage

1. Confirmer projet et espace, offre gratuite pour cette démonstration et absence d'intégration/variable héritée.
2. Enregistrer le déploiement en cible Preview explicite avec les deux fichiers publics seulement, puis confirmer READY et cible Preview. Aucun domaine/DNS ni déploiement de Production.
3. Effectuer une unique vérification distante ciblée : headers réels, absence de données/cookies ORÉVAMI et de ressources tierces, blocages de frame/opener et des accès inter-origines. Ne modifier ni la session ni les données de l'application privée pour ce test ; les éventuels marqueurs doivent être exclusivement des fixtures locales.
4. Fournir l'URL réellement créée et les résultats observés.
5. Avant AdSense : contenu public utile et autorisé, compte/site approuvé, CMP certifiée réellement configurée, confidentialité et ads.txt exact, raccordement administratif serveur, vérification des coûts et autorisation explicite de mise en service commerciale.

Sources officielles consultées :
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits/fair-use-guidelines
- https://community.vercel.com/t/question-on-fair-use-and-hobby-plan-suitability-for-demo-commercial-websites-in-portfolio/1769
- https://vercel.com/docs/rest-api/projects/create-a-new-project
- https://vercel.com/docs/rest-api/deployments/create-a-new-deployment
