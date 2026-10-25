# Contrôle réel ciblé — 25 octobre 2026

Ancien parcours : Geoapify sans URL → Wikidata seulement, cinq résultats de nom, type direct restaurant et point à 40 m → aucune solution si l'établissement n'est pas documenté dans Wikidata. Le cache pouvait conserver 6 h un relevé éditorial disponible mais un site non validé. Le comparateur d'adresse confrontait parfois le nom de l'enseigne et « France » du format Geoapify à la seule rue extraite. Les sites sans JSON-LD ne fournissaient pas toujours d'identité exploitable.

Correctif : candidats supplémentaires via flux RSS public Bing, deux domaines au maximum, aucun lien de moteur affiché comme site. Domaine contenant le nom normalisé de l'enseigne requis pour ce canal (restriction volontaire, faux négatifs possibles), exclusions des annuaires connus, puis contrôle du nom et de l'adresse sur la page, refus de coordonnées contradictoires. Le texte visible et les titres sont utilisés comme preuves lorsqu'il manque une adresse structurée. La validation ne promeut pas un simple résultat de recherche. Les candidats du catalogue sont conservés et réutilisés sans validation automatique. Aucun domaine spécifique aux quatre cas n'est codé en dur.

Cache navigateur v6 : un résultat sans site validé expire après cinq minutes ; résultat validé six heures. Changement de version écarte les anciens états négatifs. Délais et limites maintenus, aucune donnée du catalogue modifiée, seulement normalisation de correspondance des adresses formatées.

## Une campagne réelle, résultats observés

La réponse Geoapify de production fournit website:null pour les quatre restaurants.

- Kiyomi, 19 rue Carnot : RSS expiré. Le site https://www.kiyomisushi.fr/ est confirmé par sa page officielle et ses conditions (nom, adresse et téléphone), consultées via l'outil de recherche ; le lecteur applicatif retourne toutefois unavailable, sans identité extraite. Aucun succès automatique revendiqué ; bouton applicatif encore masqué.
- Le Lavandin, La Placette : aucun candidat retenu. Les sources publiques consultées l'associent à 1 La Placette et au téléphone également utilisé pour Fane de Carotte ; aucune fusion ni réaffectation de site sous ce nom. Bouton masqué.
- Fane de Carotte, 1 La Placette : domaine fanedecarotte.wixsite.com cité publiquement mais URL de page exploitable non confirmée, racine inaccessible via l'outil de recherche. RSS expiré. Bouton masqué.
- La Vague, 1 boulevard de la Libération : RSS expiré, aucun domaine officiel vérifié. Bouton masqué.

La correction élargit la découverte et retire des causes de faux négatifs ; le contrôle réel n'a validé aucune URL par le moteur applicatif dans cet environnement. L'accès au flux et aux sites reste un blocage réel. Une recherche trouvant le site de Kiyomi n'équivaut pas à une réussite du moteur. Aucun ancien test relancé et aucun second passage exhaustif. Aucun push/déploiement.
