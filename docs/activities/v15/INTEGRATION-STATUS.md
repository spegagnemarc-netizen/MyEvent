# Sorties & Rencontres — intégration V1.5, 19 octobre 2026

## État distant réel

Contrôles en lecture seule sur TEST ahyyknfjsielnqyoxqgh :
- sept tables avec RLS et six RPC publiques ; catalogue complet identique à la référence avant V1.5 ;
- aucune colonne V1.5 : schema-proposal.sql **non appliqué** ;
- settings.enabled=false ; aucun accès adulte actif ; zéro activité enregistrée.

Aucune migration ni activation n'est effectuée dans cette mission. Production,
main et MyEvent-API ne sont pas modifiés.

## Code préparé

- Le client accepte les lectures autorisées par les RPC existantes. La création
  exige enabled=true, adult_access=true, version=2, registrations_enabled=false
  et l'UUID TEST de tutoriel-organisatrice. Ces vérifications client complètent
  les contrôles serveur, elles ne les remplacent pas.
- Enregistrement par activities_save du type précis, catégorie générale, nom du
  lieu, adresse, coordonnées, capacité, date, frais du groupe, statut des frais
  d'établissement et précision tarifaire. Pas de seconde base de sorties.
- Lors d'une modification, le GPS autorisé de la fiche est conservé.
- Adresse et GPS privés continuent d'être filtrés par le serveur. La fiche rend
  l'organisateur, la carte et un lien d'itinéraire à partir de la réponse autorisée.
- Participation et acceptation restent interdites par le dispatcher du client,
  même si une capacité serveur devient active. Le SQL V1.5 ajoute le verrou
  serveur indépendant exigé avant l'activation limitée.
- Cartes réelles du fil chargées par activities_list, filtrées, dédupliquées et
  liées aux fiches ; cadre et page sombres, retour au fil conservé.
- Filtres Aujourd'hui, Ce week-end, Gratuit, À proximité sur les lignes autorisées.
  Gratuit exige groupe ET établissement gratuits ; les frais inconnus sont exclus.
- Questionnaire Pour vous : loisirs, gratuit ou tous budgets, rayon. Classement
  déterministe sur les sorties déjà accessibles ; aucun élargissement des droits.
  Préférences en mémoire, effacées à la fermeture/changement de session, jamais
  enregistrées dans le profil. Pas de budget total chiffré déduit de tarifs inconnus.

Les photos restent en aperçu local. Les sites, liens de réservation, horaires,
extraits de tarifs et sources externes enrichies restent dans le brouillon : seul
le noyau du lieu (nom, ville, adresse, GPS) est inclus dans cette persistance.
Aucun catalogue partagé ni historique/favoris de lieux n'est annoncé opérationnel.
Les discussions Activités restent à finaliser dans une mission distincte.

## Autorisations nécessaires, séparées

1. schema-proposal.sql : script exact déjà présenté, SHA256
   0eef4387b2cf1472ec8c80e38ea0259705e553db2485cd7982a2fa5d768eaa90.
   Quatre colonnes, trois CHECK ajoutés, quatre fonctions privées adaptées.
   Sept tables, six RPC publiques, RLS et permissions conservées. Transaction
   atomique, comparaison avant/après, arrêt sur divergence et rejeu sans changement.
   L'installation laisse activation et inscriptions fermées.
2. Après installation, contrôles et validation du client compatible : demander
   séparément l'autorisation pour activation-proposal.sql. Seul le compte fictif
   tutoriel-organisatrice est ajouté à la liste d'accès, avec l'administrateur TEST
   existant comme approbateur. Inscriptions fermées côté serveur pour tous.
3. Ensuite seulement : authentification sécurisée du compte fictif, création des
   trois sorties TEST par les RPC normales, lecture/reconnexion et captures.

Le fichier ../proposal.sql est une référence du socle déjà installé, utilisée
uniquement par les tests PostgreSQL locaux. **Ne pas réinstaller ce socle TEST.**
schema-source.sql est une lecture du delta, pas un substitut au script protégé.

## Vérifications

40 tests ciblés réussis (0 échec), sans rejouer les parties des Jeux. Couverture :
conservation des 347 fichiers, navigation/retour/focus, catégories, données et
permissions SQL locales, champs sauvegardés, verrouillage selon version/compte,
filtres temporels/distance/gratuité, recommandations, géographie, fiches,
repli fournisseur et sécurité de l'analyse d'URL.

Les données locales de tests ne sont pas des sorties Supabase. Aucun parcours
création → persistance distante → reconnexion n'est certifié tant que les deux
étapes SQL ne sont pas autorisées. Safari iPhone physique reste à valider ; aucun
navigateur Chromium n'est présenté comme une validation Safari.

## Préparation Production, sans activation

Le client et l'API restent limités à Preview et au projet TEST exact. Aucun
retrait de cette barrière n'est inclus. Pour une future version publique :
- adapter et faire approuver un socle Production contre son catalogue réel,
  sans copier les UUID, autorisations ou données fictives de TEST ;
- garder un verrou serveur inscriptions=false indépendant de la consultation
  et de la création ; refus par défaut en cas de configuration absente ;
- conserver les gardes de visibilité, blocage, rôle organisateur, suspension,
  capacité transactionnelle, adresses privées, journalisation et modération ;
- valider un réel parcours d'éligibilité adulte : le compte fictif TEST ne vaut
  pas procédure de vérification de personnes réelles ; mineurs non activés ;
- faire approuver séparément les règles de stockage des photos et données de
  fournisseurs avant toute persistance enrichie ou catalogue partagé ;
- revoir les droits d'exécution/SECURITY DEFINER existants et la reproductibilité
  des dépendances avant publication ; aucun GRANT/RLS Production modifié ici ;
- tester le lot public retenu sur ordinateur et iPhone, puis présenter SHA,
  migration exacte éventuelle et plan de retour arrière avant autorisation finale.

Aucun script Production exécutable n'est prétendu prêt sur la seule base de TEST.
Le précédent plan de retour arrière est dans docs/integration/RELEASE-REVIEW-20261019.md.
