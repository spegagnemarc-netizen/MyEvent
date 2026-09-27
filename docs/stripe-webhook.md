# Webhook Stripe Production

## Incident du 27 septembre 2026

Le paiement Live de 0,50 EUR était payé, mais sa confirmation MyEvent échouait.
La trace Vercel du 27 septembre à 13:43:28 (Europe/Paris) montre un PATCH vers
`nxxvadbliinhvkirqkkl.supabase.co/rest/v1/rest/v1/event_fund_entries`.
La variable Production `SUPABASE_URL` contenait l'URL Data API terminant par
`/rest/v1/`, valeur confirmée par le propriétaire. L'ancien webhook retirait
seulement le slash final puis ajoutait encore `/rest/v1/event_fund_entries`.

Le chemin doublé renvoie HTTP 404 / PGRST125 et le webhook le traduisait en 500.
Une lecture sans données (`limit=0`) du chemin correct a renvoyé 200 avec les
colonnes `id,event_id,user_id,entry_type,amount,status,confirmed_by,confirmed_at`.
Le même contrôle du chemin doublé a reproduit PGRST125. Il ne s'agit donc pas
d'une colonne manquante. Aucune migration SQL n'est nécessaire.

## Correctif

Le webhook accepte une URL HTTPS de projet ou de Data API, retire les espaces
en bordure, valide sa forme puis fixe une seule fois le chemin
`/rest/v1/event_fund_entries`. Les autres chemins, paramètres, fragments et
identifiants intégrés à l'URL sont refusés. La valeur Vercel existante convient.

Le corps brut et la signature Stripe restent vérifiés avant toute écriture.
Les erreurs de signature sont des 400 ; les erreurs de configuration, réseau
ou confirmation Supabase sont des 500. Les détails sensibles ne sont pas
retournés au client et les erreurs Supabase ne journalisent que code, statut
HTTP et chemin sans paramètres.

Le PATCH demande désormais `id,status` en retour : un résultat vide ne doit
pas être acquitté comme un paiement confirmé. Seule une ligne correspondante
avec `status=confirmed` entraîne l'acquittement. Aucun INSERT et aucun ajout
au montant : le renvoi du même événement confirme la même participation.

## Règle métier conservée

- L'application crée une contribution `pending` avant d'ouvrir Stripe.
- Un événement signé `checkout.session.completed` ou
  `checkout.session.async_payment_succeeded` avec `payment_status=paid`
  confirme automatiquement la contribution référencée par `fund_entry_id`.
- Les autres événements et paiements non payés ne modifient rien.
- Comme auparavant, un événement sans `fund_entry_id` est acquitté avec un
  avertissement et aucune écriture.
- Les contributions déclarées manuellement restent `pending` jusqu'à la
  décision du créateur ou du responsable de la cagnotte. La fonction existante
  `updateContributionStatus` renseigne alors `confirmed_by` et `confirmed_at`.
- Le webhook ne se fait pas passer pour un validateur humain : il change
  uniquement `status`, sans modifier ces champs d'audit ni la somme.

Les deux mécanismes utilisent actuellement le même champ `status`. Ce correctif
ne crée pas de séparation entre statut bancaire et validation humaine et ne
modifie pas les droits de validation manuelle existants.

## Validation

`node --test tests/stripe-webhook.test.mjs` : 14 tests locaux, signatures
vérifiées avec le SDK Stripe et données fictives ; aucun appel de paiement.
Couverture : formes d'URL, signature, rejeu, paiement asynchrone, non payé,
configuration, erreurs réseau/Supabase et absence de ligne confirmée.

Après déploiement, renvoyer depuis Stripe **le même événement de 0,50 EUR**.
Attendre HTTP 200, puis vérifier la contribution existante `confirmed`, son
montant inchangé et l'absence de doublon. Ce rejeu réel est réservé à
l'utilisateur ; aucun paiement ni renvoi Live n'est déclenché par les tests.

Référence : https://supabase.com/docs/guides/api/rest/postgrest-error-codes
