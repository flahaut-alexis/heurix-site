import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { RACINE, PLANCHER } from "./pages-indexables.js";

// ---------------------------------------------------------------------------
// LE LIBELLE DE LA PALETTE EST LE <h1>, ET CE GARDE LE TIENT (20 octobre 2026).
//
// Deux surfaces, deux formes. Le <title> sert le resultat d'un moteur de
// recherche : depuis 1b50d0af il est borne a 60 caracteres et porte le suffixe
// de marque. La palette de recherche du site, elle, affiche le champ `t` de
// search-index-{fr,en}.json (search-engine.js, `poser(titre, item.t, query)`)
// et a besoin du titre editorial, celui qui montre le cas concret.
//
// Jusqu'a ce lot, `t` valait le <title> : les deux surfaces recevaient la
// meme chaine, et raccourcir l'une raccourcissait l'autre. Mesure du jour :
// les 140 libelles changent, dont 119 sur le texte et 21 par le seul suffixe
// de marque.
//
// CE GARDE REECRIT L'EXTRACTION, IL NE L'IMPORTE PAS, et c'est delibere : un
// temoin qui appelle la fonction qu'il surveille ne verifie que lui-meme. La
// regle est donc ecrite deux fois -- ici en JavaScript, dans
// `scripts/index-recherche.py` en Python -- et une divergence entre les deux
// sort en rouge. C'est le prix, et c'est le seul moyen d'etre un temoin.
//
// LA REGLE, identique des deux cotes : un <br> rend une espace, toute autre
// balise ne rend rien (trois <span> vivent dans les h1 des deux accueils, et
// « votre <span>metier</span>. » rendu avec une espace donnait
// « votre metier . »), les entites sont decodees, les espaces reduits.
// ---------------------------------------------------------------------------

const lireFichier = (p) => fs.readFileSync(path.join(RACINE, p), "utf8");

const decode = (x) =>
  x.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
   .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
   .replace(/&(eacute|egrave|agrave|ccedil|ocirc|icirc|ucirc|acirc|ecirc|euml|iuml|uuml);/g,
            (m) => ({ "&eacute;": "é", "&egrave;": "è", "&agrave;": "à", "&ccedil;": "ç",
                      "&ocirc;": "ô", "&icirc;": "î", "&ucirc;": "û", "&acirc;": "â",
                      "&ecirc;": "ê", "&euml;": "ë", "&iuml;": "ï", "&uuml;": "ü" }[m] || m));

/** Le <h1> d'une page, selon la regle ci-dessus. `null` s'il n'y en a pas. */
function h1De(chemin) {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(lireFichier(chemin));
  if (!m) return null;
  return decode(m[1].replace(/<br\b[^>]*>/gi, " ").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ").trim();
}

const INDEX = ["search-index-fr.json", "search-index-en.json"];
const charger = (f) => JSON.parse(lireFichier(f));

/** Les entrees de PAGE : celles dont le chemin ne porte pas d'ancre. */
const pagesDe = (index) => index.entrees.filter((e) => !e.p.includes("#"));
const ancresDe = (index) => index.entrees.filter((e) => e.p.includes("#"));

const toutesLesPages = INDEX.flatMap((f) => pagesDe(charger(f)));
const toutesLesAncres = INDEX.flatMap((f) => ancresDe(charger(f)));

describe("index de recherche — le libelle d'une page est son h1", () => {
  // Les deux assertions de perimetre. Sans elles, un index vide -- ou un
  // filtre `#` qui ne reconnaitrait plus rien -- laisserait tout vert.
  it("le perimetre n'est pas vide", () => {
    expect(toutesLesPages.length).toBeGreaterThan(0);
  });

  it("le perimetre couvre les 140 pages indexables du 20 octobre 2026", () => {
    // 77 entrees de page cote FR, 63 cote EN. Une page du sitemap absente des
    // deux index ferait tomber ce compte.
    expect(toutesLesPages.length).toBeGreaterThanOrEqual(PLANCHER);
  });

  it("chaque entree de page pointe vers un fichier du depot", () => {
    const absents = toutesLesPages
      .map((e) => e.p)
      .filter((p) => !fs.existsSync(path.join(RACINE, p)));
    expect(absents).toEqual([]);
  });

  it("le champ t de chaque entree de page est le h1 de cette page", () => {
    const ecarts = [];
    for (const e of toutesLesPages) {
      const h1 = h1De(e.p);
      if (h1 === null) { ecarts.push(`${e.p} : la page n'a plus de <h1>`); continue; }
      if (e.t !== h1)
        ecarts.push(`${e.p}\n      index : « ${e.t} »\n      h1    : « ${h1} »`);
    }
    expect(ecarts, "Lancez scripts/index-recherche.py (il a besoin du moteur).").toEqual([]);
  });

  it("aucun libelle de page n'est vide", () => {
    // Le generateur REFUSE d'ecrire un index qui en porterait un ; cette
    // assertion ferme le cas ou l'index serait ecrit autrement -- a la main,
    // par une fusion, par un rebase mal resolu. Les deux sont utiles : le
    // refus empeche, celui-ci constate.
    const vides = toutesLesPages.filter((e) => !e.t || !e.t.trim()).map((e) => e.p);
    expect(vides).toEqual([]);
  });

  it("une ancre garde son propre titre, et n'est pas jugee sur le h1", () => {
    // UNE ANCRE N'EST PAS UNE PAGE : son `t` est le texte de son <h2>/<h3>,
    // pas le h1 de sa page mere. Les confondre ferait rougir ce garde sur les
    // 140 ancres. Le compte est assure pour que le filtre `#` ne devienne pas
    // silencieusement vide -- auquel cas l'assertion du `t` ne verifierait
    // plus rien, et celle-ci non plus.
    expect(toutesLesAncres.length).toBeGreaterThan(100);
    expect(toutesLesAncres.every((e) => typeof e.t === "string" && e.t.trim())).toBe(true);
    expect(toutesLesAncres.every((e) => e.ancre === true)).toBe(true);
  });

  it("le champ e d'une ancre est le libelle de sa page mere, donc son h1", () => {
    // `e` SITUE la section pour qui la voit dans une liste : il porte le
    // libelle de la page parente, et il suit donc le meme changement.
    // 140 ancres passent du <title> au <h1> de leur page, et c'est coherent :
    // l'entree de la page et ses sections annoncent desormais la meme chose.
    // search-engine.js exclut `e` du classement d'une ancre (chercher « `e` NE
    // CLASSE PAS UNE ANCRE »), donc ce changement ne touche aucun score.
    const ecarts = [];
    for (const e of toutesLesAncres) {
      const mere = e.p.split("#")[0];
      const h1 = h1De(mere);
      if (h1 === null) { ecarts.push(`${mere} : plus de <h1>`); continue; }
      if (e.e !== h1) ecarts.push(`${e.p}\n      e  : « ${e.e} »\n      h1 : « ${h1} »`);
    }
    expect(ecarts).toEqual([]);
  });
});
