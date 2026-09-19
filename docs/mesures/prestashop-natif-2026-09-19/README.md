# Refaire la mesure : la recherche native de PrestaShop

Kit de l'article [La recherche native de PrestaShop, mesurée](https://heurix.fr/blog/recherche-native-prestashop-mesuree.html)
(19 septembre 2026).

## Ce que le kit contient

| fichier | rôle |
|---|---|
| `catalogue.py`, `catalogue.json` | le catalogue publiable : 86 fiches (10 du site, 64 générées, 12 écrites pour la mesure) |
| `requetes.json` | les 51 requêtes de l'article |
| `php/importer.php` | crée les produits et reconstruit l'index de recherche PrestaShop |
| `php/mesurer.php` | passe chaque requête par `Search::find()`, avec la trace mot par mot |
| `php/fiche-fautive.php` | ajoute une fiche dont la description porte « chevile », mesure, la retire |
| `php/anglais.php` | « wahser » contre « washer », deux produits anglais ajoutés puis retirés |
| `resultats/` | ce que le kit a rendu le 19 septembre 2026 |
| `php/banc.php` | passe chaque requête par le fournisseur natif, puis par celui d'un module (le nôtre, pour l'article) |
| `juger.py` | les fiches attendues pour 48 requêtes, écrites après la mesure, et le compte des premiers résultats justes |
| `resultats-177/jugement.json` | ce compte sur les 177 fiches de l'article : natif et module, requête par requête |

**L'article a été mesuré sur 177 fiches, le kit en publie 86.** Les 91 autres
sont des fiches réelles de racetools.fr (collection `cheville-vis`, copie du
1er août 2026, sha256 `6972cf0101a53fe5ea7fd5a7c2dd4689e27c8dd2d31cafe836ad5595a014b145`).
Ce sont des textes de Fischer et de Racetools : nous ne les republions pas.
La collection rend 0 produit depuis. Avec cette copie, `python3 catalogue.py
<copie>` écrit `catalogue-177.json`, le catalogue exact de l'article.

## Refaire

PrestaShop 9.1.4, installation neuve en ligne de commande, sans produits de démo :

```
php install/index_cli.php --domain=127.0.0.1:8094 --db_server=127.0.0.1 \
  --db_name=<base neuve> --db_user=<u> --db_password=<p> --db_create=1 --prefix=ps_ \
  --language=fr --country=fr --fixtures=0 --email=<e> --password=<p> --ssl=0
```

Puis, depuis la racine de l'installation :

```
php -d memory_limit=1G <kit>/php/importer.php <kit>/catalogue.json <sortie>/map_ids.json
php <kit>/php/mesurer.php <kit>/requetes.json <sortie>/map_ids.json <kit>/catalogue.json <sortie>/natif.json
php <kit>/php/fiche-fautive.php
php <kit>/php/anglais.php
```

## Ce que le kit rend

Réglages livrés, lus en base après l'installation (`resultats/reglages-livres.txt`) :
`PS_SEARCH_FUZZY` 1, `PS_SEARCH_FUZZY_MAX_DIFFERENCE` 5, `PS_SEARCH_MINWORDLEN` 3.

| requête | 177 fiches (article) | 86 fiches (kit) | ce qui se passe |
|---|---|---|---|
| rondele | 6 | 4 | « rondele » remplacé par « rondelle » |
| M8 | 0 | 0 | moins de 3 caractères : ni indexé, ni cherché |
| M8x20 | 1 | 1 | la bonne vis |
| M8 x 20 | 0 | 0 | les trois mots sont trop courts |
| M8-20 | 1 | 1 | « m820 » remplacé par « m840 » : la vis M8-40 |
| 6205-2RS | 1 | 1 | le bon roulement |
| 6205 2RS | 0 | 0 | « 2rs » remplacé par « vis » : intersection vide |
| vis inox M8 20 | 80 | 67 | M8 et 20 écartés : toutes les vis inox |
| ecrou M8 | 3 | 3 | M8 écarté : l'écrou M10 sort aussi |
| zzzzzz | 1 | 1 | remplacé par « 6205zz » : un roulement |
| pneu | 68 | 1 | remplacé par « une » (177) ou « per » (86) |
| chevile | 2 | 2 | voir ci-dessous |

`resultats/natif.json` porte les 51 requêtes, avec pour chaque mot : écarté,
trouvé tel quel, ou remplacé par la correction.

**« chevile ».** Sur les 177 fiches, la faute existe dans une vraie fiche
Fischer : la requête la trouve (2 résultats sur 51 chevilles) et la
correction ne part pas. Le kit ne porte pas cette fiche ; `fiche-fautive.php`
refait le mécanisme (`resultats/fiche-fautive.txt`) :

```
sans la fiche   cheville 2   chevile 2 (corrigé en « cheville »)
avec la fiche   cheville 3   chevile 1 (la fiche fautive seule)
```

## Ce que le kit ne refait pas

La colonne « module Heurix » de l'article : elle demande notre moteur, que
nous avons lancé en local sur le code du 19 septembre (`df596a7`), avec notre
module PrestaShop (`32e18fc`). Avec une clé d'essai, le même catalogue peut
s'indexer sur l'API publique, mais le moteur servi ce jour-là peut différer
du code mesuré.
