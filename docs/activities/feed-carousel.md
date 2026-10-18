# Sorties & Rencontres dans le fil — TEST

Le bloc du fil est désormais un carrousel horizontal natif avec alignement des
cartes au défilement, accessible au toucher et au clavier. Son titre est
« 🌍 Sorties & Rencontres » et le lien « Voir toutes les sorties » ouvre la
découverte du module existant. Les 42 catégories illustrées sont réutilisées.

Chaque carte montre titre, illustration ou couverture autorisée, date, ville,
compteur et places disponibles. La carte et « Voir l'activité » ouvrent la fiche
réelle par son identifiant. « Participer » ou « Demander à rejoindre » ouvre cette
fiche et son parcours existant de confirmation, sans nouvelle logique d'inscription.
Organisateur, inscription existante, demande en attente ou sortie complète sont
traités sans proposer de nouvelle inscription.

Les lectures réutilisent exclusivement `activities_capabilities` et
`activities_list`. Les RLS et restrictions adultes restent appliquées par le
serveur ; le client ajoute un filtre strict `public`, état `open`, date future,
et une déduplication par identifiant. Les activités réservées aux amis, privées,
annulées ou passées n'apparaissent pas dans ce carrousel. Aucune adresse précise
ou liste de participants n'est affichée dans le fil.

Lecture TEST du 19 octobre 2026 : activation désactivée, aucun accès adulte
autorisé, aucune activité enregistrée et RLS actif sur les sept tables du socle.
Aucune écriture distante, migration, nouvelle table, RPC ou permission.

En conséquence, le fil réel affiche un état TEST fermé sans carte inventée ni
participation active. `tests/activity-feed-preview.html?mobile=1` présente le même
composant dans un aperçu du fil avec trois exemples fictifs et boutons de
participation désactivés. Ces exemples ne sont pas des activités enregistrées.

Huit tests ciblés réussis : filtres, gardes Production/TEST et adultes, cartes,
identifiants de fiches, mode de participation, exclusions, déduplication,
relecture des RPC et purge lors d'un changement de session, y compris réponses
tardives. Aucun test distant d'inscription effectué.

Persistance : le bloc recharge les activités depuis les RPC existantes, sans base
secondaire ni stockage local. La création réelle puis le rechargement ne peuvent
pas être validés tant que création enrichie et activation restent fermées ; ce
parcours n'est donc pas annoncé comme opérationnel. La relecture et la stabilité
des cartes sont vérifiées avec des réponses fictives dans les tests locaux.

Les captures montrent un aperçu TEST, pas un fil contenant des sorties publiées.
La vérification mobile concerne une fenêtre de navigateur de 390 × 844 px ;
Safari sur un iPhone physique reste à valider. Aucun changement de main, de
Production, d'orevami.com ou de MyEvent-API.
