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

  it("attribue un identifiant visiteur persistant et le reutilise", async () => {
    const ctx = chargerTracker();
    const api = ctx.window.Heurix ?? global.Heurix;

    api.trackClick("vis", "V001");
    api.trackClick("ecrou", "E001");
    await new Promise((r) => setTimeout(r, 20));

    const ids = ctx.appels.map((a) => a.corps.visitor_id);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).toBe(ids[1]); // meme visiteur = meme identifiant
    expect(ctx.window.localStorage.getItem("heurix_visitor_id")).toBe(ids[0]);
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
