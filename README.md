# Site de la SARL TEC

L'application de gestion du personnel, avec le dossier de TEC chiffré.

## Ce qu'il y a dedans

- `entrer.html` et `entrer.js` : la porte. Elle demande le mot de passe, en
  dérive une clé (PBKDF2-SHA256, six cent mille tours), déchiffre le dossier
  (AES-256-GCM) et l'installe dans le stockage local du navigateur. Elle pose
  aussi les pièces du client dans la base des documents.
- `dossier-tec.js` : le dossier chiffré, données et pièces. Illisible sans le
  mot de passe, qui n'est écrit nulle part, ni ici, ni sur le serveur.
- `sans-cache.js` : il défait le service worker. Voir plus bas.
- Le reste : l'application, identique à celle du dépôt jurisprudence, avec une
  garde en tête de `index.html` qui renvoie vers la porte tant que le dossier
  n'a pas été ouvert sur l'appareil.

## Pourquoi ce dépôt est privé

Le dossier chiffré porte les 85 salariés de TEC, leurs dates de naissance et
leurs nationalités, et le registre du personnel en PDF. Même chiffré, il n'a
pas sa place dans un dépôt public.

## Pas de service worker ici

L'hébergeur renvoie `mes-documents.html` vers `mes-documents`, par une
redirection 307. Le service worker avait mis l'adresse avec `.html` en cache
et rendait cette redirection telle quelle à une navigation : le navigateur
refusait, et la page s'ouvrait sur ERR_FAILED. `sw.js` est donc retiré, et
`sans-cache.js` désinscrit celui qui serait déjà installé sur un appareil.

## Publication

Cloudflare, projet tec-direction. Aucune commande de construction, le site est
statique : répertoire de sortie, la racine.

Le mot de passe ne se met jamais dans ce dépôt. Il se communique au client
autrement.
