/*
 * Heurix Browse Widget — appelle /v1/browse et affiche les résultats
 * dans une page de catégorie de votre site, sans recherche.
 *
 * Volontairement minimal : ce script ne fournit AUCUN style visuel imposé
 * — chaque site a sa propre charte, sa propre grille de produits. Il
 * s'occupe de l'appel API et de la boucle d'affichage ; vous fournissez
 * le rendu HTML de chaque produit (renderItem) et votre CSS habituel.
 *
 * Documentation complète et exemple pas à pas :
 * https://heurix.fr/blog/guide-page-categorie-browse.html
 */
(function () {
  var HEURIX_API_KEY = "hx_VOTRE_CLE_ICI"; // Console Heurix > Mes infos
  var HEURIX_CATALOG = "votre-catalogue";   // Le nom exact de votre catalogue indexé

  function defaultRenderItem(hit) {
    var p = hit.product;
    var price = p.price !== undefined ? "<div class='heurix-price'>" + p.price + " €</div>" : "";
    return "<div class='heurix-product' data-id='" + p.id + "'>" +
      "<div class='heurix-name'>" + (p.name || p.id) + "</div>" + price +
      (hit.in_stock ? "" : "<div class='heurix-out-of-stock'>Rupture de stock</div>") +
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
    var apiKey = options.apiKey || HEURIX_API_KEY;
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
            container.innerHTML = options.emptyMessage || "<p>Aucun produit dans cette catégorie.</p>";
          } else {
            container.innerHTML = data.hits.map(renderItem).join("");
          }
        }
      }
      return data;
    });
  };
})();
