# ORÉVAMI — audit ciblé confidentialité / Google Play

Date : 23 octobre 2026. Branche exclusive : `refactor-final`. Base examinée : `9e8adcc5098050c9062ecc2e28201844c00482ed`.

## Portée et niveau de preuve

Vérifié signifie ici constaté dans les sources de cette révision, pas fonctionnement certifié en production. Aucun compte, message, paiement, base distante, configuration Auth ou donnée réelle consulté ou modifié. Aucun build Android, envoi d'e-mail ni soumission Play lancé. L'état d'activation distant est à confirmer. Le rapport du 8 octobre documente des tests déjà réussis ; ils ne sont pas relancés et ne prouvent pas l'état actuel des bases. Il indiquait notamment Stories/DM/Défis absents du TEST à cette date.

La politique `privacy.html` est un projet complet de structure, explicitement non publiable en l'état. Identité juridique, adresse, bases légales finales, conservation, contrats/transferts et fonctionnement de l'effacement restent à compléter par le responsable. Les pages ajoutées ne valent ni CGU ni mentions légales définitives.

## Inventaire factuel

| Traitement | Données / destinataires / support | Preuve dans le dépôt | État |
|---|---|---|---|
| Compte et récupération | E-mail, mot de passe transmis à Supabase Auth, identifiant et session ; prestataire d'e-mail Auth à identifier | `js/core-runtime.js` : signUp, signInWithPassword ; `js/password-recovery.mjs`, `reset-password.html` | Code branché ; fournisseurs OAuth non démontrés, e-mail réel non testé |
| Profil | Nom affiché, pseudonyme, avatar, identifiant ; utilisateurs selon accès ; image d'avatar avec URL publique | `js/core-runtime.js` : profiles.upsert, bucket profile-avatars.getPublicUrl | Code branché ; politiques distantes et suppression des anciens avatars à confirmer |
| Événements et organisation | Noms, dates, lieux, visibilité, membres/rôles, invitations, tâches, matériel, planning, messages, sondages/votes, lectures | `js/core-runtime.js`, `js/discussion-runtime.js`, `js/tasks-runtime.js`, migrations event roles/tasks | Code branché ; schéma de base historique non entièrement décrit par les migrations présentes |
| Position | GPS précis, précision, date, position locale mémorisée, adresse saisie ; membres d'événement / amis si partage ; services de carte et recherche | core-runtime : updateMyLocation/event_locations ; home-social-runtime : social_locations ; migration social_locations ; map-runtime | Sur action utilisateur ; pas de preuve de suivi natif en arrière-plan. Mode événement « approx » arrondit à l'affichage mais écrit les coordonnées exactes : point bloquant avant toute promesse de minimisation |
| Recherche et cartes | Zone, coordonnées, requête, dates/critères de recherche ; IP lors de contacts directs | `js/map-runtime.js`, `api/search-places.js`, `lib/activity-venue-search.js`, `lib/geoapify-restaurants.js`, home-social-runtime | OSM/Overpass, Photon/Komoot, Nominatim, Geoapify ; fonds Esri/OpenTopoMap ; géocodage/météo externes selon fonction |
| Activités et rencontres | Titre, description, adresse/GPS, photo, participants/demandes, signalements, contrôle d'accès adulte | `js/activities-runtime.js` : activities_capabilities et garde adulte ; `docs/activities/README.md`, proposal.sql | Interface branchée ; activation et migrations à confirmer ; une proposition SQL n'est pas une preuve d'installation. Retrait logique et visibilité ne prouvent pas purge physique |
| Social | Amis, invitations, publications, réactions, commentaires, Stories/photos/vidéos, messages privés et lectures | home-social-runtime, social-friends-stories, social-inbox ; migrations friends_stories/social_inbox/feed_interactions | Code branché ; destinataires selon relations/visibilité. Stories expirent en lecture après 24 h ; aucune purge planifiée complète des fichiers démontrée |
| Médias | Photos, vidéos, voix enregistrée, chemins fichiers et métadonnées ; stockage Supabase et destinataires choisis | core-runtime : event-media, MediaRecorder ; home-social-runtime, social-friends-stories ; camera-capture2-final | Transmission quand publication/envoi ; permissions OS ne valent pas consentement à tous les usages |
| Appels | Audio/vidéo en direct ; signalisation Supabase Realtime, adresses réseau/ICE aux pairs et STUN Google/Cloudflare | core-runtime : RTCPeerConnection, getUserMedia, call channels | Implémenté ; pas de TURN ni enregistrement serveur d'appel identifié dans ce parcours ; fonctionnement appareil non vérifié |
| Visage et effets | Repères de visage pour composition d'effets, traitement local ; modèle MediaPipe fourni localement | camera-face-engine/worker, assets/vendor/mediapipe | Ne prouve pas une identification biométrique ; distinguer ce traitement local des photos envoyées à OpenAI |
| IA | Photo portrait pour avatar/filtres ; nom/contexte d'événement, extraits de messages, nombre de nouveaux membres (pas leurs identités dans le payload summarize-event), sondages/résultats, requêtes/planning/matériel/tâches/musique | api/generate-avatar, camera-ai, summarize-event, analyze-poll, generate-materials, generate-outing-plan, search-music ; server/tasks-ai-handler | Appels OpenAI présents ; clé/activation distante et contrat/région/rétention non contrôlés. Pas de garantie « aucune conservation chez l'IA » |
| Musique et jeux | Recherches, titres, files, votes, scores/parties/défis, identité des participants ; YouTube et IA selon parcours | js/music-*, entertainment-lounge, migrations music/games, api/search-music | Code branché ; SDK AdMob non intégré. Navigation/lecteur YouTube peuvent transmettre IP et signaux techniques |
| Marketplace | Annonces, photos, prix, favoris, échanges, identité de contact ; acheteurs/vendeurs concernés | js/marketplace.mjs, marketplace-data.mjs, migration marketplace | Code branché ; aucun paiement Marketplace opérationnel déduit de la simple présence de prix |
| Documents location | Identité, adresse, contact propriétaire/locataire, matériel, prix, caution, observations, lieu/date signature ; export PDF/impression | js/rental-documents.mjs et rental-pdf.mjs | Génération locale ; pas de preuve d'envoi automatique du formulaire au serveur, signatures manuscrites prévues sur papier |
| Réservations et justificatifs | Coordonnées/références et détails saisis, dates, trajet/destination, montant, fichier PDF/image encodé ; compte seul ou événement si rattachement/partage | personal-reservations.js, reservation-link-runtime.js, migration personal_reservations | Tables personal_reservations.details ou messages.content ; supprimer seulement Storage ne suffit pas |
| Cagnottes et paiement | Contributions/dépenses, montant/statut, libellé/note, titulaire, IBAN/BIC/note de paiement ; responsables/membres selon droits ; Stripe pour Checkout | core-runtime : event_fund_entries/event_fund_payment_details ; api/create-payment-session et stripe-webhook | Ne pas déclarer « aucune donnée financière ». Carte saisie chez Stripe ; mode LIVE/TEST de la cagnotte à confirmer sans appeler Checkout |
| Partenaires | IP, navigateur, pages, recherches/critères transmis à des scripts/iframes et liens d'affiliation | index.html : GetYourGuide, Expedia, Omio, TicketNetwork/CJ ; explorer-partners* | Scripts tiers chargés sans preuve de blocage préalable global par consentement. Les onglets masqués ne garantissent pas absence de requêtes |
| Publicité ORÉVAMI | Entreprise, contact/compte, visuels, zone départementale manuelle, campagne, paiements TEST ; mesure facultative | ads-runtime, ads-providers, server/ads-handler, migrations ads | Garde Preview/projet TEST explicite ; AdMob indisponible, AdSense nécessite configuration et CMP confirmée. Ne pas généraliser ce garde aux widgets partenaires |
| Notifications / technique | Lectures, activité sociale, Realtime/polling, session et préférences locales ; IP/journaux d'hébergement possibles | core-runtime : refreshNotifications/getDeviceId ; runtime-config ; App.tsx | Pas de SDK push natif trouvé ; UUID local « myevent_device_id » sert aux clés de lecture, aucune transmission trouvée de cet UUID dans ce parcours. Logs Vercel/Supabase à confirmer |

## Android Expo / EAS

Sources vérifiées : mobile/app/app.json, app.config.js, eas.json, package.json, src/App.tsx, src/config.ts, camera/CameraScreen.tsx. L'application est une WebView avec caméra photo native, sélecteur photo, DeviceMotion pour niveau et secours web. La WebView autorise géolocalisation et cookies partagés, désactive les cookies tiers ; cela ne neutralise pas les requêtes des scripts tiers.

Permissions explicitement configurées : CAMERA, RECORD_AUDIO, ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION. expo-camera déclare recordAudioAndroid=false mais RECORD_AUDIO reste explicitement demandé pour les autres usages. Dépendances image-picker/sensors peuvent contribuer des permissions au manifeste fusionné : stockage/médias et ACTIVITY_RECOGNITION sont à contrôler sur l'AAB final. Ne pas confondre permission capteur et collecte de santé ; aucun suivi fitness trouvé. Pas de ACCESS_BACKGROUND_LOCATION explicitement configuré ni SDK push/AdMob dans package.json. SYSTEM_ALERT_WINDOW est bloqué en Release, allowBackup=false, mises à jour Expo désactivées.

Release : nom ORÉVAMI, identifiant app.myevent.mobile ; TEST : .dev. La cible WebView par défaut reste un ancien domaine Vercel, pas le domaine annoncé par l'utilisateur. Ne pas la changer sans vérification des services Auth et de la cible. Les profils EAS présents produisent des APK internes, dont release-private sans credentials : aucun profil AAB Play prêt à soumettre démontré. Le rapport Android historique décrit une signature Debug de test ; aucune signature Play actuelle vérifiée. Tests existants release.test.mjs attendent encore MyEvent/MyEvent TEST : obsolescence constatée, suite non relancée. VersionCode/historique Play, cible Android effective, manifeste final, signature, refus/retrait des permissions sur appareil à vérifier avant diffusion.

## Suppression de compte : état et procédure à valider

Avant correction : aucune page ni bouton de demande de suppression trouvé ; aucun service d'effacement complet Auth + base + fichiers présent. La déconnexion et la suppression d'un événement ne suppriment pas le compte.

Correction minimale : page publique autonome `delete-account.html`, liens avant connexion et dans le profil, demande explicite par e-mail. Le bouton ouvre le logiciel de messagerie ; aucun e-mail envoyé automatiquement, aucun accusé d'exécution fictif. Le traitement humain par contact@orevami.com doit être confirmé avant toute déclaration Play « suppression disponible ». Une page protégée par authentification Vercel n'est pas une URL publique Play acceptable.

Runbook proposé pour l'opérateur, NON exécuté :

1. Recevoir la demande depuis l'adresse du compte, vérifier l'identité de façon proportionnée, sans demander mot de passe ni pièce d'identité par défaut. Confirmer le périmètre et les conséquences sur événements partagés, cagnottes, réservations et contenus.
2. Cartographier les références effectives du compte, les droits et cascades dans le schéma installé ; choisir transfert d'organisation, effacement ou anonymisation réelle des contenus partagés. Fixer les exceptions légales et leurs durées avec justification, accès restreint et information de la personne.
3. Révoquer les sessions ; prévoir le traitement des JWT encore valides. L'effacement Auth seul ne révoque pas instantanément tous les jetons et ne purge pas tous les fichiers.
4. Traiter fichiers profile-avatars/event-media/story-media/social/marketplace/activités et autres buckets réellement présents, y compris anciens fichiers et fichiers orphelins. Purger aussi pièces jointes encodées dans messages.content/personal_reservations.details ; vérifier les événements possédés et contenus sans FK explicite.
5. Effacer/anonymiser les données couvertes et le compte Auth via un opérateur habilité ; contrôler les erreurs/cascades. Pas de script destructif générique déduit de migrations partielles.
6. Définir le sort des sauvegardes, journaux, obligations comptables et demandes aux sous-traitants ; empêcher la réintroduction des données supprimées après restauration. Confirmer à l'utilisateur ce qui est fait et ce qui est conservé pour quelle raison/durée.
7. Valider une fois ce parcours avec compte et fichiers fictifs dans TEST, puis consigner résultats. Aucun compte réel ne doit servir au test.

## Réponses proposées Google Play Data safety — brouillon, ne pas soumettre

Répondre sur l'application livrée, y compris les pages de sa WebView, les services et SDK. L'ensemble des variantes distribuées doit être couvert. Une permission seule ne prouve pas une collecte ; un transfert hors appareil, même temporaire, doit être examiné. Le code présent n'établit pas l'activation distante.

| Question / catégorie Play | Proposition | Certitude / réserve |
|---|---|---|
| Collecte ou partage de données ? | Oui | Compte/profil et contenus transmis à Supabase dans les parcours implémentés |
| Création de compte | E-mail et mot de passe | Vérifié dans le code ; pas d'OAuth à cocher sans preuve |
| Informations personnelles | Nom, adresse e-mail, ID utilisateur ; adresse et téléphone selon documents/réservations/contacts effectivement envoyés ; autres informations saisies si pertinentes | Nom/e-mail/ID vérifiés ; champs document local seul à exclure tant qu'ils ne quittent pas l'appareil |
| Position approximative et précise | Collectées si fonctions GPS utilisées ; facultatives pour ces fonctions | Le GPS précis est écrit même avec certains modes d'affichage approximatif ; ne pas ne déclarer que l'approximative |
| Informations financières | Informations de paiement (titulaire/IBAN/BIC), historique d'achats/transactions/contributions si parcours activé | Vérifié code cagnotte/Stripe ; préciser carte gérée chez Stripe ; exceptions de paiement à analyser, pas d'exclusion globale |
| Messages | Autres messages intégrés à l'application | Discussions/DM, contenu et lectures ; pas « e-mails » pour la seule adresse de connexion |
| Photos et vidéos | Photos et vidéos | Publication, Stories, profil et photos IA ; facultatives par fonction |
| Fichiers audio | Enregistrements vocaux ou audio | Voix/messages/appels ; éphémère des flux d'appel à confirmer avec fournisseurs ; ne pas dire tous les médias éphémères |
| Fichiers et documents | Oui si justificatifs téléversés/encodés | PDF/images dans réservations/messages ; documents générés seulement en local à distinguer |
| Activité dans l'application | Interactions avec l'application et autre contenu généré par l'utilisateur ; historique de recherche dans l'application si recherches transmises | Votes, réactions, favoris, parties, contenus, critères de recherche ; qualifier séparément chaque usage |
| Contacts (carnet d'adresses de l'appareil) | Pas de collecte trouvée | Relations d'amis internes ne sont pas une preuve d'accès au carnet d'adresses. Aucun permission/SDK Contacts trouvé |
| Santé et activité physique | Pas de collecte de santé trouvée | DeviceMotion pour niveau caméra ne suffit pas à cocher fitness ; vérifier manifeste et SDK final |
| Navigation Web | À confirmer | Scripts/widgets tiers et navigation WebView ; inspecter requêtes/référents et pratiques fournisseurs |
| Informations appareil / autres ID | À confirmer | UUID local non transmis dans le parcours lu ; IP/SDK/identifiants cookies tiers et journaux à vérifier |
| Diagnostics / autres performances | À confirmer | Journaux d'hébergement et SDK : aucune garantie d'absence fondée sur le seul code applicatif |
| Données partagées | À décider par catégorie après revue des destinataires et contrats | Supabase/Vercel/OpenAI/Stripe peuvent être sous-traitants selon contrat ; exception « prestataire » Play à justifier. Les actions volontaires de partage utilisateur peuvent relever d'une exception Play. Widgets/affiliation indépendants ne sont pas automatiquement exemptés. Ne pas cocher « aucun partage » |
| Finalités | Fonctionnement de l'app ; gestion des comptes ; communications développeur pour support ; sécurité/prévention fraude si démontrées | Analyses uniquement pour mesures réellement activées ; publicité/marketing selon widgets et campagnes ; pas personnalisation/profilage sans preuve |
| Facultatif / obligatoire | Compte nécessaire aux fonctions authentifiées ; autres fonctions choisies par l'utilisateur | À renseigner par catégorie selon possibilité réelle de refuser et d'utiliser le reste de l'app |
| Traitement éphémère | Non pour compte, contenus, position stockée, fichiers, transactions | Évaluer séparément appels/photos IA : traitement mémoire local ne prouve pas absence de rétention fournisseur |
| Chiffrement de toutes les données en transit | À confirmer, ne pas cocher Oui globalement à ce stade | HTTPS/WSS des principaux appels observés ; médias WebRTC et tous SDK/widgets à vérifier. Pas de promesse de chiffrement de bout en bout des messages stockés |
| Suppression de compte/données | Demande préparée ; fonctionnement opérationnel à valider | Ne pas cocher Oui avant réception/traitement TEST et URL publique vérifiée |
| Suppression de données sans supprimer compte | Actions partielles présentes | Certaines suppressions de contenus/position existent ; vérifier fichier associé et périmètre avant réponse globale |
| Examen de sécurité indépendant / certification | Aucun démontré | Ne pas revendiquer de badge |

## Lacunes prioritaires avant publication

1. Identifier personne morale/physique responsable, adresse et identité de la fiche Play ; confirmer contact et éventuel DPO. CGU et mentions légales finales manquantes.
2. Valider un registre de conservation réel par table, bucket, logs, sauvegardes, prestataire et exception. Expiration Stories 24 h n'est pas purge ; aucune durée générale « 30 jours / 3 ans / 10 ans » n'est inventée.
3. Valider réception et effacement complet TEST, comptes d'organisateur compris ; informer des exceptions et délais réels.
4. Revoir la collecte précise sous mode approximatif ; ne pas promettre que seules des coordonnées arrondies sont stockées.
5. Consentement avant scripts/widgets non essentiels, information au moment de l'envoi IA (y compris résumés de messages et sondages), choix de retrait et preuve de consentement à compléter. Le bandeau de mesure des annonces TEST ne couvre pas tous les tiers.
6. Relever contrats/DPA, régions, sous-traitants et mécanismes de transfert réellement applicables à Supabase, Vercel, OpenAI, Stripe et partenaires. Aucune garantie SCC/UE/absence d'entraînement déduite sans configuration et contrat.
7. Définir public visé, âge minimal, protection des mineurs et modération ; garde adulte rencontres n'est pas politique générale d'âge vérifiée. Textes libres/sondages peuvent révéler des données sensibles ; limiter leur collecte et traiter base légale et accès.
8. Sur AAB final seulement : manifeste fusionné, SDK, flux réseau, signature, package/versionCode et parcours de refus/retrait des permissions sur téléphone. Aucun nouveau build nécessaire pour cet audit documentaire.

## URLs et vérification

Le domaine annoncé par l'utilisateur n'a pas pu être chargé par l'outil Web pendant cet audit : disponibilité, politique et chemin de suppression non certifiés. Ne saisir aucune URL de production supposée dans Play. Les chemins privacy.html et delete-account.html ne deviennent des URLs validées qu'après déploiement et contrôle de la candidate ; la Preview ne remplace pas la future URL publique accessible sans authentification.

## Références officielles consultées

- [Google Play — Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=fr)
- [Google Play — suppression de compte](https://support.google.com/googleplay/android-developer/answer/13327111?hl=fr)
- [CNIL — information des personnes](https://www.cnil.fr/fr/informer-les-personnes)

Ces sources définissent les informations à fournir ; elles ne certifient pas ORÉVAMI. Les propositions de bases légales de la politique restent à faire adopter par le responsable.

## Vérification ciblée de cette livraison

Un seul cycle local exécuté : git diff --check et 35 assertions ciblées réussies (structure des pages FR, affichage mobile déclaré, absence de scripts/iframes/formulaires/collecte dans les nouvelles pages, cibles de liens locales, destinataire/objet/corps de demande, accès avant connexion et depuis le profil, permissions explicites et identité/contrôles Release). Aucun test général ni test historique relancé. Ces contrôles ne vérifient ni rendu sur téléphone, ni réception de la demande, ni effacement effectif, ni manifeste Android fusionné. Les nouvelles pages statiques ne contactent aucun service hors ouverture volontaire d'un lien.

Complément fournisseurs constatés : Open-Meteo (coordonnées pour météo/géocodage), OSRM (trajets/coordonnées), adaptateur Viator pour recherche d'activités ; adaptateurs de transport SNCF/Amadeus et Sabre présents, activation non déduite du code. Sabre était documenté en pause. Les CDN unpkg/jsDelivr et ressources externes peuvent recevoir des données techniques ; vérifier leur qualification et minimisation au même titre que les widgets.
