#!/usr/bin/env bash
#
# Installe les crochets git versionnés de ce dépôt, en pointant `core.hooksPath`
# sur `scripts/hooks/`.
#
# LANCÉ TOUT SEUL PAR `npm install` ET `npm ci`, via le script `prepare` de
# `package.json`. Mesuré sur npm 11.16.0 : `prepare` tourne sur les deux.
#
# C'est ce qui répond à la limite nº 1 de `scripts/hooks/pre-push` -- « pas
# actif par défaut » --, et la réponse tient à un fait de méthode, pas à de la
# discipline : **on ne peut pas lancer la suite de tests sans `node_modules`,
# ni obtenir `node_modules` sans passer par npm.** Le geste qu'aucune session
# ne saute est donc exactement celui qui pose le crochet.
#
# À lancer à la main seulement si l'on n'est pas passé par npm :
#
#   scripts/installer-crochets.sh
#
# ─────────────────────────────────────────────────────────────────────────────
# CE QUE `prepare` NE FERME PAS. Un garde qui annonce sa portée vaut mieux
# qu'un garde qu'on croit total, et ces trois-là restent ouverts :
#
#   - `npm install --ignore-scripts` saute `prepare`. Le clone est complet, la
#     suite tourne, et aucun crochet n'est posé.
#   - Un `node_modules` recopié à la main depuis un autre clone ne déclenche
#     rien : il n'y a pas d'installation, donc pas de `prepare`.
#   - `git push --no-verify` contourne le crochet même posé. C'est la limite
#     nº 2, et `prepare` ne la touche pas.
#
# Les trois se referment par une protection de branche côté GitHub, et par
# rien d'autre : un crochet local est un rappel, jamais une porte.
# ─────────────────────────────────────────────────────────────────────────────
#
# APPELÉ DEPUIS `prepare`, IL EST SUIVI DE `|| true`, ET C'EST OBLIGATOIRE.
# Ce script sort en 1 quand PyYAML manque -- délibérément, pour que l'absence
# se découvre maintenant plutôt qu'au premier push refusé. Mais le job
# « Suite de tests » de la CI lance `npm ci` avec `setup-node` et **sans**
# `setup-python`, et aucun script tournant aujourd'hui en CI n'importe `yaml` :
# rien n'établit que PyYAML soit sur le runner. Sans le `|| true`, ce refus
# remonterait dans `npm ci` et ferait échouer le job de tests. Un garde qui
# casse ce qu'il protège.
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
