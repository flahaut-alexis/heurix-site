import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const CONSOLE = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");

/* UN `.catch` D'ECRITURE QUI N'AFFICHE RIEN (4 septembre 2026).
 *
 * LE DEFAUT. Le marchand clique, le moteur refuse avec une raison, et
 * l'interface lui rend un bouton cliquable. Il ne peut pas distinguer
 * « refuse » de « pas encore clique ». Onze chemins d'ecriture de
 * console.js faisaient cela ; six d'entre eux avaient ete trouves par
 * hasard en cherchant des traductions manquantes, ce qui est exactement
 * la raison d'ecrire ce garde : sans lui, le douzieme se trouvera aussi
 * par hasard, ou pas du tout.
 *
 * CE QUE CE GARDE DERIVE, ET CE QU'IL NE PEUT PAS DERIVER.
 *
 * Il extrait chaque chaine de promesses de console.js et decide si elle
 * ECRIT, sur deux criteres mecaniques :
 *   - son texte contient `method: "POST" | "PUT" | "DELETE"` ;
 *   - ou sa tete est un auxiliaire d'ecriture NOMME ci-dessous.
 *
 * Le second critere est le rappel de sa propre limite. « Cette fonction
 * ecrit-elle ? » n'est pas decidable depuis le site d'appel : `saveGroups`
 * fait un PUT que rien n'annonce chez celui qui l'appelle. Il faut donc
 * la nommer, et un futur auxiliaire d'ecriture non nomme echappera au
 * garde. C'est la frontiere, elle est ici, elle est ecrite.
 *
 * MESURE AVANT/APRES, prediction ecrite avant de lancer :
 *                                     origine (133508e7)   corrige
 *   chaines d'ecriture muettes                    10          0
 *   `fetch` bruts sans controle de r.ok            1          0
 *
 * Le premier jet de ce garde passait sur console.js D'ORIGINE : trois
 * defauts d'instrument, tous trouves par le controle de population et
 * aucun par les assertions elles-memes. `tete` etait ecrase par un
 * `...spread`, donc `saveGroups` et le controle de `r.ok` ne comparaient
 * plus rien ; une ecriture imbriquee remontait a la chaine englobante
 * meme quand elle portait son propre `.catch` ; et un POST vers `/search`
 * comptait pour une ecriture. D'ou le premier `it()` : sans population
 * verifiee, un garde qui ne mesure rien rend le meme vert qu'un garde qui
 * ne trouve rien.
 * Le onzieme chemin corrige par ce lot -- la suppression d'une selection
 * de surcharges -- n'apparait dans aucun des deux comptes : voir
 * NON_DERIVABLES.
 */

// Auxiliaires qui ECRIVENT sans que leur site d'appel le dise.
const AUXILIAIRES_ECRITURE = ["saveGroups"];

// Ce que le garde ne voit pas, et pourquoi. Une chaine de tete
// `Promise.all(appels)` ne porte aucun `method:` : les DELETE sont dans
// le tableau `appels`, construit plus haut par un `.map()`. Suivre cela
// demanderait de resoudre une variable, c'est-a-dire d'interpreter le
// fichier plutot que de le lire. Corrige a la main dans ce meme lot,
// consigne ici pour que le prochain lecteur sache que le compte du garde
// n'est pas le compte du fichier.
const NON_DERIVABLES = [
  "Promise.all(appels) — suppression d'une selection de surcharges Search",
];

/** Decoupe une chaine de promesses en sa TETE et ses maillons de PREMIER
 * niveau. Le niveau compte : un `.catch` interne a un `.then` ne parle pas
 * pour la chaine qui l'englobe, et le confondre avec elle ferait passer un
 * silence pour un message. */
function decouper(src, debut) {
  let i = debut;
  let prof = 0;
  let chaine = null;
  let echap = false;
  let ouvert = false;
  let teteFin = -1;
  let maillons = [];
  let courant = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (chaine) {
      if (echap) { echap = false; continue; }
      if (c === "\\") { echap = true; continue; }
      if (c === chaine) chaine = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { chaine = c; continue; }
    if (c === "(" || c === "[" || c === "{") { prof++; ouvert = true; continue; }
    if (c === ")" || c === "]" || c === "}") {
      prof--;
      if (prof === 0 && ouvert) {
        if (teteFin === -1) teteFin = i;
        else maillons.push({ nom: courant, texte: src.slice(courant_i, i + 1) });
        const suite = /^\s*\.\s*(then|catch|finally)\s*\(/.exec(src.slice(i + 1));
        if (!suite) return { texte: src.slice(debut, i + 1), fin: i, tete: src.slice(debut, teteFin + 1), maillons };
        courant = suite[1];
        var courant_i = i + 1 + suite[0].length;
        i += suite[0].length;
        prof = 1;
      }
      continue;
    }
  }
  return { texte: src.slice(debut), fin: src.length, tete: src.slice(debut, teteFin + 1), maillons };
}

function ligneDe(src, i) {
  return src.slice(0, i).split("\n").length;
}

/** Toutes les chaines de promesses dont la tete est un appel reseau.
 *  Les chaines IMBRIQUEES sont retenues aussi : une ecriture posee dans un
 *  `.then` est une ecriture, et c'est precisement la forme de
 *  brAppliquerBrouillon, le plus couteux des onze chemins de ce lot. */
function chainesReseau(src) {
  const out = [];
  const re = new RegExp(
    "\\b(apiFetch|apiPost|fetch|" + AUXILIAIRES_ECRITURE.join("|") + ")\\s*\\(",
    "g"
  );
  let m;
  while ((m = re.exec(src))) {
    // Une DEFINITION (`function apiFetch(`) ou un acces membre (`.fetch(`)
    // n'est pas un appel. Un `return apiFetch(...)` en est un.
    const avant = src.slice(0, m.index);
    if (/(\.|\bfunction)\s*$/.test(avant)) continue;
    const d = decouper(src, m.index);
    out.push({ nom: m[1], debut: m.index, ligne: ligneDe(src, m.index), ...d });
    // lastIndex n'avance PAS jusqu'a la fin de la chaine : les appels
    // imbriques doivent etre vus comme des chaines a part entiere.
  }
  return out;
}

const VERBE = /method\s*:\s*"(POST|PUT|DELETE|PATCH)"/;

// UN POST N'EST PAS TOUJOURS UNE ECRITURE. `/search` et `/simulate`
// prennent un POST parce que leur corps est trop gros pour une URL, pas
// parce qu'ils changent quoi que ce soit : ce sont des LECTURES, et leur
// silence releve des vingt et une lectures que ce lot laisse muettes.
// La convention est dans les chemins, on la nomme ici plutot que de la
// deviner ligne a ligne.
const LECTURE_EN_POST = /\/(search|simulate)"/;

// La deconnexion : envoi sans retour. La session est detruite localement
// quoi qu'il arrive, et le corps de la reponse n'est jamais lu.
const SANS_RETOUR = /\/v1\/auth\/logout/;

function ecritDirectement(c) {
  return VERBE.test(c.tete) && !LECTURE_EN_POST.test(c.tete);
}

/** Une ecriture posee dans un `.then` et qui n'attrape PAS ses propres
 *  erreurs remonte a la chaine qui l'englobe : c'est cette chaine-la qui
 *  doit parler. C'est la forme de brAppliquerBrouillon (des DELETE puis
 *  des POST dans les maillons), et c'est ce qui la distingue de loadRules,
 *  dont le DELETE imbrique porte son propre `.catch` et repond de lui-meme. */
function ecritParDelegation(c, toutes) {
  const fin = c.debut + c.texte.length;
  return toutes.some(
    (d) =>
      d.debut > c.debut &&
      d.debut < fin &&
      ecritDirectement(d) &&
      !attrape(d)
  );
}

function ecrit(c, toutes) {
  if (SANS_RETOUR.test(c.tete)) return false;
  if (AUXILIAIRES_ECRITURE.includes(c.nom)) return true;
  return ecritDirectement(c) || ecritParDelegation(c, toutes);
}

/** Un `.catch` de PREMIER NIVEAU dit-il quelque chose a l'utilisateur ? */
function parle(c) {
  return c.maillons.some(
    (m) =>
      m.nom === "catch" &&
      (/signalerEchec\s*\(/.test(m.texte) ||
        /\.textContent\s*=\s*\(?\s*(err|e)\b/.test(m.texte) ||
        /window\.alert\s*\(/.test(m.texte) ||
        /showLogin\s*\(/.test(m.texte))
  );
}

/** La chaine attrape-t-elle ses erreurs a son PROPRE niveau ? Une chaine
 *  sans `.catch` propage a son appelant : ce n'est pas un silence, c'est
 *  une delegation, et c'est l'appelant qui sera mesure. */
function attrape(c) {
  return c.maillons.some((m) => m.nom === "catch");
}

describe("console.js — aucune ecriture ne echoue en silence", () => {
  const chaines = chainesReseau(CONSOLE);

  it("le garde a bien une population a mesurer", () => {
    // Sans ce controle, une chaine cassee ferait passer le test avec zero
    // chaine examinee -- un refus silencieux se lit comme une reponse.
    expect(chaines.length).toBeGreaterThan(40);
    expect(chaines.filter((c) => ecrit(c, chaines)).length).toBeGreaterThan(10);
    expect(chaines.filter((c) => c.nom === "fetch").length).toBeGreaterThan(2);
  });

  it("chaque chaine qui ECRIT affiche la raison de son echec", () => {
    const fautives = chaines
      .filter((c) => ecrit(c, chaines))
      .filter((c) => attrape(c))
      .filter((c) => !parle(c))
      .map((c) => `console.js:${c.ligne} (${c.nom})`);

    expect(
      fautives,
      "Un `.catch` d'ECRITURE sans message : le marchand a demande un\n" +
        "changement d'etat, le serveur l'a refuse avec une raison, et\n" +
        "l'interface ne lui rend qu'un bouton cliquable.\n" +
        "Posez le detail de l'API avec signalerEchec(element, err, repli).\n" +
        "Chemins concernes :\n  " + fautives.join("\n  ")
    ).toEqual([]);
  });

  it("tout `fetch` brut controle r.ok avant de lire le corps", () => {
    // L'invitation resolvait sur un 400 : `{detail}` etait lu comme une
    // reponse valide, `data.email` valait undefined, et l'ecran affichait
    // « Invitation pour . ». Son `.catch`, qui testait `err.status`, etait
    // mort. C'est un defaut d'une autre nature que les onze ci-dessus.
    const bruts = chainesReseau(CONSOLE).filter((c) => c.nom === "fetch");
    const sansControle = bruts
      .filter((c) => !/\br\.ok\b/.test(c.texte))
      // Deconnexion : envoi sans retour, la session est detruite localement
      // quoi qu'il arrive. Le corps de la reponse n'est jamais lu.
      .filter((c) => !SANS_RETOUR.test(c.tete))
      .map((c) => `console.js:${c.ligne}`);

    expect(
      sansControle,
      "Un `fetch` qui lit r.json() sans controler r.ok RESOUT sur une\n" +
        "reponse d'erreur : le corps `{detail}` est pris pour des donnees,\n" +
        "et le `.catch` en dessous ne recoit jamais rien.\n  " + sansControle.join("\n  ")
    ).toEqual([]);
  });

  it("consigne ce qu'il ne peut pas deriver", () => {
    expect(NON_DERIVABLES.length).toBe(1);
  });
});
