#!/usr/bin/env python3
"""SYNCHRONISER CE SITE AVEC L'APPLICATION.

Ce site est une copie de l'application, plus trois choses qui n'appartiennent
qu'à lui : la porte (entrer.html, entrer.js), le dossier chiffré du client
(dossier-tec.js) et le verrou (verrou.js). Quand on rafraîchit les pages
depuis le dépôt de l'application, ces trois-là ne doivent pas disparaître, et
les lignes qui appellent le verrou et sans-cache.js sautent : une page
recopiée s'ouvre alors sans mot de passe.

Ce script fait la copie et remet les lignes. À lancer après chaque mise à
jour de l'application :

    python3 synchroniser.py ../JURISPRUDENCE/docs

Sans argument, il ne copie rien et se contente de remettre les lignes sur les
pages déjà là.

Ce qui n'est jamais copié : sw.js. Le service worker rendait à une navigation
la redirection 307 de l'hébergeur et la page s'ouvrait sur ERR_FAILED ; c'est
sans-cache.js qui désinscrit celui qui traîne encore sur un appareil.
"""

import pathlib
import shutil
import sys

PORTE = "entrer.html"
JAMAIS = {"sw.js"}
PROPRES = {"entrer.html", "entrer.js", "dossier-tec.js", "verrou.js",
           "sans-cache.js", "sw-min.js", "synchroniser.py", "README.md",
           "netlify.toml", "wrangler.toml", ".assetsignore"}

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


if len(sys.argv) > 1:
    copier(sys.argv[1])
poser()
