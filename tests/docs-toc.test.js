import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// docs-toc.js — sommaire "Sur cette page", chantier UX (5 août 2026).
// Écrit dans une partie antérieure de la session, jamais suivi par git
// jusqu'ici (absent de git ls-files) -- donc jamais inclus dans aucun zip
// de livraison automatique, alors même que docs.html/en/docs.html, déjà
// livrés, référencent son <script src>. Ce test protège la version qui a
// comblé ce trou, avec une attention particulière au bug que l'auteur a
// lui-même documenté et corrigé : un H3 ne doit JAMAIS hériter de l'id de
// son H2 englobant (closest("section[id]") ne doit s'appliquer qu'aux H2).
// ---------------------------------------------------------------------------

function domDocsToc(lang) {
  const chemin = lang === "en" ? "en/docs.html" : "docs.html";
  const html = fs.readFileSync(path.join(RACINE, chemin), "utf8");
  const dom = new JSDOM(html, { url: `https://heurix.fr/${chemin}`, runScripts: "outside-only" });
  const win = dom.window;
  win.IntersectionObserver = class { observe() {} };
  win.eval(fs.readFileSync(path.join(RACINE, "docs-toc.js"), "utf8"));
  return win;
}

describe("docs-toc.js — injection et contenu", () => {
  it("injecte un <aside class='docs-toc'> en dernier enfant de .docs-layout", () => {
    const win = domDocsToc("fr");
    const toc = win.document.querySelector(".docs-toc");
    expect(toc).not.toBeNull();
    expect(toc).toBe(win.document.querySelector(".docs-layout").lastElementChild);
  });

  it("un lien par titre H2/H3 de .docs-content, aucun de moins, aucun de plus", () => {
    const win = domDocsToc("fr");
    const titres = win.document.querySelectorAll(".docs-content h2, .docs-content h3");
    const liens = win.document.querySelectorAll(".docs-toc a");
    expect(liens.length).toBe(titres.length);
  });

  it("FR : titre du panneau en français", () => {
    const win = domDocsToc("fr");
    expect(win.document.querySelector(".docs-toc-titre").textContent).toBe("Sur cette page");
  });

  it("EN : titre du panneau en anglais", () => {
    const win = domDocsToc("en");
    expect(win.document.querySelector(".docs-toc-titre").textContent).toBe("On this page");
  });
});

describe("docs-toc.js — génération d'ancres, le bug déjà documenté par l'auteur", () => {
  it("tous les titres ont un id après exécution, aucun laissé vide", () => {
    const win = domDocsToc("fr");
    const titres = win.document.querySelectorAll(".docs-content h2, .docs-content h3");
    titres.forEach((t) => expect(t.id).not.toBe(""));
  });

  it("aucun id n'est dupliqué entre deux titres distincts", () => {
    const win = domDocsToc("fr");
    const ids = Array.from(win.document.querySelectorAll(".docs-content h2, .docs-content h3")).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("BUG RÉGRESSION : un H3 ne partage jamais l'id de son H2 englobant", () => {
    // C'est le bug documenté dans le fichier lui-même : closest("section[id]")
    // ne doit s'appliquer qu'aux H2 (qui ont une <section> parente directe),
    // jamais aux H3 (qui remonteraient sinon jusqu'à la même section que
    // leur H2, collisionnant avec lui).
    const win = domDocsToc("fr");
    const h2s = Array.from(win.document.querySelectorAll(".docs-content h2"));
    const h3s = Array.from(win.document.querySelectorAll(".docs-content h3"));
    h3s.forEach((h3) => {
      h2s.forEach((h2) => expect(h3.id).not.toBe(h2.id));
    });
  });

  it("un id déjà posé à la main (ex. ep-search) n'est jamais réattribué à un autre titre", () => {
    const win = domDocsToc("fr");
    const epSearch = win.document.getElementById("ep-search");
    expect(epSearch).not.toBeNull();
    // Un seul élément porte cet id -- getElementById le garantit déjà,
    // mais on vérifie aussi qu'aucun lien de la TOC ne pointe dessus deux fois.
    const liensVersEpSearch = Array.from(win.document.querySelectorAll(".docs-toc a"))
      .filter((a) => a.getAttribute("href") === "#ep-search");
    expect(liensVersEpSearch.length).toBeLessThanOrEqual(1);
  });
});

describe("docs-toc.js — dégrade proprement", () => {
  it("ne plante pas si IntersectionObserver est indisponible", () => {
    const html = fs.readFileSync(path.join(RACINE, "docs.html"), "utf8");
    const dom = new JSDOM(html, { url: "https://heurix.fr/docs.html", runScripts: "outside-only" });
    // PAS de mock IntersectionObserver ici, volontairement : simule un
    // environnement qui ne le supporte pas.
    expect(() => {
      dom.window.eval(fs.readFileSync(path.join(RACINE, "docs-toc.js"), "utf8"));
    }).not.toThrow();
    expect(dom.window.document.querySelector(".docs-toc")).not.toBeNull();
  });
});
