import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// console.js — puce d'onboarding "Générez une clé publique" (8 août 2026).
// Bug signalé par Alexis : la clé se génère bien (visible dans le tableau),
// mais la puce reste "en attente" -- wirePublicKeys() rafraîchit le tableau
// des clés (refreshPublicKeys) mais jamais la carte d'activation
// (majCarteActivation), qui seule décide si la puce se coche.
// Même harnais que related-products.test.js / segmentation.test.js.
// ---------------------------------------------------------------------------

const REPONSE_LOGIN = { session_token: "tok-test", keys: [{ key: "cle-test" }] };
const REPONSE_CATALOGS = { catalogs: [{ catalog: "outillage-demo" }] };

function construireFetchMock(cleGenereeAvecSucces = { ok: true }, catalogues = REPONSE_CATALOGS) {
  let clePubliqueExiste = false;
  return vi.fn(async (url, options) => {
    const chemin = String(url).replace(/^https?:\/\/[^/]+/, "");
    if (chemin === "/v1/auth/login") return { ok: true, json: async () => REPONSE_LOGIN };
    if (chemin === "/v1/index/catalogs") return { ok: true, json: async () => catalogues };
    if (chemin.startsWith("/v1/rulepacks")) return { ok: true, json: async () => ({ rulepacks: ["outillage"] }) };
    if (chemin.startsWith("/v1/analytics/summary")) {
      return { ok: true, json: async () => ({ total_searches: 0, zero_result_rate: 0, total_errors: 0, daily_searches: [] }) };
    }
    if (chemin.startsWith("/v1/usage")) {
      // catalogs_used > 0 et first_search_at/first_browse_at fournis :
      // seule la clé publique manque, pour isoler CETTE puce précise.
      return { ok: true, json: async () => ({
        requests: 3, account_email: "test@heurix.fr", catalogs_used: 1,
        first_search_at: "2026-08-08T09:00:00", first_browse_at: "2026-08-08T09:00:00",
      }) };
    }
    if (chemin.startsWith("/v1/analytics/top-queries")) return { ok: true, json: async () => ({ queries: [] }) };
    if (chemin.startsWith("/v1/analytics/zero-results")) return { ok: true, json: async () => ({ queries: [] }) };
    if (chemin.startsWith("/v1/analytics/errors")) return { ok: true, json: async () => ({ errors: [] }) };
    if (chemin === "/v1/keys/public" && (!options || options.method !== "POST")) {
      // GET : reflete l'etat REEL, cree ou non, pour que majCarteActivation
      // (une fois vraiment appelee) lise la bonne valeur.
      return { ok: true, json: async () => ({ public_keys: clePubliqueExiste ? [{ key: "hxp_test123" }] : [] }) };
    }
    if (chemin === "/v1/keys/public" && options && options.method === "POST") {
      clePubliqueExiste = true;
      return cleGenereeAvecSucces.ok
        ? { ok: true, json: async () => ({ key: "hxp_test123" }) }
        : { ok: false, json: async () => ({ detail: "erreur" }) };
    }
    return { ok: true, json: async () => ({}) };
  });
}

function chargerConsole(cleGenereeAvecSucces, catalogues) {
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

  const fetchMock = construireFetchMock(cleGenereeAvecSucces, catalogues);
  global.fetch = fetchMock;
  window.fetch = fetchMock;

  const i18n = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");
  window.eval(i18n);
  const source = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
  window.eval(source);

  return { window, document: window.document };
}

async function connecter(window, document) {
  document.getElementById("login-email").value = "test@heurix.fr";
  document.getElementById("login-password").value = "peu-importe";
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await vi.waitFor(() => {
    expect(document.getElementById("dash-content").hidden).toBe(false);
  });
}

describe("console.js — puce d'onboarding clé publique", () => {
  it("se coche immédiatement après une génération réussie, sans recharger la page", async () => {
    const { window, document } = chargerConsole();
    await connecter(window, document);

    const puce = document.getElementById("activation-item-pubkey");
    expect(puce.classList.contains("fait")).toBe(false); // état de départ : rien généré encore

    document.querySelector('[data-goto-pane="pane-key"]').dispatchEvent(new window.Event("click", { bubbles: true }));
    document.getElementById("public-key-form").dispatchEvent(new window.Event("submit", { cancelable: true }));

    await vi.waitFor(() => {
      expect(puce.classList.contains("fait")).toBe(true);
    });
    expect(puce.querySelector(".console-activation-statut").textContent).toBe("fait");
  });
});

describe("console.js — sous-label dynamique Catalogues (8 août 2026)", () => {
  it("apparaît quand des catalogues existent, pour séparer visuellement l'action 'Importer' de la liste à naviguer", async () => {
    const { window, document } = chargerConsole(undefined, { catalogs: [{ catalog: "outillage-demo" }] });
    await connecter(window, document);

    await vi.waitFor(() => {
      expect(document.getElementById("sidebar-catalog-sublabel").hidden).toBe(false);
    });
  });

  it("reste caché quand la liste de catalogues est vide -- jamais un titre de section sans rien dessous", async () => {
    const { window, document } = chargerConsole(undefined, { catalogs: [] });
    await connecter(window, document);

    // Laisse le temps a la promesse /v1/index/catalogs de se resoudre,
    // meme dans le cas vide -- sans quoi le test pourrait passer par
    // coincidence (etat initial deja hidden, jamais vraiment verifie
    // apres coup).
    await vi.waitFor(() => {
      expect(document.getElementById("catalogs-empty").hidden).toBe(false);
    });
    expect(document.getElementById("sidebar-catalog-sublabel").hidden).toBe(true);
  });
});

describe("console.html — navigation en trois piliers (8 août 2026)", () => {
  it("Configurer ne contient plus que Catalogues -- Règles a déménagé sous Optimiser", () => {
    const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
    const dom = new JSDOM(html, { url: "http://localhost/console.html" });
    const doc = dom.window.document;

    const groupe = doc.querySelector('[data-section-items="configurer"]');
    expect(groupe).not.toBeNull();
    expect(groupe.querySelector('[data-pane="pane-import-csv"]')).not.toBeNull();
    expect(groupe.querySelector('[data-pane="pane-search-overrides"]'), "Règles ne doit plus être sous Configurer").toBeNull();
  });

  it("Observer regroupe Search, Ranking et Audience -- mêmes data-pane qu'avant, juste réorganisés", () => {
    const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
    const dom = new JSDOM(html, { url: "http://localhost/console.html" });
    const doc = dom.window.document;

    const groupe = doc.querySelector('[data-section-items="observer"]');
    expect(groupe).not.toBeNull();
    for (const pane of ["pane-top-queries", "pane-zero-results", "pane-errors", "pane-category-views", "pane-related-products", "pane-segmentation"]) {
      expect(groupe.querySelector(`[data-pane="${pane}"]`), `${pane} doit rester sous Observer`).not.toBeNull();
    }
  });

  it("Optimiser regroupe Search (Règles) et Ranking (Merchandising), Règles au-dessus", () => {
    const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
    const dom = new JSDOM(html, { url: "http://localhost/console.html" });
    const doc = dom.window.document;

    const groupe = doc.querySelector('[data-section-items="optimiser"]');
    expect(groupe).not.toBeNull();
    const regles = groupe.querySelector('[data-pane="pane-search-overrides"]');
    const merchandising = groupe.querySelector('[data-pane="pane-browse"]');
    expect(regles, "Règles doit être sous Optimiser maintenant").not.toBeNull();
    expect(merchandising).not.toBeNull();

    // Ordre reel dans le document : Regles avant Merchandising, pas juste
    // les deux presents quelque part dans le groupe.
    const position = regles.compareDocumentPosition(merchandising);
    expect(position & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, "Règles doit précéder Merchandising dans le document").toBeTruthy();
  });

  it("Dashboard reste hors pilier, en tête de menu", () => {
    const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
    const dom = new JSDOM(html, { url: "http://localhost/console.html" });
    const doc = dom.window.document;
    const dashboard = doc.querySelector('[data-pane="pane-overview"]');
    expect(dashboard.closest('[data-section-items]')).toBeNull();
  });

  it("Comment ça marche n'est plus un bouton de sidebar, mais reste une pane valide et accessible", () => {
    const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
    const dom = new JSDOM(html, { url: "http://localhost/console.html" });
    const doc = dom.window.document;

    const boutonSidebar = doc.querySelector('.console-sidebar-items [data-pane="pane-catalog-help"]');
    expect(boutonSidebar, "ne doit plus apparaitre comme bouton de sidebar direct").toBeNull();

    // Doit rester atteignable ailleurs (aide contextuelle), sinon un
    // vrai contenu deviendrait injoignable.
    const lienContextuel = doc.querySelector('[data-goto-pane="pane-catalog-help"]');
    expect(lienContextuel, "doit rester accessible via un lien contextuel").not.toBeNull();

    // La pane elle-meme doit toujours exister -- rien ne doit etre supprime.
    expect(doc.getElementById("pane-catalog-help")).not.toBeNull();
  });

  it("les tranches de segmentation portent les nouveaux libellés, mêmes IDs qu'avant", () => {
    const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
    const dom = new JSDOM(html, { url: "http://localhost/console.html" });
    const doc = dom.window.document;

    expect(doc.getElementById("seg-stat-fort")).not.toBeNull();
    expect(doc.getElementById("seg-stat-moyen")).not.toBeNull();
    expect(doc.getElementById("seg-stat-faible")).not.toBeNull();

    const labels = [...doc.querySelectorAll(".console-stat-label")].map((el) => el.textContent);
    expect(labels).toContain("Intention");
    expect(labels).toContain("Considération");
    expect(labels).toContain("Découverte");
    // Les anciens libellés ne doivent plus exister du tout, pas coexister.
    expect(labels).not.toContain("Intention forte");
    expect(labels).not.toContain("Intention moyenne");
    expect(labels).not.toContain("Intention faible");
  });

  it("chacun des trois piliers porte une icône distincte", () => {
    const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
    const dom = new JSDOM(html, { url: "http://localhost/console.html" });
    const doc = dom.window.document;

    for (const section of ["configurer", "observer", "optimiser"]) {
      const bouton = doc.querySelector(`[data-section="${section}"]`);
      expect(bouton, `section ${section} doit exister`).not.toBeNull();
      expect(bouton.querySelectorAll("svg").length, `${section} doit porter une icône`).toBeGreaterThanOrEqual(1);
    }
  });
});
