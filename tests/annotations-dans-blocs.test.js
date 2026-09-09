import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// TROIS ANNOTATIONS INVENTEES ONT VECU DES MOIS DANS LA DOCUMENTATION
// (9 septembre 2026).
//
// PAYS_SE, FORMAT_PO, MAT_SS. Aucun pack ne les ecrit. Elles ont ete
// trouvees par un balayage A LA MAIN, en comparant les blocs de code aux
// 223 modeles de `heurix-engine/rulepacks/` -- onze identifiants faux en
// tout, sur SIX pages : cinq traduits (`en/produit.html`), deux abreges et
// trois inventes (les deux `docs.html`), un faux dans les deux langues
// (`produit.html`). Corriges par `9123d39e`.
//
// Le site ne pouvait pas les voir seul : `rulepacks/` vit dans l'autre
// depot, prive. Le moteur publie desormais son inventaire -- GET
// /v1/rulepacks/annotations, chaque modele avec la REGEX qui le reconnait --
// et `tests/fixtures/generate.py` le capture dans `engine-contract.json`.
// Ce garde lit la fixture versionnee : il ne demande pas le moteur, la CI
// du site ne l'a pas.
//
// C'est le meme partage que `packs-noms-dans-json.test.js` pour les NOMS de
// packs, a une difference pres : onze noms se recopient a la main, 223
// modeles non. La liste vient du moteur, et elle ne se relit pas.
//
// LA REGEX EST LE COEUR, PAS LE MODELE. `DIAM_M{1}` ne se compare pas a une
// chaine litterale, et le quantificateur decide : `Rule.apply` fait
// `valeur = group or ""`, un groupe non participant rend la chaine VIDE.
// Avec un `+` au lieu d'un `*`, SEIZE occurrences justes sont declarees
// fausses -- AILE_5M2, BALLON_T3, COMBI_4_3, sur les deux
// `solutions/sport.html`. Mesure refaite ici, et `il ne rejette rien de
// vrai` en porte le temoin. Un garde qui rejette du vrai est pire que pas
// de garde : la correction consiste alors a casser la page.
// ---------------------------------------------------------------------------
const CONTRAT = JSON.parse(
  fs.readFileSync(path.join(RACINE, "tests/fixtures/engine-contract.json"), "utf8"),
);
const INVENTAIRE = CONTRAT.inventaire_annotations;

// ---------------------------------------------------------------------------
// LE PERIMETRE FAIT LE PREMIER TRI, ET C'EST LUI QUI EVITE UNE LISTE.
//
// Le motif MAJUSCULE_MAJUSCULE ramasse aussi du code qui n'a rien d'une
// annotation. Mesure du 9 septembre sur les 154 pages :
//
//   HEURIX_RACINE   pose dans un <script> de pied de page, sur 122 pages.
//                   HORS PERIMETRE : ce n'est pas un bloc de documentation,
//                   c'est le code de la page. Zero entree de liste.
//   CUSTOM_PLAKO    dans l'attribut `alt` d'une capture d'ecran, deux fois.
//                   HORS PERIMETRE pour la meme raison -- et de toute facon
//                   couvert par le prefixe CUSTOM_ ci-dessous.
//
// Restreindre aux blocs de code n'est donc pas un choix de commodite : c'est
// ce qui distingue « la documentation AFFIRME que cette annotation existe »
// de « la page contient une constante ».
const BLOC = /<(pre|code)\b[^>]*class="[^"]*(?:docs-code|docs-inline-code|hero-code|panel-code|integration-code)[^"]*"[^>]*>([\s\S]*?)<\/\1>/g;
const JETON = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9./-]+)+\b/g;

// ---------------------------------------------------------------------------
// CINQ PREFIXES, ET NON QUINZE NOMS. C'est la reponse mesuree a « comment
// les distinguer sans liste ecrite a la main ».
//
// Dans le perimetre, quinze jetons distincts (128 occurrences) restaient
// apres l'inventaire, et TOUS tombent sous quatre prefixes :
//
//   CURLOPT_   4 jetons   constantes de la bibliotheque cURL, exemples PHP
//   HEURIX_    3 jetons   variables d'environnement des exemples
//   VOTRE_     4 jetons   placeholders de cle, cote FR
//   YOUR_      4 jetons   les memes, cote EN
//
// Le cinquieme, CUSTOM_, n'a aucune occurrence aujourd'hui et n'est pas une
// precaution : `Store._compile_custom_rule` construit litteralement
// `f"CUSTOM_{fragment}"` a partir du libelle SAISI PAR LE MARCHAND. Une
// annotation de Custom Rule ne peut donc PAS figurer dans un inventaire de
// packs, par construction, et la documentation en cite (« CUSTOM_PLAKO »).
// Sans ce prefixe, le premier exemple de Custom Rule pose dans un bloc de
// code ferait echouer ce garde a tort.
//
// POURQUOI UN PREFIXE PLUTOT QUE QUINZE NOMS. Un nom se perime en silence
// quand l'exemple qui le portait disparait ; une liste de quinze en aurait
// gardees plusieurs, mortes, et un seizieme placeholder ajoute demain
// echouerait le garde sans rien avoir de faux. Un prefixe couvre la FAMILLE.
//
// CE QU'UN PREFIXE RISQUE, ET CE QUI L'EN EMPECHE : masquer une vraie
// annotation qui commencerait pareil. `aucun prefixe exclu ne masque un
// modele` l'interdit contre l'inventaire lui-meme -- donc contre la donnee
// du moteur, regeneree a chaque capture, pas contre une relecture.
const PREFIXES_HORS_PACKS = ["CURLOPT_", "HEURIX_", "VOTRE_", "YOUR_", "CUSTOM_"];

const motifs = INVENTAIRE.map((e) => ({ modele: e.modele, re: new RegExp(e.motif) }));

const pages = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) { if (rel !== "tests") parcourir(rel); }
    else if (e.name.endsWith(".html")) pages.push(rel);
  }
})("");

function jetonsDeLaPage(p) {
  const src = fs.readFileSync(path.join(RACINE, p), "utf8");
  const out = [];
  for (const m of src.matchAll(BLOC)) {
    const ligne = src.slice(0, m.index).split("\n").length;
    const txt = m[2]
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
    for (const jeton of new Set(txt.match(JETON) || [])) {
      if (PREFIXES_HORS_PACKS.some((p) => jeton.startsWith(p))) continue;
      out.push({ jeton, ligne });
    }
  }
  return out;
}

const releves = pages.flatMap((p) => jetonsDeLaPage(p).map((j) => ({ page: p, ...j })));
const inconnus = releves.filter((r) => !motifs.some((m) => m.re.test(r.jeton)));

describe("annotations citees dans les blocs de code", () => {
  // LE POSITIF CONNU, et il est double : la fixture doit porter l'inventaire,
  // et le balayage doit voir des jetons. Sans le premier, un
  // `engine-contract.json` regenere par un moteur trop ancien rendrait un
  // tableau vide et TOUT serait declare faux -- 657 occurrences justes. Sans
  // le second, une classe CSS renommee rendrait ce fichier vert sur zero.
  it("la fixture porte l'inventaire et le balayage voit des jetons", () => {
    expect(Array.isArray(INVENTAIRE), "inventaire_annotations absent de la fixture : regenerer avec npm run fixtures").toBe(true);
    expect(INVENTAIRE.length, "inventaire vide ou tronque").toBeGreaterThanOrEqual(200);
    expect(releves.length, "aucun jeton releve : le motif ou le perimetre est casse").toBeGreaterThanOrEqual(500);
    expect(new Set(releves.map((r) => r.jeton)).size).toBeGreaterThanOrEqual(100);
  });

  it("toute annotation citee est un modele que les packs peuvent ecrire", () => {
    const rendu = [...new Set(inconnus.map((r) => `${r.page}:${r.ligne} ${r.jeton}`))].sort();
    expect(
      rendu,
      "identifiant qu'aucune regle de heurix-engine/rulepacks/ ne produit -- traduit, abrege ou invente",
    ).toEqual([]);
  });

  // LE TEMOIN DU QUANTIFICATEUR. Il ne relit pas le motif, il le REJOUE :
  // on remplace `]*` par `]+` dans les 223 motifs de la fixture et on exige
  // que le balayage se mette a rejeter -- exactement les trois annotations
  // du pack sport, et rien d'autre. Une assertion qui dirait seulement
  // « le motif contient une etoile » serait vraie sur un motif ou l'etoile
  // ne sert a rien.
  it("il ne rejette rien de vrai -- le quantificateur est teste, pas relu", () => {
    const stricts = INVENTAIRE.map((e) => new RegExp(e.motif.replaceAll("]*", "]+")));
    // LA DIFFERENCE, PAS L'ENSEMBLE. Une premiere version comparait tous les
    // jetons que le `+` rejette a une liste de trois -- vert sur le site
    // corrige, ROUGE sur un site fautif, ou les onze faux s'y ajoutent alors
    // qu'ils n'ont rien a voir avec le quantificateur. Le temoin mesurait
    // l'etat du site en croyant mesurer le motif. Ce qui isole l'un de
    // l'autre : les jetons que l'ETOILE accepte et que le PLUS refuse.
    const perdus = [...new Set(
      releves
        .filter((r) => motifs.some((m) => m.re.test(r.jeton)))
        .filter((r) => !stricts.some((m) => m.test(r.jeton)))
        .map((r) => r.jeton),
    )].sort();
    expect(
      perdus,
      "un `+` a la place du `*` doit faire perdre ces trois-la, et seulement eux : "
      + "liste vide, le temoin ne prouve plus que l'etoile sert",
    ).toEqual(["AILE_5M2", "BALLON_T3", "COMBI_4_3"]);
  });

  // CE QUI FAIT QU'UN PREFIXE N'EST PAS UN TROU. Il est verifie contre la
  // donnee du moteur : le jour ou un pack poserait `CUSTOM_X` ou `HEURIX_X`,
  // ce test tombe, et le prefixe qui le masquerait est nomme.
  it("aucun prefixe exclu ne masque un modele de l'inventaire", () => {
    const masques = INVENTAIRE
      .filter((e) => PREFIXES_HORS_PACKS.some((p) => e.modele.startsWith(p)))
      .map((e) => e.modele);
    expect(masques, "un modele de pack commence par un prefixe exclu : le retirer de PREFIXES_HORS_PACKS").toEqual([]);
  });

  // LE CAS DE BORD PORTE LES ONZE VALEURS REELLES DU RELEVE, pas des faux
  // noms inventes. Un faux nom invente prouverait que le garde sait rejeter
  // ce que j'ai imagine ; ceux-ci ont ete publies, en ligne, pendant des
  // mois. VIS_M8_INOX est le plus instructif : il porte le prefixe et la
  // forme d'une annotation d'outillage, et aucune regle ne l'ecrit --
  // `DIAM_INOX` rend `DIAM_M8_INOX`.
  it("rejette les onze identifiants trouves sur le site le 9 septembre 2026", () => {
    const faux = [
      "MAT_SS", "SCREW_M8_SS", "FAM_TROUSERS", "SIZE_32_34", "JEANS_T32_34",
      "FORMAT_PO", "FORMAT_BR",
      "PAYS_SE", "PAYS_FR", "PAYS_UK",
      "VIS_M8_INOX",
    ];
    const acceptes = faux.filter((f) => motifs.some((m) => m.re.test(f)));
    expect(acceptes, "identifiants faux acceptes par l'inventaire").toEqual([]);
    // TEMOIN : les vrais que ces faux imitaient doivent passer. Sans lui, un
    // inventaire vide rendrait l'assertion ci-dessus vraie pour rien.
    for (const vrai of ["MAT_INOX", "VIS_M8X20", "FAM_PANTALON", "TAILLE_32_34",
                        "JEAN_T32_34", "FORMAT_POCHE", "FORMAT_BROCHE", "DIAM_M8_INOX"]) {
      expect(motifs.some((m) => m.re.test(vrai)), `${vrai} devrait etre reconnu`).toBe(true);
    }
  });
});
