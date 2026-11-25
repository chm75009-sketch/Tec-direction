/* LE PARTAGE ENTRE LE CABINET ET T.E.C.

   POURQUOI CE FICHIER EXISTE

   Demande du 24 novembre 2026 : « quand moi je fais quelque chose, eux ils ont
   la même chose ». Jusqu'ici, chaque appareil gardait ses données pour lui :
   ce que T.E.C saisissait restait sur son téléphone, ce que le cabinet saisissait
   restait sur le sien.

   CE QU'IL FAIT

   - Chaque donnée de l'application (fiche d'entreprise, registre, flotte,
     brouillons, réglages) est envoyée, chiffrée, dans un espace commun gardé
     par le Worker du site. À l'ouverture de chaque page, l'application relit
     cet espace et reprend ce qui a changé ailleurs.
   - Les documents de « Mes documents » suivent le même chemin, un par un.
   - Tout est chiffré ici, sur l'appareil, avec la clé du dossier, celle que le
     mot de passe ouvre. Le serveur ne reçoit que des blocs illisibles : ni
     Cloudflare ni personne d'autre ne peut les lire.

   QUAND DEUX APPAREILS CHANGENT LA MÊME CHOSE

   La dernière modification l'emporte, donnée par donnée. Au tout premier
   partage, si les deux appareils ont chacun leur version d'une même donnée,
   celle du téléphone de T.E.C l'emporte : c'est lui qui travaille au quotidien
   sur le site.

   LES LIMITES, ET CE QUI S'AFFICHE

   L'espace gratuit de Cloudflare compte 1 Go et 1 000 enregistrements par jour.
   Un message s'affiche si un envoi est refusé, et une alerte dès que l'espace
   est rempli à 80 %. Rien n'est perdu en cas de refus : la modification reste
   sur l'appareil et repart à l'ouverture suivante.

   CE QUI NE VOYAGE PAS

   La séance et le mot de passe, la clé d'accès à l'assistant (elle est
   personnelle), et tout ce qui ne vaut que pour l'appareil.

   LE CHEF DE PARC (25 novembre 2026)

   Il partage le parc, et le parc seulement : véhicules, fiches conducteur,
   paramètres, sinistres, et les documents de la flotte. Ces données vivent
   dans un second espace, chiffré avec une clé propre au parc, tirée de celle
   du dossier. T.E.C et le cabinet l'ont donc ; le chef de parc la reçoit dans
   son accès (dossier-parc.js), sans jamais recevoir la clé du dossier : il ne
   peut pas lire le reste, registre du personnel compris.                    */

(function (window, document) {
  "use strict";

  var ls = window.localStorage;
  if (!ls || !window.crypto || !window.crypto.subtle || !window.fetch) return;

  var CLE_CLE = "synchro-cle";
  var CLE_CLE_PARC = "synchro-cle-parc";
  var CLE_T = "synchro-t";          /* l'heure de chaque donnée, telle que partagée */
  var CLE_SALES = "synchro-sales";  /* les données modifiées ici, pas encore envoyées */
  var CLE_DOCS = "synchro-docs";    /* les documents déjà partagés : uid -> oui */
  var PLAFOND = 1000 * 1000 * 1000; /* 1 Go */
  var ALERTE = 0.8;
  var TAILLE_MAX_DOC = 24 * 1024 * 1024;

  /* Ce qui ne voyage jamais. */
  var JAMAIS = ["seance-ouverte", "seance-role", "seance-battement", "journal-qui",
    "dossier-ouvert-le", "assistant-cle-anthropic", "equipe-session", "droits-attente"];
  function partageable(k) {
    if (!k) return false;
    k = String(k);
    if (k.indexOf("synchro-") === 0) return false;
    return JAMAIS.indexOf(k) < 0;
  }
  /* Le parc : ce que le chef de parc partage avec tout le monde. */
  function cleDuParc(k) { return /^(flotte|parc)-/.test(String(k)); }
  function docDuParc(d) { var r = String((d && d.rubrique) || ""); return r === "flotte" || r.indexOf("parc") === 0; }

  var setOrig = Storage.prototype.setItem;
  var removeOrig = Storage.prototype.removeItem;
  function lireJ(k, def) {
    try { var v = ls.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function ecrireJ(k, v) {
    try { setOrig.call(ls, k, JSON.stringify(v)); } catch (e) {}
  }

  function role() {
    try {
      return window.sessionStorage.getItem("seance-role") || ls.getItem("seance-role") || "tec";
    } catch (e) { return "tec"; }
  }

  /* QUAND ON APPLIQUE CE QUI VIENT D'AILLEURS, ON NE LE RENVOIE PAS. */
  var applique = false;
  var minuterie = null;

  function noterSale(k) {
    if (applique || !partageable(k) || ls !== this) return;
    var t = lireJ(CLE_T, {});
    t[k] = Date.now();
    ecrireJ(CLE_T, t);
    var s = lireJ(CLE_SALES, {});
    s[k] = 1;
    ecrireJ(CLE_SALES, s);
    if (minuterie) window.clearTimeout(minuterie);
    minuterie = window.setTimeout(function () { synchroniser(false); }, 3000);
  }
  try {
    /* Une écriture qui ne change rien ne part pas : certaines pages réécrivent
       la même fiche à chaque ouverture. */
    Storage.prototype.setItem = function (k, v) {
      var avant = this.getItem(k);
      setOrig.call(this, k, v);
      if (avant !== String(v)) noterSale.call(this, k);
    };
    Storage.prototype.removeItem = function (k) {
      var avant = this.getItem(k);
      removeOrig.call(this, k);
      if (avant !== null) noterSale.call(this, k);
    };
  } catch (e) {}

  /* LE CHIFFREMENT, AVEC LA CLÉ DU DOSSIER. */
  function deBase64(s) {
    var b = window.atob(s), t = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) t[i] = b.charCodeAt(i);
    return t;
  }
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (x) {
      return ("0" + x.toString(16)).slice(-2);
    }).join("");
  }
  /* DEUX ESPACES. Le commun, pour tout sauf le parc, chiffré avec la clé du
     dossier ; celui du parc, chiffré avec la clé du parc. */
  function concat(a, b) {
    var t = new Uint8Array(a.length + b.length); t.set(a); t.set(b, a.length); return t;
  }
  function espace(nom, chemin, brut, etiquette, garde, gardeDoc, cleDocs) {
    var e = { nom: nom, chemin: chemin, garde: garde, gardeDoc: gardeDoc, cleDocs: cleDocs, taille: 0, poids: 0 };
    return Promise.all([
      window.crypto.subtle.importKey("raw", brut, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]),
      window.crypto.subtle.digest("SHA-256", concat(new TextEncoder().encode(etiquette), brut)),
    ]).then(function (r) { e.cle = r[0]; e.jeton = hex(r[1]); return e; });
  }
  /* La clé du parc se tire de celle du dossier : la même partout. */
  function cleParcDepuis(brut) {
    return window.crypto.subtle.importKey("raw", brut, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
      .then(function (k) {
        return window.crypto.subtle.sign("HMAC", k, new TextEncoder().encode("partage-parc"));
      }).then(function (m) { return new Uint8Array(m); });
  }
  var ESPACES = null;
  function preparer() {
    if (ESPACES) return Promise.resolve(ESPACES.length > 0);
    var parc = role() === "parc";
    var b64 = ls.getItem(parc ? CLE_CLE_PARC : CLE_CLE);
    if (!b64) { ESPACES = []; return Promise.resolve(false); }
    var brut;
    try { brut = deBase64(b64); } catch (e) { ESPACES = []; return Promise.resolve(false); }
    var tout = function (k) { return !cleDuParc(k); };
    var toutDoc = function (d) { return !docDuParc(d); };
    var p = parc
      ? espace("parc", "parc/", brut, "synchro-parc|", cleDuParc, docDuParc, "synchro-docs-parc").then(function (e) { return [e]; })
      : cleParcDepuis(brut).then(function (bp) {
          return Promise.all([
            espace("commun", "", brut, "synchro-tec|", tout, toutDoc, "synchro-docs"),
            espace("parc", "parc/", bp, "synchro-parc|", cleDuParc, docDuParc, "synchro-docs-parc"),
          ]);
        });
    return p.then(function (L) { ESPACES = L; return true; })
      .catch(function () { ESPACES = []; return false; });
  }
  function chiffrer(E, octets) {
    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    return window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, E.cle, octets).then(function (c) {
      var out = new Uint8Array(12 + c.byteLength);
      out.set(iv); out.set(new Uint8Array(c), 12);
      return out;
    });
  }
  function dechiffrer(E, buf) {
    var t = new Uint8Array(buf);
    return window.crypto.subtle.decrypt({ name: "AES-GCM", iv: t.slice(0, 12) }, E.cle, t.slice(12));
  }

  /* LES ÉCHANGES AVEC LE WORKER. */
  function appel(E, methode, chemin, corps) {
    var o = { method: methode, headers: { "x-synchro-jeton": E.jeton }, cache: "no-store" };
    if (corps) { o.body = corps; o.headers["content-type"] = "application/octet-stream"; }
    return window.fetch("/synchro/" + E.chemin + chemin, o).then(function (r) {
      if (r.status === 404 && methode === "GET") return null;
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          var e = new Error(j.message || ("Réponse " + r.status));
          e.statut = r.status; e.code = j.erreur || "";
          throw e;
        });
      }
      return methode === "GET" ? r.arrayBuffer() : null;
    });
  }

  function lireEtat(E) {
    return appel(E, "GET", "etat").then(function (buf) {
      if (!buf) return { v: 1, cles: {}, docs: {} };
      E.taille = buf.byteLength;
      return dechiffrer(E, buf).then(function (c) {
        var e = JSON.parse(new TextDecoder().decode(c));
        e.cles = e.cles || {}; e.docs = e.docs || {};
        return e;
      });
    });
  }
  function ecrireEtat(E, etat) {
    return chiffrer(E, new TextEncoder().encode(JSON.stringify(etat))).then(function (b) {
      E.taille = b.length;
      return appel(E, "PUT", "etat", b);
    });
  }

  /* L'HEURE D'UNE DONNÉE D'ICI. Une donnée jamais partagée prend une heure de
     départ très basse : 2 sur le téléphone de T.E.C, 1 sur celui du cabinet.
     Toute modification réelle porte l'heure du jour et l'emporte donc. */
  function heureLocale(k, t) {
    if (t[k]) return t[k];
    var qui = "";
    try { qui = ls.getItem("journal-qui") || ""; } catch (e) {}
    return qui === "lea" ? 1 : (qui === "parc" ? 0.5 : 2);
  }

  function fusionnerCles(E, etat) {
    var t = lireJ(CLE_T, {});
    var sales = lireJ(CLE_SALES, {});
    var change = false, venus = [];
    var locales = {};
    for (var i = 0; i < ls.length; i++) {
      var k = ls.key(i);
      if (partageable(k) && E.garde(k)) locales[k] = 1;
    }
    Object.keys(sales).forEach(function (k) { if (partageable(k) && E.garde(k)) locales[k] = 1; });
    /* Ce qui part d'ici. */
    Object.keys(locales).forEach(function (k) {
      var hl = heureLocale(k, t);
      var s = etat.cles[k];
      var v = ls.getItem(k);
      if (!s || hl > s.t) {
        if (!s || s.v !== v) { etat.cles[k] = { v: v, t: hl }; change = true; }
        else s.t = hl;
      }
    });
    /* Ce qui vient d'ailleurs. */
    applique = true;
    try {
      Object.keys(etat.cles).forEach(function (k) {
        if (!partageable(k) || !E.garde(k)) return;
        var s = etat.cles[k];
        var hl = locales[k] ? heureLocale(k, t) : 0;
        if (s.t >= hl) {
          var v = ls.getItem(k);
          if (v !== s.v) {
            if (s.v === null || s.v === undefined) ls.removeItem(k);
            else ls.setItem(k, s.v);
            venus.push(k);
          }
          t[k] = s.t;
        }
      });
    } finally { applique = false; }
    ecrireJ(CLE_T, t);
    return { change: change, venus: venus };
  }

  /* LES DOCUMENTS. Chacun a une empreinte faite de sa rubrique, de sa sorte,
     de son nom et de sa taille : la même pièce posée sur deux appareils par le
     dossier d'origine ne part donc qu'une fois. */
  var BASE = "jurisprudence-documents", MAGASIN = "documents";
  function base() {
    return new Promise(function (ok, non) {
      if (!window.indexedDB) { non(new Error("pas d'IndexedDB")); return; }
      var d = window.indexedDB.open(BASE, 1);
      d.onupgradeneeded = function () {
        var b = d.result;
        if (!b.objectStoreNames.contains(MAGASIN)) {
          var m = b.createObjectStore(MAGASIN, { keyPath: "id", autoIncrement: true });
          m.createIndex("rubrique", "rubrique", { unique: false });
          m.createIndex("rubrique_sorte", ["rubrique", "sorte"], { unique: false });
        }
      };
      d.onsuccess = function () { ok(d.result); };
      d.onerror = function () { non(d.error); };
    });
  }
  function req(r) {
    return new Promise(function (ok, non) { r.onsuccess = function () { ok(r.result); }; r.onerror = function () { non(r.error); }; });
  }
  function tousLesDocs() {
    return base().then(function (b) {
      return req(b.transaction(MAGASIN, "readonly").objectStore(MAGASIN).getAll());
    }).catch(function () { return []; });
  }
  function uidDe(d) {
    var s = [d.rubrique, d.sorte, d.nom, d.taille].join("|");
    return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (h) {
      return hex(h).slice(0, 32);
    });
  }
  function octetsDe(contenu) {
    if (contenu == null) return Promise.resolve({ octets: new Uint8Array(0), texte: false });
    if (typeof contenu === "string") return Promise.resolve({ octets: new TextEncoder().encode(contenu), texte: true });
    if (contenu.arrayBuffer) return contenu.arrayBuffer().then(function (a) { return { octets: new Uint8Array(a), texte: false }; });
    return new Promise(function (ok) {
      var f = new FileReader();
      f.onload = function () { ok({ octets: new Uint8Array(f.result), texte: false }); };
      f.readAsArrayBuffer(contenu);
    });
  }
  function envoyerDoc(E, uid, d) {
    return octetsDe(d.contenu).then(function (o) {
      if (o.octets.length > TAILLE_MAX_DOC) {
        var e = new Error("Le document « " + d.nom + " » dépasse 24 Mo : il reste sur cet appareil.");
        e.code = "trop-gros"; throw e;
      }
      var meta = new TextEncoder().encode(JSON.stringify({ texte: o.texte }));
      var tout = new Uint8Array(4 + meta.length + o.octets.length);
      new DataView(tout.buffer).setUint32(0, meta.length);
      tout.set(meta, 4); tout.set(o.octets, 4 + meta.length);
      return chiffrer(E, tout);
    }).then(function (b) { return appel(E, "PUT", "doc/" + uid, b).then(function () { return b.length; }); });
  }
  function recevoirDoc(E, uid, info) {
    return appel(E, "GET", "doc/" + uid).then(function (buf) {
      if (!buf) return false;
      return dechiffrer(E, buf).then(function (c) {
        var t = new Uint8Array(c);
        var n = new DataView(t.buffer).getUint32(0);
        var meta = JSON.parse(new TextDecoder().decode(t.slice(4, 4 + n)));
        var corps = t.slice(4 + n);
        var contenu = meta.texte ? new TextDecoder().decode(corps) : new Blob([corps], { type: info.type || "" });
        return base().then(function (b) {
          return req(b.transaction(MAGASIN, "readwrite").objectStore(MAGASIN).add({
            rubrique: info.rubrique, sorte: info.sorte, nom: info.nom, type: info.type,
            taille: info.taille, date: info.date, note: info.note || "", contenu: contenu,
          }));
        }).then(function () { return true; });
      });
    });
  }
  function effacerLocal(id) {
    return base().then(function (b) {
      return req(b.transaction(MAGASIN, "readwrite").objectStore(MAGASIN).delete(id));
    }).catch(function () {});
  }

  function reconcilierDocs(E, etat) {
    var connus = lireJ(E.cleDocs, {});
    var change = false, recus = 0;
    return tousLesDocs().then(function (locaux) {
      return Promise.all(locaux.filter(E.gardeDoc).map(function (d) {
        return uidDe(d).then(function (u) { return { uid: u, d: d }; });
      }));
    }).then(function (L) {
      var ici = {};
      L.forEach(function (x) { ici[x.uid] = x.d; });
      var suite = Promise.resolve();
      /* Ce qui est ici. */
      Object.keys(ici).forEach(function (u) {
        var s = etat.docs[u], d = ici[u];
        if (s && s.supprime) {
          /* Retiré ailleurs : on le retire ici aussi. */
          suite = suite.then(function () { delete connus[u]; return effacerLocal(d.id); });
        } else if (!s) {
          /* Nouveau ici (ou absent de l'espace commun) : il part. */
          suite = suite.then(function () {
            return envoyerDoc(E, u, d).then(function (n) {
              etat.docs[u] = { t: Date.now(), rubrique: d.rubrique, sorte: d.sorte, nom: d.nom,
                type: d.type, taille: d.taille, date: d.date, note: d.note || "", poids: n };
              connus[u] = 1; change = true;
            });
          });
        } else {
          connus[u] = 1;
        }
      });
      /* Ce qui est ailleurs. */
      Object.keys(etat.docs).forEach(function (u) {
        var s = etat.docs[u];
        if (s.supprime || ici[u]) return;
        if (connus[u]) {
          /* Partagé, puis retiré ici : on le retire de l'espace commun. */
          suite = suite.then(function () {
            return appel(E, "DELETE", "doc/" + u).catch(function () {}).then(function () {
              etat.docs[u] = { t: Date.now(), supprime: true };
              delete connus[u]; change = true;
            });
          });
        } else {
          suite = suite.then(function () {
            return recevoirDoc(E, u, s).then(function (ok) { if (ok) { connus[u] = 1; recus++; } });
          });
        }
      });
      return suite;
    }).then(function () {
      ecrireJ(E.cleDocs, connus);
      return { change: change, recus: recus };
    });
  }

  /* LES MESSAGES À L'ÉCRAN. */
  function bandeau(texte, genre) {
    var id = "synchro-bandeau";
    var b = document.getElementById(id);
    if (!texte) { if (b) b.remove(); return; }
    if (!document.body) return;
    if (!b) {
      b = document.createElement("div");
      b.id = id;
      b.setAttribute("role", "status");
      b.style.cssText = "position:fixed;left:12px;right:12px;top:12px;z-index:9999;" +
        "padding:12px 14px;border-radius:10px;font:15px/1.4 -apple-system,BlinkMacSystemFont," +
        "'Segoe UI',Roboto,Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.18);" +
        "max-width:640px;margin:0 auto";
      var x = document.createElement("button");
      x.type = "button"; x.textContent = "Fermer";
      x.style.cssText = "float:right;margin-left:12px;border:0;background:transparent;" +
        "font:inherit;font-weight:600;color:inherit;text-decoration:underline";
      x.onclick = function () { b.remove(); };
      b.appendChild(x);
      var s = document.createElement("span"); s.className = "t"; b.appendChild(s);
      document.body.appendChild(b);
    }
    var rouge = genre === "erreur";
    b.style.background = rouge ? "#fde8eb" : "#fff6e0";
    b.style.color = rouge ? "#8c1023" : "#6b4a00";
    b.style.border = "1px solid " + (rouge ? "#f2b5bf" : "#f0d79a");
    b.querySelector(".t").textContent = texte;
  }

  function poidsDocs(etat) {
    var n = 0;
    Object.keys(etat.docs).forEach(function (u) { n += (etat.docs[u].poids || 0); });
    return n;
  }
  function surveillerPlace() {
    var total = 0;
    ESPACES.forEach(function (E) { total += (E.taille || 0) + (E.poids || 0); });
    var p = total / PLAFOND;
    if (p >= ALERTE) {
      bandeau("Espace de partage rempli à " + Math.round(p * 100) + " % (" +
        Math.round(total / 1e6) + " Mo sur 1 000). Prévenez le cabinet avant qu'il soit plein.", "alerte");
    }
  }

  function expliquer(e) {
    if (e && (e.code === "plein" || e.code === "limite")) {
      var pourquoi = e.code === "limite"
        ? "la limite d'enregistrements du jour est atteinte chez Cloudflare"
        : "l'espace de partage est plein";
      bandeau("Enregistrement en ligne refusé : " + pourquoi +
        ". Vos modifications restent sur cet appareil et repartiront plus tard. Prévenez le cabinet.", "erreur");
    } else if (e && e.code === "trop-gros") {
      bandeau(e.message, "erreur");
    } else if (e && e.statut === 403) {
      bandeau("Le partage refuse cet appareil. Prévenez le cabinet.", "erreur");
    }
    /* Une simple coupure de réseau ne s'affiche pas : tout repart plus tard. */
  }

  /* LE CYCLE : relire l'espace commun, fusionner, renvoyer ce qui a changé. */
  var enCours = null;
  function synchroniser(auChargement) {
    if (enCours) return enCours;
    enCours = preparer().then(function (pret) {
      if (!pret) return null;
      var bilan = { venus: [], recus: 0 };
      return ESPACES.reduce(function (avant, E) {
        return avant.then(function () {
          return lireEtat(E).then(function (etat) {
            var r = fusionnerCles(E, etat);
            return reconcilierDocs(E, etat).then(function (rd) {
              E.poids = poidsDocs(etat);
              bilan.venus = bilan.venus.concat(r.venus);
              bilan.recus += rd.recus;
              return (r.change || rd.change) ? ecrireEtat(E, etat) : null;
            });
          });
        });
      }, Promise.resolve()).then(function () {
        ecrireJ(CLE_SALES, {});
        surveillerPlace();
        return bilan;
      });
    }).then(function (res) {
      enCours = null;
      if (!res) return;
      /* Des données sont arrivées d'ailleurs : la page se recharge une fois pour
         les montrer, sauf si l'on est en train d'écrire. */
      if ((res.venus.length || res.recus) && auChargement) recharger();
    }).catch(function (e) {
      enCours = null;
      expliquer(e);
    });
    return enCours;
  }

  function recharger() {
    var a = document.activeElement;
    var saisie = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    var deja = 0;
    try { deja = Number(window.sessionStorage.getItem("synchro-recharge")) || 0; } catch (e) {}
    if (saisie || Date.now() - deja < 15000) {
      bandeau("Des modifications faites sur un autre appareil sont arrivées. Rechargez la page pour les voir.", "alerte");
      return;
    }
    try { window.sessionStorage.setItem("synchro-recharge", String(Date.now())); } catch (e) {}
    window.location.reload();
  }

  /* Un document déposé ou retiré part tout de suite, sans attendre la page
     suivante : la base des documents ne passe pas par le stockage local. */
  function suivreDocuments() {
    var D = window.Documents;
    if (!D || D.__synchro) return;
    ["enregistrer", "supprimer", "vider"].forEach(function (nom) {
      var f = D[nom];
      if (typeof f !== "function") return;
      D[nom] = function () {
        var r = f.apply(D, arguments);
        Promise.resolve(r).then(function () {
          window.setTimeout(function () { synchroniser(false); }, 1500);
        }, function () {});
        return r;
      };
    });
    D.__synchro = true;
  }

  function demarrer() {
    suivreDocuments();
    synchroniser(true);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) synchroniser(true);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer);
  else demarrer();

  window.Synchro = { maintenant: function () { return synchroniser(false); } };
})(window, document);
