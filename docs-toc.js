// Scrollspy de la sidebar de gauche (audit UX Algolia/Meilisearch, 5 août
// 2026 -- panneau "Sur cette page" retiré le 9 août : doublon quasi total
// avec cette même sidebar une fois son contraste corrigé, sur une page qui
// n'a jamais été paginée. Le scrollspy lui-même reste intact, seule la
// génération du panneau de droite a été retirée.
//
// PAS DE POLLING AU SCROLL : IntersectionObserver, pas d'écouteur "scroll"
// avec throttle/debounce à la main -- l'API existe précisément pour ce
// cas d'usage et évite de réinventer un mécanisme de limitation de
// fréquence sujet à ses propres bugs.
(function () {
  "use strict";

  var contenu = document.querySelector(".docs-content");
  if (!contenu) return;

  var titres = Array.prototype.slice.call(contenu.querySelectorAll("h2, h3"));
  if (!titres.length) return;

  // SLUGS POUR LES H3 SANS ID. La plupart des H2 ont déjà un id (porté par
  // leur <section> parente) ; les H3, eux, n'en ont pour la plupart aucun.
  // Générés ici plutôt que codés en dur dans les titres existants --
  // minimise le risque sur un fichier qui n'est pas celui de ce chantier.
  // Toujours nécessaire même sans panneau : l'IntersectionObserver a besoin
  // d'un id stable par titre pour retrouver le bon lien de sidebar.
  var slugsVus = {};
  function slug(texte) {
    var base = texte.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // accents
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    var candidat = base;
    var n = 2;
    while (slugsVus[candidat]) { candidat = base + "-" + n; n++; }
    slugsVus[candidat] = true;
    return candidat;
  }

  titres.forEach(function (titre) {
    if (!titre.id) {
      // Les H2 sont presque toujours SANS id propre : leur <section>
      // parente en porte déjà un ("quickstart", "ep-search"...), utilisé
      // par la sidebar de gauche et par tout lien externe existant vers
      // cette page. Générer un second id sur le H2 créerait une ancre
      // incohérente avec celles déjà en circulation -- toujours réutiliser
      // celui de la section avant d'en fabriquer un nouveau.
      //
      // UNIQUEMENT pour les H2 : un H3, lui, n'a PAS sa propre <section> --
      // closest() remonterait jusqu'à celle du H2 englobant, donnant la
      // MÊME ancre à tous les H3 d'une section (bug détecté puis corrigé
      // avant livraison, voir le test qui l'a révélé).
      var section = titre.tagName === "H2" ? titre.closest("section[id]") : null;
      titre.id = section ? section.id : slug(titre.textContent || "");
    }
    if (!slugsVus[titre.id]) slugsVus[titre.id] = true; // évite qu'un futur slug généré ne collisionne avec un id déjà posé en dur, réutilisé ou non
  });

  // Sidebar de GAUCHE : son CSS (.docs-sidebar a.active) était déjà en place
  // mais jamais alimenté par aucun script avant le chantier du 5 août -- le
  // scrollspy l'anime, sans dépendre d'un panneau de droite pour exister.
  var liensSidebarParId = {};
  document.querySelectorAll(".docs-sidebar a[href^='#']").forEach(function (a) {
    liensSidebarParId[a.getAttribute("href").slice(1)] = a;
  });

  // La sidebar de gauche liste aussi des ENDPOINTS individuels (ex.
  // #ep-top-products), portés par des <div class="docs-endpoint">, pas des
  // H2/H3 -- leur scrollspy doit fonctionner puisque la sidebar de gauche
  // les liste déjà.
  var elementsObserves = titres.concat(
    Array.prototype.slice.call(document.querySelectorAll(".docs-endpoint[id]"))
      .filter(function (el) { return liensSidebarParId[el.id]; })
  );

  if (typeof IntersectionObserver === "undefined") return; // pas de scrollspy, la sidebar reste utilisable au clic

  var actif = null;
  function activer(id) {
    if (id === actif) return;
    if (actif && liensSidebarParId[actif]) liensSidebarParId[actif].classList.remove("active");
    actif = id;
    if (liensSidebarParId[actif]) liensSidebarParId[actif].classList.add("active");
  }

  // rootMargin resserre la zone de déclenchement vers le haut du viewport :
  // un titre est considéré "en cours de lecture" dès qu'il franchit le
  // quart supérieur de l'écran, pas seulement quand il touche le tout haut.
  var observateur = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (entree) {
      if (entree.isIntersecting) activer(entree.target.id);
    });
  }, { rootMargin: "-15% 0px -70% 0px" });

  elementsObserves.forEach(function (el) { observateur.observe(el); });
})();
