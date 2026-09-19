import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const executer = promisify(execFile);

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

  // -------------------------------------------------------------------------
  // LE `k` D'UNE ANCRE NE SORT QUE DE SON PROPRE TITRE (7 septembre 2026).
  //
  // POURQUOI CE TEMOIN EXISTE. Deux gardes interdisent deja qu'une ancre
  // remonte sur un mot etranger a son titre -- tests/ancres-classement.test.js
  // les tient, sur la sortie du vrai moteur. Mais ils tombent LOIN de la
  // cause : si le generateur se remet a faire heriter `k` du corps de la page,
  // c'est le classement qui rougit, et il faut remonter de search-engine.js
  // jusqu'a une ligne de Python pour comprendre. Ce test-ci tombe sur la
  // ligne fautive, et le message nomme le terme et son ancre.
  //
  // CE QU'IL AURAIT ATTRAPE. Le commentaire du generateur a annonce
  // l'inverse du code du 27 aout au 7 septembre : « une ancre herite du
  // vocabulaire de sa page ». Une session qui l'aurait lu et cru aurait
  // enrichi un corps en croyant rendre la section trouvable, ou pire, aurait
  // « repare » le code pour qu'il tienne la promesse du commentaire.
  //
  // LA FORME DE L'ASSERTION. `termes()` derive plus que les mots du titre --
  // composantes de tiret (« 6205-2rs » credite « 6205 »), graphie collee
  // (« m8 x 20 » credite « m8x20 »). La reecrire ici la dupliquerait, et le
  // test suivrait ses bugs. On verifie donc la propriete qui survit a toute
  // derivation : un terme d'ancre, vide de ses separateurs, EST une
  // sous-chaine du titre vide des siens. Un terme venu du corps ne l'est pas.
  // Mesure du 7 septembre : 0 hors titre sur 267 termes d'ancres en FR
  // (248 en EN), pour 68 et 66 ancres.
  it("le `k` d'une ancre ne sort que de son propre titre", () => {
    // sans accents, sans separateurs : « heurix-search.js » -> « heurixsearchjs »
    const compact = (s) =>
      (s || "").toLowerCase().normalize("NFD")
        .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

    for (const f of ["search-index-fr.json", "search-index-en.json"]) {
      const index = lire(f);
      const ancres = index.entrees.filter((e) => e.ancre);
      const pages = new Map(index.entrees.filter((e) => !e.ancre).map((e) => [e.p, e]));

      // NON-VACUITE. Sans ces deux lignes le test passerait sur zero ancre,
      // ou sur des ancres dont la page ne porte rien de plus qu'elles --
      // il n'y aurait alors aucun heritage POSSIBLE, donc rien de verifie.
      expect(ancres.length, `${f} : aucune ancre a verifier`).toBeGreaterThan(20);
      const heritables = ancres.filter((a) => {
        const p = pages.get(a.p.split("#")[0]);
        if (!p) return false;
        const sien = new Set((a.k || "").split(" "));
        return (p.k || "").split(" ").some((m) => m && !sien.has(m));
      });
      expect(heritables.length,
        `${f} : aucune ancre dont la page porte un terme qu'elle n'a pas -- ` +
        `le test ne peut rien distinguer`).toBe(ancres.length);

      const indus = [];
      for (const a of ancres) {
        const titre = compact(a.t);
        for (const m of (a.k || "").split(" ")) {
          if (m && !titre.includes(compact(m))) indus.push(`${a.p} :: « ${m} » absent de « ${a.t} »`);
        }
      }
      expect(indus, `${f} : termes d'ancre etrangers a leur titre`).toEqual([]);
    }
  });

  // UN POSITIF CONNU, et non plus une propriete generale. Si la regle
  // ci-dessus devenait vraie par accident -- des ancres sans `k`, un index
  // vide, un filtre `.ancre` qui ne rend plus rien -- ce cas-ci le dirait :
  // il nomme le mot, la page, et le compte mesure le 7 septembre 2026.
  // C'est exactement le mot par lequel le defaut du 4 septembre s'etait vu.
  it("« merchandising » ne descend pas de fonctionnalites.html dans ses ancres", () => {
    const fr = lire("search-index-fr.json");
    const page = fr.entrees.find((e) => e.p === "fonctionnalites.html" && !e.ancre);
    expect(page.k.split(" "), "la page doit bien porter le mot").toContain("merchandising");

    const ancres = fr.entrees.filter((e) => e.ancre && e.p.startsWith("fonctionnalites.html#"));
    expect(ancres.length).toBe(41);
    // `e` porte le titre de la page mere : les 41 l'ont. C'est un repere
    // d'affichage, et search-engine.js ne le classe pas pour une ancre.
    expect(ancres.filter((a) => /merchandising/i.test(a.e)).length).toBe(41);
    // `k` classe, lui. Seules les trois ancres qui ecrivent le mot dans leur
    // propre titre le portent.
    const portent = ancres.filter((a) => a.k.split(" ").includes("merchandising"));
    expect(portent.map((a) => a.p).sort()).toEqual([
      "fonctionnalites.html#merchandising-e-commerce-classer-sans-recherche",
      "fonctionnalites.html#merchandising-manuel",
      "fonctionnalites.html#merchandising-manuel-vous-gardez-la-main",
    ]);
    for (const a of portent) expect(a.t.toLowerCase()).toContain("merchandising");
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
  //
  // AUCUN SOUS-PROCESSUS SYNCHRONE DANS CE BLOC (19 septembre 2026).
  //
  // vitest ne rend pas la main a la boucle d'evenements entre deux tests
  // synchrones. Le processus de test attend pourtant l'accuse de reception de
  // ses resultats (`onTaskUpdate`), avec un delai de 60 s fixe en dur dans
  // birpc et qu'aucune option de vitest 3.2.7 ne change. Les cinq tests
  // ci-dessous etaient en `execFileSync` : leur enchainement bloquait le
  // processus d'un seul tenant. Au-dela de 60 s, l'accuse deja arrive n'est
  // pas lu avant l'expiration du delai, et vitest sort en 1 sur
  // « Timeout calling "onTaskUpdate" » avec tous les tests verts.
  //
  // Mesure, huit passages de la suite : bloc de 34,6 a 54,2 s -> code 0 (6/6) ;
  // 65,6 et 76,3 s sous charge -> code 1 (2/2). Seuil reproduit a part :
  // 35 s + 35 s synchrones -> timeout, 55 s -> propre, 35 s + 35 s ATTENDUS
  // (`execFile` promis) -> propre. Le crochet pre-push a refuse ainsi un push
  // de 989 tests verts. Tout appel ici passe donc par `executer`.
  let nCopie = 0;
  const dansUneCopie = async (fn) => {
    const copie = path.join(os.tmpdir(),
      `heurix-verif-${process.pid}-${Date.now()}-${nCopie++}`);
    await executer("git", ["-C", RACINE, "worktree", "add", "--detach", "-q", copie, "HEAD"]);
    try {
      return await fn(copie);
    } finally {
      try {
        await executer("git", ["-C", RACINE, "worktree", "remove", "--force", copie]);
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

  // `e.code` et non `e.status` : c'est le champ ou la forme promise
  // d'`execFile` range le code de sortie.
  const verifier = async (racine = RACINE) => {
    try {
      await executer("python3", [path.join(racine, "scripts/index-recherche.py"), "--verifier"],
                     { cwd: racine, encoding: "utf8" });
      return { code: 0, sortie: "" };
    } catch (e) {
      return { code: e.code, sortie: (e.stdout || "") + (e.stderr || "") };
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
  it("sort 0 quand l'index correspond aux pages", async () => {
    const r = await verifier();
    expect(r.code, r.sortie).toBe(0);
  }, DELAI);

  it("tourne SANS le moteur ni sa wheel — c'est sa raison d'etre", async () => {
    // Si le generateur importait le moteur au chargement, cet appel
    // echouerait ici comme il echouerait dans la CI du site.
    const r = await verifier();
    expect(r.code, r.sortie).toBe(0);
  }, DELAI);

  it("NOMME la page fautive plutot que de sortir 1 en silence", async () => {
    await dansUneCopie(async (copie) => {
      const page = path.join(copie, "docs.html");
      fs.writeFileSync(page,
        fs.readFileSync(page, "utf8").replace("</title>", " modifie</title>"));
      const r = await verifier(copie);
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
  it("detecte une page AJOUTEE — celle qui ne change aucune empreinte", async () => {
    await dansUneCopie(async (copie) => {
      const f = path.join(copie, "search-index-fr.json");
      const idx = JSON.parse(fs.readFileSync(f, "utf8"));
      const orpheline = Object.keys(idx.empreintes)[0];
      delete idx.empreintes[orpheline];
      fs.writeFileSync(f, JSON.stringify(idx));
      const r = await verifier(copie);
      expect(r.code, r.sortie).toBe(1);
      expect(r.sortie).toContain(orpheline);
      expect(r.sortie).toContain("AJOUTEE");
    });
    expect(fs.readFileSync(path.join(RACINE, "search-index-fr.json"), "utf8").length)
      .toBeGreaterThan(1000);
  }, DELAI);

  // UN ARTICLE NEUF : LE COMMIT NE CHANGE PAS LE VERDICT (13 septembre 2026).
  //
  // Trois sessions le meme jour : index genere avec l'article NON SUIVI,
  // `--verifier` dit « a jour », commit, et le pre-push refuse « les derniers
  // articles ont change -- attendu blog/<nouveau>.html ». `date_ajout()`
  // rendait 0 pour une page sans commit d'ajout : l'article le plus recent
  // etait classe le plus ancien, jusqu'a ce que le commit lui donne une date.
  //
  // LE DECOR REPREND CE QUE LA GENERATION ECRIT ET QUE LE VERIFICATEUR LIT --
  // l'empreinte de la page et `derniers` --, par les fonctions memes du
  // generateur. Le reste de l'index demande le moteur, et le verificateur ne
  // le lit pas.
  //
  // LE SCRIPT EST CELUI DE L'ARBRE DE TRAVAIL, lance DANS la copie : `RACINE`
  // s'y resout par `git rev-parse` dans le dossier courant. `verifier(copie)`
  // lancerait le script de HEAD, et un correctif non commite ne serait jamais
  // eprouve.
  //
  // SANS LES VARIABLES GIT_* DU PROCESSUS (13 septembre 2026). Lance depuis le
  // pre-push d'un WORKTREE, vitest herite de GIT_DIR -- mesure : git ne
  // l'exporte au crochet que depuis un worktree, pas depuis le checkout
  // principal. `git -C copie commit` ecrivait alors dans le depot de GIT_DIR :
  // la page jetable a ete commitee sur la branche qui poussait, et poussee
  // avec elle (7b66e60b). Le rejeu manuel du crochet, sans GIT_DIR, ne l'avait
  // pas montre.
  it("un article neuf verifie avant son commit l'est encore apres", async () => {
    const script = path.join(RACINE, "scripts/index-recherche.py");
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
    const tete = async () => (await executer("git", ["-C", RACINE, "rev-parse", "HEAD"], { encoding: "utf8" })).stdout;
    const teteAvant = await tete();
    const verifierCopie = async (copie) => {
      try {
        await executer("python3", [script, "--verifier"], { cwd: copie, encoding: "utf8", env });
        return { code: 0, sortie: "" };
      } catch (e) {
        return { code: e.code, sortie: (e.stdout || "") + (e.stderr || "") };
      }
    };
    const neuf = "blog/page-jetable-derniers.html";

    await dansUneCopie(async (copie) => {
      const modele = fs.readdirSync(path.join(copie, "blog")).find((f) => f.endsWith(".html"));
      fs.writeFileSync(path.join(copie, neuf),
        fs.readFileSync(path.join(copie, "blog", modele), "utf8")
          .replace(/<title>[^<]*<\/title>/, "<title>Page jetable derniers</title>"));
      const sitemap = path.join(copie, "sitemap.xml");
      fs.writeFileSync(sitemap, fs.readFileSync(sitemap, "utf8").replace("</urlset>",
        `  <url><loc>https://heurix.fr/${neuf}</loc></url>\n</urlset>`));

      await executer("python3", ["-c", `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("ir", sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
f = "search-index-fr.json"; idx = json.load(open(f, encoding="utf8"))
idx["empreintes"][sys.argv[2]] = m.empreinte(m.extraire(sys.argv[2]))
idx["derniers"] = m.derniers_articles("fr")
json.dump(idx, open(f, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
`, script, neuf], { cwd: copie, env });

      const avant = await verifierCopie(copie);
      expect(avant.code, `AVANT le commit : ${avant.sortie}`).toBe(0);

      await executer("git", ["-C", copie, "add", "--", neuf, "sitemap.xml", "search-index-fr.json"], { env });
      await executer("git", ["-C", copie, "-c", "user.name=test", "-c", "user.email=test@invalid",
        "-c", "commit.gpgsign=false", "commit", "-q", "--no-verify", "-m", "jetable"], { env });
      const apres = await verifierCopie(copie);
      expect(apres.code, `APRES le commit : ${apres.sortie}`).toBe(0);

      // UN POSITIF CONNU : sans lui, deux verdicts egaux sur un article classe
      // hors des cinq passeraient aussi.
      const idx = JSON.parse(fs.readFileSync(path.join(copie, "search-index-fr.json"), "utf8"));
      expect(idx.derniers[0]).toBe(neuf);
    });
    expect(fs.existsSync(path.join(RACINE, neuf))).toBe(false);
    expect(await tete(), "le commit jetable a atteint la branche de l'arbre teste").toBe(teteAvant);
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

  // woocommerce.html EST ENTREE LE 4 SEPTEMBRE 2026, et rien de son cote n'a
  // bouge. Les huit places etaient tenues par SEPT pages plus une ancre --
  // solutions/industrie.html#annotations, qui remontait sur le titre de sa
  // page mere, deja premiere de la liste. L'ancre ne desservait donc aucune
  // page que la liste ne portait pas. La place liberee revient a la huitieme
  // page qui parle vraiment de « 2rs ».
  const PAGES_2RS = [
    "blog/alternative-algolia-catalogue-technique.html",
    // ENTREE LE 19 SEPTEMBRE 2026, ET woocommerce.html SORT. L'article mesure
    // la recherche native de PrestaShop, et « 6205 2RS » y est un cas traite :
    // « 2rs » remplace par « vis », zero resultat. Neuf pages correspondent,
    // pour huit places affichees : EVICTION par le plafond, comme pour
    // « din 933 » le 16 septembre. woocommerce.html n'a pas change d'un mot.
    "blog/recherche-native-prestashop-mesuree.html",
    "blog/recherche-vectorielle-catalogues-techniques.html",
    "blog/tutoriel-catalogue-outillage-5-minutes.html",
    "fonctionnalites.html",
    "index.html",
    "solutions/index.html",
    "solutions/industrie.html",
  ];

  it("« 2rs » remonte les huit pages qui en parlent — celles que l'index ecrit a la main ne trouvait pas", async () => {
    const w = await moteurAvecIndexReel();
    expect([...pagesDe(chercher(w, "2rs"))].sort()).toEqual(PAGES_2RS);
  });

  const PAGES_DIN_933 = [
    "blog/alternative-algolia-catalogue-technique.html",
    // ENTREE LE 16 SEPTEMBRE 2026, ET prestashop.html RESSORT. L'article
    // mesure un plongement sur un corpus de visserie dont toutes les fiches
    // portent « DIN 933 » : il traite la norme, il ne la mentionne pas en
    // passant. Neuf entrees correspondent desormais, pour huit places
    // affichees (`search-engine.js`, limite par defaut 8) -- c'est une
    // EVICTION par le plafond, pas une chute de prestashop.html, qui n'a pas
    // change d'un mot. Meme mecanisme que le 2 septembre, et il est note ici
    // pour qu'on sache que la page PrestaShop ne remonte plus sur cette
    // requete.
    "blog/decoupage-rag-catalogue-produit.html",
    "blog/heurix-vs-algolia-typesense-sensefuel-doofinder.html",
    "blog/recherche-reference-sku-b2b.html",
    "blog/recherche-vectorielle-catalogues-techniques.html",
    "index.html",
    // mesure.html EST ENTREE ET prestashop.html EST SORTIE (2 septembre 2026).
    // La page de mesure cite « DIN 933 » dans sa liste des cas ou Heurix
    // n'apporte rien, et elle passe devant la page PrestaShop, qui ne le
    // mentionnait qu'en passant. Sept pages avant, sept pages apres : c'est
    // un DEPLACEMENT, pas un ajout, et il est note ici pour qu'on sache que
    // la page PrestaShop ne remonte plus sur cette requete.
    "mesure.html",
    // ET prestashop.html EST REVENUE LE 4 SEPTEMBRE 2026, sans avoir change
    // d'un mot. Elle n'etait pas sortie devant mesure.html : les deux tenaient
    // dans huit places, mais l'ancre #annotations en occupait une. Le
    // « DEPLACEMENT » note le 2 septembre etait donc une EVICTION, et sa cause
    // n'etait pas celle qu'on lui a prêtee.
    "solutions/outillage.html",
  ];

  // HUIT ENTREES POUR HUIT PAGES DEPUIS LE 4 SEPTEMBRE 2026 -- ET LE BLOC QUI
  // TENAIT ICI DECRIVAIT DEJA LE DEFAUT, HUIT JOURS PLUS TOT.
  //
  // Il disait, le 27 aout : « Une entree ANCREE porte le titre de sa page mere
  // comme EXTRAIT : celui de #annotations contient donc la requete mot pour
  // mot, et remonte au palier EXTRAIT de runSearch. Pas au palier des termes
  // -- son champ `k` ne contient toujours ni "din" ni "933". » Le mecanisme
  // entier, exact, ecrit. Il concluait : « sa presence est un fait des titres
  // du jour, pas une propriete de la recherche », et choisissait de compter
  // les PAGES pour ne pas en dependre.
  //
  // C'etait la bonne parade et la mauvaise lecture. Ce n'etait pas un fait des
  // titres du jour : c'etait une ancre classee sur du texte emprunte, et le
  // meme mecanisme evinçait prestashop.html de cette liste sans que personne
  // n'en fasse le lien. Une observation juste peut se ranger sous « accident »
  // et cesser d'etre cherchee.
  //
  // Depuis que `e` ne classe plus une ancre (search-engine.js), la place
  // qu'elle tenait revient a une huitieme page. Le garde nomme toujours des
  // pages, pour la raison ecrite le 27 aout, qui reste juste.
  it("« din 933 » remonte les huit pages qui en parlent, pas zero", async () => {
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
