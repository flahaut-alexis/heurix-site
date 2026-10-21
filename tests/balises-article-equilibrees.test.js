import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* UNE FERMETURE `</article>` EN TROP NE SE VOIT NULLE PART AILLEURS.
 *
 * Mesure du 21 octobre 2026 : six pages -- les trois articles sectoriels de
 * `1fc6a179`, dans les deux langues -- portent UNE ouverture
 * `<article class="post">` et DEUX fermetures, cote a cote juste avant
 * `<footer>`. Le `git blame` de la ligne surnumeraire nomme 1fc6a179 sur
 * chacune des six.
 *
 * AUCUN GARDE DU DEPOT NE POUVAIT LE VOIR, et ce n'est pas un oubli isole :
 * c'est une consequence de ce que chacun lit.
 *   - `schema-article.test.js` lit le JSON-LD, pas le balisage ;
 *   - `hierarchie-titres.test.js` lit la suite des h1..h6 ;
 *   - `entete-structure.test.js` compare des entetes entre elles ;
 *   - `pages-indexables.js` et ses trois clients cherchent une ABSENCE
 *     (pas de h1, pas de JSON-LD, pas d'og:image) -- une balise EN TROP
 *     leur est invisible par construction.
 * Le navigateur, lui, ignore silencieusement une fermeture orpheline : rien
 * dans le rendu ne la signale non plus.
 *
 * ---------------------------------------------------------------------------
 * CE QUE CE GARDE LIT, ET SUR QUELLE POPULATION
 *
 * Il ne compte pas, il EMPILE. Deux comptes egaux ne disent pas que le
 * document est bien forme : `</article><article>` s'equilibre et reste faux.
 * Le parcours ordonne distingue en plus deux pannes qui n'envoient pas
 * chercher au meme endroit -- une fermeture sans ouverture (le cas des six)
 * et une ouverture jamais fermee.
 *
 * LE PERIMETRE EST VOLONTAIREMENT PLUS LARGE QUE `pages-indexables.js`.
 * Ce module-la definit les 146 pages INDEXABLES, et c'est juste pour les
 * gardes qui parlent de referencement. Un balisage casse l'est aussi sur une
 * page `noindex` : la console, les CGV archivees, 404.html. Ce garde lit donc
 * les 180 `.html` SUIVIS par git, sans filtre -- meme raison que
 * `surface-publiee.js` pour `ls-files` plutot qu'un balayage du disque : un
 * balayage ramasse les harnais temporaires des sessions voisines, et un
 * fichier non suivi n'est jamais servi.
 *
 * LIMITE ASSUMEE, A VALIDER : le parcours est TEXTUEL. Il ne retire ni les
 * commentaires HTML, ni le contenu de `<pre>`, `<code>` ou `<script>`. Un
 * `<!-- </article> -->` le ferait donc rougir a tort. Mesure du 21 octobre
 * 2026 sur les 180 fichiers : zero occurrence en commentaire, zero forme
 * echappee `&lt;article`, zero auto-fermeture `<article/>`. Le jour ou un
 * article de blog montrera du HTML dans un exemple de code, c'est ici qu'il
 * faudra ajouter le retrait -- pas contourner par une liste d'exceptions.
 * ---------------------------------------------------------------------------
 */

const RACINE = join(import.meta.dirname, "..");

/** Les .html SUIVIS par git, chemins relatifs, separateur `/`. */
const htmlSuivis = () =>
  execFileSync("git", ["--no-optional-locks", "ls-files", "-z", "*.html"],
               { cwd: RACINE, encoding: "utf8" })
    .split("\0").filter(Boolean).sort();

const ligneDe = (source, index) => source.slice(0, index).split("\n").length;

/**
 * Parcourt les balises `<article>` dans l'ordre et rend les anomalies.
 * Une fermeture qui fait passer la profondeur sous zero est signalee sur
 * place, puis la profondeur est ramenee a zero : une page a deux fermetures
 * surnumeraires doit les nommer toutes les deux, pas seulement la premiere.
 */
function anomalies(fichier, source) {
  const trouvees = [];
  let profondeur = 0;
  let derniereOuverture = null;
  for (const m of source.matchAll(/<article\b[^>]*>|<\/article\s*>/gi)) {
    const ligne = ligneDe(source, m.index);
    if (m[0][1] === "/") {
      if (profondeur === 0)
        trouvees.push(`${fichier}:${ligne} : </article> ferme un <article> qui n'est pas ouvert`);
      else profondeur--;
    } else {
      profondeur++;
      derniereOuverture = ligne;
    }
  }
  if (profondeur > 0)
    trouvees.push(`${fichier}:${derniereOuverture} : <article> ouvert et jamais ferme (${profondeur} en attente)`);
  return trouvees;
}

const pages = htmlSuivis().map((f) => ({
  fichier: f,
  source: readFileSync(join(RACINE, f), "utf8"),
}));
const avecArticle = pages.filter((p) => /<article\b/i.test(p.source));

describe("balises <article> : le perimetre examine", () => {
  /* LES DEUX PLANCHERS, ET POURQUOI ILS NE SONT PAS SERRES.
   *
   * La lecon de `pages-indexables.js` et de `hreflang-reciproque.test.js` :
   * un perimetre derive par filtre sort VERT quand il se vide, et personne
   * ne l'apprend. Ici deux filtres peuvent se vider -- `ls-files` hors d'un
   * depot, et le sous-ensemble porteur de `<article>`.
   *
   * `pages-indexables.js` pose son plancher EGAL a sa mesure, et c'est
   * justifie la-bas : les 146 doivent valoir les <loc> du sitemap, donc une
   * page retiree est un fait a venir ecrire ici. Ce garde-ci n'enumere
   * rien : il tient un invariant sur les pages qui existent, quelles
   * qu'elles soient. Un plancher egal le ferait rougir a chaque page
   * retiree, pour une raison qui n'est pas la sienne. Il est donc SOUS la
   * mesure du 21 octobre 2026 -- 180 fichiers suivis, 120 porteurs d'au
   * moins un <article> -- assez bas pour encaisser quelques retraits, assez
   * haut pour qu'un perimetre effondre devienne rouge au lieu de vert.
   */
  it("au moins 170 fichiers .html suivis sont lus (mesure du 21 octobre 2026 : 180)", () => {
    expect(pages.length).toBeGreaterThanOrEqual(170);
  });

  it("au moins 110 d'entre eux portent un <article> (mesure du 21 octobre 2026 : 120)", () => {
    expect(avecArticle.length).toBeGreaterThanOrEqual(110);
  });
});

describe("balises <article> : chaque ouverture a exactement une fermeture", () => {
  it("aucune fermeture orpheline, aucune ouverture en attente", () => {
    const casse = pages.flatMap(({ fichier, source }) => anomalies(fichier, source));
    expect(
      casse,
      "Une fermeture `</article>` en trop est ignoree par le navigateur : "
      + "ni le rendu ni aucun autre garde ne la signale.",
    ).toEqual([]);
  });
});
