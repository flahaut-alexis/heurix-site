/*
 * heurix-browse-widget.js -- comportement en PANNE.
 *
 * Les quatre memes manques que heurix-search.js portait avant le 6 septembre
 * 2026, trouves en appliquant le corollaire de CLAUDE.md : « quand un defaut
 * est trouve dans un fichier de downloads/, la question suivante est qui
 * d'autre ecrit ce motif ? ». La reponse etait ce fichier -- aucun delai
 * d'attente, aucune lecture du code HTTP, aucun coupe-circuit, aucun repli.
 *
 * ------------------------------------------------------------------------
 * LE BOUCHON DE fetch HONORE `signal`, ET C'EST LA PREMIERE CHOSE A LIRE ICI.
 *
 * Aucun des cinq autres bouchons du depot ne le fait -- aucun code
 * n'abandonnait de requete avant ce chantier. Repris tel quel, il aurait
 * montre la version CORRIGEE encore bloquee sur « Chargement… » : le minuteur
 * appelle bien abort(), mais rien n'ecoute le signal, donc la promesse ne
 * rejette jamais. Le test aurait alors mesure une propriete du bouchon et
 * rendu un verdict sur le widget -- dans le sens qui accuse le widget.
 *
 * UN BOUCHON DOIT IMPLEMENTER LA PARTIE DU CONTRAT QUE LE CODE TESTE UTILISE.
 * La meme regle a fait ajouter `ok` et `status` au bouchon de
 * heurix-browse-langue.test.js le meme jour : sans eux, le diagnostic ajoute
 * a Heurix.browse lisait `ok === undefined` et journalisait « HTTP undefined »
 * sur des reponses saines.
 * ------------------------------------------------------------------------
 */
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-browse-widget.js"), "utf8");
const DEMO = fs.readFileSync(path.join(RACINE, "demo-boutique.js"), "utf8");

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

function reponse(total = 2) {
  return {
    category: "visserie", sort: "stock", total, offset: 0, limit: 24,
    hits: Array.from({ length: Math.min(total, 24) }, (_, i) => ({
      product: { id: "REF-" + i, name: "Vis " + i, price: 2 }, in_stock: true,
    })),
  };
}

const apiQuiRepond = (total = 2) => async () => ({
  ok: true, status: 200, json: async () => reponse(total),
});

/** Repond apres `ms`, et rejette a l'abandon -- pour les courses entre requetes. */
function apiLente(ms, total = 200) {
  return (url, opts) =>
    new Promise((resoudre, rejeter) => {
      const s = opts && opts.signal;
      const t = setTimeout(
        () => resoudre({ ok: true, status: 200, json: async () => reponse(total) }), ms);
      if (s) s.addEventListener("abort", () => { clearTimeout(t); rejeter(erreurAbandon()); });
    });
}

function monter(fetchImpl, config = {}) {
  const dom = new JSDOM('<!doctype html><html lang="fr"><body><div id="c"></div></body></html>',
    { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;

  let appels = 0;
  const faux = (...a) => { appels++; return fetchImpl(...a); };
  global.fetch = faux;
  dom.window.fetch = faux;

  const journal = [];
  const capture = (niveau) => (m) => journal.push({ niveau, message: String(m) });
  dom.window.console.warn = capture("warn");
  dom.window.console.error = capture("error");
  global.console = { ...console, warn: capture("warn"), error: capture("error") };

  dom.window.eval(SOURCE);
  const api = dom.window.Heurix ?? global.Heurix;
  const instance = api.browsePanel(Object.assign(
    { apiKey: "hxp_t", catalog: "quincaillerie-nord", category: "visserie",
      containerId: "c", timeoutMs: 50 },
    config
  ));

  const doc = dom.window.document;
  const texte = (sel) => (doc.querySelector(sel)?.textContent || "").replace(/\s+/g, " ").trim();
  return {
    doc, win: dom.window, journal, instance, api,
    appels: () => appels,
    grille: () => texte(".hx-rayon-grille"),
    compte: () => texte(".hx-rayon-compte"),
    /* CE QUE LE VISITEUR LIT, sans presumer QUEL element le porte.
     *
     * Les assertions negatives passaient par `grille()` seule. Le jour ou la
     * phrase a demenage de la grille vers le compte -- pour cesser d'etre
     * ecrite deux fois -- elles seraient devenues vraies par construction :
     * « la grille ne contient pas la phrase » et « la phrase n'est nulle
     * part » ont alors la meme forme, et c'est la rassurante qui s'impose.
     */
    ecran: () => (texte(".hx-rayon-compte") + " " + texte(".hx-rayon-grille")).trim(),
    reessayer: () => doc.querySelector(".hx-rayon-reessayer"),
    lien: () => doc.querySelector(".hx-rayon-secours"),
    dernier: () => journal[journal.length - 1],
  };
}

// ===========================================================================
describe("1. delai d'attente -- une API qui pend ne bloque plus le rayon", () => {
  it("sort de « Chargement… » et offre un geste au visiteur", async () => {
    const ctx = monter(apiQuiPend());
    await attendre(150);
    expect(ctx.grille()).not.toContain("Chargement");
    expect(ctx.ecran()).toContain("Rayon indisponible");
    expect(ctx.reessayer(), "le visiteur doit avoir un geste possible").toBeTruthy();
  });

  it("TEMOIN NEGATIF : une API qui repond ne declenche pas l'etat de panne", async () => {
    // Sans ce cas, « la grille affiche l'etat de panne » serait vrai par
    // construction et le test vert sur du code retire.
    const ctx = monter(apiQuiRepond());
    await attendre(150);
    expect(ctx.ecran()).not.toContain("Rayon indisponible");
    expect(ctx.reessayer()).toBeNull();
    expect(ctx.doc.querySelectorAll(".heurix-product")).toHaveLength(2);
  });

  it("l'etat de panne passe par le compte, qui porte l'aria-live", async () => {
    // Le widget n'a pas de region live dediee : .hx-rayon-compte est
    // role="status" aria-live="polite" depuis l'etape 1. C'est donc lui, et
    // pas la grille, qui porte l'annonce aux lecteurs d'ecran.
    const ctx = monter(apiQuiPend());
    await attendre(150);
    const c = ctx.doc.querySelector(".hx-rayon-compte");
    expect(c.getAttribute("aria-live")).toBe("polite");
    expect(c.textContent).toContain("Rayon indisponible");
  });

  it("le defaut est de 5 s ICI, contre 3 s pour la barre de recherche", () => {
    // Assertion sur la SOURCE, pas sur le comportement, et c'est delibere :
    // attendre 5 000 ms reels depasserait le plafond de 5 000 ms de vitest a
    // lui seul. Le comportement, lui, est mesure ci-dessus avec timeoutMs: 50.
    //
    // LA DIVERGENCE EST MESUREE, PAS RECOPIEE. 30 appels browse sur l'API de
    // production le 6 septembre 2026 (24 produits, 4 facettes) : min 0,175 s,
    // mediane 0,20 s, max 2,105 s. Les 3 000 ms de la recherche -- dont le
    // max mesure etait 0,814 s sur 12 appels -- ne laisseraient ici que 1,4
    // fois la pire latence observee, et un declenchement a tort coute tout le
    // rayon plus une pause de 60 s.
    expect(SOURCE).toMatch(/var RAYON_TIMEOUT_MS = 5000;/);
  });

  it("timeoutMs: 0 desarme le minuteur -- le comportement d'avant, sur demande", async () => {
    const ctx = monter(apiQuiPend(), { timeoutMs: 0 });
    await attendre(120);
    expect(ctx.grille()).toContain("Chargement");
    expect(ctx.reessayer()).toBeNull();
  });
});

// ===========================================================================
describe("2. classification des codes -- pas un message generique", () => {
  const CAS = [
    [401, "Missing or malformed Authorization header", "error"],
    [403, "Origine 'x.fr' non autorisée pour cette clé publique", "error"],
    [403, "clef inconnue", "error"],
    [404, "Catalogue « x » introuvable", "error"],
    [429, "quota depasse", "error"],
    [500, "boom", "warn"],
    [503, "indisponible", "warn"],
  ];

  it.each(CAS)("HTTP %i (%s) -> console=%s", async (statut, detail, niveau) => {
    const ctx = monter(apiQuiRefuse(statut, detail));
    await attendre(120);
    expect(ctx.dernier(), "le marchand doit etre prevenu").toBeTruthy();
    expect(ctx.dernier().niveau).toBe(niveau);
  });

  it("le 403 « origine » et le 403 « clef » ne disent PAS la meme chose au marchand", async () => {
    // C'EST LE CAS MESURE LE 6 SEPTEMBRE 2026 SUR demo/index.html, servi
    // depuis localhost : la clef publique de la boutique est restreinte a
    // heurix.fr, donc l'API rend 403 « Origine non autorisee » -- et la
    // console ne portait que « HTTP 403 ».
    const origine = monter(apiQuiRefuse(403,
      "Origine 'boutique.fr' non autorisée pour cette clé publique. Domaines autorisés : heurix.fr"));
    await attendre(120);
    const msgOrigine = origine.dernier().message;

    const clef = monter(apiQuiRefuse(403, "clef inconnue"));
    await attendre(120);
    const msgClef = clef.dernier().message;

    expect(msgOrigine).not.toBe(msgClef);
    expect(msgOrigine).toMatch(/domaine/i);
    expect(msgOrigine, "il faut dire OU l'autoriser").toMatch(/console Heurix/i);
    expect(msgClef).not.toMatch(/domaine de cette page/i);
  });

  it("un 404 nomme les DEUX options du chemin -- catalog et category", async () => {
    // Divergence assumee avec heurix-search.js, dont le 404 ne peut viser que
    // `catalog`. Ici la categorie est dans le chemin elle aussi : nommer la
    // seule clef enverrait chercher au mauvais endroit une fois sur deux.
    const ctx = monter(apiQuiRefuse(404, "Categorie introuvable"));
    await attendre(120);
    expect(ctx.dernier().message).toMatch(/`catalog`/);
    expect(ctx.dernier().message).toMatch(/`category`/);
  });

  it("le VISITEUR ne lit jamais le diagnostic du marchand", async () => {
    // Deux publics, deux canaux. PrestaShop l'obtient gratuitement
    // (PrestaShopLogger d'un cote, la page de l'autre) ; dans un navigateur
    // les deux publics regardent le meme ecran, donc la separation se pose a
    // la main, et se verifie.
    const ctx = monter(apiQuiRefuse(403,
      "Origine 'boutique.fr' non autorisée pour cette clé publique"));
    await attendre(120);
    const vu = ctx.grille() + " " + ctx.compte();
    expect(vu).toContain("Rayon indisponible");
    expect(vu).not.toMatch(/403|Origine|clé publique|HTTP/);
  });
});

// ===========================================================================
describe("3. coupe-circuit -- alimente par les seules pannes transitoires", () => {
  /* Le vecteur de martelage est goToPage : sur un premier chargement en
   * echec, le rail n'a jamais ete dessine, donc il n'y a aucune case a
   * cocher. C'est aussi le geste le plus probable d'un visiteur devant un
   * rayon qui ne se remplit pas. */
  async function troisTentatives(fetchImpl) {
    const ctx = monter(fetchImpl);
    await attendre(120);
    const apresPremiere = ctx.appels();
    ctx.instance.goToPage(2);
    ctx.instance.goToPage(3);
    await attendre(120);
    return { apresPremiere, apresSuite: ctx.appels(), ctx };
  }

  it("un 500 met en pause : les tentatives suivantes ne rappellent pas l'API", async () => {
    const r = await troisTentatives(apiQuiRefuse(500, "boom"));
    expect(r.apresPremiere).toBe(1);
    expect(r.apresSuite).toBe(1);
  });

  it("un delai depasse met en pause lui aussi", async () => {
    const r = await troisTentatives(apiQuiPend());
    expect(r.apresSuite).toBe(r.apresPremiere);
  });

  it("UN 429 NE MET PAS EN PAUSE -- chantier I1, 5 aout 2026", async () => {
    // Un quota epuise dure jusqu'a la fin de la periode de facturation. Une
    // pause de 60 s ne protege rien et masque le signal que le marchand doit
    // voir a chaque chargement. C'est la revision que ce test verrouille.
    const r = await troisTentatives(apiQuiRefuse(429, "quota"));
    expect(r.apresSuite).toBeGreaterThan(r.apresPremiere);
  });

  it("une erreur de CONFIGURATION ne met pas en pause non plus", async () => {
    const r = await troisTentatives(apiQuiRefuse(404, "catalogue introuvable"));
    expect(r.apresSuite).toBeGreaterThan(r.apresPremiere);
  });

  it("l'etat de panne reste affiche pendant la pause -- pas un ecran vide", async () => {
    const r = await troisTentatives(apiQuiRefuse(500, "boom"));
    expect(r.ctx.ecran()).toContain("Rayon indisponible");
    expect(r.ctx.reessayer()).toBeTruthy();
  });

  it("« Reessayer » court-circuite la pause -- un geste explicite prime", async () => {
    const ctx = monter(apiQuiRefuse(500, "boom"));
    await attendre(120);
    const avant = ctx.appels();
    ctx.reessayer().dispatchEvent(new ctx.win.MouseEvent("click", { bubbles: true }));
    await attendre(120);
    expect(ctx.appels()).toBeGreaterThan(avant);
  });

  it("un succes efface la pause", async () => {
    let enPanne = true;
    const ctx = monter(async () =>
      enPanne
        ? { ok: false, status: 500, json: async () => ({ detail: "boom" }) }
        : { ok: true, status: 200, json: async () => reponse(200) });
    await attendre(120);
    enPanne = false;
    ctx.reessayer().dispatchEvent(new ctx.win.MouseEvent("click", { bubbles: true }));
    await attendre(120);
    expect(ctx.ecran()).not.toContain("Rayon indisponible");
    const apresSucces = ctx.appels();
    ctx.instance.goToPage(2);
    await attendre(120);
    expect(ctx.appels()).toBeGreaterThan(apresSucces);
  });

  it("une requete ABANDONNEE par une navigation plus recente n'arme pas le coupe-circuit", async () => {
    // L'ordre du garde dans le .catch est ce qui le decide : changer de page
    // coupe la requete precedente, qui rejette elle aussi en AbortError.
    // Classee, elle passerait pour une panne reseau -- et trois clics rapides
    // mettraient le rayon en pause pendant une minute alors que l'API va bien.
    //
    // L'OBSERVATION SE FAIT PENDANT QUE LA REQUETE PLUS RECENTE EST ENCORE EN
    // VOL, et c'est tout le test. Une premiere version regardait APRES son
    // retour : le succes appelle `reinitialiser()`, donc il effacait la trace
    // de l'echec fautif juste avant la mesure. Retirer le garde ne faisait
    // alors tomber AUCUN test -- verifie par mutation, ce qui est la seule
    // preuve qu'un test mesure autre chose que son propre montage.
    //
    // La fenetre est aussi celle qui coute : le visiteur y verrait l'ecran de
    // panne clignoter sur un rayon qui va bien, et tout geste pendant ce
    // temps serait court-circuite par une pause de 60 s.
    const ctx = monter(apiLente(60), { timeoutMs: 5000 });
    await attendre(110);                 // la page 1 est arrivee
    expect(ctx.ecran()).not.toContain("Rayon indisponible");
    expect(ctx.instance.getState().totalPages).toBeGreaterThan(3);

    ctx.instance.goToPage(2);
    ctx.instance.goToPage(3);            // abandonne la requete de la page 2
    await attendre(25);                  // la page 3 n'est PAS encore revenue

    expect(ctx.ecran(), "un abandon volontaire n'est pas une panne").not.toContain("Rayon indisponible");
    const avant = ctx.appels();
    ctx.instance.goToPage(4);
    expect(ctx.appels(), "le coupe-circuit ne doit pas s'etre arme").toBeGreaterThan(avant);
    await attendre(120);                 // on laisse retomber les requetes en vol
  });
});

// ===========================================================================
describe("4. repli -- deux etages, dont un sans aucune configuration", () => {
  /* LE POINT 4 -- « une panne ne detruit pas ce qui est affiche » -- EST
   * VERROUILLE DANS tests/heurix-browse-panne-restante.test.js, bloc 4, et
   * PAS ICI. Deux tests l'y couvrent, dont un qui clique la vraie pagination
   * plutot que d'appeler goToPage().
   *
   * J'en avais ecrit un doublon a cet endroit, apres avoir conclu que le cas
   * n'etait couvert par personne. LA CONCLUSION VENAIT D'UN INSTRUMENT TROP
   * ETROIT : j'avais reinjecte le defaut en ne lancant QUE ce fichier, alors
   * que le test vivait dans l'autre. Zero rouge, et je l'ai lu comme « il
   * n'y a rien ici ».
   *
   * Une reinjection se juge donc sur la SUITE COMPLETE, jamais sur le
   * fichier qu'on est en train d'ecrire -- sinon « ce test est creux » et
   * « ce test est ailleurs » rendent exactement la meme sortie.
   */
  it("sans configuration, le rayon cesse d'etre un cul-de-sac", async () => {
    const ctx = monter(apiQuiRefuse(500, "boom"), { fallbackHref: undefined });
    await attendre(120);
    expect(ctx.reessayer()).toBeTruthy();
    expect(ctx.lien(), "aucun lien sans configuration").toBeNull();
  });

  it("fallbackHref recoit la categorie et rend le lien du marchand", async () => {
    const recues = [];
    const ctx = monter(apiQuiRefuse(500, "boom"), {
      fallbackHref: (c) => { recues.push(c); return "/rayon/" + c; },
    });
    await attendre(120);
    expect(recues).toContain("visserie");
    expect(ctx.lien().getAttribute("href")).toBe("/rayon/visserie");
  });

  it("l'URL du marchand est echappee comme tout attribut porteur de donnee", async () => {
    const ctx = monter(apiQuiRefuse(500, "boom"), {
      fallbackHref: () => '/r?c="><img src=x onerror=alert(1)>',
    });
    await attendre(120);
    // L'ASSERTION PORTE SUR LE DOM, PAS SUR innerHTML. esc() neutralise sans
    // faire disparaitre, et innerHTML RE-SERIALISE l'arbre : un `<` ressort
    // tel quel a l'interieur d'une valeur d'attribut correctement citee. La
    // question est « une balise a-t-elle ete creee ? », et seul l'arbre repond.
    expect(ctx.doc.querySelector(".hx-rayon-grille img"), "aucun element injecte").toBeNull();
    const a = ctx.lien();
    expect(a.getAttribute("href")).toBe('/r?c="><img src=x onerror=alert(1)>');
    expect(a.attributes.length, "aucun attribut supplementaire injecte").toBe(2); // class + href
  });
});

// ===========================================================================
describe("non-regression -- ce que les marchands deja installes doivent garder", () => {
  it("aucune option nouvelle n'est requise : la configuration minimale marche", async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="c"></div></body></html>',
      { url: "http://localhost/" });
    global.window = dom.window;
    global.document = dom.window.document;
    const faux = async () => ({ ok: true, status: 200, json: async () => reponse(2) });
    global.fetch = faux; dom.window.fetch = faux;
    dom.window.eval(SOURCE);
    const api = dom.window.Heurix ?? global.Heurix;
    expect(() => api.browsePanel({
      apiKey: "hxp_t", catalog: "f", category: "v", containerId: "c",
    })).not.toThrow();
    await attendre(40);
    expect(dom.window.document.querySelectorAll(".heurix-product")).toHaveLength(2);
  });

  it("LE FICHIER N'ECRIT RIEN CHEZ LE VISITEUR -- ni stockage, ni cookie", async () => {
    // Decision du 6 septembre 2026, reconduite depuis heurix-search.js : la
    // pause du coupe-circuit vit dans la memoire de la page et meurt a la
    // navigation. Les deux implementations serveur persistent la leur parce
    // qu'elles n'ont pas le choix (chaque requete PHP est un process neuf).
    // Ici le choix existe, et le prendre dans l'autre sens evite de changer
    // l'empreinte d'un script deja installe -- donc aucune question de
    // consentement.
    const ctx = monter(apiQuiRefuse(500, "boom"));
    const ecritures = [];
    ctx.win.sessionStorage.setItem = (k) => ecritures.push(k);
    ctx.win.localStorage.setItem = (k) => ecritures.push(k);
    await attendre(120);
    ctx.reessayer().dispatchEvent(new ctx.win.MouseEvent("click", { bubbles: true }));
    await attendre(120);
    expect(ecritures).toEqual([]);
    // LE BALAYAGE PORTE SUR LE CODE, PAS SUR LES COMMENTAIRES. Le commentaire
    // de creerCoupeCircuit dit « ni sessionStorage, ni cookie » pour expliquer
    // la decision ; un balayage naif du fichier entier y voit un appel et
    // echoue sur du code juste. Une regle qui s'enonce dans le fichier qu'elle
    // contraint doit exclure sa propre enonciation.
    const codeSeul = SOURCE
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(codeSeul).not.toMatch(/sessionStorage|localStorage|document\.cookie/);
    // TEMOIN : le depouillement ne doit pas avoir vide la source au point de
    // ne plus rien pouvoir attraper. Sans ce controle, « aucune ecriture
    // trouvee » et « plus rien a lire » ont la meme forme.
    expect(codeSeul).toMatch(/function creerCoupeCircuit/);
    expect(codeSeul.length).toBeGreaterThan(SOURCE.length / 4);
  });

  it("AbortController absent : le widget fonctionne, sans delai d'attente", async () => {
    // Navigateur ancien. Le garde `typeof AbortController !== "undefined"`
    // doit degrader vers le comportement d'avant ce chantier, pas jeter.
    const dom = new JSDOM('<!doctype html><html><body><div id="c"></div></body></html>',
      { url: "http://localhost/" });
    global.window = dom.window;
    global.document = dom.window.document;
    const sauvegarde = dom.window.AbortController;
    const globalSauvegarde = global.AbortController;
    delete dom.window.AbortController;
    global.AbortController = undefined;
    try {
      const faux = async () => ({ ok: true, status: 200, json: async () => reponse(2) });
      global.fetch = faux; dom.window.fetch = faux;
      dom.window.eval(SOURCE);
      const api = dom.window.Heurix ?? global.Heurix;
      api.browsePanel({ apiKey: "hxp_t", catalog: "f", category: "v", containerId: "c" });
      await attendre(60);
      expect(dom.window.document.querySelectorAll(".heurix-product")).toHaveLength(2);
    } finally {
      global.AbortController = globalSauvegarde;
      dom.window.AbortController = sauvegarde;
    }
  });
});

// ===========================================================================
describe("Heurix.browse -- le diagnostic est ADDITIF, le contrat ne bouge pas", () => {
  /* Ce chemin est verrouille par 35 tests de caracterisation, dont deux qui
   * figent des DEFAUTS connus. Il gagne la classification en console, et rien
   * d'autre : meme valeur resolue, meme DOM, meme nombre d'appels.
   *
   * Les quatre gardes appartiennent a browsePanel. Une promesse qui pend
   * deviendrait une promesse qui REJETTE, et un marchand qui a ecrit
   * `.then(rendre)` sans `.catch` passerait d'une page qui ne se remplit pas
   * a une erreur non rattrapee -- possiblement une alerte chez lui.
   */
  function chargerBrowse(reponseFetch) {
    const dom = new JSDOM('<!doctype html><html><body><div id="c"></div></body></html>',
      { url: "http://localhost/" });
    global.window = dom.window;
    global.document = dom.window.document;
    let appels = 0;
    const faux = async () => { appels++; return reponseFetch(); };
    global.fetch = faux; dom.window.fetch = faux;
    const journal = [];
    const capture = (n) => (m) => journal.push({ niveau: n, message: String(m) });
    global.console = { ...console, warn: capture("warn"), error: capture("error") };
    dom.window.console.warn = capture("warn");
    dom.window.console.error = capture("error");
    dom.window.eval(SOURCE);
    return { dom, journal, api: dom.window.Heurix ?? global.Heurix, appels: () => appels };
  }

  const BASE = { apiKey: "hxp_t", catalog: "f", category: "v", containerId: "c" };

  it("un 403 « origine » nomme le domaine en console -- ce que la mesure a montre absent", async () => {
    const ctx = chargerBrowse(() => ({
      ok: false, status: 403,
      json: async () => ({ detail: "Origine 'absente' non autorisée pour cette clé publique. Domaines autorisés : heurix.fr" }),
    }));
    await ctx.api.browse(BASE);
    const msg = ctx.journal.map((e) => e.message).join(" ");
    expect(msg).toMatch(/domaine de cette page/i);
    expect(msg).toMatch(/console Heurix/i);
  });

  it("LE DEFAUT CONNU EST CORRIGE : la promesse resout toujours, le DOM ne ment plus", async () => {
    // CETTE ASSERTION ETAIT L'INVERSE, ET ELLE A FAIT SON TRAVAIL.
    //
    // Elle figeait le mensonge -- « la promesse resout, le DOM dit aucun
    // produit » -- pour qu'il ne se corrige pas par accident. Elle est
    // RETOURNEE et non supprimee : la ligne qui protegeait le defaut protege
    // maintenant sa correction, comme celle de `res.ok` la veille.
    //
    // CE QUI NE BOUGE PAS EST AUSSI IMPORTANT QUE CE QUI BOUGE, et c'est
    // pourquoi les trois autres assertions sont conservees mot pour mot :
    // la promesse resout toujours, un seul appel part, et rien de plus. Le
    // durcissement ne touche QUE ce que le visiteur lit -- c'est la voie
    // moyenne, et c'est ce qui rend l'objection de non-regression
    // satisfaite plutot que contournee.
    const ctx = chargerBrowse(() => ({
      ok: false, status: 403, json: async () => ({ detail: "Origine 'x' non autorisée" }),
    }));
    const rendu = await ctx.api.browse(BASE);
    expect(rendu, "la promesse resout, comme avant").toBeTruthy();
    // Et elle resout MIEUX qu'avant : `hits` etait absent sur un corps
    // d'erreur, donc `d.hits.map(...)` jetait un TypeError chez le marchand.
    expect(Array.isArray(rendu.hits), "hits est un tableau, plus jamais absent").toBe(true);
    expect(rendu.heurixError.code).toBe("origine");

    const vu = ctx.dom.window.document.getElementById("c").textContent;
    expect(vu, "une panne ne se deguise plus en categorie vide")
      .not.toContain("Aucun produit dans cette catégorie");
    expect(vu).toContain("indisponible");
    expect(ctx.appels(), "un appel entre, un appel sort").toBe(1);
  });

  it("TEMOIN NEGATIF : une reponse saine ne journalise RIEN", async () => {
    // Sans lui, « le diagnostic apparait » serait vrai par construction --
    // et c'est exactement ce qui est arrive au bouchon de
    // heurix-browse-langue.test.js, qui n'avait ni `ok` ni `status` et
    // recevait « HTTP undefined » sur des reponses justes.
    const ctx = chargerBrowse(() => ({ ok: true, status: 200, json: async () => reponse(2) }));
    await ctx.api.browse(BASE);
    expect(ctx.journal).toEqual([]);
  });

  it("une panne reseau est journalisee, et la promesse rejette comme avant", async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="c"></div></body></html>',
      { url: "http://localhost/" });
    global.window = dom.window;
    global.document = dom.window.document;
    const boum = async () => { throw new TypeError("Failed to fetch"); };
    global.fetch = boum; dom.window.fetch = boum;
    const journal = [];
    global.console = { ...console, warn: (m) => journal.push(String(m)), error: (m) => journal.push(String(m)) };
    dom.window.console.warn = global.console.warn;
    dom.window.console.error = global.console.error;
    dom.window.eval(SOURCE);
    const api = dom.window.Heurix ?? global.Heurix;
    await expect(api.browse(BASE)).rejects.toThrow(/Failed to fetch/);
    expect(journal.join(" ")).toMatch(/appel reseau echoue/);
  });
});

// ===========================================================================
describe("demo-boutique.js -- le message de panne ne promet plus l'autre widget", () => {
  it("il ne renvoie plus vers la recherche, qui tombe pour les memes causes", () => {
    // Les deux widgets partagent la clef, l'origine, le catalogue, le quota
    // et l'API : les cinq causes de panne les emportent ENSEMBLE. La phrase
    // retiree etait donc fausse dans le cas ORDINAIRE, et mesuree comme telle
    // le 6 septembre 2026 sur demo/index.html servi depuis localhost.
    //
    // LE BALAYAGE PORTE SUR LE CODE, PAS SUR LES COMMENTAIRES, et ce n'est
    // pas une precaution : la premiere version de ce test a ECHOUE sur le
    // commentaire de demo-boutique.js qui cite la phrase supprimee pour dire
    // qu'elle l'est. « Le correctif refait ce qu'il corrige » (CLAUDE.md) --
    // la zone la plus exposee a un motif est le texte qui le decrit, parce
    // qu'on y ecrit le motif fautif pour le montrer.
    const codeSeul = DEMO
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(codeSeul).not.toMatch(/recherche fonctionne/);
    expect(codeSeul).not.toMatch(/Search still works/);
    expect(codeSeul).not.toMatch(/essayez une référence/);
    // TEMOIN : le depouillement ne doit pas avoir emporte les chaines qu'on
    // interroge. Sans lui, « la phrase a disparu » et « tout a disparu » ont
    // la meme forme -- et le commentaire retire fait a lui seul 17 lignes.
    expect(codeSeul).toMatch(/catalogueKo:\s+"Catalogue momentanément indisponible\."/);
    expect(codeSeul).toMatch(/catalogueKo:\s+"Catalogue temporarily unavailable\."/);
  });

  it("TEMOIN : les deux messages de panne existent toujours, dans les deux langues", () => {
    // Sans lui, supprimer les deux clefs ferait passer le test ci-dessus --
    // « la phrase a disparu » et « le message a disparu » ont la meme forme.
    expect(DEMO).toContain('catalogueKo:  "Catalogue momentanément indisponible."');
    expect(DEMO).toContain('catalogueKo:  "Catalogue temporarily unavailable."');
  });
});
