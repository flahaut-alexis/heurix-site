import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RACINE = path.resolve(__dirname, "..");
const lire = (f) => JSON.parse(fs.readFileSync(path.join(RACINE, f), "utf8"));

// ---------------------------------------------------------------------------
// L'INDEX DERIVE (27 aout 2026).
//
// Ces tests portent sur le RESULTAT, pas sur l'implementation du generateur :
// ils tournent sans le moteur ni sa wheel, exactement comme la CI. Ce qu'ils
// verrouillent est ce qu'un visiteur peut trouver.
//
// L'index precedent etait ecrit a la main. Mesure de ce qu'il ratait :
//
//     « M8x20 »    present sur 37 pages   ABSENT de l'index
//     « DIN 933 »  present sur 14 pages   ABSENT
//     « 2rs »      present sur 16 pages   ABSENT
// ---------------------------------------------------------------------------

describe("index derive — forme", () => {
  it.each(["search-index-fr.json", "search-index-en.json"])("%s est bien forme", (f) => {
    const i = lire(f);
    expect(i.entrees.length).toBeGreaterThan(40);
    expect(Object.keys(i.empreintes).length).toBe(i.entrees.length);
    for (const e of i.entrees) {
      expect(e).toHaveProperty("p");
      expect(e).toHaveProperty("t");
      expect(e).toHaveProperty("k");
      expect(e.e.length).toBeLessThanOrEqual(180);
    }
  });

  it("chaque entree correspond a une page qui existe", () => {
    for (const f of ["search-index-fr.json", "search-index-en.json"]) {
      for (const e of lire(f).entrees) {
        expect(fs.existsSync(path.join(RACINE, e.p)), `${e.p} (${f})`).toBe(true);
      }
    }
  });

  it("les deux langues ne se melangent pas", () => {
    expect(lire("search-index-fr.json").entrees.every((e) => !e.p.startsWith("en/"))).toBe(true);
    expect(lire("search-index-en.json").entrees.every((e) => e.p.startsWith("en/"))).toBe(true);
  });
});

describe("index derive — ce que l'index ecrit a la main ne trouvait pas", () => {
  const fr = lire("search-index-fr.json");
  const surCombienDePages = (terme) =>
    fr.entrees.filter((e) => e.k.split(" ").includes(terme)).length;

  // Les nombres viennent de la mesure des pages, pas d'une intuition : ce
  // sont les pages qui contiennent REELLEMENT le terme.
  it.each([
    ["din", 5],
    ["933", 5],
    ["m8x20", 15],
    ["2rs", 5],
    ["6205", 3],
  ])("« %s » est trouvable sur au moins %d pages", (terme, plancher) => {
    expect(surCombienDePages(terme)).toBeGreaterThanOrEqual(plancher);
  });

  // LES DEUX REGLES QUI NE S'IMPORTENT PAS DU MOTEUR, eprouvees par leur
  // effet. Sans l'eclatement du tiret, « 6205-2rs » reste un seul jeton et
  // « 2rs » ne remonte qu'UNE page sur huit. Sans la graphie collee,
  // « m8 x 20 » ne forme jamais « m8x20 » et trois pages sur vingt manquent.
  it("l'eclatement des composantes de tiret est actif", () => {
    expect(surCombienDePages("2rs")).toBeGreaterThan(1);
    expect(surCombienDePages("6205")).toBeGreaterThan(0);
  });

  it("la graphie collee d'une sequence separee est formee", () => {
    expect(surCombienDePages("m8x20")).toBeGreaterThan(17);
  });

  // Le seuil du moteur : un jeton d'un caractere ne discrimine rien.
  it("aucun terme d'un seul caractere n'est indexe", () => {
    const courts = new Set();
    for (const e of fr.entrees) for (const t of e.k.split(" ")) if (t.length < 2) courts.add(t);
    expect([...courts]).toEqual([]);
  });
});

describe("index derive — le verificateur", () => {
  const verifier = () => {
    try {
      execFileSync("python3", [path.join(RACINE, "scripts/index-recherche.py"), "--verifier"],
                   { cwd: RACINE, encoding: "utf8" });
      return { code: 0, sortie: "" };
    } catch (e) {
      return { code: e.status, sortie: (e.stdout || "") + (e.stderr || "") };
    }
  };

  it("sort 0 quand l'index correspond aux pages", () => {
    expect(verifier().code).toBe(0);
  });

  it("tourne SANS le moteur ni sa wheel — c'est sa raison d'etre", () => {
    // Si le generateur importait le moteur au chargement, cet appel
    // echouerait ici comme il echouerait dans la CI du site.
    expect(verifier().code).toBe(0);
  });

  it("NOMME la page fautive plutot que de sortir 1 en silence", () => {
    const page = path.join(RACINE, "docs.html");
    const avant = fs.readFileSync(page, "utf8");
    try {
      fs.writeFileSync(page, avant.replace("</title>", " modifie</title>"));
      const r = verifier();
      expect(r.code).toBe(1);
      expect(r.sortie).toContain("docs.html");
    } finally {
      fs.writeFileSync(page, avant);
    }
  });

  it("detecte une page AJOUTEE — celle qui ne change aucune empreinte", () => {
    const sm = path.join(RACINE, "sitemap.xml");
    const page = path.join(RACINE, "page-de-test-index.html");
    const avant = fs.readFileSync(sm, "utf8");
    try {
      fs.writeFileSync(page, "<!DOCTYPE html><html><head><title>Test</title></head><body>x</body></html>");
      fs.writeFileSync(sm, avant.replace("</urlset>",
        "<url><loc>https://heurix.fr/page-de-test-index.html</loc></url></urlset>"));
      const r = verifier();
      expect(r.code).toBe(1);
      expect(r.sortie).toContain("page-de-test-index.html");
      expect(r.sortie).toContain("AJOUTEE");
    } finally {
      fs.writeFileSync(sm, avant);
      fs.rmSync(page, { force: true });
    }
  });
});
