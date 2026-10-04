import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * CE QUE GITHUB PAGES PUBLIE, DERIVE DE L'INDEX GIT.
 *
 * Module partage par `fragments-non-indexables.test.js` et
 * `surface-publiee-robots.test.js`. Il n'existe que pour une raison : les deux
 * familles de regles `Disallow` se jugent sur le MEME inventaire, et
 * l'assertion « aucune regle n'est perimee » quantifie sur TOUTES les regles.
 * Elle ne peut donc pas vivre dans un fichier qui ne connait qu'une famille.
 *
 * Deux boucles ecrites separement auraient derive l'une de l'autre -- c'est la
 * lecon que `heurix-woocommerce/scripts/build-zip.sh` ecrit noir sur blanc a
 * propos de son propre croisement de versions. D'ou un seul endroit.
 *
 * SUR `git ls-files` PLUTOT QU'UN BALAYAGE DU DISQUE, et la raison est celle
 * que `fragments-non-indexables.test.js` donnait deja : robots.txt ne peut
 * couvrir que ce qui est PUBLIE, et un fichier non suivi n'est jamais servi.
 * Le balayage du disque ferait en plus tomber ces tests sur les harnais
 * temporaires des sessions voisines, ce qui est arrive a
 * `tests/canonical.test.js` le 28 aout 2026.
 */

export const RACINE = join(import.meta.dirname, "..");

/** Tous les fichiers suivis, chemins relatifs a la racine, separateur `/`. */
export function fichiersSuivis() {
  return execFileSync("git", ["--no-optional-locks", "ls-files", "-z"], {
    cwd: RACINE,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\0")
    .filter(Boolean);
}

/**
 * LES ENTREES DE PREMIER NIVEAU QUI NE SONT PAS DU SITE.
 *
 * Mesure du 4 octobre 2026 : `upload-pages-artifact` recoit `path: '.'`, donc
 * Pages sert la racine entiere -- 1 042 fichiers, 22,1 Mio, dont 198 fichiers
 * et 2,52 Mio qui ne sont pas du site. Releve complet :
 * `docs/mesures/pages-perimetre-2026-10-04/`.
 *
 * LA LISTE EST UNE LISTE, ET C'EST ASSUME. Le reste de ce depot derive ses
 * perimetres ; ici le critere « ce fichier appartient-il au site ? » n'a pas de
 * forme lisible depuis le fichier lui-meme -- `docs.html` est une page,
 * `docs/` n'en est pas, et rien dans les octets ne les distingue. Ce qui EST
 * derive, et c'est ce qui compte, c'est la confrontation : toute entree de
 * premier niveau inconnue de ces deux listes fait echouer
 * `surface-publiee-robots.test.js`. Une entree neuve ne peut donc pas entrer
 * en silence, ni du cote site ni du cote interne.
 *
 * LES CHEMINS COMMENCANT PAR UN POINT SONT DEJA EXCLUS, sans que personne
 * l'ait ecrit : mesure du 4 octobre, `.DS_Store`, `.gitignore`,
 * `.gitleaks.toml` et `.github/workflows/CI.yml` rendent 404 quand les 198
 * autres rendent 200. Ils ne sont donc pas a refuser dans robots.txt -- une
 * regle pour eux serait perimee le jour ou on l'ecrit.
 */
const INTERNES = [
  "tests/",
  "docs/",
  "scripts/",
  "config-serveur-cache/",
  "CLAUDE.md",
  "DESIGN.md",
  "README.md",
  "package.json",
  "package-lock.json",
  "vitest.config.js",
];

/** Entrees de premier niveau du site, pour que l'inconnu se voie. */
const DU_SITE = new Set([
  "404.html", "CNAME", "about.html", "apple-touch-icon.png", "bienvenue.html",
  "billing-toggle.js", "blog.html", "blog/", "cgv-1.0.html", "cgv-1.1.html",
  "cgv-1.2.html", "cgv-1.3.html", "cgv.html", "confidentialite.html",
  "consent.js", "console-i18n.js", "console-select.js", "console.html",
  "console.js", "contact.html", "csv-console.js", "csv-import.js",
  "demo-boutique.css", "demo-boutique.js", "demo-epinglage.js",
  "demo-search-live.js", "demo/", "docs-copy.js", "docs-live-example.js",
  "docs-toc.js", "docs.html", "downloads/", "en/", "exemple-catalogue.csv",
  "faq.html", "favicon-32.png", "fonctionnalites.html", "fonts/",
  "guide-nudge.js", "guide-quiz.js", "guide-ux.js", "heurix-pictos.js",
  "img/", "index.html", "integrations.html", "langue-banniere.js", "llms.txt",
  "logo.png", "logo.svg", "mentions-legales.html", "mesure.html",
  "mobile-nav.js", "nav-dropdown.js", "og-image.png", "partners.html",
  "prestashop.html", "pricing-nudge.js", "pricing.html", "produit.html",
  "reveal.js", "robots.txt", "roi.html", "search-engine.js",
  "search-index-en.json", "search-index-fr.json", "secteurs.html",
  "shopify.html", "sitemap.xml", "solutions/", "styles.css",
  "supervision.html", "video/", "visite-editeur.js", "woocommerce.html",
  "xml-import.js",
]);

/** `tests/a/b.js` -> `tests/` ; `CLAUDE.md` -> `CLAUDE.md`. */
export function entreeDePremierNiveau(chemin) {
  const i = chemin.indexOf("/");
  return i === -1 ? chemin : chemin.slice(0, i + 1);
}

/** Les entrees internes DECLAREES qui portent au moins un fichier suivi. */
export function entreesInternesPresentes() {
  const presentes = new Set(fichiersSuivis().map(entreeDePremierNiveau));
  return INTERNES.filter((e) => presentes.has(e));
}

/** Entrees de premier niveau suivies qu'aucune des deux listes ne connait. */
export function entreesNonClassees() {
  const connues = new Set([...INTERNES, ...DU_SITE]);
  return [...new Set(fichiersSuivis().map(entreeDePremierNiveau))]
    .filter((e) => !e.startsWith(".")) // deja exclus de la publication
    .filter((e) => !connues.has(e))
    .sort();
}

/**
 * Les fragments : fichiers `.html` suivis sans `<html>`. Critere repris de
 * `tests/canonical.test.js`, qui l'emploie depuis le 27 aout 2026 pour decider
 * qu'une page n'a pas d'adresse canonique. Meme identite, deux consequences.
 */
export function fragmentsSuivis() {
  return fichiersSuivis()
    .filter((p) => p.endsWith(".html"))
    .filter((p) => !p.startsWith("docs/maquettes/"))
    .filter((p) => existsSync(join(RACINE, p)))
    .filter((p) => !/<html\b/i.test(readFileSync(join(RACINE, p), "utf8")));
}

/** Les chemins refuses dans robots.txt, dans l'ordre du fichier. */
export function reglesDisallow() {
  return readFileSync(join(RACINE, "robots.txt"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^Disallow:/i.test(l))
    .map((l) => l.replace(/^Disallow:\s*/i, ""))
    .filter(Boolean);
}
