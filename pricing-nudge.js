// Heurix — rappel flottant vers l'inscription à l'essai gratuit, discret, après un peu de défilement.
//
// LE NOM EST RESTÉ, LA CIBLE A CHANGÉ (18 septembre 2026). Le rappel menait à
// pricing.html sous « Essai gratuit 14 jours, sans carte bancaire » ; or les
// cartes des tarifs exigent un moyen de paiement. Son bouton mène désormais à
// console.html?inscription. Les tarifs restent atteignables par l'en-tête et le
// pied (797e8d93). Le fichier, l'id et les classes gardent « pricing » : les
// renommer toucherait 136 pages et la feuille de style pour un nom seulement.
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
