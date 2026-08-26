import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const CSS = fs.readFileSync(path.join(RACINE, "styles.css"), "utf8");

// ---------------------------------------------------------------------------
// Dix defauts de contraste en deux tours d'audit, tous la meme cause : un
// composant neuf pose color:var(--ink*) -- pense pour un fond blanc -- et
// personne ne dit sur quel fond il vit. Le prix de l'offre a 1,11:1, le logo
// du produit en pied de page sur 118 pages.
//
// Ce test ne mesure AUCUN contraste : il verifie qu'une DECISION a ete prise
// pour chaque composant. Les deux listes vivent dans styles.css, pas ici --
// une liste separee du code qu'elle decrit finit par diverger.
// ---------------------------------------------------------------------------

function sansCommentaires(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Selecteurs classes « vit sur fond clair », lus dans le bloc @fond-clair. */
function listeFondClair() {
  // lastIndexOf SEUL ETAIT FRAGILE (durci le 26 aout 2026). Le marqueur est
  // aussi cite en prose -- dans le commentaire qui precede la liste, et depuis
  // aujourd'hui dans celui qui explique pourquoi .post-body blockquote en a
  // ete retire. lastIndexOf tombait sur cette derniere mention, situee APRES
  // @fin-fond-clair, et la recherche du marqueur de fin renvoyait -1 : le test
  // ne trouvait plus la liste et declarait 300 composants non classes.
  // On retient donc la derniere occurrence QUI A UNE FIN APRES ELLE.
  let debut = -1, fin = -1;
  for (let i = CSS.indexOf("@fond-clair"); i !== -1; i = CSS.indexOf("@fond-clair", i + 1)) {
    const f = CSS.indexOf("@fin-fond-clair", i);
    if (f !== -1) { debut = i; fin = f; }
  }
  if (debut === -1 || fin === -1) return null;
  return new Set(
    CSS.slice(debut + "@fond-clair".length, fin)
      .split("\n").map((l) => l.trim()).filter(Boolean)
  );
}

/** Selecteurs poseurs de --ink*, et selecteurs deja couverts par une surcouche. */
function analyser() {
  const css = sansCommentaires(CSS);
  const poseurs = new Set(), couverts = new Set();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim(), corps = m[2];
    if (!sel || sel.startsWith("@")) continue;
    const poseInk = /color:\s*var\(--ink(?:-muted)?\)/.test(corps);
    for (let s of sel.split(",")) {
      s = s.split(/\s+/).join(" ").trim();
      if (!s) continue;
      if (s.startsWith("body.docs-dark ")) couverts.add(s.slice("body.docs-dark ".length));
      else if (poseInk) poseurs.add(s);
    }
  }
  return { poseurs, couverts };
}

describe("classement des composants par fond", () => {
  it("le bloc @fond-clair existe dans styles.css", () => {
    expect(listeFondClair(), "bloc @fond-clair introuvable dans styles.css").not.toBeNull();
  });

  it("tout composant posant --ink est classe : surcouche sombre OU liste fond-clair", () => {
    const { poseurs, couverts } = analyser();
    const fondClair = listeFondClair() || new Set();
    const orphelins = [...poseurs].filter((s) => !couverts.has(s) && !fondClair.has(s)).sort();

    // Le message doit dire QUOI FAIRE, pas seulement ce qui manque.
    const aide = orphelins.length
      ? "\n\n" + orphelins.map((s) => `  ${s}`).join("\n") +
        "\n\n" +
        `${orphelins.length} selecteur(s) posent color:var(--ink) ou var(--ink-muted)\n` +
        "sans qu'on sache sur quel fond ils vivent. Pour chacun, une des deux voies :\n" +
        "\n" +
        "  1. Il est pose sur le DEGRADE SOMBRE de la page ?\n" +
        "     Ajoute dans styles.css :  body.docs-dark <selecteur>{ color:#CDD2F0; }\n" +
        "     (#F5F6FF si c'est du texte fort : titre, <strong>, logo.)\n" +
        "\n" +
        "  2. Il vit dans une CARTE CLAIRE (fond blanc, #F7F8FC, lavande) ?\n" +
        "     --ink y est correct : ajoute le selecteur a la liste @fond-clair\n" +
        "     du bloc « CLASSEMENT DES COMPOSANTS PAR FOND », dans styles.css.\n" +
        "\n" +
        "Dans le doute, OUVRE LA PAGE et regarde : ce test verifie qu'une decision\n" +
        "a ete prise, pas qu'elle est juste.\n"
      : "";
    expect(orphelins, `Composant(s) non classe(s).${aide}`).toEqual([]);
  });

  it("la liste @fond-clair ne contient pas de selecteur mort", () => {
    const { poseurs, couverts } = analyser();
    const fondClair = listeFondClair() || new Set();
    // Un selecteur classe « fond clair » qui ne pose plus --ink, ou qui a
    // recu une surcouche sombre depuis, doit sortir de la liste : sinon elle
    // enfle et cesse d'etre lue.
    const morts = [...fondClair].filter((s) => !poseurs.has(s) || couverts.has(s)).sort();
    expect(morts,
      `Selecteur(s) a retirer de @fond-clair dans styles.css : ils ne posent plus ` +
      `--ink, ou ils ont recu une surcouche sombre depuis.\n${morts.map((s) => "  " + s).join("\n")}\n`
    ).toEqual([]);
  });
});
