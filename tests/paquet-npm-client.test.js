import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// LE PAQUET NPM DU CLIENT EST DECLARE UNE FOIS, ET LES PAGES LE SUIVENT
// (4 octobre 2026).
//
// CE QUI REND CE TEST NECESSAIRE. Mesure du 4 octobre, trouvaille C1 de
// `heurix-engine/docs/mesures/audit-2026-10-04/` : trois noms circulaient pour
// une seule bibliotheque, et les pages en ligne se contredisaient.
//
//     docs.html, en/docs.html          @heurix-site/client   npm : 0.1.0, 24 juillet
//     guide-mise-en-route.html, EN     heurix-client         npm : 0.3.0, 15 aout
//     CLAUDE.md:24                     @heurix/client        npm : 404
//
// `docs.html` disait en plus de `heurix-client` qu'il etait « aujourd'hui
// deprecie » : npm ne portait le drapeau sur aucun des deux. Et l'URL de CDN
// qu'il donnait, `@heurix-site/client@latest`, servait 3 743 octets au lieu de
// 4 302 -- sans `visitorId`, `inStockOnly`, `lang`, `idsOnly`, `idField`.
//
// Les 1046 tests du site n'ont rien vu : AUCUN ne nommait un paquet npm.
//
// LE NOM DECLARE est l'attribut `data-paquet-npm-client` de la section
// `#ep-client-js`, sur `docs.html` et `en/docs.html`. Meme forme que
// `data-etat-revue-shopify` dans `etat-revue-shopify.test.js`, et pour la meme
// raison : ce test ne sait pas ce que npm sert ; il sait seulement RELIER. Le
// jour ou le nom change, le geste est de changer l'attribut, et le test liste
// alors chaque ligne qui nomme encore l'ancien.
//
// PERIMETRE DERIVE, PAS ENUMERE. Une page servie porte un bloc `.foot-links`
// (160 pages au 4 octobre 2026) -- regle 1 de `pied-liens.test.js`. Une page
// neuve qui documenterait le client entre donc seule dans le test.
//
// CE QUE LE PERIMETRE DERIVE EXCLUT TOUT SEUL, et c'est voulu : `HeurixClient`
// nomme AUSSI la classe PHP du module PrestaShop (`src/HeurixClient.php`). Ses
// cinq occurrences vivent dans `downloads/heurix-search.js:240`, `:258`,
// `tests/heurix-search-panne.test.js:222`, `docs/MESURE-CHIFFRES-2026-09.md:32`
// et `docs/MESURE-DEPASSEMENT-FACTURE.md:256` -- aucun n'est une page servie.
// Un motif sur `HeurixClient` seul, sur tout l'arbre, les rougirait a tort.
//
// ---------------------------------------------------------------------------
// CE QUE CE GARDE NE VOIT PAS. A LIRE AVANT DE CROIRE LE SUJET COUVERT.
//
// Il est HORS LIGNE, par decision du 4 octobre 2026, et le prix est reel. Il
// ne peut rien dire de l'etat du registre, parce que cet etat ne vit pas dans
// l'arbre. Quatre derives lui echappent, dont DEUX SONT EXACTEMENT CELLES QUE
// L'AUDIT A TROUVEES :
//
//   1. Qu'une version publiee sur npm diverge du depot `heurix-client`. Si
//      `heurix-client` passait en 0.4.0 sans que le depot suive, ou l'inverse,
//      ce test resterait vert.
//   2. Qu'un paquet soit deprecie sans que les pages suivent -- ou l'inverse,
//      qu'une page le dise sans que le drapeau soit pose. C'EST LE DEFAUT
//      D'ORIGINE : il verifie seulement qu'aucune page ne le dit du paquet
//      DECLARE (test 5), ce qui n'est pas la meme chose.
//   3. Que le CDN serve le build courant. L'URL est verifiee dans sa FORME,
//      jamais appelee.
//   4. Que le paquet declare existe. Un nom mal orthographie dans l'attribut
//      rend tout le reste coherent et faux.
//
// POURQUOI PAS UN APPEL RESEAU. Le crochet `pre-push` rejoue les blocs `run:`
// de `CI.yml` et tourne en 25 s sans rien d'exterieur -- il saute meme
// `npm ci` sciemment (`scripts/hooks/pre-push:381-387`). Un `npm view` ici
// rendrait chaque poussee tributaire de `registry.npmjs.org` : un registre
// lent rendrait le crochet INCONCLU, un registre muet le rendrait rouge sans
// defaut. C'est le mecanisme d'un garde qu'on cesse de lire.
//
// POURQUOI PAS UN WORKFLOW PERIODIQUE, ET LA RAISON EST MESUREE. Le sondage
// des abonnements Shopify est un garde de ce type : `failed` depuis le
// 8 septembre 2026, une seule execution, timer `disabled`, vingt-six jours
// sans que personne le voie (trouvaille C2 du meme audit). Un garde periodique
// qui meurt en silence est pire qu'une absence : il laisse croire que la
// question est surveillee. Avant d'en poser un, il faudra savoir qui lit son
// rouge -- aujourd'hui la reponse est personne.
//
// CE QUI TIENT LES QUATRE POINTS CI-DESSUS EST DONC UN GESTE MANUEL :
//
//     npm view heurix-client version              # = version du depot heurix-client
//     npm view heurix-client deprecated           # doit rester VIDE
//     npm view @heurix-site/client deprecated     # non vide une fois le drapeau pose
//     curl -sI https://cdn.jsdelivr.net/npm/heurix-client@latest/dist/index.js
//
// Dernier passage a la main : 4 octobre 2026. `heurix-client` 0.3.0, identique
// au depot `d961225` sur ses 5 fichiers ; CDN `@latest` = 4 302 octets,
// sha256 `8eafbbd7...`, les cinq champs presents.
// ---------------------------------------------------------------------------

/** Pages servies : `[{ page, src }]`, chemin relatif en `/`. */
function pagesServies() {
  return execFileSync("git", ["ls-files", "*.html"], { cwd: RACINE, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .map((page) => ({ page, src: fs.readFileSync(path.join(RACINE, page), "utf8") }))
    .filter(({ src }) => /<div class="foot-links">/.test(src));
}

const SERVIES = pagesServies();

/** Le nom declare, lu sur la section client des deux `docs.html`. */
function nomsDeclares() {
  const trouves = new Map();
  for (const { page, src } of SERVIES) {
    const m = /<section id="ep-client-js"[^>]*\sdata-paquet-npm-client="([^"]+)"/.exec(src);
    if (m) trouves.set(page, m[1]);
  }
  return trouves;
}

const DECLARES = nomsDeclares();

/**
 * Les lignes qui NOMMENT un paquet npm dans une page servie.
 *
 * Trois formes, et elles doivent toutes trois nommer le meme paquet :
 *   - `npm install <paquet>`
 *   - `import ... from "<paquet>"`   (specifieur nu, pas une URL ni un chemin)
 *   - une URL `cdn.jsdelivr.net/npm/<paquet>@<version>/...`
 *
 * Le motif de paquet accepte la forme scopee `@orga/nom` comme la forme nue,
 * parce que c'est justement entre ces deux-la que la confusion a vecu.
 */
const PAQUET = String.raw`(@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)`;

const FORMES = [
  {
    id: "npm install",
    motif: new RegExp(String.raw`npm install\s+${PAQUET}`, "g"),
  },
  {
    id: "import nu",
    // `&quot;` autant que `"` : les blocs de code echappent parfois les guillemets.
    motif: new RegExp(
      String.raw`from\s+(?:"|&quot;)${PAQUET}(?:"|&quot;)`,
      "g",
    ),
  },
  {
    id: "URL jsdelivr",
    motif: new RegExp(
      String.raw`cdn\.jsdelivr\.net\/npm\/${PAQUET}@([^\/"&]+)\/([^"'&\s]+)`,
      "g",
    ),
  },
];

/** `[{ page, forme, paquet, brut, groupes }]` pour toute page servie. */
function citations() {
  const sortie = [];
  for (const { page, src } of SERVIES) {
    for (const { id, motif } of FORMES) {
      motif.lastIndex = 0;
      for (const m of src.matchAll(motif)) {
        sortie.push({ page, forme: id, paquet: m[1], brut: m[0], groupes: m.slice(1) });
      }
    }
  }
  return sortie;
}

const CITATIONS = citations();

// Un `import ... from "./x.js"` ou `from "node:fs"` n'est pas une citation de
// paquet publie. On ne garde que ce qui pourrait etre notre client : les
// specifieurs nus, hors prefixes de chemin et de protocole.
const PERTINENTES = CITATIONS.filter(
  (c) => !/^(\.|\/|node:|https?:)/.test(c.paquet),
);

describe("paquet npm du client — le nom declare", () => {
  it("est declare, et sur les deux langues", () => {
    expect(
      [...DECLARES.keys()].sort(),
      "l'attribut data-paquet-npm-client doit vivre sur docs.html ET en/docs.html",
    ).toEqual(["docs.html", "en/docs.html"]);
  });

  it("est le meme dans les deux langues", () => {
    expect(new Set(DECLARES.values()).size, `vu : ${JSON.stringify([...DECLARES])}`).toBe(1);
  });

  it("a la forme d'un nom de paquet npm", () => {
    for (const [page, nom] of DECLARES) {
      expect(nom, `${page} : nom de paquet invalide`).toMatch(
        /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/,
      );
    }
  });
});

describe("paquet npm du client — les pages suivent le nom declare", () => {
  const NOM = [...DECLARES.values()][0];

  it("toute citation de paquet d'une page servie nomme le paquet declare", () => {
    const fautives = PERTINENTES.filter((c) => c.paquet !== NOM).map(
      (c) => `${c.page} [${c.forme}] ${c.brut}`,
    );
    expect(
      fautives,
      `le nom declare est « ${NOM} ». Ces lignes en nomment un autre :`,
    ).toEqual([]);
  });

  it("les trois formes sont presentes — sinon le balayage ne juge plus rien", () => {
    const vues = new Set(PERTINENTES.map((c) => c.forme));
    for (const { id } of FORMES) {
      expect(
        vues.has(id),
        `aucune citation de forme « ${id} » trouvee sur ${SERVIES.length} pages servies : ` +
          "le motif a cesse de mordre, ou la doc a change de forme",
      ).toBe(true);
    }
  });

  it("le balayage a de quoi mordre", () => {
    expect(SERVIES.length, "aucune page servie trouvee").toBeGreaterThan(100);
    expect(
      PERTINENTES.length,
      "aucune citation de paquet trouvee sur les pages servies",
    ).toBeGreaterThanOrEqual(4);
  });
});

describe("paquet npm du client — l'URL de CDN", () => {
  const NOM = [...DECLARES.values()][0];
  const URLS = CITATIONS.filter((c) => c.forme === "URL jsdelivr");

  it("il y en a au moins une, et elles nomment le paquet declare", () => {
    expect(URLS.length, "aucune URL jsdelivr sur les pages servies").toBeGreaterThanOrEqual(2);
    expect(URLS.filter((u) => u.paquet !== NOM).map((u) => `${u.page} ${u.brut}`)).toEqual([]);
  });

  it("chacune porte une version ou `latest`, jamais rien", () => {
    // `cdn.jsdelivr.net/npm/<paquet>` sans `@...` sert la derniere version et
    // ne dit pas laquelle : l'URL reste vraie en changeant de contenu.
    for (const u of URLS) {
      const version = u.groupes[1];
      expect(version, `${u.page} : ${u.brut}`).toMatch(/^(latest|\d+\.\d+\.\d+)$/);
    }
  });

  it("chacune pointe le fichier que le paquet publie vraiment", () => {
    // `files: ["dist"]` dans le package.json de heurix-client : hors de
    // `dist/`, jsdelivr rendrait 404 et le bloc de code serait faux.
    for (const u of URLS) {
      expect(u.groupes[2], `${u.page} : ${u.brut}`).toMatch(/^dist\//);
    }
  });
});

describe("paquet npm du client — l'autre sens", () => {
  const NOM = [...DECLARES.values()][0];

  // CE QUE CETTE ASSERTION AURAIT ATTRAPE, et c'est pour elle qu'elle existe :
  // « Le paquet heurix-client [...] est aujourd'hui deprecie », docs.html:1263
  // le 4 octobre 2026, alors que npm ne portait aucun drapeau.
  //
  // ELLE NE PORTE QUE SUR LE PAQUET DECLARE. Dire d'un AUTRE paquet qu'il est
  // deprecie doit rester possible : depuis le 4 octobre 2026, `npm deprecate`
  // EST pose sur `@heurix-site/client`, et la page le dit. Un garde qui
  // rougirait toute mention de « deprecie » interdirait de dire une verite.
  //
  // LA PROXIMITE SEULE NE SUFFIT PAS, ET JE L'AI CRU (correction du jour).
  // La version precedente rougissait des qu'un mot de peremption tombait dans
  // 200 caracteres autour du nom declare. J'avais ecrit dans
  // `corrections-en-attente.md` qu'elle laisserait passer la phrase preparee :
  // c'etait FAUX, mesure en l'appliquant -- 4 fautives. Les deux noms vivent
  // dans la meme phrase, donc dans la meme fenetre, et la fenetre ne dit pas a
  // qui l'adjectif se rapporte.
  //
  // LE DISCRIMINANT EST LE NOM LE PLUS PROCHE. Pour chaque mot de peremption,
  // on cherche le nom de paquet le plus proche en caracteres : si c'est le nom
  // declare, la phrase le dit perime et c'est un defaut ; si c'est un autre,
  // elle parle de l'autre. Mesure sur la phrase du jour : « deprecie » est a
  // ~70 caracteres de `@heurix-site/client` et a ~150 de `heurix-client`.
  //
  // LES AUTRES NOMS RECONNUS SONT LES NOMS SCOPES (`@orga/nom`), parce qu'ils
  // sont non ambigus et que c'est exactement le nom concurrent ici. Deux noms
  // NUS dans la meme phrase ne seraient pas departages : le garde rougirait,
  // et c'est le bon sens du doute pour celui-la -- un faux rouge se lit, un
  // faux vert laisse repartir le defaut d'origine.
  it("aucune page ne dit du paquet declare qu'il est deprecie ou abandonne", () => {
    const MOTS = /d[ée]pr[ée]ci[ée]|deprecated|abandonn[ée]|obsol[eè]te|obsolete|ne plus utiliser|do not use/gi;
    const SCOPE = /@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*/gi;

    /** Positions de toutes les occurrences de `aiguille` dans `foin`. */
    const positions = (foin, aiguille) => {
      const out = [];
      for (let i = foin.indexOf(aiguille); i !== -1; i = foin.indexOf(aiguille, i + aiguille.length)) out.push(i);
      return out;
    };
    const distance = (liste, i) =>
      liste.length ? Math.min(...liste.map((p) => Math.abs(p - i))) : Infinity;

    const fautives = [];
    for (const { page, src } of SERVIES) {
      const declare = positions(src, NOM);
      if (!declare.length) continue;
      const scopes = [...src.matchAll(SCOPE)]
        .filter((m) => m[0] !== NOM)
        .map((m) => m.index);
      for (const m of src.matchAll(MOTS)) {
        const dDeclare = distance(declare, m.index);
        if (dDeclare > 200) continue;            // trop loin : parle d'autre chose
        const dAutre = distance(scopes, m.index);
        if (dAutre < dDeclare) continue;         // un autre paquet est plus proche
        const fenetre = src.slice(Math.max(0, m.index - 150), m.index + 150);
        fautives.push(
          `${page} :: « ${m[0]} » a ${dDeclare} car. de « ${NOM} » et ${dAutre} d'un autre` +
          ` :: ${fenetre.replace(/\s+/g, " ")}`,
        );
      }
    }
    expect(
      fautives,
      `le paquet declare « ${NOM} » est celui qu'on installe : aucune page ne peut le dire perime`,
    ).toEqual([]);
  });
});
