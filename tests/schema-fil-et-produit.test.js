import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.join(import.meta.dirname, "..");

// ---------------------------------------------------------------------------
// LE FIL D'ARIANE DECLARE AUX MACHINES EST CELUI QUE LE VISITEUR LIT
// (4 septembre 2026).
//
// L'audit demandait un `BreadcrumbList` sur « 68 articles et 24 pages
// solutions ». Il comptait l'IMBRICATION DES FICHIERS -- un article est sous
// `blog/`, donc il aurait un chemin. Mesure du 7 septembre 2026 : les 70
// articles -- 40 sous `blog/`, 30 sous `en/blog/`, et l'audit en comptait 68 --
// portent « ← Tous les articles », un lien de RETOUR, pas un chemin. Les 24 pages
// `solutions/` portent un vrai `<nav class="breadcrumb">`, visible, dans les
// deux langues.
//
// Un fil d'Ariane transcrit ce que la page montre. Sur les articles il n'y a
// rien a transcrire, et le construire depuis `blog/` aurait declare aux
// machines une hierarchie que personne ne voit. LE PERIMETRE EST DONC LA
// PRESENCE DU `nav`, jamais le chemin du fichier -- c'est ce qui empeche ce
// garde de valider l'invention qu'il doit interdire.
//
// Et les maillons sont compares au TEXTE du `nav`, pas aux chemins, pour la
// meme raison : deriver les deux du meme endroit ne verifierait rien.
// ---------------------------------------------------------------------------

/** Toutes les pages HTML du depot. */
function pagesHtml(dir = RACINE, sortie = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) pagesHtml(p, sortie);
    else if (e.name.endsWith(".html")) sortie.push(p);
  }
  return sortie;
}

const rel = (abs) => path.relative(RACINE, abs).split(path.sep).join("/");

function lire(p) {
  return fs.readFileSync(path.join(RACINE, p), "utf8");
}

/** Les blocs JSON-LD d'une page, decodes. */
function jsonld(src) {
  const out = [];
  for (const m of src.matchAll(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try { out.push(JSON.parse(m[1])); } catch { out.push(null); }
  }
  return out;
}

/** Le fil VISIBLE : [{ nom, href|null }], dans l'ordre lu. */
function filVisible(src) {
  const nav = /<nav class="breadcrumb"[^>]*>([\s\S]*?)<\/nav>/.exec(src);
  if (!nav) return null;
  const maillons = [];
  for (const m of nav[1].matchAll(
    /<a href="([^"]+)"[^>]*>([^<]+)<\/a>|<span class="breadcrumb-current">([^<]+)<\/span>/g
  )) {
    if (m[3] !== undefined) maillons.push({ nom: m[3].trim(), href: null });
    else maillons.push({ nom: m[2].trim(), href: m[1] });
  }
  return maillons;
}

/** Le canonical declare par une page -- l'URL qui fait autorite pour elle. */
function canonical(chemin) {
  const m = /<link rel="canonical" href="([^"]+)"/.exec(lire(chemin));
  return m ? m[1] : null;
}

const pagesAvecFil = pagesHtml()
  .map(rel)
  .filter((p) => /<nav class="breadcrumb"/.test(lire(p)))
  .sort();

describe("fil d'Ariane — le declare est le visible", () => {
  it("le perimetre n'est pas vide et couvre les deux langues", () => {
    // UN PLANCHER, PARCE QU'UNE ASSERTION QUI PASSE A VIDE EST LE DEFAUT QUE
    // CE DEPOT A TROUVE TROIS FOIS AUJOURD'HUI. Si le selecteur `nav.breadcrumb`
    // cessait de mordre -- classe renommee, balise changee -- toutes les
    // assertions ci-dessous passeraient en n'examinant rien.
    expect(pagesAvecFil.length).toBeGreaterThanOrEqual(24);
    expect(pagesAvecFil.filter((p) => p.startsWith("en/")).length).toBeGreaterThanOrEqual(12);
    expect(pagesAvecFil.filter((p) => !p.startsWith("en/")).length).toBeGreaterThanOrEqual(12);
  });

  it("chaque page a fil visible porte un BreadcrumbList", () => {
    let examines = 0;
    const sans = [];
    for (const p of pagesAvecFil) {
      examines++;
      const blocs = jsonld(lire(p));
      if (!blocs.some((b) => b && b["@type"] === "BreadcrumbList")) sans.push(p);
    }
    expect(sans, "Fil visible sans BreadcrumbList.").toEqual([]);
    expect(examines).toBe(pagesAvecFil.length);
  });

  it("chaque bloc respecte le contrat schema.org, pas seulement le notre", () => {
    // LES TROIS ASSERTIONS VOISINES COMPARENT LE DECLARE AU VISIBLE. Aucune ne
    // regarde si le bloc est un BreadcrumbList VALIDE : elles lisent `name`,
    // `position` et `item` sans jamais demander de quel type est le maillon
    // qui les porte. Mesure du 7 septembre 2026 -- en retirant le
    // « "@type": "ListItem" » du premier maillon de solutions/vins.html, les
    // huit assertions de ce fichier restaient VERTES. Or un maillon sans type
    // n'est pas un ListItem : Google rejette le bloc entier, sans un mot, et
    // rien ici ne l'aurait dit. C'est la meme famille que les gardes vides de
    // cette semaine -- un test qui lit un objet mal forme et le trouve
    // coherent avec lui-meme.
    //
    // CE QUE CE GARDE EST, ET CE QU'IL N'EST PAS. Il verifie la FORME contre le
    // contrat que Google documente pour BreadcrumbList. Il ne remplace pas le
    // Rich Results Test, qui rend un verdict sur la page servie et n'a pas
    // d'API publique : ce qui est verifie ici, c'est le JSON, pas le rendu.
    const ecarts = [];
    let maillons = 0;
    for (const p of pagesAvecFil) {
      const bl = jsonld(lire(p)).find((b) => b && b["@type"] === "BreadcrumbList");
      if (!bl) continue;                       // couvert par l'assertion d'avant
      if (bl["@context"] !== "https://schema.org")
        ecarts.push(`${p} : @context « ${bl["@context"]} », attendu https://schema.org`);
      if (!Array.isArray(bl.itemListElement)) {
        ecarts.push(`${p} : itemListElement n'est pas un tableau`);
        continue;
      }
      // Un fil a un seul maillon n'est pas un chemin : Google l'ignore.
      if (bl.itemListElement.length < 2)
        ecarts.push(`${p} : ${bl.itemListElement.length} maillon seulement`);
      bl.itemListElement.forEach((d, i) => {
        maillons++;
        if (d["@type"] !== "ListItem")
          ecarts.push(`${p} [${i + 1}] : @type « ${d["@type"]} », attendu ListItem`);
        if (!Number.isInteger(d.position))
          ecarts.push(`${p} [${i + 1}] : position « ${d.position} » n'est pas un entier`);
        if (typeof d.name !== "string" || !d.name.trim())
          ecarts.push(`${p} [${i + 1}] : name vide ou absent`);
        if ("item" in d && !/^https:\/\/\S+$/.test(d.item))
          ecarts.push(`${p} [${i + 1}] : item « ${d.item} » n'est pas une URL absolue`);
        // Une propriete hors contrat est le signe d'un champ invente : elle ne
        // casse rien, et elle n'est jamais lue.
        for (const k of Object.keys(d))
          if (!["@type", "position", "name", "item"].includes(k))
            ecarts.push(`${p} [${i + 1}] : propriete « ${k} » hors du contrat ListItem`);
      });
    }
    expect(ecarts, "BreadcrumbList mal forme -- ignore en silence par Google.").toEqual([]);
    // Le plancher porte sur les MAILLONS, pas sur les pages : une boucle qui
    // n'itererait sur rien laisserait `ecarts` vide et ce test au vert.
    expect(maillons).toBeGreaterThanOrEqual(24 * 2);
  });

  it("les maillons declares sont ceux du nav, dans l'ordre", () => {
    let examines = 0;
    const ecarts = [];
    for (const p of pagesAvecFil) {
      const src = lire(p);
      const bl = jsonld(src).find((b) => b && b["@type"] === "BreadcrumbList");
      if (!bl) continue;                       // couvert par l'assertion d'avant
      examines++;
      const visible = filVisible(src);
      const declare = bl.itemListElement || [];
      if (declare.length !== visible.length) {
        ecarts.push(`${p} : ${declare.length} maillons declares, ${visible.length} visibles`);
        continue;
      }
      visible.forEach((v, i) => {
        const d = declare[i];
        if (d.position !== i + 1) ecarts.push(`${p} : position ${d.position} au rang ${i + 1}`);
        if (d.name !== v.nom) ecarts.push(`${p} : « ${d.name} » declare, « ${v.nom} » affiche`);
      });
    }
    expect(ecarts, "Le fil declare ne correspond pas au fil affiche.").toEqual([]);
    expect(examines).toBe(pagesAvecFil.length);
  });

  it("chaque maillon cliquable pointe vers le canonical de sa cible", () => {
    // LE `item` N'EST PAS RECONSTRUIT DEPUIS LE CHEMIN : il doit valoir ce que
    // la page CIBLE declare comme son adresse. Deux conventions coexistent
    // (« https://heurix.fr/ » pour l'accueil FR, le chemin complet ailleurs) ;
    // les deviner ici les figerait a l'insu de canonical.test.js.
    let examines = 0;
    const ecarts = [];
    for (const p of pagesAvecFil) {
      const src = lire(p);
      const bl = jsonld(src).find((b) => b && b["@type"] === "BreadcrumbList");
      if (!bl) continue;
      const visible = filVisible(src);
      (bl.itemListElement || []).forEach((d, i) => {
        const v = visible[i];
        if (!v) return;
        if (v.href === null) {
          examines++;
          if ("item" in d) ecarts.push(`${p} : le maillon courant « ${d.name} » ne doit pas porter d'item`);
          return;
        }
        examines++;
        const cible = path.normalize(path.join(path.dirname(p), v.href.split("#")[0]))
          .split(path.sep).join("/");
        const attendu = canonical(cible);
        if (!attendu) ecarts.push(`${p} : la cible ${cible} ne declare aucun canonical`);
        else if (d.item !== attendu)
          ecarts.push(`${p} : item « ${d.item} » alors que ${cible} declare « ${attendu} »`);
      });
    }
    expect(ecarts, "Maillon dont l'URL n'est pas le canonical de sa cible.").toEqual([]);
    expect(examines).toBeGreaterThanOrEqual(24 * 2);
  });
});

// ---------------------------------------------------------------------------
// LE SCHEMA PRODUIT EXISTE DANS LES DEUX LANGUES, ET SES PRIX SUIVENT LE CODE.
//
// index.html portait un `SoftwareApplication` ; en/index.html n'en avait
// aucun. La home anglaise ne declarait donc aucune offre.
//
// CE QUE CE GARDE NE VOIT PAS, ET IL FAUT LE LIRE AVANT DE LUI FAIRE
// CONFIANCE : les montants reels vivent chez Stripe, pas ici.
// `heurix/billing.py` ne connait que des `price_...` passes en variables
// d'environnement, et son propre docstring dit pourquoi : « pour ne jamais
// avoir a toucher au code quand un prix change ». Un prix modifie dans le
// Dashboard Stripe ne casse RIEN ici et ne laisse aucune trace.
//
// Ce test compare donc les schemas a `billing-toggle.js`, c'est-a-dire une
// copie a une autre copie. **Il mesure la coherence, jamais la justesse.**
// C'est un gain reel -- avant lui, rien ne reliait le schema au code, et un
// changement de PLANS laissait le JSON-LD mentir en silence -- mais c'est
// une garantie partielle, et c'est pour cela qu'elle est ecrite ici.
//
// C'EST AUSSI LA RAISON POUR LAQUELLE `pricing.html` NE RECOIT PAS D'`Offer`
// par plan, et ce paragraphe existe pour qu'on ne le « comble » pas plus tard
// en croyant reparer un oubli. Le depot porte deja trois copies en dur de
// 19/49/139 -- les `<span>` de pricing.html, son tableau TIERS, et PLANS --
// qui s'accordent sans que rien ne l'impose. Une quatrieme copie serait la
// seule AFFICHEE PAR GOOGLE, et un prix perime dans un resultat enrichi est
// pire qu'un prix absent : il se lit comme une promesse.
// ---------------------------------------------------------------------------

/** Les prix des plans, lus a leur source dans le depot. */
function plansDuCode() {
  const src = lire("billing-toggle.js");
  const m = /var PLANS = \{([^}]*)\}/.exec(src);
  if (!m) return null;
  const prix = [...m[1].matchAll(/(\w+)\s*:\s*(\d+)/g)].map((x) => Number(x[2]));
  return prix.length ? prix : null;
}

const HOMES = ["index.html", "en/index.html"];

describe("schema produit — present dans les deux langues, aligne sur le code", () => {
  it("les deux accueils portent un SoftwareApplication", () => {
    let examines = 0;
    const sans = [];
    for (const p of HOMES) {
      examines++;
      if (!jsonld(lire(p)).some((b) => b && b["@type"] === "SoftwareApplication")) sans.push(p);
    }
    expect(sans, "Accueil sans schema produit.").toEqual([]);
    expect(examines).toBe(2);
  });

  it("seule la description differe entre les deux langues", () => {
    const [fr, en] = HOMES.map((p) =>
      jsonld(lire(p)).find((b) => b && b["@type"] === "SoftwareApplication")
    );
    expect(fr && en, "Un des deux blocs manque.").toBeTruthy();
    // `url` suit la langue (pointeur de page), `description` est traduite.
    // TOUT LE RESTE est identique -- une traduction, pas une reecriture.
    for (const champ of ["name", "applicationCategory", "operatingSystem"])
      expect(en[champ], `${champ} ne doit pas changer d'une langue a l'autre`).toBe(fr[champ]);
    expect(JSON.stringify(en.offers)).toBe(JSON.stringify(fr.offers));
    expect(JSON.stringify(en.provider)).toBe(JSON.stringify(fr.provider));
    // CETTE ASSERTION N'ATTRAPE QUE LA COPIE VERBATIM, et c'est mesure : une
    // description a moitie traduite lui echappe (mutation du 4 septembre 2026,
    // passee au vert). Aucun test ne sait dire « ce texte est en anglais » ;
    // celui-ci ferme le seul cas mecanique -- le bloc FR duplique tel quel,
    // qui est la forme que prend l'oubli quand on copie la voisine.
    expect(en.description, "la description doit etre traduite").not.toBe(fr.description);
    expect(fr.url).toBe("https://heurix.fr/pricing.html");
    expect(en.url).toBe("https://heurix.fr/en/pricing.html");
  });

  it("l'AggregateOffer reflete PLANS de billing-toggle.js", () => {
    const prix = plansDuCode();
    expect(prix, "PLANS introuvable dans billing-toggle.js").toBeTruthy();
    let examines = 0;
    for (const p of HOMES) {
      const b = jsonld(lire(p)).find((x) => x && x["@type"] === "SoftwareApplication");
      if (!b) continue;
      examines++;
      const o = b.offers;
      expect(Number(o.lowPrice), `${p} : lowPrice`).toBe(Math.min(...prix));
      expect(Number(o.highPrice), `${p} : highPrice`).toBe(Math.max(...prix));
      expect(Number(o.offerCount), `${p} : offerCount`).toBe(prix.length);
      expect(o.priceCurrency).toBe("EUR");
    }
    expect(examines).toBe(2);
  });

  it("aucune page ne declare d'Offer par plan", () => {
    // Le refus est verifie, pas seulement documente : sans cette assertion,
    // la decision ne survit qu'en commentaire.
    const fautives = [];
    for (const abs of pagesHtml()) {
      const p = rel(abs);
      for (const b of jsonld(lire(p))) {
        const types = JSON.stringify(b);
        if (b && /"@type"\s*:\s*"Offer"/.test(types)) fautives.push(p);
      }
    }
    expect(
      fautives,
      "Un `Offer` par plan ecrit en dur : les montants vivent chez Stripe, " +
        "voir le pave au-dessus de ce bloc."
    ).toEqual([]);
  });
});
