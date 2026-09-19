import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";

const RACINE = path.resolve(__dirname, "..");
const CROCHET = path.join(RACINE, "scripts/hooks/pre-push");
const FIXTURES = path.join(RACINE, "tests/fixtures");

// ---------------------------------------------------------------------------
// « JE N'AI PAS PU VERIFIER » N'EST PAS « UN CONTROLE ECHOUE », HORS CLONE
// SUPERFICIEL (19 septembre 2026).
//
// Le clone superficiel est refuse avant les blocs, sur l'etat du depot : voir
// pre-push-superficiel.test.js. Ce fichier-ci garde le cas que ce garde ne
// voit pas -- un depot a historique COMPLET mais d'un seul commit, ou
// `--is-shallow-repository` rend `false` et ou `index-recherche.py` date
// pourtant tous les articles de la meme seconde.
//
// LA FIXTURE EST UNE SORTIE REELLE, pas un resume ecrit a la main : celle de
// `python3 scripts/index-recherche.py --verifier` dans un depot d'un seul
// commit fabrique depuis une archive de main, le 19 septembre 2026
// (47 articles). Meme discipline que pre-push-lenteur.test.js.
//
// Chaque cas est un depot jetable dont CI.yml n'a qu'un ou deux blocs, et
// chaque bloc ajoute une ligne a `passages` : on COMPTE les executions, au
// lieu de les deduire du texte. Une incapacite ne se relance pas -- c'est la
// difference avec la lenteur, et c'est ce que `passages` prouve.
//
// Les depots jetables ont un commit et ne sont pas superficiels : le garde
// d'en haut ne s'y declenche pas, et un test l'affirme.
// ---------------------------------------------------------------------------

const incapacite = fs.readFileSync(
  path.join(FIXTURES, "index-recherche-historique-plat.txt"), "utf8");

// AUCUN `git` NE DOIT VOIR LES `GIT_*` DE L'APPELANT : voir le commentaire de
// tests/pre-push-etiquettes.test.js.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")),
);

const REFS = "refs/heads/x 1111111111111111111111111111111111111111 refs/heads/x 0000000000000000000000000000000000000000\n";

function lancer(blocs, fichiers) {
  const depot = fs.mkdtempSync(path.join(os.tmpdir(), "pre-push-superficiel-"));
  fs.mkdirSync(path.join(depot, ".github/workflows"), { recursive: true });
  const etapes = blocs.map((bloc) =>
    `      - run: |\n${bloc.split("\n").map((l) => `          ${l}`).join("\n")}\n`).join("");
  fs.writeFileSync(path.join(depot, ".github/workflows/CI.yml"),
    `name: Fixture\non: [push]\njobs:\n  tests:\n    runs-on: ubuntu-latest\n    steps:\n${etapes}`);
  for (const [nom, contenu] of Object.entries(fichiers)) {
    fs.writeFileSync(path.join(depot, nom), contenu);
  }
  execFileSync("git", ["init", "-q"], { cwd: depot, env });
  execFileSync("git", ["add", "-A"], { cwd: depot, env });
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@invalid",
                       "commit", "-q", "-m", "un"], { cwd: depot, env });
  const superficiel = execFileSync("git", ["rev-parse", "--is-shallow-repository"],
                                   { cwd: depot, env, encoding: "utf8" }).trim();
  const r = spawnSync("bash", [CROCHET, "origin", "git@example:x/y.git"], {
    cwd: depot, env, input: REFS, encoding: "utf8",
  });
  const passagesF = path.join(depot, "passages");
  return {
    superficiel,
    code: r.status,
    sortie: `${r.stdout || ""}${r.stderr || ""}`,
    passages: fs.existsSync(passagesF)
      ? fs.readFileSync(passagesF, "utf8").split("\n").filter(Boolean).length : 0,
  };
}

// Le script imprime son message sur stderr et sort en 2.
const CODE_2 = "echo x >> passages\ncat s.txt >&2\nexit 2";
// Le meme texte, mais le controle a conclu : le marqueur seul ne suffit pas.
const VERT_BAVARD = "echo x >> passages\ncat s.txt >&2\nexit 0";
// Un vrai rouge, sans marqueur.
const ROUGE = "echo x >> passages\necho 'index de recherche perime -- 3 ecarts' >&2\nexit 1";

let platCode2, vertBavard, rouge, lesDeux;

beforeAll(() => {
  platCode2 = lancer([CODE_2], { "s.txt": incapacite });
  vertBavard = lancer([VERT_BAVARD], { "s.txt": incapacite });
  rouge = lancer([ROUGE], {});
  lesDeux = lancer([CODE_2, ROUGE], { "s.txt": incapacite });
});

describe("crochet pre-push — un controle qui n'a pas pu verifier", () => {
  it("est nomme INCONCLU, pas ECHEC", () => {
    expect(platCode2.sortie, platCode2.sortie).toContain("INCONCLU");
    expect(platCode2.sortie).not.toMatch(/^ *ECHEC/m);
  });

  it("n'est pas relance : un clone ne se repare pas en reessayant", () => {
    expect(platCode2.passages).toBe(1);
  });

  it("refuse le push, et renvoie au message du bloc", () => {
    expect(platCode2.code).toBe(1);
    expect(platCode2.sortie).toContain("n'a pas pu vérifier ce qu'il garde");
    expect(platCode2.sortie).toContain("IMPOSSIBLE DE VERIFIER");
    expect(platCode2.sortie).toContain("un seul commit");
  });

  it("le depot du cas n'est pas superficiel : le garde d'en haut ne joue pas", () => {
    expect(platCode2.superficiel).toBe("false");
    expect(platCode2.sortie).not.toContain("CONTRÔLES INEXÉCUTABLES");
  });

  it("n'emprunte ni le message des vrais echecs, ni celui de la lenteur", () => {
    expect(platCode2.sortie).not.toContain("un contrôle de la CI échoue");
    expect(platCode2.sortie).not.toContain("n'a pas pu conclure, deux fois");
    expect(platCode2.sortie).not.toContain("machine est moins chargée");
  });
});

describe("crochet pre-push — ce que le marqueur ne doit pas emporter", () => {
  it("un controle vert qui imprime le marqueur reste vert", () => {
    expect(vertBavard.code, vertBavard.sortie).toBe(0);
    expect(vertBavard.sortie).toMatch(/^ *OK/m);
    expect(vertBavard.sortie).toContain("tous les contrôles passent");
  });

  it("un vrai rouge reste un ECHEC", () => {
    expect(rouge.code).toBe(1);
    expect(rouge.sortie).toMatch(/^ *ECHEC/m);
    expect(rouge.sortie).toContain("un contrôle de la CI échoue");
  });

  it("incapacite ET vrai rouge : le rouge l'emporte", () => {
    expect(lesDeux.code).toBe(1);
    expect(lesDeux.sortie).toContain("INCONCLU");
    expect(lesDeux.sortie).toContain("un contrôle de la CI échoue");
    expect(lesDeux.sortie).not.toContain("n'a pas pu vérifier ce qu'il garde");
  });
});
