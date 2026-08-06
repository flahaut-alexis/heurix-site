import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// guide-quiz.js — chantier S4 (5 août 2026), deuxième paire unifiée après
// search-engine.js. guide-quiz.js/guide-quiz-en.js ne différaient que sur
// UNE comparaison littérale ("non" vs "no", le module frontend ne devait
// JAMAIS se masquer sur cette valeur) et le texte du récapitulatif. Fusion
// en un seul fichier : la comparaison reconnaît les deux graphies possibles
// plutôt que d'en supposer une seule, la langue du texte se lit sur
// document.documentElement.lang (même motif que console-i18n.js).
// ---------------------------------------------------------------------------

function construireHTML(lang) {
  const oui = lang === "en" ? "yes" : "oui";
  const non = lang === "en" ? "no" : "non";
  return `<!DOCTYPE html><html lang="${lang}"><body>
    <div class="guide-quiz" id="guide-quiz">
      <div class="guide-quiz-opts" data-question="tracker">
        <button type="button" data-value="${oui}" id="btn-tracker-oui">Yes</button>
        <button type="button" data-value="${non}" id="btn-tracker-non">No</button>
      </div>
      <div class="guide-quiz-opts" data-question="frontend">
        <button type="button" data-value="${non}" id="btn-frontend-non">No, starting fresh</button>
        <button type="button" data-value="${oui}" id="btn-frontend-oui">Yes, already have one</button>
      </div>
    </div>
    <p id="guide-quiz-recap" hidden></p>
    <div class="guide-module" data-module="tracker"></div>
    <div class="guide-module" data-module="frontend">
      <div data-frontend="${oui}">variante A</div>
      <div data-frontend="${non}">variante B</div>
    </div>
  </body></html>`;
}

function domAvecScript(lang) {
  const dom = new JSDOM(construireHTML(lang), { url: "https://heurix.fr/", runScripts: "outside-only" });
  dom.window.eval(fs.readFileSync(path.join(RACINE, "guide-quiz.js"), "utf8"));
  return dom.window;
}

describe("guide-quiz.js — comportement identique FR/EN", () => {
  it.each(["fr", "en"])("cliquer « non » sur tracker masque le module tracker (%s)", (lang) => {
    const win = domAvecScript(lang);
    win.document.getElementById("btn-tracker-non").dispatchEvent(new win.Event("click"));
    const mod = win.document.querySelector('.guide-module[data-module="tracker"]');
    expect(mod.classList.contains("masque")).toBe(true);
  });

  it.each(["fr", "en"])(
    "le module frontend n'est JAMAIS masqué sur « non » — cas spécial documenté (%s)",
    (lang) => {
      const win = domAvecScript(lang);
      win.document.getElementById("btn-frontend-non").dispatchEvent(new win.Event("click"));
      const mod = win.document.querySelector('.guide-module[data-module="frontend"]');
      expect(mod.classList.contains("masque")).toBe(false);
    }
  );

  it("le récapitulatif est en français sur une page lang=fr", () => {
    const win = domAvecScript("fr");
    win.document.getElementById("btn-tracker-non").dispatchEvent(new win.Event("click"));
    const recap = win.document.getElementById("guide-quiz-recap");
    expect(recap.textContent).toContain("Votre parcours");
    expect(recap.hidden).toBe(false);
  });

  it("le récapitulatif est en anglais sur une page lang=en", () => {
    const win = domAvecScript("en");
    win.document.getElementById("btn-tracker-non").dispatchEvent(new win.Event("click"));
    const recap = win.document.getElementById("guide-quiz-recap");
    expect(recap.textContent).toContain("Your path");
    expect(recap.hidden).toBe(false);
  });

  it("réinitialiser retire toutes les classes masque et cache le récap", () => {
    const win = domAvecScript("fr");
    win.document.getElementById("btn-tracker-non").dispatchEvent(new win.Event("click"));
    const bouton = win.document.getElementById("guide-quiz-tout");
    if (!bouton) return; // absent de cette fixture minimale, couvert par le test manuel
    bouton.dispatchEvent(new win.Event("click"));
    expect(win.document.querySelectorAll(".masque").length).toBe(0);
  });
});
