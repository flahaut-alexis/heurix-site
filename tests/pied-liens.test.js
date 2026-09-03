import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// LE PIED DE PAGE PORTE LES MEMES LIENS PARTOUT, MOINS CELUI DE LA PAGE
// COURANTE (4 septembre 2026).
//
// `entete-structure.test.js` ferme l'en-tete depuis le 26 aout. Il compare des
// SQUELETTES et ignore volontairement les href -- ce qui laissait le pied
// entier hors de portee : sa derive n'est pas structurelle, elle est dans les
// CIBLES. Mesure avant ce test : 67 jeux de liens distincts pour 73 pages
// francaises.
//
// TROIS LECTURES SUCCESSIVES DE LA MEME POPULATION, TOUTES FAUSSES, ET DE PLUS
// EN PLUS FAUSSES -- c'est ce qui a rendu ce test necessaire :
//
//   « integrations.html manque un lien que les autres ont »   (audit)
//   « 64 pages sur 77 ne portent pas le lien FAQ »            (premiere mesure)
//   « faq.html n'a jamais ete dans le pied ; les 13 qui la    (mesure juste)
//     portent sont l'ecart »
//
// LA NORMALISATION QUI A PRODUIT LA DEUXIEME LECTURE ETAIT BIAISEE, et son
// resultat etait plausible -- 71,6 %, un chiffre qu'on ne remet pas en cause.
// Elle RESTITUAIT l'auto-lien avant de comparer : or restituer l'auto-lien ne
// change rien pour une page deja citee par le pied, et ajoute un element
// etranger pour toutes les autres. La « majorite » selectionnait donc
// exactement les pages qui se lient elles-memes. **Une normalisation qui n'est
// pas neutre par rapport a la propriete mesuree choisit sa reponse, et rien
// dans son resultat ne le dit.**
//
// D'OU LA POPULATION EMPLOYEE ICI : les pages que le pied ne cite JAMAIS. Pour
// elles, `liens == REFERENCE` sans soustraction, donc l'auto-omission ne peut
// pas fausser le releve. La reference se lit sur elles seules, jamais sur les
// pages qui sont elles-memes des cibles.
// ---------------------------------------------------------------------------

/**
 * PERIMETRE ET EXCLUSIONS SONT DERIVES, PAS ENUMERES. Le depot a etabli
 * qu'une liste de noms se perime en silence -- elle ne dit rien le jour ou
 * une page change de famille. Chaque regle ci-dessous se relit sur la page
 * elle-meme, et une page qui cesse d'y repondre rentre seule dans le
 * perimetre.
 *
 *   1. Pas de bloc `.foot-links`  -> hors sujet. Sort les 5 maquettes sans
 *      pied, le fragment `downloads/`, `supervision.html`, et les 4 pages de
 *      la boutique fictive, qui ont un `<footer>` de faux marchand.
 *
 *   2. `robots: nofollow`         -> une page qui demande aux robots de ne pas
 *      suivre ses liens n'a aucun enjeu de completude de liens. Rend
 *      aujourd'hui bienvenue.html et en/bienvenue.html : pages
 *      post-abonnement, atteintes par un courriel et non par le site.
 *
 *   3. `nav-links-console`        -> l'espace connecte. Meme propriete derivee
 *      que celle dont `entete-structure.test.js` tire son exception console :
 *      la page porte une navigation d'application, pas celle du site.
 *
 * Aucune des trois ne nomme un fichier. Si `bienvenue.html` perdait son
 * `nofollow`, ou la console sa nav applicative, elles redeviendraient
 * justiciables du test sans que personne ait a toucher a cette liste.
 */
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

/** Les liens du pied, cibles resolues depuis la racine. `null` = hors perimetre. */
function liensDuPied(abs) {
  const src = fs.readFileSync(abs, "utf8");
  const bloc = /<div class="foot-links">([\s\S]*?)<\/div>/.exec(src);
  if (!bloc) return null;                                    // regle 1
  const robots = /<meta[^>]*name="robots"[^>]*content="([^"]*)"/i.exec(src);
  if (robots && /nofollow/i.test(robots[1])) return null;    // regle 2
  if (src.includes("nav-links-console")) return null;        // regle 3

  const rel = path.relative(RACINE, abs);
  const dossier = path.dirname(rel);
  const cibles = new Set();
  for (const m of bloc[1].matchAll(/<a href="([^"]+)"/g)) {
    const href = m[1];
    if (href.startsWith("mailto:")) { cibles.add("@mail"); continue; }
    if (href === "#") { cibles.add("@cookies"); continue; }
    if (/^https?:/.test(href)) { cibles.add(href); continue; }
    const sansAncre = href.split("#")[0];
    cibles.add(path.normalize(path.join(dossier, sansAncre)).split(path.sep).join("/"));
  }
  return cibles;
}

function releve() {
  const parPage = new Map();
  for (const abs of pagesHtml()) {
    const l = liensDuPied(abs);
    if (l) parPage.set(path.relative(RACINE, abs).split(path.sep).join("/"), l);
  }
  // L'univers des cibles : tout ce qu'un pied nomme, quelque part.
  const univers = new Set();
  for (const l of parPage.values()) for (const c of l) univers.add(c);

  const parLangue = {};
  for (const langue of ["fr", "en"]) {
    const pages = [...parPage.keys()].filter(
      (p) => p.startsWith("en/") === (langue === "en")
    );
    // LES NEUTRES : jamais citees par un pied, donc l'auto-omission ne leur
    // retire rien. Ce sont les seules ou `liens == REFERENCE` exactement.
    const neutres = pages.filter((p) => !univers.has(p));
    const compte = new Map();
    for (const p of neutres) {
      const cle = [...parPage.get(p)].sort().join("|");
      compte.set(cle, (compte.get(cle) || 0) + 1);
    }
    let ref = null;
    for (const [cle, n] of compte)
      if (!ref || n > compte.get(ref)) ref = cle;
    parLangue[langue] = {
      pages,
      neutres,
      reference: ref ? new Set(ref.split("|")) : new Set(),
      part: neutres.length ? compte.get(ref) / neutres.length : 0,
    };
  }
  return { parPage, parLangue };
}

describe("liens du pied de page — une reference par langue", () => {
  it("chaque page porte la reference de sa langue, moins son propre lien", () => {
    const { parPage, parLangue } = releve();
    const fautives = [];
    for (const [p, liens] of parPage) {
      const { reference } = parLangue[p.startsWith("en/") ? "en" : "fr"];
      // L'AUTO-OMISSION EST LA REGLE, PAS UNE EXCEPTION : l'attendu est la
      // reference PRIVEE de la page courante. Un pied qui se lie a lui-meme
      // echoue donc au meme titre qu'un pied incomplet -- sans quoi ce test
      // redemanderait le lien qu'on retire deliberement.
      const attendu = new Set([...reference].filter((c) => c !== p));
      const manque = [...attendu].filter((c) => !liens.has(c)).sort();
      const enTrop = [...liens].filter((c) => !attendu.has(c)).sort();
      if (manque.length || enTrop.length) fautives.push({ p, manque, enTrop });
    }

    const aide = fautives.length
      ? "\n\n" +
        fautives
          .map(
            ({ p, manque, enTrop }) =>
              `  ${p}` +
              (manque.length ? `\n      manque : ${manque.join(", ")}` : "") +
              (enTrop.length ? `\n      en trop : ${enTrop.join(", ")}` : "")
          )
          .join("\n") +
        "\n\nLe pied de ces pages ne porte pas les memes liens que les autres.\n" +
        "Un lien « en trop » qui est la page elle-meme n'en est pas un : c'est\n" +
        "l'auto-omission, et elle est la regle. Tout autre ecart vient du geste\n" +
        "que CLAUDE.md documente -- on copie la voisine, jamais la meilleure.\n"
      : "";

    expect(fautives.map((f) => f.p), `Pied(s) divergent(s).${aide}`).toEqual([]);
  });

  it("la reference tient une large majorite des pages neutres", () => {
    // CE TEST MESURE SA PROPRE LEGITIMITE. Si la « reference » devenait
    // minoritaire, l'assertion precedente validerait la derive au lieu de la
    // signaler -- elle comparerait tout le monde a un jeu que presque
    // personne ne porte. Mesure le 4 septembre 2026, AVANT unification :
    // 70,2 % cote FR, 98,1 % cote EN. Le seuil est donc rouge avant, vert
    // apres, et il ne peut pas etre satisfait par un pied uniformement faux.
    const { parLangue } = releve();
    for (const langue of ["fr", "en"])
      expect(
        parLangue[langue].part,
        `La reference ${langue.toUpperCase()} n'est tenue que par ` +
          `${(parLangue[langue].part * 100).toFixed(1)} % des pages neutres.`
      ).toBeGreaterThan(0.9);
  });

  it("les deux langues portent une reference de meme taille", () => {
    // Un pied anglais complet et un pied francais complet doivent avoir le
    // meme nombre d'entrees : les pages different (confidentialite.html vs
    // en/privacy.html), la structure non. Un ecart ici signale qu'une langue
    // a recu une entree que l'autre n'a pas.
    const { parLangue } = releve();
    expect(parLangue.fr.reference.size).toBe(parLangue.en.reference.size);
  });

  it("chaque page neutre existe reellement sur le disque", () => {
    // Un pied peut etre coherent et pointer dans le vide : `liens-relatifs`
    // couvre deja les cibles, mais seulement pour les liens ECRITS. La
    // reference etant DERIVEE, une cible morte deviendrait la norme.
    const { parLangue } = releve();
    const morts = [];
    for (const langue of ["fr", "en"])
      for (const c of parLangue[langue].reference) {
        if (c.startsWith("@") || /^https?:/.test(c)) continue;
        if (!fs.existsSync(path.join(RACINE, c))) morts.push(c);
      }
    expect(morts, "Cible de reference absente du disque.").toEqual([]);
  });
});
