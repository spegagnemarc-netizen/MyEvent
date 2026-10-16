# ORÉVAMI — tournage iPhone sur TEST

## Mode tournage

Cette branche part de la Preview du fil social validée `5718602cd4d3cf77b8a7ff601f33ccff224e6c46`.
Elle ne change ni les fonctionnalités ni la configuration Supabase.

- Ouvrir la nouvelle URL Preview avec `?tournage=1#home` pour masquer le bandeau.
- Ouvrir la même URL avec `?tournage=0#home` pour le réafficher.
- Le bandeau est visible par défaut. Une activation explicite est mémorisée seulement dans l’onglet Safari courant via une clé sessionStorage dédiée à ce projet TEST, pour conserver le masque lors du passage vers Marketplace ou Explorer. Aucun cookie ni réglage de compte n’est modifié.
- Désactiver avec le lien `tournage=0` après chaque prise. Si Safari bloque sessionStorage, ajouter `tournage=1` à l’URL de chaque page à filmer.
- Le masque est autorisé seulement après validation de `environment=preview`, `isTest=true`, de la référence `ahyyknfjsielnqyoxqgh` ET de son URL Supabase exacte.
- Une configuration refusée garde le message « CONNEXION BLOQUÉE » visible même avec `tournage=1`.
- Les cookies et la protection Vercel, l’authentification, les RLS et les sessions TEST sont inchangés.

Avant de filmer, ouvrir le lien normal, vérifier le bandeau TEST et se connecter avec un compte fictif existant. Ouvrir ensuite le lien tournage dans le même Safari. Ne jamais filmer depuis orevami.com.

## Préparation commune

Filmer l’écran réel de l’iPhone, en orientation verticale, via l’enregistrement d’écran du Centre de contrôle. Le fichier natif sera adapté au montage en 1080 × 1920, sans déformation ni rognage des commandes essentielles. Aucune vidéo définitive ni voix/musique n’est créée par cette préparation.

Activer Concentration pour éviter les notifications personnelles ; désactiver l’aperçu de notifications et ne pas filmer la saisie d’identifiants. Utiliser les comptes, photos et événements fictifs déjà présents. Les touches et la navigation doivent rester visibles ; conserver environ une seconde de pause avant et après chaque action. Aucun badge de store, aucune promesse de disponibilité non vérifiée.

Les parcours ci-dessous sont des consignes de tournage, pas de nouvelles validations fonctionnelles. Ne pas présenter une action comme réussie si elle ne l’est pas à l’écran. Si une étape bloque, conserver la séquence et le message d’erreur pour diagnostic, sans enchaîner des essais répétés.

## Présentation — 45 secondes

| Temps | Manipulation réelle à enregistrer |
|---|---|
| 0–4 s | Accueil, logo ORÉVAMI et vue des raccourcis. |
| 4–14 s | Ouvrir Événements puis un événement fictif existant ; montrer sa fiche et les participants. |
| 14–22 s | Ouvrir les rubriques discussion et sondage existants, si disponibles sur ce compte. |
| 22–29 s | Revenir à l’accueil ; ouvrir les Stories puis la caméra, sans publier de média pour le tournage. |
| 29–35 s | Ouvrir Musique ; montrer les catégories ou une playlist déjà disponible. |
| 35–40 s | Ouvrir Jeux ; montrer le catalogue, sans lancer de partie. |
| 40–45 s | Ouvrir Marketplace puis revenir au logo. Prévoir au montage « Vos sorties prennent vie » et orevami.com. |

## Tutoriel — 2 min 30

Priorité aux Événements. Préparer le parcours avec un événement fictif existant et sans effacer ses données.

| Temps | Manipulation réelle à enregistrer |
|---|---|
| 0–10 s | Depuis l’accueil, appuyer sur Événements. |
| 10–40 s | Ouvrir « Créer un événement » ; montrer les champs réels et saisir un brouillon fictif : titre, description, date, heure, lieu, visibilité et seules options présentes. Aucun enregistrement réel n’est fait pendant cette préparation. Pendant le tournage, n’enregistrer qu’un événement explicitement fictif si souhaité, ou reprendre l’événement de démonstration existant. |
| 40–60 s | Montrer la fiche enregistrée de démonstration, son nom et ses informations ; ne pas faire passer l’événement existant pour celui du brouillon. |
| 60–80 s | Montrer l’invitation d’un compte fictif et la gestion des participants. L’acceptation nécessite une seconde session fictive disponible ; sinon, montrer uniquement les invitations réellement visibles. |
| 80–105 s | Ouvrir discussion et sondage existants ; montrer une réponse uniquement si elle est réellement effectuée sur TEST. |
| 105–125 s | Montrer les tâches et outils réellement accessibles de l’événement. |
| 125–143 s | Montrer la recherche de sorties ou un planning fictif déjà enregistré ; éviter toute génération fournisseur inutile pour la préparation. |
| 143–150 s | Revenir à la fiche organisée, puis au logo ; slogan prévu au montage. |

Pour une création complète enregistrée en continu, laisser durer la prise si la saisie et les invitations dépassent 2 min 30 ; choisir ensuite avec l’utilisateur les coupes pédagogiques, sans simuler d’étapes.

## Publicité — 20 secondes

| Temps | Manipulation réelle à enregistrer |
|---|---|
| 0–2 s | Accueil et logo. Animation lumineuse réservée au futur montage. |
| 2–6 s | Appuyer sur Événements ; laisser la rubrique s’ouvrir, fermer ou revenir. |
| 6–10 s | Ouvrir Jeux ; montrer le catalogue puis revenir. |
| 10–14 s | Ouvrir Marketplace puis revenir. |
| 14–18 s | Ouvrir Musique puis revenir. |
| 18–20 s | Accueil/logo ; orevami.com et slogan au futur montage. |

Enregistrer les manipulations à leur vitesse naturelle, même si la prise brute dépasse 20 secondes. Le montage final raccourcira les pauses ; ne pas remplacer les ouvertures par des captures fixes. Safari n’affiche pas toujours un indicateur de toucher : le futur montage pourra ajouter un repère aligné uniquement sur les appuis réellement enregistrés.

## Contrôles de cette livraison

Contrôles ciblés du masque du bandeau et du refus des configurations incorrectes uniquement. Aucun parcours fonctionnel ni génération Geoapify/OpenAI supplémentaire, aucune modification de données, aucune compilation mobile, aucun déploiement Production.
