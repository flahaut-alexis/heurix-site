/* Heurix.browsePanel — tri et merchandising (etape 3). */
import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-browse-widget.js"), "utf8");

function hits(n, { prix = true, epingle = [], relegue = [] } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const p = { id: "P" + i, name: "Vis " + i };
    if (prix) p.price = 2 + i;
    return { product: p, in_stock: true,
             pinned: epingle.includes("P" + i), buried: relegue.includes("P" + i) };
  });
}

function charger({ lang = "fr", reponse = null } = {}) {
  const dom = new JSDOM(`<!doctype html><html lang="${lang}"><body><div id="c"></div></body></html>`,
    { url: "http://localhost/" });
  dom.window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  const appels = [];
  const faux = async (url) => {
    appels.push(String(url));
    const u = new URL(String(url));
    const d = reponse ? reponse(u) : { hits: hits(6) };
    return { ok: true, status: 200,
             json: async () => ({ category: "visserie", sort: u.searchParams.get("sort"),
                                  total: d.total != null ? d.total : 120,
                                  offset: Number(u.searchParams.get("offset")), limit: 24,
                                  hits: d.hits, facets: d.facets }) };
  };
  global.window = dom.window; global.document = dom.window.document;
  global.fetch = faux; dom.window.fetch = faux;
  dom.window.eval(SOURCE);
  return { win: dom.window, doc: dom.window.document, appels };
}

const BASE = { apiKey: "hxp_t", catalog: "q", category: "visserie", containerId: "c" };
const souffle = () => new Promise((r) => setTimeout(r, 30));
const options = (doc) => [...doc.querySelectorAll(".hx-rayon-tri option")].map((o) => o.value);

beforeEach(() => { global.console = { ...console, warn: () => {}, error: () => {} }; });

// ===========================================================================
describe("la barre de tri", () => {
  it("offre les tris utiles a un ACHETEUR, et pas la marge", async () => {
    // Le moteur sait trier par marge ; « classer la boutique par ma marge »
    // reste une strategie de marchand, pas un choix d'acheteur.
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(options(doc)).toEqual(["stock", "price_asc", "price_desc", "alphabetical", "recent", "popular"]);
    expect(options(doc)).not.toContain("margin");
  });

  it("le marchand peut imposer sa propre liste, marge comprise", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel({ ...BASE, sorts: ["stock", "margin"] });
    await souffle();
    expect(options(doc)).toEqual(["stock", "margin"]);
  });

  it("margin reste utilisable en tri PAR DEFAUT sans etre offert", async () => {
    const { win, appels } = charger();
    win.Heurix.browsePanel({ ...BASE, sort: "margin" });
    await souffle();
    expect(appels[0]).toContain("sort=margin");
  });

  it("un tri inconnu du widget est ignore, pas affiche vide", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel({ ...BASE, sorts: ["stock", "n_importe_quoi", "alphabetical"] });
    await souffle();
    expect(options(doc)).toEqual(["stock", "alphabetical"]);
  });

  it("un seul choix n'est pas un choix : aucune barre dessinee", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel({ ...BASE, sorts: ["stock"] });
    await souffle();
    expect(doc.querySelector(".hx-rayon-tri")).toBe(null);
  });

  it("RETIRE LES TRIS DE PRIX quand l'API ne sert aucun prix", async () => {
    /* Consequence mesuree du chantier « un prix par cle publique » : une
     * cle reglee price_visible:false recoit des produits dont le champ
     * price a DISPARU, pendant que le moteur continue de trier dessus.
     * Verifie sur le moteur reel le 29 aout -- l'ordre change, et rien a
     * l'ecran ne l'explique. */
    const { win, doc } = charger({ reponse: () => ({ hits: hits(6, { prix: false }) }) });
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(options(doc)).toEqual(["stock", "alphabetical", "recent", "popular"]);
    expect(options(doc)).not.toContain("price_asc");
  });

  it("les garde des qu'un seul produit porte un prix", async () => {
    const { win, doc } = charger({ reponse: () => {
      const h = hits(6, { prix: false });
      h[3].product.price = 9.9;
      return { hits: h };
    } });
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(options(doc)).toContain("price_asc");
  });

  it("changer le tri relance la requete et repart de la page 1", async () => {
    const { win, doc, appels } = charger();
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    await p.goToPage(3); await souffle();
    const sel = doc.querySelector(".hx-rayon-tri");
    sel.value = "price_asc";
    sel.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect(appels.at(-1)).toContain("sort=price_asc");
    expect(appels.at(-1)).toContain("offset=0");
    expect(p.getState().sort).toBe("price_asc");
    expect(p.getState().page).toBe(1);
  });

  it("un <select> natif : aucun ecouteur clavier, aucun tabindex", async () => {
    const { win, doc } = charger();
    const types = [];
    const vrai = win.EventTarget.prototype.addEventListener;
    win.EventTarget.prototype.addEventListener = function (t) { types.push(t); return vrai.apply(this, arguments); };
    win.Heurix.browsePanel(BASE);
    await souffle();
    win.EventTarget.prototype.addEventListener = vrai;
    expect(types.filter((t) => /^key/.test(t))).toEqual([]);
    const sel = doc.querySelector(".hx-rayon-tri");
    expect(sel.tagName).toBe("SELECT");
    expect(sel.hasAttribute("tabindex")).toBe(false);
    // et il est nomme par un <label for>, pas par un aria-label devine
    const lab = doc.querySelector('label[for="' + sel.id + '"]');
    expect(lab).not.toBe(null);
    expect(lab.textContent).toBe("Trier par");
  });

  it("traduit les libelles de tri sur une page anglaise", async () => {
    const { win, doc } = charger({ lang: "en" });
    win.Heurix.browsePanel(BASE);
    await souffle();
    const libelles = [...doc.querySelectorAll(".hx-rayon-tri option")].map((o) => o.textContent);
    expect(libelles).toContain("Price, low to high");
    expect(doc.querySelector("label[for]").textContent).toBe("Sort by");
  });

  it("LE FOCUS NE TOMBE PAS quand changer le tri redessine la barre", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const sel = doc.querySelector(".hx-rayon-tri");
    sel.focus();
    sel.value = "alphabetical";
    sel.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect(doc.activeElement).not.toBe(doc.body);
    expect(doc.activeElement.classList.contains("hx-rayon-tri")).toBe(true);
    expect(doc.activeElement.value).toBe("alphabetical");
  });
});

// ===========================================================================
describe("le merchandising, rendu visible", () => {
  /* MESURE DU 29 AOUT sur le moteur reel : l'epinglage GAGNE TOUJOURS sur
   * le tri. Quatre produits, p2 le plus cher epingle en position 1 :
   *     sans epinglage, prix croissant   p3(2) p1(8) p0(10) p2(12)
   *     p2 epingle,     prix croissant   p2(12) p3(2) p1(8) p0(10)
   * Une liste « prix croissant » qui commence au plus cher se lit comme un
   * tri casse. C'est ce que ces tests empechent de taire. */

  it("marque le produit epingle", async () => {
    const { win, doc } = charger({ reponse: () => ({ hits: hits(4, { epingle: ["P2"] }) }) });
    win.Heurix.browsePanel(BASE);
    await souffle();
    const m = doc.querySelectorAll(".hx-rayon-marque-epingle");
    expect(m).toHaveLength(1);
    expect(m[0].textContent).toBe("Mis en avant");
    expect(m[0].getAttribute("title")).toBe("Mis en avant par le marchand");
  });

  it("marque le produit relegue", async () => {
    const { win, doc } = charger({ reponse: () => ({ hits: hits(4, { relegue: ["P0"] }) }) });
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelector(".hx-rayon-marque-relegue").textContent).toBe("En fin de rayon");
  });

  it("explique l'ordre force, une seule fois pour la page", async () => {
    const { win, doc } = charger({ reponse: () => ({ hits: hits(4, { epingle: ["P1"], relegue: ["P3"] }) }) });
    win.Heurix.browsePanel(BASE);
    await souffle();
    const notes = doc.querySelectorAll(".hx-rayon-note");
    expect(notes).toHaveLength(1);
    expect(notes[0].textContent).toContain("placés par le marchand");
  });

  it("NE DIT RIEN quand aucun produit n'est place a la main", async () => {
    // La note explique ce qu'on voit ; elle n'avertit pas d'une possibilite.
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelector(".hx-rayon-note")).toBe(null);
    expect(doc.querySelector(".hx-rayon-marque")).toBe(null);
  });

  it("la note disparait en changeant de page si la nouvelle n'a rien de force", async () => {
    let premiere = true;
    const { win, doc } = charger({ reponse: () => {
      const h = premiere ? hits(4, { epingle: ["P1"] }) : hits(4);
      premiere = false;
      return { hits: h };
    } });
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelector(".hx-rayon-note")).not.toBe(null);
    await p.goToPage(2); await souffle();
    expect(doc.querySelector(".hx-rayon-note")).toBe(null);
  });

  it("l'etiquette survit au changement de tri : l'epinglage gagne partout", async () => {
    const { win, doc } = charger({ reponse: () => ({ hits: hits(4, { epingle: ["P2"] }) }) });
    win.Heurix.browsePanel(BASE);
    await souffle();
    const sel = doc.querySelector(".hx-rayon-tri");
    sel.value = "price_asc";
    sel.dispatchEvent(new win.Event("change", { bubbles: true }));
    await souffle();
    expect(doc.querySelectorAll(".hx-rayon-marque-epingle")).toHaveLength(1);
    expect(doc.querySelector(".hx-rayon-note")).not.toBe(null);
  });

  it("l'etiquette est un ajout, elle ne remplace pas la fiche", async () => {
    const { win, doc } = charger({ reponse: () => ({ hits: hits(4, { epingle: ["P2"] }) }) });
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelectorAll(".heurix-product")).toHaveLength(4);
    expect(doc.querySelectorAll(".heurix-name")).toHaveLength(4);
  });

  it("traduit les etiquettes sur une page anglaise", async () => {
    const { win, doc } = charger({ lang: "en", reponse: () => ({ hits: hits(4, { epingle: ["P2"], relegue: ["P0"] }) }) });
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelector(".hx-rayon-marque-epingle").textContent).toBe("Featured");
    expect(doc.querySelector(".hx-rayon-marque-relegue").textContent).toBe("End of aisle");
    expect(doc.querySelector(".hx-rayon-note").textContent).toContain("regardless of sorting");
  });
});
