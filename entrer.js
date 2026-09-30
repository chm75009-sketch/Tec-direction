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

  /* LE RECHARGEMENT NE JETTE PAS CE QUE LE DOSSIER NE PORTE PAS.

     « Recharger le dossier d'origine » réécrivait la fiche d'entreprise en
     entier : les organismes saisis ici, l'URSSAF, la caisse de retraite, le
     service de santé au travail, l'inspection, disparaissaient sans un mot,
     parce que le dossier chiffré ne les contient pas. Relevé le 29 septembre
     2026. La fiche se fusionne donc : le dossier l'emporte sur ce qu'il porte,
     et ce qu'il ne porte pas reste. Les autres clés, elles, sont des listes
     entières et se remplacent. */
  function fusionner(local, venu) {
    if (!local || typeof local !== "object" || Array.isArray(local)) return venu;
    if (!venu || typeof venu !== "object" || Array.isArray(venu)) return venu;
    var out = {};
    Object.keys(local).forEach(function (k) { out[k] = local[k]; });
    Object.keys(venu).forEach(function (k) {
      if (venu[k] !== "" && venu[k] !== null && venu[k] !== undefined) out[k] = venu[k];
    });
    return out;
  }

  function poser(dossier) {
    CLES.forEach(function (c) {
      if (dossier[c] === undefined) return;
      var aEcrire = dossier[c];
      if (c === "profil-entreprise") aEcrire = fusionner(lire(c), dossier[c]);
      try { window.localStorage.setItem(c, JSON.stringify(aEcrire)); } catch (e) {}
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
          /* UNE PIÈCE RETIRÉE NE REVIENT PLUS. Elle n'était plus dans la base,
             donc la repose la rentrait de nouveau à chaque entrée, et le geste
             de l'utilisatrice était défait sans un mot. Relevé le 26 septembre
             2026. « Mes documents » garde la liste des noms retirés, et propose
             de rendre la pièce quand on la veut de nouveau. */
          if (window.Documents.estRetire && window.Documents.estRetire(p.nom)) return null;
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
      ["Lignes du registre", String(S.length)],
      ["Salariés en poste", String(enPoste)],
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

  /* LA SÉANCE.

     Tant qu'elle n'est pas ouverte, verrou.js renvoie ici chaque page de
     l'application. Elle vit dans sessionStorage : elle se referme avec
     l'onglet, donc le mot de passe revient à chaque ouverture, une fois, et
     non à chaque page. Mesuré le 24 septembre 2026 : l'application s'ouvrait
     directement sur la fiche de l'entreprise, sans rien demander. */
  function ouvrirSeance() {
    try { window.sessionStorage.setItem("seance-ouverte", "oui"); } catch (e) {}
  }

  /* Où l'on voulait aller. Le verrou le dit dans l'adresse ; on n'accepte
     qu'un nom de page de ce site, jamais une adresse entière, qui ferait de
     cette porte un tremplin vers ailleurs. */
  function destination() {
    var m = /[?&]vers=([^&]*)/.exec(window.location.search);
    var v = m ? decodeURIComponent(m[1]) : "";
    /* Avec ou sans « .html » : l'hébergeur sert les deux. */
    return /^[a-z0-9-]+(\.html)?(\?[^\/:]*)?(#[^\/:]*)?$/i.test(v) ? v : "index.html";
  }

  var DOSSIER = null;

  function demarrer() {
    var vers = destination();
    Array.prototype.forEach.call(document.querySelectorAll("a.entrer"), function (a) {
      a.setAttribute("href", vers);
    });

    $("recharger").addEventListener("click", function () {
      /* Le message dit ce qu'il fait et ce qu'il épargne : le registre, la
         flotte et le forfait reviennent au dossier tel qu'il a été remis, la
         fiche d'entreprise garde les renseignements ajoutés ici, et les pièces
         déjà déposées ne sont pas touchées. Relevé le 29 septembre 2026 : le
         bouton annonçait un remplacement de tout. */
      if (!window.confirm("Recharger le dossier d'origine ? Le registre du personnel, la " +
        "flotte et le forfait en jours reviendront au dossier tel qu'il a été remis, et ce " +
        "qui a été saisi sur cet appareil pour eux sera remplacé. Les renseignements ajoutés " +
        "à la fiche de l'entreprise et les pièces déjà déposées sont conservés.")) return;
      if (!DOSSIER) return;
      Promise.resolve(poser(DOSSIER)).then(function (n) {
        $("e-deja").hidden = true;
        $("e-ouvert").hidden = false;
        compter("compte", n);
        window.scrollTo(0, 0);
      });
    });

    /* LE MOT DE PASSE N'INSTALLE PAS DEUX FOIS.

       À la première ouverture, il déchiffre le dossier et l'écrit sur
       l'appareil. Aux suivantes, il ouvre seulement la séance : ce qui a été
       saisi ici ne bouge pas, et seules les pièces absentes sont ajoutées.
       Repartir du dossier d'origine reste possible, mais c'est un bouton, et
       il prévient. */
    function essayer() {
      /* LE MESSAGE D'ERREUR NE SURVIT PAS À L'ESSAI SUIVANT.

         « Ce mot de passe n'ouvre pas le dossier » restait sous le champ quand
         on renvoyait le formulaire à vide : il n'était masqué qu'après le
         contrôle du champ, donc jamais dans ce cas. Relevé le 29 septembre
         2026. */
      $("erreur").hidden = true;
      var mot = $("mot").value;
      if (!mot) { $("mot").focus(); return; }
      $("patiente").hidden = false;
      $("ouvrir").disabled = true;
      /* Le rendu doit passer avant le calcul, sinon l'écran reste figé sans
         rien dire pendant la seconde que prend la dérivation. */
      window.setTimeout(function () {
        ouvrir(mot).then(function (dossier) {
          DOSSIER = dossier;
          ouvrirSeance();
          var suite = dejaLa()
            ? Promise.resolve(poserPieces(dossier.documents)).then(function () { return null; })
            : Promise.resolve(poser(dossier));
          return suite.then(function (n) {
            $("patiente").hidden = true;
            $("e-ouvrir").hidden = true;
            if (n === null) {
              $("e-deja").hidden = false;
              compter("compte-deja");
            } else {
              $("e-ouvert").hidden = false;
              compter("compte", n);
            }
            window.scrollTo(0, 0);
          });
        }).catch(function () {
          $("patiente").hidden = true;
          $("ouvrir").disabled = false;
          $("erreur").hidden = false;
          /* Le message ne décrit plus la forme du mot de passe : il parlait de
             tirets que celui-ci ne contient pas, et un message d'erreur qui
             renseigne sur ce qu'on cherche aide surtout celui qui cherche.
             Relevé le 26 septembre 2026. */
          $("erreur").textContent = "Ce mot de passe n'ouvre pas le dossier. Réessayez.";
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
