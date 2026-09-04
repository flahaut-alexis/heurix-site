import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// UN NIVEAU DE TITRE SAUTE NE PRODUIT AUCUN SYMPTOME VISIBLE (4 septembre 2026).
//
// `fonctionnalites.html` passait de <h1> a <h3> : ses onze intitules de groupe
// -- « COMPRENDRE VOS REFERENCES », « MERCHANDISING E-COMMERCE » -- etaient des
// <div class="feat-group-title">. Stylises comme des titres, lus comme des
// titres par un oeil, ABSENTS de la liste qu'un lecteur d'ecran propose quand
// il navigue par titres, et absents de la structure sur laquelle un moteur
// s'appuie pour comprendre une page.
//
// CE QUI REND CE DEFAUT PARTICULIER : la page est correcte a l'ecran, valide
// en HTML, verte a tous les tests, et son audit SEO du 3 septembre 2026 a
// rendu « hierarchie logique H2/H3 -- Bon ». Rien, nulle part, ne le disait.
// Il se lit dans la SEQUENCE des niveaux, jamais dans un niveau pris seul.
//
// POURQUOI UNE LISTE NOMMEE PLUTOT QU'UN ZERO. Dix autres pages du sitemap
// sautent un niveau aujourd'hui. Exiger zero rendrait ce test rouge sur `main`
// des sa premiere execution, et un test rouge qu'on apprend a ignorer ne garde
// rien. La liste ci-dessous est donc une DETTE NOMMEE : ces pages-la sont
// connues, chacune est un lot a part, et toute page qui n'y figure pas doit
// passer. Une page NEUVE qui saute un niveau echoue ici, et c'est le seul
// endroit ou elle echouera.
//
// CE QU'IL NE FAIT PAS : il ne juge ni le nombre de <h1>, ni l'ordre des
// titres a niveau egal, ni le fait qu'une page commence par autre chose qu'un
// <h1>. Un saut est une regle qui se derive du fichier sans rien deviner ;
// « la bonne structure » ne l'est pas.
// ---------------------------------------------------------------------------

// LA DETTE, MESUREE LE 4 SEPTEMBRE 2026. Six gabarits, chacun en deux langues.
//
//   blog.html / en/blog.html                       h1 puis 40 (29) <h3> de carte
//   blog/guide-mise-en-route.html (+ en/)          h1 puis <h3> avant tout <h2>
//   partners.html / en/partners.html               <h2> puis <h4>
//   pricing.html / en/pricing.html                 <h2> puis <h4>
//   secteurs.html / en/secteurs.html               h1 puis 14 <h4>
//
// Retirer une ligne d'ici est le geste qui CLOT un de ces lots. En ajouter une
// demande d'ecrire pourquoi, ici, a cote des autres.
const DETTE = new Set([
  "blog.html",
  "blog/guide-mise-en-route.html",
  "partners.html",
  "pricing.html",
  "secteurs.html",
  "en/blog.html",
  "en/blog/guide-mise-en-route.html",
  "en/partners.html",
  "en/pricing.html",
  "en/secteurs.html",
]);

// Les URL du sitemap, extraites des <loc> et comparees par EGALITE.
// Un test d'appartenance par sous-chaine repondrait sur autre chose : la
// chaine « console.html » se trouve dans « blog/guide-utilisation-console.html »
// (CLAUDE.md, « Les onze pages sans balise sociale sont les bonnes onze »).
function pagesDuSitemap() {
  const xml = fs.readFileSync(path.join(RACINE, "sitemap.xml"), "utf8");
  return [...xml.matchAll(/<loc>https:\/\/heurix\.fr\/([^<]*)<\/loc>/g)]
    .map((m) => m[1])
    .map((u) => (u.endsWith(".html") ? u : (u ? u.replace(/\/$/, "") + "/index.html" : "index.html")))
    .filter((u) => fs.existsSync(path.join(RACINE, u)));
}

// Les commentaires et les <script> portent des balises qui ne sont pas des
// titres de la page : `console.js` construit un « <h2> » dans une chaine, et
// plusieurs pages commentent un bloc retire sans le supprimer.
function niveaux(source) {
  const propre = source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  return [...propre.matchAll(/<h([1-6])(?=[\s>])/gi)].map((m) => Number(m[1]));
}

function sauts(suite) {
  const trouves = [];
  for (let i = 1; i < suite.length; i++) {
    if (suite[i] > suite[i - 1] + 1) trouves.push(`h${suite[i - 1]} -> h${suite[i]}`);
  }
  return trouves;
}

describe("hierarchie des titres", () => {
  const pages = pagesDuSitemap();

  it("le sitemap rend bien les 131 pages attendues", () => {
    expect(pages.length).toBe(131);
  });

  it("aucune page hors dette ne saute un niveau de titre", () => {
    const ecarts = [];
    for (const p of pages) {
      if (DETTE.has(p)) continue;
      const s = sauts(niveaux(fs.readFileSync(path.join(RACINE, p), "utf8")));
      if (s.length) ecarts.push(`${p} : ${[...new Set(s)].join(", ")}`);
    }
    expect(ecarts).toEqual([]);
  });

  // UNE DETTE QUI SE REPARE SANS QU'ON LE DISE RESTE INSCRITE ICI, et la
  // prochaine session la croit encore ouverte. Le controle est symetrique.
  it("chaque page de la dette saute encore un niveau", () => {
    const reparees = [...DETTE].filter((p) => {
      const abs = path.join(RACINE, p);
      return fs.existsSync(abs) && sauts(niveaux(fs.readFileSync(abs, "utf8"))).length === 0;
    });
    expect(reparees).toEqual([]);
  });
});
