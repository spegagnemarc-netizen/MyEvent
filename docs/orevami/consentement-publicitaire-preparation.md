# Consentement publicitaire : préparation sans activation

AdSense et AdMob ne sont pas activés par cette mission. Aucun SDK, identifiant publicitaire, bandeau fictif ou nouvelle collecte n'est ajouté.

Avant activation, inventorier les traitements et destinataires, choisir leurs bases légales et documenter les durées. Pour les usages Google concernés dans l'EEE, au Royaume-Uni et en Suisse, sélectionner une CMP certifiée répondant aux exigences Google et au TCF applicable. La certification ne garantit pas à elle seule la conformité juridique. Prévoir refus et retrait accessibles, modification des choix et conservation proportionnée de leur preuve selon une durée à valider.

Sur le web, conditionner le chargement des tags AdSense aux choix applicables. Consent Mode ne remplace pas la CMP. Les annonces non personnalisées ne dispensent pas automatiquement de consentement aux traceurs. Les scripts et widgets partenaires déjà présents nécessitent leur propre analyse ; ce plan ne prétend pas les avoir mis en conformité.

Sur mobile, préparer ultérieurement UMP : actualisation du statut à chaque lancement (`requestConsentInfoUpdate`), présentation du formulaire requis (`loadAndShowConsentFormIfRequired`), entrée de gestion de confidentialité et vérification `canRequestAds` avant requête publicitaire. Aucun SDK natif ni build Android n'est ajouté ici.

Avant mise en service : validation du responsable, configuration de la CMP, vérification des refus/retraits, actualisation de la politique et des déclarations des stores, puis autorisation de publication distincte.

Sources déjà examinées : [CMP Google](https://support.google.com/adsense/answer/13554116?hl=en), [politique Google de consentement](https://www.google.com/intl/en-GB/about/company/user-consent-policy-help/), [UMP Android](https://developers.google.com/admob/android/privacy).
