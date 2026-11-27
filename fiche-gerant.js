/* LA FICHE DU GÉRANT, CÔTÉ TÉLÉPHONE (27 novembre 2026).

   Trois écrans : ses informations, ses photos, sa signature. L'envoi est
   celui de la fiche des salariés : la fiche est chiffrée ici, dans le
   téléphone, avec la clé publique que T.E.C a déposée sur le site, puis
   déposée avec le code du lien. Elle porte « type : gerant », pour se ranger
   sous « Direction de l'entreprise » et non dans la page d'un salarié.       */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var E = 1, NB = 3;
  var R = { sexe: "M" };
  var PH = {};
  var signe = false;

  var code = "";
  try { var m = /(?:^|[#&])c=([A-Za-z0-9]+)/.exec(location.hash); if (m) code = m[1].toUpperCase(); } catch (e) {}
  if (!code) $("bloc-code").hidden = false;

  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var auj = new Date();
  $("date-jour").textContent = (auj.getDate() === 1 ? "1er" : auj.getDate()) + " " + MOIS[auj.getMonth()] + " " + auj.getFullYear();
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function val(id) { return ($(id).value || "").trim(); }
  function chiffres(v) { return String(v || "").replace(/[^0-9]/g, ""); }

  /* Les numéros en majuscules, sans espace. */
  ["attNum", "carteEntNum"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      var e = $(id), v = e.value.toUpperCase().replace(/[^0-9A-Z]/g, "");
      if (v !== e.value) e.value = v;
    });
  });

  /* L'information lue : l'heure part avec la fiche. */
  var RGPD_LU = "";
  $("rgpdLu").addEventListener("change", function () {
    var c = $("rgpdLu").checked, b = $("rgpd"), d = new Date();
    RGPD_LU = c ? d.toISOString() : "";
    b.classList.toggle("alire", !c); b.classList.toggle("lu", c);
    b.querySelector(".ic").textContent = c ? "✓" : "!";
    $("rgpd-titre").textContent = c ? "Vos données personnelles" : "À lire avant de remplir : vos données personnelles";
    $("rgpd-aide").textContent = c ? "Information lue le " + (d.getDate() === 1 ? "1er" : d.getDate()) + " " + MOIS[d.getMonth()] + " " +
      d.getFullYear() + " à " + ("0" + d.getHours()).slice(-2) + " h " + ("0" + d.getMinutes()).slice(-2) + ". Touchez pour la relire."
      : "Lisez jusqu'en bas, puis cochez la case.";
    if (c) { b.open = false; window.scrollTo(0, 0); }
    erreur(null);
  });

  /* Une date de validité déjà passée se signale, sans bloquer. */
  function signalerPasse() {
    var e = $("carteEntFin"), v = val("carteEntFin"), lab = e.parentNode, mot = lab.querySelector(".passe");
    var passe = /^\d{4}-\d{2}-\d{2}$/.test(v) && parseInt(v.slice(0, 4), 10) >= 1990 && v < iso(new Date());
    if (!passe) { if (mot) mot.parentNode.removeChild(mot); return; }
    if (!mot) { mot = document.createElement("p"); mot.className = "passe"; mot.setAttribute("role", "status"); lab.appendChild(mot); }
    mot.textContent = "La carte entreprise n'est plus valable depuis cette date. Vous pouvez continuer la fiche ; pensez à la renouveler.";
  }
  ["input", "change", "blur"].forEach(function (t) { $("carteEntFin").addEventListener(t, signalerPasse); });

  /* Les choix par boutons. */
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
    $("bloc-carte").hidden = R.carteEnt !== "oui";
    quitterFermer();
  }

  /* Les photos demandées. */
  function photosDemandees() {
    var L = [
      { k: "identiteRecto", t: "Pièce d'identité, recto", o: true },
      { k: "identiteVerso", t: "Pièce d'identité, verso", o: true },
      { k: "capacite", t: "Attestation de capacité professionnelle", o: true },
    ];
    if (R.carteEnt === "oui") L.push({ k: "carteEnt", t: "Carte entreprise du chronotachygraphe, recto", o: true });
    return L;
  }
  function dessinerPhotos() {
    var h = $("photos");
    h.innerHTML = photosDemandees().map(function (p) {
      var a = !!PH[p.k];
      return '<div class="photo" data-p="' + p.k + '">' +
        '<div class="v">' + (a ? '<img alt="" src="' + PH[p.k] + '">' : "&#128247;") + "</div>" +
        '<div class="n">' + p.t + (p.o ? ' <em style="color:var(--rouge);font-style:normal">*</em>' : "") +
        '<small class="' + (a ? "ok" : "") + '">' + (a ? "Photo prise" : "À prendre") + "</small></div>" +
        '<label class="b' + (a ? " refaire" : "") + '">' + (a ? "Refaire" : "Photo") +
        '<input type="file" accept="image/*" capture="environment" data-in="' + p.k + '"></label></div>';
    }).join("");
    Array.prototype.forEach.call(h.querySelectorAll("[data-in]"), function (inp) {
      inp.addEventListener("change", function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        var k = inp.getAttribute("data-in"), ligne = h.querySelector('[data-p="' + k + '"] small');
        if (ligne) { ligne.textContent = "Préparation de la photo..."; ligne.className = ""; }
        reduire(f).then(function (url) { PH[k] = url; dessinerPhotos(); },
          function () { if (ligne) ligne.textContent = "Photo illisible, recommencez"; });
      });
    });
  }
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

  /* La signature. */
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

  /* Les contrôles. */
  function naissanceOk() {
    var v = val("nais"); if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    var y = parseInt(v.slice(0, 4), 10);
    return y >= 1930 && v <= (auj.getFullYear() - 16) + iso(auj).slice(4);
  }
  function dateOk(id) { var v = val(id); if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false; var y = parseInt(v.slice(0, 4), 10); return y >= 1960 && y <= 2100; }
  function controle() {
    var M = [];
    if (E === 1) {
      if (!$("rgpdLu").checked) { M.push("la case « J'ai lu l'information sur mes données personnelles », en haut de la fiche"); $("rgpd").open = true; }
      if (!code && !val("code")) M.push("le code donné par T.E.C");
      if (!val("nom")) M.push("votre nom");
      if (!val("prenom")) M.push("vos prénoms");
      if (!R.sexe) M.push("si vous êtes une femme ou un homme");
      if (!val("nat")) M.push("votre nationalité");
      var nc = chiffres(val("tel")).length;
      if (nc < 10 || nc > 15) M.push("votre numéro de téléphone");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val("courriel"))) M.push("votre adresse e-mail");
      if (!val("nais")) M.push("votre date de naissance");
      else if (!naissanceOk()) M.push("votre date de naissance (elle paraît impossible)");
      if (!val("naisLieu")) M.push("votre lieu de naissance");
      if (!val("adresse")) M.push("votre adresse personnelle");
      if (!val("attNum")) M.push("le numéro de votre attestation de capacité professionnelle");
      if (!val("attDate") || !dateOk("attDate")) M.push("la date de délivrance de votre attestation");
      if (!R.carteEnt) M.push("si vous avez la carte entreprise (oui ou non)");
      if (R.carteEnt === "oui") {
        if (!val("carteEntNum")) M.push("le numéro de la carte entreprise");
        if (!val("carteEntFin") || !dateOk("carteEntFin")) M.push("la date de fin de la carte entreprise");
      }
    }
    if (E === 2) photosDemandees().forEach(function (p) { if (p.o && !PH[p.k]) M.push("la photo : " + p.t.toLowerCase()); });
    if (E === 3) {
      if (!$("certifie").checked) M.push("la case « Je certifie »");
      if (!signe) M.push("votre signature");
    }
    return M;
  }
  function erreur(M) {
    var e = $("err");
    if (!M || !M.length) { e.hidden = true; return; }
    quitterFermer();
    e.textContent = typeof M === "string" ? M : "Il manque : " + M.join(", ") + ".";
    e.hidden = false; window.scrollTo(0, 0);
  }
  function aller(n) {
    E = n;
    Array.prototype.forEach.call(document.querySelectorAll("section[data-e]"), function (s) {
      s.hidden = parseInt(s.getAttribute("data-e"), 10) !== n;
    });
    $("etape").textContent = "Étape " + n + " sur " + NB;
    $("avance").style.width = (n / NB * 100) + "%";
    quitterFermer();
    $("suivant").textContent = n === NB ? "Envoyer ma fiche" : "Continuer";
    if (n === 2) dessinerPhotos();
    if (n === 3) setTimeout(function () { if (!signe) prepSig(); }, 30);
    erreur(null);
    window.scrollTo(0, 0);
  }

  /* Le retour, comme pour la fiche des salariés : il revient d'un écran ; au
     premier, il prévient avant de tout perdre. */
  var sortieVoulue = false;
  function saisi() {
    return !!(val("nais") || val("naisLieu") || val("adresse") || val("attNum") || val("attDate") ||
      $("rgpdLu").checked || signe || Object.keys(PH).length);
  }
  window.addEventListener("beforeunload", function (ev) {
    if (sortieVoulue || !$("fini").hidden || !saisi()) return;
    ev.preventDefault(); ev.returnValue = ""; return "";
  });
  function quitterFermer() { $("quitter").hidden = true; }
  function quitterMontrer(texte, avecQuitter) {
    $("quitter-t").textContent = texte;
    $("quitter-oui").hidden = !avecQuitter;
    $("quitter-non").textContent = avecQuitter ? "Rester sur la fiche" : "D'accord";
    $("quitter").hidden = false; erreur(null); window.scrollTo(0, 0);
  }
  $("quitter-oui").addEventListener("click", function () { quitterFermer(); sortieVoulue = true; if (history.length > 1) history.back(); });
  $("quitter-non").addEventListener("click", quitterFermer);
  $("retour").addEventListener("click", function () {
    var envoyee = !$("fini").hidden;
    if (!envoyee && E !== 1) { aller(E - 1); return; }
    if (history.length <= 1) {
      quitterMontrer(envoyee ? "Votre fiche est envoyée. Vous pouvez fermer cette page."
        : "Vous êtes au début de la fiche, il n'y a pas de page avant. Pour arrêter, fermez cette page" +
          (saisi() ? " : ce que vous avez saisi ne sera pas envoyé." : "."), false);
      return;
    }
    if (!envoyee && saisi()) { quitterMontrer("Quitter la fiche ? Ce que vous avez saisi sera perdu.", true); return; }
    sortieVoulue = true; history.back();
  });
  $("suivant").addEventListener("click", function () {
    var M = controle();
    if (M.length) { erreur(M); return; }
    if (E < NB) { aller(E + 1); return; }
    envoyer();
  });

  /* L'envoi chiffré, identique à celui de la fiche des salariés. */
  function fiche() {
    var f = {
      type: "gerant", rgpdLu: RGPD_LU,
      nom: val("nom").toUpperCase(), prenom: val("prenom"), sexe: R.sexe || "", nat: val("nat"),
      tel: val("tel"), courriel: val("courriel"),
      nais: val("nais"), naisLieu: val("naisLieu"), adresse: val("adresse"),
      fonction: "Gérant", gestionnaire: "oui",
      attNum: val("attNum"), attDate: val("attDate"),
      carteEnt: R.carteEnt || "",
      carteEntNum: R.carteEnt === "oui" ? val("carteEntNum") : "",
      carteEntFin: R.carteEnt === "oui" ? val("carteEntFin") : "",
    };
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
          var res = new TextEncoder().encode(JSON.stringify({ type: "gerant", nom: F.champs.nom, prenom: F.champs.prenom, envoye: F.envoye }));
          return Promise.all([S.exportKey("raw", eph.publicKey), S.encrypt({ name: "AES-GCM", iv: iv }, cle, donnees), iv,
            S.encrypt({ name: "AES-GCM", iv: iv2 }, cle, res), iv2]);
        });
    }).then(function (r) {
      var e = new Uint8Array(r[0]), c = new Uint8Array(r[1]), iv = r[2];
      var out = new Uint8Array(e.length + 12 + c.length);
      out.set(e); out.set(iv, e.length); out.set(c, e.length + 12);
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
