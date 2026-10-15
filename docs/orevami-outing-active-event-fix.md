# ORÉVAMI — Sortie IA et événement actif

Branche locale `fix/outing-plan-active-event`, base Production `b51112525de4e30a9c0f3aa47998a26fb3f95364`. Aucun push ni déploiement.

## Causes identifiées

La recherche Geoapify fonctionnait partiellement, mais le traitement suivant pouvait toujours échouer. Les journaux existants de `/api/generate-outing-plan` attestent deux `DOMException TimeoutError`, les 15/10/2026 à 14:40 et 14:41 (Paris), sur le déploiement Production b511125. Aucun nouvel appel externe de recherche ou de génération n'a été nécessaire.

Le commit `b9fff9f` a ajouté un délai de 25 secondes à l'appel OpenAI. L'ancien fonctionnement n'avait pas ce délai explicite. Entre la première version et la version publiée, la taille du traitement a augmenté (jusqu'à 120 candidats, six propositions et 9000 tokens de sortie). Le rejet était converti en erreur générique, sans proposition de secours. JSON invalide et options éliminées par validation pouvaient aussi laisser l'utilisateur sans planning ; ces branches sont désormais couvertes par des réponses simulées. Les journaux confirment le timeout dans le cas observé, pas un manque de lieux ni une erreur de clé.

La sélection d'événement avait trois chemins de remplacement involontaire : premier événement de la liste à l'ouverture du workspace, premier événement du filtre, et restauration d'un ancien identifiant depuis l'historique de navigation. Au rafraîchissement, `show()` effaçait l'événement actif puis ne le restaurait que si un indicateur d'onglet était présent. Enfin, `selectEvent()` n'empêchait pas une ancienne réponse asynchrone de supplanter une sélection plus récente.

## Corrections préparées

- Sélection de secours déterministe sur les lieux réels déjà reçus en cas de timeout, réseau, quota, erreur HTTP, JSON inexploitable ou absence de clé IA. Aucun appel fournisseur additionnel pour ce secours.
- Contexte complet conservé pour les filtres et le secours ; entrée du modèle limitée à 12 restaurants et 24 activités compatibles, réponse réduite aux identifiants de trois propositions maximum. Délai IA préparé à 12 secondes au lieu de 25. Ce nouveau délai n'a pas été évalué avec le fournisseur réel.
- Les identifiants, coordonnées, noms, prix et types retournés sont validés/repris des candidats. Le modèle ne peut pas injecter d'autre lieu, prix, heure ou durée. Seuls les horaires saisis par l'utilisateur sont ancrés ; les horaires d'ouverture et durées restent inconnus. Aucun prix estimé inventé.
- Budget, capacité connue, rayon, participants, nombre d'étapes et repas pris en compte. Tarifs/capacités inconnus restent à confirmer, sans prétendre garantir le budget ou l'accueil. Si seules moins d'étapes sont réalisables, la proposition est explicitement marquée partielle et à compléter. Un restaurant ET une activité restent indispensables. Les critères incompatibles produisent une erreur explicite.
- Conservation du dernier identifiant choisi, par utilisateur, indépendamment du dernier onglet. Aucun événement de remplacement automatique à l'ouverture, au filtre ou au retour d'historique. Une absence d'accès confirmée ou une suppression invalide la sélection et invite à choisir ; une panne de chargement ne la remplace pas.
- Protection des sélections et générations contre les réponses tardives ou un changement de compte/événement. Les propositions sont rattachées à leur événement ; l'enregistrement capture les identifiants d'origine pour éviter d'écrire une proposition dans un autre événement après une navigation.

## Vérifications ciblées

39 contrôles simulés réussis : secours IA et causes précises, absence de lieux/prix/horaires fabriqués, budget/capacité/rayon, étapes partielles, repas, persistance par compte, perte d'accès, absence de premier événement automatique, filtrage/retour navigation, réponses de sélection et génération arrivant en retard ; compatibilité avec la recherche Geoapify partielle et Viator. Import réel du handler Node vérifié sans invocation fournisseur.

Aucun appel réel Geoapify/OpenAI, aucune modification des données Supabase ni de Storage, Stripe, SMTP ou DNS. Aucun test des jeux, aucune campagne générale. Le comportement réel sur iPhone devra être confirmé après autorisation d'une Preview ; la Production reste inchangée.
