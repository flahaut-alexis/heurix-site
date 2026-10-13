# Node 20 déprécié : montée des actions dans trois dépôts (14 octobre 2026)

Relevé du lot qui monte en `v7` les actions GitHub restées en `v4`/`v5` dans
`heurix-engine`, `heurix-woocommerce` et `heurix-site`, à la suite de
heurix-shopify (`8de6b57`) et de la garde de ce dépôt (`36e22e6b`).

Ce fichier existe parce que les trois messages de commit ont été écrits
**avant** les passages de CI et ne portent donc pas leur vérification.
L'association entre un passage et son SHA existe déjà dans GitHub ; ce qui
manquait était un enregistrement lisible. Les commits n'ont pas été réécrits
pour l'obtenir.

Les trois ont été fusionnés sur `main` le 14 octobre 2026 vers 00:25, pendant
la rédaction de ce relevé. Ce qui reste sur branche : le désarmement du garde
dans le banc GIL (moteur) et ce fichier avec la contrainte de `CLAUDE.md`.

## Ce qui a été monté

| dépôt | branche | commit | montées |
|---|---|---|---|
| heurix-engine | `actions-node24-moteur-14oct` | `f96e5f5` | 7 × checkout, 2 × setup-python, 2 × upload-artifact |
| heurix-woocommerce | `actions-node24-woo-14oct` | `61c244f` | 2 × checkout |
| heurix-site | `actions-node24-site-14oct` | `519c6e34` | 5 × checkout, 1 × setup-python, 1 × setup-node |

Majors courants au 14 octobre 2026, lus par
`gh api repos/<action>/releases/latest` : checkout `v7.0.1`, setup-node
`v7.1.0`, setup-python `v7.0.0`, upload-artifact `v7.0.2`.

Non touchés, parce que vérifiés hors de cause dans leur `action.yml` :
`shivammathur/setup-php@v2`, `Swatinem/rust-cache@v2`, `actions/github-script@v9`
et `actions/deploy-pages@v5` sont `using: node24` ;
`dtolnay/rust-toolchain@stable`, `actions/upload-pages-artifact@v5` et
`.github/actions/linters` sont composites ; `garde-demo.yml` reste en
`checkout@v5` depuis `36e22e6b`.

## Méthode de comptage

**La méthode fait partie de la mesure.** Les comptes ci-dessous viennent des
**annotations du job, dédupliquées par message, avec `--paginate`, la
conclusion du job lue avant le compte** — jamais de `gh run view --log`.
La règle et le pourquoi sont dans `CLAUDE.md`, section « Compter un
avertissement de runner ».

```bash
gh api --paginate repos/<o>/<r>/check-runs/<job_id>/annotations \
  --jq '.[] | select(.message|test("Node.js 20 is deprecated")) | .message' \
  | sort -u | wc -l
```

## Le relevé, job par job

Chaque zéro de la colonne « après » a son jumeau nommé dans la colonne
« avant », **obtenu par le même appel, sur le même job**, et non nul :
l'instrument est donc prouvé capable de voir la chose là où il rend zéro.

| dépôt / workflow | job | avant | après |
|---|---|---|---|
| moteur `tests.yml` | pytest + mypy | 1 (38467377616) | **0** (38478003268) |
| moteur `banc-bascule-gil.yml` | A/B/A Ubuntu 24.04 | 1 (38478922046, témoin `main`) | **0** (38477987879) |
| moteur `banc-total-sous-plafond.yml` | Paires A/B/B/A | — | **0** (38477987944) |
| woo `tests.yml` | suites (8.1) | 1 (37952306502) | **0** (38477443422) |
| woo `tests.yml` | suites (8.5) | 1 (37952306502) | **0** (38477443422) |
| woo `lint-workflows.yml` | actionlint | 1 (35962235886) | **0** (38477443373) |
| site `CI.yml` | Index de recherche a jour | 1 (38468407983) | **0** (38477721519) |
| site `CI.yml` | Suite de tests | 1 (38468407983) | **0** (38477721519) |
| site `CI.yml` | Clefs de cache a jour | 1 (38468407983) | **0** (38477721519) |
| site `CI.yml` | **Mise en ligne** | 1 (38468407983) | **0** (38480472547, sur `main`) |

**« Mise en ligne » n'avait pas de zéro sur la branche, il n'avait rien.** Son
`if: github.event_name == 'push' && github.ref == 'refs/heads/main'` le rend
`skipped` sous `workflow_dispatch` : il n'exécutait aucune action et n'émettait
donc aucun avertissement. Le run `38477721519` ne le jugeait pas, et son zéro
n'aurait pas dû être lu comme un succès.

**La fusion l'a jugé.** Les trois commits de montée ont été portés sur `main`
le 14 octobre vers 00:25 ; le passage `38480472547` (CI.yml sur `main`,
`519c6e34`, `push`) a donc exécuté les quatre jobs, « Mise en ligne »
**compris** — conclusion `success`, compte dédupliqué **0**, et le site
publié. Les cinq `checkout` de `CI.yml` sont désormais jugés par un passage
réel, pas quatre.

Le compte brut d'`Index de recherche a jour` valait 2 avant déduplication :
même message rendu deux fois par l'API pour un seul avertissement de job.

## Déclencheurs, parce qu'ils décident de ce qui se vérifie

- Poussée de branche suffisante : woo `tests.yml` (`on: push` sans filtre),
  woo `lint-workflows.yml` et les deux bancs du moteur (`push` sur leurs
  propres chemins).
- Demande explicite nécessaire : moteur `tests.yml` et site `CI.yml`
  (`push` filtré sur `main`) — `gh workflow run <fichier> --ref <branche>`.
- Hors de portée d'une branche : moteur `banc-pertinence-production.yml`, qui
  n'a **aucun déclencheur autre que `workflow_dispatch`** et interroge la
  production. Ses deux actions restent montées sur la lecture des `action.yml`
  des tags visés, pas sur un passage.

## Trouvé en chemin, et traité à part

### `banc-bascule-gil` : un vert périmé

Le banc est rouge sur **34 appels refusés en 503**. Un témoin lancé sur `main`
inchangé (`38478922046`, `checkout@v4`) rend **le même échec et les mêmes 34
refus** : la montée des actions n'y est pour rien.

La cause est datée à la minute :

| | |
|---|---|
| dernier passage **vert** | `35469115921`, 19 sept. 2026 à **21:00:42Z** |
| arrivée du garde des 3 s | `c6f9292`, 19 sept. 2026 à **21:12:25Z** |

`DELAI_RECHERCHE_S` (`heurix/search.py:291`) interrompt une recherche à 3 s et
rend 503. La méthode du banc consiste précisément à franchir ce seuil : le
19 septembre, ses cellules multi-fils mesuraient des médianes de 7 220 à
9 179 ms, p95 jusqu'à 23 319 ms, **toutes servies**.

**Le banc avait raison de tomber.** Il a refusé de rendre un chiffre plutôt
que d'en rendre un faux, et il a nommé sa mesure invalide. Le défaut était en
amont de lui. Désarmé depuis dans `banc_bascule.py`, **avec déclaration**
(docstring, sortie standard avant la première mesure, et champ
`delai_recherche_s` du rapport JSON) : sans elle, ses latences se liraient
comme des latences de production, qui n'existent pas au-delà de 3 s.

### La famille : du code que rien ne juge

Trois formes en deux jours.

1. **heurix-prestashop** : aucun fichier sous `.github`. Rien ne le juge, et
   rien ne le prétend.
2. **heurix-shopify** : ses deux workflows ne déclenchent que sur `push` vers
   `main`, `pull_request` et `workflow_dispatch` — une branche ne produit
   aucun passage tant qu'on ne le demande pas (`8de6b57`).
3. **`banc-bascule-gil`** : un déclencheur qui n'a pas tiré pendant
   **vingt-quatre jours**. Quatre passages dans toute l'histoire du workflow —
   deux le 19 septembre, deux le 13 octobre.

**La troisième est la plus trompeuse**, et elle mérite son nom : *un vert
périmé*. Le dépôt montre un workflow, ce workflow a un déclencheur, et son
dernier verdict est **vert** — un vert du 19 septembre, rendu sur un arbre qui
a changé le soir même. Un verdict sans date de péremption est de la prose.

### Relevé sans correction

Le job « Index de recherche a jour » de `CI.yml` porte **deux
`actions/checkout` consécutifs** sur le même répertoire ; le premier, sans
`with:`, est entièrement recouvert par le second, qui pose `fetch-depth: 0`.
Vu en montant les versions, laissé en l'état : c'est un retrait, pas une
bascule, et il se juge sur son propre passage.

### Surface de mesure du banc de pertinence

`banc-pertinence-production.yml` n'a pas été lancé. Son coût sur la production
se relève par le compteur mensuel, et le critère de son en-tête est trop fort.
Ce que dit le code, lu le 14 octobre :

- le seul incrément est `usage_db.count()` (`heurix/usage.py:1767`) et **tous
  ses appelants sont dans `heurix/routers/index.py`** ;
- des quatre appels du banc, **seul `/stats` compte**
  (`routers/index.py:798`), une fois par catalogue **actif** ;
  `search-overrides` n'a aucun `count`, `routers/analytics.py` n'en contient
  **zéro**, et `POST /search` avec `simulate_overrides: []` sort par la
  branche `if overrides_simules is not None` (`routers/index.py:154`) avant le
  `else` qui compte ;
- **l'instrument ne se compte pas lui-même** : `GET /v1/usage` vit dans
  `routers/admin.py:298`, `require_key` (`deps.py:425`) ne fait que valider,
  et l'unique middleware HTTP (`main.py:234`) ne pose que des en-têtes.

**Critère corrigé** : l'écart n'est pas « exactement 3 » mais **le nombre de
catalogues actifs**, réparti sur **deux clés** et non trois — +2 sur
`HEURIX_CLE_PUBLIC_DEMO`, +1 sur `HEURIX_CLE_QUINCAILLERIE`. C'est le relevé
d'**avant** qui dit lesquels sont actifs ; un écart de 2 n'infirme rien tant
qu'on l'ignore.

**Et `/v1/usage` est hors de portée d'une session** : ses deux clés sont des
secrets d'environnement GitHub (`banc-production`). La surface de mesure du
banc n'est atteignable que par la base (`usage.db`, lecture par copie des
trois fichiers selon `CLAUDE.md`) ou par le banc lui-même. Propriété à
connaître, pas défaut à corriger.
