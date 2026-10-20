import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.join(import.meta.dirname, "..");

// ---------------------------------------------------------------------------
// UN BLOC JSON-LD ILLISIBLE NE SE VOIT NULLE PART (20 octobre 2026).
//
// Le depot porte 263 blocs `application/ld+json` sur 147 pages. Une virgule
// en trop dans l'un d'eux ne casse rien de visible : la page s'affiche, les
// tests de contenu passent, le navigateur ignore le script en silence. Seul
// un robot le refuse, et il ne le dit a personne.
//
// Les gardes qui existaient lisaient CHACUN son type -- BlogPosting,
// BreadcrumbList, FAQPage, SoftwareApplication -- et leurs decodeurs
// avalaient l'echec de `JSON.parse` : `catch { out.push(null) }`, puis
// `.find(...)` sur un tableau de `null` ne trouve rien et la page sortait du
// perimetre. Un bloc casse devenait donc un bloc ABSENT, et un type non
// couvert -- Organization, WebSite, Person -- n'etait relu par personne.
//
// Celui-ci ne connait aucun type : il exige que CHAQUE bloc se decode, et
// porte @context et @type. C'est le seul garde du depot dont le perimetre
// est « tous les blocs ».
//
// CE QU'IL NE VOIT PAS, ET IL FAUT LE LIRE AVANT DE LUI FAIRE CONFIANCE :
// il ne verifie aucune VALEUR. Un `BlogPosting` dont le `headline` ne serait
// pas celui de la page lui est invisible -- c'est schema-article.test.js qui
// l'attrape. Un `@type` invente mais bien ecrit (« BlogPost ») passe : rien
// ici ne confronte le vocabulaire a schema.org. Il ferme la panne
// syntaxique, pas la panne de sens.
// ---------------------------------------------------------------------------

/** Toutes les pages HTML du depot. */
function pagesHtml(dir = RACINE, sortie = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) pagesHtml(p, sortie);
    else if (e.name.endsWith(".html")) sortie.push(p);
  }
  return sortie;
}

const rel = (abs) => path.relative(RACINE, abs).split(path.sep).join("/");

/** Les blocs BRUTS, non decodes -- c'est le decodage qui est le sujet. */
function blocsBruts(src) {
  return [
    ...src.matchAll(
      /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi
    ),
  ].map((m) => m[1]);
}

const releve = pagesHtml()
  .map(rel)
  .map((p) => ({ p, blocs: blocsBruts(fs.readFileSync(path.join(RACINE, p), "utf8")) }))
  .filter((x) => x.blocs.length);

const total = releve.reduce((n, x) => n + x.blocs.length, 0);

describe("JSON-LD — chaque bloc se decode et se nomme", () => {
  // MESURE DU 20 OCTOBRE 2026 : 263 blocs sur 147 pages. Le plancher est
  // sous la mesure, pas egal a elle -- il doit survivre au retrait d'une
  // page, pas figer un inventaire. Sans lui, un balayage qui ne trouve plus
  // rien (chemin change, extension changee, balise reecrite) rendrait toutes
  // les assertions ci-dessous vertes sur zero bloc.
  it("le balayage a reellement trouve les blocs du site", () => {
    expect(releve.length).toBeGreaterThanOrEqual(140);
    expect(total).toBeGreaterThanOrEqual(250);
  });

  it("chaque bloc est du JSON valide", () => {
    const casse = [];
    for (const { p, blocs } of releve)
      blocs.forEach((b, i) => {
        try {
          JSON.parse(b);
        } catch (e) {
          casse.push(`${p} bloc ${i + 1} : ${e.message}`);
        }
      });
    expect(casse, "Bloc JSON-LD illisible : un robot le refuse en silence.").toEqual([]);
  });

  it("chaque bloc porte @context et @type", () => {
    const manques = [];
    for (const { p, blocs } of releve)
      blocs.forEach((b, i) => {
        let o;
        try {
          o = JSON.parse(b);
        } catch {
          return; // deja signale par l'assertion precedente
        }
        const ou = `${p} bloc ${i + 1}`;
        // Le depot ne porte que des objets au premier niveau (mesure du
        // 20 octobre : 263 sur 263). Un tableau ou un `@graph` demanderait
        // une autre lecture, donc il est refuse ici plutot qu'ignore.
        if (Array.isArray(o) || typeof o !== "object" || o === null) {
          manques.push(`${ou} : le premier niveau n'est pas un objet`);
          return;
        }
        if (o["@context"] !== "https://schema.org")
          manques.push(`${ou} : @context « ${o["@context"]} », attendu https://schema.org`);
        const t = o["@type"];
        if (typeof t !== "string" || !t.trim())
          manques.push(`${ou} : @type absent ou vide`);
      });
    expect(manques).toEqual([]);
  });
});
