// ---------------------------------------------------------------------------
// LE SCHEMA DOIT DIRE AUX MACHINES CE QUE LA PAGE MONTRE AU LECTEUR.
//
// entete-structure.test.js et canonical.test.js verifient la page CONTRE
// ELLE-MEME : sa structure d'en-tete, son canonical, sa presence au sitemap.
// Aucun des deux ne peut voir un JSON-LD qui derive du contenu -- un headline
// qui n'est plus le titre, une date qui n'est plus celle affichee. Ce garde
// compare les deux declarations : celle faite au lecteur et celle faite aux
// machines.
//
// PERIMETRE DERIVE, PAS DE LISTE. Tout .html sous blog/ et en/blog/ doit
// porter le bloc. Un article ajoute sans schema fait echouer ce test au lieu
// de passer inapercu -- c'est la lecon des huit propagations d'aout, ou une
// page naissait en copiant une voisine et heritait de ce qui lui manquait.
//
// CE QUI EST VOLONTAIREMENT ABSENT DU SCHEMA, pour que personne ne le
// « comble » plus tard en croyant reparer un oubli :
//
//   dateModified -- la donnee n'existe pas. Aucune page ne declare de
//     revision, et la deriver du dernier commit ferait passer une correction
//     de typographie pour une mise a jour editoriale.
//
//   image -- techniquement disponible, mais les 68 articles portent LA MEME
//     og-image.png generique. Declarer une image de marque comme « l'image de
//     cet article » est faiblement vrai, 68 fois. Le champ reviendra le jour
//     ou les articles auront des illustrations propres, pas avant.
//
// LA DATE EST AU MOIS, ET C'EST LA PRECISION QUI EXISTE. Le kicker dit
// « Juillet 2026 » ; aucun nom de fichier ne porte de date. L'historique git
// en donne une au jour, et elle tombe dans le bon mois sur les 68 -- mais
// c'est la date d'entree du fichier dans le depot, pas une decision
// editoriale, et elle bouge au moindre rebase. « 2026-07 » est de l'ISO 8601
// a precision reduite : exactement ce que la page affirme, ni plus.
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.join(import.meta.dirname, "..");

const MOIS = {
  janvier: 1, "février": 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  "août": 8, septembre: 9, octobre: 10, novembre: 11, "décembre": 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

const texte = (h) =>
  h.replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();

// Perimetre derive de l'arborescence : aucune liste d'articles nulle part.
const articles = [];
for (const dir of ["blog", "en/blog"])
  for (const f of fs.readdirSync(path.join(RACINE, dir)).sort())
    if (f.endsWith(".html")) articles.push(`${dir}/${f}`);

const lire = (p) => fs.readFileSync(path.join(RACINE, p), "utf8");

const schemaDe = (s) => {
  for (const m of s.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d;
    try { d = JSON.parse(m[1]); } catch { continue; }
    for (const o of Array.isArray(d) ? d : [d])
      if (o["@type"] === "BlogPosting") return o;
  }
  return null;
};

describe("schema des articles — un BlogPosting sur chacun", () => {
  it("le balayage a reellement trouve les articles des deux langues", () => {
    expect(articles.filter((a) => a.startsWith("blog/")).length).toBeGreaterThan(30);
    expect(articles.filter((a) => a.startsWith("en/blog/")).length).toBeGreaterThan(25);
  });

  it("chaque article porte un bloc BlogPosting", () => {
    expect(articles.filter((a) => schemaDe(lire(a)) === null)).toEqual([]);
  });

  it("chaque bloc porte les champs retenus, non vides", () => {
    const manques = [];
    let examines = 0;
    for (const a of articles) {
      const o = schemaDe(lire(a));
      if (!o) continue;
      examines++;
      for (const c of ["headline", "description", "datePublished",
                       "inLanguage", "mainEntityOfPage", "author", "publisher"])
        if (!o[c] || (typeof o[c] === "string" && !o[c].trim()))
          manques.push(`${a} : ${c}`);
      if (o.author && o.author.url !== "https://heurix.fr/about.html")
        manques.push(`${a} : author.url doit viser about.html`);
    }
    expect(manques).toEqual([]);
    expect(examines).toBe(articles.length);
  });

  it("les champs ecartes le restent (dateModified, image)", () => {
    const intrus = [];
    let examines = 0;
    for (const a of articles) {
      const o = schemaDe(lire(a));
      if (!o) continue;
      examines++;
      for (const c of ["dateModified", "image"])
        if (c in o) intrus.push(`${a} : ${c} -- voir l'en-tete de ce fichier`);
    }
    expect(intrus).toEqual([]);
    expect(examines).toBe(articles.length);
  });
});

// UNE ASSERTION QUI SAUTE L'ARTICLE SANS SCHEMA PASSE A VIDE. Les sept
// assertions ci-dessous faisaient `continue` quand le bloc manquait : sur un
// blog entierement depourvu de schema, une seule virait au rouge et les six
// autres affirmaient un accord qu'elles n'avaient pas verifie. Chacune compte
// donc ce qu'elle a REELLEMENT examine et exige le compte complet -- meme
// discipline que « le balayage a reellement parcouru le site » dans
// canonical.test.js.
describe("schema des articles — il s'accorde avec ce que la page montre", () => {
  it("headline est le <h1> de la page", () => {
    const ecarts = [];
    let examines = 0;
    for (const a of articles) {
      const s = lire(a), o = schemaDe(s);
      if (!o) continue;
      examines++;
      const h1 = s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      if (!h1) { ecarts.push(`${a} : pas de <h1>`); continue; }
      if (o.headline !== texte(h1[1]))
        ecarts.push(`${a} : headline « ${o.headline} » != h1 « ${texte(h1[1])} »`);
    }
    expect(ecarts).toEqual([]);
    expect(examines).toBe(articles.length);
  });

  it("mainEntityOfPage est le canonical de la page", () => {
    const ecarts = [];
    let examines = 0;
    for (const a of articles) {
      const s = lire(a), o = schemaDe(s);
      if (!o) continue;
      examines++;
      const c = s.match(/<link rel="canonical" href="([^"]*)"/);
      if (!c) { ecarts.push(`${a} : pas de canonical`); continue; }
      if (o.mainEntityOfPage !== c[1])
        ecarts.push(`${a} : mainEntityOfPage ${o.mainEntityOfPage} != canonical ${c[1]}`);
    }
    expect(ecarts).toEqual([]);
    expect(examines).toBe(articles.length);
  });

  it("inLanguage est la langue declaree par <html lang>", () => {
    const ecarts = [];
    let examines = 0;
    for (const a of articles) {
      const s = lire(a), o = schemaDe(s);
      if (!o) continue;
      examines++;
      const l = s.match(/<html lang="([^"]*)"/);
      if (o.inLanguage !== l[1])
        ecarts.push(`${a} : inLanguage ${o.inLanguage} != lang ${l[1]}`);
    }
    expect(ecarts).toEqual([]);
    expect(examines).toBe(articles.length);
  });

  it("le mois de datePublished est celui du kicker", () => {
    const ecarts = [];
    let examines = 0;
    for (const a of articles) {
      const s = lire(a), o = schemaDe(s);
      if (!o) continue;
      examines++;
      const k = s.match(/<div class="kicker">([\s\S]*?)<\/div>/);
      if (!k) { ecarts.push(`${a} : pas de kicker`); continue; }
      const m = texte(k[1]).match(/(\p{L}+)\s+(20\d\d)/u);
      if (!m) { ecarts.push(`${a} : kicker sans mois « ${texte(k[1])} »`); continue; }
      const attendu = `${m[2]}-${String(MOIS[m[1].toLowerCase()]).padStart(2, "0")}`;
      // L'INVARIANT EST LE MOIS, PAS LA PRECISION. datePublished porte
      // desormais le jour et le fuseau -- Google refuse « 2026-07 » nu, deux
      // avertissements sur trois le disaient. On compare donc le prefixe
      // AAAA-MM, et on exige separement la forme complete pour qu'un retour
      // silencieux a la date nue ne passe pas.
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(o.datePublished))
        ecarts.push(`${a} : datePublished « ${o.datePublished} » n'est pas un ISO 8601 complet avec fuseau`);
      else if (o.datePublished.slice(0, 7) !== attendu)
        ecarts.push(`${a} : datePublished ${o.datePublished} hors du mois du kicker ${attendu}`);
    }
    expect(ecarts).toEqual([]);
    expect(examines).toBe(articles.length);
  });
});
