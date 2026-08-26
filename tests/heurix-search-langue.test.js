import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-search.js"), "utf8");

/**
 * Charge le widget dans un DOM dont on choisit l'attribut lang.
 *
 * `lang: null` reproduit une page qui n'en declare aucun -- le cas du
 * marchand qui a telecharge le fichier et n'a rien fait. C'est celui qui
 * doit rester en francais, sinon la mise a jour casserait son site.
 */
function charger({ lang = null, config = {}, reponse } = {}) {
  const attr = lang === null ? "" : ` lang="${lang}"`;
  const dom = new JSDOM(`<!doctype html><html${attr}><body><div id="cible"></div></body></html>`,
    { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Element.prototype.scrollIntoView = () => {};
  global.fetch = async () => ({ ok: true, json: async () => reponse });

  dom.window.eval(SOURCE);
  global.Heurix.searchBox({
    apiKey: "hxp_test", catalog: "fixtures", containerId: "cible",
    debounceMs: 1, ...config,
  });
  return dom.window.document;
}

const attendre = (ms = 40) => new Promise((r) => setTimeout(r, ms));

async function chercher(doc, texte = "vis") {
  const input = doc.querySelector(".hx-search-input");
  input.value = texte;
  input.dispatchEvent(new global.window.Event("input"));
  await attendre();
  return doc;
}

const hit = (id, price) => ({
  product: { id, name: "Vis " + id, ref: "M8", price },
  score: 1, in_stock: true,
});
const reponse = (n, total, price = 5.9) => ({
  query: "vis", total: total ?? n,
  hits: Array.from({ length: n }, (_, i) => hit("V" + i, price)),
});

describe("heurix-search.js — resolution de la langue", () => {
  it("sans attribut lang : francais, exactement comme avant le chantier", async () => {
    const doc = await chercher(charger({ lang: null, reponse: reponse(2) }));
    expect(doc.querySelector(".hx-search-input").placeholder).toBe("Rechercher…");
    expect(doc.querySelector(".hx-search-live").textContent).toContain("résultats trouvés");
  });

  it('lang="fr" : francais', async () => {
    const doc = charger({ lang: "fr", reponse: reponse(2) });
    expect(doc.querySelector(".hx-search-input").placeholder).toBe("Rechercher…");
  });

  it('lang="en" : anglais, sans que le marchand configure quoi que ce soit', async () => {
    const doc = await chercher(charger({ lang: "en", reponse: reponse(2) }));
    expect(doc.querySelector(".hx-search-input").placeholder).toBe("Search…");
    expect(doc.querySelector(".hx-search-input").getAttribute("aria-label")).toBe("Search for a product");
    expect(doc.querySelector(".hx-search-live").textContent).toContain("results found");
  });

  it('lang="en-US" : la sous-etiquette de region est ignoree', () => {
    expect(charger({ lang: "en-US", reponse: reponse(1) })
      .querySelector(".hx-search-input").placeholder).toBe("Search…");
  });

  it("une langue non servie retombe sur le francais", () => {
    expect(charger({ lang: "de", reponse: reponse(1) })
      .querySelector(".hx-search-input").placeholder).toBe("Rechercher…");
  });

  it("le parametre l'emporte sur l'attribut, dans les deux sens", () => {
    expect(charger({ lang: "en", config: { lang: "fr" }, reponse: reponse(1) })
      .querySelector(".hx-search-input").placeholder).toBe("Rechercher…");
    expect(charger({ lang: "fr", config: { lang: "en" }, reponse: reponse(1) })
      .querySelector(".hx-search-input").placeholder).toBe("Search…");
  });

  it("config.placeholder l'emporte sur la langue -- option deja publiee", () => {
    expect(charger({ lang: "en", config: { placeholder: "Chercher une vis" }, reponse: reponse(1) })
      .querySelector(".hx-search-input").placeholder).toBe("Chercher une vis");
  });
});

describe("heurix-search.js — le pluriel n'a pas la meme borne dans les deux langues", () => {
  it("EN 1 resultat : « 1 result found », jamais « 1 results found »", async () => {
    const doc = await chercher(charger({ lang: "en", reponse: reponse(1) }));
    const live = doc.querySelector(".hx-search-live").textContent;
    expect(live).toBe("1 result found");
    expect(live).not.toContain("results");
  });

  it("EN 0 resultat : « No results » -- chaine fixe, le pluriel n'y intervient pas", async () => {
    const doc = await chercher(charger({ lang: "en", reponse: reponse(0) }));
    expect(doc.querySelector(".hx-search-state").textContent).toContain("No results");
  });

  it("FR 1 resultat : singulier", async () => {
    const doc = await chercher(charger({ lang: "fr", reponse: reponse(1) }));
    expect(doc.querySelector(".hx-search-live").textContent).toBe("1 résultat trouvé");
  });

  it("FR 0 resultat : « Aucun résultat » -- chaine fixe elle aussi", async () => {
    const doc = await chercher(charger({ lang: "fr", reponse: reponse(0) }));
    expect(doc.querySelector(".hx-search-state").textContent).toContain("Aucun résultat");
  });

  it("EN 2 resultats : pluriel", async () => {
    const doc = await chercher(charger({ lang: "en", reponse: reponse(2) }));
    expect(doc.querySelector(".hx-search-live").textContent).toBe("2 results found");
  });

  it("« au total » suit la meme borne, et le lien reste sous la bonne langue", async () => {
    const doc = await chercher(charger({ lang: "en", reponse: reponse(1, 47) }));
    expect(doc.querySelector(".hx-search-seeall").textContent).toContain("47 results in total");
  });
});

describe("heurix-search.js — format monetaire", () => {
  it("FR : virgule decimale, symbole apres le montant", async () => {
    const doc = await chercher(charger({ lang: "fr", reponse: reponse(1, 1, 12.34) }));
    expect(doc.querySelector(".hx-search-hit-price").textContent).toBe("12,34 €");
  });

  it("EN : point decimal, symbole avant le montant", async () => {
    const doc = await chercher(charger({ lang: "en", reponse: reponse(1, 1, 12.34) }));
    expect(doc.querySelector(".hx-search-hit-price").textContent).toBe("€12.34");
  });

  it("les deux langues coupent les centimes nuls de la meme facon", async () => {
    const fr = await chercher(charger({ lang: "fr", reponse: reponse(1, 1, 12) }));
    expect(fr.querySelector(".hx-search-hit-price").textContent).toBe("12 €");
    const en = await chercher(charger({ lang: "en", reponse: reponse(1, 1, 12) }));
    expect(en.querySelector(".hx-search-hit-price").textContent).toBe("€12");
  });

  it("la borne de prix d'un zero-resultat est traduite ET formatee", async () => {
    const doc = await chercher(charger({
      lang: "en",
      reponse: { query: "vis", total: 0, hits: [], price_filter: { min: null, max: 2 } },
    }));
    const t = doc.querySelector(".hx-search-state").textContent;
    expect(t).toContain("No product under €2");
    expect(doc.querySelector(".hx-search-clearfilter").textContent)
      .toBe("Search without the price constraint");
  });
});

/* La borne du pluriel ne differe entre les deux langues qu'a zero, et
 * aucun site d'appel du widget ne peut produire zero (voir le commentaire
 * de estPluriel). Le rendu ne peut donc pas la solliciter : replier la
 * fonction sur « n > 1 » laissait passer les 17 tests ci-dessus.
 *
 * On l'eprouve donc la ou elle vit, en evaluant le bloc de fonctions
 * pures du fichier livre -- pas une copie, la source elle-meme.
 */
describe("heurix-search.js — la borne du pluriel, eprouvee directement", () => {
  const bloc = SOURCE.slice(SOURCE.indexOf("function resoudreLangue"), SOURCE.indexOf("function esc("));
  // eslint-disable-next-line no-eval
  const { estPluriel, fmtPrix, resoudreLangue } = eval(bloc + "({estPluriel, fmtPrix, resoudreLangue})");

  it("zero est singulier en francais, pluriel en anglais", () => {
    expect(estPluriel(0, "fr")).toBe(false);
    expect(estPluriel(0, "en")).toBe(true);
  });

  it("un est singulier dans les deux langues", () => {
    expect(estPluriel(1, "fr")).toBe(false);
    expect(estPluriel(1, "en")).toBe(false);
  });

  it("deux et au-dela sont pluriels dans les deux langues", () => {
    for (const n of [2, 3, 47]) {
      expect(estPluriel(n, "fr")).toBe(true);
      expect(estPluriel(n, "en")).toBe(true);
    }
  });

  it("le repli est le francais, sans document comme avec un lang inconnu", () => {
    // les tests ci-dessus laissent un global.document derriere eux ; ici
    // on veut le cas d'un contexte qui n'en a pas du tout (import ES,
    // rendu serveur), donc on le retire le temps de l'assertion.
    const garde = global.document;
    delete global.document;
    try {
      expect(resoudreLangue(undefined)).toBe("fr");
      expect(resoudreLangue("")).toBe("fr");
      expect(resoudreLangue("de")).toBe("fr");
      expect(resoudreLangue("en-GB")).toBe("en");
    } finally {
      global.document = garde;
    }
  });

  it("fmtPrix suit la langue, et l'euro reste la seule devise", () => {
    expect(fmtPrix(1999.9, "fr")).toBe("1999,90 €");
    expect(fmtPrix(1999.9, "en")).toBe("€1999.90");
  });
});
