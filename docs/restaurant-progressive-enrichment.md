# Enrichissement progressif — première version

Recherche Geoapify/OSM → miniature V3 immédiate → observation des miniatures visibles → file de consultation du site déclaré → enrichissement du payload → fiche V2 existante.

Sources opérationnelles : données Geoapify/OSM et lecteur générique des sites déclarés déjà présent. Extraction structurée existante des horaires, menus, prix, téléphone et liens. Les sites déclarés ne sont pas automatiquement certifiés officiels. Sans site déclaré, conserver OSM ; aucune recherche de domaine homonyme. Les 20 relevés éditoriaux existants restent prioritaires, avec leur date et réserves visibles.

Limites : deux requêtes simultanées côté navigateur et serveur ; 12 miniatures consultées par rendu de liste ; file navigateur plafonnée à 20 ; expiration navigateur 15 secondes ; cache navigateur de 100 entrées, 6 heures pour succès et 5 minutes pour échec. Le serveur possède déjà les mêmes durées et limite d'entrées ainsi que son lecteur HTTPS protégé. Chaque requête serveur existante conserve sa propre limite de temps ; annuler le navigateur ne garantit pas l'arrêt du travail serveur. Expiration à la prochaine consultation, sans tâche planifiée ni frais nouveaux. Caches en mémoire, sans persistance entre redémarrages/fonctions distinctes. Aucun stockage Supabase ajouté.

Les sources et dates accompagnent les faits jusque dans la fiche. Un échec conserve le résultat OSM. Pas de disponibilité, avis ou note fabriqués. Aucun scraping de photos des sites.

## V2 — découverte et persistance

`lib/restaurant-discovery.js` recherche au maximum 5 entités Wikidata. Acceptation unique : nom normalisé exact dans les libellés/alias, type direct Q11707 (restaurant), coordonnées terrestres à moins de 40 m. Si absent ou ambigu, aucune association. Les sous-types non explicitement classés Q11707 ne sont pas acceptés : couverture volontairement limitée. Aucun résultat dépendant uniquement du nom. Le site découvert provient de P856 ; il n'est utilisé que si le fournisseur n'a pas déjà un site déclaré. L'identité s'appuie sur les déclarations Wikidata, sans certification par le restaurateur ni preuve indépendante du contrôle du domaine.

Photos : seuls les fichiers P18 de l'entité acceptée sont consultés via Commons imageinfo. Maximum trois fichiers, un seul appel groupé. Auteur et source obligatoires, URL upload.wikimedia.org, JPEG/PNG/WebP, lien de licence CC BY 2.0/2.5/3.0/4.0 ou CC0 1.0. CC BY-SA, NC, ND, licences inconnues et restrictions signalées ne sont pas activées. Crédit, lien fichier, lien licence, entité de rattachement, date et mention de redimensionnement sont conservés. Les métadonnées Commons constituent la preuve technique ; elles ne garantissent pas l'exactitude des déclarations de l'auteur ni l'absence de droits non signalés. Aucun scraping Google/TripAdvisor ou récupération des images des sites officiels. Pas d'achat ni contact tiers.

Trois requêtes Wikimedia au maximum par découverte, délai total 10 s, réponse JSON limitée à 512 ko, redirections refusées. Deux découvertes simultanées maximum côté serveur et navigateur, cache serveur borné à 200 entrées. Le lecteur sécurisé existant reste chargé des sites HTTPS et des informations textuelles. Les erreurs des photos ne suppriment pas un site découvert.

Cache persistant localStorage versionné par nom/coordonnées/site, jusqu'à 100 relevés, expiration 6 h ou 5 min en cas d'échec. Sources, dates et preuves photo sont incluses. Le cache survit au rechargement du navigateur, pas à son effacement ; il n'est ni central ni partagé entre utilisateurs. Erreur/quota de stockage : poursuite en mémoire. Aucun service payant ni base modifiée. Expiration contrôlée à la demande, sans cron. Le lecteur serveur a sa propre limite de durée ; annuler le navigateur ne garantit pas son arrêt immédiat.

Les miniatures restent immédiates ; les cartes visibles reçoivent progressivement les photos et le payload enrichi, puis la fiche V2 réutilise le même cache. Même première image en couverture. Aucune carte ni restaurant créé, aucun tri ou résultat du moteur Geoapify modifié. Les 20 relevés éditoriaux restent prioritaires pour les informations textuelles. Le Pasturier reste sans photo si aucune correspondance stricte licenciée n'est trouvée ; aucune photo n'a été ajoutée au catalogue par ce développement.

Validation V2 : tests ciblés avec réponses contrôlées pour homonymes/coordonnées/type, licences interdites, ambiguïté, budget de requêtes, déduplication et persistance/expiration après rechargement. Pas de recherche réseau réelle garantie pour chaque établissement ; pas d'anciens tests relancés. Aucun push ni déploiement.

## Sites officiels — validation avant affichage

Les liens éditoriaux déjà enregistrés (15 sites sur les 20 entrées) et les instantanés marqués `website_verified` sont préservés. Ce chiffre est un inventaire des liens existants, pas une nouvelle vérification réseau de ces 15 domaines.

Un lien brut Geoapify/OSM reste candidat. Pour un site manquant, Wikidata fournit un candidat selon les règles strictes de découverte V2. L'extracteur sécurisé consulte le site ; le nom extrait doit correspondre exactement au nom normalisé, la rue et le numéro doivent correspondre après retrait du code postal/ville, et la ville doit être confirmée. Si des coordonnées sont extraites, un écart supérieur à 100 m est éliminatoire. Sans éléments suffisants, le bouton reste masqué. Les variations d'enseigne/adresse ou sites sans données structurées peuvent donc produire des faux négatifs volontaires. Cette concordance documentaire n'est pas une certification de propriété du domaine.

La validation fait partie de la réponse serveur. Un site non confirmé ne fournit ni horaires ni tarifs à la fiche. Le cache navigateur est versionné à nouveau et sa clé inclut nom, adresse, ville, coordonnées et URL ; aucune ancienne confirmation d'un homonyme n'est réutilisée. Une fois accepté, le bouton Site web est ajouté à la miniature sans recréer la carte, puis transmis à la V2 et aux instantanés d'activité. Les photos autorisées existantes sont conservées lorsqu'aucune nouvelle photo n'est trouvée.

Contrôles de ce lot uniquement : correspondances d'identité et cas négatifs (autre nom, autre rue, autre ville, coordonnées divergentes, informations manquantes), visibilité des liens bruts/validés/éditoriaux et conservation du catalogue de 20 entrées dont 15 sites. Aucun ancien test relancé, aucune découverte réseau exhaustive des 20 restaurants. Pas de push ni déploiement.
