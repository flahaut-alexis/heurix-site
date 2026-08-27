#!/usr/bin/env python3
"""Genere search-index-fr.json et search-index-en.json depuis les pages du site.

CE QUE CE SCRIPT REMPLACE (27 aout 2026). L'index de recherche etait un
tableau JavaScript ECRIT A LA MAIN dans search.js et search-en.js. Il a servi
« 850 EUR HT/jour » pendant des semaines -- vestige d'un modele de facturation
abandonne, corrige le 26 aout. Ce n'etait pas le defaut, c'en etait le
symptome.

LE VRAI DEFAUT, MESURE. Un index ecrit a la main ne contient que ce que
quelqu'un a pense a y ecrire :

    « M8x20 »    present sur 37 pages   ABSENT de l'index
    « DIN 933 »  present sur 14 pages   ABSENT
    « 2rs »      present sur 16 pages   ABSENT
    « webhook »  present sur  5 pages   ABSENT

Un visiteur technique qui tape « DIN 933 » sur le site d'un editeur de moteur
de recherche obtenait zero resultat, alors que quatorze pages en parlent.

CE QU'IL EXTRAIT, ET POURQUOI PAS AUTRE CHOSE. Mesure sur les 54 pages FR du
sitemap, avant de choisir :

    strategie                          entrees   brut     « DIN 933 » trouvable
    titre + meta description                54   13,9 ko   0 pages
      + un item par h2                     369   40,3 ko   0 pages
      + h2 et h3                           526   56,0 ko   0 pages
    titre + meta + termes distincts         54  140,2 ko   7 pages
    corps entier                            54  288,4 ko   7 pages

Indexer les titres TRIPLE l'index et ne rend rien de plus trouvable : les
termes techniques vivent dans la prose, pas dans les titres. Le corps entier
les rend trouvables mais pese le double du necessaire, parce que la prose se
repete d'un facteur 2,3. On garde donc l'ENSEMBLE DES TERMES DISTINCTS.

CE QU'ON PERD, et il faut le savoir : un ensemble perd l'adjacence. « DIN 933 »
est trouve parce que « din » et « 933 » sont tous deux presents, pas parce
qu'ils se suivent. Verifie sur le cas emblematique -- 7 pages remontees, 7
pages qui en parlent reellement, ZERO faux positif. La parade (des bigrammes
sur les sequences chiffre-lettre) est donc reportable, pas necessaire.

USAGE :
    scripts/index-recherche.py              # ecrit les deux index
    scripts/index-recherche.py --verifier   # n'ecrit pas, sort 1 si perime
"""
import hashlib
import json
import os
import re
import subprocess
import sys

RACINE = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                        capture_output=True, text=True, check=True).stdout.strip()

# ---------------------------------------------------------------------------
# LA TOKENISATION VIENT DU MOTEUR, ELLE N'EST PAS REECRITE ICI.
#
# POURQUOI, MESURE PLUTOT QU'ARGUMENTE. Une premiere version de ce script
# reimplementait la tokenisation en une regex. Confrontee au moteur :
#
#     texte             moteur                    la reimplementation
#     « profile file »  ['profile','filete']      mot brise sur la ligature
#     « 13,5 deg »      ['13,5','deg']            ['13']  -- le 5 et le degre perdus
#
# (les deux exemples portent en realite la ligature « fi » et le symbole
# degre ; ils sont ecrits en clair ici pour rester lisibles en ASCII)
#
# Elle reproduisait exactement les defauts que le coeur natif a corriges le
# meme jour. C'est la troisieme fois de la semaine qu'un verificateur
# reimplemente ce qu'il verifie et finit par mesurer son propre code.
#
# CE QUE L'IMPORT DONNE : le repli (cinq tables -- ligatures typographiques,
# lettres de langue, degres et fractions, exposants, signes de
# multiplication) et la tokenisation, exactement ceux du moteur. Si ce
# generateur devait un jour pousser vers l'API plutot que d'ecrire un
# fichier, la correspondance serait exacte sans un mot de plus.
#
# IL FAUT DONC LA WHEEL heurix_fst_core, qui vit dans un depot PRIVE. C'est
# pourquoi ce script ne tourne PAS dans la CI du site, qui est publique : y
# poser un jeton de lecture d'un depot prive est une decision de securite,
# pas un detail d'outillage. Voir `verifier()` plus bas, qui n'a besoin de
# rien.
# ---------------------------------------------------------------------------

MOTEUR = os.environ.get("HEURIX_ENGINE",
                        os.path.join(os.path.dirname(RACINE), "heurix-engine"))

# IMPORT DIFFERE, ET CE N'EST PAS UN DETAIL DE STYLE. La premiere version
# importait au chargement du module et sortait en erreur si le moteur
# manquait -- ce qui rendait `--verifier` impossible sans la wheel, alors
# que sa raison d'etre est justement de s'en passer. La docstring l'annoncait
# deja ; le code la contredisait. Trouve en lancant le script, pas en le
# relisant.
_normalize_moteur = None


def _charger_moteur():
    """Importe la tokenisation du moteur. Appele UNIQUEMENT a la generation."""
    global _normalize_moteur
    if _normalize_moteur is not None:
        return
    sys.path.insert(0, MOTEUR)
    try:
        from heurix.normalize import normalize
    except ImportError as exc:                                # pragma: no cover
        sys.exit(
            "Le moteur n'est pas importable : %s\n"
            "  La GENERATION a besoin de heurix.normalize et de la wheel\n"
            "  heurix_fst_core, qui vit dans un depot prive.\n"
            "  Depot attendu : %s  (surchargeable par HEURIX_ENGINE)\n"
            "  Interpreteur   : celui du moteur, p.ex. heurix-engine/.venv/bin/python\n"
            "  Le mode --verifier, lui, n'a besoin d'aucun des deux." % (exc, MOTEUR)
        )
    _normalize_moteur = normalize

# ---------------------------------------------------------------------------
# LES SIX LIGNES QUI NE S'IMPORTENT PAS, ET POURQUOI.
#
# Le moteur applique DEUX regles de plus que `normalize()` avant d'indexer un
# terme. Elles ne vivent pas dans normalize : elles sont dans
# `Catalog.index_product` (heurix/index.py, chercher
# `composantes_deja_creditees`), entrelacees avec les poids de champ
# (FIELD_WEIGHTS), un plafond par produit sur les composantes de tiret, et un
# plafond de frequence par (terme, champ) pose le 27 aout.
#
# Les importer supposerait d'importer `Catalog`, donc sqlite, les rulepacks,
# le module flou et la journalisation -- 60 ms et huit modules contre 6 ms et
# quatre, pour du code dont ce script n'utiliserait rien d'autre. Et les
# plafonds de frequence n'ont aucun sens ici : ils reglent un SCORE, or cet
# index ne score pas, il liste des termes distincts.
#
# On reecrit donc les deux regles, et seulement elles. La partie difficile --
# le repli -- reste importee.
#
# CE QU'ELLES REPARENT, mesure sur les 54 pages FR :
#
#     terme       pages reelles   sans ces regles   avec
#     « 2rs »                 8                 1      8
#     « M8x20 »              20                17     20
#
# Sans elles, « 6205-2rs » reste un seul jeton et « 2rs » n'est jamais
# trouvable ; « m8 x 20 » ne forme jamais « m8x20 ».
# ---------------------------------------------------------------------------

LONGUEUR_MIN = 2          # heurix/index.py : MIN_TERM_LENGTH
_SEQUENCE = re.compile(r"\b([a-z]?\d{1,3})\s*[x*×-]\s*(\d{1,3})\b")


def termes(texte: str) -> set[str]:
    """Les termes indexables d'un texte, selon les regles du moteur."""
    sortie: set[str] = set()
    for jeton in _normalize_moteur(texte):
        if len(jeton) >= LONGUEUR_MIN:
            sortie.add(jeton)
        # Composantes de tiret : « 6205-2rs » credite aussi « 6205 » et « 2rs ».
        if "-" in jeton:
            for morceau in jeton.split("-"):
                if len(morceau) >= LONGUEUR_MIN:
                    sortie.add(morceau)
    # Graphie collee d'une sequence separee : « m8 x 20 » donne aussi « m8x20 ».
    for m in _SEQUENCE.finditer(" ".join(_normalize_moteur(texte))):
        sortie.add(m.group(1) + "x" + m.group(2))
    return sortie


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

# Retires avant extraction : ils sont identiques sur les 111 pages et
# n'apprennent rien qui distingue une page d'une autre.
_HORS_CONTENU = re.compile(r"<(script|style|nav|footer|svg)\b[\s\S]*?</\1>", re.I)
_BALISES = re.compile(r"<[^>]+>")
_ENTITES = re.compile(r"&[a-z]+;|&#\d+;")
_ESPACES = re.compile(r"\s+")


def pages_du_sitemap() -> list[str]:
    """Le sitemap fait foi : c'est lui qui dit ce qui est public."""
    xml = open(os.path.join(RACINE, "sitemap.xml"), encoding="utf8").read()
    chemins = []
    for url in re.findall(r"<loc>([^<]+)</loc>", xml):
        p = re.sub(r"^https?://[^/]+/", "", url)
        if p == "" or p.endswith("/"):
            p += "index.html"
        if os.path.exists(os.path.join(RACINE, p)):
            chemins.append(p)
    return sorted(chemins)


def extraire(chemin: str) -> dict:
    """Rend ce qui sera indexe, et RIEN d'autre.

    L'empreinte porte sur CE dictionnaire, pas sur le fichier : une
    correction de typo dans un pied de page ne doit pas marquer l'index
    perime alors que rien d'indexable n'a bouge.
    """
    src = open(os.path.join(RACINE, chemin), encoding="utf8").read()
    titre = (re.search(r"<title>([^<]*)</title>", src) or [None, ""])[1].strip()
    desc = (re.search(r'<meta name="description" content="([^"]*)"', src) or [None, ""])[1].strip()
    corps = _ESPACES.sub(" ", _ENTITES.sub(" ", _BALISES.sub(" ", _HORS_CONTENU.sub("", src)))).strip()
    return {"p": chemin, "t": titre, "e": desc[:180], "corps": corps}


def empreinte(brut: dict) -> str:
    """Empreinte de ce qui est EXTRAIT. Seize caracteres suffisent ici :
    on compare une page a elle-meme, pas un corpus a un autre."""
    graine = "\x00".join([brut["t"], brut["e"], brut["corps"]])
    return hashlib.sha256(graine.encode("utf8")).hexdigest()[:16]


def construire(langue: str) -> dict:
    _charger_moteur()
    en = langue == "en"
    entrees, empreintes = [], {}
    for chemin in pages_du_sitemap():
        if chemin.startswith("en/") != en:
            continue
        brut = extraire(chemin)
        empreintes[chemin] = empreinte(brut)
        entrees.append({
            "p": brut["p"], "t": brut["t"], "e": brut["e"],
            "k": " ".join(sorted(termes(brut["t"] + " " + brut["e"] + " " + brut["corps"]))),
        })
    return {"langue": langue, "entrees": entrees, "empreintes": empreintes}


# ---------------------------------------------------------------------------
# Verification -- sans le moteur, sans la wheel, sans jeton
# ---------------------------------------------------------------------------

def verifier() -> int:
    """Rend 0 si les deux index sont a jour, 1 sinon, en NOMMANT les pages.

    TROIS SITUATIONS, ET LA TROISIEME EST CELLE QU'ON OUBLIE :

      * page MODIFIEE   -- son empreinte ne correspond plus
      * page RETIREE    -- elle est dans l'index, plus dans le sitemap
      * page AJOUTEE    -- elle ne change AUCUNE empreinte existante, et
                           c'est exactement comme ca que partners.html et
                           roi.html sont restes introuvables par la
                           recherche pendant des semaines. Le seul controle
                           qui l'attrape compare les ENSEMBLES, pas les
                           empreintes.

    « L'index est perime » envoie chercher. « docs.html a change depuis la
    generation » dit quoi faire.
    """
    ecarts = []
    for langue, fichier in (("fr", FICHIERS["fr"]), ("en", FICHIERS["en"])):
        chemin = os.path.join(RACINE, fichier)
        if not os.path.exists(chemin):
            ecarts.append("%s : absent -- lancez le script sans --verifier" % fichier)
            continue
        index = json.load(open(chemin, encoding="utf8"))
        connues = index.get("empreintes", {})
        attendues = [p for p in pages_du_sitemap() if p.startswith("en/") == (langue == "en")]

        for p in attendues:
            if p not in connues:
                ecarts.append("%s : AJOUTEE depuis la generation, absente de %s" % (p, fichier))
            elif empreinte(extraire(p)) != connues[p]:
                ecarts.append("%s : son contenu indexable a change depuis la generation" % p)
        for p in connues:
            if p not in attendues:
                ecarts.append("%s : plus dans le sitemap, encore dans %s" % (p, fichier))

    if not ecarts:
        print("index de recherche a jour (%d pages)" % len(pages_du_sitemap()))
        return 0
    print("INDEX DE RECHERCHE PERIME -- %d ecart(s) :" % len(ecarts))
    for e in ecarts:
        print("   %s" % e)
    print("\nRegenerez :  HEURIX_ENGINE=... <python-du-moteur> scripts/index-recherche.py")
    return 1


FICHIERS = {"fr": "search-index-fr.json", "en": "search-index-en.json"}


def main() -> int:
    if "--verifier" in sys.argv:
        return verifier()
    for langue, fichier in FICHIERS.items():
        index = construire(langue)
        chemin = os.path.join(RACINE, fichier)
        with open(chemin, "w", encoding="utf8") as f:
            json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
        octets = os.path.getsize(chemin)
        print("%-22s %3d pages  %6.1f ko" % (fichier, len(index["entrees"]), octets / 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
