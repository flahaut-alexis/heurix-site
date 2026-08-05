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

  function highlight(text, query) {
    if (!query) return text;
    var nText = normalize(text);
    var nQuery = normalize(query);
    var idx = nText.indexOf(nQuery);
    if (idx === -1) return text;
    return text.slice(0, idx) + "<mark>" + text.slice(idx, idx + query.length) + "</mark>" + text.slice(idx + query.length);
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
        a.innerHTML =
          '<div class="search-result-title">' + highlight(item.title, query) + "</div>" +
          '<div class="search-result-excerpt">' + highlight(item.excerpt, query) + "</div>";
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
