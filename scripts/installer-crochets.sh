#!/usr/bin/env bash
#
# Installe les crochets git versionnés de ce dépôt, en pointant `core.hooksPath`
# sur `scripts/hooks/`.
#
# À LANCER UNE FOIS PAR CLONE. C'est la limite nº 1 de `scripts/hooks/pre-push`
# et elle ne peut pas être supprimée : `.git/` n'est pas versionné, et
# `core.hooksPath` est un réglage local. Aucun dépôt ne peut imposer un crochet
# à un clone qui ne l'a pas demandé -- c'est une propriété de git, pas un
# oubli.
#
#   scripts/installer-crochets.sh
#
# Ce que ça change : `git push` rejoue d'abord les contrôles de
# `.github/workflows/CI.yml` (19,4 s mesurées) et refuse de pousser s'ils
# échouent. Sur ce dépôt le push déclenche le déploiement, donc pousser rouge
# met le défaut en production -- onze fois entre le 21 et le 28 août 2026.
#
# Pour désinstaller :  git config --unset core.hooksPath
#
set -euo pipefail

RACINE="$(git rev-parse --show-toplevel)"
cd "$RACINE"

CHEMIN="scripts/hooks"
[ -d "$CHEMIN" ] || { echo "✗ $CHEMIN introuvable depuis $RACINE"; exit 1; }

chmod +x "$CHEMIN"/* 2>/dev/null || true

ACTUEL="$(git config core.hooksPath || true)"
if [ "$ACTUEL" = "$CHEMIN" ]; then
  echo "✓ core.hooksPath déjà réglé sur $CHEMIN -- rien à faire."
else
  if [ -n "$ACTUEL" ]; then
    echo "⚠ core.hooksPath valait « $ACTUEL » ; il est remplacé par « $CHEMIN »."
  fi
  git config core.hooksPath "$CHEMIN"
  echo "✓ core.hooksPath -> $CHEMIN"
fi

# VÉRIFIER QUE C'EST INSTALLÉ NE SUFFIT PAS : il faut que l'outillage du
# crochet soit là. Sans PyYAML, le crochet sort en 2 et REFUSE le push -- mieux
# vaut l'apprendre maintenant qu'au moment de pousser.
if python3 -c "import yaml" 2>/dev/null; then
  echo "✓ PyYAML présent -- le crochet peut lire CI.yml."
else
  echo "✗ PyYAML ABSENT. Le crochet refusera tout push (sortie 2)."
  echo "  Réparez :  python3 -m pip install pyyaml"
  exit 1
fi

echo
echo "Crochets actifs :"
for h in "$CHEMIN"/*; do
  [ -f "$h" ] && printf "  %-12s %s\n" "$(basename "$h")" "$([ -x "$h" ] && echo exécutable || echo 'NON EXÉCUTABLE')"
done
