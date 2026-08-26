#!/usr/bin/env bash
# Régénère le paramètre ?v= d'un ou plusieurs fichiers statiques et le
# propage dans tous les fichiers HTML/JS suivis par git qui les
# référencent — chantier S8 (5 août 2026).
#
# CE QUE CE SCRIPT CORRIGE. CLAUDE.md documentait une procédure manuelle :
# "à chaque modification, régénérer un timestamp et le propager dans
# tous les .html qui le référencent" -- correcte en intention, fragile en
# pratique (un site oublié à la propagation sert une version en cache
# indéfiniment, sans qu'aucune erreur ne le signale).
#
# GARDE-FOU : ancre chaque motif sur le guillemet ouvrant ('"' + nom du
# fichier), jamais le nom seul -- deux fichiers homonymes peuvent
# coexister à des chemins différents dans ce dépôt (heurix-search.js à
# la racine ET dans downloads/, deux widgets distincts) ; un motif non
# ancré aurait fait fuiter un bump de l'un vers les références de
# l'autre. Ne touche jamais heurix-site/ (résidu local non suivi par
# git, exclu de fait par git ls-files).
#
# USAGE (depuis n'importe où dans le dépôt) :
#   scripts/bust-cache.sh console.js
#   scripts/bust-cache.sh styles.css console.js heurix-search.js

set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage : $0 <fichier.js|.css> [<fichier2> ...]" >&2
  exit 1
fi

TIMESTAMP=$(date +%s)
RACINE="$(git rev-parse --show-toplevel)"
cd "$RACINE"

# sed -i portable : la syntaxe BSD (macOS) et GNU (Linux) diffèrent sur
# l'argument de suffixe de sauvegarde.
sed_inplace() {
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' -E "$1" "$2"
  else
    sed -i -E "$1" "$2"
  fi
}

for FICHIER in "$@"; do
  MOTIF=$(printf '%s' "$FICHIER" | sed 's/[.]/\\./g')
  # Ancré sur un guillemet ouvrant, éventuellement suivi de "../" AUTANT
  # DE FOIS QUE NÉCESSAIRE -- jamais un vrai sous-chemin comme
  # "downloads/", qui désigne un fichier distinct.
  #
  # LE "?" VALAIT 38 PAGES (26 août 2026). Il n'autorisait qu'un seul
  # niveau : vrai pour en/, faux dès que en/blog/ et en/solutions/ ont
  # existé, qui écrivent "../../styles.css". Ces 38 pages n'ont donc reçu
  # AUCUN bump depuis leur création -- un visiteur déjà venu y servait sa
  # feuille de style en cache indéfiniment. Le script annonçait "propagé
  # dans N fichier(s)" sans jamais dire lesquels lui échappaient.
  # Le groupe est EXTERNE : avec ((\.\./)*), \1 rend le préfixe entier ;
  # avec (\.\./)*, il ne rendrait que la dernière répétition et
  # transformerait "../../" en "../".
  ANCRE="\"((\\.\\./)*)${MOTIF}\\?v=[0-9]+"

  FICHIERS_TOUCHES=$(git ls-files --cached --others --exclude-standard "*.html" "*.js" | xargs grep -lE "$ANCRE" 2>/dev/null || true)

  if [ -z "$FICHIERS_TOUCHES" ]; then
    echo "⚠ $FICHIER : aucune référence \"${FICHIER}?v=...\" trouvée -- nom correct ? rien à faire." >&2
    continue
  fi

  VALEURS=$(echo "$FICHIERS_TOUCHES" | xargs grep -ohE "\"((\\.\\./)*)${MOTIF}\\?v=[0-9]+" | sed -E 's|^"(\.\./)*[^?]*||' | sort -u | wc -l)
  if [ "$VALEURS" -gt 1 ]; then
    echo "⚠ $FICHIER : $VALEURS valeurs ?v= DIFFÉRENTES déjà en place avant ce lancement --" >&2
    echo "  incohérence préexistante (précisément ce que ce script doit empêcher à l'avenir) :" >&2
    echo "$FICHIERS_TOUCHES" | sed 's/^/    /' >&2
  fi

  while IFS= read -r F; do
    sed_inplace "s|\"((\\.\\./)*)${MOTIF}\\?v=[0-9]+|\"\\1${FICHIER}?v=${TIMESTAMP}|g" "$F"
  done <<< "$FICHIERS_TOUCHES"

  NB=$(echo "$FICHIERS_TOUCHES" | grep -c .)
  echo "✓ $FICHIER -> ?v=${TIMESTAMP} propagé dans $NB fichier(s)"
done
