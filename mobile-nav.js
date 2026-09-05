// Heurix — bascule du menu mobile (icône hamburger).
// Cible .nav-links depuis la fusion des deux bandeaux en un seul :
// .header-nav-row n existe plus.
(function () {
  "use strict";
  var btn = document.getElementById("mobile-nav-toggle");
  // Correctif (21 aout 2026, audit de coherence point 1). Ce script ne
  // ciblait que .nav-links -- la console utilise .nav-links-console. Son
  // menu compte (Entreprise, Membres, Cle API, Abonnement, Se
  // deconnecter) se repliait donc sous 1080px SANS que rien ne puisse le
  // rouvrir : le hamburger etait inoperant sur cette page.
  //
  // Consequence en production : sous 1080px, aucun chemin vers le compte
  // ni vers la deconnexion. Le commentaire de styles.css montre que le
  // repli du 2 aout supposait "le mecanisme deja utilise pour
  // .nav-links" -- il ne l'etait pas, faute du bon selecteur.
  var navRow = document.querySelector(".nav-links, .nav-links-console");
  if (!btn || !navRow) return;

  // FOND SEMI-OPAQUE (2 août, audit UX point 4) : .nav-links est en
  // position:absolute, hauteur calée sur son contenu, sans jamais rien
  // derrière -- le contenu de la page reste visible ET cliquable sous
  // les liens du menu ouvert. Créé en JS plutôt qu'ajouté à chaque page
  // HTML : ce script est déjà partagé, un seul endroit à maintenir.
  var fond = document.createElement("div");
  fond.className = "nav-mobile-fond";
  fond.setAttribute("aria-hidden", "true");
  document.body.appendChild(fond);

  function close() {
    navRow.classList.remove("mobile-open");
    btn.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    fond.classList.remove("visible");
  }

  btn.addEventListener("click", function () {
    var open = navRow.classList.toggle("mobile-open");
    btn.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    fond.classList.toggle("visible", open);
  });

  // Ferme le menu au clic en dehors (sur le fond lui-même).
  fond.addEventListener("click", close);

  // Ferme le menu si on clique un lien (navigation vers une nouvelle page ou une ancre)
  navRow.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", close);
  });

  // Ferme le menu si l'écran repasse en largeur desktop (rotation, redimensionnement)
  window.addEventListener("resize", function () {
    if (window.innerWidth > 1080) close();
  });
})();


// LA HAUTEUR DE L'EN-TETE, POSEE PLUTOT QUE SUPPOSEE (4 septembre 2026).
//
// `styles.css` reserve du defilement pour que les ancres n'atterrissent pas
// sous l'en-tete sticky : `scroll-padding-top: calc(var(--hauteur-entete) +
// 11px)`. Cette variable y valait 73, 137 ou 197 px selon deux requetes media
// -- un profil cense suivre la hauteur reelle, et faux six fois sur treize.
//
// POURQUOI LE CSS NE POUVAIT PAS S'EN SORTIR SEUL, mesure : la hauteur bascule
// de 131 a 73 px entre 540 et 550 px de large, ou AUCUNE requete media ne se
// declenche -- c'est un ajustement de contenu. Et les deux langues divergent a
// douze largeurs sur 57, l'en-tete anglais etant plus court. Aucune constante
// ne peut suivre les deux.
//
// Le CSS garde donc le MAXIMUM mesure (169 px, soit 180 px de reserve une
// fois les 11 px du calc ajoutes) et ces lignes posent la valeur juste. Mesure : l'ecart entre la reserve et l'en-tete tombe a 11 px sur les
// treize largeurs testees et dans les deux langues, contre 17 a 97 px avant.
//
// SI CE BLOC NE TOURNE PAS -- pas de ResizeObserver, script bloque, erreur
// plus haut -- la variable reste a 180, qui n'est jamais trop petit. Le mode
// degrade est l'ancien comportement, en un peu plus large : la reserve vaut
// alors 180 px partout, jamais moins que l'en-tete, et jusqu'a 106 px de trop
// (anglais, la ou l'en-tete fait 63 px).
//
// IIFE SEPAREE, ET C'EST LA RAISON : le bloc au-dessus sort en `return` quand
// la page n'a ni bouton hamburger ni menu (`if (!btn || !navRow) return;`).
// Une page sans menu mobile a quand meme un en-tete et des ancres.
(function () {
  "use strict";
  var entete = document.querySelector("header");
  if (!entete) return;
  function poser() {
    document.documentElement.style.setProperty(
      "--hauteur-entete", Math.round(entete.getBoundingClientRect().height) + "px");
  }
  poser();
  if (window.ResizeObserver) new ResizeObserver(poser).observe(entete);
  else window.addEventListener("resize", poser);
})();
