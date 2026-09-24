# Filtres IA photo

Branche : `refactor-final`, intégration après `e27054a`.

Dans la caméra, prendre ou importer une photo, ouvrir **IA**, choisir un style puis **Transformer ma photo**. Douze styles couvrent beauté, cartoon, animaux et looks créatifs. Les icônes de choix représentent des catégories, pas des aperçus générés. Les transformations génératives se font après la prise ; les effets locaux de suivi du visage restent disponibles en direct dans le carrousel et Apparence.

Le traitement utilise réellement `POST /v1/images/edits`, modèle `gpt-image-2`, avec la photo d'origine et une instruction prédéfinie. Le bouton explique l'envoi à OpenAI et l'utilisation du service payant avant le lancement. Aucune requête payante au simple choix d'une catégorie ou d'un effet.

## Configuration

- `OPENAI_API_KEY` doit être configurée dans l'environnement Vercel Preview de `refactor-final`, avec accès à `gpt-image-2`. La clé reste uniquement côté serveur.
- Une session MyEvent valide est obligatoire. Le serveur vérifie le jeton auprès du même projet Supabase que `core-runtime.js` ; l'URL et la clé publique ne sont pas des secrets.
- La fonction `api/camera-ai.js` dispose de 180 secondes dans `vercel.json` ; vérifier que la configuration Vercel autorise cette durée. Délai d'authentification : 10 s ; délai du fournisseur : 150 s. Pas de relance automatique facturable.
- Chaque génération consomme l'API OpenAI. Cette version ne met pas en place de quotas de facturation par utilisateur ; configurer les limites du projet fournisseur selon l'usage prévu.

## Photo et annulation

La source originale reste en mémoire pendant la session. Chaque style repart de cette source, réduite à 1280 px maximum pour l'envoi, sans cumuler les générations. Le résultat rejoint la prévisualisation et les actions existantes de publication/ajout à un événement. Les réglages photo locaux peuvent être appliqués au résultat ; les accessoires suivis sur l'ancien visage ne sont pas redessinés sur le visage généré.

**Revenir à l'original** restaure la source avec les réglages locaux de la session. Fermer, reprendre ou importer une autre photo annule l'attente et invalide toute réponse tardive. Un changement de réglage pendant l'attente invalide aussi l'application du résultat par contrôle de révision. Annuler l'attente ne garantit pas l'annulation d'un calcul déjà démarré chez le fournisseur.

## Vérification

- `node --test tests/camera-ai.test.mjs tests/camera-appearance.test.mjs` : validation, authentification, douze styles, requête multipart d'édition, erreurs, délais et régressions du moteur caméra. Réseau simulé.
- `node tests/camera-ai.browser.cjs` : nécessite Playwright et Microsoft Edge ; `PLAYWRIGHT_MODULE` peut indiquer le chemin du paquet Playwright. Le test charge le véritable HTML et les modules caméra, importe une image de test, vérifie la transformation et la restauration des pixels, l'ajout du bon style, les erreurs, l'annulation et la fermeture. Aucun appel réel à Supabase ou OpenAI.
- Le rendu génératif réel et les essais sur iPhone doivent être validés sur l'aperçu avec la clé serveur. Aucun portrait utilisateur n'a été envoyé pendant les tests locaux.

Références : [édition d'images OpenAI](https://developers.openai.com/api/docs/guides/image-generation), [durée des fonctions Vercel](https://vercel.com/docs/functions/configuring-functions/duration).
