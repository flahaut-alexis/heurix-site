import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// L'ETAT DE LA REVUE SHOPIFY EST DECLARE UNE FOIS, ET LES PAGES LE SUIVENT
// (19 septembre 2026).
//
// Dette ecrite dans le message de b1e7301c : le jour ou Shopify tranche,
// « en revue » devient faux sur 154 pages a la fois -- la ligne Shopify de la
// navigation partagee -- et aucun test ne relie la nav a shopify.html. S'y
// ajoutent le corps de index, docs, partners et integrations, dans les deux
// langues, et la meta description de shopify.html elle-meme.
//
// L'ETAT DECLARE est l'attribut `data-etat-revue-shopify` de la carte qui le
// dit en prose, sur shopify.html et en/shopify.html. Trois valeurs :
// `en-revue`, `validee`, `refusee`. Ce test ne sait pas ce que Shopify a
// decide ; il sait seulement relier. Le jour de la decision, le geste est de
// changer l'attribut : le test liste alors, page par page, chaque phrase qui
// dit encore « en revue ». Un attribut qu'on oublie de changer est tenu par
// l'autre sens : tant qu'il dit `en-revue`, la carte doit dire « ni validee
// ni refusee », et la nav « en revue » -- reecrire l'une sans l'attribut
// rougit aussi.
//
// PERIMETRE DERIVE, PAS ENUMERE -- regle 1 de `pied-liens.test.js` : une page
// servie porte un bloc `.foot-links` (156 pages au 19 septembre). La ligne de
// nav est exigee sur celles qui portent la navigation du site, c'est-a-dire
// toutes sauf l'espace connecte (`nav-links-console`, regle 3 du meme
// fichier) : 154 pages, 84 fr / 70 en.
// ---------------------------------------------------------------------------

const ETATS = ["en-revue", "validee", "refusee"];

/**
 * Les phrases qui disent la revue EN COURS. Deux graphies acceptees partout :
 * la nav est ecrite en entites, le corps en UTF-8.
 *
 * `app-en-revue` exige « app » ou « application » juste avant : « passer en
 * revue » et « year in review » sont d'autres sens, et un motif nu les
 * rougirait le jour ou un article les emploie.
 */
const APOS = "(?:'|\u2019|&rsquo;|&#39;)";
const REVUE_EN_COURS = [
  {
    id: "app-en-revue",
    motif: /\b(?:app|application)\b[^.<>"]{0,24}?\b(?:en revue|in review)\b/gi,
  },
  {
    id: "ni-validee-ni-refusee",
    motif: /ni valid(?:é|&eacute;)e ni refus(?:é|&eacute;)e|neither approved nor rejected/gi,
  },
  {
    // « si la revue aboutit » : un conditionnel qui n'a de sens que revue
    // ouverte. Manque du premier jet, trouve par un balayage independant sur
    // l'etat simule « validee » : la seule phrase restee en place.
    id: "revue-pas-aboutie",
    motif: new RegExp(
      `revue n${APOS}a pas abouti|until review concludes|si la revue aboutit|if review succeeds`,
      "gi"
    ),
  },
];

function pagesHtml() {
  const sortie = [];
  const parcourir = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (e.name.endsWith(".html")) sortie.push(p);
    }
  };
  parcourir(RACINE);
  return sortie;
}

/** Pages servies : `[{ page, src }]`, chemin relatif en `/`. */
function pagesServies() {
  return pagesHtml()
    .map((abs) => ({
      page: path.relative(RACINE, abs).split(path.sep).join("/"),
      src: fs.readFileSync(abs, "utf8"),
    }))
    .filter(({ src }) => /<div class="foot-links">/.test(src));
}

const ENTITES = {
  eacute: "é", egrave: "è", agrave: "à", ecirc: "ê", ccedil: "ç",
  rsquo: "\u2019", nbsp: "\u00a0", amp: "&",
};
function decoder(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/g, (t, n) => ENTITES[n] ?? t);
}

function contient(motif, s) {
  motif.lastIndex = 0;
  return motif.test(s);
}

function ligneDe(src, index) {
  return src.slice(0, index).split("\n").length;
}

/** L'etat declare par une page shopify : `{ etats: [...], carte }`. */
function declaration(page) {
  const src = fs.readFileSync(path.join(RACINE, page), "utf8");
  const etats = [];
  let carte = "";
  for (const m of src.matchAll(/data-etat-revue-shopify="([^"]*)"/g)) {
    etats.push(m[1]);
    const fin = src.indexOf("</div>", m.index);
    carte = src.slice(m.index, fin === -1 ? undefined : fin);
  }
  return { etats, carte };
}

function etatDeclare() {
  const fr = declaration("shopify.html");
  const en = declaration("en/shopify.html");
  return { fr, en, etat: fr.etats[0] };
}

const NAV_SHOPIFY =
  /<a class="nav-row" href="(?:\.\.\/)*shopify\.html">[\s\S]*?<span class="nav-row-d">([\s\S]*?)<\/span>/g;

describe("l'etat de la revue Shopify, declare sur shopify.html, suivi partout", () => {
  it("shopify.html et en/shopify.html declarent un seul etat, le meme, et connu", () => {
    const { fr, en } = etatDeclare();
    expect(fr.etats, "shopify.html : un attribut data-etat-revue-shopify, et un seul").toHaveLength(1);
    expect(en.etats, "en/shopify.html : un attribut data-etat-revue-shopify, et un seul").toHaveLength(1);
    expect(ETATS).toContain(fr.etats[0]);
    expect(en.etats[0], "les deux langues declarent le meme etat").toBe(fr.etats[0]);
  });

  it("tant que l'etat est « en-revue », la carte qui le declare le dit en prose", () => {
    const { fr, en, etat } = etatDeclare();
    if (etat !== "en-revue") return;
    const dit = (carte) => contient(REVUE_EN_COURS[1].motif, carte);
    expect(dit(fr.carte), "shopify.html : attribut en-revue, carte sans « ni validee ni refusee »").toBe(true);
    expect(dit(en.carte), "en/shopify.html : attribut en-revue, carte sans « neither approved nor rejected »").toBe(true);
  });

  it("la ligne Shopify de la nav est la meme sur chaque page de sa langue, et dit l'etat declare", () => {
    const { etat } = etatDeclare();
    const parLangue = { fr: new Map(), en: new Map() };
    const sansLigne = [];
    let pages = 0;
    for (const { page, src } of pagesServies()) {
      if (src.includes("nav-links-console")) continue;
      pages++;
      // Texte lu, pas source : entites decodees, blancs (espace insecable
      // comprise) ramenes a une espace. Deux graphies du meme texte ne sont
      // pas une divergence.
      const lignes = [...src.matchAll(NAV_SHOPIFY)].map((m) =>
        decoder(m[1]).replace(/\s+/g, " ").trim()
      );
      if (lignes.length !== 1) {
        sansLigne.push(`${page} : ${lignes.length} ligne(s) Shopify dans la nav`);
        continue;
      }
      const t = parLangue[page.startsWith("en/") ? "en" : "fr"];
      if (!t.has(lignes[0])) t.set(lignes[0], []);
      t.get(lignes[0]).push(page);
    }
    // Un perimetre vide rendrait tout le reste vert.
    expect(pages).toBeGreaterThan(100);
    expect(sansLigne, sansLigne.join("\n")).toEqual([]);

    for (const [langue, textes] of Object.entries(parLangue)) {
      const detail = [...textes]
        .map(([texte, p]) => `  ${p.length} page(s) : « ${texte} »  (${p.slice(0, 3).join(", ")}${p.length > 3 ? ", ..." : ""})`)
        .join("\n");
      expect(textes.size, `nav ${langue} : plusieurs textes pour Shopify\n${detail}`).toBe(1);
      const [texte] = textes.keys();
      const ditEnRevue = REVUE_EN_COURS.some(({ motif }) => contient(motif, texte));
      expect(
        ditEnRevue,
        `nav ${langue} : « ${texte} » ; etat declare sur shopify.html : ${etat}`
      ).toBe(etat === "en-revue");
    }
  });

  it("hors de l'etat « en-revue », aucune page servie ne dit la revue en cours", () => {
    const { etat } = etatDeclare();
    if (etat === "en-revue") return;
    const infractions = [];
    for (const { page, src } of pagesServies()) {
      for (const { id, motif } of REVUE_EN_COURS) {
        for (const t of src.matchAll(motif)) {
          infractions.push(`${page}:${ligneDe(src, t.index)} [${id}] « ${t[0]} »`);
        }
      }
    }
    const pages = new Set(infractions.map((i) => i.split(":")[0]));
    expect(
      infractions,
      `shopify.html declare « ${etat} » ; ${infractions.length} phrase(s) sur ${pages.size} page(s) disent encore la revue en cours :\n` +
        infractions.slice(0, 20).join("\n") +
        (infractions.length > 20 ? `\n... et ${infractions.length - 20} de plus` : "")
    ).toEqual([]);
  });

  // Le temoin : sur l'arbre du 19 septembre, les motifs trouvent bien les
  // porteurs connus. Sans lui, un motif qui ne mord plus (graphie changee,
  // entite non prevue) rendrait le test precedent vert le jour ou il compte.
  it("temoin : les motifs trouvent chaque porteur connu de l'etat en revue", () => {
    const { etat } = etatDeclare();
    if (etat !== "en-revue") return;
    const servies = new Map(pagesServies().map(({ page, src }) => [page, src]));
    for (const page of [
      "shopify.html", "en/shopify.html", "index.html", "en/index.html",
      "docs.html", "en/docs.html", "partners.html", "en/partners.html",
      "integrations.html", "en/integrations.html",
    ]) {
      const src = servies.get(page);
      expect(src, `${page} n'est plus servie`).toBeDefined();
      const corps = src.replace(NAV_SHOPIFY, "");
      const trouve = REVUE_EN_COURS.some(({ motif }) => contient(motif, corps));
      expect(trouve, `${page} : aucun motif ne voit l'etat en revue hors de la nav`).toBe(true);
    }
  });
});
