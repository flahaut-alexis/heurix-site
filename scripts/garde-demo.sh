#!/usr/bin/env bash
# Garde de la démonstration publique : trois appels, trois mécanismes.
#
# POURQUOI ELLE N'A AUCUNE VALEUR À ELLE. La clé publique, le nom du
# catalogue, le rayon et l'URL de l'API sont EXTRAITS de demo-boutique.js.
# Une sonde qui porterait sa propre copie deviendrait une seconde source de
# vérité, à faire diverger de la première : la démo pourrait changer sans que
# la sonde suive, ce qui est exactement la panne qu'on répare. Une démo
# déplacée demain emmène sa sonde avec elle.
#
# POURQUOI TROIS APPELS. Ce sont trois mécanismes avec trois modes de panne :
#   1. la recherche du catalogue de la démo   -> clé, origine, propriété, quota
#   2. le parcours du même catalogue          -> EN PLUS, le palier Browse du
#      compte. Mesuré le 11 octobre 2026 : browse_plan='none' refuse AVANT le
#      contrôle de propriété, avec un message tout autre. La recherche peut
#      donc être verte et le parcours mort.
#      C'est AUSSI le seul des trois à porter l'assertion des facettes : lui
#      seul demande des clefs dont les décomptes sont figés quelque part.
#      Voir le commentaire de `facettes()`, qui dit pourquoi le widget de
#      l'accueil ne peut pas la porter.
#   3. /v1/public-demo/search, le widget de l'accueil -> route SANS clé,
#      épinglée sur public-demo. Elle survit à tout ce qui précède.
#
# CE QU'ELLE NE FAIT PAS, ET C'EST VOULU. Pas de clé d'administration : elle
# ouvrirait tous les catalogues de tous les clients à quiconque peut modifier
# ce fichier. Pas de /health : il rend « ok » sur un catalogue mort. Pas de
# public-demo à la place du catalogue de la démo -- c'est l'erreur des six
# sondes de deploy-complet.sh, qui sont restées vertes six semaines.
#
# Usage :  scripts/garde-demo.sh [chemin/vers/demo-boutique.js]
# Le chemin sert à l'éprouver : la pointer sur une copie dont le catalogue
# n'existe pas doit la faire rougir.
set -uo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-$RACINE/demo-boutique.js}"
ORIGINE="https://heurix.fr"
# La fixture des decomptes suit le DEPOT, et jamais le chemin donne en $1 :
# celui-la sert a eprouver la sonde sur une copie des valeurs de la DEMO, pas
# a lui fournir d'autres decomptes attendus.
FIXTURE="$RACINE/tests/heurix-rayon-facettes.test.js"

[[ -r "$SOURCE" ]] || { echo "garde-demo : $SOURCE illisible"; exit 2; }
[[ -r "$FIXTURE" ]] || { echo "garde-demo : fixture $FIXTURE illisible"; exit 2; }

extraire() { sed -n "s/.*var $1 = \"\([^\"]*\)\".*/\1/p" "$SOURCE" | head -1; }
API="$(extraire API)"
CLE="$(extraire CLE_PUBLIQUE)"
CAT="$(extraire CATALOGUE)"
# Le rayon est celui que demo/index.html demande vraiment (ligne « /v1/browse/ »).
RAYON="$(sed -n 's|.*"/v1/browse/" + CATALOGUE + "/\([a-z-]*\).*|\1|p' "$SOURCE" | head -1)"
# Les clefs de facette que la page du rayon demande VRAIMENT (« facets: [...] »
# dans demo-boutique.js), dans son ordre. Recopiees nulle part, comme le reste.
FACETTES="$(sed -n 's/.*facets: \[\([^]]*\)\].*/\1/p' "$SOURCE" | head -1 | tr -d ' "')"

for n in API CLE CAT RAYON FACETTES; do
  [[ -n "${!n}" ]] || { echo "garde-demo : $n introuvable dans $SOURCE"; exit 2; }
done

echo "lu dans $(basename "$SOURCE") : catalogue=$CAT  rayon=$RAYON  cle=${CLE:0:12}…"
echo

ECHECS=0
TRAVAIL="$(mktemp -d)"; trap 'rm -rf "$TRAVAIL"' EXIT

# Rend le `total` d'une réponse, ou "-" si le corps n'en porte pas.
compte() { python3 -c "
import json,sys
try: print(json.load(open(sys.argv[1])).get('total','-'))
except Exception: print('-')" "$1"; }

# Code HTTP du dernier controle. L'assertion de facettes le lit : elle n'a
# rien a dire d'un 403, dont le corps ne porte aucune facette.
CODE=""

controle() {  # $1 libellé, $2.. curl
  local libelle="$1"; shift
  local code
  code="$(curl -s --max-time 25 -o "$TRAVAIL/r.json" -w '%{http_code}' "$@")"
  CODE="$code"
  local n; n="$(compte "$TRAVAIL/r.json")"
  if [[ "$code" == "200" && "$n" != "-" && "$n" != "0" ]]; then
    printf '  OK      %-46s HTTP %s  total %s\n' "$libelle" "$code" "$n"
  else
    printf '  ECHEC   %-46s HTTP %s  total %s\n' "$libelle" "$code" "$n"
    head -c 200 "$TRAVAIL/r.json"; echo
    ECHECS=$((ECHECS + 1))
  fi
}

# L'ASSERTION DES FACETTES -- A LIRE AVANT DE LA DESSERRER (13 octobre 2026).
#
# POURQUOI ELLE EXISTE. Le 12 octobre a 15:19 cette garde etait verte --
# trois OK, 200 partout, totaux plausibles -- alors que le rail de facettes
# du rayon etait mort depuis seize heures. « HTTP 200 et total non nul » ne
# regarde pas les facettes : un rayon qui perd son rail garde ses 1987
# produits et sa page se charge. La panne de six semaines (403, catalogue
# sans proprietaire) tombait sous le controle precedent ; les 21 h 26 de
# 200-a-facettes-vides passaient dessous.
#
# DEUX CONDITIONS, PARCE QUE CE SONT DEUX QUESTIONS :
#
#   1. `facets_unknown` VIDE. La route ne rend que les clefs demandees et
#      nomme les manquantes (heurix/browse.py, `facets_unknown`). Elle
#      repond donc a « l'API a-t-elle RECONNU la clef ».
#
#   2. UN SEAU NON VIDE, compare a la fixture. Celle-la seule repond a « la
#      facette est-elle PEUPLEE ». Les deux ne se deduisent pas l'une de
#      l'autre : `attribute_index` est un SUR-ENSEMBLE des champs portes --
#      `remove_product` fait `pids.discard` et jamais `del`, donc un champ
#      dont le dernier porteur disparait y reste avec ses seaux a zero.
#      `facets_unknown` vide ne dira jamais non a ce champ-la ; le decompte,
#      si.
#
# LE DECOMPTE N'EST PAS ECRIT ICI. Il est lu dans
# `tests/heurix-rayon-facettes.test.js`, ou le vrai rayon visserie est fige
# depuis le 29 aout et ou la suite du site le tient honnete. Une copie dans
# cette sonde serait une seconde source de verite, a faire diverger de la
# premiere -- le defaut meme que cette garde repare. Le champ temoin n'est
# pas nomme ici non plus : c'est le premier de la fixture que la page du
# rayon demande.
#
# ELLE DEVIENDRA ROUGE SI LE CORPUS DE DEMONSTRATION EST REGENERE AUTREMENT
# QU'A LA GRAINE 42, et c'est voulu. Les decomptes de la fixture sont ceux de
# `deploy/generer_catalogue.py` (depot heurix-engine) a sa graine par defaut,
# 42 : « a graine egale, noms, descriptions, prix, stocks et identifiants
# sont identiques au bit pres » (son commentaire du 29 aout). Une autre
# graine, un autre `--nombre`, ou des produits indexes en plus, deplacent les
# trois decomptes de `famille` ensemble. Le rouge dit alors « le corpus a
# change », pas « la demo est cassee » : la reparation est de REMESURER le
# rayon et de corriger la fixture, qui est aussi ce que la suite du site
# attend -- pas de retirer l'assertion. Le meme rouge couvre une
# reindexation qui appauvrit le catalogue, et c'est le but.
#
# ET ROUGE AUSSI SI LA DEMO DEPLACE SON RAYON : la fixture ne porte de
# decomptes que pour celui qu'elle nomme, et l'extraction sort en 2
# (instrument) plutot que de comparer le nouveau rayon aux decomptes de
# l'ancien.
#
# ELLE NE PORTE QUE SUR LE PARCOURS. Le widget de l'accueil demande
# `categories` et `marque` ; `categories` est EXCLU de `attribute_index`
# (heurix/index.py, RESERVED_ATTRIBUTE_FIELDS), donc `facets_unknown:
# ["categories"]` y est le comportement PREVU -- la meme assertion y serait
# rouge en permanence, et figer les quatre clefs du rayon sur ce widget
# serait une erreur. Son total non nul reste tout ce qui y est defendable :
# le 845 qu'on lit ailleurs est une mesure datee du 11 septembre sur
# public-demo, que d'autres scripts reindexent, et non un invariant.
facettes() {  # $1 = corps de la reponse du parcours
  local msg rc
  # LE PYTHON ECRIT DANS UN FICHIER, PAS DANS UN « $( ) », et ce n'est pas un
  # gout : dans bash 3.2 -- celui de macOS, donc celui de qui eprouve cette
  # sonde a la main -- un document-ici DANS une substitution de commande fait
  # compter ses apostrophes par le parseur du shell. Un « c'est » dans un
  # commentaire python cassait tout le fichier a l'analyse (`bash -n`), loin
  # de la ligne fautive. Non mesure sur le bash 5 du runner, qui l'accepte
  # peut-etre : la forme ci-dessous tient dans les deux cas.
  python3 - "$1" "$FIXTURE" "$RAYON" "$FACETTES" > "$TRAVAIL/facettes.txt" <<'PY'
import json, re, sys

corps, fixture, rayon, demandees = sys.argv[1:5]
demandees = [c for c in demandees.split(",") if c]

# Le bloc de la fixture est nomme d'apres le rayon. Si la demo change de
# rayon, on ne trouve rien -- et c'est la bonne issue : comparer les
# facettes d'un rayon aux decomptes d'un autre serait une assertion verte
# par accident ou rouge sans raison.
nom = "FACETTES_" + rayon.upper().replace("-", "_")
bloc = re.search(r"const " + nom + r"\s*=\s*\{(.*?)\n\};", open(fixture, encoding="utf-8").read(), re.S)
if not bloc:
    print("%s ne porte pas de %s : la demo a-t-elle change de rayon ?" % (fixture, nom))
    raise SystemExit(2)

# Premier champ de la fixture que la page du rayon demande vraiment.
temoin = next(((c, v) for c, v in re.findall(r"(\w+):\s*(\{[^{}]*\})", bloc.group(1), re.S)
               if c in demandees), None)
if temoin is None:
    print("aucun champ de %s n'est demande par la demo (%s)" % (nom, ",".join(demandees)))
    raise SystemExit(2)
champ, attendu = temoin[0], json.loads(temoin[1])

try:
    rep = json.load(open(corps, encoding="utf-8"))
except Exception as e:
    print("corps du parcours illisible (%s)" % e)
    raise SystemExit(2)

# `facets_unknown` est ABSENTE quand elle n'a rien a dire, et `facets[champ]`
# absent quand le champ est connu mais sans porteur ici : les deux cas se
# lisent donc sur une CLE MANQUANTE, et pas sur une liste vide.
inconnues = rep.get("facets_unknown") or []
seaux = (rep.get("facets") or {}).get(champ) or {}

if inconnues:
    print("clef(s) non reconnues par l'API : %s" % ",".join(inconnues))
    raise SystemExit(1)
if not seaux:
    print("%s reconnue (hors facets_unknown) mais AUCUN seau : rail vide" % champ)
    raise SystemExit(1)
if seaux != attendu:
    print("%s = %s, la fixture attend %s"
          % (champ, json.dumps(seaux, ensure_ascii=False, sort_keys=True),
             json.dumps(attendu, ensure_ascii=False, sort_keys=True)))
    raise SystemExit(1)
print("%s %s" % (champ, json.dumps(attendu, ensure_ascii=False, sort_keys=True)))
PY
  rc=$?
  msg="$(cat "$TRAVAIL/facettes.txt")"
  case "$rc" in
    0) printf '  OK      %-46s %s\n' "facettes du parcours" "$msg" ;;
    1) printf '  ECHEC   %-46s %s\n' "facettes du parcours" "$msg"
       ECHECS=$((ECHECS + 1)) ;;
    # Sortie 2 : l'instrument ne sait pas repondre. Il le DIT et s'arrete,
    # au lieu de rendre un vert qui ne mesure rien.
    *) echo "garde-demo : facettes, instrument indisponible -- $msg"; exit 2 ;;
  esac
}

controle "recherche $CAT" \
  -X POST "$API/v1/index/$CAT/search" \
  -H "Authorization: Bearer $CLE" -H "Origin: $ORIGINE" \
  -H "Content-Type: application/json" -d '{"q":"vis","limit":3}'

controle "parcours $CAT/$RAYON" \
  "$API/v1/browse/$CAT/$RAYON?facets=$FACETTES" \
  -H "Authorization: Bearer $CLE" -H "Origin: $ORIGINE"

[[ "$CODE" == "200" ]] && facettes "$TRAVAIL/r.json"

controle "widget de l'accueil (sans cle)" \
  -X POST "$API/v1/public-demo/search?vertical=outillage" \
  -H "Origin: $ORIGINE" -H "Content-Type: application/json" -d '{"q":"vis","limit":3}'

echo
if (( ECHECS )); then
  echo "garde-demo : $ECHECS controle(s) en echec -- la demonstration est cassee pour un visiteur."
  exit 1
fi
echo "garde-demo : les trois controles passent, facettes du rayon comprises."
