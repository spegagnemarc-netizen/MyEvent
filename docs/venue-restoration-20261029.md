# Restauration ciblée des fiches — 29 octobre 2026

Branche : `refactor-final`. Base : `720f3fc13d931b23417c4e819d6c25133e1fedbd`.

## Travail récupéré

Les composants Restaurants V2/V3, leur catalogue public, la recherche complémentaire de sites, la vérification d'identité et les contrôles des droits des photos ont été récupérés sélectivement depuis `origin/main` (`213c203`). Aucune fusion globale. La branche de travail possédait encore l'ancien `place-card.js`, sans miniature V3 ni raccordement à la fiche commune.

Les résultats Sorties utilisent maintenant les miniatures et ouvrent `OrevamiVenueSheet`, le composant déjà utilisé dans Activités. Fermeture, réouverture, restitution de la liste et délégation au bouton d'ajout existant sont couverts par `tests/venue-restoration-flow.test.cjs`. Téléphone, coordonnées, carte, sources, galerie autorisée et illustrations de remplacement sont conservés. Aucun second système de fiches ni réservation ajouté.

Le lecteur complémentaire restauré est réservé à la Preview utilisant le projet TEST `ahyyknfjsielnqyoxqgh`. Aucun réglage Auth, aucune migration ou écriture Supabase. Le nouveau fichier serveur est inaccessible comme fichier public. Les pages juridiques et les autres modules ne sont pas modifiés.

## Ancien test devenu obsolète

Le commit `393eb26` a déjà remplacé `requires_confirmation:true` par `false`, `official_status:source_linked`, `availability.status:not_provided` et `storage:draft_only`. Le test HTML/PDF attendait encore `true`, y compris avant cette restauration. Son assertion est alignée sur le contrat existant et renforcée par la vérification explicite du statut de source et de l'absence de disponibilité. Les contrôles d'adresse, GPS absent, dates, tarifs anciens, citations et stockage brouillon sont conservés. Aucun comportement de confirmation n'est changé dans le code pour faire passer le test.

Lors de cette finalisation, seul ce cas auparavant en échec est relancé : réussite. Les tests du parcours et des fournisseurs déjà réussis ne sont pas relancés. La validation visuelle est une étape distincte ; son résultat doit être indiqué dans le compte rendu de livraison et ne peut être déduit de ces tests.

## Limites et photos

Les réponses réelles précédemment observées autour de Gap contiennent un site pour Mes Élises à Table, aucun site Geoapify pour La menthe poivrée et Le GM, et aucune photo autorisée confirmée pour ces trois lieux. Les compléments du catalogue ont leur propre provenance et leur date ; ils ne sont pas présentés comme des champs Geoapify. Aucune note ni aucun avis n'est inventé ; le composant indique l'absence d'avis ORÉVAMI. Il ne constitue pas un système connecté de publication d'avis.

La galerie accepte les photos explicitement autorisées avec preuve et crédit, ou les fichiers Wikimedia répondant aux licences et contrôles déjà prévus. Une URL d'image sur un site ne prouve pas un droit de reproduction. Aucune activation Google Places ni facturation.

Solution recommandée sans nouvel abonnement : obtenir de chaque établissement deux à cinq photos avec l'autorisation écrite du titulaire des droits pour l'usage commercial dans ORÉVAMI web/mobile, la reproduction, l'affichage en miniature et les adaptations nécessaires. Conserver l'identité du titulaire, les fichiers concernés, la portée et la durée de l'autorisation, la preuve et le crédit demandé. Tarif de licence à convenir : zéro uniquement si l'auteur l'accorde gratuitement ; stockage et trafic consomment les quotas de l'hébergement existant. Ne pas contacter les établissements sans autorisation de l'utilisateur.

Alternative : fichiers Wikimedia correctement identifiés sous CC BY ou CC0 acceptés par le filtre existant, après vérification fichier par fichier. Pour CC BY, conserver auteur, source, lien de licence et indication des modifications. Ne pas supposer que toute image Wikimedia répond au filtre ni que la licence couvre tous les droits de tiers.

Références consultées : https://creativecommons.org/licenses/by/4.0/ ; https://www.geoapify.com/pricing/ ; https://developers.google.com/maps/documentation/places/web-service/place-photos .

## Vérification visuelle préparée

`tests/venue-recovery-preview.html` est un harnais de présentation réservé au TEST qui utilise les vrais résultats et les mêmes composants. Son ajout remplit uniquement un formulaire de démonstration et n'enregistre aucun événement. La sauvegarde effective d'un événement n'est donc pas revendiquée comme testée par ce harnais.

La Preview finale doit être créée à partir d'un arbre Git propre, puis son SHA et son environnement vérifiés. Aucune promotion Production ni push GitHub ne fait partie de cette livraison.
