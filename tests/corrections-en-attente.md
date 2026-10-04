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
