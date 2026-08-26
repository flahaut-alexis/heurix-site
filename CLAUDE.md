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
