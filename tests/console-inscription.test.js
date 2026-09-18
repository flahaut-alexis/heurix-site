import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

/* `console.html?inscription`, CE QUI S'AFFICHE (18 septembre 2026).
 *
 * Mesure dans un navigateur apres 96fbaf75 :
 *  - le pied de l'inscription offrait « Créer un compte gratuit » -- l'ecran
 *    courant -- et aucun chemin vers la connexion ;
 *  - avec une session valide, `?inscription` n'etait jamais lu : le tableau
 *    de bord s'ouvrait sans rien dire ;
 *  - en anglais, le titre et le chapeau de l'inscription restaient en
 *    francais (cles du dictionnaire perimees depuis la reecriture du texte).
 *
 * Le moteur est un double : ce test prouve ce que l'ecran fait selon la
 * reponse de /v1/auth/me, pas ce que la production rend.
 */

const LANGUES = [
  {
    page: "console.html",
    titreInscription: "Votre clé API, en moins d'une minute.",
    chapeauInscription: "Une entreprise, un email, un mot de passe — la clé est générée immédiatement, affichée ici et envoyée par email.",
    versConnexion: "Déjà un compte ? Se connecter",
    dejaConnecte: "Vous êtes déjà connecté (m@heurix.fr). Pour ouvrir un compte pour une autre entreprise, déconnectez-vous d'abord.",
    sessionExpiree: "Votre session a expiré. Reconnectez-vous.",
  },
  {
    page: "en/console.html",
    titreInscription: "Your API key, in under a minute.",
    chapeauInscription: "A company, an email, a password: the key is generated immediately, shown here and emailed to you.",
    versConnexion: "Already have an account? Sign in",
    dejaConnecte: "You're already signed in (m@heurix.fr). To open an account for another company, sign out first.",
    sessionExpiree: "Your session has expired. Please sign in again.",
  },
];

function construireFetch(statutMe) {
  return vi.fn(async (url) => {
    const chemin = String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    const ok = (data) => ({ ok: true, status: 200, json: async () => data });
    if (chemin === "/v1/auth/me") {
      if (statutMe === 401) return { ok: false, status: 401, json: async () => ({ detail: "Session invalide" }) };
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

function chargerConsole(page, { recherche = "", jeton = null, statutMe = 200 } = {}) {
  const html = fs.readFileSync(path.join(RACINE, page), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/console.html" + recherche, runScripts: "outside-only", pretendToBeVisual: true });
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
  if (jeton) window.localStorage.setItem("heurix_console_session", jeton);

  const f = construireFetch(statutMe);
  global.fetch = f;
  window.fetch = f;

  window.eval(fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(RACINE, "console.js"), "utf8"));
  return { window, document: window.document };
}

const texte = (el) => el.textContent.replace(/\s+/g, " ").trim();
const $ = (document, id) => document.getElementById(id);

describe.each(LANGUES)("$page ?inscription", (L) => {
  it("sans session : le formulaire, et un pied qui mene a la connexion", () => {
    const { document } = chargerConsole(L.page, { recherche: "?inscription" });
    expect($(document, "signup-form").hidden).toBe(false);
    expect(texte($(document, "auth-title"))).toBe(L.titreInscription);
    expect(texte($(document, "auth-lede"))).toBe(L.chapeauInscription);
    expect($(document, "show-signup").hidden, "lien vers l'ecran courant").toBe(true);
    expect($(document, "show-login-inscription").hidden).toBe(false);
    expect(texte($(document, "show-login-inscription"))).toBe(L.versConnexion);
    expect($(document, "show-reset").hidden).toBe(false);

    $(document, "show-login-inscription").click();
    expect($(document, "login-form").hidden).toBe(false);
    expect($(document, "signup-form").hidden).toBe(true);
    expect($(document, "show-signup").hidden).toBe(false);
    expect($(document, "show-login-inscription").hidden).toBe(true);
  });

  it("le pied de la connexion ne propose pas la connexion", () => {
    const { document } = chargerConsole(L.page);
    expect($(document, "login-form").hidden).toBe(false);
    expect($(document, "show-signup").hidden).toBe(false);
    expect($(document, "show-login-inscription").hidden).toBe(true);
  });

  it("session valide : le tableau de bord, en le disant", async () => {
    const { document } = chargerConsole(L.page, { recherche: "?inscription", jeton: "sess_test" });
    await vi.waitFor(() => expect($(document, "dashboard").hidden).toBe(false));
    expect($(document, "deja-connecte").hidden).toBe(false);
    expect(texte($(document, "deja-connecte"))).toBe(L.dejaConnecte);
    // Ouvrir la page ne ferme jamais une session.
    expect(document.defaultView.localStorage.getItem("heurix_console_session")).toBe("sess_test");
  });

  it("session valide sans ?inscription : rien a dire", async () => {
    const { document } = chargerConsole(L.page, { jeton: "sess_test" });
    await vi.waitFor(() => expect($(document, "dashboard").hidden).toBe(false));
    expect($(document, "deja-connecte").hidden).toBe(true);
  });

  it("session expiree : la connexion et son message, pas l'inscription", async () => {
    const { document } = chargerConsole(L.page, { recherche: "?inscription", jeton: "sess_test", statutMe: 401 });
    await vi.waitFor(() => expect($(document, "login-error").hidden).toBe(false));
    expect(texte($(document, "login-error"))).toBe(L.sessionExpiree);
    expect($(document, "login-form").hidden).toBe(false);
    expect($(document, "signup-form").hidden).toBe(true);
    expect($(document, "deja-connecte").hidden).toBe(true);
  });
});
