# Régie MyEvent — cinq offres de lancement

Branche : `refactor-final`. Aucun changement de `main`, de Supabase production, des variables Vercel, de Sabre ou de MyEvent-API. Aucun Stripe LIVE.

## Tarifs validés par le propriétaire

| Offre | Durée initiale | Prix initial |
| --- | --- | --- |
| Bienvenue | 15 jours | Gratuit |
| Découverte | 7 jours | 1,99 € |
| Visibilité | 15 jours | 4,99 € |
| Premium | 30 jours | 9,99 € |
| Professionnel | 30 jours | 19,99 € |

Les valeurs résident dans `ad_plans`, modifiables par l'administration. Bienvenue reste gratuite. Les modifications ultérieures ne changent pas rétroactivement les prix/durées déjà figés à l'approbation. L'ancienne formule Essentiel reste référencée par ses campagnes historiques mais n'est plus vendue. Une nouvelle exécution de la migration ne réécrit pas les tarifs administratifs existants.

Le lancement conserve l'emplacement déjà développé : fil d'accueil, insertion espacée d'au moins cinq publications. Aucun nouvel emplacement Événements intrusif n'est ajouté. Par défaut : un visuel et ciblage par département, modifiables dans l'administration jusqu'à quatre visuels et ciblage national. Ces options ne constituent pas de nouvelles conditions commerciales validées ; elles restent à configurer. Statistiques : impressions, clics, CTR, période et état. Renouvellement manuel uniquement.

## Audit de la base antérieure (commit 9242b48)

| Fonction | État avant ce complément |
| --- | --- |
| Interface professionnelle et création textuelle | Implémentées en TEST ; dépendantes d'une migration non installée dans le projet distant consulté |
| Modification, visuels et aperçu | Absents |
| Quatre offres et édition administrative des prix/durées | Implémentées ; tarifs et durées non renseignés |
| Modération, suspension et réactivation | Implémentées avec RPC réservées aux administrateurs |
| Validation du paiement par webhook signé | Implémentée ; retour navigateur non utilisé comme preuve |
| Tentatives, session expirée et historique Stripe | Incomplets |
| Diffusion | Fil d'accueil seulement, campagne approuvée/payée/non expirée |
| Ciblage géographique | Absent |
| Statistiques | Compteurs agrégés avec opt-in ; déduplication limitée à une instance serveur |
| AdSense | Adaptateur dormant, configuration de production/CMP/consentement requise ; pas connecté |
| AdMob | Non opérationnel ; SDK natif/UMP absent |

## Complément développé

- Visuels JPEG/PNG/WebP : aperçu local, décodage puis export JPEG proportionnel (1600 px maximum, 2 Mo par visuel). Envoi dans un bucket privé `ad-media`, sous dossier du propriétaire, sans écrasement. Lecture auteur/administrateur, URLs de diffusion signées limitées à 120 secondes.
- Modification des campagnes impayées en attente/refusées, avec nouvelle validation. Aucune modification d'une campagne déjà payée. Liens HTTPS sans identifiants ; validations SQL des champs et de la propriété des images.
- Filtrage par département choisi manuellement par le lecteur, sans GPS. En l'absence de département, seules les campagnes nationales sont éligibles.
- Dates de début/fin, programmation administrative pour les campagnes payées, retrait client au moment de l'expiration et contrôle serveur des dates.
- Historique des tentatives TEST ; réservation transactionnelle d'une tentative active par campagne, réutilisation d'une session Stripe ouverte, nouvelle tentative après expiration. Paiement toujours confirmé par webhook signé avec montant/devise/session enregistrée vérifiés.
- Échecs et expiration Stripe enregistrés côté serveur ; un retour « annulé » du navigateur ne constitue pas un événement Stripe signé et ne modifie pas le paiement.
- Bienvenue : approbation réservée à un administrateur après vérification de l'annonceur. Identifiant d'entreprise vérifié enregistré par l'administrateur (SIREN, 9 chiffres). Unicité du compte et de l'identifiant professionnel ; un second compte ne permet pas une seconde offre pour la même entreprise. Aucun Checkout/carte, aucune inscription récurrente, aucune extension de période lors d'une réactivation. Usage consommé lors de la première approbation.
- Journal des actions et filtre de statut ; statistiques avec jeton signé, lié au compte actif et valable cinq minutes. Déduplication persistante conservatrice : une impression et un clic maximum par campagne/compte/jour, indépendamment des redémarrages serveur. Clé pseudonyme sans IP/GPS/profil stocké, supprimée après deux jours lors du prochain comptage. Aucun appel de mesure sans opt-in. Pas de Google activé.

Les [requêtes Stripe idempotentes](https://docs.stripe.com/api/idempotent_requests) sont complétées par un registre local des tentatives, notamment pour les [sessions expirées](https://docs.stripe.com/api/checkout/sessions/expire). Le stockage utilise les règles d'un [bucket Supabase privé](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## Environnement et migrations

Projet distant vérifié par le tableau de bord et une requête de lecture : **MyEvent-Admin-Test**, `ahyyknfjsielnqyoxqgh`. Les fonctions `myevent_account_active()` et `myevent_is_admin()` existent. Les tables `ad_plans`/`ad_campaigns` et la RPC `myevent_ads` sont absentes au moment de l'audit.

Migrations nécessaires :

1. `supabase/migrations/202610100001_ads_v1_test.sql`, base publicitaire existante.
2. `supabase/migrations/202610120001_ads_final_test.sql`, complément des cinq offres, visuels, vérification et registre des paiements/mesures.

**Non appliquées à distance dans ce commit.** Confirmer le projet et les dépendances avant toute application. La seconde migration exige une confirmation de référence dans `myevent.target_project_ref`; cette variable SQL de session n'est pas une variable Vercel. Ne jamais exécuter ces migrations sur le projet public. Si les deux sont requises, les appliquer dans une transaction unique après inspection, sans recréer les objets existants. La seconde est testée pour une réexécution sans écrasement des tarifs.

La diffusion et Stripe TEST sont désactivés par défaut (`enabled=false`, `payments_enabled=false`). Les clés Stripe TEST, secret webhook et clé service Supabase doivent être déjà configurés côté serveur ; aucune clé n'est lue/affichée dans le navigateur ni ajoutée par cette mission. Ne pas remplacer une clé LIVE de Cagnotte par une clé TEST ni modifier les variables sans autorisation.

## Tests réellement exécutés

- 31 tests Node : interface réelle en DOM isolé, cinq offres, absence de Checkout gratuit, absence d'accès administratif refusé, édition des tarifs, frontière TEST, clés LIVE rejetées, montant serveur, réutilisation de session, échecs/expiration, consentement/déduplication, protections du webhook et non-régression Cagnotte.
- 59 contrôles PostgreSQL locaux : migrations/garde de projet/réexécution, propriété des visuels, modification/modération, registre de paiement, relecture du webhook, géographie, programmation, expiration, renouvellement, Bienvenue unique et entreprise vérifiée.
- 34 contrôles PostgreSQL de la base V1 conservée.

Ces tests utilisent une base locale et des transports Stripe simulés : **ils ne prouvent pas un paiement réel sur Stripe TEST ni une diffusion distante**. Le parcours réel Professionnel → Stripe TEST → administrateur → diffusion reste conditionné à l'installation des migrations et à la configuration TEST vérifiée. Aucun essai iPhone Safari physique réalisé. Les captures distantes doivent être présentées comme état réel de la Preview, jamais comme un parcours simulé validé.

## Avant toute production

Installer et vérifier le schéma TEST, effectuer le parcours distant avec comptes fictifs autorisés, contrôler le webhook Stripe TEST réellement livré, valider les détails commerciaux de ciblage/visuels et la politique de vérification des entreprises, vérifier l'affichage iPhone et les règles de consentement/confidentialité. Production/Stripe LIVE/Google nécessitent une nouvelle autorisation.

## Correction Premium / Professionnel du 12 octobre

Les trois migrations Ads ont été appliquées exclusivement à MyEvent-Admin-Test (ahyyknfjsielnqyoxqgh). Les tarifs et durées des cinq offres sont conservés. Premium : une campagne départementale. Professionnel : trois campagnes nationales prioritaires, regroupées dans un forfait payé une fois et une période commune, avec statistiques journalières par campagne (impressions, clics, CTR). Les plafonds sont contrôlés lors de la validation côté base, les tentatives de paiement sont partagées et les tables internes restent privées. La programmation individuelle des campagnes d’un forfait Professionnel est indisponible, afin de conserver la période commune. Aucun nouvel endpoint Vercel.

74 contrôles PostgreSQL isolés et 32 tests Node passent. La création réelle d’une campagne Bienvenue et son téléversement ont été réalisés dans la Preview TEST ; la récupération des images signées reste à vérifier. Les paiements et la diffusion distante restent désactivés. Aucun paiement complet Stripe TEST externe ni essai Safari iPhone physique validé. Ne pas présenter ces points comme terminés.
