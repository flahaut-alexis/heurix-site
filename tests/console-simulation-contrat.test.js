import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");

// ---------------------------------------------------------------------------
// L'ecran « Mise en avant sur recherche » est reste casse DEUX JOURS en
// production : 422 des qu'une regle existait deja, parce que la console
// renvoyait au moteur l'objet qu'elle venait de lire -- 15 champs pour un
// contrat de 4. Le durcissement `extra="forbid"` du 27 aout a rendu visible
// un aller-retour qui ne marchait que par la tolerance du serveur.
//
// CE QUE CE TEST GARDE, ET CE QU'IL NE PEUT PAS GARDER.
//
// Il garde le REFLEXE : tout envoi vers une simulation passe par
// `simuProjeter`. C'est le defaut qui a coute deux jours -- non pas une
// mauvaise liste de champs, mais un point d'appel qui envoyait l'objet
// entier. Un troisieme ecran de simulation ajoute demain sans projection
// echoue ici, avant la production.
//
// Il ne peut PAS garder l'exactitude des listes elles-memes : les modeles
// Pydantic vivent dans heurix-engine, hors de ce depot. Si le moteur ajoute
// un champ obligatoire, ce test restera vert et l'ecran cassera. C'est
// precisement le trou que le controle de deploiement doit couvrir, en
// interrogeant la VRAIE API -- voir la note de chiffrage.
// ---------------------------------------------------------------------------

describe("contrat de simulation console -> moteur", () => {
  it("expose une liste blanche par contrat, pas une liste noire", () => {
    const bloc = SOURCE.match(/var SIMU_CHAMPS = \{[\s\S]*?\n {2}\};/);
    expect(bloc, "SIMU_CHAMPS a disparu ou change de forme").not.toBeNull();

    // Les deux contrats sont DIFFERENTS et ne doivent pas etre factorises :
    // une page de categorie n'a pas de requete.
    expect(bloc[0]).toContain('so: ["query", "product_id", "action", "position"]');
    expect(bloc[0]).toContain('br: ["product_id", "action", "position"]');
  });

  it("aucun envoi vers une simulation ne part sans projection", () => {
    // Les deux formes d'envoi vers un endpoint de simulation :
    //   corpsRequete.simulate_overrides = ...   (recherche)
    //   overrides: ...                          (POST .../simulate)
    const envois = [
      ...SOURCE.matchAll(/simulate_overrides\s*=\s*([^;\n]+)/g),
      ...SOURCE.matchAll(/^\s*overrides:\s*([^,\n]+)/gm),
    ].map((m) => m[1].trim());

    expect(envois.length, "aucun envoi trouve — le test ne mesure plus rien").toBeGreaterThan(0);

    const sansProjection = envois.filter((e) => !e.includes("simuProjeter"));
    expect(
      sansProjection,
      "un envoi part sans passer par simuProjeter : c'est exactement le defaut du 28 aout",
    ).toEqual([]);
  });

  it("les champs d'affichage ne figurent dans aucun contrat", () => {
    // Ceux que NOUS ajoutons au brouillon pour faire vivre les tables, et
    // que le moteur refuse : ils n'ont rien a faire dans une liste blanche.
    const bloc = SOURCE.match(/var SIMU_CHAMPS = \{[\s\S]*?\n {2}\};/)[0];
    for (const champ of ["nom", "statut", "priorite", "diffusion", "product_name", "created_at"]) {
      expect(bloc, `« ${champ} » est un champ d'affichage, pas un champ de contrat`)
        .not.toContain(`"${champ}"`);
    }
  });
});
