# Préparation au lancement — 8 octobre 2026

Branche exclusive refactor-final. Base locale/distante vérifiée : 6aaf9c76d512e110e8510ab618c85c6e23b87e13. Cette mise à jour prévaut sur les anciens rapports pour les points vérifiés ici. Aucun changement main, Production, MyEvent-API, secret ou base de production. Sabre reste en pause.

## Corrections livrées

- Retrait du chargement de la recherche technique Sabre des deux pages utilisateur. Module client, adaptateur serveur, route et variables conservés. Hotels.com, Expedia et Abritel conservés ; aucun hôtel ou prix fictif.
- Demande de récupération de mot de passe depuis l'accueil, réponse neutre, verrou contre doubles clics, erreurs fournisseur non reproduites. Page de récupération distincte : seul l'événement PASSWORD_RECOVERY du SDK ouvre le formulaire, confirmation du mot de passe, nettoyage de l'URL, déconnexion après enregistrement. La configuration et la session restent celles de l'environnement. Aucun email ni changement de mot de passe réel effectué pendant les tests.
- Réutilisation des sources mobiles de mobile-v1-native-camera, SHA f2f5e861c364331c5cad81fabaa2d9511ff6d4dd, importées dans mobile/ sur refactor-final. L'autre branche n'est pas modifiée. Profil test-private séparé app.myevent.mobile.dev ; préparation refuse une cible non Preview ou une Preview dont le runtime ne confirme pas le projet TEST. Sources mobiles exclues du déploiement web via .vercelignore. Aucun nouveau service/backend ou nouvelle clé.

## TEST réellement constaté, lecture seule

La Preview utilise MyEvent-Admin-Test, référence ahyyknfjsielnqyoxqgh. Quatre utilisateurs fictifs Auth existent ; A/B/C ont email_confirmed_at renseigné. 51 tables public ; aucune sans RLS. Cela ne prouve pas que chaque politique est correcte.

Absences démontrées : social_stories, dm_conversations, dm_messages, game_challenges ; fonctions dm_open, dm_send, music_guard_item, music_reorder_queue, event_member_profiles, myevent_admin_identity. event_member_directory et set_event_coorganizer_verified existent. profiles, events, event_members, friendships, marketplace_listings, platform_admins, admin_account_controls et personal_reservations existent. A n'est pas super_admin. Aucun rôle n'a été attribué ici.

Auth TEST : Site URL = alias Preview refactor-final, aucune Redirect URL autorisée au contrôle initial. Ajouter les retours exacts de la candidate, notamment /reset-password.html, après revue ; conserver l'environnement TEST. Ne pas envoyer de récupération à des adresses example.com fictives : utiliser une boîte de test contrôlée pour la validation email.

La Preview est protégée par Vercel Authentication pour un client sans session. Le navigateur connecté accède à l'application ; le préflight mobile sans session est refusé. Pas de jeton de bypass ajouté dans l'APK ou les URL, pas de protection désactivée.

## État des rubriques

| Rubrique | État vérifiable / limites |
|---|---|
| Accueil/navigation | Code présent, tests navigation/races réussis ; parcours authentifiés et appareils à valider. |
| Comptes/profils | Connexion/inscription/déconnexion présentes, récupération préparée et testée localement ; email réel et reconnexion à vérifier sur TEST. |
| Événements | Rôles/visibilités/identité co-organisateur couverts localement ; création/invitation multi-compte réelle encore non validée. |
| Amis/Stories/DM | Confidentialité, expiration 24 h, interactions et notifications couvertes par SQL local ; TEST manque Stories/DM. Bloqué sur TEST. |
| Caméra web | Photos composées, suivi local et IA après capture présents ; vidéo MediaRecorder utilise le flux caméra brut, donc les effets photo ne prouvent pas des effets vidéo. Effets créés persistants et essais capteurs/appareils non démontrés. |
| Musique | Code conservé, test d'intégrité PostgreSQL exécuté ; fonctions d'intégrité manquantes sur TEST, pas de validation Safari/Android physique. |
| Restaurants | Adaptateur Geoapify, quatre rayons, dédoublonnage, carte/distances à vol d'oiseau et sites présents ; disponibilité de réservation non inventée. Vérification fournisseur réel requise. Explorer recherche GPS ; recherche événementielle réutilise la destination de l'événement. |
| Activités | Viator/partenaires présents et tests simulés réussis ; configuration/droits et résultats réels Preview à contrôler. |
| Hébergement/transports | Widgets partenaires conservés ; Sabre masqué et en pause ; aucun paiement/réservation réelle. Champs et résultats widget à contrôler en navigateur. |
| Marketplace | CRUD/photos/favoris/messages/Realtime présents et tests locaux réussis ; persistance à deux comptes sur TEST encore à valider. |
| Jeux | Moteur multi-compte testé localement ; Défis bloqué sur TEST par game_challenges absent. Aucun module AR expérimental annoncé terminé. |
| Administration | RPC/RLS protégées localement ; TEST incomplet et A non admin. Ne pas transformer une vérification client en autorisation. Suspension globale non certifiée. |
| Notifications | Inbox/Realtime/polling présents ; pas de push natif développé dans la base Expo retrouvée. |
| Android/iOS | Expo/React Native + caméra photo native + WebView des autres rubriques. Pas une réécriture native complète. Permissions configurées ; sessions WebView et refus sur appareils non vérifiés. iOS nécessite compilation/signature macOS ou service autorisé. |

## Validation et blocages

155 tests web, zéro échec/skip ; 11 suites SQL locales de permissions réussies (dont invitations). 9 tests fondation mobile et 26 tests app mobile réussis ; TypeScript réussi. Les anciennes assertions mobiles comparant toute la branche web à un ancien SHA ont été remplacées par la préservation des sources Swift/bridge importées, car refactor-final a légitimement évolué. Dépendances de chaque suite installées : ne pas exécuter les tests mobiles avec les dépendances web à leur place.

12 fonctions API, aucune ajoutée. Le build de la nouvelle Preview doit confirmer les artefacts déployés. Pas de test physique iPhone Safari/Android Chrome. Les fixtures locales ne sont pas des comptes réels Supabase.

Un ancien APK Android privé a été retrouvé et vérifié : 38 293 104 octets, SHA-256 668AA4D8F5E7C1A48C170BAA02C5C1FF2DEA7CA2AD2A88D1778BCBC9D40B3F76 ; signature v2 Android Debug. Sa cible par défaut est le domaine public historique. Il n'est donc pas une candidate TEST de cette mission et n'a pas été installé. Aucun APK nouveau ni IPA validé n'est revendiqué par ce rapport.

Priorité bloquante : aligner le schéma TEST avec les objets démontrés absents, après export/preflight ; vérifier notamment les migrations Stories 202609250002, inbox 202609280001, interactions suivantes, Musique 20260924, Défis 202609270003 et Admin V2/V3. Ne pas rejouer aveuglément les migrations (baseline historique incomplète et numéro 202609280002 dupliqué). Aucun SQL distant appliqué. Attribuer un rôle TEST nécessite une décision explicite ; aucune réattribution du propriétaire réel.

Ensuite : autoriser les redirections Auth exactes ; ouvrir trois sessions TEST séparées sans communiquer les mots de passe ; exécuter les douze parcours demandés ; confirmer un accès Preview utilisable sur appareil, produire l'APK TEST, installer/tester sur Android ; compiler/signer/tester iOS sur macOS. Prévoir une signature de distribution autorisée avant toute publication store. La signature Debug existante sert seulement aux tests privés.

Verdict : pas prêt pour une ouverture contrôlée aux utilisateurs. Preview de revue disponible après déploiement ; aucune Production autorisée.
