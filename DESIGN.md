---
name: Heurix
description: Moteur de recherche et de découverte pour catalogues techniques B2B
colors:
  bg: "#FFFFFF"
  bg-soft: "#F7F8FC"
  ink: "#12142B"
  ink-muted: "#5B5E76"
  line: "#E7E9F2"
  blue: "#5468FF"
  blue-deep: "#3F52E8"
  blue-deeper: "#2A3CD1"
  blue-tint: "#EEF1FF"
  green: "#1FAA6B"
  green-tint: "#E8F8F0"
  red-muted: "#D6584B"
  red-tint: "#FCEDEB"
  amber: "#B26A00"
  amber-tint: "#FFF6E6"
  amber-line: "#F0D5A3"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "54px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "12.5px"
    fontWeight: 700
    letterSpacing: "0.06em"
  data:
    fontFamily: "'IBM Plex Mono', monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "100px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.blue-deep}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    padding: "11px 20px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.blue-deeper}"
    textColor: "{colors.bg}"
  card:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  panel:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "26px 28px"
  chip:
    backgroundColor: "{colors.blue-tint}"
    textColor: "{colors.blue-deeper}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
    typography: "{typography.data}"
---

# Design System: Heurix

## Overview

**Creative North Star: "Le Catalogue Vivant"**

Heurix habille un ouvrage de référence qui répond au lieu de se laisser feuilleter. Le
produit indexe des catalogues techniques — visserie, outillage, plomberie, mode — où une
référence comme `M8x20 inox` porte plus d'information qu'une phrase. Le système visuel part
de là : la donnée produit n'est pas décorée, elle est **composée**. Le fonds est vaste, le
propos est de le rendre interrogeable, et l'interface s'efface devant ce qu'elle donne à
trouver.

La densité est assumée sans être écrasante. Un fond blanc, un bleu indigo unique, des
filets fins et beaucoup de blanc entre les blocs : la hiérarchie se lit à la surface et au
trait, jamais au relief. La moitié du système typographique est monospacée — non par goût
technique, mais parce qu'une référence produit se lit comme sur une fiche fournisseur, en
chiffres alignés. C'est le trait le plus distinctif de cette identité et celui qu'il faut
préserver en priorité.

Le ton est précis et silencieux. Rien n'attire l'œil sans raison : les rayons sont
modérés, les transitions courtes, les couleurs d'état rares. Un marchand ouvre cette console
tous les jours pour travailler ; le système est conçu pour qu'il n'ait jamais à en prendre
conscience.

**Key Characteristics:**
- Deux voix typographiques à parts égales : Plus Jakarta Sans pour le discours, IBM Plex Mono pour la donnée produit
- Un seul accent chromatique, un bleu indigo, sur un fond blanc et des gris bleutés
- Plat au repos ; la profondeur n'apparaît qu'en réponse à une action
- Hiérarchie par le filet et le fond teinté, jamais par l'ombre portée
- Densité d'information élevée, tenue par le blanc entre les blocs plutôt que par la taille

## Colors

Une famille bleue unique posée sur des neutres bleutés, plus trois couleurs d'état
strictement réservées au sens. La palette est monochrome par discipline : le bleu ne
décore rien, il désigne.

### Primary
- **Bleu Indigo Vif** (#5468FF) : l'accent unique. Liens, éléments actifs, bordures de
  focus, remplissages de puces et de graphiques. C'est la couleur qui dit « ceci compte ».
  **Jamais en fond d'un texte blanc** — voir la Règle du Bleu Lisible.
- **Bleu Indigo Profond** (#3F52E8) : la version porteuse. Fond des boutons primaires,
  contour de focus. C'est le seul bleu qui passe le seuil de contraste sous du texte blanc.
- **Bleu Indigo Dense** (#2A3CD1) : état survolé du bouton primaire, et texte bleu sur fond
  teinté.
- **Voile Indigo** (#EEF1FF) : fond des puces, des surfaces sélectionnées et des encarts
  d'information. Le bleu réduit à une atmosphère.

### Neutral
- **Blanc** (#FFFFFF) : le fond de toutes les surfaces de contenu. Le repos par défaut.
- **Papier Froid** (#F7F8FC) : le fond de page et des zones en retrait. Sépare deux blocs
  sans avoir à tracer un trait.
- **Encre Bleu-Nuit** (#12142B) : tout le texte principal. Un noir bleuté, jamais un noir
  pur — il appartient à la même famille que le primaire.
- **Encre Atténuée** (#5B5E76) : texte secondaire, légendes, libellés d'aide.
- **Filet** (#E7E9F2) : bordures de cartes, séparateurs, contours de champs. Le principal
  outil de hiérarchie de ce système.

### Tertiary — les trois états
- **Vert Validé** (#1FAA6B) et **Voile Vert** (#E8F8F0) : succès, gain, disponible.
- **Rouge Atténué** (#D6584B) et **Voile Rouge** (#FCEDEB) : erreur, perte, rupture.
- **Ambre** (#B26A00), **Voile Ambre** (#FFF6E6), **Filet Ambre** (#F0D5A3) : avertissement,
  quota proche, action requise. L'ambre est la seule couleur à disposer d'un filet dédié.

### Named Rules

**La Règle du Bleu Lisible.** `--blue` (#5468FF) mesure **4,37:1** sur blanc — sous le seuil
WCAG AA de 4,5:1, constaté par audit Lighthouse le 10 août 2026. Il ne porte jamais de texte
blanc. Tout fond bleu sous du texte blanc utilise `--blue-deep` (#3F52E8). Cette règle est
la raison d'être de la distinction entre les deux bleus ; la contourner annule un correctif
d'accessibilité déjà payé.

**La Règle de l'Accent Unique.** Le bleu est la seule couleur non fonctionnelle du système.
Vert, rouge et ambre ne sont pas des couleurs de marque : ce sont des mots. Employer le vert
parce qu'un bloc a besoin de variété, c'est le vider de son sens partout ailleurs.

**La Règle du Token ou Rien.** Toute couleur passe par une variable CSS. Le système compte
aujourd'hui **588 hexadécimaux en dur** contre 17 variables : deux d'entre eux, `#C0392B` et
`#0F7A3D`, redoublent sémantiquement `--red-muted` et `--green` avec des valeurs différentes.
Une couleur écrite en dur est une couleur qui échappera au prochain changement de thème.

## Typography

**Police de discours :** Plus Jakarta Sans (auto-hébergée, graisses 400/500/600)
**Police de donnée :** IBM Plex Mono (auto-hébergée, graisses 400/500)

**Caractère :** une grotesque géométrique contemporaine, au dessin ouvert et légèrement
chaleureux, mise en tension avec une monospace technique très lisible. Le contraste entre
les deux n'est pas décoratif : il sépare ce que Heurix *dit* de ce que Heurix *trouve*.

### Hierarchy
- **Display** (800, 54px, interligne 1,05, −0,02em) : le titre de première section d'une page
  publique. Un par page, jamais dans la console.
- **Headline** (700, 34px, interligne 1,15) : titres de section sur les pages publiques.
- **Title** (700, 17px) : titres de panneaux et de cartes, y compris dans la console.
- **Body** (400, 15px, interligne 1,6) : le texte courant. Longueur de ligne tenue par un
  conteneur de 1100px.
- **Label** (700, 12,5px, +0,06em, souvent capitales) : étiquettes de formulaire, en-têtes de
  tableau, éléments de navigation.
- **Data** (IBM Plex Mono, 400, 13px) : références produit, identifiants, extraits de code,
  valeurs chiffrées d'un tableau.

### Named Rules

**La Règle des Deux Voix.** Toute donnée qui vient du catalogue du marchand — référence,
identifiant, code, requête tapée par un visiteur — se compose en IBM Plex Mono. Tout ce que
Heurix énonce se compose en Plus Jakarta Sans. Cette frontière est le trait identitaire le
plus fort du système ; l'effacer rendrait l'interface générique.

**La Règle du Plancher à 12px.** Aucun texte sous 12px. Le système en compte aujourd'hui
**104 déclarations**, dont une à **8px** : ce sont des dettes, pas des références. Les
libellés descendent à 12,5px, jamais plus bas.

**La Règle de la Taille de Base Héritée.** Aucune `font-size` n'est déclarée sur `html` ni
sur `body` : la référence reste celle du navigateur, réglage utilisateur compris. Ne jamais
poser de taille de base en pixels — ce serait retirer à l'utilisateur le contrôle de sa
propre lecture.

## Layout

Conteneur de contenu à **1100px** maximum, centré, avec 28px de marge intérieure. Les barres
d'en-tête vont plus large, à **1360px**, pour que la navigation respire au-delà du texte.

Le rythme d'espacement s'appuie sur une progression courte — 4, 8, 12, 16, 24, 28px — le pas
de 8px dominant nettement (63 occurrences) devant 10, 12 et 14px. **Ce n'est pas encore une
échelle** : les valeurs intermédiaires cohabitent avec les paliers. Les nouveaux écrans se
tiennent aux six paliers ci-dessus.

Points de rupture observés : **900px** (20 usages, le principal), **760px** (16), puis 800,
640 et 480px de façon éparse. Le système réel est à deux paliers — au-delà de 900px, entre
760 et 900px, en dessous de 760px. Les trois autres sont des exceptions ponctuelles à ne pas
reproduire.

### Named Rules

**La Règle des Deux Ruptures.** Un nouvel écran se pense à trois largeurs : large, tablette
(≤900px), mobile (≤760px). Introduire un quatrième palier fragmente un système déjà tenu par
81 requêtes média.

## Elevation & Depth

**Le système est plat.** La profondeur n'est pas un attribut de surface, c'est une réponse à
une action. Une carte au repos est un fond blanc, un filet de 1px et un rayon : rien d'autre.
Au survol, elle se soulève de 3px et projette une ombre très diffuse ; au relâchement, elle
retombe. La hiérarchie entre deux blocs immobiles passe par le fond (`--bg` contre
`--bg-soft`, ou `--blue-tint`) et par le filet, jamais par l'ombre.

### Shadow Vocabulary
- **Ombre d'ancrage** (`box-shadow: 0 2px 12px -6px rgba(18,20,43,0.06)`) : la seule ombre
  admise au repos, sur les panneaux de la console. Opacité 6% — elle décolle la surface du
  fond sans se voir.
- **Ombre de survol** (`box-shadow: 0 16px 28px -20px rgba(18,20,43,0.22)`) : accompagne le
  `translateY(-3px)` des cartes cliquables. Large, très diffuse, jamais nette.
- **Anneau de focus** (`box-shadow: 0 0 0 3px var(--blue-tint)`) : la forme dominante de
  `box-shadow` dans ce système. Ce n'est pas une ombre, c'est un signal.

### Named Rules

**La Règle du Plat au Repos.** Une surface immobile ne porte pas d'ombre, à la seule
exception de l'ombre d'ancrage à 6% sur les panneaux de console. Toute autre ombre doit être
déclenchée par un état — survol, focus, sélection. Une ombre permanente ajoutée pour
« détacher » un bloc signifie que le filet ou le fond n'a pas été employé.

**La Règle de l'Anneau plutôt que du Contour.** Le focus clavier se marque par
`outline: 2px solid var(--blue-deep)` avec `outline-offset: 4px`, ou par un anneau
`0 0 0 3px`. Il n'est jamais supprimé : le système compte 20 règles `:focus-visible` pour 15
`outline:none`, et cet équilibre est délibéré.

## Shapes

Un langage de formes doux mais retenu. Le rayon de **8px** est le défaut (71 usages) : il
s'applique aux boutons, aux champs et aux petits conteneurs. Les cartes montent à **12 à
16px** à mesure qu'elles grandissent — le rayon suit la surface. La **pilule** (100px,
62 usages) est réservée aux puces, aux étiquettes et aux bascules : tout ce qui se compte
plutôt que se lit. Le **cercle** (50%, 17 usages) marque les pastilles et les avatars.

Les bordures sont uniformément de **1px**, en `--line` au repos, en `--blue-tint` ou
`--blue` à l'état actif. Aucun trait épais, aucun contour décoratif.

### Named Rules

**La Règle du Rayon Croissant.** Le rayon suit la taille : 6-8px pour un contrôle, 12px pour
une carte, 16px pour un panneau. Un grand bloc à petit rayon paraît coupé ; un petit contrôle
à grand rayon paraît mou.

## Components

### Buttons
- **Forme :** rayon modéré (8px), hauteur portée par 11px de marge verticale.
- **Primaire :** fond Bleu Indigo Profond (`--blue-deep` #3F52E8), texte blanc, graisse 600,
  14,5px, marges `11px 20px`. Le fond est `--blue-deep` et non `--blue` par obligation de
  contraste, pas par goût.
- **Survol / focus :** fond `--blue-deeper` (#2A3CD1), transition de 120 à 150ms.
- **Fantôme :** fond transparent, texte `--ink`, filet `--line`. Employé pour l'action
  secondaire à côté d'un primaire.
- **Manque connu :** aucun état `:active` n'existe dans le système (0 règle sur 6 279
  lignes). Un bouton ne confirme jamais visuellement qu'il a été pressé — sur mobile, où le
  survol n'existe pas, rien ne répond au doigt.

### Chips
- **Style :** fond `--blue-tint`, texte `--blue-deeper`, rayon pilule (100px), marges
  `6px 12px`, composition en IBM Plex Mono.
- **Rôle :** les puces portent presque toujours de la donnée produit — une requête suggérée,
  une facette, une référence. D'où le mono, conformément à la Règle des Deux Voix.

### Cards / Containers
- **Carte de contenu :** fond blanc, filet `--line` 1px, rayon 14px, marge intérieure 24px.
  Plate au repos ; au survol, `translateY(-3px)` et ombre de survol.
- **Panneau de console :** fond blanc, filet `--line` 1px, rayon 16px, marges `26px 28px`,
  ombre d'ancrage à 6%. C'est le conteneur de travail de la console.
- **Encart teinté :** fond `--blue-tint`, `--green-tint`, `--red-tint` ou `--amber-tint`
  selon le sens, sans filet sauf pour l'ambre qui dispose de `--amber-line`.

### Inputs / Fields
- **Style :** filet `--line` 1px, fond blanc, rayon 8px.
- **Focus :** `outline: 2px solid var(--blue-deep)` avec `outline-offset: 4px`, ou anneau
  `0 0 0 3px var(--blue-tint)`.
- **Manque connu :** 34 contrôles de formulaire de la console n'ont pas de `<label>` associé,
  et 23 champs n'ont qu'un `placeholder` pour toute indication. Le placeholder est un
  exemple, pas une étiquette.

### Navigation
- **En-tête :** barre pleine largeur jusqu'à 1360px, libellés en Label, menus déroulants
  ouverts **au clic et non au survol** — décision délibérée et documentée dans la feuille de
  style.
- **Chevron :** rotation de 45° à 225° en 150ms à l'ouverture. Le panneau qu'il annonce, lui,
  apparaît sans transition (`display:none` → `display:block`).
- **Console :** navigation par panneaux en trois piliers. L'écran actif n'est pas reflété
  dans l'URL — pas de lien profond, et le retour arrière sort de la console.

### Le champ de recherche de démonstration
Le composant signature du site public. Une barre de saisie large, rayon pilule, entourée de
puces de requêtes suggérées en mono, au-dessus d'une grille de résultats qui se met à jour à
la frappe. C'est la seule surface où le produit se montre en fonctionnement plutôt que de se
décrire — elle mérite un soin supérieur au reste de la page.

## Do's and Don'ts

### Do:
- **Do** composer toute donnée issue du catalogue en IBM Plex Mono, et tout propos de Heurix
  en Plus Jakarta Sans (Règle des Deux Voix).
- **Do** utiliser `--blue-deep` (#3F52E8) sous tout texte blanc ; `--blue` (#5468FF) reste un
  accent, pas un fond de texte.
- **Do** hiérarchiser par le filet `--line` et le fond teinté avant d'envisager une ombre.
- **Do** tenir les transitions entre 120 et 200ms, comme le reste du système.
- **Do** poser le rayon selon la taille : 8px pour un contrôle, 12-16px pour un conteneur,
  100px pour ce qui se compte.
- **Do** conserver le focus visible : 20 règles `:focus-visible` existent, elles sont
  intentionnelles.

### Don't:
- **Don't** employer un emoji comme icône. Le site en compte 8 sur trois pages publiques
  alors qu'il dispose de 18 à 32 SVG en ligne par page. Une icône se dessine.
- **Don't** descendre sous 12px. Les 104 déclarations existantes sont une dette à résorber,
  pas un précédent.
- **Don't** écrire une couleur en hexadécimal quand un token existe. `#C0392B` et `#0F7A3D`
  redoublent déjà `--red-muted` et `--green` avec d'autres valeurs.
- **Don't** ajouter une ombre permanente pour détacher un bloc (Règle du Plat au Repos).
- **Don't** ouvrir un menu au survol — le système a tranché pour le clic.
- **Don't** utiliser la police **Luckiest Guy** : elle est déclarée en `@font-face`
  (`styles.css:37`) et employée nulle part. Elle n'appartient pas à ce système ; sa
  déclaration est un résidu à supprimer.
- **Don't** introduire un quatrième point de rupture (Règle des Deux Ruptures).
