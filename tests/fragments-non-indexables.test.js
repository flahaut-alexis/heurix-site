import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * UN FRAGMENT SERVI EN .html DOIT ETRE REFUSE AUX ROBOTS.
 *
 * Le probleme n'est pas visible depuis la page : `heurix-conversion-snippet.html`
 * est un extrait de code a coller, propose en telechargement, sans <html> ni
 * <head> ni <title>. Un robot qui atteint son URL n'a aucun moyen de le savoir
 * -- l'extension dit « document » -- et l'indexe comme une page de commentaires
 * JavaScript.
 *
 * `noindex` serait le bon outil et n'est pas disponible : une balise <meta>
 * exige un <head>, et lui en poser un corromprait ce que le marchand colle.
 * L'en-tete X-Robots-Tag ferait l'affaire, mais GitHub Pages ne permet pas d'en
 * definir. robots.txt est le seul levier.
 *
 * LE PERIMETRE EST DERIVE, JAMAIS ENUMERE. C'est la lecon la plus repetee de
 * ce depot : une liste ecrite a la main est juste le jour ou on l'ecrit et
 * fausse ensuite, sans que rien ne le signale. Ici la liste est reconstruite a
 * chaque execution depuis les fichiers reellement suivis.
 *
 * SUR `git ls-files` PLUTOT QU'UN BALAYAGE DU DISQUE. robots.txt ne peut
 * couvrir que ce qui est PUBLIE ; un fichier non suivi n'est jamais servi. Le
 * balayage du disque ferait en plus tomber ce test sur les harnais temporaires
 * des sessions voisines -- ce qui est arrive a tests/canonical.test.js le
 * 28 aout 2026, deux echecs nommant `_export-icones.html`, un fichier non
 * suivi d'une autre session. L'index git est le bon perimetre parce qu'il est
 * celui de la publication.
 *
 * Le critere « pas de <html> » est celui qu'emploie deja tests/canonical.test.js
 * pour decider qu'une page n'a pas d'adresse canonique. Meme identite, deux
 * consequences : pas de canonical, et pas d'indexation.
 */

const RACINE = join(import.meta.dirname, "..");

function fichiersHtmlSuivis() {
  return execFileSync("git", ["ls-files", "*.html"], { cwd: RACINE, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((p) => !p.startsWith("docs/maquettes/"));
}

function estUnFragment(chemin) {
  return !/<html\b/i.test(readFileSync(join(RACINE, chemin), "utf8"));
}

function reglesDisallow() {
  return readFileSync(join(RACINE, "robots.txt"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^Disallow:/i.test(l))
    .map((l) => l.replace(/^Disallow:\s*/i, ""))
    .filter(Boolean);
}

describe("fragments servis en .html", () => {
  it("chaque fragment suivi est refuse dans robots.txt", () => {
    const refuses = new Set(reglesDisallow());
    const oublies = fichiersHtmlSuivis()
      .filter(estUnFragment)
      .filter((p) => !refuses.has("/" + p));
    expect(oublies).toEqual([]);
  });

  /**
   * L'assertion qui empeche la liste de devenir un inventaire de dettes. Une
   * regle Disallow qui ne correspond plus a aucun fragment doit sortir : soit
   * le fichier a disparu, soit il est devenu une vraie page et n'a plus a etre
   * cache. Sans elle, robots.txt accumulerait des lignes que plus personne ne
   * conteste -- le contraire de ce qu'elles devaient etre.
   */
  it("aucune regle Disallow n'est perimee", () => {
    const fragments = new Set(fichiersHtmlSuivis().filter(estUnFragment).map((p) => "/" + p));
    const perimees = reglesDisallow().filter((r) => !fragments.has(r));
    expect(perimees).toEqual([]);
  });

  /**
   * Le garde du garde. Si le critere « pas de <html> » cessait un jour de
   * reconnaitre quoi que ce soit -- fichier renomme, extension changee --, les
   * deux assertions ci-dessus passeraient en ne verifiant rien, et robots.txt
   * pourrait perdre sa ligne sans que personne ne le voie. Un test vert sur un
   * ensemble vide ne prouve rien.
   */
  it("le critere reconnait au moins un fragment, sinon il ne verifie rien", () => {
    expect(fichiersHtmlSuivis().filter(estUnFragment).length).toBeGreaterThan(0);
  });
});
