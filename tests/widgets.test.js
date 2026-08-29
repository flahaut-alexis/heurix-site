import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

function domNeuf(html = "<div id='cible'></div>") {
  const dom = new JSDOM(html, { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Element.prototype.scrollIntoView = () => {};
  return dom;
}

function moqueFetch(reponse = { hits: [], total: 0 }) {
  const appels = [];
  global.fetch = async (url, opts) => {
    appels.push({ url, opts, corps: opts?.body ? JSON.parse(opts.body) : null });
    return { ok: true, json: async () => reponse };
  };
  return appels;
}

// ---------------------------------------------------------------------------
// heurix-tracker.js — jamais teste avant ce chantier, alors qu'il est pose
// site-wide chez les clients et decide de la fiabilite des donnees de
// conversion (donc du chiffre affiche dans leur console).
// ---------------------------------------------------------------------------
describe("heurix-tracker.js", () => {
  const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-tracker.js"), "utf8");

  function chargerTracker(cle = "hxp_test") {
    const dom = domNeuf();
    const appels = moqueFetch({ logged: 1 });
    const src = SOURCE
      .replace(/var HEURIX_API_KEY = "[^"]*";/, `var HEURIX_API_KEY = "${cle}";`)
      .replace(/var HEURIX_CATALOG = "[^"]*";/, 'var HEURIX_CATALOG = "fixtures";');
    dom.window.eval(src);
    return { dom, window: dom.window, appels };
  }

  it("expose les fonctions de suivi attendues", () => {
    const ctx = chargerTracker();
    const api = ctx.window.Heurix ?? global.Heurix;
    expect(typeof api.trackClick).toBe("function");
    expect(typeof api.trackPurchase).toBe("function");
  });

  it("envoie un clic avec le type d'evenement et les champs requis par l'API", async () => {
    const ctx = chargerTracker();
    const api = ctx.window.Heurix ?? global.Heurix;
    api.trackClick("vis m8", "V001");
    await new Promise((r) => setTimeout(r, 20));

    const appel = ctx.appels.at(-1);
    expect(appel.url).toContain("/v1/events");
    // Le moteur refuse un search_click sans query ni product_id (422)
    expect(appel.corps.event_type).toBe("search_click");
    expect(appel.corps.query).toBe("vis m8");
    expect(appel.corps.product_id).toBe("V001");
    expect(appel.corps.catalog).toBe("fixtures");
  });

  it("envoie un achat avec une liste de produits, pas un produit isole", async () => {
    // Le moteur attend `products: [...]` et renvoie 422 si la liste est
    // absente ou vide -- forme verifiee cote engine (ingest_event).
    const ctx = chargerTracker();
    const api = ctx.window.Heurix ?? global.Heurix;
    api.trackPurchase([{ id: "V001", amount: 5.9, margin: 2.1 }]);
    await new Promise((r) => setTimeout(r, 20));

    const appel = ctx.appels.at(-1);
    expect(appel.corps.event_type).toBe("purchase");
    expect(Array.isArray(appel.corps.products)).toBe(true);
    expect(appel.corps.products[0].id).toBe("V001");
  });

  it("attribue un identifiant coherent en memoire, sans consentement (comportement sur par defaut, 3 aout)", async () => {
    const ctx = chargerTracker();
    const api = ctx.window.Heurix ?? global.Heurix;

    api.trackClick("vis", "V001");
    api.trackClick("ecrou", "E001");
    await new Promise((r) => setTimeout(r, 20));

    const ids = ctx.appels.map((a) => a.corps.visitor_id);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).toBe(ids[1]); // meme visiteur = meme identifiant, meme sans consentement
    // Sans consentement, RIEN n'est depose -- coeur du correctif RGPD/ePrivacy.
    expect(ctx.window.localStorage.getItem("heurix_visitor_id")).toBeNull();
  });

  it("persiste l'identifiant dans localStorage seulement apres grantConsent() (3 aout)", async () => {
    const ctx = chargerTracker();
    const api = ctx.window.Heurix ?? global.Heurix;

    api.trackClick("vis", "V001");
    await new Promise((r) => setTimeout(r, 20));
    expect(ctx.window.localStorage.getItem("heurix_visitor_id")).toBeNull();

    api.grantConsent();
    const idApresConsentement = ctx.window.localStorage.getItem("heurix_visitor_id");
    expect(idApresConsentement).toBeTruthy();
    expect(idApresConsentement).toBe(api.visitorId);

    // Idempotent : un second appel ne doit rien changer.
    api.grantConsent();
    expect(ctx.window.localStorage.getItem("heurix_visitor_id")).toBe(idApresConsentement);
  });

  it("alerte si une cle SERVEUR est posee cote navigateur (chantier C1)", () => {
    const alertes = [];
    global.console.warn = (m) => alertes.push(m);
    chargerTracker("hx_cle_serveur");
    expect(alertes.join(" ")).toMatch(/SERVEUR/i);
  });

  it("n'alerte pas pour une cle publique", () => {
    const alertes = [];
    global.console.warn = (m) => alertes.push(m);
    chargerTracker("hxp_cle_publique");
    expect(alertes.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// heurix-browse-widget.js
// ---------------------------------------------------------------------------
describe("heurix-browse-widget.js", () => {
  const SOURCE = fs.readFileSync(
    path.join(RACINE, "downloads/heurix-browse-widget.js"),
    "utf8"
  );

  function chargerBrowse(reponse) {
    const dom = domNeuf();
    const appels = moqueFetch(
      reponse ?? {
        category: "visserie",
        total: 1,
        hits: [{ product: { id: "V001", name: "Vis M8" }, in_stock: true }],
      }
    );
    dom.window.eval(SOURCE);
    return { dom, window: dom.window, appels };
  }

  it("appelle l'endpoint browse avec le catalogue et la categorie dans l'URL", async () => {
    const ctx = chargerBrowse();
    const api = ctx.window.Heurix ?? global.Heurix;
    api.browse({
      apiKey: "hxp_test",
      catalog: "fixtures",
      category: "visserie",
      containerId: "cible",
    });
    await new Promise((r) => setTimeout(r, 30));

    const appel = ctx.appels.at(-1);
    expect(appel.url).toContain("/v1/browse/fixtures/visserie");
    expect(appel.opts.headers.Authorization).toBe("Bearer hxp_test");
  });

  it("transmet le tri demande en parametre de requete", async () => {
    const ctx = chargerBrowse();
    const api = ctx.window.Heurix ?? global.Heurix;
    api.browse({
      apiKey: "hxp_test",
      catalog: "fixtures",
      category: "visserie",
      sort: "price_asc",
      containerId: "cible",
    });
    await new Promise((r) => setTimeout(r, 30));

    expect(ctx.appels.at(-1).url).toContain("sort=price_asc");
  });

  it("alerte si une cle SERVEUR est utilisee (chantier C1)", async () => {
    const alertes = [];
    global.console.warn = (m) => alertes.push(m);
    const ctx = chargerBrowse();
    const api = ctx.window.Heurix ?? global.Heurix;
    api.browse({
      apiKey: "hx_cle_serveur",
      catalog: "fixtures",
      category: "visserie",
      containerId: "cible",
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(alertes.join(" ")).toMatch(/SERVEUR/i);
  });
});

// ---------------------------------------------------------------------------
// Suggestions de synonymes depuis les recherches sans resultat (30 juillet).
//
// console.js est une IIFE avec session : on ne l'execute pas ici. On verrouille
// le CONTRAT entre les morceaux — c'est precisement la ou une regression
// s'est produite pendant le chantier (en-tete a 2 colonnes, lignes a 3).
// ---------------------------------------------------------------------------
describe("suggestions de synonymes (contrat console)", () => {
  const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
  const js = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");

  it("l'en-tete du tableau sans-resultat a autant de colonnes que les lignes", () => {
    const thead = html.match(/id="zero-results-table">\s*<thead><tr>(.*?)<\/tr>/s)[1];
    const nbTh = (thead.match(/<th>/g) || []).length;
    // Le rendu des lignes emet 3 cellules : requete, compte, action.
    expect(nbTh).toBe(3);
    expect(thead).toContain("Corriger");
  });

  it("le rendu des lignes emet le bouton et la zone de suggestions", () => {
    const bloc = js.match(/renderTable\("zero-results-table"[\s\S]{0,900}/)[0];
    expect(bloc).toContain("zr-suggerer");
    expect(bloc).toContain("zr-suggestions");
    expect(bloc).toContain("zr-action-cell");
  });

  it("le cablage est appele apres le rendu, et une seule fois par table", () => {
    expect(js).toContain("wireSuggestionsSynonymes(key)");
    // Garde anti-double-cablage : sans elle, chaque rafraichissement des
    // analytics empilerait un ecouteur de clic de plus.
    expect(js).toContain('dataset.zrWired');
  });

  it("la creation lit puis renvoie la liste entiere — jamais un PUT aveugle", () => {
    const fn = js.match(/function creerSynonyme[\s\S]{0,900}/)[0];
    // Le PUT remplace tout : un PUT sans GET prealable effacerait les
    // synonymes existants du marchand.
    expect(fn.indexOf("synonyms")).toBeGreaterThan(-1);
    expect(fn).toContain("groupes.push([de, vers])");
    expect(fn).toContain('method: "PUT"');
  });

  it("les classes de style existent dans la feuille", () => {
    const css = fs.readFileSync(path.join(RACINE, "styles.css"), "utf8");
    for (const cl of [".zr-suggerer", ".zr-suggestions", ".zr-choix", ".zr-fait"]) {
      expect(css).toContain(cl);
    }
  });
});

// ---------------------------------------------------------------------------
// demo-search-live.js — le defaut du 30 juillet au soir.
//
// `chrono` etait declare DANS chercher() mais lu dans afficher() : une
// ReferenceError a chaque affichage, attrapee par le .catch reseau, qui
// montrait « Demonstration momentanement indisponible » sur toutes les
// verticales. Le message d'honnetete concu pour les pannes masquait un
// defaut de code.
//
// Ce test lit le TEXTE de meta — c'est ce que mon test precedent ne
// faisait pas, et pourquoi le defaut est passe.
// ---------------------------------------------------------------------------
describe("demo-search-live.js", () => {
  it("affiche les resultats ET le temps mesure, sans message d'indisponibilite", async () => {
    const dom = domNeuf(`<div class="demo play">
      <button class="play-vertical-pill play-vertical-on" data-vertical="outillage">O</button>
      <input class="play-input"><div class="play-chips"></div>
      <div class="play-grid"></div><div class="play-meta"></div><div class="play-prisms"></div>
    </div>`);
    const w = dom.window;
    w.fetch = global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({
      total: 42, hits: [{ product: { id: "P1", name: "Vis M8x20", ref: "V-820" }, in_stock: true, matched: [] }], facets: {} }) });
    w.eval(fs.readFileSync(path.join(RACINE, "demo-search-live.js"), "utf8"));
    const input = w.document.querySelector(".play-input");
    input.value = "vis";
    input.dispatchEvent(new w.Event("input"));
    await new Promise((r) => setTimeout(r, 400));

    expect(w.document.querySelectorAll(".play-card").length).toBe(1);
    expect(w.document.querySelector(".play-grid").innerHTML).not.toContain("indisponible");
    expect(w.document.querySelector(".play-meta").textContent).toMatch(/42.résultats/);
  });
});

// ---------------------------------------------------------------------------
// Badge de temps de reponse (.play-meta-speed) — 30 juillet, soir.
// Le nombre de resultats et le temps deviennent deux elements distincts,
// avec une pastille pour le second et une animation de comptage.
// ---------------------------------------------------------------------------
describe("badge de temps de reponse", () => {
  it("separe le compte et le temps en deux elements, sans statistique inventee", async () => {
    const dom = domNeuf(`<div class="demo play">
      <button class="play-vertical-pill play-vertical-on" data-vertical="outillage">O</button>
      <input class="play-input"><div class="play-chips"></div>
      <p class="play-meta"></p>
      <div class="play-prisms"></div><div class="play-grid"></div>
    </div>`);
    const w = dom.window;
    w.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
    w.fetch = global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({
      total: 2721, hits: [{ product: { id: "P1", name: "Vis M8x20", ref: "V-820" }, in_stock: true, matched: [] }], facets: {} }) });
    w.eval(fs.readFileSync(path.join(RACINE, "demo-search-live.js"), "utf8"));
    const input = w.document.querySelector(".play-input");
    input.value = "vis";
    input.dispatchEvent(new w.Event("input"));
    await new Promise((r) => setTimeout(r, 400));

    const meta = w.document.querySelector(".play-meta");
    expect(meta.querySelector(".play-meta-count").textContent).toMatch(/2.721/);
    const badge = meta.querySelector(".play-meta-speed");
    expect(badge).toBeTruthy();
    const msEl = badge.querySelector(".play-meta-ms");
    const cible = msEl.getAttribute("data-cible");
    expect(Number(cible)).toBeGreaterThan(0);

    // AUCUNE STATISTIQUE INVENTEE : ni pourcentage, ni comparaison a des
    // concurrents non mesures.
    expect(meta.innerHTML).not.toMatch(/%/);
    expect(meta.innerHTML.toLowerCase()).not.toContain("moteurs");

    // L'animation converge vers la valeur EXACTE mesuree, pas une valeur
    // arbitraire — c'est un habillage, pas une invention.
    await new Promise((r) => setTimeout(r, 500));
    expect(msEl.textContent).toBe(cible);
  });

  it("respecte prefers-reduced-motion : pas d'animation, valeur directe", async () => {
    const dom = domNeuf(`<div class="demo play">
      <button class="play-vertical-pill play-vertical-on" data-vertical="outillage">O</button>
      <input class="play-input"><div class="play-chips"></div>
      <p class="play-meta"></p>
      <div class="play-prisms"></div><div class="play-grid"></div>
    </div>`);
    const w = dom.window;
    w.matchMedia = () => ({ matches: true });
    w.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
    w.fetch = global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({
      total: 10, hits: [{ product: { id: "P1", name: "Vis M8x20", ref: "V-820" }, in_stock: true, matched: [] }], facets: {} }) });
    w.eval(fs.readFileSync(path.join(RACINE, "demo-search-live.js"), "utf8"));
    const input = w.document.querySelector(".play-input");
    input.value = "vis";
    input.dispatchEvent(new w.Event("input"));
    await new Promise((r) => setTimeout(r, 400));
    const msEl = w.document.querySelector(".play-meta-ms");
    // Ecrite directement : pas de valeur de depart differente en transit.
    expect(msEl.textContent).toBe(msEl.getAttribute("data-cible"));
  });
});

// ---------------------------------------------------------------------------
// Renvoi actionnable quand aucune suggestion n'est trouvee (30 juillet, soir).
// Le message "Aucun mot proche..." pointait vers Personnalisation -> Search
// SANS lien ni pre-remplissage : le marchand devait retrouver l'ecran seul
// puis retaper le terme. Verrouille le contrat entre les deux morceaux.
// ---------------------------------------------------------------------------
describe("renvoi vers les synonymes depuis Sans resultat", () => {
  const js = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");

  it("le cas sans candidat pose un vrai lien avec le terme en donnee", () => {
    const bloc = js.match(/if \(!candidats\.length\) \{[\s\S]{0,1400}/)[0];
    expect(bloc).toContain("data-goto-pane='pane-search-overrides'");
    expect(bloc).toContain("data-prefill=");
    expect(bloc).toContain("zr-vers-synonymes");
    // Le terme recherche doit voyager jusqu'au bouton, pas seulement
    // apparaitre dans la phrase.
    //
    // escAttr ET NON esc DEPUIS LE 29 AOUT 2026. `data-prefill` est un
    // attribut entre guillemets SIMPLES : `esc()` n'echappe pas
    // l'apostrophe, donc un terme comme « L'Ecrou » y etait tronque et
    // posait un attribut parasite -- verifie dans un vrai navigateur, et
    // une charge « x' onmouseover='... » y posait un gestionnaire qui
    // s'executait. Le nom de la fonction est verrouille ici parce que
    // c'est lui qui porte la propriete : revenir a `esc()` reintroduirait
    // le defaut sans qu'aucun autre test ne le voie.
    expect(bloc).toContain("escAttr(terme)");
  });

  it("le gestionnaire data-goto-pane sait pre-remplir le champ synonyme", () => {
    // ANCRE SUR LE GESTIONNAIRE VISE, pas sur le premier du fichier
    // (25 aout 2026). La version precedente prenait le PREMIER
    // `document.addEventListener("click"` rencontre puis 4 200 caracteres.
    // Deux fragilites : tout gestionnaire ajoute plus haut dans le fichier
    // decalait l'ancre, et le motif etait cherche dans le texte BRUT --
    // un COMMENTAIRE citant cette ligne suffisait a faire echouer le test.
    // C'est exactement ce qui est arrive en posant le registre de fermeture
    // au clic exterieur, dont le commentaire recopie le motif d'origine.
    // On part desormais du `closest(...)` propre a CE gestionnaire : le
    // simple marqueur `[data-goto-pane]` ne suffit pas, il apparait aussi
    // plus haut dans le HTML genere, ce qui ramenait l'ancre trop en amont.
    const cible = js.indexOf('closest("[data-goto-pane]")');
    const bloc = js.slice(js.lastIndexOf('document.addEventListener("click"', cible), cible + 4200);
    expect(bloc).toContain('link.getAttribute("data-prefill")');
    expect(bloc).toContain(".catalog-synonym-input");
    expect(bloc).toContain("champ.focus()");
    // Le bloc so-content doit etre force visible : ne pas dependre du
    // mecanisme existant, dont les conditions peuvent ne pas etre reunies.
    expect(bloc).toContain('getElementById("so-content")');
    expect(bloc).toContain("contenuSo.hidden = false");
    // Sondage de l'apparition du champ, pas un delai fixe unique.
    expect(bloc).toContain("attendreEtRemplir");
    // Le curseur doit se placer APRES le texte injecte, jamais avant.
    expect(bloc).toContain("setSelectionRange");
  });

  it("le style rend le lien visuellement cliquable, pas de la prose", () => {
    const css = fs.readFileSync(path.join(RACINE, "styles.css"), "utf8");
    expect(css).toContain(".zr-vers-synonymes");
    expect(css).toMatch(/\.zr-vers-synonymes\{[^}]*cursor:pointer/);
  });
});

// ---------------------------------------------------------------------------
// Chantier "score d'intention" (7 aout 2026) -- heurix-search.js transmet
// visitor_id quand heurix-tracker.js est charge sur la meme page. A revele
// au passage un bug preexistant (window.Heurix reaffecte en entier par le
// tracker, effacant searchBox si le widget chargeait en premier) : les
// deux scripts communiquant vraiment pour la premiere fois ici, ce test
// protege LES DEUX -- le nouveau comportement ET la correction du bug.
//
// runScripts: "dangerously" + de vrais <script> injectes dans le DOM,
// PAS window.eval() : le pattern UMD des deux fichiers repose sur
// `typeof self !== "undefined" ? self : this`, qui ne resout pas vers
// window depuis un eval() JSDOM -- fidele a un vrai navigateur ici,
// contrairement a l'approche eval() utilisee ailleurs dans ce fichier.
// ---------------------------------------------------------------------------
describe("heurix-search.js + heurix-tracker.js — chantier score d'intention", () => {
  async function chargerLesDeux(ordre) {
    const dom = new JSDOM("<div id='cible'></div>", {
      url: "http://localhost/", runScripts: "dangerously", resources: "usable",
    });
    const { window } = dom;
    const appels = [];
    window.fetch = async (url, opts) => {
      appels.push({ url: String(url), corps: opts && opts.body ? JSON.parse(opts.body) : null });
      return { ok: true, json: async () => ({ hits: [], total: 0 }) };
    };
    for (const fichier of ordre) {
      const script = window.document.createElement("script");
      script.textContent = fs.readFileSync(path.join(RACINE, fichier), "utf8");
      window.document.body.appendChild(script);
    }
    await new Promise((r) => setTimeout(r, 20));
    return { window, appels };
  }

  it("BUG CORRIGE : le tracker ne doit plus ecraser window.Heurix.searchBox, peu importe l'ordre de chargement", async () => {
    const { window: w1 } = await chargerLesDeux(["downloads/heurix-search.js", "downloads/heurix-tracker.js"]);
    expect(typeof w1.Heurix.searchBox).toBe("function");
    expect(typeof w1.Heurix.visitorId).toBe("string");

    const { window: w2 } = await chargerLesDeux(["downloads/heurix-tracker.js", "downloads/heurix-search.js"]);
    expect(typeof w2.Heurix.searchBox).toBe("function");
    expect(typeof w2.Heurix.visitorId).toBe("string");
  });

  it("une recherche transmet automatiquement visitor_id quand le tracker est charge", async () => {
    const { window, appels } = await chargerLesDeux(["downloads/heurix-tracker.js", "downloads/heurix-search.js"]);
    window.Heurix.searchBox({ apiKey: "hxp_test", catalog: "demo", containerId: "cible" });
    const idAttendu = window.Heurix.visitorId;

    const input = window.document.querySelector(".hx-search-input");
    input.value = "vis m8";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));

    const appelRecherche = appels.find((a) => a.url.includes("/search"));
    expect(appelRecherche).toBeTruthy();
    expect(appelRecherche.corps.visitor_id).toBe(idAttendu);
  });

  it("sans tracker charge, la recherche continue de fonctionner exactement comme avant -- pas de visitor_id, pas d'erreur", async () => {
    const { window, appels } = await chargerLesDeux(["downloads/heurix-search.js"]);
    window.Heurix.searchBox({ apiKey: "hxp_test", catalog: "demo", containerId: "cible" });

    const input = window.document.querySelector(".hx-search-input");
    input.value = "vis m8";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));

    const appelRecherche = appels.find((a) => a.url.includes("/search"));
    expect(appelRecherche).toBeTruthy();
    expect(appelRecherche.corps.visitor_id).toBeUndefined();
    expect(appelRecherche.corps.q).toBe("vis m8"); // le reste du corps est intact
  });
});
