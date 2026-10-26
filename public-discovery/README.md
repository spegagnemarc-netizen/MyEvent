# ORÉVAMI Découvertes — TEST isolé V1.2

Paquet public autonome, uniquement avec des exemples fictifs. Aucune annonce réelle, base, session ou clé de l'application privée.

```sh
node public-discovery/build.cjs
node public-discovery/server.cjs 4178
```

Le serveur écoute uniquement sur `127.0.0.1:4178`. Ouvrir cette URL depuis la même machine. Le fichier `index.html` s'ouvre également hors ligne (simulation locale sans canal serveur).

Le build réutilise seulement les helpers purs de politique d'inventaire et le pont CMP sans réseau. Pour un hébergement futur, préparer le build dans le dépôt puis livrer uniquement `index.html`, `headers.json` et `server.cjs` dans un service public indépendant. Conserver les headers. Aucun déploiement n'est autorisé pour le moment.

Le canal SSE public ne contient qu'un état de suspension ; son raccordement à un backend d'administration de confiance reste à faire. Aucun endpoint de mutation n'est exposé. Une CMP réelle et AdSense ne sont pas installés. Ne pas activer d'iframe AdSense : usage non validé.

Voir le [rapport et les preuves](../docs/public-advertising-isolation-v12.md).
