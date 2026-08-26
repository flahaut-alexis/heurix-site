import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// UN LIEN RELATIF DOIT ATTEINDRE UN FICHIER QUI EXISTE (27 aout 2026).
//
// Vingt-deux liens morts trouves d'un coup, dont les NEUF liens de
// telechargement des widgets cote anglais : un marchand anglophone qui
// cliquait « Download heurix-search.js » recevait un 404. Depuis toujours.
//
// La cause est celle que CLAUDE.md nomme deja -- on copie la voisine -- mais
// dans une forme qui echappe a tout le reste : une page anglaise recopiee
// d'une page francaise, a une profondeur de plus.
//
//   blog/guide-mise-en-route.html      ../downloads/x.js -> downloads/x.js    OK
//   en/blog/guide-mise-en-route.html   ../downloads/x.js -> en/downloads/x.js 404
//   solutions/index.html               ../logo.svg       -> logo.svg          OK
//   en/solutions/index.html            ../logo.svg       -> en/logo.svg       404
//
// POURQUOI RIEN NE LES VOYAIT :
//
//  - le clic ne les trouve pas, parce que personne ne clique les pages
//    anglaises. Toutes les verifications a l'ecran de ce depot sont parties
//    de la version francaise ;
//  - le controle de coherence des clefs de cache ne PEUT PAS les voir : il
//    normalise les « ../ » avant de comparer, donc en/solutions/../logo.svg
//    et blog/../logo.svg lui paraissent le meme actif. Il compare des
//    CHAINES. Ce n'est pas un defaut a corriger la-bas, c'est ce
//    controle-ci qui manquait. Les huit logos morts portaient d'ailleurs une
//    clef ?v= parfaitement coherente avec le reste du site ;
//  - un remplacement de texte peut reussir partout et mener nulle part.
//    D'ou la seule verification qui compte ici : resoudre le chemin depuis
//    le dossier de SA page, et demander au disque si le fichier est la.
//
// PERIMETRE DERIVE, JAMAIS ENUMERE : toutes les pages .html du depot, tous
// les href et src qu'elles portent. Aucune liste de pages, aucune liste
// d'extensions.
// ---------------------------------------------------------------------------

/**
 * Exceptions LEGITIMES, chacune avec sa raison, clef « page :: lien ».
 * Un lien mort absent d'ici fait echouer le test ; une exception dont le
 * lien resout desormais le fait echouer aussi.
 */
const EXCEPTIONS = new Map([
  ["about.html :: img/photo-alexis.jpg",
   "Emplacement volontaire, pas un lien casse : le fichier n'a jamais ete " +
   "depose. La page porte un onerror qui masque tout le <figure>, et son " +
   "commentaire dit pourquoi -- une image cassee ferait plus de mal qu'une " +
   "absence d'image. A retirer d'ici le jour ou la photo arrive dans img/."],
  ["en/about.html :: ../img/photo-alexis.jpg",
   "Meme emplacement volontaire que about.html. Le CHEMIN, lui, etait faux " +
   "-- « img/ » recopie de la page francaise, qui depuis en/ visait " +
   "en/img/. Corrige le 27 aout 2026 : deposer la photo reparera desormais " +
   "les deux pages, pas seulement la francaise."],
]);

/** Schemas qui ne designent pas un fichier du depot. */
const SCHEMA = /^(https?:|\/\/|mailto:|tel:|data:|javascript:)/;

const pages = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) parcourir(rel);
    else if (e.name.endsWith(".html")) pages.push(rel);
  }
})("");

/**
 * Un lien est ce qu'un VISITEUR peut suivre. Le code AFFICHE sur la page
 * n'en est pas un : les guides montrent `<script src="heurix-search.js">`
 * pour dire au marchand quoi coller chez lui, et integrations.html montre un
 * gabarit `${h.product.handle}`. Les deux vivent dans un <pre>, et aucune
 * occurrence n'existe ailleurs -- la regle se derive donc, au lieu de nommer
 * huit exceptions qu'il faudrait ensuite maintenir.
 */
function liensDe(page) {
  let s = fs.readFileSync(path.join(RACINE, page), "utf8");
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  s = s.replace(/<pre\b[\s\S]*?<\/pre>/g, "");
  const out = [];
  for (const m of s.matchAll(/(?:href|src)="([^"#][^"]*?)(?:\?[^"]*)?(?:#[^"]*)?"/g)) out.push(m[1]);
  return out;
}

const morts = [];
let examines = 0;
for (const page of pages) {
  for (const lien of liensDe(page)) {
    if (SCHEMA.test(lien)) continue;
    examines++;
    const cible = path.resolve(RACINE, path.dirname(page), lien);
    if (!fs.existsSync(cible)) morts.push({ page, lien, cible: path.relative(RACINE, cible) });
  }
}

describe("liens relatifs — la cible existe, pas seulement la chaine", () => {
  it("aucun lien mort en dehors des exceptions nommees", () => {
    const inattendus = morts.filter((m) => !EXCEPTIONS.has(`${m.page} :: ${m.lien}`));
    expect(inattendus.map((m) => `${m.page} :: ${m.lien} -> ${m.cible}`)).toEqual([]);
  });

  it("aucune exception n'est perimee : chacune est encore morte", () => {
    const vivantes = new Set(morts.map((m) => `${m.page} :: ${m.lien}`));
    const perimees = [...EXCEPTIONS.keys()].filter((k) => !vivantes.has(k));
    expect(perimees).toEqual([]);
  });

  it("chaque exception porte une raison lisible", () => {
    for (const [clef, raison] of EXCEPTIONS) {
      expect(raison.length, `${clef} : raison trop courte`).toBeGreaterThan(60);
      expect(raison, `${clef} : un renvoi n'est pas une raison`).not.toMatch(/^Idem\b/);
    }
  });

  // Un balayage qui n'examine rien passe au vert en ne prouvant rien. Si une
  // expression reguliere ci-dessus cesse de mordre, ce plancher le dit --
  // c'est le garde-fou que le controle de cache n'avait pas le jour ou il a
  // certifie « une seule clef sur tout le site » en n'en voyant que quatre.
  it("le balayage a reellement parcouru le site", () => {
    expect(pages.length).toBeGreaterThan(100);
    expect(examines).toBeGreaterThan(5000);
  });

  // C'est ce qui a fait sortir href="../javascript:void(0)" de en/console.html :
  // un prefixage « ../ » passe en masse sur la page anglaise avait prefixe un
  // schema. Le lien fonctionnait quand meme, son data-goto-pane interceptant
  // le clic -- donc rien ne l'aurait signale.
  it("un href javascript: n'est jamais prefixe par un chemin", () => {
    const malformes = [];
    for (const page of pages)
      for (const lien of liensDe(page))
        if (lien.includes("javascript:") && lien !== "javascript:void(0)")
          malformes.push(`${page} :: ${lien}`);
    expect(malformes).toEqual([]);
  });
});
