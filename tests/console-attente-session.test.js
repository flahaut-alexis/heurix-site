import { describe, it, expect, vi, afterEach } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

/* CE QUE LA CONSOLE AFFICHE PENDANT /v1/auth/me (18 septembre 2026).
 *
 * Le formulaire de connexion, etat par defaut du HTML depuis le 20 juillet,
 * est devenu l'ecran de l'attente le 23 juillet (af7904b1), quand la reprise
 * de session est passee par /me. Mesure au banc, /me retarde a 3 s et 401 :
 * un client qui se connectait pendant l'attente voyait son tableau de bord a
 * 172 ms, puis etait renvoye a la connexion a 3032 ms, jeton neuf efface.
 *
 * Desormais, avec une session stockee : ni connexion ni tableau de bord tant
 * que /me n'a pas repondu, et 8 s au plus. Le moteur est un double ; la duree
 * de /me en production (20 a 100 ms) se mesure dans un navigateur, pas ici.
 */

const PAGES = [
  { page: "console.html", reseau: "Impossible de joindre api.heurix.fr. Le service est peut-être temporairement indisponible." },
  { page: "en/console.html", reseau: "Couldn't reach api.heurix.fr. The service may be temporarily unavailable." },
];

const reponse = (status, data) => ({ ok: status < 400, status, json: async () => data });

function chargerConsole(page, { jeton = null, me }) {
  const html = fs.readFileSync(path.join(RACINE, page), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/console.html", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  window.Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => ({ createLinearGradient: () => ({ addColorStop: () => {} }) });
  window.Chart = function () { return { destroy: () => {} }; };
  window.setTimeout = globalThis.setTimeout;
  if (jeton) window.localStorage.setItem("heurix_console_session", jeton);

  const f = vi.fn((url, options) => {
    const chemin = String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (chemin === "/v1/auth/me") return me(options);
    return Promise.resolve(reponse(200, {}));
  });
  global.fetch = f;
  window.fetch = f;

  // Le script du <head>, tel que le navigateur le jouerait avant console.js.
  const tete = html.match(/<script>(try\{if\(localStorage[\s\S]*?)<\/script>/);
  expect(tete, "script d'attente absent du <head>").not.toBeNull();
  window.eval(tete[1]);
  const enAttente = window.document.documentElement.hasAttribute("data-attente-session");

  window.eval(fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(RACINE, "console.js"), "utf8"));
  return { window, document: window.document, enAttente };
}

const $ = (document, id) => document.getElementById(id);
const attente = (document) => document.documentElement.hasAttribute("data-attente-session");
const formulaireVisible = (window) =>
  window.getComputedStyle(window.document.querySelector("#login-screen .console-login-wrap")).display !== "none";

const jamais = (options) => new Promise((_, rejeter) => {
  options.signal.addEventListener("abort", () => rejeter(new DOMException("aborted", "AbortError")));
});

afterEach(() => { vi.useRealTimers(); });

describe.each(PAGES)("$page, attente de /v1/auth/me", (P) => {
  it("sans session : la connexion tout de suite, aucune attente", () => {
    const { window, document, enAttente } = chargerConsole(P.page, { me: jamais });
    expect(enAttente).toBe(false);
    expect(attente(document)).toBe(false);
    expect($(document, "login-form").hidden).toBe(false);
    expect(formulaireVisible(window)).toBe(true);
  });

  it("session stockee : aucun formulaire utilisable tant que /me n'a pas repondu", async () => {
    let repondre;
    const { window, document, enAttente } = chargerConsole(P.page, {
      jeton: "sess_test",
      me: () => new Promise((r) => { repondre = r; }),
    });
    expect(enAttente).toBe(true);
    expect(formulaireVisible(window), "formulaire de connexion pendant l'attente").toBe(false);

    repondre(reponse(200, { email: "m@heurix.fr", keys: [{ key: "hx_sk_test" }], company: null, teammates: [] }));
    await vi.waitFor(() => expect($(document, "dashboard").hidden).toBe(false));
    expect(attente(document)).toBe(false);
  });

  it("401 : l'attente se termine sur la connexion et son message", async () => {
    const { window, document } = chargerConsole(P.page, {
      jeton: "sess_test",
      me: () => Promise.resolve(reponse(401, { detail: "Session invalide" })),
    });
    await vi.waitFor(() => expect($(document, "login-error").hidden).toBe(false));
    expect(attente(document)).toBe(false);
    expect(formulaireVisible(window)).toBe(true);
  });

  it("/me qui ne repond jamais : la connexion au bout de 8 s, jeton conserve", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const { window, document } = chargerConsole(P.page, { jeton: "sess_test", me: jamais });

    await vi.advanceTimersByTimeAsync(7999);
    expect(attente(document), "attente levee avant 8 s").toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect($(document, "login-error").hidden).toBe(false));
    expect(attente(document)).toBe(false);
    expect(formulaireVisible(window)).toBe(true);
    expect($(document, "login-error").textContent.trim()).toBe(P.reseau);
    // Pas verifie n'est pas invalide : un rechargement retente.
    expect(window.localStorage.getItem("heurix_console_session")).toBe("sess_test");
  });
});
