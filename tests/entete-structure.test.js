import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// HUIT PROPAGATIONS EN UNE SEMAINE, TOUJOURS LE MEME GESTE (26 aout 2026) :
// une page est creee en copiant une VOISINE, jamais la meilleure. Un correctif
// applique a un sous-ensemble n'atteint donc ni les pages nees avant lui, ni
// celles nees apres.
//
//   hreflang de trois articles · index.html#tarifs sur 116 pages · le sommaire
//   du guide console · le selecteur de langue de six pages · la modale de
//   recherche absente de 20 pages · le lien mobile « Se connecter » absent de
//   77 pages · index.html#mission mort sur 76 pages · PrestaShop/WooCommerce/
//   Shopify absents du menu Developers de 77 pages.
//
// Les tests precedents fermaient chacun UN bloc apres coup. Celui-ci compare
// la STRUCTURE de l'en-tete de toutes les pages entre elles et echoue des
// qu'une diverge -- y compris pour un bloc qu'on n'a pas encore decouvert
// manquant.
//
// CE QU'IL NE FAIT PAS, ET C'EST VOULU : il ne dit pas QUELLE variante est la
// bonne. Trancher a la place de l'auteur figerait une decision que personne
// n'a prise. Signaler la divergence suffit.
//
// Il ignore le TEXTE, les HREF et la PROFONDEUR : un en-tete anglais et son
// equivalent francais ont la meme structure, et « ../../ » n'est pas une
// divergence. Ce que d'autres tests couvrent deja -- cibles, langues,
// prefixes -- n'est pas rejoue ici.
// ---------------------------------------------------------------------------

/**
 * Exceptions LEGITIMES, chacune avec sa raison. Une page qui diverge sans
 * figurer ici fait echouer le test ; une page qui y figure sans diverger le
 * fait echouer aussi -- une liste d'exceptions qu'on ne nettoie pas finit par
 * couvrir des defauts.
 */
const EXCEPTIONS = new Map([
  ["demo/index.html",
   "Boutique fictive de demonstration : en-tete a elle, classes en francais " +
   "(conteneur entete, marque, zone-recherche). Ce n'est pas le site Heurix."],
  ["demo/categorie.html",
   "Meme boutique fictive que demo/index.html, meme en-tete de faux " +
   "marchand : ni le menu Heurix, ni le selecteur de langue, ni la console."],
  ["console.html",
   "Espace connecte : nav-links-console au lieu de nav-links, selecteur " +
   "d'organisation, pas de menus deroulants produit. Le lien « Se connecter » " +
   "n'y aurait aucun sens."],
  ["en/console.html",
   "Meme espace connecte que console.html, meme structure : nav-links-console, " +
   "selecteur d'organisation, aucun menu deroulant produit."],
]);

function pagesHtml() {
  const sortie = [];
  const parcourir = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (e.name.endsWith(".html")) sortie.push(p);
    }
  };
  parcourir(RACINE);
  return sortie;
}

/** Structure seule : balise + class + id. Ni texte, ni href, ni profondeur. */
function squelette(html) {
  const i = html.indexOf("<header");
  const j = html.indexOf("</header>");
  if (i === -1 || j === -1) return null;
  const out = [];
  const re = /<(\w+)([^>]*)>/g;
  let m;
  const tete = html.slice(i, j + 9);
  while ((m = re.exec(tete)) !== null) {
    const cls = /class="([^"]*)"/.exec(m[2]);
    const id = /id="([^"]*)"/.exec(m[2]);
    out.push(m[1] + (cls ? ":" + cls[1] : "") + (id ? "#" + id[1] : ""));
  }
  return out.join("|");
}

function releve() {
  const parSquelette = new Map();
  for (const p of pagesHtml()) {
    const sq = squelette(fs.readFileSync(p, "utf8"));
    if (!sq) continue;
    const rel = path.relative(RACINE, p);
    if (!parSquelette.has(sq)) parSquelette.set(sq, []);
    parSquelette.get(sq).push(rel);
  }
  // La reference est la majorite -- pas une page designee, qui se perimerait
  // elle aussi.
  let reference = null;
  for (const [sq, ps] of parSquelette)
    if (!reference || ps.length > parSquelette.get(reference).length) reference = sq;
  return { parSquelette, reference };
}

describe("structure de l'en-tete — une seule reference", () => {
  it("aucune page ne diverge de la reference sans figurer dans les exceptions", () => {
    const { parSquelette, reference } = releve();
    const divergentes = [];
    for (const [sq, ps] of parSquelette) {
      if (sq === reference) continue;
      for (const p of ps) if (!EXCEPTIONS.has(p)) divergentes.push(p);
    }

    const aide = divergentes.length
      ? "\n\n" + divergentes.map((p) => `  ${p}`).join("\n") +
        "\n\n" +
        "L'en-tete de ces pages n'a pas la meme STRUCTURE que les autres.\n" +
        "Ce test ne dit pas laquelle est la bonne -- c'est a toi de regarder.\n" +
        "\n" +
        "  1. La page a ete creee en copiant une VOISINE plutot que la\n" +
        "     reference, et il lui manque un bloc ajoute depuis ?\n" +
        "     -> porte le bloc, comme sur les autres pages.\n" +
        "\n" +
        "  2. Sa divergence est VOULUE (espace connecte, page fictive,\n" +
        "     404) ?\n" +
        "     -> ajoute-la a EXCEPTIONS en haut de ce fichier, AVEC SA RAISON.\n" +
        "\n" +
        "Huit propagations en une semaine sont sorties du cas 1. Dans le\n" +
        "doute, c'est le cas 1.\n"
      : "";

    expect(divergentes, `Divergence(s) d'en-tete non justifiee(s).${aide}`).toEqual([]);
  });

  it("aucune exception n'est perimee : chacune diverge encore", () => {
    const { parSquelette, reference } = releve();
    const conformes = new Set(parSquelette.get(reference));
    const inutiles = [...EXCEPTIONS.keys()].filter((p) => conformes.has(p));
    expect(
      inutiles,
      "Ces pages figurent dans EXCEPTIONS mais ne divergent plus. Retire-les :" +
        " une exception qu'on ne nettoie pas finit par couvrir un vrai defaut."
    ).toEqual([]);
  });

  it("chaque exception porte une raison lisible", () => {
    const muettes = [...EXCEPTIONS.entries()]
      .filter(([, raison]) => !raison || raison.trim().length < 20)
      .map(([p]) => p);
    expect(muettes, "Exception sans raison : elle sera reconduite sans etre relue.").toEqual([]);
  });

  it("la reference est tenue par une large majorite des pages", () => {
    // Garde-fou contre l'inverse du defaut : si la « reference » devenait
    // minoritaire, le test validerait la derive au lieu de la signaler.
    const { parSquelette, reference } = releve();
    const total = [...parSquelette.values()].reduce((n, ps) => n + ps.length, 0);
    const part = parSquelette.get(reference).length / total;
    expect(part).toBeGreaterThan(0.9);
  });
});
