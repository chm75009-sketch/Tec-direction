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

  /* ─── les catégories du permis, à cocher (26 novembre 2026) ───
     Un permis en porte souvent plusieurs : des cases, pas une liste. Ce sont
     les catégories de l'article R. 221-10 du code de la route
     (LEGIARTI000051682550), lu à la source le 25 novembre 2026. */
  var CATS = ["B", "BE", "C1", "C1E", "C", "CE", "D1", "D1E", "D", "DE", "A1", "A2", "A"];
  $("cats").innerHTML = CATS.map(function (c) {
    return '<label data-cat="' + c + '"><input type="checkbox" value="' + c + '">' + c + "</label>";
  }).join("");
  Array.prototype.forEach.call($("cats").querySelectorAll("input"), function (i) {
    i.addEventListener("change", function () { i.parentNode.classList.toggle("on", i.checked); });
  });
  function categories() {
    return Array.prototype.filter.call($("cats").querySelectorAll("input"), function (i) { return i.checked; })
      .map(function (i) { return i.value; }).join(", ");
  }

  /* ─── les numéros, mis en forme pendant la saisie ─── */
  function chiffres(v) { return String(v || "").replace(/[^0-9]/g, ""); }
  /* LE TÉLÉPHONE EN +33 (27 novembre 2026). Un numéro collé depuis les
     contacts arrive souvent en « +33 6 12 34 56 78 », ou en 0033 : le « + »
     était effacé et le 33 pris pour les deux premiers chiffres, ce qui donnait
     « 33 61 23 45 67 ». On reconnaît donc l'indicatif, on le remplace par le
     0, et on retire le « (0) » que certains y glissent. Pendant la frappe,
     « + », « +3 » et « +33 » restent tels quels, en attendant la suite. */
  function formeTel(v) {
    var s = String(v || "").replace(/[\s.\-()\/]/g, "");
    if (/^\+(3(3)?)?$/.test(s)) return s;
    var m = /^(?:\+|00)33(.*)$/.exec(s);
    var d;
    if (m) {
      d = chiffres(m[1]).replace(/^0/, "");
      if (!d) return "+33";
      d = "0" + d;
    } else if (/^(?:\+|00)/.test(s)) {
      /* UN NUMÉRO ÉTRANGER (27 novembre 2026) : +212, +216, 0039... Il était
         réduit à ses dix premiers chiffres et le numéro faux qui en sortait
         passait. On garde le « + » et l'indicatif, jusqu'à quinze chiffres,
         qui est la longueur la plus grande d'un numéro international. */
      d = chiffres(s.replace(/^00/, "")).slice(0, 15);
      return "+" + d;
    } else {
      d = chiffres(v);
      if (d.indexOf("33") === 0 && d.length === 11) d = "0" + d.slice(2);
    }
    return d.slice(0, 10).replace(/(\d{2})(?=\d)/g, "$1 ");
  }
  /* Le numéro de sécurité sociale : 1 85 03 75 123 456 78. Le département
     peut s'écrire 2A ou 2B pour la Corse. */
  function nirBrut(v) { return String(v || "").toUpperCase().replace(/[^0-9AB]/g, "").slice(0, 15); }
  function formeNir(v) {
    var n = nirBrut(v), parts = [1, 2, 2, 2, 3, 3, 2], out = [], i = 0;
    parts.forEach(function (l) { if (i < n.length) { out.push(n.substr(i, l)); i += l; } });
    return out.join(" ");
  }
  /* LA CLÉ (27 novembre 2026) : 97 moins le reste de la division des treize
     premiers chiffres par 97. Pour la Corse, 2A se lit 19 et 2B se lit 18, et
     c'est tout : le code retirait en plus 1 000 000 ou 2 000 000, ce qui
     faisait refuser tous les numéros corses exacts. */
  function nirValide(v) {
    var n = nirBrut(v);
    if (!/^[12378]\d{4}(\d{2}|2A|2B)\d{6}\d{2}$/.test(n)) return false;
    var corps = n.slice(0, 13), cle = parseInt(n.slice(13), 10);
    var num = corps.slice(0, 5) + corps.slice(5, 7).replace("2A", "19").replace("2B", "18") + corps.slice(7);
    var reste = 0;
    for (var k = 0; k < num.length; k++) reste = (reste * 10 + parseInt(num.charAt(k), 10)) % 97;
    return 97 - reste === cle;
  }
  function brancherForme(id, f) {
    $(id).addEventListener("input", function () {
      var e = $(id), avant = e.value, v = f(avant);
      if (v !== avant) { e.value = v; try { e.setSelectionRange(v.length, v.length); } catch (x) {} }
    });
  }
  brancherForme("tel", formeTel);
  brancherForme("nir", formeNir);
  brancherForme("permisNum", function (v) { return String(v || "").toUpperCase().replace(/[^0-9A-Z]/g, ""); });
  /* Les numéros de carte conducteur et de titre : lettres et chiffres en
     majuscules, sans espace (27 novembre 2026). */
  ["carteNum", "carteNumLeger"].forEach(function (id) {
    brancherForme(id, function (v) { return String(v || "").toUpperCase().replace(/[^0-9A-Z]/g, ""); });
  });
  brancherForme("titreNum", function (v) { return String(v || "").toUpperCase().replace(/[^0-9A-Z]/g, ""); });
  /* Les nationalités proposées en tapant, celles que l'application sait
     accorder dans les contrats. */
  try {
    var NAT = (window.ListesValeurs && window.ListesValeurs.nationalite) || [];
    $("liste-nat").innerHTML = NAT.map(function (n) { return '<option value="' + String(n).replace(/"/g, "&quot;") + '">'; }).join("");
  } catch (e) {}
  /* Sans numéro de sécurité sociale, la case se vide et ne s'exige plus. */
  $("sansNir").addEventListener("change", function () {
    $("nir").disabled = $("sansNir").checked;
    if ($("sansNir").checked) $("nir").value = "";
  });
  /* LE DERNIER TÉLÉCHARGEMENT DE LA CARTE (27 novembre 2026) : il lance le
     voyant des vingt-huit jours dans le suivi de la carte conducteur. Celui
     qui ne le connaît pas le dit, et la case ne s'exige plus. */
  [["sansTelec", "telecCarte"], ["sansTelecLeger", "telecCarteLeger"]].forEach(function (x) {
    $(x[0]).addEventListener("change", function () {
      $(x[1]).disabled = $(x[0]).checked;
      if ($(x[0]).checked) $(x[1]).value = "";
    });
  });

  /* UNE DATE DE VALIDITÉ DÉJÀ PASSÉE SE SIGNALE, SANS BLOQUER (27 novembre
     2026). Le salarié qui saisit une visite médicale ou une carte expirée
     n'en savait rien : seul T.E.C le voyait, en recevant la fiche. Un mot
     s'affiche sous la case ; la fiche continue. */
  var PASSE = {
    permisFin: "Votre permis n'est plus valable depuis cette date.",
    visitePermisFin: "Votre visite médicale du permis n'est plus valable depuis cette date.",
    carteQualif: "Votre carte de qualification n'est plus valable depuis cette date.",
    carteCond: "Votre carte conducteur n'est plus valable depuis cette date.",
    carteCondLeger: "Votre carte conducteur n'est plus valable depuis cette date.",
    titreFin: "Votre titre n'est plus valable depuis cette date."
  };
  function signalerPasse(id) {
    var e = $(id), v = (e.value || "").trim(), lab = e.parentNode;
    var mot = lab.querySelector(".passe");
    var passe = /^\d{4}-\d{2}-\d{2}$/.test(v) && parseInt(v.slice(0, 4), 10) >= 1950 && v < iso(new Date());
    if (!passe) { if (mot) mot.parentNode.removeChild(mot); return; }
    if (!mot) { mot = document.createElement("p"); mot.className = "passe"; mot.setAttribute("role", "status"); lab.appendChild(mot); }
    mot.textContent = PASSE[id] + " Vous pouvez continuer la fiche ; prévenez T.E.C au plus vite.";
  }
  Object.keys(PASSE).forEach(function (id) {
    ["input", "change", "blur"].forEach(function (t) { $(id).addEventListener(t, function () { signalerPasse(id); }); });
  });

  /* L'INFORMATION LUE (27 novembre 2026). La case cochée garde l'heure, qui
     part avec la fiche ; l'encadré passe au vert et se referme. */
  var RGPD_LU = "";
  function heureFr(d) { return ("0" + d.getHours()).slice(-2) + " h " + ("0" + d.getMinutes()).slice(-2); }
  $("rgpdLu").addEventListener("change", function () {
    var c = $("rgpdLu").checked, b = $("rgpd");
    RGPD_LU = c ? new Date().toISOString() : "";
    b.classList.toggle("alire", !c); b.classList.toggle("lu", c);
    b.querySelector(".ic").textContent = c ? "✓" : "!";
    $("rgpd-titre").textContent = c ? "Vos données personnelles" : "À lire avant de remplir : vos données personnelles";
    var d = new Date();
    $("rgpd-aide").textContent = c ? "Information lue le " + (d.getDate() === 1 ? "1er" : d.getDate()) + " " + MOIS[d.getMonth()] + " " + d.getFullYear() + " à " + heureFr(d) + ". Touchez pour la relire."
      : "Lisez jusqu'en bas, puis cochez la case.";
    if (c) { b.open = false; window.scrollTo(0, 0); }
    erreur(null);
  });

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
  /* ROULANT OU NON ROULANT (26 novembre 2026). Une seule fiche pour tout le
     personnel : le salarié dit d'abord s'il conduit pour T.E.C. S'il ne
     conduit pas, tout ce qui touche au permis et aux cartes disparaît, écran
     du permis compris ; il ne reste que son identité, sa nationalité, ses
     photos et sa signature. */
  function roulant() { return R.roulant === "oui"; }
  function etapes() { return R.roulant === "non" ? [1, 3, 4] : [1, 2, 3, 4]; }
  /* CE QUI EST CACHÉ N'EST NI EXIGÉ NI ENVOYÉ (27 novembre 2026). Un roulant
     qui avait choisi « Poids lourd » ou « Permis étranger » puis passait en
     non roulant gardait ces réponses en mémoire : le pays du permis et la date
     d'arrivée restaient exigés alors qu'on ne les voyait plus, et les cartes du
     poids lourd restaient demandées en photo. Les réponses du roulant ne
     comptent donc que pour un roulant, ici, et partout où elles servent. */
  function profil() { return roulant() ? (R.profil || "") : ""; }
  function permisEtr() { return roulant() && R.permisOrigine === "etr"; }
  function compteur() {
    var L = etapes(), rang = L.indexOf(E) + 1;
    if (!rang) return;
    $("etape").textContent = "Étape " + rang + " sur " + L.length;
    $("avance").style.width = (rang / L.length * 100) + "%";
  }
  function montrer() {
    $("bloc-profil").hidden = !roulant();
    $("etr-roulant").hidden = !roulant();
    $("etranger").hidden = R.ue !== "non";
    $("permis-etr").hidden = !permisEtr();
    $("bloc-pl").hidden = profil() !== "pl";
    $("bloc-leger").hidden = profil() !== "leger";
    $("lib-carte-leger").hidden = !(profil() === "leger" && R.aCarte === "oui");
    $("retrait").hidden = !(roulant() && R.suspendu === "oui");
    $("qualif-oblig").hidden = R.code95 !== "non";
    /* Le compteur suit tout de suite le choix roulant ou non roulant (trois
       écrans au lieu de quatre), sans attendre « Continuer ». */
    compteur();
    quitterFermer();
  }

  /* ─── les photos demandées, selon les réponses ─── */
  function photosDemandees() {
    var L = !roulant() ? [] : [
      { k: "permisRecto", t: "Permis de conduire, recto", o: true },
      { k: "permisVerso", t: "Permis de conduire, verso", o: true },
    ];
    L = L.concat([
      /* La pièce d'identité, recto et verso, pour tous : demande du
         25 novembre 2026. */
      { k: "identiteRecto", t: "Pièce d'identité, recto", o: true },
      { k: "identiteVerso", t: "Pièce d'identité, verso", o: true },
    ]);
    /* La carte de qualification est la preuve du code 95 quand le permis ne
       le porte pas : elle est alors exigée (R. 3315-1 et R. 3315-2 du code
       des transports). La carte conducteur d'un poids lourd aussi. */
    if (profil() === "pl") {
      L.push(R.code95 === "non"
        ? { k: "carteQualif", t: "Carte de qualification de conducteur, recto", o: true }
        : { k: "carteQualif", t: "Carte de qualification de conducteur, recto", s: "Si vous l'avez" });
      L.push({ k: "carteCond", t: "Carte conducteur (chronotachygraphe), recto", o: true });
    }
    if (profil() === "leger" && R.aCarte === "oui") L.push({ k: "carteCond", t: "Carte conducteur (chronotachygraphe), recto", o: true });
    if (R.ue === "non") {
      L.push({ k: "titreRecto", t: "Titre de séjour, recto", o: true });
      L.push({ k: "titreVerso", t: "Titre de séjour, verso", o: true });
      if (roulant() && R.inter === "oui") L.push({ k: "attestation", t: "Attestation de conducteur", s: "Si vous l'avez" });
    }
    /* La carte Vitale en dernier, demande du 25 novembre 2026 : les papiers
       de conduite d'abord, puis le reste. */
    L.push({ k: "vitale", t: "Carte Vitale, recto", o: true });
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
  /* Un champ se voit-il à l'écran ? Il est caché dès que lui ou un de ses
     blocs porte « hidden » (27 novembre 2026). */
  function visible(id) {
    for (var e = $(id); e && e !== document.body; e = e.parentNode) if (e.hidden) return false;
    return true;
  }
  /* La date de naissance : une vraie date, et quelqu'un d'au moins
     quatorze ans. */
  function naissanceOk() {
    var v = val("nais"); if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    var y = parseInt(v.slice(0, 4), 10);
    return y >= 1930 && v <= (auj.getFullYear() - 14) + iso(auj).slice(4);
  }
  function controle() {
    var M = [];
    if (E === 1) {
      if (!$("rgpdLu").checked) { M.push("la case « J'ai lu l'information sur mes données personnelles », en haut de la fiche"); $("rgpd").open = true; }
      if (!code && !val("code")) M.push("le code donné par T.E.C");
      if (!val("nom")) M.push("votre nom");
      if (!val("prenom")) M.push("vos prénoms");
      if (!R.sexe) M.push("si vous êtes une femme ou un homme");
      if (!val("nais")) M.push("votre date de naissance");
      else if (!naissanceOk()) M.push("votre date de naissance (elle paraît impossible)");
      if (!val("naisLieu")) M.push("votre lieu de naissance");
      if (!val("adresse")) M.push("votre adresse");
      if (!val("tel")) M.push("votre numéro de téléphone");
      else {
        var t = formeTel(val("tel")), nc = chiffres(t).length;
        if (t.charAt(0) === "+" ? (nc < 8 || nc > 15) : nc !== 10) M.push("un numéro de téléphone complet (10 chiffres, ou l'indicatif du pays précédé de +)");
      }
      if (val("courriel") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val("courriel"))) M.push("une adresse e-mail complète, ou laissez la case vide");
      if (!$("sansNir").checked && !val("nir")) M.push("votre numéro de sécurité sociale, ou cochez « Je n'ai pas encore de numéro »");
      if (!$("sansNir").checked && val("nir") && !nirValide(val("nir"))) M.push("un numéro de sécurité sociale exact (15 chiffres, vérifiez la clé, les 2 derniers)");
      /* La dernière visite chez le médecin du travail est sur ce premier
         écran : elle se contrôle ici, roulant ou non, comme les autres dates
         (27 novembre 2026). Une année 0202 passait sans rien dire. */
      if (!dateOk("visiteTravail", false)) M.push("la date de votre dernière visite chez le médecin du travail (l'année paraît impossible)");
      if (!R.roulant) M.push("si vous êtes personnel roulant ou non roulant");
      if (roulant() && !R.profil) M.push("votre profil (poids lourd ou pas)");
      if (!val("nat")) M.push("votre nationalité");
      if (!R.ue) M.push("si vous êtes ressortissant de l'Union européenne, de l'EEE ou de la Suisse (oui ou non)");
      if (R.ue === "non") {
        if (!val("titreType")) M.push("le type de votre titre de séjour");
        if (!val("titreNum")) M.push("le numéro de votre titre de séjour");
        if (!val("titreFin") || !dateOk("titreFin", true)) M.push("la date de fin de votre titre de séjour");
      }
    }
    if (E === 2) {
      if (!val("permisNum")) M.push("le numéro de votre permis");
      var cats = categories();
      if (!cats) M.push("les catégories de votre permis (cochez-les)");
      else if (profil() === "pl" && !/(^|, )C1?E?(,|$)/.test(cats)) M.push("une catégorie poids lourd (C1, C1E, C ou CE), ou choisissez « Pas poids lourd » à l'étape 1");
      if (!val("permisFin") || !dateOk("permisFin", true)) M.push("la date de fin de validité de votre permis");
      if (!R.permisOrigine) M.push("le pays où votre permis a été délivré");
      if (permisEtr()) {
        if (!val("permisPays")) M.push("le pays de votre permis");
        if (!val("arrivee") || !dateOk("arrivee", true)) M.push("votre date d'arrivée en France");
        if (!R.permisEchange) M.push("si vous avez demandé l'échange de votre permis (oui ou non)");
      }
      if (val("points") !== "") {
        var pts = Number(val("points"));
        if (!(pts >= 0 && pts <= 12 && Math.floor(pts) === pts)) M.push("un nombre de points entre 0 et 12");
      }
      if (!R.suspendu) M.push("si votre permis est suspendu (oui ou non)");
      if (R.suspendu === "oui" && (!val("retraitLe") || !dateOk("retraitLe", true))) M.push("la date de la suspension ou du retrait");
      if (profil() === "pl") {
        if (!val("visitePermisFin")) M.push("la date de fin de la visite médicale du permis");
        /* La FIMO est exigée, sauf si une FCO est datée : la FCO suppose la
           FIMO faite avant. */
        if (!val("fimo") && !val("fco")) M.push("la date de votre FIMO (ou, à défaut, de votre dernière FCO)");
        if (val("fimo") && val("fco") && val("fco") < val("fimo")) M.push("des dates de formation à vérifier (la FCO vient après la FIMO)");
        if (!R.code95) M.push("si votre permis porte le code 95 (oui ou non)");
        if (R.code95 === "non" && !val("carteQualif")) M.push("la date de fin de votre carte de qualification (votre permis ne porte pas le code 95)");
        if (!val("carteNum")) M.push("le numéro de votre carte conducteur");
        if (!val("carteCond")) M.push("la date de fin de votre carte conducteur");
        if (!$("sansTelec").checked && !val("telecCarte")) M.push("la date du dernier téléchargement de votre carte, ou cochez « Je ne connais pas cette date »");
        if (val("telecCarte") && val("telecCarte") > iso(new Date())) M.push("une date de téléchargement de la carte qui n'est pas encore arrivée");
      }
      if (profil() === "leger") {
        if (!R.livret) M.push("si vous avez votre livret individuel de contrôle (oui ou non)");
        if (!R.aCarte) M.push("si vous avez une carte conducteur (oui ou non)");
        if (R.aCarte === "oui" && !val("carteNumLeger")) M.push("le numéro de votre carte conducteur");
        if (R.aCarte === "oui" && !val("carteCondLeger")) M.push("la date de fin de votre carte conducteur");
        if (R.aCarte === "oui" && !$("sansTelecLeger").checked && !val("telecCarteLeger")) M.push("la date du dernier téléchargement de votre carte, ou cochez « Je ne connais pas cette date »");
        if (R.aCarte === "oui" && val("telecCarteLeger") && val("telecCarteLeger") > iso(new Date())) M.push("une date de téléchargement de la carte qui n'est pas encore arrivée");
      }
      /* Seules les dates qu'on voit se contrôlent : celles du bloc poids lourd
         ne doivent pas bloquer un « pas poids lourd », ni l'inverse. */
      ["visitePermisFin", "fimo", "fco", "carteQualif", "carteCond", "carteCondLeger", "telecCarte", "telecCarteLeger", "arrivee", "retraitLe", "retraitFin"].forEach(function (id) {
        if (visible(id) && !dateOk(id, false)) M.push("une date à corriger (l'année paraît impossible)");
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
    quitterFermer();
    e.textContent = typeof M === "string" ? M
      : "Il manque : " + M.filter(function (x, i) { return M.indexOf(x) === i; }).join(", ") + ".";
    e.hidden = false; window.scrollTo(0, 0);
  }
  function aller(n) {
    E = n;
    Array.prototype.forEach.call(document.querySelectorAll("section[data-e]"), function (s) {
      s.hidden = parseInt(s.getAttribute("data-e"), 10) !== n;
    });
    compteur();
    quitterFermer();
    $("suivant").textContent = n === NB ? "Envoyer ma fiche" : "Continuer";
    if (n === 3) dessinerPhotos();
    if (n === 4) setTimeout(function () { if (!signe) prepSig(); }, 30);
    erreur(null);
    window.scrollTo(0, 0);
  }
  /* LE RETOUR NE BLOQUE JAMAIS (26 novembre 2026). Ouverte dans
     l'application installée, la fiche restait l'écran de reprise et le retour
     ne menait nulle part. Sur l'appareil de T.E.C ou du cabinet (le dossier y
     est), le retour ramène à l'accueil ; pour un salarié, il revient à la
     page précédente quand il y en a une. */
  var poste = false;
  try { poste = !!window.localStorage.getItem("synchro-cle"); } catch (e) {}
  if (poste) $("vers-appli").hidden = false;
  /* LE GESTE RETOUR DU TÉLÉPHONE (27 novembre 2026). Le bouton de la page
     prévient avant de tout perdre, mais le geste retour du système, ou la
     fermeture de l'onglet, quittaient sans rien dire. Tant que la fiche n'est
     pas envoyée et que quelque chose est saisi, le navigateur demande
     confirmation. Quand on a déjà dit « Quitter », on ne redemande pas. */
  var sortieVoulue = false;
  window.addEventListener("beforeunload", function (ev) {
    if (sortieVoulue || !$("fini").hidden || !saisi()) return;
    ev.preventDefault();
    ev.returnValue = "";
    return "";
  });
  function sortir() {
    sortieVoulue = true;
    if (poste) location.href = "index.html";
    else if (history.length > 1) history.back();
  }
  /* LE RETOUR DE L'ÉTAPE 1 PRÉVIENT AVANT DE TOUT PERDRE (27 novembre 2026).
     Il quittait la fiche sans un mot, et tout ce qui était saisi partait
     avec ; ouverte seule depuis le lien WhatsApp, sans page d'avant, il ne
     faisait rien du tout. Désormais : si quelque chose est saisi, on demande
     avant de quitter ; s'il n'y a nulle part où revenir, on le dit, au lieu
     d'un bouton qui semble mort. */
  function saisi() {
    var champs = document.querySelectorAll("main input[type=text], main input[type=tel], main input[type=date], main input[type=email], main input[type=number], main select");
    for (var i = 0; i < champs.length; i++) if ((champs[i].value || "").trim()) return true;
    if (categories() || $("certifie").checked || signe) return true;
    for (var k in PH) if (PH[k]) return true;
    for (var r in R) if (!(r === "roulant" && R[r] === "oui")) return true;
    return false;
  }
  function quitterFermer() { $("quitter").hidden = true; }
  function quitterMontrer(texte, avecQuitter) {
    $("quitter-t").textContent = texte;
    $("quitter-oui").hidden = !avecQuitter;
    $("quitter-non").textContent = avecQuitter ? "Rester sur la fiche" : "D'accord";
    $("quitter").hidden = false;
    erreur(null);
    window.scrollTo(0, 0);
  }
  $("quitter-oui").addEventListener("click", function () { quitterFermer(); sortir(); });
  $("quitter-non").addEventListener("click", quitterFermer);
  $("retour").addEventListener("click", function () {
    var envoyee = !$("fini").hidden;
    if (!envoyee && E !== 1) { var L = etapes(); aller(L[Math.max(0, L.indexOf(E) - 1)]); return; }
    var ailleurs = poste || history.length > 1;
    if (!ailleurs) {
      quitterMontrer(envoyee
        ? "Votre fiche est envoyée. Vous pouvez fermer cette page."
        : "Vous êtes au début de la fiche, il n'y a pas de page avant. Pour arrêter, fermez cette page" +
          (saisi() ? " : ce que vous avez saisi ne sera pas envoyé." : "."), false);
      return;
    }
    if (!envoyee && saisi()) {
      quitterMontrer("Quitter la fiche ? Ce que vous avez saisi sera perdu.", true);
      return;
    }
    sortir();
  });
  $("suivant").addEventListener("click", function () {
    var M = controle();
    if (M.length) { erreur(M); return; }
    if (E < NB) { var L = etapes(); aller(L[L.indexOf(E) + 1]); return; }
    envoyer();
  });

  /* ─── l'envoi chiffré ─── */
  function fiche() {
    var f = {
      nom: val("nom").toUpperCase(), prenom: val("prenom"), adresse: val("adresse"), tel: formeTel(val("tel")),
      nir: $("sansNir").checked ? "" : formeNir(val("nir")), sansNir: $("sansNir").checked ? "oui" : "",
      /* L'identité du registre et de l'embauche (27 novembre 2026). */
      rgpdLu: RGPD_LU,
      sexe: R.sexe || "", nais: val("nais"), naisLieu: val("naisLieu"), nat: val("nat"), courriel: val("courriel"),
      roulant: R.roulant, profil: profil(), ue: R.ue,
      titreType: R.ue === "non" ? val("titreType") : "",
      titreNum: R.ue === "non" ? val("titreNum") : "",
      titreFin: R.ue === "non" ? val("titreFin") : "",
      permisOrigine: roulant() ? (R.permisOrigine || "") : "",
      /* Ce qui n'est plus demandé ne part pas (27 novembre 2026). */
      permisPays: permisEtr() ? val("permisPays") : "",
      arrivee: permisEtr() ? val("arrivee") : "",
      permisEchange: permisEtr() ? (R.permisEchange || "") : "",
      inter: roulant() && R.ue === "non" ? (R.inter || "") : "",
      visiteTravail: val("visiteTravail"),
    };
    if (roulant()) {
      f.permisNum = val("permisNum").toUpperCase(); f.permisCat = categories(); f.permisFin = val("permisFin");
      f.points = val("points");
      f.suspendu = R.suspendu || "";
      if (R.suspendu === "oui") { f.retraitLe = val("retraitLe"); f.retraitFin = val("retraitFin"); f.retraitMotif = val("retraitMotif"); }
    }
    if (!roulant()) {
      /* rien du permis ni des cartes */
    } else if (profil() === "pl") {
      f.visitePermisFin = val("visitePermisFin"); f.fimo = val("fimo"); f.fco = val("fco"); f.carteQualif = val("carteQualif");
      f.code95 = R.code95 || ""; f.carteNum = val("carteNum"); f.carteCond = val("carteCond");
      f.telecCarte = $("sansTelec").checked ? "" : val("telecCarte");
    } else {
      f.livret = R.livret || ""; f.aCarte = R.aCarte || "";
      f.carteNum = R.aCarte === "oui" ? val("carteNumLeger") : "";
      f.carteCond = R.aCarte === "oui" ? val("carteCondLeger") : "";
      f.telecCarte = R.aCarte === "oui" && !$("sansTelecLeger").checked ? val("telecCarteLeger") : "";
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

  /* Par défaut, personnel roulant : demande du 26 novembre 2026. */
  (function () {
    var b = document.querySelector('[data-choix="roulant"] [data-v="oui"]');
    if (b) b.click();
  })();
  aller(1);
})();
