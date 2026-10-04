# Une phrase prête à poser, et sa condition

**À poser une fois `npm deprecate` lancé sur `@heurix-site/client`, et pas
avant.** Tant que le drapeau n'est pas posé côté registre, écrire « déprécié »
sur le site serait exactement le défaut que l'audit du 4 octobre 2026 vient de
trouver : une affirmation vérifiable que la mesure contredit.

**À supprimer dans le commit qui l'applique.** Une intention notée survit à sa
réalisation si on ne l'efface pas avec elle.

Modèle : `heurix-woocommerce/tests/corrections-en-attente.md`.

---

## 1. La condition, et comment la vérifier

Le geste qui la déclenche, à lancer par Alexis (ce dépôt ne publie rien) :

```bash
npm deprecate @heurix-site/client "Remplace par heurix-client (meme code, a jour) : npm install heurix-client"
```

La condition est remplie quand cette commande rend une chaîne non vide :

```bash
npm view @heurix-site/client deprecated
```

Mesuré le 4 octobre 2026 : **vide**, pour les deux paquets. C'est pourquoi la
phrase ci-dessous n'est pas en ligne.

Contrôle inverse, à faire le même jour — `heurix-client` est le paquet retenu
et ne doit **jamais** porter le drapeau :

```bash
npm view heurix-client deprecated      # doit rester vide
```

## 2. Ce qui remplace quoi

Aujourd'hui en ligne, `docs.html:1263` et `en/docs.html:1259`, écrit le
4 octobre et vrai au moment où il est écrit :

> **Un seul nom à installer** : `heurix-client`. Un paquet
> `@heurix-site/client` existe aussi sur npm, resté en 0.1.0 : c'est un nom
> d'essai qui n'a pas été retenu, et les versions ne lui sont plus publiées. Si
> une recherche npm vous rend les deux, prenez `heurix-client`.

Le jour où le drapeau est posé, cette phrase devient **incomplète plutôt que
fausse** : elle reste vraie, mais elle ne dit plus ce que npm dit désormais
tout seul. Remplacez-la par celle-ci.

### Français — `docs.html`, le dernier `<p>` de `#ep-client-js`

```html
      <p><strong>Un seul nom à installer</strong> : <code class="docs-inline-code">heurix-client</code>. Le paquet <code class="docs-inline-code">@heurix-site/client</code>, resté en 0.1.0, est un nom d'essai qui n'a pas été retenu : il est déprécié sur npm, et <code class="docs-inline-code">npm install</code> vous le dira. Si une recherche npm vous rend les deux, prenez <code class="docs-inline-code">heurix-client</code>.</p>
```

### Anglais — `en/docs.html`, le dernier `<p>` de `#ep-client-js`

```html
      <p><strong>One name to install</strong>: <code class="docs-inline-code">heurix-client</code>. The <code class="docs-inline-code">@heurix-site/client</code> package, still at 0.1.0, was a trial name that was not kept: it is deprecated on npm, and <code class="docs-inline-code">npm install</code> will tell you so. If an npm search returns both, take <code class="docs-inline-code">heurix-client</code>.</p>
```

## 3. Ce que le garde fera, et ne fera pas, ce jour-là

`tests/paquet-npm-client.test.js` **laissera passer** ces deux phrases : son
assertion « l'autre sens » ne refuse « déprécié » que pour le paquet
**déclaré** (`data-paquet-npm-client`, soit `heurix-client`). Dire d'un autre
paquet qu'il est déprécié reste permis, et doit l'être — sinon le garde
interdirait de dire une vérité.

Il **ne vérifiera pas** que le drapeau est réellement posé : il est hors
ligne, par décision du 4 octobre. La limite est écrite en tête du test, section
« CE QUE CE GARDE NE VOIT PAS ». C'est précisément cette dérive-là —
« un paquet déprécié sans que les pages suivent, ou l'inverse » — qu'il nomme
comme hors de sa portée.

Donc : **lancez `npm view @heurix-site/client deprecated` avant de poser la
phrase.** Rien d'automatique ne le fera.

## 4. Deux voisins trouvés par le même balayage, qui ne dépendent d'aucune condition

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
