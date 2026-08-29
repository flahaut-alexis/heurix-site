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

CES DEUX FICHIERS NE SE FUSIONNENT PAS. C'EST UN FAIT SUR EUX, PAS UN CONSEIL
GENERAL (29 aout 2026).

Un rebase sur quatre commits d'autres sessions a produit exactement deux
conflits, et c'etaient ceux-la :

    search-index-fr.json    CONFLICT (content)
    search-index-en.json    CONFLICT (content)

Les quinze autres fichiers du lot se sont reunis sans un mot -- y compris
CLAUDE.md, ou deux sessions avaient ajoute une section.

RESOUDRE A LA MAIN PRODUIRAIT UN FICHIER QUI NE DECRIT AUCUN ETAT DES PAGES :
ni celui d'en face, ni le sien, ni leur reunion. Un index est une FONCTION des
pages ; melanger deux sorties d'une fonction ne donne pas la sortie sur
l'entree melangee. Et rien ne le signalerait tout de suite : `git` accepte,
la recherche du site continue de rendre des resultats, et c'est `--verifier`
qui finit par le dire -- ou personne, si on l'a resolu « proprement ».

LA SEULE VOIE, dans cet ordre :

    git checkout origin/main -- search-index-fr.json search-index-en.json
    git rebase --continue
    HEURIX_ENGINE=... <python-du-moteur> scripts/index-recherche.py

Prendre la version d'en face n'est pas un choix entre deux contenus, c'est
seulement se donner un fichier syntaxiquement valide pour finir le rebase.
Ce qui vaut est la regeneration qui suit, sur l'arbre REUNI.

Mesure du jour, qui montre pourquoi aucun des deux n'etait bon :

    apres le rebase, avant regeneration   6 ecarts -- 3 pages a eux, 3 a moi
    apres regeneration                    index a jour (119 pages), code 0

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


# ---------------------------------------------------------------------------
# LA SOURCE D'UNE PAGE, DERIVEE DE L'ARBORESCENCE.
#
# Elle vit dans l'INDEX et non dans le moteur de recherche : c'est une
# propriete du contenu, pas une regle d'affichage. Le jour ou un dossier
# apparait, c'est ce fichier qu'on modifie, pas le JavaScript servi a 122
# pages.
#
# LES SOURCES SONT CELLES DE L'ARBORESCENCE REELLE, mesurees et non
# supposees. Le brief d'origine proposait Documentation, Guides, Blog,
# Developpeurs, Produit, FAQ. Releve sur les 76 entrees FR :
#
#     Blog 38   Secteurs 17   Produit 10   Documentation 6   Plateformes 4
#     FAQ 1
#
# « Guides » et « Developpeurs » n'existent pas comme sections ; « Secteurs »
# et « Plateformes » existent et n'etaient pas prevus.
#
# FAQ N'A QU'UNE ENTREE et rejoint Produit : une source a un document ne
# merite pas une ligne de filtre permanente. Le seuil n'est pas arbitraire --
# une ligne qui ne filtre jamais rien coute un rang de lecture a chaque
# ouverture, pour ne rien rendre.
# ---------------------------------------------------------------------------

# LA SOURCE EST UNE CLEF, PAS UN LIBELLE. L'index anglais portait
# « Secteurs », « Produit », « Plateformes » : le generateur ne connait qu'une
# langue, et l'interface anglaise affichait donc trois mots francais. La clef
# se traduit dans search-engine.js, ou vit deja le reste du texte d'interface.
# Elle sert aussi de suffixe de classe CSS (.search-pill-secteurs), inchange.
SOURCES = (
    ("blog/",           "blog"),
    ("en/blog/",        "blog"),
    ("solutions/",      "secteurs"),
    ("en/solutions/",   "secteurs"),
    ("docs.html",       "documentation"),
    ("en/docs.html",    "documentation"),
    ("shopify.html",    "plateformes"),
    ("woocommerce.html", "plateformes"),
    ("prestashop.html", "plateformes"),
    ("integrations.html", "plateformes"),
)


def source(chemin: str) -> str:
    f = chemin.split("#")[0]
    fr = f[3:] if f.startswith("en/") else f
    for prefixe, nom in SOURCES:
        p = prefixe[3:] if prefixe.startswith("en/") else prefixe
        if fr == p or (p.endswith("/") and fr.startswith(p)):
            return nom
    return "produit"


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


# ---------------------------------------------------------------------------
# LES ANCRES, ET POURQUOI SEULEMENT CELLES-LA.
#
# L'index ecrit a la main portait quatre entrees ancrees
# (produit.html#probleme, index.html#comment-ca-marche...). Une derivation
# naive les perdait : une entree par page, et le visiteur atterrit en haut
# d'une page longue au lieu de la section qu'il cherchait.
#
# Indexer TOUS les h2 aurait rendu 369 entrees pour 54 pages -- mesure -- et
# ne rendait AUCUN terme technique trouvable de plus, ceux-ci vivant dans la
# prose. On ne garde donc que les titres qui portent DEJA un `id` : quelqu'un
# les a rendus adressables a dessein, souvent parce qu'un lien pointe dessus.
# Vingt et un sur les 54 pages FR.
#
# Le critere se lit dans le contenu, il n'est pas invente : c'est la
# difference entre « les sections importantes » -- que je devrais deviner --
# et « les sections que l'auteur a rendues citables ».
# ---------------------------------------------------------------------------

_TITRE_ANCRE = re.compile(r'<(h2|h3)[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)</\1>', re.I)


def ancres(chemin: str, src: str) -> list[dict]:
    sortie = []
    for _, ident, brut_titre in _TITRE_ANCRE.findall(src):
        titre = _ESPACES.sub(" ", _BALISES.sub(" ", brut_titre)).strip()
        if titre:
            sortie.append({"p": "%s#%s" % (chemin, ident), "t": titre})
    return sortie


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
            "s": source(chemin),
            "k": " ".join(sorted(termes(brut["t"] + " " + brut["e"] + " " + brut["corps"]))),
        })
        # Une ancre herite du vocabulaire de sa page : elle y mene, et son
        # propre titre est trop court pour porter seul les termes qui
        # amenent un visiteur jusqu'a elle.
        src = open(os.path.join(RACINE, chemin), encoding="utf8").read()
        for a in ancres(chemin, src):
            entrees.append({
                # `e` porte le titre de la PAGE PARENTE, pas un extrait : c'est
                # ce qui situe une section pour qui la voit dans une liste.
                # Aucune « categorie » n'est inventee ici -- verifie, aucune
                # page ne porte de signal exploitable : og:type ne rend que
                # « article » ou « website », et le schema decrit
                # l'organisation, pas la page.
                "p": a["p"], "t": a["t"], "e": brut["t"],
                "s": source(chemin), "ancre": True,
                "k": " ".join(sorted(termes(a["t"]))),
            })
    # Un chemin absent des entrees serait filtre EN SILENCE a l'affichage.
    # On le refuse ici plutot que de le laisser se perdre.
    connus = {e["p"] for e in entrees}
    derniers = derniers_articles(langue)
    manquants = [d for d in derniers if d not in connus]
    if manquants:
        sys.exit("Article recent absent de l'index : %s\n"
                 "  Il serait filtre en silence a l'affichage. Est-il dans le sitemap ?"
                 % ", ".join(manquants))
    return {"langue": langue, "entrees": entrees,
            "derniers": derniers, "empreintes": empreintes}


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

        # LA LISTE DES DERNIERS ARTICLES, meme controle et meme raison qu'avant
        # sa fusion ici : une liste perimee reste du JSON valide, et personne
        # ne remarque qu'on met en avant le 23e article sur 30.
        # L'HISTORIQUE MANQUANT N'EST PAS UN ECART, C'EST UNE INCAPACITE A
        # MESURER. Le distinguer importe : « les derniers articles ont
        # change » invite a regenerer l'index, ce qui l'ecraserait avec la
        # liste FAUSSE. Le message ci-dessous invite a reparer le clone.
        try:
            voulu = derniers_articles(langue)
        except HistoriqueTronque as exc:
            print("IMPOSSIBLE DE VERIFIER -- %s" % exc, file=sys.stderr)
            print("\n  NE REGENEREZ PAS l'index depuis ce clone : vous y ecririez"
                  "\n  une liste de derniers articles fausse, d'apparence normale."
                  "\n  Reparez le clone :  git fetch --unshallow"
                  "\n  Ou, en CI :  actions/checkout@v4 avec fetch-depth: 0",
                  file=sys.stderr)
            return 2
        if index.get("derniers", []) != voulu:
            ecarts.append("%s : les derniers articles ont change -- attendu %s"
                          % (fichier, ", ".join(voulu)))

    if not ecarts:
        print("index de recherche a jour (%d pages)" % len(pages_du_sitemap()))
        return 0
    print("INDEX DE RECHERCHE PERIME -- %d ecart(s) :" % len(ecarts))
    for e in ecarts:
        print("   %s" % e)
    print("\nRegenerez :  HEURIX_ENGINE=... <python-du-moteur> scripts/index-recherche.py")
    return 1


FICHIERS = {"fr": "search-index-fr.json", "en": "search-index-en.json"}
DOSSIERS_BLOG = {"fr": "blog", "en": "en/blog"}
N_DERNIERS = 5


# ---------------------------------------------------------------------------
# LES DERNIERS ARTICLES, REPRIS DE scripts/derniers-articles.py (supprime).
#
# CE QU'IL CORRIGEAIT, ET QUI RESTE VRAI. Les deux listes etaient ecrites a la
# main, introduites le 6 aout avec 7 entrees en FR et 3 en EN. Vingt jours et
# une douzaine d'articles plus tard, la modale annoncait « Derniers articles »
# en proposant les articles classes 23e, 27e et 29e sur 30. Rien ne le
# signalait : une liste perimee reste du JavaScript valide.
#
# POURQUOI FONDU ICI. Ce script-la vivait a cote parce que les listes vivaient
# dans search.js. Elles vivent maintenant dans l'index derive, et deux
# generateurs qui ecrivent le meme fichier finiraient par se marcher dessus --
# le second effacant ce que le premier a pose.
#
# LA DATE DU COMMIT QUI A AJOUTE LE FICHIER, pas sa derniere modification :
# corriger une coquille ne republie pas un article. Et blog.html ne fait pas
# foi -- son ordre est editorial, son premier article date du 1er aout quand
# les trois suivants datent du 24.
# ---------------------------------------------------------------------------

def date_ajout(chemin: str) -> int:
    out = subprocess.run(["git", "-C", RACINE, "log", "--diff-filter=A", "--format=%at",
                          "--", chemin], capture_output=True, text=True).stdout.strip().split("\n")
    return int(out[-1]) if out and out[-1] else 0


class HistoriqueTronque(RuntimeError):
    """L'historique git ne permet pas de dater l'ajout des articles."""


def derniers_articles(langue: str) -> list[str]:
    """Les N derniers articles, datés par le commit qui les a AJOUTÉS.

    GARDE SUR L'HISTORIQUE TRONQUÉ (27 août 2026). `date_ajout()` interroge
    `git log --diff-filter=A`. Sur un clone superficiel — `fetch-depth: 1`,
    le défaut d'`actions/checkout` — un seul commit est présent : la requête
    ne rend rien pour tout fichier ajouté avant lui, toutes les dates valent
    0, et le tri retombe sur l'ordre ALPHABÉTIQUE INVERSE.

    Le script rendait alors une liste fausse avec l'assurance d'une liste
    juste, et le message d'erreur disait « les derniers articles ont changé »
    — vrai, et trompeur : ils n'avaient pas changé, c'est la mesure qui ne
    pouvait plus les dater.

    Constaté en CI le 27 août : le job « Suite de tests » n'avait pas de
    `fetch-depth`, le job « Index de recherche à jour » avait `fetch-depth: 0`.
    Deux jobs, le même script, deux réponses — et seul celui qui avait
    l'historique disait vrai. Le `fetch-depth: 0` a été ajouté au premier,
    mais ce garde vaut indépendamment : il refuse de répondre plutôt que de
    répondre faux, partout où l'historique manque.
    """
    import glob
    dossier = DOSSIERS_BLOG[langue]
    arts = sorted(glob.glob(os.path.join(RACINE, dossier, "*.html")))
    rels = [os.path.relpath(a, RACINE) for a in arts]
    dates = [(date_ajout(p), p) for p in rels]

    # LE SIGNAL EST « TOUTES LES DATES SONT EGALES », PAS « TOUTES A ZERO ».
    #
    # Premiere version de ce garde : `all(d == 0)`. C'etait une hypothese,
    # pas une mesure, et elle etait FAUSSE. Verifie sur un clone --depth 1 :
    # `date_ajout()` rend 1787853596 pour chaque article -- pas zero. Du
    # point de vue de git, le commit unique d'un clone superficiel AJOUTE
    # tous les fichiers, donc chacun est date de ce commit.
    #
    # Le tri retombe alors sur la clef secondaire, le chemin, en ordre
    # inverse. Le symptome exact observe en CI.
    distinctes = {d for d, _ in dates}
    if len(rels) > 1 and len(distinctes) == 1:
        raise HistoriqueTronque(
            "impossible de dater l'ajout des %d articles de %s : ils portent "
            "TOUS la meme date (%d).\n"
            "  Cause la plus probable : un clone SUPERFICIEL (git clone --depth 1,\n"
            "  ou actions/checkout sans fetch-depth: 0). Du point de vue de git,\n"
            "  le commit unique ajoute tous les fichiers a la meme seconde.\n"
            "  Sans historique discriminant, le tri retomberait sur l'ordre\n"
            "  ALPHABETIQUE INVERSE et produirait une liste FAUSSE d'apparence\n"
            "  normale -- c'est ce qui s'est produit en CI le 27 aout 2026."
            % (len(rels), dossier, distinctes.pop())
        )

    return [p for _, p in sorted(dates, reverse=True)[:N_DERNIERS]]


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
