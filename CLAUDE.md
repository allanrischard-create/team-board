# Team Board — règles pour Claude

Tableau de tâches de l'équipe postprod Sheriff Projects. L'utilisateur parle français.

## Architecture
- PWA React en **un seul fichier** : `index.html` (React chargé par CDN, pas de build).
- `public/index.html` est une **copie identique** de `index.html`. Toute modification doit être faite sur les deux fichiers, qui doivent rester strictement identiques.
- API serverless Vercel dans `api/` : `tasks.js`, `members.js`, `slack.js`.
- Base Neon (PostgreSQL), schéma dans `schema.sql`.
- `vercel.json` : réécritures, en-têtes du service worker, crons Slack (récap quotidien 9h, retards 10h, lun–ven).
- PWA : `public/manifest.webmanifest`, `public/sw.js` (network-first), polices `public/signs-*.woff2`.

## Vues
- **Vue TV** (`TVView`) : affichée par défaut sur ordinateur. Modes ALL, DAILY (`TVDailyMode`) et TEAM (`TVTeamMode`), zoom 100/125/150 %.
- **Vue mobile / manager** : affichée par défaut sur téléphone, accès admin par mot de passe.

## Déploiement
- Un push sur `main` déploie la **production** sur Vercel.
- Toujours travailler sur une branche et ouvrir une PR : Vercel génère une URL de prévisualisation à vérifier avant fusion.

## Tester en local
Il n'y a pas de serveur de dev. Pour tester l'interface sans la base, servir `public/` avec un petit serveur Node qui répond des données fictives sur `/api/tasks` et `/api/members` (`/api/members?detail=1` renvoie `[{name,position,created_at}]`). Vérifier la vue TV en 1920 px et 1440 px.

## Historique
- 2026-10 : panneaux membres compacts dans la vue TV, modes TEAM et DAILY (PR #2). Nom en entier sur une ligne, avatar réduit, boutons « + » et « 🗑n », compteur x/y à droite de la barre de progression, grille `auto-fill minmax(290px,1fr)`, police des tâches inchangée. La vue mobile n'a pas été modifiée.
