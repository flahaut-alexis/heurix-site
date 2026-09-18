import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

/* AJOUTER RANKING DEPUIS « MON ABONNEMENT » (18 septembre 2026).
 *
 * La route moteur create-browse-addon-checkout-session n'avait aucun
 * appelant, et la page tarifs ne sait pas qui est deja abonne : un client
 * Growth qui y cochait Ranking payait un second Search. Le bouton vit dans
 * le bloc billing-upgrade, n'apparait que sur Growth ou Scale sans Ranking,
 * et demande le palier de la table du moteur.
 */

let USAGE = {};
let REPONSE_OPTION = null;

function construireFetch() {
  return vi.fn(async (url) => {
    const chemin = String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (chemin === "/v1/auth/login") {
      return { ok: true, json: async () => ({ session_token: "jeton", keys: [{ key: "hx_test" }] }) };
    }
    if (chemin === "/v1/auth/me") {
      return { ok: true, json: async () => ({
        email: "moi@heurix.fr", role: "admin",
        company: { raison_sociale: "Maison Test", numero_tva: null },
        keys: [{ key: "hx_test" }], teammates: [],
      }) };
    }
    if (chemin === "/v1/index/catalogs") return { ok: true, json: async () => ({ catalogs: [{ catalog: "outillage-demo" }] }) };
    if (chemin === "/v1/keys/public") return { ok: true, json: async () => ({ keys: [] }) };
    if (chemin.startsWith("/v1/rulepacks")) return { ok: true, json: async () => ({ rulepacks: [] }) };
    if (chemin.startsWith("/v1/analytics/summary")) {
      return { ok: true, json: async () => ({ total_searches: 0, zero_result_rate: 0, total_errors: 0, daily_searches: [] }) };
    }
    if (chemin.startsWith("/v1/analytics/errors")) return { ok: true, json: async () => ({ errors: [] }) };
    if (chemin.startsWith("/v1/analytics/")) return { ok: true, json: async () => ({ queries: [] }) };
    if (chemin.startsWith("/v1/usage")) {
      return { ok: true, json: async () => ({
        requests: 0, limit: 30000, account_email: "moi@heurix.fr",
        catalogs_used: 1, catalogs_limit: 3, products_limit: 25000,
        first_search_at: null, first_browse_at: null, ...USAGE,
      }) };
    }
    if (chemin === "/v1/stripe/create-browse-addon-checkout-session") return REPONSE_OPTION;
    return { ok: true, json: async () => ({}) };
  });
}

function chargerConsole(page, url) {
  const html = fs.readFileSync(path.join(RACINE, page), "utf8");
  const dom = new JSDOM(html, { url: url || "http://localhost/console.html", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  window.Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => ({
    createLinearGradient: () => ({ addColorStop: () => {} }),
  });
  window.Chart = function () { return { destroy: () => {} }; };

  const f = construireFetch();
  global.fetch = f;
  window.fetch = f;

  window.eval(fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(RACINE, "console.js"), "utf8"));
  return { window, document: window.document, fetch: f };
}

async function connecter(window, document) {
  document.getElementById("login-email").value = "moi@heurix.fr";
  document.getElementById("login-password").value = "peu-importe";
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await vi.waitFor(() => {
    expect(document.getElementById("dash-content").hidden).toBe(false);
  });
}

async function voletFacturation(usage, page = "console.html", url) {
  USAGE = usage;
  const c = chargerConsole(page, url);
  await connecter(c.window, c.document);
  if (!url) {
    c.document.querySelector('[data-goto-pane="pane-billing"]').dispatchEvent(new c.window.Event("click", { bubbles: true }));
  }
  await vi.waitFor(() => {
    expect(c.document.getElementById("billing-upgrade").hidden).toBe(false);
  });
  const $ = (id) => c.document.getElementById(id);
  return { ...c, bloc: $("billing-ranking"), texte: $("billing-ranking-text"), bouton: $("billing-ranking-add"), statut: $("billing-status") };
}

function appelsOption(f) {
  return f.mock.calls.filter(([u]) => String(u).includes("/v1/stripe/create-browse-addon-checkout-session"));
}

describe("« Mon abonnement » propose Ranking en option", () => {
  it("Growth sans Ranking : le palier starter, et l'appel part avec la clé", async () => {
    REPONSE_OPTION = { ok: true, json: async () => ({ checkout_url: "https://checkout.stripe.test/cs_x" }) };
    const v = await voletFacturation({ plan: "growth", browse_plan: "none" });
    expect(v.bloc.hidden).toBe(false);
    expect(v.bouton.hidden).toBe(false);
    expect(v.texte.textContent).toMatch(/formule Growth, l'option est Ranking Starter/);
    expect(v.bouton.getAttribute("data-browse-plan")).toBe("starter");

    v.bouton.click();
    await vi.waitFor(() => expect(appelsOption(v.fetch).length).toBe(1));
    const [, opts] = appelsOption(v.fetch)[0];
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe("Bearer hx_test");
    expect(JSON.parse(opts.body)).toEqual({ browse_plan: "starter" });
  });

  it("Scale sans Ranking : le palier growth", async () => {
    const v = await voletFacturation({ plan: "scale", browse_plan: "none" });
    expect(v.bloc.hidden).toBe(false);
    expect(v.bouton.getAttribute("data-browse-plan")).toBe("growth");
  });

  for (const [cas, usage] of [
    ["Ranking déjà actif", { plan: "growth", browse_plan: "starter" }],
    ["Starter", { plan: "starter", browse_plan: "none" }],
    ["essai", { plan: "trial", browse_plan: "none", trial_days_left: 5 }],
    ["moteur qui ne rend pas browse_plan", { plan: "growth" }],
  ]) {
    it(`masqué : ${cas}`, async () => {
      const v = await voletFacturation(usage);
      expect(v.bloc.hidden).toBe(true);
    });
  }

  it("un refus du moteur s'affiche tel quel, et le bouton se rouvre", async () => {
    const detail = "Ranking est déjà actif sur ce compte (palier starter). Pour en changer ou l'arrêter, ouvrez le portail de facturation depuis « Mon abonnement ».";
    REPONSE_OPTION = { ok: false, status: 409, json: async () => ({ detail }) };
    const v = await voletFacturation({ plan: "growth", browse_plan: "none" });
    v.bouton.click();
    await vi.waitFor(() => expect(v.statut.textContent).toBe(detail));
    expect(v.statut.className).toMatch(/err/);
    expect(v.bouton.disabled).toBe(false);
  });

  it("?browse_added=1 : l'écran s'ouvre, dit que le paiement est reçu, et ne repropose pas le bouton", async () => {
    const v = await voletFacturation({ plan: "growth", browse_plan: "none" }, "console.html",
      "http://localhost/console.html?browse_added=1");
    expect(v.document.getElementById("pane-billing").hidden).toBe(false);
    expect(v.texte.textContent).toMatch(/^Paiement reçu/);
    expect(v.bouton.hidden).toBe(true);
    expect(v.window.location.search).toBe("");
  });

  it("console anglaise : les textes sont traduits", async () => {
    const v = await voletFacturation({ plan: "scale", browse_plan: "none" }, "en/console.html");
    expect(v.bouton.textContent.trim()).toBe("Add Ranking");
    expect(v.texte.textContent).toMatch(/On your Scale plan, the add-on is Ranking Growth, 25% off/);
  });
});
