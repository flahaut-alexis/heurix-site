// Heurix — bascule du menu mobile (icône hamburger)
(function () {
  "use strict";
  var btn = document.getElementById("mobile-nav-toggle");
  var navRow = document.querySelector(".header-nav-row");
  if (!btn || !navRow) return;

  function close() {
    navRow.classList.remove("mobile-open");
    btn.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", function () {
    var open = navRow.classList.toggle("mobile-open");
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // Ferme le menu si on clique un lien (navigation vers une nouvelle page ou une ancre)
  navRow.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", close);
  });

  // Ferme le menu si l'écran repasse en largeur desktop (rotation, redimensionnement)
  window.addEventListener("resize", function () {
    if (window.innerWidth > 760) close();
  });
})();
