import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// UN CLIENT DEJA ABONNE EST ENVOYE A LA CONSOLE (18 septembre 2026).
//
// La page ne sait pas qui est abonne. Un client Growth qui cochait Ranking
// ici payait un second Search ; le moteur le refuse desormais en 409 quand
// le jeton de session identifie le compte, et la console ajoute Ranking a
// l'abonnement existant (« Mon abonnement »). La page le dit en texte
// visible, et le refus 409 dit quoi faire au lieu d'« Une erreur est
// survenue ».
// ---------------------------------------------------------------------------

const PAGES = [
  { fichier: "pricing.html", deja: /Déjà abonné à Growth ou Scale/, confirme: /déjà un abonnement actif.*second.*Mon abonnement/s },
  { fichier: "en/pricing.html", deja: /Already on Growth or Scale\?/, confirme: /already has an active subscription.*second.*My subscription/s },
];

function charger(fichier, reponse) {
  const html = fs.readFileSync(path.join(RACINE, fichier), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" + fichier });
  const w = dom.window;
  const vu = { alertes: [], confirmations: [] };
  w.fetch = (url) => {
    if (String(url).endsWith("/v1/stripe/billing-options")) {
      return Promise.resolve({ json: () => ({ annual_available: true, annual_browse_available: true }) });
    }
    return Promise.resolve(reponse);
  };
  w.alert = (m) => { vu.alertes.push(m); };
  w.confirm = (m) => { vu.confirmations.push(m); return false; };
  w.eval(fs.readFileSync(path.join(RACINE, "billing-toggle.js"), "utf8"));
  const enLigne = [...w.document.querySelectorAll("script:not([src]):not([type])")]
    .map((s) => s.textContent)
    .find((t) => t.includes("create-checkout-session"));
  w.eval(enLigne);
  return { w, vu };
}

const attendre = () => new Promise((r) => setTimeout(r, 0));

describe.each(PAGES)("$fichier — client déjà abonné", ({ fichier, deja, confirme }) => {
  it("la note sous les cartes et la section Ranking seul renvoient à la console", () => {
    const doc = new JSDOM(fs.readFileSync(path.join(RACINE, fichier), "utf8")).window.document;
    const lieux = [
      [...doc.querySelectorAll("p.pricing-note")].find((p) => p.textContent.includes("Ranking")),
      doc.querySelector("#browse-standalone .section-lede"),
    ];
    for (const el of lieux) {
      expect(el.textContent).toMatch(deja);
      expect([...el.querySelectorAll("a")].some((a) => a.getAttribute("href") === "console.html")).toBe(true);
    }
  });

  it("un 409 du moteur propose la console, sans l'alerte générique", async () => {
    const { w, vu } = charger(fichier, { ok: false, status: 409, json: async () => ({}) });
    await attendre();
    const carte = w.document.querySelector('.checkout-btn[data-plan="growth"]').closest(".price-tier-card");
    carte.querySelector(".browse-addon-checkbox").checked = true;
    carte.querySelector(".checkout-btn").click();
    for (let i = 0; i < 5; i++) await attendre();
    expect(vu.confirmations).toHaveLength(1);
    expect(vu.confirmations[0]).toMatch(confirme);
    expect(vu.alertes).toHaveLength(0);
    expect(carte.querySelector(".checkout-btn").disabled).toBe(false);
  });

  it("témoin : une autre erreur garde l'alerte générique", async () => {
    const { w, vu } = charger(fichier, { ok: false, status: 500, json: async () => ({}) });
    await attendre();
    w.document.querySelector('.checkout-btn[data-plan="growth"]').click();
    for (let i = 0; i < 5; i++) await attendre();
    expect(vu.alertes).toHaveLength(1);
    expect(vu.confirmations).toHaveLength(0);
  });
});
