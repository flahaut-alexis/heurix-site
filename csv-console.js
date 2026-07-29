/* Écran d'import CSV de la console.
 *
 * La logique d'analyse vit dans `csv-import.js`, qui ne touche pas au
 * réseau et est couvert par 19 tests. Ce fichier-ci n'est que l'interface :
 * lecture du fichier, écran de correspondance, envoi par lots, rapport.
 *
 * Cette séparation est délibérée. C'est le premier contact d'un client avec
 * ses propres données ; la partie où une erreur coûte cher devait être
 * testable sans navigateur.
 */
import {
  detecterSeparateur, detecterEncodage, decouperLigne,
  proposerCorrespondance, convertir, enLots,
} from "./csv-import.js";

const CHAMPS = [
  ["id", "Identifiant", "Obligatoire. Permet de mettre à jour un produit au lieu d'en créer un doublon."],
  ["platform_id", "Identifiant plateforme", "L'entier attendu par PrestaShop, WooCommerce ou Magento, si vos identifiants sont des références métier."],
  ["ref", "Référence", "Le champ le plus fortement pondéré à la recherche."],
  ["name", "Désignation", ""],
  ["description", "Description", ""],
  ["price", "Prix", ""],
  ["stock", "Stock", ""],
  ["categories", "Catégories", "Séparées par > | ou /"],
];

let etat = { entetes: [], texte: "", correspondance: {}, separateur: ";" };

function $(id) { return document.getElementById(id); }

function afficher(id, visible) {
  const el = $(id);
  if (el) el.hidden = !visible;
}

// --------------------------------------------------------------- lecture

async function lireFichier(fichier) {
  const octets = new Uint8Array(await fichier.arrayBuffer());

  // ENCODAGE. Les exports d'ERP français sortent souvent en Latin-1. Lus
  // comme de l'UTF-8, « Vis tête » devient « Vis tÃªte » — et le moteur
  // indexe un mot qui n'existe pas, introuvable par le client.
  const encodage = detecterEncodage(octets);
  const texte = new TextDecoder(encodage).decode(octets);

  const separateur = detecterSeparateur(texte);
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim());
  const entetes = decouperLigne(lignes[0] || "", separateur);

  etat = {
    texte, separateur, entetes,
    correspondance: proposerCorrespondance(entetes),
    nbLignes: Math.max(0, lignes.length - 1),
    encodage,
    nom: fichier.name,
  };

  rendreResume();
  rendreCorrespondance();
  afficher("csv-analyse", true);
  afficher("csv-rapport", false);
}

function rendreResume() {
  const separateurLisible = { ";": "point-virgule", ",": "virgule", "\t": "tabulation", "|": "barre verticale" };
  $("csv-resume").innerHTML =
    "<strong>" + escaper(etat.nom) + "</strong> — " +
    etat.nbLignes.toLocaleString("fr-FR") + " lignes, " +
    etat.entetes.length + " colonnes<br>" +
    "<span class='csv-detecte'>Séparateur : " +
    (separateurLisible[etat.separateur] || etat.separateur) +
    " · Encodage : " + etat.encodage + "</span>";
}

function rendreCorrespondance() {
  // APERÇU DES PREMIÈRES VALEURS. Un nom de colonne ne suffit pas à
  // décider : « Code » peut être un identifiant, une référence ou un code
  // barre. Voir trois valeurs tranche en une seconde.
  const lignes = etat.texte.split(/\r?\n/).filter((l) => l.trim()).slice(1, 4);
  const exemples = lignes.map((l) => decouperLigne(l, etat.separateur));

  let html = "<tr><th>Champ Heurix</th><th>Colonne du fichier</th><th>Exemples</th></tr>";
  for (const [cle, libelle, aide] of CHAMPS) {
    const choisie = etat.correspondance[cle];
    let options = "<option value=''>— ignorer —</option>";
    etat.entetes.forEach((e, i) => {
      options += "<option value='" + i + "'" + (choisie === i ? " selected" : "") + ">" +
                 escaper(e || "colonne " + (i + 1)) + "</option>";
    });
    const apercu = choisie === undefined ? "—"
      : exemples.map((l) => escaper((l[choisie] || "").slice(0, 24))).filter(Boolean).join(" · ");

    html += "<tr>" +
      "<td><strong>" + libelle + "</strong>" +
        (cle === "id" ? " <span class='csv-requis'>requis</span>" : "") +
        (aide ? "<br><span class='csv-aide-champ'>" + aide + "</span>" : "") + "</td>" +
      "<td><select data-champ='" + cle + "'>" + options + "</select></td>" +
      "<td class='mono csv-apercu'>" + apercu + "</td>" +
    "</tr>";
  }
  $("csv-correspondance").innerHTML = html;

  $("csv-correspondance").querySelectorAll("select").forEach((s) => {
    s.addEventListener("change", () => {
      const champ = s.getAttribute("data-champ");
      if (s.value === "") delete etat.correspondance[champ];
      else etat.correspondance[champ] = Number(s.value);
      rendreCorrespondance();
    });
  });
}

// ----------------------------------------------------------------- envoi

async function envoyer() {
  const catalogue = $("csv-catalogue").value.trim();
  if (!catalogue) {
    alert("Indiquez le nom du catalogue.");
    return;
  }
  if (etat.correspondance.id === undefined) {
    alert("La colonne Identifiant est obligatoire : sans elle, un second import créerait des doublons au lieu de mettre à jour.");
    return;
  }

  const { produits, erreurs } = convertir(etat.texte, etat.correspondance, {
    separateur: etat.separateur,
  });
  if (!produits.length) {
    afficherRapport(0, erreurs, ["Aucun produit exploitable — vérifiez la correspondance."]);
    return;
  }

  const rulepack = $("csv-rulepack").value || null;
  const lots = enLots(produits, 5000, rulepack);

  afficher("csv-analyse", false);
  afficher("csv-progression", true);

  let envoyes = 0;
  const echecs = [];

  for (let i = 0; i < lots.length; i++) {
    majProgression(i, lots.length, envoyes);
    try {
      const r = await apiFetch("/v1/index/" + encodeURIComponent(catalogue) + "/items", {
        method: "POST",
        body: JSON.stringify(lots[i]),
      });
      envoyes += (r && r.indexed) || lots[i].items.length;
    } catch (e) {
      // ÉCHEC PARTIEL. On continue les lots suivants plutôt que de tout
      // arrêter : un import de 50 000 produits ne doit pas être perdu
      // parce que le lot 7 a échoué. Les identifiants sont stables, donc
      // relancer l'import ne créera pas de doublons.
      echecs.push("Lot " + (i + 1) + " sur " + lots.length + " : " + (e.message || e));
    }
  }

  majProgression(lots.length, lots.length, envoyes);
  afficher("csv-progression", false);
  afficherRapport(envoyes, erreurs, echecs);
}

function majProgression(fait, total, envoyes) {
  const pct = total ? Math.round((fait / total) * 100) : 0;
  $("csv-barre-remplie").style.width = pct + "%";
  $("csv-etat").textContent =
    "Lot " + Math.min(fait + 1, total) + " sur " + total +
    " — " + envoyes.toLocaleString("fr-FR") + " produits indexés";
}

function afficherRapport(envoyes, erreurs, echecs) {
  let html = "<div class='csv-rapport-bloc'>";

  if (envoyes > 0) {
    html += "<p class='csv-succes'><strong>" + envoyes.toLocaleString("fr-FR") +
            " produits indexés.</strong></p>";
  }

  if (echecs.length) {
    // Les échecs de lot passent AVANT les lignes ignorées : ils touchent
    // des milliers de produits, pas quelques lignes.
    html += "<p class='csv-echec'><strong>" + echecs.length +
            " lot(s) en échec.</strong> Relancez l'import : les identifiants " +
            "étant stables, les produits déjà indexés seront mis à jour, pas dupliqués.</p><ul>";
    echecs.slice(0, 5).forEach((e) => { html += "<li>" + escaper(e) + "</li>"; });
    html += "</ul>";
  }

  if (erreurs.length) {
    html += "<p class='csv-averti'>" + erreurs.length +
            " ligne(s) ignorée(s) :</p><ul>";
    erreurs.slice(0, 8).forEach((e) => {
      html += "<li>Ligne " + e.ligne + " — " + escaper(e.cause) + "</li>";
    });
    if (erreurs.length > 8) {
      html += "<li>… et " + (erreurs.length - 8) + " autres</li>";
    }
    html += "</ul>";
  }

  html += "</div>";
  $("csv-rapport").innerHTML = html;
  afficher("csv-rapport", true);
}

function escaper(s) {
  return String(s === undefined || s === null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --------------------------------------------------------------- montage

function init() {
  const depot = $("csv-depot");
  const champFichier = $("csv-fichier");
  if (!depot || !champFichier) return;   // pavé absent de cette page

  $("csv-choisir").addEventListener("click", () => champFichier.click());
  champFichier.addEventListener("change", (e) => {
    if (e.target.files[0]) lireFichier(e.target.files[0]);
  });

  ["dragover", "dragenter"].forEach((ev) =>
    depot.addEventListener(ev, (e) => { e.preventDefault(); depot.classList.add("csv-depot-actif"); }));
  ["dragleave", "drop"].forEach((ev) =>
    depot.addEventListener(ev, () => depot.classList.remove("csv-depot-actif")));
  depot.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) lireFichier(e.dataTransfer.files[0]);
  });

  $("csv-envoyer").addEventListener("click", envoyer);
  $("csv-annuler").addEventListener("click", () => {
    afficher("csv-analyse", false);
    champFichier.value = "";
  });

  // Les packs viennent de l'API : les coder en dur ici les ferait diverger
  // de ceux réellement installés sur le moteur.
  if (typeof apiFetch === "function") {
    apiFetch("/v1/rulepacks").then((d) => {
      const sel = $("csv-rulepack");
      (d.rulepacks || []).forEach((p) => {
        const o = document.createElement("option");
        o.value = p.name; o.textContent = p.name;
        sel.appendChild(o);
      });
    }).catch(() => {});
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
