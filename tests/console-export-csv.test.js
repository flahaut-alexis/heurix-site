import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// console.js — export CSV des tableaux Observer (16 aout 2026, chantier
// audit console). Meme principe que console.test.js : IIFE sans fonction
// exposee, donc on teste le CONTRAT OBSERVABLE (le contenu genere passe a
// Blob au clic sur le bouton), pas exporterTableauCSV() directement.
//
// jsdom ne materialise pas de vrai telechargement -- on intercepte
// window.Blob pour capturer le contenu exact que le code de production
// lui passerait vraiment, sans reimplementer la logique du test.
// ---------------------------------------------------------------------------

function chargerConsoleAvecBlobIntercepte() {
  const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/console.html", runScripts: "outside-only" });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  window.Element.prototype.scrollIntoView = () => {};
  global.fetch = async () => ({ ok: true, json: async () => ({}) });
  window.fetch = global.fetch;

  const blobsCaptures = [];
  window.Blob = function (parts, options) {
    blobsCaptures.push({ contenu: parts.join(""), type: options && options.type });
    return {};
  };
  window.URL.createObjectURL = () => "blob:test-url";
  window.URL.revokeObjectURL = () => {};

  const i18n = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");
  window.eval(i18n);
  const source = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
  window.eval(source);

  return { dom, window, document: window.document, blobsCaptures };
}

function cliquerExport(document, tableId) {
  const btn = document.querySelector(`[data-export-table="${tableId}"]`);
  btn.dispatchEvent(new window.Event("click"));
}

describe("console.js — export CSV des tableaux Observer", () => {
  let window, document, blobsCaptures;

  beforeEach(() => {
    ({ window, document, blobsCaptures } = chargerConsoleAvecBlobIntercepte());
  });

  it("exporte les en-têtes et les lignes d'un tableau simple", () => {
    const table = document.getElementById("top-queries-table");
    table.querySelector("tbody").innerHTML =
      "<tr><td>vis m8</td><td class='num'>42</td><td>3.2</td></tr>" +
      "<tr><td>perceuse</td><td class='num'>18</td><td>0</td></tr>";

    cliquerExport(document, "top-queries-table");

    expect(blobsCaptures).toHaveLength(1);
    const csv = blobsCaptures[0].contenu.replace("\uFEFF", "");
    expect(csv).toBe(
      "Requête,Nb,Résultats (moy.)\r\n" +
      "vis m8,42,3.2\r\n" +
      "perceuse,18,0"
    );
  });

  it("échappe une valeur contenant une virgule", () => {
    const table = document.getElementById("top-queries-table");
    table.querySelector("tbody").innerHTML =
      "<tr><td>vis, écrou et boulon</td><td class='num'>5</td><td>1</td></tr>";

    cliquerExport(document, "top-queries-table");

    const csv = blobsCaptures[0].contenu.replace("\uFEFF", "");
    expect(csv).toContain('"vis, écrou et boulon",5,1');
  });

  it("échappe une valeur contenant des guillemets", () => {
    const table = document.getElementById("top-queries-table");
    table.querySelector("tbody").innerHTML =
      '<tr><td>vis 8" inox</td><td class=\'num\'>3</td><td>0</td></tr>';

    cliquerExport(document, "top-queries-table");

    const csv = blobsCaptures[0].contenu.replace("\uFEFF", "");
    expect(csv).toContain('"vis 8"" inox",3,0');
  });

  it("retire le bouton Corriger du contenu exporté sur Sans résultat", () => {
    const table = document.getElementById("zero-results-table");
    table.querySelector("tbody").innerHTML =
      "<tr><td>imperméable</td><td class='num'>12</td>" +
      "<td class='zr-action-cell'><button type='button' class='zr-suggerer'>Corriger</button>" +
      "<span class='zr-suggestions' hidden></span></td></tr>";

    cliquerExport(document, "zero-results-table");

    const csv = blobsCaptures[0].contenu.replace("\uFEFF", "");
    const ligneDonnees = csv.split("\r\n")[1];
    expect(ligneDonnees).not.toContain("Corriger");
    expect(ligneDonnees).toBe("imperméable,12,");
  });

  it("le nom de fichier proposé contient la date du jour", () => {
    let nomIntercepte = null;
    const a = document.createElement("a");
    const clickOriginal = a.click.bind(a);
    const createElementOriginal = document.createElement.bind(document);
    document.createElement = function (tag) {
      const el = createElementOriginal(tag);
      if (tag === "a") {
        const setDownload = Object.getOwnPropertyDescriptor(el, "download");
        Object.defineProperty(el, "download", {
          set(v) { nomIntercepte = v; },
          get() { return nomIntercepte; },
        });
      }
      return el;
    };

    const table = document.getElementById("top-queries-table");
    table.querySelector("tbody").innerHTML = "<tr><td>x</td><td class='num'>1</td><td>1</td></tr>";
    cliquerExport(document, "top-queries-table");

    const aujourdHui = new Date().toISOString().slice(0, 10);
    expect(nomIntercepte).toBe(`recherches-populaires-${aujourdHui}.csv`);
  });

  it("un tableau vide exporte seulement les en-têtes, sans planter", () => {
    expect(() => cliquerExport(document, "errors-table")).not.toThrow();
    const csv = blobsCaptures[0].contenu.replace("\uFEFF", "");
    expect(csv).toBe("Ce qui s'est passé,Quand");
  });
});
