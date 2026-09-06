import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// LE SITE PROMET DES INTEGRATIONS QUI N'EXISTENT PAS (6 septembre 2026).
//
// Mesure du jour, avant ce test :
//
//   Shopify      aucun depot, aucun code, nulle part sous ~/Developer.
//   Magento      aucun depot, et meme pas de page magento.html.
//   WooCommerce  un depot reel. Les quatre affirmations techniques de
//                woocommerce.html se verifient dans le code : pre_get_posts
//                (class-heurix-search.php:19), DUREE_SECONDES = 60,
//                SEUIL_ECHECS = 3, TAILLE_LOT = 100.
//   PrestaShop   vrai, trois campagnes.
//
// CE QUI REND CE TEST NECESSAIRE N'EST PAS shopify.html. L'audit est parti de
// trois pages nommees ; la formulation la plus repandue vit dans la
// NAVIGATION PARTAGEE, au present, sur 138 fichiers :
//
//     <span class="nav-row-d">Rendu par votre th&egrave;me, via la Section
//     Rendering API.</span>
//
// Une affirmation logee dans un gabarit se replique sans jamais etre ecrite
// une seconde fois. Personne ne relit une nav. C'est le meme mecanisme que les
// seize pages GTM du 5 septembre, ou sept pages non nettoyees sont devenues la
// source d'ou le defaut s'est recopie -- et c'est pourquoi le perimetre
// ci-dessous se derive de l'arbre au lieu d'enumerer des noms de fichiers : le
// jour ou la nav gagne une page, elle entre seule dans le test.
//
// LE TEMOIN NEGATIF EST AUSSI IMPORTANT QUE LES MOTIFS. docs.html dit deja de
// Shopify : « Non verifie a ce jour. Ecrivez-nous plutot que de suivre une
// recette approximative. » C'est la formulation MODELE, pas une infraction. Un
// garde qui la rougirait pousserait a la supprimer -- il ferait reculer la
// franchise qu'il est cense defendre. Le second test l'epingle explicitement.
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

/**
 * PERIMETRE DERIVE, PAS ENUMERE -- regle 1 de `pied-liens.test.js`, reprise
 * telle quelle : pas de bloc `.foot-links` -> ce n'est pas une page du site.
 * Sort les maquettes de `docs/maquettes/`, qui portent encore « Integration
 * via l'App Store Shopify » dans deux propositions de menu jamais retenues ;
 * elles ne sont pas servies (« MAQUETTE -- pas servie », en tete de chacune).
 *
 * ON N'EXCLUT PAS SUR `robots: noindex`, ET C'EST LE POINT. Le premier jet de
 * ce test le faisait -- le motif de nav attrapait alors 131 pages au lieu de
 * 138, et les 7 manquantes etaient :
 *
 *     404.html   bienvenue.html   cgv.html   confidentialite.html
 *     mentions-legales.html   en/404.html   en/bienvenue.html
 *
 * Or les CGV, les mentions legales et la politique de confidentialite SONT
 * servies : un visiteur les lit, avec la meme nav et la meme affirmation
 * fausse. Elles sont seulement absentes de l'index des moteurs. `noindex`
 * repond a « cette page est-elle referencee ? », quand la question posee est
 * « un visiteur peut-il lire cette phrase ? ». Deux populations voisines, un
 * ecart de 7 pages, et le proxy commode retirait justement les pages ou une
 * promesse fausse engage le plus -- celles qui portent le contrat.
 *
 * Retourne la source, ou `null` si la page est hors perimetre.
 */
function pageServie(abs) {
  const src = fs.readFileSync(abs, "utf8");
  if (!/<div class="foot-links">/.test(src)) return null;
  return src;
}

/**
 * Chaque motif nomme une AFFIRMATION, pas une page. Les deux langues sont dans
 * la meme alternance : une correction qui n'en traite qu'une laisse le test
 * rouge, ce qui est exactement le rappel voulu.
 *
 * Les entites HTML sont dans les motifs (`th&egrave;me`, `compl&egrave;te`) :
 * la nav est ecrite en entites, le corps des pages en UTF-8, et un motif qui
 * n'accepterait qu'une des deux graphies raterait precisement la population la
 * plus nombreuse.
 */
const MOTIFS = [
  {
    id: "nav-rendering-api",
    quoi: "La nav affirme au present un rendu via la Section Rendering API.",
    motif:
      /nav-row-d">(?:Rendu par votre th(?:&egrave;|è)me, via la Section Rendering API|Rendered by your theme, via the Section Rendering API)/g,
    aLaPlace:
      "Intégration via l'API REST documentée. / Integration via the documented REST API.",
  },
  {
    id: "extension-de-theme-existe",
    quoi: "Affirme qu'une extension de theme Shopify existe.",
    motif:
      /(?:Une extension de th(?:&egrave;|è)me existe|A theme extension exists)/g,
    aLaPlace: "Ce qui existe : l'API. / What exists: the API.",
  },
  {
    id: "extension-de-theme-disponible",
    quoi: "Meta description : annonce une extension de theme disponible.",
    motif:
      /(?:Extension de th(?:&egrave;|è)me disponible|Theme extension available)/g,
    aLaPlace:
      "Intégration via l'API REST documentée. / Integration via the documented REST API.",
  },
  {
    id: "integrations-shopify-a-une-extension",
    quoi: "integrations.html annonce une extension de theme Shopify.",
    motif:
      /Shopify<\/strong> (?:a une extension de th(?:&egrave;|è)me|has a theme extension)/g,
    aLaPlace:
      "Shopify n'a que le guide ci-dessous. / Shopify only has the guide below. (patron deja vrai pour Magento)",
  },
  {
    id: "app-store-pas-encore-publiee",
    quoi:
      "Annonce une app App Store en attente de validation. Rien n'a ete soumis, et « pas encore » est une promesse datee sans la date.",
    motif:
      /(?:L'application compl(?:&egrave;|è)te|The full app)[\s\S]{0,80}App Store/g,
    aLaPlace:
      "Retirer. Aucune app n'existe ni n'est soumise ; ne rien annoncer pour plus tard.",
  },
  {
    id: "objectif-rendu-shopify",
    quoi: "« L'objectif est que » : promesse future sur un rendu inexistant.",
    motif:
      /(?:L'objectif est que Shopify dessine|The goal is for Shopify to draw)/g,
    aLaPlace: "Décrire ce que le guide fait, au présent, sans objectif.",
  },
  {
    id: "demander-le-module-shopify",
    quoi:
      "Un CTA « Demander le module » vise Shopify. Le meme libelle est LEGITIME sur woocommerce.html : c'est le sujet du courriel qui distingue les deux, pas le libelle.",
    motif: /subject=Module%20shopify/gi,
    aLaPlace:
      "subject=Catalogue%20shopify, et « Parler de votre catalogue Shopify » / « Talk about your Shopify catalog ».",
  },
  {
    id: "connecteurs-en-preparation",
    quoi: "« en préparation » / « in progress » : promesse future sans date.",
    motif:
      /(?:connecteurs vers les plateformes e-commerce[\s\S]{0,40}en pr(?:&eacute;|é)paration|Connectors for e-commerce platforms are in progress)/gi,
    aLaPlace:
      "Les plateformes e-commerce se branchent sur cette API. / E-commerce platforms connect through this API.",
  },
  {
    // Trouve APRES le premier jet de ce test, en verifiant la prediction « en/
    // pricing.html porte sans doute la meme phrase ». Elle la portait -- et la
    // page en portait une SECONDE, dans une carte, que l'audit initial n'avait
    // relevee dans aucune des deux langues.
    id: "connecteurs-dedies-a-venir",
    quoi:
      "« En attendant les connecteurs dédiés » : promesse future sans date, la meme forme que « bientôt disponible » avec le mot en moins.",
    motif:
      /(?:En attendant les connecteurs d(?:&eacute;|é)di(?:&eacute;|é)s|While waiting for dedicated connectors)/g,
    aLaPlace:
      "L'intégration se fait via l'API REST documentée. / Integration goes through the documented REST API.",
  },
  {
    id: "delai-woocommerce-constate",
    quoi:
      "« constaté » / « observed » affirme une observation. Le plugin WooCommerce est reel et installable, mais rien n'atteste qu'il ait tourne sur un WordPress : ni test, ni CI, ni artefact d'execution. Le chiffre peut rester, l'observation non.",
    motif:
      /(?:Temps d'int(?:&eacute;|é)gration constat(?:&eacute;|é)|Integration time observed)/g,
    aLaPlace:
      "Estimation, sur un catalogue déjà exporté. / Estimate, on a catalog already exported.",
  },
];

/** La formulation modele, relevee sur le site lui-meme. Voir le second test. */
const TEMOIN_NEGATIF =
  "Non vérifié à ce jour. Écrivez-nous plutôt que de suivre une recette approximative.";

function ligneDe(src, index) {
  return src.slice(0, index).split("\n").length;
}

function releve() {
  const infractions = [];
  for (const abs of pagesHtml()) {
    const src = pageServie(abs);
    if (src === null) continue;
    const page = path.relative(RACINE, abs).split(path.sep).join("/");
    for (const m of MOTIFS) {
      for (const t of src.matchAll(m.motif)) {
        infractions.push({
          page,
          langue: page.startsWith("en/") ? "en" : "fr",
          ligne: ligneDe(src, t.index),
          id: m.id,
          extrait: t[0].replace(/\s+/g, " ").slice(0, 90),
        });
      }
    }
  }
  return infractions;
}

function rapport(infractions) {
  const parMotif = new Map();
  for (const i of infractions) {
    if (!parMotif.has(i.id)) parMotif.set(i.id, []);
    parMotif.get(i.id).push(i);
  }
  const pages = new Set(infractions.map((i) => i.page));
  const lignes = [
    "",
    `${infractions.length} affirmation(s) sur ${pages.size} page(s).`,
    "",
  ];
  for (const m of MOTIFS) {
    const lot = parMotif.get(m.id);
    if (!lot) continue;
    const fr = lot.filter((i) => i.langue === "fr").length;
    const en = lot.filter((i) => i.langue === "en").length;
    const p = new Set(lot.map((i) => i.page));
    lignes.push(
      `[${m.id}] ${lot.length} occurrence(s), ${p.size} page(s) -- fr ${fr} / en ${en}`,
      `    ${m.quoi}`,
      `    a la place : ${m.aLaPlace}`
    );
    for (const i of [...lot].sort((a, b) => a.page.localeCompare(b.page)).slice(0, 6)) {
      lignes.push(`      ${i.page}:${i.ligne}  « ${i.extrait} »`);
    }
    if (p.size > 6) lignes.push(`      ... et ${p.size - 6} page(s) de plus`);
    lignes.push("");
  }
  return lignes.join("\n");
}

describe("les pages servies ne promettent que ce qui existe", () => {
  it("aucune page n'affirme qu'une integration Shopify ou Magento existe", () => {
    const infractions = releve();
    expect(infractions, rapport(infractions)).toHaveLength(0);
  });

  // GARDER LA RAISON DE NE RIEN FAIRE. Sans ce test, la premiere simplification
  // qui elargirait un motif -- « toute phrase citant Shopify et un delai » --
  // rougirait la seule page qui dit deja la verite, et la correction evidente
  // serait de la reecrire. Le temoin rend ce cout visible avant.
  it("le temoin negatif : la formulation modele n'est pas une infraction", () => {
    const porteuses = pagesHtml()
      .filter((abs) => {
        const src = pageServie(abs);
        return src !== null && src.includes(TEMOIN_NEGATIF);
      })
      .map((abs) => path.relative(RACINE, abs).split(path.sep).join("/"));

    // Le temoin doit exister, sinon ce test se viderait en silence le jour ou
    // la phrase serait reformulee -- vert, et ne testant plus rien.
    expect(porteuses.length).toBeGreaterThan(0);

    for (const m of MOTIFS) {
      expect(
        TEMOIN_NEGATIF.match(m.motif),
        `Le motif [${m.id}] rougit la formulation modele portee par ${porteuses.join(", ")}`
      ).toBeNull();
    }
  });
});
