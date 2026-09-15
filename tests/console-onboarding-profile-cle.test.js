import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

/* LES REPONSES D'ONBOARDING PARTENT AVEC LA CLE SERVEUR (15 septembre 2026).
 *
 * POST /v1/auth/onboarding-profile est derriere require_key (cle hx_
 * seulement). La console l'envoyait par apiPost, sans Authorization, du
 * 3 aout (ajout sous /v1/auth/segmentation) au 15 septembre 2026. Mesure
 * sur heurix-engine cf6a61b par TestClient : sans en-tete 401, avec le
 * jeton de session 403, ligne inchangee dans les deux cas. Le `.catch` de
 * tache de fond avalait le refus : aucune reponse n'a jamais ete
 * enregistree.
 *
 * Le moteur est un double qui laisse cette requete en attente : le test
 * prouve que la cle part et que le tableau de bord n'attend pas la
 * reponse, pas que la production l'accepte.
 */

const LANGUES = [{ page: "console.html" }, { page: "en/console.html" }];

// `attente` : la requete ne repond jamais. `refus` : le 401 releve sur
// heurix-engine cf6a61b quand l'en-tete manque.
function construireFetch(onboarding) {
  return vi.fn((url) => {
    const chemin = String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    const ok = (data) => Promise.resolve({ ok: true, status: 200, json: async () => data });
    if (chemin === "/v1/auth/onboarding-profile") {
      if (onboarding === "attente") return new Promise(() => {});
      return Promise.resolve({ ok: false, status: 401,
        json: async () => ({ detail: "Missing or malformed Authorization header" }) });
    }
    if (chemin === "/v1/auth/signup") {
      return ok({ session_token: "sess_test", email: "m@heurix.fr", key: "hx_sk_test",
        company: { raison_sociale: "Maison Test" }, email_sent: true });
    }
    if (chemin === "/v1/auth/me") {
      return ok({ email: "m@heurix.fr", role: "admin", company: { raison_sociale: "Maison Test", numero_tva: null },
        keys: [{ key: "hx_sk_test" }], teammates: [] });
    }
    if (chemin === "/v1/index/catalogs") return ok({ catalogs: [{ catalog: "outillage-demo" }] });
    if (chemin === "/v1/keys/public") return ok({ keys: [] });
    if (chemin.startsWith("/v1/rulepacks")) return ok({ rulepacks: [] });
    if (chemin.startsWith("/v1/analytics/summary")) {
      return ok({ total_searches: 0, zero_result_rate: 0, total_errors: 0, daily_searches: [] });
    }
    if (chemin.startsWith("/v1/analytics/errors")) return ok({ errors: [] });
    if (chemin.startsWith("/v1/analytics/")) return ok({ queries: [] });
    if (chemin.startsWith("/v1/usage")) {
      return ok({ requests: 0, account_email: "m@heurix.fr", catalogs_used: 1, first_search_at: null, first_browse_at: null });
    }
    return ok({});
  });
}

function chargerConsole(page, onboarding) {
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
  const warn = vi.fn();
  window.console.warn = warn;

  const f = construireFetch(onboarding);
  global.fetch = f;
  window.fetch = f;

  window.eval(fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(RACINE, "console.js"), "utf8"));
  return { window, document: window.document, fetch: f, warn };
}

async function repondreEtContinuer(window, document) {
  document.getElementById("signup-raison-sociale").value = "Maison Test";
  document.getElementById("signup-email").value = "m@heurix.fr";
  document.getElementById("signup-password").value = "0123456789";
  document.getElementById("signup-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await vi.waitFor(() => {
    expect(document.getElementById("post-signup-screen").hidden).toBe(false);
  });

  document.getElementById("seg-secteur").value = "outillage";
  document.getElementById("seg-plateforme").value = "shopify";
  document.getElementById("post-signup-continue-btn").click();

  await vi.waitFor(() => {
    expect(document.getElementById("dash-content").hidden).toBe(false);
  });
}

describe.each(LANGUES)("$page — reponses d'onboarding", (l) => {
  /* UN REFUS SE VOIT DANS LA CONSOLE DU NAVIGATEUR. Le marchand n'a rien a
   * faire d'un echec (reponses facultatives, ecran deja ferme), mais le
   * `.catch` muet est ce qui a cache le 401 pendant six semaines.
   * console-ecritures-muettes.test.js exempte cet appel : c'est ce test qui
   * empeche le silence de revenir. */
  it("un refus du moteur est journalise, et le tableau de bord reste accessible", async () => {
    const { window, document, warn } = chargerConsole(l.page, "refus");
    await repondreEtContinuer(window, document);
    await vi.waitFor(() => { expect(warn).toHaveBeenCalledTimes(1); });
    const message = warn.mock.calls[0].map(String).join(" ");
    expect(message).toContain("/v1/auth/onboarding-profile");
    expect(message).toContain("401");
    expect(message).toContain("Missing or malformed Authorization header");
    expect(document.getElementById("dash-content").hidden).toBe(false);
  });

  it("partent avec la cle serveur, et le tableau de bord n'attend pas la reponse", async () => {
    const { window, document, fetch, warn } = chargerConsole(l.page, "attente");
    await repondreEtContinuer(window, document);
    expect(warn).not.toHaveBeenCalled();
    const appels = fetch.mock.calls.filter(([url]) => String(url).endsWith("/v1/auth/onboarding-profile"));
    expect(appels).toHaveLength(1);
    const [, init] = appels[0];
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer hx_sk_test");
    expect(JSON.parse(init.body)).toEqual({ secteur: "outillage", plateforme: "shopify" });
  });
});
