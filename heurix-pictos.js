/* Pictogrammes de produits, choisis par ANNOTATION.
 *
 * POURQUOI DES PICTOGRAMMES ET NON DES PHOTOS. Il n'existe aucune banque
 * d'images libre pour la visserie, l'électricité ou la plomberie — ces
 * catalogues sont la propriété commerciale des distributeurs. Les
 * concurrents affichent donc des photos génériques : une vis grise pour
 * toutes les vis, ce qui n'apporte rien.
 *
 * Un pictogramme choisi par le moteur dit quelque chose de plus : il montre
 * que Heurix a RECONNU la famille du produit. C'est la démonstration
 * transformée en visuel — pas un habillage.
 *
 * LE CHOIX SE FAIT SUR LES ANNOTATIONS, pas sur le libellé. Un produit
 * nommé « Boulon TP M8X30 » mais annoté FAM_VIS recevra l'icône vis :
 * l'annotation est ce que le moteur a compris, et c'est ce qu'on illustre.
 *
 * Traits seulement, pas de remplissage : les pictogrammes prennent la
 * couleur du texte environnant et fonctionnent sur fond clair comme sombre.
 *
 * LA TABLE A ETE ECRITE DE MEMOIRE, ET SEPT DE SES CLEFS N'EXISTAIENT PAS
 * (mesure du 9 septembre 2026, heurix-engine dc631b5).
 *
 * `FAM_JEAN` reprenait le NOM DE LA REGLE du pack mode -- `FAMILLE_JEAN` --
 * alors que cette regle pose l'annotation `FAM_PANTALON`. Meme forme pour
 * `FAM_ROMAN` et `FAM_POCHE`, que le pack livres ecrit `GENRE_ROMAN` et
 * `FORMAT_POCHE` ; et `FAM_RESISTANCE`, `FAM_CONDENSATEUR`,
 * `FAM_CONNECTEUR`, `FAM_CASQUE` ne correspondaient a rien du tout.
 *
 * Consequences des deux cotes : six pictogrammes dessines etaient
 * inatteignables, et quinze annotations reellement emises tombaient sur
 * l'icone de repli : TOUTES les familles de `sport` et de `automobile`,
 * trois de `plomberie`, une de `electricite`, une de `mode`. Et trois des
 * onze verticales -- finance, livres, sport -- n'affichaient AUCUN
 * pictogramme.
 *
 * Rien ne le signalait. Un pictogramme faux ne leve pas, ne casse pas la
 * mise en page, et l'icone de repli ressemble a un choix.
 *
 * LA TABLE EST DESORMAIS DERIVEE DES PACKS, PAS DE LEUR SOUVENIR.
 * `tests/pictos-annotations.test.js` la croise avec l'inventaire complet des
 * annotations, verse dans `tests/fixtures/engine-contract.json` par le vrai
 * moteur. Une clef morte et un pictogramme inatteignable y sont nommes.
 *
 * QUATRE DESSINS ONT ETE SUPPRIMES plutot que rebranches : RESISTANCE,
 * CONDENSATEUR et CONNECTEUR supposaient un pack de COMPOSANTS, alors que
 * `electronique` couvre le high-tech grand public -- chargeurs, enceintes,
 * ecouteurs, cables ; CASQUE parce que `FAMILLE_ECOUTEURS` reconnait deja
 * « casque » et pose `FAM_ECOUTEURS`, donc aucune annotation ne distingue
 * les deux. Un dessin que rien ne peut selectionner est exactement ce qui a
 * fait naitre ce defaut ; le garde interdit d'en reintroduire un.
 */
(function () {
  "use strict";

  var T = 'stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

  function svg(contenu) {
    return '<svg viewBox="0 0 48 48" ' + T + ' aria-hidden="true">' + contenu + "</svg>";
  }

  // Chaque pictogramme est dessiné pour être reconnaissable à 40 px : peu de
  // traits, formes franches. Un dessin détaillé devient une tache à cette
  // taille.
  var PICTOS = {
    // --- visserie et boulonnerie
    VIS: svg('<path d="M20 6h8v6l-4 3-4-3z"/><path d="M24 15v22l-3-3 3-3-3-3 3-3-3-3 3-3-3-3"/>'),
    BOULON: svg('<path d="M17 9l7-4 7 4v8l-7 4-7-4z"/><path d="M24 21v20"/><path d="M20 27h8M20 32h8M20 37h8"/>'),
    ECROU: svg('<path d="M15 15l9-5 9 5v10l-9 5-9-5z"/><circle cx="24" cy="20" r="4.5"/>'),
    RONDELLE: svg('<circle cx="24" cy="24" r="13"/><circle cx="24" cy="24" r="5.5"/>'),
    GOUJON: svg('<path d="M24 7v34"/><path d="M20 11h8M20 16h8M20 21h8M20 27h8M20 32h8M20 37h8"/>'),
    CHEVILLE: svg('<path d="M18 9h12v20l-6 10-6-10z"/><path d="M18 15h12M18 21h12M18 27h12"/>'),
    // --- plomberie
    RACCORD: svg('<path d="M8 20h12v8H8z"/><path d="M28 20h12v8H28z"/><path d="M20 16h8v16h-8z"/>'),
    TUBE: svg('<path d="M6 18h36v12H6z"/><path d="M6 24h36" stroke-dasharray="3 3"/>'),
    VANNE: svg('<path d="M6 22h12v4H6zM30 22h12v4H30z"/><circle cx="24" cy="24" r="7"/><path d="M24 10v7"/><path d="M18 10h12"/>'),
    RADIATEUR: svg('<path d="M9 12h30v22H9z"/><path d="M17 12v22M24 12v22M31 12v22"/><path d="M13 34v6M35 34v6"/>'),
    SANITAIRE: svg('<path d="M8 24h32v2a12 12 0 01-12 12h-8A12 12 0 018 26z"/><path d="M24 24V14h6"/><path d="M30 14v4"/>'),
    SIPHON: svg('<path d="M12 9h24"/><path d="M18 9v17a6 6 0 0012 0v-8h12"/>'),
    // --- électricité
    DISJONCTEUR: svg('<path d="M14 8h20v32H14z"/><path d="M24 14v8l-5 5h10l-5 5v8"/>'),
    CABLE: svg('<path d="M8 30c6-14 12 14 18 0s10-8 14-8"/>'),
    PRISE: svg('<circle cx="24" cy="24" r="15"/><circle cx="19" cy="21" r="2"/><circle cx="29" cy="21" r="2"/><path d="M20 30h8"/>'),
    ECLAIRAGE: svg('<path d="M24 8a11 11 0 00-6 20v4h12v-4a11 11 0 00-6-20z"/><path d="M20 38h8"/>'),
    COFFRET: svg('<path d="M8 10h32v28H8z"/><path d="M8 20h32M8 30h32"/><path d="M14 12v6M20 12v6M26 12v6"/><path d="M14 22v6M20 22v6"/>'),
    // --- industrie
    ROULEMENT: svg('<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="6"/><circle cx="24" cy="12" r="2.5"/><circle cx="24" cy="36" r="2.5"/><circle cx="12" cy="24" r="2.5"/><circle cx="36" cy="24" r="2.5"/>'),
    COURROIE: svg('<circle cx="15" cy="24" r="8"/><circle cx="34" cy="24" r="5"/><path d="M15 16h19M15 32h19"/>'),
    JOINT: svg('<circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="9" stroke-dasharray="2 3"/>'),
    // --- automobile
    FREINAGE: svg('<circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="5"/><path d="M34 14a14 14 0 013 8h-6z"/>'),
    FILTRATION: svg('<path d="M14 10h20l-3 28H17z"/><path d="M16 18h16M16 25h14M17 32h12"/>'),
    SUSPENSION: svg('<path d="M24 6v6"/><path d="M18 12h12"/><path d="M24 12c-6 3 6 6 0 9s6 6 0 9s6 6 0 9"/><path d="M18 42h12"/>'),
    BOUGIE: svg('<path d="M21 6h6v6h-6z"/><path d="M19 12h10v10H19z"/><path d="M17 22h14l-2 6H19z"/><path d="M19 28h10v8H19z"/><path d="M19 31h10M19 34h10"/><path d="M24 36v5h4"/>'),
    EMBRAYAGE: svg('<circle cx="24" cy="24" r="15" stroke-dasharray="5 3"/><circle cx="24" cy="24" r="6"/><path d="M18 20l-4-4M30 20l4-4M18 28l-4 4M30 28l4 4"/>'),
    ECHAPPEMENT: svg('<path d="M8 19h20v10H8z"/><path d="M14 19v10M20 19v10"/><path d="M28 21h8v6h-8z"/><path d="M36 24h6"/>'),
    // --- mode
    PULL: svg('<path d="M18 10h12l8 6-4 5-2-2v19H16V19l-2 2-4-5z"/>'),
    PANTALON: svg('<path d="M17 8h14v8l-2 24h-5l-2-16-2 16h-5l-2-24z"/>'),
    CHEMISE: svg('<path d="M19 9l5 4 5-4 8 5-3 5-2-1v20H16V18l-2 1-3-5z"/>'),
    // --- sport
    PLANCHE: svg('<path d="M24 4c7 9 9 24 0 40-9-16-7-31 0-40z"/><path d="M24 11v20"/><path d="M25 30l7 7"/>'),
    AILE: svg('<path d="M24 6 41 24 24 42 7 24z"/><path d="M24 6v36M7 24h34"/>'),
    COMBINAISON: svg('<path d="M19 7h10l6 4-3 6-2-1v6l2 20h-6l-2-14-2 14h-6l2-20v-6l-2 1-3-6z"/>'),
    RAQUETTE: svg('<ellipse cx="24" cy="16" rx="10" ry="12"/><path d="M24 28v11"/><path d="M20 39h8v4h-8z"/><path d="M17 11h14M17 16h14M17 21h14"/><path d="M20 5v22M28 5v22"/>'),
    BALLON: svg('<circle cx="24" cy="24" r="15"/><path d="M24 15l7 5-3 8h-8l-3-8z"/><path d="M24 15V9M31 20l6-2M28 28l4 6M20 28l-4 6M17 20l-6-2"/>'),
    CHAUSSURE: svg('<path d="M9 31v-6c0-2 1-3 3-3h4l5-6 4 6 9 3c4 1 6 3 6 6z"/><path d="M8 31h32v5H8z"/><path d="M17 22l4-6"/>'),
    // --- électronique grand public
    CHARGEUR: svg('<path d="M18 6h12v8h-12z"/><path d="M22 14v6M26 14v6"/><path d="M14 20h20v18H14z"/><path d="M24 26v6l-3-2 3-2"/>'),
    ENCEINTE: svg('<path d="M14 8h20v32H14z"/><circle cx="24" cy="18" r="5"/><circle cx="24" cy="31" r="3"/>'),
    ECOUTEURS: svg('<path d="M10 26v-4a14 14 0 0128 0v4"/><path d="M8 26h6v10H8zM34 26h6v10h-6z"/>'),
    // --- livres
    LIVRE: svg('<path d="M10 10h12a4 4 0 014 4v24a4 4 0 00-4-4H10z"/><path d="M38 10H26a4 4 0 00-4 4v24a4 4 0 014-4h12z"/>'),
    // --- finance
    DOCUMENT: svg('<path d="M13 6h16l6 6v30H13z"/><path d="M29 6v6h6"/><path d="M18 20h12M18 26h12M18 32h8"/>'),
    // --- vins
    VIN: svg('<path d="M18 8h12v10a6 6 0 01-12 0z"/><path d="M24 24v12"/><path d="M17 40h14"/>'),
    // --- repli
    DEFAUT: svg('<path d="M12 14h24v22H12z"/><path d="M12 22h24"/><path d="M18 29h6"/>'),
  };

  // Correspondance annotation -> pictogramme, DANS LE VOCABULAIRE DES PACKS.
  //
  // Chaque clef ci-dessous est une annotation que `heurix-engine/rulepacks/`
  // emet reellement -- verifie par `tests/pictos-annotations.test.js` contre
  // l'inventaire complet capture dans `tests/fixtures/engine-contract.json`.
  //
  // DEUX FORMES DE CLEF, ET SEULEMENT DEUX. Soit une annotation ENTIERE
  // (`FAM_VIS`, `GENRE_ROMAN`), soit la TETE d'un gabarit -- `ISBN_` pour
  // `ISBN_{1}`, `MILLESIME_` pour `MILLESIME_{1}` -- parce que la valeur
  // capturee est justement ce qu'on ne connait pas d'avance.
  //
  // AUCUN AUTRE PREFIXE, et c'est le garde qui le tient. `pictogramme()`
  // compare par SOUS-CHAINE : une clef `GENRE_` prendrait `GENRE_MALE` et
  // `GENRE_FEMELLE`, qui sont des filetages du pack plomberie, et servirait
  // une icone de livre a un raccord. De meme `FORMAT_` prendrait
  // `FORMAT_75CL`, une bouteille. Le raccourci se voit court et sur.
  //
  // CETTE REGLE A UNE SECONDE RAISON, ET LA RETIRER FERAIT PERDRE LES DEUX.
  // Le moteur ecrit la valeur capturee au niveau 1 depuis le texte normalise,
  // donc EN MINUSCULES : « SKF » sur la fiche donne `MARQUE_skf` dans
  // `matched`, pas `MARQUE_SKF`. Et la casse n'est pas une affaire de niveau :
  // une regle de niveau 2 capture dans le flux des annotations et HERITE de
  // la casse de ce qu'elle lit -- `RACC_{1}` lit `FILET_(\w+)` et ecrit
  // `RACC_15x21`, avec le « x » du niveau 1. Une clef qui entrerait dans la
  // partie capturee dependrait donc de la casse que le moteur choisit, et la
  // table ne peut pas la lire de facon sure : l'inventaire publie ne porte
  // pas le niveau ; depuis heurix-engine 4c9ea02 son motif porte la casse
  // d'une capture de niveau 1 (`MARQUE_{1}` n'y accepte que `skf`, `fag`...)
  // mais pas celle qu'un niveau 2 herite (`RACC_{1}` y accepte les deux) ;
  // et la fixture du site, capturee contre aede7aa, ne porte ni l'un ni
  // l'autre. Une tete s'arrete AVANT la valeur capturee : sa correspondance
  // ne depend pas de la casse, par construction.
  //
  // Mesure du 11 septembre 2026, sur heurix-site 7385b5a9 : les verdicts du
  // garde -- dessins inatteignables, packs sans pictogramme, conflits de
  // sous-chaine -- rejoues avec quatre jeux de valeurs capturees, « 7 » et
  // « INOX », « 7 » seul, « 7 » et « inox », « inox » seul : 0 / 0 / 0 a
  // chaque fois. Douze modeles peuvent porter une minuscule dans leur valeur
  // capturee : onze de niveau 1, dont la capture admet une lettre (douze
  // regles, `CABLE_{1}` en a deux ; lu sur l'arbre de la regex et non a
  // l'oeil -- `\d` n'est pas une lettre), et `RACC_{1}` au niveau 2, par
  // heritage. Aucun n'est une famille -- aucun `FAM_` n'est un gabarit -- et
  // deux seulement touchent une clef, `IBAN_{1}` et `TVA_{1}`, toutes deux
  // par leur tete. Par le chemin de production -- indexer, chercher, lire
  // `matched` -- le corpus de test du moteur rend huit annotations en
  // minuscules a 4c9ea02 : aucune famille, aucune qui touche une clef.
  //
  // CE QUE CETTE IMMUNITE NE COUVRE PAS. Elle tient parce qu'aucun
  // pictogramme n'est atteint par un gabarit autrement que par sa tete. Le
  // garde refuse aujourd'hui une clef comme `MARQUE_SKF` ou `MARQUE_skf`
  // (ni annotation entiere, ni tete) ; si cette regle est un jour relachee
  // pour une clef qui porte une valeur capturee, la casse redevient un
  // probleme, et rien dans la fixture ne permettrait de le voir.
  //
  // ON NE COUVRE QUE LE NIVEAU 1. Une annotation de niveau 2 est composee de
  // celles du niveau 1, qui sont dans le meme `matched` : `POLAR_POCHE`
  // n'arrive jamais sans `GENRE_POLAR` ni `FORMAT_POCHE`. L'inscrire ici
  // serait une entree que rien ne peut atteindre la premiere -- verte au
  // garde, morte a l'usage.
  //
  // L'ORDRE COMPTE : la premiere clef trouvee gagne. Il porte donc les
  // recouvrements que les packs eux-memes documentent :
  //
  //   * sport : « Wing Foil Board 75L » sort FAM_AILE *et* FAM_PLANCHE. Le
  //     pack dit que c'est une planche de wing ; PLANCHE passe avant AILE.
  //   * mode : un sweat-shirt sort FAM_CHEMISE *et* FAM_PULL. PULL d'abord.
  //   * FAM_CABLE est pose par `electricite` ET par `electronique` : il
  //     passe apres les familles propres a chaque pack, sinon un « cable
  //     chargeur USB-C » recevrait le cable et non le chargeur.
  var REGLES = [
    // --- outillage
    ["FAM_VIS", "VIS"], ["FAM_BOULON", "BOULON"], ["FAM_ECROU", "ECROU"],
    ["FAM_RONDELLE", "RONDELLE"], ["FAM_GOUJON", "GOUJON"],
    ["FAM_CHEVILLE", "CHEVILLE"],
    // --- plomberie
    ["FAM_SANITAIRE", "SANITAIRE"], ["FAM_CHAUFFAGE", "RADIATEUR"],
    ["FAM_EVACUATION", "SIPHON"], ["FAM_VANNE", "VANNE"],
    ["FAM_RACCORD", "RACCORD"], ["FAM_TUBE", "TUBE"],
    // --- électricité
    ["FAM_DISJONCTEUR", "DISJONCTEUR"], ["FAM_DIFFERENTIEL", "DISJONCTEUR"],
    ["FAM_COFFRET", "COFFRET"], ["FAM_PRISE", "PRISE"],
    ["FAM_INTERRUPTEUR", "PRISE"], ["FAM_ECLAIRAGE", "ECLAIRAGE"],
    // --- industrie
    ["FAM_ROULEMENT", "ROULEMENT"], ["FAM_COURROIE", "COURROIE"],
    ["FAM_JOINT", "JOINT"],
    // --- électronique grand public
    ["FAM_CHARGEUR", "CHARGEUR"], ["FAM_ENCEINTE", "ENCEINTE"],
    ["FAM_ECOUTEURS", "ECOUTEURS"],
    // partagé par électricité et électronique — après les deux
    ["FAM_CABLE", "CABLE"],
    // --- automobile
    ["FAM_FREINAGE", "FREINAGE"], ["FAM_FILTRATION", "FILTRATION"],
    ["FAM_SUSPENSION", "SUSPENSION"], ["FAM_DISTRIBUTION", "COURROIE"],
    ["FAM_ALLUMAGE", "BOUGIE"], ["FAM_EMBRAYAGE", "EMBRAYAGE"],
    ["FAM_ECHAPPEMENT", "ECHAPPEMENT"],
    // --- mode
    ["FAM_PULL", "PULL"], ["FAM_CHEMISE", "CHEMISE"],
    ["FAM_PANTALON", "PANTALON"],
    // --- sport
    ["FAM_PLANCHE", "PLANCHE"], ["FAM_AILE", "AILE"],
    ["FAM_COMBINAISON", "COMBINAISON"], ["FAM_RAQUETTE", "RAQUETTE"],
    ["FAM_BALLON", "BALLON"], ["FAM_CHAUSSURE", "CHAUSSURE"],
    // --- livres : le pack ne pose aucun FAM_, la famille EST le genre
    ["GENRE_ROMAN", "LIVRE"], ["GENRE_POLAR", "LIVRE"], ["GENRE_SF", "LIVRE"],
    ["GENRE_FANTASY", "LIVRE"], ["GENRE_BD", "LIVRE"],
    ["GENRE_JEUNESSE", "LIVRE"], ["GENRE_ESSAI", "LIVRE"],
    ["GENRE_POESIE", "LIVRE"], ["GENRE_CLASSIQUE", "LIVRE"],
    ["FORMAT_POCHE", "LIVRE"], ["FORMAT_BROCHE", "LIVRE"],
    ["FORMAT_GF", "LIVRE"], ["FORMAT_ILLUSTRE", "LIVRE"],
    ["FORMAT_AUDIO", "LIVRE"], ["ED_ANNOTE", "LIVRE"],
    ["ED_BILINGUE", "LIVRE"], ["ED_COLLECTOR", "LIVRE"],
    ["LANG_FR", "LIVRE"], ["LANG_EN", "LIVRE"], ["ISBN_", "LIVRE"],
    // --- vins : pas de FAM_ non plus ; couleur, type, format, élevage
    ["COULEUR_ROUGE", "VIN"], ["COULEUR_BLANC", "VIN"], ["COULEUR_ROSE", "VIN"],
    ["TYPE_MOUSSEUX", "VIN"], ["TYPE_TRANQUILLE", "VIN"],
    ["FORMAT_75CL", "VIN"], ["FORMAT_37CL", "VIN"],
    ["FORMAT_MAGNUM", "VIN"], ["FORMAT_JEROBOAM", "VIN"],
    ["ELEVAGE_BIODYNAMIE", "VIN"], ["ELEVAGE_FUT_CHENE", "VIN"],
    ["ELEVAGE_BIO", "VIN"], ["MILLESIME_", "VIN"], ["DEGRE_", "VIN"],
    // --- finance : le pack annote des pièces comptables, pas des objets
    ["DOC_FACTURE", "DOCUMENT"], ["DOC_DEVIS", "DOCUMENT"],
    ["DOC_COMMANDE", "DOCUMENT"], ["IBAN_", "DOCUMENT"],
    ["SIREN_", "DOCUMENT"], ["SIRET_", "DOCUMENT"], ["TVA_", "DOCUMENT"],
  ];

  /**
   * Choisit un pictogramme d'après les annotations d'un résultat.
   *
   * `matched` contient des chaînes de la forme « annotation #FAM_VIS ».
   * On accepte aussi une liste d'étiquettes nues, pour les appels groupés.
   */
  function pictogramme(annotations) {
    var texte = (annotations || []).join(" ");
    for (var i = 0; i < REGLES.length; i++) {
      if (texte.indexOf(REGLES[i][0]) !== -1) {
        return PICTOS[REGLES[i][1]];
      }
    }
    return PICTOS.DEFAUT;
  }

  // `regles` est expose pour `tests/pictos-annotations.test.js`, qui croise
  // les clefs avec l'inventaire des annotations du moteur. Un garde qui
  // relirait ce fichier a la regex serait vert le jour ou la regex casse ;
  // celui-ci lit la table que la page utilise vraiment.
  window.HeurixPictos = {
    pictogramme: pictogramme,
    tous: PICTOS,
    regles: REGLES,
  };
})();
