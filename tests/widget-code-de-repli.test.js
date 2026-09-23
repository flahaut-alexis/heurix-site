/*
 * Le champ `code` du moteur, et la regex qui reste son repli.
 *
 * CE QUE CE FICHIER GARDE. Depuis heurix-engine 418d24a le moteur rend un
 * `code` stable a cote de `detail`. Les widgets le lisent EN PREMIER, et la
 * regex `/origine|origin/i` devient son repli. Les deux chemins doivent
 * marcher, et aucun des deux n'est hypothetique :
 *
 *   MOTEUR ANCIEN. api.heurix.fr sert 79d9731. Mesure du 23 septembre 2026,
 *   meme requete jouee contre les deux arbres via TestClient :
 *
 *     79d9731  403 {"detail": "Origine 'autre.fr' non autorisée pour cette
 *                              clé publique. Domaines autorisés : boutique.fr."}
 *     418d24a  403 {"detail": "<la meme phrase, octet pour octet>",
 *                   "code": "origine_non_autorisee"}
 *
 *   C'est le cas NOMINAL aujourd'hui, pas un cas de bord : le code n'existe
 *   en production qu'apres un deploiement qui n'a pas eu lieu.
 *
 *   CE PARAGRAPHE A CESSE D'ETRE VRAI LE JOUR MEME, 16h34 : api.heurix.fr
 *   sert a20c155, et `/health` le confirme. Releve a 16h49, sans clef, sur
 *   la vraie production :
 *
 *     POST /v1/index/x/search sans Authorization
 *       -> 401 {"detail": "Missing or malformed Authorization header",
 *               "code": "authorization_absente"}
 *
 *   Il n'est pas reecrit : il date ce qui etait vrai quand ce fichier est
 *   ne, et les deux corps ci-dessous restent des releves exacts. Ce qui
 *   change est le cas que « moteur ancien » designe -- voir juste en dessous.
 *
 *   UN 403 SANS CODE N'EST PAS DEVENU HISTORIQUE, ET C'EST MIEUX QU'UN
 *   SOUVENIR. Sur l'arbre deploye a20c155, `_require_browse_access`
 *   (deps.py:293) leve encore une HTTPException nue : un marchand au palier
 *   Browse « none » recoit un 403 SANS `code`, sur une route que
 *   heurix-browse-widget.js appelle. Le repli n'a donc pas seulement un
 *   passe, il a un appelant en production. Corps releve le 23 septembre sur
 *   a20c155, TestClient, seconde clef publique au palier « none » :
 *
 *     403 {"detail": "Browse & Discovery n'est pas inclus dans votre offre
 *                     actuelle -- ..."}   (aucune clef `code`)
 *
 *   WIDGET ANCIEN. Les copies deja parties de `downloads/` ignorent `code`.
 *   C'est pourquoi la phrase est gardee cote moteur
 *   (tests/test_phrase_lue_par_les_widgets.py) et pourquoi la regex ne part
 *   pas d'ici. Elle partira quand la population de copies sera connue et
 *   nulle -- une absence de mesure n'est pas un zero.
 *
 * CE FICHIER A UNE COPIE, ET CE DEPOT NE LE SAIT PAS AILLEURS QU'ICI.
 * `downloads/heurix-search.js` est recopie octet pour octet dans
 * heurix-shopify `extensions/heurix-search/assets/heurix-search.js` (md5
 * identique, verifie le 23 septembre 2026). La copie est servie par le CDN
 * Shopify, pas chargee depuis heurix.fr : un correctif d'ici ne part PAS tout
 * seul chez les marchands Shopify, et `bust-cache.sh` ne la rattrape pas.
 *
 * CE QUI TIENT LEUR ACCORD, ET CE QUE CA VAUT. Une seule chose :
 * heurix-shopify `tests/test_extension_theme.py`, qui fige le sha256 de la
 * copie et, quand heurix-site est sur le disque, compare la SOURCE a la meme
 * constante. Rien dans CE depot ne le rappelle -- d'ou ce paragraphe. Deux
 * limites mesurees le 23 septembre : ce garde SAUTE quand heurix-site est
 * introuvable (et il cherche `~/Developer/heurix-site`, donc pas un
 * worktree : posez `HEURIX_SITE`), et heurix-shopify n'a ni CI ni crochet,
 * donc il ne tourne que si quelqu'un lance sa suite a la main.
 *
 * SI VOUS MODIFIEZ LE WIDGET : recopiez le fichier dans heurix-shopify,
 * relancez `HEURIX_SITE=<ce worktree> pytest tests/test_extension_theme.py`,
 * remplacez EMPREINTE_WIDGET et TAILLE_WIDGET, et redeployez l'extension.
 *
 * LE BOUCHON EMET `code`, ET C'EST LA PREMIERE CHOSE A LIRE ICI. La regle est
 * ecrite dans heurix-search-panne.test.js : un bouchon doit implementer la
 * partie du contrat que le code teste utilise. `apiQuiRefuse` de ce
 * fichier-la ne rend que `detail` -- le reprendre aurait rendu ce fichier
 * aveugle au champ qu'il mesure, en silence, et dans le sens qui accuse le
 * code.
 */
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// Les deux corps, RELEVES et non ecrits de memoire (23 septembre 2026).
const CORPS_79d9731 = {
  detail: "Origine 'autre.fr' non autorisée pour cette clé publique. Domaines autorisés : boutique.fr.",
};
const CORPS_418d24a = {
  detail: "Origine 'autre.fr' non autorisée pour cette clé publique. Domaines autorisés : boutique.fr.",
  code: "origine_non_autorisee",
};

function apiQuiRefuse(statut, corps) {
  return async () => ({ ok: false, status: statut, json: async () => corps });
}

function monterRecherche(fetchImpl) {
  const SOURCE = fs.readFileSync(path.join(RACINE, "downloads/heurix-search.js"), "utf8");
  const dom = new JSDOM('<div id="cible"></div>', { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.Element.prototype.scrollIntoView = () => {};
  global.fetch = (...a) => fetchImpl(...a);

  const journal = [];
  const capture = () => (m) => journal.push(String(m));
  dom.window.console.warn = capture();
  dom.window.console.error = capture();
  global.console.warn = capture();
  global.console.error = capture();

  dom.window.eval(SOURCE);
  global.Heurix.searchBox({ apiKey: "hxp_t", catalog: "f", containerId: "cible",
                            debounceMs: 1, timeoutMs: 50 });
  const doc = dom.window.document;
  return {
    journal,
    async taper(texte) {
      const input = doc.querySelector(".hx-search-input");
      for (let i = 1; i <= texte.length; i++) {
        input.value = texte.slice(0, i);
        input.dispatchEvent(new dom.window.Event("input"));
        await attendre(5);
      }
      await attendre(150);
    },
  };
}

async function messageMarchand(corps, statut = 403) {
  const ctx = monterRecherche(apiQuiRefuse(statut, corps));
  await ctx.taper("vis");
  return ctx.journal[ctx.journal.length - 1];
}

describe("heurix-search.js -- le code du moteur, et la phrase en repli", () => {
  it("MOTEUR ANCIEN (79d9731, deploye) : aucun code, la phrase decide", async () => {
    const msg = await messageMarchand(CORPS_79d9731);
    expect(msg).toMatch(/domaine de cette page/i);
    expect(msg).toMatch(/console Heurix/i);
  });

  it("MOTEUR NEUF (418d24a) : le code decide, meme remede", async () => {
    const msg = await messageMarchand(CORPS_418d24a);
    expect(msg).toMatch(/domaine de cette page/i);
    expect(msg).toMatch(/console Heurix/i);
  });

  it("TEMOIN : sans la phrase NI le code, le remede d'origine n'apparait pas", async () => {
    // Le negatif des deux au-dessus. Sans lui, un widget qui rendrait
    // « domaine de cette page » sur TOUS les 403 passerait les deux.
    const msg = await messageMarchand({ detail: "Clé API invalide" });
    expect(msg).not.toMatch(/domaine de cette page/i);
    expect(msg).toMatch(/appel refuse/i);
  });

  it("UN CODE EXPLICITE N'EST PAS CONTREDIT PAR LA PHRASE", async () => {
    // LE TEST QUI PORTE LA REGLE. Un corps dont le code dit « cle_invalide »
    // et dont la phrase contient « origine » : le widget doit suivre le
    // MOTEUR, pas la regex. Sans la regle, `/origine|origin/i` gagnerait et
    // le marchand lirait « ajoutez votre domaine » sur une clef revoquee.
    //
    // Ce corps est CONSTRUIT, pas releve : aucun refus du moteur ne le
    // produit aujourd'hui. Il mesure la regle de priorite, qui doit tenir
    // avant qu'un tel refus existe -- une phrase de 403 qui nommerait une
    // origine sous un autre code suffirait.
    const msg = await messageMarchand({
      code: "cle_invalide",
      detail: "Clé API invalide — vérifiez l'origine de votre clé.",
    });
    expect(msg).not.toMatch(/domaine de cette page/i);
    expect(msg).toMatch(/appel refuse/i);
    // et la regex, seule, aurait dit l'inverse :
    expect(/origine|origin/i.test("Clé API invalide — vérifiez l'origine de votre clé.")).toBe(true);
  });

  it("UN CODE INCONNU vaut le generique, et ne rejoue PAS la phrase", async () => {
    const msg = await messageMarchand({
      code: "un_code_que_ce_fichier_ne_connait_pas",
      detail: "Origine 'x' non autorisée pour cette clé publique.",
    });
    expect(msg).not.toMatch(/domaine de cette page/i);
    expect(msg).toMatch(/appel refuse/i);
  });

  it("la phrase du moteur accompagne toujours le libelle, code ou pas", async () => {
    for (const corps of [CORPS_79d9731, CORPS_418d24a]) {
      const msg = await messageMarchand(corps);
      expect(msg).toContain("Reponse du serveur :");
      expect(msg).toContain(corps.detail);
    }
  });
});

const SOURCE_BROWSE = () =>
  fs.readFileSync(path.join(RACINE, "downloads/heurix-browse-widget.js"), "utf8");

/** `Heurix.browse()` resout en echec : c'est `heurixError.code` qui sort.
 *
 * AU MODULE ET NON DANS UN describe : le bloc « une phrase que la regex ne
 * peut pas lire », en fin de fichier, monte le meme widget. Deux copies de ce
 * montage auraient derive l'une de l'autre sans que rien ne le signale. */
async function codeDeBrowse(corps, statut = 403) {
  const dom = new JSDOM('<!doctype html><html><body><div id="c"></div></body></html>',
    { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;
  const faux = async () => ({ ok: false, status: statut, json: async () => corps });
  global.fetch = faux;
  dom.window.fetch = faux;
  dom.window.console.warn = () => {};
  dom.window.console.error = () => {};
  dom.window.eval(SOURCE_BROWSE());
  const api = dom.window.Heurix ?? global.Heurix;
  const r = await api.browse({ apiKey: "hxp_t", catalog: "f", category: "v", containerId: "c" });
  return r.heurixError ? r.heurixError.code : null;
}

/** Meme montage, l'autre champ de `heurixError`. */
async function transitoireDeBrowse(corps, statut = 403) {
  const dom = new JSDOM('<!doctype html><html><body><div id="c"></div></body></html>',
    { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;
  const faux = async () => ({ ok: false, status: statut, json: async () => corps });
  global.fetch = faux;
  dom.window.fetch = faux;
  dom.window.console.warn = () => {};
  dom.window.console.error = () => {};
  dom.window.eval(SOURCE_BROWSE());
  const api = dom.window.Heurix ?? global.Heurix;
  const r = await api.browse({ apiKey: "hxp_t", catalog: "f", category: "v", containerId: "c" });
  return r.heurixError ? r.heurixError.transitoire : null;
}

describe("heurix-browse-widget.js -- meme regle, deux chemins d'appel", () => {
  it("MOTEUR ANCIEN : heurixError.code vaut « origine » par la phrase", async () => {
    expect(await codeDeBrowse(CORPS_79d9731)).toBe("origine");
  });

  it("MOTEUR NEUF : heurixError.code vaut « origine » par le code", async () => {
    expect(await codeDeBrowse(CORPS_418d24a)).toBe("origine");
  });

  it("LE CONTRAT PUBLIC NE BOUGE PAS : la valeur reste « origine », pas le code du moteur", async () => {
    // Le vocabulaire du widget est le sien. Un integrateur qui teste
    // `heurixError.code === "origine"` continue d'etre servi ; il n'a pas a
    // apprendre « origine_non_autorisee » parce que le moteur l'a gagne.
    expect(await codeDeBrowse(CORPS_418d24a)).not.toBe("origine_non_autorisee");
  });

  it("TEMOIN : une clef refusee rend « cle-refusee » dans les deux mondes", async () => {
    expect(await codeDeBrowse({ detail: "Clé API invalide" })).toBe("cle-refusee");
    expect(await codeDeBrowse({ detail: "Clé API invalide", code: "cle_invalide" }))
      .toBe("cle-refusee");
  });
});

/* ---------------------------------------------------------------------------
 * LA LANGUE DE LA PHRASE, ET CE QUE LE REPLI NE RATTRAPE PAS (23 sept. 2026).
 *
 * POURQUOI CE BLOC EXISTE ALORS QUE LE FICHIER PARAISSAIT COMPLET. Tous les
 * cas ci-dessus emploient la MEME phrase francaise pour le moteur ancien et
 * pour le neuf. Ils prouvent donc la priorite du code quand les deux sources
 * s'accordent, ou quand elles se contredisent sur la CAUSE -- jamais quand la
 * phrase echoue a porter l'indice. Or c'est exactement le defaut qui a motive
 * le lot : `/origine|origin/i` attrapait le francais et l'anglais par chance,
 * et manquait « origen ».
 *
 * MESURE QUI L'ETABLIT, ET ELLE EST LA RAISON D'ECRIRE CE BLOC PLUTOT QUE DE
 * LE PROPOSER. Mutant pose sur les deux widgets le 23 septembre :
 *
 *     var origine = codeMoteur
 *       ? (codeMoteur === "origine_non_autorisee" && /origine|origin/i.test(detail))
 *       : ...
 *
 * -- la « ceinture et bretelles » qu'ecrira une session qui ne fait pas
 * confiance au champ neuf. Elle ROUVRE le defaut espagnol en entier. Les dix
 * cas ci-dessus : 10 verts. Les quatre ci-dessous : rouges.
 *
 * LES CORPS SONT DES RELEVES. Arbre deploye a20c155, TestClient, clef
 * publique restreinte a boutique.fr appelee depuis autre.fr. La version
 * espagnole a ete obtenue en traduisant la phrase de `deps.py` sur cet arbre,
 * puis en le restaurant -- pas en ecrivant un corps a la main.
 * ------------------------------------------------------------------------- */

const CORPS_ES_AVEC_CODE = {
  detail: "Origen 'autre.fr' no autorizado para esta clave pública. Dominios autorizados: boutique.fr.",
  code: "origine_non_autorisee",
};
const CORPS_ES_SANS_CODE = {
  detail: "Origen 'autre.fr' no autorizado para esta clave pública. Dominios autorizados: boutique.fr.",
};
// Le 403 sans code qui existe VRAIMENT en production : palier Browse « none ».
const CORPS_OFFRE_NONE = {
  detail: "Browse & Discovery n'est pas inclus dans votre offre actuelle — "
        + "disponible en autonome ou en option sur les plans Growth/Scale. "
        + "Contactez contact@heurix.fr.",
};

describe("une phrase que la regex ne peut pas lire", () => {
  it("LE DEFAUT QUI A MOTIVE LE LOT : phrase espagnole + code -> « origine »", async () => {
    const msg = await messageMarchand(CORPS_ES_AVEC_CODE);
    expect(msg).toMatch(/domaine de cette page/i);
  });

  it("idem sur heurix-browse-widget.js, via heurixError.code", async () => {
    expect(await codeDeBrowse(CORPS_ES_AVEC_CODE)).toBe("origine");
  });

  it("TEMOIN FIGE : phrase espagnole SANS code -> « cle-refusee », et ce lot ne le repare pas", async () => {
    // CE CAS N'EST PAS UN ECHEC A CORRIGER, C'EST LA LIMITE DU REPLI.
    // Sans code, il n'y a rien a lire : la regex est tout ce qui reste, et
    // elle ne connait pas l'espagnol. L'assertion le FIGE pour qu'aucune
    // relecture ne conclue que le lot a ferme le defaut dans tous les cas.
    //
    // Ce n'est pas hypothetique : le 403 du palier Browse « none » ci-dessous
    // sort sans code sur l'arbre deploye, et les copies de `downloads/` deja
    // posees chez les marchands ignorent le champ de toute facon.
    const msg = await messageMarchand(CORPS_ES_SANS_CODE);
    expect(msg).not.toMatch(/domaine de cette page/i);
    expect(msg).toMatch(/appel refuse/i);
    expect(await codeDeBrowse(CORPS_ES_SANS_CODE)).toBe("cle-refusee");
  });

  it("UN 403 SANS CODE EXISTE EN PRODUCTION, et il tombe dans le generique", async () => {
    // Palier Browse « none », deps.py:293 sur a20c155 : HTTPException nue.
    // C'est le seul appelant vivant du repli cote Browse. Il rend le
    // generique, ce qui est juste -- et c'est aussi ce qui montre que
    // « moteur ancien » n'est pas la seule facon de ne pas avoir de code.
    expect(await codeDeBrowse(CORPS_OFFRE_NONE)).toBe("cle-refusee");
    const msg = await messageMarchand(CORPS_OFFRE_NONE);
    expect(msg).toMatch(/appel refuse/i);
    expect(msg).toContain("Browse & Discovery");
  });

  it("TEMOIN NEGATIF : le coupe-circuit reste hors du chemin dans les quatre cas", async () => {
    // `transitoire` valait false dans les deux branches avant le lot. S'il
    // basculait, une 403 de configuration mettrait la recherche en pause 60 s
    // chez le marchand -- une panne fabriquee par un garde mal ecrit.
    for (const corps of [CORPS_ES_AVEC_CODE, CORPS_ES_SANS_CODE,
                         CORPS_OFFRE_NONE, CORPS_418d24a]) {
      expect(await transitoireDeBrowse(corps)).toBe(false);
    }
  });
});
