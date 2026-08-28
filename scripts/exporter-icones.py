#!/usr/bin/env python3
"""Fabrique le harnais d'export des icones (favicon, apple-touch) depuis un SVG.

MEME MOTEUR QUE exporter-og-image.py, ET POUR LA MEME RAISON. Mesure du
28 aout 2026 : ce poste n'a aucun convertisseur SVG vers PNG -- ni
rsvg-convert, ni inkscape, ni ImageMagick, ni cairosvg, ni resvg, ni sharp,
et aucun Chrome en ligne de commande. `sips` ne lit pas le SVG. `qlmanage`
cadre dans un carre et ajoute des bandes. Le seul moteur disponible est celui
du navigateur : on charge le SVG dans une <img>, on le dessine dans un canvas
a la taille voulue, on relit le PNG.

CE QUI DIFFERE DE L'EXPORT og-image, ET POURQUOI :

  - PAS DE POLICES A EMBARQUER. Le logo est de la geometrie pure, aucun
    <text>. L'embarquement base64 de cinq faces woff2 ne servirait a rien ici
    et ferait un harnais de 300 Ko pour une icone de 1 Ko.

  - PLUSIEURS SOURCES ET PLUSIEURS TAILLES en une passe, parce que la
    question posee n'est pas « convertis » mais « ce dessin tient-il a
    32 px ? ». Le harnais affiche donc chaque source A SA TAILLE REELLE et
    grossie 8 fois, cote a cote, pour qu'on puisse en juger a l'ecran.

  - `image-rendering:pixelated` sur les vues grossies : sans ca le navigateur
    reinterpole et on juge un flou, pas les pixels reellement produits.

Usage :
    python3 scripts/exporter-icones.py              # lit img/icones.json
    python3 scripts/exporter-icones.py logo.svg:16,32,48@#ffffff   # exploration
    # puis ouvrir le fichier indique DEPUIS LE SERVEUR LOCAL (pas en file://),
    # regarder, et recuperer window.__png['logo.svg@32'] etc.
"""
import base64, io, os, sys, xml.dom.minidom

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

GABARIT = """<!DOCTYPE html><html><head><meta charset="utf-8"><title>export icones</title>
<style>
 body{{margin:0;background:#1b1e2b;color:#dfe3f5;font:13px system-ui;padding:18px}}
 h2{{font-size:14px;font-weight:600;margin:22px 0 10px;color:#aeb9ff}}
 .rangee{{display:flex;align-items:flex-end;gap:26px;flex-wrap:wrap;margin-bottom:8px}}
 .cellule{{text-align:center}}
 .cellule .etiq{{font-size:11px;color:#8f97bd;margin-top:6px}}
 .reel{{background:#fff;padding:4px;border-radius:3px}}
 .sombre{{background:#0d1230;padding:4px;border-radius:3px}}
 .zoom img{{image-rendering:pixelated}}
 canvas{{display:none}}
</style></head><body>
<div id="vues"></div>
<script>
const SOURCES = {sources};
window.__png = {{}}; window.__etat = "chargement";
const vues = document.getElementById('vues');

function cellule(src, px, classe, libelle, zoom) {{
  const d = document.createElement('div'); d.className = 'cellule' + (zoom ? ' zoom' : '');
  const b = document.createElement('div'); b.className = classe;
  const i = document.createElement('img');
  i.src = src; i.width = px * (zoom || 1); i.height = px * (zoom || 1);
  b.appendChild(i); d.appendChild(b);
  const e = document.createElement('div'); e.className = 'etiq'; e.textContent = libelle;
  d.appendChild(e); return d;
}}

async function tout() {{
  for (const s of SOURCES) {{
    const h = document.createElement('h2'); h.textContent = s.nom; vues.appendChild(h);
    const r = document.createElement('div'); r.className = 'rangee';
    for (const px of s.tailles) {{
      r.appendChild(cellule(s.uri, px, 'reel',   px + ' px, fond clair'));
      r.appendChild(cellule(s.uri, px, 'sombre', px + ' px, fond sombre'));
      if (px <= 48) r.appendChild(cellule(s.uri, px, 'reel', px + ' px x8', 8));
    }}
    vues.appendChild(r);

    const img = new Image();
    await new Promise((ok, ko) => {{ img.onload = ok; img.onerror = () => ko(s.nom); img.src = s.uri; }});
    for (const px of s.tailles) {{
      const c = document.createElement('canvas'); c.width = c.height = px;
      const g = c.getContext('2d');
      // LE FOND EST APLATI DANS LE PNG, PAS LAISSE TRANSPARENT. Les trois
      // fichiers actuels sont opaques sur blanc (mesure : coin 255,255,255,255),
      // et apple-touch-icon DOIT l'etre -- iOS compose un PNG transparent sur
      // du noir. Regenerer en transparent changerait l'apparence sans qu'on
      // l'ait demande.
      if (s.fond) {{ g.fillStyle = s.fond; g.fillRect(0, 0, px, px); }}
      g.drawImage(img, 0, 0, px, px);
      window.__png[s.nom + '@' + px] = c.toDataURL('image/png').split(',')[1];
    }}
  }}
  window.__etat = "pret";
}}
tout().catch(e => {{ window.__etat = "ECHEC: " + e; }});
</script></body></html>"""


def main():
    # SANS ARGUMENT, LE PERIMETRE VIENT DU MANIFESTE, PAS DE LA MEMOIRE. Les
    # tailles et les fonds a produire etaient jusqu'ici dans la ligne de
    # commande, donc nulle part : rejouer l'export un mois plus tard supposait
    # de retrouver les bons arguments. img/icones.json les porte, et
    # tests/icones-derivees.test.js lit le MEME fichier.
    args = sys.argv[1:]
    if not args:
        import json as _json
        manifeste = _json.load(io.open(os.path.join(RACINE, "img", "icones.json"),
                                       encoding="utf-8"))
        args = [f"{i['source']}:{i['taille']}@{i['fond']}" for i in manifeste["icones"]]
        print("Perimetre lu dans img/icones.json :")
        for i in manifeste["icones"]:
            print(f"    {i['png']:22} <- {i['source']}  {i['taille']} px")

    sources = []
    for arg in args:
        chemin, _, reste = arg.partition(":")
        tailles, _, fond = reste.partition("@")
        if not tailles:
            sys.exit(f"✗ {arg} : il manque les tailles, forme attendue fichier.svg:32,180")
        plein = os.path.join(RACINE, chemin)
        if not os.path.exists(plein):
            sys.exit(f"✗ {plein} : introuvable")
        svg = io.open(plein, encoding="utf-8").read()

        # LE XML EST VALIDE AVANT DE FABRIQUER QUOI QUE CE SOIT. Un commentaire
        # portant deux tirets consecutifs rend le fichier non parsable PARTOUT,
        # et l'image sort « broken » sans un mot -- defaut rencontre le 28 aout
        # sur img/og-image.svg, dans le commentaire qui expliquait la regle.
        try:
            xml.dom.minidom.parseString(svg.encode("utf-8"))
        except Exception as e:
            sys.exit(f"✗ {chemin} n'est pas du XML valide : {e}")

        b64 = base64.b64encode(svg.encode("utf-8")).decode()
        sources.append({"nom": chemin,
                        "tailles": [int(t) for t in tailles.split(",")],
                        "fond": fond or None,
                        "uri": "data:image/svg+xml;base64," + b64})

    import json
    # LE HARNAIS N'EST PAS ECRIT A LA RACINE, ET LE RAPPEL TEXTUEL NE SUFFIT
    # PAS. La version precedente le posait a la racine en imprimant « fichier
    # temporaire, supprimez-le ». Mesure du 28 aout 2026 : ce rappel a ete
    # ecrit, lu, et pas applique -- et le cout arrive bien avant le commit.
    # `tests/canonical.test.js` enumere le DISQUE (fs.readdirSync), pas l'index
    # git : un `.html` NON SUIVI a la racine fait donc echouer deux assertions,
    # le crochet pre-push rejoue vitest, et plus aucun push ne part du depot,
    # quelle que soit la session. Deux commits d'une autre session sont restes
    # bloques derriere celui-ci.
    #
    # `.scratch/` est deja ignore par git ET hors du perimetre du test, pour la
    # raison ecrite dans .gitignore : le depot est publie, donc tout dossier
    # d'outillage y est range. Le harnais y va.
    dossier = os.path.join(RACINE, ".scratch", "icones")
    os.makedirs(dossier, exist_ok=True)
    sortie = os.path.join(dossier, "export.html")
    io.open(sortie, "w", encoding="utf-8").write(GABARIT.format(sources=json.dumps(sources)))
    print(f"✓ harnais ecrit : {sortie}  ({os.path.getsize(sortie)/1024:.0f} Ko)")
    for s in sources:
        print(f"    {s['nom']:28} {', '.join(str(t) for t in s['tailles'])} px"
              f"{'  fond ' + s['fond'] if s['fond'] else '  fond transparent'}")
    print("  Ouvrez-le VIA LE SERVEUR LOCAL, pas en file:// :")
    print("    http://localhost:<port>/.scratch/icones/export.html")
    print("  (.scratch/ est ignore par git et hors du perimetre des tests :")
    print("   rien a supprimer, rien qui bloque un push.)")


if __name__ == "__main__":
    main()
