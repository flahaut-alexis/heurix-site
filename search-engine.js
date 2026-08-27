// search-engine.js — Heurix Search, logique partagée FR/EN.
//
// Chantier S4 (5 août 2026). Extrait de search.js/search-en.js, qui ne
// différaient que sur UNE ligne de logique réelle (le calcul du chemin
// relatif "root") au milieu de données par ailleurs légitimement
// différentes par langue (titres, extraits, chemins, derniers articles
// publiés — pas de simples traductions, du vrai contenu distinct).
//
// Le mécanisme T()/DICT de console-i18n.js NE S'APPLIQUE PAS ici : il
// suppose une correspondance exacte de chaînes courtes traduites mot pour
// mot, alors que ce fichier gère un index de contenu structuré dont le
// contenu même diffère selon la langue. Ce qui doit être partagé, ce
// n'est pas du texte à traduire — c'est la LOGIQUE (normalize, highlight,
// runSearch, le câblage DOM), qui elle était réellement identique.
//
// Attend que la page ait déjà défini, AVANT ce script :
//   window.HEURIX_SEARCH_INDEX        (tableau {title, excerpt, path})
//   window.HEURIX_SEARCH_LATEST_PATHS (chemins des derniers articles)
// C'est le rôle de search.js (FR) ou search-en.js (EN), chargés juste
// avant celui-ci dans le HTML.
(function () {
  "use strict";

  var INDEX = window.HEURIX_SEARCH_INDEX || [];
  var LATEST = (window.HEURIX_SEARCH_LATEST_PATHS || [])
    .map(function (p) {
      return INDEX.filter(function (item) { return item.path === p; })[0];
    })
    .filter(Boolean);

  function normalize(str) {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  // REPLI AVEC CARTE DE POSITIONS (27 aout 2026).
  //
  // POURQUOI UNE CARTE PLUTOT QU'UN indexOf SUR DEUX CHAINES. L'ancien
  // `highlight` cherchait dans le texte NORMALISE et decoupait le texte
  // ORIGINAL au meme indice, en supposant que la normalisation preserve les
  // longueurs. Elle les preserve pour les accents precomposes du latin
  // (« e » aigu se decompose en deux caracteres puis en reperd un), et c'est
  // pourquoi le defaut ne s'est jamais vu. Elle ne les preserve pas en
  // general : l'eszett allemand donne « ss », la ligature « oe » donne deux
  // caracteres. Un seul de ces caracteres dans un titre decalait tout le
  // surlignage a sa droite, sans erreur ni signal.
  //
  // C'est exactement le defaut que le coeur natif a corrige le meme jour
  // (fold_avec_positions, heurix-engine-fst) : constater une egalite de
  // longueur ne remplace pas traduire chaque position. On construit donc la
  // carte ici aussi -- une entree par caractere replie, portant l'indice du
  // caractere SOURCE dont il provient.
  function replier(src) {
    var out = "";
    var carte = [];
    for (var i = 0; i < src.length; i++) {
      var f = src[i].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      for (var k = 0; k < f.length; k++) {
        out += f[k];
        carte.push(i);
      }
    }
    return { texte: out, carte: carte };
  }

  // Un caractere de mot, au sens du surlignage : ce qui ne doit pas etre
  // coupe en deux a l'ecran. Les accents en font partie -- « r », « e »
  // accentue et « f » appartiennent au meme mot dans « reference ».
  function estCarMot(c) {
    return c !== undefined && /[0-9A-Za-z\u00C0-\u024F]/.test(c);
  }

  // DECOUPE UN TEXTE EN SEGMENTS A SURLIGNER OU NON.
  //
  // Deux corrections par rapport a l'ancien `highlight`, qui rendait une
  // CHAINE HTML concatenee :
  //
  //   1. LE MOT ENTIER. « Recher » dans « Recherche » surlignait « Recher »
  //      et laissait « che » en dehors, coupant le mot en deux a l'ecran.
  //      L'empan s'etend desormais aux frontieres du mot qui le contient.
  //
  //   2. AUCUN HTML CONSTRUIT PAR CONCATENATION. L'ancien rendu passait par
  //      innerHTML. La requete ne pouvait pas s'y injecter -- elle ne sert
  //      qu'a localiser -- mais le TEXTE DE L'INDEX, si : un titre portant
  //      « <b> » s'affichait en gras. C'etait sans danger tant que l'index
  //      etait ecrit a la main. Il va devenir DERIVE du contenu des pages :
  //      la confiance disparait, et le rendu passe par des noeuds texte.
  function segmenter(text, query) {
    if (!query) return [{ t: text, marque: false }];
    var r = replier(text);
    var q = replier(query).texte;
    if (!q) return [{ t: text, marque: false }];
    var i = r.texte.indexOf(q);
    if (i === -1) return [{ t: text, marque: false }];

    var debut = r.carte[i];
    var fin = r.carte[i + q.length - 1] + 1;
    while (debut > 0 && estCarMot(text[debut - 1]) && estCarMot(text[debut])) debut--;
    while (fin < text.length && estCarMot(text[fin]) && estCarMot(text[fin - 1])) fin++;

    var segments = [];
    if (debut > 0) segments.push({ t: text.slice(0, debut), marque: false });
    segments.push({ t: text.slice(debut, fin), marque: true });
    if (fin < text.length) segments.push({ t: text.slice(fin), marque: false });
    return segments;
  }

  /** Ecrit le texte surligne dans `el`, par noeuds -- jamais par innerHTML. */
  function poser(el, text, query) {
    segmenter(text, query).forEach(function (seg) {
      if (!seg.t) return;
      if (seg.marque) {
        var m = document.createElement("mark");
        m.textContent = seg.t;
        el.appendChild(m);
      } else {
        el.appendChild(document.createTextNode(seg.t));
      }
    });
  }

  function runSearch(query) {
    var nQuery = normalize(query.trim());
    if (!nQuery) return [];
    return INDEX
      .map(function (item) {
        var nTitle = normalize(item.title);
        var nExcerpt = normalize(item.excerpt);
        var score = -1;
        if (nTitle.indexOf(nQuery) !== -1) score = nTitle.indexOf(nQuery) === 0 ? 2 : 1;
        else if (nExcerpt.indexOf(nQuery) !== -1) score = 0;
        return { item: item, score: score };
      })
      .filter(function (r) { return r.score >= 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .map(function (r) { return r.item; })
      .slice(0, 8);
  }

  // GÉNÉRALISATION (chantier S4). L'ancien code FR ne testait que
  // `.includes("/blog/")` -- jamais exercé en pratique (aucune page FR
  // dans blog/ ne chargeait ce script). L'ancien code EN testait
  // spécifiquement `/en/blog/` puis `/en/`, codé en dur pour cette seule
  // langue. Cette version compte les segments du chemin, sans connaître
  // à l'avance la structure de dossiers : correcte pour une profondeur
  // arbitraire, dans n'importe quelle langue, y compris des pages qui
  // n'existent pas encore. Validée sur tous les cas réels (racine FR/EN,
  // en/blog/*) et hypothétiques (blog/*, solutions/* en français) avant
  // d'être mise en service.
  function calculerRoot() {
    var segments = window.location.pathname.split("/").filter(Boolean);
    var profondeur = Math.max(segments.length - 1, 0);
    var root = "";
    for (var i = 0; i < profondeur; i++) root += "../";
    return root;
  }

  function init() {
    var root = calculerRoot();
    var btn = document.getElementById("heurix-search-btn");
    var modal = document.getElementById("heurix-search-modal");
    var backdrop = document.getElementById("heurix-search-backdrop");
    var input = document.getElementById("heurix-search-input");
    var resultsEl = document.getElementById("heurix-search-results");
    var emptyEl = document.getElementById("heurix-search-empty");
    var suggestLabel = document.getElementById("heurix-search-suggest-label");
    if (!btn || !modal) return;

    function renderItems(items, query) {
      resultsEl.innerHTML = "";
      items.forEach(function (item) {
        var a = document.createElement("a");
        a.className = "search-result";
        a.href = root + item.path;
        var titre = document.createElement("div");
        titre.className = "search-result-title";
        poser(titre, item.title, query);
        var extrait = document.createElement("div");
        extrait.className = "search-result-excerpt";
        poser(extrait, item.excerpt, query);
        a.appendChild(titre);
        a.appendChild(extrait);
        resultsEl.appendChild(a);
      });
    }

    function showDefaultSuggestions() {
      emptyEl.hidden = true;
      if (suggestLabel) suggestLabel.hidden = false;
      renderItems(LATEST, "");
    }

    function open() {
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
      input.value = "";
      showDefaultSuggestions();
      setTimeout(function () { input.focus(); }, 10);
      if (window.dataLayer) window.dataLayer.push({ event: "site_search_open" });
    }
    function close() {
      modal.classList.remove("open");
      document.body.style.overflow = "";
    }

    btn.addEventListener("click", open);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("open")) close();
      if ((e.key === "/" || (e.ctrlKey && e.key === "k") || (e.metaKey && e.key === "k")) &&
          document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        open();
      }
    });

    input.addEventListener("input", function () {
      var q = input.value;
      if (!q.trim()) {
        showDefaultSuggestions();
        return;
      }
      if (suggestLabel) suggestLabel.hidden = true;
      var results = runSearch(q);
      emptyEl.hidden = results.length !== 0;
      renderItems(results, q);
    });

    modal.querySelectorAll("[data-search-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });
  }

  // Exposees pour les tests : ce sont les deux fonctions dont le
  // comportement se verifie sans DOM complet.
  if (typeof window !== "undefined") {
    window.__heurixSearchInterne = { segmenter: segmenter, replier: replier };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
