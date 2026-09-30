/* LE VERROU.

   POURQUOI CE FICHIER EXISTE

   Mesuré le 24 septembre 2026, sur téléphone : l'application s'ouvrait
   directement sur la fiche de l'entreprise, sans rien demander. Le mot de
   passe ne servait qu'une fois, à la toute première ouverture, pour
   déchiffrer le dossier et l'écrire dans le navigateur. Après quoi les
   données étaient là, et plus aucune page ne posait de question : un
   téléphone perdu, un navigateur laissé ouvert, et tout le registre du
   personnel était lisible.

   CE QU'IL FAIT

   Il est le premier script de chaque page, avant tout affichage. Si la séance
   n'a pas été ouverte par le mot de passe, la page ne s'affiche pas : elle
   renvoie à la porte, en lui disant où l'on voulait aller.

   La séance vit dans sessionStorage, pas dans localStorage : elle se referme
   quand l'onglet ou l'application se ferme. Le mot de passe est donc demandé
   à chaque ouverture, une seule fois, et non à chaque page.

   LA SÉANCE EST PARTAGÉE ENTRE LES ONGLETS

   sessionStorage ne vaut que pour l'onglet qui l'a écrit : ouvrir un lien dans
   un nouvel onglet redemandait le mot de passe, et le registre s'ouvrait dans
   un onglet pendant que la porte se refermait dans l'autre. Relevé le
   29 septembre 2026.

   Un battement de coeur règle cela sans transformer la séance en séance
   permanente : tant qu'un onglet est ouvert, il inscrit l'heure dans
   localStorage toutes les cinq secondes. Un onglet qui s'ouvre et trouve cette
   heure récente, moins de vingt secondes, adopte la séance sans redemander le
   mot de passe. Quand le dernier onglet se ferme, le battement s'arrête et la
   marque périme d'elle-même.

   CE QUE CELA COÛTE, ET IL FAUT LE SAVOIR : pendant ces vingt secondes, la
   séance survit à la fermeture du navigateur. Qui le referme et le rouvre
   aussitôt entre sans mot de passe. Au-delà, la porte redemande. C'est le prix
   de la séance partagée entre onglets, et il est écrit ici pour qu'il soit
   décidé plutôt que subi.

   CE QU'IL NE FAIT PAS

   Il ne protège pas les données déjà écrites dans le navigateur : qui a la
   main sur l'appareil et sait où regarder les retrouve. Le verrou tient la
   porte de l'application, il ne chiffre pas ce qu'il y a derrière.        */

"use strict";
(function (window, document) {

  var PORTE = "entrer.html";
  var CLE = "seance-ouverte";
  var CLE_BATTEMENT = "seance-battement";
  var FENETRE = 20000;          /* vingt secondes */
  var PERIODE = 5000;           /* le battement, toutes les cinq secondes */

  /* L'hébergeur sert « /entrer.html » par une redirection vers « /entrer » :
     la page de la porte s'appelle donc tantôt avec son extension, tantôt sans.
     Comparer les deux formes, sinon le verrou se pose sur la porte elle-même
     et le site tourne en rond. Mesuré en ligne le 25 septembre 2026, le site
     ne s'ouvrait plus du tout. */
  var page = window.location.pathname.split("/").pop() || "index.html";
  var nom = page.replace(/\.html$/, "");
  if (nom === PORTE.replace(/\.html$/, "")) return;

  /* Le battement : tant qu'une page vit avec une séance ouverte, elle écrit
     l'heure. C'est ce que lit l'onglet suivant. */
  function battre() {
    try { window.localStorage.setItem(CLE_BATTEMENT, String(Date.now())); } catch (e) {}
  }
  function tenirLeBattement() {
    battre();
    window.setInterval(battre, PERIODE);
    /* Un onglet revenu au premier plan bat tout de suite : sur un téléphone,
       les minuteries des onglets en arrière-plan sont ralenties ou arrêtées. */
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) battre();
    });
  }

  var ouverte;
  try { ouverte = window.sessionStorage.getItem(CLE) === "oui"; }
  catch (e) { return; }
  if (ouverte) { tenirLeBattement(); return; }

  /* Pas de séance dans cet onglet : un autre en a-t-il une, ouverte à l'instant ? */
  var battement = 0;
  try { battement = Number(window.localStorage.getItem(CLE_BATTEMENT)) || 0; }
  catch (e) { battement = 0; }
  if (battement && Date.now() - battement < FENETRE) {
    try { window.sessionStorage.setItem(CLE, "oui"); } catch (e) {}
    tenirLeBattement();
    return;
  }

  /* La page est cachée avant d'être remplacée : sans cela, la fiche de
     l'entreprise paraît une fraction de seconde avant le renvoi. */
  try { document.documentElement.style.visibility = "hidden"; } catch (e) {}

  var vers = page + window.location.search + window.location.hash;
  window.location.replace(PORTE + "?vers=" + encodeURIComponent(vers));

})(window, document);
