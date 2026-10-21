# Un article pour le dirigeant, pas pour le praticien — relevé du 21 octobre 2026

Branche `article-dirigeant-moteurs-reponse-20oct`, worktree
`~/wt/article-dirigeant-20oct`, partie de `origin/main` à **`b6ac8317`**
(« Trois articles sectoriels », fusionné le 20 au soir).

**LE LOT ENJAMBE MINUIT, ET LES DEUX DATES SONT VRAIES.** Toutes les mesures
de ce relevé ont été prises le **20 octobre 2026** entre 23:00 et 23:55, et
l'article les date ainsi. Le lot, lui, est écrit et commité le **21 après
minuit** : `datePublished` vaut `2026-10-21T00:30:00+02:00`, et
`scripts/sitemap-lastmod.py` a posé `2026-10-21` sur les quatre pages que le
lot touche — il lit la date du commit, pas celle de la mesure. Le nom de
`docs/mesures/fiches-tierces-2026-10-20/` garde la date de la **lecture**,
qui est ce qu'il faut pouvoir rejouer.

Trois worktrees voisins du même dépôt portaient la date du jour à l'ouverture
de la session — `articles-secteurs-20oct`, `balisage-site-20oct`,
`titles-courts-20oct`. **Les trois sont fusionnés dans `origin/main`**
(`merge-base --is-ancestor` sur chacun), aucun lot n'était en vol, et aucune
session ne tournait (`list_sessions` : zéro `isRunning`). Le gabarit et les
comptes de ce relevé sont donc ceux d'après leur atterrissage.

Mesure du soir : **51 articles français, 37 anglais**. La consigne du lot
disait 48 et 43 : les trois articles sectoriels de ce soir sont passés entre
les deux.

---

## 1. Les six questions de dirigeant, une par section

Dans ses mots, et dans l'ordre de la page.

| h2 de la page | la question à laquelle il répond |
|---|---|
| Ce qui a changé sans vous demander votre avis | « Est-ce que ça me concerne vraiment, ou c'est encore une mode ? » |
| Ce qu'une machine trouve sur une fiche produit | « Ma fiche produit, qu'est-ce qu'une machine y lit au juste ? » |
| Ce qu'elle ne trouve pas, et rien ne le lui dit | « Et qu'est-ce qui lui manque, sans que je le sache ? » |
| Ce qu'un assistant peut demander | « Si je branche une IA sur mon catalogue, qu'est-ce qu'elle peut en faire ? » |
| Quatre gestes, et aucun ne coûte un euro de publicité | « Concrètement, qu'est-ce que je fais lundi matin ? » |
| Pourquoi cette page ne répond pas à son titre | « Et au fait, qu'est-ce qu'elle répond aujourd'hui sur MES produits ? » |

La dernière est celle du titre de travail, et **la page répond qu'elle ne sait
pas** — voir le point 4.

---

## 2. Ce que le serveur MCP expose vraiment, et ce qu'il n'expose pas

Lu dans le code, pas dans la documentation : `heurix-mcp-server`, `server.py`,
dépôt à **`42a6317`**, version **0.1.2** (`pyproject.toml:14`). L'article
voisin `blog/agent-ia-catalogue-technique.html` mesurait la 0.1.0 et décrivait
les textes de la 0.1.1 ; **la 0.1.2 ne change ni les outils ni leurs
paramètres** — son seul apport est de retirer la clé `default` du schéma
publié, parce que Claude.app refusait tout appel qui omettait un paramètre
qui en portait une.

### Les trois outils, et ce qu'ils relaient

| outil | paramètres transmis | appel relayé |
|---|---|---|
| `heurix_catalog_stats` | `catalog` (facultatif) | `GET /v1/index/catalogs`, ou `GET /v1/index/{c}/stats` **puis** `/browse-categories` |
| `heurix_search` | `catalog`, `query`, `filters`, `limit` | `POST /v1/index/{c}/search` |
| `heurix_browse` | `catalog`, `category`, `sort`, `limit` | `GET /v1/browse/{c}/{category}` |

Aucune logique propre : le serveur borne `limit` entre 1 et 100, remplace
`filters` absent par une liste vide, et rend les erreurs de l'API en clair
(`_handle_response`) plutôt qu'une exception opaque.

### Ce qu'un agent obtient

- **Par `stats`** : les noms des catalogues de la clé, le nombre de produits,
  le nombre de termes, le **nombre** d'annotations, le pack actif, et les
  catégories Browse avec leur compte.
- **Par `search`** : le produit tel qu'indexé (description comprise), le
  score, `in_stock`, `pinned`, `buried`, `total`, les jetons de la requête, et
  `matched` — la raison du résultat, **coupée à 8 entrées**, et seulement ce
  qui a compté pour ce résultat.

### Ce qu'il n'obtient pas

**Les deux listes dont il aurait besoin pour filtrer juste.** Les noms de
champs du catalogue avec leurs valeurs, et les annotations que le pack écrit.
Aucun des trois outils ne les rend ; les instructions du serveur le disent et
renvoient l'agent les lire dans une première recherche, ce qui est partiel par
construction (une recherche ne montre que les valeurs des produits qu'elle
rend, et `matched` s'arrête à 8). Les deux routes qui en portent une vue —
`GET /v1/index/{c}/browse-attributes` et `GET /v1/rulepacks/annotations` — ne
sont appelées par aucun outil.

**Quatorze des dix-sept réglages de la recherche.** `SearchBody`
(`heurix/models.py:149`) déclare **17 champs** ; l'outil en transmet **3**
(`q`, `filters`, `limit`). Les quatorze absents : `offset`, `facets`,
`in_stock_only`, `lang`, `exclude_description`, `include_highlights`,
`group_by`, `ids_only`, `id_field`, `visitor_id`, `lat`, `lon`, `radius_km`,
`simulate_overrides` (ce dernier réservé aux clés serveur).

Conséquences lisibles par un dirigeant : un agent **ne peut pas** tourner la
page, demander le décompte des valeurs d'une facette, écarter les ruptures,
chercher dans une langue, ni chercher autour d'un point de vente.

**Et il ne peut rien écrire.** Les trois outils sont deux `GET` et un `POST`
de recherche. Aucune route d'indexation, de panier, de commande ou de prix.
Il montre, il ne vend pas.

**Deux silences à connaître**, les deux dans le code : une catégorie mal
orthographiée rend une liste vide **sans erreur**, et une valeur inconnue sur
un champ connu rend `total: 0` **sans signal** — le moteur vérifie le nom du
champ, jamais la valeur. Un champ ou une annotation inconnus, eux, sont
listés dans `filters_unknown`.

**L'article ne nomme pas le serveur comme produit.** Il s'appuie dessus en
disant « nos propres outils de catalogue », et il cite les trois demandes, les
huit entrées de `matched` et le 3-sur-17.

---

## 3. Les fiches produit tierces

Relevé complet, instrument compris :
`docs/mesures/fiches-tierces-2026-10-20/RELEVE.md`. En deux lignes : **cinq
fiches lues sur six sites**, balisage produit 5/5, prix avec sa monnaie 5/5,
disponibilité 5/5, référence dans un champ 4/5, référence présente aussi dans
le nom du produit **0/5**. Un échec consigné (timeout sur la fiche du sixième
site), aucun `Disallow` rencontré, rien contourné, 66 requêtes en quatre
passes à ≥ 1 s d'intervalle.

Ce que je **n'ai pas** pu mesurer est écrit là-bas : ce qui s'affiche après
l'ouverture de la page (aucun script exécuté), les prix de compte
professionnel, la représentativité, et ce que les moteurs de réponse font
réellement de ces pages.

**Deux défauts de mon propre instrument ont été trouvés en cours de mesure**,
et le premier avait déjà produit un tableau faux : une racine de rayon
(`/boutique/`) prise pour une fiche, qui faisait écrire « 4 sur 5 » au balisage
produit. Détail là-bas aussi.

---

## 4. Le moteur de réponse : NON MESURÉ, et pourquoi

**Je n'ai interrogé aucun moteur de réponse.** Aucune phrase de l'article ne
dit ce qu'un moteur répond, et la dernière section le déclare au lecteur.

Les deux raisons, dans l'ordre où elles mordent :

1. **Une réponse n'est pas reproductible.** Même question, deux tirages, deux
   textes. Une capture ne porte que sur l'instant où elle est prise, et le
   lot exige qu'une affirmation sur une réponse soit datée *et* accompagnée de
   la question exacte — ce qui donnerait une anecdote datée, pas une mesure.
2. **Les instruments disponibles sortent de la règle de lecture d'un site
   tiers.** Elle exige un user-agent qui identifie Heurix avec une adresse de
   contact, et le respect du `robots.txt`. Une interface de conversation est
   une application derrière un compte : le navigateur intégré y arriverait
   avec son propre user-agent et la session de l'utilisateur. **Changer
   d'instrument pour obtenir la page est une décision à rendre, pas à
   prendre** — c'est la leçon du 403 d'`addons.prestashop.com` du 13 octobre.

Ce que j'ai fait à la place, et qui est de la même famille sans être la même
chose : mesurer **ce que ces lecteurs ont le droit de lire** sur les six
`robots.txt`, et ce que la page leur donne. C'est à votre main ; leur réponse
ne l'est pas.

---

## 5. Ce que le témoin de registre ne voit pas

`tests/registre-dirigeant-20oct.test.js`, 9 assertions. Il refuse les
quatorze termes de la consigne dans le **corps éditorial** des deux pages
(du `<h1>` au bloc d'appel à l'action), sauf un terme admis dont la **phrase
de définition est recopiée verbatim dans le test** : retirer la définition
rougit, déplacer le terme dans une seconde phrase rougit.

Le périmètre n'est pas la page, et c'est mesuré : la barre de navigation
annonce « Cascade d'annotations… » et le pied porte « Documentation API » sur
les 148 pages du site. Juger la page entière rendrait le témoin rouge sur un
article irréprochable.

**Les cinq choses qu'il ne voit pas** — elles sont dans l'en-tête du fichier,
et c'est votre relecture qui tranche :

1. **Un texte abstrait qui évite les mots sans parler à personne.** « Une
   solution permet d'optimiser la visibilité de votre offre » passe au vert.
   C'est le trou principal, et il est structurel : le témoin est une liste de
   mots, pas un juge de registre.
2. **Le jargon du métier du lecteur** plutôt que du nôtre : EBITDA, BFR,
   rotation de stock, marge arrière. Peut-être juste ici, absent de la liste.
3. **Un synonyme du terme interdit** : « recherche par similarité » pour
   vectoriel, « modèle de langage » pour plongement.
4. **Une définition fausse ou incompréhensible.** L'assertion vérifie que la
   phrase porte la définition *écrite*, jamais qu'elle est juste.
5. **Le ton.** Une phrase de soixante mots à trois subordonnées passe.

### Les mutations, huit, toutes attrapées

Vert exigé avant chaque mutation, vert vérifié après chaque restauration.

| mutation | verdict |
|---|---|
| « indexation » ajouté dans une phrase du corps | rouge |
| définition retirée de la phrase du terme admis | rouge |
| terme admis déplacé dans une seconde phrase | rouge |
| septième `h2` | rouge |
| `</article>` de trop | rouge |
| corps gonflé à 960 mots | rouge |
| `LOT` vidé (plancher) | rouge |
| `corpsEditorial` rendu introuvable (plancher) | rouge |

---

## 6. Les témoins habituels

- **Les deux langues** : `blog/` et `en/blog/`, même slug, hreflang `fr`, `en`
  et `x-default` réciproques des deux côtés.
- **Les deux index** : une carte dans `blog.html` et dans `en/blog.html`, en
  tête des articles d'octobre. `articles-secteurs-20oct.test.js` vérifie
  qu'aucun article n'est orphelin de l'index de sa langue — il couvre donc
  déjà celui-ci.
- **Le sitemap** : deux entrées, `lastmod` posé par `scripts/sitemap-lastmod.py`
  (148 blocs `<url>`, 4 réécrits : les deux pages neuves et les deux index).
- **`datePublished`** : `2026-10-21T00:30:00+02:00`, le même instant dans les
  deux langues, et le mois du kicker « Octobre 2026 » / « October 2026 ».
- **`PLANCHER`** de `tests/pages-indexables.js` : **146 → 148**, avec sa date.
  C'est le seul geste que demande l'ajout de deux pages.
- **Le `<title>`** : 59 caractères en français, 56 en anglais, distincts du
  `<h1>` dans les deux langues, et le `headline` du `BlogPosting` **est** le
  `h1` (exigé par `schema-article.test.js`).

Longueur : **915 mots** éditoriaux en français, **913** en anglais, `h1` et
tableau compris, navigation et pied exclus — comptés par le témoin lui-même.

**Le plafond du témoin est passé de 900 à 920 le 21 octobre, et le dire fait
partie du lot.** La consigne disait « 700 à 900 mots » et l'article tenait à
893 dans les deux langues. La phrase de pont demandée ensuite — voir le point
8 — le porte à 915 et 913. Le plafond suit la demande qui l'a débordé, avec sa
date dans le fichier du témoin ; il reste serré, à cinq mots du français, donc
une seconde phrase ajoutée sans y penser rougit.

---

## 7. Trois décisions à valider, et une à signaler

**(a) ~~Aucun nom de marque dans l'article~~ — TRANCHÉ LE 21 OCTOBRE, EN SENS
INVERSE.** J'avais lu « aucun nom d'entreprise tierce dans l'article, même en
exemple favorable » comme couvrant le sujet de l'article, et écrit un `h1` qui
disait « une IA ». Alexis a reborné la consigne : elle visait les
**distributeurs dont les pages ont été mesurées**, pas le sujet — et le blog
nomme déjà Algolia, Typesense et Elasticsearch dans ses titres.

Le titre de travail est donc rétabli : `h1` et `headline` valent
« Vos clients demandent vos produits à ChatGPT. Que répond-il ? », le
`<title>` « Vos clients interrogent ChatGPT sur vos produits — Heurix »
(57 caractères), et les deux cartes d'index portent le `h1`. **Le corps n'a
pas bougé** : cinq lignes par page, toutes dans la tête ou le `h1` (le
`<title>` se propage à `og:title` et `twitter:title`).

**Ce que le nom change à la dernière section, et c'est un gain.** Tant que le
`h1` disait « ce qu'elle lit de votre catalogue », il ne posait aucune
question que la page refusait de traiter : le `h2` « Pourquoi cette page ne
répond pas à son titre » était donc **légèrement faux**, la page répondant
très bien au sien. Avec « Que répond-il ? » rétabli, le `h1` pose la question
et la dernière section en est la réponse honnête. Le refus cesse d'être une
réserve ajoutée en fin de page pour devenir la chute de l'accroche.

Ce qui reste à surveiller, et qui est du ressort de votre relecture : une
question posée au `h1` et déclinée en fin de page peut se lire comme un
appât. Ce qui l'en empêche est la **troisième phrase du chapô** — « Voici ce
que cinq fiches de distributeurs français donnaient à lire le 20 octobre
2026 » — qui annonce le livrable réel dans les soixante premiers mots. Et le
corps ne nomme jamais ChatGPT : l'accroche nomme l'instance que le lecteur
connaît, le corps généralise à tout lecteur automatique, ce que la mesure des
dix robots sur les six `robots.txt` couvre.

Les seules marques du lot restent donc celles-là. **Aucun distributeur mesuré
n'est nommé**, ni dans l'article, ni dans le relevé versionné.

**(b) Pas de `BreadcrumbList`, et ce n'est pas un oubli.** La consigne
demandait « son fil d'Ariane ». Le dépôt a tranché l'inverse le 4 septembre
2026, et `tests/schema-fil-et-produit.test.js` porte la raison dans son
en-tête : **aucun des 88 articles ne porte de fil visible**, ils portent un
lien de retour « ← Tous les articles » ; le périmètre du garde est la présence
du `nav.breadcrumb`, précisément pour empêcher de déclarer aux machines une
hiérarchie que personne ne voit. Les 24 pages `solutions/` en ont un, visible
et déclaré. J'ai suivi le gabarit des articles. **Donner un vrai fil aux
articles est un lot à part** : il touche 88 pages, pas une.

**(c) Les six domaines tiers ne sont pas écrits dans le dépôt.** Il est
public ; le relevé porte un jugement sur des sites tiers. Ils sont dans le
compte rendu de session et dans le dépôt privé. Se défait en un commit.

**À signaler, et hors de ce lot : les six pages des trois articles sectoriels
de ce soir portent un `</article>` de trop** — une ouverture, deux
fermetures — et aucun garde du dépôt ne le voit. C'est le gabarit que ce lot a
recopié, et mes deux pages sont nettes (le témoin l'exige). Je n'ai pas touché
aux six, la consigne interdisant de modifier un article existant.


---

## 8. La phrase de pont entre le titre et le corps (21 octobre 2026)

Le `h1` nomme ChatGPT, le corps ne le reprenait **jamais** : une seule
occurrence dans tout le corps éditorial, celle du `h1` lui-même. Le lecteur
devait deviner que « un assistant conversationnel », « un lecteur
automatique » et « un moteur de réponse » recouvraient le nom de l'accroche.
Alexis a demandé une phrase, pas un paragraphe, à l'endroit du passage.

**Vérifié avant d'écrire, pour ne pas doubler** : le corps portait déjà le
*chiffre* — « aucun ne nomme un seul des dix lecteurs automatiques testés » —
mais **pas le pont**. Rien ne disait que ChatGPT n'était qu'un cas. La phrase
est donc neuve, et elle est posée en fin de chapô, où « ce qui suit » désigne
exactement ce qu'elle borne.

> ChatGPT n'est qu'un exemple : ce qui suit vaut pour tous les lecteurs
> automatiques, et la mesure ci-dessous en a testé dix.

> ChatGPT is only one example: what follows holds for every automated reader,
> and the measurement below tested ten of them.

**LA FORMULATION PROPOSÉE DISAIT L'INVERSE DE LA MESURE, ET C'EST LA SEULE
RAISON POUR LAQUELLE ELLE N'A PAS ÉTÉ RECOPIÉE.** Le brouillon disait « nous
en avons **relevé** dix sur les six `robots.txt` mesurés ». *Relever* dix
lecteurs **sur** ces fichiers affirme qu'ils y figurent — or la mesure dit
exactement le contraire : **aucun des six ne nomme un seul des dix**. Les dix
sont une liste que *nous* avons soumise aux six fichiers, pas une récolte
faite dedans. La phrase écrite dit donc « en a **testé** dix », et le `:` la
rattache à la mesure qui suit plutôt qu'aux fichiers.

C'est le même défaut que [[robots-nomme-n-est-pas-autorise]] pris par l'autre
bout : une phrase vraie sur le nombre, fausse sur ce que le nombre compte.

**Le chiffre apparaît maintenant deux fois**, à quatre phrases d'écart : dans
le chapô (« en a testé dix ») et dans la mesure (« aucun ne nomme un seul des
dix lecteurs automatiques testés »). Ce n'est pas une redite mais une pose et
sa chute — le premier annonce la population, le second dit ce qu'on y a
trouvé. Retirer l'un des deux affaiblirait l'autre : sans le chapô le pont
disparaît, sans la mesure le chiffre perd son protocole et sa date.
