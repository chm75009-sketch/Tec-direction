/* PAS DE CACHE HORS LIGNE SUR CE SITE, MAIS UN WORKER QUAND MÊME.

   L'histoire. L'hébergeur renvoie « mes-documents.html » vers
   « mes-documents », par une redirection 307. L'ancien service worker avait
   mis « mes-documents.html » en cache et rendait cette redirection telle
   quelle à une navigation : le navigateur refusait, et la page s'ouvrait sur
   ERR_FAILED. Mesuré le 23 septembre 2026, chez le premier client. Le worker a
   donc été retiré, et ce fichier défaisait celui qui traînait encore sur un
   appareil.

   Ce qui change le 25 septembre 2026. Sans aucun service worker, le navigateur
   ne propose plus d'installer l'application : le bouton demandé ce jour-là
   n'aurait rien eu à déclencher. On remet donc un worker, mais minimal :
   sw-min.js n'intercepte rien et ne garde rien. Ce fichier fait le ménage,
   puis l'enregistre.

   Ce qu'on perd toujours : la consultation hors réseau.                     */

(function (window) {
  "use strict";
  if (!window.navigator || !navigator.serviceWorker) return;

  var MINIMAL = "sw-min.js";

  /* Les pages du dépôt demandent encore « sw.js », celui qui mettait en cache.
     On intercepte l'enregistrement : quel que soit le fichier demandé, c'est
     le worker minimal qui est posé. */
  var vrai = navigator.serviceWorker.register.bind(navigator.serviceWorker);
  try {
    navigator.serviceWorker.register = function (script, options) {
      var s = String(script || "");
      if (s.indexOf(MINIMAL) >= 0) return vrai(script, options);
      return vrai(MINIMAL, options);
    };
  } catch (e) {}

  function ancien(r) {
    var s = (r.active && r.active.scriptURL) || (r.installing && r.installing.scriptURL) ||
      (r.waiting && r.waiting.scriptURL) || "";
    return s.indexOf(MINIMAL) < 0;
  }

  navigator.serviceWorker.getRegistrations().then(function (L) {
    var vieux = (L || []).filter(ancien);
    var fini = vieux.length
      ? Promise.all(vieux.map(function (r) { return r.unregister(); })).then(function () {
          if (!window.caches || !caches.keys) return null;
          return caches.keys().then(function (noms) {
            return Promise.all(noms.map(function (n) { return caches.delete(n); }));
          });
        })
      : Promise.resolve();

    return fini.then(function () {
      return vrai(MINIMAL).catch(function () { return null; });
    });
  }).catch(function () {});
})(window);
