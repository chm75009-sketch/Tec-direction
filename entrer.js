/* L'OUVERTURE DU DOSSIER.

   Le détail de ce que fait cet écran est en tête de entrer.html. Ici, la
   mécanique : dériver la clé du mot de passe, déchiffrer, écrire dans le
   stockage local, et ne rien envoyer nulle part.

   Aucune requête ne part de cette page. Le bloc chiffré est arrivé avec elle,
   le mot de passe est tapé ici, et le déchiffrement se fait ici. */

"use strict";
(function (window, document) {

  var $ = function (id) { return document.getElementById(id); };
  var CLES = ["profil-entreprise", "registre-personnel", "flotte-vehicules",
    "flotte-conducteurs", "forfait-jours"];

  function deBase64(s) {
    var brut = window.atob(s), t = new Uint8Array(brut.length);
    for (var i = 0; i < brut.length; i++) t[i] = brut.charCodeAt(i);
    return t;
  }

  /* La clé ne vient pas du mot de passe tel quel : six cent mille tours de
     PBKDF2 la fabriquent, ce qui rend l'essai systématique hors de portée. */
  function clef(mot, sel, tours) {
    var enc = new TextEncoder();
    return window.crypto.subtle
      .importKey("raw", enc.encode(mot), { name: "PBKDF2" }, false, ["deriveKey"])
      .then(function (base) {
        return window.crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: sel, iterations: tours, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      });
  }

  function ouvrir(mot) {
    var p = window.DOSSIER_CHIFFRE;
    return clef(mot, deBase64(p.sel), p.tours).then(function (k) {
      return window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: deBase64(p.vecteur) }, k, deBase64(p.contenu));
    }).then(function (clair) {
      return JSON.parse(new TextDecoder().decode(clair));
    });
  }

  function poser(dossier) {
    CLES.forEach(function (c) {
      if (dossier[c] === undefined) return;
      try { window.localStorage.setItem(c, JSON.stringify(dossier[c])); } catch (e) {}
    });
    try { window.localStorage.setItem("dossier-ouvert-le", new Date().toISOString()); } catch (e) {}
    return poserPieces(dossier.documents);
  }

  /* LES PIÈCES DU CLIENT, DANS SA BASE DE DOCUMENTS.

     Les chiffres ne suffisent pas : il doit retrouver ses fichiers, le
     registre tel qu'il nous l'a remis et le classeur que nous en avons tiré.
     Ils entrent dans IndexedDB par la même porte que s'il les avait déposés
     lui-même, et se retrouvent ensuite dans « Mes documents ».

     Le contenu est gardé en Blob, jamais converti : un PDF recodé n'est plus
     le même fichier, et c'est celui-là qu'un inspecteur demanderait. */
  function poserPieces(pieces) {
    if (!pieces || !pieces.length || !window.Documents) return Promise.resolve(0);
    var faites = 0;
    return pieces.reduce(function (avant, p) {
      return avant.then(function () {
        return window.Documents.liste(p.rubrique).then(function (deja) {
          var vu = (deja || []).some(function (d) { return d.nom === p.nom; });
          if (vu) return null;
          var blob = new Blob([deBase64(p.b64)], { type: p.type });
          faites++;
          return window.Documents.enregistrer(p.rubrique, {
            nom: p.nom, sorte: p.sorte, type: p.type, note: p.note, contenu: blob,
          });
        });
      });
    }, Promise.resolve()).then(function () { return faites; })
      .catch(function () { return faites; });
  }

  function lire(c) {
    try { return JSON.parse(window.localStorage.getItem(c) || "null"); } catch (e) { return null; }
  }

  function compter(cible, pieces) {
    var p = lire("profil-entreprise") || {};
    var r = lire("registre-personnel") || {};
    var v = lire("flotte-vehicules") || [];
    var c = lire("flotte-conducteurs") || {};
    var S = (r.salaries || []);
    var enPoste = S.filter(function (s) { return !String(s.sor || "").trim(); }).length;
    var L = [
      ["Entreprise", p.denomination || ""],
      ["Convention collective", p.conventionCollective || ""],
      ["Salariés au registre", String(S.length)],
      ["Dont en poste", String(enPoste)],
      ["Véhicules", String(v.length)],
      ["Fiches conducteur", String(Object.keys(c).length)],
    ];
    if (pieces) L.push(["Pièces déposées", String(pieces)]);
    $(cible).innerHTML = L.map(function (x) {
      return '<div class="l"><span class="q">' + x[0] + '</span><span class="v">' + x[1] + "</span></div>";
    }).join("");
  }

  function dejaLa() {
    var r = lire("registre-personnel");
    return !!(r && r.salaries && r.salaries.length);
  }

  function demarrer() {
    if (dejaLa()) {
      $("e-ouvrir").hidden = true;
      $("e-deja").hidden = false;
      compter("compte-deja");
    }

    $("recharger").addEventListener("click", function () {
      if (!window.confirm("Recharger le dossier d'origine ? Ce qui a été modifié sur cet " +
        "appareil sera remplacé.")) return;
      $("e-deja").hidden = true;
      $("e-ouvrir").hidden = false;
      $("mot").focus();
    });

    function essayer() {
      var mot = $("mot").value;
      if (!mot) { $("mot").focus(); return; }
      $("erreur").hidden = true;
      $("patiente").hidden = false;
      $("ouvrir").disabled = true;
      /* Le rendu doit passer avant le calcul, sinon l'écran reste figé sans
         rien dire pendant la seconde que prend la dérivation. */
      window.setTimeout(function () {
        ouvrir(mot).then(function (dossier) {
          return Promise.resolve(poser(dossier)).then(function (n) {
            $("patiente").hidden = true;
            $("e-ouvrir").hidden = true;
            $("e-deja").hidden = true;
            $("e-ouvert").hidden = false;
            compter("compte", n);
            window.scrollTo(0, 0);
          });
        }).catch(function () {
          $("patiente").hidden = true;
          $("ouvrir").disabled = false;
          $("erreur").hidden = false;
          $("erreur").textContent = "Ce mot de passe n'ouvre pas le dossier. Vérifiez les " +
            "majuscules et les tirets, puis réessayez.";
          $("mot").select();
        });
      }, 40);
    }

    $("ouvrir").addEventListener("click", essayer);
    $("mot").addEventListener("keydown", function (e) {
      if (e.key === "Enter") essayer();
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", demarrer);
  else demarrer();

})(window, document);
