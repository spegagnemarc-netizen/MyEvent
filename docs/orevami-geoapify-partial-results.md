# ORÉVAMI — correctif local des résultats Geoapify partiels

Branche : `fix/geoapify-partial-results`, fondée sur la Production `4979f12ff79965f3a494e24a749016ce6a54aa84`. Aucun push ni déploiement dans cette préparation.

## Comportement préparé

Les trois recherches restent parallèles, sans retry, avec leurs catégories et plafonds de résultats existants. `Promise.allSettled` conserve chaque réponse valide. Une panne partielle renvoie HTTP 200, `partial: true`, les résultats disponibles, un avertissement français et l'état de chaque famille. Une famille disponible mais vide ne rend pas les autres familles disponibles par déduction. Si les trois appels échouent, la réponse reste HTTP 503 avec leurs causes distinctes ; aucune panne globale n'est présentée comme une absence de lieux.

Codes sûrs : `PROVIDER_TIMEOUT`, `PROVIDER_NETWORK`, `PROVIDER_AUTH`, `PROVIDER_QUOTA`, `PROVIDER_HTTP`, `PROVIDER_RESPONSE`. Aucun corps d'erreur fournisseur, message réseau brut, URL avec clé ou secret dans la réponse ou les journaux ajoutés.

Explorer, la carte des activités de l'événement, la carte de l'accueil et Sortie IA affichent l'avertissement tout en exploitant les lieux disponibles. Sortie IA n'appelle le modèle que si les restaurants et activités réellement reçus suffisent aux étapes demandées. Les candidats et coordonnées ne sont pas inventés. Explorer n'élargit pas automatiquement le rayon sur une réponse partiellement indisponible, pour ne pas confondre panne et manque de lieux.

La recherche de salles ne change pas de catégories, filtres, capacité, budget, déduplication ou délai par défaut. Seule la précision des erreurs du helper partagé est améliorée. Les intégrations Viator restent inchangées.

## Délai candidat et coûts

`GEOAPIFY_SEARCH_TIMEOUT_MS` est une option serveur propre aux trois recherches de proximité. Valeur par défaut : 10000 ms. Les valeurs entières de 1000 à 20000 ms sont acceptées ; une valeur invalide revient à 10000 ms. La valeur `20000` est prévue comme candidate à évaluer ultérieurement hors Production ; elle n'a pas été activée sur Vercel, ni mesurée avec le fournisseur réel dans cette préparation. Les salles gardent leur délai par défaut de 10000 ms, même si cette option vaut 20000.

La durée totale dépend du plus lent des trois appels, pas de leur somme. Elle peut donc approcher 20 secondes si la candidate est activée, auxquelles s'ajoutent le traitement et les transports HTTP. Le temps disponible de la fonction Vercel devra être vérifié avant cette évaluation ; le délai client d'Explorer est de 25 secondes. Aucun paramètre Vercel n'a changé.

Trois appels Geoapify maximum par recherche de proximité, avec une limite de 100 lieux par appel, sans appel supplémentaire pour la gestion partielle. Le coût fournisseur dépend du nombre de lieux retournés, pas seulement du nombre d'appels HTTP. Les réponses partielles et les erreurs ne sont pas mises en cache ; les réponses complètes gardent leur cache existant. Le solde du compte Geoapify n'a pas été consulté et aucun crédit n'a été consommé par les contrôles simulés.

## Contrôles ciblés

26 contrôles réussis : résultats complets et partiels, démarrage parallèle, timeout d'une seule catégorie, panne globale, quota/auth/réseau/JSON, absence de secret dans les erreurs, délais 10/20 secondes, protection des salles, filtres/rayons 5/10/20/50 km/dédoublonnage, sélection IA avec résultats partiels et sans restaurant, affichage Explorer et absence d'élargissement automatique en cas de panne partielle, intégration Viator.

Tous les accès fournisseur et IA sont simulés. Aucun appel réel Geoapify/OpenAI, aucune campagne complète ni test des jeux. Le diagnostic Preview temporaire n'est pas inclus dans ce correctif.

## Publication ultérieure

Revoir le diff et le HEAD distant ; partager la branche seulement lorsque le déclenchement automatique d'une Preview sera autorisé. Évaluer alors, sur accord explicite, la candidate 20 secondes hors Production avec un budget d'appels limité. Après validation et autorisation distincte de publication, intégrer sans push forcé en préservant toutes les corrections publiées. Aucune modification Supabase, Storage, Stripe, SMTP ou DNS n'est nécessaire à ce correctif.
