import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// LA TABLE DES PICTOGRAMMES ETAIT ECRITE DE MEMOIRE (9 septembre 2026).
//
// `heurix-pictos.js` choisit une icone d'apres les annotations d'un resultat.
// Sept de ses trente-six clefs n'etaient emises par aucun des onze packs de
// `heurix-engine/rulepacks/`, mesure sur heurix-engine dc631b5 :
//
//     FAM_JEAN          le pack mode pose FAM_PANTALON -- `FAMILLE_JEAN`
//                       est le nom de la REGLE, pas de l'annotation
//     FAM_ROMAN         le pack livres pose GENRE_ROMAN
//     FAM_POCHE         le pack livres pose FORMAT_POCHE
//     FAM_RESISTANCE    aucun equivalent : `electronique` couvre le
//     FAM_CONDENSATEUR  high-tech grand public, pas les composants
//     FAM_CONNECTEUR
//     FAM_CASQUE        « casque » est reconnu par FAMILLE_ECOUTEURS, qui
//                       pose FAM_ECOUTEURS : rien ne distingue les deux
//
// Des deux cotes de la table, la meme cause donnait deux defauts distincts :
// SIX pictogrammes dessines etaient inatteignables (CASQUE, CONDENSATEUR,
// CONNECTEUR, LIVRE, PANTALON, RESISTANCE), et QUINZE annotations reellement
// emises n'avaient aucune entree, donc rendaient l'icone de repli : TOUTES
// les familles de `sport` et de `automobile`, trois de `plomberie`, une
// d'`electricite`, et `FAM_PANTALON` cote `mode`.
//
// ET UNE TROISIEME MESURE QUE LA LISTE DES QUINZE NE MONTRAIT PAS : TROIS
// PACKS SUR ONZE -- finance, livres, sport -- n'affichaient AUCUN
// pictogramme. Pour deux d'entre eux ce n'est pas un oubli de clefs mais une
// forme de vocabulaire : `livres` et `finance` ne posent aucune annotation
// `FAM_`. Un garde qui n'aurait exige que la couverture des `FAM_` serait
// vert en les laissant entierement au repli. C'est pourquoi la couverture
// PAR PACK est assertee separement.
//
// POURQUOI CE DEFAUT NE POUVAIT PAS SE VOIR. Un pictogramme faux ne leve
// pas, ne casse pas la mise en page, et l'icone de repli ressemble a un
// choix. Le seul signal aurait ete de comparer la table aux packs -- ce que
// personne n'avait de quoi faire : `rulepacks/` vit dans l'autre depot.
//
// LA SECONDE SOURCE. `tests/fixtures/generate.py` fait tourner le VRAI
// moteur et versionne ses reponses dans `engine-contract.json`. On y verse
// desormais l'inventaire complet des annotations, chacune avec le pack qui
// l'ecrit et la regex qui la reconnait.
// C'est la meme reponse que `packs-noms-dans-json.test.js` apporte au meme
// probleme -- il croise sa liste avec `solutions/` faute de mieux ; ici il
// existe mieux, puisque le moteur peut etre interroge et sa reponse gardee.
//
// CE QUE CE GARDE NE PEUT PAS FAIRE. L'inventaire est un instantane : un
// pack modifie dans heurix-engine ne le perime pas tout seul. Il faut
// relancer `HEURIX_ENGINE_PATH=... npm run fixtures`. C'est la limite
// assumee de tout contrat versionne, et c'est deja celle de ce fichier de
// fixtures depuis sa naissance.
// ---------------------------------------------------------------------------

const CONTRAT = JSON.parse(
  fs.readFileSync(path.join(RACINE, "tests/fixtures/engine-contract.json"), "utf8"),
);

// LA MEME CAPTURE QUE `annotations-dans-blocs.test.js`, PAS UNE VOISINE.
//
// Les deux gardes sont nes le meme jour, sur deux branches, et chacun avait
// verse son propre inventaire dans cette fixture -- l'un par la route
// publiee GET /v1/rulepacks/annotations, l'autre par un import de
// `load_rulepacks`. Deux chemins vers la meme donnee, dont un qui lit les
// INTERNES du moteur la ou l'autre lit son CONTRAT.
//
// C'est la route qui a ete gardee, et le champ `packs` a ete ajoute a ses
// entrees. La raison est celle que `generate.py` donne deja pour cette
// capture : une fonction ne bouge pas quand le moteur renomme l'enveloppe de
// sa reponse, donc une capture par la fonction resterait juste alors que la
// production aurait change de forme. Un consommateur du site lit la route ;
// la fixture doit donc lire la route.
//
// CE QUE LE NIVEAU AURAIT DONNE, ET POURQUOI ON S'EN PASSE. La route ne
// publie pas le niveau d'une annotation. Les 41 annotations `FAM_` du depot
// sont toutes de niveau 1 (mesure du 9 septembre 2026), donc la couverture
// des familles est identique avec ou sans. Le jour ou un pack ecrira un
// `FAM_` compose au niveau 2, ce garde exigera pour lui une entree que rien
// ne peut atteindre la premiere -- ses constituants de niveau 1 sont dans le
// meme `matched` et le precedent dans la table. Le remede sera de publier le
// niveau sur la route, pas de rouvrir une seconde capture.
const INVENTAIRE = CONTRAT.inventaire_annotations;

// --- le moteur de pictogrammes, charge comme une page le charge ------------
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  runScripts: "outside-only",
});
dom.window.eval(fs.readFileSync(path.join(RACINE, "heurix-pictos.js"), "utf8"));
const { pictogramme, tous: PICTOS, regles: REGLES } = dom.window.HeurixPictos;

// Nom du pictogramme a partir de son dessin. `pictogramme()` rend du SVG ;
// tout ce qui suit raisonne sur des NOMS, plus lisibles dans un echec.
const PAR_DESSIN = new Map(Object.entries(PICTOS).map(([nom, svg]) => [svg, nom]));
const nomDuPicto = (annotation) => PAR_DESSIN.get(pictogramme(["annotation #" + annotation]));

// --- l'univers des annotations reellement emises ---------------------------
//
// Les gabarits portent `{1}`, `{2}`... : la valeur est capturee sur la fiche
// et n'est pas connue d'avance. On les instancie avec deux valeurs d'essai,
// reprises de `_VALEURS_ESSAI` cote moteur, parce qu'une valeur numerique et
// une valeur alphabetique ne se comportent pas pareil dans une sous-chaine.
const instances = (modele) =>
  ["7", "INOX"].map((v) => modele.replace(/\{\d\}/g, v));

const MODELES = (INVENTAIRE || []).map((e) => e.modele);
const UNIVERS = [...new Set(MODELES.flatMap((m) =>
  m.includes("{") ? instances(m) : [m]))];

// Les deux seules formes de clef admises : une annotation entiere, ou la
// TETE d'un gabarit (ce qui precede son premier `{`).
const ANNOTATIONS_ENTIERES = new Set(MODELES.filter((m) => !m.includes("{")));
const TETES_DE_GABARIT = new Set(
  MODELES.filter((m) => m.includes("{")).map((m) => m.slice(0, m.indexOf("{"))),
);

// Les packs, et ce que chacun peut afficher.
const PACKS = [...new Set((INVENTAIRE || []).flatMap((e) => e.packs))].sort();
const modelesDuPack = (pack) =>
  INVENTAIRE.filter((e) => e.packs.includes(pack)).map((e) => e.modele);

describe("pictogrammes croises avec les annotations du moteur", () => {
  // LE POSITIF CONNU. Sans lui, un inventaire absent du contrat ou un
  // `HeurixPictos` non charge rendrait tout ce fichier vert sur zero releve
  // -- vert parce qu'il ne peut rien trouver, pas parce que la table est
  // juste. Les onze packs sont nommes, et deux annotations connues aussi.
  // LE POSITIF CONNU, ET LA MEME PROPRIETE QUE `annotations-dans-blocs`.
  //
  // Ce garde rend un verdict SUR LA TABLE en s'appuyant sur l'inventaire :
  // une fixture vide ou absente ferait declarer mortes les 82 clefs justes
  // de la table, et muets les onze packs. C'est la forme exacte du defaut
  // que son voisin nomme -- « une fixture vide declarerait fausses les 657
  // occurrences justes ». Les deux directions sont donc bornees ici, AVANT
  // toute assertion : la forme de la fixture, son volume, et le fait que la
  // table soit chargee. Un echec ici dit « regenerer », pas « corriger ».
  it("la fixture porte l'inventaire et la table est chargee", () => {
    expect(Array.isArray(INVENTAIRE),
      "inventaire_annotations absent de la fixture : regenerer avec npm run fixtures").toBe(true);
    expect(INVENTAIRE.length, "inventaire vide ou tronque").toBeGreaterThanOrEqual(200);
    expect(INVENTAIRE.every((e) => Array.isArray(e.packs) && e.packs.length > 0),
      "entree sans `packs` : fixture d'avant le champ, regenerer").toBe(true);
    expect(PACKS, "les onze packs du moteur ne sont pas tous dans l'inventaire").toEqual([
      "automobile", "electricite", "electronique", "finance", "industrie",
      "livres", "mode", "outillage", "plomberie", "sport", "vins",
    ]);
    expect(ANNOTATIONS_ENTIERES.has("FAM_VIS")).toBe(true);
    expect(TETES_DE_GABARIT.has("ISBN_")).toBe(true);
    expect(Array.isArray(REGLES) && REGLES.length,
      "HeurixPictos.regles non expose : la table n'est pas lue").toBeGreaterThanOrEqual(40);
    expect(Object.keys(PICTOS).length).toBeGreaterThanOrEqual(30);
    // Le repli existe et sert bien quand rien n'est annote.
    expect(nomDuPicto("RIEN_DU_TOUT")).toBe("DEFAUT");
  });

  it("deux pictogrammes ne partagent pas le meme dessin", () => {
    // `nomDuPicto` remonte du SVG au nom : deux dessins identiques rendraient
    // sa reponse arbitraire, et un doublon fidele naitrait vert.
    expect(PAR_DESSIN.size).toBe(Object.keys(PICTOS).length);
  });

  // --- direction 1 : aucune clef morte -------------------------------------
  it("toute clef de la table est une annotation que le moteur emet", () => {
    const mortes = REGLES
      .map(([clef]) => clef)
      .filter((c) => !ANNOTATIONS_ENTIERES.has(c) && !TETES_DE_GABARIT.has(c));
    expect(
      mortes,
      "clef absente de rulepacks/ -- inventee, prise pour un nom de regle, " +
      "ou annotation renommee dans heurix-engine (relancer npm run fixtures)",
    ).toEqual([]);
  });

  it("aucune clef n'est un prefixe invente", () => {
    // Une clef qui n'est ni une annotation entiere ni une tete de gabarit
    // serait un prefixe : `pictogramme()` comparant par SOUS-CHAINE, `GENRE_`
    // prendrait `GENRE_MALE` et `GENRE_FEMELLE` -- des filetages de plomberie
    // qui recevraient une icone de livre. Le test precedent l'interdit deja ;
    // celui-ci montre le cas, pour que la raison survive a la regle.
    const clefs = REGLES.map(([c]) => c);
    expect(clefs).not.toContain("GENRE_");
    expect(clefs).not.toContain("FORMAT_");
    expect(ANNOTATIONS_ENTIERES.has("GENRE_FEMELLE")).toBe(true);
    expect(nomDuPicto("GENRE_FEMELLE")).toBe("DEFAUT");
    expect(nomDuPicto("GENRE_ROMAN")).toBe("LIVRE");
    expect(nomDuPicto("FORMAT_75CL")).toBe("VIN");
    expect(nomDuPicto("FORMAT_POCHE")).toBe("LIVRE");
  });

  // --- direction 2 : aucun dessin inatteignable ----------------------------
  it("tout pictogramme dessine est atteignable par une annotation reelle", () => {
    const atteints = new Set(UNIVERS.map(nomDuPicto));
    atteints.add("DEFAUT"); // atteint par construction, quand rien ne matche
    const orphelins = Object.keys(PICTOS).filter((n) => !atteints.has(n)).sort();
    expect(
      orphelins,
      "dessin que rien ne peut selectionner : le rebrancher sur une " +
      "annotation reelle, ou le supprimer",
    ).toEqual([]);
  });

  // --- direction 3 : couverture des familles -------------------------------
  it("toute annotation FAM_ recoit un pictogramme", () => {
    const parPack = new Map(INVENTAIRE.flatMap((e) => e.packs.map((p) => [e.modele, p])));
    const familles = MODELES.filter((m) => m.startsWith("FAM_"));
    const sans = familles
      .filter((m) => nomDuPicto(m) === "DEFAUT")
      .map((m) => `${parPack.get(m)}: ${m}`);
    expect(sans, "famille annotee par le moteur et rendue au repli").toEqual([]);
    // Positif connu de CETTE mesure : la population n'est pas vide.
    expect(familles.length).toBeGreaterThanOrEqual(40);
  });

  it("chaque pack peut afficher au moins un pictogramme", () => {
    // `livres` et `finance` ne posent aucun `FAM_` : sans cette assertion,
    // le test precedent serait vert en les laissant entierement au repli.
    // C'est pour elle seule que la capture garde l'appartenance aux packs.
    const muets = PACKS.filter((pack) =>
      modelesDuPack(pack)
        .flatMap((m) => (m.includes("{") ? instances(m) : [m]))
        .every((a) => nomDuPicto(a) === "DEFAUT"));
    expect(muets, "pack dont aucune annotation ne rend d'icone").toEqual([]);
  });

  // --- le piege de la comparaison par sous-chaine ---------------------------
  it("une clef contenue dans une autre annotation y sert le meme pictogramme", () => {
    // `indexOf` ne compare pas des egalites : `MILLESIME_` est contenu dans
    // `MOUSSEUX_MILLESIME_2019`, et `ELEVAGE_BIO` dans `ELEVAGE_BIODYNAMIE`.
    // C'est sans consequence tant que les deux rendent la MEME icone. Ce test
    // ne l'interdit donc pas -- il interdit qu'elles divergent, ce qui est le
    // seul cas visible par un visiteur.
    const conflits = [];
    for (const [clef, picto] of REGLES) {
      for (const a of UNIVERS) {
        if (a.includes(clef) && nomDuPicto(a) !== picto) {
          conflits.push(`"${clef}" -> ${picto}, mais "${a}" -> ${nomDuPicto(a)}`);
        }
      }
    }
    expect(conflits, "sous-chaine qui detourne une annotation vers une autre icone")
      .toEqual([]);
  });

  // --- les recouvrements que les packs documentent eux-memes ---------------
  it("les recouvrements assumes par les packs vont ou le pack les envoie", () => {
    // sport : « Wing Foil Board 75L » sort FAM_AILE *et* FAM_PLANCHE ; le
    // pack ecrit que c'est une planche de wing, pas une aile.
    expect(pictogramme(["annotation #FAM_AILE", "annotation #FAM_PLANCHE"]))
      .toBe(PICTOS.PLANCHE);
    // mode : un sweat-shirt sort FAM_CHEMISE *et* FAM_PULL.
    expect(pictogramme(["annotation #FAM_CHEMISE", "annotation #FAM_PULL"]))
      .toBe(PICTOS.PULL);
    // electronique : un cable de chargeur sort FAM_CABLE *et* FAM_CHARGEUR.
    expect(pictogramme(["annotation #FAM_CABLE", "annotation #FAM_CHARGEUR"]))
      .toBe(PICTOS.CHARGEUR);
  });

  // --- les sept clefs mortes du 9 septembre 2026 ----------------------------
  it("les sept clefs corrigees ne rendent plus rien par elles-memes", () => {
    // Le cas est reconstruit, pas seulement decrit : si quelqu'un remettait
    // `FAM_JEAN` dans la table, « toute clef est une annotation » le dirait
    // -- mais rien ne dirait que le vrai nom est `FAM_PANTALON`.
    for (const morte of ["FAM_JEAN", "FAM_ROMAN", "FAM_POCHE", "FAM_RESISTANCE",
                         "FAM_CONDENSATEUR", "FAM_CONNECTEUR", "FAM_CASQUE"]) {
      expect(ANNOTATIONS_ENTIERES.has(morte), `${morte} existe maintenant`).toBe(false);
    }
    expect(nomDuPicto("FAM_PANTALON")).toBe("PANTALON");
    expect(nomDuPicto("GENRE_ROMAN")).toBe("LIVRE");
    expect(nomDuPicto("FAM_ECOUTEURS")).toBe("ECOUTEURS");
  });
});
