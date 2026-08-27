import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const lire = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");

// ---------------------------------------------------------------------------
// LE TITRE DE CHAQUE PAGE SOLUTIONS DESIGNE SON SECTEUR (27 aout 2026).
//
// Les huit pages portaient le meme `<h1>` a un mot pres -- « X : la recherche
// qui comprend vos references » -- et le meme `<title>` -- « X — recherche et
// classement produits ». Mesure avant reecriture, similarite mediane entre
// deux pages :
//
//     <h1>      79,1 %  (FR)    79,7 %  (EN)
//     <title>   79,4 %          81,2 %
//
// Le `<title>` est celui que Google affiche. Huit resultats de recherche
// interchangeables pour huit requetes differentes.
//
// POURQUOI UN TEST, ET PAS SEULEMENT UNE RELECTURE. Le defaut ne vient pas
// d'un gabarit qui a vieilli, il vient de ce que chaque page est creee en
// copiant une voisine (CLAUDE.md). Il se reproduit donc a chaque nouveau
// pack, sans que rien ne le signale : `solutions/automobile.html`, creee le
// jour meme de cette reecriture, porte deja les deux anciennes formules.
//
// Ce test ne juge pas une formulation -- il refuse deux pages qui disent la
// meme chose, et il exige que les trois valeurs de titre restent d'accord.
// ---------------------------------------------------------------------------

const pagesDe = (dossier) =>
  fs.readdirSync(path.join(RACINE, dossier))
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((f) => `${dossier}/${f}`);

const TOUTES = [...pagesDe("solutions"), ...pagesDe("en/solutions")];

// LA LISTE D'EXCEPTIONS EST VIDE, ET C'EST LE RESULTAT LE PLUS UTILE DE CE
// FICHIER (27 aout 2026).
//
// La version proposee par la session qui a ecrit ce test en portait deux --
// `solutions/automobile.html` et sa version anglaise, creees quelques heures
// plus tot depuis une voisine qui portait encore les deux anciennes formules.
// Elle a choisi de NE PAS committer le test dans cet etat, pour deux raisons
// qu'il vaut la peine de garder : le poser aurait mis en echec un chantier en
// cours, et il aurait fallu pre-remplir la liste avec le travail d'un autre --
// c'est-a-dire ouvrir la liste de dettes que ce depot s'interdit.
//
// Les trois pages concernees ont donc ete differenciees AVANT que le test
// n'arrive, et il est pose sans exception. La troisieme assertion ci-dessous
// aurait de toute facon refuse la liste heritee : ces pages ne doublonnent
// plus, donc leurs exceptions etaient deja perimees a la seconde ou elles ont
// ete ecrites.
//
// Si une exception devient necessaire un jour, elle porte son nom et sa
// raison, et les deux assertions de fin la font sortir des qu'elle cesse de
// diverger.
const EXCEPTIONS = new Map([]);
const valeurs = (p) => {
  const s = lire(p);
  const un = (re, quoi) => {
    const m = s.match(re);
    expect(m, `${p} : ${quoi} absent`).not.toBeNull();
    return m[1].replace(/&amp;/g, "&").trim();
  };
  return {
    titre: un(/<title>([^<]*)<\/title>/, "<title>"),
    h1: un(/<h1>([^<]*)<\/h1>/, "<h1>"),
    og: un(/property="og:title" content="([^"]*)"/, "og:title"),
    tw: un(/name="twitter:title" content="([^"]*)"/, "twitter:title"),
  };
};

describe("titres des pages solutions", () => {
  // L'ECART DU 26 AOUT : six pages annoncaient « A propos d'Heurix » en
  // twitter:title parce que le gabarit venait de about.html. Verifie ici
  // plutot que suppose -- les trois valeurs sont trois chaines distinctes
  // dans le fichier, rien ne les derive l'une de l'autre.
  it("og:title et twitter:title valent le <title>", () => {
    for (const p of TOUTES) {
      const v = valeurs(p);
      expect(v.og, `${p} : og:title diverge du <title>`).toBe(v.titre);
      expect(v.tw, `${p} : twitter:title diverge du <title>`).toBe(v.titre);
    }
  });

  for (const [champ, libelle] of [["titre", "<title>"], ["h1", "<h1>"]]) {
    it(`aucun ${libelle} n'est repris d'une autre page`, () => {
      const parLangue = { fr: [], en: [] };
      for (const p of TOUTES) parLangue[p.startsWith("en/") ? "en" : "fr"].push(p);
      const doublons = [];
      for (const pages of Object.values(parLangue)) {
        const vus = new Map();
        for (const p of pages) {
          // Le nom du secteur est LEGITIMEMENT commun ; ce qui le suit ne
          // doit pas l'etre. On compare donc ce qui reste apres le « : ».
          const v = valeurs(p)[champ];
          const propre = (v.split(/\s*:\s*/).slice(1).join(" : ") || v)
            .replace(/\s*\|\s*Heurix\s*$/, "").trim().toLowerCase();
          if (vus.has(propre)) doublons.push(`${p} :: identique a ${vus.get(propre)} — « ${propre} »`);
          else vus.set(propre, p);
        }
      }
      expect(doublons.filter((d) => ![...EXCEPTIONS.keys()].some((e) => d.startsWith(`${e} ::`))))
        .toEqual([]);
    });
  }

  it("aucune exception n'est perimee : chacune est encore un doublon", () => {
    const encoreDoublon = new Set();
    for (const champ of ["titre", "h1"]) {
      for (const langue of ["fr", "en"]) {
        const pages = TOUTES.filter((p) => (p.startsWith("en/") ? "en" : "fr") === langue);
        const vus = new Map();
        for (const p of pages) {
          const v = valeurs(p)[champ];
          const propre = (v.split(/\s*:\s*/).slice(1).join(" : ") || v)
            .replace(/\s*\|\s*Heurix\s*$/, "").trim().toLowerCase();
          if (vus.has(propre)) encoreDoublon.add(p);
          else vus.set(propre, p);
        }
      }
    }
    const perimees = [...EXCEPTIONS.keys()].filter((p) => !encoreDoublon.has(p));
    expect(perimees, "a retirer de EXCEPTIONS : ces pages ne doublonnent plus").toEqual([]);
  });

  it("chaque exception porte une raison lisible", () => {
    for (const [clef, raison] of EXCEPTIONS) {
      expect(raison.length, `${clef} : raison trop courte`).toBeGreaterThan(80);
      expect(raison, `${clef} : un renvoi n'est pas une raison`).not.toMatch(/^(Idem|Voir)\b/);
    }
  });

  // Un balayage qui n'examine rien passe au vert en ne prouvant rien.
  it("le balayage a reellement parcouru les deux langues", () => {
    expect(TOUTES.filter((p) => !p.startsWith("en/")).length).toBeGreaterThanOrEqual(9);
    expect(TOUTES.filter((p) => p.startsWith("en/")).length).toBeGreaterThanOrEqual(9);
  });
});
