/* Import XML — détection de la structure répétée et correspondance de
 * champs. Pendant de csv-import.js pour les distributeurs dont l'export
 * ERP/PIM ou le flux (Google Shopping, ONIX, export PrestaShop/Magento)
 * sort en XML plutôt qu'en CSV.
 *
 * CE FICHIER NE TOUCHE PAS AU RÉSEAU, même règle que côté CSV : il
 * transforme du texte XML en lots prêts à envoyer, rien d'autre. Testable
 * entièrement sans navigateur ni serveur.
 *
 * CE QUI DIFFÈRE DU CSV, structurellement. Un CSV a des colonnes nommées
 * une fois pour tout le fichier : la correspondance se fait par index de
 * colonne. Un XML n'a pas de « colonnes » — il a un élément qui se répète
 * une fois par produit, avec des enfants ou des attributs à l'intérieur.
 * Trouver CET élément est le vrai problème que le CSV n'a pas : on ne
 * demande jamais à l'utilisateur de le nommer, on le déduit en cherchant
 * quel élément se répète le plus sous un même parent.
 *
 * CE QUI N'EST PAS COUVERT, volontairement. Un champ répété à l'intérieur
 * d'un produit (plusieurs <image> sous <images>) n'a pas d'équivalent
 * dans le format produit attendu par Heurix (un champ = une valeur) : sa
 * valeur extraite concatène le texte de tous les descendants, ce qui reste
 * visible dans l'aperçu plutôt que silencieusement faux. Un besoin réel
 * de ce type se traite au cas par cas, pas en complexifiant ce module pour
 * un scénario jamais encore rencontré.
 */
import { INDICES, nombreOuNul } from "./csv-import.js";

/* ------------------------------------------------------------------ *
 * Détection de l'élément qui se répète (l'équivalent d'une « ligne »)  *
 * ------------------------------------------------------------------ */
export function detecterRacineItems(texte) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(texte, "application/xml");

  // Un XML mal formé ne lève jamais d'exception ici : il produit un
  // document contenant un noeud <parsererror>, qu'il faut chercher
  // explicitement pour distinguer un fichier cassé d'un fichier vide.
  if (doc.getElementsByTagName("parsererror").length) {
    return { chemin: null, elements: [] };
  }

  // Regroupe chaque élément par (parent, nom local) — le nom local ignore
  // le préfixe d'espace de noms (« g:id » et « id » comptent pareil),
  // ce que la plupart des flux produit (Google Shopping en tête) utilisent
  // sans que l'utilisateur ait à le savoir.
  const parGroupe = new Map();
  const tous = doc.getElementsByTagName("*");
  for (let i = 0; i < tous.length; i++) {
    const el = tous[i];
    const parent = el.parentNode;
    if (!parent || parent.nodeType !== 1) continue;
    if (!parGroupe.has(parent)) parGroupe.set(parent, new Map());
    const parNom = parGroupe.get(parent);
    const nom = el.localName;
    if (!parNom.has(nom)) parNom.set(nom, []);
    parNom.get(nom).push(el);
  }

  // Le groupe le plus nombreux est, presque toujours, « un élément par
  // produit ». Pas de configuration à demander : c'est la structure la
  // plus fréquente dans un flux produit qui tranche.
  let meilleur = null;
  for (const [, parNom] of parGroupe) {
    for (const [nom, elements] of parNom) {
      if (elements.length < 2) continue;
      if (!meilleur || elements.length > meilleur.elements.length) {
        meilleur = { chemin: nom, elements };
      }
    }
  }
  return meilleur || { chemin: null, elements: [] };
}

/* ------------------------------------------------------------------ *
 * Champs disponibles dans un échantillon d'éléments                   *
 * ------------------------------------------------------------------ */
export function champsDisponibles(elements) {
  const noms = new Set();
  // Un échantillon suffit à découvrir la forme : inutile de parcourir
  // 50 000 produits pour savoir quels champs existent.
  const echantillon = elements.slice(0, 20);
  for (const el of echantillon) {
    for (let i = 0; i < el.attributes.length; i++) {
      // Préfixé « @ » pour distinguer un attribut de l'élément lui-même
      // (<product id="123">) d'un enfant du même nom (<product><id>123</id>).
      noms.add("@" + el.attributes[i].name);
    }
    for (const enfant of el.children) {
      noms.add(enfant.localName);
    }
  }
  return Array.from(noms);
}

/* ------------------------------------------------------------------ *
 * Correspondance automatique — réutilise EXACTEMENT le dictionnaire de *
 * mots-clés du CSV : « price », « prix », « g:price » normalisé donnent *
 * le même résultat, la logique de reconnaissance ne dépend pas du       *
 * format source.                                                       *
 * ------------------------------------------------------------------ */
export function proposerCorrespondanceXml(champs) {
  const proposition = {};
  const pris = new Set();

  for (const [champ, motscles] of Object.entries(INDICES)) {
    for (let i = 0; i < champs.length; i++) {
      if (pris.has(i)) continue;
      const brut = champs[i].startsWith("@") ? champs[i].slice(1) : champs[i];
      const normalise = brut
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s_-]+/g, "_")
        .replace(/^_|_$/g, "");
      const correspond = motscles.some((m) => {
        const n = m.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]+/g, "_");
        return normalise === n || normalise.startsWith(n + "_");
      });
      if (correspond) {
        proposition[champ] = champs[i];
        pris.add(i);
        break;
      }
    }
  }
  return proposition;
}

/* ------------------------------------------------------------------ *
 * Lecture d'un champ sur un élément produit                           *
 * ------------------------------------------------------------------ */
export function extraireValeur(element, champ) {
  if (!champ) return undefined;
  if (champ.startsWith("@")) {
    const val = element.getAttribute(champ.slice(1));
    return val === null ? undefined : val;
  }
  for (const enfant of element.children) {
    if (enfant.localName === champ) {
      const texte = enfant.textContent.trim();
      return texte || undefined;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Stock — les flux type Google Shopping donnent un texte              *
 * (« in stock » / « out of stock »), pas une quantité. nombreOuNul     *
 * échouerait dessus en silence ; on reconnaît les valeurs standard     *
 * avant de retomber sur l'analyse numérique classique.                 *
 * ------------------------------------------------------------------ */
function stockOuNul(valeur) {
  if (valeur === undefined || valeur === null || valeur === "") return null;
  const normalise = String(valeur).toLowerCase().trim();
  if (["in stock", "in_stock", "instock", "available", "en stock"].includes(normalise)) return 1;
  if (["out of stock", "out_of_stock", "outofstock", "unavailable", "rupture", "en rupture"].includes(normalise)) return 0;
  return nombreOuNul(valeur);
}

/* ------------------------------------------------------------------ *
 * Conversion en produits — même forme de sortie que convertir() côté  *
 * CSV (produits, erreurs avec les mêmes libellés de cause), pour que   *
 * verdict, recommandation de pack, envoi et rapport n'aient RIEN à     *
 * savoir du format d'origine.                                         *
 * ------------------------------------------------------------------ */
export function convertirXml(texte, correspondance, limite) {
  const { chemin, elements } = detecterRacineItems(texte);
  if (!chemin || !elements.length) {
    return { produits: [], erreurs: [{ ligne: 0, cause: "Fichier vide ou sans données." }], chemin: null, total: 0 };
  }
  // Un CSV se tronque au niveau du texte brut avant analyse (60 lignes,
  // toujours valide). Un XML tronqué de la même façon casserait le
  // document — le parsing se fait donc sur le fichier entier, une seule
  // fois, et seule la BOUCLE DE CONVERSION est bornée par `limite`. `total`
  // reste le vrai compte, indépendant de l'échantillon traité.
  const total = elements.length;
  const aTraiter = limite ? elements.slice(0, limite) : elements;

  const produits = [];
  const erreurs = [];
  const vus = new Set();

  aTraiter.forEach((el, i) => {
    const lire = (nom) => {
      const champ = correspondance[nom];
      return champ === undefined ? undefined : extraireValeur(el, champ);
    };

    const id = lire("id");
    if (!id) {
      erreurs.push({ ligne: i + 1, cause: "Identifiant manquant." });
      return;
    }
    if (vus.has(id)) {
      erreurs.push({ ligne: i + 1, cause: `Identifiant « ${id} » déjà présent plus haut.` });
      return;
    }
    vus.add(id);

    const produit = { id: String(id) };
    for (const champ of ["ref", "name", "description", "platform_id"]) {
      const v = lire(champ);
      if (v) produit[champ] = String(v);
    }
    const prix = nombreOuNul(lire("price"));
    if (prix !== null) produit.price = prix;
    const stock = stockOuNul(lire("stock"));
    if (stock !== null) produit.stock = stock;

    const cat = lire("categories");
    if (cat) {
      produit.categories = String(cat).split(/[>|/]/).map((c) => c.trim()).filter(Boolean);
    }
    produits.push(produit);
  });

  return { produits, erreurs, chemin, total: elements.length };
}

/* ------------------------------------------------------------------ *
 * Encodage — un XML se déclare lui-même (<?xml ... encoding="...">),   *
 * contrairement à un CSV qu'il faut deviner par la forme des octets.   *
 * ------------------------------------------------------------------ */
export function detecterEncodageXml(texteProlog) {
  const m = /encoding=["']([^"']+)["']/i.exec(texteProlog.slice(0, 200));
  return m ? m[1] : "utf-8";
}
