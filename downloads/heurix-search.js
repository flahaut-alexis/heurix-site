/*!
 * heurix-search.js — bibliotheque JS autonome pour une barre de recherche
 * Heurix prete a l'emploi, connectee a la vraie API (pas simulee).
 *
 * Chantier Phase 5 de la roadmap (24 juillet). Volontairement minimal en
 * style visuel -- une refonte design dediee est prevue separement une
 * fois cette brique fonctionnelle livree. Les classes CSS sont nommees
 * clairement (prefixe hx-) pour que cette refonte puisse cibler chaque
 * element sans deviner.
 *
 * Zero dependance. Utilisable par simple <script src> ou import ES module.
 *
 * Usage minimal :
 *   <div id="ma-recherche"></div>
 *   <script src="heurix-search.js"></script>
 *   <script>
 *     Heurix.searchBox({
 *       apiKey: "hx_votre_cle",
 *       catalog: "moncatalogue",
 *       containerId: "ma-recherche"
 *     });
 *   </script>
 *
 * Documentation complete : https://heurix.fr/docs.html#ep-search-widget
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Heurix = root.Heurix || {};
    root.Heurix.searchBox = factory().searchBox;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULT_BASE_URL = "https://api.heurix.fr";
  var DEFAULT_DEBOUNCE_MS = 200;
  var DEFAULT_MIN_CHARS = 2;
  var DEFAULT_LIMIT = 8;
  var STYLE_INJECTED = false;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function injectStyles(accentColor) {
    if (STYLE_INJECTED) return;
    STYLE_INJECTED = true;
    var css = [
      ".hx-search{position:relative;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;--hx-accent:" + (accentColor || "#2952E3") + ";}",
      ".hx-search-input{width:100%;box-sizing:border-box;padding:10px 14px;font-size:15px;border:1px solid #D6D9E4;border-radius:8px;outline:none;}",
      ".hx-search-input:focus{border-color:var(--hx-accent);box-shadow:0 0 0 3px color-mix(in srgb, var(--hx-accent) 18%, transparent);}",
      ".hx-search-panel{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:60;background:#fff;border:1px solid #E2E4ED;border-radius:10px;box-shadow:0 12px 28px rgba(20,22,45,0.14);max-height:420px;overflow-y:auto;}",
      ".hx-search-panel[hidden]{display:none;}",
      ".hx-search-facets{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-bottom:1px solid #EEF0F6;}",
      ".hx-search-facet-chip{font-size:12.5px;padding:4px 10px;border-radius:999px;border:1px solid #D6D9E4;background:#fff;cursor:pointer;color:#3A3D52;}",
      ".hx-search-facet-chip.hx-active{background:var(--hx-accent);border-color:var(--hx-accent);color:#fff;}",
      ".hx-search-hit{display:flex;justify-content:space-between;gap:10px;align-items:baseline;padding:11px 14px;cursor:pointer;text-decoration:none;color:inherit;border-bottom:1px solid #F3F4F8;}",
      ".hx-search-hit:last-child{border-bottom:none;}",
      ".hx-search-hit:hover,.hx-search-hit.hx-hit-active{background:#F6F7FC;}",
      ".hx-search-hit-name{font-size:14px;font-weight:600;color:#181A2E;}",
      ".hx-search-hit-ref{font-size:12px;color:#7B7E93;margin-top:2px;}",
      ".hx-search-hit-meta{font-size:13px;color:#7B7E93;white-space:nowrap;flex-shrink:0;}",
      ".hx-search-hit-oos{color:#C0392B;}",
      ".hx-search-state{padding:16px 14px;font-size:13.5px;color:#7B7E93;text-align:center;}",
      ".hx-search-fallback-label{padding:8px 14px 2px;font-size:11.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#9B9EAF;}",
    ].join("\n");
    var styleEl = document.createElement("style");
    styleEl.setAttribute("data-heurix-search", "1");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  function defaultRenderItem(hit) {
    var p = hit.product;
    var stockKnown = typeof hit.in_stock === "boolean";
    var metaBits = [];
    if (p.price != null) metaBits.push(esc(p.price) + " €");
    if (stockKnown && !hit.in_stock) metaBits.push('<span class="hx-search-hit-oos">Rupture</span>');
    return (
      '<div class="hx-search-hit-name">' + esc(p.name || p.id) + "</div>" +
      (p.ref ? '<div class="hx-search-hit-ref">' + esc(p.ref) + "</div>" : "") +
      '</div><div class="hx-search-hit-meta">' + metaBits.join(" · ") + "</div>"
    );
  }

  function searchBox(config) {
    if (!config || !config.apiKey) throw new Error("Heurix.searchBox: 'apiKey' est requis.");
    if (!config.catalog) throw new Error("Heurix.searchBox: 'catalog' est requis.");
    if (!config.containerId) throw new Error("Heurix.searchBox: 'containerId' est requis.");
    var container = document.getElementById(config.containerId);
    if (!container) throw new Error("Heurix.searchBox: aucun element avec id='" + config.containerId + "'.");

    var baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    var minChars = config.minChars != null ? config.minChars : DEFAULT_MIN_CHARS;
    var debounceMs = config.debounceMs != null ? config.debounceMs : DEFAULT_DEBOUNCE_MS;
    var limit = config.limit || DEFAULT_LIMIT;
    var facetFields = config.facets || [];
    var renderItem = config.renderItem || defaultRenderItem;
    var onSelect = config.onSelect || null;
    var resultHref = config.resultHref || null; // function(hit) -> url, pour un <a> plutot qu'un <div>

    injectStyles(config.accentColor);

    container.classList.add("hx-search");
    container.innerHTML =
      '<input type="text" class="hx-search-input" placeholder="' + esc(config.placeholder || "Rechercher…") + '" autocomplete="off" aria-label="Rechercher un produit">' +
      '<div class="hx-search-panel" hidden></div>';

    var input = container.querySelector(".hx-search-input");
    var panel = container.querySelector(".hx-search-panel");
    var debounceTimer = null;
    var activeFilters = [];
    var lastRequestId = 0;
    var activeIndex = -1;
    var currentHits = [];

    function closePanel() {
      panel.hidden = true;
      activeIndex = -1;
    }

    function openPanel() {
      panel.hidden = false;
    }

    function setState(html) {
      panel.innerHTML = '<div class="hx-search-state">' + html + "</div>";
      openPanel();
    }

    function runSearch(query) {
      var requestId = ++lastRequestId;
      var body = { q: query, limit: limit, filters: activeFilters };
      if (facetFields.length) body.facets = facetFields;

      fetch(baseUrl + "/v1/index/" + encodeURIComponent(config.catalog) + "/search", {
        method: "POST",
        headers: { Authorization: "Bearer " + config.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          if (requestId !== lastRequestId) return; // une requete plus recente est deja partie, on ignore celle-ci
          renderResults(data);
        })
        .catch(function () {
          if (requestId !== lastRequestId) return;
          setState("Recherche indisponible pour le moment.");
        });
    }

    function renderResults(data) {
      currentHits = data.hits || [];
      activeIndex = -1;

      if (!currentHits.length) {
        setState("Aucun résultat" + (data.query ? ' pour « ' + esc(data.query) + " »" : "") + ".");
        return;
      }

      var html = "";

      if (facetFields.length && data.facets) {
        html += facetsHtml(data.facets);
      }

      if (data.fallback) {
        html += '<div class="hx-search-fallback-label">Nos incontournables</div>';
      }

      html += currentHits.map(function (hit, i) {
        var inner = renderItem(hit, i);
        var href = resultHref ? resultHref(hit) : null;
        var tag = href ? "a" : "div";
        var hrefAttr = href ? ' href="' + esc(href) + '"' : "";
        return "<" + tag + ' class="hx-search-hit" data-index="' + i + '"' + hrefAttr + ">" + inner + "</" + tag + ">";
      }).join("");

      panel.innerHTML = html;
      openPanel();

      panel.querySelectorAll(".hx-search-hit").forEach(function (el) {
        el.addEventListener("click", function (e) {
          var hit = currentHits[parseInt(el.getAttribute("data-index"), 10)];
          if (onSelect) onSelect(hit, e);
        });
      });

      if (facetFields.length) wireFacetChips();
    }

    function facetsHtml(facets) {
      var html = '<div class="hx-search-facets">';
      facetFields.forEach(function (field) {
        var values = facets[field];
        if (!values) return;
        Object.keys(values).forEach(function (value) {
          var token = field + ":" + value;
          var active = activeFilters.indexOf(token) !== -1;
          html += '<button type="button" class="hx-search-facet-chip' + (active ? " hx-active" : "") +
            '" data-filter="' + esc(token) + '">' + esc(value) + " (" + values[value] + ")</button>";
        });
      });
      return html + "</div>";
    }

    function wireFacetChips() {
      panel.querySelectorAll(".hx-search-facet-chip").forEach(function (chip) {
        chip.addEventListener("click", function (e) {
          e.stopPropagation();
          var token = chip.getAttribute("data-filter");
          var idx = activeFilters.indexOf(token);
          if (idx === -1) activeFilters.push(token); else activeFilters.splice(idx, 1);
          runSearch(input.value.trim());
        });
      });
    }

    function updateActiveHit() {
      panel.querySelectorAll(".hx-search-hit").forEach(function (el, i) {
        el.classList.toggle("hx-hit-active", i === activeIndex);
      });
      var activeEl = panel.querySelector(".hx-search-hit.hx-hit-active");
      if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
    }

    input.addEventListener("input", function () {
      var query = input.value.trim();
      clearTimeout(debounceTimer);
      if (query.length < minChars) {
        closePanel();
        return;
      }
      setState("Recherche…");
      debounceTimer = setTimeout(function () { runSearch(query); }, debounceMs);
    });

    input.addEventListener("keydown", function (e) {
      if (panel.hidden || !currentHits.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, currentHits.length - 1);
        updateActiveHit();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActiveHit();
      } else if (e.key === "Enter" && activeIndex !== -1) {
        e.preventDefault();
        var hit = currentHits[activeIndex];
        if (onSelect) onSelect(hit, e);
        else {
          var el = panel.querySelectorAll(".hx-search-hit")[activeIndex];
          if (el && el.tagName === "A") el.click();
        }
      } else if (e.key === "Escape") {
        closePanel();
      }
    });

    document.addEventListener("click", function (e) {
      if (!container.contains(e.target)) closePanel();
    });

    return {
      destroy: function () {
        container.innerHTML = "";
        container.classList.remove("hx-search");
      },
    };
  }

  return { searchBox: searchBox };
});
