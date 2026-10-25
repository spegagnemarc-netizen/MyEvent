# ORÉVAMI — essai temporaire Gap/Lyon

## État et périmètre autorisé

Branche locale : `temp/orevami-sorties-api-audit-20261025`.
Base GitHub récupérée : `213c2036403ca742afaac27af3548f232bebccd2` (main).
Le commit initial a été publié sur cette branche et son premier déploiement
Preview a échoué sur la limite de 12 fonctions. Ce correctif de regroupement est
autorisé à être commité et poussé sur la seule branche temporaire, sans nouveau
déploiement, modification de secret ou appel réel fournisseur.

Le projet Vercel est `my-event`, identifiant
`prj_njkjpiO5evwffsbcqwfTpSHxJd8C`, équipe
`team_82uCr6wwNW9w2P6YU5ROnIkH`.
Le contrôle en lecture seule de la phase précédente a confirmé Node.js 24.x,
Vercel Authentication (`all_except_custom_domains`), les deux nouvelles clés
sensibles en Preview uniquement, et Geoapify en Production/Preview.
Ces constats ne remplacent pas le contrôle du futur déploiement.

## Fichiers et isolation

- `api/[search].js` : route exacte `/api/sorties-api-audit`, avec chargement différé
  du module serveur. Les routes préexistantes restent inchangées.
- Le point d'entrée autonome `api/sorties-api-audit.js` a été retiré : le total
  est de 12 fonctions JavaScript dans `api/`, sans perte d'URL ou de fonctionnalité.
- `server/sorties-api-audit.js` : protection, scénario, client borné et rapport.
- `tests/sorties-api-audit.test.cjs` : tests ciblés, réponses simulées uniquement.
- `tests/sorties-api-audit-routing.test.cjs` : contrôle du raccordement et des
  contrats de routage avec traitements simulés, sans fournisseur.
- `vercel.json` : plafond 240 s pour le routeur partagé, désactivation des
  déploiements Git automatiques sur cette branche, refus HTTP 404 pour la source
  du module serveur temporaire.
- Ce document : procédure et suppression.

Seule la fonction pure `feature` du module Geoapify existant est réutilisée.
Les caches, enrichissements, reprises automatiques, catalogue des restaurants,
écrans V3/V2 et endpoints métier ne sont pas appelés ou modifiés.
Aucune nouvelle dépendance. Aucun stockage persistant.

## Protections applicatives

- `VERCEL_ENV` doit être exactement `preview`, sinon 404.
- Hôte obligatoire : URL immuable du déploiement dans `VERCEL_URL`, sur
  `*.vercel.app`. Les domaines personnalisés et alias de branche sont refusés.
- `POST` uniquement, sans paramètres d'URL. Corps JSON exact :
  `{"scenario":"gap-lyon-v1","confirm":true}`.
- En-tête `x-orevami-audit-token` obligatoire : comparaison des empreintes en
  temps constant. Jeton configuré de 64 caractères hexadécimaux, distinct des
  clés fournisseurs.
- Expiration obligatoire, dans les prochaines 24 h ; contrôle également avant
  chaque appel fournisseur. Sans jeton/expiration, aucun essai ne peut partir.
- Pas de CORS ouvert, réponse privée `no-store`, pas d'indexation.
- Vercel Authentication est une protection de plateforme : elle doit rester
  activée et être vérifiée avant la seule requête autorisée. Le code ne prétend
  pas vérifier une identité Vercel à partir d'un simple en-tête de navigateur.
- Aucun journal applicatif, erreur brute, en-tête ou réponse fournisseur brute
  renvoyé. Rapport à champs explicitement sélectionnés et secrets masqués, y
  compris avant réutilisation d'une donnée dans une autre recherche.

Les clés sont lues uniquement via `process.env`. Les trois fournisseurs reçoivent
les clés dans leurs en-têtes, jamais dans les URL : Geoapify POST `x-api-key`,
DATAtourisme GET `X-API-Key`, OpenAgenda GET `key`.

## Scénario et budget

Deux centres fixes : Gap (44.5596, 6.0797), Lyon (45.7640, 4.8357), rayon 5 km.
Quatre cases par ville : restaurant, activité (bowling/escape game/minigolf),
culture (musée/lieu culturel), nature (parc/eau naturelle).
La sélection retient un lieu unique parmi les trois premiers candidats
Geoapify de chaque catégorie, dans la ville et le rayon, puis le rapproche de
trois candidats DATAtourisme au plus dans un rayon de 1 km. Les adresses,
coordonnées, téléphones et domaines servent de preuves ; le nom seul ne suffit
pas à une correspondance forte. Une ambiguïté reste explicite.

Maximum absolu de **22 requêtes par invocation**, comptées avant le départ :

| Fournisseur | Maximum | Usage |
| --- | ---: | --- |
| Geoapify | 8 | Une recherche par case, limite 3 |
| DATAtourisme | 10 | Jusqu'à 8 rapprochements + 2 pages d'événements, limite 2 |
| OpenAgenda | 4 | 2 recherches d'agenda, limite 1 ; jusqu'à 2 pages d'événements, limite 2 |

Les deux pages événementielles de chaque ville peuvent fournir quatre candidats
au total. Le rapport retient **deux événements uniques par ville au maximum**,
concerts/spectacles/animations, avec les versions des sources quand un doublon
est identifié. La période porte sur les 30 jours suivant l'exécution.

Pas de pagination, redirection suivie, retry, remplacement de ville, élargissement
ou fournisseur de secours. Aucun appel séparé pour valider une clé : la première
requête utile mesure son acceptation. Un 401/403/429 arrête les appels suivants
au fournisseur concerné. Les autres erreurs restent dans le rapport sans retry.
Timeout 7 s par requête, délai global 190 s, réponse fournisseur limitée à 1 Mio.
La fonction est plafonnée à 240 s. La compatibilité de cette durée avec le plan
et Fluid Compute reste à vérifier dans Vercel avant déploiement ; ne pas changer
de forfait ni activer de service payant.

## Rapport et limites de preuve

Rapport JSON privé : huit cases de lieux, candidats et rapprochements, jusqu'à
quatre événements avec provenance/licences/crédits, doublons, compteurs d'appels,
statuts HTTP et erreurs normalisées. Les candidats non retenus ne sont pas
injectés dans l'application.

Les URL de sites restent des candidats : aucun site n'est visité pour confirmer
son propriétaire. Aucune image n'est téléchargée ou présentée comme visuellement
authentifiée. Les licences de données et les droits des images sont séparés.
Les dates de droits DATAtourisme et crédits sont conservés ; une illustration
OpenAgenda n'est pas assimilée à une photographie du lieu ni automatiquement
déclarée stockable. Les URL avec paramètres sont omises par prudence, ce qui
peut réduire la couverture des médias.

Une liste vide est un résultat de ce petit échantillon, pas une preuve d'absence
dans toute la source. L'agenda OpenAgenda retenu est le premier agenda officiel
de recherche : aucune route transverse nécessitant un accès spécial n'est utilisée.

## Procédure exacte après nouvelle autorisation

Ne pas exécuter ces étapes tant qu'elles ne sont pas autorisées.

1. Vérifier l'arbre Git propre et le SHA livré, sur la branche temporaire.
   Ne pas fusionner dans main. La branche temporaire seule peut être publiée
   avec autorisation ; ses déploiements Git automatiques restent désactivés.
2. Dans Vercel, sélectionner `my-event` et son équipe. Vérifier Node.js 24.x,
   les limites de durée/nombre de fonctions du plan existant et Fluid Compute.
   La branche comporte désormais 12 fonctions : si une limite est atteinte,
   arrêter sans supprimer d'autre fonction ni souscrire un forfait.
3. Vérifier que DATATOURISME_API_KEY et OPENAGENDA_API_KEY sont exclusivement
   en Preview et que GEOAPIFY_API_KEY y existe, sans révéler/exporter leurs valeurs.
4. Après autorisation distincte de créer le jeton, générer 32 octets aléatoires
   dans un gestionnaire de secrets local, sous forme de 64 caractères hexadécimaux.
   Enregistrer `OREVAMI_SORTIES_AUDIT_TOKEN` comme secret Preview, idéalement limité
   à cette branche. Ne jamais copier la valeur dans une commande, un message,
   un fichier suivi ou une capture.
5. Enregistrer `OREVAMI_SORTIES_AUDIT_EXPIRES_AT` en Preview pour cette branche :
   horodatage ISO 8601 UTC, à 1 h par exemple de l'exécution prévue, et jamais
   plus de 24 h. Aucune variable Production ne doit être modifiée.
6. Vérifier Deployment Protection : Vercel Authentication pour l'URL Preview,
   sans exception publique, lien partageable ou contournement d'authentification.
   Contrôler que l'instrumentation n'enregistre pas les en-têtes sortants.
7. Après autorisation de déployer, lier cette copie locale au projet existant,
   sans récupérer les valeurs des variables : `vercel link`, puis sélectionner
   l'équipe et le projet `my-event`. Contrôler `.vercel/project.json` (identifiant
   ci-dessus). Depuis la branche temporaire, lancer `vercel deploy` **sans**
   `--prod`, `--prebuilt`, promotion ou alias Production. Si Vercel demande de
   créer un projet ou changer de plan, arrêter. Aucun push n'est requis.
8. Vérifier que le résultat est Preview/READY, protégé, avec Node.js 24 et la
   durée prévue. Ne pas appeler POST pour une simple vérification de disponibilité.
   Une requête non authentifiée/GET sur le chemin doit être bloquée sans appel
   fournisseur ; ne pas désactiver la protection pour ce contrôle.
9. Après autorisation de l'essai réel, l'opérateur authentifié envoie **une seule**
   requête POST à `https://<VERCEL_URL>/api/sorties-api-audit`, JSON exact ci-dessus.
   Utiliser un client privé qui injecte le jeton depuis une saisie masquée, sans
   trace/verbose, export HAR ou historique de valeur. Les trois clés fournisseurs
   restent sur Vercel. Aucun jeton dans la barre d'adresse. Si le client n'a pas
   accès à Vercel Authentication, arrêter et préparer une méthode officielle
   autorisée avant tout appel. Aucun bypass public n'est créé automatiquement.
10. Sauvegarder le rapport dans un emplacement privé. En cas de timeout, résultat
    partiel, coupure ou erreur : **ne pas répéter** le POST ; demander une décision.

## Suppression et arrêt

Le mode unique est contrôlé manuellement, sans verrou global. Un deuxième POST
autorisé avant expiration pourrait relancer le scénario ; ne jamais prétendre
que l'état mémoire garantit une seule utilisation.

Après l'essai, avec autorisation de nettoyage :

1. Supprimer le déploiement temporaire dans Vercel (son URL immuable comprise).
2. Retirer uniquement les deux variables de contrôle de cette branche Preview
   (`OREVAMI_SORTIES_AUDIT_TOKEN`, `OREVAMI_SORTIES_AUDIT_EXPIRES_AT`). Ne pas
   supprimer les clés fournisseurs existantes.
3. Vérifier que l'ancienne URL n'exécute plus la fonction. Une suppression de
   variable seule ne révoque pas les secrets incorporés à un ancien déploiement.
4. Retirer uniquement le bloc de dispatch `/api/sorties-api-audit` du routeur
   `api/[search].js` (ne pas supprimer ce routeur), le module serveur d'audit,
   ses tests dédiés, sa documentation et les ajouts de configuration d'audit
   (`functions["api/[search].js"]`, route 404 du module serveur, règle Git de la
   branche temporaire). Les routes métier et les réglages préexistants restent.
   Ou supprimer la branche locale après conservation du rapport.
   La branche n'étant pas fusionnée dans main, aucun nettoyage Production n'est
   requis. Sa suppression distante éventuelle demande une autorisation distincte.

## Validation locale ciblée

Node.js local : 24.21.0. Commande :
`node --test tests/sorties-api-audit.test.cjs`.
Le réseau réel est interdit par le banc de test et toutes les clés sont fictives.
La suite vérifie notamment les refus, les plafonds, l'arrêt fournisseur,
l'expiration, les erreurs/réponses malformées, la non-divulgation, les doublons,
les droits d'images et la configuration Vercel.
Validation initiale : **45 contrôles réussis, 0 échec** (historique).
Après raccordement : **20 contrôles de routage et 2 contrôles adaptés réussis**,
sans réexécuter la suite complète. Le module serveur d'audit est inchangé octet
pour octet par rapport au commit approuvé. `git diff --check` est propre.
Commandes ciblées :
`node --experimental-vm-modules --test tests/sorties-api-audit-routing.test.cjs`
et `node --test --test-name-pattern="entry point|Vercel config" tests/sorties-api-audit.test.cjs`.
L'option VM sert uniquement à simuler l'import de suppression de compte dans
le banc de test ; elle n'est pas requise dans la fonction Vercel.

Une compilation Vercel et une vérification de plateforme restent à faire lors
du futur déploiement autorisé ; les tests locaux ne certifient pas ce déploiement.
Le premier déploiement a échoué sur la limite Hobby de 12 fonctions. Le correctif
de routage supprime le treizième point d'entrée ; sa validation de compilation
distante attend une nouvelle autorisation. Le SHA initial ci-dessus désigne la
base historique, pas le futur commit corrigé.

## Références techniques utilisées

- https://apidocs.geoapify.com/docs/places/ — POST et en-tête `x-api-key`.
- https://api.datatourisme.fr/v1/docs — authentification, filtres, champs, quotas.
- https://developers.openagenda.com/agendas/recherche/ — agenda public officiel.
- https://developers.openagenda.com/evenements/lecture/ — événements et dates.
- https://developers.openagenda.com/evenements/structure/ — droits et images.
- https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication
- https://vercel.com/docs/functions/limitations
