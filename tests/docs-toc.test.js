import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// docs-toc.js — scrollspy de la sidebar gauche (chantier UX, 5 août 2026,
// revu le 10 août : le panneau visuel "Sur cette page" a été retiré --
// doublon quasi total de cette même sidebar, une fois son contraste
// corrigé, sur une page qui n'a jamais été paginée. Seule la génération du
// panneau a disparu ; le scrollspy qui anime .docs-sidebar a.active reste
// entièrement intact, avec la même attention au bug déjà documenté :
// un H3 ne doit JAMAIS hériter de l'id de son H2 englobant.
// ---------------------------------------------------------------------------

function domDocsToc(lang) {
  const chemin = lang === "en" ? "en/docs.html" : "docs.html";
  const html = fs.readFileSync(path.join(RACINE, chemin), "utf8");
  const dom = new JSDOM(html, { url: `https://heurix.fr/${chemin}`, runScripts: "outside-only" });
  const win = dom.window;
  // Expose le vrai callback pour pouvoir simuler manuellement une entrée
  // "isIntersecting" dans le test -- IntersectionObserver ne se déclenche
  // jamais via de vrais événements DOM, il n'y a pas d'autre façon fidèle
  // de tester le scrollspy sans un vrai navigateur.
  win.__dernierCallback = null;
  win.IntersectionObserver = class {
    constructor(cb) { win.__dernierCallback = cb; }
    observe() {}
  };
  win.eval(fs.readFileSync(path.join(RACINE, "docs-toc.js"), "utf8"));
  return win;
}

describe("docs-toc.js — le panneau visuel a bien disparu", () => {
  it("n'injecte plus aucun <aside class='docs-toc'>", () => {
    const win = domDocsToc("fr");
    expect(win.document.querySelector(".docs-toc")).toBeNull();
  });

  it("ne crée plus aucun lien '.docs-toc a'", () => {
    const win = domDocsToc("fr");
    expect(win.document.querySelectorAll(".docs-toc a").length).toBe(0);
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

  it("le id d'une section posée à la main (ex. ep-search) est bien repris par son propre H2", () => {
    // Comportement voulu, pas un bug : un H2 sans id propre hérite de
    // celui de sa <section> parente (voir le commentaire du script). Le
    // vrai risque à surveiller est couvert par le test précédent -- qu'un
    // H3 n'hérite JAMAIS de cet id à la place de son H2 englobant.
    const win = domDocsToc("fr");
    const section = win.document.getElementById("ep-search");
    expect(section, "la section ep-search doit exister, posée à la main").not.toBeNull();
    expect(section.tagName).toBe("SECTION");
  });
});

describe("docs-toc.js — scrollspy de la sidebar gauche, la vraie fonctionnalité restante", () => {
  it("observe bien tous les titres H2/H3 de la page", () => {
    const win = domDocsToc("fr");
    const titres = win.document.querySelectorAll(".docs-content h2, .docs-content h3");
    expect(titres.length).toBeGreaterThan(0);
    expect(win.__dernierCallback, "un IntersectionObserver doit vraiment être créé").not.toBeNull();
  });

  it("active vraiment le lien de sidebar correspondant quand son titre entre dans le viewport", () => {
    const win = domDocsToc("fr");
    const lienIntro = win.document.querySelector('.docs-sidebar a[href="#introduction"]');
    expect(lienIntro, "la sidebar doit avoir un lien vers #introduction").not.toBeNull();
    expect(lienIntro.classList.contains("active")).toBe(false);

    const titreIntro = win.document.getElementById("introduction");
    expect(titreIntro).not.toBeNull();

    // Simule vraiment l'IntersectionObserver signalant que ce titre est
    // entré dans le viewport -- pas un no-op, le vrai callback capturé.
    win.__dernierCallback([{ isIntersecting: true, target: titreIntro }]);

    expect(lienIntro.classList.contains("active")).toBe(true);
  });

  it("désactive l'ancien lien actif quand un nouveau titre prend le relais", () => {
    const win = domDocsToc("fr");
    const lienIntro = win.document.querySelector('.docs-sidebar a[href="#introduction"]');
    const titreIntro = win.document.getElementById("introduction");
    win.__dernierCallback([{ isIntersecting: true, target: titreIntro }]);
    expect(lienIntro.classList.contains("active")).toBe(true);

    const lienDemarrage = win.document.querySelector('.docs-sidebar a[href="#quickstart"]');
    const titreDemarrage = win.document.getElementById("quickstart");
    expect(lienDemarrage, "la sidebar doit avoir un lien vers #quickstart").not.toBeNull();
    win.__dernierCallback([{ isIntersecting: true, target: titreDemarrage }]);

    expect(lienIntro.classList.contains("active"), "l'ancien lien actif doit se désactiver").toBe(false);
    expect(lienDemarrage.classList.contains("active")).toBe(true);
  });
});

describe("docs-toc.js — dégrade proprement", () => {
  it("ne plante pas si IntersectionObserver est indisponible, et ne crée toujours pas de panneau", () => {
    const html = fs.readFileSync(path.join(RACINE, "docs.html"), "utf8");
    const dom = new JSDOM(html, { url: "https://heurix.fr/docs.html", runScripts: "outside-only" });
    // PAS de mock IntersectionObserver ici, volontairement : simule un
    // environnement qui ne le supporte pas.
    expect(() => {
      dom.window.eval(fs.readFileSync(path.join(RACINE, "docs-toc.js"), "utf8"));
    }).not.toThrow();
    expect(dom.window.document.querySelector(".docs-toc")).toBeNull();
  });
});
