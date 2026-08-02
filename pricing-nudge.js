// Heurix — rappel flottant vers la page tarifs, discret, après un peu de défilement.
(function () {
  "use strict";
  var el = document.getElementById("pricing-nudge");
  if (!el) return;

  if (sessionStorage.getItem("heurix_nudge_dismissed") === "1") return;

  // CORRECTIF (2 août, audit UX point 3) : même correctif que
  // guide-nudge.js -- la carte n'apparaît jamais tant que le bandeau de
  // consentement est encore présent, pour éviter qu'il ne recouvre le
  // bouton de fermeture sur mobile. Voir guide-nudge.js pour le
  // raisonnement complet.
  function bandeauConsentementPresent() {
    return !!document.querySelector(".consent-fond");
  }

  var shown = false;
  var pretAAfficher = false;
  function tenterAffichage() {
    if (shown || !pretAAfficher || bandeauConsentementPresent()) return;
    shown = true;
    el.classList.add("visible");
    window.removeEventListener("scroll", onScroll);
  }
  function onScroll() {
    if (window.scrollY > window.innerHeight * 0.8) {
      pretAAfficher = true;
      tenterAffichage();
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  if (document.body) {
    var observateur = new MutationObserver(function () {
      if (pretAAfficher && !bandeauConsentementPresent()) {
        tenterAffichage();
        observateur.disconnect();
      }
    });
    observateur.observe(document.body, { childList: true });
  }

  var closeBtn = el.querySelector(".pricing-nudge-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      el.classList.remove("visible");
      sessionStorage.setItem("heurix_nudge_dismissed", "1");
    });
  }
})();
