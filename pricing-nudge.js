// Heurix — rappel flottant vers la page tarifs, discret, après un peu de défilement.
(function () {
  "use strict";
  var el = document.getElementById("pricing-nudge");
  if (!el) return;

  if (sessionStorage.getItem("heurix_nudge_dismissed") === "1") return;

  var shown = false;
  function onScroll() {
    if (shown) return;
    if (window.scrollY > window.innerHeight * 0.8) {
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
      sessionStorage.setItem("heurix_nudge_dismissed", "1");
    });
  }
})();
