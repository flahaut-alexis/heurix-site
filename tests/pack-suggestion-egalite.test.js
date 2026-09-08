import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const CONSOLE = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
const CSV = fs.readFileSync(path.join(RACINE, "csv-console.js"), "utf8");
const I18N = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");
const CONTRAT = JSON.parse(
  fs.readFileSync(path.join(RACINE, "tests/fixtures/engine-contract.json"), "utf8"));

/* EGALITE STRICTE : LE MOTEUR SE TAIT, LA CONSOLE SE TAISAIT AVEC LUI
 * (9 septembre 2026).
 *
 * CE QUI A CHANGE COTE MOTEUR. `comparer_packs` rendait l'argmax brut. Quand
 * deux packs annotent les MEMES produits avec le MEME nombre d'etiquettes,
 * le tri `(-produits_annotes, -annotations_distinctes)` ne departage rien et
 * le gagnant est celui dont le nom vient en premier dans l'alphabet. Le
 * moteur refuse desormais de recommander la, pose `recommande` a null et le
 * dit dans `marge.critere` (heurix-engine, fusionne dans `main` a d78f5bb).
 *
 * CE QUE CA A OUVERT COTE SITE. `chargerSuggestionPack` traitait `recommande`
 * vide en deux cas : zero produit annote -> une alerte, tout le reste -> la
 * zone se masque. Ce « tout le reste » etait inatteignable sur un catalogue
 * qui s'annote bien ; le refus sur egalite le rend atteignable. MESURE AVANT
 * CORRECTION, sur le corpus de la fixture, en faisant tourner la fonction
 * reellement expediee :
 *
 *   moteur avant le lot   zone.hidden=false   « Le pack industrie semble
 *                                              mieux adapte » -- une
 *                                              recommandation decidee par
 *                                              l'ordre alphabetique
 *   moteur avec le lot    zone.hidden=true    zero caractere
 *
 * Le marchand ne voyait donc ni suggestion, ni raison de son absence.
 *
 * ON EXTRAIT LE CODE EXPEDIE ET ON LE FAIT TOURNER, comme
 * console-rayon.test.js : une assertion sur le TEXTE de console.js prouverait
 * qu'une chaine est presente, pas qu'une branche est prise.
 *
 * LA REPONSE VIENT DU VRAI MOTEUR, pas d'un objet ecrit ici
 * (tests/fixtures/generate.py, cle `rulepack_suggestion_egalite`). Un payload
 * invente prouverait que la console sait afficher ce qu'on a invente.
 */

function extraire(src, debut, fin, quoi) {
  const i = src.indexOf(debut);
  expect(i, `bloc introuvable (${quoi}) — la source a change de forme`).toBeGreaterThan(-1);
  const j = src.indexOf(fin, i);
  expect(j, `fin de bloc introuvable (${quoi})`).toBeGreaterThan(i);
  return src.slice(i, j + fin.length);
}

/** Fait tourner `chargerSuggestionPack` sur une reponse donnee et rend la
 *  zone telle que le marchand la recoit. */
function rendreConsoleCatalogue(reponse) {
  const dom = new JSDOM("<body></body>",
    { runScripts: "outside-only", url: "http://localhost/console.html" });
  const w = dom.window;
  w.eval(`
    ${extraire(I18N, "function T(gabarit) {", "\n  }", "T() de console-i18n.js")}
    var DICT = {}, EN = false;
    ${extraire(CONSOLE, "function esc(s) {", "}", "esc()")}
    ${extraire(CONSOLE, "function escAttr(s) {", "}", "escAttr()")}
    var REPONSE = ${JSON.stringify(reponse)};
    function apiFetch() { return Promise.resolve(REPONSE); }
    ${extraire(CONSOLE, "function chargerSuggestionPack(", "\n  }", "chargerSuggestionPack()")}
    var carte = document.createElement("div");
    // Le balisage pose par catalogCardHtml, a l'identique.
    carte.innerHTML = '<div class="pack-suggestion" hidden></div>';
    document.body.appendChild(carte);
    window.__zone = carte.querySelector(".pack-suggestion");
    chargerSuggestionPack(carte, "catalogue-test", "cle-test");
  `);
  return Promise.resolve().then(() => w.__zone);
}

/** Idem pour `recommanderPack()` de la console CSV. */
function rendreConsoleCsv(reponse) {
  const dom = new JSDOM(
    "<div id='csv-reco' hidden></div><select id='csv-rulepack'></select>",
    { runScripts: "outside-only", url: "http://localhost/console.html" });
  const w = dom.window;
  w.eval(`
    ${extraire(I18N, "function T(gabarit) {", "\n  }", "T() de console-i18n.js")}
    var DICT = {}, EN = false;
    ${extraire(CSV, "function escaper(", "}", "escaper()")}
    const $ = (id) => document.getElementById(id);
    const etat = { correspondance: { name: 1, ref: 0 } };
    function convertirEchantillon() {
      return { produits: Array.from({ length: 100 }, (_, i) => ({ id: "P" + i })) };
    }
    const REPONSE = ${JSON.stringify(reponse)};
    async function appelApi() { return REPONSE; }
    ${extraire(CSV, "let recoEnCours = false;", "\n}", "recommanderPack()")}
    window.__fini = recommanderPack();
  `);
  return w.__fini.then(() => w.document.getElementById("csv-reco"));
}

describe("le corpus de la fixture pose encore son cas", () => {
  // LE TEST DU TEST. Tout ce qui suit ne vaut que si la reponse capturee est
  // bien une egalite stricte. Le jour ou une regle de pack rend ce corpus non
  // ambigu, c'est ici que ca tombe -- pas dans les gardes, qui resteraient
  // verts sans plus rien garder.
  const r = CONTRAT.rulepack_suggestion_egalite;

  it("le moteur refuse de recommander, et dit pourquoi", () => {
    expect(r, "fixture absente — relancez `npm run fixtures`").toBeTruthy();
    for (const cle of ["None", "vins", "industrie"]) {
      expect(r[cle].recommande, `pack_actuel=${cle}`).toBeNull();
      expect(r[cle].marge, "le moteur doit servir la clé `marge`").toBeTruthy();
      expect(r[cle].marge.critere, `pack_actuel=${cle}`).toBeNull();
      expect(r[cle].marge.second).toBeTruthy();
    }
  });

  it("les deux packs de tete sont mesures a egalite sur les DEUX criteres", () => {
    const tete = r.None.classement.filter((c) => c.produits_annotes > 0).slice(0, 2);
    expect(tete).toHaveLength(2);
    expect(tete[0].produits_annotes).toBe(tete[1].produits_annotes);
    expect(tete[0].annotations_distinctes).toBe(tete[1].annotations_distinctes);
    expect(r.None.meilleur.pack).toBe(tete[0].pack);
    expect(r.None.marge.second).toBe(tete[1].pack);
  });

  it("l'autre refus, lui, n'a pas de second : rien n'est reconnu", () => {
    const muet = CONTRAT.rulepack_suggestion_sans_signal;
    expect(muet.recommande).toBeNull();
    expect(muet.marge.critere).toBeNull();
    expect(muet.marge.second, "aucun concurrent : pas de marge, pas zero").toBeNull();
  });
});

describe("console catalogue — la zone parle au lieu de disparaitre", () => {
  it("nomme les DEUX packs quand un changement aurait ete recommande", async () => {
    for (const cle of ["None", "vins"]) {
      const d = CONTRAT.rulepack_suggestion_egalite[cle];
      const zone = await rendreConsoleCatalogue(d);
      expect(zone.hidden, `pack_actuel=${cle} : la zone se masquait sans un mot`).toBe(false);
      expect(zone.textContent.length, `pack_actuel=${cle}`).toBeGreaterThan(0);
      expect(zone.textContent).toContain(d.meilleur.pack);
      expect(zone.textContent).toContain(d.marge.second);
      // Le message doit dire que la mesure ne separe pas, pas qu'il n'y a
      // rien a recommander.
      expect(zone.textContent).toMatch(/départage/);
      expect(zone.textContent).toContain(String(d.meilleur.produits_annotes));
      expect(zone.textContent).toContain(String(d.meilleur.annotations_distinctes));
    }
  });

  it("se tait quand on est DEJA pose sur l'un des packs a egalite", async () => {
    // Le moteur teste « le pack actuel est deja le plus pertinent » AVANT
    // l'egalite : etre deja sur l'un des deux n'appelle aucune action, et un
    // garde pose sur le seul `marge.critere === null` parlerait ici pour rien.
    const d = CONTRAT.rulepack_suggestion_egalite.industrie;
    expect(d.meilleur.pack).toBe(d.pack_actuel);
    const zone = await rendreConsoleCatalogue(d);
    expect(zone.hidden).toBe(true);
  });

  it("reste muette face a un moteur qui ne sert pas encore `marge`", async () => {
    // Le site se deploie independamment du moteur. `critere === null` est une
    // comparaison STRICTE : une reponse sans la cle rend `undefined`, la
    // branche ne s'allume pas, et la console se comporte comme avant le lot.
    const { marge, ...avantLeLot } = CONTRAT.rulepack_suggestion_egalite.None;
    expect(avantLeLot.marge).toBeUndefined();
    const zone = await rendreConsoleCatalogue(avantLeLot);
    expect(zone.hidden).toBe(true);
  });

  it("garde l'alerte « aucun attribut reconnu » sur un catalogue muet", async () => {
    const zone = await rendreConsoleCatalogue(CONTRAT.rulepack_suggestion_sans_signal);
    expect(zone.hidden).toBe(false);
    expect(zone.className).toContain("pack-suggestion-alerte");
    expect(zone.textContent).toContain("Aucun attribut reconnu");
  });
});

describe("console CSV — « aucun pack ne se detache » reste juste, et nomme les deux", () => {
  it("nomme les deux packs sur une egalite", async () => {
    const d = CONTRAT.rulepack_suggestion_egalite.None;
    const zone = await rendreConsoleCsv(d);
    expect(zone.hidden).toBe(false);
    expect(zone.textContent).toContain(d.meilleur.pack);
    expect(zone.textContent).toContain(d.marge.second);
    expect(zone.textContent).toMatch(/départage/);
  });

  it("garde l'ancien message quand rien n'est reconnu", async () => {
    const zone = await rendreConsoleCsv(CONTRAT.rulepack_suggestion_sans_signal);
    expect(zone.hidden).toBe(false);
    expect(zone.textContent).toContain("Aucun pack ne se détache");
    expect(zone.textContent).toContain("importer sans pack");
  });
});
