# Validation finale Storage réussie — TEST uniquement

Ce bilan remplace les états bloqués précédents. Résultat détaillé : storage-test-result.json (success=true, cleanup vide).

Validé contre ahyyknfjsielnqyoxqgh via le handler serveur local : refus d'un autre propriétaire ; suppression autorisée et cascade membres ; deux médias dont un orphelin retirés ; panne injectée sur le vocal, demande durable préservée ; upload tardif refusé (Storage masque le message SQL et retourne P0001) ; reprise du vocal et inventaire vide ; trois binaires cible absents ; événement témoin et ses deux binaires préservés avant et après reprise. Toutes les fixtures ont été nettoyées. Les tombstones techniques de suppression fictive restent dans TEST. Aucun email envoyé, aucune donnée réelle utilisée.

Prérequis TEST corrigé avec autorisation : message_reactions REPLICA IDENTITY FULL (identité précédente DEFAULT, aucune clé primaire). Aucun droit service_role ajouté à profiles : les profils fictifs ont été créés via leurs propres sessions utilisateur. Aucun changement Production ni Vercel, main, Stripe, SMTP ou DNS. Geoapify et Hotels.com conservés. Douze fichiers API.

## Publication à autoriser explicitement

1. Rafraîchir et conserver la sauvegarde PostgreSQL Production, confirmer sa restauration, conserver le déploiement précédent. La sauvegarde PostgreSQL ne contient pas les binaires Storage : sauvegarder les binaires si leur restauration est requise après des suppressions volontaires.
2. Vérifier de façon ciblée en lecture seule le prérequis de réplication message_reactions en Production. Ne pas appliquer automatiquement la correction TEST. Si elle manque aussi en Production, obtenir l'accord pour cette correction supplémentaire avant suppression ou publication.
3. Appliquer les deux migrations préparées, dans l'ordre : 202610130003_event_delete_owner_cascade.sql, puis 202610140001_event_storage_cleanup.sql. Aucun événement n'est supprimé par leur application.
4. Configurer dans Vercel Production SUPABASE_SECRET_KEY avec la clé moderne du projet Production, exclusivement côté serveur. Garder la clé TEST hors Production et ne jamais partager un secret dans le chat ou Git.
5. Publier les commits sur GitHub, contrôler les divergences de main, intégrer uniquement les corrections validées puis déployer sur le projet Vercel existant. Contrôles après publication limités à configuration, disponibilité et erreurs ; aucun événement réel supprimé pour tester.

## Retour arrière

Conserver l'ancien déploiement et les sauvegardes. Suspendre les suppressions si erreur critique. Ne pas retirer la table des demandes, ses tombstones ou le garde des uploads tant que des fichiers restent à nettoyer. Le worker serveur doit rester disponible pour les reprises. La suppression volontaire d'un événement et de ses fichiers n'est pas annulable par un simple rollback de déploiement.

La reprise se fait lors du chargement des événements par le propriétaire, sans cron : sans nouvelle connexion, les demandes restent durablement en attente. Aucune garantie de nettoyage immédiat en cas de panne externe.

La clé Legacy TEST précédemment exposée n'a pas été révoquée ici ; sa désactivation reste une opération de sécurité distincte, à coordonner avec les dépendances TEST. Le contrôle utilise la clé moderne existante.
