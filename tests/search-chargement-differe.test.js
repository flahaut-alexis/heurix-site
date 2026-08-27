import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(RACINE, "search-engine.js"), "utf8");

// ---------------------------------------------------------------------------
// CHARGEMENT DIFFERE DE L'INDEX (27 aout 2026).
//
// L'index derive pese 40,9 ko compresse -- GitHub Pages sert du gzip, pas du
// brotli, verifie sur l'origine. Le charger dans chaque page le ferait payer
// aux 118 pages, par tous les visiteurs, alors que la plupart ne cherchent
// jamais. Il est donc recupere au PREMIER USAGE, et PRECHARGE SUR INTENTION
// parce qu'attendre la frappe couterait plus que l'API qu'on a ecartee :
//
//     3G rapide (1,6 Mbps)   562 ms RTT + 204 ms  =  766 ms
//     budget                                          150 ms
// ---------------------------------------------------------------------------

function scene({ fetchDispo = true, survolPossible = true, url = "https://heurix.fr/index.html" } = {}) {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <button id="heurix-search-btn"></button>
      </body></html>`,
    { url, runScripts: "outside-only" }
  );
  const w = dom.window;
  w.HEURIX_SEARCH_INDEX = [];
  w.HEURIX_SEARCH_LATEST_PATHS = [];
  const appels = [];
  const erreurs = [];
  w.addEventListener("error", (e) => erreurs.push(e.message));
  if (fetchDispo) {
    w.fetch = (u) => {
      appels.push(u);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ entrees: [{ p: "a.html", t: "Alpha", e: "extrait", k: "alpha" }] }),
      });
    };
  }
  w.matchMedia = (q) => ({ matches: q.indexOf("hover: hover") >= 0 ? survolPossible : false });
  w.eval(SOURCE);
  // SANS CE DECLENCHEMENT, init() n'est jamais appelee et le test mesure le
  // vide en rapportant « OK ». C'est arrive en ecrivant ces tests.
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  return { w, appels, erreurs, btn: w.document.getElementById("heurix-search-btn") };
}

describe("chargement differe — le prechargement sur intention", () => {
  it("le survol precharge, sur un appareil qui sait survoler", () => {
    const s = scene({ survolPossible: true });
    s.btn.dispatchEvent(new s.w.Event("pointerenter"));
    expect(s.appels).toHaveLength(1);
    expect(s.appels[0]).toContain("search-index-fr.json");
  });

  // UN SURVOL TACTILE EST UN DEBUT DE TAP. S'y accrocher ferait recuperer
  // 40 ko a chaque effleurement du bandeau. `hover: hover` demande
  // directement « cet appareil sait-il survoler », la ou `pointer: coarse`
  // demande la finesse du pointeur -- ce n'est pas la meme question.
  it("le survol NE precharge PAS sur un appareil tactile", () => {
    const s = scene({ survolPossible: false });
    s.btn.dispatchEvent(new s.w.Event("pointerenter"));
    expect(s.appels).toHaveLength(0);
  });

  it("mais l'ouverture precharge, elle, sur tactile comme ailleurs", () => {
    const s = scene({ survolPossible: false });
    s.btn.dispatchEvent(new s.w.Event("click"));
    expect(s.appels).toHaveLength(1);
  });

  it("le focus clavier precharge — Ctrl+K ne passe jamais par le survol", () => {
    const s = scene({ survolPossible: false });
    s.btn.dispatchEvent(new s.w.Event("focus"));
    expect(s.appels).toHaveLength(1);
  });

  it("deux intentions successives ne chargent qu'une fois", () => {
    const s = scene();
    s.btn.dispatchEvent(new s.w.Event("pointerenter"));
    s.btn.dispatchEvent(new s.w.Event("focus"));
    s.btn.dispatchEvent(new s.w.Event("click"));
    expect(s.appels).toHaveLength(1);
  });

  it("la page anglaise demande l'index anglais", () => {
    const s = scene({ url: "https://heurix.fr/en/index.html" });
    s.btn.dispatchEvent(new s.w.Event("focus"));
    expect(s.appels[0]).toBe("../search-index-en.json");
  });
});

describe("chargement differe — les replis", () => {
  // Une premiere version appelait `fetch` directement. Sur un navigateur qui
  // ne le connait pas, l'appel jetait SYNCHRONEMENT depuis un gestionnaire
  // de clic -- donc avant tout `.catch()` -- et l'erreur remontait a la
  // fenetre. Les quatre autres cas passaient ; celui-ci a ete trouve en
  // l'eprouvant.
  it("sans fetch, la modale s'ouvre quand meme et rien ne remonte a la fenetre", async () => {
    const s = scene({ fetchDispo: false });
    s.btn.dispatchEvent(new s.w.Event("click"));
    await new Promise((r) => setTimeout(r, 20));
    expect(s.erreurs).toEqual([]);
    expect(s.w.document.getElementById("heurix-search-modal").classList.contains("open")).toBe(true);
  });

  it("sans fetch, l'etat d'erreur est affiche — jamais une modale vide", async () => {
    const s = scene({ fetchDispo: false });
    s.btn.dispatchEvent(new s.w.Event("click"));
    await new Promise((r) => setTimeout(r, 20));
    expect(s.w.document.getElementById("heurix-search-results").hasAttribute("data-erreur")).toBe(true);
  });

  it("un echec reseau ne fige pas l'etat : un nouvel essai relance vraiment", async () => {
    const s = scene({ fetchDispo: false });
    s.w.fetch = () => Promise.reject(new Error("reseau"));
    s.btn.dispatchEvent(new s.w.Event("click"));
    await new Promise((r) => setTimeout(r, 20));
    // La promesse a ete remise a zero : le second appel repart.
    let relance = 0;
    s.w.fetch = () => { relance++; return Promise.resolve({ ok: true, json: () => Promise.resolve({ entrees: [] }) }); };
    s.btn.dispatchEvent(new s.w.Event("click"));
    await new Promise((r) => setTimeout(r, 20));
    expect(relance).toBe(1);
  });
});

describe("chargement differe — le squelette", () => {
  // 200 ms, pas moins : en dessous, un flash de vide sur une connexion
  // rapide est plus desagreable que l'attente qu'il signale.
  it("le seuil de 200 ms est celui du code, pas une valeur devinee", () => {
    expect(SOURCE).toMatch(/setTimeout\([\s\S]{0,120}data-chargement[\s\S]{0,40}\},\s*200\)/);
  });

  it("aucun squelette avant le seuil", async () => {
    const s = scene();
    s.btn.dispatchEvent(new s.w.Event("click"));
    await new Promise((r) => setTimeout(r, 30));
    expect(s.w.document.getElementById("heurix-search-results").hasAttribute("data-chargement")).toBe(false);
  });
});
