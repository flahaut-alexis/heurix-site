import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(import.meta.dirname, "..");
const lire = (p) => fs.readFileSync(path.join(RACINE, p), "utf8");
const existe = (p) => fs.existsSync(path.join(RACINE, p));
const texte = (h) =>
  h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
   .replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------------------
// LES TEMOINS DU LOT DES TROIS ARTICLES SECTORIELS (20 octobre 2026).
//
// Trois articles -- electricite, plomberie, normes -- ecrits dans les deux
// langues le meme jour. Ce fichier porte ce que le lot risque, et il dit pour
// chaque assertion si elle est NEUVE ou si elle REDIT un garde deja en place.
// Une assertion qui redit sans le dire est un vert qui ne prouve rien de plus
// que son voisin, et elle se fait prendre pour une couverture.
//
// ---------------------------------------------------------------------------
// POURQUOI UNE LISTE NOMMEE POUR LA PARITE DE LANGUE, ET PAS UN PERIMETRE
// DERIVE.
//
// « Tout article existe dans les deux langues » est FAUX sur ce depot, et
// legitimement : au 20 octobre 2026, 14 des 48 articles francais n'ont pas
// d'equivalent anglais -- automobile, mode, vins, et onze autres. Un
// perimetre derive de l'arborescence rendrait donc 14 rouges qui ne sont pas
// des defauts, et la seule facon de le rendre vert serait de les excepter un
// par un : une liste, deguisee en perimetre.
//
// La liste est donc assumee, et elle porte la discipline que ce depot applique
// a ses autres listes (`DETTE_TITRE_COURT`, `MARQUE_EN_TETE`,
// `EXCEPTIONS` de liens-relatifs) : une assertion verifie qu'AUCUNE ENTREE
// N'EST PERIMEE. Un slug retire du depot, ou renomme, fait echouer ce fichier
// au lieu d'y rester mort.
//
// CE QUE CETTE LISTE NE PEUT PAS FAIRE, et il faut le lire avant de lui faire
// confiance : elle ne voit pas le PROCHAIN article bilingue. Un quatrieme
// article ajoute demain dans une seule langue ne fait rougir personne ici.
// C'est la limite d'une liste, elle n'est pas contournable sans decider que
// « bilingue » est une propriete lisible depuis le fichier -- ce qu'elle
// n'est pas : une page FR seule et une page FR en attente de sa traduction
// ont les memes octets.
// ---------------------------------------------------------------------------
const LOT = [
  "electricite-section-cable-deux-ecritures",
  "plomberie-diametre-filetage-raccord-ecritures",
  "normes-din-iso-nf-en-reference-produit",
];

const SITEMAP = lire("sitemap.xml");
const BLOCS = [...SITEMAP.matchAll(/<url>[\s\S]*?<\/url>/g)].map((m) => m[0]);

/** Les articles des deux langues, derives de l'arborescence. */
const articles = [];
for (const d of ["blog", "en/blog"])
  for (const f of fs.readdirSync(path.join(RACINE, d)).sort())
    if (f.endsWith(".html")) articles.push(`${d}/${f}`);

const hreflangDe = (src) =>
  Object.fromEntries(
    [...src.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
      .map((m) => [m[1], m[2]]));

const schemaDe = (src) => {
  for (const m of src.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d;
    try { d = JSON.parse(m[1]); } catch { continue; }
    for (const o of Array.isArray(d) ? d : [d]) if (o["@type"] === "BlogPosting") return o;
  }
  return null;
};

describe("lot des trois articles sectoriels — le perimetre", () => {
  // Sans ces deux assertions, chaque boucle plus bas tourne sur l'ensemble
  // vide et sort verte. C'est la lecon que `hreflang-reciproque.test.js`
  // ecrit en tete de lui-meme, apres avoir ete vert sur 14 pages fautives.
  it("les trois slugs du lot sont encore la, dans les deux langues", () => {
    const absents = [];
    for (const s of LOT) {
      if (!existe(`blog/${s}.html`)) absents.push(`blog/${s}.html`);
      if (!existe(`en/blog/${s}.html`)) absents.push(`en/blog/${s}.html`);
    }
    expect(absents,
      "Un slug renomme ou retire : corrigez LOT, ne le laissez pas mort.").toEqual([]);
    expect(LOT).toHaveLength(3);
  });

  it("le balayage des articles trouve les deux langues", () => {
    expect(articles.filter((a) => a.startsWith("blog/")).length).toBeGreaterThanOrEqual(51);
    expect(articles.filter((a) => a.startsWith("en/blog/")).length).toBeGreaterThanOrEqual(37);
  });
});

describe("lot des trois articles sectoriels — une langue ne va pas sans l'autre", () => {
  // NEUVE. `hreflang-reciproque.test.js` suit le lien et verifie que la cible
  // confirme la grappe -- mais seulement pour les pages qui DECLARENT deja
  // `fr` et `en`. Un article du lot publie en francais seul, sans hreflang, ne
  // declare rien : il sort du perimetre de ce garde-la sans un mot, et c'est
  // exactement la panne que celui-ci attrape.
  it("chaque article du lot porte les deux fichiers et la paire reciproque", () => {
    const casse = [];
    for (const s of LOT) {
      const fr = `blog/${s}.html`, en = `en/blog/${s}.html`;
      if (!existe(fr) || !existe(en)) continue; // deja dit par le perimetre
      const hfr = hreflangDe(lire(fr)), hen = hreflangDe(lire(en));
      const attFr = `https://heurix.fr/blog/${s}.html`;
      const attEn = `https://heurix.fr/en/blog/${s}.html`;
      for (const [nom, h] of [[fr, hfr], [en, hen]]) {
        if (h.fr !== attFr) casse.push(`${nom} : hreflang fr = ${h.fr}, attendu ${attFr}`);
        if (h.en !== attEn) casse.push(`${nom} : hreflang en = ${h.en}, attendu ${attEn}`);
        if (h["x-default"] !== attFr)
          casse.push(`${nom} : x-default = ${h["x-default"]}, attendu ${attFr}`);
      }
    }
    expect(casse).toEqual([]);
  });
});

describe("lot des trois articles sectoriels — aucun article n'est orphelin", () => {
  // NEUVE, ET C'EST LA SEULE ASSERTION DE CE FICHIER QUI PORTE SUR TOUT LE
  // BLOG. Mesure du 20 octobre 2026 : 51 articles francais et 37 anglais sont
  // tous lies depuis l'index de leur langue, zero orphelin -- et AUCUN garde
  // ne le verifiait. `liens-relatifs.test.js` verifie le sens inverse (un lien
  // ecrit mene a un fichier) ; il ne peut rien dire d'un fichier que personne
  // ne lie. Un article livre sans sa carte d'index est servi, indexe au
  // sitemap, et introuvable depuis le site.
  it("chaque article est lie depuis l'index du blog de SA langue", () => {
    const index = { "blog": lire("blog.html"), "en/blog": lire("en/blog.html") };
    const orphelins = [];
    for (const a of articles) {
      const dossier = a.startsWith("en/") ? "en/blog" : "blog";
      // Les deux index ecrivent le lien de la meme facon, `blog/<fichier>` :
      // relatif a la racine cote FR, relatif a `en/` cote EN.
      const lien = `href="blog/${path.basename(a)}"`;
      if (!index[dossier].includes(lien)) orphelins.push(`${a} : absent de ${dossier}.html`);
    }
    expect(orphelins).toEqual([]);
    // Un `includes` sur un index vide rendrait tout orphelin, pas tout lie :
    // la panne par l'autre bout est donc deja bruyante. Le plancher garde
    // contre un balayage d'articles qui ne trouve rien.
    expect(articles.length).toBeGreaterThanOrEqual(88);
  });
});

describe("lot des trois articles sectoriels — sitemap et lastmod", () => {
  // REDIT, ET C'EST ASSUME. `canonical.test.js` exige deja qu'aucune page
  // indexable ne manque au sitemap, et `sitemap-lastmod.test.js` exige deja
  // un `<lastmod>` unique et ISO sur chaque URL -- les deux sur un perimetre
  // DERIVE, donc plus large que ce lot. Cette assertion-ci ne couvre rien que
  // ces deux-la ne couvrent. Elle est gardee parce que le lot a ete demande
  // avec son propre temoin sur ce point, et pour qu'un sitemap edite a la main
  // rougisse sous le nom du lot plutot que sous un garde general.
  //
  // CE QU'ELLE N'APPORTE PAS, ET J'AI CRU L'INVERSE AVANT DE LE MESURER.
  // J'avais ecrit ici qu'elle mordait sur un `git add` oublie -- les deux
  // gardes ci-dessus derivant leur perimetre de `git ls-files`, une page non
  // suivie leur serait invisible. La premiere moitie est vraie, la conclusion
  // est fausse : celle-ci lit l'arborescence, donc elle trouve la page sur le
  // disque et son entree au sitemap, et elle sort VERTE elle aussi.
  //
  // Mesure du 20 octobre 2026, les six pages du lot retirees de l'index par
  // `git rm --cached` et laissees sur le disque : `canonical.test.js`,
  // `sitemap-lastmod.test.js` et ce fichier sortent les trois au vert. Ce qui
  // rougit, ce sont les CINQ assertions de plancher -- `titre-h1`,
  // `jsonld-present`, `og-image` (deux) et `metadonnees-tete` -- parce que
  // leur perimetre tombe de 146 a 140. Le `git add` oublie est donc couvert,
  // et il l'est par `tests/pages-indexables.js`. Pas par ici.
  it("chaque page du lot a son entree au sitemap, avec un lastmod ISO unique", () => {
    const casse = [];
    for (const s of LOT) {
      for (const loc of [`https://heurix.fr/blog/${s}.html`,
                         `https://heurix.fr/en/blog/${s}.html`]) {
        const blocs = BLOCS.filter((b) => b.includes(`<loc>${loc}</loc>`));
        if (blocs.length !== 1) { casse.push(`${loc} : ${blocs.length} entree(s) au sitemap`); continue; }
        const dates = [...blocs[0].matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map((m) => m[1]);
        if (dates.length !== 1) { casse.push(`${loc} : ${dates.length} <lastmod>`); continue; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dates[0]))
          casse.push(`${loc} : « ${dates[0]} » n'est pas une date ISO`);
      }
    }
    expect(casse, "Lancez scripts/sitemap-lastmod.py").toEqual([]);
    expect(BLOCS.length).toBeGreaterThanOrEqual(146);
  });
});

describe("articles — le datePublished s'accorde avec la date affichee", () => {
  const MOIS = {
    janvier: 1, "février": 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
    "août": 8, septembre: 9, octobre: 10, novembre: 11, "décembre": 12,
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
    august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const moisAffiche = (src) => {
    const k = /<div class="kicker">([\s\S]*?)<\/div>/.exec(src);
    if (!k) return null;
    const m = texte(k[1]).match(/(\p{L}+)\s+(20\d\d)/u);
    if (!m || !MOIS[m[1].toLowerCase()]) return null;
    return `${m[2]}-${String(MOIS[m[1].toLowerCase()]).padStart(2, "0")}`;
  };

  // REDIT. `schema-article.test.js` compare depuis le 4 septembre 2026 le
  // prefixe AAAA-MM de `datePublished` au mois du kicker, sur le meme
  // perimetre derive. Cette assertion-ci est son double, et elle est gardee
  // parce que le lot a ete demande avec son propre temoin sur ce point : si
  // l'autre est un jour restreint, celui-ci reste.
  //
  // LA PRECISION EST CELLE QUE LE CORPS PORTE, PAS CELLE DE L'ISO. Le kicker
  // d'un article de ce site ecrit « Octobre 2026 » : il n'y a pas de jour
  // affiche a comparer au jour de `datePublished`. Comparer au jour
  // demanderait d'AFFICHER le jour, ce qu'aucun des 88 articles ne fait --
  // la regle serait alors sur la mise en page, pas sur l'accord.
  it("le mois de datePublished est celui du kicker, sur chaque article", () => {
    const ecarts = [];
    let examines = 0;
    for (const a of articles) {
      const src = lire(a), o = schemaDe(src);
      if (!o) { ecarts.push(`${a} : pas de BlogPosting`); continue; }
      const att = moisAffiche(src);
      if (!att) { ecarts.push(`${a} : kicker sans mois lisible`); continue; }
      examines++;
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(o.datePublished))
        ecarts.push(`${a} : datePublished « ${o.datePublished} » n'est pas un ISO 8601 complet`);
      else if (o.datePublished.slice(0, 7) !== att)
        ecarts.push(`${a} : datePublished ${o.datePublished} hors du mois affiche ${att}`);
    }
    expect(ecarts).toEqual([]);
    expect(examines).toBe(articles.length);
  });

  // NEUVE, ET MESUREE AVANT D'ETRE ECRITE. Les deux langues d'un article
  // apparie peuvent declarer un `datePublished` different -- 18 paires sur 37
  // le font au 20 octobre 2026, l'heure du commit de la traduction n'etant pas
  // celle de l'original. Exiger l'egalite serait donc rouge sur l'arbre sain.
  // Le MOIS, lui, est le meme sur les 37 paires, et c'est ce qui se garde :
  // une traduction publiee sous un autre mois que son original annonce deux
  // dates a deux moteurs pour un seul article.
  it("les deux langues d'un article apparie annoncent le meme mois", () => {
    const ecarts = [];
    let paires = 0;
    for (const en of articles.filter((a) => a.startsWith("en/blog/"))) {
      const fr = `blog/${path.basename(en)}`;
      if (!existe(fr)) continue;
      paires++;
      const a = schemaDe(lire(fr)), b = schemaDe(lire(en));
      if (!a || !b) { ecarts.push(`${en} : BlogPosting manquant d'un cote`); continue; }
      if (a.datePublished.slice(0, 7) !== b.datePublished.slice(0, 7))
        ecarts.push(`${en} : ${b.datePublished.slice(0, 7)} contre ${a.datePublished.slice(0, 7)} en francais`);
    }
    expect(ecarts).toEqual([]);
    expect(paires, "aucune paire trouvee : le balayage est casse").toBeGreaterThanOrEqual(37);
  });

  // NEUVE. Sur le lot, les deux langues sont ecrites le meme jour et portent
  // le MEME instant -- c'est plus serre que l'assertion generale ci-dessus, et
  // ca ne vaut que parce que le lot a ete publie d'un bloc. Une traduction
  // retouchee plus tard n'a pas a redater l'original : le jour ou ce lot
  // reprend une seconde vie, cette assertion est a retirer, pas a contourner.
  it("sur le lot, les deux langues portent le meme instant", () => {
    const ecarts = [];
    for (const s of LOT) {
      const fr = `blog/${s}.html`, en = `en/blog/${s}.html`;
      if (!existe(fr) || !existe(en)) continue;
      const a = schemaDe(lire(fr)), b = schemaDe(lire(en));
      if (a.datePublished !== b.datePublished)
        ecarts.push(`${s} : fr ${a.datePublished} / en ${b.datePublished}`);
    }
    expect(ecarts).toEqual([]);
  });
});
