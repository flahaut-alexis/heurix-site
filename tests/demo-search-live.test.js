import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// demo-search-live.js — chantier S4 (5 août 2026), troisième et dernière
// paire unifiée. demo-search-live.js/demo-search-live-en.js ne différaient
// PAS que par la traduction : la version EN avait perdu prixAvecRemise()
// (prix barré + pourcentage de réduction) en cours de route -- un visiteur
// anglophone ne voyait donc jamais un produit en promotion. Cette fusion
// restaure la fonctionnalité pour les deux langues, en plus d'unifier
// ~12 textes UI et deux formats de locale (monnaie, séparateur de milliers).
// ---------------------------------------------------------------------------

const REPONSE_AVEC_REMISE = {
  hits: [{
    product: { id: "P1", name: "Vis M8x20 inox", ref: "VIS-M8-20", price: 5.9, compare_at_price: 8.9, brand: "Racetools" },
    in_stock: true, matched: [],
  }],
  total: 42, facets: {},
};
const REPONSE_VIDE = { hits: [], total: 0 };

function construireHTML(lang) {
  return `<!DOCTYPE html><html lang="${lang}"><body>
    <div class="play">
      <div class="play-bar"><input class="play-input"></div>
      <div class="play-grid"></div>
      <div class="play-meta"></div>
      <button class="play-more" hidden></button>
      <div class="play-prisms"></div>
      <div class="play-vertical-pill play-vertical-on" data-vertical="outillage"></div>
      <div class="play-chips"></div>
      <div class="play-categories"></div>
    </div>
  </body></html>`;
}

function domAvecScript(lang, reponseFetch) {
  const dom = new JSDOM(construireHTML(lang), { url: "https://heurix.fr/", runScripts: "outside-only", pretendToBeVisual: true });
  const win = dom.window;
  win.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(reponseFetch) });
  win.eval(fs.readFileSync(path.join(RACINE, "demo-search-live.js"), "utf8"));
  return win;
}

async function chercher(win, q) {
  const input = win.document.querySelector(".play-input");
  input.value = q;
  input.dispatchEvent(new win.Event("input"));
  await new Promise((resolve) => setTimeout(resolve, 300));
}

function classesPrixStructurelles(html) {
  return (html.match(/class=(["'])play-card-price[a-z-]*\1/g) || []).join(",");
}

describe("demo-search-live.js — prix barré (bug corrigé, chantier S4)", () => {
  it("FR : affiche le prix barré et le pourcentage de réduction", async () => {
    const win = domAvecScript("fr", REPONSE_AVEC_REMISE);
    await chercher(win, "vis");
    const grille = win.document.querySelector(".play-grid").innerHTML;
    expect(grille).toContain("play-card-price-remise");
    expect(grille).toContain("play-card-price-barre");
    expect(grille).toContain("−34%");
  });

  it("EN : affiche AUSSI le prix barré — absent avant ce chantier (bug confirmé)", async () => {
    const win = domAvecScript("en", REPONSE_AVEC_REMISE);
    await chercher(win, "vis");
    const grille = win.document.querySelector(".play-grid").innerHTML;
    expect(grille).toContain("play-card-price-remise");
    expect(grille).toContain("play-card-price-barre");
  });

  it("FR et EN produisent la même structure de prix barré, seule la devise diffère", async () => {
    const winFr = domAvecScript("fr", REPONSE_AVEC_REMISE);
    await chercher(winFr, "vis");
    const winEn = domAvecScript("en", REPONSE_AVEC_REMISE);
    await chercher(winEn, "vis");
    const structFr = classesPrixStructurelles(winFr.document.querySelector(".play-grid").innerHTML);
    const structEn = classesPrixStructurelles(winEn.document.querySelector(".play-grid").innerHTML);
    expect(structFr).toBe(structEn);
    expect(structFr.length).toBeGreaterThan(0);
  });

  it("FR : devise avec virgule et espace avant €", async () => {
    const win = domAvecScript("fr", REPONSE_AVEC_REMISE);
    await chercher(win, "vis");
    expect(win.document.querySelector(".play-grid").innerHTML).toContain("5,90 €");
  });

  it("EN : devise avec point et € avant le montant", async () => {
    const win = domAvecScript("en", REPONSE_AVEC_REMISE);
    await chercher(win, "vis");
    expect(win.document.querySelector(".play-grid").innerHTML).toContain("€5.90");
  });
});

describe("demo-search-live.js — textes UI par langue", () => {
  it("FR : message d'absence de résultat en français", async () => {
    const win = domAvecScript("fr", REPONSE_VIDE);
    await chercher(win, "xyzintrouvable");
    expect(win.document.querySelector(".play-grid").innerHTML).toContain("Aucun résultat pour");
  });

  it("EN : message d'absence de résultat en anglais", async () => {
    const win = domAvecScript("en", REPONSE_VIDE);
    await chercher(win, "xyzintrouvable");
    expect(win.document.querySelector(".play-grid").innerHTML).toContain("No results for");
  });

  it("FR : statut de stock en français", async () => {
    const win = domAvecScript("fr", REPONSE_AVEC_REMISE);
    await chercher(win, "vis");
    expect(win.document.querySelector(".play-grid").innerHTML).toContain("En stock");
  });

  it("EN : statut de stock en anglais", async () => {
    const win = domAvecScript("en", REPONSE_AVEC_REMISE);
    await chercher(win, "vis");
    expect(win.document.querySelector(".play-grid").innerHTML).toContain("In stock");
  });
});
