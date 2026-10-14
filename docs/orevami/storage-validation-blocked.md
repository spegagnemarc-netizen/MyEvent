# Validation Storage TEST — interrompue avant le scénario

Projet : ahyyknfjsielnqyoxqgh uniquement. Les deux migrations préparées ont été appliquées dans TEST ; aucune migration Production.

La clé moderne a été saisie sous protection Windows et acceptée par le premier contrôle RPC. Aucun secret affiché ni commité.

La préparation du premier compte fictif s'est arrêtée sur HTTP 403 : service_role ne dispose pas du droit INSERT sur public.profiles. Aucun événement, profil ou fichier fictif n'a été créé. Le scénario suppression/partiel/upload tardif n'a donc pas été exécuté ni validé. Aucun élargissement des droits effectué.

Compte synthétique créé via Auth, à retirer : 00118062-636e-46af-9f02-e4753ec816da (adresse storage-…@example.invalid). Son retrait via Auth a échoué ; le retrait SQL limité à son identifiant et à l'adresse fictive a également été annulé par PostgreSQL : public.message_reactions publie DELETE sans replica identity (55000). Aucune donnée existante supprimée.

Avant une reprise ciblée : corriger exclusivement dans TEST le prérequis replica identity de message_reactions après vérification de son identité actuelle ; retirer le compte synthétique ; créer les profils de fixtures via une session propriétaire disposant des droits existants plutôt que donner des droits supplémentaires au serveur. Aucun changement Production justifié par ces seuls constats TEST.

L'adaptation locale aux clés modernes sb_secret_ est conservée : SUPABASE_SECRET_KEY, utilisation du seul en-tête apikey pour les appels privilégiés, JWT utilisateur séparé pour la RPC propriétaire. Geoapify et Hotels.com inchangés.

Publication non recommandée avant réussite du scénario. Les autorisations Production resteront : sauvegarde actualisée avec conservation du retour arrière, deux migrations ordonnées, clé serveur Production configurée de façon sécurisée, intégration main et déploiement. Aucun de ces changements effectué.
