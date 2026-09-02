import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// LES DOUZE CLEFS QUI N'ONT AUCUN REFERENT DANS CE DEPOT (2 septembre 2026).
//
// Toutes les autres entrees de DICT ont une contrepartie visible ici : une
// chaine de console.js passee a T(), ou un noeud texte de console.html. Ces
// douze-la n'en ont aucune. Elles viennent du `detail` d'une reponse d'erreur
// du MOTEUR, que console.js affiche verbatim (`erreurDeReponse` :
// `if (typeof detail === "string") return detail;`), sans jamais passer par
// T(). Sur en/console.html, elles s'affichaient donc en francais.
//
// Elles ressemblent a du code mort, et c'est le risque que ce test couvre :
// une passe de nettoyage qui cherche les clefs sans usage les retirerait, et
// la console anglaise se remettrait a afficher du francais sans qu'aucun test
// ne bronche.
//
// CE QUE CE TEST NE PEUT PAS FAIRE. Verifier que ces chaines sont encore
// celles du moteur demanderait de lire heurix-engine, que la CI de ce depot
// n'a pas -- meme raison que pour le generateur d'index. La correspondance a
// ete verifiee octet pour octet contre le moteur, une premiere fois a
// l'ecriture le 2 septembre et une seconde le 7 septembre 2026 :
//   9  dans heurix/routers/auth.py -- lignes 42, 53, 58, 178, 183, 203, 230,
//      288, 306 (deux d'entre elles ont un second site, :181 et :205)
//   2  dans heurix/auth.py -- lignes 61 et 63, les deux du mot de passe
//   1  dans heurix/deps.py -- ligne 479, « Session invalide ou expiree »
// Si un message change cote moteur, la clef cesse de correspondre en silence
// et la phrase repasse en francais : defaut visible a l'ecran, pas silencieux
// pour l'utilisateur.
//
// ET CE TEST NE MESURE PAS UNE COUVERTURE. Douze clefs presentes ne veut pas
// dire « les messages de l'API sont traduits » : elles couvrent /v1/auth/* et
// /v1/feedback. Vingt-quatre autres messages francais du moteur atteignent la
// console sur les routes de catalogue, de configuration et de facturation,
// dont vingt-deux sont affiches sans aucune clef. Le detail est en tete de
// console-i18n.js. Un test vert ici ne dit rien de ceux-la.
// ---------------------------------------------------------------------------

const SOURCE = fs.readFileSync(
  path.join(path.resolve(__dirname, ".."), "console-i18n.js"), "utf8");

const MESSAGES_DU_MOTEUR = [
  "Adresse email invalide",
  "Un compte existe déjà avec cet email",
  "Cette adresse a déjà un compte Heurix",
  "Invitation invalide, expirée, ou déjà utilisée",
  "Lien de réinitialisation invalide ou expiré",
  "Compte sans entreprise associée — impossible d'envoyer la demande.",
  "Ce compte n'est rattaché à aucune entreprise",
  "Session invalide ou expirée",
  "Seul un administrateur peut inviter un collègue",
  "Seul un administrateur peut modifier les informations de l'entreprise",
  "Le mot de passe doit faire au moins 10 caractères.",
  "Mot de passe trop long.",
];

describe("messages de l'API traduits pour la console anglaise", () => {
  it.each(MESSAGES_DU_MOTEUR)("« %s » a une traduction", (message) => {
    // La clef est la chaine francaise exacte : c'est la forme que
    // `traduire()` compare, apres trim(), au contenu du noeud texte.
    const clef = new RegExp(
      '"' + message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"\\s*:\\s*\n?\\s*"([^"]+)"');
    const trouve = SOURCE.match(clef);
    expect(trouve, "clef absente de DICT").not.toBeNull();
    expect(trouve[1].length, "traduction vide").toBeGreaterThan(0);
    expect(trouve[1]).not.toBe(message);
  });

  it("les douze sont bien douze — un ajout doit passer par ce test", () => {
    expect(MESSAGES_DU_MOTEUR.length).toBe(12);
    expect(new Set(MESSAGES_DU_MOTEUR).size).toBe(12);
  });
});
