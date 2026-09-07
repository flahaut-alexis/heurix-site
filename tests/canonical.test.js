import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// UNE PAGE SE DECLARE CANONIQUE D'ELLE-MEME (27 aout 2026).
//
// Cinq pages declaraient une AUTRE page en canonical, et se retiraient donc
// de l'index a son profit :
//
//     produit.html      -> fonctionnalites.html
//     faq.html          -> fonctionnalites.html
//     prestashop.html   -> integrations.html
//     shopify.html      -> integrations.html
//     woocommerce.html  -> integrations.html
//
// Un audit externe en avait signale DEUX. Le balayage des 126 pages en a
// trouve cinq. Ce n'etait pas une consolidation deliberee : les trois pages
// plateformes portent chacune 380 a 404 mots et 0,20 de recouvrement lexical
// avec integrations.html -- des pages distinctes, effacees de l'index.
//
// Et les pages ANGLAISES etaient toutes correctes. Meme cas que les
// solutions/* deja documente dans CLAUDE.md : la version tardive est la plus
// juste, et c'est pourtant l'originale defectueuse qui sert de modele.
//
// PERIMETRE DERIVE : toutes les pages .html du depot. Aucune liste.
// ---------------------------------------------------------------------------

/**
 * Exceptions qui NE SE DERIVENT PAS, chacune avec sa raison.
 *
 * Les absences legitimes, elles, se derivent et ne figurent pas ici -- voir
 * `doitPorterUnCanonical()`. Sept des huit pages sans canonical portent
 * `noindex` dans leur balise robots, la huitieme n'est pas une page. Les
 * nommer aurait produit une liste de huit entrees qu'il aurait fallu tenir a
 * jour a chaque page ajoutee.
 */
const EXCEPTIONS = new Map([
  ["index.html",
   "Canonical racine « https://heurix.fr/ » et non « /index.html ». Les deux " +
   "URL servent un contenu identique (verifie au md5 le 27 aout 2026), et la " +
   "racine est la forme qu'un visiteur partage. C'est le seul cas du site ou " +
   "l'adresse canonique n'est pas le chemin du fichier."],
]);

const pages = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) parcourir(rel);
    else if (e.name.endsWith(".html")) pages.push(rel);
  }
})("");

const lire = (p) => fs.readFileSync(path.join(RACINE, p), "utf8");

/**
 * Deux raisons DERIVEES de ne pas porter de canonical, lisibles dans la page
 * elle-meme :
 *
 *  - `noindex` : une page qu'on demande aux moteurs d'ignorer n'a pas
 *    d'adresse canonique a declarer. Couvre 404, en/404, supervision et les
 *    quatre pages de la boutique de demonstration.
 *  - pas de `<html>` : un fragment n'est pas une page. Couvre
 *    downloads/heurix-conversion-snippet.html, qui est un extrait a coller.
 */
function doitPorterUnCanonical(source) {
  const robots = source.match(/<meta name="robots" content="([^"]*)"/i);
  if (robots && /noindex/i.test(robots[1])) return false;
  if (!/<html\b/i.test(source)) return false;
  return true;
}

const attendu = (p) => `https://heurix.fr/${p}`;

describe("canonical — chaque page se declare canonique d'elle-meme", () => {
  it("aucun canonical ne pointe vers une AUTRE page", () => {
    const faux = [];
    for (const p of pages) {
      const s = lire(p);
      if (EXCEPTIONS.has(p)) continue;
      const m = s.match(/<link rel="canonical" href="([^"]+)"/);
      if (m && m[1] !== attendu(p)) faux.push(`${p} -> ${m[1]}`);
    }
    expect(faux).toEqual([]);
  });

  it("og:url suit le canonical, jamais une autre page", () => {
    const faux = [];
    for (const p of pages) {
      const s = lire(p);
      if (EXCEPTIONS.has(p)) continue;
      const m = s.match(/<meta property="og:url" content="([^"]+)"/);
      if (m && m[1] !== attendu(p)) faux.push(`${p} -> ${m[1]}`);
    }
    expect(faux).toEqual([]);
  });

  it("toute page indexable porte un canonical", () => {
    const manquants = pages.filter((p) => {
      const s = lire(p);
      return doitPorterUnCanonical(s) && !/<link rel="canonical"/.test(s);
    });
    expect(manquants).toEqual([]);
  });

  // Une page noindex PEUT porter un canonical -- sept le font sur ce site, et
  // Google ignore simplement le signal. Ce qui ne doit pas arriver, c'est
  // qu'elle en declare un vers une AUTRE page : ce serait demander de ne pas
  // l'indexer tout en creditant une voisine, sans que rien ne l'ait decide.
  //
  // Premiere version de cette assertion : « aucune page noindex ne declare de
  // canonical ». Elle tombait sur sept pages qui le font toutes correctement,
  // vers elles-memes. Une assertion qui echoue sur le comportement majoritaire
  // et delibere mesure la convention, pas un defaut.
  it("une page noindex ne credite jamais une autre page", () => {
    const faux = [];
    for (const p of pages) {
      const s = lire(p);
      const robots = s.match(/<meta name="robots" content="([^"]*)"/i);
      if (!robots || !/noindex/i.test(robots[1])) continue;
      const m = s.match(/<link rel="canonical" href="([^"]+)"/);
      if (m && m[1] !== attendu(p)) faux.push(`${p} -> ${m[1]}`);
    }
    expect(faux).toEqual([]);
  });

  it("aucune exception n'est perimee : chacune diverge encore", () => {
    const perimees = [...EXCEPTIONS.keys()].filter((p) => {
      const m = lire(p).match(/<link rel="canonical" href="([^"]+)"/);
      return m && m[1] === attendu(p);
    });
    expect(perimees).toEqual([]);
  });

  it("chaque exception porte une raison lisible", () => {
    for (const [clef, raison] of EXCEPTIONS) {
      expect(raison.length, `${clef} : raison trop courte`).toBeGreaterThan(80);
      expect(raison, `${clef} : un renvoi n'est pas une raison`).not.toMatch(/^Idem\b/);
    }
  });

  // Un balayage qui n'examine rien passe au vert sans rien prouver.
  it("le balayage a reellement parcouru le site", () => {
    expect(pages.length).toBeGreaterThan(100);
    expect(pages.filter((p) => /<link rel="canonical"/.test(lire(p))).length)
      .toBeGreaterThan(100);
  });
});


// ---------------------------------------------------------------------------
// SITEMAP ET ROBOTS DOIVENT DIRE LA MEME CHOSE (27 aout 2026).
//
// Trouve en ecrivant les assertions ci-dessus : le sitemap declarait CINQ
// pages portant `noindex` -- bienvenue, cgv, confidentialite, en/console,
// mentions-legales -- et en OUBLIAIT quatre indexables, dont
// solutions/index.html dans les deux langues, liee depuis la navigation de
// tout le site.
//
// Les deux defauts n'ont pas le meme cout. Une page noindex dans le sitemap
// envoie deux signaux contradictoires, que Google tranche seul. Une page liee
// et absente du sitemap est une page qu'il trouve tard, ou pas.
//
// TOUT SE DERIVE, aucune liste : une page est indexable si elle porte une
// balise <html> et pas de `noindex`. C'est la meme lecture que celle qui
// dispense de canonical plus haut, appliquee a l'autre signal.
// ---------------------------------------------------------------------------

describe("sitemap — il declare exactement les pages indexables", () => {
  const sitemap = fs.readFileSync(path.join(RACINE, "sitemap.xml"), "utf8");
  // UNE URL EST NORMALISEE VERS SON FICHIER AVANT TOUTE COMPARAISON
  // (3 septembre 2026). « https://heurix.fr/ » et « .../index.html » designent
  // le meme fichier ; ce test comparait des CHAINES et imposait donc en
  // silence l'une des deux formes -- celle que la page d'accueil contredisait,
  // puisque son canonical declare la racine. Un garde qui derive du disque
  // n'a pas a trancher la forme de l'URL : il la normalise, comme le fait
  // deja `pages_du_sitemap()` dans scripts/index-recherche.py.
  const versFichier = (u) => (u === "" || u.endsWith("/") ? u + "index.html" : u);
  const declarees = [...sitemap.matchAll(/<loc>https:\/\/heurix\.fr\/([^<]*)<\/loc>/g)]
    .map((m) => versFichier(m[1]));
  const ensemble = new Set(declarees);

  const estIndexable = (p) => {
    const s = lire(p);
    if (!/<html\b/i.test(s)) return false;
    const robots = s.match(/<meta name="robots" content="([^"]*)"/i);
    return !(robots && /noindex/i.test(robots[1]));
  };

  it("aucune page noindex n'est declaree dans le sitemap", () => {
    const contradictoires = pages.filter((p) => !estIndexable(p) && ensemble.has(p));
    expect(contradictoires).toEqual([]);
  });

  it("aucune page indexable n'est absente du sitemap", () => {
    // index.html est declaree par la RACINE dans ce sitemap, et les autres
    // entrees par leur chemin de fichier. `versFichier` ramene les deux au
    // meme, donc cette assertion ne depend plus de la forme choisie.
    const oubliees = pages.filter((p) => estIndexable(p) && !ensemble.has(p));
    expect(oubliees).toEqual([]);
  });

  it("chaque URL declaree correspond a un fichier qui existe", () => {
    // Le `u &&` d'avant sautait l'URL racine, seule entree a normaliser :
    // la seule qui avait besoin d'etre verifiee etait la seule exemptee.
    const fantomes = declarees.filter((u) => !fs.existsSync(path.join(RACINE, u)));
    expect(fantomes).toEqual([]);
  });

  it("aucune URL n'est declaree deux fois", () => {
    const doubles = declarees.filter((u, i) => declarees.indexOf(u) !== i);
    expect([...new Set(doubles)]).toEqual([]);
  });

  it("le sitemap couvre reellement le site", () => {
    expect(declarees.length).toBeGreaterThan(100);
  });
});


// ---------------------------------------------------------------------------
// LES DEUX MEMBRES D'UNE PAIRE hreflang S'ACCORDENT SUR L'INDEXABILITE
// (7 septembre 2026).
//
// Signale comme « contradiction avec le sitemap » : cgv.html et
// mentions-legales.html seraient noindex ET declarees au sitemap. Remesure par
// URL exacte, la contradiction n'existe pas -- `aucune page noindex n'est
// declaree dans le sitemap` ci-dessus est vert, et il compte 0.
//
// Le releve d'origine testait l'appartenance PAR SOUS-CHAINE. « cgv.html »
// apparait dans « en/cgv.html », « mentions-legales.html » dans
// « en/mentions-legales.html », « console.html » dans
// « blog/guide-utilisation-console.html ». Les trois pages dites « au sitemap »
// sont les trois dont le nom est SUFFIXE d'une autre URL ; celles qui n'ont pas
// de porteur -- confidentialite.html, en/console.html -- sont ressorties
// « hors sitemap ». C'est exactement le faux positif deja mesure le 28 aout et
// ecrit dans CLAUDE.md, reproduit a l'identique.
//
// LE DEFAUT REEL EST L'AUTRE : sur 63 paires hreflang fr/en, trois etaient en
// desaccord sur `noindex` -- les trois paires legales. Le francais portait
// `noindex`, l'anglais aucune balise, et c'est donc l'ANGLAIS qui etait indexe
// et declare au sitemap. Meme contenu, deux traitements opposes.
//
// Pourquoi aucun garde ne l'a vu : le garde du sitemap lit chaque page SEULE et
// ne compare rien. hreflang-reciproque.test.js compare bien les deux membres,
// mais sur les liens de la grappe, pas sur ce qu'ils declarent aux moteurs. Un
// desaccord fr/en n'avait aucun instrument.
//
// PERIMETRE DERIVE des grappes hreflang, aucune liste : la paire se lit dans
// les pages. bienvenue et console sont noindex des DEUX cotes -- elles
// s'accordent, et ce garde n'a rien a leur dire.
// ---------------------------------------------------------------------------

describe("robots — une paire hreflang ne se traite pas differemment selon la langue", () => {
  const versFichierHreflang = (url) => url.replace("https://heurix.fr/", "") || "index.html";

  const grappes = new Map();
  for (const p of pages) {
    const s = lire(p);
    const hl = Object.fromEntries(
      [...s.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
        .map((m) => [m[1], m[2]]));
    if (hl.fr && hl.en) grappes.set(p, hl);
  }

  const directive = (p) => {
    const m = lire(p).match(/<meta name="robots" content="([^"]*)"/i);
    return m ? m[1] : null;
  };
  const estNoindex = (p) => /noindex/i.test(directive(p) || "");

  const paires = [];
  const vues = new Set();
  for (const [p, hl] of grappes) {
    const partenaire = versFichierHreflang(p.startsWith("en/") ? hl.fr : hl.en);
    if (!grappes.has(partenaire)) continue; // deja couvert par hreflang-reciproque
    const clef = [p, partenaire].sort().join(" <-> ");
    if (vues.has(clef)) continue;
    vues.add(clef);
    paires.push([p, partenaire, clef]);
  }

  it("les deux membres s'accordent sur noindex", () => {
    const desaccords = paires
      .filter(([a, b]) => estNoindex(a) !== estNoindex(b))
      .map(([a, b, clef]) =>
        `${clef} : ${a}=${directive(a) ?? "aucune balise robots"} / ${b}=${directive(b) ?? "aucune balise robots"}`);
    expect(desaccords).toEqual([]);
  });

  // Les six pages legales portaient TROIS formes pour une seule intention :
  // `noindex, follow` (cgv.html, seule du site), `noindex` (confidentialite,
  // mentions-legales) et rien du tout cote anglais. `follow` est la valeur par
  // defaut : il ne disait rien que l'absence ne disait deja. Les trois formes
  // n'etaient pas deliberees -- aucun commentaire nulle part ne les explique --
  // et la forme retenue est celle que la famille portait deja majoritairement.
  it("une paire noindex porte la MEME directive des deux cotes", () => {
    const divergentes = paires
      .filter(([a, b]) => estNoindex(a) && estNoindex(b))
      .filter(([a, b]) => directive(a) !== directive(b))
      .map(([a, b, clef]) => `${clef} : « ${directive(a)} » / « ${directive(b)} »`);
    expect(divergentes).toEqual([]);
  });

  // Sans ce temoin, les deux assertions ci-dessus passent au vert sur une liste
  // vide le jour ou la lecture des grappes casse.
  it("le balayage a reellement apparie les deux langues", () => {
    expect(paires.length).toBeGreaterThan(50);
    expect(paires.filter(([a, b]) => estNoindex(a) && estNoindex(b)).length)
      .toBeGreaterThan(0);
  });
});
