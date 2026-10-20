#!/usr/bin/env python3
"""Pose un <lastmod> sur chaque <url> du sitemap, pris de la date du commit.

CE QUE LE SCRIPT NE FAIT PAS : il ne genere pas le sitemap. La liste des URL
reste tenue a la main, et c'est tests/canonical.test.js qui la garde alignee
sur les pages indexables (aucune absente, aucune de trop, aucun doublon). Ce
script ne touche qu'au <lastmod>, et laisse <loc>, <xhtml:link>, <changefreq>
et <priority> exactement ou ils sont.

LA DATE EST CELLE DE L'AUTEUR (%as), PAS CELLE DU COMMITTER (%cs), ET LE CHOIX
EST DELIBERE. Un rebase reecrit les dates de committer : avec %cs, rebaser la
branche perimerait les 140 <lastmod> d'un coup, et le garde deviendrait rouge
pour une raison qui n'a rien a voir avec les pages. La date d'auteur survit au
rebase.

LES FICHIERS MODIFIES MAIS PAS ENCORE COMMITES recoivent la date du jour :
c'est celle que portera le commit en cours. Sans cette regle, le lot qui
modifie une page et regenere le sitemap dans le MEME commit ecrirait la date
d'AVANT sa propre modification -- et le garde, lui, lirait la date d'apres.

USAGE :
    scripts/sitemap-lastmod.py          # ecrit sitemap.xml
"""
from __future__ import annotations

import datetime
import os
import re
import subprocess
import sys

RACINE = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                        capture_output=True, text=True, check=True).stdout.strip()
SITEMAP = os.path.join(RACINE, "sitemap.xml")


def chemin(loc: str) -> str:
    """Le fichier du depot derriere une URL du sitemap."""
    rel = loc.replace("https://heurix.fr/", "")
    return rel if rel else "index.html"


def date_auteur(fichier: str) -> str | None:
    out = subprocess.run(
        ["git", "--no-optional-locks", "log", "-1", "--format=%as", "--", fichier],
        cwd=RACINE, capture_output=True, text=True, check=True).stdout.strip()
    return out or None


def modifies() -> set[str]:
    """Les fichiers qui divergent de HEAD -- index et arbre de travail."""
    out = subprocess.run(["git", "--no-optional-locks", "status", "--porcelain"],
                         cwd=RACINE, capture_output=True, text=True,
                         check=True).stdout
    return {l[3:].strip() for l in out.splitlines() if l[3:].strip()}


def main() -> int:
    source = open(SITEMAP, encoding="utf-8").read()
    aujourdhui = datetime.date.today().isoformat()
    sales = modifies()
    poses, inchanges, sans_date, vus = 0, 0, [], 0

    def un_bloc(m):
        nonlocal poses, inchanges, vus
        bloc = m.group(0)
        vus += 1
        loc = re.search(r"<loc>(.*?)</loc>", bloc).group(1)
        f = chemin(loc)
        if f in sales:
            d = aujourdhui
        else:
            d = date_auteur(f)
            if d is None:
                sans_date.append(f)
                return bloc
        balise = f"<lastmod>{d}</lastmod>"
        vieux = re.search(r"<lastmod>(.*?)</lastmod>", bloc)
        if vieux:
            if vieux.group(1) == d:
                inchanges += 1
                return bloc
            poses += 1
            return bloc.replace(vieux.group(0), balise)
        poses += 1
        # L'ordre des elements du namespace sitemap reste loc, lastmod,
        # changefreq, priority : on s'insere AVANT changefreq.
        #
        # DEUX MISES EN PAGE COEXISTENT dans ce fichier -- 77 blocs sur
        # plusieurs lignes, 63 sur une seule. La premiere version de ce script
        # ne reconnaissait que la premiere et a saute les 63 autres EN
        # ANNONCANT UN SUCCES (« 77 ecrits »). D'ou l'assertion de fin, qui
        # compare les blocs vus au nombre de <loc> : un bloc non reconnu est
        # maintenant un echec, pas un silence.
        multi = "\n" in bloc.strip()
        cf = re.search(r"[ \t]*<changefreq>", bloc)
        if cf and multi:
            return bloc[:cf.start()] + f"    {balise}\n" + bloc[cf.start():]
        if cf:
            return bloc[:cf.start()] + balise + bloc[cf.start():]
        fin = bloc.rindex("</url>")
        if multi:
            return bloc[:fin] + f"  {balise}\n  " + bloc[fin:]
        return bloc[:fin] + balise + bloc[fin:]

    sortie = re.sub(r"[ \t]*<url>.*?</url>", un_bloc, source, flags=re.S)
    attendu = source.count("<loc>")
    if vus != attendu:
        print(f"{vus} blocs <url> reconnus pour {attendu} <loc> : mise en page "
              f"non prevue, rien n'est ecrit.", file=sys.stderr)
        return 1
    if sans_date:
        print("Aucun commit ne porte ces fichiers -- <lastmod> non pose :",
              file=sys.stderr)
        for f in sans_date:
            print(f"  {f}", file=sys.stderr)
        return 1
    open(SITEMAP, "w", encoding="utf-8").write(sortie)
    print(f"{vus} blocs <url> ; <lastmod> ecrits ou mis a jour : {poses} ; "
          f"deja justes : {inchanges}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
