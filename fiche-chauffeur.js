/* LA FICHE DU SALARIÉ, CÔTÉ TÉLÉPHONE (25 novembre 2026).

   Quatre écrans : ses informations, son permis et ses cartes, ses photos, sa
   signature. Les champs suivent ceux de la fiche conducteur de l'application,
   pour que la fiche reçue s'y reporte d'un geste.

   L'ENVOI. La fiche entière, photos et signature comprises, est chiffrée ici,
   dans le téléphone : une clé à usage unique est tirée de la clé publique
   que T.E.C a déposée sur le site (ECDH P-256, puis AES-256-GCM). Ce qui part
   est illisible pour quiconque n'a pas la clé privée, qui ne vit que dans le
   dossier de T.E.C et du cabinet. Le code du lien ne sert qu'à refuser les
   envois venus d'ailleurs.                                                    */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var E = 1, NB = 4;
  var R = {};          /* les choix par boutons : profil, ue, permisOrigine... */
  var PH = {};         /* les photos, en image réduite */
  var signe = false;

  /* Le code arrive dans le lien, après le #. */
  var code = "";
  try { var m = /(?:^|[#&])c=([A-Za-z0-9]+)/.exec(location.hash); if (m) code = m[1].toUpperCase(); } catch (e) {}
  if (!code) $("bloc-code").hidden = false;

  /* La date du jour, en toutes lettres. */
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var auj = new Date();
  $("date-jour").textContent = (auj.getDate() === 1 ? "1er" : auj.getDate()) + " " + MOIS[auj.getMonth()] + " " + auj.getFullYear();
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }

  /* ─── les choix par boutons ─── */
  Array.prototype.forEach.call(document.querySelectorAll("[data-choix]"), function (g) {
    var nom = g.getAttribute("data-choix");
    Array.prototype.forEach.call(g.querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () {
        R[nom] = b.getAttribute("data-v");
        Array.prototype.forEach.call(g.querySelectorAll("button"), function (x) {
          x.setAttribute("aria-pressed", x === b ? "true" : "false");
        });
        montrer();
      });
    });
  });
  function montrer() {
    $("etranger").hidden = R.ue !== "non";
    $("permis-etr").hidden = !(R.ue === "non" && R.permisOrigine === "etr");
    $("bloc-pl").hidden = R.profil !== "pl";
    $("bloc-leger").hidden = R.profil !== "leger";
    $("lib-carte-leger").hidden = !(R.profil === "leger" && R.aCarte === "oui");
  }

  /* ─── les photos demandées, selon les réponses ─── */
  function photosDemandees() {
    var L = [
      { k: "permisRecto", t: "Permis de conduire, recto", o: true },
      { k: "permisVerso", t: "Permis de conduire, verso", o: true },
      { k: "vitale", t: "Carte Vitale, recto", o: true },
    ];
    if (R.profil === "pl") {
      L.push({ k: "carteQualif", t: "Carte de qualification de conducteur, recto", s: "Si vous l'avez" });
      L.push({ k: "carteCond", t: "Carte conducteur (chronotachygraphe), recto", s: "Si vous l'avez" });
    }
    if (R.profil === "leger" && R.aCarte === "oui") L.push({ k: "carteCond", t: "Carte conducteur (chronotachygraphe), recto" });
    if (R.ue === "non") {
      L.push({ k: "titreRecto", t: "Titre de séjour, recto", o: true });
      L.push({ k: "titreVerso", t: "Titre de séjour, verso", o: true });
      if (R.inter === "oui") L.push({ k: "attestation", t: "Attestation de conducteur", s: "Si vous l'avez" });
    }
    return L;
  }
  function dessinerPhotos() {
    var h = $("photos");
    h.innerHTML = photosDemandees().map(function (p) {
      var a = !!PH[p.k];
      return '<div class="photo" data-p="' + p.k + '">' +
        '<div class="v">' + (a ? '<img alt="" src="' + PH[p.k] + '">' : "&#128247;") + "</div>" +
        '<div class="n">' + p.t + (p.o ? ' <em style="color:var(--rouge);font-style:normal">*</em>' : "") +
        '<small class="' + (a ? "ok" : "") + '">' + (a ? "Photo prise" : (p.s || "À prendre")) + "</small></div>" +
        '<label class="b' + (a ? " refaire" : "") + '">' + (a ? "Refaire" : "Photo") +
        '<input type="file" accept="image/*" capture="environment" data-in="' + p.k + '"></label></div>';
    }).join("");
    Array.prototype.forEach.call(h.querySelectorAll("[data-in]"), function (inp) {
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        var k = inp.getAttribute("data-in");
        var ligne = h.querySelector('[data-p="' + k + '"] small');
        if (ligne) { ligne.textContent = "Préparation de la photo..."; ligne.className = ""; }
        reduire(f).then(function (url) { PH[k] = url; dessinerPhotos(); },
          function () { if (ligne) ligne.textContent = "Photo illisible, recommencez"; });
      });
    });
  }
  /* Une photo de téléphone pèse plusieurs mégaoctets : on la ramène à 1600
     pixels de côté, en JPEG, ce qui reste lisible pour un document. */
  function reduire(f) {
    return new Promise(function (ok, ko) {
      var img = new Image(), url = URL.createObjectURL(f);
      img.onload = function () {
        var c = 1600, l = img.naturalWidth, h = img.naturalHeight, r = Math.min(1, c / Math.max(l, h));
        var cv = document.createElement("canvas");
        cv.width = Math.round(l * r); cv.height = Math.round(h * r);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        ok(cv.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(); };
      img.src = url;
    });
  }

  /* ─── la signature ─── */
  var cv = $("sig"), ctx = null, trace = false;
  function prepSig() {
    var r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    if (!r.width) return;
    cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
    ctx = cv.getContext("2d"); ctx.scale(d, d);
    ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#16181d";
    signe = false;
  }
  function pt(ev) { var r = cv.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
  cv.addEventListener("pointerdown", function (ev) {
    if (!ctx) prepSig();
    trace = true; cv.setPointerCapture(ev.pointerId);
    var p = pt(ev); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  });
  cv.addEventListener("pointermove", function (ev) {
    if (!trace) return;
    var p = pt(ev); ctx.lineTo(p.x, p.y); ctx.stroke(); signe = true;
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) { cv.addEventListener(t, function () { trace = false; }); });
  $("effacer").addEventListener("click", prepSig);

  /* ─── les écrans ─── */
  function val(id) { return ($(id).value || "").trim(); }
  function dateOk(id, oblig) {
    var v = val(id);
    if (!v) return !oblig;
    var y = parseInt(v.slice(0, 4), 10);
    return y >= 1950 && y <= 2100;
  }
  function controle() {
    var M = [];
    if (E === 1) {
      if (!code && !val("code")) M.push("le code donné par T.E.C");
      if (!val("nom")) M.push("votre nom");
      if (!val("prenom")) M.push("votre prénom");
      if (!R.profil) M.push("votre profil (poids lourd ou pas)");
      if (!R.ue) M.push("votre nationalité (oui ou non)");
      if (R.ue === "non") {
        if (!val("titreFin") || !dateOk("titreFin", true)) M.push("la date de fin de votre titre de séjour");
        if (!R.permisOrigine) M.push("si votre permis est français ou étranger");
        if (R.permisOrigine === "etr" && !val("permisPays")) M.push("le pays de votre permis");
        if (R.permisOrigine === "etr" && (!val("arrivee") || !dateOk("arrivee", true))) M.push("votre date d'arrivée en France");
      }
    }
    if (E === 2) {
      if (!val("permisCat")) M.push("les catégories de votre permis");
      if (!val("permisFin") || !dateOk("permisFin", true)) M.push("la date de fin de validité de votre permis");
      if (!R.suspendu) M.push("si votre permis est suspendu (oui ou non)");
      ["visiteTravail", "visitePermisFin", "fco", "carteQualif", "carteCond", "carteCondLeger"].forEach(function (id) {
        if (!dateOk(id, false)) M.push("une date à corriger (l'année paraît impossible)");
      });
    }
    if (E === 3) {
      photosDemandees().forEach(function (p) { if (p.o && !PH[p.k]) M.push("la photo : " + p.t.toLowerCase()); });
    }
    if (E === 4) {
      if (!$("certifie").checked) M.push("la case « Je certifie »");
      if (!signe) M.push("votre signature");
    }
    return M;
  }
  function erreur(M) {
    var e = $("err");
    if (!M || !M.length) { e.hidden = true; return; }
    e.textContent = typeof M === "string" ? M
      : "Il manque : " + M.filter(function (x, i) { return M.indexOf(x) === i; }).join(", ") + ".";
    e.hidden = false; window.scrollTo(0, 0);
  }
  function aller(n) {
    E = n;
    Array.prototype.forEach.call(document.querySelectorAll("section[data-e]"), function (s) {
      s.hidden = parseInt(s.getAttribute("data-e"), 10) !== n;
    });
    $("etape").textContent = "Étape " + n + " sur " + NB;
    $("avance").style.width = (n / NB * 100) + "%";
    $("suivant").textContent = n === NB ? "Envoyer ma fiche" : "Continuer";
    if (n === 3) dessinerPhotos();
    if (n === 4) setTimeout(function () { if (!signe) prepSig(); }, 30);
    erreur(null);
    window.scrollTo(0, 0);
  }
  $("retour").addEventListener("click", function () {
    if (!$("fini").hidden) return;
    if (E > 1) aller(E - 1); else if (history.length > 1) history.back();
  });
  $("suivant").addEventListener("click", function () {
    var M = controle();
    if (M.length) { erreur(M); return; }
    if (E < NB) { aller(E + 1); return; }
    envoyer();
  });

  /* ─── l'envoi chiffré ─── */
  function fiche() {
    var f = {
      nom: val("nom").toUpperCase(), prenom: val("prenom"), tel: val("tel"),
      profil: R.profil, ue: R.ue,
      titreFin: R.ue === "non" ? val("titreFin") : "",
      permisOrigine: R.ue === "non" ? (R.permisOrigine || "") : "fr",
      permisPays: R.ue === "non" && R.permisOrigine === "etr" ? val("permisPays") : "",
      arrivee: R.ue === "non" && R.permisOrigine === "etr" ? val("arrivee") : "",
      inter: R.ue === "non" ? (R.inter || "") : "",
      permisNum: val("permisNum").toUpperCase(), permisCat: val("permisCat").toUpperCase(), permisFin: val("permisFin"),
      suspendu: R.suspendu || "", visiteTravail: val("visiteTravail"),
    };
    if (R.profil === "pl") {
      f.visitePermisFin = val("visitePermisFin"); f.fco = val("fco"); f.carteQualif = val("carteQualif");
      f.code95 = R.code95 || ""; f.carteCond = val("carteCond");
    } else {
      f.livret = R.livret || ""; f.aCarte = R.aCarte || "";
      f.carteCond = R.aCarte === "oui" ? val("carteCondLeger") : "";
    }
    var P = {};
    photosDemandees().forEach(function (p) { if (PH[p.k]) P[p.k] = { titre: p.t, image: PH[p.k] }; });
    return { v: 1, envoye: new Date().toISOString(), fait: iso(new Date()), champs: f, photos: P,
      signature: cv.toDataURL("image/png") };
  }
  function envoyer() {
    var b = $("suivant"); b.disabled = true; b.textContent = "Envoi en cours...";
    var codeUtil = (code || val("code")).toUpperCase();
    var S = window.crypto.subtle;
    fetch("/fiches/cle", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("cle");
      return r.json();
    }).then(function (o) {
      return Promise.all([
        S.importKey("jwk", o.pub, { name: "ECDH", namedCurve: "P-256" }, false, []),
        S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]),
      ]);
    }).then(function (k) {
      var pubT = k[0], eph = k[1];
      return S.deriveKey({ name: "ECDH", public: pubT }, eph.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"])
        .then(function (cle) {
          var iv = window.crypto.getRandomValues(new Uint8Array(12));
          var iv2 = window.crypto.getRandomValues(new Uint8Array(12));
          var F = fiche();
          var donnees = new TextEncoder().encode(JSON.stringify(F));
          var res = new TextEncoder().encode(JSON.stringify({ nom: F.champs.nom, prenom: F.champs.prenom, profil: F.champs.profil, envoye: F.envoye }));
          return Promise.all([S.exportKey("raw", eph.publicKey), S.encrypt({ name: "AES-GCM", iv: iv }, cle, donnees), iv,
            S.encrypt({ name: "AES-GCM", iv: iv2 }, cle, res), iv2]);
        });
    }).then(function (r) {
      var e = new Uint8Array(r[0]), c = new Uint8Array(r[1]), iv = r[2];
      var out = new Uint8Array(e.length + 12 + c.length);
      out.set(e); out.set(iv, e.length); out.set(c, e.length + 12);
      /* Le résumé : clé éphémère, vecteur, chiffré, en base64. */
      var c2 = new Uint8Array(r[3]), res = new Uint8Array(e.length + 12 + c2.length);
      res.set(e); res.set(r[4], e.length); res.set(c2, e.length + 12);
      var b64 = ""; for (var i = 0; i < res.length; i++) b64 += String.fromCharCode(res[i]);
      return fetch("/fiches/depot", { method: "POST", body: out,
        headers: { "x-fiche-code": codeUtil, "x-fiche-resume": window.btoa(b64), "content-type": "application/octet-stream" } });
    }).then(function (r) {
      if (r.status === 403) throw new Error("code");
      if (!r.ok) throw new Error("depot");
      Array.prototype.forEach.call(document.querySelectorAll("section[data-e]"), function (s) { s.hidden = true; });
      $("fini").hidden = false; $("pied").hidden = true;
      $("etape").textContent = "Envoyée"; $("avance").style.width = "100%";
      erreur(null); window.scrollTo(0, 0);
    }).catch(function (e) {
      b.disabled = false; b.textContent = "Envoyer ma fiche";
      var m = e && e.message;
      erreur(m === "code" ? "Le code est refusé. Demandez le bon code à T.E.C."
        : (m === "cle" ? "Le lien n'est pas encore activé par T.E.C. Réessayez plus tard."
          : "L'envoi n'est pas parti, la connexion a coupé. Réessayez."));
    });
  }

  aller(1);
})();
