# Marketplace MyEvent

Implémentation sur `refactor-final`, intégrée sur `df7f1f8fd1fac391e956b2293564f7cdbc055c8b`.
Les travaux caméra non committés restent séparés et ne font pas partie de cette fonctionnalité.

## Parcours

- Accès depuis l’accueil via Marketplace, page `marketplace.html`.
- Session Supabase MyEvent partagée sur le même domaine ; connexion possible dans la marketplace.
- Consultation des annonces actives réservée aux membres connectés.
- Vente ou location, recherche sans distinction d’accents, catégorie, ville, tri, favoris sauvegardés.
- Dépôt avec 1 à 4 photographies JPEG/PNG/WebP (10 Mo maximum à l’entrée).
- Redimensionnement à 1 600 pixels maximum, conversion JPEG avant upload, suppression des métadonnées originales par réencodage canvas.
- Brouillon serveur privé pendant l’upload, publication uniquement après confirmation de la base.
- Mes annonces : modification et retrait ; les annonces retirées peuvent être republiées et leurs conversations restent disponibles.
- Messagerie privée par annonce, avec actualisation toutes les dix secondes lorsque la conversation est ouverte. Pas de notifications push ni email.
- Paiement, caution, disponibilité et remise du matériel à convenir entre les membres : aucun encaissement ni réservation automatique.

## Activation Supabase — reste à effectuer

Projet : `nxxvadbliinhvkirqkkl`, identique à `js/core-runtime.js`.
La configuration front contient uniquement la clé publique déjà employée par MyEvent.
Aucune clé `service_role` n’est requise dans le navigateur.

1. Ouvrir le projet MyEvent dans Supabase avec un compte administrateur.
2. Vérifier que les objets `marketplace_*` et le bucket `marketplace-images` n’existent pas déjà. Cette migration est prévue pour une seule exécution ; elle ne remplace aucune table existante.
3. Exécuter intégralement `supabase/migrations/202609250001_marketplace.sql` dans SQL Editor ou via le mécanisme habituel de migrations. La transaction crée quatre tables, les règles RLS, une fonction de contact et un bucket privé. Une erreur annule la transaction.
4. Vérifier les politiques existantes de `storage.objects` : une ancienne politique permissive couvrant tous les buckets peut s’ajouter aux nouvelles règles. Les policies MyEvent existantes doivent être limitées à leurs buckets pour ne pas exposer les images marketplace.
5. Déployer les fichiers marketplace et le lien ajouté dans `index.html`, sans inclure les modifications caméra inachevées. Le push Git ne réalise pas la migration Supabase.
6. Avec deux comptes de test, déposer une annonce, vérifier son affichage sur le deuxième compte, envoyer un message dans les deux sens, retirer l’annonce et vérifier sa disparition du catalogue.

Les tables sont `marketplace_listings`, `marketplace_favorites`, `marketplace_threads`, `marketplace_messages`.
`marketplace_contact` déduit le vendeur depuis l’annonce et l’acheteur depuis l’identité authentifiée : le client ne choisit pas ces identités.
Les images utilisent `owner_uuid/listing_uuid/image_uuid.jpg`, des règles RLS et des URL signées d’une heure.
Les titres, descriptions et messages utilisateur sont insérés avec `textContent`.

Si la migration manque, l’interface affiche un message d’activation nécessaire. Elle ne remplace jamais un échec serveur par des annonces fictives ou un succès local.
Après une interruption ambiguë de publication, vérifier Mes annonces avant de reprendre. Des fichiers non référencés peuvent subsister après une interruption ; un nettoyage serveur périodique sera utile à plus grande échelle.

## Tests

Installer les dépendances de développement, puis :

```sh
npm run test:marketplace
node --check js/marketplace.mjs
node --check js/marketplace-data.mjs
git diff --check
```

`tests/marketplace-rls.mjs` exécute la vraie migration dans PostgreSQL embarqué (PGlite). Il émule uniquement les schemas Auth et Storage de Supabase, sans connexion à la production. Vérifications : propriété, brouillons, photos, favoris, identités de contact, confidentialité des conversations, usurpation, retrait et accès anonyme.
Pour une installation de test externe au dépôt, `PGLITE_MODULE_URL` peut désigner le module PGlite par URL `file:///…/dist/index.js`.

Le test visuel local s’ouvre avec :

```sh
node tests/serve-marketplace.cjs
```

URL : `http://127.0.0.1:8766/marketplace-fixture`.
Cette page affiche explicitement TEST LOCAL, utilise un adaptateur mémoire et n’envoie aucune donnée à Supabase. Elle permet de vérifier le formulaire, le réencodage des photos, les filtres, les favoris, les messages et les erreurs réseau. Ce test ne prouve pas un déploiement Supabase.

Contrôles effectués : 4 tests Node, 34 assertions SQL/RLS, syntaxe des nouveaux JS, diff sans erreur, parcours navigateur à largeur mobile, dépôt avec photo locale, modification, retrait, favori, contact, message contenant du texte HTML rendu inerte, déconnexion, simulation d’erreur réseau. Aucune erreur console constatée dans ce parcours.

À vérifier après activation : upload réel sur Storage, URLs signées et droits avec deux comptes, session sur le domaine déployé, Safari/iPhone réel, sélection et orientation des photos, connexion instable. Les photos HEIC ne sont pas acceptées directement ; choisir une version JPEG/PNG/WebP.
