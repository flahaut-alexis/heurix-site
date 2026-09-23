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

describe("heurix-browse-widget.js -- meme regle, deux chemins d'appel", () => {
  const SOURCE = () =>
    fs.readFileSync(path.join(RACINE, "downloads/heurix-browse-widget.js"), "utf8");

  /** `Heurix.browse()` resout en echec : c'est `heurixError.code` qui sort. */
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
    dom.window.eval(SOURCE());
    const api = dom.window.Heurix ?? global.Heurix;
    const r = await api.browse({ apiKey: "hxp_t", catalog: "f", category: "v", containerId: "c" });
    return r.heurixError ? r.heurixError.code : null;
  }

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
