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

  var TEXTES = {
    fr: {
      vide: "<p>Aucun produit dans cette catégorie.</p>",
      rupture: "Rupture de stock",
    },
    en: {
      vide: "<p>No products in this category.</p>",
      rupture: "Out of stock",
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
      ? "<div class='heurix-price'>" + fmtPrix(p.price, lang) + "</div>" : "";
    return "<div class='heurix-product' data-id='" + p.id + "'>" +
      "<div class='heurix-name'>" + (p.name || p.id) + "</div>" + price +
      (hit.in_stock ? "" : "<div class='heurix-out-of-stock'>" + T.rupture + "</div>") +
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
})();
