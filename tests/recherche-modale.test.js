import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// VINGT PAGES SUR 118 ONT SERVI UN BOUTON DE RECHERCHE INERTE (26 aout 2026).
// Elles affichaient « Heurix Search » et le raccourci Ctrl+K, chargeaient
// l'index (68 entrees) et search-engine.js -- et n'avaient pas le
// <div id="heurix-search-modal"> que ce script cherche. Le clic ne faisait
// rien. Sur le site d'un editeur de moteur de recherche.
//
// Personne ne l'a vu pendant un mois parce que le bouton EST la : une
// verification qui regarde le rendu voit un en-tete complet. Il fallait
// cliquer.
//
// Origine mesuree : deux generations d'en-tete coexistaient. Les pages FR de
// solutions/ (25 juillet) et prestashop/shopify/woocommerce (30 juillet) sont
// nees sans le bloc ; leurs equivalents ANGLAIS, crees le 31 juillet depuis
// un gabarit plus recent, l'avaient. C'est le gabarit defectueux qui s'est
// ensuite propage : le hub solutions (11 aout), contact et roi et secteurs
// (25 aout), partners (26 aout) l'ont tous herite.
//
// jsdom ne clique pas et n'execute pas search-engine.js utilement ici. Ce
// test verifie l'INVARIANT STRUCTUREL qui a echoue, comme
// reveal-degradation.test.js avant lui : bouton present => modale presente.
// ---------------------------------------------------------------------------

function pagesHtml() {
  const sortie = [];
  const parcourir = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (e.name.endsWith(".html")) sortie.push(p);
    }
  };
  parcourir(RACINE);
  return sortie;
}

const avecBouton = () =>
  pagesHtml().filter((p) => fs.readFileSync(p, "utf8").includes('id="heurix-search-btn"'));

describe("recherche du site — le bouton doit avoir sa modale", () => {
  it("aucune page ne porte le bouton sans le conteneur que search-engine.js cherche", () => {
    const fautives = avecBouton().filter(
      (p) => !fs.readFileSync(p, "utf8").includes('id="heurix-search-modal"')
    );
    expect(fautives.map((p) => path.relative(RACINE, p))).toEqual([]);
  });

  it("aucune page ne porte le bouton sans charger un index ET le moteur", () => {
    const fautives = avecBouton().filter((p) => {
      const s = fs.readFileSync(p, "utf8");
      return !/src="[^"]*search(-en)?\.js/.test(s) || !s.includes("search-engine.js");
    });
    expect(fautives.map((p) => path.relative(RACINE, p))).toEqual([]);
  });

  it("les quatre elements que search-engine.js interroge par id existent partout", () => {
    // Tires de search-engine.js : un id absent ne leve rien, il rend null et
    // la fonction concernee cesse silencieusement d'operer.
    const requis = [
      "heurix-search-modal",
      "heurix-search-backdrop",
      "heurix-search-input",
      "heurix-search-results",
    ];
    const fautives = [];
    for (const p of avecBouton()) {
      const s = fs.readFileSync(p, "utf8");
      const manquants = requis.filter((id) => !s.includes(`id="${id}"`));
      if (manquants.length) fautives.push(`${path.relative(RACINE, p)} → ${manquants.join(", ")}`);
    }
    expect(fautives).toEqual([]);
  });

  it("la modale est dans la langue de sa page", () => {
    const fautives = avecBouton().filter((p) => {
      const s = fs.readFileSync(p, "utf8");
      const rel = path.relative(RACINE, p);
      const attendu = rel.startsWith("en/") ? "Latest articles" : "Derniers articles";
      return !s.includes(`class="search-suggest-label" hidden>${attendu}<`);
    });
    expect(fautives.map((p) => path.relative(RACINE, p))).toEqual([]);
  });
});
