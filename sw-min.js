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

   Conséquence assumée : pas de consultation hors réseau. Mieux vaut une page
   qui s'ouvre qu'une page disponible hors ligne et qui ne s'ouvre pas.      */

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

self.addEventListener("fetch", function () {
  /* Rien. Le réseau répond, comme s'il n'y avait pas de worker. */
});
