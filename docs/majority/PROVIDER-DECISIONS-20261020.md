# Prestataire — décisions préalables à l'activation

Sauvegarde exacte 24dc92d3a5413112d99d69c50216c26f86fbcfef publiée après vérification de l'absence de branche distante, sans force : https://github.com/spegagnemarc-netizen/MyEvent/tree/work/orevami-majority-audit-20261020 . main reste be4622bf. Production Vercel relue après push : dpl_4NKRbJpZNkhvuHWHQSWH8eJXpcKs, source 14b89e0.

La préparation supplémentaire reste sur la branche locale work/yoti-provider-preparation-20261020 ; elle ne déplace pas la sauvegarde exacte demandée.

## Choix commercial et budget

Tarifs consultés le 20 octobre 2026, devis et taxes à confirmer selon contrat.

| Prestataire | Prix public observé | Conséquence pour ORÉVAMI |
|---|---|---|
| Yoti AVS | Prix par contrôle à négocier. Conditions par défaut : mise en place 250 GBP HT ; assistance intégration et diligence à 750 GBP la demi-journée chacune si sollicitées et non exclues ; contrat annuel, reconduction annuelle, préavis 30 jours. | Ne pas ouvrir un compte Hub avant accord : ouverture ou bon de commande engage le client. Exiger devis explicite, frais exclus/non applicables, minimums, événements facturés et plafond. |
| Didit | Estimation 0,10 USD ; ID 0,15 USD ; ensemble KYC publié à 0,33 USD, 500 vérifications gratuites mensuelles pour cet ensemble, hors conditions des autres modules. | Option à faible coût apparent, mais estimation seule insuffisante près de 18 ans ; repli documentaire et coût total à confirmer. Vérifier rétention et minimisation réelle des réponses KYC. |
| Veriff | Offre IDV Essential à 0,80 USD par vérification, minimum 49 USD/mois. | Repère tarifaire IDV, pas un devis garantissant l'inclusion d'Age Validation. Confirmer offre, conservation et sortie limitée au statut 18+. |

Sources officielles :
- Yoti, conditions §§1,6,7 : https://www.yoti.com/terms/age-verification/organisations/
- Didit : https://didit.me/pricing/ et https://didit.me/products/age-estimation/
- Veriff : https://www.veriff.com/plans/self-serve et https://www.veriff.com/product/age-validation

Recommandation : demander un devis Yoti AVS limité à l'attribut 18+, sans souscription, puis choisir selon coût total et garanties de données. Aucun message commercial envoyé ; aucun compte créé, contrat accepté ou paiement effectué. Le choix Yoti n'est pas irréversible, mais changer de prestataire nécessitera d'adapter la source de preuve SQL actuellement limitée à yoti.

## Parcours, données et durée

Décider d'une preuve Digital ID sans estimation comme preuve finale, avec repli documentaire hébergé optionnel chez le fournisseur. Aucun document ou selfie dans ORÉVAMI. Valider DPA, sous-traitants, localisation/transferts, effacement, information utilisateur et mécanisme de contestation. Ne pas confondre déclaration de conformité commerciale et validation du parcours ORÉVAMI.

La réutilisation du statut lié au compte est prévue par les conditions Yoti (§4.2), sans fixer une durée de validité légale : choisir la durée de preuve (90 jours actuellement proposée), les purges des tentatives et preuves expirées et le traitement des révocations. Le tarif total doit inclure les nouvelles vérifications induites par cette durée.

## Raccordement préparé, non activé et non testé dans cette étape

server/yoti-age-adapter.mjs implémente le contrat déjà préparé : création AVS côté serveur, référence opaque aléatoire, URL hébergée en français, relecture authentifiée du résultat, validation de type OVER/seuil18/méthode/session/SDK, rejet des états inconnus, taille de réponse bornée, délai réseau et absence de redirection réseau. L'adaptateur est désactivé par défaut, non importé par une route, sans secret ajouté ni appel réel. Digital ID n'accepte pas une preuve d'âge estimé ; repli document désactivé par défaut. La réponse normalisée ne contient que liaison/session/seuil/statut booléen.

Documentation officielle consultée :
- https://developers.yoti.com/age-verification/create-a-session
- https://developers.yoti.com/age-verification/launch-the-user-view
- https://developers.yoti.com/age-verification/results
- https://developers.yoti.com/age-verification/digital-id
- https://developers.yoti.com/age-verification/sandbox-integration-guide

Avant branchement effectif : confirmer le schéma exact accordé au compte (dont méthodes et état final), connecter une route authentifiée de début/finalisation avec contrôle d'origine, limitation persistante AVANT appel facturable et secrets serveur. Ne pas lire le résultat de majorité depuis le callback navigateur. Si un webhook est ensuite retenu, il faudra sa signature officielle et une relecture serveur. La Sandbox officielle utilise un autre chemin et une authentification OAuth différente : cet adaptateur de préparation cible l'API AVS standard et ne doit pas être pointé vers un faux endpoint de test en changeant arbitrairement l'URL.

Aucun contrôle local relancé, aucune campagne de tests, aucune nouvelle dépendance. Cette préparation n'est pas déclarée validée avec Yoti ; la validation d'intégration du compte sera une étape ultérieure distincte autorisée.

## Autorisations encore indispensables

1. Choisir le prestataire après devis, autoriser le compte externe et accepter son contrat/plafond budgétaire.
2. Valider méthode de preuve, rétention et information France/UE ; configurer les accès fournisseur par canal sécurisé, sans secret dans le chat.
3. Autoriser séparément le SQL exact sur Production, puis l'ouverture réelle aux majeurs vérifiés et la publication. Ces trois opérations ne sont pas effectuées ici ; aucune activation nominative n'est requise par le modèle automatique proposé.
