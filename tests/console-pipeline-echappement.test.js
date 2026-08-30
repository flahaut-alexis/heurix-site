import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const CONSOLE = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
const I18N = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");

/* XSS stocke sur l'ecran quotidien du marchand -- « Mise en avant sur
 * categorie », panneau pipeline.
 *
 * LA CHAINE, reproduite et confirmee le 30 aout 2026 :
 *   1. le marchand pose une regle d'attribut : POST /v1/browse/{c}/{c}/attribute-rules
 *      -- `field` (100 car.) et `value` (200 car.) sont des `str` LIBRES,
 *         ni pattern, ni validateur, ni filtre HTML cote moteur ;
 *   2. le moteur la renvoie dans `favorisation_ignoree_par` (browse.py:386) ;
 *   3. la console la passe a T(), qui N'ECHAPPE RIEN -- verifie en
 *      l'exercant : T("{0}", "<img onerror=1>") rend la balise intacte ;
 *   4. le resultat est concatene dans une chaine HTML puis affecte a
 *      `conteneur.innerHTML`.
 *
 * `esc(nom)` etait echappe sur la MEME LIGNE ; `regle.field` et
 * `regle.value` ne l'etaient pas. Trois arguments, deux oublis.
 *
 * La victime n'est pas seulement l'auteur de la regle : les roles d'equipe
 * font partager un compte, et tout coequipier ouvrant ce catalogue rend le
 * meme HTML.
 *
 * POURQUOI CE TEST EVALUE LA SOURCE plutot que d'assertionner dessus. Une
 * assertion textuelle (« esc( apparait avant regle.value ») prouve qu'un
 * caractere est present, pas qu'une charge est neutralisee -- et trois
 * sessions se sont fait prendre cette semaine par une fonction
 * d'echappement qui ne fait pas ce qu'on lit. On extrait donc le bloc
 * REELLEMENT EXPEDIE et on le fait tourner.
 */

const CHARGE_BALISE = "<img src=x onerror=\"window.__xss=1\">";
const CHARGE_APOSTROPHE = "A' onmouseover='window.__xss=1";

function extraire(src, debut, fin, quoi) {
  const i = src.indexOf(debut);
  expect(i, `bloc introuvable (${quoi}) — la source a change de forme`).toBeGreaterThan(-1);
  const j = src.indexOf(fin, i);
  expect(j, `fin de bloc introuvable (${quoi})`).toBeGreaterThan(i);
  return src.slice(i, j + fin.length);
}

/** Rejoue le rendu du panneau pipeline avec les fonctions REELLES. */
function rendrePipeline(regle) {
  const esc = extraire(CONSOLE, "function esc(s) {", "}", "esc() de console.js");
  const T = extraire(I18N, "function T(gabarit) {", "\n  }", "T() de console-i18n.js");
  const bloc = extraire(CONSOLE, "var conflitsHtml = hits.filter",
                        '.join("");', "construction de conflitsHtml");

  // runScripts « outside-only » : sans lui, window.eval s'execute hors du
  // contexte du document et `document` n'y est pas defini. Meme reglage que
  // chargerConsole() dans console.test.js.
  const dom = new JSDOM("<!doctype html><html lang='fr'><body><div id='c'></div></body></html>",
                        { runScripts: "outside-only", url: "http://localhost/" });
  const w = dom.window;
  w.__xss = 0;
  w.eval(`
    var DICT = {}, EN = false;
    ${esc}
    ${T}
    var hits = [{ product: { name: "Vis M8" }, favorisation_ignoree_par: ${JSON.stringify(regle)} }];
    ${bloc}
    document.getElementById("c").innerHTML = conflitsHtml;
  `);
  return { doc: w.document, cible: w.document.getElementById("c"), fenetre: w };
}

describe("panneau pipeline — la regle du marchand ne peut pas injecter de HTML", () => {
  it("neutralise une balise dans value", () => {
    const { cible } = rendrePipeline({ field: "marque", value: CHARGE_BALISE });
    expect(cible.querySelector("img"), "une <img> a ete creee depuis value").toBeNull();
    expect(cible.textContent).toContain(CHARGE_BALISE);
  });

  it("neutralise une balise dans field", () => {
    const { cible } = rendrePipeline({ field: CHARGE_BALISE, value: "inox" });
    expect(cible.querySelector("img"), "une <img> a ete creee depuis field").toBeNull();
  });

  it("une apostrophe ne cree aucun attribut", () => {
    const { cible } = rendrePipeline({ field: "marque", value: CHARGE_APOSTROPHE });
    const p = cible.querySelector("p");
    expect(p, "le paragraphe attendu a disparu").not.toBeNull();
    expect(p.getAttribute("onmouseover"), "un gestionnaire a ete injecte").toBeNull();
    expect(cible.querySelectorAll("*").length, "des elements en trop ont ete crees").toBe(1);
  });

  it("le libelle legitime du produit reste lisible", () => {
    const { cible } = rendrePipeline({ field: "marque", value: "L'Écrou & Cie" });
    expect(cible.textContent).toContain("Vis M8");
    expect(cible.textContent).toContain("L'Écrou & Cie");
  });
});
