import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
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

// ---------------------------------------------------------------------------
// LA MODALE EST CONSTRUITE EN JS (27 aout 2026).
//
// Son balisage vivait en clair dans 122 pages -- 920 octets chacune, 109,6 ko
// de duplication qu'il fallait reecrire a chaque changement de structure.
//
// L'INTENTION DE CE FICHIER NE CHANGE PAS : un bouton sans moteur est un
// bouton mort. Elle se verifie desormais en DEUX assertions au lieu d'une, et
// la seconde une seule fois plutot que 122 :
//
//   1. chaque page qui porte le bouton charge search-engine.js
//   2. search-engine.js construit bien les quatre identifiants
//
// Les deux mordent, verifie dans les deux sens -- une page avec le bouton mais
// sans le script, et un script qui ne construit pas la modale.
// ---------------------------------------------------------------------------

describe("recherche du site — le bouton doit avoir son moteur", () => {
  it("aucune page ne porte le bouton sans charger le moteur", () => {
    const fautives = avecBouton().filter((p) => !fs.readFileSync(p, "utf8").includes("search-engine.js"));
    expect(fautives.map((p) => path.relative(RACINE, p))).toEqual([]);
  });

  it("le balisage de la modale n'est plus duplique dans les pages", () => {
    const restantes = pagesHtml().filter((p) =>
      !path.relative(RACINE, p).startsWith("docs/maquettes") &&
      fs.readFileSync(p, "utf8").includes('id="heurix-search-modal"'));
    expect(restantes.map((p) => path.relative(RACINE, p))).toEqual([]);
  });

  // L'IDENTITE D'UN SCRIPT EST SON NOM DE FICHIER ENTIER, PAS UN SUFFIXE.
  // Le motif portait `\bsearch(-en)?\.js`. Un tiret n'est pas un caractere de
  // mot, donc `\b` tombe AUSSI entre `heurix-` et `search` : la regle visait
  // les anciens `search.js` / `search-en.js` du site et attrapait
  // `downloads/heurix-search.js`, qui est le widget livre aux clients -- un
  // fichier different, au role oppose.
  //
  // Trouve le 28 aout 2026 en branchant ce widget sur les quatre pages de
  // demo/ : le test a echoue en les nommant, sur un chargement legitime.
  //
  // La forme juste exige que ce qui precede `search` soit un separateur de
  // chemin ou rien : `(?:[^"]*\/)?`. C'est la meme lecon que « l'identite d'un
  // actif est son chemin, pas son nom de fichier », prise par l'autre bout --
  // la on groupait trop large, ici on matchait trop facilement.
  it("plus aucune page ne charge les anciens index du site", () => {
    const fautives = pagesHtml().filter((p) =>
      /<script[^>]*src="(?:[^"]*\/)?search(-en)?\.js/.test(fs.readFileSync(p, "utf8")));
    expect(fautives.map((p) => path.relative(RACINE, p))).toEqual([]);
  });
});

describe("recherche du site — le moteur construit ce qu'il interroge", () => {
  const scene = () => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body><button id="heurix-search-btn"></button></body></html>`,
      { url: "https://heurix.fr/index.html", runScripts: "outside-only" }
    );
    const w = dom.window;
    w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ entrees: [], derniers: [] }) });
    w.matchMedia = () => ({ matches: true });
    w.eval(fs.readFileSync(path.join(RACINE, "search-engine.js"), "utf8"));
    w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
    return w;
  };

  it("rien n'est construit tant qu'on n'ouvre pas", () => {
    const w = scene();
    expect(w.document.getElementById("heurix-search-modal")).toBeNull();
  });

  it("les quatre identifiants que le moteur interroge existent apres ouverture", () => {
    const w = scene();
    w.document.getElementById("heurix-search-btn").dispatchEvent(new w.Event("click"));
    for (const id of ["heurix-search-modal", "heurix-search-input",
                      "heurix-search-results", "heurix-search-empty"]) {
      expect(w.document.getElementById(id), id).not.toBeNull();
    }
  });

  it("une seconde ouverture ne construit pas une seconde modale", () => {
    const w = scene();
    const btn = w.document.getElementById("heurix-search-btn");
    btn.dispatchEvent(new w.Event("click"));
    btn.dispatchEvent(new w.Event("click"));
    expect(w.document.querySelectorAll("#heurix-search-modal")).toHaveLength(1);
  });
});

