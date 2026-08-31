# Heurix — Contexte projet pour Claude Code

Moteur de recherche B2B basé sur une cascade de règles regex (pas de
vector search / embeddings) pour catalogues techniques (outillage, mode,
industrie...). Micro-entreprise d'Alexis Flahaut, Caen.

**Ce fichier ne contient volontairement aucun secret** (clés API, mots de
passe). Les valeurs sensibles se donnent directement en session le moment
venu, jamais collées dans un fichier versionné.

**Ce fichier EST versionné, et `heurix-site` est un dépôt PUBLIC** (décision
du 25 août 2026). Le paragraphe précédent affirmait l'inverse — « toujours en
`.gitignore`, jamais commité » — alors qu'il était suivi depuis son premier
commit : la règle avait été ajoutée après coup, et `.gitignore` ne s'applique
pas à un fichier déjà suivi. Écrire ici doit donc se faire en sachant que
c'est publié.

## Les quatre composants du projet

| Composant | Rôle | Dépôt / emplacement |
|---|---|---|
| `heurix-engine` | API FastAPI/Python, le moteur lui-même | Déployé sur le serveur OVH |
| `heurix-site` | Site public + console client, statique | GitHub Pages (ce dépôt, probablement) |
| `heurix-client` | Package npm `@heurix/client`, TS/JS | À publier sur npmjs.com |
| `heurix-mcp-server` | Serveur MCP (Claude Desktop / Cursor) | Local, machine de l'utilisateur |

## Déploiement du site (`heurix-site`)

### À FAIRE UNE FOIS PAR CLONE, avant tout le reste

```bash
scripts/installer-crochets.sh
```

Règle `core.hooksPath` sur `scripts/hooks/`, d'où un crochet `pre-push` qui
rejoue les contrôles de `.github/workflows/CI.yml` **avant** que le push parte
— 19,4 s mesurées, contre 36 s pour la CI distante.

Il existe parce que **sur ce dépôt le push EST le déploiement** : Pages par
branche se déclenche sur le push, ne peut pas dépendre de la CI, et la CI n'est
donc qu'un signal *a posteriori*. Mesuré du 21 au 28 août 2026 : **onze CI
rouges, onze déploiements réussis**, dont quatre avec une suite de tests
rouge.

**Vous n'avez normalement pas à le lancer :** `npm install` et `npm ci` le
font tout seuls, via le script `prepare` de `package.json`. C'est ce qui
répond à la limite « pas actif par défaut », et la réponse tient à un fait de
méthode plutôt qu'à de la discipline — **on ne peut pas lancer la suite sans
`node_modules`, ni obtenir `node_modules` sans passer par npm.**

Prouvé sur un clone neuf depuis GitHub, le 28 août 2026 :

```
avant npm ci   core.hooksPath : (NON DÉFINI)
npm ci         ✓ core.hooksPath -> scripts/hooks
               ✓ PyYAML présent -- le crochet peut lire CI.yml
après npm ci   core.hooksPath : scripts/hooks     pre-push : exécutable
```

Vérifié aussi qu'un push **depuis un sous-dossier** déclenche bien le crochet :
`core.hooksPath` est relatif, et git 2.50.1 le résout depuis la racine de
l'arbre, pas depuis le répertoire courant.

Les trois trous que `prepare` ne ferme pas — `--ignore-scripts`, un
`node_modules` recopié à la main, et `--no-verify` — sont écrits en tête de
`scripts/installer-crochets.sh`, et les limites du crochet lui-même en tête de
`scripts/hooks/pre-push`. Elles s'y lisent avant de lui faire confiance.

### UN WORKTREE PAR SESSION, quand plusieurs sessions travaillent en même temps

**Le crochet lit l'arbre de travail, pas le commit poussé** (trou n°4, en tête
de `scripts/hooks/pre-push`). Dans un arbre partagé, cela veut dire qu'un
fichier de travail non commité, chez n'importe qui, **bloque le déploiement de
tout le monde**. Mesuré le 28 août 2026 : trois blocages en vingt minutes,
trois causes différentes, aucune chez celui qui poussait — un harnais `.html`
non suivi, un test juste mais indexé avant son correctif, un index de recherche
en cours de régénération. Cinq commits en file derrière.

Le worktree supprime la cause. **Mesuré, même plage de commits, au même
instant :**

```
worktree      code 0     index-recherche OK   tests OK
arbre partagé code 1     index-recherche OK   tests ÉCHEC   -> PUSH REFUSÉ
```

#### Le geste, que chaque session fait elle-même

```bash
git worktree add --detach ~/wt/heurix-site-<session> HEAD
cd ~/wt/heurix-site-<session> && npm ci
```

**Aucune préparation centrale n'est requise** : `git worktree add` sort en 0
sans privilège particulier. Personne n'est un goulot.

`npm ci` est nécessaire parce que `node_modules` n'est pas dans le worktree —
sans lui le bloc « Suite de tests » échoue (`0 test` collecté sur chaque
fichier), et c'est le seul des cinq blocs qui en dépend. Il lance aussi
`prepare`, donc `installer-crochets.sh`.

Quand le lot est fini : `git worktree remove <chemin>` depuis l'arbre principal.

**`.scratch/` NE SUIT PAS DANS UN WORKTREE.** Il est dans `.gitignore`, donc git
ne le recopie pas : un worktree neuf a un `.scratch/` vide pendant que l'arbre
partagé en porte vingt et un dossiers. **Les fiches vivent dans l'arbre partagé
— on y écrit et on y lit, depuis n'importe quel worktree**, par son chemin
absolu.

Ce que ça coûte si on l'ignore : une session qui rédige une fiche depuis son
worktree **la perd au `worktree remove`**. Mesuré le 29 août 2026 — une fiche
déposée sous `.scratch/` d'un worktree, puis `git worktree remove` **sans**
`--force` :

```
code de sortie : 0
sortie         : (rien)
la fiche       : supprimee
```

**`git worktree remove` n'est pas une commande silencieuse : c'est une commande
dont le silence dépend du statut du fichier.** Elle sait parler — mesuré les
deux cas :

```
fichier suivi modifie        code 128   « contains modified or untracked
fichier non suivi, non ignore  code 128     files, use --force to delete it »
fichier IGNORE               code   0   (rien, et il est supprime)
```

La frontière n'est donc pas « suivi / non suivi » : un fichier non suivi
protège le worktree aussi bien qu'un fichier modifié. **La frontière est
l'ignorance.** Ce que la commande protège est tout ce que git *voit*, et
`.gitignore` est précisément la déclaration qu'on ne veut plus être vu.

C'est la règle des onze actifs sans clef de cache, transposée : « le périmètre
dérivé ne protège que ce qui a déjà franchi son seuil d'entrée » (voir plus
bas, `actifs-versionnes`). Un `.gitignore` est un seuil d'entrée comme un
autre. **Ce qui n'entre pas dans le périmètre d'un outil n'est surveillé par
personne, et personne ne le dit** — parce que le dire supposerait de regarder,
et regarder est précisément ce que le périmètre a exclu. C'est exactement la famille qu'on documente dans ces
fiches : un défaut silencieux, dont le seul signal serait de savoir d'avance
qu'il existe. D'où ces lignes, au moment où quelqu'un crée son worktree.

Et les fiches ne risquent rien dans l'arbre partagé : étant ignorées, aucun
commit d'aucune session ne peut les emporter.

#### Le crochet suit tout seul

`core.hooksPath` vit dans le `.git/config` **commun**, donc il est hérité ; et
il vaut `scripts/hooks`, un chemin **relatif**, donc il se résout dans le
worktree. Vérifié : `git rev-parse --git-path hooks` y rend `scripts/hooks`, le
fichier est exécutable, et le crochet lancé depuis le worktree fait bien
`cd $(git rev-parse --show-toplevel)` **vers le worktree**. Rien à installer.

#### Coût mesuré

| poste | mesure |
|---|---|
| création | **0,3 s** |
| copie de travail | 17 Mo |
| `npm ci` | 2 s (cache chaud), 39 Mo |
| **total par worktree** | **56 Mo** |
| dépôt `.git` (73 Mo) | **non dupliqué** — le `.git` du worktree est un fichier de 4 Ko |

#### Deux worktrees sur le même fichier : git ne refuse rien

C'est la question qui décide de la méthode, et la réponse est **non**. Les deux
copies acceptent la modification sans un mot ; il n'y a **aucun garde au moment
de l'écriture**. Le conflit n'apparaît qu'à la réunion des deux branches :

```
CONFLICT (content): Merge conflict in styles.css
    styles.css : UU     <<<<<<< HEAD ... ======= ... >>>>>>>
```

Ce n'est donc pas « au push que ça se règle » au sens où le push arbitrerait :
le push du second est refusé en non-fast-forward, et c'est le `rebase` qui
suit qui produit le conflit, à résoudre à la main comme n'importe lequel.

**Ce que le worktree échange, ce n'est pas moins de conflits — c'est des
conflits à un moment choisi plutôt qu'un blocage permanent.** Dans l'arbre
partagé, deux sessions sur `styles.css` se marchent dessus en continu et sans
signal. En worktrees, elles ne se gênent pas du tout jusqu'à la réunion, où
git nomme précisément les lignes en désaccord.

#### CE QUE LE CROCHET NE PEUT PAS VOIR : le défaut né de la RÉUNION

Trouvé le 29 août 2026, premier de sa forme. Trois worktrees du moteur,
**verts chacun isolément**, poussés et réunis : `mypy` rouge sur `main`.

```
heurix/routers/browse.py:107 et :151
Argument "filters" to "browse" has incompatible type
  list[tuple[str, tuple[str, ...]]]
expected
  list[tuple[str, tuple[str, ...] | str]] | None
```

Une session avait élargi la signature de `browse()`, une autre travaillait
ses appelants. Chacune était juste chez elle ; `list` étant invariant, leur
réunion ne l'était pas.

**Le crochet `pre-push` rejoue les contrôles sur l'ARBRE LOCAL, avant le
push — jamais sur le résultat du rebase, qui n'existe pas encore au moment
où il tourne.** Un défaut qui ne naît que de la réunion de deux branches lui
est donc *structurellement* invisible, exactement comme le worktree est
structurellement aveugle au désordre d'autrui. C'est le prix nommé plus
haut : « des conflits à un moment choisi plutôt qu'un blocage permanent ».
Le moment choisi, c'est le rebase — et rien n'y tourne automatiquement.

Deux conséquences pratiques :

- **Rebaser tôt, pas au moment de pousser.** Un lot qui prend une matinée
  doit se réunir en cours de route, pas une fois fini : c'est là que le
  coût d'un désaccord de types est le plus bas.
- **Relancer les contrôles APRÈS le rebase, à la main.** Le crochet les a
  passés sur l'arbre d'avant ; il ne les repassera pas sur l'arbre d'après.

S'y ajoute une limite de périmètre : **le crochet de `heurix-site` rejoue
les blocs de `CI.yml` du SITE.** Il ne lance pas `mypy`, qui est un contrôle
du moteur. Sur `heurix-engine`, `python -m mypy heurix` avant tout push, en
plus des tests.

#### Comparer DEUX versions du moteur sur le même catalogue

Le geste qui a rendu vérifiable une détection de capacité, le 29 août 2026,
plutôt que raisonnée.

Le widget de rayon doit savoir si le moteur déployé comprend la syntaxe
`champ:A|B`. Il le déduit d'une contradiction — un total nul pendant que le
décompte d'une valeur cochée est positif. L'argument est solide sur le
papier ; il restait à montrer qu'il ne se déclenche jamais à tort.

**La mesure exige les deux moteurs en même temps, sur le MÊME catalogue.**

```bash
# le moteur patché, en local, sur le port 8010
PORT=8010 .venv/bin/python -m uvicorn heurix.main:app --port 8010
# une clé, un plan Browse, et le même catalogue indexé dedans
```

Résultat, 50 combinaisons sur chacun :

| | signature déclenchée |
|---|---|
| moteur avec la syntaxe (local) | **0 / 50** |
| moteur déployé (production) | **50 / 50** |

Sans le moteur local, on n'aurait mesuré que la moitié qui déclenche — et
c'est l'autre moitié qui décide, parce qu'un faux positif y désactiverait
définitivement une fonction qui marche.

**Généralisation** : dès qu'un client doit *détecter* une capacité serveur
plutôt que la supposer, la version qui A la capacité est aussi nécessaire à
la mesure que celle qui ne l'a pas. Le catalogue doit être identique des
deux côtés, sans quoi on compare deux jeux de données autant que deux
moteurs.

#### Ce que ça ne règle pas

Les gardes de `.scratch/outillage-git/01` restent utiles pour un arbre à un
seul auteur, et la neuvième forme — deux sessions écrivant dans le **même
fichier** — reste possible dès qu'on réunit les branches. Le worktree ne
supprime que la classe « le désordre d'autrui est dans mon `git status` », qui
est celle qui a coûté la journée du 28 août.


### Le geste de publication

Statique, servi par GitHub Pages. Après toute modification :
```bash
git add <chemins explicites>
git commit -m "description du changement"
git push
```

**JAMAIS `git add -A`.** L'arbre est partagé par plusieurs sessions
simultanées : `-A` demande à git « ce qui a changé » au lieu de lui donner
« ce que j'ai changé », et la réponse contient le travail des autres. Il a
emporté 1 770 lignes d'une session voisine dans deux commits. Le remède n'est
pas la vigilance, c'est de nommer les chemins, toujours. Le contrôle d'une
seconde avant de commiter :

```bash
git diff --cached --name-only | grep -v '\.html$'
```

Le déploiement GitHub Pages se fait automatiquement après le push —
compter 1 à 2 minutes de propagation. **Toujours faire un hard refresh**
(Cmd+Shift+R) pour vérifier, le cache navigateur masque souvent un
déploiement pourtant réussi.

Et **lire la CI du commit qu'on vient de pousser** : le crochet teste l'arbre
local, pas le commit poussé, et il se contourne.

```bash
gh run list --limit 3 --json conclusion,headSha,workflowName \
  --jq '.[] | "\(.conclusion)  \(.headSha[0:8])  \(.workflowName)"'
```

**Cache-busting** : chaque asset statique (JS/CSS) référencé avec un
paramètre `?v=<timestamp>` porte sa propre version, indépendante des
autres. À chaque modification d'un de ces fichiers :
```
scripts/bust-cache.sh nom-du-fichier.js
```
Propage automatiquement un timestamp frais dans tous les `.html` qui le
référencent (chantier S8, 5 août 2026 — remplace la propagation
manuelle : un oubli page par page ne se voit pas tant qu'un visiteur ne
signale pas un comportement en cache). Accepte plusieurs noms en un seul
appel ; avertit si une incohérence existait déjà avant le lancement.

## Déploiement du moteur (`heurix-engine`)

Serveur OVH, service systemd nommé `heurix`. **Les coordonnées du serveur ne
sont pas écrites ici** : ce dépôt est public, et une adresse, un compte et une
procédure servis ensemble forment un dossier de reconnaissance tout prêt.
Elles vivent dans `heurix-engine` (dépôt privé), qui porte la procédure
complète et outillée — `deploy/deploy-complet.sh` et
`deploy/DEPLOIEMENT_OVH.md`.

Exportez `HEURIX_SERVEUR` (forme `utilisateur@adresse`) avant de dérouler ce
qui suit, ou utilisez directement `deploy/deploy-complet.sh`, qui fait tout
cela avec vérification de CI, sauvegarde et contrôles post-déploiement.

```bash
scp heurix-engine.zip "$HEURIX_SERVEUR":/tmp/heurix-engine.zip
ssh "$HEURIX_SERVEUR"
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
- Un conteneur reconstruit par `innerHTML` ne peut pas garder ses écouteurs :
  `innerHTML` les détruit avec les éléments qu'il remplace. Le mélange
  « chargement + câblage » y est donc **imposé par le style de rendu, pas
  choisi** — le découper ne le corrige pas. Le remède est de déléguer sur le
  conteneur stable, qui survit au remplacement de ses enfants (`7f1450c`,
  banc `tests/benchmarks/mesure-cablage-console.mjs` : les 6 recâblages par
  changement de catalogue tombent à 0).

## Agent skills

### Issue tracker

Fichiers markdown locaux sous `.scratch/<feature>/` — projet solo, pas de
gestionnaire de tickets externe. Voir `docs/agents/issue-tracker.md`.

### Domain docs

Contexte unique : un `CONTEXT.md` et un `docs/adr/` à la racine. Ni l'un ni
l'autre n'existe encore ; ils seront créés paresseusement par
`/domain-modeling` quand un terme ou une décision aura besoin d'être fixé.
Voir `docs/agents/domain.md`.

## Local
- Déploiement (rm -rf + cp -r) : ne jamais supprimer demo/mode/images/ ni demo/outillage/images/. Exclure ces deux dossiers explicitement.

## Vérification visuelle — obligatoire

**Toute modification visuelle se vérifie À L'ÉCRAN avant d'être poussée.**
Ouvrir la page, la regarder. Un test vert et un compte de mots ne disent rien
de ce qu'un visiteur voit.

Établi le 26 août 2026, après un audit visuel qui a trouvé quatre défauts
introduits par les chantiers de la veille et du jour — dont une page
(`secteurs.html`) qui s'affichait **quasiment vide**, tout son contenu bloqué
à `opacity:0`. Aucun n'avait été vu, parce que personne n'avait ouvert la
page : on avait mesuré des mots, des écouteurs et des millisecondes.

Ce qu'une mesure ne voit pas :
- un bloc à `opacity:0` compte ses mots normalement dans le DOM ;
- un texte à 1,11:1 de contraste est présent, lisible par un script, et
  invisible pour un œil ;
- un `display:flex` mal placé n'échoue à aucun test ;
- une page créée depuis un gabarit peut hériter du balisage sans le script
  qui l'anime.

Corollaire pratique : si l'outil de capture ne rend pas la page (onglet en
arrière-plan, viewport à 0), **le dire** et demander une vérification humaine
plutôt que de conclure depuis le DOM. Un DOM correct ne prouve pas un rendu
correct.

### Les pages HTML n'ont pas de clef de cache. Forcez le rechargement.

Chaque asset porte son `?v=`. **Le document qui les référence n'en porte
aucun.** Une page corrigée puis rouverte peut donc être servie depuis le cache
du navigateur, avec son ancien balisage — et la vérification à l'écran, qui est
la règle de ce fichier, porte alors sur l'état d'avant.

Le 28 août 2026, après avoir posé une clef sur `img/photo-alexis.jpg` et
retiré un `<p>` fautif d'`about.html`, la mesure à l'écran a rendu :

```
src : "img/photo-alexis.jpg"          <- sans clef
```

La clef était dans le fichier. **J'allais rapporter un défaut inexistant.**
Rechargée avec un paramètre de contournement, la même mesure a rendu la clef,
le `<p>` disparu et le portrait entier.

**LE CAS EST CELUI QUE LE GARDE DU JOUR VENAIT DE RENDRE VISIBLE**, appliqué à
son auteur pendant qu'il l'écrivait : un fichier sans clef sert sa version en
cache **jusqu'à 600 s après son remplacement** — mesuré le 31 août 2026, voir
la sous-section suivante ; « indéfiniment », écrit ici jusqu'à cette date,
était faux. `tests/actifs-versionnes.test.js` ferme ce trou pour les assets ;
il ne peut rien pour les documents, qui n'en portent pas et n'en porteront
pas.

Trois conséquences pratiques :

**Toute vérification à l'écran APRÈS correction force le rechargement.** Un
paramètre suffit — `?nocache=1` — et il ne coûte rien. Sans lui, on regarde
peut-être l'état d'avant, et rien ne le dit.

**Une mesure qui contredit le fichier est suspecte avant d'être un défaut.**
Le réflexe juste est de relire le fichier sur disque, pas de conclure. Ici les
deux se contredisaient et c'est le navigateur qui avait tort.

**Cela vaut pour toutes les vérifications, pas seulement les siennes.** Une
capture prise avant le rechargement est un instrument qui mesure autre chose
que ce qu'on croit — la famille documentée plus bas, sous une forme que la
vigilance ne ferme pas, parce qu'aucun signal ne distingue une page fraîche
d'une page servie du cache.

#### « Indéfiniment » était faux, et le `?v=` est bon pour une autre raison

Ce fichier justifie le cache-busting depuis le 26 août 2026 (`d1bb74c3`, puis
`bca6d4ff` le 28) par une phrase qu'aucune mesure ne portait : « un fichier
sans clef sert sa version en cache indéfiniment ». **Mesuré le 31 août 2026
sur l'origine de production, ce n'est pas ce que GitHub Pages envoie.**

| famille | population mesurée le 31 août 2026 | `cache-control` | validateur |
|---|---|---|---|
| documents | `/`, `pricing.html` | `max-age=600` | `etag` + `last-modified` |
| actifs versionnés | `styles.css?v=1788164124`, `nav-dropdown.js?v=1788086140` | `max-age=600` | idem |
| actifs sans clef | les **deux** de `SANS_CLEF_ASSUMES` — `favicon-32.png` et `apple-touch-icon.png`, sur 128 pages | `max-age=600` | idem |

Une seule durée de vie pour les trois, et **le paramètre de requête ne change
rien à l'en-tête** : `styles.css` et `styles.css?v=1788164124` rendent le même
`etag`, le même `max-age`. Aucune famille n'est servie « pour toujours ».

**La borne, mesurée de bout en bout : 600 s.** Le CDN de GitHub (Fastly)
respecte le `max-age` — échantillonné toutes les 30 s pendant douze minutes,
l'`age` de `styles.css` monte 365 → 583 puis retombe à 0, et le maximum
observé sur les quatre URL sondées est 598 — et il **propage** cet `age`, que
le navigateur retranche de sa propre fraîcheur. Les deux étages ne s'additionnent
pas. Un visiteur en ligne, navigant normalement, sert donc l'ancien fichier
**moins de 600 s après son remplacement**.

**LE `?v=` RESTE NÉCESSAIRE, ET PAS POUR LA RAISON ÉCRITE ICI.** Banc local
rejouant les en-têtes ci-dessus (même forme d'ETag `"<mtime>-<taille>"`,
`max-age=600`), navigateur réel, un remplacement des fichiers entre deux
navigations :

| page ouverte après le remplacement | document servi | actif servi | requête réseau pour l'actif |
|---|---|---|---|
| jamais visitée, actif **sans clef** | v2 | **v1** | **aucune** — `transferSize` 0 |
| jamais visitée, actif **avec clef neuve** | v2 | v2 | `GET` inconditionnel |
| après les 600 s, actif **sans clef** | v2 | v2 | `GET` conditionnel `If-None-Match` → `200` |

**La deuxième ligne n'est pas l'argument. C'est la première.** Un visiteur qui
ouvre une page qu'il n'a jamais vue reçoit le **document neuf** et l'**actif
ancien** : le document n'est dans aucun cache, l'actif y est encore frais. Et
le navigateur **n'émet aucune requête** pour cet actif — rien à observer, rien
à journaliser, aucun garde ne peut le voir. Le document et son script ont deux
horloges indépendantes ; le `?v=` est ce qui les raccorde. **Il fait de la
fraîcheur de l'actif une propriété du document qui le nomme, au lieu d'une
propriété du temps.**

C'est exactement la fenêtre où un correctif de sécurité ne s'applique pas.
Deux XSS ont été fermés dans `console.js` en une semaine (`fad8802c` le 29
août, `8446e9ab` le 30 août). Sans clef, un marchand rouvrant sa console après
le déploiement aurait reçu la console corrigée **et** le script vulnérable,
jusqu'à dix minutes durant, sans qu'une seule requête ne le signale.

**CE QUI N'EST PAS L'ARGUMENT NON PLUS**, et qu'il faut cesser d'invoquer :
« le `?v=` couvre les caches que l'origine ne contrôle pas ». Le CDN de GitHub
**n'inclut pas la chaîne de requête dans sa clef de cache**. Une URL jamais
demandée y répond `HIT`, avec l'`age` de l'URL nue — trois requêtes dans la
même seconde, le 31 août 2026 à 17:12:55 :

```
styles.css                         etag:"6a958e61-61b43"  age:368  x-cache:HIT
styles.css?v=1788164124            etag:"6a958e61-61b43"  age:369  x-cache:HIT
styles.css?jamais-demandee-7391=1  etag:"6a958e61-61b43"  age:369  x-cache:HIT
```

À cet étage, le `?v=` ne gagne rien. Il gagne dans le cache du navigateur —
mesuré — et dans tout cache dont la clef porte l'URL entière : non mesuré
ailleurs, donc à ne pas avancer comme un fait.

**La forme du défaut, pour la famille :** l'argument était faux et la
conclusion juste. « Indéfiniment » exagérait dans le sens qui arrange, et
personne ne relit une justification qui conclut ce qu'on veut déjà. Le remède
n'est pas de retirer le mécanisme, c'est de lui rendre sa vraie raison — plus
étroite, mesurable, et suffisante.

##### Vérifié en production, sur un vrai déploiement (1er septembre 2026)

Le banc du 31 août rejouait les en-têtes de production. Celle-ci est la
production : une page ouverte avant le déploiement, le déploiement, et ce que
le navigateur charge ensuite. Le lot déployé bumpait `styles.css` **et**
changeait 22 documents, donc deux horloges observables au lieu d'une.

```
00:30:28  amorçage    vins.html + styles.css depuis le RESEAU, etat ancien
00:35:41  push
    <= 00:36:48  T0   encart visible a l'origine, styles.css?v=1788213996
00:37:45  releve 1    vins.html  CACHE 0 octet   0 encart   ?v=1788164124
00:38:53  controle    plomberie  RESEAU 9135 o   1 encart   ?v=1788213996
00:40:24  releve 2    vins.html  CACHE 0 octet   0 encart   ?v=1788164124
00:42:10  releve 3    vins.html  RESEAU 7877 o   1 encart   ?v=1788213996
```

> **Un visiteur a servi la page d'avant le déploiement, entièrement, pendant
> au moins 216 s après T0, sans émettre une seule requête.**

**LE TÉMOIN EST LE CONTENU, PAS LA CLEF, et c'est ce qui rend la mesure
irréfutable.** À 00:40:24 la page rendue portait zéro encart **et la ligne
`post-footer-cta-alt` que ce lot venait de supprimer** — un fragment que
l'origine ne servait plus depuis plus de trois minutes. Une clef `?v=` aurait
pu s'expliquer par un cache d'actif ; un paragraphe supprimé, non. Et
`transferSize` valait 0 sur le document comme sur la feuille : ces trois
minutes n'existent dans aucun journal, ni côté origine ni côté CDN.

Les trois relevés sont des navigations réelles — `PerformanceNavigationTiming`
`.type === "navigate"`, jamais `"reload"` — obtenues en arrivant depuis une
autre page, pour qu'aucune ne soit un rechargement déguisé qui aurait forcé la
revalidation.

**LA BORNE SUR T0, ET ELLE VA DANS LE BON SENS.** Le premier sondage, à
00:36:48, a **déjà** trouvé l'encart : il n'existe donc qu'un majorant de T0,
quelque part entre le push et cette seconde-là. Tous les « T0 + N » ci-dessus
sont des **minorants** de l'écart réel. Une mesure dont l'incertitude ne peut
que renforcer la conclusion se rapporte en le disant, pas en la taisant.

**La durée de vie observée : entre 596 s et 600 s**, bornée en haut par le
`max-age`. Elle confirme les deux moitiés du modèle du 31 août — le navigateur
applique 600 s, et il en retranche l'`Age` propagé par le CDN.

**Et la borne n'est pas le déploiement, c'est le dernier chargement du
visiteur.** Celui-ci avait chargé 380 s avant T0, d'où ses ~220 s de page
périmée. Un visiteur qui aurait chargé une seconde avant le push l'aurait
servie **599 s**.

**Le contrôle, avec ce qu'il ne teste pas.** `solutions/plomberie.html`,
jamais visitée sur ce profil, ouverte 125 s après T0 : document depuis le
réseau, encart présent, `?v=1788213996`. Mais la feuille de style, elle, est
venue du **cache** — un passage par l'accueil l'avait chargée 68 s plus tôt.
Le contrôle porte donc sur le document, pas sur le premier chargement de la
feuille, et il faut le dire plutôt que de laisser croire à un test complet.

**LE RÉSULTAT NÉGATIF, ANNONCÉ AVANT LA MESURE.** La production ne pouvait pas
reproduire le défaut d'appariement du banc, et ça a été écrit avant de lancer
la mesure. C'est structurel : chaque actif de ces pages porte une clef, donc un
document neuf ne peut pas nommer un actif ancien. La seule chose sans clef est
le document lui-même — et c'est exactement la fenêtre de 220 s mesurée
ci-dessus.

### Une page peut répondre 200 et ne rien montrer

Le 26 août 2026, trois liens « Voir le moteur en action » ont été pointés vers
`demo/index.html` après vérification que la page répondait **HTTP 200**. Elle
répondait bien 200. Elle affichait, à la place des produits :

> « Catalogue indisponible — vérifiez la clé publique et le nom du catalogue
> dans `boutique.js`. »

Un message destiné au développeur, montré à un prospect. Mesuré ensuite sur
l'API : le catalogue `quincaillerie-nord` n'existe pas (404) et la clé était
restée au gabarit (403). Les liens ont été retirés dans la demi-heure.

**Trois contrôles, trois portées différentes** — et seul le troisième aurait
vu celui-là :

| contrôle | ce qu'il prouve |
|---|---|
| code HTTP | le document existe |
| rendu initial | le balisage et le style sont là |
| **après les requêtes** | **la page fonctionne** |

Le rendu initial ne suffit pas non plus : à l'ouverture, la page montrait son
en-tête, son bandeau, son hero et sa barre de recherche — tout était correct.
L'erreur n'apparaît qu'une fois l'appel `browse` revenu.

Le contrôle qui l'attrape : ouvrir la page, **attendre**, puis lire la console
et le DOM. `read_console_messages` avec `onlyErrors` donne les 4xx et 5xx en
une ligne ; un `querySelector` sur la zone qui devait se remplir dit si elle
s'est remplie. Les deux coûtent une seconde.

Corollaire : **une page qui dépend d'un appel réseau n'est vérifiée qu'après
cet appel.** Sur ce site, ça vise `demo/`, la console, le simulateur ROI et
tout bloc alimenté par l'API — pas les pages statiques.

### `docs-dark` n'est pas la marque des pages sombres

C'est la marque de **presque toutes les pages**. Mesuré le 28 août 2026 :

```
133 pages     122 portent body.docs-dark      11 ne la portent pas
```

Les onze sont `404.html`, `bienvenue.html`, `console.html`, `supervision.html`,
les quatre pages de `demo/`, et leurs équivalents anglais. Tout le reste
l'a — y compris `docs.html` et `pricing.html`, que l'on désigne couramment
comme « les pages claires ».

**LE NOM MENT, ET IL MENT DANS LE SENS QUI COÛTE.** « docs-dark » se lit comme
un marqueur d'exception — quelques pages en mode sombre. C'est l'inverse : la
règle est la classe, l'exception est son absence. 219 règles de `styles.css`
s'y accrochent, ce qui en fait le sélecteur le plus employé du fichier.

Conséquence pratique, rencontrée en mesurant si la modale de recherche dépend
du contexte de sa page : **une mesure faite sur n'importe laquelle des 122 est
vide, et rien ne le dit.** Comparer `index.html` à `docs.html` pour voir si un
composant change entre fond sombre et fond clair ne compare rien — les deux
portent la même classe. Il faut aller chercher `404.html` ou `bienvenue.html`,
et ce sont précisément les pages auxquelles personne ne pense.

Deux règles en découlent :

**Pour distinguer les deux familles, ne pas s'appuyer sur `docs-dark`.** Elle ne
sépare pas ce que son nom suggère. Le jour où il faudra vraiment opposer clair
et sombre, il faudra un autre marqueur — et le poser sur les onze, pas sur les
122.

**Et pour toute mesure « ce composant dépend-il de sa page ? », choisir sa page
témoin dans les onze**, jamais dans les 122. Le contrôle qui l'établit tient en
une commande :

```bash
python3 -c "
import glob, io, re
for p in sorted(glob.glob('**/*.html', recursive=True)):
    if 'node_modules' in p: continue
    m = re.search(r'<body([^>]*)>', io.open(p, encoding='utf-8').read())
    if m and 'docs-dark' not in m.group(1): print(p)
"
```

### Ce que le test de classement ne couvre pas

`tests/classement-fond.test.js` refuse tout sélecteur qui pose
`color:var(--ink*)` sans être classé — soit par une surcouche
`body.docs-dark`, soit dans la liste `@fond-clair` de `styles.css`.

**Il vérifie qu'une décision a été prise, pas qu'elle est juste.** Un
composant classé « fond clair » mais posé sur le dégradé passerait le test
en étant illisible.

Et il ne voit que les composants qui **déclarent** leur couleur. Sur les dix
défauts des rounds 2 et 3, il en attrape **cinq** :

| attrapé | non attrapé | pourquoi |
|---|---|---|
| `.tarif-note`, `.pb-repere`, `.copilot-point-source`, `.form-note`, `.contact-direct` | | déclarent `color:var(--ink*)` |
| | `.wordmark` (footer), `.tarif-ligne`, `.tarif-ligne strong` | **héritent** de `body{color:var(--ink)}`, ne déclarent rien |
| | `.faq-body` | classe orpheline, aucune règle CSS |
| | `.regex-copy p` | surcouche existante appliquée au mauvais endroit |

Vérifié dans les deux sens : retirer la surcouche de `.pb-repere` fait
échouer le test en le nommant ; retirer celle du logo du footer le laisse
passer.

**Il ne vérifie pas non plus ce que la surcouche FAIT.** Il exige qu'une
règle `body.docs-dark` existe pour un sélecteur qui pose `color:var(--ink*)`.
Elle peut ne traiter que le fond : le test passe, le texte reste noir.

`body.docs-dark section.soft{ background:transparent }` était exactement dans
ce cas — la surcouche existait, l'encre n'y était pas. Le défaut est resté
invisible tant qu'aucune page n'a posé de `<p>` **sans classe** dans une
section claire : la prose du site vit toujours dans un composant qui déclare
sa propre couleur. `partners.html` a été la première, le 26 août 2026 — dix
paragraphes à 1,11:1, vus à l'écran, pas par le test.

Un test qui vérifie la **présence** d'une règle ne vérifie pas ce qu'elle
fait. C'est la même limite que celle nommée plus haut, d'un cran plus fin :
là le test constatait qu'une décision avait été prise sans juger si elle
était juste ; ici il constate qu'une règle existe sans lire son contenu.

**La cause des cinq non attrapés est une seule ligne** : `body{
color:var(--ink) }` pose du texte quasi-noir, et `body.docs-dark{}` change le
fond sans toucher à la couleur héritée. Tout élément sans déclaration propre
hérite donc du noir sur un dégradé sombre. Mesuré : 29 classes sur trois
pages dépendent aujourd'hui de cet héritage — mais sur fond **clair**, où il
est correct. Les corriger explicitement permettrait de poser
`body.docs-dark{ color:#CDD2F0 }` et de fermer la famille entière.

La règle du regard reste donc nécessaire. Le test réduit la surface, il ne
la supprime pas.

#### Une opacité n'est pas une couleur, et aucun garde ne la voit

Défaut mesuré le 28 août 2026, pas une observation : l'état de chargement de
la modale de recherche est **sous le seuil AA sur les deux fonds**, l'ancien
comme le nouveau.

Une seule règle le produit :

```css
.search-results[data-chargement] .search-result{ opacity:.45; }
```

Mesuré en composant la couleur résultante sur chaque fond :

| | avant (`#fff`) | après (`#101B4D`) |
|---|---|---|
| titre atténué | 2,97:1 | 4,09:1 |
| extrait atténué | **2,00:1** | **3,25:1** |

Le passage au fond sombre remonte les deux et n'en sauve aucun. 4,5:1 reste
hors de portée dans les deux cas.

**LA SECTION CI-DESSUS NOMME DEUX FAMILLES, ET CELLE-CI EST UNE TROISIÈME.**
Le test attrape les composants qui **déclarent** `color:var(--ink*)`. Il rate
ceux qui **héritent** — c'est la limite déjà écrite. Cette règle-ci ne fait ni
l'un ni l'autre : elle ne déclare aucune couleur et n'en hérite d'aucune, elle
**module ce qu'il y a dessous**. La couleur composée n'existe qu'au rendu, et
aucune règle CSS ne la contient. Un test qui lit le fichier ne peut pas la
lire.

**Et sa valeur dépend du fond, alors que la règle ne le mentionne pas.** Le
même `.45` rend 2,00:1 sur blanc et 3,25:1 sur `#101B4D`. Changer le fond d'un
panneau change donc le contraste d'un état qui n'est écrit nulle part dans le
diff — et personne ne l'avait mesuré sur **aucun** des deux fonds. C'est
exactement ce qui reste sous le seuil pendant des mois : l'état dure quelques
centaines de millisecondes, ne se produit que sur un index froid, et son
défaut n'est visible dans aucun fichier.

Corollaire : **toute propriété qui compose une couleur sans en déclarer une
se mesure au rendu ou ne se mesure pas.** `opacity`, `filter`, `mix-blend-mode`
et `backdrop-filter` sont dans ce cas. Le contrôle est le même que pour le
reste — composer et calculer le rapport — mais rien ne rappelle qu'il faut le
faire, parce qu'aucune couleur n'apparaît à l'endroit du défaut.

Non corrigé ici : le lot était « rien d'autre que l'habillage ». Dette
mesurée, à traiter à part.

#### Une valeur validée sur un fond et appliquée à deux

Le 28 août 2026, un audit externe demande de rendre visible le contour de la
modale de recherche. Le constat est juste : bordure blanc 14 % sur un panneau
`#101B4D` posé sur le même `#101B4D`, mesuré à **1,05:1** en haut du dégradé,
loin sous les 3:1 de WCAG 1.4.11. Les valeurs proposées sont précises, la
teinte est reprise d'un jeton existant, et le rapport nomme même la page à
vérifier : l'accueil, « dégradé le plus marqué ».

**Appliquées telles quelles, elles auraient dégradé le contour sur onze
pages en le corrigeant sur 122.**

| bordure `#CDD2F0` | intérieur | dégradé | **blanc** |
|---|---|---|---|
| `.45`, la valeur proposée | 3,27:1 | 2,88:1 | **1,04:1** |
| état d'avant, blanc 14 % | 1,51:1 | 1,05:1 | **3,63:1** |
| `.95`, retenu | 9,91:1 | 8,76:1 | 3,17:1 |

La colonne qui décide n'avait pas été mesurée. Sur `404.html`, le hero
s'arrête à `y=640` et le panneau descend à `y=705` : **les 65 derniers pixels
de bordure longent du blanc pur.** Une bordure claire y devient invisible.

**C'EST LA SECTION `docs-dark` QUI SE REJOUE, D'UN CRAN PLUS BAS.** Elle
avertit déjà que pour toute mesure « ce composant dépend-il de sa page ? », la
page témoin se choisit dans les onze, jamais dans les 122 — et le CSS de cette
modale porte, écrit juste au-dessus des règles touchées, le résultat de cette
vérification : « LA MODALE NE DÉPEND PAS DE SA PAGE ». C'était vrai, et ça
reste vrai : aucune règle `.search-*` sous `body.docs-dark`, valeurs calculées
identiques partout. **Le panneau ne dépend pas de sa page. Le voile, lui, est
posé sur ce que la page peint.** Un composant peut être indépendant de son
contexte et poser quand même, à un pixel de là, une surface qui ne l'est pas.

La contrainte réelle est bilatérale, et c'est ce qui la rend contre-intuitive :
la bordure doit s'écarter de 3:1 du panneau **très sombre** et du blanc voilé
**clair**. Aucune valeur intermédiaire ne satisfait les deux — il faut sortir
par le haut, à `.95`, loin de ce que « bordure discrète » suggère.

C'est le motif de l'opacité ci-dessus, à l'envers. Là, `opacity:.45` était sous
AA sur les **deux** fonds et personne ne l'avait mesurée sur **aucun**. Ici la
valeur est mesurée, et sur un seul.

| | mesuré sur | manqué |
|---|---|---|
| l'opacité | aucun fond | les deux |
| **le contour** | **un fond** | **l'autre** |

Corollaire : **une valeur de contraste n'est validée que sur les fonds où on
l'a composée.** Le nombre est juste, il est simplement plus étroit que la règle
CSS qui le porte — une règle sans `body.docs-dark` s'applique à toutes les
pages, la mesure qui la justifie n'en couvrait qu'une. C'est « un chiffre porte son
périmètre » appliqué à un rapport de contraste : le périmètre d'une mesure de
couleur, ce sont les **fonds** composés, et il ne voyage pas avec le chiffre.

Le contrôle, et il ne coûte rien puisque le compositeur du navigateur le fait :
composer la couleur sur **chaque famille de fond où le composant peut
s'ouvrir**, pas sur celle qu'on avait sous les yeux. Les deux familles de ce
site se listent en une commande, déjà écrite plus haut — et ce sont les onze
qu'il faut ouvrir, parce que ce sont celles auxquelles personne ne pense.

#### Un correctif appliqué aux fichiers CLIENTS et pas à notre propre vitrine

Le 27 août 2026, `heurix-browse-widget.js` écrivait `p.name` et `p.id` bruts
dans `innerHTML` : du XSS stocké, dans un fichier installé chez le client. Le
commit qui l'a fermé porte le raisonnement complet — `esc()` sur le texte,
attributs passés en double quote parce que `esc()` ne traite pas l'apostrophe.

**`demo-boutique.js` faisait exactement la même chose, et est resté ouvert
deux jours de plus.** Trouvé le 29 août en le réécrivant pour brancher le
widget, pas en cherchant.

La raison est structurelle, et c'est elle qu'il faut retenir : la recherche
qui a mené au correctif portait sur **ce qu'on livre**. `downloads/` est la
surface qu'on pense à auditer — elle part chez des tiers, elle a des tests,
elle est nommée dans la documentation. La boutique de démonstration est du
code que *nous* écrivons pour *notre* site, et le réflexe la range du côté
« notre code », pas du côté « code exposé ».

Elle consomme pourtant la même API, affiche le même catalogue, et sert des
visiteurs réels — des prospects, précisément. **Le seul site qui a porté ce
XSS pendant deux jours de plus est le nôtre.**

Corollaire, et il vaut pour tout correctif de cette famille : **quand un
défaut est trouvé dans un fichier de `downloads/`, la question suivante est
« qui d'autre écrit ce motif ? », pas « le fichier est-il corrigé ? »**. Ici
la réponse tenait en une commande :

```bash
grep -rn 'innerHTML' --include=*.js . | grep -v downloads/ | grep -v node_modules
```

Les fichiers de démonstration, les scripts de console et les harnais de test
consomment les mêmes données que les widgets livrés. Ils ne sont pas moins
exposés ; ils sont seulement moins regardés.

#### Le fond qu'on croit avoir trouvé, et qui n'est pas celui qui peint

**Troisième fois, le 29 août 2026, que c'est un fond non composé qui fausse un
rapport** — après l'opacité mesurée sur aucun fond et le contour mesuré sur un
seul. Cette fois le fond n'était pas *mal choisi* : il était **introuvable par
la méthode qui le cherchait**, et la mesure a quand même rendu un nombre.

Deux ratios faux dans la même passe, sur `docs.html` en `body.docs-dark`, tous
deux **sous-estimés** — donc tous deux ressemblant à un défaut d'accessibilité
qui n'existait pas :

| élément | mesuré | réel | ce que la mesure avait pris pour fond |
|---|---|---|---|
| texte du paragraphe | 1,49:1 | **10,94:1** | `#fff`, par repli |
| `code.docs-inline-code` | 2,79:1 | **5,21:1** | le fond de la page |

Les deux causes sont distinctes, et c'est ce qui rend le motif difficile à
voir d'un coup :

- **Remonter les ancêtres en cherchant un `background-color` opaque ne trouve
  rien sur ce site.** Le fond sombre est un `background-image:
  radial-gradient(...)` posé sur `body` ; `body` et `html` ont tous deux
  `background-color: rgba(0,0,0,0)`. Une fonction qui s'arrête au premier
  `background-color` non transparent remonte jusqu'à la racine, ne trouve
  rien, et **retombe sur du blanc** — en rendant un chiffre d'apparence
  normale. Le fond réel, loin dans la page, est la borne finale du dégradé,
  `rgb(16,27,77)`.
- **À l'inverse, un élément peut porter son propre fond opaque** et ne pas
  devoir être mesuré sur celui de la page du tout. `.docs-inline-code` a une
  puce `rgb(238,241,255)` : mesurer son texte sur le fond sombre le déclare
  sous AA alors qu'il ne touche jamais ce fond.

Corollaire, et c'est la forme générale des trois occurrences : **le fond qui
décide d'un rapport est celui qui PEINT sous le glyphe, et aucune propriété
CSS ne le nomme.** Ni `background-color` sur un ancêtre, ni le fond de la
page : la composition seule le donne. Un repli silencieux vers le blanc est le
pire des comportements, parce qu'il rend un nombre plausible au lieu d'échouer.

Le contrôle qui aurait évité les deux : avant de croire un rapport, **vérifier
que le fond employé a bien été trouvé, et pas remplacé par un défaut** — une
fonction de mesure doit signaler « aucun fond opaque trouvé » plutôt que
supposer `#fff`.

Et si la capture d'écran avait été disponible, elle aurait tranché en une
image. Elle ne l'était pas : le pane du navigateur ne peint pas `docs.html`
sous la ligne de flottaison, quelle que soit la méthode de défilement
(`scrollTo`, `scrollTop`, ancre `#facettes`, `scroll-behavior:auto`) — la
capture revient noire alors que le DOM place bien le paragraphe à 140 px du
haut. **Quand l'instrument visuel tombe, le calcul reste le bon repli — mais
il faut alors le dire, et vérifier le repli lui-même**, ce que les deux
chiffres ci-dessus montrent nécessaire.

### Déplacer une section = balayer les ancres

Tout déplacement d'une section vers une autre page doit être suivi d'un
**balayage des ancres internes du site**. Une ancre absente ne produit ni
erreur ni message : le clic ne fait simplement rien.

Le 26 août 2026, sortir le simulateur ROI de l'accueil a laissé
`index.html#tarifs` mort dans le menu de **116 pages** — 126 occurrences.

C'est le **troisième** défaut de cette forme en une semaine : un lien recopié
dans chaque page, cassé d'un coup. Les deux autres étaient `hreflang` et
`og:url`. Le motif est toujours le même — une valeur dupliquée partout, une
seule cause, et rien qui le signale.

Le balayage, en une commande :

```bash
python3 - <<'EOF'
import glob, re, os, collections
pages = [p for p in glob.glob("**/*.html", recursive=True) if "node_modules" not in p]
morts = collections.defaultdict(list)
for p in pages:
    s = open(p).read()
    sans_js = re.sub(r'<script\b[^>]*>.*?</script>', '', s, flags=re.S)  # les gabarits JS ne sont pas des liens
    ids = set(re.findall(r'id="([^"]+)"', s))
    for a in set(re.findall(r'href="#([^"]+)"', sans_js)):
        if a and a not in ids: morts[a].append(p)
for a, ps in sorted(morts.items(), key=lambda kv: -len(kv[1])):
    print(f"#{a} : {len(ps)} page(s) — ex. {ps[0]}")
EOF
```

**Vérifier la cible, pas la chaîne.** Un remplacement de texte peut réussir
partout et mener nulle part : les pages ne sont pas au même niveau
(`roi.html` à la racine, `../roi.html` depuis `blog/`), et un `../` de trop
fait basculer une page anglaise vers la version française sans rien casser
visiblement. Le contrôle qui compte résout chaque chemin depuis le dossier de
sa page et vérifie que le fichier existe — et que la langue est conservée.

### Reproduire un gabarit sans lire ce qu'il contient

Trois occurrences en une semaine, toujours le même geste : un bloc copié
d'une page vers une autre, où son contenu ne veut plus rien dire.

- Trois articles au `hreflang` cassé — le lien pointait vers l'équivalent de
  l'article dont le gabarit venait, pas du leur.
- `index.html#tarifs` dans le menu de 116 pages, resté après le déplacement
  du simulateur.
- Le sommaire de `guide-mise-en-route.html` recopié dans
  `guide-utilisation-console.html`, dont les huit entrées visaient des
  sections qui n'existent pas sur cette page.

**Ce qui rend le troisième cas instructif : le copier-coller précède la
traduction.** La version anglaise porte le même sommaire erroné, libellés
compris — l'article a donc été traduit depuis un original qui contenait déjà
le défaut, et personne ne l'a vu. Or traduire suppose de lire chaque phrase.
Un sommaire se regarde comme un bloc, pas comme du texte : on traduit les
huit libellés sans jamais cliquer une seule des huit ancres.

Corollaire : partir d'un gabarit oblige à relire **ce qu'il contient**, pas
seulement à l'adapter. Les valeurs qui pointent ailleurs — ancres, `hreflang`,
`og:url`, `canonical`, liens de sommaire — sont celles qui survivent au
copier-coller en devenant fausses, parce que rien dans la page ne les
contredit.

#### Ce n'est pas que les gabarits se périment. C'est qu'on copie la voisine.

Mesuré le 26 août 2026, sur huit occurrences en une semaine. Le diagnostic
« un gabarit a vieilli » est trop indulgent : il suppose qu'il existe un
gabarit, et qu'on le consulte. Ni l'un ni l'autre.

**Chaque page est créée en copiant une page voisine — celle qu'on avait sous
les yeux — et jamais la plus à jour.** La conséquence est mécanique et
contre-intuitive : un correctif appliqué à un sous-ensemble n'atteint pas les
pages nées **avant** lui, ce qu'on attend, **ni celles nées après**, ce qu'on
n'attend pas.

Le cas qui le prouve : le lien mobile « Se connecter », seul accès à la
console sous 640 px, ajouté le 3 août. Il manquait sur 77 des 118 pages — dont
2 créées le 11 août, 2 le 16, 4 le 22 et 6 le 24. **Trois semaines après le
correctif, on créait encore des pages sans lui.**

Second cas, dans l'autre sens : les pages `solutions/*` françaises (25 juillet)
sont nées sans la modale de recherche ; leurs équivalents **anglais**, créés le
31 juillet depuis un gabarit plus récent, l'avaient. La traduction était plus
correcte que l'original — et c'est pourtant l'original défectueux qui a servi
de modèle à tout ce qui a suivi.

Corollaire : **désigner une page de référence ne suffirait pas.** Elle
existait déjà, sous la forme du gabarit du 31 juillet, et personne ne l'a
reprise. Ce qui manque n'est pas une référence, c'est un signal au moment du
commit. D'où `tests/entete-structure.test.js` : il compare la structure
d'en-tête de toutes les pages entre elles, et échoue dès qu'une diverge sans
figurer dans une liste d'exceptions justifiées. Il ne dit pas laquelle est la
bonne — trancher à la place de l'auteur figerait une décision que personne n'a
prise. Signaler la divergence suffit.

Les huit, pour mémoire : `hreflang` de trois articles · `index.html#tarifs`
sur 116 pages · le sommaire du guide console · le sélecteur de langue de six
pages · la modale de recherche absente de 20 pages · le lien mobile absent de
77 · `index.html#mission` mort sur 76 · PrestaShop/WooCommerce/Shopify absents
du menu Developers de 77.

#### Une liste d'exceptions se périme aussi. Faites-la vérifier par le test.

Un test qui tolère des exceptions en accumule. Chacune est justifiée le jour
où on l'écrit ; aucune ne se relit ensuite, et la liste devient un inventaire
de dettes que plus personne ne conteste — le contraire exact de ce qu'elle
devait être.

`tests/entete-structure.test.js` porte donc **trois assertions sur sa propre
liste**, en plus de celle qui cherche les divergences :

- **aucune exception n'est périmée** — une page listée qui ne diverge plus
  doit sortir ;
- **chaque exception porte une raison lisible** — un renvoi (« idem l'autre
  page ») n'en est pas une ;
- **la référence reste tenue par plus de 90 % des pages** — sinon une dérive
  majoritaire deviendrait la norme et le test validerait le défaut.

**Les trois ont servi le jour de leur écriture, sur le travail de la même
séance :**

| assertion | ce qu'elle a attrapé |
|---|---|
| exception périmée | `404.html`, dès que son en-tête a été complété |
| raison lisible | mes deux « Idem `demo/index.html`. » et « Idem `console.html`. » |
| divergence non listée | les deux pages `en/demo/` créées une heure plus tard |

La première est la plus importante : sans elle, `404.html` serait restée
listée comme « asymétrie connue et assumée » alors que l'asymétrie n'existait
plus. C'est la seule chose qui empêche une liste d'exceptions de devenir une
liste de dettes oubliées.

Corollaire : **quand on s'autorise une liste d'exceptions, on écrit dans le
même mouvement ce qui la fera rétrécir.** Sinon elle ne fait que croître.

### Le menu est protégé : une modification partielle serait nommée

Fait mesuré le 28 août 2026, à garder pour le jour où quelqu'un voudra y
toucher.

**Le menu principal est écrit en dur dans chaque page** — `nav-dropdown.js`
n'anime que le déroulant, il ne construit rien. Y ajouter une entrée est donc
une modification de **toutes les pages**, exactement la forme qui a produit
trois
incidents en une semaine : `index.html#tarifs` mort sur 116 pages, le lien
mobile absent de 77, PrestaShop/WooCommerce/Shopify absents du menu Developers
de 77.

**Mais cette famille-là a désormais son garde, et c'est le seul point qui
compte.** `tests/entete-structure.test.js` compare la structure d'en-tête de
toutes les pages entre elles et échoue dès qu'une diverge sans figurer dans
une liste d'exceptions justifiées. Une modification appliquée à toutes les
pages sauf une serait donc **nommée**, pas servie en silence — ce qui manquait
aux trois
incidents ci-dessus.

Le fait est écrit ici parce qu'il est contre-intuitif dans le bon sens : la
lecture spontanée de « toutes les pages à modifier » est « trop risqué », et
elle
était juste avant ce test. Elle ne l'est plus. Le coût réel est la surface, pas
le risque.

**Décision du 28 août 2026 : le lien vers la démo n'entre PAS au menu.** Il
existe déjà sur toutes les pages `solutions/`, la documentation et les pages
plateformes ; le gain marginal ne valait pas une modification de tout le
site. Le refus porte sur le
rapport, pas sur le danger.

### Vérifier une liste prouve la liste, pas la page

Le 26 août 2026, le sélecteur de langue de six pages créées la veille menait
à `about.html` — la page dont leur gabarit venait. Leur `twitter:title`
annonçait « À propos d'Heurix » / « About ». Quatrième occurrence de la
famille ci-dessus, à trois valeurs près.

Ce qui la rend instructive : **les trois valeurs que j'avais vérifiées à la
création étaient justes.** Sitemap, `hreflang` réciproques, `og:url` propre à
chaque page — les trois demandées, les trois contrôlées, les trois correctes.
Le `hreflang` de `secteurs.html` désignait bien `en/secteurs.html`. C'est le
bouton EN, juste à côté, que le visiteur cliquait pour atterrir sur « À propos ».

Une liste de contrôle prouve ce qu'elle énumère. Elle ne dit rien de ce
qu'elle omet, et rien ne signale une omission : la page passe, le rapport est
vert, le défaut est intact. Ici la liste couvrait les valeurs lues par les
moteurs et manquait la seule que le visiteur actionne.

Le contrôle qui aurait vu les six ne part pas d'une liste mais d'une
question : **quelles valeurs de cette page désignent une autre page ?** Puis
il les résout toutes. Sur ce site elles sont cinq — `hreflang`, `og:url`,
`canonical`, le sélecteur de langue, et les liens de sommaire — plus les
métadonnées qui recopient un titre (`twitter:title`, qui doit valoir
`og:title` : vérifié, l'écart ne concernait que ces six pages sur 120).

Vaut aussi hors HTML. Le balayage d'ancres de la veille annonçait « zéro
ancre morte sur tout le site » en ne lisant que les `.html` ; `search.js`
routait toujours vers `index.html#tarifs` et `index.html#mission`. Le
périmètre réel était plus étroit que la phrase.

### Un script de versionnement qui annonce sa portée ne l'a pas mesurée

**Deuxième script de versionnement à mentir en une semaine**, après
`bump-version.sh`.

`bust-cache.sh` ancrait son motif sur `"(\.\./)?nom.css?v=` — **un seul
niveau de remontée**. Vrai quand `en/` était le seul sous-dossier, faux dès la
création de `en/blog/` et `en/solutions/`, qui écrivent `../../styles.css`.
Ces 38 pages n'ont donc reçu **aucun** bump depuis leur création : un visiteur
déjà venu y servait sa feuille de style périmée à chaque navigation ouverte
dans les 600 s suivant son dernier chargement, et sans qu'aucune requête ne
soit émise pour elle — pas « indéfiniment », la mesure du 31 août 2026 borne
la fenêtre à 600 s. Le script annonçait « propagé dans 80 fichier(s) » — sans
jamais nommer les 38 qui lui échappaient.

Il lisait aussi `git ls-files`, donc les seuls fichiers **suivis**. Une page
tout juste créée n'en fait pas partie : c'est précisément celle qui doit
recevoir la clef, et c'est celle qu'il sautait.

`bump-version.sh` avait eu la même maladie sous une autre forme : il
**énumérait** les dossiers, et son propre en-tête documente trois corrections
successives — `blog/` oublié, puis `en/blog/`, puis `solutions/`,
`en/solutions/` et `demo/`, soit 114 références périmées trouvées par une
revue externe. Il a été guéri le 24 août en remplaçant l'énumération par un
`find`.

**Le motif commun : une portée définie par un motif qui exclut en silence.**
Énumérer des dossiers, ancrer un `?` sur une profondeur, ne lire que l'index
git — ce sont trois formes de la même chose. Aucune ne produit d'erreur sur ce
qu'elle rate, et le compte affiché à la fin ressemble à une preuve de
couverture alors qu'il ne compte que ce qui a été vu.

Corollaire : **un script de portée doit dire ce qu'il n'a pas touché**, ou
au minimum comparer son résultat au total attendu. « 80 fichier(s) » n'est une
bonne nouvelle que si l'on sait qu'il y en avait 80.

**`bump-version.sh` a été supprimé le 26 août 2026**, pour une raison qui
n'est pas son ancienneté : les deux scripts étaient **incompatibles**. Il
alignait tous les assets sur un horodatage unique ; `bust-cache.sh` donne à
chaque asset le sien, ce que décrit ce fichier. Le lancer annulait le second
— et son propre en-tête disait « à lancer AVANT chaque commit qui touche
styles.css ou un fichier .js », donc la doc portée par le fichier contredisait
celle-ci. Vérifié avant suppression : aucun workflow, hook, `package.json`,
`Makefile` ni script d'aucun des cinq dépôts ne l'appelait ; seuls trois
passages de ce fichier et deux commentaires historiques de la CI le
nommaient.

### Un garde-fou peut certifier le contraire de ce qu'il détecte

Un garde-fou qui se tait laisse passer un défaut. C'est le cas ordinaire, et
on finit par le trouver autrement.

Celui-là faisait pire. Rejoué sur `1cbe26bc`, le contrôle de cohérence des
clefs de cache — dont le commentaire dit « repère le défaut de solutions/ » —
affirmait :

```
OK    styles.css : une seule clef sur tout le site.
```

pendant que 38 pages en servaient une autre depuis leur création. **Il ne
manquait pas le défaut : il certifiait son absence, dans les termes exacts de
ce qu'il devait détecter.** Un rapport vert de cette nature ne se corrige pas
tout seul, parce qu'il décourage précisément la vérification qui le
démentirait.

**La cause est la même que celle des deux scripts de versionnement : une
portée énumérée à la main.** Six assets surveillés ; la découverte
automatique en trouve **dix-huit**. Douze n'étaient contrôlés par personne, en
silence — `billing-toggle.js`, `console-i18n.js`, `console-select.js`,
`csv-console.js`, `demo-epinglage.js`, `demo-search-live.js`, `docs-copy.js`,
`heurix-pictos.js`, `heurix-search.js`, `logo.svg`, `reveal.js`,
`visite-editeur.js`.

**Trois occurrences le même jour** : les six assets de la CI, l'index de
recherche du site (quatre pages liées depuis la navigation et absentes),
`HEURIX_SEARCH_LATEST_PATHS` (écrite le 6 août, jamais rouverte, proposant
vingt jours plus tard les articles classés 23ᵉ, 27ᵉ et 29ᵉ sur 30 sous le
libellé « Latest articles »). Toutes trois : une liste juste le jour où on
l'écrit, fausse ensuite, et rien qui le signale — une liste périmée reste du
JavaScript valide.

Deux corollaires :

**Un contrôle qui affirme une propriété sur « tout » doit dériver son
périmètre, jamais l'énumérer.** Sinon il n'affirme cette propriété que sur ce
qu'il connaît, tout en la formulant sur l'ensemble.

**Et il se vérifie en le faisant échouer, pas en le voyant passer.** Un
contrôle vert sur un défaut déjà corrigé ne prouve rien. La seule preuve est
de faire diverger volontairement, de le voir nommer le coupable, puis de
restaurer — les deux sens, à chaque fois.

#### Une exclusion doit porter sa raison, et cette raison doit rester vérifiable

Quatrième occurrence, le 27 août 2026, et la première où l'angle mort était
**délibéré, documenté, et juste le jour où il a été écrit**.

`bust-cache.sh` excluait `downloads/` de son motif, et son commentaire disait
pourquoi : ce dossier « désigne un fichier distinct ». C'était vrai. Un
`heurix-search.js` vivait à la racine et un autre dans `downloads/` ; les
confondre aurait bumpé le mauvais. L'exclusion était le contraire d'une
négligence.

Puis `4a028c1d` a supprimé l'orphelin de la racine, le 26 août. L'homonyme
n'existait plus. **L'exclusion, elle, est restée** — et le lendemain, lancée
sur `heurix-search.js`, elle a bumpé les 4 extraits de documentation et
manqué les 8 références réelles. L'inverse exact de ce qu'il fallait, sur le
seul fichier qui n'existait plus qu'à un endroit.

La CI était aveugle au même segment, des deux côtés : sa classe de caractères
d'extraction, `[A-Za-z0-9_-]+`, ne contient pas `/`, et son contrôle par
commit identifiait l'asset par `basename`. Trois outils, un seul angle mort.

**Aucun test ne rattrape cela, et c'est le point.** Le script fait exactement
ce qu'on lui a dit. Il n'échoue pas, il ne ment pas sur ce qu'il a fait, il
n'a aucun bug. Un test ne peut pas distinguer une exclusion *délibérée* d'une
exclusion *périmée* sans relire la raison et la revérifier — ce qu'aucun test
ne fait, parce que la raison vit dans un commentaire.

Deux règles, donc :

**Toute exclusion dans un motif porte la raison qui la justifie.** Un motif
qui exclut sans dire pourquoi est indéfendable : personne ne saura plus tard
s'il faut le corriger ou le respecter.

**Et cette raison doit rester vérifiable après coup.** « Parce qu'un homonyme
vit à la racine » se vérifie d'une commande. « Par prudence » ne se vérifie
pas, donc ne se périme jamais, donc ne sera jamais retirée.

C'est le pendant de la section sur les listes d'exceptions, à un endroit plus
sournois. Une liste nomme ses membres : le test peut les reprendre un à un et
signaler ceux qui ne divergent plus. **Une exclusion dans une expression
régulière ne nomme rien.** Elle ne produit aucune liste, ne laisse aucune
trace, et le compte affiché à la fin ne compte que ce qu'elle a laissé
passer. D'où son seul garde-fou possible, désormais dans `bust-cache.sh` :
**dire ce qu'on n'a pas touché**, en comparant au total des références
portant le même nom de fichier, quel que soit leur chemin.

#### Le garde a échoué, l'a dit dans les bons termes, et le site s'est déployé quand même

Le pendant exact de la section ci-dessus, et il est pire. Là, le garde-fou
disait vert en ayant tort. Ici il dit **rouge en ayant raison**, et ça ne
change rien.

Le 28 août 2026, quatre schémas portaient deux clefs `?v=` selon la langue de
la page. Le job `Clefs de cache a jour` a échoué sur `0a9de34c` à 10:15, en
nommant les fautifs un par un :

```
ECHEC img/architecture-integrations.svg : 2 clefs ?v= differentes selon la page.
ECHEC img/deux-passes-automobile.svg    : 2 clefs ?v= differentes selon la page.
```

Rien à reprocher au contrôle : périmètre dérivé, identité par chemin
normalisé, message actionnable. **Il a fait son travail exactement.**

Et sur le même SHA, la même minute :

```
failure  0a9de34c  CI
success  0a9de34c  pages-build-deployment
```

**Ce sont deux workflows séparés, et le déploiement ne dépend pas de la CI.**
Il ne peut pas en dépendre : le déploiement Pages par branche se déclenche sur
le push, pas sur un résultat. Le défaut est donc parti en production avec son
alarme rouge allumée à côté, et la session qui l'avait produit s'est terminée
sans la lire.

Deux échecs de nature différente, et le second ne se corrige pas en
améliorant les gardes :

| | le garde | ce qui manque |
|---|---|---|
| famille ci-dessus | se trompe | un périmètre dérivé |
| **celle-ci** | **a raison** | **quelqu'un ou quelque chose qui l'écoute** |

Aucun contrôle supplémentaire ne répare un contrôle juste que personne ne lit
et que rien n'applique. Le remède est ailleurs : **avant de considérer un lot
fini, lire le résultat de la CI sur le commit qu'on vient de pousser.** Une
commande, et elle nomme le job :

```bash
gh run list --limit 3 --json conclusion,headSha,workflowName,displayTitle \
  --jq '.[] | "\(.conclusion)  \(.headSha[0:8])  \(.workflowName)"'
```

##### Ce n'est pas un accident : onze fois en sept jours

Mesure du 21 au 28 août 2026, sur les 121 SHA de la fenêtre : **onze CI
rouges, onze déploiements réussis.** Aucune exception. Un push sur onze
(9,1 %) est parti en production avec un contrôle en échec.

Et ce n'est pas une classe unique de défaut :

| job en échec | occurrences |
|---|---|
| `Clefs de cache a jour` | 7 |
| **`Suite de tests`** | **4** |
| `Index de recherche a jour` | 2 |

**Une suite de tests rouge est partie en production quatre fois cette
semaine.** Le chiffre est ce qui distingue un incident d'un mode de
fonctionnement, et il tranche : ce n'est pas qu'on a raté une alerte, c'est
qu'aucune alerte n'a jamais rien arrêté.

##### Le coût de fermer la porte, mesuré et non estimé

Deux voies : passer le déploiement à un workflow Actions qui exige une CI
verte, ou garder Pages par branche et s'imposer de lire la CI. Ce qui suit est
mesuré ; la décision ne l'est pas.

**Configuration actuelle**, lue sur l'API :

```
build_type: "legacy"   source: {branch: main, path: /}
cname: "heurix.fr"     https_enforced: true
```

**Rien de ce que le site utilise ne dépend du mode par branche.** Vérifié un
par un : pas de `_config.yml`, pas de `_layouts`, pas de `_includes`, pas de
`Gemfile`, **zéro** page à front matter Jekyll, **zéro** balise Liquid sur 869
fichiers suivis. Le site est statique au sens strict, Jekyll ne fait que le
recopier.

`cname` est un champ **de premier niveau** de l'API, frère de `source` et de
`build_type`, donc pas une propriété du mode de build. Non vérifié pour
autant : je n'ai pas fait la bascule.

**La seule différence observable** est que Jekyll masque les fichiers commençant
par `.`. Mesuré en production : `docs/maquettes/README.md`, `tests/*.js`,
`scripts/bust-cache.sh` et `package.json` répondent **200** aujourd'hui — le
mode par branche ne cache donc rien d'utile — tandis que `.gitignore` rend
**404**. Passer à Actions publierait quatre fichiers de plus : `.gitignore`,
`.gitleaks.toml`, `.github/workflows/CI.yml` et `.DS_Store`. Les trois premiers
sont déjà publics, le dépôt l'étant. Le quatrième ne devrait pas être suivi du
tout.

**La vitesse**, sur les runs réussis récents :

| | n | médiane | min | max |
|---|---|---|---|---|
| `CI` | 19 | **36 s** | 26 s | 44 s |
| `pages-build-deployment` | 30 | **45 s** | 36 s | 64 s |

Aujourd'hui les deux tournent **en parallèle** : la mise en production coûte
45 s et la CI ne la retarde pas. Exiger une CI verte les **sérialise**. Le
plancher devient donc 36 s plus la durée du déploiement Actions, quelle qu'elle
soit — et cette dernière n'est pas mesurable sans faire la bascule. Ce qui est
certain sans la faire : **la mise en production passe d'environ 45 s à au moins
80 s**, même si le déploiement Actions était gratuit.

L'artefact serait de 17 Mo pour 869 fichiers, `node_modules` n'étant pas suivi.

**Une troisième voie existe et n'a pas le même prix.** Une protection de
branche avec contrôle obligatoire ne retarde pas le déploiement : elle empêche
le commit rouge d'atteindre `main`. Mais elle interdit le push direct sur une
branche protégée, donc elle impose de passer par une PR — un changement de
méthode de travail, pas de déploiement. À évaluer comme telle, pas comme une
variante des deux premières.

##### La troisième voie est mécanique — à un réglage près, et c'est lui qui décide

Mesuré sur la documentation GitHub le 28 août 2026, pas supposé. La question
est : une session peut-elle ouvrir une PR et la fusionner elle-même une fois la
CI verte ? **La réponse dépend d'une seule case, et les deux réponses sont
opposées.**

Deux faits de la documentation :

- « Require approvals » est une case **distincte et optionnelle** sous
  « Require a pull request before merging ». Exiger une PR n'exige donc pas
  d'approbation.
- Et, textuellement : « Pull request authors cannot approve their own pull
  requests. »

D'où les deux configurations, à ne pas confondre :

| « Require approvals » | qui fusionne | coût réel |
|---|---|---|
| **décochée** | l'auteur, dès que les contrôles passent | **mécanique** — le flux reste fluide |
| cochée (≥ 1) | **personne**, sur un dépôt solo | chaque lot attend un tiers |

La seconde ligne n'est pas une gêne, c'est un blocage total : sur un dépôt à un
seul humain, une approbation obligatoire ne peut jamais être satisfaite par
l'auteur, et il n'y a personne d'autre.

**L'auto-fusion rend le flux entièrement automatique.** Elle fusionne la PR dès
que les contrôles requis passent ; une personne ayant le droit d'écriture peut
l'activer sur sa propre PR. Deux conditions mesurées : elle doit être activée
au niveau du dépôt — ici `allow_auto_merge: false`, donc à activer — et l'option
n'apparaît que sur une PR **non fusionnable immédiatement**, donc elle suppose
la règle de protection. Les deux vont ensemble.

Le flux d'une session deviendrait alors, sans intervention humaine :

```bash
git switch -c lot-xxx && git push -u origin lot-xxx
gh pr create --fill && gh pr merge --auto --squash
```

**MAIS LA PROTECTION GARDE LA FUSION, PAS LE DÉPLOIEMENT.** La fusion produit
un **nouveau** commit sur `main`, et Pages se déclenche dessus sans condition —
c'est structurel, et ça ne change pas. La CI a tourné sur la tête de la PR, pas
sur le résultat de la fusion. Avec trois sessions en parallèle, les deux
peuvent différer.

Le réglage qui ferme cet écart est nommé dans la même page : « Require branches
to be up to date before merging », qui force la PR à être testée sur le dernier
état de la branche protégée. **Sur ce dépôt, c'est lui qui compte** — sans lui,
la garantie obtenue est « la CI était verte sur ce qui a été testé », pas
« sur ce qui est parti ».

État mesuré aujourd'hui : aucune protection de branche, aucun ruleset,
`allow_auto_merge: false`, `allow_squash_merge: true`.

##### La quatrième voie ne peut pas copier le moteur, et la raison est structurelle

`deploy/deploy-complet.sh` de `heurix-engine` interroge la CI du commit qu'il
va déployer et refuse en trois cas distincts — elle tourne encore, elle est
rouge, ou **elle est verte sur un autre SHA que HEAD**. Ce dernier contrôle est
le meilleur des trois.

**Le site ne peut pas le reprendre, et pas par manque d'outillage.** Pour le
moteur, déployer est un acte séparé et postérieur : quand le script s'exécute,
la CI a déjà tourné sur ce commit, il y a quelque chose à interroger. **Pour le
site, le push EST le déploiement.** Au moment où le contrôle s'exécuterait, la
CI de ce commit n'a pas tourné et ne peut pas avoir tourné. Il n'y a rien à
interroger.

La quatrième voie n'est donc pas « vérifier l'état de la CI » mais **exécuter
ses contrôles en local avant de pousser**. Mesuré, les quatre blocs `run:` de
`CI.yml` rejoués sur cette machine :

| bloc | durée |
|---|---|
| `Index de recherche a jour` | 2,5 s |
| `Suite de tests` | 15,6 s |
| `Clefs de cache` — clef bougée | 0,1 s |
| `Clefs de cache` — clef unique | 1,0 s |
| **total** | **19,4 s** |

Tous verts. C'est **moins que les 36 s de la CI distante**, qui paie en plus son
checkout et son installation.

**Contrainte de conception, et elle est déjà écrite plus haut dans ce
fichier : le crochet doit EXTRAIRE les blocs de `CI.yml`, pas les recopier.**
Un contrôle qui réimplémente sa cible finit par mesurer sa propre
réimplémentation — c'est le défaut de `--verifier` et ses 2 801 termes
sous-comptés. `python3 -c "import yaml"` suffit à lire le fichier ; la mesure
ci-dessus a été faite comme ça.

**Ce que cette voie ne donne pas, et qu'il faut dire avant de la choisir :**

- `.git/hooks` **n'est pas versionné**. Chaque session l'installe, ou on pointe
  `core.hooksPath` sur un dossier suivi — mais ce `git config` est lui-même par
  clone. Mesuré ici : aucun crochet installé, `core.hooksPath` non défini.
- `git push --no-verify` la contourne. C'est un rappel, pas une porte.
- Elle teste **l'arbre local**, pas le commit poussé, et pas les commits
  intermédiaires d'une série.
- **`npm ci` est sauté en local** — je l'ai sauté dans la mesure. Une dépendance
  périmée localement diverge de la CI sans que rien ne le dise. C'est
  exactement la famille de l'instrument qui mesure autre chose que sa cible.

Elle a en revanche l'avantage que rien d'autre n'a : **elle ne demande rien à
personne**, ne change pas la méthode de travail, et ne retarde pas le
déploiement d'une seconde.

##### Le geste qui rendrait le crochet impossible à oublier existe, et il a un piège

**C'est la limite qui décide si le crochet vaut quelque chose.** Installé sur
un clone et absent des deux autres, il protège un tiers des pushs en donnant
l'impression d'en protéger trois tiers — et l'impression est le vrai coût, pas
le tiers manquant.

Mesuré : `npm` exécute le script `prepare` d'un `package.json` **à la fois sur
`npm install` et sur `npm ci`** (npm 11.16.0, vérifié sur un paquet d'essai).

C'est ce qui le rend presque impossible à oublier : **on ne peut pas lancer la
suite de tests sans `node_modules`, et on ne peut pas obtenir `node_modules`
sans passer par npm.** Le geste qu'aucune session ne saute est donc exactement
celui qui poserait le crochet.

```json
"scripts": { "prepare": "scripts/installer-crochets.sh || true" }
```

**LE `|| true` N'EST PAS UNE PRÉCAUTION, IL EST OBLIGATOIRE, et mesurer
pourquoi a évité de casser la CI.** Le job « Suite de tests » lance `npm ci`
(ligne 95 de `CI.yml`) et utilise `setup-node`, **pas `setup-python`**. Or
`scripts/installer-crochets.sh` sort en 1 quand PyYAML manque — délibérément,
pour que l'absence se découvre à l'installation plutôt qu'au premier push. Sans
le `|| true`, ce refus remonterait dans `npm ci` et **ferait échouer le job de
tests**.

**MESURÉ APRÈS COUP, ET ÇA CORRIGE MA PROPRE JUSTIFICATION.** Le log de la
CI de `6657984d` montre `prepare` s'exécutant dans `npm ci` sur le runner, et
rendant :

```
✓ core.hooksPath -> scripts/hooks
✓ PyYAML présent -- le crochet peut lire CI.yml.
```

**PyYAML est donc là, et le `|| true` n'a pas servi.** Il n'a pas sauvé la CI :
il n'a simplement pas eu à jouer. J'avais écrit « rien n'établit que PyYAML
soit sur le runner » — c'était vrai comme constat sur le dépôt, et faux comme
prédiction sur la machine.

Le `|| true` reste néanmoins obligatoire, pour une raison **différente de
celle que je lui donnais** : la présence de PyYAML n'est déclarée nulle part.
Aucun `setup-python` dans ce job, aucun `pip install`, aucun script de la CI
qui importe `yaml` — vérifié un par un. Elle est un accident de l'image
`ubuntu-latest`, et une image change sans prévenir. **Le `|| true` protège
contre une dépendance non déclarée, pas contre une dépendance absente.**

C'est la distinction entre un garde qui a mordu et un garde qui n'a pas eu à
mordre. Les deux sont verts ; un seul est prouvé.

C'est un garde qui casserait ce qu'il protège, et il ne se serait pas vu à
l'écriture : la ligne `prepare` est correcte, l'installateur est correct, c'est
leur composition qui ne l'est pas. Seule la question « où tourne `npm ci`, et
avec quel python ? » le montre.

**Ce que ce geste ne ferme toujours pas**, et il faut le dire avec :
`npm install --ignore-scripts` le saute ; un `node_modules` recopié à la main
ne déclenche rien ; et la limite 2 du crochet, `--no-verify`, reste entière.
Seule une protection de branche est une porte.

Non posé ici : la consigne était de mesurer, pas de configurer.

##### « Up to date » impose une mise à jour MANUELLE, et c'est là qu'est l'embouteillage

Mesuré sur la documentation GitHub le 28 août 2026, parce que la différence
entre une contrainte et un embouteillage se joue entièrement là.

**GitHub ne met pas la branche à jour tout seul.** L'auteur clique
« Update branch » — une fusion de la base dans la branche par défaut, ou
« Update with rebase » depuis le menu. Le bouton n'apparaît que s'il n'y a pas
de conflit et que la branche est en retard.

Et une fois la branche mise à jour, **les contrôles repartent de zéro**. Le
coût réel n'est donc pas le clic, c'est le clic **plus** l'attente.

Sur un dépôt à trois sessions parallèles, la conséquence est mécanique :
**chaque fusion sur `main` met toutes les PR ouvertes en retard d'un coup.**
Trois PR en vol, une fusion, et les deux autres doivent être remises à jour et
recontrôlées. Plus il y a de sessions, plus la fenêtre entre « vert » et
« fusionné » se referme sur quelqu'un d'autre. C'est bien un embouteillage, et
il croît avec le nombre de sessions, pas avec la taille des lots.

**La file de fusion est la réponse documentée à exactement ce problème**, et la
doc l'écrit dans ces termes : elle donne les mêmes garanties que
« Require branches to be up to date before merging » sans demander à l'auteur
de mettre sa branche à jour ni d'attendre que les contrôles refinissent. Elle
teste chaque PR contre la base **plus les PR déjà en file**, puis fusionne.

**VÉRIFIÉ LE 28 AOÛT 2026 : LA FILE DE FUSION N'EST PAS DISPONIBLE ICI.**
L'annonce de disponibilité générale la donne « on private and public repos on
the GitHub Enterprise Cloud plan and all public repos owned by organizations ».
La condition n'est pas la visibilité, c'est **le type de propriétaire** — et
c'est exactement celle qu'on ne pense pas à vérifier, parce que « dépôt
public » semble suffire.

```
owner: flahaut-alexis    type: User    visibility: public
```

`heurix-site` appartient à un **compte personnel**, pas à une organisation. Il
est public et cela ne suffit pas. Le champ GraphQL `mergeQueue` résout pourtant
sur ce dépôt et rend `null` — **ce `null` dit « aucune file configurée », pas
« file indisponible »**, et le lire comme une réponse à la question de la
disponibilité serait exactement l'erreur du zéro pris pour une absence.

Il reste donc **deux** configurations, pas trois :

| | mise à jour de branche | ce qui garantit ce qui part |
|---|---|---|
| protection seule | — | **non** : la CI a testé autre chose que le résultat de la fusion |
| + « up to date » | **manuelle**, à chaque fusion d'autrui | oui, au prix d'un embouteillage à trois sessions |
| ~~+ file de fusion~~ | — | **hors de portée** tant que le dépôt appartient à un compte personnel |

**La condition est le type de propriétaire, pas la visibilité du dépôt.**
C'est le genre de fait qu'on redécouvre en le supposant : « dépôt public » se
lit comme suffisant, et ne l'est pas. Le contrôle tient en une ligne, et il
ne suppose rien :

```bash
gh api repos/<owner>/<repo> --jq '{owner:.owner.login, type:.owner.type, visibility}'
```

Transférer le dépôt à une organisation débloquerait la file. **Décision prise
le 28 août 2026 : non, pas aujourd'hui** — c'est un changement d'une autre
nature que le choix d'un garde. Le crochet seul, et réévaluation dans quelques
jours : **si les onze déploiements rouges deviennent zéro, il aura suffi.**

##### Et mon rejeu du contrôle a rendu l'inverse, parce que je l'avais changé de shell

J'ai d'abord rapporté que la CI groupait par **chemin** quand mon contrôle
groupait par **nom de fichier**, et qu'elle aurait donc manqué ces quatre-là.
**C'était faux, et j'allais l'écrire ici comme un constat.**

La CI fait `sed -E 's|^"(\.\./)*||'` : elle retire la remontée avant de
comparer. Son identité est le chemin normalisé — plus fine que mon nom de
fichier, pas plus grossière. Les deux attrapent le cas.

Ce qui m'a trompé est mon propre rejeu. J'ai recopié la boucle de la CI dans
le shell de la session, **zsh**, où `for BASE in $ASSETS` ne découpe pas une
variable non quotée en mots. La boucle a donc itéré **une seule fois**, sur la
chaîne entière, n'a rien trouvé, et a rendu « la CI aurait laissé passer ».
Relancée sous `bash -c`, la même boucle nomme les quatre.

> **Un fragment de script transplanté dans un autre shell ne mesure plus la
> même chose, et ne le signale pas.**

C'est la famille des instruments qui changent de cible, sous une forme qui ne
laisse aucune trace : pas d'erreur, pas de sortie vide, une réponse
d'apparence normale — « aucun échec » — qui est exactement la réponse qu'on
attendait à moitié.

**CE QUI L'A ATTRAPÉ COMPTE PLUS QUE LA CAUSE**, parce que la cause est
particulière — zsh, un `for` non quoté — et que le geste, lui, se réemploie
partout.

Le geste : **prendre un cas dont on connaît déjà la réponse, et vérifier que
l'instrument la donne, avant de lui faire dire quoi que ce soit du reste.**
Ici `familles-moteurs.svg` portait visiblement deux clefs — je venais de les
lire. La boucle a répondu « aucun échec ». C'est la contradiction entre une
réponse connue et une réponse rendue qui a ouvert l'enquête, pas une relecture
du code : relire ma boucle ne montrait rien, elle est une copie fidèle de celle
de la CI.

C'est **exactement le geste que réclame la note sur la mesure qui ne teste que
son hypothèse**, tourné vers un autre objet :

| | ce qu'on soumet à la contradiction |
|---|---|
| note du 28 août, `bust-cache.sh` | une **hypothèse** — lancer aussi la forme qu'on croit non supportée |
| celle-ci | un **instrument** — lui donner un cas dont la réponse est déjà connue |

Dans les deux cas on produit soi-même la sortie qui pourrait démentir, au lieu
d'attendre qu'une contradiction se présente. La différence est ce qu'on teste :
là ce qu'on croit, ici ce avec quoi on le vérifie. **Le second est plus
sournois, parce qu'un instrument ne se soupçonne pas** — il n'a pas d'opinion,
donc on ne lui en prête pas.

Corollaire opérationnel : **un instrument n'a le droit de répondre sur
l'inconnu qu'après avoir répondu juste sur le connu.** Un cas témoin coûte une
ligne, et sans lui « aucun échec » et « je n'ai rien regardé » sont la même
sortie — la distinction que la note sur l'incapacité de mesurer réclame déjà
des outils, appliquée cette fois à un outil qu'on vient d'écrire soi-même.

Rejouer un fragment de CI se fait donc sous `bash -c`, jamais dans le shell
interactif — et avec un cas témoin.

### La version anglaise est une zone que personne ne regarde

**Toute vérification à l'écran est partie de la version française.** Pas une
fois de l'anglaise. Ce n'est pas une négligence ponctuelle, c'est le réflexe
par défaut : on ouvre `index.html`, jamais `en/index.html`.

Le 27 août 2026, deux occurrences le même jour, de deux natures différentes.

**Ce que la traduction ne voit pas.** Le sommaire recopié de
`guide-mise-en-route.html` vers `guide-utilisation-console.html` visait huit
sections qui n'existent pas sur cette page. La version **anglaise** porte le
même sommaire erroné, libellés traduits. L'article a donc été traduit depuis un
original déjà défectueux, et traduire suppose de lire chaque phrase — mais un
sommaire se regarde comme un bloc. On traduit les huit libellés sans cliquer
une seule des huit ancres.

**Ce que la recopie casse, et dans un seul sens.** 19 liens relatifs morts, tous
des pages anglaises nées d'une française à une profondeur de plus :

```
solutions/index.html        ../logo.svg        ->  logo.svg             OK
en/solutions/index.html     ../logo.svg        ->  en/logo.svg          404
blog/guide-mise-en-route    ../downloads/x.js  ->  downloads/x.js       OK
en/blog/guide-mise-en-route ../downloads/x.js  ->  en/downloads/x.js    404
```

Neuf d'entre eux étaient les liens de téléchargement des widgets. Un marchand
anglophone cliquait « Download heurix-search.js » et recevait un 404. Depuis la
création des pages.

**Le pire détail** : sur la même page, l'en-tête écrivait `../../logo.svg`,
juste, et le pied de page `../logo.svg`, faux. Rien ne se voyait au-dessus de
la ligne de flottaison — et une vérification à l'écran qui s'arrête au premier
écran ne l'aurait pas trouvé non plus.

Ces défauts vivent tous dans une asymétrie FR/EN, donc **aucune comparaison
FR↔EN de contenu ne les attrape** : les deux pages disent la même chose, seule
l'une atteint sa cible.

**Le piège existe dans les deux sens, et la mesure l'établit :**

| | résultat | ce que voit le visiteur |
|---|---|---|
| un `../` **de trop** | bascule vers la version française | une page, mais dans la mauvaise langue |
| un `../` **manquant** | 404 | rien |

Le premier était déjà noté ici. Le second est celui du 27 août, et il est le
plus coûteux : neuf téléchargements morts valent mieux qu'une page en français
pour un moteur de recherche, et strictement moins pour un marchand.

Les deux se voient en cliquant — **à condition que quelqu'un clique.** C'est
toute la difficulté : ces deux erreurs ne se produisent que sur les pages
anglaises, précisément celles que personne n'ouvre. La vigilance ne les ferme
pas, parce que la vigilance s'exerce là où l'on regarde. **C'est le test qui
ferme les deux sens**, et il les ferme sans qu'on ait à y penser.

Trois conséquences pratiques :

**Une vérification à l'écran se fait sur les deux versions, ou elle n'est pas
faite.** L'anglaise n'est pas une traduction de la française, c'est une page
distincte, à une profondeur distincte, avec ses propres liens.

**Et elle descend jusqu'au pied de page.** Le premier écran est celui qu'on
regarde et celui où les défauts se rangent le moins.

**Ce qu'un œil ne peut pas couvrir, un contrôle dérivé le doit.** Les pages du
site, dans les deux langues, ne se cliquent pas.
`tests/liens-relatifs.test.js` résout chaque lien depuis le dossier de sa page
et demande au disque si le fichier existe —
périmètre dérivé, aucune liste de pages. Il aurait attrapé les 22.

#### Une asymétrie FR/EN qui n'est PAS un défaut, et il faut le dire aussi

Le 1er septembre 2026, en posant l'encart de démonstration sur les 22 pages
`solutions/`. **Le sélecteur de l'accueil porte trois verticales, pas deux**,
et la troisième n'existe que pour l'anglais :

| pastille | verticale API | produits (1er sept. 2026) | noms des produits |
|---|---|---|---|
| Bricolage & Outillage / Hardware & Tools | `outillage` | 2 821 | **français**, dans les deux langues |
| Mode & Prêt-à-porter | `mode` | 1 500 | français |
| Fashion & Apparel | `mode-en` | 1 500 | anglais |

La mode a sa version anglaise, l'outillage non. Un lecteur anglophone qui
clique depuis `en/solutions/outillage.html` obtient donc « Boulon TF M8X30
inox A2 ».

**CE N'EST PAS UN MENSONGE, ET LA DISTINCTION EST LE POINT.** La clause de
cette page promet « 2,821 hardware and fastener references » — un compte, pas
une langue. Elle est exacte. Ce qui est démenti, c'est une **impression**, pas
une phrase, et les deux ne se corrigent pas au même endroit : une phrase fausse
se réécrit, une impression démentie demande un catalogue.

**Ce qui la rend acceptable, et c'est mesurable :** ce que l'encart promet est
la mécanique d'annotation, et un nom de produit français ne l'empêche pas de se
voir. Le tableau de décomposition reste lisible — `M8x20 inox` rend 1 007
résultats sur cette verticale, le premier étant `Vis fraisée M8*20 inox A4`,
rapproché malgré le `*`. La démonstration porte sur la référence, qui n'a pas
de langue.

**Écrit ici parce que le fait se perd, pas parce qu'il se corrige.** Un
`outillage-en` le fermerait, comme `mode-en` a fermé l'autre. Ce n'est pas le
travail d'aujourd'hui, et sans cette note la prochaine session le
redécouvrirait à l'écran en croyant à un défaut.

**ET C'EST LE PIÈGE DE CETTE SECTION, RETOURNÉ CONTRE ELLE.** Tout ce qui
précède documente des pages anglaises réellement cassées — 19 liens morts, un
sommaire faux. La conséquence est qu'un soupçon sur `en/` part gagnant, et le
1er septembre il a produit **deux faux défauts en une heure** : un index EN
prétendument vide, et un lien vers un guide prétendument français. Les deux
étaient des erreurs d'instrument, détaillées plus bas.

> **Une section qui documente une faiblesse réelle rend crédible tout faux
> défaut de la même famille.** Elle abaisse le seuil de preuve exactement là
> où l'historique le justifie — et c'est là que le seuil doit rester haut.

### Une capacité documentée qui n'existe pas est pire qu'une limite documentée

Les deux sont des commentaires faux. Ils ne coûtent pas la même chose.

**Une limite documentée fait perdre du temps.** `rulepacks/vins.yaml` a porté
un mois durant : « le symbole ° est supprimé par la normalisation avant même
d'atteindre cette règle — inutile de le prévoir dans le motif, il ne se
déclencherait jamais ». C'était vrai le jour où ça a été écrit. C'était aussi
un constat transformé en contournement durable : la cause vivait dans
`fold()`, pas dans le pack, et personne n'y est remonté. **Le commentaire
enseignait la limite au lieu de la signaler.** Pendant ce temps « 13,5° », la
graphie la plus courante d'une étiquette de vin, ne sortait aucune
annotation.

**Une capacité documentée qui n'existe pas fait écrire du code qui ne
marchera pas.** Le 27 août, ce même commentaire a été remplacé par « le ° est
désormais reconnu ». Vrai pendant une heure — le correctif a été reculé le
temps de mesurer son prix. Un lecteur arrivant après aurait construit sur une
capacité absente, sans aucune raison d'aller vérifier : une doc qui promet ne
se met pas en doute, une doc qui limite invite au moins à essayer.

La forme juste est la troisième, et elle est plus longue à écrire : **dire
l'état, sa cause, et ce qui le débloque.** Le commentaire dit maintenant que
la cause est trouvée, que le correctif est écrit, où il vit, pourquoi il est
reculé, et quelle condition le libère.

Corollaire : **un commentaire qui décrit un comportement se périme au rythme
du code qu'il ne contient pas.** Celui de `vins` décrivait `fold()`, à deux
dépôts de distance. Les trois formulations successives ont été fausses tour à
tour, et aucune ne pouvait être vérifiée depuis le fichier qui la portait.

#### Le symétrique : un commentaire vrai, et aveuglant par ce qu'il ne couvre pas

Tout ce qui précède décrit des affirmations qui ont **cessé** d'être vraies.
Le 28 août 2026, la même famille s'est présentée à l'envers, et cette
occurrence-là est la plus difficile des deux.

`styles.css` porte, écrit en capitales juste au-dessus des règles de la modale
de recherche :

> LA MODALE NE DÉPEND PAS DE SA PAGE, vérifié avant d'écrire ces règles :
> aucune règle `.search-*` sous `body.docs-dark`, aucune des variables
> employées redéfinie hors de `:root`, et valeurs calculées identiques sur
> `index.html` (docs-dark) et `404.html` (aucune classe).

**Chaque mot est exact, la vérification a réellement eu lieu, et elle est
toujours valable aujourd'hui.** Le commentaire n'a jamais été faux une seule
seconde. Il ne le deviendra pas.

Il énonce pourtant une indépendance **du panneau**, et se lit comme une
indépendance **du composant**. Le voile — `.search-backdrop`, un frère du
panneau dans le même conteneur — est posé sur ce que la page peint, donc il
dépend de sa page entièrement. C'est ce qui a fait qu'une valeur de contraste
mesurée sur le seul accueil a failli partir en production : le commentaire
répondait d'avance, et par l'affirmative, à la question qu'il fallait poser.

**C'EST PIRE QU'UN COMMENTAIRE FAUX, ET POUR UNE RAISON MÉCANIQUE.** Un
commentaire faux finit par rencontrer une mesure qui le contredit — c'est ce
qui a sauvé les trois cas ci-dessus, et le septième défaut de
`bust-cache.sh`. Celui-ci ne rencontrera jamais de contradiction, puisqu'il
est vrai. Aucune mesure ne le démentira, aucun test ne mordra, et sa portée
réelle ne sera jamais mise en cause par les faits.

| | ce qui finit par l'attraper |
|---|---|
| commentaire devenu faux | n'importe quelle mesure de ce qu'il affirme |
| **commentaire vrai et étroit** | **rien — il faut penser à demander sa portée** |

Le geste, et c'est le seul qui marche ici : **quand un commentaire affirme une
indépendance, demander de quoi exactement, et sur quel élément.** Pas
« est-ce vrai ? » — ça l'est — mais « qu'est-ce que ça ne couvre pas ? ».
Ici : quels autres éléments ce composant pose-t-il, et ceux-là dépendent-ils
de la page ? Deux minutes, et la réponse était dans le même fichier, dix
lignes plus haut.

Corollaire d'écriture : **une affirmation de portée nomme son sujet.** « La
modale ne dépend pas de sa page » et « le panneau ne dépend pas de sa page »
coûtent le même nombre de mots. La seconde n'aurait rendu personne aveugle au
voile.

### Quatre divergences silencieuses, et la quatrième traverse les sessions

Quatre fois en une semaine, un instrument et sa cible ont divergé sans qu'un
test tombe. Les trois premières se ressemblent ; la quatrième est d'une autre
nature.

| | l'instrument | ce qu'il mesurait vraiment |
|---|---|---|
| 1 | `bust-cache.sh` et le contrôle de la CI | les références qu'un motif à un seul niveau de remontée voulait bien voir — 38 pages jamais bumpées |
| 2 | le contrôle de langue | « ce texte porte des accents », pas « ce texte est en français » |
| 3 | `generer_catalogue_pack.py --verifier` | sa propre réimplémentation de la tokenisation — 2 801 termes sous-comptés, seuil franchi sans le savoir |
| 4 | **le `.venv` partagé** | **le cœur natif d'une autre session** |

**Les trois premiers sont un instrument qui se trompait de cible.** Ils se
corrigent en dérivant la portée au lieu de l'énumérer, et en demandant son
résultat au système contrôlé plutôt qu'en le recalculant.

**Le quatrième est un instrument qui change la cible des autres**, et c'est
pour ça qu'il est plus dangereux. `maturin develop` remplace
`heurix_fst_core` dans le `.venv` **pour toutes les sessions qui le
partagent**. Le 27 août, une session mesurait le comportement de production
pendant qu'une autre reconstruisait la wheel :

    fold('°')  ->  ' deg'   à 13h30
    fold('°')  ->  '°'      à 13h56

sans qu'une ligne bouge dans le dépôt de la première. Elle a failli rapporter
le comportement d'une branche comme celui de la production.

Aucune des deux ne pouvait le voir depuis son propre travail. C'est la
différence qui compte : les trois premiers défauts sont visibles en relisant
l'instrument, le quatrième ne l'est pas — il faut savoir qu'une autre session
existe.

Trois conséquences, écrites dans `requirements-dev.txt` à côté de la
déclaration de `maturin` :

- **le `.venv` partagé n'est une source fiable sur aucun comportement du cœur
  natif** ;
- une mesure qui doit valoir pour la production se prend **contre l'API de
  production**, ou après avoir vérifié le commit du cœur natif installé
  (`git -C ../heurix-engine-fst log --oneline -1`) ;
- **si vous reconstruisez pendant que d'autres sessions travaillent dans cet
  arbre, dites-le-leur.** Aucun outil ne le fera.

### Une clef absente ne lève pas : elle rend vide, et le vide ressemble à un « non »

Deux occurrences le 28 août 2026, à quelques heures d'écart, et une forme
qu'aucune des divergences précédentes n'avait.

| | interrogé | clef réelle | ce que l'instrument a répondu |
|---|---|---|---|
| 1 | `d["pages"]` | `entrees` | « 0 page sport dans l'index » |
| 2 | `x.get("url","")` | `p` | « about.html absente de l'index, sur les 11 commits » |

**Les deux réponses étaient fausses, et les deux avaient la forme d'un
résultat.** `about.html` et `blog.html` sont dans l'index depuis sa création,
avec 415 et 431 termes indexés ; la page du fondateur se trouve, et je l'avais
vue à l'écran le soir même en vérifiant la modale, sans faire le rapprochement.

**CECI EST PIRE QU'UN INSTRUMENT QUI ÉCHOUE.** Un instrument qui plante se
signale ; on va voir. Celui-ci **répond**. `dict.get(clef, "")` sur une clef
absente rend la chaîne vide, `"about" in ""` est faux, et le programme continue
en affichant `non`. Rien ne distingue ce `non` d'un vrai. Pire encore : il est
*stable*. Répété sur onze commits, il a rendu onze fois `non`, et cette
constance s'est lue comme une confirmation alors qu'elle était la signature
même du défaut — un test qui ne peut rendre qu'une seule réponse la rend
partout.

C'est la famille de « la mesure qui ne teste que son hypothèse », déplacée d'un
cran : là on ne lançait que la forme qui confirmait ; ici on lance la bonne
forme sur un champ qui n'existe pas, et c'est le langage qui fabrique la
confirmation.

**LE GESTE, ET IL TIENT EN UNE LIGNE.** Avant d'interroger une clef, imprimer
les clefs réelles :

```python
print(sorted(entrees[0].keys()))     # ['e', 'k', 'p', 's', 't'] -- pas 'url'
```

Il ne coûte rien, il se fait une fois par structure, et il rend le défaut
impossible : on ne peut pas écrire `x["url"]` après avoir lu qu'il n'y a pas
d'`url`. Le faire systématiquement au premier accès d'une structure qu'on
n'a pas écrite soi-même.

Le corollaire vaut pour toute lecture indexée dont l'absence est silencieuse :
`.get()`, `getattr(o, n, None)`, `os.environ.get()`, un `?.` en JavaScript, un
`grep` sur un champ mal nommé. Chacun transforme « ce champ n'existe pas » en
« ce champ est vide », et les deux ne veulent pas dire la même chose — c'est
la distinction entre *écart* et *incapacité*, à l'échelle d'une expression.

#### Et la consigne qui l'a lancée était pressante, ce qui est la vraie limite

Ce défaut n'est pas né de ma mesure. Il est né d'une mesure reçue, transmise
dans une consigne urgente — « deux pages manquent à l'index, personne ne trouve
la page du fondateur, mesurez depuis quand » — et j'ai couru la vérifier au lieu
de commencer par vérifier qu'elle était vraie.

**C'est la limite de tout ce qui est écrit dans ce fichier.** Les gardes, les
périmètres dérivés, les listes d'exceptions qui se policent : tous supposent
qu'on prenne le temps de mesurer avant d'agir. Une consigne pressante demande
exactement l'inverse, et elle l'obtient — non pas en désactivant les gardes,
mais en déplaçant la question. On vérifie *ce qu'on nous a demandé de vérifier*,
avec application, sans jamais vérifier *la prémisse de la demande*.

Le remède n'est pas de se méfier des consignes. C'est que **l'urgence porte sur
l'action, jamais sur la première mesure** : la question « cette page est-elle
vraiment absente ? » coûtait dix secondes et venait avant « depuis quand ».
Reprendre la mesure d'un autre, c'est d'abord la refaire — et c'est exactement
ce que dit déjà la section sur le périmètre qui ne voyage pas avec le chiffre,
appliqué au cas où le chiffre vient de la personne qui presse.

Corollaire, valable dans les deux sens : **une demande urgente mérite qu'on
en établisse la prémisse à voix haute avant d'agir**, ne serait-ce qu'en une
phrase. Ici, « je confirme d'abord que les deux pages manquent » aurait clos
l'affaire en une commande, avant l'enquête sur le générateur, avant la lecture
du sitemap, et avant qu'un rapport faux ne remonte.

### Un chiffre porte son périmètre, et le périmètre ne voyage pas avec lui

Cinquième divergence de la semaine, et la seule où **rien n'a été mal
mesuré**. Les quatre autres sont un instrument qui se trompe de cible ou qui
change celle des autres. Celle-ci n'a pas d'instrument fautif du tout.

Le 27 août, une session voisine mesure `public-demo` et rapporte :

    ° 133   ¼ 8   ⌀ 3   ½ 2

J'en conclus, et je l'écris dans une note : « aucune ligature de juillet
n'apparaît — pas un `œ`, pas un `æ`, pas un `ß` sur 1 321 fiches réelles »,
donc la dette de juillet est nulle, donc le correctif n'est pas prioritaire.

**Ce relevé n'avait jamais cherché `œ`.** Il balayait le bloc
`U+FB00–FB06`, les ligatures typographiques. `œ` est `U+0153`, une lettre
française, qui vit dans une autre table. Vérifié après coup, caractère par
caractère : aucun des quatre du relevé n'est dans le bloc, et `œ` non plus.

Le chiffre était juste. Ma phrase était fausse. La reprise exhaustive — les
52 caractères non-ASCII de `public-demo`, passés un par un dans le `fold` de
production — a donné **70 fiches réelles sur 1 321, soit 5,3 %**, et un
défaut visible à l'écran sur la démo publique.

**Ce qui rend ce cas difficile, c'est qu'aucune vigilance ordinaire ne
l'attrape.** Relire mon code n'aurait rien montré : je n'avais pas de code.
Refaire ma mesure non plus : je n'avais pas mesuré. J'ai hérité d'un nombre
exact et je l'ai lu comme couvrant plus que ce qu'il couvrait.

La règle n'est donc pas « vérifie tes mesures ».

> **Quand vous reprenez la mesure d'un autre, demandez ce qu'elle a exclu.**

Un relevé arrive avec son résultat, jamais avec sa définition de périmètre.
« Zéro » ne veut pas dire « absent » : il veut dire « absent de ce qui a été
cherché ». Les deux se confondent d'autant plus facilement que le chiffre
est juste — c'est sa justesse même qui décourage la question.

Trois formes concrètes de la question, dans l'ordre où elles servent :

- **quel jeu de caractères / de fichiers / de pages a été balayé ?** pas
  « combien en a-t-on trouvé » ;
- **la chose que je veux conclure était-elle dans ce jeu ?** ici : `œ`
  était-il dans la liste balayée ? non ;
- **le zéro est-il une absence ou un non-examen ?** un non-examen se
  reconnaît à ceci qu'il ne pouvait pas rendre autre chose.

Corollaire pour qui *produit* la mesure : **nommez le périmètre avec le
résultat, pas seulement le résultat.** « Zéro ligature du bloc U+FB00–FB06 »
n'aurait pas pu être lu comme « zéro `œ` ». C'est trois mots de plus, et ils
sont la moitié de l'information.

#### L'occurrence inverse : le périmètre absent fait chercher un défaut qui n'existe pas

Le cas ci-dessus fait **manquer** un défaut : « zéro ligature » lu comme
« zéro `œ` ». Le 28 août 2026, le même geste a produit l'inverse.

Après avoir resserré les tirages d'attribut de deux référentiels, `--verifier`
annonçait **4,3 annotations par produit**. Le message de commit de la veille
disait **5,8**. J'ai conclu à une régression de 26 %, ouvert une enquête, et
comparé les comptes règle par règle avant et après.

Le total était stable — 13 505 contre 13 517. **Il n'y avait rien à chercher.**

Le 5,8 datait d'avant le correctif de `GENRE_MALE`, qui avait retiré 565
annotations parasites de « mm » lu comme « mâle ». Les deux chiffres étaient
justes, sur deux référentiels différents, à un correctif d'intervalle. Mesurés
sur les deux états du jour : **4,3 avant, 4,3 après.**

**Les deux erreurs viennent du même geste** — reprendre un chiffre d'un message
de commit sans vérifier ce qu'il couvrait. Un message de commit est
précisément l'endroit où un chiffre perd son périmètre : il est écrit pour
décrire un état, il est lu plus tard comme une valeur de référence, et rien
dans sa forme ne dit lequel des deux.

| sens | ce que le chiffre fait croire | coût |
|---|---|---|
| celui du 27 août | « zéro » lu comme « absent » | un défaut **manqué**, resté un mois |
| celui du 28 août | « 5,8 » lu comme « l'état d'avant » | une enquête sur un défaut **inexistant** |

Le second se referme tout seul — la mesure finit par le démentir. Le premier
non, parce qu'un « zéro » ne se démentit pas : rien ne le contredit tant qu'on
ne cherche pas ailleurs.

Corollaire pratique, et il ne coûte rien : **quand un chiffre du passé
contredit une mesure du présent, remesurer les DEUX états avant de conclure.**
Ici la même commande, lancée sur `git stash` puis sur l'arbre, a réglé la
question en deux minutes et remplacé une hypothèse par un fait.

#### Dire ce qu'on n'a pas touché ne suffit pas s'il reste des arguments muets

Cinquième défaut de `bust-cache.sh` en une semaine, et **le premier qui mente
par omission plutôt que par portée.**

Les quatre autres — le motif à un seul niveau de remontée, `git ls-files`,
l'exclusion périmée de `downloads/`, les six assets énumérés de la CI —
disaient tous trop peu sur un périmètre trop étroit. Mais ils *parlaient* de
ce qu'ils avaient touché. Celui-ci se tait sur un argument qu'on lui a
explicitement donné :

```
$ scripts/bust-cache.sh styles.css search.js search-en.js
✓ styles.css   -> ?v=1787842214 propagé dans 122 fichier(s)
✓ search.js    -> ?v=1787842214 propagé dans 60 fichier(s)
  ⚠ 8 référence(s) à "search.js" NON touchée(s) -- autre chemin :
$                                    <- fin. Pas une ligne sur search-en.js.
```

`search-en.js` est resté à son ancienne clef. **Ni « ✓ », ni « ⚠ », ni un
code de sortie remarquable. Rien.** Le compte rendu a l'air complet : deux
succès et un avertissement, ce qui ressemble à une exécution normale. Seul un
contrôle de cohérence externe l'a montré, après coup.

La cause tient en une ligne. `set -euo pipefail` plus un bloc d'avertissement
qui se termine par `grep -vE` : quand celui-ci filtre tout, il sort en 1,
`pipefail` propage, `set -e` tue la boucle. Mesuré, le pipeline rend bien 1.

**Mais le correctif d'une ligne ne ferme que ce cas-ci.** La règle plus haut
— « un script de portée doit dire ce qu'il n'a pas touché » — est respectée
par ce script : la ligne « ⚠ 8 références non touchées » est exactement ça.
Elle ne couvre pas le cas où le script ne dit **rien du tout** d'un argument.

> **Un script qui reçoit une liste d'arguments rend compte de CHACUN,
> y compris pour dire qu'il l'a abandonné.**

C'est une exigence distincte de la précédente, et elle ferme la famille au
lieu du cas : toute sortie anticipée future se voit, quelle qu'en soit la
cause. `bust-cache.sh` porte désormais un piège `EXIT` qui nomme les
arguments jamais atteints, et une ligne finale « N reçu(s), N avec un compte
rendu ».

Le contrôle externe qui l'attrape en attendant, et qui ne coûte rien —
périmètre dérivé, aucune liste d'assets :

```bash
python3 - <<'EOF'
import glob, io, re, collections
c = collections.defaultdict(set)
for p in glob.glob("**/*.html", recursive=True):
    if "node_modules" in p: continue
    for m in re.finditer(r'(?:src|href)="([^"?]+)\?v=(\d+)"', io.open(p, encoding="utf-8").read()):
        c[m.group(1).split("/")[-1]].add(m.group(2))
print({k: sorted(v) for k, v in c.items() if len(v) > 1} or "aucun asset à clefs multiples")
EOF
```

#### Sixième défaut : il entretient une clef, il n'en crée pas

Les cinq précédents disaient trop peu sur un périmètre trop étroit, ou se
taisaient sur un argument. Celui-ci répond exactement, et sa réponse est
inexploitable.

Le motif de substitution est `"((\.\./)*)<fichier>\?v=[0-9]+` : il exige un
`?v=` **déjà présent**. Lancé sur une référence qui n'en a pas, le script
répondait :

```
⚠ img/photo-alexis.jpg : aucune référence "img/photo-alexis.jpg?v=..." trouvée
  -- nom correct ? rien à faire.
```

Chaque mot est vrai. « Nom correct ? » oriente pourtant vers une faute de
frappe, alors que la cause ordinaire est autre : **l'actif est bien référencé,
mais sans clef, et ce script n'en pose pas.** Le lecteur vérifie son
orthographe, la trouve juste, et conclut que l'actif est à jour.

C'est la distinction *écart* / *incapacité*, une troisième fois : « je n'ai
rien trouvé à changer » et « il n'y a rien à changer » sont deux réponses
différentes, et une seule autorise à passer au suivant. Le script les sépare
désormais, et la première nomme les pages fautives.

**LE CONSTAT QUI DÉPASSE L'OUTIL — un actif sans `?v=` est hors de portée de
TOUS les gardes.** Le contrôle de cohérence de la CI dérive son périmètre des
références **versionnées** :

```
git grep -hoE "\"(\.\./)*[A-Za-z0-9_/-]+\.[a-z0-9]{2,4}\?v=[0-9]+"
```

Un actif qui n'en porte pas n'y figure pas — non parce qu'on l'a exclu, mais
parce qu'il n'a jamais été vu. **Le périmètre dérivé ne protège que ce qui a
déjà franchi son seuil d'entrée.**

Mesuré le 28 août 2026 : **11 actifs référencés sans clef**, dont
`nav-dropdown.js` sur 128 pages et `pricing-nudge.js` sur 116.

Et un cas mixte, qui est le défaut vivant : `docs-copy.js` était référencé sur
**quatre** pages, **une seule** avec clef. Un bump atteignait `docs.html` et
laissait `en/docs.html` et les deux guides servir leur version en cache
pendant les 600 s de fraîcheur restantes, sans une requête — pendant que le
contrôle de cohérence voyait une clef unique et concluait « cohérent ». C'est
la forme exacte du défaut des 38 pages, un cran
plus haut : là le motif ne voyait pas certaines références ; ici il ne voit pas
qu'il en manque.

`tests/actifs-versionnes.test.js` ferme la famille : il refuse tout actif
référencé **à la fois** avec et sans clef, et exige que les non versionnés
soient nommés avec leur raison. Deux assertions policent cette liste — aucune
raison périmée, aucun renvoi en guise de raison. La seconde a mordu sur son
auteur le jour même : ma justification d'`apple-touch-icon.png` commençait par
« Même cas que… ».


#### Le septième défaut n'existait pas, et c'est la note d'usage qui mentait

*Écrit le 28 août 2026, puis corrigé le même jour. La version précédente de
cette section affirmait un septième défaut de `bust-cache.sh` : « le motif
ancre sur le nom, jamais sur le chemin ». **C'était faux.***

`scripts/bust-cache.sh img/familles-moteurs.svg` fonctionne, et rend
`✓ propagé dans 1 fichier(s) (1 référence(s))`. Le chemin se passe en argument
depuis le correctif du 27 août, documenté dans le script sous
« LE SOUS-DOSSIER EST DANS L'ARGUMENT ».

**Ce qui m'a trompé est dans le même fichier, soixante lignes plus haut :** le
bloc USAGE portait encore, daté du 26 août, « NE MARCHE PAS SUR `downloads/` »
— vrai ce jour-là, rendu faux le lendemain par un correctif qui n'a pas mis à
jour la note qui le contredisait. **Une instruction d'usage qui survit à son
propre correctif**, dans le fichier qu'elle décrit. C'est la famille du
« 850 € HT/jour » et de la ligne « Conseil en moteurs de recherche » de
l'image générique : une valeur qui survit à un changement en devenant fausse.
Le bloc est corrigé.

#### Et la mesure ne m'a pas protégé, parce qu'elle ne testait que mon hypothèse

C'est le point qui vaut d'être gardé. J'ai mesuré avant d'écrire, comme la
règle l'exige. J'ai lancé :

```
$ scripts/bust-cache.sh familles-moteurs.svg
⚠ familles-moteurs.svg : aucune référence, versionnée ou non -- nom correct ? rien à faire.
```

et j'y ai lu la confirmation. Mais **je n'ai lancé que la forme que mon
hypothèse prévoyait.** Je croyais le chemin non supporté, donc je n'ai pas
essayé le chemin. La sortie était exacte — sans le chemin, il n'y a
effectivement aucune référence — et elle confirmait une conclusion fausse.

> **Une mesure qui ne teste que l'hypothèse qu'on a déjà ne peut que la
> confirmer. Ce n'est pas une mesure, c'est une illustration.**

Le remède est le même que celui de la contradiction comme signal, pris par
l'autre bout : au lieu d'attendre que deux sorties se contredisent, **produire
soi-même la sortie qui pourrait contredire**. Ici : lancer les DEUX formes,
avec et sans chemin. Trente secondes, et cinquante-huit lignes de documentation
fausse en moins.

Le coût réel : ces lignes ont été écrites, commitées, poussées, et lues comme
un fait — au point qu'on m'a demandé de traiter ce défaut en priorité, avant
les schémas. Un rapport faux mobilise le temps de quelqu'un d'autre.

#### Le degré au-dessus : la mesure ne teste pas l'hypothèse, elle la met en scène

La section ci-dessus décrit une mesure trop étroite — juste, mais qui ne
pouvait rencontrer que la réponse attendue. Le 29 et le 30 août 2026, la même
famille est apparue **trois fois**, d'un cran plus haut : ce n'était plus le
périmètre qui était étroit, c'était le **montage qui produisait lui-même l'état
observé**. L'assertion n'avait aucun chemin vers le rouge.

| | ce que le montage installait | ce que la mesure prétendait établir |
|---|---|---|
| test clavier n°1 | le focus **sur le bouton**, puis Échap | qu'Échap **rend** le focus au bouton |
| test clavier n°2 | le focus **hors** du panneau | que `focusout` ferme le panneau |
| **la capture d'écran** | **un clic qui OUVRE le menu** | **que le menu s'affiche correctement** |

Les trois étaient verts. Les trois le seraient restés sur du code retiré.

**LA TROISIÈME EST LA PLUS COÛTEUSE, ET ELLE A ÉTÉ SERVIE.** J'ai montré une
capture de Solutions ouvert comme preuve que le menu marchait. Elle le montrait
bien — mais je venais de cliquer dessus. Or le défaut réel était que
`.nav-panel-secteurs{ display:grid }`, posé sans condition, écrasait
`.nav-drop-panel{ display:none }` : **les trois panneaux étaient ouverts en
permanence sur les 128 pages qui portent le menu** (mesuré le 30 août 2026),
`aria-expanded="false"` et tout. Le DOM disait fermé, le compositeur peignait
ouvert.

Aucune photographie de l'état ouvert ne pouvait le montrer, parce que l'état
ouvert était exactement ce qui allait bien.

**ET LA RÈGLE DU SITE A ÉTÉ SUIVIE.** « Toute modification visuelle se vérifie
à l'écran » est respectée à la lettre : la page a été ouverte, regardée,
capturée. Le défaut est passé quand même. C'est ce qui distingue cette famille
de toutes celles écrites plus haut — là un garde manquait, ou mentait, ou
n'était pas lu ; ici le garde est la règle de ce fichier, elle a été appliquée,
et elle ne pouvait pas voir.

> **Une mesure d'état ne vaut que si le montage peut produire l'autre état.**
> Si l'on ne sait pas décrire l'entrée qui la ferait échouer, elle est verte
> par construction, pas par constat.

Le geste, et il coûte dix secondes : **regarder aussi l'état qu'on n'a pas
provoqué.** Le panneau fermé, le formulaire vide, la liste sans résultat. Ici,
une capture avant le clic aurait montré les trois panneaux ouverts en même
temps — ce qui est exactement ce qu'a montré la première capture prise sans
avoir cliqué, et ce qui a ouvert l'enquête.

Pour un test, la question équivalente se pose avant de l'écrire : **quelle
ligne dois-je supprimer du code pour le rendre rouge ?** Si la réponse est
« aucune », le test met en scène sa réponse. C'est la règle déjà écrite plus
haut — « il se vérifie en le faisant échouer, pas en le voyant passer » — et
les deux tests clavier montrent qu'on peut l'énoncer, la relire, et l'oublier
au moment d'écrire un test qui *vise juste*. Ce n'est pas un instrument qui
rate sa cible : il vise exactement le bon défaut, et il l'observe dans un décor
où ce défaut ne peut pas se produire.

**Ce qui a fermé la famille ici**, plutôt que cette note :
`tests/panneaux-fermes.test.js` refuse tout sélecteur `.nav-panel-*` qui pose
`display` hors de `.open`. Périmètre dérivé — les variantes sont extraites du
fichier, pas énumérées — donc un quatrième menu serait couvert sans qu'on y
pense. Vérifié dans les deux sens le jour même : le défaut réinjecté le fait
échouer en nommant `nav-panel-groupes`, et la restauration se fait par
l'opération inverse, pas par un instantané.

#### Un cas suffit à montrer qu'une chose échoue, jamais à dire pourquoi

Le 29 août 2026, un audit externe rapporte : « le prix en langage naturel ne
fonctionne qu'en français ». Le constat était juste, la preuve était réelle, et
le diagnostic était faux.

La preuve tenait à **un seul essai** — l'exemple de la page anglaise,
`stainless screws under $2`, qui rendait 958 résultats sans filtre pendant que
`vis inox moins de 2 euros` en rendait 688 correctement filtrés. Deux requêtes,
deux résultats opposés, une conclusion qui se présente toute seule : c'est la
langue.

**Deux paramètres changeaient en même temps** — la langue *et* la notation du
montant. Le second essai, celui qui varie un seul paramètre, tranche :

```
stainless screws under 2 euros   ->  max=2.0     comparateur anglais, notation française
stainless screws under $2        ->  AUCUN       comparateur anglais, notation anglaise
vis inox moins de 2 €            ->  max=2.0     comparateur français, notation française
vis inox moins de €2             ->  AUCUN       comparateur français, notation anglaise
```

L'anglais marchait depuis cinq semaines. Ce qui échouait était le **symbole
placé devant le nombre**, et il échouait dans les six langues du parseur. La
version française avait exactement le même trou ; personne ne l'avait vu parce
que personne n'écrit « moins de €2 » en français.

**LE DIAGNOSTIC FAUX COÛTAIT PLUS CHER QUE LE DÉFAUT.** « Ajouter les
formulations anglaises » aurait fait écrire une dizaine de motifs qui
existaient déjà, sans corriger le seul qui manquait — et le résultat aurait été
testé sur `under 2 euros`, qui passait avant comme après. Le lot serait parti
vert en laissant l'exemple de la page toujours cassé.

> **Un cas suffit à établir qu'une chose échoue. Il n'établit jamais
> pourquoi — pour ça, il faut faire varier un paramètre à la fois.**

C'est la famille des instruments qui ratent leur cible, déplacée d'un cran :
là, l'outil mesurait autre chose que ce qu'on croyait ; ici, la mesure est
juste et c'est l'**explication** qu'on y accroche qui l'est trop. Une
observation vraie ne porte pas sa cause avec elle.

Le geste, et il coûte trois requêtes : **avant d'expliquer un écart, produire
la variante qui isole chaque paramètre.** Ici, garder le comparateur anglais et
changer la notation ; puis garder la notation et changer le comparateur. La
seconde ligne du tableau ci-dessus a répondu en dix secondes.

Corollaire pour qui *reçoit* le diagnostic : c'est le pendant exact de « quand
vous reprenez la mesure d'un autre, demandez ce qu'elle a exclu ». Un rapport
arrive avec sa cause, jamais avec le nombre d'essais qui l'ont établie. Ici il
y en avait un, et la conclusion en demandait quatre.

### Un garde chiffré puis refusé : le nombre de secteurs

Le 30 août 2026, troisième page en une semaine à annoncer un nombre de
secteurs faux — après `index.html` (« les huit secteurs couverts ») et
`secteurs.html` (« sept de ces secteurs »), toutes deux corrigées le 29.
Deux fois c'est un lot, trois fois ça vaut d'examiner la source.

Le balayage complet en a trouvé **dix, sur six pages**, dont trois déjà
publiques :

| page | ce qui était écrit | réel |
|---|---|---|
| `solutions/index.html` | « Sept secteurs » ×4 (h1 + 3 meta) | onze |
| `en/solutions/index.html` | « Seven industries » ×3 | eleven |
| `index.html`, `produit.html`, `en/produit.html` | « **Sept de ces** secteurs ont déjà un pack » | onze |
| `blog/tutoriel-…-5-minutes` (2 langues) | « ou `mode`, `industrie` pour les **deux autres** packs fournis » | dix autres |

**Le démonstratif est ce qui a fait pourrir la phrase différemment sur chaque
page.** « Sept de **ces** secteurs » introduit une grille de cartes — et cette
grille fait **3 cartes sur `index.html`, 9 sur `produit.html`, 13 sur
`secteurs.html`**. La phrase a été recopiée d'une page à l'autre en gardant son
nombre et en changeant de référent. Corrigée en « Onze secteurs ont déjà un
pack », sans démonstratif : l'énoncé devient global, donc vrai quelle que soit
la grille sous laquelle il atterrit.

Et celle du tutoriel n'était pas un compte à corriger : **une énumération
exhaustive, juste quand il y avait trois packs.** Elle a été remplacée par un
renvoi vers `secteurs.html`, qui ne se périmera pas au douzième pack.

#### La cinquième forme : un chiffre vrai, documenté comme artefact, et repris sans sa borne

Les quatre motifs de la semaine sont des **affirmations devenues fausses** —
une valeur juste le jour où on l'écrit, périmée ensuite. Le 30 août 2026, une
cinquième s'est présentée, et elle n'a jamais été fausse à sa source.

`rapport-menu-navigation.md`, en décrivant une capture du menu Solutions
empilé en mobile, écrit :

> « Le cadre d'aperçu de la maquette coupe la liste à « Librairie & édition » :
> **huit visibles sur onze**. La coupe vient du cadre, pas du panneau — mais la
> capture ne permet pas de le distinguer, donc elle ne prouve rien sur ce
> point. »

Trois précautions dans une phrase : le nombre, son total, et l'avertissement
explicite que le huit est un artefact de cadrage.

Un rapport écrit deux heures plus tard reprend : « une grille à deux colonnes
de **huit secteurs** ». Le total a disparu, l'avertissement aussi, et le
chiffre a changé de population — d'une **pile mobile recadrée** vers la
**grille desktop**, qui n'a jamais montré autre chose que onze.

**LA SOURCE DISAIT ELLE-MÊME DE NE PAS LA LIRE AINSI.** C'est ce qui distingue
cette forme des quatre autres :

| | ce qui rend le chiffre faux |
|---|---|
| les quatre motifs de la semaine | le monde a changé après l'écriture |
| **celui-ci** | **le chiffre a changé de document, et perdu ce qui le bornait** |

Aucune relecture de la source ne l'attrape : la source est juste, complète, et
prudente. Aucune mesure ne le dément non plus, puisque « huit » est vrai de la
capture. Il n'est faux que de la population à laquelle on l'applique.

> **Quand on reprend un chiffre d'un autre document, on reprend aussi ce qui
> le borne.** Un nombre sans son périmètre est un nombre sur une autre
> population.

C'est la règle déjà écrite plus haut — « quand vous reprenez la mesure d'un
autre, demandez ce qu'elle a exclu » — d'un cran plus loin : là il fallait
*demander* le périmètre, ici il était **écrit dans la phrase d'à côté**, et
c'est la recopie qui l'a laissé derrière. Le geste n'est donc pas de
questionner la source mais de **transporter la phrase entière**, avertissement
compris, ou de ne pas transporter le nombre.

Vérifié après coup, et c'est ce qui a tranché : le menu porte onze liens dans
**tous** les commits depuis au moins le 29 août 13:02. Il n'existe aucun état
du site où il en aurait eu huit — donc pas « un rapport qui a regardé un état
antérieur », mais un chiffre sur une autre population.

#### Deuxième occurrence de la cinquième forme : « 126 pages », sept fois

Le 30 août 2026, sept commentaires du dépôt annonçaient « 126 pages » là où le
dépôt en compte 128. Le diagnostic porté avec la demande était : *un chiffre
qui a vieilli sur place — juste quand il a été écrit, des pages sont apparues
depuis, et rien ne relit un commentaire.*

**L'archéologie dit l'inverse, et c'est elle qui décide du remède.** Le nombre
d'en-têtes, commit par commit :

```
122   jusqu'au 27 août (a016429d)
124   50433947  27 août
128   4c32bd84  27 août  « Les onze packs ont tous leur page… »
```

Il saute 124 → 128 sans passer par 126. **Il n'a jamais valu 126.** En
revanche, le *total de pages du dépôt* valait exactement 126 le 27 août. D'où
la partition des sept :

| écrit le | où | ce qu'il compte | à l'écriture |
|---|---|---|---|
| 27 août | `canonical.test.js:19`, `CLAUDE.md` (contrôle dérivé) | **toutes** les pages | **exact** |
| 30 août | `styles.css` ×3, `panneaux-fermes.test.js`, `CLAUDE.md` (panneaux) | des **en-têtes** | **faux le jour même** |

Ce n'est donc pas un chiffre qui vieillit. **C'est la cinquième forme, pas une
sixième** : le 126 du 27 août portait sur « toutes les pages » ; recopié trois
jours plus tard dans des phrases sur « les en-têtes », il s'est mis à décrire
une autre population, où la réponse était 128 et l'était depuis trois jours.
La phrase d'à côté portait sa borne, la recopie l'a laissée derrière.

##### Et le chiffre qui corrige les sept a besoin de sa commande

**Le défaut, appliqué à sa propre correction.** « 128 en-têtes » ne se
reproduit pas tel quel : la commande qui l'établit doit exclure les
répertoires en point, et l'écart n'est pas cosmétique. Mesuré le 30 août 2026,
même dépôt, deux emplacements :

```
find . -name '*.html' -not -path './node_modules/*' -not -path './docs/maquettes/*'
    depuis un worktree de ~/wt/      134
    depuis l'arbre partagé           554     <- trois worktrees sous .claude/,
                                                une copie complète du site chacun
git ls-files '*.html' | grep -v '^docs/maquettes/'
    depuis les deux                  134
```

`find` répond sur le disque, et le disque contient les copies de travail des
autres sessions. **`git ls-files` répond sur l'index**, donc sur le dépôt, et
rend le même nombre où qu'on se tienne. C'est la même leçon que le périmètre
dérivé, d'un cran plus bas : le périmètre d'un `find` est l'endroit d'où on le
lance, et rien dans sa sortie ne le dit.

`canonical.test.js` et `entete-structure.test.js` sont immunisés par
construction — leur marche d'arbre saute `e.name.startsWith(".")`. Un balayage
écrit à la main dans un shell ne l'est pas.

**Et ce n'est pas l'accident d'un outil : le même jour, `vitest`.** Son
exclusion par défaut ne contient pas `.claude` non plus, et un seul worktree
vivant dessous doublait la suite entière pour toutes les sessions — 91
fichiers collectés au lieu de 46, 1 137 tests au lieu de 570. Le commit
`0e403875` porte la mesure complète en tête de `vitest.config.js`. Deux outils
sans rapport, la même cause : **un dénombrement qui répond sur le disque
alors que la question porte sur le dépôt.** La CI n'en voyait rien, partant
d'un checkout neuf — donc, comme toujours ici, le défaut ne se voyait que
depuis la machine où il coûtait.

**Ce qui l'a révélé reste vrai, et c'est le seul signal qui existait :**
`scripts/bust-cache.sh styles.css` affiche « propagé dans 128 fichier(s) »
juste à côté de commentaires qui disent 126. Un outil qui produit le même
nombre à côté du nombre écrit. Sans lui, rien — un commentaire ne s'exécute
pas, et deux commentaires ne se confrontent jamais.

##### Un balayage qui répond à côté, avec un compte crédible

Le 31 août 2026, en balayant le dépôt pour une phrase fausse, `git grep -i -E
"ind[ée]finiment"` a rendu **cinq lignes, et aucune accentuée** — dont zéro
dans `CLAUDE.md`, où le même balayage corrigé en trouve **cinq à lui seul**,
écrites une heure plus tôt par moi.

**C'est une forme neuve, et c'est la pire des trois.** Les deux balayages
ratés ci-dessus se trahissaient par leur sortie : `find` à 554 et `vitest` à
1 137 débordaient, et un compte qui déborde se remarque. Celui-ci répond **à
côté** — cinq lignes, dans le bon ordre de grandeur, réparties dans des
fichiers plausibles. Rien dans sa sortie ne le distingue d'un balayage
complet.

**Ce qui l'a révélé, et c'est le seul geste qui pouvait le faire :** demander
à l'instrument de retrouver une occurrence dont je savais déjà qu'elle
existait — `CLAUDE.md:440`, que j'avais écrite une heure plus tôt. Zéro ligne.

> **Un balayage porte un positif connu qu'il doit retrouver.** Sans lui,
> « rien trouvé » et « rien vu » ont exactement la même forme, et c'est la
> forme rassurante qui s'impose.

La cause, isolée le 31 août 2026. Le motif est figé sur un commit pour que le
compte reste reproductible — `CLAUDE.md` à `2edce005` porte trois occurrences
accentuées en minuscules (cinq avec `-i`), et aucune non accentuée :

```
LC_ALL=C            git grep -cE "ind[ée]finiment"  2edce005 -- CLAUDE.md  ->  0
LC_ALL=C            git grep -cE "ind(é|e)finiment" 2edce005 -- CLAUDE.md  ->  3
LC_ALL=C            git grep -c  "indéfiniment"     2edce005 -- CLAUDE.md  ->  3
LC_ALL=en_US.UTF-8  git grep -cE "ind[ée]finiment"  2edce005 -- CLAUDE.md  ->  3
```

**C'est la classe de caractères qui décroche, et elle seule.** L'alternance
`(é|e)` et la recherche littérale passent sous la même locale. Et le défaut
est propre à `git grep` (2.50.1), qui porte son propre moteur : le `grep` de
macOS rend le même compte dans les deux locales, sur le même motif.

**La locale est une propriété de la machine, pas du dépôt.** Ici `LANG` et
`LC_ALL` sont vides, donc `LC_CTYPE="C"`. Rien dans le dépôt ne le corrige,
rien ne le signale, et aucun test ne peut l'attraper puisque la CI part d'un
environnement différent — encore une fois, le défaut ne se voit que depuis la
machine où il coûte. **Un dépôt en français est le pire endroit où le
porter** : `périmé`, `clef`, `déployé`, `référence`, `en-tête`. Tout motif
écrit avec une classe *pour tolérer* un accent ne voit que la moitié ASCII de
sa propre classe — c'est-à-dire exactement le contraire de son intention.

Deux gestes, dans cet ordre :

- **Le positif connu d'abord**, avant de lire le moindre résultat. Il ne coûte
  qu'une ligne et il est le seul témoin possible.
- **Puis `LC_ALL=en_US.UTF-8` en tête du balayage**, ou une alternance à la
  place de la classe. Le correctif seul ne suffit pas : sans le témoin, rien
  ne dit qu'on a appliqué le bon.

**Ce que ça a coûté sur ce lot :** le compte vrai était de **trois occurrences
en deux fichiers**, pas d'une. `scripts/bust-cache.sh` portait la phrase deux
fois, lignes 9 et 138, toutes deux accentuées. Le balayage naïf les a laissées
dehors, et son compte n'avait pas l'air faux.

###### Récidive le lendemain, puis une troisième dans l'heure

**La règle ci-dessus était écrite, et elle n'a rien empêché.** Le 1er
septembre 2026, deux fois de plus, le même défaut :

| | l'instrument | ce qu'il a rendu | le vrai |
|---|---|---|---|
| 31 août | `git grep -iE "ind[ée]finiment"` | 5 lignes, aucune accentuée | 3 occurrences en 2 fichiers de plus |
| 1er sept. | filtre `p.startswith('solutions/')` sur les deux index | **0** entrée anglaise | 23 côté FR, **23 côté EN**, préfixées `en/solutions/` |
| 1er sept. | ma lecture de `href="../blog/guide-mise-en-route.html"` depuis `en/solutions/` | « pointe vers le guide français » | résout en `en/blog/…`, **anglais, 12 pages sur 12** |

Les trois ont rendu un résultat plausible. Les trois ressemblaient à un défaut
du **site**, jamais à un défaut de l'instrument. Et les trois auraient été
fermés par le geste déjà écrit ici — demander un positif connu.

**CE QUI MANQUE N'EST PAS LA RÈGLE, C'EST SON DÉCLENCHEUR.** Écrire la règle
n'a pas suffi, et il faut dire pourquoi plutôt que la réécrire plus fort :

> **Un instrument qui vous donne tort déclenche la vérification. Un
> instrument qui vous donne raison ne la déclenche pas.**

Les deux cas du 1er septembre confirmaient tous les deux un soupçon déjà
formé — que les pages anglaises sont traitées en seconde classe. Un zéro qui
confirme ce qu'on pensait ne se lit pas comme un zéro suspect : il se lit
comme une confirmation. Le doute, lui, n'arrive que quand le chiffre dérange.

D'où la forme opérationnelle, qui ne demande pas de vigilance mais un ordre :

- **Le positif connu se pose AVANT de lire le résultat**, pas après l'avoir
  trouvé surprenant. Après, il est trop tard : on ne le pose plus.
- **Un résultat qui confirme un soupçon est le cas où il faut le poser**, pas
  celui où l'on peut s'en passer. C'est l'inverse de l'intuition, et c'est
  précisément pour ça qu'il faut l'écrire.
- **Deux populations comparées veulent deux positifs connus**, un par
  population. Le filtre du 1er septembre était juste sur `solutions/` et faux
  sur `en/solutions/` : un seul témoin, posé côté FR, l'aurait laissé passer.

Le troisième cas n'a été trouvé que parce qu'on m'a demandé d'en **mesurer le
périmètre** avant de l'appeler un lot — « si c'est une page, c'est une ligne ;
si c'est onze, c'est un lot ». Compter a résolu les chemins, et résoudre les
chemins a détruit le défaut. **Chiffrer un défaut avant de le traiter est donc
aussi un test de son existence**, et c'est la seule chose qui ait fonctionné
sur ces trois cas.

**ET C'EST POURQUOI CELLE-CI TIENDRA LÀ OÙ L'AUTRE A CÉDÉ.** Le positif connu
demande un geste de plus, qu'il faut penser à faire au moment précis où l'on
est le moins disposé à le faire — quand le résultat plaît. Le chiffrage, lui,
n'ajoute rien : on compte **de toute façon** avant de décider d'un périmètre,
ne serait-ce que pour savoir si l'on ouvre un lot ou une ligne.

> **Une règle qui demande un geste supplémentaire ne part pas. Une règle qui
> s'accroche à un geste déjà fait, si.**

C'est le critère à appliquer aux prochaines règles écrites ici : demander où
elle s'accroche, et si la réponse est « à la vigilance », elle ne partira pas.

###### Quatrième forme : deux appels au même nom d'hôte, deux machines

Le 1er septembre 2026 encore, pendant la mesure de production du cache. Pour
savoir combien de fraîcheur mon navigateur détenait, j'ai relevé l'`Age` du
CDN par `curl` juste après son chargement : 69 s à 00:30:53. J'en ai déduit
une expiration à **00:39:40**.

Elle était à **00:40:28**. L'`Age` réellement reçu par le navigateur valait
moins de 4 s, pas 45. Établi après coup, par la durée de vie observée : la
copie était encore fraîche à 00:40:24 et périmée à 00:42:10, donc une durée de
vie entre 596 et 600 s, donc un `Age` de départ presque nul.

**La cause n'est pas une erreur de calcul, c'est que les deux requêtes ne sont
pas allées à la même machine.** `heurix.fr` répond depuis un POP Fastly de
plusieurs nœuds, chacun portant sa propre copie avec son propre `Age`. Mesuré
le 1er septembre 2026, **huit appels successifs à la même URL, huit nœuds
distincts** :

```
cache-par-lfpg1960085  age=0     cache-par-lfpg1960059  age=3
cache-par-lfpg1960062  age=1     cache-par-lfpg1960049  age=4
cache-par-lfpg1960032  age=2     cache-par-lfpg1960073  age=4
cache-par-lfpg1960025  age=3     cache-par-lfpg1960069  age=5
```

Le nom du nœud est dans `x-served-by`, donc lisible — mais **rien ne dit quel
nœud le navigateur a atteint**, et c'est la seule information qui aurait
compté. Sonder l'un pour conclure sur l'autre revient à mesurer une machine
qu'on n'interroge pas.

> **Un `Age` relevé par `curl` ne borne pas ce que le navigateur détient.** Il
> faut le lire dans le navigateur, ou accepter une incertitude de la taille du
> `max-age` entier.

**ET L'ERREUR EST ALLÉE DANS LE BON SENS, CE QUI EST UN ACCIDENT.** J'avais
plus de fenêtre que prévu, donc trois relevés au lieu d'un. Dans l'autre sens
— un `Age` sous-estimé — j'aurais conclu « fenêtre expirée, mesure ratée » sur
une page encore fraîche, et j'aurais réamorcé pour rien. **Une incertitude
qu'on n'a pas nommée ne choisit pas son sens** ; celle-ci a été gentille.

C'est la quatrième forme de la même famille : l'instrument répond, son chiffre
est plausible, et il porte sur autre chose que ce qu'on croit. Après la classe
de caractères en locale C, le filtre aveugle à `en/`, le chemin relatif lu
sans être résolu — un nom d'hôte qui n'est pas une machine.

###### Le geste qui distingue une confirmation d'une découverte

Le protocole de cette mesure a fait une chose que les trois cas ci-dessus
n'avaient pas faite : **annoncer le résultat attendu AVANT de lancer la
mesure.** Il était écrit, avant le déploiement, que la production ne pourrait
pas reproduire le défaut d'appariement du banc, et pourquoi. La mesure l'a
confirmé.

> **Une mesure qui découvre ce qu'elle prédisait n'a rien découvert. Une
> mesure qui contredit sa prédiction annoncée a trouvé quelque chose.**

C'est ce qui manquait aux trois faux défauts : aucun n'avait de prédiction
écrite avant le lancement, donc aucun résultat ne pouvait la contredire.
« 0 entrée anglaise » n'a rien contredit — il n'y avait rien à contredire, et
un chiffre qui ne dément rien se lit comme une confirmation de ce qu'on
pensait déjà.

Le geste est bon marché : une phrase avant de lancer, et elle vaut pour
n'importe quelle mesure — « je m'attends à X, pour telle raison ». Elle
s'accroche elle aussi à un geste déjà fait, puisqu'on a toujours une attente ;
elle demande seulement de l'écrire pendant qu'elle est encore réfutable.

##### Le remède est la suppression, pas la mise à jour

Le balayage complet du dépôt (`*.css`, `*.js`, `*.md`, `*.py`, `tests/`) a
trouvé **17 comptes de pages périmés**. Le fait qui tranche :

> **Au moins 4 des 17 étaient faux le jour où ils ont été écrits.**

`styles.css` annonçait « `h1` touche 37 pages » le 1ᵉʳ août, quand 141 pages
portaient un `<h1>` ; « `.btn-ghost` sur 22 autres pages » le 2 août, quand
53 pages le portaient, soit 51 autres — et ce même « 22 » est *juste
aujourd'hui* (26 pages, 22 autres), par coïncidence. Un
chiffre écrit à la main n'est donc pas « juste puis périmé » : il est juste
*si* quelqu'un l'a mesuré, et **rien, après coup, ne dit lequel des deux**.

Le fichier se contredit d'ailleurs à lui seul : `styles.css` disait 126
en-têtes et, 150 lignes plus bas, 128 — écrits à un commit d'intervalle, dans
le même chantier sur le menu.

D'où trois règles, appliquées à ce lot :

- **Ne pas écrire le nombre quand la phrase n'en a pas besoin.** « déplacer un
  nœud dans 126 en-têtes » et « dans chaque en-tête » disent la même chose ;
  seule la première peut mentir. C'est le corollaire des secteurs — « ne pas
  écrire le nombre » — appliqué aux commentaires.
- **Dater seulement quand le nombre porte l'argument.** Sur les six sites de
  ce lot, **un seul** : le récit du défaut des panneaux, où l'ampleur *est* le
  propos. Il porte désormais 128 et sa date.
- **Un relevé daté ne se rafraîchit pas.** `canonical.test.js:19` dit « le
  balayage des 126 pages » : c'est un état du 27 août, il était exact, et le
  corriger effacerait la mesure au lieu de la rafraîchir. Non touché — comme
  les ~30 autres relevés datés du dépôt.

##### Le discriminant n'est pas l'écart au réel. Il est triple, et ordonné.

C'est la partie qui a coûté le plus cher : deux sessions ont mal classé sept
lignes en une soirée, **toutes les deux en comparant le nombre écrit au nombre
réel**. Ce critère ne discrimine rien — il dit qu'un chiffre est faux, pas ce
qu'il faut en faire. Les trois questions, dans cet ordre :

**1. À quel temps est le verbe ?** Le passé signe une MESURE. « Figer `--ink`
ici *rendait* le nom du produit invisible sur 118 pages » décrit l'état d'avant
un correctif : le chiffre est la taille du défaut au moment où il a été
mesuré. Il ne se touche pas. Cinq lignes ont failli disparaître sur ce seul
oubli, et les supprimer aurait rendu le récit faux — le défaut portait sur les
118 pages d'alors, pas sur les 133 d'aujourd'hui.

**2. Le nombre pèse-t-il dans une comparaison ?** Un nombre-argument se met des
DEUX côtés d'une balance. « 128 lignes de diff contre un effet nul » se
compare, et l'arbitrage disparaît si on le retire : il se date, avec sa
population. « Le ferait payer aux 118 pages » ne se compare à rien — c'est le
mot « partout », en plus fragile : il se supprime. **Le présent ne suffit donc
pas à faire un argument**, et deux lignes du même fichier peuvent différer sans
qu'aucune soit ce qu'on croit : `search-engine.js:18` est une mesure, `:28` une
ampleur, aucune des deux un argument. Le geste, plus court que la définition :
retirer le nombre, et regarder si l'argument tient encore.

**3. La mesure a-t-elle seulement eu lieu ?** Un nombre ne se date QUE SI
quelqu'un a regardé. Sinon la date certifie une vérification inexistante, et
**un mensonge daté est pire qu'un mensonge nu** : il est plus crédible.

> **Pour une revendication de vérification périmée, la satisfaire c'est refaire
> la mesure, jamais dater l'ancienne.**

Cette règle a rattrapé son auteur dans l'heure. J'avais daté
`search-engine.js:593` — « Vérifié sur les 56 pages » — au motif que
l'étendue d'une vérification se date. Vérifié après coup : au commit qui l'écrit,
**122 pages portaient `og:type`, et aucune population du dépôt ne valait 56**.
L'original était donc le même défaut que `styles.css:1938`, qui dit « Vérifié
plutôt que supposé » en portant un nombre supposé. Ma correction ne tient que
parce que j'avais **refait la mesure** ce jour-là (45 « article », 78
« website ») : la date certifie ma mesure, pas celle qui manquait. Accoler une
date au « 56 » aurait écrit le mensonge daté.

**Corollaire de fouille : « vérifié » est un endroit à creuser, pas une
garantie.** Sur les deux revendications de ce dépôt qui portaient un nombre de
pages, **les deux** étaient fausses le jour de leur écriture.

```bash
grep -rnE "[Vv][ée]rifi[ée]s?[^.]{0,40}[0-9]{2,}" --include='*.js' --include='*.css' --include='*.py' .
```

**Et ce balayage n'en trouve QU'UNE des deux — dit ici parce qu'il ne le dira
pas lui-même.** Il attrape `search-engine.js:593`, où le nombre suit
« Verifie » sur la même ligne. Il rate `styles.css:1938`, dont le « 56 » est
**trois lignes au-dessus** du mot « Vérifié » : un `grep` raisonne par ligne,
la phrase raisonne par phrase. Sa première version ratait même les deux — elle
ancrait `[Vv]érifi` sur l'accent, quand les commentaires de ce dépôt écrivent
« Verifie » sans accent. Elle a été lancée avant d'être écrite ici, et c'est ce
qui l'a montré : **la commande publiée pour documenter le défaut le
reproduisait**, troisième fois de la semaine que le correctif refait ce qu'il
corrige.

##### Et le garde a été chiffré, puis refusé

Comme celui des secteurs. La mesure est ici pour qui le reproposera.

Un garde de cohérence interne — *aucun commentaire du dépôt ne contredit un
autre commentaire sur la même population* — tourne en **0,2 s** et n'a besoin
d'aucune liste. Il attrape mal :

```
motif strict  (nombre colle au mot)   rate « 15 autres pages », « 126 en-tetes »
motif lache   (fenetre de 30 car.)    208 lignes, dont l'ecrasante majorite
                                      est l'article « une page », « un fichier »
```

Et il ne sait pas lire une population : dans « `.btn` et `.btn-ghost` sont
partagés respectivement par 36 et 22 autres pages », les deux nombres portent
sur deux sélecteurs, l'un faux et l'autre juste, dans la même phrase. Il
naîtrait donc avec sa liste d'exceptions — **c'est le garde refusé pour les
secteurs, sous une autre forme**, et un vert sur des commentaires faux est le
pire des états.

Ce qui ferme vraiment la famille est ailleurs, et existe déjà :
`entete-structure.test.js`, `canonical.test.js` et `panneaux-fermes.test.js`
**dérivent tous leur périmètre** — marche de l'arbre, extraction du CSS,
référence prise comme la structure majoritaire. Aucun ne code un nombre. Le
seul élément périmé des trois était le chiffre écrit dans leur commentaire
d'en-tête.

##### La colonne « juste » n'était pas sûre. Elle était non examinée.

Le premier tableau de ce lot triait les comptes en *juste* et *périmé*. Il a
servi à décider quoi corriger, et la colonne « juste » n'a plus jamais été
rouverte — jusqu'à ce qu'une **autre session** signale une ligne qui s'y
trouvait. Sous le bon axe, elle en contenait **douze** du même genre : exactes
ce jour-là, condamnées par la même règle, et en train de devenir la série
suivante.

La cause n'est pas la négligence, elle est structurelle : **la colonne
répondait « ce chiffre est-il vrai ? » quand la question était « ce chiffre
devrait-il exister ? »**. Les deux réponses ont la même forme — un verdict par
ligne — et rien ne distingue un tri fait sous le mauvais axe d'un tri correct.

> **Une catégorie qu'on a soi-même déclarée close est celle qu'on ne rouvre
> pas.** Ce n'est pas un défaut d'attention : la déclarer close *est* la
> décision de ne plus la regarder, et cette décision survit au changement de
> question qui l'invalide.

D'où le seul remède observé qui marche, et il n'est pas une discipline :
**quelqu'un d'autre.** Les trois quarts du périmètre final viennent d'une
session voisine — la ligne hors liste, les douze qu'elle a fait rouvrir, les
trois derniers de sa relecture du tableau. Aucune des deux sessions ne
l'aurait produit seule, et celle qui tenait le tableau était précisément celle
qui ne pouvait pas le voir.

Corollaire pour qui reçoit une relecture : **la partie utile n'est pas ce
qu'elle corrige, c'est ce qu'elle rouvre.** Les cinq classements que la session
voisine avait faux ont coûté dix minutes à démentir ; la question qu'elle a
posée sur une ligne « juste » a doublé le lot.

#### Le garde a été chiffré, et refusé sur sa mesure

Il n'est pas écrit. La mesure est ici pour qui le reproposera.

**Il ne peut pas lire `rulepacks/`** — ce dossier vit dans `heurix-engine`. La
seule source dérivable depuis ce dépôt est `solutions/*.html` moins
`index.html`, soit onze. Les deux valent 11 aujourd'hui et peuvent diverger.

```
adjacence STRICTE   0,16 s / 137 pages   34 affirmations, 10 nommees, 1 faux positif
                    -> rate « Seven OF THESE industries » et « les DEUX AUTRES packs »
balayage LACHE      208 affirmations, dont l'ecrasante majorite est l'article « un pack »
```

Le faux positif de la version stricte : `produit.html`, « la même mécanique,
appliquée à **deux secteurs** différents » — deux schémas de démonstration.

**La précision se paie en rappel, et le seuil qui donne 9 sur 10 rate
exactement les deux cas les plus anciens.** Un garde qui manque la moitié de
la famille et qui naît avec une liste d'exceptions ne vaut pas sa seconde de
CI : il donnerait un vert sur des pages fausses, ce qui est le pire des
états — celui du contrôle qui certifie l'absence d'un défaut présent, déjà
documenté plus haut.

Ce qui aurait vraiment fermé la famille est ailleurs, et n'est pas un test :
**ne pas écrire le nombre.** « Onze secteurs » se périme ; « les secteurs
couverts » ne se périme pas, et `secteurs.html` porte la liste. Les six
corrections de ce lot gardent le chiffre parce que le retirer était une
réécriture, pas un correctif — mais c'est la question à poser au quatrième.

### Ce fichier grandit par réunions automatiques que personne ne relit

Le 29 août 2026, un rebase sur quatre commits d'autres sessions a produit deux
conflits — les deux index de recherche — et **aucun sur ce fichier**, alors que
deux sessions y avaient ajouté une section. Git a fait exactement ce qu'il
devait : les ajouts étaient à des endroits différents, il les a mis bout à
bout.

C'est le bon comportement, et c'est aussi une propriété à connaître.

```
2 136 lignes · 53 sections · 42 commits, dont 36 en trois jours
```

**Deux sections qui se contrediraient se réuniraient de la même façon.** Rien
dans un merge propre ne lit ce qui est écrit ; il lit où c'est écrit. Un
fichier qui grandit de douze commits par jour, chacun ajoutant une section que
son auteur seul a lue, accumule donc des contradictions sans qu'un seul
conflit ne se déclare.

**CE N'EST PAS UNE CRAINTE, C'EN EST UNE MESURÉE.** Le jour où cette note est
écrite, `.gitignore` justifiait trois de ses règles ainsi :

```
# la procedure de deploiement documentee dans CLAUDE.md est `git add -A`
```

Pendant que ce fichier-ci écrit, ligne 205 :

> **JAMAIS `git add -A`.**

La recette invoquait, comme argument, la commande que la règle interdit. Les
deux sont arrivées par des commits différents, aucun n'a produit de conflit, et
la contradiction a vécu jusqu'à ce qu'on la cherche. Les trois justifications
sont corrigées dans le même lot que cette note — les règles, elles, restaient
bonnes : c'est leur *raison* qui avait vieilli.

Cette famille est déjà nommée plus haut sous « un commentaire qui décrit un
comportement se périme au rythme du code qu'il ne contient pas ». Ce qui est
propre à ce fichier-ci est le **mécanisme d'accumulation** : ailleurs une
contradiction finit par rencontrer une mesure qui la démente ; ici les deux
énoncés sont de la prose, personne ne les exécute, et rien ne les confronte
jamais.

Deux conséquences pratiques :

**Avant d'ajouter une section, chercher ce que le fichier dit déjà du sujet.**
Un `grep` sur le terme central coûte cinq secondes. Ce n'est pas de la
politesse envers les autres sessions : c'est le seul moment où les deux
énoncés sont sous les mêmes yeux.

**Et quand un texte cite ce fichier, il cite une cible mouvante.** Les renvois
« comme documenté dans CLAUDE.md » sont exactement ce qui s'est périmé ici. Une
règle qui porte sa propre raison — « un `git add -A` emporterait 115 fichiers »
— reste vraie quoi qu'il arrive à la section citée.

### Un test qui peut échouer sans que le code change ne mesure pas le code

Deux tests fragiles, deux dépôts, la même semaine, et la même forme sous deux
symptômes différents.

**`heurix-site`, mesuré le 29 août.** `scripts/index-recherche.py --verifier`
met **2 832 ms**, et `tests/index-recherche.test.js` l'appelle **cinq fois**,
contre le plafond par défaut de vitest — **5 000 ms par test**. Chaque appel
consomme donc 57 % du budget avant même la charge des autres fichiers, qui
tournent en parallèle. Résultat mesuré, deux exécutions consécutives du même
fichier, sans une ligne de changement entre les deux :

```
npx vitest run tests/index-recherche.test.js   ->  1 failed | 22 passed
npx vitest run tests/index-recherche.test.js   ->  23 passed
```

Et le dépassement ne se contente pas d'échouer : ce test **mute `docs.html`**
et restaure dans un `finally`. Quand vitest le tue au délai, le `finally` ne
tourne pas, et le marqueur reste dans l'arbre suivi — bloquant le crochet
`pre-push` de **toutes** les sessions. Un test fragile est devenu un blocage
de dépôt.

**`heurix-engine`, même semaine.** Le test le plus lent est
`test_recherche_pendant_reindexations`, **5,99 s** — une épreuve de
concurrence. pytest n'a pas de délai par défaut, donc il ne peut pas échouer
par dépassement ; il ne peut échouer que par course.

> **Les deux ont le même défaut : leur verdict dépend d'autre chose que du
> code qu'ils vérifient.** L'un dépend de l'horloge et de la charge, l'autre
> de l'entrelacement de deux fils. Un test qui peut passer puis échouer sur le
> même code ne mesure pas ce code — il mesure la machine.

Ce qui rend la famille coûteuse n'est pas l'échec, c'est ce qu'on en fait :
un test qui échoue une fois sur deux finit par être lu comme du bruit, et le
jour où il attrape un vrai défaut, personne ne le croit. C'est le symétrique
exact du garde qui certifie l'absence d'un défaut : là un vert faux
décourageait la vérification, ici un rouge intermittent décourage la lecture.

Deux conséquences pratiques :

**Un test dont la durée s'approche de son plafond est déjà cassé**, même
quand il passe. 2 832 ms contre 5 000 n'est pas une marge, c'est un compte à
rebours : le site grossit, la mesure grossit avec lui.

**Et un test qui mute un fichier suivi doit pouvoir être tué sans laisser de
trace.** Restaurer par l'opération inverse plutôt que par un instantané, et
refuser de tourner si la mutation est déjà là — c'est ce qui a été fait le
28 août sur ces deux assertions, et ça reste vrai quand le processus meurt
entre les deux.

### Quatre commandes dont la portée vient de l'arbre, et non d'une liste

Quatre formes en trois jours, même racine, dégâts différents :

| geste | ce qu'il emporte |
|---|---|
| `git add -A` | **inclut trop** — 1 770 lignes du travail d'une autre session, dans deux commits |
| `git checkout <fichier>` | **restaure à HEAD** et efface un correctif non commité |
| `git checkout -- .` | **annule en bloc** tout le non-commité d'un arbre partagé |
| `git checkout <commit> -- <fichier>` | **restaure depuis un COMMIT** et efface le correctif non commité de son propre auteur |

Les trois premières demandent à Git « ce qui a changé » au lieu de lui donner
« ce que j'ai changé ». Dans un arbre où quatre sessions écrivent, la réponse
à la première question contient le travail des autres.

**La quatrième est différente, et c'est ce qui la rend instructive.** Le
29 août 2026, en testant si un état antérieur expliquait un écart de mesure,
j'ai restauré quatre fichiers depuis un commit du matin — dont celui que je
venais de corriger sans l'avoir commité. La correction a disparu sans un mot.

J'étais **seul dans un worktree dédié**. Aucune des raisons habituelles ne
s'appliquait : pas de session voisine, pas d'arbre partagé, pas de `-A`. Le
worktree protège du travail des autres ; il ne protège de rien quand la
commande vient de soi.

> **Une portée dérivée de l'arbre n'a pas besoin d'un voisin pour emporter
> quelque chose. Le premier candidat est toujours son propre travail non
> commité.**

Coût réel : deux minutes, parce que le fichier venait d'être écrit et que
son contenu était encore sous les yeux. Le même geste sur un correctif d'il y
a une heure aurait coûté l'heure.

**Le remède n'est pas de se méfier, c'est de nommer.** Un `git stash` avant
une manœuvre risquée protège par précaution générale ; il ne cible rien. Ce
qui cible, c'est la liste des fichiers que l'opération a réellement touchés —
et cette liste vient de l'outil qu'on vient de lancer, pas d'un `git status`
postérieur, qui contient déjà ce que les autres ont écrit entre-temps.

Le contrôle d'une seconde, avant tout commit dans un arbre partagé :

```bash
git diff --cached --name-only | grep -v '\.html$'
```

Relire les fichiers **non-HTML** du diff indexé. Sur un dépôt de site, ils
sont cinq ou six — les scripts, les tests, les données. C'est là que se
cachent les fichiers d'autrui, et un coup d'œil suffit à voir celui qu'on ne
reconnaît pas.

### Le correctif refait ce qu'il corrige, et c'est la règle plutôt que l'exception

Le 28 août 2026, trois occurrences de la même forme, sur trois sujets sans
rapport. Ce n'est pas une distraction : c'est que **la zone la plus exposée à
un défaut est le texte qui le décrit**, parce qu'on y écrit le motif fautif
pour le montrer.

| | le défaut | où il a été refait |
|---|---|---|
| 1 | trois paragraphes se partageant un bloc de 46 caractères | en réécrivant les trois d'affilée, ce qui a recréé le bloc |
| 2 | `--` interdit dans un commentaire XML | dans le commentaire qui explique que `--` est interdit |
| 3 | lire `$?` derrière un tuyau, donc le code du dernier maillon | en mesurant un garde avec `python3 … \| sed`, deux heures après l'avoir noté |

Le deuxième est le plus net. Un commentaire XML ne peut pas contenir deux
tirets consécutifs ; j'avais écrit les noms de tokens CSS tels quels dans
`img/og-image.svg`, le fichier ne parsait **dans aucun moteur**, et l'image
sortait « broken » sans un mot. En corrigeant, j'ai écrit la phrase
« un commentaire XML ne peut pas contenir « ­-­- » » — avec les deux tirets
dedans. Le fichier est resté invalide, pour la raison qu'il venait d'expliquer.

**Une session voisine l'avait rencontré le matin même**, en marquant
`prisme-marketing-double.svg` pour le garde de classement par fond. Deux
sessions, le même piège, à quelques heures d'écart, sans se le transmettre.

Le troisième est le plus humiliant et le moins grave : `$?` derrière un tuyau
lit le code du **dernier** maillon. C'est écrit plus haut dans ce fichier
depuis le matin. Je l'ai refait en vérifiant qu'un garde mordait — le garde
mordait, ma mesure disait « code 0 ».

**CE QUI SORT DE CES TROIS N'EST PAS « RELISEZ-VOUS ».** Relire ne les attrape
pas : dans les trois cas le texte était juste à la lecture, et faux à
l'exécution. Ce qui les attrape est de **faire tourner la chose sur elle-même**
— parser le XML qu'on vient d'écrire, remesurer la densité après chaque page,
lire le code de sortie sans tuyau.

D'où le garde, qui vaut mieux que cette note :
`scripts/exporter-og-image.py` **valide le XML avant de fabriquer quoi que ce
soit**. Vérifié dans les deux sens le jour même — sortie `1` et aucun harnais
produit avec un `--` réinjecté, sortie `0` sur le fichier sain, restauration
par l'opération inverse. Les 27 autres SVG du dépôt passent le même contrôle :

```bash
for f in $(git ls-files '*.svg'); do python3 -c "
import xml.dom.minidom as m, sys
try: m.parse('$f')
except Exception as e: print('INVALIDE $f :', e)"; done
```

#### Quatre le 30 août, dont deux en vérifiant le lot qui documente la famille

Le titre de cette section disait « trois fois dans la journée ». Deux jours
plus tard il en fallait quatre de plus, et **deux d'entre elles ont été
commises pendant la vérification du lot qui documente exactement ce défaut** :

| | le défaut | où il a été refait |
|---|---|---|
| 4 | un compte de pages en commentaire | « 128 en-têtes à rouvrir », écrit dans l'heure qui suit la rédaction de la règle qui l'interdit |
| 5 | un motif ancré sur une graphie | la commande `grep '[Vv]érifi'` publiée pour trouver les revendications de vérification, aveugle aux « Verifie » sans accent — donc aux deux cas qu'elle documente |
| 6 | `for` non quoté sous zsh | en rejouant le contrôle de clefs de cache du lot, à l'endroit où `CLAUDE.md` le documente depuis le 29 août |
| 7 | un chronomètre reproché le matin | posé l'après-midi |

Le titre est corrigé en conséquence : **compter les occurrences dans un titre
était le défaut de la section elle-même.** « Trois fois dans la journée » se
périme au quatrième, et il est arrivé.

##### LE GESTE QUI A ATTRAPÉ LA SIXIÈME : un contrôle de boucle porte un cas qui ne doit PAS passer

C'est le seul des quatre qui ait été attrapé par un garde plutôt que par
chance, et le garde tient en trois lignes.

Le rejeu du contrôle de clefs, lancé dans le shell de session — **zsh** — n'a
pas découpé `$MODIFIES` : une seule itération sur les deux noms collés, et un
`OK` qui ne contrôlait rien. La sortie ressemblait exactement à un succès.

```
      OK  search-engine.js
      styles.css : 1788106112 -> 1788116162     <- UNE itération, deux noms
```

Ce qui l'a démasqué n'est pas la relecture — la boucle est une copie fidèle de
celle de la CI — mais **deux actifs NON modifiés passés dans la même boucle,
qui devaient en sortir inchangés.** Sous zsh ils ne sortaient pas du tout.

> **Un contrôle qui itère porte un cas qui ne doit pas passer.** Sans lui,
> « la boucle a tourné » et « la boucle a tourné une fois sur du vide » ont la
> même sortie, et c'est celle qu'on attendait.

C'est la règle du témoin déjà écrite plus haut — « un instrument n'a le droit
de répondre sur l'inconnu qu'après avoir répondu juste sur le connu » —
spécialisée à la seule structure qui peut échouer *silencieusement en
quantité* : une boucle qui ne tourne pas rend le même « aucun échec » qu'une
boucle qui tourne et ne trouve rien. Le témoin négatif est ce qui les sépare,
et il coûte deux lignes.

Rappel du remède de fond, inchangé depuis le 28 août : **un fragment de script
de CI se rejoue sous `bash -c`, jamais dans le shell interactif.** Le témoin
est ce qui reste quand on oublie de le faire.

### Les onze pages sans balise sociale sont les bonnes onze

Mesuré le 28 août 2026, en refaisant la carte de partage. Sur 134 pages HTML,
**123 déclarent une `og:image`** — dont **103 pointent vers `og-image.png`** et
20 sont les pages `solutions/*`, qui ont la leur. Remplacer le fichier atteint
donc 103 pages sans qu'aucune balise ne bouge.

Les **11 sans aucune balise sociale** ne sont pas un oubli : dix portent
`noindex`, et **aucune des onze n'est au sitemap**. Ce sont les deux `404`,
l'écran de bienvenue, les deux consoles, la supervision et les quatre pages de
`demo/`. Des pages qu'on ne partage pas.

**Deux écarts réels, notés et non corrigés dans ce lot :**

- `confidentialite.html` et `mentions-legales.html` déclarent `og:image` **sans
  `twitter:image`**. Deux pages sur 123 — la forme exacte de la famille « une
  valeur dupliquée partout, une seule manquante ».
- `downloads/heurix-conversion-snippet.html` est la seule des onze **sans
  `noindex`**, et elle n'a **pas de `<title>`**. Ce n'est pas une page : c'est
  un fragment de code à copier, servi en `.html`. Un robot peut l'indexer.

#### Et mon premier relevé de ces onze était faux, par sous-chaîne

Mon test d'appartenance au sitemap était `p in sitemap`. Il a rendu « console.html
est au sitemap », ce qui contredisait son `noindex`. C'était un **faux positif** :
la chaîne `console.html` apparaît dans `blog/guide-utilisation-console.html`,
qui, lui, y est.

Remesuré par URL exacte, extraite des `<loc>` : aucune des onze n'y figure, et
la contradiction n'existait pas.

> **Un test d'appartenance par sous-chaîne répond sur autre chose que ce qu'on
> lui demande, et sa réponse a la même forme que la bonne.**

C'est la famille de l'identité d'un actif — « son chemin, pas son nom de
fichier » — sous un autre angle : là on groupait trop large, ici on
appartient trop facilement. Le remède est le même : **extraire les identités,
puis comparer des égalités**, jamais chercher un fragment dans un fichier
entier.

### La vérification qui attrape le motif n'est jamais celle qu'on est en train de faire

Neuvième cas de la semaine, et le seul qui ait cette forme : **il a été
commis sur le correctif de ce motif, pendant qu'on l'écrivait.**

Le 27 août, la CI échoue sur `--verifier`. Diagnostic : `date_ajout()` fait
`git log --diff-filter=A`, et le job de tests clone en `fetch-depth: 1`. On
pose un garde pour que le script refuse de répondre plutôt que de répondre
faux. Le garde teste :

```python
if rels and all(d == 0 for d, _ in dates):
```

**Ce zéro était une supposition.** Mesuré ensuite sur un vrai
`git clone --depth 1` : `date_ajout()` rend `1787853596` pour *chaque*
article — du point de vue de git, le commit unique d'un clone superficiel
*ajoute* tous les fichiers à la même seconde. Le garde ne se déclenchait
jamais.

Le vrai signal est « toutes les dates sont **égales** », pas « toutes à
zéro ».

**Ce qui rend le cas instructif n'est pas l'ironie, c'est le mécanisme.** La
vérification en cours portait sur la *sortie du script* — reproduire l'échec
de la CI en local, comparer les cinq articles à `ls | sort -r`. Elle a
parfaitement fonctionné : le diagnostic était juste. Elle ne pouvait pas
attraper la valeur d'une variable interne au garde qu'on venait d'écrire,
parce qu'elle ne regardait pas là.

> **Une vérification prouve ce qu'elle observe. Le code écrit pendant
> qu'elle tourne n'en fait pas partie.**

Corollaire pratique : un garde qui repose sur une valeur qu'on n'a pas vue
de ses yeux se teste **en le faisant se déclencher**, pas en constatant que
le reste passe. Ici, une seule commande manquait :

```bash
git clone --depth 1 . /tmp/x && cd /tmp/x && python3 -c "…date_ajout('blog/…')"
```

Elle aurait rendu `1787853596` avant que le `== 0` soit écrit, pas après.

### Une incapacité à mesurer n'est pas un écart

`--verifier` disait « les derniers articles ont changé — attendu … ». C'était
vrai et trompeur. Ils n'avaient pas changé : **c'est la mesure qui ne pouvait
plus les dater**, faute d'historique.

La différence n'est pas de vocabulaire. Ce message se termine par
« Régénérez : … », et régénérer depuis ce clone aurait **écrit la liste
fausse dans l'index** — une liste d'apparence normale, en ordre alphabétique
inverse, que personne n'aurait relue.

> **Un script qui confond les deux invite à corriger ce qu'il n'a pas pu
> voir.**

D'où deux codes de sortie distincts, et deux messages :

| code | sens | ce qu'il demande |
|---|---|---|
| `0` | tout concorde | rien |
| `1` | **écart** — l'index ne reflète plus les pages | régénérer |
| `2` | **incapacité** — l'historique ne permet pas de dater | réparer le clone, et **surtout ne pas régénérer** |

C'est le **troisième outil de la semaine à répondre faux plutôt qu'à se
taire**, après le contrôle de cohérence qui certifiait « une seule clef sur
tout le site » pendant que 38 pages en servaient une autre, et
`bust-cache.sh` qui s'arrêtait au milieu de ses arguments sans le dire.

Les trois avaient la même forme : une réponse d'apparence normale là où la
bonne réponse était « je ne peux pas savoir ». Un outil qui ne distingue pas
ses deux échecs — *j'ai regardé et c'est faux* contre *je n'ai pas pu
regarder* — transforme le second en premier, et fait agir sur du vide.
