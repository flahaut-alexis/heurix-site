#!/usr/bin/env python3
"""Fabrique le harnais d'export de img/og-image.svg vers un PNG 1200x630.

POURQUOI UN HARNAIS ET PAS UNE CONVERSION. Mesure du 28 aout 2026 : ce poste
n'a AUCUN convertisseur SVG vers PNG -- ni rsvg-convert, ni inkscape, ni
ImageMagick, ni cairosvg, ni resvg, ni sharp, et aucun Chrome en ligne de
commande. `sips` ne lit pas le SVG. `qlmanage -t -s 1200` produit du 1200x1200 :
il cadre dans un carre et ajoute les bandes que cette carte doit justement ne
pas avoir.

Le seul moteur disponible est celui du navigateur. Ce script prepare une page
qui charge le SVG avec ses POLICES EMBARQUEES en base64 et le dessine dans un
canvas 1200x630 ; le PNG se recupere via `window.__png`.

LES POLICES DOIVENT ETRE EMBARQUEES, ce n'est pas un raffinement. Un SVG charge
dans une balise <img> est un contexte isole : il n'herite ni du CSS de la page
ni de ses @font-face. Sans embarquement, le texte tombe en police systeme et
le PNG ne ressemble plus au site.

Usage :
    python3 scripts/exporter-og-image.py                 # ecrit le harnais
    # puis ouvrir le fichier indique DEPUIS LE SERVEUR LOCAL (pas en file://,
    # ou les scripts ne tournent pas), et recuperer window.__png.
"""
import base64, io, os, re, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(RACINE, "img", "og-image.svg")

# Les cinq faces reellement utilisees par le dessin. IBM Plex Mono n'existe
# qu'en 400 et 500 sur ce site : demander 700 donnerait un gras synthetique,
# variable selon le moteur et fige dans le PNG.
FACES = [("Plus Jakarta Sans", "fonts/pjs-400.woff2", 400),
         ("Plus Jakarta Sans", "fonts/pjs-500.woff2", 500),
         ("Plus Jakarta Sans", "fonts/pjs-700.woff2", 700),
         ("Plus Jakarta Sans", "fonts/pjs-800.woff2", 800),
         ("IBM Plex Mono",     "fonts/ipm-500.woff2", 500)]

GABARIT = """<!DOCTYPE html><html><head><meta charset="utf-8"><title>export og-image</title>
<style>body{{margin:0;background:#222;color:#ddd;font:13px system-ui;
 display:flex;flex-direction:column;align-items:center;gap:14px;padding:14px}}
#src{{width:1200px;height:630px;display:block}}
#petit{{width:340px;height:178.5px;display:block}}
canvas{{display:none}}</style></head><body>
<div>1200 x 630</div><img id="src" src="data:image/svg+xml;base64,{b64}">
<div>340 px (taille reelle dans un fil mobile)</div><img id="petit" src="data:image/svg+xml;base64,{b64}">
<canvas id="c" width="1200" height="630"></canvas>
<script>
window.__etat = "chargement";
const img = document.getElementById('src');
function rendre() {{
  try {{
    const c = document.getElementById('c'), x = c.getContext('2d');
    x.drawImage(img, 0, 0, 1200, 630);
    window.__png = c.toDataURL('image/png').split(',')[1];
    window.__etat = "pret";
  }} catch (e) {{ window.__etat = "ECHEC: " + e.message; }}
}}
img.onerror = () => {{ window.__etat = "ECHEC: le SVG ne charge pas"; }};
Promise.resolve(document.fonts && document.fonts.ready)
  .then(() => {{ (img.complete && img.naturalWidth) ? rendre() : (img.onload = rendre); }});
</script></body></html>"""


def main():
    svg = io.open(SOURCE, encoding="utf-8").read()

    # UN COMMENTAIRE XML NE PEUT PAS CONTENIR DEUX TIRETS CONSECUTIFS. Ecrire
    # un nom de token CSS tel quel dans un commentaire rend le fichier non
    # parsable PARTOUT, et l'image sort « broken » sans un mot. Verifie ici
    # plutot que decouvert a l'ouverture.
    import xml.dom.minidom
    try:
        xml.dom.minidom.parseString(svg.encode("utf-8"))
    except Exception as e:
        sys.exit(f"✗ {SOURCE} n'est pas du XML valide : {e}")

    css = "".join(
        "@font-face{{font-family:'{0}';font-weight:{2};font-style:normal;"
        "src:url(data:font/woff2;base64,{3}) format('woff2');}}".format(
            fam, chemin, poids,
            base64.b64encode(open(os.path.join(RACINE, chemin), "rb").read()).decode())
        for fam, chemin, poids in FACES)

    avec = re.sub(r'(<svg\b[^>]*>)',
                  r'\1<defs><style type="text/css">' + css + '</style></defs>',
                  svg, count=1)
    b64 = base64.b64encode(avec.encode("utf-8")).decode()

    sortie = os.path.join(RACINE, "_export-og-image.html")
    io.open(sortie, "w", encoding="utf-8").write(GABARIT.format(b64=b64))
    print(f"✓ harnais ecrit : {sortie}  ({os.path.getsize(sortie)/1024:.0f} Ko)")
    print("  Ouvrez-le VIA LE SERVEUR LOCAL, pas en file:// :")
    print("    http://localhost:<port>/_export-og-image.html")
    print("  puis recuperez window.__png (base64, sans le prefixe data:).")
    print("  FICHIER TEMPORAIRE : supprimez-le, il n'a pas a etre commite.")


if __name__ == "__main__":
    main()
