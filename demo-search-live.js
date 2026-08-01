/* Démonstration de la page d'accueil — branchée sur le VRAI moteur.
 *
 * POURQUOI CE REMPLACEMENT. La version précédente réimplémentait le moteur
 * en JavaScript : 1 129 lignes de normalisation, distance de
 * Damerau-Levenshtein, cascade de règles et scoring.
 *
 * Elle avait déjà divergé. Aucun correctif de la semaine du 28 juillet n'y
 * figurait : ni le « × » typographique, ni « M8-20 », ni la virgule décimale
 * de « 2,5mm² ». Concrètement, la démonstration ne faisait pas ce que le
 * moteur fait — un prospect tapant « M8×20 » y échouait alors que le vrai
 * moteur trouve.
 *
 * Une démonstration qui montre une version périmée du produit est pire
 * qu'absente : elle prouve le contraire de ce qu'on veut prouver.
 *
 * CE FICHIER NE CONTIENT PLUS AUCUNE LOGIQUE DE MOTEUR. Il appelle l'API,
 * affiche ce qu'elle renvoie. Chaque correctif moteur profite désormais
 * immédiatement à la démonstration.
 *
 * AUCUNE CLÉ N'EST NÉCESSAIRE. Le moteur expose `/v1/public-demo/search`,
 * sans authentification, restreint au catalogue « public-demo » et en
 * lecture seule. La limitation de débit est appliquée côté serveur.
 *
 * C'est la bonne porte : exposer une clé publique dans la page d'accueil
 * aurait demandé une gestion de domaines autorisés et un quota à surveiller,
 * pour un usage qui ne le justifie pas.
 */
(function () {
  "use strict";

  var API = "https://api.heurix.fr";


  var racine = document.querySelector(".play");
  if (!racine) return;

  var champ = racine.querySelector(".play-input");
  var grille = racine.querySelector(".play-grid");
  var meta = racine.querySelector(".play-meta");
  var zonePrismes = racine.querySelector(".play-prisms");
  if (!champ || !grille) return;

  // Pulse d'appel sur la barre de recherche (1er août) : retiré
  // DÉFINITIVEMENT dès la première interaction, jamais réactivé ensuite.
  // {once:true} sur les deux évènements suffit à garantir ce comportement
  // sans variable d'état à maintenir à la main.
  var barre = racine.querySelector(".play-bar");
  if (barre) {
    var arreterPulse = function () { barre.classList.remove("play-bar-pulse"); };
    champ.addEventListener("focus", arreterPulse, { once: true });
    champ.addEventListener("input", arreterPulse, { once: true });
  }


  var minuteur = null;
  var derniereRequete = 0;
  // Chronomètre de la requête en cours. AU NIVEAU DU MODULE, pas dans
  // chercher() : afficher() le lit pour écrire « X résultats en Y ms »,
  // et une variable locale à chercher() lui serait invisible.
  //
  // DÉFAUT VÉCU (30 juillet) : déclaré local, il provoquait une
  // ReferenceError à CHAQUE affichage — attrapée par le .catch réseau, qui
  // affichait « Démonstration momentanément indisponible » sur toutes les
  // verticales. Le message d'honnêteté conçu pour les pannes réseau
  // masquait un défaut de code. Leçon : le .catch distingue désormais les
  // erreurs de programmation, qu'il laisse remonter à la console.
  var chrono = 0;
  var prismeActif = null;

  // VERTICALE COURANTE. Le sélecteur porte l'argument des dix secteurs :
  // le même moteur, des règles différentes. Le retirer aurait fait perdre
  // ce que la page d'accueil démontre de plus important.
  var pastilles = racine.querySelectorAll(".play-vertical-pill");

  // LA VERTICALE DE DÉPART SE LIT DANS LA PAGE, elle n'est pas décidée ici.
  //
  // DÉFAUT CORRIGÉ. Je l'avais figée sur « outillage » alors que le HTML
  // affiche des suggestions de LIVRES au chargement. Un visiteur cliquait
  // « polar scandinave poche », le widget cherchait dans un catalogue de
  // visserie, et n'obtenait rien. La démonstration semblait cassée.
  var verticale = "outillage";
  var active = racine.querySelector(".play-vertical-on") ||
               racine.querySelector(".play-vertical-pill-on") ||
               racine.querySelector(".play-vertical-pill.active") ||
               racine.querySelector('.play-vertical-pill[aria-pressed="true"]');
  if (active && active.getAttribute("data-vertical")) {
    verticale = active.getAttribute("data-vertical");
  } else if (pastilles.length && pastilles[0].getAttribute("data-vertical")) {
    // À défaut de marquage, la PREMIÈRE pastille gouverne : c'est celle que
    // le visiteur voit en tête, et celle dont les suggestions sont
    // affichées dans le HTML.
    verticale = pastilles[0].getAttribute("data-vertical");
  }

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/'/g, "&#39;").replace(/"/g, "&quot;");
  }

  function euros(n) {
    return n === undefined || n === null
      ? "" : Number(n).toFixed(2).replace(".", ",") + " €";
  }

  function fiche(hit, etiquette) {
    var p = hit.product || {};
    // IMAGE OPTIONNELLE. Si le catalogue en porte une, on l'affiche ; sinon
    // on montre la RÉFÉRENCE en grand, ce qui est plus honnête qu'un cadre
    // vide et plus pertinent pour un catalogue technique : un acheteur de
    // visserie reconnaît « M8x20 A2 », pas la photo d'une vis grise.
    //
    // `onerror` masque le visuel si l'URL est cassée : une image absente
    // vaut mieux qu'une icône de fichier introuvable.
    // ORDRE : image réelle si le catalogue en porte une, sinon pictogramme
    // choisi par le moteur, sinon la référence. Le pictogramme n'est pas un
    // habillage : il montre que Heurix a RECONNU la famille du produit.
    var visuel;
    if (p.image || p.image_url) {
      // SI L'IMAGE ÉCHOUE, LE PICTOGRAMME PREND LE RELAIS. Masquer le cadre
      // laissait un trou : sur Open Library, une couverture sur deux manque,
      // et la grille devenait irrégulière.
      var replPicto = window.HeurixPictos
        ? window.HeurixPictos.pictogramme(hit.matched || [])
            .replace(/'/g, "&#39;").replace(/"/g, "&quot;")
        : "";
      visuel = "<div class='play-card-img'><img src='" + esc(p.image || p.image_url) +
               "' alt='' loading='lazy' onerror=\"var d=this.closest('.play-card-img');" +
               "d.className='play-card-picto';d.innerHTML='" + replPicto + "';\"></div>";
    } else if (window.HeurixPictos) {
      visuel = "<div class='play-card-picto'>" +
               window.HeurixPictos.pictogramme(hit.matched || []) + "</div>";
    } else {
      visuel = "<div class='play-card-vign'>" + esc((p.ref || p.id || "").slice(0, 14)) + "</div>";
    }
    var etat = hit.in_stock === false
      ? "<span class='play-rupture'>Rupture</span>"
      : "<span class='play-stock'>En stock</span>";
    // LES ÉTIQUETTES BRUTES SONT RETIRÉES DE LA PAGE PUBLIQUE.
    //
    // « FAM_CHEMISE » ne dit rien à un visiteur : c'est du vocabulaire
    // interne. Dans la console, où le marchand règle son moteur, l'afficher
    // est utile ; sur la vitrine, c'est du bruit qui fait paraître le
    // produit inachevé.
    //
    // Ce que le moteur a compris se montre autrement : par le pictogramme,
    // qui change selon la famille reconnue, et par le filtre de prix affiché
    // en clair sous les résultats.
    // CE QU'ON MONTRE, ET DANS QUEL ORDRE.
    //
    // La carte n'affichait que nom, référence et stock. Sur un livre, cela
    // donnait « Nick Drake / 0747535035 / En stock » — l'auteur, qui est la
    // seule information utile après le titre, restait invisible.
    //
    // La description porte l'auteur pour les livres, la contenance pour les
    // vins, la norme pour la visserie. C'est toujours le complément le plus
    // parlant après le nom.
    // On évite la redondance : « Chemise coton vert taille M » suivi de
    // « Olow — M » répétait la taille. On ne garde la description que si
    // elle apporte autre chose que ce que le nom contient déjà.
    var secondaire = p.description || p.marque || "";
    if (secondaire && p.name) {
      var reste = String(secondaire).split(/[—–-]/)[0].trim();
      secondaire = reste && p.name.toLowerCase().indexOf(reste.toLowerCase()) === -1
        ? reste : (p.marque && p.name.toLowerCase().indexOf(String(p.marque).toLowerCase()) === -1
                   ? p.marque : "");
    }
    return "<article class='play-card" + (etiquette ? " play-card-featured" : "") + "'>" +
      (etiquette ? "<span class='play-card-etiquette'>" + esc(etiquette) + "</span>" : "") +
      visuel +
      "<div class='play-card-body'>" +
        "<div class='play-card-name'>" + esc(p.name || p.id) + "</div>" +
        (secondaire ? "<div class='play-card-sub'>" + esc(String(secondaire).slice(0, 60)) + "</div>" : "") +
      "</div>" +
      // Référence, prix et stock désormais groupés : trois métadonnées de
      // même nature, alignées ensemble en pied de carte plutôt que la
      // référence livrée seule entre le texte et le badge.
      "<div class='play-card-foot'>" +
        (p.ref ? "<span class='play-card-ref'>" + esc(p.ref) + "</span>" : "") +
        (p.price !== undefined ? "<span class='play-card-price'>" + euros(p.price) + "</span>" : "") +
        etat +
      "</div>" +
    "</article>";
  }

  // Anime un <b> de 0 (ou d'une valeur proche) jusqu'à sa valeur finale,
  // sur environ 350 ms. Purement visuel : la valeur AFFICHÉE PENDANT
  // L'ANIMATION n'est jamais utilisée pour un calcul, seule la cible l'est.
  function animerCompteurMs(el, cible) {
    if (!el) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = cible;
      return;
    }
    var depart = Math.max(0, cible - Math.round(cible * 0.6) - 15);
    var t0 = null;
    var duree = 350;
    // RÉFÉRENCÉ VIA window, PAS EN GLOBALE NUE. Le widget est destiné à
    // être intégré tel quel chez des clients — l'appel direct à un
    // identifiant global dépend de contextes d'exécution qu'on ne
    // contrôle pas tous. Le repli en `setTimeout` couvre les rares
    // environnements sans `requestAnimationFrame`.
    var rAF = (window.requestAnimationFrame || function (cb) { return setTimeout(function () { cb(Date.now()); }, 16); }).bind(window);
    function pas(t) {
      if (t0 === null) t0 = t;
      var avancement = Math.min(1, (t - t0) / duree);
      // Ease-out : rapide au départ, se stabilise en douceur sur la
      // valeur exacte — perceptible sans être criard.
      var valeur = Math.round(depart + (cible - depart) * (1 - Math.pow(1 - avancement, 3)));
      el.textContent = valeur;
      if (avancement < 1) rAF(pas);
    }
    rAF(pas);
  }

  function afficher(donnees, requete) {
    var hits = donnees.hits || [];
    if (!hits.length) {
      grille.innerHTML = "<p class='play-vide'>Aucun résultat pour « " +
                         esc(requete) + " ».</p>";
      if (meta) meta.textContent = "";
      return;
    }

    // MISE EN AVANT MARCHANDE — RÉVISÉ LE 1er AOÛT.
    //
    // Version précédente : une zone séparée au-dessus de la grille,
    // occupant toute une rangée pour une seule carte. Corrigé : le pack
    // recommandé occupe désormais la POSITION 1 de la grille elle-même —
    // même taille de carte, juste une étiquette dessus — et les meilleurs
    // produits suivent en positions 2, 3, 4...
    //
    // DÉDOUBLONNAGE : `highlighted_bundle` est choisi indépendamment de
    // `hits` (voir la doc de l'API) — si le même produit se trouve être
    // AUSSI le meilleur résultat naturel, on ne veut pas le voir deux
    // fois. On le retire de `hits` avant de composer la grille finale.
    var cartes = [];
    var idBundle = donnees.highlighted_bundle
      ? donnees.highlighted_bundle.product.id : null;
    if (donnees.highlighted_bundle) {
      cartes.push(fiche(donnees.highlighted_bundle, "Pack recommandé"));
    }
    hits.forEach(function (h) {
      if (idBundle === null || h.product.id !== idBundle) {
        cartes.push(fiche(h));
      }
    });
    grille.innerHTML = cartes.slice(0, 9).join("");

    if (meta) {
      var ms = Math.max(1, Math.round(performance.now() - chrono));

      // LE TEMPS DE RÉPONSE DEVIENT UN ARGUMENT VISUEL, PAS UNE MENTION.
      //
      // Nombre de résultats et temps de réponse sont désormais deux
      // ÉLÉMENTS séparés — pas une seule phrase — pour styliser le
      // chiffre en ms indépendamment : plus grand, en gras, dans la
      // couleur d'accent de la marque plutôt que le gris neutre.
      //
      // AUCUNE COMPARAISON CHIFFRÉE N'EST AFFICHÉE. « Plus rapide que 95 %
      // des moteurs » n'est mesuré nulle part — l'écrire serait inventer
      // une statistique sur notre propre page. Le chiffre mesuré, affiché
      // clairement, est un argument suffisant et vérifiable : n'importe
      // quel visiteur peut le reproduire en tapant une recherche.
      var bouts = [];
      var filtre = "";
      if (donnees.price_filter) {
        var f = donnees.price_filter;
        filtre = " · " + (f.max !== null && f.min !== null
          ? "filtre : entre " + euros(f.min) + " et " + euros(f.max)
          : f.max !== null ? "filtre : moins de " + euros(f.max)
          : "filtre : plus de " + euros(f.min));
      }
      meta.innerHTML =
        "<span class='play-meta-count'>" + donnees.total.toLocaleString("fr-FR") +
        " résultats</span>" +
        "<span class='play-meta-speed'>" +
          "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M13 2 3 14h7l-1 8 11-14h-7z'/></svg>" +
          "<b class='play-meta-ms' data-cible='" + ms + "'>" + ms + "</b> ms" +
        "</span>" +
        (filtre ? "<span class='play-meta-filtre'>" + esc(filtre) + "</span>" : "");

      // MICRO-ANIMATION DE COMPTAGE, ~350 ms, requestAnimationFrame.
      //
      // Elle ne retarde JAMAIS l'affichage des résultats — la grille est
      // déjà à l'écran avant que cette animation ne commence. Elle habille
      // un chiffre déjà exact, elle ne le fait pas attendre.
      animerCompteurMs(meta.querySelector(".play-meta-ms"), ms);
    }

    // Les facettes deviennent des prismes cliquables — le vocabulaire de la
    // page d'accueil, conservé.
    if (zonePrismes && donnees.facets) {
      var prismes = [];
      Object.keys(donnees.facets).forEach(function (champFacette) {
        (donnees.facets[champFacette] || []).slice(0, 5).forEach(function (v) {
          prismes.push({ champ: champFacette, valeur: v.value, n: v.count });
        });
      });
      zonePrismes.innerHTML = prismes.slice(0, 8).map(function (p) {
        var actif = prismeActif && prismeActif.valeur === p.valeur;
        return "<button type='button' class='play-prism" + (actif ? " play-prism-on" : "") +
               "' data-champ='" + esc(p.champ) + "' data-valeur='" + esc(p.valeur) + "'>" +
               esc(p.valeur) + " <em>" + p.n + "</em></button>";
      }).join("");
      zonePrismes.querySelectorAll(".play-prism").forEach(function (b) {
        b.addEventListener("click", function () {
          var v = b.getAttribute("data-valeur");
          prismeActif = (prismeActif && prismeActif.valeur === v)
            ? null
            : { champ: b.getAttribute("data-champ"), valeur: v };
          chercher(champ.value);
        });
      });
    }
  }

  function chercher(requete) {
    requete = (requete || "").trim();
    if (!requete) {
      grille.innerHTML = "";
      if (meta) meta.textContent = "";
      if (zonePrismes) zonePrismes.innerHTML = "";
      return;
    }

    var id = ++derniereRequete;
    // TEMPS DE RÉPONSE MESURÉ, affiché sous les résultats.
    //
    // Meilisearch affiche « 8 results in 1ms » sous sa démonstration : le
    // chiffre EST l'argument. Nous n'avons pas de logos clients à montrer ;
    // nous avons des mesures. Autant les afficher là où elles se produisent.
    //
    // C'est le temps TOTAL perçu (réseau compris), pas le temps moteur :
    // annoncer le second en mesurant le premier serait mentir en notre
    // faveur les bons jours et en notre défaveur les mauvais.
    chrono = performance.now();
    var corps = {
      q: requete,
      limit: 9,
      facets: ["categories", "marque"],
    };
    if (prismeActif) {
      corps.filters = [{ field: prismeActif.champ, value: prismeActif.valeur }];
    }

    fetch(API + "/v1/public-demo/search?vertical=" + encodeURIComponent(verticale), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        if (id !== derniereRequete) return;   // une frappe plus récente est partie
        afficher(d, requete);
      })
      .catch(function (e) {
        if (id !== derniereRequete) return;
        // Une erreur de PROGRAMMATION (ReferenceError, TypeError) n'est pas
        // une panne réseau : l'afficher comme telle mentirait au visiteur
        // et nous cacherait le défaut. On la journalise et on la laisse
        // visible en console.
        if (e instanceof ReferenceError || e instanceof TypeError) {
          console.error("Défaut du widget (pas une panne réseau) :", e);
        }
        // Un 429 signifie que le visiteur tape très vite : la limitation de
        // débit du serveur a mordu. On le distingue d'une vraie panne.
        if (String(e.message).indexOf("429") !== -1) {
          grille.innerHTML = "<p class='play-vide'>Trop de recherches d'affilée — " +
                             "patientez une seconde.</p>";
          return;
        }
        // MESSAGE HONNÊTE. Un écran vide laisserait croire à un produit
        // cassé ; dire que la démonstration est indisponible préserve la
        // crédibilité du moteur.
        grille.innerHTML = "<p class='play-vide'>Démonstration momentanément " +
                           "indisponible. Le moteur reste joignable par API.</p>";
        if (meta) meta.textContent = "";
      });
  }

  champ.addEventListener("input", function () {
    clearTimeout(minuteur);
    minuteur = setTimeout(function () { chercher(champ.value); }, 220);
  });

  // EXEMPLES PAR SECTEUR. Une suggestion « M8x20 » sur la verticale Mode
  // ne démontrerait rien : chaque secteur a son vocabulaire, et c'est
  // précisément ce que le sélecteur illustre.
  var EXEMPLES = {
    outillage: ["M8x20 inox", "vis inox moins de 2 euros", "DIN 933", "rondele"],
    mode: ["pull laine rouge taille L", "jean slim W32", "chemise rayée"],
  };

  function majSuggestions() {
    var zone = racine.querySelector(".play-chips");
    if (!zone) return;
    var liste = EXEMPLES[verticale] || EXEMPLES.outillage;
    zone.innerHTML = liste.map(function (x) {
      return "<button type='button' class='play-chip'>" + esc(x) + "</button>";
    }).join("");
    brancherChips();
  }

  pastilles.forEach(function (pill) {
    pill.addEventListener("click", function () {
      var v = pill.getAttribute("data-vertical");
      if (!v || v === verticale) return;
      verticale = v;
      pastilles.forEach(function (p) {
        // On bascule la classe REELLE du site, pas une inventee : sinon la
        // pastille active resterait visuellement inchangee.
        p.classList.toggle("play-vertical-on", p === pill);
      });
      prismeActif = null;
      majSuggestions();
      // On relance la recherche courante sur le nouveau secteur : c'est ce
      // qui montre que les RÈGLES changent, pas seulement les données.
      if (champ.value.trim()) chercher(champ.value);
      else { grille.innerHTML = ""; if (meta) meta.textContent = ""; }
      // Repositionne le curseur dans le champ (signalé le 31 juillet) :
      // sans ça, le focus restait sur la pastille cliquée et il fallait
      // recliquer dans le champ pour retaper une requête — un geste en
      // trop à chaque changement de secteur.
      champ.focus();
    });
  });

  // Les suggestions de la page d'accueil restent cliquables.
  function brancherChips() {
    racine.querySelectorAll(".play-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        champ.value = chip.textContent.trim();
        prismeActif = null;
        chercher(champ.value);
      });
    });
  }
  brancherChips();

  // La pastille du secteur par défaut doit être marquée au chargement.
  pastilles.forEach(function (p) {
    if (p.getAttribute("data-vertical") === verticale) {
      p.classList.add("play-vertical-pill-on");
    }
  });
})();
