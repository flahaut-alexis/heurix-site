___TERMS_OF_SERVICE___

By creating or modifying this file you agree to Google Tag Manager's Community
Template Gallery Developer Terms of Service available at
https://developers.google.com/tag-manager/gallery-tos (or such other URL as
Google may provide), as modified from time to time.


___INFO___

{
  "type": "TAG",
  "id": "cvt_heurix_events",
  "version": 2,
  "securityGroups": [],
  "displayName": "Heurix - Événement de conversion",
  "categories": ["ANALYTICS", "ECOMMERCE"],
  "brand": {
    "id": "heurix",
    "displayName": "Heurix",
    "thumbnail": ""
  },
  "description": "Envoie un événement de clic ou d'achat vers Heurix, pour mesurer le taux de clic sur vos recherches et le chiffre d'affaires qui en découle. Un tag = un événement (clic ou achat) ; posez-en un de chaque type selon vos besoins.",
  "containerContexts": ["WEB"]
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "apiKey",
    "displayName": "Clé API Heurix",
    "simpleValueType": true,
    "help": "Visible dans votre console Heurix, menu Mon compte > Clé API. Commence par hxp_ (clé PUBLIQUE) — jamais une clé serveur (hx_), lisible par tous vos visiteurs une fois posée côté navigateur.",
    "valueValidators": [
      {
        "type": "NON_EMPTY"
      }
    ]
  },
  {
    "type": "TEXT",
    "name": "catalog",
    "displayName": "Nom du catalogue",
    "simpleValueType": true,
    "help": "Le nom du catalogue tel qu'indexé chez Heurix (ex. boutique-principale).",
    "valueValidators": [
      {
        "type": "NON_EMPTY"
      }
    ]
  },
  {
    "type": "SELECT",
    "name": "eventType",
    "displayName": "Type d'événement",
    "macrosInSelect": false,
    "selectItems": [
      {
        "value": "search_click",
        "displayValue": "Clic sur un résultat de recherche"
      },
      {
        "value": "purchase",
        "displayValue": "Achat"
      }
    ],
    "simpleValueType": true
  },
  {
    "type": "TEXT",
    "name": "query",
    "displayName": "Requête de recherche",
    "simpleValueType": true,
    "help": "La recherche qui a mené à ce clic — généralement une variable de couche de données (ex. {{DLV - search term}}).",
    "enablingConditions": [
      {
        "paramName": "eventType",
        "paramValue": "search_click",
        "type": "EQUALS"
      }
    ]
  },
  {
    "type": "TEXT",
    "name": "productId",
    "displayName": "Identifiant du produit cliqué",
    "simpleValueType": true,
    "help": "L'identifiant du produit sur lequel le visiteur a cliqué depuis les résultats.",
    "enablingConditions": [
      {
        "paramName": "eventType",
        "paramValue": "search_click",
        "type": "EQUALS"
      }
    ]
  },
  {
    "type": "SELECT",
    "name": "productsFormat",
    "displayName": "Format des produits achetés",
    "macrosInSelect": false,
    "selectItems": [
      {
        "value": "heurix",
        "displayValue": "Format Heurix : [{\"id\",\"amount\",\"margin\"}]"
      },
      {
        "value": "ga4",
        "displayValue": "Format GA4 standard : [{\"item_id\",\"price\",\"quantity\"}]"
      }
    ],
    "simpleValueType": true,
    "defaultValue": "heurix",
    "help": "Si votre couche de donnees ecommerce suit deja le schema GA4 (evenement purchase avec ecommerce.items), choisissez GA4 -- reutilisez directement votre variable existante (ex. {{DLV - ecommerce.items}}) sans en construire une nouvelle. amount est calcule ici comme price x quantity (le total de la ligne, pas le prix unitaire) : c'est ce que Heurix additionne pour votre chiffre d'affaires.",
    "enablingConditions": [
      {
        "paramName": "eventType",
        "paramValue": "purchase",
        "type": "EQUALS"
      }
    ]
  },
  {
    "type": "TEXT",
    "name": "productsJson",
    "displayName": "Produits achetés (JSON)",
    "simpleValueType": true,
    "help": "Un tableau JSON, un objet par produit acheté : [{\"id\":\"sku-123\",\"amount\":29.90,\"margin\":8.50}]. La marge est optionnelle. En pratique, référencez une variable qui construit ce tableau depuis votre couche de données ecommerce (ex. {{DLV - items}}), plutôt que de le taper en dur ici.",
    "enablingConditions": [
      {
        "paramName": "eventType",
        "paramValue": "purchase",
        "type": "EQUALS"
      }
    ]
  },
  {
    "type": "TEXT",
    "name": "visitorId",
    "displayName": "Identifiant visiteur (optionnel, recommandé)",
    "simpleValueType": true,
    "help": "Permet à Heurix de relier un clic à un achat ultérieur du même visiteur, plutôt qu'une simple corrélation agrégée. Si vous avez installé heurix-tracker.js sur votre site, créez une variable GTM de type « Variable JavaScript » pointant vers heurixVisitorId, puis référencez-la ici (ex. {{JS - Heurix Visitor ID}}). Laissez vide si vous n'utilisez pas le tracker — tout continue de fonctionner, juste avec une attribution moins précise."
  }
]


___SANDBOXED_JS_FOR_WEB___

const sendHttpRequest = require('sendHttpRequest');
const JSON = require('JSON');
const logToConsole = require('logToConsole');

// Garde-fou securite (3 aout, roadmap audit multi-marques) -- le champ
// d'aide seul ne suffit pas : rien n'empechait avant ce correctif de
// coller une cle SERVEUR (hx_) ici, qui aurait alors ete transmise
// depuis le navigateur de chaque visiteur a chaque evenement. Meme
// principe que heurixWarnIfServerKey() dans heurix-tracker.js, mais
// BLOQUANT plutot qu'un simple avertissement console : un tag GTM qui
// echoue silencieusement est moins grave qu'un tag qui envoie
// reellement une cle exposee.
if (data.apiKey && data.apiKey.indexOf('hxp_') !== 0) {
  logToConsole('Heurix - ATTENTION : la cle fournie ne commence pas par hxp_. ' +
    'Une cle serveur (hx_) ne doit jamais etre posee cote navigateur -- ' +
    'elle est lisible par tous vos visiteurs et donne acces a votre facturation. ' +
    'Generez une cle PUBLIQUE depuis Mon compte > Cle API dans votre console Heurix.');
  data.gtmOnFailure();
  return;
}

var body = {
  event_type: data.eventType,
  catalog: data.catalog
};

if (data.eventType === 'search_click') {
  body.query = data.query;
  body.product_id = data.productId;
} else {
  var brut;
  try {
    brut = JSON.parse(data.productsJson);
  } catch (e) {
    logToConsole('Heurix - JSON invalide dans "Produits achetés" : ' + data.productsJson);
    data.gtmOnFailure();
    return;
  }
  var products;
  if (data.productsFormat === 'ga4') {
    // Traduction GA4 -> Heurix (3 aout, roadmap audit multi-marques) --
    // amount = price x quantity (le TOTAL de la ligne, verifie cote
    // moteur : EventProduct n'a pas de champ quantity separe, Heurix
    // additionne amount directement pour le chiffre d'affaires -- un
    // prix unitaire seul sous-evaluerait le CA de tout achat multi-
    // exemplaires. margin n'a pas d'equivalent GA4 standard, reste
    // absente comme elle est deja optionnelle cote Heurix.
    products = [];
    for (var i = 0; i < brut.length; i++) {
      var item = brut[i];
      if (!item || !item.item_id) {
        logToConsole('Heurix - item GA4 sans item_id, ignore : ' + JSON.stringify(item));
        continue;
      }
      products.push({
        id: item.item_id,
        amount: (Number(item.price) || 0) * (Number(item.quantity) || 1)
      });
    }
  } else {
    products = brut;
  }
  body.products = products;
}

if (data.visitorId) {
  body.visitor_id = data.visitorId;
}

sendHttpRequest(
  'https://api.heurix.fr/v1/events',
  {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + data.apiKey
    },
    method: 'POST',
    timeout: 3000
  },
  JSON.stringify(body)
).then(function (result) {
  if (result.statusCode >= 200 && result.statusCode < 300) {
    data.gtmOnSuccess();
  } else {
    logToConsole('Heurix - échec envoi événement, statut ' + result.statusCode + ' : ' + result.body);
    data.gtmOnFailure();
  }
}).catch(function (error) {
  logToConsole('Heurix - erreur réseau envoi événement : ' + error);
  data.gtmOnFailure();
});


___WEB_PERMISSIONS___

[
  {
    "instance": {
      "key": {
        "publicId": "send_http",
        "versionId": "1"
      },
      "param": [
        {
          "key": "allowedUrls",
          "value": {
            "type": 1,
            "string": "specific"
          }
        },
        {
          "key": "urls",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 1,
                "string": "https://api.heurix.fr/v1/events"
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "logging",
        "versionId": "1"
      },
      "param": [
        {
          "key": "environments",
          "value": {
            "type": 1,
            "string": "debug"
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  }
]


___TESTS___

scenarios: []


___NOTES___

Créé le 24 juillet 2026 pour le chantier "Conversion & ROI" de Heurix.
Mis à jour le même jour (chantier "Tracker Heurix") pour le champ
"Identifiant visiteur". Mis à jour le 3 août 2026 (roadmap audit
multi-marques) pour le champ "Format des produits achetés".

Comment l'utiliser :
1. Dans GTM, Modèles > Modèles de balises > Nouveau > (menu ⋮) > Importer,
   sélectionnez ce fichier .tpl.
2. Créez une balise à partir de ce modèle, une fois par type d'événement
   que vous voulez suivre (clic, achat).
3. Renseignez votre clé API et le nom de votre catalogue Heurix.
4. Choisissez le déclencheur adapté (ex. un clic sur un lien produit
   depuis vos résultats de recherche, ou l'événement "purchase" de votre
   couche de données ecommerce).
5. Publiez le conteneur.

Si votre couche de données suit déjà le schéma GA4 e-commerce standard
(evenement "purchase" avec ecommerce.items, chaque item portant item_id,
price, quantity) : sur la balise d'achat, choisissez "Format GA4
standard" dans "Format des produits achetés", et référencez directement
votre variable existante (ex. {{DLV - ecommerce.items}}) dans "Produits
achetés (JSON)" — pas besoin de construire une variable de traduction
séparée. amount est calculé automatiquement comme price x quantity (le
total de la ligne). Un item sans item_id est ignoré (avec un message en
console en mode debug), les autres items valides partent normalement.
Sans ce champ (par défaut "Format Heurix"), rien ne change par rapport
au comportement existant.

Pour une attribution précise (recommandé) : installez d'abord
heurix-tracker.js sur votre site (une fois, site-wide — voir sa propre
documentation), créez une variable GTM de type "Variable JavaScript"
pointant vers heurixVisitorId, puis référencez cette variable dans le
champ "Identifiant visiteur" de chaque balise créée à partir de ce
modèle. Sans ce champ rempli, tout continue de fonctionner normalement
— seule la précision de l'attribution en dépend (agrégée sur la période
plutôt que liée à un visiteur précis). Voir "attributed_revenue" dans
/v1/analytics/conversion-summary pour la différence concrète que ça fait.

Limite à connaître, même avec l'identifiant visiteur : la qualité du
signal dépend toujours de votre implémentation (quels déclencheurs,
quelles variables vous branchez). Ce n'est pas un suivi garanti à 100%,
seulement bien plus précis qu'une simple corrélation temporelle.
