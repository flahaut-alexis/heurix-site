import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// secteurs.html est partie EN PRODUCTION entierement invisible le 25 aout
// 2026 : creee, testee a 187/187, poussee, publiee -- et vide. Tout son
// contenu tenait dans un seul bloc `.reveal` bloque a opacity:0, faute du
// script qui lui pose `.in`.
//
// Aucun test ne l'a vu parce qu'aucun ne regardait le rendu. Ceux-ci ne le
// regardent pas davantage -- jsdom ne fait ni mise en page ni
// IntersectionObserver, et mesurer une opacite calculee y serait un faux
// test qui rassure sans rien prouver.
//
// Ils verifient les deux INVARIANTS STRUCTURELS qui ont reellement echoue.
// C'est grossier, et c'est assume : les deux auraient attrape le defaut.
// ---------------------------------------------------------------------------

function pagesHtml() {
  const sortie = [];
  const parcourir = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (e.name.endsWith(".html")) sortie.push(p);
    }
  };
  parcourir(RACINE);
  return sortie;
}

describe("apparition au defilement — degradation", () => {
  it("aucune page ne porte de balisage .reveal sans charger reveal.js", () => {
    const fautives = pagesHtml().filter((p) => {
      const s = fs.readFileSync(p, "utf8");
      return /class="[^"]*\breveal\b/.test(s) && !/<script[^>]+src="[^"]*reveal\.js/.test(s);
    });
    // Message explicite : celui qui lira cet echec doit comprendre le risque,
    // pas seulement constater un compte qui ne colle pas.
    expect(fautives.map((p) => path.relative(RACINE, p))).toEqual([]);
  });

  it("`.reveal` est VISIBLE par defaut — le masquage n'arrive qu'avec le script", () => {
    const css = fs.readFileSync(path.join(RACINE, "styles.css"), "utf8");
    const regleNue = css.match(/^\.reveal\{([^}]*)\}/m);
    expect(regleNue, "la regle .reveal a disparu de styles.css").not.toBeNull();
    // C'est l'inversion du 26 aout : sans JS, le contenu s'affiche.
    expect(regleNue[1]).toMatch(/opacity:\s*1/);
    expect(regleNue[1]).not.toMatch(/opacity:\s*0/);
  });

  it("le masquage est bien conditionne au marqueur pose par le script", () => {
    const css = fs.readFileSync(path.join(RACINE, "styles.css"), "utf8");
    expect(css).toMatch(/\.js-reveal\s+\.reveal\{[^}]*opacity:\s*0/);
    const js = fs.readFileSync(path.join(RACINE, "reveal.js"), "utf8");
    expect(js).toMatch(/classList\.add\(['"]js-reveal['"]\)/);
  });

  it("reveal.js ne depend pas du seul IntersectionObserver", () => {
    const js = fs.readFileSync(path.join(RACINE, "reveal.js"), "utf8");
    // Trois chemins independants doivent subsister : rectangle immediat,
    // repli au defilement, filet temporise. Si l'un disparait, ce test le dit.
    expect(js, "test de rectangle immediat").toMatch(/getBoundingClientRect/);
    expect(js, "repli sur l'evenement scroll").toMatch(/addEventListener\(['"]scroll['"]/);
    expect(js, "filet temporise").toMatch(/setTimeout/);
  });
});
