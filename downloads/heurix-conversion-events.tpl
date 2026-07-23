___TERMS_OF_SERVICE___

By creating or modifying this file you agree to Google Tag Manager's Community
Template Gallery Developer Terms of Service available at
https://developers.google.com/tag-manager/gallery-tos (or such other URL as
Google may provide), as modified from time to time.


___INFO___

{
  "type": "TAG",
  "id": "cvt_heurix_events",
  "version": 1,
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
    "help": "Visible dans votre console Heurix, onglet Mes infos. Commence par hx_.",
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
  }
]


___SANDBOXED_JS_FOR_WEB___

const sendHttpRequest = require('sendHttpRequest');
const JSON = require('JSON');
const logToConsole = require('logToConsole');

var body = {
  event_type: data.eventType,
  catalog: data.catalog
};

if (data.eventType === 'search_click') {
  body.query = data.query;
  body.product_id = data.productId;
} else {
  var products;
  try {
    products = JSON.parse(data.productsJson);
  } catch (e) {
    logToConsole('Heurix - JSON invalide dans "Produits achetés" : ' + data.productsJson);
    data.gtmOnFailure();
    return;
  }
  body.products = products;
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

Limite à connaître : l'attribution recherche → achat dépend entièrement
de la qualité de votre implémentation (quels déclencheurs, quelles
variables vous branchez). Heurix agrège les événements reçus sur la
même période, ce n'est pas un suivi de session individuel garanti à 100%.
