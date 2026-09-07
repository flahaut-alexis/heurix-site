import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

/* LE BOUTON QUI MANQUAIT, JOUE EN ENTIER, DANS LES DEUX LANGUES.
 *
 * La route existe en production depuis le 7 septembre 2026 et l'app Shopify
 * l'attend ; le marchand n'avait aucun moyen d'obtenir son code autrement
 * qu'en curl. Ce fichier exerce le chemin complet -- connexion, volet
 * « Clé API », clic, affichage, compte a rebours, copie -- parce que trois
 * choses ne se voient pas en relisant la source :
 *
 *   1. QUEL JETON PART. Cette route s'authentifie par le jeton de SESSION,
 *      pas par la cle API. Les deux sont des chaines dans un en-tete
 *      `Bearer` : une confusion ne se verrait qu'en 401, en production.
 *   2. QUE LE CODE DISPARAIT A SON EXPIRATION. Une credential laissee a
 *      l'ecran d'un poste partage est le defaut que le compte a rebours
 *      existe pour fermer, et un compte a rebours qui affiche « 0 » sans
 *      rien retirer ne le ferme pas.
 *   3. QUE L'ANGLAIS EST SERVI EN ANGLAIS. Le panneau est ecrit en francais
 *      dans les deux fichiers -- c'est le mecanisme documente en tete de
 *      console-i18n.js -- donc une entree de dictionnaire manquante donne du
 *      francais sur la console anglaise, sans que rien n'echoue.
 */

const CODE = "XJE2Y-AFHSW";
const JETON_SESSION = "sess_du_marchand";
const CLE_API = "hx_test";

function construireFetch(reponseCode) {
  const appels = [];
  const f = vi.fn(async (url, options) => {
    const chemin = String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    appels.push({ chemin, options: options || {} });
    if (chemin === "/v1/auth/login") {
      return { ok: true, json: async () => ({ session_token: JETON_SESSION, keys: [{ key: CLE_API }] }) };
    }
    if (chemin === "/v1/auth/code-liaison") return reponseCode();
    if (chemin === "/v1/auth/me") {
      return { ok: true, json: async () => ({
        email: "moi@heurix.fr", role: "admin",
        company: { raison_sociale: "Maison Test", numero_tva: null },
        keys: [{ key: CLE_API }], teammates: [],
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
        requests: 0, account_email: "moi@heurix.fr", catalogs_used: 1,
        first_search_at: null, first_browse_at: null,
      }) };
    }
    return { ok: true, json: async () => ({}) };
  });
  return { f, appels };
}

function chargerConsole(page, reponseCode) {
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

  // `navigator` est en lecture seule sur le global de Node, et console.js
  // tourne dans `window.eval` : c'est le navigator de la FENETRE qu'il lit,
  // pas celui du global. On pose donc le presse-papiers sur la fenetre, par
  // defineProperty -- l'affectation directe echoue aussi, `clipboard` etant
  // un accesseur sur le prototype JSDOM.
  const copies = [];
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: (t) => { copies.push(t); return Promise.resolve(); } },
  });

  const { f, appels } = construireFetch(reponseCode);
  global.fetch = f;
  window.fetch = f;

  window.eval(fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(RACINE, "console.js"), "utf8"));
  return { window, document: window.document, appels, copies };
}

const ok = () => ({ ok: true, json: async () => ({ code: CODE, expire_dans: 600 }) });

async function connecter(window, document) {
  document.getElementById("login-email").value = "moi@heurix.fr";
  document.getElementById("login-password").value = "peu-importe";
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await vi.waitFor(() => { expect(document.getElementById("dash-content").hidden).toBe(false); });
}

async function engendrer(window, document) {
  document.querySelector('[data-goto-pane="pane-key"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  document.getElementById("code-liaison-form").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  await vi.waitFor(() => {
    expect(document.getElementById("code-liaison-resultat").hidden).toBe(false);
  });
}

describe("console.js — le code de liaison", () => {
  it("affiche le code, son tiret, et l'heure d'expiration", async () => {
    const { window, document } = chargerConsole("console.html", ok);
    await connecter(window, document);
    await engendrer(window, document);

    // LE TIRET EST AFFICHE. Il n'est pas stocke cote moteur -- il n'existe
    // que pour la recopie, et c'est ici qu'il sert.
    expect(document.getElementById("code-liaison-valeur").textContent).toBe(CODE);
    expect(document.getElementById("code-liaison-valeur").textContent).toContain("-");

    const peremption = document.getElementById("code-liaison-peremption").textContent;
    expect(peremption).toMatch(/Valable jusqu'à \d{2}:\d{2}/);
    // 10 min 00 s a l'instant du rendu ; 9 min 59 s si plus d'une
    // demi-seconde s'est ecoulee depuis la reponse. Les deux sont justes --
    // borner a « 9 » etait MON hypothese, et le test l'a corrigee.
    expect(peremption).toMatch(/encore (9|10) min \d{2} s/);
  });

  it("s'authentifie par le jeton de SESSION, jamais par la clé API", async () => {
    const { window, document, appels } = chargerConsole("console.html", ok);
    await connecter(window, document);
    await engendrer(window, document);

    const appel = appels.find((a) => a.chemin === "/v1/auth/code-liaison");
    expect(appel.options.method).toBe("POST");
    expect(appel.options.headers.Authorization).toBe("Bearer " + JETON_SESSION);
    // LE TEMOIN : les deux chaines sont differentes, donc l'assertion
    // ci-dessus mesure quelque chose. Avec un jeton et une clef identiques
    // elle serait vraie dans les deux cas.
    expect(JETON_SESSION).not.toBe(CLE_API);
    expect(appel.options.headers.Authorization).not.toContain(CLE_API);
  });

  it("ne met le code ni dans localStorage ni dans une URL", async () => {
    const { window, document, appels } = chargerConsole("console.html", ok);
    await connecter(window, document);
    await engendrer(window, document);

    expect(JSON.stringify(window.localStorage)).not.toContain(CODE);
    expect(appels.every((a) => !a.chemin.includes(CODE))).toBe(true);
  });

  it("copie le code dans le presse-papiers", async () => {
    const { window, document, copies } = chargerConsole("console.html", ok);
    await connecter(window, document);
    await engendrer(window, document);

    document.getElementById("code-liaison-copier").dispatchEvent(new window.Event("click", { bubbles: true }));
    await vi.waitFor(() => { expect(copies).toEqual([CODE]); });
    await vi.waitFor(() => {
      expect(document.getElementById("code-liaison-copie").hidden).toBe(false);
    });
  });

  it("n'affiche rien avant le clic", async () => {
    const { window, document } = chargerConsole("console.html", ok);
    await connecter(window, document);
    document.querySelector('[data-goto-pane="pane-key"]').dispatchEvent(new window.Event("click", { bubbles: true }));

    // UNE CREDENTIAL VIVANTE NE S'AFFICHE PAS AU CHARGEMENT. Le panneau est
    // dans un volet qu'on ouvre rarement, et le code n'apparait qu'apres un
    // geste explicite.
    expect(document.getElementById("code-liaison-resultat").hidden).toBe(true);
    expect(document.getElementById("code-liaison-valeur").textContent).toBe("");
  });

  it("dit que le code précédent reste valable — et seulement en ce cas", async () => {
    const { window, document } = chargerConsole("console.html", ok);
    await connecter(window, document);
    await engendrer(window, document);

    // MESURE DU 7 SEPTEMBRE 2026 COTE MOTEUR : `create_code_liaison` est un
    // INSERT, rien d'autre. Taire cette phrase laisserait croire l'inverse,
    // qui est ce que tout le monde suppose d'un bouton « engendrer ».
    const phrase = document.getElementById("code-liaison-precedent");
    expect(phrase.hidden).toBe(true, "affichée dès le premier code");

    document.getElementById("code-liaison-form").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
    await vi.waitFor(() => { expect(phrase.hidden).toBe(false); });
  });

  it("retire le code de l'écran quand il expire", async () => {
    // TEMPS REEL, PAS DE FAUX MINUTEURS, et ce n'est pas un choix de
    // confort : `vi.useFakeTimers()` avance `setInterval` sans avancer
    // `Date.now()` par defaut. Le compte a rebours lit l'horloge a chaque
    // battement -- l'interval se declenchait donc trois fois en lisant
    // toujours « il reste 2 s », et le test echouait sur un code qui ne
    // disparaissait pas. Le defaut etait dans l'instrument.
    const { window, document } = chargerConsole("console.html", () => ({
      ok: true, json: async () => ({ code: CODE, expire_dans: 1 }),
    }));
    await connecter(window, document);
    await engendrer(window, document);

    // TEMOIN : le code est bien la AVANT que le temps passe. Sans lui, un
    // panneau qui ne se serait jamais rempli rendrait la suite verte.
    expect(document.getElementById("code-liaison-valeur").textContent).toBe(CODE);

    // LE CODE PART, il ne reste pas affiche avec une mention « expire » : le
    // laisser inviterait a le recopier quand meme, et l'app rendrait un
    // refus que le marchand ne rattacherait pas a cet ecran.
    await vi.waitFor(() => {
      expect(document.getElementById("code-liaison-resultat").hidden).toBe(true);
    }, { timeout: 4000, interval: 100 });
    expect(document.getElementById("code-liaison-valeur").textContent).toBe("");
    expect(document.getElementById("code-liaison-status").textContent)
      .toBe("Ce code a expiré. Engendrez-en un nouveau.");
  });

  it("montre le refus du moteur au lieu d'un message générique", async () => {
    const MESSAGE = "Ce compte n'est rattaché à aucune entreprise";
    const { window, document } = chargerConsole("console.html", () => ({
      ok: false, status: 409, json: async () => ({ detail: MESSAGE }),
    }));
    await connecter(window, document);
    document.querySelector('[data-goto-pane="pane-key"]').dispatchEvent(new window.Event("click", { bubbles: true }));
    document.getElementById("code-liaison-form").dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));

    const statut = document.getElementById("code-liaison-status");
    await vi.waitFor(() => { expect(statut.textContent).toBe(MESSAGE); });
    expect(statut.classList.contains("err")).toBe(true);
    expect(document.getElementById("code-liaison-resultat").hidden).toBe(true);
    // Le bouton redevient cliquable : un refus n'est pas une impasse.
    expect(document.getElementById("code-liaison-btn").disabled).toBe(false);
  });

  it("efface le code affiché à la déconnexion", async () => {
    const { window, document } = chargerConsole("console.html", ok);
    await connecter(window, document);
    await engendrer(window, document);
    expect(document.getElementById("code-liaison-valeur").textContent).toBe(CODE);

    // Il reste valable cote moteur -- rien ne l'annule -- mais il ne doit
    // pas etre remis a la personne suivante sur un poste partage.
    document.getElementById("logout-btn").dispatchEvent(new window.Event("click", { bubbles: true }));
    await vi.waitFor(() => {
      expect(document.getElementById("code-liaison-valeur").textContent).toBe("");
    });
    expect(document.getElementById("code-liaison-resultat").hidden).toBe(true);
  });
});

describe("console anglaise — le panneau est servi en anglais", () => {
  it("traduit le panneau, le bouton et le compte à rebours", async () => {
    const { window, document } = chargerConsole("en/console.html", ok);
    await connecter(window, document);
    await engendrer(window, document);

    const panneau = document.getElementById("panneau-code-liaison");
    // Le panneau est ecrit en FRANCAIS dans les deux fichiers : c'est le
    // chemin 1 de console-i18n.js qui le traduit. Une entree manquante
    // donnerait du francais ici, sans que rien n'echoue.
    expect(panneau.querySelector("h2").textContent).toBe("Link a store");
    expect(document.getElementById("code-liaison-btn").textContent).toBe("Generate a code");
    expect(panneau.textContent).toContain("Your Heurix password will never be asked for inside the app.");
    expect(panneau.textContent).not.toContain("Engendrer");
    expect(panneau.textContent).not.toContain("mot de passe");

    // Chemin 2 : la chaine vient de console.js, par T().
    // `toLocaleTimeString("en-US")` rend « 11:08 PM » : l'heure anglaise
    // porte un suffixe que le format francais n'a pas.
    expect(document.getElementById("code-liaison-peremption").textContent)
      .toMatch(/^Valid until \d{1,2}:\d{2}(\s?[AP]M)? — (9|10) min \d{2} s left\.$/);
  });

  it("traduit le message d'expiration", async () => {
    const { window, document } = chargerConsole("en/console.html", () => ({
      ok: true, json: async () => ({ code: CODE, expire_dans: 1 }),
    }));
    await connecter(window, document);
    await engendrer(window, document);
    expect(document.getElementById("code-liaison-valeur").textContent).toBe(CODE);

    await vi.waitFor(() => {
      expect(document.getElementById("code-liaison-status").textContent)
        .toBe("This code has expired. Generate a new one.");
    }, { timeout: 4000, interval: 100 });
  });
});
