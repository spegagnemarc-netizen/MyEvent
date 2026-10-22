# Fiches automatiques V1 — livraison TEST

Branche refactor-final ; reprise du checkpoint 393eb26. Production, main, MyEvent-API et cartes de l’accueil inchangés.

Sélection du lieu → lecture automatique du site déclaré/référencé → fiche sourcée → ajout au formulaire → sauvegarde atomique de l’activité et de la fiche, avec ou sans photo. La description publique préremplit un champ vide. Aucune saisie d’horaires, tarifs ou réservation imposée ; aucune disponibilité ou gratuité du lieu déduite. Les frais d’organisation restent distincts des prix du lieu. Réouverture via « Informations de l’établissement » dans la fiche détaillée. La modification conserve la fiche ; son retrait explicite remplace le snapshot par un objet vide, sans suppression de données.

Stockage TEST autorisé et installé le 21 octobre : activities_private.venue_sheets, RLS, aucun accès direct authenticated/anon ; deux RPC publiques invoker déléguant aux contrôles Activités existants. Métadonnées distantes relues : RLS active, table non lisible directement, exécution RPC authenticated seulement, lecteur sans session renvoie null. Aucune activité distante créée ni utilisateur activé. La sauvegarde complète n’a pas été essayée avec un compte distant : les contrôles du nouveau raccordement sont locaux, avec transport simulé.

Contrôles déjà acquis : deux contrôles parseur, un contrôle stockage local. Ajout : sélection/sauvegarde/relecture et transmission de la photo au wrapper atomique, tous deux réussis ; syntaxe JS et diff vérifiés. Pas de campagne générale ni répétition des anciens tests.

Laser Games Gap : horaires mercredi-dimanche 10h-23h (variations vacances/jours fériés), laser standard 10/17/24 euros, groupes dès 15 personnes 9/16/23 euros ; autres formules extraites avec leur contexte ; réservation par téléphone +33781547691. Source lue le 21 octobre : https://lasergamesgap.fr/. Site rattaché à OSM way/90900940 après recherche réelle, aucun tarif en dur. Deuxième site : https://www.ville-gap.fr/alp-arena/ ; horaires et tarifs PDF datés de 2023 retrouvés, validité non confirmée signalée.

Limites : découverte des sites via les liens OSM et références éditoriales exactes, pas de moteur Web universel. Photon et Overpass publics sans garantie de service ; panne Overpass observée. JSON-LD, HTML accessible et PDF texte réutilisés ; protection DNS/SSRF, robots, tailles/délais conservés ; cache public mémoire 15 minutes, 40 entrées. Sites bloqués, JavaScript seul ou informations absentes restent explicitement incomplets. Pas d’IA payante ni nouvel abonnement. Coûts d’exécution Vercel selon forfait existant ; aucun montant supplémentaire engagé. Geoapify et Viator présents dans le projet, aucun nouvel appel payant ni API partenaire de réservation activée. MyEvent-API non modifié ; aucune capacité contractuelle de réservation partenaire confirmée ici.

Réservations V1 : lien externe déclaré ou téléphone. Réservation directement dans ORÉVAMI indisponible tant qu’une API partenaire et ses droits ne sont pas validés. Aucun achat, réservation ou paiement effectué.

Retour arrière : commit 393eb26, conserver la table TEST et ses fonctions sans les supprimer. Production interdite sans nouvel accord explicite.
