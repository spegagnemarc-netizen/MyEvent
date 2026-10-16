# Publication du fil TEST — correction de l'accès au formulaire

Base exacte : Preview 6e5163e6a1acb95fa57422ae16a92e379bd79475, branche réelle integrate/compact-feed-ads-test (et non fix/outing-plan-active-event).

## Défaut confirmé

Après connexion visible du compte fictif test-b dans ahyyknfjsielnqyoxqgh, l'accueil ne présente aucun accès au formulaire de publication. Dans inline-extracted.css, deux règles `display:none!important` masquent inconditionnellement socialComposer et socialComposerPanel. La classe `.open` posée par le bouton ne peut donc pas rendre le formulaire visible.

Ces règles existent déjà au commit historique c63cd88, avant l'intégration du fil compact. Le chemin d'insertion des textes et celui de publication photo sont identiques à la Production de base ; la dernière intégration a seulement remplacé le gestionnaire d'ouverture de photo.

## Correction minimale

Rendre l'accès au compositeur visible et compact ; garder le formulaire fermé au repos, puis visible avec `.open`. Préserver les gestionnaires existants et le brouillon en cas d'erreur. Actualiser la version CSS pour éviter le cache de l'ancien masquage.

Aucun changement JavaScript de publication, aucun changement SQL, RLS ou bucket ; aucun changement de session, de cadre publicitaire, de modération, de paiement, d'AdSense ou de Sortie IA.

## Contrôles et limites

Quatre contrôles ciblés simulés : styles visible/fermé/ouvert et annulation, insertion avec l'auteur de session et actualisation, refus de permission conservant le brouillon et libérant le bouton, absence de session sans insertion. Aucun appel externe dans ces tests.

La session TEST réelle a été confirmée visuellement. L'essai Galerie a ensuite été bloqué par la protection des données d'authentification du navigateur, avant téléversement. Aucune publication réelle, aucun upload ni validation distante des RLS n'ont donc été effectués. Ce correctif résout l'accès au formulaire confirmé ; il ne constitue pas la preuve que tout envoi photo fonctionne sur iPhone.

Relecture statique : textes vers event_feed_posts (author_id de session, event_id absent autorisé par la politique versionnée) ; photos vers social-media sous user_id et social_posts, avec les politiques de propriété versionnées. L'installation effective de ces politiques/bucket et les éventuelles erreurs HTTP de publication restent à vérifier dans une session distante exploitable. Une clé serveur publicitaire n'est pas requise pour ces publications, qui utilisent le jeton de l'utilisateur.

Production, main et Supabase distant inchangés. Nouvelle Preview exclusivement TEST pour rendre le contrôle utilisateur possible.
