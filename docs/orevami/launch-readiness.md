# Préparation du lancement — 13 octobre 2026

Base de travail : Preview commune `40468101e48d95307c497452c4b7a0679d0111a5`, réunissant les corrections Événements `4bd1e08` et Profil/Musique `0d4def74`. Production et main non modifiés pendant cette mission.

| Chantier | État | Préparation | Reste à faire |
|---|---|---|---|
| Suppression événements | Correctif local validé | delete_event supprime le parent après contrôle propriétaire ; CASCADE existants et trigger de protection inchangés ; fichiers préservés si RPC échoue | Approuver puis appliquer le SQL ; nettoyage complet Storage à finaliser avec un accès serveur contrôlé |
| Sortie IA | Erreur de chargement corrigée | ai-runtime chargé avant son extension ; erreurs fournisseurs en français ; délai réseau borné | OpenStreetMap a répondu HTTP 429 lors de l’unique contrôle réel : génération réelle complète non validée |
| Inscription et emails | Code de récupération préparé ; lancement bloqué | Demande de lien, formulaire de récupération, contrôle des mots de passe et retour à la connexion | Aucun SMTP personnalisé activé en Production ; fournir l’accès SMTP et le compte de démonstration, confirmer livraison et Safari iPhone |
| Réservations | Viator répond ; hébergement existant conservé | Une requête réelle Viator renvoie cinq résultats ; Hotels.com/Expedia/Abritel via widgets affiliés ; Omio et TicketNetwork référencés | Finir les contrôles des widgets et redirections ; aucune preuve d’approbation Booking/OpenTable/Tiqets/Musement ne doit être annoncée |
| Domaines officiels | Proposition préparée | Zones OVH et recommandations Vercel relues ; MX, SPF et DKIM préservés | Accord DNS, export complet des zones, SMTP et HTTPS/Auth validés avant basculement |

## Suppression et données

La Production conserve l’ancienne RPC, qui supprime les membres avant l’événement et déclenche « Le propriétaire ne peut pas quitter cet événement ». Ses définitions actuelles ont été sauvegardées localement. Aucun correctif SQL appliqué à Production ou Supabase TEST.

Les contraintes réelles vers events sont CASCADE, sauf personal_reservations qui utilise SET NULL. La proposition 202610130003 supprime l’événement propriétaire sous verrou ; la cascade s’exécute alors que le parent n’existe plus, cas déjà autorisé par le trigger. Le propriétaire ne peut toujours pas quitter directement son événement.

Vérification sur la base PostgreSQL locale restaurée, avec deux comptes et événements purement synthétiques annulés ensuite : refus du départ propriétaire, refus de suppression par un autre compte, suppression propriétaire acceptée, autre événement intact. Aucun événement réel supprimé.

La correction frontend collecte les chemins médias, appelle la RPC, puis tente le nettoyage Storage. Si la RPC échoue, aucun fichier n’est retiré. Si le nettoyage est incomplet, le message le signale. Les politiques actuelles ne garantissent pas le retrait de tous les binaires après disparition du parent : la suppression complète Storage reste un point bloquant distinct. Ne pas supprimer directement les métadonnées storage.objects pour prétendre supprimer les fichiers.

Sauvegarde de données précédente conservée et restaurée localement ; rafraîchir la sauvegarde avant une application Production approuvée. Retour arrière SQL : restaurer la définition sauvegardée de delete_event ; ne pas modifier event_member_guard. Retour code par retrait du commit préparé, sans toucher aux autres corrections.

## Auth et sécurité

La récupération utilise le client Supabase existant et une URL sur l’origine courante. Aucun secret ajouté. Le changement de mot de passe se fait uniquement dans une session de récupération valide, puis la session est fermée et les paramètres de récupération retirés de l’URL. Aucun mot de passe réel changé pendant les vérifications.

L’inscription existante crée le profil au premier accueil connecté. Aucune création de compte réelle effectuée sans adresse de démonstration autorisée. Auth Production conserve sa Site URL Vercel et sa redirection existante. SMTP personnalisé désactivé : le SMTP par défaut Supabase n’est pas adapté aux destinataires publics (https://supabase.com/docs/guides/auth/auth-smtp).

## Vérifications limitées

Cinq contrôles locaux réussis : URL de récupération et absence d’envoi de mot de passe, refus des mots de passe différents, déconnexion et URL propre après récupération, ordre des scripts IA, préservation des fichiers lorsqu’une suppression est refusée. Contrôle SQL synthétique local réussi. Syntaxe JavaScript contrôlée. Aucune relance des 159 tests Jeux.

12 fichiers API conservés. Aucun changement Jeux, Musique, Caméra, Stories, Amis, Stripe ou MyEvent-API. Aucun DNS modifié ni candidature commerciale envoyée. Aucun résultat fictif ajouté à Production.

Le modèle OpenAI existant est conservé ; la documentation officielle le décrit comme disponible via Responses : https://developers.openai.com/api/docs/models/gpt-5.6-luna.

Conclusion : préparation reviewable, pas encore une autorisation d’ouverture publique. Publication et fusion main nécessitent l’accord utilisateur, après résolution des blocages email, fournisseur de lieux et Storage.
