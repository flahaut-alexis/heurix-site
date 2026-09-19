import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";

const RACINE = path.resolve(__dirname, "..");
const CROCHET = path.join(RACINE, "scripts/hooks/pre-push");

// ---------------------------------------------------------------------------
// UN CLONE SUPERFICIEL N'EST PAS UN CONTROLE QUI ECHOUE (19 septembre 2026).
//
// Mesure du jour, sur un clone `--depth 1` de main, propre et a jour : le
// crochet a refuse le push sous « PUSH REFUSE -- un controle de la CI echoue
// en local ». Rien n'echouait. Sans historique, `git log` date TOUS les
// fichiers de la meme seconde : le bloc de l'index l'a dit lui-meme
// (« IMPOSSIBLE DE VERIFIER ... clone SUPERFICIEL »), et six tests qui lisent
// l'historique sont tombes avec lui. Apres `git fetch --unshallow`, le meme
// clone passe en 0.
//
// C'est le defaut ferme la veille sur la lenteur de vitest, a un autre
// endroit : le crochet disait « ca a echoue » pour « je n'ai pas pu
// verifier ». Il a une sortie pour ca -- 2, « controles INEXECUTABLES » --
// et ne s'en servait que pour PyYAML manquant.
//
// LE CONTROLE EST EN TETE, AVANT LES BLOCS. Les faire tourner pour lire leur
// echec reviendrait a deduire la cause d'un symptome qui a plusieurs causes :
// un bloc rouge sur un clone superficiel peut aussi etre rouge pour une vraie
// raison. `git rev-parse --is-shallow-repository` repond sur l'etat du depot,
// pas sur un symptome, et il coute une milliseconde.
// ---------------------------------------------------------------------------

const FIXTURE = `name: Fixture
on: [push]
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - run: echo bloc-execute >> temoin-blocs.txt
`;

// Aucun `git` ne doit voir les `GIT_*` de l'appelant : voir le commentaire de
// tests/pre-push-etiquettes.test.js, mesure en cassant le depot partage.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")),
);
const git = (cwd, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8" });
const REFS = "refs/heads/x 1111111111111111111111111111111111111111 refs/heads/x 0000000000000000000000000000000000000000\n";

function lancer(depot) {
  const r = spawnSync("bash", [CROCHET, "origin", "git@example:x/y.git"], {
    cwd: depot, env, input: REFS, encoding: "utf8",
  });
  const temoin = path.join(depot, "temoin-blocs.txt");
  return {
    code: r.status,
    sortie: `${r.stdout || ""}${r.stderr || ""}`,
    blocsLances: fs.existsSync(temoin)
      ? fs.readFileSync(temoin, "utf8").split("\n").filter(Boolean).length : 0,
  };
}

let superficiel, complet;

beforeAll(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "pre-push-superficiel-"));
  const source = path.join(base, "source");
  fs.mkdirSync(path.join(source, ".github/workflows"), { recursive: true });
  git(base, "init", "-q", source);
  fs.writeFileSync(path.join(source, ".github/workflows/CI.yml"), FIXTURE);
  // DEUX COMMITS : `--depth 1` d'un depot qui n'en a qu'un ne rend pas un
  // clone superficiel. Sans le second, le decor ne porte pas la condition.
  git(source, "add", "-A");
  git(source, "-c", "user.name=test", "-c", "user.email=test@invalid", "commit", "-q", "-m", "un");
  fs.writeFileSync(path.join(source, "page.html"), "<html></html>\n");
  git(source, "add", "-A");
  git(source, "-c", "user.name=test", "-c", "user.email=test@invalid", "commit", "-q", "-m", "deux");

  const copie = path.join(base, "copie");
  git(base, "clone", "-q", "--depth", "1", `file://${source}`, copie);
  expect(git(copie, "rev-parse", "--is-shallow-repository").trim(),
    "le decor doit etre un clone superficiel").toBe("true");
  superficiel = lancer(copie);

  git(copie, "fetch", "-q", "--unshallow");
  expect(git(copie, "rev-parse", "--is-shallow-repository").trim()).toBe("false");
  fs.rmSync(path.join(copie, "temoin-blocs.txt"), { force: true });
  complet = lancer(copie);
});

describe("crochet pre-push — clone superficiel", () => {
  it("sort en 2 (inexecutable), pas en 1 (un controle echoue)", () => {
    expect(superficiel.code, superficiel.sortie).toBe(2);
  });

  it("ne lance aucun bloc : il n'y a rien a mesurer sur un clone sans historique", () => {
    expect(superficiel.blocsLances).toBe(0);
  });

  it("nomme la cause et le geste qui repare", () => {
    // Insensible a la casse : le message crie « SUPERFICIEL ». Une assertion
    // en minuscules a rendu zero sur un message qui le disait -- le meme
    // defaut d'instrument qu'un `grep` sans -i, vecu deux fois le meme jour.
    expect(superficiel.sortie).toMatch(/superficiel/i);
    expect(superficiel.sortie).toContain("git fetch --unshallow");
    expect(superficiel.sortie).not.toContain("un contrôle de la CI échoue");
  });

  it("temoin : le meme clone, une fois complet, passe et lance ses blocs", () => {
    expect(complet.code, complet.sortie).toBe(0);
    expect(complet.blocsLances).toBe(1);
  });
});
