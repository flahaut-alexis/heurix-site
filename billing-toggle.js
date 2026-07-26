// Bascule mensuel / annuel sur la page de tarifs.
//
// Deux principes :
//  - La bascule ne s'affiche QUE si les trois prix annuels sont configures
//    cote Stripe (endpoint /v1/stripe/billing-options). Proposer un tarif
//    annuel qui echouerait au paiement serait pire que de ne pas le
//    proposer : l'acheteur le decouvrirait au moment de payer.
//  - On affiche l'EQUIVALENT MENSUEL, pas le total annuel, avec la mention
//    « facture X € par an ». C'est ce qui permet de comparer les formules
//    entre elles ; un total annuel force le lecteur a diviser de tete.
(function () {
  "use strict";
  var API = window.HEURIX_API_BASE || "https://api.heurix.fr";

  var TARIFS = {
    starter: { mensuel: 19, annuelParMois: 17, annuelTotal: 205 },
    growth:  { mensuel: 49, annuelParMois: 44, annuelTotal: 529 },
    scale:   { mensuel: 139, annuelParMois: 125, annuelTotal: 1501 },
  };

  var toggle = document.getElementById("billing-toggle");
  if (!toggle) return;
  var periode = "monthly";
  var browseAnnuelDispo = false;

  function appliquer() {
    Object.keys(TARIFS).forEach(function (plan) {
      var montant = document.getElementById("price-amount-" + plan);
      var note = document.getElementById("annual-note-" + plan);
      var t = TARIFS[plan];
      // HIERARCHIE INVERSEE (demande d'Alexis, 26 juillet). L'affichage
      // montrait l'equivalent mensuel en tete avec le total en mention :
      // Alexis lui-meme a cru a une remise mal appliquee (« il te manque un
      // x12 »). En mode annuel, c'est donc le TOTAL qui prime, et
      // l'equivalent mensuel qui passe en second.
      if (montant) {
        montant.textContent = periode === "annual"
          ? t.annuelTotal.toLocaleString("fr-FR")
          : t.mensuel;
      }
      // La periode suit le montant, sinon on lirait « 529 € /mois ».
      var periodeEl = montant && montant.parentElement
        ? montant.parentElement.querySelector(".price-tier-period") : null;
      if (periodeEl) periodeEl.textContent = periode === "annual" ? "/an" : "/mois";

      if (note) {
        note.hidden = periode !== "annual";
        // Le total annuel est mis en avant autant que l'equivalent mensuel :
        // afficher « 44 € » seul a deja prete a confusion, l'economie
        // realisee n'etant pas lisible.
        var economie = t.mensuel * 12 - t.annuelTotal;
        note.innerHTML = "soit <strong>" + t.annuelParMois +
          " €/mois</strong> — <strong>" + economie.toLocaleString("fr-FR") +
          " € économisés</strong> sur l'année";
      }
    });
    toggle.querySelectorAll(".billing-toggle-opt").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-period") === periode);
    });
    // Les boutons de souscription portent la periode : c'est elle que
    // l'endpoint de paiement attend.
    // L'option Ranking bascule aussi : afficher « +67 €/mois » a cote d'un
    // plan annonce a l'annee melangerait deux unites.
    var RANKING_MENSUEL = 67, RANKING_ANNUEL = Math.round(67 * 12 * 0.9);
    document.querySelectorAll("[class*='addon-amount-']").forEach(function (el) {
      el.textContent = periode === "annual"
        ? RANKING_ANNUEL.toLocaleString("fr-FR") : RANKING_MENSUEL;
    });
    document.querySelectorAll(".addon-period").forEach(function (el) {
      el.textContent = periode === "annual" ? "/an" : "/mois";
    });

    document.querySelectorAll(".checkout-btn").forEach(function (b) {
      b.setAttribute("data-billing-period", periode);
    });

    // Stripe REFUSE de melanger des periodicites dans une meme session. Si
    // les prix Browse annuels ne sont pas configures, on desactive la case
    // EN AMONT plutot que de laisser l'acheteur cliquer et recevoir une
    // erreur -- une case grisee avec son explication vaut mieux qu'un echec
    // apres coup.
    var bloquerBrowse = periode === "annual" && !browseAnnuelDispo;
    document.querySelectorAll(".browse-addon-checkbox").forEach(function (ch) {
      // La carte ENTIERE, pas seulement son en-tete : depuis la refonte de
      // l'encart, closest("label") ne renvoie que la ligne titre+prix. Griser
      // celle-ci seule laisserait la description et la remise pleinement
      // lisibles alors que l'option ne peut pas etre retenue.
      var etiquette = ch.closest(".addon-row") || ch.closest("label") || ch.parentElement;
      if (bloquerBrowse) {
        ch.checked = false;
        ch.disabled = true;
        if (etiquette) etiquette.setAttribute("title",
          "L'option Browse n'est pas encore disponible en facturation annuelle. Vous pourrez l'ajouter depuis votre console après souscription.");
        if (etiquette) etiquette.classList.add("browse-addon-disabled");
      } else {
        ch.disabled = false;
        if (etiquette) { etiquette.removeAttribute("title"); etiquette.classList.remove("browse-addon-disabled"); }
      }
    });
  }

  toggle.querySelectorAll(".billing-toggle-opt").forEach(function (btn) {
    btn.addEventListener("click", function () {
      periode = btn.getAttribute("data-period");
      appliquer();
    });
  });

  // On n'affiche la bascule qu'apres confirmation que l'annuel est vendable.
  fetch(API + "/v1/stripe/billing-options")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      browseAnnuelDispo = !!(d && d.annual_browse_available);
      if (d && d.annual_available) {
        toggle.hidden = false;
        appliquer();
      }
    })
    .catch(function () { /* bascule laissee masquee : le mensuel fonctionne */ });
})();
