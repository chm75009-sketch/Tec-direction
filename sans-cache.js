/* PAS DE CACHE HORS LIGNE SUR CE SITE.

   Pourquoi. L'hébergeur renvoie « mes-documents.html » vers « mes-documents »,
   par une redirection 307. Le service worker, lui, a mis « mes-documents.html »
   en cache et rend cette redirection telle quelle à une navigation : le
   navigateur refuse, et la page s'ouvre sur ERR_FAILED. Mesuré le 23 septembre
   2026, chez le premier client.

   Ce qu'on fait. On retire le service worker de ce site, et ce fichier défait
   celui qui serait déjà installé sur l'appareil : il le désinscrit, vide ses
   caches, et recharge une fois. Sans cela, un navigateur qui a déjà visité le
   site resterait piloté par l'ancien worker, indéfiniment.

   Ce qu'on perd. La consultation hors réseau. Elle reviendra le jour où le
   worker saura suivre une redirection ; en attendant, mieux vaut une page qui
   s'ouvre qu'une page disponible hors ligne et qui ne s'ouvre pas. */

(function (window) {
  "use strict";
  if (!window.navigator || !navigator.serviceWorker) return;

  /* Vingt-huit pages demandent encore l'enregistrement du worker. Plutot que
     de les retoucher une par une, on ferme la porte ici, avant qu'elles ne
     s'executent.

     On rend un faux enregistrement plutot qu'un echec : les pages qui
     enchainent sur reg.update() n'ont alors rien a rattraper, et la console
     du client reste propre. */
  try {
    var faux = {
      update: function () { return Promise.resolve(); },
      unregister: function () { return Promise.resolve(true); },
      addEventListener: function () {},
      installing: null, waiting: null, active: null,
    };
    navigator.serviceWorker.register = function () { return Promise.resolve(faux); };
  } catch (e) {}

  navigator.serviceWorker.getRegistrations().then(function (L) {
    if (!L || !L.length) return;
    return Promise.all(L.map(function (r) { return r.unregister(); })).then(function () {
      if (!window.caches || !caches.keys) return null;
      return caches.keys().then(function (noms) {
        return Promise.all(noms.map(function (n) { return caches.delete(n); }));
      });
    }).then(function () {
      /* Une seule fois : sans ce témoin, la page se rechargerait en boucle
         chez quelqu'un dont la désinscription échoue silencieusement. */
      try {
        if (window.sessionStorage.getItem("worker-retire")) return;
        window.sessionStorage.setItem("worker-retire", "1");
      } catch (e) {}
      window.location.reload();
    });
  }).catch(function () {});
})(window);
