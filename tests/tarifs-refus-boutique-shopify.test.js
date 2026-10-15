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

/* CE QUE LE 15 OCTOBRE A AJOUTE, ET POURQUOI LA PREMIERE VERSION DE CE
 * FICHIER LAISSAIT PASSER LE DEFAUT.
 *
 * `rattache` valait, pour la page anglaise,
 * `/linked to a Shopify store|rattaché à une boutique Shopify/`. L'alternative
 * francaise rendait l'assertion vraie quoi qu'il arrive : le test disait « il
 * y a du texte », pas « il y a le BON texte ». Mesure a l'ecran le meme jour,
 * sur la page servie : la boite d'alerte de `en/pricing.html` portait la
 * phrase FRANCAISE du moteur, et le repli anglais ecrit juste a cote n'etait
 * jamais atteint parce que `detail` est toujours present. La suite etait
 * verte.
 *
 * `rattache` est donc desormais la phrase de LA PAGE, dans SA langue, et
 * `etranger` porte les marqueurs de l'autre langue, dont l'absence est
 * exigee. Le temoin de mutation : retirer `compte_rattache_a_une_boutique`
 * de `REFUS_409` fait retomber la page sur `detail`, donc sur le francais,
 * et les deux assertions tombent ensemble.
 */

// LA PHRASE DU MOTEUR, RECOPIEE DU DEPLOIEMENT. Elle n'est PAS attendue a
// l'ecran : elle est ce que le serveur envoie, et ce que la page anglaise ne
// doit plus montrer. La recopier ici n'est pas doubler le moteur -- c'est
// fournir au test l'entree exacte qui a produit le defaut.
const DETAIL_MOTEUR = "Ce compte Heurix est rattaché à une boutique Shopify : "
  + "l'abonnement de cette boutique est géré par Shopify, et il se choisit depuis "
  + "l'application Heurix dans l'administration de votre boutique. Un paiement "
  + "lancé ici ne changerait pas son palier.";

const PAGES = [
  {
    fichier: "pricing.html",
    rattache: [/rattaché à une boutique Shopify/, /dans l'administration de votre boutique/,
               /ne changerait pas son palier/],
    etranger: [/linked to a Shopify store/, /managed by Shopify/, /store admin/],
    deja: /déjà un abonnement actif.*Mon abonnement/s,
    phrase: [/Vous avez une boutique Shopify/, /géré par Shopify/,
             /Ne souscrivez pas ici pour cette boutique/,
             /ne change rien au palier de votre boutique/],
    generique: /Une erreur est survenue/,
  },
  {
    fichier: "en/pricing.html",
    rattache: [/linked to a Shopify store/, /managed by Shopify/,
               /from the Heurix app in your store admin/,
               /would not change its tier/],
    // LES MARQUEURS FRANCAIS, ET ILS SONT PRIS DANS `DETAIL_MOTEUR`. Aucun ne
    // peut apparaitre dans une phrase anglaise : l'absence est donc une
    // mesure, pas une precaution.
    etranger: [/rattaché à une boutique Shopify/, /l'abonnement de cette boutique/,
               /ne changerait pas son palier/],
    deja: /already has an active subscription.*My subscription/s,
    phrase: [/Do you run a Shopify store/, /managed by Shopify/,
             /Don’t subscribe here for that store/,
             /does not change your store’s tier/],
    generique: /Something went wrong/,
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

describe.each(PAGES)("$fichier — deux 409 sous un seul statut", ({ fichier, rattache, etranger, deja, generique }) => {
  it("le refus du compte rattaché affiche SA phrase, dans SA langue, et ne propose pas la console", async () => {
    // L'ENTREE EST LA PHRASE DU MOTEUR, EN FRANCAIS, POUR LES DEUX PAGES.
    // C'est ce que le serveur deploye envoie, et c'est exactement ce qui
    // s'affichait a l'ecran avant ce lot.
    const { w, vu } = charger(fichier, refus("compte_rattache_a_une_boutique", DETAIL_MOTEUR));
    await attendre();
    await souscrire(w);
    expect(vu.alertes).toHaveLength(1);
    for (const motif of rattache) expect(vu.alertes[0]).toMatch(motif);
    // ET L'AUTRE LANGUE N'APPARAIT NULLE PART. Sans cette moitie, la page
    // anglaise passerait en affichant `detail` -- le defaut du 15 octobre.
    for (const motif of etranger) expect(vu.alertes[0]).not.toMatch(motif);
    // LE POINT DU LOT PRECEDENT : pas de proposition de console. C'est la
    // surface d'où vient ce marchand, et l'y renvoyer serait boucler.
    expect(vu.confirmations).toHaveLength(0);
  });

  it("TÉMOIN DE NON-RÉGRESSION : un code INCONNU affiche encore `detail`", async () => {
    // Si `detail` disparaissait en réparant le cas connu, un refus que cette
    // page n'a pas appris deviendrait « une erreur est survenue » — une perte
    // nette. `detail` reste le repli, et ce test est ce qui l'empêche de
    // partir avec le reste.
    const { w, vu } = charger(fichier, refus(
      "un_code_que_cette_page_ne_connait_pas",
      "La phrase que le moteur a écrite pour ce refus-là."));
    await attendre();
    await souscrire(w);
    expect(vu.alertes).toHaveLength(1);
    expect(vu.alertes[0]).toBe("La phrase que le moteur a écrite pour ce refus-là.");
    expect(vu.confirmations).toHaveLength(0);
  });

  it("TÉMOIN : un code inconnu SANS `detail` lisible retombe sur le générique", async () => {
    // Un 422 rend une LISTE. Concaténée, elle s'affiche « [object Object] » —
    // le défaut mesuré le même jour dans le gabarit de l'app Shopify. Ces
    // pages ne reçoivent que des 409, mais le typage est vérifié pour que le
    // même défaut ne puisse pas naître ici.
    const { w, vu } = charger(fichier, refus(
      "un_code_que_cette_page_ne_connait_pas",
      [{ type: "string_too_short", loc: ["body", "code"], msg: "String should have at least 1 character" }]));
    await attendre();
    await souscrire(w);
    expect(vu.alertes).toHaveLength(1);
    expect(vu.alertes[0]).not.toMatch(/\[object Object\]/);
    expect(vu.alertes[0]).toMatch(generique);
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
    for (const motif of rattache) expect(vu.alertes[0]).not.toMatch(motif);
    expect(vu.alertes[0]).toMatch(generique);
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
