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
for f in *.html en/*.html blog/*.html en/blog/*.html; do
  [ -f "$f" ] || continue
  N=$(grep -o '?v=[0-9]*' "$f" | wc -l | tr -d ' ' || true)
  if [ "$N" -gt 0 ]; then
    sed -i '' -E "s/\?v=[0-9]+/?v=$VERSION/g" "$f"
    TOTAL=$((TOTAL + N))
  fi
done
echo "Version : $VERSION"
echo "References mises a jour : $TOTAL"
RESTANTES=$(grep -roh '?v=[0-9]*' *.html en/*.html blog/*.html en/blog/*.html | sort -u | wc -l | tr -d ' ')
if [ "$RESTANTES" -eq 1 ]; then
  echo "Verification : une seule version dans tout le site."
else
  echo "ATTENTION : $RESTANTES versions differentes subsistent."
  exit 1
fi
