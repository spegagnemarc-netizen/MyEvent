# Activation Salon Jeux — Supabase TEST uniquement

Projet autorisé : **MyEvent-Admin-Test / ahyyknfjsielnqyoxqgh**.
Branche : **prepare/orevami-production**. Aucun déploiement Production.

## État distant observé

Le 13 octobre 2026, des lectures RPC anonymes du projet TEST ont retourné HTTP 404 / PGRST202 pour `game_my_rooms` et `defis_my_rooms`. Ce résultat indique une fonction absente du schéma exposé ou un cache/signature périmé. Il ne constitue ni une partie multijoueur authentifiée ni une preuve suffisante pour réappliquer toutes les migrations.

Mise à jour du 13 octobre 2026 : connexion administrateur vérifiée au projet TEST ; l’audit réel confirme zéro table/fonction Jeux et zéro schéma `game_private`. Profils, événements, participants et amitiés existent déjà. Les statuts de participants existants sont `active` et `confirmed`.

Les migrations `202609270002`, `202609270003`, `202610130001` et `202610130002` ont été appliquées **ensemble dans une transaction**, exclusivement dans `ahyyknfjsielnqyoxqgh`. Résultat serveur : « TEST games activated », sept tables publiques Jeux. Aucune migration Stories/Amis n’a été réappliquée. Les contrôles et données préexistants de ces rubriques sont préservés.

Connexion réelle à la Preview vérifiée avec `test-b`, ouverture du catalogue et création authentifiée d’un Quiz réussies (code `C5D68944`). Les quatre comptes fictifs A/B/C/D existaient déjà, e-mails confirmés. Aucun mot de passe n’a été modifié.

Les essais PostgreSQL isolés couvrent les six moteurs. Les essais distants complets restent à effectuer : le navigateur a bloqué l’éditeur SQL après la remise sécurisée des identifiants de la Preview. Ne pas présenter les tests locaux ou le script distant préparé comme des parties déjà exécutées sur Supabase TEST.

## Procédure avant application

1. Confirmer le nom et le ref TEST dans le tableau de bord.
2. Exécuter **en lecture seule** `supabase/test/games-preflight-readonly.sql` et vérifier aussi l’historique des migrations du projet.
3. Si les fonctions existent avec les signatures correctes et les tables/politiques attendues, recharger le cache PostgREST (`NOTIFY pgrst, 'reload schema';`) plutôt que recréer les tables. Réessayer avec un compte TEST connecté.
4. Si des composants sont absents, examiner les migrations concernées et leur dépendances avant application. Ne pas réexécuter une migration initiale déjà appliquée : elles ne sont pas idempotentes.
5. Toute nouvelle migration hors du lot Jeux autorisé nécessite une nouvelle décision. Ne pas réexécuter le lot initial déjà appliqué.

Références historiques et lot Jeux : les tables d’amitiés et `are_friends` suffisent aux invitations de jeu ; les liens d’amitié ne sont pas une dépendance SQL obligatoire du moteur Jeux.

- `202609250002_friends_stories.sql` : amitiés, Stories et règles associées (ne pas appliquer ce lot complet seulement pour résoudre un nom de RPC sans audit préalable).
- `202609270001_friend_invite_links.sql` : liens d’amitié.
- `202609270002_games_engine.sql` : Infiltré, salons, joueurs, invitations, rôles privés et politiques.
- `202609270003_defis_game.sql` : Défis.
- **`202610130001_additional_games_test.sql`** : Action ou Vérité, Chasse au trésor, Quiz et Blind Test ; nécessite les moteurs Infiltré/Défis et `are_friends` existant.
- **`202610130002_games_event_membership_test.sql`** : admission et maintien d’accès limités aux participants `active`/`confirmed` et au créateur de l’événement.

Le nouveau lot conserve les moteurs existants. Il élargit la contrainte du catalogue, ajoute deux tables privées et six RPC réservées aux utilisateurs authentifiés, et protège `game_action` pour éviter qu’un moteur manipule les salons d’un autre jeu. Il ne supprime aucune donnée existante. Le rejeu remet uniquement à zéro les réponses/scores de la partie concernée, à la demande de son hôte.

## Parcours réellement développés

| Jeu | Parcours | Limite |
| --- | --- | --- |
| Infiltré | Moteur et interface existants conservés ; vérifications PostgreSQL après nouvelle migration | Activation distante à confirmer |
| Défis | Moteur et interface existants conservés ; vérifications PostgreSQL après nouvelle migration | Activation distante à confirmer |
| Action ou Vérité | Rotation des joueurs, choix, réalisation ou passage, scores, fin et rejeu | Actions réalisées oralement/en présence, pas de reconnaissance automatique |
| Chasse au trésor | Indices et codes préparés par l’hôte, dix essais maximum, progression et scores | Parcours manuel ; pas de géolocalisation ou validation photographique ajoutée |
| Quiz | Cinq questions, réponses privées, délai, révélation, classement et rejeu | Banque initiale de cinq questions |
| Blind Test | Extraits HTTPS fournis par l’organisateur, lecteur audio réel, quatre choix, délai et scores | Aucun catalogue musical ; les fichiers doivent être accessibles et compatibles avec le navigateur |
| Karaoké | Catalogue conservé, bouton désactivé « Prochainement » | Aucune base ou intégration musicale créée |

## Validation distante indispensable

Après activation SQL, utiliser au moins deux comptes TEST : créer, inviter, rejoindre, se déclarer prêts, jouer jusqu’au classement, reprendre après rechargement et rejouer pour chacun des six jeux. Vérifier les refus pour un compte extérieur/non connecté, le transfert d’hôte et les salons liés à un événement.

Pour le Blind Test, vérifier un vrai extrait autorisé sur iPhone Safari, les erreurs de chargement et la pause lorsque l’on quitte l’écran. Les URL `example.org` des tests automatisés sont des fixtures de configuration, **pas des extraits audio réellement écoutés**.

Les tests DOM utilisent JSDOM ; ils ne remplacent pas une validation Safari iPhone. Aucun appareil Safari réel n’était disponible pendant le développement.

## Contrôles reproductibles

```sh
npm install
npm test
npm run test:games
```

Aucune nouvelle fonction Vercel : les jeux utilisent les RPC Supabase et le transport existant. Les 12 fichiers API Vercel existants sont préservés.

Retour arrière : conserver le déploiement `dpl_Ffye6muVhaio2vDZ8Dx5jynHUFeK` ; revenir au commit de préparation précédent pour la Preview. Ne pas supprimer les tables et ne pas révoquer des accès en Production. Le nouveau SQL est compatible avec le catalogue antérieur ; son application éventuelle nécessite une décision séparée pour un retrait de schéma.

## Script d’essais distants préparé

`supabase/test/games-live-test-template.sql` a été validé en PostgreSQL isolé. Il teste six parties avec quatre comptes TEST, les invitations, les réponses privées et 96 assertions dont six contrôles de permissions. Il crée uniquement des parties fictives et une amitié entre comptes fictifs ; les parties terminées sont conservées pour contrôler la persistance.

**Il n’a pas encore été exécuté à distance.** Les identités JWT sont simulées par `SET LOCAL ROLE authenticated` et les claims dans l’éditeur SQL ; ce protocole vérifie le vrai serveur et les droits RLS lorsqu’il est exécuté sur TEST, mais ne remplace pas des sessions OAuth dans quatre navigateurs. Les liens audio `example.org` de ce script sont des fixtures de configuration, pas un test d’écoute réelle.
