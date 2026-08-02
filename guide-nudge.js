// Heurix — rappel flottant vers le guide de mise en route, sur la page
// tarifs specifiquement (element de reassurance : "vous ne saurez pas
// par ou commencer ? voici le guide complet"). Meme comportement que
// pricing-nudge.js : discret, apres un peu de defilement, refermable.
(function () {
  "use strict";
  var el = document.getElementById("guide-nudge");
  if (!el) return;

  if (sessionStorage.getItem("heurix_guide_nudge_dismissed") === "1") return;

  // CORRECTIF (2 aout, audit UX point 3) : la carte et le bandeau de
  // consentement sont tous deux en position:fixed pres du bas de l'ecran.
  // Sur mobile, le bandeau (z-index:500, largeur pleine) recouvre
  // physiquement le bouton de fermeture de la carte (z-index:55) --
  // un clic reel dessus atteignait le bouton du bandeau de consentement,
  // pas celui de la carte. Le gestionnaire de clic n'a jamais ete en
  // cause (confirme : un .click() JS direct fonctionnait deja). Plutot
  // que de jouer avec les z-index (le bandeau de consentement doit
  // rester prioritaire, c'est un point de conformite CNIL), la carte
  // n'apparait desormais jamais tant que le bandeau est encore present.
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
    if (window.scrollY > window.innerHeight * 0.5) {
      pretAAfficher = true;
      tenterAffichage();
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  // Si le bandeau de consentement est present au moment du seuil de
  // scroll, on observe sa disparition (l'utilisateur fait son choix)
  // plutot que de re-verifier en boucle.
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
      sessionStorage.setItem("heurix_guide_nudge_dismissed", "1");
    });
  }
})();
