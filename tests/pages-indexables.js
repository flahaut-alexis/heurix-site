import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * LE PERIMETRE DES GARDES PAR ABSENCE : LES PAGES INDEXABLES.
 *
 * Module partage par `titre-h1.test.js`, `jsonld-present.test.js` et
 * `og-image.test.js`. Les trois posent la meme question -- « quelle page
 * indexable ne porte pas X » -- et trois definitions de « page indexable »
 * ecrites separement auraient derive l'une de l'autre.
 *
 * LA DEFINITION N'EST PAS INVENTEE ICI. C'est mot pour mot celle de
 * `tests/canonical.test.js` (`estIndexable`, 3 septembre 2026) : un fichier
 * avec un `<html>` et sans `noindex`. Elle ne nomme aucun dossier, et c'est
 * ce qui la rend juste : `docs/maquettes/`, `demo/` et `en/demo/` sortent
 * parce que leurs pages portent `noindex`, pas parce qu'une liste les
 * enumere. Une liste de dossiers se perimerait au premier dossier ajoute.
 *
 * SUR `git ls-files` PLUTOT QU'UN BALAYAGE DU DISQUE, pour la raison que
 * `tests/surface-publiee.js` donne deja : un balayage du disque fait tomber
 * ces tests sur les harnais temporaires des sessions voisines -- arrive a
 * `tests/canonical.test.js` le 28 aout 2026 -- et un fichier non suivi n'est
 * jamais servi.
 *
 * RECONCILIATION DES PERIMETRES (20 octobre 2026), parce que trois comptes
 * circulent sur ce depot et que deux d'entre eux ne doivent servir a aucun
 * garde :
 *
 *     174   fichiers .html suivis          inventaire, rien de plus
 *     -  1  fragment sans <html>           downloads/heurix-conversion-snippet.html
 *     - 12  arbres qui ne sont pas le site docs/maquettes/ (8), demo/ (2), en/demo/ (2)
 *     - 21  pages du site en noindex       404, cgv-*, console, mentions-legales...
 *     = 140 PAGES INDEXABLES               = exactement les <loc> du sitemap
 *
 * C'est 140 qui fait foi pour un garde. 174 est un inventaire de fichiers ;
 * 163 -- le compte « pages avec <html> hors tests/docs/demo/downloads »
 * publie le 20 octobre -- melangeait les 21 noindex et laissait entrer
 * `en/demo/` (sous-dossier de `en/`, pas dossier de premier niveau) : il ne
 * designe aucune population utile et ne doit pas etre repris.
 */

export const RACINE = join(import.meta.dirname, "..");

export const lire = (p) => readFileSync(join(RACINE, p), "utf8");

/** Les .html SUIVIS par git, chemins relatifs, separateur `/`. */
function htmlSuivis() {
  return execFileSync("git", ["--no-optional-locks", "ls-files", "-z", "*.html"],
                      { cwd: RACINE, encoding: "utf8" })
    .split("\0").filter(Boolean);
}

/** Meme critere que canonical.test.js : un `<html>`, et pas de `noindex`. */
export function estIndexable(source) {
  if (!/<html\b/i.test(source)) return false;
  const robots = source.match(/<meta name="robots" content="([^"]*)"/i);
  return !(robots && /noindex/i.test(robots[1]));
}

export function pagesIndexables() {
  return htmlSuivis().filter((p) => estIndexable(lire(p))).sort();
}

/**
 * LE PLANCHER, MESURE LE 20 OCTOBRE 2026 : 140 pages indexables.
 *
 * Il n'est pas sous la mesure, il lui est EGAL, et c'est demande : un
 * perimetre qui tombe a 139 doit rougir. Une page retiree du site, ou passee
 * en noindex, fait donc echouer les trois gardes -- c'est le prix d'un
 * plancher serre, et il se paie en une ligne a mettre a jour ici, avec sa
 * date, plutot qu'en trois gardes qui inspectent moins de pages sans le dire.
 */
export const PLANCHER = 140;
