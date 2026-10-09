# Caméra V2.2 corrective — 9 octobre 2026

HEAD initial local/distant vérifié : `7655d2876315c94fc5caed390cb68444c38e9f9d`, `refactor-final`. Main observé : `b95ae44b886bbbead07fe21d476cb73d61f039d9`.

## Cause et correction de Signature

Le script caméra du head différait son initialisation à DOMContentLoaded. Le runtime du bas de page branchait les clics avant cet événement ; Signature était créée ensuite, sans listener. Les anciens tests injectaient les scripts après chargement du DOM, ce qui masquait le problème.

Signature et Texte sont maintenant des éléments HTML permanents. Les clics des outils créatifs sont délégués sur le modal, ce qui fonctionne indépendamment de l’ordre de création. Un nouveau test conserve les quatre vrais scripts caméra dans leur ordre head/bas de page, au lieu de les injecter après DOMContentLoaded.

Les quatre modèles Classique, Cœur, Couronne et Manuscrite sont conservés ; le dernier reste constitué de tracés vectoriels de lettres au stylo, soulignement et finition dessinée. Déplacement, rotation, pincement, couleur, transparence, remplacement et suppression utilisent le renderer commun à l’aperçu et à l’export.

## Interface immersive

- Six outils verticaux à droite : Retouches, Filtres, Effets, Stickers, Signature et Texte.
- Photo couvrant l’espace disponible, à partir du bas du bandeau TEST jusqu’à la barre d’édition, derrière les commandes semi-transparentes. Aucun changement de taille lorsque l’on ouvre un panneau.
- Recadrage central non destructif pendant l’édition : le canevas original reste disponible. Le JPEG enregistré/publié utilise exactement la portion visible ; les annotations sont composées dans les coordonnées originales puis recadrées. Les ratios d’image différents de l’écran peuvent donc perdre leurs bords dans le fichier final. Aucun étirement de la photo.
- Reprendre, Modifier, Supprimer et Terminé dans une barre flottante inférieure. Modifier/Supprimer sont désactivés lorsqu’aucun élément n’est sélectionné.
- Terminé retire la sélection et ouvre le panneau Ma Story / Publier dans le fil / Ajouter à un événement / Enregistrer. « Modifier la photo » permet de revenir à l’édition ; toucher un outil la reprend également.
- Boutons compacts et translucides ; contours blancs en Gratuit, dorés en Premium. Aucun droit ou abonnement modifié.
- Zones de sécurité et visualViewport conservés. Les panneaux occupent le bas/gauche sans chevaucher la colonne des outils ni la barre d’édition. En paysage, la colonne peut défiler.
- Le recadrage exporté se met à jour lors d’une modification du viewport. Les gestes conservent les coordonnées de l’original, indépendamment du recadrage visible.
- Vidéo : enregistrement, import, lecture, envoi Story et sauvegarde conservés. Reprendre reste accessible ; les retouches photo ne sont pas annoncées comme effets vidéo.

## Vérifications réalisées

- 155 tests Node réussis, aucun échec ni test ignoré, y compris PGlite.
- Nouveau parcours correctif **Chromium et WebKit 26.5** : vrai ordre de chargement ; ouverture des six outils ; quatre signatures distinctes ; remplacement ; opacité ; pincement, rotation et déplacement ; pixels du JPEG conformes au cadrage/décorations ; catégories de filtres et intensité ; neuf déformations réelles WebGL ; accessoires ; absence de visage ; détection MediaPipe réelle de 478 points sur une photo fournie localement.
- Formats 320×568, 375×667, 390×744, 430×832 et 844×390 avec bandeau TEST de 52 px : photo immersive, colonne verticale, barre inférieure dans l’écran, aucun débordement horizontal, photo inchangée à l’ouverture de Signature, publication seulement après Terminé, retour à l’édition, téléchargement réel et contours Gratuit/Premium.
- Régression V2.1 **Chromium et WebKit** : 20 miniatures/recettes, gestes tactiles natifs Chromium et événements de pointeur WebKit, édition/suppression indépendante, JPEG, sauvegarde exacte, IA et publication Story/Fil via services locaux simulés.
- Régression V2 **Chromium** : capture Canvas, minuteur, avant/arrière, ratios, filtres, annotations, sélection et ajout explicites à un événement via service simulé, MediaRecorder réel, import vidéo, Reprendre vidéo, Story et libération des flux.
- Régression IA **Chromium** : génération sur réponse API simulée, restauration, erreur, annulation, réponse tardive ignorée.
- Au total : six parcours navigateur réussis, aucune erreur JavaScript. Vérifications syntaxiques et `git diff --check`.

Les tests et captures sont locaux. Aucune publication distante, aucun appel IA facturé, aucune modification de données/rôles Supabase. Les fichiers API et Sabre ne changent pas ; le nombre de fonctions reste 12.

## Limites

WebKit automatisé vérifie le moteur Safari et les mises en page mobiles ; ce n’est pas un iPhone physique. Les permissions matérielles, clavier et barres Safari réels, vitesse/chauffe et publication authentifiée restent à valider sur l’appareil de l’utilisateur. La Preview Vercel protégée nécessite la session habituelle. Aucun résultat de test sur iPhone physique n’est revendiqué.

Verdict : **GO pour poursuivre la validation iPhone sur la nouvelle Preview**. Aucune mise en Production.
