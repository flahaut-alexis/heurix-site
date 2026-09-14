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

  // DELAI EXPLICITE SUR LES DEUX BALAYAGES (14 septembre 2026). Le crochet
  // pre-push, rejoue sur `console-email-sent` (798ae5ed), a echoue une fois sur
  // le second : « Test timed out in 5000ms ». Le meme test passait 3/3 seul, et
  // le crochet au rejeu immediat. Charge moyenne ~25 sur 8 coeurs, quatre autres
  // `vitest` de sessions paralleles.
  //
  // LE TRAVAIL EST PETIT. Chaque balayage construit 144 JSDOM, un par page qui
  // charge consent.js. La meme boucle chronometree par phase dans vitest :
  // 579 ms, dont 406 de constructeur JSDOM, 133 d'attente du `load` (lecture et
  // evaluation de consent.js) et 27 de lecture des pages. `window.close()` apres
  // chaque page n'y change rien de mesurable.
  //
  // LA DUREE MURALE SUIT LA MACHINE, PAS LE TEST :
  //
  //     seul, releve du signalement             2 886 ms   2 976 ms
  //     seul, 23:23, charge 25 montant a 82     4 062 ms   4 007 ms
  //     seul, 23:26, charge ~30, trois passages  533 a 598 ms
  //     suite entiere, 23:27, charge ~11          859 ms     917 ms
  //     suite entiere, 23:28, charge ~11        1 204 ms     940 ms
  //     crochet pre-push, charge ~25            > 5 000 ms (echec)
  //
  // Meme commande, meme arbre, a trois minutes d'ecart : un facteur 7. La charge
  // moyenne ne le predit pas -- 30 a rendu 555 ms, 25 a rendu 4 062.
  //
  // POURQUOI PAS UN TEST MOINS CHER. Le cout est par page et tient au
  // constructeur. Le reduire voudrait dire reutiliser une fenetre d'une page a
  // l'autre, ou son HEURIX_RACINE survivrait a la page suivante -- celle des 8
  // pages sans global -- ou regrouper les pages par contexte, ce qui suppose
  // savoir de quoi depend consent.js. Dans les deux cas le harnais mettrait en
  // scene sa reponse, ce que l'en-tete de ce fichier refuse.
  //
  // 30 s ICI SEULEMENT, comme les tests du verificateur d'index-recherche.test.js :
  // ~50 fois le travail mesure, ~7 fois le pire releve seul. Un `load` que jsdom
  // ne rend pas en 30 s est pendu, pas ralenti, et le delai le dit encore.
  const DELAI = 30_000;

  it("aucune page ne sert un lien de politique mort", async () => {
    const morts = [];
    for (const page of pages) {
      const source = lire(page);
      if (!chargeConsent(source)) continue;
      const { href, resolu } = await lienPolitiqueDe({ page, ...contexteDe(source) });
      if (resolu === null || !surDisque(resolu)) morts.push(`${page} :: href="${href}" -> ${resolu}`);
    }
    expect(morts).toEqual([]);
  }, DELAI);

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
  }, DELAI);
});
