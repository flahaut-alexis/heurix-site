// Sommaire "Sur cette page" (audit UX Algolia/Meilisearch, 5 août 2026).
//
// SCRIPT UNIQUE dès le départ, pas une paire FR/EN à dupliquer -- la
// génération de sommaire et le scrollspy sont entièrement langue-agnostiques
// (ils lisent la structure des titres, jamais leur contenu textuel). Après
// le chantier S4 du même jour (trois paires de scripts fusionnées, dont une
// où la version anglaise avait perdu une vraie fonctionnalité en route),
// autant ne jamais créer la paire plutôt que la corriger plus tard.
//
// PAS DE POLLING AU SCROLL : IntersectionObserver, pas d'écouteur "scroll"
// avec throttle/debounce à la main -- l'API existe précisément pour ce
// cas d'usage et évite de réinventer un mécanisme de limitation de
// fréquence sujet à ses propres bugs.
(function () {
  "use strict";

  var contenu = document.querySelector(".docs-content");
  var conteneurToc = document.querySelector(".docs-layout");
  if (!contenu || !conteneurToc) return;

  var titres = Array.prototype.slice.call(contenu.querySelectorAll("h2, h3"));
  // Sous un seuil, une TOC n'apporte rien qu'un visiteur ne voie déjà d'un
  // coup d'œil -- pas de coût, mais pas la peine d'encombrer le DOM non plus.
  if (titres.length < 6) return;

  // SLUGS POUR LES H3 SANS ID. La plupart des H2 ont déjà un id (porté par
  // leur <section> parente) ; les H3, eux, n'en ont pour la plupart aucun.
  // Générés ici plutôt que codés en dur dans les 59 titres existants --
  // minimise le risque sur un fichier qui n'est pas celui de ce chantier.
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

  var toc = document.createElement("aside");
  toc.className = "docs-toc";
  toc.setAttribute("aria-label", "Sur cette page");
  var titreToc = document.createElement("div");
  titreToc.className = "docs-toc-titre";
  titreToc.textContent = document.documentElement.lang === "en" ? "On this page" : "Sur cette page";
  toc.appendChild(titreToc);

  var liensParId = {};
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
    var lien = document.createElement("a");
    lien.href = "#" + titre.id;
    lien.textContent = titre.textContent;
    if (titre.tagName === "H3") lien.className = "docs-toc-h3";
    toc.appendChild(lien);
    liensParId[titre.id] = lien;
  });

  conteneurToc.appendChild(toc);

  // Sidebar de GAUCHE existante : son CSS (.docs-sidebar a.active) était déjà
  // en place mais jamais alimenté par aucun script -- le même scrollspy
  // l'anime maintenant aussi, sans code supplémentaire dédié.
  var liensSidebarParId = {};
  document.querySelectorAll(".docs-sidebar a[href^='#']").forEach(function (a) {
    liensSidebarParId[a.getAttribute("href").slice(1)] = a;
  });

  // La sidebar de gauche liste aussi des ENDPOINTS individuels (ex.
  // #ep-top-products), portés par des <div class="docs-endpoint">, pas des
  // H2/H3 -- absents de LA TOC DE DROITE (qui resterait sinon trop dense
  // pour rester lisible d'un coup d'œil), mais leur scrollspy doit
  // fonctionner puisque la sidebar de gauche les liste déjà.
  var elementsObserves = titres.concat(
    Array.prototype.slice.call(document.querySelectorAll(".docs-endpoint[id]"))
      .filter(function (el) { return liensSidebarParId[el.id]; })
  );

  if (typeof IntersectionObserver === "undefined") return; // pas de scrollspy, la TOC reste utilisable au clic

  var actif = null;
  function activer(id) {
    if (id === actif) return;
    if (actif) {
      if (liensParId[actif]) liensParId[actif].classList.remove("active");
      if (liensSidebarParId[actif]) liensSidebarParId[actif].classList.remove("active");
    }
    actif = id;
    if (liensParId[actif]) liensParId[actif].classList.add("active");
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

  titres.forEach(function (titre) { observateur.observe(titre); });
  elementsObserves.slice(titres.length).forEach(function (el) { observateur.observe(el); });
})();
