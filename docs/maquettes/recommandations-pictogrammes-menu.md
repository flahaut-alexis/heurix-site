# Recommandations — pictogrammes et lisibilité des menus Produit / Solutions / Developers

Ce document complète `rapport-menu-navigation.md` (déjà dans le dossier) : il ne revient pas sur la structuration en groupes ni sur le choix du thème clair, déjà tranchés et vérifiés là-bas. Il répond à une question précise — la maquette manque-t-elle de quelque chose visuellement, et les pictogrammes sont-ils la bonne réponse ?

Méthode : maquette ouverte en direct (clair/sombre, bureau/mobile), `rapport-menu-navigation.md` lu en entier, puis recoupement avec le site en production — `secteurs.html`, `integrations.html`, `prestashop.html`, `fonctionnalites.html`, `styles.css` — le 30 août 2026. Le détail de ce qui a été vérifié vs. supposé est au §7.

## 1. Le vrai manque : aucune ligne n'a de repère fixe

La structure (groupes, lien vedette, colonnes) est déjà résolue par la maquette actuelle. Ce qui reste plat : dans les trois panneaux, chaque lien a exactement le même poids visuel — même taille, même graisse, même couleur d'encre. Seule variable d'un lien à l'autre : la longueur du mot et sa lettre initiale. L'œil n'a aucun point d'ancrage répété pour descendre la liste — il doit lire chaque libellé en entier.

C'est exactement le trou qu'un pictogramme comble : une forme et une couleur fixes, à une position constante, que l'œil peut mémoriser et retrouver sans relire le texte. L'instinct est le bon. Il s'applique cependant très différemment selon le panneau — voir §2 et §5.

## 2. Solutions : le cas le plus fort, et les pictogrammes existent déjà

Solutions est le panneau le plus chargé (11 liens) et celui que `rapport-menu-navigation.md` décrit déjà comme le plus contraint à scanner. C'est aussi celui où la réponse ne demande aucune décision de design : `secteurs.html` affiche déjà les onze mêmes secteurs, chacun avec un pictogramme, dans un composant réutilisable.

Vérifié en direct sur `secteurs.html` :

| Propriété | Valeur | Rôle |
|---|---|---|
| Conteneur `.icn` | 34×34px, `border-radius:8px` | pastille |
| Fond de la pastille | `#EEF1FF` (`--blue-tint`) | déjà nommé dans `styles.css` |
| Couleur du tracé | `#3F52E8` (`--blue-deep`) | déjà nommé dans `styles.css` |
| SVG | inline, 18×18, `stroke-width:2`, `stroke="currentColor"` | pas d'icon-font, pas d'image |

Bibliothèque identifiée : ce sont des **Feather Icons** (open source, licence MIT, feathericons.com) — tracé vérifié au caractère près pour trois secteurs :

- Quincaillerie & outillage → `tool`
- Pièces détachées & industrie → `settings`
- Automobile → `truck`

Recommandation : brancher ces mêmes onze pictogrammes dans le panneau Solutions, sourcés directement depuis `secteurs.html` (`document.querySelectorAll('.vertical-card .icn svg')` y donne les onze tracés canoniques) plutôt que redessinés à l'œil — je n'ai vérifié que les trois ci-dessus, les huit autres sont à extraire de la même façon avant de coder. Coût de design : nul, puisque le composant existe déjà. Bénéfice additionnel : ça relie enfin visuellement le menu à la page `secteurs.html`, que le rapport §1 signale déjà comme non référencée assez fortement.

Dans le contexte plus dense d'un menu (lignes de ~37px, voir §4) plutôt que d'une grille de cartes, réduire la pastille à ~28px plutôt que 34px, en gardant le même rapport rayon/couleur.

## 3. Le thème sombre casse l'hypothèse — à vérifier, pas à supposer

La pastille claire (`#EEF1FF` plein) a été pensée pour une carte blanche. Posée telle quelle sur l'aplat `#101B4D` retenu par le rapport (§3), elle devient un pavé pâle plaqué sur un fond saturé — pas cassé, mais étranger au reste du panneau sombre.

Proposition : en thème sombre, retirer la pastille et garder le tracé seul, dans l'accent `#5AB8E8` déjà réservé au « lien vedette » par le tableau du rapport (7,35:1 sur `#101B4D`) — ou dans `--ink-muted-on-dark` si un rendu plus discret que l'accent est préférable.

Je n'ai pas fait tourner `contrast.py` sur cette paire icône/fond : à faire avant d'arrêter la couleur, dans le même esprit que le reste du rapport. Un pictogramme purement décoratif n'est pas soumis au seuil texte de 4,5:1, mais reste concerné par le seuil non-texte de 3:1 s'il porte un minimum de sens au premier coup d'œil.

## 4. Mobile : la ligne est déjà sous la cible tactile — l'icône ne doit pas aggraver ça

Mesuré en direct sur la maquette, aperçu Mobile (390), panneau Solutions déplié : une ligne de secteur (`Quincaillerie & outillage`) fait **37px de haut** (`padding:10px 0` + texte 13,5px). C'est sous les 44px généralement retenus comme cible tactile minimale (WCAG 2.5.5, et les repères Material/HIG). Ce n'est pas causé par les pictogrammes — c'est déjà le cas aujourd'hui, texte seul.

Deux ajustements à traiter ensemble plutôt que l'un sans l'autre :
- remonter le padding vertical de la ligne pour approcher 44px ;
- garder le pictogramme mobile petit et sans pastille (glyphe seul, ~18–20px) plutôt que la pastille 28px du bureau, pour ne pas pousser la ligne encore plus haut dans un empilement à onze lignes.

## 5. Produit et Developers : ne pas généraliser sans avoir vérifié — et je n'ai rien trouvé

J'ai cherché un équivalent du composant `.icn` pour ces deux panneaux : ouvert `fonctionnalites.html` (Produit) ainsi que `integrations.html` et `prestashop.html` (Developers → Plateformes). Aucun pictogramme ni logo, même sur la page dédiée PrestaShop — traitement 100 % texte, y compris pour le nom de la plateforme. Contrairement à Solutions, il n'y a ici rien à réutiliser : ajouter des pictogrammes reviendrait à inventer un nouveau vocabulaire visuel, pas à en prolonger un existant.

Les deux panneaux sont aussi plus courts (5 et 8 liens) et portent déjà de vrais libellés de groupe (LE PRODUIT / ALLER PLUS LOIN, DOCUMENTATION / PLATEFORMES) issus du rapport — une partie du travail de repère est déjà faite autrement qu'à l'échelle de la ligne. Deux options, à trancher plutôt qu'à laisser au hasard :

- **Option sobre (recommandée)** : ne pas toucher Produit et Developers. Le regroupement suffit à ces tailles-là ; réserver le pictogramme au panneau qui en a réellement besoin.
- **Option cohérence totale** : si l'homogénéité entre les trois panneaux prime sur l'économie de design, utiliser la même famille Feather en version neutre — glyphe seul 16–18px dans `--ink-muted`, sans pastille colorée (pour ne pas laisser croire que ces liens sont des « secteurs »). Par exemple `file-text` pour Documentation, `grid` ou `layers` pour Intégrations. Pour PrestaShop / WooCommerce / Shopify : soit ce même glyphe générique répété (sûr mais peu distinctif), soit leurs marques réelles en version mono-chrome (plus reconnaissable, mais une marque tricolore à côté d'un glyphe Feather mono-trait est une rupture de langage à assumer consciemment, pas à subir par défaut).

## 6. Trois leviers indépendants des pictogrammes

- **Lien vedette généralisé** : « Tous les secteurs → » reçoit déjà un traitement d'accent (couleur + flèche) dans Solutions — bon réflexe, déjà dans la maquette. Rien d'équivalent pour « Documentation » dans Developers, alors que le rapport (§1) le décrit lui-même comme une page-somme d'une autre nature que les trois ancres qui l'entourent. Étendre le même traitement à ce lien rendrait le principe cohérent sur les trois panneaux au lieu d'un seul.
- **Séparateur entre colonnes, mais pas partout** : aucun trait vertical aujourd'hui entre les deux colonnes. Ça se justifierait pour Produit et Developers, où les deux colonnes sont deux groupes réellement distincts. Ça ne se justifie **pas** pour Solutions : le rapport (§4) est explicite, c'est une seule liste de onze coupée en deux uniquement pour la largeur, et un séparateur y suggérerait à tort deux catégories.
- **Poids des micro-labels de groupe** : LE PRODUIT / ALLER PLUS LOIN / DOCUMENTATION / PLATEFORMES restent aujourd'hui de simples légendes grises. Un peu plus de présence (graisse 600 plutôt que 500, par exemple) les ferait lire comme de vrais en-têtes de section plutôt que comme une note en petit.

## 7. À vérifier avant de coder

- Extraire les huit pictogrammes secteur restants directement du DOM de `secteurs.html`, pas à l'œil — seuls outillage (`tool`), industrie (`settings`) et automobile (`truck`) sont confirmés ici.
- Passer `contrast.py` sur le traitement sombre proposé (`#5AB8E8` ou `--ink-muted-on-dark` sur `#101B4D`) avant d'arrêter la couleur finale.
- Re-mesurer la hauteur de ligne mobile une fois le padding et le pictogramme ajoutés, pour confirmer que la cible 44px est bien atteinte.
- `aria-hidden="true"` sur chaque pictogramme de menu : le texte reste le nom accessible, l'icône ne doit pas être annoncée deux fois par un lecteur d'écran.

## 8. Dans l'ordre

1. Solutions clair : brancher les onze pictogrammes existants — impact le plus fort, coût le plus faible.
2. Solutions sombre : variante sans pastille, couleur confirmée par `contrast.py`.
3. Mobile : cible tactile ~44px + pictogramme sans pastille.
4. Trancher Produit/Developers (option sobre ou cohérence totale) plutôt que laisser un traitement à deux vitesses non assumé.
5. Optionnel : lien vedette étendu à « Documentation », séparateurs ciblés (Produit/Developers seulement), micro-labels un peu plus affirmés.

## Fichiers consultés

- `menu-navigation.html`, `rapport-menu-navigation.md` — ce même dossier.
- `heurix.fr/secteurs.html`, `/integrations.html`, `/prestashop.html`, `/fonctionnalites.html`, `/styles.css` — lus en direct le 30 août 2026.
