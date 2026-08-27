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
// N'attend plus RIEN de la page (27 août 2026). L'index vivait dans deux
// tableaux JavaScript écrits à la main -- search.js et search-en.js --
// chargés par les 118 pages du site. Il est désormais DÉRIVÉ des pages,
// servi en JSON, et récupéré au premier usage : voir `precharger`.
(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // CHARGEMENT DIFFERE DE L'INDEX (27 aout 2026)
  //
  // L'index derive pese 40,9 ko une fois compresse -- GitHub Pages sert du
  // gzip, pas du brotli, verifie sur l'origine. Le charger dans chaque page
  // le ferait payer aux 118 pages du site, par tous les visiteurs, alors que
  // la grande majorite ne cherche jamais.
  //
  // Il est donc recupere au PREMIER USAGE. Cout mesure, connexion deja
  // chaude (meme origine, page chargee, donc RTT + transfert) :
  //
  //     ma connexion (mesuree)     63 ms RTT +  20 ms  =    83 ms
  //     4G lente (4 Mbps)         170 ms     +  82 ms  =   252 ms
  //     3G rapide (1,6 Mbps)      562 ms     + 204 ms  =   766 ms
  //     3G lente (400 kbps)       400 ms     + 818 ms  =  1218 ms
  //
  // Le budget est de 150 ms. Attendre la frappe ne tient donc pas : ce
  // serait rendre a l'envers l'arbitrage qui a ecarte l'API a 83 ms.
  //
  // ON PRECHARGE DONC SUR INTENTION, avant que la requete existe. Ce que ca
  // achete, mesure sur 116 suites de frappe reelles du journal : de la
  // premiere frappe journalisee a la derniere, mediane 4 217 ms, premier
  // quartile 2 205 ms. Trois quarts des visiteurs tapent plus de deux
  // secondes -- de quoi couvrir la 3G rapide, et une bonne part de la lente.
  //
  // CE QUE JE N'AI PAS PU MESURER : l'intervalle entre le survol et la
  // premiere frappe. Le journal ne commence qu'a trois caracteres, il ne
  // porte pas ce qui precede. Le squelette au-dela de 200 ms est le repli
  // pour les cas ou le prechargement n'a pas eu le temps.
  // ---------------------------------------------------------------------

  var INDEX = [];
  var DERNIERS = [];
  var indexPromesse = null;
  var indexErreur = false;

  /** L'URL de l'index de la langue de la page. */
  // LA VERSION DU MOTEUR SERT AUSSI D'ANTIMEMOIRE A L'INDEX.
  //
  // Les deux changent ensemble : le jour ou le format de l'index bouge, le
  // moteur qui le lit bouge aussi. Reprendre sa clef ?v= evite un second
  // versionnement a tenir a jour -- et surtout evite le cas ou l'un est
  // rafraichi et pas l'autre.
  //
  // Sans clef du tout, un visiteur deja venu recevrait l'ANCIEN moteur en
  // cache : celui qui lit window.HEURIX_SEARCH_INDEX, que les pages ne
  // definissent plus. La modale s'ouvrirait vide, sans erreur.
  function versionMoteur() {
    var s = document.querySelector('script[src*="search-engine.js"]');
    var m = s && s.getAttribute("src").match(/[?&]v=([^&"]+)/);
    return m ? m[1] : "";
  }

  function urlIndex(root) {
    var en = /(^|\/)en\//.test(window.location.pathname);
    var v = versionMoteur();
    return root + "search-index-" + (en ? "en" : "fr") + ".json" + (v ? "?v=" + v : "");
  }

  /** Lance le chargement s'il n'a pas deja commence. Idempotent.
   *
   * NE LEVE JAMAIS, meme sans `fetch`. Une premiere version appelait
   * `fetch` directement : sur un navigateur qui ne le connait pas, l'appel
   * jetait SYNCHRONEMENT depuis un gestionnaire de clic, donc avant tout
   * `.catch()`, et l'erreur remontait a la fenetre. Trouve en eprouvant ce
   * cas, pas en le relisant -- les quatre autres passaient.
   */
  function precharger(root) {
    if (indexPromesse) return indexPromesse;
    if (typeof fetch !== "function") {
      indexErreur = true;
      return Promise.reject(new Error("fetch indisponible"));
    }
    indexPromesse = fetch(urlIndex(root))
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        INDEX = data.entrees || [];
        DERNIERS = data.derniers || [];
        indexErreur = false;
        return INDEX;
      })
      .catch(function (e) {
        // Une erreur ne doit pas figer l'etat : la promesse est remise a
        // zero pour qu'un « Reessayer » relance vraiment, au lieu de rendre
        // le meme echec en cache.
        indexPromesse = null;
        indexErreur = true;
        throw e;
      });
    return indexPromesse;
  }

  function chemin(item) { return item.p; }

  function derniers() {
    return DERNIERS
      .map(function (p) {
        return INDEX.filter(function (item) { return chemin(item) === p; })[0];
      })
      .filter(Boolean);
  }

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

  // Les termes d'une page sont deja replies et separes par des espaces a la
  // generation. On les entoure d'espaces pour qu'une requete d'un seul terme
  // ne matche pas au milieu d'un autre -- « rs » ne doit pas trouver « 2rs ».
  var cacheTermes = null;
  function nTerms(item) {
    if (!cacheTermes) cacheTermes = {};
    var c = chemin(item);
    if (cacheTermes[c] === undefined) cacheTermes[c] = " " + (item.k || "") + " ";
    return cacheTermes[c];
  }

  // TOUS LES JETONS DE LA REQUETE, PAS LA CHAINE ENTIERE.
  //
  // Le champ `k` est une liste de termes TRIES et separes par des espaces.
  // « din » et « 933 » n'y sont pas voisins, donc y chercher « din 933 »
  // d'un bloc ne trouve rien -- mesure de la premiere version : 0 resultat
  // pour une requete que sept pages satisfont.
  //
  // On exige donc chaque jeton separement. C'est la meme regle que la mesure
  // qui a valide l'extraction, et elle porte le meme defaut connu : elle
  // trouve « din » et « 933 » sans qu'ils se suivent. Verifie sur ce
  // corpus -- 7 pages remontees pour 7 qui en parlent, zero faux positif.
  function tousLesTermes(item, nQuery) {
    var termes = nTerms(item);
    var jetons = nQuery.split(/\s+/);
    for (var i = 0; i < jetons.length; i++) {
      if (!jetons[i]) continue;
      if (termes.indexOf(" " + jetons[i]) === -1) return false;
    }
    return true;
  }

  function runSearch(query) {
    var nQuery = normalize(query.trim());
    if (!nQuery) return [];
    return INDEX
      .map(function (item) {
        var nTitle = normalize(item.t || "");
        var nExcerpt = normalize(item.e || "");
        var score = -1;
        if (nTitle.indexOf(nQuery) !== -1) score = nTitle.indexOf(nQuery) === 0 ? 2 : 1;
        else if (nExcerpt.indexOf(nQuery) !== -1) score = 0;
        // LES TERMES DE LA PAGE, en dernier recours et au score le plus bas.
        //
        // C'EST TOUTE LA RAISON D'ETRE DE L'INDEX DERIVE, et la premiere
        // version de ce commit ne les lisait pas : la recherche continuait
        // d'interroger le titre et l'extrait, exactement comme avec l'index
        // ecrit a la main. Tout fonctionnait -- et « 2rs » rendait 2 pages
        // au lieu de 8, « din 933 » zero au lieu de 7. Aucune erreur, aucun
        // signal : les nouvelles donnees servies par l'ancien comportement.
        //
        // Un titre reste plus fort qu'un terme de corps : quelqu'un qui
        // cherche « tarifs » veut la page Tarifs, pas les onze pages qui
        // mentionnent le mot.
        else if (tousLesTermes(item, nQuery)) score = -0.5;
        return { item: item, score: score };
      })
      .filter(function (r) { return r.score > -1; })
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
        a.href = root + chemin(item);
        var titre = document.createElement("div");
        titre.className = "search-result-title";
        poser(titre, item.t || "", query);
        var extrait = document.createElement("div");
        extrait.className = "search-result-excerpt";
        poser(extrait, item.e || "", query);
        a.appendChild(titre);
        a.appendChild(extrait);
        resultsEl.appendChild(a);
      });
    }

    function showDefaultSuggestions() {
      emptyEl.hidden = true;
      if (suggestLabel) suggestLabel.hidden = false;
      renderItems(derniers(), "");
    }

    // SQUELETTE AU-DELA DE 200 ms, PAS AVANT. En dessous, la liste
    // precedente reste : un flash de vide sur une connexion rapide est plus
    // desagreable que l'attente qu'il signale.
    var minuteurSquelette = null;
    function attendre(actif) {
      clearTimeout(minuteurSquelette);
      if (!actif) { resultsEl.removeAttribute("data-chargement"); return; }
      minuteurSquelette = setTimeout(function () {
        resultsEl.setAttribute("data-chargement", "1");
      }, 200);
    }

    // PRECHARGEMENT SUR INTENTION -- ET PAS SUR SURVOL TACTILE.
    //
    // `hover: hover` demande directement « cet appareil sait-il survoler ? »,
    // ce qui est la question, la ou `pointer: coarse` demande la finesse du
    // pointeur. Sur mobile, un survol EST un debut de tap : s'y accrocher
    // ferait recuperer 40 ko a chaque effleurement du bandeau.
    //
    // Les autres declencheurs couvrent tous les chemins d'ouverture, y
    // compris Ctrl+K qui ne passe jamais par le bouton.
    var peutSurvoler = !window.matchMedia || window.matchMedia("(hover: hover)").matches;
    if (peutSurvoler) {
      btn.addEventListener("pointerenter", function () { precharger(root).catch(function () {}); });
    }
    btn.addEventListener("focus", function () { precharger(root).catch(function () {}); });

    function open() {
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
      input.value = "";
      setTimeout(function () { input.focus(); }, 10);
      if (window.dataLayer) window.dataLayer.push({ event: "site_search_open" });

      attendre(true);
      precharger(root)
        .then(function () { attendre(false); showDefaultSuggestions(); })
        .catch(function () { attendre(false); montrerErreur(); });
    }

    function montrerErreur() {
      resultsEl.innerHTML = "";
      resultsEl.setAttribute("data-erreur", "1");
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
