import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// search-engine.js — chantier S4 (5 août 2026). search.js et search-en.js
// ne différaient que sur UNE ligne de vraie logique (le calcul du chemin
// relatif "root") au milieu de données légitimement différentes par langue.
// Extrait dans search-engine.js, avec un calcul de profondeur généralisé
// par comptage de segments plutôt que des motifs "/blog/" ou "/en/" codés
// en dur — correct à n'importe quelle profondeur, dans les deux langues,
// y compris des pages qui n'existent pas encore.
//
// Ce test compare le comportement observable (les liens produits pour une
// recherche donnée) à celui du code AVANT ce chantier, figé dans
// fixtures/search-avant-s4/ — pas une simple vérification de syntaxe.
// ---------------------------------------------------------------------------

function domAvecMoteur(scripts, url) {
  const html = `<!DOCTYPE html><html><body>
    <button id="heurix-search-btn"></button>
    <div id="heurix-search-modal"><div id="heurix-search-backdrop"></div>
      <input id="heurix-search-input">
      <div id="heurix-search-results"></div>
      <p id="heurix-search-empty" hidden></p>
      <p id="heurix-search-suggest-label" hidden></p>
    </div></body></html>`;
  const dom = new JSDOM(html, { url, runScripts: "outside-only" });
  for (const s of scripts) dom.window.eval(fs.readFileSync(s, "utf8"));
  // jsdom en mode "outside-only" ne déclenche jamais DOMContentLoaded tout
  // seul -- sans ce déclenchement manuel, init() n'est jamais appelée et
  // TOUS les résultats de ce fichier seraient un faux "aucun écart"
  // (aucun listener câblé, donc aucune interaction n'a d'effet du tout).
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true, cancelable: true }));
  return dom.window;
}

function chercher(win, q) {
  win.document.getElementById("heurix-search-btn").dispatchEvent(new win.Event("click"));
  const input = win.document.getElementById("heurix-search-input");
  input.value = q;
  input.dispatchEvent(new win.Event("input"));
  return Array.from(win.document.querySelectorAll(".search-result")).map((a) => a.getAttribute("href"));
}

const ANCIEN_FR = path.join(RACINE, "tests/fixtures/search-avant-s4/search.js");
const ANCIEN_EN = path.join(RACINE, "tests/fixtures/search-avant-s4/search-en.js");
// Correctif du 24 aout 2026. Le moteur ACTUEL est charge avec les
// DONNEES FIGEES, pas avec search.js. Sans cela, le test comparait deux
// systemes complets : tout article ajoute creait un ecart sans rapport
// avec la logique, et faisait echouer un test de non-regression du
// MOTEUR.
//
// Six articles publies etaient devenus introuvables par la recherche du
// site pour cette raison : l'etape qui les ajoute a search.js cassait ce
// test, sans moyen documente de le reparer.
//
// Desormais : memes donnees des deux cotes, seule la logique differe --
// ce que le test a toujours voulu mesurer.
const DONNEES_FIGEES_FR = path.join(RACINE, "tests/fixtures/search-avant-s4/donnees-figees.js");
const DONNEES_FIGEES_EN = path.join(RACINE, "tests/fixtures/search-avant-s4/donnees-figees-en.js");
const NOUVEAU_FR = [DONNEES_FIGEES_FR, path.join(RACINE, "search-engine.js")];
const NOUVEAU_EN = [DONNEES_FIGEES_EN, path.join(RACINE, "search-engine.js")];

describe("search-engine.js — non-régression FR", () => {
  it.each(["recherche", "algolia", "prestashop", "moteur natif", "custom rules", "xyz-inexistant-zzz"])(
    "« %s » renvoie les mêmes liens qu'avant le chantier S4",
    (q) => {
      const avant = chercher(domAvecMoteur([ANCIEN_FR], "https://heurix.fr/index.html"), q);
      const apres = chercher(domAvecMoteur(NOUVEAU_FR, "https://heurix.fr/index.html"), q);
      expect(apres).toEqual(avant);
    }
  );
});

describe("search-engine.js — non-régression EN", () => {
  it.each(["search", "algolia", "shopify", "vector search"])(
    "« %s » renvoie les mêmes liens qu'avant le chantier S4",
    (q) => {
      const avant = chercher(domAvecMoteur([ANCIEN_EN], "https://heurix.fr/en/index.html"), q);
      const apres = chercher(domAvecMoteur(NOUVEAU_EN, "https://heurix.fr/en/index.html"), q);
      expect(apres).toEqual(avant);
    }
  );
});

describe("search-engine.js — calcul du chemin relatif (root)", () => {
  it("racine FR : aucun préfixe", () => {
    const win = domAvecMoteur(NOUVEAU_FR, "https://heurix.fr/index.html");
    const [lien] = chercher(win, "recherche");
    expect(lien.startsWith("../")).toBe(false);
  });

  it("racine EN (un niveau) : même résultat qu'avant le chantier", () => {
    const avant = chercher(domAvecMoteur([ANCIEN_EN], "https://heurix.fr/en/index.html"), "algolia");
    const apres = chercher(domAvecMoteur(NOUVEAU_EN, "https://heurix.fr/en/index.html"), "algolia");
    expect(apres).toEqual(avant);
  });

  it("en/blog (deux niveaux) : même résultat qu'avant le chantier", () => {
    const avant = chercher(domAvecMoteur([ANCIEN_EN], "https://heurix.fr/en/blog/article.html"), "algolia");
    const apres = chercher(domAvecMoteur(NOUVEAU_EN, "https://heurix.fr/en/blog/article.html"), "algolia");
    expect(apres).toEqual(avant);
  });

  it("GAIN DE ROBUSTESSE : solutions/ en français calcule désormais un root correct — l'ancien code FR ne gérait que /blog/, ce cas aurait échoué silencieusement (liens cassés)", () => {
    const win = domAvecMoteur(NOUVEAU_FR, "https://heurix.fr/solutions/outillage.html");
    const [lien] = chercher(win, "recherche");
    expect(lien.startsWith("../")).toBe(true);
  });
});
