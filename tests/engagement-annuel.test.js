import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// L'ABONNEMENT ANNUEL ENGAGE POUR DOUZE MOIS (CGV 1.3, 18 septembre 2026).
//
// MESURE AVANT D'ECRIRE : Stripe live porte les prix *_ANNUAL (intervalle
// `year`, 12 x mensuel x 0,9), la production rend `annual_available: true`,
// et un abonnement annuel Stripe se reconduit seul pour douze mois prepayes.
// Le moteur ne resilie ni ne rembourse rien (heurix-engine a284ba2).
//
// DECISION D'ALEXIS : pas de sortie anticipee ni de remboursement ; une
// resiliation possible a tout moment, avec effet au terme des douze mois ;
// sinon reconduction pour douze mois. C'est ce que fait Stripe.
//
// Le site promettait « sans engagement » et « arreter a tout moment » sans
// distinguer la periodicite, a cote de la bascule Annuel. CE GARDE INTERDIT
// CES PHRASES-LA, pas le mot « engagement » : la promesse reste vraie en
// mensuel, et les pages le disent.
//
// `docs/` est exclu, comme dans depassement-promesses. Les CGV 1.0, 1.1 et
// 1.2 le sont nommement : publiees telles qu'elles ont ete acceptees, avec
// l'ancien article 8.
// ---------------------------------------------------------------------------

const ARCHIVES = [
  "cgv-1.0.html", "en/cgv-1.0.html",
  "cgv-1.1.html", "en/cgv-1.1.html",
  "cgv-1.2.html", "en/cgv-1.2.html",
];

const PUBLIES = execFileSync("git", ["ls-files"], { cwd: RACINE, encoding: "utf8" })
  .split("\n")
  .filter((f) => f && /\.(html|md|txt)$/.test(f) && !f.startsWith("docs/") && !ARCHIVES.includes(f));

const texte = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");

const CGV8_ANCIEN = /<p>L['’]abonnement\s+est\s+conclu\s+pour\s+une\s+dur[ée]e\s+ind[ée]termin[ée]e|<p>The\s+subscription\s+is\s+for\s+an\s+indefinite\s+term/;

const RETIREES = [
  {
    quoi: "tarifs, note et FAQ : facturation mensuelle sans engagement, sans periodicite",
    // Ancre sur le debut de phrase : « En facturation mensuelle, sans engagement »
    // est la forme bornee, qu'un motif sans ancre mordait.
    motif: /(HT|Oui)\.\s+Facturation\s+mensuelle,\s+(sans|aucun)\s+engagement|(VAT|Yes)\.\s+Monthly\s+billing,\s+no\s+long-term\s+commitment/,
  },
  {
    quoi: "metas tarifs : sans engagement, sans periodicite",
    motif: /[àa]\s+partir\s+de\s+gratuit,\s+sans\s+engagement\.|starting\s+free,\s+no\s+commitment\./i,
  },
  {
    quoi: "llms.txt : sans engagement, sans periodicite",
    motif: /\(139\s*€\/mois\),\s+sans\s+engagement,/i,
  },
  {
    quoi: "console : resilier a tout moment, sans date d'effet",
    motif: /pouvez\s+r[ée]silier\s+[àa]\s+tout\s+moment\.|can\s+cancel\s+anytime\./i,
  },
  {
    quoi: "CGV art. 8 : duree indeterminee pour tout abonnement",
    motif: CGV8_ANCIEN,
  },
];

describe("engagement annuel — ce que le site promet", () => {
  it.each(RETIREES)("aucune page ne dit : $quoi", ({ motif }) => {
    const coupables = PUBLIES.filter((f) => motif.test(texte(f)));
    expect(coupables, `promesse retirée, encore présente dans :\n  ${coupables.join("\n  ")}`)
      .toEqual([]);
  });

  // TEMOIN POSITIF : le balayage lit les pages, et la promesse mensuelle y est
  // encore, bornee au mensuel.
  it("le balayage lit vraiment les pages qu'il prétend lire", () => {
    expect(PUBLIES).toContain("pricing.html");
    expect(PUBLIES).toContain("en/console.html");
    expect(PUBLIES).toContain("llms.txt");
    expect(PUBLIES).toContain("cgv.html");
    expect(PUBLIES.some((f) => f.startsWith("docs/"))).toBe(false);
    expect(texte("pricing.html")).toMatch(/En facturation mensuelle, sans engagement de durée/);
    expect(texte("en/pricing.html")).toMatch(/With monthly billing, no long-term commitment/);
  });

  it("les CGV en vigueur disent l'engagement annuel et la résiliation au terme", () => {
    expect(texte("cgv.html")).toMatch(/Chaque période engage le Client jusqu'à son terme/);
    expect(texte("cgv.html")).toMatch(/la résiliation prend effet au terme de la période en cours/);
    expect(texte("en/cgv.html")).toMatch(/Each period commits the Customer until its end/);
    expect(texte("en/cgv.html")).toMatch(/termination takes effect at the end of the current period/);
  });

  // L'exclusion ne vaut que pour des archives : si l'une cessait de porter
  // l'ancien article 8, elle ne serait plus la version acceptee.
  it.each(ARCHIVES)("%s porte l'article 8 d'origine", (f) => {
    expect(texte(f)).toMatch(CGV8_ANCIEN);
  });
});
