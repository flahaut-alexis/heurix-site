import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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
    // UNE EMPREINTE PAR PAGE, PAS PAR ENTREE. Une page peut produire
    // plusieurs entrees : la page elle-meme, plus une par titre portant
    // deja un `id`. L'empreinte, elle, porte sur le contenu de la PAGE.
    const pages = new Set(i.entrees.map((e) => e.p.split("#")[0]));
    expect(Object.keys(i.empreintes).length).toBe(pages.size);
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
        const fichier = e.p.split("#")[0];
        expect(fs.existsSync(path.join(RACINE, fichier)), `${e.p} (${f})`).toBe(true);
      }
    }
  });

  // Les quatre ancres de l'index ecrit a la main (produit.html#probleme,
  // index.html#comment-ca-marche...) auraient disparu d'une derivation naive :
  // une entree par page, et le visiteur atterrit en haut d'une page longue.
  // On garde les titres qui portent DEJA un `id` -- 21 sur les 54 pages FR,
  // contre 369 si on indexait tous les h2 sans rien y gagner.
  it("les ancres deliberees survivent a la derivation", () => {
    const ancrees = lire("search-index-fr.json").entrees.filter((e) => e.p.includes("#"));
    expect(ancrees.length).toBeGreaterThanOrEqual(15);
    for (const e of ancrees) {
      const [fichier, frag] = e.p.split("#");
      const src = fs.readFileSync(path.join(RACINE, fichier), "utf8");
      expect(src, `${e.p} : l'ancre doit exister dans la page`).toContain(`id="${frag}"`);
      expect(e.t.length).toBeGreaterThan(0);
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
  // LE SABOTAGE VIT DANS UNE COPIE, JAMAIS DANS L'ARBRE (29 aout 2026).
  //
  // Deux de ces tests doivent abimer un fichier pour verifier que le
  // verificateur le remarque. Ils le faisaient dans l'arbre SUIVI, avec une
  // restauration en `finally` -- et un `finally` ne s'execute pas quand le
  // processus meurt : delai vitest depasse, Ctrl-C, plantage.
  //
  // CE QUE CA A COUTE, mesure le 29 aout : quatre tentatives de push refusees,
  // dont deux ou docs.html portait encore « Documentation API — Heurix
  // modifie ». Le cycle s'entretient tout seul -- le test sabote, depasse son
  // delai, la trace reste, le controle suivant echoue A CAUSE de la trace,
  // relance le test, qui sabote a nouveau. La veille, ce marqueur avait atteint
  // la PRODUCTION et y etait reste des heures.
  //
  // La restauration en `finally` avait deja ete durcie deux fois -- refus de
  // tourner si le marqueur est la, restauration par retrait plutot que par
  // instantane. Les deux vivent dans le processus, donc les deux sautent avec
  // lui. On ne durcit plus : on ne touche plus au fichier suivi.
  //
  // COUT MESURE de la copie : `git worktree add --detach` 216 ms, 17 Mo,
  // `git worktree remove --force` 70 ms -- environ 10 % des 2,9 s que prend le
  // verificateur lui-meme. Une copie simple ne suffit PAS : le verificateur
  // appelle `derniers_articles()` -> `date_ajout()` -> `git -C RACINE log`, et
  // un repertoire sans `.git` le fait echouer sur « clone superficiel ».
  //
  // Si le processus meurt pendant la copie, c'est la copie qui reste sale, et
  // surtout AUCUN fichier suivi n'a bouge. EPROUVE le 30 aout 2026 : huit
  // SIGKILL a 3,0 / 3,5 / 4,0 / 4,5 / 5,0 / 6,0 / 7,0 / 8,0 s, a cheval sur
  // les deux tests saboteurs. Huit fois sur huit, `docs.html` et
  // `search-index-fr.json` intacts, marqueur absent, `git status` propre.
  //
  // LE NETTOYAGE, EN REVANCHE, N'EST PAS CELUI QU'ON ANNONCAIT ICI. La ligne
  // precedente disait « `git worktree prune` la nettoie » : c'est FAUX, et
  // mesure. `prune` ne retire que les enregistrements dont le REPERTOIRE a
  // disparu ; ici il est toujours la. Deux des huit kills ont laisse une copie
  // enregistree de 19 Mo dans `tmpdir`, et `prune` a laisse les deux en place.
  // Le geste qui nettoie :
  //
  //     git worktree list --porcelain | grep '^worktree .*heurix-verif' \
  //       | cut -d' ' -f2 | xargs -r -n1 git worktree remove --force
  //
  // Ce residu est borne et il ne bloque rien : il coute du disque et une
  // ligne dans `git worktree list`, jamais un fichier suivi.
  let nCopie = 0;
  const dansUneCopie = (fn) => {
    const copie = path.join(os.tmpdir(),
      `heurix-verif-${process.pid}-${Date.now()}-${nCopie++}`);
    execFileSync("git", ["-C", RACINE, "worktree", "add", "--detach", "-q", copie, "HEAD"]);
    try {
      return fn(copie);
    } finally {
      try {
        execFileSync("git", ["-C", RACINE, "worktree", "remove", "--force", copie]);
      } catch { /* la copie survit ; l'arbre suivi, lui, n'a rien vu */ }
    }
  };


  // DELAI EXPLICITE SUR CES QUATRE TESTS (29 aout 2026). L'hypothese que
  // `tests/README.md` laissait ouverte est CONFIRMEE, et par un echec
  // reproductible : chacun lance `scripts/index-recherche.py --verifier`, un
  // sous-processus Python de ~3 s a vide.
  //
  //     a vide, machine calme        3.0 - 3.4 s
  //     sous charge (load 36, trois  6.0 - 6.6 s   -> DEPASSEMENT du plafond
  //     suites en parallele)                          vitest de 5 000 ms
  //
  // Quatre push refuses de suite, et le refus n'avait rien a voir avec le
  // commit pousse. Le plafond est donc mis a 30 s ICI SEULEMENT : les 560
  // autres tests du depot gardent les 5 s par defaut, qui les protegent d'un
  // blocage reel. Un sous-processus Python qui met 30 s est pendu, pas charge.
  const DELAI = 30_000;

  const verifier = (racine = RACINE) => {
    try {
      execFileSync("python3", [path.join(racine, "scripts/index-recherche.py"), "--verifier"],
                   { cwd: racine, encoding: "utf8" });
      return { code: 0, sortie: "" };
    } catch (e) {
      return { code: e.status, sortie: (e.stdout || "") + (e.stderr || "") };
    }
  };

  // LE MESSAGE D'ECHEC PORTE LA SORTIE (27 aout 2026).
  //
  // Ces deux assertions n'affichaient que `.code`. En CI elles echouaient sur
  // « expected 1 to be 0 » -- vrai, inutile, et exactement le defaut corrige
  // le matin meme SUR CE SCRIPT : `--verifier` disait « index perime » sans
  // nommer les pages.
  //
  // La fonction `verifier()` capture pourtant deja stdout et stderr dans
  // `.sortie`. Le test connaissait la cause de son echec et ne la montrait
  // pas. Le second argument d'`expect` l'affiche.
  it("sort 0 quand l'index correspond aux pages", () => {
    const r = verifier();
    expect(r.code, r.sortie).toBe(0);
  }, DELAI);

  it("tourne SANS le moteur ni sa wheel — c'est sa raison d'etre", () => {
    // Si le generateur importait le moteur au chargement, cet appel
    // echouerait ici comme il echouerait dans la CI du site.
    const r = verifier();
    expect(r.code, r.sortie).toBe(0);
  }, DELAI);

  it("NOMME la page fautive plutot que de sortir 1 en silence", () => {
    dansUneCopie((copie) => {
      const page = path.join(copie, "docs.html");
      fs.writeFileSync(page,
        fs.readFileSync(page, "utf8").replace("</title>", " modifie</title>"));
      const r = verifier(copie);
      expect(r.code, r.sortie).toBe(1);
      expect(r.sortie).toContain("docs.html");
    });
    // L'ARBRE SUIVI N'A PAS BOUGE, et on l'affirme plutot que de l'esperer.
    expect(fs.readFileSync(path.join(RACINE, "docs.html"), "utf8"))
      .not.toContain(" modifie</title>");
  }, DELAI);

  // NE CREE AUCUN FICHIER DANS LE DEPOT. Premiere version : elle ecrivait une
  // vraie page a la racine et l'ajoutait au sitemap. D'autres fichiers de
  // test s'executent EN PARALLELE, et l'un d'eux -- le garde du sitemap --
  // voyait la page temporaire et echouait. Une course entre tests, qui ne se
  // reproduisait pas a l'execution isolee.
  //
  // On retire donc l'empreinte d'une page EXISTANTE de l'index : du point de
  // vue du verificateur, cette page vient d'etre AJOUTEE.
  it("detecte une page AJOUTEE — celle qui ne change aucune empreinte", () => {
    dansUneCopie((copie) => {
      const f = path.join(copie, "search-index-fr.json");
      const idx = JSON.parse(fs.readFileSync(f, "utf8"));
      const orpheline = Object.keys(idx.empreintes)[0];
      delete idx.empreintes[orpheline];
      fs.writeFileSync(f, JSON.stringify(idx));
      const r = verifier(copie);
      expect(r.code, r.sortie).toBe(1);
      expect(r.sortie).toContain(orpheline);
      expect(r.sortie).toContain("AJOUTEE");
    });
    expect(fs.readFileSync(path.join(RACINE, "search-index-fr.json"), "utf8").length)
      .toBeGreaterThan(1000);
  }, DELAI);
});

// ---------------------------------------------------------------------------
// LE CHEMIN DIFFERE SERT-IL BIEN LE NOUVEL INDEX ? (27 aout 2026)
//
// C'est le cas le plus difficile a voir : tout fonctionne, la modale s'ouvre,
// les resultats s'affichent -- et « 2rs » rend deux pages au lieu de huit,
// parce que la recherche interroge encore le titre et l'extrait sans jamais
// lire le champ `k` des termes, qui est toute la raison d'etre de l'index
// derive. Aucune erreur, aucun signal.
//
// C'est arrive. La premiere version de ce commit avait exactement ce defaut,
// et les 322 autres tests etaient verts.
//
// « 2rs » est le chiffre qui distingue les deux index :
//     index ecrit a la main   0 page      -- le terme n'y figurait pas
//     index derive, sans `k`  2 pages     -- seulement titre et extrait
//     index derive, avec `k`  7 pages     -- les sept qui en parlent
//
// SEPT PAGES, HUIT ENTREES : solutions/industrie.html y figure deux fois, une
// fois comme page et une fois par son ancre #annotations. On compte donc les
// PAGES et jamais les entrees -- la note sur le corpus mouvant, plus bas, dit
// pourquoi.
// ---------------------------------------------------------------------------

describe("index derive — la recherche lit vraiment les termes", () => {
  async function moteurAvecIndexReel(url = "https://heurix.fr/index.html") {
    const { JSDOM } = await import("jsdom");
    const langue = url.includes("/en/") ? "en" : "fr";
    const index = lire(`search-index-${langue}.json`);
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body><button id="heurix-search-btn"></button>
      </body></html>`,
      { url, runScripts: "outside-only" }
    );
    const w = dom.window;
    w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(index) });
    w.matchMedia = () => ({ matches: true });
    w.eval(fs.readFileSync(path.join(RACINE, "search-engine.js"), "utf8"));
    w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
    w.document.getElementById("heurix-search-btn").dispatchEvent(new w.Event("click"));
    await new Promise((r) => setTimeout(r, 20));
    return w;
  }

  const chercher = (w, q) => {
    const i = w.document.getElementById("heurix-search-input");
    i.value = q;
    i.dispatchEvent(new w.Event("input"));
    return [...w.document.querySelectorAll(".search-result")];
  };

  // ON NOMME LES PAGES ATTENDUES, ON NE COMPTE PAS LES ENTREES.
  //
  // Ce garde figeait un compte -- « din 933 » rend 7 -- et il est tombe le
  // 27 aout sans qu'une seule ligne de recherche ne bouge : une autre session
  // avait retitre une page. Un compte fige sur un corpus qui bouge se perime a
  // chaque retitrage, et celui qui le voit tomber cherche une regression du
  // moteur la ou il n'y en a pas.
  //
  // Une liste de pages survit a un titre qui change. Elle ne tombe que si une
  // page ENTRE ou SORT du resultat -- ce qui merite d'etre regarde a chaque
  // fois, et se lit directement dans le diff du test.
  const pagesDe = (elements) =>
    new Set(elements.map((a) =>
      a.getAttribute("href").split("#")[0].replace(/^(\.\.\/)+/, "")));

  const PAGES_2RS = [
    "blog/alternative-algolia-catalogue-technique.html",
    "blog/recherche-vectorielle-catalogues-techniques.html",
    "blog/tutoriel-catalogue-outillage-5-minutes.html",
    "fonctionnalites.html",
    "index.html",
    "solutions/index.html",
    "solutions/industrie.html",
  ];

  it("« 2rs » remonte les sept pages qui en parlent — celles que l'index ecrit a la main ne trouvait pas", async () => {
    const w = await moteurAvecIndexReel();
    expect([...pagesDe(chercher(w, "2rs"))].sort()).toEqual(PAGES_2RS);
  });

  const PAGES_DIN_933 = [
    "blog/alternative-algolia-catalogue-technique.html",
    "blog/heurix-vs-algolia-typesense-sensefuel-doofinder.html",
    "blog/recherche-reference-sku-b2b.html",
    "blog/recherche-vectorielle-catalogues-techniques.html",
    "index.html",
    "prestashop.html",
    "solutions/outillage.html",
  ];

  // HUIT ENTREES POUR SEPT PAGES, DEPUIS LE 27 AOUT.
  //
  // Le commit « Huit pages qui visaient huit requetes portaient le meme titre »
  // a retitre solutions/outillage.html en « Recherche visserie : M8x20, DIN
  // 933, inox A2 ». Une entree ANCREE porte le titre de sa page mere comme
  // EXTRAIT : celui de #annotations contient donc la requete mot pour mot, et
  // remonte au palier EXTRAIT de runSearch. Pas au palier des termes -- son
  // champ `k` ne contient toujours ni « din » ni « 933 ».
  //
  // Aucune page n'est entree ni sortie ce jour-la, et c'est pour cela que ce
  // garde nomme des pages : il n'a pas bouge, la ou un compte d'entrees serait
  // passe de 7 a 8. Mesure : en defaisant la promotion dans l'index, le compte
  // retombe a 7 et ce test reste vert.
  //
  // On n'affirme donc PAS que l'ancre est la : sa presence est un fait des
  // titres du jour, pas une propriete de la recherche.
  it("« din 933 » remonte les sept pages qui en parlent, pas zero", async () => {
    const w = await moteurAvecIndexReel();
    expect([...pagesDe(chercher(w, "din 933"))].sort()).toEqual(PAGES_DIN_933);
  });


  // Une requete de plusieurs mots ne peut pas matcher d'un bloc une liste de
  // termes TRIES : « din » et « 933 » n'y sont pas voisins. Chaque jeton est
  // donc exige separement.
  it("une requete de plusieurs mots trouve, la ou une recherche litterale echoue", async () => {
    const w = await moteurAvecIndexReel();
    expect(chercher(w, "din 933").length).toBeGreaterThan(0);
  });

  // Le classement doit tenir : un titre bat un terme de corps, sinon la page
  // Tarifs se noie dans toutes les pages qui mentionnent le mot.
  it("un titre passe devant un terme de corps", async () => {
    const w = await moteurAvecIndexReel();
    const premier = chercher(w, "tarifs")[0].querySelector(".search-result-title").textContent;
    expect(premier.toLowerCase()).toContain("tarifs");
  });

  it("une requete sans correspondance rend zero", async () => {
    const w = await moteurAvecIndexReel();
    expect(chercher(w, "xyzinexistantzzz")).toHaveLength(0);
  });

  it("l'index anglais se charge sur une page anglaise", async () => {
    const w = await moteurAvecIndexReel("https://heurix.fr/en/index.html");
    expect(chercher(w, "shopify").length).toBeGreaterThan(0);
  });
});
