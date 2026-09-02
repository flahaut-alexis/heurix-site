import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const CONSOLE = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
const I18N = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");
const HTML_FR = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
const HTML_EN = fs.readFileSync(path.join(RACINE, "en/console.html"), "utf8");

/* RAYON GEOGRAPHIQUE DANS L'ECRAN DE TEST DE RECHERCHE (2 septembre 2026).
 *
 * L'API sert `lat` / `lon` / `radius_km` depuis ce matin, la documentation
 * les decrit depuis ce soir, la console les ignorait -- zero occurrence des
 * trois noms dans console.js avant ce chantier.
 *
 * CE QUE CE FICHIER GARDE, ET POURQUOI CHAQUE POINT EST LA :
 *
 *   1. L'INTERRUPTEUR EST ETEINT. Un marchand qui ne vend pas de services
 *      locaux ne doit rien voir de different -- et « rien de different »
 *      veut dire un corps de requete identique, pas seulement un ecran qui
 *      se ressemble.
 *
 *   2. LES TROIS ENSEMBLE OU AUCUN. Le moteur repond 422 sur un rayon
 *      partiel (heurix-engine, models.py `_exiger_rayon_complet`). Ce n'est
 *      pas une preference d'interface : c'est un refus, et l'interface ne
 *      doit pas pouvoir le declencher.
 *
 *   3. ZERO EST UNE VALEUR. `Number("")` vaut 0, et 0 est une latitude
 *      valide (au large du Ghana). Un champ laisse vide qui passerait par
 *      une conversion naive partirait donc comme une position reelle, sans
 *      qu'aucun message ne le dise. Meme piege sur `distance_km` : un
 *      produit pose exactement sur le point demande rend 0 km, que
 *      `h.distance_km || ""` traiterait comme une absence.
 *
 * ON EXTRAIT LE CODE REELLEMENT EXPEDIE ET ON LE FAIT TOURNER, plutot que
 * d'assertionner sur son texte -- meme raison que
 * console-pipeline-echappement.test.js : une assertion textuelle prouve
 * qu'un caractere est present, pas qu'une regle est appliquee.
 *
 * CE QU'IL NE PEUT PAS GARDER : les bornes elles-memes. Elles sont
 * recopiees de heurix-engine (models.py, SearchBody), hors de ce depot. Si
 * le moteur releve son plafond de 200 km, ce fichier restera vert et la
 * console refusera une valeur devenue legale.
 */

function extraire(src, debut, fin, quoi) {
  const i = src.indexOf(debut);
  expect(i, `bloc introuvable (${quoi}) — la source a change de forme`).toBeGreaterThan(-1);
  const j = src.indexOf(fin, i);
  expect(j, `fin de bloc introuvable (${quoi})`).toBeGreaterThan(i);
  return src.slice(i, j + fin.length);
}

/** Un vrai DOM de console.html, sans executer console.js : c'est le BALISAGE
 *  livre qu'on veut sous les fonctions, pas une maquette ecrite ici. */
function domConsole() {
  const dom = new JSDOM(HTML_FR, { runScripts: "outside-only", url: "http://localhost/console.html" });
  const w = dom.window;
  w.eval(`
    ${extraire(I18N, "function T(gabarit) {", "\n  }", "T() de console-i18n.js")}
    var DICT = {}, EN = false;
    ${extraire(CONSOLE, "var RAYON_MAX_KM = 200;", ";", "RAYON_MAX_KM")}
    ${extraire(CONSOLE, "function soLireRayon() {", "\n  }", "soLireRayon()")}
    ${extraire(CONSOLE, "function soRafraichirAvertRayon(data) {", "\n  }", "soRafraichirAvertRayon()")}
  `);
  return w;
}

function poser(w, { coche, lat, lon, km }) {
  w.document.getElementById("so-rayon").checked = !!coche;
  w.document.getElementById("so-rayon-lat").value = lat === undefined ? "" : String(lat);
  w.document.getElementById("so-rayon-lon").value = lon === undefined ? "" : String(lon);
  w.document.getElementById("so-rayon-km").value = km === undefined ? "" : String(km);
  return w.eval("soLireRayon()");
}

describe("rayon — l'interrupteur est eteint, et eteint ne veut rien dire", () => {
  for (const [nom, html] of [["console.html", HTML_FR], ["en/console.html", HTML_EN]]) {
    it(`${nom} : la case n'est pas cochee et le sous-bloc est masque`, () => {
      const doc = new JSDOM(html).window.document;
      const case_ = doc.getElementById("so-rayon");
      expect(case_, "la case « filtrer par rayon » a disparu").not.toBeNull();
      expect(case_.hasAttribute("checked"), "la case est cochee par defaut").toBe(false);
      expect(doc.getElementById("so-rayon-bloc").hasAttribute("hidden")).toBe(true);
      expect(doc.getElementById("so-rayon-warn").hasAttribute("hidden")).toBe(true);
    });
  }

  it("case decochee : aucune valeur, meme avec les trois champs remplis", () => {
    const w = domConsole();
    const r = poser(w, { coche: false, lat: 44.84, lon: -0.58, km: 25 });
    expect(r.actif).toBe(false);
    expect(r.valeurs).toBeUndefined();
  });

  it("les trois clefs sont ABSENTES du corps, jamais posees a null", () => {
    // Le corps se construit par affectations successives : une clef non
    // affectee n'existe pas. Le moteur distingue « absent » de « null » --
    // `radius_km: null` traverserait la validation Pydantic autrement.
    const bloc = extraire(CONSOLE, "if (rayon.valeurs) {", "\n    }", "ajout des trois parametres");
    for (const clef of ["lat", "lon", "radius_km"]) {
      const partout = [...CONSOLE.matchAll(new RegExp(`corpsRequete\\.${clef}\\s*=`, "g"))];
      expect(partout.length, `corpsRequete.${clef} affecte ${partout.length} fois`).toBe(1);
      expect(bloc, `corpsRequete.${clef} est affecte hors du garde des trois`)
        .toContain(`corpsRequete.${clef} = rayon.valeurs.${clef}`);
    }
  });
});

describe("rayon — les trois ensemble ou aucun", () => {
  it("les trois vides : nomme les trois, ne rend aucune valeur", () => {
    const w = domConsole();
    const r = poser(w, { coche: true });
    expect(r.valeurs).toBeUndefined();
    expect(r.erreur).toContain("la latitude");
    expect(r.erreur).toContain("la longitude");
    expect(r.erreur).toContain("le rayon");
  });

  it("position sans rayon : nomme le rayon seul — le cas d'apres « utiliser ma position »", () => {
    const w = domConsole();
    const r = poser(w, { coche: true, lat: 44.8378, lon: -0.5792 });
    expect(r.valeurs).toBeUndefined();
    expect(r.erreur).toContain("le rayon");
    expect(r.erreur).not.toContain("la latitude");
  });

  it("rayon sans position : nomme les deux qui manquent", () => {
    const w = domConsole();
    const r = poser(w, { coche: true, km: 25 });
    expect(r.valeurs).toBeUndefined();
    expect(r.erreur).toContain("la latitude");
    expect(r.erreur).toContain("la longitude");
  });

  it("les trois renseignes : les trois partent, en nombres", () => {
    const w = domConsole();
    const r = poser(w, { coche: true, lat: 44.8378, lon: -0.5792, km: 25 });
    expect(r.erreur).toBeUndefined();
    expect(r.valeurs).toEqual({ lat: 44.8378, lon: -0.5792, radius_km: 25 });
  });
});

describe("rayon — les bornes du moteur, et le zero qui compte", () => {
  it("lat 0 / lon 0 est une position valide, pas trois champs vides", () => {
    // Number("") vaut 0 : sans test de chaine vide AVANT la conversion, ces
    // deux cas seraient indiscernables.
    const w = domConsole();
    const r = poser(w, { coche: true, lat: 0, lon: 0, km: 10 });
    expect(r.valeurs).toEqual({ lat: 0, lon: 0, radius_km: 10 });
  });

  for (const [quoi, valeurs, attendu] of [
    ["latitude a 91", { lat: 91, lon: 0, km: 10 }, "la latitude"],
    ["latitude a -91", { lat: -91, lon: 0, km: 10 }, "la latitude"],
    ["longitude a 181", { lat: 0, lon: 181, km: 10 }, "la longitude"],
    ["rayon a 0", { lat: 0, lon: 0, km: 0 }, "le rayon"],
    ["rayon a -5", { lat: 0, lon: 0, km: -5 }, "le rayon"],
    ["rayon a 200.1", { lat: 0, lon: 0, km: 200.1 }, "le rayon"],
    ["saisie non numerique", { lat: "abc", lon: 0, km: 10 }, "la latitude"],
  ]) {
    it(`${quoi} : refuse et nomme le champ`, () => {
      const w = domConsole();
      const r = poser(w, { coche: true, ...valeurs });
      expect(r.valeurs, `${quoi} a ete accepte`).toBeUndefined();
      expect(r.erreur).toContain(attendu);
    });
  }

  for (const [quoi, valeurs] of [
    ["latitude a 90", { lat: 90, lon: 0, km: 10 }],
    ["longitude a -180", { lat: 0, lon: -180, km: 10 }],
    ["rayon a 200, le plafond exact", { lat: 0, lon: 0, km: 200 }],
  ]) {
    it(`${quoi} : accepte — la borne est incluse, comme cote moteur`, () => {
      const w = domConsole();
      expect(poser(w, { coche: true, ...valeurs }).valeurs, `${quoi} a ete refuse`).toBeDefined();
    });
  }
});

describe("rayon — radius_no_positions se lit, ne se devine pas", () => {
  it("la clef presente ouvre l'avertissement", () => {
    const w = domConsole();
    w.eval("soRafraichirAvertRayon({ total: 0, hits: [], radius_no_positions: true })");
    expect(w.document.getElementById("so-rayon-warn").hidden).toBe(false);
  });

  it("zero resultat SANS la clef ne l'ouvre pas — c'est un rayon trop petit, pas un catalogue sans coordonnees", () => {
    const w = domConsole();
    w.eval("soRafraichirAvertRayon({ total: 0, hits: [] })");
    expect(w.document.getElementById("so-rayon-warn").hidden).toBe(true);
  });

  it("une reponse suivante sans la clef le referme", () => {
    const w = domConsole();
    w.eval("soRafraichirAvertRayon({ radius_no_positions: true })");
    w.eval("soRafraichirAvertRayon({ total: 12, hits: [] })");
    expect(w.document.getElementById("so-rayon-warn").hidden).toBe(true);
  });

  it("l'avertissement dit d'ou vient le zero, dans les deux langues", () => {
    for (const [nom, html] of [["console.html", HTML_FR], ["en/console.html", HTML_EN]]) {
      const texte = new JSDOM(html).window.document.getElementById("so-rayon-warn").textContent;
      expect(texte.length, `${nom} : l'avertissement est vide`).toBeGreaterThan(60);
      expect(texte, `${nom} : n'explique pas d'ou vient le zero`).toMatch(/coordonnées|coordinates/);
    }
  });
});

describe("rayon — distance_km sur la carte", () => {
  function rendre(hit) {
    const dom = new JSDOM("<!doctype html><html lang='fr'><body><div id='c'></div></body></html>",
                          { runScripts: "outside-only", url: "http://localhost/" });
    const w = dom.window;
    w.eval(`
      ${extraire(I18N, "function T(gabarit) {", "\n  }", "T() de console-i18n.js")}
      var DICT = {}, EN = false, LOCALE = "fr-FR";
      ${extraire(CONSOLE, "function esc(s) {", "}", "esc() de console.js")}
      var h = ${JSON.stringify(hit)};
      ${extraire(CONSOLE, 'var distance = typeof h.distance_km === "number"', ': "";', "rendu de distance_km")}
      document.getElementById("c").innerHTML = distance;
    `);
    return w.document.getElementById("c");
  }

  it("sans rayon, aucune distance n'est affichee", () => {
    expect(rendre({ product: { id: "A" } }).innerHTML).toBe("");
  });

  it("une distance revenue est affichee", () => {
    expect(rendre({ distance_km: 12.43 }).textContent).toContain("12,43");
  });

  it("0 km s'affiche — le produit pose sur le point demande n'est pas une absence", () => {
    const cible = rendre({ distance_km: 0 });
    expect(cible.querySelector(".so-card-distance"), "0 km a ete traite comme une absence").not.toBeNull();
    expect(cible.textContent).toContain("0");
  });

  it("null ne s'affiche pas — le test porte sur le type, pas sur la verite", () => {
    expect(rendre({ distance_km: null }).innerHTML).toBe("");
  });
});
