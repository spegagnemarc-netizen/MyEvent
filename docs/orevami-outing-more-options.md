# Sortie IA — jusqu’à 10 propositions et pagination

Branche locale : `feat/outing-plan-more-options`, basée sur la Production validée `f89201bc53854290402687613dd304ac59fd0adc`.

## Comportement préparé

- Les trois propositions actuelles (ou le nombre disponible) restent en tête, avec leur fonctionnement et leurs indices de sélection conservés.
- La réponse initiale est complétée jusqu’à dix combinaisons réelles. Le bouton « Voir 10 autres sorties » ajoute jusqu’à dix autres combinaisons sans retirer celles déjà affichées.
- Les lieux sont ceux de la recherche Geoapify initiale, conservés uniquement en mémoire pour la génération courante et isolés par utilisateur/événement. Aucun nouvel appel Geoapify ou OpenAI pour les pages suivantes : seule l’API interne recalcule une page déterministe depuis ce catalogue.
- L’énumération alterne les restaurants et l’ordre des activités culture/nature/loisirs. Les mêmes lieux simplement permutés ne constituent pas une nouvelle proposition. Les combinaisons déjà fournies par les trois propositions initiales sont exclues des pages suivantes.
- Participants, rayon, étapes, budget connu, heures explicites et repas passent par les mêmes validations. Les prix, horaires, durées et capacités inconnus ne sont pas inventés. Les programmes incomplets restent signalés.
- S’il y a moins de dix combinaisons, seules celles disponibles sont affichées. Le bouton disparaît à épuisement. Les curseurs sont bornés à 10 000 combinaisons supplémentaires pour limiter le travail serveur.
- En cas d’erreur ou de délai dépassé sur une page, les choix affichés et le curseur précédent sont conservés ; l’utilisateur peut réessayer. Les doubles appuis sont ignorés et les réponses arrivées après un changement de compte, d’événement ou de génération sont rejetées. Si les critères ont changé, une nouvelle génération est demandée au lieu de mélanger les recherches.

## Préférences libres

Les contraintes structurées restent vérifiées côté serveur. Pour les demandes en texte libre, le même et unique appel IA initial peut fournir un sous-ensemble d’identifiants compatibles et des groupes de candidats obligatoires (ex. une activité demandée). Ces identifiants sont validés contre les lieux réels. Chaque nouvelle combinaison doit contenir un candidat de chaque groupe obligatoire.

Ce classement dépend de la réponse du moteur et des informations disponibles sur les lieux ; il ne garantit pas des caractéristiques non documentées. Sans classement exploitable — notamment en secours déterministe avec préférences libres non vérifiables — les propositions initiales restent disponibles mais la liste n’est pas élargie arbitrairement. Un message français l’explique. Sans préférences libres, le secours peut lui aussi proposer jusqu’à dix choix puis les pages suivantes.

Le prompt initial reçoit quelques instructions supplémentaires et des identifiants de classement ; le plafond de sortie (3 500 tokens), le modèle et le délai IA (12 secondes) restent inchangés. L’impact réel sur le temps du modèle n’a pas été mesuré. Aucun appel externe n’a été réalisé dans cette préparation.

## Contrôles effectués

Dix nouveaux contrôles ciblés à réponses simulées : maintien des trois premiers choix, variété, pagination de 140 combinaisons sans doublon, catalogue insuffisant, contraintes et horaires, groupes de préférences, programmes partiels, absence d’appel fournisseur en pagination, unique appel simulé initial, doubles appuis, erreurs et réponses tardives. Vérification syntaxique des trois fichiers modifiés et du diff.

Les 39 contrôles précédents et les 159 tests des jeux n’ont pas été rejoués. Aucun changement Supabase, Vercel, Stripe, SMTP ou DNS pour cette évolution. Aucun push de cette branche, aucune nouvelle Preview et aucune publication de cette fonctionnalité.
