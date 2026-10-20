import { describe, it, expect } from "vitest";
import { pagesIndexables, lire, PLANCHER, RACINE } from "./pages-indexables.js";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// TOUTE PAGE INDEXABLE DECLARE UNE IMAGE SOCIALE (20 octobre 2026).
//
// Aucune n'en manquait le jour ou ce garde est ecrit, et c'est dit ici parce
// que c'est la seule facon de ne pas le relire comme une reparation : les
// 19 pages sans `og:image` relevees ce jour-la sont 12 pages hors site
// (docs/maquettes/, demo/, en/demo/), 6 pages en noindex (404, bienvenue,
// console et leurs versions anglaises, supervision) et 1 fragment. Sur les
// 140 pages indexables, zero.
//
// IL EST ECRIT QUAND MEME, et pour une raison mesurable : les 19 ci-dessus
// montrent qu'une page peut naitre sans `og:image` dans ce depot. Les pages
// se creent par copie d'une voisine -- huit propagations en une semaine en
// aout 2026, documentees dans `entete-structure.test.js` -- et la voisine
// copiee n'est jamais la meilleure. Un garde pose sur une population saine
// garde sa prochaine naissance.
//
// CE QU'IL NE VOIT PAS, ET IL FAUT LE LIRE AVANT DE LUI FAIRE CONFIANCE :
//
//   1. Il ne va PAS CHERCHER l'image. Il verifie que le fichier existe dans
//      le depot quand l'URL est locale, et rien de plus : ni le poids, ni les
//      dimensions, ni que l'image soit lisible. Une og:image de 10 octets le
//      satisfait, et les reseaux sociaux la refuseraient.
//   2. Il ne juge pas la PERTINENCE. 139 des 140 pages declarent la meme
//      og-image.png generique ; cela vaut mieux qu'aucune, et c'est tout ce
//      que ce garde atteste.
//   3. Il ignore `twitter:image` et `og:image:width`, que certaines pages
//      portent et d'autres non. Aucun garde ne les couvre.
// ---------------------------------------------------------------------------

const pages = pagesIndexables();
const PREFIXE = "https://heurix.fr/";

describe("og:image — aucune page indexable n'est sans image sociale", () => {
  it("le perimetre n'est pas vide", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it("le perimetre ne tombe pas sous les 140 pages indexables du 20 octobre 2026", () => {
    expect(pages.length).toBeGreaterThanOrEqual(PLANCHER);
  });

  it("chaque page indexable declare une og:image", () => {
    const sans = pages.filter((p) => !/<meta property="og:image" content="[^"]+">/.test(lire(p)));
    expect(sans).toEqual([]);
  });

  it("chaque og:image locale pointe vers un fichier du depot", () => {
    const absentes = [];
    let locales = 0;
    for (const p of pages) {
      const m = /<meta property="og:image" content="([^"]+)">/.exec(lire(p));
      if (!m) continue;
      if (!m[1].startsWith(PREFIXE)) continue; // une URL externe ne se verifie pas ici
      locales++;
      const f = m[1].slice(PREFIXE.length).split("?")[0];
      if (!fs.existsSync(path.join(RACINE, f))) absentes.push(`${p} -> ${f}`);
    }
    expect(absentes).toEqual([]);
    // Sans ce plancher, une og:image devenue externe sur toutes les pages
    // viderait la boucle et laisserait l'assertion verte.
    expect(locales).toBeGreaterThanOrEqual(PLANCHER);
  });
});
