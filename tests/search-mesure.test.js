import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const INDEX = JSON.parse(fs.readFileSync(path.join(RACINE, "search-index-fr.json"), "utf8"));

// ---------------------------------------------------------------------------
// MESURE DE LA RECHERCHE DU SITE — etape (e).
//
// OU VA LA DONNEE. Le site n'a qu'un point de collecte : le dataLayer de GTM.
// consent.js n'injecte GTM -- et ne cree `window.dataLayer` -- qu'apres un clic
// explicite. Le premier bloc ci-dessous est donc le plus important du fichier :
// sans consentement, rien ne part. Pousser dans un tableau que GTM rejouerait a
// son chargement ferait remonter des evenements ANTERIEURS au consentement.
//
// CE QUE LES CHIFFRES NE DIRONT PAS. La population mesuree est celle qui a
// accepte les traceurs, et sa taille est immesurable depuis le site : GitHub
// Pages ne rend aucun journal serveur. Les trois mesures sont en revanche des
// ratios INTERNES a l'entonnoir -- leur numerateur et leur denominateur vivent
// dans la meme population.
// ---------------------------------------------------------------------------

const REPOS = 900;
const pose = () => new Promise((r) => setTimeout(r, REPOS + 120));

async function ouvrir({ consentement = true, langue = "fr" } = {}) {
  const url = langue === "en" ? "https://heurix.fr/en/index.html" : "https://heurix.fr/index.html";
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body><button id="heurix-search-btn">b</button></body></html>`,
    { url, runScripts: "outside-only" }
  );
  const w = dom.window;
  w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(INDEX) });
  w.matchMedia = () => ({ matches: true });
  // consent.js cree window.dataLayer AU MOMENT du consentement, pas avant.
  if (consentement) w.dataLayer = [];
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
const evenements = (w, nom) => (w.dataLayer || []).filter((e) => e.event === nom);
const dernier = (w, nom) => evenements(w, nom).slice(-1)[0];
const resultats = (w) => [...w.document.querySelectorAll(".search-result")];

describe("sans consentement, rien ne part", () => {
  it("ouvrir, chercher, cliquer et fermer ne cree aucun dataLayer", async () => {
    const w = await ouvrir({ consentement: false });
    expect(w.dataLayer).toBeUndefined();
    taper(w, "din 933");
    await pose();
    resultats(w)[0].dispatchEvent(new w.Event("click", { bubbles: true }));
    w.document.querySelector("[data-search-close]").dispatchEvent(new w.Event("click", { bubbles: true }));
    // Le point : pas d'exception, et surtout pas de tableau cree en douce que
    // GTM rejouerait apres coup.
    expect(w.dataLayer).toBeUndefined();
  });

  it("la recherche fonctionne exactement pareil sans consentement", async () => {
    const w = await ouvrir({ consentement: false });
    taper(w, "din 933");
    expect(resultats(w).length).toBeGreaterThan(0);
    expect(w.document.querySelector(".search-count").textContent).toMatch(/\d+ résultats/);
  });
});

describe("la requete posee", () => {
  it("n'est mesuree qu'une fois la frappe arretee, jamais par prefixe", async () => {
    const w = await ouvrir();
    for (const q of ["d", "di", "din", "din 9", "din 933"]) taper(w, q);
    expect(evenements(w, "site_search")).toHaveLength(0);   // rien pendant la frappe
    await pose();
    const envoyes = evenements(w, "site_search");
    expect(envoyes).toHaveLength(1);
    expect(envoyes[0].recherche_termes).toBe("din 933");
  });

  it("porte le compte, le drapeau « sans resultat » et la langue", async () => {
    const w = await ouvrir();
    taper(w, "xyzinexistantzzz");
    await pose();
    const e = dernier(w, "site_search");
    expect(e.recherche_termes).toBe("xyzinexistantzzz");
    expect(e.recherche_resultats).toBe(0);
    expect(e.recherche_sans_resultat).toBe(true);
    expect(e.recherche_langue).toBe("fr");
  });

  // LE COMPTE EST CELUI DE LA REQUETE, PAS CELUI DU FILTRE. Sinon une source
  // cochee ferait remonter des « sans resultat » qui n'en sont pas, et le taux
  // mesurerait le comportement des filtres au lieu de la qualite de l'index.
  it("compte le total NON filtre", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    const blog = w.document.querySelector('.search-rail input[value="blog"]');
    blog.checked = true;
    blog.dispatchEvent(new w.Event("change", { bubbles: true }));
    taper(w, "prestashop");
    await pose();
    // Le total attendu se lit dans le rail : les compteurs portent eux aussi
    // sur le resultat non filtre, c'est le reglage arbitre a l'etape (b).
    const somme = [...w.document.querySelectorAll(".search-filtre-n")]
      .reduce((s, n) => s + Number(n.textContent), 0);
    const e = dernier(w, "site_search");
    expect(e.recherche_termes).toBe("prestashop");
    expect(e.recherche_resultats).toBe(somme);
    expect(e.recherche_resultats).toBeGreaterThan(resultats(w).length);   // la liste, elle, est filtree
    expect(e.recherche_sans_resultat).toBe(false);
    expect(e.recherche_filtres).toBe("blog");
  });

  it("une requete d'une lettre n'est pas envoyee", async () => {
    const w = await ouvrir();
    taper(w, "d");
    await pose();
    expect(evenements(w, "site_search")).toHaveLength(0);
  });

  it("la meme requete n'est pas envoyee deux fois", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    await pose();
    taper(w, "din 933");
    await pose();
    expect(evenements(w, "site_search")).toHaveLength(1);
  });

  it("les termes sont normalises et bornes", async () => {
    const w = await ouvrir();
    taper(w, "  DIN 933  ");
    await pose();
    expect(dernier(w, "site_search").recherche_termes).toBe("din 933");
    taper(w, "x".repeat(300));
    await pose();
    expect(dernier(w, "site_search").recherche_termes).toHaveLength(100);
  });
});

describe("le compte mesure est celui du moment de l'envoi", () => {
  // LE DEFAUT QUI L'A MONTRE. Le compte etait fige a l'APPEL de la mesure,
  // 900 ms avant l'envoi. Une frappe pendant le chargement de l'index donnait
  // zero, et c'est ce zero qui partait -- alors que l'index etait arrive
  // entre-temps. La mesure se contredisait dans le dataLayer : un
  // « site_search » a 0 resultat suivi d'un « site_search_click » au rang 3.
  it("un index arrive apres la frappe donne le vrai compte, pas zero", async () => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body><button id="heurix-search-btn">b</button></body></html>`,
      { url: "https://heurix.fr/index.html", runScripts: "outside-only" }
    );
    const w = dom.window;
    let livrer;
    w.fetch = () => new Promise((r) => { livrer = () => r({ ok: true, json: () => Promise.resolve(INDEX) }); });
    w.matchMedia = () => ({ matches: true });
    w.dataLayer = [];
    w.eval(fs.readFileSync(path.join(RACINE, "search-engine.js"), "utf8"));
    w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
    w.document.getElementById("heurix-search-btn").dispatchEvent(new w.Event("click"));
    await new Promise((r) => setTimeout(r, 25));

    taper(w, "din 933");                       // l'index n'est pas encore la
    expect(resultats(w)).toHaveLength(0);
    livrer();
    await pose();

    const e = dernier(w, "site_search");
    expect(e.recherche_resultats).toBeGreaterThan(0);
    expect(e.recherche_sans_resultat).toBe(false);
  });
});

describe("le rang du resultat ouvert", () => {
  it("compte a partir de 1, avec la source et la requete", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    resultats(w)[2].dispatchEvent(new w.Event("click", { bubbles: true }));
    const e = dernier(w, "site_search_click");
    expect(e.recherche_rang).toBe(3);
    expect(e.recherche_termes).toBe("din 933");
    expect(e.recherche_source).toBeTruthy();
    expect(typeof e.recherche_ancre).toBe("boolean");
  });

  // ENTREE N'EMET PAS DE CLIC. Sans mesure dans ouvrirCourant, le rang moyen
  // serait celui des seuls utilisateurs de souris.
  it("est mesure aussi quand on ouvre au clavier", async () => {
    const w = await ouvrir();
    const champ = taper(w, "din 933");
    const touche = (k, o = {}) => champ.dispatchEvent(
      new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...o }));
    touche("ArrowDown");
    touche("ArrowDown");
    touche("Enter", { metaKey: true });        // nouvel onglet : pas de navigation
    const e = dernier(w, "site_search_click");
    expect(e.recherche_rang).toBe(2);
  });
});

describe("l'abandon", () => {
  it("fermer sans rien ouvrir le signale, avec la derniere requete", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    w.document.querySelector("[data-search-close]").dispatchEvent(new w.Event("click", { bubbles: true }));
    const e = dernier(w, "site_search_abandon");
    expect(e.recherche_termes).toBe("din 933");
    expect(e.recherche_resultats).toBeGreaterThan(0);
    expect(e.recherche_vide).toBe(false);
  });

  it("fermer apres avoir ouvert un resultat n'est pas un abandon", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    resultats(w)[0].dispatchEvent(new w.Event("click", { bubbles: true }));
    w.document.querySelector("[data-search-close]").dispatchEvent(new w.Event("click", { bubbles: true }));
    expect(evenements(w, "site_search_abandon")).toHaveLength(0);
  });

  it("ouvrir puis fermer sans rien taper est un abandon, et se dit", async () => {
    const w = await ouvrir();
    w.document.querySelector("[data-search-close]").dispatchEvent(new w.Event("click", { bubbles: true }));
    expect(dernier(w, "site_search_abandon").recherche_vide).toBe(true);
  });

  // UNE OUVERTURE EST UNE SESSION NEUVE : sans remise a zero, un clic de la
  // fois precedente masquerait tous les abandons suivants.
  it("rouvrir remet le compteur de clic a zero", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    resultats(w)[0].dispatchEvent(new w.Event("click", { bubbles: true }));
    w.document.querySelector("[data-search-close]").dispatchEvent(new w.Event("click", { bubbles: true }));
    w.document.getElementById("heurix-search-btn").dispatchEvent(new w.Event("click"));
    await new Promise((r) => setTimeout(r, 25));
    w.document.querySelector("[data-search-close]").dispatchEvent(new w.Event("click", { bubbles: true }));
    expect(evenements(w, "site_search_abandon")).toHaveLength(1);
  });

  it("une requete abandonnee en cours de frappe n'est pas comptee comme posee", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    w.document.querySelector("[data-search-close]").dispatchEvent(new w.Event("click", { bubbles: true }));
    await pose();
    expect(evenements(w, "site_search")).toHaveLength(0);
    expect(evenements(w, "site_search_abandon")).toHaveLength(1);
  });
});

describe("l'ouverture", () => {
  it("est signalee, et une seule fois par ouverture", async () => {
    const w = await ouvrir();
    expect(evenements(w, "site_search_open")).toHaveLength(1);
  });
});
