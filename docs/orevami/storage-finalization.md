# Storage — correctif préparé, non déployé

Ce bilan remplace le blocage Storage décrit dans finalization-status.md. Base 23f7471585ccd71231252d1ff481834803e5df54 conservée : Geoapify, Hotels.com et les autres corrections inchangés.

La RPC propriétaire est réutilisée : contrôle auth.uid(), verrou, suppression du parent et CASCADE/SET NULL existants. Le garde des membres reste inchangé. Une demande durable est enregistrée dans la même transaction, avant suppression, et conserve le propriétaire pour les reprises.

Le serveur vérifie la session auprès de Supabase et ses propres droits avant suppression. Il inventorie exclusivement event-media et event-voices, avec premier segment exactement égal à l'UUID de l'événement. Photos, couvertures, pièces jointes, vocaux et fichiers orphelins de ce dossier sont couverts. Aucun chemin de suppression n'est fourni par le navigateur. Les anciens chemins media/voice_messages hors du dossier attendu provoquent un refus avant toute suppression, pour éviter de toucher d'autres événements.

Suppression effective via l'API Storage, par lots de 100, jamais par suppression SQL des métadonnées. Relecture de l'inventaire après chaque lot : le succès HTTP seul n'est pas considéré comme une preuve de nettoyage complet. Panne, timeout ou suppression partielle laissent une demande durable. Le chargement des événements reprend jusqu'à trois demandes du propriétaire ; les gros volumes se poursuivent aux chargements suivants. Sans nouvelle connexion, le nettoyage reste en attente ; aucun cron ajouté. Un opérateur peut reprendre via les RPC réservées au service_role et l'API Storage, en relisant l'inventaire.

Le trigger bloque les uploads et changements de chemin vers un dossier supprimé ; son verrou est partagé avec la suppression pour coordonner les uploads concurrents. Les politiques RLS restent inchangées, et la table des demandes est inaccessible aux clients. Avatars, médias sociaux et autres événements sont hors périmètre.

## Vérification

Revue du code, contrôle de syntaxe des trois fichiers JavaScript et contrôle du diff effectués. Douze fichiers API conservés par distribution de la route dans une fonction existante. Aucune campagne de tests, aucune migration exécutée, aucune suppression réelle et aucune nouvelle Preview.

Le blocage d'implémentation est traité. Le nouveau circuit SQL/Storage n'est pas encore confirmé en exécution. Les anciens tests ne le couvrent pas ; ils n'ont pas été relancés. Une vérification isolée ciblée avec fichiers synthétiques est recommandée avant les écritures sensibles, sans utiliser d'événement réel.

## Autorisations précises nécessaires

1. Actualiser et conserver la sauvegarde Production puis appliquer, dans l'ordre, 202610130003_event_delete_owner_cascade.sql et 202610140001_event_storage_cleanup.sql. Ces migrations seules ne suppriment aucun événement existant.
2. Configurer côté serveur Vercel SUPABASE_SERVICE_ROLE_KEY pour le projet Supabase de chaque environnement, sans clé Production en Preview. Aucun secret dans le chat ou le dépôt, aucun changement SMTP.
3. Publier les commits sur GitHub, intégrer les corrections dans main après contrôle des divergences et déployer en Production. Aucun push ici pour éviter un déploiement automatique.

## Retour arrière et limites

Conserver le déploiement précédent et les sauvegardes. En cas de problème, suspendre les suppressions et revenir au code précédent. Ne pas supprimer la table des demandes ni les tombstones tant qu'il reste des fichiers ; garder le trigger contre les uploads tardifs et le traitement serveur disponible pour reprendre les demandes. La RPC propriétaire de 202610130003 est conservée comme référence.

Une suppression volontaire d'événement et de ses binaires est irréversible sans sauvegarde de ces binaires : une sauvegarde PostgreSQL ne les contient pas. Aucun retour arrière destructif automatique.

Aucun changement de Production, main, Supabase, Vercel, Stripe ou DNS. Aucun email envoyé. Les autorisations DNS, Stripe et SMTP ne sont pas nécessaires à ce correctif.

Documentation : https://supabase.com/docs/guides/storage/security/access-control
