import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// GTM NE S'INJECTE QUE DEPUIS consent.js (6 septembre 2026).
//
// consent.js existe pour inverser une logique, et son en-tete le dit :
// « plus aucun traceur ne part avant un choix explicite, et GTM n'est injecte
// qu'apres acceptation de la categorie correspondante ».
//
// Seize pages le demontaient sans le savoir. Elles chargeaient consent.js en
// fin de <body> ET le conteneur GTM-PGLPLKDP en dur dans le <head>, avant
// toute action du visiteur :
//
//     en/solutions/{automobile,electricite,plomberie,sport}.html
//     solutions/{automobile,electricite,electronique,finance,index,industrie,
//                livres,mode,outillage,plomberie,sport,vins}.html
//
// Douze des seize sont sous solutions/, c'est-a-dire la totalite des pages
// francaises de l'actif SEO du site. Les huit pages anglaises correspondantes
// etaient saines -- la meme asymetrie FR/EN que CLAUDE.md documente, dans le
// sens ou c'est l'anglais qui est juste.
//
// POURQUOI AUCUN GARDE EXISTANT NE POUVAIT LE VOIR. consent.js porte bien un
// verrou, `gtmCharge`, mais c'est une variable locale a son IIFE : elle ne
// connait que ses propres injections. Le script du <head> tourne dans un autre
// contexte et n'a rien a consulter. Les deux chemins d'injection ne
// s'ignoraient pas par accident, ils n'avaient aucun moyen de se voir. Le
// module de consentement n'autorisait donc plus rien sur ces pages : il
// doublait un conteneur deja parti.
//
// PERIMETRE DERIVE : tout ce que le navigateur execute -- .html et .js --
// balaye depuis l'arbre. Aucune liste de seize pages, qui se perimerait a la
// dix-septieme.
// ---------------------------------------------------------------------------

/**
 * Le domaine suffit a identifier une injection : gtm.js comme ns.html.
 *
 * Il est ASSEMBLE, et pas ecrit d'un bloc, pour que ce fichier ne se designe
 * pas lui-meme comme fautif -- le balayage porte sur tout l'arbre, tests
 * compris. L'alternative aurait ete d'exclure `tests/` du perimetre, donc
 * d'ouvrir une zone ou le motif redeviendrait invisible.
 */
const TRACEUR = "googletagmanager" + ".com";

/**
 * La seule exception, et elle porte sa raison plutot qu'un renvoi.
 *
 * consent.js EST le module de consentement : il doit nommer le domaine pour
 * pouvoir l'injecter apres un choix. C'est le point unique par lequel GTM a le
 * droit d'entrer, et c'est ce que ce test protege.
 */
const AUTORISE = "consent.js";

const fichiers = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) parcourir(rel);
    else if (e.name.endsWith(".html") || e.name.endsWith(".js")) fichiers.push(rel);
  }
})("");

const lire = (p) => fs.readFileSync(path.join(RACINE, p), "utf8");

describe("GTM n'entre que par le module de consentement", () => {
  // TEMOIN POSITIF, pose AVANT de lire le resultat du balayage. Sans lui,
  // « aucune page fautive » et « le balayage n'a rien lu » ont exactement la
  // meme sortie -- et c'est la sortie rassurante qui s'impose.
  it("le balayage retrouve l'occurrence dont on sait qu'elle existe", () => {
    expect(fichiers).toContain(AUTORISE);
    expect(lire(AUTORISE)).toContain(TRACEUR);
  });

  // TEMOIN NEGATIF : un fichier servi qui ne doit rien contenir. Il separe
  // « le detecteur trouve sa cible » de « le detecteur repond a tout ».
  it("le balayage ne voit pas le traceur la ou il n'est pas", () => {
    expect(fichiers).toContain("index.html");
    expect(lire("index.html")).not.toContain(TRACEUR);
  });

  it("aucun autre fichier servi ne charge GTM", () => {
    const fautifs = fichiers
      .filter((f) => f !== AUTORISE)
      .filter((f) => lire(f).includes(TRACEUR));

    expect(fautifs,
      `${fautifs.length} fichier(s) chargent GTM hors de ${AUTORISE}. `
      + `Un conteneur injecte ailleurs part avant tout choix du visiteur, et `
      + `le verrou \`gtmCharge\` de ${AUTORISE} ne peut pas le voir.`,
    ).toEqual([]);
  });
});
