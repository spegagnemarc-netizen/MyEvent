# Publication photo TEST — cause et correction

Base Preview : ffeeeb459e3a36b53a4897f7c9cf0c618bb21d4c. Projet exclusivement TEST ahyyknfjsielnqyoxqgh (MyEvent-Admin-Test, Paris), vérifié par le connecteur Supabase.

## Cause confirmée

Les tentatives réelles de la vidéo du 16 octobre 2026 correspondent à deux POST Storage HTTP 400, à 00:56:51 et 00:56:53 UTC, vers /storage/v1/object/social-media/…-feed.jpg. Les prévols OPTIONS répondent 200. La capture et le clic atteignent donc le téléversement ; l'échec n'est pas le formulaire texte précédemment masqué.

La lecture de storage.buckets confirme l'absence de social-media ; aucune politique de propriété de ce bucket n'existe. public.social_posts existe, possède les privilèges authenticated nécessaires et les politiques auteur=auth.uid(). L'erreur intervient avant l'insertion de la publication. Le code de publication est antérieur à l'intégration du fil compact.

## Correction effective TEST

Migration enregistrée par Supabase : 20261016023613_restore_social_media_test_storage. Création du seul bucket manquant, privé, limite 15 Mio, JPEG/PNG/WebP, et des trois politiques propriétaire (SELECT/INSERT/DELETE). Aucun upsert ni droit UPDATE ajouté. La politique restrictive admin_account_active_v2 est préservée. Les autres buckets, tables, politiques et projets restent inchangés. L'export SQL versionne la migration distante existante ; aucun script ne l'applique automatiquement au déploiement.

Relecture après application : bucket privé présent, trois politiques de propriété présentes et protection restrictive des comptes toujours active. Conseillers de sécurité consultés, aucun signal concernant social-media/social_posts ; aucune correction hors périmètre effectuée.

## Retour utilisateur et affichage

Message de progression visible pour préparation, stockage et enregistrement. Erreurs françaises avec codes filtrés, sans texte brut ni URL fournisseur, dans un statut d'alerte au-dessus de l'image. La capture est conservée après erreur, les doubles clics sont bloqués. Après confirmation de l'insertion, affichage immédiat de la capture disponible et confirmation « Photo publiée dans le fil. ». La réussite ne dépend plus d'une seconde requête de relecture/signature susceptible d'échouer après l'enregistrement. Une actualisation utilisera toujours les URLs signées du bucket privé.

Aucun changement Sortie IA, sélection des événements, fil compact, visionneuse, publicité, modération, Stripe ou Production.

## Vérification

Quatre contrôles ciblés simulés réussis : capture absente, refus Storage avec code sans fuite, refus RLS et double clic, insertion confirmée sans dépendance à une relecture. Contrôle syntaxique des deux fichiers JS. Aucun test des jeux ni fournisseur externe.

Validation réelle en cours : le navigateur a confirmé le compte fictif test-b, puis sa protection native a bloqué l'import du visuel avant téléversement. Aucune publication fictive n'a été créée par l'agent. Une seule publication est demandée depuis l'iPhone connecté pour pouvoir confirmer Storage, insertion et affichage après actualisation. Ne pas qualifier le parcours de résolu avant cette confirmation.
