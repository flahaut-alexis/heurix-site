import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const INDEX = JSON.parse(fs.readFileSync(path.join(RACINE, "search-index-fr.json"), "utf8"));

// ---------------------------------------------------------------------------
// FILTRES DE SOURCE ET COMPTEURS — etape (b) du chantier recherche.
//
// L'etape (a) avait masque le rail tant qu'il n'avait aucun enfant
// (`.search-rail:empty`). Cette etape lui en donne cinq, et le premier test
// ci-dessous est exactement celui-la : le rail se peuple, donc il reparait.
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
const rail = (w) => w.document.getElementById("heurix-search-rail");
const filtres = (w) => [...rail(w).querySelectorAll(".search-filtre")];
const caseDe = (w, clef) => rail(w).querySelector(`input[value="${clef}"]`);
const compteDe = (w, clef) =>
  caseDe(w, clef).closest(".search-filtre").querySelector(".search-filtre-n").textContent;
const cocher = (w, clef) => {
  const b = caseDe(w, clef);
  b.checked = !b.checked;
  b.dispatchEvent(new w.Event("change", { bubbles: true }));
  return b;
};
const options = (w) => [...w.document.querySelectorAll(".search-result")];
const sourcesAffichees = (w) =>
  new Set(options(w).map((a) => a.querySelector(".search-pill").className.split("search-pill-")[1]));

describe("rail de filtres — il n'est plus vide, donc il reparait", () => {
  it("le rail porte cinq filtres et un titre, la ou l'etape (a) le laissait sans enfant", async () => {
    const w = await ouvrir();
    expect(rail(w).children.length).toBeGreaterThan(0);
    expect(filtres(w)).toHaveLength(5);
    expect(rail(w).querySelector("h3").textContent).toBe("Sources");
  });

  it("le rail se nomme pour un lecteur d'ecran, il n'est pas cinq cases orphelines", async () => {
    const w = await ouvrir();
    expect(rail(w).getAttribute("role")).toBe("group");
    const id = rail(w).getAttribute("aria-labelledby");
    expect(w.document.getElementById(id).textContent).toBe("Sources");
  });
});

describe("compteurs", () => {
  it("sans requete, un tiret et non un zero — il n'y a rien a compter", async () => {
    const w = await ouvrir();
    for (const c of ["blog", "secteurs", "produit", "documentation", "plateformes"]) {
      expect(compteDe(w, c)).toBe("—");
    }
  });

  it("avec une requete, chaque source porte son compte", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    const total = ["blog", "secteurs", "produit", "documentation", "plateformes"]
      .reduce((s, c) => s + Number(compteDe(w, c)), 0);
    // NEUF DEPUIS LE 2 SEPTEMBRE 2026 : « mesure.html » cite « DIN 933 »
    // dans sa liste des cas ou Heurix n'apporte rien. Huit pages, dont une
    // avec son ancre.
    expect(total).toBe(9);
    expect(Number(compteDe(w, "blog"))).toBeGreaterThan(0);
  });

  // CE TEST EST LA RAISON D'ETRE DU REGLAGE.
  // Si les compteurs portaient sur le resultat DEJA filtre, cocher « blog »
  // mettrait les quatre autres a zero et on ne pourrait plus voir ce qu'on
  // gagnerait a cocher une seconde source. Le filtre deviendrait un cul-de-sac.
  it("cocher une source ne met pas les autres compteurs a zero", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    const avant = compteDe(w, "produit");
    cocher(w, "blog");
    expect(compteDe(w, "produit")).toBe(avant);
  });

  it("une source sans resultat est grisee ET desactivee", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    const vide = filtres(w).find((f) => f.querySelector(".search-filtre-n").textContent === "0");
    expect(vide, "aucune source a zero pour cette requete").toBeTruthy();
    expect(vide.classList.contains("vide")).toBe(true);
    expect(vide.querySelector("input").disabled).toBe(true);
  });

  it("le compte accessible accompagne le nom, il ne flotte pas", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    const n = compteDe(w, "blog");
    expect(caseDe(w, "blog").getAttribute("aria-label")).toBe(`Blog, ${n} résultats`);
  });
});

describe("filtrer", () => {
  it("cocher une source reduit la liste a cette source", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    expect(sourcesAffichees(w).size).toBeGreaterThan(1);
    cocher(w, "blog");
    expect([...sourcesAffichees(w)]).toEqual(["blog"]);
  });

  it("le compteur du haut suit le filtre, il n'annonce pas le total non filtre", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    const haut = () => w.document.querySelector(".search-count").textContent;
    expect(haut()).toBe("9 résultats");   // 9 depuis mesure.html, 2 sept. 2026
    cocher(w, "blog");
    expect(haut()).toBe(`${compteDe(w, "blog")} résultats`);
  });

  it("deux sources cochees rendent l'union, pas l'intersection", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    cocher(w, "blog");
    const n1 = options(w).length;
    cocher(w, "produit");
    expect(options(w).length).toBeGreaterThan(n1);
  });

  it("« Tout effacer » n'apparait qu'une fois un filtre pose, et le retire", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    const bouton = rail(w).querySelector(".search-effacer");
    expect(bouton.hidden).toBe(true);
    cocher(w, "blog");
    expect(bouton.hidden).toBe(false);
    bouton.dispatchEvent(new w.Event("click", { bubbles: true }));
    expect(bouton.hidden).toBe(true);
    expect(caseDe(w, "blog").checked).toBe(false);
    expect(sourcesAffichees(w).size).toBeGreaterThan(1);
  });

  // UNE OUVERTURE EST UNE RECHERCHE NEUVE. Un filtre survivant d'une ouverture
  // precedente ferait rendre zero resultat sans que rien au centre de l'ecran
  // ne dise pourquoi.
  it("rouvrir la modale remet les filtres a zero", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    cocher(w, "blog");
    expect(caseDe(w, "blog").checked).toBe(true);
    w.document.getElementById("heurix-search-btn").dispatchEvent(new w.Event("click"));
    await new Promise((r) => setTimeout(r, 25));
    expect(caseDe(w, "blog").checked).toBe(false);
    expect(compteDe(w, "blog")).toBe("—");
  });
});

describe("clavier — les filtres sont atteignables et Echap ferme depuis eux", () => {
  it("les cases et le bouton sont dans le piege a focus, entre le champ et les resultats", async () => {
    const w = await ouvrir();
    // On compare des INDEX, pas des noeuds : passer un element jsdom a
    // `toContain` fait lever le matcher lui-meme (« reading 'name' »), et
    // l'echec ne ressemble alors pas a un echec d'assertion.
    const focalisables = [...w.document
      .querySelector(".search-panel")
      .querySelectorAll("input, button, a[href]")];
    const rang = (n) => focalisables.indexOf(n);

    expect(rang(w.document.getElementById("heurix-search-input"))).toBe(0);
    for (const clef of ["blog", "secteurs", "produit", "documentation", "plateformes"]) {
      expect(rang(caseDe(w, clef))).toBeGreaterThan(0);
    }
    expect(rang(rail(w).querySelector(".search-effacer"))).toBeGreaterThan(rang(caseDe(w, "plateformes")));
    // Les filtres precedent les resultats : on tabule vers ce qui reduit la
    // liste avant de tabuler dans la liste.
    const premierResultat = focalisables.findIndex((n) => n.classList.contains("search-result"));
    expect(premierResultat).toBeGreaterThan(rang(caseDe(w, "plateformes")));
  });

  // AVANT CETTE ETAPE LE DEFAUT N'EXISTAIT PAS : auClavier est pose sur le
  // CHAMP, et le panneau n'avait aucun autre element focalisable. Des qu'on y
  // met cinq cases, Echap depuis une case ne fermait plus rien.
  it("Echap depuis une case a cocher ferme la modale", async () => {
    const w = await ouvrir();
    const racine = w.document.querySelector(".search-modal");
    expect(racine.classList.contains("open")).toBe(true);
    caseDe(w, "blog").dispatchEvent(
      new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(racine.classList.contains("open")).toBe(false);
  });

  // CE QUE MON CODE PEUT REELLEMENT CASSER SUR ESPACE.
  //
  // Cocher une case a la barre d'espace est le comportement natif du
  // navigateur : aucune ligne d'ici ne le produit, et il ne se teste pas en
  // jsdom (qui n'execute pas les actions par defaut) ni au pilote d'ecran
  // utilise ici (il livre les keydown avec un `code` vide, donc le navigateur
  // n'y voit pas une barre d'espace -- mesure du 27 aout).
  //
  // La SEULE chose qui pourrait le casser depuis ce fichier, c'est un
  // gestionnaire qui annule l'evenement. C'est donc ce qu'on verifie : Espace
  // sur une case traverse sans etre annule. Le gestionnaire du panneau, lui,
  // n'annule que Echap.
  it("aucun gestionnaire n'annule Espace sur une case — le natif peut cocher", async () => {
    const w = await ouvrir();
    const e = new w.KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true });
    caseDe(w, "blog").dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it("Echap depuis le champ efface d'abord, il ne ferme pas du premier coup", async () => {
    const w = await ouvrir();
    const champ = taper(w, "din 933");
    const racine = w.document.querySelector(".search-modal");
    champ.dispatchEvent(
      new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(champ.value).toBe("");
    expect(racine.classList.contains("open")).toBe(true);
  });
});
