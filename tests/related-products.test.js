import { describe, it, expect, beforeEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// console.js — "Produits associés" (chantier console, 7 août 2026).
//
// console.js est une IIFE qui n'expose que window.heurixShowPane -- rien
// d'autre. Pour tester une fonctionnalité câblée au LOGIN (comme celle-ci),
// il faut simuler le vrai flux : soumettre le formulaire, laisser
// startSession()/loadDashboard() s'exécuter, PUIS interagir avec le pane.
// Pas de raccourci qui appellerait wireRelatedProducts() directement : ce
// serait tester une fonction qui n'existe pas dans le contrat observable.
// ---------------------------------------------------------------------------

const REPONSE_LOGIN = { session_token: "tok-test", keys: [{ key: "cle-test" }] };
const REPONSE_CATALOGS = { catalogs: [{ catalog: "outillage-demo" }] };
const REPONSE_SEARCH_VIS = {
  hits: [{ product: { id: "VIS-M8-20", name: "Vis M8x20 inox A2", price: 0.35 } }],
};
const REPONSE_RELATED = {
  product_id: "VIS-M8-20",
  target_purchases: 47,
  related: [
    { product_id: "ROND-M8-INOX", co_purchases: 31, name: "Rondelle plate M8 inox", price: 0.12 },
    { product_id: "SANS-NOM", co_purchases: 4, name: null, price: null },
  ],
};
const REPONSE_RELATED_VIDE = { product_id: "AUTRE", target_purchases: 0, related: [] };

function construireFetchMock() {
  return vi.fn(async (url, options) => {
    const chemin = String(url).replace(/^https?:\/\/[^/]+/, "");
    if (chemin === "/v1/auth/login") return { ok: true, json: async () => REPONSE_LOGIN };
    if (chemin === "/v1/index/catalogs") return { ok: true, json: async () => REPONSE_CATALOGS };
    if (chemin.startsWith("/v1/analytics/summary")) {
      return { ok: true, json: async () => ({ total_searches: 0, zero_result_rate: 0, total_errors: 0, daily_searches: [] }) };
    }
    if (chemin.startsWith("/v1/usage")) {
      return { ok: true, json: async () => ({ requests: 0, account_email: "test@heurix.fr" }) };
    }
    if (chemin.startsWith("/v1/analytics/top-queries")) return { ok: true, json: async () => ({ queries: [] }) };
    if (chemin.startsWith("/v1/analytics/zero-results")) return { ok: true, json: async () => ({ queries: [] }) };
    if (chemin.startsWith("/v1/analytics/errors")) return { ok: true, json: async () => ({ errors: [] }) };
    if (chemin.startsWith("/v1/index/outillage-demo/search")) {
      const corps = options && options.body ? JSON.parse(options.body) : {};
      if (corps.q && corps.q.toLowerCase().includes("vis")) {
        return { ok: true, json: async () => REPONSE_SEARCH_VIS };
      }
      return { ok: true, json: async () => ({ hits: [] }) };
    }
    if (chemin === "/v1/analytics/related-products/outillage-demo/VIS-M8-20") {
      return { ok: true, json: async () => REPONSE_RELATED };
    }
    if (chemin.startsWith("/v1/analytics/related-products/")) {
      return { ok: true, json: async () => REPONSE_RELATED_VIDE };
    }
    // Défaut sûr : le login déclenche une bonne dizaine d'autres appels
    // (usage, browse, search-overrides…) hors du périmètre de ce test —
    // une réponse vide ne doit jamais les faire planter.
    return { ok: true, json: async () => ({}) };
  });
}

function chargerConsole() {
  const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/console.html", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  window.Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
  // renderChart() utilise Chart.js (chargé par CDN dans le vrai navigateur,
  // jamais récupéré par JSDOM) sur un vrai canvas 2D (non implémenté par
  // JSDOM sans le paquet natif `canvas`) -- hors du périmètre de ce test,
  // qui porte sur "Produits associés", pas sur le graphique de recherches.
  // Court-circuité entièrement plutôt que mocké finement : le contenu du
  // graphique n'est vérifié nulle part ici.
  window.HTMLCanvasElement.prototype.getContext = () => ({
    createLinearGradient: () => ({ addColorStop: () => {} }),
  });
  window.Chart = function () { return { destroy: () => {} }; };

  const fetchMock = construireFetchMock();
  global.fetch = fetchMock;
  window.fetch = fetchMock;

  const i18n = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");
  window.eval(i18n);
  const source = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
  window.eval(source);

  return { window, document: window.document, fetchMock };
}

async function connecter(window, document) {
  document.getElementById("login-email").value = "test@heurix.fr";
  document.getElementById("login-password").value = "peu-importe";
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  // Laisse les promesses de login (login -> startSession -> loadDashboard,
  // et tous les appels Promise.all qu'il déclenche) se résoudre.
  await vi.waitFor(() => {
    expect(document.getElementById("dash-content").hidden).toBe(false);
  });
}

describe("console.js — Produits associés", () => {
  let window, document, fetchMock;

  beforeEach(async () => {
    ({ window, document, fetchMock } = chargerConsole());
    await connecter(window, document);
  });

  it("le nouvel item de sidebar existe et ouvre le bon pane", () => {
    // Correctif (18 aout 2026, brief §3.1) : "Produits les plus vus" et
    // "Produits associes" fusionnes en un seul pane-produits avec deux
    // onglets internes -- item et pane renommes, second clic sur
    // l'onglet "Associes" pour refleter fidelement le vrai flux
    // utilisateur (l'onglet par defaut est "Les plus vus").
    const item = document.querySelector('[data-pane="pane-produits"]');
    expect(item).not.toBeNull();
    item.dispatchEvent(new window.Event("click", { bubbles: true }));
    expect(document.getElementById("pane-produits").hidden).toBe(false);
    document.getElementById("obs-tab-associes").dispatchEvent(new window.Event("click", { bubbles: true }));
  });

  it("chercher « vis » affiche le produit, le choisir affiche ses produits associés", async () => {
    document.querySelector('[data-pane="pane-produits"]').dispatchEvent(new window.Event("click", { bubbles: true }));
    document.getElementById("obs-tab-associes").dispatchEvent(new window.Event("click", { bubbles: true }));

    const input = document.getElementById("rp-search");
    input.value = "vis";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 350)); // dépasse le debounce de 300ms
    await vi.waitFor(() => {
      expect(document.querySelector("[data-rp-pid]")).not.toBeNull();
    });

    const resultat = document.querySelector('[data-rp-pid="VIS-M8-20"]');
    expect(resultat).not.toBeNull();
    resultat.dispatchEvent(new window.Event("click", { bubbles: true }));

    await vi.waitFor(() => {
      expect(document.getElementById("rp-target-purchases").textContent).not.toBe("…");
    });

    expect(document.getElementById("rp-target-purchases").textContent).toContain("47");
    const lignes = document.querySelectorAll("#rp-related-table tbody tr");
    expect(lignes.length).toBe(2);
    expect(lignes[0].textContent).toContain("Rondelle plate M8 inox");
    expect(lignes[0].textContent).toContain("31");
    // 31 sur 47 = 65.9..., arrondi à 66
    expect(lignes[0].textContent).toContain("66");
  });

  it("un produit sans nom (supprimé depuis l'événement) dégrade proprement, pas d'erreur", async () => {
    document.querySelector('[data-pane="pane-produits"]').dispatchEvent(new window.Event("click", { bubbles: true }));
    document.getElementById("obs-tab-associes").dispatchEvent(new window.Event("click", { bubbles: true }));
    const input = document.getElementById("rp-search");
    input.value = "vis";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    await vi.waitFor(() => expect(document.querySelector("[data-rp-pid]")).not.toBeNull());
    document.querySelector('[data-rp-pid="VIS-M8-20"]').dispatchEvent(new window.Event("click", { bubbles: true }));
    await vi.waitFor(() => {
      expect(document.getElementById("rp-target-purchases").textContent).not.toBe("…");
    });

    const lignes = document.querySelectorAll("#rp-related-table tbody tr");
    // Le second produit (name: null) ne doit pas casser le rendu -- juste
    // afficher l'identifiant seul, comme produitCell() le fait déjà pour
    // category-views dans ce même cas.
    expect(lignes[1].textContent).toContain("SANS-NOM");
  });

  it("moins de 5 achats : message d'état vide, jamais un tableau vide silencieux", async () => {
    document.querySelector('[data-pane="pane-produits"]').dispatchEvent(new window.Event("click", { bubbles: true }));
    document.getElementById("obs-tab-associes").dispatchEvent(new window.Event("click", { bubbles: true }));
    // Force la sélection d'un produit qui tombera sur REPONSE_RELATED_VIDE
    // (product_id "AUTRE", tout id hors VIS-M8-20 dans le mock ci-dessus).
    fetchMock.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ hits: [{ product: { id: "AUTRE", name: "Autre produit" } }] }) }));
    const input = document.getElementById("rp-search");
    input.value = "autre";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    await vi.waitFor(() => expect(document.querySelector("[data-rp-pid]")).not.toBeNull());
    document.querySelector('[data-rp-pid="AUTRE"]').dispatchEvent(new window.Event("click", { bubbles: true }));

    await vi.waitFor(() => {
      expect(document.getElementById("rp-related-empty").hidden).toBe(false);
    });
    expect(document.querySelectorAll("#rp-related-table tbody tr").length).toBe(0);
  });

  it("changer de catalogue global réinitialise la sélection en cours", async () => {
    document.querySelector('[data-pane="pane-produits"]').dispatchEvent(new window.Event("click", { bubbles: true }));
    document.getElementById("obs-tab-associes").dispatchEvent(new window.Event("click", { bubbles: true }));
    const input = document.getElementById("rp-search");
    input.value = "vis";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 350));
    await vi.waitFor(() => expect(document.querySelector("[data-rp-pid]")).not.toBeNull());
    document.querySelector('[data-rp-pid="VIS-M8-20"]').dispatchEvent(new window.Event("click", { bubbles: true }));
    await vi.waitFor(() => expect(document.getElementById("rp-result-panel").hidden).toBe(false));

    const select = document.getElementById("global-catalog");
    select.value = "outillage-demo"; // seule option dans ce mock, mais l'event suffit à déclencher appliquerCatalogue
    select.dispatchEvent(new window.Event("change", { bubbles: true }));

    expect(document.getElementById("rp-result-panel").hidden).toBe(true);
    expect(input.value).toBe("");
  });
});
