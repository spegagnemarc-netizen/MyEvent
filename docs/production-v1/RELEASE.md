# ORÉVAMI V1 — publication préparée le 19 octobre 2026

État : préparation locale uniquement. Aucun déploiement, aucune modification distante de Production.

Source vérifiée : integration/production-preserved-20261019, 5c857f2a795e3e724ba42f28de0d65e46a978cac.
Production réellement associée à orevami.com : 14b89e021906071bcb56f81c340f6cb839f54423,
déploiement dpl_4NKRbJpZNkhvuHWHQSWH8eJXpcKs (READY).
Candidat isolé : release/orevami-v1-production-20261019, sans fusion vers main ni refactor-final.

## Changements du candidat

- Le module, le cadre et la recherche enrichie acceptent le couple exact Production/nxxvadbliinhvkirqkkl.
- La Preview reste limitée au couple Preview/ahyyknfjsielnqyoxqgh.
- La création Production dépend de la capacité adulte renvoyée par le serveur, du schéma version 2 et des inscriptions fermées ; aucun UUID TEST n'autorise un compte Production.
- Participation et acceptation restent bloquées dans le client et par le verrou SQL indépendant.
- Les 42 types illustrés, filtres, recommandations, navigation, conservation du défilement et thème restent ceux de la source validée.
- Les deux ressources modifiées reçoivent une nouvelle version dans index.html pour éviter le cache de l'ancien module.
- Les 347 fichiers protégés de Production sont identiques ; le corps de la recherche existante est identique. Aucun jeu n'a été rejoué.

## Schéma Production réel et proposition SQL

Lecture limitée aux dépendances du module : projet MyEvent ACTIVE_HEALTHY, PostgreSQL 17 ;
aucun schéma activities_private et aucune RPC activities_*.
auth.uid(), public.are_friends(uuid,uuid), public.myevent_account_active(), profiles et admin_reports existent.
La contrainte admin_reports_target_kind_check autorise actuellement event/listing.

001-install-closed.sql est à approuver AVANT exécution sur nxxvadbliinhvkirqkkl exclusivement.
Il combine le socle éprouvé et le delta V1.5 dans une seule transaction :
sept tables privées RLS sans accès direct, six RPC publiques exécutables par authenticated seulement,
quatre colonnes et trois contraintes V1.5. L'unique modification d'objet préexistant est l'extension
du CHECK admin_reports_target_kind_check à activity/user pour les signalements.
Les RLS, permissions et fonctions préexistantes ne sont pas remplacées.
Les empreintes du catalogue public et des signalements sont comparées avant/après ; toute divergence annule l'installation.
Le script refuse un module déjà installé et s'arrête sans changement en cas de conflit.
Aucun utilisateur, approbation adulte, activité ou réglage TEST n'est transféré.
Sortie obligatoire : enabled=false, registrations_enabled=false, aucun accès adulte, aucune activité.

## Limite bloquant l'ouverture réelle

Le socle utilise une autorisation adulte administrative explicite ; il n'existe aucun accès adulte
du module en Production. Une date déclarative ou un compte TEST ne prouve pas l'âge.
Installer le schéma ne suffit donc pas à rendre la création accessible aux utilisateurs réels.
L'activation et les premières autorisations de comptes réels devront être approuvées séparément,
après confirmation de leur éligibilité adulte ; aucune attribution automatique n'est préparée.
Les inscriptions restent fermées même après activation de la création/consultation.

Les liens officiels, horaires et extraits externes de fiches enrichies restent dans le brouillon,
comme dans la version validée ; seules les données principales du lieu sont persistées.
Les couvertures Activités restent un aperçu local ; pas de nouvelle règle Storage.

## Contrôles indispensables effectués

Trois contrôles locaux dédiés à cette préparation : installation transactionnelle/annulation/absence de droits directs,
barrière client Production et éligibilité serveur, conservation des 347 fichiers et de la recherche.
Les 40 tests précédents et les jeux n'ont pas été rejoués. Aucune nouvelle Preview.
La validation locale du SQL ne remplace pas la vérification du catalogue distant après exécution autorisée.

## Sauvegarde et retour arrière

Le paquet local de remise contient une archive Git autonome de la Production, du candidat et de leur histoire,
ainsi qu'une copie de la contrainte de signalement préexistante. Ce n'est pas une sauvegarde intégrale des données Supabase.
L'installation ne modifie aucune donnée existante ; toute erreur annule sa transaction.
Après installation réussie mais avant publication, le module reste fermé et l'ancien site continue de fonctionner.
En cas d'incident après publication, réaffecter la Production Vercel au déploiement
dpl_4NKRbJpZNkhvuHWHQSWH8eJXpcKs. Ne pas supprimer le nouveau schéma ni ses données.
La fermeture d'urgence proposée dans 900-disable-module.sql conserve les données et exige une autorisation d'exécution.
La contrainte de signalement étendue reste compatible avec l'ancien site ; ne pas la réduire après de nouveaux signalements.

## Ordre de publication

1. Accord explicite sur le script SQL exact, puis installation Production et vérification ciblée en lecture seule.
2. Décision d'éligibilité des premiers comptes réels et script d'activation nominatif soumis séparément ; inscriptions fermées.
3. Vérifier les variables Production du build : URL/ref nxxvadbliinhvkirqkkl, aucune clé ou donnée TEST ; ne pas promouvoir le build Preview TEST.
4. Confirmer SHA final, conservation, schéma compatible et retour arrière ; demander la confirmation finale de publication.
5. Déployer le candidat avec la configuration Production, sans fusion globale ; contrôler uniquement disponibilité et liaison Supabase.
6. Figer V1 après publication réussie. Préparation Google Play ensuite.

La configuration et le build Production ne sont pas certifiés avant ces étapes. Aucune autorisation de publication finale n'est demandée prématurément.
