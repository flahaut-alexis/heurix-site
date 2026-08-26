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

À savoir aussi : les deux scripts coexistent et sont **incompatibles**.
`bump-version.sh` aligne tous les assets sur un horodatage unique ;
`bust-cache.sh` donne à chaque asset le sien, ce que décrit ce fichier. Lancer
le premier annulerait le second. Il n'est plus référencé que par des
commentaires de la CI.

À vérifier aussi : la CI porte la **même** limite de profondeur dans son
contrôle des clefs (`"(\.\./)?${BASE}\?v=`), et prend `sort -u | head -1`,
donc la plus petite valeur — elle voyait la clef périmée, pas la fraîche.
