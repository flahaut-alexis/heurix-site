// Guide de mise en route -- deux ameliorations UX independantes issues de
// l'audit du 10 aout 2026 : l'indice de defilement des blocs de code, et
// le scrollspy du sommaire de gauche. Regroupees dans un seul fichier
// puisque toutes deux specifiques a cette page pour ce meme chantier --
// evite de multiplier les petits <script> charges pour peu de code chacun.
(function () {
  "use strict";

  // --- 1. INDICE DE DEFILEMENT SUR LES BLOCS DE CODE -----------------
  // overflow-x:auto seul ne signale jamais qu'un bloc cache du contenu a
  // droite. Mesure REELLE de chaque bloc plutot qu'un fondu impose
  // partout : verifie sur cette page, seuls certains blocs debordent
  // vraiment, les autres n'ont pas besoin de l'indice.
  var blocsCode = Array.prototype.slice.call(document.querySelectorAll(".docs-code"));
  function majIndicesDefilement() {
    blocsCode.forEach(function (bloc) {
      var reste = bloc.scrollWidth - bloc.clientWidth - bloc.scrollLeft;
      // Le fondu disparait une fois qu'on a vraiment scrolle jusqu'au
      // bout (reste proche de 0), pas seulement s'il y avait du contenu
      // cache au chargement -- un utilisateur qui a deja tout vu n'a
      // plus besoin du signal.
      bloc.classList.toggle("a-defilement", reste > 4);
    });
  }
  majIndicesDefilement();
  blocsCode.forEach(function (bloc) {
    bloc.addEventListener("scroll", majIndicesDefilement, { passive: true });
  });
  window.addEventListener("resize", majIndicesDefilement);

  // --- 2. SCROLLSPY DU SOMMAIRE DE GAUCHE -----------------------------
  // Cette page a un sommaire statique en HTML dur (pas de generation
  // dynamique comme docs-toc.js sur docs.html) -- mais ses liens
  // pointent deja vers de vrais id poses en dur sur les h2/h3 de
  // contenu (etape-1, module-tracker...). Seuls CES titres sont
  // observes : le filtre [id] exclut naturellement le stepper et le
  // titre du quiz "Construisez votre parcours", qui n'ont pas d'id et
  // n'apparaissent pas dans le sommaire.
  var titres = Array.prototype.slice.call(
    document.querySelectorAll(".post-body h2[id], .post-body h3[id]")
  );
  var liensSidebarParId = {};
  document.querySelectorAll(".docs-sidebar a[href^='#']").forEach(function (a) {
    liensSidebarParId[a.getAttribute("href").slice(1)] = a;
  });

  if (titres.length && typeof IntersectionObserver !== "undefined") {
    var actif = null;
    function activer(id) {
      if (id === actif || !liensSidebarParId[id]) return;
      if (actif && liensSidebarParId[actif]) liensSidebarParId[actif].classList.remove("active");
      actif = id;
      liensSidebarParId[actif].classList.add("active");
    }

    // Meme fenetre de detection et meme correctif que docs-toc.js pour
    // les sections plus hautes que la bande de declenchement (un titre
    // sorti par le haut du viewport reste "actif" jusqu'a ce que le
    // suivant prenne le relais) -- comportement deja valide sur
    // docs.html, reconduit ici a l'identique.
    var observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (entree) {
        if (entree.isIntersecting || entree.boundingClientRect.top < 0) {
          activer(entree.target.id);
        }
      });
    }, { rootMargin: "-15% 0px -70% 0px" });

    titres.forEach(function (t) { observateur.observe(t); });
  }
})();
