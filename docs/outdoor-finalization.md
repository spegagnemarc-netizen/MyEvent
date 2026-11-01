# Finalisation ciblée Plein air & Parcours V1 — 1 novembre 2026

## Intégration isolée

Travail repris exclusivement de `8f028377bd544e2961d56a5373eb0e73e360c4b9`. Le commit de fonctionnalité a été repris seul sur `6d83eee0a7c7097b065ee6fd35ccf51aea0891ef`, Production effectivement publiée, dans `candidate/outdoor-v1-20261101`. Aucun remplacement global de branche. Reprise intermédiaire : `453d764`.

Les fichiers existants des jeux, du fil, du profil, de la caméra, de la musique, des restaurants, de la marketplace, de l'administration, du serveur, des API, du mobile et des pages juridiques sont inchangés. `index.html` comporte seulement deux ajouts : le CSS et le module outdoor. `package.json` ajoute les commandes de tests outdoor. Le contrôle Git ciblé valide ces propriétés, sans relancer les cinq groupes de tests V1.

Le garde d'environnement est préparé pour la future intégration : Preview seulement sur le ref TEST, Production seulement sur son ref connu. Cette préparation locale ne modifie aucune configuration Production et ne publie rien.

## Catalogue : 64 entrées ne signifie pas 64 boucles complètes

Les 64 identifiants et géométries de la V1 ont été conservés et comparés à leur version `8f02837`. Classement et libellés explicites ajoutés sur les listes et fiches :

- 47 tracés du producteur dont départ/arrivée sont à moins de 50 m. Ce critère décrit la géométrie ; il ne certifie ni continuité au sol, ni ouverture actuelle.
- 6 tracés ouverts du producteur. Trois parcours urbains ont un écart départ/arrivée de 99 à 156 m ; les trois autres sont des liaisons/sections de grands itinéraires. Ils ne sont pas présentés comme boucles fermées.
- 11 ensembles de tronçons cyclables du Doubs, avec mention « continuité non garantie ».

Les GR/liaisons fournis localement ne sont pas présentés comme l'intégralité nationale d'un GR. Les sources et licences restent celles de la V1 ; aucun point GPS, distance ou tracé n'a été remplacé par une fixture. Les cinq tests initiaux sur GPX, catalogue, SQL, interface et conservation n'ont pas été relancés.

## Parcours connectés testés

Session navigateur connectée par l'utilisateur : compte TEST `test-b`, sur la Preview V1. Aucun mot de passe ou jeton de session collecté.

1. Connexion reconnue ; favori créé depuis un circuit officiel. Le module a créé une copie privée dans le compte et le favori était visible dans « Enregistrés ».
2. Formulaire événement existant prérempli depuis ce parcours. Événement de recette créé dans TEST : `TEST RECETTE Plein air — Saint-Sériès`, le 8 novembre 2026 à 10 h (Paris). Identifiant `8724d9b4-8dbe-4043-a38d-da57e8608b60`.
3. Discussion : message envoyé depuis l'interface par `test-b`, relu dans la discussion.
4. Interface d'invitation existante : lien `?join=…` affiché. Acceptation du code par `test-c` effectuée côté TEST sous rôle `authenticated`, via la même fonction `join_event_by_code` que le client. Ce contrôle n'est pas une seconde connexion navigateur.
5. Avant acceptation, `test-c` ne pouvait lire ni le parcours privé original ni l'instantané de sortie. Après acceptation, il pouvait lire l'instantané partagé, sans lire les favoris du créateur. Un message émis sous son identité TEST par cette voie a été reçu et affiché dans la discussion du navigateur `test-b`.
6. Compte TEST extérieur `test-d` : zéro accès au parcours privé, à l'instantané, aux favoris du créateur et aux messages de cet événement.

Les contrôles côté base utilisent des identités TEST existantes et `SET LOCAL ROLE authenticated` ; les sélections/inserts subissent les politiques existantes. Ils ne sont pas présentés comme un test HTTP avec un second jeton utilisateur. Aucun message envoyé à une personne extérieure aux comptes de recette TEST.

Les données de recette restent identifiables dans TEST : un parcours privé, son favori, un événement, son lien de parcours, deux membres de recette et leurs messages. Aucune donnée existante supprimée.

## Anomalies réellement constatées et corrections limitées

- **Panneau Activités devant le formulaire événement** : constaté dans le navigateur. Le module ferme désormais le panneau via son bouton existant avant d'ouvrir le formulaire ; aucun code Activités/événements modifié.
- **Association perdue après une préparation longue** : la V1 annulait silencieusement son observation après 180 secondes. La création de l'événement a abouti après ce délai, mais l'association n'a pas été effectuée. Le lien de recette a été repris sous le rôle du créateur dans TEST, sans contourner les RLS. Le candidat retire cette échéance et ajoute une annulation explicite dans le formulaire. Le changement de session conserve son nettoyage.

Trois contrôles supplémentaires seulement : reproduction de la transition et de l'expiration ancienne/annulation, labels de complétude sans modification des tracés, conservation de la Production actuelle. Les deux derniers sont passés au premier lancement ; le premier a été corrigé pour la lecture CRLF de la source par le banc de test, puis est passé. Commande : `npm run test:outdoor:finalization`.

## Migration Production identifiée — jamais appliquée

Précontrôle de métadonnées Production uniquement : les trois tables `outdoor_*` sont absentes ; `events`, `event_members` et `myevent_account_active()` existent. Aucun accès au contenu des données réelles nécessaire.

Projet SQL à revoir/autoriser : `docs/outdoor-production-schema.sql`, reprise de la migration TEST validée avec transaction et garde de prérequis. Il ajoute : trois tables, deux fonctions invoker, un trigger d'instantané, onze politiques RLS et les seuls index/grants nécessaires. Aucune modification des tables ou politiques existantes. Aucun remplissage des données Production. Ne pas exécuter le fichier TEST comme une migration globale.

Ordre après autorisation séparée : confirmer le SHA réellement publié ; conserver tous les nouveaux commits éventuels ; appliquer uniquement le SQL outdoor revu ; vérifier les permissions sur des comptes de recette autorisés ; construire un candidat Production isolé sans affecter le domaine ; vérifier puis demander/appliquer la bascule expressément autorisée. Aucun déploiement Production réalisé dans cette mission.

Retour arrière web : réaffecter le précédent déploiement conservé, sans retirer les tables ou données. La suppression de schéma n'est pas une opération de rollback web.

## Limites restantes

La connexion et les opérations du créateur sont observées dans un navigateur réel. L'acceptation de l'invitation par un deuxième compte et ses droits sont vérifiés via le rôle authentifié en TEST ; un second navigateur réellement connecté n'a pas encore été utilisé. Les correctifs de transition/durée sont couverts par les nouveaux tests ciblés ; leur recette sur la nouvelle Preview est à consigner dans le rapport de livraison. Pas de publication, modification Supabase Production, service payant ou changement Google Play.
