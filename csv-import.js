/* Import CSV — analyse et correspondance de colonnes.
 *
 * POURQUOI CE CHANTIER. Un distributeur technique exporte son catalogue en
 * CSV depuis son ERP ou son PIM, jamais en JSON. Aujourd'hui, entre son
 * fichier et un catalogue indexé, il y a un script à écrire — le seul
 * obstacle du parcours qui demande une compétence de développeur.
 *
 * CE FICHIER NE TOUCHE PAS AU RÉSEAU. Il transforme du texte CSV en lots
 * prêts à envoyer, et rien d'autre. Cette séparation permet de le tester
 * entièrement, ce qui compte : c'est le premier contact d'un client avec
 * ses propres données, et une erreur y est plus coûteuse qu'ailleurs.
 */

/* ------------------------------------------------------------------ *
 * Détection du séparateur                                             *
 *                                                                      *
 * Les exports français utilisent massivement le point-virgule, parce   *
 * qu'Excel en français le choisit par défaut — la virgule y est le     *
 * séparateur décimal. Supposer la virgule ferait échouer la majorité   *
 * des fichiers de votre cible.                                         *
 * ------------------------------------------------------------------ */
export function detecterSeparateur(texte) {
  const candidats = [";", ",", "\t", "|"];
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim()).slice(0, 5);
  if (!lignes.length) return ";";

  let meilleur = ";";
  let meilleurScore = -1;

  for (const sep of candidats) {
    const comptes = lignes.map((l) => decouperLigne(l, sep).length);
    const premier = comptes[0];
    // Un bon séparateur donne le MÊME nombre de colonnes sur toutes les
    // lignes. Un mauvais donne des comptes erratiques — c'est cette
    // régularité qu'on mesure, pas la fréquence brute du caractère.
    const regulier = comptes.every((c) => c === premier);
    const score = regulier && premier > 1 ? premier : 0;
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = sep;
    }
  }
  return meilleur;
}

/* ------------------------------------------------------------------ *
 * Découpage d'une ligne, en respectant les guillemets                 *
 *                                                                      *
 * Un libellé produit contient très souvent le séparateur : « Vis TH,  *
 * inox A2 ». Un simple split() casserait la ligne en deux colonnes et  *
 * décalerait tout le reste du fichier.                                 *
 * ------------------------------------------------------------------ */
export function decouperLigne(ligne, separateur) {
  const champs = [];
  let courant = "";
  let dansGuillemets = false;

  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      // Deux guillemets consécutifs à l'intérieur d'un champ = un
      // guillemet littéral, convention CSV standard.
      if (dansGuillemets && ligne[i + 1] === '"') {
        courant += '"';
        i++;
      } else {
        dansGuillemets = !dansGuillemets;
      }
    } else if (c === separateur && !dansGuillemets) {
      champs.push(courant);
      courant = "";
    } else {
      courant += c;
    }
  }
  champs.push(courant);
  return champs.map((c) => c.trim());
}

/* ------------------------------------------------------------------ *
 * Détection d'encodage                                                *
 *                                                                      *
 * Les exports d'ERP français sortent souvent en Latin-1 (Windows-1252) *
 * plutôt qu'en UTF-8. Lu comme de l'UTF-8, « Vis tête » devient        *
 * « Vis tÃªte » — et le moteur indexe un mot qui n'existe pas.         *
 * ------------------------------------------------------------------ */
export function detecterEncodage(octets) {
  // Marque d'ordre des octets UTF-8
  if (octets.length >= 3 && octets[0] === 0xef && octets[1] === 0xbb && octets[2] === 0xbf) {
    return "utf-8";
  }
  // On tente un décodage UTF-8 strict : s'il échoue, c'est du Latin-1.
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(octets);
    return "utf-8";
  } catch (e) {
    return "windows-1252";
  }
}

/* ------------------------------------------------------------------ *
 * Correspondance automatique des colonnes                             *
 *                                                                      *
 * Devine à quoi correspond chaque en-tête. Ce n'est qu'une PROPOSITION *
 * — l'écran de correspondance doit permettre de la corriger. Deviner   *
 * sans laisser corriger produirait des catalogues silencieusement      *
 * faux.                                                                *
 * ------------------------------------------------------------------ */
// Les en-têtes réels d'un ERP français ressemblent rarement aux noms de
// champs d'une API. « Code article », « Réf. fournisseur », « Qté dispo » —
// c'est ce vocabulaire qu'il faut reconnaître, pas « id » et « stock ».
//
// La liste vient d'un test sur un export réaliste : ma première version ne
// reconnaissait AUCUNE des colonnes d'identifiant et de référence.
export const INDICES = {
  // L'ordre compte : « platform_id » est cherché avant « id » pour qu'une
  // colonne « id_product » ne soit pas prise pour l'identifiant métier.
  platform_id: ["platform_id", "id_prestashop", "id_presta", "post_id", "entity_id"],
  id: ["id", "identifiant", "id_produit", "product_id", "sku", "code",
       "code_article", "code_produit", "article", "no_article", "num_article",
       "code_interne", "cle"],
  ref: ["ref", "reference", "ref_fournisseur", "reference_fournisseur",
        "ref_fabricant", "mpn", "ean", "ean13", "gencod", "code_barre",
        "code_ean", "ref_constructeur"],
  name: ["name", "nom", "libelle", "designation", "titre", "title",
         "denomination", "intitule", "nom_produit", "libelle_article"],
  description: ["description", "descriptif", "detail", "texte",
                "description_longue", "commentaire", "notes"],
  price: ["price", "prix", "prix_ht", "tarif", "pu", "prix_unitaire",
          "prix_vente", "pv_ht", "tarif_ht", "prix_public"],
  stock: ["stock", "quantite", "qty", "quantity", "dispo", "disponible",
          "qte", "qte_dispo", "quantite_dispo", "stock_dispo", "en_stock",
          "availability", "in_stock", "instock"],
  categories: ["categorie", "category", "categories", "rayon", "famille",
               "sous_famille", "arborescence", "classification", "gamme"],
};

export function proposerCorrespondance(entetes) {
  const proposition = {};
  const pris = new Set();

  for (const [champ, indices] of Object.entries(INDICES)) {
    for (let i = 0; i < entetes.length; i++) {
      if (pris.has(i)) continue;
      const normalise = entetes[i]
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        // La ponctuation des en-têtes réels — « Réf. fournisseur »,
        // « Prix (HT) » — doit disparaître avant comparaison.
        .replace(/[.()\[\]\/]+/g, " ")
        .replace(/[\s_-]+/g, "_")
        .replace(/^_|_$/g, "");
      // Correspondance exacte d'abord, puis par préfixe. Les exports
      // ajoutent souvent un suffixe — « Prix HT (EUR) », « Qté dispo au
      // 01/07 » — qu'une égalité stricte rejetterait.
      const correspond = indices.some((ind) => {
        const n = ind.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]+/g, "_");
        return normalise === n || normalise.startsWith(n + "_");
      });
      if (correspond) {
        proposition[champ] = i;
        pris.add(i);
        break;
      }
    }
  }
  return proposition;
}

/* ------------------------------------------------------------------ *
 * Conversion en produits                                              *
 * ------------------------------------------------------------------ */

export function nombreOuNul(valeur) {
  if (valeur === undefined || valeur === null || valeur === "") return null;
  // Les exports français écrivent « 1,24 » et parfois « 1 234,56 » avec
  // une espace insécable comme séparateur de milliers. Les deux doivent
  // devenir 1.24 et 1234.56.
  const propre = String(valeur)
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(",", ".");
  const n = Number(propre);
  return Number.isFinite(n) ? n : null;
}

export function convertir(texte, correspondance, options = {}) {
  const separateur = options.separateur || detecterSeparateur(texte);
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lignes.length < 2) {
    return { produits: [], erreurs: [{ ligne: 0, cause: "Fichier vide ou sans données." }] };
  }

  const produits = [];
  const erreurs = [];
  const vus = new Set();

  for (let i = 1; i < lignes.length; i++) {
    const champs = decouperLigne(lignes[i], separateur);
    const lire = (nom) => {
      const idx = correspondance[nom];
      return idx === undefined ? undefined : champs[idx];
    };

    const id = lire("id");
    // L'IDENTIFIANT EST LE SEUL CHAMP INDISPENSABLE. Sans lui, on ne peut
    // ni indexer, ni mettre à jour — et deux imports successifs
    // créeraient des doublons au lieu de se remplacer.
    if (!id) {
      erreurs.push({ ligne: i + 1, cause: "Identifiant manquant." });
      continue;
    }
    // DOUBLONS. Le même identifiant deux fois dans un fichier signale un
    // export mal fait. On garde la PREMIÈRE occurrence et on signale :
    // écraser silencieusement ferait perdre des données sans trace.
    if (vus.has(id)) {
      erreurs.push({ ligne: i + 1, cause: `Identifiant « ${id} » déjà présent plus haut.` });
      continue;
    }
    vus.add(id);

    const produit = { id: String(id) };
    for (const champ of ["ref", "name", "description", "platform_id"]) {
      const v = lire(champ);
      if (v) produit[champ] = String(v);
    }
    const prix = nombreOuNul(lire("price"));
    if (prix !== null) produit.price = prix;
    const stock = nombreOuNul(lire("stock"));
    if (stock !== null) produit.stock = stock;

    const cat = lire("categories");
    if (cat) {
      // Les exports séparent les catégories par « > », « / » ou « | »
      // selon l'outil. On accepte les trois.
      produit.categories = String(cat)
        .split(/[>|/]/)
        .map((c) => c.trim())
        .filter(Boolean);
    }
    produits.push(produit);
  }

  return { produits, erreurs, separateur };
}

/* ------------------------------------------------------------------ *
 * Découpage en lots                                                   *
 *                                                                      *
 * L'API refuse au-delà de 5 000 produits par appel. Découper ici       *
 * plutôt que de laisser le client découvrir la limite par une erreur.  *
 * ------------------------------------------------------------------ */
export function enLots(produits, taille = 5000, rulepack = null) {
  const lots = [];
  for (let i = 0; i < produits.length; i += taille) {
    const lot = { items: produits.slice(i, i + taille) };
    // Le pack n'est déclaré que sur le PREMIER lot : le répéter
    // déclencherait une réindexation complète à chaque envoi, soit
    // plusieurs secondes de service bloqué par lot.
    if (rulepack && i === 0) lot.rulepack = rulepack;
    lots.push(lot);
  }
  return lots;
}
