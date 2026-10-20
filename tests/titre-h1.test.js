import { describe, it, expect } from "vitest";
import { pagesIndexables, lire, PLANCHER } from "./pages-indexables.js";

// ---------------------------------------------------------------------------
// UN SEUL <h1> PAR PAGE INDEXABLE (20 octobre 2026).
//
// Quatre pages n'en portaient aucun -- contact.html, roi.html et leurs
// versions anglaises -- alors que chacune portait un <h2> unique qui tenait
// lieu de titre de page. Rien ne le signalait : le titre s'affichait, la
// hierarchie h2/h3 etait coherente, et `hierarchie-titres.test.js` verifie
// qu'aucun niveau n'est SAUTE, pas qu'un premier niveau existe.
//
// Le defaut dans l'autre sens -- deux <h1> -- n'existait sur aucune page, et
// il est garde ici quand meme : c'est la forme que prend le copier-coller
// d'un bloc de titre.
//
// CE QU'IL NE VOIT PAS, ET IL FAUT LE LIRE AVANT DE LUI FAIRE CONFIANCE :
//
//   1. Il compte une BALISE, pas un titre. Un <h1> vide, un <h1> qui ne
//      contient qu'une image sans alt, ou un <h1> dont le texte n'a rien a
//      voir avec la page le satisfont tous. Il ne lit pas le contenu.
//   2. Il ne dit rien du RENDU. Les quatre pages corrigees portent
//      `class="titre-niveau-2"`, qui leur rend les declarations du <h2>
//      (styles.css, pres de la regle `h2{}`) ; si cette classe disparaissait
//      de la feuille de style, le titre doublerait de taille a l'ecran et ce
//      garde resterait vert. Aucun test de ce depot ne compare un rendu.
//   3. Il ne regarde pas l'ORDRE : un <h1> place apres un <h2> dans le flux
//      lui convient.
// ---------------------------------------------------------------------------

const pages = pagesIndexables();
const comptes = pages.map((p) => ({ p, n: (lire(p).match(/<h1[\s>]/gi) || []).length }));

describe("titres — une page indexable porte exactement un h1", () => {
  // LES DEUX ASSERTIONS DE PERIMETRE. Un garde par ABSENCE qui n'inspecte
  // rien sort vert : `[].filter(...)` rend `[]`, et `expect([]).toEqual([])`
  // passe. C'est le defaut trouve le 20 octobre sur la reciprocite des
  // hreflang, ou 14 pages vivaient dans l'angle mort du filtre. Les deux
  // assertions ne disent pas la meme chose : la premiere attrape le balayage
  // casse, la seconde le perimetre qui maigrit sans qu'on le dise.
  it("le perimetre n'est pas vide", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it("le perimetre ne tombe pas sous les 140 pages indexables du 20 octobre 2026", () => {
    expect(pages.length).toBeGreaterThanOrEqual(PLANCHER);
  });

  it("aucune page indexable n'est sans h1", () => {
    expect(comptes.filter((c) => c.n === 0).map((c) => c.p)).toEqual([]);
  });

  it("aucune page indexable ne porte plus d'un h1", () => {
    expect(comptes.filter((c) => c.n > 1).map((c) => `${c.p} : ${c.n} h1`)).toEqual([]);
  });
});
