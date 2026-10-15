# Fil d’actualité — médias compacts et visionneuse

Branche : `fix/compact-feed-media`, basée sur la Production `f89201bc53854290402687613dd304ac59fd0adc`. Préparation locale uniquement.

## Cause et périmètre

La capture iPhone IMG_0880.jpeg montre une photo de publication occupant presque tout l’écran. La règle de hauteur de 250 px utilisait `img[alt="Photo MyEvent"]`, tandis que le rendu emploie désormais `alt="Photo ORÉVAMI"`. La règle ne s’appliquait plus. Le correctif utilise une classe stable, sans dépendre d’une traduction ou du nom public.

Seuls les médias du véritable fil `#socialFeed` sont concernés. Avatars, commentaires, cartes de présentation des événements, Stories et autres rubriques sont exclus. Le code de génération et d’enregistrement des publications n’est pas modifié.

## Présentation préparée

- Photos à 250 px, proportions préservées avec `object-fit: cover` ; le recadrage concerne seulement l’aperçu, sans modifier le fichier publié.
- Appui sur une photo : dialogue modal affichant la source entière en proportions originales. Fermeture par ×, Échap ou fond. Zoom 1×–4× par boutons, molette et gestes à deux pointeurs ; déplacement de l’image agrandie.
- Verrouillage temporaire du défilement arrière, restauration des styles précédents, de la position de la page et des conteneurs (y compris galerie), puis du focus sans défilement.
- Vidéos à 250 px, `object-fit: contain`. Les éléments vidéo et leurs attributs/commandes/gestionnaires sont conservés ; aucun remplacement par une image ou nouveau lecteur.
- Plusieurs médias adjacents d’une publication sont regroupés dans une galerie horizontale de 250 px, sans déplacer les textes ou les commandes d’interaction. Les dispositions non adjacentes sont laissées en place plutôt que réorganisées arbitrairement.
- Espace inférieur de sécurité dans le fil, avec prise en compte de la zone sûre iPhone ; aucune modification de la barre de navigation partagée.
- Le traitement s’applique aussi aux publications ajoutées dynamiquement, sans modifier les auteurs, dates, textes, likes ou commentaires.

## Vérification et limites

Six nouveaux contrôles DOM simulés passent : conservation des nœuds et interactions, regroupement des médias, source entière, ouverture/fermeture et restauration des défilements/focus/styles, zoom et deux pointeurs simulés, publications ajoutées dynamiquement. Syntaxe des scripts et diff vérifiés. Aucune campagne antérieure rejouée ; aucun appel Supabase ou fournisseur.

Le navigateur local n’est pas disponible et sa tentative d’installation a échoué. Les dimensions calculées, la lecture vidéo réelle, le pincement natif Safari et le dégagement visuel au-dessus de la navigation ne sont donc pas déclarés validés. Ces points restent à confirmer sur iPhone lors d’une future Preview autorisée.

Aucun push, aucune Preview, aucun déploiement Production, aucune modification de Supabase, Stripe, SMTP ou DNS. Sortie IA, événements et jeux inchangés.
