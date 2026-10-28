/* LE WORKER DU SITE TEC. (v2)

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
  let qui = "?";
  try { const d = await request.json(); if (d && d.qui) qui = String(d.qui); } catch (e) {}
  qui = (qui === "tec" || qui === "lea") ? qui : "?";
  const quand = new Date().toISOString();
  const pays = (request.cf && request.cf.country) || "";
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ua = request.headers.get("User-Agent") || "";
  const cle = "log:" + quand + ":" + Math.random().toString(36).slice(2, 8);
  try {
    await env.JOURNAL.put(cle, JSON.stringify({ qui, quand, pays, ip, ua }),
      { metadata: { qui, quand, pays } });
  } catch (e) {}
  return new Response("", { status: 204 });
}

const NOMS = { tec: "TEC (direction)", lea: "Léa", "?": "inconnu" };

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
    '</style></head><body><div class="boite">' + corps + '</div></body></html>';
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
  let corps = '<h1>Journal des accès</h1><p class="sous">' + lignes.length +
    ' ouverture' + (lignes.length > 1 ? 's' : '') + ' du dossier.</p>';
  if (!lignes.length) {
    corps += '<p class="vide">Aucune ouverture enregistrée pour l\'instant.</p>';
  } else {
    corps += '<table><thead><tr><th>Qui</th><th>Quand</th><th>Pays</th></tr></thead><tbody>';
    corps += lignes.map(function (m) {
      return '<tr><td class="qui">' + texte(NOMS[m.qui] || m.qui || "inconnu") +
        '</td><td>' + texte(dateLisible(m.quand)) +
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/journal") return journal(request, env);
    return env.ASSETS.fetch(request);
  },
};
