/* Console translation — one source, one dictionary.
 *
 * WHY THIS MECHANISM INSTEAD OF A SECOND CONSOLE.
 *
 * A duplicated, hand-translated `console-en.js` was tried first (31 July).
 * It worked, but it recreated the exact problem this file was originally
 * built to avoid: two files that drift apart at the next change. Within
 * the same session, `index.html` and `docs.html` had already lost real
 * functionality this way — a script edited on one side, forgotten on the
 * other.
 *
 * `console.html` and `console.js` are now the ONLY source, in both
 * languages. `en/console.html` is a copy differing only in `lang` and
 * relative paths. Every user-facing string in `console.js` is passed
 * through `T(...)`. On a French page, `T` is a passthrough (after
 * variable substitution). On an English page, `T` looks the string up in
 * `DICT` below before substituting.
 *
 * TWO TRANSLATION PATHS, ONE DICTIONARY.
 *
 *   1. STATIC HTML — a TreeWalker scans the page (plus a MutationObserver
 *      for anything rendered later) and replaces any text node or
 *      title/aria-label/placeholder/alt attribute that matches a DICT key
 *      exactly. This covers `console.html`'s own markup.
 *
 *   2. DYNAMIC STRINGS FROM console.js — call `T("template with {0}",
 *      value)` instead of building the string by concatenation. `T` looks
 *      up the TEMPLATE (the part before substitution) in DICT, then fills
 *      in `{0}`, `{1}`, etc. A template with no matching DICT entry is
 *      returned as-is (still substituted) — visible in French rather than
 *      silently missing, exactly like path 1's fallback.
 *
 * A string added in French and never translated shows up in French on
 * the English console — a visible, fixable gap, not a silent one.
 */
(function () {
  "use strict";

  var EN = (document.documentElement.lang || "fr").slice(0, 2).toLowerCase() === "en";

  var DICT = {
    // --------------------------------------------- seconde passe (couverture)
    "Boost et relégation par attribut": "Boost and bury by attribute",
    "CA réellement attribué": "Revenue actually attributed",
    "CA total (période)": "Total revenue (period)",
    "Ce que fait un pack de règles": "What a rule pack does",
    "Chargement des données…": "Loading data…",
    "Choisissez votre mot de passe": "Choose your password",
    "Comment réordonner deux produits": "How to reorder two products",
    "Créer une règle personnalisée": "Create a custom rule",
    "Dans quel ordre les règles s'appliquent": "The order rules are applied in",
    "Documentation complète": "Full documentation",
    "documentation complète": "full documentation",
    "Domaines autorisés": "Allowed domains",
    "Démarrer la visite": "Start the tour",
    "Faire la visite guidée": "Take the guided tour",
    "Visite guidée de l'éditeur de règles": "Guided tour of the rule editor",
    "Exemple — Mot-clé → étiquette": "Example — Keyword → label",
    "Exemple — Préfixe + nombre → étiquette": "Example — Prefix + number → label",
    "Faites de même sur un second produit.": "Do the same on a second product.",
    "Glissez une carte épinglée sur l'autre": "Drag one pinned card onto another",
    "Générer la clé": "Generate the key",
    "Heurix. Tous droits réservés.": "Heurix. All rights reserved.",
    "Intégrations": "Integrations",
    "La clé ci-dessus est une": "The key above is a",
    "Le catalogue": "The catalog",
    "Masquer les produits en rupture": "Hide out-of-stock products",
    "Mot de passe oublié ?": "Forgot your password?",
    "Réinitialiser mon mot de passe": "Reset my password",
    "Plus récent": "Newest",
    "Popularité (clics + achats)": "Popularity (clicks + purchases)",
    "Priorités par produit": "Priorities by product",
    "Priorités par produit (liste détaillée)": "Priorities by product (detailed list)",
    "Produits affichés": "Products shown",
    "Préfixe à reconnaître": "Prefix to recognize",
    "Mots les plus recherchés, recherches sans résultat, erreurs récentes, consommation — connectez-vous pour les consulter.":
      "Top searched terms, zero-result searches, recent errors, usage — sign in to see them.",
    "Préfixe à reconnaître, ex. M (pour M8, M10…)": "Prefix to recognize, e.g. M (for M8, M10…)",
    "Recherches sans résultat": "Zero-result searches",
    "Rejoindre l'équipe": "Join the team",
    "Suggestion de fonctionnalité": "Feature suggestion",
    "Synonymes et règles personnalisées": "Synonyms and custom rules",
    "Taux de clic sur les recherches": "Search click-through rate",
    "Voir le tableau détaillé": "View the detailed table",
    "Voir « Comment ça marche »": "See “How it works”",
    "Votre message": "Your message",
    "Votre tableau de bord.": "Your dashboard.",
    "affichée": "shown",
    "catégories": "categories",
    "clé publique": "public key",
    "clé serveur": "server key",
    "consultez l'article de blog dédié": "see the dedicated blog post",
    "consultez la documentation": "see the documentation",
    "depuis vos pages de catégorie — voir": "from your category pages — see",
    "immédiatement": "immediately",
    "même visiteur": "same visitor",
    "pour en voir apparaître ici.": "to see them appear here.",
    "pour enregistrer.": "to save.",
    ", c'est faisable côté moteur.": ", the engine can do it.",
    ", pas des requêtes de recherche.": ", not search queries.",
    "relégués": "buried",
    "relégations": "buries",
    "boosts": "boosts",
    // ------------------------------------------------- libellés d'interface
    "Confidentialité": "Privacy",
    "Booster (boost)": "Boost",
    "Reléguer (bury)": "Bury",
    "Nom de la règle": "Rule name",
    "Impact business": "Business impact",
    "À utiliser dans": "Use in",
    "Envoyer le lien": "Send link",
    "Type de demande": "Request type",
    "Fonctionnalités": "Features",
    "Réseaux sociaux": "Social media",
    "Produits achetés": "Purchased products",
    "Résultats (moy.)": "Results (avg.)",
    "Stock disponible": "Available stock",
    "Créer mon compte": "Create my account",
    "Mots équivalents": "Equivalent words",
    "la documentation": "the documentation",
    "Clé publique": "Public key",
    "Clé serveur": "Server key",
    "Générer une clé publique": "Generate a public key",
    "Révoquer": "Revoke",
    "Monter d'une place": "Move up one place",
    "Descendre d'une place": "Move down one place",
    "Épingler en tête": "Pin to top",
    "Retirer du classement": "Remove from ranking",
    "Chiffre d'affaires": "Revenue",
    "Panier moyen": "Average order value",
    "Taux de conversion": "Conversion rate",
    "Vues de catégorie": "Category views",
    "Ajouter un synonyme": "Add a synonym",
    "Groupe de synonymes": "Synonym group",
    "Sélectionnez un catalogue": "Select a catalog",
    "Sélectionnez une catégorie": "Select a category",
    "Tous les catalogues": "All catalogs",
    "Toutes les catégories": "All categories",
    "Rôle : administrateur": "Role: administrator",
    "Rôle : membre": "Role: member",
    "Invitation envoyée": "Invitation sent",
    "En attente": "Pending",
    "Changer de formule": "Change plan",
    "Gérer mon abonnement": "Manage my subscription",
    "Facturation": "Billing",
    "Prochaine échéance": "Next renewal",

    // ------------------------------------------------------ phrases d'aide
    "Aucun catalogue indexé pour l'instant —": "No catalog indexed yet —",
    "Ces chiffres dépendent de la balise que": "These figures depend on the tag you",
    "Ne posez jamais cette clé dans une page web":
      "Never put this key in a web page",
    "Indexez votre premier catalogue en 5 minutes":
      "Index your first catalogue in 5 minutes",
    "pour les intervertir — ou utilisez les flèches":
      "to swap them — or use the arrows",
    ", équivalentes et utilisables au clavier.":
      ", equivalent and keyboard-accessible.",
    "Glossaire du search e-commerce, sans jargon":
      "E-commerce search glossary, jargon-free",
    "Custom Rules : personnaliser sans écrire de regex":
      "Custom Rules: personalise without writing regex",
    "5 signes que votre recherche vous coûte des ventes":
      "5 signs your search is costing you sales",
    "Quelle alternative pour un catalogue technique ?":
      "Which alternative for a technical catalogue?",
    "L'impact réel sur l'EBITDA d'un e-commerce B2B":
      "The real EBITDA impact for a B2B e-commerce site",
    "Pas encore de compte ? Créer un compte gratuit":
      "No account yet? Create a free account",

    // ------------------------------------------------------------- messages
    "Le changement réindexe votre catalogue.":
      "Changing this reindexes your catalogue.",
    "Cette action est irréversible.": "This action cannot be undone.",
    "Aucun attribut reconnu": "No attributes recognised",
    "erreur à traiter": "error to handle",
    "erreurs à traiter": "errors to handle",
    "événement sans conséquence": "harmless event",
    "événements sans conséquence": "harmless events",
    "Vous travaillez sur ce catalogue": "You are working on this catalog",
    "Il vous reste un catalogue disponible": "You have one catalog left",
    "Vous avez atteint la limite de votre formule":
      "You have reached your plan's limit",
    // ---------------------------------------------------------- navigation
    "Clé": "Key",
    "Ma clé API": "My API key",
    "Copiée !": "Copied!",
    "Type": "Type",
    "Valeur": "Value",
    "Volume": "Volume",
    "Marge": "Margin",
    "Stock": "Stock",
    "Par marge": "By margin",
    "Par volume": "By volume",
    "Par popularité": "By popularity",
    "Équipe": "Team",
    "Inviter": "Invite",
    "Inviter un membre": "Invite a member",
    "Email": "Email",
    "N° de TVA": "VAT number",
    "Adresse": "Address",
    "Code postal": "Postcode",
    "Ville": "City",
    "Pays": "Country",
    "À propos": "About",
    "CGV": "Terms",
    "Mentions légales": "Legal notice",
    "Politique de confidentialité": "Privacy policy",
    "Gérer les cookies": "Manage cookies",
    "Documentation": "Documentation",
    "Tarifs": "Pricing",
    "Cheville": "Wall plug",
    "Boutique": "Shop",
    "Nom": "Name",
    "Prix": "Price",
    "Description": "Description",
    "Référence": "Reference",
    "Catégories": "Categories",
    "Identifiant": "Identifier",
    "Rechercher": "Search",
    "Résultats": "Results",
    "Filtres": "Filters",
    "Facettes": "Facets",
    "Trier par": "Sort by",
    "Pertinence": "Relevance",
    "Nouveauté": "Newest",
    "Prix croissant": "Price, low to high",
    "Prix décroissant": "Price, high to low",
    "En stock uniquement": "In stock only",
    "Créer": "Create",
    "Modifier": "Edit",
    "pertinence du mot": "word relevance",
    "popularité": "popularity",
    "Priorité": "Priority",
    "Période de diffusion définie": "Diffusion period set",
    "Inactive": "Inactive",
    "Programmée": "Scheduled",
    "« {0} » rapproché de « {1} »": "\u201c{0}\u201d linked to \u201c{1}\u201d",
    "Classement": "Ranking",
    "Compréhension": "Understanding",
    "Correspondance": "Matches",
    "Vos règles": "Your rules",
    "aucune règle sur cette recherche": "no rule on this search",
    "ordre alphabétique": "alphabetical order",
    "pertinence du mot + popularité récente": "word relevance + recent popularity",
    "{0} produits sur {1} contiennent ces mots": "{0} products out of {1} contain these words",
    "« {0} » saisi « {1} »": "\u201c{0}\u201d typed \u201c{1}\u201d",
    "« {0} » — aucune correction": "\u201c{0}\u201d — no correction",
    "Erreur — réessayez.": "Error — please try again.",
    "Saisissez au moins un mot équivalent.": "Enter at least one equivalent word.",
    "Tapez d'abord une requête dans l'aperçu — le synonyme se rattache à elle.": "Type a query in the preview first — the synonym attaches to it.",
    "Mes catalogues": "My catalogs",
    "Mon catalogue": "My catalog",
    "Que tapent vos visiteurs ?": "What are your visitors typing?",
    "Recherches fréquentes": "Frequent searches",
    "Conflit de position — cliquer pour en savoir plus": "Position conflict — click for details",
    "Supprimer {0} règle(s) ? Cette action est immédiate et ne passe pas par le brouillon.": "Delete {0} rule(s)? This action is immediate and does not go through the draft.",
    "Sélectionner cette règle": "Select this rule",
    "Une autre règle vise déjà la position {0} sur cette recherche.": "Another rule already targets position {0} on this search.",
    "Une autre règle vise déjà la position {0} sur la recherche « {1} ». Seule l'une des deux s'appliquera — vérifiez laquelle dans l'onglet Aperçu.": "Another rule already targets position {0} on the search \u201c{1}\u201d. Only one of the two will apply — check which one in the Preview tab.",
    "Supprimer": "Delete",
    "Retirer": "Remove",
    "Dupliquer": "Duplicate",
    "Épinglé": "Pinned",
    "Relégué": "Buried",
    "Boosté": "Boosted",
    "Actif": "Active",
    "Inactif": "Inactive",
    "Activé": "Enabled",
    "Désactivé": "Disabled",
    "Oui": "Yes",
    "Non": "No",
    "Aucun": "None",
    "Total": "Total",
    "Détails": "Details",
    "Aide": "Help",
    "Exporter": "Export",
    "Importer": "Import",
    "Télécharger": "Download",
    "Aperçu": "Preview",
    "Brouillon": "Draft",
    "Modifications non enregistrées": "Unsaved changes",
    "Enregistré.": "Saved.",
    "Priorité enregistrée.": "Priority saved.",
    "Règle personnalisée enregistrée.": "Custom rule saved.",
    "Règle d'attribut enregistrée.": "Attribute rule saved.",
    "Priorité de catégorie enregistrée.": "Category priority saved.",
    "Comment ça marche": "How it works",
    "Produits les plus vus": "Most viewed products",

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
    "Catalogue": "Catalog",
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
    "Catalogue actif": "Active catalog",

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
    "Catalogues": "Catalogs",
    "Produits par catalogue": "Products per catalog",
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
    "Aucune priorité posée sur ce catalogue.": "No priorities set on this catalog.",
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

    // --------------------------------------------- gabarits T() (console.js)
    //
    // Clé = le gabarit tel qu'écrit dans l'appel T(...), AVANT substitution
    // des {0}, {1}... — jamais la chaîne finale, qui varie à chaque appel.
    "Email ou mot de passe incorrect.": "Incorrect email or password.",
    "Impossible de joindre api.heurix.fr. Le service est peut-être temporairement indisponible.": "Couldn't reach api.heurix.fr. The service may be temporarily unavailable.",
    "Bonjour, {0}": "Hi, {0}",
    "à": "at",
    "tous": "all",
    "Révoquer": "Revoke",
    "Génération…": "Generating…",
    "Clé publique générée.": "Public key generated.",
    "Échec de la génération.": "Generation failed.",
    "Révoquer la clé publique <strong>{0}…</strong> ?<br>Si elle est utilisée sur votre site, la recherche cessera de fonctionner immédiatement pour vos visiteurs.":
      "Revoke the public key <strong>{0}…</strong>?<br>If it's used on your site, search will stop working immediately for your visitors.",
    "{0} impressions": "{0} impressions",
    "Vues": "Views",
    "Clics recherche": "Search clicks",
    "Ratio": "Ratio",
    "Masquer la clé": "Hide key",
    "Afficher la clé": "Show key",
    "Administrateur": "Admin",
    "Membre": "Member",
    "Rétrograder": "Demote",
    "Promouvoir admin": "Promote to admin",
    "Envoi…": "Sending…",
    "Invitation envoyée à {0}.": "Invitation sent to {0}.",
    "Échec de l'envoi.": "Failed to send.",
    "Enregistrement…": "Saving…",
    "Informations enregistrées.": "Information saved.",
    "Échec de l'enregistrement.": "Failed to save.",
    "Retirer <strong>{0}</strong> de l'équipe ?<br>Cette personne perdra immédiatement l'accès à la console et aux catalogues.":
      "Remove <strong>{0}</strong> from the team?<br>This person will immediately lose access to the console and to catalogs.",
    "Ce choix s'applique partout : tableau de bord, analytique et personnalisation. Changez-le ici pour basculer d'un catalogue à l'autre.":
      "This choice applies everywhere: dashboard, analytics, and personalization. Change it here to switch to a different catalog.",
    "jusqu'à {0}": "up to {0}",
    "{0} : {1} pour cent utilisés": "{0}: {1} percent used",
    "Essai gratuit": "Free trial",
    "Souscrire une formule": "Subscribe to a plan",
    "Vous êtes en période d'essai : choisissez une formule pour continuer après son terme. Aucun abonnement n'est encore actif sur votre compte.":
      "You're in your trial period: pick a plan to continue after it ends. No subscription is active on your account yet.",
    "Le changement se fait depuis le portail de facturation : Stripe calcule le prorata et ajuste votre abonnement en cours. Vous n'êtes pas facturé deux fois, et il n'y a pas de nouvelle période d'essai.":
      "Changes happen from the billing portal: Stripe calculates the proration and adjusts your current subscription. You're never billed twice, and there's no new trial period.",
    "<strong>Votre essai est terminé.</strong> Choisissez une formule pour continuer à utiliser Heurix.":
      "<strong>Your trial has ended.</strong> Choose a plan to keep using Heurix.",
    "Il vous reste {0} jours d'essai.": "You have {0} days left in your trial.",
    "Il vous reste {0} jour d'essai.": "You have {0} day left in your trial.",
    "Impossible de charger votre abonnement.": "Couldn't load your subscription.",
    "Ouverture du portail…": "Opening the portal…",
    "Aucun abonnement actif : souscrivez d'abord une formule depuis la page des tarifs.":
      "No active subscription: subscribe to a plan first from the pricing page.",
    "Aucun abonnement actif : le portail devient disponible après souscription.":
      "No active subscription: the portal becomes available after subscribing.",
    "Vous avez atteint le nombre de catalogues de votre formule.": "You've reached the number of catalogs in your plan.",
    "Vous avez dépassé le quota de requêtes de votre formule.": "You've exceeded your plan's request quota.",
    "Le bac à sable demande une formule Growth ou Scale.": "The sandbox requires a Growth or Scale plan.",
    "Une clé publique a tenté une action réservée aux clés serveur.": "A public key attempted an action reserved for server keys.",
    "Les clés publiques ne peuvent que lire. Vérifiez quelle clé votre site utilise.": "Public keys can only read. Check which key your site is using.",
    "Une requête est arrivée avec une clé API invalide ou absente.": "A request arrived with an invalid or missing API key.",
    "Vérifiez la clé configurée sur votre site. Ce message apparaît aussi lorsqu'un robot teste votre API — c'est alors sans conséquence.":
      "Check the key configured on your site. This message also appears when a bot probes your API — in that case it has no consequence.",
    "Une requête a visé un catalogue qui n'existe pas.": "A request targeted a catalog that doesn't exist.",
    "Vérifiez le nom du catalogue dans votre intégration : il est sensible à la casse.": "Check the catalog name in your integration: it's case-sensitive.",
    "Une requête a été refusée : format ou paramètre invalide.": "A request was rejected: invalid format or parameter.",
    "C'est généralement un problème d'intégration côté site, pas côté moteur.": "This is usually an integration issue on the site side, not the engine side.",
    "Une erreur interne du moteur s'est produite.": "An internal engine error occurred.",
    "Si elle se répète, écrivez à contact@heurix.fr avec la date et l'heure.": "If it keeps happening, email contact@heurix.fr with the date and time.",
    "Erreur non détaillée": "Undetailed error",
    "{0} erreur(s) demandant votre attention": "{0} error(s) needing your attention",
    "Les erreurs à traiter concernent un quota dépassé, une intégration en défaut ou un incident du moteur. Les autres — clés invalides, catalogues inconnus — proviennent souvent de robots qui testent votre API : elles n'ont pas d'effet sur vos visiteurs.":
      "Errors to address involve an exceeded quota, a broken integration, or an engine incident. The others — invalid keys, unknown catalogs — often come from bots probing your API: they have no effect on your visitors.",
    "Aucune erreur ne demande d'action. Les événements listés ci-dessous — clés invalides, catalogues inconnus — proviennent souvent de robots qui testent votre API.":
      "No error needs action. The events listed below — invalid keys, unknown catalogs — often come from bots probing your API.",
    "ex. vis, boulon, screw": "e.g. screw, bolt, fastener",
    "Ajouter un groupe": "Add a group",
    "Mot-clé → étiquette": "Keyword → label",
    "Préfixe + nombre → étiquette": "Prefix + number → label",
    "Nom de la règle, ex. Cheville": "Rule name, e.g. Anchor",
    "Mots équivalents, ex. placo, cheville, molly": "Equivalent words, e.g. drywall, anchor, molly",
    "Message envoyé — une réponse vous revient directement par email.": "Message sent — you'll get a reply directly by email.",
    "Échec de l'envoi — réessayez, ou écrivez directement à contact@heurix.fr.": "Failed to send — try again, or email contact@heurix.fr directly.",
    "CA réellement attribué (tracker non installé)": "Actually attributed revenue (tracker not installed)",
    "Dupliquer comme nouvelle règle": "Duplicate as a new rule",
    "{0} produits": "{0} products",
    "{0} produit": "{0} product",
    "ex. {0}": "e.g. {0}",
    "{0} résultats regroupés en {1} familles, classées par pertinence.": "{0} results grouped into {1} families, ranked by relevance.",
    "Rupture": "Out of stock",
    "{0} en stock": "{0} in stock",
    "Injecté par une règle": "Injected by a rule",
    "Monter {0}": "Move up {0}",
    "Descendre {0}": "Move down {0}",
    "Retirer l'épinglage": "Unpin",
    "Retirer l'épinglage de {0}": "Unpin {0}",
    "Mettre en tête": "Pin to top",
    "Mettre {0} en tête": "Pin {0} to top",
    "{0} résultats sur {1} pour « {2} »": "{0} results out of {1} for \"{2}\"",
    "{0} résultat sur {1} pour « {2} »": "{0} result out of {1} for \"{2}\"",
    "Aperçu du catalogue, par ordre alphabétique — tapez une requête pour voir le classement.":
      "Catalog preview, alphabetical order — type a query to see the ranking.",
    "{0} règles actives": "{0} active rules",
    "{0} règle active": "{0} active rule",
    "Tapez une requête comme le ferait un visiteur…": "Type a query the way a visitor would…",
    "Aucun mot proche dans votre catalogue.": "No close word in your catalog.",
    "S'il s'agit d'un autre mot pour un produit que vous vendez, ajoutez-le comme synonyme &rarr;":
      "If it's another word for a product you sell, add it as a synonym &rarr;",
    "Corriger": "Fix",
    "« {0} » trouvera désormais « {1} »": "\"{0}\" will now find \"{1}\"",
    "Création impossible : {0}": "Couldn't create it: {0}",
    "Règles appliquées.": "Rules applied.",
    "Saisissez d'abord une requête": "Type a query first",
    "pour épingler ou reléguer : une priorité se déclenche sur une recherche précise, elle n'existe pas en dehors d'une requête.":
      "to pin or bury: a priority triggers on a specific search, it doesn't exist outside of one.",
    "Modifier la priorité": "Edit priority",
    "Enregistrer les modifications": "Save changes",
    "Dupliquer une priorité — modifiez au moins un champ": "Duplicate a priority — change at least one field",
    "Créer cette priorité": "Create this priority",
    "— Choisir un catalogue d'abord —": "— Choose a catalog first —",
    "— Aucune catégorie —": "— No categories —",
    "— Choisir —": "— Choose —",
    "— Erreur de chargement —": "— Loading error —",
    "{0} produits dans « {1} »": "{0} products in \"{1}\"",
    "{0} produit dans « {1} »": "{0} product in \"{1}\"",
    "classement simulé": "simulated ranking",
    "Booster": "Boost",
    "Échec.": "Failed.",
    "Dupliquer — modifiez au moins un champ": "Duplicate — change at least one field",
    "Modifier la règle": "Edit rule",
    "Créer cette règle": "Create this rule",
    "Créer votre compte.": "Create your account.",
    "Une entreprise, un email, un mot de passe — votre clé API est générée immédiatement et envoyée par email.":
      "A company, an email, a password — your API key is generated immediately and emailed to you.",
    "Indiquez votre email, on vous envoie un lien pour en choisir un nouveau.":
      "Enter your email and we'll send you a link to choose a new one.",
    "Nouveau mot de passe.": "New password.",
    "Choisissez un nouveau mot de passe pour votre compte.": "Choose a new password for your account.",
    "Rejoindre votre équipe.": "Join your team.",
    "Dernière étape : choisissez votre mot de passe.": "Last step: choose your password.",
    "Un synonyme relie des mots entre eux : ajoutez-en au moins un second, séparé par une virgule (ex. vis, boulon).":
      "A synonym links words together: add at least a second one, separated by a comma (e.g. screw, bolt).",
    "Saisissez au moins deux mots séparés par une virgule.": "Enter at least two words separated by a comma.",
    "Groupe ajouté.": "Group added.",
    "Si le texte contient {0} → {1}": "If the text contains {0} → {1}",
    "Si « {0} » est suivi d'un nombre (ex. {0}8) → {1}": "If \"{0}\" is followed by a number (e.g. {0}8) → {1}",
    "nombre": "number",
    "Aucune règle personnalisée pour l'instant.": "No custom rules yet.",
    "Retirer cette règle": "Remove this rule",
    "sur cet échantillon. Vos produits ne bénéficient d'aucune annotation — vérifiez que le pack correspond bien à votre secteur, ou créez des règles personnalisées.":
      "on this sample. Your products get no annotations at all — check that the pack matches your industry, or create custom rules.",
    "Le pack <strong>{0}</strong> semble mieux adapté": "The <strong>{0}</strong> pack looks like a better fit",
    "Sur {0} produits : <strong>{1}</strong> annotés avec « {2} », contre <strong>{3}</strong> avec « {4} ».":
      "Out of {0} products: <strong>{1}</strong> annotated with \"{2}\", versus <strong>{3}</strong> with \"{4}\".",
    "aucun": "none",
    "Sélectionner le pack {0}": "Select the {0} pack",
    "Ce bouton présélectionne le pack.": "This button preselects the pack.",
    "<strong>Les annotations sont calculées à l'indexation</strong> : pour qu'elles changent, réimportez votre catalogue en déclarant le nouveau pack.":
      "<strong>Annotations are computed at indexing time</strong>: for them to change, re-import your catalog declaring the new pack.",
    "Voir la marche à suivre": "See how",
    "Supprimer le catalogue <strong>{0}</strong> et ses {1} produits ?<br>Les priorités, règles personnalisées et synonymes seront perdus. <strong>Cette action est irréversible.</strong>":
      "Delete the catalog <strong>{0}</strong> and its {1} products?<br>Priorities, custom rules, and synonyms will be lost. <strong>This action cannot be undone.</strong>",
    "Confirmez en recopiant le nom du catalogue :": "Confirm by typing the catalog name:",
    "Le nom ne correspond pas. Rien n'a été supprimé.": "The name doesn't match. Nothing was deleted.",
    "Suppression impossible : {0}": "Couldn't delete it: {0}",
    "Bac à sable activé.": "Sandbox enabled.",
    "Catalogue redevenu facturé.": "Catalog is billed again.",
    "Impossible de modifier ce réglage.": "Couldn't change this setting.",
    "Réindexation…": "Reindexing…",
    "Enregistré — produits réindexés.": "Saved — products reindexed.",
    "Échec — réessayez.": "Failed — please try again.",
    "{0} annotations": "{0} annotations",
    "{0} groupes de synonymes": "{0} synonym groups",
    "{0} groupe de synonymes": "{0} synonym group",
    "Bac à sable — ne pas facturer ce catalogue": "Sandbox — don't bill this catalog",
    "Gérés depuis": "Managed from",
    "Configurer → Règles": "Configure → Rules",
    "Supprimer ce catalogue": "Delete this catalog",
    "{0} catalogues sur {1}": "{0} catalogs out of {1}",
    "{0} catalogue sur {1}": "{0} catalog out of {1}",
    "avec la formule {0}.": "on the {0} plan.",
    "actuelle": "current",
    "La création d'un nouveau catalogue sera refusée.": "Creating a new catalog will be refused.",
    "Au-delà, la création sera refusée.": "Beyond that, creation will be refused.",
    "Impossible de charger vos catalogues pour le moment.": "Couldn't load your catalogs right now.",
    "Connexion…": "Signing in…",
    "Ce compte n'a pas encore de clé API associée. Contactez le support.": "This account doesn't have an API key yet. Contact support.",
    "Se connecter": "Sign in",
    "Création…": "Creating…",
    "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.": "If an account exists with this email, a reset link was just sent.",
    "Réinitialisation…": "Resetting…",
    "Mot de passe mis à jour — vous pouvez vous connecter.": "Password updated — you can sign in now.",
    "Vous rejoignez l'équipe de {0} ({1}).": "You're joining {0}'s team ({1}).",
    "Invitation pour {0}.": "Invitation for {0}.",
    "Ce lien d'invitation semble invalide ou expiré.": "This invitation link looks invalid or expired.",

    // ------------------------------------------------ pavé d'import (CSV/XML)
    "Importer un fichier": "Import a file",
    "Trois choses à savoir avant votre premier import": "Three things to know before your first import",
    "L'identifiant est ce qui compte le plus.": "The identifier matters most.",
    "C'est lui qui permet de mettre à jour un produit au lieu d'en créer un doublon. Réimporter le même fichier ne duplique rien.":
      "It's what lets a product be updated instead of duplicated. Re-importing the same file duplicates nothing.",
    "Utilisez le même identifiant partout.": "Use the same identifier everywhere.",
    "Si votre site envoie des références produit au tracker de conversion, indexez avec ces mêmes références — sinon vos analyses de ventes resteront vides.":
      "If your site sends product references to the conversion tracker, index with those same references — otherwise your sales analytics will stay empty.",
    "Le pack de règles se choisit avant.": "The rule pack is chosen up front.",
    "Nous l'analysons depuis votre fichier et le présélectionnons. Le changer après coup impose de réimporter.":
      "We analyze it from your file and preselect it. Changing it afterward requires re-importing.",
    "Déposez l'export de votre ERP ou de votre PIM, en CSV ou en XML. Nous détectons la structure et proposons une correspondance de champs — que vous pouvez corriger avant d'envoyer.":
      "Drop your ERP or PIM export, in CSV or XML. We detect the structure and suggest a field match — which you can correct before sending.",
    "Choisir un fichier": "Choose a file",
    "ou glissez-le ici — CSV ou XML, jusqu'à 100 000 lignes": "or drop it here — CSV or XML, up to 100,000 rows",
    "Correspondance des champs": "Field matching",
    "Vérifiez chaque champ. <strong>Seul l'identifiant est obligatoire</strong> : c'est lui qui permet de mettre à jour un produit au lieu d'en créer un doublon.":
      "Check each field. <strong>Only the identifier is required</strong>: it's what lets a product be updated instead of duplicated.",
    "Nom du catalogue": "Catalog name",
    "Sans espaces ni accents — il apparaîtra dans vos URL d'API.": "No spaces or accents — it will appear in your API URLs.",

    // ------------------------------------------------ import XML (gabarits T())
    "{0} éléments <{1}> détectés": "{0} <{1}> elements detected",
    "aucune structure répétée trouvée": "no repeated structure found",
    "Élément ou attribut": "Element or attribute",
    "Aucune structure répétée reconnue dans ce fichier.": "No repeated structure recognized in this file.",
    "Un import attend un élément qui se répète une fois par produit — vérifiez qu'il s'agit bien d'un catalogue.":
      "An import expects an element that repeats once per product — check that this is really a catalog.",
    "Identifiant plateforme": "Platform identifier",
    "Désignation": "Name",
    "Séparées par > | ou /": "Separated by > | or /",
    "Obligatoire. Permet de mettre à jour un produit au lieu d'en créer un doublon.": "Required. Lets a product be updated instead of duplicated.",
    "L'entier attendu par PrestaShop, WooCommerce ou Magento, si vos identifiants sont des références métier.":
      "The integer expected by PrestaShop, WooCommerce, or Magento, if your identifiers are business references.",
    "Le champ le plus fortement pondéré à la recherche.": "The most heavily weighted field for search.",
    "— packs indisponibles, rechargez la page —": "— packs unavailable, reload the page —",
    "{0} lignes, {1} colonnes": "{0} rows, {1} columns",
    "Séparateur : {0}": "Separator: {0}",
    "Encodage : {0}": "Encoding: {0}",
    "Champ Heurix": "Heurix field",
    "Colonne du fichier": "File column",
    "Exemples": "Examples",
    "— ignorer —": "— ignore —",
    "colonne {0}": "column {0}",
    "requis": "required",
    "Colonne Identifiant non choisie.": "Identifier column not chosen.",
    "Sans elle, aucun produit ne peut être importé — et un second import créerait des doublons au lieu de mettre à jour.":
      "Without it, no product can be imported — and a second import would create duplicates instead of updating.",
    "{0}% des lignes testées seraient ignorées.": "{0}% of tested rows would be ignored.",
    "La colonne Identifiant ne semble pas la bonne — vérifiez qu'elle contient bien une référence unique par produit.":
      "The Identifier column doesn't look right — check that it contains a unique reference per product.",
    "{0} produits sur {1} lignes testées.": "{0} products out of {1} tested rows.",
    "{0} ligne(s) seraient ignorées — c'est normal si votre export contient des lignes vides ou des doublons.":
      "{0} row(s) would be ignored — normal if your export contains blank rows or duplicates.",
    "La correspondance semble correcte.": "The match looks correct.",
    "Analyse du contenu…": "Analyzing content…",
    "Aucun pack ne se détache": "No pack stands out",
    "sur cet échantillon. Vous pouvez importer sans pack : la recherche fonctionnera sur les mots, sans reconnaissance de structure.":
      "on this sample. You can import without a pack: search will work on words, with no structure recognition.",
    "Pack recommandé : {0}": "Recommended pack: {0}",
    "{0} produits sur {1} reconnus.": "{0} products out of {1} recognized.",
    "Sélectionné automatiquement. Vous pouvez le changer ci-dessous.": "Automatically selected. You can change it below.",
    "Indiquez le nom du catalogue.": "Enter the catalog name.",
    "La colonne Identifiant est obligatoire : sans elle, un second import créerait des doublons au lieu de mettre à jour.":
      "The Identifier column is required: without it, a second import would create duplicates instead of updating.",
    "Aucun produit exploitable — vérifiez la correspondance.": "No usable products — check the column matching.",
    "clé API refusée. Rechargez la console : votre session a peut-être expiré.": "API key rejected. Reload the console: your session may have expired.",
    "Lot {0} sur {1} : {2}": "Batch {0} of {1}: {2}",
    "Terminé — {0} produits indexés": "Done — {0} products indexed",
    "Envoi du lot {0} sur {1} — {2} produits indexés": "Sending batch {0} of {1} — {2} products indexed",
    "{0} produits indexés.": "{0} products indexed.",
    "{0} lot(s) en échec.": "{0} batch(es) failed.",
    "Relancez l'import : les identifiants étant stables, les produits déjà indexés seront mis à jour, pas dupliqués.":
      "Restart the import: since identifiers are stable, products already indexed will be updated, not duplicated.",
    "{0} ligne(s) ignorée(s) :": "{0} row(s) ignored:",
    "Ligne {0} — {1}": "Row {0} — {1}",
    "… et {0} autres": "… and {0} more",
    "Voir le catalogue &rarr;": "See the catalog &rarr;",
    "Créer la règle": "Create rule",
    "Compris": "Got it",
    "Aucun catalogue": "No catalog",
    "bac à sable": "sandbox",

    // --------------------------------------------- audit UX console (17 aout 2026)
    // Lot 0 a lexique unifie -- nouvelles chaines apparues au fil de ce
    // chantier, jamais dans DICT jusqu'ici (verifie avec un vrai script
    // de comparaison, 30 manquantes exactement sur 224 templates T()).
    "Ajout au brouillon…": "Adding to draft…",
    "Ajouter une reconnaissance": "Add a recognition",
    "Ajoutée au brouillon — publiez pour l'appliquer.": "Added to the draft — publish to apply it.",
    "Aucun produit ne correspond.": "No matching product.",
    "Aucune reconnaissance personnalisée pour l'instant.": "No custom recognition yet.",
    "Créer cette reconnaissance": "Create this recognition",
    "Créer la reconnaissance": "Create the recognition",
    "En stock": "In stock",
    "Favorisé": "Favored",
    "Modifier la reconnaissance": "Edit the recognition",
    "Nom de la reconnaissance, ex. Cheville": "Recognition name, e.g. Anchor",
    "Reconnaissance personnalisée enregistrée.": "Custom recognition saved.",
    "Reconnaissances": "Recognitions",
    "Reconnaître un mot métier": "Recognize a business term",
    "Reconnaître une référence (ex. M8, DN20)": "Recognize a reference (e.g. M8, DN20)",
    "Relégué en fin de liste": "Buried at the end of the list",
    "Retirer cette reconnaissance": "Remove this recognition",
    "Retirer l'épingle": "Remove the pin",
    "Retirer l'épingle de {0}": "Remove the pin from {0}",
    "Règle supprimée.": "Rule deleted.",
    "Supprimer cette règle": "Delete this rule",
    "Supprimer le catalogue <strong>{0}</strong> et ses {1} produits ?<br>Les règles, reconnaissances personnalisées et synonymes seront perdus. <strong>Cette action est irréversible.</strong>": "Delete the catalog <strong>{0}</strong> and its {1} products?<br>Rules, custom recognitions and synonyms will be lost. <strong>This action is irreversible.</strong>",
    "Sur la catégorie « {0} »": "On category \u201c{0}\u201d",
    "Sur la recherche « {0} »": "On search \u201c{0}\u201d",
    "Synonymes et reconnaissances personnalisées": "Synonyms and custom recognitions",
    "Toutes les modifications ont été annulées.": "All changes have been undone.",
    "classement en brouillon": "ranking in draft",
    "sur cet échantillon. Vos produits ne bénéficient d'aucune annotation — vérifiez que le pack correspond bien à votre secteur, ou créez des reconnaissances personnalisées.": "on this sample. Your products have no annotations — check that the pack matches your sector, or create custom recognitions.",
    "Échec de l'ajout au brouillon.": "Failed to add to the draft.",
    "Épinglé en position {0}": "Pinned at position {0}",

    // --------------------------------------------- etat zero resultat actionnable + rattrapage lexique volet 2
    "Aucun produit ne sort sur « {0} »": "No product matches \u201c{0}\u201d",
    "Ce catalogue ne contient aucun produit.": "This catalog has no products.",
    "Cette recherche est un cul-de-sac pour vos visiteurs.": "This search is a dead end for your visitors.",
    "Créer un synonyme": "Create a synonym",
    "Dupliquer une règle — modifiez au moins un champ": "Duplicate a rule — change at least one field",
    "Entrez un mot.": "Enter a word.",
    "Rapprocher <strong>{0}</strong> de :": "Link <strong>{0}</strong> to:",
    "ex. plaque de plâtre": "e.g. drywall",
    "pour épingler ou reléguer : une règle se déclenche sur une recherche précise, elle n'existe pas en dehors d'une requête.": "to pin or bury: a rule triggers on a specific search, it doesn't exist outside a query.",
    "Échec de la création.": "Creation failed.",
    "Épingler un produit": "Pin a product",

    "Sélectionnez un produit dans la liste des suggestions.": "Select a product from the suggestion list.",

    "Ce produit est en rupture : il n'apparaîtra pas si votre boutique masque les ruptures.": "This product is out of stock: it won't appear if your store hides out-of-stock items.",
    "La position {0} est déjà réservée à « {1} ». Choisissez une autre position, ou l'ancienne règle sera remplacée.": "Position {0} is already taken by \u201c{1}\u201d. Choose another position, or the existing rule will be replaced.",
    "Active": "Active",
    "Épinglé pos. {0}": "Pinned pos. {0}",
    "pos. {0}": "pos. {0}",
  };

  // Attributs porteurs de texte visible ou annoncé aux lecteurs d'écran.
  var ATTRIBUTS = ["title", "aria-label", "placeholder", "alt"];

  // Chemin 1 — noeud de texte STATIQUE entier (TreeWalker). Correspondance
  // exacte sur la chaîne entière, sans variable : c'est ce que produit du
  // HTML écrit à la main.
  function traduire(s) {
    if (!EN || !s) return s;
    var net = s.trim();
    if (!net) return s;
    var trad = DICT[net];
    if (!trad) return s;
    // On préserve les espaces d'origine autour du texte : les retirer
    // collerait des mots dans certains gabarits.
    return s.replace(net, trad);
  }

  // Chemin 2 — GABARIT avec variables, appelé depuis console.js.
  //
  //   T("Invitation envoyée à {0}.", email)
  //
  // Le gabarit lui-même (avant substitution) est la clé du dictionnaire —
  // jamais la chaîne finale, qui varie à chaque appel et ne pourrait donc
  // jamais correspondre à une entrée fixe.
  //
  // Fonctionne aussi en français : la substitution a toujours lieu, seule
  // la traduction du gabarit dépend de la langue. `T("Ajouté.")` sans
  // argument est donc un appel valide, équivalent à `traduire()` mais
  // explicite dans le code source plutôt qu'implicite dans le DOM.
  function T(gabarit) {
    var args = Array.prototype.slice.call(arguments, 1);
    var texte = EN ? (Object.prototype.hasOwnProperty.call(DICT, gabarit) ? DICT[gabarit] : gabarit) : gabarit;
    for (var i = 0; i < args.length; i++) {
      // split/join plutôt que replace : un identifiant produit contenant
      // "{0}" par coïncidence ne doit pas casser un remplacement suivant.
      texte = texte.split("{" + i + "}").join(args[i] === undefined || args[i] === null ? "" : args[i]);
    }
    return texte;
  }
  window.T = T;

  function parcourir(racine) {
    if (!EN) return;
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

  function lancer() {
    if (!EN) return;
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
