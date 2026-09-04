import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

/* LE CHEMIN CORRIGE, JOUE EN ENTIER, DANS LES DEUX LANGUES.
 *
 * Le garde voisin (console-ecritures-muettes.test.js) LIT la source : il
 * prouve qu'un `.catch` d'ecriture contient de quoi parler. Il ne prouve
 * pas qu'un marchand VOIT quelque chose. Deux choses peuvent encore rater
 * entre les deux : l'element vise peut ne pas exister dans console.html,
 * et le message, qui vient du moteur en francais, peut arriver tel quel
 * sur la console anglaise.
 *
 * Ce test-ci EXERCE donc le chemin : connexion, volet Equipe, clic sur
 * « Promouvoir admin », 404 du moteur, et on lit le DOM.
 *
 * POURQUOI CE 404 ET PAS LE 409 DE L'ENONCE D'ORIGINE. Le cas decrit au
 * depart -- « un marchand qui tente de se retirer lui-meme » -- N'EXISTE
 * PAS : renderTeam ne pose ses boutons que `if (isAdmin && t.email !==
 * myEmail)`, donc personne n'a de bouton sur sa propre ligne, et les deux
 * 409 du moteur qui parlent de soi-meme sont inatteignables depuis cet
 * ecran. Ce qui arrive vraiment est une COURSE : un autre administrateur
 * a retire la personne, ou m'a retrograde, pendant que ma page etait
 * ouverte. Le test porte donc le cas atteignable, pas le cas suppose.
 */

const MESSAGE_MOTEUR = "Utilisateur introuvable dans votre entreprise";
const MESSAGE_ANGLAIS = "User not found in your company";

function construireFetch() {
  return vi.fn(async (url, options) => {
    const chemin = String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (chemin === "/v1/auth/login") {
      return { ok: true, json: async () => ({ session_token: "jeton", keys: [{ key: "hx_test" }] }) };
    }
    if (chemin === "/v1/auth/me") {
      return {
        ok: true,
        json: async () => ({
          email: "moi@heurix.fr",
          role: "admin",
          company: { raison_sociale: "Maison Test", numero_tva: null },
          keys: [{ key: "hx_test" }],
          // Une coequipiere, donc une ligne QUI PORTE les deux boutons.
          teammates: [
            { id: 1, email: "moi@heurix.fr", role: "admin", created_at: "2026-01-01" },
            { id: 2, email: "collegue@heurix.fr", role: "member", created_at: "2026-02-01" },
          ],
        }),
      };
    }
    // La course : un autre administrateur vient de la retirer.
    if (/\/v1\/auth\/team\/2\/role$/.test(chemin) && options && options.method === "PUT") {
      return { ok: false, status: 404, json: async () => ({ detail: MESSAGE_MOTEUR }) };
    }
    // Le tableau de bord doit s'ouvrir en ENTIER : loadAccountInfo(), qui
    // rend la table d'equipe, n'est appelee qu'apres `dashContent.hidden =
    // false`, lui-meme au bout du chemin nominal de chargerDonnees.
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
        requests: 0, account_email: "moi@heurix.fr", catalogs_used: 1,
        first_search_at: null, first_browse_at: null,
      }) };
    }
    return { ok: true, json: async () => ({}) };
  });
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
  document.getElementById("login-email").value = "moi@heurix.fr";
  document.getElementById("login-password").value = "peu-importe";
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await vi.waitFor(() => {
    expect(document.getElementById("dash-content").hidden).toBe(false);
  });
}

async function cliquerPromouvoir(window, document) {
  document.querySelector('[data-goto-pane="pane-team"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  const bouton = await vi.waitFor(() => {
    const b = document.querySelector('#team-table [data-action="role"][data-id="2"]');
    expect(b, "la ligne de la coequipiere n'a pas ses boutons").toBeTruthy();
    return b;
  });
  bouton.dispatchEvent(new window.Event("click", { bubbles: true }));
  return bouton;
}

describe("console.js — le refus du moteur arrive jusqu'au marchand", () => {
  it("affiche la raison du 404 dans le volet Équipe, en français", async () => {
    const { window, document } = chargerConsole("console.html");
    await connecter(window, document);
    const bouton = await cliquerPromouvoir(window, document);

    const statut = document.getElementById("invite-status");
    await vi.waitFor(() => {
      expect(statut.hidden).toBe(false);
    });

    // LE MESSAGE DU MOTEUR, VERBATIM -- pas un « Échec. » generique.
    expect(statut.textContent).toBe(MESSAGE_MOTEUR);
    // La classe de base survit : signalerEchec passe par classList, il ne
    // reecrit pas className en entier.
    expect(statut.classList.contains("console-form-status")).toBe(true);
    expect(statut.classList.contains("err")).toBe(true);
    // Et le bouton redevient cliquable -- ce qu'il faisait DEJA, seul, avant
    // ce lot. Le correctif ajoute le message, il ne retire pas le reste.
    expect(bouton.disabled).toBe(false);
  });

  it("traduit ce même message sur la console anglaise", async () => {
    const { window, document } = chargerConsole("en/console.html");
    await connecter(window, document);
    await cliquerPromouvoir(window, document);

    const statut = document.getElementById("invite-status");
    await vi.waitFor(() => {
      expect(statut.hidden).toBe(false);
    });

    // La chaine vient du MOTEUR : aucun T() n'est possible dessus. C'est le
    // chemin 1 de console-i18n.js qui la rattrape -- textContent remplace le
    // noeud texte, le MutationObserver voit le noeud ajoute, traduire() fait
    // une egalite exacte apres trim(). Si cette entree manquait au
    // dictionnaire, l'anglais recevrait du francais sans que rien n'echoue.
    await vi.waitFor(() => {
      expect(statut.textContent).toBe(MESSAGE_ANGLAIS);
    });
  });
});
