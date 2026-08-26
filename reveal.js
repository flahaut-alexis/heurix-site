/* Apparition au defilement — mecanisme partage (26 aout 2026).
 *
 * POURQUOI CE FICHIER EXISTE. Le mecanisme etait recopie inline dans DOUZE
 * pages, et absent de SEPT autres qui portent pourtant du balisage `.reveal`
 * — dont secteurs.html et roi.html, creees le 25 aout depuis un gabarit
 * (about.html) qui n'a ni `.reveal` ni script. Resultat : secteurs.html
 * s'affichait quasiment vide, tout son contenu tenant dans un seul bloc
 * bloque a opacity:0. La duplication EST la cause : on ne peut pas se
 * souvenir de recopier un script qu'on ne voit pas.
 *
 * TROIS NIVEAUX, du plus sur au plus decoratif.
 */
(function () {
  var els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  var liste = Array.prototype.slice.call(els);
  function montrer(el) { el.classList.add('in'); }

  // 1. VERIFICATION IMMEDIATE PAR RECTANGLE, sans dependre d'aucun
  //    observateur. Un bloc deja dans la fenetre au chargement apparait tout
  //    de suite -- c'est le cas d'une page courte, ou tout le contenu tient
  //    presque a l'ecran.
  var h = window.innerHeight || document.documentElement.clientHeight || 0;
  if (h > 0) {
    liste.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < h && r.bottom > 0) montrer(el);
    });
  }

  // 2. OBSERVATEUR pour la suite du defilement.
  //    `threshold: 0` et non 0.15 : le seuil porte sur la part de la CIBLE
  //    visible. Un bloc plus haut que 6,7 fois la fenetre ne peut jamais en
  //    montrer 15 % d'un coup, et ne se declencherait donc jamais. Plusieurs
  //    blocs de fonctionnalites.html depassent 2 500 px.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (e.isIntersecting) { montrer(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0 });
    liste.forEach(function (el) { if (!el.classList.contains('in')) io.observe(el); });
  } else {
    liste.forEach(montrer);
  }

  // 3. FILET DE SECURITE, conditionnel. Une animation ne doit JAMAIS pouvoir
  //    cacher du contenu de facon permanente. Si AUCUN bloc n'a recu `.in`
  //    au bout de deux secondes, le mecanisme est manifestement casse
  //    (observateur inoperant, script charge trop tard, fenetre de hauteur
  //    nulle...) : on rend tout visible.
  //    Conditionnel A DESSEIN -- reveler tout systematiquement annulerait
  //    l'animation sur les pages ou elle fonctionne.
  setTimeout(function () {
    var aucun = liste.every(function (el) { return !el.classList.contains('in'); });
    if (aucun) liste.forEach(montrer);
  }, 2000);
})();
