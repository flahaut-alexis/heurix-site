import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const texte = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");

/* LES QUATORZE JOURS DE LA PREMIERE SOUSCRIPTION (18 septembre 2026).
 *
 * Le moteur accorde 14 jours sans prelevement a la premiere souscription
 * d'un plan Search faite pendant l'essai gratuit (heurix-engine, billing.py :
 * pas d'essai Stripe si la cle a deja eu un client Stripe, ni si l'essai
 * Heurix a expire). Le site ne le disait nulle part : seule la page de
 * paiement Stripe l'annoncait, au moment de payer. Decision d'Alexis : c'est
 * le texte qui change, et il annonce la rupture du jour 14 (« pendant l'essai
 * gratuit ») plutot que de la taire.
 *
 * VERSION 1.4, PAS 1.3. La 1.3 (becec0c1, engagement annuel) etait deja en
 * ligne quand ce paragraphe a ete ecrit. Rebase sur elle, il entrait SANS
 * CONFLIT dans son article 6 : seul l'en-tete de version conflictait, et le
 * garder aurait change une version publiee sans changer son numero. D'ou
 * les deux sens du test : la 1.4 porte le paragraphe, et les archives 1.2
 * et 1.3 ne l'ont pas -- personne ne « complete » une version figee.
 */

const CGV = [
  { f: "cgv.html", motif: /première souscription d'un Plan payant \(Starter, Growth ou Scale\)[^<]*lorsqu'elle intervient pendant l'essai gratuit, ouvre une période de quatorze \(14\) jours calendaires sans prélèvement/, version: /Version 1\.4, en vigueur depuis/ },
  { f: "en/cgv.html", motif: /first subscription to a paid Plan \(Starter, Growth or Scale\)[^<]*when it takes place during the free trial, opens a fourteen \(14\) calendar-day period without charge/, version: /Version 1\.4, in force since/ },
];

const TARIFS = [
  { f: "pricing.html", motif: /14 jours sans prélèvement<\/strong> si vous souscrivez pendant votre essai gratuit/ },
  { f: "en/pricing.html", motif: /No charge for 14 days<\/strong> if you subscribe during your free trial/ },
];

describe("les 14 jours de la première souscription pendant l'essai sont écrits là où l'on souscrit", () => {
  for (const c of CGV) {
    it(`${c.f} : article 6, version 1.4`, () => {
      expect(texte(c.f)).toMatch(c.motif);
      expect(texte(c.f)).toMatch(c.version);
    });
  }
  for (const c of TARIFS) {
    it(`${c.f} : note sous les plans`, () => {
      expect(texte(c.f)).toMatch(c.motif);
    });
  }
  it("les CGV 1.3 archivées sont la 1.3 publiée, sans le paragraphe", () => {
    expect(texte("cgv-1.3.html")).toMatch(/Version 1\.3, en vigueur (le|du) 18 septembre 2026/);
    expect(texte("cgv-1.3.html")).toMatch(/Chaque période engage le Client jusqu'à son terme/);
    expect(texte("en/cgv-1.3.html")).toMatch(/Version 1\.3, in force (on|from) September 18, 2026/);
    expect(texte("en/cgv-1.3.html")).toMatch(/Each period commits the Customer until its end/);
  });
  for (const f of ["cgv-1.2.html", "cgv-1.3.html"]) {
    it(`${f} n'a pas le paragraphe`, () => expect(texte(f)).not.toMatch(/première souscription d'un Plan payant/));
  }
  for (const f of ["en/cgv-1.2.html", "en/cgv-1.3.html"]) {
    it(`${f} n'a pas le paragraphe`, () => expect(texte(f)).not.toMatch(/first subscription to a paid Plan/));
  }
});
