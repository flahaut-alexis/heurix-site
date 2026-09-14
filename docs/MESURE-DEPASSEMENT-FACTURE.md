# Dépassement facturé : ce que le site promet, ce que le moteur fait

Relevé du 14 septembre 2026. Ce lot mesure et propose. Il ne change ni le site ni le moteur.

## Sur quoi c'est lu

| Dépôt | SHA lu | Vérification |
|---|---|---|
| heurix-site | `ede131de` | La consigne donnait `24a4da64`. `ls-remote` a rendu `24a4da64` à 23:23, puis `ede131de` à 23:29. Quatre commits d'une session voisine ont modifié `docs.html` et `en/docs.html` (931f7b22, 63a5db90 : « la documentation ne promet plus un 429 »). La branche a été avancée et ces deux fichiers relus : les lignes citées ici sont celles de `ede131de`. Le main local du dépôt principal porte `017f1cfd`, pas encore sur origin. Il touche la console, et son diff contient 0 ligne avec factur, billed, dépass, overage, quota, surplus, coupure ou cutoff. |
| heurix-engine | `cf6a61b` | `ls-remote` à 23:23 et à 23:29 : inchangé. |
| heurix-shopify | `1ef7d64` | origin/main à 23:23 |
| heurix-woocommerce | `500d859` | origin/main à 23:23 |
| heurix-prestashop | `9d02999` | origin/main à 23:23 |

Worktrees : `~/wt/<dépôt>-mesure-depassement-facture`. Branche `mesure-depassement-facture` côté site, HEAD détaché ailleurs.

**Non lus, et chacun pèse sur le point 3 :**

- la base de production (clés, plans, compteurs) ;
- la configuration du compte Stripe ;
- le texte des plans affiché par Shopify, saisi dans le Partner Dashboard et absent du dépôt.

## Résumé

1. **Aucun plafond de requêtes ne coupe, et aucun dépassement n'est facturé, sur aucun plan.** Cela vaut pour la recherche comme pour le Ranking. `overage_billed` est une étiquette : aucun code de facturation ne la lit. Seuls les produits (au-delà de 110 %) et les catalogues sont refusés.
2. **La promesse est contractuelle.** L'article 7 des CGV dit « le surplus est facturé ». L'article 5 intègre la page tarifs aux CGV, et l'article 4 y intègre la documentation. Tout cela depuis les 16-20 juillet 2026.
3. **Un tarif de dépassement n'est publié que pour Scale (recherche), à 0,80 € / 1 000.** Pour Starter et Growth (recherche) et pour les trois paliers Ranking, « le tarif indiqué sur votre plan » ne renvoie à rien.
4. **Le plafond produits Scale vaut toujours 100 000 dans le moteur**, refus à 110 001, et toujours 50 000 sur le site.
5. **L'écart joue en faveur du client** : il paie moins que ce que la page annonce. Ce qui peut lui être dû ne tient pas à la facturation. Ce sont les coupures subies avant le 12 septembre, alors que l'article 7 promettait « sans interruption ». Cela se lit en production, pas ici.

---

## 0. Ce qui a changé depuis l'audit

`docs/AUDIT-OFFRE-2026-09.md` est titré « relevé du 11 septembre 2026 ». Deux de ses constats du point 2 ne sont plus vrais :

- « Pour trial, starter et growth, le moteur coupe la recherche en 429 à 110 % ». Ce n'est plus le cas depuis `266a90e` (moteur, 12 septembre 2026 à 10:21, option A de `MESURE-DEPASSEMENT-QUOTA.md`) : le quota de requêtes ne coupe plus aucun plan. Ce commit dit aussi « aucune facturation à l'usage n'est ajoutée ».
- Les numéros de ligne moteur de l'audit sont périmés. `PLAN_LIMITS` est désormais à `heurix/usage.py:74-79`.

Ce qui reste vrai de l'audit : aucun tarif de dépassement sur Starter et Growth, aucun envoi d'usage à Stripe, Scale à 50 000 contre 100 000.

Le relevé du 14 septembre (« dépassement facturé sur Starter et Growth, mais `overage_billed: False` ») confond deux produits :

- Les **cartes** qui écrivent « Dépassement facturé à l'usage » et s'appellent Starter et Growth sont les cartes **Ranking** (`pricing.html:350`, `:362`). Là, le moteur a `overage_billed: True`.
- Les plans de **recherche** Starter et Growth ont bien `overage_billed: False`. La promesse qui les touche est la formule générale (tableau de comptage, FAQ, CGV), pas une carte.

Dans les deux cas, rien n'est facturé.

---

## 1. Ce que le moteur fait de chaque plan

### Mesure

Le script est dans le scratchpad de session, non versionné. Il exécute `UsageDB` sur une base jetable, avec `PYTHONPATH` sur le worktree moteur. La première ligne imprimée vérifie l'import : `heurix importé depuis /Users/poulet/wt/heurix-engine-mesure-depassement-facture/heurix/__init__.py`. Le worktree est resté propre.

Pour chaque plan, le script :

- crée une clé ;
- consomme **3 fois** le quota mensuel ;
- appelle le contrôle de requêtes ;
- appelle le contrôle de produits à `plafond x 1,10`, puis une unité au-dessus.

Le cœur du script :

```python
db.count(k, amount=lim["requests"] * 3)
r = db.check_request_limit(k)
db.check_product_limit(k, int(p * 1.10))        # au bord
db.check_product_limit(k, int(p * 1.10) + 1)    # au-delà
db.set_browse_plan(k, bp); db.browse_count(k, amount=max(lim["requests"], 1) * 3)
db.check_browse_request_limit(k)
```

Limite : les méthodes sont appelées directement, pas par HTTP. Sur HTTP, le palier Browse `none` est arrêté plus tôt, en 403, par `_require_browse_access` (`heurix/deps.py:227`, appelé à `routers/browse.py:70` avant le quota à `:92`).

### Recherche (`PLAN_LIMITS`, `heurix/usage.py:74-79`)

| Plan | Requêtes/mois | `overage_billed` | À 3 fois le quota (mesuré) | Produits | Refus produits (mesuré) | Catalogues |
|---|---|---|---|---|---|---|
| trial | 2 000 | False | servi, `over_limit` vrai | 2 000 | 2 200 accepté, **2 201 refusé** | 2 |
| starter | 15 000 | False | servi, `over_limit` vrai | 8 000 | 8 800 accepté, **8 801 refusé** | 1 |
| growth | 30 000 | False | servi, `over_limit` vrai | 25 000 | 27 500 accepté, **27 501 refusé** | 3 |
| scale | 150 000 | True | servi, `over_limit` vrai | **100 000** | 110 000 accepté, **110 001 refusé** | illimité |

- `check_request_limit` rend toujours `allowed: True` (`usage.py:1432`). Le commentaire `:1429-1431` le dit : « `overage_billed` n'est plus lu ici ». Le drapeau « décrit la facturation, pas la coupure », et aucun code de facturation ne le lit (voir plus bas).
- Les catalogues sont refusés dès que le plafond est atteint, sans marge (`usage.py:1441`). Non remesuré ici.

### Ranking / Browse (`BROWSE_PLAN_LIMITS`, `heurix/usage.py:92-103`)

| Palier | Requêtes/mois | `overage_billed` | À 3 fois le quota (mesuré) |
|---|---|---|---|
| none | 0 | False | refus `browse_requests` (403 sur HTTP, voir la limite ci-dessus) |
| starter | 50 000 | True | servi, `over_limit` vrai |
| growth | 150 000 | True | servi, `over_limit` vrai |
| scale | 500 000 | True | servi, `over_limit` vrai |
| enterprise | 1 000 000 | True | servi, `over_limit` vrai |

Ici `overage_billed` est lu, mais seulement pour décider de ne pas couper (`usage.py:1543`) : `True` rend `allowed` vrai sans lire le plafond.

### Ce qui se passe au-delà du quota, sur tous les plans

- **Servi et compté.** `over_limit` passe à vrai.
- **Alerte à 80 %** : `heurix/email_sender.py:413`. Le texte dit « Votre recherche continue de fonctionner, même au-delà : nous ne la coupons pas » et invite à monter de palier. Il ne parle pas de facturation.
- **`GET /v1/usage`** publie `used`, `limit` et `over_limit`. Il ne publie pas `overage_billed` (`routers/admin.py:296-334`).
- **Rien n'est facturé.** Le moteur fait sept appels Stripe, tous dans `heurix/billing.py` :
  - `checkout.Session.create` (`:320`, `:358`, `:379`) ;
  - `billing_portal.Session.create` (`:396`) ;
  - `checkout.Session.retrieve` (`:409`) ;
  - `Webhook.construct_event` (`:427`).

  Aucun ne transmet d'usage. Les lignes de checkout portent un `price` tiré de `STRIPE_PRICE_*` avec `quantity: 1` (`:244`, `:253`, `:360`).
- **Stripe** : la configuration du compte n'est pas lisible depuis le dépôt. Même si un prix y était « à l'usage », rien ne lui envoie de consommation.

### Scale : 50 000 sur le site, 100 000 dans le moteur, toujours vrai

- Moteur : `usage.py:78`. Refus mesuré à 110 001 produits.
- Site (`ede131de`) :
  - carte : `pricing.html:293`, `en/pricing.html:281` ;
  - Enterprise « au-delà de 50 000 produits » : `pricing.html:316`, `en/pricing.html:304` ;
  - note du calculateur : `pricing.html:458`, `en/pricing.html:446` ;
  - constante du calculateur : `pricing.html:642`, `en/pricing.html:630` ;
  - documentation : `docs.html:352`, `en/docs.html:338`.
- `heurix-shopify/heurix_shopify/plans.py` recopie aussi 100 000 (« pour mémoire »).

Conséquence : le calculateur envoie vers un devis Enterprise un prospect qui a 50 001 à 110 000 produits, alors que Scale l'accepterait. Cet écart-là est en défaveur du prospect et de la vente, pas du client.

---

## 2. Tout ce qui promet une facturation au dépassement

### Balayage et témoin

Trois motifs `git grep -i -I`, sur les fichiers `*.html *.js *.json *.txt *.md` du site (`ede131de`), hors `docs/` et `tests/`. Les index de recherche `search-index-*.json` sont dérivés et exclus des motifs 2 et 3.

1. **Motif étroit** : `dépassement|overage|surplus|excédent|au-delà du quota|beyond your plan|facturé à l'usage|billed|par tranche|coupure|cut off|interruption`.
   - Témoin positif : `pricing.html` 9 lignes, `cgv.html` 2. On y retrouve les lignes que citait l'audit, qui ont bougé depuis : `pricing.html:479`, `:561` (l'audit disait `:559`), `cgv.html:228` (`:225`).
   - **Ce qu'il a raté**, trouvé par les deux motifs suivants :
     - `docs.html:352` « 150 000 puis facturé » ;
     - `en/fonctionnalites.html:410` (« cutoff » en un mot) ;
     - les metas `pricing.html:7` et `:13` ;
     - `llms.txt:11` ;
     - `pricing.html:463` et `:707`.
   - `pricing.html:292` (« puis 0,80 € / 1 000 ») n'a été attrapé **que par le nom de classe** `price-tier-overage`.
2. **Motif élargi** : `factur|billed|cutoff|cut-off|cut off|coupure|then billed|rate shown|tarif indiqu`.
3. **Motif de modèle** : `usage-based|pay-as-you-go|metered|per use|by usage|à l'usage`.
4. **Motif de tarif** : `0[,.]80|€ / 1 000` et variantes. Il rend 2 lignes, `pricing.html:292` et `en/pricing.html:280`. Aucun autre tarif de dépassement n'est affiché sur le site.

Connecteurs : motif étroit, plus un balayage large sur les mots de plan et de quota (`quota|plafond|forfait|pricing|tarif|starter|growth|scale|429|upgrade_url|facturation|billing`).

| Dépôt | Motif étroit | Témoin d'invocation (`quota`) |
|---|---|---|
| heurix-shopify | 43 lignes, toutes sur la coupure de déploiement ou dans des `docs/MESURE-*` internes | 58 |
| heurix-woocommerce | 0 | 4 |
| heurix-prestashop | 1 : `TROUBLESHOOTING.md:156`, « no interruption for them », à propos des visiteurs | 23 |

Les motifs 2 et 3 n'ont pas été repassés sur les connecteurs.

### Qui lit quoi

- **Prospect** : page de vente, indexée.
- **Client** : a souscrit, lit la documentation, la console, les emails.
- **Contrat** : les CGV et ce qu'elles intègrent.
- **Validateur** : revue d'une place de marché (Shopify, WordPress.org, PrestaShop Addons).
- **Robots** : moteurs de recherche, assistants.

### Site, `ede131de`

| # | Où (FR / EN) | Promis | Plans visés | Lecteur | Depuis | Moteur |
|---|---|---|---|---|---|---|
| S1 | `pricing.html:7`, `:13` / `en/pricing.html:7`, `:13` (metas) | « Facturation à l'usage, sans engagement » / « Usage-based billing » | tous | prospect, robots | 16 juillet (`fae92791`) | aucune facturation à l'usage |
| S2 | `pricing.html:292` / `en:280`, carte Scale | « 150 000 requêtes / mois, puis 0,80 € / 1 000 » | Scale recherche | prospect | 20 juillet (`6749ea0c`) | servi, non facturé |
| S3 | `pricing.html:350`, `:362`, `:374` / `en:338`, `:350`, `:362`, cartes Ranking | « Dépassement facturé à l'usage, jamais de coupure » | Ranking Starter, Growth, Scale | prospect | 28 juillet (`04c70fab`) | `overage_billed: True`, servi, non facturé. **Aucun tarif Ranking publié.** |
| S4 | `pricing.html:463` / `en:451`, note du calculateur | trafic Browse « comptabilisé et facturé à part » | Ranking | prospect | 23 juillet (`603e4eae`) | vrai pour l'abonnement séparé ; ne dit rien du dépassement |
| S5 | `pricing.html:479` / `en:467`, tableau de comptage | surplus « facturé au tarif indiqué sur votre plan », jamais de coupure brutale | tous | prospect | 16 juillet (`fae92791`) | aucun tarif sur Starter ni Growth |
| S6 | `pricing.html:561` + JSON-LD `:85` / `en:549` + `:74`, FAQ | surplus « facturé au tarif par tranche indiqué sur votre forfait. Vous êtes prévenu avant tout dépassement significatif » | tous | prospect, robots (FAQPage) | 16 juillet (`fae92791`) | pas de tranche ; alerte email à 80 % |
| S7 | `pricing.html:679`, `:707` / `en:666`, `:690`, calculateur | « Scale + dépassement facturé », « + dépassement facturé » (Browse) | Scale, Ranking | prospect | 20 et 23 juillet | non facturé |
| S8 | `faq.html:325` + JSON-LD `:121` / `en/faq.html` (mêmes lignes) | « Jamais de coupure brutale : le surplus est facturé au tarif à l'usage indiqué sur la page tarifs » | tous | prospect, client, robots | 28 juillet (`f6312d07`) | non facturé |
| S9 | `llms.txt:11` | « plans Free (0 €), Growth (49 €/mois), Scale (139 €/mois), facturation à l'usage » | tous | assistants, robots | 19 juillet (`c3984093`) | non facturé ; pas de plan Free, Starter absent |
| S10 | `docs.html:322` / `en/docs.html:308` | « Dépassement (Scale) : le surplus est facturé au tarif indiqué sur la page tarifs, jamais de coupure » | Scale | client, intégrateur (CGV art. 4) | 20 juillet (`6749ea0c`) | non facturé |
| S11 | `docs.html:352` / `en/docs.html:338` | « 150 000 puis facturé », 50 000 produits | Scale | client (CGV art. 4) | 20 juillet | non facturé ; 100 000 produits |
| S12 | `cgv.html:228` / `en/cgv.html:242`, **art. 7** | « En cas de dépassement des volumes inclus dans le Plan, le surplus est facturé selon les règles de comptage publiques [...], sans interruption du Service au moment du dépassement » | tous les Plans | **contrat** | 20 juillet (`32bc2272`) | pas d'interruption depuis le 12 septembre ; non facturé |

Pas une promesse de facturation, pour mémoire :

- `fonctionnalites.html:538` / `en:410` « Jamais de coupure surprise en cas de dépassement ». Vrai depuis le 12 septembre.
- `docs.html:323` / `en:309` : réécrit ce soir par la session voisine, « pas de coupure non plus [...] servies et comptées ». Conforme au moteur.
- `blog/cout-moteur-recherche-ecommerce.html:196` / `en:195` : la question à poser à un fournisseur (« blocage brutal ou facturation transparente au-delà ? »). Elle cadre l'attente du lecteur.
- `shopify.html`, `woocommerce.html`, `prestashop.html` : 0 ligne. Elles renvoient à `pricing.html` (`:142`, `:269`).
- `search-index-fr.json`, `search-index-en.json` : dérivés, ils portent les textes ci-dessus.

### Les CGV, qui pèsent plus que la page de vente

Les CGV (`cgv.html`, `en/cgv.html`, « Version 1.0 » du 20 juillet 2026, `:145` / `:159`, en `noindex`) parlent explicitement du dépassement, et elles font entrer les autres pages dans le contrat :

- **art. 7** (`:228`) : surplus facturé, sans interruption ;
- **art. 5** (`:214`) : la page tarifs « fait partie intégrante des présentes CGV ». S1 à S8 sont donc contractuels ;
- **art. 4** (`:207-208`) : Fonctionnalités, Intégrations et Documentation « font partie intégrante de la présente offre par référence ». S10 et S11 aussi ;
- **art. 2** (`:195`) : la Requête est l'« Unité de facturation » ;
- **art. 2** (`:194`) : Plans « Free, Growth, Scale ». Ni Free ni l'absence de Starter ne correspondent au moteur ;
- **art. 5** (`:215`) : toute modification tarifaire est annoncée 30 jours avant et ne vaut que pour les échéances suivantes ;
- **modification des CGV** (`:267`) : toute modification substantielle est notifiée par email 30 jours avant ;
- **acceptation** : « En souscrivant, vous acceptez nos CGV » (`pricing.html:328`, `:381`) ;
- **note de transparence** (`:178`) : le document « n'a pas encore été relu par un professionnel du droit ».

### Console, emails, API (client)

- **Console** (`console.js`, `console-i18n.js`, `console.html`, à `ede131de` et dans le diff de `017f1cfd`) : aucune promesse de facturation au dépassement.
  - « facturé » n'y désigne que le bac à sable (`console.html:275`) et le prorata Stripe (`console.js:1665`).
  - Les jauges de quota (`console.js:1598-1636`) montrent le dépassement sans parler de prix.
- **Email d'alerte à 80 %** : « nous ne la coupons pas ». Rien sur la facturation.
- **`/v1/usage`** : `over_limit`, pas de drapeau de facturation.

### Connecteurs (marchand, validateur)

| Connecteur | Surface | Ce qui est dit | Lecteur |
|---|---|---|---|
| Shopify `1ef7d64` | app embarquée, README, `plans.py` | Aucune promesse de dépassement. Shopify facture des plans récurrents (App Pricing), `plans.py` fait correspondre un handle à un nom de plan. **Le texte des plans montré par Shopify n'est pas dans le dépôt : non lu.** | marchand, revue Shopify |
| WooCommerce `500d859` | `readme.txt`, écran d'admin | Aucune promesse. `readme.txt:32` renvoie à `docs.html`. Sur un 429, l'admin affiche « Voir les offres Heurix » (`class-heurix-admin.php:168`). | marchand, revue WordPress.org |
| PrestaShop `9d02999` | `README.md`, `TROUBLESHOOTING.md`, `README-VALIDATION.md` | Aucune promesse de facturation. Mais « quota exceeded (429) [...] lasts until the end of the billing period » (`heurixsearch/README.md:76-80`, `TROUBLESHOOTING.md:147-160`, `src/HeurixClient.php:245-246`) est périmé depuis `266a90e` : un 429 ne vient plus que des produits et des catalogues. Voisin du sujet, hors facturation. | marchand, validateur Addons |

---

## 3. Lequel doit changer

### Ce qu'un client qui a signé est en droit d'attendre

Ce qui suit est une lecture des textes, pas un avis juridique. Les CGV disent elles-mêmes n'avoir été relues par personne du métier.

**L'article 7 contient deux promesses de nature opposée.**

- **« Sans interruption du Service au moment du dépassement »** est un droit du client.
  - Il a été tenu à partir du 12 septembre 2026 à 10:21 (`266a90e`).
  - Du 20 juillet au 12 septembre, le moteur coupait trial, starter et growth à 110 %.
  - **Si un client a été coupé dans cette fenêtre, c'est là que se trouve l'engagement non tenu.** Aucune correction du site ou du moteur ne le règle aujourd'hui.
- **« Le surplus est facturé »** donne un droit à Heurix et une obligation au client. Ne pas facturer ne lèse pas le client.
  - Ce qu'il peut attendre, c'est de ne pas se voir facturer un surplus à un prix qui ne lui a jamais été montré.
  - Pour Starter et Growth (recherche) et pour les trois paliers Ranking, ce prix n'existe nulle part (S3, S5, S6, S8).
  - Seul Scale (recherche) affiche 0,80 € / 1 000 (S2).

**Envers le prospect**, l'écart est favorable côté prix : il paiera moins que ce qu'il a lu. Deux affirmations le desservent :

- « au-delà de 50 000 produits, voir Enterprise », alors que Scale en accepte 110 000 ;
- « vous êtes prévenu avant tout dépassement significatif » (S6). L'alerte existe, mais seulement par email. `MESURE-DEPASSEMENT-QUOTA.md` (moteur, 11 septembre, non remesuré ici) note qu'elle n'atteint aujourd'hui que les clients Stripe.

**Les validateurs** ne lisent aucune promesse de dépassement dans les fiches des trois connecteurs. Le texte des plans Shopify reste à lire.

### Option A : le site dit la vérité du moteur

**Coût moteur : 0.**

**Coût site** : environ 33 lignes FR et EN dans 9 fichiers :

- S1, S2, S3, S5, S6 (avec son JSON-LD), S7 : `pricing.html` et `en/pricing.html` ;
- S8 (avec son JSON-LD) : `faq.html`, `en/faq.html` ;
- S9 : `llms.txt` ;
- S10, S11 : `docs.html`, `en/docs.html` ;
- S12 : `cgv.html`, `en/cgv.html` ;
- plus la régénération des deux index de recherche.

S4 peut rester. Scale à 50 000 produits est un écart distinct, dans les mêmes fichiers.

**Coût contractuel** : l'article 7 change. Retirer une facturation que personne n'a jamais payée est a priori en faveur du client. Reste à trancher si c'est une « modification substantielle » au sens de `cgv.html:267`, ce qui imposerait l'email et les 30 jours. Le geste prudent est de notifier.

**Coût commercial** :

- On renonce à un revenu de dépassement qui vaut aujourd'hui 0.
- La montée en gamme ne repose plus que sur l'email à 80 % et les jauges de la console.
- Un client très au-delà de son quota n'a plus aucune contrepartie contractuelle, hors manquement grave (art. 8).

Ordre de grandeur, à partir du chiffre de `266a90e` (12,1 ms de CPU serveur par recherche servie, non remesuré ici) : un client Scale à 1 000 000 de requêtes par mois coûte 850 000 recherches au-delà, soit environ 2 h 50 de CPU. C'est 0,2 % d'un mois de 2 vCPU. Il paierait 139 € sous A, et 139 + 680 € sous B.

### Option B : le moteur tient la promesse du site

**Préalable hors moteur : cinq tarifs à créer.** Il en faut un pour Starter et Growth (recherche), et un pour chacun des trois paliers Ranking. Les publier est une modification tarifaire (art. 5, `:215`) : 30 jours de préavis, et seulement pour les échéances suivantes. Rien ne peut être facturé rétroactivement sur un prix jamais affiché. Pour Scale (recherche), le prix est publié depuis le 20 juillet. Commencer à le prélever reste un changement de fait, à faire relire.

**Moteur, à partir de zéro** (aucun envoi d'usage aujourd'hui) :

- des prix « à l'usage » côté Stripe, dont la configuration n'est pas lisible ici ;
- une tâche mensuelle qui lit `usage` et `browse_usage` (`key, month, requests`, `usage.py:1505` et `:1556`), envoie un relevé par client et par mois, et reste idempotente ;
- les cas particuliers :
  - les abonnés annuels (`STRIPE_PRICE_*_ANNUAL`) ;
  - les clés trial, sans client Stripe ;
  - le bac à sable, promis « non facturé » (`console.html:275`, `docs.html:1292`). Que son trafic soit exclu du compteur n'a pas été vérifié ici.
- **les marchands Shopify** : ils sont facturés par Shopify, pas par Stripe. Leur dépassement devrait passer par la facturation Shopify, un chemin non étudié (`MESURE-SHOPIFY-05` ne traite que les plans récurrents).

**Le compteur devient une facture**, et ses défauts deviennent des litiges :

- les robots ne sont pas séparés (audit, point 2) ;
- la frappe lettre à lettre compte ;
- une clé publique se réutilise en forgeant `Origin` (`MESURE-DEPASSEMENT-QUOTA.md`, `deps.py:387-393`, non relu ici), donc un tiers peut gonfler la facture d'un client.

Sous A, ce sont des défauts de statistiques. Sous B, la limite de débit par clé, encore ouverte, devient un préalable.

**Revenu** : inconnu. Personne ne sait si une clé dépasse, et cela se lit en production.

### Ce qui manque pour trancher : deux lectures de production

Les deux options se chiffrent sur les mêmes lectures, et la question « un client a-t-il été coupé avant le 12 septembre ? » aussi. Colonnes vérifiées dans `usage.py` (`api_keys.plan`, `api_keys.browse_plan`, `api_keys.key_type`, `usage` et `browse_usage` en `key, month, requests`). Aucune n'a été lancée.

```sql
-- Clés par plan.
SELECT plan, browse_plan, COUNT(*) FROM api_keys WHERE key_type != 'public' GROUP BY 1, 2;

-- Mois au-delà du quota de recherche, par plan ACTUEL de la clé.
SELECT k.plan, u.month, COUNT(*) AS cles, MAX(u.requests) AS max_requetes
FROM usage u JOIN api_keys k ON k.key = u.key
WHERE u.requests > CASE k.plan WHEN 'trial' THEN 2000 WHEN 'starter' THEN 15000
                               WHEN 'growth' THEN 30000 WHEN 'scale' THEN 150000 END
GROUP BY 1, 2 ORDER BY 2;

-- Même lecture pour le Ranking.
SELECT k.browse_plan, b.month, COUNT(*) AS cles, MAX(b.requests) AS max_requetes
FROM browse_usage b JOIN api_keys k ON k.key = b.key
WHERE b.requests > CASE k.browse_plan WHEN 'starter' THEN 50000 WHEN 'growth' THEN 150000
                                      WHEN 'scale' THEN 500000 WHEN 'enterprise' THEN 1000000 END
GROUP BY 1, 2 ORDER BY 2;
```

Deux limites à ces requêtes :

- **Le plan lu est le plan actuel.** Le moteur ne garde aucun historique de plan (`heurix-shopify/heurix_shopify/plans.py`, « une seule colonne `api_keys.plan` »).
- **Les coupures d'avant le 12 septembre.** Une clé coupée devrait plafonner vers 110 % du quota, à condition que les refus n'aient pas été comptés. Ce point n'est pas vérifié.

### Proposition

**A pour Starter et Growth (recherche) et pour les trois paliers Ranking.**

- Aucun tarif n'existe pour eux.
- B demanderait d'en publier avec préavis et de construire une facturation, y compris un chemin Shopify non étudié.
- Le client n'est pas lésé par l'absence de facturation.

**Pour Scale (recherche), la décision dépend de la production.**

- Si aucune clé Scale ne dépasse 150 000, A pour tout, et la ligne « puis 0,80 € / 1 000 » disparaît.
- Si des clés Scale dépassent nettement, B limité à Scale a un argument de revenu. Il reste soumis au préalable Stripe et au préavis.

**Quelle que soit l'option** :

- l'article 7 change au moins pour les plans sans tarif, avec la notification de `cgv.html:267` ;
- si la production montre des clés coupées entre le 20 juillet et le 12 septembre, ces clients sont à traiter un par un. Aucune des deux options ne les couvre.
