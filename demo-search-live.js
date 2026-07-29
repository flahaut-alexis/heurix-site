/* Démonstration de la page d'accueil — branchée sur le VRAI moteur.
 *
 * POURQUOI CE REMPLACEMENT. La version précédente réimplémentait le moteur
 * en JavaScript : 1 129 lignes de normalisation, distance de
 * Damerau-Levenshtein, cascade de règles et scoring.
 *
 * Elle avait déjà divergé. Aucun correctif de la semaine du 28 juillet n'y
 * figurait : ni le « × » typographique, ni « M8-20 », ni la virgule décimale
 * de « 2,5mm² ». Concrètement, la démonstration ne faisait pas ce que le
 * moteur fait — un prospect tapant « M8×20 » y échouait alors que le vrai
 * moteur trouve.
 *
 * Une démonstration qui montre une version périmée du produit est pire
 * qu'absente : elle prouve le contraire de ce qu'on veut prouver.
 *
 * CE FICHIER NE CONTIENT PLUS AUCUNE LOGIQUE DE MOTEUR. Il appelle l'API,
 * affiche ce qu'elle renvoie. Chaque correctif moteur profite désormais
 * immédiatement à la démonstration.
 *
 * AUCUNE CLÉ N'EST NÉCESSAIRE. Le moteur expose `/v1/public-demo/search`,
 * sans authentification, restreint au catalogue « public-demo » et en
 * lecture seule. La limitation de débit est appliquée côté serveur.
 *
 * C'est la bonne porte : exposer une clé publique dans la page d'accueil
 * aurait demandé une gestion de domaines autorisés et un quota à surveiller,
 * pour un usage qui ne le justifie pas.
 */
(function () {
  "use strict";

  var API = "https://api.heurix.fr";


  var racine = document.querySelector(".play");
  if (!racine) return;

  var champ = racine.querySelector(".play-input");
  var grille = racine.querySelector(".play-grid");
  var meta = racine.querySelector(".play-meta");
  var zonePrismes = racine.querySelector(".play-prisms");
  if (!champ || !grille) return;


  var minuteur = null;
  var derniereRequete = 0;
  var prismeActif = null;

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function euros(n) {
    return n === undefined || n === null
      ? "" : Number(n).toFixed(2).replace(".", ",") + " €";
  }

  function fiche(hit) {
    var p = hit.product || {};
    var etat = hit.in_stock === false
      ? "<span class='play-rupture'>Rupture</span>"
      : "<span class='play-stock'>En stock</span>";
    // LES ANNOTATIONS SONT AFFICHÉES. C'est ce qui distingue Heurix d'une
    // recherche par mots-clés : montrer que le moteur a compris « M8 » comme
    // un diamètre vaut mieux que l'expliquer.
    var etiquettes = (hit.matched || [])
      .filter(function (m) { return m.indexOf("annotation #") === 0; })
      .map(function (m) { return m.replace("annotation #", ""); })
      .slice(0, 4);
    return "<article class='play-card'>" +
      "<div class='play-card-name'>" + esc(p.name || p.id) + "</div>" +
      (p.ref ? "<div class='play-card-ref'>" + esc(p.ref) + "</div>" : "") +
      "<div class='play-card-foot'>" +
        (p.price !== undefined ? "<span class='play-card-price'>" + euros(p.price) + "</span>" : "") +
        etat +
      "</div>" +
      (etiquettes.length
        ? "<div class='play-card-tags'>" + etiquettes.map(function (t) {
            return "<span>" + esc(t) + "</span>";
          }).join("") + "</div>"
        : "") +
    "</article>";
  }

  function afficher(donnees, requete) {
    var hits = donnees.hits || [];
    if (!hits.length) {
      grille.innerHTML = "<p class='play-vide'>Aucun résultat pour « " +
                         esc(requete) + " ».</p>";
      if (meta) meta.textContent = "";
      return;
    }
    grille.innerHTML = hits.slice(0, 9).map(fiche).join("");

    if (meta) {
      var bouts = [donnees.total.toLocaleString("fr-FR") + " résultats"];
      // Le filtre de prix reconnu est un argument à lui seul : « moins de
      // 5 euros » compris comme une contrainte, pas comme des mots-clés.
      if (donnees.price_filter) {
        var f = donnees.price_filter;
        bouts.push(f.max !== null && f.min !== null
          ? "filtre : entre " + euros(f.min) + " et " + euros(f.max)
          : f.max !== null ? "filtre : moins de " + euros(f.max)
          : "filtre : plus de " + euros(f.min));
      }
      meta.textContent = bouts.join(" · ");
    }

    // Les facettes deviennent des prismes cliquables — le vocabulaire de la
    // page d'accueil, conservé.
    if (zonePrismes && donnees.facets) {
      var prismes = [];
      Object.keys(donnees.facets).forEach(function (champFacette) {
        (donnees.facets[champFacette] || []).slice(0, 5).forEach(function (v) {
          prismes.push({ champ: champFacette, valeur: v.value, n: v.count });
        });
      });
      zonePrismes.innerHTML = prismes.slice(0, 8).map(function (p) {
        var actif = prismeActif && prismeActif.valeur === p.valeur;
        return "<button type='button' class='play-prism" + (actif ? " play-prism-on" : "") +
               "' data-champ='" + esc(p.champ) + "' data-valeur='" + esc(p.valeur) + "'>" +
               esc(p.valeur) + " <em>" + p.n + "</em></button>";
      }).join("");
      zonePrismes.querySelectorAll(".play-prism").forEach(function (b) {
        b.addEventListener("click", function () {
          var v = b.getAttribute("data-valeur");
          prismeActif = (prismeActif && prismeActif.valeur === v)
            ? null
            : { champ: b.getAttribute("data-champ"), valeur: v };
          chercher(champ.value);
        });
      });
    }
  }

  function chercher(requete) {
    requete = (requete || "").trim();
    if (!requete) {
      grille.innerHTML = "";
      if (meta) meta.textContent = "";
      if (zonePrismes) zonePrismes.innerHTML = "";
      return;
    }

    var id = ++derniereRequete;
    var corps = {
      q: requete,
      limit: 9,
      facets: ["categories", "marque"],
    };
    if (prismeActif) {
      corps.filters = [{ field: prismeActif.champ, value: prismeActif.valeur }];
    }

    fetch(API + "/v1/public-demo/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        if (id !== derniereRequete) return;   // une frappe plus récente est partie
        afficher(d, requete);
      })
      .catch(function (e) {
        if (id !== derniereRequete) return;
        // Un 429 signifie que le visiteur tape très vite : la limitation de
        // débit du serveur a mordu. On le distingue d'une vraie panne.
        if (String(e.message).indexOf("429") !== -1) {
          grille.innerHTML = "<p class='play-vide'>Trop de recherches d'affilée — " +
                             "patientez une seconde.</p>";
          return;
        }
        // MESSAGE HONNÊTE. Un écran vide laisserait croire à un produit
        // cassé ; dire que la démonstration est indisponible préserve la
        // crédibilité du moteur.
        grille.innerHTML = "<p class='play-vide'>Démonstration momentanément " +
                           "indisponible. Le moteur reste joignable par API.</p>";
        if (meta) meta.textContent = "";
      });
  }

  champ.addEventListener("input", function () {
    clearTimeout(minuteur);
    minuteur = setTimeout(function () { chercher(champ.value); }, 220);
  });

  // Les suggestions de la page d'accueil restent cliquables.
  racine.querySelectorAll(".play-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      champ.value = chip.textContent.trim();
      prismeActif = null;
      chercher(champ.value);
    });
  });
})();
