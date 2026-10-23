# ORÉVAMI V1.5 — autorisation TEST à valider

État vérifié à la reprise du 19 octobre 2026 : le catalogue Supabase TEST
ahyyknfjsielnqyoxqgh correspond exactement au socle attendu ; enabled=false,
aucun accès adulte actif, aucune activité enregistrée. Aucune écriture distante
n'a été effectuée pour V1.5. La V1.4 reste au commit
048b7955280c12e1a3b567c572116bbab0f280a0.

## 1. Installation proposée — schema-proposal.sql

Transaction atomique avec comparaison complète du catalogue avant écriture,
contrôle après installation et réexécution strictement sans changement si le
catalogue correspond déjà. Une divergence provoque l'arrêt.

Ajouts exacts :

- activities_private.settings.registrations_enabled : boolean NOT NULL DEFAULT false.
- activities_private.activities.activity_type : text nullable, contrôlé contre les
  42 types et leur catégorie générale existante.
- activities_private.activities.venue_cost_status : text NOT NULL DEFAULT 'unknown',
  valeurs free, unknown ou on_site.
- activities_private.activities.cost_details : text NOT NULL DEFAULT '', maximum 1200 caractères.
- Trois CHECK supplémentaires : cohérence type/catégorie, statut des frais du lieu,
  longueur de la précision tarifaire.

Quatre implémentations privées modifiées, signatures inchangées :

- capabilities : expose registrations_enabled et la version 2.
- save : conserve type précis, statut des frais et précision tarifaire.
- detail : expose ces champs, le nom d'affichage de l'organisateur et le GPS précis
  aux seuls membres acceptés/organisateur ; la position reste approximative pour
  les autres utilisateurs autorisés.
- participate : refuse join et accept tant que registrations_enabled=false.

Les sept tables, les six RPC publiques, les RLS, les permissions, les contraintes
existantes et les données existantes sont conservées. Aucune suppression, aucun
paiement, aucun service externe activé. Ce script laisse enabled=false et les
inscriptions fermées. schema-source.sql est la version lisible du seul delta ;
seul schema-proposal.sql contient les gardes d'installation complètes.

## 2. Configuration séparée — activation-proposal.sql

À exécuter seulement après autorisation, installation et validation d'une Preview
compatible avec les nouvelles capacités, en particulier les boutons d'inscription.

- Autoriser uniquement tutoriel-organisatrice, UUID 864beda0-b216-4b9a-9697-4dc8fd8c41f9.
- Référencer l'administrateur TEST existant test-b, UUID cfd3f5c6-afd7-46a5-890e-d1e8ad14102c,
  déjà super_admin, comme approbateur de cette autorisation de démonstration.
- Passer enabled=true pour permettre création/consultation au seul compte autorisé.
- Maintenir registrations_enabled=false, avec refus serveur des inscriptions et validations.
- Arrêter en présence d'une identité, d'une autorisation ou d'un catalogue divergent.
- Une réexécution conforme ne recrée pas l'accès et ne change pas sa date d'approbation.

Il ne s'agit pas d'une vérification d'âge d'une personne réelle : ce compte est
un compte de démonstration. Aucun compte Auth ni mot de passe n'est modifié.

## Adaptations applicatives

Le client doit utiliser registrations_enabled pour les boutons de participation,
conserver les nouveaux champs lors de la création et lever les blocages de
publication uniquement pour les informations compatibles réellement persistées.
Les frais du groupe et ceux du lieu doivent être distingués dans cartes, fiches
et filtre gratuit. La fiche d'activité doit rendre son GPS et son organisateur.
Ces adaptations sont préparées dans la branche d’intégration ; consulter INTEGRATION-STATUS.md pour la portée exacte et la validation de la Preview. Aucun catalogue de lieux partagé,
stockage de photos ou système de discussion supplémentaire n'est installé ici.

## Validation déjà réalisée

Un scénario PostgreSQL LOCAL a réussi : installation atomique avec rollback en
cas d'erreur, réexécution sans changement, conservation des permissions/RLS,
création locale des trois catégories, lecture des champs et de l'organisateur,
refus des inscriptions côté serveur et refus d'accès à un compte non autorisé.
Ces fixtures locales ne sont pas des activités enregistrées sur Supabase TEST.

Aucune persistance distante, reconnexion ou capture de trois cartes réelles ne
peut encore être annoncée. L'approbation ci-dessus précède tout test distant.
