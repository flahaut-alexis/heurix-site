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

  // ON SE SIGNALE AVANT DE MASQUER. Tant que cette classe n'est pas posee,
  // `.reveal` vaut opacity:1 : une page dont le script ne s'execute jamais
  // affiche son contenu au lieu de se vider. C'est le sens de l'inversion
  // du 26 aout -- voir le commentaire de .reveal dans styles.css.
  document.documentElement.classList.add('js-reveal');
  var liste = Array.prototype.slice.call(els);

  // UNE VIDEO EN `data-src` RECOIT SA SOURCE ICI, ET NULLE PART AILLEURS
  // (5 septembre 2026).
  //
  // POURQUOI PAS `preload="none"` : il est IGNORE des qu'`autoplay` est pose.
  // Mesure du 4 septembre 2026, banc a trois cas lu dans le journal du
  // serveur, les trois video a 2 000 px sous la ligne de flottaison :
  //
  //     autoplay + preload="none"   -> mp4 telecharge
  //     sans autoplay, controls     -> non
  //     data-src au lieu de src     -> non
  //
  // Sans ce branchement, la figure de fonctionnalites.html coutait 908 ko a
  // CHAQUE premier chargement, pour une video a 1 361 px sous une fenetre de
  // 900 -- et sur mobile, ou son texte fin tombe a 4,3 px CSS et ne montre
  // donc rien de lisible, elle les coutait quand meme.
  //
  // POURQUOI ICI PLUTOT QUE DANS UN OBSERVATEUR A PART : les quatre chemins
  // de ce fichier -- test de rectangle immediat, IntersectionObserver, repli
  // `scroll`, filet de securite a 2 s -- convergent tous sur `montrer()`.
  // Un seul point de couture, et le filet de securite couvre aussi la video :
  // si le mecanisme casse, elle se charge au lieu de rester noire. C'est le
  // bon sens de panne, et c'est le meme raisonnement que l'inversion du
  // 26 aout ci-dessus -- du contenu plutot que des octets epargnes.
  function montrer(el) {
    el.classList.add('in');
    var v = el.matches('video[data-src]') ? el : el.querySelector('video[data-src]');
    if (v) { v.src = v.getAttribute('data-src'); v.removeAttribute('data-src'); }
  }

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

  // 3. REPLI SUR L'EVENEMENT `scroll`, qui ne depend d'aucun observateur.
  //    Si l'IntersectionObserver est absent, casse ou jamais declenche, un
  //    simple test de rectangle au defilement fait le meme travail. Passif et
  //    auto-desarmant : des que tout est visible, l'ecouteur se retire.
  function balayer() {
    var hh = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!hh) return;
    var restants = 0;
    liste.forEach(function (el) {
      if (el.classList.contains('in')) return;
      var r = el.getBoundingClientRect();
      if (r.top < hh && r.bottom > 0) montrer(el); else restants++;
    });
    if (!restants) window.removeEventListener('scroll', balayer);
  }
  window.addEventListener('scroll', balayer, { passive: true });

  // 4. FILET DE SECURITE, conditionnel. Une animation ne doit JAMAIS pouvoir
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
