/*!
 * heurix-search.js — bibliotheque JS autonome pour une barre de recherche
 * Heurix prete a l'emploi, connectee a la vraie API (pas simulee).
 *
 * Chantier Phase 5 de la roadmap (24 juillet). Volontairement minimal en
 * style visuel -- une refonte design dediee est prevue separement une
 * fois cette brique fonctionnelle livree. Les classes CSS sont nommees
 * clairement (prefixe hx-) pour que cette refonte puisse cibler chaque
 * element sans deviner.
 *
 * Zero dependance. Utilisable par simple <script src> ou import ES module.
 *
 * Usage minimal :
 *   <div id="ma-recherche"></div>
 *   <script src="heurix-search.js"></script>
 *   <script>
 *     Heurix.searchBox({
 *       apiKey: "hxp_votre_cle_publique",   // cle PUBLIQUE, jamais hx_
 *       catalog: "moncatalogue",
 *       containerId: "ma-recherche"
 *     });
 *   </script>
 *
 * Langue de l'interface : "fr" ou "en". Par defaut, l'attribut lang de la
 * page ; a defaut d'attribut, le francais. L'option `lang` l'emporte sur
 * les deux, pour une page dont l'attribut ne reflete pas la langue reelle
 * de la boutique.
 *
 *     Heurix.searchBox({ ..., lang: "en" });
 *
 * Documentation complete : https://heurix.fr/docs.html#ep-search-widget
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Heurix = root.Heurix || {};
    root.Heurix.searchBox = factory().searchBox;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEFAULT_BASE_URL = "https://api.heurix.fr";
  var DEFAULT_DEBOUNCE_MS = 200;
  var DEFAULT_MIN_CHARS = 2;
  var DEFAULT_LIMIT = 8;
  var STYLE_INJECTED = false;


  // LANGUE (26 aout 2026) -- ce fichier etait integralement en francais,
  // y compris servi depuis une page anglaise : « 8 résultats trouvés »
  // sur une boutique en anglais.
  //
  // Ordre de resolution : parametre explicite > attribut lang du
  // document > FRANCAIS. Le repli francais n'est pas un choix de gout,
  // c'est la contrainte de compatibilite : cette bibliotheque est
  // hebergee chez les marchands qui l'ont deja telechargee, et une page
  // sans attribut lang doit afficher exactement ce qu'elle affichait
  // avant. Seule une page qui DECLARE lang="en" change de comportement.
  function resoudreLangue(explicite) {
    var v = explicite ||
      (typeof document !== "undefined" && document.documentElement &&
       document.documentElement.lang) || "";
    return String(v).toLowerCase().slice(0, 2) === "en" ? "en" : "fr";
  }

  // Le pluriel n'a pas la meme borne dans les deux langues : le francais
  // ecrit « 0 résultat » au singulier, l'anglais « 0 results » au pluriel.
  //
  // MESURE (26 aout) -- les deux bornes ne different QU'A ZERO, et aucun
  // des cinq sites d'appel ci-dessous ne peut recevoir zero : le garde-fou
  // `if (!currentHits.length)` retourne avant l'annonce, le total est
  // garde par `data.total > hits.length`, et une famille sans produit
  // n'est jamais renvoyee. La distinction est donc exacte et inatteignable
  // en l'etat -- verifiee par un test unitaire direct sur cette fonction,
  // pas par le rendu, qui ne saurait pas la solliciter.
  //
  // Elle est conservee plutot que repliee sur `n > 1` parce que la table
  // de textes grandit : la premiere chaine a pluriel qu'un zero pourra
  // atteindre (une annonce aria de l'etat vide, par exemple) doit trouver
  // la borne juste deja en place, et non un anglais faux a corriger.
  function estPluriel(n, lang) {
    return lang === "en" ? n !== 1 : n > 1;
  }

  // Deux clefs completes par cas de pluriel, comme console.js. Pas de
  // fonction de pluriel generique : deux langues a pluriel binaire n'en
  // ont pas besoin, et une clef entiere se relit sans la reconstruire.
  var TEXTES = {
    fr: {
      placeholder: "Rechercher…",
      ariaChamp: "Rechercher un produit",
      chargement: "Recherche…",
      indispo: "Recherche indisponible pour le moment.",
      pack: "Pack recommandé",
      rupture: "Rupture",
      picks: "Nos incontournables",
      aucunResultat: "Aucun résultat",
      aucunProduit: "Aucun produit ",
      sansContrainte: "Chercher sans la contrainte de prix",
      entre: "entre ",
      et: " et ",
      moinsDe: "à moins de ",
      plusDe: "à plus de ",
      pourOuvre: " pour « ",
      pourFerme: " »",
      famille: " résultat — choisissez une famille",
      familles: " résultats — choisissez une famille",
      familleAria: " résultat, choisissez une famille",
      famillesAria: " résultats, choisissez une famille",
      produit: " produit",
      produits: " produits",
      totalUn: " résultat au total",
      totalPlusieurs: " résultats au total",
      voirLes: "Voir les ",
      trouveUn: " résultat trouvé",
      trouvePlusieurs: " résultats trouvés",
    },
    en: {
      placeholder: "Search…",
      ariaChamp: "Search for a product",
      chargement: "Searching…",
      indispo: "Search is unavailable right now.",
      pack: "Recommended bundle",
      rupture: "Out of stock",
      picks: "Our picks",
      aucunResultat: "No results",
      aucunProduit: "No product ",
      sansContrainte: "Search without the price constraint",
      entre: "between ",
      et: " and ",
      moinsDe: "under ",
      plusDe: "over ",
      pourOuvre: ' for "',
      pourFerme: '"',
      famille: " result — choose a family",
      familles: " results — choose a family",
      familleAria: " result, choose a family",
      famillesAria: " results, choose a family",
      produit: " product",
      produits: " products",
      totalUn: " result in total",
      totalPlusieurs: " results in total",
      voirLes: "See all ",
      trouveUn: " result found",
      trouvePlusieurs: " results found",
    },
  };


  // Chantier securite C1 : garde-fou a l'execution. Une cle serveur (hx_)
  // dans le navigateur est lisible par n'importe quel visiteur, et ouvre
  // l'indexation, le merchandising et le portail de facturation Stripe.
  // Seule une cle publique (hxp_) a une portee limitee a la lecture.
  function heurixWarnIfServerKey(k) {
    if (typeof k === "string" && k.indexOf("hxp_") !== 0 && k.indexOf("hx_") === 0) {
      var msg = "[Heurix] ATTENTION : vous utilisez une cle SERVEUR (hx_) cote navigateur. " +
        "Elle est lisible par tous vos visiteurs et donne acces a votre facturation. " +
        "Generez une cle publique (hxp_) depuis votre console Heurix : Mes infos > Cles API.";
      if (typeof console !== "undefined" && console.warn) console.warn(msg);
    }
  }

  // La LOCALE est traitee ici (« 12,34 € » contre « €12.34 »). La DEVISE
  // reste l'euro en dur, comme avant : l'API ne renvoie aucun code de
  // devise avec le prix, donc rien ne permettrait de la deduire. C'est la
  // moitie de la tension que le commentaire de defaultRenderItem (BUG-001,
  // 8 aout) avait nommee puis remise a plus tard -- l'autre moitie tient
  // toujours.
  function fmtPrix(v, lang) {
    var n = Number(v).toFixed(2);
    return lang === "en"
      ? "€" + n.replace(/\.00$/, "")
      : n.replace(".", ",").replace(/,00$/, "") + " €";
  }

  // CE QU'ELLE N'ECHAPPE PAS : L'APOSTROPHE. Elle traite & < > et le
  // guillemet DOUBLE, volontairement pas le simple -- et cette absence
  // decide de la facon dont on l'emploie, pas seulement de ce qu'elle
  // rend.
  //
  // Corollaire, a lire avant de la reutiliser : TOUT ATTRIBUT PORTANT
  // UNE DONNEE SE DOUBLE-QUOTE. Dans un attribut simple-quote, une
  // apostrophe dans la valeur ferme l'attribut et laisse la place a un
  // onmouseover= ; esc() la laisse passer et ne verra rien. C'est
  // pourquoi ce fichier ecrit data-index="..." et data-idx="...", jamais
  // en simple quote.
  //
  // Ce n'est pas theorique. heurix-browse-widget.js ecrivait
  // data-id='...' et n'echappait rien du tout ; le 27 aout 2026, y poser
  // esc() sans toucher au quotage n'aurait ferme que la moitie du trou.
  // Verifie en le faisant echouer : esc() integralement conserve, le seul
  // attribut remis en simple quote, et la charge ressort.
  //
  // L'alternative -- ajouter &#39; ici -- a ete ecartee : elle ferait
  // diverger les deux copies de esc() (voir
  // tests/heurix-browse-echappement.test.js, qui les compare octet pour
  // octet) et laisserait croire qu'un attribut simple-quote est sur.
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function injectStyles(accentColor) {
    if (STYLE_INJECTED) return;
    STYLE_INJECTED = true;
    var css = [
      ".hx-search{position:relative;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;--hx-accent:" + (accentColor || "#2952E3") + ";}",
      // Familles. Volontairement proches des lignes de resultats : le
      // visiteur ne doit pas avoir l'impression d'un ecran different, juste
      // d'une liste plus courte.
      ".hx-groups-head{padding:9px 14px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;}",
      ".hx-group{display:block;padding:10px 14px;border-bottom:1px solid #f3f4f6;cursor:pointer;text-decoration:none;color:inherit;}",
      ".hx-group:last-child{border-bottom:none;}",
      ".hx-group:hover,.hx-group:focus{background:#f9fafb;outline:none;}",
      ".hx-group-name{display:block;font-size:14px;font-weight:600;text-transform:capitalize;}",
      ".hx-group-count{display:inline-block;font-size:12px;font-weight:700;color:var(--hx-accent);margin-top:2px;}",
      ".hx-group-ex{display:block;font-size:11.5px;color:#9ca3af;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      ".hx-search-input{width:100%;box-sizing:border-box;padding:10px 14px;font-size:15px;border:1px solid #D6D9E4;border-radius:8px;outline:none;}",
      ".hx-search-input:focus{border-color:var(--hx-accent);box-shadow:0 0 0 3px color-mix(in srgb, var(--hx-accent) 18%, transparent);}",
      ".hx-search-panel{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:60;background:#fff;border:1px solid #E2E4ED;border-radius:10px;box-shadow:0 12px 28px rgba(20,22,45,0.14);max-height:420px;overflow-y:auto;}",
      ".hx-search-panel[hidden]{display:none;}",
      ".hx-search-facets{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-bottom:1px solid #EEF0F6;}",
      ".hx-search-facet-chip{font-size:12.5px;padding:4px 10px;border-radius:999px;border:1px solid #D6D9E4;background:#fff;cursor:pointer;color:#3A3D52;}",
      ".hx-search-facet-chip.hx-active{background:var(--hx-accent);border-color:var(--hx-accent);color:#fff;}",
      ".hx-search-hit{display:flex;justify-content:space-between;gap:10px;align-items:baseline;padding:11px 14px;cursor:pointer;text-decoration:none;color:inherit;border-bottom:1px solid #F3F4F8;position:relative;transition:box-shadow .12s ease, background .12s ease;}",
      ".hx-search-hit:last-child{border-bottom:none;}",
      // Survol renforce (2 aout, portage demo->produit) -- legere ombre en
      // plus du fond, plus de matiere qu'un simple changement de couleur.
      // Pas de translateY/scale ici : dans une LISTE compacte (pas des
      // cartes espacees), un deplacement vertical ferait vibrer les lignes
      // voisines de facon genante.
      ".hx-search-hit:hover,.hx-search-hit.hx-hit-active{background:#F6F7FC;box-shadow:inset 2px 0 0 var(--hx-accent);}",
      ".hx-search-hit-texte{min-width:0;}",
      ".hx-search-hit-name{font-size:14px;font-weight:600;color:#181A2E;}",
      ".hx-search-hit-ref{font-size:12px;color:#7B7E93;margin-top:2px;}",
      ".hx-search-hit-meta{font-size:13px;color:#7B7E93;white-space:nowrap;flex-shrink:0;}",
      // Prix mis en avant (2 aout) -- var(--hx-accent) suit automatiquement
      // la couleur de marque du client (voir injectStyles), pas de couleur
      // fixe a re-choisir par catalogue.
      ".hx-search-hit-price{font-size:14.5px;font-weight:800;color:var(--hx-accent);}",
      ".hx-search-hit-price-remise{display:inline-flex;align-items:baseline;gap:6px;flex-wrap:wrap;}",
      ".hx-search-hit-price-barre{font-size:11.5px;font-weight:600;color:#888;text-decoration:line-through;}",
      ".hx-search-hit-price-pct{font-size:10.5px;font-weight:700;color:#fff;background:#C0392B;border-radius:100px;padding:1px 6px;}",
      ".hx-search-hit-oos{color:#C0392B;}",
      // Etiquette pack recommande (2 aout) -- s'appuie sur le champ
      // `highlighted_bundle` de l'API, disponible pour n'importe quel
      // catalogue (verifie cote moteur, pas specifique a la demo).
      ".hx-search-hit-badge{position:absolute;top:6px;right:14px;font-size:9.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#fff;background:linear-gradient(135deg, var(--hx-accent), color-mix(in srgb, var(--hx-accent) 60%, #8B5CF6));border-radius:100px;padding:2px 8px;}",
      ".hx-search-state{padding:16px 14px;font-size:13.5px;color:#7B7E93;text-align:center;}",
      ".hx-search-clearfilter{font:inherit;font-size:13px;font-weight:600;cursor:pointer;background:var(--hx-accent);color:#fff;border:none;padding:8px 16px;border-radius:100px;}",
      ".hx-search-fallback-label{padding:8px 14px 2px;font-size:11.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#9B9EAF;}",
      // Pied "voir tous les resultats" (2 aout) -- informatif par defaut
      // (juste le compte), devient un lien cliquable seulement si le
      // marchand fournit `seeAllHref`. Comportement par defaut non cassant :
      // sans configuration, un marchand gagne quand meme la visibilite du
      // total, meme sans lien de destination a fournir tout de suite.
      ".hx-search-seeall{display:block;padding:9px 14px;font-size:12.5px;font-weight:600;color:#7B7E93;text-align:center;border-top:1px solid #EEF0F6;text-decoration:none;}",
      "a.hx-search-seeall{color:var(--hx-accent);cursor:pointer;}",
      "a.hx-search-seeall:hover{background:#F6F7FC;}",
    ].join("\n");
    var styleEl = document.createElement("style");
    styleEl.setAttribute("data-heurix-search", "1");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }


  // Portees depuis l'implementation orpheline a la racine (chantier I3,
  // audit technique) : les facettes renvoyees par le moteur sont des
  // annotations brutes ("DIAM_M8" dans le groupe "DIAM"). Les afficher
  // telles quelles est illisible pour un acheteur -- on montre "M8".
  function humanizeGroup(code) {
    return code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
  }
  function humanizeValue(annotation, group) {
    var rest = annotation.slice(group.length + 1); // retire "GROUPE_" du debut
    if (!rest) return annotation;
    return rest.split("_").map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(" ");
  }

  function defaultRenderItem(hit, i, lang) {
    // `lang` est le 3e argument depuis le 26 aout. Un renderItem fourni
    // par le marchand l'ignore sans rien casser (JS jette les arguments
    // en trop), et defaultRenderItem retombe sur le francais s'il est
    // appele sans -- meme repli que resoudreLangue().
    var TXT = TEXTES[lang === "en" ? "en" : "fr"];
    var p = hit.product;
    var stockKnown = typeof hit.in_stock === "boolean";
    var metaBits = [];
    // PRIX MIS EN AVANT (2 août, portage démo->produit) -- element dedie
    // plutot qu'un bout de texte noye parmi les autres metadonnees.
    // var(--hx-accent) est deja themable (injectStyles), donc la mise en
    // avant suit automatiquement la couleur de marque du client, sans
    // configuration supplementaire de sa part.
    //
    // PRIX BARRE (3 aout, roadmap compare_at_price) -- meme logique que
    // le widget de demo (voir demo-search-live.js).
    //
    // MISE A JOUR BUG-001 (audit QA/UX/A11Y, 8 aout) -- utilise maintenant
    // fmtPrix() (virgule, deux decimales), pas esc(p.price) tel quel comme
    // avant. Le commentaire d'origine ici justifiait explicitement esc()
    // brut par le fait que cette bibliotheque part chez n'importe quel
    // client, pas seulement des catalogues FR -- une vraie tension encore
    // valable si Heurix sert un jour des clients non-francophones : le
    // symbole "€" est deja fixe en dur dans tout ce fichier (aucune vraie
    // internationalisation de la devise), donc ce correctif reste centre
    // sur le format numerique (virgule vs point) pour la base de clients
    // actuelle, pas une resolution definitive de la question devise/locale
    // pour une hypothetique base internationale future.
    var prixHtml;
    if (p.price != null && p.compare_at_price != null && Number(p.compare_at_price) > Number(p.price)) {
      var pourcentage = Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100);
      prixHtml = '<span class="hx-search-hit-price-remise">' +
        '<span class="hx-search-hit-price-barre">' + fmtPrix(p.compare_at_price, lang) + "</span>" +
        '<span class="hx-search-hit-price">' + fmtPrix(p.price, lang) + "</span>" +
        '<span class="hx-search-hit-price-pct">−' + pourcentage + "%</span>" +
      "</span>";
    } else {
      prixHtml = p.price != null
        ? '<span class="hx-search-hit-price">' + fmtPrix(p.price, lang) + "</span>"
        : "";
    }
    if (stockKnown && !hit.in_stock) metaBits.push('<span class="hx-search-hit-oos">' + esc(TXT.rupture) + "</span>");
    // ÉTIQUETTE PACK (2 août) -- affichée uniquement quand CE hit précis
    // est le highlighted_bundle renvoyé par l'API pour la requête en
    // cours. Voir searchBox() : c'est là que le rapprochement est fait,
    // pas ici -- defaultRenderItem reste une fonction pure sur un seul
    // hit, sans connaître le contexte de la recherche globale.
    var etiquetteHtml = hit._heurixBundle
      ? '<span class="hx-search-hit-badge">' + esc(TXT.pack) + "</span>"
      : "";
    // LE CONTENEUR DE GAUCHE, ENFIN OUVERT (27 aout 2026). Le fragment
    // fermait un <div> qu'il n'ouvrait pas, depuis 4cf41043 (24 juillet,
    // premier commit du widget). Cette balise fermante orpheline fermait
    // la LIGNE PRODUIT elle-meme : .hx-search-hit-meta -- le prix -- se
    // retrouvait FRERE de .hx-search-hit au lieu d'en etre l'enfant.
    //
    // Trois effets, du plus grave au moins grave :
    //  - l'element role="option" ne contient pas le prix, donc un lecteur
    //    d'ecran annonce l'option sans jamais dire combien elle coute ;
    //  - cliquer le prix ne selectionne rien : il est hors du <a>/<div>
    //    porteur de data-index ;
    //  - dans une liste, le prix se lit sur la ligne d'a cote.
    //
    // Qui etait touche, mesure : la CONFIGURATION PAR DEFAUT. Sans
    // resultHref la ligne est un <div>, et la fermeture orpheline l'a
    // ferme -- le prix sortait. Avec resultHref la ligne est un <a>, et
    // l'algorithme de parsing de fragment (innerHTML) ignore la fermeture
    // surnumeraire : le prix restait dedans, par accident. C'est donc le
    // marchand qui suit l'exemple minimal de l'en-tete de ce fichier
    // -- apiKey, catalog, containerId -- qui avait le defaut.
    //
    // Le CSS disait deja la structure attendue : .hx-search-hit est un
    // flex justify-content:space-between a DEUX enfants, le bloc texte a
    // gauche et .hx-search-hit-meta a droite (flex-shrink:0). Le correctif
    // ouvre le conteneur de gauche ; il ne retire pas la fermeture.
    return (
      etiquetteHtml +
      '<div class="hx-search-hit-texte">' +
        '<div class="hx-search-hit-name">' + esc(p.name || p.id) + "</div>" +
        (p.ref ? '<div class="hx-search-hit-ref">' + esc(p.ref) + "</div>" : "") +
      '</div><div class="hx-search-hit-meta">' + prixHtml +
      (metaBits.length ? (prixHtml ? " · " : "") + metaBits.join(" · ") : "") + "</div>"
    );
  }

  function searchBox(config) {
    if (!config || !config.apiKey) throw new Error("Heurix.searchBox: 'apiKey' est requis.");
    heurixWarnIfServerKey(config.apiKey);
    if (!config.catalog) throw new Error("Heurix.searchBox: 'catalog' est requis.");
    if (!config.containerId) throw new Error("Heurix.searchBox: 'containerId' est requis.");
    var container = document.getElementById(config.containerId);
    if (!container) throw new Error("Heurix.searchBox: aucun element avec id='" + config.containerId + "'.");

    var lang = resoudreLangue(config.lang);
    var TX = TEXTES[lang];

    var baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    var minChars = config.minChars != null ? config.minChars : DEFAULT_MIN_CHARS;
    var debounceMs = config.debounceMs != null ? config.debounceMs : DEFAULT_DEBOUNCE_MS;
    var limit = config.limit || DEFAULT_LIMIT;
    var facetFields = config.facets || [];
    var renderItem = config.renderItem || defaultRenderItem;
    var onSelect = config.onSelect || null;
    var resultHref = config.resultHref || null; // function(hit) -> url, pour un <a> plutot qu'un <div>
    // "VOIR TOUS LES RESULTATS" (2 aout, portage démo->produit) -- ce
    // panneau est volontairement compact (limit par defaut 8), jamais
    // pense pour tout afficher. `seeAllHref` laisse le marchand pointer
    // vers sa propre page de resultats complets, meme logique que
    // `resultHref`/`groupHref` : Heurix ne devine jamais une URL de site.
    // Sans configuration, le compte total reste affiche quand meme --
    // valeur immediate sans configuration supplementaire a fournir.
    var seeAllHref = config.seeAllHref || null; // function(query, total) -> url

    // REGROUPEMENT PAR FAMILLE. Configure par le MARCHAND, pas par le
    // visiteur : une case « regrouper » dans une barre de recherche demande
    // un effort de comprehension qu'un acheteur presse n'a pas.
    //
    // Mesure a l'origine : sur un catalogue de 10 000 produits, « vis M8
    // inox » renvoie 6 582 resultats dont les huit premiers ne different que
    // par la longueur. Le visiteur doit ouvrir la page de resultats pour
    // comprendre. Regroupe, il choisit sa famille en un coup d'oeil.
    //
    // SEUIL PLUTOT QUE TOUT-OU-RIEN. Un visiteur qui tape « 0986494574 »
    // veut sa plaquette, pas une famille. On ne regroupe qu'au-dela d'un
    // nombre de resultats ou l'affichage plat devient inexploitable.
    var groupThreshold = config.groupThreshold != null ? config.groupThreshold : 0;
    var groupBy = config.groupBy || "auto";
    var onSelectGroup = config.onSelectGroup || null;
    var groupHref = config.groupHref || null;

    injectStyles(config.accentColor);

    // Chantier A11Y-001 (audit QA/UX/A11Y, 8 août 2026) -- ids derives de
    // containerId (deja unique, garanti par le marchand) plutot que des
    // valeurs fixes : plusieurs instances du widget peuvent coexister sur
    // une meme page, aria-controls/aria-activedescendant ont besoin d'ids
    // qui ne collisionnent jamais entre elles.
    var idBase = String(config.containerId);
    container.classList.add("hx-search");
    container.innerHTML =
      '<input type="text" id="' + esc(idBase) + '-input" class="hx-search-input" placeholder="' + esc(config.placeholder || TX.placeholder) + '" autocomplete="off" aria-label="' + esc(TX.ariaChamp) + '"' +
      ' role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + esc(idBase) + '-panel">' +
      '<div class="hx-search-panel" id="' + esc(idBase) + '-panel" role="listbox" hidden></div>' +
      '<div class="hx-search-live" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;"></div>';

    var input = container.querySelector(".hx-search-input");
    var panel = container.querySelector(".hx-search-panel");
    var liveRegion = container.querySelector(".hx-search-live");
    var debounceTimer = null;
    var activeFilters = [];
    var lastRequestId = 0;
    var activeIndex = -1;
    var currentHits = [];

    function closePanel() {
      panel.hidden = true;
      activeIndex = -1;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }

    function openPanel() {
      panel.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function annoncer(texte) {
      liveRegion.textContent = texte;
    }

    function setState(html) {
      panel.innerHTML = '<div class="hx-search-state">' + html + "</div>";
      openPanel();
      annoncer(html);
    }

    function runSearch(query) {
      var requestId = ++lastRequestId;
      var body = { q: query, limit: limit, filters: activeFilters };
      // Chantier "score d'intention" (7 aout 2026). Lu depuis
      // heurix-tracker.js SI il est charge sur la meme page -- jamais une
      // dependance obligatoire, ce widget continue de fonctionner
      // exactement comme avant si le tracker est absent (window.Heurix
      // alors undefined, visitorId reste undefined, non transmis).
      var visitorId = (window.Heurix && window.Heurix.visitorId) || window.heurixVisitorId || undefined;
      if (visitorId) body.visitor_id = visitorId;
      // Le regroupement se decide sur le TOTAL, qu'on ne connait qu'apres
      // la reponse. On demande donc le mode plat, et on relance en groupe
      // si le seuil est franchi. Le second appel est servi par le cache du
      // moteur — mesure a 89 % de gain sur requete repetee.
      var seuilActif = groupThreshold > 0;
      if (facetFields.length) body.facets = facetFields;

      fetch(baseUrl + "/v1/index/" + encodeURIComponent(config.catalog) + "/search", {
        method: "POST",
        headers: { Authorization: "Bearer " + config.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          if (requestId !== lastRequestId) return; // une requete plus recente est deja partie, on ignore celle-ci

          // SEUIL FRANCHI : on relance en mode groupe. Le second appel est
          // servi par le cache du moteur (89 % de gain mesure sur requete
          // repetee), donc le surcout est marginal — et il n'a lieu que sur
          // les requetes larges, jamais sur une reference precise.
          if (seuilActif && (data.total || 0) >= groupThreshold) {
            var corpsGroupe = { q: query, limit: limit, filters: activeFilters,
                                group_by: groupBy };
            if (visitorId) corpsGroupe.visitor_id = visitorId;
            return fetch(baseUrl + "/v1/index/" + encodeURIComponent(config.catalog) + "/search", {
              method: "POST",
              headers: { Authorization: "Bearer " + config.apiKey, "Content-Type": "application/json" },
              body: JSON.stringify(corpsGroupe),
            })
              .then(function (r) { return r.ok ? r.json() : null; })
              .then(function (groupe) {
                if (requestId !== lastRequestId) return;
                // Si le regroupement echoue, on retombe sur l'affichage
                // plat : mieux vaut une liste longue qu'un ecran vide.
                if (groupe && groupe.groupes) renderGroups(groupe, query);
                else renderResults(data);
              });
          }
          renderResults(data);
        })
        .catch(function () {
          if (requestId !== lastRequestId) return;
          setState(TX.indispo);
        });
    }

    /* Affichage par familles.
     *
     * Une famille n'est pas un produit : on ne peut pas la mettre au panier,
     * seulement l'explorer. Le clic doit donc AFFINER la recherche, pas
     * ouvrir une fiche — c'est la difference de comportement que le
     * marchand doit pouvoir intercepter via `onSelectGroup`.
     */
    function renderGroups(data, query) {
      currentHits = [];        // pas de produits selectionnables ici
      activeIndex = -1;

      var html = '<div class="hx-groups-head">' +
        esc(String(data.total)) +
        (estPluriel(data.total, lang) ? TX.familles : TX.famille) +
        "</div>";

      html += (data.groupes || []).map(function (g, i) {
        var interieur =
          '<span class="hx-group-name">' + esc(g.famille) + "</span>" +
          '<span class="hx-group-count">' + g.produits +
            (estPluriel(g.produits, lang) ? TX.produits : TX.produit) + "</span>" +
          '<span class="hx-group-ex">' +
            esc((g.representant && (g.representant.name || g.representant.id)) || "") +
          "</span>";
        var lien = groupHref ? groupHref(g) : null;
        return lien
          ? '<a class="hx-group" href="' + esc(lien) + '" data-idx="' + i + '">' + interieur + "</a>"
          : '<div class="hx-group" role="button" tabindex="0" data-idx="' + i + '">' + interieur + "</div>";
      }).join("");

      panel.innerHTML = html;
      openPanel();
      annoncer(String(data.total) +
        (estPluriel(data.total, lang) ? TX.famillesAria : TX.familleAria));

      panel.querySelectorAll(".hx-group").forEach(function (el) {
        el.addEventListener("click", function (e) {
          var g = (data.groupes || [])[parseInt(el.getAttribute("data-idx"), 10)];
          if (!g) return;
          if (onSelectGroup) {
            e.preventDefault();
            onSelectGroup(g, query);
            return;
          }
          if (!groupHref) {
            // COMPORTEMENT PAR DÉFAUT : on affine la recherche avec le nom
            // de la famille. Le visiteur reste dans le même geste, sans
            // quitter la page — et il obtient une liste exploitable.
            e.preventDefault();
            input.value = (query + " " + g.famille).trim();
            runSearch(input.value);
          }
        });
      });
    }

    function renderResults(data) {
      currentHits = data.hits || [];
      activeIndex = -1;

      // MISE EN AVANT MARCHANDE (2 août, portage démo->produit) --
      // `highlighted_bundle` est calculé indépendamment de `hits` côté
      // moteur : le meilleur pack peut ne pas figurer dans les tout
      // premiers résultats. S'il est déjà dans `currentHits`, on le
      // marque en place (pas de doublon). Sinon, on l'ajoute en tête --
      // même logique de dédoublonnage que la démo widget du même jour.
      if (data.highlighted_bundle && data.highlighted_bundle.product) {
        var idBundle = data.highlighted_bundle.product.id;
        var dejaPresent = currentHits.some(function (h) {
          if (h.product && h.product.id === idBundle) { h._heurixBundle = true; return true; }
          return false;
        });
        if (!dejaPresent) {
          var hitBundle = {
            product: data.highlighted_bundle.product,
            in_stock: data.highlighted_bundle.in_stock,
            _heurixBundle: true,
          };
          currentHits = [hitBundle].concat(currentHits);
        }
      }

      if (!currentHits.length) {
        // Chantier 6.6bis : un zero-resultat cause par une contrainte de prix
        // merite une explication et une porte de sortie. Sans cela, un
        // acheteur qui tape « moins de 5 € » sur un catalogue dont les
        // produits n'ont pas de prix renseigne obtient un ecran vide, sans
        // comprendre pourquoi -- techniquement correct, mais decourageant.
        //
        // `data.query` contient deja la requete NETTOYEE de la contrainte
        // (le moteur la retire avant de tokeniser), donc relancer sans le
        // filtre est immediat : il suffit de reecrire le champ avec elle.
        if (data.price_filter) {
          var pf = data.price_filter;
          var borne = pf.max !== null && pf.min !== null
            ? TX.entre + fmtPrix(pf.min, lang) + TX.et + fmtPrix(pf.max, lang)
            : pf.max !== null ? TX.moinsDe + fmtPrix(pf.max, lang)
            : TX.plusDe + fmtPrix(pf.min, lang);
          panel.innerHTML =
            '<div class="hx-search-state">' +
            "<p style=\"margin:0 0 10px;\">" + TX.aucunProduit + esc(borne) +
            (data.query ? TX.pourOuvre + esc(data.query) + TX.pourFerme : "") + ".</p>" +
            '<button type="button" class="hx-search-clearfilter">' +
            esc(TX.sansContrainte) + "</button></div>";
          openPanel();
          var relance = panel.querySelector(".hx-search-clearfilter");
          if (relance) relance.addEventListener("click", function () {
            input.value = data.query || "";
            input.focus();
            runSearch(input.value.trim());
          });
          return;
        }
        setState(TX.aucunResultat +
          (data.query ? TX.pourOuvre + esc(data.query) + TX.pourFerme : "") + ".");
        return;
      }

      var html = "";

      if (facetFields.length && data.facets) {
        html += facetsHtml(data.facets);
      }

      if (data.fallback) {
        html += '<div class="hx-search-fallback-label">' + esc(TX.picks) + "</div>";
      }

      html += currentHits.map(function (hit, i) {
        var inner = renderItem(hit, i, lang);
        var href = resultHref ? resultHref(hit) : null;
        var tag = href ? "a" : "div";
        var hrefAttr = href ? ' href="' + esc(href) + '"' : "";
        return "<" + tag + ' class="hx-search-hit" role="option" id="' + esc(idBase) + '-option-' + i + '" data-index="' + i + '"' + hrefAttr + ">" + inner + "</" + tag + ">";
      }).join("");

      // "VOIR TOUS LES RESULTATS" -- affiché seulement s'il existe
      // réellement plus de résultats que ce qui tient dans le panneau
      // (le +1 éventuel du bundle ajouté ci-dessus n'entre pas dans ce
      // compte, `data.total` reste la vérité côté moteur). Lien cliquable
      // si `seeAllHref` est configuré, sinon simple compte informatif --
      // jamais rien de cassé pour un marchand qui n'a pas encore configuré
      // cette option.
      if ((data.total || 0) > (data.hits || []).length) {
        var texteTotal = esc(String(data.total)) +
          (estPluriel(data.total, lang) ? TX.totalPlusieurs : TX.totalUn);
        var lienTotal = seeAllHref ? seeAllHref(data.query || "", data.total) : null;
        html += lienTotal
          ? '<a class="hx-search-seeall" href="' + esc(lienTotal) + '">' + esc(TX.voirLes) + texteTotal + " →</a>"
          : '<div class="hx-search-seeall">' + texteTotal + "</div>";
      }

      panel.innerHTML = html;
      openPanel();
      annoncer(currentHits.length +
        (estPluriel(currentHits.length, lang) ? TX.trouvePlusieurs : TX.trouveUn));

      panel.querySelectorAll(".hx-search-hit").forEach(function (el) {
        el.addEventListener("click", function (e) {
          var hit = currentHits[parseInt(el.getAttribute("data-index"), 10)];
          if (onSelect) onSelect(hit, e);
        });
      });

      if (facetFields.length) wireFacetChips();
    }

    function facetsHtml(facets) {
      var html = '<div class="hx-search-facets">';
      facetFields.forEach(function (field) {
        var values = facets[field];
        if (!values) return;
        Object.keys(values).forEach(function (value) {
          // Le filtre envoye a l'API doit etre l'annotation BRUTE ("DIAM_M8").
          // La version precedente envoyait "DIAM:DIAM_M8", qui ne
          // correspondait a aucune annotation cote moteur : cliquer une
          // facette vidait les resultats. Corrige au chantier I3.
          var active = activeFilters.indexOf(value) !== -1;
          html += '<button type="button" class="hx-search-facet-chip' + (active ? " hx-active" : "") +
            '" data-filter="' + esc(value) + '" title="' + esc(humanizeGroup(field)) + '">' +
            esc(humanizeValue(value, field)) + " (" + values[value] + ")</button>";
        });
      });
      return html + "</div>";
    }

    function wireFacetChips() {
      panel.querySelectorAll(".hx-search-facet-chip").forEach(function (chip) {
        chip.addEventListener("click", function (e) {
          e.stopPropagation();
          var token = chip.getAttribute("data-filter");
          var idx = activeFilters.indexOf(token);
          if (idx === -1) activeFilters.push(token); else activeFilters.splice(idx, 1);
          runSearch(input.value.trim());
        });
      });
    }

    function updateActiveHit() {
      panel.querySelectorAll(".hx-search-hit").forEach(function (el, i) {
        el.classList.toggle("hx-hit-active", i === activeIndex);
      });
      var activeEl = panel.querySelector(".hx-search-hit.hx-hit-active");
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
        input.setAttribute("aria-activedescendant", activeEl.id);
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }

    input.addEventListener("input", function () {
      var query = input.value.trim();
      clearTimeout(debounceTimer);
      if (query.length < minChars) {
        closePanel();
        return;
      }
      setState(TX.chargement);
      debounceTimer = setTimeout(function () { runSearch(query); }, debounceMs);
    });

    input.addEventListener("keydown", function (e) {
      if (panel.hidden || !currentHits.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, currentHits.length - 1);
        updateActiveHit();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActiveHit();
      } else if (e.key === "Enter" && activeIndex !== -1) {
        e.preventDefault();
        var hit = currentHits[activeIndex];
        if (onSelect) onSelect(hit, e);
        else {
          var el = panel.querySelectorAll(".hx-search-hit")[activeIndex];
          if (el && el.tagName === "A") el.click();
        }
      } else if (e.key === "Escape") {
        closePanel();
      }
    });

    document.addEventListener("click", function (e) {
      if (!container.contains(e.target)) closePanel();
    });

    return {
      destroy: function () {
        container.innerHTML = "";
        container.classList.remove("hx-search");
      },
    };
  }

  return { searchBox: searchBox };
});
