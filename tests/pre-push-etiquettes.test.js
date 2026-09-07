import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";

const RACINE = path.resolve(__dirname, "..");
const CROCHET = path.join(RACINE, "scripts/hooks/pre-push");

// ---------------------------------------------------------------------------
// CE QUE LE COMPTE RENDU DU CROCHET APPELLE UN BLOC (7 septembre 2026).
//
// POURQUOI CE TEST EXISTE. « SAUTÉ tests[2] » imprimé sous « OK tests ::
// tests[3] » a été lu trois fois en une semaine comme deux contrôles de tests
// dont l'un n'aurait pas tourné. Il n'y en a qu'un : `tests[2]` est `npm ci`.
// L'étiquette venait du repli que le crochet invente pour les étapes sans
// `name:` -- il rend désormais la COMMANDE, préambule écarté.
//
// POURQUOI IL LANCE LE CROCHET ET NE TESTE PAS SA FONCTION. Ce qu'on garde
// est le comportement observable : les lignes que lit un humain avant de
// pousser. Extraire la fonction `etiquette` pour l'appeler directement
// testerait l'implémentation, et laisserait passer une régression du FORMAT
// -- le préfixe `{job} ::` perdu, ou les lignes SAUTÉ remises sous le total
// qui prétend les compter. Les deux défauts du 7 septembre étaient dans le
// format, pas dans le calcul.
//
// POURQUOI UNE FIXTURE ET PAS `.github/workflows/CI.yml`. Le vrai fichier ne
// contient AUCUN cas qui exerce le garde `set -` : ses deux blocs qui
// commencent par `set -euo pipefail` portent tous deux un `name:`. Un garde
// qu'aucun cas n'exerce est un garde que la prochaine simplification retire
// sans rien casser de visible. La fixture ci-dessous porte ce cas deux fois,
// et l'assertion qui compte est qu'ils restent DISTINCTS : sans le garde,
// les deux s'appelleraient « set -euo pipefail ».
//
// Le crochet lit `./.github/workflows/CI.yml` sous `git rev-parse
// --show-toplevel` : on lui donne donc un dépôt jetable dont c'est la racine.
// Les blocs `run:` de la fixture sont des `echo`, et `npm ci` n'est jamais
// exécuté puisqu'il est précisément celui que le crochet saute.
// ---------------------------------------------------------------------------

const FIXTURE = `name: Fixture
on: [push]
jobs:
  alpha:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: echo alpha-deux
  beta:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          set -euo pipefail
          echo beta-premier
      - run: |
          set -euo pipefail
          echo beta-second
      - name: Un bloc nomme
        run: echo beta-nomme
      - run: |
          set -euo pipefail
          # aucune ligne parlante
`;

let sortie;
let code;
let lignes;

beforeAll(() => {
  // ─────────────────────────────────────────────────────────────────────────
  // AUCUN `git` DE CE FICHIER NE DOIT VOIR LES `GIT_*` DE L'APPELANT, ET CE
  // N'EST PAS UNE PRÉCAUTION (7 septembre 2026, mesuré en cassant le dépôt).
  //
  // `git push` pose `GIT_DIR` dans l'environnement du crochet pre-push, et
  // ce crochet lance `npx vitest run` : ces tests héritent donc de `GIT_DIR`,
  // et depuis un worktree lié il vaut `<dépôt>/.git/worktrees/<nom>`.
  //
  // Un `git init` lancé là-dessus depuis un cwd tiers NE CRÉE RIEN dans le
  // cwd : il réinitialise le `GIT_DIR` hérité, ne lui trouve pas d'arbre de
  // travail, et écrit `core.bare = true` dans la config PARTAGÉE par le
  // checkout principal et tous les worktrees. Le checkout principal répond
  // alors « fatal: this operation must be run in a work tree » à toute
  // commande qui a besoin d'un arbre -- dont `scripts/index-recherche.py`,
  // qui fait `git rev-parse --show-toplevel`.
  //
  // Le premier jet de ce fichier filtrait `GIT_*` pour le crochet et PAS pour
  // le `git init` : la suite était verte à la main, et le premier vrai
  // `git push` a cassé le dépôt de toutes les sessions. Un test qui ne voit
  // pas la variable ne peut pas la propager -- le filtre est donc construit
  // AVANT le premier `git`, et sert à tous.
  // ─────────────────────────────────────────────────────────────────────────
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")),
  );

  const depot = fs.mkdtempSync(path.join(os.tmpdir(), "pre-push-fixture-"));
  fs.mkdirSync(path.join(depot, ".github/workflows"), { recursive: true });
  fs.writeFileSync(path.join(depot, ".github/workflows/CI.yml"), FIXTURE);
  execFileSync("git", ["init", "-q"], { cwd: depot, env });
  // Le dépôt jetable doit être une racine à lui : si `git init` avait été
  // détourné, `.git` n'existerait pas et le crochet remonterait au dépôt
  // appelant. On le vérifie ici plutôt que de le supposer.
  if (!fs.existsSync(path.join(depot, ".git"))) {
    throw new Error(`le dépôt jetable n'a pas de .git : ${depot}`);
  }
  // Git envoie les références sur stdin ; un SHA non nul signifie « ce push
  // ajoute du contenu », par opposition à la suppression d'une branche que le
  // crochet laisse passer sans rien contrôler.
  const refs = "refs/heads/x 1111111111111111111111111111111111111111 refs/heads/x 0000000000000000000000000000000000000000\n";
  // `spawnSync` et non `execFileSync` : le compte rendu part sur STDERR, et
  // il faut le lire aussi bien quand le crochet sort en 0 qu'en 1 ou 2.
  const r = spawnSync("bash", [CROCHET, "origin", "git@example:x/y.git"], {
    cwd: depot, env, input: refs, encoding: "utf8",
  });
  code = r.status;
  sortie = `${r.stdout || ""}${r.stderr || ""}`;
  lignes = sortie.split("\n");
});

describe("crochet pre-push — étiquette des blocs sans name:", () => {
  it("les blocs de la fixture passent tous", () => {
    expect(code).toBe(0);
  });

  it("un bloc sans name: est nommé par sa commande, pas par son index", () => {
    expect(sortie).toContain("alpha :: echo alpha-deux");
    expect(sortie).not.toContain("alpha[3]");
  });

  it("le préambule est écarté : deux blocs `set -euo pipefail` restent distincts", () => {
    // L'ASSERTION QUI TIENT LE GARDE. Sans lui, ces deux lignes porteraient
    // la même étiquette « set -euo pipefail » et seraient indiscernables --
    // le défaut d'origine déplacé d'un cran, pas fermé.
    expect(sortie).toContain("beta :: echo beta-premier");
    expect(sortie).toContain("beta :: echo beta-second");
    expect(sortie).not.toContain(":: set -euo pipefail");
  });

  it("un `name:` présent l'emporte sur la commande", () => {
    expect(sortie).toContain("beta :: Un bloc nomme");
    expect(sortie).not.toContain("echo beta-nomme");
  });

  it("un run sans aucune ligne parlante retombe sur l'index, en dernier recours", () => {
    expect(sortie).toContain("beta :: beta[4]");
  });
});

describe("crochet pre-push — format de la ligne SAUTÉ", () => {
  it("elle porte le préfixe {job} :: comme les lignes OK et ECHEC", () => {
    const saute = lignes.filter((l) => l.includes("SAUTÉ"));
    expect(saute).toHaveLength(1);
    expect(saute[0]).toContain("alpha :: npm ci");
  });

  it("elle ne se lit plus comme un seuil numérique", () => {
    // « voir limite 3 » désignait le point 3 d'une liste de quatre, et se
    // lisait comme une limite de trois blocs. Il y en a cinq dans CI.yml ;
    // trois est le nombre de jobs.
    expect(sortie).not.toMatch(/limite 3/);
    expect(sortie).toContain("« CE QU'IL NE COUVRE PAS », point 3");
  });

  it("elle est imprimée AVANT le total qui prétend la compter", () => {
    const iSaute = lignes.findIndex((l) => l.includes("SAUTÉ"));
    const iTotal = lignes.findIndex((l) => l.includes("bloc(s) trouvé(s)"));
    expect(iSaute).toBeGreaterThanOrEqual(0);
    expect(iTotal).toBeGreaterThanOrEqual(0);
    expect(iSaute).toBeLessThan(iTotal);
  });

  it("le total couvre les blocs sautés autant que les autres", () => {
    // 6 blocs `run:` dans la fixture (2 sous `alpha`, 4 sous `beta`), dont 1
    // sauté : les deux comptes sont égaux, et le sauté figure dans la
    // population qu'ils annoncent au lieu d'en être retiré.
    expect(sortie).toContain("6 bloc(s) trouvé(s), 6 avec un compte rendu");
    expect(lignes.filter((l) => /^ {2}(OK|ECHEC|SAUTÉ)/.test(l))).toHaveLength(6);
  });
});
