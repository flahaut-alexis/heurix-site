#!/usr/bin/env python3
"""Regenere les listes HEURIX_SEARCH_LATEST_PATHS de search.js et search-en.js.

CE QUE CE SCRIPT CORRIGE (26 aout 2026). Les deux listes etaient ecrites a la
main. Introduites le 6 aout (2a573cb6) avec 7 entrees en FR et 3 en EN, elles
n'avaient plus bouge -- vingt jours et une douzaine d'articles plus tard, la
modale de recherche annoncait « Latest articles » en proposant les articles
classes 23e, 27e et 29e sur 30. C'est le troisieme cas du meme jour : les six
assets enumeres de la CI, l'index de recherche, celle-ci.

POURQUOI LA DATE GIT ET NON L'ORDRE DE blog.html. blog.html paraissait
chronologique ; il ne l'est pas. Son premier article date du 1er aout quand
les trois suivants datent du 24, et sa position 11 est plus recente que les
positions 7 a 10. Son ordre est editorial. Aucun article ne porte de
datePublished, et la date affichee n'a qu'une granularite au mois : le seul
signal precis disponible est la date du commit qui a ajoute le fichier.

USAGE :
  scripts/derniers-articles.py            # ecrit
  scripts/derniers-articles.py --verifier # n'ecrit pas, sort 1 si perime
"""
import re, subprocess, sys, glob, os

N = 5
# glob rend deja le chemin relatif a la racine du depot, qui EST la forme
# utilisee par les deux index ("blog/x.html" et "en/blog/x.html").
PAIRES = [("search.js", "blog"), ("search-en.js", "en/blog")]
RACINE = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                        capture_output=True, text=True).stdout.strip()
os.chdir(RACINE)


def date_ajout(chemin):
    """Date du commit qui a AJOUTE le fichier -- pas sa derniere modification :
    corriger une coquille ne republie pas un article."""
    out = subprocess.run(["git", "log", "--diff-filter=A", "--format=%at", "--", chemin],
                         capture_output=True, text=True).stdout.strip().split("\n")
    return int(out[-1]) if out and out[-1] else 0


def liste(dossier):
    arts = sorted(glob.glob(f"{dossier}/*.html"))
    dates = sorted(((date_ajout(p), p) for p in arts), reverse=True)
    return [p for _, p in dates[:N]]


echec = 0
verif = "--verifier" in sys.argv
for js, dossier in PAIRES:
    src = open(js).read()
    m = re.search(r'(window\.HEURIX_SEARCH_LATEST_PATHS\s*=\s*\[)(.*?)(\];)', src, re.S)
    if not m:
        print(f"  {js} : tableau introuvable", file=sys.stderr); sys.exit(2)

    voulu = liste(dossier)

    # Un chemin absent de l'index est filtre EN SILENCE par search-engine.js
    # (.map vers INDEX puis .filter(Boolean)) : la suggestion disparait sans
    # qu'aucune erreur ne le dise. On le refuse ici plutot que de le laisser
    # se perdre a l'affichage.
    indexes = set(re.findall(r'path:\s*"([^"]+)"', src))
    absents = [p for p in voulu if p not in indexes]
    if absents:
        print(f"  {js} : ABSENT DE L'INDEX, serait filtre en silence -> {absents}", file=sys.stderr)
        echec = 1
        continue

    corps = "\n" + "".join(f'  "{p}"{"," if i < len(voulu)-1 else ""}\n' for i, p in enumerate(voulu))
    actuel = m.group(2)
    if actuel == corps:
        print(f"  {js} : deja a jour ({len(voulu)} entrees)")
        continue
    if verif:
        anciens = re.findall(r'"([^"]+)"', actuel)
        print(f"  {js} : PERIME", file=sys.stderr)
        print(f"     actuel ({len(anciens)}) : {anciens}", file=sys.stderr)
        print(f"     attendu ({len(voulu)}) : {voulu}", file=sys.stderr)
        echec = 1
        continue
    open(js, "w").write(src[:m.start(2)] + corps + src[m.end(2):])
    print(f"  {js} : {len(voulu)} entrees ecrites")

if echec:
    print("\nListes perimees. Lancez scripts/derniers-articles.py, puis"
          "\nscripts/bust-cache.sh sur les fichiers modifies.", file=sys.stderr)
sys.exit(echec)
