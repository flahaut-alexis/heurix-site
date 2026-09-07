import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// CE QUE LE SITE DIT DU COMPTAGE DES REQUETES (7 septembre 2026).
//
// MESURE SUR LE MOTEUR (heurix-engine 441d273), les deux compteurs lus avant
// et apres chaque geste -- pas une lecture du code, un relevé de ce que le
// compteur produit :
//
//     POST search                          recherche +1   Browse  0
//     POST search + simulate_overrides     recherche  0   Browse  0
//     POST items (indexation)              recherche  0   Browse  0
//     GET  browse (page de rayon)          recherche  0   Browse +1
//     POST federated-search, 2 catalogues  recherche +2   Browse  0
//     GET  stats / GET synonyms            recherche +1   Browse  0
//     DELETE items/{id}                    recherche +1   Browse  0
//     DELETE du catalogue entier           recherche  0   Browse  0
//     POST events, GET analytics/*         recherche  0   Browse  0
//
// Sur les 75 routes de GESTION du moteur, NEUF decomptent. Aucun critere ne
// les separe des 66 autres -- ni le verbe, ni le fichier, ni la nature de
// l'operation. C'est pour ca que la page ne peut PAS porter une regle
// generale : il n'y en a pas.
//
// CE QUE CE GARDE INTERDIT, ET POURQUOI CHAQUE PHRASE EST LA :
//
//  1. « 1 000 produits indexes = 10 requetes ». Regle d'avant le chantier
//     pricing. Le moteur ne decompte plus l'indexation, et le dit en toutes
//     lettres (routers/index.py). La phrase survivait dans SIX fichiers, dans
//     les deux langues, dont deux blocs JSON-LD que Google lit.
//
//  2. « Chaque appel a l'API de gestion (...) compte pour une requete ».
//     Vraie pour 9 routes sur 75. Et la page se contredisait elle-meme :
//     docs.html dit deja, endpoint par endpoint, que les actions de
//     configuration ne consomment pas.
//
// CE GARDE NE DIT PAS QUOI ECRIRE A LA PLACE. Il interdit deux affirmations
// mesurees fausses, rien de plus -- une page qui les remplace par une
// formulation exacte passe, quelle qu'elle soit.
// ---------------------------------------------------------------------------

const PUBLIES = execFileSync("git", ["ls-files"], { cwd: RACINE, encoding: "utf8" })
  .split("\n")
  .filter((f) => f && /\.(html|md|txt)$/.test(f));

const texte = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");

// Les deux affirmations mesurees fausses, chacune dans ses deux langues.
// Motifs SOUPLES sur les espaces et les separateurs de milliers : « 1 000 »,
// « 1,000 » et « 1000 » sont la meme phrase, et une version echappee en
// JSON-LD ne doit pas s'echapper du garde.
const INTERDITS = [
  {
    quoi: "l'indexation decompte le quota (regle retiree du moteur)",
    motif: /1\s*[  ,.]?\s*000\s+(produits\s+index[ée]s?|indexed\s+products)\s*=\s*10\s+(requ[êe]tes|requests)/i,
  },
  {
    quoi: "l'indexation d'un lot compte pour des requetes",
    motif: /Index(er|ing)\s+(un\s+lot\s+de|a\s+batch\s+of)\s+1\s*[  ,.]?\s*000\s+(produits|products)\s+(compte\s+pour|counts\s+as)/i,
  },
  {
    quoi: "regle generale « tout appel de gestion compte »",
    motif: /(Chaque\s+appel\s+[àa]\s+l['’]API\s+de\s+gestion|Every\s+call\s+to\s+the\s+management)[^.<]{0,60}(compte\s+pour\s+une\s+requ[êe]te|counts\s+as\s+one\s+request)/i,
  },
  {
    // LA MEME REGLE, ECRITE AVEC UN « = » ET SANS VERBE DE COMPTAGE.
    // Trouvee dans docs.html APRES le balayage, et RATEE par lui : le motif
    // exigeait un mot de la famille compter/consommer/count, et « Chaque
    // autre appel API (synonymes, stats, suppression...) = 1 requête » n'en
    // porte aucun. Troisieme trou d'instrument du lot, et le seul qui ne se
    // detectait pas par l'ecart FR/EN -- les deux langues l'avaient.
    quoi: "regle generale ecrite avec un « = » (forme sans verbe)",
    motif: /(Chaque\s+autre\s+appel\s+API|Every\s+other\s+API\s+call)[^<]{0,60}=\s*1\s+(requ[êe]te|request)/i,
  },
];

describe("comptage des requêtes — ce que le site affirme", () => {
  it.each(INTERDITS)("aucune page ne dit : $quoi", ({ motif }) => {
    const coupables = PUBLIES.filter((f) => motif.test(texte(f)));
    expect(coupables, `affirmation mesurée fausse, encore présente dans :\n  ${coupables.join("\n  ")}`)
      .toEqual([]);
  });

  // TEMOIN POSITIF. Sans lui, les trois tests ci-dessus passeraient au vert
  // le jour ou `PUBLIES` reviendrait vide, ou ou `texte()` rendrait "" --
  // et un garde qui ne lit rien ne refuse rien.
  it("le balayage lit vraiment les pages qu'il prétend lire", () => {
    expect(PUBLIES.length).toBeGreaterThan(150);
    expect(PUBLIES).toContain("pricing.html");
    expect(PUBLIES).toContain("en/pricing.html");
    // Une phrase VRAIE et stable de la meme section : si elle n'est pas
    // trouvee, c'est le balayage qui est casse, pas la page qui est propre.
    const temoin = PUBLIES.filter((f) =>
      /(compte\s+pour\s+une\s+requ[êe]te\s+Browse|counts\s+as\s+one\s+Browse\s+request)/i.test(texte(f)));
    expect(temoin.length).toBeGreaterThan(0);
  });

  // PAS DE GARDE DE SYMETRIE FR/EN ICI, ET C'EST UNE DECISION.
  //
  // L'ecart FR/EN a trouve DEUX trous d'instrument pendant ce lot, dans le
  // balayage qui a servi a etablir le perimetre : `consomme` ne trouvait ni
  // `consommé` ni `consume/consumed` (docs.html 22 contre en/docs.html 5),
  // puis `counts as` ne trouvait pas `Counting rules are public`
  // (faq.html 6 contre en/faq.html 2). Les deux trous etaient du cote
  // ANGLAIS : un balayage ecrit en francais rate l'anglais dans le sens qui
  // ne se voit pas -- il rend MOINS, pas plus.
  //
  // Excellent instrument de DECOUVERTE, mauvais garde permanent. Ecrit et
  // essaye : il rougissait sur faq.html (11 mentions contre 7), pour une
  // asymetrie reelle et sans consequence, avec un seuil de 0,35 choisi pour
  // qu'il passe -- c'est-a-dire calibre sur la reponse attendue. Et il est
  // REDONDANT : les trois tests ci-dessus balayent `git ls-files`, donc les
  // pages `en/` aussi. Une correction posee en francais et oubliee en
  // anglais les fait rougir deja, sans seuil a regler.
});
