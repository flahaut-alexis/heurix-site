import { describe, it, expect } from "vitest";
import { fragmentsSuivis, reglesDisallow } from "./surface-publiee.js";

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

describe("fragments servis en .html", () => {
  it("chaque fragment suivi est refuse dans robots.txt", () => {
    const refuses = new Set(reglesDisallow());
    const oublies = fragmentsSuivis()
      .filter((p) => !refuses.has("/" + p));
    expect(oublies).toEqual([]);
  });

  /**
   * L'ASSERTION « AUCUNE REGLE N'EST PERIMEE » A DEMENAGE, et ce n'est pas un
   * abandon. Elle quantifie sur TOUTES les regles `Disallow`, donc sur les
   * deux familles : les fragments et la surface hors site ajoutee le
   * 4 octobre 2026. Ici elle ne connaissait qu'une famille et rougissait des
   * que l'autre apparaissait -- mesure ce jour-la, dix regles ajoutees, dix
   * « perimees » annoncees a tort. Elle vit desormais dans
   * `surface-publiee-robots.test.js`, qui derive les deux.
   */

  /**
   * Le garde du garde. Si le critere « pas de <html> » cessait un jour de
   * reconnaitre quoi que ce soit -- fichier renomme, extension changee --, les
   * deux assertions ci-dessus passeraient en ne verifiant rien, et robots.txt
   * pourrait perdre sa ligne sans que personne ne le voie. Un test vert sur un
   * ensemble vide ne prouve rien.
   */
  it("le critere reconnait au moins un fragment, sinon il ne verifie rien", () => {
    expect(fragmentsSuivis().length).toBeGreaterThan(0);
  });
});
