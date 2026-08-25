import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// console.js — jamais testé avant ce chantier (S3, 5 août 2026), alors que
// c'est la plus grosse surface de code du site (3700+ lignes) et l'endroit
// où vit l'état d'un client connecté.
//
// PRINCIPE : console.js est une IIFE qui n'expose aucune fonction interne
// (endSession, startSession, session…) — conforme au reste de la suite
// existante, on teste le CONTRAT OBSERVABLE (ce que voit un vrai
// utilisateur dans le DOM), pas l'implémentation privée.
//
// Ce premier test cible directement le chantier S6 (5 août 2026) : l'état
// de session était remis à zéro par une liste de 9 réaffectations
// manuelles dans endSession() — une ligne oubliée à un futur ajout, et
// c'est une fuite d'état entre deux comptes sur un poste partagé. Regroupé
// en `session = etatInitial()`. Ce test vérifie que le CONTRAT que la
// fonction expose au DOM tient toujours après ce refactor.
// ---------------------------------------------------------------------------

function chargerConsole() {
  const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/console.html", runScripts: "outside-only" });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  window.Element.prototype.scrollIntoView = () => {};

  // Réseau neutralisé : ce test porte sur l'état local, jamais sur un
  // vrai appel API (cohérent avec moqueFetch() du reste de la suite).
  global.fetch = async () => ({ ok: true, json: async () => ({}) });
  window.fetch = global.fetch;

  const i18n = fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8");
  window.eval(i18n);
  const source = fs.readFileSync(path.join(RACINE, "console.js"), "utf8");
  window.eval(source);

  return { dom, window, document: window.document };
}

function salirEtat(window, document) {
  // Simule les traces visibles d'une session active à un instant donné —
  // sans passer par le flux de login complet (hors périmètre de ce test),
  // en imitant directement les effets que startSession()/le reste de la
  // console produisent normalement sur ces éléments.
  localStorage.setItem("heurix_console_session", "faux-jeton-de-test");

  const select = document.getElementById("global-catalog");
  const option = document.createElement("option");
  option.value = "catalogue-client-precedent";
  option.textContent = "Catalogue du compte précédent";
  select.appendChild(option);
  select.disabled = false;

  const banniere = document.getElementById("sandbox-banner");
  banniere.hidden = false;

  const orgBtn = document.getElementById("console-org-btn");
  orgBtn.textContent = "Raison Sociale Précédente SARL";

  const orgDrop = document.querySelector(".console-org-drop");
  if (orgDrop) orgDrop.hidden = false;

  document.getElementById("login-email").value = "reste@du-compte-precedent.fr";
}

describe("console.js — endSession()", () => {
  let window, document;

  beforeEach(() => {
    ({ window, document } = chargerConsole());
  });

  it("efface le jeton de session du stockage local", () => {
    salirEtat(window, document);
    document.getElementById("logout-btn").dispatchEvent(new window.Event("click"));
    expect(localStorage.getItem("heurix_console_session")).toBeNull();
  });

  it("vide et désactive le sélecteur global de catalogue — sans quoi le catalogue du compte précédent reste visible", () => {
    salirEtat(window, document);
    document.getElementById("logout-btn").dispatchEvent(new window.Event("click"));
    const select = document.getElementById("global-catalog");
    expect(select.innerHTML).toBe("");
    expect(select.disabled).toBe(true);
  });

  it("masque la bannière sandbox", () => {
    salirEtat(window, document);
    document.getElementById("logout-btn").dispatchEvent(new window.Event("click"));
    expect(document.getElementById("sandbox-banner").hidden).toBe(true);
  });

  it("réinitialise le menu entreprise — sans quoi la raison sociale du compte précédent reste affichée (bug réel corrigé avant ce chantier)", () => {
    salirEtat(window, document);
    document.getElementById("logout-btn").dispatchEvent(new window.Event("click"));
    expect(document.getElementById("console-org-btn").textContent).not.toContain("Précédente");
    const orgDrop = document.querySelector(".console-org-drop");
    if (orgDrop) expect(orgDrop.hidden).toBe(true);
  });

  it("vide le formulaire de connexion", () => {
    salirEtat(window, document);
    document.getElementById("logout-btn").dispatchEvent(new window.Event("click"));
    expect(document.getElementById("login-email").value).toBe("");
  });

  it("deux déconnexions successives ne cassent rien (idempotence de la remise à zéro)", () => {
    salirEtat(window, document);
    const btn = document.getElementById("logout-btn");
    btn.dispatchEvent(new window.Event("click"));
    expect(() => btn.dispatchEvent(new window.Event("click"))).not.toThrow();
    expect(document.getElementById("global-catalog").disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Une erreur transitoire ne doit pas coûter sa session (25 août 2026).
//
// Défaut réel : les deux `catch` qui pouvaient déconnecter étaient écrits
// SANS ARGUMENT — le code de statut n'était même pas accessible. N'importe
// quelle erreur effaçait donc le jeton. Un 429 (limitation de débit, la
// cause d'échec la plus banale ici) renvoyait l'utilisateur à l'écran de
// connexion en annonçant « impossible de joindre api.heurix.fr », alors que
// l'API avait répondu en 98 ms avec le délai exact à attendre.
//
// Le test porte sur le CHEMIN D'OUVERTURE (/v1/auth/me au chargement de la
// page), le plus dommageable des deux : il s'exécute avant que
// l'utilisateur ait fait quoi que ce soit.
// ---------------------------------------------------------------------------

function chargerConsoleAvecReponse(statut, corps) {
  const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/console.html", runScripts: "outside-only" });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.localStorage = window.localStorage;
  window.Element.prototype.scrollIntoView = () => {};

  // Le jeton existe AVANT le chargement du script : c'est ce qui déclenche
  // l'appel à /v1/auth/me sur le chemin d'ouverture.
  window.localStorage.setItem("heurix_console_session", "jeton-valide-de-test");

  global.fetch = async () => ({ ok: statut >= 200 && statut < 300, status: statut, json: async () => corps });
  window.fetch = global.fetch;

  window.eval(fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(RACINE, "console.js"), "utf8"));
  return { window, document: window.document };
}

const attendreMicrotaches = () => new Promise((r) => setTimeout(r, 0));

describe("console.js — une erreur transitoire ne déconnecte pas", () => {
  it("un 429 au chargement CONSERVE le jeton de session", async () => {
    const { window } = chargerConsoleAvecReponse(429, { detail: "Trop de tentatives. Réessayez dans 30 secondes." });
    await attendreMicrotaches();
    expect(window.localStorage.getItem("heurix_console_session")).toBe("jeton-valide-de-test");
  });

  it("un 429 affiche le message de l'API, pas « impossible de joindre »", async () => {
    const { window, document } = chargerConsoleAvecReponse(429, { detail: "Trop de tentatives. Réessayez dans 30 secondes." });
    await attendreMicrotaches();
    const erreur = document.getElementById("login-error");
    expect(erreur.textContent).toContain("Trop de tentatives");
    expect(erreur.textContent).not.toContain("Impossible de joindre");
  });

  it("un 500 conserve aussi le jeton — transitoire, pas invalidant", async () => {
    const { window } = chargerConsoleAvecReponse(500, { detail: "Erreur interne." });
    await attendreMicrotaches();
    expect(window.localStorage.getItem("heurix_console_session")).toBe("jeton-valide-de-test");
  });

  it("un 401 EFFACE le jeton — là, la session ne vaut plus rien", async () => {
    const { window } = chargerConsoleAvecReponse(401, { detail: "Jeton invalide." });
    await attendreMicrotaches();
    expect(window.localStorage.getItem("heurix_console_session")).toBeNull();
  });

  it("un 403 efface aussi le jeton", async () => {
    const { window } = chargerConsoleAvecReponse(403, { detail: "Accès refusé." });
    await attendreMicrotaches();
    expect(window.localStorage.getItem("heurix_console_session")).toBeNull();
  });

  it("un 401 dit que la session a expiré, pas que l'API est injoignable", async () => {
    const { document } = chargerConsoleAvecReponse(401, { detail: "Jeton invalide." });
    await attendreMicrotaches();
    expect(document.getElementById("login-error").textContent).toContain("session a expiré");
  });
});

// ---------------------------------------------------------------------------
// Mise en forme des erreurs de validation (25 août 2026).
//
// `detail` est une CHAÎNE sur les erreurs métier, mais une LISTE d'objets
// Pydantic sur les erreurs de validation. `new Error(liste)` donnait
// « [object Object] » — et les 15 sites qui affichaient déjà err.message
// montraient donc cela à un marchand.
//
// Les formes testées ici sont celles produites réellement par les modèles
// de l'API (SignupBody, ConfirmPasswordResetBody), relevées hors ligne en
// les validant avec de mauvaises entrées — pas inventées.
// ---------------------------------------------------------------------------

describe("console.js — un detail en liste devient une phrase", () => {
  it("trois champs manquants tiennent en UNE phrase", async () => {
    const { document } = chargerConsoleAvecReponse(422, {
      detail: [
        { type: "missing", loc: ["body", "email"], msg: "Field required" },
        { type: "missing", loc: ["body", "password"], msg: "Field required" },
        { type: "missing", loc: ["body", "raison_sociale"], msg: "Field required" },
      ],
    });
    await attendreMicrotaches();
    const texte = document.getElementById("login-error").textContent;
    expect(texte).toBe("L'email, le mot de passe et la raison sociale sont obligatoires.");
  });

  it("un seul champ manquant reste au singulier", async () => {
    const { document } = chargerConsoleAvecReponse(422, {
      detail: [{ type: "missing", loc: ["body", "password"], msg: "Field required" }],
    });
    await attendreMicrotaches();
    expect(document.getElementById("login-error").textContent).toBe("Le mot de passe est obligatoire.");
  });

  it("min_length=1 se dit « ne peut pas être vide », pas « moins de 1 caractère »", async () => {
    const { document } = chargerConsoleAvecReponse(422, {
      detail: [{
        type: "string_too_short", loc: ["body", "raison_sociale"],
        msg: "String should have at least 1 character", ctx: { min_length: 1 },
      }],
    });
    await attendreMicrotaches();
    expect(document.getElementById("login-error").textContent).toBe("La raison sociale ne peut pas être vide.");
  });

  it("un indice de liste devient « du produit n°4 », pas « items[3] »", async () => {
    const { document } = chargerConsoleAvecReponse(422, {
      detail: [{ type: "missing", loc: ["body", "items", 3, "id"], msg: "Field required" }],
    });
    await attendreMicrotaches();
    expect(document.getElementById("login-error").textContent).toContain("du produit n°4");
  });

  it("au-delà de trois problèmes, le reste est annoncé et non déroulé", async () => {
    const champs = ["name", "pattern", "q", "token", "email"];
    const { document } = chargerConsoleAvecReponse(422, {
      detail: champs.map((c) => ({
        type: "string_too_long", loc: ["body", c],
        msg: "too long", ctx: { max_length: 10 },
      })),
    });
    await attendreMicrotaches();
    const texte = document.getElementById("login-error").textContent;
    expect(texte).toContain("Et 2 autre(s)");
    expect(texte.split("dépasse").length - 1).toBe(3);
  });

  it("JAMAIS « [object Object] », même sur un type inconnu", async () => {
    const { document } = chargerConsoleAvecReponse(422, {
      detail: [{ type: "un_type_que_personne_n_a_prevu", loc: ["body", "email"], msg: "Something odd" }],
    });
    await attendreMicrotaches();
    const texte = document.getElementById("login-error").textContent;
    expect(texte).not.toContain("[object Object]");
    expect(texte).toContain("Something odd");
  });

  it("`solution` est affichée — c'est le champ qui dit quoi faire", async () => {
    const { document } = chargerConsoleAvecReponse(422, {
      detail: "Envoi trop volumineux : 10000 produits reçus, 5000 au maximum par appel.",
      solution: "Découpez votre catalogue en 2 envois de 5000 produits maximum.",
      documentation: "https://heurix.fr/docs.html#ep-items",
    });
    await attendreMicrotaches();
    const texte = document.getElementById("login-error").textContent;
    expect(texte).toContain("Envoi trop volumineux");
    expect(texte).toContain("Découpez votre catalogue en 2 envois");
    // `documentation` reste dehors : une URL non cliquable est du bruit.
    expect(texte).not.toContain("https://");
  });

  it("un detail en chaîne passe inchangé", async () => {
    const { document } = chargerConsoleAvecReponse(429, { detail: "Trop de tentatives. Réessayez dans 30 secondes." });
    await attendreMicrotaches();
    expect(document.getElementById("login-error").textContent).toBe("Trop de tentatives. Réessayez dans 30 secondes.");
  });
});

// ---------------------------------------------------------------------------
// Propagation du message aux sites qui affichaient un générique (25 août 2026).
//
// Le formulaire de connexion ne traitait QUE le 401 : tout le reste — 429,
// 403, 5xx — tombait sur « Impossible de joindre api.heurix.fr ». C'est le
// chemin exact qui a coûté un quart d'heure de recherche de panne.
// ---------------------------------------------------------------------------

function chargerConsoleSansSession(reponsePourLogin) {
  const html = fs.readFileSync(path.join(RACINE, "console.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/console.html", runScripts: "outside-only" });
  const { window } = dom;
  global.window = window; global.document = window.document; global.localStorage = window.localStorage;
  window.Element.prototype.scrollIntoView = () => {};
  window.localStorage.clear();
  const f = async () => reponsePourLogin;
  global.fetch = f; window.fetch = f;
  window.eval(fs.readFileSync(path.join(RACINE, "console-i18n.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(RACINE, "console.js"), "utf8"));
  return { window, document: window.document };
}

async function soumettreConnexion(document, window) {
  document.getElementById("login-email").value = "marchand@exemple.fr";
  document.getElementById("login-password").value = "motdepasse";
  document.getElementById("login-form").dispatchEvent(new window.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
}

describe("console.js — le formulaire de connexion dit ce que l'API a répondu", () => {
  it("un 429 affiche le délai exact, pas « impossible de joindre »", async () => {
    const { window, document } = chargerConsoleSansSession({
      ok: false, status: 429,
      json: async () => ({ detail: "Trop de tentatives. Réessayez dans 30 secondes." }),
    });
    await soumettreConnexion(document, window);
    const texte = document.getElementById("login-error").textContent;
    expect(texte).toBe("Trop de tentatives. Réessayez dans 30 secondes.");
    expect(texte).not.toContain("Impossible de joindre");
  });

  it("un 401 garde son message dédié — l'API masque volontairement la cause", async () => {
    const { window, document } = chargerConsoleSansSession({
      ok: false, status: 401, json: async () => ({ detail: "Identifiants invalides." }),
    });
    await soumettreConnexion(document, window);
    expect(document.getElementById("login-error").textContent).toBe("Email ou mot de passe incorrect.");
  });

  it("un 422 en liste devient une phrase, même sur ce formulaire", async () => {
    const { window, document } = chargerConsoleSansSession({
      ok: false, status: 422,
      json: async () => ({ detail: [{ type: "missing", loc: ["body", "password"], msg: "Field required" }] }),
    });
    await soumettreConnexion(document, window);
    expect(document.getElementById("login-error").textContent).toBe("Le mot de passe est obligatoire.");
  });
});
