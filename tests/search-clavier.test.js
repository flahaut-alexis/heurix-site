import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const INDEX = JSON.parse(fs.readFileSync(path.join(RACINE, "search-index-fr.json"), "utf8"));

// ---------------------------------------------------------------------------
// CLAVIER ET ACCESSIBILITE (27 aout 2026).
//
// Verifies A CHAQUE ETAPE et non a la fin : une etape qui n'est pas navigable
// au clavier n'est pas finie. Ce fichier grandira avec les etapes suivantes.
// ---------------------------------------------------------------------------

async function ouvrir(url = "https://heurix.fr/index.html") {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body><button id="heurix-search-btn">b</button></body></html>`,
    { url, runScripts: "outside-only" }
  );
  const w = dom.window;
  w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(INDEX) });
  w.matchMedia = () => ({ matches: true });
  w.eval(fs.readFileSync(path.join(RACINE, "search-engine.js"), "utf8"));
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  w.document.getElementById("heurix-search-btn").dispatchEvent(new w.Event("click"));
  await new Promise((r) => setTimeout(r, 25));
  return w;
}

const taper = (w, q) => {
  const i = w.document.getElementById("heurix-search-input");
  i.value = q;
  i.dispatchEvent(new w.Event("input"));
  return i;
};
const touche = (w, key, opts = {}) => {
  const i = w.document.getElementById("heurix-search-input");
  const e = new w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts });
  i.dispatchEvent(e);
  return e;
};
const options = (w) => [...w.document.querySelectorAll(".search-result")];

describe("clavier — navigation dans la liste", () => {
  it("la fleche bas prend la premiere option, puis la suivante", async () => {
    const w = await ouvrir();
    taper(w, "prestashop");
    touche(w, "ArrowDown");
    expect(options(w)[0].classList.contains("on")).toBe(true);
    touche(w, "ArrowDown");
    expect(options(w)[1].classList.contains("on")).toBe(true);
    expect(options(w)[0].classList.contains("on")).toBe(false);
  });

  it("la fleche haut depuis le debut boucle sur la derniere", async () => {
    const w = await ouvrir();
    taper(w, "prestashop");
    touche(w, "ArrowUp");
    const o = options(w);
    expect(o[o.length - 1].classList.contains("on")).toBe(true);
  });

  it("les fleches empechent le defilement de la page", async () => {
    const w = await ouvrir();
    taper(w, "prestashop");
    expect(touche(w, "ArrowDown").defaultPrevented).toBe(true);
    expect(touche(w, "ArrowUp").defaultPrevented).toBe(true);
  });
});

describe("clavier — Echap vide, puis ferme", () => {
  // LE GESTE LE PLUS FACILE A FAIRE PAR ACCIDENT. Une requete tapee est un
  // travail ; fermer d'un coup le detruit.
  it("le premier Echap vide la requete sans fermer", async () => {
    const w = await ouvrir();
    taper(w, "prestashop");
    touche(w, "Escape");
    expect(w.document.getElementById("heurix-search-input").value).toBe("");
    expect(w.document.getElementById("heurix-search-modal").classList.contains("open")).toBe(true);
  });

  it("le second Echap ferme", async () => {
    const w = await ouvrir();
    taper(w, "prestashop");
    touche(w, "Escape");
    touche(w, "Escape");
    expect(w.document.getElementById("heurix-search-modal").classList.contains("open")).toBe(false);
  });

  it("la fermeture rend le focus a ce qui l'avait", async () => {
    const w = await ouvrir();
    const btn = w.document.getElementById("heurix-search-btn");
    btn.focus();
    touche(w, "Escape");
    expect(w.document.activeElement).toBe(btn);
  });
});

describe("accessibilite — ce qu'un lecteur d'ecran percoit", () => {
  it("le champ est un combobox qui declare sa liste", async () => {
    const w = await ouvrir();
    const i = w.document.getElementById("heurix-search-input");
    expect(i.getAttribute("role")).toBe("combobox");
    expect(i.getAttribute("aria-controls")).toBe("heurix-search-results");
    expect(i.getAttribute("aria-autocomplete")).toBe("list");
  });

  it("aria-expanded suit l'etat reel de la liste", async () => {
    const w = await ouvrir();
    const i = w.document.getElementById("heurix-search-input");
    taper(w, "prestashop");
    expect(i.getAttribute("aria-expanded")).toBe("true");
    taper(w, "xyzinexistantzzz");
    expect(i.getAttribute("aria-expanded")).toBe("false");
  });

  it("aria-activedescendant designe l'option surlignee", async () => {
    const w = await ouvrir();
    const i = w.document.getElementById("heurix-search-input");
    taper(w, "prestashop");
    expect(i.hasAttribute("aria-activedescendant")).toBe(false);
    touche(w, "ArrowDown");
    expect(i.getAttribute("aria-activedescendant")).toBe(options(w)[0].id);
  });

  it("la liste est une listbox, ses entrees des options", async () => {
    const w = await ouvrir();
    taper(w, "prestashop");
    expect(w.document.getElementById("heurix-search-results").getAttribute("role")).toBe("listbox");
    expect(options(w).every((o) => o.getAttribute("role") === "option")).toBe(true);
  });

  it("aria-selected suit le curseur, une seule option a la fois", async () => {
    const w = await ouvrir();
    taper(w, "prestashop");
    touche(w, "ArrowDown");
    touche(w, "ArrowDown");
    const choisies = options(w).filter((o) => o.getAttribute("aria-selected") === "true");
    expect(choisies).toHaveLength(1);
    expect(choisies[0]).toBe(options(w)[1]);
  });

  it("le nombre de resultats est annonce, en differe", async () => {
    const w = await ouvrir();
    taper(w, "prestashop");
    const a = w.document.getElementById("heurix-search-annonce");
    expect(a.getAttribute("aria-live")).toBe("polite");
    // DEBOUNCEE : annoncer a chaque frappe rendrait le lecteur d'ecran
    // inutilisable. Rien avant le delai.
    expect(a.textContent).toBe("");
    await new Promise((r) => setTimeout(r, 350));
    expect(a.textContent).toMatch(/\d+ r[ée]sultat/);
  });

  it("le panneau se declare modal et porte un nom", async () => {
    const w = await ouvrir();
    const p = w.document.querySelector(".search-panel");
    expect(p.getAttribute("role")).toBe("dialog");
    expect(p.getAttribute("aria-modal")).toBe("true");
    expect(p.getAttribute("aria-label")).toBeTruthy();
  });
});

describe("non-regression de l'index, a chaque etape", () => {
  // ON COMPTE LES PAGES, PAS LES ENTREES.
  //
  // Ce garde comptait les entrees et il est tombe le 27 aout sans qu'une
  // ligne de recherche ne bouge : une autre session avait retitre une page,
  // ce qui a fait remonter une ancre par son extrait. Les sept pages, elles,
  // n'avaient pas change.
  //
  // HUIT PAGES DEPUIS LE 4 SEPTEMBRE 2026. C'est la meme ancre, et cette fois
  // c'est elle qu'on a corrigee plutot que de la contourner : `e` ne classe
  // plus une ancre, la huitieme place cesse d'etre un doublon de la premiere
  // et revient a une page distincte.
  //
  // Ici on verifie seulement que l'etape en cours n'a rien casse. Les pages
  // attendues sont NOMMEES une fois, dans tests/index-recherche.test.js, qui
  // est le garde de l'index lui-meme.
  const pages = (w) =>
    new Set(options(w).map((a) =>
      a.getAttribute("href").split("#")[0].replace(/^(\.\.\/)+/, "")));

  it.each(["2rs", "din 933"])("« %s » remonte huit pages", async (q) => {
    const w = await ouvrir();
    taper(w, q);
    expect(pages(w).size).toBe(8);
  });
});
