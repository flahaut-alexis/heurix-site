# Balisage structuré, hreflang et lastmod — relevé du 20 octobre 2026

Branche `balisage-structure-20oct`, worktree `~/wt/balisage-site-20oct`,
partie de `origin/main` à `441d2746`.

**Deux lots, le même jour.** `1abd13b2` (24 fichiers) : lastmod, WebSite,
SIRET, hreflang. `ec0887fb` : le h1 des quatre pages qui n'en avaient pas, le
balisage des quatre pages indexables qui n'en avaient aucun, trois gardes par
absence, et le périmètre réconcilié.

**Le périmètre qui fait foi est 140 pages indexables**, et la §2.1 le
démontre. Le compte « 163 » publié dans la première version de ce relevé est
**retiré** : il mélangeait les 21 pages en `noindex` et laissait entrer
`en/demo/`, qui n'est pas un dossier de premier niveau. Il ne désigne aucune
population utile et ne doit être repris nulle part.

---

## 1. La prémisse du lot est contredite par la mesure

Le lot partait de : « le site n'a aucun balisage structuré et aucune
déclaration de langue ». **C'est faux, dans le dépôt comme en production.**

Mesuré sur `origin/main` 441d2746, **sur les 140 pages indexables** — le
périmètre réconcilié de la §2.1, et non le 163 de la première version de ce
relevé :

| | pages |
|---|---|
| au moins un bloc JSON-LD | **136 / 140** |
| au moins un `hreflang` | **140 / 140** |
| un `rel="canonical"` | 140 / 140 |
| un `<html lang="…">` | **140 / 140** |

Sur ce périmètre, `hreflang`, `canonical` et `<html lang>` étaient **déjà
complets avant ce lot** : les sept pages sans `hreflang` relevées dans la
première version de ce document sont toutes en `noindex` (§5.5). Seul le
JSON-LD avait quatre trous, nommés en §10. Autrement dit, sur ce que les
robots lisent, la prémisse était fausse sur trois points sur quatre et
incomplète sur le quatrième.

Et sur le site **servi** le 20 octobre, lu par `curl` :

| URL | ld+json | hreflang | `<html lang>` |
|---|---|---|---|
| `https://heurix.fr/` | 3 | 3 | `fr` |
| `https://heurix.fr/en/index.html` | 3 | 3 | `en` |
| `https://heurix.fr/faq.html` | 2 | 3 | `fr` |
| `https://heurix.fr/about.html` | 1 | 3 | `fr` |
| `https://heurix.fr/fonctionnalites.html` | 1 | 3 | `fr` |

Les types déjà déclarés, comptés sur les 263 blocs du dépôt :
`Organization` 231, `Person` 229, `BlogPosting` 82, `ListItem` 70,
`Question` 40, `Answer` 40, `BreadcrumbList` 24, `FAQPage` 6,
`SoftwareApplication` 2, `AggregateOffer` 2.

**Quatre autres chiffres du relevé d'origine ne se retrouvent pas** — ni dans
le dépôt, ni sur le site servi :

| affirmé | mesuré (dépôt ET production) |
|---|---|
| sitemap : 122 URL | **140** `<loc>` |
| `changefreq` + `priority` sur 24 | sur **22** |
| `fonctionnalites.html` : un seul H2 pour trente intitulés | **1 h1, 10 h2, 32 h3**, tous de vrais éléments de titre avec `id` |
| `fonctionnalites.html` : meta description 188 caractères | **150** ; titre **56** |

Trois chiffres se retrouvent : `about.html` titre 67, `faq.html` titre 62,
aucun `<lastmod>` dans le sitemap.

Je n'ai pas réécrit le balisage qui existait. Le lot ne porte donc que ce qui
manquait vraiment, et la §5 dit ce qui n'a pas été écrit et pourquoi.

---

## 2. Le programme de mesure demandé

### 2.1 Fichiers HTML et sitemap — le périmètre réconcilié

Vous comptez 174, je comptais 163. Les deux sont justes sur leur population,
et **aucun des deux ne doit servir de périmètre à un garde.** La
décomposition, qui se somme :

| | |
|---|---|
| fichiers `.html` suivis par git | **174** |
| − 1 fragment sans `<html>` | `downloads/heurix-conversion-snippet.html` |
| − 12 pages d'arbres qui ne sont pas le site | `docs/maquettes/` (8), `demo/` (2), `en/demo/` (2) |
| − 21 pages du site en `noindex` | 404, `cgv-*` (5+5), console, mentions-legales, confidentialite, privacy, bienvenue, supervision |
| **= 140 PAGES INDEXABLES** | **= exactement les 140 `<loc>` du sitemap** |

**L'écart tient à ce que vous supposiez, plus une chose que vous ne pouviez
pas voir :** `docs/maquettes` (8), `demo/` (2) et `downloads/` (1) y sont, et
`en/demo/` (2) aussi — mes 163 le laissaient entrer parce que mon filtre
excluait les dossiers de PREMIER NIVEAU et que `en/demo/` est un sous-dossier
de `en/`. 174 − 1 − 12 = 161, et non 163 : la différence de 2 est là.

**Le critère d'indexabilité n'énumère aucun dossier**, et c'est ce qui le rend
juste : un `<html>`, et pas de `noindex`. `docs/maquettes/`, `demo/` et
`en/demo/` sortent parce que leurs pages portent `noindex`, pas parce qu'une
liste les nomme. C'est le critère de `tests/canonical.test.js` depuis le
3 septembre 2026, repris mot pour mot dans `tests/pages-indexables.js`, que
les trois gardes du second lot partagent.

| | |
|---|---|
| `<loc>` du sitemap | **140** |
| URL du sitemap sans fichier | **0** |
| pages indexables absentes du sitemap | **0** |
| URL du sitemap qui ne sont pas indexables | **0** |
| `<loc>` en double | 0 |

Sur le fragment `downloads/heurix-conversion-snippet.html`, que votre relevé
compte comme « une seule page indexable absente » : il n'a ni `<html>`, ni
`<head>`, ni `<title>`, donc il n'est pas une page selon le critère ci-dessus,
et son absence du sitemap n'est pas un manque. `robots.txt` le refuse par
ailleurs, et `tests/fragments-non-indexables.test.js` dérive cette règle.

### 2.2 Le head est-il partagé ?

**Non. Chaque fichier porte le sien en dur.** Aucun gabarit, aucun include,
aucun script de génération : `package.json` ne connaît que `vitest` et
`tests/fixtures/generate.py`, et `scripts/` ne contient rien qui écrive un
`<head>`.

La discipline est tenue par un test, pas par un gabarit :
`tests/entete-structure.test.js` compare la structure du `<header>` de toutes
les pages entre elles et rougit sur toute divergence non inscrite dans sa
liste d'exceptions motivées. Il ne couvre pas le `<head>`.

**Conséquence sur le lot : une modification du head est N modifications.**
C'est pourquoi l'`identifier` SIRET n'a été posé que sur les deux pages
demandées et non sur les 147 qui portent un `Organization` — voir §5.4.

### 2.3 Le sitemap est-il généré ?

**Maintenu à la main** avant ce lot : rien dans `scripts/`, `.github/` ni
`package.json` ne l'écrivait ; son dernier commit (`4bb82f92`, 28 septembre)
est un lot éditorial. Deux mises en page y coexistent — 77 blocs `<url>` sur
plusieurs lignes, 63 sur une seule.

Ce lot ajoute `scripts/sitemap-lastmod.py`, qui **n'écrit que le `<lastmod>`**
et laisse la liste des URL à la main, là où `canonical.test.js` la garde déjà.

### 2.4 Contreparties FR / EN

88 pages FR, 75 pages EN.

**16 pages FR sans contrepartie EN** — 14 articles de `blog/` plus
`confidentialite.html` et `supervision.html` :

```
blog/automobile-trois-equipementiers-trois-ecritures-reference.html
blog/badge-prix-barre-recherche.html
blog/cascade-annotations-resultats-explicables.html
blog/contrainte-prix-langage-naturel.html
blog/decoupage-rag-catalogue-produit.html
blog/mesurer-pertinence-recherche.html
blog/mode-retail-attributs-vetements.html
blog/multilingue-lang-recherche-federee.html
blog/prix-comptes-pro-visiteurs-anonymes.html
blog/refus-apres-ecriture-ordre-des-verifications.html
blog/regrouper-resultats-par-famille.html
blog/rupture-stock-tri-recherche.html
blog/tests-qui-ne-peuvent-pas-echouer.html
blog/vins-spiritueux-millesime-format-prix.html
confidentialite.html
supervision.html
```

**1 page EN sans contrepartie FR de même nom** : `en/privacy.html`.

Les deux dernières lignes sont un artefact du comptage par nom de fichier :
`confidentialite.html` et `en/privacy.html` **sont** une paire, et elles se
déclarent mutuellement en hreflang. `supervision.html` ne porte aucun
hreflang et n'est pas dans le sitemap (`noindex`).

**Le compte réel est donc 14 pages sans contrepartie, toutes FR, toutes des
articles.** Ce qui en a été fait : voir §4.3.

### 2.5 `fonctionnalites.html` : vrais titres ou div stylés ?

**De vrais éléments de titre**, dans le dépôt et en production : 1 `<h1>`,
10 `<h2>` (9 en `class="feat-group-title"`, 1 nu), 32 `<h3>`, chacun avec son
`id`. Les deux seuls `div` à classe de titre sont `feat-sommaire-titre` et
`foot-social-label`. `tests/hierarchie-titres.test.js` garde déjà la
hiérarchie.

### 2.6 Date du dernier commit par fichier

C'est la source du `lastmod`, et c'est la **date d'auteur** (`%as`), non celle
du committer (`%cs`) — un rebase réécrit la seconde et périmerait les 140
dates d'un coup, pour une raison étrangère aux pages.

Résultat sur les 140 URL : **six valeurs distinctes seulement**, du
19 septembre au 20 octobre 2026. Voir la limite en §6.2 — c'est la trace des
lots qui balayent tout le site, pas celle des pages.

---

## 3. Ce que le lot écrit

| | où | état avant |
|---|---|---|
| `WebSite` (sans `SearchAction`) | `index.html`, `en/index.html` | **0 page** en portait |
| `identifier` SIRET sur `Organization` | `index.html`, `about.html` | aucun `identifier` |
| `<lastmod>` | 140 URL du sitemap | **0** |
| `scripts/sitemap-lastmod.py` | — | n'existait pas |
| `tests/jsonld-blocs.test.js` | 263 blocs | aucun garde global |
| 3 assertions dans `tests/hreflang-reciproque.test.js` | — | voir §4.3 |
| 14 `hreflang` auto-référents retirés | `blog/` | voir §4.3 |
| 3 corrections de contenu | §4 | — |

Le SIRET vient du texte des pages (`about.html`, `mentions-legales.html` :
« SIRET 107 681 900 00018 »), écrit sans les espaces dans un `PropertyValue`
de `propertyID: "SIRET"`. Aucun chiffre n'a été inventé.

---

## 4. Les corrections

### 4.1 `about.html` : 2014 en meta, 2015 dans le corps

La meta description et `og:description` annonçaient « né en 2014 », le corps
dit 2015 à deux endroits. **Le corps fait foi** : les deux metas passent à
2015.

### 4.2 `en/index.html` : « through regular expressions » contre « no regex »

La meta description promettait que le moteur comprend les références
« through regular expressions » quand la liste de fonctionnalités de la même
page affiche `custom_rules: self-service, no regex`. La contradiction est
réelle pour un lecteur, même si les deux énoncés visent des sujets différents
(le moteur emploie des règles regex ; le marchand n'en écrit aucune).

La nouvelle rédaction est **celle de la page française, traduite** — rien
d'inventé :

> The Heurix search engine understands the structure of your product
> references — M8x20, 6204-2RS — not just your keywords. Self-service or
> hands-on.

147 caractères. `og:description` suivie.

### 4.3 Longueurs : une seule des deux corrections a un objet

`about.html` : titre **67 → 58** caractères, « français » retiré (le mot reste
dans la description, « conçu en France »). Le suffixe « — Heurix » est gardé :
134 des 163 titres du site le portent.

`fonctionnalites.html` : **rien à corriger.** Titre 56, description 150.

**Et la correction ne traite qu'un cas sur 79 :** 79 des 163 titres du site
dépassent 60 caractères, le plus long en fait 120
(`blog/limites-moteurs-natifs-gros-catalogue.html`). C'est un motif de site,
pas un défaut de deux pages. Décision à prendre hors de ce lot.

### 4.4 Les 14 hreflang auto-référents

Le lot demande que « les pages sans contrepartie n'en portent aucun ».
**14 articles en portaient un vers eux-mêmes et rien d'autre** — un unique
`<link rel="alternate" hreflang="fr" href="…lui-même">`. Ils sont retirés.

C'est une décision, pas une évidence : une grappe d'un seul membre ne
renseigne personne, et `<html lang="fr">` dit déjà la langue. Pour revenir
dessus : `git revert` ne convient pas (le commit porte tout le lot), mais le
geste inverse est
`git show 1abd13b2 -- blog/ | git apply -R`.

---

## 5. Ce qui n'a PAS été balisé, et pourquoi

### 5.1 `SearchAction` sur le `WebSite` — refusé faute de cible réelle

Un `SearchAction` déclare une URL qui accepte un terme de recherche. La
recherche du site est une **palette côté client** (`search-engine.js`, appelé
par 158 pages) : aucune URL ne porte de paramètre de requête, aucune page de
résultats n'existe. Une cible écrite ici rendrait l'accueil **en ignorant le
terme** — un 200 qui se lit comme une réponse.

Le champ est donc absent, et la raison est écrite en commentaire au-dessus du
bloc. **Ce qui le débloquerait :** une URL de résultats qui honore `?q=`, côté
site, avant le balisage.

### 5.2 `Offer` par forfait sur `pricing.html` — refus déjà en place, et gardé

Le lot demande « Offer ou AggregateOffer sur pricing.html pour les sept
forfaits affichés ». Trois faits s'y opposent, et aucun n'est de moi :

1. **Un `AggregateOffer` existe déjà**, sur les deux accueils, dans le
   `SoftwareApplication` dont l'`url` pointe vers `pricing.html`. Ses
   `lowPrice` / `highPrice` / `offerCount` sont comparés à `PLANS` de
   `billing-toggle.js` par `tests/schema-fil-et-produit.test.js`.
2. **Il n'y a pas sept forfaits.** `PLANS` en porte trois
   (starter 19, growth 49, scale 139) et `pricing.html` affiche trois blocs
   `data-plan`. Écrire sept `Offer` demanderait d'inventer quatre montants.
3. **Un `Offer` par plan est interdit par un test, avec sa raison**, depuis
   `tests/schema-fil-et-produit.test.js` (« aucune page ne déclare d'Offer par
   plan ») : les montants réels vivent chez Stripe, le dépôt en porte déjà
   trois copies en dur qui s'accordent sans que rien ne l'impose, et une
   quatrième serait **la seule affichée par Google**. Un prix périmé dans un
   résultat enrichi se lit comme une promesse.

Rien n'est écrit, et le refus reste gardé par son test.

### 5.3 `BreadcrumbList` sur les articles — refusé le 7 septembre, mesure à l'appui

Les 24 pages `solutions/` (12 FR + 12 EN) en portent un. Les 82 articles n'en
portent aucun, et c'est délibéré : ils affichent « ← Tous les articles », un
lien de **retour**, pas un chemin. Le périmètre du garde existant est la
présence du `<nav class="breadcrumb">` visible, précisément pour qu'il ne
valide pas l'invention qu'il doit interdire.

Le construire depuis `blog/` déclarerait aux machines une hiérarchie que
personne ne voit. Non écrit.

### 5.4 `identifier` SIRET sur les 145 autres pages

L'`Organization` apparaît sur 147 pages, en **22 variantes distinctes** (le
bloc a été propagé par copie, jamais unifié). Le lot demandait `index.html` et
`about.html` : l'`identifier` y est, et nulle part ailleurs. Poser les 145
autres est une décision à part, et elle demanderait d'abord d'unifier les
22 variantes.

### 5.5 Les sept pages sans hreflang

`bienvenue.html`, `en/bienvenue.html`, `console.html`, `en/console.html`,
`en/demo/index.html`, `en/demo/categorie.html`, `supervision.html`. Toutes en
`noindex`, aucune dans le sitemap. Rien à déclarer à un robot qui n'y va pas.

### 5.6 « +28 points de rappel sur 300 requêtes »

Relevé comme troisième défaut de contenu, mais absent de la liste des trois
corrections à écrire. Non touché, et voici pourquoi la décision revient à
l'auteur : la phrase est dans **158 fichiers**, 156 d'entre eux à une seule
occurrence — c'est une ligne de navigation, pas une affirmation de page. La
corriger est un lot à soi, qui touche du texte de corps, ce que ce lot
s'interdit.

### 5.7 `robots.txt`

Non touché. `docs/releves/` est déjà couvert par le `Disallow: /docs/`
existant, et `tests/surface-publiee-robots.test.js` reste vert.

### 5.8 Le texte du refus 1.2.1

`pricing.html` et `en/pricing.html` ne sont pas dans le diff du lot. Le
callout `callout-info` en `role="note"`, le bloc `session_token` de la page
anglaise et la branche 409 sont intacts.

---

## 6. Les témoins, et ce que chacun ne voit pas

### 6.1 Ce qui existait déjà

Trois des cinq témoins demandés **existaient avant ce lot**, et je ne les ai
pas réécrits :

| demandé | fichier | depuis |
|---|---|---|
| réciprocité des hreflang | `tests/hreflang-reciproque.test.js` | existant, **complété** (§6.3) |
| `Question` déclarées = questions rendues | `tests/faqpage.test.js` | 27 août 2026 |
| URL du sitemap sans fichier | `tests/canonical.test.js` | 27 août 2026 |

Deux manquaient entièrement — un bloc JSON-LD qui ne parse pas, et un
`lastmod` absent ou périmé — et sont écrits ici.

### 6.2 `tests/sitemap-lastmod.test.js` — ce qu'il ne voit pas

1. Il compare à la date du **dernier commit**, pas à la dernière modification
   **éditoriale**. Un commit qui change la ligne de navigation de 158 pages
   remet 158 `lastmod` à sa date, et ce garde trouve cela juste. C'est
   pourquoi les 140 dates ne prennent que **six valeurs**. Un `lastmod` dit
   « le fichier a changé », pas « le texte a changé » — ce que la
   spécification demande, et moins que ce que son nom suggère.
2. Il ne juge pas la **plausibilité** : un article qui annonce « Juillet 2026 »
   dans son corps et porte un `lastmod` d'octobre ne le fait pas rougir.
3. Il refuse de tourner sur un **clone superficiel** au lieu de s'y tromper :
   `git log -1` y rendrait la même date pour tout, et la comparaison
   passerait au vert sans rien comparer. La CI pose `fetch-depth: 0` sur le
   job « Suite de tests ».

### 6.3 `tests/hreflang-reciproque.test.js` — l'angle mort était peuplé

**Réponse directe à la question posée : oui, il resterait vert.** Une page
n'entrait dans son périmètre que si elle déclarait `fr` **et** `en`. Si toutes
les pages ne déclaraient qu'un hreflang vers elles-mêmes, le périmètre serait
**vide**, les boucles ne s'exécuteraient plus, et `expect([]).toEqual([])`
passerait.

Ce n'était pas une hypothèse : **14 articles étaient exactement dans cet
état**, et le garde n'en voyait aucun.

Mesure sous mutation à l'échelle — `hreflang="en"` retiré des 142 pages en
grappe, c'est-à-dire le cas dégénéré :

```
× le perimetre n'est pas vide                              (ajoutée aujourd'hui)
✓ chaque page pointe vers une cible qui declare la MEME grappe   ← VERT
✓ x-default vise le membre francais de sa propre grappe          ← VERT
× aucune page ne declare un hreflang vers elle-meme et rien d'autre (ajoutée)
× chaque hreflang de page pointe vers un fichier du depot        (ajoutée)
✓ chaque alternate du sitemap pointe vers un fichier du depot
```

Les deux assertions d'origine sortent vertes sur un site dont **aucune paire
ne tient**. Les trois ajoutées rougissent. Aucune ne remplace les autres : le
plancher attrape l'effondrement du périmètre, le refus de l'auto-référence
attrape le cas nommé, l'existence du fichier attrape la cible morte.

Ce qu'il ne voit toujours pas : les hreflang du **sitemap** ne sont vérifiés
que sur l'existence du fichier, pas sur leur accord avec ceux des pages. Les
deux déclarations peuvent diverger sans qu'aucun garde ne le dise.

### 6.4 `tests/jsonld-blocs.test.js` — ce qu'il ne voit pas

Il ne vérifie **aucune valeur**. Un `BlogPosting` dont le `headline` ne serait
pas celui de la page lui est invisible (c'est `schema-article.test.js` qui
l'attrape). Un `@type` inventé mais bien écrit — `BlogPost` au lieu de
`BlogPosting` — **passe** : rien ici ne confronte le vocabulaire à
schema.org. Il ferme la panne syntaxique, pas la panne de sens.

Pourquoi il manquait : les gardes existants lisaient chacun **son** type et
leur décodeur avalait l'échec de `JSON.parse` (`catch { out.push(null) }`).
Un bloc cassé devenait un bloc **absent**, et la page sortait du périmètre.

### 6.5 Vers quoi aucun témoin n'a jamais été pointé

- **La validité schema.org du vocabulaire.** Aucun test n'interroge un
  validateur. Tous comparent le balisage au dépôt ; aucun ne le compare à la
  spécification, ni au Rich Results Test de Google.
- **La page servie.** Tous lisent des fichiers du dépôt. Le site publié n'est
  lu par aucun test — `garde-demo.yml` interroge la production, mais sur la
  démo, pas sur le balisage. Ce relevé est la première lecture du balisage
  **en ligne**, et elle a été faite à la main.
- **Le `<lastmod>` contre l'horodatage HTTP** de la page servie. Deux sources
  de fraîcheur, jamais confrontées.
- **Le texte anglais.** `schema-fil-et-produit.test.js` le dit déjà de
  lui-même : aucun test ne sait dire « ce texte est en anglais ». La
  correction de §4.2 n'est gardée par rien.

---

## 7. Mutations : chaque témoin vu rouge, puis remis vert

Onze mutations, chacune appliquée sur un arbre propre, puis défaite par son
inverse exact (`git checkout -- <le fichier muté>`), arbre vérifié propre
après chaque restauration.

| # | mutation | témoin | rouge | message |
|---|---|---|---|---|
| 1 | `en/about.html` pointe son `fr` vers `index.html` | réciprocité | 2 échecs | `about.html declare {…} mais en/about.html declare {…}` |
| 2 | `about.html` pointe son `en` vers `en/about-disparu.html` | réciprocité + cible | 2 échecs | `la cible est ABSENTE du depot` **et** la non-réciprocité, séparément |
| 3 | virgule en trop dans le `WebSite` d'`index.html` | JSON-LD | 1 échec | `bloc 1 : Expected double-quoted property name…` |
| 4 | `@context` retiré du `WebSite` | JSON-LD | 1 échec | `@context « undefined », attendu https://schema.org` |
| 5 | une `Question` retirée du `FAQPage` de `faq.html` | FAQPage | 1 échec | `10 declarees, 11 affichees` |
| 6 | une `Question` ajoutée, absente du corps | FAQPage | 3 échecs | question et réponse absentes du visible, `12 declarees, 11 affichees` |
| 7 | un `<lastmod>` retiré | sitemap | 3 échecs | `0 <lastmod>`, date non ISO, écart au commit |
| 8 | un `<lastmod>` ramené au 2026-08-01 | sitemap | 1 échec | `<lastmod>2026-08-01</lastmod> mais dernier commit 2026-10-20` |
| 9 | une `<loc>` vers un fichier inexistant | sitemap + canonical | 4 échecs | `a-propos-disparu.html : aucun commit ne porte ce fichier` |
| 10 | un hreflang auto-référent remis sur un article | auto-référence | 1 échec | `blog/badge-prix-barre-recherche.html` |
| 11 | `hreflang="en"` retiré des **142** pages en grappe | réciprocité | 3 échecs | voir §6.3 — les deux assertions d'origine restent vertes |

**Une mutation a d'abord échoué silencieusement**, et c'est consigné parce que
c'est le défaut même que ces témoins traquent : la n° 11, passée en une seule
chaîne à `python3` (zsh ne découpe pas une variable non quotée), n'a muté
**aucun** fichier, et le test a alors rendu « 6 passed » — un vert qui ne
disait rien du cas dégénéré. L'arbre propre (`git status` à 0 fichier) l'a
montré. Rejouée avec la liste passée par fichier : 142 pages mutées,
3 échecs.

---

## 8. État

- `npx vitest run` : **101 fichiers, 1104 tests, tous verts** (1091 avant le
  lot ; 13 assertions ajoutées).
- `scripts/index-recherche.py --verifier` : à jour, 140 pages. L'index dérivé
  a été régénéré — il lit les titres et les descriptions, que §4 a modifiés.
- `scripts/sitemap-lastmod.py` est idempotent : seconde passe « 0 écrits,
  140 déjà justes ».

---
---

# Second lot — `ec0887fb`

## 9. Le h1 des quatre pages, et ce que la feuille de style en faisait

`contact.html`, `roi.html`, `en/contact.html`, `en/roi.html` : aucun `<h1>`,
un `<h2>` unique tenant lieu de titre de page. Le `<h2>` est promu.

### 9.1 La feuille de style attache bien du rendu au niveau de titre

**Oui, et sur six déclarations.** `styles.css` porte un sélecteur d'élément nu
pour chacun des deux niveaux :

```
h1{ font-size:clamp(34px,5vw,54px); line-height:1.1; font-weight:800;
    margin:0 0 20px; letter-spacing:-0.02em; max-width:820px; color:var(--ink); }
h2{ font-size:clamp(26px,3.4vw,34px); font-weight:800; margin:0 0 18px;
    max-width:640px; letter-spacing:-0.01em; }
```

Ce qu'une promotion nue aurait changé, mesuré à 1024 px avant toute
correction :

| déclaration | `<h2>` | `<h1>` nu | bouge ? |
|---|---|---|---|
| `font-size` | 34 px | **51,2 px** | oui |
| `line-height` | 52,7 px (hérité) | **56,32 px** (1.1) | oui |
| `letter-spacing` | −0,34 px | **−1,024 px** | oui |
| `max-width` | 640 px | **820 px** | oui |
| `margin-bottom` | 18 px | **20 px** | oui |
| `margin-left` / `right` (contact) | 164 px (auto) | **0** | oui |
| `font-weight` | 800 | 800 | non |
| `color` | `--ink-on-dark` | `--ink-on-dark` | non |

La couleur ne bouge pas parce que `body.docs-dark h1` et `body.docs-dark h2`
posent tous deux `--ink-on-dark`, et que les quatre pages portent
`<body class="docs-dark">`. Le centrage, lui, venait de
`.cta-section h2{ margin-left:auto; margin-right:auto }` et disparaissait avec
le `<h2>`.

### 9.2 La correction, et pourquoi elle ne recopie pas les valeurs

Chaque titre promu porte une classe `titre-visuel-hN` — « promu dans le plan,
rend toujours comme un `hN` ». Le sélecteur est **ajouté aux règles
existantes**, jamais recopié :

```
h2, h1.titre-visuel-h2{ font-size:clamp(26px,3.4vw,34px); ... }
.cta-section h2, .cta-section h1.titre-visuel-h2, .cta-section .section-lede{ margin:auto }
h1.titre-visuel-h2{ line-height:inherit; }
```

Une copie des valeurs aurait dérivé au premier réglage de `h2` — c'est la
raison écrite dans le commentaire au-dessus. Seule `line-height` demande une
règle propre : `h2{}` n'en déclare pas, donc `h1{ line-height:1.1 }`
s'appliquerait sans concurrent. Même geste, en sens inverse, que le
`max-width:none` payé le 4 septembre 2026 quand des `<div>` sont devenus des
`<h2>`.

### 9.3 La promotion a créé un saut de niveau, et il n'a pas été mis en dette

`tests/hierarchie-titres.test.js` est passé au rouge : `roi.html : h1 -> h3`,
dans les deux langues. La page enchaînait `h2`(titre) `h3`(panneau
hypothèses) `h4`(panneau résultats) `h3`(modale PDF) — aucun saut. Promouvoir
le seul titre donnait `h1 h3 h4 h3`, donc un saut.

Ce test porte une **dette nommée** de dix pages, et y inscrire `roi.html`
aurait suffi à le faire taire. Ça n'a pas été fait : **se servir de
l'échappatoire d'un garde pour un défaut qu'on vient d'introduire le désarme
pour les suivants.**

À la place, les deux intitulés de panneau — `.roi-inputs` et `.roi-results`
sont des **frères**, et l'un était un `h3`, l'autre un `h4` — passent tous
deux en `h2`, avec `titre-visuel-h3` et `titre-visuel-h4`. La suite devient
`h1 h2 h2 h3`. La modale reste un `h3`, ce qu'elle doit être : elle n'est pas
une section de la page.

Aucune règle `h3{}` ni `h4{}` générique n'existe dans `styles.css` — seules
`.roi-inputs h3` et `.roi-results-top h4`. Les deux sélecteurs `h2` ont été
ajoutés à ces règles, et les deux déclarations que `h2{}` apporte en plus
(`max-width`, `letter-spacing`) rendues à leur valeur d'origine.

### 9.4 La preuve : zéro écart sur 499 propriétés calculées

Le rendu n'est pas supposé identique, il est **mesuré**. Méthode : l'arbre du
worktree servi en local (`python3 -m http.server`, témoin de fraîcheur posé —
le `2015` d'`about.html`, qui n'existe que sur cette branche), et pour chaque
titre promu, un élément du **tag d'origine** injecté juste à côté de lui dans
le DOM, puis comparaison de `getComputedStyle` propriété par propriété et des
`getBoundingClientRect`.

| page | titre promu | origine | écarts / 499 | même boîte |
|---|---|---|---|---|
| `contact.html` | `h1.titre-visuel-h2` | `h2` | **0** | oui |
| `roi.html` | `h1.titre-visuel-h2` | `h2` | **0** | oui |
| `roi.html` | `h2.titre-visuel-h3` | `h3` | **0** | oui |
| `roi.html` | `h2.titre-visuel-h4` | `h4` | **0** | oui |
| `en/contact.html` | `h1.titre-visuel-h2` | `h2` | **0** | oui |
| `en/roi.html` | les trois | — | **0** | oui |

Hauteur de document, avant le lot puis après : contact 1505 → 1505,
roi 1920 → 1920, en/contact 1544 → 1544, en/roi 1896 → 1896.

**Témoin positif de l'instrument**, parce qu'un comparateur qui ne sait rien
voir rend aussi zéro : la même comparaison, la classe retirée, rend **13
écarts** (`font-size : h1=51.2px | h2=34px`, `max-width : 820px | 640px`,
`line-height`, `letter-spacing`, `margin-bottom`, et les dérivées `width`,
`height`, `transform-origin`…).

**Et la mesure vaut à toute largeur**, pas seulement à 1024 px : aucun bloc
`@media` de `styles.css` ne contient de sélecteur `h1` ou `h2` — vérifié en
parcourant les accolades, pas en relisant. Les deux niveaux ne dépendent de la
largeur que par le `clamp()` de la déclaration partagée, identique pour les
deux éléments comparés.

**Deux fois, la mesure a d'abord menti par le cache**, et c'est consigné : le
navigateur a servi l'ancien `styles.css?v=…` puis l'ancien HTML, et la lecture
annonçait `fontSize: 51.2px` — « la correction ne prend pas ». Le `?v=` de
`styles.css` a donc été bumpé (`scripts/bust-cache.sh styles.css`, 160
fichiers) et chaque page relue sous une chaîne de requête neuve. C'est le même
mécanisme que la raison d'être du `?v=`, retourné contre celui qui mesure.

---

## 10. `mesure.html` et `partners.html` : les types retenus, et les écartés

Ce sont les deux seules pages indexables sans aucun bloc JSON-LD — et aussi
les deux seules sans le bloc `Organization` de pied de page que 147 autres
portent par copie. Une page qui naît en copiant une voisine hérite de son
balisage ; celles-là sont nées autrement.

### 10.1 `mesure.html` → `TechArticle`

Ce que la page dit : un relevé de mesure. Corpus (2 821 fiches du catalogue
`public-demo`), méthode, résultat (BM25 contre Heurix), limites — « Deux
choses que cette mesure dit contre nous », « Là où nous n'apportons rien »,
« Ce que ça vaut » — et « Refaites la mesure ». Un article technique
décrivant une procédure reproductible.

**Écartés :**

- `Report` — schema.org en réserve le sens à une publication d'organisme
  (gouvernemental ou non) ;
- `ScholarlyArticle` — laisse entendre une relecture par des pairs qui n'a pas
  eu lieu ;
- `Dataset` — décrirait le **corpus**, pas la page ; et le corpus n'est pas
  publié comme jeu de données téléchargeable ;
- `BlogPosting` — la page ne vit pas dans le blog, ne porte ni kicker daté ni
  signature, et prétendrait entrer dans un périmètre
  (`schema-article.test.js`) dont elle sort.

**Aucune date n'est déclarée, et c'est le point à ne pas « combler ».** La
page date sa **mesure** — « Mesure du 2 septembre 2026 », deux fois dans le
corps — pas sa publication. Écrire cette date en `datePublished` affirmerait
ce que la page ne dit pas. Aucun autre endroit du document ne porte de date de
publication : le champ reste absent.

Au passage : votre premier relevé notait que `mesure.html` « ne publie aucune
méthodologie ». La page porte une section `<h2>La méthode</h2>` et un
protocole de reproduction. C'est le dernier point de la prémisse à tomber.

### 10.2 `partners.html` → `Service`

Ce que la page dit : un programme que Heurix propose à des agences, et dont
les conditions **ne sont pas écrites** — « elles se définiront avec celles qui
rejoindront le programme en premier ». La page énumère d'abord ce qu'elle ne
peut pas promettre (pas de certification, pas de gestionnaire d'intégration,
pas de logos), puis ce qu'il y a à la place.

**Écartés :**

- `ProgramMembership` — décrit l'**adhésion d'une personne**
  (`membershipNumber`, `programName`, `hostingOrganization`), pas le programme ;
- `Offer` / `AggregateOffer` — demanderaient un prix ou des conditions. Il n'en
  existe aucun, et la page le dit en propres termes ;
- `WebPage` — vrai, et vide de sens.

**Champs volontairement absents :** `offers` (aucun prix n'existe),
`termsOfService` (la page dit qu'ils ne sont pas écrits), `areaServed` (la
page ne nomme aucun territoire, et l'existence de la version anglaise interdit
de supposer la France), et aucun `potentialAction` / `ApplyAction` : le
formulaire de candidature n'a pas d'attribut `action`, donc il n'existe aucune
URL vers laquelle pointer. **Même raison que le `SearchAction` absent de
l'accueil** (§5.1) — un champ qui nomme une cible inexistante se lit comme une
promesse.

`inLanguage` est absent des deux blocs `Service` : ce n'est pas une propriété
de `Service` (elle appartient à `CreativeWork`). Les deux `TechArticle` la
portent.

---

## 11. `og:image` : les 19 pages, et pourquoi rien n'a été écrit

Vous demandiez une image sociale sur les pages indexables qui en manquent.
**Il n'en manque sur aucune.** Les 19 pages sans `og:image` se répartissent
ainsi, sur les 174 fichiers :

| classe | nombre | pages |
|---|---|---|
| hors site | **12** | `docs/maquettes/` (8), `demo/` (2), `en/demo/` (2) |
| `noindex` | **6** | `404.html`, `en/404.html`, `bienvenue.html`, `console.html`, `en/console.html`, `supervision.html` |
| fragment | **1** | `downloads/heurix-conversion-snippet.html` |
| **indexable** | **0** | — |

Le 19 est donc, lui aussi, un compte sur le périmètre des 174 fichiers. Sur
les 140 pages indexables : zéro. Aucune image n'a été écrite — il n'y avait
pas d'objet.

**Le garde est écrit quand même**, et sa raison est mesurable plutôt que
prudentielle : les 19 ci-dessus montrent qu'une page peut naître sans
`og:image` dans ce dépôt, et les pages se créent par copie d'une voisine qui
n'est jamais la meilleure — huit propagations en une semaine en août 2026,
documentées dans `entete-structure.test.js`. Un garde posé sur une population
saine garde la prochaine naissance.

---

## 12. Le bloc `Organization` : 23 variantes, et de quoi le lot d'unification est fait

Vous le lancerez vous-même ; voici de quoi le chiffrer. Mesuré sur `ec0887fb` :
**147 occurrences, 23 variantes distinctes** (22 sur `441d2746` — l'ajout de
l'`identifier` SIRET sur deux pages a formé une variante de plus et vidé
d'autant celle dont elles venaient).

La référence est la variante **la plus répandue**, 58 pages, dont
`en/404.html`. Ses champs : `@context`, `@type`, `name`, `url`, `logo`,
`image`, `description`, `email`, `sameAs`, `founder`, `areaServed`.

| # | pages | exemple | ce qui la distingue de la référence |
|---|---|---|---|
| 1 | **58** | `en/404.html` | *la référence* |
| 2 | **44** | `blog/agent-ia-catalogue-technique.html` | `description` en **français** |
| 3 | **17** | `blog.html` | `description` en français **+ `knowsAbout`** |
| 4 | **4** | `integrations.html` | **ni `description` ni `image`** |
| 5 | **2** | `about.html`, `index.html` | français + `knowsAbout` + **`identifier` SIRET** (ce lot) |
| 6 | 2 | `en/solutions/automobile.html` | français + `image` = la photo du secteur |
| 7 | 2 | `en/solutions/electricite.html` | idem, autre photo |
| 8 | 2 | `en/solutions/plomberie.html` | idem |
| 9 | 2 | `en/solutions/sport.html` | idem |
| 10 | 1 | `en/blog/mise-en-avant-bundles-packs.html` | **une TROISIÈME rédaction anglaise** de `description` |
| 11 | 1 | `en/pricing.html` | `knowsAbout` seul (description de référence) |
| 12–17 | 1 chacune | `en/solutions/{electronique,finance,industrie,livres,mode,outillage}.html` | `image` = photo du secteur, description de référence |
| 18–23 | 1 chacune | `solutions/{electronique,finance,industrie,livres,mode,outillage}.html` | français + `image` = photo du secteur |

**Les 23 variantes se réduisent à cinq axes**, et c'est ça qui rend le lot
chiffrable. Comptes exacts sur les 147 blocs :

1. **`description`** — 77 en français, 65 dans la rédaction anglaise de
   référence, **1 dans une troisième rédaction anglaise**
   (`en/blog/mise-en-avant-bundles-packs.html`), 4 absentes. Total 147.
2. **`knowsAbout`** — présent sur **20** blocs, absent sur **127**.
3. **`image`** — `og-image.png` sur **123**, photo de secteur sur **20**,
   absente sur **4**.
4. **`description` et `image` absentes toutes deux** — **4** pages
   (variante 4).
5. **`identifier` SIRET** — **2** pages, `index.html` et `about.html` (ce
   lot, à étendre ou non).

**Un défaut nommable sort de l'axe 1 :** quatre pages ANGLAISES servent la
description française —
`en/solutions/{automobile, electricite, plomberie, sport}.html`. Ce sont les
quatre secteurs dont les versions FR et EN partagent un bloc identique
(variantes 6 à 9) ; les six autres secteurs ont bien deux blocs, un par
langue. Ce sont donc les quatre seules pages anglaises du site à décrire
Heurix en français à un robot.

Donc : **trois décisions** (une description par langue, `knowsAbout` oui ou
non, la photo de secteur oui ou non), **147 pages** à aligner dont les 4 de la
variante 4 à compléter, et **4 pages à corriger de langue** quoi qu'il soit
décidé. Le témoin de ce lot-là s'écrit en une phrase : *tout bloc
`Organization` est identique à la référence de SA LANGUE, à l'`image` près sur
les pages sectorielles* — et il doit porter son propre plancher, sinon il
sortira vert le jour où le balayage ne trouvera plus de bloc.

**Rien n'a été unifié dans ce lot**, et l'`identifier` reste sur les deux
pages où il a été posé.

---

## 13. Les trois gardes par absence

`tests/pages-indexables.js` porte la définition du périmètre, partagée par les
trois — trois définitions écrites séparément auraient dérivé l'une de l'autre.
Elle est reprise mot pour mot de `canonical.test.js` et n'énumère aucun
dossier. Le module lit `git ls-files` et non le disque, pour la raison que
`surface-publiee.js` donne déjà : un balayage du disque fait tomber les tests
sur les harnais temporaires des sessions voisines — arrivé à
`canonical.test.js` le 28 août 2026.

Chacun des trois porte, dans son propre fichier, **deux assertions de
périmètre** : « le périmètre n'est pas vide » et « le périmètre ne tombe pas
sous les 140 pages indexables du 20 octobre 2026 ». Elles ne disent pas la
même chose : la première attrape le balayage cassé, la seconde le périmètre
qui maigrit sans qu'on le dise. Le plancher est **égal** à la mesure, pas
en dessous : une page retirée du site fait rougir les trois.

### 13.1 `tests/titre-h1.test.js` — ce qu'il ne voit pas

1. Il compte une **balise**, pas un titre. Un `<h1>` vide, un `<h1>` qui ne
   contient qu'une image sans `alt`, un `<h1>` dont le texte n'a rien à voir
   avec la page : tous le satisfont.
2. Il ne dit rien du **rendu**. Si `titre-visuel-h2` disparaissait de
   `styles.css`, le titre des quatre pages corrigées doublerait de taille à
   l'écran et ce garde resterait vert. La preuve de la §9.4 a été faite **à la
   main, dans un navigateur** : aucun test de ce dépôt ne compare un rendu.
3. Il ne regarde pas l'**ordre** : un `<h1>` placé après un `<h2>` lui
   convient. C'est `hierarchie-titres.test.js` qui lit la séquence, et lui ne
   compte pas les `<h1>`.

### 13.2 `tests/jsonld-present.test.js` — ce qu'il ne voit pas

1. Il compte **un** bloc, n'importe lequel. Une page dont le seul balisage est
   l'`Organization` du pied de page le satisfait, alors qu'elle ne déclare rien
   de ce qu'elle est.
2. Il ne juge aucun **type**. Rien n'exige qu'un article porte un
   `BlogPosting`, ni que le type choisi décrive honnêtement la page : le
   `TechArticle` et le `Service` de la §10 ont été justifiés à la main.
3. Il ne voit pas les pages **non indexables**. `console.html`, les CGV
   archivées et les maquettes n'ont aucun balisage, et c'est assumé.

La différence avec `jsonld-blocs.test.js`, écrit le même jour : celui-là juge
les blocs **présents** (chacun se décode, porte `@context` et `@type`) ;
celui-ci juge leur **absence**. Un garde sur les blocs présents ne peut pas
voir une page qui n'en a aucun — elle sort de son périmètre sans un mot. C'est
exactement le motif du défaut hreflang de la §6.3.

### 13.3 `tests/og-image.test.js` — ce qu'il ne voit pas

1. Il ne va **pas chercher** l'image. Il vérifie que le fichier existe dans le
   dépôt quand l'URL est locale, et rien de plus : ni poids, ni dimensions, ni
   que l'image soit lisible. Une `og:image` de 10 octets le satisfait, et les
   réseaux sociaux la refuseraient.
2. Il ne juge pas la **pertinence** : **120** des 140 pages indexables
   déclarent la même `og-image.png` générique, et les 20 autres la photo de
   leur secteur. Ce garde ne distingue pas les deux cas, et ne saurait pas
   dire qu'une page sectorielle a perdu sa photo pour l'image générique.
3. Il ignore `twitter:image` et `og:image:width`, que certaines pages portent
   et d'autres non. Aucun garde ne les couvre.

### 13.4 Vers quoi aucun des trois n'a jamais été pointé

- **Le rendu.** Les trois lisent du texte de fichier. Aucun n'ouvre un
  navigateur, aucun ne compare un pixel, et les trois resteraient verts si la
  feuille de style cassait l'apparence des titres qu'ils garantissent exister.
- **La page servie.** Comme les témoins du premier lot, ils lisent le dépôt.
  Le site publié n'est lu par aucun test.
- **Le sens.** Un `h1` qui ne titre rien, un bloc JSON-LD qui décrit une autre
  page, une `og:image` qui montre autre chose : les trois passent. Ils
  garantissent une **présence**, jamais une justesse.
- **Les 34 pages hors périmètre.** Le fragment, les 12 pages hors site et les
  21 `noindex` ne sont vus par aucun des trois. Si l'une d'elles redevenait
  indexable sans balisage, elle entrerait dans le périmètre et serait alors
  vue — mais rien ne surveille le chemin inverse, une page importante passée
  en `noindex` par erreur : elle **sortirait** du périmètre, les trois
  plancher rougiraient (139 < 140), et c'est le seul signal.

---

## 14. Mutations du second lot

Sept mutations, chacune sur un arbre propre, avec **le témoin de la mutation
elle-même** : le nombre de fichiers que `git status` voit changer est compté et
affiché **avant** de lire la couleur, et une mutation à zéro fichier est un
échec du pilote, pas un vert du garde. Le pilote vérifie aussi que les tests
visés sont **verts avant** la mutation. Toutes les variables de shell sont
quotées, et les listes de fichiers passent par un fichier.

| # | mutation | fichiers mutés | verdict | message |
|---|---|---|---|---|
| 1 | le `<h1>` de `produit.html` devient un `<div>` | 1 | 1 échec | `['produit.html']` |
| 2 | un **second** `<h1>` ajouté à `produit.html` | 1 | 1 échec | `produit.html : 2 h1` |
| 3 | le seul bloc JSON-LD de `mesure.html` retiré | 1 | 1 échec | `['mesure.html']` |
| 4 | l'`og:image` de `partners.html` retirée | 1 | 2 échecs | `['partners.html']` **et** `139 >= 140` |
| 5 | l'`og:image` pointée vers un fichier absent | 1 | 1 échec | `partners.html -> og-image-disparue.png` |
| 6 | `secteurs.html` passée en `noindex` | 1 | **4 échecs** | les quatre planchers : `139 >= 140` |
| 7 | **les 140 pages** passées en `noindex` | **140** | **7 échecs** | `0 > 0` et `0 >= 140`, trois fois |

**La mutation 7 est la démonstration demandée.** Périmètre à zéro : les trois
assertions « le périmètre n'est pas vide », les trois planchers et le plancher
des `og:image` locales rougissent — et les **quatre assertions de fond**
(« aucune page sans h1 », « aucune avec plus d'un h1 », « chaque page porte un
bloc », « chaque page déclare une og:image ») sortent **VERTES sur zéro
page**. C'est 4 passed / 7 failed. Sans les assertions de périmètre, ce
serait 4 passed / 0 failed : un garde entièrement vert sur un site dont plus
une seule page n'est inspectée.

**Et le plancher du sitemap a mordu sur son auteur, pendant ce lot.** Après
`scripts/bust-cache.sh styles.css`, les 160 fichiers HTML étaient modifiés,
donc tous « sales », donc tous exclus de la comparaison `<lastmod>` ↔ `git
log` — et `expect(compares).toBeGreaterThanOrEqual(100)` est tombé sur
`expected 0 to be greater than or equal to 100`. Le garde comparait zéro
fichier et l'a dit. C'est exactement ce pour quoi ce plancher avait été
écrit la veille, et il n'avait jamais été vu rouge avant.

**Une mutation a d'abord rendu un rouge qui ne venait pas de l'objet** (n° 6,
premier essai) : le pilote passait trois chemins de test en **une seule chaîne
quotée**, `vitest` n'a trouvé aucun fichier et a sorti 1. Le pilote l'a lu
comme « le témoin a mordu ». Ce qui l'a démasqué est la **restauration, rouge
elle aussi** — un garde qui rougit sur l'arbre remis en état ne rougit pas sur
la mutation. Les chemins sont désormais des arguments séparés, et le pilote
exige le vert avant de muter. C'est le pendant exact de la mutation muette du
premier lot : là la mutation n'avait pas pris et le vert mentait ; ici
l'instrument échouait et le rouge mentait.

---

## 15. État du second lot

- `npx vitest run` : **104 fichiers, 1115 tests, tous verts** (1104 après le
  premier lot ; 11 assertions ajoutées).
- `scripts/index-recherche.py --verifier` : à jour, 140 pages. Les
  changements de balise de titre et les quatre blocs JSON-LD neufs ne
  changent aucune empreinte de contenu indexable — vérifié, pas supposé.
- `scripts/sitemap-lastmod.py` relancé : les 140 `<lastmod>` portent la date
  du commit qui a touché leur fichier.
- `styles.css` : `?v=` bumpé par `scripts/bust-cache.sh`, propagé dans 160
  fichiers. C'est le prix d'une modification de la feuille de style dans ce
  dépôt, et le job « Clefs de cache a jour » de la CI l'exige.
- `pricing.html` et `en/pricing.html` : absentes du diff des deux lots.
