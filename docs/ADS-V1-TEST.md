# Régie MyEvent V1 — TEST uniquement

La livraison sur `refactor-final` ne publie aucune annonce ni facturation réelle. Le serveur refuse les opérations de régie en Production et exige le projet TEST `ahyyknfjsielnqyoxqgh`. Aucun secret ni variable Vercel n'est modifié.

## Activation restant nécessaire

1. Après autorisation explicite, appliquer `supabase/migrations/202610100001_ads_v1_test.sql` exclusivement dans MyEvent-Admin-Test. Ne pas appliquer cette migration en Production. Elle dépend de `myevent_is_admin()`, `myevent_account_active()` et des tables de contrôle administrateur existantes. Les tests locaux PostgreSQL utilisent des comptes simulés et ne prouvent pas que la migration a été appliquée à distance.
2. Connexion avec le véritable compte administrateur TEST : Administration → Publicités. Renseigner prix EUR et durées des formules Découverte, Essentiel, Visibilité et Premium. Les montants restent vides par choix utilisateur ; aucune promesse de performance ou de contenu des forfaits n'est inventée.
3. Profil → Publicité professionnelle · TEST : déclarer l'activité professionnelle, saisir le contenu et le site HTTPS, puis soumettre. Toute campagne débute en attente. Le serveur ignore les champs d'approbation, de propriétaire, de tarif ou de paiement injectés par le client.
4. L'administrateur valide ou refuse, avec motif, puis peut suspendre. Le prix et la durée sont figés lors de la première validation. Une campagne approuvée et non payée propose Stripe TEST.
5. Configurer, si nécessaire, les identifiants Stripe TEST via les paramètres sécurisés du service : clé `sk_test_…`, webhook TEST signé vers `/api/stripe-webhook`, événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`. Ne pas transmettre les clés dans le chat. Le rôle serveur Supabase TEST est requis pour les confirmations et compteurs. Aucun paiement réel n'est accepté par le parcours publicitaire.
6. Après confirmation signée du paiement, activer les publicités directes TEST dans l'administration pour vérifier le fil. Un retour de navigateur Stripe n'est jamais une preuve de paiement. Sans signature, montant exact, devise EUR et session TEST, aucun paiement n'est enregistré.

## Fonctionnement et limites explicites

- Forfait fixe par campagne, pas de facturation par clic ou impression. Dépenses = montant réellement confirmé par le webhook ; revenus directs = somme de ces forfaits TEST, pas un montant bancaire net après frais. Les statistiques ne sont pas certifiées anti-fraude et ne servent pas à débiter un budget.
- Seules les campagnes validées, payées, non expirées, non suspendues et appartenant à un compte actif sont diffusées. Deux annonces au maximum, à partir de cinq publications ; espacement configurable de 5 à 30. Aucune publication n'est remplacée.
- Créations limitées à dix par compte et par jour. Endpoints limités à quarante appels par minute et par compte sur chaque instance. Les verrous et limites en mémoire ne constituent pas une protection anti-fraude distribuée : compléter par une limite de plateforme avant une ouverture publique.
- La mesure facultative est désactivée à chaque chargement. Une impression est déclarée après au moins 50 % de visibilité pendant une seconde, page visible. Les clics sont comptés uniquement après opt-in. Aucun cookie de ciblage, profil d'intérêts, GPS, adresse IP ou identifiant d'utilisateur n'est stocké avec ces compteurs agrégés. Des identifiants d'authentification restent brièvement en mémoire (une minute pour le contrôle d'abus, cinq minutes pour les reçus). Les compteurs peuvent sous-estimer lors des redémarrages/changements d'instance et ne doivent pas être présentés comme une mesure auditée.
- Le consentement MyEvent à cette mesure n'est PAS une CMP Google et n'autorise pas le chargement d'AdSense. Refuser la mesure ne bloque pas la consultation du fil ni des campagnes.
- Pas d'upload de créations graphiques V1 : campagnes texte avec lien HTTPS, toujours marquées « Sponsorisé ». Pas de ciblage personnel.
- Les propriétaires consultent leurs campagnes ; les autres comptes ne voient que le contenu public de diffusion. Les tables n'accordent aucun accès direct aux rôles anon/authenticated : RPC contrôlées, RLS activée et rôle administrateur vérifié côté PostgreSQL. Un compte suspendu est refusé, même avec un ancien jeton.
- Le rôle service seul peut confirmer les paiements et modifier les compteurs. Confirmation idempotente : même session acceptée une seule fois, seconde session refusée. Les changements de prix ultérieurs n'affectent pas les campagnes déjà validées.
- Le paiement reste conditionné à la validation. Remboursements, litiges, factures fiscales, budget CPC, renouvellements et modifications de campagnes approuvées ne sont pas proposés. Traiter ces parcours avant facturation publique.
- Revenus AdSense/AdMob : saisie administrative manuelle, identifiée comme déclaration, jamais comme synchronisation ou revenu confirmé par Google. La future synchronisation nécessite l'API et l'autorisation du compte de régie.

## AdSense / AdMob

`js/ads-providers.mjs` prépare le contrat de fournisseur. AdSense exige une autorisation Production explicite, de vrais identifiants éditeur/emplacement et le consentement positif d'une CMP configurée. Il ne se charge jamais sur cette Preview. Le module n'est pas activé par l'interface V1 : aucun faux encart Google, script Google ou appel publicitaire n'est émis. La CMP doit être certifiée Google et intégrée au TCF ; une simple case à cocher ne suffit pas. Pour activer ultérieurement : obtenir l'approbation du site AdSense, choisir une CMP certifiée, renseigner les identifiants publics, vérifier les callbacks TCF et le retrait de consentement, puis demander une autorisation de mise en Production. Le retrait bloque les nouveaux montages et retire les encarts ; les requêtes déjà émises ne peuvent pas être annulées rétroactivement.

AdMob est explicitement indisponible : une future application native nécessite le SDK, le SDK UMP et les identifiants AdMob. Pas de SDK web prétendant faire fonctionner AdMob.

Références :
- https://support.google.com/adsense/answer/13554116
- https://docs.stripe.com/payments/checkout/fulfill-orders
- https://docs.stripe.com/testing

## Vérification

- `node --test tests/ads-server.test.mjs tests/ads-providers.test.mjs tests/stripe-webhook.test.mjs`
- `node tests/ads-rls.mjs` : véritable moteur PostgreSQL isolé PGlite, aucun accès Supabase distant.
- `node tests/ads.browser.cjs` : données explicitement simulées, consentement, fil conservé, dépôt en attente, administration, 320/375/390/430 px et absence de scripts Google.
- `node tests/admin-v2-ui.test.mjs` et `node tests/home-events-access.browser.cjs` : régressions des interfaces existantes.

Safari iPhone physique et flux Stripe/Supabase TEST réels restent à contrôler après activation. Ne pas qualifier les captures simulées de preuve de paiement ou diffusion réels.

L'application conserve 12 fonctions Vercel : le nouveau traitement utilise l'endpoint de paiement existant et le webhook existant. Le serveur publicitaire est interdit par les routes statiques. Aucun fichier Sabre ni MyEvent-API n'est modifié.
