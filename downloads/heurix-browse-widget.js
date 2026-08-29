/*
 * Heurix Browse Widget — appelle /v1/browse et affiche les résultats
 * dans une page de catégorie de votre site, sans recherche.
 *
 * Volontairement minimal : ce script ne fournit AUCUN style visuel imposé
 * — chaque site a sa propre charte, sa propre grille de produits. Il
 * s'occupe de l'appel API et de la boucle d'affichage ; vous fournissez
 * le rendu HTML de chaque produit (renderItem) et votre CSS habituel.
 *
 * Langue de l'interface : "fr" ou "en". Par défaut, l'attribut lang de la
 * page ; à défaut d'attribut, le français. L'option `lang` l'emporte sur
 * les deux.
 *
 *     Heurix.browse({ ..., lang: "en" });
 *
 * Documentation complète et exemple pas à pas :
 * https://heurix.fr/blog/guide-page-categorie-browse.html
 */
(function () {
  // Chantier securite C1 : garde-fou a l'execution. Une cle serveur (hx_)
  // dans le navigateur est lisible par n'importe quel visiteur, et ouvre
  // l'indexation, le merchandising et le portail de facturation Stripe.
  // Seule une cle publique (hxp_) a une portee limitee a la lecture.
  function heurixWarnIfServerKey(k) {
    if (typeof k === "string" && k.indexOf("hxp_") !== 0 && k.indexOf("hx_") === 0) {
      var msg = "[Heurix] ATTENTION : vous utilisez une cle SERVEUR (hx_) cote navigateur. " +
        "Elle est lisible par tous vos visiteurs et donne acces a votre facturation. " +
        "Generez une cle publique (hxp_) depuis votre console Heurix : Mes infos > Cles API.";
      if (typeof console !== "undefined" && console.warn) console.warn(msg);
    }
  }

  // LANGUE (27 aout 2026) -- meme mecanique que heurix-search.js, et
  // volontairement recopiee plutot que partagee : ces fichiers sont
  // telecharges un par un et heberges chez le marchand, donc chacun doit
  // tenir seul. C'est deja le cas de heurixWarnIfServerKey ci-dessus.
  //
  // Ordre : options.lang > attribut lang du document > FRANCAIS. Le repli
  // francais preserve le comportement des installations existantes : une
  // page sans attribut lang affiche ce qu'elle affichait avant.
  function resoudreLangue(explicite) {
    var v = explicite ||
      (typeof document !== "undefined" && document.documentElement &&
       document.documentElement.lang) || "";
    return String(v).toLowerCase().slice(0, 2) === "en" ? "en" : "fr";
  }

  // Repris tel quel de heurix-search.js -- meme fonction, pas une
  // variante. Elle echappe & < > et le guillemet DOUBLE, et
  // volontairement PAS l'apostrophe : c'est pourquoi tout attribut
  // portant une donnee est double-quote ci-dessous, comme dans l'autre
  // widget. Un esc() qui protege un attribut simple-quote serait une
  // seconde fonction a maintenir, avec deux regles d'echappement a ne
  // jamais confondre.
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Meme borne que heurix-search.js, et recopiee pour la meme raison que
  // esc() et resoudreLangue() : ce fichier s'heberge seul chez le
  // marchand. Le francais ecrit « 0 resultat » au singulier, l'anglais
  // « 0 results » au pluriel -- les deux bornes ne different qu'a zero,
  // et ici zero est ATTEIGNABLE (un rayon vide, un filtre qui ne rend
  // rien), contrairement au widget de recherche ou elle etait exacte mais
  // inatteignable.
  function estPluriel(n, lang) {
    return lang === "en" ? n !== 1 : n > 1;
  }

  // Espace fine insecable tous les trois chiffres. « 1 987 references »
  // se lit, « 1987 references » se compte. Number.toLocaleString ferait
  // le travail mais depend de l'ICU embarquee du navigateur, qui varie ;
  // le separateur est donc pose a la main, comme partout ailleurs sur ce
  // site.
  function fmtNombre(n, lang) {
    var s = String(n);
    var sep = lang === "en" ? "," : "\u202F";
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }

  // Les valeurs de facette viennent du catalogue du marchand : « 3/8" BSP »
  // et « L'Oreal » sont des valeurs plausibles, et toutes deux cassent un
  // selecteur d'attribut. CSS.escape n'existe pas partout ou ce fichier
  // tourne ; on echappe donc le guillemet double et l'antislash, les deux
  // seuls caracteres qui peuvent terminer [value="..."].
  function echapperSelecteur(v) {
    return String(v).replace(/["\\]/g, "\\$&");
  }

  var TEXTES = {
    fr: {
      vide: "<p>Aucun produit dans cette catégorie.</p>",
      rupture: "Rupture de stock",
      chargement: "Chargement…",
      indispo: "Rayon indisponible pour le moment.",
      rayonVide: "Aucun produit dans ce rayon.",
      reference: " référence",
      references: " références",
      pagination: "Pagination des résultats",
      precedent: "Précédent",
      suivant: "Suivant",
      page: "Page ",
      pageSur: "Page {0} sur {1}",
      allerPage: "Aller à la page ",
      sautPages: "Pages omises",
      filtres: "Filtres",
      vider: "Effacer les filtres",
      sans: "{0} sans {1}",
      choixAria: "{0}, {1} produits",
      choixAriaUn: "{0}, 1 produit",
    },
    en: {
      vide: "<p>No products in this category.</p>",
      rupture: "Out of stock",
      chargement: "Loading…",
      indispo: "This category is unavailable right now.",
      rayonVide: "No products in this category.",
      reference: " reference",
      references: " references",
      pagination: "Results pagination",
      precedent: "Previous",
      suivant: "Next",
      page: "Page ",
      pageSur: "Page {0} of {1}",
      allerPage: "Go to page ",
      sautPages: "Skipped pages",
      filtres: "Filters",
      vider: "Clear filters",
      sans: "{0} without {1}",
      choixAria: "{0}, {1} products",
      choixAriaUn: "{0}, 1 product",
    },
  };

  // Le prix arrivait BRUT : "12.5 €" pour un produit a 12,50 €, point
  // decimal et centime manquant compris. heurix-search.js formatait deja ;
  // ce fichier ne le faisait pas du tout. Meme convention que lui :
  // "12,50 €" en francais, "€12.50" en anglais, centimes nuls coupes.
  // La DEVISE reste l'euro en dur -- l'API n'en renvoie aucun code.
  function fmtPrix(v, lang) {
    var n = Number(v).toFixed(2);
    return lang === "en"
      ? "€" + n.replace(/\.00$/, "")
      : n.replace(".", ",").replace(/,00$/, "") + " €";
  }

  var HEURIX_API_KEY = "hxp_VOTRE_CLE_PUBLIQUE"; // Cle PUBLIQUE (hxp_), jamais une cle serveur
  var HEURIX_CATALOG = "votre-catalogue";   // Le nom exact de votre catalogue indexé

  // `lang` est le 3e argument depuis le 27 aout. Il REMPLACE le tableau
  // que Array.prototype.map fournissait a cette position : l'appel passe
  // desormais par une fonction explicite (voir plus bas), sans quoi
  // defaultRenderItem aurait recu data.hits comme langue. Un renderItem
  // fourni par le marchand recevait ce tableau et ne s'en servait pas ;
  // il recoit maintenant "fr" ou "en", et l'ignore de la meme facon s'il
  // n'en veut pas.
  function defaultRenderItem(hit, i, lang) {
    var T = TEXTES[lang === "en" ? "en" : "fr"];
    var p = hit.product;
    var price = p.price !== undefined
      ? '<div class="heurix-price">' + fmtPrix(p.price, lang) + "</div>" : "";
    // DEUX SURFACES, DEUX PROTECTIONS (27 aout 2026). Ce fichier
    // n'echappait rien : les noms et identifiants du catalogue partaient
    // dans innerHTML tels quels. La donnee vient de l'indexation du
    // marchand, donc quiconque peut y deposer un produit pouvait executer
    // du script chez ses visiteurs -- du XSS stocke, dans un fichier
    // installe chez le client.
    //
    //  - p.name atterrit dans du TEXTE : esc() suffit, il neutralise < et >.
    //  - p.id atterrit dans un ATTRIBUT, et l'attribut passe de simple a
    //    DOUBLE quote. En simple quote, une apostrophe dans l'identifiant
    //    fermait l'attribut et ouvrait la porte a un onerror= ; esc()
    //    n'echappe pas l'apostrophe et ne l'aurait pas vu.
    return '<div class="heurix-product" data-id="' + esc(p.id) + '">' +
      '<div class="heurix-name">' + esc(p.name || p.id) + "</div>" + price +
      (hit.in_stock ? "" : '<div class="heurix-out-of-stock">' + T.rupture + "</div>") +
      "</div>";
  }

  // Construit l'URL à partir des options — filters/facets optionnels.
  function buildUrl(options) {
    var url = "https://api.heurix.fr/v1/browse/" + encodeURIComponent(options.catalog || HEURIX_CATALOG) +
      "/" + encodeURIComponent(options.category);
    var params = [];
    params.push("sort=" + encodeURIComponent(options.sort || "stock"));
    if (options.limit) params.push("limit=" + encodeURIComponent(options.limit));
    if (options.offset) params.push("offset=" + encodeURIComponent(options.offset));
    if (options.filters) {
      // options.filters : {brand: "Makita", color: "rouge"} -> "brand:Makita,color:rouge"
      var pairs = [];
      for (var field in options.filters) pairs.push(field + ":" + options.filters[field]);
      if (pairs.length) params.push("filters=" + encodeURIComponent(pairs.join(",")));
    }
    if (options.facets) params.push("facets=" + encodeURIComponent(options.facets.join(",")));
    return url + "?" + params.join("&");
  }

  // Heurix.browse({catalog, category, sort, filters, facets, limit, offset,
  //                containerId, renderItem}) -> Promise résolue avec la
  // réponse brute de l'API (utile même sans containerId, pour bâtir votre
  // propre affichage entièrement à la main).
  window.Heurix = window.Heurix || {};
  window.Heurix.browse = function (options) {
    options = options || {};
    var lang = resoudreLangue(options.lang);
    var apiKey = options.apiKey || HEURIX_API_KEY;
    heurixWarnIfServerKey(apiKey);
    return fetch(buildUrl(options), {
      headers: { "Authorization": "Bearer " + apiKey }
    }).then(function (res) {
      return res.json();
    }).then(function (data) {
      if (options.containerId) {
        var container = document.getElementById(options.containerId);
        if (container) {
          var renderItem = options.renderItem || defaultRenderItem;
          if (!data.hits || !data.hits.length) {
            // options.emptyMessage garde la main : c'est une option deja
            // publiee, et un marchand qui l'a posee a choisi son texte.
            container.innerHTML = options.emptyMessage || TEXTES[lang].vide;
          } else {
            container.innerHTML = data.hits.map(function (h, i) {
              return renderItem(h, i, lang);
            }).join("");
          }
        }
      }
      return data;
    });
  };

  /* ===========================================================================
   * Heurix.browsePanel — LE WIDGET DE RAYON
   *
   * POURQUOI UN SECOND POINT D'ENTREE PLUTOT QU'UNE OPTION DE Heurix.browse.
   * C'est la contrainte qui a decide de la forme de ce fichier, et elle merite
   * d'etre lue avant d'y toucher.
   *
   * `Heurix.browse` est INSTALLE CHEZ DES MARCHANDS. Il s'heberge sur leur
   * serveur, ne se met pas a jour, et une regression chez eux ne nous revient
   * jamais -- ni sentinelle, ni journal, juste une page de categorie qui
   * s'affiche mal chez quelqu'un qui ne fera pas le lien avec nous.
   *
   * Le reflexe etait de declencher l'UI sur la presence de `containerId`. Le
   * guide du blog l'interdit, mot pour mot : « chaque produit s'affiche dans un
   * <div class="heurix-product"> simple, a styler avec VOTRE PROPRE CSS », et
   * c'est le marchand qui fournit le conteneur. Il a donc pu ecrire
   * `#ma-page-categorie { display: grid }` -- auquel cas tout enfant direct
   * devient une cellule, et une barre de pagination ajoutee en frere atterrit
   * dans sa grille. `containerId` ne discrimine pas : un marchand a tres bien
   * pu le passer en voulant exactement la liste nue.
   *
   * D'ou un point d'entree distinct. `Heurix.browse` ne change pas d'une ligne,
   * et tests/heurix-browse-contrat.test.js l'y tient -- 35 tests de
   * caracterisation, dont un bloc entier sur ce que ce chemin n'ecrit PAS
   * (aucune feuille de style, aucune classe sur le conteneur, aucun frere aux
   * fiches, aucun ecouteur global, un seul appel reseau).
   *
   * COROLLAIRE POUR LE CSS CI-DESSOUS : toute regle est prefixee `.hx-rayon`.
   * Une page qui charge ce fichier et appelle SEULEMENT `Heurix.browse` ne doit
   * voir aucun de ses styles s'appliquer -- or `injectStyles` pose une balise
   * <style> globale. Le prefixe est ce qui rend ce cloisonnement vrai.
   * =========================================================================== */

  var RAYON_STYLE_POSE = false;
  var RAYON_LIMITE_DEFAUT = 24;
  var RAYON_LIMITE_API = 100; // plafond du moteur (browse.py : min(max(limit,1),100))

  function rayonInjecterStyles(accent) {
    if (RAYON_STYLE_POSE) return;
    RAYON_STYLE_POSE = true;
    var css = [
      ".hx-rayon{--hx-accent:" + (accent || "#2952E3") + ";font-family:system-ui,-apple-system,'Segoe UI',sans-serif;}",
      // Le compte. #4A4D63 sur blanc = 8,6:1, au-dessus de AA. Mesure sur le
      // fond BLANC : ce widget se pose chez le marchand, dont on ne connait
      // pas la charte -- d'ou aucun fond impose ici, et un gris choisi assez
      // sombre pour tenir sur tout fond clair. Sur fond sombre, le marchand
      // surcharge .hx-rayon-compte, et c'est documente.
      ".hx-rayon-compte{margin:0 0 14px;font-size:14px;color:#4A4D63;}",
      ".hx-rayon-compte:focus{outline:2px solid var(--hx-accent);outline-offset:3px;}",
      ".hx-rayon-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;}",
      ".hx-rayon .heurix-product{border:1px solid #D6D9E4;border-radius:10px;padding:13px 14px;background:#fff;display:flex;flex-direction:column;gap:5px;}",
      ".hx-rayon .heurix-name{font-size:14px;font-weight:600;color:#181A2E;line-height:1.35;}",
      ".hx-rayon .heurix-price{font-size:15px;font-weight:800;color:var(--hx-accent);}",
      // #B3261E sur blanc = 5,9:1. Le rouge « rupture » de heurix-search.js
      // (#C0392B) ne rend que 4,4:1 -- sous les 4,5 de AA pour du texte
      // normal. Verifie plutot que recopie.
      ".hx-rayon .heurix-out-of-stock{font-size:12.5px;font-weight:600;color:#B3261E;}",
      ".hx-rayon-etat{padding:26px 14px;font-size:14px;color:#4A4D63;text-align:center;}",
      // Pagination
      ".hx-rayon-pagination{margin-top:20px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;justify-content:center;}",
      ".hx-rayon-pagination ol{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:0;padding:0;}",
      ".hx-rayon-pg{min-width:38px;height:38px;padding:0 10px;font:inherit;font-size:13.5px;border:1px solid #D6D9E4;border-radius:8px;background:#fff;color:#3A3D52;cursor:pointer;}",
      ".hx-rayon-pg:hover:not([disabled]):not([aria-current]){background:#F6F7FC;border-color:var(--hx-accent);}",
      // Le focus visible est OBLIGATOIRE et il est pose ici explicitement :
      // sans outline, une pagination reste utilisable a la souris et perdue
      // au clavier. 3 px pour rester visible sur le bouton courant, qui est
      // deja colore.
      ".hx-rayon-pg:focus-visible{outline:3px solid var(--hx-accent);outline-offset:2px;}",
      // #6E7183 = 4,82:1 sur blanc, et non #8A8DA0 (3,28:1) qui etait le
      // premier choix. WCAG 1.4.3 EXEMPTE les composants desactives de
      // toute exigence de contraste ; la regle du lot est « AA sur tout ce
      // qui porte du texte », sans exemption, et un bouton dont on ne peut
      // pas lire le libelle ne se comprend pas comme desactive -- il se
      // lit comme absent. Il reste deux fois plus clair que le bouton
      // actif (10,66:1), donc l'etat reste visible d'un coup d'oeil.
      //
      // `opacity:1` est explicite : le defaut des navigateurs sur un
      // bouton desactive compose une couleur SANS EN DECLARER UNE, et un
      // rapport ne se mesure alors plus sur ce qui est ecrit ici.
      ".hx-rayon-pg[disabled]{opacity:1;color:#6E7183;border-color:#E6E8F0;cursor:default;}",
      ".hx-rayon-pg[aria-current]{background:var(--hx-accent);border-color:var(--hx-accent);color:#fff;font-weight:700;}",
      // Meme gris que l'etat desactive, meme raison : aria-hidden retire le
      // saut aux lecteurs d'ecran, pas aux yeux.
      ".hx-rayon-saut{min-width:20px;text-align:center;color:#6E7183;font-size:13.5px;align-self:center;}",
      // Rail de facettes. En colonne a gauche au-dessus de 720 px, empile
      // au-dessus de la grille en dessous -- pas de rail lateral de 240 px
      // sur un telephone de 390.
      ".hx-rayon-corps{display:block;}",
      "@media (min-width:721px){.hx-rayon-corps{display:grid;grid-template-columns:220px 1fr;gap:22px;align-items:start;}}",
      ".hx-rayon-rail{margin:0 0 18px;}",
      // Le rail se replie SOUS 721 px. Dix-huit cases empilees au-dessus de
      // la grille, c'est 700 px de filtres avant le premier produit sur un
      // telephone : le rayon n'y montre plus de marchandise. <details> le
      // fait nativement -- Tab l'atteint, Entree et Espace l'ouvrent, et un
      // lecteur d'ecran annonce l'etat plie/deplie sans une ligne de JS.
      ".hx-rayon-repli{border:0;}",
      ".hx-rayon-repli > summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:600;color:#3A3D52;padding:8px 14px;border:1px solid #D6D9E4;border-radius:100px;margin-bottom:12px;}",
      ".hx-rayon-repli > summary::-webkit-details-marker{display:none;}",
      ".hx-rayon-repli > summary::after{content:'▾';font-size:11px;}",
      ".hx-rayon-repli[open] > summary::after{content:'▴';}",
      ".hx-rayon-repli > summary:focus-visible{outline:3px solid var(--hx-accent);outline-offset:2px;}",
      // Au-dessus de 720 px le rail est toujours deplie : le resume ne sert
      // plus a rien et disparait.
      "@media (min-width:721px){.hx-rayon-repli > summary{display:none;}}",
      "@media (min-width:721px){.hx-rayon-rail{margin:0;}}",
      ".hx-rayon-groupe{border:0;padding:0;margin:0 0 16px;}",
      ".hx-rayon-groupe legend{padding:0;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#4A4D63;margin-bottom:7px;}",
      ".hx-rayon-choix{display:flex;align-items:baseline;gap:8px;padding:3px 0;font-size:13.5px;color:#3A3D52;cursor:pointer;}",
      ".hx-rayon-choix input{margin:0;flex-shrink:0;accent-color:var(--hx-accent);cursor:pointer;}",
      // Le focus se dessine sur le LABEL, pas sur la case : la case native
      // fait 13 px et son contour est difficile a voir. :focus-within
      // deplace l'indicateur sur toute la ligne, qui porte le texte.
      ".hx-rayon-choix:focus-within{outline:3px solid var(--hx-accent);outline-offset:2px;border-radius:4px;}",
      ".hx-rayon-choix-n{color:#6E7183;font-size:12.5px;}",
      // « 239 sans norme » : derive, jamais cliquable, et visiblement
      // distinct des choix qui, eux, se cochent.
      ".hx-rayon-sans{margin:5px 0 0;font-size:12.5px;color:#6E7183;font-style:italic;}",
      ".hx-rayon-vider{margin:0 0 14px;font:inherit;font-size:13px;padding:6px 12px;border:1px solid #D6D9E4;border-radius:100px;background:#fff;color:#3A3D52;cursor:pointer;}",
      ".hx-rayon-vider:hover{border-color:var(--hx-accent);}",
      ".hx-rayon-vider:focus-visible{outline:3px solid var(--hx-accent);outline-offset:2px;}",
      "@media (max-width:420px){.hx-rayon-grille{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;}}",
    ].join("\n");
    var el = document.createElement("style");
    el.setAttribute("data-heurix-rayon", "1");
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* Fenetre de pagination : premiere, derniere, courante et ses voisines.
   * Rend un tableau de numeros de page et de nulls (les nulls sont les sauts).
   * Sortie pure, testable sans DOM -- c'est la seule logique de ce widget qui
   * merite d'etre verifiee independamment du rendu.
   */
  function rayonFenetrePages(courante, total) {
    if (total <= 7) {
      var toutes = [];
      for (var i = 1; i <= total; i++) toutes.push(i);
      return toutes;
    }
    var pages = [1];
    var debut = Math.max(2, courante - 1);
    var fin = Math.min(total - 1, courante + 1);
    // Garde une largeur constante aux extremites, sinon la barre change de
    // taille quand on navigue et les boutons se deplacent sous le curseur.
    if (courante <= 3) fin = 4;
    if (courante >= total - 2) debut = total - 3;
    if (debut > 2) pages.push(null);
    for (var p = debut; p <= fin; p++) pages.push(p);
    if (fin < total - 1) pages.push(null);
    pages.push(total);
    return pages;
  }

  function browsePanel(config) {
    config = config || {};
    // Memes exigences que Heurix.searchBox, et volontairement PAS celles de
    // Heurix.browse : celui-ci tolere tout et retombe sur les constantes du
    // fichier, comportement conserve pour les installations existantes mais
    // qui a deja servi « Catalogue indisponible » en vitrine le 26 aout. Un
    // point d'entree neuf n'a aucune raison de reconduire ce defaut.
    if (!config.apiKey) throw new Error("Heurix.browsePanel: 'apiKey' est requis.");
    heurixWarnIfServerKey(config.apiKey);
    if (!config.catalog) throw new Error("Heurix.browsePanel: 'catalog' est requis.");
    if (!config.category) throw new Error("Heurix.browsePanel: 'category' est requis.");
    if (!config.containerId) throw new Error("Heurix.browsePanel: 'containerId' est requis.");
    var conteneur = document.getElementById(config.containerId);
    if (!conteneur) throw new Error("Heurix.browsePanel: aucun element avec id='" + config.containerId + "'.");

    var lang = resoudreLangue(config.lang);
    var T = TEXTES[lang];
    var base = (config.baseUrl || "https://api.heurix.fr").replace(/\/+$/, "");
    var parPage = Math.min(config.limit || RAYON_LIMITE_DEFAUT, RAYON_LIMITE_API);
    var rendreFiche = config.renderItem || defaultRenderItem;
    var page = 1;
    var totalPages = 1;
    var requeteEnCours = 0;
    var detruit = false;
    var champsFacettes = config.facets || [];
    var filtresActifs = {};   // { champ: [valeur, ...] }
    var ouSupporte = true;    // jusqu'a preuve du contraire -- voir detecterOuAbsent
    var focusARendre = null;  // selecteur de l'element a refocaliser apres redessin
    // Deplie d'emblee sur grand ecran, replie sur telephone. matchMedia
    // n'est lu QU'UNE FOIS, a la construction : ensuite c'est le visiteur
    // qui decide, et un changement d'orientation ne doit pas defaire son
    // choix.
    var railDeplie = !(window.matchMedia && window.matchMedia("(max-width:720px)").matches);

    rayonInjecterStyles(config.accentColor);

    // Ids derives de containerId, comme heurix-search.js : plusieurs rayons
    // peuvent coexister sur une page (« vous aimerez aussi »), et
    // aria-controls a besoin d'ids qui ne collisionnent pas.
    var idb = String(config.containerId);
    conteneur.classList.add("hx-rayon");
    conteneur.innerHTML =
      '<p class="hx-rayon-compte" id="' + esc(idb) + '-compte" tabindex="-1" role="status" aria-live="polite">' +
        esc(T.chargement) + "</p>" +
      '<div class="hx-rayon-corps">' +
        '<div class="hx-rayon-rail" id="' + esc(idb) + '-rail"></div>' +
        '<div>' +
          '<div class="hx-rayon-grille" id="' + esc(idb) + '-grille"></div>' +
          '<nav class="hx-rayon-pagination" id="' + esc(idb) + '-pagination" aria-label="' + esc(T.pagination) + '" hidden></nav>' +
        "</div>" +
      "</div>";

    var elCompte = conteneur.querySelector(".hx-rayon-compte");
    var elRail = conteneur.querySelector(".hx-rayon-rail");
    var elGrille = conteneur.querySelector(".hx-rayon-grille");
    var elPagination = conteneur.querySelector(".hx-rayon-pagination");

    /* Serialise les filtres actifs.
     *
     * OU dans un champ (tuyau), ET entre les champs (virgule) -- la
     * grammaire du moteur depuis le 29 aout 2026.
     *
     * TANT QUE LE TUYAU N'EST PAS DEPLOYE, `ouSupporte` est faux et on
     * n'envoie qu'UNE valeur par champ : c'est le repli, decrit plus bas.
     */
    function serialiserFiltres() {
      var paires = [];
      champsFacettes.forEach(function (champ) {
        var vals = filtresActifs[champ];
        if (!vals || !vals.length) return;
        paires.push(champ + ":" + (ouSupporte ? vals.join("|") : vals[0]));
      });
      return paires.join(",");
    }

    function urlPage(n) {
      var u = base + "/v1/browse/" + encodeURIComponent(config.catalog) +
              "/" + encodeURIComponent(config.category);
      var p = ["limit=" + parPage, "offset=" + (n - 1) * parPage];
      if (config.sort) p.push("sort=" + encodeURIComponent(config.sort));
      if (config.inStockOnly) p.push("in_stock_only=true");
      if (champsFacettes.length) p.push("facets=" + encodeURIComponent(champsFacettes.join(",")));
      var f = serialiserFiltres();
      if (f) p.push("filters=" + encodeURIComponent(f));
      return u + "?" + p.join("&");
    }

    function etat(texte) {
      elGrille.innerHTML = '<div class="hx-rayon-etat">' + esc(texte) + "</div>";
      elPagination.hidden = true;
    }

    function rendrePagination(focusApres) {
      if (totalPages <= 1) {
        elPagination.hidden = true;
        elPagination.innerHTML = "";
        return;
      }
      elPagination.hidden = false;
      var h = '<button type="button" class="hx-rayon-pg" data-nav="prec" data-page="' + (page - 1) + '"' +
        (page === 1 ? " disabled" : "") + ">" + esc(T.precedent) + "</button><ol>";
      rayonFenetrePages(page, totalPages).forEach(function (n) {
        if (n === null) {
          // aria-hidden : le saut est une indication VISUELLE. Annonce, il
          // ferait dire « points de suspension » entre deux numeros de page
          // sans rien apporter.
          h += '<li class="hx-rayon-saut" aria-hidden="true">…</li>';
          return;
        }
        h += "<li><button type=\"button\" class=\"hx-rayon-pg\" data-page=\"" + n + "\"" +
          (n === page ? ' aria-current="page"' : "") +
          ' aria-label="' + esc(T.allerPage + n) + '">' + n + "</button></li>";
      });
      h += '</ol><button type="button" class="hx-rayon-pg" data-nav="suiv" data-page="' + (page + 1) + '"' +
        (page === totalPages ? " disabled" : "") + ">" + esc(T.suivant) + "</button>";
      elPagination.innerHTML = h;

      // FOCUS APRES CHANGEMENT DE PAGE. Sans ceci, cliquer « Suivant » sur
      // l'avant-derniere page detruit le bouton focalise puis le recree
      // desactive : le focus retombe sur <body>, et un utilisateur au clavier
      // repart du haut du document. On rend donc le focus au meme role de
      // bouton s'il est encore actionnable, sinon au compte -- qui porte
      // tabindex="-1" pour pouvoir le recevoir, et qui est justement ce qu'on
      // veut faire lire apres un changement de page.
      if (focusApres) {
        var cible = null;
        // On rend le focus au MEME bouton s'il est encore actionnable : le
        // geste « suivant, suivant, suivant » doit rester possible sans
        // rechercher la cible apres chaque redessin.
        if (focusApres.nav) cible = elPagination.querySelector('[data-nav="' + focusApres.nav + '"]:not([disabled])');
        // Sinon -- bouton devenu desactive en bout de course, ou clic sur un
        // numero, qui glisse hors de la fenetre -- on se replie sur le
        // numero de la page courante, qui existe toujours. Le compte n'est
        // qu'un dernier recours ; il porte tabindex="-1" pour cela.
        if (!cible) cible = elPagination.querySelector('[aria-current="page"]');
        if (cible) cible.focus(); else elCompte.focus();
      }
    }

    /* LE RAIL DE FACETTES.
     *
     * IL NE CONNAIT AUCUNE LISTE. Il dessine `data.facets` et rien d'autre :
     * si l'API rend trois familles pour la visserie -- ce qu'elle fait, le
     * rayon ne contenant que Vis, Ecrou et Rondelle sur les huit du
     * catalogue -- le rail montre trois cases. Cinq cases mortes venues
     * d'un referentiel seraient indiscernables d'un defaut de decompte,
     * et personne ne saurait laquelle croire.
     *
     * D'ou l'absence deliberee de toute constante de valeurs dans ce
     * fichier, et un test qui la verifie (heurix-rayon-facettes.test.js,
     * premier bloc, ecrit AVANT ce code).
     */
    function rendreRail(data) {
      if (!champsFacettes.length) return;
      var facettes = data.facets || {};
      var h = "";
      var actifs = 0;
      champsFacettes.forEach(function (champ) {
        var valeurs = facettes[champ];
        if (!valeurs) return;                   // l'API ne connait pas ce champ
        var noms = Object.keys(valeurs);
        if (!noms.length) return;
        var choisies = filtresActifs[champ] || [];
        actifs += choisies.length;
        h += '<fieldset class="hx-rayon-groupe"><legend>' + esc(etiquetteChamp(champ)) + "</legend>";
        noms.forEach(function (v) {
          var n = valeurs[v];
          var coche = choisies.indexOf(v) !== -1;
          // Le decompte est DANS le libelle accessible, pas seulement a
          // cote : « inox A4, 479 produits » se lit d'un bloc, la ou un
          // nombre orphelin apres la case s'annonce detache de ce qu'il
          // compte.
          var aria = (n === 1 ? T.choixAriaUn.replace("{0}", v)
                              : T.choixAria.replace("{0}", v).replace("{1}", n));
          h += '<label class="hx-rayon-choix">' +
            '<input type="checkbox" data-champ="' + esc(champ) + '" value="' + esc(v) + '"' +
            (coche ? " checked" : "") + ' aria-label="' + esc(aria) + '">' +
            "<span>" + esc(v) + ' <span class="hx-rayon-choix-n">(' + n + ")</span></span>" +
            "</label>";
        });
        h += sansValeurHtml(champ, valeurs, data);
        h += "</fieldset>";
      });
      if (actifs) {
        h = '<button type="button" class="hx-rayon-vider">' + esc(T.vider) + "</button>" + h;
      }
      if (!h) { elRail.innerHTML = ""; return; }
      // `railDeplie` porte l'etat CHOISI par le visiteur et survit au
      // redessin : sans lui, cocher une case replierait le rail sous le
      // doigt de qui vient de l'ouvrir -- meme classe de defaut que le
      // focus perdu, une intention detruite par un rendu.
      elRail.innerHTML = '<details class="hx-rayon-repli"' + (railDeplie ? " open" : "") + ">" +
        "<summary>" + esc(T.filtres) + (actifs ? " (" + actifs + ")" : "") + "</summary>" +
        h + "</details>";
    }

    // Le nom du champ vient du catalogue du marchand (« famille »,
    // « matiere ») : on ne le TRADUIT pas -- inventer « material » pour un
    // champ nomme « matiere » ferait diverger l'ecran de l'API. On se
    // contente de la majuscule initiale, qui est de la typographie. Le
    // marchand qui veut un libelle a lui passe `facetLabels`.
    function etiquetteChamp(champ) {
      var perso = config.facetLabels && config.facetLabels[champ];
      if (perso) return perso;
      return champ.charAt(0).toUpperCase() + champ.slice(1);
    }

    /* « 239 sans norme » — DERIVE A L'AFFICHAGE, JAMAIS STOCKE.
     *
     * Le nombre se recalcule a chaque rendu depuis les deux valeurs de LA
     * REPONSE COURANTE : si l'API change ses decomptes, la soustraction
     * suit sans qu'on ait a l'invalider.
     *
     * IL N'EST VALIDE QUE SI AUCUN FILTRE N'EST ACTIF SUR CE CHAMP, et ce
     * n'est pas une precaution : c'est une identite, mesuree sur l'API le
     * 29 aout 2026. Les decomptes d'un champ sont calcules en IGNORANT les
     * filtres de ce champ (exclude_field, cote moteur) mais en appliquant
     * ceux des autres. Donc :
     *
     *   sans filtre               total=1987  somme=1748  ->  239   juste
     *   filtre sur un AUTRE champ total= 338  somme= 298  ->    40   juste
     *   filtre sur norme          total= 220  somme=1748  -> -1528   absurde
     *
     * Dans le troisieme cas `total` est reduit par le filtre de norme que
     * la somme ignore : les deux nombres ne portent plus sur le meme
     * ensemble. On ne l'affiche donc pas -- et la question n'a d'ailleurs
     * plus de sens une fois qu'on a choisi des normes.
     *
     * Jamais cliquable : l'API n'a aucun filtre « champ absent », et une
     * case qui promettrait un filtre inexistant serait pire que rien.
     *
     * LES DEUX GARDES CI-DESSOUS SONT REDONDANTS, et il faut le savoir
     * plutot que de croire chacun indispensable -- verifie par mutation le
     * 29 aout : retirer le premier ne fait tomber aucun test.
     *
     * Demonstration : quand F est filtre, tout produit satisfaisant TOUS
     * les filtres porte necessairement une valeur de F, donc l'ensemble du
     * total est inclus dans celui que la somme compte, donc total <= somme
     * et `manquants <= 0` attrape deja le cas.
     *
     * Le premier est neanmoins conserve : il enonce la PRECONDITION reelle
     * (« ce nombre n'a de sens que si le champ n'est pas filtre »), quand
     * le second n'en est qu'une consequence arithmetique. Si le moteur
     * changeait sa facon de compter, c'est le premier qui resterait juste.
     */
    function sansValeurHtml(champ, valeurs, data) {
      if ((filtresActifs[champ] || []).length) return "";
      var somme = 0;
      for (var v in valeurs) somme += valeurs[v];
      var total = data.total || 0;
      // somme > total arrive sur un champ a VALEURS MULTIPLES (un produit
      // compte dans deux valeurs) : la soustraction n'y veut rien dire.
      var manquants = total - somme;
      if (manquants <= 0) return "";
      return '<p class="hx-rayon-sans">' +
        esc(T.sans.replace("{0}", fmtNombre(manquants, lang)).replace("{1}", etiquetteChamp(champ).toLowerCase())) +
        "</p>";
    }

    /* DETECTION DU MOTEUR SANS TUYAU, PAR CONTRADICTION.
     *
     * POURQUOI CE N'EST PAS UNE HEURISTIQUE. Sur un moteur qui comprend le
     * tuyau, cette situation est STRUCTURELLEMENT IMPOSSIBLE, pas
     * seulement improbable :
     *
     *   Le decompte d'une valeur v du champ F est calcule sur l'ensemble
     *   des produits de la categorie qui satisfont tous les filtres SAUF
     *   ceux de F (exclude_field). Le total, lui, est calcule avec TOUS les
     *   filtres, dont celui de F qui est un OU sur les valeurs cochees.
     *   L'ensemble compte par `compte(v)` est donc INCLUS dans celui du
     *   total des que v est cochee. D'ou total >= compte(v) pour toute
     *   valeur cochee -- et total == 0 force compte(v) == 0 pour toutes.
     *
     *   Voir un compte strictement positif sur une valeur cochee ALORS QUE
     *   le total est nul demontre donc que le serveur n'a pas applique le
     *   OU. Il a lu « A|B » comme une valeur litterale, qui ne correspond a
     *   aucun produit.
     *
     * MESURE, sur les deux moteurs, 50 combinaisons chacun (2 et 3 valeurs
     * sur famille/matiere/norme, plus un cas multi-champs) :
     *   moteur avec le tuyau  : declenchee   0 / 50
     *   moteur sans le tuyau  : declenchee  50 / 50
     *
     * Le repli coute UNE requete, une seule fois par instance, et
     * uniquement sur un moteur ancien : tant qu'une seule valeur est cochee
     * par champ, les deux moteurs repondent a l'identique et rien ne se
     * declenche.
     */
    function detecterOuAbsent(data) {
      if (!ouSupporte) return false;
      if (data.total !== 0) return false;              // la contradiction exige un total nul
      var facettes = data.facets || {};
      var trouve = false;
      champsFacettes.forEach(function (champ) {
        var choisies = filtresActifs[champ] || [];
        if (choisies.length < 2) return;               // un seul choix : aucun tuyau envoye
        var comptes = facettes[champ] || {};
        choisies.forEach(function (v) { if ((comptes[v] || 0) > 0) trouve = true; });
      });
      return trouve;
    }

    function rendre(data, focusApres) {
      var hits = data.hits || [];
      var total = data.total || 0;
      totalPages = Math.max(1, Math.ceil(total / parPage));

      if (!hits.length) {
        elCompte.textContent = "0" + (estPluriel(0, lang) ? T.references : T.reference);
        etat(T.rayonVide);
        // Le rail reste dessine sur un resultat vide : sans lui, un
        // visiteur qui a trop filtre n'a plus aucun moyen de DEFAIRE son
        // filtre -- l'ecran vide emporterait les cases avec les resultats.
        rendreRail(data);
        rendreFocus();
        return;
      }
      // Le compte annonce le TOTAL de la categorie, pas la taille de la page :
      // c'est l'information que le visiteur cherche (« combien de references
      // dans ce rayon »), et c'est aussi ce qu'annonce l'aria-live.
      elCompte.textContent = fmtNombre(total, lang) +
        (estPluriel(total, lang) ? T.references : T.reference) +
        (totalPages > 1 ? " — " + T.pageSur.replace("{0}", page).replace("{1}", totalPages) : "");
      elGrille.innerHTML = hits.map(function (h, i) {
        return rendreFiche(h, i, lang);
      }).join("");
      rendreRail(data);
      rendrePagination(focusApres);
      rendreFocus();
    }

    /* LE FOCUS APRES UN REDESSIN DU RAIL.
     *
     * Cocher une case redessine le rail entier -- les decomptes des AUTRES
     * champs changent, il n'y a pas de mise a jour partielle possible. La
     * case qu'on vient de cocher est donc detruite, et le focus retombe sur
     * <body> : au clavier, on repart du haut du document apres chaque
     * filtre. C'est le meme defaut que celui corrige sur la pagination a
     * l'etape 1, sous une autre forme.
     *
     * On retient donc quoi refocaliser AVANT la requete, et on le rend
     * apres redessin. Si la case a disparu -- le filtre l'a fait tomber a
     * zero, l'API ne la renvoie plus -- on se replie sur le compte, qui
     * porte tabindex="-1" et qui est justement ce qu'il faut faire lire.
     */
    function rendreFocus() {
      if (!focusARendre) return;
      var sel = focusARendre;
      focusARendre = null;
      var cible = conteneur.querySelector(sel);
      if (cible) cible.focus(); else elCompte.focus();
    }

    function charger(n, focusApres) {
      if (detruit) return;
      page = n;
      var id = ++requeteEnCours;
      // Pas d'etat « chargement » qui vide la grille a chaque page : sur une
      // connexion normale la reponse arrive en moins de 200 ms, et vider la
      // grille ferait sauter la mise en page. Seul le compte l'annonce.
      if (elGrille.innerHTML === "") etat(T.chargement);
      return fetch(urlPage(n), { headers: { Authorization: "Bearer " + config.apiKey } })
        .then(function (r) {
          // CONTROLE DE res.ok, contrairement a Heurix.browse. Sans lui, une
          // 403 de cle invalide rend un corps JSON d'erreur, `hits` est
          // absent, et le visiteur lit « Aucun produit dans ce rayon » -- un
          // catalogue casse deguise en rayon vide. Le defaut est verrouille
          // tel quel sur l'ancien chemin ; il n'est pas reconduit ici.
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (data) {
          if (detruit || id !== requeteEnCours) return; // une page plus recente est partie
          if (detecterOuAbsent(data)) {
            // Le serveur n'applique pas le OU. On bascule en choix unique
            // par champ, DEFINITIVEMENT pour cette instance -- inutile de
            // repayer une requete a chaque coche -- et on relance avec la
            // derniere valeur cochee de chaque champ.
            ouSupporte = false;
            champsFacettes.forEach(function (champ) {
              var v = filtresActifs[champ];
              if (v && v.length > 1) filtresActifs[champ] = [v[v.length - 1]];
            });
            charger(1, focusApres);
            return;
          }
          rendre(data, focusApres);
        })
        .catch(function (e) {
          if (detruit || id !== requeteEnCours) return;
          elCompte.textContent = T.indispo;
          etat(T.indispo);
          if (typeof console !== "undefined" && console.error) console.error("[Heurix] browsePanel:", e.message);
        });
    }

    elPagination.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-page]") : null;
      if (!b || b.disabled) return;
      var n = parseInt(b.getAttribute("data-page"), 10);
      if (!n || n < 1 || n > totalPages || n === page) return;
      // On retient CE QUI etait focalise pour le rendre apres redessin.
      charger(n, { nav: b.getAttribute("data-nav") });
    });

    elRail.addEventListener("change", function (e) {
      var c = e.target;
      if (!c || c.type !== "checkbox") return;
      var champ = c.getAttribute("data-champ");
      var val = c.value;
      var liste = filtresActifs[champ] || (filtresActifs[champ] = []);
      var i = liste.indexOf(val);
      if (c.checked) {
        if (i === -1) {
          // CHOIX UNIQUE tant que le moteur ne sait pas lire le tuyau :
          // envoyer deux valeurs rendrait zero resultat pendant que les
          // decomptes affichent des positifs. On remplace plutot que
          // d'ajouter, et l'ecran reste coherent avec lui-meme.
          if (!ouSupporte) liste.length = 0;
          liste.push(val);
        }
      } else if (i !== -1) {
        liste.splice(i, 1);
      }
      // Filtrer change l'ensemble : la page 3 d'avant n'a aucun sens apres,
      // on repart de la premiere.
      focusARendre = 'input[data-champ="' + echapperSelecteur(champ) +
                     '"][value="' + echapperSelecteur(val) + '"]';
      charger(1);
    });

    elRail.addEventListener("toggle", function (e) {
      if (e.target && e.target.classList.contains("hx-rayon-repli")) railDeplie = e.target.open;
    }, true);   // `toggle` ne remonte pas : on ecoute a la capture

    elRail.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".hx-rayon-vider") : null;
      if (!b) return;
      filtresActifs = {};
      // Le bouton lui-meme disparait avec le dernier filtre : le focus irait
      // sur <body>. On le rend au compte, qui annonce le nouveau total.
      focusARendre = ".hx-rayon-compte";
      charger(1);
    });

    charger(1);

    return {
      // Aller a une page par programme -- utile pour brancher un etat d'URL
      // cote marchand (?page=3) sans que le widget impose sa propre
      // convention de parametre.
      goToPage: function (n) { return charger(Math.min(Math.max(1, n | 0), totalPages)); },
      getState: function () {
        var f = {};
        for (var k in filtresActifs) if (filtresActifs[k].length) f[k] = filtresActifs[k].slice();
        return { page: page, totalPages: totalPages, perPage: parPage,
                 filters: f, multiSelect: ouSupporte };
      },
      destroy: function () {
        detruit = true;
        conteneur.innerHTML = "";
        conteneur.classList.remove("hx-rayon");
      },
    };
  }

  window.Heurix.browsePanel = browsePanel;

})();
