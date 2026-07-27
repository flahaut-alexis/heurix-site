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
    ? { soit: "that is", economises: "saved", surLAnnee: "per year",
        dont: "of which Ranking", facture: "Billed" }
    : { soit: "soit", economises: "économisés", surLAnnee: "sur l'année",
        dont: "dont Ranking", facture: "Facturé" };

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

      // HIÉRARCHIE INVERSÉE (validée par Alexis le 27 juillet).
      //
      // En annuel, c'est le prix MENSUEL ÉQUIVALENT qui domine, avec le plein
      // tarif barré à côté et l'économie en pastille. Le total réellement
      // débité passe en mention secondaire.
      //
      // POURQUOI LE PRIX BARRÉ EST INDISPENSABLE, et non optionnel : afficher
      // « 44 €/mois » seul ne montre aucune réduction. Alexis lui-même avait
      // cru à une remise mal appliquée devant cet affichage — « il te manque
      // un ×12 ». Le barré rend l'économie visible sans calcul mental.
      var montant = document.getElementById("price-amount-" + plan);
      var plein = document.getElementById("prix-plein-" + plan);
      var eco = document.getElementById("prix-eco-" + plan);
      var facture = document.getElementById("prix-facture-" + plan);
      var periodeEl = montant && montant.parentElement
        ? montant.parentElement.querySelector(".price-tier-period") : null;

      if (estAnnuel) {
        var mensuelEquivalent = Math.round((base + option) / 12);
        var pleinTarif = PLANS[plan] + (option ? optionMensuelle() : 0);
        var economieAnnuelle = pleinTarif * 12 - (base + option);

        ecrire(montant, euros(mensuelEquivalent));
        if (periodeEl) periodeEl.textContent = PAR_MOIS;

        // Le plein tarif ne s'affiche que s'il diffère : un barré identique
        // au prix serait absurde.
        if (plein) {
          plein.hidden = pleinTarif <= mensuelEquivalent;
          plein.innerHTML = euros(pleinTarif) + "&nbsp;€";
        }
        if (eco) {
          eco.hidden = economieAnnuelle <= 0;
          eco.textContent = "−" + euros(economieAnnuelle) + " €" + PAR_AN;
        }
        // MENTION LISIBLE, PAS EFFACÉE : c'est le montant réellement débité.
        // Le réduire à du gris fin frôlerait la zone où un client découvre la
        // somme au moment du paiement.
        if (facture) {
          facture.hidden = false;
          facture.textContent = TXT.facture + " " + euros(base + option) + " €" + PAR_AN;
        }
      } else {
        // MENSUEL NU. Le barré et la pastille signalent une économie ; en
        // mensuel il n'y en a aucune. Le contraste entre les deux modes est
        // précisément ce qui démontre l'intérêt de l'annuel.
        ecrire(montant, euros(base + option));
        if (periodeEl) periodeEl.textContent = PAR_MOIS;
        if (plein) plein.hidden = true;
        if (eco) eco.hidden = true;
        if (facture) facture.hidden = true;
      }

      var detail = document.getElementById("addon-breakdown-" + plan);
      if (detail) {
        detail.hidden = option === 0;
        if (option > 0) {
          detail.innerHTML = TXT.dont + " : <strong>" + euros(option) +
            "&nbsp;€" + (estAnnuel ? PAR_AN : PAR_MOIS) + "</strong>";
        }
      }

      // L'ancienne phrase combinée est supprimée au profit des trois
      // éléments distincts ci-dessus.
      var note = document.getElementById("annual-note-" + plan);
      if (note) note.hidden = true;
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
