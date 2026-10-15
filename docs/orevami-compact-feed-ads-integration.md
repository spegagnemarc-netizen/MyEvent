# Fil compact + régie V1 — intégration TEST

Base : Production f097fef14ba2e0cbc0108b3edad671f8cd7d6489 (10 propositions Sortie IA).
Fil compact : reprise de 6ea6702690aaf245e09e6df61589db96010d491a.
Régie source : refactor-final, eb7a2921a81a1285c1d628198f8df581b0c1cdf1.

## Périmètre

Photos/galeries/vidéos 250 px, visionneuse photo ×, zoom 1–4× et restauration du défilement. Les encarts sponsorisés sont distincts des publications : au maximum deux, espacés d'au moins cinq publications. Image, titre, description et bouton HTTPS, sans HTML fourni par l'annonceur. Les nœuds des publications et leurs gestionnaires sont conservés. Les encarts existants sont réutilisés quand leur contenu ne change pas.

Reprise ciblée de ads-runtime.js, ads-providers.mjs, ads-handler.js, ads.css et des trois migrations Ads, sans les autres changements de refactor-final. L'administration existante reçoit uniquement l'onglet Publicités. Aucun nouveau paquet ni endpoint Vercel. L'API publicitaire est dispatchée depuis create-payment-session ; la route de suppression d'événement reste intacte. Les fichiers Sortie IA, recherche, sélection/chargement d'événement et leurs configurations restent identiques à Production.

## Permissions et configuration

Le serveur refuse toute régie hors du projet TEST ahyyknfjsielnqyoxqgh ; l'interface est limitée aux Previews TEST. Les RPC s'exécutent avec le jeton utilisateur : les droits administrateur, la propriété des campagnes et la validation sont contrôlés par PostgreSQL. Les visuels restent dans le bucket privé ad-media. Aucun accès direct aux tables publicitaires, aucune migration réexécutée, aucune modification distante de données dans cette intégration.

La documentation source rapporte les trois migrations déjà appliquées à TEST le 12 octobre. Ce rapport historique n'est pas une nouvelle vérification de la base distante : l'état courant doit être confirmé via une session administrateur TEST. Les fichiers SQL sont archivés ici pour dépendances/audit, jamais exécutés au déploiement. Dépendances : myevent_is_admin(), myevent_account_active(), tables administrateur, auth.users et storage.

Au contrôle des variables Vercel, aucune SUPABASE_SERVICE_ROLE_KEY n'existe pour Preview. La clé de Production n'est ni copiée ni utilisée. Conséquences : signature des images pour diffusion et statistiques persistantes non opérationnelles tant qu'une clé serveur du projet TEST n'est pas configurée de façon sécurisée sur cette seule branche. L'interface signale ce manque. Aucun compteur n'est inventé ; les mesures nécessitent également l'opt-in facultatif et la visibilité du cadre.

La validation d'un parcours réel (soumission, modération, image signée, diffusion, mesure) nécessite un compte fictif et un administrateur TEST ; elle n'a pas été simulée comme preuve distante.

## Offres et paiements

Les tarifs affichés proviennent exclusivement du catalogue existant. Aucun tarif ajouté par cette intégration. La dernière régie source utilise Bienvenue, Découverte, Visibilité, Premium et Professionnel. Essentiel existe dans V1 mais est archivée par sa migration : l'interface le signale, sans tarif ni souscription inventés. Sa réactivation et ses conditions nécessitent une décision explicite ; aucune donnée du catalogue n'est modifiée ici.

Les paiements sont bloqués côté serveur par défaut, même si un administrateur coche un réglage SQL. L'indicateur MYEVENT_ADS_TEST_PAYMENTS_ENABLED est absent et n'est pas créé. Aucune clé Stripe ajoutée, aucune requête Stripe, aucune modification du webhook existant. L'adaptateur historique est conservé dormant ; son raccordement au webhook et un parcours Stripe TEST devront être validés avant une future activation autorisée. Ne pas activer ce drapeau dans le cadre de cette livraison.

AdSense reste un adaptateur non instancié : aucun script Google ni faux encart Google. Approbation du site, configuration réelle, CMP/consentement et autorisation de Production restent nécessaires. AdMob reste indisponible.

## Vérification limitée

Sept nouveaux contrôles d'intégration en DOM/transport simulés : coexistence des médias et annonces, conservation des nœuds et interactions, isolation des comptes/consentement/géographie, absence d'appels Ads en Production, manque de configuration explicite, refus administrateur, verrou de paiement et conservation des routes récentes. Aucun accès Geoapify/OpenAI/Stripe, aucun ancien cycle de tests rejoué.

Les largeurs et la hauteur sont bornées en CSS ; aucune validation visuelle Safari iPhone physique ni mesure de fluidité réelle effectuée. À vérifier sur la Preview avec le compte TEST : fil long, photo/zoom/fermeture, vidéo/galerie et accès administrateur. Aucune annonce réelle ni facturation n'est activée.
