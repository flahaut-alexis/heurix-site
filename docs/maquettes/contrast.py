#!/usr/bin/env python3
"""WCAG 2.x contrast ratio calculator for the heurix nav-menu redesign.
Usage: edit the PAIRS list below and run `python3 contrast.py`.
"""

def hex_to_rgb(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c*2 for c in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def blend(fg_rgba, bg_rgb):
    """Blend a translucent fg (r,g,b,alpha 0-1) over an opaque bg (r,g,b)."""
    r, g, b, a = fg_rgba
    br, bg_, bb = bg_rgb
    return (
        r * a + br * (1 - a),
        g * a + bg_ * (1 - a),
        b * a + bb * (1 - a),
    )

def rel_luminance(rgb):
    def chan(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)

def contrast(rgb1, rgb2):
    l1, l2 = rel_luminance(rgb1), rel_luminance(rgb2)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

def cr(fg, bg, label=""):
    fg_rgb = hex_to_rgb(fg) if isinstance(fg, str) else fg
    bg_rgb = hex_to_rgb(bg) if isinstance(bg, str) else bg
    ratio = contrast(fg_rgb, bg_rgb)
    status = "AA-normal OK" if ratio >= 4.5 else ("AA-large only" if ratio >= 3.0 else "FAIL")
    print(f"{ratio:5.2f}:1  [{status:13s}]  {label}")
    return ratio

def surface_translucide(fill_hex, alpha, page_hex):
    """La couleur QU'UN ECRAN PRODUIT quand un fond translucide est pose sur
    une page opaque. C'est elle qui doit servir de fond a toute mesure de
    contraste -- pas la page nue.

    ARRONDIE A L'ENTIER, ET CE N'EST PAS DE LA COQUETTERIE : un navigateur
    compose en 8 bits par canal. Sur ce cas precis, garder les decimales rend
    4,03:1 la ou l'ecran affiche 4,01:1. Les deux sont sous le seuil, mais
    c'est le second qu'on peut aller verifier a la pipette.

    CETTE FONCTION EXISTAIT DEJA ET N'ETAIT JAMAIS APPELEE (corrige le
    30 aout 2026). Elle portait en plus deux morceaux de code mort : un
    `bg_hex if False else bg`, et un `ratio` calcule puis jamais rendu. Le
    tableau du rapport annoncait donc 4,55:1 pour une carte translucide --
    le texte mesure sur le degrade NU, sans jamais poser la carte dessus.
    Quatrieme ratio de la semaine calcule sur un fond non compose, et le
    premier ou l'outil de composition etait dans le meme fichier.
    """
    fill = hex_to_rgb(fill_hex) if isinstance(fill_hex, str) else fill_hex
    page = hex_to_rgb(page_hex) if isinstance(page_hex, str) else page_hex
    return tuple(round(c) for c in blend((*fill, alpha), page))

print("=== TOKENS (from heurix styles.css, live-fetched 2026-08-29) ===")
LIGHT = dict(bg="#FFFFFF", bg_soft="#F7F8FC", ink="#12142B", ink_muted="#5B5E76",
             line="#E7E9F2", blue="#5468FF", blue_deep="#3F52E8", blue_tint="#EEF1FF")
DARK = dict(solid="#101B4D", grad_lightest="#4C3FE0", grad_mid="#3648A8",
            ink_on_dark="#F5F6FF", ink_muted_on_dark="#CDD2F0",
            ink_on_dark_att="#A9B2E0", ink_muted_on_dark_att="#8493D2",
            link_accent="#5AB8E8")

print("\n=== LIGHT THEME PANEL ===")
cr(LIGHT["ink"], LIGHT["bg"], "primary text (--ink) on white panel bg")
cr(LIGHT["ink_muted"], LIGHT["bg"], "secondary/muted text (--ink-muted) on white panel bg")
cr(LIGHT["ink"], LIGHT["bg_soft"], "primary text on --bg-soft (group header strip)")
cr(LIGHT["ink_muted"], LIGHT["bg_soft"], "muted text on --bg-soft (group header strip)")
cr(LIGHT["blue_deep"], LIGHT["bg"], "--blue-deep link/hover text on white")
cr(LIGHT["blue_deep"], LIGHT["blue_tint"], "--blue-deep text on --blue-tint hover/active fill")
cr(LIGHT["ink_muted"], LIGHT["blue_tint"], "muted text on --blue-tint hover fill (if used)")
cr(LIGHT["blue"], LIGHT["bg"], "--blue as a *focus ring* vs white (non-text, needs >=3:1)")
cr(LIGHT["line"], LIGHT["bg"], "--line border vs white (non-text, informational only)")

print("\n=== DARK THEME PANEL -- OPTION A: translucent .pb-carte over hero gradient ===")
print("(shown for comparison / to justify why it is NOT the chosen option)")
# LE FOND EST COMPOSE, PAS SUPPOSE. `body.docs-dark .pb-carte` vaut
# rgba(255,255,255,0.06) : le texte n'est jamais sur le degrade nu, il est sur
# la carte POSEE dessus. Mesurer sur le degrade nu surestime -- 4,55 au lieu
# de 4,01, soit la difference entre « AA de justesse » et « sous le seuil ».
CARTE_ALPHA = 0.06
for stop, nom in ((DARK["grad_lightest"], "LIGHTEST #4C3FE0"), (DARK["grad_mid"], "MID #3648A8")):
    carte = surface_translucide("#FFFFFF", CARTE_ALPHA, stop)
    print(f"  .pb-carte at 6% white over {nom} -> rgb{carte}")
    cr(DARK["ink_on_dark"], carte, f"--ink-on-dark on the CARD over {nom}")
    cr(DARK["ink_muted_on_dark"], carte, f"--ink-muted-on-dark on the CARD over {nom}  <- decides option A")
    cr(DARK["link_accent"], carte, f"#5AB8E8 accent on the CARD over {nom}")
print("  (for reference only -- the text is never on the bare gradient:)")
cr(DARK["ink_muted_on_dark"], DARK["grad_lightest"], "--ink-muted-on-dark on the BARE gradient <- what the first report wrongly used")

print("\n=== DARK THEME PANEL -- OPTION B (CHOSEN): solid #101B4D fill, matches search-modal precedent ===")
cr(DARK["ink_on_dark"], DARK["solid"], "primary text (--ink-on-dark) on solid #101B4D panel")
cr(DARK["ink_muted_on_dark"], DARK["solid"], "secondary text (--ink-muted-on-dark) on solid #101B4D panel")
cr(DARK["ink_on_dark_att"], DARK["solid"], "attenuated primary (--ink-on-dark-attenue) on #101B4D")
cr(DARK["ink_muted_on_dark_att"], DARK["solid"], "attenuated secondary (--ink-muted-on-dark-attenue) on #101B4D")
cr(DARK["link_accent"], DARK["solid"], "#5AB8E8 accent link colour (site's existing dark-surface link colour) on #101B4D")

print("\n=== DARK THEME hover fill: rgba(255,255,255,.10) over #101B4D, then text on that blended colour ===")
survol = surface_translucide("#FFFFFF", 0.10, DARK["solid"])
print(f"blended hover bg = rgb{survol}")
cr(DARK["ink_on_dark"], survol, "primary text on hover-blended bg")
cr(DARK["ink_muted_on_dark"], survol, "secondary text on hover-blended bg")

print("\n=== 44px / 24px touch-target & the '11px secondary text' constraint mentioned by user ===")
# Not a colour check -- left as a structural reminder, verified separately in the HTML/CSS.
print("(verified structurally: no interactive nav target below 24px CSS height; no text below 13px)")
