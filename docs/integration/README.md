# Réunification sécurisée — lot 1 isolé

Branche : `integration/production-preserved-20261019`.
Base réelle Production : `14b89e021906071bcb56f81c340f6cb839f54423`.
Source sélectionnée : `048b7955280c12e1a3b567c572116bbab0f280a0`.
Références vérifiées avant intervention : main `be4622bf10d0d7726f3056901f841a3e38b75b7c`, refactor-final identique au SHA source, domaine orevami.com sur dpl_4NKRbJpZNkhvuHWHQSWH8eJXpcKs.

## Principe de conservation

Aucune fusion de refactor-final. Aucun changement de main, refactor-final, MyEvent-API, Supabase ou du domaine. La base comprend les quatre publications après main : 5b0a42b, 0545b44, ac38eb4 et 14b89e0.

348 fichiers Production conservés à l'identique, empreintes dans production-preservation.json et contrôle automatisé. Cela inclut les quatre jeux supplémentaires, le moteur de chargement/les protections contre les réponses périmées, les médias/suppressions du fil, les handlers de suppression, les styles du site, les migrations, le lecteur Musique, la Marketplace et les modules caméra.

Seuls quatre fichiers existants évoluent : index.html (ajout d'un bloc autonome sans retirer de balisage/script), package.json (quatre dépendances d'analyse ajoutées, scripts existants conservés), pnpm-lock.yaml (résolutions additives ; Stripe maintenu à 22.6.2), vercel.json (une configuration de fonction ajoutée, routes existantes identiques).

Les autres fichiers sont nouveaux. Les changements source sont limités aux modules Activités, bibliothèques de lieux et contrôles associés. La recherche d'origine `/api/search-places` n'est pas remplacée : les nouveaux composants appellent `/api/integration-venues`.

## Interface intégrée

- Cadre Sorties & Rencontres dans le fil, palette du site Production : fond #102131, page #07111b, champs #0b1824, contours #28445b, accent utilisateur conservé. Les styles supplémentaires sont limités aux nouveaux composants.
- Clic sur le cadre, son titre ou son bouton ; accès clavier Entrée/Espace : grande page Sorties & Rencontres, sans démonter le fil ni changer de route.
- Retour au fil : restauration du focus sans défilement, de la position de fenêtre et des conteneurs concernés, synchroniquement puis à la prochaine frame. Aucun rechargement des publications.
- 42 catégories, recherche française par ville/type, fiche avec données explicites et datées, carte si GPS disponible, analyse URL/PDF, récapitulatif modifiable unique et conservation des données manquantes.
- Point d'entrée auxiliaire gardé caché : l'accès visible est le cadre du fil.

Atelier de validation : `/tests/integration-preview.html`. Il utilise le runtime réel, les composants réellement intégrés et l'API réelle de lieux. Aucun compte fictif ni publication sociale ne sont simulés ; les repères de défilement sont explicitement identifiés comme tels. L'application complète reste soumise à son authentification habituelle.

## Limites de sécurité et dépendances

Client et API limités à Preview et au projet TEST ahyyknfjsielnqyoxqgh. Le runtime de connexion de Production reste inchangé et refuse Production en Preview.

Le module intégré est verrouillé en lecture seule **même si la capacité serveur change** : le dispatcher n'autorise que capabilities/list/detail, le bouton de publication reste désactivé et les boutons de participation du fil restent désactivés. Aucun contournement des autorisations adultes. Aucune migration ni modification RLS. Le socle TEST fermé ne produit aucune carte d'activité réelle ; les illustrations ne sont pas des activités publiées.

| Élément | Intégration actuelle | Dépendances / suite |
|---|---|---|
| Cadre sombre, page dédiée, retour avec défilement | Intégrés, sans SQL | Validation navigateur et iPhone physique avant toute publication publique |
| Recherche géographique et fiches de lieu | Intégrées sur API TEST isolée | Disponibilité Photon/Overpass ; repli restaurant uniquement si GEOAPIFY_API_KEY existe ; extraction publique autorisée et bornée |
| Catalogue des 42 catégories | Intégré en interface | Persistance des types précis non activée |
| Création/inscription/participation Activités | Bloquées intentionnellement | Socle et procédure adulte ; autorisation distincte avant toute activation |
| Catalogue de lieux enrichis persistant et couverture | Non intégrés au stockage | Tables/RPC/Storage/RLS à concevoir et faire autoriser sur TEST avant un test de bout en bout |
| Musique locale/DJ 13d01fd | Lot suivant, non repris | Revue ciblée et YouTube réel ; TEST manque de tables présentes en Production |
| PDF location 3b11561, 2fc7f96 | Lot suivant, non repris | Pas de SQL requis par ce module ; validation téléchargement/impression et adaptation des modèles |
| Ajouts couverture/GPS/outils événements | Lot suivant, non repris | Ne pas remplacer core-runtime ni perdre les gardes Production ; petite sélection de changements nécessaire |
| Régie/paiements, natif, correction SQL de suppression | Hors lot | Missions et autorisations distinctes |

Le fait que le schéma TEST soit moins complet (Musique, non-lus Marketplace, interactions Stories) peut limiter des parcours existants dans la Preview. Ce n'est pas une preuve de suppression de code : les fichiers Production sont conservés. Pas de clonage de Production ni d'ajout SQL pour masquer ces différences.

## Doublons déjà identifiés

Sept patchs équivalents reconnus par Git, à ne pas réappliquer : f7842ba (photos du fil/IA), 92bcdad (accès événements), 9367a62 (cartes compactes), 86dc940 et fb24f4f (navigation/caméra), a937cd1 (recherche de salles), 9be85a5 (reprise IA matériel). Les modules caméra et le thème général sont déjà largement présents sous d'autres SHA. Les originaux Production sont conservés plutôt que remplacés par les versions de développement.

## Vérifications ciblées

32 tests distincts : conservation des 348 fichiers et du HTML/routes existants, catalogue, contrôles uniques, navigation cadre/page/retour, écriture interdite même avec capacité serveur active, filtrage du fil/adultes/dates/session, géographie française, repli fournisseur, conservation des faits partiels, API inaccessible en Production et mauvais TEST, sécurité des URL/DNS/redirections/robots, analyse HTML et PDF réel isolé. Aucun rejeu des parties Jeux déjà validées ; conservation vérifiée par empreinte.

La validation visuelle, le SHA final et l'URL de déploiement sont consignés dans le bilan livré dans le chat. Une Preview READY ne vaut pas certification des parcours authentifiés ni autorisation de publication Production.

## Ordre suivant recommandé

1. Examiner ce lot autonome depuis une Preview construite sur la base Production.
2. Tester une session fictive TEST pour les parcours dont le schéma existe, sans écrire dans Activités.
3. Préparer séparément PDF location puis Musique locale/DJ, sans changement global des runtimes.
4. Décider explicitement du SQL TEST nécessaire pour persistance Activités et des validations adultes/visibilité.
5. Seulement après validation et autorisation de publication : définir un lot public et une stratégie de retour arrière. Aucune fusion/promotion Production n'est exécutée dans cette mission.
