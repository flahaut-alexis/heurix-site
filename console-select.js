// Listes deroulantes de la console, au look du site.
//
// POURQUOI CE FICHIER EXISTE : le panneau qui s'ouvre quand on clique un
// <select> est dessine par le SYSTEME D'EXPLOITATION, pas par la page.
// Aucune regle CSS ne peut l'atteindre -- d'ou l'impression de "vieux
// menu" au clic, alors que le bouton ferme est bien style.
//
// APPROCHE : surcouche, pas remplacement. Le <select> natif reste dans le
// document (masque visuellement mais accessible), et c'est toujours lui
// qui porte la valeur. Choisir une option ecrit dans select.value puis
// emet un evenement `change` -- donc tout le code existant de console.js,
// qui lit select.value et ecoute change, continue de fonctionner sans une
// seule modification.
//
// Le panneau est reconstruit A CHAQUE OUVERTURE plutot qu'une fois pour
// toutes : plusieurs listes de la console sont remplies apres un appel
// API (les catalogues, les categories), et un panneau construit trop tot
// serait vide. Pas besoin d'observateur de mutations.
(function () {
  "use strict";

  // Le constructeur Event est pris sur la fenetre du document, pas sur le
  // scope global. Valide en navigateur, et robuste ailleurs : dans un
  // environnement ou ce script est evalue depuis Node, `new Event()`
  // resolvait le Event de Node, que le DOM refusait ensuite.
  function emettre(el, nom) {
    var W = (el.ownerDocument && el.ownerDocument.defaultView) || window;
    el.dispatchEvent(new W.Event(nom, { bubbles: true }));
  }

  function libelle(select) {
    var opt = select.options[select.selectedIndex];
    return opt ? opt.textContent : "";
  }

  function ameliorer(select) {
    if (select.dataset.cselDone) return;
    select.dataset.cselDone = "1";

    var enveloppe = document.createElement("div");
    enveloppe.className = "csel";
    var bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "csel-btn";
    bouton.setAttribute("aria-haspopup", "listbox");
    bouton.setAttribute("aria-expanded", "false");
    var panneau = document.createElement("div");
    panneau.className = "csel-panel";
    panneau.setAttribute("role", "listbox");

    select.parentNode.insertBefore(enveloppe, select);
    enveloppe.appendChild(bouton);
    enveloppe.appendChild(panneau);
    enveloppe.appendChild(select);
    select.classList.add("csel-native");

    // Reprend l'identifiant du label associe, pour que cliquer le libelle
    // ouvre bien la liste.
    if (select.id) {
      var lab = document.querySelector('label[for="' + select.id + '"]');
      if (lab) lab.addEventListener("click", function (e) { e.preventDefault(); bouton.click(); });
    }

    function majLibelle() {
      bouton.textContent = libelle(select) || "—";
      bouton.disabled = select.disabled;
    }

    function fermer() {
      panneau.classList.remove("open");
      bouton.setAttribute("aria-expanded", "false");
    }

    function construire() {
      panneau.innerHTML = "";
      Array.prototype.forEach.call(select.options, function (opt, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "csel-opt" + (i === select.selectedIndex ? " on" : "");
        b.setAttribute("role", "option");
        b.setAttribute("aria-selected", i === select.selectedIndex ? "true" : "false");
        b.textContent = opt.textContent;
        b.addEventListener("click", function () {
          select.selectedIndex = i;
          majLibelle();
          fermer();
          // C'est cet evenement que le reste de la console ecoute deja.
          emettre(select, "change");
          bouton.focus();
        });
        panneau.appendChild(b);
      });
    }

    bouton.addEventListener("click", function (e) {
      e.stopPropagation();
      var ouvert = panneau.classList.contains("open");
      document.querySelectorAll(".csel-panel.open").forEach(function (p) {
        p.classList.remove("open");
        var b = p.previousElementSibling;
        if (b) b.setAttribute("aria-expanded", "false");
      });
      if (ouvert) return fermer();
      construire();
      panneau.classList.add("open");
      bouton.setAttribute("aria-expanded", "true");
    });

    bouton.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var n = select.options.length;
        if (!n) return;
        select.selectedIndex = (select.selectedIndex + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
        majLibelle();
        emettre(select, "change");
      } else if (e.key === "Escape") {
        fermer();
      }
    });

    // Si le code de la console remplit ou change la liste, le libelle suit.
    select.addEventListener("change", majLibelle);
    majLibelle();

    // OBSERVATEUR DE MUTATIONS -- indispensable, et son absence etait un
    // bug reel : plusieurs listes de la console sont desactivees au depart
    // puis reactivees par programme (le selecteur de categories l'est
    // jusqu'au choix d'un catalogue). Or modifier `.disabled` ou remplacer
    // les <option> n'emet AUCUN evenement : le bouton de la surcouche
    // restait desactive indefiniment, rendant la liste inutilisable.
    //
    // On surveille donc l'attribut disabled et le remplacement des options.
    // Le panneau, lui, est deja reconstruit a chaque ouverture, il n'a pas
    // besoin d'etre synchronise ici.
    // MutationObserver est pris sur la fenetre du document, pas sur le
    // scope global -- meme raison que pour le constructeur Event plus haut :
    // dans un environnement ou ce script est evalue depuis Node, le global
    // n'en possede pas, et un simple `typeof MutationObserver` aurait
    // silencieusement desactive l'observateur.
    var W = (select.ownerDocument && select.ownerDocument.defaultView) || window;
    if (W.MutationObserver) {
      new W.MutationObserver(majLibelle).observe(select, {
        attributes: true,
        attributeFilter: ["disabled"],
        childList: true,
      });
    }
  }

  function balayer() {
    // #period-select vit dans la barre d outils, au-dessus des panneaux : il
    // etait hors de portee du selecteur initial alors qu il merite le meme
    // traitement que les autres.
    document.querySelectorAll(".console-pane select, .console-panel select, #period-select").forEach(ameliorer);
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".csel")) {
      document.querySelectorAll(".csel-panel.open").forEach(function (p) {
        p.classList.remove("open");
        var b = p.previousElementSibling;
        if (b) b.setAttribute("aria-expanded", "false");
      });
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      document.querySelectorAll(".csel-panel.open").forEach(function (p) { p.classList.remove("open"); });
    }
  });

  // Balayage immediat ET sur DOMContentLoaded, sans condition : la garde
  // `dataset.cselDone` rend l'operation idempotente, donc appeler deux fois
  // est sans effet. Tester readyState etait fragile -- selon l'endroit ou le
  // script est charge, l'evenement peut deja etre passe, et on n'ameliorait
  // alors aucune liste.
  balayer();
  document.addEventListener("DOMContentLoaded", balayer);
  // Plusieurs listes ne sont remplies qu'apres un appel API : on repasse.
  setTimeout(balayer, 1200);
})();
