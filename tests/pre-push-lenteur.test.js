import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";

const RACINE = path.resolve(__dirname, "..");
const CROCHET = path.join(RACINE, "scripts/hooks/pre-push");
const FIXTURES = path.join(RACINE, "tests/fixtures");

// ---------------------------------------------------------------------------
// LE CROCHET DEVANT UNE LENTEUR DE VITEST (19 septembre 2026).
//
// Le crochet relance une fois la suite quand vitest ne sort en 1 que pour
// `[vitest-worker]: Timeout calling "onTaskUpdate"`, tous les tests verts. Le
// danger est dans l'autre sens : relancer -- ou pire, laisser passer -- une
// suite qui porte AUSSI un vrai rouge. C'est arrive au 3e des huit passages
// mesures, et c'est la fixture `vitest-lenteur-et-rouge.txt`.
//
// LES DEUX FIXTURES SONT DES SORTIES REELLES, pas des resumes ecrits a la
// main : la queue de deux passages de `npx vitest run` sous charge, le
// 19 septembre. Un tri eprouve sur un decor construit pour lui ne dit rien de
// ce que vitest imprime vraiment. Les deux variantes ci-dessous en derivent
// par une seule substitution, et le test verifie que la substitution a mordu.
//
// Chaque cas est un depot jetable dont CI.yml n'a qu'un bloc. Le bloc ajoute
// une ligne a `passages` a chaque execution : on compte ainsi les relances,
// au lieu de les deduire du texte imprime.
// ---------------------------------------------------------------------------

const seule = fs.readFileSync(path.join(FIXTURES, "vitest-lenteur-seule.txt"), "utf8");
const etRouge = fs.readFileSync(path.join(FIXTURES, "vitest-lenteur-et-rouge.txt"), "utf8");
const TIMEOUT = 'Error: [vitest-worker]: Timeout calling "onTaskUpdate"';

// Une autre erreur non rattachee a la place du timeout.
const autreErreur = seule.replace(TIMEOUT, "TypeError: fenetre.ouvrir is not a function");
// Deux erreurs non rattachees, dont une seule est le timeout.
const deuxErreurs = seule.replace(/^( *Errors +)1 error *$/m, "$12 errors");

// AUCUN `git` NE DOIT VOIR LES `GIT_*` DE L'APPELANT : voir le long
// commentaire de tests/pre-push-etiquettes.test.js, mesure en cassant le
// depot le 7 septembre 2026.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")),
);

const REFS = "refs/heads/x 1111111111111111111111111111111111111111 refs/heads/x 0000000000000000000000000000000000000000\n";

function lancer(bloc, fichiers) {
  const depot = fs.mkdtempSync(path.join(os.tmpdir(), "pre-push-lenteur-"));
  fs.mkdirSync(path.join(depot, ".github/workflows"), { recursive: true });
  fs.writeFileSync(path.join(depot, ".github/workflows/CI.yml"),
    `name: Fixture\non: [push]\njobs:\n  tests:\n    runs-on: ubuntu-latest\n    steps:\n` +
    `      - run: |\n${bloc.split("\n").map((l) => `          ${l}`).join("\n")}\n`);
  for (const [nom, contenu] of Object.entries(fichiers)) {
    fs.writeFileSync(path.join(depot, nom), contenu);
  }
  execFileSync("git", ["init", "-q"], { cwd: depot, env });
  if (!fs.existsSync(path.join(depot, ".git"))) {
    throw new Error(`le depot jetable n'a pas de .git : ${depot}`);
  }
  const r = spawnSync("bash", [CROCHET, "origin", "git@example:x/y.git"], {
    cwd: depot, env, input: REFS, encoding: "utf8",
  });
  const passagesF = path.join(depot, "passages");
  return {
    code: r.status,
    sortie: `${r.stdout || ""}${r.stderr || ""}`,
    passages: fs.existsSync(passagesF)
      ? fs.readFileSync(passagesF, "utf8").split("\n").filter(Boolean).length : 0,
  };
}

// Sort `f` en 1 aux `n` premiers passages, puis vert.
const echoueNFois = (f, n) =>
  `echo x >> passages\nif [ "$(wc -l < passages)" -le ${n} ]; then cat ${f}; exit 1; fi\necho vert`;

let lenteurPuisVert, lenteurDeuxFois, lenteurEtRouge, autre, deux;

beforeAll(() => {
  lenteurPuisVert = lancer(echoueNFois("s.txt", 1), { "s.txt": seule });
  lenteurDeuxFois = lancer(echoueNFois("s.txt", 99), { "s.txt": seule });
  lenteurEtRouge = lancer(echoueNFois("s.txt", 99), { "s.txt": etRouge });
  autre = lancer(echoueNFois("s.txt", 99), { "s.txt": autreErreur });
  deux = lancer(echoueNFois("s.txt", 99), { "s.txt": deuxErreurs });
});

describe("crochet pre-push — les variantes derivees ont bien change", () => {
  it("chaque substitution a mordu", () => {
    expect(autreErreur).not.toContain(TIMEOUT);
    expect(deuxErreurs).toMatch(/Errors +2 errors/);
    expect(deuxErreurs).toContain(TIMEOUT);
  });
});

describe("crochet pre-push — la lenteur seule est relancee, une fois", () => {
  it("lenteur puis relance verte : le push part", () => {
    expect(lenteurPuisVert.code, lenteurPuisVert.sortie).toBe(0);
    expect(lenteurPuisVert.passages).toBe(2);
    expect(lenteurPuisVert.sortie).toContain("INCONCLU");
    expect(lenteurPuisVert.sortie).toContain("989/989 tests et 89/89 fichiers");
    expect(lenteurPuisVert.sortie).toMatch(/OK .* :: echo x >> passages \(relance\)/);
    expect(lenteurPuisVert.sortie).toContain("tous les contrôles passent");
  });

  it("lenteur deux fois : refus, sous un nom qui n'est pas « un controle echoue »", () => {
    expect(lenteurDeuxFois.code).toBe(1);
    expect(lenteurDeuxFois.passages).toBe(2);
    expect(lenteurDeuxFois.sortie).toContain("n'a pas pu conclure, deux fois");
    expect(lenteurDeuxFois.sortie).not.toContain("un contrôle de la CI échoue");
  });
});

describe("crochet pre-push — tout le reste est un echec, sans relance", () => {
  it("timeout ET un vrai rouge (passage n°3 du 19 septembre) : refus immediat", () => {
    expect(lenteurEtRouge.code).toBe(1);
    expect(lenteurEtRouge.passages).toBe(1);
    expect(lenteurEtRouge.sortie).not.toContain("INCONCLU");
    expect(lenteurEtRouge.sortie).toContain("un contrôle de la CI échoue");
    // Le compte des rouges vient en tete du detail, avant la queue de sortie.
    expect(lenteurEtRouge.sortie).toContain("> Test Files  1 failed | 88 passed (89) ; Tests  1 failed | 988 passed (989)");
  });

  it("tous verts mais une autre erreur non rattachee : refus immediat", () => {
    expect(autre.code).toBe(1);
    expect(autre.passages).toBe(1);
    expect(autre.sortie).not.toContain("INCONCLU");
  });

  it("deux erreurs non rattachees dont un seul timeout : refus immediat", () => {
    expect(deux.code).toBe(1);
    expect(deux.passages).toBe(1);
    expect(deux.sortie).not.toContain("INCONCLU");
  });
});
