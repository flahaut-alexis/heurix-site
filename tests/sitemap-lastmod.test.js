import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RACINE = path.join(import.meta.dirname, "..");

// ---------------------------------------------------------------------------
// UN <lastmod> QUI MENT EST PIRE QUE PAS DE <lastmod> (20 octobre 2026).
//
// Le sitemap declarait 140 URL et aucune date. Un robot ne savait donc pas
// quelle page relire, ce qui est un manque -- mais un manque VISIBLE.
//
// La date, elle, est une AFFIRMATION, et elle se perime toute seule : il
// suffit de modifier une page sans relancer le generateur. Rien ne le dirait.
// Le sitemap reste valide, le robot le lit, et il en conclut que la page n'a
// pas bouge depuis la derniere date ecrite -- exactement le defaut des
// sauvegardes sans `-wal` du moteur : un fichier qui nomme un instant qu'il
// ne porte pas.
//
// Ce garde relit donc chaque date contre `git log`, et rougit sur l'ecart.
// Le remede est une commande : scripts/sitemap-lastmod.py
//
// CE QU'IL NE VOIT PAS, ET IL FAUT LE LIRE AVANT DE LUI FAIRE CONFIANCE :
//
//   1. Il compare a la date du DERNIER COMMIT qui a touche le fichier, pas
//      a la derniere modification EDITORIALE. Un commit qui change la ligne
//      de navigation de 158 pages remet 158 <lastmod> a sa date, et ce garde
//      trouve cela juste. Mesure du 20 octobre : les 140 dates ne prennent
//      que SIX valeurs distinctes, entre le 19 septembre et le 20 octobre --
//      la trace des lots qui balayent tout le site, pas celle des pages.
//      Un <lastmod> ne dit donc pas « le texte a change », il dit « le
//      fichier a change ». C'est ce que la specification demande, et c'est
//      moins que ce que son nom suggere.
//
//   2. Il ne verifie pas que les dates sont PLAUSIBLES vis-a-vis du
//      contenu : un article qui annonce « Juillet 2026 » dans son corps et
//      porte un <lastmod> d'octobre ne le fait pas rougir.
// ---------------------------------------------------------------------------

const SITEMAP = fs.readFileSync(path.join(RACINE, "sitemap.xml"), "utf8");

const gitBrut = (...a) =>
  execFileSync("git", ["--no-optional-locks", ...a], { cwd: RACINE, encoding: "utf8" });
const git = (...a) => gitBrut(...a).trim();

/** Le fichier du depot derriere une URL du sitemap. */
const chemin = (loc) => loc.replace("https://heurix.fr/", "") || "index.html";

/** Un bloc <url> par entree, dans les DEUX mises en page du fichier. */
const blocs = [...SITEMAP.matchAll(/[ \t]*<url>[\s\S]*?<\/url>/g)].map((m) => m[0]);

const entrees = blocs.map((b) => ({
  bloc: b,
  loc: (/<loc>(.*?)<\/loc>/.exec(b) || [])[1],
  lastmod: [...b.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map((m) => m[1]),
}));

/** Les fichiers qui divergent de HEAD : leur date de commit n'est pas encore ecrite. */
// `gitBrut` ET NON `git` : un `.trim()` sur la sortie entiere mange l'espace
// de tete de la PREMIERE ligne -- « \u0020M about.html » devient
// « M about.html », et `slice(3)` rendait « bout.html ». Le fichier modifie
// sortait alors de cet ensemble, et le garde le comparait a une date de
// commit qui ne le concernait pas encore.
const sales = new Set(
  gitBrut("status", "--porcelain")
    .split("\n")
    .map((l) => /^.. (.*)$/.exec(l))
    .filter(Boolean)
    .map((m) => m[1].trim())
);

describe("sitemap — chaque URL porte une date, et la date est celle du commit", () => {
  // Un clone superficiel ne porte qu'un commit : `git log -1 -- <fichier>`
  // rendrait la meme date pour tout, et les assertions ci-dessous
  // passeraient au vert sur une comparaison qui ne compare plus rien. La CI
  // pose `fetch-depth: 0` sur le job « Suite de tests » pour cette raison ;
  // ici on REFUSE au lieu de supposer.
  it("l'historique est complet -- sinon il n'y a rien a comparer", () => {
    expect(git("rev-parse", "--is-shallow-repository")).toBe("false");
  });

  it("le balayage a reellement trouve les URL du sitemap", () => {
    expect(entrees.length).toBe((SITEMAP.match(/<loc>/g) || []).length);
    expect(entrees.length).toBeGreaterThanOrEqual(130);
  });

  it("chaque URL porte exactement un <lastmod>", () => {
    const fautives = entrees
      .filter((e) => e.lastmod.length !== 1)
      .map((e) => `${e.loc} : ${e.lastmod.length} <lastmod>`);
    expect(fautives, "Lancez scripts/sitemap-lastmod.py").toEqual([]);
  });

  it("chaque <lastmod> est une date ISO, et pas dans l'avenir", () => {
    // HEURE LOCALE, PAS UTC -- et ce n'est pas une inattention (23 octobre
    // 2026). scripts/sitemap-lastmod.py pose la date avec
    // `datetime.date.today()`, en heure locale. Entre minuit local et l'heure
    // ou l'UTC rattrape le jour (02:00 locale en ete, 01:00 en hiver), un
    // `toISOString()` lit encore la veille : mesure du 22 octobre a 00:04,
    // le script a ecrit 2026-10-22 et ce garde repondait "est dans
    // l'avenir" sur deux URL, alors que la date etait exacte.
    //
    // Passer le GENERATEUR en UTC deplacerait la panne sur l'assertion
    // suivante ("chaque <lastmod> est la date d'auteur ... %as") : %as est
    // elle-meme en heure locale, et n'est pas a nous de changer. La seule
    // date qui s'accorde avec les deux est l'heure locale.
    const maintenant = new Date();
    const aujourdhui = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}-${String(maintenant.getDate()).padStart(2, "0")}`;
    const fautives = [];
    for (const e of entrees) {
      const d = e.lastmod[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) fautives.push(`${e.loc} : « ${d} » n'est pas une date ISO`);
      else if (d > aujourdhui) fautives.push(`${e.loc} : ${d} est dans l'avenir`);
    }
    expect(fautives).toEqual([]);
  });

  it("chaque URL correspond a un fichier du depot", () => {
    const absents = entrees
      .map((e) => chemin(e.loc))
      .filter((f) => !fs.existsSync(path.join(RACINE, f)));
    expect(absents).toEqual([]);
  });

  it("chaque <lastmod> est la date d'auteur du dernier commit du fichier", () => {
    // La date d'AUTEUR (%as) et non de committer (%cs) : un rebase reecrit
    // la seconde et perimerait les 140 dates d'un coup, pour une raison qui
    // n'a rien a voir avec les pages.
    const ecarts = [];
    let compares = 0;
    for (const e of entrees) {
      const f = chemin(e.loc);
      if (sales.has(f)) continue; // le commit en cours n'existe pas encore
      const attendu = git("log", "-1", "--format=%as", "--", f);
      if (!attendu) {
        ecarts.push(`${f} : aucun commit ne porte ce fichier`);
        continue;
      }
      compares++;
      if (e.lastmod[0] !== attendu)
        ecarts.push(`${f} : <lastmod>${e.lastmod[0]}</lastmod> mais dernier commit ${attendu}`);
    }
    expect(ecarts, "Lancez scripts/sitemap-lastmod.py").toEqual([]);
    // Si tout le sitemap etait « sale », la boucle ci-dessus ne comparerait
    // rien et sortirait verte. Le plancher l'interdit.
    expect(compares).toBeGreaterThanOrEqual(100);
  });
});
