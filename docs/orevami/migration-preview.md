# ORÉVAMI : livraison Preview et bascule ultérieure

## Périmètre
Identité visible sur refactor-final uniquement. Nom ORÉVAMI, slogan Vos sorties prennent vie, logo officiel à gauche du nom sur une ligne. Textes, partages, annotations des nouvelles photos, nouveaux documents PDF, titres, métadonnées, favicon, icônes et manifest. Logos complets conservés séparément. Boutons et actions existants conservés. Les JPEG et documents historiques ne sont pas réécrits.

Nom technique orevami utilisé pour les nouveaux fichiers de marque et noms de nouveaux PDF ; tables/RPC/buckets, API, variables, identifiants DOM, globals JavaScript, valeurs de jeux, clés de stockage, URLs des fournisseurs et identifiants Android/iOS conservés. Aucun service worker ni promesse de fonctionnement hors ligne ajoutés. Application native existante : seuls libellés/configuration de nom/icône sont préparés, aucun build natif déployé.

## Vérifications
124 tests applicatifs réussis, 1 test désactivé dans la suite existante. Tests de navigation, rôles, thème, invitations, jeux, caméra/export, musique, contrats PDF, Marketplace, Explorer, réservations, salles/restaurants, administration, frontières TEST, publicité et webhook Stripe. Les tests isolés n'équivalent pas à un parcours distant intégral ou à Safari sur appareil réel. 33 fichiers JS modifiés vérifiés : tokens de logique/identifiants inchangés hors chaînes. En-tête partagé et générateur partenaires relus séparément.

Tests à réaliser sur la Preview : en-têtes des cinq rubriques en 390×844 et ordinateur, version claire/sombre du logo, fermeture/retour, galerie/caméra (sans publier dans une base de production), déconnexion/reconnexion, création/invitations/rôles/discussion/sondage/Stories uniquement avec comptes/données TEST autorisés. Safari iPhone réel, connexion/inscription/e-mails de production, paiement réel et disponibilité des partenaires externes restent non validés. Une migration visuelle ne déclenche aucune migration SQL.

## Supabase et e-mails
Aucune configuration Auth/SMTP/OAuth de production modifiée. Préparer les sujets/textes ORÉVAMI pour confirmation, invitation et réinitialisation dans les modèles existants en préservant les variables et destinations. Aucun modèle remplacé dans le tableau de bord. Adresse contact@orevami.com et fonctionnement Zimbra Starter confirmés par l'utilisateur ; aucune opération de messagerie effectuée par cette mission. Les documents légaux restent à faire valider, ne pas inventer de CGU.

## DNS : instructions à appliquer après autorisation distincte
Conserver OVH comme fournisseur DNS et sauvegarder la zone existante. Préserver strictement MX Zimbra, SPF, DKIM et DMARC. Ajouter orevami.com, www.orevami.com et orevami.fr au même projet Vercel my-event ; le premier sera principal, les autres redirigés vers https://orevami.com. Relever les valeurs exactes A/CNAME/TXT affichées à ce moment, pas une adresse générique supposée. Les recommandations lues à l'audit étaient A rang1 216.198.79.1/64.29.17.1 et CNAME 40427b988b782cc0.vercel-dns-017.com. Elles doivent être revérifiées avant application. Pas de changement NS ni wildcard requis. Contrôler HTTPS et émission du certificat avant bascule.

Auth : ajouter les URLs exactes du nouveau site et reset-password.html, vérifier les callbacks des fournisseurs réellement activés, garder temporairement les anciennes URLs Auth. Le projet Supabase et son URL ne changent pas. Les sessions/préférences locales ne sont pas automatiquement transférées d'une origine à l'autre : reconnexion sur orevami.com à prévoir. Les invitations restent générées avec location.origin ; conserver les anciennes URLs et paramètres pendant transition.

Stripe : conserver les routes/webhooks et références existants pendant la transition. Modifier ultérieurement l'URL de retour de secours seulement après validation du nouveau domaine et des origines permises. Ne pas activer LIVE ni ouvrir le parcours publicitaire TEST au domaine de production.

SEO : nouvelle marque et images prêtes en Preview. URL canonique/og:url orevami.com à définir seulement lors du raccordement réel.

## Publication et retour arrière
Après validation de la Preview, obtenir séparément autorisation DNS/configuration puis production. Vérifier HEAD distant et deployment actuel ; intégrer seulement les changements concernés, jamais toute refactor-final. Sauvegarder les anciennes valeurs avant modification. Pour revenir : rétablir le précédent déploiement, les redirections temporaires et le Site URL si changé, tout en conservant les données et les URLs historiques. Redirection temporaire avant permanente ; protéger les endpoints API/webhooks contre toute redirection générale. Aucun changement de main/DNS/domaine public/Supabase Production n'est autorisé par cette livraison.
