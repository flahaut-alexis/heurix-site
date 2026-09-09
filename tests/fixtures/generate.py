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

# Emplacement du code source du moteur. Ce script n'est PAS necessaire
# pour lancer les tests -- le contrat genere (engine-contract.json) est
# versionne. Il ne sert qu'a le REgenerer apres un changement d'API.
CANDIDATS = [
    os.environ.get("HEURIX_ENGINE_PATH", ""),
    os.path.expanduser("~/heurix-engine"),
    os.path.expanduser("~/Documents/GitHub/heurix-engine"),
    os.path.expanduser("~/Downloads/heurix-engine"),
    "/opt/heurix-engine",
    "/home/claude/heurix-engine",
]
ENGINE = next(
    (c for c in CANDIDATS if c and os.path.isdir(os.path.join(c, "heurix"))), None
)
if ENGINE is None:
    print("Code source du moteur introuvable.", file=sys.stderr)
    print("", file=sys.stderr)
    print("Ce script n'est pas necessaire pour lancer les tests : le contrat", file=sys.stderr)
    print("deja genere (tests/fixtures/engine-contract.json) est versionne.", file=sys.stderr)
    print("Lancez simplement `npm test`.", file=sys.stderr)
    print("", file=sys.stderr)
    print("Pour REgenerer le contrat apres un changement d'API du moteur,", file=sys.stderr)
    print("indiquez ou se trouve le code source :", file=sys.stderr)
    print("  HEURIX_ENGINE_PATH=/chemin/vers/heurix-engine npm run fixtures", file=sys.stderr)
    print("", file=sys.stderr)
    print("Emplacements essayes :", file=sys.stderr)
    for c in CANDIDATS:
        if c:
            print(f"  - {c}", file=sys.stderr)
    sys.exit(1)

sys.path.insert(0, ENGINE)

from heurix.index import Store  # noqa: E402
from heurix.pack_advisor import comparer_packs  # noqa: E402
from heurix.rules import load_rulepacks  # noqa: E402
from heurix.search import search  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

# Corpus d'EGALITE STRICTE, repris de heurix-engine
# (tests/test_pack_advisor.py, `_produits_egalite_stricte`). Chaque produit
# porte « M{d} » ET « DN {d} » pour le meme d : `industrie`, `outillage` et
# `plomberie` lisent chacun une des deux notations, couvrent les memes
# produits et posent le meme nombre d'etiquettes distinctes. Le tri
# `(-produits_annotes, -annotations_distinctes)` n'a alors rien pour
# departager, et le moteur refuse de recommander plutot que de laisser
# l'ordre alphabetique decider (heurix-engine d78f5bb, capture ici depuis 9465756).
#
# C'EST LE SEUL ETAT QUI REND `recommande` NUL AVEC UN CATALOGUE QUI
# S'ANNOTE BIEN, et donc le seul qui atteignait la branche muette de
# `chargerSuggestionPack`. On le capture depuis le VRAI moteur pour la
# meme raison que le reste de ce fichier : un payload ecrit a la main
# prouverait que la console sait afficher un objet qu'on a invente.
_DIAMETRES_COMMUNS = [4, 5, 6, 8, 10, 12, 14, 16, 20, 25, 32, 40, 50]
EGALITE_STRICTE = [
    {"id": f"P{i}",
     "ref": f"M{_DIAMETRES_COMMUNS[i % len(_DIAMETRES_COMMUNS)]}",
     "name": f"M{_DIAMETRES_COMMUNS[i % len(_DIAMETRES_COMMUNS)]} "
             f"DN {_DIAMETRES_COMMUNS[i % len(_DIAMETRES_COMMUNS)]}"}
    for i in range(100)
]

PRODUITS = [
    {"id": "V001", "name": "Vis à métaux tête hexagonale", "ref": "M8 x 20 - Inox A2",
     "stock": 120, "price": 5.90, "categories": ["visserie"], "brand": "Facom"},
    {"id": "V002", "name": "Vis à métaux tête hexagonale", "ref": "M8 x 30 - Inox A2",
     "stock": 0, "price": 7.90, "categories": ["visserie"], "brand": "Facom"},
    {"id": "E001", "name": "Écrou hexagonal", "ref": "M8 - Zingué",
     "stock": 300, "price": 0.40, "categories": ["visserie"], "brand": "Legallais"},
]


def _inventaire_par_l_api(rulepacks: dict) -> list:
    """Interroge GET /v1/rulepacks/annotations sur une instance jetable.

    Le moteur monte ici comme il monte en production -- app FastAPI, cle
    creee par l'admin, requete HTTP. Une base temporaire, jetee a la sortie :
    l'inventaire ne depend d'aucun catalogue.

    Leve si la route repond autre chose que 200 : un moteur trop ancien pour
    la porter doit le dire, pas produire une fixture vide que le garde lirait
    comme « aucune annotation n'existe » -- il declarerait alors fausses les
    657 occurrences justes du site.
    """
    import importlib
    from fastapi.testclient import TestClient

    with tempfile.TemporaryDirectory() as tmp:
        os.environ["HEURIX_DATA_DIR"] = tmp
        os.environ["HEURIX_ADMIN_KEY"] = "fixtures-admin"
        os.environ["HEURIX_RULEPACKS"] = os.path.join(ENGINE, "rulepacks")
        from heurix import main as main_module
        importlib.reload(main_module)
        client = TestClient(main_module.app)
        cle = client.post(
            "/v1/admin/keys",
            headers={"Authorization": "Bearer fixtures-admin"},
            json={"label": "fixtures"},
        ).json()["key"]
        r = client.get("/v1/rulepacks/annotations",
                       headers={"Authorization": f"Bearer {cle}"})
        if r.status_code != 200:
            raise SystemExit(
                f"GET /v1/rulepacks/annotations a repondu {r.status_code}. "
                "Ce moteur ne publie pas son inventaire d'annotations : "
                "mettez-le a jour (heurix-engine 8f178d5 ou plus recent)."
            )
        publie = r.json()["annotations"]

    if set(publie) != set(rulepacks):
        raise SystemExit(
            "l'inventaire publie ne porte pas les memes packs que le disque : "
            f"{set(publie) ^ set(rulepacks)}"
        )
    plat = sorted({(e["modele"], e["motif"]) for v in publie.values() for e in v})
    return [{"modele": m, "motif": r} for m, r in plat]


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

        # --- Recommandation de pack : les trois etats du refus ---------------
        # `pack_actuel` change la BRANCHE du moteur, pas la mesure :
        #   None       -- un changement serait recommande, l'egalite le refuse
        #   "vins"     -- pack en place qui n'annote rien, meme refus
        #   "industrie"-- deja pose sur l'un des packs a egalite : rien a faire
        # La console doit parler dans les deux premiers cas et se taire dans
        # le troisieme ; sans les trois, un test ne pourrait pas montrer la
        # difference.
        fixtures["rulepack_suggestion_egalite"] = {
            str(pack_actuel): comparer_packs(EGALITE_STRICTE, rulepacks, pack_actuel)
            for pack_actuel in (None, "vins", "industrie")
        }

        # L'AUTRE refus, celui qui existait deja : aucun pack ne reconnait
        # rien. `marge` y vaut None sur ses quatre champs -- il n'y a pas de
        # concurrent a comparer. Les deux consoles doivent distinguer ce cas
        # de l'egalite : ici on importe sans pack, la on choisit entre deux.
        fixtures["rulepack_suggestion_sans_signal"] = comparer_packs(
            PRODUITS, {n: rulepacks[n] for n in ("mode", "vins")}, None
        )

        # --- Inventaire des annotations : ce que les packs peuvent ECRIRE ---
        #
        # CAPTURE PAR L'API, PAS PAR `rules.inventaire_annotations`, et c'est
        # le seul endroit de ce fichier qui le fait. Les autres captures
        # portent sur des FONCTIONS que la console appelle a travers l'API ;
        # celle-ci porte sur le CONTRAT de la route elle-meme. Si le moteur
        # renommait la clef `annotations` ou changeait son enveloppe, la
        # fonction ne bougerait pas et la fixture resterait juste alors que
        # la production aurait change de forme.
        #
        # ON NE VERSE PAS LES `regles`. L'endpoint rend `{modele, motif,
        # regles}` par pack -- 25,5 Ko. Le garde valide des jetons : il lui
        # faut le motif, et le modele pour ecrire un message lisible
        # (« FORMAT_PO rejete ; le pack ecrit FORMAT_POCHE »). Les noms de
        # regle servent au diagnostic COTE MOTEUR, ou ils sont deja publies.
        # Mesure du 9 septembre 2026, fixture a 7,7 Ko avant ce lot :
        #
        #     tout (modele+motif+regles)   25,5 Ko   x4,3
        #     modele+motif, par pack       13,5 Ko   x2,8
        #     modele+motif, liste plate    13,0 Ko   x2,7   <- retenu
        #     motif seul, liste plate       5,2 Ko   x1,7
        #
        # La liste plate plutot que le groupement par pack : 223 entrees au
        # lieu de 228, et surtout un garde qui n'a pas a choisir un pack pour
        # valider un jeton -- une page de documentation ne declare pas quel
        # pack elle illustre. Les 5 entrees d'ecart sont les modeles qu'un
        # meme nom porte dans deux packs (`MAT_INOX` est pose par outillage
        # ET par plomberie).
        #
        # LE MOTIF SEUL AURAIT SUFFI A VALIDER, a 5,2 Ko. C'est le modele qui
        # coute, et il est garde exprES : un garde qui dit « ^FORMAT_[A-Za-z
        # 0-9.,/-]*$ ne reconnait pas FORMAT_PO » fait chercher, un garde qui
        # dit « FORMAT_POCHE, FORMAT_BROCHE, FORMAT_GF » fait corriger.
        inventaire = _inventaire_par_l_api(rulepacks)
        fixtures["inventaire_annotations"] = inventaire

        chemin = os.path.join(HERE, "engine-contract.json")
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump(fixtures, f, ensure_ascii=False, indent=2)

        print(f"Fixtures ecrites : {chemin}")
        print(f"  facettes capturees   : {list((avec_facettes.get('facets') or {}).keys())}")
        print(f"  format de filtre     : {fixtures['format_filtre_attendu']}")
        print(f"  cles d'un hit        : {fixtures['forme_du_hit']['cles_racine']}")
        egalite = fixtures["rulepack_suggestion_egalite"]["None"]
        print(f"  egalite stricte      : recommande={egalite['recommande']!r} "
              f"marge={egalite.get('marge')}")
        print(f"  inventaire annotations : {len(inventaire)} modeles distincts")
        muet = fixtures["rulepack_suggestion_sans_signal"]
        print(f"  sans signal          : recommande={muet['recommande']!r} "
              f"marge={muet.get('marge')}")


if __name__ == "__main__":
    main()
