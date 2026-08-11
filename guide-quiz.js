// Guide de mise en route — questionnaire de parcours.
// Source unique FR/EN (chantier S4, 5 août 2026) — fusion de guide-quiz.js
// et guide-quiz-en.js, qui ne différaient que sur UNE comparaison littérale
// ("non" vs "no", ligne ~35 ci-dessous) et le texte du récapitulatif. La
// langue est lue sur document.documentElement.lang, même motif déjà en
// place dans console-i18n.js.
//
// Masquage PUREMENT VISUEL via une classe CSS : aucun retrait du DOM, aucune
// injection de contenu. Un robot d'indexation lit l'integralite du guide
// quelles que soient les reponses — c'est une contrainte de referencement
// assumee, ce guide etant un actif SEO.
//
// Etat initial : tout est visible. Le questionnaire ne fait que RESTREINDRE
// sur demande, il ne cache rien par defaut. Un visiteur qui ne repond pas
// voit donc le guide complet, comme avant.
(function () {
  "use strict";
  var quiz = document.getElementById("guide-quiz");
  if (!quiz) return;

  var LANG_EN = document.documentElement.lang === "en";
  // Les DEUX graphies possibles pour "non" -- le DOM porte "non" sur les
  // pages FR et "no" sur les pages EN (valeur de l'attribut data-value des
  // boutons), donc CE script, partagé par les deux langues, doit reconnaître
  // les deux plutôt que de supposer laquelle est en jeu.
  var EST_NON = { non: true, no: true };

  var reponses = {};                       // { tracker: "oui"/"yes", mcp: "non"/"no", ... }
  var recap = document.getElementById("guide-quiz-recap");
  var modules = Array.prototype.slice.call(document.querySelectorAll(".guide-module"));

  function appliquer() {
    var actifs = 0;
    modules.forEach(function (mod) {
      var nom = mod.getAttribute("data-module");
      var rep = reponses[nom];

      // Le module front-end ne se masque JAMAIS sur un « non ». Contrairement
      // aux deux autres questions, « non » y signifie « je n'ai pas encore
      // d'interface de recherche » -- le module est alors PLUS utile, pas
      // moins. Seule la variante affichee change.
      var masque = (nom !== "frontend") && !!EST_NON[rep];
      mod.classList.toggle("masque", masque);
      if (!masque) actifs++;

      mod.querySelectorAll("[data-frontend]").forEach(function (bloc) {
        var v = bloc.getAttribute("data-frontend");
        bloc.classList.toggle("masque", rep !== undefined && rep !== v);
      });
    });

    if (Object.keys(reponses).length) {
      recap.hidden = false;
      recap.textContent = (LANG_EN ? "Your path: 3 required steps + " : "Votre parcours : 3 étapes obligatoires + ") +
        actifs + (actifs > 1 ? " modules" : " module");
    }
  }

  quiz.querySelectorAll(".guide-quiz-opts").forEach(function (groupe) {
    var question = groupe.getAttribute("data-question");
    groupe.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        groupe.querySelectorAll("button").forEach(function (b) {
          b.classList.remove("on");
          b.setAttribute("aria-pressed", "false"); // accessibilite (audit du 10 aout) -- le style visuel .on existait deja, seul l'etat lecteur d'ecran manquait
        });
        btn.classList.add("on");
        btn.setAttribute("aria-pressed", "true");
        // Sur la question front-end, "oui"/"yes" signifie « j'ai deja une
        // interface » : le module reste utile, seule la variante change.
        reponses[question] = btn.getAttribute("data-value");
        appliquer();
      });
    });
  });

  var tout = document.getElementById("guide-quiz-tout");
  if (tout) {
    tout.addEventListener("click", function () {
      reponses = {};
      quiz.querySelectorAll(".guide-quiz-opts button").forEach(function (b) {
        b.classList.remove("on");
        b.setAttribute("aria-pressed", "false");
      });
      document.querySelectorAll(".masque").forEach(function (e) { e.classList.remove("masque"); });
      recap.hidden = true;
    });
  }
})();
