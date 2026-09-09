import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// LES NOMS DE PACKS ETAIENT TRADUITS DANS LES EXEMPLES ANGLAIS (9 sept. 2026).
//
// `en/docs.html` et `en/fonctionnalites.html` ecrivaient `"recommande":
// "fashion"` et `{"pack": "hardware", ...}` dans des blocs presentes comme
// des reponses `curl`. Aucun de ces deux noms n'existe : les onze packs
// sont nommes d'apres leurs fichiers dans `heurix-engine/rulepacks/`, et
// `comparer_packs` fait `for nom, pack in sorted(rulepacks.items())` -- il
// n'y a aucune traduction, quelle que soit la langue de l'appelant. Un
// integrateur anglophone qui compare `recommande` a "fashion" ne trouve
// jamais rien, et rien ne le lui dit : l'API repond, avec le bon nom.
//
// CE QUE CE GARDE COUVRE, ET CE QU'IL NE COUVRE PAS.
//
// Il lit les VALEURS des champs `pack`, `recommande` et `rulepack` dans les
// blocs de code de toutes les pages du site -- pas seulement les quatre
// pages de documentation, parce que le defaut ne se loge pas plus volontiers
// la qu'ailleurs : `integrations.html` porte quatre `rulepack` dans du PHP
// et du JavaScript, et rien n'empeche un exemple de blog d'en porter un.
//
// Il ne lit PAS la prose. « the fashion pack » est correct en anglais, et
// `en/solutions/*.html` l'ecrit deja bien : le nom reel dans le `<code>`,
// la glose autour. C'est la valeur DANS le bloc qui est un contrat.
//
// Il ne peut PAS voir le moteur renommer un pack : heurix-engine est un
// autre depot. `PACKS` est donc croise avec `solutions/`, ou chaque pack a
// sa page nommee d'apres lui -- deux sources du site qui doivent s'accorder,
// et un ajout de pack fait echouer l'assertion de croisement en nommant
// exactement ce qu'il faut mettre a jour. C'est ce que fait deja
// `packs-coherence.test.js` pour le NOMBRE de packs ; celui-ci porte les
// NOMS.
// ---------------------------------------------------------------------------
const PACKS = [
  "automobile", "electricite", "electronique", "finance", "industrie",
  "livres", "mode", "outillage", "plomberie", "sport", "vins",
];

const pages = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) { if (rel !== "tests") parcourir(rel); }
    else if (e.name.endsWith(".html")) pages.push(rel);
  }
})("");

/** Contenu des blocs de code d'une page, balises et entites resolues.
 *
 * Le HTML des exemples est echappe (`=&gt;` en PHP, `&quot;` ailleurs) :
 * sans desechappement, `'rulepack' =&gt; 'mode'` ne ressemble a rien. */
const BLOC = /<(pre|code)\b[^>]*class="[^"]*(?:docs-code|docs-inline-code|hero-code|panel-code|integration-code)[^"]*"[^>]*>([\s\S]*?)<\/\1>/g;

function blocs(p) {
  const src = fs.readFileSync(path.join(RACINE, p), "utf8");
  const out = [];
  for (const m of src.matchAll(BLOC)) {
    const ligne = src.slice(0, m.index).split("\n").length;
    const txt = m[2]
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
    out.push({ ligne, txt });
  }
  return out;
}

// LES CINQ CHAMPS QUI PORTENT LE NOM D'UN PACK, et les quatre syntaxes ou
// on les rencontre. `pack`, `recommande`, `second` et `pack_actuel` sortent
// de /v1/index/{catalog}/rulepack-suggestion et de POST
// /v1/rulepacks/suggest ; `rulepack` entre a l'indexation et ressort dans le
// resume du catalogue. C'est le meme vocabulaire des deux cotes : un nom
// refuse en entree est un nom qu'on ne lira jamais en sortie.
//
//     "pack": "mode"          JSON
//     rulepack: "mode"        JavaScript
//     'rulepack' => 'mode'    PHP
//     "rulepack": "mode"      JSON
//
// `second` ET `pack_actuel` ONT ETE AJOUTES PAR LE REBASE, PAS PAR RELECTURE
// (9 septembre 2026). Le premier jet de ce garde ne connaissait que les
// trois premiers, parce que `marge` n'existait pas encore quand il a ete
// ecrit. Le lot marge-console, fusionne dans `main` pendant ce lot-ci, a
// ajoute `"second": "hardware"` dans les deux pages que je venais de
// corriger et un bloc POST entier portant `"pack": "plumbing"` et
// `"recommande": "hardware"` -- quatre valeurs fausses de plus, dont un
// douzieme faux nom que le premier balayage ne pouvait pas voir : il
// n'existait pas.
//
// C'est la lecon du perimetre, sous une autre forme que celle de
// packs-coherence.test.js : un garde ecrit sur les champs D'AUJOURD'HUI est
// aveugle a ceux de demain, et le lot qui les ajoute n'a aucune raison de
// penser a lui. Tout champ dont la valeur est un nom de pack entre ici.
const CHAMP = /(?:["']?)(pack|recommande|rulepack|second|pack_actuel)(?:["']?)\s*(?::|=>)\s*(["'])([^"']*)\2/g;

const releves = [];
for (const p of pages) {
  for (const { ligne, txt } of blocs(p)) {
    for (const m of txt.matchAll(CHAMP)) {
      releves.push({ page: p, ligne, champ: m[1], valeur: m[3] });
    }
  }
}

describe("noms de packs dans les blocs de code", () => {
  // LE POSITIF CONNU. Sans lui, un motif casse -- une classe CSS renommee,
  // un desechappement oublie -- rendrait ce fichier vert sur zero releve.
  // Le seuil est bas volontairement : il affirme que le balayage VOIT, pas
  // combien d'exemples le site porte aujourd'hui.
  it("le balayage releve des valeurs de pack", () => {
    expect(releves.length, "aucune valeur relevee : le motif ou le perimetre est casse").toBeGreaterThanOrEqual(10);
    // `pack_actuel` EST DANS LE MOTIF ET PAS DANS CETTE LISTE, et c'est
    // mesure, pas une omission : les deux seuls exemples qui le portent
    // l'ecrivent `null`, sans guillemets, donc hors du motif qui lit des
    // valeurs quotees. L'exiger ici serait une assertion sur une population
    // vide -- verte parce qu'elle ne peut rien trouver, pas parce que le
    // site est correct. Le champ reste dans `CHAMP` pour le jour ou un
    // exemple le remplit ; il entrera alors dans cette liste.
    for (const champ of ["pack", "recommande", "rulepack", "second"]) {
      expect(releves.some((r) => r.champ === champ), `aucun releve pour le champ ${champ}`).toBe(true);
    }
  });

  it("le motif attrape la forme exacte qui a ete corrigee", () => {
    // La regex est reconstruite : `CHAMP` porte /g et donc un `lastIndex`.
    const motif = new RegExp(CHAMP.source, "g");
    const trouves = [...'{"pack": "plumbing"}, "recommande": "fashion", "marge": {"second": "hardware"}'
      .matchAll(motif)].map((m) => m[3]);
    expect(trouves).toEqual(["plumbing", "fashion", "hardware"]);
  });

  it("toute valeur relevee est un des onze packs du moteur", () => {
    const fautives = releves.filter((r) => !PACKS.includes(r.valeur));
    expect(
      fautives.map((r) => `${r.page}:${r.ligne} ${r.champ}: "${r.valeur}"`),
      "valeur absente de heurix-engine/rulepacks/ -- traduite, inventee, ou pack renomme",
    ).toEqual([]);
  });

  // L'ACCORD MUTUEL AVEC `solutions/`. C'est la seule chose que le site
  // puisse opposer a `PACKS` : `rulepacks/` vit dans l'autre depot.
  it("PACKS est exactement la liste des pages solutions/", () => {
    const depuisSolutions = fs.readdirSync(path.join(RACINE, "solutions"))
      .filter((f) => f.endsWith(".html") && f !== "index.html")
      .map((f) => f.replace(/\.html$/, ""))
      .sort();
    expect(
      depuisSolutions,
      "solutions/ et PACKS divergent -- un pack a ete ajoute, retire ou renomme : mettre a jour PACKS ci-dessus",
    ).toEqual([...PACKS].sort());
  });
});
