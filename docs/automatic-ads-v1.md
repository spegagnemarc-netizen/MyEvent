# ORÉVAMI — publicité automatique V1 (26 octobre 2026)

État : préparation technique livrée, diffusion réellement verrouillée. Aucun compte ouvert, aucune annonce réelle, aucun déploiement ni SQL distant. Aucun revenu généré ou estimé.

## Audit et base

- `main` examiné au SHA `213c203` : `js/ads-placement.js` n'affichait qu'un cadre réservé, sans campagne.
- Base choisie : `refactor-final` au SHA `3c1e014`, qui contient déjà la régie directe TEST complète. Branche dédiée `feat/automatic-ads-v1-20261026` ; son déploiement automatique est désactivé dans `vercel.json`.
- Réutilisés : cartes et critères de diffusion de `js/ads-runtime.js`, adaptateur `js/ads-providers.mjs`, administration existante, `myevent_is_admin()` et `myevent_account_active()`.
- Le module Sponsorisé reste inchangé, avec son garde TEST. Les paiements, prix, campagnes, statistiques et schémas existants ne sont pas modifiés. Seul le cadre décoratif sans annonce est retiré.
- La branche de base contient d'autres travaux non publiés : ne pas fusionner ou déployer toute la branche en Production. Reprendre uniquement le commit de cette mission après revue d'intégration avec la version alors courante.

## Choix des régies

AdSense est le premier choix à demander pour le site web : blocs display responsive manuels, inventaire contrôlé dans le fil. Ne pas activer le placement global « Auto ads », qui pourrait ajouter des annonces hors de nos emplacements. Google choisit les annonces ; aucun minuteur ne recharge les blocs. AdSense interdit le rafraîchissement automatique non demandé par l'utilisateur.

L'admission n'est pas acquise : contenu original et suffisant, maîtrise du site, titulaire majeur, conformité des contenus et des parcours. Le fil contient des publications utilisateur : modération et évaluation des risques avant monétisation. Vérifier le parcours de revue d'un site principalement connecté. Ne jamais donner au crawler l'accès aux discussions ou événements privés. Aucun seuil de trafic ni revenu minimum n'est inventé.

AdMob concerne une application native avec SDK Google Mobile Ads et UMP. Une APK privée, Expo Go ou une simple WebView ne constitue pas la validation d'une app pour une diffusion complète : publication dans un store pris en charge, liaison à AdMob, revue et approbation sont nécessaires. Il reste indisponible dans cette V1 web.

Aucun abonnement payant souscrit. Les démarches Google et les éventuels frais de publication mobile restent hors de cette mission.

## Architecture minimale

- `automatic-ads-policy.mjs` : validation stricte, plafond de 0 à 2, espacement de 5 à 30 publications (8 par défaut), verrou de livraison `false`.
- `automatic-ads-runtime.mjs` : un seul inventaire dans `#socialFeed`. Les positions déjà prises par Sponsorisé ont priorité ; un intervalle est conservé autour d'elles. Les deux types partagent le plafond. Observation des publications pour déclencher l'annonce à proximité de la zone visible ; aucune requête au chargement initial du fil. Sans IntersectionObserver : aucune annonce.
- Une demande par position et par document, même après mutation du fil ou réapparition d'une position. Le verrou de livraison actif désactive aussi le polling périodique pour préserver le quota. Après levée du verrou, les 30 secondes servent seulement à relire les réglages, jamais à rafraîchir les annonces. Le code Sponsorisé conserve son fonctionnement existant.
- Cartes marquées « Publicité », responsive, sans cadre réservé. Les annonces `unfilled` sont masquées. Les bloqueurs ou l'absence de CMP/configuration ne bloquent pas le fil.
- `automatic-ads-admin.mjs` : Paramètres généraux → Publicité automatique, activation, emplacement fil, fréquence, plafond, identifiants publics et déclaration d'approbation Google. Statut honnête : une saisie d'identifiants ne prouve pas la connexion. Lien vers les rapports officiels ; pas de synchronisation ni chiffres fictifs.
- Schéma préparatoire `automatic-ads-v1-schema.sql` : nouvelle table isolée, aucune table existante modifiée. Lecture aux comptes actifs, mise à jour aux seuls administrateurs actifs par RLS, sans fonction SECURITY DEFINER ajoutée. Insert/delete interdits aux clients. Schéma non installé à distance : l'administration affiche cette indisponibilité et le runtime reste fermé.
- Suspension locale immédiate. Suspension des autres sessions en ligne lors de leur prochaine lecture (30 s maximum pour une page visible, hors latence réseau). Une coupure distante instantanée n'est pas promise. Au retour d'arrière-plan, les réglages sont revérifiés au prochain cycle.

## Consentement et données privées

Aucun script Google tant que configuration, environnement Production, approbation, verrou de livraison ET callback positif d'une CMP attendue ne sont pas réunis. Le consentement de mesure du module Sponsorisé n'est jamais réutilisé pour Google. Une case administrative ne remplace pas une CMP certifiée Google ni le signal TCF.

Le pont TCF existant est conservateur (Google vendor 755, finalités 1/3/4 consenties, CMP choisie). Il n'est pas une CMP et ne constitue pas à lui seul une preuve de conformité de toutes les finalités ou restrictions éditeur. Sa compatibilité doit être validée avec la CMP réellement choisie avant de lever le verrou. Refus aussi accessible qu'acceptation dans cette CMP ; accès permanent à ses préférences à intégrer selon sa documentation.

Un bouton dans le fil permet déjà de refuser/retirer les annonces automatiques. Le refus est mémorisé localement (préférence fonctionnelle, cookie de six mois de secours et localStorage), bloque le runtime sur les visites suivantes et se propage aux autres onglets via storage. Ce refus local reste prioritaire sur un consentement CMP. Pour reconsentir ultérieurement, prévoir le parcours officiel CMP et la levée explicite de cette préférence ; pas de réactivation silencieuse.

Retirer un script déjà exécuté n'annule pas son exécution. Après une demande publicitaire, destruction/retrait et sortie du fil déclenchent donc un rechargement du document. Les requêtes passées ne sont pas annulables rétroactivement. Tester ces transitions avec la CMP réelle avant activation.

Le code ne transmet aucun texte, identifiant d'événement, message, position GPS, e-mail ou profil au fournisseur : seuls les identifiants publics d'éditeur/bloc configurés sont fournis. **Limite bloquante de la SPA** : un SDK tiers présent dans le document peut accéder au DOM, même caché. Aucun audit de cette préparation ne permet de certifier que Google n'accédera jamais à une donnée privée. Avant activation, isoler la surface monétisée publique du DOM privé (document/origine adapté et intégration CMP validée), ou démontrer par revue et essais que le document monétisé est dépourvu de données privées. Le verrou reste `false` tant que cette condition n'est pas satisfaite. Ne pas prétendre que le seul hash `#home` assure cette séparation.

Aucun chargement Google sur Preview/TEST, même avec de vrais identifiants. Le refus local concerne cette V1, pas les traceurs de widgets préexistants. La politique de confidentialité actuelle reste préparatoire : compléter destinataires, finalités, durées, transferts et exercice des droits avec les traitements réels avant activation.

## Validation et étapes externes

Tests locaux : `node --test tests/automatic-ads.test.mjs tests/ads-providers.test.mjs tests/ads-ui.test.mjs` (15 tests, dont vérifications d’administration et de RLS). PostgreSQL local PGlite pour autorisations et contraintes ; DOM simulé pour inventaire différé et transitions ; pas de Google, clic artificiel, Stripe ou Supabase distant. Ces tests ne prouvent ni approbation Google, ni compatibilité avec une vraie CMP, ni affichage réel sur iPhone.

Avant revenus :
1. Revoir et installer le schéma d'abord dans Supabase TEST ; vérifier accès administrateur et refus des autres comptes. La future migration versionnée sera créée via le CLI, après revue ; ne pas appliquer ce fichier en Production.
2. Corriger/valider la séparation des données privées décrite ci-dessus et le parcours public de revue, modération et confidentialité.
3. Créer le compte AdSense au nom du titulaire, soumettre `orevami.com`, faire vérifier le site et attendre l'approbation. Aucune garantie d'acceptation.
4. Choisir/configurer une CMP certifiée Google et intégrée au TCF (ex. solution proposée par Google après vérification de son adéquation), valider refus, acceptation, retrait et restrictions. Aucun abonnement souscrit.
5. Configurer un bloc responsive, les vrais identifiants publics, le CMP ID et l'ads.txt exactement fourni par le compte approuvé. Aucun faux ads.txt ajouté.
6. Revue des changements seuls contre Production, essais ciblés de la CMP sans annonces réelles, autorisation explicite de déploiement puis d'activation. Prévoir l'application du schéma Production seulement avec autorisation distincte. Lever le verrou de livraison après résolution des blocages ; activer le réglage ensuite.
7. Consulter les rapports Google pour impressions, couverture et revenus réels ; configurer identité, informations fiscales et paiement dans Google. Aucun revenu synchronisé ni seuil de paiement promis ici.

Sources officielles consultées le 26/10/2026 :
- https://support.google.com/adsense/answer/9724 (éligibilité)
- https://support.google.com/adsense/answer/13554116 (CMP certifiée)
- https://support.google.com/adsense/answer/1346295 (emplacements, refresh)
- https://support.google.com/adsense/answer/3011869 (contenus utilisateurs)
- https://support.google.com/admob/answer/10564477 (app readiness)
- https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi
- https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ
- https://supabase.com/docs/guides/database/postgres/row-level-security
