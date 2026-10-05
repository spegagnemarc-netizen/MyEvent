# Explorer V1 — 5 octobre 2026

Raccourci boussole dans le carrousel supérieur, page autonome `explorer.html`, aucune création d’événement imposée. Les widgets sont importés depuis les fragments canoniques de `index.html` dans une page partenaire indépendante. Aucune seconde définition des identifiants affiliés : Hotels.com, Expedia Séjours/Vols, Abritel, Omio et TicketNetwork restent identiques. Les activités utilisent l’API Viator existante.

## Réservations personnelles

`personal_reservations` est une nouvelle table : propriétaire authentifié, `event_id` facultatif, détails compatibles avec l’import de lien existant. Création personnelle puis rattachement explicite au même enregistrement, réservé à un événement géré par le propriétaire. Aucun message dupliqué et aucun justificatif recopié. Les membres peuvent lire uniquement les réservations partagées avec leur événement. Le propriétaire conserve ses données lorsque l’événement est supprimé (`ON DELETE SET NULL`).

Le formulaire réutilise la validation des URL, l’extraction des seuls paramètres disponibles, les statuts déclaré/ajouté et les coordonnées explicitement vérifiées. Justificatifs PDF/PNG/JPEG de 200 Ko maximum, signatures vérifiées côté navigateur et SQL. Les horaires et photos existants sont conservés lors d’une modification des autres informations. Les réservations personnelles partagées alimentent les listes, la timeline et la carte existantes ; leur édition reste dans Explorer.

La migration `202610050001_personal_reservations.sql` a été installée uniquement dans MyEvent-Admin-Test (`ahyyknfjsielnqyoxqgh`). Aucun schéma de production modifié. La suppression d’une réservation est disponible dans le service de données ; la V1 présente modification et retrait de l’événement, sans bouton de suppression définitive.

## Recherche et limites

Restaurants et Autour de moi réutilisent `/api/search-places?mode=nearby` (OpenStreetMap/Overpass). Permission géographique à l’action utilisateur, rayon 1–20 km, élargissement jusqu’à 20 km après résultat vide. Carte et fiches utilisent les coordonnées réellement renvoyées. Distances géographiques à vol d’oiseau, sans prétendre fournir des distances routières.

Activités : API Viator existante. Nouvelle métadonnée additive `locationApproximate` : un centre de destination ne devient jamais un repère exact ni une distance présentée comme fiable. Les résultats élargis sont signalés. Indisponibilité des fournisseurs affichée sans résultats fictifs. La présence d’un site restaurant ne garantit pas une réservation en ligne : la fiche renvoie vers ce site et invite à vérifier les disponibilités. Les paiements et confirmations restent chez le partenaire.

## Profil et administration

L’expression « Mes paramètres privés » a été clarifiée par l’utilisateur comme l’administration propriétaire existante. Le Profil et l’Apparence sont conservés à l’identique, sans nouvelle préférence ni modification des clés de stockage.

Cause constatée sur TEST : absence de `platform_admins` et de `myevent_is_admin()`, alors que le bouton et le panneau étaient présents dans le code. Restauration des migrations existantes Marketplace (prérequis absent), Admin 001/002/003 dans une transaction sur TEST. Pas de reconstruction du panneau. B est le compte choisi explicitement par l’utilisateur pour le rôle administrateur TEST ; attribution côté SQL par UUID confirmé, sans confiance dans une adresse e-mail du navigateur.

Les permissions sont contrôlées par les RPC SECURITY DEFINER existantes et le registre serveur inaccessible directement aux clients. Le navigateur revérifie les droits à l’ouverture du Profil, sur `pageshow` et après retour au premier plan. Le bouton Déconnexion existe dans le code commun et reste visible au même emplacement dès l’ouverture du Profil. Aucune publication de ces changements sur le domaine public.

Validation réelle sur TEST : B ouvre le panneau depuis le Profil et charge les statistiques via les RPC authentifiées (4 utilisateurs, 3 événements). Une exécution SQL sous le rôle `authenticated` avec l’identité d’un autre compte existant est refusée par `myevent_admin_guard`, erreur 42501. Aucun droit administrateur attribué à A/C/D ni à un compte de production.

La suspension reste verrouillée tant que la migration d’activation du hook PostgREST Admin 004 n’a pas été appliquée et validée ; la V1 ne modifie pas le rôle authenticator ni ses hooks.

## Validation

Tests du formulaire sans événement, consentement, rattachement unique, nettoyage au changement de session, absence de schéma et justificatif invalide. Tests SQL locaux des politiques propriétaire/membre/extérieur/anonyme, retrait d’accès, conservation du justificatif et suppression de l’événement. Tests des partenaires, de l’import de lien et des sept onglets administratifs, dont requêtes tardives, recontrôle du Profil et erreurs serveur.

Build Preview : plafond de 12 fonctions conservé. Les vérifications authentifiées de la nouvelle origine Preview nécessitent la connexion du compte B sur cette origine ; la session d’une ancienne Preview n’est pas transférée. Le rendu à largeur iPhone ne constitue pas un test sur un appareil Safari réel.
