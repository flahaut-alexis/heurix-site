// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { enLots } from "../csv-import.js";

/* L'IMPORT CSV S'ARRETE AU PREMIER LOT REFUSE (9 octobre 2026).
 *
 * CE QUI SE PASSAIT. Fichier de 6 160 lignes, cle d'essai plafonnee a 2 000
 * produits (refus a 2 201), lots de 5 000 :
 *
 *     lot 1 = 5 000  -> 429, rien ecrit
 *     lot 2 = 1 160  -> 200, accepte : il tient sous le plafond
 *
 * Le marchand obtenait un catalogue fait des 1 160 DERNIERES lignes de son
 * fichier, annonce « 1 000 produits indexes » en vert avec un bouton « Voir
 * le catalogue », au-dessus d'une ligne rouge qui conseillait de relancer --
 * ce qui rendait exactement le meme refus. Mesure du 9 octobre, console
 * reelle pilotee dans un navigateur contre un moteur local : 1 000 produits,
 * ids wc_5001 a wc_6000, `rulepack: null`, `annotations: 0`.
 *
 * LE PACK PERDU N'EST PAS UN SECOND DEFAUT, c'est le meme : `enLots` ne
 * declare le pack que sur le lot 0 (ci-dessous), pour ne pas declencher une
 * reindexation complete a chaque envoi. Quand le lot 0 est refuse, la
 * declaration meurt avec lui, et c'est un lot SUIVANT qui cree le catalogue.
 * S'arreter au premier refus referme les deux.
 *
 * LA PHRASE CI-DESSOUS EST UNE COPIE : l'original vit dans heurix-engine
 * (heurix/usage.py, message_plafond_produits). Releve du 9 octobre 2026 :
 * 279 caracteres, identiques au caractere pres. Pour rejouer la comparaison,
 * voir l'en-tete de tests/test-arret-au-plafond.php du depot WooCommerce.
 */

const RACINE = path.resolve(__dirname, "..");

/* `csv-console.js` formate les nombres par toLocaleString("fr-FR") : le
 * separateur de milliers y est une ESPACE FINE INSECABLE (U+202F), pas une
 * espace simple. Un test qui ecrit « 6 160 » a la main passe a cote. */
const n = (x) => x.toLocaleString("fr-FR");

/* `T` est posee sur window par console-i18n.js, charge en script classique
 * AVANT le module dans console.html. On le charge ici de la meme facon --
 * le vrai fichier, pas une doublure : les phrases de ce lot ont des
 * traductions anglaises, et un test qui doublerait T ne verrait jamais une
 * entree manquante. */
const I18N = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");

const SQUELETTE = `
  <div id="csv-depot"></div><input type="file" id="csv-fichier">
  <button id="csv-choisir"></button><button id="csv-envoyer"></button>
  <button id="csv-annuler"></button>
  <div id="csv-analyse" hidden></div><div id="csv-tuto"></div>
  <div id="csv-correspondance"></div><div id="csv-resume"></div>
  <div id="csv-verdict"></div><div id="csv-reco"></div>
  <input id="csv-catalogue"><select id="csv-rulepack"><option value="outillage">outillage</option></select>
  <div id="csv-progression" hidden><div id="csv-barre-remplie"></div><div id="csv-etat"></div></div>
  <div id="csv-rapport" hidden></div>`;

const DETAIL_429 =
  "Plafond de l'essai gratuit : 2 000 produits, refus au-delà de 2 200. " +
  "C'est la limite de l'essai, pas celle du produit : la recherche n'est pas bridée. " +
  "Pour évaluer, n'exportez qu'une famille — la visserie — plutôt que tout. " +
  "Formules : Starter 8 000, Growth 25 000, Scale 100 000.";

function fichierCsv(n) {
  const l = ["id,name,ref,price"];
  for (let i = 1; i <= n; i++) l.push(`wc_${i},Vis a bois ${i},VIS-${i},1.50`);
  return l.join("\n");
}

/** Rejoue l'envoi : lots de 5 000, le moteur refuse ceux qui depassent. */
async function importer(nbLignes, reponses) {
  document.body.innerHTML = SQUELETTE;
  document.documentElement.lang = "fr";
  const appels = [];
  global.fetch = vi.fn(async (url, opts) => {
    // L'ECRAN D'ANALYSE APPELLE AUSSI /v1/rulepacks/suggest, avec 300 items
    // au plus : on ne compte que les lots d'indexation, sinon le premier
    // appel compte serait celui de la suggestion de pack.
    if (!String(url).includes("/items")) {
      return { ok: true, status: 200, json: async () => ({ rulepacks: [], suggestion: null }) };
    }
    appels.push(JSON.parse(opts.body).items.length);
    const r = reponses[appels.length - 1] || reponses[reponses.length - 1];
    return {
      ok: r.code === 200,
      status: r.code,
      json: async () => r.corps,
    };
  });
  window.HEURIX_CLE_API = "hx_test";
  const alertes = [];
  window.alert = (m) => alertes.push(m);
  // eslint-disable-next-line no-eval
  (0, eval)(I18N);
  vi.resetModules();
  const mod = await import("../csv-console.js?t=" + Math.random());

  // DOUBLURE DE `File`, ET ELLE EST MINCE EXPRES. jsdom 26 n'implemente pas
  // `File.arrayBuffer()`, que `lireFichierCsv` appelle ; et il ne laisse pas
  // poser `input.files`. On fournit donc les trois methodes que le module
  // utilise -- arrayBuffer, slice().text() -- et rien d'autre : tout le reste
  // du chemin est le vrai code.
  const texte = fichierCsv(nbLignes);
  const octets = new TextEncoder().encode(texte);
  const f = {
    name: "catalogue.csv", type: "text/csv", size: octets.length,
    arrayBuffer: async () => octets.buffer,
    text: async () => texte,
    slice: (a, b) => ({ text: async () => texte.slice(a, b) }),
  };
  Object.defineProperty(document.getElementById("csv-fichier"), "files", { value: [f], configurable: true });
  document.getElementById("csv-fichier").dispatchEvent(new window.Event("change"));
  await new Promise((r) => setTimeout(r, 400));
  document.getElementById("csv-catalogue").value = "boutique";
  document.getElementById("csv-envoyer").click();
  await new Promise((r) => setTimeout(r, 1400));
  if (alertes.length) throw new Error("alerte inattendue : " + alertes.join(" | "));
  return { appels, rapport: document.getElementById("csv-rapport").textContent,
           etat: document.getElementById("csv-etat").textContent,
           html: document.getElementById("csv-rapport").innerHTML };
}

const REFUS_PLAFOND = { code: 429, corps: { code: "plafond_produits", detail: DETAIL_429,
  plan: "trial", limit_type: "products", upgrade_url: "https://heurix.fr/pricing.html" } };
const ACCEPTE = { code: 200, corps: { indexed: 5000 } };

describe("le pack de regles ne voyage que sur le lot 0", () => {
  it("un catalogue cree par un lot qui n'est pas le premier n'a aucun pack", () => {
    const produits = Array.from({ length: 6160 }, (_, i) => ({ id: "wc_" + i }));
    const lots = enLots(produits, 5000, "outillage");
    expect(lots).toHaveLength(2);
    expect(lots[0].rulepack).toBe("outillage");
    // LE LOT QUI CREE LE CATALOGUE QUAND LE PREMIER EST REFUSE.
    expect(lots[1].rulepack).toBeUndefined();
    expect(lots[1].items).toHaveLength(1160);
    // Et ce sont bien les DERNIERES lignes du fichier.
    expect(lots[1].items[0].id).toBe("wc_5000");
  });
});

describe("import refuse au plafond", () => {
  it("s'arrete au premier lot refuse", async () => {
    const r = await importer(6160, [REFUS_PLAFOND]);
    // Avant ce lot : deux appels, le second cree le catalogue-queue.
    expect(r.appels).toEqual([5000]);
  });

  it("n'annonce aucun produit indexe, et pas de vert", async () => {
    const r = await importer(6160, [REFUS_PLAFOND]);
    expect(r.rapport).toContain(`Import arrêté : aucun de vos ${n(6160)} produits n'a été indexé.`);
    expect(r.html).not.toContain("csv-succes");
  });

  it("compte en produits et en fichier, jamais en lots", async () => {
    const r = await importer(6160, [REFUS_PLAFOND]);
    expect(r.rapport).toContain(`Import arrêté : aucun de vos ${n(6160)} produits n'a été indexé.`);
    // Le mot « lot » ne doit plus paraitre dans ce que le marchand lit
    // d'abord : ni dans le titre, ni dans la barre.
    expect(r.etat).not.toMatch(/lot/i);
    expect(r.rapport).not.toContain("lot(s) en échec");
  });

  it("ne conseille plus de relancer : le refus se rejouerait a l'identique", async () => {
    const r = await importer(6160, [REFUS_PLAFOND]);
    expect(r.rapport).toContain("Relancer renverra le même refus.");
    expect(r.rapport).not.toContain("Relancez l'import :");
  });

  it("porte la phrase du moteur entiere", async () => {
    const r = await importer(6160, [REFUS_PLAFOND]);
    expect(r.rapport).toContain(DETAIL_429);
    // Le decoupage reste dans la ligne de detail, celle qui sert au support.
    expect(r.rapport).toContain("Lot 1 sur 2 :");
  });

  it("n'offre pas d'aller voir un catalogue partiel", async () => {
    const r = await importer(11000, [ACCEPTE, REFUS_PLAFOND]);
    expect(r.appels).toEqual([5000, 5000]);
    expect(r.rapport).toContain(`Import arrêté : ${n(5000)} de vos ${n(11000)} produits ont été indexés.`);
    expect(r.html).not.toContain("csv-voir-catalogue");
  });

  it("la barre ne dit pas « Terminé » d'un import arrete", async () => {
    const r = await importer(6160, [REFUS_PLAFOND]);
    expect(r.etat).toContain(`Arrêté — ${n(0)} produits indexés`);
    expect(r.etat).not.toContain("Terminé");
  });
});

describe("une panne passagere n'est pas un refus", () => {
  it("un 503 garde le conseil de relancer", async () => {
    const r = await importer(6160, [{ code: 503, corps: { detail: "Erreur interne." } }]);
    expect(r.rapport).toContain("Relancez l'import :");
  });
});

describe("un import complet n'a pas change", () => {
  it("annonce le succes en vert et offre le catalogue", async () => {
    const r = await importer(3000, [{ code: 200, corps: { indexed: 3000 } }]);
    expect(r.appels).toEqual([3000]);
    expect(r.html).toContain("csv-succes");
    expect(r.html).toContain("csv-voir-catalogue");
    expect(r.etat).toContain("Terminé");
  });
});
