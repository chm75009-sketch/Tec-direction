/* LE SERVICE WORKER MINIMAL : IL NE MET RIEN EN CACHE.

   Pourquoi il existe. Sans service worker, le navigateur ne propose pas
   d'installer l'application : ni la fenêtre sur ordinateur, ni l'icône sur le
   téléphone. Demande du 25 septembre 2026, « un bouton pour l'installer sur PC
   ou téléphone » : le bouton ne sert à rien si le navigateur n'a pas de quoi
   poser son invite.

   Pourquoi il ne fait rien d'autre. Le service worker précédent gardait les
   pages en cache et rendait à une navigation la redirection 307 de
   l'hébergeur : la page s'ouvrait sur ERR_FAILED, chez le premier client, le
   23 septembre 2026. Celui-ci n'intercepte rien : il écoute « fetch » parce
   que le navigateur l'exige pour juger l'application installable, et laisse
   passer la requête au réseau sans y toucher.

   Ce qui change le 30 septembre 2026. Il ne met toujours aucune page en cache,
   pour la même raison : une redirection 307 rendue à une navigation ferme la
   page. Mais il répond quelque chose quand le réseau manque, au lieu de laisser
   l'erreur du navigateur. « L'application installée n'a aucune page hors ligne :
   hors réseau, erreur du navigateur », relevé le 29 septembre 2026. La page de
   repli est écrite ici, dans le worker, et elle ne prétend pas être celle qu'on
   demandait.

   Conséquence assumée : pas de consultation hors réseau. Mieux vaut une page
   qui dit la panne qu'une page gardée en cache et qui ne s'ouvre pas.       */

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (noms) {
      /* Les caches de l'ancien worker n'ont plus de raison d'être. */
      return Promise.all(noms.map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* La page de repli, écrite en clair : rien à mettre en cache, donc rien à
   invalider, et aucune redirection de l'hébergeur à rejouer. */
function pageHorsLigne() {
  return new Response(
    '<!doctype html><html lang="fr"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Hors connexion</title>" +
    '<body style="margin:0;min-height:100vh;display:grid;place-items:center;' +
    'font:16px/1.6 system-ui,-apple-system,sans-serif;background:#f6f7f9;color:#16181d;padding:24px">' +
    '<div style="max-width:34rem;text-align:center">' +
    '<h1 style="font:600 22px/1.3 system-ui;margin:0 0 12px">Vous êtes hors connexion</h1>' +
    '<p style="margin:0 0 10px;color:#5f6874">Cette application se consulte en ligne : ' +
    "ses pages ne sont pas gardées sur l'appareil. Rétablissez la connexion, " +
    "puis rouvrez la page.</p>" +
    '<p style="margin:0 0 16px;color:#5f6874;font-size:14px">Ce que vous avez saisi est ' +
    "sur cet appareil et n'est pas perdu : le registre, la flotte, les documents déposés " +
    "vous attendent au retour du réseau.</p>" +
    '<button type="button" onclick="location.reload()" style="font:600 15px/1 system-ui;' +
    "padding:12px 18px;border:1px solid #1f3864;border-radius:4px;background:#1f3864;" +
    'color:#fff;cursor:pointer">Réessayer</button>' +
    "</div></body></html>",
    { headers: { "content-type": "text/html; charset=utf-8" }, status: 503 });
}

self.addEventListener("fetch", function (e) {
  /* Une navigation qui échoue reçoit la page de repli. Tout le reste passe au
     réseau sans que le worker y touche : c'est la règle qui a fait retirer le
     worker précédent, et elle ne change pas. */
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(function () { return pageHorsLigne(); }));
});
