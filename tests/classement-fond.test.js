import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const CSS = fs.readFileSync(path.join(RACINE, "styles.css"), "utf8");
const { execFileSync } = require("node:child_process");

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

// ---------------------------------------------------------------------------
// LA MEME FAMILLE, POUR LES SVG (28 aout 2026).
//
// Le garde ci-dessus lit styles.css et ne connait pas les SVG. Or un schema
// pose lui aussi une couleur d'encre sans dire sur quel fond il vit -- et deux
// l'ont fait : `familles-moteurs.svg` et `deux-passes-automobile.svg` etaient
// TRANSPARENTS, avec un titre en #12142B, sur des pages a fond SOMBRE
// (`body.docs-dark`, section navy). Titre et libelles invisibles. Le premier
// est parti en production dans cet etat.
//
// Aucune mesure ne pouvait le voir : largeur, hauteur, debordement, chargement
// etaient tous bons. C'est une capture d'ecran qui l'a montre.
//
// LA REGLE SE TRANSPOSE. Un SVG qui pose une couleur de texte doit :
//   1. porter SON PROPRE FOND -- un rect qui couvre le viewBox, avec un fill ;
//   2. ou declarer ou il vit, par un marqueur `@fond-clair` / `@fond-sombre`
//      en commentaire dans le fichier.
//
// LE MARQUEUR VIT DANS LE SVG, pas dans une liste ailleurs : c'est la meme
// raison que pour @fond-clair dans styles.css -- une liste separee du fichier
// qu'elle decrit finit par diverger. Attention en l'ecrivant : `--` est
// INTERDIT dans un commentaire XML, alors que c'est le tiret utilise partout
// ailleurs dans ce depot.
//
// PERIMETRE DERIVE DES PAGES, pas une liste d'actifs. Un SVG que plus aucune
// page ne sert ne peut pas etre faux sur une page -- et le jour ou quelqu'un
// le reference, il entre dans le perimetre tout seul. Deux fichiers sont dans
// ce cas aujourd'hui : `prisme-marketing.svg`, mentionne nulle part, et
// `prisme-mise-en-route.svg`, remplace par un stepper CSS le 9 aout et
// mentionne seulement dans le commentaire qui l'a remplace.
// ---------------------------------------------------------------------------

const suivis = () =>
  execFileSync("git", ["ls-files"], { cwd: RACINE, encoding: "utf8" }).split("\n").filter(Boolean);

/** Les SVG reellement servis : ceux qu'au moins une page suivie reference. */
function svgServis() {
  const tous = suivis();
  const svgs = tous.filter((f) => f.endsWith(".svg"));
  const pages = tous.filter((f) => f.endsWith(".html"));
  const textes = pages.map((f) => fs.readFileSync(path.join(RACINE, f), "utf8"));
  return svgs.filter((svg) => {
    const nom = svg.split("/").pop();
    // Un nom peut etre porte par deux fichiers (la copie en/img/). On retient
    // le SVG des qu'une page cite son nom : le perimetre est volontairement
    // large, un faux positif ici coute un marqueur, un faux negatif coute une
    // page illisible.
    return textes.some((t) => t.includes(nom));
  });
}

/** Un SVG porte-t-il un fond a lui : un rect qui couvre tout le viewBox ? */
function porteSonFond(src) {
  const vb = src.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!vb) return false;
  const [, w, h] = vb;
  return [...src.matchAll(/<rect\b[^>]*>/g)].some(
    (m) => m[0].includes(`width="${w}"`) && m[0].includes(`height="${h}"`) && /fill="[^"]/.test(m[0])
  );
}

const poseDuTexte = (src) => /<(?:text|tspan)\b[^>]*fill="#[0-9A-Fa-f]{6}"/.test(src);
const marqueur = (src) => (src.match(/@fond-(clair|sombre)/) || [null])[0];

describe("classement des SVG par fond", () => {
  it("le perimetre est derive des pages, et il n'est pas vide", () => {
    const servis = svgServis();
    expect(servis.length, "aucun SVG servi trouve : le perimetre est casse").toBeGreaterThan(3);
  });

  it("tout SVG servi qui pose du texte porte son fond OU declare le sien", () => {
    const orphelins = svgServis()
      .filter((f) => {
        const src = fs.readFileSync(path.join(RACINE, f), "utf8");
        return poseDuTexte(src) && !porteSonFond(src) && !marqueur(src);
      })
      .sort();

    const aide = orphelins.length
      ? "\n\n" + orphelins.map((f) => `  ${f}`).join("\n") + "\n\n" +
        `${orphelins.length} schema(s) posent une couleur de texte sans qu'on sache\n` +
        "sur quel fond ils vivent. Pour chacun, une des deux voies :\n" +
        "\n" +
        "  1. QU'IL PORTE SON FOND -- c'est le defaut recommande pour un schema\n" +
        "     neuf. Un rect qui couvre le viewBox, juste apres </desc> :\n" +
        '     <rect x="0" y="0" width="W" height="H" rx="14" fill="#FFFFFF"\n' +
        '           stroke="#E7E9F2" stroke-width="1"/>\n' +
        "     Il se lit alors sur n'importe quelle section.\n" +
        "\n" +
        "  2. QU'IL DECLARE OU IL VIT, si on ne veut pas le changer. Un\n" +
        "     commentaire dans le fichier, avec la MESURE du fond de la page :\n" +
        "     <!-- @fond-clair : servi par X, dans .conteneur, fond mesure\n" +
        "          rgb(255,255,255) le JJ mois AAAA. -->\n" +
        "     (Pas de « -- » dans un commentaire XML : c'est interdit.)\n" +
        "\n" +
        "OUVRE LA PAGE et regarde : ce test verifie qu'une decision a ete prise,\n" +
        "pas qu'elle est juste.\n"
      : "";
    expect(orphelins, `Schema(s) SVG non classe(s).${aide}`).toEqual([]);
  });

  it("un SVG qui porte son fond ne garde pas un marqueur devenu inutile", () => {
    const morts = svgServis()
      .filter((f) => {
        const src = fs.readFileSync(path.join(RACINE, f), "utf8");
        return porteSonFond(src) && marqueur(src);
      })
      .sort();
    expect(morts,
      "Ce(s) SVG portent leur propre fond : le marqueur @fond-* n'a plus d'objet\n" +
      "et doit sortir du fichier, sinon il decrit une dependance qui n'existe plus.\n" +
      morts.map((f) => "  " + f).join("\n") + "\n"
    ).toEqual([]);
  });
});
