// Bouton « Copier » sur les blocs de code de la documentation.
// Audit UX 3.1 : les 32 blocs de docs.html n'offraient aucun moyen de copie,
// obligeant à une sélection manuelle — avec le risque d'emporter une partie
// du bloc ou d'en oublier une ligne. Pour l'audience développeur, c'est une
// friction directe à l'intégration.
//
// DÉLÉGATION D'ÉVÉNEMENT, pas 32 écouteurs : d'autres blocs seront ajoutés à
// la documentation, ils doivent fonctionner sans code supplémentaire.
(function () {
  "use strict";

  // LANG_EN (5 août 2026, découvert pendant le chantier TOC) : ce script
  // n'était chargé que sur la page FR — jamais sur en/docs.html. Corrigé au
  // passage ; le texte est maintenant paramétré pour fonctionner des deux
  // côtés, même motif que console-i18n.js et guide-quiz.js.
  var LANG_EN = document.documentElement.lang === "en";
  var TXT = LANG_EN ? {
    ariaLabel: "Copy code example",
    copier: "Copy",
    copie: "Copied",
    repli: "Select then Cmd+C",
  } : {
    ariaLabel: "Copier l'exemple de code",
    copier: "Copier",
    copie: "Copié",
    repli: "Sélectionnez puis Cmd+C",
  };

  var ICONE_COPIE =
    "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' " +
    "stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" +
    "<rect x='9' y='9' width='13' height='13' rx='2'/>" +
    "<path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/></svg>";
  var ICONE_OK =
    "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' " +
    "stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" +
    "<path d='M20 6 9 17l-5-5'/></svg>";

  function texteDuBloc(pre) {
    // On lit le texte rendu, pas le HTML : la coloration syntaxique
    // insérerait des balises dans ce qui doit rester du code brut.
    var texte = pre.innerText || pre.textContent || "";
    return texte
      // Retire l'invite de commande en début de ligne : un exemple collé
      // avec son « $ » ne s'exécute pas, et c'est l'erreur la plus
      // fréquente quand on copie depuis une documentation.
      .replace(/^\s*\$ /gm, "")
      .replace(/\s+$/, "");
  }

  function equiper(pre) {
    if (pre.dataset.copiePrete) return;
    pre.dataset.copiePrete = "1";
    // L'enveloppe porte le positionnement : le bouton doit rester en place
    // même quand le bloc défile horizontalement.
    var enveloppe = document.createElement("div");
    enveloppe.className = "docs-code-wrap";
    pre.parentNode.insertBefore(enveloppe, pre);
    enveloppe.appendChild(pre);

    var bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "docs-copy-btn";
    bouton.setAttribute("aria-label", TXT.ariaLabel);
    bouton.innerHTML = ICONE_COPIE + "<span>" + TXT.copier + "</span>";
    enveloppe.appendChild(bouton);
  }

  function annoncer(message) {
    // Région live : le changement d'état doit être perceptible autrement
    // que par la couleur et l'icône.
    var region = document.getElementById("docs-copy-annonce");
    if (!region) {
      region = document.createElement("div");
      region.id = "docs-copy-annonce";
      region.setAttribute("aria-live", "polite");
      region.className = "sr-only";
      document.body.appendChild(region);
    }
    region.textContent = message;
  }

  function retour(bouton, ok, message) {
    var initial = bouton.innerHTML;
    bouton.innerHTML = (ok ? ICONE_OK : "") + "<span>" + message + "</span>";
    bouton.classList.toggle("docs-copy-ok", ok);
    bouton.classList.toggle("docs-copy-err", !ok);
    annoncer(message);
    setTimeout(function () {
      bouton.innerHTML = initial;
      bouton.classList.remove("docs-copy-ok", "docs-copy-err");
    }, 2000);
  }

  function copier(bouton) {
    var pre = bouton.parentElement.querySelector("pre");
    if (!pre) return;
    var texte = texteDuBloc(pre);

    // navigator.clipboard est indisponible hors contexte sécurisé (http://)
    // et peut être refusé par l'utilisateur. On prévoit le repli plutôt que
    // de ne rien faire — un bouton qui ne réagit pas est pire qu'absent.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texte)
        .then(function () { retour(bouton, true, TXT.copie); })
        .catch(function () { repli(bouton, texte); });
    } else {
      repli(bouton, texte);
    }
  }

  function repli(bouton, texte) {
    try {
      var zone = document.createElement("textarea");
      zone.value = texte;
      zone.setAttribute("readonly", "");
      zone.style.position = "fixed";
      zone.style.left = "-9999px";
      document.body.appendChild(zone);
      zone.select();
      var ok = document.execCommand("copy");
      zone.remove();
      retour(bouton, ok, ok ? TXT.copie : TXT.repli);
    } catch (e) {
      retour(bouton, false, TXT.repli);
    }
  }

  function init() {
    document.querySelectorAll("pre.docs-code").forEach(equiper);
    document.addEventListener("click", function (e) {
      var bouton = e.target.closest(".docs-copy-btn");
      if (bouton) copier(bouton);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
