# Chiffres de performance du site : sources et mesure - relevé du 11 septembre 2026

Lu sur :

- heurix-site `96e0558a` (main = origin/main, vérifié par `ls-remote`), worktree `chiffres-sources`.
- heurix-engine `bd6d2b9` (main = origin/main, même vérification), lu par `git show origin/main:`.
- Production : `/health` rend `git_sha 4c9ea02`, ancêtre de origin/main (5 commits de retard).
- Modules : `heurix-prestashop` et `heurix-woocommerce`, `HEAD` de chaque dépôt (pas les archives publiées).

Balayage : les 154 pages suivies (87 FR, 67 EN) et `llms.txt`, balises et scripts retirés, sur quatre familles de motifs (durées, pourcentages, multiplicateurs, volumes), puis un second passage pour les nombres en lettres (« une seconde », « une minute », « quelques secondes »). Témoin positif du premier passage : les 9 lignes « ≈ 10 ms » trouvées par `git grep` sont toutes rendues.

---

## 1. Les chiffres, leur source, leur verdict

### Performance du moteur

| Chiffre | Où | Ce qu'il prétend | Source | Verdict |
|---|---|---|---|---|
| « ≈ 10 ms », `median_query_time` | `index.html:354`, `:406`, `produit.html:226`, `:331`, `en/index.html:328`, `:379`, `:438`, `en/produit.html:219`, `:324` | temps de réponse médian **du moteur**, sur un catalogue de 10 000 produits | **Aucune.** Introduit par `a9795097` (19 juillet 2026, message « opti »). Le dépôt du moteur commence le 26 juillet (`10bfe55`) ; `bench_latence.py` naît le 5 août (50 000 produits, local), `bench_latence_production.py` le 25 août (3 000, local). Aucun catalogue de production n'a 10 000 produits. Le champ `median_query_time` n'existe nulle part dans le moteur. | **Ne tient pas.** Remplacé par la mesure (section 2). |
| `benchmark_index 10 000 refs` | même bloc, 4 pages | le catalogue de la mesure précédente | idem | **Ne tient pas.** Remplacé par 2 821 refs (public-demo). |
| « 80 ms » (consigne, pas sur le site) | - | - | curl sur une autre route | Compatible avec un aller-retour **sur connexion neuve** : environ 30 ms de TCP + TLS mesurés, plus la médiane de 46 ms. Pas un temps moteur. |
| « 6 secondes pour 10 000 produits, une minute pour 100 000 » | `docs.html:945`, `en/docs.html:941` | durée d'une réindexation (changement de pack) | Un commentaire, `heurix/index.py:1596`, déposé le 2 août par `148990a` (synchronisation). Antérieur au correctif d'indexation `58295d8` (8 août, 108 s → 64 s à 250 000 produits), machine non dite. « Une minute pour 100 000 » est une extrapolation linéaire d'un coût alors quadratique (`index.py:306`). | **Ne tient pas.** Retiré. Pas mesurable en production sans écrire dans un catalogue. |
| « une seconde par tranche de 10 000 produits » | `docs.html:940`, `en/docs.html:936` | durée de l'indexation elle-même | Aucune. Contredit le paragraphe suivant de la même page (6 s) et `58295d8` (environ 2,6 s pour 10 000 en mode masse). | **Ne tient pas.** Retiré. |
| « 6 582 résultats → 52 familles », « M8×30, M8×80, M8×35, M8×6 » | bloc `#moteur` (4 pages), `docs.html:687-688`, `en/docs.html:683-684`, `blog/regrouper-resultats-par-famille.html:167` et EN | effet du regroupement par famille, « mesuré sur un catalogue de 10 000 références » | Un commentaire, `heurix/search.py:1843` (29 juillet). Catalogue non identifié. La route publique ne transmet pas `group_by` : non refaisable sans clé. | **Source faible. Non modifié**, à trancher. |
| Le temps affiché par le widget de l'accueil (« 64 ms ») | `demo-search-live.js:424`, `:451` | rien d'écrit : un éclair et « ms » | `performance.now()` autour du `fetch` : aller-retour complet vu du navigateur du visiteur, réseau compris. Le commentaire du code le dit, la page non. | **Tient** (vraie mesure). Ce qu'elle mesure n'est pas dit au visiteur. Non modifié. |

### Délais des modules et des widgets

| Chiffre | Où | Source | Verdict |
|---|---|---|---|
| « si Heurix ne répond pas en une seconde » | `index.html:93`, `:544`, `faq.html:105`, `:310`, `prestashop.html:195` et leurs 5 équivalents EN | WooCommerce : `'timeout' => 3` (`class-heurix-api-client.php:79`). PrestaShop : `$timeout = 3` par défaut, réglable, minimum 1 (`HeurixClient.php:61`, `:69`). | **Ne tient pas.** Remplacé par trois secondes. |
| « retenté une minute plus tard » | `faq.html:105`, `:310` et EN | PrestaShop : pause de 60 s (`HeurixClient.php:24`). WooCommerce : disjoncteur de 60 s, **après 3 échecs** dans la fenêtre (`class-heurix-circuit-breaker.php:27`, `:35`). | **Tient pour PrestaShop, approximatif pour WooCommerce.** Non modifié. |
| « abandonné au bout de 5 secondes » | `blog/guide-page-categorie-browse.html:246` et EN | `RAYON_TIMEOUT_MS = 5000` (`downloads/heurix-browse-widget.js:129`) | **Tient.** |

### Pertinence et volumes

| Chiffre | Où | Source | Verdict |
|---|---|---|---|
| « +28 points de rappel », 69 % / 97 %, 300 requêtes, 271 fiches | `mesure.html:159-179` et EN | mesure datée du 2 septembre 2026, méthode décrite sur la page. Aucun banc BM25 versionné dans les deux dépôts : « demandez-les ». | **Tient sur la page.** Reproductible seulement sur demande. |
| « 846 résultats » sur `vis`, avec les épingles | bloc « Ce que le marchand garde en main », `mesure.html:200-230` ; `en/mesure.html:230` | revérifié le 4 septembre selon la page | **Ne tient pas, instruit (section 4)** : les règles françaises sont perdues (identifiants 30 à 70 de `search_query_overrides`), non reposées. Bloc FR retiré ; phrase EN sur le catalogue français corrigée. La démonstration EN (574, trois épingles à 0.00) tient. |
| 2 821 produits (public-demo) | `mesure.html:148` et ailleurs | sonde `q` vide du 11 septembre : 2 821 (outillage et outillage-en), 1 500 (mode) | **Tient.** |
| « 2 fautes tolérées par mot », `typo_tolerance 2/mot · 1/référence` | bloc `#moteur`, carte « 2 fautes » (4 pages), `en/index.html:410` | `heurix/fuzzy.py:3-8` : 0 faute jusqu'à 3 caractères, 1 de 4 à 7, 2 à partir de 8, 1 sur un jeton porteur de chiffres | **Plus large que le code.** Pas un chiffre de performance ; non modifié. |

### Hors du moteur, non traités ici

- **Chiffres de marché cités** : Berner +20 % (`index.html:338`, renvoie à `roi.html`) ; `roi.html` (10-20 % du trafic, 30-50 % du chiffre d'affaires, curseurs) dit « cas clients publics FactFinder & Sensefuel », sans lien ; Harris Poll 53 % (`mesure.html:236`), avec lien ; les fourchettes de conversion des articles de blog (5-15 %, 3-10 %), sans source.
- **Durées d'usage** : « Démarrer en 5 minutes » (138 lignes, gabarit de navigation), « quelques minutes ». Ce ne sont pas des mesures du moteur.
- **Contradiction de comportement**, pas de chiffre : pendant une réindexation, `docs.html:945` dit que les recherches sont « mises en attente », alors que `blog/guide-utilisation-console.html:196` dit que la recherche continue sur l'ancien index. Le moteur (`index.py:1597-1602`, clone puis bascule) va dans le sens du blog.

---

## 2. Ce que le moteur rend en production

### Conditions

- **Date** : 11 septembre 2026, 22:23-22:28.
- **Route** : `POST /v1/public-demo/search`, avec le même corps que le widget de l'accueil (`limit 9`, facettes `categories` et `marque`, `exclude_description`, `include_highlights`).
- **Production** : `4c9ea02`, derrière nginx, IP 146.59.202.238.
- **Poste** : celui qui a lancé la mesure, pas le serveur. Sur 5 connexions neuves vers `/health` : 11 ms de TCP, environ 16 ms de TLS, et un premier octet de `/health` à environ 15 ms sur connexion ouverte.
- **Méthode** : une seule connexion HTTPS gardée ouverte. Chaque recherche est précédée d'un `/health` sur cette connexion, et le temps serveur s'estime par TTFB(recherche) − TTFB(health), apparié échantillon par échantillon.
- **Corpus** : outillage (`public-demo`, 2 821 produits), mode (`public-demo-mode`, 1 500) et outillage-en (`public-demo-en`, 2 821). 5 requêtes par corpus, 8 répétitions chacune.
- **Banc** : `scripts/mesure-latence-demo.py`. Données brutes : `docs/mesures/latence-demo-2026-09-11.jsonl`.

### Résultats (ms)

| | n | aller-retour min / méd / p90 / max | serveur estimé min / méd / p90 / max |
|---|---|---|---|
| outillage (2 821) | 40 | 26 / 49 / 81 / 110 | 9 / 35 / 66 / 93 |
| mode (1 500) | 40 | 20 / 37 / 56 / 76 | 8 / 21 / 39 / 55 |
| outillage-en (2 821) | 40 | 22 / 47 / 79 / 158 | ~0 / 34 / 57 / 141 |
| **tout** | **120** | **20 / 46 / 76 / 158** | **~0 / 30 / 57 / 141** |

Par requête, la médiane du temps serveur va de **12 ms** (`robe`, 53 résultats ; `M8x20` en anglais, 209) à **68 ms** (`perceuse sans fil 18v`, 1 987 résultats). Le temps croît avec le nombre de résultats.

| requête | résultats | aller-retour méd. | serveur méd. |
|---|---|---|---|
| outillage `vis` | 845 | 49 | 35 |
| outillage `vis inox m8` | 1 441 | 55 | 39 |
| outillage `M8x20` | 209 | 32 | 17 |
| outillage `boulno M8` | 414 | 39 | 23 |
| outillage `perceuse sans fil 18v` | 1 987 | 86 | 68 |
| mode `pull` | 224 | 34 | 18 |
| mode `pull col roulé rouge` | 639 | 47 | 28 |
| mode `pul col rolé roug` | 556 | 42 | 26 |
| mode `jean slim` | 765 | 38 | 23 |
| mode `robe` | 53 | 27 | 12 |
| outillage-en `screw` | 1 154 | 46 | 28 |
| outillage-en `stainless screw m8` | 1 699 | 64 | 45 |
| outillage-en `M8x20` | 209 | 30 | 12 |
| outillage-en `stainles screw` | 1 388 | 58 | 43 |
| outillage-en `cordless drill` | 699 | 52 | 38 |

**Première occurrence** : la première passe de chaque requête a un temps serveur médian de 44 ms, contre 27 ms pour les suivantes. Un visiteur qui tape une requête nouvelle est plus près du premier chiffre.

### Ce que cette mesure ne dit pas

- Un visiteur plus loin du serveur, ou sur mobile : il ajoute son propre aller-retour réseau. Seuls les 11 ms de ce poste sont mesurés.
- La première recherche d'une visite : elle paie en plus TCP et TLS, environ 30 ms depuis ce poste.
- La charge : une requête à la fois, serveur sans autre trafic connu.
- Un catalogue de plus de 2 821 produits : aucun n'est public en production.
- La route authentifiée `/v1/index/{catalogue}/search` : même `run_search`, non mesurée ici faute de clé (celle du serveur MCP rend 403).

### Coût

**123 recherches** : 3 sondes `q` vide, que `public_demo_search` ne journalise pas (`if body.q:`), et 120 recherches journalisées sous `__public_demo__`. Ces 15 requêtes distinctes, 8 fois chacune, apparaîtront dans les statistiques de la démo. S'y ajoutent 124 `GET /health` et 11 `curl /health` à la main, qui ne comptent pour rien. Aucun 429.

---

## 3. Ce qui est écrit à la place

| Page | Avant | Après |
|---|---|---|
| bloc `#moteur`, 4 pages | `benchmark_index 10 000 refs` / `median_query_time ≈ 10 ms` | `benchmark_index 2 821 refs (public-demo)` / `round_trip 20 à 160 ms · médiane 46 ms` |
| carte, 4 pages | « ≈ 10 ms / Réponse instantanée / Temps de réponse médian du moteur, mesuré sur un catalogue de 10 000 produits » | « 20 à 160 ms / Aller-retour mesuré », puis les conditions : date, corpus, 120 appels, médiane, distance du poste, part du moteur |
| `en/index.html:438` | « ≈ 10 ms response time on a 10,000-product catalog… no perceptible lag » | « A measured round trip of 20-160 ms on our 2,821-product demo catalog » |
| `docs.html` et EN | « une seconde par tranche de 10 000 », « 6 secondes pour 10 000, une minute pour 100 000 » | retirés ; la phrase sur l'attente des recherches reste |
| repli, 10 emplacements | « en une seconde » | « trois secondes » (PrestaShop : « délai par défaut, réglable ») |
| `mesure.html`, bloc « Ce que le marchand garde en main » (lignes 200-230) | trois épingles sur `vis`, 846 résultats, coffret à 0,00, invitation à retrouver 846 | **retiré**, section entière |
| `en/mesure.html:230` | « `outillage` is the French one — the same three pins, but 846 results » | « it carries no pins: on 11 September 2026 the same query returned 845 results there, none of them pinned » |

La fourchette affichée est l'aller-retour complet, min-max des 120 appels. Aucun chiffre n'a été choisi parmi plusieurs : la médiane accompagne la fourchette, elle ne la remplace pas.

---

## 4. La requête `vis` sur le catalogue français - instruite le 11 septembre 2026

Lu sur :

- heurix-site `c19df2d9` (origin/main après la fusion de `chiffres-sources`), worktree `epingles-vis`.
- heurix-engine `bd6d2b9` (origin/main).
- Production : `/health` rend `git_sha 4c9ea02`.

### L'appel

- **Date** : 11 septembre 2026, 22:51:06 +0200 (en-tête `Date` de la réponse : 20:51:06 GMT).
- **Commande** : celle que la page publiait (`mesure.html:223-224` avant ce lot), lancée une seule fois :

  ```
  curl -X POST 'https://api.heurix.fr/v1/public-demo/search?vertical=outillage' -H 'Content-Type: application/json' -d '{"q":"vis","limit":20}'
  ```

- **Réponse** : HTTP 200, 13 408 octets. Donnée brute : `docs/mesures/vis-public-demo-2026-09-11.json`.
- **Rendu** : `total` 845. Les 20 résultats rendus portent tous `"pinned": false` et `"score": 25.76`. Premier résultat : `demo-gen-000091`, « Vis BTR M10-60 inox A4 ». Ni NEO TOOLS ni FISCHER dans la réponse ; DEWALT seulement dans `highlighted_bundle` (la tuile « Pack recommandé »), pas dans `hits`.
- **Accord** avec les 8 recherches `vis` de 22:23-22:28 (section 2) : 845 elles aussi.

Cette mesure ne se rejouera pas : le catalogue et ses règles ont changé depuis que la page a été écrite. C'est pour cela que la réponse est versée.

### Le moteur n'est pas en cause

- `heurix/routers/public.py`, `search.py`, `index.py` et `ranking.py` sont identiques entre `4c9ea02` (production) et `bd6d2b9`.
- Le point public passe toujours `search_query_overrides_for(nom)` à `run_search` (`heurix/routers/public.py:249`), correctif du 4 septembre (`192dd2d`) compris.
- `test_public_demo_applique_les_surcharges_de_merchandising` est vert (`-k public_demo`, 2 tests), lancé sur le code du worktree.

### Ce que la table dit en production

Lecture de `search_query_overrides` en production, faite hors de cette session le 11 septembre au soir :

- 4 lignes en tout.
- Les trois épingles `vis` existent sur `public-demo-en`, actives, datées du 2 septembre. La démonstration de `en/mesure.html` (574, trois épingles à 0.00, FISCHER, NEO TOOLS, DEWALT dans cet ordre) a été vérifiée le même soir, hors de cette session.
- Aucune ligne sur `public-demo` pour `vis`. Les identifiants 30 à 70 ont disparu ; les épingles françaises étaient dedans.
- Seule ligne française restante : « rondelle », statut `inactive`, modifiée le 5 septembre à 09:25, le lendemain de la revérification de la page. Fuseau non établi : `set()` écrit en UTC (`heurix/index.py:1148`), mais le chemin qui a modifié cette ligne n'est pas identifié. Rien ne dit ce qui a touché la table ce jour-là.

Aucune table ne garde l'historique des règles de merchandising : la disparition n'a laissé aucune trace, et seule une requête rejouée l'a montrée. Pris à part, comme lot moteur.

### Pourquoi les épingles ne sont pas reposées

Les deux catalogues ne portent pas le même stock : côté français, des boîtes de 100 vis FISCHER, et pas de coffret 31 embouts NEO TOOLS ; les produits anglais n'existent pas sous ces identifiants. Trois épingles nouvelles rendraient le bloc exact sur le total et faux sur ce qu'il raconte : noms, scores. Et rien ne garantit qu'elles ne disparaîtraient pas encore.

### Pourquoi le bloc est retiré entier

Sans épingles, il reste 845 et une égalité en tête : 20 sur 20 à 25,76 dans l'appel ci-dessus. Les « 41 à égalité » ne sont pas revérifiés ; il aurait fallu deux appels de plus, pour un chiffre qu'on ne publiera pas. Ce reste montre que le mot « vis » ne départage rien, pas que le marchand y remédie. Un renvoi à la démonstration anglaise démontrerait sur une autre page et un autre catalogue.

### Coût

1 recherche, journalisée sous `__public_demo__`. S'y ajoute 1 `curl /health`, qui ne compte pour rien. Aucun 429.
