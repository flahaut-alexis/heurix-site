# Connecteur Odoo : ce que le module coûte, mesuré sur instance

Relevé du 18 septembre 2026. Ce lot mesure et propose : il n'écrit pas le module. Il fait suite à `docs/MESURE-CONNECTEUR-ODOO.md` (16 septembre), relu avant, et à la réponse d'Odoo du 18 septembre sur la clé API, le repli, la gratuité et l'opt-in.

Relevés bruts, traces et instruments : `docs/mesures/odoo-2026-09-18/`.

## Sur quoi c'est mesuré

| Source | Version | Comment |
|---|---|---|
| `odoo/odoo` `19.0` | `bcd36a80` (18 sept., 10:59 UTC) | instance locale, Community |
| `odoo/odoo` `20.0` | `79719345` (18 sept., 10:26 UTC), `version_info = (20, 0, 0, FINAL, 0, '')` | instance locale, Community |
| `odoo/odoo` `16.0`, `17.0`, `18.0`, `saas-19.4`, `master` | `2df25c68`, `b5f3a68b`, `7950c5b4`, `463dcc6e`, `3afb4487` | lecture du code (`git grep`) |
| `odoo/documentation` `19.0` | `f827d12` (18 sept., 03:42 UTC) | pages Odoo.sh seulement |
| API Heurix de production | `api.heurix.fr` | refus mesurés avec une clé absente et une clé inventée |
| 55 boutiques Odoo de distributeurs | lues le 18 sept. | `/web/webclient/version_info`, en-têtes, DNS |

**Les instances** : PostgreSQL 16.15, Python 3.12, les 55 modules `website*` de Community avec données de démo, plus deux sondes jetables (`instruments/`) :

- `probe_fuzzy` trace chaque appel à `website._search_with_fuzzy` : type, texte, route, utilisateur, appelant ;
- `probe_repli` simule le connecteur : appel HTTP, puis repli sur la recherche native.

Deux workers (`--workers=2`), comme en production, sauf mention contraire.

**Non mesuré** : Enterprise, Odoo.sh, et toute version autre que 19.0 et 20.0 sur instance.

## Ce qui a changé depuis le 16 septembre

- **Odoo 20.0 est sortie.** La branche `20.0` porte `FINAL`, et `master` est passée à `20.1 alpha`. Le 16 à 19:46, il n'y avait pas de branche `20.0`.
- **20.0 prend la forme de saas-19.4 :**
  - `offset` dans la signature de `_search_with_fuzzy` ;
  - le type s'appelle `"product_template"` ;
  - pas de tri par nom sur `"all"`.

  Elle ajoute aussi :
  - une surcharge de `_search_fetch` dans `website_sale` (`product_template.py:1506`) ;
  - deux appels à `_get_shop_domain` dans `shop()` (`main.py:464` et `:472`) ;
  - un point d'extension `_add_search_subdomains_hook` ;
  - un bouton « Load more » sur `/website/search`, qui rappelle l'autocomplétion avec un `offset`, type par type (`website/static/src/interactions/search_more.js:34`).
- **20.0 retire `ir.config_parameter.get_param` et `set_param`**, remplacés par des accesseurs typés (`get_str`, `get_float`, `set_str`...). Mesuré : la sonde écrite pour 19.0 a planté en 20.0 (HTTP 500 sur `/shop`) jusqu'à ce correctif. C'est là qu'un module range sa clé API.
- **19.0 n'a pas changé dans la recherche.** Le diff entre `11637aa5` (lu le 16) et `bcd36a80` ne touche aucune méthode de recherche. Les numéros de ligne ont glissé de 4 à cause de `dced51f1`, un correctif du sitemap.

## 1. Le point d'insertion touche-t-il autre chose que la recherche ?

**Oui, si on le prend tel quel : la navigation de la boutique et cinq autres modules y passent. Non, si la surcharge les laisse à Odoo.**

### Qui appelle `_search_with_fuzzy`

Lu dans le code, sur tous les types de fichiers, de 16.0 à 20.0 : **uniquement des contrôleurs du site public, et des tests.** Aucun appel depuis le back-office, un rapport, un cron ou un modèle. Aucun JS du back-office n'appelle `/website/snippet/autocomplete`.

Mesuré sur instance, 19.0 et 20.0, même résultat (`trace-19.0-resume.txt`, `trace-20.0-resume.txt`) :

| Ce qui a été joué | Appels | Type et texte |
|---|---|---|
| `/shop`, page 2, tri, **catégorie**, **filtre d'attribut**, **filtre de prix** | 1 chacun | produits, `search=''` |
| `/shop?search=desk`, recherche floue, recherche dans une catégorie | 1 chacun | produits, texte saisi |
| `/shop/compare` sans produit (redirige vers `/shop`) | 1 | produits, `search=''` |
| `/website/search` et autocomplétion, 9 types | 1 chacun | le type demandé |
| `/blog`, `/event`, `/forum`, `/jobs`, `/slides`, avec et sans recherche | 1 chacun | leur type, `search` vide ou `None` sans recherche |
| panier, wishlist, fiche produit, accueil | 0 | |
| Admin connecté sur `/shop` | 1 | produits, **80 produits** là où le public en voit 28 |
| Back-office : `/odoo`, action produits, `name_search` et `web_search_read` sur produits, pages, blog, `search_read` sur commandes | 0 | |
| Rapport de commande (HTML) | 0 | |
| Tous les crons, déclenchés à la main (35 en 19.0, 42 en 20.0) | 0 | |

La ligne « contactus » des résumés porte un appel qui n'est pas le sien. C'est le `/shop` que le script recharge juste après pour y prendre un lien produit ; un `/contactus` isolé fait 0 appel.

### Ce que deviendrait un appel qui n'est pas une recherche de visiteur

**La navigation passe par la même méthode.** Chaque vue de `/shop`, et chaque clic sur une catégorie, un attribut ou une fourchette de prix, appelle `_search_with_fuzzy` avec `search=''`. Une surcharge qui envoie cet appel à Heurix met notre service sur le chemin de la navigation. C'est ce que la condition d'Odoo exclut : « does not impact the usage of the general database ».

**Cinq modules sans rapport avec un catalogue passent aussi par elle** : blog, événements, forum, offres d'emploi, e-learning. Le type `"all"` de la barre d'en-tête mélange produits, pages, articles et le reste.

**Ce que la surcharge doit faire, au minimum :**

1. **Laisser passer** tout appel dont le texte est vide, `None` ou fait d'espaces.
2. **Laisser passer** tout type qui n'est pas produit.

   | Versions | Types produit |
   |---|---|
   | 16.0 à 19.0 | `products`, `products_only` |
   | 20.0 | `products`, `product_template` |

3. **Sur `"all"`,** ne remplacer que la part produits et laisser le reste à Odoo.
4. **Ne jamais s'appeler hors d'une requête HTTP** sur le site. Aucun appel de ce genre n'a été vu, mais c'est ce qui garantit qu'un module tiers inconnu n'y entre pas.
5. **Garder le domaine d'Odoo comme filtre de visibilité.** L'admin voit 80 produits dans `/shop`, le public 28. Heurix classe ; Odoo décide ce que chacun a le droit de voir.

### Ce qui reste non mesuré

- **Les modules Enterprise.** 49 des 54 boutiques de l'échantillon (point 3) sont en Enterprise. Leur code est privé. Un projet Odoo.sh le fournirait, puisqu'il embarque Enterprise.
- **Les modules tiers.** Aucun installé.

## 2. Ce que le repli demande vraiment

### Ce que voit le visiteur, et en combien de temps

Temps de réponse complet vu par le client, sur 5 essais : médiane, puis maximum.

- **Colonne `/shop` :** la page de résultats `/shop?search=desk`, en 19.0.
- **Colonne autocomplétion :** l'appel JSON de la liste déroulante.

Sources : `repli-19.0-3s.txt`, `repli-19.0-1s.txt` et `repli-20.0-3s.txt`. En 20.0, tout est plus lent de 40 à 60 ms, le reste est identique.

| Cas | Délai 3 s : `/shop` | Délai 3 s : autocomplétion | Délai 1 s : `/shop` | Ce que voit le visiteur |
|---|---|---|---|---|
| Module inactif, référence | 0,154 / 0,168 | 0,095 / 0,097 | 0,166 / 0,170 | recherche native |
| Clé absente | = référence, par construction : la sonde sans URL ne fait aucun appel | | | recherche native |
| Clé invalide, 403 réel de production | 0,237 / 0,251 | 0,159 / 0,179 | 0,253 / 0,321 | native, +80 ms |
| Quota, 429 | 0,146 / 0,160 | 0,092 / 0,100 | 0,157 / 0,161 | native |
| Paiement, 402 | 0,134 / 0,138 | 0,083 / 0,088 | 0,148 / 0,168 | native |
| Panne, 503 | 0,140 / 0,149 | 0,088 / 0,095 | 0,152 / 0,182 | native |
| Port fermé | 0,142 / 0,169 | 0,095 / 0,100 | 0,150 / 0,166 | native |
| DNS inexistant | 0,144 / 0,176 | 0,100 / 0,113 | 0,147 / 0,157 | native |
| Service lent, 1,5 s | 1,723 / 1,727 | 1,652 / 1,658 | 1,210 / 1,211 | à 3 s : **le résultat Heurix**, en 1,7 s ; à 1 s : native |
| Service lent, 5 s | 3,214 / 3,240 | 3,147 / 3,160 | 1,215 / 1,218 | native, après le délai |
| Connexion ouverte, aucune réponse | 3,211 / 3,223 | 3,143 / 3,153 | 1,215 / 1,223 | native, après le délai |
| Hôte injoignable, paquets perdus | 3,217 / 3,227 | 3,145 / 3,153 | 1,201 / 1,221 | native, après le délai |

**Deux familles, pas cinq cas.**

- **Un refus qui arrive** (clé absente ou invalide, 402, 429, 503, port fermé, DNS) : le coût est le temps d'aller-retour. En local, il est invisible. Contre la production, il vaut +80 ms, dont un TLS neuf à chaque appel ; les refus de production mesurés seuls prennent 50 ms (403) et 54 ms (401).
- **Rien n'arrive** (service lent, connexion muette, hôte perdu) : le visiteur attend le délai entier, puis la recherche native.

**L'autocomplétion.** Le widget attend déjà 400 ms après la dernière frappe (`debounced(this.onInput, 400)`, de 17.0 à 20.0). Ces 400 ms existent aussi sans Heurix : seul le délai s'y ajoute.

Avec un délai de 3 s et un service muet, la liste déroulante s'affiche environ 3,5 s après la dernière frappe, contre environ 0,5 s en natif. Ce 3,5 s est une addition, pas une mesure de bout en bout dans un navigateur.

### Le cas qui touche toute la base

Mesuré avec deux workers et un service Heurix qui ne répond pas (`saturation-19.0-2workers.txt`). Pendant N recherches simultanées, on chronomètre, en parallèle :

- un visiteur qui ouvre `/contactus`, sans rien chercher ;
- un utilisateur du back-office qui lit des commandes.

| N recherches | Délai 3 s : page | Délai 3 s : back-office | Délai 1 s : page | Délai 1 s : back-office |
|---|---|---|---|---|
| 2 | 2,92 s | 2,94 s | 0,92 s | 0,94 s |
| 4 | 6,16 s | 6,13 s | 2,14 s | 2,12 s |
| 6 | 9,30 s | 9,29 s | 3,29 s | 3,28 s |
| 10 | 15,64 s | 15,62 s | 5,65 s | 5,63 s |

Sans aucune recherche, la même page prend 0,06 à 0,08 s.

Chaque recherche garde un worker pendant tout le délai. Les autres requêtes, back-office compris, font la queue derrière elle. Même mesure en 20.0 (N=6, 3 s) : 9,43 s. En mode threadé (`--workers=0`), pas de queue : 0,15 s (`saturation-19.0-threade.txt`). Mais ce n'est pas le mode de production. Sur Odoo.sh, la documentation dit que les workers fixent le nombre de requêtes simultanées et qu'ils sont payants (`odoo_sh/getting_started/settings.rst:327-341`).

**C'est ce cas, et pas la clé, qui peut nous faire refuser.** Un Heurix muet sans protection ralentit toute la base du marchand.

### Ce que le repli demande donc

1. **Un délai court.** 3 s est la valeur de WooCommerce (`class-heurix-api-client.php:87`) et le défaut de PrestaShop, où il se règle (`HEURIX_TIMEOUT`). À 1 s, la saturation est divisée par trois, pas supprimée.
2. **Un disjoncteur dont l'état est partagé entre les workers.** En prefork, chaque worker est un processus. Un disjoncteur en mémoire devrait échouer dans chaque worker avant de s'ouvrir. WooCommerce le garde dans des transients WordPress (`class-heurix-circuit-breaker.php:7`), PrestaShop dans `Configuration` (`HEURIX_LAST_FAILURE`).
3. **Ne compter que les pannes.** Réseau, délai, 5xx : oui ; 401, 403 et 402 : non, comme WooCommerce le fait déjà. Un refus coûte un aller-retour ; seul un silence coûte un worker.
4. **Aucun appel sortant quand la clé manque.** C'est ce qui rend ce cas gratuit ; la sonde le fait par construction.
5. **Le cas lent sous le délai n'est pas un repli.** À 3 s, un Heurix qui répond en 1,5 s est affiché, et le visiteur attend 1,7 s. Il faut choisir un délai qui soit aussi un temps acceptable pour un bon résultat.

Point de départ à discuter, non mesuré en production : un délai sous la seconde, avec une latence moteur de production connue avant de le fixer.

## 3. Quelle version viser en premier

### Ce que servent les boutiques

Échantillon de 55 boutiques Odoo de distributeurs et grossistes (fixations, quincaillerie, électricité, levage, emballage, labo), en France pour 25 d'entre elles, en Belgique et ailleurs pour les autres.

- **Version :** lue sur `/web/webclient/version_info`. Méthode contrôlée sur odoo.com, où l'endpoint rend la même valeur que le HTML.
- **Hébergement :** en-tête `Server: Odoo.sh`, DNS inverse `euNNNa.odoo.com`, IP.
- Trois lignes recontrôlées à la main.

La liste nominative n'est pas versionnée : ce document est publié sur heurix.fr.

| Version | Toutes (54 qui répondent) | Dont installables (Odoo.sh ou auto-hébergé, 29) |
|---|---|---|
| 15.0 ou avant | 4 | 4 |
| 16.0 | 4 | 3 |
| 17.0 | 4 | 3 |
| 18.0 | 16 | 7 |
| 19.0 | 24 | 12 |
| saas~19.3 | 2 | 0 |
| 20.0 ou saas-19.4 | 0 | 0 |

| Hébergement (55) | Boutiques |
|---|---|
| Odoo Online (module impossible) | 19 |
| Odoo.sh | 12 |
| Auto-hébergé ou chez un intégrateur | 18 |
| Indéterminé (derrière Cloudflare) | 6 |

**Limites de l'échantillon.**

- Les boutiques ont été trouvées par recherche web : l'échantillon penche vers les catalogues publics et indexés. Or les boutiques B2B fermées derrière un login sont le cœur de la cible.
- Classer « Online » un site sans en-tête Odoo.sh est une déduction.
- **17 des 19 boutiques Online annoncent une version majeure** (`19.0+e`, pas `saas~`). Une version `19.0` ne dit donc pas qu'un module s'installe.

**Réponse** : 19.0 est la plus répandue, chez toutes les boutiques comme chez celles qui peuvent installer un module. 18.0 vient ensuite. 20.0 n'est encore servie par aucune.

### Ce que coûte d'en supporter deux

Lu dans le code, pour les méthodes à surcharger :

| | 16.0 | 17.0 | 18.0 | 19.0 | 20.0 |
|---|---|---|---|---|---|
| `_search_with_fuzzy` | 5 arguments | 5 | 5 | 5 | **6** (`offset`) |
| Type produit | `products_only` | idem | idem | idem | **`product_template`** |
| Domaine des filtres | **`_get_search_domain`** | `_get_shop_domain` | idem | idem | idem, `tags` en plus, **2 appels** |
| `_shop_lookup_products` | avec `attrib_set` | idem | idem | **sans** | sans |
| Tri par nom sur `"all"` | oui | oui | oui | oui | **non** |
| Paramètres de configuration | `get_param` | idem | idem | idem | **`get_str` etc.** |

- **17.0, 18.0 et 19.0 forment une famille.** Même signature, même nom de type, même méthode de filtres. Seul `_shop_lookup_products` change en 19.0, et la surcharge n'en a pas besoin si elle se place sur `_search_with_fuzzy`. Ensemble, elles couvrent 22 des 29 boutiques installables.
- **20.0 est une deuxième famille.** Sur six points du tableau, cinq changent. La sonde écrite pour 19.0 a dû être corrigée pour tourner en 20.0.
- **Sur la place de marché, chaque version est une branche et un produit à part** (FAQ lue le 16). Supporter 18.0 et 19.0 fait donc deux branches au code quasi identique, et deux passages de tests. Supporter 19.0 et 20.0 fait deux branches au code différent.

**Proposition** : viser 19.0 d'abord ; 18.0 ensuite, pour un coût faible ; 20.0 quand des boutiques la serviront, en code séparé.

### Odoo.sh et l'auto-hébergement se comportent-ils pareil ?

- **Même code.** Les 12 boutiques Odoo.sh de l'échantillon annoncent toutes une version majeure (`16.0+e` à `19.0+e`, aucune `saas~`), c'est-à-dire les branches publiques que sert aussi l'auto-hébergé. Rien de ce qui est mesuré au point 1 ne dépend de l'hébergement.
- **Même mode de production**, avec des workers. Le cas qui sature (point 2) vaut donc des deux côtés. Sur Odoo.sh, le nombre de workers est acheté et plafonné.
- **Différence documentée** (`odoo_sh/getting_started/branches.rst:609-616`) : sur les branches de développement, Odoo.sh installe les modules de la branche et lance leur suite de tests par défaut. `website_sale` s'installe comme dépendance, et ses tests (`tests/test_fuzzy.py` appelle `_search_with_fuzzy`) tournent donc avec notre surcharge active. Sans clé, le module ne fait rien, ce qui les laisse passer ; non mesuré sur Odoo.sh.
- **Non mesuré** : le réseau sortant d'Odoo.sh, et le nombre de workers d'un projet réel.

**Ce que coûte de se passer d'Odoo.sh :**

- les modules Enterprise restent hors du point 1, alors que 49 des 54 boutiques sont en Enterprise ;
- le réseau sortant et le nombre de workers restent documentaires ;
- le comportement des tests sur une branche de développement n'est pas vu.

La documentation suffit pour le mode de fonctionnement (workers, tests). Elle ne suffit pas pour Enterprise, qui est le vrai trou.

## Propositions

1. **Première contrainte du module, décidée le 18 septembre : un disjoncteur dont l'état est partagé entre les workers.** Sans lui, une panne d'Heurix ralentit toute la base du marchand, back-office compris (point 2, 9,3 s pour six recherches). Un disjoncteur en mémoire ne protège que le worker qui a vu les échecs. Seules les vraies pannes l'ouvrent (réseau, délai, 5xx) ; les refus 401, 403 et 402 ne comptent pas.
2. **Le reste du repli :** délai court, aucun appel sans clé.
3. **Surcharger `_search_with_fuzzy`**, avec les cinq règles du point 1. Le repli y est naturel, puisque `super()` est la recherche native.
4. **Surcharger `_get_shop_domain`**, sinon les facettes ne voient pas les produits trouvés par Heurix (relevé du 16 ; 20.0 l'appelle deux fois).
5. **Viser 19.0**, puis 18.0. 20.0 plus tard, en code séparé.
6. **Écrire dans la description publique**, en plus de l'opt-in dans l'écran du module :
   - le service externe ;
   - les données envoyées ;
   - le lien vers la politique de confidentialité ;
   - le fait que la navigation ne passe jamais par Heurix.

## Questions ouvertes

1. **Enterprise** : quels modules Enterprise appellent `_search_with_fuzzy` ? Seul un projet Odoo.sh ou un accès au dépôt Enterprise le dira.
2. **Le délai** : quelle latence de recherche sur le moteur de production, depuis un serveur européen, pour fixer un délai sous la seconde ?
3. **L'échantillon** : il ne voit pas les boutiques B2B fermées derrière un login, qui sont la cible.
