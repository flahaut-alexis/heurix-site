/* Recueil du consentement aux traceurs — Heurix
 *
 * CONTEXTE. Google Tag Manager (GTM-PGLPLKDP) était chargé dans le <head> de
 * 46 pages, console incluse, AVANT toute action du visiteur. C'était une
 * non-conformité en cours, aggravée par une phrase de la politique de
 * confidentialité affirmant que le site ne déposait aucun cookie de mesure
 * d'audience.
 *
 * Ce module inverse la logique : plus aucun traceur ne part avant un choix
 * explicite, et GTM n'est injecté qu'après acceptation de la catégorie
 * correspondante.
 *
 * POURQUOI À LA PREMIÈRE VISITE ET NON À LA CONNEXION. La quasi-totalité des
 * visiteurs d'un site vitrine ne se connectent jamais. Attendre la connexion
 * laisserait les traceurs se déposer pour tout le monde, ce qui vide la
 * mesure de son sens.
 *
 * CHOIX CNIL RESPECTÉS :
 *   - trois actions d'emblée visibles, de POIDS VISUEL ÉGAL. Un « Tout
 *     accepter » mis en avant par rapport au refus est un point de contrôle
 *     fréquent : le refus doit être aussi accessible que l'acceptation, en un
 *     seul clic et sans détour par un sous-menu ;
 *   - cases DÉCOCHÉES par défaut dans le mode détaillé — l'absence de choix
 *     ne vaut pas consentement ;
 *   - la catégorie « nécessaire » n'est pas désactivable, et c'est signalé :
 *     elle n'est pas soumise à consentement, la présenter comme un choix
 *     serait trompeur ;
 *   - le site fonctionne à l'identique après un refus total. Aucune
 *     dégradation, aucun rappel insistant ;
 *   - validité de 6 mois, puis nouvelle demande ;
 *   - réouverture possible à tout moment depuis le pied de page.
 *
 * PREUVE DU CONSENTEMENT. Pour un site de cette taille, un enregistrement
 * horodaté côté client est proportionné. Il porte la version du texte
 * présenté : sans elle, on ne pourrait pas démontrer À QUOI le visiteur a
 * consenti, seulement qu'il a cliqué.
 */
(function () {
  "use strict";

  var CLE = "heurix_consentement";
  var VALIDITE_MOIS = 6;
  // À incrémenter dès que les finalités ou les outils changent : un
  // consentement donné sur un texte antérieur ne couvre pas un nouvel outil.
  var VERSION_TEXTE = 1;

  var GTM_ID = "GTM-PGLPLKDP";

  // Langue lue sur <html lang> : un second fichier de traduction
  // divergerait du premier des la premiere modification.
  var LANGUE = (document.documentElement.lang || "fr").slice(0, 2).toLowerCase();
  var EN = LANGUE === "en";

  var T = EN ? {
    titre: "Your privacy preferences",
    intro: "We use trackers to measure site traffic and the effectiveness of " +
           "our campaigns. You can refuse them — the site works exactly the same.",
    refuser: "Reject all",
    personnaliser: "Customise",
    enregistrer: "Save my choices",
    accepter: "Accept all",
    politique: "Privacy policy",
    lienPolitique: "privacy.html",
    toujoursActif: "(always on)",
    categories: [
      { cle: "necessaire", titre: "Strictly necessary", obligatoire: true,
        texte: "Keeps you signed in to the client area and remembers your " +
               "display preferences. Sign-in does not work without them." },
      { cle: "mesure", titre: "Traffic measurement and usability", obligatoire: false,
        texte: "Helps us understand which pages are viewed and where visitors " +
               "drop off, so we can improve the site." },
      { cle: "commercial", titre: "Marketing and advertising", obligatoire: false,
        texte: "Measures how well our campaigns perform and shows our ads on " +
               "other sites." },
    ],
  } : {
    titre: "Vos préférences de confidentialité",
    intro: "Nous utilisons des traceurs pour mesurer l'audience du site et " +
           "l'efficacité de nos campagnes. Vous pouvez les refuser : le site " +
           "fonctionne à l'identique.",
    refuser: "Tout refuser",
    personnaliser: "Personnaliser",
    enregistrer: "Enregistrer mes choix",
    accepter: "Tout accepter",
    politique: "Politique de confidentialité",
    lienPolitique: "confidentialite.html",
    toujoursActif: "(toujours actif)",
    categories: [
      { cle: "necessaire", titre: "Strictement nécessaire", obligatoire: true,
        texte: "Maintien de votre session sur l'espace client et mémorisation " +
               "de vos préférences d'affichage. Sans eux, la connexion ne " +
               "fonctionne pas." },
      { cle: "mesure", titre: "Mesure d'audience et ergonomie", obligatoire: false,
        texte: "Nous aide à comprendre quelles pages sont consultées et où les " +
               "visiteurs abandonnent, pour améliorer le site." },
      { cle: "commercial", titre: "Commercial et publicité", obligatoire: false,
        texte: "Mesure de l'efficacité de nos campagnes et affichage de nos " +
               "annonces sur d'autres sites." },
    ],
  };

  var CATEGORIES = T.categories;

  // ---------------------------------------------------------------- stockage

  function lire() {
    try {
      var brut = window.localStorage.getItem(CLE);
      if (!brut) return null;
      var d = JSON.parse(brut);
      // Un consentement expiré ou donné sur un texte antérieur ne vaut plus.
      if (d.version !== VERSION_TEXTE) return null;
      var limite = new Date(d.date);
      limite.setMonth(limite.getMonth() + VALIDITE_MOIS);
      if (new Date() > limite) return null;
      return d;
    } catch (e) {
      // localStorage indisponible (navigation privée stricte, stockage
      // désactivé) : on ne bloque pas la navigation, mais on ne dépose rien
      // non plus. Le refus est l'état par défaut sûr.
      return null;
    }
  }

  function ecrire(choix) {
    var d = {
      version: VERSION_TEXTE,
      date: new Date().toISOString(),
      choix: choix,
    };
    try { window.localStorage.setItem(CLE, JSON.stringify(d)); } catch (e) {}
    return d;
  }

  // ------------------------------------------------------------- activation

  var gtmCharge = false;

  function activerGTM() {
    if (gtmCharge) return;
    gtmCharge = true;
    // Injection différée, non bloquante : le rendu de la page ne doit pas
    // attendre un script de mesure.
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + GTM_ID;
    document.head.appendChild(s);
  }

  function appliquer(choix) {
    // GTM sert aujourd'hui les deux finalités non nécessaires. Il ne se
    // charge donc que si l'une des deux est acceptée.
    //
    // NOTE POUR LA SUITE : si vous ajoutez des balises distinctes dans le
    // conteneur (mesure d'un côté, publicité de l'autre), il faudra pousser
    // le détail du consentement dans le dataLayer et conditionner chaque
    // balise côté GTM. Charger le conteneur entier sur un consentement
    // partiel serait alors non conforme.
    if (choix.mesure || choix.commercial) {
      activerGTM();
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "heurix_consentement",
        consentement_mesure: !!choix.mesure,
        consentement_commercial: !!choix.commercial,
      });
    }
  }

  // ---------------------------------------------------------------- interface

  var fond = null;

  function fermer() {
    if (fond) { fond.remove(); fond = null; }
    document.removeEventListener("keydown", surTouche);
  }

  function surTouche(e) {
    // Échap ne vaut PAS refus : ce serait interpréter un geste ambigu comme
    // un choix. La bannière reste, le visiteur navigue quand même — rien
    // n'est déposé tant qu'il n'a pas tranché.
    if (e.key === "Tab" && fond) piegerFocus(e);
  }

  function piegerFocus(e) {
    var focusables = fond.querySelectorAll("button, input, a[href]");
    if (!focusables.length) return;
    var premier = focusables[0], dernier = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === premier) {
      e.preventDefault(); dernier.focus();
    } else if (!e.shiftKey && document.activeElement === dernier) {
      e.preventDefault(); premier.focus();
    }
  }

  function valider(choix) {
    ecrire(choix);
    appliquer(choix);
    fermer();
  }

  function afficher(detail) {
    fermer();
    fond = document.createElement("div");
    fond.className = "consent-fond";
    fond.setAttribute("role", "dialog");
    fond.setAttribute("aria-modal", "false");
    fond.setAttribute("aria-labelledby", "consent-titre");

    var html =
      "<div class='consent-boite'>" +
        "<p class='consent-titre' id='consent-titre'>" + T.titre + "</p>" +
        "<p class='consent-texte'>" + T.intro + "</p>";

    if (detail) {
      html += "<div class='consent-categories'>";
      CATEGORIES.forEach(function (cat) {
        html +=
          "<div class='consent-categorie'>" +
            "<label class='consent-cat-head'>" +
              "<input type='checkbox' data-cat='" + cat.cle + "'" +
                (cat.obligatoire ? " checked disabled" : "") + ">" +
              "<span class='consent-cat-titre'>" + cat.titre +
                (cat.obligatoire ? " <em>" + T.toujoursActif + "</em>" : "") + "</span>" +
            "</label>" +
            "<p class='consent-cat-texte'>" + cat.texte + "</p>" +
          "</div>";
      });
      html += "</div>";
    }

    // Les trois actions ont la MÊME classe et le même poids visuel.
    // « Personnaliser » disparaît en mode détaillé, remplacé par
    // l'enregistrement du choix.
    html +=
      "<div class='consent-actions'>" +
        "<button type='button' class='consent-btn' data-action='refuser'>" + T.refuser + "</button>" +
        (detail
          ? "<button type='button' class='consent-btn' data-action='enregistrer'>" + T.enregistrer + "</button>"
          : "<button type='button' class='consent-btn' data-action='personnaliser'>" + T.personnaliser + "</button>") +
        "<button type='button' class='consent-btn' data-action='accepter'>" + T.accepter + "</button>" +
      "</div>" +
      "<p class='consent-lien'><a href='" + (window.HEURIX_RACINE || "") +
        T.lienPolitique + "'>" + T.politique + "</a></p>" +
      "</div>";

    fond.innerHTML = html;
    document.body.appendChild(fond);
    document.addEventListener("keydown", surTouche);

    fond.addEventListener("click", function (e) {
      var b = e.target.closest("[data-action]");
      if (!b) return;
      var a = b.getAttribute("data-action");
      if (a === "accepter") {
        valider({ necessaire: true, mesure: true, commercial: true });
      } else if (a === "refuser") {
        valider({ necessaire: true, mesure: false, commercial: false });
      } else if (a === "personnaliser") {
        afficher(true);
      } else if (a === "enregistrer") {
        var choix = { necessaire: true };
        fond.querySelectorAll("input[data-cat]").forEach(function (i) {
          choix[i.getAttribute("data-cat")] = i.checked;
        });
        valider(choix);
      }
    });

    var premier = fond.querySelector("button");
    if (premier) premier.focus();
  }

  // ------------------------------------------------------------------ départ

  function init() {
    var existant = lire();
    if (existant) {
      appliquer(existant.choix);
    } else {
      afficher(false);
    }

    // Lien permanent de réouverture. Sans lui, un visiteur ne pourrait pas
    // revenir sur son choix — exigence explicite de la CNIL.
    document.querySelectorAll("[data-rouvrir-consentement]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        afficher(true);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exposé pour la console et les tests.
  window.HeurixConsentement = { afficher: afficher, lire: lire };
})();
