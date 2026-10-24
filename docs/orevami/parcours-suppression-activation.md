# Suppression de compte : préparation et activation

État au 24 octobre 2026 : code préparé, canal désactivé par défaut, aucun envoi réel ni effacement exécuté.

## Fonctionnement préparé

Profil → lien de suppression → page publique → connexion et confirmation explicite → POST authentifié. Le serveur interroge le service Auth pour identifier le compte et son adresse vérifiée ; le navigateur ne peut pas choisir un autre identifiant. Le serveur transmet une demande au responsable à contact@orevami.com, avec référence, identifiant vérifié, adresse, date et confirmation. Le responsable exécute ensuite la procédure manuelle documentée.

Seule une acceptation SMTP explicite déclenche la réponse 202 et sa référence. Elle ne prouve ni la livraison finale, ni une lecture, ni une suppression. En cas d'erreur ou de délai dépassé, aucune réussite n'est annoncée ; une nouvelle tentative peut créer un doublon. Aucun e-mail n'est à rédiger par l'utilisateur dans ce parcours.

## Configuration future, exclusivement côté serveur

- Confirmer l'offre réelle de la boîte OVH et ses paramètres SMTP. La préparation utilise smtp.mail.ovh.net, port 465, TLS, identifiant contact@orevami.com ; vérifier leur adéquation à l'offre avant activation.
- Renseigner via un gestionnaire de secrets serveur `ACCOUNT_DELETION_SMTP_PASSWORD`, sans dépôt Git, copie dans le chat, journalisation ou export client.
- Ne renseigner `ACCOUNT_DELETION_ENABLED=true` qu'après validation de la configuration et autorisation du test. Sans ces deux variables, le formulaire demeure indisponible et aucun SMTP n'est sollicité.
- Ne pas utiliser de clé d'administration Supabase : le serveur vérifie seulement le jeton du compte auprès du service Auth. Aucun changement de base n'est requis par ce code.

Aucun secret n'a été créé, consulté ou configuré dans cette mission. Aucune vérification de connexion SMTP ni aucun envoi n'a été effectué.

## Protections et limites

Origines autorisées, JSON strict, confirmation obligatoire, compte et adresse vérifiés côté serveur, destinataire et expéditeur fixes, pas de pièce jointe ni de journal contenant le secret. Limite d'une tentative par compte et par minute dans chaque instance, avec mémoire bornée ; ce n'est pas une limitation distribuée. Les références facilitent le rapprochement manuel, sans file persistante ni déduplication durable. Les demandes reçues restent dans la boîte OVH ; leur durée de conservation reste à décider.

Les contrôles locaux utilisent des identités et transports simulés : refus, erreurs Auth/SMTP, confirmation, désactivation et liens. Ils ne prouvent pas la livraison réelle. La nouvelle dépendance SMTP est verrouillée mais le transport réel n'a pas été exercé.

## Conditions avant déclaration opérationnelle

Autoriser un envoi fictif vers la boîte professionnelle, vérifier sa réception, l'accusé manuel et la clôture. Tester séparément l'effacement complet d'un compte fictif dans un environnement expressément autorisé, avec médias et contenus associés. Arrêter les durées et exceptions de conservation. Aucun essai sur Supabase production n'est autorisé dans cette mission. Le formulaire désactivé ne permet pas de déclarer l'exigence de suppression Apple satisfaite.

Sources déjà examinées : [OVH](https://docs.ovhcloud.com/en/guides/web-cloud/email-and-collaborative-solutions/mx-plan/landing-page-mx-plan), [Apple](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion), [Google Play](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
