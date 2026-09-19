"""Genere le catalogue du releve PrestaShop natif du 19 septembre 2026.

Sans argument : catalogue.json, 86 fiches, celles que ce dossier peut publier.

    B-site    10  exemple-catalogue.csv du site (heurix-site 8932aaf6).
    C-genere  64  corpus genere du banc rag_catalogue (article sur le
                  decoupage RAG du 16 septembre 2026).
    D-ecrit   12  ecrites pour le releve (rondelles DIN, ecrous, roulements).

Avec le chemin de la copie racetools en argument : catalogue-177.json, les 177
fiches de l'article, dans le meme ordre.

    A-reel    91  racetools.fr, collection cheville-vis, telechargee le
                  1er aout 2026, sha256 6972cf0101a53fe5ea7fd5a7c2dd4689e27c8dd2d31cafe836ad5595a014b145.
                  Non publiee ici : ce sont des textes de Fischer et de Racetools.
                  La collection rend 0 produit depuis.

    python3 catalogue.py
    python3 catalogue.py <copie-racetools.json>

Relancer ce script doit reecrire catalogue.json a l'identique.
"""
import csv
import html
import json
import re
import sys
from pathlib import Path

ICI = Path(__file__).parent


def texte(h):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h or ""))).strip()


fiches = []
if len(sys.argv) > 1:
    for p in json.load(open(sys.argv[1]))["products"]:
        sku = next((v.get("sku") for v in p["variants"] if v.get("sku")), "") or ""
        fiches.append(dict(src="A-reel", id=f"A{p['id']}", name=p["title"].strip(), ref=sku[:64],
                           desc=texte(p["body_html"])[:3000], brand=p.get("vendor") or "",
                           price=float(p["variants"][0]["price"] or 0)))
for r in csv.DictReader(open(ICI / "sources/heurix-site-exemple-catalogue.csv"), delimiter=";"):
    fiches.append(dict(src="B-site", id=r["id"], name=r["nom"], ref=r["reference"], desc="",
                       brand=r["marque"], price=float(r["prix"])))
for r in json.load(open(ICI / "sources/rag-catalogue-corpus.json")):
    fiches.append(dict(src="C-genere", id=r["id"], name=r["name"], ref=r["ref"], desc=r["description"],
                       brand="", price=r["price"]))
ECRITES = [
    ("ROND-125-M10-A2", "Rondelle plate M10 DIN 125 inox A2", "Rondelle plate série moyenne, inox A2, sachet de 100."),
    ("ROND-127-M8-Z", "Rondelle Grower M8 DIN 127 acier zingué", "Rondelle élastique fendue, acier zingué, sachet de 200."),
    ("ROND-9021-M6-A4", "Rondelle large M6 DIN 9021 inox A4", "Rondelle extra-large, inox A4 marine, sachet de 100."),
    ("ECR-934-M10-Z", "Écrou hexagonal M10 DIN 934 acier zingué classe 8", "Écrou hexagonal ordinaire, sachet de 100."),
    ("ECR-985-M8-A2", "Écrou frein nylstop M8 DIN 985 inox A2", "Écrou autofreiné à bague nylon, sachet de 100."),
    ("VIS-933-M8-40-Z", "Vis tête hexagonale M8-40 DIN 933 acier zingué 8.8", "Vis entièrement filetée, boîte de 100."),
    ("VIS-912-M8-25-A2", "Vis CHC M8 x 25 DIN 912 inox A2", "Vis à tête cylindrique six pans creux, boîte de 100."),
    ("TIGE-975-M8-1M", "Tige filetée M8 longueur 1 m DIN 975 acier zingué", "Tige filetée au mètre."),
    ("ROUL-6205-2RS", "Roulement à billes 6205-2RS 25x52x15 mm", "Roulement rigide à une rangée de billes, deux joints caoutchouc."),
    ("ROUL-6205-ZZ", "Roulement à billes 6205-ZZ 25x52x15 mm", "Roulement rigide à une rangée de billes, deux flasques métalliques."),
    ("ROUL-6204-2RS", "Roulement à billes 6204-2RS 20x47x14 mm", "Roulement rigide à une rangée de billes, deux joints caoutchouc."),
    ("ROUL-6305-2RS", "Roulement à billes 6305-2RS 25x62x17 mm", "Roulement rigide à une rangée de billes, série lourde."),
]
for i, n, d in ECRITES:
    fiches.append(dict(src="D-ecrit", id=i, name=n, ref=i, desc=d, brand="", price=1.0))
sortie = "catalogue-177.json" if len(sys.argv) > 1 else "catalogue.json"
json.dump(fiches, open(ICI / sortie, "w"), ensure_ascii=False, indent=0)
