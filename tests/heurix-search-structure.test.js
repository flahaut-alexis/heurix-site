import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-search.js"), "utf8");

/* La ligne de resultat doit etre UNE option, prix compris.
 *
 * Une balise fermante orpheline dans defaultRenderItem faisait sortir
 * .hx-search-hit-meta de .hx-search-hit : le prix devenait le FRERE de
 * l'option au lieu d'en etre l'enfant. Present depuis 4cf41043 (24 juillet
 * 2026), invisible a tous les tests, parce qu'aucun ne regardait la
 * PARENTE des elements -- seulement leur presence dans le panneau.
 */
const REPONSE = {
  query: "vis",
  total: 2,
  hits: [
    { product: { id: "V1", name: "Vis TP M10x35 inox A4", ref: "VIS-10-35", price: 12.34 }, score: 2, in_stock: true },
    { product: { id: "V2", name: "Vis bombee M10x120 A2", ref: "VIS-10-120", price: 2.7 }, score: 1, in_stock: false },
  ],
};

function charger(config = {}) {
  const dom = new JSDOM('<!doctype html><html lang="fr"><body><div id="cible"></div></body></html>',
    { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Element.prototype.scrollIntoView = () => {};
  global.fetch = async () => ({ ok: true, json: async () => REPONSE });
  dom.window.eval(SOURCE);
  global.Heurix.searchBox({
    apiKey: "hxp_test", catalog: "fixtures", containerId: "cible", debounceMs: 1, ...config,
  });
  return dom.window;
}

async function chercher(win) {
  const input = win.document.querySelector(".hx-search-input");
  input.value = "vis";
  input.dispatchEvent(new win.Event("input"));
  await new Promise((r) => setTimeout(r, 40));
  return win;
}

describe("heurix-search.js — le prix appartient a l'option", () => {
  it("l'element role=option CONTIENT le prix", async () => {
    const win = await chercher(charger());
    const option = win.document.querySelector('[role="option"]');
    const prix = win.document.querySelector(".hx-search-hit-meta");
    expect(option).not.toBeNull();
    expect(prix).not.toBeNull();
    expect(option.contains(prix)).toBe(true);
    expect(option.textContent).toContain("12,34 €");
  });

  // Avec resultHref la ligne est un <a>, et le parsing de fragment
  // ignorait la fermeture surnumeraire : cette configuration-la n'avait
  // pas le defaut. Le test ne mord donc pas dessus -- il garde l'acquis.
  it("avec resultHref -- balise <a> -- le prix reste dans l'option", async () => {
    const win = await chercher(charger({ resultHref: (h) => "/p/" + h.product.id }));
    const option = win.document.querySelector('[role="option"]');
    expect(option.tagName).toBe("A");
    expect(option.contains(win.document.querySelector(".hx-search-hit-meta"))).toBe(true);
  });

  it("chaque prix est dans SON option, pas dans celle d'a cote", async () => {
    const win = await chercher(charger());
    const options = [...win.document.querySelectorAll('[role="option"]')];
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toContain("12,34 €");
    expect(options[0].textContent).not.toContain("2,70 €");
    expect(options[1].textContent).toContain("2,70 €");
  });

  it("la ligne a exactement deux enfants : le bloc texte et le bloc meta", async () => {
    const win = await chercher(charger());
    const enfants = [...win.document.querySelector(".hx-search-hit").children].map((c) => c.className);
    expect(enfants).toEqual(["hx-search-hit-texte", "hx-search-hit-meta"]);
  });

  it("aucun .hx-search-hit-meta n'est laisse a la racine du panneau", async () => {
    const win = await chercher(charger());
    const orphelins = [...win.document.querySelectorAll(".hx-search-panel > .hx-search-hit-meta")];
    expect(orphelins).toHaveLength(0);
  });
});

describe("heurix-search.js — cliquer le prix selectionne le produit", () => {
  it("un clic SUR LE PRIX declenche onSelect avec le bon produit", async () => {
    const choisis = [];
    const win = await chercher(charger({ onSelect: (h) => choisis.push(h.product.id) }));
    const prix = win.document.querySelectorAll(".hx-search-hit-meta")[1];
    prix.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(choisis).toEqual(["V2"]);
  });

  it("un clic sur le nom continue de fonctionner -- pas de regression", async () => {
    const choisis = [];
    const win = await chercher(charger({ onSelect: (h) => choisis.push(h.product.id) }));
    win.document.querySelector(".hx-search-hit-name")
      .dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(choisis).toEqual(["V1"]);
  });

  it("le statut de stock, dans le meme bloc, est cliquable lui aussi", async () => {
    const choisis = [];
    const win = await chercher(charger({ onSelect: (h) => choisis.push(h.product.id) }));
    win.document.querySelector(".hx-search-hit-oos")
      .dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    expect(choisis).toEqual(["V2"]);
  });
});
