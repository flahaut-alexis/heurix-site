import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// LE NOMBRE DE PACKS EST ECRIT EN DUR A TRENTE ET UN ENDROITS (27 aout 2026).
//
// VINGT-TROIS ETAIT LE COMPTE DE CE QUE CE TEST VOYAIT, pas de ce que le
// site affirme. Trois causes le rendaient aveugle a huit endroits de plus,
// toutes corrigees ci-dessous : un motif qui exigeait le nombre COLLE au
// mot, un `texte()` qui effacait les JSON-LD, et un perimetre limite aux
// .html. Un garde qui annonce « vingt-trois » en en voyant vingt-trois est
// vert par construction.
//
// pricing.html et en/pricing.html annoncaient « six packs » quand le moteur
// en chargeait dix, et enumeraient six noms sur dix. Corrige le meme jour.
// Le defaut avait survecu a l'ajout de quatre packs en devenant faux, sans
// que rien ne le signale -- le meme motif que le « 850 € HT/jour » de la
// veille.
//
// CE QUE CE TEST FAIT, ET CE QU'IL NE FAIT PAS.
//
// Il verifie que les vingt-trois endroits s'ACCORDENT ENTRE EUX. Il ne code
// aucun nombre en dur, deliberement : le jour ou un onzieme pack arrive, il
// ne doit pas falloir editer ce fichier, il doit falloir editer les pages.
// Ce test echoue sur une mise a jour PARTIELLE -- trois pages corrigees sur
// seize, ou quatre enumerations sur six.
//
// Il ne peut PAS voir le moteur gagner un pack pendant que le site dort :
// heurix-engine est un autre depot, prive. C'est
// `tests/test_rulepacks_inventaire.py`, de ce cote-la, qui porte cette
// moitie -- il echoue quand un pack est ajoute et nomme les pages a mettre
// a jour.
//
// Les deux ensemble ferment la famille. Aucun des deux seul.
// ---------------------------------------------------------------------------

const NOMBRES = {
  six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  ten: 10, eleven: 11, twelve: 12, nine: 9, eight: 8, seven: 7,
};

// LE PERIMETRE INCLUT LES .js (27 aout 2026). `search.js` et `search-en.js`
// portent l'index de recherche du site : ils recopient l'extrait de la FAQ,
// donc l'affirmation du nombre de packs. Le balayage ne lisait que les
// .html et les ratait tous les deux -- deux affirmations vivantes,
// invisibles au garde qui pretend les compter.
//
// `tests/` est exclu : les fixtures gelees de search-avant-s4 portent
// volontairement d'anciennes valeurs, c'est leur role.
const pages = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) { if (rel !== "tests") parcourir(rel); }
    else if (/\.(html|js)$/.test(e.name)) pages.push(rel);
  }
})("");

/** HTML brut, tel quel -- necessaire pour lire un <select>, que texte() efface. */
function brut(p) {
  return fs.readFileSync(path.join(RACINE, p), "utf8");
}

/** Texte visible PLUS les blocs JSON-LD, styles et autres scripts retires.
 *
 * LES JSON-LD ETAIENT EFFACES, ET C'ETAIT UN ANGLE MORT (27 aout 2026).
 * La version precedente retirait TOUT <script>. Or `faq.html:88`,
 * `pricing.html:92` et leurs equivalents anglais portent un FAQPage qui
 * RECOPIE le texte visible situe quelques centaines de lignes plus bas.
 * Le garde voyait la copie visible et pas celle-la -- quatre affirmations
 * qui partent aux moteurs de recherche, hors de sa portee.
 *
 * Un fichier .js est rendu tel quel : il n'a pas de balises a retirer. */
function texte(p) {
  let s = fs.readFileSync(path.join(RACINE, p), "utf8");
  if (p.endsWith(".js")) return s.replace(/\s+/g, " ");
  s = s.replace(/<script\b(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, "");
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

// LE NOMBRE N'EST PLUS EXIGE COLLE AU MOT (27 aout 2026).
//
// La version precedente exigeait l'adjacence -- `\s+(?:rule\s+)?packs?`.
// Un seul mot intercale la faisait echouer, en SILENCE :
//
//     « ten sector rule packs »          en/index.html
//     « ten ready-to-use rule packs »    en/blog/custom-rules...
//     « ten pre-configured rule packs »  en/blog/guide-mise-en-route
//     « Ten standard packs »             en/docs.html
//     « dix disponibles »                docs.html
//
// Cinq affirmations vivantes que le garde comptait ne pas voir. Le trait
// d'union est le piege le plus vicieux : `\w+` ne le traverse pas, donc
// « ready-to-use » compte pour trois mots la ou l'oeil en lit un.
//
// La fenetre de 45 caracteres remplace l'adjacence. Elle a ete calibree par
// mesure : elle attrape les cinq ci-dessus sans rien ramasser d'autre que
// les exceptions nommees plus bas.
//
// LE NOMBRE RESTE ECRIT EN LETTRES, ET C'EST DELIBERE. Un balayage incluant
// les chiffres a ete essaye : il rend 103 occurrences au lieu de 35, dont
// « Pack 4 », « level 1 », les gabarits `{0}` de console-i18n.js, et
// « 1 000 produits indexes = 10 requetes » de en/fonctionnalites.html --
// une regle de facturation qui n'a aucun rapport avec les packs. Ce dernier
// est l'exception nommee que demandait Alexis : elle explique pourquoi les
// chiffres sont hors motif plutot que filtres un par un.
//
// Les quatre affirmations qui S'ECRIVENT en chiffres -- les lignes de
// specification « rulepacks : 11 secteurs » -- ont leur propre assertion
// plus bas, parce qu'elles ont une forme stable qu'on peut viser
// exactement.
const NOMBRE_EN_LETTRES = "(?:six|sept|huit|neuf|dix|onze|douze|seven|eight|nine|ten|eleven|twelve)";
const MOT_PACK = "(?:rule\\s+packs?|rulepacks?|packs?)";
const AFFIRMATION = new RegExp(
  `\\b(${NOMBRE_EN_LETTRES})\\b(?:.{0,45}?)\\b${MOT_PACK}\\b`, "gi");

// EXCEPTIONS NOMMEES, chacune avec sa raison. Un motif large en produit ;
// une exception ecrite vaut mieux qu'un motif resserre, parce qu'elle se
// relit et se conteste, la ou un motif etroit rate en silence.
//
// Les cinq comptent des PAGES SECTORIELLES, pas des packs. C'est un autre
// inventaire, et il ne bouge pas quand un pack arrive : verifie le 27 aout
// -- index.html ne contient aucune occurrence de « sport », donc la grille
// n'affiche pas le onzieme pack et « Sept de ces secteurs » reste juste.
const EXCEPTIONS = [
  { motif: /sept de ces secteurs/i,
    raison: "compte les cartes sectorielles affichees sur la page, pas les packs" },
  { motif: /sept vocabulaires de reference|sept vocabulaires de référence/i,
    raison: "pages solutions : compte les sept pages sectorielles" },
  { motif: /seven reference vocabularies/i,
    raison: "idem, version anglaise" },
];

// Une enumeration commence par le premier pack et liste les autres.
const ENUMERATION = /\((outillage|hardware)[^)]{40,}\)/gi;

const affirmations = [];
const enumerations = [];
for (const p of pages) {
  const t = texte(p);
  for (const m of t.matchAll(AFFIRMATION)) {
    const exception = EXCEPTIONS.find((e) => e.motif.test(m[0]));
    if (exception) continue;
    affirmations.push({ page: p, mot: m[1].toLowerCase(), valeur: NOMBRES[m[1].toLowerCase()] });
  }
  for (const m of t.matchAll(ENUMERATION)) {
    const noms = m[0].slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean);
    if (noms.length >= 5) enumerations.push({ page: p, noms });
  }
}

describe("packs — les trente et une affirmations du site s'accordent", () => {
  it("toutes les affirmations chiffrees annoncent le meme nombre", () => {
    const valeurs = [...new Set(affirmations.map((a) => a.valeur))];
    const detail = valeurs.length > 1
      ? affirmations.map((a) => `${a.page} : ${a.mot} (${a.valeur})`)
      : [];
    expect(detail).toEqual([]);
    expect(valeurs).toHaveLength(1);
  });

  it("chaque enumeration nommee compte autant de noms que le chiffre annonce", () => {
    const attendu = affirmations[0].valeur;
    const faux = enumerations
      .filter((e) => e.noms.length !== attendu)
      .map((e) => `${e.page} : ${e.noms.length} noms pour « ${attendu} » annonce`);
    expect(faux).toEqual([]);
  });

  // Le cas que le seul comptage laisserait passer : six listes de dix noms,
  // dont l'une remplace un pack par un autre. Le nombre serait juste et le
  // contenu faux.
  //
  // ON COMPARE L'IDENTITE DU PACK, PAS SON LIBELLE. Premiere version de
  // cette assertion : elle exigeait des listes identiques mot pour mot, et
  // elle est tombee sur quatre pages qui varient DELIBEREMENT l'etiquette --
  // « vins » sur faq.html, « vins & spiritueux » sur console.html, « wine »
  // contre « wine & spirits » cote anglais. Meme pack, deux facons de le
  // nommer, et le site a le droit.
  //
  // L'identite est donc le premier mot de l'etiquette, celui qui ne varie
  // pas. Un pack remplace ou manquant se voit toujours ; une variation de
  // formulation ne fait plus echouer.
  // LA LANGUE NE SE LIT PLUS SEULEMENT DANS LE CHEMIN (27 aout 2026).
  //
  // Le partage etait `p.startsWith("en/")`. Il tenait tant que le balayage
  // ne lisait que des .html, tous ranges par langue. Des que les .js sont
  // entres dans le perimetre, il a casse : `search-en.js` est A LA RACINE
  // et sert le site anglais. Il etait donc compte comme francais, et le
  // garde a echoue en montrant une liste anglaise au milieu des francaises.
  //
  // C'est l'elargissement lui-meme qui a produit ce defaut, et c'est le
  // garde elargi qui l'a montre a sa premiere execution.
  const estAnglais = (p) => p.startsWith("en/") || /-en\.js$/.test(p);

  const identite = (n) =>
    n.replace(/&amp;/g, "&").split(/[&(,]/)[0].trim().toLowerCase();
  const clef = (noms) => noms.map(identite).sort().join("|");

  it("les enumerations francaises listent les MEMES packs", () => {
    const fr = enumerations.filter((e) => !estAnglais(e.page));
    const clefs = [...new Set(fr.map((e) => clef(e.noms)))];
    const detail = clefs.length > 1 ? fr.map((e) => `${e.page} : ${e.noms.join(", ")}`) : [];
    expect(detail).toEqual([]);
  });

  it("les enumerations anglaises listent les MEMES packs", () => {
    const en = enumerations.filter((e) => estAnglais(e.page));
    const clefs = [...new Set(en.map((e) => clef(e.noms)))];
    const detail = clefs.length > 1 ? en.map((e) => `${e.page} : ${e.noms.join(", ")}`) : [];
    expect(detail).toEqual([]);
  });

  it("les listes francaise et anglaise ont le meme nombre de packs", () => {
    const fr = enumerations.filter((e) => !estAnglais(e.page));
    const en = enumerations.filter((e) => estAnglais(e.page));
    expect(fr.length, "aucune enumeration francaise trouvee").toBeGreaterThan(0);
    expect(en.length, "aucune enumeration anglaise trouvee").toBeGreaterThan(0);
    expect(en[0].noms.length).toBe(fr[0].noms.length);
  });

  // ---------------------------------------------------------------------
  // LE MEME FAIT, SOUS UNE FORME QUE LE BALAYAGE NE VOYAIT PAS (27 aout).
  //
  // console.html porte un <select> « Quel secteur decrit le mieux votre
  // catalogue ? » dont les value sont des NOMS DE PACKS. Il en listait SEPT
  // sur dix : electricite, plomberie et finance n'y sont jamais entres
  // depuis leur ajout le 26 juillet, trois semaines plus tot.
  //
  // Mon balayage cherchait des chiffres ecrits et des enumerations entre
  // parentheses. Une liste d'options n'est ni l'un ni l'autre : elle affirme
  // « il y a N secteurs » en en proposant N, sans jamais l'ecrire.
  //
  // Ce champ est DERIVE, pas liste : seules les pages qui portent un
  // seg-secteur sont verifiees. en/console.html n'en a pas -- non par oubli
  // de parite, mais parce qu'elle n'a pas l'ecran de post-inscription du
  // tout (section post-signup-screen, absente : 6 identifiants cote
  // francais, zero cote anglais). Ticket ouvert separement.
  // ---------------------------------------------------------------------

  // Les value du select s'ecrivent sans accent (electricite) la ou les
  // etiquettes en portent (electricite). On replie donc les accents avant
  // de comparer -- sinon l'assertion echouerait sur une difference
  // d'orthographe qui n'est pas un defaut.
  const sansAccent = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const idPack = (x) => sansAccent(identite(x));

  it("les options du select de secteur sont exactement les packs", () => {
    const avecSelect = pages.filter((p) => /id="seg-secteur"/.test(brut(p)));
    expect(avecSelect.length, "aucune page ne porte de select de secteur").toBeGreaterThan(0);

    // La reference : l'enumeration nommee de la meme langue.
    const ref = enumerations.find((e) => !estAnglais(e.page));
    const attendus = new Set(ref.noms.map(idPack));

    const ecarts = [];
    for (const p of avecSelect) {
      const bloc = brut(p).match(/<select id="seg-secteur">([\s\S]*?)<\/select>/)[1];
      const valeurs = [...bloc.matchAll(/<option value="([^"]*)"/g)]
        .map((m) => m[1])
        .filter((v) => v && v !== "autre");   // « — Choisir — » et « Autre » ne sont pas des packs
      const vus = new Set(valeurs.map(idPack));
      const manquants = [...attendus].filter((x) => !vus.has(x));
      const enTrop = [...vus].filter((x) => !attendus.has(x));
      if (manquants.length) ecarts.push(`${p} : pack(s) absent(s) du select — ${manquants.join(", ")}`);
      if (enTrop.length) ecarts.push(`${p} : option(s) sans pack correspondant — ${enTrop.join(", ")}`);
    }
    expect(ecarts).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // LES QUATRE AFFIRMATIONS ECRITES EN CHIFFRES (27 aout 2026).
  //
  // index.html, produit.html et leurs equivalents anglais portent un bloc
  // de specification imitant une console :
  //
  //     <span class="k">rulepacks</span><span class="v">11 secteurs, extensibles</span>
  //
  // Le nombre y est un CHIFFRE, dans du faux code. Le motif en lettres ne
  // peut pas les voir, et les inclure en elargissant aux chiffres ramenerait
  // « Pack 4 », « level 1 » et les gabarits `{0}` -- 103 occurrences au lieu
  // de 35, mesure.
  //
  // Leur forme est stable, donc on les vise exactement plutot que largement.
  // C'est le contraire de la lecon habituelle -- deriver plutot qu'enumerer
  // -- et c'est justifie ici parce qu'on enumere une FORME, pas une liste de
  // fichiers : toute page qui adopte ce bloc est verifiee sans etre nommee.
  // ---------------------------------------------------------------------
  it("les lignes de specification rulepacks annoncent le meme nombre", () => {
    const SPEC = /<span class="k">rulepacks<\/span><span class="v">(\d+)\s/g;
    const releves = [];
    for (const p of pages) {
      for (const m of brut(p).matchAll(SPEC)) releves.push({ page: p, valeur: Number(m[1]) });
    }
    expect(releves.length, "aucune ligne de specification rulepacks trouvee").toBeGreaterThan(0);

    const attendu = affirmations[0].valeur;
    const faux = releves
      .filter((r) => r.valeur !== attendu)
      .map((r) => `${r.page} : rulepacks ${r.valeur} pour « ${attendu} » annonce ailleurs`);
    expect(faux).toEqual([]);
  });

  // Un balayage qui n'examine rien passe au vert sans rien prouver.
  //
  // LES PLANCHERS ONT MONTE avec le perimetre : 15 affirmations quand le
  // garde n'en voyait que les .html sans JSON-LD, 30 depuis qu'il lit les
  // deux copies et les .js. Un plancher qui ne monte pas avec le perimetre
  // laisse un elargissement se defaire sans rien dire.
  it("le balayage a reellement trouve les affirmations", () => {
    expect(affirmations.length).toBeGreaterThanOrEqual(28);
    expect(enumerations.length).toBeGreaterThanOrEqual(6);
    expect(pages.filter((p) => p.endsWith(".js")).length,
      "aucun .js dans le perimetre : l'index de recherche echappe au garde")
      .toBeGreaterThan(0);
    expect(pages.some((p) => /<script[^>]*application\/ld\+json/.test(brut(p))),
      "aucun JSON-LD lu : les copies de balisage echappent au garde").toBe(true);
  });
});
