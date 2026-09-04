import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// UNE ANCRE HERITE DU VOCABULAIRE DE SA PAGE, ET LE MOTEUR LE CLASSAIT COMME
// DU CONTENU (4 septembre 2026).
//
// `scripts/index-recherche.py` ecrit `e` deux fois, avec deux sens :
//
//     ligne 350, une PAGE   : e = sa propre <meta name="description">
//     ligne 366, une ANCRE  : e = le <title> de sa PAGE PARENTE
//
// `search-engine.js` accorde le score 0 quand la requete est dans `e`. Pour
// une page c'est du contenu -- son propre resume, affiche ET surligne. Pour
// une ancre c'est un REPERE emprunte, et le rendu le savait deja : il branche
// sur `item.ancre` pour le sortir de l'extrait et le poser dans la ligne meta
// (« Cascade d'annotations · dans Fonctionnalites »). Le classement, douze
// lignes plus haut dans le meme fichier, ne branchait pas.
//
// CE QUE CA DONNAIT. Les 40 ancres de fonctionnalites.html portent toutes
// « merchandising » dans `e`, mot du <title> de leur page. Trois sections qui
// n'en parlent jamais occupaient les rangs 6, 7 et 8, et `mesure.html` sortait
// du top 8. A l'ecran, ces trois resultats n'affichaient AUCUN surlignage :
// le mot sur lequel ils remontaient n'etait ecrit nulle part sur leur ligne.
//
// LE DEFAUT PRE-EXISTE aux ancres neuves : les 25 d'avant ont la meme
// construction. Il restait invisible parce qu'un mot ne franchit le seuil que
// si AUCUNE page ne le porte dans son titre -- « merchandising » est le seul
// du site dans ce cas (0 autre titre), quand « recherche » en compte 31.
// UN DEFAUT DE CLASSEMENT NE SE VOIT QUE SUR LES TERMES RARES.
//
// CE QUE CE TEST VERIFIE, et pourquoi cette formulation. Il n'affirme pas
// « pas de score 0 pour une ancre » -- ce serait recopier le correctif. Il
// affirme la propriete observable : UNE ANCRE QUI REMONTE PORTE LA REQUETE
// DANS SON PROPRE TITRE. Elle tient pour les trois scores qui restent
// accessibles a une ancre (2 et 1 par le titre, -0,5 par `k`, qui n'est fait
// que des termes de ce meme titre), et elle se lit sur la sortie du VRAI
// moteur -- search-engine.js evalue ici, pas une replique.
//
// LIMITE ASSUMEE : le balayage porte sur des requetes d'UN terme, celles du
// vocabulaire des titres de l'index. Une requete a plusieurs termes peut etre
// une sous-chaine d'un titre de page sans etre une sous-chaine du titre de
// l'ancre ; la propriete reste vraie, jeton par jeton, et c'est sous cette
// forme qu'elle est verifiee ci-dessous.
// ---------------------------------------------------------------------------

const sansAccent = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function ouvrir(index, url) {
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
  return w;
}

function resultats(w, q) {
  const i = w.document.getElementById("heurix-search-input");
  i.value = q;
  i.dispatchEvent(new w.Event("input"));
  return [...w.document.querySelectorAll("a.search-result")].map((a) => ({
    href: a.getAttribute("href"),
    titre: a.querySelector(".search-result-title").textContent,
    // le rendu ne pose `.search-result-parent` que sur une ancre
    ancre: !!a.querySelector(".search-result-parent"),
    surlignages: a.querySelectorAll("mark").length,
  }));
}

// Le vocabulaire se derive de l'index, il n'est pas une liste a tenir a jour.
function vocabulaire(index) {
  const mots = new Set();
  for (const e of index.entrees)
    for (const m of sansAccent(e.t).match(/[a-z0-9]+/g) || []) if (m.length >= 4) mots.add(m);
  return [...mots].sort();
}

for (const [langue, fichier, url] of [
  ["FR", "search-index-fr.json", "https://heurix.fr/index.html"],
  ["EN", "search-index-en.json", "https://heurix.fr/en/index.html"],
]) {
  const index = JSON.parse(fs.readFileSync(path.join(RACINE, fichier), "utf8"));

  describe(`classement des ancres — ${langue}`, () => {
    it("le vocabulaire balaye n'est pas vide, et les ancres sont bien presentes", () => {
      expect(vocabulaire(index).length).toBeGreaterThan(200);
      expect(index.entrees.filter((e) => e.ancre).length).toBeGreaterThan(20);
    });

    it("aucune ancre ne remonte sur un mot absent de son propre titre", async () => {
      const w = ouvrir(index, url);
      await new Promise((r) => setTimeout(r, 25));
      const indues = [];
      for (const q of vocabulaire(index)) {
        for (const r of resultats(w, q)) {
          if (!r.ancre) continue;
          if (!sansAccent(r.titre).includes(q)) indues.push(`« ${q} » -> ${r.href} (« ${r.titre} »)`);
        }
      }
      expect(indues).toEqual([]);
    });

    // LE SYMPTOME A L'ECRAN, et non plus la regle de score. Une ancre qui
    // remonte sans rien surligner ne montre au visiteur aucune raison d'etre
    // la : le mot sur lequel elle a ete retenue n'est ecrit nulle part sur sa
    // ligne. Vrai pour une ancre seulement -- une PAGE peut legitimement
    // remonter par les termes de son corps (score -0,5), qui ne sont ni dans
    // son titre ni dans son extrait, donc sans surlignage.
    it("toute ancre affichee surligne le mot qui l'a fait remonter", async () => {
      const w = ouvrir(index, url);
      await new Promise((r) => setTimeout(r, 25));
      const muettes = [];
      for (const q of vocabulaire(index)) {
        for (const r of resultats(w, q)) {
          if (r.ancre && r.surlignages === 0) muettes.push(`« ${q} » -> ${r.href}`);
        }
      }
      expect(muettes).toEqual([]);
    });
  });
}
