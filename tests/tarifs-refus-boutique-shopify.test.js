import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const RACINE = path.resolve(__dirname, "..");

/* UN MARCHAND RATTACHE A UNE BOUTIQUE SHOPIFY NE S'ABONNE PAS ICI
 * (15 octobre 2026, exigence 1.2.1, soumission 135169).
 *
 * TROIS PIECES, ET C'EST UN SEUL MECANISME. Chacune seule ne ferme rien :
 *
 *   1. la page envoie le jeton de session, sinon le moteur n'a aucun compte a
 *      regarder et le refus ne peut pas se declencher. `en/pricing.html` ne
 *      l'envoyait PAS -- mesure du 15 octobre : 1 occurrence de
 *      `payload.session_token` dans `pricing.html`, 0 dans la page anglaise ;
 *   2. la page branche sur le CODE du refus, sinon le marchand rattache lit la
 *      phrase de l'autre 409 et se fait renvoyer vers la console -- la surface
 *      d'ou il vient ;
 *   3. la page PORTE la phrase, pour le marchand Shopify qui n'a rattache
 *      aucune boutique : celui-la n'envoie aucun compte, et aucun code ne peut
 *      le refuser.
 *
 * LE TEMOIN DE LA DEGRADATION EST LA CONDITION DU DEPLOIEMENT. Cette page peut
 * partir avant le moteur qui rend le code : un 409 sans `code` doit continuer
 * d'afficher le texte du 18 septembre, mot pour mot.
 */

const PAGES = [
  {
    fichier: "pricing.html",
    rattache: /rattaché à une boutique Shopify/,
    deja: /déjà un abonnement actif.*Mon abonnement/s,
    phrase: [/Vous avez une boutique Shopify/, /géré par Shopify/,
             /Ne souscrivez pas ici pour cette boutique/,
             /ne change rien au palier de votre boutique/],
  },
  {
    fichier: "en/pricing.html",
    rattache: /linked to a Shopify store|rattaché à une boutique Shopify/,
    deja: /already has an active subscription.*My subscription/s,
    phrase: [/Do you run a Shopify store/, /managed by Shopify/,
             /Don’t subscribe here for that store/,
             /does not change your store’s tier/],
  },
];

function charger(fichier, reponse, { jeton = null } = {}) {
  const html = fs.readFileSync(path.join(RACINE, fichier), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" + fichier });
  const w = dom.window;
  const vu = { alertes: [], confirmations: [], corps: [] };
  if (jeton) w.localStorage.setItem("heurix_console_session", jeton);
  w.fetch = (url, init) => {
    if (String(url).endsWith("/v1/stripe/billing-options")) {
      return Promise.resolve({ json: () => ({ annual_available: true, annual_browse_available: true }) });
    }
    vu.corps.push(JSON.parse(init.body));
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

async function souscrire(w) {
  w.document.querySelector('.checkout-btn[data-plan="growth"]').click();
  for (let i = 0; i < 6; i++) await attendre();
}

const refus = (code, detail) => ({
  ok: false, status: 409, json: async () => (code ? { code, detail } : { detail }),
});

describe.each(PAGES)("$fichier — deux 409 sous un seul statut", ({ fichier, rattache, deja }) => {
  it("le refus du compte rattaché affiche SA phrase, et ne propose pas la console", async () => {
    const { w, vu } = charger(fichier, refus(
      "compte_rattache_a_une_boutique",
      "Ce compte Heurix est rattaché à une boutique Shopify : l'abonnement de cette boutique est géré par Shopify."));
    await attendre();
    await souscrire(w);
    expect(vu.alertes).toHaveLength(1);
    expect(vu.alertes[0]).toMatch(rattache);
    // LE POINT DU LOT : pas de proposition de console. C'est la surface d'où
    // vient ce marchand, et l'y renvoyer serait boucler.
    expect(vu.confirmations).toHaveLength(0);
  });

  it("le refus « déjà abonné » garde SA phrase et sa proposition de console", async () => {
    const { w, vu } = charger(fichier, refus("abonnement_deja_actif", "ignoré ici"));
    await attendre();
    await souscrire(w);
    expect(vu.confirmations).toHaveLength(1);
    expect(vu.confirmations[0]).toMatch(deja);
    expect(vu.alertes).toHaveLength(0);
  });

  it("TÉMOIN DE DÉGRADATION : un 409 sans code garde le texte du 18 septembre", async () => {
    // Le moteur déployé peut ne pas encore rendre de code. Sans cette branche,
    // le lot casserait un refus qui fonctionne, pour en ajouter un.
    const { w, vu } = charger(fichier, refus(null, undefined));
    await attendre();
    await souscrire(w);
    expect(vu.confirmations).toHaveLength(1);
    expect(vu.confirmations[0]).toMatch(deja);
    expect(vu.alertes).toHaveLength(0);
  });

  it("TÉMOIN : une autre erreur garde l'alerte générique", async () => {
    const { w, vu } = charger(fichier, { ok: false, status: 500, json: async () => ({}) });
    await attendre();
    await souscrire(w);
    expect(vu.alertes).toHaveLength(1);
    expect(vu.alertes[0]).not.toMatch(rattache);
  });
});

describe.each(PAGES)("$fichier — le jeton de session part, sinon rien ne peut refuser", ({ fichier }) => {
  it("le jeton de la console est posté quand il est là", async () => {
    const { w, vu } = charger(fichier, refus(null, undefined), { jeton: "sess_de_test" });
    await attendre();
    await souscrire(w);
    expect(vu.corps).toHaveLength(1);
    expect(vu.corps[0].session_token).toBe("sess_de_test");
  });

  it("TÉMOIN : sans jeton en mémoire, aucun champ n'est inventé", async () => {
    const { w, vu } = charger(fichier, refus(null, undefined));
    await attendre();
    await souscrire(w);
    expect(vu.corps[0]).not.toHaveProperty("session_token");
    expect(vu.corps[0].plan).toBe("growth");
  });
});

describe.each(PAGES)("$fichier — la phrase, et elle se distingue du texte légal", ({ fichier, phrase }) => {
  const doc = () => new JSDOM(fs.readFileSync(path.join(RACINE, fichier), "utf8")).window.document;

  it("elle dit les trois choses", () => {
    const el = doc().getElementById("note-boutique-shopify");
    expect(el).not.toBeNull();
    // ESPACES NORMALISES, PARCE QUE C'EST CE QUE LE NAVIGATEUR REND. Le
    // source replie les phrases sur plusieurs lignes ; un motif qui cherche
    // « Don’t subscribe here for that store » dans le texte brut echoue sur
    // le retour a la ligne, et il echouerait sur une phrase parfaitement
    // lisible a l'ecran.
    const lu = el.textContent.replace(/\s+/g, " ").trim();
    for (const motif of phrase) expect(lu).toMatch(motif);
  });

  it("elle n'est PAS rendue dans la classe du texte légal", () => {
    // Un avertissement en petits caractères gris est un avertissement que
    // personne ne lit, et c'est le relecteur de Shopify qui le lira en premier.
    const el = doc().getElementById("note-boutique-shopify");
    expect(el.classList.contains("pricing-note")).toBe(false);
    expect(el.classList.contains("callout")).toBe(true);
    expect(el.getAttribute("role")).toBe("note");
  });

  it("elle reste SOUS les cartes de prix", () => {
    const d = doc();
    const positions = [...d.querySelectorAll("*")];
    const derniereCarte = [...d.querySelectorAll(".checkout-btn")].pop();
    const note = d.getElementById("note-boutique-shopify");
    expect(positions.indexOf(note)).toBeGreaterThan(positions.indexOf(derniereCarte));
  });
});
