/* LE NOM DU GÉRANT, SUR CE SITE.

   Le dossier d'origine, chiffré, porte « Chadi EL AFAI » et aucune qualité :
   les pièces déposées par l'entreprise écrivent « EL SAFADI », et c'est cette
   orthographe qui est la bonne. Demande du 27 septembre 2026.

   Ce fichier ne fait que cela : au chargement d'une page, si la fiche gardée
   dans le navigateur porte encore l'ancienne orthographe, il la corrige, et
   il pose « gérant » quand la qualité manque. Il ne touche à rien d'autre, il
   n'écrit jamais si la fiche est déjà juste, et il disparaîtra le jour où le
   dossier d'origine sera refait avec le bon nom.

   Il vit dans ce dépôt, celui du site de la SARL TEC, et non dans
   l'application : le nom d'un gérant n'a rien à faire dans un logiciel qui
   sert à d'autres entreprises. */
(function () {
  "use strict";
  var CLE = "profil-entreprise";
  var ANCIEN = /EL\s*AFAI/i;
  var BON = "Chadi EL SAFADI";

  function lire() {
    try { return JSON.parse(window.localStorage.getItem(CLE) || "null"); }
    catch (e) { return null; }
  }
  function ecrire(p) {
    try { window.localStorage.setItem(CLE, JSON.stringify(p)); } catch (e) {}
  }

  var p = lire();
  if (!p) return;
  var change = false;

  ["responsable", "responsableNom", "signataire"].forEach(function (c) {
    var v = String(p[c] == null ? "" : p[c]);
    if (ANCIEN.test(v)) {
      p[c] = v.replace(/Chadi\s+EL\s*AFAI|EL\s*AFAI/i, BON);
      change = true;
    }
  });

  if (String(p.responsableNom || "").trim() === "" && String(p.responsable || "").trim() !== "") {
    var s = String(p.responsable).trim(), i = s.indexOf(",");
    p.responsableNom = (i < 0 ? s : s.slice(0, i)).trim();
    if (i >= 0 && String(p.responsableQualite || "").trim() === "")
      p.responsableQualite = s.slice(i + 1).trim();
    change = true;
  }
  if (String(p.responsableQualite || "").trim() === "" &&
      String(p.responsableNom || "").trim() !== "") {
    p.responsableQualite = "gérant";
    change = true;
  }
  if (String(p.responsableNom || "").trim() !== "") {
    var attendu = [String(p.responsableNom).trim(), String(p.responsableQualite || "").trim()]
      .filter(Boolean).join(", ");
    if (String(p.responsable || "").trim() !== attendu) { p.responsable = attendu; change = true; }
  }

  if (change) ecrire(p);
})();
