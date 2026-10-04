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
 * MESURE DU 4 OCTOBRE 2026, trouvaille incidente de la verification de C1.
 * `upload-pages-artifact` recoit `path: '.'` : Pages sert la racine entiere du
 * depot. Sonde sur les 202 chemins internes suivis -- 198 rendent 200, pour
 * 2,52 Mio. Dont :
 *
 *     docs/                   75 fichiers   1 137 132 o
 *     tests/                 108 fichiers   1 119 456 o
 *     CLAUDE.md                1 fichier      182 842 o
 *     scripts/ (le crochet)    7 fichiers       90 146 o
 *
 * CE N'EST PAS UNE FUITE, et il faut le dire pour que la regle garde sa juste
 * taille : le depot est PUBLIC, donc ces fichiers etaient deja lisibles sur
 * GitHub. Ce qui change avec Pages, c'est le domaine : ce sont des URL de
 * `heurix.fr`, le domaine commercial, et `CLAUDE.md` y sert 182 Ko de
 * raisonnement interne -- dont une table que l'audit du meme jour a trouvee
 * fausse.
 *
 * POURQUOI robots.txt ET PAS UN REPERTOIRE DE PUBLICATION DEDIE. L'autre
 * sortie mesuree -- assembler un `_site/` et pointer `path:` dessus -- retire
 * vraiment les fichiers. Elle a ete ECARTEE le 4 octobre 2026 pour une raison
 * mesurable : AUCUN test de ce depot ne lit l'artefact publie. Tous derivent de
 * l'arbre (`RACINE`), `liens-relatifs.test.js` compris. Un fichier du site
 * oublie a l'assemblage passerait les 1 056 tests ET le crochet, et ne se
 * verrait qu'en production. Elle creerait donc la classe de panne que ce depot
 * poursuit partout ailleurs -- un garde qui juge autre chose que ce qui est
 * servi -- et il faudrait ecrire ce garde AVANT, pour un probleme de vitrine et
 * non de secret. Raison complete :
 * `docs/mesures/pages-perimetre-2026-10-04/RELEVE.md`.
 *
 * CE QUE robots.txt NE FAIT PAS, et c'est assume : il ne retire rien. Les 198
 * fichiers restent lisibles pour qui connait l'URL. Ce qu'il retire est le
 * chemin par lequel un prospect tomberait dessus sans la chercher. Mesure de
 * la decouvrabilite le meme jour : 0 des 140 URL du sitemap, 0 lien `href`
 * ou `src` depuis une page servie, 0 renvoi dans `llms.txt` -- mais
 * `Allow: /` laissait tout crawlable.
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
