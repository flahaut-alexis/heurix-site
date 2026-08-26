import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-browse-widget.js"), "utf8");

const HITS = [
  { product: { id: "V1", name: "Vis M8", price: 12.5 }, in_stock: true },
  { product: { id: "V2", name: "Ecrou M8", price: 2 }, in_stock: false },
];

/* `lang: null` reproduit une page qui ne declare aucun attribut -- le
 * marchand qui a telecharge le fichier et n'a rien fait. C'est le cas qui
 * doit rester en francais.
 */
function charger({ lang = null, hits = HITS } = {}) {
  const attr = lang === null ? "" : ` lang="${lang}"`;
  const dom = new JSDOM(`<!doctype html><html${attr}><body><div id="cible"></div></body></html>`,
    { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.fetch = async () => ({ json: async () => ({ category: "visserie", total: hits.length, hits }) });
  global.fetch = dom.window.fetch;
  dom.window.eval(SOURCE);
  return dom.window;
}

async function parcourir(win, options = {}) {
  const api = win.Heurix ?? global.Heurix;
  await api.browse({ apiKey: "hxp_test", catalog: "f", category: "visserie", containerId: "cible", ...options });
  await new Promise((r) => setTimeout(r, 10));
  return win.document.getElementById("cible");
}

describe("heurix-browse-widget.js — langue", () => {
  it("sans attribut lang : francais, comme avant le chantier", async () => {
    const c = await parcourir(charger({ lang: null }));
    expect(c.textContent).toContain("Rupture de stock");
  });

  it('lang="en" : anglais, sans configuration du marchand', async () => {
    const c = await parcourir(charger({ lang: "en" }));
    expect(c.textContent).toContain("Out of stock");
    expect(c.textContent).not.toContain("Rupture");
  });

  it("l'option lang l'emporte sur l'attribut, dans les deux sens", async () => {
    expect((await parcourir(charger({ lang: "en" }), { lang: "fr" })).textContent).toContain("Rupture de stock");
    expect((await parcourir(charger({ lang: "fr" }), { lang: "en" })).textContent).toContain("Out of stock");
  });

  it("une langue non servie retombe sur le francais", async () => {
    expect((await parcourir(charger({ lang: "de" }))).textContent).toContain("Rupture de stock");
  });
});

describe("heurix-browse-widget.js — categorie vide", () => {
  it("FR par defaut, EN sur une page anglaise", async () => {
    expect((await parcourir(charger({ lang: null, hits: [] }))).textContent)
      .toBe("Aucun produit dans cette catégorie.");
    expect((await parcourir(charger({ lang: "en", hits: [] }))).textContent)
      .toBe("No products in this category.");
  });

  it("emptyMessage garde la main -- option deja publiee", async () => {
    const c = await parcourir(charger({ lang: "en", hits: [] }), { emptyMessage: "<p>Rayon vide</p>" });
    expect(c.textContent).toBe("Rayon vide");
  });
});

describe("heurix-browse-widget.js — format de prix", () => {
  it("le prix n'est plus brut : 12.5 devient 12,50 € et non « 12.5 € »", async () => {
    const c = await parcourir(charger({ lang: "fr" }));
    const prix = [...c.querySelectorAll(".heurix-price")].map((e) => e.textContent);
    expect(prix).toEqual(["12,50 €", "2 €"]);
    expect(c.textContent).not.toContain("12.5");
  });

  it("EN : point decimal, symbole devant", async () => {
    const c = await parcourir(charger({ lang: "en" }));
    expect([...c.querySelectorAll(".heurix-price")].map((e) => e.textContent)).toEqual(["€12.50", "€2"]);
  });
});

/* Array.prototype.map passe (element, index, TABLEAU). Brancher `lang` en
 * troisieme position sans intercepter l'appel aurait donne data.hits comme
 * langue -- et TEXTES[tableau] est undefined, donc un plantage a chaque
 * rendu. L'appel passe par une fonction explicite ; ces deux tests
 * verrouillent ce point precis.
 */
describe("heurix-browse-widget.js — le 3e argument de renderItem", () => {
  it("defaultRenderItem recoit une langue, pas le tableau des hits", async () => {
    const c = await parcourir(charger({ lang: "en" }));
    // si le tableau etait passe, TEXTES[tableau] planterait avant d'ecrire
    expect(c.querySelectorAll(".heurix-product")).toHaveLength(2);
    expect(c.textContent).toContain("Out of stock");
  });

  it("un renderItem fourni par le marchand recoit (hit, index, langue)", async () => {
    const vus = [];
    await parcourir(charger({ lang: "en" }), {
      renderItem: (h, i, l) => { vus.push([h.product.id, i, l]); return "<i></i>"; },
    });
    expect(vus).toEqual([["V1", 0, "en"], ["V2", 1, "en"]]);
  });
});
