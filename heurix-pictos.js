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
    // --- électricité
    DISJONCTEUR: svg('<path d="M14 8h20v32H14z"/><path d="M24 14v8l-5 5h10l-5 5v8"/>'),
    CABLE: svg('<path d="M8 30c6-14 12 14 18 0s10-8 14-8"/>'),
    PRISE: svg('<circle cx="24" cy="24" r="15"/><circle cx="19" cy="21" r="2"/><circle cx="29" cy="21" r="2"/><path d="M20 30h8"/>'),
    ECLAIRAGE: svg('<path d="M24 8a11 11 0 00-6 20v4h12v-4a11 11 0 00-6-20z"/><path d="M20 38h8"/>'),
    // --- industrie
    ROULEMENT: svg('<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="6"/><circle cx="24" cy="12" r="2.5"/><circle cx="24" cy="36" r="2.5"/><circle cx="12" cy="24" r="2.5"/><circle cx="36" cy="24" r="2.5"/>'),
    COURROIE: svg('<circle cx="15" cy="24" r="8"/><circle cx="34" cy="24" r="5"/><path d="M15 16h19M15 32h19"/>'),
    JOINT: svg('<circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="9" stroke-dasharray="2 3"/>'),
    // --- électronique
    RESISTANCE: svg('<path d="M6 24h8l3-8 4 16 4-16 4 16 3-8h8"/>'),
    CONDENSATEUR: svg('<path d="M6 24h14M28 24h14"/><path d="M20 12v24M28 12v24"/>'),
    CONNECTEUR: svg('<path d="M10 16h16v16H10z"/><path d="M26 20h12M26 28h12"/><path d="M14 22h4M14 28h4"/>'),
    // --- automobile
    FREINAGE: svg('<circle cx="24" cy="24" r="14"/><circle cx="24" cy="24" r="5"/><path d="M34 14a14 14 0 013 8h-6z"/>'),
    FILTRATION: svg('<path d="M14 10h20l-3 28H17z"/><path d="M16 18h16M16 25h14M17 32h12"/>'),
    SUSPENSION: svg('<path d="M24 6v6"/><path d="M18 12h12"/><path d="M24 12c-6 3 6 6 0 9s6 6 0 9s6 6 0 9"/><path d="M18 42h12"/>'),
    // --- mode
    PULL: svg('<path d="M18 10h12l8 6-4 5-2-2v19H16V19l-2 2-4-5z"/>'),
    PANTALON: svg('<path d="M17 8h14v8l-2 24h-5l-2-16-2 16h-5l-2-24z"/>'),
    CHEMISE: svg('<path d="M19 9l5 4 5-4 8 5-3 5-2-1v20H16V18l-2 1-3-5z"/>'),
    // --- livres
    LIVRE: svg('<path d="M10 10h12a4 4 0 014 4v24a4 4 0 00-4-4H10z"/><path d="M38 10H26a4 4 0 00-4 4v24a4 4 0 014-4h12z"/>'),
    // --- vins
    VIN: svg('<path d="M18 8h12v10a6 6 0 01-12 0z"/><path d="M24 24v12"/><path d="M17 40h14"/>'),
    // --- repli
    DEFAUT: svg('<path d="M12 14h24v22H12z"/><path d="M12 22h24"/><path d="M18 29h6"/>'),
  };

  // Correspondance annotation -> pictogramme. L'ordre compte : la première
  // règle qui correspond gagne, donc les familles précises passent avant
  // les génériques.
  var REGLES = [
    ["FAM_VIS", "VIS"], ["FAM_BOULON", "BOULON"], ["FAM_ECROU", "ECROU"],
    ["FAM_RONDELLE", "RONDELLE"], ["FAM_GOUJON", "GOUJON"], ["FAM_CHEVILLE", "CHEVILLE"],
    ["FAM_RACCORD", "RACCORD"], ["FAM_TUBE", "TUBE"], ["FAM_VANNE", "VANNE"],
    ["FAM_DISJONCTEUR", "DISJONCTEUR"], ["FAM_DIFFERENTIEL", "DISJONCTEUR"],
    ["FAM_CABLE", "CABLE"], ["FAM_PRISE", "PRISE"], ["FAM_INTERRUPTEUR", "PRISE"],
    ["FAM_ECLAIRAGE", "ECLAIRAGE"],
    ["FAM_ROULEMENT", "ROULEMENT"], ["FAM_COURROIE", "COURROIE"], ["FAM_JOINT", "JOINT"],
    ["FAM_RESISTANCE", "RESISTANCE"], ["FAM_CONDENSATEUR", "CONDENSATEUR"],
    ["FAM_CONNECTEUR", "CONNECTEUR"],
    ["FAM_FREINAGE", "FREINAGE"], ["FAM_FILTRATION", "FILTRATION"],
    ["FAM_SUSPENSION", "SUSPENSION"],
    ["FAM_PULL", "PULL"], ["FAM_JEAN", "PANTALON"], ["FAM_CHEMISE", "CHEMISE"],
    ["FAM_ROMAN", "LIVRE"], ["FAM_POCHE", "LIVRE"],
    ["COULEUR_ROUGE", "VIN"], ["COULEUR_BLANC", "VIN"], ["COULEUR_ROSE", "VIN"],
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

  window.HeurixPictos = { pictogramme: pictogramme, tous: PICTOS };
})();
