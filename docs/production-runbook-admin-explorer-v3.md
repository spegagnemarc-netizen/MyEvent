# Runbook Production — Admin V3 + Explorer

Aucune commande de ce document ne vaut autorisation de modifier Production.

## Gate 1 — avant SQL

- Conserver l'URL/SHA du déploiement public stable.
- Vérifier les variables Vercel Production: `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY`; ne pas toucher à `VERCEL_ENV`.
- Confirmer une sauvegarde/restauration utilisable.
- Exécuter `supabase/admin/production-readiness-v3.sql` en lecture seule et conserver les résultats.

**STOP** si le schéma réel diffère des colonnes attendues, si un hook PostgREST existant est incompatible, ou si l'état d'une migration Admin est ambigu.

## Gate 2 — matrice de migrations

| Objet constaté | Action |
|---|---|
| `platform_admins` absent | examiner/appliquer 001 |
| `admin_partner_content` absent | examiner/appliquer 002 |
| `admin_account_controls` absent | examiner/appliquer 003 |
| request gate absent/non prêt | examiner/appliquer 004 puis vérifier HTTP |
| `personal_reservations` absent | appliquer 202610050001 après préflight |
| RPC `myevent_admin_identity` absente | appliquer 202610050002 Admin V3 |

Ne jamais rejouer une migration uniquement parce que son fichier existe dans Git. Décider à partir de l'état réel de la base.

## Gate 3 — validation avant propriétaire

Compte utilisateur normal:
- connexion OK;
- Explorer/réservations OK après migration correspondante;
- `myevent_is_admin()` renvoie false;
- RPC protégées Admin refusées.

Seulement ensuite, et après autorisation explicite, inscrire le compte propriétaire dédié dans `platform_admins`. Vérifier `myevent_admin_identity()`: `is_admin=true`, `role=super_admin`, `account_active=true`.

## Gate 4 — validation Admin

Contrôler Dashboard, Utilisateurs, Réservations, Signalements, Statistiques, Partenaires et Paramètres. Vérifier qu'un Admin ne peut ni se suspendre lui-même ni suspendre un autre Admin. Vérifier que les justificatifs privés ne sont pas retournés par la liste Admin.

## Gate 5 — candidate web

Déployer une candidate de `refactor-final` sans promotion publique automatique. Vérifier le quota Vercel (maximum 12 fonctions), desktop et iPhone Safari. Tester session, Explorer, partenaires, retour de redirection et Admin.

La Production publique n'est changée qu'après validation explicite de cette candidate.

## Rollback

- Web: revenir au déploiement public stable conservé au Gate 1.
- Rôle propriétaire: supprimer uniquement son entrée `platform_admins` si le problème est limité aux droits Admin.
- SQL: utiliser sauvegarde/restauration ou procédure de rollback spécifique; ne pas tenter de corriger une base par un simple revert Git.
