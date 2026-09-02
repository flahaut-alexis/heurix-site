import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// UN JETON CSS QUI N'EXISTE PAS NE LEVE RIEN : LA DECLARATION DISPARAIT.
//
// Un `var()` posé sur un jeton jamais declare rend la propriete « invalid at
// computed-value time » : elle retombe a `unset`. Pour `background`, non
// heritee, cela vaut `initial`, donc transparent. Aucune erreur, aucun
// avertissement, aucune trace en console -- la boite s'affiche simplement
// sans son fond, et rien ne distingue ce cas d'un choix de design.
//
// LE CAS QUI A OUVERT LA FAMILLE (2 septembre 2026) : l'etat vide de
// l'apercu de recherche de la console (`console.js`, fonction
// `refreshSoPreview`) posait l'encart « Rapprocher X de : » avec
// un fond pris sur le jeton `--surface-2`, qui n'a jamais existe ici --
// son unique occurrence etait cette ligne. Mesure au rendu, sur la vraie
// page et sa vraie feuille de style, en lisant les pixels peints :
//
//     boite du code    255,255,255   <- le panneau blanc transparait
//     meme boite en    247,248,252   <- --bg-soft, temoin
//     --bg-soft
//
// L'encart etait donc invisible en tant qu'encart depuis sa creation, sur un
// panneau `.console-panel` lui aussi blanc. Seule sa bordure a 1,21:1 le
// separait du fond.
//
// POURQUOI AUCUN GARDE NE LE VOYAIT, VERIFIE DANS LES DEUX SENS le jour meme :
// la suite complete (47 fichiers, 578 tests) passe AVEC le defaut present.
//
// `classement-fond.test.js` en particulier est aveugle DEUX FOIS, et les deux
// cecites sont independantes :
//
//   1. il lit les fichiers CSS, jamais les styles en ligne d'un `.js` -- or
//      la console construit cet encart par concatenation de chaines ;
//   2. il ne voit que les composants qui DECLARENT `color` sur un jeton
//      d'encre, quand le texte de cet encart HERITE le sien de
//      `.console-empty`.
//
// UN TEST DE FOND QUI NE VOIT NI L'HERITAGE NI LES STYLES EN LIGNE COUVRE
// MOINS QUE SON NOM NE PROMET. Le nom `classement-fond` se lit comme « les
// fonds sont classes » ; ce qu'il garantit est « les fonds DECLARES DANS UN
// FICHIER CSS sont classes ». L'ecart entre les deux lectures est exactement
// l'endroit ou ce defaut a vecu. Ce test-ci ne comble pas cet ecart -- il
// couvre une autre famille, celle du jeton absent -- et le dire ici evite de
// croire que les deux ensemble ferment le sujet. Ils ne le ferment pas : un
// composant qui herite son encre dans un style en ligne reste hors des deux.
//
// CE QUE CE TEST EXIGE, et c'est volontairement plus large que le cas :
// tout `var()` du depot doit soit designer un jeton declare quelque part,
// soit porter un repli (`var(--x, valeur)`). Les deux autres orphelins
// trouves par le balayage d'ouverture -- `--bg-card` et `--ok` -- portent
// justement un repli et rendent correctement ; ils ne sont pas des defauts,
// et cette regle les accepte sans avoir a les nommer.
//
// DANGER PROPRE A CE GARDE : SON COMMENTAIRE PEUT LE DESARMER.
//
// Ce fichier se lit lui-meme. Il est dans le perimetre qu'il balaye, et rien
// dans son code ne l'en exclut -- volontairement, parce qu'une exclusion
// serait un angle mort de plus. Deux consequences, et la seconde est la
// mauvaise :
//
//   FAUX POSITIF -- ecrire ici la forme litterale d'un emploi sans repli sur
//   un jeton absent fait echouer le garde sur un arbre sain. C'est arrive le
//   2 septembre 2026, a la premiere execution : l'en-tete citait le jeton
//   fautif pour l'expliquer, et se faisait nommer a sa place. Genant, bruyant,
//   et decouvert en une seconde.
//
//   NEUTRALISATION -- ecrire ici un nom de jeton suivi d'un DEUX-POINTS le
//   fait entrer dans l'ensemble des declarations. Le jeton devient declare
//   POUR TOUT LE DEPOT, et l'emploi fautif qui vit ailleurs cesse d'etre
//   signale. Le test reste VERT.
//
// Les deux viennent du meme geste -- documenter le defaut en le citant -- et
// ils n'ont pas le meme prix. Le premier se voit puisqu'il crie. Le second ne
// produit aucun signal : pas d'echec, pas d'avertissement, pas de ligne en
// moins dans un rapport. Il ne se distingue d'un depot sain par rien du tout.
//
// C'EST LA FORME QU'AUCUNE DES AUTRES NE PREND : ailleurs dans ce depot, un
// commentaire qui ment finit par rencontrer une mesure qui le contredit.
// Celui-ci ne ment pas -- il est vrai, il explique juste, et c'est le fait
// meme de l'ecrire qui supprime la detection qu'il decrit. Une explication
// devenue neutralisation ne peut pas etre demasquee par ce qu'elle affirme,
// puisqu'elle n'affirme rien de faux.
//
// D'OU LA REGLE, ET ELLE S'ACCROCHE A UN GESTE DEJA FAIT : on ne cite pas un
// jeton dans ce fichier autrement que nu, sans `var()` autour et sans
// deux-points derriere. Le controle tient en une commande, et il se lance
// avant de commiter une modification de ce fichier -- il doit rendre 0 :
//
//   grep -cE 'var\(\s*--[A-Za-z0-9_-]+\s*\)' tests/jetons-declares.test.js
//
// Le temoin ci-dessous ne couvre PAS ce cas : il verifie que des jetons connus
// sont vus, pas qu'un jeton inconnu n'a pas ete invente ici. Un garde de plus
// serait a ecrire le jour ou ce fichier grossit.
//
// PERIMETRE DERIVE, ET C'EST CE QUI COMPTE : les declarations comme les
// emplois sont extraits de l'arbre suivi. Aucune liste de jetons, aucune
// liste de fichiers, aucune liste d'exceptions -- donc rien qui puisse se
// perimer en silence, et un jeton ajoute demain est couvert sans qu'on y
// pense. Le repertoire en point est saute : sous `.claude/` vivent les
// worktrees des autres sessions, et les compter reviendrait a repondre sur
// le disque quand la question porte sur le depot.
// ---------------------------------------------------------------------------

const EXTENSIONS = /\.(css|js|html|svg)$/;

const fichiersDe = (dossier) => {
  const sortie = [];
  for (const e of fs.readdirSync(path.join(RACINE, dossier), { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const rel = dossier === "." ? e.name : `${dossier}/${e.name}`;
    if (e.isDirectory()) sortie.push(...fichiersDe(rel));
    else if (EXTENSIONS.test(e.name)) sortie.push(rel);
  }
  return sortie;
};

const FICHIERS = fichiersDe(".");

const declares = new Set();
for (const f of FICHIERS) {
  const s = fs.readFileSync(path.join(RACINE, f), "utf8");
  for (const m of s.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) declares.add(m[1]);
}

// Emplois SANS repli : la parenthese se referme juste apres le nom du
// jeton, sans virgule -- une valeur de repli, elle, rend l'emploi sur.
//
// A NE PAS ECRIRE DANS CE FICHIER : ni la forme litterale d'un emploi sans
// repli, ni un nom de jeton suivi d'un deux-points. Voir « DANGER PROPRE A CE
// GARDE » en tete -- le second cas laisse le test VERT.
const emploisSansRepli = [];
for (const f of FICHIERS) {
  const s = fs.readFileSync(path.join(RACINE, f), "utf8");
  s.split("\n").forEach((ligne, i) => {
    for (const m of ligne.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*([,)])/g)) {
      if (m[2] === ")") emploisSansRepli.push({ jeton: m[1], fichier: f, ligne: i + 1 });
    }
  });
}

describe("tout var() designe un jeton declare, ou porte un repli", () => {
  // TEMOINS. Sans eux, « aucun manquant » et « je n'ai rien lu » ont la meme
  // forme -- et c'est la forme rassurante qui s'impose. Ils tombent si la
  // marche d'arbre, l'extraction des declarations ou celle des emplois cesse
  // de fonctionner, avant que l'assertion utile ne rende son verdict.
  it("l'instrument repond juste sur du connu", () => {
    expect(FICHIERS).toContain("styles.css");
    expect(FICHIERS).toContain("console.js");
    expect(declares.has("--bg-soft")).toBe(true);
    expect(declares.has("--ink-muted")).toBe(true);
    expect(declares.size).toBeGreaterThan(30);
    // et le balayage des emplois voit bien quelque chose
    expect(emploisSansRepli.length).toBeGreaterThan(50);
  });

  it("aucun jeton employe sans repli n'est absent des declarations", () => {
    const manquants = emploisSansRepli.filter((e) => !declares.has(e.jeton));
    const details = manquants.map(
      (e) => `${e.fichier}:${e.ligne} emploie var(${e.jeton}), jamais declare`
    );
    expect(details).toEqual([]);
  });
});
