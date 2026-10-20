// Un garde de reciprocite ne peut pas comparer les pages entre elles.
// entete-structure.test.js le dit lui-meme : il signale la divergence et ne
// tranche pas laquelle est la bonne. Un defaut UNIFORME sur onze pages lui est
// donc invisible par construction -- c'est ce qui a laisse passer celui-ci.
//
// Celui-ci suit le lien et lit ce que la cible declare en retour.
//
// ---------------------------------------------------------------------------
// CE GARDE AVAIT SON PROPRE ANGLE MORT, ET IL ETAIT PEUPLE (20 octobre 2026).
//
// Une page n'entre dans `grappes` que si elle declare `fr` ET `en`. Toute
// page qui declare AUTRE CHOSE sort donc du perimetre sans un mot, et les
// deux assertions tournent alors sur ce qui reste.
//
// Le cas degenere -- chaque page declare un hreflang vers ELLE-MEME et rien
// d'autre -- vide `grappes` entierement : les boucles ne s'executent plus,
// `expect([]).toEqual([])` passe, et le garde sort VERT sur un site dont pas
// une seule paire ne tient. Ce n'etait pas une hypothese : 14 articles de
// `blog/` etaient exactement dans cet etat, chacun avec un unique
// `hreflang="fr"` pointant sur lui-meme, et ce fichier n'en voyait aucun.
//
// Trois assertions ferment cela, et aucune ne remplace les deux autres :
//   - un PLANCHER sur la taille du perimetre (un balayage qui ne trouve plus
//     rien devient rouge au lieu de vert) ;
//   - le REFUS de l'auto-reference seule (le cas degenere nomme ci-dessus) ;
//   - l'EXISTENCE du fichier cible, qui ne se confond plus avec « la cible ne
//     declare pas de paire » : deux pannes, deux messages.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.join(import.meta.dirname, "..");
const chemin = (url) => url.replace("https://heurix.fr/", "") || "index.html";
const existe = (f) => fs.existsSync(path.join(RACINE, f));

const grappes = new Map();
/** Tous les liens hreflang declares, page par page -- perimetre non filtre. */
const tousLesLiens = [];
const marcher = (dir) => {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) marcher(rel);
    else if (e.name.endsWith(".html")) {
      const s = fs.readFileSync(path.join(RACINE, rel), "utf8");
      const paires = [...s.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
        .map((m) => [m[1], m[2]]);
      for (const [lang, href] of paires) tousLesLiens.push({ page: rel, lang, href });
      const hl = Object.fromEntries(paires);
      if (hl.fr && hl.en) grappes.set(rel, hl);
    }
  }
};
marcher("");

describe("hreflang — la cible confirme la paire", () => {
  // MESURE DU 20 OCTOBRE 2026 : 142 pages en grappe, 440 liens sur 156 pages
  // (puis 426 sur 142, les 14 auto-references ayant ete retirees le meme
  // jour). Le plancher est sous la mesure, pas egal a elle.
  it("le perimetre n'est pas vide -- sinon tout le reste est vert pour rien", () => {
    expect(grappes.size).toBeGreaterThanOrEqual(130);
  });

  it("chaque page pointe vers une cible qui declare la MEME grappe", () => {
    const casse = [];
    for (const [f, hl] of grappes) {
      const partenaire = chemin(f.startsWith("en/") ? hl.fr : hl.en);
      // « Le fichier n'existe pas » et « il existe mais ne declare pas de
      // paire » sont deux pannes differentes : les fondre sous un seul
      // message envoie chercher au mauvais endroit.
      if (!existe(partenaire)) { casse.push(`${f} -> ${partenaire} : la cible est ABSENTE du depot`); continue; }
      const autre = grappes.get(partenaire);
      if (!autre) { casse.push(`${f} -> ${partenaire} : la cible ne declare pas de paire`); continue; }
      if (autre.fr !== hl.fr || autre.en !== hl.en)
        casse.push(`${f} declare {${hl.fr} | ${hl.en}} mais ${partenaire} declare {${autre.fr} | ${autre.en}}`);
    }
    expect(casse).toEqual([]);
  });

  it("x-default, quand il existe, vise le membre francais de sa propre grappe", () => {
    const casse = [];
    for (const [f, hl] of grappes)
      if (hl["x-default"] && hl["x-default"] !== hl.fr)
        casse.push(`${f} : x-default=${hl["x-default"]} mais fr=${hl.fr}`);
    expect(casse).toEqual([]);
  });
});

describe("hreflang — ce qui est declare hors grappe", () => {
  it("aucune page ne declare un hreflang vers elle-meme et rien d'autre", () => {
    // LE CAS DEGENERE, NOMME. Une page sans contrepartie ne declare aucun
    // hreflang : `<html lang>` dit deja sa langue, et une grappe d'un seul
    // membre ne renseigne personne. Surtout, elle sort du perimetre de la
    // reciprocite sans que rien ne le signale.
    const parPage = new Map();
    for (const { page, lang, href } of tousLesLiens) {
      if (!parPage.has(page)) parPage.set(page, []);
      parPage.get(page).push({ lang, href });
    }
    const seules = [];
    for (const [page, liens] of parPage) {
      const cibles = new Set(liens.map((l) => chemin(l.href)));
      if (cibles.size === 1 && cibles.has(page)) seules.push(page);
    }
    expect(
      seules,
      "hreflang auto-referent seul : a retirer, ou a completer par sa contrepartie."
    ).toEqual([]);
  });

  it("chaque hreflang de page pointe vers un fichier du depot", () => {
    const absents = tousLesLiens
      .filter(({ href }) => href.startsWith("https://heurix.fr/"))
      .filter(({ href }) => !existe(chemin(href)))
      .map(({ page, lang, href }) => `${page} : hreflang=${lang} -> ${href}`);
    expect(absents).toEqual([]);
    expect(tousLesLiens.length).toBeGreaterThanOrEqual(400);
  });

  it("chaque alternate du sitemap pointe vers un fichier du depot", () => {
    // Le sitemap porte SES PROPRES declarations d'alternance (xhtml:link).
    // Elles se periment separement de celles des pages : un garde qui ne lit
    // que les pages laisse celles-la pourrir.
    const sm = fs.readFileSync(path.join(RACINE, "sitemap.xml"), "utf8");
    const liens = [...sm.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/g)];
    const absents = liens
      .filter((m) => !existe(chemin(m[2])))
      .map((m) => `sitemap.xml : hreflang=${m[1]} -> ${m[2]}`);
    expect(absents).toEqual([]);
    expect(liens.length).toBeGreaterThanOrEqual(60);
  });
});
