import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// UN FAQPage NE DECLARE QUE CE QUE LA PAGE MONTRE (27 aout 2026).
//
// Trouve deux fois le meme jour, dans les deux sens.
//
// LE MATIN : le FAQPage d'index.html declarait quatre questions --
// integration, prix, comparaison Algolia, hebergement -- dont AUCUNE
// n'apparaissait sur la page. index.html en affichait trois entierement
// differentes : delai de mise en route, panne, RGPD. Recouvrement nul.
// Google demande que le contenu declare soit visible ; un balisage qui
// affirme ce que la page ne montre pas est pire qu'un balisage absent.
//
// L'APRES-MIDI : en corrigeant, j'ai derive les FAQPage du visible -- donc
// le texte existe desormais EN DOUBLE sur chaque page qui porte un FAQPage,
// une fois dans le corps et une fois dans le JSON-LD. Le cout est acceptable, mais il cree
// exactement le defaut d'en face : quelqu'un qui edite une page corrige ce
// qu'il VOIT et laisse le JSON. Et on edite toujours ce qu'on voit.
//
// Mesure faite avant d'ecrire ce test : le test de coherence des packs
// n'attrapait PAS ce cas. Il retire les <script> avant de lire, donc il ne
// voit jamais le JSON-LD. Verifie dans les deux sens -- texte visible perime
// seul : rouge ; copie JSON perimee seule : VERT. La moitie du defaut
// passait.
//
// PERIMETRE DERIVE : toutes les pages .html du depot qui portent un
// FAQPage. Aucune liste -- elles etaient trois ce matin, six ce soir.
// ---------------------------------------------------------------------------

const pages = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) parcourir(rel);
    else if (e.name.endsWith(".html")) pages.push(rel);
  }
})("");

/**
 * Meme normalisation des deux cotes : balises retirees, entites resolues,
 * espaces reduits. C'est celle qui a servi a DERIVER les FAQPage du visible,
 * donc l'egalite stricte tient -- mesure a l'ecriture : 40 paires
 * question/reponse, 40 retrouvees, zero faux positif.
 *
 * Si un jour une page legitime echoue ici, la question a poser est « d'ou
 * vient l'ecart » avant d'assouplir : l'ecart EST le defaut que ce test
 * cherche.
 */
function normaliser(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "’").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const aFAQ = [];
for (const p of pages) {
  const s = fs.readFileSync(path.join(RACINE, p), "utf8");
  for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d;
    try { d = JSON.parse(m[1]); } catch { continue; }
    if (d["@type"] !== "FAQPage") continue;
    aFAQ.push({
      page: p,
      entrees: d.mainEntity,
      visible: normaliser(s.replace(/<script\b[\s\S]*?<\/script>/g, "")),
      sommaires: (s.replace(/<script\b[\s\S]*?<\/script>/g, "").match(/<summary/g) || []).length,
    });
  }
}

describe("FAQPage — le balisage ne declare que ce que la page montre", () => {
  it("chaque QUESTION declaree apparait dans le texte visible", () => {
    const absentes = [];
    for (const f of aFAQ)
      for (const e of f.entrees)
        if (!f.visible.includes(normaliser(e.name)))
          absentes.push(`${f.page} :: ${e.name}`);
    expect(absentes).toEqual([]);
  });

  // LE CAS QUI PASSAIT. Une reponse peut diverger sans que la question bouge :
  // on reformule un paragraphe, la question reste la meme, et le JSON garde
  // l'ancienne redaction.
  it("chaque REPONSE declaree apparait dans le texte visible", () => {
    const absentes = [];
    for (const f of aFAQ)
      for (const e of f.entrees) {
        const r = normaliser(e.acceptedAnswer.text);
        if (!f.visible.includes(r))
          absentes.push(`${f.page} :: « ${e.name} » -> reponse absente du visible`);
      }
    expect(absentes).toEqual([]);
  });

  // Le pendant : la page montre une question que le balisage tait. Moins
  // grave -- rien de faux n'est affirme -- mais c'est le signe que l'un des
  // deux a ete edite sans l'autre.
  it("le balisage declare autant de questions que la page en montre", () => {
    const ecarts = aFAQ
      .filter((f) => f.entrees.length !== f.sommaires)
      .map((f) => `${f.page} : ${f.entrees.length} declarees, ${f.sommaires} affichees`);
    expect(ecarts).toEqual([]);
  });

  it("aucun FAQPage n'est vide", () => {
    expect(aFAQ.filter((f) => !f.entrees || f.entrees.length === 0).map((f) => f.page))
      .toEqual([]);
  });

  it("le balayage a reellement trouve les FAQPage du site", () => {
    expect(aFAQ.length).toBeGreaterThanOrEqual(6);
  });
});
