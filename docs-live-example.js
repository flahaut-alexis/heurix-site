// Exemple interactif "Démarrage rapide" -- régénère la commande curl en
// temps réel quand le visiteur modifie les champs (chantier UX, 9 août
// 2026, inspiré du panneau d'attributs éditables de la doc Brevo). Ce
// n'est PAS un terminal simulé ni un vrai exécuteur de requête -- aucun
// appel réseau n'est jamais fait depuis cette page. Juste un gabarit qui
// reconstruit le texte affiché, pour rendre concret l'effet de chaque
// paramètre sans quitter la doc.
(function () {
  "use strict";

  // Meme motif de detection que docs-copy.js/console-i18n.js/guide-quiz.js.
  var LANG_EN = document.documentElement.lang === "en";
  var CLE_PLACEHOLDER = LANG_EN ? "YOUR_API_KEY" : "VOTRE_CLE_API";

  function construireCurl(catalog, query) {
    var catalogueAffiche = (catalog || "").trim() || (LANG_EN ? "mycatalog" : "moncatalogue");
    // JSON.stringify echappe correctement les guillemets/caracteres
    // speciaux si le visiteur en tape dans le champ recherche -- jamais
    // de concatenation de chaine brute pour cette partie.
    var corpsJson = JSON.stringify({ q: query || "" });
    return "curl -X POST https://api.heurix.fr/v1/index/" + catalogueAffiche + "/search \\\n" +
      "  -H \"Authorization: Bearer " + CLE_PLACEHOLDER + "\" \\\n" +
      "  -H \"Content-Type: application/json\" \\\n" +
      "  -d '" + corpsJson + "'";
  }

  function initialiser(exemple) {
    var champs = Array.prototype.slice.call(exemple.querySelectorAll(".docs-live-input"));
    var sortie = exemple.querySelector(".docs-live-output");
    if (!sortie || !champs.length) return;

    function rafraichir() {
      var valeurs = {};
      champs.forEach(function (champ) {
        valeurs[champ.getAttribute("data-field")] = champ.value;
      });
      sortie.textContent = construireCurl(valeurs.catalog, valeurs.query);
    }

    champs.forEach(function (champ) {
      champ.addEventListener("input", rafraichir);
    });
    rafraichir(); // Etat initial, avant toute frappe.
  }

  function init() {
    document.querySelectorAll(".docs-live-example").forEach(initialiser);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
