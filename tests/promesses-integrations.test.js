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
//
// LA MESURE DU 6 SEPTEMBRE EST PERIMEE POUR SHOPIFY, ET LES MOTIFS RESTENT.
// heurix-shopify existe depuis le 7 septembre 2026 (premier commit 6b04700) :
// app embarquee, import du catalogue, webhooks produits, et une extension de
// theme -- un app block de barre de recherche. L'app est soumise a la revue
// de l'App Store le 13 septembre, et au 19 septembre elle n'est ni validee ni
// refusee. Les phrases « Nous n'avons pas encore branche Heurix sur une
// boutique Shopify » et « ni extension de theme, ni application » sont donc
// restees en ligne, fausses, du 7 au 19 septembre : le garde les tenait pour
// la verite. Elles deviennent un motif (`shopify-sans-application`).
//
// Les motifs d'extension et d'App Store ne sont pas retires pour autant. Ils
// visent des formes qui PROMETTENT : « Une extension de theme existe », seule,
// dit a un marchand qu'il peut l'avoir, alors qu'elle ne s'installe qu'avec
// l'app, et l'app pas avant la fin de la revue ; « attend sa validation »
// presente l'issue de la revue comme acquise, et la revue peut refuser.
//
// Le temoin negatif change avec la page qui le portait. docs.html ne dit plus
// « Non verifie a ce jour » : l'app a tourne sur des boutiques. La formulation
// modele est desormais celle de shopify.html, qui nomme l'App Store sans
// promettre ni date ni issue.
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
      "Application en revue chez Shopify, et API REST. / App in review at Shopify, and REST API. (ligne de nav depuis le 19 septembre 2026 ; « via l'API REST documentee » taisait l'app)",
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
      "Annonce une app App Store en attente de validation. Le 6 septembre rien n'etait soumis ; depuis le 13 septembre l'app est en revue, et « attend sa validation » tient pour acquise une issue que la revue peut refuser.",
    motif:
      /(?:L'application compl(?:&egrave;|è)te|The full app)[\s\S]{0,80}App Store/g,
    aLaPlace:
      "Dire l'etat : soumise le 13 septembre 2026, ni validee ni refusee a ce jour. Ne rien annoncer pour plus tard.",
  },
  {
    id: "shopify-sans-application",
    quoi:
      "Nie l'app Shopify. Ecrit le 6 septembre, vrai ce jour-la ; faux des le 7, premier commit de heurix-shopify, et en ligne jusqu'au 19.",
    motif:
      /(?:pas encore branch(?:&eacute;|é) Heurix sur une boutique Shopify|not yet connected Heurix to a Shopify store|ni extension de th(?:&egrave;|è)me, ni application|no theme extension and no Heurix app)/g,
    aLaPlace:
      "L'app existe, en revue depuis le 13 septembre 2026 ; ce qui reste non eprouve est le guide API.",
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
      "Un CTA « Demander le module » vise Shopify. Le meme libelle etait LEGITIME sur woocommerce.html jusqu'au 28 septembre 2026 -- c'etait le sujet du courriel qui distinguait les deux, pas le libelle. Il ne l'est plus : voir `demander-le-module-woocommerce` plus bas, et les deux motifs sont desormais symetriques.",
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
      "« constaté » / « observed » affirme une observation du DELAI D'INTEGRATION, et rien ne l'atteste : aucune intégration réelle n'a été chronométrée. Le chiffre peut rester comme estimation, l'observation non.",
    // LA JUSTIFICATION DE CE MOTIF A CHANGE, PAS SON OBJET (28 septembre 2026).
    // Elle disait « rien n'atteste que le plugin ait tourne sur un WordPress :
    // ni test, ni CI, ni artefact d'execution ». C'etait vrai le 6 septembre et
    // c'est faux depuis : heurix-woocommerce porte une CI, quatre suites de
    // tests, et des relevés d'execution sur neuf WordPress et quinze
    // WooCommerce reels (22-23 septembre 2026, publiés dans
    // docs/mesures/woocommerce-bornes-2026-09). Ce qui reste non mesuré est le
    // DELAI, qui est une autre affirmation que « le code tourne » -- le motif
    // tient donc, et seule sa raison est corrigee. Une raison perimee sous un
    // garde juste est ce qui fait retirer le garde a la premiere relecture.
    motif:
      /(?:Temps d'int(?:&eacute;|é)gration constat(?:&eacute;|é)|Integration time observed)/g,
    aLaPlace:
      "Estimation, sur un catalogue déjà exporté. / Estimate, on a catalog already exported.",
  },
  // ---------------------------------------------------------------------------
  // LES DEUX MOTIFS DE LA PUBLICATION WOOCOMMERCE (28 septembre 2026).
  //
  // Le module est publie sur wordpress.org (SVN r3716469, 09:16:50). « Fournie
  // sur demande » etait vrai la veille, et vivait sur SIX pages servies : les
  // deux woocommerce.html, les deux index.html, les deux integrations.html --
  // plus les deux shopify.html, qui le disaient de WooCommerce en passant.
  // Huit affirmations, dans deux langues, pour un etat qui a change en une
  // matinee.
  //
  // CE QUE CETTE CLASSE A DE PARTICULIER : personne ne relit une phrase VRAIE.
  // La ligne Shopify de la nav a ete traitee le 19 septembre par un attribut
  // declare une fois (`data-etat-revue-shopify`, voir etat-revue-shopify.test.js) ;
  // rien de tel n'existait pour WooCommerce, et c'est pour ca que les huit ont
  // du etre trouvees par un balayage. Ces deux motifs ne remplacent pas cet
  // attribut -- ils empechent le RETOUR de la phrase, ce qui est moins, et ce
  // qui est tout ce qu'un motif peut faire.
  {
    id: "woocommerce-fourni-sur-demande",
    quoi:
      "Annonce le module WooCommerce comme fourni sur demande, ou renvoie au courriel pour l'obtenir. Vrai jusqu'au 28 septembre 2026, faux depuis : il s'installe depuis wordpress.org.",
    // CE MOTIF EST LITTERAL, ET C'EST UN CHOIX QUI SE PAIE.
    //
    // Le premier jet etait une fenetre -- « en bêta » suivi de « sur demande »
    // a moins de quarante caracteres. Elle attrapait les huit phrases retirees
    // ET la phrase de l'article qui les CITE au passe (« extension en bêta,
    // fournie sur demande », blog/module-woocommerce-publie-bornes-mesurees).
    // Un motif qui rougit le recit d'une correction pousse a effacer le recit :
    // c'est le defaut que le temoin negatif existe pour rendre visible, et ici
    // il etait DANS le motif.
    //
    // Les quatre formes sont donc nommees, comme les autres motifs de ce
    // fichier. Ce que ca coute : une reformulation neuve -- « disponible sur
    // demande », « sent on request » -- passerait. Ce que ca garde : le retour
    // des phrases qui ont reellement vecu en ligne, et la liberte de les citer.
    motif:
      /(?:module en b(?:&ecirc;|ê)ta,? fourni sur demande|est en b(?:&ecirc;|ê)ta ?: fournie sur demande|est en b(?:&ecirc;|ê)ta ?: (?:&eacute;|é)crivez-nous|beta (?:WooCommerce )?module provided on request|module in beta, provided on request|extension is in beta: provided on request|It is in beta: write to us)/g,
    aLaPlace:
      "Publiée sur wordpress.org, installable depuis l'administration WordPress. / Published on wordpress.org, installable from the WordPress admin.",
  },
  {
    id: "demander-le-module-woocommerce",
    quoi:
      "Un CTA « Demander le module » vise WooCommerce. Il etait LEGITIME jusqu'au 28 septembre 2026 -- le motif shopify ci-dessus le disait -- et il ne l'est plus : le module a une fiche publique.",
    motif: /subject=Module%20woocommerce/gi,
    aLaPlace:
      "Le lien de la fiche : fr.wordpress.org/plugins/heurix-search-for-woocommerce/ (FR), wordpress.org/... (EN).",
  },
];

/**
 * Les formulations modeles, relevees sur le site lui-meme. Voir le second test.
 *
 * LA SECONDE EST ARRIVEE AVEC LA PUBLICATION WOOCOMMERCE (28 septembre 2026).
 * integrations.html porte, dans les deux langues, la note datee de ses propres
 * corrections -- elle CITE « en bêta » et « sur demande » au passe, pour dire ce
 * que la page affirmait avant. C'est le contraire d'une promesse : c'est la
 * trace de sa correction. Un motif elargi a « toute phrase citant b[êe]ta »
 * rougirait exactement cette note, et la correction evidente serait d'effacer
 * l'aveu. Le temoin rend ce cout visible avant, comme pour la phrase Shopify.
 */
const TEMOINS_NEGATIFS = [
  "Tant que la revue n'a pas abouti, l'application ne s'installe pas depuis l'App Store, et nous ne savons ni quand elle aboutira, ni dans quel sens.",
  "cette note disait « seul le module PrestaShop s'installe depuis le store officiel de sa plateforme », vrai jusqu'à la publication de l'extension WooCommerce sur wordpress.org ce jour-là.",
];

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
  it.each(TEMOINS_NEGATIFS)("le temoin negatif : la formulation modele n'est pas une infraction (%#)", (temoin) => {
    const porteuses = pagesHtml()
      .filter((abs) => {
        const src = pageServie(abs);
        return src !== null && src.includes(temoin);
      })
      .map((abs) => path.relative(RACINE, abs).split(path.sep).join("/"));

    // Le temoin doit exister, sinon ce test se viderait en silence le jour ou
    // la phrase serait reformulee -- vert, et ne testant plus rien.
    expect(porteuses.length, `temoin introuvable sur une page servie : ${temoin.slice(0, 60)}...`).toBeGreaterThan(0);

    for (const m of MOTIFS) {
      expect(
        temoin.match(m.motif),
        `Le motif [${m.id}] rougit la formulation modele portee par ${porteuses.join(", ")}`
      ).toBeNull();
    }
  });
});
