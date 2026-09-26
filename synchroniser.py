#!/usr/bin/env python3
"""SYNCHRONISER CE SITE AVEC L'APPLICATION.

Ce site est une copie de l'application, plus trois choses qui n'appartiennent
qu'à lui : la porte (entrer.html, entrer.js), le dossier chiffré du client
(dossier-tec.js) et le verrou (verrou.js). Quand on rafraîchit les pages
depuis le dépôt de l'application, ces trois-là ne doivent pas disparaître, et
les lignes qui appellent le verrou et sans-cache.js sautent : une page
recopiée s'ouvre alors sans mot de passe.

Ce script fait la copie, remet les lignes, puis repose le nom et le logo du
client sur les manifestes et les pages. À lancer après chaque mise à jour de
l'application :

    python3 synchroniser.py ../JURISPRUDENCE/docs

Sans argument, il ne copie rien et se contente de remettre les lignes et la
marque sur les pages déjà là.

Ce qui n'est jamais copié : sw.js. Le service worker rendait à une navigation
la redirection 307 de l'hébergeur et la page s'ouvrait sur ERR_FAILED ; c'est
sans-cache.js qui désinscrit celui qui traîne encore sur un appareil.
"""

import json
import pathlib
import re
import shutil
import sys

PORTE = "entrer.html"
JAMAIS = {"sw.js"}
PROPRES = {"entrer.html", "entrer.js", "dossier-tec.js", "verrou.js",
           "sans-cache.js", "sw-min.js", "synchroniser.py", "README.md",
           "netlify.toml", "wrangler.toml", ".assetsignore", "favicon.ico"}

# L'IDENTITÉ DU CLIENT, ET NON CELLE DE L'APPLICATION.
#
# Installée, l'application posait sur le bureau et sur le téléphone le nom et
# le logo de « Jurisprudence » : c'est le site de T.E.C, pas le nôtre. Relevé
# par l'utilisatrice le 25 septembre 2026. Le logo vient de son papier à
# en-tête ; l'icône n'en garde que les rubans rouges, le mot TRANSPORTS ne se
# lisant plus à cette taille.
#
# Les manifestes et les liens d'icônes sont recopiés depuis l'application à
# chaque synchronisation : ils sont donc réécrits ici, après la copie, plutôt
# que tenus à la main.
MARQUE = {
    "name": "T.E.C Transports",
    "short_name": "T.E.C",
    "description": "Les documents, les contrôles et les échéances de T.E.C Transports.",
    "theme_color": "#e4324a",
    "background_color": "#ffffff",
    "icons": [
        {"src": "icons-tec/icon-192.png", "sizes": "192x192", "type": "image/png",
         "purpose": "any"},
        {"src": "icons-tec/icon-512.png", "sizes": "512x512", "type": "image/png",
         "purpose": "any"},
        {"src": "icons-tec/icon-512-masque.png", "sizes": "512x512", "type": "image/png",
         "purpose": "maskable"},
    ],
}
# Les pages n'écrivent pas toutes leur lien d'icône de la même façon : l'une
# glisse un type entre le rel et le href. On vise donc le chemin, dans
# n'importe quelle balise « link » qui porte un rel d'icône.
LIEN_ICONE = re.compile(r'(<link [^>]*rel="(?:apple-touch-)?icon"[^>]*href=")icons/[^"]+(")')

# L'EN-TÊTE PORTE LE NOM DU CLIENT, PAS CELUI DE L'APPLICATION.
#
# « L'en-tête dit Jurisprudence relations collectives et non SARL TEC » :
# relevé le 26 septembre 2026. C'est le site de T.E.C : sur son accueil et sur
# sa page de recherche, la marque est la sienne. Les autres pages portent le
# nom de ce qu'elles font, « Agenda social », « Registre du personnel », et
# cela reste juste.
MARQUE_HAUT = [
    (re.compile(r'(<p class="marque">)Jurisprudence <span>relations collectives</span>(</p>)'),
     r'\1T.E.C <span>Transports</span>\2'),
    (re.compile(r'(<p class="marque">)Jurisprudence et textes(</p>)'),
     r'\1T.E.C, jurisprudence et textes\2'),
]

LIGNES = [
    # (ligne à poser, repère après lequel l'insérer, pages à épargner)
    ('<script src="verrou.js"></script>', '<meta name="viewport"', {PORTE}),
    ('<script src="sans-cache.js"></script>', '<meta name="viewport"', set()),
]

ici = pathlib.Path(__file__).resolve().parent


def copier(source):
    src = pathlib.Path(source).resolve()
    if not src.is_dir():
        print("source introuvable :", src)
        sys.exit(1)
    n = 0
    for f in sorted(src.iterdir()):
        if f.is_dir():
            shutil.copytree(f, ici / f.name, dirs_exist_ok=True)
            continue
        if f.name in JAMAIS or f.name in PROPRES:
            continue
        shutil.copy2(f, ici / f.name)
        n += 1
    for mort in JAMAIS:
        p = ici / mort
        if p.exists():
            p.unlink()
            print("retiré :", mort)
    print("copiés :", n, "fichiers depuis", src)


def poser():
    total, sans = 0, []
    for f in sorted(ici.glob("*.html")):
        t = f.read_text(encoding="utf-8")
        avant = t
        for ligne, repere, epargnees in LIGNES:
            if f.name in epargnees or ligne in t:
                continue
            i = t.find(repere)
            if i < 0:
                sans.append(f.name)
                continue
            fin = t.find(">", i)
            if fin < 0:
                sans.append(f.name)
                continue
            t = t[:fin + 1] + "\n" + ligne + t[fin + 1:]
            total += 1
        if t != avant:
            f.write_text(t, encoding="utf-8")
    print("lignes posées :", total)
    if sans:
        print("SANS REPÈRE, à regarder à la main :", ", ".join(sorted(set(sans))))
        sys.exit(1)


def marquer():
    """Le nom et le logo du client, sur les manifestes et dans les pages."""
    m = 0
    for f in sorted(ici.glob("manifest*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        for c, v in MARQUE.items():
            d[c] = v
        f.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        m += 1
    liens = 0
    for f in sorted(ici.glob("*.html")):
        t = f.read_text(encoding="utf-8")
        neuf, n = LIEN_ICONE.subn(r"\1icons-tec/icon-180.png\2", t)
        for motif, par in MARQUE_HAUT:
            neuf, k = motif.subn(par, neuf)
            n += k
        if n:
            f.write_text(neuf, encoding="utf-8")
            liens += n
    print("manifestes au nom de", MARQUE["short_name"], ":", m, "| liens d'icône :", liens)


if len(sys.argv) > 1:
    copier(sys.argv[1])
poser()
marquer()
