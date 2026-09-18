import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// LE RANKING SEUL SOUSCRIT A LA PERIODE AFFICHEE (18 septembre 2026).
//
// MESURE AVANT D'ECRIRE, dans un navigateur, sur les deux langues : en annuel,
// les cartes « Ranking seul » affichaient 421 / 961 / 2 149 €/an, et leurs
// boutons envoyaient {"browse_plan": "..."} seul. Le moteur prend alors son
// defaut, le mensuel (BrowseCheckoutBody.billing_period = "monthly") : un
// client qui choisissait l'annuel a -10 % payait 39 € par mois sans
// engagement, soit 468 € sur douze mois, contre les CGV 1.4.
//
// Le garde rejoue la page elle-meme -- billing-toggle.js puis le script en
// ligne -- et lit le corps de chaque POST, sans rien envoyer.
// ---------------------------------------------------------------------------

const PAGES = [{ fichier: "pricing.html" }, { fichier: "en/pricing.html" }];

function charger(fichier) {
  const html = fs.readFileSync(path.join(RACINE, fichier), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" + fichier });
  const w = dom.window;
  const envois = [];
  w.fetch = (url, opts) => {
    if (String(url).endsWith("/v1/stripe/billing-options")) {
      return Promise.resolve({ json: () => ({ annual_available: true, annual_browse_available: true }) });
    }
    envois.push({ url: String(url), body: JSON.parse(opts.body) });
    return new Promise(() => {});
  };
  w.alert = () => {};
  w.eval(fs.readFileSync(path.join(RACINE, "billing-toggle.js"), "utf8"));
  const enLigne = [...w.document.querySelectorAll("script:not([src]):not([type])")]
    .map((s) => s.textContent)
    .find((t) => t.includes("checkout-browse-btn"));
  w.eval(enLigne);
  return { w, envois };
}

const attendre = () => new Promise((r) => setTimeout(r, 0));

describe.each(PAGES)("$fichier — boutons Ranking seul", ({ fichier }) => {
  it("en annuel, chaque bouton envoie billing_period: annual", async () => {
    const { w, envois } = charger(fichier);
    await attendre();
    w.document.querySelector('#billing-toggle [data-period="annual"]').click();
    const boutons = [...w.document.querySelectorAll(".checkout-browse-btn")];
    expect(boutons).toHaveLength(3);
    boutons.forEach((b) => { b.disabled = false; b.click(); });
    expect(envois.map((e) => e.body)).toEqual([
      { browse_plan: "starter", billing_period: "annual" },
      { browse_plan: "growth", billing_period: "annual" },
      { browse_plan: "scale", billing_period: "annual" },
    ]);
    expect(envois.every((e) => e.url.endsWith("/v1/stripe/create-browse-checkout-session"))).toBe(true);
  });

  it("en mensuel, le corps reste browse_plan seul", async () => {
    const { w, envois } = charger(fichier);
    await attendre();
    w.document.querySelector(".checkout-browse-btn").click();
    expect(envois.map((e) => e.body)).toEqual([{ browse_plan: "starter" }]);
  });

  // TEMOIN : la carte que le client lit affiche bien l'annuel quand le
  // bouton l'envoie -- sans lui, le premier test passerait sur une page
  // dont la reglette ne toucherait plus les cartes Ranking.
  it("la carte Ranking Starter affiche le prix annuel", async () => {
    const { w } = charger(fichier);
    await attendre();
    w.document.querySelector('#billing-toggle [data-period="annual"]').click();
    await new Promise((r) => setTimeout(r, 150));
    const el = w.document.getElementById("ranking-amount-starter");
    expect(el.textContent).toBe("421");
    expect(el.parentElement.querySelector(".price-tier-period").textContent).toMatch(/\/(an|year)$/);
  });
});
