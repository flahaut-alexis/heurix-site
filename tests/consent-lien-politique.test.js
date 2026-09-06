import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { JSDOM, ResourceLoader } from "jsdom";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// LE LIEN « PRIVACY POLICY » DU BANDEAU ETAIT UN 404 SUR TOUTE LA VERSION
// ANGLAISE (6 septembre 2026).
//
// consent.js construisait la cible ainsi :
//
//     (window.HEURIX_RACINE || "") + T.lienPolitique
//
// avec `lienPolitique` valant "privacy.html" cote EN. Or HEURIX_RACINE designe
// la RACINE DU SITE, pas la racine de la langue : sur une page anglaise il
// vaut "../" ou "../../", et la cible resolue etait donc toujours
// /privacy.html. Ce fichier n'existe pas -- il s'appelle en/privacy.html.
//
// Mesure du jour, sur les 146 pages du depot : 61 pages anglaises servaient un
// lien mort, sous DEUX formes distinctes qu'un seul chiffre aurait cachees.
//
//     53 pages  HEURIX_RACINE declare  -> /privacy.html
//      8 pages  HEURIX_RACINE absent   -> en/solutions/privacy.html
//      4 pages  HEURIX_RACINE absent, profondeur 1 -> en/privacy.html, JUSTE
//
// Les quatre dernieres sont ce qui rend le defaut difficile : elles marchaient
// PAR ACCIDENT, l'oubli d'un global compensant l'erreur de l'autre. Un correctif
// qui se serait contente de reecrire `lienPolitique` en "en/privacy.html" les
// aurait cassees en reparant les 53.
//
// CE N'EST PAS UN LIEN MORT ORDINAIRE. La CNIL attend que l'information sur les
// traceurs soit accessible depuis le bandeau lui-meme. C'est l'unique lien du
// bandeau, et il ne menait nulle part pour tout visiteur anglophone.
//
// POURQUOI liens-relatifs.test.js NE POUVAIT PAS LE VOIR : ce lien n'existe
// dans aucun fichier .html. Il est assemble a l'execution, a partir d'un global
// pose par la page et d'une constante du module. Un garde qui lit le balisage
// lit precisement ce qui ne contient pas le defaut.
//
// D'OU LA FORME DE CE TEST : il EXECUTE consent.js dans un DOM, et lit le href
// que le module a reellement produit. Il ne rejoue pas son calcul -- un
// instrument qui reimplemente sa cible finit par mesurer sa propre
// reimplementation, et ce depot en porte deja le cout (`--verifier` et ses
// 2 801 termes sous-comptes).
//
// PERIMETRE DERIVE : les pages sont celles de l'arbre qui chargent consent.js.
// Aucune liste de 61, qui se perimerait a la soixante-deuxieme.
// ---------------------------------------------------------------------------


const pages = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) parcourir(rel);
    else if (e.name.endsWith(".html")) pages.push(rel);
  }
})("");

const lire = (p) => fs.readFileSync(path.join(RACINE, p), "utf8");

const chargeConsent = (s) => /<script[^>]*\bsrc="[^"]*consent\.js[^"]*"/.test(s);

const ORIGINE = "https://heurix.fr/";

/**
 * Le contexte qu'une page donne au module : sa langue, le global qu'elle pose,
 * et LA LIGNE PAR LAQUELLE ELLE LE CHARGE. Le troisieme est indispensable :
 * consent.js se situe desormais par l'URL de son propre <script src>, donc un
 * harnais qui l'evaluerait a la main mesurerait le repli et jamais le chemin
 * reel -- un montage qui met en scene sa reponse au lieu de la constater.
 */
function contexteDe(source) {
  const lang = source.match(/<html[^>]*\blang="([^"]*)"/);
  const racine = source.match(/window\.HEURIX_RACINE\s*=\s*['"]([^'"]*)['"]/);
  const script = source.match(/<script[^>]*\bsrc="([^"]*consent\.js[^"]*)"[^>]*>/);
  return {
    lang: lang ? lang[1] : "fr",
    racine: racine ? racine[1] : null,
    src: script ? script[1] : null,
  };
}

/**
 * Sert les fichiers du depot a la place du reseau. Un chemin qui ne designe
 * aucun fichier rend `null`, ce que jsdom traite comme un script non charge --
 * c'est-a-dire exactement ce que fait un navigateur devant un 404, et ce qui
 * fait de ce harnais un garde des DEUX familles a la fois : un lien de
 * politique faux, et un <script src> qui ne resout pas.
 */
class DisqueLoader extends ResourceLoader {
  fetch(url) {
    const rel = url.slice(ORIGINE.length).replace(/\?.*$/, "");
    const abs = path.join(RACINE, rel);
    if (!rel || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
    return Promise.resolve(fs.readFileSync(abs));
  }
}

/**
 * Reconstitue la page telle que le navigateur la voit du point de vue du
 * module : sa langue, son global, son <script src> -- puis rend le href que
 * consent.js a REELLEMENT ecrit, resolu contre l'URL de la page.
 *
 * `url` place le document a son emplacement reel : c'est ce qui donne son sens
 * a un chemin relatif, et c'est exactement la grandeur que le defaut mettait
 * en jeu.
 */
async function lienPolitiqueDe({ page, lang, racine, src }) {
  const pose = racine === null ? "" : `<script>window.HEURIX_RACINE='${racine}';</script>`;
  const dom = new JSDOM(
    `<!doctype html><html lang="${lang}"><body>${pose}` +
      (src ? `<script src="${src}"></script>` : "") +
      `</body></html>`,
    {
      url: ORIGINE + page,
      runScripts: "dangerously",
      resources: new DisqueLoader(),
    }
  );
  await new Promise((r) => {
    if (dom.window.document.readyState === "complete") r();
    else dom.window.addEventListener("load", r);
  });
  const a = dom.window.document.querySelector(".consent-lien a");
  const href = a ? a.getAttribute("href") : null;
  return {
    href,
    resolu: href === null ? null : new dom.window.URL(href, dom.window.location.href).pathname,
  };
}

const surDisque = (chemin) => fs.existsSync(path.join(RACINE, chemin.replace(/^\//, "")));

describe("le lien de politique du bandeau de consentement mene a un fichier reel", () => {
  // TEMOIN POSITIF, pose AVANT de lire le moindre resultat. Sans lui, « aucun
  // lien mort » et « le harnais n'a produit aucun lien » ont la meme sortie --
  // et c'est la sortie rassurante qui s'impose.
  it("le harnais produit un lien juste sur une page francaise", async () => {
    const { href, resolu } = await lienPolitiqueDe({
      page: "index.html", lang: "fr", racine: null, src: "consent.js",
    });
    expect(href).toBe("https://heurix.fr/confidentialite.html");
    expect(resolu).toBe("/confidentialite.html");
    expect(surDisque(resolu)).toBe(true);
  });

  // Second temoin positif, sur l'autre langue ET l'autre profondeur : ce sont
  // les deux grandeurs que le defaut mettait en jeu.
  it("le harnais produit un lien juste sur une page anglaise profonde", async () => {
    const { resolu } = await lienPolitiqueDe({
      page: "en/solutions/plomberie.html", lang: "en", racine: "../../", src: "../../consent.js",
    });
    expect(resolu).toBe("/en/privacy.html");
    expect(surDisque(resolu)).toBe(true);
  });

  // TEMOIN NEGATIF : le harnais doit pouvoir rendre un verdict ROUGE. Un
  // detecteur qui trouve ce qu'il cherche peut encore repondre a tout ; seul un
  // cas dont la reponse doit etre « rien » separe les deux.
  //
  // Le cas choisi n'est pas invente : c'est la SECONDE famille du jour, celle
  // d'en/pricing.html et en/bienvenue.html, qui ecrivaient src="consent.js"
  // depuis en/ et ne chargeaient donc aucun module de consentement.
  it("le harnais rend « rien » quand le module ne se charge pas", async () => {
    const { href, resolu } = await lienPolitiqueDe({
      page: "en/pricing.html", lang: "en", racine: null, src: "consent.js",
    });
    expect(href).toBe(null);
    expect(resolu).toBe(null);
  });

  it("le balayage retrouve les pages dont on sait qu'elles chargent le module", () => {
    const chargent = pages.filter((p) => chargeConsent(lire(p)));
    expect(chargent).toContain("index.html");
    expect(chargent).toContain("en/solutions/plomberie.html");
    expect(chargent.length).toBeGreaterThan(100);
  });

  it("aucune page ne sert un lien de politique mort", async () => {
    const morts = [];
    for (const page of pages) {
      const source = lire(page);
      if (!chargeConsent(source)) continue;
      const { href, resolu } = await lienPolitiqueDe({ page, ...contexteDe(source) });
      if (resolu === null || !surDisque(resolu)) morts.push(`${page} :: href="${href}" -> ${resolu}`);
    }
    expect(morts).toEqual([]);
  });

  it("le lien sert la politique de la LANGUE de la page, pas celle du site", async () => {
    const ecarts = [];
    for (const page of pages) {
      const source = lire(page);
      if (!chargeConsent(source)) continue;
      const ctx = contexteDe(source);
      const { resolu } = await lienPolitiqueDe({ page, ...ctx });
      const attenduEn = ctx.lang.startsWith("en");
      // `resolu` nul compte comme un ecart, et pas comme un cas a sauter : un
      // `if (resolu && ...)` rendait ce test vert sur 140 liens absents.
      if (resolu === null || resolu.startsWith("/en/") !== attenduEn) {
        ecarts.push(`${page} (lang=${ctx.lang}) -> ${resolu}`);
      }
    }
    expect(ecarts).toEqual([]);
  });
});
