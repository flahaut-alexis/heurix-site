// Heurix — rappel flottant vers le guide de mise en route, sur la page
// tarifs specifiquement (element de reassurance : "vous ne saurez pas
// par ou commencer ? voici le guide complet"). Meme comportement que
// pricing-nudge.js : discret, apres un peu de defilement, refermable.
(function () {
  "use strict";
  var el = document.getElementById("guide-nudge");
  if (!el) return;

  if (sessionStorage.getItem("heurix_guide_nudge_dismissed") === "1") return;

  var shown = false;
  function onScroll() {
    if (shown) return;
    if (window.scrollY > window.innerHeight * 0.5) {
      shown = true;
      el.classList.add("visible");
      window.removeEventListener("scroll", onScroll);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  var closeBtn = el.querySelector(".pricing-nudge-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      el.classList.remove("visible");
      sessionStorage.setItem("heurix_guide_nudge_dismissed", "1");
    });
  }
})();
