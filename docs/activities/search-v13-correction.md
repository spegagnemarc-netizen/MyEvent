# Recherche Activités V1.3 — correction TEST

Branche exclusive : refactor-final. Aucun SQL, RLS, service payant ou changement
Production. Activation et inscriptions inchangées. La correction du formulaire
arrivée sur la branche au commit aa1c053 est conservée.

## Architecture

Le mode existant activity-venue conserve Photon. Il résout séparément la commune
avec countrycode=FR/layer=city, puis recherche dans sa zone, exclut les villes
différentes déclarées par les sources et déduplique les identifiants OSM. Une
ville explicite dans la requête prime sur une ancienne ville du formulaire.
Sans ville, une activité seule recherche en France. Les limites géographiques
sans commune déclarée utilisent l'emprise de la commune, pas une frontière
administrative précise. Le catalogue illustré de 42 catégories et le carrousel
restent inchangés.

Pour une ville seule, seules les catégories utiles aux sorties sont conservées :
les écoles, agences immobilières, postes et gares ne sont pas proposées comme
sorties. Photon reste un géocodeur, pas un inventaire exhaustif des commerces.
Overpass complète la découverte locale et dispose de deux endpoints déjà utilisés
par l'application, avec délais et tailles bornés. Geoapify réutilise l'adaptateur
restaurant existant seulement en repli d'une recherche restaurant géolocalisée,
si la clé serveur existe. Aucun nouveau contrat ou quota payant n'est activé.

Les fiches réutilisent le résultat de recherche si l'enrichissement est en erreur.
Les liens de réservation sans confirmation sont explicitement marqués non
confirmés. Aucune photo externe sans autorisation n'est importée. Sources et dates
de consultation restent affichées, sans garantie de validité actuelle des tarifs.

Le formulaire conserve les contrôles uniques et le récapitulatif modifiable du
commit aa1c053. Le bouton de fiche « Organiser une sortie ici » préremplit le lieu,
l'adresse, la ville, les coordonnées et les liens disponibles, sans réservation.
Le catalogue persistant et la publication enrichie restent en attente des
autorisations déjà identifiées ; cette mission ne les débloque pas.

## Validation ciblée

Avant : Patinoire à Gap incluait un boulodrome et des patinoires hors commune ;
Bowling à Marseille plaçait Aubagne avant Marseille ; Gap seul renvoyait la Corée.
Après : sur Preview, Alp'Arena et Bowlingstar sont chacun le seul résultat de leur
recherche explicite. Gap est résolu en France ; les catégories étrangères aux
sorties sont exclues. Le nombre de résultats dépend de l'état des fournisseurs.

29 tests locaux réussis couvrent géographie, repli, erreurs, sécurité des liens,
préremplissage, contrôles uniques, conservation du catalogue et du carrousel.
Après resserrement du filtre de découverte, les 6 tests affectés réussissent.
La fiche Bowlingstar sur Preview conserve adresse et carte malgré l'échec des
détails complémentaires ; l'ajout remplit le récapitulatif. Fenêtre mobile 390×844,
largeur utile 375px : largeur de page égale à celle du viewport, sans débordement.
Safari sur iPhone physique reste à vérifier. Aucun enregistrement d'activité,
paiement, réservation ou test répétitif d'inscription.
