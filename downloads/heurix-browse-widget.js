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
        "Generez une cle publique (hxp_) depuis votre console Heurix : Mon compte > Cle API.";
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

  /* ==========================================================================
   * LES QUATRE GARDES DE PANNE (6 septembre 2026).
   *
   * Portes depuis downloads/heurix-search.js du meme jour, lui-meme porte du
   * module PrestaShop. Le corollaire de CLAUDE.md les a amenes ici : « quand
   * un defaut est trouve dans un fichier de downloads/, la question suivante
   * est qui d'autre ecrit ce motif ? ». Ce fichier ecrivait le meme : aucun
   * delai d'attente, aucune lecture du code HTTP, aucun coupe-circuit, aucun
   * repli.
   *
   * MESURE QUI A DECIDE LE CAS : demo/index.html servi depuis localhost. La
   * cle publique de la boutique est restreinte a heurix.fr, donc l'API rend
   * 403 « Origine non autorisee » -- et la console ne portait que
   * « HTTP 403 », pendant que la barre de recherche corrigee nommait le
   * domaine ET l'endroit ou l'autoriser.
   *
   * Les trois responsabilites restent SEPAREES, comme dans l'autre widget :
   * un emetteur de classification (pur, seul a lire un code HTTP), un armeur
   * de coupe-circuit (qui ne recoit jamais de code), un lecteur. C'est ce qui
   * rend le 429-en-pause-de-60-s inexprimable plutot qu'interdit par
   * convention -- defaut corrige au chantier I1, 5 aout 2026.
   * ========================================================================== */

  // DELAI D'ATTENTE, ET IL DIVERGE DE heurix-search.js : 5 s ici, 3 s la-bas.
  // Verifie plutot que recopie, comme le rouge de rupture plus bas.
  //
  // MESURE DU 6 SEPTEMBRE 2026, 30 appels sur l'API de production, vrai
  // catalogue, 24 produits et 4 facettes par appel : min 0,175 s /
  // mediane 0,20 s / max 2,105 s, deux appels au-dela de 1,4 s. Chacun paie
  // une poignee de main TLS neuve qu'un navigateur reutilise, donc ces
  // chiffres majorent ce qu'un visiteur observe -- et c'est le bon sens
  // d'erreur pour choisir une borne.
  //
  // Les 3 000 ms de la recherche (max mesure la-bas : 0,814 s sur 12 appels)
  // ne laisseraient ici que 1,4 fois la pire latence observee. Et le prix
  // d'un declenchement a tort n'est pas le meme : une recherche repart a la
  // frappe suivante, un rayon coupe a tort perd toute sa marchandise ET arme
  // une pause de 60 s. D'ou la marge plus large. Reglable par `timeoutMs`.
  var RAYON_TIMEOUT_MS = 5000;

  // PAUSE DU COUPE-CIRCUIT, alimentee UNIQUEMENT par les pannes transitoires
  // -- voir creerCoupeCircuit, qui ne recoit jamais un code HTTP.
  var RAYON_PAUSE_MS = 60000;

  /* 1. L'EMETTEUR DE LA CLASSIFICATION.
   *
   * Fonction PURE et synchrone : aucun minuteur, aucun etat, aucun DOM. Elle
   * est le seul endroit du fichier ou un code HTTP se lit, et elle rend un
   * objet que l'armeur consomme sans jamais revoir le code. Une seule
   * question la gouverne : « est-ce que soixante secondes reparent ca ? »
   *
   * RECOPIEE DE heurix-search.js PLUTOT QUE PARTAGEE, pour la raison qui vaut
   * deja pour esc(), resoudreLangue() et estPluriel() : ces fichiers se
   * telechargent un par un et s'hebergent chez le marchand, donc chacun tient
   * seul. Les deux noms d'option qu'elle cite -- `apiKey` et `catalog` --
   * sont les memes ici, donc les messages restent justes sans retouche.
   *
   * LE CAS QUE LA TABLE PHP NE PEUT PAS CONTENIR est aussi le plus probable
   * ici : une clef publique est liee a une liste de domaines, et une clef
   * SERVEUR n'envoie pas d'en-tete Origin. Mesure du 6 septembre 2026 contre
   * l'API de production, sans Origin :
   *
   *   HTTP 403  {"detail":"Origine 'absente' non autorisée pour cette clé
   *              publique. Domaines autorisés : heurix.fr, www.heurix.fr."}
   *
   * @param statut  code HTTP, ou 0 quand aucune reponse n'est parvenue
   * @param erreur  exception de fetch, le cas echeant
   * @param detail  champ `detail` du corps JSON d'erreur, ou null
   */
  function classerEchec(statut, erreur, detail) {
    if (erreur && erreur.name === "HeurixReponseIllisible") {
      // 200 mais illisible -> transitoire. Une reponse malformee signale un
      // probleme cote Heurix, pas une mauvaise configuration cote marchand.
      return { code: "illisible", transitoire: true,
               marchand: "reponse illisible (HTTP 200 mais corps non-JSON)" };
    }
    if (erreur && erreur.name === "AbortError") {
      return { code: "timeout", transitoire: true,
               marchand: "delai depasse -- l'API n'a pas repondu a temps" };
    }
    if (erreur) {
      // Panne reseau. Le navigateur ne distingue pas un DNS mort d'un refus
      // CORS : les deux arrivent en TypeError sans statut. On ne pretend
      // donc pas savoir laquelle, on dit ce qu'on a.
      return { code: "reseau", transitoire: true,
               marchand: "appel reseau echoue (" + (erreur.message || erreur) + ")" };
    }
    if (statut === 401) {
      return { code: "cle-absente", transitoire: false,
               marchand: "HTTP 401 -- en-tete Authorization absent ou malforme. " +
                         "Verifiez la valeur passee a `apiKey`." };
    }
    if (statut === 403) {
      // 403 recouvre DEUX causes de remedes opposes, et seul le corps les
      // separe. On lit `detail` plutot que de deviner ; a defaut de corps
      // lisible, on nomme les deux hypotheses au lieu d'en choisir une.
      var origine = detail && /origine|origin/i.test(detail);
      return {
        code: origine ? "origine" : "cle-refusee",
        transitoire: false,
        marchand: origine
          ? "HTTP 403 -- le domaine de cette page n'est pas autorise pour cette " +
            "cle publique. Ajoutez-le dans votre console Heurix : " +
            "Mon compte > Cle API. Reponse du serveur : " + detail
          : "HTTP 403 -- cle publique rejetee." +
            (detail ? " Reponse du serveur : " + detail : ""),
      };
    }
    if (statut === 404) {
      return { code: "catalogue", transitoire: false,
               marchand: "HTTP 404 -- catalogue ou categorie introuvable. Verifiez " +
                         "les valeurs passees a `catalog` et `category`." +
                         (detail ? " Reponse du serveur : " + detail : "") };
    }
    if (statut === 429) {
      // NON TRANSITOIRE, et c'est une revision assumee (chantier I1, 5 aout
      // 2026, module PrestaShop puis plugin WooCommerce). Un quota epuise
      // dure jusqu'a la fin de la periode de facturation : une pause de 60 s
      // ne protege rien, et masque le signal que le marchand doit voir.
      return { code: "quota", transitoire: false,
               marchand: "HTTP 429 -- quota depasse. Verifiez votre plan." };
    }
    // Tout autre hors-2xx, 5xx en tete -> transitoire.
    return { code: "http", transitoire: true,
             marchand: "HTTP " + statut + " -- reponse inattendue de l'API." };
  }

  /* 2. L'ARMEUR DU COUPE-CIRCUIT.
   *
   * Il ne recoit QUE l'objet rendu par classerEchec, et ne lit que son champ
   * `transitoire`. Il n'a acces a aucun code HTTP, donc il ne peut pas se
   * remettre a mettre le 429 en pause meme si quelqu'un le voulait.
   *
   * PORTEE : LA MEMOIRE DE LA PAGE, ET RIEN D'AUTRE. Decision du 6 septembre
   * 2026, reconduite ici. Une closure suffit tant que la page vit, et la
   * pause meurt a la navigation. Le cout est borne a un delai d'attente par
   * page ; le gain est que ce fichier continue de n'ecrire STRICTEMENT RIEN
   * chez le visiteur -- ni sessionStorage, ni cookie. Aucune question de
   * consentement, et aucun changement d'empreinte pour un script deja
   * installe chez des marchands.
   */
  function creerCoupeCircuit(pauseMs) {
    var ouvertJusqua = 0;
    return {
      armer: function (classification) {
        if (classification && classification.transitoire) {
          ouvertJusqua = Date.now() + pauseMs;
        }
      },
      estOuvert: function () { return Date.now() < ouvertJusqua; },
      // Un succes efface toute trace, comme signaler_succes() cote
      // WooCommerce. « Reessayer » l'appelle aussi : un geste explicite du
      // visiteur prime sur la pause, qui n'existe que pour lui epargner une
      // attente qu'il vient de demander.
      reinitialiser: function () { ouvertJusqua = 0; },
    };
  }

  /* DEUX PUBLICS, DEUX CANAUX.
   *
   * C'est la separation que le module PrestaShop obtient gratuitement
   * (PrestaShopLogger d'un cote, la page de l'autre) et qu'il faut poser
   * explicitement dans un navigateur, ou les deux publics regardent le meme
   * ecran. Le visiteur lit un message generique et rien d'autre ; le detail
   * actionnable part en console, la ou le marchand le trouvera.
   *
   * Panne = avertissement, configuration = erreur. Une erreur de
   * configuration ne se repare pas toute seule, elle merite le niveau
   * au-dessus.
   */
  function journaliserPourLeMarchand(quoi, classification) {
    if (typeof console === "undefined") return;
    var msg = "[Heurix] " + quoi + " -- " + classification.marchand;
    if (classification.transitoire) {
      if (console.warn) console.warn(msg);
    } else if (console.error) {
      console.error(msg);
    }
  }

  var TEXTES = {
    fr: {
      vide: "<p>Aucun produit dans cette catégorie.</p>",
      rupture: "Rupture de stock",
      chargement: "Chargement…",
      // LE VISITEUR NE LIT JAMAIS LE DIAGNOSTIC DU MARCHAND. `indispo` reste
      // le seul texte qu'il voit, quelle que soit la cause -- une clef
      // rejetee ou un domaine non autorise ne sont pas de son ressort, et
      // nommer la panne ne lui donnerait aucun geste utile. Le detail part
      // dans la console (voir journaliserPourLeMarchand).
      indispo: "Rayon indisponible pour le moment.",
      reessayer: "Réessayer",
      continuerSur: "Voir cette catégorie sur le site",
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
      trier: "Trier par",
      tris: {
        stock: "Disponibilité", recent: "Nouveautés", alphabetical: "Nom (A-Z)",
        price_asc: "Prix croissant", price_desc: "Prix décroissant",
        margin: "Marge", popular: "Popularité",
      },
      epingle: "Mis en avant",
      relegue: "En fin de rayon",
      epingleAria: "Mis en avant par le marchand",
      relegueAria: "Placé en fin de rayon par le marchand",
      ordreForce: "Certains produits sont placés par le marchand, indépendamment du tri.",
    },
    en: {
      vide: "<p>No products in this category.</p>",
      rupture: "Out of stock",
      chargement: "Loading…",
      indispo: "This category is unavailable right now.",
      reessayer: "Try again",
      continuerSur: "View this category on the site",
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
      trier: "Sort by",
      tris: {
        stock: "Availability", recent: "New arrivals", alphabetical: "Name (A-Z)",
        price_asc: "Price, low to high", price_desc: "Price, high to low",
        margin: "Margin", popular: "Popularity",
      },
      epingle: "Featured",
      relegue: "End of aisle",
      epingleAria: "Featured by the merchant",
      relegueAria: "Placed at the end of the aisle by the merchant",
      ordreForce: "Some products are placed by the merchant, regardless of sorting.",
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
    /* CE CHEMIN NE RECOIT QUE LE DIAGNOSTIC, ET C'EST UNE DECISION, PAS UN
     * OUBLI (6 septembre 2026).
     *
     * `Heurix.browse` est verrouille par 35 tests de caracterisation
     * (tests/heurix-browse-contrat.test.js), dont deux qui figent des DEFAUTS
     * connus -- `res.ok` non verifie en tete. Ils sont figes « parce qu'un
     * client peut en dependre », et ce fichier s'heberge chez le marchand
     * sans jamais se mettre a jour.
     *
     * Ce qu'il gagne ici est donc strictement ADDITIF : la classification
     * part en console, et rien d'autre ne bouge -- meme valeur resolue, meme
     * DOM, meme nombre d'appels, meme rejet. Un 403 « origine » y nomme
     * desormais le domaine et l'endroit ou l'autoriser, la ou la console ne
     * portait rien du tout.
     *
     * CE QU'IL NE GAGNE PAS, ET POURQUOI. Pas de delai d'attente : une
     * promesse qui pend deviendrait une promesse qui REJETTE, et un marchand
     * qui a ecrit `.then(rendre)` sans `.catch` passerait d'une page qui ne
     * se remplit pas a une erreur non rattrapee -- possiblement une alerte
     * chez lui. Pas de coupe-circuit ni de repli non plus : ce chemin
     * n'ecrit aucun etat d'erreur dans la page (le bloc « ce qui n'est PAS
     * ecrit » du contrat), il n'a donc nulle part ou poser un geste.
     *
     * Le marchand qui veut les quatre gardes prend `Heurix.browsePanel`,
     * dont c'est le role.
     */
    var appel = fetch(buildUrl(options), {
      headers: { "Authorization": "Bearer " + apiKey }
    }).catch(function (e) {
      journaliserPourLeMarchand("browse indisponible", classerEchec(0, e, null));
      throw e;
    });
    return appel.then(function (res) {
      // Le corps se lit UNE fois : `res.json()` consomme le flux, donc on ne
      // peut pas le relire pour en tirer `detail` apres coup. On classe donc
      // depuis la meme lecture que celle qu'on rend a l'appelant.
      return res.json().then(function (data) {
        if (!res.ok) {
          journaliserPourLeMarchand("browse indisponible",
            classerEchec(res.status, null, data ? data.detail : null));
        }
        return data;
      }, function (e) {
        if (!res.ok) {
          journaliserPourLeMarchand("browse indisponible",
            classerEchec(res.status, null, null));
        }
        throw e;   // un corps illisible rejetait deja avant ce chantier
      });
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
      // `grid-column:1/-1` : l'etat vit DANS la grille, donc il en etait une
      // CELLULE -- 224 px sur une grille de 938, mesure le 6 septembre 2026.
      // « Rayon indisponible pour le moment. » y passait a la ligne, et les
      // deux actions s'empilaient au lieu de se ranger cote a cote. Le defaut
      // est anterieur a ce chantier (« Chargement… » et « Aucun produit dans
      // ce rayon » etaient logees a la meme enseigne) ; il ne se voyait pas
      // sur une ligne de texte gris, et se voit des qu'un bouton s'y pose.
      // Vu a l'ecran, pas par un test : la largeur d'une cellule ne fait
      // echouer aucune assertion.
      ".hx-rayon-etat{grid-column:1/-1;padding:26px 14px;font-size:14px;color:#4A4D63;text-align:center;}",
      // SORTIE DE PANNE. Meme silhouette que le bouton de page courant, qui
      // est deja l'action pleine de ce widget -- un troisieme style
      // n'apprendrait rien au visiteur.
      //
      // CONTRASTES COMPOSES SUR BLANC, pas supposes : ce widget se pose chez
      // le marchand, dont on ne connait pas la charte, et aucun fond n'est
      // impose ici. L'accent par defaut #2952E3 rend 6,15:1 avec du blanc,
      // au-dessus des 4,5 de AA -- et c'est la meme paire que
      // .hx-rayon-pg[aria-current] emploie deja. Un marchand qui passe un
      // `accentColor` clair casse les deux ensemble, pas seulement celui-ci.
      ".hx-rayon-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center;margin-top:12px;}",
      // L'ETAT DE PANNE EST LE SEUL A ETRE ALIGNE A GAUCHE, et c'est parce
      // qu'il est le seul dont la PHRASE vit ailleurs -- dans le compte, qui
      // porte l'aria-live et qui est aligne a gauche comme tout paragraphe.
      // Centre et separe de 100 px, le bouton se lisait comme un element sans
      // rapport avec le message au-dessus. Vu a l'ecran le 6 septembre 2026.
      // Les deux autres etats (« Chargement… », « Aucun produit dans ce
      // rayon ») restent centres : ils portent leur phrase avec eux.
      //
      // CETTE REGLE A ETE ECRITE AVANT `hx-rayon-corps-nu`, ET LA REUNION DES
      // DEUX BRANCHES A CHANGE SA RAISON SANS CHANGER SON EFFET. Elle
      // compensait alors un decalage : l'etat vivait dans la colonne de
      // contenu, indentee de 242 px par un rail vide, et le centrage eloignait
      // encore le bouton. La colonne rendue a la grille, le message et le
      // bouton partagent maintenant le meme bord gauche -- l'alignement est
      // devenu exact au lieu d'etre un moindre mal. Verifie a l'ecran APRES le
      // rebase, parce que le crochet pre-push teste l'arbre d'avant et qu'un
      // effet ne naissant que de la reunion lui est structurellement invisible.
      ".hx-rayon-etat-panne{text-align:left;padding-top:0;padding-left:0;}",
      ".hx-rayon-etat-panne .hx-rayon-actions{justify-content:flex-start;margin-top:0;}",
      ".hx-rayon-reessayer{font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;background:var(--hx-accent);color:#fff;border:none;padding:9px 18px;border-radius:100px;}",
      ".hx-rayon-reessayer:focus-visible{outline:3px solid var(--hx-accent);outline-offset:2px;}",
      ".hx-rayon-secours{font-size:13.5px;font-weight:600;color:var(--hx-accent);text-decoration:underline;}",
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
      // Rail vide : pas de colonne. Voir « LA COLONNE DE 220 px » plus bas.
      // Le selecteur porte les deux classes pour ne pas dependre de l'ordre
      // des regles -- l'annulation d'une grille par une seule classe de meme
      // specificite tient au fichier, pas au CSS.
      "@media (min-width:721px){.hx-rayon-corps.hx-rayon-corps-nu{display:block;}}",
      // Sous 721 px le corps est deja en bloc : c'est la marge basse du rail
      // qui reste, soit 18 px de vide avant le premier produit.
      ".hx-rayon-corps-nu > .hx-rayon-rail{display:none;}",
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
      // Barre de tri
      ".hx-rayon-barre{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 14px;}",
      ".hx-rayon-barre label{font-size:13px;color:#4A4D63;}",
      ".hx-rayon-tri{font:inherit;font-size:13.5px;padding:7px 10px;border:1px solid #D6D9E4;border-radius:8px;background:#fff;color:#3A3D52;cursor:pointer;}",
      ".hx-rayon-tri:focus-visible{outline:3px solid var(--hx-accent);outline-offset:2px;}",
      // Merchandising rendu VISIBLE. Un produit epingle garde sa place quel
      // que soit le tri (mesure : le plus cher reste premier en « prix
      // croissant ») : sans etiquette, la liste se lit comme un tri casse.
      ".hx-rayon .heurix-product{position:relative;}",
      ".hx-rayon-marque{align-self:flex-start;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border-radius:100px;padding:2px 8px;}",
      ".hx-rayon-marque-epingle{background:var(--hx-accent);color:#fff;}",
      ".hx-rayon-marque-relegue{background:#EEF0F6;color:#4A4D63;}",
      ".hx-rayon-note{margin:10px 0 0;font-size:12.5px;color:#6E7183;}",
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
    /* LES TRIS OFFERTS AU VISITEUR.
     *
     * `margin` est ABSENT DE LA LISTE PAR DEFAUT, et ce n'est pas un oubli :
     * le moteur le sait trier, mais « classer la boutique par ma marge » est
     * une strategie de marchand, pas un choix d'acheteur. Il reste
     * utilisable en tri PAR DEFAUT (config.sort) et le marchand peut
     * l'offrir explicitement via config.sorts.
     */
    var TRIS_PAR_DEFAUT = ["stock", "price_asc", "price_desc", "alphabetical", "recent", "popular"];
    var trisOfferts = config.sorts || TRIS_PAR_DEFAUT;
    var triActif = config.sort || "stock";
    var filtresActifs = {};   // { champ: [valeur, ...] }
    var ouSupporte = true;    // jusqu'a preuve du contraire -- voir detecterOuAbsent
    var focusARendre = null;  // selecteur de l'element a refocaliser apres redessin

    var delaiMs = config.timeoutMs != null ? config.timeoutMs : RAYON_TIMEOUT_MS;
    var coupeCircuit = creerCoupeCircuit(RAYON_PAUSE_MS);
    var dernierEchec = null;  // derniere classification, pour le re-affichage
    var abandonner = null;    // coupe la requete en vol, s'il y en a une

    /* LE REPLI, A DEUX ETAGES, ET SEUL LE PREMIER EST AUTOMATIQUE.
     *
     *  - SANS AUCUNE CONFIGURATION, le rayon cesse d'etre un cul-de-sac : un
     *    bouton « Reessayer » remplace le message mort. C'est peu, et c'est
     *    ce que TOUS les marchands deja installes recoivent sans rien
     *    changer.
     *
     *  - `fallbackHref(category)` rend l'URL de la propre page de categorie
     *    du marchand, vers laquelle le visiteur est invite a poursuivre.
     *
     * POURQUOI UNE OPTION ET PAS UNE DEDUCTION. Ce fichier ne devine jamais
     * une URL de site -- meme regle que renderItem et facetLabels. Deduire
     * l'adresse d'une page de categorie (un /categorie/<slug> suppose) serait
     * une supposition sur le site du marchand, pas une mesure.
     */
    var fallbackHref = config.fallbackHref || null; // function(category) -> url
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
      '<div class="hx-rayon-barre" id="' + esc(idb) + '-barre"></div>' +
      '<div class="hx-rayon-corps">' +
        '<div class="hx-rayon-rail" id="' + esc(idb) + '-rail"></div>' +
        '<div>' +
          '<div class="hx-rayon-grille" id="' + esc(idb) + '-grille"></div>' +
          '<nav class="hx-rayon-pagination" id="' + esc(idb) + '-pagination" aria-label="' + esc(T.pagination) + '" hidden></nav>' +
        "</div>" +
      "</div>";

    var elCompte = conteneur.querySelector(".hx-rayon-compte");
    var elBarre = conteneur.querySelector(".hx-rayon-barre");
    var elCorps = conteneur.querySelector(".hx-rayon-corps");
    var elRail = conteneur.querySelector(".hx-rayon-rail");
    var elGrille = conteneur.querySelector(".hx-rayon-grille");
    var elPagination = conteneur.querySelector(".hx-rayon-pagination");

    /* LA COLONNE DE 220 px NE SE RESERVE QUE SI LE RAIL LA REMPLIT.
     *
     * `config.facets` vaut [] par defaut, donc rendreRail() sort a sa
     * premiere ligne et elRail reste vide en permanence. La grille perdait
     * alors 242 px -- 220 de colonne, 22 de gouttiere -- sur les 1180 d'un
     * rayon en 1280, soit 20 % de sa largeur, chez le marchand qui n'a rien
     * configure. Mesure du 6 septembre 2026, navigateur reel : corps 1180,
     * grille 938, `gridTemplateColumns` a « 220px 938px ».
     *
     * Le meme decalage indentait « Aucun produit dans ce rayon » et l'etat de
     * panne, qui vivent dans la colonne de contenu : deux messages centres
     * sur 938 px sous un rayon large de 1180, donc decentres de 121 px.
     *
     * L'ETAT SE DECIDE ICI PLUTOT QUE PAR `:has(.hx-rayon-rail:empty)`, et
     * les deux raisons sont mesurables. Le rail est vide PENDANT LE
     * CHARGEMENT meme quand les facettes sont configurees : la regle CSS
     * ferait donc sauter la mise en page a l'arrivee de la reponse, sur
     * precisement les rayons qui n'ont pas le defaut -- or ce fichier evite
     * deja de vider la grille entre deux pages pour cette raison-la (voir
     * charger()). Et `:has()` manque aux navigateurs d'avant 2023, ou le
     * defaut resterait entier.
     *
     * L'appel se pose partout ou le remplissage du rail se decide : la
     * configuration a la construction, les deux sorties de rendreRail, et la
     * panne au premier chargement, qui n'appelle pas rendreRail du tout.
     * Rien dans le chemin `Heurix.browse`, qui n'a ni corps ni rail.
     */
    function majColonneRail(vide) {
      elCorps.classList.toggle("hx-rayon-corps-nu", vide);
    }
    majColonneRail(!champsFacettes.length);

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
      p.push("sort=" + encodeURIComponent(triActif));
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

    /* LA BARRE DE TRI.
     *
     * UN <select> NATIF, pas une liste deroulante maison : Tab l'atteint,
     * les fleches et la frappe au clavier le parcourent, et un lecteur
     * d'ecran annonce « liste, N sur M » sans une ligne de notre part.
     *
     * LES TRIS DE PRIX SONT RETIRES QUAND AUCUN PRIX N'EST SERVI, et c'est
     * une consequence mesuree du chantier « un prix par cle publique »
     * (29 aout 2026) : une cle reglee `price_visible: false` recoit des
     * produits DONT LE CHAMP price A DISPARU -- pendant que le moteur, lui,
     * continue de trier dessus. « Prix croissant » y reordonnerait la liste
     * sans que rien a l'ecran ne l'explique.
     *
     * On ne le devine pas depuis la configuration : on le LIT dans la
     * reponse. Aucun hit ne porte de prix -> pas d'option de prix.
     */
    function rendreBarre(data) {
      var hits = data.hits || [];
      var prixServi = hits.some(function (h) { return h.product && h.product.price != null; });
      var options = trisOfferts.filter(function (t) {
        if (!T.tris[t]) return false;                       // tri inconnu : ignore
        if (!prixServi && (t === "price_asc" || t === "price_desc")) return false;
        return true;
      });
      // Un seul choix possible n'est pas un choix : on ne dessine rien.
      if (options.length < 2) { elBarre.innerHTML = ""; return; }
      elBarre.innerHTML =
        '<label for="' + esc(idb) + '-tri">' + esc(T.trier) + "</label>" +
        '<select class="hx-rayon-tri" id="' + esc(idb) + '-tri">' +
        options.map(function (t) {
          return '<option value="' + esc(t) + '"' + (t === triActif ? " selected" : "") + ">" +
                 esc(T.tris[t]) + "</option>";
        }).join("") + "</select>";
    }

    /* LE MERCHANDISING, RENDU VISIBLE.
     *
     * MESURE DU 29 AOUT, et c'est elle qui impose l'etiquette : L'EPINGLAGE
     * GAGNE TOUJOURS SUR LE TRI. Un produit epingle en position 1 y reste
     * sous chaque strategie -- verifie sur quatre produits, le plus cher
     * epingle restait premier en « prix croissant », et le moins cher
     * relegue tombait en dernier :
     *
     *   sans epinglage,  prix croissant   p3(2) p1(8) p0(10) p2(12)
     *   p2 epingle,      prix croissant   p2(12) p3(2) p1(8) p0(10)
     *
     * Une liste intitulee « prix croissant » qui commence a 12,00 EUR se lit
     * comme un tri casse. L'API donne `pinned` et `buried` sur chaque hit :
     * les taire, c'est faire porter au visiteur une decision du marchand
     * sans la nommer.
     */
    function marqueHtml(hit) {
      if (hit.pinned) {
        return '<span class="hx-rayon-marque hx-rayon-marque-epingle" title="' +
          esc(T.epingleAria) + '">' + esc(T.epingle) + "</span>";
      }
      if (hit.buried) {
        return '<span class="hx-rayon-marque hx-rayon-marque-relegue" title="' +
          esc(T.relegueAria) + '">' + esc(T.relegue) + "</span>";
      }
      return "";
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
      // Facettes demandees, aucune valeur renvoyee : le rail ne se remplira
      // pas non plus. La colonne se rend a la grille, une fois.
      if (!h) { elRail.innerHTML = ""; majColonneRail(true); return; }
      // `railDeplie` porte l'etat CHOISI par le visiteur et survit au
      // redessin : sans lui, cocher une case replierait le rail sous le
      // doigt de qui vient de l'ouvrir -- meme classe de defaut que le
      // focus perdu, une intention detruite par un rendu.
      elRail.innerHTML = '<details class="hx-rayon-repli"' + (railDeplie ? " open" : "") + ">" +
        "<summary>" + esc(T.filtres) + (actifs ? " (" + actifs + ")" : "") + "</summary>" +
        h + "</details>";
      majColonneRail(false);
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
        return marqueHtml(h) + rendreFiche(h, i, lang);
      }).join("");
      // La note n'apparait QUE si un produit de la page est effectivement
      // place a la main : elle explique ce qu'on voit, elle n'avertit pas
      // d'une possibilite.
      var force = hits.some(function (h) { return h.pinned || h.buried; });
      var note = elGrille.parentNode.querySelector(".hx-rayon-note");
      if (force && !note) {
        note = document.createElement("p");
        note.className = "hx-rayon-note";
        note.textContent = T.ordreForce;
        elGrille.parentNode.insertBefore(note, elPagination);
      } else if (!force && note) {
        note.parentNode.removeChild(note);
      }
      rendreBarre(data);
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

    /* 3. LE LECTEUR.
     *
     * Il consomme une classification deja faite. Il ne regarde aucun code
     * HTTP et n'arme rien : les deux autres responsabilites ont deja eu lieu
     * quand il est appele. Le visiteur ne voit jamais `classification.marchand`.
     */
    function montrerEchec() {
      // LA PHRASE EST ECRITE UNE FOIS, DANS LE COMPTE, ET LES ACTIONS DANS LA
      // GRILLE. Le premier jet la posait aux deux endroits -- c'est ce que le
      // code d'avant faisait deja (`elCompte.textContent = T.indispo` PUIS
      // `etat(T.indispo)`), et ca ne se voyait pas tant que l'etat de panne
      // etait une ligne de texte grise. Avec un bouton dessous, l'ecran
      // affichait deux fois la meme phrase a 90 px d'intervalle. Vu a
      // l'ecran le 6 septembre 2026, pas par un test : les deux textes sont
      // justes separement, et aucune assertion ne compte les repetitions.
      //
      // Le compte est le bon porteur : il est role="status" aria-live, donc
      // il ANNONCE le changement, et il n'a plus de total a montrer.
      elCompte.textContent = T.indispo;
      elPagination.hidden = true;
      // Panne au PREMIER chargement : le rail n'a jamais rien recu et ne
      // recevra rien, donc la colonne de 220 px se rend a la grille (voir
      // « LA COLONNE DE 220 px »). Une panne ULTERIEURE laisse le rail garni,
      // donc la colonne en place -- c'est ce que teste `!elRail.innerHTML`.
      //
      // L'APPEL EST ICI ET PAS DANS LE .catch, et c'est la reunion de deux
      // branches qui l'a impose : `montrerEchec` est aussi le chemin du
      // coupe-circuit ouvert, qui reaffiche la panne SANS repasser par le
      // .catch. Pose la-bas, il aurait manque ce cas -- un defaut qu'aucune
      // des deux branches ne portait, et que ni l'une ni l'autre n'aurait pu
      // voir seule.
      majColonneRail(!elRail.innerHTML);
      var h = '<div class="hx-rayon-etat hx-rayon-etat-panne">' +
        '<div class="hx-rayon-actions">' +
        '<button type="button" class="hx-rayon-reessayer">' + esc(T.reessayer) + "</button>";
      var lien = fallbackHref ? fallbackHref(config.category) : null;
      if (lien) {
        h += '<a class="hx-rayon-secours" href="' + esc(lien) + '">' +
             esc(T.continuerSur) + " →</a>";
      }
      elGrille.innerHTML = h + "</div></div>";
      // Le rail et la barre restent en place : un visiteur qui a filtre garde
      // le moyen de DEFAIRE son filtre, ce qui est parfois le remede.
    }

    function charger(n, focusApres) {
      if (detruit) return;
      page = n;
      // COUPE-CIRCUIT LU AVANT TOUT APPEL. Pendant la pause on ne paie meme
      // pas le delai d'attente : cocher trois facettes pendant une panne
      // martelait l'API d'un appel par case, chacun attendant son delai.
      if (coupeCircuit.estOuvert() && dernierEchec) {
        montrerEchec();
        rendreFocus();
        return;
      }
      var id = ++requeteEnCours;
      // Pas d'etat « chargement » qui vide la grille a chaque page : sur une
      // connexion normale la reponse arrive en moins de 200 ms, et vider la
      // grille ferait sauter la mise en page. Seul le compte l'annonce.
      if (elGrille.innerHTML === "") etat(T.chargement);

      // DELAI D'ATTENTE. AbortController est garde plutot que suppose : s'il
      // manque (navigateur ancien), `signal` reste undefined, fetch l'ignore,
      // et le widget se comporte exactement comme avant ce chantier. Aucune
      // installation existante ne peut casser sur son absence.
      var controleur = typeof AbortController !== "undefined" ? new AbortController() : null;
      var minuteur = controleur && delaiMs > 0
        ? setTimeout(function () { controleur.abort(); }, delaiMs)
        : null;
      // Un changement de page, de tri ou de filtre rend la requete precedente
      // inutile : on la coupe au lieu de la laisser occuper une connexion. Sa
      // promesse rejettera en AbortError avec un `id` perime -- le garde des
      // deux branches ci-dessous la fait sortir AVANT toute classification,
      // donc un abandon volontaire ne peut jamais armer le coupe-circuit.
      if (abandonner) abandonner();
      abandonner = controleur ? function () { controleur.abort(); } : null;

      var statut = 0;
      return fetch(urlPage(n), {
        headers: { Authorization: "Bearer " + config.apiKey },
        signal: controleur ? controleur.signal : undefined,
      })
        .then(function (r) {
          // CONTROLE DE res.ok, contrairement a Heurix.browse. Sans lui, une
          // 403 de cle invalide rend un corps JSON d'erreur, `hits` est
          // absent, et le visiteur lit « Aucun produit dans ce rayon » -- un
          // catalogue casse deguise en rayon vide. Le defaut est verrouille
          // tel quel sur l'ancien chemin ; il n'est pas reconduit ici.
          statut = r.status;
          if (!r.ok) {
            // On lit le corps AVANT de classer : c'est lui, et lui seul, qui
            // separe un 403 « domaine non autorise » d'un 403 « clef
            // rejetee ». Un corps illisible n'est pas une panne de plus, on
            // classe alors sans detail.
            return r.json().then(
              function (corps) { throw { heurixDetail: corps ? corps.detail : null }; },
              function () { throw { heurixDetail: null }; }
            );
          }
          return r.json().then(null, function () {
            var e = new Error("corps non-JSON");
            e.name = "HeurixReponseIllisible";
            throw e;
          });
        })
        .then(function (data) {
          clearTimeout(minuteur);
          if (detruit || id !== requeteEnCours) return; // une page plus recente est partie
          // Un succes efface toute trace d'echec anterieur -- meme regle que
          // signaler_succes() cote WooCommerce.
          coupeCircuit.reinitialiser();
          dernierEchec = null;
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
          clearTimeout(minuteur);
          // CE GARDE VIENT AVANT TOUTE CLASSIFICATION, et l'ordre est le
          // point : une requete abandonnee parce qu'un filtre plus recent l'a
          // remplacee rejette elle aussi en AbortError. La faire sortir ici
          // est ce qui empeche un abandon volontaire d'armer le coupe-circuit
          // et de faire passer trois cases cochees vite pour une panne.
          if (detruit || id !== requeteEnCours) return;

          var classification = classerEchec(
            statut,
            e && e.heurixDetail !== undefined ? null : e,
            e && e.heurixDetail !== undefined ? e.heurixDetail : null
          );

          journaliserPourLeMarchand("rayon indisponible", classification);  // le marchand
          coupeCircuit.armer(classification);          // l'armeur -- transitoire seulement
          dernierEchec = classification;
          montrerEchec();                              // le visiteur
          rendreFocus();
        });
    }

    /* LE BOUTON « REESSAYER » EST DELEGUE SUR LA GRILLE, PAS CABLE SUR LUI.
     *
     * `montrerEchec` reconstruit elGrille par innerHTML, qui detruit les
     * ecouteurs avec les elements qu'il remplace. La grille, elle, survit a
     * ses enfants -- c'est le conteneur stable, comme elPagination et elRail
     * juste en dessous. Cabler le bouton apres chaque rendu marcherait aussi,
     * et se reoublierait au premier rendu ajoute.
     */
    elGrille.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".hx-rayon-reessayer") : null;
      if (!b) return;
      // Un geste explicite du visiteur prime sur la pause -- elle n'existe
      // que pour lui epargner une attente, et il vient de la demander.
      coupeCircuit.reinitialiser();
      dernierEchec = null;
      elGrille.innerHTML = "";     // force l'etat « Chargement… » ci-dessous
      // Le focus revient au compte : le bouton qu'on vient d'actionner est
      // detruit par le rendu, et le compte porte tabindex="-1" et l'aria-live
      // qui annoncera le resultat -- meme reprise que la pagination.
      focusARendre = ".hx-rayon-compte";
      charger(page);
    });

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

    elBarre.addEventListener("change", function (e) {
      var sel = e.target;
      if (!sel || sel.tagName !== "SELECT") return;
      triActif = sel.value;
      // Changer de tri redessine la liste ET la barre : le <select> qu'on
      // vient d'actionner est detruit. Sans reprise, le focus retombe sur
      // <body> -- troisieme forme du meme defaut, apres la pagination et
      // les facettes.
      focusARendre = ".hx-rayon-tri";
      // Un nouvel ordre n'a pas de « page 3 » : on repart du debut.
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
                 filters: f, multiSelect: ouSupporte, sort: triActif };
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
