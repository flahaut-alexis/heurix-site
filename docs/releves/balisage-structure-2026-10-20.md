# Balisage structuré, hreflang et lastmod — relevé du 20 octobre 2026

Branche `balisage-structure-20oct`, worktree `~/wt/balisage-site-20oct`,
partie de `origin/main` à `441d2746`. Lot à `1abd13b2`, 24 fichiers.

---

## 1. La prémisse du lot est contredite par la mesure

Le lot partait de : « le site n'a aucun balisage structuré et aucune
déclaration de langue ». **C'est faux, dans le dépôt comme en production.**

Mesuré sur `origin/main` 441d2746, 163 pages de site (fichiers `.html` suivis
portant un `<html>`, hors `tests/`, `docs/`, `demo/`, `downloads/`) :

| | pages |
|---|---|
| au moins un bloc JSON-LD | **147 / 163** |
| au moins un `hreflang` | **156 / 163** |
| un `rel="canonical"` | 158 / 163 |
| un `<html lang="…">` | **163 / 163** |

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

### 2.1 Fichiers HTML et sitemap

| | |
|---|---|
| `.html` suivis | **174** |
| dont pages (avec `<html>`) hors `tests/ docs/ demo/ downloads/` | 163 |
| dont indexables (sans `noindex`) | **140** |
| `<loc>` du sitemap | **140** |
| URL du sitemap sans fichier | **0** |
| pages indexables absentes du sitemap | **0** |
| URL du sitemap qui ne sont pas indexables | **0** |
| `<loc>` en double | 0 |

**Aucune page orpheline, dans aucun sens.** Ce n'est pas un hasard :
`tests/canonical.test.js` l'exige depuis le 27 août 2026 (« aucune page
indexable n'est absente du sitemap », « chaque URL déclarée correspond à un
fichier qui existe »). L'écart entre 174 et 140 se décompose en 23 pages
`noindex` du site, 8 maquettes de `docs/`, 2 pages de la boutique de démo, et
1 fragment de `downloads/` (sans `<html>`, refusé par `robots.txt`).

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
