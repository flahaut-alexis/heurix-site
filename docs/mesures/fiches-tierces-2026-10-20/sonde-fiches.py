#!/usr/bin/env python3
"""Ce qu'un lecteur-machine peut lire sur une fiche produit publique.

LES DOMAINES NE SONT PAS ICI. Ce depot est public et ce relevé porte un
jugement sur des sites tiers : les six domaines sont nommes dans le compte
rendu de session du 20 octobre 2026, et ils figurent tous dans
`docs/mesures/prospects-analyse-75.json` du depot prive `heurix-engine`.
Ils se passent en arguments, un par un.

METHODE, identique a celle de docs/mesures/prospects-sonde-catalogues.py :
  - robots.txt lu AVANT tout et RESPECTE. Un Disallow est un echec consigne.
  - user-agent qui identifie Heurix et porte une adresse de contact.
  - UNE requete a la fois, globalement, >= 1 s entre deux. Aucun parallelisme.
  - GET seulement. Aucun nom, aucune adresse, aucune donnee personnelle.

CE QUE LA SONDE MESURE, par fiche :
  A  balisage produit structure present (schema.org/Product, JSON-LD ou microdata)
  B  prix lisible DANS ce balisage (nombre + devise)
  C  reference comme CHAMP (sku, mpn, gtin*) et non noyee dans le titre
  D  un montant en euros present dans le HTML servi, balise ou non
  E  disponibilite declaree dans le balisage

ET, sur robots.txt : ce que chaque robot nomme a le droit de lire. Lu par
RobotFileParser.can_fetch(<agent>, <url de la fiche>), pas a l'oeil.

La fiche est la PREMIERE URL, dans l'ordre du document, du premier sitemap de
produits trouve : un choix reproductible, pas un echantillon representatif.
"""
import gzip, io, json, re, sys, time, urllib.error, urllib.request
import urllib.robotparser as rp

UA = "HeurixAudit/1.0 (+https://heurix.fr; mesure interne; contact@heurix.fr)"
TIMEOUT = 25
MAX_OCTETS = 8 * 1024 * 1024
DELAI = 1.0
_derniere = [0.0]
requetes = [0]

AGENTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot",
          "PerplexityBot", "Google-Extended", "Googlebot", "Bingbot", "CCBot",
          "Applebot-Extended", "meta-externalagent"]

LOC = re.compile(rb"<loc>\s*([^<\s]+)\s*</loc>", re.I)
PREFIXES_PRODUIT = ("product", "produit", "article", "catalog", "item", "shop")
# LES FORMES D'URL QUI DESIGNENT UNE FICHE. Les trois dernieres sont RELEVEES
# sur les sitemaps reellement lus, jamais devinees : `-pNNN` et `/pNNN-` par la
# sonde du 9 octobre (deux boutiques, relevee dans le depot prive),
# `/fiche-article/` sur le site E le 20 octobre, `/prNNN/` sur le site C le
# meme jour. Les lettres renvoient au tableau de RELEVE.md.
CHEMIN_PRODUIT = re.compile(
    r"(/produits?/|/products?/|/articles?/|/fiche-article/|/dp/"
    r"|-p\d+(\.html?)?$|/p\d+-|/p/|/pr\d+/)", re.I)
# UNE RACINE DE RAYON N'EST PAS UNE FICHE, et un sitemap de produits en porte.
# Mesure du 20 octobre : la premiere URL du sitemap de produits du site D
# est `/boutique/`, la page d'accueil de la boutique. Prise pour une fiche,
# elle fait conclure « aucun balisage produit » sur une page qui n'a aucune
# raison d'en porter. C'est le defaut que cette liste ferme.
RACINE_RAYON = re.compile(
    r"^https?://[^/]+/(boutique|shop|produits?|products?|catalogue|categorie)/?$", re.I)
EURO = re.compile(r"(\d[\d  .,]{0,9})\s*(?:€|&euro;|EUR\b)|(?:€|EUR\s)\s*\d")


def pause():
    ecart = time.time() - _derniere[0]
    if ecart < DELAI:
        time.sleep(DELAI - ecart)
    _derniere[0] = time.time()


def get(url):
    pause()
    requetes[0] += 1
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        brut = r.read(MAX_OCTETS)
        enc = (r.headers.get("Content-Encoding") or "").lower()
        fin, code, ctype = r.geturl(), r.getcode(), r.headers.get("Content-Type", "")
    if enc == "gzip" or brut[:2] == b"\x1f\x8b":
        try:
            brut = gzip.decompress(brut)
        except Exception:
            try:
                brut = gzip.GzipFile(fileobj=io.BytesIO(brut)).read()
            except Exception:
                pass
    return code, fin, brut, ctype


def annonce_des_produits(url):
    nom = url.rsplit("/", 1)[-1].lower()
    jetons = [j for j in re.split(r"[^a-z0-9]+", nom) if j]
    return any(j.startswith(p) for j in jetons for p in PREFIXES_PRODUIT)


def objets_jsonld(html):
    """Tous les objets JSON-LD, @graph aplati."""
    out = []
    for m in re.finditer(
            rb"<script[^>]+application/ld\+json[^>]*>(.*?)</script>", html, re.S | re.I):
        txt = m.group(1).decode("utf-8", "replace").strip()
        txt = re.sub(r"^<!--|-->$", "", txt).strip()
        try:
            d = json.loads(txt)
        except Exception:
            continue
        pile = [d]
        while pile:
            x = pile.pop()
            if isinstance(x, list):
                pile.extend(x)
            elif isinstance(x, dict):
                out.append(x)
                if "@graph" in x:
                    pile.append(x["@graph"])
                for k in ("mainEntity", "itemOffered", "offers", "hasVariant"):
                    if k in x:
                        pile.append(x[k])
    return out


def est_produit(o):
    t = o.get("@type")
    t = t if isinstance(t, list) else [t]
    return any(isinstance(x, str) and x.split("/")[-1] == "Product" for x in t)


def analyse(html):
    r = {}
    objs = objets_jsonld(html)
    prods = [o for o in objs if est_produit(o)]
    r["blocs_jsonld"] = len(objs)
    r["types_jsonld"] = sorted({
        str(o.get("@type")) for o in objs if o.get("@type")})[:12]
    r["produit_jsonld"] = bool(prods)
    micro = re.search(rb'itemtype=["\']https?://schema\.org/Product["\']', html, re.I)
    r["produit_microdata"] = bool(micro)
    r["A_balisage_produit"] = bool(prods or micro)

    prix, devise, dispo, ref = None, None, None, {}
    for p in prods:
        offres = p.get("offers")
        offres = offres if isinstance(offres, list) else [offres] if offres else []
        for o in offres:
            if not isinstance(o, dict):
                continue
            for cle in ("price", "lowPrice", "highPrice"):
                if o.get(cle) not in (None, ""):
                    prix = prix if prix is not None else o[cle]
            devise = devise or o.get("priceCurrency")
            dispo = dispo or o.get("availability")
            spec = o.get("priceSpecification")
            spec = spec if isinstance(spec, list) else [spec] if spec else []
            for s in spec:
                if isinstance(s, dict):
                    if prix is None and s.get("price") not in (None, ""):
                        prix = s["price"]
                    devise = devise or s.get("priceCurrency")
        for cle in ("sku", "mpn", "gtin", "gtin13", "gtin12", "gtin8", "productID"):
            if p.get(cle) not in (None, ""):
                ref[cle] = str(p[cle])[:40]
        n = p.get("name")
        if isinstance(n, str) and "nom_produit" not in r:
            r["nom_produit"] = n[:90]
            r["nom_produit_longueur"] = len(n)
        b = p.get("brand")
        if isinstance(b, dict):
            b = b.get("name")
        if isinstance(b, str) and "marque" not in r:
            r["marque"] = b[:40]
    if not prods and micro:
        mp = re.search(rb'itemprop=["\']price["\'][^>]*content=["\']([^"\']+)', html, re.I)
        if mp:
            prix = mp.group(1).decode("utf-8", "replace")
        md = re.search(rb'itemprop=["\']priceCurrency["\'][^>]*content=["\']([^"\']+)', html, re.I)
        if md:
            devise = md.group(1).decode("utf-8", "replace")
        ms = re.search(rb'itemprop=["\'](sku|mpn|gtin13)["\'][^>]*content=["\']([^"\']+)', html, re.I)
        if ms:
            ref[ms.group(1).decode()] = ms.group(2).decode("utf-8", "replace")[:40]

    nom = (r.get("nom_produit") or "").lower()
    r["reference_aussi_dans_le_nom"] = sorted(
        c for c, v in ref.items() if v and v.lower() in nom) or None
    r["B_prix_dans_balisage"] = prix is not None
    r["prix_balise"] = str(prix)[:24] if prix is not None else None
    r["devise_balisee"] = devise
    r["C_reference_champ"] = bool(ref)
    r["reference_champs"] = ref
    r["E_disponibilite"] = str(dispo)[:60] if dispo else None

    # D : un montant en euros dans le HTML SERVI (hors scripts et styles).
    visible = re.sub(rb"<(script|style)[^>]*>.*?</\1>", b" ", html, flags=re.S | re.I)
    visible = re.sub(rb"<[^>]+>", b" ", visible)
    txt = visible.decode("utf-8", "replace")
    r["D_euro_dans_le_html"] = bool(EURO.search(txt))
    r["octets_html"] = len(html)
    return r


def un(domaine):
    r = {"domaine": domaine, "robots": {}, "droits": {}, "fiche": None,
         "sitemap_produits": None, "echec": None, "requetes": 0}
    d0 = requetes[0]
    corps_robots, base = None, None
    for hote in ("https://" + domaine, "https://www." + domaine):
        try:
            code, fin, corps, _ = get(hote + "/robots.txt")
            base = "/".join(fin.split("/")[:3])
            corps_robots = corps
            r["robots"] = {"url": fin, "code": code, "octets": len(corps)}
            break
        except urllib.error.HTTPError as e:
            r["robots"] = {"url": hote + "/robots.txt", "code": e.code}
            if e.code == 404:
                base, corps_robots = hote, b""
                break
        except Exception as e:
            r["robots"].setdefault("tentatives", []).append(f"{hote}: {type(e).__name__}")
    if base is None:
        r["echec"] = "robots.txt injoignable"
        r["requetes"] = requetes[0] - d0
        return r

    robots = rp.RobotFileParser()
    robots.set_url(base + "/robots.txt")
    try:
        robots.parse(corps_robots.decode("utf-8", "replace").splitlines())
    except Exception:
        robots.parse([])

    # NOMME N'EST PAS AUTORISE. can_fetch rend True par defaut quand aucune
    # regle ne vise l'agent : la question « ce site a-t-il DECIDE quelque chose
    # pour ce robot » se lit dans le texte, pas dans le verdict.
    txt_robots = corps_robots.decode("utf-8", "replace").lower()
    r["agents_nommes"] = [a for a in AGENTS if a.lower() in txt_robots]
    r["groupes_user_agent"] = len(re.findall(r"(?mi)^\s*user-agent\s*:", txt_robots))

    sitemaps = list(robots.site_maps() or [])
    r["sitemaps_declares"] = sitemaps[:6]

    # Le sitemap de produits. Un seul niveau d'index suivi.
    candidats = [s for s in sitemaps]
    if not candidats:
        candidats = [base + "/sitemap.xml"]
    fiche_url, sm_produits = None, None
    for s in candidats[:4]:
        if not robots.can_fetch(UA, s):
            r.setdefault("refus", []).append(f"Disallow sur {s}")
            continue
        try:
            _, _, corps, _ = get(s)
        except Exception as e:
            r.setdefault("refus", []).append(f"{s}: {type(e).__name__}")
            continue
        locs = [l.decode("utf-8", "replace") for l in LOC.findall(corps)]
        if b"<sitemap>" in corps.lower() or b"<sitemapindex" in corps.lower():
            enfants = [l for l in locs if annonce_des_produits(l)] or locs
            for e in enfants[:3]:
                if not robots.can_fetch(UA, e):
                    r.setdefault("refus", []).append(f"Disallow sur {e}")
                    continue
                try:
                    _, _, c2, _ = get(e)
                except Exception as ex:
                    r.setdefault("refus", []).append(f"{e}: {type(ex).__name__}")
                    continue
                l2 = [x.decode("utf-8", "replace") for x in LOC.findall(c2)]
                fiches = [x for x in l2 if CHEMIN_PRODUIT.search(x) and not RACINE_RAYON.match(x)]
                r.setdefault("locs_vus", {})[e] = {"n": len(l2), "exemples": l2[:4]}
                if fiches:
                    sm_produits, fiche_url = e, fiches[0]
                    break
        else:
            fiches = [x for x in locs if CHEMIN_PRODUIT.search(x) and not RACINE_RAYON.match(x)]
            r.setdefault("locs_vus", {})[s] = {"n": len(locs), "exemples": locs[:4]}
            if fiches:
                sm_produits, fiche_url = s, fiches[0]
        if fiche_url:
            break

    r["sitemap_produits"] = sm_produits
    if not fiche_url:
        r["echec"] = "aucune URL de fiche trouvee dans les sitemaps lus"
        r["requetes"] = requetes[0] - d0
        return r

    r["fiche_url"] = fiche_url
    for a in AGENTS:
        try:
            r["droits"][a] = robots.can_fetch(a, fiche_url)
        except Exception:
            r["droits"][a] = None
    r["droits"]["HeurixAudit"] = robots.can_fetch(UA, fiche_url)

    if not robots.can_fetch(UA, fiche_url):
        r["echec"] = "Disallow sur la fiche pour notre user-agent — consigne, non contourne"
        r["requetes"] = requetes[0] - d0
        return r
    try:
        code, fin, html, ctype = get(fiche_url)
    except urllib.error.HTTPError as e:
        r["echec"] = f"fiche: HTTP {e.code}"
        r["requetes"] = requetes[0] - d0
        return r
    except Exception as e:
        r["echec"] = f"fiche: {type(e).__name__}"
        r["requetes"] = requetes[0] - d0
        return r
    r["fiche"] = {"code": code, "url_finale": fin, "content_type": ctype, **analyse(html)}
    r["requetes"] = requetes[0] - d0
    return r


if __name__ == "__main__":
    domaines = sys.argv[1:]
    if not domaines:
        print("usage: sonde-fiches.py <domaine> [...]", file=sys.stderr)
        sys.exit(2)
    sortie = {"date": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "user_agent": UA,
              "delai_s": DELAI, "domaines": domaines, "resultats": []}
    for d in domaines:
        print(f"-- {d}", file=sys.stderr, flush=True)
        sortie["resultats"].append(un(d))
    sortie["requetes_totales"] = requetes[0]
    print(json.dumps(sortie, ensure_ascii=False, indent=2))
