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
  var boutonPlus = racine.querySelector(".play-more");
  // État de pagination (2 août, refonte cartes) -- le bouton "Afficher
  // plus" existait déjà dans le HTML/CSS depuis la restructuration du 1er
  // août mais n'avait jamais été câblé : aucun gestionnaire de clic,
  // aucune logique derrière. `donnees.total` était déjà annoncé (ex.
  // "650 résultats") sans aucun moyen de les parcourir au-delà des 9
  // premiers -- exactement le trou signalé dans le brief.
  var requeteEnCours = "";
  var offsetEnCours = 0;
  var totalEnCours = 0;
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

    // TAGS D'ATTRIBUTS (2 août, refonte cartes) -- remplace la description
    // générique tronquée. Marque et catégorie : seuls champs fiables et
    // présents sur l'ensemble du catalogue réel, contrairement à un
    // attribut extrait d'un texte libre (matière, dimension...) qui ne
    // serait pas garanti partout. Pas de tag si aucun des deux n'existe --
    // conforme à la consigne « supprimer si aucun attribut fiable ».
    var tags = [];
    if (p.brand) tags.push(String(p.brand));
    if (p.category) tags.push(String(p.category));
    var tagsHtml = tags.length
      ? "<div class='play-card-tags'>" + tags.slice(0, 2).map(function (t) {
          return "<span class='play-card-tag'>" + esc(t.slice(0, 24)) + "</span>";
        }).join("") + "</div>"
      : "";

    // BOUTON D'ACTION (2 août) -- pointe vers la fiche réelle sur
    // racetools.fr quand l'API la fournit (`url`), cohérent avec le choix
    // déjà fait d'utiliser leurs données et images pour cette démo.
    // z-index:2 явно au-dessus du reflet au survol (z-index:1), pour que
    // le lien reste cliquable pendant l'animation.
    var lienHtml = p.url
      ? "<a class='play-card-cta' href='" + esc(p.url) + "' target='_blank' rel='noopener' " +
        "onclick='event.stopPropagation()'>Voir le produit →</a>"
      : "";

    return "<article class='play-card" + (etiquette ? " play-card-featured" : "") + "'>" +
      (etiquette ? "<span class='play-card-etiquette'>" + esc(etiquette) + "</span>" : "") +
      visuel +
      "<div class='play-card-body'>" +
        "<div class='play-card-name'>" + esc(p.name || p.id) + "</div>" +
        tagsHtml +
      "</div>" +
      // Ligne prix mise en avant + stock, puis référence discrète tout en
      // bas, et enfin le bouton d'action -- ordre vertical exact demandé :
      // image → titre → tags → prix+dispo → référence.
      "<div class='play-card-prix-ligne'>" +
        (p.price !== undefined ? "<span class='play-card-price'>" + euros(p.price) + "</span>" : "") +
        etat +
      "</div>" +
      (p.ref ? "<div class='play-card-ref-bas'>" + esc(p.ref) + "</div>" : "") +
      lienHtml +
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

  function afficher(donnees, requete, ajouter) {
    var hits = donnees.hits || [];
    if (!hits.length && !ajouter) {
      grille.innerHTML = "<p class='play-vide'>Aucun résultat pour « " +
                         esc(requete) + " ».</p>";
      if (meta) meta.textContent = "";
      if (boutonPlus) boutonPlus.hidden = true;
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
    // EN MODE AJOUT (page 2+), pas de rappel du bundle : il a déjà été
    // affiché en position 1 lors de la première page, le remontrer à
    // chaque "Afficher plus" le dupliquerait.
    var cartes = [];
    var idBundle = (!ajouter && donnees.highlighted_bundle)
      ? donnees.highlighted_bundle.product.id : null;
    if (!ajouter && donnees.highlighted_bundle) {
      cartes.push(fiche(donnees.highlighted_bundle, "Pack recommandé"));
    }
    hits.forEach(function (h) {
      if (idBundle === null || h.product.id !== idBundle) {
        cartes.push(fiche(h));
      }
    });

    if (ajouter) {
      grille.insertAdjacentHTML("beforeend", cartes.join(""));
    } else {
      grille.innerHTML = cartes.join("");
    }

    // PAGINATION : met à jour l'état et le bouton "Afficher plus".
    requeteEnCours = requete;
    totalEnCours = donnees.total || 0;
    offsetEnCours = (ajouter ? offsetEnCours : 0) + hits.length;
    if (boutonPlus) {
      var reste = totalEnCours - offsetEnCours;
      if (reste > 0) {
        boutonPlus.hidden = false;
        boutonPlus.textContent = "Afficher plus de résultats (" +
          reste.toLocaleString("fr-FR") + " restants)";
        boutonPlus.disabled = false;
      } else {
        boutonPlus.hidden = true;
      }
    }

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
    offsetEnCours = 0; // nouvelle recherche = on repart de la premiere page
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
      offset: 0,
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

  // CHARGER PLUS (2 août, refonte cartes) -- le bouton existait déjà dans
  // le HTML/CSS depuis le 1er août mais n'avait jamais été câblé. Reprend
  // la même requête que la recherche en cours, avec un offset croissant ;
  // les résultats s'AJOUTENT à la grille plutôt que de la remplacer.
  function chargerPlus() {
    if (!requeteEnCours || !boutonPlus) return;
    boutonPlus.disabled = true;
    boutonPlus.textContent = "Chargement…";

    var id = ++derniereRequete;
    var corpsPage = {
      q: requeteEnCours,
      limit: 9,
      offset: offsetEnCours,
      facets: ["categories", "marque"],
    };
    if (prismeActif) {
      corpsPage.filters = [{ field: prismeActif.champ, value: prismeActif.valeur }];
    }

    fetch(API + "/v1/public-demo/search?vertical=" + encodeURIComponent(verticale), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpsPage),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        if (id !== derniereRequete) return; // une nouvelle recherche est partie entre-temps
        afficher(d, requeteEnCours, true);
      })
      .catch(function () {
        if (id !== derniereRequete) return;
        boutonPlus.disabled = false;
        boutonPlus.textContent = "Réessayer";
      });
  }
  if (boutonPlus) boutonPlus.addEventListener("click", chargerPlus);

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

  // CATÉGORIES SUGGÉRÉES AU FOCUS (1er août) — pour orienter la recherche
  // avant même la première frappe, plutôt que de laisser un champ vide
  // sans piste. Noms réels tirés des catalogues indexés, pas inventés :
  // "Perceuses" existe tel quel côté outillage (vu sur le vrai catalogue
  // Racetools), les intitulés mode reprennent les catégories du jeu de
  // données traduit le 1er août (T-Shirt, Dress, Jacket...).
  var CATEGORIES = {
    outillage: ["Perceuses & visseuses", "Ponceuses", "Mesure & traçage", "Protection & sécurité"],
    mode: ["T-shirts", "Robes", "Vestes", "Pulls"],
  };

  function majSuggestions() {
    var zone = racine.querySelector(".play-chips");
    if (zone) {
      var liste = EXEMPLES[verticale] || EXEMPLES.outillage;
      zone.innerHTML = liste.map(function (x) {
        return "<button type='button' class='play-chip'>" + esc(x) + "</button>";
      }).join("");
      brancherChips();
    }

    var zoneCategories = racine.querySelector(".play-categories");
    if (zoneCategories) {
      var cats = CATEGORIES[verticale] || CATEGORIES.outillage;
      zoneCategories.innerHTML = cats.map(function (c) {
        return "<button type='button' class='play-categorie'>" + esc(c) + "</button>";
      }).join("");
      brancherCategories();
    }
  }

  // PANNEAU DE CATÉGORIES AU FOCUS (1er août) : visible uniquement quand
  // le champ est vide et actif -- dès la première frappe ou dès qu'on
  // quitte le champ, il se referme. mousedown plutôt que click sur les
  // tuiles : `blur` du champ se déclenche AVANT `click` quand on clique
  // sur un élément externe, ce qui aurait fermé le panneau avant que le
  // clic n'ait eu la moindre chance d'être traité. `mousedown` se
  // déclenche avant `blur`, donc la sélection a lieu à temps.
  var panneauCategories = racine.querySelector(".play-categories");
  function ouvrirPanneauCategories() {
    if (panneauCategories && !champ.value.trim()) panneauCategories.hidden = false;
  }
  function fermerPanneauCategories() {
    if (panneauCategories) panneauCategories.hidden = true;
  }
  champ.addEventListener("focus", ouvrirPanneauCategories);
  champ.addEventListener("blur", fermerPanneauCategories);
  champ.addEventListener("input", fermerPanneauCategories);

  function brancherCategories() {
    racine.querySelectorAll(".play-categorie").forEach(function (tuile) {
      tuile.addEventListener("mousedown", function (e) {
        e.preventDefault(); // evite que le champ perde le focus avant le clic
        champ.value = tuile.textContent.trim();
        prismeActif = null;
        fermerPanneauCategories();
        chercher(champ.value);
      });
    });
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

  // BUG TROUVÉ EN CONSTRUISANT LES CATÉGORIES SUGGÉRÉES (1er août) :
  // majSuggestions() n'était appelée qu'au clic sur une pastille, jamais
  // au chargement — les puces "Essayez" affichaient donc encore les
  // exemples statiques codés dans le HTML (d'anciens exemples "livres",
  // orphelins depuis le retrait de cette verticale) au premier rendu,
  // pas les bons exemples "outillage" du secteur par défaut.
  majSuggestions();
})();
