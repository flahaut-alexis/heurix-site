---
title: Refonte des menus Produit & Developers — benchmark et recommandations
site: heurix.fr
date: 2026-08-30
---

# Refonte des menus Produit & Developers — benchmark Algolia / Meilisearch et recommandations pour Heurix

**Périmètre.** Ce document porte sur la barre de navigation desktop de heurix.fr, avec un focus sur les menus déroulants *Produit* et *Developers*, les deux jugés perfectibles. Le menu *Solutions* n'est pas retravaillé ici : il sert au contraire de point de comparaison interne, car il est déjà construit selon des principes que les deux autres menus n'appliquent pas encore.

**Méthode.** L'analyse a été conduite sur une fenêtre de 1440×900, une résolution desktop standard, précisément pour écarter le biais signalé en amont : la console Claude qui réduit la largeur visible de l'écran dans cette session. Trois sites ont été inspectés côte à côte, en ouvrant systématiquement chaque menu déroulant et en relevant aussi bien le rendu visuel que les valeurs CSS réelles (couleurs, police, ombres, rayons) : heurix.fr, algolia.com et meilisearch.com. Ces valeurs sont reprises telles quelles plus bas pour que les recommandations soient directement exploitables par l'équipe produit ou l'intégrateur qui reprendra ce travail.

## En résumé

Le menu *Solutions* de Heurix utilise déjà de bonnes pratiques (pastilles d'icônes colorées, deux colonnes lisibles, lien d'entrée vers la liste complète) que les menus *Produit* et *Developers* n'exploitent pas : ces deux menus sont de simples listes de liens texte, sans icône, sans description, sans hiérarchie visuelle, et sans aucun élément de conversion. En face, Algolia et Meilisearch traitent systématiquement leurs menus comme un espace éditorial à part entière : icône par catégorie, une phrase de description sous chaque lien, un bloc visuel mis en avant (actualité, ressource phare ou offre) et, pour Meilisearch en particulier, les vraies icônes des technologies citées plutôt que des pictogrammes génériques. Les recommandations qui suivent proposent deux niveaux d'ambition, du plus rapide au plus structurant, et sont illustrées par deux maquettes HTML interactives jointes à ce rapport.

## 1. Ce qui existe aujourd'hui sur heurix.fr

La barre de navigation de Heurix est sticky, en verre dépoli blanc (`rgba(255,255,255,.92)`) avec une bordure basse `1px solid #E7E9F2`, sur fond de page en `Plus Jakarta Sans`. Elle est déjà bien composée dans l'ensemble : logo à gauche, quatre entrées (*Produit*, *Solutions*, *Developers*, *Blog*), une barre de recherche du site avec raccourci `Ctrl K`, le compte, le switch de langue, puis le CTA principal *Démarrer l'essai gratuit* en indigo plein (`#3F52E8`). Rien à reprendre sur cette structure globale ni sur l'inspiration Algolia qui la sous-tend : c'est le contenu des deux menus déroulants qui reste en retrait.

Le menu **Produit** s'ouvre sur deux colonnes de texte brut : « Le problème », « Notre mission » et « Le moteur » d'un côté, « Fonctionnalités » et « Simulateur ROI » de l'autre. Le regroupement en lui-même est pertinent — d'un côté le narratif de positionnement, de l'autre l'action concrète — mais rien à l'écran ne le signale : les cinq liens ont exactement le même poids visuel qu'un paragraphe de texte courant, sans icône, sans sous-texte, sans lien vedette. Un visiteur qui ne connaît pas encore Heurix doit cliquer pour comprendre ce que recouvre « Le moteur » ou à quoi sert le « Simulateur ROI ».

Le menu **Developers** répète la même structure à deux colonnes, mais le mélange de contenu y est plus problématique : « Documentation », « La cascade d'annotations », « Structure des produits » et « Guide de mise en route » sont des pages de doc conceptuelle, tandis que « Intégrations », « PrestaShop », « WooCommerce » et « Shopify » sont des plateformes e-commerce concrètes. Les deux familles sont rendues de façon strictement identique — même typographie, même couleur, aucune icône — alors qu'un développeur qui scanne le menu a besoin de distinguer en un coup d'œil « je lis un concept » de « je connecte ma boutique ».

Le contraste le plus révélateur est interne au site : le menu **Solutions**, lui, utilise déjà des pastilles d'icônes de 28px en indigo clair (`#EEF1FF` sur icône `#3F52E8`), une grille à deux colonnes de huit secteurs, et un lien d'en-tête « Tous les secteurs → ». C'est exactement le niveau d'habillage qui manque à *Produit* et *Developers* — et comme le pattern existe déjà dans la base de code du site, c'est aussi le chemin le moins coûteux pour corriger les deux autres menus.

## 2. Benchmark comparatif

| Dimension | Heurix — Produit / Developers (actuel) | Algolia | Meilisearch |
|---|---|---|---|
| Format du panneau | Carte étroite à 2 colonnes, largeur fixe | *Produit* : mega-menu plein écran (4 colonnes) ; *Developers* : carte flottante plus étroite | Panneau large ancré sous l'onglet, avec petite flèche de connexion visuelle |
| Icônes par lien | Aucune | Une icône par **catégorie** (pas par lien) | Une icône par **lien**, y compris de vraies icônes de technologies (React, JS, Laravel) |
| Description sous chaque lien | Aucune | Oui, une phrase, sur le menu *Produit* (absente sur *Developers*) | Oui, une phrase, sur les deux menus |
| Regroupement | Par type de contenu (positionnement / action ; doc / plateformes) | Par grande famille de produit | Narratif : « Search → Discover → Ask » côté produit, ce qui raconte une histoire plutôt qu'une simple liste |
| Bloc éditorial ou promo | Aucun | Visuel + CTA sur les deux menus (fonctionnalité mise en avant, événement DevCon) | Bloc « Cloud » distinct avec bordure, façon encart publicitaire interne |
| Badges « Nouveau » | Aucun | Non observé dans les menus | Oui (« Personalization NEW », « Conversational NEW », « AI Agents & RAG NEW ») |
| Logos de marque réels | Non (texte seul pour PrestaShop / WooCommerce / Shopify) | Non applicable | Oui, pour chaque techno d'intégration |
| CTA dans le menu | Aucun | « Explore the platform » à proximité, carte promo cliquable | Boutons « Get started » / « Request custom demo » sous le panneau |
| Style visuel | Clair, indigo, `Plus Jakarta Sans` | Fond blanc sur header sombre, bleu `#003DFF`, `Inter` | Panneau sombre sur héro violet, `Inter`, textes blancs à opacité variable |

## 3. Ce qu'on retient de chaque référence

**Algolia — Produit.** Le mega-menu occupe toute la largeur de l'écran et structure quatre familles (*AI Search & Retrieval*, *Artificial Intelligence*, *Intelligent Data Kit*, *Infrastructure*), chacune précédée d'une icône de catégorie et d'un lien « Overview ». Sous chaque lien, une phrase explique le bénéfice plutôt que de se contenter de nommer la fonctionnalité : « Recommendations » est accompagné de « Use behavioral cues to drive higher engagement ». Cette description suffit souvent à répondre à la question de l'utilisateur sans qu'il ait besoin de cliquer.

**Algolia — Developers.** Le même principe est repris dans un format plus compact : une carte flottante à coins arrondis (`border-radius: 6px`, ombre légère `0 1px 20px rgba(0,0,0,.1)`), avec trois colonnes (*Get started*, *Resources*, *Quick Links*) et un visuel promotionnel sur la gauche annonçant l'événement DevCon. Les descriptions disparaissent ici — seuls les titres restent — ce qui montre qu'Algolia adapte la densité d'information au volume de contenu plutôt que d'appliquer un seul gabarit partout.

**Meilisearch — Produit.** C'est la référence la plus riche des trois. Les fonctionnalités ne sont pas listées par ordre alphabétique mais racontées comme un parcours : *Search* (recherche plein texte, vectorielle, fédérée), puis *Discover* (personnalisation, facettes), puis *Ask* (conversationnel, agents IA) — un regroupement narratif qui installe une hiérarchie de maturité produit. Les nouveautés portent un badge rose « NEW » qui attire l'œil sans dépendre de la position. Une colonne séparée met en avant *Cloud* dans un encart à bordure distincte, traité comme un produit à part qui mérite sa propre mise en avant plutôt que d'être noyé dans la liste.

**Meilisearch — Developers.** Le détail le plus transférable à Heurix se trouve ici : chaque intégration (*React*, *Laravel*, *JavaScript*, *MCP*) est accompagnée du vrai logo de la technologie plutôt que d'une icône générique, ce qui rend le menu immédiatement scannable pour un développeur qui cherche son stack. Une flèche discrète relie visuellement le panneau à l'onglet *Developers* dans la barre, un détail de continuité qui renforce la lecture « ce panneau appartient à ce bouton ».

## 4. Pourquoi ça compte pour Heurix

Trois conséquences concrètes découlent de ce constat. D'abord un coût d'hésitation : sans description, un visiteur qui ne connaît pas encore le vocabulaire de Heurix (« cascade d'annotations », « simulateur ROI ») doit cliquer à l'aveugle pour savoir si la page l'intéresse, ce qui dégrade la exploration du menu par rapport à un survol qui donnerait la réponse immédiatement. Ensuite un déficit de crédibilité pour l'audience développeurs : lister PrestaShop, WooCommerce et Shopify en texte brut, au même niveau qu'un lien de documentation interne, ne restitue pas le fait que ce sont des intégrations concrètes et reconnaissables — l'usage du vrai logo, comme le fait Meilisearch pour React ou Laravel, transforme instantanément la perception de sérieux technique. Enfin une incohérence interne : le menu *Solutions* a habitué l'œil à des pastilles d'icônes colorées ; leur absence dans *Produit* et *Developers* se remarque, et donne l'impression que ces deux menus ont été construits plus vite ou avec moins de soin.

À titre d'observation de marché, et non comme une recommandation produit puisque cela dépend de votre feuille de route réelle : les menus Produit d'Algolia et de Meilisearch sont aujourd'hui structurés autour de l'IA générative et des agents (*Agent Studio*, *Ask AI*, *MCP Server*, *AI Agents & RAG*). Si Heurix dispose déjà de capacités comparables ou en prépare, les faire apparaître dans le menu alignerait la navigation sur les attentes actuelles de la catégorie ; si ce n'est pas le cas, c'est un choix de positionnement à part entière, pas un défaut de navigation à corriger dans l'immédiat.

## 5. Recommandations

### Priorité 0 — Gains rapides, cohérence immédiate

Le geste le plus rentable consiste à réutiliser tel quel le pattern déjà présent dans le menu *Solutions* : une pastille de 28px en indigo clair (`#EEF1FF`) contenant une icône trait de 18px en `#3F52E8`, posée devant chaque lien de *Produit* et *Developers*. En complément, une ligne de description grise (`#5B5E76`, ~13px) sous chaque titre suffit à lever l'essentiel de l'ambiguïté relevée plus haut, sans toucher à l'architecture de l'information existante ni au découpage en colonnes actuel. C'est un chantier essentiellement CSS et contenu, mobilisable en premier.

### Priorité 1 — Structurant

Trois changements plus profonds sont recommandés dans un second temps. Le premier consiste à remplacer les icônes génériques de la colonne *Plateformes* du menu *Developers* par les vrais repères visuels de PrestaShop, WooCommerce et Shopify (logos officiels récupérables dans leurs kits de marque respectifs), pour obtenir l'effet de reconnaissance immédiate observé chez Meilisearch. Le deuxième consiste à regrouper le contenu par intention plutôt que par type : côté *Developers*, séparer « Démarrer » (guide de mise en route, quickstart, documentation), « Concepts » (cascade d'annotations, structure des produits) et « Intégrations » (les plateformes) ; côté *Produit*, distinguer « Comprendre » (le problème, la mission), « Le produit » (le moteur, les fonctionnalités) et « Passer à l'action » (simulateur ROI, démo). Le troisième consiste à occuper l'espace laissé vide à gauche de chaque panneau par un bloc éditorial : pour *Produit*, un renvoi vers la démo interactive déjà présente sur la page d'accueil (le widget de recherche en direct sur le catalogue « Bricolage & Outillage ») ; pour *Developers*, une mise en avant du « Guide de mise en route » sous forme de mini-extrait d'appel API, dans l'esprit des chips `M8x20 inox` déjà utilisées sur la page d'accueil.

### Priorité 2 — Finition

Une fois les deux premiers niveaux en place, quelques ajustements de détail complètent le travail : un badge « Nouveau » réutilisable pour signaler les ajouts récents sans dépendre de leur position dans la liste ; une transition d'ouverture plus douce (léger fondu-glissé de 120 à 160ms, en respectant `prefers-reduced-motion`) ; et une vérification d'accessibilité systématique sur les deux boutons de menu — `aria-expanded`, fermeture au clavier avec `Échap`, focus visible, cible tactile d'au moins 44px de côté pour la version mobile. Ce dernier point concerne aussi la version responsive du menu, qui n'a pas été retravaillée dans ce document faute de périmètre demandé, mais qui mérite un passage équivalent une fois la version desktop validée.

## 6. Les maquettes fournies

Deux maquettes HTML autonomes accompagnent ce rapport, construites avec les vraies valeurs de design de Heurix relevées ci-dessus (police, couleurs, ombres, rayons) plutôt qu'avec un habillage générique, et interactives : les boutons *Produit* et *Developers* ouvrent réellement leur panneau, et un bouton « Avant / Après » en haut de page permet de basculer entre l'état actuel du site et la proposition, sans quitter la page.

`maquette-option-A-quick-win.html` applique uniquement la Priorité 0 : mêmes colonnes, mêmes liens, mêmes intitulés qu'aujourd'hui, avec pastilles d'icônes et descriptions ajoutées. C'est la version à proposer si l'objectif est un correctif rapide, livrable sans revoir l'arborescence du menu.

`maquette-option-B-mega-menu-editorial.html` va jusqu'à la Priorité 1 : panneaux élargis, contenu regroupé par intention plutôt que par type, bloc éditorial à gauche pour chaque menu, et un traitement différencié (pastilles de couleur) pour les trois plateformes d'intégration en attendant l'intégration des logos officiels. C'est la version à proposer si l'objectif est de rapprocher durablement le niveau de finition de Heurix de celui d'Algolia et Meilisearch.

Les logos PrestaShop, WooCommerce et Shopify n'ont pas été reproduits à l'identique dans la maquette B pour des raisons de droits de marque : ils sont représentés par des pastilles de couleur distinctes (respectivement proche du rose PrestaShop, du violet WooCommerce et du vert Shopify), à remplacer par les SVG officiels au moment de l'implémentation.

## 7. Prochaines étapes

Le plus simple est d'arbitrer entre les deux options à partir des maquettes jointes — en ouvrant le fichier HTML directement dans un navigateur, en basculant Avant/Après sur les deux menus — puis, une fois la direction choisie, d'affiner ensemble le contenu exact des descriptions et le choix des icônes avant transmission à l'intégration.
