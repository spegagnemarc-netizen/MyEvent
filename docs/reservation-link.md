# Ajouter ma réservation par lien

## Base retrouvée et restauration ciblée

Le dossier `C:/Users/spega/OneDrive/Documents/MyEvent/MyEvent/work/hotels-production` conserve le commit exact `1cf57714baf09b0b383ee34ba328dc6e482c5c4d` utilisé pour `dpl_GiSMHGJAhBATPy4KDEzFK9j59cNH` (publication directe Vercel, sans push GitHub).

Le travail part du HEAD GitHub propre `dd0d50241a4ec05ea760c92e153cde012af71c0d` sur `refactor-final`. Le bloc de recherche Hébergement, la section Expedia Vols, le runtime des widgets et le CSS ciblé ont été repris du commit de production. L'arbre complet de production n'a pas été remplacé : il provient d'un historique divergent et aurait supprimé des fonctions et contrôles de la branche actuelle. Aucun merge ni push forcé.

Identifiants conservés : Hotels.com `fr-hcom / stays / 1110lR6fx / myevent-hebergement`; Expedia `fr-expedia / stays ou flights / 1011l6tumI / myevent-expedia`; Abritel `abritel / stays / 1100l6v4qo / myevent-abritel`; réseau `pz`. Omio conserve `omio-affiliates` et `https://omio.sjv.io/c/7865634/3963000/7385?u=`. Un seul script officiel Expedia Group.

## Parcours et données

Le même dialogue est accessible depuis Hébergement, Transport et la timeline. Le lien HTTPS est validé, le fournisseur détecté sur les limites exactes du domaine. Les champs présents dans les paramètres des partenaires reconnus (destination, dates, adultes, nom explicite éventuel) sont proposés comme critères à vérifier. Le lien original et ses paramètres affiliés sont conservés sans réécriture.

Aucun scraping, extraction serveur, proxy, contournement de connexion ou appel vers l'URL collée. Il n'y a donc pas de surface SSRF d'extraction. Les métadonnées absentes restent vides : nom, adresse et photo manquent souvent; liens courts et fournisseurs inconnus nécessitent la saisie manuelle. Les dates Expedia Vols complexes non présentes au format ISO nécessitent aussi une saisie manuelle. Une URL d'annonce n'est pas une confirmation.

L'utilisateur peut éditer les champs, puis confirmer l'ajout. Le statut initial est « Hébergement/Transport ajouté · réservation à vérifier ». Le statut confirmé exige une déclaration explicite d'une réservation effectivement réalisée; aucune confirmation n'est inventée ou vérifiée automatiquement. Le nombre de voyageurs et la référence restent facultatifs. Une heure absente reste absente.

Le stockage réutilise `messages` avec `[[MYEVENT_ACCOMMODATION]]` et `[[MYEVENT_TRANSPORT]]`, selon l'architecture existante. Aucun nouveau schéma, RPC ou migration. Les listes et la timeline relisent ces mêmes enregistrements après rechargement. Les réservations importées conservent leurs informations; leur ancien éditeur destructif est retiré des cartes Transport. La modification des anciennes entrées manuelles continue de fonctionner.

Une adresse seule ou le paramètre `latLong` d'une recherche ne déclenche jamais de géocodage automatique pour ces entrées. Un repère ne s'affiche que si les coordonnées sont dans les limites légales, associées à une adresse exacte et explicitement vérifiées par l'utilisateur. C'est une vérification déclarative, pas une validation géographique indépendante.

## Accès et justificatif

Le formulaire revérifie dans les tables existantes que l'utilisateur est le propriétaire ou un coorganisateur, ainsi que l'identité du compte et de l'événement avant insertion. Cette restriction de rôle est applicative : les droits serveur restent ceux des policies existantes de `messages`. Aucun privilège supplémentaire n'est créé. La confidentialité dépend de la policy existante `event_scope_read_v2`; le test local couvre owner, membre, extérieur, anonyme, autre événement et membre retiré. Les policies distantes ne sont ni modifiées ni auditées par cette mission.

Le justificatif facultatif (PDF, JPEG, PNG, 200 Ko maximum, signature vérifiée) est encodé dans le message événementiel protégé, plutôt que dans un bucket public. Il est partagé avec les membres de l'événement, annoncé avant sauvegarde. Aucun contenu n'est enregistré dans localStorage, et le téléchargement relit le message avec le filtre de l'événement sous RLS; le fichier n'est jamais exécuté dans la page. Le chat présente un résumé, sans afficher les données binaires. La limite de taille permet de rester compatible avec ce stockage historique; aucun OCR ni analyse de justificatif.

## Validation

`node --test tests/reservation-link.test.mjs tests/travel-partners.test.mjs tests/accommodation-widget.test.mjs tests/accommodation-search.test.mjs tests/travel-routing.test.mjs` (jsdom requis, comme les tests widgets existants).

`node tests/reservation-link-rls.mjs` utilise PGlite local seulement. Build Vercel Preview : aucun endpoint supplémentaire, quota de 12 fonctions conservé.

`tests/reservation-link-preview.html` permet la validation mobile sans Supabase : ajouts en mémoire uniquement. Le test navigateur ne crée aucune donnée distante. La persistance connectée et les policies du projet TEST restent à valider par l'utilisateur; aucun changement à Supabase distant ou à la production.
