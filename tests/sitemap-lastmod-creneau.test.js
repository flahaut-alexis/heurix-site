import { describe, it, expect, vi, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// LE CRENEAU LOCAL/UTC N'EST OBSERVABLE QUE DEUX HEURES PAR NUIT (23 octobre
// 2026). Le reste du temps, l'heure locale et l'UTC tombent sur le meme
// jour : la distinction n'a alors aucun sujet, et l'assertion corrigee dans
// sitemap-lastmod.test.js ("pas dans l'avenir", desormais en heure locale)
// est VRAIE SANS ETRE EXERCEE. Un garde qu'on ne peut mettre a l'epreuve
// qu'en veillant entre minuit et deux heures du matin n'en est pas un.
//
// CE FICHIER EPINGLE L'HORLOGE pour forcer le creneau a volonte. L'instant
// est injectable sans aucune extraction : vi.setSystemTime() pilote
// `new Date()` nu, meme non enveloppe dans une fonction -- verifie
// empiriquement avant d'ecrire ce fichier, pas suppose. Rien n'a donc ete
// change dans sitemap-lastmod.test.js pour rendre ce temoin possible.
//
// L'INSTANT EPINGLE : 2026-10-22T01:00:00+02:00 (heure d'ete). A cet
// instant, le jour local est deja le 22 ; l'UTC (23:00 le 21) est encore le
// 21. C'est le creneau mesure le 22 octobre a 00:04, ou le generateur
// (heure locale) avait ecrit 2026-10-22 et l'ancien garde (UTC) repondait
// « est dans l'avenir ».
// ---------------------------------------------------------------------------

// Le calcul desormais dans sitemap-lastmod.test.js : heure locale, champ par
// champ.
function aujourdhuiLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// L'ANCIENNE EXPRESSION, celle que ce lot a retiree de
// sitemap-lastmod.test.js. Gardee ici pour une seule raison : prouver
// qu'elle se trompe dans le creneau. Elle ne lit aucun code de production
// et ne protege pas contre un revert direct -- elle documente et pin la
// raison pour laquelle on n'y revient pas.
function aujourdhuiUTC() {
  return new Date().toISOString().slice(0, 10);
}

describe("sitemap — le garde « pas dans l'avenir » tient dans le creneau local/UTC", () => {
  // vi.setSystemTime() sans ce teardown contaminerait les tests suivants,
  // dans ce fichier comme dans les autres : toujours restituer l'horloge
  // reelle, meme si l'assertion precedente a leve.
  afterEach(() => { vi.useRealTimers(); });

  it("a 01:00 heure locale (ete), le jour local courant n'est pas rejete", () => {
    vi.setSystemTime(new Date("2026-10-22T01:00:00+02:00"));
    const candidat = "2026-10-22"; // ce que le generateur ecrit a cet instant
    expect(candidat > aujourdhuiLocal()).toBe(false);
  });

  it("MUTATION DE REGRESSION -- la meme date, jugee avec l'ancienne expression UTC, rougit", () => {
    // C'est l'assertion qui protege le correctif : si sitemap-lastmod.test.js
    // revenait a `new Date().toISOString().slice(0, 10)`, c'est exactement
    // ce verdict qu'il rendrait -- le defaut du 22 octobre, a l'identique.
    vi.setSystemTime(new Date("2026-10-22T01:00:00+02:00"));
    const candidat = "2026-10-22";
    expect(candidat > aujourdhuiUTC()).toBe(true);
  });

  it("dans le meme creneau, une date au lendemain local rougit toujours", () => {
    vi.setSystemTime(new Date("2026-10-22T01:00:00+02:00"));
    const lendemainLocal = "2026-10-23";
    expect(lendemainLocal > aujourdhuiLocal()).toBe(true);
  });
});
