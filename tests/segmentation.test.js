import { describe, it, expect, beforeEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// console.js — "Segmentation" (chantier console, 7 août 2026). Même
// discipline et même harnais que related-products.test.js (login complet
// simulé, console.js est une IIFE qui n'expose rien d'autre que
// window.heurixShowPane) -- voir ce fichier pour le détail des obstacles
// d'environnement déjà résolus (canvas, Chart.js, scrollTo).
// ---------------------------------------------------------------------------

const REPONSE_LOGIN = { session_token: "tok-test", keys: [{ key: "cle-test" }] };
const REPONSE_CATALOGS = { catalogs: [{ catalog: "outillage-demo" }] };
const REPONSE_SEGMENTATION = {
  period_days: 30,
  courant: { total_visiteurs: 42, repartition: { fort: 10, moyen: 20, faible: 12 } },
  precedent: { total_visiteurs: 30, repartition: { fort: 5, moyen: 18, faible: 7 } },
  variations: { total_visiteurs: 40.0, fort: 100.0, moyen: 11.1, faible: 71.4 },
};

function construireFetchMock(reponseSegmentation) {
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
    if (chemin.startsWith("/v1/analytics/segmentation")) return { ok: true, json: async () => reponseSegmentation };
    return { ok: true, json: async () => ({}) };
  });
}

function chargerConsole(reponseSegmentation = REPONSE_SEGMENTATION) {
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

  const fetchMock = construireFetchMock(reponseSegmentation);
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
  await vi.waitFor(() => {
    expect(document.getElementById("dash-content").hidden).toBe(false);
  });
}

describe("console.js — Segmentation", () => {
  it("charge automatiquement au login, sans action de l'utilisateur", async () => {
    const { window, document } = chargerConsole();
    await connecter(window, document);

    await vi.waitFor(() => {
      expect(document.getElementById("seg-stat-total").textContent).not.toBe("–");
    });
    expect(document.getElementById("seg-stat-total").textContent).toBe("42");
    expect(document.getElementById("seg-stat-fort").textContent).toBe("10");
    expect(document.getElementById("seg-stat-moyen").textContent).toBe("20");
    expect(document.getElementById("seg-stat-faible").textContent).toBe("12");
  });

  it("affiche les tendances avec le bon sens (fort en hausse = bonne, faible en hausse = mauvaise)", async () => {
    const { window, document } = chargerConsole();
    await connecter(window, document);
    await vi.waitFor(() => expect(document.getElementById("seg-stat-total").textContent).not.toBe("–"));

    const trendFort = document.getElementById("trend-seg-fort");
    const trendFaible = document.getElementById("trend-seg-faible");
    expect(trendFort.hidden).toBe(false);
    expect(trendFort.className).toContain("kpi-tendance-bonne");
    expect(trendFaible.hidden).toBe(false);
    expect(trendFaible.className).toContain("kpi-tendance-mauvaise");
  });

  it("periode precedente vide : la tendance reste masquee, jamais un pourcentage trompeur", async () => {
    const reponseSansPrecedent = {
      period_days: 30,
      courant: { total_visiteurs: 5, repartition: { fort: 2, moyen: 2, faible: 1 } },
      precedent: { total_visiteurs: 0, repartition: { fort: 0, moyen: 0, faible: 0 } },
      variations: { total_visiteurs: null, fort: null, moyen: null, faible: null },
    };
    const { window, document } = chargerConsole(reponseSansPrecedent);
    await connecter(window, document);
    await vi.waitFor(() => expect(document.getElementById("seg-stat-total").textContent).not.toBe("–"));

    expect(document.getElementById("trend-seg-total").hidden).toBe(true);
    expect(document.getElementById("trend-seg-fort").hidden).toBe(true);
  });

  it("aucun visiteur sur la periode : message d'etat vide affiche", async () => {
    const reponseVide = {
      period_days: 30,
      courant: { total_visiteurs: 0, repartition: { fort: 0, moyen: 0, faible: 0 } },
      precedent: { total_visiteurs: 0, repartition: { fort: 0, moyen: 0, faible: 0 } },
      variations: { total_visiteurs: null, fort: null, moyen: null, faible: null },
    };
    const { window, document } = chargerConsole(reponseVide);
    await connecter(window, document);
    await vi.waitFor(() => expect(document.getElementById("seg-stat-total").textContent).toBe("0"));

    expect(document.getElementById("seg-empty").hidden).toBe(false);
  });

  it("le nouvel item de sidebar existe et ouvre le bon pane", async () => {
    const { window, document } = chargerConsole();
    await connecter(window, document);
    const item = document.querySelector('[data-pane="pane-segmentation"]');
    expect(item).not.toBeNull();
    item.dispatchEvent(new window.Event("click", { bubbles: true }));
    expect(document.getElementById("pane-segmentation").hidden).toBe(false);
  });
});
