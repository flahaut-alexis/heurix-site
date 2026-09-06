import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// UN LIEN RELATIF DOIT ATTEINDRE UN FICHIER QUI EXISTE (27 aout 2026).
//
// Vingt-deux liens morts trouves d'un coup, dont les NEUF liens de
// telechargement des widgets cote anglais : un marchand anglophone qui
// cliquait « Download heurix-search.js » recevait un 404. Depuis toujours.
//
// La cause est celle que CLAUDE.md nomme deja -- on copie la voisine -- mais
// dans une forme qui echappe a tout le reste : une page anglaise recopiee
// d'une page francaise, a une profondeur de plus.
//
//   blog/guide-mise-en-route.html      ../downloads/x.js -> downloads/x.js    OK
//   en/blog/guide-mise-en-route.html   ../downloads/x.js -> en/downloads/x.js 404
//   solutions/index.html               ../logo.svg       -> logo.svg          OK
//   en/solutions/index.html            ../logo.svg       -> en/logo.svg       404
//
// POURQUOI RIEN NE LES VOYAIT :
//
//  - le clic ne les trouve pas, parce que personne ne clique les pages
//    anglaises. Toutes les verifications a l'ecran de ce depot sont parties
//    de la version francaise ;
//  - le controle de coherence des clefs de cache ne PEUT PAS les voir : il
//    normalise les « ../ » avant de comparer, donc en/solutions/../logo.svg
//    et blog/../logo.svg lui paraissent le meme actif. Il compare des
//    CHAINES. Ce n'est pas un defaut a corriger la-bas, c'est ce
//    controle-ci qui manquait. Les huit logos morts portaient d'ailleurs une
//    clef ?v= parfaitement coherente avec le reste du site ;
//  - un remplacement de texte peut reussir partout et mener nulle part.
//    D'ou la seule verification qui compte ici : resoudre le chemin depuis
//    le dossier de SA page, et demander au disque si le fichier est la.
//
// PERIMETRE DERIVE, JAMAIS ENUMERE : toutes les pages .html du depot, tous
// les href et src qu'elles portent. Aucune liste de pages, aucune liste
// d'extensions.
// ---------------------------------------------------------------------------

/**
 * Exceptions LEGITIMES, chacune avec sa raison, clef « page :: lien ».
 * Un lien mort absent d'ici fait echouer le test ; une exception dont le
 * lien resout desormais le fait echouer aussi.
 */
// LA LISTE EST VIDE DEPUIS LE 28 AOUT 2026, et c'est le garde qui l'a exige.
// Elle portait les deux emplacements de `img/photo-alexis.jpg`, avec la
// mention « a retirer d'ici le jour ou la photo arrive dans img/ ». La photo
// est arrivee, le test « aucune exception n'est perimee » est tombe, et les
// deux entrees sont parties. C'est exactement ce que ce test-la sert a
// produire : une exception qui survit a sa raison est un mensonge qui passe.
const EXCEPTIONS = new Map([]);

/** Schemas qui ne designent pas un fichier du depot. */
const SCHEMA = /^(https?:|\/\/|mailto:|tel:|data:|javascript:)/;

const pages = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    if (e.isDirectory()) parcourir(rel);
    else if (e.name.endsWith(".html")) pages.push(rel);
  }
})("");

/**
 * Un lien est ce que le NAVIGATEUR va chercher : ce qu'un visiteur clique, et
 * ce que la page charge pour son compte. Le code AFFICHE n'en est pas -- les
 * guides montrent `<script src="heurix-search.js">` pour dire au marchand quoi
 * coller chez lui, et integrations.html montre un gabarit
 * `${h.product.handle}`. Les deux vivent dans un <pre>, et aucune occurrence
 * n'existe ailleurs : la regle se derive, au lieu de nommer huit exceptions
 * qu'il faudrait ensuite maintenir.
 *
 * « CE QU'UN VISITEUR PEUT SUIVRE » ETAIT LA DEFINITION D'AVANT, et c'est elle
 * qui laissait le trou ci-dessous : un <script src> n'est suivi par personne,
 * donc il n'etait pas un lien, donc il n'etait pas verifie. La definition
 * n'etait pas fausse -- elle etait plus etroite que le fichier qui la portait.
 *
 * LE RETRAIT DES BLOCS <script> EMPORTAIT AUSSI LE <script src> LUI-MEME
 * (6 septembre 2026).
 *
 * La ligne qui neutralise le code affiche retirait `<script ...>...</script>`
 * d'un bloc -- balise ouvrante comprise. Le `src` de cette balise ouvrante
 * n'etait donc jamais collecte, et AUCUN chargement de script n'a jamais ete
 * verifie par ce test, sur aucune page.
 *
 * Ce que ca a laisse passer : `en/pricing.html` et `en/bienvenue.html`
 * ecrivaient `src="consent.js"` depuis `en/`, donc `en/consent.js`, qui
 * n'existe pas. Le module de consentement ne se chargeait pas du tout sur ces
 * deux pages -- pas un lien mort au fond d'un pied de page, le bandeau de
 * traceurs absent. C'est exactement la famille que ce fichier documente en
 * tete, « une page anglaise recopiee d'une francaise a une profondeur de
 * plus », dans le seul endroit du balisage ou il ne regardait pas.
 *
 * D'OU L'ORDRE, qui porte tout le correctif : les <pre> partent EN PREMIER,
 * puis on collecte les `src` des balises <script> restantes, et seulement
 * ensuite on retire les blocs. Retirer les blocs d'abord, c'est se priver de
 * la balise avant de l'avoir lue.
 */
const lireBrut = (page) => fs.readFileSync(path.join(RACINE, page), "utf8");

function liensDe(page) {
  const brut = lireBrut(page);
  // Le code MONTRE au marchand part d'abord : les guides affichent un
  // `<script src="heurix-search.js">` a coller chez lui, qui ne designe aucun
  // fichier de ce depot. Il vit dans un <pre>, et c'est ce qui le distingue
  // d'un chargement reel -- la regle se derive, au lieu de nommer des
  // exceptions qu'il faudrait ensuite maintenir.
  const sansPre = brut.replace(/<pre\b[\s\S]*?<\/pre>/g, "");
  const out = [];
  for (const m of sansPre.matchAll(/<script\b[^>]*\bsrc="([^"#][^"]*?)(?:\?[^"]*)?(?:#[^"]*)?"/g)) {
    out.push(m[1]);
  }
  const s = sansPre.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  for (const m of s.matchAll(/(?:href|src)="([^"#][^"]*?)(?:\?[^"]*)?(?:#[^"]*)?"/g)) out.push(m[1]);
  return out;
}

const morts = [];
let examines = 0;
for (const page of pages) {
  for (const lien of liensDe(page)) {
    if (SCHEMA.test(lien)) continue;
    examines++;
    const cible = path.resolve(RACINE, path.dirname(page), lien);
    if (!fs.existsSync(cible)) morts.push({ page, lien, cible: path.relative(RACINE, cible) });
  }
}

describe("liens relatifs — la cible existe, pas seulement la chaine", () => {
  it("aucun lien mort en dehors des exceptions nommees", () => {
    const inattendus = morts.filter((m) => !EXCEPTIONS.has(`${m.page} :: ${m.lien}`));
    expect(inattendus.map((m) => `${m.page} :: ${m.lien} -> ${m.cible}`)).toEqual([]);
  });

  it("aucune exception n'est perimee : chacune est encore morte", () => {
    const vivantes = new Set(morts.map((m) => `${m.page} :: ${m.lien}`));
    const perimees = [...EXCEPTIONS.keys()].filter((k) => !vivantes.has(k));
    expect(perimees).toEqual([]);
  });

  it("chaque exception porte une raison lisible", () => {
    for (const [clef, raison] of EXCEPTIONS) {
      expect(raison.length, `${clef} : raison trop courte`).toBeGreaterThan(60);
      expect(raison, `${clef} : un renvoi n'est pas une raison`).not.toMatch(/^Idem\b/);
    }
  });

  // Un balayage qui n'examine rien passe au vert en ne prouvant rien. Si une
  // expression reguliere ci-dessus cesse de mordre, ce plancher le dit --
  // c'est le garde-fou que le controle de cache n'avait pas le jour ou il a
  // certifie « une seule clef sur tout le site » en n'en voyant que quatre.
  it("le balayage a reellement parcouru le site", () => {
    expect(pages.length).toBeGreaterThan(100);
    expect(examines).toBeGreaterThan(5000);
  });

  // TEMOIN POSITIF du <script src>, et il est la raison d'etre de ce bloc.
  // Le trou d'origine ne se voyait pas comme une panne : la collecte rendait
  // simplement zero script sur 146 pages, et « aucun chargement mort » avait
  // exactement la meme forme que « aucun chargement regarde ». Ce temoin est
  // ce qui separe les deux, et il tombe si quelqu'un remet le retrait des
  // blocs avant la lecture de la balise.
  it("la collecte voit les <script src> reellement charges", () => {
    expect(liensDe("en/pricing.html")).toContain("../consent.js");
    expect(liensDe("en/pricing.html")).toContain("../search-engine.js");
    expect(liensDe("index.html")).toContain("consent.js");
  });

  // TEMOIN NEGATIF : un <script src> MONTRE au marchand n'est pas un
  // chargement. Il est aujourd'hui echappe en entites dans le <pre>, donc la
  // collecte ne pourrait pas le prendre meme sans le retrait des <pre> --
  // l'assertion fixe l'intention plutot que l'echappement, qui peut changer.
  it("la collecte ignore le code montre dans un <pre>", () => {
    for (const page of ["docs.html", "en/docs.html"]) {
      expect(lireBrut(page)).toContain("heurix-search.js");
      expect(liensDe(page)).not.toContain("heurix-search.js");
    }
  });

  // C'est ce qui a fait sortir href="../javascript:void(0)" de en/console.html :
  // un prefixage « ../ » passe en masse sur la page anglaise avait prefixe un
  // schema. Le lien fonctionnait quand meme, son data-goto-pane interceptant
  // le clic -- donc rien ne l'aurait signale.
  it("un href javascript: n'est jamais prefixe par un chemin", () => {
    const malformes = [];
    for (const page of pages)
      for (const lien of liensDe(page))
        if (lien.includes("javascript:") && lien !== "javascript:void(0)")
          malformes.push(`${page} :: ${lien}`);
    expect(malformes).toEqual([]);
  });
});
