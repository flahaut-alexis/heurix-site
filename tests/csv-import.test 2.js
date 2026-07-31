import { describe, it, expect } from "vitest";
import {
  detecterSeparateur, decouperLigne, proposerCorrespondance,
  convertir, enLots,
} from "../csv-import.js";

describe("détection du séparateur", () => {
  it("reconnaît le point-virgule des exports français", () => {
    // Excel en français écrit en « ; » parce que la virgule y est le
    // séparateur décimal. Supposer la virgule ferait échouer la majorité
    // des fichiers de la cible.
    const csv = "id;nom;prix\n1;Vis M8;1,24\n2;Ecrou M8;0,31";
    expect(detecterSeparateur(csv)).toBe(";");
  });

  it("reconnaît la virgule des exports anglo-saxons", () => {
    const csv = "id,name,price\n1,Bolt M8,1.24\n2,Nut M8,0.31";
    expect(detecterSeparateur(csv)).toBe(",");
  });

  it("ne se laisse pas tromper par des virgules DANS les libellés", () => {
    // Le piège classique : « Vis TH, inox A2 » contient une virgule mais
    // le vrai séparateur est le point-virgule.
    const csv = 'id;nom\n1;"Vis TH, inox A2"\n2;"Ecrou frein, M8"';
    expect(detecterSeparateur(csv)).toBe(";");
  });
});

describe("découpage de ligne", () => {
  it("respecte les guillemets", () => {
    const champs = decouperLigne('1;"Vis TH, inox A2";1,24', ";");
    expect(champs).toEqual(["1", "Vis TH, inox A2", "1,24"]);
  });

  it("gère les guillemets doublés", () => {
    const champs = decouperLigne('1;"Vis 3"" longue";5', ";");
    expect(champs[1]).toBe('Vis 3" longue');
  });
});

describe("correspondance automatique", () => {
  it("reconnaît les en-têtes français courants", () => {
    const c = proposerCorrespondance(["Identifiant", "Référence", "Désignation", "Prix HT", "Stock"]);
    expect(c.id).toBe(0);
    expect(c.ref).toBe(1);
    expect(c.name).toBe(2);
    expect(c.stock).toBe(4);
  });

  it("reconnaît les en-têtes anglais", () => {
    const c = proposerCorrespondance(["SKU", "Name", "Price", "Quantity"]);
    expect(c.name).toBe(1);
    expect(c.price).toBe(2);
    expect(c.stock).toBe(3);
  });

  it("n'attribue pas deux fois la même colonne", () => {
    const c = proposerCorrespondance(["id", "nom", "name"]);
    const utilisees = Object.values(c);
    expect(new Set(utilisees).size).toBe(utilisees.length);
  });
});

describe("conversion", () => {
  const csv = [
    "Identifiant;Référence;Désignation;Prix HT;Stock;Catégorie",
    "VIS-001;M8X20-A2;Vis tête hexagonale M8x20 inox;1,24;2485;Visserie > Fixation",
    "ECR-002;M8-ZN;Écrou frein M8 zingué;0,31;12;Visserie",
  ].join("\n");

  it("convertit les nombres à la française", () => {
    // « 1,24 » doit devenir 1.24, pas NaN ni 124.
    const { produits } = convertir(csv, proposerCorrespondance(csv.split("\n")[0].split(";")));
    expect(produits[0].price).toBe(1.24);
    expect(produits[0].stock).toBe(2485);
  });

  it("découpe les catégories", () => {
    const { produits } = convertir(csv, proposerCorrespondance(csv.split("\n")[0].split(";")));
    expect(produits[0].categories).toEqual(["Visserie", "Fixation"]);
  });

  it("préserve les accents", () => {
    const { produits } = convertir(csv, proposerCorrespondance(csv.split("\n")[0].split(";")));
    expect(produits[1].name).toBe("Écrou frein M8 zingué");
  });

  it("refuse une ligne sans identifiant plutôt que d'inventer", () => {
    // Sans identifiant, deux imports successifs créeraient des doublons
    // au lieu de se remplacer.
    const mauvais = "id;nom\n;Vis sans id\nOK-1;Vis correcte";
    const { produits, erreurs } = convertir(mauvais, { id: 0, name: 1 });
    expect(produits).toHaveLength(1);
    expect(erreurs[0].ligne).toBe(2);
  });

  it("signale les doublons au lieu de les écraser", () => {
    const doublons = "id;nom\nA;Premier\nA;Second";
    const { produits, erreurs } = convertir(doublons, { id: 0, name: 1 });
    expect(produits).toHaveLength(1);
    expect(produits[0].name).toBe("Premier");
    expect(erreurs[0].cause).toContain("déjà présent");
  });

  it("gère les milliers avec espace insécable", () => {
    const gros = "id;prix\nA;1\u00a0234,56";
    const { produits } = convertir(gros, { id: 0, price: 1 });
    expect(produits[0].price).toBe(1234.56);
  });
});

describe("découpage en lots", () => {
  it("respecte le plafond de 5 000 de l'API", () => {
    const produits = Array.from({ length: 12000 }, (_, i) => ({ id: `P${i}` }));
    const lots = enLots(produits);
    expect(lots).toHaveLength(3);
    expect(lots[0].items).toHaveLength(5000);
    expect(lots[2].items).toHaveLength(2000);
  });

  it("ne déclare le pack que sur le premier lot", () => {
    // Le répéter déclencherait une réindexation complète par lot, soit
    // plusieurs secondes de service bloqué à chaque envoi.
    const produits = Array.from({ length: 8000 }, (_, i) => ({ id: `P${i}` }));
    const lots = enLots(produits, 5000, "outillage");
    expect(lots[0].rulepack).toBe("outillage");
    expect(lots[1].rulepack).toBeUndefined();
  });
});

describe("en-têtes d'ERP réels", () => {
  it("reconnaît le vocabulaire d'un export français", () => {
    // TROUVÉ EN TESTANT SUR DES DONNÉES RÉALISTES. La première version ne
    // reconnaissait AUCUNE colonne d'identifiant ni de référence : un ERP
    // écrit « Code article » et « Réf. fournisseur », pas « id » et « ref ».
    const c = proposerCorrespondance([
      "Code article", "Réf. fournisseur", "Désignation",
      "Prix HT (EUR)", "Qté dispo", "Rayon",
    ]);
    expect(c.id).toBe(0);
    expect(c.ref).toBe(1);
    expect(c.name).toBe(2);
    expect(c.price).toBe(3);
    expect(c.stock).toBe(4);
    expect(c.categories).toBe(5);
  });

  it("tolère la ponctuation et les suffixes des en-têtes", () => {
    // « Prix HT (EUR) » et « Qté dispo au 01/07 » sont des en-têtes réels.
    const c = proposerCorrespondance(["Id.", "Prix HT (EUR)", "Qté dispo au 01/07"]);
    expect(c.id).toBe(0);
    expect(c.price).toBe(1);
    expect(c.stock).toBe(2);
  });

  it("distingue platform_id de l'identifiant métier", () => {
    // Un catalogue qui porte les deux : la référence métier reste l'id,
    // et l'entier PrestaShop va dans platform_id. Les confondre casserait
    // le scoring ou le module.
    const c = proposerCorrespondance(["Code article", "id_prestashop", "Désignation"]);
    expect(c.id).toBe(0);
    expect(c.platform_id).toBe(1);
  });
});
