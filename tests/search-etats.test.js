import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const lire = (f) => JSON.parse(fs.readFileSync(path.join(RACINE, f), "utf8"));

// ---------------------------------------------------------------------------
// SUGGESTIONS ET ETATS — etape (c) du chantier recherche.
//
// « Aucun resultat » est le seul etat que personne n'a jamais vu sur ce site :
// il ne s'atteint qu'en tapant une requete qui ne rend rien, ce que le
// developpement ne fait jamais par accident.
//
// LE REGLAGE DE LA CORRECTION VIENT D'UNE MESURE, sur onze fautes reelles du
// journal de recherche :
//
//     distance <= 2, >= 1 page    8 bonnes   3 MAUVAISES   0 silence
//     distance <= 1, >= 1 page    6 bonnes   0 MAUVAISE    5 silences  <- retenu
//
// Le jeu des onze n'est pas versionne. Seuls trois cas sont nommes dans les
// maquettes, et ce sont les ECHECS de la distance 2 : « visdin -> visio »,
// « rondei -> rondele », « juppe -> juste ». On verifie donc ce qui est
// verifiable : qu'a une lettre, ces trois-la se taisent.
// ---------------------------------------------------------------------------

async function ouvrir(langue = "fr") {
  const index = lire(`search-index-${langue}.json`);
  const url = langue === "en" ? "https://heurix.fr/en/index.html" : "https://heurix.fr/index.html";
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body><button id="heurix-search-btn">b</button></body></html>`,
    { url, runScripts: "outside-only" }
  );
  const w = dom.window;
  w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(index) });
  w.matchMedia = () => ({ matches: true });
  w.eval(fs.readFileSync(path.join(RACINE, "search-engine.js"), "utf8"));
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  w.document.getElementById("heurix-search-btn").dispatchEvent(new w.Event("click"));
  await new Promise((r) => setTimeout(r, 25));
  return w;
}

const taper = (w, q) => {
  const i = w.document.getElementById("heurix-search-input");
  i.value = q;
  i.dispatchEvent(new w.Event("input"));
  return i;
};
const zone = (w) => w.document.getElementById("heurix-search-empty");
const correction = (w) => zone(w).querySelector(".search-correction");
const replis = (w) => [...zone(w).querySelectorAll(".search-alternatives .search-chip")];
const propose = (w) => {
  const c = correction(w);
  return c.hidden ? null : c.querySelector(".search-chip").textContent;
};
const cliquer = (w, n) => n.dispatchEvent(new w.Event("click", { bubbles: true }));
const compte = (w) => w.document.querySelector(".search-count").textContent;

describe("l'etat « rien trouve » s'atteint", () => {
  it("une requete sans resultat montre la zone, une requete avec resultats la cache", async () => {
    const w = await ouvrir();
    taper(w, "xyzinexistantzzz");
    expect(zone(w).hidden).toBe(false);
    expect(zone(w).querySelector(".search-vide-titre").textContent)
      .toBe("Rien pour « xyzinexistantzzz »");
    taper(w, "din 933");
    expect(zone(w).hidden).toBe(true);
  });
});

describe("les guillemets sont du texte d'interface", () => {
  // L'anglais affichait « prestshop » -- des chevrons francais dans une
  // phrase anglaise. Vu a l'ecran a 390 en anglais, pas dans le code.
  it("le francais encadre par des chevrons", async () => {
    const w = await ouvrir("fr");
    taper(w, "zzzrien");
    expect(zone(w).querySelector(".search-vide-titre").textContent).toBe("Rien pour « zzzrien »");
  });

  it("l'anglais par des guillemets anglais, pas des chevrons", async () => {
    const w = await ouvrir("en");
    taper(w, "zzzrien");
    const titre = zone(w).querySelector(".search-vide-titre").textContent;
    expect(titre).toBe("Nothing for \u201czzzrien\u201d");
    expect(titre).not.toContain("«");
  });
});

describe("correction a une lettre", () => {
  it("« prestshop » propose « prestashop », avec ce que ca rend", async () => {
    const w = await ouvrir();
    taper(w, "prestshop");
    expect(propose(w)).toBe("prestashop");
    expect(correction(w).querySelector(".search-correction-n").textContent).toMatch(/^\d+ résultats?$/);
  });

  it.each(["visdin", "rondei", "juppe"])(
    "« %s » — faux positif mesure a deux lettres — reste muet a une lettre", async (q) => {
      const w = await ouvrir();
      taper(w, q);
      expect(propose(w)).toBeNull();
    });

  it("cliquer la correction lance la requete corrigee", async () => {
    const w = await ouvrir();
    taper(w, "prestshop");
    cliquer(w, correction(w).querySelector(".search-chip"));
    expect(w.document.getElementById("heurix-search-input").value).toBe("prestashop");
    expect(zone(w).hidden).toBe(true);
    expect(w.document.querySelectorAll(".search-result").length).toBeGreaterThan(0);
  });

  // LA CORRECTION NE PARLE QUE SI ELLE RAPPORTE : un mot du vocabulaire a une
  // lettre pres ne suffit pas, la requete corrigee doit rendre une page. C'est
  // la seconde moitie du reglage, et sans elle « distance 1 » proposerait des
  // corrections plausibles vers un terme qui ne remonte rien.
  it("aucune proposition ne mene a zero resultat", async () => {
    const w = await ouvrir();
    for (const q of ["prestshop", "shopfy", "catalgue", "din 934"]) {
      taper(w, q);
      const p = propose(w);
      if (!p) continue;
      taper(w, p);
      expect(w.document.querySelectorAll(".search-result").length, `« ${q} » -> « ${p} »`)
        .toBeGreaterThan(0);
    }
  });
});

describe("trois requetes de repli, quand la correction se tait", () => {
  it("elles remplacent la correction, elles ne s'y ajoutent pas", async () => {
    const w = await ouvrir();
    taper(w, "xyzinexistantzzz");
    expect(propose(w)).toBeNull();
    expect(replis(w)).toHaveLength(3);
    taper(w, "prestshop");
    expect(propose(w)).toBe("prestashop");
    expect(replis(w)).toHaveLength(0);
  });

  // UN REPLI QUI NE REND RIEN EST UN CUL-DE-SAC DE PLUS. Elles sont ecrites a
  // la main -- rien dans l'index ne dit quelle requete relance quelqu'un -- et
  // ce test est ce qui les empeche de pourrir avec le corpus.
  it.each(["fr", "en"])("%s : chaque repli rend encore des resultats", async (langue) => {
    const w = await ouvrir(langue);
    taper(w, "xyzinexistantzzz");
    const qs = replis(w).map((b) => b.textContent);
    expect(qs).toHaveLength(3);
    for (const q of qs) {
      taper(w, q);
      expect(w.document.querySelectorAll(".search-result").length, `repli « ${q} »`)
        .toBeGreaterThan(0);
    }
  });

  it("cliquer un repli lance sa requete", async () => {
    const w = await ouvrir();
    taper(w, "xyzinexistantzzz");
    const q = replis(w)[0].textContent;
    cliquer(w, replis(w)[0]);
    expect(w.document.getElementById("heurix-search-input").value).toBe(q);
    expect(zone(w).hidden).toBe(true);
  });
});

describe("ce que l'etat ne dit pas — decisions arbitrees dans les maquettes", () => {
  // ON EXAMINE LA PROSE, PAS LES REQUETES SUGGEREES. Un repli s'appelle
  // « indexer un catalogue » : il contient « index » sans rien expliquer de
  // quoi que ce soit. Le test le disait fautif -- il visait le mauvais texte.
  const prose = (w) => [".search-vide-titre", ".search-alt-titre", ".search-contact"]
    .map((s) => (zone(w).querySelector(s) || {}).textContent || "").join(" ").toLowerCase();

  it("aucune phrase n'explique le reglage au visiteur", async () => {
    const w = await ouvrir();
    taper(w, "xyzinexistantzzz");
    for (const mot of ["distance", "une lettre", "orthograph", "algorithme", "index"]) {
      expect(prose(w), `« ${mot} » n'a rien a faire sur un ecran de visiteur`).not.toContain(mot);
    }
  });

  it("aucune mention de journalisation — rien ne journalise aujourd'hui", async () => {
    const w = await ouvrir();
    taper(w, "xyzinexistantzzz");
    for (const mot of ["journal", "enregistr", "signal", "remont"]) {
      expect(prose(w)).not.toContain(mot);
    }
  });

  // LES MAQUETTES ECRIVAIENT « on repond sous 24 h ». contact.html annonce
  // 48 h ouvrees : la modale aurait affiche un engagement plus fort que le
  // vrai, et un second endroit ou le maintenir. Le lien reste, le delai part.
  it("le lien contact ne promet aucun delai", async () => {
    const w = await ouvrir();
    taper(w, "xyzinexistantzzz");
    const lien = zone(w).querySelector(".search-contact a");
    expect(lien.getAttribute("href")).toContain("contact.html");
    expect(zone(w).querySelector(".search-contact").textContent).not.toMatch(/\d+\s*h/);
  });
});

describe("le filtre qui masque tout n'est pas une requete sans resultat", () => {
  it("il le dit, ne corrige rien, et propose de retirer le filtre", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    // PAIRE MESUREE : « din 933 » rend 2 pages dans Secteurs, « prestashop »
    // en rend 13 mais AUCUNE dans Secteurs. On coche donc une source vivante,
    // puis on tape une requete ou elle meurt.
    const sect = w.document.querySelector('.search-rail input[value="secteurs"]');
    sect.checked = true;
    sect.dispatchEvent(new w.Event("change", { bubbles: true }));
    taper(w, "prestashop");
    expect(Number(w.document.querySelector('input[value="secteurs"]')
      .closest(".search-filtre").querySelector(".search-filtre-n").textContent)).toBe(0);
    expect(zone(w).hidden).toBe(false);
    expect(zone(w).querySelector(".search-vide-titre").textContent)
      .toBe("Aucun résultat avec ce filtre");
    expect(propose(w)).toBeNull();
    expect(replis(w).map((b) => b.textContent)).toEqual(["Tout effacer"]);
  });

  it("le bouton retire le filtre et rend la liste", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    const sect = w.document.querySelector('.search-rail input[value="secteurs"]');
    sect.checked = true;
    sect.dispatchEvent(new w.Event("change", { bubbles: true }));
    taper(w, "prestashop");
    cliquer(w, replis(w)[0]);
    expect(sect.checked).toBe(false);
    expect(zone(w).hidden).toBe(true);
    expect(w.document.querySelectorAll(".search-result").length).toBeGreaterThan(0);
  });

  // LES SUGGESTIONS PORTENT SUR CE QUE LA REQUETE DONNE, PAS SUR CE QUE LE
  // FILTRE LAISSE. Sinon la correction disparaitrait au moment ou elle sert.
  it("un filtre actif n'empeche pas la correction quand la requete, elle, ne rend rien", async () => {
    const w = await ouvrir();
    taper(w, "din 933");
    const blog = w.document.querySelector('.search-rail input[value="blog"]');
    blog.checked = true;
    blog.dispatchEvent(new w.Event("change", { bubbles: true }));
    taper(w, "prestshop");
    expect(blog.checked).toBe(true);
    expect(propose(w)).toBe("prestashop");
  });
});

describe("taper avant que l'index soit la", () => {
  // L'ETAT LE PLUS COURANT SUR UNE CONNEXION LENTE, ET IL JETAIT LA REQUETE.
  // `open()` appelait suggestionsParDefaut() a la resolution de precharger,
  // sans regarder le champ : qui tapait pendant le chargement voyait sa
  // requete dans le champ, l'etiquette « A lire en premier » au-dessus, et
  // cinq articles sans rapport. Trouve par la MESURE de l'etape (e), qui se
  // contredisait -- « 0 resultat » suivi d'un clic au rang 3 -- et non a
  // l'ecran, ou il faut une connexion lente pour le voir.
  async function avecIndexRetarde() {
    const index = lire("search-index-fr.json");
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body><button id="heurix-search-btn">b</button></body></html>`,
      { url: "https://heurix.fr/index.html", runScripts: "outside-only" }
    );
    const w = dom.window;
    let livrer;
    w.fetch = () => new Promise((r) => { livrer = () => r({ ok: true, json: () => Promise.resolve(index) }); });
    w.matchMedia = () => ({ matches: true });
    w.eval(fs.readFileSync(path.join(RACINE, "search-engine.js"), "utf8"));
    w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
    w.document.getElementById("heurix-search-btn").dispatchEvent(new w.Event("click"));
    await new Promise((r) => setTimeout(r, 25));
    return { w, livrer: () => livrer() };
  }

  it("la requete survit a l'arrivee de l'index, elle n'est pas remplacee par les suggestions", async () => {
    const { w, livrer } = await avecIndexRetarde();
    taper(w, "din 933");
    expect(w.document.querySelectorAll(".search-result")).toHaveLength(0);
    livrer();
    await new Promise((r) => setTimeout(r, 30));

    expect(w.document.getElementById("heurix-search-input").value).toBe("din 933");
    expect(w.document.querySelector(".search-suggest-label").hidden).toBe(true);
    expect(w.document.querySelector(".search-count").textContent).toMatch(/^\d+ résultats$/);
    const pages = new Set([...w.document.querySelectorAll(".search-result")]
      .map((a) => a.getAttribute("href").split("#")[0].replace(/^(\.\.\/)+/, "")));
    expect(pages.has("prestashop.html")).toBe(true);       // un resultat de « din 933 »
  });

  it("un champ vide a l'arrivee de l'index donne bien les suggestions", async () => {
    const { w, livrer } = await avecIndexRetarde();
    livrer();
    await new Promise((r) => setTimeout(r, 30));
    expect(w.document.querySelector(".search-suggest-label").hidden).toBe(false);
    expect(w.document.querySelectorAll(".search-result").length).toBeGreaterThan(0);
  });
});

describe("l'etat d'erreur", () => {
  async function avecIndexMort() {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body><button id="heurix-search-btn">b</button></body></html>`,
      { url: "https://heurix.fr/index.html", runScripts: "outside-only" }
    );
    const w = dom.window;
    w.fetch = () => Promise.reject(new Error("reseau"));
    w.matchMedia = () => ({ matches: true });
    w.eval(fs.readFileSync(path.join(RACINE, "search-engine.js"), "utf8"));
    w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
    w.document.getElementById("heurix-search-btn").dispatchEvent(new w.Event("click"));
    await new Promise((r) => setTimeout(r, 25));
    return w;
  }

  // IL N'AFFICHAIT RIEN. Il posait `data-erreur` sur la liste et aucune regle
  // CSS ne lisait cet attribut : l'index qui ne se charge pas rendait un
  // panneau vide, sans un mot.
  it("dit ce qui s'est passe, et offre de reessayer", async () => {
    const w = await avecIndexMort();
    expect(zone(w).hidden).toBe(false);
    expect(zone(w).querySelector(".search-vide-titre").textContent).toBeTruthy();
    const reessayer = zone(w).querySelector(".search-chip");
    expect(reessayer.textContent).toBe("Réessayer");
  });

  // LE CHEMIN DE SORTIE, et pas seulement l'ecran d'erreur : un bouton qui
  // affiche un etat sans jamais en sortir vaut moins qu'un message.
  it("un reessai qui aboutit rend la recherche, sans trace de l'erreur", async () => {
    const index = lire("search-index-fr.json");
    let condamnes = 1;
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body><button id="heurix-search-btn">b</button></body></html>`,
      { url: "https://heurix.fr/index.html", runScripts: "outside-only" }
    );
    const w = dom.window;
    w.fetch = () => condamnes-- > 0
      ? Promise.reject(new Error("reseau"))
      : Promise.resolve({ ok: true, json: () => Promise.resolve(index) });
    w.matchMedia = () => ({ matches: true });
    w.eval(fs.readFileSync(path.join(RACINE, "search-engine.js"), "utf8"));
    w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
    w.document.getElementById("heurix-search-btn").dispatchEvent(new w.Event("click"));
    await new Promise((r) => setTimeout(r, 25));
    expect(zone(w).querySelector(".search-vide-titre").textContent)
      .toBe("L'index n'a pas pu être chargé");

    cliquer(w, zone(w).querySelector(".search-chip-fort"));
    await new Promise((r) => setTimeout(r, 25));
    taper(w, "din 933");
    expect(zone(w).hidden).toBe(true);
    expect(w.document.querySelector(".search-results").hasAttribute("data-erreur")).toBe(false);
    expect(w.document.querySelectorAll(".search-result").length).toBeGreaterThan(0);
  });
});

describe("clavier — les noeuds neufs sont couverts", () => {
  it.each([["correction", "prestshop"], ["replis", "xyzinexistantzzz"]])(
    "%s : tout ce qui est cliquable est dans le piege a focus", async (_, q) => {
      const w = await ouvrir();
      taper(w, q);
      const piege = [...w.document.querySelector(".search-panel")
        .querySelectorAll("input, button, a[href]")];
      const neufs = [...zone(w).querySelectorAll("button, a[href]")];
      expect(neufs.length).toBeGreaterThan(0);
      // Des INDEX, pas des noeuds : passer un element jsdom a un matcher fait
      // lever le matcher lui-meme.
      for (const n of neufs) expect(piege.indexOf(n)).toBeGreaterThan(-1);
    });

  it.each([["correction", "prestshop"], ["replis", "xyzinexistantzzz"]])(
    "%s : Echap ferme depuis chacun d'eux", async (_, q) => {
      const neufs = (w) => [...zone(w).querySelectorAll("button, a[href]")];
      const n = neufs(await ouvrir().then((w) => (taper(w, q), w))).length;
      for (let i = 0; i < n; i++) {
        const w = await ouvrir();
        taper(w, q);
        neufs(w)[i].dispatchEvent(
          new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        expect(w.document.querySelector(".search-modal").classList.contains("open"),
          `noeud ${i}`).toBe(false);
      }
    });
});

describe("le piege a focus ne compte que ce que Tab atteint", () => {
  // DEUX CATEGORIES LUI ECHAPPAIENT, apparues avec (b) et (c) : les cases
  // DESACTIVEES d'une source vide, et les blocs CACHES -- la correction quand
  // ce sont les replis qui s'affichent. Les compter fait viser un « dernier »
  // que Tab saute, et le piege s'ouvre la ou il devait se refermer.
  const piege = (w) => [].filter.call(
    w.document.querySelector(".search-panel").querySelectorAll("input, button, a[href]"),
    (n) => !n.disabled && !n.closest("[hidden]"));

  it("dans l'etat vide, les cinq cases desactivees n'y sont pas", async () => {
    const w = await ouvrir();
    taper(w, "xyzinexistantzzz");
    const desactivees = [...w.document.querySelectorAll(".search-rail input:disabled")];
    expect(desactivees).toHaveLength(5);
    for (const n of desactivees) expect(piege(w).indexOf(n)).toBe(-1);
  });

  it("le dernier element du piege est atteignable au clavier", async () => {
    const w = await ouvrir();
    taper(w, "xyzinexistantzzz");
    const liste = piege(w);
    const dernier = liste[liste.length - 1];
    expect(dernier.tagName).toBe("A");                 // le lien contact
    expect(dernier.hasAttribute("disabled")).toBe(false);
    expect(dernier.closest("[hidden]")).toBeNull();
  });

  it("les replis caches par une correction ne restent pas dans le document", async () => {
    const w = await ouvrir();
    taper(w, "xyzinexistantzzz");
    expect(replis(w)).toHaveLength(3);
    taper(w, "prestshop");
    expect(replis(w)).toHaveLength(0);
  });
});

describe("non-regression de l'index, etape (c)", () => {
  const pages = (w) =>
    new Set([...w.document.querySelectorAll(".search-result")].map((a) =>
      a.getAttribute("href").split("#")[0].replace(/^(\.\.\/)+/, "")));

  it.each(["2rs", "din 933"])("« %s » remonte sept pages", async (q) => {
    const w = await ouvrir();
    taper(w, q);
    // PAS DE COMPTE FIGE ICI NON PLUS. « 2rs » est passe de 8 a 9 entrees dans
    // l'heure, par un commit d'une autre session ; les sept pages n'ont pas
    // bouge. C'est la lecon du garde reecrit ce matin, appliquee tout de suite.
    expect(pages(w).size).toBe(7);
    expect(compte(w)).toMatch(/^\d+ résultats$/);
  });
});
