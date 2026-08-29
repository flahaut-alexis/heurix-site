import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// UN COMPORTEMENT NON PORTE NE SE VOIT PAS DANS LE HTML (29 aout 2026).
//
// `en/integrations.html` a affiche quatre onglets pendant toute sa vie sans
// jamais porter leur gestionnaire : le script est inline dans la version
// francaise et n'a pas ete recopie a la traduction. Seul le panneau Shopify
// s'ouvrait. PrestaShop, WooCommerce et Magento -- trois quarts de la page --
// etaient inatteignables en anglais.
//
// AUCUN GARDE EXISTANT NE POUVAIT LE VOIR. `entete-structure`,
// `liens-relatifs`, `canonical`, `classement-fond` lisent tous du HTML
// statique, et le HTML etait parfait : les quatre boutons etaient la, avec
// leurs `role="tab"` et leurs `aria-selected`. C'est la difficulte propre a
// cette forme --
//
//     un texte non traduit se lit, un bloc absent se compte,
//     un comportement mort ne se distingue d'un comportement vivant
//     que si on l'actionne.
//
// CE QUE CE TEST FAIT : il verifie qu'un groupe d'onglets a QUELQUE CHOSE qui
// le lit. Chacune des classes de GROUPE d'une page -- celles portees par au
// moins deux boutons `role="tab"`, voir `classesDeGroupe` plus bas -- doit
// apparaitre dans un `<script>` inline de la page ou dans un `.js` qu'elle
// charge. Toutes, pas une seule : une page a deux groupes doit avoir ses deux
// gestionnaires.
//
// CE QU'IL NE FAIT PAS, ecrit ici pour qu'on ne lui prete pas plus : c'est un
// test de PRESENCE, pas de comportement. Un gestionnaire present mais casse
// passe. La forme qui l'attraperait -- jsdom en `runScripts: "dangerously"`,
// cliquer le deuxieme onglet, verifier qu'un seul panneau reste visible --
// coute le double et exige d'injecter a la main les `.js` externes, que jsdom
// ne charge pas seul. Elle a ete chiffree et ecartee : l'angle mort n'a jamais
// ete observe ici, l'absence pure l'a ete.
//
// LE PERIMETRE EST DERIVE DES BOUTONS PRESENTS, pas d'une liste de pages. Le
// jour ou quelqu'un ajoute des onglets ailleurs, ce test les voit sans qu'on
// ait a l'editer. C'est la regle qui a ferme les autres familles cette
// semaine ; une liste ecrite ici vieillirait en silence, comme les huit
// secteurs de `secteurs.html`.
// ---------------------------------------------------------------------------

// UNE SEULE EXCEPTION, ET SA RAISON PLUTOT QUE SON CHEMIN.
//
// `docs/maquettes/` contient des maquettes de travail servies en `.html` et
// marquees `<meta name="robots" content="noindex, nofollow">` -- elles sont
// hors du site public et `canonical.test.js` les exclut par le meme predicat.
// Leurs onglets sont des dessins d'intention : ils n'ont jamais eu de
// gestionnaire et n'en attendent pas. Les inclure ferait echouer ce test sur
// des fichiers dont l'inertie est le propos.
//
// Le jour ou une maquette est promue en page publique, elle perd son `noindex`
// et ce test la reprend automatiquement -- c'est voulu.
const estMaquetteNoindex = (src, chemin) =>
  chemin.startsWith("docs/maquettes/") &&
  /<meta name="robots" content="[^"]*noindex/i.test(src);

const pages = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) parcourir(rel);
    else if (e.name.endsWith(".html")) pages.push(rel);
  }
})("");

const lire = (p) => fs.readFileSync(path.join(RACINE, p), "utf8");

// Les classes de GROUPE portees par les boutons `role="tab"`.
//
// LA PREMIERE VERSION DE CE TEST ETAIT INERTE, et c'est la falsification qui
// l'a montre : j'ai retire le gestionnaire de `en/integrations.html` et le
// test est reste vert. La cause etait ici. Je relevais TOUTES les classes des
// boutons -- donc `active` en plus de `integ-tab` -- et j'acceptais qu'UNE
// SEULE soit mentionnee quelque part. Or `active` figure dans un des scripts
// externes que la page charge. Le predicat etait satisfait sans rien lire
// d'un gestionnaire d'onglets.
//
// LE REMEDE N'EST PAS UNE LISTE DE MOTS A IGNORER -- elle vieillirait comme
// toutes les listes ecrites a la main ici. Il est derive de la structure :
//
//     une classe d'ETAT ne porte qu'UN bouton (l'onglet actif),
//     une classe de GROUPE en porte plusieurs.
//
// Mesure sur les quatre pages a onglets du site : `integ-tab` 4 boutons,
// `copilot-pill` 4, `console-tab` 9, `br-regles-onglet` 2 -- contre `active`
// 1 et `br-regles-onglet-on` 1. Le seuil de deux separe les deux familles
// sans qu'aucun nom soit ecrit ici.
//
// `console-tab-active` porte 4 boutons et passe donc le seuil : c'est normal,
// `console.html` a plusieurs groupes d'onglets ayant chacun son actif. Il est
// bien reference par `console.js`, et l'exiger ne coute rien.
//
// Une page a un seul bouton `role="tab"` ne produit aucune classe de groupe
// et sort du perimetre : un onglet seul n'est pas un groupe d'onglets.
function classesDeGroupe(src) {
  const compte = new Map();
  for (const [balise] of src.matchAll(/<(?:button|a|div)\b[^>]*>/g)) {
    if (!/\brole="tab"/.test(balise)) continue;
    const cls = balise.match(/\bclass="([^"]*)"/);
    if (!cls) continue;
    for (const c of cls[1].split(/\s+/).filter(Boolean)) {
      compte.set(c, (compte.get(c) || 0) + 1);
    }
  }
  return new Set([...compte].filter(([, n]) => n >= 2).map(([c]) => c));
}

// Tout le code que la page peut executer : ses scripts inline, et le contenu
// des `.js` qu'elle charge. Les `src` sont relatifs a la page -- `en/` charge
// `../console.js` -- et portent une clef `?v=` qu'il faut retirer.
function codeVisibleDepuis(chemin, src) {
  let code = [...src.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .join("\n");

  for (const [, brut] of src.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
    if (/^(https?:)?\/\//.test(brut)) continue; // script distant : illisible ici
    const fichier = path.resolve(path.dirname(path.join(RACINE, chemin)), brut.split("?")[0]);
    if (fichier.startsWith(RACINE) && fs.existsSync(fichier)) {
      code += "\n" + fs.readFileSync(fichier, "utf8");
    }
  }
  return code;
}

describe("onglets — un bouton role=tab doit avoir quelque chose qui le lit", () => {
  const aOnglets = pages
    .map((p) => ({ p, src: lire(p) }))
    .filter(({ p, src }) => !estMaquetteNoindex(src, p))
    .map(({ p, src }) => ({ p, src, classes: classesDeGroupe(src) }))
    .filter(({ classes }) => classes.size > 0);

  it("le perimetre n'est pas vide — sinon ce test est vert par construction", () => {
    expect(aOnglets.length).toBeGreaterThan(0);
  });

  it("chaque page a onglets porte ou charge leur gestionnaire", () => {
    const muettes = aOnglets
      .filter(({ p, src, classes }) => {
        const code = codeVisibleDepuis(p, src);
        // TOUTES, pas une seule : une page a deux groupes d'onglets doit avoir
        // ses deux gestionnaires, et « au moins une » laissait passer le cas
        // ou le second manque.
        return ![...classes].every((c) => code.includes(c));
      })
      .map(({ p, src, classes }) => {
        const code = codeVisibleDepuis(p, src);
        const muettes = [...classes].filter((c) => !code.includes(c));
        return `${p} : ${muettes.join(", ")} — aucun script ne lit cette classe`;
      });

    expect(muettes).toEqual([]);
  });

  it("les deux versions d'une meme page s'accordent sur l'existence d'un gestionnaire", () => {
    // Le defaut du 29 aout etait une ASYMETRIE : la page FR l'avait, l'EN non.
    // Le controle precedent l'attrape deja, mais celui-ci nomme la paire, qui
    // est l'information utile pour corriger.
    const desaccords = [];
    for (const { p, src, classes } of aOnglets) {
      if (p.startsWith("en/")) continue;
      const jumelle = aOnglets.find((a) => a.p === `en/${p}`);
      if (!jumelle) continue;
      const lu = (a) => {
        const code = codeVisibleDepuis(a.p, a.src);
        return [...a.classes].every((c) => code.includes(c));
      };
      const fr = lu({ p, src, classes });
      const en = lu(jumelle);
      if (fr !== en) desaccords.push(`${p} : FR ${fr ? "oui" : "non"} / EN ${en ? "oui" : "non"}`);
    }
    expect(desaccords).toEqual([]);
  });
});
