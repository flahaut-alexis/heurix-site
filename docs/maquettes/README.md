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

## Ce qu'ils ne sont pas

Une spécification. L'implémentation peut diverger — mais alors le commit doit
dire pourquoi, et ces fichiers doivent suivre ou être retirés. Une maquette qui
survit à ce qu'elle décrivait est le même défaut qu'un commentaire périmé.
