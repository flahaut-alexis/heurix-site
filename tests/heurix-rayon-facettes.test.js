/* Heurix.browsePanel — facettes (etape 2).
 *
 * LE PREMIER TEST DE CE FICHIER A ETE ECRIT AVANT LES FACETTES, et
 * volontairement : c'est le garde qui empeche d'ajouter un referentiel par
 * commodite. Un widget qui connaitrait la liste des huit familles du
 * catalogue en dessinerait huit sur un rayon qui n'en contient que trois --
 * et les cinq cases mortes seraient indiscernables d'un bug de decompte.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-browse-widget.js"), "utf8");

/* Les chiffres sont ceux du VRAI rayon visserie de quincaillerie-nord,
 * releves sur l'API le 29 aout apres reindexation. `famille` n'y rend que
 * trois valeurs sur les huit du catalogue, parce que la visserie ne
 * contient que celles-la. C'est le cas qui teste le widget. */
const FACETTES_VISSERIE = {
  famille: { "Vis": 1484, "Écrou": 285, "Rondelle": 218 },
  matiere: { "inox A4": 479, "inox A2": 408, "laiton": 338, "nylon": 278, "acier zingué": 248, "acier brut": 236 },
  norme: { "DIN 933": 220, "NF E 25-112": 211, "NF E 27-011": 207, "DIN 934": 197,
           "ISO 4762": 191, "ISO 7089": 184, "DIN 125": 181, "ISO 4014": 179, "DIN 912": 178 },
};
const TOTAL = 1987;
const LES_HUIT_FAMILLES = ["Vis", "Écrou", "Rondelle", "Boulon", "Goujon", "Cheville", "Insert", "Tige filetée"];

function fiches(n, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({
    product: { id: "REF-" + (offset + i), name: "Vis " + (offset + i), price: 2 },
    in_stock: true,
  }));
}

/* Le faux moteur applique reellement le OU et le ET, pour que les tests
 * portent sur le widget et pas sur une reponse figee. `tuyau: false`
 * reproduit le moteur DEPLOYE : la valeur « A|B » n'existe pas, donc zero
 * resultat, pendant que les decomptes -- qui ignorent le champ filtre --
 * restent positifs. C'est la contradiction exacte mesuree en production. */
function moteur({ tuyau = true, total = TOTAL, facettes = FACETTES_VISSERIE } = {}) {
  return function (url) {
    const u = new URL(String(url));
    const brut = u.searchParams.get("filters") || "";
    const demandees = (u.searchParams.get("facets") || "").split(",").filter(Boolean);
    const paires = brut.split(",").filter((c) => c.includes(":")).map((c) => {
      const i = c.indexOf(":");
      return [c.slice(0, i), c.slice(i + 1)];
    });
    let n = total;
    paires.forEach(([champ, val]) => {
      const alternatives = tuyau ? val.split("|") : [val];
      const dispo = facettes[champ] || {};
      n = Math.min(n, alternatives.reduce((s, v) => s + (dispo[v] || 0), 0));
    });
    const f = {};
    demandees.forEach((champ) => { if (facettes[champ]) f[champ] = facettes[champ]; });
    const limit = Number(u.searchParams.get("limit"));
    const offset = Number(u.searchParams.get("offset"));
    return { category: "visserie", sort: "stock", total: n, offset, limit,
             hits: fiches(Math.max(0, Math.min(limit, n - offset)), offset), facets: f };
  };
}

function charger({ lang = "fr", rendre = moteur() } = {}) {
  const dom = new JSDOM(`<!doctype html><html lang="${lang}"><body><div id="c"></div></body></html>`,
    { url: "http://localhost/" });
  const appels = [];
  const faux = async (url) => {
    appels.push(String(url));
    return { ok: true, status: 200, json: async () => rendre(url) };
  };
  global.window = dom.window; global.document = dom.window.document;
  global.fetch = faux; dom.window.fetch = faux;
  dom.window.eval(SOURCE);
  return { win: dom.window, doc: dom.window.document, appels };
}

const BASE = { apiKey: "hxp_t", catalog: "quincaillerie-nord", category: "visserie",
               containerId: "c", facets: ["famille", "matiere", "norme"] };
const souffle = () => new Promise((r) => setTimeout(r, 30));
const cases = (doc, champ) => [...doc.querySelectorAll(
  champ ? `input[type=checkbox][data-champ="${champ}"]` : "input[type=checkbox]")];

beforeEach(() => { global.console = { ...console, warn: () => {}, error: () => {} }; });

// ===========================================================================
describe("LE GARDE : aucune liste connue, jamais", () => {
  it("dessine EXACTEMENT les trois familles que l'API renvoie, pas les huit du catalogue", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const valeurs = cases(doc, "famille").map((c) => c.value);
    expect(valeurs).toEqual(["Vis", "Écrou", "Rondelle"]);
    // et aucune des cinq autres familles du catalogue n'apparait nulle part
    const texte = doc.getElementById("c").textContent;
    LES_HUIT_FAMILLES.slice(3).forEach((absente) => {
      expect(texte).not.toContain(absente);
    });
  });

  it("ne dessine aucun groupe pour un champ que l'API ne renvoie pas", async () => {
    // `couleur` est demande par le marchand mais absent du catalogue :
    // l'API ne renvoie pas la clef, le widget ne dessine pas le groupe --
    // plutot qu'un rail vide avec un titre orphelin.
    const { win, doc } = charger();
    win.Heurix.browsePanel({ ...BASE, facets: ["famille", "couleur"] });
    await souffle();
    expect(cases(doc, "famille")).toHaveLength(3);
    expect(cases(doc, "couleur")).toHaveLength(0);
    expect(doc.getElementById("c").textContent).not.toContain("couleur");
  });

  it("suit l'API quand elle change d'avis entre deux requetes", async () => {
    // Rien n'est mis en cache cote widget : si un rayon perd une valeur,
    // la case disparait.
    let second = false;
    const rendre = (url) => {
      const d = moteur()(url);
      if (second) d.facets = { famille: { "Vis": 12 } };
      return d;
    };
    const { win, doc } = charger({ rendre });
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    expect(cases(doc, "famille")).toHaveLength(3);
    second = true;
    await p.goToPage(2); await souffle();
    expect(cases(doc, "famille").map((c) => c.value)).toEqual(["Vis"]);
  });
});

// ===========================================================================
describe("le decompte « sans valeur » — derive, jamais stocke", () => {
  it("affiche 239 sans norme sur le rayon non filtre (1987 - 1748)", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const sans = [...doc.querySelectorAll(".hx-rayon-sans")].map((e) => e.textContent);
    expect(sans).toContain("239 sans norme");
  });

  it("n'en affiche aucun pour un champ dont la somme couvre le total", async () => {
    // famille (1484+285+218=1987) et matiere (=1987) couvrent tout le rayon.
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const sans = [...doc.querySelectorAll(".hx-rayon-sans")].map((e) => e.textContent);
    expect(sans).toHaveLength(1);
    expect(sans[0]).toContain("norme");
  });

  it("SE RECALCULE quand un filtre est applique sur un AUTRE champ", async () => {
    /* Mesure sur l'API le 29 aout : filtre matiere:laiton -> total 338,
     * somme(norme) 298, donc 40 sans norme. Les decomptes de norme sont
     * calcules avec le filtre de matiere applique, donc les deux nombres
     * portent bien sur le meme ensemble et la soustraction reste juste. */
    const facettes = {
      famille: { "Vis": 338 },
      matiere: { "inox A4": 479, "laiton": 338 },
      norme: { "DIN 933": 150, "DIN 934": 148 },  // somme 298
    };
    const { win, doc } = charger({ rendre: moteur({ total: 338, facettes }) });
    win.Heurix.browsePanel(BASE);
    await souffle();
    const c = cases(doc, "matiere").find((x) => x.value === "laiton");
    c.checked = true;
    c.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect([...doc.querySelectorAll(".hx-rayon-sans")].map((e) => e.textContent))
      .toContain("40 sans norme");
  });

  it("DISPARAIT des qu'un filtre porte sur CE champ : la soustraction n'a plus de sens", async () => {
    /* Mesure sur l'API : filtre norme:DIN 933 -> total 220, mais
     * somme(norme) reste 1748 (les decomptes d'un champ ignorent les
     * filtres de ce champ). 220 - 1748 = -1528, absurde. */
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect([...doc.querySelectorAll(".hx-rayon-sans")]).toHaveLength(1);
    const c = cases(doc, "norme").find((x) => x.value === "DIN 933");
    c.checked = true;
    c.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect([...doc.querySelectorAll(".hx-rayon-sans")]).toHaveLength(0);
  });

  it("n'est jamais cliquable : l'API n'a aucun filtre « champ absent »", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const sans = doc.querySelector(".hx-rayon-sans");
    expect(sans.tagName).toBe("P");
    expect(sans.querySelector("input,button,a")).toBe(null);
  });

  it("ne s'affiche pas quand la somme DEPASSE le total (champ a valeurs multiples)", async () => {
    // Un produit portant deux etiquettes compte dans les deux decomptes :
    // la soustraction rendrait un negatif.
    const facettes = { tags: { promo: 900, destockage: 800 } };
    const { win, doc } = charger({ rendre: moteur({ total: 1000, facettes }) });
    win.Heurix.browsePanel({ ...BASE, facets: ["tags"] });
    await souffle();
    expect([...doc.querySelectorAll(".hx-rayon-sans")]).toHaveLength(0);
  });
});

// ===========================================================================
describe("multi-select et detection du moteur sans tuyau", () => {
  it("MOTEUR NEUF : deux valeurs cochees partent en OU, et le multi-select tient", async () => {
    const { win, doc, appels } = charger({ rendre: moteur({ tuyau: true }) });
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    for (const v of ["inox A4", "inox A2"]) {
      const c = cases(doc, "matiere").find((x) => x.value === v);
      c.checked = true;
      c.dispatchEvent(new win.Event("change", { bubbles: true }));
      await souffle();
    }
    expect(decodeURIComponent(appels.at(-1))).toContain("filters=matiere:inox A4|inox A2");
    expect(p.getState().multiSelect).toBe(true);
    expect(p.getState().filters).toEqual({ matiere: ["inox A4", "inox A2"] });
  });

  it("MOTEUR NEUF : la detection ne se declenche JAMAIS, meme total non nul", async () => {
    // Verifie sur 50 combinaisons reelles contre les deux moteurs le
    // 29 aout : 0/50 sur le moteur avec tuyau, 50/50 sans. Ici on verrouille
    // l'invariant : total > 0 suffit a exclure la contradiction.
    const { win, doc, appels } = charger({ rendre: moteur({ tuyau: true }) });
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    const n = appels.length;
    for (const v of ["Vis", "Écrou", "Rondelle"]) {
      const c = cases(doc, "famille").find((x) => x.value === v);
      c.checked = true;
      c.dispatchEvent(new win.Event("change", { bubbles: true }));
      await souffle();
    }
    expect(p.getState().multiSelect).toBe(true);
    // trois coches = trois requetes, aucune requete de repli supplementaire
    expect(appels.length).toBe(n + 3);
  });

  it("MOTEUR NEUF : un zero LEGITIME ne declenche pas le repli", async () => {
    /* LE FAUX POSITIF QUI COUTERAIT LE PLUS CHER. Sur un moteur neuf, une
     * combinaison de filtres peut tres bien ne rien rendre -- « nylon ou
     * laiton » ET « Rondelle », s'il n'existe aucune rondelle dans ces
     * matieres. Le total est alors nul SANS aucune contradiction, parce que
     * les decomptes des valeurs cochees sont nuls eux aussi : ils sont
     * calcules avec le filtre de famille applique.
     *
     * Un repli declenche ici desactiverait le multi-select alors qu'il
     * fonctionne, et sans jamais se reactiver.
     *
     * C'est ce qui distingue la detection d'une heuristique : elle exige
     * total == 0 ET un decompte STRICTEMENT POSITIF sur une valeur cochee.
     * Le second terme est ce que ce test verrouille -- sans lui, ce cas
     * passerait pour un moteur ancien.
     */
    const rendre = (url) => {
      const u = new URL(String(url));
      const f = u.searchParams.get("filters") || "";
      // deux filtres actifs, dont un OU : combinaison sans resultat
      const vide = f.includes("|") && f.includes("famille:");
      return { category: "visserie", sort: "stock", total: vide ? 0 : TOTAL,
               offset: 0, limit: 24, hits: vide ? [] : fiches(24),
               facets: { famille: { "Vis": 1484, "Écrou": 285, "Rondelle": 218 },
                         // les valeurs cochees tombent a zero une fois la
                         // famille filtree : l'API ne les renvoie plus
                         matiere: vide ? { "inox A4": 218 }
                                       : { "inox A4": 479, "nylon": 278, "laiton": 338 } } };
    };
    const { win, doc } = charger({ rendre });
    const p = win.Heurix.browsePanel({ ...BASE, facets: ["famille", "matiere"] });
    await souffle();
    for (const v of ["nylon", "laiton"]) {
      const c = cases(doc, "matiere").find((x) => x.value === v);
      c.checked = true; c.dispatchEvent(new win.Event("change", { bubbles: true }));
      await souffle();
    }
    const cf = cases(doc, "famille").find((x) => x.value === "Rondelle");
    cf.checked = true; cf.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();

    expect(p.getState().filters.matiere).toEqual(["nylon", "laiton"]);
    expect(p.getState().multiSelect).toBe(true);   // <- le coeur du test
  });

  it("MOTEUR ANCIEN : la contradiction est detectee et le widget se replie", async () => {
    const { win, doc, appels } = charger({ rendre: moteur({ tuyau: false }) });
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    for (const v of ["inox A4", "inox A2"]) {
      const c = cases(doc, "matiere").find((x) => x.value === v);
      c.checked = true;
      c.dispatchEvent(new win.Event("change", { bubbles: true }));
      await souffle();
    }
    expect(p.getState().multiSelect).toBe(false);
    // une seule valeur retenue : la derniere cochee
    expect(p.getState().filters).toEqual({ matiere: ["inox A2"] });
    expect(decodeURIComponent(appels.at(-1))).toContain("filters=matiere:inox A2");
    expect(decodeURIComponent(appels.at(-1))).not.toContain("|");
    // et l'ecran n'est PAS vide : c'est tout l'objet du repli
    expect(doc.querySelectorAll(".heurix-product").length).toBeGreaterThan(0);
  });

  it("MOTEUR ANCIEN : le repli ne coute qu'UNE requete, pas une par coche", async () => {
    const { win, doc, appels } = charger({ rendre: moteur({ tuyau: false }) });
    win.Heurix.browsePanel(BASE);
    await souffle();
    const cocher = async (v) => {
      const c = cases(doc, "matiere").find((x) => x.value === v);
      c.checked = true;
      c.dispatchEvent(new win.Event("change", { bubbles: true }));
      await souffle();
    };
    await cocher("inox A4");
    const avant = appels.length;
    await cocher("inox A2");          // declenche la detection : 1 requete + 1 repli
    const apresDetection = appels.length;
    expect(apresDetection - avant).toBe(2);
    await cocher("laiton");           // deja replie : plus aucune requete de detection
    expect(appels.length - apresDetection).toBe(1);
  });

  it("une seule valeur cochee n'envoie jamais de tuyau, sur aucun moteur", async () => {
    for (const tuyau of [true, false]) {
      const { win, doc, appels } = charger({ rendre: moteur({ tuyau }) });
      win.Heurix.browsePanel(BASE);
      await souffle();
      const c = cases(doc, "matiere").find((x) => x.value === "laiton");
      c.checked = true;
      c.dispatchEvent(new win.Event("change", { bubbles: true }));
      await souffle();
      expect(decodeURIComponent(appels.at(-1))).toContain("filters=matiere:laiton");
      expect(appels.at(-1)).not.toContain("%7C");
    }
  });

  it("decocher retire la valeur, et vider retire tout", async () => {
    const { win, doc, appels } = charger();
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    const c = cases(doc, "matiere").find((x) => x.value === "laiton");
    c.checked = true; c.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect(p.getState().filters).toEqual({ matiere: ["laiton"] });
    const c2 = cases(doc, "matiere").find((x) => x.value === "laiton");
    c2.checked = false; c2.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect(p.getState().filters).toEqual({});
    expect(appels.at(-1)).not.toContain("filters=");
  });

  it("le bouton vider n'apparait que s'il y a quelque chose a vider", async () => {
    const { win, doc } = charger();
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelector(".hx-rayon-vider")).toBe(null);
    const c = cases(doc, "famille").find((x) => x.value === "Vis");
    c.checked = true; c.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect(doc.querySelector(".hx-rayon-vider")).not.toBe(null);
    doc.querySelector(".hx-rayon-vider").dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await souffle();
    expect(p.getState().filters).toEqual({});
    expect(doc.querySelector(".hx-rayon-vider")).toBe(null);
  });

  it("filtrer ramene a la page 1", async () => {
    const { win, doc, appels } = charger();
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    await p.goToPage(5); await souffle();
    expect(p.getState().page).toBe(5);
    const c = cases(doc, "famille").find((x) => x.value === "Vis");
    c.checked = true; c.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect(p.getState().page).toBe(1);
    expect(appels.at(-1)).toContain("offset=0");
  });

  it("un filtre qui ne rend rien garde le rail : sinon on ne peut plus le defaire", async () => {
    const { win, doc } = charger({ rendre: moteur({ total: 0 }) });
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelector(".hx-rayon-etat")).not.toBe(null);
    expect(cases(doc).length).toBeGreaterThan(0);
  });
});

// ===========================================================================
describe("clavier et focus sur le rail", () => {
  it("de vraies cases natives : Tab les atteint, Espace les coche sans notre code", async () => {
    /* Meme methode qu'a l'etape 1, et meme limite : l'outil de pilotage ne
     * livre pas de touche identifiable, donc l'activation native n'est pas
     * verifiable a l'ecran. On teste ce que CE code pourrait casser. */
    const { win, doc } = charger();
    const types = [];
    const vrai = win.EventTarget.prototype.addEventListener;
    win.EventTarget.prototype.addEventListener = function (t) { types.push(t); return vrai.apply(this, arguments); };
    win.Heurix.browsePanel(BASE);
    await souffle();
    win.EventTarget.prototype.addEventListener = vrai;
    expect(types.filter((t) => /^key/.test(t))).toEqual([]);
    const cs = cases(doc);
    expect(cs.length).toBeGreaterThan(0);
    expect(cs.every((c) => c.tagName === "INPUT" && c.type === "checkbox")).toBe(true);
    expect(cs.every((c) => !c.hasAttribute("tabindex"))).toBe(true);
    expect(cs.every((c) => !c.disabled)).toBe(true);
    // chaque case est dans un <label>, donc son texte est cliquable aussi
    expect(cs.every((c) => c.closest("label") !== null)).toBe(true);
  });

  it("chaque groupe est un fieldset nomme par une legend", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const gs = [...doc.querySelectorAll("fieldset.hx-rayon-groupe")];
    expect(gs).toHaveLength(3);
    expect(gs.map((g) => g.querySelector("legend").textContent)).toEqual(["Famille", "Matiere", "Norme"]);
  });

  it("le decompte est DANS le libelle accessible de la case", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const c = cases(doc, "famille").find((x) => x.value === "Vis");
    expect(c.getAttribute("aria-label")).toBe("Vis, 1484 produits");
  });

  it("LE FOCUS NE TOMBE PAS quand cocher redessine le rail", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const c = cases(doc, "matiere").find((x) => x.value === "laiton");
    c.focus();
    c.checked = true;
    c.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect(doc.activeElement).not.toBe(doc.body);
    expect(doc.activeElement.getAttribute("data-champ")).toBe("matiere");
    expect(doc.activeElement.value).toBe("laiton");
    expect(doc.activeElement.checked).toBe(true);
  });

  it("se replie sur le compte si la case cochee disparait du rail", async () => {
    // Le filtre fait tomber les autres valeurs a zero : l'API ne les
    // renvoie plus, la case n'existe plus apres redessin.
    let filtre = false;
    const rendre = (url) => {
      const d = moteur()(url);
      if (filtre) d.facets = { famille: { "Vis": 1484 }, matiere: { "inox A4": 479 } };
      return d;
    };
    const { win, doc } = charger({ rendre });
    win.Heurix.browsePanel(BASE);
    await souffle();
    const c = cases(doc, "norme").find((x) => x.value === "DIN 933");
    c.focus(); c.checked = true;
    filtre = true;
    c.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect(doc.activeElement).not.toBe(doc.body);
    expect(doc.activeElement.classList.contains("hx-rayon-compte")).toBe(true);
  });

  it("vider rend le focus au compte, puisque le bouton disparait", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const c = cases(doc, "famille").find((x) => x.value === "Vis");
    c.checked = true; c.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    const b = doc.querySelector(".hx-rayon-vider");
    b.focus();
    b.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await souffle();
    expect(doc.activeElement.classList.contains("hx-rayon-compte")).toBe(true);
  });
});

// ===========================================================================
describe("le rail replie sur petit ecran", () => {
  function chargerAvecLargeur(petit) {
    const dom = new JSDOM(`<!doctype html><html lang="fr"><body><div id="c"></div></body></html>`,
      { url: "http://localhost/" });
    dom.window.matchMedia = (q) => ({ matches: petit && /max-width:\s*720px/.test(q),
                                      media: q, addListener() {}, removeListener() {} });
    const faux = async (url) => ({ ok: true, status: 200, json: async () => moteur()(url) });
    global.window = dom.window; global.document = dom.window.document;
    global.fetch = faux; dom.window.fetch = faux;
    dom.window.eval(SOURCE);
    return { win: dom.window, doc: dom.window.document };
  }

  it("deplie d'emblee au-dessus de 720 px", async () => {
    const { win, doc } = chargerAvecLargeur(false);
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelector(".hx-rayon-repli").open).toBe(true);
  });

  it("replie d'emblee en dessous : la marchandise reste visible sans defiler", async () => {
    const { win, doc } = chargerAvecLargeur(true);
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelector(".hx-rayon-repli").open).toBe(false);
  });

  it("le resume compte les filtres actifs", async () => {
    const { win, doc } = chargerAvecLargeur(true);
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelector(".hx-rayon-repli > summary").textContent).toBe("Filtres");
    const d = doc.querySelector(".hx-rayon-repli");
    d.open = true; d.dispatchEvent(new win.Event("toggle"));
    const c = cases(doc, "famille").find((x) => x.value === "Vis");
    c.checked = true; c.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect(doc.querySelector(".hx-rayon-repli > summary").textContent).toBe("Filtres (1)");
  });

  it("L'ETAT DEPLIE SURVIT AU REDESSIN : cocher ne referme pas le rail", async () => {
    // Sans cela, un visiteur sur telephone qui ouvre les filtres et coche
    // une case voit le rail se refermer sous son doigt, et doit le rouvrir
    // pour la case suivante.
    const { win, doc } = chargerAvecLargeur(true);
    win.Heurix.browsePanel(BASE);
    await souffle();
    const d = doc.querySelector(".hx-rayon-repli");
    d.open = true;
    d.dispatchEvent(new win.Event("toggle"));
    const c = cases(doc, "famille").find((x) => x.value === "Vis");
    c.checked = true; c.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect(doc.querySelector(".hx-rayon-repli").open).toBe(true);
  });

  it("<details> natif : aucun ecouteur clavier, l'ouverture est celle du navigateur", async () => {
    const { win, doc } = chargerAvecLargeur(true);
    const types = [];
    const vrai = win.EventTarget.prototype.addEventListener;
    win.EventTarget.prototype.addEventListener = function (t) { types.push(t); return vrai.apply(this, arguments); };
    win.Heurix.browsePanel(BASE);
    await souffle();
    win.EventTarget.prototype.addEventListener = vrai;
    expect(types.filter((t) => /^key/.test(t))).toEqual([]);
    expect(doc.querySelector(".hx-rayon-repli").tagName).toBe("DETAILS");
    expect(doc.querySelector(".hx-rayon-repli > summary").tagName).toBe("SUMMARY");
    expect(doc.querySelector("summary").hasAttribute("tabindex")).toBe(false);
  });
});
