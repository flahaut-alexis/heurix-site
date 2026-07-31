// Getting started guide — journey questionnaire.
//
// English variant of guide-quiz.js — same logic, translated recap text
// and "yes"/"no" values instead of "oui"/"non", kept consistent with the
// English markup rather than leaving French data-attributes in an EN page.
//
// PURELY VISUAL hiding via a CSS class: no DOM removal, no content
// injection. A crawler reads the entire guide regardless of any answers
// — an intentional SEO constraint, since this guide is an SEO asset.
//
// Initial state: everything is visible. The questionnaire only NARROWS on
// request, it hides nothing by default. A visitor who doesn't answer
// sees the full guide, same as before.
(function () {
  "use strict";
  var quiz = document.getElementById("guide-quiz");
  if (!quiz) return;

  var reponses = {};                       // { tracker: "yes", mcp: "no", ... }
  var recap = document.getElementById("guide-quiz-recap");
  var modules = Array.prototype.slice.call(document.querySelectorAll(".guide-module"));

  function appliquer() {
    var actifs = 0;
    modules.forEach(function (mod) {
      var nom = mod.getAttribute("data-module");
      var rep = reponses[nom];

      // The front-end module is NEVER hidden on a "no". Unlike the other
      // two questions, "no" here means "I don't have a search interface
      // yet" — the module is then MORE useful, not less. Only the
      // displayed variant changes.
      var masque = (nom !== "frontend") && rep === "no";
      mod.classList.toggle("masque", masque);
      if (!masque) actifs++;

      mod.querySelectorAll("[data-frontend]").forEach(function (bloc) {
        var v = bloc.getAttribute("data-frontend");
        bloc.classList.toggle("masque", rep !== undefined && rep !== v);
      });
    });

    if (Object.keys(reponses).length) {
      recap.hidden = false;
      recap.textContent = "Your path: 3 required steps + " + actifs +
        (actifs > 1 ? " modules" : " module");
    }
  }

  quiz.querySelectorAll(".guide-quiz-opts").forEach(function (groupe) {
    var question = groupe.getAttribute("data-question");
    groupe.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        groupe.querySelectorAll("button").forEach(function (b) { b.classList.remove("on"); });
        btn.classList.add("on");
        // On the front-end question, "yes" means "I already have an
        // interface": the module stays useful, only the variant changes.
        reponses[question] = btn.getAttribute("data-value");
        appliquer();
      });
    });
  });

  var tout = document.getElementById("guide-quiz-tout");
  if (tout) {
    tout.addEventListener("click", function () {
      reponses = {};
      quiz.querySelectorAll(".guide-quiz-opts button").forEach(function (b) { b.classList.remove("on"); });
      document.querySelectorAll(".masque").forEach(function (e) { e.classList.remove("masque"); });
      recap.hidden = true;
    });
  }
})();
