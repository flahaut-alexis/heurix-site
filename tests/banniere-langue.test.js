// La banniere qui propose l'autre langue, et les quatre choses qui peuvent en
// deriver separement.
//
// POURQUOI CE FICHIER EXISTE PLUTOT QU'UNE LIGNE DANS entete-structure.test.js.
// Ce garde-la compare la structure de toutes les pages entre elles, mais son
// releve demarre a `html.indexOf("<header")` : TOUT CE QUI PRECEDE <header>
// dans le <body> lui est invisible par construction. C'est exactement ou vit
// cette banniere. Le garde ecrit apres « le sélecteur de langue de six pages »
// ne verrait donc pas une banniere divergente sur six pages.
//
// LA SIXIEME VALEUR QUI EN DESIGNE UNE AUTRE. CLAUDE.md en compte cinq sur ce
// site -- hreflang, og:url, canonical, le selecteur de langue, les liens de
// sommaire -- et sa lecon est que chacune derive separement. Le href de la
// banniere est la sixieme. Il n'est pas laisse libre : le test 2 l'epingle au
// hreflang de sa propre page, qui reste la source.
//
// LA POPULATION EST DERIVEE, PAS ENUMEREE : « porte une paire hreflang fr+en »
// (126 pages au 6 septembre 2026). Une page qui gagne une paire doit gagner la
// banniere, une page qui la perd doit la perdre, et le test le dit sans qu'on
// tienne une liste a jour. Les 10 billets FR sans equivalent anglais en sont
// donc exclus d'office -- leur seul lien EN existant vise ../en/blog.html,
// l'index du blog, ou le visiteur atterrit sur une liste et pas sur son
// article. Une banniere qui les couvrirait proposerait cette liste-la.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

const pages = [];
const marcher = (dir) => {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) marcher(rel);
    else if (e.name.endsWith(".html")) pages.push(rel);
  }
};
marcher("");

const releve = new Map();
for (const f of pages) {
  const src = fs.readFileSync(path.join(RACINE, f), "utf8");
  const hreflang = Object.fromEntries(
    [...src.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
      .map((m) => [m[1], m[2]]));
  releve.set(f, { src, hreflang, appariee: !!(hreflang.fr && hreflang.en) });
}

const appariees = [...releve.keys()].filter((f) => releve.get(f).appariee);

// Le bloc entier, de la balise ouvrante au </script> qui suit la fermante.
const BLOC = /<aside class="langue-banniere"[\s\S]*?<\/aside>\n<script>([\s\S]*?)<\/script>/;
const chemin = (url) => url.replace("https://heurix.fr/", "") || "index.html";
const resoudre = (page, href) =>
  path.normalize(path.join(path.dirname(page), href)).split(path.sep).join("/");

describe("banniere de langue", () => {
  it("exactement les pages appariees la portent", () => {
    const manquantes = [], enTrop = [];
    for (const [f, { src, appariee }] of releve) {
      const porte = BLOC.test(src);
      if (appariee && !porte) manquantes.push(f);
      if (!appariee && porte) enTrop.push(f);
    }
    expect({ manquantes, enTrop }).toEqual({ manquantes: [], enTrop: [] });
    expect(appariees.length).toBeGreaterThan(0);
  });

  // LE POINT DE CE FICHIER. Reconstruire l'URL de l'autre langue en collant
  // « en/ » devant celle de la page marche pour 124 des 126, et se trompe sur
  // la seule paire dont le nom change en traversant : confidentialite.html
  // <-> en/privacy.html (mesure du 6 septembre 2026 ; mentions-legales.html
  // garde son nom des deux cotes, contrairement a ce que la symetrie du
  // couple suggere). Le hreflang, lui, porte deja la vraie cible.
  //
  // UNE SEULE PAIRE, C'EST LA RAISON D'ETRE DU TEST, PAS UN ARGUMENT CONTRE.
  // Un defaut qui ne touche que 2 pages sur 126 ne se voit pas a l'oeil sur un
  // echantillon, et la page qu'il casse est la politique de confidentialite --
  // celle que ce lot doit justement modifier.
  it("le href vise le fichier que le hreflang de la page designe", () => {
    const casse = [];
    for (const f of appariees) {
      const { src, hreflang } = releve.get(f);
      const m = /<a class="langue-banniere-lien" href="([^"]+)"/.exec(src);
      if (!m) { casse.push(`${f} : pas de lien`); continue; }
      const attendu = chemin(f.startsWith("en/") ? hreflang.fr : hreflang.en);
      const obtenu = resoudre(f, m[1]);
      if (obtenu !== attendu) casse.push(`${f} : href -> ${obtenu}, hreflang -> ${attendu}`);
      else if (!fs.existsSync(path.join(RACINE, obtenu)))
        casse.push(`${f} : ${obtenu} n'existe pas sur disque`);
    }
    expect(casse).toEqual([]);
  });

  // Duplique 126 fois, donc 126 occasions de deriver. Aucun garde du depot ne
  // regarde cette zone du <body> (voir l'en-tete) : celui-ci est le seul.
  it("l'extrait de decision est identique au caractere pres partout", () => {
    // « UNE SEULE VARIANTE » EST VRAI QUAND IL N'Y EN A AUCUNE. Sans la ligne
    // ci-dessous, ce test etait VERT sur main, ou les 126 pages partagent la
    // meme non-variante : « pas de banniere ». Il faut asserter que le cas se
    // pose encore avant d'asserter qu'il est bien traite.
    const sansBanniere = appariees.filter((f) => !BLOC.test(releve.get(f).src));
    expect(sansBanniere).toEqual([]);

    const variantes = new Map();
    for (const f of appariees) {
      const s = BLOC.exec(releve.get(f).src)[1];
      if (!variantes.has(s)) variantes.set(s, []);
      variantes.get(s).push(f);
    }
    const resume = [...variantes.values()].map((l) => `${l.length} page(s) : ${l[0]}`);
    expect(resume).toHaveLength(1);
  });

  // Le texte est dans la langue PROPOSEE, pas celle de la page : « Read this
  // page in English » sur une page francaise. Sans `lang` sur l'aside, un
  // lecteur d'ecran le prononce avec la voix de la page -- de l'anglais lu en
  // francais.
  it("l'aside declare la langue proposee, qui n'est pas celle du document", () => {
    const casse = [];
    for (const f of appariees) {
      const { src } = releve.get(f);
      const doc = /<html lang="([^"]+)"/.exec(src)?.[1];
      const aside = /<aside class="langue-banniere" id="langue-banniere" lang="([^"]+)"/.exec(src)?.[1];
      const attendu = f.startsWith("en/") ? "fr" : "en";
      if (doc === aside) casse.push(`${f} : aside lang="${aside}" == html lang="${doc}"`);
      else if (aside !== attendu) casse.push(`${f} : aside lang="${aside}", attendu "${attendu}"`);
    }
    expect(casse).toEqual([]);
  });

  // RIEN NE DOIT BOUGER APRES LE PREMIER RENDU. La banniere est dans le flux,
  // masquee par `hidden`, et revelee par un script SYNCHRONE place juste apres
  // elle : il s'execute avant le premier rendu, donc elle fait partie de la
  // premiere mise en page. Un `defer`, un `async`, ou un deplacement de ce
  // script en bas de page rendrait la revelation posterieure au rendu -- un
  // decalage de mise en page, celui que sept images ont ete mesurees pour
  // eviter. La position est donc l'invariant, pas un detail de rangement.
  it("est masquee, en flux avant <header>, et revelee par un script synchrone", () => {
    const casse = [];
    for (const f of appariees) {
      const { src } = releve.get(f);
      const bloc = BLOC.exec(src);
      if (!bloc) { casse.push(`${f} : pas de banniere`); continue; }
      const ouvrante = /<aside class="langue-banniere"[^>]*>/.exec(src)[0];
      if (!/\shidden>/.test(ouvrante)) casse.push(`${f} : l'aside n'est pas hidden`);
      const finBloc = bloc.index + bloc[0].length;
      const apres = src.slice(finBloc).trimStart();
      if (!apres.startsWith("<header")) casse.push(`${f} : <header> ne suit pas le bloc`);
      if (/<script[^>]+(defer|async)/.test(bloc[0])) casse.push(`${f} : script differe`);
    }
    expect(casse).toEqual([]);
  });
});
