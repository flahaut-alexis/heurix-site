import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// LE NOMBRE DE PACKS EST ECRIT EN DUR A VINGT-TROIS ENDROITS (27 aout 2026).
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

const pages = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) parcourir(rel);
    else if (e.name.endsWith(".html")) pages.push(rel);
  }
})("");

/** HTML brut, tel quel -- necessaire pour lire un <select>, que texte() efface. */
function brut(p) {
  return fs.readFileSync(path.join(RACINE, p), "utf8");
}

/** Texte visible, scripts et styles retires. */
function texte(p) {
  let s = fs.readFileSync(path.join(RACINE, p), "utf8");
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "");
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

// « dix packs », « ten rule packs » — le nombre est ECRIT EN LETTRES, jamais
// en chiffres : « lots de 5 000 Pack de regles » serait sinon compte comme
// une affirmation, ce qu'il n'est pas.
const AFFIRMATION = /\b(six|sept|huit|neuf|dix|onze|douze|seven|eight|nine|ten|eleven|twelve)\s+(?:rule\s+)?packs?\b/gi;

// Une enumeration commence par le premier pack et liste les autres.
const ENUMERATION = /\((outillage|hardware)[^)]{40,}\)/gi;

const affirmations = [];
const enumerations = [];
for (const p of pages) {
  const t = texte(p);
  for (const m of t.matchAll(AFFIRMATION)) {
    affirmations.push({ page: p, mot: m[1].toLowerCase(), valeur: NOMBRES[m[1].toLowerCase()] });
  }
  for (const m of t.matchAll(ENUMERATION)) {
    const noms = m[0].slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean);
    if (noms.length >= 5) enumerations.push({ page: p, noms });
  }
}

describe("packs — les vingt-trois affirmations du site s'accordent", () => {
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
  const identite = (n) =>
    n.replace(/&amp;/g, "&").split(/[&(,]/)[0].trim().toLowerCase();
  const clef = (noms) => noms.map(identite).sort().join("|");

  it("les enumerations francaises listent les MEMES packs", () => {
    const fr = enumerations.filter((e) => !e.page.startsWith("en/"));
    const clefs = [...new Set(fr.map((e) => clef(e.noms)))];
    const detail = clefs.length > 1 ? fr.map((e) => `${e.page} : ${e.noms.join(", ")}`) : [];
    expect(detail).toEqual([]);
  });

  it("les enumerations anglaises listent les MEMES packs", () => {
    const en = enumerations.filter((e) => e.page.startsWith("en/"));
    const clefs = [...new Set(en.map((e) => clef(e.noms)))];
    const detail = clefs.length > 1 ? en.map((e) => `${e.page} : ${e.noms.join(", ")}`) : [];
    expect(detail).toEqual([]);
  });

  it("les listes francaise et anglaise ont le meme nombre de packs", () => {
    const fr = enumerations.filter((e) => !e.page.startsWith("en/"));
    const en = enumerations.filter((e) => e.page.startsWith("en/"));
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
    const ref = enumerations.find((e) => !e.page.startsWith("en/"));
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

  // Un balayage qui n'examine rien passe au vert sans rien prouver.
  it("le balayage a reellement trouve les affirmations", () => {
    expect(affirmations.length).toBeGreaterThanOrEqual(15);
    expect(enumerations.length).toBeGreaterThanOrEqual(6);
  });
});
