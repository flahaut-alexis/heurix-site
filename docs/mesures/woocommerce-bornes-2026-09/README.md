# Refaire la mesure : les bornes du module WooCommerce

Kit de l'article [Ce que la relecture wordpress.org a demandé, et ce que nous avons mesuré pour y répondre](https://heurix.fr/blog/module-woocommerce-publie-bornes-mesurees.html)
(28 septembre 2026).

Il porte **la mesure des bornes**, pas l'instrument qui l'a prise. Ce que ça
veut dire précisément est écrit plus bas, section « Ce que le kit ne refait
pas » : un kit qui promettrait plus qu'il ne tient vaudrait moins qu'un
protocole en prose.

## Ce que le kit contient

| fichier | rôle |
|---|---|
| `mesure.sh` | ce que WordPress fait de l'en-tête `Requires Plugins`, version par version. Copie à l'octet du script du dépôt du module (sha256 `f176f04f1bd9ec0304e421430b5a0d246c1d4ba5afd10fd47c8918ff3f5dd6a7`) |
| `releves/2026-09-27-trois-wordpress.txt` | ce que `mesure.sh` a rendu sur WordPress 5.9.18, 6.4.5 et 7.1.2 |
| `releves/2026-09-23-borne-wordpress-57b8755.json` | la borne basse de WordPress : neuf couples WordPress / WooCommerce sous PHP 8.1 |
| `releves/2026-09-23-ordre-des-crochets-cd3fb1f.json` | la borne basse de WooCommerce : quinze versions de 4.9.5 à 11.1.2, l'ordre des deux crochets, et ce que la boucle produit fait de la page 2 |

Les trois relevés viennent de `heurix-woocommerce`, **qui est un dépôt privé**.
Le champ `plugin` des deux JSON (`heurix-woocommerce 57b8755`,
`heurix-woocommerce cd3fb1f`) date l'arbre mesuré ; ces identifiants ne sont
donc pas consultables depuis l'extérieur, et c'est dit ici pour que personne ne
les cherche.

Ce qu'un relevé porte de la machine qui l'a produit, et pourquoi il le porte :
le champ `versions` (`php_cli` 8.5.10, `php_fpm`, `mariadbd` 12.3.3, `python`
3.9.6, `plateforme` macOS) est ce qui permet de dire si une mesure refaite
ailleurs est *la même* mesure. Les empreintes `sha256_wordpress`,
`wordpress_sha1_publie` et `sha256_zip` sont celles des archives publiées de
WordPress et de WooCommerce : elles se vérifient chez vous.

## Refaire : `mesure.sh`

Celui-là se rejoue entièrement.

```
bash mesure.sh 5.9.18 mysql
bash mesure.sh 6.4.5  sqlite
bash mesure.sh 7.1.2  sqlite
```

Il ne télécharge rien lui-même : il lit un cache (`$HOME/.cache/heurix-woocommerce/plugin-check`
par défaut, `HEURIX_PC_CACHE` pour le changer) où doivent se trouver, **à tirer
vous-même — 86,5 Mo, tailles relevées le 28 septembre 2026** :

| fichier attendu dans le cache | source | poids |
|---|---|---|
| `wordpress-5.9.18.zip` | `downloads.wordpress.org/release/wordpress-5.9.18.zip` | 19,2 Mo |
| `wordpress-6.4.5.zip` | `downloads.wordpress.org/release/wordpress-6.4.5.zip` | 24,8 Mo |
| `wordpress-7.1.2.zip` | `downloads.wordpress.org/release/wordpress-7.1.2.zip` | 35,5 Mo |
| `wp-cli-2.12.0.phar` | `github.com/wp-cli/wp-cli/releases/download/v2.12.0/wp-cli-2.12.0.phar` | 6,8 Mo |
| `sqlite-database-integration-3.0.2.zip` | `downloads.wordpress.org/plugin/sqlite-database-integration.3.0.2.zip` | 0,2 Mo |

Et deux choses qui ne sont pas des fichiers :

- **un PHP 8.1** pour WordPress 5.9, qui ne tourne pas sous 8.5 :
  `HX_PHP=/chemin/vers/php8.1 bash mesure.sh 5.9.18 mysql`. Sans lui, la
  mesure de 5.9 n'est pas celle du relevé ;
- **MariaDB** (`mariadbd`, `mariadb-install-db`, `mariadb`) pour le mode
  `mysql`. Le drop-in SQLite officiel déclare `Requires at least: 6.4` : sous
  6.4, il faut un vrai serveur. Le script en démarre un jetable sur une socket
  dans un `mktemp -d`, et le relevé nomme la base qui a servi.

**Ce que `mesure.sh` ne mesure pas, et qu'il faut savoir en lisant son relevé.**
Sa section 2 — « la résolution : par le NOM DU DOSSIER » — installe une
**doublure** dans le dossier `woocommerce` : un fichier de cinq lignes dont
tout le contenu est `class WooCommerce {}`. Ce n'est pas WooCommerce. C'est
voulu, et c'est ce qui rend la mesure lisible : l'objet mesuré est
`WP_Plugin_Dependencies`, pas WooCommerce. La conclusion porte donc sur ce que
WordPress résout, et sur rien d'autre.

Le témoin activé n'est pas non plus le module : c'est un plugin de six lignes,
dont une seule ligne de code, qui ne porte que l'en-tête
`Requires Plugins: woocommerce`. Le module y
ajouterait son propre garde `class_exists( 'WooCommerce' )`, donc son propre
résultat.

## Ce que les deux JSON portent

`2026-09-23-ordre-des-crochets-cd3fb1f.json`, quinze versions de WooCommerce sur
WordPress 7.1.2, 12 produits par essai :

| WooCommerce | `posts_per_page` lu par le module (défaut / Customizer 5 / Customizer 120) | page 2 | tient |
|---|---|---|---|
| 4.9.5, 5.9.2, 6.0.0 | 100 / 100 / 100 | `is_search` false, `found_posts` 0, aucun id | non |
| 6.1.0 → 11.1.2 (douze versions) | 16 / 5 / 100 | `is_search` true, `found_posts` 12, la tranche suivante | oui |

`WC_Query::pre_get_posts` est rang 1 et `Heurix_Search::intercepter_recherche`
rang 2, en priorité 10, dans les quinze versions — et le résultat ne change pas
selon que le module est chargé avant (`heurix-search`) ou après
(`zz-heurix-search`) WooCommerce.

`2026-09-23-borne-wordpress-57b8755.json`, neuf couples sous PHP 8.1.34 :
5.9.18+6.1.0, 5.9.18+7.0.0, 6.0.16+7.0.0, 6.1.14+7.9.2, 6.3.12+7.9.2,
6.5.12+8.9.5, 6.7.9+9.9.7, 6.9.9+10.9.4, 6.9.9+6.1.0. Les neuf tiennent.

Ce relevé porte `borne_wp_du_module_neutralisee: true`, et il faut le lire :
pour descendre sous la borne que le module déclare, **le banc a neutralisé le
`Requires at least` du module**. Sans ça, WordPress refuse l'activation et la
mesure ne descend nulle part. Le même relevé vérifie ce refus dans l'autre
sens, en posant `Requires PHP: 9.9` dans une copie.

## Ce que le kit ne refait pas

**Les deux JSON ne se rejouent pas avec ce kit.** Ils ont été produits par
`tests/banc-disjoncteur/` de `heurix-woocommerce` — un banc Python qui monte un
WordPress, un PHP-FPM et une base par essai, avec ses scénarios PHP. Ce banc
n'est pas publié : il mesure d'abord le disjoncteur du module, ce qui n'a rien à
voir avec cet article, et le publier en entier pour deux relevés reviendrait à
publier l'instrument à la place de la mesure. Le protocole est décrit ci-dessus
et dans l'article ; l'écrire vous-même prend un WordPress, un WooCommerce, un
faux Heurix qui rend des ids dans un ordre connu, et la lecture de
`posts_per_page`, `post__in`, `orderby`, `found_posts` et de la page 2.

**Ce qui ne se rejoue pas du tout, et qui n'est donc mesuré nulle part :**

- **WordPress 5.8 et antérieurs sous un PHP qu'ils acceptent.** Ils descendent
  jusqu'à PHP 5.6.20 ; il faudrait un PHP 7.x, écarté le 23 septembre 2026
  (formule Homebrew morte depuis 2022). Sous PHP 8.1, 5.8.17 et 5.6.21 ne
  démarrent pas — `mysqli` lève par défaut depuis 8.1 et leur `wp-db.php` ne
  pose pas `mysqli_report( MYSQLI_REPORT_OFF )`. Ce trou ne s'ouvre pas chez un
  marchand : `Requires PHP: 8.1` interdit l'activation sur un PHP 7.x.
- **WooCommerce 3.9.5** : erreur PHP avant d'atteindre la mesure.
- **Les versions intermédiaires de chaque branche.** Les quinze essais WooCommerce
  couvrent 4.9.5, 5.9.2, 6.0.0, 6.1.0, 6.2.0, 6.3.0, 6.5.0, 6.7.0, 6.9.5,
  7.0.0, 7.9.2, 8.9.5, 9.9.7, 10.9.4, 11.1.2 ; entre deux d'entre elles, rien.
- **Tout WordPress autre que 7.1.2, et tout PHP autre que 8.5.10**, pour la
  mesure des crochets.
- **La borne PHP.** 8.1.34 et 8.5.10 sont exercés ; rien en dessous de 8.1.
  `Requires PHP: 8.1` est une borne de précaution, pas une borne mesurée, et
  c'est la seule des trois qui n'a jamais été descendue.
