# ORÉVAMI — reprise bloquée par un candidat absent

Contrôle du 20 octobre 2026. Aucune modification applicative ou distante.

## Git vérifié

- Le connecteur GitHub répond « No commit found for SHA » pour cee926fd46f5d154f1f5facae881133596eee34d. Le clone complet des références distantes ne contient pas non plus cet objet. Cela ne prouve pas son absence d'un autre poste.
- origin/integration/production-preserved-20261019 pointe sur 5c857f2a795e3e724ba42f28de0d65e46a978cac.
- 14b89e0 existe dans l'historique ; cela ne confirme pas le déploiement actuellement servi.
- Reprise applicative suspendue jusqu'à réception du candidat ou instruction explicite de poursuivre depuis 5c857f2. Aucun changement sur main.

## Production — lecture seule ciblée

Projet nxxvadbliinhvkirqkkl confirmé par server/supabase-environment.mjs.
activities_private.settings : enabled=false, registrations_enabled=false.
adult_access : zéro entrée non révoquée (comptage uniquement, aucun compte lu).
RLS activée sur activities, members, locations, adult_access, settings, notices, blocks.
RPC publiques présentes : activities_capabilities/list/detail/save/participate/safety.
allowed() exige un compte actif, le module enabled et une entrée adult_access non révoquée.
La présence des objets ne constitue pas une validation complète des corps RPC, droits et parcours.

## Architecture disponible

js/activities-runtime.js réutilise les RPC existantes, autorise certaines écritures TEST sous capacités et bloque inscription/acceptation.
js/activity-social-feed.js lit capabilities/list ; participationEnabled=false.
docs/activities contient déjà les propositions de schéma V1.5 : ne pas les réappliquer aveuglément.
Aucune intégration Yoti/Veriff/Didit de majorité repérée dans cette base ; l'accès adulte demeure manuel.

## Prestataire à évaluer, sans souscription

Piste : Yoti Age Verification, attribut de seuil 18+, de préférence preuve Digital ID et parcours de repli hébergé. La documentation prévoit des résultats au-dessus/en-dessous d'un seuil et une minimisation des données. Ce n'est pas une certification de conformité du futur parcours France/UE.

Sources consultées :
- https://developers.yoti.com/age-verification
- https://developers.yoti.com/age-verification/methods
- https://developers.yoti.com/age-verification/data-privacy
- https://www.yoti.com/terms/age-verification/organisations/

Prix actuel non établi : demander un devis et valider compte, contrat, DPA, sous-traitants, localisation/transferts, rétention et méthode avant engagement. Aucun compte créé, aucun coût engagé.

## Contrat d'intégration à préciser après récupération du candidat

- Session initiée par serveur pour l'utilisateur authentifié, référence aléatoire liée au compte, expiration et protection contre réutilisation.
- Aucun statut accordé à partir d'une redirection navigateur, d'un booléen client ou de user_metadata.
- Notification authentifiée selon le protocole du prestataire, résultat récupéré serveur à serveur, seuil et session vérifiés ; traitement idempotent, refus en cas d'erreur ou d'ambiguïté.
- Réutiliser adult_access et allowed() après examen du candidat. Le modèle approved_by obligatoire nécessite une évolution explicite pour une preuve automatique ; ne pas inventer un administrateur humain.
- Conserver seulement statut, provenance et références techniques minimales nécessaires à la révocation/audit, avec durée définie ; aucune pièce, selfie, date de naissance ou résultat brut dans ORÉVAMI ni ses journaux.
- Module et inscriptions restent fermés pendant la préparation. Aucun accès utilisateur réel ne sera activé dans cette mission.
- Raccorder création, inscription, désinscription et participants aux RPC existantes ; vérifier seulement les parcours modifiés dans un environnement isolé après récupération de la bonne base.

## Déblocage indispensable

Fournir le commit candidat via une branche poussée ou une archive Git, ou autoriser explicitement l'abandon de ce candidat pour repartir de 5c857f2. Ensuite seulement préparer les changements fonctionnels et contrôles ciblés. Toute souscription, écriture Production et mise en service demandera l'autorisation correspondante ; aucune publication n'est autorisée.
