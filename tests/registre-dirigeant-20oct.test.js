import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(import.meta.dirname, "..");
const lire = (p) => fs.readFileSync(path.join(RACINE, p), "utf8");
const existe = (p) => fs.existsSync(path.join(RACINE, p));

// ---------------------------------------------------------------------------
// LE TEMOIN DE REGISTRE (20 octobre 2026).
//
// Ce lot ouvre une serie dont le sujet n'est pas le theme mais le REGISTRE :
// l'article parle a un dirigeant de PME de distribution, pas a un praticien.
// Mesure du 20 octobre : 51 articles francais, dont une poignee s'adressent a
// un acheteur et le reste a un ingenieur. Le risque du lot est donc qu'il
// derive vers le registre des 43 autres -- par un mot, puis par un
// paragraphe.
//
// LE TEMOIN EST UNE LISTE DE TERMES, ET IL EST MECANIQUE : aucun des termes
// cites ne doit apparaitre dans le corps editorial, sauf ceux qui sont
// DEFINIS en langage courant dans la meme phrase. Et « defini » n'est pas
// laisse a l'appreciation du test : pour chaque terme admis, la PHRASE qui le
// porte est recopiee ici, verbatim. Reecrire la phrase en perdant la
// definition fait rougir ce fichier ; retirer le terme aussi, et c'est
// voulu -- une exception qui se perime doit se signaler.
//
// CE QUE CE TEMOIN NE VOIT PAS, et c'est la raison pour laquelle il ne suffit
// pas :
//
//   1. UN TEXTE ABSTRAIT QUI EVITE LES MOTS SANS PARLER A PERSONNE. « Une
//      solution permet d'optimiser la visibilite de votre offre » ne contient
//      aucun terme de la liste et ne dit rien. Le temoin sort vert.
//   2. LE JARGON DU METIER DU LECTEUR plutot que du notre : EBITDA, BFR,
//      rotation de stock, marge arriere. Il est peut-etre juste ici, il
//      n'est pas dans la liste.
//   3. UN SYNONYME DU TERME INTERDIT : « recherche par similarite » pour
//      vectoriel, « modele de langage » pour plongement. La liste nomme des
//      mots, pas des idees.
//   4. UNE DEFINITION FAUSSE OU INCOMPREHENSIBLE. L'assertion verifie que la
//      phrase contient la definition ECRITE, jamais qu'elle est juste ni
//      qu'un dirigeant la comprend.
//   5. LE TON. Une phrase de soixante mots avec trois subordonnees passe.
//
// Les cinq cas sont du ressort de la relecture, pas du sien. Ce fichier ferme
// le cas mecanique -- le mot de metier recopie sans y penser -- qui est celui
// qu'une session a toutes les chances de commettre.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ETENDU LE 21 OCTOBRE 2026 AUX DEUX ARTICLES QUI SUIVENT, ET PAS DUPLIQUE.
//
// Le lot des 21 octobre ajoute « Non, vous n'avez pas besoin de refaire votre
// site » et « Le site de votre concurrent est-il meilleur, ou juste plus
// facile ? ». Un SECOND fichier de temoin aurait recopie les quatorze termes,
// le decoupage du corps editorial et les cinq cas aveugles -- donc trois
// endroits ou les deux listes auraient pu diverger sans que rien ne le dise.
// Le perimetre grandit, le temoin reste un.
//
// LE NOM DU FICHIER DIT « 20oct » ET LE LOT EN COUVRE TROIS. C'est assume :
// le renommer casserait les references du relevé du 21 octobre sans rien
// apporter au garde. Ce qui compte est que SLUGS ci-dessous soit la seule
// liste a tenir a jour.
// ---------------------------------------------------------------------------

/** Les articles de la serie, par slug. Les deux langues en sont derivees. */
const SLUGS = ["ce-qu-une-ia-lit-de-vos-fiches-produit",
               "pas-besoin-de-refaire-votre-site",
               "concurrent-meilleur-ou-plus-facile"];

const LOT = SLUGS.flatMap((s) => [`blog/${s}.html`, `en/blog/${s}.html`]);

/** Les termes refuses, par langue. Donnes dans la consigne du lot. */
const TERMES = {
  fr: ["plongement", "embedding", "RAG", "regex", "expression régulière",
       "cascade d'annotations", "tokenisation", "vectoriel", "API", "endpoint",
       "indexation", "crawler", "schema.org", "JSON-LD"],
  en: ["embedding", "RAG", "regex", "regular expression", "annotation cascade",
       "tokenization", "vector", "API", "endpoint", "indexing", "crawler",
       "schema.org", "JSON-LD"],
};

/**
 * LES TERMES ADMIS, AVEC LA PHRASE QUI LES DEFINIT, VERBATIM.
 *
 * Un seul terme est admis, et c'est une decision editoriale : un dirigeant
 * qui veut agir doit pouvoir donner UN mot a son agence. Il est donc defini
 * dans la phrase qui le porte, et la phrase est ici.
 */
const DEFINIS = {
  "blog/ce-qu-une-ia-lit-de-vos-fiches-produit.html": {
    "schema.org": "il s’appelle schema.org, et c’est le seul mot technique de cette page",
  },
  "en/blog/ce-qu-une-ia-lit-de-vos-fiches-produit.html": {
    "schema.org": "it is called schema.org, and it is the only technical word on this page",
  },
  // « Le site de votre concurrent… » parle du meme bloc de donnees, donc du
  // meme mot, et le definit de la meme facon. L'autre article du 21 octobre
  // n'en a pas besoin : il ne doit donc PAS figurer ici, et l'assertion
  // « aucune entree perimee » plus bas le verifie.
  "blog/concurrent-meilleur-ou-plus-facile.html": {
    "schema.org": "il s’appelle schema.org, et c’est le seul mot technique de cette page",
  },
  "en/blog/concurrent-meilleur-ou-plus-facile.html": {
    "schema.org": "it is called schema.org, and it is the only technical word on this page",
  },
};

/** Le CORPS EDITORIAL seul : du <h1> au bloc d'appel a l'action.
 *
 * LE PERIMETRE N'EST PAS LA PAGE, ET C'EST MESURE. La barre de navigation
 * annonce « Cascade d'annotations, fautes tolerees, synonymes metier » et le
 * pied porte « Documentation API » : deux termes de la liste, sur les 148
 * pages du site. Juger la page entiere rendrait ce temoin rouge sur un
 * article irreprochable, et le seul moyen de le verdir serait d'excepter les
 * deux -- donc d'aveugler le temoin sur le corps aussi.
 */
function corpsEditorial(src) {
  const i = src.indexOf("<h1");
  const j = src.indexOf('<div class="post-footer-cta">');
  if (i < 0 || j < 0 || j <= i) return null;
  return src.slice(i, j);
}

/** Le texte lu par un humain : balises retirees, entites decodees. */
function texte(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·").replace(/&larr;/g, "←")
    .replace(/&#39;|&apos;/g, "’").replace(/&quot;/g, "”")
    .replace(/\s+/g, " ")
    .trim();
}

/** Le motif d'un terme : borne sur les deux cotes, le point litteral. */
function motif(terme) {
  const echappe = terme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // `\b` ne borne pas apres un point (« schema.org » finit sur une lettre,
  // mais « JSON-LD » finit sur D et `\b` suffit). On borne a gauche sur un
  // non-mot, a droite sur un non-mot ou la fin -- et l'apostrophe droite
  // comme la courbe comptent comme des separateurs.
  return new RegExp(`(^|[^\\p{L}\\p{N}.-])${echappe}($|[^\\p{L}\\p{N}-])`, "giu");
}

/** Les phrases d'un texte, decoupees sur la ponctuation forte. */
function phrases(txt) {
  return txt.split(/(?<=[.!?])\s+/).filter((p) => p.trim());
}

describe("témoin de registre — le périmètre", () => {
  it("les deux pages du lot sont là", () => {
    const absents = LOT.filter((p) => !existe(p));
    expect(absents, "Un slug renommé : corrigez SLUGS, ne le laissez pas mort.").toEqual([]);
    expect(SLUGS).toHaveLength(3);
    expect(LOT).toHaveLength(6);
    // La serie vit dans les DEUX langues, et le derive le garantit par
    // construction -- cette assertion garde la construction elle-meme.
    expect(LOT.filter((p) => p.startsWith("en/"))).toHaveLength(3);
    expect(LOT.filter((p) => !p.startsWith("en/"))).toHaveLength(3);
  });

  it("aucune entrée de DEFINIS n'est périmée", () => {
    // UN TERME ADMIS SUR UNE PAGE QUI NE L'EMPLOIE PLUS est une exception
    // morte : elle n'autorise rien, mais elle fait croire a un arbitrage qui
    // n'a plus d'objet. Et une entree pour une page HORS du lot ne serait
    // jamais lue.
    const perimees = [];
    for (const p of Object.keys(DEFINIS)) {
      if (!LOT.includes(p)) { perimees.push(`${p} : hors du lot`); continue; }
      const txt = texte(corpsEditorial(lire(p)));
      for (const terme of Object.keys(DEFINIS[p]))
        if (!motif(terme).test(txt)) perimees.push(`${p} : « ${terme} » absent de la page`);
    }
    expect(perimees, "Retirez l'entrée de DEFINIS, ou remettez le terme.").toEqual([]);
  });

  it("le corps éditorial est isolé, et il n'est pas vide", () => {
    // SANS CE PLANCHER, un `<h1` renommé ou un bloc d'appel à l'action
    // déplacé rendrait `corpsEditorial` nul ou minuscule, et toutes les
    // assertions ci-dessous passeraient en n'examinant rien. C'est la panne
    // que ce dépôt a trouvée quatre fois le 20 octobre.
    for (const p of LOT) {
      const corps = corpsEditorial(lire(p));
      expect(corps, `${p} : corps éditorial introuvable`).toBeTruthy();
      const mots = texte(corps).split(/\s+/).length;
      expect(mots, `${p} : ${mots} mots seulement`).toBeGreaterThanOrEqual(600);
    }
  });

  it("le corps éditorial exclut bien la navigation et le pied", () => {
    // La preuve que le périmètre est le bon : les deux termes que la page
    // porte HORS du corps y sont, et le corps ne les voit pas. Si ce
    // découpage cessait de mordre, cette assertion rougirait avant les
    // autres.
    const src = lire(LOT[0]);
    expect(src).toMatch(/Cascade d&rsquo;annotations/);
    expect(corpsEditorial(src)).not.toMatch(/Cascade d&rsquo;annotations/);
    const en = lire(LOT[1]);
    expect((en.match(/\bAPI\b/g) || []).length).toBe(3);
    expect(corpsEditorial(en)).not.toMatch(/\bAPI\b/);
  });
});

describe("témoin de registre — aucun terme de métier non défini", () => {
  it("le détecteur mord : témoin positif sur une phrase fabriquée", () => {
    // UN DETECTEUR QUI NE TROUVE RIEN EST INDISCERNABLE D'UN TEXTE PROPRE.
    // Ces trois cas sont fabriqués ici, pas tirés de la page.
    expect(motif("API").test("passe par notre API maison")).toBe(true);
    expect(motif("vectoriel").test("un moteur vectoriel")).toBe(true);
    expect(motif("schema.org").test("le vocabulaire schema.org, lu partout")).toBe(true);
    // Et il ne mord pas sur un mot qui contient le terme.
    expect(motif("RAG").test("une étagère pour le rangement")).toBe(false);
    expect(motif("vector").test("vectorisation")).toBe(false);
  });

  it("chaque terme de la liste est absent, hors terme défini", () => {
    const trouves = [];
    let examines = 0;
    for (const p of LOT) {
      const langue = p.startsWith("en/") ? "en" : "fr";
      const txt = texte(corpsEditorial(lire(p)));
      for (const terme of TERMES[langue]) {
        examines++;
        if (DEFINIS[p] && terme in DEFINIS[p]) continue;
        const m = txt.match(motif(terme));
        if (m) trouves.push(`${p} : « ${terme} » — ${m.length} fois`);
      }
    }
    expect(trouves,
      "Un terme de métier non défini : c'est le sujet même du lot.").toEqual([]);
    // Plancher : les deux listes, moins le terme admis de chacune.
    expect(examines).toBe((TERMES.fr.length + TERMES.en.length) * SLUGS.length);
  });

  it("chaque terme admis est défini dans la phrase qui le porte", () => {
    const ecarts = [];
    let admis = 0;
    for (const p of LOT) {
      const txt = texte(corpsEditorial(lire(p)));
      for (const [terme, definition] of Object.entries(DEFINIS[p] || {})) {
        admis++;
        const porteuses = phrases(txt).filter((s) => motif(terme).test(s));
        if (porteuses.length !== 1) {
          ecarts.push(`${p} : « ${terme} » dans ${porteuses.length} phrases, 1 attendue`);
          continue;
        }
        if (!porteuses[0].includes(definition))
          ecarts.push(`${p} : la phrase de « ${terme} » ne porte plus sa définition — ${porteuses[0]}`);
      }
    }
    expect(ecarts,
      "La définition a disparu de la phrase, ou le terme a bougé.").toEqual([]);
    const attendus = Object.values(DEFINIS).reduce((n, o) => n + Object.keys(o).length, 0);
    expect(admis, "aucun terme admis examiné : DEFINIS est vide ?").toBe(attendus);
    expect(attendus, "DEFINIS s'est vidé : le témoin n'examinerait plus rien.")
      .toBeGreaterThanOrEqual(4);
  });
});

describe("témoin de registre — la forme promise", () => {
  it("chaque langue tient entre 700 et 920 mots éditoriaux", () => {
    // La longueur fait partie du registre : un dirigeant lit une page, pas un
    // relevé. Le compte porte sur le corps éditorial défini plus haut,
    // titres et tableau compris, navigation et pied exclus.
    //
    // LE PLAFOND EST PASSE DE 900 A 920 LE 21 OCTOBRE 2026, ET C'EST UNE
    // DECISION, PAS UN RELACHEMENT. La consigne d'origine disait « 700 a 900
    // mots » et l'article tenait a 893 dans les deux langues. Alexis a ensuite
    // demande UNE PHRASE de plus -- le pont entre le nom du titre et les
    // lecteurs automatiques du corps, que le texte ne portait nulle part --
    // ce qui porte le francais a 915 et l'anglais a 913. Le plafond suit la
    // demande qui l'a deborde ; il ne la precede pas.
    //
    // Il reste SERRE : 920 est a cinq mots du francais. Une seconde phrase
    // ajoutee sans y penser rougit ici, ce qui est exactement le service
    // demande a ce plafond.
    const comptes = {};
    for (const p of LOT) {
      const txt = texte(corpsEditorial(lire(p)));
      comptes[p] = txt.split(/\s+/).filter(Boolean).length;
    }
    for (const [p, n] of Object.entries(comptes)) {
      expect(n, `${p} : ${n} mots`).toBeGreaterThanOrEqual(700);
      expect(n, `${p} : ${n} mots`).toBeLessThanOrEqual(920);
    }
  });

  it("chaque section du corps répond par un h2, et il y en a six", () => {
    // Une section par question de dirigeant. Six questions, six h2 : si un
    // lot suivant en ajoute un septième sans y penser, c'est ici qu'il le
    // verra.
    for (const p of LOT) {
      const h2 = [...corpsEditorial(lire(p)).matchAll(/<h2>/g)];
      expect(h2.length, `${p} : ${h2.length} h2`).toBe(6);
    }
  });

  it("les deux pages ferment autant de balises article qu'elles en ouvrent", () => {
    // NEUVE, ET ELLE NAIT D'UN DEFAUT MESURE SUR LE LOT VOISIN. Les six
    // pages des trois articles sectoriels du 20 octobre portent un
    // `</article>` de trop -- une ouverture, deux fermetures -- et aucun
    // garde du dépôt ne le voit. Le défaut vient du gabarit que ce lot-ci a
    // recopié : l'assertion reste donc sur les deux pages du lot, et les six
    // voisines sont signalées ailleurs, parce qu'un article existant ne se
    // modifie pas dans ce lot.
    for (const p of LOT) {
      const src = lire(p);
      const ouvre = (src.match(/<article\b/g) || []).length;
      const ferme = (src.match(/<\/article>/g) || []).length;
      expect(ouvre, `${p} : ${ouvre} <article>`).toBe(1);
      expect(ferme, `${p} : ${ferme} </article>`).toBe(1);
    }
  });
});
