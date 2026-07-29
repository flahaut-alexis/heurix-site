import { describe, it, expect, beforeEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const CONTRAT = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures/engine-contract.json"), "utf8")
);
const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-search.js"), "utf8");

/**
 * Charge le widget dans un DOM neuf et renvoie de quoi l'inspecter.
 *
 * Deux pieges deja rencontres, encapsules ici une fois pour toutes :
 * - la bibliotheque s'attache au scope global de Node (pas a window)
 *   quand elle est evaluee via window.eval dans jsdom ;
 * - jsdom n'implemente pas scrollIntoView.
 */
function chargerWidget({ reponses = {}, config = {} } = {}) {
  const dom = new JSDOM('<div id="cible"></div>', { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Element.prototype.scrollIntoView = () => {};

  const appels = [];
  global.fetch = async (url, opts) => {
    const corps = opts?.body ? JSON.parse(opts.body) : null;
    appels.push({ url, opts, corps });
    const cle = Object.keys(reponses).find((k) => url.includes(k)) ?? "defaut";
    const donnees = reponses[cle] ?? CONTRAT.search_avec_facettes;
    return { ok: true, json: async () => donnees };
  };

  dom.window.eval(SOURCE);
  const widget = global.Heurix.searchBox({
    apiKey: "hxp_test",
    catalog: "fixtures",
    containerId: "cible",
    debounceMs: 1,
    ...config,
  });

  return { dom, document: dom.window.document, window: dom.window, appels, widget };
}

const attendre = (ms = 40) => new Promise((r) => setTimeout(r, ms));

async function taper(ctx, texte) {
  const input = ctx.document.querySelector(".hx-search-input");
  input.value = texte;
  input.dispatchEvent(new ctx.window.Event("input"));
  await attendre();
  return input;
}

describe("heurix-search.js — contrat avec le moteur", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("envoie les filtres de facette dans le format que le moteur accepte", async () => {
    // TEST DE NON-REGRESSION DU BUG DES FACETTES.
    //
    // Le widget envoyait "DIAM:DIAM_M8" alors que le moteur compare les
    // filtres directement aux annotations ("DIAM_M8") : cliquer une
    // facette renvoyait zero resultat. Les tests d'alors ne l'ont pas vu
    // parce qu'ils inventaient la reponse de l'API.
    //
    // Ici, la valeur attendue vient de engine-contract.json, genere en
    // interrogeant le vrai moteur (voir fixtures/generate.py).
    expect(CONTRAT.format_filtre_attendu).toBe("valeur_brute");

    const ctx = chargerWidget({ config: { facets: ["DIAM"] } });
    await taper(ctx, "vis");

    const chip = ctx.document.querySelector(".hx-search-facet-chip");
    expect(chip, "une facette doit etre rendue").toBeTruthy();

    chip.click();
    await attendre();

    const dernier = ctx.appels[ctx.appels.length - 1];
    const filtreEnvoye = dernier.corps.filters[0];

    // Le filtre doit etre une valeur que le moteur reconnait reellement
    const valeursValides = Object.entries(CONTRAT.contrat_filtres)
      .filter(([, v]) => v.resultats_avec_valeur_brute > 0)
      .map(([valeur]) => valeur);

    expect(valeursValides).toContain(filtreEnvoye);
    expect(filtreEnvoye).not.toContain(":");
  });

  it("appelle l'endpoint de recherche avec la forme de requete attendue", async () => {
    const ctx = chargerWidget();
    await taper(ctx, "vis");

    const appel = ctx.appels[0];
    expect(appel.url).toContain("/v1/index/fixtures/search");
    expect(appel.opts.method).toBe("POST");
    expect(appel.opts.headers.Authorization).toBe("Bearer hxp_test");
    expect(appel.corps).toHaveProperty("q", "vis");
    expect(appel.corps).toHaveProperty("limit");
    expect(Array.isArray(appel.corps.filters)).toBe(true);
  });

  it("lit les champs du hit tels que le moteur les renvoie", async () => {
    // Si le moteur renomme un champ, ce test tombe -- au lieu d'un widget
    // qui affiche silencieusement des cases vides en production.
    expect(CONTRAT.forme_du_hit.cles_racine).toEqual(
      expect.arrayContaining(["product", "score", "in_stock"])
    );

    const ctx = chargerWidget();
    await taper(ctx, "vis");

    const premierNom = ctx.document.querySelector(".hx-search-hit-name");
    const attenduNom = CONTRAT.search_avec_facettes.hits[0].product.name;
    expect(premierNom.textContent).toBe(attenduNom);
  });
});

describe("heurix-search.js — rendu", () => {
  it("rend un resultat par hit renvoye", async () => {
    const ctx = chargerWidget();
    await taper(ctx, "vis");
    expect(ctx.document.querySelectorAll(".hx-search-hit").length).toBe(
      CONTRAT.search_avec_facettes.hits.length
    );
  });

  it("signale les produits en rupture de stock", async () => {
    const enRupture = CONTRAT.search_avec_facettes.hits.filter((h) => !h.in_stock);
    expect(enRupture.length, "la fixture doit contenir au moins une rupture").toBeGreaterThan(0);

    const ctx = chargerWidget();
    await taper(ctx, "vis");
    expect(ctx.document.querySelector(".hx-search-panel").innerHTML).toContain("Rupture");
  });

  it("humanise les libelles de facette au lieu d'afficher l'annotation brute", async () => {
    const ctx = chargerWidget({ config: { facets: ["DIAM"] } });
    await taper(ctx, "vis");

    const chip = ctx.document.querySelector(".hx-search-facet-chip");
    // "DIAM_M8" doit s'afficher "M8", mais rester "DIAM_M8" dans le filtre
    expect(chip.textContent).not.toContain("DIAM_");
    expect(chip.getAttribute("data-filter")).toContain("DIAM_");
  });

  it("affiche un message explicite quand il n'y a aucun resultat", async () => {
    const ctx = chargerWidget({ reponses: { search: CONTRAT.search_zero_resultat } });
    await taper(ctx, "xyzabc-introuvable");
    expect(ctx.document.querySelector(".hx-search-state").textContent).toContain("Aucun résultat");
  });
});

describe("heurix-search.js — comportement", () => {
  it("n'appelle pas l'API sous le seuil de caracteres", async () => {
    const ctx = chargerWidget();
    await taper(ctx, "v");
    expect(ctx.appels.length).toBe(0);
  });

  it("permet de naviguer au clavier et de selectionner", async () => {
    let choisi = null;
    const ctx = chargerWidget({ config: { onSelect: (hit) => { choisi = hit; } } });
    const input = await taper(ctx, "vis");

    input.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(ctx.document.querySelector(".hx-hit-active")).toBeTruthy();

    input.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "Enter" }));
    expect(choisi?.product?.id).toBe(CONTRAT.search_avec_facettes.hits[0].product.id);
  });

  it("destroy() vide le conteneur", async () => {
    const ctx = chargerWidget();
    await taper(ctx, "vis");
    ctx.widget.destroy();
    expect(ctx.document.querySelector("#cible .hx-search-input")).toBeNull();
  });
});

describe("heurix-search.js — securite (chantier C1)", () => {
  it("alerte si une cle SERVEUR est utilisee cote navigateur", () => {
    const ctx = chargerWidget({ config: {} });
    const alertes = [];
    ctx.window.console.warn = (m) => alertes.push(m);
    global.console.warn = (m) => alertes.push(m);

    global.Heurix.searchBox({
      apiKey: "hx_cle_serveur",
      catalog: "fixtures",
      containerId: "cible",
    });

    expect(alertes.join(" ")).toMatch(/SERVEUR/i);
  });

  it("n'alerte pas pour une cle publique", () => {
    const ctx = chargerWidget({ config: {} });
    const alertes = [];
    global.console.warn = (m) => alertes.push(m);

    global.Heurix.searchBox({
      apiKey: "hxp_cle_publique",
      catalog: "fixtures",
      containerId: "cible",
    });

    expect(alertes.length).toBe(0);
  });
});

describe("heurix-search.js — filtre de prix sans résultat (6.6bis)", () => {
  const REPONSE_PRIX_VIDE = {
    query: "vis inox", total: 0, hits: [], fallback: false,
    price_filter: { min: null, max: 5.0 },
  };

  it("explique la cause au lieu d'un « aucun résultat » sec", async () => {
    const ctx = chargerWidget({ reponses: { search: REPONSE_PRIX_VIDE } });
    await taper(ctx, "vis inox moins de 5 €");
    const texte = ctx.document.querySelector(".hx-search-panel").textContent;
    expect(texte).toContain("5");
    expect(texte).toMatch(/moins de/i);
  });

  it("propose de relancer sans la contrainte de prix", async () => {
    const ctx = chargerWidget({ reponses: { search: REPONSE_PRIX_VIDE } });
    await taper(ctx, "vis inox moins de 5 €");
    const bouton = ctx.document.querySelector(".hx-search-clearfilter");
    expect(bouton, "le bouton de relance doit être présent").toBeTruthy();
    expect(bouton.textContent).toMatch(/sans la contrainte/i);
  });

  it("la relance repart de la requête NETTOYÉE, sans la contrainte", async () => {
    // Le moteur renvoie déjà `query` débarrassée du fragment de prix, donc
    // la relance n'a pas à re-parser quoi que ce soit côté client.
    const ctx = chargerWidget({ reponses: { search: REPONSE_PRIX_VIDE } });
    await taper(ctx, "vis inox moins de 5 €");
    ctx.document.querySelector(".hx-search-clearfilter")
       .dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));
    await attendre();
    expect(ctx.document.querySelector(".hx-search-input").value).toBe("vis inox");
    const dernier = ctx.appels[ctx.appels.length - 1];
    expect(dernier.corps.q).toBe("vis inox");
  });

  it("un zéro-résultat SANS contrainte de prix garde le message simple", async () => {
    const ctx = chargerWidget({
      reponses: { search: { query: "xyzabc", total: 0, hits: [], fallback: false } },
    });
    await taper(ctx, "xyzabc");
    expect(ctx.document.querySelector(".hx-search-clearfilter")).toBeNull();
    expect(ctx.document.querySelector(".hx-search-state").textContent).toContain("Aucun résultat");
  });
});

describe("regroupement par famille", () => {
  // Configuré par le MARCHAND, pas par le visiteur : une case « regrouper »
  // dans une barre de recherche demande un effort de compréhension qu'un
  // acheteur pressé n'a pas.
  const platLarge = { total: 6582, hits: Array.from({ length: 8 }, (_, i) =>
    ({ product: { id: "P" + i, name: "Vis M8x" + (20 + i) + " inox" }, score: 60 })) };
  const platEtroit = { total: 3, hits: [
    { product: { id: "A", name: "Plaquette Bosch 0986494574" }, score: 60 }] };
  const groupe = { total: 6582, familles: 2, groupes: [
    { famille: "vis inox hex", produits: 265,
      representant: { name: "Vis hexagonale M8x30 inox A4" } },
    { famille: "vis inox fraisee", produits: 300,
      representant: { name: "Vis TF M8x80 inox A2" } },
  ] };

  async function taper(config, plat) {
    // Le mock renvoie la réponse groupée dès que `group_by` est présent :
    // c'est ainsi qu'on distingue les deux appels.
    let appels = [];
    const { appels: journal } = chargerWidget({
      config, reponses: { defaut: plat },
    });
    appels = journal;
    global.fetch = async (url, opts) => {
      const corps = JSON.parse(opts.body);
      appels.push({ corps });
      return { ok: true, json: async () => (corps.group_by ? groupe : plat) };
    };
    const input = global.document.querySelector(".hx-search-input");
    input.value = "vis M8 inox";
    input.dispatchEvent(new global.window.Event("input"));
    await new Promise((r) => setTimeout(r, 400));
    return appels.filter((a) => a.corps).map((a) => a.corps.group_by ? "groupe" : "plat");
  }

  it("regroupe au-delà du seuil", async () => {
    const modes = await taper({ groupThreshold: 50, debounceMs: 1 }, platLarge);
    expect(modes).toContain("groupe");
    expect(global.document.querySelectorAll(".hx-group").length).toBeGreaterThan(0);
  });

  it("NE regroupe PAS une recherche précise", async () => {
    // Un visiteur qui tape « 0986494574 » veut sa plaquette, pas une
    // famille. Grouper systématiquement transformerait une recherche
    // précise en détour.
    const modes = await taper({ groupThreshold: 50, debounceMs: 1 }, platEtroit);
    expect(modes).not.toContain("groupe");
    expect(global.document.querySelectorAll(".hx-group")).toHaveLength(0);
  });

  it("ne regroupe jamais sans configuration du marchand", async () => {
    const modes = await taper({ debounceMs: 1 }, platLarge);
    expect(modes).not.toContain("groupe");
  });
});
