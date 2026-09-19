"""Juge banc.json : pour chaque requete, l'ensemble attendu est un predicat
sur les fiches (T ci-dessous). Rend, pour le natif et pour le module : total,
premier resultat juste ou non, attendus sur la premiere page (12).

    python3 juger.py <dossier-resultats> [catalogue-177.json]

Il lit banc.json, que produit php/banc.php sur une boutique ou notre module
est installe (colonne module) ; les regles de T sont lisibles sans lui.

Les requetes et 86 fiches sur 177 sont les notres : le compte
global n'est pas un taux, seulement une liste de cas.
"""
import json,re,sys,unicodedata
from pathlib import Path
S=sys.argv[1]
b=json.load(open(S+"/banc.json")); cat={f['id']:f for f in json.load(open(sys.argv[2] if len(sys.argv)>2 else Path(__file__).parent/"catalogue.json"))}
def n(s): return unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
def nom(p): return lambda f: re.search(p,n(f['name'])) is not None
M8X20=nom(r'hexagonale m8x20 inox a2')
T={
 'rondelle':nom(r'^rondelle'),'rondele':nom(r'^rondelle'),'rondelles':nom(r'^rondelle'),'rondlle':nom(r'^rondelle'),'rondell':nom(r'^rondelle'),
 'M8':nom(r'\bm8\b|\bm8[x-]'),'M8x20':M8X20,'M8 x 20':M8X20,'M8-20':M8X20,'M8 20':M8X20,'M8x25':nom(r'm8 x 25'),
 'M10x30':nom(r'm10 x 30'),'M10 x 30':nom(r'm10 x 30'),
 'DIN 933':nom(r'din 933'),'DIN933':nom(r'din 933'),'DIN 934':nom(r'din 934'),'DIN 125':nom(r'din 125'),'din 127':nom(r'din 127'),
 '6205-2RS':nom(r'6205-2rs'),'6205 2RS':nom(r'6205-2rs'),'62052RS':nom(r'6205-2rs'),'6205-2rs':nom(r'6205-2rs'),'6205 2rs':nom(r'6205-2rs'),'6205':nom(r'6205'),
 'vis inox M8 20':M8X20,'vis inox M8x20':M8X20,'vis inox m8x20 a2':M8X20,'vis inox A4 M10':nom(r'^vis.*m10 .*a4'),
 'ecrou M8':nom(r'^ecrou.*\bm8\b'),'écrou inox':nom(r'^ecrou.*inox'),'ecrou nylstop':nom(r'nylstop'),
 'vis tete fraisee':nom(r'^vis.*tete fraisee'),'vis tête fraisée':nom(r'^vis.*tete fraisee'),'vis 6 pans':nom(r'^vis.*tete hexagonale'),'vis CHC':nom(r'\bchc\b'),'hexagonale':nom(r'hexagonal'),
 'cheville':nom(r'chevill'),'chevile':nom(r'chevill'),'chevilles fischer':lambda f: 'chevill' in n(f['name']) and 'fischer' in n(f['name']+f['brand']),
 'fisher':lambda f:'fischer' in n(f['name']+' '+f['brand']),'fischr':lambda f:'fischer' in n(f['name']+' '+f['brand']),
 'vis placo':nom(r'placo'),'vis placco':nom(r'placo'),'vis terrasse inox':lambda f:'terrasse' in n(f['name']) and 'inox' in n(f['name']+f['desc']),
 'tige filetee':nom(r'tige filetee'),'roulement':nom(r'^roulement'),'roulemnt':nom(r'^roulement'),'roulements 6205':nom(r'^roulement.*6205'),
 'zzzzzz':lambda f:False,'pneu':lambda f:False,'marteau':lambda f:False,
}
lignes=[]
for r in b[:-1]:
    q=r['q']; t=T[q]; att=sum(1 for f in cat.values() if t(f))
    row=[q,att]
    for mode in ('natif','module'):
        x=r[mode]; p=x['page1']; tot=x['total'] or 0
        p1 = ('oui' if p and t(cat[p[0]]) else ('vide' if not p else 'non'))
        row += [tot, p1, sum(1 for i in p if t(cat[i]))]
    lignes.append(row)
print(f"{'requete':20} att | {'natif tot':>9} {'1er':>4} {'p1':>3} | {'heurix tot':>10} {'1er':>4} {'p1':>3}")
for q,a,nt,n1,np,ht,h1,hp in lignes: print(f"{q:20} {a:3} | {nt:9} {n1:>4} {np:3} | {ht:10} {h1:>4} {hp:3}")
json.dump(lignes,open(S+"/jugement.json","w"),ensure_ascii=False)
