# Diagnostic ciblé — lieux partiels et pagination

Branche : `feat/outing-plan-more-options`. Base : contenu du commit local `facf70d`, identique à la Preview `a919905725fe355e1fb76e3c4bbca8f45da1185d`.

## Preuves disponibles

- La capture IMG_0881.png porte explicitement « Culture et divertissement […] Le délai de réponse est dépassé », puis trois propositions. La rubrique reçoit donc des résultats partiels. Les restaurants et parcs affichés restent de vrais lieux.
- IMG_0878.png montre trois **salles** dans un périmètre où le troisième résultat est à 4,4 km. Ce compteur de salles ne mesure pas le catalogue Restaurants/Activités et ne peut pas être comparé directement aux 97 lieux d’une recherche antérieure à 20 km. Le rayon actif n’est pas visible dans la capture.
- Le fichier JavaScript réellement servi par l’URL Preview contient la pagination et son bouton. `/api/runtime-config` confirme Supabase TEST. Aucun appel Geoapify/OpenAI n’a été nécessaire à ces lectures.
- Les journaux accessibles de cette Preview, de 16:19 à 16:49 UTC, ne contiennent qu’un avertissement Node sur runtime-config ; aucune requête de recherche/génération ne permet de retrouver la réponse exacte montrée sur l’iPhone. L’origine de cette session ou une réponse ancienne reste donc à départager. La capture seule ne prouve pas un défaut CSS.

## Causes de code et corrections

### Trois propositions et bouton absent

Le moteur conserve initialement au maximum trois propositions. L’élargissement nécessite une politique de candidats. Avec une demande libre, l’absence de métadonnées `preferences_checked` bloque cette politique ; un secours après timeout ne recalculait pas non plus cette politique pour une demande simple. `has_more` devient faux et aucun bouton n’est rendu, même lorsqu’une demande générique pourrait utiliser davantage de lieux. Le bouton était par ailleurs uniquement placé après toutes les cartes.

Le correctif interprète localement, de façon conservatrice, les demandes génériques et certaines exigences attestées par les noms/types réels des candidats (ex. bowling, cinéma, musée, parc). Le type fournisseur est conservé jusqu’au composeur. Les exclusions, caractéristiques inconnues et demandes complexes ne sont pas déduites arbitrairement ; la politique IA validée reste utilisable dans ces cas. La politique locale s’applique aussi au secours. Les trois premiers choix sont conservés.

Le bouton apparaît avant et après les cartes lorsqu’une autre page existe. Les doubles appuis sont bloqués sur les deux boutons. Une réponse sans pagination est désormais signalée explicitement, et le script possède une nouvelle version de chargement. La réponse inclut un identifiant de version et des compteurs non sensibles de candidats et d’éligibilité pour un prochain diagnostic. Le nombre de restaurants/activités et le rayon sont affichés.

Avec un champ de demande vide et 97 lieux compatibles, le code de la Preview était déjà censé produire dix propositions. Ce cas précis ne peut donc pas être attribué honnêtement au seul verrou de préférences sans la réponse réseau de la session. Le nouvel avertissement permettra de distinguer une réponse d’ancienne version d’un catalogue véritablement trop restreint.

### Diversité des lieux

Le délai Culture/Divertissement est attesté par la capture. Le délai par défaut demeure dix secondes, les trois catégories restent parallèles, et les requêtes/catégories/limites fournisseur ne sont pas modifiées. Aucun quota ou défaut de clé ne peut être confirmé à partir des traces disponibles.

Une cache mémoire de lieux publics conserve les réponses réussies par centre exact, rayon et catégorie : mutualisation des demandes concurrentes, réponse fraîche réutilisable pendant une minute ; en cas d’échec, réutilisation de lieux réellement reçus depuis moins de dix minutes. Les résultats repris restent marqués partiels et la cause fournisseur demeure affichée. Cache limitée à 100 clés, sans compte utilisateur, clé API ou données de planning. Les salles conservent leur chemin existant, sans cette cache.

Cette mesure réduit les pertes et le quota sur un serveur chaud, mais ne peut inventer le contenu d’une catégorie jamais reçue. La réponse fournit par catégorie le nombre brut reçu, la durée et l’usage éventuel de cache. Les plafonds et la déduplication existants sont préservés.

## Contrôles

Huit nouveaux contrôles ciblés simulés passent : dix choix puis page suivante avec catalogue de 97 lieux sans Culture, demande générique et préférence concrète, rejet des préférences non vérifiables, mutualisation/cache fraîche, secours récent sur timeout et expiration, isolation centre/rayon/catégorie, statut partiel explicite, boutons accessibles et diagnostic d’absence de pagination, véritable handler avec timeout IA simulé et dix choix de secours.

Aucune ancienne campagne rejouée. Aucun nouvel appel réel Geoapify/OpenAI, aucune recherche Production, aucune modification de variables, de Supabase, de la sélection d’événement ou du chargement des événements. Aucune nouvelle Preview ni publication.
