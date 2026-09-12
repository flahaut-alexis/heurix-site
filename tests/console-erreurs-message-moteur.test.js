import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

/* LE JOURNAL D'ERREURS MONTRE LE MESSAGE DU MOTEUR SUR UN 4xx
 * (13 septembre 2026).
 *
 * `traduireErreur` rendait l'entree { code: 422, motif: null } pour TOUT 422.
 * Le marchand lisait « format ou paramètre invalide » et « problème
 * d'intégration côté site » ; le nom refuse et la liste des valeurs valides
 * restaient dans « Détail technique », replie.
 *
 * Messages et statuts copies du moteur a 4298061 :
 *   422  routers/index.py:690  PUT .../config, pack inconnu
 *   429  usage.py:1457         plafond de produits (PlanLimitExceeded)
 *   429  usage.py:1442         plafond de catalogues -- porte « catalogue »
 *   500  main.py:443           exception non geree, `{type}: {exc}`
 */

const PACK_INCONNU = "Pack de règles inconnu : 'quincaillerie'. Valeurs possibles : ['automobile', 'fixation', 'generic']";
const PLAFOND_PRODUITS = "Plafond de 5000 produits du plan 'starter' dépassé (5600 produits, marge de 10% également dépassée). Passez à un plan supérieur pour indexer davantage.";
const PLAFOND_CATALOGUES = "Plafond de 1 catalogue(s) du plan 'starter' atteint. Passez à un plan supérieur pour en créer un nouveau.";
const EXCEPTION = "KeyError: 'prix'";

const ERREURS = [
  { endpoint: "/v1/index/outillage-demo/config", status_code: 422, message: PACK_INCONNU, at: "2026-09-12T10:05:00+00:00" },
  { endpoint: "/v1/index/outillage-demo/items", status_code: 429, message: PLAFOND_PRODUITS, at: "2026-09-12T10:04:00+00:00" },
  { endpoint: "/v1/index/neuf/items", status_code: 429, message: PLAFOND_CATALOGUES, at: "2026-09-12T10:03:00+00:00" },
  { endpoint: "/v1/index/outillage-demo/search", status_code: 500, message: EXCEPTION, at: "2026-09-12T10:02:00+00:00" },
  { endpoint: "/v1/index/outillage-demo/items", status_code: 422, message: "", at: "2026-09-12T10:01:00+00:00" },
];

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
    if (chemin.startsWith("/v1/analytics/errors")) return { ok: true, json: async () => ({ errors: ERREURS }) };
    if (chemin.startsWith("/v1/analytics/")) return { ok: true, json: async () => ({ queries: [] }) };
    if (chemin.startsWith("/v1/usage")) {
      return { ok: true, json: async () => ({
        requests: 0, account_email: "moi@heurix.fr", catalogs_used: 1,
        first_search_at: null, first_browse_at: null,
      }) };
    }
    return { ok: true, json: async () => ({}) };
  });
}

async function lignesDuJournal() {
  const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
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

  const document = window.document;
  document.getElementById("login-email").value = "moi@heurix.fr";
  document.getElementById("login-password").value = "peu-importe";
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  return vi.waitFor(() => {
    const lignes = document.querySelectorAll("#errors-table tbody tr");
    expect(lignes.length).toBe(ERREURS.length);
    return Array.from(lignes).map((tr) => ({
      phrase: tr.querySelector(".err-phrase").textContent,
      aide: tr.querySelector(".err-aide") && tr.querySelector(".err-aide").textContent,
      action: tr.querySelector(".err-action") && tr.querySelector(".err-action").textContent,
      detail: tr.querySelector(".err-detail").textContent,
    }));
  });
}

describe("console.js — le journal d'erreurs et le message du moteur", () => {
  it("un 422 montre le message du moteur, sans la phrase generique", async () => {
    const [pack] = await lignesDuJournal();
    expect(pack.phrase).toBe(PACK_INCONNU);
    expect(pack.aide).toBeNull();
    // Le message n'est pas repete dans le detail, qui garde la route et le code.
    expect(pack.detail).not.toContain("quincaillerie");
    expect(pack.detail).toContain("/v1/index/outillage-demo/config");
  });

  it("un 429 sans motif montre le message du moteur ET garde son action", async () => {
    const [, produits] = await lignesDuJournal();
    expect(produits.phrase).toBe(PLAFOND_PRODUITS);
    expect(produits.action).toBe("Voir les formules");
  });

  it("une entree avec motif garde sa traduction", async () => {
    const [, , catalogues] = await lignesDuJournal();
    expect(catalogues.phrase).toBe("Vous avez atteint le nombre de catalogues de votre formule.");
  });

  it("un 500 reste traduit : son message est celui d'une exception", async () => {
    const [, , , panne] = await lignesDuJournal();
    expect(panne.phrase).toBe("Une erreur interne du moteur s'est produite.");
    expect(panne.detail).toContain(EXCEPTION);
  });

  it("un 422 sans message retombe sur la traduction", async () => {
    const [, , , , vide] = await lignesDuJournal();
    expect(vide.phrase).toBe("Une requête a été refusée : format ou paramètre invalide.");
  });
});
