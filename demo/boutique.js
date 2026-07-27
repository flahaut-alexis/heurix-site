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

  // ------------------------------------------------------------- affichage

  function euros(n) {
    return Number(n).toFixed(2).replace(".", ",") + " €";
  }

  function ficheProduit(p) {
    var stock = p.stock || 0;
    var etatStock = stock === 0
      ? "<span class='rupture'>Rupture — réappro sous 5 j</span>"
      : (stock < 20
        ? "<span class='stock-faible'>Plus que " + stock + " en stock</span>"
        : "<span class='en-stock'>En stock (" + stock + ")</span>");

    return "<div class='fiche'>" +
        "<div class='fiche-ref'>" + (p.ref || p.id) + "</div>" +
        "<div class='fiche-nom'>" + p.name + "</div>" +
        "<div class='fiche-prix'>" + euros(p.price) + " <small>HT</small></div>" +
        "<div class='fiche-stock'>" + etatStock + "</div>" +
        "<button type='button' data-produit='" + p.id + "'" +
          (stock === 0 ? " disabled" : "") + ">" +
          (stock === 0 ? "Indisponible" : "Ajouter au panier") + "</button>" +
      "</div>";
  }

  function afficher(conteneur, produits, messageVide) {
    var el = document.getElementById(conteneur);
    if (!el) return;
    if (!produits || !produits.length) {
      el.innerHTML = "<p class='chargement'>" + (messageVide || "Aucun produit.") + "</p>";
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
          el.innerHTML = "<p class='chargement'>Catalogue indisponible — " +
            "vérifiez la clé publique et le nom du catalogue dans boutique.js. " +
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
                 "Aucun produit dans ce rayon.");
        var compteur = document.getElementById("compteur");
        if (compteur) compteur.textContent = (d.total || 0) + " références";
      })
      .catch(function () {
        afficher("produits-categorie", [], "Rayon indisponible pour le moment.");
      });
  }

  // -------------------------------------------------------------- panier

  var panier = [];

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-produit]");
    if (!b || b.disabled) return;
    var id = b.getAttribute("data-produit");
    panier.push(id);
    b.textContent = "Ajouté ✓";
    setTimeout(function () { b.textContent = "Ajouter au panier"; }, 1400);

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
        placeholder: "Référence, dimension, norme… (ex. M8x20, DIN 933)",
      });
    }

    if (document.getElementById("populaires")) chargerPopulaires();

    var zone = document.getElementById("produits-categorie");
    if (zone) {
      var c = new URLSearchParams(location.search).get("c") || "visserie";
      var titre = document.getElementById("titre-categorie");
      if (titre) titre.textContent = c.charAt(0).toUpperCase() + c.slice(1);
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
