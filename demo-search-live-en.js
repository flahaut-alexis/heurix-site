/* Homepage demo — connected to the REAL engine.
 *
 * ENGLISH VARIANT of demo-search-live.js — same logic, translated
 * user-facing text, English number formatting. Same reasoning as
 * search-en.js and guide-quiz-en.js: this script renders a lot of text
 * directly into the DOM (results, messages, example chips), so a
 * dedicated file is safer than branching every string on document
 * language inside one shared script.
 *
 * NO KEY REQUIRED. The engine exposes `/v1/public-demo/search`, with no
 * authentication, restricted to the "public-demo" catalogs and read-only.
 * Rate limiting is enforced server-side.
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

  // Pulsing hint on the search bar (Aug 1) — removed PERMANENTLY on the
  // first interaction, never re-enabled afterward. {once:true} on both
  // events guarantees this without any hand-rolled state flag.
  var barre = racine.querySelector(".play-bar");
  if (barre) {
    var arreterPulse = function () { barre.classList.remove("play-bar-pulse"); };
    champ.addEventListener("focus", arreterPulse, { once: true });
    champ.addEventListener("input", arreterPulse, { once: true });
  }


  var minuteur = null;
  var derniereRequete = 0;
  // Chronometer for the request in flight. AT MODULE LEVEL, not inside
  // chercher(): afficher() reads it to write "X results in Y ms", and a
  // variable local to chercher() would be invisible to it.
  var chrono = 0;
  var prismeActif = null;

  // CURRENT VERTICAL. The selector carries the ten-industry argument: same
  // engine, different rules. Removing it would lose the single most
  // important thing the homepage demonstrates.
  var pastilles = racine.querySelectorAll(".play-vertical-pill");

  // THE STARTING VERTICAL IS READ FROM THE PAGE, not decided here — the
  // page's own suggestion chips must match whichever vertical is marked
  // active in the HTML.
  var verticale = "outillage";
  var active = racine.querySelector(".play-vertical-on") ||
               racine.querySelector(".play-vertical-pill-on") ||
               racine.querySelector(".play-vertical-pill.active") ||
               racine.querySelector('.play-vertical-pill[aria-pressed="true"]');
  if (active && active.getAttribute("data-vertical")) {
    verticale = active.getAttribute("data-vertical");
  } else if (pastilles.length && pastilles[0].getAttribute("data-vertical")) {
    // With no marking at all, the FIRST pill governs: it's the one the
    // visitor sees first, and the one whose suggestions are in the HTML.
    verticale = pastilles[0].getAttribute("data-vertical");
  }

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/'/g, "&#39;").replace(/"/g, "&quot;");
  }

  function euros(n) {
    return n === undefined || n === null
      ? "" : "€" + Number(n).toFixed(2);
  }

  function fiche(hit) {
    var p = hit.product || {};
    // OPTIONAL IMAGE. If the catalog carries one, show it; otherwise show
    // the REFERENCE in large type, which is more honest than an empty
    // frame and more relevant for a technical catalog: a fastener buyer
    // recognizes "M8x20 A2," not a photo of a generic grey screw.
    //
    // ORDER: real image if the catalog has one, otherwise a pictogram
    // chosen by the engine, otherwise the reference. The pictogram isn't
    // decoration: it shows Heurix RECOGNIZED the product's family.
    var visuel;
    if (p.image || p.image_url) {
      // IF THE IMAGE FAILS, THE PICTOGRAM TAKES OVER. Hiding the frame
      // left a hole: on Open Library, about half the covers are missing,
      // and the grid became uneven.
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
      ? "<span class='play-rupture'>Out of stock</span>"
      : "<span class='play-stock'>In stock</span>";
    // RAW LABELS ARE STRIPPED FROM THE PUBLIC PAGE. "FAM_CHEMISE" means
    // nothing to a visitor — it's internal vocabulary. What the engine
    // understood shows up another way: the pictogram, and the price
    // filter shown in plain text under the results.
    //
    // WHAT WE SHOW, AND IN WHAT ORDER. The description carries the author
    // for a book, the container size for a wine, the standard for a
    // fastener — always the most telling detail after the name. No
    // redundancy: kept only if it adds something the name doesn't already
    // say.
    var secondaire = p.description || p.marque || "";
    if (secondaire && p.name) {
      var reste = String(secondaire).split(/[—–-]/)[0].trim();
      secondaire = reste && p.name.toLowerCase().indexOf(reste.toLowerCase()) === -1
        ? reste : (p.marque && p.name.toLowerCase().indexOf(String(p.marque).toLowerCase()) === -1
                   ? p.marque : "");
    }
    return "<article class='play-card'>" +
      visuel +
      "<div class='play-card-body'>" +
        "<div class='play-card-name'>" + esc(p.name || p.id) + "</div>" +
        (secondaire ? "<div class='play-card-sub'>" + esc(String(secondaire).slice(0, 60)) + "</div>" : "") +
      "</div>" +
      // Reference, price and stock now grouped: three metadata of the
      // same nature, aligned together at the card's footer.
      "<div class='play-card-foot'>" +
        (p.ref ? "<span class='play-card-ref'>" + esc(p.ref) + "</span>" : "") +
        (p.price !== undefined ? "<span class='play-card-price'>" + euros(p.price) + "</span>" : "") +
        etat +
      "</div>" +
    "</article>";
  }

  // Animates a <b> from 0 (or close to it) up to its final value, over
  // roughly 350ms. Purely visual: the value DISPLAYED DURING the animation
  // is never used for a calculation, only the target is.
  function animerCompteurMs(el, cible) {
    if (!el) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = cible;
      return;
    }
    var depart = Math.max(0, cible - Math.round(cible * 0.6) - 15);
    var t0 = null;
    var duree = 350;
    // REFERENCED VIA window, NOT AS A BARE GLOBAL. The widget is meant to
    // be embedded as-is by customers — a direct call to a bare identifier
    // depends on execution contexts we don't all control. The
    // `setTimeout` fallback covers the rare environments without
    // `requestAnimationFrame`.
    var rAF = (window.requestAnimationFrame || function (cb) { return setTimeout(function () { cb(Date.now()); }, 16); }).bind(window);
    function pas(t) {
      if (t0 === null) t0 = t;
      var avancement = Math.min(1, (t - t0) / duree);
      // Ease-out: fast at first, settles smoothly on the exact value —
      // noticeable without being showy.
      var valeur = Math.round(depart + (cible - depart) * (1 - Math.pow(1 - avancement, 3)));
      el.textContent = valeur;
      if (avancement < 1) rAF(pas);
    }
    rAF(pas);
  }

  function afficher(donnees, requete) {
    var hits = donnees.hits || [];
    if (!hits.length) {
      grille.innerHTML = "<p class='play-vide'>No results for \"" +
                         esc(requete) + "\".</p>";
      if (meta) meta.textContent = "";
      return;
    }
    grille.innerHTML = hits.slice(0, 9).map(fiche).join("");

    if (meta) {
      var ms = Math.max(1, Math.round(performance.now() - chrono));

      // RESPONSE TIME AS A VISUAL ARGUMENT, NOT A MENTION. Count and speed
      // are two SEPARATE elements — not one sentence — so the ms figure
      // can be styled on its own: larger, bold, in the brand accent color
      // rather than neutral grey.
      //
      // NO COMPARATIVE STATISTIC IS SHOWN. "Faster than 95% of search
      // engines" isn't measured anywhere — writing it would mean
      // inventing a statistic on our own page. The measured figure,
      // shown plainly, is argument enough and verifiable: any visitor can
      // reproduce it by typing a search.
      var bouts = [];
      var filtre = "";
      if (donnees.price_filter) {
        var f = donnees.price_filter;
        filtre = " · " + (f.max !== null && f.min !== null
          ? "filter: between " + euros(f.min) + " and " + euros(f.max)
          : f.max !== null ? "filter: under " + euros(f.max)
          : "filter: over " + euros(f.min));
      }
      meta.innerHTML =
        "<span class='play-meta-count'>" + donnees.total.toLocaleString("en-US") +
        " results</span>" +
        "<span class='play-meta-speed'>" +
          "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M13 2 3 14h7l-1 8 11-14h-7z'/></svg>" +
          "<b class='play-meta-ms' data-cible='" + ms + "'>" + ms + "</b> ms" +
        "</span>" +
        (filtre ? "<span class='play-meta-filtre'>" + esc(filtre) + "</span>" : "");

      // ~350ms COUNT-UP MICRO-ANIMATION, requestAnimationFrame. Never
      // delays the results themselves — the grid is already on screen
      // before this animation starts. It dresses up an already-exact
      // figure, it doesn't make the visitor wait for it.
      animerCompteurMs(meta.querySelector(".play-meta-ms"), ms);
    }

    // Facets become clickable prisms — the homepage's own vocabulary,
    // kept as-is.
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
    // MEASURED RESPONSE TIME, shown under the results. This is TOTAL
    // perceived time (network included), not engine time alone:
    // announcing the latter while measuring the former would flatter us
    // on good days and unfairly penalize us on bad ones.
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
        if (id !== derniereRequete) return;   // a more recent keystroke already fired
        afficher(d, requete);
      })
      .catch(function (e) {
        if (id !== derniereRequete) return;
        // A PROGRAMMING error (ReferenceError, TypeError) is not a network
        // outage: showing it as one would mislead the visitor and hide
        // the actual defect. Log it, let it surface in the console.
        if (e instanceof ReferenceError || e instanceof TypeError) {
          console.error("Widget defect (not a network outage):", e);
        }
        // A 429 means the visitor is typing very fast: server-side rate
        // limiting kicked in. Distinguish it from a real outage.
        if (String(e.message).indexOf("429") !== -1) {
          grille.innerHTML = "<p class='play-vide'>Too many searches in a row — " +
                             "please wait a second.</p>";
          return;
        }
        // HONEST MESSAGE. A blank screen would look like a broken
        // product; saying the demo is unavailable preserves the engine's
        // credibility.
        grille.innerHTML = "<p class='play-vide'>Demo temporarily " +
                           "unavailable. The engine remains reachable via API.</p>";
        if (meta) meta.textContent = "";
      });
  }

  champ.addEventListener("input", function () {
    clearTimeout(minuteur);
    minuteur = setTimeout(function () { chercher(champ.value); }, 220);
  });

  // EXAMPLES BY SECTOR. An "M8x20" suggestion on the Fashion vertical
  // would demonstrate nothing: each sector has its own vocabulary, and
  // that's exactly what the selector illustrates.
  var EXEMPLES = {
    outillage: ["M8x20 stainless", "stainless screws under $2", "DIN 933", "wahser"],
    livres: ["detective novel paperback", "9782070413119", "science fiction"],
    hightech: ["10kΩ 0805", "USB-C cable 2m", "SMD resistor"],
    mode: ["red wool sweater size L", "slim jeans W32", "striped shirt"],
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
        // Toggle the site's REAL class, not an invented one — otherwise
        // the active pill would stay visually unchanged.
        p.classList.toggle("play-vertical-on", p === pill);
      });
      prismeActif = null;
      majSuggestions();
      // Re-run the current search on the new sector: this is what shows
      // the RULES change, not just the data.
      if (champ.value.trim()) chercher(champ.value);
      else { grille.innerHTML = ""; if (meta) meta.textContent = ""; }
      // Return focus to the search field (reported July 31): without
      // this, focus stayed on the clicked pill and typing a new query
      // required clicking back into the field — one extra step every
      // time the sector changed.
      champ.focus();
    });
  });

  // The homepage's suggestion chips stay clickable.
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

  // The default sector's pill must be marked active on load.
  pastilles.forEach(function (p) {
    if (p.getAttribute("data-vertical") === verticale) {
      p.classList.add("play-vertical-pill-on");
    }
  });
})();
