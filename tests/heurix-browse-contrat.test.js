/* CONTRAT PUBLIE DE `Heurix.browse` — test de caracterisation.
 *
 * POURQUOI CE FICHIER EXISTE, ET CE QU'IL N'EST PAS. Ce n'est pas un test
 * de ce que `Heurix.browse` DEVRAIT faire. C'est un releve de ce qu'il
 * FAIT au 29 aout 2026, ecrit avant de faire grandir le fichier, pour que
 * toute modification du comportement existant se signale.
 *
 * LA RAISON EST LA FORME DE LA DISTRIBUTION, pas la qualite du code.
 * `downloads/heurix-browse-widget.js` se telecharge et s'heberge CHEZ LE
 * MARCHAND. Il ne se met pas a jour, et surtout : une regression chez lui
 * ne nous revient jamais. Il n'y a pas de sentinelle, pas de journal, pas
 * de client qui appelle -- juste une page de categorie qui s'affiche mal
 * chez quelqu'un qui ne fera pas le lien avec nous. C'est la configuration
 * exacte ou un test de caracterisation est le seul garde-fou possible.
 *
 * CE QUE VERROUILLE CHAQUE BLOC, dans l'ordre : les options acceptees et
 * leur traduction en URL, ce que la promesse rend, et ce qui est ecrit
 * dans le DOM -- y compris, et surtout, CE QUI NE L'EST PAS.
 *
 * DEUX TESTS VERROUILLENT DES DEFAUTS CONNUS (`offset: 0` omis, et
 * l'absence de controle de `res.ok`). Ils sont ici parce qu'un client
 * peut en dependre, pas parce qu'ils sont justes. Les corriger est une
 * decision legitime : elle doit alors se prendre en changeant CE FICHIER
 * sciemment, pas en decouvrant un echec.
 *
 * L'echappement a son propre fichier (heurix-browse-echappement.test.js)
 * et la langue le sien (heurix-browse-langue.test.js) ; ils ne sont pas
 * recopies ici.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-browse-widget.js"), "utf8");

const HITS = [
  { product: { id: "V1", name: "Vis M8", price: 12.5 }, in_stock: true },
  { product: { id: "V2", name: "Ecrou M8", price: 2 }, in_stock: false },
];

function reponse(hits = HITS) {
  return { category: "visserie", sort: "stock", total: hits.length,
           offset: 0, limit: 20, hits };
}

/* Le corps de la page est fourni par le MARCHAND : le conteneur existe
 * avant l'appel, et il est vide. C'est la situation decrite par le guide
 * du blog (« <div id="ma-page-categorie"></div> »).
 */
function charger({ lang = null, data = reponse(), htmlCorps = '<div id="cible"></div>' } = {}) {
  const attr = lang === null ? "" : ` lang="${lang}"`;
  const dom = new JSDOM(`<!doctype html><html${attr}><body>${htmlCorps}</body></html>`,
    { url: "http://localhost/" });
  const appels = [];
  const faux = async (url, opts) => {
    appels.push({ url: String(url), opts });
    return { ok: true, status: 200, json: async () => data };
  };
  dom.window.fetch = faux;
  global.window = dom.window;
  global.document = dom.window.document;
  global.fetch = faux;
  dom.window.eval(SOURCE);
  return { win: dom.window, doc: dom.window.document, appels };
}

function api(win) {
  return win.Heurix ?? global.Heurix;
}

const BASE = { apiKey: "hxp_test", catalog: "fixtures", category: "visserie" };

let avertissements;
beforeEach(() => {
  avertissements = [];
  global.console = { ...console, warn: (m) => avertissements.push(m) };
});

// ---------------------------------------------------------------------------
describe("Heurix.browse — surface exposee", () => {
  it("s'expose en window.Heurix.browse", () => {
    const { win } = charger();
    expect(typeof api(win).browse).toBe("function");
  });

  it("n'ecrase pas un window.Heurix deja pose par un autre widget", () => {
    // heurix-search.js et heurix-tracker.js posent le meme objet. L'ordre
    // des <script> ne doit jamais decider lequel survit.
    const { win } = charger();
    win.Heurix.searchBox = function dejaLa() {};
    win.eval(SOURCE);
    expect(typeof win.Heurix.searchBox).toBe("function");
    expect(typeof win.Heurix.browse).toBe("function");
  });

  it("expose EXACTEMENT browse et browsePanel, rien de plus", () => {
    // Verrouille la surface : ajouter une fonction publique a ce fichier
    // doit etre un geste conscient, pas un effet de bord.
    //
    // MIS A JOUR LE 29 AOUT 2026, et c'est le test qui a impose de le
    // faire. Il disait `["browse"]` et il est tombe -- seul des 35 -- a
    // l'ajout de browsePanel. C'est exactement le geste conscient qu'il
    // exigeait : la ligne change ICI, en sachant ce qu'on ajoute, plutot
    // qu'une fonction publique n'apparaisse sans que rien ne le signale.
    //
    // Les 34 autres tests ont continue de passer sans une modification,
    // y compris le bloc entier « ce qui n'est PAS ecrit » : c'est la
    // preuve que le chemin Heurix.browse n'a pas bouge.
    const { win } = charger();
    expect(Object.keys(win.Heurix).sort()).toEqual(["browse", "browsePanel"]);
  });
});

// ---------------------------------------------------------------------------
describe("Heurix.browse — options acceptees et URL construite", () => {
  it("appelle api.heurix.fr en dur : il n'y a PAS d'option baseUrl", async () => {
    // Difference avec heurix-search.js, qui accepte `baseUrl`. Un
    // marchand ne peut pas pointer ce fichier ailleurs, et un test le dit
    // plutot que de le laisser decouvrir.
    const { win, appels } = charger();
    await api(win).browse({ ...BASE, baseUrl: "https://exemple.test" });
    expect(appels.at(-1).url.startsWith("https://api.heurix.fr/v1/browse/")).toBe(true);
    expect(appels.at(-1).url).not.toContain("exemple.test");
  });

  it("pose catalogue et categorie dans le CHEMIN, encodes", async () => {
    const { win, appels } = charger();
    await api(win).browse({ ...BASE, catalog: "mon cat", category: "a/b" });
    expect(appels.at(-1).url).toContain("/v1/browse/mon%20cat/a%2Fb?");
  });

  it("envoie toujours sort=, avec 'stock' par defaut", async () => {
    const { win, appels } = charger();
    await api(win).browse(BASE);
    expect(appels.at(-1).url).toContain("sort=stock");
  });

  it("transmet sort, limit et offset quand ils sont fournis", async () => {
    const { win, appels } = charger();
    await api(win).browse({ ...BASE, sort: "price_asc", limit: 24, offset: 48 });
    const u = appels.at(-1).url;
    expect(u).toContain("sort=price_asc");
    expect(u).toContain("limit=24");
    expect(u).toContain("offset=48");
  });

  it("DEFAUT CONNU : offset=0 n'est PAS transmis (0 est falsy)", async () => {
    // Sans consequence tant que le moteur prend 0 par defaut -- il le
    // prend. Verrouille parce qu'un client peut construire son URL en
    // comparant a ce que le widget envoie, pas parce que c'est bien.
    const { win, appels } = charger();
    await api(win).browse({ ...BASE, offset: 0 });
    expect(appels.at(-1).url).not.toContain("offset=");
  });

  it("aplatit l'objet filters en champ:valeur separes par des virgules", async () => {
    const { win, appels } = charger();
    await api(win).browse({ ...BASE, filters: { brand: "Makita", color: "rouge" } });
    expect(decodeURIComponent(appels.at(-1).url)).toContain("filters=brand:Makita,color:rouge");
  });

  it("omet filters quand l'objet est vide", async () => {
    const { win, appels } = charger();
    await api(win).browse({ ...BASE, filters: {} });
    expect(appels.at(-1).url).not.toContain("filters=");
  });

  it("joint le tableau facets par des virgules", async () => {
    const { win, appels } = charger();
    await api(win).browse({ ...BASE, facets: ["brand", "color"] });
    expect(decodeURIComponent(appels.at(-1).url)).toContain("facets=brand,color");
  });

  it("porte la cle en en-tete Authorization: Bearer", async () => {
    const { win, appels } = charger();
    await api(win).browse(BASE);
    expect(appels.at(-1).opts.headers.Authorization).toBe("Bearer hxp_test");
  });

  it("n'exige AUCUNE option : sans apiKey ni catalog, il appelle avec les constantes du fichier", async () => {
    // Contraste volontaire avec Heurix.searchBox, qui jette sur apiKey,
    // catalog ou containerId manquant. Ici l'appel part avec le gabarit
    // « hxp_VOTRE_CLE_PUBLIQUE » -- c'est ce comportement qui a produit
    // « Catalogue indisponible » en vitrine le 26 aout, et c'est aussi
    // celui sur lequel les installations existantes reposent.
    const { win, appels } = charger();
    await expect(api(win).browse({ category: "visserie" })).resolves.toBeTruthy();
    expect(appels.at(-1).opts.headers.Authorization).toBe("Bearer hxp_VOTRE_CLE_PUBLIQUE");
    expect(appels.at(-1).url).toContain("/v1/browse/votre-catalogue/visserie");
  });

  it("appele sans aucun argument, ne jette pas", async () => {
    const { win } = charger();
    await expect(api(win).browse()).resolves.toBeTruthy();
  });

  it("avertit en console si la cle est une cle SERVEUR (hx_)", async () => {
    const { win } = charger();
    await api(win).browse({ ...BASE, apiKey: "hx_cle_serveur" });
    expect(avertissements.join(" ")).toContain("cle SERVEUR");
  });

  it("n'avertit pas pour une cle publique (hxp_)", async () => {
    const { win } = charger();
    await api(win).browse(BASE);
    expect(avertissements.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe("Heurix.browse — ce que rend la promesse", () => {
  it("resout avec la reponse BRUTE de l'API, sans transformation", async () => {
    const data = reponse();
    const { win } = charger({ data });
    const rendu = await api(win).browse(BASE);
    expect(rendu).toEqual(data);
    expect(rendu.hits).toHaveLength(2);
    expect(rendu.total).toBe(2);
  });

  it("resout meme sans containerId, et n'ecrit alors nulle part", async () => {
    // C'est le mode documente « batir votre propre affichage a la main ».
    const { win, doc } = charger();
    const rendu = await api(win).browse(BASE);
    expect(rendu.hits).toHaveLength(2);
    expect(doc.getElementById("cible").innerHTML).toBe("");
  });

  it("resout sans jeter quand containerId ne designe aucun element", async () => {
    const { win } = charger();
    await expect(api(win).browse({ ...BASE, containerId: "absent" })).resolves.toBeTruthy();
  });

  it("DEFAUT CONNU : res.ok n'est pas verifie, une erreur HTTP resout normalement", async () => {
    // Le fichier fait `.then(res => res.json())` sans controle. Une 500
    // qui rend du JSON traverse donc comme un succes, et une 403 de cle
    // invalide affiche « Aucun produit » plutot qu'une erreur. Verrouille
    // pour que le corriger soit un choix, pas une surprise.
    const dom = new JSDOM('<!doctype html><html><body><div id="cible"></div></body></html>',
      { url: "http://localhost/" });
    const faux = async () => ({ ok: false, status: 500, json: async () => reponse([]) });
    dom.window.fetch = faux;
    global.window = dom.window;
    global.document = dom.window.document;
    global.fetch = faux;
    dom.window.eval(SOURCE);
    await expect(api(dom.window).browse({ ...BASE, containerId: "cible" })).resolves.toBeTruthy();
    expect(dom.window.document.getElementById("cible").textContent)
      .toContain("Aucun produit dans cette catégorie");
  });
});

// ---------------------------------------------------------------------------
describe("Heurix.browse — ce qui est ecrit dans le DOM", () => {
  it("remplit le conteneur avec UNE fiche par hit, et rien autour", async () => {
    const { win, doc } = charger();
    await api(win).browse({ ...BASE, containerId: "cible" });
    const cible = doc.getElementById("cible");
    expect(cible.children).toHaveLength(2);
    expect([...cible.children].every((e) => e.className === "heurix-product")).toBe(true);
  });

  it("rend la structure exacte documentee par le blog", async () => {
    const { win, doc } = charger();
    await api(win).browse({ ...BASE, containerId: "cible" });
    const fiche = doc.querySelector(".heurix-product");
    expect(fiche.getAttribute("data-id")).toBe("V1");
    expect(fiche.querySelector(".heurix-name").textContent).toBe("Vis M8");
    expect(fiche.querySelector(".heurix-price").textContent).toBe("12,50 €");
    expect(fiche.querySelector(".heurix-out-of-stock")).toBe(null);
  });

  it("marque la rupture sur le hit hors stock, et lui seul", async () => {
    const { win, doc } = charger();
    await api(win).browse({ ...BASE, containerId: "cible" });
    const ruptures = doc.querySelectorAll(".heurix-out-of-stock");
    expect(ruptures).toHaveLength(1);
    expect(ruptures[0].closest(".heurix-product").getAttribute("data-id")).toBe("V2");
  });

  it("omet le bloc prix quand le produit n'a pas de prix", async () => {
    const { win, doc } = charger({ data: reponse([{ product: { id: "X", name: "Sans prix" }, in_stock: true }]) });
    await api(win).browse({ ...BASE, containerId: "cible" });
    expect(doc.querySelector(".heurix-price")).toBe(null);
  });

  it("retombe sur l'identifiant quand le nom manque", async () => {
    const { win, doc } = charger({ data: reponse([{ product: { id: "REF-42" }, in_stock: true }]) });
    await api(win).browse({ ...BASE, containerId: "cible" });
    expect(doc.querySelector(".heurix-name").textContent).toBe("REF-42");
  });

  it("affiche le message vide par defaut sur zero hit", async () => {
    const { win, doc } = charger({ data: reponse([]) });
    await api(win).browse({ ...BASE, containerId: "cible" });
    expect(doc.getElementById("cible").textContent).toContain("Aucun produit dans cette catégorie");
  });

  it("laisse emptyMessage l'emporter, y compris en anglais", async () => {
    const { win, doc } = charger({ lang: "en", data: reponse([]) });
    await api(win).browse({ ...BASE, containerId: "cible", emptyMessage: "<p>Rien ici</p>" });
    expect(doc.getElementById("cible").innerHTML).toBe("<p>Rien ici</p>");
  });

  it("passe (hit, index, lang) a un renderItem fourni, et rend sa sortie telle quelle", async () => {
    const { win, doc } = charger({ lang: "en" });
    const recus = [];
    await api(win).browse({
      ...BASE, containerId: "cible",
      renderItem: (hit, i, lang) => { recus.push([hit.product.id, i, lang]); return `<li>${hit.product.id}</li>`; },
    });
    expect(recus).toEqual([["V1", 0, "en"], ["V2", 1, "en"]]);
    expect(doc.getElementById("cible").innerHTML).toBe("<li>V1</li><li>V2</li>");
  });

  it("REMPLACE le contenu du conteneur, il ne s'y ajoute pas", async () => {
    const { win, doc } = charger({ htmlCorps: '<div id="cible"><p class="chargement">Chargement…</p></div>' });
    await api(win).browse({ ...BASE, containerId: "cible" });
    expect(doc.querySelector(".chargement")).toBe(null);
  });
});

// ---------------------------------------------------------------------------
describe("Heurix.browse — ce qui n'est PAS ecrit (la contrainte de croissance)", () => {
  /* CE BLOC EST LA RAISON D'ETRE DU FICHIER.
   *
   * Le guide du blog promet, mot pour mot : « chaque produit s'affiche
   * dans un <div class="heurix-product"> simple, a styler avec votre
   * propre CSS ». Un marchand a donc pu ecrire
   * `#ma-page-categorie { display: grid }` -- auquel cas TOUT enfant
   * direct du conteneur devient une cellule de la grille.
   *
   * C'est ce qui rend `containerId` inutilisable comme discriminant pour
   * une future barre d'outils ou une pagination : ajouter un frere aux
   * fiches casserait sa mise en page, sans aucun signal. Toute UI
   * nouvelle passe donc par un POINT D'ENTREE distinct, jamais par une
   * option de celui-ci.
   */
  it("n'injecte AUCUNE feuille de style dans le document", async () => {
    const { win, doc } = charger();
    await api(win).browse({ ...BASE, containerId: "cible" });
    expect(doc.querySelectorAll("style")).toHaveLength(0);
    expect(doc.querySelectorAll("link[rel=stylesheet]")).toHaveLength(0);
  });

  it("ne pose aucune classe ni attribut sur le conteneur lui-meme", async () => {
    const { win, doc } = charger();
    await api(win).browse({ ...BASE, containerId: "cible" });
    const cible = doc.getElementById("cible");
    expect(cible.className).toBe("");
    expect([...cible.attributes].map((a) => a.name)).toEqual(["id"]);
  });

  it("n'ajoute AUCUN frere aux fiches : ni tri, ni facettes, ni pagination, ni annonce", async () => {
    const { win, doc } = charger();
    await api(win).browse({ ...BASE, containerId: "cible" });
    const cible = doc.getElementById("cible");
    expect([...cible.children].map((e) => e.className)).toEqual(["heurix-product", "heurix-product"]);
    expect(cible.querySelector("[aria-live]")).toBe(null);
    expect(cible.querySelector("select, nav, input, button")).toBe(null);
  });

  it("n'ecrit nulle part ailleurs dans la page", async () => {
    const { win, doc } = charger({ htmlCorps: '<div id="cible"></div><div id="temoin"></div>' });
    await api(win).browse({ ...BASE, containerId: "cible" });
    expect(doc.getElementById("temoin").innerHTML).toBe("");
    expect(doc.head.innerHTML).toBe("");
  });

  it("ne pose aucun ecouteur global : un clic hors conteneur ne declenche rien", async () => {
    const { win, doc, appels } = charger();
    await api(win).browse({ ...BASE, containerId: "cible" });
    const avant = appels.length;
    doc.body.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(appels.length).toBe(avant);
  });

  it("ne relance JAMAIS d'appel de lui-meme : un appel entre, un appel sort", async () => {
    // Pas de second appel « groupe » comme heurix-search.js, pas de
    // rechargement au clic. Le quota Browse du marchand est facture a la
    // requete : un appel supplementaire implicite se verrait sur sa
    // facture avant de se voir a l'ecran.
    const { win, appels } = charger();
    await api(win).browse({ ...BASE, containerId: "cible" });
    await new Promise((r) => setTimeout(r, 30));
    expect(appels).toHaveLength(1);
  });
});
