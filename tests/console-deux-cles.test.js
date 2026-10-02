import { describe, it, expect, vi } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

/* UN COMPTE A DEUX CLES DANS LA CONSOLE (2 octobre 2026).
 *
 * CE QUE LE MOTEUR A CHANGE. Depuis `9127460` (deploye, lu sur /health le
 * 2 octobre), une boutique Shopify rattachee a un compte Heurix EXISTANT recoit
 * sa PROPRE cle serveur, sous la meme entreprise, facturee par Shopify.
 * `/v1/auth/me` les rend toutes, triees par `created_at` croissant.
 *
 * CE QUE LA CONSOLE EN MONTRAIT AVANT CE LOT -- QUATRE OBSERVATIONS, MESUREES
 * SUR `console.js` A 49ce1b75, avec les memes corps que ci-dessous :
 *
 *   1. toutes les lectures partaient sous `keys[0]`, la cle du marchand ; la
 *      cle de la boutique n'apparaissait dans AUCUNE requete ;
 *   2. « Mon abonnement » affichait Growth et 30 000 requetes -- le plan du
 *      marchand -- jamais Starter ni les 15 000 de la boutique ;
 *   3. ni la cle de la boutique ni son domaine n'apparaissaient dans le DOM ;
 *   4. le selecteur de catalogue ne listait que les catalogues du marchand.
 *
 * Ce fichier a d'abord porte ces quatre observations, VERTES sur la console
 * inchangee : la limite etait mesuree avant d'etre fermee. Il porte maintenant
 * le correctif, et les quatre assertions sont inversees.
 *
 * LES CORPS NE SONT PAS INVENTES. Ils sont la sortie du moteur a `9127460`,
 * mesuree en TestClient sur le chemin de production : signup, `set_plan`
 * growth (ce que pose le webhook Stripe), POST /v1/auth/code-liaison, POST
 * /v1/integrations/shopify/rattacher, POST /v1/integrations/shopify/plan
 * (starter). Seules les cles sont raccourcies, et le marchand recoit un second
 * catalogue -- il en faut deux pour qu'un choix de catalogue existe.
 *
 * `keys_for_company` ne rend QUE QUATRE CHAMPS par cle : `key`, `label`,
 * `plan`, `created_at`. Ni `browse_plan`, ni `plateforme`, ni les catalogues,
 * ni l'usage -- ceux-la suivent la cle active, par /v1/usage et
 * /v1/index/catalogs.
 */

const CLE_MARCHAND = "hx_marchand_growth";
const CLE_BOUTIQUE = "hx_boutique_shopify";
const BOUTIQUE = "cremerie.myshopify.com";

const ME = {
  email: "durand@cremerie.fr",
  role: "admin",
  keys: [
    { key: CLE_MARCHAND, label: "Cremerie Durand", plan: "growth",
      created_at: "2026-10-02T09:33:49.305174+00:00" },
    { key: CLE_BOUTIQUE, label: "shopify:" + BOUTIQUE, plan: "starter",
      created_at: "2026-10-02T09:33:49.330813+00:00" },
  ],
  company: { id: 1, raison_sociale: "Cremerie Durand", numero_tva: null },
  teammates: [{ id: 1, email: "durand@cremerie.fr", role: "admin", created_at: "2026-10-02T09:33:49.303668+00:00" }],
};

const UNE_SEULE_CLE = { ...ME, keys: [ME.keys[0]] };

const USAGE = {
  [CLE_MARCHAND]: {
    month: "2026-10", requests: 0, allowed: true, over_limit: false, used: 0,
    limit: 30000, plan: "growth", account_email: "durand@cremerie.fr",
    trial_expired: false, trial_days_left: null, browse_plan: "none",
    catalogs_used: 2, catalogs_limit: 3, products_limit: 25000,
    first_search_at: null, first_browse_at: null, first_index_at: null,
    secteur: null, plateforme: null,
  },
  [CLE_BOUTIQUE]: {
    month: "2026-10", requests: 0, allowed: true, over_limit: false, used: 0,
    limit: 15000, plan: "starter", account_email: null,
    trial_expired: false, trial_days_left: null, browse_plan: "none",
    catalogs_used: 1, catalogs_limit: 1, products_limit: 8000,
    first_search_at: null, first_browse_at: null, first_index_at: null,
    secteur: null, plateforme: null,
  },
};

const CATALOGUES = {
  [CLE_MARCHAND]: { catalogs: [{ catalog: "outillage-maison" }, { catalog: "visserie-pro" }] },
  [CLE_BOUTIQUE]: { catalogs: [{ catalog: "cremerie-shopify" }] },
};

function chargerConsole(page, options) {
  const o = options || {};
  const me = o.me || ME;
  const html = fs.readFileSync(path.join(RACINE, page), "utf8");
  const navigations = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => navigations.push(e.message));
  const dom = new JSDOM(html, { url: "http://localhost/console.html", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  window.Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => ({ createLinearGradient: () => ({ addColorStop: () => {} }) });
  window.Chart = function () { return { destroy: () => {} }; };
  window.setTimeout = globalThis.setTimeout;
  Object.keys(o.stockage || {}).forEach((c) => window.localStorage.setItem(c, o.stockage[c]));

  const vues = [];
  const f = vi.fn(async (url, opts) => {
    const chemin = String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    const porteur = ((opts && opts.headers && opts.headers.Authorization) || "").replace("Bearer ", "");
    vues.push({ chemin, porteur });
    if (chemin === "/v1/auth/login") return { ok: true, json: async () => ({ session_token: "sess_test", ...me }) };
    if (chemin === "/v1/auth/me") return { ok: true, json: async () => me };
    if (chemin === "/v1/index/catalogs") return { ok: true, json: async () => (CATALOGUES[porteur] || { catalogs: [] }) };
    if (chemin === "/v1/keys/public") return { ok: true, json: async () => ({ keys: [] }) };
    if (chemin.startsWith("/v1/rulepacks")) return { ok: true, json: async () => ({ rulepacks: [] }) };
    if (chemin.startsWith("/v1/analytics/summary")) return { ok: true, json: async () => ({ total_searches: 0, zero_result_rate: 0, total_errors: 0, daily_searches: [] }) };
    if (chemin.startsWith("/v1/analytics/errors")) return { ok: true, json: async () => ({ errors: [] }) };
    if (chemin.startsWith("/v1/analytics/")) return { ok: true, json: async () => ({ queries: [] }) };
    if (chemin.startsWith("/v1/usage")) return { ok: true, json: async () => (USAGE[porteur] || {}) };
    return { ok: true, json: async () => ({}) };
  });
  global.fetch = f;
  window.fetch = f;

  window.eval(fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(RACINE, "console.js"), "utf8"));
  return { window, document: window.document, vues, navigations };
}

async function connecter(window, document) {
  document.getElementById("login-email").value = "durand@cremerie.fr";
  document.getElementById("login-password").value = "peu-importe";
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await vi.waitFor(() => { expect(document.getElementById("dash-content").hidden).toBe(false); });
}

async function ouvrirFacturation(window, document) {
  document.querySelector('[data-goto-pane="pane-billing"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  await vi.waitFor(() => { expect(document.getElementById("billing-grid").textContent).not.toMatch(/Chargement|Loading/); });
}

const cles = (vues) => [...new Set(vues.filter((v) => v.porteur.startsWith("hx_")).map((v) => v.porteur))];
const options = (document, id) => [...document.getElementById(id).options].map((o) => o.value);

describe("le sélecteur de compte", () => {
  it("n'apparaît pas pour un compte à une seule clé — tous les autres aujourd'hui", async () => {
    const { window, document } = chargerConsole("console.html", { me: UNE_SEULE_CLE });
    await connecter(window, document);
    expect(document.getElementById("global-key-wrap").hidden).toBe(true);
    await ouvrirFacturation(window, document);
    expect(document.getElementById("billing-stripe-actions").hidden).toBe(false);
    expect(document.getElementById("billing-upgrade").hidden).toBe(false);
    expect(document.getElementById("billing-plateforme").hidden).toBe(true);
  });

  it("nomme les deux clés : la raison sociale, et la boutique par son domaine", async () => {
    const { window, document } = chargerConsole("console.html");
    await connecter(window, document);
    const wrap = document.getElementById("global-key-wrap");
    expect(wrap.hidden).toBe(false);
    expect(options(document, "global-key")).toEqual([CLE_MARCHAND, CLE_BOUTIQUE]);
    const libelles = [...document.getElementById("global-key").options].map((o) => o.textContent);
    expect(libelles).toEqual(["Cremerie Durand", BOUTIQUE + " — Shopify"]);
    expect(document.getElementById("global-key").value).toBe(CLE_MARCHAND);
  });

  it("sans choix mémorisé, la clé active reste la plus ancienne", async () => {
    const { window, document, vues } = chargerConsole("console.html");
    await connecter(window, document);
    expect(cles(vues)).toEqual([CLE_MARCHAND]);
  });

  it("un choix mémorisé qui ne désigne plus rien retombe sur la plus ancienne", async () => {
    const { window, document, vues } = chargerConsole("console.html", {
      stockage: { heurix_cle_active: "hx_cle_revoquee" },
    });
    await connecter(window, document);
    expect(cles(vues)).toEqual([CLE_MARCHAND]);
    expect(document.getElementById("global-key").value).toBe(CLE_MARCHAND);
  });

  it("le changement mémorise la clé choisie et demande une navigation", async () => {
    // L'INSTRUMENT NE DISTINGUE PAS UN RECHARGEMENT D'UNE AUTRE NAVIGATION :
    // jsdom rend le meme « Not implemented: navigation » pour les deux. Ce que
    // ce test etablit est la MEMOIRE du choix ; que la page relise cette
    // memoire au chargement suivant est etabli par le test d'a cote, qui part
    // d'un `localStorage` deja pose.
    const { window, document, navigations } = chargerConsole("console.html");
    await connecter(window, document);
    const select = document.getElementById("global-key");
    select.value = CLE_BOUTIQUE;
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(window.localStorage.getItem("heurix_cle_active")).toBe(CLE_BOUTIQUE);
    await vi.waitFor(() => { expect(navigations.join(" ")).toMatch(/navigation/); });
  });

  it("la déconnexion oublie le choix, comme elle oublie le jeton", async () => {
    const { window, document } = chargerConsole("console.html", {
      stockage: { heurix_cle_active: CLE_BOUTIQUE },
    });
    await connecter(window, document);
    document.getElementById("logout-btn").dispatchEvent(new window.Event("click", { bubbles: true }));
    expect(window.localStorage.getItem("heurix_cle_active")).toBe(null);
  });
});

describe("sous la clé de la boutique, la console montre la boutique", () => {
  const sousLaBoutique = (page) => chargerConsole(page, { stockage: { heurix_cle_active: CLE_BOUTIQUE } });

  it("toutes les lectures partent sous elle, et aucune sous celle du marchand", async () => {
    const { window, document, vues } = sousLaBoutique("console.html");
    await connecter(window, document);
    expect(cles(vues)).toEqual([CLE_BOUTIQUE]);
  });

  it("« Mon abonnement » montre son plan Shopify et ses plafonds", async () => {
    const { window, document } = sousLaBoutique("console.html");
    await connecter(window, document);
    await ouvrirFacturation(window, document);
    const grille = document.getElementById("billing-grid").textContent;
    expect(grille).toMatch(/Starter/);
    expect(grille).not.toMatch(/Growth/);
    expect(grille.replace(/\s/g, "")).toMatch(/15000/);
    expect(grille.replace(/\s/g, "")).not.toMatch(/30000/);
  });

  it("son catalogue est celui que le sélecteur propose", async () => {
    const { window, document } = sousLaBoutique("console.html");
    await connecter(window, document);
    expect(options(document, "global-catalog")).toEqual(["cremerie-shopify"]);
  });

  it("sa clé est celle que le volet « Ma clé API » affiche", async () => {
    const { window, document } = sousLaBoutique("console.html");
    await connecter(window, document);
    document.querySelector('[data-goto-pane="pane-key"]').dispatchEvent(new window.Event("click", { bubbles: true }));
    await vi.waitFor(() => { expect(document.getElementById("account-key-value").dataset.full).toBeTruthy(); });
    expect(document.getElementById("account-key-value").dataset.full).toBe(CLE_BOUTIQUE);
  });
});

/* LE GARDE, ET POURQUOI IL N'EST PAS ANNEXE AU SELECTEUR.
 *
 * `pricing.html` envoie le jeton de session, et `_cle_du_payeur`
 * (heurix/routers/stripe.py) le resout vers `keys_for_company(...)[0]` -- la
 * cle LA PLUS ANCIENNE. Un marchand qui, regardant sa boutique, cliquait
 * « Souscrire une formule » serait preleve sur son compte principal, sans un
 * mot. Avant ce lot le piege etait inatteignable : personne ne pouvait
 * regarder sa boutique. Le selecteur le rend atteignable ; le garde le ferme.
 */
describe("le garde des actions Stripe", () => {
  const CAS = [
    { page: "console.html", phrase: /facturée par Shopify pour cremerie\.myshopify\.com/, ailleurs: /administration de votre boutique/ },
    { page: "en/console.html", phrase: /billed by Shopify for cremerie\.myshopify\.com/, ailleurs: /store admin/ },
  ];

  for (const c of CAS) {
    it(`${c.page} : sous la boutique, aucune action Stripe, et la phrase qui dit où le faire`, async () => {
      const { window, document } = chargerConsole(c.page, { stockage: { heurix_cle_active: CLE_BOUTIQUE } });
      await connecter(window, document);
      await ouvrirFacturation(window, document);
      expect(document.getElementById("billing-upgrade").hidden).toBe(true);
      expect(document.getElementById("billing-stripe-actions").hidden).toBe(true);
      expect(document.getElementById("billing-stripe-note").hidden).toBe(true);
      const note = document.getElementById("billing-plateforme");
      expect(note.hidden).toBe(false);
      expect(note.textContent).toMatch(c.phrase);
      expect(note.textContent).toMatch(c.ailleurs);
    });

    it(`${c.page} : sous le marchand, les actions Stripe sont intactes`, async () => {
      const { window, document } = chargerConsole(c.page);
      await connecter(window, document);
      await ouvrirFacturation(window, document);
      expect(document.getElementById("billing-upgrade").hidden).toBe(false);
      expect(document.getElementById("billing-stripe-actions").hidden).toBe(false);
      expect(document.getElementById("billing-stripe-note").hidden).toBe(false);
      expect(document.getElementById("billing-plateforme").hidden).toBe(true);
    });
  }

  it("une clé secondaire SANS préfixe de plateforme ferme quand même les actions", async () => {
    // Le libelle NOMME, il ne decide pas : le critere est « cette cle n'est pas
    // celle du payeur ». Une seconde cle creee a la main par /v1/admin/keys
    // porte un libelle libre, et le paiement partirait quand meme sur la
    // premiere.
    const SECONDE = "hx_seconde_a_la_main";
    const me = { ...ME, keys: [ME.keys[0], { key: SECONDE, label: "Entrepôt Nord", plan: "starter", created_at: "2026-10-02T10:00:00+00:00" }] };
    USAGE[SECONDE] = { ...USAGE[CLE_BOUTIQUE] };
    CATALOGUES[SECONDE] = { catalogs: [{ catalog: "entrepot-nord" }] };
    const { window, document } = chargerConsole("console.html", { me, stockage: { heurix_cle_active: SECONDE } });
    await connecter(window, document);
    const libelles = [...document.getElementById("global-key").options].map((o) => o.textContent);
    expect(libelles).toEqual(["Cremerie Durand", "Entrepôt Nord"]);
    await ouvrirFacturation(window, document);
    expect(document.getElementById("billing-stripe-actions").hidden).toBe(true);
    const note = document.getElementById("billing-plateforme").textContent;
    expect(note).toMatch(/prélevé sur votre compte principal/);
    expect(note).not.toMatch(/Shopify/);
  });
});

describe("le souvenir du catalogue est par clé", () => {
  it("le choix du marchand s'écrit sous sa clé, et nulle part ailleurs", async () => {
    const { window, document } = chargerConsole("console.html");
    await connecter(window, document);
    const select = document.getElementById("global-catalog");
    select.value = "visserie-pro";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(window.localStorage.getItem("heurix_catalogue_actif:" + CLE_MARCHAND)).toBe("visserie-pro");
    expect(window.localStorage.getItem("heurix_catalogue_actif")).toBe(null);
    expect(window.localStorage.getItem("heurix_catalogue_actif:" + CLE_BOUTIQUE)).toBe(null);
  });

  it("l'ancien nom est encore lu : un compte existant ne perd pas son choix", async () => {
    const { window, document } = chargerConsole("console.html", {
      stockage: { heurix_catalogue_actif: "visserie-pro" },
    });
    await connecter(window, document);
    expect(document.getElementById("global-catalog").value).toBe("visserie-pro");
  });

  it("l'ancien nom ne traverse pas vers une autre clé", async () => {
    // Le repli est inoffensif parce que `memoireValide` verifie
    // l'appartenance a la liste de la cle courante : « visserie-pro » n'est pas
    // un catalogue de la boutique.
    const { window, document } = chargerConsole("console.html", {
      stockage: { heurix_catalogue_actif: "visserie-pro", heurix_cle_active: CLE_BOUTIQUE },
    });
    await connecter(window, document);
    expect(document.getElementById("global-catalog").value).toBe("cremerie-shopify");
  });
});
