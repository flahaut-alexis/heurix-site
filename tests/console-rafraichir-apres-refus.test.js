import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");
const CONSOLE = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");

/* LE MESSAGE DIT QUE LA PAGE EST PERIMEE ; IL NE LA RAFRAICHIT PAS
 * (5 septembre 2026).
 *
 * Laisse ouvert par le lot « onze ecritures muettes » (c1ee4b1b) et ecrit
 * dans son rapport. Un autre administrateur retire une personne pendant
 * que ma page est ouverte. Je clique « Retirer », le moteur rend 404
 * « Utilisateur introuvable dans votre entreprise », et le message
 * s'affiche -- depuis ce lot-la. Mais LA LIGNE RESTE, et je peux
 * recliquer indefiniment sur une personne qui n'existe plus.
 *
 * CE QUI DECIDE, ET CE QUI NE DECIDE PAS. Ce n'est pas le code de
 * reponse. Sur ces deux chemins, le 403 « Seul un administrateur peut
 * retirer un membre » appelle un rechargement AUTANT que le 404, parce
 * que renderTeam ne pose ces boutons que `if (isAdmin && t.email !==
 * myEmail)` : le bouton n'existe QUE parce que la page croit que je suis
 * admin. Un controle conditionne a une permission, refuse pour cette
 * permission, prouve que la page se trompe sur ce qu'elle affiche. C'est
 * ce que l'existence du controle SUPPOSAIT qui decide, pas le code.
 *
 * MESURE AVANT/APRES, prediction ecrite avant de lancer :
 *                                        origine (9e065479)   corrige
 *   lignes d'equipe apres le refus                    2          1
 *   message encore affiche apres le refus            oui       oui
 *   chaines a rafraichir qui le font                   0          7
 *
 * La seconde ligne est la contrainte, pas un effet : le rechargement
 * COMPLETE le message, il ne l'efface pas. Elle est deja vraie sur
 * l'origine -- elle doit le rester.
 */

const MESSAGE_MOTEUR = "Utilisateur introuvable dans votre entreprise";
const MESSAGE_ANGLAIS = "User not found in your company";

const MOI = { id: 1, email: "moi@heurix.fr", role: "admin", created_at: "2026-01-01" };
const COLLEGUE = { id: 2, email: "collegue@heurix.fr", role: "member", created_at: "2026-02-01" };

function construireFetch() {
  // LA COURSE, JOUEE POUR DE VRAI. Le premier /v1/auth/me voit la
  // coequipiere ; les suivants ne la voient plus. C'est exactement l'etat
  // du serveur qui a change pendant que la page etait ouverte -- et c'est
  // la seule facon de prouver que le rechargement lit le serveur plutot
  // que de redessiner ce qu'il avait deja.
  let vues = 0;
  const f = vi.fn(async (url, options) => {
    const chemin = String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (chemin === "/v1/auth/login") {
      return { ok: true, json: async () => ({ session_token: "jeton", keys: [{ key: "hx_test" }] }) };
    }
    if (chemin === "/v1/auth/me") {
      vues += 1;
      return {
        ok: true,
        json: async () => ({
          email: MOI.email,
          role: "admin",
          company: { raison_sociale: "Maison Test", numero_tva: null },
          keys: [{ key: "hx_test" }],
          teammates: vues === 1 ? [MOI, COLLEGUE] : [MOI],
        }),
      };
    }
    if (/\/v1\/auth\/team\/2$/.test(chemin) && options && options.method === "DELETE") {
      return { ok: false, status: 404, json: async () => ({ detail: MESSAGE_MOTEUR }) };
    }
    if (chemin === "/v1/index/catalogs") return { ok: true, json: async () => ({ catalogs: [{ catalog: "outillage-demo" }] }) };
    if (chemin === "/v1/keys/public") return { ok: true, json: async () => ({ keys: [] }) };
    if (chemin.startsWith("/v1/rulepacks")) return { ok: true, json: async () => ({ rulepacks: [] }) };
    if (chemin.startsWith("/v1/analytics/summary")) {
      return { ok: true, json: async () => ({ total_searches: 0, zero_result_rate: 0, total_errors: 0, daily_searches: [] }) };
    }
    if (chemin.startsWith("/v1/analytics/errors")) return { ok: true, json: async () => ({ errors: [] }) };
    if (chemin.startsWith("/v1/analytics/")) return { ok: true, json: async () => ({ queries: [] }) };
    if (chemin.startsWith("/v1/usage")) {
      return { ok: true, json: async () => ({
        requests: 0, account_email: MOI.email, catalogs_used: 1,
        first_search_at: null, first_browse_at: null,
      }) };
    }
    return { ok: true, json: async () => ({}) };
  });
  return f;
}

function chargerConsole(page) {
  const html = fs.readFileSync(path.join(RACINE, page), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/console.html", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  window.Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
  window.confirm = () => true;
  window.HTMLCanvasElement.prototype.getContext = () => ({
    createLinearGradient: () => ({ addColorStop: () => {} }),
  });
  window.Chart = function () { return { destroy: () => {} }; };

  const f = construireFetch();
  global.fetch = f;
  window.fetch = f;

  window.eval(fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(RACINE, "console.js"), "utf8"));
  return { window, document: window.document };
}

async function connecter(window, document) {
  document.getElementById("login-email").value = MOI.email;
  document.getElementById("login-password").value = "peu-importe";
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await vi.waitFor(() => {
    expect(document.getElementById("dash-content").hidden).toBe(false);
  });
}

async function cliquerRetirer(window, document) {
  document.querySelector('[data-goto-pane="pane-team"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  const bouton = await vi.waitFor(() => {
    const b = document.querySelector('#team-table [data-action="remove"][data-id="2"]');
    expect(b, "la ligne de la coequipiere n'a pas son bouton de retrait").toBeTruthy();
    return b;
  });
  bouton.dispatchEvent(new window.Event("click", { bubbles: true }));
  // « Retirer » passe par confirmerSuppression : un dialogue maison injecte
  // dans le body, pas window.confirm. Le vrai retrait ne part qu'apres ce
  // second clic -- sans lui, aucun DELETE, et le test mesurerait le fait de
  // n'avoir rien clique plutot que le defaut.
  const confirmer = await vi.waitFor(() => {
    const c = document.querySelector(".confirm-fond .confirm-valider");
    expect(c, "le dialogue de confirmation ne s'est pas ouvert").toBeTruthy();
    return c;
  });
  confirmer.dispatchEvent(new window.Event("click", { bubbles: true }));
}

function lignesEquipe(document) {
  return document.querySelectorAll("#team-table tbody tr").length;
}

describe("console.js — le refus rafraichit l'ecran qu'il declare perime", () => {
  it("retire la ligne perimee ET garde le message, en francais", async () => {
    const { window, document } = chargerConsole("console.html");
    await connecter(window, document);
    expect(lignesEquipe(document)).toBe(2);

    await cliquerRetirer(window, document);

    const statut = document.getElementById("invite-status");
    await vi.waitFor(() => {
      expect(statut.hidden).toBe(false);
    });

    // CE QUE LE LOT AJOUTE : la ligne de la personne deja retiree s'en va.
    await vi.waitFor(() => {
      expect(lignesEquipe(document), "la ligne perimee est toujours affichee").toBe(1);
    });
    expect(document.querySelector('#team-table [data-action="remove"][data-id="2"]')).toBeNull();

    // LA CONTRAINTE : le rechargement COMPLETE le message, il ne l'efface
    // pas. loadAccountInfo lit `invite-status` sur son chemin de succes
    // mais ne l'ecrit jamais -- c'est ce qui rend l'ajout possible en une
    // ligne, et c'est ce qu'on verifie ici plutot que de s'y fier.
    expect(statut.textContent).toBe(MESSAGE_MOTEUR);
    expect(statut.classList.contains("err")).toBe(true);
    expect(statut.hidden).toBe(false);
  });

  it("fait les deux sur la console anglaise", async () => {
    const { window, document } = chargerConsole("en/console.html");
    await connecter(window, document);
    expect(lignesEquipe(document)).toBe(2);

    await cliquerRetirer(window, document);

    const statut = document.getElementById("invite-status");
    await vi.waitFor(() => {
      expect(lignesEquipe(document), "la ligne perimee est toujours affichee").toBe(1);
    });
    // La chaine vient du MOTEUR : c'est le MutationObserver de
    // console-i18n.js qui la rattrape. Le rechargement redessine la table
    // JUSTE A COTE -- on verifie que ce remue-menage ne l'a pas emportee.
    await vi.waitFor(() => {
      expect(statut.textContent).toBe(MESSAGE_ANGLAIS);
    });
    expect(statut.hidden).toBe(false);
  });
});

/* LE CONTROLE DE POPULATION, ET LES CINQ QUI NE RAFRAICHISSENT PAS.
 *
 * Le test ci-dessus joue UN chemin en entier. Six autres recoivent le meme
 * appel sans etre joues, et cinq chaines le refusent -- pour cinq raisons
 * differentes. Sans cette table, « sept » n'est qu'un chiffre : on
 * pourrait en corriger six et rendre exactement le meme vert.
 *
 * Les CINQ REFUS sont le vrai risque de ce lot, et c'est pour eux que ce
 * bloc existe. Un lecteur qui compte douze `.catch` qui signalent et sept
 * qui rafraichissent conclura qu'il en manque cinq. Chacun porte donc sa
 * raison ici, en plus du commentaire pose a cote du code.
 */

// Les six fonctions de chargement. Aucune n'a ete ecrite pour ce lot :
// toutes existaient deja, appelees sur le chemin de SUCCES du meme bouton.
// C'est ce qui fait tenir sept chemins en un appel chacun.
const RECHARGEMENTS = [
  "refreshPublicKeys(key)", "loadAccountInfo()", "refreshSoTable(key)",
  "refreshBrowseOverrides(key)", "refreshBrowseAttributeRules(key)", "loadRules()",
];

// [nom lisible, fragments qui identifient LE bloc, rechargement attendu ou null].
// Les fragments doivent selectionner UN SEUL bloc : le test le verifie
// avant d'assertir quoi que ce soit, sinon une cible devenue ambigue
// mesurerait le mauvais `.catch` sans que rien n'echoue.
const CHEMINS = [
  ["revocation d'une cle publique", ["public-key-status"], "refreshPublicKeys(key)"],
  ["changement de role d'un membre", ["Échec du changement de rôle."], "loadAccountInfo()"],
  ["retrait d'un membre", ["Échec du retrait."], "loadAccountInfo()"],
  ["une surcharge Search", ["so-status", "delBtn.disabled = false"], "refreshSoTable(key)"],
  ["surcharge Browse", ["browse-override-status", "Échec de la suppression."], "refreshBrowseOverrides(key)"],
  ["regle d'attribut Browse", ["browse-attribute-rule-status"], "refreshBrowseAttributeRules(key)"],
  ["reconnaissance personnalisee", ["signalerEchec(status, err"], "loadRules()"],

  // LE CAS CONTRAIRE. refreshBrowsePreview fait `session.brDraft = null`
  // inconditionnellement, et brDraft est la seule copie de l'arrangement
  // du marchand. Sur un echec en milieu de chaine l'etat serveur est un
  // melange partiel : recharger serait pire que ne rien faire.
  ["publication du brouillon Ranking", ["browse-override-status", "Échec de l'enregistrement."], null],

  // Lot separe : le remede n'est pas un appel. Rafraichir sans purger
  // soCatalogueSelection laisse un compteur a N avec zero case cochee
  // (les cases se rendent toujours sans `checked`), et un second clic
  // retire des DELETE sur des regles disparues.
  ["selection de surcharges Search", ["soSupprimerSelectionBtn.disabled = false"], null],

  // Les deux synonymes : le PUT remplace la liste ENTIERE. Ses seules
  // erreurs sont 404 « Catalogue introuvable » et des 422 de validation --
  // aucun code ne dit « perime ». Retirer un groupe qu'un autre admin a
  // deja retire ne rend meme pas d'erreur : le PUT reussit. Il n'y a rien
  // sur quoi accrocher un rechargement.
  ["retrait d'un synonyme", ['signalerEchec(synStatus, err, T("Échec de la suppression.")'], null],
  ["ajout d'un synonyme", ["Échec de l'ajout."], null],

  // La LECTURE de loadAccountInfo, seule des vingt et une a parler.
  // Rafraichir dans le `.catch` d'un rafraichissement rate est une boucle.
  ["loadAccountInfo (lecture)", ["Impossible de charger les informations de votre compte."], null],
];

// Decoupe les blocs `.catch(function (...) { ... })` en suivant les
// accolades. Une regex ne suffit pas : ces blocs contiennent des appels
// imbriques et des chaines a accolades.
function blocsCatch(source) {
  const blocs = [];
  const debut = /\.catch\(function \([^)]*\) \{/g;
  let m;
  while ((m = debut.exec(source)) !== null) {
    let profondeur = 1;
    let i = m.index + m[0].length;
    while (i < source.length && profondeur > 0) {
      if (source[i] === "{") profondeur += 1;
      else if (source[i] === "}") profondeur -= 1;
      i += 1;
    }
    blocs.push(source.slice(m.index, i));
  }
  return blocs;
}

describe("console.js — les douze `.catch` qui signalent un echec", () => {
  const signalants = blocsCatch(CONSOLE).filter((b) => b.includes("signalerEchec"));

  it("compte douze blocs, et la table les couvre tous", () => {
    // Si ce compte bouge, la table ci-dessus est perimee. Ce n'est pas une
    // assertion de style : c'est ce qui empeche ce fichier de rendre vert
    // en ne mesurant plus rien.
    expect(signalants.length, "le nombre de `.catch` qui signalent a change").toBe(12);
    expect(CHEMINS.length).toBe(12);
    expect(CHEMINS.filter((c) => c[2] !== null).length, "les sept a rafraichir").toBe(7);
  });

  CHEMINS.forEach(([nom, fragments, attendu]) => {
    it(attendu ? `${nom} : rafraichit par ${attendu}` : `${nom} : ne rafraichit pas`, () => {
      const cibles = signalants.filter((b) => fragments.every((f) => b.includes(f)));
      // Le controle d'instrument AVANT l'assertion : une cible ambigue
      // mesurerait le mauvais bloc en silence.
      expect(cibles.length, `« ${nom} » ne designe pas exactement un bloc`).toBe(1);

      if (attendu) {
        expect(cibles[0].includes(attendu), `« ${nom} » ne rafraichit pas`).toBe(true);
      } else {
        RECHARGEMENTS.forEach((r) => {
          expect(cibles[0].includes(r), `« ${nom} » ne doit pas appeler ${r}`).toBe(false);
        });
      }
      // Aucun message retire : la contrainte du lot precedent tient sur
      // les douze, pas seulement sur les sept.
      expect(cibles[0]).toMatch(/signalerEchec\(/);
    });
  });

  it("le cas contraire dit POURQUOI juste a cote, avec ses deux precedents", () => {
    const bloc = signalants.filter(
      (b) => b.includes("browse-override-status") && b.includes("Échec de l'enregistrement.")
    )[0];
    // refreshBrowsePreview n'est dans aucun RECHARGEMENTS -- c'est
    // pourtant LUI qui detruirait le brouillon. Verifie a part.
    expect(bloc.includes("refreshBrowsePreview"), "brAppliquerBrouillon ne doit pas appeler refreshBrowsePreview").toBe(false);

    // La raison doit vivre A COTE du code. C'est le seul endroit ou
    // quelqu'un qui « complete le lot » dans six mois la lira -- un
    // rapport de commit ne se relit pas avant d'ajouter une ligne.
    const contexte = CONSOLE.slice(Math.max(0, CONSOLE.indexOf(bloc) - 2200), CONSOLE.indexOf(bloc));
    expect(contexte, "la seule copie du travail n'est pas nommee").toMatch(/SEULE COPIE/);
    expect(contexte, "brDraft n'est pas nomme").toMatch(/session\.brDraft/);
    expect(contexte, "le precedent soAppliquerBrouillon manque").toMatch(/soAppliquerBrouillon/);
    expect(contexte, "le precedent « abandonner » manque").toMatch(/br-simu-discard/);
  });
});
