import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const JS = fs.readFileSync(path.join(RACINE, "search-engine.js"), "utf8");
const PY = fs.readFileSync(path.join(RACINE, "scripts/index-recherche.py"), "utf8");

// ---------------------------------------------------------------------------
// L'index anglais portait « Secteurs », « Produit » et « Plateformes » : le
// generateur ne connait qu'une langue et ecrivait le libelle, pas une clef.
// Trois mots francais s'affichaient donc dans l'interface anglaise -- vus a
// l'ecran, pas en lisant le code.
//
// Ce test ne traduit rien : il verifie que CHAQUE clef que le generateur peut
// emettre a un mot dans LES DEUX dictionnaires. Une source ajoutee cote Python
// sans traduction tombe ici, avant l'ecran.
// ---------------------------------------------------------------------------

/** Les clefs que index-recherche.py peut ecrire dans le champ `s`. */
function clefsDuGenerateur() {
  const bloc = PY.match(/^SOURCES = \(([\s\S]*?)^\)/m);
  if (!bloc) throw new Error("SOURCES introuvable dans index-recherche.py");
  const clefs = new Set([...bloc[1].matchAll(/,\s*"([a-z]+)"\)/g)].map((m) => m[1]));
  const defaut = PY.match(/return "([a-z]+)"\s*$/m);
  if (!defaut) throw new Error("source() sans valeur par defaut");
  clefs.add(defaut[1]);
  return clefs;
}

/** Le sous-dictionnaire `source:` d'une langue, lu dans LIBELLES. */
function motsDeLaLangue(langue) {
  const dico = JS.match(new RegExp(`\\n    ${langue}: \\{([\\s\\S]*?)\\n    \\},`));
  if (!dico) throw new Error(`LIBELLES.${langue} introuvable`);
  const src = dico[1].match(/source: \{([\s\S]*?)\}/);
  if (!src) throw new Error(`LIBELLES.${langue}.source introuvable`);
  const paires = {};
  for (const m of src[1].matchAll(/([a-z]+):\s*"([^"]+)"/g)) paires[m[1]] = m[2];
  return paires;
}

describe("pastilles de source — la clef se traduit, elle ne s'affiche pas", () => {
  const clefs = clefsDuGenerateur();

  it("le generateur emet des clefs, jamais un libelle affichable", () => {
    expect(clefs.size).toBeGreaterThan(1);
    for (const c of clefs) expect(c).toMatch(/^[a-z]+$/);
  });

  it.each(["fr", "en"])("%s traduit exactement les clefs du generateur", (langue) => {
    const mots = motsDeLaLangue(langue);
    expect(new Set(Object.keys(mots))).toEqual(clefs);
  });

  it("l'anglais ne reprend pas le mot francais quand les deux different", () => {
    const fr = motsDeLaLangue("fr");
    const en = motsDeLaLangue("en");
    // « Blog » et « Documentation » s'ecrivent pareil : on n'exige une
    // difference que la ou le francais porte un mot qui n'est pas anglais.
    for (const clef of ["secteurs", "produit", "plateformes"]) {
      expect(en[clef]).not.toBe(fr[clef]);
    }
  });

  it("les deux index ne contiennent que des clefs traduites", () => {
    for (const f of ["search-index-fr.json", "search-index-en.json"]) {
      const brut = JSON.parse(fs.readFileSync(path.join(RACINE, f), "utf8"));
      const entrees = Array.isArray(brut) ? brut : brut.entrees;
      const vues = new Set(entrees.map((e) => e.s).filter(Boolean));
      expect(vues.size).toBeGreaterThan(0);
      for (const v of vues) expect(clefs).toContain(v);
    }
  });
});
