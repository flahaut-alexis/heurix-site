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

SOURCE="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/demo-boutique.js}"
ORIGINE="https://heurix.fr"

[[ -r "$SOURCE" ]] || { echo "garde-demo : $SOURCE illisible"; exit 2; }

extraire() { sed -n "s/.*var $1 = \"\([^\"]*\)\".*/\1/p" "$SOURCE" | head -1; }
API="$(extraire API)"
CLE="$(extraire CLE_PUBLIQUE)"
CAT="$(extraire CATALOGUE)"
# Le rayon est celui que demo/index.html demande vraiment (ligne « /v1/browse/ »).
RAYON="$(sed -n 's|.*"/v1/browse/" + CATALOGUE + "/\([a-z-]*\).*|\1|p' "$SOURCE" | head -1)"

for n in API CLE CAT RAYON; do
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

controle() {  # $1 libellé, $2 code attendu, $3.. curl
  local libelle="$1"; shift
  local code
  code="$(curl -s --max-time 25 -o "$TRAVAIL/r.json" -w '%{http_code}' "$@")"
  local n; n="$(compte "$TRAVAIL/r.json")"
  if [[ "$code" == "200" && "$n" != "-" && "$n" != "0" ]]; then
    printf '  OK      %-46s HTTP %s  total %s\n' "$libelle" "$code" "$n"
  else
    printf '  ECHEC   %-46s HTTP %s  total %s\n' "$libelle" "$code" "$n"
    head -c 200 "$TRAVAIL/r.json"; echo
    ECHECS=$((ECHECS + 1))
  fi
}

controle "recherche $CAT" \
  -X POST "$API/v1/index/$CAT/search" \
  -H "Authorization: Bearer $CLE" -H "Origin: $ORIGINE" \
  -H "Content-Type: application/json" -d '{"q":"vis","limit":3}'

controle "parcours $CAT/$RAYON" \
  "$API/v1/browse/$CAT/$RAYON" \
  -H "Authorization: Bearer $CLE" -H "Origin: $ORIGINE"

controle "widget de l'accueil (sans cle)" \
  -X POST "$API/v1/public-demo/search?vertical=outillage" \
  -H "Origin: $ORIGINE" -H "Content-Type: application/json" -d '{"q":"vis","limit":3}'

echo
if (( ECHECS )); then
  echo "garde-demo : $ECHECS controle(s) en echec -- la demonstration est cassee pour un visiteur."
  exit 1
fi
echo "garde-demo : les trois controles passent."
