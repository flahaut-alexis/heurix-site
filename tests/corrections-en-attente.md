# Corrections en attente — heurix-site

**À supprimer dans le commit qui les applique.** Une intention notée survit à sa
réalisation si on ne l'efface pas avec elle.

Modèle : `heurix-woocommerce/tests/corrections-en-attente.md`.

**Appliqué et retiré le 4 octobre 2026 :** la phrase « déprécié » de
`docs.html` et `en/docs.html`. Sa condition — `npm deprecate` posé sur
`@heurix-site/client` — est remplie ; vérifiée par deux voies, la CLI et
`registry.npmjs.org`, qui rendent tous deux le message du drapeau sur la 0.1.0.
Le garde `tests/paquet-npm-client.test.js` a dû être corrigé pour l'occasion :
sa note disait qu'il laisserait passer la phrase, et c'était faux — mesuré en
l'appliquant, 4 fautives. Il départage désormais sur le nom de paquet le plus
proche du mot de péremption.

---

## Deux affirmations fausses aujourd'hui, sans condition de déclenchement

Ceux-là sont faux **aujourd'hui** et n'attendent rien. Ils ne sont pas dans ce
lot parce qu'ils ne portent pas sur le paquet npm du client, et qu'un lot qui
corrige une chose à la fois se relit.

**a. La version du serveur MCP, dans les deux langues.**

```
blog/agent-ia-catalogue-technique.html:182     « La 0.1.1, celle que PyPI sert aujourd'hui »
en/blog/agent-ia-catalogue-technique.html:181  « Version 0.1.1, the one PyPI serves today »
```

PyPI sert **0.1.2** depuis le 17 septembre 2026 (mesuré le 4 octobre,
`pypi.org/pypi/heurix-mcp-server/json`). À noter : le `server.py` du zip que le
site distribue a le même sha256 que le dépôt `HEAD` et que la wheel 0.1.2
(`16fb6697fd944edb…`, les trois identiques). **C'est la phrase qui est périmée,
pas le fichier.**

**b. `CLAUDE.md`, lignes 24 et 25.**

```
24 | `heurix-client`      | Package npm `@heurix/client`, TS/JS | À publier sur npmjs.com |
25 | `heurix-mcp-server`  | Serveur MCP                         | Local, machine de l'utilisateur |
```

`@heurix/client` rend **404** sur npm. `heurix-client` est publié en 0.3.0.
`heurix-mcp-server` est sur PyPI en 0.1.2.

L'audit du **20 septembre** avait déjà demandé de réécrire cette table (F4),
avec la consigne exacte. Elle n'a pas été appliquée, et elle est toujours
fausse quinze jours plus tard. **Ne pas la corriger seule** : c'est ce qu'a
fait le 20 septembre. Elle se corrige avec le reste de la table — les huit
dépôts réels, leur visibilité, et l'état publié de chacun.

---

## `CI.yml` : téléverser et déployer dans le même job rend toute relance impossible

Mesuré le 4 octobre 2026, pas déduit. **Pas un lot ce jour-là** — la mise en
ligne est passée par un commit neuf. Mais la prochaine panne transitoire se
reproduira à l'identique, et c'est pour ça que c'est écrit ici.

### Ce qui s'est passé

Le job `deploiement` de `.github/workflows/CI.yml` porte quatre étapes :

```
- Pages est-il bien en mode workflow ?
- actions/checkout@v4
- actions/upload-pages-artifact@v5
- actions/deploy-pages@v5
```

Les deux dernières sont **dans le même job**. Donc chaque relance de ce job
téléverse un artefact `github-pages` **de plus dans le même run**, et
`deploy-pages` refuse dès qu'il en trouve plusieurs.

Run `37218939771`, commit `c982cbdd`, quatre tentatives :

| tentative | démarrée | échec |
|---|---|---|
| 1 | 17:01:30 | `Failed to get ID Token` / `Request timeout` — **transitoire** |
| 2 | 17:05:03 | `Multiple artifacts named "github-pages" ... count is 2` |
| 3 | 17:08:17 | idem, `count is 3` |
| 4 | 17:11:39 | idem, après une suppression manuelle — voir ci-dessous |

Les trois premiers artefacts, horodatés 17:02:58, 17:05:14 et 17:08:29,
15,2 Mo chacun.

**Une relance ne répare pas, elle aggrave.**

**Et supprimer les artefacts les plus anciens ne suffit pas.** Geste d'Alexis
entre les tentatives 3 et 4 : suppression des deux plus anciens, il n'en
restait qu'un. La tentative 4 en a téléversé un second, et l'échec est revenu.

Vérifiable sur l'API sans croire personne — les deux artefacts encore présents
sur ce run sont exactement celui qui a été gardé et celui que la tentative 4 a
créé douze secondes après son démarrage :

```
id=11310220747  github-pages  cree 2026-10-04T17:08:29Z   <- garde
id=11310236166  github-pages  cree 2026-10-04T17:11:51Z   <- recree par la tentative 4
```

Il n'y a donc pas de sortie par la suppression : tant que le téléversement vit
dans le job qu'on relance, l'artefact revient avec la relance.

**Le premier échec, lui, était bien transitoire — et le remède que l'action
annonce désigne la mauvaise cause :**

```
##[error]Ensure GITHUB_TOKEN has permission "id-token: write".
```

Trois mesures le réfutent : `id-token: write` est déclaré (`CI.yml:286`, job
`deploiement`) ; `git diff --stat 74e1c18c origin/main -- .github/workflows/CI.yml`
est **vide** ; et le run du 2 octobre sur `74e1c18c`, avec ce même fichier,
avait `Mise en ligne` **success**. Une permission présente depuis le 2 octobre
ne peut pas causer un échec le 4. L'erreur réelle est le `Request timeout` sur
le point de terminaison OIDC de GitHub.

Croire la ligne annoncée aurait fait chercher une permission qui ne manquait
pas.

### Pourquoi `workflow_dispatch` ne dépanne pas

Le job porte `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`
(`CI.yml:281`). Un déclenchement manuel saute la mise en ligne. La seule sortie
mesurée est **un commit neuf sur `main`** : un run neuf part avec un jeu
d'artefacts vide.

### Le remède candidat, et ce qu'il reste à mesurer

Le README de `actions/deploy-pages` recommande **deux jobs séparés** : un job
`build` qui téléverse, un job `deploy` avec `needs: build` qui déploie. Scinder
rendrait le job de déploiement relançable, puisqu'il ne téléverserait plus.

**À mesurer avant d'écrire**, parce que rien de tout ça n'est documenté en
amont — le README ne dit rien du cas « plusieurs artefacts » ni des relances,
c'est notre mesure :

1. qu'une relance du seul job `deploy` ne téléverse rien et déploie l'artefact
   déjà présent ;
2. ce que devient le contrôle « Pages est-il bien en mode workflow ? » — il doit
   rester **avant** le téléversement, sinon il cesse de fermer la porte ;
3. que `environment: github-pages` et les permissions `pages: write` /
   `id-token: write` restent sur le job qui déploie, pas sur celui qui construit ;
4. que le crochet `pre-push`, qui rejoue les blocs `run:` de `CI.yml`, ne soit
   pas dérangé par un job de plus (il saute déjà `npm ci`).

### À supprimer dans le commit qui applique

Comme le reste de ce fichier.
