import { describe, it, expect, beforeAll } from "vitest";
import { JSDOM } from "jsdom";

// DOMParser n'existe pas nativement sous Node — on l'emprunte à jsdom,
// exactement comme le ferait un vrai navigateur au moment de l'exécution.
beforeAll(() => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  global.DOMParser = dom.window.DOMParser;
});

const {
  detecterRacineItems, champsDisponibles, proposerCorrespondanceXml,
  extraireValeur, convertirXml,
} = await import("../xml-import.js");

describe("détection de l'élément qui se répète", () => {
  it("trouve l'élément le plus répété sous un même parent", () => {
    const xml = `<catalogue><produit>A</produit><produit>B</produit><produit>C</produit></catalogue>`;
    const { chemin, elements } = detecterRacineItems(xml);
    expect(chemin).toBe("produit");
    expect(elements.length).toBe(3);
  });

  it("ignore le préfixe d'espace de noms (flux Google Shopping)", () => {
    const xml = `<rss xmlns:g="http://base.google.com/ns/1.0"><channel><item><g:id>1</g:id></item><item><g:id>2</g:id></item></channel></rss>`;
    const { chemin, elements } = detecterRacineItems(xml);
    expect(chemin).toBe("item");
    expect(elements.length).toBe(2);
  });

  it("renvoie chemin null sur un XML sans structure répétée", () => {
    const { chemin, elements } = detecterRacineItems("<vide></vide>");
    expect(chemin).toBeNull();
    expect(elements.length).toBe(0);
  });

  it("renvoie chemin null sur un XML mal formé, sans lever d'exception", () => {
    expect(() => detecterRacineItems("<catalogue><produit>pas fermé")).not.toThrow();
    const { chemin } = detecterRacineItems("<catalogue><produit>pas fermé");
    expect(chemin).toBeNull();
  });
});

describe("champs disponibles", () => {
  it("liste les enfants directs ET les attributs de l'élément racine", () => {
    const xml = `<catalogue><produit id="1" ref="V1"><nom>Vis</nom><prix>1.2</prix></produit><produit id="2" ref="V2"><nom>Ecrou</nom><prix>0.3</prix></produit></catalogue>`;
    const { elements } = detecterRacineItems(xml);
    const champs = champsDisponibles(elements);
    expect(champs).toContain("@id");
    expect(champs).toContain("@ref");
    expect(champs).toContain("nom");
    expect(champs).toContain("prix");
  });
});

describe("correspondance automatique", () => {
  it("réutilise le même dictionnaire de mots-clés que le CSV", () => {
    const corresp = proposerCorrespondanceXml(["id", "title", "price", "quantite"]);
    expect(corresp.id).toBe("id");
    expect(corresp.name).toBe("title");
    expect(corresp.price).toBe("price");
    expect(corresp.stock).toBe("quantite");
  });

  it("reconnaît un champ Google Shopping malgré le préfixe déjà retiré", () => {
    // champsDisponibles a déjà retiré "g:" via localName — la correspondance
    // ne voit jamais le préfixe.
    const corresp = proposerCorrespondanceXml(["id", "availability"]);
    expect(corresp.stock).toBe("availability");
  });
});

describe("extraction de valeur", () => {
  it("lit un attribut préfixé @", () => {
    const dom = new global.DOMParser().parseFromString(`<produit id="P1"></produit>`, "application/xml");
    const el = dom.documentElement;
    expect(extraireValeur(el, "@id")).toBe("P1");
  });

  it("lit le texte d'un enfant direct", () => {
    const dom = new global.DOMParser().parseFromString(`<produit><nom>Vis M8</nom></produit>`, "application/xml");
    const el = dom.documentElement;
    expect(extraireValeur(el, "nom")).toBe("Vis M8");
  });

  it("renvoie undefined pour un champ absent, sans lever d'exception", () => {
    const dom = new global.DOMParser().parseFromString(`<produit></produit>`, "application/xml");
    expect(extraireValeur(dom.documentElement, "inexistant")).toBeUndefined();
  });
});

describe("conversion complète", () => {
  it("convertit un flux Google Shopping, y compris le stock textuel", () => {
    const xml = `<rss xmlns:g="http://base.google.com/ns/1.0"><channel>
      <item><g:id>SKU-1</g:id><title>Vis M8</title><g:price>1.20</g:price><g:availability>in stock</g:availability></item>
      <item><g:id>SKU-2</g:id><title>Ecrou M8</title><g:price>0.30</g:price><g:availability>out of stock</g:availability></item>
    </channel></rss>`;
    const { elements } = detecterRacineItems(xml);
    const corresp = proposerCorrespondanceXml(champsDisponibles(elements));
    const { produits, erreurs } = convertirXml(xml, corresp);
    expect(erreurs.length).toBe(0);
    expect(produits).toEqual([
      { id: "SKU-1", name: "Vis M8", price: 1.2, stock: 1 },
      { id: "SKU-2", name: "Ecrou M8", price: 0.3, stock: 0 },
    ]);
  });

  it("gère l'identifiant en attribut, la virgule décimale et les catégories imbriquées", () => {
    const xml = `<catalogue>
      <produit id="P1" ref="V820"><nom>Vis M8x20</nom><prix>1,2</prix><quantite>15</quantite><categorie>Outillage &gt; Visserie</categorie></produit>
      <produit id="P2" ref="V821"><nom>Vis M8x30</nom><prix>1,4</prix><quantite>0</quantite></produit>
    </catalogue>`;
    const { elements } = detecterRacineItems(xml);
    const corresp = proposerCorrespondanceXml(champsDisponibles(elements));
    const { produits } = convertirXml(xml, corresp);
    expect(produits[0].price).toBe(1.2);
    expect(produits[0].categories).toEqual(["Outillage", "Visserie"]);
    expect(produits[1].stock).toBe(0); // le stock a zéro ne doit jamais être traité comme absent
  });

  it("signale un identifiant manquant sans planter la conversion", () => {
    const xml = `<catalogue><produit><nom>Sans id</nom></produit><produit><nom>Sans id non plus</nom></produit></catalogue>`;
    const { produits, erreurs } = convertirXml(xml, { name: "nom" });
    expect(produits.length).toBe(0);
    expect(erreurs[0].cause).toBe("Identifiant manquant.");
  });

  it("détecte un identifiant dupliqué, garde la première occurrence", () => {
    const xml = `<catalogue>
      <produit id="P1"><nom>Premier</nom></produit>
      <produit id="P1"><nom>Doublon</nom></produit>
    </catalogue>`;
    const { produits, erreurs } = convertirXml(xml, { id: "@id", name: "nom" });
    expect(produits.length).toBe(1);
    expect(produits[0].name).toBe("Premier");
    expect(erreurs[0].cause).toContain("déjà présent plus haut");
  });

  it("renvoie l'erreur fichier vide sur un XML sans structure répétée, comme le CSV", () => {
    const { produits, erreurs } = convertirXml("<vide></vide>", {});
    expect(produits.length).toBe(0);
    expect(erreurs[0].cause).toBe("Fichier vide ou sans données.");
  });

  it("avec une limite, traite seulement les N premiers éléments mais garde le vrai total", () => {
    const items = Array.from({ length: 10 }, (_, i) => `<produit id="P${i}"></produit>`).join("");
    const xml = `<catalogue>${items}</catalogue>`;
    const { produits, total } = convertirXml(xml, { id: "@id" }, 3);
    expect(produits.length).toBe(3);
    expect(total).toBe(10);
  });
});
