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
# fichier), jamais le nom seul -- un motif non ancré ferait fuiter le bump
# d'un fichier vers les références d'un homonyme situé ailleurs.
#
# CONSÉQUENCE À CONNAÎTRE, ce n'est pas une limite mais une contrainte de
# rangement : le motif accepte "../" répétés, jamais un sous-chemin. Un
# actif partagé entre plusieurs dossiers doit donc vivre dans leur ANCÊTRE
# COMMUN, sinon il sort du périmètre du versionnement en silence. C'est
# pourquoi demo-boutique.js et demo-boutique.css sont à la racine plutôt
# que dans demo/ : ils servent demo/ ET en/demo/, dont le seul ancêtre
# commun est la racine. Tant qu'ils étaient dans demo/, ce script n'en
# versionnait que la moitié des pages -- et annonçait « 2 fichier(s) »
# sans nommer les deux qui lui échappaient (26 août 2026).
#
# Aucun homonyme ne subsiste dans le dépôt à ce jour (vérifié le 26 août
# 2026, après suppression de heurix-search.js de la racine : un orphelin
# que rien ne chargeait, doublon d'un widget de downloads/).
#
# USAGE (depuis n'importe où dans le dépôt) :
#   scripts/bust-cache.sh console.js
#   scripts/bust-cache.sh styles.css console.js demo-boutique.js
#
# NE MARCHE PAS SUR downloads/ (mesuré le 26 août 2026). Lancer
# `bust-cache.sh heurix-search.js` -- ce que cette ligne proposait -- ne
# touche PAS les références réelles `"../downloads/heurix-search.js?v="`,
# qui portent un sous-chemin : il réécrit à la place les SNIPPETS DE
# DOCUMENTATION de docs.html et du guide de mise en route, où le même nom
# apparaît sans dossier parce qu'il désigne le fichier chez le client.
# Deux populations disjointes, dont le script ne voit que la mauvaise.
# Sans conséquence aujourd'hui (la clef du 25 août est postérieure aux
# dernières modifications des widgets), mais à savoir avant d'y toucher.

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

# COMPTE RENDU PAR ARGUMENT (27 août 2026, cinquième défaut de cet outil).
#
# Le script s'arrêtait EN SILENCE au premier avertissement, en multi-
# arguments. Mesuré :
#
#     $ scripts/bust-cache.sh styles.css search.js search-en.js
#     ✓ styles.css   -> propagé dans 122 fichier(s)
#     ✓ search.js    -> propagé dans 60 fichier(s)
#       ⚠ 8 référence(s) à "search.js" NON touchée(s) -- autre chemin :
#     $                              <- fin. Pas un mot sur search-en.js.
#
# `search-en.js` restait à son ancienne clef, et RIEN ne le disait -- ni
# « ✓ », ni « ⚠ », ni un code de sortie remarquable. Seul un contrôle de
# cohérence externe l'a montré, après coup.
#
# LA CAUSE : `set -euo pipefail` (ligne 44) plus le pipeline de
# l'avertissement, qui se termine par un `grep -vE`. Quand celui-ci filtre
# TOUT, il sort en 1 ; `pipefail` propage, `set -e` tue la boucle. Le `|| true`
# posé plus bas neutralise ce statut.
#
# CE QUI EST AJOUTÉ EN PLUS DU CORRECTIF, et qui compte davantage : le script
# rend maintenant compte de CHAQUE argument reçu, y compris pour dire qu'il
# ne l'a pas traité. Un correctif seul aurait refermé ce cas-ci ; le compte
# rendu ferme la famille -- toute sortie anticipée future se voit.
RECUS=$#
RENDUS=0
declare -a ABANDONNES=()
rendre_compte() {
  local statut=$?
  if [ "${#ABANDONNES[@]}" -gt 0 ]; then
    echo "" >&2
    echo "⚠ ${#ABANDONNES[@]} argument(s) reçu(s) et NON traité(s) : ${ABANDONNES[*]}" >&2
    echo "  Le script s'est arrêté avant eux (statut $statut). Relancez-les" >&2
    echo "  séparément, et vérifiez la cohérence des clefs avant de conclure." >&2
    exit 1
  fi
}

# La liste des arguments restants, recalculée à chaque tour : si le script
# meurt, le piège EXIT sait ce qui n'a pas été fait.
ARGS_RESTANTS=("$@")
trap rendre_compte EXIT

for FICHIER in "$@"; do
  ABANDONNES=("${ARGS_RESTANTS[@]}")
  MOTIF=$(printf '%s' "$FICHIER" | sed 's/[.]/\\./g')
  # Ancré sur un guillemet ouvrant, éventuellement suivi de "../" AUTANT
  # DE FOIS QUE NÉCESSAIRE.
  #
  # LE SOUS-DOSSIER EST DANS L'ARGUMENT (27 août 2026). La version
  # précédente excluait délibérément "downloads/" au motif qu'il désignait
  # un fichier distinct de l'homonyme de la racine. Vrai jusqu'au 26 août,
  # date à laquelle cet homonyme a été supprimé (4a028c1d) : l'exclusion a
  # survécu à sa raison d'être, et les 8 références réelles de
  # downloads/heurix-search.js sont restées hors de portée du script, qui
  # ne bumpait que les 4 extraits de documentation -- l'inverse exact de
  # ce qu'il fallait. Le chemin fait donc maintenant partie du nom qu'on
  # passe : "bust-cache.sh downloads/heurix-search.js" désigne ce
  # fichier-là et lui seul, à n'importe quelle profondeur de remontée.
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
    # RENDU COMPTE, meme si rien n'a ete fait : « rien a faire » est une
    # reponse sur cet argument. Ce qui doit rester invisible, c'est
    # l'argument dont le script ne dit RIEN.
    RENDUS=$((RENDUS + 1))
    ARGS_RESTANTS=("${ARGS_RESTANTS[@]:1}")
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

  # DIRE CE QU'ON N'A PAS TOUCHÉ. Un compte final ressemble à une preuve
  # de couverture alors qu'il ne compte que ce qui a été vu -- c'est ce
  # qui a masqué 38 pages en août. On compare donc au total des références
  # portant le même nom de fichier, quel que soit leur chemin.
  BASE=$(basename "$FICHIER")
  BASE_MOTIF=$(printf '%s' "$BASE" | sed 's/[.]/\\./g')
  TOTAL=$(git ls-files --cached --others --exclude-standard "*.html" "*.js" \
          | xargs grep -ohE "[^\"']*${BASE_MOTIF}\\?v=[0-9]+" 2>/dev/null | wc -l | tr -d ' ')
  VUES=$(echo "$FICHIERS_TOUCHES" | xargs grep -ohE "$ANCRE" 2>/dev/null | wc -l | tr -d ' ')
  echo "✓ $FICHIER -> ?v=${TIMESTAMP} propagé dans $NB fichier(s) ($VUES référence(s))"
  if [ "$TOTAL" -gt "$VUES" ]; then
    echo "  ⚠ $((TOTAL - VUES)) référence(s) à \"$BASE\" NON touchée(s) -- autre chemin :" >&2
    # `|| true` OBLIGATOIRE : quand `grep -vE` filtre tout, il sort en 1,
    # `pipefail` propage et `set -e` tue la boucle -- en silence, au milieu
    # des arguments. C'est le défaut que le compte rendu ci-dessus signale
    # désormais ; ceci l'empêche de se produire.
    git ls-files --cached --others --exclude-standard "*.html" "*.js" \
      | xargs grep -onE "[^\"']*${BASE_MOTIF}\\?v=[0-9]+" 2>/dev/null \
      | grep -vE "(\\.\\./)*${MOTIF}\\?v=" | sed 's/^/    /' >&2 || true
  fi
  RENDUS=$((RENDUS + 1))
  ARGS_RESTANTS=("${ARGS_RESTANTS[@]:1}")
done

ABANDONNES=()
echo "$RECUS argument(s) reçu(s), $RENDUS avec un compte rendu."
