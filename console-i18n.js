/* Traduction de la console — une seule source, un dictionnaire.
 *
 * POURQUOI CE MÉCANISME PLUTÔT QU'UNE SECONDE CONSOLE.
 *
 * `en/console.html` était une ébauche de 179 lignes contre 829 pour la
 * version française : pas de barre latérale, pas de gestion de catalogues,
 * pas d'éditeur. Un client européen n'avait aucun espace de travail.
 *
 * La réponse évidente — dupliquer console.html et le traduire — produirait
 * deux fichiers qui divergeraient à la première modification. Cette session
 * en a donné plusieurs exemples : un correctif appliqué d'un côté, oublié de
 * l'autre.
 *
 * Ici, `console.html` reste l'unique source. `en/console.html` en est une
 * copie dont seuls l'attribut `lang` et les chemins relatifs diffèrent, et
 * la traduction se fait à l'affichage à partir du dictionnaire ci-dessous.
 * Une chaîne ajoutée en français apparaîtra en français côté anglais —
 * visible, donc corrigeable — plutôt que de disparaître silencieusement.
 *
 * COUVERTURE. Le dictionnaire couvre la navigation, les titres, les actions
 * et les messages d'état — ce qu'un utilisateur voit en permanence. Les
 * textes d'aide longs restent à traduire ; ils s'afficheront en français,
 * ce qui est préférable à une traduction automatique approximative sur des
 * explications techniques.
 */
(function () {
  "use strict";

  var EN = (document.documentElement.lang || "fr").slice(0, 2).toLowerCase() === "en";
  if (!EN) { window.T = function (s) { return s; }; return; }

  var DICT = {
    // ---------------------------------------------------------- navigation
    "Comment ça marche": "How it works",
    "Produits les plus vus": "Most viewed products",
    "Gestion des règles": "Rule management",
    "Classement &amp; merchandising": "Ranking & merchandising",
    "Classement & merchandising": "Ranking & merchandising",
    "Configurer la recherche": "Configure search",
    "Boost / relégation par attribut": "Boost / bury by attribute",
    "Clés publiques (navigateur)": "Public keys (browser)",
    "Conversion &amp; ROI": "Conversion & ROI",
    "Conversion & ROI": "Conversion & ROI",
    "Erreurs récentes": "Recent errors",
    "Démarrage": "Getting started",
    "Browse &amp; Discovery": "Ranking",
    "Browse & Discovery": "Ranking",
    "Mes infos": "My details",
    "Nom de l'entreprise": "Company name",
    "Adresse email": "Email address",
    "Rôle": "Role",
    "Statut": "Status",
    "Catégorie": "Category",
    "Catalogue": "Catalogue",
    "Synonymes": "Synonyms",
    "Règles personnalisées": "Custom rules",
    "Pack de règles": "Rule pack",
    "Bac à sable": "Sandbox",
    "Indexer des produits": "Index products",
    "Simuler": "Simulate",
    "Réinitialiser": "Reset",
    "Fermer": "Close",
    "Suivant": "Next",
    "Précédent": "Previous",
    "Terminer": "Finish",
    "Chargement…": "Loading…",
    "Erreur": "Error",
    "Succès": "Success",
    "règle active": "active rule",
    "règles actives": "active rules",
    "Règles en place": "Rules in place",
    "Tableau de bord": "Dashboard",
    "Espace client": "Client area",
    "Mes catalogues": "My catalogues",
    "Analytics": "Analytics",
    "Personnalisation": "Personalisation",
    "Recherches": "Searches",
    "Recherches populaires": "Top searches",
    "Sans résultat": "Zero results",
    "Erreurs": "Errors",
    "Guides": "Guides",
    "Visite guidée": "Guided tour",
    "Se déconnecter": "Sign out",
    "Mon compte": "My account",
    "Entreprise": "Company",
    "Membres": "Team",
    "Clé API": "API key",
    "Mon abonnement": "My subscription",
    "Suggérer une amélioration": "Suggest an improvement",
    "Ranking": "Ranking",
    "Recherche": "Search",

    // ------------------------------------------------------------ périodes
    "7 derniers jours": "Last 7 days",
    "30 derniers jours": "Last 30 days",
    "90 derniers jours": "Last 90 days",
    "Catalogue actif": "Active catalogue",

    // ------------------------------------------------------------- actions
    "Enregistrer": "Save",
    "Enregistrer les informations": "Save details",
    "Envoyer": "Send",
    "Envoyer ma suggestion": "Send my suggestion",
    "Appliquer": "Apply",
    "Abandonner": "Discard",
    "Annuler": "Cancel",
    "Annuler la modification": "Cancel change",
    "Ajouter": "Add",
    "Ajouter une règle": "Add a rule",
    "Ajouter la règle": "Add rule",
    "Ajouter une priorité": "Add a priority",
    "Ajouter la priorité": "Add priority",
    "Supprimer définitivement": "Delete permanently",
    "Confirmer la suppression": "Confirm deletion",
    "Cette action est irréversible.": "This action cannot be undone.",
    "Copier": "Copy",
    "Copié": "Copied",
    "Voir le détail": "View details",
    "Détail technique": "Technical details",
    "Voir les formules": "View plans",
    "Comparer les offres": "Compare plans",
    "J'ai compris": "Got it",

    // -------------------------------------------------------- en-têtes KPI
    "Recherches ce mois-ci": "Searches this month",
    "Taux sans résultat": "Zero-result rate",
    "Requêtes": "Requests",
    "Requêtes ce mois-ci": "Requests this month",
    "Catalogues": "Catalogues",
    "Produits par catalogue": "Products per catalogue",
    "Formule": "Plan",
    "stable": "stable",
    "vs période précédente": "vs previous period",

    // ---------------------------------------------------------- tableaux
    "Requête": "Query",
    "Nb de fois": "Count",
    "Produit": "Product",
    "Action": "Action",
    "Position": "Position",
    "Déclencheur": "Trigger",
    "Attribut": "Attribute",
    "Quand": "When",
    "Ce qui s'est passé": "What happened",
    "Épingler": "Pin",
    "Reléguer": "Bury",
    "Alphabétique": "Alphabetical",

    // -------------------------------------------------------- états vides
    "Aucune recherche sur cette période.": "No searches in this period.",
    "Aucune erreur sur cette période.": "No errors in this period.",
    "Aucun produit dans cette catégorie.": "No products in this category.",
    "Aucun résultat pour cette requête.": "No results for this query.",
    "Aucune clé publique pour l'instant.": "No public key yet.",
    "Aucune priorité posée sur ce catalogue.": "No priorities set on this catalogue.",
    "Aucune priorité posée sur cette catégorie.": "No priorities set on this category.",
    "Aucune règle d'attribut posée sur cette catégorie.": "No attribute rules set on this category.",
    "Aucune recherche sans résultat sur cette période — bon signe.":
      "No zero-result searches in this period — a good sign.",
    "Aucun achat remonté sur cette période — vérifiez que la balise est bien installée.":
      "No purchases reported in this period — check that the tag is correctly installed.",

    // -------------------------------------------------------- abonnement
    "Essai": "Trial",
    "Starter": "Starter",
    "Growth": "Growth",
    "Scale": "Scale",
    "Conservation": "Retention",
    "(optionnel)": "(optional)",
    "Aperçu des résultats": "Results preview",
    "Aperçu du classement": "Ranking preview",
  };

  // Attributs porteurs de texte visible ou annoncé aux lecteurs d'écran.
  var ATTRIBUTS = ["title", "aria-label", "placeholder", "alt"];

  function traduire(s) {
    if (!s) return s;
    var net = s.trim();
    if (!net) return s;
    var trad = DICT[net];
    if (!trad) return s;
    // On préserve les espaces d'origine autour du texte : les retirer
    // collerait des mots dans certains gabarits.
    return s.replace(net, trad);
  }

  function parcourir(racine) {
    // Constantes numeriques plutot que NodeFilter.* : l'objet global
    // n'est pas resolu dans tous les contextes d'execution, et un plantage
    // ici laisserait l'interface entierement en francais.
    var MONTRER_TEXTE = 4, ACCEPTER = 1, REJETER = 2;
    var marcheur = document.createTreeWalker(racine, MONTRER_TEXTE, {
      acceptNode: function (n) {
        // On ignore le contenu des balises techniques : traduire du code ou
        // un style casserait la page.
        var p = n.parentNode;
        if (!p) return REJETER;
        var t = p.nodeName;
        if (t === "SCRIPT" || t === "STYLE" || t === "CODE" || t === "PRE") {
          return REJETER;
        }
        return n.nodeValue.trim() ? ACCEPTER : REJETER;
      },
    });
    var n;
    while ((n = marcheur.nextNode())) {
      var t = traduire(n.nodeValue);
      if (t !== n.nodeValue) n.nodeValue = t;
    }

    var elements = racine.querySelectorAll ? racine.querySelectorAll("*") : [];
    for (var i = 0; i < elements.length; i++) {
      for (var a = 0; a < ATTRIBUTS.length; a++) {
        var v = elements[i].getAttribute(ATTRIBUTS[a]);
        if (v) {
          var tv = traduire(v);
          if (tv !== v) elements[i].setAttribute(ATTRIBUTS[a], tv);
        }
      }
    }
  }

  // Fonction exposée à console.js pour ses chaînes construites en JavaScript.
  window.T = traduire;

  function lancer() {
    parcourir(document.body);

    // La console rend beaucoup de contenu APRÈS le chargement : tableaux,
    // cartes, modales. Sans observation continue, tout cela resterait en
    // français.
    // Sans MutationObserver, la traduction initiale reste valable : seul le
    // contenu ajoute ensuite resterait en francais. On degrade plutot que
    // de planter.
    if (typeof MutationObserver === "undefined") return;
    var observateur = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1) parcourir(n);
          else if (n.nodeType === 3) {
            var t = traduire(n.nodeValue);
            if (t !== n.nodeValue) n.nodeValue = t;
          }
        });
      });
    });
    observateur.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", lancer);
  } else {
    lancer();
  }
})();
