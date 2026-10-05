# Production readiness — Explorer + Admin V3

Date: 2026-10-05. Branche: `refactor-final`.

Ce document est un plan de préparation. Il n'autorise ni migration distante, ni promotion Vercel, ni modification de `main`.

## Verdict

La branche n'est pas encore à promouvoir telle quelle en production. Le code Explorer/Admin V3 est préparé, mais le schéma et la configuration Production doivent être contrôlés puis alignés explicitement.

## Préconditions bloquantes

1. **Configuration Vercel Production** — confirmer `SUPABASE_URL` et surtout `SUPABASE_PUBLISHABLE_KEY`. L'audit précédent a signalé la clé publishable comme absente en Production. Ne jamais remplacer `VERCEL_ENV` manuellement et ne jamais exposer `service_role`.
2. **Schéma Production** — faire un préflight en lecture seule. Ne pas lancer `supabase db push`: le dépôt n'est pas une baseline historique complète et contient deux migrations `202609280002`.
3. **Admin** — vérifier si 001/002/003/004 sont déjà présentes avant toute exécution. 003/004 comportent des contrôles et ne doivent pas être rejouées aveuglément.
4. **Explorer** — `202610050001_personal_reservations.sql` est requise en Production avant Explorer. Elle a été validée sur TEST mais n'est pas documentée comme installée en Production.
5. **Admin V3** — appliquer ensuite `202610050002_admin_v3_dashboard_reservations.sql`. Elle dépend des objets Admin V2 et tolère l'absence de `personal_reservations` pour les lectures, mais Explorer lui-même exige 001.
6. **Super Admin** — seulement après validation des migrations, inscrire le compte propriétaire dans `platform_admins` par une opération SQL séparée et explicitement autorisée. Aucun UUID propriétaire ne doit être hardcodé dans le dépôt.

## Ordre de déploiement recommandé

- Sauvegarde/restauration vérifiée de Production et export des métadonnées nécessaires.
- Préflight SQL en lecture seule: tables, colonnes, fonctions, politiques RLS, hooks PostgREST, Storage et migrations Admin déjà présentes.
- Corriger les variables Vercel Production manquantes sans toucher aux secrets non concernés.
- Appliquer uniquement les migrations réellement absentes, dans l'ordre de dépendance: Admin 001/002/003/004 si nécessaires, Explorer 001, Admin V3 002.
- Vérifier les RPC Admin avec un compte non-admin: refus attendu.
- Inscrire le propriétaire Super Admin par SQL séparé; vérifier `myevent_admin_identity()`, puis l'accès aux rubriques sans exposer `auth.users` au navigateur.
- Déployer la branche candidate sans modifier `main` tant que les contrôles ne sont pas terminés; effectuer les tests iPhone/Safari et desktop.
- Après validation explicite, seulement alors décider de la promotion publique.

## Contrôles post-migration

- Connexion/reconnexion compte utilisateur normal; Explorer et réservations personnelles persistantes.
- Création d'une réservation personnelle, rattachement/détachement d'un événement sans duplication; justificatif privé non exposé par Admin.
- Admin: Dashboard, Utilisateurs, Réservations, Signalements, Statistiques, Partenaires, Paramètres.
- Compte normal: `myevent_is_admin=false`, RPC Admin refusées.
- Super Admin: accès autorisé; auto-suspension et suspension d'un autre Admin refusées.
- Suspension utilisateur uniquement si le request gate 004 est réellement actif et vérifié par HTTP.
- Affiliations existantes inchangées: Hotels.com, Expedia, Abritel, Omio, TicketNetwork, Viator; aucune conversion inventée.
- Nombre de fonctions Vercel <= 12.
- Production iPhone Safari: affichage, scroll horizontal Admin, clavier, dates, retour partenaire, session après mise en veille.

## Rollback

Ne pas utiliser un revert Git comme rollback de base. Pour un incident SQL, utiliser la sauvegarde/restauration validée ou le rollback Admin documenté selon les objets touchés. Pour un incident applicatif, conserver le déploiement Production actuellement connu comme stable et revenir à ce déploiement sans modifier les données. L'inscription Super Admin peut être retirée séparément de `platform_admins` si nécessaire.

## Interdictions

Pas de `db push` aveugle, pas de copie de clés TEST vers Production, pas de `service_role` côté navigateur, pas de promotion automatique, pas de modification de `main`, pas d'attribution Super Admin au compte quotidien par défaut.
