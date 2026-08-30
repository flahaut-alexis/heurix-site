# Maquettes de travail

Ce dossier n'est pas servi. Les fichiers y portent `noindex`, ne figurent pas
dans `sitemap.xml`, et aucune page ne les référence.

## Pourquoi ils sont versionnés

Ils portent des **décisions mesurées**, pas des dessins. Le code qui en découle
ne les explique pas : il applique un réglage sans dire pourquoi c'est celui-là.

## `recherche-modale.html`

Les cinq états de la modale de recherche, avec les données réelles de
`search-index-fr.json` et les tokens de `styles.css`.

Chaque onglet porte sa note, et chaque note porte sa mesure. Les trois qui
décident :

- **la répartition des sources**, relevée sur l'arborescence réelle et non
  supposée. Le brief d'origine proposait Documentation, Guides, Blog,
  Développeurs, Produit, FAQ ; la mesure donne Blog 38, Secteurs 17,
  Produit 10, Documentation 6, Plateformes 4. « Guides » et « Développeurs »
  n'existent pas comme sections, « Secteurs » et « Plateformes » existent et
  n'étaient pas prévus, et FAQ n'a qu'une entrée — sous le seuil, elle rejoint
  Produit.

- **la correction orthographique à distance 1**, mesurée sur onze fautes
  réelles du journal de recherche :

      distance ≤ 2, ≥ 1 page    8 bonnes   3 MAUVAISES   0 silence
      distance ≤ 1, ≥ 1 page    6 bonnes   0 MAUVAISE    5 silences   ← retenu

  À deux lettres : `visdin → visio`, `rondei → rondele`, `juppe → juste`.

- **ce que l'état « aucun résultat » ne dit pas.** Pas de phrase expliquant le
  réglage au visiteur — c'est de la transparence d'ingénieur sur un écran de
  visiteur, et ça se lit comme une excuse. Pas de mention de journalisation
  non plus : rien ne journalise les recherches sans résultat aujourd'hui, et
  l'annoncer serait promettre un traitement inexistant. La ligne reviendra
  avec le code qui l'implémente.

## `menu-navigation.html`

Les panneaux larges de Produit / Solutions / Developers, thème clair et
thème sombre, aperçu bureau et mobile pilotables depuis la page. Les
données réelles viennent du DOM de `heurix.fr` et de `sitemap.xml` lus le
29 août 2026, pas d'une supposition sur ce que ces menus « devraient »
contenir.

Ce que la maquette décide, et pourquoi :

- **Le découpage en groupes** est mesuré sur le contenu réel, pas sur un
  découpage a priori : Produit reste 5 liens (3 ancres de `produit.html` +
  2 pages) répartis en 2 groupes ; Solutions reste 11 secteurs, répartis en
  2 colonnes de 6 et 5 parce que 11 n'a pas de division naturelle plus
  fine ; Developers reste 6 liens, répartis en Documentation (4, dont les
  deux ancres déjà promues sur `fonctionnalites.html` : `#cascade` et
  `#produits`) et Plateformes (4). Aucun lien n'a été ajouté ou retiré du
  menu de production, sauf un : `secteurs.html` (la page de synthèse des
  onze secteurs) entre dans le menu Solutions sous « Tous les secteurs → »
  — elle existe et n'y était pas.

- **Le thème sombre est un aplat `#101B4D`, pas le traitement translucide
  de `.pb-carte`.** Mesuré, en composant réellement le fond : une carte à
  6 % de blanc posée sur le point le plus clair du dégradé (`#4C3FE0`) donne
  `rgb(87, 75, 226)`, et le texte discret y tombe à **4,01:1** — sous le
  seuil AA de 4,5:1. L'accent `#5AB8E8` y descend à 2,69:1, sous le seuil
  texte et sous les 3:1 exigés d'un élément non textuel. Ce sont les deux
  chiffres que `styles.css` porte depuis le 28 août, pour la modale de
  recherche, et que `contrast.py` retrouve à l'identique.

  La première version de ce paragraphe annonçait 4,55:1 et « AA à 0,05 de la
  limite » : c'était le texte mesuré sur le dégradé **nu**, sans la carte
  posée dessus. Le translucide ne passe donc pas de justesse, il échoue.
  L'aplat donne 10,94:1 / 15,17:1 selon le texte, fixe, indépendant du
  dégradé.

- **Le header ne change pas entre les deux thèmes.** Recherche, sélecteur
  de langue, « Mon compte », les deux boutons d'action et le fond clair
  translucide du bandeau restent identiques, clair ou sombre — seul le
  panneau qui s'ouvre en dessous change de famille. Un bouton de menu
  toujours clair qui ouvre un panneau sombre est un choix assumé, pas un
  oubli : voir `rapport-menu-navigation.md` §6.

- **Sous 768px**, les colonnes de chaque panneau s'empilent en une seule
  liste, dans l'ordre de lecture d'origine — mécanisme identique à
  `.nav-drop-panel` en mobile aujourd'hui (`position:static`). Seule
  nuance : Solutions n'a qu'un seul groupe réel (« Secteurs », scindé en 2
  colonnes pour la largeur du bureau uniquement) et se rejoint donc sans
  espacement en pile, alors que Produit et Developers ont deux groupes
  réellement distincts qui gardent leur étiquette et leur espacement en
  pile.

- **Le clavier reprend l'existant tel quel**, mesuré en direct sur
  `heurix.fr` avant d'écrire la maquette : ouverture au clic (jamais au
  survol), `Escape` referme et rend le focus au bouton, `Tab` parcourt les
  liens dans l'ordre du DOM sans touche fléchée. Un seul ajout : le panneau
  se referme maintenant quand le focus sort de la zone de navigation
  (`focusout`) — l'existant le laisse ouvert dans ce cas, ce n'était pas à
  reproduire.

## Ce qui périmerait `menu-navigation.html`

Si Solutions gagne ou perd un secteur, si Developers gagne une troisième
ancre de documentation à mettre en avant, ou si `secteurs.html` change de
nom ou disparaît, le découpage en colonnes ci-dessus doit être recalculé —
pas simplement réutilisé. Et si l'implémentation choisit le traitement
translucide malgré la mesure du paragraphe précédent, ce fichier doit le
dire et pourquoi, ou être retiré.

## Ce qu'ils ne sont pas

Une spécification. L'implémentation peut diverger — mais alors le commit doit
dire pourquoi, et ces fichiers doivent suivre ou être retirés. Une maquette qui
survit à ce qu'elle décrivait est le même défaut qu'un commentaire périmé.

Appliqué une fois : l'étape « filtres » a fait diverger le comportement sous
768 px — la maquette masquait le rail, l'implémentation en fait une rangée de
pastilles qui défile, parce que masquer retirait le filtrage aux visiteurs
mobiles. `recherche-modale.html` a suivi le même jour, et porte la note.
