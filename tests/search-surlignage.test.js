import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// SURLIGNAGE ET ECHAPPEMENT (27 aout 2026).
//
// Deux defauts fermes ici, et un troisieme qui n'existait pas encore mais
// qui allait naitre.
//
//   1. LE MOT COUPE. « Recher » dans « Recherche » surlignait « Recher » et
//      laissait « che » nu. Mesure avant correctif :
//      "<mark>Recher</mark>che interne".
//
//   2. LE TEXTE DE L'INDEX RENDU EN HTML. Le rendu passait par innerHTML.
//      La REQUETE ne pouvait pas s'y injecter -- verifie, elle ne sert qu'a
//      localiser un indice -- mais un titre portant « <b> » s'affichait en
//      gras. Sans danger tant que l'index etait ecrit a la main ; il devient
//      derive du contenu des pages.
//
//   3. LA CARTE DE POSITIONS. L'ancien code cherchait dans le texte replie
//      et decoupait le texte source au meme indice. Ca tient pour les
//      accents precomposes du latin, et c'est pourquoi personne ne l'a vu.
//      Ca ne tient pas pour l'eszett (un caractere -> « ss ») ni pour la
//      ligature « oe ». Le meme defaut que le coeur natif a corrige le meme
//      jour, et pour la meme raison : constater une egalite de longueur ne
//      remplace pas traduire chaque position.
// ---------------------------------------------------------------------------

function moteur() {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <button id="heurix-search-btn"></button>
      <div id="heurix-search-modal">
        <div id="heurix-search-backdrop"></div>
        <input id="heurix-search-input">
        <p id="heurix-search-suggest-label"></p>
        <div id="heurix-search-results"></div>
        <p id="heurix-search-empty"></p>
      </div>
    </body></html>`,
    { url: "https://heurix.fr/index.html", runScripts: "outside-only" }
  );
  dom.window.HEURIX_SEARCH_INDEX = [];
  dom.window.HEURIX_SEARCH_LATEST_PATHS = [];
  dom.window.eval(fs.readFileSync(path.join(RACINE, "search-engine.js"), "utf8"));
  return dom.window;
}

const rendu = (win, texte, requete) =>
  win.__heurixSearchInterne
    .segmenter(texte, requete)
    .map((s) => (s.marque ? `[${s.t}]` : s.t))
    .join("");

describe("surlignage — le mot entier, jamais coupe", () => {
  const win = moteur();

  it.each([
    ["Recherche interne", "Recher", "[Recherche] interne"],
    ["Documentation API", "Doc", "[Documentation] API"],
    ["Un moteur de recherche", "recherch", "Un moteur de [recherche]"],
    // Le match au MILIEU d'un mot etend aussi vers la gauche : c'est le mot
    // entier qui se surligne, pas la fin du mot.
    ["Recherche interne", "cherche", "[Recherche] interne"],
  ])("« %s » + « %s »", (texte, requete, attendu) => {
    expect(rendu(win, texte, requete)).toBe(attendu);
  });

  it("une requete de plusieurs mots surligne d'un bout a l'autre", () => {
    expect(rendu(win, "La norme DIN 933 hexagonale", "din 933")).toBe(
      "La norme [DIN 933] hexagonale"
    );
  });

  it("aucune correspondance : le texte ressort intact, en un seul segment", () => {
    expect(rendu(win, "Documentation API", "zzz")).toBe("Documentation API");
  });
});

describe("surlignage — la carte de positions, pas l'egalite de longueur", () => {
  const win = moteur();

  // L'eszett se replie en DEUX caracteres. Sans carte, tout ce qui suit
  // decale d'un rang et le surlignage tombe a cote.
  it("un caractere expansif avant le match ne decale pas l'empan", () => {
    expect(rendu(win, "Straße et documentation", "documentation")).toBe(
      "Straße et [documentation]"
    );
  });

  it("la ligature oe ne decale pas non plus", () => {
    expect(rendu(win, "Cœur de metier et packs", "packs")).toBe(
      "Cœur de metier et [packs]"
    );
  });

  it("les accents restent alignes (le cas qui marchait deja)", () => {
    expect(rendu(win, "Référence produit", "reference")).toBe("[Référence] produit");
  });
});

describe("echappement — le texte de l'index ne peut pas devenir du balisage", () => {
  const win = moteur();

  it("un titre portant du HTML s'affiche comme du texte", () => {
    const el = win.document.createElement("div");
    win.__heurixSearchInterne.segmenter("Un <b>titre</b> balise", "titre").forEach((s) => {
      const n = s.marque ? win.document.createElement("mark") : null;
      if (n) { n.textContent = s.t; el.appendChild(n); }
      else el.appendChild(win.document.createTextNode(s.t));
    });
    expect(el.querySelector("b")).toBeNull();
    expect(el.textContent).toBe("Un <b>titre</b> balise");
  });

  it("le rendu reel n'utilise pas innerHTML pour le contenu", () => {
    const src = fs.readFileSync(path.join(RACINE, "search-engine.js"), "utf8");
    // Verrou sur le MECANISME : si quelqu'un revient a une concatenation,
    // ce test tombe meme si le resultat visible est identique.
    expect(src).not.toMatch(/innerHTML\s*=\s*['"`]?<div class="search-result-title/);
    expect(src).toMatch(/createTextNode/);
  });

  it("la requete ne s'injecte pas non plus (elle ne fait que localiser)", () => {
    expect(rendu(win, "Recherche interne", "<img src=x onerror=alert(1)>")).toBe(
      "Recherche interne"
    );
  });
});
