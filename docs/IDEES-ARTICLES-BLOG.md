# Idées d'articles de blog — Heurix

Proposition de 10 sujets neufs, sans doublon avec les 30 articles déjà publiés sur heurix.fr/blog.html. Aucun article n'a été rédigé : ce document contient uniquement les propositions, à valider avant toute rédaction.

## Ce qui a été vérifié avant de proposer

**Ton et structure du blog existant.** Titres courts, souvent construits en deux temps séparés par « : » (tension puis résolution, ou constat puis question). Accroche en une phrase qui pose un problème concret et chiffré dès le premier paragraphe. Les articles techniques incluent de vrais exemples `curl`/JSON ; les comparatifs nomment les concurrents sans détour (Algolia, Typesense, Meilisearch, Sensefuel, Doofinder). Aucun blabla d'intro ni de conclusion générique — le texte va au fait et se termine souvent sur un lien vers l'essai gratuit ou un endpoint précis. Rythme : environ 20 articles publiés en juillet 2026, 7 en août — cadence mensuelle confirmée mais volume dégressif.

**Ce qui est déjà couvert (pour éviter les doublons) :** tolérance aux fautes, synonymes métier, facettes B2B, Custom Rules, SKU/DIN/ISO, comparatifs concurrents (x2), pricing, build vs. buy (x2), EBITDA, ROI, dashboard de stats, préparation opération commerciale, mise en avant pack/promo (x2), moteurs natifs Shopify/PrestaShop/Magento, recherche vectorielle, MCP, Browse & Discovery (tutoriel technique), glossaire, recherche sans résultat (x2 — dashboard et correction). Aucun de ces dix sujets n'y touche.

**Angles confirmés en creusant fonctionnalites.html et docs.html :**
- `compare_at_price` (badge de réduction automatique) — confirmé présent uniquement dans la documentation API, mentionné nulle part ailleurs sur le site.
- Multilingue — confirmé qu'il existe **deux** mécanismes distincts et non expliqués : le filtre `lang` au sein d'un même catalogue, et la recherche fédérée entre catalogues (un catalogue par langue). Aucun article ne les distingue.
- Aucun article publié à ce jour n'est spécifique à un secteur, alors que les 11 pages solutions le sont toutes — d'où les 3 idées sectorielles ci-dessous, choisies parmi les 3 secteurs demandés (vins, mode, automobile) après lecture complète de leurs pages.

---

## 1. Vins & spiritueux — millésime, format, prix

**Secteur :** Vins & spiritueux

**Mot-clé / intention de recherche :** « recherche produit site vins en ligne », « moteur de recherche caviste e-commerce » — intention d'un caviste, négociant ou distributeur de vins/spiritueux qui évalue une solution de recherche pour son catalogue.

**Pourquoi c'est une bonne opportunité SEO :** Aucun article sectoriel n'existe à ce jour alors que la page solutions/vins.html contient un matériau très concret et jamais réutilisé en blog (le pack de règles vins, ses annotations, l'exemple « magnum 2015 » confondu avec un prix à 20,15 €). Peu de contenu francophone traite spécifiquement de la recherche interne pour ce secteur — faible concurrence SEO, forte pertinence pour l'ICP PME/ETI visé.

**Plan (3-5 puces) :**
- Le problème : un millésime est un nombre à 4 chiffres — un moteur généraliste le confond avec un prix, une référence interne ou le classe comme texte libre (exemple concret du site : « magnum 2015 » qui remonte un vin à 20,15 €).
- Ce que le pack de règles vins isole automatiquement : millésime (borné 1900-2029), format (magnum = 150cl, reconnu sous les deux formes), degré d'alcool, couleur (FR/IT/ES), élevage (bio, biodynamie, Demeter), type tranquille/mousseux.
- Les profils composés utiles à un caviste sans configuration : MOUSSEUX_MILLESIME_2015 pour un champagne millésimé, ROUGE_BIODYNAMIE pour un rouge en biodynamie.
- Cas d'usage concret : construire une page « tous les magnums » ou « millésime 2015 » sans construire soi-même la taxonomie.
- CTA : tester sur son propre catalogue vins, ou ajouter une Custom Rule pour une appellation locale non reconnue par le pack.

**Source :** heurix.fr/solutions/vins.html, heurix.fr/fonctionnalites.html (packs de règles par secteur)

---

## 2. Automobile — trois équipementiers, trois écritures de référence

**Secteur :** Automobile

**Mot-clé / intention de recherche :** « recherche référence pièce détachée auto site web », « moteur de recherche pièces auto e-commerce » — distributeur ou grossiste en pièces détachées cherchant à réduire les erreurs de commande liées à la référence.

**Pourquoi c'est une bonne opportunité SEO :** Comme pour les vins, aucun article sectoriel automobile n'existe malgré une page solutions très riche. L'angle « plaquettes avant montées à l'arrière = un retour, pas une approximation » est un exemple à fort impact émotionnel/business, dans la veine EBITDA/ROI déjà éprouvée par le blog. Bonus : la page solutions assume une limite honnête (pas d'équivalence OEM automatique) — cohérent avec le ton factuel du blog, différenciant vs. discours commercial classique.

**Plan (3-5 puces) :**
- Le problème posé dès l'intro : une référence Bosch (0986494574), un filtre MANN (W712/75), une pièce Valeo (598123) — trois grammaires différentes pour le même geste d'achat, et un moteur généraliste n'y voit que des suites de caractères.
- La seconde passe qui compte vraiment : essieu (avant/arrière), côté (gauche/droit), motorisation (y compris désignations commerciales HDi/TDi/TSI) — et pourquoi « plaquettes avant » + « arrière » doivent former un couple, pas deux mots isolés.
- Chiffrer le coût : une plaquette montée sur le mauvais essieu revient au comptoir — traduire en coût logistique/SAV pour un distributeur.
- Ce que le pack ne fait pas (honnêteté assumée) : pas de table d'équivalence OEM ↔ équipementier automatique ; comment le combler avec son propre champ indexé.
- CTA : indexer son catalogue de pièces avec le pack automobile, ou ajouter une Custom Rule pour un équipementier non couvert.

**Source :** heurix.fr/solutions/automobile.html

---

## 3. Mode & retail — la taille n'est pas un numéro de modèle

**Secteur :** Mode & retail

**Mot-clé / intention de recherche :** « recherche produit boutique mode en ligne », « moteur de recherche vêtements taille couleur » — e-commerçant mode/retail cherchant à réduire les recherches sans résultat sur un catalogue en stock.

**Pourquoi c'est une bonne opportunité SEO :** Troisième secteur demandé, matériau tout aussi riche que les deux précédents et non exploité. Angle très concret et facile à illustrer (« pull rouge 38 » qui échoue sur une fiche disant « bordeaux », « T38 », « maille »), proche du vécu quotidien d'un e-commerçant mode — bon potentiel de partage.

**Plan (3-5 puces) :**
- Le problème : 6 attributs (famille, coupe, matière, couleur, taille, saison) sans ordre fixe dans une même requête — « pull col roulé laine T38 » mélange 4 vocabulaires en une seule phrase.
- L'angle synonymes, spécifique à la mode : 10 groupes de variantes orthographiques neutralisées nativement (t-shirt/tee-shirt/tshirt/tee shirt, sneaker/basket) — le seul secteur où la difficulté n'est pas de lire un code mais d'admettre qu'un même vêtement s'écrit de 10 façons.
- Démonstration chiffrée : une cliente cherche « pull rouge 38 », la fiche dit « bordeaux » + « T38 » + « maille » → résultat vide sur un produit en stock.
- Le format saison professionnel reconnu tel quel (SS25, AW25, FW25) et le rapprochement taille confection / taille jean (JEAN_T38_W30).
- CTA : tester sur un catalogue prêt-à-porter via la démo en direct de la page solutions mode.

**Source :** heurix.fr/solutions/mode.html

---

## 4. Le badge de réduction automatique que personne ne configure

**Mot-clé / intention de recherche :** « afficher prix barré résultats recherche », « badge promotion moteur de recherche e-commerce » — recherche à intention plus technique/feature, probablement en phase de comparaison entre solutions.

**Secteur :** transversal (tous secteurs à catalogue avec soldes/promotions — mode, outillage, électronique en particulier)

**Pourquoi c'est une bonne opportunité SEO :** Angle identifié par vous comme non exploité — `compare_at_price` n'est mentionné que dans la documentation API technique, jamais sur une page marketing ni en blog. C'est une fonctionnalité « gratuite » (zéro configuration) que la plupart des visiteurs ignorent probablement avoir déjà à disposition — bon contenu de réactivation pour la base clients existante autant que pour le SEO.

**Plan (3-5 puces) :**
- Le constat : la plupart des moteurs de recherche e-commerce n'affichent pas le prix barré dans les résultats, seulement sur la fiche produit — un angle mort en période de soldes/opération commerciale.
- Comment ça marche chez Heurix : un champ `compare_at_price` supérieur à `price` suffit, le widget de démo affiche automatiquement le prix barré et le pourcentage de réduction — sans endpoint ni configuration dédiée.
- Exemple concret avec des chiffres (ex. prix 12,90 €, compare_at_price 19,90 € → badge « -35 % » calculé automatiquement).
- Lien avec l'opération commerciale : renvoyer vers l'article déjà publié « Préparer une opération commerciale côté recherche » comme prolongement naturel.
- CTA : vérifier si son flux d'indexation envoie déjà un champ de prix barré (Shopify, PrestaShop... l'ont souvent nativement) et comment le mapper.

**Source :** heurix.fr/docs.html (section Structure des produits)

---

## 5. Un catalogue, deux langues : comment interroger les deux en une seule recherche

**Mot-clé / intention de recherche :** « moteur de recherche site e-commerce multilingue », « recherche catalogue français anglais » — pertinent pour la cible Belgique/Suisse/Canada francophone, marchés structurellement bilingues.

**Secteur :** transversal, mais résonance particulière pour la cible Belgique/Suisse/Canada francophone explicitement visée par Heurix.

**Pourquoi c'est une bonne opportunité SEO :** Angle que vous avez identifié comme non exploité. Distinction technique jamais expliquée nulle part sur le site entre les 2 mécanismes disponibles — contenu à forte valeur ajoutée pour un segment de la cible (Belgique/Suisse/Canada) sous-adressé par le reste du blog, qui parle presque exclusivement au marché français.

**Plan (3-5 puces) :**
- Poser la question que se posent les e-commerçants bilingues : un seul catalogue avec un champ langue, ou un catalogue par langue ?
- Solution 1 : le filtre `lang` au sein d'un même catalogue — utile pour un catalogue majoritairement mono-langue avec quelques fiches bilingues, un produit sans le champ reste visible quelle que soit la langue demandée.
- Solution 2 : la recherche fédérée, un catalogue par langue, résultats fusionnés par pertinence en un seul appel, avec des scores comparables entre catalogues même si les packs de règles diffèrent.
- Comment choisir entre les deux selon sa structure (mêmes produits traduits vs. gammes réellement différentes par marché).
- CTA : lien vers la doc recherche fédérée et vers l'endpoint indexation multi-catalogues.

**Source :** heurix.fr/docs.html (Recherche, paramètre `lang` ; Recherche fédérée), heurix.fr/fonctionnalites.html (Multi-catalogues, Recherche fédérée)

---

## 6. « boulen M8 inpx » : ce que votre moteur a compris, et pourquoi il vous le montre

**Mot-clé / intention de recherche :** « comment fonctionne un moteur de recherche produit », « pourquoi mauvais résultats recherche e-commerce » — contenu plutôt haut de tunnel / crédibilité technique, utile aussi pour convaincre un profil développeur en phase d'évaluation.

**Secteur :** transversal, à dominante outillage/industrie pour l'exemple fil rouge (déjà utilisé sur la page fonctionnalités).

**Pourquoi c'est une bonne opportunité SEO :** Couvre deux angles que vous avez identifiés (cascade d'annotation, résultats explicables) en un seul article cohérent — l'un est le mécanisme d'entrée, l'autre la preuve en sortie. Différenciation à vérifier avant rédaction : l'article existant sur la recherche vectorielle explique pourquoi les embeddings échouent sur du technique, celui-ci explique positivement comment la cascade + le champ `matched` fonctionnent au quotidien comme outil de diagnostic — angle complémentaire, pas redondant, mais à confirmer en le rédigeant.

**Plan (3-5 puces) :**
- Repartir de l'exemple déjà utilisé sur fonctionnalites.html : la requête « boulen M8 inpx » → boulen→boulon (faute rattrapée), M8→diamètre reconnu, inpx→inox (faute rattrapée) → « Boulon TF M8 x 50 inox A4 » en tête, avec le raisonnement affiché.
- Expliquer la cascade en deux niveaux : niveau 1 reconnaît les motifs bruts (m8 → diamètre, 20 après un x → longueur), niveau 2 les compose (diamètre + longueur → référence complète) — documents et requêtes traversent la même cascade.
- Le champ `matched` en sortie : terme trouvé, faute corrigée, annotation partagée — l'outil de diagnostic quand un résultat surprend un e-commerçant.
- Le surlignage (`highlights`) comme prolongement visuel côté interface, avec la nuance : reflète ce que CETTE recherche a déclenché, jamais toutes les caractéristiques du produit.
- CTA : lien vers l'endpoint recherche et l'exemple de réponse complet.

**Source :** heurix.fr/fonctionnalites.html (Cascade d'annotations, Résultats explicables, section démo « ET VOUS SAVEZ POURQUOI »), heurix.fr/docs.html (Recherche, Surlignage des résultats)

---

## 7. Un produit en rupture ne devrait jamais passer devant un produit disponible

**Mot-clé / intention de recherche :** « trier résultats recherche par stock disponible », « afficher produits en stock en premier e-commerce » — intention orientée conversion/taux de rebond, probablement recherchée par un responsable e-commerce plutôt qu'un développeur.

**Secteur :** transversal, particulièrement outillage/industrie/électricité où la rupture de stock est fréquente et coûteuse en B2B (chantier en attente).

**Pourquoi c'est une bonne opportunité SEO :** Angle que vous avez identifié comme non exploité. Nuance à noter : l'article existant « Construire une page de catégorie avec Browse & Discovery » est un tutoriel technique de mise en œuvre (comment brancher l'endpoint) ; celui-ci est un article orienté business/conversion sur POURQUOI le tri par défaut compte — angle complémentaire distinct, dans la veine EBITDA/ROI déjà éprouvée par le blog plutôt que dans la veine tutoriel.

**Plan (3-5 puces) :**
- Le constat business : en B2B technique, un produit en rupture affiché en premier coûte une commande reportée chez un concurrent — pas juste un clic perdu.
- Le comportement par défaut chez Heurix à deux niveaux : sur la recherche, la disponibilité départage à pertinence égale ; sur Browse & Discovery, `sort=stock` est la valeur par défaut, pas une option à activer.
- Un produit sans champ stock renseigné n'est jamais exclu ni ne fait planter le tri — il part en fin de liste, comportement sûr par défaut à expliquer pour rassurer.
- Le nuancer avec le choix inverse assumé par certains catalogues : `in_stock_only` à false par défaut, certains sites affichent volontairement les ruptures pour signaler qu'un produit existe.
- CTA : vérifier quel champ stock son catalogue envoie aujourd'hui à son moteur de recherche actuel, et si le tri en tient seulement compte en théorie ou vraiment en pratique.

**Source :** heurix.fr/fonctionnalites.html (Tri pertinence puis stock, Classement configurable), heurix.fr/docs.html (Browse & Discovery, paramètre `sort`)

---

## 8. Un prix pour vos comptes pro, aucun pour vos visiteurs anonymes

**Mot-clé / intention de recherche :** « afficher prix différents selon client site b2b », « cacher prix site e-commerce sans compte » — intention très qualifiée B2B, probablement le meilleur signal d'achat de toute cette liste.

**Secteur :** transversal, mais parle directement au modèle de vente de la majorité des cibles Heurix (distributeurs avec prix catalogue public + prix nets par compte pro).

**Pourquoi c'est une bonne opportunité SEO :** Fonctionnalité non exploitée en contenu alors qu'elle touche un besoin quasi universel chez les distributeurs B2B (prix catalogue vs. prix négocié, ou aucun prix sans compte). Contenu à fort pouvoir de conversion : répond directement à une objection fréquente (« votre moteur peut-il gérer nos règles de prix ? ») sans jamais promettre une tarification individuelle que Heurix ne fait pas — cohérence à garder dans la rédaction.

**Plan (3-5 puces) :**
- Le cas fréquent chez un distributeur B2B : prix catalogue public affiché à tous, prix net réservé aux comptes pro connectés — voire aucun prix du tout pour un visiteur anonyme.
- Le mécanisme : une clé publique porte quel champ produit sert de prix (`price`, `price_pro`, ou un nom personnalisé), configurée une fois côté serveur — jamais un paramètre modifiable depuis le navigateur.
- Le masquage complet : `price_visible: false` retire tous les champs contenant price/prix/tarif, pas seulement `price` — éviter la fuite involontaire d'un `tarif_livraison` oublié.
- La limite à annoncer honnêtement : un jeu de prix par clé publique, donc par population de clients (anonymes / pro / grands comptes) — pas un tarif négocié par client individuel, qui demande un moteur de règles tarifaires distinct.
- CTA : lien vers l'endpoint pricing et vers la doc des deux types de clés (serveur vs. publique).

**Source :** heurix.fr/docs.html (section Prix par clé publique)

---

## 9. 6 582 résultats pour « vis M8 inox » : comment les ramener à 52 familles

**Mot-clé / intention de recherche :** « trop de résultats recherche produit », « regrouper résultats recherche catalogue technique » — pertinent pour un catalogue de grande taille (industrie, outillage, électronique).

**Secteur :** transversal, exemple fil rouge outillage/industrie (chiffres directement issus de la documentation).

**Pourquoi c'est une bonne opportunité SEO :** Angle non exploité et visuellement très parlant — l'exemple chiffré existe déjà dans la documentation technique (mesuré sur un catalogue réel de 10 000 références) mais n'a jamais été vulgarisé en article. Démontre concrètement la différenciation "comprend la structure, pas du texte plat" avec un chiffre choc facile à retenir et à partager.

**Plan (3-5 puces) :**
- Le problème très concret d'un gros catalogue technique : « vis M8 inox » renvoie 6 582 résultats sur un catalogue de 10 000 références, les premiers ne différant que par une longueur (M8×30, M8×80, M8×35...).
- La solution : `group_by=auto` regroupe ces résultats sur les étiquettes standards du pack (famille, matière, type de tête, coloris) — 6 582 résultats deviennent 52 familles classées par pertinence, chaque famille montrant un représentant et son nombre de produits.
- Le détail qui évite l'effet pervers : les dimensions (longueur, diamètre précis) sont volontairement exclues de la clé de famille — sinon une famille par produit, donc aucun regroupement utile.
- Le garde-fou côté widget : le regroupement ne se déclenche qu'au-delà d'un seuil configurable (`groupThreshold`), pour qu'une recherche de référence exacte continue de mener droit au produit, pas à un détour par une famille.
- CTA : lien vers l'endpoint recherche avec `group_by` et vers la configuration du widget JS.

**Source :** heurix.fr/docs.html (section Regrouper les résultats par famille)

---

## 10. « Vis inox moins de 5 € » : une contrainte de prix, pas une recherche de mots

**Mot-clé / intention de recherche :** « recherche en langage naturel e-commerce », « filtre de prix dans la barre de recherche » — angle différenciant, utile en comparatif face à des moteurs génériques.

**Secteur :** transversal — exemple particulièrement parlant pour l'outillage/quincaillerie, mais la reconnaissance fonctionne sur tout catalogue avec un champ prix.

**Pourquoi c'est une bonne opportunité SEO :** Fonctionnalité unique et non exploitée en contenu, avec un exemple prêt à l'emploi et un vrai différenciateur produit (reconnaissance en français, anglais, italien, espagnol, allemand et portugais) qui touche aussi à l'ambition Suisse/Canada francophone/Belgique. Facile à transformer en démo interactive ou GIF pour l'article.

**Plan (3-5 puces) :**
- Le problème : sans reconnaissance dédiée, une recherche « vis inox moins de 5 € » cherche littéralement les mots « moins » et « euros » dans le catalogue au lieu de filtrer sur le prix.
- Comment Heurix la reconnaît : la contrainte est détectée et convertie en filtre `price_filter`, le texte consommé est retiré de la requête de pertinence (« vis inox » seul pèse sur le score, pas la contrainte de prix).
- Les tournures couvertes, volontairement limitées et documentées plutôt qu'exhaustives : maximum (moins de, sous, jusqu'à, max), minimum (plus de, à partir de, min), intervalle (entre X et Y) — avec virgule décimale française acceptée.
- Le point de rigueur à mentionner : le moteur lit un nombre, jamais une devise — il ne convertit pas entre € et $ — et un produit sans champ de prix est exclu dès qu'une contrainte est active, plutôt que faussement inclus.
- CTA : lien vers la section documentation dédiée et suggestion d'affichage (chip retirable « < 5 € » côté interface, puisque `price_filter` n'apparaît que si une contrainte a été détectée).

**Source :** heurix.fr/docs.html (section Contraintes de prix en langage naturel)

---

## Point de vigilance signalé pour la Partie 2

En préparant les captures du guide de mise en route, j'ai relu **heurix.fr/blog/guide-mise-en-route.html** en entier (texte complet + recherche dans le HTML brut) : les deux mentions **« [Capture d'écran à ajouter] »** que vous décrivez n'apparaissent nulle part dans la version actuellement en ligne. Le texte confirme bien l'intitulé **« section Mes infos »** (« votre clé API... est immédiatement disponible dans votre console, section « Mes infos » », répété une seconde fois pour la clé publique : « Mes infos → Ma clé API »). Je vous signale l'écart avant de commencer les captures — soit les repères visuels sont ailleurs (version brouillon/CMS non publiée), soit ils ont déjà été retirés. Je peux tout de même prendre les deux captures prévues (clé API dans le compte, tableau de bord Vue d'ensemble une fois un catalogue indexé) et proposer où les insérer dans la structure actuelle de l'article, en m'appuyant sur les deux passages ci-dessus comme emplacements naturels.
