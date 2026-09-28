#!/usr/bin/env bash
#
# CE QUE WORDPRESS FAIT DE L'EN-TÊTE DE DÉPENDANCE DU MODULE, par version.
#
# Lancer :  tests/requires-plugins/mesure.sh 5.9.18 mysql
#           tests/requires-plugins/mesure.sh 6.4.5  sqlite
#           tests/requires-plugins/mesure.sh 7.1.2  sqlite
#           HX_PHP=/opt/homebrew/opt/php@8.1/bin/php tests/requires-plugins/mesure.sh 5.9.18 mysql
#
# ─────────────────────────────────────────────────────────────────────────────
# POURQUOI CE SCRIPT EXISTE. wordpress.org a demandé l'en-tête `Requires
# Plugins` à la revue du 26 septembre 2026. Il est appliqué depuis WordPress
# 6.5 ; notre borne basse est 5.9, mesurée, et la documentation officielle
# (plugin-basics/header-requirements/) ne dit RIEN de ce que font les versions
# antérieures. « Ignoré en silence » était une déduction de lecture de source
# jusqu'ici, pas une mesure -- et c'est de cette déduction que dépend la
# question « peut-on retirer le garde `class_exists( 'WooCommerce' )` ? ».
# La réponse est non, et elle se rejoue par ce script.
#
# CE QU'IL MESURE, EN DEUX TEMPS.
#
#   1. LA VERSION. Un plugin témoin qui ne porte que l'en-tête, WooCommerce
#      ABSENT, et on demande son activation. Sous 6.5 elle doit réussir (et le
#      code du témoin tourner) ; à partir de 6.5 elle doit être refusée.
#      C'est le témoin croisé : si les trois versions rendaient la même chose,
#      l'instrument serait aveugle et le relevé ne vaudrait rien.
#
#   2. LA RÉSOLUTION, sur une version qui applique. La dépendance est résolue
#      par le NOM DU DOSSIER installé (`WP_Plugin_Dependencies::convert_to_slug`
#      est `dirname( $plugin_file )`), pas par WooCommerce. Un WooCommerce
#      fonctionnel dans un dossier nommé autrement rend la dépendance non
#      satisfaite alors que `class_exists( 'WooCommerce' )` est vraie. Et un
#      plugin DÉJÀ ACTIF dont la dépendance devient non satisfaite n'est PAS
#      désactivé : c'est ce qui dit que l'en-tête ne coûte rien au parc
#      installé, seulement aux activations neuves.
#
# CE QUI SE VERSIONNE, ET CE QUI SE TÉLÉCHARGE. Ce fichier et les relevés, et
# rien d'autre. Les WordPress (20 à 37 Mo chacun) et wp-cli.phar vivent dans le
# cache HORS du dépôt de scripts/plugin-check.sh, et sont réutilisés :
#
#     curl -fsSL -o ~/.cache/heurix-woocommerce/plugin-check/wordpress-5.9.18.zip \
#       https://downloads.wordpress.org/release/wordpress-5.9.18.zip
#
# LE PHP EST CELUI QU'ON EXERCE, PAS CELUI DU PATH. WordPress 5.9 ne tourne pas
# sous PHP 8.5 : `HX_PHP` choisit l'interpréteur, et le relevé le nomme. C'est
# la même leçon que `tests/banc-disjoncteur/banc.py`, où le banc lançait le php
# du PATH pendant qu'on écrivait « 8.1 ».
#
# LA BASE N'EST PAS LA MÊME PARTOUT. Le drop-in SQLite officiel
# (sqlite-database-integration 3.0.2) déclare `Requires at least: 6.4` : sous
# 6.4 il faut un vrai serveur, d'où `mysql`, qui démarre une MariaDB jetable
# sur une socket dans un répertoire temporaire. Le relevé dit laquelle a servi,
# parce qu'une mesure prise sur une autre base n'est pas la même mesure.
#
# CE QU'IL NE MESURE PAS. Les écrans d'admin où un avis sort : c'est du code à
# nous, et tests/test-avis-woocommerce-manquant.php le garde à chaque commit,
# dans les deux sens. Ici on ne mesure que WordPress.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

V="${1:-}"
BASE="${2:-sqlite}"
if [ -z "$V" ]; then
  echo "usage : tests/requires-plugins/mesure.sh <version-wordpress> [mysql|sqlite]" >&2
  exit 2
fi

CACHE="${HEURIX_PC_CACHE:-$HOME/.cache/heurix-woocommerce/plugin-check}"
PHP="${HX_PHP:-php}"
PHAR="$CACHE/wp-cli-2.12.0.phar"
ZIP="$CACHE/wordpress-$V.zip"
SQLITE_ZIP="$CACHE/sqlite-database-integration-3.0.2.zip"

for F in "$PHAR" "$ZIP"; do
  if [ ! -r "$F" ]; then
    echo "mesure : $F manquant. Voir l'en-tête de ce script pour le curl." >&2
    exit 2
  fi
done
if [ "$BASE" = sqlite ] && [ ! -r "$SQLITE_ZIP" ]; then
  echo "mesure : $SQLITE_ZIP manquant (drop-in SQLite, WordPress 6.4 et plus)." >&2
  exit 2
fi

T="$(mktemp -d)"
WP="$T/wp"
MPID=""
# Le PID plutôt que `%1` : pas de contrôle de tâches dans un script non
# interactif, et un `kill %1` qui échoue laisserait la MariaDB derrière lui.
trap '[ -n "$MPID" ] && kill "$MPID" 2>/dev/null; rm -rf "$T"' EXIT

unzip -q "$ZIP" -d "$T"
mv "$T/wordpress" "$WP"

wp() { "$PHP" -d error_reporting="E_ALL & ~E_DEPRECATED" "$PHAR" --path="$WP" "$@"; }

if [ "$BASE" = sqlite ]; then
  unzip -q -o "$SQLITE_ZIP" -d "$WP/wp-content/plugins"
  S="$WP/wp-content/plugins/sqlite-database-integration"
  sed -e "s#{SQLITE_IMPLEMENTATION_FOLDER_PATH}#$S#g" \
      -e "s#{SQLITE_PLUGIN}#sqlite-database-integration/load.php#g" \
      "$S/db.copy" > "$WP/wp-content/db.php"
  wp config create --dbname=hx --dbuser=hx --dbpass= --skip-check --quiet
else
  mariadb-install-db --datadir="$T/mysql" --auth-root-authentication-method=normal >/dev/null 2>&1
  mariadbd --datadir="$T/mysql" --socket="$T/my.sock" --skip-networking --skip-grant-tables \
    >"$T/mysqld.log" 2>&1 &
  MPID=$!
  for _ in $(seq 1 120); do [ -S "$T/my.sock" ] && break; sleep 0.5; done
  if [ ! -S "$T/my.sock" ]; then
    echo "mesure : mariadbd n'a pas démarré. Rien n'est mesuré." >&2
    tail -5 "$T/mysqld.log" >&2
    exit 2
  fi
  mariadb --socket="$T/my.sock" -u root -e "CREATE DATABASE hx;"
  wp config create --dbname=hx --dbuser=root --dbpass= --dbhost="localhost:$T/my.sock" \
    --skip-check --quiet
fi

wp core install --url=http://hx.invalid --title=mesure --admin_user=a --admin_password=a \
  --admin_email=a@example.invalid --skip-email --quiet

# LE TÉMOIN NE PORTE QUE L'EN-TÊTE. Pas le module : on mesure WordPress, et le
# module y ajouterait son propre garde, donc son propre résultat.
mkdir -p "$WP/wp-content/plugins/hx-temoin"
cat > "$WP/wp-content/plugins/hx-temoin/hx-temoin.php" <<'PHP'
<?php
/** Plugin Name: HX temoin dependance
 *  Version: 0.0.1
 *  Requires Plugins: woocommerce
 */
add_action( 'admin_notices', function () { echo '<div class="notice"><p>HX temoin charge</p></div>'; } );
PHP

echo "############ WordPress $(wp core version)   base=$BASE   PHP $("$PHP" -r 'echo PHP_VERSION;')"
echo
echo "== 1. la version : WooCommerce absent, un temoin qui ne porte que l'en-tete"
echo "   WooCommerce installe   : $(wp plugin list --field=name | grep -cx woocommerce || true)"
# shellcheck disable=SC2016  # du PHP : $d, $r, $all sont des variables PHP, pas du shell.
wp eval '
require_once ABSPATH."wp-admin/includes/plugin.php";
$d = get_plugin_data( WP_PLUGIN_DIR."/hx-temoin/hx-temoin.php", false, false );
echo "   cle RequiresPlugins    : ", array_key_exists("RequiresPlugins",$d) ? "presente (".var_export($d["RequiresPlugins"],true).")" : "ABSENTE de la liste des en-tetes", "\n";
echo "   WP_Plugin_Dependencies : ", class_exists("WP_Plugin_Dependencies") ? "existe" : "n existe pas", "\n";
$r = validate_plugin_requirements("hx-temoin/hx-temoin.php");
echo "   validate_plugin_req.   : ", is_wp_error($r) ? "WP_Error ".$r->get_error_code()." / ".trim(preg_replace("/\s+/"," ",wp_strip_all_tags($r->get_error_message()))) : "aucune erreur", "\n";
$all = get_plugins();
echo "   get_plugins() rend     : ", implode(", ", array_keys($all["hx-temoin/hx-temoin.php"])), "\n";'
# SANS --quiet : le message du refus est ce que le marchand lit, et c'est lui
# qu'on veut dans le releve, pas seulement « refusee ».
echo -n "   activation             : "
if SORTIE_ACT="$(wp plugin activate hx-temoin 2>&1)"; then
  echo "REUSSIE"
else
  echo "REFUSEE"
  printf '%s\n' "$SORTIE_ACT" | sed 's/^/     | /'
fi
echo -n "   statut                 : "; wp plugin list --name=hx-temoin --field=status
# shellcheck disable=SC2016  # du PHP : $d, $r, $all sont des variables PHP, pas du shell.
wp eval '
require_once ABSPATH."wp-admin/includes/screen.php"; require_once ABSPATH."wp-admin/includes/template.php";
set_current_screen("dashboard"); ob_start(); do_action("admin_notices"); $h = trim(ob_get_clean());
echo "   son code tourne        : ", "" === $h ? "non (rien sur admin_notices)" : "oui", "\n";'

echo
echo "== 2. la resolution : par le NOM DU DOSSIER, pas par WooCommerce"
mkdir -p "$WP/wp-content/plugins/woocommerce"
cat > "$WP/wp-content/plugins/woocommerce/woocommerce.php" <<'PHP'
<?php
/** Plugin Name: WooCommerce (doublure de mesure)
 *  Version: 11.1.2
 */
class WooCommerce {}
PHP
wp plugin activate woocommerce --quiet
echo -n "   dossier « woocommerce » actif, activation du temoin : "
if wp plugin activate hx-temoin --quiet 2>"$T/err"; then echo "REUSSIE"; else echo "REFUSEE"; fi
wp plugin deactivate woocommerce --quiet
mv "$WP/wp-content/plugins/woocommerce" "$WP/wp-content/plugins/woocommerce-4-2-fork"
wp plugin activate woocommerce-4-2-fork --quiet
echo "   le MEME WooCommerce renomme « woocommerce-4-2-fork », toujours actif :"
# shellcheck disable=SC2016  # du PHP : $d, $r, $all sont des variables PHP, pas du shell.
wp eval '
require_once ABSPATH."wp-admin/includes/plugin.php";
if ( ! class_exists("WP_Plugin_Dependencies") ) { echo "     (cette version n applique pas la dependance)\n"; return; }
WP_Plugin_Dependencies::initialize();
echo "     has_unmet_dependencies(temoin)         = ", var_export( WP_Plugin_Dependencies::has_unmet_dependencies("hx-temoin/hx-temoin.php"), true ), "\n";
echo "     get_dependency_filepath(woocommerce)   = ", var_export( WP_Plugin_Dependencies::get_dependency_filepath("woocommerce"), true ), "\n";
echo "     class_exists(\"WooCommerce\")            = ", class_exists("WooCommerce") ? "PRESENTE" : "absente", "\n";'
echo -n "   le temoin deja actif est-il desactive ? statut = "; wp plugin list --name=hx-temoin --field=status
