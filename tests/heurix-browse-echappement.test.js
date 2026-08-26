import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const BROWSE = fs.readFileSync(path.join(RACINE, "downloads/heurix-browse-widget.js"), "utf8");
const SEARCH = fs.readFileSync(path.join(RACINE, "downloads/heurix-search.js"), "utf8");

/* heurix-browse-widget.js n'echappait RIEN : ni les noms, ni les
 * identifiants. La donnee vient de l'indexation du marchand, donc
 * quiconque peut y deposer un produit executait du script chez ses
 * visiteurs -- du XSS stocke, dans un fichier installe chez le client.
 *
 * Deux surfaces, deux protections : le nom est du texte, l'identifiant
 * est un attribut. esc() n'echappe PAS l'apostrophe, donc l'attribut est
 * double-quote. Les deux tests ci-dessous se separent pour cette raison.
 */
const CHARGE_TEXTE = "<img src=x onerror=\"window.__xss=1\">Vis M8";
const CHARGE_ATTRIBUT = "V1' onmouseover='window.__xss=1";
const CHARGE_ATTRIBUT_DOUBLE = 'V2" onfocus="window.__xss=1';

function rendre(hits) {
  const dom = new JSDOM('<!doctype html><html lang="fr"><body><div id="cible"></div></body></html>',
    { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.fetch = async () => ({ json: async () => ({ category: "c", total: hits.length, hits }) });
  global.fetch = dom.window.fetch;
  dom.window.eval(BROWSE);
  return (dom.window.Heurix ?? global.Heurix)
    .browse({ apiKey: "hxp_t", catalog: "f", category: "c", containerId: "cible" })
    .then(() => new Promise((r) => setTimeout(r, 10)))
    .then(() => dom.window);
}

describe("heurix-browse-widget.js — p.name est du texte", () => {
  it("un nom porteur de balisage ne cree aucun element", async () => {
    const win = await rendre([{ product: { id: "V1", name: CHARGE_TEXTE }, in_stock: true }]);
    expect(win.document.querySelectorAll("img")).toHaveLength(0);
    expect(win.__xss).toBeUndefined();
  });

  it("le nom reste lisible en entier, balisage compris, comme du texte", async () => {
    const win = await rendre([{ product: { id: "V1", name: CHARGE_TEXTE }, in_stock: true }]);
    expect(win.document.querySelector(".heurix-name").textContent).toBe(CHARGE_TEXTE);
  });

  it("une esperluette n'est pas doublement echappee a l'affichage", async () => {
    const win = await rendre([{ product: { id: "V1", name: "Vis M8 & ecrou" }, in_stock: true }]);
    expect(win.document.querySelector(".heurix-name").textContent).toBe("Vis M8 & ecrou");
  });
});

describe("heurix-browse-widget.js — p.id est un attribut", () => {
  it("une apostrophe dans l'identifiant ne sort pas de l'attribut", async () => {
    const win = await rendre([{ product: { id: CHARGE_ATTRIBUT, name: "Vis" }, in_stock: true }]);
    const el = win.document.querySelector(".heurix-product");
    expect(el.getAttribute("data-id")).toBe(CHARGE_ATTRIBUT);
    expect(el.hasAttribute("onmouseover")).toBe(false);
    expect(win.__xss).toBeUndefined();
  });

  it("un guillemet double non plus -- c'est celui que esc() neutralise", async () => {
    const win = await rendre([{ product: { id: CHARGE_ATTRIBUT_DOUBLE, name: "Vis" }, in_stock: true }]);
    const el = win.document.querySelector(".heurix-product");
    expect(el.getAttribute("data-id")).toBe(CHARGE_ATTRIBUT_DOUBLE);
    expect(el.hasAttribute("onfocus")).toBe(false);
  });

  it("l'attribut porteur de donnee est DOUBLE-quote -- esc() ne voit pas l'apostrophe", () => {
    expect(BROWSE).toContain('data-id="');
    expect(BROWSE).not.toContain("data-id='");
  });

  it("un identifiant absent ne produit pas la chaine \"undefined\"", async () => {
    const win = await rendre([{ product: { name: "Vis sans id" }, in_stock: true }]);
    expect(win.document.querySelector(".heurix-product").getAttribute("data-id")).toBe("");
  });
});

/* esc() est recopie et non partage : ces fichiers sont telecharges un par
 * un et heberges chez le marchand, donc chacun doit tenir seul. Le prix
 * de la recopie est la derive, et c'est ce test qui la paie.
 */
describe("les deux widgets portent la MEME fonction esc()", () => {
  const extraire = (src) => {
    const d = src.indexOf("  function esc(s) {");
    return src.slice(d, src.indexOf("\n  }\n", d) + 5);
  };

  it("octet pour octet, sans variante", () => {
    expect(extraire(BROWSE)).toBe(extraire(SEARCH));
    expect(extraire(SEARCH)).toContain('replace(/"/g, "&quot;")');
  });

  it("aucune des deux n'echappe l'apostrophe -- d'ou la regle du double-quote", () => {
    expect(extraire(SEARCH)).not.toContain("&#39;");
    expect(extraire(SEARCH)).not.toContain("&apos;");
  });
});
