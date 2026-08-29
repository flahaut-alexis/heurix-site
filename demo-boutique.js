/* Boutique de démonstration — logique d'intégration.
 *
 * OBJET DE CE FICHIER. Montrer ce qu'un vrai client écrit pour intégrer
 * Heurix. Rien n'est simulé : chaque appel part vers l'API de production.
 *
 * C'est le seul moyen de découvrir ce qu'un audit ne montre pas — la
 * génération du catalogue de test a d'ailleurs révélé en trente minutes que
 * trois graphies de dimension sur six perdaient leur annotation de longueur.
 *
 * CE N'EST PAS UN GABARIT À RECOPIER (26 août 2026). L'en-tête disait
 * « Remplacez CLE_PUBLIQUE et CATALOGUE ci-dessous par les vôtres » — une
 * consigne d'exemple d'intégration, dans une page qui est une VITRINE. Les
 * deux rôles ne tiennent pas ensemble : tant qu'on lisait ce fichier comme un
 * modèle, une clé restée au gabarit paraissait normale, et la boutique a servi
 * « Catalogue indisponible » à ses visiteurs sans que personne le relève.
 * L'exemple d'intégration vit désormais dans docs.html, en bloc de code.
 *
 * LA CLÉ CI-DESSOUS EST PUBLIQUE, ET C'EST SA PLACE. Préfixe hxp_, portée
 * limitée à search / browse / events, et restreinte aux origines heurix.fr et
 * www.heurix.fr — l'en-tête Origin est posé par le navigateur, pas par le
 * JavaScript de la page (heurix/deps.py:323). Elle ne peut donc pas servir
 * depuis un autre site, ni modifier quoi que ce soit.
 *
 * Corollaire pratique : elle renvoie 403 depuis localhost. Une vérification
 * de cette boutique se fait en production, pas sur un serveur d'aperçu.
 */
(function () {
  "use strict";

  var API = "https://api.heurix.fr";
  var CLE_PUBLIQUE = "hxp_-PwGHmQFiSb2qqML38M417jyhE10ArMa";
  var CATALOGUE = "quincaillerie-nord";

  // LE NOMBRE DE REFERENCES VIT ICI, ET NULLE PART AILLEURS (26 aout 2026).
  // Il etait ecrit « 10 000 » a QUATRE endroits par langue -- meta
  // description, commentaire d'en-tete, titre du hero, encart de
  // demonstration -- soit huit copies d'un seul fait. Passer le catalogue a
  // 5 000 les aurait toutes rendues mensongeres d'un coup, et rien ne
  // l'aurait signale : c'est la forme exacte des deux chiffres perimes
  // trouves ailleurs le meme jour.
  //
  // Une seule copie desormais, injectee dans [data-total-catalogue], posee
  // juste sous CATALOGUE pour que qui change l'un voie l'autre. Elle n'est
  // pas lue de l'API : /v1/index/{cat}/stats exige une cle SERVEUR, et
  // sommer les rayons compterait double (une vis est a la fois dans
  // « visserie » et dans « fixation » -- 20 000 pour 10 000 produits).
  var TOTAL_CATALOGUE = "5 000";

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
    horsTaxes:    "excl. VAT",
    ajouter:      "Add to cart",
    ajoute:       "Added \u2713",
    aucunProduit: "No products.",
    // MESSAGE DE VITRINE, PAS DE DEVELOPPEUR (26 aout 2026). Il disait
    // « check the public key and the catalogue name in demo-boutique.js » --
    // une consigne de configuration, montree a un prospect. Le detail
    // technique reste, mais dans la console : c'est la qu'un developpeur
    // regarde, et pas un visiteur.
    catalogueKo:  "Catalogue temporarily unavailable. Search still works — " +
                  "try a reference above.",
    // `references` et `rayonVide` ont ete retires le 29 aout 2026 : le
    // compte et l'etat vide du rayon appartiennent maintenant au widget,
    // qui les rend dans les deux langues. Les garder ici aurait laisse
    // croire qu'ils servaient encore.
    rayonKo:      "This category is unavailable right now.",
    placeholder:  "Reference, dimension, standard\u2026 (e.g. M8x20, DIN 933)",
    rayons: { visserie: "Screws", boulonnerie: "Bolts", fixation: "Fixings",
              maconnerie: "Masonry", accessoires: "Accessories" }
  } : {
    rupture:      function (j) { return "Rupture — réappro sous " + j + " j"; },
    stockFaible:  function (n) { return "Plus que " + n + " en stock"; },
    enStock:      function (n) { return "En stock (" + n + ")"; },
    indisponible: "Indisponible",
    horsTaxes:    "HT",
    ajouter:      "Ajouter au panier",
    ajoute:       "Ajouté \u2713",
    aucunProduit: "Aucun produit.",
    catalogueKo:  "Catalogue momentanément indisponible. La recherche fonctionne " +
                  "toujours — essayez une référence ci-dessus.",
    rayonKo:      "Rayon indisponible pour le moment.",
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

  // Le catalogue est de la donnee : quiconque peut y deposer un produit
  // pouvait executer du script chez les visiteurs de cette page. Meme
  // fonction que celle des widgets livres (heurix-search.js,
  // heurix-browse-widget.js), recopiee ici pour la meme raison qu'eux : ce
  // fichier tient seul. Elle n'echappe PAS l'apostrophe, donc tout attribut
  // portant une donnee se double-quote -- voir data-produit ci-dessous.
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function ficheProduit(p) {
    var stock = p.stock || 0;
    var etatStock = stock === 0
      ? "<span class='rupture'>" + T.rupture(5) + "</span>"
      : (stock < 20
        ? "<span class='stock-faible'>" + T.stockFaible(stock) + "</span>"
        : "<span class='en-stock'>" + T.enStock(stock) + "</span>");

    // `price` peut manquer depuis le chantier « un prix par cle publique »
    // (29 aout) : une cle reglee price_visible:false recoit des produits
    // dont le champ a disparu. euros(undefined) rendrait « NaN € ».
    var prix = p.price != null
      ? '<div class="fiche-prix">' + euros(p.price) + " <small>" + T.horsTaxes + "</small></div>"
      : "";
    return '<div class="fiche">' +
        '<div class="fiche-ref">' + esc(p.ref || p.id) + "</div>" +
        '<div class="fiche-nom">' + esc(p.name) + "</div>" + prix +
        '<div class="fiche-stock">' + etatStock + "</div>" +
        '<button type="button" data-produit="' + esc(p.id) + '"' +
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
    //
    // `popular`, PAS `popularity` (corrigé le 29 août 2026). Le moteur
    // n'accepte que stock/recent/alphabetical/price_asc/price_desc/margin/
    // popular, et retombe SILENCIEUSEMENT sur `stock` pour tout le reste
    // (browse.py : `if sort not in SORT_STRATEGIES`). Ce bloc affichait donc
    // les produits les mieux stockés sous un commentaire qui promettait la
    // popularité -- vérifié en lisant `sort` dans la réponse, qui renvoyait
    // « stock ».
    appeler("/v1/browse/" + CATALOGUE + "/visserie?sort=popular&limit=8")
      .then(function (d) {
        afficher("populaires", (d.hits || []).map(function (h) { return h.product; }));
      })
      .catch(function (e) {
        var el = document.getElementById("populaires");
        if (el) {
          el.innerHTML = "<p class='chargement'>" + T.catalogueKo + "</p>";
          // Le detail technique va en console, pas sous les yeux du visiteur.
          if (window.console) console.error("Heurix browse:", e.message);
        }
      });
  }

  /* LA PAGE DE RAYON EST DESORMAIS LE WIDGET LIVRE (29 aout 2026).
   *
   * Ce qu'il y avait ici : un fetch, un `.map`, un compteur pose a la main,
   * un `catch`. Vingt-quatre produits sur 1 987, sans pagination et sans un
   * seul filtre -- alors que l'API sait faire les deux depuis le debut.
   *
   * Ce qui reste du marchand : `ficheProduit`, sa carte, sa charte. C'est
   * exactement la frontiere que `renderItem` trace -- le widget s'occupe de
   * l'appel, de la pagination, des facettes, du tri et de l'accessibilite ;
   * le marchand garde le HTML de sa fiche.
   *
   * `tri` en parametre d'URL n'est plus lu : le visiteur choisit lui-meme
   * dans la barre de tri. Le marchand ne perd rien -- `sort` reste le tri
   * PAR DEFAUT, et c'est la console Heurix qui decide du classement de fond.
   */
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
    document.querySelectorAll("[data-total-catalogue]").forEach(function (el) {
      el.textContent = EN ? TOTAL_CATALOGUE.replace(/\u00A0| /g, ",") : TOTAL_CATALOGUE;
    });

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
      if (window.Heurix && window.Heurix.browsePanel) {
        window.Heurix.browsePanel({
          apiKey: CLE_PUBLIQUE,
          catalog: CATALOGUE,
          category: c,
          containerId: "produits-categorie",
          // Les quatre champs que porte ce catalogue. Le widget n'en
          // connait aucun d'avance : il n'affiche que ce que l'API renvoie
          // pour le rayon consulte -- la visserie ne rend que trois
          // familles sur les huit du catalogue.
          facets: ["famille", "matiere", "diametre", "norme"],
          limit: 24,
          renderItem: function (hit) { return ficheProduit(hit.product); },
        });
      } else {
        // Le widget n'a pas ete charge : on le DIT, plutot que de laisser un
        // rayon vide sans explication.
        zone.innerHTML = "<p class='chargement'>" + T.rayonKo + "</p>";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
