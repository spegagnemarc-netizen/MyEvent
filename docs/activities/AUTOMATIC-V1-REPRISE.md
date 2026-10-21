# Reprise — fiches automatiques V1 (21 octobre 2026)

Travail interrompu à la demande de l’utilisateur (fin de quota).
Branche : refactor-final. Aucune publication Production.

Réalisé : extraction des tarifs entiers avec contexte de formule, JSON-LD offres/horaires, description, téléphone et méthode de réservation, disponibilité explicitement inconnue, cache public 15 minutes, fiche sans confirmation manuelle obligatoire des champs extraits. Site Laser Games Gap fourni par l’utilisateur lié à son identité exacte OSM way/90900940. Aucun prix en dur.

Lectures réelles réussies : Laser Games Gap (mercredi-dimanche 10h-23h, standard 10/17/24 euros, groupes 9/16/23 euros, téléphone +33781547691) et Alp’Arena (horaires et PDF tarifaire daté 2023, avertissement de validité). Résultats datés disponibles dans outputs/venue-result-0.json et venue-result-1.json du dossier de mission, hors dépôt.

Deux contrôles nouveaux du parseur et un contrôle local d’isolation du stockage réussis. Pas de campagne générale.

Supabase TEST ahyyknfjsielnqyoxqgh : migration automatic_venue_sheets_v1_test appliquée avec succès après autorisation explicite de l’utilisateur. SQL exact : automatic-venue-storage-proposal.sql. Nouvelle table privée activities_private.venue_sheets et wrappers activities_save_with_venue / activities_venue_sheet, sans modification des RPC existantes. Aucune activité créée ni utilisateur activé. Le catalogue proposé ancien n’a pas été installé.

RESTE À FAIRE : raccorder le formulaire et la relecture aux nouvelles RPC (actuellement le garde historique bloque encore la publication avec fiche enrichie), gérer sauvegarde atomique avec photo, distinguer frais organisateur et tarifs du lieu, vérifier la migration distante et ses permissions, contrôler le parcours ciblé, déployer une Preview TEST et fournir son URL. Aucun fonctionnement complet de sauvegarde ni Preview nouvelle ne doit être annoncé pour ce commit.

Ne pas toucher aux cartes de l’accueil, main, Production ou MyEvent-API. Aucun service payant ajouté. Recherche Photon/OSM existante conservée ; découverte de site limitée aux liens déclarés et références exactes vérifiées, pas un moteur universel. Overpass indisponible pendant la lecture du lieu Laser Games Gap.

Reprise au même endroit, sans refaire les lectures et contrôles réussis. Le SQL est déjà appliqué : ne pas le rejouer. Garder les nouvelles tables et données pour un retour arrière sans destruction.
