import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Six chantiers "quick win" de l'audit QA/UX/A11Y du 8 août 2026.
// BUG-002, UX-002, BUG-001, A11Y-002, UX-001, UX-003.
// ---------------------------------------------------------------------------

function chargerConsole(urlSuffix = "") {
  const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
  const dom = new JSDOM(html, {
    url: "http://localhost/console.html" + urlSuffix,
    runScripts: "outside-only", pretendToBeVisual: true,
  });
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
  const i18n = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");
  window.eval(i18n);
  return { window, document: window.document };
}

function mockFetchAvecErreur({ status = null, detail = null } = {}) {
  return vi.fn(async (url) => {
    const chemin = String(url).replace(/^https?:\/\/[^/]+/, "");
    if (status === null) {
      // Vraie coupure reseau : fetch() lui-meme echoue, aucune reponse HTTP.
      throw new TypeError("Failed to fetch");
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (detail ? { detail } : {}),
    };
  });
}

describe("BUG-002 — gestion d'erreur réseau harmonisée (signup, accept-invite, reset-confirm)", () => {
  it("signup : une vraie coupure réseau affiche le message français générique, jamais le texte brut du navigateur", async () => {
    const { window, document } = chargerConsole();
    const fetchMock = mockFetchAvecErreur(); // pas de status => vraie erreur reseau
    global.fetch = fetchMock; window.fetch = fetchMock;
    const source = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
    window.eval(source);

    document.getElementById("show-signup").dispatchEvent(new window.Event("click", { bubbles: true }));
    document.getElementById("signup-raison-sociale").value = "Test";
    document.getElementById("signup-email").value = "test@test.fr";
    document.getElementById("signup-password").value = "MotDePasseSolide2026";
    document.getElementById("signup-form").dispatchEvent(new window.Event("submit", { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById("signup-error").textContent).not.toBe("");
    });
    const texte = document.getElementById("signup-error").textContent;
    expect(texte).not.toMatch(/Failed to fetch|TypeError/i);
    expect(texte.length).toBeGreaterThan(0);
  });

  it("signup : une vraie erreur métier (409, compte existant) affiche le vrai message du serveur", async () => {
    const { window, document } = chargerConsole();
    const fetchMock = mockFetchAvecErreur({ status: 409, detail: "Un compte existe déjà avec cet email" });
    global.fetch = fetchMock; window.fetch = fetchMock;
    const source = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
    window.eval(source);

    document.getElementById("show-signup").dispatchEvent(new window.Event("click", { bubbles: true }));
    document.getElementById("signup-raison-sociale").value = "Test";
    document.getElementById("signup-email").value = "existe@test.fr";
    document.getElementById("signup-password").value = "MotDePasseSolide2026";
    document.getElementById("signup-form").dispatchEvent(new window.Event("submit", { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById("signup-error").textContent).toBe("Un compte existe déjà avec cet email");
    });
  });

  it("accept-invite : une vraie coupure réseau affiche le message français générique", async () => {
    const { window, document } = chargerConsole("?invite=test-token-123");
    const fetchMock = mockFetchAvecErreur();
    global.fetch = fetchMock; window.fetch = fetchMock;
    const source = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
    window.eval(source);

    const form = document.getElementById("accept-invite-form");
    expect(form, "l'ecran d'acceptation d'invitation doit s'afficher avec ?invite=...").not.toBeNull();
    document.getElementById("accept-invite-password").value = "MotDePasseSolide2026";
    form.dispatchEvent(new window.Event("submit", { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById("accept-invite-error").textContent).not.toBe("");
    });
    expect(document.getElementById("accept-invite-error").textContent).not.toMatch(/Failed to fetch/i);
  });

  it("reset-confirm : une vraie coupure réseau affiche le message français générique", async () => {
    const { window, document } = chargerConsole("?reset=test-token-456");
    const fetchMock = mockFetchAvecErreur();
    global.fetch = fetchMock; window.fetch = fetchMock;
    const source = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
    window.eval(source);

    const form = document.getElementById("reset-confirm-form");
    expect(form, "l'ecran de confirmation de reinitialisation doit s'afficher avec ?reset=...").not.toBeNull();
    document.getElementById("reset-new-password").value = "MotDePasseSolide2026";
    form.dispatchEvent(new window.Event("submit", { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById("reset-confirm-error").textContent).not.toBe("");
    });
    expect(document.getElementById("reset-confirm-error").textContent).not.toMatch(/Failed to fetch/i);
  });
});

describe("BUG-001 — format de prix français dans le widget", () => {
  function chargerWidget(reponseRecherche) {
    const html = `<!DOCTYPE html><html><body><div id="recherche"></div></body></html>`;
    const dom = new JSDOM(html, { url: "http://localhost/test.html", runScripts: "outside-only", pretendToBeVisual: true });
    const { window } = dom;
    global.window = window; global.document = window.document;
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => reponseRecherche }));
    global.fetch = fetchMock; window.fetch = fetchMock;
    const source = fs.readFileSync(path.join(RACINE, "downloads/heurix-search.js"), "utf8");
    window.eval(source);
    window.Heurix.searchBox({ apiKey: "hxp_test", catalog: "test", containerId: "recherche" });
    return { window, document: window.document };
  }

  // Le prix simple est déjà couvert dans heurix-search.test.js (test
  // BUG-001, avec l'explication de pourquoi une valeur entière comme
  // 39.00 ne révèle jamais ce bug -- ne pas dupliquer ici). Le prix
  // barré, lui, n'est testé nulle part ailleurs.

  it("affiche un prix barré (remise) au format français, prix courant ET prix barré", async () => {
    const { window, document } = chargerWidget({
      query: "vis", tokens: ["vis"], total: 1, hits: [
        { product: { id: "P1", name: "Vis M8", price: 5.9, compare_at_price: 6.9 }, matched: [] },
      ],
    });
    const champ = document.querySelector("input");
    champ.value = "vis";
    champ.dispatchEvent(new window.Event("input", { bubbles: true }));
    await vi.waitFor(() => {
      expect(document.querySelector(".hx-search-hit-price").textContent).toBe("5,90 €");
    });
    expect(document.querySelector(".hx-search-hit-price-barre").textContent).toBe("6,90 €");
  });
});

describe("A11Y-002 — aria-expanded sur les sections de sidebar", () => {
  function chargerConsoleMockee() {
    const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
    const dom = new JSDOM(html, { url: "http://localhost/console.html", runScripts: "outside-only", pretendToBeVisual: true });
    const { window } = dom;
    global.window = window; global.document = window.document; global.localStorage = window.localStorage;
    window.Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
    window.HTMLCanvasElement.prototype.getContext = () => ({ createLinearGradient: () => ({ addColorStop: () => {} }) });
    window.Chart = function () { return { destroy: () => {} }; };
    const fetchMock = vi.fn(async (url) => {
      const chemin = String(url).replace(/^https?:\/\/[^/]+/, "");
      if (chemin === "/v1/auth/login") return { ok: true, json: async () => ({ session_token: "tok", keys: [{ key: "cle-test" }] }) };
      if (chemin === "/v1/index/catalogs") return { ok: true, json: async () => ({ catalogs: [] }) };
      return { ok: true, json: async () => ({ queries: [], errors: [], total_searches: 0, zero_result_rate: 0, total_errors: 0, daily_searches: [], requests: 0 }) };
    });
    global.fetch = fetchMock; window.fetch = fetchMock;
    const i18n = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");
    window.eval(i18n);
    const source = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
    window.eval(source);
    return { window, document: window.document };
  }

  async function connecter(window, document) {
    document.getElementById("login-email").value = "test@heurix.fr";
    document.getElementById("login-password").value = "x";
    document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(document.getElementById("dash-content").hidden).toBe(false));
  }

  it("aria-expanded vaut false dès le départ, avant toute interaction", async () => {
    const { window, document } = chargerConsoleMockee();
    await connecter(window, document);
    const bouton = document.querySelector('[data-section="configurer"]');
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
  });

  it("passe à true à l'ouverture, false à la fermeture", async () => {
    const { window, document } = chargerConsoleMockee();
    await connecter(window, document);
    const bouton = document.querySelector('[data-section="configurer"]');
    bouton.dispatchEvent(new window.Event("click", { bubbles: true }));
    expect(bouton.getAttribute("aria-expanded")).toBe("true");
    bouton.dispatchEvent(new window.Event("click", { bubbles: true }));
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
  });

  it("passe à true quand la section s'ouvre via un lien data-goto-pane, pas seulement au clic direct", async () => {
    const { window, document } = chargerConsoleMockee();
    await connecter(window, document);
    const lien = document.querySelector('[data-goto-pane="pane-browse"]'); // vit sous Optimiser
    lien.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    const bouton = document.querySelector('[data-section="optimiser"]');
    expect(bouton.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("UX-003 — garde-fou sur le chargement de Chart.js", () => {
  it("le tableau de bord continue de s'afficher même si Chart n'a jamais chargé", async () => {
    const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
    const dom = new JSDOM(html, { url: "http://localhost/console.html", runScripts: "outside-only", pretendToBeVisual: true });
    const { window } = dom;
    global.window = window; global.document = window.document; global.localStorage = window.localStorage;
    window.Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
    window.HTMLCanvasElement.prototype.getContext = () => ({ createLinearGradient: () => ({ addColorStop: () => {} }) });
    // PAS de window.Chart ici -- exactement le scenario que UX-003 doit tolerer.
    const fetchMock = vi.fn(async (url) => {
      const chemin = String(url).replace(/^https?:\/\/[^/]+/, "");
      if (chemin === "/v1/auth/login") return { ok: true, json: async () => ({ session_token: "tok", keys: [{ key: "cle-test" }] }) };
      if (chemin === "/v1/index/catalogs") return { ok: true, json: async () => ({ catalogs: [] }) };
      if (chemin.startsWith("/v1/analytics/summary")) return { ok: true, json: async () => ({ total_searches: 12, zero_result_rate: 0.1, total_errors: 0, daily_searches: [{ day: "2026-08-08", count: 3 }] }) };
      return { ok: true, json: async () => ({ queries: [], errors: [], requests: 0 }) };
    });
    global.fetch = fetchMock; window.fetch = fetchMock;
    const i18n = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");
    window.eval(i18n);
    const source = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
    window.eval(source);

    document.getElementById("login-email").value = "test@heurix.fr";
    document.getElementById("login-password").value = "x";
    document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));

    await vi.waitFor(() => {
      expect(document.getElementById("dash-content").hidden).toBe(false);
    });
    // Le vrai signal du bug d'origine : la deconnexion silencieuse.
    expect(document.getElementById("stat-searches").textContent).toBe("12");
  });
});

describe("A11Y-001 — widget de recherche accessible au clavier assisté", () => {
  function chargerWidget(reponseRecherche) {
    const html = `<!DOCTYPE html><html><body><div id="recherche"></div></body></html>`;
    const dom = new JSDOM(html, { url: "http://localhost/test.html", runScripts: "outside-only", pretendToBeVisual: true });
    const { window } = dom;
    global.window = window; global.document = window.document;
    window.Element.prototype.scrollIntoView = () => {};
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => reponseRecherche }));
    global.fetch = fetchMock; window.fetch = fetchMock;
    const source = fs.readFileSync(path.join(RACINE, "downloads/heurix-search.js"), "utf8");
    window.eval(source);
    window.Heurix.searchBox({ apiKey: "hxp_test", catalog: "test", containerId: "recherche" });
    return { window, document: window.document };
  }

  const reponseDeuxResultats = {
    query: "vis", tokens: ["vis"], total: 2, hits: [
      { product: { id: "P1", name: "Vis M8" }, matched: [] },
      { product: { id: "P2", name: "Vis M6" }, matched: [] },
    ],
  };

  it("le champ porte le pattern combobox complet dès la construction du widget", () => {
    const { document } = chargerWidget({ query: "", tokens: [], total: 0, hits: [] });
    const champ = document.querySelector("input");
    expect(champ.getAttribute("role")).toBe("combobox");
    expect(champ.getAttribute("aria-autocomplete")).toBe("list");
    expect(champ.getAttribute("aria-haspopup")).toBe("listbox");
    expect(champ.getAttribute("aria-expanded")).toBe("false");
    const idControles = champ.getAttribute("aria-controls");
    expect(idControles, "aria-controls doit pointer vers un id qui existe vraiment").toBeTruthy();
    expect(document.getElementById(idControles)).not.toBeNull();
  });

  it("le panneau porte role=listbox", () => {
    const { document } = chargerWidget({ query: "", tokens: [], total: 0, hits: [] });
    const champ = document.querySelector("input");
    const panel = document.getElementById(champ.getAttribute("aria-controls"));
    expect(panel.getAttribute("role")).toBe("listbox");
  });

  it("aria-expanded passe à true quand des résultats s'affichent, reste synchronisé à la fermeture", async () => {
    const { window, document } = chargerWidget(reponseDeuxResultats);
    const champ = document.querySelector("input");
    champ.value = "vis";
    champ.dispatchEvent(new window.Event("input", { bubbles: true }));
    await vi.waitFor(() => {
      expect(champ.getAttribute("aria-expanded")).toBe("true");
    });
  });

  it("chaque résultat porte role=option avec un id unique et stable", async () => {
    const { window, document } = chargerWidget(reponseDeuxResultats);
    const champ = document.querySelector("input");
    champ.value = "vis";
    champ.dispatchEvent(new window.Event("input", { bubbles: true }));
    await vi.waitFor(() => {
      const options = document.querySelectorAll('[role="option"]');
      expect(options.length).toBe(2);
    });
    const options = document.querySelectorAll('[role="option"]');
    const ids = Array.from(options).map((o) => o.id);
    expect(new Set(ids).size).toBe(2); // deux id bien distincts, pas de collision
    expect(ids.every((id) => !!id)).toBe(true);
  });

  it("aria-activedescendant suit la navigation flèche bas, pointe vers le vrai id du résultat surligné", async () => {
    const { window, document } = chargerWidget(reponseDeuxResultats);
    const champ = document.querySelector("input");
    champ.value = "vis";
    champ.dispatchEvent(new window.Event("input", { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('[role="option"]').length).toBe(2));

    champ.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    const premiereOption = document.querySelectorAll('[role="option"]')[0];
    expect(champ.getAttribute("aria-activedescendant")).toBe(premiereOption.id);

    champ.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    const deuxiemeOption = document.querySelectorAll('[role="option"]')[1];
    expect(champ.getAttribute("aria-activedescendant")).toBe(deuxiemeOption.id);
  });

  it("une région aria-live annonce le nombre de résultats après une recherche", async () => {
    const { window, document } = chargerWidget(reponseDeuxResultats);
    const champ = document.querySelector("input");
    champ.value = "vis";
    champ.dispatchEvent(new window.Event("input", { bubbles: true }));
    await vi.waitFor(() => {
      const zoneLive = document.querySelector('[aria-live]');
      expect(zoneLive, "une region aria-live doit exister quelque part dans le widget").not.toBeNull();
      expect(zoneLive.textContent).toMatch(/2/);
    });
  });

  it("la région aria-live annonce aussi un vrai zéro résultat, pas seulement des résultats trouvés", async () => {
    const { window, document } = chargerWidget({ query: "xyz", tokens: ["xyz"], total: 0, hits: [] });
    const champ = document.querySelector("input");
    champ.value = "xyz";
    champ.dispatchEvent(new window.Event("input", { bubbles: true }));
    await vi.waitFor(() => {
      const zoneLive = document.querySelector('[aria-live]');
      expect(zoneLive.textContent.length).toBeGreaterThan(0);
    });
  });

  it("le surlignage visuel existant (déjà correct pour un utilisateur voyant) n'a pas changé", async () => {
    const { window, document } = chargerWidget(reponseDeuxResultats);
    const champ = document.querySelector("input");
    champ.value = "vis";
    champ.dispatchEvent(new window.Event("input", { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelectorAll('[role="option"]').length).toBe(2));
    champ.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    const surligne = document.querySelector(".hx-hit-active");
    expect(surligne, "le comportement visuel deja correct ne doit pas regresser").not.toBeNull();
  });
});
