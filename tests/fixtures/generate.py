#!/usr/bin/env python3
"""Genere les fixtures de test a partir du VRAI moteur Heurix.

Raison d'etre (chantier P7, apres le bug des facettes) : des tests qui
inventent eux-memes la forme des reponses de l'API ne prouvent rien sur
la compatibilite reelle. Le widget envoyait "DIAM:DIAM_M8" alors que le
moteur attend "DIAM_M8" -- les tests passaient au vert malgre tout,
parce que le mock acceptait n'importe quoi.

Ce script fait tourner le moteur pour de vrai, capture ses reponses
exactes, et enregistre surtout QUELS FORMATS DE REQUETE IL ACCEPTE.
Les tests JS s'appuient ensuite sur ces fixtures : si le contrat de
l'API change, on regenere (`npm run fixtures`) et les tests qui ne
collent plus echouent -- ce qui est exactement le signal recherche.

Usage : python3 tests/fixtures/generate.py
"""
import json
import os
import sys
import tempfile

ENGINE = os.path.expanduser("~/heurix-engine")
if not os.path.isdir(ENGINE):
    ENGINE = "/home/claude/heurix-engine"
sys.path.insert(0, ENGINE)

from heurix.index import Store  # noqa: E402
from heurix.rules import load_rulepacks  # noqa: E402
from heurix.search import search  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

PRODUITS = [
    {"id": "V001", "name": "Vis à métaux tête hexagonale", "ref": "M8 x 20 - Inox A2",
     "stock": 120, "price": 5.90, "categories": ["visserie"], "brand": "Facom"},
    {"id": "V002", "name": "Vis à métaux tête hexagonale", "ref": "M8 x 30 - Inox A2",
     "stock": 0, "price": 7.90, "categories": ["visserie"], "brand": "Facom"},
    {"id": "E001", "name": "Écrou hexagonal", "ref": "M8 - Zingué",
     "stock": 300, "price": 0.40, "categories": ["visserie"], "brand": "Legallais"},
]


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        rulepacks = load_rulepacks(os.path.join(ENGINE, "rulepacks"))
        store = Store(os.path.join(tmp, "fixtures.db"), rulepacks)
        catalog = store.get_or_create("fixtures", rulepack_name="outillage")
        store.upsert_products(catalog, PRODUITS)

        fixtures = {}

        # --- Reponse de recherche nominale, avec facettes -------------------
        avec_facettes = search(catalog, "vis", facets=["DIAM"])
        fixtures["search_avec_facettes"] = avec_facettes

        # --- LE contrat qui a manque au widget -----------------------------
        # On determine empiriquement quel format de filtre le moteur accepte,
        # au lieu de le supposer. `groupe_facette` est la CLE du dict facets,
        # `filtre_accepte` est ce qu'il faut renvoyer a l'API pour filtrer.
        contrat_filtres = {}
        for groupe, valeurs in (avec_facettes.get("facets") or {}).items():
            for valeur in valeurs:
                brut = search(catalog, "vis", filters=[valeur])["total"]
                prefixe = search(catalog, "vis", filters=[f"{groupe}:{valeur}"])["total"]
                contrat_filtres[valeur] = {
                    "groupe_facette": groupe,
                    "resultats_avec_valeur_brute": brut,
                    "resultats_avec_prefixe_groupe": prefixe,
                }
        fixtures["contrat_filtres"] = contrat_filtres

        # Determine LE format correct, pour que les tests l'assertent
        formats_valides = [
            v for v in contrat_filtres.values() if v["resultats_avec_valeur_brute"] > 0
        ]
        fixtures["format_filtre_attendu"] = (
            "valeur_brute" if formats_valides else "inconnu"
        )

        # --- Zero resultat ---------------------------------------------------
        fixtures["search_zero_resultat"] = search(catalog, "xyzabc-introuvable")

        # --- Recherche par prefixe (chantier I2) -----------------------------
        fixtures["search_prefixe"] = search(catalog, "hex")

        # --- Champs presents sur un hit, pour que le rendu ne devine pas -----
        premier = avec_facettes["hits"][0]
        fixtures["forme_du_hit"] = {
            "cles_racine": sorted(premier.keys()),
            "cles_produit": sorted(premier["product"].keys()),
        }
        fixtures["cles_reponse_recherche"] = sorted(avec_facettes.keys())

        chemin = os.path.join(HERE, "engine-contract.json")
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump(fixtures, f, ensure_ascii=False, indent=2)

        print(f"Fixtures ecrites : {chemin}")
        print(f"  facettes capturees   : {list((avec_facettes.get('facets') or {}).keys())}")
        print(f"  format de filtre     : {fixtures['format_filtre_attendu']}")
        print(f"  cles d'un hit        : {fixtures['forme_du_hit']['cles_racine']}")


if __name__ == "__main__":
    main()
