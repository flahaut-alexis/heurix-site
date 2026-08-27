import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const lire = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");

// ---------------------------------------------------------------------------
// L'IMAGE D'EN-TETE DES PAGES SOLUTIONS (27 aout 2026).
//
// Le cote de l'image alterne avec la position de la page dans la grille de
// `solutions/index.html`. Le site est statique : le cote est ECRIT dans le
// HTML, donc rien n'empeche une page creee plus tard de le choisir au
// hasard -- et deux gauches de suite ne produisent aucune erreur.
//
// Ce test RE-DERIVE l'alternance depuis la grille au lieu de la lire dans
// une liste : « une alternance se verifie dans un test, un tirage non ».
// Le perimetre vient de l'arbre (glob sur solutions/*.html), pas d'une
// enumeration -- une neuvieme page sera couverte sans qu'on y pense.
// ---------------------------------------------------------------------------

const PACKS = [...lire("solutions/index.html")
  .matchAll(/href="([a-z]+)\.html" class="solutions-hub-card"/g)].map((m) => m[1]);

const pagesDe = (dossier) =>
  fs.readdirSync(path.join(RACINE, dossier))
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => `${dossier}/${f}`);

const TOUTES = [...pagesDe("solutions"), ...pagesDe("en/solutions")];

describe("image d'en-tete des pages solutions", () => {
  it("la grille rend les huit packs, dans un ordre stable", () => {
    expect(PACKS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(PACKS).size).toBe(PACKS.length);
    // Les deux grilles doivent porter le MEME ordre, sinon l'alternation
    // francaise et l'anglaise divergeraient sans que rien ne le dise.
    const en = [...lire("en/solutions/index.html")
      .matchAll(/href="([a-z]+)\.html" class="solutions-hub-card"/g)].map((m) => m[1]);
    expect(en).toEqual(PACKS);
  });

  it("chaque page solutions porte une image d'en-tete", () => {
    for (const p of TOUTES) {
      expect(lire(p), `${p} : pas de bloc .solution-intro`).toContain('class="solution-intro ');
    }
  });

  it("le cote alterne avec le rang dans la grille — impair a gauche", () => {
    for (const p of TOUTES) {
      const pack = path.basename(p, ".html");
      const rang = PACKS.indexOf(pack);
      expect(rang, `${p} : absent de la grille de solutions/index.html`).toBeGreaterThanOrEqual(0);
      const attendu = rang % 2 === 0 ? "gauche" : "droite";
      expect(lire(p), `${p} : rang ${rang + 1} => ${attendu}`)
        .toContain(`solution-intro solution-intro-${attendu}`);
    }
  });

  it("le chemin se derive du nom du pack, a la bonne profondeur", () => {
    for (const p of TOUTES) {
      const pack = path.basename(p, ".html");
      const remontee = p.startsWith("en/") ? "../../" : "../";
      const src = lire(p).match(/class="solution-intro-img" src="([^"]+)"/);
      expect(src, `${p} : pas de src sur l'image`).not.toBeNull();
      expect(src[1], p).toMatch(
        new RegExp(`^${remontee.replace(/\./g, "\\.")}img/solutions/${pack}\\.jpg\\?v=\\d+$`)
      );
      // C'est le test qui dit si le fichier existe, pas l'oeil : une page
      // anglaise nait d'une francaise a une profondeur de plus.
      const cible = path.resolve(path.join(RACINE, path.dirname(p)), src[1].split("?")[0]);
      expect(fs.existsSync(cible), `${p} : ${src[1]} ne resout sur rien`).toBe(true);
    }
  });

  it("dimensions explicites, et conformes au fichier reel", () => {
    for (const p of TOUTES) {
      const s = lire(p);
      expect(s, `${p} : width manquant`).toMatch(/class="solution-intro-img"[\s\S]{0,200}?width="1000"/);
      expect(s, `${p} : height manquant`).toMatch(/class="solution-intro-img"[\s\S]{0,200}?height="671"/);
    }
  });

  // AU-DESSUS DE LA LIGNE DE FLOTTAISON : `loading="lazy"` y retarde
  // l'affichage au lieu de l'economiser.
  it("aucune image d'en-tete n'est differee", () => {
    for (const p of TOUTES) {
      const bloc = lire(p).match(/<img class="solution-intro-img"[\s\S]*?>/)[0];
      expect(bloc, `${p} : loading="lazy" sur une image d'en-tete`).not.toContain('loading="lazy"');
    }
  });

  // L'ALT DECRIT CE QU'ON VOIT, PAS LE PACK. « electricite » ne dit rien a
  // qui ne voit pas l'image ; « trois cables sectionnes » si.
  //
  // LA VERSION PRECEDENTE DE CE TEST INTERDISAIT LE NOM DU PACK DANS L'ALT,
  // et elle est tombee tout de suite sur `livres` : « Trois livres relies
  // serres cote a cote... » decrit exactement ce qu'on voit, et le mot est
  // le meme. Le proxy etait faux -- pour la moitie des packs, l'objet
  // photographie PORTE le nom du pack. Ce qui distingue une description
  // d'une etiquette n'est pas son vocabulaire, c'est sa forme : une phrase,
  // pas un mot-clef. Le test demande donc une phrase.
  it("l'alt est une phrase descriptive, pas une etiquette", () => {
    for (const p of TOUTES) {
      const alt = lire(p).match(/class="solution-intro-img"[\s\S]*?alt="([^"]*)"/)[1];
      expect(alt.split(/\s+/).length, `${p} : trop peu de mots (« ${alt} »)`).toBeGreaterThanOrEqual(12);
      expect(alt.trim().endsWith("."), `${p} : « ${alt} » n'est pas une phrase`).toBe(true);
    }
  });

  it("le CSS porte les deux cotes et la bascule mobile", () => {
    const css = lire("styles.css");
    expect(css).toContain(".solution-intro{");
    expect(css).toContain(".solution-intro-droite{");
    expect(css).toMatch(/@media \(max-width:768px\)\{[\s\S]{0,200}\.solution-intro,/);
  });
});
