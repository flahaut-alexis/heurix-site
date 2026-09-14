import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

/* UN EMAIL QUI NE PART PAS, LU PAR LA CONSOLE (14 septembre 2026).
 *
 * Depuis le 13 septembre, le moteur dit si l'email est parti :
 * `email_sent` sur /v1/auth/signup et /v1/auth/invite, `sent: false` sur
 * /v1/auth/request-password-reset quand BREVO_API_KEY manque. Formes
 * relevees dans heurix/routers/auth.py a cf6a61b (lignes 72, 236, 333),
 * pas deduites de la doc.
 *
 * LE DEFAUT PRINCIPAL ETAIT AILLEURS, et c'est pourquoi chaque cas est
 * joue dans les deux langues. en/console.html n'avait PAS d'ecran
 * post-inscription, du 3 aout au 14 septembre 2026 : compte cree, session
 * perdue, « Couldn't reach api.heurix.fr » a l'ecran -- avec ou sans
 * email. Le test « email parti » en anglais est celui qui le montrait.
 *
 * Le moteur est un double : ce test ne prouve pas que la production rend
 * ces champs, il prouve ce que l'ecran fait quand elle les rend.
 */

const LANGUES = [
  {
    page: "console.html",
    ligneEnvoye: "Également envoyée à m@heurix.fr.",
    signupEchec: "L'email de bienvenue n'a pas pu être envoyé à m@heurix.fr. Copiez votre clé maintenant : elle reste aussi lisible dans l'onglet Ma clé API.",
    inviteEnvoye: "Invitation envoyée à c@heurix.fr.",
    inviteEchec: "Invitation créée pour c@heurix.fr, mais l'email n'a pas pu partir : votre collègue ne l'a pas reçue. Réessayez plus tard ; si cela persiste, écrivez à contact@heurix.fr.",
    resetEnvoye: "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.",
    resetEchec: "Aucun lien n'a pu être envoyé : notre service d'email est indisponible pour le moment. Réessayez plus tard, ou écrivez à contact@heurix.fr.",
  },
  {
    page: "en/console.html",
    ligneEnvoye: "Also sent to m@heurix.fr.",
    signupEchec: "The welcome email couldn't be sent to m@heurix.fr. Copy your key now: you can also find it under My API key.",
    inviteEnvoye: "Invitation sent to c@heurix.fr.",
    inviteEchec: "Invitation created for c@heurix.fr, but the email couldn't be sent: your colleague hasn't received it. Try again later; if it keeps happening, email contact@heurix.fr.",
    resetEnvoye: "If an account exists with this email, a reset link was just sent.",
    resetEchec: "No link could be sent: our email service is unavailable right now. Try again later, or email contact@heurix.fr.",
  },
];

function construireFetch(envoye) {
  return vi.fn(async (url) => {
    const chemin = String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    const ok = (data) => ({ ok: true, status: 200, json: async () => data });
    if (chemin === "/v1/auth/signup") {
      return ok({ session_token: "sess_test", email: "m@heurix.fr", key: "hx_sk_test",
        company: { raison_sociale: "Maison Test" }, email_sent: envoye });
    }
    if (chemin === "/v1/auth/invite") return ok({ invited: "c@heurix.fr", email_sent: envoye });
    if (chemin === "/v1/auth/request-password-reset") {
      return ok(envoye ? { sent: true } : { sent: false, reason: "Le service d'email n'est pas configuré" });
    }
    if (chemin === "/v1/auth/login") return ok({ session_token: "sess_test", keys: [{ key: "hx_sk_test" }] });
    if (chemin === "/v1/auth/me") {
      return ok({ email: "m@heurix.fr", role: "admin", company: { raison_sociale: "Maison Test", numero_tva: null },
        keys: [{ key: "hx_sk_test" }], teammates: [] });
    }
    if (chemin === "/v1/index/catalogs") return ok({ catalogs: [{ catalog: "outillage-demo" }] });
    if (chemin === "/v1/keys/public") return ok({ keys: [] });
    if (chemin.startsWith("/v1/rulepacks")) return ok({ rulepacks: [] });
    if (chemin.startsWith("/v1/analytics/summary")) {
      return ok({ total_searches: 0, zero_result_rate: 0, total_errors: 0, daily_searches: [] });
    }
    if (chemin.startsWith("/v1/analytics/errors")) return ok({ errors: [] });
    if (chemin.startsWith("/v1/analytics/")) return ok({ queries: [] });
    if (chemin.startsWith("/v1/usage")) {
      return ok({ requests: 0, account_email: "m@heurix.fr", catalogs_used: 1, first_search_at: null, first_browse_at: null });
    }
    return ok({});
  });
}

function chargerConsole(page, envoye) {
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

  const f = construireFetch(envoye);
  global.fetch = f;
  window.fetch = f;

  window.eval(fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(RACINE, "console.js"), "utf8"));
  return { window, document: window.document };
}

const texte = (el) => el.textContent.replace(/\s+/g, " ").trim();

async function inscrire(window, document) {
  document.getElementById("signup-raison-sociale").value = "Maison Test";
  document.getElementById("signup-email").value = "m@heurix.fr";
  document.getElementById("signup-password").value = "0123456789";
  document.getElementById("signup-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await vi.waitFor(() => {
    const ecran = document.getElementById("post-signup-screen");
    const erreur = document.getElementById("signup-error");
    expect(ecran, "pas d'ecran post-inscription sur cette page").toBeTruthy();
    // Le defaut du 3 aout : l'erreur s'affichait A LA PLACE de l'ecran.
    expect(erreur.hidden, texte(erreur)).toBe(true);
    expect(ecran.hidden).toBe(false);
  });
}

async function connecterPuisInviter(window, document) {
  document.getElementById("login-email").value = "m@heurix.fr";
  document.getElementById("login-password").value = "peu-importe";
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await vi.waitFor(() => {
    expect(document.getElementById("dash-content").hidden).toBe(false);
  });
  const statut = document.getElementById("invite-status");
  // Etat atteignable : un echec d'action d'equipe (signalerEchec) pose `err`
  // sur ce meme element avant l'invitation.
  statut.classList.add("err");
  document.getElementById("invite-email").value = "c@heurix.fr";
  document.getElementById("invite-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await vi.waitFor(() => {
    expect(statut.hidden).toBe(false);
    expect(document.getElementById("invite-btn").disabled).toBe(false);
  });
  return statut;
}

async function demanderReinitialisation(window, document) {
  document.getElementById("reset-email").value = "m@heurix.fr";
  document.getElementById("reset-request-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  const msg = document.getElementById("reset-request-msg");
  await vi.waitFor(() => { expect(msg.hidden).toBe(false); });
  return msg;
}

describe.each(LANGUES)("$page — un email qui ne part pas", (l) => {
  it("inscription, email parti : l'ecran de cle s'affiche et annonce l'envoi", async () => {
    const { window, document } = chargerConsole(l.page, true);
    await inscrire(window, document);
    expect(texte(document.getElementById("post-signup-key-value"))).toBe("hx_sk_test");
    expect(document.getElementById("post-signup-email-envoye").hidden).toBe(false);
    expect(texte(document.getElementById("post-signup-email-envoye"))).toBe(l.ligneEnvoye);
    expect(document.getElementById("post-signup-email-echec").hidden).toBe(true);
  });

  it("inscription, email non parti : la cle reste a l'ecran, seule la ligne de l'email change, la session tient", async () => {
    const { window, document } = chargerConsole(l.page, false);
    await inscrire(window, document);
    expect(texte(document.getElementById("post-signup-key-value"))).toBe("hx_sk_test");
    expect(document.getElementById("post-signup-email-envoye").hidden).toBe(true);
    const echec = document.getElementById("post-signup-email-echec");
    expect(echec.hidden).toBe(false);
    expect(texte(echec)).toBe(l.signupEchec);
    expect(echec.className).not.toMatch(/err/);

    document.getElementById("post-signup-continue-btn").click();
    await vi.waitFor(() => {
      expect(document.getElementById("dash-content").hidden).toBe(false);
    });
  });

  it("invitation, email parti : message d'envoi, champ vide", async () => {
    const { window, document } = chargerConsole(l.page, true);
    const statut = await connecterPuisInviter(window, document);
    expect(texte(statut)).toBe(l.inviteEnvoye);
    expect(document.getElementById("invite-email").value).toBe("");
  });

  it("invitation, email non parti : l'adresse reste dans le champ, et le message n'est pas en rouge", async () => {
    const { window, document } = chargerConsole(l.page, false);
    const statut = await connecterPuisInviter(window, document);
    expect(texte(statut)).toBe(l.inviteEchec);
    expect(document.getElementById("invite-email").value).toBe("c@heurix.fr");
    expect(statut.classList.contains("err")).toBe(false);
    expect(statut.classList.contains("ok")).toBe(false);
  });

  it("reinitialisation, service d'email configure : message inchange", async () => {
    const { window, document } = chargerConsole(l.page, true);
    const msg = await demanderReinitialisation(window, document);
    expect(texte(msg)).toBe(l.resetEnvoye);
  });

  it("reinitialisation, service d'email absent : le dit, sans le `reason` du moteur", async () => {
    const { window, document } = chargerConsole(l.page, false);
    const msg = await demanderReinitialisation(window, document);
    expect(texte(msg)).toBe(l.resetEchec);
    expect(texte(msg)).not.toContain("configuré");
  });
});
