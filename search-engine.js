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
  // CE N'EST PAS UN CAS PARTICULIER DE RECHERCHE, c'est ce qu'une structure
  // TRIEE impose : l'ordre des elements n'est plus celui qu'on a en tete,
  // donc tout motif qui suppose une adjacence se tait -- sans erreur, en
  // rendant simplement zero. Chaque jeton doit etre exige separement.
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

  // `limite` a 0 rend TOUT : le compteur du haut annonce le total, la liste
  // n'en affiche que les premiers. Deux besoins, un seul parcours.
  function runSearch(query, limite) {
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
      .slice(0, limite === 0 ? undefined : (limite || 8));
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

  // ---------------------------------------------------------------------
  // LA MODALE EST CONSTRUITE EN JS (27 aout 2026), plus ecrite dans chaque page.
  //
  // Son balisage vivait en clair dans 122 pages -- 920 octets chacune, 109,6 ko
  // de duplication. Chaque changement de structure demandait de le reecrire
  // partout, et l'etape suivante l'aurait double.
  //
  // LE BOUTON RESTE DANS LE HTML. C'est l'affordance visible : il doit exister
  // avant que ce script tourne. La modale, elle, n'a aucun sens sans lui.
  //
  // CONSTRUITE A L'OUVERTURE, PAS AU CHARGEMENT : une page qui n'ouvre jamais
  // la recherche ne paie aucun noeud. Mesure du cout a froid, du clic au
  // premier affichage, plus bas dans ce fichier.
  // ---------------------------------------------------------------------

  var LIBELLES = {
    fr: {
      placeholder: "Rechercher sur heurix.fr…", fermer: "Échap",
      sources: "Sources", effacer: "Tout effacer",
      naviguer: "naviguer", ouvrir: "ouvrir", onglet: "nouvel onglet",
      vider: "effacer, puis fermer", resultat: "résultat", resultats: "résultats",
      recents: "Recherches récentes", avant: "À lire en premier",
      rien: "Rien pour", titre: "Rechercher sur le site",
      source: { blog: "Blog", secteurs: "Secteurs", documentation: "Documentation",
                plateformes: "Plateformes", produit: "Produit" },
    },
    en: {
      placeholder: "Search heurix.fr…", fermer: "Esc",
      sources: "Sources", effacer: "Clear all",
      naviguer: "navigate", ouvrir: "open", onglet: "new tab",
      vider: "clear, then close", resultat: "result", resultats: "results",
      recents: "Recent searches", avant: "Start here",
      rien: "Nothing for", titre: "Search this site",
      source: { blog: "Blog", secteurs: "Solutions", documentation: "Documentation",
                plateformes: "Platforms", produit: "Product" },
    },
  };

  function langue() {
    return /(^|\/)en\//.test(window.location.pathname) ? "en" : "fr";
  }

  var L = LIBELLES[langue()];

  function el(balise, classe, texte) {
    var n = document.createElement(balise);
    if (classe) n.className = classe;
    if (texte !== undefined) n.textContent = texte;
    return n;
  }

  var modale = null;

  function construireModale() {
    if (modale) return modale;

    var racine = el("div", "search-modal");
    racine.id = "heurix-search-modal";

    var fond = el("div", "search-backdrop");
    fond.id = "heurix-search-backdrop";
    fond.setAttribute("data-search-close", "");

    var panneau = el("div", "search-panel");
    panneau.setAttribute("role", "dialog");
    panneau.setAttribute("aria-modal", "true");
    panneau.setAttribute("aria-label", L.titre);

    // --- tete : icone, champ, compteur, echap ---
    var tete = el("div", "search-panel-head");
    tete.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

    var champ = el("input");
    champ.id = "heurix-search-input";
    champ.type = "text";
    champ.placeholder = L.placeholder;
    champ.setAttribute("autocomplete", "off");
    champ.setAttribute("role", "combobox");
    champ.setAttribute("aria-expanded", "false");
    champ.setAttribute("aria-controls", "heurix-search-results");
    champ.setAttribute("aria-autocomplete", "list");
    champ.setAttribute("aria-label", L.titre);

    var compte = el("span", "search-count");
    compte.id = "heurix-search-count";

    var fermer = el("button", "search-close", L.fermer);
    fermer.type = "button";
    fermer.setAttribute("data-search-close", "");

    tete.appendChild(champ);
    tete.appendChild(compte);
    tete.appendChild(fermer);

    // --- corps : rail de filtres + liste ---
    var corps = el("div", "search-body");
    var rail = el("aside", "search-rail");
    rail.id = "heurix-search-rail";
    var liste = el("div", "search-results");
    liste.id = "heurix-search-results";
    liste.setAttribute("role", "listbox");
    liste.setAttribute("aria-label", L.titre);
    corps.appendChild(rail);
    corps.appendChild(liste);

    var vide = el("p", "search-empty");
    vide.id = "heurix-search-empty";
    vide.hidden = true;

    var etiquette = el("p", "search-suggest-label");
    etiquette.id = "heurix-search-suggest-label";
    etiquette.hidden = true;

    // --- pied : aide clavier ---
    var pied = el("div", "search-foot");
    [["↑ ↓", L.naviguer], ["↵", L.ouvrir], ["⌘ ↵", L.onglet], ["Esc", L.vider]]
      .forEach(function (paire) {
        var k = el("span", "search-key");
        k.appendChild(el("kbd", null, paire[0]));
        k.appendChild(el("span", null, " " + paire[1]));
        pied.appendChild(k);
      });

    // ANNONCE DU NOMBRE DE RESULTATS. Hors du flux visuel mais dans le DOM :
    // `display:none` la rendrait muette pour les lecteurs d'ecran.
    var annonce = el("p", "search-sr-only");
    annonce.id = "heurix-search-annonce";
    annonce.setAttribute("aria-live", "polite");
    annonce.setAttribute("aria-atomic", "true");

    panneau.appendChild(tete);
    panneau.appendChild(etiquette);
    panneau.appendChild(corps);
    panneau.appendChild(vide);
    panneau.appendChild(pied);
    panneau.appendChild(annonce);
    racine.appendChild(fond);
    racine.appendChild(panneau);
    document.body.appendChild(racine);

    modale = {
      racine: racine, panneau: panneau, champ: champ, compte: compte,
      rail: rail, liste: liste, vide: vide, etiquette: etiquette,
      annonce: annonce, fond: fond,
    };
    return modale;
  }

  function init() {
    var root = calculerRoot();
    var btn = document.getElementById("heurix-search-btn");
    if (!btn) return;

    var m = null;                 // la modale, construite a la premiere ouverture
    var curseur = -1;             // index de l'option active, -1 = aucune
    var affiches = [];            // les items rendus, dans l'ordre
    var minuteurSquelette = null;
    var minuteurAnnonce = null;
    var focusAvant = null;

    // ----- rendu -------------------------------------------------------

    // La source arrive en clef (« secteurs »). La classe la reprend telle
    // quelle ; le mot affiche vient du dictionnaire de langue. Une clef
    // inconnue se montre brute plutot que de rendre une pastille vide.
    function pastille(clef) {
      return el("span", "search-pill search-pill-" + clef, L.source[clef] || clef);
    }

    function rendre(items, query) {
      m.liste.innerHTML = "";
      affiches = items;
      curseur = -1;
      items.forEach(function (item, i) {
        var a = document.createElement("a");
        a.className = "search-result";
        a.id = "heurix-search-opt-" + i;
        a.href = root + chemin(item);
        a.setAttribute("role", "option");
        a.setAttribute("aria-selected", "false");

        var titre = el("div", "search-result-title");
        poser(titre, item.t || "", query);
        a.appendChild(titre);

        // L'EXTRAIT D'UNE ANCRE EST LE TITRE DE SA PAGE, pas un resume : c'est
        // ce qui situe une section. Il n'est donc pas surligne comme un
        // extrait -- il est rendu dans la ligne meta, plus bas.
        if (!item.ancre && item.e) {
          var extrait = el("div", "search-result-excerpt");
          poser(extrait, item.e, query);
          a.appendChild(extrait);
        }

        var meta = el("div", "search-result-meta");
        if (item.s) meta.appendChild(pastille(item.s));
        // AUCUNE CATEGORIE INVENTEE. Verifie sur les 56 pages : og:type ne
        // rend que « article » ou « website », et le schema decrit
        // l'organisation. La seule seconde information derivable est la page
        // PARENTE d'une ancre, et c'est celle qui situe reellement.
        if (item.ancre && item.e) meta.appendChild(el("span", "search-result-parent", item.e));
        a.appendChild(meta);

        m.liste.appendChild(a);
      });
      m.champ.setAttribute("aria-expanded", items.length ? "true" : "false");
      m.champ.removeAttribute("aria-activedescendant");
    }

    function annoncer(n, query) {
      clearTimeout(minuteurAnnonce);
      minuteurAnnonce = setTimeout(function () {
        m.annonce.textContent = query
          ? n + " " + (n === 1 ? L.resultat : L.resultats)
          : "";
      }, 300);
    }

    function compteur(total) {
      m.compte.textContent = total ? total + " " + (total === 1 ? L.resultat : L.resultats) : "";
    }

    function suggestionsParDefaut() {
      m.vide.hidden = true;
      m.etiquette.hidden = false;
      m.etiquette.textContent = L.avant;
      compteur(0);
      rendre(derniers(), "");
    }

    function attendre(actif) {
      clearTimeout(minuteurSquelette);
      if (!actif) { m.liste.removeAttribute("data-chargement"); return; }
      minuteurSquelette = setTimeout(function () {
        m.liste.setAttribute("data-chargement", "1");
      }, 200);
    }

    function montrerErreur() {
      m.liste.innerHTML = "";
      m.liste.setAttribute("data-erreur", "1");
    }

    // ----- clavier -----------------------------------------------------

    function surligner(i) {
      var options = m.liste.querySelectorAll(".search-result");
      if (!options.length) return;
      if (curseur >= 0 && options[curseur]) {
        options[curseur].classList.remove("on");
        options[curseur].setAttribute("aria-selected", "false");
      }
      curseur = (i + options.length) % options.length;
      var a = options[curseur];
      a.classList.add("on");
      a.setAttribute("aria-selected", "true");
      m.champ.setAttribute("aria-activedescendant", a.id);
      // `block: nearest` plutot que `center` : deplacer la liste sous un
      // curseur qui n'en avait pas besoin desoriente autant qu'un element
      // hors champ.
      if (a.scrollIntoView) a.scrollIntoView({ block: "nearest" });
    }

    function ouvrirCourant(nouvelOnglet) {
      var options = m.liste.querySelectorAll(".search-result");
      var a = options[curseur >= 0 ? curseur : 0];
      if (!a) return;
      if (nouvelOnglet) window.open(a.href, "_blank", "noopener");
      else window.location.href = a.href;
    }

    function auClavier(e) {
      // `curseur` vaut -1 tant que rien n'est surligne, ce qui n'est pas
      // « avant l'index 0 » mais « hors de la liste ». Le modulo seul y
      // repond mal : depuis -1, une fleche haut viserait -2, donc
      // l'AVANT-DERNIERE option. Les deux entrees depuis l'exterieur sont
      // donc explicites.
      if (e.key === "ArrowDown") {
        e.preventDefault();
        surligner(curseur === -1 ? 0 : curseur + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        surligner(curseur === -1 ? m.liste.querySelectorAll(".search-result").length - 1 : curseur - 1);
      }
      else if (e.key === "Enter") { e.preventDefault(); ouvrirCourant(e.metaKey || e.ctrlKey); }
      else if (e.key === "Escape") {
        e.preventDefault();
        // ECHAP VIDE D'ABORD, FERME ENSUITE. Une requete tapee est un travail :
        // la fermeture la detruit, et c'est le geste le plus facile a faire
        // par accident.
        if (m.champ.value) { m.champ.value = ""; chercherEtRendre(); }
        else close();
      } else if (e.key === "Tab") {
        // PIEGE DE FOCUS : la modale est `aria-modal`, donc rien derriere elle
        // ne doit etre atteignable. Deux elements focalisables seulement -- le
        // champ et le bouton de fermeture -- le piege se referme donc a la
        // main plutot que par une liste calculee.
        var focalisables = m.panneau.querySelectorAll("input, button, a[href]");
        if (!focalisables.length) return;
        var premier = focalisables[0];
        var dernier = focalisables[focalisables.length - 1];
        if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
        else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
      }
    }

    // ----- recherche ---------------------------------------------------

    function chercherEtRendre() {
      var q = m.champ.value;
      if (!q.trim()) { suggestionsParDefaut(); annoncer(0, ""); return; }
      m.etiquette.hidden = true;
      var tous = runSearch(q, 0);          // 0 = sans plafond, pour le compteur
      var visibles = tous.slice(0, 8);
      m.vide.hidden = tous.length !== 0;
      m.vide.textContent = L.rien + " « " + q + " »";
      compteur(tous.length);
      rendre(visibles, q);
      annoncer(tous.length, q);
    }

    // ----- ouverture et fermeture ---------------------------------------

    // POSES UNE SEULE FOIS, a la construction. Les attacher dans `open()`
    // les empilait a chaque ouverture : la deuxieme fois, chaque frappe
    // declenchait deux recherches. Trouve en relisant, pas en mesurant --
    // le doublon ne se voit pas a l'ecran, il se voit au compteur d'appels.
    function cabler() {
      m.champ.addEventListener("input", chercherEtRendre);
      m.champ.addEventListener("keydown", auClavier);
      m.racine.querySelectorAll("[data-search-close]").forEach(function (n) {
        n.addEventListener("click", close);
      });
    }

    function open() {
      var neuve = !modale;
      m = construireModale();
      if (neuve) cabler();

      focusAvant = document.activeElement;
      m.racine.classList.add("open");
      document.body.style.overflow = "hidden";
      m.champ.value = "";
      setTimeout(function () { m.champ.focus(); }, 10);
      if (window.dataLayer) window.dataLayer.push({ event: "site_search_open" });

      attendre(true);
      precharger(root)
        .then(function () { attendre(false); suggestionsParDefaut(); })
        .catch(function () { attendre(false); montrerErreur(); });
    }

    function close() {
      if (!m) return;
      m.racine.classList.remove("open");
      document.body.style.overflow = "";
      // LE FOCUS REVIENT D'OU IL VENAIT. Sans cela il retombe sur <body> et la
      // navigation au clavier repart du haut de la page.
      if (focusAvant && focusAvant.focus) focusAvant.focus();
    }

    // ----- declencheurs --------------------------------------------------

    var peutSurvoler = !window.matchMedia || window.matchMedia("(hover: hover)").matches;
    if (peutSurvoler) {
      btn.addEventListener("pointerenter", function () { precharger(root).catch(function () {}); });
    }
    btn.addEventListener("focus", function () { precharger(root).catch(function () {}); });
    btn.addEventListener("click", open);

    document.addEventListener("keydown", function (e) {
      var ouverte = m && m.racine.classList.contains("open");
      if (e.key === "Escape" && ouverte) return;      // gere par auClavier
      if ((e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key === "k")) &&
          document.activeElement.tagName !== "INPUT" &&
          document.activeElement.tagName !== "TEXTAREA" && !ouverte) {
        e.preventDefault();
        open();
      }
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
