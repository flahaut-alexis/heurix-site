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
  // Visite reecrite le 21 aout 2026. L'ancienne datait d'avant la moitie
  // de ce que la console fait aujourd'hui : elle parlait d'« Appliquer »
  // quand le bouton dit « Publier », visait #so-count supprime depuis, et
  // ignorait « Pourquoi ces resultats ? » -- ce que le brief appelle la
  // fonctionnalite differenciante.
  //
  // Ecrite pour un marchand qui vient de s'inscrire : chaque etape dit ce
  // qu'il VOIT et ce qu'il peut en faire, pas comment la fonctionnalite
  // s'appelle en interne.
  var ETAPES = [
    {
      cible: "#global-catalog",
      titre: "Choisissez votre catalogue",
      texte: "Ce choix vaut pour toute la console : analytique, règles, classement. Vous ne le referez pas à chaque écran.",
    },
    {
      cible: "#so-preview-query",
      titre: "Tapez une requête de vos clients",
      texte: "Les résultats s'affichent comme les verrait un visiteur. Essayez une recherche qui vous pose problème aujourd'hui.",
    },
    {
      cible: "#so-preview-grid",
      titre: "Voici ce que voit votre client",
      texte: "Chaque fiche indique son rang. Rien n'est simulé : c'est le classement réel de votre catalogue, à cet instant.",
    },
    {
      cible: "#so-pipeline-btn",
      titre: "Comprenez pourquoi ce classement",
      texte: "Ce lien ouvre le détail : les mots reconnus, les fautes rattrapées, ce qui a pesé dans le score. <strong>Aucun moteur de recherche ne vous montre habituellement cela.</strong>",
    },
    {
      cible: ".so-card-actions",
      titre: "Épinglez un produit",
      texte: "L'épingle met un produit en tête pour cette requête. Les flèches le déplacent d'une place — utile pour un produit en promotion ou une fin de série.",
    },
    {
      cible: "#so-simu-bar",
      titre: "Rien n'est encore enregistré",
      texte: "Ce bandeau signale un brouillon : <strong>vos visiteurs voient toujours le classement actuel.</strong> Vous pouvez tout annuler sans conséquence.",
    },
    {
      cible: "#so-simu-apply",
      titre: "Publier met vos règles en ligne",
      texte: "À ce moment seulement, vos visiteurs voient le nouveau classement. Déplacer un produit fige aussi les positions au-dessus : plusieurs règles apparaissent donc d'un seul clic.",
    },
    {
      pane: "pane-vocabulaire",
      cible: "#cr-host-synonymes",
      titre: "Apprenez ses mots au moteur",
      texte: "Vos clients ne tapent pas le vocabulaire de votre catalogue. Un synonyme relie leur mot au vôtre — et les recherches sans résultat vous disent lesquels manquent.",
    },
    {
      pane: "pane-browse",
      cible: "#pane-browse .console-pane-title",
      titre: "Classez aussi vos pages de catégorie",
      texte: "Même principe, sans recherche : vous ordonnez les produits d'une catégorie de votre site. Épinglage par produit, ou mise en avant de toute une famille.",
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

    // NAVIGATION ENTRE ECRANS (21 aout 2026). La visite vivait sur la
    // seule page Mise en avant sur recherche ; elle couvre desormais le
    // vocabulaire et la categorie, donc elle doit changer de pane.
    //
    // On ne navigue QUE si l'ecran demande n'est pas deja ouvert : sinon
    // chaque etape relancerait le chargement du pane courant, avec ses
    // appels reseau.
    if (etape.pane && !etape._navigue) {
      var paneVise = document.getElementById(etape.pane);
      if (paneVise && paneVise.hidden) {
        var entree = document.querySelector('[data-pane="' + etape.pane + '"]');
        if (entree) {
          entree.click();
          // Le pane s'affiche et charge ses donnees : on attend un cycle
          // avant de chercher la cible, sinon estVisible() la trouve
          // absente et l'etape s'annonce sans pointer nulle part.
          // Marque l'etape comme deja navigee : si le pane reste
          // masque -- ecran indisponible sur ce plan, chargement en
          // echec -- aller(n) se rappellerait indefiniment. On passe
          // alors en mode « annonce sans cible », comportement deja
          // prevu plus bas.
          etape._navigue = true;
          setTimeout(function () { aller(n); }, 350);
          return;
        }
      }
    }

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
    // Drapeaux de navigation remis a zero : sans cela, une seconde
    // visite dans la meme session sauterait les changements d'ecran.
    ETAPES.forEach(function (e) { e._navigue = false; });
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
