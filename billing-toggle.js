// Tarification de la page de prix : bascule mensuel/annuel et option Ranking.
//
// SOURCE UNIQUE DE VÉRITÉ. Deux scripts écrivaient auparavant le même
// élément de prix : celui-ci, qui connaît la période de facturation, et un
// gestionnaire en ligne dans pricing.html qui l'ignorait. Résultat, cocher
// Ranking sur Growth en annuel affichait 49 + 67 = 116 € au lieu de 529 €,
// et le décocher retombait à 49 €. Le gestionnaire fautif a été retiré ;
// tout le calcul se fait ici.
(function () {
  "use strict";
  var API = window.HEURIX_API_BASE || "https://api.heurix.fr";

  // Tous les tarifs en un seul endroit. Les dupliquer ailleurs — attributs
  // data, texte en dur — recréerait la divergence qui a causé le bug.
  var REMISE_ANNUELLE = 0.10;   // −10 % sur douze mensualités
  var REMISE_OPTION = 0.25;     // −25 % sur Ranking pris avec un plan

  var PLANS = { starter: 19, growth: 49, scale: 139 };
  var RANKING_AUTONOME = 89;    // €/mois seul ; 67 € en option

  function annuel(m) { return Math.round(m * 12 * (1 - REMISE_ANNUELLE)); }
  function optionMensuelle() { return Math.round(RANKING_AUTONOME * (1 - REMISE_OPTION)); }
  function optionAnnuelle() { return annuel(optionMensuelle()); }
  function euros(n) { return n.toLocaleString("fr-FR"); }

  // Suffixes selon la langue de la page : ils etaient codes en dur, et la
  // page anglaise affichait « 529 EUR/an ».
  var EN = (document.documentElement.lang || "fr").slice(0, 2).toLowerCase() === "en";
  var PAR_MOIS = EN ? "/month" : "/mois";
  var PAR_AN = EN ? "/year" : "/an";
  var TXT = EN
    ? { soit: "that is", economises: "saved", surLAnnee: "per year", dont: "of which Ranking" }
    : { soit: "soit", economises: "économisés", surLAnnee: "sur l'année", dont: "dont Ranking" };

  var toggle = document.getElementById("billing-toggle");
  if (!toggle) return;
  var periode = "monthly";
  var browseAnnuelDispo = false;

  // Transition douce : un montant qui saute sans transition donne
  // l'impression d'un défaut d'affichage, là où une brève atténuation
  // accompagne le calcul.
  function ecrire(el, valeur) {
    if (!el || el.textContent === String(valeur)) return;
    el.classList.add("prix-en-transition");
    setTimeout(function () {
      el.textContent = valeur;
      el.classList.remove("prix-en-transition");
    }, 110);
  }

  function rankingActif(plan) {
    var ch = document.getElementById("browse-toggle-" + plan);
    return !!(ch && ch.checked && !ch.disabled);
  }

  function appliquer() {
    var estAnnuel = periode === "annual";

    Object.keys(PLANS).forEach(function (plan) {
      var base = estAnnuel ? annuel(PLANS[plan]) : PLANS[plan];
      var option = rankingActif(plan)
        ? (estAnnuel ? optionAnnuelle() : optionMensuelle()) : 0;

      var montant = document.getElementById("price-amount-" + plan);
      ecrire(montant, euros(base + option));

      var periodeEl = montant && montant.parentElement
        ? montant.parentElement.querySelector(".price-tier-period") : null;
      if (periodeEl) periodeEl.textContent = estAnnuel ? PAR_AN : PAR_MOIS;

      // DÉCOMPOSITION plutôt que remplacement silencieux : le lecteur doit
      // voir ce qui compose le total, sinon il constate un chiffre qui a
      // changé sans savoir pourquoi.
      var detail = document.getElementById("addon-breakdown-" + plan);
      if (detail) {
        detail.hidden = option === 0;
        if (option > 0) {
          detail.innerHTML = TXT.dont + " : <strong>" + euros(option) +
            "&nbsp;€" + (estAnnuel ? PAR_AN : PAR_MOIS) + "</strong>";
        }
      }

      var note = document.getElementById("annual-note-" + plan);
      if (note) {
        note.hidden = !estAnnuel;
        if (estAnnuel) {
          var totalMensuel = PLANS[plan] + (option ? optionMensuelle() : 0);
          var economie = totalMensuel * 12 - (base + option);
          note.innerHTML = TXT.soit + " <strong>" + euros(Math.round((base + option) / 12)) +
            "&nbsp;€" + PAR_MOIS + "</strong> — <strong>" + euros(economie) +
            "&nbsp;€ " + TXT.economises + "</strong> " + TXT.surLAnnee;
        }
      }
    });

    // Prix de l'option : référence barrée, prix remisé, économie — même
    // traitement que la bascule annuelle, pour que le lecteur reconnaisse
    // le signal au lieu d'une pastille « −25 % » isolée.
    var ref = estAnnuel ? annuel(RANKING_AUTONOME) : RANKING_AUTONOME;
    var net = estAnnuel ? optionAnnuelle() : optionMensuelle();
    var unite = estAnnuel ? PAR_AN : PAR_MOIS;
    document.querySelectorAll("[data-addon-pricing]").forEach(function (zone) {
      zone.innerHTML =
        "<s class='addon-ref'>" + euros(ref) + "&nbsp;€" + unite + "</s>" +
        "<strong class='addon-net'>" + euros(net) + "&nbsp;€" + unite + "</strong>" +
        "<span class='addon-eco'>" + euros(ref - net) + "&nbsp;€ " + TXT.economises + "</span>";
    });

    toggle.querySelectorAll(".billing-toggle-opt").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-period") === periode);
    });
    document.querySelectorAll(".checkout-btn").forEach(function (b) {
      b.setAttribute("data-billing-period", periode);
    });

    // Stripe refuse de mélanger des périodicités dans une même session : si
    // les prix Ranking annuels ne sont pas configurés, on désactive l'option
    // en amont plutôt que de laisser l'acheteur recevoir une erreur.
    var bloquer = estAnnuel && !browseAnnuelDispo;
    document.querySelectorAll(".browse-addon-checkbox").forEach(function (ch) {
      var ligne = ch.closest(".addon-row") || ch.parentElement;
      if (bloquer) {
        ch.checked = false;
        ch.disabled = true;
        if (ligne) {
          ligne.classList.add("browse-addon-disabled");
          ligne.setAttribute("title",
            "L'option Ranking n'est pas encore disponible en facturation annuelle. " +
            "Vous pourrez l'ajouter depuis votre console après souscription.");
        }
      } else {
        ch.disabled = false;
        if (ligne) { ligne.classList.remove("browse-addon-disabled"); ligne.removeAttribute("title"); }
      }
    });
  }

  toggle.querySelectorAll(".billing-toggle-opt").forEach(function (btn) {
    btn.addEventListener("click", function () {
      periode = btn.getAttribute("data-period");
      appliquer();
    });
  });

  document.querySelectorAll(".browse-addon-checkbox").forEach(function (ch) {
    ch.addEventListener("change", appliquer);
  });

  appliquer();  // état initial cohérent, sans attendre le réseau

  fetch(API + "/v1/stripe/billing-options")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      browseAnnuelDispo = !!(d && d.annual_browse_available);
      if (d && d.annual_available) toggle.hidden = false;
      appliquer();
    })
    .catch(function () { /* bascule masquée : le mensuel fonctionne */ });
})();
