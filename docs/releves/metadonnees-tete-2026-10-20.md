# Métadonnées de tête : titles courts et descriptions bornées — relevé du 20 octobre 2026

Branche `titles-courts-20oct`, worktree `~/wt/titles-courts-20oct`, partie de
`origin/main` à `794d3f1a` (le lot balisage fusionné). Lot à `1b50d0af`.

Périmètre : celui de `tests/pages-indexables.js`, **140 pages indexables**.

---

## 1. Ce sont 76 pages, pas 77, et la 77e est partie d'elle-même

| état | titles > 60 caractères |
|---|---|
| `441d2746`, texte décodé — **votre relevé** | **77** |
| `441d2746`, source brute | 79 |
| `794d3f1a` (main aujourd'hui), texte décodé | **76** |
| `794d3f1a`, source brute | 78 |

La page qui a quitté la liste est **`about.html`** : le lot balisage l'a
ramenée de 67 à 58 caractères, parce que c'était l'une des trois corrections
que vous aviez nommées. Votre 77 et mon 76 décrivent le même site à deux
instants.

**L'écart entre 76 et 78 est le comptage de `&amp;`**, 5 caractères dans le
fichier et 1 à l'écran. Deux pages sont dans cet écart :

| page | source | décodé |
|---|---|---|
| `blog/vins-spiritueux-millesime-format-prix.html` | 63 | **59** |
| `solutions/sport.html` | 61 | **57** |

Elles tiennent la limite pour qui les lit, et ce lecteur est celui que le
garde sert : **la longueur est comptée sur le texte décodé**, et le témoin
l'est aussi. Les deux pages ne sont pas dans le lot.

---

## 2. Le title est écrit en dur, et aucun script ne l'écrit

Vérifié, pas supposé : les trois fichiers de `scripts/` qui contiennent la
chaîne `<title>` sont `exporter-icones.py` et `exporter-og-image.py` (chacun
un gabarit pour sa propre page d'export, hors site) et
`index-recherche.py:310`, qui le **lit** par une expression régulière pour
alimenter l'index. Aucun n'en écrit un dans une page du site.

Il n'y a donc pas de générateur à corriger. **76 fichiers touchés pour les
titles**, plus 10 pour les descriptions et 4 pour le bloc `Organization` ;
`sitemap.xml` et les deux index dérivés suivent.

### 2.1 Une conséquence à connaître : la palette de recherche du site

`scripts/index-recherche.py` stocke le `<title>` dans le champ `t` de
`search-index-fr.json` / `-en.json`, et `search-engine.js:628` écrit ce `t`
dans `.search-result-title`. **La palette de recherche du site affiche donc le
`<title>`**, et ces 76 libellés changent pour un lecteur humain.

Ce n'est pas `blog.html`, que vous avez exclu et qui n'est pas dans le diff —
c'est une troisième surface, que ni votre consigne ni la mienne n'avaient
nommée. Dans une palette large de 60 caractères, la forme courte s'affiche
entière là où 120 caractères étaient coupés ; je l'ai donc laissée suivre.
**Si vous voulez l'inverse**, le geste est une ligne dans
`index-recherche.py` : indexer le `<h1>` dans `t` au lieu du `<title>`. Cela
change le sens de l'index et sort du périmètre de ce lot.

---

## 3. Les quatre pages anglaises : le français n'était pas dans la tête

**Mesuré avant d'écrire, et cela change le travail.** Les quatre pages
portent déjà une `<meta name="description">` **en anglais, propre à chacune** :

| page | longueur | description actuelle (début) |
|---|---|---|
| `en/solutions/automobile.html` | 118 | *Buyers of car parts don't search by name but by reference…* |
| `en/solutions/electricite.html` | 120 | *An electrician writes "DX3 20A curve C", never "small breaker"…* |
| `en/solutions/plomberie.html` | 123 | *Two sizing systems coexist in plumbing…* |
| `en/solutions/sport.html` | 81 | *A "5" on a sports listing can be a 5 m² wing…* |

Le texte français est ailleurs : dans le champ `description` du bloc JSON-LD
**`Organization`**, c'est-à-dire la description de **l'entreprise**, pas de la
page. Il n'y a donc **rien à rédiger** : « une description anglaise qui
corresponde à la page » n'a pas d'objet, puisque ce champ ne décrit pas la
page.

**La rédaction anglaise de référence existe déjà sur 65 blocs du dépôt** —
« Regex-powered search and discovery engine for e-commerce sites, designed in
France. » — et c'est elle qui est reprise, mot pour mot. Aucun texte n'a été
écrit.

**C'est le seul endroit de ce lot qui touche au balisage structuré, et c'est
une tension avec votre consigne.** Vous demandiez les quatre pages dans ce lot
*et* aucun balisage structuré touché ; le défaut n'existe que dans le
balisage. J'ai suivi l'instruction nommée — les quatre pages — en la
restreignant au strict minimum : **un seul champ, quatre fichiers, aucune
autre propriété touchée**. Le geste inverse, si vous le préférez autrement :
`git show 1b50d0af -- en/solutions/ | git apply -R`.

### 3.1 Effet sur le chiffrage du lot d'unification

Ces quatre pages partageaient un bloc **identique** à leur version française,
ce qui est la cause du défaut. Les séparer fait passer le compte de variantes
du bloc `Organization` de **23 à 27** (quatre variantes de 2 pages deviennent
huit variantes de 1 page), et l'axe « description » passe de 77 FR / 65 EN /
1 / 4 à **73 FR / 69 EN / 1 / 4**, avec **zéro page anglaise décrivant Heurix
en français**. Le relevé §12 du 20 octobre est à lire avec cette correction.

---

## 4. Le terme principal de chaque page, et d'où il vient

Je n'ai pas tronqué. Pour chacune des 76 pages, la forme courte est écrite à
la main en gardant le terme sur lequel la page peut être trouvée, et ce terme
est **lu à deux endroits du dépôt**, jamais choisi au jugé :

1. **le slug du fichier** — c'est la compression que l'auteur a déjà faite du
   sujet de la page : `limites-moteurs-natifs-gros-catalogue`,
   `recherche-reference-sku-b2b`, `impact-ebitda-recherche-interne` ;
2. **le `<h1>`**, qui donne la formulation éditoriale complète.

Le terme principal est ce que les deux portent en commun. Exemple, la page la
plus longue :

- slug : `limites-moteurs-natifs-gros-catalogue`
- h1 : *Shopify, PrestaShop, Magento : pourquoi leurs moteurs natifs échouent
  au-delà de 10 000 références techniques ?*
- termes communs : **moteurs natifs**, **limite**, **10 000 références**
- forme courte : **Moteurs natifs : la limite des 10 000 références — Heurix**
  (56)

**Deux contrôles mécaniques ont été passés sur les 76 avant écriture** :
aucune forme courte n'est identique au `h1` de sa page, et aucun `title` n'est
porté par deux pages des 174 fichiers du dépôt.

---

## 5. Les 76 couples, avant et après

Longueur du texte décodé entre parenthèses. Triés du plus long au plus court
avant correction.

| # | page | avant | après |
|---|---|---|---|
| 1 | `blog/limites-moteurs-natifs-gros-catalogue.html` | Shopify, PrestaShop, Magento : pourquoi leurs moteurs natifs échouent au-delà de 10 000 références techniques ? — Heurix **(120)** | Moteurs natifs : la limite des 10 000 références — Heurix **(57)** |
| 2 | `blog/recherche-native-prestashop-mesuree.html` | La recherche native de PrestaShop, mesurée : ce qu'elle corrige, ce qu'elle remplace, ce qu'elle ne lit pas — Heurix **(116)** | La recherche native de PrestaShop, mesurée — Heurix **(51)** |
| 3 | `blog/synonymes-jargon-industriel.html` | Synonymes et jargon industriel : quand le vocabulaire de vos clients fait planter votre moteur de recherche — Heurix **(116)** | Synonymes et jargon industriel dans la recherche — Heurix **(57)** |
| 4 | `blog/facettes-b2b-multi-attributs.html` | Recherche à facettes en B2B : comment structurer vos filtres pour des produits multi-attributs ? — Heurix **(105)** | Recherche à facettes B2B : produits multi-attributs — Heurix **(60)** |
| 5 | `blog/impact-ebitda-recherche-interne.html` | Mauvais moteur de recherche interne : quel est l'impact réel sur l'EBITDA d'un e-commerce B2B ? — Heurix **(104)** | Recherche interne : l'impact réel sur l'EBITDA — Heurix **(55)** |
| 6 | `en/blog/limites-moteurs-natifs-gros-catalogue.html` | Shopify, PrestaShop, Magento: why their native search fails past 10,000 technical references? — Heurix **(102)** | Native search engines: the 10,000-reference limit — Heurix **(58)** |
| 7 | `en/blog/recherche-native-prestashop-mesuree.html` | PrestaShop's native search, measured: what it corrects, what it replaces, what it never reads — Heurix **(102)** | PrestaShop's native search engine, measured — Heurix **(52)** |
| 8 | `blog/tests-qui-ne-peuvent-pas-echouer.html` | « Aucune erreur » dans un journal qui ne reçoit rien : les tests qui ne peuvent pas échouer — Heurix **(100)** | Journal vide : les tests qui ne peuvent pas échouer — Heurix **(60)** |
| 9 | `blog/alternative-algolia-catalogue-technique.html` | Alternatives à Algolia pour un catalogue technique : ce que chaque moteur fait de M8x30 — Heurix **(96)** | Alternatives à Algolia pour un catalogue technique — Heurix **(59)** |
| 10 | `blog/decoupage-rag-catalogue-produit.html` | Découper une fiche de trois lignes : ce qu'un plongement fait d'une référence technique — Heurix **(96)** | Découpage RAG : un plongement et une référence — Heurix **(55)** |
| 11 | `en/blog/synonymes-jargon-industriel.html` | Synonyms and industry jargon: when your customers' vocabulary breaks your search engine — Heurix **(96)** | Synonyms and industry jargon in product search — Heurix **(55)** |
| 12 | `blog/custom-rules-personnaliser-moteur-recherche.html` | Custom Rules : personnalisez votre moteur de recherche sans écrire une ligne de regex — Heurix **(94)** | Custom Rules : personnaliser le moteur sans regex — Heurix **(58)** |
| 13 | `blog/recherche-reference-sku-b2b.html` | Comment configurer la recherche par référence (SKU, DIN, ISO) sur un e-commerce B2B ? — Heurix **(94)** | Recherche par référence : SKU, DIN, ISO en B2B — Heurix **(55)** |
| 14 | `blog/heurix-vs-algolia-typesense-sensefuel-doofinder.html` | Heurix vs Algolia, Typesense, Sensefuel, Doofinder : quel moteur pour quel besoin ? — Heurix **(92)** | Heurix vs Algolia, Typesense, Sensefuel, Doofinder — Heurix **(59)** |
| 15 | `blog/mesurer-pertinence-recherche.html` | Votre moteur trouve-t-il vraiment ? Mesurer la pertinence sans corpus de référence — Heurix **(91)** | Mesurer la pertinence sans corpus de référence — Heurix **(55)** |
| 16 | `blog/cascade-annotations-resultats-explicables.html` | « boulen M8 inpx » : ce que votre moteur a compris, et pourquoi il vous le montre — Heurix **(90)** | Cascade d'annotations : des résultats explicables — Heurix **(58)** |
| 17 | `blog/recherches-sans-resultat-tableau-bord.html` | Recherches sans résultat : le tableau de bord que la plupart des sites n'ont pas — Heurix **(89)** | Recherches sans résultat : le tableau de bord — Heurix **(54)** |
| 18 | `en/blog/heurix-vs-algolia-typesense-sensefuel-doofinder.html` | Heurix vs Algolia, Typesense, Sensefuel, Doofinder: which engine for which need? — Heurix **(89)** | Heurix vs Algolia, Typesense and Sensefuel compared — Heurix **(60)** |
| 19 | `en/blog/impact-ebitda-recherche-interne.html` | Poor internal search: what's the real impact on a B2B e-commerce site's EBITDA? — Heurix **(88)** | Internal search: the real impact on EBITDA — Heurix **(51)** |
| 20 | `en/blog/recherche-headless-api-sans-theme.html` | Headless search: what the response carries, and the URL your front end composes — Heurix **(88)** | Headless search: the response and the URL — Heurix **(50)** |
| 21 | `blog/recherche-headless-api-sans-theme.html` | Recherche headless : ce que la réponse porte, et l'URL que votre front compose — Heurix **(87)** | Recherche headless : la réponse et votre URL — Heurix **(53)** |
| 22 | `blog/tolerance-fautes-frappe-taille-catalogue.html` | Tolérance aux fautes de frappe : pourquoi une seule stratégie ne suffit jamais — Heurix **(87)** | Tolérance aux fautes de frappe dans un catalogue — Heurix **(57)** |
| 23 | `en/blog/alternative-algolia-catalogue-technique.html` | Algolia alternatives for a technical catalog: what each engine does with M8x30 — Heurix **(87)** | Algolia alternatives for a technical catalog — Heurix **(53)** |
| 24 | `en/blog/recherche-reference-sku-b2b.html` | How to configure search by reference (SKU, DIN, ISO) on a B2B e-commerce site? — Heurix **(87)** | Configuring search by reference: SKU, DIN, ISO — Heurix **(55)** |
| 25 | `blog/contrainte-prix-langage-naturel.html` | « Vis inox moins de 5 € » : une contrainte de prix, pas une recherche de mots — Heurix **(86)** | « Vis inox moins de 5 € » : une contrainte de prix — Heurix **(59)** |
| 26 | `en/blog/facettes-b2b-multi-attributs.html` | Faceted search in B2B: how to structure filters for multi-attribute products? — Heurix **(86)** | Faceted search in B2B: multi-attribute products — Heurix **(56)** |
| 27 | `blog/mode-retail-attributs-vetements.html` | « Pull col roulé laine taille M » : quatre vocabulaires, une seule recherche — Heurix **(85)** | Pull col roulé laine taille M : quatre vocabulaires — Heurix **(60)** |
| 28 | `blog/module-woocommerce-publie-bornes-mesurees.html` | Pourquoi la recherche WooCommerce ne trouve pas vos références produit (SKU) — Heurix **(85)** | Recherche WooCommerce : trouver vos références SKU — Heurix **(59)** |
| 29 | `en/blog/elasticsearch-lucene-catalogue-technique.html` | Elasticsearch and Lucene for a technical catalog: what you'll build yourself — Heurix **(85)** | Elasticsearch and Lucene for a technical catalog — Heurix **(57)** |
| 30 | `blog/rupture-stock-tri-recherche.html` | Un produit en rupture ne devrait jamais passer devant un produit disponible — Heurix **(84)** | Rupture de stock : le tri des résultats produit — Heurix **(56)** |
| 31 | `blog/multilingue-lang-recherche-federee.html` | Un catalogue, deux langues : le filtre qui suffit, la recherche qui fédère — Heurix **(83)** | Un catalogue, deux langues : recherche fédérée — Heurix **(55)** |
| 32 | `blog/regrouper-resultats-par-famille.html` | 6 582 résultats pour « vis M8 inox » : comment les ramener à 52 familles — Heurix **(81)** | Regrouper les résultats par famille de produits — Heurix **(56)** |
| 33 | `blog/agent-ia-catalogue-technique.html` | Ce qu'un agent IA trouve, et ne trouve pas, dans un catalogue technique — Heurix **(80)** | Ce qu'un agent IA trouve dans un catalogue — Heurix **(51)** |
| 34 | `blog/build-vs-buy-moteur-recherche.html` | Construire son moteur de recherche ou en acheter un : comment trancher — Heurix **(79)** | Moteur de recherche : construire ou acheter — Heurix **(52)** |
| 35 | `blog/guide-utilisation-console.html` | Guide d'utilisation de la console Heurix — piloter votre recherche au quotidien **(79)** | Guide de la console : piloter votre recherche — Heurix **(54)** |
| 36 | `blog/recherche-vectorielle-catalogues-techniques.html` | Pourquoi la recherche vectorielle échoue sur les catalogues techniques — Heurix **(79)** | Recherche vectorielle et catalogues techniques — Heurix **(55)** |
| 37 | `blog/guide-mise-en-route.html` | Guide de mise en route — de la souscription à l'installation complète — Heurix **(78)** | Guide de mise en route : souscrire et installer — Heurix **(56)** |
| 38 | `blog/recherche-blog-faq-contenu.html` | La recherche de votre blog ou de votre FAQ mérite aussi d'être bonne — Heurix **(77)** | La recherche de votre blog et de votre FAQ — Heurix **(51)** |
| 39 | `blog/refus-apres-ecriture-ordre-des-verifications.html` | Un refus qui n'empêche pas : l'ordre des vérifications dans une API — Heurix **(76)** | Un refus qui n'empêche pas : l'ordre des contrôles — Heurix **(59)** |
| 40 | `en/blog/custom-rules-personnaliser-moteur-recherche.html` | Custom Rules: personalize your search engine without writing regex — Heurix **(75)** | Custom Rules: personalize search without regex — Heurix **(55)** |
| 41 | `en/blog/guide-serveur-mcp-heurix.html` | Connecting Heurix to Claude Desktop and Cursor with the MCP server — Heurix **(75)** | Connecting Heurix to Claude Desktop and Cursor — Heurix **(55)** |
| 42 | `en/blog/agent-ia-catalogue-technique.html` | What an AI agent finds, and does not find, in a technical catalog — Heurix **(74)** | What an AI agent finds in a technical catalog — Heurix **(54)** |
| 43 | `blog/automobile-trois-equipementiers-trois-ecritures-reference.html` | Automobile — trois équipementiers, trois écritures de référence — Heurix **(72)** | Automobile : trois équipementiers, trois écritures — Heurix **(59)** |
| 44 | `blog/guide-serveur-mcp-heurix.html` | Connecter Heurix à Claude Desktop et Cursor avec le serveur MCP — Heurix **(72)** | Connecter Heurix à Claude Desktop et Cursor — Heurix **(52)** |
| 45 | `blog/prix-comptes-pro-visiteurs-anonymes.html` | Un prix pour vos comptes pro, aucun pour vos visiteurs anonymes — Heurix **(72)** | Un prix pour les comptes pro, aucun pour les autres — Heurix **(60)** |
| 46 | `blog/mise-en-avant-bundles-packs.html` | Mettre en avant un pack ou un bundle sans écraser la recherche — Heurix **(71)** | Mettre en avant un pack sans écraser la recherche — Heurix **(58)** |
| 47 | `en/solutions/automobile.html` | Car parts: a Bosch reference has nothing in common with a MANN \| Heurix **(71)** | Car parts: Bosch and MANN reference formats \| Heurix **(52)** |
| 48 | `solutions/automobile.html` | Pièces auto : une référence Bosch n'a pas la forme d'une MANN \| Heurix **(70)** | Pièces auto : formats de référence Bosch et MANN \| Heurix **(57)** |
| 49 | `blog/5-signes-recherche-vous-coute-des-ventes.html` | 5 signes que votre moteur de recherche vous coûte des ventes — Heurix **(69)** | 5 signes que votre recherche vous coûte des ventes — Heurix **(59)** |
| 50 | `blog/recherche-sans-resultat-corriger.html` | Une recherche ne remonte rien : la corriger en trois minutes — Heurix **(69)** | Une recherche sans résultat, corrigée en 3 minutes — Heurix **(59)** |
| 51 | `en/solutions/electricite.html` | Electrical: rating, sensitivity and cross-section kept apart \| Heurix **(69)** | Electrical: rating, curve and cross-section \| Heurix **(52)** |
| 52 | `blog/badge-prix-barre-recherche.html` | Le badge de réduction automatique que personne ne configure — Heurix **(68)** | Le badge de réduction automatique dans la barre — Heurix **(56)** |
| 53 | `mesure.html` | Ce que Heurix rattrape sur un catalogue de 2 821 références — Heurix **(68)** | Ce que Heurix rattrape sur 2 821 références — Heurix **(52)** |
| 54 | `solutions/industrie.html` | Roulements et pièces détachées : 6204-2RS trouvé au suffixe \| Heurix **(68)** | Roulements : 6204-2RS trouvé par son suffixe \| Heurix **(53)** |
| 55 | `blog/moteur-natif-ne-suffit-pas.html` | Pourquoi le moteur natif de votre plateforme ne suffit pas — Heurix **(67)** | Le moteur natif de votre plateforme ne suffit pas — Heurix **(58)** |
| 56 | `blog/cout-moteur-recherche-ecommerce.html` | Combien coûte un moteur de recherche e-commerce en 2026 ? — Heurix **(66)** | Combien coûte un moteur de recherche e-commerce — Heurix **(56)** |
| 57 | `en/blog/recherches-sans-resultat-tableau-bord.html` | Zero-result searches: the dashboard most sites don't have — Heurix **(66)** | Zero-result searches: the dashboard you need — Heurix **(53)** |
| 58 | `en/solutions/index.html` | Solutions by industry — search and product classification \| Heurix **(66)** | Solutions by industry: search and classification \| Heurix **(57)** |
| 59 | `blog/guide-page-categorie-browse.html` | Construire une page de catégorie avec Browse & Discovery — Heurix **(65)** | Construire une page de catégorie avec Browse — Heurix **(53)** |
| 60 | `solutions/index.html` | Solutions par secteur — recherche et classement produits \| Heurix **(65)** | Solutions par secteur : recherche et classement \| Heurix **(56)** |
| 61 | `solutions/mode.html` | Mode & retail : quatre vocabulaires, une seule recherche \| Heurix **(65)** | Mode & retail : quatre vocabulaires produit \| Heurix **(52)** |
| 62 | `blog/mettre-en-avant-une-promotion.html` | Mettre en avant une promotion sans casser vos résultats — Heurix **(64)** | Mettre en avant une promotion dans la recherche — Heurix **(56)** |
| 63 | `en/blog/cout-moteur-recherche-ecommerce.html` | How much does an e-commerce search engine cost in 2026? — Heurix **(64)** | How much does an e-commerce search engine cost — Heurix **(55)** |
| 64 | `blog/tutoriel-catalogue-outillage-5-minutes.html` | Indexez votre premier catalogue outillage en 5 minutes — Heurix **(63)** | Indexer un catalogue outillage en 5 minutes — Heurix **(52)** |
| 65 | `en/blog/build-vs-buy-moteur-recherche.html` | Build your own search engine or buy one: how to decide — Heurix **(63)** | A search engine: build your own or buy one? — Heurix **(52)** |
| 66 | `en/solutions/industrie.html` | Bearings and spare parts: 6204-2RS found by its suffix \| Heurix **(63)** | Bearings and spare parts: 6204-2RS by suffix \| Heurix **(53)** |
| 67 | `en/solutions/mode.html` | Fashion & retail: four vocabularies, one single search \| Heurix **(63)** | Fashion & retail: four product vocabularies \| Heurix **(52)** |
| 68 | `en/blog/module-woocommerce-publie-bornes-mesurees.html` | Why WooCommerce search doesn't find your product SKUs — Heurix **(62)** | WooCommerce search does not find your SKUs — Heurix **(51)** |
| 69 | `en/blog/moteur-natif-ne-suffit-pas.html` | Why your platform's native search engine isn't enough — Heurix **(62)** | Your platform's native search is not enough — Heurix **(52)** |
| 70 | `faq.html` | Moteur de recherche e-commerce : questions fréquentes — Heurix **(62)** | Questions fréquentes sur la recherche e-commerce — Heurix **(57)** |
| 71 | `solutions/electricite.html` | Électricité : calibre, sensibilité et section séparés \| Heurix **(62)** | Électricité : calibre, courbe et section de câble \| Heurix **(58)** |
| 72 | `solutions/plomberie.html` | Plomberie : filetages en pouces et diamètres nominaux \| Heurix **(62)** | Plomberie : filetages en pouces et diamètres \| Heurix **(53)** |
| 73 | `en/blog/mise-en-avant-bundles-packs.html` | Highlighting a pack or bundle without burying search — Heurix **(61)** | Highlighting a pack without burying search — Heurix **(51)** |
| 74 | `en/blog/recherche-sans-resultat-corriger.html` | A search returns nothing: fixing it in three minutes — Heurix **(61)** | A search returns nothing: fix it in 3 minutes — Heurix **(54)** |
| 75 | `en/faq.html` | E-commerce search engine: frequently asked questions — Heurix **(61)** | Frequently asked questions on e-commerce search — Heurix **(56)** |
| 76 | `integrations.html` | Intégrer un moteur de recherche interne sur son site — Heurix **(61)** | Intégrer un moteur de recherche sur votre site — Heurix **(55)** |

---

## 6. Aucun title n'a résisté

**Les 76 tiennent entre 50 et 60 caractères, marque comprise, en gardant leur
terme principal. Aucun n'a dû être laissé long.** Le suffixe de marque coûte
9 caractères (`" — Heurix"` ou `" | Heurix"`), donc le corps éditorial tient
entre 41 et 51.

Trois cas ont demandé un arbitrage, et il est écrit ici plutôt que caché :

1. **`blog/heurix-vs-algolia-typesense-sensefuel-doofinder.html` et sa version
   anglaise.** Les quatre noms de concurrents font 49 caractères à eux seuls ;
   la version FR les garde tous les quatre, la version EN en garde trois et
   ajoute *compared* — sans quoi les deux pages porteraient **le même title**,
   ce que le témoin d'unicité refuse. Le quatrième nom reste dans le `h1`, la
   `meta description` et le corps des deux pages.
2. **`blog/guide-utilisation-console.html`** ne finissait pas par la marque :
   son title était *« Guide d'utilisation de la console Heurix — piloter votre
   recherche au quotidien »*, marque au milieu. La forme courte prend le
   suffixe standard, et la marque n'apparaît plus qu'une fois.
3. **`mesure.html`** portait `og:title` et `twitter:title` **sans** le suffixe
   de marque, là où 75 des 76 pages les tenaient égaux au `<title>`. Ce n'est
   pas un défaut mais une convention de carte sociale, et elle est conservée :
   les deux champs suivent la forme courte *privée de son suffixe*.

### 6.1 `og:title` et `twitter:title` suivent, et pourquoi

`tests/solutions-titres.test.js` exige depuis le 26 août 2026 que
`og:title` et `twitter:title` **valent** le `<title>` sur les 24 pages
`solutions/`. Le défaut qu'il a attrapé est réel : six pages annonçaient
« À propos d'Heurix » en `twitter:title` parce que leur gabarit venait
d'`about.html`.

Laisser les champs sociaux sur l'ancien titre long aurait donc :
soit fait rougir ce garde sur 11 pages, soit demandé de l'excepter — c'est-à-dire
de désarmer, pour ce lot, le garde qui surveille exactement cette divergence.
Mesure : **75 des 76 pages portaient déjà `og:title` == `<title>`**.
L'accord est l'état existant ; il est préservé. 150 champs ont suivi le
`<title>`, 2 l'ont suivi sans son suffixe (`mesure.html`), **0 n'a été
écrasé** — la relation de chaque page est relue avant d'être réécrite.

### 6.2 `og:description` ne suit PAS, et pourquoi

Les dix descriptions raccourcies gardent leur **argument entier** en
`og:description`. Une carte sociale n'a pas la limite de 160 caractères d'un
résultat de recherche, et aucun test du dépôt n'exige l'égalité des deux
champs — vérifié. Raccourcir les deux aurait perdu du texte sans rien gagner.
**Les deux champs divergent donc sur ces dix pages, et c'est une décision.**

Elle est écrite dans l'en-tête du bloc `meta description` de
`tests/metadonnees-tete.test.js`, pour que personne ne la « répare » en
recopiant l'un sur l'autre.

### 6.3 Les dix descriptions

| page | avant | après |
|---|---|---|
| `blog/recherche-native-prestashop-mesuree.html` | 198 | 157 |
| `blog/alternative-algolia-catalogue-technique.html` | 196 | 155 |
| `en/blog/alternative-algolia-catalogue-technique.html` | 195 | 147 |
| `blog/decoupage-rag-catalogue-produit.html` | 188 | 158 |
| `shopify.html` | 185 | 154 |
| `blog/mesurer-pertinence-recherche.html` | 181 | 160 |
| `en/blog/recherche-native-prestashop-mesuree.html` | 178 | 160 |
| `blog/tests-qui-ne-peuvent-pas-echouer.html` | 169 | 156 |
| `blog/refus-apres-ecriture-ordre-des-verifications.html` | 161 | 137 |
| `blog/agent-ia-catalogue-technique.html` | 161 | 154 |

Chaque chiffre, chaque version et chaque aveu des textes d'origine est
conservé. Exemple, la plus longue : « Mesure sur PrestaShop 9.1.4 :
*rondele* trouve *rondelle*, **contre notre page**. Le vrai défaut : M8 n'est
pas indexé, et une faute désactive la correction. » — les quatre affirmations
de la version à 198 caractères y sont, y compris celle qui nous donne tort.

---

## 7. Les témoins, et ce qu'ils ne voient pas

Tout vit dans `tests/metadonnees-tete.test.js`, 14 assertions, qui partage le
périmètre de `tests/pages-indexables.js` avec les trois gardes du lot
précédent.

### 7.1 Les règles

| règle | état mesuré |
|---|---|
| aucun `title` > 60 | 0 |
| aucun `title` < 30, hors dette | dette de **10** pages nommées |
| aucun `title` en double, **sur les 174 fichiers** | 0 |
| chaque `title` finit par la marque | **2** exceptions motivées |
| aucun `title` ne coupe un mot | 0 |
| aucune `description` > 160 | 0 |
| aucune `description` vide ou < 70, hors dette | dette de **3** pages |
| périmètre non vide, et ≥ 140 | 140 |

**Deux dettes nommées, pas un seuil abaissé.** Dix titles sont déjà sous 30
caractères — *« About — Heurix »* (14), *« Contact us — Heurix »* (19),
*« Tarifs Search API — Heurix »* (26)… Ce sont des pages à nom court dont le
title ne porte aucun terme de recherche : un défaut réel, et un lot à part,
puisque l'allonger demande de décider quel terme chaque page vise.
**`pricing.html` en fait partie et n'était pas modifiable** (correctif 1.2.1
sous examen Shopify). Chaque dette est relue par une assertion qui échoue si
l'entrée est réparée, et une autre si la page quitte le périmètre.

**Deux exceptions de marque :** `index.html` et `en/index.html` portent la
marque **en tête** — *« Heurix — Moteur de recherche & discovery pour le
e-commerce »*. L'assertion de péremption vérifie qu'elles commencent toujours
par `Heurix`, qu'elles n'ont pas pris le suffixe, et que leur raison est
lisible.

### 7.2 La règle du mot coupé, et ce qu'elle a coûté

Le défaut d'origine est une **troncature du titre éditorial** : le `title`
valait le `h1` plus la marque. La règle s'appuie donc sur le `h1` : si le
dernier mot du `title` n'est pas un mot du `h1` mais en **préfixe** un, c'est
une coupe. *« …pourquoi leurs moteu »* → `moteu` préfixe `moteurs` : rouge.
Zéro faux positif sur les 76 formes courtes, et les trois troncatures brutales
essayées sont attrapées.

**Une règle a été retirée après mesure**, et c'est le fait le plus utile de
cette section. « Un fragment fait un ou deux signes » paraissait évidente :
elle a signalé **six titles légitimes** — *« Contact us »*, *« USB-C et Go »*,
*« USB-C and GB »*, *« DIN 933, inox A2 »*, *« surface en m² »* (deux fois).
Ce site a pour sujet les jetons techniques courts : une unité, un grade
d'acier et un pronom anglais y terminent une phrase sans rien couper. La règle
a été **retirée plutôt qu'exceptée** — dix exceptions pour une règle fausse ne
font pas une règle juste.

### 7.3 Ce qu'ils ne voient pas

1. **Le sens.** Aucune assertion ne lit le contenu du `title`. *« Heurix
   Heurix Heurix Heurix Heurix Heurix Heurix — Heurix »* fait 57 caractères,
   finit par la marque, ne coupe aucun mot, n'est porté par personne d'autre :
   **vert sur les quatre règles**. Ce qui couvre ce cas est la relecture
   humaine des 76 couples, au §5 — pas ce fichier.
2. **La troncature qui tombe sur une espace.** *« Moteurs natifs : la limite
   des 10 000 »* est un `title` tronqué, complet au sens de la règle du mot
   coupé. Aucune règle mécanique ne le distingue d'une forme courte voulue.
3. **Le terme principal.** Rien ne vérifie que le `title` raccourci a gardé le
   terme sur lequel la page peut être trouvée. C'est le cœur du lot, et il
   n'est gardé par aucun test : les deux sources du terme (slug et `h1`) sont
   lues à la main au §4. Un futur `title` qui perdrait son terme passerait
   toutes les règles.
4. **Ce que le moteur affiche vraiment.** 60 caractères est une convention,
   pas une mesure : Google coupe sur une largeur en pixels, pas sur un nombre
   de signes, et une suite de majuscules est coupée plus tôt qu'une suite de
   `i`. Aucun test de ce dépôt ne mesure une largeur.
5. **La page servie.** Comme tous les gardes de ce dépôt, celui-ci lit des
   fichiers. Le site publié n'est lu par aucun test.
6. **`og:title` hors des pages `solutions/`.** `solutions-titres.test.js`
   exige l'égalité des trois champs sur 24 pages ; sur les 116 autres, rien ne
   l'exige. Le présent lot l'a maintenue partout **à la main**, et rien ne le
   garde.

### 7.4 Vers quoi aucun n'a jamais été pointé

- **Les 34 pages hors périmètre.** Le fragment, les 12 pages hors site et les
  21 `noindex` échappent aux règles de longueur — sauf l'unicité, qui est le
  seul garde de ce fichier à scanner les **174** fichiers suivis.
- **La cohérence `title` ↔ `description`.** Un `title` sur un sujet et une
  description sur un autre : les deux passent, chacun dans ses bornes.
- **La durée de vie.** Rien ne relit un `title` contre l'évolution du contenu
  de sa page. Un article réécrit garde le `title` du lot du 20 octobre.

---

## 8. Mutations

Onze mutations. Pour chacune : **vert exigé avant de muter**, nombre de
fichiers que `git status` voit changer **compté et affiché avant de lire la
couleur**, restauration par l'inverse exact depuis la liste des fichiers
mutés, arbre vérifié propre, puis vert à nouveau. Toutes les variables de
shell sont quotées et les chemins de test sont des arguments séparés.

| # | mutation | fichiers mutés | verdict |
|---|---|---|---|
| 1 | `faq.html` : `title` porté à 96 caractères | 1 | 1 échec — `96 car.` |
| 2 | `integrations.html` : `title` à 21 caractères, hors dette | 1 | 1 échec — *un title trop court ne porte aucun terme* |
| 3 | **le même `title` de 60 caractères sur deux pages** | 2 | 2 échecs — doublon **et** dette périmée |
| 4 | `mesure.html` : `title` privé de son suffixe de marque | 1 | 1 échec |
| 5 | `blog/synonymes…` : `h1` + marque **coupé à 51 caractères** | 1 | 2 échecs — marque absente **et** `« vocabulai » préfixe vocabulaire du h1` |
| 6 | `blog/agent-ia…` : description portée à 171 | 1 | 1 échec |
| 7 | `shopify.html` : description **vidée** | 1 | 1 échec — `0 car.` |
| 8 | `blog/tests-qui…` : description à 40 caractères, hors dette | 1 | 1 échec |
| 9 | `en/blog.html` : description de dette **réparée** (l'autre sens) | 1 | 1 échec — *retirez-la de la dette* |
| 10 | `secteurs.html` passée en `noindex` | 1 | 1 échec — `139 >= 140` |
| 11 | **les 140 pages** passées en `noindex` | **140** | 5 échecs |

**La mutation 11 répond à la question de fond.** Périmètre à zéro : les deux
assertions de périmètre et les trois assertions de péremption (dettes et
exceptions, qui signalent que leurs pages sont sorties du périmètre)
rougissent. **Neuf assertions sortent vertes sur zéro page** — longueurs,
marque, mot coupé, description. Sans les assertions de périmètre, ce serait
14 passed / 0 failed.

**Et l'unicité ne s'effondre pas avec le périmètre**, parce qu'elle est le seul
garde de ce fichier à scanner les 174 fichiers suivis et non les 140
indexables. Sous la mutation 11 elle reste verte **et garde son sens**.

### 8.1 L'unicité resterait-elle verte sur deux pages seulement ?

**Non.** La mutation 3 est exactement ce cas : le même `title` de 60
caractères posé sur `integrations.html` et `en/integrations.html`, et sur
elles seules. Verdict :

```
integrations.html :: identique a en/integrations.html
  — « Recherche interne pour un catalogue assez technique — Heurix »
```

L'assertion compare chaque `title` à tous ceux déjà vus, par une `Map`
accumulée page par page : **une seule collision suffit**, il n'y a aucun
seuil, aucune proportion, aucune tolérance. La longueur est sans effet — ce
`title` de 60 caractères satisfait la règle des 60, celle des 30, celle de la
marque et celle du mot coupé ; il échoue sur l'unicité seule. C'est la
démonstration que les cinq règles sont indépendantes.

Ce qu'elle ne couvrirait pas : deux pages dont les `title` **diffèrent d'un
seul caractère**. Ils sont distincts pour cette assertion, et concurrents pour
un moteur.

---

## 9. État

- `npx vitest run` : **105 fichiers, 1129 tests, tous verts** (1115 avant le
  lot ; 14 assertions ajoutées).
- `scripts/index-recherche.py --verifier` : à jour, 140 pages. Les deux index
  dérivés ont été régénérés — ils stockent le `<title>`.
- `scripts/sitemap-lastmod.py` relancé.
- `h1`, `headline` des `BlogPosting`, `blog.html`, `pricing.html` et
  `en/pricing.html` : **absents du diff**, vérifié sur le diff et non supposé.
