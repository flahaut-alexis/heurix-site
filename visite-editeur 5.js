// Visite guidée de l'éditeur visuel de règles.
//
// POURQUOI UNE VISITE PLUTÔT QU'UN ARTICLE : ces gestes se comprennent en
// les faisant. Un texte qui décrit « cliquez l'épingle puis les flèches »
// oblige le lecteur à traduire des mots en actions ; la visite montre
// l'élément et le laisse agir.
//
// ELLE PORTE SUR LES VRAIS ÉLÉMENTS, pas sur une démonstration simulée.
// C'est possible sans risque parce que l'éditeur travaille en brouillon :
// rien n'est enregistré tant que « Appliquer » n'est pas cliqué. Le lecteur
// peut donc suivre les étapes pour de vrai, ce qui est exactement le but.
(function () {
  "use strict";

  var CLE_VUE = "heurix_visite_editeur_vue";

  // Chaque étape : l'élément visé, ce qu'on explique, et éventuellement
  // l'action qui la fait avancer toute seule.
  var ETAPES = [
    {
      cible: "#global-catalog",
      titre: "Choisissez votre catalogue",
      texte: "Ce choix vaut pour toute la console : analytique, règles, classement. Vous ne le referez pas d'un écran à l'autre.",
    },
    {
      cible: "#so-preview-query",
      titre: "Tapez une requête de vos clients",
      texte: "Les résultats s'affichent comme les verrait un visiteur. Essayez une recherche que vous voulez corriger — par exemple un mot sur lequel le bon produit ne remonte pas.",
      avanceSur: { evenement: "input", selecteur: "#so-preview-query" },
    },
    {
      cible: "#so-preview-grid",
      titre: "Voici ce que voit votre client",
      texte: "Chaque fiche indique son rang et <strong>pourquoi elle sort</strong> : terme exact, faute tolérée, annotation reconnue. C'est cette colonne qui explique un classement au lieu de le constater.",
    },
    {
      cible: ".so-card-actions",
      titre: "Épinglez un produit",
      texte: "L'épingle met un produit en tête pour cette requête. Les flèches le déplacent d'une place — et vous pouvez aussi <strong>glisser une carte épinglée sur une autre</strong> pour les intervertir.",
      avanceSur: { evenement: "click", selecteur: "[data-so-act]" },
    },
    {
      cible: "#so-simu-bar",
      titre: "Rien n'est encore enregistré",
      texte: "Ce bandeau ambre signale un brouillon : <strong>vos visiteurs voient toujours le classement actuel</strong>. Vous pouvez essayer autant que vous voulez sans conséquence.",
    },
    {
      cible: "#so-simu-apply",
      titre: "Appliquer publie vos règles",
      texte: "À ce moment seulement, vos visiteurs voient le nouveau classement. Un déplacement fige aussi les positions au-dessus : plusieurs règles apparaissent d'un seul clic, c'est normal.",
    },
    {
      cible: "#so-count",
      titre: "Vos règles restent consultables",
      texte: "Ce compteur suit les règles actives. Plus bas, vous pouvez les relire et les supprimer — pensez-y quand une promotion se termine.",
    },
  ];

  var index = 0;
  var actif = false;
  var bulle = null;
  var voile = null;
  var cibleCourante = null;
  var detacheur = null;

  // Un élément peut exister sans être visible : un parent masqué suffit.
  // Ce contrôle évite de pointer le vide, piège rencontré plusieurs fois
  // sur cette console.
  // Stockage local pris sur la fenetre du document, pas sur le scope global.
  // Quatrieme occurrence du meme piege sur ce projet (Event,
  // MutationObserver, fetch) : hors navigateur, le global n'a pas cet objet.
  // On protege aussi contre un stockage desactive (navigation privee
  // stricte), ou la simple lecture leve une exception.
  function memoire(cle, valeur) {
    try {
      var W = document.defaultView || window;
      if (!W.localStorage) return null;
      if (valeur === undefined) return W.localStorage.getItem(cle);
      W.localStorage.setItem(cle, valeur);
      return valeur;
    } catch (e) {
      return null;  // stockage indisponible : la visite reste utilisable
    }
  }

  function estVisible(el) {
    if (!el) return false;
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      if (n.hidden) return false;
    }
    return el.getBoundingClientRect().height > 0;
  }

  function construire() {
    voile = document.createElement("div");
    voile.className = "visite-voile";
    bulle = document.createElement("div");
    bulle.className = "visite-bulle";
    bulle.setAttribute("role", "dialog");
    bulle.setAttribute("aria-live", "polite");
    document.body.appendChild(voile);
    document.body.appendChild(bulle);

    bulle.addEventListener("click", function (e) {
      var act = e.target.getAttribute("data-visite");
      if (act === "suivant") {
        // Neutralise l'avancement automatique avant la navigation manuelle :
        // sans cela, un clic sur « Suivant » a l'etape 2 pouvait declencher
        // DEUX appels a aller() -- le clic et l'ecouteur d'input encore
        // attache -- d'ou l'impression qu'un second clic etait necessaire.
        if (detacheur) { detacheur(); detacheur = null; }
        aller(index + 1);
      }
      else if (act === "precedent") aller(index - 1);
      else if (act === "quitter") terminer(true);
    });
    document.addEventListener("keydown", function (e) {
      if (!actif) return;
      if (e.key === "Escape") terminer(true);
      else if (e.key === "ArrowRight") aller(index + 1);
      else if (e.key === "ArrowLeft") aller(index - 1);
    });
    voile.addEventListener("click", function () { terminer(true); });
  }

  function placer(el) {
    // Le placement est differe de 260ms pour laisser le defilement se
    // terminer. Si l'utilisateur enchaine vite ou quitte entre-temps, la
    // bulle a pu etre retiree : sans cette garde, on lit .style sur null.
    if (!bulle || !el) return;
    var r = el.getBoundingClientRect();
    var marge = 12;
    // Sous l'élément par défaut, au-dessus s'il n'y a pas la place —
    // sinon la bulle sortirait de l'écran sur les éléments du bas.
    var dessous = r.bottom + marge + 190 < window.innerHeight;
    bulle.style.top = (dessous ? r.bottom + marge : Math.max(marge, r.top - marge - bulle.offsetHeight)) + "px";
    var gauche = Math.min(Math.max(marge, r.left), window.innerWidth - bulle.offsetWidth - marge);
    bulle.style.left = gauche + "px";
    // Position connue : on peut montrer la bulle.
    bulle.classList.remove("visite-bulle-transition");
  }

  function aller(n) {
    if (n < 0) return;
    if (n >= ETAPES.length) return terminer(false);

    if (cibleCourante) cibleCourante.classList.remove("visite-cible");
    if (detacheur) { detacheur(); detacheur = null; }

    var etape = ETAPES[n];
    var el = document.querySelector(etape.cible);

    // Étape dont l'élément n'est pas encore là (pas de requête tapée, pas
    // de brouillon) : on l'annonce sans pointer dans le vide.
    var visible = estVisible(el);
    index = n;

    // CORRECTIF DU BUG D'INFOBULLE FANTOME (audit UX 4.2).
    //
    // Le contenu etait ecrit immediatement, la position recalculee 260 ms
    // plus tard (le temps du defilement). Entre les deux, la bulle affichait
    // le NOUVEAU texte a l'ANCIENNE position -- l'infobulle « fantome »
    // observee a la transition etape 2 -> 3.
    //
    // On la masque donc pendant le repositionnement. Un correctif anterieur
    // avait ajoute des gardes contre un plantage (.style sur null) sans
    // traiter ce symptome visuel : deux bugs distincts sur le meme code.
    bulle.classList.add("visite-bulle-transition");
    bulle.innerHTML =
      "<div class='visite-compteur'>Étape " + (n + 1) + " sur " + ETAPES.length + "</div>" +
      "<p class='visite-titre'>" + etape.titre + "</p>" +
      "<p class='visite-texte'>" + etape.texte + "</p>" +
      (visible ? "" : "<p class='visite-attente'>Cet élément apparaîtra quand vous aurez fait l'étape précédente.</p>") +
      "<div class='visite-actions'>" +
        (n > 0 ? "<button type='button' data-visite='precedent'>Précédent</button>" : "") +
        "<button type='button' data-visite='suivant' class='visite-principal'>" +
          (n === ETAPES.length - 1 ? "Terminer" : "Suivant") + "</button>" +
        "<button type='button' data-visite='quitter' class='visite-quitter'>Quitter</button>" +
      "</div>";

    if (visible) {
      cibleCourante = el;
      el.classList.add("visite-cible");
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(function () { placer(el); }, 260);

      // Avancement automatique quand l'utilisateur FAIT l'action : la visite
      // suit son rythme au lieu de lui imposer des clics sur « Suivant ».
      if (etape.avanceSur) {
        var zone = document.querySelector(etape.avanceSur.selecteur) ? document : null;
        var handler = function (e) {
          if (e.target.closest && e.target.closest(etape.avanceSur.selecteur)) {
            setTimeout(function () { if (actif && bulle && index === n) aller(n + 1); }, 700);
          }
        };
        document.addEventListener(etape.avanceSur.evenement, handler, true);
        detacheur = function () { document.removeEventListener(etape.avanceSur.evenement, handler, true); };
      }
    } else {
      cibleCourante = null;
      bulle.style.top = "50%";
      bulle.style.left = "50%";
      bulle.style.transform = "translate(-50%, -50%)";
      bulle.classList.remove("visite-bulle-transition");
    }
    if (visible) bulle.style.transform = "";
  }

  function terminer(abandon) {
    actif = false;
    memoire(CLE_VUE, "1");
    if (cibleCourante) cibleCourante.classList.remove("visite-cible");
    if (detacheur) { detacheur(); detacheur = null; }
    if (voile) voile.remove();
    if (bulle) bulle.remove();
    voile = bulle = cibleCourante = null;
    if (!abandon) {
      // Une visite menée à terme mérite un mot : sans cela, la disparition
      // de la bulle ressemble à un bug.
      var fin = document.createElement("div");
      fin.className = "visite-fin";
      fin.innerHTML = "Visite terminée — vous pouvez la relancer depuis <strong>Guides</strong>.";
      document.body.appendChild(fin);
      setTimeout(function () { fin.remove(); }, 4200);
    }
  }

  function demarrer() {
    if (actif) return;
    // La visite porte sur l'écran des règles : on l'y amène d'abord, sinon
    // les trois quarts des étapes pointeraient dans le vide.
    if (typeof window.heurixShowPane === "function") window.heurixShowPane("pane-search-overrides");
    actif = true;
    index = 0;
    construire();
    setTimeout(function () { aller(0); }, 300);
  }

  window.heurixVisiteEditeur = demarrer;

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-visite-demarrer]")) {
      e.preventDefault();
      demarrer();
    }
  });
})();
