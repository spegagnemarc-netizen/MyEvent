# ORÉVAMI — correctifs isolés

Base obligatoire : `ba3c53bb64c5e9572bc24d2e536bfae02aa87e5d`, Production `dpl_H41hwBD1AQCTFy3RD79EpBdsCtPH`.

## Causes et portée

- Jeux : la Production contient la version du salon à deux jeux. Le diff avec `9a3ed60` est limité à neuf raccordements, sept lignes CSS et au chargement du module supplémentaire. Restauration de ces raccordements et du module, sans fusion de branche. Tests et SQL historiques de référence récupérés avec les protections de participation `2a15479`. Les fichiers SQL servent aux tests locaux ; aucune migration distante exécutée. Les six RPC `activity_*` existent dans les deux projets. Leur présence ne prouve pas un parcours distant validé. Karaoké reste inachevé et désactivé.
- Profil : `body.profileSectionOpen #main>.card:not(#profileSettingsCard)` masque la carte sœur contenant le bouton. La règle historique `:has(+ .profileSettingsVisible)` ne suffit pas à maintenir le contrôle dans la page Profil. Déplacement du bouton existant dans le profil, sans duplication ni remplacement de son gestionnaire. Cible de 44 px et focus clavier.
- Fil caméra : l'appel unique après 500 ms peut précéder la récupération de session ; le chargeur retourne alors `[]` et ne recommence pas après connexion. Hydratation à la disponibilité/changement d'identité, suppression des doublons, refus des réponses d'un ancien compte, nettoyage à déconnexion, erreur visible et nouvelle tentative. La requête existante conserve `user_id = user.id` et `media_type = image`. Aucun élargissement des droits ou contournement RLS.

## État des données, lectures seules

Production : 11 lignes `social_posts`, 0 ligne `event_feed_posts`. TEST : 3 et 1. Ces comptes ne constituent pas une comparaison avec une sauvegarde et ne permettent pas de conclure à une perte ou à une absence de perte historique. L'identifiant saisi visible dans la capture n'a pas correspondu exactement à un `profiles.username` dans les deux projets. Le compte connecté, son UUID et l'URL de la fenêtre capturée restent non vérifiés. Aucun rattachement de publication à un compte n'a été supposé.

`event_social_feed` conserve ses règles de visibilité événementielle et exige une identité authentifiée. Les boutons « Pour vous » de l'accueil modifient leur état visuel ; le chargeur de photos ne leur transmet aucun filtre. Le filtre effectif des photos est celui de l'identité et du type de média.

## Barrière de publication

`npm run test:release` couvre les quatre jeux supplémentaires, le transport/invitations, la connexion tardive, les changements de compte, les formulaires du salon et le bouton original du profil. `docs/release-preservation.json` fige 184 fichiers de Production et les scripts existants. Les fins de ligne Windows sont normalisées pour les fichiers texte. Toute mise à jour intentionnelle de cette liste exige une revue ; ne pas la régénérer automatiquement pendant une publication.

La commande n'est pas encore imposée par un contrôle distant obligatoire : aucun paramètre de branche/CI n'a été changé. Cette livraison fournit une barrière locale reproductible, pas une garantie permanente de publication.

## Publication ultérieure et retour arrière

1. Confirmer que le domaine sert encore la base ci-dessus. Si le SHA a changé, comparer les nouveaux changements et les conserver avant de reconstruire un candidat. Ne pas remplacer par une ancienne branche TEST.
2. Exécuter `npm run test:release` une fois après les derniers changements. Vérifier le diff limité et les fichiers juridiques, le mobile et les modules protégés.
3. Valider sur la Preview isolée deux comptes TEST : connexion, fil autorisé, déconnexion PC/mobile, création/reprise/fin de partie, invitations, retour et audio Blind Test. Compléter les contrôles visuels et appareils réels restés indisponibles ici.
4. Obtenir l'accord explicite de l'utilisateur pour la Production. Ne pas appliquer les SQL restaurés : l'état distant doit être comparé séparément si une incompatibilité apparaît.
5. Après cet accord seulement, préparer une construction avec l'environnement Production sans attribuer le domaine, contrôler cette construction, puis promouvoir le déploiement contrôlé. Une Preview TEST ne doit pas être présentée comme une construction Production identique.
6. Si régression après publication, réaffecter le domaine au déploiement sauvegardé `my-event-d9vg42u9u-spegagnemarc-netizen.vercel.app` (`dpl_H41hwBD1AQCTFy3RD79EpBdsCtPH`) après vérification qu'il est encore le point de retour souhaité. Aucun rollback de données ni de schéma.

Aucun déploiement Production, Google Play, changement de données, de RLS ou de configuration Supabase distante dans cette mission.
