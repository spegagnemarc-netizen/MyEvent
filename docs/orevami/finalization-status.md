# Finalisation — préparation uniquement

Base : b9fff9f7ca23ddeff5704e9cb2b1ca9b74a7256b. Aucun nouveau test, aucune Preview, aucune modification de main, Production, Supabase, Stripe ou DNS.

- Corrections Profil/Musique/Événements, chargement IA et récupération de compte conservées.
- SMTP OVH enregistré en Production selon confirmation utilisateur ; paramètres inchangés, aucun test d'email.
- Recherche Sortie IA : utilisation de GEOAPIFY_API_KEY déjà configurée pour interroger les lieux OpenStreetMap via Geoapify, délai 15 secondes, rayon et normalisation existants conservés. Sans clé, parcours Overpass existant conservé. Aucune requête réelle effectuée pendant cette intervention ; disponibilité et autorisation Places de la clé non confirmées.
- Hotels.com : secours vers le site officiel si le widget ne charge pas sous 20 secondes, masqué si le widget devient prêt. Le widget affilié existant demeure inchangé. Le secours externe ne transmet ni destination ni dates, et ne garantit pas une commission affiliée. Viator inchangé.
- Suppression : SQL propriétaire 202610130003 déjà préparé et contrôle local antérieur conservés, non appliqué. Nettoyage Storage complet toujours bloqué : la suppression du parent peut rendre les fichiers inaccessibles au client ; les fichiers vocaux et les fichiers absents des lignes media ne sont pas couverts. Ne pas appliquer la migration comme une solution complète. Une file durable de nettoyage avec inventaire contrôlé et traitement serveur est nécessaire avant publication de cette fonctionnalité ; aucune règle RLS élargie et aucun binaire supprimé.
- DNS : proposition antérieure conservée, basculement non autorisé. Export complet des zones et conservation MX/SPF/DKIM/DMARC indispensables avant application.

Publication suspendue : nettoyage Storage incomplet, nouvelle recherche de lieux non vérifiée en fonctionnement. Les deux ajustements sont préparés localement pour éviter un nouveau déploiement automatique. La Preview b9fff9f ne contient pas ces ajustements.

Référence de l'API utilisée : https://apidocs.geoapify.com/docs/places/
