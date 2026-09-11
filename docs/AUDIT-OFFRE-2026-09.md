# Audit de l'offre - relevé du 11 septembre 2026

Relevé, pas proposition. Aucune rédaction suggérée ; on liste ce qui existe et ce qui manque.

Lu sur :

- heurix-site `7599f777` (main = origin/main, vérifié par `ls-remote` le 11 septembre 2026), worktree `audit-offre`.
- heurix-engine `ad8757d` (main = origin/main, même vérification), en lecture seule.

Relu le même soir, après que les deux main ont bougé :

- heurix-site origin/main `cc2f4ddf` : seules 8 pages solutions ont changé parmi les pages citées. Le balayage du point 4 a été refait sur ce SHA, et donne toujours 0 sur les 24.
- heurix-engine origin/main `bd6d2b9` : aucun des fichiers cités (`usage.py`, `main.py`, `deps.py`, `search.py`, `browse.py`, `billing.py`, `routers/index.py`, `routers/stripe.py`, `routers/browse.py`) n'a changé depuis `ad8757d`.

Point de comparaison : depict.ai. Leur FAQ répond publiquement au dépassement (rien d'automatique, pas de blocage), à ce qui compte (une visite, bots non séparés), et ils ont un palier gratuit permanent avec filigrane. Leur page dit « Every plan includes everything ».

## Populations lues

Le brief parle de « quatre pages de tarifs » et de « quatre pages de documentation ». L'index git en porte deux de chaque :

| Surface | Fichiers dans l'index |
|---|---|
| Tarifs | `pricing.html`, `en/pricing.html` |
| Documentation | `docs.html`, `en/docs.html` |
| Solutions | 24 (`solutions/*.html` et `en/solutions/*.html`, 12 + 12, index compris) |

Pour le point 2, j'ai ajouté `faq.html`, `en/faq.html`, `cgv.html` et `en/cgv.html`, qui répondent aussi au dépassement, à l'essai et à l'annulation.

---

## 1. Ce que nos paliers diffèrent vraiment

### Côté moteur

`PLAN_LIMITS` (`heurix/usage.py:57-62`) :

| Plan | Requêtes/mois | Produits | Catalogues | Dépassement |
|---|---|---|---|---|
| trial | 2 000 | 2 000 | 2 | bloqué au-delà de +10 % |
| starter | 15 000 | 8 000 | 1 | bloqué au-delà de +10 % |
| growth | 30 000 | 25 000 | 3 | bloqué au-delà de +10 % |
| scale | 150 000 | 100 000 | illimité | requêtes jamais bloquées |

Hors de `usage.py`, j'ai cherché dans `heurix/` toute branche sur le nom du plan (`info["plan"]`, `PLANS_*`, `"starter"`, `"growth"`, `"scale"`). Il y en a deux :

- **Bac à sable** : réservé à Growth et Scale (`heurix/routers/index.py:516`, `PLANS_AVEC_SANDBOX`). Starter reçoit un 403. C'est la seule fonctionnalité du moteur conditionnée au plan.
- **Ranking en option à -25 %** : proposé à Growth et Scale seulement (`heurix/routers/stripe.py:115`). C'est une règle de vente au checkout, pas une restriction du moteur : Ranking seul reste achetable par tous.

Aucune vérification de plan ne porte sur les facettes, la recherche fédérée, les synonymes, les Custom Rules, ni sur l'épinglage/la relégation de recherche.

**Constat** : à part le bac à sable, les paliers ne diffèrent que par les volumes. La recherche fédérée demande au moins deux catalogues : Starter n'en a qu'un, donc elle y est inutilisable. C'est une conséquence du volume, pas un verrou.

### Côté site

Le site ne dit pas que tous les plans ont les mêmes fonctionnalités. Il laisse même entendre le contraire :

- La carte Starter liste « Cascade d'annotations & regex » et « Tolérance aux fautes, synonymes » (`pricing.html:248-249`, `en/pricing.html:236-237`). Les cartes Growth et Scale ne les répètent pas.
- La carte Growth ajoute « Facettes dynamiques, recherche fédérée » (`pricing.html:266`, `en/pricing.html:254`), comme si Starter ne les avait pas. Pour les facettes, le moteur ne pose aucune restriction.
- Le bac à sable, seul vrai écart fonctionnel, n'apparaît nulle part sur les pages de tarifs ni dans les FAQ (0 occurrence de « bac à sable » ou « sandbox » dans `pricing.html`, `en/pricing.html`, `faq.html`, `en/faq.html`).

Écarts de chiffres entre le site et le moteur :

- Plafond produits Scale : le site dit 50 000 (`pricing.html:293`, `en/pricing.html:281`), le moteur applique 100 000 (`usage.py:61`). La carte Enterprise se présente comme « au-delà de 50 000 produits ».
- Les CGV nomment les plans « Free, Growth, Scale » (`cgv.html:194`, `en/cgv.html:208`). Le plan « Free » n'existe pas dans le moteur, et Starter n'est pas cité.

**Constat** : les paliers diffèrent presque uniquement par les volumes. Le site ne porte pas cet argument, et ses cartes suggèrent un étagement de fonctionnalités que le moteur n'applique pas.

---

## 2. Dépassement : ce que fait le moteur, ce que dit le site

### Le moteur (vérifié)

- `OVERAGE_GRACE = 0.10` (`heurix/usage.py:54`). Vérifié.
- **Requêtes de recherche, trial/starter/growth** : `check_request_limit` (`usage.py:1299-1328`) lève `PlanLimitExceeded` dès que `used >= limite x 1,10`. Ça s'applique à la recherche (`routers/index.py:176`) et à la recherche fédérée (`routers/index.py:799`). Le gestionnaire renvoie un **429** avec `upgrade_url` vers `pricing.html` (`heurix/main.py:463-472`). Vérifié.
- **Requêtes de recherche, scale** : `overage_billed: True`, jamais bloquées (`usage.py:1317-1318`).
- **Produits, tous plans, Scale compris** : import refusé (429) au-delà de `plafond x 1,10` (`usage.py:1344-1358`).
- **Catalogues** : refus dès que le plafond est atteint, sans marge (`usage.py:1330-1342`).
- **Ranking/Browse** : aucun palier payant n'est jamais bloqué (`usage.py:75-86`). Le palier `none` renvoie 403.
- **Alerte** : un email à 80 % du quota, une fois par mois (`heurix/deps.py:170-193`).
- **Facturation du surplus** : les seuls appels Stripe du moteur sont `checkout.Session.create/retrieve`, `billing_portal.Session.create` et `Webhook.construct_event`. Aucun ne transmet l'usage. Rien dans `heurix/` n'envoie donc le surplus de Scale (« 0,80 € / 1 000 ») à la facturation. Je n'ai pas lu la configuration du compte Stripe.
- Tests : `tests/test_plans_quotas.py` (dont `test_request_limit_blocks_beyond_grace` et `test_scale_plan_never_blocked_bills_overage_instead`) : 37 verts, lancés sans cache ni bytecode, arbre du moteur resté propre.

### Ce que dit le site sur le dépassement

Toutes ces pages disent que le surplus est facturé et que le service n'est jamais coupé, sans distinguer les plans :

| Page | Où | Ce qui est affirmé |
|---|---|---|
| `pricing.html` / `en/pricing.html` | tableau de comptage, `:479` / `:467` | surplus facturé « au tarif indiqué sur votre plan », jamais de coupure brutale |
| `pricing.html` / `en/pricing.html` | FAQ, `:559` / `:547` | « Le service continue de fonctionner normalement », surplus facturé par tranche |
| `faq.html` / `en/faq.html` | `:323` | jamais de coupure brutale, surplus facturé |
| `cgv.html` / `en/cgv.html` | art. 7, `:225` / `:239` | surplus facturé, « sans interruption du Service au moment du dépassement » |

Écarts avec le moteur :

- **Pour trial, starter et growth, c'est faux** : le moteur coupe la recherche en 429 à 110 %.
- **Aucun tarif de dépassement n'existe** sur les cartes Starter et Growth. « Le tarif indiqué sur votre plan » ne renvoie à rien pour ces deux plans.
- **Même pour Scale**, la facturation du surplus n'est pas câblée côté moteur.
- **La question du pic ponctuel** n'est pas posée : une campagne ou un mois exceptionnel fait-il changer de palier ? Depict y répond. Chez nous, le moteur a un compteur mensuel et 10 % de marge, puis bloque. Le site n'en dit rien.

### Ce qui compte comme une requête

- Le site : chaque recherche tapée compte pour une requête, le moteur répondant dès la 3e lettre (`pricing.html:475`). Il ne dit pas combien de requêtes coûte un mot tapé lettre à lettre.
- Les bots : 0 mention sur les pages de tarifs, les FAQ et la documentation. **La question n'est pas posée.**

### Annulation

- Question présente sur `pricing.html:545` / `en/pricing.html:533` : « Puis-je changer de forfait ou arrêter à tout moment ? » Réponse : oui, sans engagement. On la retrouve dans la note sous les cartes et dans les CGV art. 8 (`cgv.html:232`).
- Absente de `faq.html` / `en/faq.html`.
- Non posée nulle part : ce qui arrive quand on descend de palier. Selon le moteur (docstring `usage.py:723-732`), la descente est acceptée en silence et c'est le prochain import qui échoue en 429.

### Essai

- 14 jours, sans carte bancaire, 2 000 requêtes et 2 000 produits (`faq.html:267`, FAQ tarifs `:538`).
- **Palier gratuit permanent : pas sur les pages de tarifs.** Pourtant, dans le moteur, une clé `trial` expirée garde les plafonds d'essai sans limite de durée (`usage.py:90-102`, `test_trial_expiry_reverts_to_trial_limits`) : 2 000 requêtes par mois, 2 000 produits, 2 catalogues. Rien ne la bloque à l'expiration.
- Le seul texte public qui le dit : l'article 6 des CGV (`cgv.html:218-223`), une page en `noindex`.
- La meta description des pages de tarifs dit « à partir de gratuit » / « starting free » (`pricing.html:7`, `en/pricing.html:7`). Aucune carte ne montre ce palier.
- Filigrane : sans objet, nous n'en avons pas.

---

## 3. Où se trouve notre démonstration réelle

| Démonstration | Nature | Depuis l'accueil |
|---|---|---|
| Widget du hero (`index.html:232-250`, `en/index.html:215`) | Réelle : champ de saisie libre, 2 verticales (outillage, mode), 4 suggestions, appelle `/v1/public-demo/search` (`demo-search-live.js:20-22`) | **0 clic**, premier bloc de la page |
| Boutique `demo/index.html` (Ranking, clé publique) | Réelle (`demo-boutique.js:30-31`) | **2 clics** sur ordinateur (bouton « Produit », puis « Lancer la démo », `index.html:131`), seulement au-dessus de 1 080 px |
| Épinglage `fonctionnalites.html` | **Scriptée** : 4 produits figés, aucun appel réseau (`demo-epinglage.js:6-8`) | page Fonctionnalités |
| Vidéo tolérance aux fautes (`fonctionnalites.html:256`) | Enregistrée | page Fonctionnalités |

Accès à la boutique :

- Sous 1 080 px, l'encart du menu est masqué (`styles.css:4696` puis `:4752`). `mobile-nav.js` ne contient aucun lien vers la démo, et le pied de page non plus.
- **Sur mobile et tablette, la boutique n'est pas atteignable depuis l'accueil.** Le seul lien `demo/` de l'accueil est cet encart.

Ce que le site dit du caractère réel de la démo :

- Le hero ne dit pas que le widget interroge le vrai moteur. Aucune étiquette, et le bandeau de preuves (`index.html`, `preuves-bandeau`) n'en parle pas.
- La phrase « La démonstration en haut de page tourne sur ce moteur » se trouve plus bas, dans la section `#moteur` (`index.html:350` et `:370`, `en/index.html:324`).
- `mesure.html:220` / `en/mesure.html:224` le dit aussi, avec le catalogue de 2 821 fiches (`mesure.html:148`, mesure du 2 septembre 2026).
- `faq.html:330` / `en/faq.html:330` pose « La démo sur cette page utilise-t-elle vraiment le moteur ? ». Or la page FAQ ne porte aucun widget (0 `play-input`). **La question renvoie à une démo absente de la page où elle est posée.**

Délai de réponse :

- Le site cite « ≈ 10 ms » (`median_query_time`, `index.html:354`, `:406`, sur un catalogue de 10 000 produits), pas 80 ms.
- Je n'ai rien mesuré. Les deux chiffres ne désignent probablement pas la même grandeur (temps moteur contre aller-retour), mais le site ne précise pas laquelle il donne.

`en/fonctionnalites.html` n'a pas la démo d'épinglage (0 `demo-pin`).

---

## 4. L'existence publique de pin, boost et bury

### Côté moteur

- Chaque résultat de **recherche** porte `pinned` et `buried` (`heurix/search.py:395-396`). **Pas de `boosted` en recherche.** `boosted` n'existe que dans les réponses **Browse/Ranking**, avec `pinned` et `buried` (`heurix/browse.py:398-400`).
- Points d'entrée :
  - épingler/reléguer sur une requête : `routers/index.py:277` ;
  - épingler/reléguer dans une catégorie : `routers/browse.py:211` ;
  - boost/relégation par attribut : `routers/browse.py:245`.
- Épingler ou reléguer en recherche ne demande aucun plan : c'est inclus dans tous les plans Search.

### Côté site

Balayage PCRE, insensible à la casse, FR et EN, avec deux motifs :

- **Motif étroit** (pin, boost, bury, épingl) : témoin positif de 3 lignes dans `pricing.html` et 19 dans `docs.html`.
- **Motif large** (le précédent plus merchandising, mise en avant, enterr, rétrograd) : témoin positif de 4 lignes et 25 lignes. C'est celui qui a été passé sur les pages solutions.

Les deux rendent 0 sur les 24 pages solutions.

| Surface | Présence |
|---|---|
| Documentation FR/EN | **Documenté** : priorités de requête (`docs.html:537-547`, `en/docs.html:524-534`), épinglage de catégorie (`docs.html:635`, `en/docs.html:622`), boost/relégation par attribut (`docs.html:646`, `en/docs.html:633`), glossaire (`docs.html:1285`, `en/docs.html:1272`) |
| Documentation, champs de réponse | **Absent** : aucun exemple JSON ne montre `pinned` ou `buried` dans un résultat de recherche |
| Pages solutions (24) | **0 occurrence** |
| Tarifs | « Épinglage » seulement sur les cartes **Ranking** (`pricing.html:348`, `:360`, `:372`). Rien sur les cartes Search, alors que l'épinglage de recherche y est inclus. Boost et relégation par attribut absents. |
| Fonctionnalités | FR : épinglage de catégorie et démo scriptée (`fonctionnalites.html:402-440`). EN : un paragraphe (`en/fonctionnalites.html:352`), sans démo. Épinglage de recherche et boost par attribut absents des deux. |
| Accueil | Seulement « merchandising manuel » dans une ligne de pseudo-réponse (`index.html:362`) |
| Blog | `blog/mettre-en-avant-une-promotion.html` et son équivalent EN (6 lignes chacun) |

**Constat** : ce n'est pas invisible, c'est cantonné.

- La documentation et un article de blog le décrivent.
- Les pages commerciales le présentent comme une fonctionnalité de Ranking, un produit payant à part.
- Les 24 pages solutions n'en parlent jamais.
- Le fait que l'épinglage de recherche est inclus dans chaque plan Search n'est écrit nulle part hors de la documentation.
