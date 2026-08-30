# Bug : le menu déroulant du header chevauche le widget de démo

Diagnostic + pistes de correctif pour le header de heurix.fr, à l'attention de Claude Code. Mesures prises en direct sur `https://heurix.fr/index.html`, viewport 1171×855, scroll = 0.

## Le problème

Le header (`position: sticky`) ouvre trois menus déroulants au clic : **Produit**, **Solutions**, **Developers**. Chaque panneau (`.nav-drop-panel`) est positionné en `absolute` juste sous le header. Plus bas dans le flux normal de la hero, le widget de démo interactive (`.demo.play` — les onglets « Bricolage & Outillage » / « Mode & Prêt-à-porter », la barre de recherche et les tags de suggestion) démarre à une position fixe qui ne tient aucun compte de la hauteur du menu ouvert au-dessus. Quand un panneau dépasse l'espace disponible entre le bas du header et le haut du widget, les deux se chevauchent visuellement : la bordure et l'ombre du panneau coupent à travers la carte du widget, parfois jusqu'à masquer une partie de ses boutons ou de son champ de recherche.

Les trois menus partagent le même composant (`.nav-panel-groupes` pour Produit et Developers, `.nav-panel-secteurs` pour Solutions) mais pas le même volume de contenu, donc pas le même débordement :

| Menu | Hauteur du panneau | Chevauchement mesuré avec le widget |
|---|---|---|
| Produit | 266 px | 9 px |
| Solutions | 344 px | 66 px |
| Developers | 355 px | **98 px — la barre de recherche du widget est en partie masquée** |

Pour référence : le header mesure 73 px de haut, le panneau démarre à `top: calc(100% + 10px)` (≈ 82 px), et le widget démarre à ≈ 339 px du haut du viewport. Le « budget » disponible avant collision est donc d'environ 257 px — Produit tient tout juste dedans, Solutions et Developers non.

## Cause racine

```css
.nav-drop-panel {
  display: none;
  position: absolute;
  top: calc(100% + 10px);
  left: -14px;
  z-index: 80;
  min-width: 238px;
  background: #fff;
  border: 1px solid var(--line); /* #E7E9F2 — très peu contrasté */
  border-radius: 10px;
  box-shadow: 0 12px 30px rgba(18, 20, 43, .13);
  padding: 6px;
}
.nav-drop-panel.open { display: block; }

.nav-panel-groupes {
  gap: 13px;
  padding: 20px 22px;
  flex-wrap: wrap;
  left: 0;
  right: 0;
  width: min(1008px, 100vw - 96px);
  margin: 0 auto;
}
.nav-drop:has(> .nav-panel-groupes) { position: static; }
```

Rien ne plafonne la hauteur du panneau : elle est entièrement pilotée par sa colonne la plus haute (chez Developers, la colonne « Intégrations » avec ses trois liens et leurs descriptions). Et rien ne relie cette hauteur à la position du widget plus bas — les deux éléments vivent dans des logiques différentes (overlay en `absolute` pour l'un, flux normal de page pour l'autre), donc aucun mécanisme CSS n'empêche mécaniquement la collision.

Effet secondaire repéré au passage : comme la hauteur n'est jamais plafonnée, un panneau qui grossirait encore (nouveau lien, description plus longue) ou une fenêtre de laptop moins haute pourrait un jour déborder carrément sous le bas de l'écran, pas seulement chevaucher le widget — un problème voisin qui mérite d'être traité par la même occasion.

Point utile pour le correctif : un clic en dehors du header ferme déjà le panneau ouvert (vérifié en direct sur le site). Toute solution ajoutant un élément hors du header profite donc de cette fermeture existante sans toucher au JS.

## Pistes mécaniques

**A. Plafonner la hauteur et faire défiler à l'intérieur.** `max-height: min(420px, calc(100vh - 96px))` avec `overflow-y: auto` sur `.nav-drop-panel` garantit qu'aucun panneau, aujourd'hui ou demain, ne peut déborder de l'écran. C'est un bon filet de sécurité, mais ça ne règle pas le chevauchement à soi seul : pour effacer les 98 px du menu Developers il faudrait plafonner autour de 257 px, ce qui couperait la colonne « Intégrations » et forcerait un ascenseur dans un menu qui s'affiche aujourd'hui en entier. Et ce budget de 257 px n'est pas stable — il dépend de la longueur du texte de la hero, donc de la largeur d'écran et de la langue (la version EN du site n'a pas le même texte que la version FR).

**B. Un fond flouté derrière le menu ouvert — la piste recommandée.** Plutôt que de chercher à ce que le panneau ne touche jamais le widget, on rend la question sans objet : un scrim semi-opaque et flouté apparaît entre le header et le reste de la page dès qu'un menu est ouvert, exactement le traitement déjà utilisé sur le header lui-même (`backdrop-filter: blur(8px)`) et sur le correctif précédent de la modale de recherche. Ce qui dépasse du panneau se voit alors « sous verre dépoli » plutôt qu'en collision frontale avec une autre carte — la superposition devient lisible comme volontaire. Un seul élément à ajouter, juste après la balise fermante du header :

```html
<div class="nav-scrim" aria-hidden="true"></div>
```

```css
.nav-scrim {
  position: fixed;
  inset: 73px 0 0 0; /* sous le header */
  background: rgba(255, 255, 255, .72);
  backdrop-filter: blur(6px);
  opacity: 0;
  pointer-events: none;
  transition: opacity .15s ease;
  z-index: 65; /* au-dessus du contenu de page, sous le header (71) et son panneau (80) */
}
header:has(.nav-drop-panel.open) + .nav-scrim {
  opacity: 1;
  pointer-events: auto;
}

.nav-drop-panel {
  border-color: rgba(63, 82, 232, .18); /* --blue-deep à faible opacité, au lieu de --line */
  box-shadow: 0 16px 40px rgba(18, 20, 43, .16), 0 0 0 1px rgba(63, 82, 232, .05);
}
```

Le sélecteur `:has()` est déjà utilisé ailleurs dans la feuille de style du site (`.nav-drop:has(> .nav-panel-groupes)`), donc la cible navigateur le supporte déjà — pas de nouvelle contrainte introduite. Et comme le clic en dehors du header ferme déjà le menu, cliquer sur le scrim referme le panneau sans qu'il soit nécessaire d'ajouter le moindre gestionnaire JS.

**C. Alléger le contenu des menus — un complément optionnel.** Sur Developers et Solutions, retirer ou tronquer à une ligne la description sous chaque lien, et resserrer le padding vertical des liens (9px → 7px environ) réduirait le chevauchement à la source, ce qui profite aussi aux navigateurs plus anciens qui ne supportent ni `:has()` ni `backdrop-filter`. C'est un arbitrage éditorial autant que technique — à faire si Alexis souhaite de toute façon des menus visuellement plus légers, pas uniquement pour corriger ce bug.

## Recommandation

B en correctif principal : il rend le problème sans objet quel que soit le contenu, présent ou futur, et prolonge un langage visuel déjà validé sur le site plutôt que d'ajouter une pièce rapportée. A vient en garde-fou, pour éviter qu'un panneau ne déborde un jour hors de l'écran sur un petit laptop. C reste une option éditoriale, à envisager indépendamment de ce bug précis.

## Fichier de référence

`nav-dropdown-overlap-mockup.html` reproduit le header réel du site (mêmes couleurs, même contenu des menus Produit/Solutions/Developers, même widget de démo) avec un sélecteur en haut de page pour basculer entre l'état actuel (bug), l'option A seule, l'option B seule, et A+B combinées. Un badge en direct affiche la mesure du chevauchement dans chaque état. À ouvrir dans un navigateur pour valider visuellement avant implémentation.

## Notes pour l'implémentation

Sélecteurs concernés : `.nav-drop-panel`, `.nav-panel-groupes`, `.nav-panel-secteurs`, `header`, et le nouvel élément `.nav-scrim`. Variables CSS déjà définies sur `:root` et réutilisables telles quelles : `--ink #12142B`, `--line #E7E9F2`, `--blue #5468FF`, `--blue-deep #3F52E8`, `--blue-tint #EEF1FF`, `--bg #FFFFFF`, `--bg-soft #F7F8FC`, `--radius 10px`.

Le header est très probablement dupliqué ou inclus sur chaque page (accueil FR, version EN, pages secteurs/fonctionnalités/roi/faq/blog...) — vérifier partout où `<header>` et `.nav-drop-panel` apparaissent avant de considérer le correctif terminé, plutôt que de ne patcher que `index.html`.

Checklist de vérification après implémentation : ouvrir Produit, Solutions et Developers sur la page d'accueil FR et sur la version EN, à 1171 px de large puis sur une largeur desktop plus généreuse (1440/1920 px), et confirmer qu'aucune bordure ni ombre du panneau ne vient couper le widget de démo. Vérifier aussi que le menu mobile (`mobile-nav.js`, hors périmètre de ce correctif) n'est pas affecté par l'ajout du `.nav-scrim`.
