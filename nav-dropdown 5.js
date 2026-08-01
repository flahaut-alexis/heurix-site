// Menu deroulant du site. Ouverture au clic (pas au survol : inutilisable au
// doigt), fermeture par Echap ou clic a l'exterieur, aria-expanded tenu a jour
// pour les lecteurs d'ecran.
(function () {
  "use strict";
  var boutons = Array.prototype.slice.call(document.querySelectorAll(".nav-drop-btn"));
  if (!boutons.length) return;

  function fermerTout(sauf) {
    boutons.forEach(function (b) {
      if (b === sauf) return;
      b.setAttribute("aria-expanded", "false");
      var p = b.nextElementSibling;
      if (p) p.classList.remove("open");
    });
  }

  boutons.forEach(function (btn) {
    var panneau = btn.nextElementSibling;
    if (!panneau) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var ouvert = btn.getAttribute("aria-expanded") === "true";
      fermerTout(btn);
      btn.setAttribute("aria-expanded", ouvert ? "false" : "true");
      panneau.classList.toggle("open", !ouvert);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") fermerTout(null);
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav-drop")) fermerTout(null);
  });
})();
