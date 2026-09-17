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
//   dateModified, SAUF SUR UNE PAGE QUI DECLARE SA REVISION. La deriver du
//     dernier commit ferait passer une correction de typographie pour une
//     mise a jour editoriale : mesure du 17 septembre 2026, 78 articles sur
//     78 ont plus d'un commit, 11 seulement portent une note de revision.
//     Cette moitie de la regle tient.
//
//     L'autre moitie disait « aucune page ne declare de revision ». Vrai le
//     4 septembre, faux depuis le 15 : dix pages (cinq FR, cinq EN) portent
//     « Corrige le 15 septembre 2026 » / « Corrected on September 15, 2026 »
//     sans le dire au schema. Le 17, decoupage-rag-catalogue-produit porte
//     « Mis a jour le 17 septembre 2026 » et le premier dateModified.
//     Le champ est donc admis a une condition : une note de revision
//     VISIBLE, et le meme jour qu'elle. Le JOUR vient de la page ; l'heure,
//     du commit qui a pose la note (9a38886f pour le 15, e5dd7bb7 pour le
//     17), RAMENEE AU JOUR DE LA NOTE QUAND ELLE DEBORDE : 633bc905 porte
//     « Corrige le 15 septembre » et date du 16 a 00:00:03, les deux
//     recherche-reference-sku-b2b portent donc 2026-09-15T23:59:59. Une
//     revision ne precede pas sa propre mention.
//
//     Depuis le 17 septembre, les onze pages a note le portent, et le garde
//     l'EXIGE : une note de revision sans dateModified est rouge.
//
//   image -- techniquement disponible, mais les 70 articles portent LA MEME
//     og-image.png generique. Declarer une image de marque comme « l'image de
//     cet article » est faiblement vrai, 70 fois. Le champ reviendra le jour
//     ou les articles auront des illustrations propres, pas avant.
//
//     CE PARAGRAPHE DISAIT « 68 » JUSQU'AU 7 SEPTEMBRE 2026, et l'audit qui a
//     lance ce chantier comptait 68 lui aussi. Mesure du jour : 40 sous
//     `blog/`, 30 sous `en/blog/`, soit 70. Le chiffre etait vrai quand il a
//     ete ecrit, et deux articles l'ont perime sans que rien ne le dise -- les
//     assertions de ce fichier derivent le perimetre de l'arborescence et ne
//     lisent aucun de ces nombres, donc aucune n'a bronche. Un compte fige
//     dans une prose ne se corrige que si quelqu'un le recompte.
//
// LA DATE PORTE LE JOUR, ET L'INVARIANT RESTE LE MOIS. Le kicker dit
// « Juillet 2026 » : c'est la precision EDITORIALE, et elle ne descend pas au
// jour. Mais le test de resultats enrichis rendait deux avertissements sur le
// seul « 2026-07 » -- « valeur de date et heure incorrecte » et « il manque le
// fuseau horaire » -- donc un champ present que Google ne lisait pas. Depuis
// 415ab1b8, datePublished porte la forme complete avec fuseau, le jour venant
// de l'horodatage du commit d'ajout, et l'assertion plus bas verifie que son
// MOIS est celui du kicker.
//
// CE PARAGRAPHE DISAIT L'INVERSE JUSQU'AU 4 SEPTEMBRE 2026 : il defendait
// « 2026-07 » comme de l'ISO 8601 a precision reduite, « exactement ce que la
// page affirme, ni plus ». C'etait juste, et 415ab1b8 l'a rendu faux en
// changeant le code et le commentaire interne sans toucher a cet en-tete.
// Une explication qui a cesse d'etre vraie se lit encore comme une decision --
// et celle-ci argumentait contre la regle que le fichier fait respecter.
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

// Les jours declares par une note de revision visible, en tete de paragraphe
// en italique : « Corrige le 15 septembre 2026 », « Mis a jour le ... »,
// « Corrected on September 15, 2026 », « Updated on ... ».
const noteDeRevision = (s) => {
  const jours = [];
  for (const m of s.matchAll(
    /<p><em>(?:Corrigé le|Mis à jour le) (\d{1,2}) (\S+) (\d{4})\.|<p><em>(?:Corrected|Updated) on (\S+) (\d{1,2}), (\d{4})\./g)) {
    const [j, mois, an] = m[1] ? [m[1], m[2], m[3]] : [m[5], m[4], m[6]];
    const n = MOIS[mois.toLowerCase()];
    if (n) jours.push(`${an}-${String(n).padStart(2, "0")}-${String(j).padStart(2, "0")}`);
  }
  return jours;
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

  it("image reste ecarte, et dateModified va avec une note de revision, et seulement avec elle", () => {
    const intrus = [];
    let examines = 0;
    for (const a of articles) {
      const s = lire(a);
      const o = schemaDe(s);
      if (!o) continue;
      examines++;
      if ("image" in o) intrus.push(`${a} : image -- voir l'en-tete de ce fichier`);
      const jours = noteDeRevision(s);
      if (!("dateModified" in o)) {
        if (jours.length) intrus.push(`${a} : note de revision sans dateModified -- voir l'en-tete`);
        continue;
      }
      if (!jours.length)
        intrus.push(`${a} : dateModified sans note de revision visible -- voir l'en-tete`);
      else if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(o.dateModified))
        intrus.push(`${a} : dateModified « ${o.dateModified} » n'est pas un ISO 8601 complet avec fuseau`);
      else if (!jours.includes(o.dateModified.slice(0, 10)))
        intrus.push(`${a} : dateModified ${o.dateModified} n'est le jour d'aucune note (${jours})`);
      else if (o.dateModified < o.datePublished)
        intrus.push(`${a} : dateModified avant datePublished`);
    }
    expect(intrus).toEqual([]);
    expect(examines).toBe(articles.length);
  });

  // TEMOIN : sans lui, un noteDeRevision qui ne lit rien rendrait le garde
  // ci-dessus vert en refusant tout -- et l'article du 17 le ferait rougir,
  // mais les pages du 15 ne diraient rien.
  it("la note de revision est lue sur les pages qui la portent", () => {
    expect(noteDeRevision(lire("blog/decoupage-rag-catalogue-produit.html"))).toEqual(["2026-09-17"]);
    expect(noteDeRevision(lire("en/blog/recherche-reference-sku-b2b.html"))).toEqual(["2026-09-15"]);
    expect(articles.filter((a) => noteDeRevision(lire(a)).length).length).toBeGreaterThanOrEqual(11);
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
