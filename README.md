# Site de la SARL TEC

L'application de gestion du personnel, avec le dossier de TEC chiffré.

## Ce qu'il y a dedans

- `entrer.html` et `entrer.js` : la porte. Elle demande le mot de passe, en
  dérive une clé (PBKDF2-SHA256, six cent mille tours), déchiffre le dossier
  (AES-256-GCM) et l'installe dans le stockage local du navigateur.
- `dossier-tec.js` : le dossier chiffré. Illisible sans le mot de passe, qui
  n'est écrit nulle part, ni ici, ni sur le serveur.
- Le reste : l'application, identique à celle du dépôt jurisprudence, avec une
  garde en tête de `index.html` qui renvoie vers la porte tant que le dossier
  n'a pas été ouvert sur l'appareil.

## Pourquoi ce dépôt est privé

Le dossier chiffré porte les 85 salariés de TEC, leurs dates de naissance et
leurs nationalités. Même chiffré, il n'a pas sa place dans un dépôt public.

## Publication

Cloudflare Pages, connecté à ce dépôt. Aucune commande de construction, le
site est statique : répertoire de sortie, la racine.

Le mot de passe ne se met jamais dans ce dépôt. Il se communique au client
autrement.
