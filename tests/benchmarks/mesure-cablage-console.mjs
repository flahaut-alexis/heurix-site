// Mesure du câblage de console.js — instrument, pas test (25 août 2026).
//
// POURQUOI CET INSTRUMENT EST VERSIONNÉ. Il a produit les seuls chiffres
// avant/après du chantier C1 (séparation du câblage et du chargement) :
// 312 écouteurs vivants et 45 surnuméraires avant, 162 et 15 après, et
// 123 appels réseau ramenés à 100. Sans lui, le chantier se serait jugé
// sur dix passages verts — qui ne prouvent qu'une absence d'occurrence.
// Le prochain qui touchera à ce fichier de 7 000 lignes repartirait sans
// instrument ; l'équivalent côté moteur est versionné depuis le même jour
// (heurix-engine, tests/benchmarks/bench_preemption_bascule.py).
//
// LANCEMENT :
//     node tests/benchmarks/mesure-cablage-console.mjs [chemin-du-depot]
//
// Ce n'est PAS un test : le nom ne finit pas par `.test.js`, donc vitest
// ne le collecte pas et il n'entre jamais dans le compte de `npm test`.
// Il n'assère rien — il observe et il rapporte.
//
// ════════════════════════════════════════════════════════════════════════
// TROIS PIÈGES. Ce sont eux qui font la différence entre un instrument et
// un piège : chacun donne des chiffres qui ont l'air justes et ne le sont
// pas.
// ════════════════════════════════════════════════════════════════════════
//
// 1. LES DONNÉES DE TEST DOIVENT CORRESPONDRE AUX CHAMPS QUE LE CODE LIT.
//    `reponsePour()` invente les réponses de l'API — exactement ce que le
//    tests/README.md de ce dépôt reproche aux anciens tests des widgets :
//    « ils inventaient eux-mêmes la réponse de l'API. Un mock accepte
//    n'importe quel format. » La critique s'applique ici aussi, et il faut
//    la connaître pour s'en garder.
//
//    Concrètement : `renderStats` lit `summary.total_searches`,
//    `zero_result_rate`, `total_errors` et `usage.requests`. Un nom
//    approximatif fait lever une exception qui part dans le `.catch()` de
//    la chaîne de chargement — lequel DÉCONNECTE. On mesure alors une
//    console vide en croyant mesurer la console, et rien ne le signale :
//    23 écouteurs relevés au lieu de 199, sans la moindre erreur affichée.
//
//    D'où la ligne `dashboard visible :` en tête de sortie. Si elle dit
//    `false`, TOUS les chiffres qui suivent sont sans valeur. Ne pas les
//    lire, corriger les données d'abord.
//
// 2. COMPTER LES ÉCOUTEURS VIVANTS, PAS LES APPELS À addEventListener.
//    Un élément recréé par innerHTML emporte ses écouteurs avec lui.
//    `wireCatalogCard`, `wireSynonymControls` et `wireCustomRuleControls`
//    en reposent douze à chaque changement de catalogue : ce n'est PAS une
//    fuite, et les compter comme telle gonfle le chiffre sans qu'aucun
//    doublon ne soit réellement en vie.
//
//    D'où le filtrage sur `isConnected`. Et surtout : le seul signal qui
//    compte est la CROISSANCE des surnuméraires vivants quand on répète
//    une action — pas leur total absolu.
//
// 3. « SURNUMÉRAIRES » EST UN MAUVAIS PROXY, et c'est le piège le plus
//    coûteux. Le compte se fait par IDENTITÉ d'élément, pas par nom : trois
//    boutons partageant `.export-csv-btn` ne sont pas un doublon. Mais
//    `document` porte DIX gestionnaires de clic « fermer au clic
//    extérieur », un par panneau, chacun posé UNE FOIS par une fonction
//    différente — et le compteur les lit comme neuf surnuméraires.
//
//    Ce compteur ne peut donc PAS tomber à zéro, quel que soit le soin
//    apporté au code. Une demi-journée a été perdue à le poursuivre avant
//    de l'admettre.
//
//    La bonne question n'est pas « combien de surnuméraires » mais
//    « COMBIEN DE GESTIONNAIRES INDÉPENDANTS, POSÉS PAR COMBIEN DE
//    FONCTIONS DIFFÉRENTES ». C'est ce que donne la section
//    « DÉTAIL des surnumeraires (cible ← appelant) » en fin de sortie, et
//    c'est elle qu'il faut lire pour chiffrer un candidat de
//    refactorisation.
//
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { fileURLToPath } from "node:url";

// Racine résolue depuis CE fichier : le banc vit dans tests/benchmarks/,
// donc deux niveaux au-dessus. Aucun chemin absolu, il suit le dépôt.
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = process.argv[2] || path.resolve(ICI, "..", "..");
// jsdom vit dans le node_modules du depot ; ce script vit dehors pour ne pas
// salir l'arbre de travail. On resout donc depuis le depot.
const requireDepot = createRequire(path.join(RACINE, "package.json"));
const { JSDOM } = requireDepot("jsdom");

// --------------------------------------------------------------------------
// Reponses reseau plausibles : le but n'est pas de simuler l'API, mais de
// laisser console.js suivre son chemin nominal jusqu'au bout. Une reponse
// vide ferait partir la plupart des .then() dans le .catch(), et on ne
// mesurerait plus rien.
// --------------------------------------------------------------------------
function reponsePour(url) {
  if (url.includes("/v1/auth/me")) {
    return { keys: [{ key: "hx_test", plan: "growth" }], email: "test@example.com" };
  }
  if (url.includes("/v1/index/catalogs")) {
    return { catalogs: [{ catalog: "cat-un", sandbox: false }, { catalog: "cat-deux", sandbox: false }] };
  }
  if (url.includes("/v1/analytics/comparison")) {
    return { courant: {}, precedent: {} };
  }
  if (url.includes("/v1/analytics/summary")) {
    // Noms de champs releves dans renderStats() : un nom approximatif ici
    // fait lever une exception qui part dans le .catch() de loadDashboard,
    // lequel DECONNECTE -- on mesurerait alors une console vide.
    return { total_searches: 10, zero_result_rate: 0, total_errors: 0, daily_searches: [] };
  }
  if (url.includes("/top-queries") || url.includes("/zero-results")) return { queries: [] };
  if (url.includes("/errors")) return { errors: [] };
  if (url.includes("/v1/usage")) {
    return { plan: "growth", requests: 42, used: 42, limit: 1000, catalogs: 2, products: 10,
             browse_plan: null, account_email: "test@example.com" };
  }
  if (url.includes("/category-views")) return { categories: [] };
  if (url.includes("/synonyms")) return { groups: [], total: 0 };
  if (url.includes("/custom-rules")) return { rules: [] };
  if (url.includes("/query-overrides")) return { overrides: [] };
  if (url.includes("/browse")) return { overrides: [], rules: [], products: [], categories: [] };
  if (url.includes("/conversion")) return { rows: [], total: 0 };
  if (url.includes("/top-products")) return { products: [] };
  if (url.includes("/segmentation")) return { segments: [] };
  if (url.includes("/rulepacks")) return { rulepacks: [] };
  return {};
}

function charger() {
  const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/console.html", runScripts: "outside-only" });
  const { window } = dom;
  window.Element.prototype.scrollIntoView = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};

  // ---- COMPTEUR D'ECOUTEURS -------------------------------------------
  // getEventListeners n'existe que dans la console Chrome. On instrumente
  // donc addEventListener a la source, ce qui donne la meme information et
  // reste reproductible en ligne de commande.
  const ecouteurs = new Map();   // "cible#type" -> nombre
  const cibleNom = (el) => {
    if (el === window.document) return "document";
    if (el === window) return "window";
    if (el.id) return "#" + el.id;
    const cls = (el.className && String(el.className).split(/\s+/)[0]) || "";
    return (el.tagName ? el.tagName.toLowerCase() : "?") + (cls ? "." + cls : "");
  };
  // On garde une reference a la CIBLE, pas seulement son nom : un element
  // recree par innerHTML emporte ses ecouteurs avec lui, et les compter
  // comme des fuites gonflerait le chiffre sans qu'aucun doublon ne soit
  // reellement en vie. Le tri se fait au moment du rapport, sur isConnected.
  // ATTRIBUTION PAR APPELANT. Sans elle on sait qu'un doublon existe, pas
  // QUI l'a pose -- donc pas quelle fonction corriger. La pile d'appel donne
  // le nom de la fonction de console.js qui a demande l'ecouteur.
  const appelant = () => {
    const pile = (new Error().stack || "").split("\n");
    for (const f of pile) {
      const m = f.match(/at\s+(?:new\s+|async\s+)?([A-Za-z_$][\w$.]*)\s*\(/);
      if (!m) continue;
      const nom = m[1];
      // On saute l'instrumentation elle-meme et les cadres du moteur.
      if (/addEventListener|^appelant$|^Object\.<|^eval$|^Module\./.test(nom)) continue;
      // Un nom qualifie (a.b.c) vient du moteur, pas de console.js.
      return nom.includes(".") ? nom.split(".").pop() : nom;
    }
    return "(niveau module)";
  };
  const registres = [];   // { cible, type, par }
  const origAEL = window.EventTarget.prototype.addEventListener;
  window.EventTarget.prototype.addEventListener = function (type, fn, opts) {
    const clef = cibleNom(this) + " → " + type;
    ecouteurs.set(clef, (ecouteurs.get(clef) || 0) + 1);
    registres.push({ cible: this, type, par: appelant() });
    return origAEL.call(this, type, fn, opts);
  };
  window.__registres = registres;
  window.__cibleNom = cibleNom;

  // ---- COMPTEUR RESEAU -------------------------------------------------
  const appels = [];
  const appelsPar = [];
  window.fetch = async (url, init) => {
    appels.push(String(url).replace("https://api.heurix.fr", ""));
    // Attribution des appels reseau, meme mecanique que pour les ecouteurs :
    // savoir QU'UN endpoint part deux fois ne dit pas d'ou.
    { const pile = (new Error().stack || "").split("\n");
      let par = "(inconnu)";
      for (const f of pile) {
        const m = f.match(/at\s+(?:new\s+|async\s+)?([A-Za-z_$][\w$.]*)\s*\(/);
        if (!m) continue;
        const nom = m[1];
        if (/fetch|apiFetch|^Object\.<|^eval$|^Module\./.test(nom)) continue;
        par = nom.includes(".") ? nom.split(".").pop() : nom; break;
      }
      appelsPar.push({ url: String(url).replace("https://api.heurix.fr", ""), par }); }
    return { ok: true, status: 200, json: async () => reponsePour(String(url)) };
  };
  global.fetch = window.fetch;
  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;

  window.localStorage.setItem("heurix_console_session", "jeton-de-test");

  window.eval(fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(RACINE, "console.js"), "utf8"));

  return { window, document: window.document, ecouteurs, appels, registres, cibleNom, appelsPar };
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

function instantane(ecouteurs) {
  return new Map(ecouteurs);
}
function delta(avant, apres) {
  const d = new Map();
  for (const [k, v] of apres) {
    const n = v - (avant.get(k) || 0);
    if (n > 0) d.set(k, n);
  }
  return d;
}
function grouper(chemins) {
  const m = new Map();
  for (const c of chemins) {
    const base = c.split("?")[0];
    m.set(base, (m.get(base) || 0) + 1);
  }
  return m;
}

const { window, document, ecouteurs, appels, registres, cibleNom, appelsPar } = charger();

// LE CRITERE. Un element recree par innerHTML emporte ses ecouteurs : le
// recabler n'est pas une fuite. Ce qui compte est le nombre d'ecouteurs
// SURNUMERAIRES sur des elements VIVANTS -- il doit rester constant quand
// on repete une action.
function surnumerairesVivants() {
  const parElement = new Map();
  for (const { cible, type } of registres) {
    const attache = cible === window || cible === window.document || cible.isConnected;
    if (!attache) continue;
    if (!parElement.has(cible)) parElement.set(cible, new Map());
    const t = parElement.get(cible);
    t.set(type, (t.get(type) || 0) + 1);
  }
  let n = 0;
  for (const [, types] of parElement) for (const [, c] of types) if (c > 1) n += c - 1;
  return n;
}

// Ne retient que les ecouteurs ENCORE VIVANTS : cible toujours rattachee au
// document. C'est la difference entre « addEventListener a ete appele deux
// fois » et « deux ecouteurs vont se declencher au prochain clic ».
// Compte par IDENTITE d'element, pas par nom. Trois boutons partageant la
// classe .export-csv-btn ne sont PAS un doublon, et plusieurs gestionnaires
// « fermer au clic exterieur » sur document sont legitimes : ce sont des
// comportements distincts, chacun pose une fois. Le seul signal qui compte
// est donc la CROISSANCE sur repetition, pas le total absolu.
function vivants() {
  const parElement = new Map();   // element -> Map(type -> n)
  for (const { cible, type } of registres) {
    const attache = cible === window || cible === window.document || cible.isConnected;
    if (!attache) continue;
    if (!parElement.has(cible)) parElement.set(cible, new Map());
    const t = parElement.get(cible);
    t.set(type, (t.get(type) || 0) + 1);
  }
  const m = new Map();
  let i = 0;
  for (const [el, types] of parElement) {
    i += 1;
    for (const [type, n] of types) m.set(cibleNom(el) + "#" + i + " → " + type, n);
  }
  return m;
}

// Diagnostic : toute exception dans un .then() part dans le .catch() de
// loadDashboard, qui DECONNECTE. Sans cette trace on mesurerait le vide en
// croyant mesurer la console.
window.addEventListener("error", (e) => console.log("  [erreur fenetre]", e.message));
const origErr = console.error;

await attendre(600);
console.log("--- diagnostic de depart ---");
console.log("  appels effectues :", appels.join(", ") || "(aucun)");
const dash = document.getElementById("dashboard");
const login = document.getElementById("auth-section") || document.getElementById("login-section");
console.log("  dashboard visible :", dash ? !dash.hidden : "(#dashboard absent)");
console.log("  ecran de login visible :", login ? !login.hidden : "(introuvable)");
console.log("  dash-content hidden :", (document.getElementById("dash-content")||{}).hidden);
console.log("----------------------------");

console.log("═══ ETAT APRES LE CHARGEMENT INITIAL ═══");
console.log("  ecouteurs poses au total :", [...ecouteurs.values()].reduce((a, b) => a + b, 0));
console.log("  appels reseau            :", appels.length);
const doublesInit = [...ecouteurs].filter(([, n]) => n > 1);
console.log("  cibles portant DEJA plusieurs ecouteurs du meme type :", doublesInit.length);
for (const [k, n] of doublesInit.slice(0, 12)) console.log(`      ${n}×  ${k}`);

// ---------------------------------------------------------------------------
// SCENARIO : deux changements de catalogue espaces de plus d'une seconde.
// C'est exactement le cas que le drapeau rechargementAnalytics ne couvre
// pas -- il est libere a setTimeout(..., 1000).
// ---------------------------------------------------------------------------
const select = document.getElementById("global-catalog");
console.log("\n═══ SCENARIO : deux changements de catalogue espaces de 1,2 s ═══");
if (!select) {
  console.log("  #global-catalog absent — scenario impossible");
} else {
  const e0 = instantane(ecouteurs); const n0 = appels.length;
  const s0 = surnumerairesVivants();
  select.value = "cat-deux";
  select.dispatchEvent(new window.Event("change"));
  await attendre(700);
  const e1 = instantane(ecouteurs); const n1 = appels.length;
  console.log("  1er changement : +%d enregistrements, +%d appels, surnumeraires vivants %d -> %d",
    [...delta(e0, e1).values()].reduce((a, b) => a + b, 0), n1 - n0, s0, surnumerairesVivants());

  const marque = registres.length;
  const sAvant2 = surnumerairesVivants();
  await attendre(1200);
  select.value = "cat-un";
  select.dispatchEvent(new window.Event("change"));
  await attendre(700);
  const e2 = instantane(ecouteurs); const n2 = appels.length;
  const d2 = delta(e1, e2);
  const s1 = surnumerairesVivants();
  console.log("  2e changement  : +%d enregistrements, +%d appels, surnumeraires vivants %d -> %d",
    [...d2.values()].reduce((a, b) => a + b, 0), n2 - n1, sAvant2, s1);
  if (d2.size) {
    console.log("  ECOUTEURS AJOUTES AU 2e CHANGEMENT (ne devraient pas exister) :");
    for (const [k, n] of [...d2].sort((a, b) => b[1] - a[1])) console.log(`      +${n}  ${k}`);
  }
  const poseurs = new Map();
  for (const { par } of registres.slice(marque)) poseurs.set(par, (poseurs.get(par) || 0) + 1);
  console.log("  QUI pose des ecouteurs au 2e changement (doit etre vide) :");
  for (const [f, n] of [...poseurs].sort((a, b) => b[1] - a[1])) console.log(`      ${n}×  ${f}`);
  console.log("  appels reseau du 2e changement, par endpoint :");
  for (const [c, n] of [...grouper(appels.slice(n1))].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${n}×  ${c}`);
  }
}

// ---------------------------------------------------------------------------
// SCENARIO : trois changements de periode (chemin le plus banal).
// ---------------------------------------------------------------------------
const periode = document.getElementById("period-select");
console.log("\n═══ SCENARIO : trois changements de periode ═══");
if (!periode) {
  console.log("  #period-select absent");
} else {
  for (let i = 0; i < 3; i++) {
    const e0 = instantane(ecouteurs); const n0 = appels.length;
    periode.value = [7, 30, 90][i];
    periode.dispatchEvent(new window.Event("change"));
    await attendre(600);
    const d = delta(e0, instantane(ecouteurs));
    console.log(`  changement ${i + 1} : +${[...d.values()].reduce((a, b) => a + b, 0)} ecouteurs, +${appels.length - n0} appels`);
    for (const [k, n] of [...d].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`      +${n}  ${k}`);
  }
}

console.log("\n═══ CUMUL FINAL — ECOUTEURS ENCORE VIVANTS ═══");
const v = vivants();
const doubles = [...v].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
console.log("  enregistrements bruts  :", registres.length);
console.log("  ecouteurs encore vivants :", [...v.values()].reduce((a, b) => a + b, 0));
console.log("  cibles VIVANTES portant plusieurs ecouteurs du meme type :", doubles.length);
for (const [k, n] of doubles.slice(0, 25)) console.log(`      ${n}×  ${k}`);
console.log("  total appels reseau :", appels.length);

// ---------------------------------------------------------------------------
// ATTRIBUTION : quelle fonction pose des ecouteurs EN DOUBLE sur des cibles
// vivantes ? C'est la liste de ce qu'il faut corriger.
// ---------------------------------------------------------------------------
const parFonction = new Map();
const vus = new Map();
for (const { cible, type, par } of registres) {
  const attache = cible === window || cible === window.document || cible.isConnected;
  if (!attache) continue;
  const clef = cibleNom(cible) + "|" + type;
  const n = (vus.get(clef) || 0) + 1;
  vus.set(clef, n);
  if (n > 1) parFonction.set(par, (parFonction.get(par) || 0) + 1);
}
console.log("\n═══ QUI POSE LES DOUBLONS (ecouteurs surnumeraires, cibles vivantes) ═══");
for (const [f, n] of [...parFonction].sort((a, b) => b[1] - a[1])) {
  console.log(`      ${String(n).padStart(3)} en trop  ←  ${f}`);
}
console.log("      total surnumeraires :", [...parFonction.values()].reduce((a, b) => a + b, 0));

// Detail des surnumeraires, cible par cible, pour les appelants opaques.
console.log("\n═══ DETAIL des surnumeraires (cible ← appelant) ═══");
const vus2 = new Map();
const detail = new Map();
for (const { cible, type, par } of registres) {
  const attache = cible === window || cible === window.document || cible.isConnected;
  if (!attache) continue;
  const clef = cibleNom(cible) + " → " + type;
  const n = (vus2.get(clef) || 0) + 1;
  vus2.set(clef, n);
  if (n > 1) {
    const k = clef + "  ←  " + par;
    detail.set(k, (detail.get(k) || 0) + 1);
  }
}
for (const [k, n] of [...detail].sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(3)}×  ${k}`);


// ---------------------------------------------------------------------------
// DECOMPTE PAR IDENTITE : de quoi le socle est-il fait ?
// ---------------------------------------------------------------------------
console.log("\n═══ SOCLE, par identite d'element ═══");
{
  const parEl = new Map();
  for (const { cible, type, par } of registres) {
    const attache = cible === window || cible === window.document || cible.isConnected;
    if (!attache) continue;
    if (!parEl.has(cible)) parEl.set(cible, new Map());
    const t = parEl.get(cible);
    if (!t.has(type)) t.set(type, []);
    t.get(type).push(par);
  }
  let total = 0;
  for (const [el, types] of parEl) {
    for (const [type, poseurs] of types) {
      if (poseurs.length > 1) {
        total += poseurs.length - 1;
        console.log(`   ${poseurs.length}× sur ${cibleNom(el)} → ${type}  (${poseurs.length - 1} en trop)`);
        console.log(`        poses par : ${poseurs.join(", ")}`);
      }
    }
  }
  console.log("   TOTAL surnumeraires :", total);
}


console.log("\n═══ /v1/usage : qui l'appelle, sur tout le scenario ═══");
{
  const m = new Map();
  for (const { url, par } of appelsPar) {
    if (!url.startsWith("/v1/usage")) continue;
    m.set(par, (m.get(par) || 0) + 1);
  }
  for (const [f, n] of [...m].sort((a, b) => b[1] - a[1])) console.log(`   ${n}×  ${f}`);
  console.log("   total :", [...m.values()].reduce((a, b) => a + b, 0));
}
