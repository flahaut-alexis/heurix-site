/* Boutique de démonstration — logique d'intégration.
 *
 * OBJET DE CE FICHIER. Montrer ce qu'un vrai client écrit pour intégrer
 * Heurix. Rien n'est simulé : chaque appel part vers l'API de production.
 *
 * C'est le seul moyen de découvrir ce qu'un audit ne montre pas — la
 * génération du catalogue de test a d'ailleurs révélé en trente minutes que
 * trois graphies de dimension sur six perdaient leur annotation de longueur.
 *
 * CONFIGURATION. Remplacez CLE_PUBLIQUE et CATALOGUE ci-dessous par les
 * vôtres. La clé doit être PUBLIQUE (préfixe hxp_) : une clé serveur dans
 * une page web serait lisible par n'importe quel visiteur, et lui donnerait
 * le droit de modifier votre catalogue.
 */
(function () {
  "use strict";

  var API = "https://api.heurix.fr";
  var CLE_PUBLIQUE = "hxp_REMPLACEZ_PAR_VOTRE_CLE_PUBLIQUE";
  var CATALOGUE = "quincaillerie-nord";

  // ------------------------------------------------------------- langue
  // UN SEUL FICHIER POUR LES DEUX LANGUES (26 aout 2026). La langue se lit
  // sur document.documentElement.lang, jamais supposee -- meme motif que
  // demo-search-live.js, console-i18n.js et guide-quiz.js. Un second fichier
  // aurait diverge du premier : c'est le defaut que ce depot a corrige huit
  // fois cette semaine.
  //
  // Ce qui reste FRANCAIS et ne doit pas etre traduit : les slugs de
  // categorie (c=visserie), qui sont les categories reelles du catalogue
  // public-demo cote API, et les noms de produits, qui en viennent aussi.
  var EN = document.documentElement.lang === "en";

  var T = EN ? {
    rupture:      function (j) { return "Out of stock — restock in " + j + " days"; },
    stockFaible:  function (n) { return "Only " + n + " left"; },
    enStock:      function (n) { return "In stock (" + n + ")"; },
    indisponible: "Unavailable",
    ajouter:      "Add to cart",
    ajoute:       "Added \u2713",
    aucunProduit: "No products.",
    catalogueKo:  "Catalogue unavailable — check the public key and the catalogue " +
                  "name in boutique.js.",
    rayonVide:    "No products in this category.",
    rayonKo:      "This category is unavailable right now.",
    references:   function (n) { return n + " references"; },
    placeholder:  "Reference, dimension, standard\u2026 (e.g. M8x20, DIN 933)",
    rayons: { visserie: "Screws", boulonnerie: "Bolts", fixation: "Fixings",
              maconnerie: "Masonry", accessoires: "Accessories" }
  } : {
    rupture:      function (j) { return "Rupture — réappro sous " + j + " j"; },
    stockFaible:  function (n) { return "Plus que " + n + " en stock"; },
    enStock:      function (n) { return "En stock (" + n + ")"; },
    indisponible: "Indisponible",
    ajouter:      "Ajouter au panier",
    ajoute:       "Ajouté \u2713",
    aucunProduit: "Aucun produit.",
    catalogueKo:  "Catalogue indisponible — vérifiez la clé publique et le nom du " +
                  "catalogue dans boutique.js.",
    rayonVide:    "Aucun produit dans ce rayon.",
    rayonKo:      "Rayon indisponible pour le moment.",
    references:   function (n) { return n + " références"; },
    placeholder:  "Référence, dimension, norme… (ex. M8x20, DIN 933)",
    rayons: { visserie: "Visserie", boulonnerie: "Boulonnerie", fixation: "Fixation",
              maconnerie: "Maçonnerie", accessoires: "Accessoires" }
  };

  // ------------------------------------------------------------- affichage

  function euros(n) {
    // Le catalogue est facture en euros dans les deux langues ; seule la
    // CONVENTION D'ECRITURE change -- « 12,34 € » contre « €12.34 ». Meme
    // regle que demo-search-live.js, ou elle est deja couverte par un test.
    var v = Number(n).toFixed(2);
    return EN ? "\u20AC" + v : v.replace(".", ",") + " \u20AC";
  }

  function ficheProduit(p) {
    var stock = p.stock || 0;
    var etatStock = stock === 0
      ? "<span class='rupture'>" + T.rupture(5) + "</span>"
      : (stock < 20
        ? "<span class='stock-faible'>" + T.stockFaible(stock) + "</span>"
        : "<span class='en-stock'>" + T.enStock(stock) + "</span>");

    return "<div class='fiche'>" +
        "<div class='fiche-ref'>" + (p.ref || p.id) + "</div>" +
        "<div class='fiche-nom'>" + p.name + "</div>" +
        "<div class='fiche-prix'>" + euros(p.price) + " <small>HT</small></div>" +
        "<div class='fiche-stock'>" + etatStock + "</div>" +
        "<button type='button' data-produit='" + p.id + "'" +
          (stock === 0 ? " disabled" : "") + ">" +
          (stock === 0 ? T.indisponible : T.ajouter) + "</button>" +
      "</div>";
  }

  function afficher(conteneur, produits, messageVide) {
    var el = document.getElementById(conteneur);
    if (!el) return;
    if (!produits || !produits.length) {
      el.innerHTML = "<p class='chargement'>" + (messageVide || T.aucunProduit) + "</p>";
      return;
    }
    el.innerHTML = produits.map(ficheProduit).join("");
  }

  // ------------------------------------------------------------ appels API

  function appeler(chemin) {
    return fetch(API + chemin, {
      headers: { "Authorization": "Bearer " + CLE_PUBLIQUE },
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function chargerPopulaires() {
    // Browse trie par popularité : c'est l'option Ranking en action.
    appeler("/v1/browse/" + CATALOGUE + "/visserie?sort=popularity&limit=8")
      .then(function (d) {
        afficher("populaires", (d.hits || []).map(function (h) { return h.product; }));
      })
      .catch(function (e) {
        var el = document.getElementById("populaires");
        if (el) {
          el.innerHTML = "<p class='chargement'>" + T.catalogueKo +
            "<br><small>" + e.message + "</small></p>";
        }
      });
  }

  function chargerCategorie(categorie) {
    var params = new URLSearchParams(location.search);
    var tri = params.get("tri") || "stock";
    appeler("/v1/browse/" + CATALOGUE + "/" + encodeURIComponent(categorie) +
            "?sort=" + tri + "&limit=24")
      .then(function (d) {
        afficher("produits-categorie", (d.hits || []).map(function (h) { return h.product; }),
                 T.rayonVide);
        var compteur = document.getElementById("compteur");
        if (compteur) compteur.textContent = T.references(d.total || 0);
      })
      .catch(function () {
        afficher("produits-categorie", [], T.rayonKo);
      });
  }

  // -------------------------------------------------------------- panier

  var panier = [];

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-produit]");
    if (!b || b.disabled) return;
    var id = b.getAttribute("data-produit");
    panier.push(id);
    b.textContent = T.ajoute;
    setTimeout(function () { b.textContent = T.ajouter; }, 1400);

    // REMONTÉE DE CONVERSION. C'est ce qui permet à Heurix de rattacher un
    // achat à la recherche qui l'a précédé — sans quoi l'analytique ne
    // mesure que du trafic, pas de la valeur.
    if (window.Heurix && window.Heurix.trackConversion) {
      window.Heurix.trackConversion({ productId: id });
    }
  });

  // --------------------------------------------------------------- départ

  function init() {
    // Barre de recherche : c'est l'intégration que teste ce site.
    if (window.Heurix && window.Heurix.searchBox &&
        document.getElementById("recherche-heurix")) {
      window.Heurix.searchBox({
        apiKey: CLE_PUBLIQUE,
        catalog: CATALOGUE,
        containerId: "recherche-heurix",
        placeholder: T.placeholder,
      });
    }

    if (document.getElementById("populaires")) chargerPopulaires();

    var zone = document.getElementById("produits-categorie");
    if (zone) {
      var c = new URLSearchParams(location.search).get("c") || "visserie";
      var titre = document.getElementById("titre-categorie");
      // Le slug reste francais (categorie reelle de l'API) ; seul le
      // LIBELLE affiche suit la langue de la page.
      if (titre) titre.textContent = T.rayons[c] || (c.charAt(0).toUpperCase() + c.slice(1));
      document.querySelectorAll("nav.rayons a").forEach(function (a) {
        if (a.getAttribute("href").indexOf("c=" + c) !== -1) a.classList.add("actif");
      });
      chargerCategorie(c);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
