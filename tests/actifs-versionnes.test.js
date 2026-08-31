import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// UN ACTIF SANS `?v=` EST INVISIBLE A TOUS LES GARDES (28 aout 2026).
//
// Le controle de coherence de la CI derive son perimetre des references
// VERSIONNEES : `git grep "…\.[a-z0-9]{2,4}\?v=[0-9]+"`. Un actif reference
// sans clef n'y figure donc pas, et personne ne le surveille -- pas parce
// qu'on l'a exclu, mais parce qu'il n'a jamais ete vu.
//
// `bust-cache.sh` ne referme pas le trou non plus : son motif exige un `?v=`
// deja present. Il entretient une clef, il n'en cree pas.
//
// LE CAS QUI A REVELE LA FAMILLE : `docs-copy.js` etait reference sur QUATRE
// pages, une seule avec clef. Un bump atteignait `docs.html` et laissait
// `en/docs.html` et les deux guides servir leur version en cache pendant les
// 600 s de fraicheur restantes. Le controle de coherence voyait UNE clef et
// concluait « coherent » -- exactement la forme du defaut des 38 pages d'aout.
//
// POURQUOI CE TEST EXISTE -- ET LA RAISON ECRITE ICI JUSQU'AU 31 AOUT 2026
// N'ETAIT PAS LA BONNE. Cet en-tete disait « sert sa version en cache
// indefiniment ». Mesure du 31 aout 2026 sur l'origine de production :
// GitHub Pages envoie `max-age=600` + ETag aux TROIS familles -- documents,
// actifs versionnes, et les deux actifs sans clef (`favicon-32.png`,
// `apple-touch-icon.png`, 128 pages chacun) -- et le parametre de requete ne
// change rien a l'en-tete. Le CDN respecte le max-age et PROPAGE son `age`,
// que le navigateur retranche de sa propre fraicheur : la borne de bout en
// bout est 600 s, pas l'eternite. Le test reste juste, son argument non.
//
// LA VRAIE RAISON, mesuree au banc (memes en-tetes, navigateur reel, un
// remplacement des fichiers entre deux navigations) : un visiteur qui ouvre
// une page JAMAIS VISITEE apres un deploiement recoit le document NEUF et
// l'actif ANCIEN -- le document n'est dans aucun cache, l'actif y est encore
// frais -- et le navigateur n'emet AUCUNE requete pour cet actif
// (`transferSize` 0). Le document et son script ont deux horloges
// independantes ; le `?v=` est ce qui les raccorde.
//
// C'EST CE QUI REND CE TEST NECESSAIRE : un defaut qui ne produit aucune
// requete ne produit aucun journal. Il n'existe aucune trace, cote origine
// comme cote CDN, ou l'on pourrait le voir apres coup. Ce test le voit avant,
// ou personne ne le voit.
//
// A NE PAS REPRENDRE : « le ?v= couvre les caches intermediaires ». C'est
// faux au moins au premier etage -- le CDN de GitHub n'inclut pas la chaine
// de requete dans sa clef de cache, une URL jamais demandee y repond
// `x-cache: HIT` avec l'`age` de l'URL nue (mesure du 31 aout 2026). Ce qui
// est mesure, c'est le cache du NAVIGATEUR. Les caches clefes sur l'URL
// entiere n'ont pas ete mesures et ne doivent pas etre avances comme un fait.
//
// Detail : `CLAUDE.md`, section « Indefiniment etait faux, et le ?v= est bon
// pour une autre raison ».
//
// PERIMETRE DERIVE : on lit les references des pages et on retient celles qui
// designent un fichier existant. Aucune liste d'actifs, aucune liste
// d'extensions choisie a la main.
// ---------------------------------------------------------------------------

const pagesDe = (dossier) => {
  const sortie = [];
  for (const e of fs.readdirSync(path.join(RACINE, dossier), { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const rel = dossier === "." ? e.name : `${dossier}/${e.name}`;
    if (e.isDirectory()) sortie.push(...pagesDe(rel));
    else if (e.name.endsWith(".html")) sortie.push(rel);
  }
  return sortie;
};

const PAGES = pagesDe(".");

// { actif -> { avec: Set<page>, sans: Set<page> } }
const references = new Map();
for (const p of PAGES) {
  const s = fs.readFileSync(path.join(RACINE, p), "utf8");
  const base = path.dirname(p);
  for (const m of s.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:)?\/\/|^#|^mailto:|^data:/.test(u)) continue;
    const [chemin, requete = ""] = u.split("?");
    if (!/\.[a-z0-9]{2,4}$/.test(chemin)) continue;
    if (/\.(html|xml|txt)$/.test(chemin)) continue;
    const cible = path.normalize(path.join(base, chemin));
    if (!fs.existsSync(path.join(RACINE, cible))) continue;
    if (!references.has(cible)) references.set(cible, { avec: new Set(), sans: new Set() });
    references.get(cible)[requete.startsWith("v=") ? "avec" : "sans"].add(p);
  }
}

// Actifs volontairement non versionnes, avec leur RAISON. Les deux assertions
// de fin les font sortir des qu'elles cessent d'etre justifiees.
const SANS_CLEF_ASSUMES = new Map([
  ["favicon-32.png",
   "Icone d'onglet, referencee par toutes les pages du site. Les navigateurs " +
   "la rechargent sur leur propre cycle et ignorent largement les parametres " +
   "de requete dessus ; une clef y coute un diff dans chaque page -- 128 " +
   "lignes au 30 aout 2026 -- a chaque changement pour un effet nul."],
  ["apple-touch-icon.png",
   "Icone systeme lue par iOS au moment ou l'utilisateur ajoute le site a son " +
   "ecran d'accueil, une fois, hors du cycle de cache des assets de page. Un " +
   "parametre de requete n'y change rien et couterait un diff dans chaque " +
   "page -- 128 lignes au 30 aout 2026."],
]);

describe("actifs versionnes", () => {
  it("aucun actif n'est reference a la fois AVEC et SANS clef", () => {
    // LE DEFAUT REEL. Un bump atteint alors les pages versionnees et laisse
    // les autres en cache -- une incoherence que le controle de la CI ne peut
    // pas voir, puisqu'il ne compte que les references versionnees.
    const mixtes = [...references.entries()]
      .filter(([, r]) => r.avec.size > 0 && r.sans.size > 0)
      .map(([a, r]) => `${a} : ${r.avec.size} page(s) avec clef, ${r.sans.size} sans — ${[...r.sans].sort().join(", ")}`);
    expect(mixtes).toEqual([]);
  });

  it("tout actif reference sans clef est nomme et justifie", () => {
    const sans = [...references.entries()]
      .filter(([, r]) => r.avec.size === 0)
      .map(([a, r]) => `${a} (${r.sans.size} page(s))`)
      .filter((l) => ![...SANS_CLEF_ASSUMES.keys()].some((e) => l.startsWith(`${e} `) || l.startsWith(e)));
    expect(sans, "actif(s) hors du perimetre de tous les gardes — versionnez-les ou justifiez-les dans SANS_CLEF_ASSUMES").toEqual([]);
  });

  it("aucune justification n'est perimee : chacune est encore sans clef", () => {
    const encoreSansClef = new Set(
      [...references.entries()].filter(([, r]) => r.avec.size === 0).map(([a]) => path.basename(a)));
    const perimees = [...SANS_CLEF_ASSUMES.keys()].filter((k) => !encoreSansClef.has(k));
    expect(perimees, "a retirer de SANS_CLEF_ASSUMES : ces actifs portent desormais une clef").toEqual([]);
  });

  it("chaque justification porte une raison lisible", () => {
    for (const [clef, raison] of SANS_CLEF_ASSUMES) {
      expect(raison.length, `${clef} : raison trop courte`).toBeGreaterThan(80);
      expect(raison, `${clef} : un renvoi n'est pas une raison`).not.toMatch(/^(Idem|Voir|Meme cas)\b/);
    }
  });

  it("le balayage a de quoi mordre", () => {
    expect(PAGES.length).toBeGreaterThanOrEqual(120);
    expect(references.size).toBeGreaterThanOrEqual(30);
  });
});
