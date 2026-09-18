import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// TOUT LITTERAL PASSE A T() A UNE CLEF DANS DICT (18 septembre 2026).
//
// T() rend le gabarit francais quand DICT n'a pas d'entree : la console
// anglaise affiche alors du francais, sans erreur. Jusqu'ici rien ne le
// verifiait en general, seulement des listes ecrites a la main, lot par lot.
// Le 18 septembre, onze gabarits passaient a T() sans clef, dont le bouton
// d'inscription (« Créer mon compte et obtenir ma clé »), renomme le 3 aout
// cote console.js et pas cote dictionnaire.
//
// CE QUE CE GARDE VOIT : les litteraux ecrits DIRECTEMENT entre les
// parentheses de T(), y compris les deux branches d'un ternaire.
//
// CE QU'IL NE VOIT PAS :
//   - un gabarit passe par une variable, T(x) ;
//   - un texte ecrit en dur HORS de T() (« Publier sur » + nom, jusqu'au
//     18 septembre). Le chemin 1 de console-i18n.js ne le rattrape que s'il
//     forme un noeud texte entier egal a une clef. Aucun critere mecanique
//     ne separe un tel texte d'une classe CSS ou d'un chemin d'API ; ce
//     balayage-la se fait a la relecture ;
//   - les textes d'en/console.html, ecrit a la main en anglais.
// ---------------------------------------------------------------------------

const RACINE = path.resolve(__dirname, "..");
const CONSOLE = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
const I18N = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");

function chargerDict() {
  const ancre = "window.T = T;";
  expect(I18N.includes(ancre), "ancre window.T absente de console-i18n.js").toBe(true);
  const dom = new JSDOM(`<!doctype html><html lang="en"><body></body></html>`,
    { url: "http://localhost/en/console.html", runScripts: "outside-only" });
  dom.window.eval(I18N.replace(ancre, ancre + " window.__DICT = DICT;"));
  return dom.window.__DICT;
}

// Decoupe minimale en jetons : chaines, commentaires, expressions regulieres,
// identifiants, ponctuation. Suffisant pour console.js, qui n'a pas de
// gabarit a backticks dans son code.
function jetons(src) {
  const out = [];
  let i = 0, ligne = 1, prec = null;
  const regexPossible = () => !prec ||
    (prec.t === "p" && /^[(,=:[!&|?{};+\-*%<>~^]$/.test(prec.v)) ||
    (prec.t === "id" && /^(return|typeof|case|in|of|delete|void|throw|new)$/.test(prec.v));
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { ligne++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      const f = src.indexOf("*/", i + 2);
      ligne += (src.slice(i, f).match(/\n/g) || []).length;
      i = f + 2; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const l0 = ligne; let j = i + 1;
      while (src[j] !== c) { if (src[j] === "\\") j++; else if (src[j] === "\n") ligne++; j++; }
      // eval d'un litteral isole : restitue les echappements (é, \")
      // comme le moteur JavaScript les lira.
      prec = { t: "s", v: (0, eval)(src.slice(i, j + 1)), ligne: l0 };
      out.push(prec); i = j + 1; continue;
    }
    if (c === "/" && regexPossible()) {
      let j = i + 1, classe = false;
      while (!(src[j] === "/" && !classe)) {
        if (src[j] === "\\") j++;
        else if (src[j] === "[") classe = true;
        else if (src[j] === "]") classe = false;
        j++;
      }
      j++; while (/[a-z]/.test(src[j])) j++;
      prec = { t: "re", v: src.slice(i, j), ligne }; out.push(prec); i = j; continue;
    }
    const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 80));
    if (m) { prec = { t: "id", v: m[0], ligne }; out.push(prec); i += m[0].length; continue; }
    prec = { t: "p", v: c, ligne }; out.push(prec); i++;
  }
  return out;
}

// Les litteraux places directement entre les parentheses de T(), hors
// operandes d'une comparaison (T(o.action === "pin" ? ... : ...)).
function gabaritsDeT(src) {
  const tk = jetons(src);
  const pile = [], trouves = [];
  for (let k = 0; k < tk.length; k++) {
    const t = tk[k];
    if (t.t === "p" && t.v === "(") {
      const a = tk[k - 1], b = tk[k - 2];
      pile.push(a && a.t === "id" && a.v === "T" && !(b && b.t === "p" && b.v === "."));
      continue;
    }
    if (t.t === "p" && t.v === ")") { pile.pop(); continue; }
    if (t.t !== "s" || !pile[pile.length - 1]) continue;
    const avant = tk[k - 1], apres = tk[k + 1];
    if ((avant && avant.v === "=") || (apres && (apres.v === "=" || apres.v === "!"))) continue;
    if (!/\p{L}{2}/u.test(t.v)) continue; // « {0} », « · » : rien a traduire
    trouves.push(t);
  }
  return trouves;
}

describe("console-i18n.js — chaque gabarit de console.js a sa clef", () => {
  const DICT = chargerDict();
  const aClef = (s) => Object.prototype.hasOwnProperty.call(DICT, s);

  it("l'extracteur voit un gabarit sans clef, et ignore une comparaison", () => {
    const temoin = 'x.textContent = T(n > 1 ? "témoin sans clef {0}" : "Annuler", n);\n' +
      'y = T(o.action === "pin" ? "Épingler" : "Reléguer");';
    const vus = gabaritsDeT(temoin).map((t) => t.v);
    expect(vus).toEqual(["témoin sans clef {0}", "Annuler", "Épingler", "Reléguer"]);
    expect(vus.filter((v) => !aClef(v))).toEqual(["témoin sans clef {0}"]);
  });

  it("l'extracteur lit tout console.js, pas un fragment", () => {
    // 486 le 18 septembre 2026. Un decoupage qui deraille (regex mal lue,
    // chaine non fermee) s'arrete tot ou avale le fichier : le compte chute.
    expect(gabaritsDeT(CONSOLE).length).toBeGreaterThan(400);
  });

  it("aucun gabarit passe a T() n'est absent de DICT", () => {
    const sansClef = gabaritsDeT(CONSOLE)
      .filter((t) => !aClef(t.v))
      .map((t) => "console.js:" + t.ligne + "  " + JSON.stringify(t.v));
    expect(sansClef, "l'anglais afficherait ces gabarits en francais").toEqual([]);
  });
});
