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
  ["en/demo/index.html",
   "Version anglaise de la boutique fictive (26 aout 2026). Chrome traduit, " +
   "catalogue et slugs de categorie laisses en francais : ils viennent de " +
   "l'API. Meme en-tete de faux marchand que sa version francaise."],
  ["en/demo/categorie.html",
   "Meme boutique fictive que en/demo/index.html, meme en-tete de faux " +
   "marchand traduit."],
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
      // docs/maquettes/ EST EXCLU, ET L'EXCLUSION S'AUTO-VERIFIE (28 aout 2026).
      //
      // Ces fichiers ne sont pas servis : ni sitemap, ni lien entrant, `noindex`
      // sur chacun. Ils n'ont donc pas l'en-tete du site -- ils portent un
      // `<header class="doc">` qui est le TITRE du document de travail, et que
      // `squelette()` confondait avec l'en-tete de page.
      //
      // Une exclusion muette se perime sans bruit : le jour ou une maquette
      // reproduirait l'en-tete du site pour la montrer en contexte, elle
      // sortirait du perimetre en silence. L'assertion « la raison de
      // l'exclusion tient toujours », plus bas, echoue si l'un de ces fichiers
      // porte un jour un vrai `nav-drop`.
      if (path.join(dir, e.name).includes("docs/maquettes")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (e.name.endsWith(".html")) sortie.push(p);
    }
  };
  parcourir(RACINE);
  return sortie;
}

/** Les maquettes exclues du balayage — pour que l'assertion puisse les relire. */
function maquettes() {
  const dossier = path.join(RACINE, "docs", "maquettes");
  if (!fs.existsSync(dossier)) return [];
  return fs.readdirSync(dossier)
    .filter((f) => f.endsWith(".html"))
    .map((f) => path.join(dossier, f));
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

  // ---------------------------------------------------------------------
  // L'EXCLUSION DE docs/maquettes/ SE VERIFIE ELLE-MEME.
  //
  // Une exclusion dans un motif ne nomme rien, ne produit aucune liste, et le
  // compte affiche a la fin ne compte que ce qu'elle a laisse passer. C'est
  // le defaut que `CLAUDE.md` documente sur `bust-cache.sh` -- une exclusion
  // juste le jour ou on l'ecrit, fausse ensuite, et rien qui le signale.
  //
  // Sa raison est verifiable en une ligne : ces fichiers ne portent pas
  // l'en-tete du site. Le jour ou une maquette la reproduirait -- pour la
  // montrer en contexte, par exemple -- elle sortirait du perimetre en
  // silence. Cette assertion l'empeche.
  it("la raison d'exclure docs/maquettes tient toujours", () => {
    const fautives = maquettes().filter((p) => {
      const html = fs.readFileSync(p, "utf8");
      return html.includes("nav-drop") || html.includes("header-top-inner");
    });
    expect(
      fautives.map((p) => path.relative(RACINE, p)),
      "ces maquettes portent desormais l'en-tete du site : l'exclusion de " +
      "docs/maquettes n'est plus justifiee, retire-la ou traite-les comme des pages"
    ).toEqual([]);
  });

  it("le balayage n'a pas vide docs/maquettes de son contenu", () => {
    // Une exclusion qui exclut TOUT passerait au vert en ne prouvant rien.
    expect(maquettes().length).toBeGreaterThanOrEqual(3);
  });
});
