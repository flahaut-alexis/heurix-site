/*!
 * heurix-search.js — barre de recherche prête à l'emploi, connectée à
 * l'API Heurix réelle. Aucune dépendance, aucun framework requis.
 *
 * Chantier Phase 5 de la roadmap (25 juillet 2026). Reprend les patterns
 * de rendu déjà éprouvés dans demo-search.js — regroupement des prismes
 * par préfixe, tri par fréquence, bascule au clic — mais branché sur de
 * vrais appels fetch() vers l'API, pas un moteur simulé en local.
 *
 * Usage minimal :
 *   <div id="ma-recherche"></div>
 *   <script src="heurix-search.js"></script>
 *   <script>
 *     HeurixSearch.init({
 *       apiKey: "hx_votre_cle",
 *       catalog: "moncatalogue",
 *       container: "#ma-recherche"
 *     });
 *   </script>
 */
(function (global) {
  "use strict";

  var DEFAULT_BASE_URL = "https://api.heurix.fr";
  var DEFAULT_ACCENT = "#3D5AFE";
  var DEFAULT_DEBOUNCE_MS = 200;
  var DEFAULT_LIMIT = 8;
  var DEFAULT_PLACEHOLDER = "Rechercher un produit…";
  var MAX_FACET_VALUES_PER_GROUP = 4;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Libellé lisible pour un groupe de prisme SANS connaissance du secteur
  // du client (contrairement a demo-search.js, qui a une table de
  // libellés codee en dur par verticale) -- "DIAM" -> "Diam", generique
  // mais toujours comprehensible.
  function humanizeGroup(code) {
    return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
  }
  function humanizeValue(annotation, group) {
    var rest = annotation.slice(group.length + 1); // retire "GROUPE_" du debut
    if (!rest) return annotation;
    return rest.split("_").map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(" ");
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  var STYLE_INJECTED = false;
  function injectStyles() {
    if (STYLE_INJECTED) return;
    STYLE_INJECTED = true;
    var css = "" +
      ".hx-search{position:relative;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}" +
      ".hx-search *{box-sizing:border-box;}" +
      ".hx-search-input-wrap{position:relative;}" +
      ".hx-search-input{width:100%;padding:11px 14px 11px 38px;font-size:15px;border:1px solid #D8DAE5;border-radius:8px;outline:none;transition:border-color .15s ease,box-shadow .15s ease;}" +
      ".hx-search-input:focus{border-color:var(--hx-accent," + DEFAULT_ACCENT + ");box-shadow:0 0 0 3px color-mix(in srgb, var(--hx-accent," + DEFAULT_ACCENT + ") 18%, transparent);}" +
      ".hx-search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:#8A8DA0;pointer-events:none;}" +
      ".hx-search-meta{font-size:12.5px;color:#8A8DA0;margin:8px 2px;min-height:16px;}" +
      ".hx-search-facets{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 10px;}" +
      ".hx-search-facet-group{font-size:11.5px;font-weight:700;color:#8A8DA0;text-transform:uppercase;letter-spacing:.03em;margin-right:2px;}" +
      ".hx-search-facet{border:1px solid #D8DAE5;background:#fff;border-radius:999px;padding:4px 10px;font-size:12.5px;cursor:pointer;color:#3A3D52;transition:all .12s ease;}" +
      ".hx-search-facet:hover{border-color:var(--hx-accent," + DEFAULT_ACCENT + ");}" +
      ".hx-search-facet-on{background:var(--hx-accent," + DEFAULT_ACCENT + ");border-color:var(--hx-accent," + DEFAULT_ACCENT + ");color:#fff;}" +
      ".hx-search-facet-n{opacity:.7;margin-left:3px;}" +
      ".hx-search-results{display:flex;flex-direction:column;gap:1px;border-radius:8px;overflow:hidden;}" +
      ".hx-search-hit{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 12px;background:#fff;border:1px solid #ECEDF5;border-top:none;cursor:default;}" +
      ".hx-search-hit:first-child{border-top:1px solid #ECEDF5;border-top-left-radius:8px;border-top-right-radius:8px;}" +
      ".hx-search-hit:last-child{border-bottom-left-radius:8px;border-bottom-right-radius:8px;}" +
      ".hx-search-hit-name{font-size:14px;color:#1E2233;font-weight:600;}" +
      ".hx-search-hit-ref{font-size:12px;color:#8A8DA0;margin-top:1px;}" +
      ".hx-search-hit-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}" +
      ".hx-search-hit-price{font-size:13.5px;font-weight:700;color:#1E2233;white-space:nowrap;}" +
      ".hx-search-hit-oos{font-size:11px;color:#B23B3B;background:#FBEAEA;border-radius:5px;padding:2px 6px;white-space:nowrap;}" +
      ".hx-search-empty,.hx-search-error{padding:16px 12px;font-size:13.5px;color:#8A8DA0;text-align:center;border:1px dashed #D8DAE5;border-radius:8px;}" +
      ".hx-search-fallback-label{font-size:11.5px;font-weight:700;color:#8A8DA0;text-transform:uppercase;letter-spacing:.03em;margin:12px 2px 6px;}" +
      ".hx-search-suggested{font-size:12.5px;color:#3A3D52;background:#F4F5FA;border-radius:8px;padding:9px 12px;margin-bottom:10px;}" +
      ".hx-search-suggested strong{color:var(--hx-accent," + DEFAULT_ACCENT + ");}";
    var tag = document.createElement("style");
    tag.setAttribute("data-heurix-search", "1");
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  function HeurixSearch(config) {
    if (!config || !config.apiKey) throw new Error("HeurixSearch : 'apiKey' est requis.");
    if (!config.catalog) throw new Error("HeurixSearch : 'catalog' est requis.");
    var container = typeof config.container === "string" ? document.querySelector(config.container) : config.container;
    if (!container) throw new Error("HeurixSearch : conteneur introuvable (" + config.container + ").");

    this.apiKey = config.apiKey;
    this.catalog = config.catalog;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.container = container;
    this.limit = config.limit || DEFAULT_LIMIT;
    this.placeholder = config.placeholder || DEFAULT_PLACEHOLDER;
    this.onSelect = typeof config.onSelect === "function" ? config.onSelect : null;
    this.renderHit = typeof config.renderHit === "function" ? config.renderHit : null;
    this.facetFields = config.facets || []; // groupes a demander a l'API pour les prismes, ex. ["DIAM","MAT"]

    this._activeFilters = [];
    this._lastQuery = "";
    this._requestSeq = 0; // ignore les reponses obsoletes si une requete plus recente est deja partie

    injectStyles();
    if (config.accentColor) {
      this.container.style.setProperty("--hx-accent", config.accentColor);
    }
    this._buildDom();
    this._wireEvents();
  }

  HeurixSearch.prototype._buildDom = function () {
    this.container.classList.add("hx-search");
    this.container.innerHTML =
      '<div class="hx-search-input-wrap">' +
        '<svg class="hx-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        '<input type="text" class="hx-search-input" placeholder="' + esc(this.placeholder) + '" autocomplete="off">' +
      "</div>" +
      '<div class="hx-search-meta"></div>' +
      '<div class="hx-search-facets"></div>' +
      '<div class="hx-search-results"></div>';
    this._input = this.container.querySelector(".hx-search-input");
    this._metaEl = this.container.querySelector(".hx-search-meta");
    this._facetsEl = this.container.querySelector(".hx-search-facets");
    this._resultsEl = this.container.querySelector(".hx-search-results");
  };

  HeurixSearch.prototype._wireEvents = function () {
    var self = this;
    var debounced = debounce(function () { self._runSearch(self._input.value); }, DEFAULT_DEBOUNCE_MS);
    this._input.addEventListener("input", debounced);
  };

  HeurixSearch.prototype._runSearch = function (query) {
    var self = this;
    this._lastQuery = query;
    if (!query.trim()) {
      this._activeFilters = [];
      this._resultsEl.innerHTML = "";
      this._facetsEl.innerHTML = "";
      this._metaEl.textContent = "";
      return;
    }
    var seq = ++this._requestSeq;
    this._metaEl.textContent = "Recherche…";

    var body = { q: query, limit: this.limit, filters: this._activeFilters };
    if (this.facetFields.length) body.facets = this.facetFields;

    fetch(this.baseUrl + "/v1/index/" + encodeURIComponent(this.catalog) + "/search", {
      method: "POST",
      headers: { Authorization: "Bearer " + this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        if (seq !== self._requestSeq) return null; // une requete plus recente est deja en cours
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            throw new Error(data.detail || ("Erreur " + res.status));
          });
        }
        return res.json();
      })
      .then(function (data) {
        if (!data || seq !== self._requestSeq) return;
        self._render(data);
      })
      .catch(function (err) {
        if (seq !== self._requestSeq) return;
        self._renderError(err);
      });
  };

  HeurixSearch.prototype._render = function (data) {
    var count = data.hits.length;
    this._metaEl.textContent = data.fallback
      ? "Aucun résultat pour « " + this._lastQuery + " »"
      : count + " résultat" + (count > 1 ? "s" : "") + (data.total > count ? " (sur " + data.total + ")" : "");

    this._renderFacets(data);

    var html = "";
    if (data.suggested_category) {
      html += '<div class="hx-search-suggested">Vous cherchez peut-être dans <strong>' +
        esc(data.suggested_category.category) + "</strong> (" + data.suggested_category.products + " produits) ?</div>";
    }
    if (data.fallback && count) {
      html += '<div class="hx-search-fallback-label">Nos incontournables</div>';
    }
    if (!count) {
      html += '<div class="hx-search-empty">Aucun produit trouvé.</div>';
    } else {
      html += data.hits.map(this._hitHtml.bind(this)).join("");
    }
    this._resultsEl.innerHTML = html;

    if (this.onSelect) {
      var self = this;
      each(this._resultsEl.querySelectorAll("[data-hx-id]"), function (el) {
        el.addEventListener("click", function () {
          var id = el.getAttribute("data-hx-id");
          var hit = data.hits.filter(function (h) { return h.product.id === id; })[0];
          if (hit) self.onSelect(hit.product, hit);
        });
      });
    }
  };

  HeurixSearch.prototype._hitHtml = function (hit) {
    if (this.renderHit) return this.renderHit(hit);
    var p = hit.product;
    var price = typeof p.price === "number" ? p.price.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : "";
    var ref = p.ref || p.sku || "";
    var clickable = this.onSelect ? ' data-hx-id="' + esc(p.id) + '" style="cursor:pointer;"' : "";
    return '<div class="hx-search-hit"' + clickable + ">" +
      "<div><div class=\"hx-search-hit-name\">" + esc(p.name || p.id) + "</div>" +
      (ref ? '<div class="hx-search-hit-ref">' + esc(ref) + "</div>" : "") + "</div>" +
      '<div class="hx-search-hit-right">' +
      (price ? '<span class="hx-search-hit-price">' + esc(price) + "</span>" : "") +
      (hit.in_stock === false ? '<span class="hx-search-hit-oos">Rupture</span>' : "") +
      "</div></div>";
  };

  // Regroupe les prismes par prefixe (avant le premier "_"), meme
  // principe que demo-search.js -- mais les libelles sont generes
  // automatiquement plutot que puises dans une table codee en dur par
  // secteur, puisqu'un widget generique ne connait pas a l'avance le
  // rulepack du client.
  HeurixSearch.prototype._renderFacets = function (data) {
    var self = this;
    if (!data.facets) { this._facetsEl.innerHTML = ""; return; }
    var groups = {};
    Object.keys(data.facets).forEach(function (annotation) {
      var group = annotation.split("_")[0];
      var count = data.facets[annotation];
      (groups[group] = groups[group] || []).push([annotation, count]);
    });
    var html = "";
    Object.keys(groups).sort().forEach(function (group) {
      var values = groups[group].sort(function (a, b) { return b[1] - a[1]; }).slice(0, MAX_FACET_VALUES_PER_GROUP);
      if (!values.length) return;
      html += '<span class="hx-search-facet-group">' + esc(humanizeGroup(group)) + "</span>";
      values.forEach(function (v) {
        var on = self._activeFilters.indexOf(v[0]) !== -1;
        html += '<button type="button" class="hx-search-facet' + (on ? " hx-search-facet-on" : "") +
          '" data-hx-filter="' + esc(v[0]) + '">' + esc(humanizeValue(v[0], group)) +
          ' <span class="hx-search-facet-n">' + v[1] + "</span></button>";
      });
    });
    this._facetsEl.innerHTML = html;
    each(this._facetsEl.querySelectorAll("[data-hx-filter]"), function (btn) {
      btn.addEventListener("click", function () {
        var a = btn.getAttribute("data-hx-filter");
        var idx = self._activeFilters.indexOf(a);
        if (idx === -1) self._activeFilters.push(a); else self._activeFilters.splice(idx, 1);
        self._runSearch(self._lastQuery);
      });
    });
  };

  HeurixSearch.prototype._renderError = function (err) {
    this._metaEl.textContent = "";
    this._facetsEl.innerHTML = "";
    this._resultsEl.innerHTML = '<div class="hx-search-error">Recherche indisponible pour le moment' +
      (err && err.message ? " (" + esc(err.message) + ")" : "") + ".</div>";
  };

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  global.HeurixSearch = {
    init: function (config) { return new HeurixSearch(config); },
  };
})(window);
