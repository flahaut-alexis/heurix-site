import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// search-engine.js — chantier S4 (5 août 2026). search.js et search-en.js
// ne différaient que sur UNE ligne de vraie logique (le calcul du chemin
// relatif "root") au milieu de données légitimement différentes par langue.
// Extrait dans search-engine.js, avec un calcul de profondeur généralisé
// par comptage de segments plutôt que des motifs "/blog/" ou "/en/" codés
// en dur — correct à n'importe quelle profondeur, dans les deux langues,
// y compris des pages qui n'existent pas encore.
//
// Ce test compare le comportement observable (les liens produits pour une
// recherche donnée) à celui du code AVANT ce chantier, figé dans
// fixtures/search-avant-s4/ — pas une simple vérification de syntaxe.
// ---------------------------------------------------------------------------

function domAvecMoteur(scripts, url) {
  const html = `<!DOCTYPE html><html><body>
    <button id="heurix-search-btn"></button>
    <!--MODALE-->
      </body></html>`;
  // L'ANCIEN MOTEUR ATTEND LE BALISAGE, LE NOUVEAU LE CONSTRUIT. Depuis le
  // 27 aout, la modale est batie en JS et les pages ne portent plus que le
  // bouton. Les fixtures figees, elles, gelent l'etat d'AVANT et lisent des
  // elements qu'elles ne creent pas -- c'est leur role, elles ne bougent pas.
  //
  // Le harnais fournit donc le balisage UNIQUEMENT au cote ancien. Le fournir
  // aux deux ferait gagner ce div vide sur celui que le nouveau moteur ajoute
  // -- deux elements de meme id, et `getElementById` rend le premier.
  // LE PREDICAT PORTE SUR LE MOTEUR, PAS SUR LE DOSSIER. Premiere version :
  // `s.includes("search-avant-s4")` -- vrai aussi pour donnees-figees.js, qui
  // vit dans le meme dossier et sert les DEUX cotes. Le nouveau moteur
  // recevait donc le balisage lui aussi, deux elements de meme id, et
  // `getElementById` rendait le div vide du harnais. Le test echouait en
  // annoncant zero resultat pour une recherche qui en rend trois.
  const ancien = scripts.some((s) => /search-avant-s4\/search(-en)?\.js$/.test(s));
  const balisage = ancien
    ? `<div id="heurix-search-modal"><div id="heurix-search-backdrop"></div>
         <input id="heurix-search-input"><div id="heurix-search-results"></div>
         <p id="heurix-search-empty" hidden></p>
         <p id="heurix-search-suggest-label" hidden></p></div>`
    : "";
  const dom = new JSDOM(html.replace("<!--MODALE-->", balisage), { url, runScripts: "outside-only" });
  for (const s of scripts) dom.window.eval(fs.readFileSync(s, "utf8"));

  // L'INDEX N'ARRIVE PLUS PAR UNE GLOBALE (27 aout 2026). Le moteur le
  // recupere en JSON au premier usage ; search.js et search-en.js sont
  // supprimes. Les fixtures figees, elles, posent encore
  // window.HEURIX_SEARCH_INDEX -- c'est leur role : elles gelent l'ETAT
  // D'AVANT le chantier S4 et ne doivent pas bouger.
  //
  // On les evalue donc pour recuperer leurs donnees, puis on les sert par un
  // fetch feint. Ce que ce fichier mesure -- le calcul du chemin relatif, le
  // classement, les liens produits -- est inchange ; seule la FACON dont les
  // donnees entrent a change, et c'est l'objet du commit.
  const donnees = (dom.window.HEURIX_SEARCH_INDEX || []).map(function (e) {
    return { p: e.path, t: e.title, e: e.excerpt };
  });
  const derniersChemins = dom.window.HEURIX_SEARCH_LATEST_PATHS || [];
  dom.window.fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () { return Promise.resolve({ entrees: donnees, derniers: derniersChemins }); },
    });
  };
  // jsdom en mode "outside-only" ne déclenche jamais DOMContentLoaded tout
  // seul -- sans ce déclenchement manuel, init() n'est jamais appelée et
  // TOUS les résultats de ce fichier seraient un faux "aucun écart"
  // (aucun listener câblé, donc aucune interaction n'a d'effet du tout).
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true, cancelable: true }));
  return dom.window;
}

async function chercher(win, q) {
  win.document.getElementById("heurix-search-btn").dispatchEvent(new win.Event("click"));
  // Le chargement est asynchrone : sans cette attente, on interrogerait un
  // index vide et le test rendrait « aucun ecart » sans rien mesurer.
  await new Promise((r) => setTimeout(r, 20));
  const input = win.document.getElementById("heurix-search-input");
  input.value = q;
  input.dispatchEvent(new win.Event("input"));
  return Array.from(win.document.querySelectorAll(".search-result")).map((a) => a.getAttribute("href"));
}

const ANCIEN_FR = path.join(RACINE, "tests/fixtures/search-avant-s4/search.js");
const ANCIEN_EN = path.join(RACINE, "tests/fixtures/search-avant-s4/search-en.js");
// Correctif du 24 aout 2026. Le moteur ACTUEL est charge avec les
// DONNEES FIGEES, pas avec search.js. Sans cela, le test comparait deux
// systemes complets : tout article ajoute creait un ecart sans rapport
// avec la logique, et faisait echouer un test de non-regression du
// MOTEUR.
//
// Six articles publies etaient devenus introuvables par la recherche du
// site pour cette raison : l'etape qui les ajoute a search.js cassait ce
// test, sans moyen documente de le reparer.
//
// Desormais : memes donnees des deux cotes, seule la logique differe --
// ce que le test a toujours voulu mesurer.
const DONNEES_FIGEES_FR = path.join(RACINE, "tests/fixtures/search-avant-s4/donnees-figees.js");
const DONNEES_FIGEES_EN = path.join(RACINE, "tests/fixtures/search-avant-s4/donnees-figees-en.js");
const NOUVEAU_FR = [DONNEES_FIGEES_FR, path.join(RACINE, "search-engine.js")];
const NOUVEAU_EN = [DONNEES_FIGEES_EN, path.join(RACINE, "search-engine.js")];

describe("search-engine.js — non-régression FR", () => {
  it.each(["recherche", "algolia", "prestashop", "moteur natif", "custom rules", "xyz-inexistant-zzz"])(
    "« %s » renvoie les mêmes liens qu'avant le chantier S4",
    async (q) => {
      const avant = await chercher(domAvecMoteur([ANCIEN_FR], "https://heurix.fr/index.html"), q);
      const apres = await chercher(domAvecMoteur(NOUVEAU_FR, "https://heurix.fr/index.html"), q);
      expect(apres).toEqual(avant);
    }
  );
});

describe("search-engine.js — non-régression EN", () => {
  it.each(["search", "algolia", "shopify", "vector search"])(
    "« %s » renvoie les mêmes liens qu'avant le chantier S4",
    async (q) => {
      const avant = await chercher(domAvecMoteur([ANCIEN_EN], "https://heurix.fr/en/index.html"), q);
      const apres = await chercher(domAvecMoteur(NOUVEAU_EN, "https://heurix.fr/en/index.html"), q);
      expect(apres).toEqual(avant);
    }
  );
});

describe("search-engine.js — calcul du chemin relatif (root)", () => {
  it("racine FR : aucun préfixe", async () => {
    const win = domAvecMoteur(NOUVEAU_FR, "https://heurix.fr/index.html");
    const [lien] = await chercher(win, "recherche");
    expect(lien.startsWith("../")).toBe(false);
  });

  it("racine EN (un niveau) : même résultat qu'avant le chantier", async () => {
    const avant = await chercher(domAvecMoteur([ANCIEN_EN], "https://heurix.fr/en/index.html"), "algolia");
    const apres = await chercher(domAvecMoteur(NOUVEAU_EN, "https://heurix.fr/en/index.html"), "algolia");
    expect(apres).toEqual(avant);
  });

  it("en/blog (deux niveaux) : même résultat qu'avant le chantier", async () => {
    const avant = await chercher(domAvecMoteur([ANCIEN_EN], "https://heurix.fr/en/blog/article.html"), "algolia");
    const apres = await chercher(domAvecMoteur(NOUVEAU_EN, "https://heurix.fr/en/blog/article.html"), "algolia");
    expect(apres).toEqual(avant);
  });

  it("GAIN DE ROBUSTESSE : solutions/ en français calcule désormais un root correct — l'ancien code FR ne gérait que /blog/, ce cas aurait échoué silencieusement (liens cassés)", async () => {
    const win = domAvecMoteur(NOUVEAU_FR, "https://heurix.fr/solutions/outillage.html");
    const [lien] = await chercher(win, "recherche");
    expect(lien.startsWith("../")).toBe(true);
  });
});
