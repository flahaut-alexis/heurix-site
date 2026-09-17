import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// CE QUE LE SITE PROMET AU-DELA DU QUOTA (17 septembre 2026).
//
// MESURE SUR LE MOTEUR (heurix-engine d103c0d, UsageDB sur une base jetable,
// chaque plan pousse a trois fois son quota) : la requete est servie et
// comptee, `over_limit` passe a vrai, et rien n'est facture. Aucun des six
// appels Stripe de heurix/billing.py ne transmet d'usage ; les lignes de
// checkout portent `quantity: 1`. Detail : docs/MESURE-DEPASSEMENT-FACTURE.md.
//
// DECISION DU 14 SEPTEMBRE : le site dit cette verite pour Starter et Growth
// (recherche) et pour les trois paliers Ranking. SCALE (RECHERCHE) RESTE EN
// ATTENTE des requetes de production : sa carte (« puis 0,80 € / 1 000 »),
// le calculateur (« Scale + depassement facture ») et la documentation
// (« Depassement (Scale) », « 150 000 puis facture ») ne changent pas.
//
// LES PROMESSES GENERALES (metas, tableau de comptage, deux FAQ, llms.txt,
// CGV art. 7) couvrent aussi Scale. Elles disent donc la regle sans nommer
// de plan : « un depassement n'est facture que si votre plan affiche un
// tarif de depassement ». Starter, Growth et Ranking n'en affichent aucun ;
// Scale garde celui de sa carte, tel quel.
//
// CE GARDE INTERDIT LES PHRASES RETIREES, pas la famille « facture ». Un motif
// large mordrait docs.html « Depassement (Scale) : le surplus est facture au
// tarif indique », qui doit rester tant que Scale n'est pas tranche -- mesure
// avant d'ecrire. Il ne protege pas non plus les lignes Scale : un garde qui
// les exigerait refuserait la decision encore a prendre.
//
// `docs/` est exclu : le releve y cite les phrases retirees. Les CGV 1.0 le
// sont aussi, nommement : elles sont publiees telles que des clients les ont
// acceptees, article 7 compris.
// ---------------------------------------------------------------------------

const ARCHIVES = ["cgv-1.0.html", "en/cgv-1.0.html"];

const PUBLIES = execFileSync("git", ["ls-files"], { cwd: RACINE, encoding: "utf8" })
  .split("\n")
  .filter((f) => f && /\.(html|md|txt)$/.test(f) && !f.startsWith("docs/") && !ARCHIVES.includes(f));

const texte = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");

const RETIREES = [
  {
    quoi: "cartes Ranking : depassement facture a l'usage",
    motif: /D[ée]passement\s+factur[ée]\s+[àa]\s+l['’]usage|Overage\s+billed\s+by\s+usage/i,
  },
  {
    quoi: "metas tarifs : facturation a l'usage",
    motif: /Facturation\s+[àa]\s+l['’]usage,\s+sans\s+engagement|Usage-based\s+billing,\s+no\s+commitment/i,
  },
  {
    quoi: "tableau de comptage : facture au tarif indique sur votre plan",
    motif: /factur[ée]\s+au\s+tarif\s+indiqu[ée]\s+sur\s+votre\s+plan|billed\s+at\s+the\s+rate\s+shown\s+on\s+your\s+plan/i,
  },
  {
    quoi: "FAQ tarifs : facture au tarif par tranche",
    motif: /factur[ée]\s+au\s+tarif\s+par\s+tranche|billed\s+at\s+the\s+per-tier\s+rate/i,
  },
  {
    quoi: "FAQ : facture au tarif a l'usage indique",
    motif: /factur[ée]\s+au\s+tarif\s+[àa]\s+l['’]usage|billed\s+at\s+the\s+usage\s+rate/i,
  },
  {
    quoi: "llms.txt : plans factures a l'usage",
    motif: /\(139\s*€\/mois\),\s+facturation\s+[àa]\s+l['’]usage/i,
  },
  {
    quoi: "calculateur Browse : + depassement facture",
    motif: /['"],\s*\+\s*(d[ée]passement\s+factur[ée]|overage\s+billed)['"]/i,
  },
  {
    quoi: "CGV art. 7 : le surplus est facture, sans condition",
    motif: /le\s+surplus\s+est\s+factur[ée]\s+selon\s+les\s+r[èe]gles|is\s+billed\s+according\s+to\s+the\s+public\s+counting\s+rules/i,
  },
];

describe("dépassement — ce que le site promet", () => {
  it.each(RETIREES)("aucune page ne dit : $quoi", ({ motif }) => {
    const coupables = PUBLIES.filter((f) => motif.test(texte(f)));
    expect(coupables, `promesse retirée, encore présente dans :\n  ${coupables.join("\n  ")}`)
      .toEqual([]);
  });

  // TEMOIN POSITIF : les lignes propres a Scale, qui restent. Si elles ne sont
  // pas trouvees, c'est le balayage qui est casse -- ou Scale a ete tranche,
  // et ce commentaire comme ce temoin sont a reecrire avec la decision.
  it("le balayage lit vraiment les pages qu'il prétend lire", () => {
    expect(PUBLIES).toContain("pricing.html");
    expect(PUBLIES).toContain("en/faq.html");
    expect(PUBLIES).toContain("en/cgv.html");
    expect(PUBLIES.some((f) => f.startsWith("docs/"))).toBe(false);
    expect(texte("pricing.html")).toMatch(/puis 0,80 € \/ 1 000/);
    expect(texte("en/pricing.html")).toMatch(/then €0\.80 \/ 1,000/);
    expect(texte("docs.html")).toMatch(/Dépassement \(Scale\)/);
  });

  // L'exclusion ne vaut que pour des archives : si l'une cessait de porter
  // l'ancien article 7, elle ne serait plus la version acceptee.
  it("les CGV 1.0 publiées portent l'article 7 d'origine", () => {
    const cgv7 = RETIREES.find((r) => r.quoi.startsWith("CGV")).motif;
    for (const f of ARCHIVES) {
      expect(texte(f)).toMatch(cgv7);
      expect(texte(f)).toMatch(/Version 1\.0/);
    }
  });
});
