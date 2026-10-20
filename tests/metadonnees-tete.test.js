import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pagesIndexables, lire, PLANCHER, RACINE } from "./pages-indexables.js";

// ---------------------------------------------------------------------------
// LE <title> ET LA meta description SONT CE QUE LE MOTEUR AFFICHE, PAS CE QUE
// LA PAGE RACONTE (20 octobre 2026).
//
// 76 pages indexables portaient un <title> de plus de 60 caracteres, jusqu'a
// 120, parce que le gabarit reprenait le titre editorial entier suivi de
// « — Heurix ». Un title de 120 caracteres n'est pas faux : il est COUPE a
// l'affichage, et ce qui reste visible est son debut, c'est-a-dire la partie
// que l'auteur n'a pas choisie pour cet usage. Dix descriptions depassaient
// 160 caracteres, jusqu'a 198, pour la meme raison.
//
// LA LONGUEUR EST COMPTEE SUR LE TEXTE DECODE, PAS SUR LA SOURCE, et le choix
// se mesure : `&amp;` occupe 5 caracteres dans le fichier et 1 a l'ecran. Sur
// la source, 78 titles depassaient 60 ; sur le texte decode, 76. Les deux
// pages de l'ecart -- blog/vins-spiritueux-millesime-format-prix.html (63
// brut, 59 decode) et solutions/sport.html (61 brut, 57 decode) -- tiennent
// dans la limite pour qui les lit, et c'est ce lecteur-la que ce garde sert.
//
// CE QUI NE VIT PAS ICI : le <h1> ne bouge pas, et le `headline` du
// BlogPosting le suit. Un title court et un h1 long ne sont pas une
// contradiction, c'est la repartition voulue -- le h1 est le titre editorial,
// le title sa forme courte. Aucune assertion de ce fichier ne les compare.
// ---------------------------------------------------------------------------

const SUFFIXES = [" — Heurix", " | Heurix"];

/**
 * LES DEUX ACCUEILS PORTENT LA MARQUE EN TETE, pas en suffixe :
 * « Heurix — Moteur de recherche & discovery pour le e-commerce ». C'est une
 * convention de page d'accueil, pas un oubli. Chaque exception est relue par
 * l'assertion « aucune exception n'est perimee » : une page inscrite ici qui
 * prendrait le suffixe fait echouer le test au lieu d'y rester pour rien.
 */
const MARQUE_EN_TETE = new Map([
  ["index.html", "Accueil FR : « Heurix — … », la marque ouvre le title."],
  ["en/index.html", "Accueil EN : « Heurix — … », meme convention."],
]);

/**
 * DETTE : les titles DEJA sous 30 caracteres au 20 octobre 2026, avec leur
 * longueur mesuree. Ce sont des pages a nom court -- « About », « Contact
 * us » -- dont le title ne porte aucun terme de recherche. C'est un defaut
 * reel, et c'est un lot a part : l'allonger demande de decider quel terme
 * chaque page vise, ce que le present lot ne fait que pour les 76 pages
 * qu'il raccourcit.
 *
 * pricing.html y figure et N'EST PAS MODIFIABLE aujourd'hui (correctif 1.2.1
 * sous examen Shopify). Une page NEUVE sous 30 caracteres echoue ici.
 */
const DETTE_TITRE_COURT = new Map([
  ["en/about.html", 14], ["en/contact.html", 19], ["en/integrations.html", 21],
  ["en/roi.html", 22], ["roi.html", 23], ["contact.html", 23],
  ["en/partners.html", 24], ["docs.html", 26], ["en/docs.html", 26],
  ["pricing.html", 26],
]);

/** DETTE : les descriptions deja sous 70 caracteres, avec leur longueur. */
const DETTE_DESCRIPTION_COURTE = new Map([
  ["en/blog/facettes-b2b-multi-attributs.html", 62],
  ["en/solutions/electronique.html", 63],
  ["en/blog.html", 69],
]);

/** Le texte tel qu'un moteur le compte : entites decodees. */
const decode = (x) =>
  x.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "’").replace(/&nbsp;/g, " ");

const titreDe = (p) => {
  const m = /<title>([\s\S]*?)<\/title>/.exec(lire(p));
  return m ? decode(m[1]) : null;
};
const descriptionDe = (p) => {
  const m = /<meta name="description" content="([\s\S]*?)">/.exec(lire(p));
  return m ? decode(m[1]) : null;
};
const h1De = (p) => {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(lire(p));
  return m ? decode(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() : "";
};
const corpsEditorial = (t) => {
  for (const s of SUFFIXES) if (t.endsWith(s)) return t.slice(0, -s.length);
  return t;
};
const motsDe = (x) => x.match(/[0-9A-Za-zÀ-ÿ'’]+/g) || [];

const pages = pagesIndexables();

/** Tous les .html SUIVIS qui portent un <title> -- l'unicite se juge sur eux. */
function toutesLesPagesTitrees() {
  return execFileSync("git", ["--no-optional-locks", "ls-files", "-z", "*.html"],
                      { cwd: RACINE, encoding: "utf8" })
    .split("\0").filter(Boolean)
    .filter((p) => /<title>/.test(fs.readFileSync(path.join(RACINE, p), "utf8")));
}

describe("metadonnees de tete — le perimetre", () => {
  // Les deux assertions du lot precedent. Sans elles, chaque `filter` de ce
  // fichier rend `[]` sur zero page et tout sort vert.
  it("le perimetre n'est pas vide", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it("le perimetre ne tombe pas sous les 140 pages indexables du 20 octobre 2026", () => {
    expect(pages.length).toBeGreaterThanOrEqual(PLANCHER);
  });

  it("chaque page indexable porte un <title> et une meta description", () => {
    expect(pages.filter((p) => titreDe(p) === null)).toEqual([]);
    expect(pages.filter((p) => descriptionDe(p) === null)).toEqual([]);
  });
});

describe("metadonnees de tete — longueur du <title>", () => {
  it("aucun title ne depasse 60 caracteres", () => {
    const longs = pages.filter((p) => titreDe(p).length > 60)
      .map((p) => `${p} : ${titreDe(p).length} car. — ${titreDe(p)}`);
    expect(longs).toEqual([]);
  });

  it("aucun title ne descend sous 30 caracteres, hors dette nommee", () => {
    const courts = pages.filter((p) => titreDe(p).length < 30 && !DETTE_TITRE_COURT.has(p))
      .map((p) => `${p} : ${titreDe(p).length} car. — ${titreDe(p)}`);
    expect(courts, "Un title trop court ne porte aucun terme de recherche.").toEqual([]);
  });

  it("aucune entree de la dette n'est perimee : chacune est encore trop courte", () => {
    const reparees = [...DETTE_TITRE_COURT.keys()]
      .filter((p) => pages.includes(p) && titreDe(p).length >= 30);
    expect(reparees, "Ces pages tiennent la regle : retirez-les de DETTE_TITRE_COURT.")
      .toEqual([]);
    // Et une page disparue du perimetre ne doit pas y rester non plus.
    expect([...DETTE_TITRE_COURT.keys()].filter((p) => !pages.includes(p))).toEqual([]);
  });
});

describe("metadonnees de tete — forme du <title>", () => {
  it("chaque title se termine par la marque, hors exception motivee", () => {
    const sans = pages
      .filter((p) => !MARQUE_EN_TETE.has(p))
      .filter((p) => !SUFFIXES.some((s) => titreDe(p).endsWith(s)))
      .map((p) => `${p} — ${titreDe(p)}`);
    expect(sans).toEqual([]);
  });

  it("aucune exception n'est perimee : chacune porte encore la marque en tete", () => {
    const perimees = [];
    for (const [p, raison] of MARQUE_EN_TETE) {
      if (!pages.includes(p)) { perimees.push(`${p} : hors perimetre`); continue; }
      if (SUFFIXES.some((s) => titreDe(p).endsWith(s)))
        perimees.push(`${p} : porte desormais le suffixe, a retirer des exceptions`);
      if (!titreDe(p).startsWith("Heurix"))
        perimees.push(`${p} : ne commence plus par la marque — ${titreDe(p)}`);
      if (!raison || raison.length < 20) perimees.push(`${p} : raison illisible`);
    }
    expect(perimees).toEqual([]);
  });

  it("aucun title ne coupe un mot en deux", () => {
    // DEUX REGLES, ET AUCUNE NE REMPLACE L'AUTRE.
    //
    // (a) La forme mecanique : une coupe a N caracteres laisse souvent une
    //     ponctuation ou un fragment d'un ou deux signes en fin de chaine.
    //
    // (b) LE FRAGMENT SE RECONNAIT CONTRE LE <h1>, et c'est la que ce garde
    //     mord vraiment. Le defaut d'origine est une TRONCATURE du titre
    //     editorial : le title valait le h1 plus la marque. Si le dernier mot
    //     du title n'est pas un mot du h1 mais en PREFIXE un, c'est une coupe.
    //     « …pourquoi leurs moteu » -> « moteu » prefixe « moteurs » : rouge.
    //     Mesure du 20 octobre : zero faux positif sur les 76 formes courtes
    //     ecrites a la main, et les trois troncatures brutales essayees sont
    //     attrapees.
    //
    // CE QU'AUCUNE DES DEUX NE VOIT : une coupe qui tombe pile sur une
    // espace. « Moteurs natifs : la limite des 10 000 » est un title
    // tronque, complet au sens de ces deux regles, et aucun test ne peut le
    // distinguer d'une forme courte voulue. C'est la relecture humaine des
    // 76 couples, au releve, qui couvre ce cas -- pas ce fichier.
    const casse = [];
    for (const p of pages) {
      const base = corpsEditorial(titreDe(p));
      const mots = motsDe(base);
      if (!mots.length) { casse.push(`${p} : title sans mot`); continue; }
      if (/[-–—,:;(…]$/.test(base.trim()))
        casse.push(`${p} : finit sur une ponctuation — « ${base.slice(-20)} »`);
      // PAS DE REGLE SUR LA LONGUEUR DU DERNIER MOT, ET C'EST MESURE.
      // « un fragment fait un ou deux signes » paraissait sur : elle a
      // signale SIX titles legitimes du site -- « Contact us », « USB-C et
      // Go », « USB-C and GB », « DIN 933, inox A2 », « surface en m² »
      // (deux fois). Ce site a pour sujet les jetons techniques courts :
      // une unite, un grade d'acier et un pronom anglais y finissent une
      // phrase sans rien couper. La regle a ete retiree plutot
      // qu'exceptee -- dix exceptions pour une regle fausse ne font pas une
      // regle juste.
      const dernier = mots[mots.length - 1];
      const vocabH1 = new Set(motsDe(h1De(p)).map((w) => w.toLowerCase()));
      const d = dernier.toLowerCase();
      if (!vocabH1.has(d)) {
        const prefixe = [...vocabH1].filter((w) => w !== d && w.startsWith(d));
        if (prefixe.length)
          casse.push(`${p} : « ${dernier} » prefixe ${prefixe.join(", ")} du h1 — mot coupe ?`);
      }
    }
    expect(casse).toEqual([]);
  });
});

describe("metadonnees de tete — unicite du <title>", () => {
  // L'UNICITE SE JUGE SUR LES 174 FICHIERS SUIVIS, PAS SUR LES 140
  // INDEXABLES, et c'est plus fort : deux pages peuvent se faire concurrence
  // meme si l'une est en `noindex`, et la propriete « aucun title en double »
  // etait vraie sur les 174 avant ce lot. La restreindre aux 140 l'aurait
  // affaiblie en silence.
  const titrees = toutesLesPagesTitrees();

  it("le balayage trouve bien plus de pages que le perimetre indexable", () => {
    expect(titrees.length).toBeGreaterThanOrEqual(PLANCHER);
  });

  it("aucun title n'est porte par deux pages", () => {
    const vus = new Map();
    const doublons = [];
    for (const p of titrees) {
      const t = titreDe(p);
      if (t === null) continue;
      if (vus.has(t)) doublons.push(`${p} :: identique a ${vus.get(t)} — « ${t} »`);
      else vus.set(t, p);
    }
    expect(doublons).toEqual([]);
  });
});

describe("metadonnees de tete — meta description", () => {
  // og:description N'EST PAS PLAFONNEE ICI, ET C'EST DELIBERE. Les dix
  // descriptions raccourcies le 20 octobre gardent leur argument entier en
  // `og:description` : une carte sociale n'a pas la limite de 160 d'un
  // resultat de recherche, et raccourcir les deux aurait perdu du texte sans
  // rien gagner. Les deux champs divergent donc sur ces dix pages, et c'est
  // une decision, pas un oubli.
  it("aucune description ne depasse 160 caracteres", () => {
    const longues = pages.filter((p) => descriptionDe(p).length > 160)
      .map((p) => `${p} : ${descriptionDe(p).length} car.`);
    expect(longues).toEqual([]);
  });

  it("aucune description n'est vide ni sous 70 caracteres, hors dette nommee", () => {
    const courtes = pages
      .filter((p) => !DETTE_DESCRIPTION_COURTE.has(p))
      .filter((p) => descriptionDe(p).trim().length === 0 || descriptionDe(p).length < 70)
      .map((p) => `${p} : ${descriptionDe(p).length} car.`);
    expect(courtes).toEqual([]);
  });

  it("aucune entree de la dette n'est perimee : chacune est encore trop courte", () => {
    const reparees = [...DETTE_DESCRIPTION_COURTE.keys()]
      .filter((p) => pages.includes(p) && descriptionDe(p).length >= 70);
    expect(reparees, "Retirez-les de DETTE_DESCRIPTION_COURTE.").toEqual([]);
    expect([...DETTE_DESCRIPTION_COURTE.keys()].filter((p) => !pages.includes(p))).toEqual([]);
  });
});
