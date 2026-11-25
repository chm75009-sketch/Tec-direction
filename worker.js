/* LE WORKER DU SITE TEC. (v3, avec le partage : voir plus bas, /synchro)

   Les fichiers du site sont servis tels quels par la liaison ASSETS : pour
   toutes les pages, rien ne change. Ce Worker n'ajoute qu'une seule porte,
   /journal, qui tient le registre des ouvertures du dossier.

   POST /journal (corps JSON {qui}) : la page d'entrée y dépose, à chaque
      ouverture réussie, qui a ouvert (tec ou lea) et quand. C'est au mieux :
      si le dépôt échoue, l'ouverture du dossier n'en souffre pas.

   GET /journal : affiche un champ de mot de passe.

   POST /journal (formulaire, champ mot) : si le mot de passe de l'avocate est
      bon, affiche le registre. Le controle se fait ici, en rejouant le
      déverrouillage de la petite clé du dossier, celle qui est déjà publique
      dans dossier-tec.js. Aucun secret n'est donc écrit dans ce fichier.

   Le registre vit dans l'espace KV lié sous le nom JOURNAL. Tant qu'il n'est
   pas lié, la porte répond sans rien enregistrer, et le site tourne comme
   avant.                                                                     */

/* Le mot de passe qui ouvre le journal est gardé en secret sur le Worker,
   sous le nom JOURNAL_MOT, posé dans le tableau de bord Cloudflare. Il n'est
   donc pas dans ce fichier (le dépôt est public), et la vérification est une
   simple comparaison, sans calcul lourd : le Worker a un temps de calcul
   serré, et une dérivation à six cent mille tours le dépassait, ce qui
   refusait meme le bon mot de passe. */
function egal(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function motValide(mot, env) {
  if (!mot || !env || !env.JOURNAL_MOT) return false;
  return egal(String(mot), String(env.JOURNAL_MOT));
}

function texte(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

async function deposer(request, env) {
  /* On n'accepte le dépôt que depuis le site lui-meme. */
  const origine = request.headers.get("Origin") || "";
  const hote = new URL(request.url).host;
  if (origine && new URL(origine).host !== hote) {
    return new Response("", { status: 204 });
  }
  if (!env.JOURNAL) return new Response("", { status: 204 });
  let qui = "?", page = "";
  try {
    const d = await request.json();
    if (d && d.qui) qui = String(d.qui);
    if (d && d.page) page = String(d.page).slice(0, 60).replace(/[^a-z0-9_-]/gi, "");
  } catch (e) {}
  qui = (qui === "tec" || qui === "lea") ? qui : "?";
  const quand = new Date().toISOString();
  const pays = (request.cf && request.cf.country) || "";
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ua = request.headers.get("User-Agent") || "";
  const cle = "log:" + quand + ":" + Math.random().toString(36).slice(2, 8);
  try {
    await env.JOURNAL.put(cle, JSON.stringify({ qui, quand, pays, ip, ua, page }),
      { metadata: { qui, quand, pays, page } });
  } catch (e) {}
  return new Response("", { status: 204 });
}

const NOMS = { tec: "TEC (direction)", lea: "Léa", "?": "inconnu" };

/* Le nom lisible d'une page. Les plus courantes ont leur libellé ; les autres
   sont rendues telles quelles, les traits d'union devenant des espaces. */
const PAGES = {
  index: "Accueil", gerer: "Gérer", auditer: "Audit (catalogue)", audit: "Audit",
  documents: "Documents produits", "mes-documents": "Mes documents",
  questions: "Mes 5 questions à poser", agenda: "Agenda social", registre: "Registre du personnel",
  flotte: "Flotte", "conformite-transport": "Tachygraphe et cartes conducteurs",
  "controle-urssaf": "Contrôle URSSAF", "contrats-transport": "Contrats transport",
  forfait: "Forfait en jours", heures: "Heures", visites: "Visites médicales",
  equipe: "Comité social et économique", recherche: "Recherche", parcours: "Parcours",
  "notes-service": "Notes de service", contraventions: "Contraventions",
  sanctions: "Sanctions", courriers: "Courriers", bdese: "BDESE", duerp: "DUERP",
  egalite: "Égalité professionnelle", minima: "Minima conventionnels",
};
function joliPage(p) {
  if (!p) return "";
  if (PAGES[p]) return PAGES[p];
  const s = String(p).replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function cadre(corps) {
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Journal des accès - SARL TEC</title><style>' +
    ':root{color-scheme:light}' +
    'body{margin:0;background:#f5f5f6;color:#1a1a1a;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
    'padding:24px 16px}' +
    '.boite{max-width:760px;margin:0 auto;background:#fff;border:1px solid #e3e3e6;' +
    'border-radius:12px;padding:20px 18px}' +
    'h1{font-size:19px;margin:0 0 4px;color:#e4324a}' +
    'p.sous{margin:0 0 18px;color:#666;font-size:14px}' +
    'label{display:block;font-size:14px;margin:0 0 6px}' +
    'input[type=password]{width:100%;box-sizing:border-box;padding:12px;font-size:16px;' +
    'border:1px solid #ccc;border-radius:8px}' +
    'button{margin-top:12px;width:100%;padding:12px;font-size:16px;border:0;border-radius:8px;' +
    'background:#e4324a;color:#fff;font-weight:600}' +
    '.err{color:#c01933;font-size:14px;margin:10px 0 0}' +
    'table{width:100%;border-collapse:collapse;font-size:14px}' +
    'th,td{text-align:left;padding:9px 8px;border-bottom:1px solid #ececef;vertical-align:top}' +
    'th{color:#666;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em}' +
    'td.qui{font-weight:600}' +
    '.vide{color:#777;padding:14px 0}' +
    'a.retour{display:inline-block;margin-top:18px;color:#e4324a;' +
    'text-decoration:none;font-size:15px;font-weight:600}' +
    /* LE RETOUR EST EN HAUT, ET IL RESTE À L'ÉCRAN.

       Relevé le 21 novembre 2026 : le seul lien de retour était au pied de la
       page, sous plus de deux cents lignes. Dans l'application installée, sans
       barre de navigateur, on restait coincé sur le journal et il fallait
       quitter l'application. Le bouton est donc posé au-dessus du titre, et
       il suit le défilement. Celui du bas est gardé. */
    '.haut{position:sticky;top:0;z-index:2;background:#f5f5f6;margin:-24px -16px 14px;padding:12px 16px}' +
    '.haut a{display:block;max-width:760px;margin:0 auto;box-sizing:border-box;padding:13px 16px;' +
    'background:#fff;border:1px solid #d5d5da;border-radius:10px;color:#1a1a1a;' +
    'text-decoration:none;font-size:16px;font-weight:600}' +
    '</style></head><body>' +
    '<div class="haut"><a href="/">&larr; Retour à l\'application</a></div>' +
    '<div class="boite">' + corps +
    '<a class="retour" href="/">&larr; Retour à l\'application</a>' +
    '</div></body></html>';
}

function pageMot(erreur) {
  return cadre(
    '<h1>Journal des accès</h1>' +
    '<p class="sous">Les ouvertures du dossier TEC. Tapez votre mot de passe pour voir la liste.</p>' +
    '<form method="post" action="/journal">' +
    '<label for="mot">Mot de passe</label>' +
    '<input type="password" id="mot" name="mot" autofocus autocomplete="off">' +
    '<button type="submit">Voir le journal</button>' +
    (erreur ? '<p class="err">' + texte(erreur) + '</p>' : '') +
    '</form>');
}

/* L'heure est montrée à l'heure de la France (Europe/Paris), qui suit seule
   l'heure d'été et l'heure d'hiver : l'horodatage est gardé en UTC, mais
   affiché dans le fuseau de la France. */
function dateLisible(iso) {
  try {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(d);
    const g = function (t) { var x = parts.find(function (p) { return p.type === t; }); return x ? x.value : ""; };
    return g("day") + "/" + g("month") + "/" + g("year") + " à " + g("hour") + "h" + g("minute");
  } catch (e) { return iso; }
}

async function pageJournal(env) {
  if (!env.JOURNAL) {
    return cadre('<h1>Journal des accès</h1><p class="vide">Le registre n\'est pas encore configuré.</p>');
  }
  const liste = await env.JOURNAL.list({ prefix: "log:", limit: 1000 });
  const lignes = liste.keys.map(function (k) { return k.metadata || {}; })
    .filter(function (m) { return m.quand; })
    .sort(function (a, b) { return a.quand < b.quand ? 1 : -1; });
  const ouvertures = lignes.filter(function (m) { return !m.page; }).length;
  const vues = lignes.length - ouvertures;
  let corps = '<h1>Journal des accès</h1><p class="sous">' + ouvertures +
    ' ouverture' + (ouvertures > 1 ? 's' : '') + ' du dossier, ' + vues +
    ' page' + (vues > 1 ? 's' : '') + ' consultée' + (vues > 1 ? 's' : '') + '.</p>';
  if (!lignes.length) {
    corps += '<p class="vide">Rien d\'enregistré pour l\'instant.</p>';
  } else {
    corps += '<table><thead><tr><th>Qui</th><th>Quand</th><th>Quoi</th><th>Pays</th></tr></thead><tbody>';
    corps += lignes.map(function (m) {
      const quoi = m.page ? joliPage(m.page) : "Ouverture du dossier";
      return '<tr><td class="qui">' + texte(NOMS[m.qui] || m.qui || "inconnu") +
        '</td><td>' + texte(dateLisible(m.quand)) +
        '</td><td>' + texte(quoi) +
        '</td><td>' + texte(m.pays || "") + '</td></tr>';
    }).join("");
    corps += '</tbody></table>';
  }
  return cadre(corps);
}

const HTML = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };

async function journal(request, env) {
  if (request.method === "POST") {
    const ct = request.headers.get("content-type") || "";
    if (ct.indexOf("application/json") >= 0) {
      return deposer(request, env);
    }
    /* Sinon c'est l'envoi du formulaire de lecture. */
    let mot = "";
    try { const f = await request.formData(); mot = f.get("mot") || ""; } catch (e) {}
    if (!env || !env.JOURNAL_MOT) {
      return new Response(pageMot("Le journal n'est pas encore configuré."), { status: 503, headers: HTML });
    }
    if (motValide(mot, env)) {
      return new Response(await pageJournal(env), { headers: HTML });
    }
    return new Response(pageMot("Ce mot de passe n'ouvre pas le journal."), { status: 401, headers: HTML });
  }
  return new Response(pageMot(""), { headers: HTML });
}

/* LE PARTAGE ENTRE LE CABINET ET T.E.C. (ajouté le 24 novembre 2026)

   synchro.js, sur chaque page, envoie ici les données de l'application et les
   documents, chiffrés sur l'appareil avec la clé du dossier. Ce Worker ne fait
   que les garder : il ne peut pas les lire.

   GET|PUT /synchro/etat          l'état commun (toutes les données, un bloc)
   GET|PUT|DELETE /synchro/doc/X  un document

   L'accès. Chaque appel porte un jeton tiré de la clé du dossier : seul un
   appareil qui a ouvert le dossier avec le mot de passe peut le calculer. Le
   premier jeton reçu est retenu (son empreinte seule est gardée, sous
   synchro:empreinte) ; tout autre est ensuite refusé. Le dépôt étant public,
   aucun secret n'est écrit dans ce fichier.

   Les refus de Cloudflare (espace plein, limite d'enregistrements du jour)
   sont rendus avec un message clair, que synchro.js affiche à l'écran.     */

const JSONH = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function erreurSynchro(statut, code, message) {
  return new Response(JSON.stringify({ erreur: code, message: message }), { status: statut, headers: JSONH });
}

async function empreinte(texte) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(h)).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
}

function refusCloudflare(e) {
  const m = String((e && e.message) || e || "");
  if (/limit|quota|exceed|429/i.test(m)) {
    return erreurSynchro(507, "limite", "limite d'enregistrements du jour atteinte chez Cloudflare (" + m.slice(0, 120) + ")");
  }
  if (/too large|size|storage/i.test(m)) {
    return erreurSynchro(507, "plein", "espace de partage plein ou fichier trop lourd (" + m.slice(0, 120) + ")");
  }
  return erreurSynchro(502, "kv", "enregistrement impossible (" + m.slice(0, 120) + ")");
}

async function synchro(request, env, chemin) {
  if (!env.JOURNAL) return erreurSynchro(503, "absent", "l'espace de partage n'est pas configuré");
  const origine = request.headers.get("Origin") || "";
  const hote = new URL(request.url).host;
  if (origine && new URL(origine).host !== hote) return erreurSynchro(403, "origine", "origine refusée");

  /* Deux espaces : le commun, et celui du parc (/synchro/parc/...), que le
     chef de parc partage avec T.E.C et le cabinet. Chacun a son jeton. */
  let prefixe = "synchro:", garde_cle = "synchro:empreinte";
  if (chemin.indexOf("parc/") === 0) {
    chemin = chemin.slice(5);
    prefixe = "synchro:parc:";
    garde_cle = "synchro:empreinte-parc";
  }

  const jeton = request.headers.get("x-synchro-jeton") || "";
  if (!/^[0-9a-f]{64}$/.test(jeton)) return erreurSynchro(403, "jeton", "accès refusé");
  const recu = await empreinte(jeton);
  let garde = null;
  try { garde = await env.JOURNAL.get(garde_cle); } catch (e) { return refusCloudflare(e); }
  if (!garde) {
    try { await env.JOURNAL.put(garde_cle, recu); } catch (e) { return refusCloudflare(e); }
  } else if (!egal(garde, recu)) {
    return erreurSynchro(403, "jeton", "accès refusé");
  }

  let cle;
  if (chemin === "etat") cle = prefixe + "etat";
  else {
    const m = /^doc\/([0-9a-f]{32})$/.exec(chemin);
    if (!m) return erreurSynchro(404, "chemin", "adresse inconnue");
    cle = prefixe + "doc:" + m[1];
  }

  const methode = request.method;
  try {
    if (methode === "GET") {
      const v = await env.JOURNAL.get(cle, { type: "arrayBuffer" });
      if (!v) return new Response(null, { status: 404, headers: { "cache-control": "no-store" } });
      return new Response(v, { headers: { "content-type": "application/octet-stream", "cache-control": "no-store" } });
    }
    if (methode === "PUT") {
      const corps = await request.arrayBuffer();
      if (corps.byteLength > 25 * 1024 * 1024) return erreurSynchro(413, "plein", "fichier trop lourd pour l'espace de partage (25 Mo au plus)");
      await env.JOURNAL.put(cle, corps, { metadata: { taille: corps.byteLength, quand: new Date().toISOString() } });
      return new Response(null, { status: 204 });
    }
    if (methode === "DELETE" && !/etat$/.test(cle)) {
      await env.JOURNAL.delete(cle);
      return new Response(null, { status: 204 });
    }
  } catch (e) {
    return refusCloudflare(e);
  }
  return erreurSynchro(405, "methode", "méthode refusée");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/journal") return journal(request, env);
    if (url.pathname.indexOf("/synchro/") === 0) return synchro(request, env, url.pathname.slice(9));
    return env.ASSETS.fetch(request);
  },
};
