import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const CONSOLE = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
const I18N = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");

/* LES CINQ GABARITS DU BILAN, DANS LES DEUX LANGUES (5 septembre 2026).
 *
 * `soAfficherBilanSuppression` remplace « Échec de la suppression. » -- une
 * phrase unique -- par un bilan a trois nombres. Deux choses peuvent rater
 * sans que rien n'echoue :
 *
 *   1. UN GABARIT NON TRADUIT. `T()` rend le gabarit tel quel quand DICT ne
 *      le connait pas : la console anglaise afficherait du francais, en
 *      silence. C'est le comportement documente de console-i18n.js, et
 *      c'est precisement pourquoi il faut le tester plutot que s'y fier.
 *
 *   2. UNE CONCATENATION AVEC LA PHRASE DU MOTEUR. Le chemin 2 cherche le
 *      GABARIT avant substitution ; coller `err.message` dedans le rendrait
 *      introuvable, et la phrase du moteur perdrait aussi son egalite
 *      exacte du chemin 1. Les deux traductions tomberaient d'un coup.
 *      D'ou les noeuds separes, et d'ou le dernier test ici.
 */

// Les cinq, tels qu'ecrits dans console.js. Si l'un change d'un caractere
// sans que DICT suive, le premier test le dit.
const GABARITS = [
  ["Suppression de {0} règle(s)…", "Deleting {0} rule(s)…"],
  ["{0} règle(s) supprimée(s).", "{0} rule(s) deleted."],
  ["{0} règle(s) supprimée(s). {1} avaient déjà été supprimée(s) ailleurs : votre liste était périmée, elle est à jour.",
   "{0} rule(s) deleted. {1} had already been deleted elsewhere: your list was out of date, it is now up to date."],
  ["{0} supprimée(s), {1} déjà disparue(s), {2} en échec. Les règles en échec restent cochées : vous pouvez réessayer.",
   "{0} deleted, {1} already gone, {2} failed. The failed rules stay selected: you can try again."],
  ["Aucune des {0} règles n'a pu être supprimée. Elles restent cochées.",
   "None of the {0} rules could be deleted. They stay selected."],
];

function chargerT(lang) {
  const dom = new JSDOM(`<!doctype html><html lang="${lang}"><body></body></html>`,
    { url: "http://localhost/console.html", runScripts: "outside-only" });
  dom.window.eval(I18N);
  return dom.window.T;
}

describe("console-i18n.js — le bilan d'une suppression en lot parle anglais", () => {
  const T_fr = chargerT("fr");
  const T_en = chargerT("en");

  GABARITS.forEach(([fr, en]) => {
    it(`« ${fr.slice(0, 46)}… » est traduit`, () => {
      // En francais, T est un passe-plat : le gabarit sort tel quel.
      expect(T_fr(fr)).toBe(fr);
      // En anglais, il DOIT changer. Sans DICT, T rend le francais sans
      // echouer -- c'est exactement le silence que ce test achete.
      expect(T_en(fr), "gabarit absent de DICT : l'anglais afficherait du francais").toBe(en);
    });
  });

  it("chaque gabarit est reellement appele par console.js", () => {
    // Un gabarit traduit mais jamais pose est une entree morte ; un gabarit
    // pose mais absent d'ici echapperait aux tests ci-dessus.
    GABARITS.forEach(([fr]) => {
      expect(CONSOLE.includes(fr), `gabarit jamais appele dans console.js : ${fr}`).toBe(true);
    });
  });

  it("la substitution garde les nombres, dans les deux langues", () => {
    const [fr, en] = GABARITS[3];
    expect(T_fr(fr, 12, 2, 1)).toBe(
      "12 supprimée(s), 2 déjà disparue(s), 1 en échec. Les règles en échec restent cochées : vous pouvez réessayer."
    );
    expect(T_en(fr, 12, 2, 1)).toBe(
      "12 deleted, 2 already gone, 1 failed. The failed rules stay selected: you can try again."
    );
  });

  it("aucun gabarit ne concatene la phrase du moteur", () => {
    // La raison du moteur va dans un noeud ENFANT, jamais dans le gabarit.
    // Si quelqu'un « simplifie » en collant err.message dans la phrase, les
    // DEUX chemins de traduction tombent -- et rien d'autre ne le dirait.
    const bilan = CONSOLE.slice(
      CONSOLE.indexOf("function soAfficherBilanSuppression"),
      CONSOLE.indexOf("function apiFetch")
    );
    expect(bilan.length).toBeGreaterThan(200);
    expect(bilan, "un gabarit concatene une valeur : la traduction tomberait")
      .not.toMatch(/T\("[^"]*"\s*\+/);
    expect(bilan, "la raison du moteur doit rester dans son propre noeud")
      .toMatch(/createElement\("span"\)[\s\S]*textContent = r/);
  });
});
