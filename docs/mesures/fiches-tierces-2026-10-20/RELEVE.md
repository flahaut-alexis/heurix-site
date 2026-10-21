# Ce qu'un lecteur-machine lit sur une fiche produit — relevé du 20 octobre 2026

Lot de l'article dirigeant, branche `article-dirigeant-moteurs-reponse-20oct`,
worktree `~/wt/article-dirigeant-20oct`, partie de `origin/main` à `b6ac8317`.

Instrument : `sonde-fiches.py`, à côté de ce fichier. Lecture de pages
publiques seule.

## Pourquoi les domaines ne sont pas écrits ici

Ce dépôt est **public** — sur GitHub, et servi sur `heurix.fr` (`docs/` est
refusé dans `robots.txt`, ce qui retire le chemin, pas le fichier). Ce relevé
porte un jugement sur des sites tiers : « cette fiche ne déclare pas sa
référence » est exact et daté, et ce n'est pas à nous de le publier sous leur
nom.

Les six domaines sont nommés dans le **compte rendu de session du 20 octobre
2026**, et ils figurent tous dans
`docs/mesures/prospects-analyse-75.json` du dépôt **privé** `heurix-engine`,
où la lecture du 9 octobre les avait déjà relevés. La colonne « catalogue »
ci-dessous donne le nombre de produits relevé ce jour-là : elle identifie
chaque ligne sans ambiguïté pour qui a accès à ce fichier.

**C'est une décision, et elle se défait en un commit** si vous préférez les
nommer.

## Le protocole, en une phrase

Le 20 octobre 2026 entre 23:24 et 23:36 (heure de Paris), `robots.txt` puis
une fiche produit lus sur six sites de distribution technique française — en
série, une requête par seconde comptée globalement, user-agent
`HeurixAudit/1.0 (+https://heurix.fr; mesure interne; contact@heurix.fr)`,
`robots.txt` lu en premier et respecté, GET seuls, aucune donnée personnelle
collectée. Quatre passes au total, **66 requêtes**, la dernière de 25 requêtes
en 2 min 28 s (5,9 s par requête en moyenne).

**La fiche n'est pas choisie : c'est la première URL, dans l'ordre du
document, qui porte une forme de fiche reconnue, dans le premier sitemap de
produits trouvé.** Reproductible, et non représentatif.

## Ce que la sonde a trouvé

| site | catalogue (9 oct.) | balisage produit | prix + monnaie | référence en champ | disponibilité | HTML servi |
|---|---|---|---|---|---|---|
| A | 5 759 | oui | 56 EUR | `sku` + `mpn` | sur commande | 204,7 ko |
| B | 21 952 | oui | 47,10 EUR | `sku` | épuisé | 443,2 ko |
| C | 13 372 | oui | 73,02 EUR | `sku` + `mpn` | en stock | 685,1 ko |
| D | 2 732 | oui | 59 EUR | `sku` | en stock | 371,0 ko |
| E | 26 672 | oui | 1,6182 EUR | **aucune** | en stock | 151,6 ko |
| F | 3 991 | — | — | — | — | **échec** |

Les cinq sommes qui comptent, et leur dénominateur :

- **balisage produit `schema.org/Product` : 5 sur 5**, toujours en bloc de
  données dans la page, **jamais** en attributs posés sur le HTML visible
  (`0 sur 5` en microdonnées) ;
- **prix lisible par une machine, avec sa monnaie : 5 sur 5**, EUR partout ;
- **disponibilité déclarée : 5 sur 5** — trois en stock, un épuisé, un sur
  commande ;
- **référence dans un champ à elle : 4 sur 5** ;
- **référence présente aussi dans le nom du produit : 0 sur 5.**

Le dernier chiffre est celui qui porte l'article : la référence vit dans son
champ, ou nulle part. Le site E n'a pas ce champ, et **le nom de son produit
*est* la référence** — huit caractères, sans un mot de désignation. Une
machine qui lit cette fiche obtient donc une référence et aucune
désignation ; sur les quatre autres, si le champ venait à manquer, elle
obtiendrait l'inverse. Rien dans la page ne dit laquelle des deux elle a.

## `robots.txt` : la décision n'a pas été prise

Les six `robots.txt` ont répondu **200**, de 297 à 5 709 octets. Interrogés
par `RobotFileParser.can_fetch(<agent>, <url de la fiche>)`, ils autorisent
**les douze robots testés, sur les six sites**.

Et c'est une autorisation par défaut, pas une décision : sur les six
fichiers, **aucun ne nomme un seul** des dix lecteurs de réponse testés —
`GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-SearchBot`,
`PerplexityBot`, `Google-Extended`, `CCBot`, `Applebot-Extended`,
`meta-externalagent`. Un seul fichier nomme un robot, et c'est `Googlebot`
(site E, cinq groupes `User-agent`). Les cinq autres ont un seul groupe,
`User-agent: *`.

**Nommé n'est pas autorisé, et c'est pour ça que la sonde lit les deux :**
`can_fetch` rend `True` par défaut quand aucune règle ne vise l'agent. Lire
seulement le verdict aurait fait écrire « les six autorisent les moteurs de
réponse », ce qui est vrai et dit le contraire de ce qui se passe — personne
ne leur a rien autorisé.

## L'échec, et il est consigné

**Site F.** `robots.txt` lu (200, 434 octets), sitemap lu, URL de fiche
trouvée, droits relevés — puis la fiche elle-même a rendu un **timeout** au
bout de 25 secondes, deux fois (passe 1 sur `robots.txt`, passe 4 sur la
fiche). Ce n'est pas une fiche sans balisage : c'est une fiche non lue. Elle
ne compte dans aucun des cinq dénominateurs ci-dessus, et le dénominateur est
écrit partout.

Aucun `Disallow` n'a été rencontré sur les six. Rien n'a été contourné.

## Deux défauts de l'instrument, trouvés en cours de mesure

Les deux ont été trouvés parce que le résultat était *trop propre*, pas par
relecture.

**1. Une racine de rayon prise pour une fiche.** La première URL du sitemap de
produits du site D est `/boutique/` — la page d'accueil de la boutique. La
sonde l'a lue, n'y a trouvé aucun balisage produit (il n'y en a aucune raison)
et a classé le site D en « pas de balisage ». **Le premier tableau que j'ai
obtenu disait donc 4 sur 5, et il était faux.** Corrigé par `RACINE_RAYON`,
qui refuse une URL dont le chemin s'arrête à un nom de rayon, puis remesuré :
le site D porte son balisage, son prix, sa référence et sa disponibilité.

**2. Une forme d'URL non reconnue lue comme une absence.** Le site E range
ses fiches sous `/fiche-article/<RÉF>` ; le motif de la sonde ne connaissait
pas cette forme et rendait « aucune URL de fiche trouvée dans les sitemaps
lus » sur un site qui en déclare **10 002**. La forme a été **relevée sur le
sitemap**, pas devinée, et ajoutée au motif avec son commentaire. Même geste
pour `/prNNN/` du site C, dont la fiche n'avait été attrapée que par
raccroc — le `-pNN` final d'un autre slug.

Dans les deux cas, l'instrument disait « je n'ai pas vu », jamais « on m'a
donné le mauvais périmètre ».

## Ce que la sonde ne mesure pas

- **Ce qui s'affiche après l'ouverture de la page.** Aucun script n'est
  exécuté. Un prix calculé côté navigateur est compté absent du balisage —
  ce qui est l'état dans lequel un lecteur automatique le trouve aussi, mais
  ce n'est pas la même affirmation.
- **Les prix de compte professionnel, les quantités minimales, les délais.**
  Non cherchés. L'article le dit.
- **La représentativité.** Une fiche par site, six sites tirés d'un panel de
  prospection, aucun tirage aléatoire. Ce sont cinq cas datés.
- **Ce que les moteurs de réponse font réellement de ces pages.** Il faudrait
  les journaux de ces six serveurs.
