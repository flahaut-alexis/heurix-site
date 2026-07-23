// Heurix — démo interactive du moteur (FR)
// Logique du moteur Heurix portée en JavaScript : normalisation, tolérance
// aux fautes (Damerau-Levenshtein bornée), cascade de règles, synonymes,
// scoring pondéré, et PRISMES (filtres par annotations).
// Deux verticales de démonstration (Livres, Outillage), sélectionnables —
// le moteur générique (normalisation, fuzzy, scoring) est partagé ; seules
// les règles d'annotation et les données changent d'une verticale à l'autre.

(function () {
  "use strict";

  /* ---------------- Normalisation (partagé, indépendant de la verticale) ---------------- */
  function fold(s) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  var WORD_RE = /[a-z0-9]+(?:[./-][a-z0-9]+)*/g;
  function tokenize(s) { return fold(s).match(WORD_RE) || []; }

  /* ---------------- Fuzzy (partagé) ---------------- */
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

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function rng(s) { return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }

  /* =====================================================================
     VERTICALE : LIVRES (existante)
     ===================================================================== */
  var LIVRES_LABELS = {
    GENRE_ROMAN: "Roman", GENRE_POLAR: "Polar", GENRE_SF: "SF", GENRE_FANTASY: "Fantasy",
    GENRE_CLASSIQUE: "Classique", GENRE_JEUNESSE: "Jeunesse", GENRE_BD: "BD & manga",
    GENRE_ESSAI: "Essai", GENRE_POESIE: "Poésie",
    FORMAT_PO: "Poche", FORMAT_BR: "Broché", FORMAT_GF: "Grand format", FORMAT_IL: "Illustré", FORMAT_AU: "Audio",
    PAYS_FR: "France", PAYS_UK: "Royaume-Uni", PAYS_US: "États-Unis", PAYS_RU: "Russie",
    PAYS_JP: "Japon", PAYS_SE: "Scandinavie", PAYS_DE: "Allemagne", PAYS_IT: "Italie",
    PAYS_ES: "Espagne", PAYS_CO: "Colombie", PAYS_CZ: "Rép. tchèque", PAYS_BE: "Belgique",
    LONG_COURT: "Court (<180 p.)", LONG_MOYEN: "Format moyen", LONG_PAVE: "Pavé (500+ p.)",
    ED_ANNOTE: "Édition annotée", ED_COLLECTOR: "Collector", ED_BILINGUE: "Bilingue", ED_VO: "Version originale",
    POLAR_NORDIQUE: "Polar nordique", CLASSIQUE_POCHE: "Classique en poche", EDITION_SOIGNEE: "Édition soignée"
  };
  function eraLabel(a) {
    var m = a.match(/^ERA_(\d+)S$/);
    if (m) { var c = Math.floor(parseInt(m[1], 10) / 100) + 1; return c + "ᵉ siècle"; }
    m = a.match(/^ERA_(\d{4})$/);
    return m ? "années " + m[1].slice(2) : a;
  }
  var LIVRES_LEVEL1 = [
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
  var LIVRES_LEVEL2 = [
    [/GENRE_POLAR.*PAYS_SE|PAYS_SE.*GENRE_POLAR/, "POLAR_NORDIQUE"],
    [/GENRE_CLASSIQUE.*FORMAT_PO|FORMAT_PO.*GENRE_CLASSIQUE/, "CLASSIQUE_POCHE"],
    [/ED_(?:COLLECTOR|ANNOTE)|FORMAT_IL/, "EDITION_SOIGNEE"]
  ];
  var LIVRES_SYN_GROUPS = [["polar", "policier", "thriller"], ["poche", "pocket"], ["bd", "manga"], ["sf", "anticipation"]];

  var LIVRES_SEED = [
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
  var LIVRES_FIELD_W = { ref: 4, name: 3, desc: 1 };
  var LIVRES_ANN_W = 5;
  var LIVRES_FMT_LABEL = { PO: "Poche", BR: "Broché", GF: "Grand format", IL: "Illustré", AU: "Livre audio" };
  var LIVRES_ED_LABEL = { std: "", ann: "édition annotée", col: "collector", bil: "bilingue", vo: "VO", gc: "gros caractères" };

  function livresEraOf(year) {
    if (year >= 1900) return "ERA_" + (Math.floor(year / 10) * 10);
    return "ERA_" + (Math.floor(year / 100) * 100) + "S";
  }
  function livresLengthOf(pages) { return pages < 180 ? "LONG_COURT" : (pages >= 500 ? "LONG_PAVE" : "LONG_MOYEN"); }

  function livresBuildProducts() {
    var products = [], termIndex = {}, annIndex = {}, vocabByLen = {};
    var seq = 1000;
    function addTerm(t, pid, w, isSku) {
      (termIndex[t] = termIndex[t] || {})[pid] = (termIndex[t][pid] || 0) + w;
      if (!isSku) (vocabByLen[t.length] = vocabByLen[t.length] || {})[t] = true;
    }
    var VAR = [
      ["PO", "std", true, 0], ["PO", "ann", false, 2], ["PO", "bil", false, 3], ["PO", "gc", false, 2],
      ["BR", "std", true, 6], ["BR", "ann", false, 8], ["BR", "vo", false, 7],
      ["GF", "std", true, 13], ["GF", "col", true, 24], ["GF", "ann", false, 16],
      ["IL", "std", true, 19], ["IL", "col", true, 32],
      ["AU", "std", false, 9]
    ];
    LIVRES_SEED.forEach(function (row, ai) {
      var author = row[0], pays = row[1], genre = row[2], works = row[3];
      works.forEach(function (w, bi) {
        var title = w[0], year = w[1], pages = w[2];
        var rand = rng(ai * 131 + bi * 17 + 3);
        VAR.forEach(function (v) {
          if (genre === "bd" && !v[2]) return;
          if (v[1] === "vo" && (pays === "FR" || pays === "BE")) return;
          var P = { "PO.std": 16, "PO.ann": 2, "PO.bil": 2, "PO.gc": 2, "BR.std": 9, "BR.ann": 2, "BR.vo": 2,
                    "GF.std": 6, "GF.col": 2, "GF.ann": 2, "IL.std": 3, "IL.col": 2, "AU.std": 4 };
          var presses = P[v[0] + "." + v[1]] || 1;
          for (var pr = 0; pr < presses; pr++) {
            var pid = products.length;
            var fmt = v[0], ed = v[1];
            var edYear = 1995 + Math.floor(rand() * 30);
            var sku = "HRX-" + fmt + "-" + (seq++);
            var descParts = [LIVRES_FMT_LABEL[fmt]];
            if (LIVRES_ED_LABEL[ed]) descParts.push(LIVRES_ED_LABEL[ed]);
            descParts.push(String(edYear), pages + " p.");
            var price = Math.max(3, 8 + v[3] + Math.floor(rand() * 4) + (pages > 700 ? 4 : 0));
            var stock = rand() < 0.07 ? 0 : 1 + Math.floor(rand() * 22);
            var anns = ["FORMAT_" + fmt, "GENRE_" + genre.toUpperCase(), "PAYS_" + pays, livresEraOf(year), livresLengthOf(pages)];
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
            tokenize(sku).forEach(function (t) { addTerm(t, pid, LIVRES_FIELD_W.ref, true); });
            tokenize(author + " " + title).forEach(function (t) { addTerm(t, pid, LIVRES_FIELD_W.name, false); });
            tokenize(p.desc + " " + genre).forEach(function (t) { addTerm(t, pid, LIVRES_FIELD_W.desc, false); });
            anns.forEach(function (a) { (annIndex[a] = annIndex[a] || []).push(pid); });
          }
        });
      });
    });
    return { products: products, termIndex: termIndex, annIndex: annIndex, vocabByLen: vocabByLen, ANN_W: LIVRES_ANN_W };
  }

  /* ---- Couvertures procédurales (jamais de visuel existant, généré) ---- */
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
  function coverArt(p) {
    var h = p.hue;
    var family = FAMILY_BY_GENRE[p.genre] || "warm";
    var W = 100, H = 140;
    var titleLines, authorLast = p.author.split(" ").slice(-1)[0];
    var bg, motif = "", titleColor, titleFamily = "'Plus Jakarta Sans',sans-serif", titleWeight = "700";
    var titleSize = 12, titleY = 46, lineHeight = 14, ls = "0";
    var ruleColor, authorColor;

    if (family === "noir") {
      var accent = "hsl(" + ((h + 15) % 360) + ",68%,52%)";
      bg = '<rect width="' + W + '" height="' + H + '" fill="hsl(' + h + ',22%,13%)"/>' +
           '<rect width="' + W + '" height="' + H + '" fill="hsl(' + ((h+30)%360) + ',30%,9%)" opacity="0.55"/>';
      for (var i = 0; i < 5; i++) motif += '<rect x="0" y="' + (18 + i * 5) + '" width="' + W + '" height="1.3" fill="rgba(255,255,255,0.05)"/>';
      motif += '<rect x="10" y="' + (H - 34) + '" width="26" height="3" fill="' + accent + '"/>';
      titleColor = "#F4F1EA"; titleFamily = "Georgia,'Times New Roman',serif"; titleWeight = "700";
      ruleColor = accent; authorColor = "rgba(244,241,234,0.65)";
    } else if (family === "cosmic") {
      bg = '<rect width="' + W + '" height="' + H + '" fill="hsl(' + h + ',48%,26%)"/>' +
           '<rect width="' + W + '" height="' + H + '" fill="hsl(' + ((h+45)%360) + ',60%,16%)" opacity="0.6"/>';
      var mx = 20 + (p.pat * 12), my = 26 + (p.pat % 3) * 6;
      motif = '<circle cx="' + mx + '" cy="' + my + '" r="16" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>' +
              '<circle cx="' + mx + '" cy="' + my + '" r="2" fill="rgba(255,255,255,0.55)"/>' +
              '<circle cx="' + (W - 18) + '" cy="20" r="1.4" fill="rgba(255,255,255,0.4)"/>' +
              '<circle cx="' + (W - 30) + '" cy="34" r="0.9" fill="rgba(255,255,255,0.3)"/>';
      titleColor = "#FFFFFF"; titleFamily = "'Plus Jakarta Sans',sans-serif"; titleWeight = "700"; ls = "0.3";
      ruleColor = "rgba(255,255,255,0.4)"; authorColor = "rgba(255,255,255,0.62)";
    } else if (family === "classic") {
      bg = '<rect width="' + W + '" height="' + H + '" fill="hsl(38,32%,93%)"/>' +
           '<rect width="' + W + '" height="' + H + '" fill="hsl(' + h + ',25%,88%)" opacity="0.35"/>';
      motif = '<rect x="6" y="6" width="' + (W - 12) + '" height="' + (H - 12) + '" fill="none" stroke="hsl(' + h + ',35%,38%)" stroke-width="1" opacity="0.55"/>' +
              '<rect x="9" y="9" width="' + (W - 18) + '" height="' + (H - 18) + '" fill="none" stroke="hsl(' + h + ',35%,38%)" stroke-width="0.5" opacity="0.4"/>';
      titleColor = "hsl(" + h + ",30%,22%)"; titleFamily = "Georgia,'Times New Roman',serif"; titleWeight = "700";
      ruleColor = "hsl(" + h + ",35%,38%)"; authorColor = "hsl(" + h + ",20%,38%)";
    } else if (family === "bright") {
      bg = '<rect width="' + W + '" height="' + H + '" fill="hsl(' + h + ',72%,58%)"/>' +
           '<rect width="' + W + '" height="' + H + '" fill="hsl(' + ((h+55)%360) + ',70%,50%)" opacity="0.5"/>';
      motif = '<circle cx="' + (W - 24) + '" cy="24" r="18" fill="rgba(255,255,255,0.18)"/>' +
              '<circle cx="14" cy="' + (H - 26) + '" r="12" fill="rgba(255,255,255,0.15)"/>';
      titleColor = "#FFFFFF"; titleFamily = "'Plus Jakarta Sans',sans-serif"; titleWeight = "800";
      ruleColor = "rgba(255,255,255,0.55)"; authorColor = "rgba(255,255,255,0.8)";
    } else {
      bg = '<rect width="' + W + '" height="' + H + '" fill="hsl(' + h + ',42%,40%)"/>' +
           '<rect width="' + W + '" height="' + H + '" fill="hsl(' + ((h+25)%360) + ',48%,26%)" opacity="0.55"/>';
      motif = '<path d="M0 ' + (H-30) + ' Q ' + (W/2) + ' ' + (H-46) + ' ' + W + ' ' + (H-30) + ' L ' + W + ' ' + H + ' L 0 ' + H + ' Z" fill="rgba(255,255,255,0.07)"/>';
      titleColor = "#FBF8F2"; titleFamily = "Georgia,'Times New Roman',serif"; titleWeight = "700";
      ruleColor = "rgba(251,248,242,0.5)"; authorColor = "rgba(251,248,242,0.68)";
    }

    var maxChars = family === "cosmic" || family === "bright" ? 13 : 14;
    titleLines = wrapTitle(p.title, maxChars, 3);
    var titleTspans = titleLines.map(function (line, i) {
      return '<tspan x="10" dy="' + (i === 0 ? 0 : lineHeight) + '">' + esc(line) + "</tspan>";
    }).join("");

    var badge = "";
    if (p.fmt === "AU") badge = '<circle cx="' + (W-16) + '" cy="' + (H-18) + '" r="8" fill="rgba(0,0,0,0.32)"/><path d="M' + (W-19) + ' ' + (H-22) + ' L' + (W-19) + ' ' + (H-14) + ' L' + (W-12) + ' ' + (H-18) + ' Z" fill="#fff"/>';

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="54" height="80" aria-hidden="true">' +
      '<clipPath id="cc' + h + "_" + p.pat + '"><rect width="' + W + '" height="' + H + '" rx="4"/></clipPath>' +
      '<g clip-path="url(#cc' + h + "_" + p.pat + ')">' + bg + motif +
      '<text x="10" y="' + titleY + '" font-family="' + titleFamily + '" font-size="' + titleSize + '" font-weight="' + titleWeight + '" letter-spacing="' + ls + '" fill="' + titleColor + '">' + titleTspans + '</text>' +
      '<line x1="10" y1="' + (H - 16) + '" x2="' + (W - 10) + '" y2="' + (H - 16) + '" stroke="' + ruleColor + '" stroke-width="0.7"/>' +
      '<text x="10" y="' + (H - 8) + '" font-family="\'Plus Jakarta Sans\',sans-serif" font-size="7.5" font-weight="600" letter-spacing="0.4" fill="' + authorColor + '">' + esc(authorLast.toUpperCase()) + "</text>" +
      badge +
      '</g><rect x="0.5" y="0.5" width="' + (W-1) + '" height="' + (H-1) + '" rx="4" fill="none" stroke="rgba(0,0,0,0.16)"/></svg>';
  }

  function livresRenderCard(h) {
    var p = h.p;
    var whyChips = h.why.filter(function (w, i, arr) { return arr.indexOf(w) === i; })
      .slice(0, 3).map(function (w) {
        if (w[0] === "#") return '<span class="play-why play-why-ann">' + esc(shortLabel(w.slice(1), LIVRES_LABELS)) + "</span>";
        return '<span class="play-why">' + esc(w) + "</span>";
      }).join("");
    return '<div class="play-card' + (p.stock === 0 ? " play-card-out" : "") + '">' +
      '<div class="play-thumb">' + coverArt(p) + "</div>" +
      '<div class="play-body"><div class="play-name">' + esc(p.title) + " — " + esc(p.author) + "</div>" +
      '<div class="play-ref mono">' + esc(p.id) + " · " + esc(p.desc) + "</div>" +
      '<div class="play-tags">' + whyChips + "</div></div>" +
      '<div class="play-side"><span class="play-price">' + p.price + " €</span>" +
      '<span class="play-stock">' + (p.stock > 0 ? (p.stock <= 3 ? p.stock + " restants" : "en stock") : "rupture") + "</span></div>" +
      "</div>";
  }

  var LIVRES = {
    key: "livres", emoji: "📚", label: "Édition & Livres",
    LEVEL1: LIVRES_LEVEL1, LEVEL2: LIVRES_LEVEL2, PRISM_LABELS: LIVRES_LABELS,
    SYN_GROUPS: LIVRES_SYN_GROUPS,
    groupOrder: ["GENRE", "FORMAT", "PAYS", "ERA", "LONG"],
    groupLabels: { GENRE: "Genre", FORMAT: "Format", PAYS: "Origine", ERA: "Époque", LONG: "Longueur" },
    samples: [["polar scandinave poche", "polar scandinave poche"], ["dostoievsky pavé", "dostoievsky pavé"], ["jules vern illustré", "jules vern illustré"], ["sf années 50", "sf années 50"]],
    intro: "polar scandinave poch",
    placeholder: "Cherchez dans le catalogue de démo…",
    buildProducts: livresBuildProducts,
    renderCard: livresRenderCard
  };

  /* =====================================================================
     VERTICALE : OUTILLAGE (nouvelle)
     Règles d'annotation calquées sur le vrai pack de règles "outillage"
     du moteur (diamètre, longueur, matière, type de tête, étanchéité) —
     la même logique que celle utilisée en production, pas une simulation
     de façade.
     ===================================================================== */
  var OUTILLAGE_LABELS = {
    FAM_VIS: "Vis", FAM_ECROU: "Écrous", FAM_RONDELLE: "Rondelles", FAM_ROULEMENT: "Roulements",
    DIAM_M4: "M4", DIAM_M5: "M5", DIAM_M6: "M6", DIAM_M8: "M8", DIAM_M10: "M10", DIAM_M12: "M12", DIAM_M14: "M14", DIAM_M16: "M16", DIAM_M20: "M20",
    MAT_INOX: "Inox A2", MAT_ZINGUE: "Acier zingué", MAT_LAITON: "Laiton", MAT_BRUT: "Acier brut",
    TETE_HEX: "Tête hexagonale", TETE_FRAISEE: "Tête fraisée", TETE_CYL: "Tête cylindrique", TETE_TORX: "Tête Torx",
    ETANCHE_2RS: "Étanche (2RS)", ETANCHE_ZZ: "Blindé (ZZ)"
  };
  var OUTILLAGE_LEVEL1 = [
    [/\bm(4|5|6|8|10|12|14|16|20)(?!\d)/g, "DIAM_M$1"],
    [/(?:x|\s)(10|12|16|20|25|30|35|40|50|60|80|100)(?!\d)/g, "LONG_$1"],
    [/\bm(4|5|6|8|10|12|14|16|20)\s?x\s?(10|12|16|20|25|30|35|40|50|60|80|100)\b/g, "VIS_M$1X$2"],
    [/\b(6[0-9]{3})\b/g, "BRG_$1"],
    [/\binox\b|\ba2\b|\ba4\b/g, "MAT_INOX"],
    [/\bzingue\b|\bzinc\b/g, "MAT_ZINGUE"],
    [/\blaiton\b|\bbrass\b/g, "MAT_LAITON"],
    [/\bbrut\b|\bnoir\b/g, "MAT_BRUT"],
    [/\bhexagonale?\b|\bhex\b/g, "TETE_HEX"],
    [/\bfraisee?\b|\bcountersunk\b/g, "TETE_FRAISEE"],
    [/\bcylindrique\b|\bcyl\b/g, "TETE_CYL"],
    [/\btorx\b/g, "TETE_TORX"],
    [/\b2rs\b/g, "ETANCHE_2RS"],
    [/\bzz\b/g, "ETANCHE_ZZ"],
    [/\bvis\b|\bscrews?\b/g, "FAM_VIS"],
    [/\becrous?\b|\bnuts?\b/g, "FAM_ECROU"],
    [/\brondelles?\b|\bwashers?\b/g, "FAM_RONDELLE"],
    [/\broulements?\b|\bbearings?\b/g, "FAM_ROULEMENT"]
  ];
  var OUTILLAGE_LEVEL2 = [];
  var OUTILLAGE_SYN_GROUPS = [["vis", "boulon"], ["ecrou", "nut"], ["inox", "acier inoxydable"]];

  var OUTILLAGE_TETES = [["hex", "Tête hexagonale"], ["fraisee", "Tête fraisée"], ["cyl", "Tête cylindrique"], ["torx", "Tête Torx"]];
  var OUTILLAGE_MATIERES = [["inox", "Inox A2"], ["zingue", "Acier zingué"], ["laiton", "Laiton"], ["brut", "Acier brut"]];
  var OUTILLAGE_DIAMS = [4, 5, 6, 8, 10, 12, 14, 16];
  var OUTILLAGE_LONGS = [10, 12, 16, 20, 25, 30, 35, 40, 50, 60, 80];
  var OUTILLAGE_BEARINGS = [6000, 6001, 6002, 6003, 6004, 6005, 6200, 6201, 6202, 6203, 6204, 6205, 6206, 6300, 6301, 6302, 6303, 6304];

  function outillageBuildProducts() {
    var products = [], termIndex = {}, annIndex = {}, vocabByLen = {};
    var seq = 2000;
    function addTerm(t, pid, w, isSku) {
      (termIndex[t] = termIndex[t] || {})[pid] = (termIndex[t][pid] || 0) + w;
      if (!isSku) (vocabByLen[t.length] = vocabByLen[t.length] || {})[t] = true;
    }
    function push(p, refText, nameText) {
      var pid = products.length;
      products.push(p);
      tokenize(p.id).forEach(function (t) { addTerm(t, pid, LIVRES_FIELD_W.ref, true); });
      tokenize(refText).forEach(function (t) { addTerm(t, pid, LIVRES_FIELD_W.ref, false); });
      tokenize(nameText).forEach(function (t) { addTerm(t, pid, LIVRES_FIELD_W.name, false); });
      p.anns.forEach(function (a) { (annIndex[a] = annIndex[a] || []).push(pid); });
    }

    OUTILLAGE_DIAMS.forEach(function (d, di) {
      OUTILLAGE_LONGS.forEach(function (l, li) {
        if (l < d * 1.2) return;
        OUTILLAGE_TETES.forEach(function (tete, ti) {
          OUTILLAGE_MATIERES.forEach(function (mat, mi) {
            var rand = rng(di * 97 + li * 13 + ti * 7 + mi * 3 + 11);
            if (rand() > 0.55) return;
            var id = "HRX-VS-" + (seq++);
            var ref = "M" + d + " x " + l + " - " + mat[1];
            var name = "Vis à métaux " + tete[1].toLowerCase();
            var anns = ["DIAM_M" + d, "LONG_" + l, "VIS_M" + d + "X" + l, "MAT_" + mat[0].toUpperCase(), "TETE_" + tete[0].toUpperCase(), "FAM_VIS"];
            var price = Math.round((0.08 + d * 0.015 + l * 0.004) * 100) / 100;
            var stock = rand() < 0.05 ? 0 : Math.floor(rand() * 400) + 20;
            var p = { id: id, ref: ref, name: name, desc: ref, anns: anns, price: price, stock: stock, family: "vis", diam: d };
            push(p, ref, name);
          });
        });
      });
    });

    OUTILLAGE_DIAMS.forEach(function (d) {
      OUTILLAGE_MATIERES.forEach(function (mat, mi) {
        var rand = rng(d * 53 + mi * 19 + 7);
        var id = "HRX-EC-" + (seq++);
        var ref = "M" + d + " - " + mat[1];
        var name = "Écrou hexagonal";
        var anns = ["DIAM_M" + d, "MAT_" + mat[0].toUpperCase(), "FAM_ECROU"];
        var price = Math.round((0.04 + d * 0.008) * 100) / 100;
        var stock = rand() < 0.04 ? 0 : Math.floor(rand() * 600) + 50;
        push({ id: id, ref: ref, name: name, desc: ref, anns: anns, price: price, stock: stock, family: "ecrou", diam: d }, ref, name);
      });
    });

    OUTILLAGE_DIAMS.forEach(function (d) {
      OUTILLAGE_MATIERES.forEach(function (mat, mi) {
        var rand = rng(d * 71 + mi * 23 + 13);
        var id = "HRX-RD-" + (seq++);
        var ref = "M" + d + " - " + mat[1];
        var name = "Rondelle plate";
        var anns = ["DIAM_M" + d, "MAT_" + mat[0].toUpperCase(), "FAM_RONDELLE"];
        var price = Math.round((0.02 + d * 0.003) * 100) / 100;
        var stock = rand() < 0.04 ? 0 : Math.floor(rand() * 800) + 100;
        push({ id: id, ref: ref, name: name, desc: ref, anns: anns, price: price, stock: stock, family: "rondelle", diam: d }, ref, name);
      });
    });

    OUTILLAGE_BEARINGS.forEach(function (b) {
      [["", ""], ["-2RS", "Étanche"], ["-ZZ", "Blindé"]].forEach(function (variant, vi) {
        var rand = rng(b + vi * 71 + 5);
        var id = "HRX-RL-" + (seq++);
        var ref = b + variant[0];
        var name = "Roulement à billes" + (variant[1] ? " " + variant[1].toLowerCase() : "");
        var anns = ["BRG_" + b, "FAM_ROULEMENT"];
        if (variant[0] === "-2RS") anns.push("ETANCHE_2RS");
        if (variant[0] === "-ZZ") anns.push("ETANCHE_ZZ");
        var price = Math.round((1.8 + (b % 400) * 0.02) * 100) / 100;
        var stock = rand() < 0.1 ? 0 : Math.floor(rand() * 60) + 3;
        push({ id: id, ref: ref, name: name, desc: ref, anns: anns, price: price, stock: stock, family: "roulement", diam: null }, ref, name);
      });
    });

    return { products: products, termIndex: termIndex, annIndex: annIndex, vocabByLen: vocabByLen, ANN_W: 5 };
  }

  var FAMILY_ICON = {
    vis: '<path d="M32 8 L32 30 M24 16 L40 16 M27 20 L37 20 M27 24 L37 24" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M22 30 L42 30 L37 56 L27 56 Z" fill="#fff" opacity="0.92"/>',
    ecrou: '<path d="M32 10 L48 19 L48 37 L32 46 L16 37 L16 19 Z" fill="none" stroke="#fff" stroke-width="3.4"/><circle cx="32" cy="28" r="8" fill="none" stroke="#fff" stroke-width="3"/>',
    rondelle: '<circle cx="32" cy="28" r="17" fill="none" stroke="#fff" stroke-width="4.2"/><circle cx="32" cy="28" r="7" fill="none" stroke="#fff" stroke-width="3"/>',
    roulement: '<circle cx="32" cy="28" r="18" fill="none" stroke="#fff" stroke-width="3.6"/><circle cx="32" cy="28" r="9" fill="none" stroke="#fff" stroke-width="3"/>' +
      [0, 60, 120, 180, 240, 300].map(function (a) {
        var r = 13.5, x = 32 + r * Math.cos(a * Math.PI / 180), y = 28 + r * Math.sin(a * Math.PI / 180);
        return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.4" fill="#fff"/>';
      }).join("")
  };
  function outillageThumb(p) {
    var hue = { vis: 228, ecrou: 234, rondelle: 220, roulement: 226 }[p.family] || 228;
    return '<svg viewBox="0 0 64 64" width="54" height="80" aria-hidden="true">' +
      '<rect width="64" height="64" rx="8" fill="hsl(' + hue + ',72%,64%)"/>' +
      '<rect width="64" height="64" rx="8" fill="hsl(' + (hue + 20) + ',60%,48%)" opacity="0.35"/>' +
      (FAMILY_ICON[p.family] || FAMILY_ICON.vis) +
      '</svg>';
  }
  function outillageRenderCard(h) {
    var p = h.p;
    var whyChips = h.why.filter(function (w, i, arr) { return arr.indexOf(w) === i; })
      .slice(0, 3).map(function (w) {
        if (w[0] === "#") return '<span class="play-why play-why-ann">' + esc(shortLabel(w.slice(1), OUTILLAGE_LABELS)) + "</span>";
        return '<span class="play-why">' + esc(w) + "</span>";
      }).join("");
    return '<div class="play-card' + (p.stock === 0 ? " play-card-out" : "") + '">' +
      '<div class="play-thumb play-thumb-icon">' + outillageThumb(p) + "</div>" +
      '<div class="play-body"><div class="play-name">' + esc(p.name) + "</div>" +
      '<div class="play-ref mono">' + esc(p.id) + " · " + esc(p.ref) + "</div>" +
      '<div class="play-tags">' + whyChips + "</div></div>" +
      '<div class="play-side"><span class="play-price">' + p.price.toFixed(2).replace(".", ",") + " €</span>" +
      '<span class="play-stock">' + (p.stock > 0 ? (p.stock <= 3 ? p.stock + " restants" : "en stock") : "rupture") + "</span></div>" +
      "</div>";
  }

  var OUTILLAGE = {
    key: "outillage", emoji: "🛠️", label: "Bricolage & Outillage",
    LEVEL1: OUTILLAGE_LEVEL1, LEVEL2: OUTILLAGE_LEVEL2, PRISM_LABELS: OUTILLAGE_LABELS,
    SYN_GROUPS: OUTILLAGE_SYN_GROUPS,
    groupOrder: ["FAM", "DIAM", "MAT", "TETE"],
    groupLabels: { FAM: "Famille", DIAM: "Diamètre", MAT: "Matière", TETE: "Tête" },
    samples: [["vis m8x20 inox", "vs m8x20 inox"], ["écrou m10 zingué", "ecrou m10 zingue"], ["roulement 6205 2rs", "roulement 6205 2rs"], ["vis torx m6", "vis torx m6"]],
    intro: "vis m8x2",
    placeholder: "Cherchez une référence (ex. M8x20)…",
    buildProducts: outillageBuildProducts,
    renderCard: outillageRenderCard
  };


  /* =====================================================================
     VERTICALE : HIGH-TECH & ÉLECTRONIQUE (nouvelle)
     ===================================================================== */
  var HIGHTECH_LABELS = {
    FAM_CASQUE: "Casques", FAM_ECOUTEUR: "Écouteurs", FAM_CHARGEUR: "Chargeurs", FAM_CABLE: "Câbles", FAM_ENCEINTE: "Enceintes",
    CONN_BT: "Bluetooth", CONN_FILAIRE: "Filaire", CONN_USBC: "USB-C",
    ANC_OUI: "Réduction de bruit",
    COUL_NOIR: "Noir", COUL_BLANC: "Blanc", COUL_BLEU: "Bleu", COUL_ROSE: "Rose",
    PUISSANCE_18W: "18W", PUISSANCE_20W: "20W", PUISSANCE_30W: "30W", PUISSANCE_45W: "45W", PUISSANCE_65W: "65W", PUISSANCE_100W: "100W",
    AUTONOMIE_6H: "6h", AUTONOMIE_10H: "10h", AUTONOMIE_20H: "20h", AUTONOMIE_30H: "30h",
    LONG_1M: "1m", LONG_2M: "2m", LONG_3M: "3m"
  };
  var HIGHTECH_LEVEL1 = [
    [/\bbluetooth\b|\bbt\b|\bsans.?fil\b|\bwireless\b/g, "CONN_BT"],
    [/\bfilaire\b|\bwired\b|\bjack\b/g, "CONN_FILAIRE"],
    [/\busb.?c\b|\btype.?c\b/g, "CONN_USBC"],
    [/\breduction\s?de\s?bruit\b|\banc\b|\bnoise.?cancel/g, "ANC_OUI"],
    [/\b(18|20|30|45|65|100)\s?w\b/g, "PUISSANCE_$1W"],
    [/\b(6|10|20|30)\s?h(?:eures?)?\b/g, "AUTONOMIE_$1H"],
    [/\b(1|2|3)\s?m(?:etres?)?\b(?!ah)/g, "LONG_$1M"],
    [/\bnoir\b|\bblack\b/g, "COUL_NOIR"],
    [/\bblanc\b|\bwhite\b/g, "COUL_BLANC"],
    [/\bbleu\b|\bblue\b/g, "COUL_BLEU"],
    [/\brose\b|\bpink\b/g, "COUL_ROSE"],
    [/\bcasques?\b|\bheadphones?\b/g, "FAM_CASQUE"],
    [/\becouteurs?\b|\bearbuds?\b/g, "FAM_ECOUTEUR"],
    [/\bchargeurs?\b|\bchargers?\b/g, "FAM_CHARGEUR"],
    [/\bcables?\b|\bcords?\b/g, "FAM_CABLE"],
    [/\benceintes?\b|\bspeakers?\b/g, "FAM_ENCEINTE"]
  ];
  var HIGHTECH_LEVEL2 = [];
  var HIGHTECH_SYN_GROUPS = [["casque", "headphone"], ["ecouteurs", "earbuds"], ["bluetooth", "sans fil"]];
  var HIGHTECH_COULEURS = [["noir", "Noir"], ["blanc", "Blanc"], ["bleu", "Bleu"], ["rose", "Rose"]];

  function hightechBuildProducts() {
    var products = [], termIndex = {}, annIndex = {}, vocabByLen = {};
    var seq = 3000;
    function addTerm(t, pid, w, isSku) {
      (termIndex[t] = termIndex[t] || {})[pid] = (termIndex[t][pid] || 0) + w;
      if (!isSku) (vocabByLen[t.length] = vocabByLen[t.length] || {})[t] = true;
    }
    function push(p, refText, nameText) {
      var pid = products.length;
      products.push(p);
      tokenize(p.id).forEach(function (t) { addTerm(t, pid, LIVRES_FIELD_W.ref, true); });
      tokenize(refText).forEach(function (t) { addTerm(t, pid, LIVRES_FIELD_W.ref, false); });
      tokenize(nameText).forEach(function (t) { addTerm(t, pid, LIVRES_FIELD_W.name, false); });
      p.anns.forEach(function (a) { (annIndex[a] = annIndex[a] || []).push(pid); });
    }

    // Casques + ecouteurs (bluetooth/filaire x ANC x couleur x autonomie)
    [["casque", "Casque audio", "FAM_CASQUE"], ["ecouteur", "Écouteurs", "FAM_ECOUTEUR"]].forEach(function (fam) {
      [true, false].forEach(function (bt) {
        [true, false].forEach(function (anc) {
          HIGHTECH_COULEURS.forEach(function (coul, ci) {
            [6, 10, 20, 30].forEach(function (auto, ai) {
              var rand = rng(ci * 13 + ai * 7 + (bt ? 1 : 0) * 3 + (anc ? 1 : 0) * 5 + 11 + fam[2].length);
              if (rand() > 0.5) return;
              var ref = (bt ? "Bluetooth" : "Filaire") + (anc ? " ANC" : "") + " - " + coul[1] + " - " + auto + "h autonomie";
              var anns = [bt ? "CONN_BT" : "CONN_FILAIRE", fam[2], "COUL_" + coul[0].toUpperCase(), "AUTONOMIE_" + auto + "H"];
              if (anc) anns.push("ANC_OUI");
              var price = Math.round((15 + rand() * 80) * 100) / 100;
              var p = { id: "HRX-" + (seq++), ref: ref, name: fam[1], desc: ref, anns: anns, price: price, stock: Math.floor(rand() * 100), family: fam[0] };
              push(p, ref, fam[1]);
            });
          });
        });
      });
    });

    // Chargeurs (puissance x connecteur x couleur)
    [18, 20, 30, 45, 65, 100].forEach(function (w, wi) {
      HIGHTECH_COULEURS.forEach(function (coul, ci) {
        var rand = rng(wi * 17 + ci * 11 + 23);
        if (rand() > 0.6) return;
        var ref = w + "W - USB-C - " + coul[1];
        var anns = ["PUISSANCE_" + w + "W", "CONN_USBC", "COUL_" + coul[0].toUpperCase(), "FAM_CHARGEUR"];
        var price = Math.round((8 + w * 0.35 + rand() * 8) * 100) / 100;
        push({ id: "HRX-" + (seq++), ref: ref, name: "Chargeur secteur", desc: ref, anns: anns, price: price, stock: Math.floor(rand() * 150) + 10, family: "chargeur" }, ref, "Chargeur secteur");
      });
    });

    // Cables (longueur x connecteur x couleur)
    [1, 2, 3].forEach(function (len, li) {
      HIGHTECH_COULEURS.forEach(function (coul, ci) {
        var rand = rng(li * 19 + ci * 7 + 31);
        if (rand() > 0.65) return;
        var ref = "USB-C - " + len + "m - " + coul[1];
        var anns = ["CONN_USBC", "LONG_" + len + "M", "COUL_" + coul[0].toUpperCase(), "FAM_CABLE"];
        var price = Math.round((4 + len * 2 + rand() * 4) * 100) / 100;
        push({ id: "HRX-" + (seq++), ref: ref, name: "Câble de charge", desc: ref, anns: anns, price: price, stock: Math.floor(rand() * 300) + 20, family: "cable" }, ref, "Câble de charge");
      });
    });

    // Enceintes (bluetooth x autonomie x couleur)
    HIGHTECH_COULEURS.forEach(function (coul, ci) {
      [6, 10, 20, 30].forEach(function (auto, ai) {
        var rand = rng(ci * 29 + ai * 13 + 41);
        if (rand() > 0.55) return;
        var ref = "Bluetooth - " + coul[1] + " - " + auto + "h autonomie";
        var anns = ["CONN_BT", "COUL_" + coul[0].toUpperCase(), "AUTONOMIE_" + auto + "H", "FAM_ENCEINTE"];
        var price = Math.round((25 + rand() * 90) * 100) / 100;
        push({ id: "HRX-" + (seq++), ref: ref, name: "Enceinte portable", desc: ref, anns: anns, price: price, stock: Math.floor(rand() * 60) + 5, family: "enceinte" }, ref, "Enceinte portable");
      });
    });

    return { products: products, termIndex: termIndex, annIndex: annIndex, vocabByLen: vocabByLen, ANN_W: 5 };
  }

  var HIGHTECH_ICON = {
    casque: '<path d="M18 34a14 14 0 0128 0v14" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><rect x="12" y="32" width="9" height="16" rx="4" fill="#fff"/><rect x="43" y="32" width="9" height="16" rx="4" fill="#fff"/>',
    ecouteur: '<circle cx="24" cy="26" r="8" fill="#fff"/><circle cx="42" cy="30" r="8" fill="#fff"/><path d="M24 34v6a4 4 0 004 4" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    chargeur: '<rect x="20" y="14" width="24" height="36" rx="5" fill="#fff"/><rect x="27" y="21" width="10" height="7" rx="1.5" fill="hsl(228,60%,55%)"/><line x1="32" y1="34" x2="32" y2="42" stroke="hsl(228,60%,55%)" stroke-width="3" stroke-linecap="round"/>',
    cable: '<path d="M14 20 Q32 14 32 32 Q32 50 50 44" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/><rect x="9" y="15" width="10" height="10" rx="2.5" fill="#fff"/><rect x="45" y="39" width="10" height="10" rx="2.5" fill="#fff"/>',
    enceinte: '<rect x="18" y="10" width="28" height="44" rx="7" fill="#fff"/><circle cx="32" cy="24" r="6" fill="hsl(228,60%,55%)"/><circle cx="32" cy="42" r="9" fill="hsl(228,60%,55%)"/>'
  };
  function hightechThumb(p) {
    var hue = 228;
    return '<svg viewBox="0 0 64 64" width="54" height="80" aria-hidden="true">' +
      '<rect width="64" height="64" rx="8" fill="hsl(' + hue + ',70%,60%)"/>' +
      '<rect width="64" height="64" rx="8" fill="hsl(' + (hue + 25) + ',60%,45%)" opacity="0.35"/>' +
      (HIGHTECH_ICON[p.family] || HIGHTECH_ICON.casque) +
      '</svg>';
  }
  function hightechRenderCard(h) {
    var p = h.p;
    var whyChips = h.why.filter(function (w, i, arr) { return arr.indexOf(w) === i; })
      .slice(0, 3).map(function (w) {
        if (w[0] === "#") return '<span class="play-why play-why-ann">' + esc(shortLabel(w.slice(1), HIGHTECH_LABELS)) + "</span>";
        return '<span class="play-why">' + esc(w) + "</span>";
      }).join("");
    return '<div class="play-card' + (p.stock === 0 ? " play-card-out" : "") + '">' +
      '<div class="play-thumb play-thumb-icon">' + hightechThumb(p) + "</div>" +
      '<div class="play-body"><div class="play-name">' + esc(p.name) + "</div>" +
      '<div class="play-ref mono">' + esc(p.id) + " · " + esc(p.ref) + "</div>" +
      '<div class="play-tags">' + whyChips + "</div></div>" +
      '<div class="play-side"><span class="play-price">' + p.price.toFixed(2).replace(".", ",") + " €</span>" +
      '<span class="play-stock">' + (p.stock > 0 ? (p.stock <= 3 ? p.stock + " restants" : "en stock") : "rupture") + "</span></div>" +
      "</div>";
  }

  var HIGHTECH = {
    key: "hightech", emoji: "💻", label: "High-Tech & Électronique",
    LEVEL1: HIGHTECH_LEVEL1, LEVEL2: HIGHTECH_LEVEL2, PRISM_LABELS: HIGHTECH_LABELS,
    SYN_GROUPS: HIGHTECH_SYN_GROUPS,
    groupOrder: ["FAM", "CONN", "COUL", "AUTONOMIE"],
    groupLabels: { FAM: "Famille", CONN: "Connectivité", COUL: "Couleur", AUTONOMIE: "Autonomie" },
    samples: [["casque bluetooth réducteur de bruit", "casque bluetooth reduction de bruit"], ["chargeur 65w usb-c", "chargeur 65w usb-c"], ["écouteurs sans fil blanc", "ecouteurs sans fil blanc"], ["enceinte bluetooth 20h", "enceinte bluetooth 20h"]],
    intro: "casque bluetooth redu",
    placeholder: "Cherchez un produit (ex. casque bluetooth)…",
    buildProducts: hightechBuildProducts,
    renderCard: hightechRenderCard
  };

  /* =====================================================================
     VERTICALE : MODE & PRÊT-À-PORTER (nouvelle)
     ===================================================================== */
  var MODE_LABELS = {
    FAM_TSHIRT: "T-shirts", FAM_PULL: "Pulls", FAM_JEAN: "Jeans", FAM_ROBE: "Robes", FAM_VESTE: "Vestes",
    TAILLE_XS: "XS", TAILLE_S: "S", TAILLE_M: "M", TAILLE_L: "L", TAILLE_XL: "XL", TAILLE_XXL: "XXL",
    MAT_COTON: "Coton", MAT_LAINE: "Laine", MAT_SOIE: "Soie", MAT_LIN: "Lin",
    COUPE_SLIM: "Slim", COUPE_REGULAR: "Regular", COUPE_OVERSIZE: "Oversize",
    SAISON_ETE: "Été", SAISON_HIVER: "Hiver", MOTIF_FLEURI: "Fleuri",
    COUL_NOIR: "Noir", COUL_BLANC: "Blanc", COUL_BLEU: "Bleu", COUL_ROSE: "Rose"
  };
  var MODE_LEVEL1 = [
    [/\bw(28|29|30|31|32|33|34|36)\b/g, "TAILW_$1"],
    [/\bl(28|30|32|34)\b/g, "TAILL_$1"],
    [/\b(xs|s|m|l|xl|xxl)\b/g, "TAILLE_$1"],
    [/\bcoton\b|\bcotton\b/g, "MAT_COTON"],
    [/\blaine\b|\bwool\b/g, "MAT_LAINE"],
    [/\bsoie\b|\bsilk\b/g, "MAT_SOIE"],
    [/\blin\b|\blinen\b/g, "MAT_LIN"],
    [/\bslim\b/g, "COUPE_SLIM"],
    [/\bregular\b|\bdroit\b/g, "COUPE_REGULAR"],
    [/\boversize\b|\bample\b/g, "COUPE_OVERSIZE"],
    [/\bete\b|\bsummer\b/g, "SAISON_ETE"],
    [/\bhiver\b|\bwinter\b/g, "SAISON_HIVER"],
    [/\bfleurie?s?\b|\bfloral\b/g, "MOTIF_FLEURI"],
    [/\bnoir\b|\bblack\b/g, "COUL_NOIR"],
    [/\bblanc\b|\bwhite\b/g, "COUL_BLANC"],
    [/\bbleu\b|\bblue\b/g, "COUL_BLEU"],
    [/\brose\b|\bpink\b/g, "COUL_ROSE"],
    [/\bt.?shirts?\b/g, "FAM_TSHIRT"],
    [/\bpulls?\b|\bsweaters?\b/g, "FAM_PULL"],
    [/\bjeans?\b/g, "FAM_JEAN"],
    [/\brobes?\b|\bdress(?:es)?\b/g, "FAM_ROBE"],
    [/\bvestes?\b|\bjackets?\b/g, "FAM_VESTE"]
  ];
  var MODE_LEVEL2 = [];
  var MODE_SYN_GROUPS = [["pull", "sweater"], ["jean", "denim"]];
  var MODE_COULEURS = [["noir", "Noir"], ["blanc", "Blanc"], ["bleu", "Bleu"], ["rose", "Rose"]];
  var MODE_TAILLES = ["XS", "S", "M", "L", "XL", "XXL"];

  function modeBuildProducts() {
    var products = [], termIndex = {}, annIndex = {}, vocabByLen = {};
    var seq = 4000;
    function addTerm(t, pid, w, isSku) {
      (termIndex[t] = termIndex[t] || {})[pid] = (termIndex[t][pid] || 0) + w;
      if (!isSku) (vocabByLen[t.length] = vocabByLen[t.length] || {})[t] = true;
    }
    function push(p, refText, nameText) {
      var pid = products.length;
      products.push(p);
      tokenize(p.id).forEach(function (t) { addTerm(t, pid, LIVRES_FIELD_W.ref, true); });
      tokenize(refText).forEach(function (t) { addTerm(t, pid, LIVRES_FIELD_W.ref, false); });
      tokenize(nameText).forEach(function (t) { addTerm(t, pid, LIVRES_FIELD_W.name, false); });
      p.anns.forEach(function (a) { (annIndex[a] = annIndex[a] || []).push(pid); });
    }

    // T-shirts, pulls (taille x matiere x coupe x couleur)
    [["tshirt", "T-shirt", "FAM_TSHIRT", ["MAT_COTON", "MAT_LIN"]], ["pull", "Pull", "FAM_PULL", ["MAT_LAINE", "MAT_COTON"]]].forEach(function (fam) {
      MODE_TAILLES.forEach(function (taille, ti) {
        fam[3].forEach(function (matAnn, mi) {
          var matLabel = { MAT_COTON: "Coton", MAT_LIN: "Lin", MAT_LAINE: "Laine" }[matAnn];
          [["regular", "COUPE_REGULAR"], ["oversize", "COUPE_OVERSIZE"]].forEach(function (coupe, coi) {
            MODE_COULEURS.forEach(function (coul, ci) {
              var rand = rng(ti * 17 + mi * 23 + ci * 11 + coi * 37 + fam[2].length);
              if (rand() > 0.45) return;
              var ref = "Taille " + taille + " - " + matLabel + " - " + coupe[0] + " - " + coul[1];
              var anns = ["TAILLE_" + taille, matAnn, coupe[1], "COUL_" + coul[0].toUpperCase(), fam[2]];
              var price = Math.round((12 + rand() * 45) * 100) / 100;
              push({ id: "HRX-" + (seq++), ref: ref, name: fam[1], desc: ref, anns: anns, price: price, stock: Math.floor(rand() * 200) + 10, family: fam[0] }, ref, fam[1]);
            });
          });
        });
      });
    });

    // Jeans (taille W x L x coupe)
    [28, 29, 30, 31, 32, 33, 34, 36].forEach(function (w, wi) {
      [30, 32, 34].forEach(function (l, li) {
        [["slim", "COUPE_SLIM"], ["regular", "COUPE_REGULAR"]].forEach(function (coupe, ci) {
          var rand = rng(wi * 13 + li * 19 + ci * 7 + 51);
          if (rand() > 0.85) return;
          var ref = "W" + w + " L" + l + " - " + coupe[0];
          var anns = ["TAILW_" + w, "TAILL_" + l, coupe[1], "FAM_JEAN", "MAT_COTON"];
          var price = Math.round((35 + rand() * 50) * 100) / 100;
          push({ id: "HRX-" + (seq++), ref: ref, name: "Jean", desc: ref, anns: anns, price: price, stock: Math.floor(rand() * 80) + 5, family: "jean" }, ref, "Jean");
        });
      });
    });

    // Robes (taille x matiere x motif/saison)
    MODE_TAILLES.forEach(function (taille, ti) {
      [["MAT_SOIE", "Soie", "SAISON_ETE"], ["MAT_COTON", "Coton", "SAISON_ETE"], ["MAT_LAINE", "Laine", "SAISON_HIVER"]].forEach(function (matSet, mi) {
        [true, false].forEach(function (fleuri) {
          var rand = rng(ti * 11 + mi * 29 + (fleuri ? 1 : 0) * 7 + 61);
          if (rand() > 0.4) return;
          var ref = "Taille " + taille + " - " + matSet[1] + (fleuri ? " fleurie" : "");
          var anns = ["TAILLE_" + taille, matSet[0], matSet[2], "FAM_ROBE"];
          if (fleuri) anns.push("MOTIF_FLEURI");
          var price = Math.round((30 + rand() * 90) * 100) / 100;
          push({ id: "HRX-" + (seq++), ref: ref, name: "Robe" + (fleuri ? " fleurie" : ""), desc: ref, anns: anns, price: price, stock: Math.floor(rand() * 60) + 3, family: "robe" }, ref, "Robe");
        });
      });
    });

    // Vestes (taille x saison x couleur)
    MODE_TAILLES.forEach(function (taille, ti) {
      [["SAISON_ETE", "légère"], ["SAISON_HIVER", "chaude"]].forEach(function (saison, si) {
        MODE_COULEURS.forEach(function (coul, ci) {
          var rand = rng(ti * 7 + si * 31 + ci * 13 + 71);
          if (rand() > 0.45) return;
          var ref = "Taille " + taille + " - " + coul[1] + " - " + saison[1];
          var anns = ["TAILLE_" + taille, saison[0], "COUL_" + coul[0].toUpperCase(), "FAM_VESTE"];
          var price = Math.round((45 + rand() * 90) * 100) / 100;
          push({ id: "HRX-" + (seq++), ref: ref, name: "Veste " + saison[1], desc: ref, anns: anns, price: price, stock: Math.floor(rand() * 50) + 3, family: "veste" }, ref, "Veste " + saison[1]);
        });
      });
    });

    return { products: products, termIndex: termIndex, annIndex: annIndex, vocabByLen: vocabByLen, ANN_W: 5 };
  }

  var MODE_ICON = {
    tshirt: '<path d="M20 16 L14 24 L20 30 V54 H44 V30 L50 24 L44 16 Q32 22 20 16 Z" fill="#fff"/>',
    pull: '<path d="M18 18 L14 26 L20 30 V54 H44 V30 L50 26 L46 18 Q32 26 18 18 Z" fill="#fff"/>',
    jean: '<path d="M22 10 H42 L44 54 H33 L32 30 L31 54 H20 Z" fill="#fff"/>',
    robe: '<path d="M26 10 H38 L40 22 L48 54 H16 L24 22 Z" fill="#fff"/>',
    veste: '<path d="M18 18 L12 26 L18 32 V54 H46 V32 L52 26 L46 18 Q32 24 18 18 Z" fill="#fff"/><line x1="32" y1="26" x2="32" y2="54" stroke="hsl(228,60%,55%)" stroke-width="2"/>'
  };
  function modeThumb(p) {
    var hue = { tshirt: 210, pull: 224, jean: 220, robe: 234, veste: 216 }[p.family] || 224;
    return '<svg viewBox="0 0 64 64" width="54" height="80" aria-hidden="true">' +
      '<rect width="64" height="64" rx="8" fill="hsl(' + hue + ',68%,62%)"/>' +
      '<rect width="64" height="64" rx="8" fill="hsl(' + (hue + 20) + ',58%,46%)" opacity="0.35"/>' +
      (MODE_ICON[p.family] || MODE_ICON.tshirt) +
      '</svg>';
  }
  function modeRenderCard(h) {
    var p = h.p;
    var whyChips = h.why.filter(function (w, i, arr) { return arr.indexOf(w) === i; })
      .slice(0, 3).map(function (w) {
        if (w[0] === "#") return '<span class="play-why play-why-ann">' + esc(shortLabel(w.slice(1), MODE_LABELS)) + "</span>";
        return '<span class="play-why">' + esc(w) + "</span>";
      }).join("");
    return '<div class="play-card' + (p.stock === 0 ? " play-card-out" : "") + '">' +
      '<div class="play-thumb play-thumb-icon">' + modeThumb(p) + "</div>" +
      '<div class="play-body"><div class="play-name">' + esc(p.name) + "</div>" +
      '<div class="play-ref mono">' + esc(p.id) + " · " + esc(p.ref) + "</div>" +
      '<div class="play-tags">' + whyChips + "</div></div>" +
      '<div class="play-side"><span class="play-price">' + p.price.toFixed(2).replace(".", ",") + " €</span>" +
      '<span class="play-stock">' + (p.stock > 0 ? (p.stock <= 3 ? p.stock + " restants" : "en stock") : "rupture") + "</span></div>" +
      "</div>";
  }

  var MODE = {
    key: "mode", emoji: "👗", label: "Mode & Prêt-à-porter",
    LEVEL1: MODE_LEVEL1, LEVEL2: MODE_LEVEL2, PRISM_LABELS: MODE_LABELS,
    SYN_GROUPS: MODE_SYN_GROUPS,
    groupOrder: ["FAM", "TAILLE", "MAT", "COUPE"],
    groupLabels: { FAM: "Famille", TAILLE: "Taille", MAT: "Matière", COUPE: "Coupe" },
    samples: [["robe fleurie soie été", "robe fleurie soie ete"], ["jean w32 l34 slim", "jean w32 l34 slim"], ["pull laine oversize", "pull laine oversize"], ["veste hiver noire", "veste hiver noir"]],
    intro: "robe fleurie soie",
    placeholder: "Cherchez un vêtement (ex. robe fleurie)…",
    buildProducts: modeBuildProducts,
    renderCard: modeRenderCard
  };

  /* =====================================================================
     Moteur générique — commun aux deux verticales, paramétré par `active`
     ===================================================================== */
  var VERTICALS = { livres: LIVRES, outillage: OUTILLAGE, hightech: HIGHTECH, mode: MODE };
  var active = LIVRES;
  var products, termIndex, annIndex, vocabByLen, ANN_W;
  var SYN = {};

  function loadVertical(key) {
    active = VERTICALS[key];
    var built = active.buildProducts();
    products = built.products; termIndex = built.termIndex; annIndex = built.annIndex;
    vocabByLen = built.vocabByLen; ANN_W = built.ANN_W;
    SYN = {};
    (active.SYN_GROUPS || []).forEach(function (g) { g.forEach(function (t) { SYN[t] = g; }); });
  }
  loadVertical("livres");

  function prismLabel(a, table) {
    return (table || active.PRISM_LABELS)[a] || (a.indexOf("ERA_") === 0 ? eraLabel(a) : null);
  }
  function shortLabel(code, table) {
    var full = prismLabel(code, table);
    if (full) return full.replace(/\s*\([^)]*\)\s*$/, "");
    var words = code.toLowerCase().split("_");
    return words.map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
  }

  function annotate(tokens) {
    var spaced = tokens.join(" ");
    var ann = {};
    active.LEVEL1.forEach(function (rule) {
      var re = new RegExp(rule[0].source, "g"), m;
      while ((m = re.exec(spaced)) !== null) {
        var a = rule[1];
        for (var g = 1; g < m.length; g++) a = a.replace("$" + g, (m[g] || "").toUpperCase());
        a = a.replace(/undefined/g, "");
        if (/^ERA_C(\d+)/.test(a)) a = "ERA_" + ((parseInt(a.slice(5), 10) - 1) * 100) + "S";
        ann[a] = true;
      }
    });
    var stream = Object.keys(ann).sort().join(" ");
    (active.LEVEL2 || []).forEach(function (rule) { if (rule[0].test(stream)) ann[rule[1]] = true; });
    return Object.keys(ann);
  }

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

  /* ---------------- UI + Prismes + Sélecteur de verticale ---------------- */
  function initOne(rootEl) {
    var input = rootEl.querySelector(".play-input");
    var grid = rootEl.querySelector(".play-grid");
    var meta = rootEl.querySelector(".play-meta");
    var prismsEl = rootEl.querySelector(".play-prisms");
    var moreBtn = rootEl.querySelector(".play-more");
    var chipsWrap = rootEl.querySelector(".play-chips");
    var verticalPills = rootEl.querySelectorAll(".play-vertical-pill");
    if (!input || !grid) return;
    var activeFilters = {};
    var expanded = false;

    function renderSamples() {
      if (!chipsWrap) return;
      var html = '<span class="play-chips-label">Essayez :</span>';
      active.samples.forEach(function (s) {
        html += '<button type="button" class="play-chip" data-q="' + esc(s[1]) + '">' + esc(s[0]) + "</button>";
      });
      chipsWrap.innerHTML = html;
      each(chipsWrap.querySelectorAll(".play-chip"), function (chip) {
        chip.addEventListener("click", function () {
          input.value = chip.getAttribute("data-q");
          render(input.value);
          input.focus();
        });
      });
    }

    function render(query, keepFilters) {
      if (!keepFilters) { activeFilters = {}; expanded = false; }
      var t0 = performance.now();
      var r = search(query);
      var filtered = r.all;
      var keys = Object.keys(activeFilters);
      if (keys.length) {
        filtered = r.all.filter(function (h) {
          return keys.every(function (a) { return h.p.anns.indexOf(a) !== -1; });
        });
      }
      var ms = Math.max(1, Math.round(performance.now() - t0));
      if (!query.trim()) { grid.innerHTML = ""; if (prismsEl) prismsEl.innerHTML = ""; meta.innerHTML = "Tapez une recherche — les fautes de frappe sont bienvenues."; return; }
      meta.innerHTML = filtered.length
        ? "<strong>" + filtered.length + " résultat" + (filtered.length > 1 ? "s" : "") + "</strong> · <span class=\"play-speed\">⚡ " + ms + " ms</span> · moteur Heurix embarqué, catalogue de démo (" + products.length.toLocaleString("fr-FR") + " références)"
        : "Aucun résultat · " + ms + " ms";

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
        active.groupOrder.forEach(function (g) {
          if (!groups[g]) return;
          groups[g].sort(function (a, b) { return b[1] - a[1]; });
          chipsHtml.push('<span class="play-prism-group">' + (active.groupLabels[g] || g) + "</span>");
          groups[g].slice(0, g === "ERA" ? 2 : 3).forEach(function (item) {
            var on = activeFilters[item[0]] ? " play-prism-on" : "";
            chipsHtml.push('<button type="button" class="play-prism' + on + '" data-ann="' + item[0] + '">' + esc(item[2]) + ' <span class="play-prism-n">' + item[1] + "</span></button>");
          });
        });
        prismsEl.innerHTML = chipsHtml.length ? '<span class="play-prisms-label">Prismes :</span>' + chipsHtml.join("") : "";
        each(prismsEl.querySelectorAll(".play-prism"), function (btn) {
          btn.addEventListener("click", function () {
            var a = btn.getAttribute("data-ann");
            if (activeFilters[a]) delete activeFilters[a]; else activeFilters[a] = true;
            render(input.value, true);
          });
        });
      }

      var isMobile = window.innerWidth < 640;
      var baseCount = isMobile ? 3 : 9;
      var expandedCount = isMobile ? 9 : 24;
      var visibleCount = expanded ? expandedCount : baseCount;
      var seenName = {}, diverse = [];
      for (var di = 0; di < filtered.length && diverse.length < visibleCount; di++) {
        var key = active.key === "livres" ? filtered[di].p.author + "|" + filtered[di].p.title : filtered[di].p.name + "|" + filtered[di].p.ref;
        seenName[key] = (seenName[key] || 0) + 1;
        if (seenName[key] <= 2) diverse.push(filtered[di]);
      }
      grid.innerHTML = diverse.map(active.renderCard).join("");

      if (!expanded && filtered.length > diverse.length) {
        var remaining = Math.min(filtered.length, expandedCount) - diverse.length;
        moreBtn.hidden = false;
        moreBtn.textContent = "Afficher " + remaining + " résultat" + (remaining > 1 ? "s" : "") + " de plus";
      } else {
        moreBtn.hidden = true;
      }
    }

    moreBtn.addEventListener("click", function () {
      expanded = true;
      render(input.value, true);
    });

    input.addEventListener("input", function () { render(input.value); });

    function switchTo(key) {
      if (key === active.key) return;
      loadVertical(key);
      each(verticalPills, function (p) { p.classList.toggle("play-vertical-on", p.getAttribute("data-vertical") === key); });
      input.placeholder = active.placeholder;
      renderSamples();
      input.value = active.intro;
      render(active.intro);
    }
    each(verticalPills, function (pill) {
      pill.addEventListener("click", function () { switchTo(pill.getAttribute("data-vertical")); });
    });

    renderSamples();

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || rootEl.getAttribute("data-no-intro") === "1") { input.value = active.intro; render(active.intro); return; }
    var i = 0;
    var iv = setInterval(function () {
      if (document.activeElement === input) { clearInterval(iv); return; }
      i++;
      input.value = active.intro.slice(0, i);
      render(input.value);
      if (i >= active.intro.length) clearInterval(iv);
    }, 55);
  }

  function init() { each(document.querySelectorAll(".play"), initOne); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.heurixDemo = { search: search, annotate: annotate, catalogSize: function () { return products.length; }, shortLabel: shortLabel, loadVertical: loadVertical };
})();
