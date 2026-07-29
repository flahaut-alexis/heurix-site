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


/* Appel API propre au module.
 *
 * `apiFetch` de console.js est enfermée dans sa fonction anonyme, donc
 * invisible d'ici. L'exposer globalement aurait créé un couplage pour rien :
 * l'appel dont on a besoin tient en quinze lignes.
 *
 * DÉFAUT TROUVÉ APRÈS COUP. Ma première version appelait `apiFetch(chemin,
 * options)` — une signature inventée. Elle n'existait pas, et l'écran
 * restait vide sans la moindre erreur visible.
 */
const API_BASE = "https://api.heurix.fr";
const CLE_SESSION = "heurix_console_session";

function jeton() {
  // DEUX IDENTIFIANTS DISTINCTS, et les confondre échoue en silence.
  //
  // Le jeton de SESSION authentifie l'utilisateur de la console. La clé
  // API autorise les opérations sur les catalogues — indexation comprise.
  // Ma première version envoyait le jeton de session : le serveur
  // répondait « Invalid API key » sur chaque lot.
  //
  // `console.js` expose la clé courante après connexion. On retombe sur le
  // jeton de session pour les appels de lecture, qui l'acceptent.
  if (typeof window !== "undefined" && window.HEURIX_CLE_API) {
    return window.HEURIX_CLE_API;
  }
  try { return localStorage.getItem(CLE_SESSION) || ""; } catch (e) { return ""; }
}

async function appelApi(chemin, options = {}) {
  const entetes = { Authorization: "Bearer " + jeton() };
  if (options.body) entetes["Content-Type"] = "application/json";
  const r = await fetch(API_BASE + chemin, {
    method: options.method || "GET",
    headers: entetes,
    body: options.body,
  });
  const donnees = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(donnees.detail || donnees.solution || ("HTTP " + r.status));
    err.status = r.status;
    throw err;
  }
  return donnees;
}

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
  rendreVerdict();
  recommanderPack();

  $("csv-correspondance").querySelectorAll("select").forEach((s) => {
    s.addEventListener("change", () => {
      const champ = s.getAttribute("data-champ");
      if (s.value === "") delete etat.correspondance[champ];
      else etat.correspondance[champ] = Number(s.value);
      rendreCorrespondance();
    });
  });
}


/* Contrôle immédiat de la correspondance.
 *
 * DÉFAUT CORRIGÉ APRÈS UN VRAI IMPORT. Une correspondance fausse — la
 * colonne Identifiant pointée sur « Descriptif technique » — ne se voyait
 * qu'APRÈS l'envoi, dans le rapport : 462 lignes ignorées sur 502.
 *
 * L'utilisateur n'avait aucun moyen de s'en apercevoir avant. On teste
 * donc la correspondance sur un échantillon et on affiche le verdict sous
 * le tableau, en temps réel.
 */
function rendreVerdict() {
  const zone = $("csv-verdict");
  if (!zone) return;

  const lignes = etat.texte.split(/\r?\n/).filter((l) => l.trim());
  // 60 lignes suffisent à révéler une correspondance fausse, et restent
  // instantanées même sur un fichier de 100 000 lignes.
  const echantillon = [lignes[0], ...lignes.slice(1, 61)].join("\n");
  const { produits, erreurs } = convertir(echantillon, etat.correspondance, {
    separateur: etat.separateur,
  });
  const testees = produits.length + erreurs.length;
  if (!testees) { zone.hidden = true; return; }

  const tauxEchec = erreurs.length / testees;
  zone.hidden = false;

  if (etat.correspondance.id === undefined) {
    zone.className = "csv-verdict csv-verdict-erreur";
    zone.innerHTML = "<strong>Colonne Identifiant non choisie.</strong> " +
      "Sans elle, aucun produit ne peut être importé — et un second import " +
      "créerait des doublons au lieu de mettre à jour.";
    return;
  }

  if (tauxEchec > 0.3) {
    // Au-delà d'un tiers d'échecs, ce n'est plus un fichier imparfait :
    // c'est la correspondance qui est fausse.
    zone.className = "csv-verdict csv-verdict-erreur";
    const exemple = erreurs[0] ? erreurs[0].cause : "";
    zone.innerHTML = "<strong>" + Math.round(tauxEchec * 100) +
      " % des lignes testées seraient ignorées.</strong> La colonne " +
      "Identifiant ne semble pas la bonne — vérifiez qu'elle contient bien " +
      "une référence unique par produit." +
      (exemple ? "<br><span class='csv-verdict-exemple'>" + escaper(exemple) + "</span>" : "");
    return;
  }

  zone.className = "csv-verdict csv-verdict-ok";
  zone.innerHTML = "<strong>" + produits.length + " produits sur " + testees +
    " lignes testées.</strong> " +
    (erreurs.length
      ? erreurs.length + " ligne(s) seraient ignorées — c'est normal si votre export contient des lignes vides ou des doublons."
      : "La correspondance semble correcte.");
}


/* Recommandation de pack, AVANT l'import.
 *
 * DÉFAUT SIGNALÉ APRÈS UN VRAI IMPORT. Le sélecteur de pack demandait un
 * choix à l'aveugle : rien n'indiquait quel pack convenait au fichier. La
 * recommandation existait, mais seulement APRÈS indexation — donc trop
 * tard, puisque corriger imposait de tout réimporter.
 *
 * On envoie un échantillon dès que la correspondance permet d'extraire des
 * libellés, et on préselectionne le pack recommandé.
 */
let recoEnCours = false;

async function recommanderPack() {
  const zone = $("csv-reco");
  if (!zone || recoEnCours) return;
  if (etat.correspondance.name === undefined && etat.correspondance.ref === undefined) {
    zone.hidden = true;
    return;
  }

  const lignes = etat.texte.split(/\r?\n/).filter((l) => l.trim());
  // 100 produits suffisent à trancher — le classement ne bouge plus au-delà.
  const echantillon = [lignes[0], ...lignes.slice(1, 101)].join("\n");
  const { produits } = convertir(echantillon, etat.correspondance, {
    separateur: etat.separateur,
  });
  if (!produits.length) { zone.hidden = true; return; }

  recoEnCours = true;
  zone.hidden = false;
  zone.className = "csv-reco";
  zone.textContent = "Analyse du contenu…";

  try {
    const d = await appelApi("/v1/rulepacks/suggest", {
      method: "POST",
      body: JSON.stringify({ items: produits.slice(0, 300) }),
    });
    if (!d.recommande) {
      zone.className = "csv-reco csv-reco-neutre";
      zone.innerHTML = "<strong>Aucun pack ne se détache</strong> sur cet échantillon. " +
        "Vous pouvez importer sans pack : la recherche fonctionnera sur les mots, " +
        "sans reconnaissance de structure.";
      return;
    }
    const meilleur = (d.classement || [])[0] || {};
    zone.className = "csv-reco csv-reco-ok";
    zone.innerHTML = "<strong>Pack recommandé : " + escaper(d.recommande) + "</strong>" +
      (meilleur.produits_annotes !== undefined
        ? " — " + meilleur.produits_annotes + " produits sur " +
          Math.min(produits.length, 300) + " reconnus."
        : "") +
      "<br><span class='csv-reco-note'>Sélectionné automatiquement. " +
      "Vous pouvez le changer ci-dessous.</span>";

    // Présélection, sans forcer : l'utilisateur reste maître du choix.
    const sel = $("csv-rulepack");
    if (sel && !sel.value) {
      const opt = [...sel.options].find((o) => o.value === d.recommande);
      if (opt) sel.value = d.recommande;
    }
  } catch (e) {
    zone.hidden = true;   // silencieux : l'import reste possible sans reco
  } finally {
    recoEnCours = false;
  }
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
      const r = await appelApi("/v1/index/" + encodeURIComponent(catalogue) + "/items", {
        method: "POST",
        body: JSON.stringify(lots[i]),
      });
      envoyes += (r && r.indexed) || lots[i].items.length;
    } catch (e) {
      // ÉCHEC PARTIEL. On continue les lots suivants plutôt que de tout
      // arrêter : un import de 50 000 produits ne doit pas être perdu
      // parce que le lot 7 a échoué. Les identifiants sont stables, donc
      // relancer l'import ne créera pas de doublons.
      var cause = e.message || String(e);
      if (e.status === 401 || e.status === 403 || /invalid api key/i.test(cause)) {
        cause = "clé API refusée. Rechargez la console : votre session a " +
                "peut-être expiré.";
      }
      echecs.push("Lot " + (i + 1) + " sur " + lots.length + " : " + cause);
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
  appelApi("/v1/rulepacks").then((d) => {
    const sel = $("csv-rulepack");
    (d.rulepacks || []).forEach((p) => {
      const o = document.createElement("option");
      o.value = p.name;
      o.textContent = p.name;
      sel.appendChild(o);
    });
  }).catch(() => {
    // Silencieux : l'import reste possible sans pack, et une alerte au
    // chargement d'un écran qu'on n'a pas encore ouvert serait intrusive.
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
