import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "..");

/* UNE ARCHIVE N'AFFIRME PAS UNE ACCEPTATION (18 septembre 2026).
 *
 * cgv-1.0.html se disait « conservée telle qu'elle a été acceptée ». Rien
 * n'enregistrait alors qu'un client l'avait acceptee, ni laquelle : le
 * moteur ne garde la version cochee qu'a partir de ce lot. Une archive dit
 * ce qui a ete publie.
 */
const ARCHIVES = ["", "en/"].flatMap((d) =>
  fs.readdirSync(path.join(RACINE, d)).filter((f) => /^cgv-\d+\.\d+\.html$/.test(f)).map((f) => d + f));

describe("archives des CGV", () => {
  it("le balayage trouve les archives FR et EN", () => {
    expect(ARCHIVES).toContain("cgv-1.0.html");
    expect(ARCHIVES).toContain("en/cgv-1.0.html");
  });

  it.each(ARCHIVES)("%s se dit publiee, pas acceptee", (f) => {
    const html = fs.readFileSync(path.join(RACINE, f), "utf8");
    expect(html).not.toMatch(/telle qu'elle a été acceptée|as it was accepted/);
    expect(html).toMatch(/telle qu'elle a été publiée|as it was published/);
  });
});
