#!/usr/bin/env bash
# Aligne les clefs de cache (?v=) de toutes les pages sur un horodatage
# unique. A lancer AVANT chaque commit qui touche styles.css ou un
# fichier .js.
#
# Pourquoi ce script existe : les clefs etaient posees a la main. Le 20
# aout 2026, dix versions coexistaient sur 276 references, dont 103
# datant du 25 juillet -- styles.css etait servi sous une clef perimee
# de deux jours et demi, rendant invisibles tous les correctifs visuels
# de la journee. Deux corrections manuelles ont ete necessaires en deux
# jours avant d'automatiser.
set -euo pipefail
cd "$(dirname "$0")"
VERSION=$(date +%s)
TOTAL=0
# DECOUVERTE AUTOMATIQUE plutot qu'enumeration (24 aout 2026, troisieme
# correction du perimetre). Le script listait *.html en/*.html, puis on y
# a ajoute blog/ le 22, puis en/blog/ dans la foulee -- et une revue
# externe a trouve qu'il restait solutions/, en/solutions/ et demo/, soit
# 114 references perimees.
#
# Trois corrections successives du meme defaut : le probleme n'etait pas
# les dossiers oublies, c'etait l'enumeration elle-meme. Un nouveau
# dossier de pages est desormais couvert sans toucher a ce fichier.
for f in $(find . -name '*.html' -not -path './node_modules/*' -not -path './.git/*'); do
  [ -f "$f" ] || continue
  N=$(grep -o '?v=[0-9]*' "$f" | wc -l | tr -d ' ' || true)
  if [ "$N" -gt 0 ]; then
    sed -i '' -E "s/\?v=[0-9]+/?v=$VERSION/g" "$f"
    TOTAL=$((TOTAL + N))
  fi
done
echo "Version : $VERSION"
echo "References mises a jour : $TOTAL"
# La verification balaie le MEME perimetre que la boucle. Avant, elle ne
# regardait que les dossiers enumeres : elle annoncait « une seule version
# dans tout le site » alors que 114 references etaient perimees ailleurs.
# Un message faussement rassurant est pire qu'un message absent.
RESTANTES=$(find . -name '*.html' -not -path './node_modules/*' -not -path './.git/*' -exec grep -oh '?v=[0-9]*' {} + | sort -u | wc -l | tr -d ' ')
if [ "$RESTANTES" -eq 1 ]; then
  echo "Verification : une seule version dans tout le site."
else
  echo "ATTENTION : $RESTANTES versions differentes subsistent."
  exit 1
fi
