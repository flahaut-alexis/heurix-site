import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RACINE = path.resolve(__dirname, "..");
const MANIFESTE = JSON.parse(fs.readFileSync(path.join(RACINE, "img/icones.json"), "utf8"));

// ---------------------------------------------------------------------------
// LES ICONES SONT DERIVEES, ET RIEN NE LE DISAIT (28 aout 2026).
//
// favicon-32.png et apple-touch-icon.png sont fabriquees depuis un SVG. Le
// lien n'existait que dans la tete de qui les avait faites une fois :
//
//     logo.svg              refait le 25 juillet 2026  (54142c73)
//     favicon-32.png        17 juillet 2026            (0b3ba22f)
//     apple-touch-icon.png  17 juillet 2026            (0b3ba22f)
//
// Cinq semaines pendant lesquelles l'onglet du navigateur a montre le dessin
// d'avant, sans qu'aucun test, aucune CI et aucun regard ne puisse le dire.
// C'est la meme famille que l'index de recherche avant son `--verifier` : un
// derive qui ne sait pas de quoi il derive ne peut pas se savoir perime.
//
// LE PERIMETRE VIENT DU MANIFESTE, PAS D'UNE LISTE ECRITE ICI. img/icones.json
// est lu par ce test ET par scripts/exporter-icones.py : ajouter une icone se
// fait a un seul endroit, et le garde suit sans qu'on y pense.
//
// LA DATE SE LIT DANS GIT, PAS SUR LE DISQUE. Un `mtime` est refait a chaque
// clone : sur un clone neuf, tous les fichiers datent de la meme seconde et un
// controle par mtime rendrait « a jour » sur un depot entierement perime.
// ---------------------------------------------------------------------------

const dateDernierCommit = (chemin) => {
  const s = execFileSync("git", ["log", "-1", "--format=%ct", "--", chemin],
                         { cwd: RACINE, encoding: "utf8" }).trim();
  return s ? Number(s) : null;
};

describe("icones derivees de logo.svg", () => {
  it("le manifeste declare au moins les deux icones du site", () => {
    expect(MANIFESTE.icones.length).toBeGreaterThanOrEqual(2);
    const png = MANIFESTE.icones.map((i) => i.png);
    expect(png).toContain("favicon-32.png");
    expect(png).toContain("apple-touch-icon.png");
  });

  it("chaque icone declaree, et sa source, existent sur le disque", () => {
    for (const i of MANIFESTE.icones) {
      expect(fs.existsSync(path.join(RACINE, i.png)), `${i.png} absent`).toBe(true);
      expect(fs.existsSync(path.join(RACINE, i.source)), `${i.source} absent`).toBe(true);
    }
  });

  // Un PNG de la bonne taille mais du mauvais dessin passe ici ; ce n'est pas
  // ce que cette assertion couvre. Elle attrape le cas ou l'on regenere a la
  // mauvaise taille -- 180 est une convention iOS, 32 est ce que les pages
  // declarent, et ni l'un ni l'autre n'est visible dans un diff.
  it("chaque icone a la taille que le manifeste declare", () => {
    for (const i of MANIFESTE.icones) {
      const d = fs.readFileSync(path.join(RACINE, i.png));
      expect(d.subarray(0, 8).toString("hex"), `${i.png} n'est pas un PNG`)
        .toBe("89504e470d0a1a0a");
      const largeur = d.readUInt32BE(16), hauteur = d.readUInt32BE(20);
      expect([largeur, hauteur], `${i.png}`).toEqual([i.taille, i.taille]);
    }
  });

  it("chaque icone porte la raison de sa source", () => {
    for (const i of MANIFESTE.icones) {
      expect(i.pourquoi.length, `${i.png} : raison trop courte`).toBeGreaterThan(80);
      expect(i.pourquoi, `${i.png} : un renvoi n'est pas une raison`).not.toMatch(/^(Idem|Voir)\b/);
    }
  });

  // LE CONTROLE QUI MANQUAIT.
  it("aucune icone n'a pris de retard sur sa source", () => {
    const perimees = [];
    for (const i of MANIFESTE.icones) {
      const source = dateDernierCommit(i.source), png = dateDernierCommit(i.png);
      if (source === null || png === null) continue;   // fichier pas encore commite
      if (source > png) {
        perimees.push(`${i.png} : ${i.source} a bouge apres lui ` +
                      `(${new Date(source * 1000).toISOString().slice(0, 10)} contre ` +
                      `${new Date(png * 1000).toISOString().slice(0, 10)}). ` +
                      `Regenerez : python3 scripts/exporter-icones.py`);
      }
    }
    expect(perimees).toEqual([]);
  });

  // ET LE GARDE DU GARDE. « Je n'ai rien trouve » et « je n'ai pas pu
  // regarder » sont deux reponses differentes, et une seule autorise a passer
  // au suivant -- c'est la distinction que scripts/index-recherche.py a du
  // apprendre le 27 aout, en sortant 2 plutot que 0.
  //
  // Sur un clone superficiel (`fetch-depth: 1`), l'unique commit AJOUTE tous
  // les fichiers a la meme seconde : `source > png` est alors faux partout, et
  // l'assertion ci-dessus passerait au vert sur un depot entierement perime.
  // Le job « Suite de tests » porte `fetch-depth: 0` depuis le 27 aout ; cette
  // assertion verifie que c'est toujours vrai plutot que de le supposer.
  it("l'historique permet REELLEMENT de dater — sinon on le dit", () => {
    const dates = MANIFESTE.icones.flatMap((i) => [dateDernierCommit(i.source),
                                                   dateDernierCommit(i.png)])
                                  .filter((d) => d !== null);
    expect(dates.length, "aucune date lisible : historique absent").toBeGreaterThan(0);
    const profondeur = execFileSync("git", ["rev-list", "--count", "HEAD"],
                                    { cwd: RACINE, encoding: "utf8" }).trim();
    expect(Number(profondeur),
      "clone superficiel : toutes les dates seraient egales et l'assertion de " +
      "retard passerait au vert sans rien avoir mesure. Utilisez fetch-depth: 0."
    ).toBeGreaterThan(1);
  });
});
