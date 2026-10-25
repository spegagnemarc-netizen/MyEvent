# Recoupement des sites — 25 octobre 2026

Diagnostic réel Kiyomi : appel direct de analyseRestaurant à https://www.kiyomisushi.fr/ renvoie getaddrinfo EAI_AGAIN. Il s'agit d'une défaillance DNS dans cet environnement, pas d'une preuve de domaine incorrect, ni d'un succès de lecture.

Contrôle externe ciblé : Bottin (extrait indexé, lecture directe 503) associe Kiyomi, 19 rue Carnot, Gap, 09 83 37 76 52 et kiyomisushi.fr. Tripadvisor confirme le nom, adresse et téléphone (page consultée directement). Les mentions de l'éditeur Kiyomi confirment ces éléments et le domaine via leur extrait indexé. Tripadvisor n'est pas utilisé comme preuve du domaine, et aucune photo/note/avis n'est copié. Trois preuves sont conservées avec leurs modes de consultation, dates et expiration au 24 novembre 2026.

Mécanisme générique de recoupement : registre interne de preuves examinées, jamais attestations du navigateur. Nom, rue/numéro, ville concordants ; téléphone identique entre preuves et au résultat si fourni ; au moins deux éditeurs indépendants, et au moins une preuve explicite du domaine HTTPS. Preuves périmées, nom seul, téléphone divergent ou adresse différente : refus. Le registre actuel ne contient que Kiyomi ; il n'automatise pas l'examen éditorial d'autres établissements. Les pages indisponibles en lecture directe ne fournissent ni menus, ni horaires, ni photos par ce recoupement.

Le registre est consulté côté serveur avant découverte réseau pour fournir un résultat même si RSS/Wikidata sont indisponibles, et avant invalidation d'un candidat enregistré. Le cache navigateur v7 écarte les états négatifs antérieurs. Les réponses distinguent reader_unavailable de identity_not_confirmed ; cette distinction n'accorde pas elle-même la validation.

Résultat ciblé avec les preuves réelles : Kiyomi accepte https://www.kiyomisushi.fr/ ; miniature V3 et fiche V2 utilisent website_verified=true indépendamment des données pratiques. La Vague (1 boulevard de la Libération, Gap) n'a pas de preuve de domaine suffisante : aucun bouton. Les sources consultées ne permettent pas d'affirmer qu'aucun site n'existe. Aucun domaine supposé n'est généré.

Le catalogue des 20 restaurants n'est pas modifié. Kiyomi reste un résultat du fournisseur, pas une 21e entrée créée. Anciennes corrections conservées ; aucun ancien test relancé ; aucun push/déploiement ni écriture Supabase/MyEvent-API.
