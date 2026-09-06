/*
 * heurix-search.js -- comportement en PANNE.
 *
 * Quatre manques mesures le 6 septembre 2026 en comparant ce fichier au
 * module PrestaShop mur : aucun delai d'attente, aucune classification des
 * codes, aucun coupe-circuit, aucun repli.
 *
 * ------------------------------------------------------------------------
 * LE BOUCHON DE fetch HONORE `signal`, ET C'EST LA PREMIERE CHOSE A LIRE ICI.
 *
 * Celui de tests/heurix-search.test.js ne le fait pas -- il n'en avait pas
 * besoin, aucun code n'abandonnait de requete avant ce chantier. Repris tel
 * quel pour ces tests-la, il aurait montre la version CORRIGEE encore
 * bloquee sur « Recherche… » : le minuteur appelle bien abort(), mais rien
 * n'ecoute le signal, donc la promesse ne rejette jamais.
 *
 * Le test aurait alors mesure une propriete du bouchon et rendu un verdict
 * sur le widget. Trouve en relisant, avant la premiere execution -- pas
 * apres avoir trouve un resultat surprenant, ou il aurait ete trop tard :
 * « correctif inoperant » est exactement la reponse qu'on attend a moitie
 * d'un correctif qu'on vient d'ecrire.
 *
 * Regle qui en sort, et elle depasse ce fichier : UN BOUCHON DOIT
 * IMPLEMENTER LA PARTIE DU CONTRAT QUE LE CODE TESTE UTILISE. Ajouter une
 * capacite au code sans l'ajouter au bouchon rend le test aveugle a cette
 * capacite, en silence, et dans le sens qui accuse le code.
 * ------------------------------------------------------------------------
 */
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-search.js"), "utf8");

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

function erreurAbandon() {
  const e = new Error("The operation was aborted.");
  e.name = "AbortError";
  return e;
}

/** Une API qui ne repond jamais -- mais qui rejette a l'abandon, comme un vrai fetch. */
function apiQuiPend() {
  return (url, opts) =>
    new Promise((_, rejeter) => {
      const s = opts && opts.signal;
      if (!s) return;
      if (s.aborted) return rejeter(erreurAbandon());
      s.addEventListener("abort", () => rejeter(erreurAbandon()));
    });
}

/** Une API qui refuse avec un code et un corps. */
function apiQuiRefuse(statut, detail) {
  return async () => ({ ok: false, status: statut, json: async () => ({ detail }) });
}

const REPONSE_OK = { query: "vis", total: 0, hits: [], fallback: false };
const apiQuiRepond = () => async () => ({ ok: true, status: 200, json: async () => REPONSE_OK });

function monter(fetchImpl, config = {}) {
  const dom = new JSDOM('<div id="cible"></div>', { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Element.prototype.scrollIntoView = () => {};

  let appels = 0;
  global.fetch = (...a) => { appels++; return fetchImpl(...a); };

  const journal = [];
  const capture = (niveau) => (m) => journal.push({ niveau, message: String(m) });
  dom.window.console.warn = capture("warn");
  dom.window.console.error = capture("error");
  global.console.warn = capture("warn");
  global.console.error = capture("error");

  dom.window.eval(SOURCE);
  global.Heurix.searchBox(
    Object.assign(
      { apiKey: "hxp_t", catalog: "f", containerId: "cible", debounceMs: 1, timeoutMs: 50 },
      config
    )
  );

  const doc = dom.window.document;
  return {
    doc,
    win: dom.window,
    journal,
    appels: () => appels,
    panneau: () => doc.querySelector(".hx-search-panel").textContent.replace(/\s+/g, " ").trim(),
    reessayer: () => doc.querySelector(".hx-search-retry"),
    lien: () => doc.querySelector(".hx-search-fallback-link"),
    annonce: () => doc.querySelector(".hx-search-live").textContent,
    async taper(texte, msParCar = 5) {
      const input = doc.querySelector(".hx-search-input");
      for (let i = 1; i <= texte.length; i++) {
        input.value = texte.slice(0, i);
        input.dispatchEvent(new dom.window.Event("input"));
        await attendre(msParCar);
      }
      await attendre(150);
    },
  };
}

describe("1. delai d'attente -- une API qui pend ne bloque plus le panneau", () => {
  it("sort de « Recherche… » et offre une sortie au visiteur", async () => {
    const ctx = monter(apiQuiPend());
    await ctx.taper("vis");
    expect(ctx.panneau()).not.toContain("Recherche…");
    expect(ctx.panneau()).toContain("Recherche indisponible");
    expect(ctx.reessayer(), "le visiteur doit avoir un geste possible").toBeTruthy();
  });

  it("TEMOIN NEGATIF : une API qui repond ne declenche pas l'etat de panne", async () => {
    // Sans ce cas, « le panneau affiche l'etat de panne » serait vrai par
    // construction et le test vert sur du code retire.
    const ctx = monter(apiQuiRepond());
    await ctx.taper("vis");
    expect(ctx.panneau()).not.toContain("Recherche indisponible");
    expect(ctx.reessayer()).toBeNull();
  });

  it("l'etat de panne est annonce aux lecteurs d'ecran", async () => {
    const ctx = monter(apiQuiPend());
    await ctx.taper("vis");
    expect(ctx.annonce()).toContain("Recherche indisponible");
  });

  it("le defaut est de 3 s, la valeur et la raison du module PrestaShop", () => {
    // Assertion sur la SOURCE, pas sur le comportement, et c'est delibere :
    // mesurer 3 000 ms d'attente reelle consommerait 60 % du plafond de
    // 5 000 ms de vitest. CLAUDE.md documente cette famille -- « un test
    // dont la duree s'approche de son plafond est deja casse, meme quand il
    // passe ». Le comportement, lui, est mesure ci-dessus avec timeoutMs: 50.
    expect(SOURCE).toMatch(/var DEFAULT_TIMEOUT_MS = 3000;/);
  });
});

describe("2. classification des codes -- six cas, pas un message generique", () => {
  const CAS = [
    [401, "Missing or malformed Authorization header", false, "error"],
    [403, "Origine 'x.fr' non autorisée pour cette clé publique", false, "error"],
    [403, "clef inconnue", false, "error"],
    [404, "Catalogue « x » introuvable", false, "error"],
    [429, "quota depasse", false, "error"],
    [500, "boom", true, "warn"],
    [503, "indisponible", true, "warn"],
  ];

  it.each(CAS)(
    "HTTP %i (%s) -> transitoire=%s, console=%s",
    async (statut, detail, transitoire, niveau) => {
      const ctx = monter(apiQuiRefuse(statut, detail));
      await ctx.taper("vis");
      const dernier = ctx.journal[ctx.journal.length - 1];
      expect(dernier, "le marchand doit etre prevenu").toBeTruthy();
      expect(dernier.niveau).toBe(niveau);
    }
  );

  it("le 403 « origine » et le 403 « clef » ne disent PAS la meme chose au marchand", async () => {
    // C'EST LE CAS QUI JUSTIFIE DE NE PAS AVOIR RECOPIE LA TABLE PHP.
    // Une clef SERVEUR n'envoie pas d'en-tete Origin, donc HeurixClient ne
    // peut pas connaitre ce cas -- et c'est l'erreur la plus probable d'un
    // widget pose sur un domaine non autorise. Les deux 403 ont le meme
    // code et des remedes opposes : seul le corps les separe.
    const origine = monter(
      apiQuiRefuse(403, "Origine 'boutique.fr' non autorisée pour cette clé publique. Domaines autorisés : heurix.fr")
    );
    await origine.taper("vis");
    const msgOrigine = origine.journal[origine.journal.length - 1].message;

    const clef = monter(apiQuiRefuse(403, "clef inconnue"));
    await clef.taper("vis");
    const msgClef = clef.journal[clef.journal.length - 1].message;

    expect(msgOrigine).not.toBe(msgClef);
    expect(msgOrigine).toMatch(/domaine/i);
    expect(msgOrigine).toMatch(/console Heurix/i);
    expect(msgClef).not.toMatch(/domaine de cette page/i);
  });

  it("le VISITEUR ne lit jamais le diagnostic du marchand", async () => {
    // Deux publics, deux canaux. PrestaShop l'obtient gratuitement
    // (PrestaShopLogger d'un cote, la page de l'autre) ; dans un navigateur
    // les deux publics regardent le meme ecran, donc la separation se pose
    // a la main, et se verifie.
    const ctx = monter(
      apiQuiRefuse(403, "Origine 'boutique.fr' non autorisée pour cette clé publique")
    );
    await ctx.taper("vis");
    const vu = ctx.panneau();
    expect(vu).toContain("Recherche indisponible");
    expect(vu).not.toMatch(/403|Origine|clé publique|HTTP/);
  });
});

describe("3. coupe-circuit -- alimente par les seules pannes transitoires", () => {
  async function appelsApresDeuxRecherches(fetchImpl) {
    const ctx = monter(fetchImpl);
    await ctx.taper("vis");
    const apresPremiere = ctx.appels();
    await ctx.taper(" m8", 250);
    return { apresPremiere, apresSeconde: ctx.appels(), ctx };
  }

  it("un 500 met en pause : la seconde recherche ne rappelle pas l'API", async () => {
    const r = await appelsApresDeuxRecherches(apiQuiRefuse(500, "boom"));
    expect(r.apresSeconde).toBe(r.apresPremiere);
  });

  it("UN 429 NE MET PAS EN PAUSE -- chantier I1, 5 aout 2026", async () => {
    // Un quota epuise dure jusqu'a la fin de la periode de facturation. Une
    // pause de 60 s ne protege rien et masque le signal que le marchand doit
    // voir a chaque recherche. C'est la revision que ce test verrouille.
    const r = await appelsApresDeuxRecherches(apiQuiRefuse(429, "quota"));
    expect(r.apresSeconde).toBeGreaterThan(r.apresPremiere);
  });

  it("une erreur de CONFIGURATION ne met pas en pause non plus", async () => {
    const r = await appelsApresDeuxRecherches(apiQuiRefuse(404, "catalogue introuvable"));
    expect(r.apresSeconde).toBeGreaterThan(r.apresPremiere);
  });

  it("le martelage tombe de 10 appels a 1 sur une panne transitoire", async () => {
    // Mesure du 6 septembre 2026 sur le fichier d'avant : une frappe
    // ordinaire (250 ms/caractere, donc plus lente que l'anti-rebond de
    // 200 ms) produisait un appel par caractere.
    //
    // SIX FRAPPES, PAS ONZE. La mesure d'origine en utilisait onze, ce qui
    // faisait durer ce test 2 943 ms contre le plafond de 5 000 ms de
    // vitest -- « un test dont la duree s'approche de son plafond est deja
    // casse, meme quand il passe » (CLAUDE.md). Six suffisent a etablir la
    // propriete : avant, un appel par frappe ; apres, un seul.
    const ctx = monter(apiQuiRefuse(500, "boom"), { debounceMs: 200, timeoutMs: 50 });
    await ctx.taper("vis m8", 250);
    expect(ctx.appels()).toBe(1);
  });

  it("« Reessayer » court-circuite la pause -- un geste explicite prime", async () => {
    const ctx = monter(apiQuiRefuse(500, "boom"));
    await ctx.taper("vis");
    const avant = ctx.appels();
    ctx.reessayer().dispatchEvent(new ctx.win.MouseEvent("click", { bubbles: true }));
    await attendre(150);
    expect(ctx.appels()).toBeGreaterThan(avant);
  });

  it("un succes efface la pause", async () => {
    let enPanne = true;
    const ctx = monter(async () =>
      enPanne
        ? { ok: false, status: 500, json: async () => ({ detail: "boom" }) }
        : { ok: true, status: 200, json: async () => REPONSE_OK }
    );
    await ctx.taper("vis");
    enPanne = false;
    ctx.reessayer().dispatchEvent(new ctx.win.MouseEvent("click", { bubbles: true }));
    await attendre(150);
    const apresSucces = ctx.appels();
    await ctx.taper(" m8", 250);
    expect(ctx.appels()).toBeGreaterThan(apresSucces);
  });

  it("une requete ABANDONNEE par une frappe plus recente n'arme pas le coupe-circuit", async () => {
    // L'ordre du garde dans le .catch est ce qui le decide : une frappe
    // rapide abandonne la requete precedente, qui rejette elle aussi en
    // AbortError. Classee, elle passerait pour une panne reseau et une
    // saisie rapide mettrait la recherche en pause pendant une minute.
    // Frappe raccourcie pour la meme raison que le test precedent : la
    // version d'origine tournait en 3 841 ms, soit 77 % du plafond.
    const ctx = monter(apiQuiRepond(), { debounceMs: 1, timeoutMs: 5000 });
    await ctx.taper("vis m8", 250);
    expect(ctx.panneau()).not.toContain("Recherche indisponible");
    const avant = ctx.appels();
    await ctx.taper(" a4", 250);
    expect(ctx.appels()).toBeGreaterThan(avant);
  });
});

describe("4. repli -- deux etages, dont un sans aucune configuration", () => {
  it("sans configuration, le panneau cesse d'etre un cul-de-sac", async () => {
    const ctx = monter(apiQuiRefuse(500, "boom"), { fallbackHref: undefined });
    await ctx.taper("vis");
    expect(ctx.reessayer()).toBeTruthy();
    expect(ctx.lien(), "aucun lien sans configuration").toBeNull();
  });

  it("fallbackHref renvoie le visiteur vers la recherche du marchand", async () => {
    const ctx = monter(apiQuiRefuse(500, "boom"), {
      fallbackHref: (q) => "/recherche?q=" + encodeURIComponent(q),
    });
    await ctx.taper("vis");
    expect(ctx.lien().getAttribute("href")).toBe("/recherche?q=vis");
  });

  it("l'URL du marchand est echappee comme tout attribut porteur de donnee", async () => {
    const ctx = monter(apiQuiRefuse(500, "boom"), {
      fallbackHref: () => '/r?q="><img src=x onerror=alert(1)>',
    });
    await ctx.taper("vis");
    // L'ASSERTION PORTE SUR LE DOM, PAS SUR innerHTML -- deux versions
    // fausses avant celle-ci, la meme cause chaque fois.
    //
    // 1. « le HTML ne contient pas onerror=alert » : faux sur du code juste,
    //    esc() neutralise sans faire disparaitre.
    // 2. « le HTML ne contient pas <img » : faux aussi. innerHTML
    //    RE-SERIALISE le DOM, et un serialiseur n'echappe dans une valeur
    //    d'attribut que ce qui doit l'etre -- & et le guillemet. Le < y
    //    ressort tel quel, a l'interieur d'une valeur correctement citee.
    //
    // Dans les deux cas je lisais une chaine en croyant lire une structure.
    // La question est « une balise a-t-elle ete creee ? », et seul l'arbre
    // repond : le serialiseur, lui, rend un texte qui ressemble a du danger
    // sans en etre.
    const panneau = ctx.doc.querySelector(".hx-search-panel");
    expect(panneau.querySelector("img"), "aucun element injecte").toBeNull();
    const a = ctx.lien();
    expect(a.getAttribute("href")).toBe('/r?q="><img src=x onerror=alert(1)>');
    expect(a.attributes.length, "aucun attribut supplementaire injecte").toBe(2); // class + href
  });
});

describe("non-regression -- ce que les marchands deja installes doivent garder", () => {
  it("aucune option nouvelle n'est requise : la configuration minimale marche", async () => {
    const dom = new JSDOM('<div id="cible"></div>', { url: "http://localhost/" });
    global.window = dom.window;
    global.document = dom.window.document;
    dom.window.Element.prototype.scrollIntoView = () => {};
    global.fetch = async () => ({ ok: true, status: 200, json: async () => REPONSE_OK });
    dom.window.eval(SOURCE);
    expect(() =>
      global.Heurix.searchBox({ apiKey: "hxp_t", catalog: "f", containerId: "cible" })
    ).not.toThrow();
  });

  it("LE FICHIER N'ECRIT RIEN CHEZ LE VISITEUR -- ni stockage, ni cookie", async () => {
    // Decision du 6 septembre 2026 : la pause du coupe-circuit vit dans la
    // memoire de la page et meurt a la navigation. Les deux implementations
    // serveur persistent la leur parce qu'elles n'ont pas le choix (chaque
    // requete PHP est un process neuf). Ici le choix existe, et le prendre
    // dans l'autre sens evite de changer l'empreinte d'un script deja
    // installe chez des marchands -- donc aucune question de consentement.
    const ctx = monter(apiQuiRefuse(500, "boom"));
    const ecritures = [];
    ctx.win.sessionStorage.setItem = (k) => ecritures.push(k);
    ctx.win.localStorage.setItem = (k) => ecritures.push(k);
    await ctx.taper("vis");
    ctx.reessayer().dispatchEvent(new ctx.win.MouseEvent("click", { bubbles: true }));
    await attendre(150);
    expect(ecritures).toEqual([]);
    // LE BALAYAGE PORTE SUR LE CODE, PAS SUR LES COMMENTAIRES -- et c'est ma
    // propre phrase qui l'a impose. Le commentaire de creerCoupeCircuit dit
    // « ni sessionStorage, ni cookie » pour expliquer la decision ; un
    // balayage naif du fichier entier y voyait un appel et echouait sur du
    // code juste. Une regle qui s'enonce dans le fichier qu'elle contraint
    // doit exclure sa propre enonciation.
    const codeSeul = SOURCE
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(codeSeul).not.toMatch(/sessionStorage|localStorage|document\.cookie/);
    // TEMOIN : le depouillement ne doit pas avoir vide la source au point de
    // ne plus rien pouvoir attraper. Sans ce controle, « aucune ecriture
    // trouvee » et « plus rien a lire » ont la meme forme.
    expect(codeSeul).toMatch(/function creerCoupeCircuit/);
    expect(codeSeul.length).toBeGreaterThan(SOURCE.length / 3);
  });

  it("AbortController absent : le widget fonctionne, sans delai d'attente", async () => {
    // Navigateur ancien. Le garde `typeof AbortController !== "undefined"`
    // doit degrader vers le comportement d'avant ce chantier, pas jeter.
    const dom = new JSDOM('<div id="cible"></div>', { url: "http://localhost/" });
    global.window = dom.window;
    global.document = dom.window.document;
    dom.window.Element.prototype.scrollIntoView = () => {};
    const sauvegarde = dom.window.AbortController;
    delete dom.window.AbortController;
    const globalSauvegarde = global.AbortController;
    // eslint-disable-next-line no-global-assign
    global.AbortController = undefined;
    try {
      global.fetch = async () => ({ ok: true, status: 200, json: async () => REPONSE_OK });
      dom.window.eval(SOURCE);
      global.Heurix.searchBox({
        apiKey: "hxp_t", catalog: "f", containerId: "cible", debounceMs: 1,
      });
      const input = dom.window.document.querySelector(".hx-search-input");
      input.value = "vis";
      input.dispatchEvent(new dom.window.Event("input"));
      await attendre(150);
      expect(dom.window.document.querySelector(".hx-search-panel").textContent)
        .toContain("Aucun résultat");
    } finally {
      global.AbortController = globalSauvegarde;
      dom.window.AbortController = sauvegarde;
    }
  });
});
