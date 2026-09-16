# Connecteur Odoo : ce qu'il coûterait

Relevé du 16 septembre 2026, lu entre 19:40 et 19:50. Ce lot mesure. Il ne crée ni dépôt ni module et ne recommande rien : les questions sans réponse lisible restent ouvertes, en fin de document.

## Sur quoi c'est lu

| Source | Version lue | Comment |
|---|---|---|
| `odoo/odoo`, branche `19.0` | `11637aa5` (commit du 16 sept. 2026, 15:06 UTC) | clone partiel, `addons/website`, `addons/website_sale` |
| `odoo/odoo`, branche `saas-19.4` | `e66104c5` (16 sept., 14:51 UTC) | `git show` sur les mêmes fichiers |
| `odoo/odoo`, branche `master` | `165c6a20` (16 sept., 14:52 UTC), `version_info = (19, 5, 0, ALPHA, 1, '')` | idem |
| `odoo/odoo`, branches `14.0` à `18.0` | `cc0060e8`, `3a28e5b0`, `2df25c68`, `d5ac229d`, `22b417c1` | un `grep` sur `website_sale/controllers/main.py` |
| `odoo/documentation`, branche `19.0` | `686fd9bb` (16 sept., 10:00 UTC) | sources `.rst` de la doc publiée |
| odoo.com/pricing-plan | redirigée vers `https://www.odoo.com/pricing`, HTTP 200 | HTML brut, texte extrait sans résumé |
| apps.odoo.com/apps/faq, /apps/vendor-guidelines, /apps/upload | HTTP 200 chacune | idem |
| Trois fiches 19.0 d'apps.odoo.com | HTTP 200 | HTML brut du bloc « Availability » |
| heurix-shopify | `dc93898` (origin/main) | worktree `~/wt/heurix-shopify-mesure-odoo` |
| heurix-woocommerce | `500d859` (origin/main) | worktree `~/wt/heurix-woocommerce-mesure-odoo` |
| heurix-prestashop | `32e18fc` (origin/main) | worktree `~/wt/heurix-prestashop-mesure-odoo` |

**Branches de `odoo/odoo` le 16 septembre à 19:46** : la dernière majeure est `19.0`, sans branche `20.0`. Odoo Online tourne sur les branches `saas-19.x`, dont la dernière est `saas-19.4`.

**Non fait** : aucun Odoo n'a été lancé et aucun module n'a été installé. Le point 1 vient de la lecture du code, pas d'une exécution.

## 1. Où passe la recherche, et comment s'y insérer

### Trois chemins côté visiteur, un seul entonnoir

Sur `19.0`, trois routes servent une recherche de produits. Toutes les trois passent par `website._search_with_fuzzy`.

| Chemin | Route et méthode | Appel |
|---|---|---|
| Page de résultats de la boutique | `/shop?search=...`, `WebsiteSale.shop()` (`website_sale/controllers/main.py:285`) | `_shop_lookup_products()` (`:239`) appelle `website._search_with_fuzzy("products_only", search, limit=None, order=..., options=options)` (`:241`) |
| Autocomplétion de la barre | `/website/snippet/autocomplete`, JSON-RPC, `auth='public'` (`website/controllers/main.py:497`) | `request.website._search_with_fuzzy(search_type, term, limit, order, options)` |
| Page de résultats globale | `/website/search` et `/website/search/<search_type>` (`website/controllers/main.py`, `hybrid_list`) | appelle `self.autocomplete(..., limit=500)` (`:641`), donc le même chemin |

**Le navigateur.** Le widget `website/static/src/snippets/s_searchbar/search_bar.js` appelle `rpc("/website/snippet/autocomplete", { search_type: this.searchType, ... })` (`:93`). Le `search_type` vient du gabarit qui pose la barre :

- la barre de la boutique et la modale de recherche : `search_type="products"` (`website_sale/views/templates.xml:365`, `:913`, `:2258`) ;
- la barre d'en-tête et le bloc « Search » : `search_type="all"`, `action="/website/search"` (`website/views/website_templates.xml:3253-3254`, `website/views/snippets/s_searchbar.xml:6-7`).

L'intuition de la consigne est donc juste : **l'autocomplétion appelle une autre route que la page `/shop`**. En revanche, les deux se rejoignent dans la même méthode de modèle.

**Ce que rend la méthode.** `_search_with_fuzzy` rend un tuple `(count, results, fuzzy_term)` (`website/models/website.py:2047`). `results` est une liste de « détails » par modèle, et chaque détail porte un recordset `results` (docstring de `_search_exact`, `:2079`). `/shop` prend `details[0]['results']`, un recordset `product.template`.

**La descente.**

1. `_search_get_details` (surchargée par `website_sale/models/website.py:876`) ajoute `product.template` pour `products`, `products_only` et `all`.
2. `_search_exact` appelle `model._search_fetch(search_detail, search, limit, order)` sur chaque modèle.
3. `_search_fetch` (`website/models/mixins.py:380`) fait un `search()` ORM sur un domaine `ilike` par mot (`_search_build_domain`, `mixins.py:333`).
4. Les champs cherchés sont `name`, `variants_default_code`, et avec description `description_sale` et `description_ecommerce` (`product_template.py:866-870`).

### Un module tiers peut-il remplacer ça sans toucher au cœur ?

**Oui, par les deux mécanismes documentés.**

- Les contrôleurs se surchargent par héritage de classe : « To *override* a controller, inherit from its class and override relevant methods » (`documentation`, `developer/reference/backend/http.rst:27`).
- Les modèles se surchargent par `_inherit`.

Trois modules tiers de recherche externe existent en 19.0 sur la place de marché (`odoo_algolia_connector`, `website_elasticsearch`, `product_data_feed_doofinder`, section 2). Leur code n'a pas été lu : ils prouvent que le marché existe, pas la méthode qu'ils emploient.

**Où s'insérer, et les quatre pièges que le code montre :**

1. **Un seul point couvre les trois chemins** : `website._search_with_fuzzy`, ou `product.template._search_fetch`. Surcharger `_shop_lookup_products` seul ne couvrirait que `/shop`, ce serait le module « à moitié fait ».
2. **La correction floue passe AVANT la recherche.** `_search_with_fuzzy` appelle `_search_find_fuzzy_term` puis cherche sur le mot trouvé à la place du mot saisi (`website.py:2068-2070`). Une surcharge placée à `_search_fetch` recevrait donc parfois le mot corrigé par Odoo, pas la requête du visiteur. La correction est sautée sous 4 caractères, sur plusieurs mots, ou quand 80 % des caractères sont des chiffres (`:2138`) : elle peut donc s'appliquer à « visinox », jamais à « DIN 933 ».
3. **Les facettes de `/shop` ne lisent pas le résultat.** Après la recherche, `shop()` reconstruit un domaine `ilike` avec `_get_shop_domain(search_term, ...)` (`main.py:375`). Ce domaine calcule :
   - la fourchette de prix (`:377-390`) ;
   - les catégories proposées (`:426-427`) ;
   - les attributs filtrables (`:478-479`).

   Un produit trouvé par Heurix grâce à un synonyme, absent du domaine `ilike`, s'afficherait sans que ses catégories et attributs apparaissent dans les filtres. **`_get_shop_domain` est donc la deuxième méthode à surcharger.** Le connecteur WooCommerce a rencontré le même piège : sans vider le terme natif, WordPress combine son `LIKE` avec les identifiants d'Heurix en ET (`class-heurix-search.php`, commentaire avant l'appel).
4. **Sur `search_type="all"`, l'ordre est réécrit par nom.** `autocomplete()` trie les résultats par nom (`website/controllers/main.py:537-539`, « Only supported order for 'all' is on name »). La barre d'en-tête et `/website/search` perdent donc le classement d'Heurix, sauf à surcharger aussi le contrôleur. Sur `saas-19.4`, ce tri n'apparaît plus : le seul `sort(` du fichier trie des groupes par `sequence` (`:1122`).

### La forme change entre versions

| Version | Méthode de filtre | Appel de recherche |
|---|---|---|
| 14.0 | `_get_search_domain` | (pas de `_search_with_fuzzy` dans ce fichier) |
| 15.0, 16.0 | `_get_search_domain` | `_search_with_fuzzy("products_only", search, limit=None, ...)` |
| 17.0, 18.0, 19.0 | `_get_shop_domain` | `_search_with_fuzzy("products_only", search, limit=None, ...)` |
| saas-19.4, master | `_get_shop_domain` (signature sur plusieurs lignes) | `_search_with_fuzzy("product_template", search, offset=0, limit=None, ...)` |

Deux conséquences, lues sur le code :

- **Les deux citations de la consigne sont exactes, à des versions différentes.**
  - `_get_search_domain` existe de 14.0 à 16.0 et disparaît en 17.0, remplacée par `_get_shop_domain`.
  - `"products_only"` vaut jusqu'à 19.0. Sur `saas-19.4` et `master`, le type s'appelle `"product_template"` (`website_sale/models/website.py:907` de saas-19.4).
- **La signature de `_search_with_fuzzy` a gagné `offset`** : `(self, search_type, search, limit, order, options)` en 19.0, `(self, search_type, search, offset, limit, order, options)` sur saas-19.4 (`:2165`) et master (`:2289`). `_search_fetch` suit (`mixins.py:944` et `:965`). Une surcharge écrite pour 19.0 ne tourne pas telle quelle sur la version qu'on trouvera en 20.0, si `master` y mène.

## 2. Ce qu'un module tiers peut faire, selon l'hébergement

| | Odoo Online | Odoo.sh | Auto-hébergé |
|---|---|---|---|
| Module Python tiers | **Non** | Oui, depuis un dépôt Git | Oui, dans le dossier addons |
| Passage par la place de marché exigé | sans objet | Non | Non |
| Appel sortant vers une API externe | sans objet pour un module | pas de restriction trouvée | pas de restriction trouvée |
| Plan Odoo requis | Standard ou Custom | Custom, et l'hébergement Odoo.sh en plus | Custom pour Enterprise ; aucun pour Community |

### Odoo Online refuse

Trois sources concordent :

- **Documentation** : « Odoo Online is incompatible with custom modules or modules from the Odoo Apps Store » (`administration/odoo_online.rst:15-16`).
- **Doc de mise à niveau** : « the instalation of custom modules containing Python files is not allowed on Odoo Online databases » (`developer/howtos/upgrade_custom_db.rst:241-242`).
- **FAQ de la place de marché** : les apps tierces vendues ne peuvent pas servir sur Odoo Online, « unless they are data-modules (that do not include any python files) » (apps.odoo.com/apps/faq). Un module qui remplace la recherche est du Python.

Les trois fiches 19.0 lues portent toutes, dans leur bloc « Availability », une croix rouge sur Odoo Online et une coche verte sur Odoo.sh et On Premise : `odoo_algolia_connector`, `website_elasticsearch`, `product_data_feed_doofinder`.

**Conséquence** : un module Odoo ne vise que les distributeurs sur Odoo.sh ou auto-hébergés. Les bases Odoo Online n'en font pas partie.

### Odoo.sh et l'auto-hébergement acceptent

- **Odoo.sh.** La page tarifs dit « Host on Odoo.sh [...] allowing you to develop or use custom modules », et réserve Odoo.sh / On-premise au plan **Custom** (bloc « What is On-premise / Odoo.sh? »). Elle précise « Cost for Odoo.sh hosting not included ».
  - Les modules arrivent par un dépôt Git lié au projet (`administration/odoo_sh/getting_started/create.rst:82-88`, « Push modules in production »).
  - La FAQ de la place de marché : « Can third-party apps be installed on Odoo.sh? Yes, provided your Odoo.sh repository is private ».
  - Rien n'y impose la place de marché.
- **Auto-hébergé.** La FAQ décrit l'installation d'un module acheté : le copier dans le dossier addons, puis « Update Modules List ». `website_sale` est sous licence `LGPL-3` (`website_sale/__manifest__.py:194`) et fait partie de `odoo/odoo`, le dépôt Community. Un distributeur sur Odoo Community n'a donc besoin d'aucun plan Odoo pour la boutique.

### Les appels sortants

- **La page tarifs.** Un appel initié depuis Odoo vers un service externe n'est pas une « External API » : « When the call is initiated from Odoo, this is NOT considered an "External API." » (FAQ « What does External API mean? »). Un module qui appelle Heurix ne consomme donc pas le droit « External API » du plan Custom.
- **Odoo embarque `requests`** (`requirements.txt` de 19.0 : `requests==2.31.0` sous Python 3.11+).
- **Aucune restriction réseau sortante** n'a été trouvée dans la doc Odoo.sh 19.0. Un `grep` sur « outgoing », « outbound », « firewall » et « external service » ne rend que des passages sur le courriel. Une absence dans la doc n'est pas une permission mesurée.

### L'accès inverse : Heurix qui lit Odoo

L'API externe (XML-RPC / JSON-RPC appelée de l'extérieur) est réservée au plan Custom : « Access to data via the external API is only available on *Custom* Odoo pricing plans. Access to the external API is not available on *One App Free* or *Standard* plans » (`developer/reference/external_api.rst:15-18`, même phrase dans `external_rpc_api.rst:25-28`).

### Ce qui reste possible sur Odoo Online, sans module

Documenté, **non essayé sur une base Online** :

- **Du code tiers dans le site.**
  - Le bloc « Embed Code » (`applications/websites/website/web_design/building_blocks.rst:156-168`, snippet `website/views/snippets/s_embed_code.xml`).
  - Le réglage « Code Injection » `<head>` et `</body>` (`applications/websites/website/configuration/google_search_console.rst:115-116`).

  Un widget navigateur à clé publique `hxp_`, comme celui de l'extension Shopify, pourrait donc être posé. Il ne remplacerait ni `/shop` ni l'autocomplétion native : il s'ajouterait à côté.
- **Le catalogue.** Deux voies :
  - l'import CSV ou XML de la console Heurix, la voie que documente le connecteur PrestaShop ;
  - une lecture par l'API externe, donc sur plan Custom seulement.

## 3. Ce que demande la place de marché

**Pas de revue préalable.** La FAQ (apps.odoo.com/apps/faq et /apps/upload, même texte) dit : « We do not currently review every module published, but we do take action when users report abusive behavior. »

**La publication se fait par dépôt Git.**

- On enregistre une URL `ssh://git@serveur/chemin#version` (FAQ, « How do I format the URL of my repository? ») ; la branche porte la version d'Odoo, par exemple `ssh://git@github.com/odoo/odoo#9.0`.
- La fiche se dérive du manifeste et de `static/description/`, et « any error will unpublish all the modules from your repository » (vendor-guidelines, « Application Manifest »).
- **Ce n'est donc pas une troisième revue au sens de Shopify et PrestaShop**, mais une publication libre avec retrait a posteriori (« Enforcement » : dépublication jusqu'à correction, puis suppression du compte en cas de récidive).

**Coût.**

- Aucun droit d'inscription n'est mentionné dans les trois pages lues. Une absence dans trois pages n'est pas une gratuité mesurée.
- Sur les ventes : « Odoo S.A. takes a 30% commission on all sales on Odoo Apps and a 25% commission on each In-App Purchase (IAP) transactions » (FAQ).
- Le prix minimum d'une app payante est de 9 EUR (vendor-guidelines, `price`). Les devises acceptées sont EUR et USD.
- Le prix sur la place de marché doit être le plus bas du web (vendor-guidelines, « Pricing »).

**Une version par release.**

- « Starting version 13.0, Every version of the module is sold separately » (FAQ, « Do I have to buy my module for each version? »).
- « If you provide your module for different Odoo versions, use the same module name » (vendor-guidelines).
- La version du module inclut celle d'Odoo, par exemple `10.0.1.1.3`.
- Avec le changement de signature mesuré au point 1, cela fait **une branche et un code par version majeure**.

**Règles qui touchent directement un connecteur Heurix** (vendor-guidelines) :

- « If your app requires external services to run, it should be clearly advertised as such. »
- « Customer data: if your app collects data to send to another service, the data sent must be clearly explained in your app manifest and store description page, as well as in the application, to get a user opt-in before transmitting data. » Un connecteur qui envoie le catalogue et les requêtes a besoin d'un consentement explicite dans l'écran du module, avant le premier envoi.
- « No vendor Lock-In: your app cannot require an activation key to be executed ». Voir la question ouverte n°1.
- « The module should be installable by copying it in the addons folder ».
- Description et captures en anglais. Aucun lien externe hors YouTube et Teams, et aucun JavaScript dans la description.
- La FAQ ajoute la règle R2 : « Modules that download code in any form [...] will be removed ». Recevoir des identifiants de produits n'est pas télécharger du code, mais la phrase est large.

## 4. Ce que le module devrait porter, au minimum

### Ce que font nos trois connecteurs, lu dans le code

**La prémisse de la consigne est fausse sur un point : les trois connecteurs n'indexent pas tous le catalogue.** PrestaShop ne l'indexe pas : « Catalog synchronisation. The module reads from Heurix, it does not feed it. Index your products from the Heurix console (CSV or XML import) or through the API. » (`heurixsearch/README.md:170-172`).

| | Shopify | WooCommerce | PrestaShop |
|---|---|---|---|
| Forme | service externe (FastAPI) + extension de thème | extension exécutée dans WordPress | module exécuté dans PrestaShop |
| Indexation | oui : import bulk au rattachement, webhooks `products/*`, file et cron (`README.md`) | oui : `woocommerce_update_product`, `wp_trash_post`, `before_delete_post`, indexation initiale (`includes/class-heurix-indexer.php`) ; `POST /v1/index/{cat}/items`, `DELETE .../items/{id}` | **non** |
| Recherche | widget navigateur, clé publique `hxp_` (`extensions/heurix-search/assets/heurix-search.js:18`, `:803`) | serveur, `pre_get_posts` sur la requête principale seulement (`class-heurix-search.php:29-38`) | serveur, `hookProductSearchProvider` sur recherche textuelle (`heurixsearch.php:157`) |
| Autocomplétion native remplacée | sans objet (le widget remplace la barre) | aucune occurrence dans le code (`grep` autocompl, suggest, ajax) | **oui, par le même hook** : la liste déroulante du thème interroge le contrôleur de recherche, qui passe par `productSearchProvider` (mesuré sur 9.1.4 avec hummingbird, `heurixsearch/CHANGELOG.md:104-111`) |
| Clé | clé publique posée dans le bloc de thème | clé serveur en option WordPress | clé serveur `HEURIX_API_KEY` ; refus d'une `hxp_` (`heurixsearch.php:272`) |
| Refus du moteur | 401/403 lus par le widget (`heurix-search.js:286-302`) | dernier refus stocké en option et affiché en avis admin (`class-heurix-api-client.php:333-360`) | détail du moteur affiché au test de connexion (`heurixsearch.php:337-338`) et journalisé |
| Repli si le moteur tombe | non lu | recherche native conservée si `null`, disjoncteur à 3 échecs / 60 s (`class-heurix-circuit-breaker.php`) | fournisseur natif délégué, disjoncteur (`HeurixSearchProvider.php:164-221`) |

### Ce qu'Odoo impose en plus

Tout vient du code lu au point 1 et des règles du point 3.

1. **Trois surcharges au lieu d'une** :
   - `_search_with_fuzzy`, pour les trois chemins, avant la correction floue ;
   - `_get_shop_domain`, pour les facettes, la fourchette de prix et les catégories ;
   - le tri par nom du `search_type="all"` sur 19.0.

   WooCommerce et PrestaShop n'en ont qu'une. PrestaShop couvre la page et la liste déroulante avec ce seul hook, parce que le thème appelle le même contrôleur ; Odoo a deux routes, qui ne se rejoignent qu'au niveau du modèle.
2. **Un code par version majeure** : signature et nom de type différents entre 19.0 et saas-19.4 / master, et une branche Git par version sur la place de marché.
3. **Un consentement dans l'écran du module avant le premier envoi**, s'il est publié sur la place de marché (vendor-guidelines, « Customer data »).
4. **Le multi-site.** Chaque recherche passe par `website.sale_product_domain()` (`main.py:159`, `product_template.py:878`). Une base Odoo peut porter plusieurs sites, et le lien entre un site et un catalogue Heurix est à décider. Aucun de nos connecteurs n'a ce cas, sauf PrestaShop multiboutique (`RAPPORT-VALIDATION-MULTIBOUTIQUE.md`, non relu ici).
5. **Modèle et variantes.** La recherche rend des `product.template` (`details[0]['results']`), et `variants_default_code` fait partie des champs cherchés. Shopify indexe une variante par item (`README.md`, « Une variante Shopify = un item Heurix »). Le choix de l'unité indexée est à faire pour Odoo, et les identifiants rendus par le moteur doivent être ceux des modèles.

### Ce qu'Odoo rend inutile

Par rapport à Shopify, le seul connecteur qui est un service externe :

- **Pas de service à héberger**, pas d'OAuth, pas de vérification HMAC de webhooks, pas de file ni de cron chez nous. Le module tourne dans l'Odoo du marchand, comme WooCommerce et PrestaShop.
- **Pas de facturation imposée par la plateforme.** Rien dans les pages lues n'oblige à facturer un service externe par Odoo. La commission de 30 % porte sur le prix de vente de l'app elle-même.
- **Les prix ne sont pas à indexer pour l'affichage.** Le rendu reste celui d'Odoo : `products._get_sales_prices(website)` (`main.py:497`) et `_search_render_results` (`product_template.py:928`) calculent les prix après la recherche. Si le moteur doit filtrer ou trier par prix, c'est une autre question.
- **Un client HTTP est déjà là** (`requests` dans les dépendances d'Odoo 19.0).

## Questions ouvertes

1. **La clé API contre « No vendor Lock-In ».** La règle interdit qu'une app exige une « activation key » pour s'exécuter. Aucune page lue ne dit si une clé d'accès à un service externe annoncé tombe sous cette règle. Les trois fiches concurrentes publiées suggèrent que non, mais leur code et leur configuration n'ont pas été lus. **Seul apps@odoo.com peut trancher.**
2. **Le poids réel d'Odoo.sh et de l'auto-hébergement parmi les distributeurs B2B français.** Rien de ce qui a été lu ne chiffre la répartition Online / Odoo.sh / On-premise. C'est pourtant ce qui dit la taille du marché, puisque Online est exclu.
3. **Odoo 20.** Aucune branche `20.0` n'existe le 16 septembre à 19:46. `master` porte `19.5 alpha`, et la page tarifs dit que les utilisateurs on-premise doivent être sur la dernière version stable. La date de sortie et la signature finale n'ont pas été mesurées.
4. **Le réseau sortant d'Odoo.sh.** La doc ne mentionne aucune restriction. Seul un appel depuis une branche de staging le mesurerait.
5. **Le widget sur Odoo Online.** Le bloc « Embed Code » et l'injection de code sont documentés. Aucune base Online n'a été ouverte pour vérifier qu'un script externe y tourne, ni ce qu'en dirait la CSP.
6. **Le droit d'inscription vendeur.** Il n'apparaît pas dans les trois pages lues ; le tableau de bord vendeur exige une connexion et n'a pas été ouvert.
7. **Comment les modules concurrents s'insèrent** (`odoo_algolia_connector`, `website_elasticsearch`) : leur code est payant ou non lu. On ne sait donc pas s'ils couvrent l'autocomplétion et les facettes.
