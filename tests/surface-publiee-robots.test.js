import { describe, it, expect } from "vitest";
import {
  entreesInternesPresentes,
  entreesNonClassees,
  fragmentsSuivis,
  reglesDisallow,
} from "./surface-publiee.js";

/**
 * CE QUI N'EST PAS DU SITE EST REFUSE AUX ROBOTS.
 *
 * LE FAIT QUI REND CETTE REGLE NECESSAIRE, et sans lequel quelqu'un la
 * supprimera un jour en la croyant arbitraire : `upload-pages-artifact` recoit
 * `path: '.'`, donc GitHub Pages sert la RACINE ENTIERE du depot. Les entrees
 * internes -- `docs/`, `tests/`, `scripts/`, `CLAUDE.md` -- sont donc servies
 * sous le domaine du site, et rien dans l'arbre ne l'empeche.
 *
 * LA REGLE : toute entree de premier niveau qui n'est pas du site porte un
 * `Disallow`, et la confrontation est DERIVEE (`surface-publiee.js`), pour
 * qu'une entree neuve ne puisse entrer en silence ni d'un cote ni de l'autre.
 *
 * CE QU'IL NE FAUT PAS DEDUIRE DE CE GARDE : qu'il retire quoi que ce soit. Il
 * retire le chemin par lequel un robot trouverait ces fichiers sans les
 * chercher, et rien de plus.
 *
 * L'ANALYSE DE RISQUE N'EST PAS ICI -- ce qui est servi, ce que cela vaut, et
 * pourquoi il a ete pese de le laisser lisible. Elle vit dans
 * `SITE-pages-perimetre-2026-10-04.md`, depot prive : un inventaire de ce qui
 * est public ne doit pas etre public.
 */

describe("surface publiee hors site", () => {
  it("chaque entree interne suivie est refusee dans robots.txt", () => {
    const refuses = new Set(reglesDisallow());
    const oubliees = entreesInternesPresentes().filter((e) => !refuses.has("/" + e));
    expect(
      oubliees,
      "Pages sert la racine entiere : ces chemins ne sont pas du site et restent crawlables",
    ).toEqual([]);
  });

  /**
   * L'assertion qui empeche la liste de mentir par omission. Une entree de
   * premier niveau que NI la liste interne NI la liste du site ne connait est
   * une entree dont personne n'a decide le sort -- et le defaut par defaut est
   * « publiee et crawlable ». Elle doit etre classee, pas devinee.
   */
  it("aucune entree de premier niveau n'echappe aux deux listes", () => {
    expect(
      entreesNonClassees(),
      "entree(s) neuve(s) a classer dans tests/surface-publiee.js : site ou interne",
    ).toEqual([]);
  });

  /**
   * LE GARDE GLOBAL, ET IL VIT ICI PARCE QU'IL NE PEUT VIVRE AILLEURS. Il
   * quantifie sur TOUTES les regles `Disallow`, donc sur les deux familles :
   * les fragments et la surface hors site. Il etait dans
   * `fragments-non-indexables.test.js`, qui ne connaissait qu'une famille, et
   * il y rougissait des que l'autre apparaissait -- mesure le 4 octobre 2026 :
   * dix regles ajoutees, dix « perimees » annoncees a tort.
   *
   * Une regle qui ne correspond plus a rien doit sortir : soit la cible a
   * disparu, soit un fragment est devenu une vraie page et n'a plus a etre
   * cache. Sans cette assertion, robots.txt accumulerait des lignes que plus
   * personne ne conteste -- le contraire de ce qu'elles devaient etre.
   */
  it("aucune regle Disallow n'est perimee, toutes familles confondues", () => {
    const legitimes = new Set([
      ...entreesInternesPresentes().map((e) => "/" + e),
      ...fragmentsSuivis().map((p) => "/" + p),
    ]);
    const perimees = reglesDisallow().filter((r) => !legitimes.has(r));
    expect(
      perimees,
      "regle(s) sans cible : la cible a disparu, ou un fragment est devenu une vraie page",
    ).toEqual([]);
  });

  /**
   * Le garde du garde. Si la derivation cessait un jour de reconnaitre quoi
   * que ce soit, les assertions ci-dessus passeraient en ne verifiant rien.
   * Un test vert sur un ensemble vide ne prouve rien.
   */
  it("la derivation reconnait les deux familles, sinon elle ne verifie rien", () => {
    expect(entreesInternesPresentes().length, "aucune entree interne reconnue").toBeGreaterThan(0);
    expect(fragmentsSuivis().length, "aucun fragment reconnu").toBeGreaterThan(0);
  });
});
