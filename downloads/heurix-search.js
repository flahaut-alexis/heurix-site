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
 *       apiKey: "hxp_votre_cle_publique",   // cle PUBLIQUE, jamais hx_
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


  // Chantier securite C1 : garde-fou a l'execution. Une cle serveur (hx_)
  // dans le navigateur est lisible par n'importe quel visiteur, et ouvre
  // l'indexation, le merchandising et le portail de facturation Stripe.
  // Seule une cle publique (hxp_) a une portee limitee a la lecture.
  function heurixWarnIfServerKey(k) {
    if (typeof k === "string" && k.indexOf("hxp_") !== 0 && k.indexOf("hx_") === 0) {
      var msg = "[Heurix] ATTENTION : vous utilisez une cle SERVEUR (hx_) cote navigateur. " +
        "Elle est lisible par tous vos visiteurs et donne acces a votre facturation. " +
        "Generez une cle publique (hxp_) depuis votre console Heurix : Mes infos > Cles API.";
      if (typeof console !== "undefined" && console.warn) console.warn(msg);
    }
  }

  function fmtPrix(v) {
    return Number(v).toFixed(2).replace(".", ",").replace(/,00$/, "") + " €";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function injectStyles(accentColor) {
    if (STYLE_INJECTED) return;
    STYLE_INJECTED = true;
    var css = [
      ".hx-search{position:relative;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;--hx-accent:" + (accentColor || "#2952E3") + ";}",
      // Familles. Volontairement proches des lignes de resultats : le
      // visiteur ne doit pas avoir l'impression d'un ecran different, juste
      // d'une liste plus courte.
      ".hx-groups-head{padding:9px 14px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;}",
      ".hx-group{display:block;padding:10px 14px;border-bottom:1px solid #f3f4f6;cursor:pointer;text-decoration:none;color:inherit;}",
      ".hx-group:last-child{border-bottom:none;}",
      ".hx-group:hover,.hx-group:focus{background:#f9fafb;outline:none;}",
      ".hx-group-name{display:block;font-size:14px;font-weight:600;text-transform:capitalize;}",
      ".hx-group-count{display:inline-block;font-size:12px;font-weight:700;color:var(--hx-accent);margin-top:2px;}",
      ".hx-group-ex{display:block;font-size:11.5px;color:#9ca3af;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".hx-search-input{width:100%;box-sizing:border-box;padding:10px 14px;font-size:15px;border:1px solid #D6D9E4;border-radius:8px;outline:none;}",
      ".hx-search-input:focus{border-color:var(--hx-accent);box-shadow:0 0 0 3px color-mix(in srgb, var(--hx-accent) 18%, transparent);}",
      ".hx-search-panel{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:60;background:#fff;border:1px solid #E2E4ED;border-radius:10px;box-shadow:0 12px 28px rgba(20,22,45,0.14);max-height:420px;overflow-y:auto;}",
      ".hx-search-panel[hidden]{display:none;}",
      ".hx-search-facets{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-bottom:1px solid #EEF0F6;}",
      ".hx-search-facet-chip{font-size:12.5px;padding:4px 10px;border-radius:999px;border:1px solid #D6D9E4;background:#fff;cursor:pointer;color:#3A3D52;}",
      ".hx-search-facet-chip.hx-active{background:var(--hx-accent);border-color:var(--hx-accent);color:#fff;}",
      ".hx-search-hit{display:flex;justify-content:space-between;gap:10px;align-items:baseline;padding:11px 14px;cursor:pointer;text-decoration:none;color:inherit;border-bottom:1px solid #F3F4F8;position:relative;transition:box-shadow .12s ease, background .12s ease;}",
      ".hx-search-hit:last-child{border-bottom:none;}",
      // Survol renforce (2 aout, portage demo->produit) -- legere ombre en
      // plus du fond, plus de matiere qu'un simple changement de couleur.
      // Pas de translateY/scale ici : dans une LISTE compacte (pas des
      // cartes espacees), un deplacement vertical ferait vibrer les lignes
      // voisines de facon genante.
      ".hx-search-hit:hover,.hx-search-hit.hx-hit-active{background:#F6F7FC;box-shadow:inset 2px 0 0 var(--hx-accent);}",
      ".hx-search-hit-name{font-size:14px;font-weight:600;color:#181A2E;}",
      ".hx-search-hit-ref{font-size:12px;color:#7B7E93;margin-top:2px;}",
      ".hx-search-hit-meta{font-size:13px;color:#7B7E93;white-space:nowrap;flex-shrink:0;}",
      // Prix mis en avant (2 aout) -- var(--hx-accent) suit automatiquement
      // la couleur de marque du client (voir injectStyles), pas de couleur
      // fixe a re-choisir par catalogue.
      ".hx-search-hit-price{font-size:14.5px;font-weight:800;color:var(--hx-accent);}",
      ".hx-search-hit-oos{color:#C0392B;}",
      // Etiquette pack recommande (2 aout) -- s'appuie sur le champ
      // `highlighted_bundle` de l'API, disponible pour n'importe quel
      // catalogue (verifie cote moteur, pas specifique a la demo).
      ".hx-search-hit-badge{position:absolute;top:6px;right:14px;font-size:9.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#fff;background:linear-gradient(135deg, var(--hx-accent), color-mix(in srgb, var(--hx-accent) 60%, #8B5CF6));border-radius:100px;padding:2px 8px;}",
      ".hx-search-state{padding:16px 14px;font-size:13.5px;color:#7B7E93;text-align:center;}",
      ".hx-search-clearfilter{font:inherit;font-size:13px;font-weight:600;cursor:pointer;background:var(--hx-accent);color:#fff;border:none;padding:8px 16px;border-radius:100px;}",
      ".hx-search-fallback-label{padding:8px 14px 2px;font-size:11.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#9B9EAF;}",
      // Pied "voir tous les resultats" (2 aout) -- informatif par defaut
      // (juste le compte), devient un lien cliquable seulement si le
      // marchand fournit `seeAllHref`. Comportement par defaut non cassant :
      // sans configuration, un marchand gagne quand meme la visibilite du
      // total, meme sans lien de destination a fournir tout de suite.
      ".hx-search-seeall{display:block;padding:9px 14px;font-size:12.5px;font-weight:600;color:#7B7E93;text-align:center;border-top:1px solid #EEF0F6;text-decoration:none;}",
      "a.hx-search-seeall{color:var(--hx-accent);cursor:pointer;}",
      "a.hx-search-seeall:hover{background:#F6F7FC;}",
    ].join("\n");
    var styleEl = document.createElement("style");
    styleEl.setAttribute("data-heurix-search", "1");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }


  // Portees depuis l'implementation orpheline a la racine (chantier I3,
  // audit technique) : les facettes renvoyees par le moteur sont des
  // annotations brutes ("DIAM_M8" dans le groupe "DIAM"). Les afficher
  // telles quelles est illisible pour un acheteur -- on montre "M8".
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

  function defaultRenderItem(hit) {
    var p = hit.product;
    var stockKnown = typeof hit.in_stock === "boolean";
    var metaBits = [];
    // PRIX MIS EN AVANT (2 août, portage démo->produit) -- element dedie
    // plutot qu'un bout de texte noye parmi les autres metadonnees.
    // var(--hx-accent) est deja themable (injectStyles), donc la mise en
    // avant suit automatiquement la couleur de marque du client, sans
    // configuration supplementaire de sa part.
    var prixHtml = p.price != null
      ? '<span class="hx-search-hit-price">' + esc(p.price) + " €</span>"
      : "";
    if (stockKnown && !hit.in_stock) metaBits.push('<span class="hx-search-hit-oos">Rupture</span>');
    // ÉTIQUETTE PACK (2 août) -- affichée uniquement quand CE hit précis
    // est le highlighted_bundle renvoyé par l'API pour la requête en
    // cours. Voir searchBox() : c'est là que le rapprochement est fait,
    // pas ici -- defaultRenderItem reste une fonction pure sur un seul
    // hit, sans connaître le contexte de la recherche globale.
    var etiquetteHtml = hit._heurixBundle
      ? '<span class="hx-search-hit-badge">Pack recommandé</span>'
      : "";
    return (
      etiquetteHtml +
      '<div class="hx-search-hit-name">' + esc(p.name || p.id) + "</div>" +
      (p.ref ? '<div class="hx-search-hit-ref">' + esc(p.ref) + "</div>" : "") +
      '</div><div class="hx-search-hit-meta">' + prixHtml +
      (metaBits.length ? (prixHtml ? " · " : "") + metaBits.join(" · ") : "") + "</div>"
    );
  }

  function searchBox(config) {
    if (!config || !config.apiKey) throw new Error("Heurix.searchBox: 'apiKey' est requis.");
    heurixWarnIfServerKey(config.apiKey);
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
    // "VOIR TOUS LES RESULTATS" (2 aout, portage démo->produit) -- ce
    // panneau est volontairement compact (limit par defaut 8), jamais
    // pense pour tout afficher. `seeAllHref` laisse le marchand pointer
    // vers sa propre page de resultats complets, meme logique que
    // `resultHref`/`groupHref` : Heurix ne devine jamais une URL de site.
    // Sans configuration, le compte total reste affiche quand meme --
    // valeur immediate sans configuration supplementaire a fournir.
    var seeAllHref = config.seeAllHref || null; // function(query, total) -> url

    // REGROUPEMENT PAR FAMILLE. Configure par le MARCHAND, pas par le
    // visiteur : une case « regrouper » dans une barre de recherche demande
    // un effort de comprehension qu'un acheteur presse n'a pas.
    //
    // Mesure a l'origine : sur un catalogue de 10 000 produits, « vis M8
    // inox » renvoie 6 582 resultats dont les huit premiers ne different que
    // par la longueur. Le visiteur doit ouvrir la page de resultats pour
    // comprendre. Regroupe, il choisit sa famille en un coup d'oeil.
    //
    // SEUIL PLUTOT QUE TOUT-OU-RIEN. Un visiteur qui tape « 0986494574 »
    // veut sa plaquette, pas une famille. On ne regroupe qu'au-dela d'un
    // nombre de resultats ou l'affichage plat devient inexploitable.
    var groupThreshold = config.groupThreshold != null ? config.groupThreshold : 0;
    var groupBy = config.groupBy || "auto";
    var onSelectGroup = config.onSelectGroup || null;
    var groupHref = config.groupHref || null;

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
      // Le regroupement se decide sur le TOTAL, qu'on ne connait qu'apres
      // la reponse. On demande donc le mode plat, et on relance en groupe
      // si le seuil est franchi. Le second appel est servi par le cache du
      // moteur — mesure a 89 % de gain sur requete repetee.
      var seuilActif = groupThreshold > 0;
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

          // SEUIL FRANCHI : on relance en mode groupe. Le second appel est
          // servi par le cache du moteur (89 % de gain mesure sur requete
          // repetee), donc le surcout est marginal — et il n'a lieu que sur
          // les requetes larges, jamais sur une reference precise.
          if (seuilActif && (data.total || 0) >= groupThreshold) {
            var corpsGroupe = { q: query, limit: limit, filters: activeFilters,
                                group_by: groupBy };
            return fetch(baseUrl + "/v1/index/" + encodeURIComponent(config.catalog) + "/search", {
              method: "POST",
              headers: { Authorization: "Bearer " + config.apiKey, "Content-Type": "application/json" },
              body: JSON.stringify(corpsGroupe),
            })
              .then(function (r) { return r.ok ? r.json() : null; })
              .then(function (groupe) {
                if (requestId !== lastRequestId) return;
                // Si le regroupement echoue, on retombe sur l'affichage
                // plat : mieux vaut une liste longue qu'un ecran vide.
                if (groupe && groupe.groupes) renderGroups(groupe, query);
                else renderResults(data);
              });
          }
          renderResults(data);
        })
        .catch(function () {
          if (requestId !== lastRequestId) return;
          setState("Recherche indisponible pour le moment.");
        });
    }

    /* Affichage par familles.
     *
     * Une famille n'est pas un produit : on ne peut pas la mettre au panier,
     * seulement l'explorer. Le clic doit donc AFFINER la recherche, pas
     * ouvrir une fiche — c'est la difference de comportement que le
     * marchand doit pouvoir intercepter via `onSelectGroup`.
     */
    function renderGroups(data, query) {
      currentHits = [];        // pas de produits selectionnables ici
      activeIndex = -1;

      var html = '<div class="hx-groups-head">' +
        esc(String(data.total)) + " résultats — choisissez une famille" +
        "</div>";

      html += (data.groupes || []).map(function (g, i) {
        var interieur =
          '<span class="hx-group-name">' + esc(g.famille) + "</span>" +
          '<span class="hx-group-count">' + g.produits +
            (g.produits > 1 ? " produits" : " produit") + "</span>" +
          '<span class="hx-group-ex">' +
            esc((g.representant && (g.representant.name || g.representant.id)) || "") +
          "</span>";
        var lien = groupHref ? groupHref(g) : null;
        return lien
          ? '<a class="hx-group" href="' + esc(lien) + '" data-idx="' + i + '">' + interieur + "</a>"
          : '<div class="hx-group" role="button" tabindex="0" data-idx="' + i + '">' + interieur + "</div>";
      }).join("");

      panel.innerHTML = html;
      panel.hidden = false;

      panel.querySelectorAll(".hx-group").forEach(function (el) {
        el.addEventListener("click", function (e) {
          var g = (data.groupes || [])[parseInt(el.getAttribute("data-idx"), 10)];
          if (!g) return;
          if (onSelectGroup) {
            e.preventDefault();
            onSelectGroup(g, query);
            return;
          }
          if (!groupHref) {
            // COMPORTEMENT PAR DÉFAUT : on affine la recherche avec le nom
            // de la famille. Le visiteur reste dans le même geste, sans
            // quitter la page — et il obtient une liste exploitable.
            e.preventDefault();
            input.value = (query + " " + g.famille).trim();
            runSearch(input.value);
          }
        });
      });
    }

    function renderResults(data) {
      currentHits = data.hits || [];
      activeIndex = -1;

      // MISE EN AVANT MARCHANDE (2 août, portage démo->produit) --
      // `highlighted_bundle` est calculé indépendamment de `hits` côté
      // moteur : le meilleur pack peut ne pas figurer dans les tout
      // premiers résultats. S'il est déjà dans `currentHits`, on le
      // marque en place (pas de doublon). Sinon, on l'ajoute en tête --
      // même logique de dédoublonnage que la démo widget du même jour.
      if (data.highlighted_bundle && data.highlighted_bundle.product) {
        var idBundle = data.highlighted_bundle.product.id;
        var dejaPresent = currentHits.some(function (h) {
          if (h.product && h.product.id === idBundle) { h._heurixBundle = true; return true; }
          return false;
        });
        if (!dejaPresent) {
          var hitBundle = {
            product: data.highlighted_bundle.product,
            in_stock: data.highlighted_bundle.in_stock,
            _heurixBundle: true,
          };
          currentHits = [hitBundle].concat(currentHits);
        }
      }

      if (!currentHits.length) {
        // Chantier 6.6bis : un zero-resultat cause par une contrainte de prix
        // merite une explication et une porte de sortie. Sans cela, un
        // acheteur qui tape « moins de 5 € » sur un catalogue dont les
        // produits n'ont pas de prix renseigne obtient un ecran vide, sans
        // comprendre pourquoi -- techniquement correct, mais decourageant.
        //
        // `data.query` contient deja la requete NETTOYEE de la contrainte
        // (le moteur la retire avant de tokeniser), donc relancer sans le
        // filtre est immediat : il suffit de reecrire le champ avec elle.
        if (data.price_filter) {
          var pf = data.price_filter;
          var borne = pf.max !== null && pf.min !== null
            ? "entre " + fmtPrix(pf.min) + " et " + fmtPrix(pf.max)
            : pf.max !== null ? "à moins de " + fmtPrix(pf.max)
            : "à plus de " + fmtPrix(pf.min);
          panel.innerHTML =
            '<div class="hx-search-state">' +
            "<p style=\"margin:0 0 10px;\">Aucun produit " + esc(borne) +
            (data.query ? ' pour « ' + esc(data.query) + " »" : "") + ".</p>" +
            '<button type="button" class="hx-search-clearfilter">' +
            "Chercher sans la contrainte de prix</button></div>";
          openPanel();
          var relance = panel.querySelector(".hx-search-clearfilter");
          if (relance) relance.addEventListener("click", function () {
            input.value = data.query || "";
            input.focus();
            runSearch(input.value.trim());
          });
          return;
        }
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

      // "VOIR TOUS LES RESULTATS" -- affiché seulement s'il existe
      // réellement plus de résultats que ce qui tient dans le panneau
      // (le +1 éventuel du bundle ajouté ci-dessus n'entre pas dans ce
      // compte, `data.total` reste la vérité côté moteur). Lien cliquable
      // si `seeAllHref` est configuré, sinon simple compte informatif --
      // jamais rien de cassé pour un marchand qui n'a pas encore configuré
      // cette option.
      if ((data.total || 0) > (data.hits || []).length) {
        var texteTotal = esc(String(data.total)) + " résultats au total";
        var lienTotal = seeAllHref ? seeAllHref(data.query || "", data.total) : null;
        html += lienTotal
          ? '<a class="hx-search-seeall" href="' + esc(lienTotal) + '">Voir les ' + texteTotal + " →</a>"
          : '<div class="hx-search-seeall">' + texteTotal + "</div>";
      }

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
          // Le filtre envoye a l'API doit etre l'annotation BRUTE ("DIAM_M8").
          // La version precedente envoyait "DIAM:DIAM_M8", qui ne
          // correspondait a aucune annotation cote moteur : cliquer une
          // facette vidait les resultats. Corrige au chantier I3.
          var active = activeFilters.indexOf(value) !== -1;
          html += '<button type="button" class="hx-search-facet-chip' + (active ? " hx-active" : "") +
            '" data-filter="' + esc(value) + '" title="' + esc(humanizeGroup(field)) + '">' +
            esc(humanizeValue(value, field)) + " (" + values[value] + ")</button>";
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
