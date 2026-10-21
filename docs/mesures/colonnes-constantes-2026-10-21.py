# -*- coding: utf-8 -*-
"""Combien de tableaux portent une colonne dont toutes les cellules sont identiques ?

Perimetre : les pages INDEXABLES de blog/ et en/blog/, derivees comme
tests/pages-indexables.js les derive (git ls-files, <html>, pas de noindex).

Une colonne est dite CONSTANTE quand, sur un tableau d'AU MOINS DEUX lignes de
corps, toutes ses cellules de corps rendent le meme texte. Un tableau d'une
seule ligne est exclu : sa colonne est constante par arithmetique, pas par
redaction.
"""
import re, subprocess, sys, html as H, os, collections

R = subprocess.run(["git", "--no-optional-locks", "rev-parse", "--show-toplevel"],
                   capture_output=True, text=True, check=True).stdout.strip()

def suivis():
    out = subprocess.run(["git","--no-optional-locks","-C",R,"ls-files","-z","*.html"],
                         capture_output=True,text=True,check=True).stdout
    return [p for p in out.split("\0") if p]

def indexable(s):
    if not re.search(r"<html\b", s, re.I): return False
    m = re.search(r'<meta name="robots" content="([^"]*)"', s, re.I)
    return not (m and re.search("noindex", m.group(1), re.I))

def txt(c):
    c = re.sub(r"<[^>]+>", " ", c)
    return re.sub(r"\s+", " ", H.unescape(c)).strip()

def lignes(tab):
    out = []
    for tr in re.findall(r"<tr\b[^>]*>(.*?)</tr>", tab, re.S | re.I):
        cells = re.findall(r"<(th|td)\b[^>]*>(.*?)</\1>", tr, re.S | re.I)
        out.append([(k.lower(), txt(v)) for k, v in cells])
    return out

pages = [p for p in suivis() if p.startswith(("blog/", "en/blog/"))]
pages = [p for p in pages if indexable(open(os.path.join(R,p),encoding="utf-8").read())]

n_tab = 0
n_eligibles = 0
constants = []
par_page = collections.Counter()
for p in sorted(pages):
    s = open(os.path.join(R,p),encoding="utf-8").read()
    for tab in re.findall(r"<table\b[^>]*>.*?</table>", s, re.S | re.I):
        n_tab += 1
        par_page[p] += 1
        rs = lignes(tab)
        corps = [r for r in rs if r and all(k == "td" for k, _ in r)]
        if len(corps) < 2:
            continue
        larg = min(len(r) for r in corps)
        if larg == 0:
            continue
        n_eligibles += 1
        entete = next((r for r in rs if any(k == "th" for k, _ in r)), None)
        for col in range(larg):
            vals = [r[col][1] for r in corps]
            if len(set(vals)) == 1:
                titre = entete[col][1] if entete and col < len(entete) else f"colonne {col+1}"
                constants.append((p, titre, vals[0], len(corps)))

print(f"pages indexables de blog/ et en/blog/ : {len(pages)}")
print(f"tableaux                              : {n_tab}")
print(f"  dont eligibles (>= 2 lignes de corps) : {n_eligibles}")
print(f"  dont au moins une colonne constante   : {len({(p,t) for p,t,_,_ in constants})} colonne(s) sur "
      f"{len({c[0] for c in constants})} page(s)")
print()
for p, titre, val, n in constants:
    print(f"  {p}")
    print(f"      colonne « {titre} » : {n} cellules, toutes « {val} »")
