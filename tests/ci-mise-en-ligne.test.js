import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const CI = fs.readFileSync(path.join(RACINE, ".github/workflows/CI.yml"), "utf8");

// ---------------------------------------------------------------------------
// LA MISE EN LIGNE ATTEND TOUTE LA CI (19 septembre 2026).
//
// Le job `deploiement` de CI.yml ne publie que si les jobs de `needs` sont
// verts. Un job AJOUTE a CI.yml sans entrer dans `needs` tournerait en
// parallele de la mise en ligne, exactement comme toute la CI le faisait en
// mode « branche » : la porte se rouvrirait pour lui, sans rien de visible.
//
// LECTURE PAR LA MISE EN PAGE, PAS PAR UN ANALYSEUR YAML. Le cote Node n'en a
// pas, et PyYAML n'est pas garanti sur le runner du job « Suite de tests ».
// Le test exige donc la forme ecrite aujourd'hui -- ids de jobs a deux
// espaces sous `jobs:`, `needs: [a, b]` sur une ligne -- et ECHOUE si elle
// change, plutot que de passer sans avoir rien lu. Les temoins ci-dessous
// verifient qu'il a bien lu les jobs connus.
// ---------------------------------------------------------------------------

const blocJobs = CI.slice(CI.search(/^jobs:\s*$/m));
const ids = [...blocJobs.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)].map((m) => m[1]);
const debutDeploiement = blocJobs.search(/^ {2}deploiement:\s*$/m);
const finDeploiement = (() => {
  const suite = blocJobs.slice(debutDeploiement + 1).search(/^ {2}[A-Za-z0-9_-]+:\s*$/m);
  return suite < 0 ? blocJobs.length : debutDeploiement + 1 + suite;
})();
const deploiement = blocJobs.slice(debutDeploiement, finDeploiement);
const needs = (deploiement.match(/^ {4}needs: \[([^\]]*)\]\s*$/m) || [, ""])[1]
  .split(",").map((s) => s.trim()).filter(Boolean);

describe("CI.yml — la mise en ligne attend toute la CI", () => {
  it("temoins : les jobs connus sont lus", () => {
    expect(ids).toEqual(expect.arrayContaining(["index-recherche", "tests", "cache-busting", "deploiement"]));
    expect(debutDeploiement).toBeGreaterThan(0);
    expect(needs.length, "ligne `needs: [...]` introuvable dans le job deploiement").toBeGreaterThan(0);
  });

  it("`needs` couvre tous les autres jobs, et rien d'autre", () => {
    expect([...needs].sort()).toEqual(ids.filter((j) => j !== "deploiement").sort());
  });

  it("ne publie que sur un push de main", () => {
    expect(deploiement).toMatch(
      /^ {4}if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'\s*$/m);
  });

  it("verifie le mode de Pages AVANT de publier", () => {
    const iMode = deploiement.indexOf("pages.build_type !== \"workflow\"");
    const iPublie = deploiement.indexOf("actions/deploy-pages@");
    expect(iMode, "controle du mode absent").toBeGreaterThan(0);
    expect(iPublie, "deploy-pages absent").toBeGreaterThan(0);
    expect(iMode).toBeLessThan(iPublie);
  });

  it("n'a aucun `run:` : le crochet pre-push ne doit rien en rejouer", () => {
    expect(deploiement).not.toMatch(/^ {6,}(- )?run:/m);
  });
});
