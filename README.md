# Site de la SARL TEC

L'application de gestion du personnel, avec le dossier de TEC chiffré.

## Ce qu'il y a dedans

- `entrer.html` et `entrer.js` : la porte. Elle demande le mot de passe, en
  dérive une clé (PBKDF2-SHA256, six cent mille tours), déchiffre le dossier
  (AES-256-GCM) et l'installe dans le stockage local du navigateur. Elle pose
  aussi les pièces du client dans la base des documents.
- `dossier-tec.js` : le dossier chiffré, données et pièces. Illisible sans le
  mot de passe, qui n'est écrit nulle part, ni ici, ni sur le serveur.
- `verrou.js` : le verrou. Premier script de chaque page, il renvoie à la
  porte tant que la séance n'a pas été ouverte par le mot de passe.
- `poser-verrou.py` : il remet l'appel au verrou sur toutes les pages. À
  lancer après chaque copie de pages venues de l'application.
- `sans-cache.js` : il défait le service worker. Voir plus bas.
- Le reste : l'application, identique à celle du dépôt jurisprudence.

## Le mot de passe à chaque ouverture

Mesuré le 24 septembre 2026, sur téléphone : le site s'ouvrait directement sur
la fiche de l'entreprise, sans rien demander. Le mot de passe ne servait
qu'une fois, à la première ouverture, pour déchiffrer le dossier et l'écrire
dans le navigateur ; ensuite les données étaient là, et plus aucune page ne
posait de question.

`verrou.js` tient maintenant la porte de chaque page. La séance vit dans
`sessionStorage` : elle se referme avec l'onglet ou l'application, donc le mot
de passe est demandé à chaque ouverture, une seule fois, et non à chaque page.

Aux ouvertures suivantes, le mot de passe n'écrase plus rien : il ouvre la
séance et ajoute seulement les pièces absentes. Repartir du dossier d'origine
reste possible, par un bouton qui prévient.

Attention à la copie des pages. Ce site est une copie de l'application ; une
page recopiée depuis le dépôt d'origine perd son appel au verrou et s'ouvre de
nouveau sans mot de passe. `python3 poser-verrou.py` le remet partout, et dit
ce qu'il a fait.

Ce que le verrou ne fait pas : il ne chiffre pas les données déjà écrites dans
le navigateur. Qui a la main sur l'appareil déverrouillé et sait où regarder
les retrouve. Il tient la porte de l'application, rien de plus.

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
