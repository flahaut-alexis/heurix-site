import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

/* CE QUE LA CONSOLE DIT DE LA FIN DE L'ESSAI (18 septembre 2026).
 *
 * Elle disait « Choisissez une formule pour continuer à utiliser Heurix »,
 * et, pendant l'essai, « choisissez une formule pour continuer après son
 * terme ». Mesuré le même jour sur le moteur : rien ne s'arrête au jour 14.
 * La recherche répond 200 aux jours 15 et 45, et une clé d'essai expirée
 * garde les plafonds de l'essai (`_plan_effectif` rend `trial` dans les deux
 * cas). Le comportement est voulu : on ne coupe personne. Ce sont les
 * phrases qui mentaient. Le test joue le volet Facturation, dans les deux
 * langues, et lit le DOM.
 */

let USAGE = {};

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
        plan: "trial", requests: 0, limit: 2000, account_email: "moi@heurix.fr",
        catalogs_used: 1, catalogs_limit: 2, products_limit: 2000,
        first_search_at: null, first_browse_at: null, ...USAGE,
      }) };
    }
    return { ok: true, json: async () => ({}) };
  });
}

function chargerConsole(page) {
  const html = fs.readFileSync(path.join(RACINE, page), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/console.html", runScripts: "outside-only", pretendToBeVisual: true });
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
  return { window, document: window.document };
}

async function connecter(window, document) {
  document.getElementById("login-email").value = "moi@heurix.fr";
  document.getElementById("login-password").value = "peu-importe";
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await vi.waitFor(() => {
    expect(document.getElementById("dash-content").hidden).toBe(false);
  });
}

async function voletFacturation(page, usage) {
  USAGE = usage;
  const { window, document } = chargerConsole(page);
  await connecter(window, document);
  document.querySelector('[data-goto-pane="pane-billing"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  await vi.waitFor(() => {
    expect(document.getElementById("billing-trial").hidden).toBe(false);
  });
  return {
    essai: document.getElementById("billing-trial").textContent,
    souscrire: document.getElementById("billing-upgrade-text").textContent,
  };
}

const CAS = [
  { page: "console.html", plafonds: /garde les plafonds de l'essai ; une formule les lève/, faux: /pour continuer/ },
  { page: "en/console.html", plafonds: /keeps the trial limits; a plan lifts them/, faux: /keep using|continue after/ },
];

describe("la console dit ce qui se passe à la fin de l'essai", () => {
  for (const c of CAS) {
    it(`${c.page} : essai terminé`, async () => {
      const { essai } = await voletFacturation(c.page, { trial_expired: true, trial_days_left: 0 });
      expect(essai).toMatch(c.plafonds);
      expect(essai).not.toMatch(c.faux);
    });
    it(`${c.page} : essai en cours`, async () => {
      const { essai, souscrire } = await voletFacturation(c.page, { trial_expired: false, trial_days_left: 5 });
      expect(essai).toMatch(/5/);
      expect(souscrire).toMatch(c.plafonds);
      expect(souscrire).not.toMatch(c.faux);
    });
  }
});
