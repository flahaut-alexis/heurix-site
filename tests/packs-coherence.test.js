import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// LE NOMBRE DE PACKS EST ECRIT EN DUR A QUARANTE ENDROITS (7 septembre 2026).
//
// LE CHIFFRE DE L'EN-TETE EST DATE, ET SA POPULATION EST NOMMEE. Il disait
// « trente et un » depuis le 27 aout, sans dire ce qu'il comptait -- et un
// nombre sans sa population en admet plusieurs. Remesure d'aujourd'hui, sur
// les 185 fichiers du perimetre : 35 affirmations en lettres (34 dans les
// .html, 1 dans llms.txt), 4 lignes de specification `rulepacks` en
// chiffres, 1 select de secteur. Quarante. Les enumerations nommees ne sont
// pas comptees ici : elles portent des NOMS, pas le nombre.
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
// Il verifie que ces endroits s'ACCORDENT ENTRE EUX. Il ne code aucun nombre
// en dur, deliberement : le jour ou un douzieme pack arrive, il ne doit pas
// falloir editer ce fichier, il doit falloir editer les pages. Ce test
// echoue sur une mise a jour PARTIELLE -- trois pages corrigees sur seize,
// ou quatre enumerations sur seize.
//
// L'ACCORD MUTUEL NE VOIT QUE CE QU'IL LIT, ET C'EST LA SEULE FACON DONT CE
// TEST PEUT ECHOUER A ETRE FAUX (7 septembre 2026). `llms.txt` annoncait
// dix packs et en listait dix : rien, dans ce fichier, ne s'y contredisait.
// Il n'etait faux que RELATIVEMENT aux onze autres endroits -- et le
// balayage ne le lisait pas. Un garde par accord mutuel n'a pas de defaut
// interne a montrer : son unique surface de defaillance est son perimetre.
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

// LE PERIMETRE INCLUT LES .txt (7 septembre 2026). `llms.txt` est servi a la
// racine du domaine et s'adresse aux modeles de langage : c'est un fichier
// PUBLIE, au meme titre qu'une page. Il annoncait « dix au total » et
// enumerait dix packs quand les onze autres endroits du site en annoncaient
// onze -- `sport` manquant des deux cotes, donc INTERNEMENT COHERENT, donc
// invisible a toute relecture du seul fichier. Seul l'accord avec le reste du
// site pouvait le montrer, et le balayage ne lisait pas les .txt.
//
// LE PERIMETRE INCLUT LES .js, ET CETTE MOITIE EST VIDE DEPUIS LE JOUR DE SON
// ECRITURE (mesure du 7 septembre 2026). Elle avait ete ajoutee le 27 aout
// pour `search.js` et `search-en.js`, qui recopiaient l'extrait de la FAQ.
// Ces deux fichiers ont ete SUPPRIMES quatre heures plus tard le meme jour
// (50980d21, 17h19 ; ce test date de 13h12) et remplaces par
// `search-index-fr.json` / `search-index-en.json`. Mesure d'aujourd'hui :
// 29 fichiers .js dans le perimetre, 34 affirmations dans les .html, 1 dans
// les .txt, ZERO dans les .js.
//
// Les .js restent balayes -- un gabarit JS peut reprendre l'affirmation
// demain, et le cout est nul -- mais l'assertion « au moins un .js dans le
// perimetre » qui gardait cette moitie a ete retiree : 29 fichiers la
// rendaient verte alors que la raison de leur presence etait morte. C'est
// exactement le defaut que l'en-tete de ce fichier decrit, reproduit ici.
//
//   ┌───────────────────────────────────────────────────────────────────┐
//   │ QUATRE HEURES. C'est le delai entre l'ecriture de ce garde et le  │
//   │ moment ou il est devenu vide -- 27 aout, 13h12 puis 17h19, le     │
//   │ meme apres-midi. Il est reste vert ONZE JOURS, jusqu'au           │
//   │ 7 septembre 2026.                                                 │
//   │                                                                   │
//   │ Le plus ancien garde vide trouve cette semaine, et il n'a jamais  │
//   │ eu de periode utile : il n'a pas POURRI, il est ne comme ca. Rien │
//   │ ne pouvait le signaler, parce qu'il assertait une EXTENSION       │
//   │ (« au moins un .js ») quand sa raison d'etre etait deux FICHIERS. │
//   │ 29 autres .js le tenaient vert sur une population qui n'a jamais  │
//   │ ete la sienne.                                                    │
//   │                                                                   │
//   │ La lecon porte au-dela d'ici : apres avoir elargi un perimetre,   │
//   │ asserter ce qui a MOTIVE l'elargissement, pas sa forme. Les deux  │
//   │ se ressemblent le jour de l'ecriture et divergent des que le      │
//   │ porteur bouge. C'est ce que fait, plus bas, l'assertion qui nomme │
//   │ `llms.txt`.                                                       │
//   └───────────────────────────────────────────────────────────────────┘
//
// LES .json SONT DEHORS, ET C'EST MESURE. `search-index-fr.json` porte bien
// l'extrait « onze vocabulaires de reference. Chaque pack », mais il porte
// aussi ses listes de tokens : « neuf ou outillage ouvrage ouvrages ouvrir
// pack » y matche le motif AFFIRMATION et vaudrait 9. Huit occurrences de ce
// genre cote FR, une cote EN. C'est de plus un fichier DERIVE des .html deja
// balayes, dont la fraicheur est gardee par
// `python3 scripts/index-recherche.py --verifier`.
//
// `tests/` est exclu : les fixtures gelees de search-avant-s4 portent
// volontairement d'anciennes valeurs, c'est leur role.
const pages = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) { if (rel !== "tests") parcourir(rel); }
    else if (/\.(html|js|txt)$/.test(e.name)) pages.push(rel);
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
 * Un fichier qui n'est pas du .html est rendu tel quel : il n'a pas de
 * balises a retirer. La condition portait `.js` en dur ; elle porte
 * maintenant sur l'absence de `.html`, sinon `llms.txt` passait par le
 * retrait de balises et son texte traversait `<[^>]+>` sans raison. */
function texte(p) {
  let s = fs.readFileSync(path.join(RACINE, p), "utf8");
  if (!p.endsWith(".html")) return s.replace(/\s+/g, " ");
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
// LA LISTE ETAIT VIDE DE SENS ET LE TEST PASSAIT (30 aout 2026). Elle a
// porte trois exceptions, toutes justes le 27 aout, toutes MORTES trois
// jours plus tard : les pages sectorielles sont passees de sept a onze, et
// « Sept de ces secteurs », « sept vocabulaires de reference » et « seven
// reference vocabularies » ont disparu du site avec ce lot. Les trois
// motifs ne filtraient plus rien -- verifie, 34 affirmations balayees,
// 0 exclue -- et rien ne le disait : une exception qui ne mord plus est
// invisible, elle se contente de ne rien faire.
//
// Une quatrieme affirmation, dans ce meme commentaire, avait pourri de la
// meme facon : « index.html ne contient aucune occurrence de sport ». Elle
// etait vraie le 27 aout ; le menu de navigation du 30 aout y a pose un
// lien vers `solutions/sport.html`.
//
// D'ou les deux assertions de fin, reprises telles quelles de
// `entete-structure.test.js` : une exception qui ne filtre plus rien doit
// sortir, et une exception sans raison lisible sera reconduite sans etre
// relue. Sans elles, cette liste ne se relit jamais -- c'est ce que
// CLAUDE.md appelle une liste d'exceptions devenue une liste de dettes.
const EXCEPTIONS = [];

// DEUX MISES EN PAGE COEXISTENT, ET LE MOTIF N'EN CONNAISSAIT QU'UNE
// (27 aout 2026).
//
// Forme A -- la liste tient dans UNE parenthese ouverte par le premier
// pack. C'est celle de faq.html, pricing.html, search.js :
//
//     « Onze packs de regles sont fournis (outillage, automobile, ...) »
//
// Forme B -- la liste est en prose et CHAQUE nom porte sa propre
// parenthese de details. C'est celle de docs.html et en/docs.html :
//
//     « outillage (visserie, normes DIN/ISO), automobile (references
//       OEM Bosch/MANN/Valeo), electricite (calibres, courbes), ... »
//
// L'ancien motif exigeait la forme A. Sur docs.html il ne matchait RIEN,
// donc l'assertion « chaque enumeration compte autant de noms que le
// chiffre annonce » ne s'y appliquait jamais. Les deux pages annoncaient
// onze packs et en listaient DIX -- `sport` manquant -- et le garde etait
// vert.
//
// C'est le meme defaut de forme que l'adjacence de AFFIRMATION : le motif
// decrivait une mise en page particuliere plutot que la chose cherchee.
// ---------------------------------------------------------------------
// CE QUE CE GARDE RECONNAIT, EN UNE LECTURE.
//
// Si vous ajoutez une page qui enumere les packs, ECRIVEZ-LA DANS L'UNE DE
// CES TROIS FORMES. Une quatrieme forme ne sera pas signalee comme non
// couverte : elle sera simplement INVISIBLE, et votre page pourra annoncer
// onze packs en en listant dix sans qu'aucun test ne tombe.
//
//   ┌───────────────────────────────────────────────────────────────────┐
//   │ CET AVERTISSEMENT S'EST REALISE LE 7 SEPTEMBRE 2026, ONZE JOURS   │
//   │ APRES AVOIR ETE ECRIT. Il disait « DEUX FORMES » et annoncait     │
//   │ qu'une troisieme serait invisible. `llms.txt` en etait une, et    │
//   │ elle est restee invisible exactement comme decrit.                │
//   │                                                                   │
//   │ RIEN NE L'A DECLENCHE. Aucun test n'est tombe, aucune alerte n'a  │
//   │ pointe ici : la phrase a ete relue par hasard, en cherchant une   │
//   │ autre cause. Un avertissement qui se verifie sans que rien ne     │
//   │ l'ait declenche vaut d'etre DATE quand il se realise -- sinon il  │
//   │ se relit comme une precaution de style, alors qu'il a le rang     │
//   │ d'une prediction verifiee.                                        │
//   │                                                                   │
//   │ La ligne au-dessus dit maintenant « TROIS ». Elle se realisera de │
//   │ nouveau. Datez-la ici plutot que de la reecrire.                  │
//   └───────────────────────────────────────────────────────────────────┘
//
// C'est le defaut qui a ete corrige DEUX FOIS le 27 aout -- d'abord sur
// AFFIRMATION qui exigeait le nombre colle au mot, puis ici -- et une
// TROISIEME le 7 septembre. Un motif qui decrit une mise en page plutot que
// la chose cherchee rate en silence.
//
// ┌─ FORME A ─ la liste tient dans UNE parenthese, ouverte par le premier
// │            pack. Le reste de la phrase continue apres la fermante.
// │
// │   « Onze packs de regles sont fournis (outillage, automobile,
// │     electricite, plomberie, industrie, electronique, mode, vins,
// │     livres, finance, sport) et la mecanique s'applique a tout... »
// │
// │   faq.html · pricing.html · console.html · search.js  (+ leurs
// │   equivalents anglais, et les copies JSON-LD de faq et pricing)
// └─
//
// ┌─ FORME B ─ la liste est en PROSE et chaque nom porte SA PROPRE
// │            parenthese de details. Elle court jusqu'au point final.
// │
// │   « Onze packs standards sont fournis : outillage (visserie, normes
// │     DIN/ISO, matieres), automobile (references OEM Bosch/MANN/Valeo),
// │     electricite (calibres, courbes), ... et sport (volumes en litres,
// │     tailles normalisees, plans de cordage). »
// │
// │   docs.html · fonctionnalites.html  (+ leurs equivalents anglais)
// └─
//
// ┌─ FORME C ─ la liste est NUE derriere un deux-points, sans parenthese
// │            d'ouverture, et le total est entre parentheses A LA FIN.
// │            (7 septembre 2026)
// │
// │   « Packs de regles fournis : outillage, mode, industrie, livres,
// │     electronique, vins, automobile, electricite, plomberie, finance,
// │     sport (onze au total). »
// │
// │   llms.txt
// └─
//
// LA TROISIEME FORME EST ARRIVEE EXACTEMENT COMME ANNONCE. Le bloc
// ci-dessus disait, le 27 aout : « une troisieme forme ne sera pas signalee
// comme non couverte, elle sera simplement INVISIBLE ». `llms.txt` en etait
// une, et sa ligne annoncait dix packs en en listant dix -- le comptage
// n'aurait rien trouve meme si le fichier avait ete dans le perimetre. Ce
// sont bien DEUX defauts superposes : le perimetre, et la forme. Corriger
// le premier seul laissait le second, avec un symptome moindre : au
// douzieme pack, un « douze » pose dans llms.txt sans douzieme nom aurait
// passe l'accord des chiffres et echappe au comptage des noms.
//
// LA SEPARATION N'EST PAS DEDUITE, ELLE EST CONSTRUITE. Un seul cas -- celui
// d'aujourd'hui -- devient rouge des l'elargissement du perimetre, et aurait
// laisse conclure que la forme C etait du zele. Les deux etats ont donc ete
// FABRIQUES et le garde relance sur chacun :
//
//     etat de llms.txt                     perimetre   perimetre
//                                            seul      + forme C
//     « dix » + 10 noms   (aujourd'hui)      rouge       rouge
//     « onze » + 10 noms  (12e pack,
//                          maj partielle)    VERT        rouge
//
// La deuxieme ligne est la seule qui departage, et elle n'existe nulle part
// dans le depot : il fallait l'ecrire. Conclure du seul cas observable
// aurait rendu un verdict juste sur la moitie du defaut.
//
// LE COMPTE A ETE MESURE, PAS ESTIME -- une premiere version de ce bloc
// annoncait trois formes en comptant fonctionnalites.html comme une
// troisieme par inattention : elle a exactement la forme de docs.html.
// Remesure du 7 septembre, motif par motif, sur le perimetre elargi :
//
//                              forme A   forme B   forme C
//     faq · pricing · console     oui       -         -
//     docs · fonctionnalites       -       oui        -
//     llms.txt                     -        -        oui
//
// LA PARTITION EST NETTE : aucun fichier n'est attrape par deux motifs,
// aucun des ONZE porteurs n'echappe aux trois. QUINZE enumerations relevees
// (faq, pricing et leurs equivalents anglais en rendent deux chacun : le
// texte visible et sa copie JSON-LD).
//
// CE COMPTE A ETE FAUX DANS CE BLOC MEME, LE JOUR DE SON ECRITURE. J'y ai
// ecrit « treize porteurs, 16 enumerations » -- estime en ajoutant 1 a un
// releve precedent au lieu de recompter apres l'elargissement. Le vrai
// releve dit 11 et 15. Le paragraphe qui commence par « LE COMPTE A ETE
// MESURE, PAS ESTIME » portait donc une estimation, deux lignes plus bas,
// pour la deuxieme fois de son histoire. Recompte le 7 septembre 2026, par
// la commande qui suit, sur l'arbre rebase :
//
//     node -e '<balayage des trois motifs>' | sort | uniq -c
//
// Si vous ajoutez une forme, remesurez ce tableau plutot que de l'estimer.
//
// La ligne `search.js · search-en.js` de ce tableau a disparu : ces deux
// fichiers n'existent plus depuis le 27 aout au soir (voir le perimetre).
//
// LE DEUX-POINTS EST EXIGE, ET IL PORTE LE MOTIF. Sans lui, la forme C
// matcherait AUSSI la liste des formes A et B -- « (outillage, automobile,
// ... » commence par « outillage, » -- et courrait jusqu'au premier point,
// bien au-dela de la parenthese fermante, rendant un faux comptage sur des
// pages deja couvertes. Il est consomme par un lookbehind pour qu'il
// n'entre pas dans le premier nom : capture, `identite()` rendait
// « : outillage », et la comparaison des listes francaises echouait sur une
// ponctuation.
//
// Une assertion plus bas verifie que CHAQUE forme trouve encore quelque
// chose -- si l'une cessait de matcher, le garde deviendrait vert sur une
// part du site sans rien dire.
// ---------------------------------------------------------------------
const ENUM_PARENTHESE = /\((outillage|hardware)[^)]{40,}\)/gi;
const ENUM_EN_PROSE = /\b(outillage|hardware)\b\s*\([^)]*\)[^.]{40,}?\./gi;
const ENUM_NUE = /(?<=[:：]\s*)(outillage|hardware),\s[^.]{40,}?\./gi;

/** Extrait les noms d'une enumeration, quelle que soit sa forme.
 *
 * Les parentheses INTERNES sont retirees d'abord : sans cela, les details
 * de la forme B -- « outillage (visserie, normes DIN/ISO, matieres) » --
 * se feraient decouper en trois faux noms par le split sur les virgules. */
function nomsDeLEnumeration(brut) {
  const sansDetails = brut
    .replace(/^\(|\)$/g, "")          // parentheses englobantes de la forme A
    .replace(/\([^)]*\)/g, "")        // parentheses de details de la forme B
    .replace(/\.$/, "");
  return sansDetails
    .split(/,| et | and /)
    .map((x) => x.trim())
    .filter(Boolean);
}

const affirmations = [];
const enumerations = [];
// Les affirmations AVANT filtrage. C'est le seul etat depuis lequel on peut
// dire si une exception filtre encore quelque chose : apres filtrage, une
// exception morte et une exception qui a fait son travail se ressemblent.
const affirmationsBrutes = [];
for (const p of pages) {
  const t = texte(p);
  for (const m of t.matchAll(AFFIRMATION)) {
    affirmationsBrutes.push({ page: p, texte: m[0] });
    const exception = EXCEPTIONS.find((e) => e.motif.test(m[0]));
    if (exception) continue;
    affirmations.push({ page: p, mot: m[1].toLowerCase(), valeur: NOMBRES[m[1].toLowerCase()] });
  }
  for (const [forme, motif] of [["A", ENUM_PARENTHESE], ["B", ENUM_EN_PROSE], ["C", ENUM_NUE]]) {
    for (const m of t.matchAll(motif)) {
      const noms = nomsDeLEnumeration(m[0]);
      if (noms.length >= 5) enumerations.push({ page: p, noms, forme });
    }
  }
}

describe("packs — les affirmations du site s'accordent", () => {
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
  //
  // LA BRANCHE `-en.js` A ETE RETIREE (7 septembre 2026). Elle ne visait que
  // `search-en.js`, supprime le 27 aout au soir, quatre heures apres son
  // ecriture. Verifie : aucun fichier du perimetre ne matche `-en\.js$`, et
  // aucun .js ne produit d'affirmation ni d'enumeration. Une condition qui
  // ne departage plus rien se relit comme un partage vivant.
  //
  // `llms.txt` est bilingue mais son enumeration de packs est en francais :
  // il tombe du bon cote par le seul `en/`.
  const estAnglais = (p) => p.startsWith("en/");

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
  //
  // UN PLANCHER GLOBAL NE PEUT PAS GARDER UN ELARGISSEMENT D'UN SEUL ITEM
  // (7 septembre 2026). Les .txt apportent UNE affirmation et UNE
  // enumeration ; retirer `.txt` du perimetre ferait passer 35 a 34 et 15 a
  // 14, sous n'importe quel plancher qu'on accepterait d'ecrire. La
  // couverture de llms.txt est donc assertee par son nom, juste en dessous.
  //
  // L'ASSERTION « au moins un .js » A ETE RETIREE. Elle gardait la moitie
  // .js du perimetre et etait verte par construction : 29 fichiers .js
  // existent, aucun ne porte d'affirmation depuis la suppression de
  // search.js le 27 aout au soir. Un garde vert sur une population qui
  // n'est plus celle qu'il visait.
  it("le balayage a reellement trouve les affirmations", () => {
    expect(affirmations.length).toBeGreaterThanOrEqual(33);
    expect(enumerations.length).toBeGreaterThanOrEqual(13);
    expect(pages.some((p) => /<script[^>]*application\/ld\+json/.test(brut(p))),
      "aucun JSON-LD lu : les copies de balisage echappent au garde").toBe(true);
  });

  // llms.txt EST SERVI A LA RACINE DU DOMAINE ET S'ADRESSE AUX MODELES.
  // C'est le seul porteur .txt, et le seul porteur de la forme C : les deux
  // planchers globaux ci-dessus le perdraient sans bouger d'un cran. Il est
  // donc nomme -- exception a la regle « viser une forme, pas un fichier »,
  // assumee parce que la population vaut un.
  it("llms.txt est lu, et son affirmation comme son enumeration sont vues", () => {
    expect(pages, "llms.txt hors perimetre").toContain("llms.txt");
    expect(affirmations.filter((a) => a.page === "llms.txt").length,
      "llms.txt ne rend aucune affirmation chiffree : le motif ou le perimetre a casse")
      .toBeGreaterThan(0);
    expect(enumerations.filter((e) => e.page === "llms.txt").length,
      "llms.txt ne rend aucune enumeration : sa liste de packs n'est plus comptee")
      .toBeGreaterThan(0);
  });

  // Si une forme cessait de matcher -- une page reecrite, un motif casse par
  // une refonte de balisage -- le garde deviendrait vert sur la moitie du
  // site sans rien dire. C'est exactement ce qui s'est passe pour la forme B
  // avant le 27 aout : elle n'existait pas, et docs.html annoncait onze
  // packs en en listant dix, sans aucun test rouge.
  it("les trois formes d'enumeration trouvent encore chacune quelque chose", () => {
    const parForme = { A: [], B: [], C: [] };
    for (const e of enumerations) parForme[e.forme].push(e.page);
    expect(parForme.A, "forme A (liste entre parentheses) ne matche plus rien").not.toEqual([]);
    expect(parForme.B, "forme B (liste en prose, parentheses par nom) ne matche plus rien").not.toEqual([]);
    expect(parForme.C, "forme C (liste nue apres deux-points) ne matche plus rien").not.toEqual([]);
  });

  // ---------------------------------------------------------------------
  // LA LISTE D'EXCEPTIONS SE POLICE ELLE-MEME.
  //
  // Reprises telles quelles de `entete-structure.test.js`, qui les porte
  // depuis le 26 aout et dont les deux ont mordu le jour de leur ecriture.
  // Elles manquaient ici, et la difference s'est vue : trois exceptions
  // mortes ont survecu a la disparition de ce qu'elles excluaient, dans un
  // fichier vert a 9/9.
  //
  // La premiere est la plus importante. Une exception qui ne filtre plus
  // rien ne fait echouer aucun test -- elle se contente d'exister, et la
  // seule facon de la trouver est de venir la chercher.
  // ---------------------------------------------------------------------
  it("aucune exception n'est perimee : chacune filtre encore quelque chose", () => {
    const mortes = EXCEPTIONS
      .filter((e) => !affirmationsBrutes.some((a) => e.motif.test(a.texte)))
      .map((e) => String(e.motif));
    expect(
      mortes,
      "Ces exceptions ne filtrent plus aucune affirmation du site. Retire-les :\n" +
        "une exception qu'on ne nettoie pas finit par couvrir un vrai defaut,\n" +
        `et rien d'autre ne la signalera. ${affirmationsBrutes.length} affirmations balayees.`
    ).toEqual([]);
  });

  it("chaque exception porte une raison lisible", () => {
    const muettes = EXCEPTIONS
      .filter((e) => !e.raison || e.raison.trim().length < 20 || /^\s*idem\b/i.test(e.raison))
      .map((e) => String(e.motif));
    expect(
      muettes,
      "Exception sans raison, ou dont la raison est un renvoi : elle sera\n" +
        "reconduite sans etre relue. Un renvoi (« idem l'autre ») n'est pas une\n" +
        "raison -- il faut relire deux entrees pour en juger une."
    ).toEqual([]);
  });
});
