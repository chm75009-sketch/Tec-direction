#!/usr/bin/env python3
"""POSER LE VERROU SUR TOUTES LES PAGES.

Les pages de ce site sont une copie de l'application. Quand on les rafraîchit
depuis le dépôt d'origine, la ligne qui appelle le verrou saute, et le site
s'ouvre de nouveau sans mot de passe. Ce script la remet partout.

À lancer après chaque copie de pages venues de l'application :

    python3 poser-verrou.py

Il ne touche pas entrer.html, qui est la porte elle-même, et ne fait rien sur
une page qui porte déjà la ligne.
"""

import pathlib
import sys

PORTE = "entrer.html"
LIGNE = '<script src="verrou.js"></script>'
REPERE = '<meta name="viewport"'

ici = pathlib.Path(__file__).resolve().parent

pose, deja, sans = [], [], []

for f in sorted(ici.glob("*.html")):
    if f.name == PORTE:
        continue
    t = f.read_text(encoding="utf-8")
    if LIGNE in t:
        deja.append(f.name)
        continue
    i = t.find(REPERE)
    if i < 0:
        sans.append(f.name)
        continue
    fin = t.find(">", i)
    if fin < 0:
        sans.append(f.name)
        continue
    f.write_text(t[:fin + 1] + "\n" + LIGNE + t[fin + 1:], encoding="utf-8")
    pose.append(f.name)

print("posé sur %d page(s), déjà en place sur %d" % (len(pose), len(deja)))
for n in pose:
    print("  +", n)
if sans:
    print("SANS REPÈRE, à regarder à la main :")
    for n in sans:
        print("  !", n)
    sys.exit(1)
