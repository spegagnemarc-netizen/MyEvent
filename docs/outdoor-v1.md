# Plein air & Parcours V1 — TEST

## Base et périmètre

Référence demandée : `d1d08bb92153c20082d1ea7498e8dd7bed99ffa2`. La Production constatée au début de la mission était déjà `c385f4be9d371e7e585be0ab10956b78cfd08934`, descendant de cette référence. La branche `feat/outdoor-v1-test` part de ce dernier SHA et préserve ses correctifs.

Audit limité : Leaflet 1.9.4 est déjà chargé ; `myeventEventsBridge` expose contexte, formulaire et sélection ; le formulaire événement possède ses invitations et sa discussion opérationnelles. La discussion propre à Activities était désactivée : elle n'a pas été recréée. Le nouveau module utilise les événements existants.

Aucun module jeux, fil, musique, caméra, restaurants, marketplace, administration, mobile ou juridique modifié. L'intégration dans `index.html` ajoute seulement une feuille de style et un module. Le candidat final autorise uniquement les couples environnement/projet vérifiés : Preview TEST `ahyyknfjsielnqyoxqgh` ou Production `nxxvadbliinhvkirqkkl`. Aucun déploiement Production n’a été effectué ; la migration devra être autorisée avant publication. Aucun code existant n'a été remplacé par une ancienne branche TEST.

## Utilisation

Dans Activités & Rencontres, ouvrir « Plein air & Parcours ». Lien direct de Preview : `/index.html?outdoor=1`.

- Catalogue consultable sans connexion : 64 entrées réelles avec tracé, provenance et licence.
- Filtres : nom, commune confirmée parmi les résultats, rayon en km, pratique, distance, durée estimée, difficulté connue ou inconnue. Position GPS sur demande uniquement.
- Carte Leaflet avec tracés sélectionnables ; liste utilisable si le fond ne charge pas.
- Fiche : distance calculée, durée estimée, difficulté du producteur lorsqu'elle est disponible, D+/D− calculés sur les altitudes disponibles, sinon « Inconnu ». Ni difficulté ni altitude inventées.
- GPX : import de traces et routes, segments conservés, export avec provenance. XML externe/DTD interdit, 2 Mo et 20 000 points maximum.
- Création sur la carte : points, annulation du dernier point, nom, pratique, difficulté déclarée et visibilité. Lignes droites entre les points : **pas de moteur de routage sur les sentiers**, ni navigation GPS, ni accès hors ligne.
- Compte TEST : création privée par défaut, publication/retrait public, favoris privés et copies. Les pratiques balade et gravel fonctionnent pour les imports et créations ; aucun catalogue gravel officiel n'est prétendu disponible.
- Sortie : accord explicite de partage du tracé avec les participants, préremplissage du formulaire événement existant, choix de date par l'utilisateur, création habituelle, association automatique du tracé. Le préremplissage attend le reset `toggle` du formulaire historique. Reprise manuelle via « Associer à l'événement ouvert » si l'association échoue. Un événement ne reçoit qu'un parcours dans cette V1.
- Les participants acceptés ouvrent « Parcours de cet événement » dans l'espace événement. Le parcours partagé est un instantané ; les modifications ultérieures du parcours original ne modifient pas la sortie. Invitations et discussions : outils événement existants.

## Sources réelles et droits

1. **Grand Besançon Métropole** : 44 GPX de randonnée, édition 2024. [Jeu officiel](https://www.data.gouv.fr/datasets/circuits-de-randonnees-4), [archive GPX](https://datasets.grandbesancon.fr/fichiers/randogbm/Fichiers_GPX_randonnees_Besancon_2024.zip). Licence Ouverte 2.0 explicitement indiquée dans les métadonnées du producteur. Les dates artificielles internes des GPX ne servent pas de dates de vérification terrain.
2. **Lunel Agglo** : 9 circuits VTT. [Jeu officiel](https://www.data.gouv.fr/datasets/circuits-vtt), diffusion du 9 octobre 2026, Licence Ouverte 2.0. Difficultés du producteur ramenées aux filtres simple/modéré/difficile, texte original conservé en description.
3. **Département du Doubs** : 97 tronçons cyclables regroupés en 11 ensembles par nom. [Jeu officiel](https://www.data.gouv.fr/datasets/itineraires-cyclables), [API du producteur](https://opendata.doubs.fr/explore/dataset/itineraires-cyclables/), licence ODbL. Leur continuité n'est pas affirmée et les fiches l'indiquent.

Le catalogue normalisé conserve les sources et licences sur chaque fiche et dans les exports GPX. Les données sources et leurs adaptations sont redistribuées sous leur licence d'origine, avec attribution. Il ne s'agit pas de données fictives ni d'une certification des conditions actuelles de terrain.

Fond cartographique : [OpenStreetMap](https://www.openstreetmap.org/copyright), attribution visible et [politique des tuiles](https://operations.osmfoundation.org/policies/tiles/), aucune prélecture ou téléchargement massif. [Recherche de communes](https://geo.api.gouv.fr/decoupage-administratif/communes) via API publique française. Aucun abonnement ou service payant.

Overpass a été examiné puis écarté de cette livraison après refus HTTP 406 et timeout. Aucun connecteur Overpass instable n'est présenté comme opérationnel. Le catalogue actuel est un instantané de ces trois producteurs, pas une recherche nationale en temps réel. La région de Gap n'est pas préremplie avec des circuits supposés réels.

## Base TEST et permissions

Migration MCP `outdoor_routes_v1_test`, uniquement `ahyyknfjsielnqyoxqgh` :

- `outdoor_routes` : propriétaire ou parcours public, insert/update limités au propriétaire, aucun changement d'identité du propriétaire permis.
- `outdoor_saved_routes` : favoris visibles et modifiables uniquement par leur utilisateur ; accès au parcours toujours nécessaire.
- `outdoor_event_routes` : ajout par le créateur de l'événement avec accès au parcours. Instantané produit par un trigger `SECURITY INVOKER`, pas par une donnée fournie par le navigateur. Lecture limitée au créateur et aux membres `active/confirmed/accepted` ; les membres en attente sont exclus.
- Trois politiques restrictives réutilisent le contrôle de compte actif existant. Aucune clé de service, aucun nouveau `SECURITY DEFINER`, aucun élargissement des politiques existantes.

Le helper d'appartenance historique ne distinguait pas les statuts ; la nouvelle politique filtre donc le statut directement, sans toucher à ce helper. Les trois tables ont RLS activées et 11 politiques. La vérification sécurité post-migration n'a signalé aucun objet `outdoor_*`.

## Vérifications ciblées

`npm run test:outdoor` : cinq groupes de tests, GPX et entrées hostiles, 64 provenances/géométries et filtres, vrais tests PostgreSQL locaux des RLS, interface avec carte simulée et formulaire événement, conservation des modules antérieurs. Les tests incluent la création d'un tracé de deux points, la confirmation des droits et le reset différé du formulaire historique.

Sur TEST distant : tables/RLS/politiques confirmées ; insert/lecture privée et favoris avec deux identités TEST via rôle `authenticated`, puis rollback intégral de la transaction. Aucune ligne persistante ajoutée par ces contrôles. Le catalogue officiel est un fichier public, pas un remplissage artificiel des tables.

Limites de validation : les tests DOM utilisent JSDOM et un adaptateur de carte ; ils ne constituent pas un essai sur smartphone réel. La création de sortie est testée avec le formulaire simulé et les permissions avec PostgreSQL, sans envoi réel d'invitations ou de messages. Les contrôles de Preview et éventuelles captures sont consignés dans le rapport livré.

## Suite et retrait TEST

Faire valider la Preview avant toute proposition de publication. Ne jamais publier cette branche TEST entière ; extraire uniquement les fichiers outdoor et les deux ajouts d'intégration sur une future base Production actualisée. Préparer et revoir séparément toute migration Production : aucune n'est autorisée ici.

Pour retirer l'interface TEST, revenir au déploiement Preview précédent. Les trois nouvelles tables peuvent rester présentes et inutilisées ; ne pas supprimer de schéma ou de données dans le cadre d'un rollback web. Aucun rollback Production nécessaire.


Finalisation : intégration isolée sur la Production `6d83eee0a7c7097b065ee6fd35ccf51aea0891ef`. Voir `docs/outdoor-finalization.md`.
