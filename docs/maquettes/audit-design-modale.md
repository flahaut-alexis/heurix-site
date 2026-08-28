# Audit design — modale de recherche (Ctrl+K)

Périmètre : l'apparence de la modale globale du bandeau (`.search-modal` / `.search-panel`), pas le widget de démonstration de la page d'accueil. Pertinence, fonctionnalités, rail, compteurs, cinq états et clavier ne sont pas en cause — seul l'habillage est audité.

## Sur quoi je travaille, et ce que je n'ai pas pu ouvrir

Cette session n'a accès ni à votre dépôt, ni à un poste relié : pas de commit à citer. Ce qui suit est mesuré directement sur **le site déployé, le 28 août 2026** :

- `styles.css` — récupéré en entier (~6 279 lignes annoncées dans le fichier lui-même ; les ~1 045 premières lignes couvrent l'en-tête, la modale de recherche en intégralité et le début du hero — c'est la partie qui vous intéresse ici, lue verbatim). Le reste du fichier (pages produit, secteurs, tarifs…) n'a été vérifié que par sondage et par mesure live sur le DOM, pas ligne à ligne.
- `docs/maquettes/README.md` et la mention de `recherche-modale.html` — lus tels que déployés.
- `search-index-fr.json` — lu en entier (82 entrées) ; c'est la source des données réelles utilisées dans les deux maquettes.
- La modale elle-même, observée à l'écran (capture, pas lecture de code) sur les cinq états en français et en anglais.
- `DESIGN.md` : introuvable à la racine ni sous `docs/` (404 sur les deux chemins). Le raisonnement ci-dessous s'appuie donc sur les tokens de `styles.css` et sur des mesures directes du DOM live, pas sur ce document.

Deux limites techniques à connaître avant de juger les maquettes :

1. **Le rendu à 390 px n'a pas pu être vérifié sur le site en production** dans cette session (la fenêtre du navigateur relié ne descend pas sous ~1050 px de large, quel que soit le redimensionnement demandé). Le comportement mobile décrit ici vient de la lecture directe de la règle `@media (max-width:768px)` de `styles.css` — reproduite verbatim, pas résumée — et non d'une capture d'écran du site. En revanche, **les deux maquettes livrées ont été vérifiées à 390 px réels** (rendu local, cadre de largeur fixe indépendant de la fenêtre) : ce que vous ouvrirez correspond à ce qui a été mesuré.
2. Les polices : `styles.css` référence des `.woff2` propriétaires (Plus Jakarta Sans, IBM Plex Mono) non accessibles depuis cette session. Les deux maquettes chargent les **mêmes familles** depuis Google Fonts — rendu typographique équivalent, pas une police de secours différente.

Aucune valeur de couleur, rayon ou ombre ci-dessous n'est inventée. Chacune est référencée à sa source ; les deux seules valeurs qui ne sont pas des `--custom-properties` nommées dans `:root` sont signalées explicitement comme telles.

---

## 1. Ce qui ne va pas aujourd'hui — mesuré

### 1.1 Le panneau : une valeur figée, pas un token

`.search-panel` a `background:#fff` en dur. Le fond de page (`body.docs-dark`, utilisé par la page d'accueil et repris par `.hero`) est :

```css
background: radial-gradient(ellipse 1400px 900px at 50% 0%, #4C3FE0 0%, #3648A8 45%, #101B4D 100%);
```

Le site distingue déjà, ailleurs, deux familles de surfaces cohérentes avec chacun de ces deux fonds :

| Famille | Exemple mesuré | Fond | Bordure | Rayon |
|---|---|---|---|---|
| Claire, sur fond blanc | `.search-panel` actuel, `.demo` | `#fff` | `1px solid var(--line)` #E7E9F2 | 14–16px |
| Sombre translucide, sur le dégradé | `.pb-carte` (cartes « 01 / 02 », section « Pourquoi Heurix ») | `rgba(255,255,255,.06)` | `1px solid rgba(255,255,255,.14)` | 12px |

La modale n'appartient à aucune des deux : c'est une troisième surface, blanche et opaque, posée sans transition sur un fond qui n'est ni blanc ni translucide. C'est un écart mesurable de langage, pas une impression.

### 1.2 Les pastilles de source : conformes AA, mais pas au même problème que le vôtre

Premier point important : **le contraste des pastilles actuelles n'est pas cassé**. Je l'ai mesuré :

| Source | Fond | Texte | Ratio | Seuil (10,5px) | Résultat |
|---|---|---|---|---|---|
| Blog | `--blue-tint` #EEF1FF | `--ink` #12142B | **16,08:1** | 4,5:1 | Conforme |
| Documentation | `--green-tint` #E8F8F0 | `--ink` #12142B | **16,47:1** | 4,5:1 | Conforme |
| Secteurs | `--amber-tint` #FFF6E6 | `--ink` #12142B | **16,87:1** | 4,5:1 | Conforme |
| Plateformes | `#fff` + contour `--blue-tint` | `--ink` #12142B | **18,09:1** | 4,5:1 | Conforme |
| Produit | `--bg-soft` #F7F8FC | `--ink` #12142B | **17,05:1** | 4,5:1 | Conforme |

Le commentaire laissé dans `styles.css` au-dessus de `.search-pill` raconte l'incident que vous mentionnez : une première version faisait porter la couleur de famille par le *texte* (vert sur vert clair, ambre sur ambre clair). Mesuré à l'identique avec la même formule WCAG :

| | Fond | Texte (ancien) | Ratio | Résultat |
|---|---|---|---|---|
| Documentation (version corrigée depuis) | #E8F8F0 | `--green` #1FAA6B | **2,72:1** | Échouait |
| Secteurs (version corrigée depuis) | #FFF6E6 | `--amber` #B26A00 | **3,95:1** | Échouait |

La correction (texte uniforme `--ink`, identité portée par le fond) est déjà en production et déjà conforme. Votre gêne n'est donc pas un problème d'accessibilité résiduel — c'est que la distinction par teinte ne dit rien de Heurix :

- **Une seule des quatre familles est une couleur de marque.** `--blue-tint` est le bleu Heurix. `--green` et `--amber` ne le sont pas : `--green` sert déjà de pastille d'état (le point décoratif devant le texte des badges de statut, `.badge::before`), et `--amber` a été ajouté explicitement pour l'état *brouillon* de la console (commentaire du 17 août dans `styles.css`, "Etat 'brouillon'… valeurs exactes du brief, jamais inventées"). La modale réutilise deux couleurs déjà réservées au *statut*, pour coder une *catégorie* — ça entre en conflit avec la convention que le reste du site a déjà choisie.
- **Le système a déjà manqué de teintes sûres une fois.** Le commentaire du fichier le dit lui-même : la palette n'a pas de vert ni d'ambre plus sombres à offrir, donc la cinquième source (Plateformes) est traitée par un contour plutôt qu'une teinte — une exception née d'une pénurie, pas d'un choix.
- **La couleur double une information déjà donnée par le texte.** Chaque pastille affiche son nom en toutes lettres ("Blog", "Documentation"…). Personne n'a besoin de mémoriser "le vert, c'est la doc" : le mot suffit. Coder la même information deux fois (texte + teinte) n'aide pas la lecture, ça ajoute du bruit visuel — et un peu de risque, puisque c'est justement le genre de distinction portée par la seule couleur que le WCAG (SC 1.4.1) demande de ne pas rendre indispensable.

**Ma réponse aux deux questions posées : la distinction par famille de teinte ne sert pas d'usage mesurable, et un traitement unique et sobre suffit.** C'est ce que proposent les deux maquettes — voir §2.

---

## 2. Les deux maquettes

Mêmes données réelles dans les deux (`search-index-fr.json`), mêmes cinq états, même rail, mêmes compteurs, même clavier. Testées à 1440 px (aucun palier CSS propre à la modale entre 768 et 1440 — la maquette est montrée dans un cadre de 1000 px, le rendu est identique) et à 390 px réels (cadre de largeur fixe, indépendant de la fenêtre).

### A — Sombre

**Ce qui change**

| Élément | Aujourd'hui | Maquette A | Source de la valeur |
|---|---|---|---|
| Fond du panneau | `#fff` | `#101B4D` en aplat | Existant — arrêt final (100%) du dégradé de `body.docs-dark` |
| Bordure panneau / carte | `var(--line)` #E7E9F2 | `rgba(255,255,255,.14)` | Existant — bordure de `.pb-carte`, mesurée en direct sur le DOM |
| Remplissage ligne survolée/active | `var(--blue-tint)` | `rgba(255,255,255,.12)` | Existant — `.hero-cta .btn-ghost:hover`, et l'option (b) commentée sur le H1 |
| Titre / texte principal | `--ink` #12142B | `#F5F6FF` | Existant, non nommé — mesuré en direct sur `.pb-carte h3` |
| Corps / texte muet | `--ink-muted` #5B5E76 | `#CDD2F0` | Existant, non nommé — mesuré en direct sur `.pb-carte p` |
| Accent (surlignage de terme) | `--blue-deep` sur `--blue-tint` | `#5AB8E8` sur fond+14% blanc | Existant — `.hero h1 span`, seule teinte du site déjà choisie pour porter du texte sur le dégradé |
| Pastilles (5 sources) | 4 familles de teinte | 1 seul traitement : fond `rgba(255,255,255,.12)`, texte `#F5F6FF` | — |

**Ce que ça coûte**

- *Le dégradé à trois arrêts ne peut pas habiller le panneau tel quel.* Je l'ai testé avant de choisir l'aplat : au point le plus clair du dégradé (#4C3FE0), le texte muet `#CDD2F0` tombe à **4,01:1** (sous 4,5:1) une fois posé sur une carte à 6 % de blanc, et l'accent `#5AB8E8` tombe à **2,69–3,08:1** selon la carte — sous le seuil texte, sous le seuil non-texte au point le plus clair. J'ai donc figé le panneau sur l'arrêt le plus sombre du même dégradé plutôt que de reproduire le dégradé complet : le contraste devient indépendant de la position dans le panneau, au prix de perdre le mouvement de couleur du hero à l'intérieur de la modale elle-même (le fond de page, lui, continue de se voir en transparence autour et derrière, flouté).
- *Deux valeurs à nommer si cette direction est retenue.* `#F5F6FF` et `#CDD2F0` existent déjà en production (`.pb-carte`) mais seulement comme littéraux CSS, pas comme `--custom-properties`. Les utiliser ici sans les nommer crée une deuxième source de vérité pour la même paire de couleurs. Je recommande de les déclarer (`--ink-on-dark`, `--ink-muted-on-dark`, ou l'équivalent que vous préférez) avant d'étendre le motif à un deuxième composant.
- *Double maintenance.* Chaque règle `.search-*` existe désormais en deux versions (claire et sombre). Sans passage à des tokens qui changent de valeur selon le contexte plutôt qu'à des classes dupliquées, toute future retouche de la modale (espacement, nouvel état) doit être répercutée deux fois.
- *Bordure décorative sous le seuil non-texte*, par cohérence avec l'existant plutôt que par relâchement : la bordure de carte à 14 % de blanc mesure **1,51:1** sur le panneau — sous 3:1. C'est la mesure exacte de la bordure de `.pb-carte` en production aujourd'hui : la démarcation y repose sur l'écart de remplissage (0 % → 6 %), la bordure n'étant qu'un raffinement redondant, jamais le seul repère. Je reproduis ce même choix, pas une régression.

**Contraste mesuré (maquette A)**

| Paire | Fond | Texte | Ratio | Seuil | Résultat |
|---|---|---|---|---|---|
| Titre de résultat | `#101B4D` | `#F5F6FF` | 15,17:1 | 4,5:1 | Conforme |
| Titre, sur carte au survol (fond+6%) | `#1E2958` | `#F5F6FF` | 12,89:1 | 4,5:1 | Conforme |
| Corps / extrait | `#101B4D` | `#CDD2F0` | 10,94:1 | 4,5:1 | Conforme |
| Corps, sur carte au survol | `#1E2958` | `#CDD2F0` | 9,30:1 | 4,5:1 | Conforme |
| Pastille unifiée (fond+12%) | `#2D3662` | `#F5F6FF` | 10,75:1 | 4,5:1 | Conforme |
| Surlignage de terme (mark) | fond+14% `#313B66` | `#5AB8E8` | 4,85:1 | 4,5:1 | Conforme (marge la plus juste) |
| Case à cocher / anneau de focus (non-texte) | panneau et carte | `--blue` / `#5AB8E8` | 3,17–5,21:1 | 3,0:1 | Conforme |
| Bordure de carte (décorative, redondante avec le remplissage) | panneau | blanc 14 % | 1,51:1 | 3,0:1 | Sous le seuil — assumé, voir ci-dessus |
| Filtre inactif (compteur à 0) | — | opacité .42 | — | — | Exempté (WCAG 1.4.3/1.4.11 : contrôle inactif) |

### B — Claire, accents Heurix

**Ce qui change**

| Élément | Aujourd'hui | Maquette B | Source de la valeur |
|---|---|---|---|
| Fond du panneau | `#fff` | `#fff` (inchangé) | — |
| Bande décorative en tête de panneau | absente | 4px, `linear-gradient(135deg, var(--blue), #8B5CF6)` | Existant, non nommé — dégradé déjà utilisé tel quel sur `.play-bar` (barre de recherche de la démo d'accueil) |
| Fond du rail | `--bg-soft` #F7F8FC (gris neutre) | `--blue-tint` #EEF1FF | Existant |
| Icône loupe | `--ink-muted` | `--blue-deep` #3F52E8 | Existant |
| Ligne active | `--blue-tint` + anneau | `--blue-tint` + anneau + liseré gauche `--blue-deep` | Existant — même bleu que le chiffre des cartes `.pb-carte` |
| Pastilles (5 sources) | 4 familles de teinte | 1 seul traitement : fond `--blue-tint`, texte `--blue-deep` | Existant — c'est déjà exactement le traitement de la pastille « Blog » et des suggestions de l'état « aucun résultat », étendu aux quatre autres |

**Ce que ça coûte**

- *Presque rien à inventer* : tout, hormis la bande décorative, réutilise des `--custom-properties` déjà nommées et déjà utilisées ailleurs sur des surfaces claires. La seule valeur qui n'est pas un token nommé est `#8B5CF6`, littéral existant dans `.play-bar` — je le signale ici plutôt que de le poser en dur sans provenance ; si cette bande est retenue, elle mérite d'être nommée (`--accent-gradient` ou équivalent) plutôt que de rester un deuxième littéral isolé.
- *Marge de contraste plus étroite qu'aujourd'hui, mais stable.* La pastille unifiée passe de 16–18:1 (aujourd'hui, sur cinq fonds différents) à 5,21:1 (sur un seul fond, dans les deux tailles d'écran, à toute heure). C'est un vrai resserrement de marge, mais 5,21:1 reste confortablement au-dessus du seuil de 4,5:1 — l'écart d'aujourd'hui était un surplus, pas une exigence.
- *Ne répond pas à la plainte n°1.* Le panneau reste un rectangle blanc opaque sur un fond qui ne l'est pas. C'est un choix assumé par cette maquette (« sans en copier le fond »), pas un oubli — mais si le vrai problème est l'appartenance au même univers visuel, cette maquette ne le résout pas, elle l'habille mieux.

**Contraste mesuré (maquette B)**

| Paire | Fond | Texte | Ratio | Seuil | Résultat |
|---|---|---|---|---|---|
| Pastille unifiée | `--blue-tint` #EEF1FF | `--blue-deep` #3F52E8 | 5,21:1 | 4,5:1 | Conforme |
| Libellé de rail (ink-muted, sur le nouveau fond bleu) | `--blue-tint` #EEF1FF | `--ink-muted` #5B5E76 | 5,64:1 | 4,5:1 | Conforme |
| Icône loupe / liseré actif | `#fff` | `--blue-deep` #3F52E8 | 5,86:1 | 4,5:1 | Conforme |
| Tout le reste (titres, extraits, bouton Échap…) | inchangé | inchangé | 6,35–18,09:1 | 4,5:1 | Conforme (hérité de l'existant) |

---

## 3. Recommandation

**Je recommande la maquette A.**

Vous avez nommé deux problèmes, dans cet ordre : le bloc blanc étranger au reste du site, puis les pastilles. La maquette B corrige la seconde plainte proprement et à faible coût — mais elle ne touche pas à la première : un panneau blanc mieux accessoirisé reste un panneau blanc posé sur un dégradé sombre. Si la gêne que vous décrivez est exactement celle-là (« cette fenêtre est une surface claire posée dessus »), seule la maquette A la fait disparaître : le panneau devient littéralement un arrêt du même dégradé, avec le même traitement de carte translucide déjà en production ailleurs sur le site.

Ce choix a un prix réel, à ne pas minimiser : deux jeux de règles `.search-*` à maintenir, deux valeurs de texte à nommer proprement si vous les gardez, et une vigilance à documenter (l'aplat `#101B4D` n'est pas un raccourci esthétique, c'est ce qui garde le contraste stable — un futur retour au dégradé complet sans revérifier casserait le texte muet et l'accent). Si le budget d'implémentation ou de maintenance est la contrainte dominante plutôt que l'exactitude de la sensation recherchée, B reste un choix défendable et quasiment sans risque — voire un premier pas : rien n'empêche de livrer B maintenant (pastilles) et A ensuite (fond), les deux changements étant indépendants.

Sur les pastilles elles-mêmes, indépendamment du fond retenu : abandonnez la distinction par famille de teinte dans les deux cas. Elle ne sert aujourd'hui aucun besoin de lecture que le texte ne remplit pas déjà, elle emprunte deux couleurs que le reste du site réserve à un statut, et elle a déjà coûté un incident de contraste. Un traitement unique, dérivé du bleu Heurix (clair) ou du blanc translucide (sombre), dit plus clairement « ceci vient de Heurix » que quatre teintes qui ne le disaient pas.

---

## Fichiers

- `maquette-sombre.html` — Maquette A
- `maquette-claire.html` — Maquette B
- Ce rapport

Aucun fichier du site n'a été modifié ; ces trois fichiers sont autonomes, à placer dans `docs/maquettes/` à côté de `recherche-modale.html` et de son `README.md`, dont les conventions ont été suivies (données réelles, notes de mesure plutôt que ressenti, mention explicite de ce qui périmerait la maquette : tout écart d'implémentation devra soit se refléter ici, soit motiver un commit qui explique pourquoi).
