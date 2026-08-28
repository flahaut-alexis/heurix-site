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
cache indéfiniment. `tests/actifs-versionnes.test.js` ferme ce trou pour les
assets ; il ne peut rien pour les documents, qui n'en portent pas et n'en
porteront pas.

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
déjà venu y servait sa feuille de style en cache indéfiniment, sans jamais
recevoir un seul correctif visuel. Le script annonçait « propagé dans 80
fichier(s) » — sans jamais nommer les 38 qui lui échappaient.

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

**Ce qu'un œil ne peut pas couvrir, un contrôle dérivé le doit.** 126 pages ×
deux langues ne se cliquent pas. `tests/liens-relatifs.test.js` résout chaque
lien depuis le dossier de sa page et demande au disque si le fichier existe —
périmètre dérivé, aucune liste de pages. Il aurait attrapé les 22.

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
indéfiniment — pendant que le contrôle de cohérence voyait une clef unique et
concluait « cohérent ». C'est la forme exacte du défaut des 38 pages, un cran
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

### Trois commandes dont la portée vient de l'arbre, et non d'une liste

Trois formes en deux jours, même racine, dégâts différents :

| geste | ce qu'il emporte |
|---|---|
| `git add -A` | **inclut trop** — 1 770 lignes du travail d'une autre session, dans deux commits |
| `git checkout <fichier>` | **restaure à HEAD** et efface un correctif non commité |
| `git checkout -- .` | **annule en bloc** tout le non-commité d'un arbre partagé |

Les trois demandent à Git « ce qui a changé » au lieu de lui donner « ce que
j'ai changé ». Dans un arbre où quatre sessions écrivent, la réponse à la
première question contient le travail des autres.

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
