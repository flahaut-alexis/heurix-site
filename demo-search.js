// Heurix — démo interactive du moteur (FR)
// Portage JavaScript fidèle de la logique du moteur Heurix (Python) :
// normalisation, tolérance aux fautes (Damerau-Levenshtein bornée),
// cascade de règles du pack "mode", synonymes, scoring pondéré.
// Catalogue de démonstration embarqué : 40 produits.

(function () {
  "use strict";

  /* ---------------- Normalisation ---------------- */
  function fold(s) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  var WORD_RE = /[a-z0-9]+(?:[./-][a-z0-9]+)*/g;
  function tokenize(s) { return fold(s).match(WORD_RE) || []; }

  /* ---------------- Fuzzy (Damerau-Levenshtein bornée) ---------------- */
  function maxEdits(t) {
    if (t.length <= 3) return 0;
    if (/\d/.test(t)) return 1;           // référence : 1 faute max
    if (t.length <= 7) return 1;
    return 2;
  }
  function dlDistance(a, b, cap) {
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    if (a === b) return 0;
    var la = a.length, lb = b.length;
    var prev2 = null, prev = [], curr, i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      curr = [i];
      var rowMin = i;
      for (j = 1; j <= lb; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        var v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          v = Math.min(v, prev2[j - 2] + 1);
        }
        curr[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > cap) return cap + 1;
      prev2 = prev; prev = curr;
    }
    return prev[lb];
  }

  /* ---------------- Pack de règles "mode" (cascade) ---------------- */
  var LEVEL1 = [
    [/\b(\d{2})\/(\d{2})\b/g, "TAILLE_$1_$2"],
    [/\bw\s?(\d{2})\s?l\s?(\d{2})\b/g, "TAILLE_$1_$2"],
    [/\b(xs|s|m|l|xl|xxl)\b/g, "TAILLE_$1"],
    [/\brouge|red\b/g, "COL_ROUGE"],
    [/\bbordeaux|burgundy\b/g, "COL_BORDEAUX"],
    [/\bbleu(?:e|s)?|marine|navy|blue\b/g, "COL_BLEU"],
    [/\bnoir(?:e|s)?|black\b/g, "COL_NOIR"],
    [/\becru|creme|blanc(?:he|hes|s)? casse\b/g, "COL_ECRU"],
    [/\bblanc(?:he|hes|s)?|white\b/g, "COL_BLANC"],
    [/\bgris(?:e|es)?|grey|gray|chine\b/g, "COL_GRIS"],
    [/\bvert(?:e|es|s)?|green|foret\b/g, "COL_VERT"],
    [/\bcamel|beige\b/g, "COL_CAMEL"],
    [/\blaine|merinos|wool|cachemire\b/g, "MAT_LAINE"],
    [/\bcoton|cotton|bio\b/g, "MAT_COTON"],
    [/\bdenim\b/g, "MAT_DENIM"],
    [/\bflanelle|flannel\b/g, "MAT_FLANELLE"],
    [/\blin\b/g, "MAT_LIN"],
    [/\bpull(?:over)?s?|sweater|sweat\b/g, "FAM_PULL"],
    [/\bt.?shirts?|tee\b/g, "FAM_TSHIRT"],
    [/\bchemises?|shirt\b/g, "FAM_CHEMISE"],
    [/\bjeans?\b/g, "FAM_JEAN"],
    [/\bpantalons?|chino\b/g, "FAM_PANTALON"],
    [/\becharpes?|scarf\b/g, "FAM_ECHARPE"],
    [/\bmanteaux?|coat\b/g, "FAM_MANTEAU"],
    [/\bvestes?|jacket\b/g, "FAM_VESTE"],
    [/\bcol\s?roule|turtle\s?neck|roll\s?neck\b/g, "ATTR_COL_ROULE"],
    [/\bcol\s?v\b/g, "ATTR_COL_V"],
    [/\bslim\b/g, "ATTR_SLIM"],
    [/\bdelave|delavee?s?|washed\b/g, "ATTR_DELAVE"],
    [/\bcapuche|hoodie\b/g, "ATTR_CAPUCHE"]
  ];
  var LEVEL2 = [
    [/ATTR_COL_ROULE.*FAM_PULL|FAM_PULL.*ATTR_COL_ROULE/, "PULL_COL_ROULE"],
    [/ATTR_COL_V.*FAM_PULL|FAM_PULL.*ATTR_COL_V/, "PULL_COL_V"],
    [/FAM_JEAN.*TAILLE_(\d+)_(\d+)|TAILLE_(\d+)_(\d+).*FAM_JEAN/, "JEAN_TAILLE"],
    [/ATTR_DELAVE.*FAM_JEAN|FAM_JEAN.*ATTR_DELAVE/, "JEAN_DELAVE"]
  ];

  function annotate(tokens) {
    var spaced = tokens.join(" ");
    var ann = {};
    LEVEL1.forEach(function (rule) {
      var re = new RegExp(rule[0].source, "g"), m;
      while ((m = re.exec(spaced)) !== null) {
        var a = rule[1];
        for (var g = 1; g < m.length; g++) a = a.replace("$" + g, m[g] || "");
        ann[a] = true;
      }
    });
    var stream = Object.keys(ann).sort().join(" ");
    LEVEL2.forEach(function (rule) {
      if (rule[0].test(stream)) ann[rule[1]] = true;
    });
    return Object.keys(ann);
  }

  /* ---------------- Synonymes ---------------- */
  var SYN_GROUPS = [
    ["pull", "pullover", "sweat", "sweater"],
    ["tshirt", "tee"],
    ["chemise", "shirt"],
    ["echarpe", "scarf"],
    ["jean", "denim"]
  ];
  var SYN = {};
  SYN_GROUPS.forEach(function (g) {
    g.forEach(function (t) { SYN[t] = g; });
  });

  /* ---------------- Catalogue de démonstration (40 produits) ---------------- */
  // [ref, nom, description, stock, famille_icone, couleur_icone]
  var CATALOG = [
    ["PCR-1042", "Pull col roulé rouge", "Laine mérinos, maille fine", 12, "sweater", "#C0392B"],
    ["PCR-1087", "Pull col roulé rouge", "Coton épais, coupe droite", 8, "sweater", "#B8412E"],
    ["PCR-1103", "Pull col roulé bordeaux", "Laine mélangée", 5, "sweater", "#7B241C"],
    ["PCR-1099", "Pull col roulé rouge — édition capsule", "Série limitée numérotée", 3, "sweater", "#A8321F"],
    ["PCR-1120", "Pull col roulé écru", "Laine côtelée", 15, "sweater", "#D8CBB8"],
    ["PCR-1135", "Pull col roulé noir", "Mérinos extra-fin", 20, "sweater", "#2B2B33"],
    ["PCV-2010", "Pull col V bleu marine", "Coton peigné", 18, "sweater", "#1F3A5F"],
    ["PCV-2024", "Pull col V gris chiné", "Laine et cachemire", 0, "sweater", "#8E8E99"],
    ["SWT-3005", "Sweat à capuche gris", "Molleton gratté, coupe ample", 25, "sweater", "#9A9AA5"],
    ["SWT-3018", "Sweat col rond vert forêt", "Coton bio 380g", 11, "sweater", "#2E5E42"],
    ["TSH-4001", "T-shirt blanc", "Coton bio, col rond", 60, "tshirt", "#F2F0EA"],
    ["TSH-4002", "T-shirt noir", "Coton bio, col rond", 55, "tshirt", "#2B2B33"],
    ["TSH-4015", "T-shirt bleu marine", "Jersey épais", 40, "tshirt", "#1F3A5F"],
    ["TSH-4022", "T-shirt rouge délavé", "Teinture pigmentaire", 9, "tshirt", "#C0564A"],
    ["TSH-4030", "T-shirt rayé marinière", "Coton, rayures bleu/écru", 22, "tshirt", "#3D5A80"],
    ["CHM-5001", "Chemise blanche", "Popeline de coton, col français", 30, "shirt", "#F5F3EC"],
    ["CHM-5008", "Chemise bleue oxford", "Coton oxford, boutonnée", 26, "shirt", "#5B7FA6"],
    ["CHM-5015", "Chemise en flanelle à carreaux", "Flanelle brossée rouge et noir", 7, "shirt", "#8C3A32"],
    ["CHM-5021", "Chemise en lin écru", "Lin lavé, coupe décontractée", 4, "shirt", "#DDD2BC"],
    ["CHM-5030", "Chemise noire", "Twill de coton", 16, "shirt", "#2B2B33"],
    ["JEA-6001", "Jean brut 32/34", "Denim selvedge 14oz, coupe droite", 14, "pants", "#27364B"],
    ["JEA-6002", "Jean brut 30/32", "Denim selvedge 14oz, coupe droite", 10, "pants", "#27364B"],
    ["JEA-6003", "Jean brut 34/34", "Denim selvedge 14oz, coupe droite", 0, "pants", "#27364B"],
    ["JEA-6010", "Jean slim délavé 31/32", "Denim stretch, délavage clair", 19, "pants", "#6E87A8"],
    ["JEA-6015", "Jean noir 33/32", "Denim noir, coupe fuselée", 12, "pants", "#33333B"],
    ["PAN-7001", "Pantalon chino camel", "Gabardine de coton", 21, "pants", "#B08D57"],
    ["PAN-7009", "Pantalon de flanelle grise", "Laine peignée, pinces", 6, "pants", "#75757F"],
    ["PAN-7014", "Pantalon cargo vert", "Toile résistante, poches latérales", 13, "pants", "#4A5D43"],
    ["ECH-4471", "Écharpe rouge en laine", "Laine d'agneau, franges", 20, "scarf", "#B03A2E"],
    ["ECH-4480", "Écharpe grise en cachemire", "Cachemire 2 fils", 3, "scarf", "#8E8E99"],
    ["ECH-4492", "Écharpe à carreaux camel", "Laine mélangée", 17, "scarf", "#B08D57"],
    ["MAN-8001", "Manteau en laine marine", "Drap de laine, coupe droite", 5, "coat", "#22314A"],
    ["MAN-8007", "Manteau camel", "Laine et cachemire, croisé", 2, "coat", "#B08D57"],
    ["MAN-8012", "Parka kaki doublée", "Toile déperlante, capuche", 8, "coat", "#5A6350"],
    ["VES-9001", "Veste en denim brut", "Denim rigide, boutons métal", 15, "jacket", "#2E4057"],
    ["VES-9008", "Veste de travail écrue", "Toile de coton lourde", 9, "jacket", "#D9CDB4"],
    ["VES-9015", "Blazer en laine gris anthracite", "Demi-doublé, deux boutons", 6, "jacket", "#4A4A55"],
    ["PCR-1150", "Pull marin rayé", "Laine, rayures écru/marine", 13, "sweater", "#31486B"],
    ["TSH-4040", "T-shirt vert sauge", "Coton lavé", 28, "tshirt", "#8BA88E"],
    ["CHM-5042", "Chemise rayée bleu et blanc", "Popeline rayée", 24, "shirt", "#7C9BC0"]
  ];

  /* ---------------- Indexation ---------------- */
  var FIELD_W = { ref: 4, name: 3, desc: 1 };
  var ANN_W = 5;
  var products = [], termIndex = {}, annIndex = {}, vocabByLen = {};

  CATALOG.forEach(function (row, i) {
    var p = { id: row[0], name: row[1], desc: row[2], stock: row[3], icon: row[4], color: row[5], anns: [] };
    products.push(p);
    ["ref", "name", "desc"].forEach(function (field) {
      var text = field === "ref" ? p.id : field === "name" ? p.name : p.desc;
      tokenize(text).forEach(function (t) {
        (termIndex[t] = termIndex[t] || {})[i] = (termIndex[t][i] || 0) + FIELD_W[field];
        (vocabByLen[t.length] = vocabByLen[t.length] || {})[t] = true;
      });
    });
    p.anns = annotate(tokenize(p.id + " " + p.name + " " + p.desc));
    p.anns.forEach(function (a) { (annIndex[a] = annIndex[a] || []).push(i); });
  });

  function fuzzyVariants(term) {
    var cap = maxEdits(term), out = [];
    for (var L = term.length - cap; L <= term.length + cap; L++) {
      var bucket = vocabByLen[L];
      if (!bucket) continue;
      for (var cand in bucket) {
        var d = cand === term ? 0 : dlDistance(term, cand, cap);
        if (d <= cap) out.push([cand, d]);
      }
    }
    return out;
  }

  var FUZZY_P = [1.0, 0.6, 0.35], SYN_P = 0.8, MAX_EXP = 40;

  function search(query) {
    var tokens = tokenize(query);
    if (!tokens.length) return { hits: [], tokens: [] };
    var scores = {}, cover = {}, why = {};

    tokens.forEach(function (tok, pos) {
      var cands = {};
      fuzzyVariants(tok).forEach(function (v) {
        cands[v[0]] = Math.max(cands[v[0]] || 0, FUZZY_P[v[1]]);
      });
      (SYN[tok] || []).forEach(function (syn) {
        if (syn === tok) return;
        fuzzyVariants(syn).forEach(function (v) {
          cands[v[0]] = Math.max(cands[v[0]] || 0, FUZZY_P[v[1]] * SYN_P);
        });
      });
      var entries = Object.keys(cands).map(function (k) { return [k, cands[k]]; });
      if (entries.length > MAX_EXP) {
        entries.sort(function (a, b) { return b[1] - a[1]; });
        entries = entries.slice(0, MAX_EXP);
      }
      entries.forEach(function (e) {
        var postings = termIndex[e[0]] || {};
        for (var pid in postings) {
          scores[pid] = (scores[pid] || 0) + postings[pid] * e[1];
          (cover[pid] = cover[pid] || {})[pos] = true;
          if (e[1] < 1) (why[pid] = why[pid] || []).push(e[0]);
        }
      });
    });

    annotate(tokens).forEach(function (a) {
      (annIndex[a] || []).forEach(function (pid) {
        scores[pid] = (scores[pid] || 0) + ANN_W;
        (cover[pid] = cover[pid] || {})["a"] = true;
        (why[pid] = why[pid] || []).push("#" + a);
      });
    });

    var res = Object.keys(scores).map(function (pid) {
      var covered = Object.keys(cover[pid]).filter(function (k) { return k !== "a"; }).length;
      var c = covered / tokens.length;
      if (cover[pid]["a"]) c = Math.max(c, 0.5);
      return { p: products[pid], score: scores[pid] * (1 + c), why: why[pid] || [] };
    });
    res.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      var sa = a.p.stock > 0 ? 0 : 1, sb = b.p.stock > 0 ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.p.id < b.p.id ? -1 : 1;
    });
    return { hits: res.slice(0, 9), total: res.length, tokens: tokens };
  }

  /* ---------------- Icônes produit (SVG plats) ---------------- */
  function icon(kind, color) {
    var body = {
      sweater: '<path d="M12 11 L4 9 L3 17 L10 20 Z" fill="C"/><path d="M28 11 L36 9 L37 17 L30 20 Z" fill="C"/><path d="M13 9 Q13 13 20 13 Q27 13 27 9 L29 12 L29 33 Q29 35 27 35 L13 35 Q11 35 11 33 L11 12 Z" fill="C"/><ellipse cx="20" cy="8.5" rx="6.5" ry="3" fill="C" fill-opacity="0.72"/>',
      tshirt: '<path d="M13 8 L6 12 L9 18 L12 16 L12 34 Q12 35 13 35 L27 35 Q28 35 28 34 L28 16 L31 18 L34 12 L27 8 Q25 11 20 11 Q15 11 13 8 Z" fill="C"/>',
      shirt: '<path d="M13 7 L7 11 L9 17 L12 15 L12 34 L28 34 L28 15 L31 17 L33 11 L27 7 L24 10 L20 22 L16 10 Z" fill="C"/><path d="M16 7.5 L20 11 L24 7.5 L22 6 L18 6 Z" fill="C" fill-opacity="0.7"/>',
      pants: '<path d="M13 6 L27 6 L28 34 L22.5 34 L20.5 16 L19.5 16 L17.5 34 L12 34 Z" fill="C"/>',
      scarf: '<path d="M12 8 Q20 4 28 8 L28 14 Q20 10 12 14 Z" fill="C"/><path d="M14 12 L18 12 L17 32 L12 32 Z" fill="C" fill-opacity="0.85"/><path d="M22 12 L26 12 L27 28 L22 28 Z" fill="C" fill-opacity="0.72"/>',
      coat: '<path d="M12 8 L6 12 L8 20 L11 18 L11 36 L18 36 L18 14 L20 12 L22 14 L22 36 L29 36 L29 18 L32 20 L34 12 L28 8 Q24 11 20 11 Q16 11 12 8 Z" fill="C"/>',
      jacket: '<path d="M12 8 L6 12 L8 19 L11 17 L11 33 L18 33 L18 13 L20 11 L22 13 L22 33 L29 33 L29 17 L32 19 L34 12 L28 8 Q24 11 20 11 Q16 11 12 8 Z" fill="C"/><circle cx="20" cy="18" r="0.9" fill="#fff" fill-opacity="0.75"/><circle cx="20" cy="23" r="0.9" fill="#fff" fill-opacity="0.75"/>'
    }[kind] || "";
    return '<svg viewBox="0 0 40 40" width="44" height="44" aria-hidden="true">' + body.split("C").join(color) + "</svg>";
  }

  /* ---------------- UI ---------------- */
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  function initOne(rootEl) {
    var input = rootEl.querySelector(".play-input");
    var grid = rootEl.querySelector(".play-grid");
    var meta = rootEl.querySelector(".play-meta");
    var chips = rootEl.querySelectorAll(".play-chip");
    if (!input || !grid) return;

    function render(query) {
      var t0 = performance.now();
      var r = search(query);
      var ms = Math.max(1, Math.round(performance.now() - t0));
      if (!query.trim()) {
        grid.innerHTML = "";
        meta.innerHTML = "Tapez une recherche — les fautes de frappe sont bienvenues.";
        return;
      }
      meta.innerHTML = r.total
        ? "<strong>" + r.total + " résultat" + (r.total > 1 ? "s" : "") + "</strong> · " + ms + " ms · moteur Heurix embarqué, catalogue de démo (" + products.length + " produits)"
        : "Aucun résultat · " + ms + " ms";
      grid.innerHTML = r.hits.map(function (h) {
        var whyChips = h.why.filter(function (w, i, arr) { return arr.indexOf(w) === i; })
          .slice(0, 3).map(function (w) {
            return '<span class="play-why' + (w[0] === "#" ? " play-why-ann" : "") + '">' + esc(w) + "</span>";
          }).join("");
        return '<div class="play-card' + (h.p.stock === 0 ? " play-card-out" : "") + '">' +
          '<div class="play-thumb">' + icon(h.p.icon, h.p.color) + "</div>" +
          '<div class="play-body"><div class="play-name">' + esc(h.p.name) + "</div>" +
          '<div class="play-ref mono">' + esc(h.p.id) + "</div>" +
          '<div class="play-tags">' + whyChips + "</div></div>" +
          '<span class="play-stock">' + (h.p.stock > 0 ? (h.p.stock <= 3 ? h.p.stock + " restants" : "en stock") : "rupture") + "</span>" +
          "</div>";
      }).join("");
    }

    input.addEventListener("input", function () { render(input.value); });
    each(chips, function (chip) {
      chip.addEventListener("click", function () {
        input.value = chip.getAttribute("data-q");
        render(input.value);
        input.focus();
      });
    });

    // Intro : frappe automatique de la requête d'exemple, une seule fois.
    var INTRO = "pul col rolé roug";
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || rootEl.getAttribute("data-no-intro") === "1") {
      input.value = INTRO;
      render(INTRO);
      return;
    }
    var i = 0;
    var iv = setInterval(function () {
      if (document.activeElement === input) { clearInterval(iv); return; } // l'utilisateur a pris la main
      i++;
      input.value = INTRO.slice(0, i);
      render(input.value);
      if (i >= INTRO.length) clearInterval(iv);
    }, 55);
  }

  function init() {
    each(document.querySelectorAll(".play"), initOne);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // Exposé pour les curieux (et nos tests) : essayez window.heurixDemo.search("pul col rolé roug")
  window.heurixDemo = { search: search, annotate: annotate, catalogSize: products.length };
})();
