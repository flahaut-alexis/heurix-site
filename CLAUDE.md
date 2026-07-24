# Heurix — Contexte projet pour Claude Code

Moteur de recherche B2B basé sur une cascade de règles regex (pas de
vector search / embeddings) pour catalogues techniques (outillage, mode,
industrie...). Micro-entreprise d'Alexis Flahaut, Caen.

**Ce fichier ne contient volontairement aucun secret** (clés API, mots de
passe). Il reste toujours en `.gitignore` — jamais commité, même dans un
dépôt public. Les valeurs sensibles se donnent directement en session le
moment venu, jamais collées dans un fichier versionné.

## Les quatre composants du projet

| Composant | Rôle | Dépôt / emplacement |
|---|---|---|
| `heurix-engine` | API FastAPI/Python, le moteur lui-même | Déployé sur le serveur OVH |
| `heurix-site` | Site public + console client, statique | GitHub Pages (ce dépôt, probablement) |
| `heurix-client` | Package npm `@heurix/client`, TS/JS | À publier sur npmjs.com |
| `heurix-mcp-server` | Serveur MCP (Claude Desktop / Cursor) | Local, machine de l'utilisateur |

## Déploiement du site (`heurix-site`)

Statique, servi par GitHub Pages. Après toute modification :
```bash
git add -A
git commit -m "description du changement"
git push
```
Le déploiement GitHub Pages se fait automatiquement après le push —
compter 1 à 2 minutes de propagation. **Toujours faire un hard refresh**
(Cmd+Shift+R) pour vérifier, le cache navigateur masque souvent un
déploiement pourtant réussi.

**Cache-busting** : `styles.css` et `console.js` sont référencés avec un
paramètre `?v=<timestamp>` dans les fichiers HTML. À chaque modification
de l'un de ces deux fichiers, régénérer un timestamp frais
(`date +%s`) et le propager dans tous les `.html` qui les référencent —
sinon les visiteurs récupèrent une version en cache.

## Déploiement du moteur (`heurix-engine`)

Serveur OVH, IP `146.59.202.238`, service systemd nommé `heurix`.

```bash
scp heurix-engine.zip ubuntu@146.59.202.238:/tmp/heurix-engine.zip
ssh ubuntu@146.59.202.238
sudo unzip -o /tmp/heurix-engine.zip -d /tmp/heurix-update
sudo cp -r /tmp/heurix-update/heurix-engine/heurix /opt/heurix-engine/
sudo chown -R heurix:heurix /opt/heurix-engine
sudo systemctl restart heurix
sudo journalctl -u heurix -n 15 --no-pager
curl -s https://api.heurix.fr/health
```

Avant d'installer, toujours vérifier que le zip contient bien le
changement attendu (grep sur une fonction récemment ajoutée) — un
déploiement de la mauvaise version s'est déjà produit une fois.

`HEURIX_CORS_ORIGINS` ne doit **jamais** être réintroduite dans le
service systemd — une ancienne valeur restrictive avait cassé le CORS
nécessaire aux appels de tracking depuis les sites clients.

## Conventions de code

- Commentaires et docstrings en **français**, code (noms de variables,
  fonctions) en anglais.
- Tests : `pytest`, suite complète dans `heurix-engine/tests/`. Toujours
  lancer la suite complète avant de considérer un chantier terminé.
- Toute nouvelle table SQLite suit le pattern déjà en place : migration
  douce (`ALTER TABLE ... ADD COLUMN` protégé par vérification
  `PRAGMA table_info`), jamais de migration destructive.
- Nouvel article de blog = 3 emplacements à mettre à jour :
  `blog.html` (liste), `search.js` (index de recherche du site),
  `sitemap.xml`.

## Pièges déjà rencontrés (pour ne pas les reproduire)

- `[hidden]{display:none}` est obligatoire en CSS pour toute classe qui
  fixe elle-même `display` — sinon l'attribut HTML `hidden` est
  silencieusement ignoré.
- `indexed_at` (date d'ajout d'un produit) doit être préservée lors d'une
  réindexation — capturée avant `remove_product`, jamais recalculée.
- Une catégorie Browse est un champ **fourni par le marchand** à
  l'indexation (`categories`/`category`), jamais dérivée d'un pack de
  règles — deux concepts différents, confondus une fois par erreur.
