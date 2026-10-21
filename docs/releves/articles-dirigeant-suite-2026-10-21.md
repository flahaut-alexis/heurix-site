# Deux articles dirigeant : refonte et concurrent — relevé du 21 octobre 2026

Branche `articles-dirigeant-refonte-concurrent-21oct`, worktree
`~/wt/articles-dirigeant-21oct`.

---

## 0. LE POINT DE DÉPART A CHANGÉ PENDANT LE LOT, ET LE CHIFFRE DU PLANCHER AUSSI

Base : **`978b61da`** (`origin/main` au 21 octobre 19:50), vérifié avant
d'écrire une ligne.

Le prompt disait « au départ de main », et au moment où je l'ai lu c'était
impossible : `origin/main` valait alors `b6ac8317`, qui ne portait **ni**
l'article modèle `blog/ce-qu-une-ia-lit-de-vos-fiches-produit.html` **ni**
`tests/registre-dirigeant-20oct.test.js` — les deux exigences centrales du
lot. J'avais donc branché sur `5d8e9e10`, la branche non fusionnée qui les
portait, en le signalant.

**Quatre lots ont été fusionnés entre-temps**, dont l'article dirigeant
(`485caee6`) et le garde d'équilibre des balises `<article>` (`7db6377c`).
`5d8e9e10` est désormais un ancêtre de `origin/main` : la branche a été
**rebasée sur `978b61da`** avant le commit, et elle ne porte plus que ce
lot-ci. Mesuré : entre `5d8e9e10` et `978b61da`, le seul fichier que ce lot
touche qui ait bougé est `sitemap.xml` (correction de `lastmod` sur six
pages) — ni le témoin, ni `pages-indexables.js`, ni les deux index.

### L'écart sur le plancher : 152 et non 150

Les trois comptes de `978b61da` s'accordent, mesurés et non lus :

| grandeur, sur `978b61da` | valeur |
|---|---|
| `export const PLANCHER` | **148** |
| `<loc>` du `sitemap.xml` | **148** |
| pages indexables réelles (`<html>` sans `noindex`, sur les fichiers suivis) | **148** |

L'addendum annonçait 150 en sortie. **Je mesure 152, et l'écart est de
deux.** Il vient d'un comptage en articles et non en pages : **deux articles
font quatre pages**, chacun vivant en français et en anglais, comme le lot
le demande. 148 + 4 = 152, pour le plancher comme pour le sitemap.

À 150, deux pages — les deux anglaises — seraient restées hors de tout
plancher et hors du sitemap, et **aucun témoin ne l'aurait dit** : les neuf
assertions qui lisent `PLANCHER` sont toutes en `toBeGreaterThanOrEqual`, et
`scripts/sitemap-lastmod.py` ne corrige que des dates, il n'ajoute aucune
URL. C'est exactement le mécanisme que l'addendum décrit, appliqué une
seconde fois.

La raison est écrite au-dessus de la constante, datée, avec le pas de quatre
et la raison pour laquelle il n'est pas de deux.

**Et la sortie la plus dangereuse était la troisième**, celle qui gardait 150
en livrant les quatre pages. Elle avait l'air d'une approximation à deux
près ; c'en est une autre chose. **Un plancher posé sous son effectif mesuré
cesse définitivement d'attraper la disparition** du nombre de pages qui les
sépare — ici deux — et il le fait sans bruit, les neuf assertions restant
vertes. Un plancher se relève, ou il ne sert plus à rien. La phrase est
maintenant dans `tests/pages-indexables.js`, au-dessus de la constante, et
non seulement ici.

## 1. Les six questions de dirigeant, par article

### « Non, vous n'avez pas besoin de refaire votre site »

| h2 | la question, dans ses mots |
|---|---|
| Ce qui change dans votre boutique | « Concrètement, qu'est-ce qu'on touche chez moi ? » |
| Ce que votre thème doit porter | « Est-ce que mon thème va tenir le coup ? » |
| Si le moteur ne répond pas | « Et si votre service tombe, je perds ma recherche ? » |
| Ce que le code ne fait pas à votre place | « Qu'est-ce qui reste à ma charge, du coup ? » |
| Et si vous ne voulez pas de connecteur du tout | « Et si je veux faire ça proprement, sans rustine ? » |
| Ce que nous n'avons pas mesuré | « Bon, et ça me prend combien de temps ? » |

### « Le site de votre concurrent est-il meilleur, ou juste plus facile ? »

| h2 | la question, dans ses mots |
|---|---|
| Ce qu'une machine y voit | « Qu'est-ce qu'ils ont que je n'ai pas ? » |
| Ce qui vient de la plateforme, pas d'une décision | « Est-ce qu'ils ont payé pour ça ? » |
| Le seul endroit où les cinq se séparent | « Alors la différence est où, exactement ? » |
| Ce que cinq fiches ne disent pas | « Est-ce que ça vaut pour tout mon marché ? » |
| Ce que vous pouvez regarder ce soir | « Qu'est-ce que j'en fais demain matin ? » |
| Et si la réponse était « ni l'un ni l'autre » | « Donc je me suis inquiété pour rien ? » |

---

## 2. Ce que l'installation exige vraiment, connecteur par connecteur

**Mesure maison.** Code relu le 21 octobre 2026 dans les trois dépôts, aux
`HEAD` suivants : `heurix-prestashop` **`0601eef`**, `heurix-woocommerce`
**`61c244f`**, `heurix-shopify` **`16145b5`**. Compté sur les fichiers, pas
sur la documentation.

| | PrestaShop | WooCommerce | Shopify |
|---|---|---|---|
| fichiers livrés | **16** (`heurixsearch/`) | **8** (`heurix-search/`) | **6** (extension de thème) |
| points de branchement | **1** hook, `productSearchProvider` | **1** action `pre_get_posts` + 2 filtres bornés à la requête en cours | **1** bloc posé depuis l'éditeur de thème |
| gabarits / templates réécrits | **0** | **0** | **0**, aucun fichier édité à la main |
| tables créées | **0** | **0** | **0** |
| réglages posés | 7 lignes de configuration | 12 options | réglages du bloc |
| désinstallation | supprime les 7 lignes, aucune table à défaire | supprime les 12 options | retrait du bloc |
| délai d'attente par défaut | **3 s** | **3 s** | — |
| chemin d'écriture vers le catalogue | **aucun** | lots de **100** produits | l'app tire le catalogue elle-même |

**Ce que chacun rend à la boutique.** PrestaShop reçoit une **liste
d'identifiants** et reconstruit lui-même vignettes, filtres, pagination et
tris — le module ne pose aucune facette et déclare explicitement zéro ordre
de tri, pour ne pas afficher un sélecteur qui mentirait. WooCommerce : la
requête SQL finale est **identique au caractère près** à celle d'avant,
mesurée sur la même page et la même adresse ; seul l'ordre change.

**Le repli, et c'est le point qui décide.** PrestaShop transmet **la
recherche qui découvre la panne** au fournisseur natif, dans la même seconde,
puis se tait 60 s. WooCommerce ouvre après **2 échecs**, pour **60 s**, avec
**2 places** d'appel simultanées. Shopify renvoie vers `routes.search_url`,
c'est-à-dire la recherche du thème lui-même. Dans les trois cas le repli est
**le défaut à l'installation**, pas une option à trouver.

### Deux chiffres des articles que ce relevé ne portait pas (ajoutés le 21 octobre au soir)

Trouvés en relisant les articles contre ce relevé, à la réécriture des deux
passages. Les deux étaient **lus** et non consignés — ils ont une source, elle
n'était écrite nulle part. Ce sont des lectures, pas des mesures neuves.

**« cinq installations PrestaShop, de la 8.0 à la 9.1, 121 contrôles au vert
chacune, le 20 septembre 2026 ».** Source : l'en-tête de
`heurixsearch/heurixsearch.php` lui-même, lu le 21 octobre à `0601eef` — « the
whole bench was run against five installations — 8.0.0, 8.1.7, 8.2.7, 9.1.4
and 9.1.5 — and gave 121 assertions green on each ». C'est une campagne du
dépôt du connecteur, pas une campagne de ce lot : je n'ai rien rejoué.

**« deux des cinq sites tournent sur la même plateforme largement répandue en
France, relevé le 9 octobre 2026 ».** Source : `docs/mesures/
prospects-analyse-75.json` du dépôt **privé** `heurix-engine`, qui porte une
détection de plateforme par signature de page d'accueil. Sur les cinq sites
lus le 20 octobre, deux portent la signature PrestaShop et un celle de
WooCommerce ; les deux autres ne sont pas détectés. L'article ne dit que
« deux sur la même plateforme », ce qui est la part sûre.

### Le titre tient, et voici les deux réserves qu'il a fallu écrire dans l'article

**Il tient.** Aucun des trois ne réécrit un gabarit, ne crée une table, ni ne
remplace un thème.

**Réserve 1, Shopify : le thème doit être d'une génération récente.** Relevé
le 8 septembre 2026 sur le thème de référence de Shopify — trois sections y
acceptent un bloc d'application. La condition est documentée par Shopify
elle-même : « For app blocks to function, a theme must contain the following:
JSON templates. Sections that support and render blocks of type `@app` ». Un
thème d'ancienne génération ne peut pas l'accueillir. L'article le dit, en
une phrase, sans le mot technique.

**Réserve 2, PrestaShop : le module n'alimente pas le catalogue.** Zéro
occurrence de `/items`, deux URL construites et **les deux sont des
lectures** (`stats`, `search`). Ce n'est pas une panne mais une absence
assumée, écrite trois fois dans le module. Le catalogue arrive donc par un
import séparé. Sans cette phrase, le titre aurait promis par omission.

---

## 3. Ce que le relevé du 20 octobre NE permet PAS d'affirmer

Réutilisé tel quel : `docs/mesures/fiches-tierces-2026-10-20/RELEVE.md`.
**Aucune nouvelle lecture de site tiers n'a été faite pour ce lot**, et c'est
une décision : la mesure existante porte l'argument des deux articles, et
relancer une campagne pour confirmer ce qu'on sait déjà coûte aux serveurs
d'en face sans rien apprendre.

Ce qu'elle **ne** permet **pas**, et l'article le dit lui-même dans une
section entière :

- **Elle ne décrit pas un marché.** Cinq fiches, six sites, une fiche par
  site. Aucun tirage aléatoire : la fiche est la première du plan de site.
- **Elle ne décrit même pas ces six boutiques.** Une deuxième page de
  chacune pourrait dire autre chose ; elle n'a pas été lue.
- **Elle ne dit rien de ce qui s'affiche après l'ouverture de la page.**
  Aucun script n'est exécuté.
- **Elle ne dit rien des prix de compte professionnel**, des quantités
  minimales ni des délais : non cherchés.
- **Elle ne dit pas que la recherche de ces sites fonctionne.** Le balisage
  d'une fiche et le moteur d'un site sont deux choses différentes, et seule
  la première a été mesurée.
- **Le sixième site n'a pas été lu** : sa fiche rend un timeout après 25 s.
  Il ne compte dans aucun dénominateur.

**L'enlargissement envisagé et écarté :** mesurer la recherche interne de ces
six sites. Il aurait fallu deviner la forme de leurs URL de recherche —
exactement le geste que le relevé du 20 octobre s'est fait prendre à
commettre — et beaucoup de `robots.txt` refusent ces chemins, ce qui aurait
produit une série d'échecs à consigner plutôt qu'une mesure.

**Le défaut d'instrument du 20 octobre est repris dans l'article**, et il y
sert l'argument : la première version du tableau annonçait 4 sur 5 au
balisage produit, parce que la première adresse d'un plan de site était la
porte d'entrée de la boutique et non une fiche. Regarder vite le site d'un
autre dit moins qu'on ne croit — y compris avec un programme.

---

## 4. Le témoin de registre, étendu et non dupliqué

`tests/registre-dirigeant-20oct.test.js` passe de **2 à 6 pages**, par un
`SLUGS` de trois entrées dont les deux langues sont **dérivées** :
`LOT = SLUGS.flatMap(...)`. Un second fichier aurait recopié les quatorze
termes, le découpage du corps éditorial et les cinq cas aveugles — trois
endroits où les deux listes auraient pu diverger en silence.

Le nom du fichier dit encore « 20oct » alors qu'il en couvre trois : assumé,
pour ne pas périmer les références du relevé de la veille.

**Trois assertions neuves**, et chacune ferme un trou que l'extension ouvre :

1. **Parité de langue sur le dérivé** — `LOT` doit porter 3 pages de chaque
   côté. Sans elle, dériver `LOT` sur une seule langue divise le périmètre
   par deux en sortant vert.
2. **Aucune entrée de `DEFINIS` périmée** — un terme admis sur une page qui
   ne l'emploie plus, ou une entrée pour une page hors du lot, fait rougir.
   Une exception morte n'autorise rien mais fait croire à un arbitrage.
3. **Le compte de termes admis est dérivé de `DEFINIS`**, avec un plancher à
   4 : vider la table ferait passer l'assertion de définition sur zéro cas.

Le balayage des termes compte désormais
`(14 + 13) × 3 = 81` couples page-terme, contre 27.

### Les dix mutations, toutes attrapées

Vert exigé avant chacune, vert vérifié après chaque restauration.

| mutation | verdict |
|---|---|
| terme interdit ajouté dans l'article 1 (« indexation ») | rouge |
| terme interdit ajouté dans l'article 2 (« API ») | rouge |
| définition retirée de la phrase, article 2 | rouge |
| entrée `DEFINIS` pour une page qui n'emploie pas le terme | rouge |
| un slug retiré de `SLUGS` | rouge |
| `LOT` dérivé sur une seule langue | rouge |
| septième `h2` dans l'article 1 | rouge |
| `</article>` de trop dans l'article 2 | rouge |
| article 1 gonflé au-delà de 920 mots | rouge |
| article 2 vidé sous 600 mots | rouge |

### Ce que le témoin ne voit TOUJOURS pas

Les cinq cas de son en-tête valent inchangés, et l'extension n'en ferme
aucun :

1. **Un texte abstrait qui évite les mots sans parler à personne** — le trou
   principal, et il est structurel : le témoin est une liste de mots.
2. **Le jargon du métier du lecteur** : EBITDA, BFR, rotation de stock.
3. **Un synonyme du terme interdit.**
4. **Une définition fausse ou incompréhensible** : il vérifie la présence du
   texte, jamais sa justesse.
5. **Le ton.**

**Et deux nouveaux, propres à ce lot-ci :**

6. **Il ne lit pas les affirmations du code.** « Aucune table créée » est
   vérifié par moi dans trois dépôts, pas par lui. Si un connecteur se met à
   créer une table demain, l'article devient faux et le témoin reste vert :
   il vit dans `heurix-site`, la vérité vit ailleurs.
7. **Il ne voit pas qu'un article promet par omission.** La phrase sur
   PrestaShop qui n'alimente pas le catalogue a été ajoutée parce que je l'ai
   mesurée, pas parce qu'un garde l'a réclamée. Un titre qui tient par ce qui
   n'est pas écrit lui échappe entièrement.

---

## 5. Les témoins habituels

- **Quatre pages**, deux articles × deux langues, même slug des deux côtés,
  `hreflang` `fr`/`en`/`x-default` réciproques.
- **Les deux index** : quatre cartes, en tête des articles d'octobre.
- **Le sitemap** : quatre entrées, `lastmod` posé par le script
  (**152 blocs**, zéro à corriger).
- **`datePublished`** `2026-10-21T19:45:00+02:00`, le même instant dans les
  deux langues de chaque article, et le mois du kicker.
- **`PLANCHER`** de `tests/pages-indexables.js` : **148 → 152**, avec sa
  date et la raison du pas de quatre (voir le point 0).
- **Les `<title>`** : 55, 59, 58 et 54 caractères, tous distincts de leur
  `h1`, aucun n'étant un préfixe du sien.
- **Longueurs éditoriales** : 875 et 834 mots pour le premier article,
  836 et 809 pour le second.
- **Les cinq articles voisins sont liés**, et aucun n'est redit : mise en
  route, recherche sans thème, limites des moteurs natifs, recherche native
  PrestaShop et bornes mesurées du module WooCommerce.


---

## 7. Les deux passages « Mesure maison », réécrits le 21 octobre au soir

Les chiffres n'ont pas bougé d'un seul. Ce qui a changé est l'unité dans
laquelle ils sont rendus : ce relevé-ci garde l'unité de l'instrument, les
articles prennent celle du dirigeant.

**Ce qui est sorti du corps des articles**, et qui reste ici : le nombre de
fichiers par connecteur (16, 8, 6) et les trois empreintes de version
(`0601eef`, `61c244f`, `16145b5`). Ils sont à nous, pas à lui. La date du
21 octobre et la source — « leur code, pas leur documentation » — restent
dans l'article, parce que ce sont elles qui rendent l'affirmation
vérifiable pour lui.

**Premier article : les deux colonnes constantes sont devenues une phrase.**
Le tableau portait quatre colonnes dont deux ne disaient qu'une seule chose
— « gabarits réécrits : aucun / aucun / aucun » et « tables créées : aucune /
aucune / aucune ». Une colonne qui répète la même cellule trois fois n'est pas
un tableau, c'est une phrase déguisée en grille. Elle est désormais écrite
comme telle, et le tableau ne porte plus que ce qui **diffère** entre les
trois boutiques : ce qui s'ajoute et où, et ce qui remplit le catalogue. Les
six cellules de corps sont distinctes deux à deux.

**Second article : le tableau est retourné.** Il listait cinq lignes presque
égales — trois « 5 sur 5 » et un « 4 sur 5 » — ce qui donnait à lire une
grille plate là où la mesure portait une trouvaille. Son sujet est maintenant
l'unanimité : quatre constats identiques sur les cinq fiches, dont l'un est
une absence (« la référence n'est jamais écrite dans le nom du produit »,
0 sur 5 ici, « les cinq » là-bas), et une seule ligne qui sépare les
boutiques, mise en gras. Le « 0 sur 5 » du relevé et le « les cinq » de
l'article disent le même fait ; aucune des deux formes n'est fausse dans son
unité.

### La pré-mesure des colonnes constantes, et pourquoi le garde n'est PAS écrit

**Mesure du 21 octobre 2026**, instrument
`docs/mesures/colonnes-constantes-2026-10-21.py`, sur les **94 pages
indexables** de `blog/` et `en/blog/` :

| | avant la réécriture | après |
|---|---|---|
| tableaux | 66 | 66 |
| dont éligibles (au moins deux lignes de corps) | 64 | 64 |
| colonnes strictement constantes | **5**, sur 4 pages | **3**, sur 2 pages |

Les deux qui disparaissent sont les miennes — « Tables créées » et « Tables
created ». Les trois qui restent sont celles d'articles antérieurs, et ce
sont elles qui décident.

La règle « une colonne constante est une phrase » **rougirait sur trois cas
légitimes**, et elle n'est donc pas écrite :

- `blog/decoupage-rag-catalogue-produit.html`, colonne « Moteur Heurix,
  17 septembre » : cinq cellules, toutes « 64 / 64 ». **Cette constante est le
  résultat de l'article**, et elle ne veut dire quelque chose qu'à côté des
  deux colonnes qui varient. En faire une phrase détruirait la comparaison.
- `blog/refus-apres-ecriture-ordre-des-verifications.html`, colonnes
  « Essais » (30, 30) et « Produits indexés ensuite » (5 000, 5 000) : ce sont
  les **témoins d'une expérience contrôlée**. Une colonne constante y est ce
  qui autorise la comparaison des deux autres, pas du bruit.

Une règle qui signale des cas légitimes se retire, elle ne s'excepte pas :
trois exceptions nommées pour deux vraies prises ne feraient pas une règle
juste. Les deux colonnes de ce lot ont été corrigées **par la relecture**, pas
par un garde — et c'est exactement ce que la pré-mesure devait trancher.

### Le témoin de registre voit-il un tableau ? Oui, et c'est mesuré

`corpsEditorial` découpe du `<h1>` au bloc d'appel à l'action, et `texte()`
retire **toutes** les balises : le contenu des `<th>` et des `<td>` rejoint
donc la prose. Vérifié plutôt que déduit, par deux mutations jouées puis
défaites le 21 octobre :

| mutation | verdict |
|---|---|
| « indexation » glissé dans un `<td>` du premier article | **rouge** |
| « API » glissé dans un `<th>` du premier article | **rouge** |

**Ce qu'il ne voit toujours pas, mesuré sur ces deux passages précisément.**
Des mots qui les rendaient illisibles, **un seul** figure dans sa liste —
`schema.org`, et c'est celui qui est défini. Tous les autres lui sont
invisibles, parce qu'une liste de mots interdits ne connaît que ses mots :

`0601eef`, `61c244f`, `16145b5`, « dépôts », « branchement », « filtres »,
« gabarits », « connecteurs », « documentation », « identifiants »,
« pagination », « plan de site », « bloc de données », « en série », « une
requête par seconde ».

Aucun d'eux n'est à ajouter à la liste : ce ne sont pas des mots interdits,
ce sont des mots **justes dans l'unité de l'instrument et faux dans celle du
lecteur**. Le témoin ne sait pas distinguer les deux, et il ne le saura pas.
C'est un sixième angle mort, à ranger avec les cinq de son en-tête — et c'est
la relecture qui l'a attrapé cette fois, comme la fois précédente.


---

## 8. Trois corrections sur `d1192e1c` (21 octobre, au soir)

### La règle d'échantillonnage annoncée n'était pas celle qui a été suivie

**Mesuré dans `docs/mesures/fiches-tierces-2026-10-20/RELEVE.md`, et nulle
part ailleurs.** Sur la boutique dont la première adresse du plan de site
était la page d'accueil — le site D — cette page **n'a pas été gardée**. Le
relevé le dit en toutes lettres : la sonde l'a lue, n'y a trouvé aucun
balisage produit, « le premier tableau que j'ai obtenu disait donc 4 sur 5, et
il était faux », puis `RACINE_RAYON` a été ajouté et **le site a été
remesuré**. Le même relevé énonce la règle réellement appliquée partout :
« la première URL, dans l'ordre du document, qui porte **une forme de fiche
reconnue**, dans le premier sitemap de produits trouvé ».

Donc : **le compte « les cinq » est juste et ne bouge pas** — les cinq pages
finalement lues sont cinq fiches produit. **C'est la phrase d'entrée qui était
fausse**, parce qu'elle annonçait « la première que la boutique met dans son
sommaire », c'est-à-dire une méthode plus simple que celle qui a servi. Un
article qui annonce une méthode d'échantillonnage plus propre que la vraie
promet par omission, et il le fait au sujet de sa propre méthode — le défaut
même que son avant-dernière section dénonce.

La phrase dit maintenant la règle et son repli :

> cinq fiches lues le 20 octobre 2026, une par site, prise sans trier — la
> première adresse du plan de site de chaque boutique **qui ait la forme d'une
> fiche produit**. Sur l'une des cinq, cette première adresse était la page
> d'accueil du magasin : **il a fallu descendre à la suivante**, et c'est
> cette règle-là qui a servi partout.

**L'aveu de l'avant-dernière section n'a pas été touché.** Les deux disent
deux choses différentes : l'entrée dit la méthode, l'aveu dit que la première
passe l'avait ratée et rendu un tableau faux.

### Une phrase qui expliquait l'unité d'un objet absent

Retirée de l'article 1 : « Ce qui est compté est ce qui précède : les
fichiers, les branchements, les tables. » Les comptes de fichiers sont partis
dans ce relevé à la réécriture précédente ; la phrase commentait donc une
grandeur que l'article ne porte plus. Ce qui reste — « personne ne l'a
chronométré, nous n'avons pas de chiffre à donner » — se tient seul.

### « Le seul mot technique de cette page » était vérifiable, et faux

C'est une affirmation **sur la page elle-même**, donc mesurable. Mesuré sur
l'article 2 : « bloc de données » y figure **trois fois**, « plan de site »
**une fois**. La phrase était fausse.

Deux sorties possibles : la rendre vraie, ou cesser de compter. La rendre
vraie aurait demandé de retirer « bloc de données », qui est le sujet même de
l'article, et de le remplacer par du vague — ce que le lot s'interdit. Elle
cesse donc de compter, et donne au lecteur ce dont il a réellement besoin :

> il s'appelle schema.org, et c'est le mot à donner à votre agence

`DEFINIS` du témoin suit, dans les deux langues, avec la raison en commentaire.

**ET LE MÊME DÉFAUT VIT DANS L'ARTICLE DU 20 OCTOBRE**, déjà fusionné :
`blog/ce-qu-une-ia-lit-de-vos-fiches-produit.html` porte la même phrase, avec
« bloc de données » deux fois et « plan de site » une fois. Ce lot n'avait pas
le droit d'y toucher. **C'est un lot à lui, et il est à faire.**
