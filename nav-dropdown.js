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

  // ECHAP REND LE FOCUS AU BOUTON (30 aout 2026). Il refermait sans le rendre :
  // le focus restait sur le lien du panneau disparu, donc sur un element qui
  // n'est plus visible, et la tabulation suivante repartait d'un endroit que
  // l'utilisateur ne voit pas.
  //
  // MESURE HONNETE, ET C'EST LA LECON. Un premier controle avait conclu « le
  // focus est rendu » -- il posait le focus sur le bouton AVANT d'envoyer
  // Echap, puis verifiait qu'il y etait. Il ne testait que sa propre mise en
  // scene. Le controle juste part d'un lien DANS le panneau.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var ouvert = boutons.filter(function (b) {
      return b.getAttribute("aria-expanded") === "true";
    })[0];
    fermerTout(null);
    if (ouvert) ouvert.focus();
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav-drop")) fermerTout(null);
  });

  // FERMETURE QUAND LE FOCUS SORT DE LA NAVIGATION -- l'ajout assume du
  // rapport. L'existant laissait le panneau ouvert dans ce cas : on tabulait
  // jusqu'a la recherche et le menu restait deploye derriere.
  //
  // `focusout` monte, contrairement a `blur`. Le `setTimeout(0)` laisse le
  // navigateur poser le nouveau focus avant qu'on le lise : dans le
  // gestionnaire, `document.activeElement` vaut encore <body>.
  document.addEventListener("focusout", function (e) {
    var depart = e.target.closest(".nav-drop");
    if (!depart) return;
    setTimeout(function () {
      var a = document.activeElement;
      if (!a || !a.closest || !a.closest(".nav-drop")) fermerTout(null);
    }, 0);
  });
})();
