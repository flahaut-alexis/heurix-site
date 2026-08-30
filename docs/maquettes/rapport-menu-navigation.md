# Refonte des menus Produit / Solutions / Developers — rapport

Maquette associée : `menu-navigation.html`, ce même dossier. Ouvrir le fichier
directement (double-clic, ou `python3 -m http.server` puis localhost) — thème
clair/sombre et aperçu bureau/mobile se pilotent depuis la barre en haut de
la page, aucune des deux fenêtres n'exige de redimensionner le navigateur
(le bouton "Mobile (390)" force la largeur via `@container`, qui déclenche
la même règle CSS qu'un vrai `@media (max-width:768px)`).

Aucune page du site n'a été modifiée. Tout ce qui suit vient de la lecture
du site en ligne le 29 août 2026 (DOM rendu, `styles.css`, `sitemap.xml`,
`docs/maquettes/README.md`) — pas d'hypothèse non vérifiée.

## 1. Ce que les trois menus actuels ne montrent pas

**Produit** (5 liens : Le problème, Notre mission, Le moteur → ancres de
`produit.html` ; Fonctionnalités → `fonctionnalites.html` ; Simulateur ROI →
`roi.html`) ne distingue pas deux natures différentes : trois ancres qui
racontent l'argumentaire produit sur une seule page, et deux pages à part
entière. La liste plate les met sur le même plan.

**Solutions** (11 secteurs) est la plus contrainte par le format actuel :
onze lignes dans une colonne de 238px obligent à faire défiler le regard
verticalement pour un simple survol des options, et surtout — **le menu ne
pointe vers aucune page de synthèse.** `secteurs.html` existe déjà
(« Les secteurs couverts par Heurix », les onze mêmes secteurs avec icône,
description et pack de règles associé) mais n'est référencé nulle part dans
ce menu. C'est une page qui existe et qu'un panneau large peut exposer sans
rien inventer.

**Developers** (6 liens : Documentation, Intégrations, PrestaShop,
WooCommerce, Shopify, Guide de mise en route) mélange trois natures à plat :
- une page de référence unique mais considérable — `docs.html` a sa propre
  navigation interne en 3 groupes (**Prise en main**, **Endpoints**,
  **Référence**) et des dizaines de sous-sections ;
- quatre pages plateformes qui forment un ensemble cohérent (Intégrations +
  les 3 connecteurs e-commerce) mais ne sont pas regroupées visuellement ;
- un article de blog (« Guide de mise en route ») qui sert de première
  lecture aux développeurs mais n'est distingué ni de la documentation ni
  des plateformes.

Deux liens vers `docs.html` sont déjà mis en avant ailleurs sur le site —
« Comment ça marche → docs.html#cascade » et « Structure des produits →
docs.html#produits » (vus sur `fonctionnalites.html`) — sans qu'aucun des
deux n'apparaisse dans le menu Developers lui-même.

Point commun aux trois : le format liste verticale ne laisse aucune place à
un lien de synthèse (« tout voir »), à un regroupement visuel, ni à un
signal de profondeur — un visiteur ne peut pas deviner depuis le menu que
Solutions a une page dédiée ou que Documentation est aussi vaste.

## 2. Ce que change la maquette (commun aux deux thèmes)

Le changement est structurel, pas cosmétique — les deux thèmes partagent
exactement le même balisage et la même logique :

- **Produit** passe de 5 liens à plat à 2 groupes : *Le produit* (Le
  problème, Notre mission, Le moteur) et *Aller plus loin* (Fonctionnalités,
  Simulateur ROI).
- **Solutions** passe de 11 liens en 1 colonne à 11 liens en 2 colonnes
  (6 + 5, ordre inchangé), précédés d'un lien vedette *Tous les secteurs →*
  vers `secteurs.html` — aujourd'hui absent du menu alors que la page existe.
- **Developers** passe de 6 liens à plat à 2 groupes : *Documentation*
  (Documentation, Comment ça marche, Structure des produits, Guide de mise
  en route) et *Plateformes* (Intégrations, PrestaShop, WooCommerce,
  Shopify) — reprenant telles quelles les deux ancres déjà promues sur
  `fonctionnalites.html`, sans en inventer de nouvelles.
- Le panneau s'ouvre au **clic**, jamais au survol — comportement identique
  à l'existant (`.nav-drop`, commentaire du CSS : un survol ne se produit
  pas au doigt et gêne au clavier). Un seul panneau ouvert à la fois.
- **Échap** referme le panneau et rend le focus au bouton qui l'a ouvert —
  vérifié sur l'existant, reproduit à l'identique.
- **Tab** parcourt les liens dans l'ordre naturel du DOM (colonne 1 puis
  colonne 2) ; aucune touche fléchée n'est nécessaire ni interceptée —
  l'existant n'en a pas non plus (`ArrowDown` ne fait rien sur le menu en
  production, vérifié).
- **Amélioration** par rapport à l'existant : un panneau ouvert se referme
  maintenant quand le focus quitte entièrement la zone de navigation
  (`focusout`). Aujourd'hui, `Tab` au-delà du dernier lien laisse le panneau
  ouvert derrière le bouton suivant (vérifié en direct) — ce n'est pas
  cassé, mais ce n'est pas non plus un comportement à reproduire.
- **Sous 768px** (voir §4) : chaque panneau s'aplatit en une seule colonne,
  empilée sous son bouton, exactement comme le fait déjà
  `.nav-drop-panel` en mobile aujourd'hui — rien n'est masqué, rien ne perd
  de lien.
- **Rien d'autre dans le header ne change** : logo, recherche, sélecteur de
  langue, « Mon compte » et les deux boutons d'action gardent leur
  apparence et leur position actuelles, clair ou sombre.

Coût de propagation mesuré sur le fichier de maquette lui-même (balisage
réel du panneau, hors CSS/JS partagés qui ne vivent qu'une fois dans
`styles.css`/`nav-dropdown.js`) :

| Menu | Lignes aujourd'hui | Lignes dans la maquette |
|---|---|---|
| Produit | 5 | 20 |
| Solutions | 11 | 26 |
| Developers | 6 | 23 |

Aucun des trois n'approche les 30 lignes jugées trop coûteuses à propager
sur 124 pages.

## 3. Ce qui distingue les deux thèmes — et pourquoi le sombre est un aplat

Les jetons sont copiés de `styles.css` (lu le 29 août 2026), aucune valeur
n'est inventée.

**Clair** : panneau `#FFFFFF`, texte `--ink` / `--ink-muted`, survol en
`--blue-tint` + `--blue-deep` — exactement la famille déjà utilisée par
`.nav-drop-panel` aujourd'hui.

**Sombre** — et c'est la décision qui méritait d'être mesurée plutôt que
supposée. Le brief pointait vers `.pb-carte` (fond translucide
`rgba(255,255,255,0.06)` posé sur le dégradé du hero) comme famille
« sombre » de référence. Mais `.hero` est un dégradé radial dont le point
le plus clair (`#4C3FE0`, centre-haut) n'est pas le même que l'aplat
`#101B4D` de ses bords — et c'est précisément ce point le plus clair qui a
fait chuter la modale de recherche à 4,01:1 hier. Vérifié indépendamment
(formule de luminance relative WCAG, script `contrast.py` fourni à côté de
ce rapport) :

| Traitement | Fond | Texte | Ratio | Verdict |
|---|---|---|---|---|
| Translucide (`.pb-carte`) | carte 6 % blanc **composée sur** `#4C3FE0` → `rgb(87, 75, 226)` | `--ink-muted-on-dark` `#CDD2F0` | **4,01:1** | **SOUS le seuil AA** |
| Translucide (`.pb-carte`) | idem | `--ink-on-dark` `#F5F6FF` | 5,56:1 | AA |
| Translucide (`.pb-carte`) | idem | `#5AB8E8` accent | 2,69:1 | **échoue même le seuil non-texte de 3:1** |
| **Aplat `#101B4D`** (choisi) | `#101B4D` | `--ink-muted-on-dark` | **10,94:1** | AA très confortable |
| **Aplat `#101B4D`** (choisi) | `#101B4D` | `--ink-on-dark` | 15,17:1 | AA très confortable |
| Survol sur aplat | `rgba(255,255,255,.10)` composé sur `#101B4D` → `rgb(115, 121, 166)` | `--ink-on-dark` | 11,40:1 | AA très confortable |
| Lien vedette / accent | `#101B4D` | `#5AB8E8` (couleur déjà utilisée par la modale) | 7,35:1 | AA confortable |

**Le translucide ne passe pas de justesse : il échoue.** La première version
de ce tableau annonçait 4,55:1 et « AA avec 0,05 de marge ». C'était une
mesure du texte sur le dégradé **nu** — `contrast.py` définissait bien une
fonction de composition, mais ne l'appelait jamais. Le texte n'est jamais sur
le dégradé : il est sur la carte à 6 % de blanc posée dessus.

En composant réellement ce fond, `rgb(87, 75, 226)`, le ratio tombe à
**4,01:1** — sous le seuil AA de 4,5:1, et non 0,05 au-dessus. L'accent
`#5AB8E8` y descend à 2,69:1, sous le seuil texte **et** sous les 3:1 exigés
d'un élément non textuel.

Ces deux chiffres ne sont pas nouveaux : `styles.css` les porte depuis le
28 août, dans le commentaire qui explique pourquoi la modale de recherche est
un aplat. Le script corrigé les retrouve à l'identique, ce qui vaut
recoupement indépendant.

La conclusion est donc la même que celle de la première version, mais plus
forte : le panneau sombre est un **aplat `#101B4D`** non pas parce que le
translucide serait à la limite, mais parce qu'il est **hors seuil**. Le
panneau de menu porte davantage de texte hiérarchisé que la modale (libellés
de groupe, lien vedette, onze liens) ; il n'y avait pas de marge à répartir.

*(Note de méthode : 4,01:1 est la valeur composée puis arrondie à l'entier
par canal, ce qu'un navigateur produit réellement. Sans arrondi on lit
4,03:1. Les deux sont sous le seuil ; c'est la première qu'on peut vérifier
à la pipette sur une capture.)*

Le contraste ne dépend alors plus du dégradé ni de la position de défilement :
`#101B4D` est un fond fixe, mesuré une fois pour toutes.

Aucun texte de la maquette ne descend sous 13,5px, et aucun sous 4,5:1 —
le repère donné (3,28:1 sur du 11px, mesuré hier) n'a pas été reproduit ;
il n'existe d'ailleurs nulle part dans le panneau redessiné puisque
celui-ci ne réutilise que `--ink` / `--ink-muted` (clair) et `--ink-on-dark`
/ `--ink-muted-on-dark` (sombre), jamais une valeur atténuée par opacité.

## 4. Mobile (moins de 768px)

Décision explicite, pas laissée au hasard : sous 768px, chaque panneau
perd ses colonnes et devient **une seule liste empilée**, dans l'ordre de
lecture d'origine (colonne 1 puis colonne 2), exactement le mécanisme déjà
en place pour `.nav-drop-panel` aujourd'hui (`position:static`, plus de
flottement). Rien n'est cité à moitié : les onze secteurs, les six liens
Developers, les cinq liens Produit sont tous présents, juste empilés.

Une seule nuance ajoutée à ce mécanisme existant : **Solutions** est
structurellement un seul groupe (« Secteurs ») scindé en deux colonnes
uniquement pour la largeur — en pile mobile, les deux colonnes se
rejoignent sans espacement de groupe, comme une seule liste de onze. **Produit**
et **Developers** ont deux groupes réellement distincts (Le produit / Aller
plus loin ; Documentation / Plateformes) — leurs libellés de groupe restent
visibles et espacés en pile mobile, parce qu'ils portent une information
réelle (« ceci est une catégorie différente »), contrairement au support
« Secteurs (suite) » du bureau qui n'existe que pour aligner deux colonnes
et n'a rien à dire en pile.

**Ce que les captures montrent, et ce qu'elles ne montrent pas.** La première
version de ce paragraphe renvoyait à `shots/12_mobile_light_solutions_stacked.png`
et `shots/14_mobile_dark_developers_stacked.png` : **aucun de ces deux fichiers
n'existe**. Trois captures sont jointes, et deux affirmations sur quatre ne sont
étayées par aucune.

| capture | ce qu'elle montre |
|---|---|
| `shots/apercuclairsolutions.png` | bureau 1440, thème clair, Solutions ouvert — les onze secteurs sur deux colonnes |
| `shots/apercusombresolutions.png` | bureau 1440, thème sombre, même panneau sur l'aplat `#101B4D` posé sur le hero |
| `shots/apercumobileempile.png` | mobile 390, thème clair, Solutions **empilé en une seule liste** |

Ce que la troisième établit : l'empilement en une liste unique, et la
disparition des colonnes sous 768px.

Ce qu'**aucune** capture n'établit, et qu'il faut donc lire comme une
intention de maquette et non comme une vérification :

- **les onze secteurs présents en pile.** Le cadre d'aperçu de la maquette
  coupe la liste à « Librairie & édition » : huit visibles sur onze. La coupe
  vient du cadre, pas du panneau — mais la capture ne permet pas de le
  distinguer, donc elle ne prouve rien sur ce point ;
- **les libellés de groupe conservés pour Produit et Developers en pile.**
  Aucune capture de ces deux menus en mobile ;
- **le thème sombre en mobile.** Aucune capture.

## 5. Clavier

Vérifié en direct sur le menu de production (`heurix.fr`, 29 août 2026,
avant d'écrire la maquette) :

- Le panneau s'ouvre au clic — **jamais** au survol (comportement
  intentionnel de l'existant, préservé).
- `Escape` referme le panneau ouvert et rend le focus à son bouton.
- `Tab` entre naturellement dans le panneau ouvert et parcourt ses liens
  dans l'ordre du DOM ; aucune touche fléchée n'est gérée (`ArrowDown` ne
  fait rien).
- Ouvrir un second menu referme le premier (un seul panneau ouvert à la
  fois).
- `Tab` au-delà du dernier lien laisse aujourd'hui le panneau précédent
  ouvert derrière le bouton suivant — non reproduit intentionnellement
  dans la maquette (fermeture sur `focusout`, cf. §2).

La maquette reproduit exactement ces comportements pour les trois menus
élargis ; seul le point de fermeture-sur-sortie-de-focus a été ajouté.

## 6. Recommandation

**Thème clair.** Le header qui porte les trois boutons reste, dans les deux
options, le même bandeau clair translucide qu'aujourd'hui (contrainte du
brief : rien d'autre ne change). Un panneau clair prolonge directement ce
bandeau — même famille de couleur du déclencheur jusqu'au contenu ouvert,
sur n'importe quelle page. Un panneau sombre fonctionne tout aussi bien
individuellement (les ratios du §3 sont même plus confortables que ceux du
clair), mais il introduit une rupture visuelle entre un bouton toujours
clair et le panneau sombre qu'il ouvre — plus sensible sur les pages qui
n'ont pas de hero sombre (la majorité des 124 pages : les fiches secteur,
la tarification, les pages plateformes n'ont pas le dégradé `.hero`).

Le thème sombre reste une option pleinement défendable si la priorité est
de faire porter au menu la couleur bleu-nuit qui identifie le produit,
indépendamment de la page — c'est un choix de positionnement, pas un
problème d'accessibilité ou de mesure : les deux maquettes passent AA avec
marge confortable partout. Mais entre les deux, le clair est le choix qui
demande le moins de changement pour le plus de cohérence.

## Fichiers

- `menu-navigation.html` — la maquette, thème et aperçu pilotables en direct.
- `rapport-menu-navigation.md` — ce document.
- `contrast.py` — script de calcul des ratios (indépendant de la maquette,
  formule de luminance relative WCAG standard), pour reproduire ou contester
  les chiffres du §3.
