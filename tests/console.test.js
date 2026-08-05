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
