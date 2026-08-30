import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(import.meta.dirname, "..");
const CSS = readFileSync(join(RACINE, "styles.css"), "utf8");

/* CE QUE CE GARDE FERME, et pourquoi il ne va pas de soi.
 *
 * `.nav-drop-panel{ display:none }` est la SEULE chose qui tient un menu
 * ferme -- ni `hidden`, ni `aria-expanded`, qui ne font que le declarer.
 * Une variante qui pose son propre `display` hors de `.open` l'ecrase, et
 * les trois panneaux restent ouverts sur les 126 pages.
 *
 * Mesure du 30 aout 2026, avant correctif : les trois panneaux rendaient
 * `display:grid` / `display:flex` avec `aria-expanded="false"`. Le DOM
 * disait ferme, le compositeur peignait ouvert.
 *
 * AUCUN TEST EXISTANT NE POUVAIT LE VOIR. entete-structure compare des
 * structures, classement-fond lit des couleurs, et une capture prise apres
 * un clic montre le panneau ouvert -- ce qui est justement l'etat qu'on
 * voulait. Le defaut n'est visible qu'a l'etat FERME, celui qu'on ne pense
 * pas a photographier.
 */
describe("les panneaux de menu restent fermes par defaut", () => {
  // Perimetre DERIVE : toute variante de .nav-panel-* ecrite dans le fichier,
  // pas une liste de trois noms qui se perimerait au quatrieme menu.
  const variantes = [...new Set(
    [...CSS.matchAll(/\.(nav-panel-[a-z-]+)\b/g)].map((m) => m[1]),
  )];

  it("il y a bien des variantes a controler", () => {
    expect(variantes.length).toBeGreaterThan(0);
  });

  it.each(variantes)("%s ne pose `display` que sous .open", (variante) => {
    const fautifs = [];
    // Un bloc = un selecteur + ses declarations. On ne garde que ceux qui
    // nomment la variante et posent `display`.
    for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selecteur, corps] = m;
      if (!selecteur.includes("." + variante)) continue;
      if (!/(^|;|\s)display\s*:/.test(corps)) continue;
      // Seule une regle qui exige .open a le droit de rallumer le panneau.
      if (/\.open\b/.test(selecteur)) continue;
      // Un descendant (`.nav-panel-secteurs a`) ne pilote pas le panneau.
      if (selecteur.trim().split(/\s+/).pop().includes("." + variante) === false) continue;
      fautifs.push(selecteur.trim().replace(/\s+/g, " "));
    }
    expect(fautifs, `${variante} : \`display\` hors de .open ecrase `
      + `\`.nav-drop-panel{display:none}\` et laisse le panneau ouvert`).toEqual([]);
  });
});
