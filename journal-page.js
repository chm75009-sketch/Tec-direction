/* LE JOURNAL DES PAGES.

   POURQUOI CE FICHIER EXISTE

   Le journal ne gardait que l'ouverture du dossier : qui, quand, le pays. On
   ne voyait pas ce qui avait été consulté une fois entré. Ce script dépose, à
   chaque page ouverte, le nom de la page et l'heure, au même endroit que
   l'ouverture (la porte /journal du Worker).

   CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS

   Il n'envoie qu'un nom de page de ce site, jamais le contenu d'un document ni
   une donnée du dossier. Le dépôt part sans qu'on l'attende : s'il échoue, la
   page s'ouvre quand même. Il ne se déclenche que si la séance est ouverte,
   pour ne pas inscrire une page vers laquelle le verrou va renvoyer.

   QUI A OUVERT

   L'identité (TEC ou Léa) est celle du dernier mot de passe saisi sur cet
   appareil, gardée par la porte dans le navigateur. À défaut, la page est
   portée comme « inconnu ». C'est au mieux : sans un mot de passe par page,
   on ne peut pas faire plus fin.                                             */

"use strict";
(function (window, document) {
  try {
    var page = window.location.pathname.split("/").pop() || "index.html";
    var nom = page.replace(/\.html$/, "");
    if (nom === "entrer" || nom === "journal") return;

    /* Seulement si la séance est ouverte : sinon le verrou va renvoyer à la
       porte, et il ne faut pas inscrire cette page jamais vraiment ouverte. */
    var ouverte = false;
    try { ouverte = window.sessionStorage.getItem("seance-ouverte") === "oui"; } catch (e) {}
    if (!ouverte) return;

    var qui = "?";
    try { qui = window.localStorage.getItem("journal-qui") || "?"; } catch (e) {}

    window.fetch("/journal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ qui: qui, page: nom }),
      keepalive: true,
    }).catch(function () {});
  } catch (e) {}
})(window, document);
