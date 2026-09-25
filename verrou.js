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

   CE QU'IL NE FAIT PAS

   Il ne protège pas les données déjà écrites dans le navigateur : qui a la
   main sur l'appareil et sait où regarder les retrouve. Le verrou tient la
   porte de l'application, il ne chiffre pas ce qu'il y a derrière.        */

"use strict";
(function (window, document) {

  var PORTE = "entrer.html";
  var CLE = "seance-ouverte";

  /* L'hébergeur sert « /entrer.html » par une redirection vers « /entrer » :
     la page de la porte s'appelle donc tantôt avec son extension, tantôt sans.
     Comparer les deux formes, sinon le verrou se pose sur la porte elle-même
     et le site tourne en rond. Mesuré en ligne le 25 septembre 2026, le site
     ne s'ouvrait plus du tout. */
  var page = window.location.pathname.split("/").pop() || "index.html";
  var nom = page.replace(/\.html$/, "");
  if (nom === PORTE.replace(/\.html$/, "")) return;

  var ouverte;
  try { ouverte = window.sessionStorage.getItem(CLE) === "oui"; }
  catch (e) { return; }
  if (ouverte) return;

  /* La page est cachée avant d'être remplacée : sans cela, la fiche de
     l'entreprise paraît une fraction de seconde avant le renvoi. */
  try { document.documentElement.style.visibility = "hidden"; } catch (e) {}

  var vers = page + window.location.search + window.location.hash;
  window.location.replace(PORTE + "?vers=" + encodeURIComponent(vers));

})(window, document);
