# Catalogue public autour de Gap

20 relevés publics consultés le 24 octobre 2026, conservés dans `data/restaurant-catalog-gap.json`. Les extraits indexés, horaires contradictoires et cartes anciennes restent explicitement à confirmer. Une consultation n'est pas une garantie de validité future. Les prix sont des exemples textuels, pas un budget par personne.

Le moteur existant Geoapify/OSM reste responsable des résultats : aucune fiche n'est ajoutée par le catalogue. L'enrichissement exige le nom et la ville compatibles, puis une proximité inférieure à 60 mètres des coordonnées connues ou une adresse concordante. Le point du fournisseur doit rester à 20 km maximum à vol d'oiseau du centre de Gap (44.55907, 6.07967). Les coordonnées manquantes ne sont pas inventées. Les variations d'adresse non reconnues restent volontairement non enrichies ; elles nécessitent une vérification éditoriale.

Les accordéons restent fermés par défaut. Leur ouverture utilise le relevé sourcé local au lieu d'une nouvelle extraction susceptible de remplacer les réserves documentées. Les autres restaurants conservent l'extraction générique existante. Les sources sont conservées dans la fiche et son instantané d'activité.

Toutes les entrées sont des fiches publiques : aucun partenariat MyEvent-API ni créneau réservable n'est déduit. Un lien de contact n'est qu'une demande, jamais une réservation confirmée. Les réservations hôtelières, de camping et commandes à emporter ne sont pas des liens de réservation de table.

## Photos

Le champ `photo` est nul pour les 20 fiches et les images des fournisseurs sont masquées pour ces fiches. Aucun téléchargement ni copie de Google Maps. Une future activation devra exiger un fichier autorisé, l'URL source, le crédit, la licence ou l'autorisation écrite et sa preuve datée. Le présent lot n'active aucun affichage de photo d'établissement.

## Suite hors de ce lot

Les notes et avis ORÉVAMI des restaurants et activités restent à concevoir avec modération (signalement, traitement, publication/retrait et traçabilité). Aucun composant, stockage, endpoint ou politique de production n'est créé pour ce module.

Pas de migration, pas de modification MyEvent-API/Supabase, pas de push ni déploiement. Validation ciblée uniquement sur le catalogue et la fiche pilote.
