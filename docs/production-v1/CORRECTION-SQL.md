# Correction SQL Production — 19 octobre 2026

Proposition uniquement. Ne pas exécuter avant une autorisation explicite portant sur le nouveau fichier.
Base applicative inchangée : 222fea12c2152cabaa9944b6402c22a6777e8941.
Cible exclusive à sélectionner dans le connecteur : Production nxxvadbliinhvkirqkkl.

## Cause exacte reproduite

Le contrôle Production en lecture seule confirme qu'aucune des six fonctions Activités n'existe.
Il ne s'agit donc pas d'une collision avec une fonction utilisée par un autre module.
Le propriétaire postgres dispose en Production des privilèges par défaut suivants sur les fonctions du schéma public :
`{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`.

Le script initial révoquait PUBLIC, anon et authenticated sur les nouvelles fonctions, puis accordait authenticated.
Il conservait involontairement le droit service_role hérité. La fixture locale ne reproduisait pas cette configuration.
La reproduction locale avec les privilèges Production donne, pour chacune des signatures ci-dessous :

| Signature qualifiée | Définition SQL | ACL attendue | ACL obtenue avant correction |
| --- | --- | --- | --- |
| public.activities_capabilities() | Identique | postgres, authenticated | postgres, service_role, authenticated |
| public.activities_list() | Identique | postgres, authenticated | postgres, service_role, authenticated |
| public.activities_detail(uuid) | Identique | postgres, authenticated | postgres, service_role, authenticated |
| public.activities_save(uuid,jsonb) | Identique | postgres, authenticated | postgres, service_role, authenticated |
| public.activities_participate(uuid,text,uuid) | Identique | postgres, authenticated | postgres, service_role, authenticated |
| public.activities_safety(uuid,text,uuid,text) | Identique | postgres, authenticated | postgres, service_role, authenticated |

Il s'agit exclusivement de droits EXECUTE ; les arguments nommés sont détaillés dans function-divergence.json.
La reproduction identifie six différences d'ACL et aucune différence de définition ou de signature.
La précédente transaction distante ayant été annulée, ce constat détaillé provient de la reproduction locale
du script exact avec les ACL par défaut relues sur Production, et non d'objets restés installés à distance.

## Nouveau script

Fichier : 002-install-closed-corrected.sql.
SHA256 : dd7c2c1d96b7aa088ffe8c31cb2b09ce3491ed26fe436f249b2b2703dc56fa7d.

Seule correction des droits dans le socle : ajouter service_role au REVOKE portant explicitement sur
les six nouvelles RPC publiques. Le GRANT authenticated reste identique. Aucun REVOKE global sur public,
aucune modification des privilèges par défaut, aucune suppression ou substitution de fonction existante.
Les anciennes fonctions des autres modules et leurs droits restent protégés par l'empreinte avant/après.

Réexécution : une enveloppe compare le catalogue complet installé à la référence finale et vérifie la fermeture
du module ainsi que la contrainte de signalement. Si tout correspond, elle retourne sans écriture.
Une installation partielle, une divergence ou un module déjà activé provoque un arrêt sans tentative de réparation.
Les créations simultanées sont sérialisées par un verrou transactionnel. Installation et contrôle sont dans BEGIN/COMMIT ; toute erreur annule la transaction.

Le périmètre fonctionnel du socle reste celui présenté : sept tables privées RLS, six RPC publiques,
colonnes V1.5, extension du seul CHECK de signalements existant à activity/user.
Pas de copie de compte, donnée TEST ni autorisation adulte. Activation, inscriptions et participations restent fermées.
Le script ne contient pas de connexion réseau : son identité de cible doit être vérifiée via le connecteur avant exécution,
comme lors de la première tentative ; ne pas l'exécuter sur TEST.

## Validation locale limitée

- Reproduction du défaut d'ACL avec le script initial et extraction des six différences exactes.
- Un test local dédié au nouveau script : annulation forcée intégrale, installation avec les ACL Production,
  sept tables RLS et six ACL exactes, absence d'accès direct aux tables, refus anon,
  activation/inscriptions fermées, aucun adulte autorisé ni activité créée.
- Nouvelle exécution sans changement, refus d'un état activé ou d'une ACL divergente.
- Fonction préexistante de simulation, permissions par défaut et données de signalement conservées.

Résultat : test ciblé réussi. Aucun des 40 tests antérieurs ni aucun jeu rejoué.
Aucun nouveau SQL exécuté à distance ; Production, TEST, comptes, domaines et main inchangés.
Le script 001 reste conservé comme référence historique et ne doit pas être réutilisé.

Prochaine étape : autorisation explicite de 002-install-closed-corrected.sql sur Production, puis installation
et contrôle de conformité uniquement. L'activation adulte et la publication Vercel gardent leurs autorisations séparées.
