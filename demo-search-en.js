// Heurix — interactive engine demo (EN)
// Logique du moteur Heurix portée en JavaScript : normalisation, tolérance
// aux fautes (Damerau-Levenshtein bornée), cascade de règles, synonymes,
// scoring pondéré, et PRISMES (filtres par annotations).
// Catalogue librairie généré procéduralement.

(function () {
  "use strict";

  /* ---------------- Locale ---------------- */
  var L = {
    fmt: { PO: "Pocket", BR: "Paperback", GF: "Hardcover", IL: "Illustrated", AU: "Audiobook" },
    ed: { std: "", ann: "annotated edition", col: "collector", bil: "bilingual", vo: "original language", gc: "large print" },
    empty: "Type a search — typos are welcome.",
    results: function (n, ms, size) { return "<strong>" + n + " result" + (n > 1 ? "s" : "") + "</strong> · <span class=\"play-speed\">⚡ " + ms + " ms</span> · embedded Heurix engine, demo catalog (" + size.toLocaleString("en-GB") + " references)"; },
    none: function (ms) { return "No results · " + ms + " ms"; },
    stock: function (s) { return s > 0 ? (s <= 3 ? s + " left" : "in stock") : "out of stock"; },
    prisms: "Prisms:",
    pages: function (p) { return p + " pp."; },
    intro: "scandinavian crime poket",
    showMore: function (n) { return "Show " + n + " more result" + (n > 1 ? "s" : ""); }
  };
  var PRISM_LABELS = {
    GENRE_ROMAN: "Fiction", GENRE_POLAR: "Crime", GENRE_SF: "Sci-fi", GENRE_FANTASY: "Fantasy",
    GENRE_CLASSIQUE: "Classics", GENRE_JEUNESSE: "Children", GENRE_BD: "Comics & manga",
    GENRE_ESSAI: "Essay", GENRE_POESIE: "Poetry",
    FORMAT_PO: "Pocket", FORMAT_BR: "Paperback", FORMAT_GF: "Hardcover", FORMAT_IL: "Illustrated", FORMAT_AU: "Audio",
    PAYS_FR: "France", PAYS_UK: "United Kingdom", PAYS_US: "United States", PAYS_RU: "Russia",
    PAYS_JP: "Japan", PAYS_SE: "Scandinavia", PAYS_DE: "Germany", PAYS_IT: "Italy",
    PAYS_ES: "Spain", PAYS_CO: "Colombia", PAYS_CZ: "Czechia", PAYS_BE: "Belgium",
    LONG_COURT: "Short (<180 pp.)", LONG_MOYEN: "Medium length", LONG_PAVE: "Doorstop (500+ pp.)",
    ED_ANNOTE: "Annotated edition", ED_COLLECTOR: "Collector", ED_BILINGUE: "Bilingual", ED_VO: "Original language",
    POLAR_NORDIQUE: "Nordic crime", CLASSIQUE_POCHE: "Pocket classic", EDITION_SOIGNEE: "Premium edition"
  };
  // Compact version for the "why it matched" chips: no parenthetical detail.
  function shortLabel(code) {
    var full = prismLabel(code);
    if (full) return full.replace(/\s*\([^)]*\)\s*$/, "");
    var words = code.toLowerCase().split("_");
    return words.map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
  }
  function eraLabel(a) {
    var m = a.match(/^ERA_(\d+)S$/);
    if (m) { var c = Math.floor(parseInt(m[1], 10) / 100) + 1; return c + "th century"; }
    m = a.match(/^ERA_(\d{4})$/);
    return m ? m[1] + "s" : a;
  }

  /* ---------------- Normalisation ---------------- */
  function fold(s) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  var WORD_RE = /[a-z0-9]+(?:[./-][a-z0-9]+)*/g;
  function tokenize(s) { return fold(s).match(WORD_RE) || []; }

  /* ---------------- Fuzzy ---------------- */
  function maxEdits(t) {
    if (t.length <= 3) return 0;
    if (/\d/.test(t)) return 1;
    if (t.length <= 7) return 1;
    return 2;
  }
  function dlDistance(a, b, cap) {
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    if (a === b) return 0;
    var la = a.length, lb = b.length, prev2 = null, prev = [], curr, i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      curr = [i];
      var rowMin = i;
      for (j = 1; j <= lb; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        var v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        curr[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > cap) return cap + 1;
      prev2 = prev; prev = curr;
    }
    return prev[lb];
  }

  /* ---------------- Règles requête (bilingues) ---------------- */
  var LEVEL1 = [
    [/\bpolars?|thrillers?|policiers?|crimes?\b/g, "GENRE_POLAR"],
    [/\bsf\b|science.?fiction\b/g, "GENRE_SF"],
    [/\bfantasy|fantastique\b/g, "GENRE_FANTASY"],
    [/\bjeunesse|enfants?\b|children\b/g, "GENRE_JEUNESSE"],
    [/\bbd\b|bande.?dessinee|mangas?\b|comics?\b/g, "GENRE_BD"],
    [/\bessais?\b|essays?\b/g, "GENRE_ESSAI"],
    [/\bpoesie|poemes?|poetry\b/g, "GENRE_POESIE"],
    [/\bclassiques?\b/g, "GENRE_CLASSIQUE"],
    [/\bromans?\b|novels?\b/g, "GENRE_ROMAN"],
    [/\bpoches?\b|pocket\b/g, "FORMAT_PO"],
    [/\bbroches?\b|paperback\b/g, "FORMAT_BR"],
    [/\bgrand.?format\b|hardcover\b/g, "FORMAT_GF"],
    [/\billustres?|illustrated\b/g, "FORMAT_IL"],
    [/\baudio\b|audiobook\b/g, "FORMAT_AU"],
    [/\bannotee?s?\b|annotated\b/g, "ED_ANNOTE"],
    [/\bcollector\b/g, "ED_COLLECTOR"],
    [/\bbilingues?\b/g, "ED_BILINGUE"],
    [/\bvo\b/g, "ED_VO"],
    [/\bfrancais(?:e|es)?\b|french\b/g, "PAYS_FR"],
    [/\banglais(?:e|es)?\b|britanniques?\b|english|british\b/g, "PAYS_UK"],
    [/\bamericains?(?:e|es)?\b|american\b/g, "PAYS_US"],
    [/\brusses?\b|russian\b/g, "PAYS_RU"],
    [/\bjaponais(?:e|es)?\b|japanese\b/g, "PAYS_JP"],
    [/\bscandinaves?\b|suedois(?:e|es)?\b|nordiques?\b|scandinavian|swedish|nordic\b/g, "PAYS_SE"],
    [/\ballemands?(?:e|es)?\b|german\b/g, "PAYS_DE"],
    [/\bitaliens?(?:ne|nes)?\b|italian\b/g, "PAYS_IT"],
    [/\bcourts?\b|short\b/g, "LONG_COURT"],
    [/\bpaves?\b/g, "LONG_PAVE"],
    [/\bannees?\s?(\d{2})\b|\b(?:19|20)(\d{2})s\b/g, "ERA_19$1$2"],
    [/\b(1[5-9])e?m?e?\s?siecle\b|\b(1[5-9])th\s?century\b/g, "ERA_C$1$2"]
  ];
  var LEVEL2 = [
    [/GENRE_POLAR.*PAYS_SE|PAYS_SE.*GENRE_POLAR/, "POLAR_NORDIQUE"],
    [/GENRE_CLASSIQUE.*FORMAT_PO|FORMAT_PO.*GENRE_CLASSIQUE/, "CLASSIQUE_POCHE"],
    [/ED_(?:COLLECTOR|ANNOTE)|FORMAT_IL/, "EDITION_SOIGNEE"]
  ];

  function annotate(tokens) {
    var spaced = tokens.join(" ");
    var ann = {};
    LEVEL1.forEach(function (rule) {
      var re = new RegExp(rule[0].source, "g"), m;
      while ((m = re.exec(spaced)) !== null) {
        var a = rule[1];
        for (var g = 1; g < m.length; g++) a = a.replace("$" + g, m[g] || "");
        a = a.replace(/undefined/g, "");
        if (/^ERA_C(\d+)/.test(a)) a = "ERA_" + ((parseInt(a.slice(5), 10) - 1) * 100) + "S";
        ann[a] = true;
      }
    });
    var stream = Object.keys(ann).sort().join(" ");
    LEVEL2.forEach(function (rule) { if (rule[0].test(stream)) ann[rule[1]] = true; });
    return Object.keys(ann);
  }

  /* ---------------- Synonymes ---------------- */
  var SYN_GROUPS = [["polar", "policier", "thriller"], ["poche", "pocket"], ["bd", "manga"], ["sf", "anticipation"]];
  var SYN = {};
  SYN_GROUPS.forEach(function (g) { g.forEach(function (t) { SYN[t] = g; }); });

  /* ---------------- Catalogue librairie (généré) ---------------- */
  // [auteur, pays, genre, [[titre, année, pages], ...]]
  var SEED = [
    ["Victor Hugo", "FR", "classique", [["Les Misérables", 1862, 1900], ["Notre-Dame de Paris", 1831, 940], ["Les Contemplations", 1856, 480]]],
    ["Marcel Proust", "FR", "classique", [["Du côté de chez Swann", 1913, 530], ["Le Temps retrouvé", 1927, 450]]],
    ["Albert Camus", "FR", "roman", [["L'Étranger", 1942, 185], ["La Peste", 1947, 350], ["Le Mythe de Sisyphe", 1942, 190]]],
    ["Simone de Beauvoir", "FR", "essai", [["Le Deuxième Sexe", 1949, 660], ["Mémoires d'une jeune fille rangée", 1958, 470]]],
    ["Gustave Flaubert", "FR", "classique", [["Madame Bovary", 1857, 560], ["L'Éducation sentimentale", 1869, 620]]],
    ["Émile Zola", "FR", "classique", [["Germinal", 1885, 640], ["Au Bonheur des Dames", 1883, 540], ["L'Assommoir", 1877, 590]]],
    ["Honoré de Balzac", "FR", "classique", [["Le Père Goriot", 1835, 440], ["Illusions perdues", 1843, 860]]],
    ["Stendhal", "FR", "classique", [["Le Rouge et le Noir", 1830, 700], ["La Chartreuse de Parme", 1839, 640]]],
    ["Alexandre Dumas", "FR", "classique", [["Le Comte de Monte-Cristo", 1844, 1400], ["Les Trois Mousquetaires", 1844, 890]]],
    ["Jules Verne", "FR", "sf", [["Vingt Mille Lieues sous les mers", 1870, 620], ["Le Tour du monde en 80 jours", 1872, 330], ["Voyage au centre de la Terre", 1864, 370]]],
    ["Antoine de Saint-Exupéry", "FR", "jeunesse", [["Le Petit Prince", 1943, 120], ["Vol de nuit", 1931, 190]]],
    ["Marguerite Duras", "FR", "roman", [["L'Amant", 1984, 145], ["Un barrage contre le Pacifique", 1950, 370]]],
    ["Annie Ernaux", "FR", "roman", [["Les Années", 2008, 260], ["La Place", 1983, 115]]],
    ["Michel Houellebecq", "FR", "roman", [["Les Particules élémentaires", 1998, 400], ["La Carte et le Territoire", 2010, 430]]],
    ["Amélie Nothomb", "BE", "roman", [["Stupeur et Tremblements", 1999, 190], ["Métaphysique des tubes", 2000, 170]]],
    ["Romain Gary", "FR", "roman", [["La Vie devant soi", 1975, 270], ["La Promesse de l'aube", 1960, 390]]],
    ["Boris Vian", "FR", "roman", [["L'Écume des jours", 1947, 320], ["J'irai cracher sur vos tombes", 1946, 220]]],
    ["Fred Vargas", "FR", "polar", [["Pars vite et reviens tard", 2001, 350], ["L'Homme à l'envers", 1999, 320], ["Debout les morts", 1995, 330]]],
    ["Georges Simenon", "BE", "polar", [["Le Chien jaune", 1931, 190], ["Maigret et le clochard", 1963, 185], ["La nuit du carrefour", 1931, 180]]],
    ["Pierre Lemaitre", "FR", "polar", [["Au revoir là-haut", 2013, 580], ["Alex", 2011, 400]]],
    ["Jean-Christophe Grangé", "FR", "polar", [["Les Rivières pourpres", 1998, 400], ["Le Vol des cigognes", 1994, 430]]],
    ["Guillaume Musso", "FR", "roman", [["Et après...", 2004, 380], ["La Jeune Fille et la Nuit", 2018, 430]]],
    ["Jane Austen", "UK", "classique", [["Orgueil et Préjugés", 1813, 480], ["Raison et Sentiments", 1811, 430], ["Emma", 1815, 550]]],
    ["Charles Dickens", "UK", "classique", [["Oliver Twist", 1838, 560], ["De grandes espérances", 1861, 640], ["David Copperfield", 1850, 950]]],
    ["Virginia Woolf", "UK", "classique", [["Mrs Dalloway", 1925, 260], ["Vers le phare", 1927, 290]]],
    ["George Orwell", "UK", "sf", [["1984", 1949, 400], ["La Ferme des animaux", 1945, 150]]],
    ["Aldous Huxley", "UK", "sf", [["Le Meilleur des mondes", 1932, 320]]],
    ["J.R.R. Tolkien", "UK", "fantasy", [["Le Seigneur des anneaux", 1954, 1250], ["Le Hobbit", 1937, 400], ["Le Silmarillion", 1977, 480]]],
    ["J.K. Rowling", "UK", "jeunesse", [["Harry Potter à l'école des sorciers", 1997, 320], ["Harry Potter et la Chambre des secrets", 1998, 360], ["Harry Potter et le Prisonnier d'Azkaban", 1999, 460]]],
    ["Agatha Christie", "UK", "polar", [["Le Crime de l'Orient-Express", 1934, 280], ["Dix Petits Nègres", 1939, 260], ["Mort sur le Nil", 1937, 340]]],
    ["Arthur Conan Doyle", "UK", "polar", [["Le Chien des Baskerville", 1902, 250], ["Une étude en rouge", 1887, 200]]],
    ["Ian McEwan", "UK", "roman", [["Expiation", 2001, 490], ["Sur la plage de Chesil", 2007, 180]]],
    ["Kazuo Ishiguro", "UK", "roman", [["Les Vestiges du jour", 1989, 290], ["Auprès de moi toujours", 2005, 440]]],
    ["Mary Shelley", "UK", "sf", [["Frankenstein", 1818, 320]]],
    ["Bram Stoker", "UK", "fantasy", [["Dracula", 1897, 580]]],
    ["Ernest Hemingway", "US", "roman", [["Le Vieil Homme et la Mer", 1952, 140], ["Pour qui sonne le glas", 1940, 640]]],
    ["F. Scott Fitzgerald", "US", "classique", [["Gatsby le Magnifique", 1925, 220], ["Tendre est la nuit", 1934, 450]]],
    ["John Steinbeck", "US", "classique", [["Les Raisins de la colère", 1939, 640], ["Des souris et des hommes", 1937, 140]]],
    ["Toni Morrison", "US", "roman", [["Beloved", 1987, 400], ["Le Chant de Salomon", 1977, 460]]],
    ["Philip Roth", "US", "roman", [["Pastorale américaine", 1997, 580], ["La Tache", 2000, 480]]],
    ["Cormac McCarthy", "US", "roman", [["La Route", 2006, 250], ["Méridien de sang", 1985, 450]]],
    ["Stephen King", "US", "fantasy", [["Shining", 1977, 590], ["Ça", 1986, 1380], ["Misery", 1987, 400]]],
    ["Isaac Asimov", "US", "sf", [["Fondation", 1951, 280], ["Les Robots", 1950, 300], ["Seconde Fondation", 1953, 260]]],
    ["Philip K. Dick", "US", "sf", [["Ubik", 1969, 280], ["Le Maître du Haut Château", 1962, 330], ["Blade Runner", 1968, 290]]],
    ["Frank Herbert", "US", "sf", [["Dune", 1965, 830], ["Le Messie de Dune", 1969, 380]]],
    ["Ursula K. Le Guin", "US", "sf", [["La Main gauche de la nuit", 1969, 360], ["Les Dépossédés", 1974, 440]]],
    ["Ray Bradbury", "US", "sf", [["Fahrenheit 451", 1953, 210], ["Chroniques martiennes", 1950, 310]]],
    ["Harper Lee", "US", "roman", [["Ne tirez pas sur l'oiseau moqueur", 1960, 400]]],
    ["Paul Auster", "US", "roman", [["Trilogie new-yorkaise", 1987, 450], ["Moon Palace", 1989, 460]]],
    ["Donna Tartt", "US", "roman", [["Le Chardonneret", 2013, 1100], ["Le Maître des illusions", 1992, 700]]],
    ["Fiodor Dostoïevski", "RU", "classique", [["Crime et Châtiment", 1866, 700], ["Les Frères Karamazov", 1880, 990], ["L'Idiot", 1869, 820]]],
    ["Léon Tolstoï", "RU", "classique", [["Guerre et Paix", 1869, 1600], ["Anna Karénine", 1877, 980]]],
    ["Anton Tchekhov", "RU", "classique", [["La Dame au petit chien", 1899, 130], ["La Cerisaie", 1904, 120]]],
    ["Mikhaïl Boulgakov", "RU", "fantasy", [["Le Maître et Marguerite", 1967, 560]]],
    ["Haruki Murakami", "JP", "roman", [["Kafka sur le rivage", 2002, 640], ["1Q84", 2009, 1500], ["La Ballade de l'impossible", 1987, 440]]],
    ["Yasunari Kawabata", "JP", "roman", [["Pays de neige", 1947, 190], ["Les Belles Endormies", 1961, 140]]],
    ["Yukio Mishima", "JP", "roman", [["Le Pavillon d'or", 1956, 280], ["Confessions d'un masque", 1949, 250]]],
    ["Stieg Larsson", "SE", "polar", [["Les Hommes qui n'aimaient pas les femmes", 2005, 710], ["La Fille qui rêvait d'un bidon d'essence", 2006, 650]]],
    ["Henning Mankell", "SE", "polar", [["Meurtriers sans visage", 1991, 380], ["Les Chiens de Riga", 1992, 360]]],
    ["Camilla Läckberg", "SE", "polar", [["La Princesse des glaces", 2003, 480], ["Le Prédicateur", 2004, 460]]],
    ["Jo Nesbø", "SE", "polar", [["Le Bonhomme de neige", 2007, 580], ["L'Étoile du diable", 2003, 520]]],
    ["Arnaldur Indriðason", "SE", "polar", [["La Cité des jarres", 2000, 330], ["La Femme en vert", 2001, 350]]],
    ["Franz Kafka", "CZ", "classique", [["Le Procès", 1925, 350], ["La Métamorphose", 1915, 130], ["Le Château", 1926, 500]]],
    ["Thomas Mann", "DE", "classique", [["La Montagne magique", 1924, 1000], ["Mort à Venise", 1912, 140]]],
    ["Hermann Hesse", "DE", "roman", [["Siddhartha", 1922, 180], ["Le Loup des steppes", 1927, 310]]],
    ["Stefan Zweig", "DE", "classique", [["Le Joueur d'échecs", 1942, 130], ["Lettre d'une inconnue", 1922, 110], ["La Confusion des sentiments", 1927, 180]]],
    ["Patrick Süskind", "DE", "roman", [["Le Parfum", 1985, 340]]],
    ["Umberto Eco", "IT", "polar", [["Le Nom de la rose", 1980, 640], ["Le Pendule de Foucault", 1988, 750]]],
    ["Elena Ferrante", "IT", "roman", [["L'Amie prodigieuse", 2011, 430], ["Le Nouveau Nom", 2012, 560]]],
    ["Italo Calvino", "IT", "roman", [["Le Baron perché", 1957, 300], ["Si par une nuit d'hiver un voyageur", 1979, 280]]],
    ["Miguel de Cervantès", "ES", "classique", [["Don Quichotte", 1605, 1100]]],
    ["Carlos Ruiz Zafón", "ES", "roman", [["L'Ombre du vent", 2001, 540], ["Le Jeu de l'ange", 2008, 620]]],
    ["Gabriel García Márquez", "CO", "roman", [["Cent Ans de solitude", 1967, 460], ["L'Amour aux temps du choléra", 1985, 420]]],
    ["Jorge Luis Borges", "CO", "roman", [["Fictions", 1944, 200], ["L'Aleph", 1949, 220]]],
    ["Hergé", "BE", "bd", [["Tintin : Objectif Lune", 1953, 62], ["Tintin : Le Lotus bleu", 1936, 62], ["Tintin : L'Affaire Tournesol", 1956, 62]]],
    ["René Goscinny", "FR", "bd", [["Astérix le Gaulois", 1961, 48], ["Astérix et Cléopâtre", 1965, 48], ["Le Petit Nicolas", 1960, 140]]],
    ["Marjane Satrapi", "FR", "bd", [["Persepolis", 2000, 370]]],
    ["Art Spiegelman", "US", "bd", [["Maus", 1986, 300]]],
    ["Eiichiro Oda", "JP", "bd", [["One Piece — Tome 1", 1997, 208], ["One Piece — Tome 2", 1998, 200]]],
    ["Akira Toriyama", "JP", "bd", [["Dragon Ball — Tome 1", 1984, 192], ["Dragon Ball — Tome 2", 1985, 192]]],
    ["Naoki Urasawa", "JP", "bd", [["Monster — Tome 1", 1994, 216], ["20th Century Boys — Tome 1", 1999, 216]]],
    ["Jirō Taniguchi", "JP", "bd", [["Quartier lointain", 1998, 410], ["Le Sommet des dieux — Tome 1", 2000, 330]]],
    ["Antonio Machado", "ES", "poesie", [["Champs de Castille", 1912, 180]]],
    ["Charles Baudelaire", "FR", "poesie", [["Les Fleurs du mal", 1857, 300], ["Le Spleen de Paris", 1869, 200]]],
    ["Arthur Rimbaud", "FR", "poesie", [["Illuminations", 1886, 130], ["Une saison en enfer", 1873, 110]]],
    ["Paul Verlaine", "FR", "poesie", [["Romances sans paroles", 1874, 120]]],
    ["Yuval Noah Harari", "UK", "essai", [["Sapiens", 2011, 500], ["Homo Deus", 2015, 460]]],
    ["Michel de Montaigne", "FR", "essai", [["Essais — Livre I", 1580, 470]]],
    ["Hannah Arendt", "DE", "essai", [["La Condition de l'homme moderne", 1958, 400], ["Eichmann à Jérusalem", 1963, 480]]]
  ];

  /* ---------------- Génération + indexation ---------------- */
  var FIELD_W = { ref: 4, name: 3, desc: 1 };
  var ANN_W = 5;
  var products = [], termIndex = {}, annIndex = {}, vocabByLen = {};
  var seq = 1000;

  function addTerm(t, pid, w, isSku) {
    (termIndex[t] = termIndex[t] || {})[pid] = (termIndex[t][pid] || 0) + w;
    if (!isSku) (vocabByLen[t.length] = vocabByLen[t.length] || {})[t] = true;
  }
  function rng(s) { return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
  function eraOf(year) {
    if (year >= 1900) return "ERA_" + (Math.floor(year / 10) * 10);
    return "ERA_" + (Math.floor(year / 100) * 100) + "S";
  }
  function lengthOf(pages) { return pages < 180 ? "LONG_COURT" : (pages >= 500 ? "LONG_PAVE" : "LONG_MOYEN"); }

  (function build() {
    // [format, édition, plausible pour BD?, delta prix]
    var VAR = [
      ["PO", "std", true, 0], ["PO", "ann", false, 2], ["PO", "bil", false, 3], ["PO", "gc", false, 2],
      ["BR", "std", true, 6], ["BR", "ann", false, 8], ["BR", "vo", false, 7],
      ["GF", "std", true, 13], ["GF", "col", true, 24], ["GF", "ann", false, 16],
      ["IL", "std", true, 19], ["IL", "col", true, 32],
      ["AU", "std", false, 9]
    ];
    SEED.forEach(function (row, ai) {
      var author = row[0], pays = row[1], genre = row[2], works = row[3];
      works.forEach(function (w, bi) {
        var title = w[0], year = w[1], pages = w[2];
        var rand = rng(ai * 131 + bi * 17 + 3);
        VAR.forEach(function (v) {
          if (genre === "bd" && !v[2]) return;
          if (v[1] === "vo" && (pays === "FR" || pays === "BE")) return;
          // Retirages : les classiques vivent en plusieurs collections et millésimes
          var P = { "PO.std": 16, "PO.ann": 2, "PO.bil": 2, "PO.gc": 2, "BR.std": 9, "BR.ann": 2, "BR.vo": 2,
                    "GF.std": 6, "GF.col": 2, "GF.ann": 2, "IL.std": 3, "IL.col": 2, "AU.std": 4 };
          var presses = P[v[0] + "." + v[1]] || 1;
          for (var pr = 0; pr < presses; pr++) {
            var pid = products.length;
            var fmt = v[0], ed = v[1];
            var edYear = 1995 + Math.floor(rand() * 30);
            var sku = "HRX-" + fmt + "-" + (seq++);
            var descParts = [L.fmt[fmt]];
            if (L.ed[ed]) descParts.push(L.ed[ed]);
            descParts.push(String(edYear), L.pages(pages));
            var price = Math.max(3, 8 + v[3] + Math.floor(rand() * 4) + (pages > 700 ? 4 : 0));
            var stock = rand() < 0.07 ? 0 : 1 + Math.floor(rand() * 22);
            var anns = ["FORMAT_" + fmt, "GENRE_" + genre.toUpperCase(), "PAYS_" + pays, eraOf(year), lengthOf(pages)];
            if (ed === "ann") anns.push("ED_ANNOTE");
            if (ed === "col") anns.push("ED_COLLECTOR");
            if (ed === "bil") anns.push("ED_BILINGUE");
            if (ed === "vo") anns.push("ED_VO");
            if (genre === "polar" && pays === "SE") anns.push("POLAR_NORDIQUE");
            if (genre === "classique" && fmt === "PO") anns.push("CLASSIQUE_POCHE");
            if (ed === "col" || ed === "ann" || fmt === "IL") anns.push("EDITION_SOIGNEE");

            var p = { id: sku, author: author, title: title, desc: descParts.join(" · "),
                      fmt: fmt, genre: genre, pages: pages, price: price, stock: stock, anns: anns,
                      hue: (ai * 41 + bi * 97) % 360, pat: (ai + bi) % 5 };
            products.push(p);
            tokenize(sku).forEach(function (t) { addTerm(t, pid, FIELD_W.ref, true); });
            tokenize(author + " " + title).forEach(function (t) { addTerm(t, pid, FIELD_W.name, false); });
            tokenize(p.desc + " " + genre).forEach(function (t) { addTerm(t, pid, FIELD_W.desc, false); });
            anns.forEach(function (a) { (annIndex[a] = annIndex[a] || []).push(pid); });
          }
        });
      });
    });
  })();

  /* ---------------- Recherche ---------------- */
  function fuzzyVariants(term) {
    var cap = maxEdits(term), out = [], seen = {};
    for (var Len = term.length - cap; Len <= term.length + cap; Len++) {
      var bucket = vocabByLen[Len];
      if (!bucket) continue;
      for (var cand in bucket) {
        var d = cand === term ? 0 : dlDistance(term, cand, cap);
        if (d <= cap) { out.push([cand, d]); seen[cand] = true; }
      }
    }
    if (termIndex[term] && !seen[term]) out.push([term, 0]);
    return out;
  }

  var FUZZY_P = [1.0, 0.6, 0.35], SYN_P = 0.8, MAX_EXP = 40;

  function search(query) {
    var tokens = tokenize(query);
    if (!tokens.length) return { all: [], total: 0, tokens: [] };
    var scores = {}, cover = {}, why = {};

    tokens.forEach(function (tok, pos) {
      var cands = {};
      fuzzyVariants(tok).forEach(function (v) { cands[v[0]] = Math.max(cands[v[0]] || 0, FUZZY_P[v[1]]); });
      (SYN[tok] || []).forEach(function (syn) {
        if (syn === tok) return;
        fuzzyVariants(syn).forEach(function (v) { cands[v[0]] = Math.max(cands[v[0]] || 0, FUZZY_P[v[1]] * SYN_P); });
      });
      var entries = Object.keys(cands).map(function (k) { return [k, cands[k]]; });
      if (entries.length > MAX_EXP) { entries.sort(function (a, b) { return b[1] - a[1]; }); entries = entries.slice(0, MAX_EXP); }
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

    var res = [];
    for (var pid in scores) {
      var covered = 0, hasAnn = false;
      for (var k in cover[pid]) { if (k === "a") hasAnn = true; else covered++; }
      var c = covered / tokens.length;
      if (hasAnn) c = Math.max(c, 0.5);
      res.push({ p: products[pid], score: scores[pid] * (1 + c), why: why[pid] || [] });
    }
    res.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      var sa = a.p.stock > 0 ? 0 : 1, sb = b.p.stock > 0 ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.p.id < b.p.id ? -1 : 1;
    });
    return { all: res, total: res.length, tokens: tokens };
  }

  /* ---------------- Procedural cover art ---------------- */
  // Fully generated (gradients, geometric shapes, typography) — never real artwork:
  // an actual book cover is a protected work, so it can neither be fetched nor imitated.
  // The visual family + palette varies by genre, the exact hue by title, so each book
  // stays recognizable without ever reproducing a real cover.
  var FAMILY_BY_GENRE = {
    polar: "noir", sf: "cosmic", fantasy: "cosmic",
    classique: "classic", essai: "classic", poesie: "classic",
    jeunesse: "bright", bd: "bright", roman: "warm"
  };

  function wrapTitle(text, maxChars, maxLines) {
    var words = text.split(" "), lines = [], cur = "";
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + " " + words[i] : words[i];
      if (test.length <= maxChars) { cur = test; }
      else { if (cur) lines.push(cur); cur = words[i]; if (lines.length >= maxLines) break; }
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length > maxLines) lines = lines.slice(0, maxLines);
    if (lines.join(" ").length < text.length && lines.length === maxLines) {
      var last = lines[maxLines - 1];
      while (last.length > maxChars - 1) last = last.slice(0, -1);
      lines[maxLines - 1] = last.replace(/\s+\S*$/, "") + "…";
    }
    return lines;
  }

  /* ---------------- UI + Prismes ---------------- */
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function prismLabel(a) { return PRISM_LABELS[a] || (a.indexOf("ERA_") === 0 ? eraLabel(a) : null); }

  function initOne(rootEl) {
    var input = rootEl.querySelector(".play-input");
    var grid = rootEl.querySelector(".play-grid");
    var meta = rootEl.querySelector(".play-meta");
    var prismsEl = rootEl.querySelector(".play-prisms");
    var moreBtn = rootEl.querySelector(".play-more");
    var chips = rootEl.querySelectorAll(".play-chip");
    if (!input || !grid) return;
    var active = {}; // annotation -> true
    var expanded = false; // "show more" on mobile

    function render(query, keepFilters) {
      if (!keepFilters) { active = {}; expanded = false; }
      var t0 = performance.now();
      var r = search(query);
      // Application des prismes actifs
      var filtered = r.all;
      var keys = Object.keys(active);
      if (keys.length) {
        filtered = r.all.filter(function (h) {
          return keys.every(function (a) { return h.p.anns.indexOf(a) !== -1; });
        });
      }
      var ms = Math.max(1, Math.round(performance.now() - t0));
      if (!query.trim()) { grid.innerHTML = ""; if (prismsEl) prismsEl.innerHTML = ""; meta.innerHTML = L.empty; return; }
      meta.innerHTML = filtered.length ? L.results(filtered.length, ms, products.length) : L.none(ms);

      // Barre de prismes : les annotations les plus fréquentes dans les résultats
      if (prismsEl) {
        var counts = {};
        r.all.forEach(function (h) { h.p.anns.forEach(function (a) { counts[a] = (counts[a] || 0) + 1; }); });
        var groups = {};
        Object.keys(counts).forEach(function (a) {
          var lbl = prismLabel(a);
          if (!lbl) return;
          var g = a.split("_")[0];
          (groups[g] = groups[g] || []).push([a, counts[a], lbl]);
        });
        var chipsHtml = [];
        var groupLabels = { GENRE: "Genre", FORMAT: "Format", PAYS: "Origin", ERA: "Era", LONG: "Length" };
        ["GENRE", "FORMAT", "PAYS", "ERA", "LONG"].forEach(function (g) {
          if (!groups[g]) return;
          groups[g].sort(function (a, b) { return b[1] - a[1]; });
          chipsHtml.push('<span class="play-prism-group">' + (groupLabels[g] || g) + "</span>");
          groups[g].slice(0, g === "ERA" ? 2 : 3).forEach(function (item) {
            var on = active[item[0]] ? " play-prism-on" : "";
            chipsHtml.push('<button type="button" class="play-prism' + on + '" data-ann="' + item[0] + '">' + esc(item[2]) + ' <span class="play-prism-n">' + item[1] + "</span></button>");
          });
        });
        prismsEl.innerHTML = chipsHtml.length ? '<span class="play-prisms-label">' + L.prisms + "</span>" + chipsHtml.join("") : "";
        each(prismsEl.querySelectorAll(".play-prism"), function (btn) {
          btn.addEventListener("click", function () {
            var a = btn.getAttribute("data-ann");
            if (active[a]) delete active[a]; else active[a] = true;
            render(input.value, true);
          });
        });
      }

      // Diversité d'affichage : au plus 2 éditions du même titre dans le haut de liste,
      // pour montrer la variété du catalogue plutôt qu'une pile de pressages identiques.
      // Sur mobile, on limite l'affichage initial à 3 avec un bouton "Show more" —
      // pas la peine de faire défiler 9 cartes pleine largeur sur un écran de téléphone.
      var isMobile = window.innerWidth < 640;
      var baseCount = isMobile ? 3 : 9;
      var expandedCount = isMobile ? 9 : 24;
      var visibleCount = expanded ? expandedCount : baseCount;
      var seenTitle = {}, diverse = [];
      for (var di = 0; di < filtered.length && diverse.length < visibleCount; di++) {
        var tk = filtered[di].p.author + "|" + filtered[di].p.title;
        seenTitle[tk] = (seenTitle[tk] || 0) + 1;
        if (seenTitle[tk] <= 2) diverse.push(filtered[di]);
      }
      grid.innerHTML = diverse.map(function (h) {
        var whyChips = h.why.filter(function (w, i, arr) { return arr.indexOf(w) === i; })
          .slice(0, 3).map(function (w) {
            if (w[0] === "#") return '<span class="play-why play-why-ann">' + esc(shortLabel(w.slice(1))) + "</span>";
            return '<span class="play-why">' + esc(w) + "</span>";
          }).join("");
        return '<div class="play-card' + (h.p.stock === 0 ? " play-card-out" : "") + '">' +
          '<div class="play-thumb">' + coverArt(h.p) + "</div>" +
          '<div class="play-body"><div class="play-name">' + esc(h.p.title) + " — " + esc(h.p.author) + "</div>" +
          '<div class="play-ref mono">' + esc(h.p.id) + " · " + esc(h.p.desc) + "</div>" +
          '<div class="play-tags">' + whyChips + "</div></div>" +
          '<div class="play-side"><span class="play-price">' + h.p.price + " €</span>" +
          '<span class="play-stock">' + L.stock(h.p.stock) + "</span></div>" +
          "</div>";
      }).join("");

      if (!expanded && filtered.length > diverse.length) {
        var remaining = Math.min(filtered.length, expandedCount) - diverse.length;
        moreBtn.hidden = false;
        moreBtn.textContent = L.showMore(remaining);
      } else {
        moreBtn.hidden = true;
      }
    }

    moreBtn.addEventListener("click", function () {
      expanded = true;
      render(input.value, true);
    });

    input.addEventListener("input", function () { render(input.value); });
    each(chips, function (chip) {
      chip.addEventListener("click", function () {
        input.value = chip.getAttribute("data-q");
        render(input.value);
        input.focus();
      });
    });

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || rootEl.getAttribute("data-no-intro") === "1") { input.value = L.intro; render(L.intro); return; }
    var i = 0;
    var iv = setInterval(function () {
      if (document.activeElement === input) { clearInterval(iv); return; }
      i++;
      input.value = L.intro.slice(0, i);
      render(input.value);
      if (i >= L.intro.length) clearInterval(iv);
    }, 55);
  }

  function init() { each(document.querySelectorAll(".play"), initOne); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // For the curious: window.heurixDemo.search("scandinavian crim novel pocket")
  window.heurixDemo = { search: search, annotate: annotate, catalogSize: products.length, shortLabel: shortLabel };
})();
