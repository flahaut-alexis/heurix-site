#!/usr/bin/env python3
"""Latence de /v1/public-demo/search en PRODUCTION, vue depuis le poste qui lance.

    python3 scripts/mesure-latence-demo.py mesurer sortie.jsonl
    python3 scripts/mesure-latence-demo.py analyser sortie.jsonl

Relevé du 11 septembre 2026 : docs/MESURE-CHIFFRES-2026-09.md, données
brutes dans docs/mesures/latence-demo-2026-09-11.jsonl.

Ce que chaque colonne mesure :
- total_ms       : aller-retour complet vu du client, connexion HTTPS déjà
                   ouverte (ni TCP ni TLS), corps de réponse lu.
- health_ttfb    : premier octet d'un GET /health sur la même connexion, juste
                   avant la recherche : un aller-retour réseau, traitement
                   quasi nul.
- serveur_estime : ttfb(recherche) - ttfb(health). Estimation du temps passé
                   côté serveur (nginx + moteur). Résolution de quelques ms :
                   une valeur négative est du bruit réseau.

Coût : 3 sondes de taille (q vide, non journalisées) + 15 requêtes x 8
répétitions = 123 recherches. La démo n'a pas de quota par clé mais une limite
de 30 appels par minute et par IP (heurix/routers/public.py du moteur), d'où
une recherche toutes les 2,2 s. Chaque recherche non vide est journalisée dans
les analytics de la démo (clé __public_demo__). /health ne compte pour rien.
"""
import datetime
import http.client
import json
import ssl
import statistics as st
import sys
import time

HOTE = "api.heurix.fr"
PAS = 2.2
REPS = 8
CORPUS = {
    "outillage": ["vis", "vis inox m8", "M8x20", "boulno M8", "perceuse sans fil 18v"],
    "mode": ["pull", "pull col roulé rouge", "pul col rolé roug", "jean slim", "robe"],
    "outillage-en": ["screw", "stainless screw m8", "M8x20", "stainles screw", "cordless drill"],
}


def mesurer(chemin):
    out = open(chemin, "w")
    conn = http.client.HTTPSConnection(HOTE, context=ssl.create_default_context())
    n = 0

    def req(methode, route, corps=None):
        t0 = time.perf_counter()
        conn.request(methode, route, body=corps,
                     headers={"Content-Type": "application/json"} if corps else {})
        r = conn.getresponse()
        t_ttfb = time.perf_counter()
        data = r.read()
        return r.status, (t_ttfb - t0) * 1000, (time.perf_counter() - t0) * 1000, data

    def recherche(vertical, q, rep):
        nonlocal n
        _, h_ttfb, _, _ = req("GET", "/health")
        # Même corps que le widget de l'accueil (demo-search-live.js).
        corps = json.dumps({"q": q, "limit": 9, "offset": 0, "facets": ["categories", "marque"],
                            "exclude_description": True, "include_highlights": True})
        statut, ttfb, tot, data = req("POST", f"/v1/public-demo/search?vertical={vertical}", corps)
        n += 1
        try:
            total = json.loads(data).get("total")
        except ValueError:
            total = None
        out.write(json.dumps(dict(
            at=datetime.datetime.now().isoformat(timespec="seconds"), vertical=vertical, q=q, rep=rep,
            status=statut, total=total, octets=len(data), health_ttfb=round(h_ttfb, 2),
            ttfb=round(ttfb, 2), total_ms=round(tot, 2), serveur_estime=round(ttfb - h_ttfb, 2),
        ), ensure_ascii=False) + "\n")
        out.flush()
        if statut == 429:
            sys.exit(f"429 après {n} recherches")
        time.sleep(PAS)

    req("GET", "/health")  # ouvre TCP + TLS, hors mesure
    for v in CORPUS:
        recherche(v, "", 0)  # taille du corpus
    for rep in range(1, REPS + 1):
        for v, qs in CORPUS.items():
            for q in qs:
                recherche(v, q, rep)
    print("recherches envoyées :", n)


def analyser(chemin):
    L = [json.loads(l) for l in open(chemin)]
    S = [x for x in L if x["q"]]

    def pct(v, p):
        v = sorted(v)
        return v[min(len(v) - 1, int(round(p * (len(v) - 1))))]

    def ligne(nom, xs):
        t = [x["total_ms"] for x in xs]
        s = [x["serveur_estime"] for x in xs]
        print(f"{nom:<30} n={len(xs):>3}  total min/med/p90/max {min(t):6.1f} {st.median(t):6.1f} "
              f"{pct(t, .9):6.1f} {max(t):6.1f}  | serveur min/med/p90/max {min(s):6.1f} "
              f"{st.median(s):6.1f} {pct(s, .9):6.1f} {max(s):6.1f}")

    print("recherches :", len(L), "dont", len(L) - len(S), "sondes q vide ; statuts :",
          sorted({x["status"] for x in L}))
    for v in dict.fromkeys(x["vertical"] for x in S):
        ligne(v, [x for x in S if x["vertical"] == v])
    ligne("TOUT", S)
    for k in dict.fromkeys((x["vertical"], x["q"]) for x in S):
        xs = [x for x in S if (x["vertical"], x["q"]) == k]
        ligne(f"{k[0][:4]} {k[1][:24]} ({xs[0]['total']})", xs)
    print("serveur médian, 1re répétition :", st.median([x["serveur_estime"] for x in S if x["rep"] == 1]),
          "; suivantes :", st.median([x["serveur_estime"] for x in S if x["rep"] > 1]))
    for x in L:
        if not x["q"]:
            print("taille", x["vertical"], x["total"])


if __name__ == "__main__":
    {"mesurer": mesurer, "analyser": analyser}[sys.argv[1]](sys.argv[2])
