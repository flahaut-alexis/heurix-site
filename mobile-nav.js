// Heurix — bascule du menu mobile (icône hamburger).
// Cible .nav-links depuis la fusion des deux bandeaux en un seul :
// .header-nav-row n existe plus.
(function () {
  "use strict";
  var btn = document.getElementById("mobile-nav-toggle");
  var navRow = document.querySelector(".nav-links");
  if (!btn || !navRow) return;

  // FOND SEMI-OPAQUE (2 août, audit UX point 4) : .nav-links est en
  // position:absolute, hauteur calée sur son contenu, sans jamais rien
  // derrière -- le contenu de la page reste visible ET cliquable sous
  // les liens du menu ouvert. Créé en JS plutôt qu'ajouté à chaque page
  // HTML : ce script est déjà partagé, un seul endroit à maintenir.
  var fond = document.createElement("div");
  fond.className = "nav-mobile-fond";
  fond.setAttribute("aria-hidden", "true");
  document.body.appendChild(fond);

  function close() {
    navRow.classList.remove("mobile-open");
    btn.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    fond.classList.remove("visible");
  }

  btn.addEventListener("click", function () {
    var open = navRow.classList.toggle("mobile-open");
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    fond.classList.toggle("visible", open);
  });

  // Ferme le menu au clic en dehors (sur le fond lui-même).
  fond.addEventListener("click", close);

  // Ferme le menu si on clique un lien (navigation vers une nouvelle page ou une ancre)
  navRow.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", close);
  });

  // Ferme le menu si l'écran repasse en largeur desktop (rotation, redimensionnement)
  window.addEventListener("resize", function () {
    if (window.innerWidth > 1080) close();
  });
})();
