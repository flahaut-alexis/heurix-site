/*
 * Heurix Tracker — identifiant visiteur persistant + envoi des événements
 * de conversion. À charger UNE SEULE FOIS, site-wide, idéalement dans le
 * <head> ou tôt dans le <body>, avant toute interaction de recherche.
 *
 * Ce script remplace heurix-conversion-snippet.html : les mêmes fonctions
 * heurixTrackClick/heurixTrackPurchase existent toujours (compatibilité),
 * mais incluent désormais automatiquement un identifiant visiteur
 * persistant. Ça permet à Heurix de relier un clic à un achat ultérieur
 * du MÊME visiteur, plutôt qu'une simple corrélation agrégée sur la
 * période — voir "attributed_revenue" dans /v1/analytics/conversion-summary.
 *
 * Vous n'installez ce script qu'une fois. Si vous utilisiez déjà l'ancien
 * snippet (heurix-conversion-snippet.html), remplacez-le simplement par
 * celui-ci — vos appels à heurixTrackClick/heurixTrackPurchase existants
 * continuent de fonctionner sans aucune modification de votre code.
 */
(function () {
  var HEURIX_API_KEY = "hxp_VOTRE_CLE_PUBLIQUE";  // Cle PUBLIQUE (hxp_), jamais une cle serveur
  var HEURIX_CATALOG = "votre-catalogue";       // Le nom exact de votre catalogue indexé
  var STORAGE_KEY = "heurix_visitor_id";

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
  heurixWarnIfServerKey(HEURIX_API_KEY);

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "hxv-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  var visitorId;
  try {
    visitorId = window.localStorage.getItem(STORAGE_KEY);
    if (!visitorId) {
      visitorId = generateId();
      window.localStorage.setItem(STORAGE_KEY, visitorId);
    }
  } catch (e) {
    // Navigation privée ou stockage bloqué par le visiteur : identifiant
    // valable pour la durée de la page seulement — le suivi dégrade en
    // douceur (attribution moins précise ce jour-là) plutôt que de
    // planter ou de bloquer la navigation.
    visitorId = generateId();
  }

  function send(eventType, payload) {
    payload = payload || {};
    payload.event_type = eventType;
    payload.catalog = HEURIX_CATALOG;
    payload.visitor_id = visitorId;
    // keepalive: la requête part même si la page se ferme juste après
    // (cas typique d'un achat suivi d'une redirection).
    fetch("https://api.heurix.fr/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + HEURIX_API_KEY },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () {
      // Un échec d'envoi ne doit jamais bloquer la navigation du visiteur.
    });
  }

  window.Heurix = {
    visitorId: visitorId,

    // Appelez ceci quand un visiteur clique sur un produit depuis vos
    // résultats de recherche : Heurix.trackClick("cheville placo", "sku-123")
    trackClick: function (query, productId) {
      send("search_click", { query: query, product_id: productId });
    },

    // Appelez ceci sur votre page de confirmation de commande, avec la
    // liste des produits achetés. La marge est optionnelle par produit.
    // Heurix.trackPurchase([{id: "sku-123", amount: 29.90, margin: 8.50}])
    trackPurchase: function (products) {
      send("purchase", { products: products });
    }
  };

  // Alias à plat, pour compatibilité avec l'ancien snippet sans tracker —
  // si vous avez déjà du code appelant heurixTrackClick/heurixTrackPurchase,
  // rien à changer.
  window.heurixTrackClick = window.Heurix.trackClick;
  window.heurixTrackPurchase = window.Heurix.trackPurchase;

  // Variable à plat, pratique pour la lire depuis une balise GTM via
  // copyFromWindow('heurixVisitorId') — plus fiable qu'un chemin imbriqué
  // dans l'environnement JavaScript en bac à sable de GTM.
  window.heurixVisitorId = visitorId;
})();
