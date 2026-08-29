/* Heurix.browsePanel — grille et pagination (etape 1).
 *
 * Le contrat de Heurix.browse a son propre fichier
 * (heurix-browse-contrat.test.js) et n'est pas retouche ici : les deux
 * points d'entree vivent dans le meme fichier livrable mais ne partagent
 * aucun chemin d'execution.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-browse-widget.js"), "utf8");

const TOTAL = 1987; // le vrai rayon visserie de quincaillerie-nord

function fiches(n, offset = 0) {
  return Array.from({ length: n }, (_, i) => ({
    product: { id: "REF-" + (offset + i), name: "Vis M8 n" + (offset + i), price: 1.5 + i },
    in_stock: (offset + i) % 7 !== 0,
  }));
}

function charger({ lang = "fr", total = TOTAL, echec = null } = {}) {
  const dom = new JSDOM(`<!doctype html><html lang="${lang}"><body><div id="c"></div></body></html>`,
    { url: "http://localhost/" });
  const appels = [];
  const faux = async (url) => {
    appels.push(String(url));
    if (echec) return { ok: false, status: echec, json: async () => ({ detail: "non" }) };
    const u = new URL(String(url));
    const limit = Number(u.searchParams.get("limit"));
    const offset = Number(u.searchParams.get("offset"));
    const reste = Math.max(0, Math.min(limit, total - offset));
    return { ok: true, status: 200,
             json: async () => ({ category: "visserie", sort: "stock", total,
                                  offset, limit, hits: fiches(reste, offset) }) };
  };
  global.window = dom.window; global.document = dom.window.document;
  global.fetch = faux; dom.window.fetch = faux;
  dom.window.eval(SOURCE);
  return { win: dom.window, doc: dom.window.document, appels };
}

const BASE = { apiKey: "hxp_t", catalog: "quincaillerie-nord", category: "visserie", containerId: "c" };
const souffle = () => new Promise((r) => setTimeout(r, 25));

let alertes;
beforeEach(() => { alertes = []; global.console = { ...console, warn: (m) => alertes.push(m), error: () => {} }; });

function boutons(doc) {
  return [...doc.querySelectorAll(".hx-rayon-pg")].map((b) => ({
    txt: b.textContent, page: b.getAttribute("data-page"),
    courant: b.getAttribute("aria-current") === "page", off: b.disabled,
  }));
}

// ---------------------------------------------------------------------------
describe("browsePanel — les options requises", () => {
  it("jette sur chaque option manquante, contrairement a Heurix.browse", () => {
    const { win } = charger();
    const api = win.Heurix;
    expect(() => api.browsePanel({})).toThrow(/apiKey/);
    expect(() => api.browsePanel({ apiKey: "hxp_t" })).toThrow(/catalog/);
    expect(() => api.browsePanel({ apiKey: "hxp_t", catalog: "c" })).toThrow(/category/);
    expect(() => api.browsePanel({ apiKey: "hxp_t", catalog: "c", category: "v" })).toThrow(/containerId/);
    expect(() => api.browsePanel({ ...BASE, containerId: "absent" })).toThrow(/absent/);
  });

  it("avertit sur une cle serveur, comme les deux autres widgets", async () => {
    const { win } = charger();
    win.Heurix.browsePanel({ ...BASE, apiKey: "hx_serveur" });
    await souffle();
    expect(alertes.join(" ")).toContain("cle SERVEUR");
  });
});

// ---------------------------------------------------------------------------
describe("browsePanel — la grille", () => {
  it("affiche une page de 24 fiches sur les 1 987 du rayon", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelectorAll(".heurix-product")).toHaveLength(24);
  });

  it("annonce le TOTAL du rayon, pas la taille de la page", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const t = doc.querySelector(".hx-rayon-compte").textContent;
    expect(t).toContain("1 987");   // espace fine insecable
    expect(t).toContain("références");
    expect(t).toContain("Page 1 sur 83");
  });

  it("annonce en anglais sur une page lang=en, sans parametre", async () => {
    const { win, doc } = charger({ lang: "en" });
    win.Heurix.browsePanel(BASE);
    await souffle();
    const t = doc.querySelector(".hx-rayon-compte").textContent;
    expect(t).toContain("1,987");
    expect(t).toContain("references");
    expect(t).toContain("Page 1 of 83");
  });

  it("le compte est une region live, pour que le changement de page s'annonce", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const c = doc.querySelector(".hx-rayon-compte");
    expect(c.getAttribute("aria-live")).toBe("polite");
    expect(c.getAttribute("role")).toBe("status");
  });

  it("respecte un renderItem fourni, avec (hit, index, lang)", async () => {
    const { win, doc } = charger({ lang: "en" });
    const vus = [];
    win.Heurix.browsePanel({ ...BASE, renderItem: (h, i, l) => { vus.push([h.product.id, i, l]); return `<li>${h.product.id}</li>`; } });
    await souffle();
    expect(vus[0]).toEqual(["REF-0", 0, "en"]);
    expect(doc.querySelectorAll(".hx-rayon-grille li")).toHaveLength(24);
  });

  it("un rayon vide le dit, et ne montre aucune pagination", async () => {
    const { win, doc } = charger({ total: 0 });
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelector(".hx-rayon-etat").textContent).toContain("Aucun produit");
    expect(doc.querySelector(".hx-rayon-pagination").hidden).toBe(true);
  });

  it("une erreur HTTP dit qu'il y a une erreur, PAS que le rayon est vide", async () => {
    // Le defaut verrouille sur Heurix.browse (res.ok non verifie) n'est
    // pas reconduit : une 403 de cle invalide ne doit pas se lire
    // « Aucun produit dans ce rayon ».
    const { win, doc } = charger({ echec: 403 });
    win.Heurix.browsePanel(BASE);
    await souffle();
    const t = doc.querySelector(".hx-rayon-etat").textContent;
    expect(t).toContain("indisponible");
    expect(t).not.toContain("Aucun produit");
  });
});

// ---------------------------------------------------------------------------
describe("browsePanel — la pagination", () => {
  it("calcule 83 pages de 24 sur 1 987 references", async () => {
    const { win } = charger();
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    // getState s'est enrichi a l'etape 2 (filters, multiSelect) : on
    // verifie les champs de pagination, pas la forme entiere de l'objet.
    expect(p.getState()).toMatchObject({ page: 1, totalPages: 83, perPage: 24 });
  });

  it("plafonne limit au maximum du moteur (100)", async () => {
    const { win, appels } = charger();
    win.Heurix.browsePanel({ ...BASE, limit: 500 });
    await souffle();
    expect(appels[0]).toContain("limit=100");
  });

  it("demande le bon offset a chaque page", async () => {
    const { win, appels } = charger();
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    await p.goToPage(3);
    await souffle();
    expect(appels.at(-1)).toContain("offset=48");
    expect(appels.at(-1)).toContain("limit=24");
  });

  it("desactive Precedent sur la premiere page et Suivant sur la derniere", async () => {
    const { win, doc } = charger();
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    let b = boutons(doc);
    expect(b[0].txt).toBe("Précédent");
    expect(b[0].off).toBe(true);
    expect(b.at(-1).off).toBe(false);
    await p.goToPage(83); await souffle();
    b = boutons(doc);
    expect(b[0].off).toBe(false);
    expect(b.at(-1).txt).toBe("Suivant");
    expect(b.at(-1).off).toBe(true);
  });

  it("marque la page courante avec aria-current, une seule fois", async () => {
    const { win, doc } = charger();
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    await p.goToPage(5); await souffle();
    const courants = boutons(doc).filter((x) => x.courant);
    expect(courants).toHaveLength(1);
    expect(courants[0].txt).toBe("5");
  });

  it("garde une fenetre de largeur constante, avec des sauts aux extremites", async () => {
    const { win, doc } = charger();
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    const nums = () => [...doc.querySelectorAll(".hx-rayon-pg[data-page]")]
      .map((b) => b.textContent).filter((t) => /^\d+$/.test(t));
    expect(nums()).toEqual(["1", "2", "3", "4", "83"]);
    await p.goToPage(40); await souffle();
    expect(nums()).toEqual(["1", "39", "40", "41", "83"]);
    await p.goToPage(83); await souffle();
    expect(nums()).toEqual(["1", "80", "81", "82", "83"]);
    // le saut est decoratif : jamais annonce
    expect(doc.querySelector(".hx-rayon-saut").getAttribute("aria-hidden")).toBe("true");
  });

  it("un clic sur un numero charge cette page", async () => {
    const { win, doc, appels } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const b3 = [...doc.querySelectorAll(".hx-rayon-pg")].find((x) => x.textContent === "3");
    b3.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await souffle();
    expect(appels.at(-1)).toContain("offset=48");
  });

  it("ignore un clic sur la page deja affichee : pas de requete inutile", async () => {
    const { win, doc, appels } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const n = appels.length;
    doc.querySelector('.hx-rayon-pg[aria-current="page"]')
       .dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await souffle();
    expect(appels).toHaveLength(n);
  });

  it("la pagination est une nav nommee, atteignable au clavier", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const nav = doc.querySelector("nav.hx-rayon-pagination");
    expect(nav.getAttribute("aria-label")).toBe("Pagination des résultats");
    // De vrais <button> : Tab les atteint et Entree/Espace les active
    // nativement, sans code a nous. Aucun div[role=button], aucun
    // tabindex pose a la main.
    const pg = [...doc.querySelectorAll(".hx-rayon-pg")];
    expect(pg.every((b) => b.tagName === "BUTTON")).toBe(true);
    expect(pg.every((b) => !b.hasAttribute("tabindex"))).toBe(true);
    expect(pg.every((b) => b.getAttribute("type") === "button")).toBe(true);
  });

  it("N'INSTALLE AUCUN ECOUTEUR CLAVIER : Espace et Entree restent natifs", async () => {
    /* CE QUE CE TEST VERIFIE, ET CE QU'IL NE PEUT PAS VERIFIER.
     *
     * L'activation d'un <button> par Espace et Entree est le travail du
     * NAVIGATEUR. Elle n'a pas ete verifiable a l'ecran le 29 aout 2026 :
     * l'outil de pilotage livre bien un keydown et un keyup, mais avec
     * `key` et `code` VIDES -- mesure directe, un ecouteur pose sur le
     * document rend « keydown:|code= ». Ni Espace ni Entree n'arrivent
     * identifiables, donc le navigateur ne declenche aucune activation, et
     * l'echec observe ne dit rien du widget. Verifie en croisant : Entree
     * echoue exactement pareil, alors qu'un .click() programmatique sur le
     * meme bouton change bien de page.
     *
     * On teste donc CE QUE CE CODE POURRAIT CASSER, et rien d'autre. Quatre
     * facons de casser l'activation native d'un bouton :
     *   1. ne pas employer <button> (div + role="button") -> teste plus haut
     *   2. poser un tabindex                              -> teste plus haut
     *   3. omettre type="button" (Entree soumettrait un formulaire englobant)
     *                                                     -> teste plus haut
     *   4. intercepter la touche et l'annuler             -> ICI
     *
     * Aucun ecouteur clavier n'est pose : il n'y a donc rien qui puisse
     * appeler preventDefault sur Espace.
     */
    const { win, doc } = charger();
    const types = [];
    const vrai = win.EventTarget.prototype.addEventListener;
    win.EventTarget.prototype.addEventListener = function (t) {
      types.push(t);
      return vrai.apply(this, arguments);
    };
    win.Heurix.browsePanel(BASE);
    await souffle();
    win.EventTarget.prototype.addEventListener = vrai;
    expect(types.filter((t) => /^key/.test(t))).toEqual([]);
    // et le bouton n'est pas dans un formulaire qu'Entree pourrait soumettre
    expect(doc.querySelector(".hx-rayon-pg").closest("form")).toBe(null);
  });

  it("chaque numero porte un libelle lisible hors contexte", async () => {
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const b = [...doc.querySelectorAll(".hx-rayon-pg")].find((x) => x.textContent === "2");
    expect(b.getAttribute("aria-label")).toBe("Aller à la page 2");
  });

  it("garde le focus sur Suivant tant qu'il reste actionnable", async () => {
    const { win, doc } = charger();
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    await p.goToPage(40); await souffle();
    const suivant = doc.querySelector('[data-nav="suiv"]');
    suivant.focus();
    suivant.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await souffle();
    expect(doc.activeElement.getAttribute("data-nav")).toBe("suiv");
  });

  it("LE FOCUS NE TOMBE PAS quand le bouton clique devient desactive", async () => {
    // Sur l'avant-derniere page, cliquer Suivant detruit le bouton
    // focalise et le recree desactive : sans reprise, le focus retombe
    // sur <body> et un utilisateur au clavier repart du haut du document.
    // Il se replie sur le numero de la page courante, qui existe toujours.
    const { win, doc } = charger();
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    await p.goToPage(82); await souffle();
    const suivant = doc.querySelector('[data-nav="suiv"]');
    suivant.focus();
    suivant.dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await souffle();
    expect(doc.activeElement).not.toBe(doc.body);
    expect(doc.activeElement.getAttribute("aria-current")).toBe("page");
    expect(doc.activeElement.textContent).toBe("83");
  });

  it("une seule page : aucune pagination affichee", async () => {
    const { win, doc } = charger({ total: 12 });
    win.Heurix.browsePanel(BASE);
    await souffle();
    expect(doc.querySelector(".hx-rayon-pagination").hidden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("browsePanel — cloisonnement d'avec Heurix.browse", () => {
  it("les styles injectes sont TOUS prefixes .hx-rayon", async () => {
    // Une page qui charge ce fichier et n'appelle que Heurix.browse ne
    // doit voir aucun style s'appliquer -- or la balise <style> est
    // globale. Le prefixe est ce qui rend ce cloisonnement vrai.
    const { win, doc } = charger();
    win.Heurix.browsePanel(BASE);
    await souffle();
    const css = doc.querySelector("style[data-heurix-rayon]").textContent;
    const regles = css.split("\n").filter((l) => l.trim() && !l.trim().startsWith("@") && !l.trim().startsWith("}"));
    const fautives = regles.filter((l) => !l.includes(".hx-rayon"));
    expect(fautives).toEqual([]);
  });

  it("n'injecte la feuille qu'une fois, meme avec deux rayons sur la page", async () => {
    const { win, doc } = charger();
    doc.body.insertAdjacentHTML("beforeend", '<div id="c2"></div>');
    win.Heurix.browsePanel(BASE);
    win.Heurix.browsePanel({ ...BASE, containerId: "c2" });
    await souffle();
    expect(doc.querySelectorAll("style[data-heurix-rayon]")).toHaveLength(1);
  });

  it("deux rayons sur une page ne collisionnent pas d'identifiants", async () => {
    const { win, doc } = charger();
    doc.body.insertAdjacentHTML("beforeend", '<div id="c2"></div>');
    win.Heurix.browsePanel(BASE);
    win.Heurix.browsePanel({ ...BASE, containerId: "c2" });
    await souffle();
    const ids = [...doc.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("destroy() rend le conteneur a son etat d'origine", async () => {
    const { win, doc } = charger();
    const p = win.Heurix.browsePanel(BASE);
    await souffle();
    p.destroy();
    const c = doc.getElementById("c");
    expect(c.innerHTML).toBe("");
    expect(c.className).toBe("");
  });
});
