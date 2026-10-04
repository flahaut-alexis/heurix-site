# Ce que GitHub Pages publie de ce dépôt — relevé du 4 octobre 2026

Relevé pris le 4 octobre 2026, à partir de `main` `42940265`, puis corrigé des
deux commits fusionnés pendant la mesure (`a2eae24c`). Le seul écart entre les
deux portait sur un fichier interne, `tests/corrections-en-attente.md`,
2 425 → 6 609 octets.

**Origine.** Trouvaille incidente de la vérification de **C1** de
`heurix-engine/docs/mesures/audit-2026-10-04/`. En comparant les empreintes du
servi et du dépôt, `tests/corrections-en-attente.md` est ressorti identique —
ce qui voulait dire que Pages le servait.

**Décision du 4 octobre 2026 (Alexis) : sortie A**, `robots.txt`. Appliquée
dans le même lot que ce relevé. La raison d'avoir écarté la sortie B est en
§5, et elle y est écrite pour le jour où quelqu'un la reproposera.

---

## 1. Le mécanisme, en une ligne

```yaml
actions/upload-pages-artifact@v5
  with: {path: '.'}
```

La racine entière du dépôt. Il n'y a rien d'autre à comprendre.

**Un levier que je croyais disponible ne l'est pas.** `.nojekyll` et les
exclusions Jekyll (`_config.yml`, clé `exclude:`) n'ont rien à exclure ici :
Pages est en mode **workflow** (`gh api repos/.../pages` → `build_type:
workflow`), aucun des deux fichiers n'existe dans le dépôt, et Jekyll n'est
jamais lancé. Le seul levier d'inclusion est l'entrée `path`, qui prend **un**
répertoire — c'est pourquoi « exclure » n'est pas une option directe, et
pourquoi la sortie B passe nécessairement par l'assemblage d'un répertoire.

## 2. Ce qui est publié

1 042 fichiers suivis, 22,1 Mio. Classés :

| | fichiers | octets | |
|---|---|---|---|
| **site** | 840 | 20 552 439 | 19,60 Mio |
| **hors site** | 202 | 2 646 767 | 2,52 Mio |

Le hors-site, par chemin, **octets réellement renvoyés par `heurix.fr`** :

| chemin | fichiers | octets servis |
|---|---|---|
| `docs/` | 75 | 1 137 132 |
| `tests/` | 108 | 1 119 456 |
| racine (6 fichiers) | 6 | 273 166 |
| `scripts/` | 7 | 90 146 |
| `config-serveur-cache/` | 2 | 3 790 |
| **total servi en 200** | **198** | **2 619 506** |

Les six de la racine : `CLAUDE.md` (182 842 o), `package-lock.json` (68 589),
`package.json`, `vitest.config.js`, `DESIGN.md`, `README.md`.

Les plus gros, et les plus parlants :

```
276 640 o  docs/maquettes/shots/apercusombresolutions.png
182 842 o  CLAUDE.md
 76 374 o  docs/mesures/prestashop-natif-2026-09-19/resultats/natif.json
 35 522 o  tests/packs-coherence.test.js
 25 573 o  scripts/hooks/pre-push
  6 609 o  tests/corrections-en-attente.md
```

### Quatre chemins ne sont pas servis, et c'est gratuit

```
404  .DS_Store
404  .github/workflows/CI.yml
404  .gitignore
404  .gitleaks.toml
```

Leur seul point commun mesurable : ils commencent par un point. C'est une
exclusion qui existe déjà et que personne n'a eu à écrire — d'où l'absence de
règle `Disallow` pour eux. Une règle les visant serait périmée le jour où on
l'écrit, et `surface-publiee-robots.test.js` la refuserait.

### Ce n'est pas une fuite, et la règle garde sa juste taille

Le dépôt est **public** : ces 198 fichiers étaient déjà lisibles sur GitHub.
Ce que Pages change, c'est le **domaine** — ce sont des URL de `heurix.fr`, le
domaine commercial, et `CLAUDE.md` y sert 182 Ko de raisonnement interne, dont
la table des lignes 24-25 que l'audit du même jour a trouvée fausse et qui
l'est encore.

C'est donc un problème de vitrine, pas de secret. Ce cadrage est ce qui
disqualifie la sortie B (§5).

## 3. La découvrabilité — mesurée, parce que l'indexation ne l'est pas

```
sitemap.xml      140 URL, 0 chemin interne
pages servies    0 lien href/src vers /tests/, /docs/, /scripts/, CLAUDE.md
llms.txt         0 renvoi interne
robots.txt       Allow: /  (un seul Disallow, pour un fragment)
```

Rien ne guidait un robot vers ces fichiers, et rien ne le lui interdisait.

Deux articles citent bien des mesures de `docs/mesures/` — mais par des URL
**GitHub** (`github.com/flahaut-alexis/heurix-site/tree/main/docs/mesures/...`),
pas par des URL du site : `blog/module-woocommerce-publie-bornes-mesurees.html:231`
et `blog/recherche-native-prestashop-mesuree.html:241`. C'est délibéré et ça
reste vrai après la sortie A : `robots.txt` du site ne régit pas GitHub.

## 4. Ce qui n'a pas pu être mesuré

**L'indexation par Google.** `site:heurix.fr CLAUDE.md` ne rend rien, et
`site:heurix.fr` rend **une seule URL** pour un site de 140 pages — la
couverture de l'outil employé n'est pas celle de Google, donc son silence ne
prouve rien, dans aucun sens. Search Console est l'autorité et ce lot n'y a pas
accès.

**La conséquence pratique :** si des URL internes ont déjà été indexées,
`robots.txt` empêche la ré-exploration mais ne retire pas une page déjà
indexée. Le retrait demande l'outil de suppression de Search Console, et cela
reste à faire par qui y a accès. **La sortie A ne couvre pas ce cas-là.**

## 5. Les trois sorties, et pourquoi B a été écartée

### A — `robots.txt`. Retenue.

Dix règles `Disallow`, plus un test dérivé. Ne retire rien : les 198 fichiers
restent lisibles pour qui connaît l'URL. Retire le chemin par lequel on les
trouve **sans les chercher**, ce qui est exactement le risque mesuré en §3.

C'est aussi le levier que ce dépôt emploie déjà pour la même classe de
problème — `tests/fragments-non-indexables.test.js`, depuis le fragment
`heurix-conversion-snippet.html` — et le commentaire de `robots.txt` y explique
pourquoi c'est le seul disponible : `noindex` exige un `<head>`, et
`X-Robots-Tag` demande un en-tête HTTP que GitHub Pages ne permet pas de
définir.

Coût : dix lignes, un module de dérivation, un fichier de test. Aucune classe
de panne nouvelle.

### B — répertoire de publication dédié. **Écartée.**

Assembler un `_site/` ne contenant que le site, et pointer `path:` dessus.
C'est la seule sortie qui **retire vraiment** les fichiers.

**La raison du refus est mesurable, et c'est elle qu'il faut relire avant de
reproposer B : aucun test de ce dépôt ne lit l'artefact publié.** Tous dérivent
de l'arbre (`RACINE`), `liens-relatifs.test.js` et `actifs-versionnes.test.js`
compris. Un fichier du site oublié à l'assemblage passerait les **1 056 tests
et le crochet**, et ne se verrait qu'en production.

B créerait donc précisément la classe de panne que ce dépôt poursuit partout
ailleurs — **un garde qui juge autre chose que ce qui est servi** — et il
faudrait écrire ce garde **avant** B, pas après. Pour un problème de vitrine et
non de secret, l'ordre de grandeur ne le justifie pas.

Deux mesures à garder si B revient un jour :

- **Exclure coûte neuf lignes, inclure en coûte soixante-quinze.** Il y a
  **10 entrées internes** de premier niveau contre **~75 entrées de site**.
  « Copier tout, puis retirer dix » ne dérive pas — un fichier de site neuf est
  publié par défaut. « Énumérer ce qu'on copie » dérive à chaque ajout.
- Le garde manquant devrait comparer l'**artefact** à l'arbre, pas l'arbre à
  lui-même. Rien dans `tests/` ne sait faire ça aujourd'hui.

### C — l'assumer. Écartée aussi, mais de peu.

Coût nul, et défendable : rien n'est divulgué que GitHub ne serve déjà. Ce qui
l'écarte est le point de §2 — le domaine commercial, et une table fausse servie
dessus.

## 6. Ce que la sortie A a changé

`robots.txt` : dix `Disallow`, avec en commentaire la mesure, le cadrage
« ce n'est pas une fuite », et le renvoi vers ce relevé.

`tests/surface-publiee.js` : la dérivation, partagée. Elle existe parce que
l'assertion « aucune règle n'est périmée » quantifie sur **toutes** les règles,
donc sur les deux familles, et ne pouvait pas rester dans un fichier qui n'en
connaît qu'une — mesuré : dix règles ajoutées, dix « périmées » annoncées à
tort par `fragments-non-indexables.test.js`.

`tests/surface-publiee-robots.test.js` : quatre assertions.
`tests/fragments-non-indexables.test.js` : lit désormais le module partagé, et
son assertion globale a déménagé avec sa raison écrite sur place.

**Muté, une mutation par assertion :**

| mutation | assertion qui mord |
|---|---|
| `Disallow: /CLAUDE.md` retiré | chaque entrée interne suivie est refusée |
| règle `Disallow` sans cible ajoutée | aucune règle n'est périmée |
| `Disallow` du fragment retiré | chaque fragment suivi est refusé |
| entrée de premier niveau neuve et suivie | aucune entrée n'échappe aux deux listes |

Arbre rendu à 6 verts entre chaque.

**Une liste assumée, et ce qui la garde.** `tests/surface-publiee.js` porte deux
listes écrites à la main — l'interne et le site. C'est contraire à l'habitude de
ce dépôt, et c'est délibéré : le critère « ce fichier appartient-il au site ? »
n'a pas de forme lisible dans les octets du fichier. `docs.html` est une page,
`docs/` n'en est pas. Ce qui **est** dérivé, et c'est ce qui compte, c'est la
**confrontation** : toute entrée de premier niveau que ni l'une ni l'autre liste
ne connaît fait rougir le test. Une entrée neuve ne peut donc pas entrer en
silence, d'aucun côté.

**Et ce relevé est lui-même dans `docs/`.** Il est donc publié et désormais
refusé aux robots par la règle qu'il documente.

## 7. Rejouer les mesures

```bash
# le mecanisme
python3 -c "import yaml;d=yaml.safe_load(open('.github/workflows/CI.yml'));
print([s.get('with') for s in d['jobs']['deploiement']['steps'] if 'upload-pages' in s.get('uses','')])"
gh api repos/flahaut-alexis/heurix-site/pages --jq '.build_type'

# ce qui est servi, chemin par chemin -- SEQUENTIELLEMENT, voir §8
while IFS= read -r f; do
  printf '%s %s\n' "$(curl -s -m 25 -o /dev/null -w '%{http_code}:%{size_download}' \
    --retry 2 "https://heurix.fr/$f")" "$f"
done < liste-des-chemins-internes.txt

# la decouvrabilite
curl -s https://heurix.fr/sitemap.xml | grep -c '<loc>'
git --no-optional-locks grep -lIE '(href|src)="[^"]*\bdocs/[a-z]' -- '*.html' ':(exclude)docs/*'

# le garde
npx vitest run tests/fragments-non-indexables.test.js tests/surface-publiee-robots.test.js
```

## 8. Quatre erreurs de mon instrument, pour qu'elles ne soient pas recopiées

1. **J'ai classé `demo/outillage/` (83 fichiers, 5,19 Mio) en interne.** Aucune
   page ne le cite, et seul `CLAUDE.md` nomme le répertoire — d'où ma
   conclusion. `CLAUDE.md:434` disait le contraire : « ne jamais supprimer
   demo/mode/images/ ni demo/outillage/images/ ». Ce sont des médias chargés à
   l'exécution par la démo. Reclassés : ils sont du site.
2. **J'ai compté 8 pages « liant vers `docs/` ».** C'étaient des liens externes
   vers `typesense.org/docs/`, `meilisearch.com/docs/` et `elastic.co/docs/` —
   la documentation des concurrents, comptée comme une fuite interne. Le
   contrôle ciblé sur le répertoire rend **0**.
3. **Ma sonde parallèle (`xargs -P 12`) a perdu 126 des 202 requêtes en
   silence.** Elle rendait 72 codes 200 et 4 codes 404, et `tests/` n'y figurait
   pas — alors que j'avais mesuré dix minutes plus tôt que
   `tests/paquet-npm-client.test.js` répond 200. Refaite séquentiellement avec
   les échecs rendus explicitement : **202 sur 202**. Une sonde qui perd des
   lignes se lit comme une absence.
4. **Un `grep '_site\|upload-pages-artifact'` dans `tests/` a semblé trouver un
   précédent.** Il matchait `pages_du_sitemap()` dans un commentaire de
   `canonical.test.js` — `_site` y est une sous-chaîne. Il n'existe aucun
   précédent de répertoire de publication dans ce dépôt.
