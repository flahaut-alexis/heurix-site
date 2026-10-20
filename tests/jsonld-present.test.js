import { describe, it, expect } from "vitest";
import { pagesIndexables, lire, PLANCHER } from "./pages-indexables.js";

// ---------------------------------------------------------------------------
// TOUTE PAGE INDEXABLE PORTE AU MOINS UN BLOC JSON-LD (20 octobre 2026).
//
// Quatre y echappaient : mesure.html, partners.html et leurs versions
// anglaises. Elles etaient aussi les seules pages du site sans bloc
// `Organization` -- le pied de page balise que 147 autres portent par copie.
// Une page qui nait en copiant une voisine herite de son balisage ; celles-la
// sont nees autrement, et personne ne l'a vu.
//
// LA DIFFERENCE AVEC `jsonld-blocs.test.js`, qui existe depuis le meme jour :
// celui-la juge les blocs PRESENTS (chacun se decode, porte @context et
// @type) ; celui-ci juge leur ABSENCE. Un garde sur les blocs presents ne
// peut pas voir une page qui n'en a aucun -- elle sort de son perimetre sans
// un mot. C'est exactement le motif du defaut hreflang du 20 octobre, et
// c'est pourquoi les deux gardes existent separement.
//
// CE QU'IL NE VOIT PAS, ET IL FAUT LE LIRE AVANT DE LUI FAIRE CONFIANCE :
//
//   1. Il compte UN bloc, n'importe lequel. Une page dont le seul balisage
//      est l'`Organization` du pied de page le satisfait, alors qu'elle ne
//      declare rien de ce qu'elle est. C'est une absence de plancher, pas une
//      presence de sens.
//   2. Il ne juge aucun TYPE. Rien ici n'exige qu'un article porte un
//      `BlogPosting`, qu'une page tarifaire porte une offre, ou que le type
//      choisi decrive honnetement la page -- le `TechArticle` de mesure.html
//      et le `Service` de partners.html ont ete justifies a la main, dans un
//      commentaire au-dessus de chaque bloc et dans
//      docs/releves/balisage-structure-2026-10-20.md.
//   3. Il ne voit pas les pages NON indexables. console.html, les CGV
//      archivees et les maquettes n'ont aucun balisage, et c'est assume : un
//      robot ne va pas sur une page en noindex.
// ---------------------------------------------------------------------------

const pages = pagesIndexables();

describe("JSON-LD — aucune page indexable n'est muette", () => {
  it("le perimetre n'est pas vide", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it("le perimetre ne tombe pas sous les 140 pages indexables du 20 octobre 2026", () => {
    expect(pages.length).toBeGreaterThanOrEqual(PLANCHER);
  });

  it("chaque page indexable porte au moins un bloc application/ld+json", () => {
    const muettes = pages.filter((p) => !/application\/ld\+json/i.test(lire(p)));
    expect(muettes).toEqual([]);
  });
});
