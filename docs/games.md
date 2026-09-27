# Salon Jeux / Infiltré MyEvent

## Deployment

Branch: `refactor-final` only. Initial verified remote HEAD:
`24312380a43dd627d6c044e73cfdaf4720e35ef7`.
Public domain: https://my-event-eosin.vercel.app/.
Vercel production was initially behind the friend-invitation commit. Promote the
tested `refactor-final` deployment to production; no merge into `main` is needed.

Apply `supabase/migrations/202609270002_games_engine.sql` after the existing
`202609270001_friend_invite_links.sql`. Both were reported successfully applied by
the owner on 2026-09-27. The game migration is transactional, not a script to rerun.
No other migration is required for this version.

The migration publishes only `game_rooms` to Supabase Realtime when the existing
`supabase_realtime` publication is present. The client also refreshes every four
seconds while visible and immediately when returning to the foreground.
Ensure the normal application origin is allowed in Supabase Auth redirect URLs;
registration emails now preserve the invitation in `emailRedirectTo`.

Rooms expire after 24 hours and become inaccessible immediately. Cascading cleanup
runs when a new room is created. If `pg_cron` is already installed, the migration
also schedules `myevent-games-cleanup` hourly at minute 17. Without Cron, the next
room creation performs cleanup. Administrators can also call
`select public.game_cleanup_expired();` manually; clients cannot call it.

## Architecture

The previous competing `gamesHome` overlay and the local pass-the-phone game have
been replaced by a single `entertainmentLounge`. Existing header and bottom-nav
entry points both open it. Music, camera, Marketplace and global theme files are
unchanged. Games styles are scoped to the lounge and retain a blue palette.

`MyEventGameSession` is the reusable transport: creation, join, RPC actions,
snapshots, Realtime subscription, polling, reconnection and account isolation.
It reuses the existing authenticated Supabase client and profiles. It never
creates mock friends, users, role assignments, scores or votes in the browser.
The local preview fixture is separate from the application and uses synthetic
identities against an isolated PostgreSQL engine.

Shared database entities: `game_rooms`, `game_players`, `game_rounds`,
`game_scores` (append-only server ledger), `game_events`, `game_invitations`.
Only members can select room data. Authenticated clients have no direct write
privileges. All actions lock the room row; progression and power use also require
the current revision, preventing double advancement and replay of stale actions.

Infiltré internals are in `game_private`: word bank, used pairs, individual
secrets, and weighted votes. There are no browser grants or Realtime publication
on this schema. All internal tables also enable RLS. `game_snapshot` returns only
the caller's secret and own vote; no other player's word or role is included until
the round ends. Correct-vote scores are delayed until the round ends to prevent
indirect role disclosure. An eliminated player's role is revealed, but their word
is withheld until the round ends. Custom pairs never enter public room settings.

`game_private.start_round`, `resolve_vote`, `check_winner` and `finish_round` are
the Infiltré rule layer. Future games can extend `game_key` and add their rule
functions while retaining membership, profiles, transport, scores and invites.
`game_private.event_member` isolates existing event membership checks. Future
animation permissions can extend this authorization boundary without duplicating
profiles or changing the invitation/score model. No future event roles, commercial
integrations, or other game engines are implemented here.

## Rules

4–12 players, 1–7 rounds. At least four present players, all ready, are required.
Maximum infiltrators: 1 for 4–6 players, 2 for 7–9, 3 for 10–12, adjusted to the
actual group at launch. An independent random speaking order prevents role-order
inference. Each round redistributes roles and selects a new coherent word pair.
The original MyEvent bank contains 48 pairs in six categories. Exhausted banks
can cycle but never repeat the immediately previous pair. A custom bank needs at
least one pair per requested round; a one-pair custom bank cannot replay with new
words and asks for at least two pairs.

Phases: waiting, private reveal, oral clues, discussion, secret vote, result,
subsequent deduction cycles, round end, next round, final ranking. A deduction
cycle is distinct from a scored round. Clues allow 30 seconds, then any member
may advance; the speaker or host can advance earlier. Votes close when all eligible
players vote, or after 90 seconds when any member requests resolution. Votes are
final; self-voting and duplicate voting are rejected. A tie or protected target
means no elimination. Citizens win at zero infiltrators; infiltrators win at
parity. No new player can join an active round, but existing members reconnect.

Classique disables missions and powers. Missions adds a secret mission per player.
MyEvent adds one random power per player per round, usable once during discussion:
immunity, double vote, second clue, protection, silence. Protection/immunity and
silence last one vote; silence cannot reduce eligible voters below two. A second
clue returns to discussion. Power usage is validated and persisted server-side.

Mission success is social, not automatically detectable: the player declares it
before round end; the host confirms afterward (another player confirms the host's
mission). The server rejects self-validation and duplicate scoring. Missions
never eliminate players. Scores: camp win +5, infiltrator survival +2, each correct
vote +1, confirmed mission +2. Replay returns everyone to not-ready, clears match
scores and keeps the previous pair excluded from the next selection.

Explicit departure eliminates the player and transfers the host role if needed.
A player may take over from a host absent for two minutes. The host can remove a
player absent for two minutes to unblock revelation; all checks use server time.
Refresh exposes these actions if no intervening state change has occurred.

## Validation

- `node --test tests/*.test.mjs`: 25 passed with `PGLITE_MODULE` pointing to the
  installed PGlite module, including the existing Music database test.
- `node tests/games-rls.mjs`: 68 checks, real isolated PostgreSQL and eight synthetic
  authenticated identities. Includes migration execution, own-secret access,
  outsiders/anonymous denials, direct-write denials, private votes, scoring,
  duplicate actions, readiness, capacity, all five powers, mission approval,
  event restrictions, host takeover, departure/reconnection and expired cleanup.
- `node tests/marketplace-rls.mjs`: 34 checks passed.
- Browser: four distinct local accounts, creation, join/readiness, private
  revelation, full speaking round, discussion, four secret votes, elimination,
  winner, ranking, reload/rejoin and replay. Production UI and SQL were used via
  the local fixture, with polling rather than a real Supabase Realtime server.
- Mobile layout inspected at 390×844 and 375×812; no horizontal overflow.

Run `node tests/games-preview.mjs` for the isolated local fixture, then open
`http://127.0.0.1:4173/test?user=0` through `user=7` in separate tabs. The fixture
binds only to localhost and does not use production credentials or production data.

Still validate on real devices/accounts: iOS native share sheet; email confirmation
and login from a friend/game link; actual production friend acceptance visible on
both accounts; Supabase Realtime across phones; iPhone background/foreground and
interrupted network reconnection. A full Infiltré game needs four accounts, so use
two additional sessions alongside the two phones. These are not claimed as live
production tests.


## Défis MyEvent

`202609270003_defis_game.sql` extends the reusable game room infrastructure with
`game_key='defis'`. Apply it once after `202609270002_games_engine.sql`; the two
older migrations must not be rerun.

Défis supports 2–12 players and 3–12 challenges. The UI currently offers 5, 8,
10 or 12 challenges. A match mixes individual challenges (two points for the
designated player) and collective challenges (one point for every present
player). The server chooses the challenge sequence and targets, persists progress,
awards the score ledger, handles reconnects and finishes the match. The host
validates a successful challenge or skips it. Replay keeps the room and players
but resets readiness, challenges and scores.

The original Infiltré RPCs and rule engine remain separate. `MyEventGameSession`
now accepts an optional RPC namespace so both games share transport, Realtime,
polling, invitations and reconnection without mixing their rule state.
