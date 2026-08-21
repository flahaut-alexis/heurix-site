// Demonstration d'epinglage — pages marketing (21 aout 2026).
//
// Un GIF montre ; celui-ci laisse FAIRE. Le prospect clique une epingle,
// le classement bouge sous ses yeux, et il constate au lieu de regarder.
//
// Donnees figees plutot que tirees de l'API : cette page doit
// fonctionner sans cle, sans reseau, et donner le meme resultat a chaque
// visite. Les produits sont ceux du catalogue de demonstration.
(function () {
  "use strict";

  var liste = document.getElementById("demo-pin-liste");
  var etat = document.getElementById("demo-pin-etat");
  if (!liste || !etat) return;

  var PRODUITS = [
    { ref: "RT-77115", nom: "Vis à bois T-STAR T20 tête fraisée — Ø 4 x 20mm", marque: "SPAX", prix: "13,90 €" },
    { ref: "RT-73837", nom: "Boîte de 100 vis à bois Power-Fast FPF II", marque: "FISCHER", prix: "12,90 €" },
    { ref: "RT-77139", nom: "Vis à bois T-STAR T20 tête fraisée — Ø 4 x 25mm", marque: "SPAX", prix: "29,90 €" },
    { ref: "RT-73901", nom: "Boîte de 1000 vis à bois Power-Fast FPF II CTP", marque: "FISCHER", prix: "89,00 €" },
  ];

  // Ordre courant : indices dans PRODUITS. L'epinglage deplace en tete
  // plutot que de trier -- c'est exactement ce que fait le moteur.
  var ordre = [0, 1, 2, 3];
  var epingle = null;

  function rendre() {
    liste.innerHTML = ordre.map(function (i, rang) {
      var p = PRODUITS[i];
      var estEpingle = epingle === i;
      return '<li class="demo-pin-item' + (estEpingle ? " demo-pin-item-on" : "") + '">' +
        '<span class="demo-pin-rang">' + (rang + 1) + "</span>" +
        '<span class="demo-pin-infos">' +
          '<span class="demo-pin-nom">' + p.nom + "</span>" +
          '<span class="demo-pin-meta">' + p.marque + " · " + p.ref + " · " + p.prix + "</span>" +
        "</span>" +
        '<button type="button" class="demo-pin-btn" data-i="' + i + '" ' +
          'aria-pressed="' + (estEpingle ? "true" : "false") + '" ' +
          'aria-label="' + (estEpingle ? "Retirer l\'épingle de " : "Épingler ") + p.nom + '">' +
          "<svg width='13' height='13' viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'><path d='M9 4h6v6.8l2 3.2H7l2-3.2z'/><path d='M11 17h2v5h-2z'/></svg></button>" +
      "</li>";
    }).join("");
  }

  liste.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-i]");
    if (!btn) return;
    var i = parseInt(btn.getAttribute("data-i"), 10);

    if (epingle === i) {
      // Second clic : on retire l'epingle et l'ordre d'origine revient.
      // Montrer que c'est REVERSIBLE compte autant que l'effet lui-meme.
      epingle = null;
      ordre = [0, 1, 2, 3];
      etat.textContent = "Épingle retirée : le moteur reprend son classement.";
    } else {
      epingle = i;
      ordre = [i].concat([0, 1, 2, 3].filter(function (x) { return x !== i; }));
      etat.innerHTML = "<strong>" + PRODUITS[i].marque + " " + PRODUITS[i].ref +
        "</strong> est désormais premier sur « vis à bois ». Dans la console, cette règle se publie en un clic.";
    }
    rendre();
  });

  rendre();
})();
