// Un garde de reciprocite ne peut pas comparer les pages entre elles.
// entete-structure.test.js le dit lui-meme : il signale la divergence et ne
// tranche pas laquelle est la bonne. Un defaut UNIFORME sur onze pages lui est
// donc invisible par construction -- c'est ce qui a laisse passer celui-ci.
//
// Celui-ci suit le lien et lit ce que la cible declare en retour.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.join(import.meta.dirname, "..");
const chemin = (url) => url.replace("https://heurix.fr/", "") || "index.html";

const grappes = new Map();
const marcher = (dir) => {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) marcher(rel);
    else if (e.name.endsWith(".html")) {
      const s = fs.readFileSync(path.join(RACINE, rel), "utf8");
      const hl = Object.fromEntries(
        [...s.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
          .map((m) => [m[1], m[2]]));
      if (hl.fr && hl.en) grappes.set(rel, hl);
    }
  }
};
marcher("");

describe("hreflang — la cible confirme la paire", () => {
  it("chaque page pointe vers une cible qui declare la MEME grappe", () => {
    const casse = [];
    for (const [f, hl] of grappes) {
      const partenaire = chemin(f.startsWith("en/") ? hl.fr : hl.en);
      const autre = grappes.get(partenaire);
      if (!autre) { casse.push(`${f} -> ${partenaire} : la cible ne declare pas de paire`); continue; }
      if (autre.fr !== hl.fr || autre.en !== hl.en)
        casse.push(`${f} declare {${hl.fr} | ${hl.en}} mais ${partenaire} declare {${autre.fr} | ${autre.en}}`);
    }
    expect(casse).toEqual([]);
  });

  it("x-default, quand il existe, vise le membre francais de sa propre grappe", () => {
    const casse = [];
    for (const [f, hl] of grappes)
      if (hl["x-default"] && hl["x-default"] !== hl.fr)
        casse.push(`${f} : x-default=${hl["x-default"]} mais fr=${hl.fr}`);
    expect(casse).toEqual([]);
  });
});
