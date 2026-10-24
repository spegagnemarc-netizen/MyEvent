# Diagnostic ciblé Site web — 25 octobre 2026

Production de référence : 0a426fa5e174b26b98c9d1febb5e4b1ff7f22c80.

La réponse réelle de /api/search-places?mode=restaurant, centre Gap, rayon 20 km, contient La Vague, 1 Boulevard de la Libération, 05000 Gap, France, website:null. Aucun lien fourni dans ce résultat ; La Vague n'est pas l'une des 20 entrées du catalogue éditorial. Cela ne prouve pas l'absence d'un site officiel dans le monde réel. Aucune recherche exhaustive ou validation manuelle de nouveau domaine effectuée.

Trois cas : URL absente → bouton masqué, découverte possible ; URL présente non validée → masqué jusqu'à confirmation ; URL validée → doit être visible même si aucun menu/horaire n'est extrait.

Corrections limitées : appliquer une validation de site indépendamment du statut des données pratiques ; faire de même dans la V2 ; mettre les découvertes suivantes en file plutôt que contourner leur validation quand deux consultations sont actives. Deux découvertes simultanées et plafond de 20 tâches conservés. Cache navigateur versionné v5 pour ne pas réutiliser les états affectés. Aucun assouplissement de l'identité ou des droits des photos.

Deux nouveaux contrôles ciblés : visibilité selon les trois états et validation du troisième restaurant visible avec concurrence maximale de deux. Aucun ancien test relancé. Catalogue éditorial et moteurs de recherche inchangés. Pas de push ni déploiement.
