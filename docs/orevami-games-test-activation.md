# Activation Salon Jeux — Supabase TEST uniquement

Projet autorisé : **MyEvent-Admin-Test / ahyyknfjsielnqyoxqgh**.
Branche : **prepare/orevami-production**. Aucun déploiement Production.

## État distant observé

Le 13 octobre 2026, des lectures RPC anonymes du projet TEST ont retourné HTTP 404 / PGRST202 pour `game_my_rooms` et `defis_my_rooms`. Ce résultat indique une fonction absente du schéma exposé ou un cache/signature périmé. Il ne constitue ni une partie multijoueur authentifiée ni une preuve suffisante pour réappliquer toutes les migrations.

L’accès administrateur au tableau de bord reste soumis à connexion. Aucune migration n’a été exécutée à distance dans cette livraison. Les tests PostgreSQL locaux utilisent huit identités fictives et ne touchent aucun projet Supabase.

## Procédure avant application

1. Confirmer le nom et le ref TEST dans le tableau de bord.
2. Exécuter **en lecture seule** `supabase/test/games-preflight-readonly.sql` et vérifier aussi l’historique des migrations du projet.
3. Si les fonctions existent avec les signatures correctes et les tables/politiques attendues, recharger le cache PostgREST (`NOTIFY pgrst, 'reload schema';`) plutôt que recréer les tables. Réessayer avec un compte TEST connecté.
4. Si des composants sont absents, examiner les migrations concernées et leur dépendances avant application. Ne pas réexécuter une migration initiale déjà appliquée : elles ne sont pas idempotentes.
5. Faire approuver le lot SQL exact avant toute nouvelle migration à distance.

Dépendances historiques, dans l’ordre :

- `202609250002_friends_stories.sql` : amitiés, Stories et règles associées (ne pas appliquer ce lot complet seulement pour résoudre un nom de RPC sans audit préalable).
- `202609270001_friend_invite_links.sql` : liens d’amitié.
- `202609270002_games_engine.sql` : Infiltré, salons, joueurs, invitations, rôles privés et politiques.
- `202609270003_defis_game.sql` : Défis.
- **`202610130001_additional_games_test.sql`** : Action ou Vérité, Chasse au trésor, Quiz et Blind Test ; dépend des quatre précédentes.

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
