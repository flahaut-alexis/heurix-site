/*
 * CE QUI RESTE APRES 2b4664d0.
 *
 * Ce lot-la a durci `browsePanel` : delai d'attente, classification,
 * coupe-circuit, repli. Il a laisse `Heurix.browse` avec le seul diagnostic
 * en console, et l'a ecrit en clair -- « ce chemin ne recoit que le
 * diagnostic, et c'est une decision, pas un oubli », au motif que 35 tests
 * de caracterisation le verrouillent et que le fichier s'heberge chez le
 * marchand sans jamais se mettre a jour.
 *
 * L'ARGUMENT DE NON-REGRESSION EST JUSTE, ET IL NE COUVRE QUE LA MOITIE DU
 * PROBLEME. Il protege le CONTRAT -- la valeur rendue, le nombre d'appels,
 * le rejet. Il ne dit rien de ce que le VISITEUR lit. Or sur un 403,
 * `data.hits` est absent et le fichier ecrit `TEXTES[lang].vide` :
 *
 *     « Aucun produit dans cette catégorie. »
 *
 * Une panne de catalogue deguisee en rayon vide, sur le point d'entree que
 * le guide publie enseigne -- et sans erreur du tout, donc invisible pour le
 * marchand jusqu'a ce qu'un client le signale.
 *
 * D'OU LA VOIE MOYENNE QUE CE FICHIER VERROUILLE : la promesse continue de
 * SE RESOUDRE, exactement comme avant, et seul l'affichage change. Le
 * contrat verrouille reste intact ; le mensonge disparait. Un `.then(render)`
 * sans `.catch` chez un marchand ne devient pas une erreur non capturee.
 *
 * NOMS REPRIS DE 2b4664d0 -- `.hx-rayon-reessayer`, `RAYON_TIMEOUT_MS`.
 * Deux conventions pour une chose coutent plus cher qu'une convention
 * imparfaite.
 */
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-browse-widget.js"), "utf8");

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

function erreurAbandon() {
  const e = new Error("The operation was aborted.");
  e.name = "AbortError";
  return e;
}

/* Le bouchon honore `signal`. Sans cela il montrerait le correctif inoperant
 * -- le minuteur appelle abort(), mais rien n'ecoute, donc la promesse ne
 * rejette jamais. Regle deja payee deux fois ce week-end, dans les deux sens.
 */
function apiQuiPend() {
  return (url, opts) =>
    new Promise((_, rejeter) => {
      const s = opts && opts.signal;
      if (!s) return;
      if (s.aborted) return rejeter(erreurAbandon());
      s.addEventListener("abort", () => rejeter(erreurAbandon()));
    });
}

const apiQuiRefuse = (statut, detail) => async () => ({
  ok: false, status: statut, json: async () => ({ detail }),
});

function reponse(total, page = 0) {
  return {
    category: "visserie", sort: "stock", total, offset: page * 24, limit: 24,
    hits: Array.from({ length: 24 }, (_, i) => ({
      product: { id: "REF-" + page + "-" + i, name: "Vis " + i, price: 2 },
      in_stock: true,
    })),
  };
}

function monter(fetchImpl) {
  const dom = new JSDOM('<!doctype html><html lang="fr"><body><div id="c"></div></body></html>',
    { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;

  let appels = 0;
  const faux = (...a) => { appels++; return fetchImpl(...a); };
  global.fetch = faux;
  dom.window.fetch = faux;

  const journal = [];
  const cap = (n) => (m) => journal.push({ niveau: n, message: String(m) });
  dom.window.console.warn = cap("warn");
  dom.window.console.error = cap("error");
  global.console = { ...console, warn: cap("warn"), error: cap("error") };

  dom.window.eval(SOURCE);
  const doc = dom.window.document;
  return {
    doc, win: dom.window, journal,
    api: dom.window.Heurix ?? global.Heurix,
    appels: () => appels,
    cible: () => (doc.getElementById("c").textContent || "").replace(/\s+/g, " ").trim(),
  };
}

const BASE = { apiKey: "hxp_t", catalog: "quincaillerie-nord", category: "visserie" };

// ===========================================================================
describe("1. Heurix.browse -- une panne ne se deguise plus en rayon vide", () => {
  it("un 403 n'affiche PAS « Aucun produit », et la promesse SE RESOUT quand meme", async () => {
    // LE COEUR DU LOT. Les deux assertions vont ensemble et disent la voie
    // moyenne : le visiteur cesse d'etre trompe, l'appelant ne casse pas.
    const ctx = monter(apiQuiRefuse(403, "Origine 'x.fr' non autorisée pour cette clé publique"));
    const rendu = await ctx.api.browse({ ...BASE, containerId: "c" });

    expect(ctx.cible(), "une panne lue comme un catalogue vide").not.toContain("Aucun produit");
    expect(ctx.cible()).toContain("indisponible");
    // Le contrat verrouille par les 35 tests de caracterisation : resout.
    expect(rendu, "la promesse doit continuer de se resoudre").toBeTruthy();
  });

  it("TEMOIN NEGATIF : un vrai rayon vide dit toujours « Aucun produit »", async () => {
    // Sans ce cas, « la cible ne contient pas Aucun produit » serait vrai par
    // construction -- il suffirait de ne plus jamais ecrire cette phrase.
    const vide = async () => ({ ok: true, status: 200,
      json: async () => ({ category: "visserie", total: 0, hits: [] }) });
    const ctx = monter(vide);
    await ctx.api.browse({ ...BASE, containerId: "c" });
    expect(ctx.cible()).toContain("Aucun produit");
    expect(ctx.cible()).not.toContain("indisponible");
  });

  it("emptyMessage reste respecte sur un VRAI vide, et ignore sur une panne", async () => {
    // L'option est publiee : un marchand qui l'a posee a choisi son texte
    // pour un rayon vide. Elle ne doit pas se retrouver a masquer une panne.
    const vide = async () => ({ ok: true, status: 200,
      json: async () => ({ category: "visserie", total: 0, hits: [] }) });
    const ctxVide = monter(vide);
    await ctxVide.api.browse({ ...BASE, containerId: "c", emptyMessage: "<p>Rayon vide</p>" });
    expect(ctxVide.cible()).toBe("Rayon vide");

    const ctxPanne = monter(apiQuiRefuse(500, "boom"));
    await ctxPanne.api.browse({ ...BASE, containerId: "c", emptyMessage: "<p>Rayon vide</p>" });
    expect(ctxPanne.cible(), "emptyMessage masquerait la panne").not.toBe("Rayon vide");
  });
});

describe("2. Heurix.browse -- un delai d'attente, comme browsePanel", () => {
  it("une API qui pend ne laisse pas la promesse en suspens indefiniment", async () => {
    const ctx = monter(apiQuiPend());
    let regle = false;
    ctx.api.browse({ ...BASE, containerId: "c", timeoutMs: 50 })
      .then(() => { regle = true; }, () => { regle = true; });
    await attendre(400);
    expect(regle, "aucun delai d'attente : le marchand n'a aucune reprise").toBe(true);
  });

  it("le visiteur voit l'etat de panne, pas un conteneur reste vide", async () => {
    const ctx = monter(apiQuiPend());
    await ctx.api.browse({ ...BASE, containerId: "c", timeoutMs: 50 }).catch(() => {});
    await attendre(120);
    expect(ctx.cible()).toContain("indisponible");
  });

  it("le defaut est RAYON_TIMEOUT_MS, partage avec browsePanel", () => {
    // Mesure de 2b4664d0, reprise plutot que refaite : 30 appels browse en
    // production, max 2,105 s, contre 0,814 s pour la recherche. Ce n'est pas
    // la meme population, et un declenchement a tort coute le rayon entier
    // plus 60 s de pause. Un seul reglage pour les deux points d'entree.
    expect(SOURCE).toMatch(/var RAYON_TIMEOUT_MS = 5000;/);
  });
});

describe("3. Heurix.browse -- le coupe-circuit vaut aussi ici", () => {
  it("apres une panne TRANSITOIRE, l'appel suivant ne repart pas sur le reseau", async () => {
    const ctx = monter(apiQuiRefuse(500, "boom"));
    await ctx.api.browse({ ...BASE, containerId: "c" }).catch(() => {});
    const apresPremier = ctx.appels();
    await ctx.api.browse({ ...BASE, containerId: "c" }).catch(() => {});
    expect(ctx.appels(), "chaque geste du visiteur repaie le delai").toBe(apresPremier);
  });

  it("UN 429 NE MET PAS EN PAUSE -- la regle du chantier I1 vaut sur les deux chemins", async () => {
    const ctx = monter(apiQuiRefuse(429, "quota"));
    await ctx.api.browse({ ...BASE, containerId: "c" }).catch(() => {});
    const apresPremier = ctx.appels();
    await ctx.api.browse({ ...BASE, containerId: "c" }).catch(() => {});
    expect(ctx.appels(), "un quota ne se repare pas en 60 s").toBeGreaterThan(apresPremier);
  });
});

describe("4. browsePanel -- une panne ne detruit pas ce qui est affiche", () => {
  it("UNE PANNE EN PAGE 2 GARDE LES PRODUITS ET LA PAGINATION", async () => {
    // `montrerEchec` ecrase la grille et masque la pagination SANS CONDITION.
    // Le visiteur qui clique « page 2 » pendant une panne perd donc les 24
    // produits qu'il avait sous les yeux ET le moyen d'y revenir -- il perd
    // ce qu'il avait, pas seulement ce qu'il demandait.
    let enPanne = false;
    const ctx = monter(async () =>
      enPanne
        ? { ok: false, status: 500, json: async () => ({ detail: "boom" }) }
        : { ok: true, status: 200, json: async () => reponse(200, 0) });

    ctx.api.browsePanel({ ...BASE, containerId: "c", timeoutMs: 50 });
    await attendre(200);
    const avant = ctx.doc.querySelectorAll(".heurix-product").length;
    expect(avant, "le premier chargement doit reussir").toBeGreaterThan(0);

    enPanne = true;
    const suivant = ctx.doc.querySelector('.hx-rayon-pg[data-nav="suiv"], .hx-rayon-pg[data-page="2"]');
    expect(suivant, "la pagination doit exister apres un chargement reussi").toBeTruthy();
    suivant.dispatchEvent(new ctx.win.MouseEvent("click", { bubbles: true }));
    await attendre(250);

    expect(
      ctx.doc.querySelectorAll(".heurix-product").length,
      "les produits deja affiches ont ete detruits par une panne de page suivante"
    ).toBe(avant);
    expect(
      ctx.doc.querySelector(".hx-rayon-pagination").hidden,
      "la pagination a disparu : le visiteur ne peut plus revenir en arriere"
    ).toBe(false);
    expect(ctx.doc.querySelector(".hx-rayon-reessayer"), "et il garde un geste").toBeTruthy();
  });

  it("LE COMPTE NE MENT PAS AU-DESSUS D'UNE GRILLE PLEINE", async () => {
    // ECRIT APRES LA CAPTURE, PAS AVANT. Les 749 tests etaient verts pendant
    // que l'ecran montrait « Rayon indisponible pour le moment. » en tete
    // d'une grille de 24 produits bien presents -- deux etats contradictoires
    // cote a cote. Aucune assertion ne comparait le compte a ce que la grille
    // contenait : chacun etait juste separement.
    //
    // Et le compte detruit etait ENCORE VRAI. Les 200 references existent
    // toujours ; c'est la page 2 qui manque. Une panne partielle ne doit pas
    // effacer l'information qui a survecu.
    let enPanne = false;
    const ctx = monter(async () =>
      enPanne
        ? { ok: false, status: 500, json: async () => ({ detail: "boom" }) }
        : { ok: true, status: 200, json: async () => reponse(200, 0) });
    ctx.api.browsePanel({ ...BASE, containerId: "c", timeoutMs: 50 });
    await attendre(200);
    const compteAvant = ctx.doc.querySelector(".hx-rayon-compte").textContent.trim();
    expect(compteAvant).toMatch(/200/);

    enPanne = true;
    const suivant = ctx.doc.querySelector('.hx-rayon-pg[data-nav="suiv"], .hx-rayon-pg[data-page="2"]');
    suivant.dispatchEvent(new ctx.win.MouseEvent("click", { bubbles: true }));
    await attendre(250);

    expect(
      ctx.doc.querySelector(".hx-rayon-compte").textContent.trim(),
      "le compte a ete ecrase alors qu'il restait juste"
    ).toBe(compteAvant);
    // Et la phrase doit vivre quelque part, sinon « ne pas ecraser le compte »
    // se satisferait en n'annoncant rien du tout.
    const bandeau = ctx.doc.querySelector(".hx-rayon-panne-zone");
    expect(bandeau, "le bandeau doit exister").toBeTruthy();
    expect(bandeau.textContent).toContain("indisponible");
    expect(bandeau.getAttribute("role"), "il porte l'annonce a la place du compte").toBe("status");
  });

  it("TEMOIN NEGATIF : au PREMIER chargement, la grille porte bien le message", async () => {
    // Rien a preserver ici, donc l'inverse est attendu -- et c'est ce que
    // verrouille deja tests/heurix-rayon-grille.test.js. Sans ce cas, « ne
    // rien detruire » pourrait etre satisfait en n'affichant jamais rien.
    const ctx = monter(apiQuiRefuse(500, "boom"));
    ctx.api.browsePanel({ ...BASE, containerId: "c", timeoutMs: 50 });
    await attendre(200);
    const ecran = ctx.cible();
    expect(ecran).toContain("indisponible");
    expect(ctx.doc.querySelector(".hx-rayon-reessayer")).toBeTruthy();
  });
});
