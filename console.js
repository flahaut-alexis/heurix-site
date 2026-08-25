// Heurix — Console client (source unique FR/EN)
// Se connecte avec une vraie clé API et appelle le vrai moteur en
// production (https://api.heurix.fr) — aucune donnée simulée ici,
// contrairement au widget de démonstration de la page d'accueil.
//
// TRADUCTION : chaque chaîne visible passe par T(gabarit, ...valeurs),
// fourni par console-i18n.js (chargé avant ce fichier). Sur une page
// française, T() ne fait que la substitution des valeurs ; sur une page
// anglaise, il traduit le gabarit via son dictionnaire avant de substituer.
// Voir console-i18n.js pour le mécanisme complet.
(function () {
  "use strict";

  var API_BASE = "https://api.heurix.fr";
  var SESSION_STORAGE_KEY = "heurix_console_session";

  // LANGUE ET LOCALE. Lues ici aussi (pas seulement dans console-i18n.js) :
  // les formats de date et de nombre (toLocaleString) sont un besoin propre
  // à ce fichier, indépendant du mécanisme de traduction de texte.
  var LANGUE_EN = (document.documentElement.lang || "fr").slice(0, 2).toLowerCase() === "en";
  var LOCALE = LANGUE_EN ? "en-US" : "fr-FR";

  var L = {
    loading: T("Chargement des données…"),
    loginErrorInvalid: T("Email ou mot de passe incorrect."),
    loginErrorNetwork: T("Impossible de joindre api.heurix.fr. Le service est peut-être temporairement indisponible."),
    zeroRate: function (n) { return Math.round(n * 100) + "%"; },
    dashTitle: function (label) { return label ? T("Bonjour, {0}", label) : T("Tableau de bord"); },
    when: function (iso) {
      try {
        var d = new Date(iso);
        return d.toLocaleDateString(LOCALE, { day: "numeric", month: "short" }) + " " + T("à") + " " +
               d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
      } catch (e) { return iso; }
    }
  };

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  // Correctif B2 (audit UX console, 17 aout 2026) : plusieurs libelles
  // fixes contiennent une vraie apostrophe francaise ("Monter d'une
  // place", "Retirer l'epinglage") -- inseres tels quels dans des
  // attributs title='...' entre guillemets SIMPLES, jamais echappes.
  // Le navigateur interprete l'apostrophe comme la fin de l'attribut :
  // title='Monter d'une place' devient title="Monter d", suivi de
  // "une place'" qui flotte comme du texte HTML invalide -- exactement
  // le titre tronque "Monter d" signale dans l'audit. esc() existante
  // n'echappe pas l'apostrophe (elle protege &/< uniquement, pas les
  // attributs entre guillemets simples) -- fonction dediee plutot que
  // modifier esc() globalement, pour ne rien risquer sur ses autres
  // usages deja en place ailleurs dans ce fichier.
  function escAttr(s) { return esc(s).replace(/'/g, "&#39;"); }

  // Chantier highlighting (16 aout 2026). Fusionne des empans qui se
  // chevauchent partiellement (ex. "M8X" et "M8X20" sur la meme
  // reference, tres courant : plusieurs regles peuvent matcher des
  // fragments imbriques du meme terme) -- deja tries par position cote
  // serveur, donc un seul passage suffit.
  function fusionnerEmpans(empans) {
    if (!empans || empans.length < 2) return empans || [];
    var fusionnes = [empans[0].slice()];
    for (var i = 1; i < empans.length; i++) {
      var dernier = fusionnes[fusionnes.length - 1];
      var courant = empans[i];
      if (courant[0] <= dernier[1]) {
        dernier[1] = Math.max(dernier[1], courant[1]);
      } else {
        fusionnes.push(courant.slice());
      }
    }
    return fusionnes;
  }

  // Positions en CODEPOINTS Unicode (coherent avec l'API, cote Rust) --
  // Array.from() itere par codepoint, pas par unite UTF-16 comme le
  // ferait un simple texte[i]. Identique pour la quasi-totalite des
  // titres produits reels ; un emoji ou caractere hors plan de base
  // introduirait un decalage, non gere ici.
  function surlignerTexte(texte, empans) {
    if (!texte) return "";
    if (!empans || !empans.length) return esc(texte);

    var empansFusionnes = fusionnerEmpans(empans);
    var caracteres = Array.from(texte);
    var resultat = "";
    var curseur = 0;

    empansFusionnes.forEach(function (empan) {
      var debut = empan[0], fin = empan[1];
      if (debut < curseur || fin > caracteres.length || debut >= fin) return;
      resultat += esc(caracteres.slice(curseur, debut).join(""));
      resultat += "<mark>" + esc(caracteres.slice(debut, fin).join("")) + "</mark>";
      curseur = fin;
    });
    resultat += esc(caracteres.slice(curseur).join(""));
    return resultat;
  }

  function apiFetch(path, token, options) {
    options = options || {};
    var headers = { Authorization: "Bearer " + token };
    if (options.body) headers["Content-Type"] = "application/json";
    return fetch(API_BASE + path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var err = new Error(data.detail || ("HTTP " + r.status));
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  function apiPost(path, body) {
    return fetch(API_BASE + path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var err = new Error(data.detail || ("HTTP " + r.status));
          err.status = r.status;
          throw err;
        }
        return data;
      });
    });
  }

  var authTitle = document.getElementById("auth-title");
  var authLede = document.getElementById("auth-lede");
  var loginScreen = document.getElementById("login-screen");
  var dashboard = document.getElementById("dashboard");

  var loginForm = document.getElementById("login-form");
  var loginEmail = document.getElementById("login-email");
  var loginPassword = document.getElementById("login-password");
  var loginError = document.getElementById("login-error");
  var loginBtn = document.getElementById("login-btn");

  var signupForm = document.getElementById("signup-form");
  var signupRaisonSociale = document.getElementById("signup-raison-sociale");
  var signupEmail = document.getElementById("signup-email");
  var signupPassword = document.getElementById("signup-password");
  var signupTva = document.getElementById("signup-tva");
  var signupError = document.getElementById("signup-error");
  var signupBtn = document.getElementById("signup-btn");

  var acceptInviteForm = document.getElementById("accept-invite-form");
  var acceptInviteIntro = document.getElementById("accept-invite-intro");
  var acceptInvitePassword = document.getElementById("accept-invite-password");
  var acceptInviteError = document.getElementById("accept-invite-error");
  var acceptInviteBtn = document.getElementById("accept-invite-btn");


  var resetRequestForm = document.getElementById("reset-request-form");
  var resetEmail = document.getElementById("reset-email");
  var resetRequestBtn = document.getElementById("reset-request-btn");
  var resetRequestMsg = document.getElementById("reset-request-msg");

  var resetConfirmForm = document.getElementById("reset-confirm-form");
  var resetNewPassword = document.getElementById("reset-new-password");
  var resetConfirmBtn = document.getElementById("reset-confirm-btn");
  var resetConfirmError = document.getElementById("reset-confirm-error");

  var showSignupLink = document.getElementById("show-signup");
  var showResetLink = document.getElementById("show-reset");
  var showLoginLink = document.getElementById("show-login");
  var authLinks = document.getElementById("auth-links");
  var authBack = document.getElementById("auth-back");

  var logoutBtn = document.getElementById("logout-btn");
  var periodSelect = document.getElementById("period-select");
  var dashLoading = document.getElementById("dash-loading");
  var dashContent = document.getElementById("dash-content");
  var chart = null;

  var AUTH_FORMS = [loginForm, signupForm, resetRequestForm, resetConfirmForm, acceptInviteForm];
  var AUTH_COPY = {
    "login": [T("Votre tableau de bord."), T("Mots les plus recherchés, recherches sans résultat, erreurs récentes, consommation — connectez-vous pour les consulter.")],
    "signup": [T("Votre clé API, en moins d'une minute."), T("Une entreprise, un email, un mot de passe — la clé est générée immédiatement, affichée ici et envoyée par email.")],
    "reset-request": [T("Mot de passe oublié ?"), T("Indiquez votre email, on vous envoie un lien pour en choisir un nouveau.")],
    "reset-confirm": [T("Nouveau mot de passe."), T("Choisissez un nouveau mot de passe pour votre compte.")],
    "accept-invite": [T("Rejoindre votre équipe."), T("Dernière étape : choisissez votre mot de passe.")]
  };
  function setAuthMode(mode) {
    AUTH_FORMS.forEach(function (f) { f.hidden = true; });
    loginError.hidden = true; signupError.hidden = true; resetConfirmError.hidden = true;
    resetRequestMsg.hidden = true; acceptInviteError.hidden = true;
    if (mode === "login") { loginForm.hidden = false; authLinks.hidden = false; authBack.hidden = true; }
    if (mode === "signup") { signupForm.hidden = false; authLinks.hidden = false; authBack.hidden = true; }
    if (mode === "reset-request") { resetRequestForm.hidden = false; authLinks.hidden = true; authBack.hidden = false; }
    if (mode === "reset-confirm") { resetConfirmForm.hidden = false; authLinks.hidden = true; authBack.hidden = true; }
    if (mode === "accept-invite") { acceptInviteForm.hidden = false; authLinks.hidden = true; authBack.hidden = true; }
    var copy = AUTH_COPY[mode];
    if (copy) { authTitle.textContent = copy[0]; authLede.textContent = copy[1]; }
  }


  function showLogin(message) {
    dashboard.hidden = true;
    loginScreen.hidden = false;
    logoutBtn.hidden = true;
    if (message) {
      loginError.textContent = message;
      loginError.hidden = false;
    }
  }

  function showDashboard() {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    logoutBtn.hidden = false;
  }

  // ---------------- Tendances sur les indicateurs (audit UX, point 6) ----------------
  //
  // Un chiffre seul ne dit pas si la situation s'ameliore : 42 recherches sans
  // resultat est bon ou mauvais selon qu'on en avait 20 ou 200 le mois d'avant.
  //
  // LE SENS DE LA VARIATION N'EST PAS LE SENS DE LA COULEUR. Plus de
  // recherches est bon ; plus d'erreurs est mauvais ; plus de recherches sans
  // resultat est mauvais. Un vert automatique sur toute hausse serait
  // trompeur -- c'est le piege de ce genre d'affichage.
  var SENS_TENDANCE = {
    "searches": "hausse_bonne",
    "usage": "neutre",            // consommer son quota n'est ni bon ni mauvais
    "zero-rate": "hausse_mauvaise",
    "errors": "hausse_mauvaise",
    // Chantier "segmentation" (7 aout 2026).
    "seg-total": "neutre",        // plus de visiteurs actifs n'est ni bon ni mauvais en soi
    "seg-fort": "hausse_bonne",
    "seg-moyen": "neutre",
    "seg-faible": "hausse_mauvaise",
  };

  function afficherTendances(comparaison, correspondancePersonnalisee) {
    if (!comparaison || !comparaison.variations) return;
    var v = comparaison.variations;
    // Chantier "segmentation" (7 aout 2026) : un second appelant (la
    // segmentation) a une forme de variations differente (total_visiteurs/
    // fort/moyen/faible, pas recherches/zero-rate/...) -- parametrable
    // plutot que duplique, le reste de la fonction (garde-fous null,
    // seuil "stable", rendu) reste identique pour les deux.
    var correspondance = correspondancePersonnalisee || {
      "searches": v.recherches,
      "zero-rate": v.taux_sans_resultat,
      "errors": v.erreurs,
      "usage": v.recherches,
    };

    Object.keys(correspondance).forEach(function (cle) {
      var el = document.getElementById("trend-" + cle);
      if (!el) return;
      var pct = correspondance[cle];

      // None cote moteur : la periode precedente etait vide. On n'affiche
      // rien plutot qu'un « +100 % » qui serait un demarrage, pas une
      // progression.
      // Correctif (24 aout 2026, signale par Alexis). Une variation nulle
      // etait MASQUEE en silence. L'API renvoie null quand la periode
      // precedente est vide -- une variation depuis zero n'a pas de sens
      // mathematique, et c'est le bon choix cote serveur.
      //
      // Mais cote marchand, la tendance disparaissait sans explication.
      // Le cas est loin d'etre rare : il est SYSTEMATIQUE chez un nouveau
      // client, dont la periode precedente est toujours vide, et sur tout
      // catalogue recemment cree.
      //
      // Dire pourquoi vaut mieux que ne rien dire : le marchand comprend
      // qu'il manque un historique, pas que l'outil a un defaut.
      if (pct === null || pct === undefined) {
        // SUR LA SEGMENTATION, on masque -- comportement d'origine, exige
        // par un test dont le nom porte la decision : « la tendance reste
        // masquee, jamais un pourcentage trompeur ». Quatre tuiles de
        // repartition portant chacune la meme phrase surchargeraient un
        // ecran deja dense.
        //
        // Sur les grands indicateurs du tableau de bord, en revanche, la
        // tendance disparaissait sans explication -- et le cas est
        // systematique chez un nouveau client. On dit pourquoi.
        //
        // Le discriminant est le second parametre : la segmentation passe
        // une correspondance personnalisee, le tableau de bord non.
        if (correspondancePersonnalisee) { el.hidden = true; return; }
        el.hidden = false;
        el.className = "kpi-tendance kpi-tendance-neutre";
        el.textContent = T("pas d'historique sur la période précédente");
        return;
      }
      if (Math.abs(pct) < 1) {
        el.hidden = false;
        el.className = "kpi-tendance kpi-tendance-stable";
        el.textContent = "stable";
        return;
      }

      var hausse = pct > 0;
      var sens = SENS_TENDANCE[cle] || "neutre";
      var couleur = sens === "neutre" ? "neutre"
        : (hausse === (sens === "hausse_bonne") ? "bonne" : "mauvaise");

      el.hidden = false;
      el.className = "kpi-tendance kpi-tendance-" + couleur;
      el.innerHTML = (hausse ? "&#9650;" : "&#9660;") + " " +
        Math.abs(pct).toLocaleString(LOCALE) + "&nbsp;%" +
        "<span class='kpi-tendance-ref'>" + T("vs période précédente") + "</span>";
    });
  }

  function renderStats(summary, usage) {
    document.getElementById("stat-searches").textContent = summary.total_searches.toLocaleString(LOCALE);
    document.getElementById("stat-zero-rate").textContent = L.zeroRate(summary.zero_result_rate);
    // Correctif (20 aout 2026, audit passe 3 §6). summary.total_errors
    // compte TOUT, y compris les 401 provoques par des robots -- d'ou
    // "58 Erreurs" ici quand la page Erreurs annoncait "0 a traiter".
    // Valeur de repli seulement : majKpiErreurs() la remplace des que la
    // liste detaillee arrive, en appliquant la meme regle de partage que
    // la page (CODES_ACTIONNABLES), pour ne pas dupliquer cette regle.
    document.getElementById("stat-errors").textContent = summary.total_errors.toLocaleString(LOCALE);
    document.getElementById("stat-usage").textContent = usage.requests.toLocaleString(LOCALE);
    // La comparaison est un appel distinct : elle ne doit pas retarder
    // l'affichage des chiffres principaux.
    if (typeof session.activeKey !== "undefined" && session.activeKey) {
      var jours = (document.getElementById("period-select") || {}).value || 30;
      apiFetch("/v1/analytics/comparison?days=" + jours + catalogueQS(), session.activeKey)
        .then(afficherTendances)
        .catch(function () { /* les tendances sont un bonus */ });
    }

    var emailEl = document.getElementById("account-email");
    // L'etiquette « Espace client » porte deja le contexte : repeter
    // « Connecte en tant que » serait redondant a cote.
    emailEl.textContent = usage.account_email || "—";
  }

  var keyDisplayWired = false;
  // ---------------- Cles publiques (chantier securite C1) ----------------
  var publicKeysWired = false;

  function refreshPublicKeys(key) {
    apiFetch("/v1/keys/public", key)
      .then(function (data) {
        renderTable("public-keys-table", "public-keys-empty", data.keys, function (k) {
          return "<td class='mono' style='word-break:break-all;'>" + esc(k.key) + "</td>" +
            "<td>" + (k.allowed_origins ? esc(k.allowed_origins) : "<span style='color:var(--ink-muted);'>" + T("tous") + "</span>") + "</td>" +
            "<td><button type='button' class='catalog-rule-remove' data-revoke-key='" + esc(k.key) + "' aria-label='" + T("Révoquer") + "'>&times;</button></td>";
        });
      })
      .catch(function () {});
  }

  function wirePublicKeys(key) {
    if (publicKeysWired) return;
    publicKeysWired = true;

    document.getElementById("public-key-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var status = document.getElementById("public-key-status");
      var origins = document.getElementById("public-key-origins").value.trim();
      status.textContent = T("Génération…"); status.className = "catalog-rule-status";
      apiFetch("/v1/keys/public", key, { method: "POST", body: { allowed_origins: origins || null } })
        .then(function () {
          status.textContent = T("Clé publique générée."); status.className = "catalog-rule-status ok";
          document.getElementById("public-key-origins").value = "";
          refreshPublicKeys(key);
          // Chantier onboarding (8 août 2026) : refreshPublicKeys() rafraîchit
          // le tableau, mais la puce "Générez une clé publique" de la carte
          // d'activation dépend de majCarteActivation() -- jamais rappelée
          // ici avant ce correctif, donc la puce restait "en attente" malgré
          // une génération réussie, jusqu'au prochain rechargement de page.
          apiFetch("/v1/usage", key).then(function (usage) { majCarteActivation(usage, key); });
        })
        .catch(function (err) {
          status.textContent = (err && err.message) || T("Échec de la génération.");
          status.className = "catalog-rule-status err";
        });
    });

    document.querySelector("#public-keys-table tbody").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-revoke-key]");
      if (!btn) return;
      var cleVisee = btn.getAttribute("data-revoke-key");
      confirmerSuppression(
        T("Révoquer la clé publique <strong>{0}…</strong> ?<br>Si elle est utilisée sur votre site, la recherche cessera de fonctionner immédiatement pour vos visiteurs.", esc(cleVisee.slice(0, 12))),
        btn,
        function () {
          btn.disabled = true;
          apiFetch("/v1/keys/public/" + encodeURIComponent(cleVisee), key, { method: "DELETE" })
            .then(function () { refreshPublicKeys(key); })
            .catch(function () { btn.disabled = false; });
        }
      );
    });

    refreshPublicKeys(key);
  }

  // ---------------- Export CSV des tableaux Observer ----------------
  //
  // Lit directement le DOM du tableau deja rendu (pas un second appel API) :
  // les donnees affichees et exportees sont donc toujours identiques, aucun
  // risque de decalage entre les deux.
  function echapperCSV(valeur) {
    var v = String(valeur == null ? "" : valeur);
    if (/[",\r\n]/.test(v)) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  }

  // Brief §4.5 (19 aout 2026) : "compteur dans chaque onglet". Meme
  // format compact que le badge deja en place sur "Regles du catalogue"
  // (verifie avant d'ecrire), masque a zero plutot qu'affichant "(0)" --
  // un onglet vide n'a pas besoin d'etre souligne.
  function majCompteurOnglet(idBadge, n) {
    var badge = document.getElementById(idBadge);
    if (!badge) return;
    badge.hidden = !n;
    badge.textContent = n ? "(" + n + ")" : "";
  }

  function exporterTableauCSV(tableId, nomFichier) {
    var table = document.getElementById(tableId);
    if (!table) return;
    var lignes = [];
    // Correctif (19 aout 2026, defaut revele par la suite de tests en
    // ajoutant une colonne d'action au tableau des recherches
    // populaires) : une colonne SANS TITRE ne porte que des boutons,
    // jamais de donnee -- l'inclure ajoutait une virgule orpheline en
    // fin d'en-tetes. On releve les index a garder une seule fois, et on
    // les applique aussi aux lignes pour que tout reste aligne.
    var tousTh = Array.prototype.slice.call(table.querySelectorAll("thead th"));
    var indexUtiles = [];
    var entetes = [];
    tousTh.forEach(function (th, i) {
      var titre = th.textContent.trim();
      if (!titre) return;
      indexUtiles.push(i);
      entetes.push(titre);
    });
    lignes.push(entetes);
    Array.prototype.forEach.call(table.querySelectorAll("tbody tr"), function (tr) {
      var tds = Array.prototype.slice.call(tr.querySelectorAll("td"));
      var cellules = indexUtiles.map(function (i) {
        var td = tds[i];
        if (!td) return "";
        // Retire boutons/actions (ex: "Corriger" sur zero-results) -- ne
        // garde que le texte utile pour l'export.
        var clone = td.cloneNode(true);
        Array.prototype.forEach.call(clone.querySelectorAll("button, .zr-suggestions"), function (n) { n.remove(); });
        return clone.textContent.trim();
      });
      lignes.push(cellules);
    });
    var csv = lignes.map(function (ligne) {
      return ligne.map(echapperCSV).join(",");
    }).join("\r\n");
    // BOM UTF-8 : Excel sous Windows detecte mal l'encodage sans lui,
    // les caracteres accentues s'affichent alors casses.
    var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = nomFichier + "-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function wireExportsCSV() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-export-table]"), function (btn) {
      btn.addEventListener("click", function () {
        exporterTableauCSV(btn.getAttribute("data-export-table"), btn.getAttribute("data-export-nom"));
      });
    });
  }

  // ---------------- Produits les plus vus (Analytics > Ranking) ----------------
  // C1 (25 aout 2026). wireCategoryViews melangeait CABLAGE et CHARGEMENT,
  // et etait appelee depuis DEUX chemins -- loadDashboard et
  // appliquerCatalogue -- sans aucune garde. Chaque passage ajoutait un
  // ecouteur "change" de plus sur #cv-catalog, element permanent : six
  // ecouteurs mesures apres un scenario ordinaire, donc six appels reseau
  // pour un seul changement de selection.
  //
  // Scindee en trois : cvCharger (le rendu, rejouable), cablerVuesCategories
  // (l'ecouteur, une seule fois) et chargerVuesCategories (le peuplement du
  // selecteur, rejouable).
  function cvCharger(key) {
    var select = document.getElementById("cv-catalog");
    var contenu = document.getElementById("cv-content");
    var vide = document.getElementById("cv-empty");
    if (!select || !contenu || !vide) return;
    var catalogue = select.value;
    if (!catalogue) return;
      contenu.innerHTML = "<p class='console-panel-note'>" + T("Chargement…") + "</p>";
      vide.hidden = true;
      apiFetch("/v1/analytics/category-views/" + encodeURIComponent(catalogue), key)
        .then(function (data) {
          var cats = data.categories || [];
          // Brief §4.5 : compteur d'onglet. Ici le contenu n'est pas un
          // tableau plat mais un regroupement par categorie -- on compte
          // les CATEGORIES remontees, l'unite que l'ecran affiche.
          majCompteurOnglet("obs-tab-vus-count", cats.length);
          if (!cats.length) {
            contenu.innerHTML = "";
            vide.hidden = false;
            return;
          }
          contenu.innerHTML = cats.map(function (cat) {
            var lignes = cat.products.map(function (p) {
              // Le ratio clics/vues est l'information utile : c'est lui qui
              // designe les produits a epingler ou a releguer.
              var ratio = p.views ? Math.round((p.search_clicks / p.views) * 100) : 0;
              return "<tr><td>" + produitCell(p.product_id, p.name, p.price) + "</td>" +
                "<td class='num'>" + p.views + "</td><td class='num'>" + p.search_clicks + "</td>" +
                "<td class='num'>" + ratio + "%</td></tr>";
            }).join("");
            return "<h2 style='margin-top:22px;'>" + esc(cat.category) +
              " <span style='font-weight:400; color:var(--ink-muted); font-size:13px;'>— " +
              T("{0} impressions", cat.total_views) + "</span></h2>" +
              "<div class='table-scroll'><table class='console-table'>" +
              "<thead><tr><th>" + T("Produit") + "</th><th>" + T("Vues") + "</th><th>" + T("Clics recherche") + "</th><th>" + T("Ratio") + "</th></tr></thead>" +
              "<tbody>" + lignes + "</tbody></table></div>";
          }).join("");
        })
        .catch(function () {
          contenu.innerHTML = "";
          vide.hidden = false;
        });
  }

  function cablerVuesCategories(key) {
    var select = document.getElementById("cv-catalog");
    if (!select) return;
    select.addEventListener("change", function () { cvCharger(key); });
  }

  // `catalogues` : la reponse deja obtenue par resoudreCatalogueActif. Le
  // commentaire d'origine disait « les catalogues sont deja connus ailleurs
  // dans la console : on reutilise la meme source plutot que de refaire un
  // appel » -- l'intention etait bonne, l'appel repartait quand meme.
  // Elle est vraie maintenant. En l'absence d'argument, on redemande.
  function chargerVuesCategories(key, catalogues) {
    var select = document.getElementById("cv-catalog");
    if (!select) return;
    function peupler(data) {
      var noms = (data.catalogs || []).map(function (c) { return c.catalog; });
      select.innerHTML = noms.map(function (n) {
        return "<option value='" + esc(n) + "'>" + esc(n) + "</option>";
      }).join("");
      if (noms.length) cvCharger(key);
    }
    if (catalogues) { peupler(catalogues); return; }
    apiFetch("/v1/index/catalogs", key).then(peupler).catch(function () {});
  }

  // ---------------- Produits associés (Analytics > Ranking) ----------------
  //
  // Contrairement à category-views (une vue d'ensemble automatique), cette
  // section porte une SÉLECTION -- un produit choisi par recherche, pas un
  // catalogue dans un select. Réutilise donc le catalogue GLOBAL actif
  // (comme top-products, zero-results...) plutôt qu'un select dédié.
  var rpSearchTimer = null;

  function wireRelatedProducts(key) {
    var input = document.getElementById("rp-search");
    var resultsBox = document.getElementById("rp-search-results");
    if (!input || input.dataset.rpWired) return;
    input.dataset.rpWired = "1";

    input.addEventListener("input", function () {
      clearTimeout(rpSearchTimer);
      var q = input.value.trim();
      if (!q) { resultsBox.innerHTML = ""; return; }
      rpSearchTimer = setTimeout(function () { rpChercherProduits(key, q); }, 300);
    });

    resultsBox.addEventListener("click", function (e) {
      var item = e.target.closest("[data-rp-pid]");
      if (!item) return;
      rpChoisirProduit(
        key, item.getAttribute("data-rp-pid"), item.getAttribute("data-rp-name"),
        item.getAttribute("data-rp-price")
      );
    });
  }

  function rpChercherProduits(key, q) {
    var catalogue = catalogueCourant();
    var resultsBox = document.getElementById("rp-search-results");
    if (!catalogue) return;
    apiFetch("/v1/index/" + encodeURIComponent(catalogue) + "/search", key,
             { method: "POST", body: { q: q, limit: 8 } })
      .then(function (data) {
        var hits = data.hits || [];
        if (!hits.length) {
          resultsBox.innerHTML = "<p class='console-empty' style='margin:8px 0 0;'>" + T("Aucun produit ne correspond.") + "</p>";
          return;
        }
        resultsBox.innerHTML = "<div class='rp-search-list'>" + hits.map(function (h) {
          var p = h.product;
          var prix = p.price != null ? p.price : "";
          return "<button type='button' class='rp-search-result' data-rp-pid='" + esc(p.id) +
            "' data-rp-name='" + esc(p.name || "") + "' data-rp-price='" + prix + "'>" +
            produitCell(p.id, p.name, p.price) + "</button>";
        }).join("") + "</div>";
      })
      .catch(function () { resultsBox.innerHTML = ""; });
  }

  function rpChoisirProduit(key, pid, name, price) {
    var catalogue = catalogueCourant();
    document.getElementById("rp-search-results").innerHTML = "";
    document.getElementById("rp-search").value = name || pid;
    document.getElementById("rp-result-panel").hidden = false;
    document.getElementById("rp-chosen-product").innerHTML = produitCell(pid, name, price ? Number(price) : null);
    document.getElementById("rp-target-purchases").textContent = "…";
    document.getElementById("rp-related-empty").hidden = true;
    document.querySelector("#rp-related-table tbody").innerHTML = "";

    apiFetch("/v1/analytics/related-products/" + encodeURIComponent(catalogue) + "/" + encodeURIComponent(pid), key)
      .then(function (data) {
        document.getElementById("rp-target-purchases").textContent = data.target_purchases.toLocaleString(LOCALE);
        var tbody = document.querySelector("#rp-related-table tbody");
        var empty = document.getElementById("rp-related-empty");
        if (!data.related.length) {
          empty.hidden = false;
          return;
        }
        tbody.innerHTML = data.related.map(function (r) {
          var pct = data.target_purchases ? Math.round((r.co_purchases / data.target_purchases) * 100) : 0;
          return "<tr><td>" + produitCell(r.product_id, r.name, r.price) + "</td>" +
            "<td class='num' style='font-weight:700;'>" + r.co_purchases + "</td>" +
            "<td class='num'>" + pct + "%</td></tr>";
        }).join("");
      })
      .catch(function () {});
  }

  function rpReinitialiser() {
    var input = document.getElementById("rp-search");
    if (!input) return;
    input.value = "";
    document.getElementById("rp-search-results").innerHTML = "";
    document.getElementById("rp-result-panel").hidden = true;
  }

  // ---------------- Segmentation (Analytics > Visiteurs) ----------------
  function chargerSegmentation(key) {
    var catalogue = catalogueCourant();
    if (!catalogue) return;
    apiFetch("/v1/analytics/segmentation/" + encodeURIComponent(catalogue) + "?days=" + periodSelect.value, key)
      .then(function (data) {
        // Correctif (21 aout 2026, audit passe 4) : sans tracker installe,
        // l'ecran montrait quatre tuiles a zero avec le message d'aide
        // EN DESSOUS. Les tuiles vides n'apprennent rien ; elles cedent
        // la place au message, qui dit quoi faire.
        var vide = document.getElementById("seg-empty");
        var tuiles = document.getElementById("seg-tuiles");
        var ligneTotal = document.getElementById("seg-total-ligne");
        var aDesVisiteurs = !!data.courant.total_visiteurs;
        vide.hidden = aDesVisiteurs;
        if (tuiles) tuiles.hidden = !aDesVisiteurs;
        if (ligneTotal) ligneTotal.hidden = !aDesVisiteurs;

        document.getElementById("seg-stat-total").textContent = data.courant.total_visiteurs.toLocaleString(LOCALE);
        document.getElementById("seg-stat-fort").textContent = data.courant.repartition.fort.toLocaleString(LOCALE);
        document.getElementById("seg-stat-moyen").textContent = data.courant.repartition.moyen.toLocaleString(LOCALE);
        document.getElementById("seg-stat-faible").textContent = data.courant.repartition.faible.toLocaleString(LOCALE);

        afficherTendances(data, {
          "seg-total": data.variations.total_visiteurs,
          "seg-fort": data.variations.fort,
          "seg-moyen": data.variations.moyen,
          "seg-faible": data.variations.faible,
        });
      })
      .catch(function () {});
  }

  function renderApiKey(key) {
    var valueEl = document.getElementById("account-key-value");
    var toggleBtn = document.getElementById("account-key-toggle");
    var copyBtn = document.getElementById("account-key-copy");
    var copiedMsg = document.getElementById("account-key-copied");
    var masked = "•".repeat(Math.min(key.length, 34));
    var shown = false;

    valueEl.textContent = masked;

    if (!keyDisplayWired) {
      keyDisplayWired = true;
      toggleBtn.addEventListener("click", function () {
        shown = !shown;
        valueEl.textContent = shown ? valueEl.dataset.full : valueEl.dataset.masked;
        toggleBtn.setAttribute("aria-label", shown ? T("Masquer la clé") : T("Afficher la clé"));
      });
      copyBtn.addEventListener("click", function () {
        navigator.clipboard.writeText(valueEl.dataset.full).then(function () {
          copiedMsg.hidden = false;
          setTimeout(function () { copiedMsg.hidden = true; }, 2000);
        }).catch(function () {});
      });
    }
    valueEl.dataset.full = key;
    valueEl.dataset.masked = masked;
    shown = false;
  }

  var inviteFormWired = false;
  var companyFormWired = false;

  function renderTeam(teammates, myEmail, isAdmin) {
    var tbody = document.querySelector("#team-table tbody");
    tbody.innerHTML = teammates.map(function (t) {
      var roleLabel = t.role === "admin" ? T("Administrateur") : T("Membre");
      var actions = "";
      if (isAdmin && t.email !== myEmail) {
        var toggleLabel = t.role === "admin" ? T("Rétrograder") : T("Promouvoir admin");
        var toggleRole = t.role === "admin" ? "member" : "admin";
        actions = '<div class="console-team-actions">' +
          '<button type="button" class="console-team-action" data-action="role" data-id="' + t.id + '" data-role="' + toggleRole + '">' + toggleLabel + '</button>' +
          '<button type="button" class="console-team-action console-team-action-danger" data-action="remove" data-id="' + t.id + '" data-email="' + esc(t.email) + '">' + T("Retirer") + '</button>' +
          '</div>';
      }
      return "<tr><td>" + esc(t.email) + "</td><td>" + roleLabel + "</td><td>" + L.when(t.created_at) + "</td><td>" + actions + "</td></tr>";
    }).join("");
  }

  function loadAccountInfo() {
    var sessionToken = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionToken) return;
    apiFetch("/v1/auth/me", sessionToken).then(function (data) {
      var company = data.company || {};
      var isAdmin = data.role === "admin";

      var raisonInput = document.getElementById("company-raison-sociale");
      var tvaInput = document.getElementById("company-numero-tva");
      var companySaveBtn = document.getElementById("company-save-btn");
      raisonInput.value = company.raison_sociale || "";

      // Libelle du menu en haut a droite : la raison sociale de
      // l'entreprise connectee. Un compte fraichement cree ne l'a pas
      // encore renseignee -- on garde alors un intitule neutre plutot
      // qu'un menu vide ou un placeholder technique.
      var orgBtn = document.getElementById("console-org-btn");
      // Conservee pour recomposer le libelle : showPane y ajoute l'ecran
      // courant, et doit pouvoir revenir a la raison sociale seule.
      session.raisonSociale = company.raison_sociale || T("Mon compte");
      if (orgBtn) majPastilleCompte(orgBtn, session.raisonSociale);
      var orgDropVisible = document.querySelector(".console-org-drop");
      if (orgDropVisible) orgDropVisible.hidden = false;

      // Aide ponctuelle : « Mes infos » etait auparavant dans la barre
      // laterale. Un utilisateur habitue la chercherait au mauvais endroit,
      // d'ou ce rappel affiche UNE SEULE FOIS par navigateur.
      var hint = document.getElementById("console-org-hint");
      var hintOk = document.getElementById("console-org-hint-ok");
      if (hint && hintOk && !localStorage.getItem("heurix_org_hint_vu")) {
        hint.hidden = false;
        hintOk.addEventListener("click", function () {
          hint.hidden = true;
          localStorage.setItem("heurix_org_hint_vu", "1");
        });
        // Ouvrir le menu vaut aussi pour « compris » : l'utilisateur a
        // manifestement trouve.
        if (orgBtn) orgBtn.addEventListener("click", function () {
          hint.hidden = true;
          localStorage.setItem("heurix_org_hint_vu", "1");
        }, { once: true });
      }
      tvaInput.value = company.numero_tva || "";
      raisonInput.disabled = !isAdmin; tvaInput.disabled = !isAdmin;
      companySaveBtn.hidden = !isAdmin;

      renderTeam(data.teammates || [], data.email, isAdmin);

      var inviteForm = document.getElementById("invite-form");
      var inviteStatus = document.getElementById("invite-status");
      inviteForm.hidden = !isAdmin;

      if (!inviteFormWired) {
        inviteFormWired = true;
        inviteForm.addEventListener("submit", function (e) {
          e.preventDefault();
          var emailInput = document.getElementById("invite-email");
          var btn = document.getElementById("invite-btn");
          btn.disabled = true; btn.textContent = T("Envoi…");
          inviteStatus.hidden = true;
          apiFetch("/v1/auth/invite", localStorage.getItem(SESSION_STORAGE_KEY), { method: "POST", body: { email: emailInput.value.trim() } })
            .then(function (r) {
              inviteStatus.textContent = T("Invitation envoyée à {0}.", r.invited);
              inviteStatus.hidden = false;
              emailInput.value = "";
            })
            .catch(function (err) {
              inviteStatus.textContent = (err && err.message) || T("Échec de l'envoi.");
              inviteStatus.hidden = false;
            })
            .then(function () { btn.disabled = false; btn.textContent = T("Inviter"); });
        });
      }

      if (!companyFormWired) {
        companyFormWired = true;
        document.getElementById("company-form").addEventListener("submit", function (e) {
          e.preventDefault();
          var status = document.getElementById("company-status");
          companySaveBtn.disabled = true; companySaveBtn.textContent = T("Enregistrement…");
          status.hidden = true;
          apiFetch("/v1/auth/company", localStorage.getItem(SESSION_STORAGE_KEY), {
            method: "PUT", body: { raison_sociale: raisonInput.value.trim(), numero_tva: tvaInput.value.trim() || null },
          }).then(function () {
            status.textContent = T("Informations enregistrées.");
            status.hidden = false;
          }).catch(function (err) {
            status.textContent = (err && err.message) || T("Échec de l'enregistrement.");
            status.hidden = false;
          }).then(function () {
            companySaveBtn.disabled = false; companySaveBtn.textContent = T("Enregistrer");
          });
        });

        // Delegation : les lignes d'equipe sont regenerees a chaque chargement,
        // un seul listener sur le tbody suffit plutot que d'en reattacher un par ligne.
        document.querySelector("#team-table tbody").addEventListener("click", function (e) {
          var btn = e.target.closest(".console-team-action");
          if (!btn) return;
          var token = localStorage.getItem(SESSION_STORAGE_KEY);
          var userId = btn.getAttribute("data-id");
          if (btn.getAttribute("data-action") === "role") {
            btn.disabled = true;
            apiFetch("/v1/auth/team/" + userId + "/role", token, { method: "PUT", body: { role: btn.getAttribute("data-role") } })
              .then(function () { loadAccountInfo(); })
              .catch(function () { btn.disabled = false; });
          } else if (btn.getAttribute("data-action") === "remove") {
            var email = btn.getAttribute("data-email");
            // TROISIEME suppression destructive, non signalee par l'audit :
            // elle utilisait window.confirm. Unifiee sur le meme utilitaire,
            // pour que les trois se comportent pareil -- deux dialogues
            // differents pour la meme gravite d'action est en soi un defaut.
            confirmerSuppression(
              T("Retirer <strong>{0}</strong> de l'équipe ?<br>Cette personne perdra immédiatement l'accès à la console et aux catalogues.", esc(email)),
              btn,
              function () {
                btn.disabled = true;
                apiFetch("/v1/auth/team/" + userId, token, { method: "DELETE" })
                  .then(function () { loadAccountInfo(); })
                  .catch(function () { btn.disabled = false; });
              }
            );
          }
        });
      }
    }).catch(function () {});
  }

  // Correctif (21 aout 2026, demande Alexis). Le tableau de bord
  // agregeait tous les catalogues sans le dire ; le backend accepte
  // desormais un filtre. Cette valeur sentinelle porte le choix
  // "tous" dans le selecteur global.
  var CATALOGUE_TOUS = "__tous__";

  // Suffixe de filtre, vide sur "tous" : le backend agrege alors, ce qui
  // est son comportement par defaut. Factorise plutot que recopie --
  // trois appels le construisaient separement.
  function catalogueQS() {
    // Correctif (21 aout 2026) : l'URL partait avec "&catalog=" VIDE,
    // constate par Alexis dans l'onglet Network -- le backend traitait ce
    // parametre vide comme absent, donc les chiffres ne changeaient
    // jamais.
    //
    // On ne renvoie le filtre que si l'on tient un vrai nom. Sentinelle,
    // valeur vide ou fonction appelee trop tot donnent toutes une chaine
    // vide, ce qui fait agreger le backend -- comportement voulu dans les
    // trois cas.
    var actif = session.catalogueActif;
    if (!actif || actif === CATALOGUE_TOUS) return "";
    return "&catalog=" + encodeURIComponent(actif);
  }

  // Panes ou l'agregation n'a PAS de sens : on y ecrit des regles, qui
  // visent forcement un catalogue precis. Y arriver avec "tous"
  // selectionne bascule automatiquement sur le premier catalogue.
  var PANES_CATALOGUE_REQUIS = ["pane-search-overrides", "pane-browse", "pane-vocabulaire"];

  var ALL_PANE_IDS = ["pane-overview", "pane-guides", "pane-recherches", "pane-search-overrides", "pane-vocabulaire", "pane-produits", "pane-segmentation",
    "pane-browse", "pane-catalog-help", "pane-catalog-list", "pane-billing", "pane-company", "pane-team", "pane-key", "pane-feedback",
    // Ajoute le 29 juillet. Cette liste est une LISTE BLANCHE : un pave
    // absent d'ici s'affiche vide, sans erreur en console -- symptome
    // difficile a diagnostiquer, puisque le balisage est bien present.
    "pane-import-csv"];

  // Un element peut exister dans le document sans etre visible : un de ses
  // parents suffit a le masquer. Ce piege s'est presente TROIS fois sur cette
  // page -- selecteurs inaccessibles, animation jouee a vide -- d'ou cette
  // verification systematique avant tout declenchement visuel.
  function estVisible(el) {
    if (!el) return false;
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      if (n.hidden) return false;
    }
    return true;
  }

  // Icones des actions de fiche, partagees par les deux editeurs. Definies
  // une fois hors des boucles de rendu : elles etaient reconstruites a chaque
  // produit, et divergeaient entre Search et Ranking.
  var ICONES_FICHE = {
    pin: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round'><path d='M12 17v5'/><path d='M9 10.8V4h6v6.8l2 3.2H7z'/></svg>",
    up: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'><path d='M12 19V5'/><path d='M5 12l7-7 7 7'/></svg>",
    down: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'><path d='M12 5v14'/><path d='M19 12l-7 7-7-7'/></svg>",
    off: "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'><path d='M18 6L6 18M6 6l12 12'/></svg>",
    // Correctif (20 aout 2026, planche de composants point 8). Les emoji
    // 📌 et 📅 changent d'aspect selon le systeme, ne suivent pas la
    // couleur du texte et ne s'alignent pas sur la grille typographique.
    // Versions pleines, taille reduite : elles servent d'indicateur dans
    // un texte, pas de bouton.
    //
    // Les symboles typographiques du reste du fichier (croix, fleches,
    // crayon, point) sont CONSERVES : ils heritent deja de la couleur et
    // restent stables d'un systeme a l'autre -- ils ne posent pas le
    // probleme que la planche decrit.
    pinPlein: "<svg width='11' height='11' viewBox='0 0 24 24' fill='currentColor' aria-hidden='true' style='vertical-align:-1px'><path d='M9 4h6v6.8l2 3.2H7l2-3.2z'/><path d='M11 17h2v5h-2z'/></svg>",
    calendrier: "<svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' aria-hidden='true' style='vertical-align:-2px'><rect x='3' y='5' width='18' height='16' rx='2'/><path d='M3 10h18M8 3v4M16 3v4'/></svg>",
  };

  // ---------------- Catalogue actif, choix GLOBAL ----------------
  //
  // Auparavant, chaque ecran avait son propre selecteur : on resaisissait le
  // meme catalogue dans Analytics, Gestion des regles, Classement et
  // Synonymes. Travail repete, et surtout source d'erreur -- rien
  // n'indiquait qu'on regardait deux catalogues differents d'un onglet a
  // l'autre.
  //
  // Le choix est desormais unique, porte par la barre du haut, et tous les
  // ecrans le lisent. Le Dashboard reste global : il agrege tous les
  // catalogues, un filtre y serait trompeur.
  //
  // ETAT DE SESSION CENTRALISE (chantier S6, 5 aout 2026).
  //
  // Ces 9 valeurs vivaient en variables globales independantes, remises a
  // zero UNE PAR UNE dans endSession() -- une liste a maintenir, et un
  // oubli a chaque nouvel etat de session ajoute est une fuite silencieuse
  // entre deux comptes sur un poste partage. Regroupees ici : la remise a
  // zero devient `session = etatInitial();`, un seul bloc, impossible a
  // oublier partiellement.
  function etatInitial() {
    return {
      // Cablage des ecouteurs, fait une seule fois par session (22 aout
      // 2026). Declare ICI et non en variable isolee : le commentaire
      // du chantier S6 explique pourquoi -- un etat oublie dans la
      // remise a zero est une fuite silencieuse entre deux comptes sur
      // un poste partage. A la deconnexion, `session = etatInitial()`
      // le remet a false, et la reconnexion recable proprement.
      catalogueActif: "",
      catalogueListe: [],
      catalogueSandbox: {},
      cleCourante: null,
      soCurrentCatalog: "",
      browseCurrentCatalog: "",
      browseCurrentCategory: "",
      soDraft: null,
      brDraft: null,
      activeKey: null
    };
  }
  var session = etatInitial();

  // Correctif (21 aout 2026, bugs constates par Alexis apres la mise en
  // place de "Tous les catalogues"). Cette fonction est utilisee partout
  // ou un NOM DE CATALOGUE est attendu -- URL de synonymes, de regles,
  // de parcours. Elle ne doit donc jamais renvoyer la sentinelle, sous
  // peine de requetes vers /v1/index/__tous__/... en 404.
  //
  // Ma garde precedente ne couvrait que appliquerCatalogue ; celle-ci
  // couvre tous les appelants, presents et futurs.
  function catalogueCourant() {
    if (session.catalogueActif === CATALOGUE_TOUS) {
      return (session.catalogueListe || [])[0] || null;
    }
    return session.catalogueActif;
  }


  function rechargerCatalogues(key) {
    var select = document.getElementById("global-catalog");
    if (!select) return;
    apiFetch("/v1/index/catalogs", key).then(function (data) {
      session.catalogueSandbox = {};
      (data.catalogs || []).forEach(function (c) { session.catalogueSandbox[c.catalog] = !!c.sandbox; });
      Array.prototype.forEach.call(select.options, function (opt) {
        opt.textContent = opt.value + (session.catalogueSandbox[opt.value] ? " — " + T("bac à sable") : "");
      });
      majBandeauSandbox();
    }).catch(function () {});
  }

  function expliquerCatalogueGlobal() {
    try {
      var W = document.defaultView || window;
      if (!W.localStorage || W.localStorage.getItem("heurix_env_explique") === "1") return;
      W.localStorage.setItem("heurix_env_explique", "1");
    } catch (e) { return; }

    var select = document.getElementById("global-catalog");
    if (!select) return;
    var bulle = document.createElement("div");
    bulle.className = "console-env-tip";
    bulle.innerHTML =
      "<strong>" + T("Vous travaillez sur ce catalogue") + "</strong><br>" +
      T("Ce choix s'applique partout : tableau de bord, analytique et personnalisation. Changez-le ici pour basculer d'un catalogue à l'autre.") +
      "<button type='button' class='console-env-tip-close' aria-label='" + T("Compris") + "'>&times;</button>";
    var enveloppe = select.closest(".console-env-wrap") || select.parentElement;
    enveloppe.appendChild(bulle);
    bulle.querySelector(".console-env-tip-close").addEventListener("click", function () { bulle.remove(); });
    // Se retire aussi dès que l'utilisateur agit sur le sélecteur : il a
    // compris, l'explication devient du bruit.
    select.addEventListener("change", function () { bulle.remove(); }, { once: true });
    setTimeout(function () { if (bulle.parentElement) bulle.remove(); }, 14000);
  }

  // C1 (25 aout 2026) : SCINDEE. Le cablage du selecteur (une seule fois) et
  // la resolution du catalogue actif (rejouable) vivaient dans la meme
  // fonction. C'est de la que venait le cycle -- loadDashboard appelait
  // wireGlobalCatalog, dont le retour reseau appelait appliquerCatalogue,
  // qui rappelait loadDashboard.
  function cablerSelecteurCatalogue(key) {
    var select = document.getElementById("global-catalog");
    if (!select) return;
    select.addEventListener("change", function () {
      session.catalogueActif = select.value;
      localStorage.setItem("heurix_catalogue_actif", session.catalogueActif);
      appliquerCatalogue(key);
    });
  }

  // Rend une PROMESSE, et c'est tout l'objet du chantier : chargerDonnees
  // l'attend avant de composer ses URL d'analytics. Le filtre par catalogue
  // est donc juste des le premier rendu, ce qui supprime le second
  // chargement -- et avec lui le drapeau, son setTimeout de 1000 ms, et le
  // masquage a 450 ms qui cachait le clignotement des chiffres.
  function resoudreCatalogueActif(key) {
    var select = document.getElementById("global-catalog");
    if (!select) return Promise.resolve();
    return apiFetch("/v1/index/catalogs", key).then(function (data) {
      session.catalogueListe = (data.catalogs || []).map(function (c) { return c.catalog; });
      session.catalogueSandbox = {};
      (data.catalogs || []).forEach(function (c) { session.catalogueSandbox[c.catalog] = !!c.sandbox; });

      if (!session.catalogueListe.length) {
        // Compte neuf : rien a choisir. On le dit plutot que d'afficher une
        // liste vide, qui laisserait croire a une panne.
        select.innerHTML = '<option value="">' + T("Aucun catalogue") + '</option>';
        select.disabled = true;
        return data;
      }
      select.disabled = false;
      // L'entree n'apparait qu'a partir de deux catalogues : avec un
      // seul, "tous" et "celui-ci" designent la meme chose.
      var optionTous = session.catalogueListe.length > 1
        ? "<option value='" + CATALOGUE_TOUS + "'>" + T("Tous les catalogues") + "</option>" : "";
      select.innerHTML = optionTous + session.catalogueListe.map(function (n) {
        return "<option value='" + esc(n) + "'>" + esc(n) +
          (session.catalogueSandbox[n] ? " — " + T("bac à sable") : "") + "</option>";
      }).join("");

      // La grande majorite des comptes n'a qu'un catalogue : on le
      // selectionne d'office plutot que d'imposer un choix sans alternative.
      var memoire = localStorage.getItem("heurix_catalogue_actif");
      // La sentinelle n'est PAS dans catalogueListe : sans ce cas
      // explicite, un choix "Tous les catalogues" etait perdu au
      // rechargement et retombait sur le premier catalogue.
      var memoireValide = memoire === CATALOGUE_TOUS
        ? session.catalogueListe.length > 1
        : (memoire && session.catalogueListe.indexOf(memoire) !== -1);
      session.catalogueActif = memoireValide ? memoire : session.catalogueListe[0];
      select.value = session.catalogueActif;
      // Un nouveau client ne devine pas que ce choix porte sur TOUTE la
      // console -- il peut le prendre pour un filtre local. On l'explique
      // une fois, s'il a plus d'un catalogue (avec un seul, le selecteur
      // n'a rien d'ambigu).
      if (session.catalogueListe.length > 1) expliquerCatalogueGlobal();
      // Rend la reponse : chargerDonnees la fait suivre a tout ce qui en a
      // besoin. Sans ca, /v1/index/catalogs repartait quatre fois par
      // chargement -- exactement le doublon d'appels reseau que ce chantier
      // doit supprimer, pas deplacer.
      return data;
    }).catch(function () { return null; });
  }

  // Propage le choix aux ecrans et rafraichit CELUI QUI EST OUVERT : changer
  // de catalogue sans rafraichir laisserait les donnees du precedent a
  // l'ecran, ce qui serait pire que l'ancien systeme.
  // Appelee a l'OUVERTURE d'un ecran. La cle n'est pas disponible dans
  // showPane, on la memorise au cablage.
  function appliquerCatalogueOuverture(paneId) {
    if (!session.cleCourante || !session.catalogueActif) return;
    if (paneId === "pane-search-overrides") {
      var contenu = document.getElementById("so-content");
      if (contenu) contenu.hidden = false;
      soAnimerPlaceholder();
      refreshSoTable(session.cleCourante);
      refreshSoPreview(session.cleCourante);
      chargerSynonymesEtRegles(session.cleCourante);
    } else if (paneId === "pane-browse") {
      onBrowseCatalogChange(session.cleCourante);
    }
  }

  function majBandeauSandbox() {
    var bandeau = document.getElementById("sandbox-banner");
    if (bandeau) bandeau.hidden = !session.catalogueSandbox[session.catalogueActif];
  }

  // C1 (25 aout 2026). `rechargementAnalytics` vivait ici, libere par un
  // setTimeout de 1000 ms. Il CASSAIT un cycle au lieu de le supprimer :
  // deux changements de catalogue espaces de plus d'une seconde passaient
  // tous les deux et recablaient. Mesure sur ce chemin exact avant le
  // chantier : +42 ecouteurs et +22 appels reseau au SECOND changement,
  // contre +6 et +4 au premier. Le cycle est parti avec la resolution du
  // catalogue faite AVANT les analytics ; le drapeau n'a plus rien a garder.

  // Etat derive du catalogue actif, et rafraichissement de l'ecran ouvert.
  // Ne charge PAS le tableau de bord : c'est chargerDonnees qui l'appelle,
  // une fois le catalogue connu.
  function appliquerEtatCatalogue(key) {
    majBandeauSandbox();
    // Garde (21 aout 2026) : la sentinelle "tous" ne doit JAMAIS servir
    // de nom de catalogue dans une URL de regles. showPane bascule deja
    // avant d'afficher ces ecrans, mais on ne depend pas de l'ordre
    // d'appel -- une valeur sentinelle ecrite ici produirait des requetes
    // vers un catalogue inexistant.
    var catalogueCible = session.catalogueActif === CATALOGUE_TOUS
      ? (session.catalogueListe || [])[0] || null
      : session.catalogueActif;
    session.soCurrentCatalog = catalogueCible;
    session.browseCurrentCatalog = catalogueCible;
    session.browseCurrentCategory = "";
    session.soDraft = null;
    session.brDraft = null;

    var ouvert = ALL_PANE_IDS.filter(function (id) {
      var el = document.getElementById(id);
      return el && !el.hidden;
    })[0];

    // Chantier "segmentation" (7 aout 2026) : INCONDITIONNEL, pas dans le
    // bloc ci-dessous conditionne par le pane ouvert -- au tout premier
    // chargement, "Vue d'ensemble" est affiche, jamais "Segmentation".
    // Un bloc conditionne ne se serait donc jamais declenche avant que
    // l'utilisateur ait deja visite ce pane une fois. chargerSegmentation
    // gere elle-meme son propre etat vide/absence de catalogue.
    // HISTOIRE DE CE BLOC, conservee au passe -- il n'existe plus, mais ce
    // qu'il documentait explique la forme actuelle (C1, 25 aout 2026).
    //
    // loadDashboard construisait ses URL d'analytics AVANT que
    // wireGlobalCatalog -- qu'elle appelait elle-meme -- n'ait determine le
    // catalogue. Les requetes partaient donc sans filtre (diagnostic du
    // 21 aout : le tableau de bord affichait « actif = '' | liste = [] »),
    // et il fallait TOUT recharger une fois le catalogue connu. Ce second
    // chargement faisait clignoter les chiffres -- 1036 recherches puis 101
    // (capture du 24 aout) -- d'ou un masquage de 450 ms pour cacher la
    // transition, et un drapeau `rechargementAnalytics` libere a 1000 ms
    // pour empecher la boucle de tourner indefiniment.
    //
    // Aucun des trois n'est encore la. resoudreCatalogueActif rend une
    // promesse que chargerDonnees attend : le filtre est juste au PREMIER
    // rendu, il n'y a plus de second chargement, donc plus de clignotement
    // a masquer ni de boucle a garder.
    chargerSegmentation(key);
    // Correctif (19 aout 2026, brief §4.3) : meme raisonnement -- sorti
    // vers sa propre page (pane-vocabulaire), chargerSynonymesEtRegles
    // deplacee ici pour rester inconditionnelle plutot que de repeter
    // le meme piege deja resolu pour la segmentation ("jamais declenche
    // avant que l'utilisateur ait deja visite ce pane une fois").
    chargerSynonymesEtRegles(key);

    if (ouvert === "pane-search-overrides") {
      var contenu = document.getElementById("so-content");
      if (contenu) contenu.hidden = !session.catalogueActif;
      if (session.catalogueActif) {
        soAnimerPlaceholder();
        refreshSoTable(key);
        refreshSoPreview(key);
      }
    } else if (ouvert === "pane-browse") {
      onBrowseCatalogChange(key);
    } else if (ouvert === "pane-catalog-list") {
      // Correctif (20 aout 2026) : la synchronisation doit aller dans les
      // DEUX sens, sinon on deplace la desynchronisation au lieu de la
      // corriger. Changer le catalogue actif repositionne la page si elle
      // est ouverte.
      loadCatalogs(key);
    } else if (ouvert === "pane-produits") {
      // Correctif (18 aout 2026, brief §3.1) : "Produits les plus vus"
      // et "Produits associes" fusionnes en un seul pane-produits --
      // les deux conditions distinctes (jamais mises a jour vers le
      // nouveau nom, sinon plus jamais declenchees) deviennent une
      // seule, les deux actions restant necessaires quel que soit
      // l'onglet actif au moment du changement de catalogue.
      // Le selecteur #cv-catalog est deja peuple : seul son CONTENU depend
      // du catalogue actif. cvCharger plutot que chargerVuesCategories.
      cvCharger(key);
      rpReinitialiser();
    }
  }

  // Changement de catalogue par l'utilisateur. Uniquement des DONNEES a
  // recharger : plus aucun cablage sur ce chemin, donc plus de doublon a
  // empecher. C'est ce qui rend le drapeau inutile plutot que de le
  // remplacer par un autre.
  function appliquerCatalogue(key) {
    // SYNCHRONE, et ce n'est pas un detail : l'ecran doit repondre au
    // changement sans attendre le reseau. Passer cet appel dans une promesse
    // laissait la selection precedente affichee le temps d'un aller-retour --
    // regression attrapee par tests/related-products.test.js, qui verrouille
    // « changer de catalogue global reinitialise la selection en cours ».
    appliquerEtatCatalogue(key);
    var champPeriode = document.getElementById("period-select");
    chargerDonnees(key, champPeriode ? champPeriode.value : 30);
  }

  // ---------------- Mon abonnement ----------------
  //
  // Toutes les donnees viennent de /v1/usage, qui les expose deja : plan,
  // quota consomme, limites, essai. Rien a construire cote moteur -- il
  // manquait seulement un ecran pour les lire.
  //
  // Les factures passent par le portail Stripe existant plutot que d'etre
  // reconstruites ici : c'est lui qui fait foi, et le dupliquer creerait
  // deux verites sur la meme donnee.
  var PLAN_LIBELLES = {
    trial: T("Essai gratuit"), starter: "Starter", growth: "Growth", scale: "Scale",
  };

  // ---------------- Jauges de quota (audit UX, point 2) ----------------
  //
  // Les quotas s'affichaient en chiffres bruts : « 1247 / 15000 ». Correct,
  // mais un chiffre ne dit pas si l'on est proche du plafond -- il faut
  // diviser de tête. Une barre le montre d'un coup d'oeil.
  //
  // POURQUOI CE POINT EST LE PLUS UTILE DES SIX : Alexis a lui-meme decouvert
  // le plafond de 2 catalogues par un MESSAGE D'ERREUR, en tentant d'en creer
  // un troisieme. Un signal en amont l'aurait evite.
  //
  // Seuils : 80 % ambre, 100 % rouge. Le vert n'est pas un encouragement a
  // consommer, c'est l'absence d'alerte.
  function jaugeQuota(libelle, utilise, plafond, unite) {
    if (!plafond) {
      return "<div class='quota-ligne'><span class='quota-label'>" + libelle +
        "</span><span class='quota-valeur'>" + utilise.toLocaleString(LOCALE) +
        (unite ? " " + unite : "") + "</span></div>";
    }
    var pct = Math.min(100, Math.round(utilise / plafond * 100));
    var niveau = pct >= 100 ? "critique" : (pct >= 80 ? "attention" : "normal");
    return "<div class='quota-ligne'>" +
        "<span class='quota-label'>" + libelle + "</span>" +
        "<span class='quota-valeur'>" + utilise.toLocaleString(LOCALE) + " / " +
          plafond.toLocaleString(LOCALE) + (unite ? " " + unite : "") +
          " <em>(" + pct + "%)</em></span>" +
      "</div>" +
      "<div class='quota-barre quota-" + niveau + "' role='progressbar' " +
        "aria-valuenow='" + pct + "' aria-valuemin='0' aria-valuemax='100' " +
        "aria-label='" + T("{0} : {1} pour cent utilisés", libelle, pct) + "'>" +
        "<span style='width:" + pct + "%;'></span>" +
      "</div>";
  }

  function renderBilling(key) {
    var grille = document.getElementById("billing-grid");
    var essai = document.getElementById("billing-trial");
    if (!grille) return;

    apiFetch("/v1/usage", key).then(function (d) {
      var plan = d.plan || (d.limit_status && d.limit_status.plan) || "—";
      var html = "<div class='billing-row'><span class='billing-label'>" + T("Formule") + "</span>" +
        "<span class='billing-value'><strong style='font-size:16px;'>" +
        esc(PLAN_LIBELLES[plan] || plan) + "</strong></span></div>";

      html += jaugeQuota(T("Requêtes ce mois-ci"), d.requests || 0, d.limit);
      if (d.catalogs_used !== undefined) {
        html += jaugeQuota(T("Catalogues"), d.catalogs_used, d.catalogs_limit);
      }
      if (d.products_limit) {
        html += "<div class='quota-ligne'><span class='quota-label'>" + T("Produits par catalogue") + "</span>" +
          "<span class='quota-valeur'>" + T("jusqu'à {0}", d.products_limit.toLocaleString(LOCALE)) +
          "</span></div>";
      }
      if (d.browse_plan && d.browse_plan !== "none") {
        html += "<div class='billing-row'><span class='billing-label'>Ranking</span>" +
          "<span class='billing-value'>" + esc(PLAN_LIBELLES[d.browse_plan] || d.browse_plan) +
          "</span></div>";
      }
      grille.innerHTML = html;

      // Le bloc est TOUJOURS visible, avec un libelle adapte.
      //
      // Premiere version fautive : je le masquais pour les comptes en essai.
      // Resultat, la fonctionnalite disparaissait sans un mot -- impossible
      // pour l'utilisateur de savoir si elle n'existe pas, si elle est
      // cassee, ou s'il ne remplit pas une condition. Masquer une
      // fonctionnalite en silence est toujours pire que l'afficher avec son
      // explication.
      var blocUpgrade = document.getElementById("billing-upgrade");
      var titreUpgrade = document.getElementById("billing-upgrade-title");
      var texteUpgrade = document.getElementById("billing-upgrade-text");
      var boutonUpgrade = document.getElementById("billing-change-plan");
      var enEssai = (plan === "trial" || plan === "—");
      if (blocUpgrade) {
        blocUpgrade.hidden = false;
        if (titreUpgrade) titreUpgrade.textContent = enEssai ? T("Souscrire une formule") : T("Changer de formule");
        if (texteUpgrade) {
          texteUpgrade.textContent = enEssai
            ? T("Vous êtes en période d'essai : choisissez une formule pour continuer après son terme. Aucun abonnement n'est encore actif sur votre compte.")
            : T("Le changement se fait depuis le portail de facturation : Stripe calcule le prorata et ajuste votre abonnement en cours. Vous n'êtes pas facturé deux fois, et il n'y a pas de nouvelle période d'essai.");
        }
        if (boutonUpgrade) {
          boutonUpgrade.textContent = enEssai ? T("Voir les formules") : T("Changer de formule");
          boutonUpgrade.setAttribute("data-mode", enEssai ? "souscrire" : "changer");
        }
      }

      if (essai) {
        if (d.trial_expired) {
          essai.hidden = false;
          essai.innerHTML = T("<strong>Votre essai est terminé.</strong> Choisissez une formule pour continuer à utiliser Heurix.");
        } else if (d.trial_days_left !== undefined && d.trial_days_left !== null) {
          essai.hidden = false;
          essai.textContent = T(d.trial_days_left > 1 ? "Il vous reste {0} jours d'essai." : "Il vous reste {0} jour d'essai.", d.trial_days_left);
        } else {
          essai.hidden = true;
        }
      }
    }).catch(function () {
      grille.innerHTML = "<p class='console-panel-note'>" + T("Impossible de charger votre abonnement.") + "</p>";
    });
  }

  function ouvrirPortail(key, bouton, statut, messageEchec) {
    bouton.disabled = true;
    if (statut) { statut.className = "catalog-rule-status"; statut.textContent = T("Ouverture du portail…"); }
    apiFetch("/v1/stripe/create-portal-session", key, { method: "POST", body: {} })
      .then(function (d) {
        if (d.portal_url) window.location.href = d.portal_url;
        else throw new Error(messageEchec);
      })
      .catch(function (err) {
        if (statut) {
          statut.className = "catalog-rule-status err";
          statut.textContent = (err && err.message) || messageEchec;
        }
      })
      .then(function () { bouton.disabled = false; });
  }

  function wireBilling(key) {
    var statutU = document.getElementById("billing-status");
    var changer = document.getElementById("billing-change-plan");
    if (changer) changer.addEventListener("click", function () {
      // Un compte en essai n'a pas d'abonnement Stripe : l'envoyer au portail
      // serait une impasse, on l'oriente vers les tarifs.
      if (changer.getAttribute("data-mode") === "souscrire") {
        window.open("pricing.html", "_blank", "noopener");
        return;
      }
      // On passe par le portail Stripe plutot que par un nouveau paiement :
      // creer une seconde session de paiement pour un client deja abonne
      // creerait un SECOND abonnement, donc une double facturation. Le
      // portail, lui, MODIFIE l'abonnement existant avec prorata.
      ouvrirPortail(key, changer, statutU,
        T("Aucun abonnement actif : souscrivez d'abord une formule depuis la page des tarifs."));
    });

    var bouton = document.getElementById("billing-portal");
    var statut = document.getElementById("billing-status");
    if (!bouton) return;
    bouton.addEventListener("click", function () {
      ouvrirPortail(key, bouton, statut,
        T("Aucun abonnement actif : le portail devient disponible après souscription."));
    });
  }

  // Expose pour la visite guidee, qui doit pouvoir amener l'utilisateur sur
  // l'ecran des regles avant de commencer -- sinon les trois quarts de ses
  // etapes pointeraient dans le vide.
  window.heurixShowPane = function (id) { showPane(id); };

  // ---------------- Confirmation avant suppression (audit UX 4.1) ----------------
  //
  // Constat de l'audit : la suppression d'un groupe de synonymes et la
  // revocation d'une cle publique s'executaient AU PREMIER CLIC, sans
  // confirmation ni annulation possible. Pour un client ayant construit des
  // dizaines de regles, un clic accidentel etait une perte definitive.
  //
  // Ecrit en UTILITAIRE et non en deux implementations : d'autres
  // suppressions existent (regles personnalisees, priorites, produits) et
  // devront le reutiliser.
  //
  // Pas de window.confirm : il ne permet ni de nommer l'element concerne ni
  // de suivre la charte. Or nommer l'element est l'essentiel -- « Confirmer
  // la suppression ? » n'aide pas, « Supprimer le groupe "vis, boulon" ? »
  // permet de verifier qu'on a clique le bon.
  function confirmerSuppression(description, aupresDe, suite) {
    var fond = document.createElement("div");
    fond.className = "confirm-fond";
    fond.innerHTML =
      "<div class='confirm-boite' role='dialog' aria-modal='true' aria-labelledby='confirm-titre'>" +
        "<p class='confirm-titre' id='confirm-titre'>" + T("Confirmer la suppression") + "</p>" +
        "<p class='confirm-texte'>" + description + "</p>" +
        "<p class='confirm-note'>" + T("Cette action est irréversible.") + "</p>" +
        "<div class='confirm-actions'>" +
          "<button type='button' class='confirm-annuler'>" + T("Annuler") + "</button>" +
          "<button type='button' class='confirm-valider'>" + T("Supprimer définitivement") + "</button>" +
        "</div>" +
      "</div>";
    document.body.appendChild(fond);

    function fermer() {
      fond.remove();
      document.removeEventListener("keydown", surTouche);
      // On rend le focus a l'element d'origine : sans cela, la navigation
      // au clavier repart du haut de la page.
      if (aupresDe && aupresDe.focus) aupresDe.focus();
    }
    function surTouche(e) { if (e.key === "Escape") fermer(); }

    fond.querySelector(".confirm-annuler").addEventListener("click", fermer);
    fond.addEventListener("click", function (e) { if (e.target === fond) fermer(); });
    document.addEventListener("keydown", surTouche);
    fond.querySelector(".confirm-valider").addEventListener("click", function () {
      fermer();
      suite();
    });
    // Focus sur ANNULER, pas sur Supprimer : quelqu'un qui valide au clavier
    // par reflexe ne doit pas detruire ses donnees.
    fond.querySelector(".confirm-annuler").focus();
  }

  // ---------------- Journal d'erreurs lisible (audit UX, point 3) ----------------
  //
  // Chaque ligne affichait le brut : endpoint, code HTTP, message technique.
  // Exploitable par un developpeur, opaque pour un responsable e-commerce.
  //
  // CE QUI ETAIT DEJA BON : les messages du moteur ecrits recemment sont deja
  // orientes utilisateur (« Le bac a sable est disponible sur les plans Growth
  // et Scale »). Ce qui restait brut, ce sont les codes standards.
  //
  // REPLI OBLIGATOIRE sur le message d'origine. Sans lui, un type d'erreur non
  // prevu s'afficherait vide -- pire que technique.
  var TRADUCTIONS_ERREUR = [
    { code: 429, motif: /catalogue/i,
      texte: T("Vous avez atteint le nombre de catalogues de votre formule."),
      action: { libelle: T("Voir les formules"), pane: "pane-billing" } },
    { code: 429, motif: null,
      texte: T("Vous avez dépassé le quota de requêtes de votre formule."),
      action: { libelle: T("Voir les formules"), pane: "pane-billing" } },
    { code: 403, motif: /bac à sable|sandbox/i,
      texte: T("Le bac à sable demande une formule Growth ou Scale."),
      action: { libelle: T("Comparer les offres"), pane: "pane-billing" } },
    { code: 403, motif: /clé publique|publique/i,
      texte: T("Une clé publique a tenté une action réservée aux clés serveur."),
      aide: T("Les clés publiques ne peuvent que lire. Vérifiez quelle clé votre site utilise.") },
    { code: 401, motif: null,
      texte: T("Une requête est arrivée avec une clé API invalide ou absente."),
      aide: T("Vérifiez la clé configurée sur votre site. Ce message apparaît aussi lorsqu'un robot teste votre API — c'est alors sans conséquence.") },
    { code: 404, motif: /catalog/i,
      texte: T("Une requête a visé un catalogue qui n'existe pas."),
      aide: T("Vérifiez le nom du catalogue dans votre intégration : il est sensible à la casse.") },
    { code: 422, motif: null,
      texte: T("Une requête a été refusée : format ou paramètre invalide."),
      aide: T("C'est généralement un problème d'intégration côté site, pas côté moteur.") },
    { code: 500, motif: null,
      texte: T("Une erreur interne du moteur s'est produite."),
      aide: T("Si elle se répète, écrivez à contact@heurix.fr avec la date et l'heure.") },
  ];

  function traduireErreur(e) {
    for (var i = 0; i < TRADUCTIONS_ERREUR.length; i++) {
      var t = TRADUCTIONS_ERREUR[i];
      if (t.code !== e.status_code) continue;
      if (t.motif && !t.motif.test(e.message || "")) continue;
      return t;
    }
    // Repli : on montre le message d'origine plutot que rien.
    return { texte: e.message || T("Erreur non détaillée"), brut: true };
  }

  // ---------------- Signalement des erreurs (audit UX, point 4) ----------------
  //
  // LE PIEGE QUE CE CODE EVITE : badger toutes les erreurs apprendrait a
  // l'utilisateur a ignorer le badge.
  //
  // Un 401 est un evenement NORMAL d'exploitation -- une cle mal copiee, un
  // robot qui tatonne. Le journal en contient regulierement, sans qu'aucune
  // action ne soit requise. Un 404 sur un catalogue inexistant aussi.
  //
  // On ne signale donc que ce qui DEMANDE UNE ACTION :
  //   429 -> quota depasse, le service se degrade pour les visiteurs
  //   422 -> integration cassee cote site
  //   5xx -> defaut du moteur
  //
  // Et un etat « vu » : le badge s'eteint apres consultation, sinon il
  // devient un decor permanent.
  var CODES_ACTIONNABLES = [429, 422, 500, 502, 503];
  var _dernieresErreurs = [];
  var CLE_ERREURS_VUES = "heurix_erreurs_vues_le";

  function memoireLocale(cle, valeur) {
    try {
      var W = document.defaultView || window;
      if (!W.localStorage) return null;
      if (valeur === undefined) return W.localStorage.getItem(cle);
      W.localStorage.setItem(cle, valeur);
      return valeur;
    } catch (e) { return null; }
  }

  // Correctif (20 aout 2026, audit passe 3 §6) : le KPI du tableau de
  // bord doit compter la MEME chose que la page Erreurs. Meme constante
  // CODES_ACTIONNABLES, une seule definition de ce qui demande une
  // action -- plutot que de filtrer aussi cote moteur, ou la regle
  // aurait vecu en deux endroits avec un risque de divergence.
  function majKpiErreurs(erreurs) {
    var champ = document.getElementById("stat-errors");
    var sous = document.getElementById("stat-errors-bruit");
    if (!champ) return;
    erreurs = erreurs || [];
    var aTraiter = erreurs.filter(function (e) {
      return CODES_ACTIONNABLES.indexOf(e.status_code) !== -1;
    }).length;
    var bruit = erreurs.length - aTraiter;
    champ.textContent = aTraiter.toLocaleString(LOCALE);
    if (sous) {
      sous.hidden = bruit === 0;
      sous.textContent = bruit === 0 ? "" : T("{0} sans conséquence", bruit);
    }
  }

  function majSignalementErreurs(erreurs) {
    var badge = document.getElementById("nav-badge-erreurs");
    var bilan = document.getElementById("err-bilan");
    if (!erreurs) erreurs = [];

    var actionnables = erreurs.filter(function (e) {
      return CODES_ACTIONNABLES.indexOf(e.status_code) !== -1;
    });
    var bruit = erreurs.length - actionnables.length;

    // Nouveautes depuis la derniere consultation. Sans cette notion, le badge
    // afficherait le meme nombre indefiniment.
    var vuLe = memoireLocale(CLE_ERREURS_VUES);
    var nouvelles = vuLe
      ? actionnables.filter(function (e) { return e.at > vuLe; })
      : actionnables;

    if (badge) {
      badge.hidden = nouvelles.length === 0;
      badge.textContent = nouvelles.length > 9 ? "9+" : String(nouvelles.length);
      badge.setAttribute("aria-label", T("{0} erreur(s) demandant votre attention", nouvelles.length));
    }

    // BILAN EN TETE DE SECTION, et non banniere sur le tableau de bord.
    //
    // La version precedente annoncait « 2 erreurs demandent votre attention »
    // sur le tableau de bord. Deplacee ici telle quelle, elle aurait double
    // le tableau qui les liste juste en dessous -- une redondance, pas une
    // amelioration.
    //
    // Elle apporte donc autre chose : le PARTAGE entre ce qui demande une
    // action et ce qui n'est que du bruit d'exploitation. C'est l'information
    // que le tableau ne donne pas, et celle qui evite de s'alarmer de 401
    // provoques par des robots.
    if (!bilan) return;
    if (erreurs.length === 0) { bilan.hidden = true; return; }

    bilan.hidden = false;
    var aTraiter = actionnables.length;
    bilan.className = "err-bilan" + (aTraiter > 0 ? " err-bilan-actif" : " err-bilan-calme");
    var html = "<div class='err-bilan-chiffres'>";
    html += "<span class='err-bilan-bloc " + (aTraiter > 0 ? "err-bilan-alerte" : "") + "'>" +
              "<strong>" + aTraiter + "</strong>" +
              "<em>" + T(aTraiter === 1 ? "erreur à traiter" : "erreurs à traiter") + "</em>" +
            "</span>";
    if (bruit > 0) {
      html += "<span class='err-bilan-bloc'>" +
                "<strong>" + bruit + "</strong>" +
                "<em>" + T(bruit === 1 ? "événement sans conséquence" : "événements sans conséquence") + "</em>" +
              "</span>";
    }
    html += "</div>";
    html += "<p class='err-bilan-note'>" + (aTraiter > 0
      ? T("Les erreurs à traiter concernent un quota dépassé, une intégration en défaut ou un incident du moteur. Les autres — clés invalides, catalogues inconnus — proviennent souvent de robots qui testent votre API : elles n'ont pas d'effet sur vos visiteurs.")
      : T("Aucune erreur ne demande d'action. Les événements listés ci-dessous — clés invalides, catalogues inconnus — proviennent souvent de robots qui testent votre API.")) + "</p>";
    bilan.innerHTML = html;
  }

  function marquerErreursVues(erreurs) {
    // La date de l'erreur la PLUS RECENTE, pas l'heure courante : une erreur
    // survenue pendant la consultation ne doit pas etre marquee vue.
    if (!erreurs || !erreurs.length) return;
    var plusRecente = erreurs.reduce(function (max, e) {
      return e.at > max ? e.at : max;
    }, "");
    if (plusRecente) memoireLocale(CLE_ERREURS_VUES, plusRecente);
  }

  function showPane(paneId) {
    // Correctif (21 aout 2026) : arriver sur un ecran de regles avec
    // "Tous les catalogues" selectionne laisserait ces pages sans cible
    // -- on ne pose pas une regle sur "tous". Bascule sur le premier
    // catalogue, en passant par le selecteur pour que la propagation et
    // la memorisation suivent, comme pour un choix manuel.
    if (PANES_CATALOGUE_REQUIS.indexOf(paneId) !== -1 && session.catalogueActif === CATALOGUE_TOUS) {
      var selecteurGlobal = document.getElementById("global-catalog");
      var premier = (session.catalogueListe || [])[0];
      if (selecteurGlobal && premier) {
        selecteurGlobal.value = premier;
        selecteurGlobal.dispatchEvent(new Event("change"));
      }
    }
    ALL_PANE_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = id !== paneId;
    });
    document.querySelectorAll(".console-sidebar-item").forEach(function (btn) {
      btn.classList.toggle("console-sidebar-item-on", btn.getAttribute("data-pane") === paneId && !btn.hasAttribute("data-catalog"));
    });

    // Correctif (21 aout 2026, audit de coherence, zone compte). Les
    // ecrans du menu du haut -- Entreprise, Membres, Cle API, Mon
    // abonnement -- ne figurent PAS dans la barre laterale. Une fois
    // dedans, plus aucun repere : la boucle ci-dessus eteint tout, sans
    // rien allumer ailleurs.
    //
    // L'audit decrivait 'Dashboard reste affiche comme etat courant' ;
    // la verification montre plutot que RIEN n'est actif. Meme
    // desorientation, autre cause.
    //
    // On marque donc l'entree du menu par laquelle on est arrive, et le
    // bouton qui l'ouvre.
    var menuCompte = document.querySelector(".console-org-drop");
    if (menuCompte) {
      var entrees = menuCompte.querySelectorAll("[data-goto-pane]");
      var dansLeMenu = false;
      entrees.forEach(function (b) {
        var actif = b.getAttribute("data-goto-pane") === paneId;
        b.classList.toggle("nav-drop-item-on", actif);
        if (actif) dansLeMenu = true;
      });
      var btnMenu = document.getElementById("console-org-btn");
      if (btnMenu) {
        btnMenu.classList.toggle("nav-drop-btn-on", dansLeMenu);
        // Correctif (21 aout 2026, capture Alexis). Marquer l'entree
        // ACTIVE ne servait a rien : elle vit dans un menu deroulant
        // ferme. Le bouton bleu disait "quelque part dans le compte",
        // sans dire ou -- le titre de page restait le seul repere.
        //
        // L'ecran courant s'affiche donc DANS le bouton, visible sans
        // rien ouvrir.
        var base = session.raisonSociale || T("Mon compte");
        var courant = null;
        entrees.forEach(function (b) {
          if (b.getAttribute("data-goto-pane") === paneId) courant = b.textContent.trim();
        });
        // Passe par majPastilleCompte (24 aout 2026) : une affectation
        // directe de textContent effacait la pastille des le premier
        // changement d'ecran, et le bouton redevenait du texte nu.
        majPastilleCompte(btnMenu, courant ? base + " › " + courant : base);
      }
    }
    // L'effet de frappe part a l'OUVERTURE du panneau, pas au cablage :
    // celui-ci s'execute a la connexion, alors que le pave est encore
    // masque -- l'animation se terminait sans que personne ne la voie.
    // Le catalogue etant global, ouvrir un ecran suffit a le charger : plus
    // besoin de resaisir le catalogue a chaque fois.
    if (typeof appliquerCatalogueOuverture === "function") appliquerCatalogueOuverture(paneId);
    if (paneId === "pane-billing" && session.cleCourante) renderBilling(session.cleCourante);
    // Remonte en haut du nouvel ecran. Sans cela, un utilisateur descendu
    // dans un pave long arrive sur le suivant deja defile, et ne voit pas
    // ce qu'il vient d'ouvrir -- on doit remonter a la main pour comprendre
    // ou l'on est.
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function showCatalogCard(catalogName) {
    document.querySelectorAll(".catalog-card").forEach(function (card) {
      card.hidden = card.getAttribute("data-catalog-card") !== catalogName;
    });
    document.querySelectorAll(".console-sidebar-item[data-catalog]").forEach(function (btn) {
      btn.classList.toggle("console-sidebar-item-on", btn.getAttribute("data-catalog") === catalogName);
    });
  }

  document.getElementById("console-sidebar").addEventListener("click", function (e) {
    var sectionBtn = e.target.closest(".console-sidebar-section");
    if (sectionBtn) {
      var expanded = sectionBtn.classList.toggle("console-sidebar-section-on");
      sectionBtn.setAttribute("aria-expanded", String(expanded));
      sectionBtn.nextElementSibling.hidden = !expanded;
      return;
    }
    var itemBtn = e.target.closest(".console-sidebar-item");
    if (!itemBtn) return;
    var paneId = itemBtn.getAttribute("data-pane");
    if (paneId) showPane(paneId);
    var catalogName = itemBtn.getAttribute("data-catalog");
    if (catalogName) showCatalogCard(catalogName);
  });

  // Liens de renvoi generiques depuis le contenu d'un pave vers un autre
  // (ex. l'etat de premier lancement de "Vue d'ensemble" vers "Comment ca
  // marche") -- deplie aussi la section parente dans la barre laterale,
  // pas seulement le contenu, pour que l'utilisateur voie ou il atterrit.
  // Correctif (21 aout 2026, audit passe 4) : les tuiles KPI sont
  // devenues des liens (role="link", tabindex). Le gestionnaire de clic
  // ci-dessous les couvre deja ; il leur manquait l'activation au
  // clavier, sans quoi elles seraient atteignables mais inutilisables.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var cible = e.target.closest('[data-goto-pane][role="link"]');
    if (!cible) return;
    e.preventDefault();
    cible.click();
  });

  document.addEventListener("click", function (e) {
    var link = e.target.closest("[data-goto-pane]");
    if (!link) return;
    e.preventDefault();
    var paneId = link.getAttribute("data-goto-pane");
    showPane(paneId);

    // Si le lien vient d'un menu deroulant (celui de l'entreprise en haut
    // a droite), on le referme : nav-dropdown.js ne ferme que sur un clic
    // A L'EXTERIEUR du menu, or ici le clic est dedans.
    var drop = link.closest(".nav-drop");
    if (drop) {
      var btn = drop.querySelector(".nav-drop-btn");
      var panel = drop.querySelector(".nav-drop-panel");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (panel) panel.classList.remove("open");
    }
    var sidebarBtn = document.querySelector('.console-sidebar-item[data-pane="' + paneId + '"]');
    var section = sidebarBtn && sidebarBtn.closest(".console-sidebar-items");
    if (section && section.hasAttribute("hidden")) {
      section.hidden = false;
      var sectionBtn = section.previousElementSibling;
      if (sectionBtn) {
        sectionBtn.classList.add("console-sidebar-section-on");
        sectionBtn.setAttribute("aria-expanded", "true");
      }
    }

    // PRÉ-REMPLISSAGE DU FORMULAIRE D'ARRIVÉE. Sans lui, le lien amène le
    // marchand au bon endroit mais lui fait retaper un terme qu'il vient
    // de lire deux secondes plus tôt — un renvoi qui ressemble à une aide
    // mais n'en fait pas moins le travail à sa place.
    //
    // Le champ synonyme attend un GROUPE ("vis, boulon, screw"), pas une
    // paire : on y dépose "terme, " avec le curseur juste après la
    // virgule, prêt à taper le mot du catalogue auquel le rattacher.
    var terme = link.getAttribute("data-prefill");
    if (terme) {
      // DÉFAUT SIGNALÉ (30 juillet, tard) : le lien atterrissait sur
      // l'écran mais pas sur le bloc « Ajouter une règle » — `#so-content`,
      // qui héberge le formulaire, reste MASQUÉ tant que
      // `appliquerCatalogueOuverture` ne l'a pas explicitement révélé, et
      // cette révélation dépend de conditions (`session.cleCourante`,
      // `session.catalogueActif`) posées ailleurs dans le code. `scrollIntoView`
      // sur un élément cependant masqué ne fait RIEN, silencieusement —
      // aucune erreur, juste un lien qui semble ne pas fonctionner.
      //
      // On force la révélation nous-mêmes plutôt que d'en dépendre, et on
      // SONDE l'apparition du champ au lieu d'un délai fixe unique : plus
      // robuste si le rendu prend quelques dizaines de ms de plus qu'prévu.
      var contenuSo = document.getElementById("so-content");
      if (contenuSo) contenuSo.hidden = false;
      if (typeof appliquerCatalogueOuverture === "function") {
        appliquerCatalogueOuverture(paneId);
      }
      var tentatives = 0;
      (function attendreEtRemplir() {
        var champ = document.querySelector(".catalog-synonym-input");
        if (!champ) {
          if (++tentatives < 12) { setTimeout(attendreEtRemplir, 50); }
          return;
        }
        champ.value = terme + ", ";
        // On centre le BLOC entier (champ + bouton), pas seulement le
        // champ : le marchand doit voir où cliquer ensuite, pas juste où
        // taper.
        var bloc = champ.closest(".catalog-synonym-add") || champ;
        bloc.scrollIntoView({ behavior: "smooth", block: "center" });
        champ.focus();
        var fin = champ.value.length;
        champ.setSelectionRange(fin, fin);
      })();
    }

    // Brief §4.5 (19 aout 2026) : "chaque ligne de Sans resultat ouvre
    // Mise en avant sur recherche PRE-REMPLIE avec la requete concernee
    // -- le passage de l'observation a l'action, aujourd'hui inexistant."
    //
    // Attribut DISTINCT de data-prefill : celui-ci vise le champ
    // synonyme (.catalog-synonym-input), pas la requete d'apercu. Deux
    // chainages differents vers la meme page ; detourner l'existant
    // aurait casse le parcours synonyme qui fonctionne.
    //
    // Meme sequence que le chainage interne deja en place depuis le
    // tableau des regles (onglet Apercu, remplissage, refresh, focus),
    // verifie avant d'ecrire plutot qu'invente. Reutilise la revelation
    // forcee de #so-content ci-dessus -- sans elle, le champ n'existe pas
    // encore dans le DOM au moment ou on le cherche.
    var requete = link.getAttribute("data-prefill-query");
    if (requete) {
      var contenuSoQ = document.getElementById("so-content");
      if (contenuSoQ) contenuSoQ.hidden = false;
      if (typeof appliquerCatalogueOuverture === "function") {
        appliquerCatalogueOuverture(paneId);
      }
      var ongletApercu = document.getElementById("so-tab-apercu");
      if (ongletApercu) ongletApercu.click();

      var essais = 0;
      (function attendreEtChercher() {
        var champQ = document.getElementById("so-preview-query");
        if (!champQ) {
          if (++essais < 12) { setTimeout(attendreEtChercher, 50); }
          return;
        }
        champQ.value = requete;
        // La cle peut ne pas etre encore posee si l'utilisateur vient
        // d'arriver : on remplit quand meme le champ (l'essentiel du
        // service rendu) et on laisse l'apercu se faire au premier
        // geste, plutot que de planter sur un appel sans cle.
        if (session.cleCourante && typeof refreshSoPreview === "function") {
          refreshSoPreview(session.cleCourante);
        }
        champQ.scrollIntoView({ behavior: "smooth", block: "center" });
        champQ.focus();
      })();
    }
  });

  document.getElementById("feedback-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var status = document.getElementById("feedback-status");
    var btn = document.getElementById("feedback-submit-btn");
    var messageInput = document.getElementById("feedback-message");
    var message = messageInput.value.trim();
    if (!message) { messageInput.focus(); return; }
    btn.disabled = true; btn.textContent = T("Envoi…");
    status.hidden = true;
    apiFetch("/v1/feedback", localStorage.getItem(SESSION_STORAGE_KEY), {
      method: "POST",
      body: { category: document.getElementById("feedback-category").value, message: message },
    }).then(function () {
      status.textContent = T("Message envoyé — une réponse vous revient directement par email.");
      status.className = "console-form-status ok";
      status.hidden = false;
      messageInput.value = "";
    }).catch(function (err) {
      status.textContent = (err && err.message) || T("Échec de l'envoi — réessayez, ou écrivez directement à contact@heurix.fr.");
      status.className = "console-form-status err";
      status.hidden = false;
    }).then(function () {
      btn.disabled = false; btn.textContent = T("Envoyer");
    });
  });

  function renderChart(daily) {
    // Chantier UX-003 (audit QA/UX/A11Y, 8 août 2026) : Chart.js vient
    // d'un CDN externe -- un bloqueur de publicite, un pare-feu
    // d'entreprise ou une panne passagere du CDN ne doivent jamais
    // faire echouer tout le chargement du tableau de bord (l'exception
    // remonterait sinon a travers la chaine de promesses de
    // loadDashboard et deconnecterait silencieusement l'utilisateur).
    if (typeof Chart === "undefined") return;
    var canvas = document.getElementById("searches-chart");
    var ctx = canvas.getContext("2d");
    var labels = daily.map(function (d) {
      var parts = d.day.split("-");
      return parts[2] + "/" + parts[1];
    });
    var data = daily.map(function (d) { return d.count; });

    // U9 (24 aout 2026, audit UI/UX). Un <canvas> est opaque pour un
    // lecteur d'ecran : le graphe des recherches quotidiennes n'existait
    // simplement pas pour qui ne le voit pas.
    //
    // Le resume est compose a partir des donnees DEJA en memoire -- rien
    // n'est recalcule ni redemande au serveur.
    //
    // Il sert aussi les voyants : un resume chiffre sous un graphe est lu
    // par tout le monde, et dit en une phrase ce qu'une courbe demande
    // d'interpreter.
    var resume = document.getElementById("searches-chart-resume");
    if (resume) {
      if (!data.length) {
        resume.textContent = T("Aucune recherche sur la période.");
      } else {
        var total = data.reduce(function (a, b) { return a + b; }, 0);
        var iMax = data.indexOf(Math.max.apply(null, data));
        resume.textContent = T(
          "{0} recherches sur {1} jours. Maximum {2} le {3}.",
          total, data.length, data[iMax], labels[iMax]);
      }
    }
    if (chart) chart.destroy();

    var gradient = ctx.createLinearGradient(0, 0, 0, canvas.clientHeight || 220);
    gradient.addColorStop(0, "#5468FF");
    gradient.addColorStop(1, "#8B9BFF");

    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: gradient,
          borderRadius: 6,
          maxBarThickness: 26,
          hoverBackgroundColor: "#3F52E8",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: "#12142B",
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: "600" },
            bodyFont: { family: "'IBM Plex Mono', monospace", size: 12.5 },
            padding: 10,
            cornerRadius: 8,
          },
        },
        scales: {
          y: {
            beginAtZero: true, ticks: { precision: 0, color: "#5B5E76", font: { size: 11.5 } },
            grid: { color: "#EEF1FF" }, border: { display: false },
          },
          x: {
            grid: { display: false }, border: { display: false },
            ticks: { color: "#5B5E76", font: { size: 11.5 } },
          },
        },
      },
    });
  }

  function renderTable(tbodyId, emptyId, rows, rowFn) {
    var tbody = document.querySelector("#" + tbodyId + " tbody");
    var empty = document.getElementById(emptyId);
    tbody.innerHTML = "";
    if (!rows.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      tr.innerHTML = rowFn(row);
      tbody.appendChild(tr);
    });
  }

  function eur(n) {
    return n.toLocaleString(LOCALE, { style: "currency", currency: "EUR" });
  }

  var convSortWired = false;
  function loadConversionData(key) {
    var sortBy = document.getElementById("conv-sort-select").value;
    Promise.all([
      apiFetch("/v1/analytics/conversion-summary?days=" + periodSelect.value, key),
      apiFetch("/v1/analytics/top-products?days=" + periodSelect.value + "&sort_by=" + sortBy + "&limit=10" + catalogueQS(), key),
    ]).then(function (results) {
      var summary = results[0], products = results[1].products;
      document.getElementById("conv-ctr").textContent = L.zeroRate(summary.click_through_rate);
      document.getElementById("conv-revenue").textContent = eur(summary.total_revenue);
      document.getElementById("conv-products").textContent = summary.products_purchased.toLocaleString(LOCALE);

      var attributedEl = document.getElementById("conv-attributed");
      var attributedLabel = document.getElementById("conv-attributed-label");
      if (summary.attributed_revenue === null) {
        attributedEl.textContent = "–";
        attributedLabel.textContent = T("CA réellement attribué (tracker non installé)");
      } else {
        attributedEl.textContent = eur(summary.attributed_revenue);
        attributedLabel.textContent = T("CA réellement attribué");
      }

      renderTable("top-products-table", "top-products-empty", products, function (p) {
        return "<td class='mono'>" + esc(p.product_id) + "</td><td class='num'>" + p.volume +
          "</td><td class='num'>" + eur(p.revenue) + "</td><td class='num'>" + (p.margin !== null ? eur(p.margin) : "–") + "</td>";
      });
    }).catch(function () {});

    if (!convSortWired) {
      convSortWired = true;
      document.getElementById("conv-sort-select").addEventListener("change", function () {
        if (session.activeKey) loadConversionData(session.activeKey);
      });
    }
  }

  // ---------------- Browse & Discovery ----------------
  var browseCatalogsLoaded = false;
  var browseAttributesCache = [];
  var browseCategoriesCache = [];
  var browseFormsWired = false;

  // ---------------- Search : priorites de requete ----------------
  var soCatalogsLoaded = false;
  var soEditingKey = null; // {query, product_id} si en cours de modification, sinon null (ajout ou duplication)
  var soFormWired = false;

  function loadSearchOverridesCatalogs(key) {
    if (soCatalogsLoaded) return;
    soCatalogsLoaded = true;
    // Chargement retire : la liste des catalogues est desormais peuplee une
    // seule fois par wireGlobalCatalog, pour toute la console.
  }

  // Correctif Lot 3 (audit UX console, 17-18 aout 2026) : "Ajout d'un
  // produit -- modale" (§4.5 du brief). Fonction unique, appelee par tous
  // les points d'entree du formulaire (bouton principal, Modifier,
  // Dupliquer, "Epingler un produit" depuis l'etat zero resultat) --
  // evite de dupliquer la logique d'ouverture a chaque appelant.
  function ouvrirSoFormModal() {
    var modal = document.getElementById("so-form-modal");
    if (modal) modal.hidden = false;
  }

  function fermerSoFormModal() {
    var modal = document.getElementById("so-form-modal");
    if (modal) modal.hidden = true;
  }

  function resetSoForm() {
    soEditingKey = null;
    document.getElementById("so-query").value = "";
    document.getElementById("so-product-id").value = "";
    // Correctif Lot 3 (audit UX console, 17-18 aout 2026) : autocompletion
    // produit (C3) -- so-product-search est le nouveau champ visible,
    // synchronise avec so-product-id (cache, garde sa semantique existante).
    document.getElementById("so-product-search").value = "";
    document.getElementById("so-action").value = "pin";
    document.getElementById("so-position").disabled = false;
    document.getElementById("so-position").value = "";
    document.getElementById("so-nom").value = "";
    document.getElementById("so-statut").value = "active";
    document.getElementById("so-priorite").value = "";
    document.getElementById("so-diffusion-debut").value = "";
    document.getElementById("so-diffusion-fin").value = "";
    document.getElementById("so-form-title").textContent = T("Ajouter une règle");
    document.getElementById("so-submit-btn").textContent = T("Ajouter la règle");
    document.getElementById("so-cancel-edit-btn").hidden = true;
    document.getElementById("so-status").textContent = "";
  }

  function fillSoForm(o) {
    document.getElementById("so-query").value = o.query;
    document.getElementById("so-product-id").value = o.productId;
    // Meme correctif Lot 3 : le vrai nom n'est pas connu a ce point (la
    // regle deja publiee, via data.overrides, ne porte pas product_name
    // -- verifie avant de supposer). L'id seul reste acceptable ici,
    // l'utilisateur vient de voir le vrai nom dans la colonne "Produit"
    // du tableau juste avant de cliquer "Modifier".
    document.getElementById("so-product-search").value = o.productId;
    document.getElementById("so-action").value = o.action;
    document.getElementById("so-position").disabled = o.action !== "pin";
    document.getElementById("so-position").value = o.position || "";
    // Correctif (19 aout 2026, brief §3.5) : nom/statut, propages depuis
    // les data-attributs poses sur le bouton (soRowHtmlCatalogue).
    document.getElementById("so-nom").value = o.nom || "";
    document.getElementById("so-statut").value = o.statut || "active";
    // Correctif (19 aout 2026, brief §3.5, priorite avec vrai effet
    // backend depuis ce matin). <input type="date"> attend "YYYY-MM-DD" :
    // extrait des dix premiers caracteres de l'ISO complet renvoye par
    // l'API (ex. "2026-09-01T00:00:00+00:00" -> "2026-09-01").
    document.getElementById("so-priorite").value = o.priorite || "";
    document.getElementById("so-diffusion-debut").value = o.diffusionDebut ? o.diffusionDebut.slice(0, 10) : "";
    document.getElementById("so-diffusion-fin").value = o.diffusionFin ? o.diffusionFin.slice(0, 10) : "";
  }

  function soRowHtml(o) {
    // Balisage repris a la charte : le declencheur devient un jeton (c'est
    // une valeur saisie, pas du texte courant), le rang une pastille (il se
    // lit plus vite qu'un chiffre nu), l'action une puce coloree selon son
    // sens. Voir les classes .cell-* dans styles.css.
    var pin = o.action === "pin";
    var actionLabel = pin
      ? "<span class='cell-action cell-action-pin'>&#9679; " + T("Épingler") + "</span>"
      : "<span class='cell-action cell-action-bury'>&#9679; " + T("Reléguer") + "</span>";
    var rang = pin && o.position
      ? "<span class='cell-rank'>" + o.position + "</span>"
      : "<span style='color:var(--ink-muted);'>–</span>";
    return "<td><span class='cell-trigger' title='" + esc(o.query) + "'>" + esc(o.query) + "</span></td>" +
      "<td>" + produitCell(o.product_id, o.product_name) + "</td>" +
      "<td>" + actionLabel + "</td>" +
      "<td>" + rang + "</td>" +
      "<td class='cell-actions'>" +
        "<button type='button' class='catalog-rule-remove' data-so-edit='1' data-query='" + esc(o.query) + "' data-product-id='" + esc(o.product_id) + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' aria-label='" + T("Modifier") + "' title='" + T("Modifier") + "'>&#9998;</button>" +
        "<button type='button' class='catalog-rule-remove' data-so-duplicate='1' data-query='" + esc(o.query) + "' data-product-id='" + esc(o.product_id) + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' aria-label='" + T("Dupliquer") + "' title='" + T("Dupliquer comme nouvelle règle") + "'>&#10697;</button>" +
        "<button type='button' class='catalog-rule-remove' data-so-delete='1' data-query='" + esc(o.query) + "' data-product-id='" + esc(o.product_id) + "' aria-label='" + T("Supprimer") + "'>&times;</button>" +
      "</td>";
  }

  // Correctif Lot 3 (audit UX console, 18 aout 2026) : onglet "Regles du
  // catalogue" (§4.6 du brief). Fonction dediee plutot que de faire
  // diverger soRowHtml (partagee avec la colonne contextuelle, §3.4, qui
  // garde sa propre structure plus simple -- "vue rapide" n'a pas besoin
  // de statut ni de nom separe).
  //
  // 4 colonnes v1 : Nom (product_name, meme repli que produitCell), 
  // Declencheur, Action (fusionne le pin/bury et la position, format du
  // brief : "Epingle pos. 4" / "Relegue"), Statut (Active/Brouillon
  // seulement -- Programmee et Inactive restent Lot 4, aucun mecanisme
  // backend actuellement, voir roadmap).
  // Correctif Lot 3 (audit UX console, 18 aout 2026) : detecte les
  // conflits de position (§4.6 du brief -- "deux regles qui visent la
  // meme position sur le meme declencheur"). Renvoie un Set de cles
  // "query|position" en conflit, calcule une fois sur toute la liste
  // avant le rendu -- pas recalcule par ligne.
  function soDetecterConflits(liste) {
    var comptes = {};
    liste.forEach(function (r) {
      if (r.action !== "pin" || !r.position) return;
      var cle = r.query.toLowerCase() + "|" + r.position;
      comptes[cle] = (comptes[cle] || 0) + 1;
    });
    var conflits = new Set();
    Object.keys(comptes).forEach(function (cle) {
      if (comptes[cle] > 1) conflits.add(cle);
    });
    return conflits;
  }

  // Correctif Lot 3 : lignes cliquables vers l'apercu (§4.6 du brief --
  // "la liste et l'apercu ne doivent jamais etre deux mondes separes").
  // data-so-aller-apercu sur les cellules non interactives seulement
  // (pas la case a cocher, pas cell-actions) pour ne jamais interferer
  // avec la selection multiple ni les boutons d'edition.
  // Correctif (20 aout 2026, audit passe 3 §4). La colonne "Regle"
  // affichait un tiret sur toutes les lignes -- aucune regle n'ayant ete
  // nommee, le champ facultatif reste vide. L'audit proposait de
  // supprimer la colonne ; c'est le brief §4.6 qui la demande, et il
  // decrit lui-meme la vraie solution : "une regle sans nom devrait
  // retomber sur une formulation lisible".
  //
  // Le libelle genere n'est PAS ecrit en base : c'est un affichage. Le
  // champ nom reste vide tant que le marchand n'en saisit pas un, et la
  // modale de modification continue de proposer un champ libre.
  //
  // Depend du nom de produit expose ce matin cote moteur : sans lui, le
  // repli aurait produit "rt-47645602185510 -- epingle sur vis", moins
  // lisible que le tiret qu'il remplace.
  function soLibelleRegle(o) {
    if (o.nom) return esc(o.nom);
    // Correctif (21 aout 2026, audit passe 4) : le libelle repetait le
    // nom du produit, deja porte par la colonne voisine -- chaque ligne
    // faisait donc deux fois sa hauteur utile pour la meme information.
    // Il ne dit plus que ce que la colonne Nom ne dit pas.
    //
    // La colonne est CONSERVEE, contre l'avis de l'audit : le brief §4.6
    // la demande, et elle porte un nom saisi des qu'il y en a un.
    var geste = o.action === "pin"
      ? (o.position ? T("Épinglé en {0}", o.position) : T("Épinglé"))
      : T("Relégué");
    return "<span class='so-regle-auto' title='" + escAttr(T("Nom généré — vous pouvez en saisir un dans la règle")) + "'>" +
      esc(geste) + "</span>";
  }

  function soRowHtmlCatalogue(o, enBrouillon, conflits) {
    var pin = o.action === "pin";
    var cleConflit = pin && o.position ? o.query.toLowerCase() + "|" + o.position : null;
    var enConflit = cleConflit && conflits && conflits.has(cleConflit);
    var actionLabel = pin
      ? "<span class='cell-action cell-action-pin'>" + ICONES_FICHE.pinPlein + " " + (o.position ? T("Épinglé pos. {0}", o.position) : T("Épinglé")) + "</span>"
      : "<span class='cell-action cell-action-bury'>&#8595; " + T("Relégué") + "</span>";
    if (enConflit) {
      actionLabel += "<button type='button' class='so-conflit-badge' data-so-conflit-info='1' data-query='" + esc(o.query) + "' data-position='" + o.position + "' aria-label='" + T("Conflit de position — cliquer pour en savoir plus") + "' title='" + T("Une autre règle vise déjà la position {0} sur cette recherche.", o.position) + "'>&#9888;</button>";
    }
    // Correctif (19 aout 2026, brief §3.5) : "Brouillon" (frontend, pas
    // encore publie) prend le pas sur le vrai statut backend quand
    // enBrouillon est vrai -- les deux concepts sont distincts (un
    // brouillon local peut porter n'importe quel statut backend une fois
    // publie), mais melanger les deux ici serait plus confus qu'utile.
    var STATUTS_LABELS = {
      active: T("Active"), brouillon: T("Brouillon"),
      programmee: T("Programmée"), inactive: T("Inactive"),
    };
    var statutReel = enBrouillon ? "brouillon" : (o.statut || "active");
    var statutLabel = "<span class='cell-statut cell-statut-" + statutReel + "'>" + (STATUTS_LABELS[statutReel] || statutReel) + "</span>";
    var attrsLigne = "data-so-aller-apercu='1' data-query='" + esc(o.query) + "'";
    // Correctif (19 aout 2026, brief §3.5, priorite avec vrai effet
    // backend depuis ce matin). Affichage compact plutot que deux
    // nouvelles colonnes pleines -- le tableau porte deja sept colonnes,
    // priorite et diffusion restent secondaires face au nom de la regle,
    // pas assez frequemment utilisees pour meriter leur propre colonne.
    // Construit ICI, avant le return, plutot qu'au milieu de la chaine
    // de concatenation -- un vrai bug de syntaxe repere par node -c au
    // premier essai, corrige avant de continuer.
    var indicateurs = "";
    if (o.priorite && o.priorite !== 100) indicateurs += "<span class='so-regle-indicateur' title='" + T("Priorité") + " " + o.priorite + "'>#" + o.priorite + "</span>";
    if (o.diffusion && (o.diffusion.debut || o.diffusion.fin)) indicateurs += "<span class='so-regle-indicateur' title='" + T("Période de diffusion définie") + "'>" + ICONES_FICHE.calendrier + "</span>";
    return "<td class='so-cell-select'><input type='checkbox' class='so-row-check' data-so-select='1' data-query='" + esc(o.query) + "' data-product-id='" + esc(o.product_id) + "' aria-label='" + T("Sélectionner cette règle") + "'></td>" +
      "<td " + attrsLigne + " class='so-cell-cliquable'>" + produitCell(o.product_id, o.product_name) + "</td>" +
      "<td " + attrsLigne + " class='so-cell-cliquable'><span class='cell-trigger' title='" + esc(o.query) + "'>" + esc(o.query) + "</span></td>" +
      "<td " + attrsLigne + " class='so-cell-cliquable'>" + soLibelleRegle(o) + indicateurs + "</td>" +
      "<td " + attrsLigne + " class='so-cell-cliquable'>" + actionLabel + "</td>" +
      "<td " + attrsLigne + " class='so-cell-cliquable'>" + statutLabel + "</td>" +
      "<td class='cell-actions'>" +
        "<button type='button' class='catalog-rule-remove' data-so-edit='1' data-query='" + esc(o.query) + "' data-product-id='" + esc(o.product_id) + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' data-nom='" + escAttr(o.nom || "") + "' data-statut='" + escAttr(o.statut || "active") + "' data-priorite='" + (o.priorite || "") + "' data-diffusion-debut='" + escAttr((o.diffusion && o.diffusion.debut) || "") + "' data-diffusion-fin='" + escAttr((o.diffusion && o.diffusion.fin) || "") + "' aria-label='" + T("Modifier") + "' title='" + T("Modifier") + "'>&#9998;</button>" +
        "<button type='button' class='catalog-rule-remove' data-so-duplicate='1' data-query='" + esc(o.query) + "' data-product-id='" + esc(o.product_id) + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' data-nom='" + escAttr(o.nom || "") + "' data-statut='" + escAttr(o.statut || "active") + "' data-priorite='" + (o.priorite || "") + "' data-diffusion-debut='" + escAttr((o.diffusion && o.diffusion.debut) || "") + "' data-diffusion-fin='" + escAttr((o.diffusion && o.diffusion.fin) || "") + "' aria-label='" + T("Dupliquer") + "' title='" + T("Dupliquer comme nouvelle règle") + "'>&#10697;</button>" +
        "<button type='button' class='catalog-rule-remove' data-so-delete='1' data-query='" + esc(o.query) + "' data-product-id='" + esc(o.product_id) + "' aria-label='" + T("Supprimer") + "'>&times;</button>" +
      "</td>";
  }

  // Presentation d'un produit dans les tableaux de la console. Un
  // identifiant nu ("VIS-M8-020-A2") ne dit rien a un marchand : le nom
  // passe en premier, l'identifiant devient une precision secondaire.
  // Repli sur l'identifiant seul si le nom est absent -- produit supprime
  // depuis, ou catalogue indexe sans champ `name`.
  function produitCell(id, nom, prix) {
    var html = nom
      ? "<strong style='font-size:13px;'>" + esc(nom) + "</strong>" +
        "<span class='mono' style='display:block; font-size:11.5px; color:var(--ink-muted); margin-top:2px;'>" + esc(id) + "</span>"
      : "<span class='mono'>" + esc(id) + "</span>";
    if (prix !== undefined && prix !== null) {
      html += "<span style='display:block; font-size:12px; font-weight:700; color:var(--blue-deep); margin-top:3px;'>" +
        Number(prix).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €</span>";
    }
    return html;
  }

  // ---------------- Apercu des resultats (Priorites de requete) ----------------
  //
  // Symetrique de refreshBrowsePreview : on appelle le VRAI endpoint de
  // recherche, donc ce qui s'affiche est exactement ce que verrait un
  // visiteur. La colonne « pourquoi » vient du champ `matched` renvoye par
  // le moteur -- c'est elle qui rend l'ecran utile : elle explique le
  // classement au lieu de le constater.
  var soPreviewTimer = null;
  // Brouillon en cours : null = aucun, sinon la liste COMPLETE des priorites
  // telles qu'elles seraient apres application. Le moteur remplace l'ensemble
  // persiste par cette liste, il ne fusionne pas -- c'est ce qui permet de
  // previsualiser aussi une suppression.
  // Ordre des produits tel qu'AFFICHE au dernier rendu. C'est sur lui que
  // portent « monter » et « descendre » -- pas sur le seul bloc epingle.
  var soOrdreAffiche = [];
  // Facettes actives dans l'apercu. Elles servent a VERIFIER qu'une regle
  // survit a un filtrage visiteur -- pas a editer : voir le garde-fou dans
  // le rendu des fiches.
  var soFiltres = [];

  // Correctif (20 aout 2026, retour Alexis : "aligner la barre sur la
  // grille de resultats"). La barre est en position:fixed -- elle a donc
  // quitte le flux et ne peut plus heriter de la largeur de la colonne.
  // Un calcul en pourcentages ne peut pas tomber juste : la position de
  // la grille depend de la sidebar, du rail contextuel et de la largeur
  // d'ecran. Mesure faite en direct avec Alexis, l'ecart etait de 157px
  // a gauche et 46px de trop en largeur.
  //
  // On lit donc la position reelle de la grille au moment de l'afficher,
  // et on la reapplique au redimensionnement.
  // Correctif (21 aout 2026, demande Alexis apres la note UX). Le texte
  // renvoie a un bouton « Publier » qui vit dans une barre flottante, en
  // bas d'ecran : sur une grille longue, elle peut etre hors champ au
  // moment ou on lit la phrase.
  //
  // Le mot devient cliquable et fait DEFILER jusqu'a la barre. Il ne la
  // fait pas apparaitre -- elle se montre deja d'elle-meme des qu'un
  // brouillon existe ; un lien qui la « revelerait » ferait doublon.
  // Quand aucun brouillon n'existe, rien a montrer : le lien reste
  // inerte plutot que de pointer dans le vide.
  document.addEventListener("click", function (e) {
    var lien = e.target.closest("[data-aller-barre]");
    if (!lien) return;
    var barre = document.getElementById(lien.getAttribute("data-aller-barre"));
    if (!barre || barre.hidden) return;
    barre.scrollIntoView({ behavior: "smooth", block: "center" });
    barre.classList.add("so-simu-bar-signalee");
    setTimeout(function () { barre.classList.remove("so-simu-bar-signalee"); }, 1200);
  });

  // Selecteur de portee des regles de categorie (21 aout 2026, note UX).
  // Les deux mecaniques restent DISTINCTES -- l'une vise un produit
  // nomme, l'autre une famille entiere -- mais visibles cote a cote,
  // avec le meme geste pour y acceder.
  // Popover des reglages d'affichage, cote categorie (21 aout 2026).
  // Meme mecanique que sur la page soeur : le panneau est en position
  // absolue, il ne pousse donc aucun produit a l'ouverture.
  // PASTILLE DU MENU COMPTE (24 aout 2026, audit du bandeau).
  //
  // Le bouton portait la raison sociale en texte nu : chez un client
  // nomme comme son produit, on lisait « Heurix » juste a cote du logo
  // « Heurix ». Rien ne distinguait le menu de compte de la marque.
  //
  // Le correctif du 21 aout -- afficher l'ecran courant dans le bouton --
  // attenuait la confusion sans la lever : elle revient des qu'on est sur
  // le tableau de bord.
  //
  // Une pastille avec initiale distingue par la FORME, pas par le texte :
  // elle fonctionne quel que soit le nom de l'organisation.
  function majPastilleCompte(btn, libelle) {
    var base = (libelle || "").trim();
    // Initiale : premiere lettre du premier mot, en majuscule. Repli sur
    // un point d'interrogation plutot qu'un vide, pour qu'une raison
    // sociale absente se voie au lieu de laisser un rond blanc.
    var initiale = base ? base.charAt(0).toUpperCase() : "?";
    btn.innerHTML = "";
    var pastille = document.createElement("span");
    pastille.className = "console-org-avatar";
    pastille.setAttribute("aria-hidden", "true");
    pastille.textContent = initiale;
    var nom = document.createElement("span");
    nom.className = "console-org-nom";
    nom.textContent = base;
    btn.appendChild(pastille);
    btn.appendChild(nom);
    btn.classList.add("console-org-pastille");
  }

  function brCablerReglages() {
    var btn = document.getElementById("br-reglages-btn");
    var panneau = document.getElementById("br-reglages-panel");
    if (!btn || !panneau) return;
    // Correctif (21 aout 2026, getEventListeners avec Alexis : DEUX
    // ecouteurs de clic sur le meme bouton). Cette fonction etait
    // appelee deux fois : le premier clic ouvrait, le second refermait
    // dans la foulee. stopPropagation n'y pouvait rien -- les deux
    // ecouteurs vivent sur le MEME element, l'evenement n'a pas besoin
    // de remonter pour les declencher tous les deux.
    if (btn.dataset.cable === "1") return;
    btn.dataset.cable = "1";
    btn.addEventListener("click", function (e) {
      // Correctif (21 aout 2026, diagnostic par MutationObserver avec
      // Alexis : DEUX mutations sur un seul clic). L'ecouteur de
      // fermeture pose sur `document` recevait le meme evenement et
      // refermait le panneau aussitot ouvert -- le bouton paraissait
      // inerte. La garde btn.contains() ne suffisait pas : le clic peut
      // viser un noeud interne au bouton, hors de sa portee au moment ou
      // l'evenement remonte.
      //
      // stopPropagation tranche a la source : l'evenement ne remonte
      // simplement plus jusqu'au document.
      e.stopPropagation();
      var ouvert = panneau.hidden;
      panneau.hidden = !ouvert;
      btn.setAttribute("aria-expanded", ouvert ? "true" : "false");
    });
    // Fermeture au clic exterieur : sans cela, le panneau reste ouvert
    // et masque les produits qu'il sert justement a regler.
    document.addEventListener("click", function (e) {
      if (panneau.hidden) return;
      if (btn.contains(e.target) || panneau.contains(e.target)) return;
      panneau.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function brCablerOngletsRegles() {
    var ongletP = document.getElementById("br-onglet-produit");
    var ongletA = document.getElementById("br-onglet-attribut");
    var voletP = document.getElementById("br-volet-produit");
    var voletA = document.getElementById("br-volet-attribut");
    if (!ongletP || !ongletA || !voletP || !voletA) return;

    function basculer(versProduit) {
      voletP.hidden = !versProduit;
      voletA.hidden = versProduit;
      ongletP.classList.toggle("br-regles-onglet-on", versProduit);
      ongletA.classList.toggle("br-regles-onglet-on", !versProduit);
      ongletP.setAttribute("aria-selected", versProduit ? "true" : "false");
      ongletA.setAttribute("aria-selected", versProduit ? "false" : "true");
    }
    ongletP.addEventListener("click", function () { basculer(true); });
    ongletA.addEventListener("click", function () { basculer(false); });
  }

  // Compteur de l'en-tete : il couvre LES DEUX volets. Ne compter que
  // l'onglet visible ferait retomber dans l'invisible par defaut que ce
  // panneau corrige -- des regles par attribut existeraient sans que
  // rien ne le montre depuis l'onglet Produit.
  function brMajCompteRegles() {
    var cible = document.getElementById("br-regles-compte");
    if (!cible) return;
    function lignes(id) {
      var t = document.querySelector("#" + id + " tbody");
      return t ? t.querySelectorAll("tr").length : 0;
    }
    var total = lignes("browse-overrides-table") + lignes("browse-attribute-rules-table");
    cible.textContent = total ? T("{0} règle(s)", total) : T("aucune règle");
    cible.classList.toggle("br-regles-compte-vide", !total);
  }

  function simuBarAligner(prefix) {
    var bar = document.getElementById(prefix + "-simu-bar");
    var grille = document.getElementById(prefix === "so" ? "so-preview-grid" : "br-grid");
    if (!bar || !grille || bar.hidden) return;
    var r = grille.getBoundingClientRect();
    if (!r.width) return;
    bar.style.left = Math.round(r.left) + "px";
    bar.style.width = Math.round(r.width) + "px";
    bar.style.transform = "none";
  }

  function simuBarUpdate(prefix, draft) {
    var bar = document.getElementById(prefix + "-simu-bar");
    var texte = document.getElementById(prefix + "-simu-text");
    var n = (draft || []).length;
    if (bar) bar.hidden = !draft || n === 0;
    if (texte) {
      texte.textContent = T(n > 1 ? "{0} changements non publiés. Vos visiteurs voient toujours le classement actuel." : "{0} changement non publié. Vos visiteurs voient toujours le classement actuel.", n);
    }
    simuBarAligner(prefix);
  }

  // Les deux barres suivent le redimensionnement. Un seul ecouteur pour
  // les deux pages : celle qui est masquee sort d'elle-meme.
  window.addEventListener("resize", function () {
    simuBarAligner("so");
    simuBarAligner("br");
  });

  // Correctif Lot 2 (audit UX console, 17 aout 2026) : annulation avec
  // retour arriere (regle 4, partie 5 du brief -- toute action
  // destructive laisse 10 secondes pour revenir). L'action se produit
  // IMMEDIATEMENT (pas de confirmation prealable, remplace le
  // window.confirm() de B6) ; le toast propose ensuite de revenir en
  // arriere en restaurant onRestore(). Un seul minuteur global : un
  // second appel avant expiration remplace le precedent plutot que
  // d'empiler deux toasts.
  var undoTimer = null;
  function showUndoToast(message, onRestore) {
    var toast = document.getElementById("undo-toast");
    var msgEl = document.getElementById("undo-toast-message");
    var btn = document.getElementById("undo-toast-btn");
    if (!toast || !msgEl || !btn) return;

    clearTimeout(undoTimer);
    msgEl.textContent = message;
    toast.hidden = false;

    var restaure = false;
    var nouveauBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(nouveauBtn, btn);
    nouveauBtn.addEventListener("click", function () {
      if (restaure) return;
      restaure = true;
      clearTimeout(undoTimer);
      toast.hidden = true;
      onRestore();
    });

    undoTimer = setTimeout(function () { toast.hidden = true; }, 10000);
  }

  // Correctif Lot 2 (audit UX console, 17 aout 2026) : recapitulatif
  // avant publication (§4.4 -- "corrige le defaut le plus grave (B3) :
  // aujourd'hui, on publie sans pouvoir relire"). Fonction generique,
  // partagee par Search Overrides et Browse & Discovery (regle 2).
  //
  // Perimetre : regles pin/bury uniquement (session.soDraft/brDraft).
  // Les synonymes ne sont PAS couverts -- systeme d'ecriture immediate
  // completement separe (creerSynonyme, PUT direct sur /synonyms, vecu
  // sur l'onglet Observer plutot Que Optimiser), chantier distinct.
  //
  // groupBy(entree) -> cle de regroupement (query pour Search Overrides,
  // chaine fixe unique pour Browse & Discovery -- pas de requete la-bas,
  // parcours par categorie). groupLabel(cle) -> titre du groupe affiche.
  function openRecapModal(catalogName, draft, groupBy, groupLabel, onRemove, onPublish) {
    var modal = document.getElementById("recap-modal");
    var summary = document.getElementById("recap-modal-summary");
    var groupsEl = document.getElementById("recap-modal-groups");
    var closeBtn = document.getElementById("recap-modal-close");
    var publishBtn = document.getElementById("recap-modal-publish");
    if (!modal || !summary || !groupsEl || !closeBtn || !publishBtn) return;

    function ligneTexte(r) {
      if (r.action === "pin") {
        // Ecart assume avec le brief §4.4, dont la maquette montre
        // litteralement "📌" et "⤓" : meme raison que partout ailleurs,
        // un emoji ne suit pas la couleur du texte et change d'aspect
        // selon le systeme. Le geste decrit reste le meme.
        return ICONES_FICHE.pinPlein + " " + esc(r.product_name || r.product_id) +
          (r.position ? " — " + T("Épinglé en position {0}", r.position) : " — " + T("Épinglé")) +
          " — " + esc(r.product_id);
      }
      return "⤓ " + esc(r.product_name || r.product_id) + " — " + T("Relégué en fin de liste") +
        " — " + esc(r.product_id);
    }

    function render() {
      var n = (draft || []).length;
      if (n === 0) { modal.hidden = true; return; }

      summary.textContent = T(n > 1 ? "{0} changements sur le catalogue {1}. Vos visiteurs ne voient encore rien." : "{0} changement sur le catalogue {1}. Vos visiteurs ne voient encore rien.", n, catalogName);

      var groupes = {};
      var ordreGroupes = [];
      draft.forEach(function (r) {
        var cle = groupBy(r);
        if (!groupes[cle]) { groupes[cle] = []; ordreGroupes.push(cle); }
        groupes[cle].push(r);
      });

      groupsEl.innerHTML = ordreGroupes.map(function (cle) {
        return "<p class='recap-modal-group-title'>" + esc(groupLabel(cle)) + "</p>" +
          groupes[cle].map(function (r, idx) {
            return "<div class='recap-modal-row' data-recap-key='" + esc(cle) + "::" + idx + "'>" +
              "<span class='recap-modal-row-text'>" + ligneTexte(r) + "</span>" +
              "<button type='button' class='recap-modal-row-remove' data-recap-remove='" + esc(r.product_id) + "' data-recap-query='" + esc(r.query || "") + "' aria-label='" + T("Supprimer cette règle") + "'>&times;</button>" +
            "</div>";
          }).join("");
      }).join("");
    }

    render();
    modal.hidden = false;

    groupsEl.onclick = function (e) {
      var btn = e.target.closest("[data-recap-remove]");
      if (!btn) return;
      var pid = btn.getAttribute("data-recap-remove");
      var query = btn.getAttribute("data-recap-query");
      // Correctif regle 4 (partie 5 du brief) : toute suppression laisse
      // un retour arriere, y compris celles faites depuis ce
      // recapitulatif -- pas seulement "Tout annuler".
      // ES5 plutot que .findIndex() (ES6) : coherence avec le reste du
      // fichier, qui n'utilise ni let/const ni arrow functions.
      var idx = -1;
      for (var iRecap = 0; iRecap < draft.length; iRecap++) {
        if (draft[iRecap].product_id === pid && (draft[iRecap].query || "") === query) { idx = iRecap; break; }
      }
      if (idx === -1) return;
      var supprime = draft[idx];
      draft.splice(idx, 1);
      render();
      onRemove(draft);
      showUndoToast(T("Règle supprimée."), function () {
        draft.splice(idx, 0, supprime);
        render();
        onRemove(draft);
      });
    };

    closeBtn.onclick = function () { modal.hidden = true; };
    publishBtn.onclick = function () { modal.hidden = true; onPublish(); };
  }
  function soSimuBar(actif) {
    simuBarUpdate("so", actif ? session.soDraft : null);
  }

  function soRenderFacettes(facets, key) {
    var zone = document.getElementById("so-facets");
    var avert = document.getElementById("so-facet-warn");
    if (!zone) return;
    var groupes = Object.keys(facets).filter(function (g) {
      return Object.keys(facets[g] || {}).length > 1;
    });
    if (!groupes.length) {
      zone.hidden = true;
      if (avert) avert.hidden = true;
      return;
    }
    zone.hidden = false;
    if (avert) avert.hidden = soFiltres.length === 0;

    zone.innerHTML = groupes.map(function (g) {
      var valeurs = facets[g];
      return "<span class='so-facet-group'>" + esc(g) + "</span>" +
        Object.keys(valeurs).slice(0, 8).map(function (v) {
          var jeton = g + ":" + v;
          var actif = soFiltres.indexOf(jeton) !== -1;
          return "<button type='button' class='so-facet-chip" + (actif ? " on" : "") +
            "' data-facet='" + esc(jeton) + "'>" + esc(v) + " (" + valeurs[v] + ")</button>";
        }).join("");
    }).join("");

    zone.querySelectorAll("[data-facet]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var jeton = btn.getAttribute("data-facet");
        var i = soFiltres.indexOf(jeton);
        if (i === -1) soFiltres.push(jeton); else soFiltres.splice(i, 1);
        refreshSoPreview(key);
      });
    });
  }

  // Correctif (18 aout 2026, brief §"Etat initial, aucune recherche
  // saisie -- ecran d'amorce") : "le chainon manquant entre observation
  // et action". Deux vrais endpoints deja existants et deployes,
  // charges en parallele -- pas de nouveau code backend necessaire.
  function soRafraichirAmorce(key) {
    var conteneur = document.getElementById("so-preview-amorce");
    if (!conteneur || !session.soCurrentCatalog) return;
    var catalog = encodeURIComponent(session.soCurrentCatalog);
    Promise.all([
      apiFetch("/v1/analytics/top-queries?catalog=" + catalog + "&limit=8", key).catch(function () { return { queries: [] }; }),
      apiFetch("/v1/analytics/zero-results?catalog=" + catalog + "&limit=8", key).catch(function () { return { queries: [] }; }),
    ]).then(function (resultats) {
      var frequentes = resultats[0].queries || [];
      var sansResultat = resultats[1].queries || [];
      if (!frequentes.length && !sansResultat.length) { conteneur.hidden = true; return; }

      // Correctif (20 aout 2026, capture Alexis). Cette fonction est
      // ASYNCHRONE : lancee quand le champ est vide, elle revenait apres
      // que l'utilisateur ait tape et reaffichait l'amorce PAR-DESSUS
      // les resultats. On revalide l'etat du champ au retour des appels
      // plutot qu'a leur depart.
      var champActuel = document.getElementById("so-preview-query");
      if (champActuel && champActuel.value.trim()) { conteneur.hidden = true; return; }

      conteneur.hidden = false;

      // Correctif (20 aout 2026, retour Alexis : "trop d'espace, trop de
      // volume, on ne voit plus les resultats"). Une seule rangee au lieu
      // de deux blocs titres : deux titres, deux paragraphes et deux
      // marges pour montrer une dizaine de mots etait disproportionne.
      // Les requetes sans resultat restent distinguees par un point
      // ambre plutot que par un bloc separe.
      //
      // Six suggestions au lieu de huit par bloc : l'amorce suggere, elle
      // n'enumere pas -- au-dela on lit une liste, plus un raccourci.
      var LIMITE_CHIPS = 6;
      var vues = {};
      var chips = [];
      sansResultat.slice(0, 3).forEach(function (r) {
        vues[r.query] = true;
        chips.push({ query: r.query, vide: true });
      });
      frequentes.forEach(function (r) {
        if (chips.length >= LIMITE_CHIPS || vues[r.query]) return;
        vues[r.query] = true;
        chips.push({ query: r.query, vide: false });
      });

      conteneur.innerHTML =
        "<p class='so-amorce-titre-principal'>" + T("Recherches récentes de vos visiteurs") + "</p>" +
        "<div class='so-amorce-chips'>" +
          chips.map(function (c) {
            return "<button type='button' class='so-amorce-chip" + (c.vide ? " so-amorce-chip-vide" : "") + "'" +
              " data-so-amorce-query='" + esc(c.query) + "'" +
              (c.vide ? " title='" + escAttr(T("Cette recherche ne renvoie aucun résultat")) + "'" : "") + ">" +
              esc(c.query) +
            "</button>";
          }).join("") +
        "</div>";
    }).catch(function () { conteneur.hidden = true; });
  }

  // Correctif (19 aout 2026, brief §4.1 "Pipeline contextuel").
  // Comprehension parse le vrai texte brut deja present dans
  // hits[].matched ("terme 'X' (depuis 'Y', x0.35)", verifie dans
  // heurix-engine avant de construire) plutot que d'ajouter un nouveau
  // champ backend -- exactement la reformulation demandee par le brief
  // ("le facteur multiplicatif devient un pourcentage signe ; 'depuis'
  // devient 'saisi' ; 'terme' disparait"), sans jamais afficher la
  // forme brute. Deduplique sur l'ensemble des hits : la correction
  // s'applique a la requete entiere, pas a un seul produit.
  // Correctif (19 aout 2026, brief §4.1 "Explication du classement" --
  // tableau detaille par carte). Extrait de soPipelineComprehension pour
  // devenir une vraie fonction partagee : le tableau detaille en a
  // besoin aussi (variant, token ET penalty, cette derniere jusqu'ici
  // capturee par le regex mais jamais lue), plutot que de dupliquer ce
  // meme parsing une troisieme fois. Retourne null sur une ligne qui ne
  // correspond pas a ce format (ex. "annotation #...").
  function soParserLigneMatched(ligne) {
    var m = ligne.match(/terme '([^']+)' \(depuis '([^']+)', x([\d.]+)\)/);
    if (!m) return null;
    return { variant: m[1], token: m[2], penalty: parseFloat(m[3]) };
  }

  // Correctif (19 aout 2026, brief §4.1 "Explication du classement" --
  // "panneau deplie, tableau a trois colonnes"). Meme reformulation
  // deja validee (soParserLigneMatched, "rapproche de") plutot qu'une
  // deuxieme version divergente. Signe NEGATIF sur le pourcentage
  // "Mot trouve" : (1-penalty) mesure combien un match imparfait
  // contribue MOINS qu'un match exact, jamais un gain -- l'exemple du
  // brief le montre explicitement ("-65%"), jamais positif sur cette
  // ligne precise (contrairement a Popularite, qui peut vraiment
  // augmenter le score).
  function soCardTableauDetaille(h, i) {
    var lignes = [];
    (h.matched || []).forEach(function (m) {
      var p = soParserLigneMatched(m);
      if (!p) return;
      var pct = Math.round((1 - p.penalty) * 100);
      var texte = p.variant === p.token
        ? T("« {0} »", p.token)
        : T("« {0} » rapproché de « {1} »", p.token, p.variant);
      lignes.push([T("Mot trouvé"), texte, pct === 0 ? "—" : ("-" + pct + "%")]);
    });
    if (typeof h.popularity_impact_pct === "number") {
      var pctPop = h.popularity_impact_pct;
      var signePop = pctPop >= 0 ? "+" : "";
      lignes.push([T("Popularité"), "", signePop + pctPop + "%"]);
    }
    var texteRegle = h.pinned ? T("épinglé") : (h.buried ? T("relégué") : T("aucune"));
    lignes.push([T("Règle"), texteRegle, "—"]);

    var lignesHtml = lignes.map(function (l) {
      return "<div class='so-card-detail-ligne'><span>" + esc(l[0]) + "</span><span>" + l[1] + "</span><span>" + esc(l[2]) + "</span></div>";
    }).join("");

    return "<div class='so-card-detail'>" + lignesHtml +
      "<div class='so-card-detail-resultat'><span>" + T("Résultat") + "</span><span>" + T("score {0}", h.score) + "</span><span>" + T("position {0}", i + 1) + "</span></div>" +
      "</div>";
  }

  function soPipelineComprehension(q, hits) {
    var corrections = {};
    var ordre = [];
    hits.forEach(function (h) {
      (h.matched || []).forEach(function (m) {
        var p = soParserLigneMatched(m);
        if (p && p.variant !== p.token && !corrections[p.token]) {
          corrections[p.token] = p.variant;
          ordre.push(p.token);
        }
      });
    });
    if (!ordre.length) return T("« {0} » — aucune correction", q);
    // Correctif (19 aout 2026, retour Alexis apres verification backend) :
    // "saisi" implique a tort une faute de frappe -- verifie dans
    // heurix-engine, synonymes et fautes partagent exactement le meme
    // mecanisme et le meme texte brut (credit(), SYNONYM_PENALTY vs
    // FUZZY_PENALTY), aucun signal explicite ne distingue les deux cas
    // cote donnees. "rapproche de" reste vrai dans les deux cas plutot
    // que de deviner.
    var parties = ordre.map(function (saisi) {
      return T("« {0} » rapproché de « {1} »", saisi, corrections[saisi]);
    });
    return parties.join(" · ");
  }

  // Correctif (19 aout 2026, brief §4.1). Version textuelle simple pour
  // Correctif (19 aout 2026, brief §4.1). popularity_impact_pct
  // desormais expose par le backend (verifie et deploye avant de
  // construire) -- le vrai pourcentage remplace l'ancienne version
  // textuelle. Affiche l'impact du PREMIER resultat (le mieux classe) :
  // le pipeline reste global a la recherche, pas par carte, et le
  // premier resultat illustre le mieux "pourquoi ce produit est en
  // tete", coherent avec l'exemple du brief (un seul produit precis).
  function soPipelineClassement(q, hits) {
    if (!q) return T("ordre alphabétique");
    var premier = hits && hits[0];
    if (premier && typeof premier.popularity_impact_pct === "number") {
      var signe = premier.popularity_impact_pct >= 0 ? "+" : "";
      return T("pertinence du mot") + " · " + T("popularité") + " " + signe + premier.popularity_impact_pct + "%";
    }
    return T("pertinence du mot + popularité récente");
  }

  // Correctif (19 aout 2026, retour Alexis apres capture reelle) :
  // bouton "?" gere en plus du panneau (remplace <details>, "casse la
  // ligne de lecture" une fois ouvert -- signale par Alexis). Grille
  // 2x2 plutot que liste verticale, demande explicitement.
  function soRafraichirPipeline(q, data, hits) {
    var pipeline = document.getElementById("so-pipeline");
    var etapes = document.getElementById("so-pipeline-etapes");
    var bouton = document.getElementById("so-pipeline-btn");
    if (!pipeline || !etapes) return;
    if (!q) {
      pipeline.hidden = true;
      if (bouton) bouton.hidden = true;
      return;
    }
    if (bouton) bouton.hidden = false;

    var nbRegles = (session.soDraft || []).filter(function (r) {
      return q.toLowerCase().indexOf(r.query.toLowerCase()) !== -1;
    }).length;
    var texteRegles = nbRegles > 0
      ? T(nbRegles > 1 ? "{0} règles appliquées — elles passent après le classement automatique" : "{0} règle appliquée — elle passe après le classement automatique", nbRegles)
      : T("aucune règle sur cette recherche");

    var etapesTexte = [
      [T("Compréhension"), soPipelineComprehension(q, hits)],
      [T("Correspondance"), T("{0} produits sur {1} contiennent ces mots", hits.length, data.total)],
      [T("Classement"), soPipelineClassement(q, hits)],
      [T("Vos règles"), texteRegles],
    ];
    etapes.innerHTML = etapesTexte.map(function (e, i) {
      return "<div class='so-pipeline-etape'><span class='so-pipeline-num'>" + (i + 1) + "</span><strong>" + esc(e[0]) + "</strong><span class='so-pipeline-detail'>" + esc(e[1]) + "</span></div>";
    }).join("");
  }

  function refreshSoPreview(key) {
    var champ = document.getElementById("so-preview-query");
    var vide = document.getElementById("so-preview-empty");
    var grille = document.getElementById("so-preview-grid");
    var legende = document.getElementById("so-preview-caption");
    var amorce = document.getElementById("so-preview-amorce");
    if (!champ || !session.soCurrentCatalog) return;

    var q = champ.value.trim();
    if (!q) {
      if (grille) grille.innerHTML = "";
      if (legende) legende.textContent = "";
      if (vide) vide.hidden = true;
      soRafraichirAmorce(key);
      return;
    }
    if (amorce) amorce.hidden = true;
    var champLimite = document.getElementById("so-preview-limit");
    var limite = champLimite ? parseInt(champLimite.value, 10) : 12;
    var horsStock = document.getElementById("so-in-stock");
    var corpsRequete = {
      q: q, limit: limite, facets: ["brand", "categories"], filters: soFiltres,
      // Part AUSSI en simulation : sinon l'apercu simule montrerait autre
      // chose que ce que verra le visiteur.
      in_stock_only: !!(horsStock && horsStock.checked),
      include_highlights: true,
    };
    // REGROUPEMENT PAR FAMILLE. Mesuré sur un catalogue de 10 000 produits :
    // « vis M8 inox » renvoie 6 582 résultats dont les premiers ne diffèrent
    // que par la longueur. Regroupés, ils deviennent 52 familles.
    //
    // C'est la meilleure démonstration commerciale du moteur : montrer
    // 6 582 lignes devenues 52 familles navigables parle immédiatement à un
    // distributeur, bien plus qu'une explication sur les annotations.
    var grouper = document.getElementById("so-grouper");
    var enFamilles = !!(grouper && grouper.checked);
    if (enFamilles) corpsRequete.group_by = "auto";
    if (session.soDraft) corpsRequete.simulate_overrides = session.soDraft;
    // Correctif (18 aout 2026, brief §"Reglages d'apercu") : meme
    // pattern que so-grouper -- lu directement depuis le DOM au moment
    // du rendu, pas d'etat separe.
    var visuelsBtn = document.getElementById("so-visuels");
    var afficherVisuels = !!(visuelsBtn && visuelsBtn.checked);

    apiFetch("/v1/index/" + encodeURIComponent(session.soCurrentCatalog) + "/search", key,
             { method: "POST", body: corpsRequete })
      .then(function (data) {
        // La réponse groupée a une FORME DIFFÉRENTE : « groupes » au lieu de
        // « hits ». On la traite à part plutôt que de bricoler une
        // conversion, qui masquerait ce que le moteur renvoie vraiment.
        if (enFamilles) {
          var groupes = data.groupes || [];
          if (!groupes.length) {
            grille.innerHTML = "";
            legende.textContent = "";
            vide.hidden = false;
            return;
          }
          vide.hidden = true;
          grille.innerHTML = groupes.map(function (g) {
            var p = g.representant || {};
            return "<div class='so-famille'>" +
              "<div class='so-famille-nom'>" + esc(g.famille) + "</div>" +
              "<div class='so-famille-compte'>" + T(g.produits > 1 ? "{0} produits" : "{0} produit", g.produits) + "</div>" +
              "<div class='so-famille-ex'>" + T("ex. {0}", esc(p.name || p.id || "")) + "</div>" +
              (g.etiquettes && g.etiquettes.length
                ? "<div class='so-famille-tags'>" +
                  g.etiquettes.map(function (t) {
                    return "<span>" + esc(t) + "</span>";
                  }).join("") + "</div>"
                : "") +
            "</div>";
          }).join("");
          legende.textContent = T("{0} résultats regroupés en {1} familles, classées par pertinence.",
            data.total.toLocaleString(LOCALE), data.familles);
          return;
        }

        var hits = (data.hits || []).slice();
        if (!hits.length) {
          grille.innerHTML = "";
          legende.textContent = "";
          // Correctif Lot 2 (audit UX console, 17 aout 2026) : etat zero
          // resultat actionnable (brief §4.1). Seulement quand q est
          // renseignee -- sans requete, c'est l'apercu alphabetique du
          // catalogue entier, "creer un synonyme" n'aurait aucun sens
          // (rien a rapprocher).
          if (q) {
            vide.innerHTML =
              "<p style='font-size:16px; font-weight:500; color:var(--ink); margin:0 0 4px;'>" +
                T("Aucun produit ne sort sur « {0} »", esc(q)) +
              "</p>" +
              "<p style='font-size:13px; color:var(--ink-muted); margin:0 0 20px;'>" +
                T("Cette recherche est un cul-de-sac pour vos visiteurs.") +
              "</p>" +
              "<div id='so-empty-synonym-form' hidden style='background:var(--surface-2); border:0.5px solid var(--line); border-radius:var(--radius); padding:14px; text-align:left; margin:0 auto 12px; max-width:320px;'>" +
                "<p style='font-size:13px; margin:0 0 8px;'>" + T("Rapprocher <strong>{0}</strong> de :", esc(q)) + "</p>" +
                "<div style='display:flex; gap:8px;'>" +
                  "<input type='text' id='so-empty-synonym-input' placeholder='" + T("ex. plaque de plâtre") + "' style='flex:1; font-size:13px;'>" +
                  "<button type='button' id='so-empty-synonym-submit' style='flex-shrink:0; font-size:13px;'>" + T("Créer") + "</button>" +
                "</div>" +
                "<p id='so-empty-synonym-status' style='font-size:12px; margin:6px 0 0;'></p>" +
              "</div>" +
              "<div style='display:flex; gap:10px; justify-content:center;'>" +
                "<button type='button' id='so-empty-synonym-btn' style='font-size:13px;'>" + T("Créer un synonyme") + "</button>" +
                "<button type='button' id='so-empty-pin-btn' style='font-size:13px;'>" + T("Épingler un produit") + "</button>" +
              "</div>";
            wireSoEmptyState(key, q);
          } else {
            vide.innerHTML = "<p>" + T("Ce catalogue ne contient aucun produit.") + "</p>";
          }
          vide.hidden = false;
          soSimuBar(!!data.simulated);
          return;
        }
        vide.hidden = true;
        soSimuBar(!!data.simulated);

        if (!q) {
          hits.sort(function (a, b) {
            return String(a.product.name || a.product.id).localeCompare(String(b.product.name || b.product.id), LANGUE_EN ? "en" : "fr");
          });
        }

        soOrdreAffiche = hits.map(function (h) { return h.product.id; });
        soRenderFacettes(data.facets || {}, key);
        soRafraichirPipeline(q, data, hits);
        grille.innerHTML = hits.map(function (h, i) {
          var p = h.product;
          var regle = h.pinned || h.buried;
          var classes = "so-card" + (regle ? (data.simulated ? " so-card-simulated" : " so-card-ruled") : "");
          // Correctif C4 (audit UX console, 17 aout 2026) : double
          // numerotation -- le meme (i+1) apparaissait a la fois ici et
          // dans .so-card-rank juste en dessous, verifie identique dans
          // les deux cas, jamais deux valeurs differentes. so-card-rank
          // est deja conditionnee par `q` (contexte ou le rang a un sens
          // : "3e resultat pour cette recherche") -- source unique du
          // numero, le badge reste juste "Epingle" sans le repeter.
          // Correctif (20 aout 2026, planche de composants, point 2). Le
          // bandeau bleu pleine largeur ecrasait le nom du produit et
          // coexistait avec la pastille de rang : deux elements pour une
          // seule information, signalee des la passe 1. La pastille
          // porte desormais l'epingle et passe en plein quand la
          // position est IMPOSEE ; contour simple quand elle est
          // calculee. Le nom retrouve toute la largeur -- d'autant plus
          // utile depuis que les visuels sont affiches.
          //
          // "Relegue" garde son badge : cet etat n'a pas de position, il
          // ne peut pas se fondre dans la pastille.
          var badge = h.buried
            ? "<span class='so-card-badge so-card-badge-bury'>" + T("Relégué") + "</span>" : "";
          // Correctif B1 (audit UX console, 17 aout 2026). p.stock === 0
          // ne fonctionnait jamais : stock, cote catalogue, est un vrai
          // booleen (voir heurix-engine, ItemsBody), jamais une quantite
          // numerique -- true !== 0 en JS, enRupture etait donc toujours
          // faux, et le texte affichait la valeur brute "true en stock".
          // h.in_stock (deja calcule par le moteur, voir _in_stock() cote
          // search.py) est le vrai champ fiable ici, pas p.stock.
          var enRupture = h.in_stock === false;
          var stock = h.in_stock === undefined ? "" :
            "<span class='so-card-stock" + (enRupture ? " rupture" : "") + "'>" +
            (enRupture ? T("Rupture") : T("En stock")) + "</span>";
          var prix = (p.price !== undefined && p.price !== null)
            ? "<span class='so-card-price'>" + Number(p.price).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €</span>" : "";
          // Correctif (19 aout 2026, brief §4.1 "Explication du classement" --
          // "ne jamais afficher la forme brute actuelle terme 'tournevis'
          // (depuis 'tournevisse', x0.35)"). Vrai bug preexistant repere
          // sur une capture reelle d'Alexis (texte brut visible sous les
          // cartes epinglees) -- corrige au meme geste que la construction
          // du tableau detaille, qui a besoin du meme parsing reformule.
          // <details> plutot que le pattern bouton+panneau du pipeline :
          // decalage reste LOCAL a la carte (pas toute la page), et
          // jusqu'a 96 cartes affichees (reglages d'apercu) rendent un
          // ecouteur JS separe par carte moins leger qu'un element natif.
          var pourquoi = "";
          if (q && (h.matched || []).length) {
            var partiesWhy = (h.matched || []).map(soParserLigneMatched).filter(Boolean).map(function (p) {
              return p.variant === p.token
                ? T("« {0} »", p.token)
                : T("« {0} » rapproché de « {1} »", p.token, p.variant);
            });
            var resumeWhy = partiesWhy.slice(0, 2).join(", ");
            var detailWhy = soCardTableauDetaille(h, i);
            pourquoi = "<details class='so-card-why'><summary>" + T("Trouvé sur {0}", esc(resumeWhy)) + "</summary>" + detailWhy + "</details>";
          } else if (q && h.pinned) {
            pourquoi = "<div class='so-card-why'>" + T("Injecté par une règle") + "</div>";
          }

          var pid = esc(p.id);
          var ICONE = ICONES_FICHE;
          var actions = "<div class='so-card-actions'>";
          var bloque = soFiltres.length ? " disabled" : "";
          // Correctif Lot 2 (audit UX console, 17 aout 2026) : data-name
          // ajoute pour que le recapitulatif (§4.4) puisse afficher le
          // vrai nom du produit ("Pince a sertir les cosses"), pas
          // seulement son identifiant -- session.soDraft ne stockait
          // jusqu'ici que product_id, jamais le nom.
          var nomAttr = " data-name='" + esc(p.name || "") + "'";
          actions += "<button type='button'" + bloque + nomAttr + " data-so-act='up' data-pid='" + pid + "' title='" + escAttr(T("Monter d'une place")) + "' aria-label='" + T("Monter {0}", esc(p.name || p.id)) + "'>" + ICONE.up + "</button>" +
                     "<button type='button'" + bloque + nomAttr + " data-so-act='down' data-pid='" + pid + "' title='" + escAttr(T("Descendre d'une place")) + "' aria-label='" + T("Descendre {0}", esc(p.name || p.id)) + "'>" + ICONE.down + "</button>";
          if (h.pinned) {
            actions += "<button type='button' data-so-act='retirer'" + nomAttr + " data-pid='" + pid + "' title='" + escAttr(T("Retirer l'épingle")) + "' aria-label='" + T("Retirer l'épingle de {0}", esc(p.name || p.id)) + "'>" + ICONE.off + "</button>";
          } else {
            actions += "<button type='button' data-so-act='pin'" + nomAttr + " data-pid='" + pid + "' title='" + T("Mettre en tête") + "' aria-label='" + T("Mettre {0} en tête", esc(p.name || p.id)) + "'>" + ICONE.pin + "</button>";
          }
          actions += "</div>";

          // Correctif Lot 2 : data-name aussi sur la carte, lue par le
          // glisser-depose (wireSoDragDrop) qui n'a pas de bouton
          // individuel a interroger.
          // Correctif (18 aout 2026, brief §"Reglages d'apercu") :
          // visuel optionnel -- p.image ou p.image_url selon le champ
          // reellement indexe (verifie dans heurix-engine, les deux
          // noms sont reconnus). Absent du produit -> pas de visuel,
          // meme si le reglage est actif.
          var imgSrc = p.image || p.image_url || "";
          var visuel = (afficherVisuels && imgSrc)
            ? "<img class='so-card-visuel' src='" + esc(imgSrc) + "' alt='' loading='lazy'>" : "";
          return "<div class='" + classes + "'" + " draggable='true' data-pid='" + pid + "' data-name='" + esc(p.name || "") + "'" + ">" +
            (q ? "<span class='so-card-rank" + (h.pinned ? " so-card-rank-impose" : "") + "'" +
              (h.pinned ? " title='" + escAttr(T("Position imposée par une règle")) + "'" : "") + ">" +
              (h.pinned ? ICONES_FICHE.pinPlein + " " : "") + (i + 1) + "</span>" : "") +
            badge + visuel +
            "<div class='so-card-name'>" + surlignerTexte(p.name || p.id, h.highlights && h.highlights.name) + "</div>" +
            "<div class='so-card-ref'>" + surlignerTexte(p.ref || p.id, h.highlights && h.highlights.ref) + "</div>" +
            "<div class='so-card-foot'>" + prix + stock + "</div>" +
            pourquoi + actions +
            "</div>";
        }).join("");

        legende.textContent = q
          ? T(hits.length > 1 ? "{0} résultats sur {1} pour « {2} »" : "{0} résultat sur {1} pour « {2} »", hits.length, data.total, q)
          : T("Aperçu du catalogue, par ordre alphabétique — tapez une requête pour voir le classement.");
      })
      .catch(function () {
        grille.innerHTML = "";
        legende.textContent = "";
        vide.hidden = false;
      });
  }


  // Correctif B3 (audit UX console, 17 aout 2026 -- "defaut le plus grave
  // de l'audit") : apres un epinglage/relegation, "Regles en place"
  // restait affiche tel qu'avant -- seule refreshSoPreview (la grille de
  // cartes) etait rafraichie a chaque modification du brouillon, jamais ce
  // tableau. Fonction de rendu PURE extraite ici (aucun appel reseau) pour
  // etre appelee a la fois par refreshSoTable ci-dessous (donnees serveur)
  // et par soConstruireBrouillon (donnees du brouillon, sans refaire
  // d'appel reseau a chaque frappe -- session.soDraft contient deja
  // l'etat complet voulu, voir soAppliquerBrouillon).
  // Correctif Lot 3 (audit UX console, 18 aout 2026) : etat de tri de
  // l'onglet "Regles du catalogue", persiste entre les re-rendus (meme
  // pattern que les autres etats de session).
  var soCatalogueTri = { colonne: null, sens: "asc" };
  var soDerniereListe = [];
  var soDerniereEnBrouillon = false;

  // Rafraichit uniquement l'affichage (filtre/tri) avec la derniere liste
  // deja recue -- pas de nouvel appel reseau. Appelee par les listeners
  // de recherche/filtre/tri.
  function soRafraichirCatalogueSeul() {
    soRenderReglesTable(soDerniereListe, soDerniereEnBrouillon);
  }

  // Recherche + filtre statut + tri, appliques a la vraie liste avant
  // affichage -- "n" (pour les badges de compte) reste calcule sur la
  // liste COMPLETE plus bas, jamais sur le resultat filtre.
  function soFiltrerEtTrierCatalogue(liste, enBrouillon) {
    var champRecherche = document.getElementById("so-catalogue-search");
    var champStatut = document.getElementById("so-catalogue-filtre-statut");
    var q = champRecherche ? champRecherche.value.trim().toLowerCase() : "";
    var statutVoulu = champStatut ? champStatut.value : "";
    var statutReel = enBrouillon ? "brouillon" : "active";

    var resultat = liste;
    if (statutVoulu && statutVoulu !== statutReel) resultat = [];
    if (q) {
      resultat = resultat.filter(function (r) {
        var nom = (r.product_name || r.product_id || "").toLowerCase();
        return nom.indexOf(q) !== -1 || r.query.toLowerCase().indexOf(q) !== -1;
      });
    }
    if (soCatalogueTri.colonne) {
      resultat = resultat.slice().sort(function (a, b) {
        var va, vb;
        if (soCatalogueTri.colonne === "nom") {
          va = (a.product_name || a.product_id || "").toLowerCase();
          vb = (b.product_name || b.product_id || "").toLowerCase();
        } else if (soCatalogueTri.colonne === "declencheur") {
          va = a.query.toLowerCase(); vb = b.query.toLowerCase();
        } else { // action : pin avant bury, puis par position
          va = a.action + (a.position || 0); vb = b.action + (b.position || 0);
        }
        var cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return soCatalogueTri.sens === "asc" ? cmp : -cmp;
      });
    } else {
      // Correctif (20 aout 2026, audit passe 3 §4) : sans clic sur une
      // colonne, la liste sortait dans l'ordre du serveur -- l'audit
      // relevait des positions en 2, 3, 1. Tri par defaut : d'abord par
      // declencheur (les regles d'une meme recherche restent groupees),
      // puis par position croissante, ce qui est l'ordre dans lequel
      // elles s'appliquent reellement. Une relegation n'a pas de
      // position : elle passe en fin de groupe, comme dans le
      // classement.
      resultat = resultat.slice().sort(function (a, b) {
        if (a.query !== b.query) return a.query < b.query ? -1 : 1;
        var pa = a.action === "pin" ? (a.position || 0) : Infinity;
        var pb = b.action === "pin" ? (b.position || 0) : Infinity;
        return pa - pb;
      });
    }
    return resultat;
  }

  function soRenderReglesTable(liste, enBrouillon) {
    // Note : renderTable() cree elle-meme la balise <tr>, soRowHtml() ne
    // construit que son contenu interieur -- pas de vraie classe par
    // ligne possible sans modifier renderTable(), vraie fonction
    // generique reutilisee ailleurs. L'indicateur visuel "brouillon"
    // s'appuie donc uniquement sur .so-rules-draft, posee plus bas sur
    // le panneau parent -- suffisant, pas besoin de toucher chaque ligne.
    soDerniereListe = liste || [];
    soDerniereEnBrouillon = enBrouillon;
    var listeFiltree = soFiltrerEtTrierCatalogue(liste || [], enBrouillon);
    // Correctif Lot 3 (audit UX console, 18 aout 2026) : conflits
    // calcules sur la vraie liste complete (liste), pas la liste
    // filtree/triee -- un conflit doit rester signale meme si l'une des
    // deux regles concernees sort du filtre/recherche actuel.
    var conflits = soDetecterConflits(liste || []);
    // Correctif Lot 3 : onglet "Regles du catalogue", fonction dediee
    // (soRowHtmlCatalogue), closure pour lui passer enBrouillon puisque
    // renderTable() appelle rowFn(row) avec un seul argument.
    renderTable("so-table", "so-empty", listeFiltree, function (row) {
      return soRowHtmlCatalogue(row, enBrouillon, conflits);
    });
    // Correctif (20 aout 2026, audit passe 3 §4 -- "le compteur apparait
    // trois fois sur le meme ecran"). Celui-ci est conserve, mais il dit
    // desormais autre chose que l'onglet : il reflete le FILTRAGE en
    // cours, la seule information que l'onglet ne donne pas. Formulation
    // explicite des qu'un filtre retire des lignes.
    var compteurCatalogue = document.getElementById("so-catalogue-compteur");
    if (compteurCatalogue) {
      var nFiltre = listeFiltree.length;
      var nTotal = (liste || []).length;
      compteurCatalogue.textContent = nFiltre === nTotal
        ? T(nFiltre > 1 ? "{0} règles" : "{0} règle", nFiltre)
        : T("{0} règles affichées sur {1}", nFiltre, nTotal);
    }
    var n = (liste || []).length;
    // so-count retire (20 aout 2026, audit passe 3 §4) : il repetait le
    // nombre deja porte par l'onglet "Regles du catalogue (3)", juste au
    // dessus. L'etat brouillon qu'il signalait reste visible autrement --
    // la classe so-rules-draft sur le panneau, posee juste en dessous.
    var panneau = document.getElementById("so-rules-panel");
    if (panneau) panneau.classList.toggle("so-rules-draft", !!enBrouillon);
    // Correctif structure en onglets (§3.4 du brief, corrige le 18 aout
    // apres diagnostic Claude en Chrome) : badge de compte sur l'onglet,
    // format compact coherent avec la maquette du brief ("Regles du
    // catalogue (12)"), pas le libelle long de so-count.
    var badgeOnglet = document.getElementById("so-tab-regles-count");
    if (badgeOnglet) {
      badgeOnglet.hidden = n === 0;
      badgeOnglet.textContent = n === 0 ? "" : "(" + n + ")";
    }
    // Correctif Lot 3 : colonne contextuelle, mise a jour au meme point
    // que le tableau principal (regles modifiees). session.activeKey :
    // meme valeur que le "key" recu par les autres fonctions de cette
    // page, confirme en tracant son affectation (loadDashboard).
    if (session.activeKey) soRafraichirColonneContextuelle(session.activeKey);
  }

  // Correctif Lot 3 (audit UX console, 18 aout 2026) : colonne
  // contextuelle (§3.4 du brief). Filtrage cote client, approximation
  // volontairement simple ("declencheur contenu dans la requete") --
  // pas une reimplementation du vrai algorithme serveur
  // (_override_triggers, tokens contigus), decision prise avec Alexis :
  // ce tableau est un raccourci visuel, la source de verite reste
  // l'apercu lui-meme qui appelle vraiment /search.
  // Correctif (18 aout 2026, diagnostic Claude en Chrome) : liste
  // verticale plutot qu'un tableau -- un rail de 340px ne peut pas
  // porter 5 colonnes lisibles. Reutilise les memes chips que
  // soRowHtml (.cell-action-*) pour rester coherent visuellement avec
  // le tableau principal.
  function soRenderListeContextuelle(liste) {
    var conteneur = document.getElementById("so-liste-contextuelle");
    var vide = document.getElementById("so-empty-contextuel");
    if (!conteneur) return;
    if (!liste.length) {
      conteneur.innerHTML = "";
      if (vide) vide.hidden = false;
      return;
    }
    if (vide) vide.hidden = true;
    // Correctif (18 aout 2026, correctif 3 du prompt cartes produit --
    // "trois cartes separees portent toutes le titre 'vis'. Regrouper :
    // un seul en-tete suivi des trois actions"). Toutes les regles
    // affichees ici partagent deja le meme declencheur exact (liste deja
    // filtree en amont par soRafraichirColonneContextuelle) -- un seul
    // groupe attendu en pratique, mais le regroupement reste ecrit de
    // facon generique plutot que de supposer cette invariant.
    var groupes = {};
    var ordre = [];
    liste.forEach(function (o) {
      if (!groupes[o.query]) { groupes[o.query] = []; ordre.push(o.query); }
      groupes[o.query].push(o);
    });
    conteneur.innerHTML = ordre.map(function (query) {
      var regles = groupes[query];
      var lignes = regles.map(function (o) {
        var pin = o.action === "pin";
        var actionLabel = pin
          ? "<span class='cell-action cell-action-pin'>&#9679; " + T("Épingler") + "</span>"
          : "<span class='cell-action cell-action-bury'>&#9679; " + T("Reléguer") + "</span>";
        var posLabel = pin && o.position
          ? "<span class='so-liste-pos'>" + T("pos. {0}", o.position) + "</span>" : "";
        return "<div class='so-liste-chips'>" + actionLabel +
            "<span class='so-liste-produit'>" + esc(o.product_name || o.product_id) + "</span>" +
            posLabel +
          // Correctif (20 aout 2026, mesure Claude en Chrome). Le bloc
          // d'actions etait un FRERE de la ligne, pas un enfant : le
          // bouton tombait donc systematiquement en dessous, doublant la
          // hauteur de chaque regle. Mon correctif CSS precedent
          // (flex:0 0 auto) ne pouvait rien y faire -- il supposait un
          // parent flex, or .so-liste-item reste en bloc a dessein (il
          // contient le titre du declencheur SUIVI des regles).
          //
          // Le bloc rentre dans .so-liste-chips, qui est bien en flex :
          // le bouton rejoint la ligne, pousse a droite par le nom en
          // flex:1.
          "<div class='so-liste-actions'>" +
            "<button type='button' class='catalog-rule-remove' data-so-edit='1' data-query='" + esc(o.query) + "' data-product-id='" + esc(o.product_id) + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' aria-label='" + T("Modifier") + "' title='" + T("Modifier") + "'>&#9998;</button>" +
          "</div>" +
        "</div>";
      }).join("<hr class='so-liste-sep'>");
      return "<div class='so-liste-item'>" +
        "<div class='so-liste-trigger' title='" + esc(query) + "'>" + esc(query) + "</div>" +
        lignes +
      "</div>";
    }).join("");
  }

  function soRafraichirColonneContextuelle(key) {
    var champ = document.getElementById("so-preview-query");
    var conteneur = document.getElementById("so-liste-contextuelle");
    if (!champ || !conteneur) return;
    var q = champ.value.trim().toLowerCase();

    function rendre() {
      var liste = !q ? [] : (session.soDraft || []).filter(function (r) {
        return q.indexOf(r.query.toLowerCase()) !== -1;
      });
      // Correctif (21 aout 2026, audit passe 4). Le rail sortait en 2, 3,
      // 1 -- signale depuis trois passes. J'avais corrige le TABLEAU
      // (soFiltrerEtTrierCatalogue) sans voir que le rail est alimente
      // par session.soDraft, qui n'est trie nulle part. Meme regle que le
      // tableau : par position croissante, une relegation n'ayant pas de
      // position passe en fin.
      liste = liste.slice().sort(function (a, b) {
        var pa = a.action === "pin" ? (a.position || 0) : Infinity;
        var pb = b.action === "pin" ? (b.position || 0) : Infinity;
        return pa - pb;
      });
      soRenderListeContextuelle(liste);
    }

    if (!q) { rendre(); return; }
    soAvecBrouillon(key, rendre);
  }

  function refreshSoTable(key) {
    apiFetch("/v1/index/" + encodeURIComponent(session.soCurrentCatalog) + "/search-overrides", key)
      .then(function (data) {
        // La table des regles est rechargee apres tout enregistrement : le
        // brouillon n'a plus lieu d'etre, l'apercu repasse sur le reel.
        session.soDraft = null;
        soRenderReglesTable(data.overrides, false);
        // Un seul point de branchement : la table des regles est
        // rafraichie apres tout ajout, modification ou suppression, donc
        // l'apercu suit automatiquement.
        refreshSoPreview(key);
      })
      .catch(function () {});
  }

  function onSoCatalogChange(key) {
    // Le catalogue vient desormais du choix global, plus d'un selecteur de
    // pave (chantier « catalogue global »).
    session.soCurrentCatalog = catalogueCourant();
    // Correctif Lot 1 (audit UX console, 17 aout 2026) : "Appliquer" ne
    // disait pas que la publication devient visible par les vrais
    // visiteurs. Huit catalogues aux noms proches existent sur un compte
    // -- publier sur le mauvais doit devenir difficile (brief §4.1).
    var boutonAppliquer = document.getElementById("so-simu-apply");
    if (boutonAppliquer && session.soCurrentCatalog) {
      boutonAppliquer.textContent = "Publier sur " + session.soCurrentCatalog;
    }
    var content = document.getElementById("so-content");
    if (!session.soCurrentCatalog) { content.hidden = true; return; }
    content.hidden = false;
    soAnimerPlaceholder();  // la barre devient visible maintenant
    resetSoForm();
    session.soDraft = null;
    refreshSoTable(key);
    refreshSoPreview(key);  // vue catalogue immediate, pas d'ecran vide
  }

  // Effet de frappe sur le placeholder de la barre de test.
  //
  // But : faire comprendre d'un coup d'oeil qu'on simule une barre de
  // recherche VISITEUR, pas qu'on remplit un champ de formulaire. Le texte
  // s'ecrit une seule fois a l'ouverture du pave, puis reste fixe -- une
  // animation en boucle serait distrayante sur un ecran de travail.
  //
  // L'attribut aria-label porte le libelle stable pour les lecteurs
  // d'ecran : le placeholder anime ne doit pas etre leur source
  // d'information.
  var soTypeTimer = null;
  function soAnimerPlaceholder() {
    var champ = document.getElementById("so-preview-query");
    // La barre vit dans so-content, masque tant qu'aucun catalogue n'est
    // choisi. Sans ce controle, l'animation se deroulait a vide des
    // l'ouverture du panneau, et le garde-fou « une seule fois » l'empechait
    // ensuite de rejouer quand la barre apparaissait enfin.
    if (!champ || champ.dataset.anime || !estVisible(champ)) return;
    champ.dataset.anime = "1";
    var texte = T("Tapez une requête comme le ferait un visiteur…");
    var i = 0;
    champ.placeholder = "";
    champ.parentElement.classList.add("tape");

    function frappe() {
      // Si l'utilisateur commence a taper, on s'efface immediatement :
      // l'animation ne doit jamais gener la saisie.
      if (document.activeElement === champ && champ.value) return arreter();
      champ.placeholder = texte.slice(0, ++i);
      if (i < texte.length) soTypeTimer = setTimeout(frappe, 28);
      else arreter();
    }
    function arreter() {
      clearTimeout(soTypeTimer);
      champ.placeholder = texte;
      champ.parentElement.classList.remove("tape");
    }
    soTypeTimer = setTimeout(frappe, 300);
    champ.addEventListener("focus", arreter, { once: true });
  }


  /* Suggestions de synonymes depuis les recherches sans résultat.
   *
   * Idée retenue d'une revue externe (30 juillet) : ces recherches sont
   * déjà collectées, chaque terme est un client qui n'a pas trouvé. Le
   * moteur propose les mots du catalogue qui ressemblent au terme, le
   * marchand clique — et « teeshirt » trouve enfin « T-shirt ».
   */
  function wireSuggestionsSynonymes(key) {
    var table = document.getElementById("zero-results-table");
    if (!table || table.dataset.zrWired === "1") return;
    table.dataset.zrWired = "1";

    table.addEventListener("click", function (e) {
      var btn = e.target.closest(".zr-suggerer");
      var choix = e.target.closest(".zr-choix");
      if (choix) { creerSynonyme(choix, key); return; }
      if (!btn) return;

      var terme = btn.getAttribute("data-terme");
      var zone = btn.parentElement.querySelector(".zr-suggestions");
      btn.disabled = true;
      btn.textContent = "…";
      apiFetch("/v1/index/" + encodeURIComponent(catalogueCourant()) +
               "/synonym-suggestions?q=" + encodeURIComponent(terme), key)
        .then(function (d) {
          var candidats = [];
          (d.suggestions || []).forEach(function (s) {
            s.candidats.slice(0, 3).forEach(function (cand) {
              candidats.push({ jeton: s.jeton, terme: cand.terme, produits: cand.produits });
            });
          });
          btn.hidden = true;
          zone.hidden = false;
          if (!candidats.length) {
            zone.innerHTML = "<em>" + T("Aucun mot proche dans votre catalogue.") + "</em> " +
              "<button type='button' class='zr-vers-synonymes' data-goto-pane='pane-search-overrides' " +
              "data-prefill='" + esc(terme) + "'>" + T("S'il s'agit d'un autre mot pour un produit que vous vendez, ajoutez-le comme synonyme &rarr;") + "</button>";
            return;
          }
          zone.innerHTML = "&rarr; " + candidats.map(function (cand) {
            return "<button type='button' class='zr-choix' data-de='" +
                   esc(cand.jeton) + "' data-vers='" + esc(cand.terme) + "'>" +
                   esc(cand.terme) + " <i>(" + T("{0} produits", cand.produits) + ")</i></button>";
          }).join(" ");
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = T("Corriger");
        });
    });

    function creerSynonyme(el, key) {
      var de = el.getAttribute("data-de");
      var vers = el.getAttribute("data-vers");
      el.disabled = true;
      // Le PUT remplace la liste entière : on lit d'abord, on ajoute, on
      // renvoie. Les synonymes du pack ne sont pas dans cette liste — ils
      // se rechargent du YAML, on ne risque pas de les écraser.
      apiFetch("/v1/index/" + encodeURIComponent(catalogueCourant()) + "/synonyms", key)
        .then(function (d) {
          var groupes = (d.groups || []).slice();
          groupes.push([de, vers]);
          return apiFetch("/v1/index/" + encodeURIComponent(catalogueCourant()) + "/synonyms",
                          key, { method: "PUT", body: { groups: groupes } });
        })
        .then(function () {
          el.outerHTML = "<span class='zr-fait'>&check; " + T("« {0} » trouvera désormais « {1} »", esc(de), esc(vers)) + "</span>";
        })
        .catch(function (e) {
          el.disabled = false;
          window.alert(T("Création impossible : {0}", e.message || e));
        });
    }
  }

  // Correctif Lot 2 (audit UX console, 17 aout 2026) : etat zero resultat
  // actionnable (brief §4.1). Le contenu de #so-preview-empty est
  // reconstruit a chaque appel de refreshSoPreview (innerHTML), donc ces
  // listeners doivent etre re-cables a chaque fois -- appele depuis
  // refreshSoPreview juste apres l'injection du HTML, pas au chargement.
  function wireSoEmptyState(key, q) {
    var pinBtn = document.getElementById("so-empty-pin-btn");
    if (pinBtn) pinBtn.addEventListener("click", function () {
      // Correctif Lot 3 : le formulaire vit desormais dans une modale --
      // l'ouvrir avant le focus, un champ cache ne peut pas le recevoir.
      resetSoForm();
      ouvrirSoFormModal();
      var champQuery = document.getElementById("so-query");
      var champProduit = document.getElementById("so-product-search");
      if (champQuery) champQuery.value = q;
      if (champProduit) champProduit.focus();
    });

    var synBtn = document.getElementById("so-empty-synonym-btn");
    var synForm = document.getElementById("so-empty-synonym-form");
    if (synBtn && synForm) synBtn.addEventListener("click", function () {
      synForm.hidden = false;
      synBtn.hidden = true;
      var input = document.getElementById("so-empty-synonym-input");
      if (input) input.focus();
    });

    var submitBtn = document.getElementById("so-empty-synonym-submit");
    if (submitBtn) submitBtn.addEventListener("click", function () {
      var input = document.getElementById("so-empty-synonym-input");
      var status = document.getElementById("so-empty-synonym-status");
      var vers = input ? input.value.trim() : "";
      if (!vers) { if (status) { status.textContent = T("Entrez un mot."); status.style.color = "#C0392B"; } return; }
      submitBtn.disabled = true;
      // Meme logique que creerSynonyme (panneau Sans resultat, chantier
      // score d'intention) : le PUT remplace la liste entiere, on lit
      // d'abord, on ajoute, on renvoie.
      apiFetch("/v1/index/" + encodeURIComponent(catalogueCourant()) + "/synonyms", key)
        .then(function (d) {
          var groupes = (d.groups || []).slice();
          groupes.push([q, vers]);
          return apiFetch("/v1/index/" + encodeURIComponent(catalogueCourant()) + "/synonyms",
                          key, { method: "PUT", body: { groups: groupes } });
        })
        .then(function () {
          if (status) { status.textContent = T("« {0} » trouvera désormais « {1} »", q, vers); status.style.color = "#0F7A3D"; }
          submitBtn.disabled = true;
          if (input) input.disabled = true;
        })
        .catch(function (e) {
          submitBtn.disabled = false;
          if (status) { status.textContent = (e && e.message) || T("Échec de la création."); status.style.color = "#C0392B"; }
        });
    });
  }

  // Correctif Lot 3 (audit UX console, 17-18 aout 2026) : validation
  // inline "position deja reservee" (§4.5 du brief -- "La position 4 est
  // deja reservee a 'Pince a sertir'. Choisissez une autre position, ou
  // l'ancienne regle sera remplacee."). Reutilise soAvecBrouillon() :
  // amorce session.soDraft depuis le serveur si pas deja actif, evite de
  // dupliquer la logique d'amorce deja etablie pour B3/C9.
  function soVerifierPositionReservee(key) {
    var champPosition = document.getElementById("so-position");
    var avertPosition = document.getElementById("so-position-warn");
    var idCache = document.getElementById("so-product-id");
    if (!champPosition || !avertPosition) return;

    var q = soRequeteCourante();
    var pos = parseInt(champPosition.value, 10);
    var pidActuel = idCache ? idCache.value : "";
    if (!q || !pos || document.getElementById("so-action").value !== "pin") {
      avertPosition.hidden = true;
      return;
    }

    soAvecBrouillon(key, function () {
      var conflit = null;
      for (var i = 0; i < session.soDraft.length; i++) {
        var r = session.soDraft[i];
        if (r.query === q && r.action === "pin" && r.position === pos && r.product_id !== pidActuel) {
          conflit = r;
          break;
        }
      }
      if (conflit) {
        avertPosition.textContent = T("La position {0} est déjà réservée à « {1} ». Choisissez une autre position, ou l'ancienne règle sera remplacée.", pos, conflit.product_name || conflit.product_id);
        avertPosition.hidden = false;
      } else {
        avertPosition.hidden = true;
      }
    });
  }

  // Parametree (21 aout 2026) pour servir les DEUX ecrans : la
  // recherche l'utilisait deja, la categorie en avait besoin. Les
  // identifiants etaient en dur -- dupliquer la fonction aurait cree
  // deux comportements a maintenir en parallele.
  function wireSoProductAutocomplete(key, ids) {
    ids = ids || {};
    var champ = document.getElementById(ids.champ || "so-product-search");
    var idCache = document.getElementById(ids.cache || "so-product-id");
    var panneau = document.getElementById(ids.panneau || "so-product-panel");
    if (!champ || !idCache || !panneau) return;

    var debounceTimer = null;
    var lastRequestId = 0;

    function fermerPanneau() {
      panneau.hidden = true;
      panneau.innerHTML = "";
    }

    function afficherSuggestions(hits) {
      if (!hits.length) {
        panneau.innerHTML = "<div class='so-autocomplete-empty'>" + T("Aucun produit ne correspond.") + "</div>";
        panneau.hidden = false;
        return;
      }
      panneau.innerHTML = hits.map(function (h) {
        var p = h.product;
        var prix = (p.price !== undefined && p.price !== null)
          ? Number(p.price).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "";
        var stock = h.in_stock === false ? "<span class='so-autocomplete-oos'>" + T("Rupture") + "</span>" : T("En stock");
        // Correctif Lot 3 : data-in-stock retenu pour la validation
        // inline "produit en rupture" (§4.5 du brief), declenchee au
        // moment de la selection -- reutilise ce qui est deja calcule
        // ici, pas de second appel reseau.
        return "<button type='button' class='so-autocomplete-item' data-id='" + esc(p.id) + "' data-name='" + esc(p.name || p.id) + "' data-in-stock='" + (h.in_stock === false ? "0" : "1") + "'>" +
          "<span class='so-autocomplete-name'>" + esc(p.name || p.id) + "</span>" +
          "<span class='so-autocomplete-meta'>" + esc(p.ref || p.id) + (prix ? " · " + prix : "") + " · " + stock + "</span>" +
        "</button>";
      }).join("");
      panneau.hidden = false;
    }

    champ.addEventListener("input", function () {
      idCache.value = "";
      var q = champ.value.trim();
      clearTimeout(debounceTimer);
      if (q.length < 2) { fermerPanneau(); return; }
      debounceTimer = setTimeout(function () {
        var requestId = ++lastRequestId;
        apiFetch("/v1/index/" + encodeURIComponent(session.soCurrentCatalog) + "/search", key, {
          method: "POST", body: { q: q, limit: 8 }
        }).then(function (data) {
          if (requestId !== lastRequestId) return;
          afficherSuggestions(data.hits || []);
        }).catch(function () {
          if (requestId !== lastRequestId) return;
          fermerPanneau();
        });
      }, 200);
    });

    panneau.addEventListener("click", function (e) {
      var item = e.target.closest(".so-autocomplete-item");
      if (!item) return;
      idCache.value = item.getAttribute("data-id");
      champ.value = item.getAttribute("data-name");
      fermerPanneau();
      // Correctif Lot 3 (§4.5 du brief) : validation inline "produit en
      // rupture", au moment de la selection -- pas d'attente de la
      // soumission.
      var avertStock = document.getElementById("so-stock-warn");
      if (avertStock) {
        if (item.getAttribute("data-in-stock") === "0") {
          avertStock.textContent = T("Ce produit est en rupture : il n'apparaîtra pas si votre boutique masque les ruptures.");
          avertStock.hidden = false;
        } else {
          avertStock.hidden = true;
        }
      }
      soVerifierPositionReservee(key);
    });

    document.addEventListener("click", function (e) {
      if (!champ.contains(e.target) && !panneau.contains(e.target)) fermerPanneau();
    });
  }

  function wireSoPreview(key) {
    var stock = document.getElementById("so-in-stock");
    if (stock) stock.addEventListener("change", function () { refreshSoPreview(key); });
    var grouper = document.getElementById("so-grouper");
    if (grouper) grouper.addEventListener("change", function () { refreshSoPreview(key); });
    // Correctif (20 aout 2026, demande Alexis). Le reglage "Afficher les
    // visuels" existait de bout en bout -- case dans le popover, lecture
    // au rendu, balise <img> conditionnee -- mais sans ecouteur : cocher
    // n'avait d'effet qu'a la recherche SUIVANTE. Meme cablage que les
    // trois reglages voisins.
    var visuels = document.getElementById("so-visuels");
    if (visuels) visuels.addEventListener("change", function () { refreshSoPreview(key); });
    var limite = document.getElementById("so-preview-limit");
    if (limite) limite.addEventListener("change", function () { refreshSoPreview(key); });
    var champ = document.getElementById("so-preview-query");
    if (!champ) return;
    champ.addEventListener("input", function () {
      clearTimeout(soPreviewTimer);
      soPreviewTimer = setTimeout(function () {
        refreshSoPreview(key);
        // Correctif Lot 3 : colonne contextuelle, mise a jour a chaque
        // frappe (meme debounce que l'apercu principal, pas un second
        // timer).
        soRafraichirColonneContextuelle(key);
      }, 250);
    });
  }

  // ---------------- Brouillon : simulation avant enregistrement ----------------
  //
  // Le formulaire alimente un BROUILLON plutot que d'enregistrer directement.
  // Le brouillon est la liste complete des priorites telles qu'elles seraient
  // apres application : les regles deja enregistrees, plus (ou moins) celle en
  // cours d'edition. Le moteur remplace l'ensemble persiste par cette liste
  // pour l'appel de simulation -- sans rien ecrire.
  // Correctif (19 aout 2026, brief §3.5) : nom et statut, premiers
  // champs exposes cote interface. nom omis si vide (jamais une string
  // vide envoyee) -- le backend garde deja son propre defaut (None) sur
  // une nouvelle regle, et preserve la valeur existante sur une regle
  // deja en base si ce champ n'est pas envoye (verifie dans
  // heurix-engine avant de construire, Store.set()).
  function soLireFormulaire() {
    var q = document.getElementById("so-query").value.trim();
    var pid = document.getElementById("so-product-id").value.trim();
    if (!q || !pid) return null;
    var action = document.getElementById("so-action").value;
    var pos = document.getElementById("so-position").value;
    var regle = { query: q, product_id: pid, action: action };
    if (action === "pin" && pos) regle.position = parseInt(pos, 10);
    var champNom = document.getElementById("so-nom");
    if (champNom && champNom.value.trim()) regle.nom = champNom.value.trim();
    var champStatut = document.getElementById("so-statut");
    if (champStatut) regle.statut = champStatut.value;
    // Correctif (19 aout 2026, brief §3.5, priorite avec vrai effet
    // backend depuis ce matin). Champ date simple converti en ISO
    // complet -- debut a minuit, fin a la derniere seconde du jour
    // choisi, pour couvrir la journee entiere plutot que l'exclure.
    var champPriorite = document.getElementById("so-priorite");
    if (champPriorite && champPriorite.value) regle.priorite = parseInt(champPriorite.value, 10);
    var champDebut = document.getElementById("so-diffusion-debut");
    if (champDebut && champDebut.value) regle.diffusion_debut = champDebut.value + "T00:00:00Z";
    var champFin = document.getElementById("so-diffusion-fin");
    if (champFin && champFin.value) regle.diffusion_fin = champFin.value + "T23:59:59Z";
    return regle;
  }

  function soConstruireBrouillon(key, onDone, onErr) {
    var enCours = soLireFormulaire();
    // Correctif B3 (audit UX console, 17 aout 2026) : formulaire vide ->
    // retour aux vraies regles serveur, table re-synchronisee comme le
    // reste (refreshSoTable fait le fetch + le rendu en un seul appel).
    if (!enCours) { session.soDraft = null; refreshSoTable(key); return; }

    apiFetch("/v1/index/" + encodeURIComponent(session.soCurrentCatalog) + "/search-overrides", key)
      .then(function (data) {
        // Correctif (19 aout 2026, brief §3.5) : nom/statut propages ici
        // aussi -- sinon ils disparaitraient visuellement des l'ouverture
        // d'un brouillon, avant meme toute modification reelle.
        var existantes = (data.overrides || []).map(function (o) {
          return { query: o.query, product_id: o.product_id, action: o.action, position: o.position || undefined,
                   nom: o.nom || undefined, statut: o.statut || undefined,
                   priorite: o.priorite || undefined,
                   diffusion_debut: (o.diffusion && o.diffusion.debut) || undefined,
                   diffusion_fin: (o.diffusion && o.diffusion.fin) || undefined };
        });
        // Si on modifie une regle existante, l'ancienne version sort du
        // brouillon -- sinon les deux coexisteraient dans l'apercu alors
        // qu'une seule subsistera apres application.
        var cle = soEditingKey;
        existantes = existantes.filter(function (o) {
          if (cle && o.query === cle.query && o.product_id === cle.productId) return false;
          return !(o.query === enCours.query && o.product_id === enCours.product_id);
        });
        session.soDraft = existantes.concat([enCours]);
        // Correctif B3 : "Regles en place" reflete desormais le brouillon
        // en cours, pas seulement la grille (refreshSoPreview).
        soRenderReglesTable(session.soDraft, true);
        refreshSoPreview(key);
        // Correctif C9 (audit UX console, 17 aout 2026) : callback
        // optionnel, utilise par le formulaire "Ajouter une priorite"
        // (so-form) pour confirmer/reinitialiser une fois le brouillon
        // reellement a jour -- jamais avant, cette fonction est async.
        if (onDone) onDone();
      })
      .catch(function (err) { session.soDraft = null; if (onErr) onErr(err); });
  }

  // Enregistre le BROUILLON, pas le formulaire.
  //
  // Premiere version fautive : « Appliquer » soumettait le formulaire, qui
  // ne connait rien au brouillon. Deux consequences -- ses champs etant
  // vides apres une manipulation par fiches, le navigateur renvoyait vers
  // le champ obligatoire (d'ou le saut vers le bas de page), et surtout un
  // brouillon de plusieurs regles n'aurait de toute facon pas pu passer par
  // un formulaire qui n'en porte qu'une.
  //
  // Methode : on remplace l'ensemble persiste par le brouillon. On supprime
  // donc ce qui n'y est plus, puis on cree ou met a jour le reste. C'est
  // exactement la semantique de la simulation, ce qui garantit que
  // l'enregistrement produit bien ce que l'apercu montrait.
  function soAppliquerBrouillon(key) {
    if (!session.soDraft) return;
    var base = "/v1/index/" + encodeURIComponent(session.soCurrentCatalog) + "/search-overrides";
    var statut = document.getElementById("so-status");
    var bouton = document.getElementById("so-simu-apply");
    if (bouton) bouton.disabled = true;
    if (statut) { statut.textContent = "Enregistrement…"; statut.className = "catalog-rule-status"; }

    apiFetch(base, key)
      .then(function (data) {
        var existantes = data.overrides || [];
        var voulues = session.soDraft.slice();
        var cle = function (o) { return o.query + "\u0000" + o.product_id; };
        var voulueParCle = {};
        voulues.forEach(function (r) { voulueParCle[cle(r)] = r; });

        // 1. Supprimer celles absentes du brouillon
        var suppressions = existantes
          .filter(function (o) { return !voulueParCle[cle(o)]; })
          .map(function (o) {
            return apiFetch(base + "?query=" + encodeURIComponent(o.query) +
                            "&product_id=" + encodeURIComponent(o.product_id),
                            key, { method: "DELETE" });
          });
        return Promise.all(suppressions).then(function () { return voulues; });
      })
      .then(function (voulues) {
        // 2. Creer ou mettre a jour. L'endpoint POST fait un upsert sur la
        // paire (requete, produit), donc pas besoin de distinguer les deux.
        return voulues.reduce(function (chaine, r) {
          return chaine.then(function () {
            var corps = { query: r.query, product_id: r.product_id, action: r.action };
            if (r.action === "pin" && r.position) corps.position = r.position;
            // Correctif (19 aout 2026, brief §3.5) : propage nom/statut
            // s'ils ont ete saisis -- sinon le backend garde deja la
            // valeur existante sur une regle deja en base (verifie dans
            // heurix-engine avant de construire), donc aucune regression
            // pour les regles qui ne passent jamais par ces deux champs.
            if (r.nom) corps.nom = r.nom;
            if (r.statut) corps.statut = r.statut;
            // Correctif (19 aout 2026, brief §3.5, priorite avec vrai
            // effet backend depuis ce matin). Meme raisonnement que
            // nom/statut : propage si saisi, sinon le backend garde deja
            // la valeur existante sur une regle deja en base.
            if (r.priorite) corps.priorite = r.priorite;
            if (r.diffusion_debut) corps.diffusion_debut = r.diffusion_debut;
            if (r.diffusion_fin) corps.diffusion_fin = r.diffusion_fin;
            return apiFetch(base, key, { method: "POST", body: corps });
          });
        }, Promise.resolve());
      })
      .then(function () {
        session.soDraft = null;
        if (statut) { statut.textContent = T("Règles appliquées."); statut.className = "catalog-rule-status ok"; }
        resetSoForm();
        refreshSoTable(key);
      })
      .catch(function (err) {
        if (statut) {
          statut.textContent = (err && err.message) || T("Échec de l'enregistrement.");
          statut.className = "catalog-rule-status err";
        }
      })
      .then(function () { if (bouton) bouton.disabled = false; });
  }

  function wireSoDraft(key) {
    ["so-query", "so-product-id", "so-position"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("input", function () {
        clearTimeout(soPreviewTimer);
        soPreviewTimer = setTimeout(function () { soConstruireBrouillon(key); }, 300);
      });
    });
    var act = document.getElementById("so-action");
    if (act) act.addEventListener("change", function () { soConstruireBrouillon(key); });

    var appliquer = document.getElementById("so-simu-apply");
    if (appliquer) appliquer.addEventListener("click", function () { soAppliquerBrouillon(key); });

    // Correctif Lot 2 (audit UX console, 17 aout 2026) : "Voir le detail"
    // ouvre le recapitulatif avant publication (§4.4).
    var detailBtn = document.getElementById("so-simu-detail");
    if (detailBtn) detailBtn.addEventListener("click", function () {
      openRecapModal(
        session.soCurrentCatalog,
        session.soDraft || [],
        function (r) { return r.query; },
        function (cle) { return T("Sur la recherche « {0} »", cle); },
        function (nouveauDraft) { session.soDraft = nouveauDraft; soRenderReglesTable(session.soDraft, true); refreshSoPreview(key); },
        function () { soAppliquerBrouillon(key); }
      );
    });

    var abandonner = document.getElementById("so-simu-discard");
    // Correctif Lot 2 (audit UX console, 17 aout 2026) : remplace la
    // confirmation prealable de B6 par le vrai mecanisme complet --
    // action immediate, retour arriere 10s via le toast partage.
    if (abandonner) abandonner.addEventListener("click", function () {
      var precedent = session.soDraft ? session.soDraft.slice() : null;
      session.soDraft = null;
      resetSoForm();
      refreshSoTable(key);
      showUndoToast(T("Toutes les modifications ont été annulées."), function () {
        session.soDraft = precedent;
        soRenderReglesTable(session.soDraft, true);
        refreshSoPreview(key);
      });
    });
  }

  // ---------------- Manipulation directe depuis la grille ----------------
  //
  // Chaque fiche porte ses actions : epingler, releguer, retirer, deplacer.
  // AUCUNE n'enregistre quoi que ce soit -- toutes alimentent le brouillon,
  // qui part en simulation. C'est ce qui distingue cette commodite d'un
  // raccourci dangereux : sans cela, un clic enverrait la regle au trafic
  // reel du marchand.

  function soRequeteCourante() {
    var champ = document.getElementById("so-preview-query");
    return champ ? champ.value.trim() : "";
  }

  // Amorce le brouillon depuis les regles DEJA ENREGISTREES avant toute
  // mutation. Sans cela, la premiere action sur une fiche produirait un
  // brouillon ne contenant qu'elle -- et l'application effacerait les
  // regles existantes, puisque la simulation remplace l'ensemble.
  function soAvecBrouillon(key, suite) {
    if (session.soDraft) return suite();
    apiFetch("/v1/index/" + encodeURIComponent(session.soCurrentCatalog) + "/search-overrides", key)
      .then(function (data) {
        session.soDraft = (data.overrides || []).map(function (o) {
          var r = { query: o.query, product_id: o.product_id, action: o.action };
          if (o.position) r.position = o.position;
          // Correctif (20 aout 2026) : le rail affichait encore
          // "rt-47645602185510" alors que le moteur renvoie desormais le
          // nom du produit. Cause trouvee ici et non dans le rendu : la
          // projection vers le brouillon ne recopiait que quatre champs
          // et laissait tomber product_name. Le rail lit soDraft, pas la
          // reponse -- corriger le backend seul ne suffisait pas.
          //
          // Absent si le produit n'est plus indexe : la cle reste alors
          // absente ici aussi, et le repli sur l'identifiant s'applique.
          if (o.product_name) r.product_name = o.product_name;
          return r;
        });
        suite();
      })
      .catch(function () { session.soDraft = []; suite(); });
  }

  function soTrouver(q, pid) {
    if (!session.soDraft) return -1;
    for (var i = 0; i < session.soDraft.length; i++) {
      if (session.soDraft[i].query === q && session.soDraft[i].product_id === pid) return i;
    }
    return -1;
  }

  function soEpingles(q) {
    return session.soDraft
      .filter(function (r) { return r.query === q && r.action === "pin"; })
      .sort(function (a, b) { return (a.position || 999) - (b.position || 999); });
  }

  // Renumerote les positions de 1 a N : sans cela, des suppressions
  // successives laisseraient des trous (1, 3, 7) que le moteur interprete
  // bien mais qui rendent l'ecran incomprehensible.
  function soRenumeroter(q) {
    soEpingles(q).forEach(function (r, i) { r.position = i + 1; });
  }

  function soAction(key, action, pid, productName) {
    var q = soRequeteCourante();
    if (!q) return;  // garde-fou : voir soVerifierRequete

    soAvecBrouillon(key, function () {
      var i = soTrouver(q, pid);
      if (action === "retirer") {
        if (i !== -1) session.soDraft.splice(i, 1);
      } else if (i !== -1) {
        session.soDraft[i].action = action;
        if (action === "bury") delete session.soDraft[i].position;
        // Correctif Lot 2 (audit UX console, 17 aout 2026) : complete le
        // nom s'il manquait encore (ex. regle creee depuis le formulaire
        // manuel, sans nom connu a ce moment-la).
        if (productName && !session.soDraft[i].product_name) session.soDraft[i].product_name = productName;
      } else {
        var regle = { query: q, product_id: pid, action: action };
        if (productName) regle.product_name = productName;
        if (action === "pin") {
          // « Epingler » signifie tete de gondole : position 1, les autres
          // epingles descendent d'un rang. C'est l'usage attendu -- on
          // epingle pour mettre en avant, pas pour ranger en queue.
          soEpingles(q).forEach(function (r) { r.position = (r.position || 1) + 1; });
          regle.position = 1;
        }
        session.soDraft.push(regle);
      }
      soRenumeroter(q);
      // Correctif B3 : "Regles en place" reflete la manipulation directe
      // depuis la grille (epingler/releguer/retirer), pas seulement
      // l'apercu.
      soRenderReglesTable(session.soDraft, true);
      refreshSoPreview(key);
    });
  }

  // Deplace un produit d'UNE place dans l'ordre affiche, epingle ou non.
  //
  // CONTRAINTE DU MODELE, rendue visible plutot que masquee : le moteur
  // place les epingles en bloc compacte en tete, la position ordonnant les
  // epingles ENTRE EUX -- ce n'est pas un rang absolu. Epingler un produit
  // « en position 3 » le fait donc remonter en tete si rien d'autre n'est
  // epingle.
  //
  // Pour qu'un deplacement d'une place produise exactement le resultat
  // attendu, il faut donc FIGER l'ordre au-dessus du produit deplace. C'est
  // ce que fait cette fonction : elle materialise en epinglages les
  // positions de rang 1 jusqu'au produit concerne. Plusieurs regles
  // apparaissent alors dans le brouillon -- c'est normal, et visible avant
  // enregistrement.
  // Deplace un produit d'une place, en UNE SEULE regle.
  //
  // SIMPLIFICATION MAJEURE apres le passage du moteur au rang absolu
  // (26 juillet). L'ancienne version devait materialiser en epinglages tous
  // les rangs jusqu'au produit deplace -- jusqu'a 90 regles pour un seul
  // geste -- parce que la `position` n'ordonnait que les epingles entre eux.
  // Elle designe desormais le rang FINAL : une regle suffit.
  function soDeplacer(key, pid, sens, productName) {
    var q = soRequeteCourante();
    if (!q || !soOrdreAffiche.length) return;
    var i = soOrdreAffiche.indexOf(pid);
    var cible = i + sens;
    if (i === -1 || cible < 0 || cible >= soOrdreAffiche.length) return;

    soAvecBrouillon(key, function () {
      // On retire une eventuelle regle existante sur ce produit, puis on
      // pose le rang voulu. Les autres produits ne sont pas touches.
      var regle = { query: q, product_id: pid, action: "pin", position: cible + 1 };
      // Meme correctif Lot 2 que soAction : propage le nom pour le
      // recapitulatif (§4.4), completant celui d'une entree existante si
      // absent.
      var existante = session.soDraft.filter(function (r) { return r.query === q && r.product_id === pid; })[0];
      if (productName) regle.product_name = productName;
      else if (existante && existante.product_name) regle.product_name = existante.product_name;
      session.soDraft = session.soDraft.filter(function (r) {
        return !(r.query === q && r.product_id === pid);
      });
      session.soDraft.push(regle);
      // Meme correctif B3 que soAction.
      soRenderReglesTable(session.soDraft, true);
      refreshSoPreview(key);
    });
  }


  // Message d'invite quand aucune requete n'est saisie : une priorite se
  // declenche SUR une requete, il n'y a donc rien a epingler depuis la vue
  // catalogue. On explique plutot que de creer une regle sans declencheur.
  function soVerifierRequete() {
    var legende = document.getElementById("so-preview-caption");
    if (legende && !soRequeteCourante()) {
      legende.innerHTML = "<strong>" + T("Saisissez d'abord une requête") + "</strong> " +
        T("pour épingler ou reléguer : une règle se déclenche sur une recherche précise, elle n'existe pas en dehors d'une requête.");
      legende.classList.add("so-caption-warn");
      setTimeout(function () { legende.classList.remove("so-caption-warn"); }, 2600);
      return false;
    }
    return true;
  }

  // Glisser-deposer, EN COMPLEMENT des boutons monter/descendre -- jamais a
  // leur place. Seules les fiches epinglees sont deplacables : reordonner
  // n'a de sens que pour elles, les autres suivent le classement naturel.
  function wireSoDragDrop(key) {
    var grille = document.getElementById("so-preview-grid");
    if (!grille) return;
    var depuis = null;
    var depuisNom = null;

    grille.addEventListener("dragstart", function (e) {
      var carte = e.target.closest(".so-card[draggable='true']");
      if (!carte) return;
      depuis = carte.getAttribute("data-pid");
      depuisNom = carte.getAttribute("data-name");
      carte.classList.add("so-card-dragging");
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });
    grille.addEventListener("dragend", function () {
      depuis = null;
      grille.querySelectorAll(".so-card-dragging, .so-card-dragover").forEach(function (el) {
        el.classList.remove("so-card-dragging", "so-card-dragover");
      });
    });
    grille.addEventListener("dragover", function (e) {
      var carte = e.target.closest(".so-card[draggable='true']");
      if (!depuis || !carte) return;
      e.preventDefault();
      carte.classList.add("so-card-dragover");
    });
    grille.addEventListener("dragleave", function (e) {
      var carte = e.target.closest(".so-card");
      if (carte) carte.classList.remove("so-card-dragover");
    });
    grille.addEventListener("drop", function (e) {
      var carte = e.target.closest(".so-card[draggable='true']");
      if (!depuis || !carte) return;
      e.preventDefault();
      var vers = carte.getAttribute("data-pid");
      if (vers === depuis) return;
      var q = soRequeteCourante();
      if (!q || !session.soDraft) return;
      // Reinsertion a la position de la cible, puis renumerotation --
      // plutot qu'un simple echange, qui donnerait un resultat surprenant
      // sur un deplacement de plusieurs rangs.
      // DEPOT : on pose le rang absolu de la cible, en UNE regle.
      //
      // L'ancienne version reordonnait soEpingles(q) -- la liste des REGLES
      // deja posees -- ce qui obligeait a epingler les deux produits au
      // prealable. Depuis le passage du moteur au rang absolu, on travaille
      // sur l'ordre AFFICHE : n'importe quelle fiche est deplacable, et le
      // geste ne coute qu'une regle.
      var iD = soOrdreAffiche.indexOf(depuis);
      var iV = soOrdreAffiche.indexOf(vers);
      if (iD === -1 || iV === -1) return;
      session.soDraft = session.soDraft.filter(function (r) {
        return !(r.query === q && r.product_id === depuis);
      });
      var regleDrop = { query: q, product_id: depuis, action: "pin", position: iV + 1 };
      var existanteDrop = session.soDraft.filter(function (r) { return r.query === q && r.product_id === depuis; })[0];
      if (depuisNom) regleDrop.product_name = depuisNom;
      else if (existanteDrop && existanteDrop.product_name) regleDrop.product_name = existanteDrop.product_name;
      session.soDraft.push(regleDrop);
      // Meme correctif B3 que soAction/deplacement -- glisser-deposer.
      soRenderReglesTable(session.soDraft, true);
      refreshSoPreview(key);
    });
  }

  function wireSoGridActions(key) {
    wireSoDragDrop(key);
    var grille = document.getElementById("so-preview-grid");
    if (!grille) return;
    grille.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-so-act]");
      if (!btn) return;
      if (!soVerifierRequete()) return;
      var act = btn.getAttribute("data-so-act");
      var pid = btn.getAttribute("data-pid");
      var nom = btn.getAttribute("data-name");
      if (act === "up") soDeplacer(key, pid, -1, nom);
      else if (act === "down") soDeplacer(key, pid, 1, nom);
      else soAction(key, act, pid, nom);
    });
  }

  // ---------------- Aide au premier usage des editeurs de regles ----------------
  //
  // Affichee une seule fois par navigateur, et consideree comme comprise des
  // que l'utilisateur AGIT sur une fiche -- pas seulement s'il ferme la
  // bulle. Quelqu'un qui a deja epingle un produit n'a plus besoin qu'on lui
  // explique comment faire.
  //
  // Le meme gabarit sert aux deux editeurs (Search et Ranking) : leur
  // fonctionnement est identique, un seul indicateur « vu » suffit.
  function wireTutoEditeur(ids) {
    var vu = localStorage.getItem("heurix_tuto_editeur_vu") === "1";
    var boites = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!boites.length) return;

    function marquerVu() {
      localStorage.setItem("heurix_tuto_editeur_vu", "1");
      boites.forEach(function (b) { b.hidden = true; });
    }
    if (!vu) boites.forEach(function (b) { b.hidden = false; });

    boites.forEach(function (b) {
      var fermer = b.querySelector(".so-tuto-close");
      if (fermer) fermer.addEventListener("click", marquerVu);
    });

    // Correctif (21 aout 2026, audit de densite). Ce tutoriel ne
    // s'affichait qu'UNE fois, puis disparaissait definitivement -- le
    // choix etait memorise, sans aucun moyen de revenir dessus.
    //
    // Or il dit exactement ce que repetait le paragraphe permanent de la
    // page categorie, y compris la regle du blocage des positions
    // au-dessus. Ce paragraphe cede donc la place a un lien qui rouvre
    // ce tutoriel : le contenu se replie, l'acces reste.
    document.addEventListener("click", function (e) {
      var lien = e.target.closest("[data-rouvrir-tuto]");
      if (!lien) return;
      var boite = document.getElementById(lien.getAttribute("data-rouvrir-tuto"));
      if (!boite) return;
      boite.hidden = !boite.hidden;
      if (!boite.hidden) boite.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    // Agir vaut comprehension : un clic sur une action de fiche suffit.
    ["so-preview-grid", "br-grid"].forEach(function (id) {
      var g = document.getElementById(id);
      if (g) g.addEventListener("click", function (e) {
        if (e.target.closest("[data-so-act], [data-br-act]")) marquerVu();
      });
    });
  }

  // ---------------- Synonymes et Custom Rules, sous Personnalisation ----------------
  //
  // Ils vivaient dans la carte de chaque catalogue, sous « Mes catalogues » --
  // un endroit ou personne ne pense a chercher quand il veut personnaliser sa
  // recherche. Deplaces ici, PAS dupliques.
  //
  // Le cablage n'est pas reecrit : wireSynonymControls et
  // wireCustomRuleControls prennent un element et un nom de catalogue. On
  // reconstruit donc le meme balisage (memes classes) dans un conteneur, et
  // on leur passe. Toute evolution du cablage profite aux deux endroits sans
  // duplication de logique.
  // Correctif (19 aout 2026, brief §4.3) : crMarkup() separee en deux
  // fonctions -- Synonymes et Termes metier vivent desormais dans deux
  // vrais conteneurs distincts (deux onglets), plutot qu'un seul bloc.
  function crMarkupSynonymes() {
    return '<div class="catalog-synonyms-label">' + T("Synonymes") + '</div>' +
      '<div class="catalog-synonym-groups"></div>' +
      '<div class="catalog-synonym-add">' +
        '<input type="text" placeholder="' + T("ex. placo, ba13") + '" class="catalog-synonym-input">' +
        '<button type="button" class="catalog-synonym-add-btn">' + T("Ajouter un synonyme") + '</button>' +
        '<span class="catalog-synonym-status catalog-rule-status"></span>' +
      '</div>' +
      // Correctif (21 aout 2026) : le moteur sait faire du sens unique
      // depuis ce matin, mais rien ne permettait de le demander.
      //
      // Case a cocher plutot que boutons radio : le sens unique convient
      // dans la grande majorite des cas, et un defaut sur n'ajoute une
      // decision que pour ceux qui en ont besoin. L'apercu se reecrit
      // avec les termes saisis -- le marchand lit l'effet exact de sa
      // regle avant de valider, plutot qu'une explication abstraite.
      '<p class="syn-apercu" id="syn-apercu"></p>' +
      '<label class="syn-sens-label">' +
        '<input type="checkbox" class="syn-bidirectionnel">' +
        T("Fonctionne aussi dans l'autre sens") +
      '</label>';
  }

  function crMarkupTermes() {
    return '<div class="catalog-synonyms-label">' + T("Reconnaissances") + '</div>' +
      '<div class="catalog-rules-list"></div>' +
      '<div class="catalog-synonyms-label catalog-rule-form-title" style="margin-top:14px; font-size:12.5px;">' + T("Ajouter une reconnaissance") + '</div>' +
      '<div class="catalog-rule-add">' +
        '<div class="catalog-rule-add-row">' +
          '<select class="catalog-rule-type">' +
            '<option value="keyword">' + T("Reconnaître un mot métier") + '</option>' +
            '<option value="prefix_number">' + T("Reconnaître une référence (ex. M8, DN20)") + '</option>' +
          '</select>' +
          '<input type="text" placeholder="' + T("Nom de la reconnaissance, ex. Cheville") + '" class="catalog-rule-label">' +
        '</div>' +
        '<input type="text" placeholder="' + T("Mots équivalents, ex. placo, cheville, molly") + '" class="catalog-rule-keywords">' +
        '<input type="text" placeholder="' + T("Préfixe à reconnaître, ex. M (pour M8, M10…)") + '" class="catalog-rule-prefix" hidden>' +
        '<button type="button" class="catalog-rule-add-btn">' + T("Créer la reconnaissance") + '</button>' +
        '<button type="button" class="btn btn-ghost catalog-rule-cancel-edit-btn" hidden style="margin-left:8px;">' + T("Annuler la modification") + '</button>' +
        '<span class="catalog-rule-status"></span>' +
      '</div>';
  }

  // Correctif (19 aout 2026, brief §4.3) : deux conteneurs distincts
  // (Synonymes, Termes metier) plutot qu'un seul host -- chaque
  // fonction de cablage recoit desormais son propre conteneur, pas le
  // meme partage. Si un seul des deux existe (ex. l'ancien onglet de
  // Search, si jamais reintroduit ailleurs), le code reste defensif.
  function chargerSynonymesEtRegles(key) {
    var hostSynonymes = document.getElementById("cr-host-synonymes");
    var hostTermes = document.getElementById("cr-host-termes");
    var invite = document.getElementById("cr-hint");
    if (!hostSynonymes && !hostTermes) return;
    var catalogue = catalogueCourant();
    if (!catalogue) {
      if (hostSynonymes) hostSynonymes.innerHTML = "";
      if (hostTermes) hostTermes.innerHTML = "";
      if (invite) invite.hidden = false;
      return;
    }
    if (invite) invite.hidden = true;
    // On reconstruit a chaque changement de catalogue : le cablage attache
    // ses ecouteurs aux elements, les recreer evite qu'ils pointent vers le
    // catalogue precedent.
    var objetCatalogue = { catalog: catalogue };
    if (hostSynonymes) {
      hostSynonymes.innerHTML = crMarkupSynonymes();
      wireSynonymControls(hostSynonymes, objetCatalogue, key);
    }
    if (hostTermes) {
      hostTermes.innerHTML = crMarkupTermes();
      wireCustomRuleControls(hostTermes, objetCatalogue, key);
    }
  }


  // Correctif Lot 3 (audit UX console, 17-18 aout 2026) : structure en
  // onglets (§3.4 du brief). Fonction generique, prend le prefixe des
  // ids (ex. "so") -- reutilisable pour d'autres groupes d'onglets
  // futurs sans dupliquer cette logique. Pattern ARIA tabs standard :
  // aria-selected, tabindex roving (-1 sur les onglets inactifs, pour
  // que Tab s'arrete une seule fois sur le groupe, les fleches
  // naviguent entre onglets).
  function wireConsoleTabs(prefix, onglets) {
    var boutons = onglets.map(function (nom) { return document.getElementById(prefix + "-tab-" + nom); });
    var panneaux = onglets.map(function (nom) { return document.getElementById(prefix + "-tabpanel-" + nom); });

    function activer(index) {
      boutons.forEach(function (b, i) {
        if (!b) return;
        var actif = i === index;
        b.setAttribute("aria-selected", actif ? "true" : "false");
        b.classList.toggle("console-tab-active", actif);
        b.tabIndex = actif ? 0 : -1;
      });
      panneaux.forEach(function (p, i) { if (p) p.hidden = i !== index; });
    }

    boutons.forEach(function (b, i) {
      if (!b) return;
      b.addEventListener("click", function () { activer(i); });
      b.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        var suivant = (i + (e.key === "ArrowRight" ? 1 : -1) + boutons.length) % boutons.length;
        activer(suivant);
        boutons[suivant].focus();
      });
    });
  }

  function wireSearchOverridesPane(key) {
    // C1 (25 aout 2026) : ces quatre appels etaient AVANT la garde, donc
    // rejoues a chaque passage -- 42 des 176 ecouteurs surnumeraires
    // mesures venaient d'ici, sur des elements permanents (#so-query,
    // #so-position, #so-preview-grid et ses cinq evenements de
    // glisser-deposer). La garde ne protegeait que ce qui la suivait.
    // Ils rejoignent le bloc garde : ils ne posent que des ecouteurs, le
    // rafraichissement des donnees passe par refreshSoTable/refreshSoPreview,
    // appelees separement au changement de catalogue.
    if (soFormWired) return;
    soFormWired = true;

    wireSoPreview(key);
    wireSoDraft(key);
    wireSoGridActions(key);
    wireSoProductAutocomplete(key);

    wireConsoleTabs("obs", ["populaires", "sans-resultat", "erreurs"]);
    // Correctif (18 aout 2026, brief §3.1) : meme geste pour "Produits"
    // (Les plus vus / Souvent achetes ensemble). Prefixe "obs" partage
    // avec Recherches sans conflit -- les noms d'onglets differents
    // (vus/associes vs populaires/sans-resultat/erreurs) donnent des
    // id distincts.
    wireConsoleTabs("obs", ["vus", "associes"]);
    // Correctif (18 aout 2026, brief §3.1) : fusion en onglets. Consulter
    // les erreurs les marque vues -- deplace de showPane() (qui ne
    // s'appliquera plus jamais, paneId ne vaut plus "pane-errors") vers
    // le vrai moment ou l'utilisateur bascule specifiquement sur cet
    // onglet. Deux badges a eteindre : celui du bouton sidebar (premier
    // point de contact, garde pour signaler "il y a des erreurs" sans
    // avoir a ouvrir la page) et celui de l'onglet lui-meme.
    var obsTabErreurs = document.getElementById("obs-tab-erreurs");
    if (obsTabErreurs) obsTabErreurs.addEventListener("click", function () {
      if (typeof _dernieresErreurs === "undefined") return;
      marquerErreursVues(_dernieresErreurs);
      var bSidebar = document.getElementById("nav-badge-erreurs");
      var bOnglet = document.getElementById("nav-badge-erreurs-onglet");
      if (bSidebar) bSidebar.hidden = true;
      if (bOnglet) bOnglet.hidden = true;
    });

    // Correctif (19 aout 2026, brief §4.3) : "vocabulaire" retire de
    // cette liste -- sorti vers sa propre page (pane-vocabulaire),
    // wireConsoleTabs("voc", ...) cablee separement plus bas.
    wireConsoleTabs("so", ["apercu", "regles"]);
    wireConsoleTabs("voc", ["synonymes", "termes"]);

    // Correctif (18 aout 2026, retour Alexis) : bouton d'aide, ouvre/ferme
    // le pavé explicatif deplace depuis l'en-tete de la page.
    var soAideBtn = document.getElementById("so-aide-btn");
    var soAidePanel = document.getElementById("so-aide-panel");
    if (soAideBtn && soAidePanel) soAideBtn.addEventListener("click", function () {
      var ouvert = !soAidePanel.hidden;
      soAidePanel.hidden = ouvert;
      soAideBtn.setAttribute("aria-expanded", ouvert ? "false" : "true");
    });

    // Correctif (18 aout 2026, retour Alexis) : second bouton d'aide,
    // meme pattern toggle, pour les explications de l'apercu (compresse
    // les deux paragraphes derriere une puce plutot que de les laisser
    // toujours visibles).
    var soApercuAideBtn = document.getElementById("so-apercu-aide-btn");
    var soApercuAidePanel = document.getElementById("so-apercu-aide-panel");
    if (soApercuAideBtn && soApercuAidePanel) soApercuAideBtn.addEventListener("click", function () {
      var ouvert = !soApercuAidePanel.hidden;
      soApercuAidePanel.hidden = ouvert;
      soApercuAideBtn.setAttribute("aria-expanded", ouvert ? "false" : "true");
    });

    // Correctif (19 aout 2026, brief §4.3 "acces contextuel") : "un
    // bouton + cree un synonyme sans quitter la recherche en cours".
    // Reutilise le vrai endpoint deja existant (GET puis PUT sur
    // /v1/index/{catalog}/synonyms, verifie dans wireSynonymControls)
    // plutot que d'en construire un nouveau -- meme contrat, meme
    // validation minimale (au moins deux mots dans le groupe final).
    var soRailSynonymeBtn = document.getElementById("so-rail-synonyme-btn");
    var soSynonymeModal = document.getElementById("so-synonyme-modal");
    var soSynonymeRequeteAffichee = document.getElementById("so-synonyme-requete-affichee");
    var soSynonymeRequete = document.getElementById("so-synonyme-requete");
    var soSynonymeMots = document.getElementById("so-synonyme-mots");
    var soSynonymeStatus = document.getElementById("so-synonyme-status");
    var soSynonymeSubmitBtn = document.getElementById("so-synonyme-submit-btn");

    function fermerSoSynonymeModal() {
      if (soSynonymeModal) soSynonymeModal.hidden = true;
    }

    if (soRailSynonymeBtn && soSynonymeModal) soRailSynonymeBtn.addEventListener("click", function () {
      var champQuery = document.getElementById("so-preview-query");
      var requete = champQuery ? champQuery.value.trim() : "";
      if (!requete) {
        alert(T("Tapez d'abord une requête dans l'aperçu — le synonyme se rattache à elle."));
        return;
      }
      soSynonymeRequete.value = requete;
      if (soSynonymeRequeteAffichee) soSynonymeRequeteAffichee.textContent = requete;
      soSynonymeMots.value = "";
      if (soSynonymeStatus) { soSynonymeStatus.className = "catalog-rule-status"; soSynonymeStatus.textContent = ""; }
      soSynonymeModal.hidden = false;
      soSynonymeMots.focus();
    });

    var soSynonymeCloseBtn = document.getElementById("so-synonyme-close-btn");
    if (soSynonymeCloseBtn) soSynonymeCloseBtn.addEventListener("click", fermerSoSynonymeModal);

    // Correctif (19 aout 2026, retour Alexis apres capture reelle) :
    // toggle du panneau pipeline -- bouton hidden par soRafraichirPipeline
    // quand q est vide, donc jamais cliquable dans ce cas ; le toggle
    // lui-meme ne fait que basculer la vraie visibilite du panneau deja
    // rempli, pas de logique de contenu ici.
    var soPipelineBtn = document.getElementById("so-pipeline-btn");
    var soPipelinePanel = document.getElementById("so-pipeline");
    if (soPipelineBtn && soPipelinePanel) soPipelineBtn.addEventListener("click", function () {
      var ouvert = !soPipelinePanel.hidden;
      soPipelinePanel.hidden = ouvert;
      soPipelineBtn.setAttribute("aria-expanded", ouvert ? "false" : "true");
    });

    // Correctif (19 aout 2026, brief §4.2) : meme toggle, Browse.
    var brPipelineBtn = document.getElementById("br-pipeline-btn");
    var brPipelinePanel = document.getElementById("br-pipeline");
    if (brPipelineBtn && brPipelinePanel) brPipelineBtn.addEventListener("click", function () {
      var ouvert = !brPipelinePanel.hidden;
      brPipelinePanel.hidden = ouvert;
      brPipelineBtn.setAttribute("aria-expanded", ouvert ? "false" : "true");
    });

    var soSynonymeForm = document.getElementById("so-synonyme-form");
    if (soSynonymeForm) soSynonymeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var mots = soSynonymeMots.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
      if (mots.length < 1) {
        if (soSynonymeStatus) {
          soSynonymeStatus.className = "catalog-rule-status err";
          soSynonymeStatus.textContent = T("Saisissez au moins un mot équivalent.");
        }
        return;
      }
      var nouveauGroupe = [soSynonymeRequete.value].concat(mots);
      var catalogue = catalogueCourant();
      if (!catalogue) return;
      soSynonymeSubmitBtn.disabled = true;
      apiFetch("/v1/index/" + encodeURIComponent(catalogue) + "/synonyms", key)
        .then(function (data) {
          var groupes = (data.groups || []).concat([nouveauGroupe]);
          return apiFetch("/v1/index/" + encodeURIComponent(catalogue) + "/synonyms", key, { method: "PUT", body: { groups: groupes } });
        })
        .then(function () {
          soSynonymeSubmitBtn.disabled = false;
          fermerSoSynonymeModal();
          // Le nouveau synonyme peut changer les resultats affiches --
          // rafraichit l'apercu pour le montrer immediatement.
          refreshSoPreview(key);
        })
        .catch(function () {
          soSynonymeSubmitBtn.disabled = false;
          if (soSynonymeStatus) {
            soSynonymeStatus.className = "catalog-rule-status err";
            soSynonymeStatus.textContent = T("Erreur — réessayez.");
          }
        });
    });

    // Correctif (18 aout 2026, brief §"Reglages d'apercu") : meme
    // pattern toggle. Rafraichit aussi l'apercu a la fermeture -- les
    // reglages a l'interieur (limite, rupture, familles, visuels)
    // n'ont d'effet qu'une fois le panneau referme, evite un
    // rafraichissement par reglage individuel.
    var soReglagesBtn = document.getElementById("so-apercu-reglages-btn");
    var soReglagesPanel = document.getElementById("so-apercu-reglages-panel");
    if (soReglagesBtn && soReglagesPanel) soReglagesBtn.addEventListener("click", function () {
      var ouvert = !soReglagesPanel.hidden;
      soReglagesPanel.hidden = ouvert;
      soReglagesBtn.setAttribute("aria-expanded", ouvert ? "false" : "true");
      if (ouvert) refreshSoPreview(key);
    });
    document.addEventListener("click", function (e) {
      if (!soReglagesPanel || soReglagesPanel.hidden) return;
      if (soReglagesPanel.contains(e.target) || e.target === soReglagesBtn) return;
      soReglagesPanel.hidden = true;
      soReglagesBtn.setAttribute("aria-expanded", "false");
      refreshSoPreview(key);
    });

    // Correctif (18 aout 2026, brief §"Etat initial, aucune recherche
    // saisie -- ecran d'amorce") : clic sur une chip remplit le champ,
    // exactement le comportement decrit dans le brief ("elles
    // remplissent le champ au clic").
    var soAmorceConteneur = document.getElementById("so-preview-amorce");
    if (soAmorceConteneur) soAmorceConteneur.addEventListener("click", function (e) {
      var chip = e.target.closest("[data-so-amorce-query]");
      if (!chip) return;
      var champ = document.getElementById("so-preview-query");
      if (!champ) return;
      champ.value = chip.getAttribute("data-so-amorce-query");
      refreshSoPreview(key);
      soRafraichirColonneContextuelle(key);
      champ.focus();
    });

    // Correctif Lot 3 (audit UX console, 18 aout 2026) : onglet "Regles
    // du catalogue" -- lignes cliquables, badge de conflit, selection
    // multiple avec suppression groupee (§4.6 du brief).
    var soCatalogueSelection = new Set();

    function soCatalogueSelectionCle(query, productId) { return query + "||" + productId; }

    function soCatalogueMajBoutonSelection() {
      var btn = document.getElementById("so-catalogue-supprimer-selection");
      var compte = document.getElementById("so-catalogue-selection-compte");
      if (!btn) return;
      btn.hidden = soCatalogueSelection.size === 0;
      if (compte) compte.textContent = soCatalogueSelection.size;
    }

    var soTablePanel = document.getElementById("so-tabpanel-regles");
    if (soTablePanel) soTablePanel.addEventListener("click", function (e) {
      var conflitBtn = e.target.closest("[data-so-conflit-info]");
      if (conflitBtn) {
        e.stopPropagation();
        alert(T("Une autre règle vise déjà la position {0} sur la recherche « {1} ». Seule l'une des deux s'appliquera — vérifiez laquelle dans l'onglet Aperçu.", conflitBtn.getAttribute("data-position"), conflitBtn.getAttribute("data-query")));
        return;
      }
      var ligneBtn = e.target.closest("[data-so-aller-apercu]");
      if (ligneBtn) {
        var query = ligneBtn.getAttribute("data-query");
        document.getElementById("so-tab-apercu").click();
        var champ = document.getElementById("so-preview-query");
        if (champ) { champ.value = query; refreshSoPreview(key); champ.focus(); }
      }
    });

    if (soTablePanel) soTablePanel.addEventListener("change", function (e) {
      var check = e.target.closest("[data-so-select]");
      if (!check) return;
      var cle = soCatalogueSelectionCle(check.getAttribute("data-query"), check.getAttribute("data-product-id"));
      if (check.checked) soCatalogueSelection.add(cle); else soCatalogueSelection.delete(cle);
      soCatalogueMajBoutonSelection();
    });

    var soSelectTout = document.getElementById("so-catalogue-select-tout");
    if (soSelectTout) soSelectTout.addEventListener("change", function () {
      var cases = document.querySelectorAll("#so-table [data-so-select]");
      cases.forEach(function (c) {
        c.checked = soSelectTout.checked;
        var cle = soCatalogueSelectionCle(c.getAttribute("data-query"), c.getAttribute("data-product-id"));
        if (soSelectTout.checked) soCatalogueSelection.add(cle); else soCatalogueSelection.delete(cle);
      });
      soCatalogueMajBoutonSelection();
    });

    var soSupprimerSelectionBtn = document.getElementById("so-catalogue-supprimer-selection");
    if (soSupprimerSelectionBtn) soSupprimerSelectionBtn.addEventListener("click", function () {
      var n = soCatalogueSelection.size;
      if (n === 0) return;
      if (!confirm(T("Supprimer {0} règle(s) ? Cette action est immédiate et ne passe pas par le brouillon.", n))) return;
      soSupprimerSelectionBtn.disabled = true;
      var appels = Array.from(soCatalogueSelection).map(function (cle) {
        var parts = cle.split("||");
        var url = "/v1/index/" + encodeURIComponent(session.soCurrentCatalog) + "/search-overrides" +
          "?query=" + encodeURIComponent(parts[0]) + "&product_id=" + encodeURIComponent(parts[1]);
        return apiFetch(url, key, { method: "DELETE" });
      });
      Promise.all(appels).then(function () {
        soCatalogueSelection.clear();
        if (soSelectTout) soSelectTout.checked = false;
        soSupprimerSelectionBtn.disabled = false;
        soCatalogueMajBoutonSelection();
        refreshSoTable(key);
      }).catch(function () { soSupprimerSelectionBtn.disabled = false; });
    });

    // Correctif Lot 3 (audit UX console, 18 aout 2026) : onglet "Regles
    // du catalogue", barre de controles.
    var soCatRecherche = document.getElementById("so-catalogue-search");
    var soCatTimer = null;
    if (soCatRecherche) soCatRecherche.addEventListener("input", function () {
      clearTimeout(soCatTimer);
      soCatTimer = setTimeout(soRafraichirCatalogueSeul, 200);
    });
    var soCatStatut = document.getElementById("so-catalogue-filtre-statut");
    if (soCatStatut) soCatStatut.addEventListener("change", soRafraichirCatalogueSeul);

    function soMettreAJourFlechesTri() {
      document.querySelectorAll("[data-tri-fleche]").forEach(function (f) {
        f.classList.remove("asc", "desc");
        if (f.getAttribute("data-tri-fleche") === soCatalogueTri.colonne) {
          f.classList.add(soCatalogueTri.sens);
        }
      });
    }
    document.querySelectorAll(".so-tri-th").forEach(function (bouton) {
      bouton.addEventListener("click", function () {
        var col = bouton.getAttribute("data-tri");
        if (soCatalogueTri.colonne === col) {
          soCatalogueTri.sens = soCatalogueTri.sens === "asc" ? "desc" : "asc";
        } else {
          soCatalogueTri.colonne = col;
          soCatalogueTri.sens = "asc";
        }
        soMettreAJourFlechesTri();
        soRafraichirCatalogueSeul();
      });
    });

    document.getElementById("so-action").addEventListener("change", function (e) {
      // Correctif Lot 3 (audit UX console, 17-18 aout 2026) : "desactivee",
      // pas "masquee" -- le brief precise explicitement "jamais de
      // mention pin uniquement" ni de champ qui disparait, le formulaire
      // ne doit pas "sauter" quand on change d'action.
      document.getElementById("so-position").disabled = e.target.value !== "pin";
      soVerifierPositionReservee(key);
    });
    document.getElementById("so-position").addEventListener("input", function () {
      soVerifierPositionReservee(key);
    });
    // Correctif Lot 3 : ouverture/fermeture de la modale.
    var openBtn = document.getElementById("so-form-open-btn");
    if (openBtn) openBtn.addEventListener("click", function () { resetSoForm(); ouvrirSoFormModal(); });
    var closeBtn2 = document.getElementById("so-form-close-btn");
    if (closeBtn2) closeBtn2.addEventListener("click", function () { resetSoForm(); fermerSoFormModal(); });
    document.getElementById("so-cancel-edit-btn").addEventListener("click", function () { resetSoForm(); fermerSoFormModal(); });

    document.getElementById("so-form").addEventListener("submit", function (e) {
      e.preventDefault();
      // Correctif C9 (audit UX console, 17 aout 2026) : ce formulaire
      // faisait auparavant un POST direct, totalement ignore de
      // session.soDraft. Si un brouillon etait deja actif (manipulation
      // depuis la grille) au moment de la soumission, le prochain clic
      // sur "Publier sur {catalogue}" comparait le brouillon (qui ignorait
      // cet ajout) aux vraies donnees serveur re-fetchees (qui, elles, le
      // contenaient) -- et le supprimait automatiquement, silencieusement.
      // Meme cause que le bug C9 du brief cote Browse & Discovery, jamais
      // signale explicitement ici mais verifie identique au code.
      // Desormais : ce formulaire ajoute au brouillon comme la grille,
      // plus jamais de second chemin d'ecriture parallele.
      var status = document.getElementById("so-status");
      var query = document.getElementById("so-query").value.trim();
      var productId = document.getElementById("so-product-id").value.trim();
      if (!query) return;
      // Correctif Lot 3 (autocompletion produit, C3) : productId reste
      // vide si l'utilisateur a tape du texte sans jamais cliquer une
      // suggestion -- le "required" HTML5 (sur le champ visible) ne le
      // detecte pas, message explicite necessaire ici plutot qu'un
      // retour silencieux.
      if (!productId) {
        status.textContent = T("Sélectionnez un produit dans la liste des suggestions.");
        status.className = "catalog-rule-status err";
        document.getElementById("so-product-search").focus();
        return;
      }
      if (document.getElementById("so-action").value === "pin" && !document.getElementById("so-position").value) {
        document.getElementById("so-position").focus();
        return;
      }

      var submitBtn = document.getElementById("so-submit-btn");
      submitBtn.disabled = true;
      status.textContent = T("Ajout au brouillon…"); status.className = "catalog-rule-status";

      soConstruireBrouillon(key, function () {
        status.textContent = T("Ajoutée au brouillon — publiez pour l'appliquer.");
        status.className = "catalog-rule-status ok";
        resetSoForm();
        submitBtn.disabled = false;
      }, function (err) {
        status.textContent = (err && err.message) || T("Échec de l'ajout au brouillon.");
        status.className = "catalog-rule-status err";
        submitBtn.disabled = false;
      });
    });

    // Correctif (18 aout 2026) : delegue sur document plutot que
    // #so-table tbody seul, pour couvrir aussi so-liste-contextuelle
    // (colonne contextuelle, autre onglet) qui reutilise les memes
    // boutons data-so-edit/duplicate/delete.
    document.addEventListener("click", function (e) {
      var editBtn = e.target.closest("[data-so-edit]");
      var dupBtn = e.target.closest("[data-so-duplicate]");
      var delBtn = e.target.closest("[data-so-delete]");
      if (!editBtn && !dupBtn && !delBtn) return;

      if (editBtn) {
        soEditingKey = { query: editBtn.getAttribute("data-query"), productId: editBtn.getAttribute("data-product-id") };
        fillSoForm({
          query: editBtn.getAttribute("data-query"), productId: editBtn.getAttribute("data-product-id"),
          action: editBtn.getAttribute("data-action"), position: editBtn.getAttribute("data-position"),
          nom: editBtn.getAttribute("data-nom"), statut: editBtn.getAttribute("data-statut"),
          priorite: editBtn.getAttribute("data-priorite"),
          diffusionDebut: editBtn.getAttribute("data-diffusion-debut"), diffusionFin: editBtn.getAttribute("data-diffusion-fin"),
        });
        document.getElementById("so-form-title").textContent = T("Modifier la règle");
        document.getElementById("so-submit-btn").textContent = T("Enregistrer les modifications");
        document.getElementById("so-cancel-edit-btn").hidden = false;
        // Correctif Lot 3 : le formulaire vit desormais dans une modale.
        ouvrirSoFormModal();
        document.getElementById("so-query").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (dupBtn) {
        soEditingKey = null; // duplication : cree une NOUVELLE regle, ne remplace pas l'originale
        fillSoForm({
          query: dupBtn.getAttribute("data-query"), productId: dupBtn.getAttribute("data-product-id"),
          action: dupBtn.getAttribute("data-action"), position: dupBtn.getAttribute("data-position"),
          nom: dupBtn.getAttribute("data-nom"), statut: dupBtn.getAttribute("data-statut"),
          priorite: dupBtn.getAttribute("data-priorite"),
          diffusionDebut: dupBtn.getAttribute("data-diffusion-debut"), diffusionFin: dupBtn.getAttribute("data-diffusion-fin"),
        });
        document.getElementById("so-form-title").textContent = T("Dupliquer une règle — modifiez au moins un champ");
        document.getElementById("so-submit-btn").textContent = T("Créer cette règle");
        document.getElementById("so-cancel-edit-btn").hidden = false;
        ouvrirSoFormModal();
        document.getElementById("so-query").focus();
        document.getElementById("so-query").select();
        return;
      }
      if (delBtn) {
        delBtn.disabled = true;
        var url = "/v1/index/" + encodeURIComponent(session.soCurrentCatalog) + "/search-overrides" +
          "?query=" + encodeURIComponent(delBtn.getAttribute("data-query")) +
          "&product_id=" + encodeURIComponent(delBtn.getAttribute("data-product-id"));
        apiFetch(url, key, { method: "DELETE" }).then(function () { refreshSoTable(key); }).catch(function () { delBtn.disabled = false; });
      }
    });
  }

  function loadBrowseCatalogs(key) {
    if (browseCatalogsLoaded) return;
    browseCatalogsLoaded = true;
    // Chargement retire : la liste des catalogues est desormais peuplee une
    // seule fois par wireGlobalCatalog, pour toute la console.
  }

  function onBrowseCatalogChange(key) {
    var catalog = catalogueCourant();
    session.browseCurrentCatalog = catalog; session.browseCurrentCategory = "";
    // Meme correctif Lot 1 que Search Overrides.
    var boutonAppliquerBr = document.getElementById("br-simu-apply");
    if (boutonAppliquerBr && catalog) {
      boutonAppliquerBr.textContent = "Publier sur " + catalog;
    }
    var champCategorie = document.getElementById("browse-category-search");
    var idCategorie = document.getElementById("browse-category-select");
    champCategorie.value = "";
    idCategorie.value = "";
    // On masque les RESULTATS, pas le panneau : les selecteurs de catalogue
    // et de categorie y vivent desormais, les cacher rendrait impossible de
    // choisir quoi que ce soit.
    document.getElementById("browse-results").hidden = true;
    document.getElementById("browse-hint").hidden = false;
    document.getElementById("browse-no-categories").hidden = true;
    if (!catalog) {
      champCategorie.disabled = true;
      champCategorie.placeholder = T("— Choisir un catalogue d'abord —");
      return;
    }
    champCategorie.disabled = false;
    champCategorie.placeholder = T("Chargement…");
    Promise.all([
      apiFetch("/v1/index/" + encodeURIComponent(catalog) + "/browse-categories", key),
      apiFetch("/v1/index/" + encodeURIComponent(catalog) + "/browse-attributes", key),
    ]).then(function (results) {
      var categories = results[0].categories;
      browseAttributesCache = results[1].attributes;
      // Correctif (19 aout 2026, retour Alexis) : la liste vit desormais
      // dans un cache plutot que dans les <option> d'un <select> --
      // filtrage local par le champ recherchable, aucun appel reseau par
      // frappe (contrairement a la recherche produit de Search, ou le
      // volume l'impose).
      browseCategoriesCache = categories;
      if (!categories.length) {
        champCategorie.value = "";
        champCategorie.placeholder = T("— Aucune catégorie —");
        champCategorie.disabled = true;
        document.getElementById("browse-no-categories").hidden = false;
        return;
      }
      champCategorie.placeholder = T("Rechercher une catégorie…");
    }).catch(function () {
      champCategorie.placeholder = T("— Erreur de chargement —");
      champCategorie.disabled = true;
    });
  }

  // Correctif (19 aout 2026, bug signale par Alexis). Meme composant
  // recherchable que la categorie, mais fonction distincte : la
  // structure de browseAttributesCache differe ({field, values} plutot
  // que {category, products}), pas de factorisation forcee entre les
  // deux au prix d'un parametrage tordu.
  function wireBrowseAttributeFieldAutocomplete() {
    var champ = document.getElementById("browse-attribute-field-search");
    var idCache = document.getElementById("browse-attribute-field");
    var panneau = document.getElementById("browse-attribute-field-panel");
    if (!champ || !idCache || !panneau) return;

    function fermerPanneau() {
      panneau.hidden = true;
      panneau.innerHTML = "";
    }

    function filtrer() {
      var q = champ.value.trim().toLowerCase();
      var liste = q
        ? browseAttributesCache.filter(function (a) { return a.field.toLowerCase().indexOf(q) !== -1; })
        : browseAttributesCache;
      liste = liste.slice(0, 12);
      if (!liste.length) {
        panneau.innerHTML = "<div class='so-autocomplete-empty'>" + T("Aucun attribut ne correspond.") + "</div>";
        panneau.hidden = false;
        return;
      }
      panneau.innerHTML = liste.map(function (a) {
        return "<button type='button' class='so-autocomplete-item' data-field='" + esc(a.field) + "'>" +
          "<span class='so-autocomplete-name'>" + esc(a.field) + "</span>" +
          "<span class='so-autocomplete-meta'>" + T("{0} valeurs", (a.values || []).length) + "</span>" +
        "</button>";
      }).join("");
      panneau.hidden = false;
    }

    champ.addEventListener("input", function () { idCache.value = ""; filtrer(); });
    champ.addEventListener("focus", filtrer);

    panneau.addEventListener("click", function (e) {
      var item = e.target.closest(".so-autocomplete-item");
      if (!item) return;
      var field = item.getAttribute("data-field");
      idCache.value = field;
      champ.value = field;
      fermerPanneau();
      // Le couplage avec le second champ (valeurs proposees selon
      // l'attribut choisi) passait par l'evenement "input" du champ
      // libre -- appel explicite desormais, sinon la liste des valeurs
      // resterait vide apres une selection.
      onBrowseFieldInput();
    });

    document.addEventListener("click", function (e) {
      if (!champ.contains(e.target) && !panneau.contains(e.target)) fermerPanneau();
    });
  }

  // Brief §4.2 : l'intensite ne concerne QUE la favorisation. Sur une
  // relegation, le moteur stocke la valeur mais ne la lit jamais (une
  // relegation gagne toujours, sans gradation) -- laisser le champ
  // visible promettrait un effet inexistant.
  function majVisibiliteIntensite() {
    var wrap = document.getElementById("bar-intensite-wrap");
    var action = document.getElementById("browse-attribute-action");
    if (!wrap || !action) return;
    wrap.hidden = action.value !== "boost";
  }

  function onBrowseFieldInput() {
    var field = document.getElementById("browse-attribute-field").value.trim();
    var entry = browseAttributesCache.filter(function (a) { return a.field === field; })[0];
    document.getElementById("browse-known-values").innerHTML = entry
      ? entry.values.map(function (v) { return "<option value='" + esc(v.value) + "'>"; }).join("")
      : "";
  }

  // Correctif (19 aout 2026, retour Alexis) : champ recherchable plutot
  // qu'un <select> natif. Meme markup et memes classes CSS que
  // wireSoProductAutocomplete (verifie avant de construire), mais
  // FILTRAGE LOCAL sur browseCategoriesCache -- pas de debounce ni de
  // requete par frappe : les categories sont deja toutes en memoire
  // depuis onBrowseCatalogChange, contrairement aux produits de Search
  // (volume potentiellement enorme, d'ou l'appel reseau la-bas).
  function wireBrowseCategorieAutocomplete(key) {
    var champ = document.getElementById("browse-category-search");
    var idCache = document.getElementById("browse-category-select");
    var panneau = document.getElementById("browse-category-panel");
    if (!champ || !idCache || !panneau) return;

    function fermerPanneau() {
      panneau.hidden = true;
      panneau.innerHTML = "";
    }

    function afficherSuggestions(liste) {
      if (!liste.length) {
        panneau.innerHTML = "<div class='so-autocomplete-empty'>" + T("Aucune catégorie ne correspond.") + "</div>";
        panneau.hidden = false;
        return;
      }
      panneau.innerHTML = liste.map(function (c) {
        return "<button type='button' class='so-autocomplete-item' data-categorie='" + esc(c.category) + "'>" +
          "<span class='so-autocomplete-name'>" + esc(c.category) + "</span>" +
          "<span class='so-autocomplete-meta'>" + T("{0} produits", c.products) + "</span>" +
        "</button>";
      }).join("");
      panneau.hidden = false;
    }

    function filtrer() {
      var q = champ.value.trim().toLowerCase();
      var liste = q
        ? browseCategoriesCache.filter(function (c) { return c.category.toLowerCase().indexOf(q) !== -1; })
        : browseCategoriesCache;
      // Plafonne l'affichage : un catalogue peut avoir beaucoup de
      // categories, le panneau reste lisible et scrollable.
      afficherSuggestions(liste.slice(0, 12));
    }

    champ.addEventListener("input", function () {
      idCache.value = "";
      filtrer();
    });

    // Ouvre la liste complete au focus, meme champ vide -- remplace le
    // comportement d'un <select> qu'on deroule sans rien taper.
    champ.addEventListener("focus", filtrer);

    panneau.addEventListener("click", function (e) {
      var item = e.target.closest(".so-autocomplete-item");
      if (!item) return;
      var categorie = item.getAttribute("data-categorie");
      idCache.value = categorie;
      champ.value = categorie;
      fermerPanneau();
      onBrowseCategoryChange(key);
    });

    document.addEventListener("click", function (e) {
      if (!champ.contains(e.target) && !panneau.contains(e.target)) fermerPanneau();
    });
  }

  function onBrowseCategoryChange(key) {
    session.browseCurrentCategory = document.getElementById("browse-category-select").value;
    var resultats = document.getElementById("browse-results");
    var invite = document.getElementById("browse-hint");
    if (!session.browseCurrentCategory) {
      resultats.hidden = true;
      if (invite) invite.hidden = false;
      return;
    }
    resultats.hidden = false;
    if (invite) invite.hidden = true;
    resetBrowseOverrideForm();
    resetAttributeRuleForm();
    refreshBrowseAll(key);
  }

  function refreshBrowseAll(key) {
    refreshBrowsePreview(key);
    refreshBrowseOverrides(key);
    refreshBrowseAttributeRules(key);
  }

  // ---------------- Editeur visuel du classement de categorie ----------------
  //
  // Meme modele que cote Search : les actions alimentent un BROUILLON, envoye
  // en simulation a chaque modification. Rien n'est ecrit avant « Appliquer ».
  // Le moteur expose pour cela POST /v1/browse/{cat}/{categorie}/simulate,
  // avec les memes garanties (aucune ecriture, pas de quota Browse consomme,
  // cle serveur exigee).
  var brOrdreAffiche = [];

  function brSimuBar(actif) {
    simuBarUpdate("br", actif ? session.brDraft : null);
  }

  function brRenderGrille(hits, simule) {
    var grille = document.getElementById("br-grid");
    var legende = document.getElementById("br-caption");
    if (!grille) return;
    brOrdreAffiche = hits.map(function (h) { return h.product.id; });
    // Correctif (20 aout 2026, demande Alexis) : visuels sur les cartes,
    // comme sur Mise en avant sur recherche. Meme lecture directe depuis
    // le DOM au moment du rendu, pas d'etat separe.
    var brVisuelsBtn = document.getElementById("br-visuels");
    var brAfficherVisuels = !!(brVisuelsBtn && brVisuelsBtn.checked);

    grille.innerHTML = hits.map(function (h, i) {
      var p = h.product;
      var pid = esc(p.id);
      var regle = h.pinned || h.buried || h.boosted;
      var classes = "so-card" + (regle ? (simule ? " so-card-simulated" : " so-card-ruled") : "");
      // Correctif C4 (audit UX console, 17 aout 2026) : meme cause que
      // Search Overrides -- (i+1) duplique entre le badge et .so-card-rank
      // juste en dessous, verifie identique. Encore plus net ici :
      // so-card-rank n'est meme pas conditionnee par une requete (parcours
      // par categorie, pas de recherche textuelle) -- source unique du
      // numero sans exception. "Booste" n'avait deja pas de numero, non
      // concerne.
      // Meme correctif. "Favorise" et "Relegue" gardent leur badge : ces
      // etats n'ont pas de position imposee, ils ne peuvent pas se
      // fondre dans la pastille.
      var badge = h.boosted ? "<span class='so-card-badge so-card-badge-pin'>" + T("Favorisé") + "</span>"
        : h.buried ? "<span class='so-card-badge so-card-badge-bury'>" + T("Relégué") + "</span>" : "";
      // Correctif B1 (audit UX console, 17 aout 2026). Meme correctif que
      // Search Overrides : h.in_stock plutot que p.stock === 0.
      var enRupture = h.in_stock === false;
      var stock = h.in_stock === undefined ? "" :
        "<span class='so-card-stock" + (enRupture ? " rupture" : "") + "'>" +
        (enRupture ? T("Rupture") : T("En stock")) + "</span>";
      var prix = (p.price !== undefined && p.price !== null)
        ? "<span class='so-card-price'>" + Number(p.price).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €</span>" : "";

      // Correctif Lot 2 : data-name (boutons et carte), meme raison que
      // Search Overrides -- le recapitulatif (§4.4) a besoin du nom.
      var nomAttrBr = " data-name='" + esc(p.name || "") + "'";
      var actions = "<div class='so-card-actions'>" +
        "<button type='button'" + nomAttrBr + " data-br-act='up' data-pid='" + pid + "' title='" + escAttr(T("Monter d'une place")) + "' aria-label='" + T("Monter {0}", esc(p.name || p.id)) + "'>" + ICONES_FICHE.up + "</button>" +
        "<button type='button'" + nomAttrBr + " data-br-act='down' data-pid='" + pid + "' title='" + escAttr(T("Descendre d'une place")) + "' aria-label='" + T("Descendre {0}", esc(p.name || p.id)) + "'>" + ICONES_FICHE.down + "</button>" +
        (h.pinned
          ? "<button type='button'" + nomAttrBr + " data-br-act='retirer' data-pid='" + pid + "' title='" + escAttr(T("Retirer l'épingle")) + "' aria-label='" + T("Retirer l'épingle") + "'>" + ICONES_FICHE.off + "</button>"
          : "<button type='button'" + nomAttrBr + " data-br-act='pin' data-pid='" + pid + "' title='" + T("Mettre en tête") + "' aria-label='" + T("Mettre en tête") + "'>" + ICONES_FICHE.pin + "</button>") +
        "</div>";

      // Deux noms de champ reconnus a l'indexation (image, image_url).
      // Produit sans visuel : rien plutot qu'un cadre vide.
      var brImgSrc = p.image || p.image_url || "";
      var brVisuel = (brAfficherVisuels && brImgSrc)
        ? "<img class='so-card-visuel' src='" + esc(brImgSrc) + "' alt='' loading='lazy'>" : "";

      return "<div class='" + classes + "'" + " draggable='true' data-pid='" + pid + "'" + nomAttrBr + ">" +
        "<span class='so-card-rank" + (h.pinned ? " so-card-rank-impose" : "") + "'" +
          (h.pinned ? " title='" + escAttr(T("Position imposée par une règle")) + "'" : "") + ">" +
          (h.pinned ? ICONES_FICHE.pinPlein + " " : "") + (i + 1) + "</span>" + badge + brVisuel +
        "<div class='so-card-name'>" + esc(p.name || p.id) + "</div>" +
        "<div class='so-card-ref'>" + esc(p.ref || p.id) + "</div>" +
        "<div class='so-card-foot'>" + prix + stock + "</div>" + actions + "</div>";
    }).join("");

    if (legende) {
      legende.textContent = T(hits.length > 1 ? "{0} produits dans « {1} »" : "{0} produit dans « {1} »", hits.length, session.browseCurrentCategory) +
        (simule ? " — " + T("classement en brouillon") : "");
    }
    // Correctif (20 aout 2026) : l'etat vide etait affiche par
    // renderTable, qui alimentait le tableau deplie "Voir le tableau
    // detaille" -- supprime, car il listait les MEMES produits que la
    // grille juste au-dessus. Le message reste donc necessaire, mais il
    // doit venir d'ici.
    var videBr = document.getElementById("browse-preview-empty");
    if (videBr) videBr.hidden = hits.length > 0;
    brSimuBar(!!simule);
  }

  // Amorce le brouillon depuis les regles enregistrees : sans cela, la
  // premiere action produirait un brouillon ne contenant qu'elle, et
  // « Appliquer » effacerait tout le reste -- la simulation remplacant
  // l'ensemble. Meme piege que cote Search.
  function brAvecBrouillon(key, suite) {
    if (session.brDraft) return suite();
    var url = "/v1/browse/" + encodeURIComponent(session.browseCurrentCatalog) + "/" +
              encodeURIComponent(session.browseCurrentCategory) + "/overrides";
    apiFetch(url, key)
      .then(function (data) {
        session.brDraft = (data.overrides || []).map(function (o) {
          var r = { product_id: o.product_id, action: o.action };
          if (o.position) r.position = o.position;
          return r;
        });
        suite();
      })
      .catch(function () { session.brDraft = []; suite(); });
  }

  function brEpingles() {
    return (session.brDraft || [])
      .filter(function (r) { return r.action === "pin"; })
      .sort(function (a, b) { return (a.position || 999) - (b.position || 999); });
  }

  function brAction(key, action, pid, productName) {
    brAvecBrouillon(key, function () {
      var i = -1;
      for (var k = 0; k < session.brDraft.length; k++) {
        if (session.brDraft[k].product_id === pid) { i = k; break; }
      }
      if (action === "retirer") {
        if (i !== -1) session.brDraft.splice(i, 1);
      } else if (i !== -1) {
        session.brDraft[i].action = action;
        if (action !== "pin") delete session.brDraft[i].position;
        // Correctif Lot 2 (audit UX console, 17 aout 2026), meme cause
        // que Search Overrides : le recapitulatif (§4.4) a besoin du nom
        // du produit, pas seulement de son identifiant.
        if (productName && !session.brDraft[i].product_name) session.brDraft[i].product_name = productName;
      } else {
        var regle = { product_id: pid, action: action };
        if (productName) regle.product_name = productName;
        if (action === "pin") {
          brEpingles().forEach(function (r) { r.position = (r.position || 1) + 1; });
          regle.position = 1;
        }
        session.brDraft.push(regle);
      }
      brEpingles().forEach(function (r, n) { r.position = n + 1; });
      brSimuler(key);
    });
  }

  // Meme simplification que soDeplacer : une regle, plus N.
  function brDeplacer(key, pid, sens, productName) {
    if (!brOrdreAffiche.length) return;
    var i = brOrdreAffiche.indexOf(pid);
    var cible = i + sens;
    if (i === -1 || cible < 0 || cible >= brOrdreAffiche.length) return;

    brAvecBrouillon(key, function () {
      var regle = { product_id: pid, action: "pin", position: cible + 1 };
      var existante = session.brDraft.filter(function (r) { return r.product_id === pid; })[0];
      if (productName) regle.product_name = productName;
      else if (existante && existante.product_name) regle.product_name = existante.product_name;
      session.brDraft = session.brDraft.filter(function (r) { return r.product_id !== pid; });
      session.brDraft.push(regle);
      brSimuler(key);
    });
  }


  function brSimuler(key) {
    if (!session.browseCurrentCatalog || !session.browseCurrentCategory) return;
    var champLim = document.getElementById("browse-preview-limit");
    var lim = champLim ? parseInt(champLim.value, 10) : 24;
    var sort = document.getElementById("browse-sort-select").value;
    var url = "/v1/browse/" + encodeURIComponent(session.browseCurrentCatalog) + "/" +
              encodeURIComponent(session.browseCurrentCategory) + "/simulate";
    apiFetch(url, key, { method: "POST", body: {
      overrides: session.brDraft || [], sort: sort, limit: lim, offset: 0, filters: "", facets: "",
      // L'apercu simule doit montrer EXACTEMENT ce que verra le visiteur,
      // filtre de stock compris -- sinon il previsualise autre chose.
      in_stock_only: !!(document.getElementById("browse-in-stock") || {}).checked,
    }}).then(function (data) {
      brRenderGrille(data.hits || [], true);
      // Correctif B3 (audit UX console, 17 aout 2026) : "Priorites par
      // produit" reflete desormais le brouillon en cours, pas seulement
      // la grille d'apercu. brSimuler etant le vrai point central unique
      // appele par tous les points de mutation (brAction, brDeplacer,
      // glisser-depose, formulaire manuel), un seul appel ici suffit --
      // pas besoin de modifier chaque point d'appel individuellement,
      // contrairement a Search Overrides qui n'avait pas cette fonction
      // centrale equivalente.
      brRenderReglesTable(session.brDraft, true);
    }).catch(function () {});
  }

  function brAppliquerBrouillon(key) {
    if (!session.brDraft) return;
    var base = "/v1/browse/" + encodeURIComponent(session.browseCurrentCatalog) + "/" +
               encodeURIComponent(session.browseCurrentCategory) + "/overrides";
    var bouton = document.getElementById("br-simu-apply");
    if (bouton) bouton.disabled = true;

    apiFetch(base, key)
      .then(function (data) {
        var existantes = data.overrides || [];
        var voulus = {};
        (session.brDraft || []).forEach(function (r) { voulus[r.product_id] = r; });
        var suppressions = existantes
          .filter(function (o) { return !voulus[o.product_id]; })
          .map(function (o) {
            return apiFetch(base + "/" + encodeURIComponent(o.product_id), key, { method: "DELETE" });
          });
        return Promise.all(suppressions);
      })
      .then(function () {
        return (session.brDraft || []).reduce(function (chaine, r) {
          return chaine.then(function () {
            var corps = { product_id: r.product_id, action: r.action };
            if (r.action === "pin" && r.position) corps.position = r.position;
            return apiFetch(base, key, { method: "POST", body: corps });
          });
        }, Promise.resolve());
      })
      .then(function () {
        session.brDraft = null;
        refreshBrowseOverrides(key);
        refreshBrowsePreview(key);
      })
      .catch(function () {})
      .then(function () { if (bouton) bouton.disabled = false; });
  }

  // Glisser-deposer cote Ranking, en COMPLEMENT des fleches -- oubli de la
  // premiere version, signale par Alexis. Meme regle que cote Search : seules
  // les fiches epinglees sont deplacables, reordonner n'ayant de sens que
  // pour elles.
  function wireBrDragDrop(key) {
    var grille = document.getElementById("br-grid");
    if (!grille) return;
    var depuis = null;
    var depuisNom = null;

    grille.addEventListener("dragstart", function (e) {
      var carte = e.target.closest(".so-card[draggable='true']");
      if (!carte) return;
      depuis = carte.getAttribute("data-pid");
      depuisNom = carte.getAttribute("data-name");
      carte.classList.add("so-card-dragging");
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });
    grille.addEventListener("dragend", function () {
      depuis = null;
      grille.querySelectorAll(".so-card-dragging, .so-card-dragover").forEach(function (el) {
        el.classList.remove("so-card-dragging", "so-card-dragover");
      });
    });
    grille.addEventListener("dragover", function (e) {
      var carte = e.target.closest(".so-card[draggable='true']");
      if (!depuis || !carte) return;
      e.preventDefault();
      carte.classList.add("so-card-dragover");
    });
    grille.addEventListener("dragleave", function (e) {
      var carte = e.target.closest(".so-card");
      if (carte) carte.classList.remove("so-card-dragover");
    });
    grille.addEventListener("drop", function (e) {
      var carte = e.target.closest(".so-card[draggable='true']");
      if (!depuis || !carte) return;
      e.preventDefault();
      var vers = carte.getAttribute("data-pid");
      if (vers === depuis || !brOrdreAffiche.length) return;
      // Reinsertion a la position de la cible plutot qu'un echange : un
      // simple echange donnerait un resultat surprenant sur un deplacement
      // de plusieurs rangs.
      // DEPOT : on pose le rang absolu de la cible, en UNE regle.
      // Avant le passage du moteur au rang absolu, ce geste materialisait
      // tous les rangs intermediaires -- d'ou la restriction aux fiches
      // deja epinglees, qui n'a plus lieu d'etre.
      var iD = brOrdreAffiche.indexOf(depuis), iV = brOrdreAffiche.indexOf(vers);
      if (iD === -1 || iV === -1) return;
      var deplace = depuis;

      brAvecBrouillon(key, function () {
        var regleDrop = { product_id: deplace, action: "pin", position: iV + 1 };
        var existanteDrop = session.brDraft.filter(function (r) { return r.product_id === deplace; })[0];
        if (depuisNom) regleDrop.product_name = depuisNom;
        else if (existanteDrop && existanteDrop.product_name) regleDrop.product_name = existanteDrop.product_name;
        session.brDraft = session.brDraft.filter(function (r) { return !(r.product_id === deplace); });
        session.brDraft.push(regleDrop);
        brSimuler(key);
      });
    });
  }

  function wireBrowseEditeur(key) {
    wireBrDragDrop(key);
    var grille = document.getElementById("br-grid");
    if (grille) grille.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-br-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-br-act");
      var pid = btn.getAttribute("data-pid");
      var nom = btn.getAttribute("data-name");
      if (act === "up") brDeplacer(key, pid, -1, nom);
      else if (act === "down") brDeplacer(key, pid, 1, nom);
      else brAction(key, act, pid, nom);
    });
    var appliquer = document.getElementById("br-simu-apply");
    if (appliquer) appliquer.addEventListener("click", function () { brAppliquerBrouillon(key); });

    // Correctif Lot 2 : "Voir le detail" ouvre le recapitulatif (§4.4).
    // Un seul groupe implicite ici -- Browse & Discovery n'a pas de
    // requete textuelle (parcours par categorie), contrairement a
    // Search Overrides.
    var detailBtnBr = document.getElementById("br-simu-detail");
    if (detailBtnBr) detailBtnBr.addEventListener("click", function () {
      openRecapModal(
        session.browseCurrentCatalog,
        session.brDraft || [],
        function () { return "categorie"; },
        function () { return T("Sur la catégorie « {0} »", session.browseCurrentCategory); },
        function (nouveauDraft) { session.brDraft = nouveauDraft; brRenderReglesTable(session.brDraft, true); brSimuler(key); },
        function () { brAppliquerBrouillon(key); }
      );
    });

    var abandonner = document.getElementById("br-simu-discard");
    // Correctif Lot 2 (audit UX console, 17 aout 2026) : meme mecanisme
    // que Search Overrides -- action immediate, retour arriere 10s.
    if (abandonner) abandonner.addEventListener("click", function () {
      var precedent = session.brDraft ? session.brDraft.slice() : null;
      session.brDraft = null;
      refreshBrowseOverrides(key);
      refreshBrowsePreview(key);
      showUndoToast(T("Toutes les modifications ont été annulées."), function () {
        session.brDraft = precedent;
        brRenderReglesTable(session.brDraft, true);
        brSimuler(key);
      });
    });
  }

  // Correctif (19 aout 2026, brief §4.2 "Bloc pipeline contextuel").
  // Meme composant visuel (bouton "?" + panneau) que soRafraichirPipeline
  // (Search), mais un vrai contenu adapte -- Browse n'a ni requete
  // textuelle ni "mots trouves", les quatre etapes du pipeline Search
  // n'auraient aucun sens ici. Compte directement depuis data.hits
  // (produits reellement AFFICHES), pas une variable de session separee
  // pas toujours peuplee au bon moment.
  function brRafraichirPipeline(data) {
    var bouton = document.getElementById("br-pipeline-btn");
    var conteneur = document.getElementById("br-pipeline-contenu");
    if (!bouton || !conteneur) return;
    var hits = data.hits || [];
    if (!hits.length) { bouton.hidden = true; return; }
    bouton.hidden = false;

    var totalRegles = hits.filter(function (h) { return h.pinned || h.boosted || h.buried; }).length;
    var texteResume = totalRegles > 0
      ? T(totalRegles > 1 ? "{0} règles actives sur cette page" : "{0} règle active sur cette page", totalRegles)
      : T("aucune règle active sur cette page");

    // Correctif (19 aout 2026, brief §4.2) : "ce produit est relegue par
    // la regle X. La favorisation n'aura aucun effet." -- favorisation_
    // ignoree_par expose depuis cet apres-midi (heurix-engine, deploye).
    // regle peut etre null (relegation par produit precis, pas par
    // attribut, verifie et signale explicitement dans heurix-engine) --
    // message plus generique dans ce cas plutot que d'afficher "null".
    var conflitsHtml = hits.filter(function (h) { return "favorisation_ignoree_par" in h; }).map(function (h) {
      var nom = h.product.name || h.product.id;
      var regle = h.favorisation_ignoree_par;
      var texteRegle = regle ? T("« {0} = {1} »", regle.field, regle.value) : T("une règle de relégation");
      return "<p class='so-validation-warn' style='margin-top:6px;'>" +
        T("« {0} » est relégué par {1}. La favorisation n'aura aucun effet.", esc(nom), texteRegle) + "</p>";
    }).join("");

    conteneur.innerHTML = "<p class='console-panel-note' style='margin:0;'>" + esc(texteResume) + "</p>" + conflitsHtml;
  }

  function refreshBrowsePreview(key) {
    var sort = document.getElementById("browse-sort-select").value;
    var champLim = document.getElementById("browse-preview-limit");
    var lim = champLim ? parseInt(champLim.value, 10) : 24;
    var horsStock = document.getElementById("browse-in-stock");
    var url = "/v1/browse/" + encodeURIComponent(session.browseCurrentCatalog) + "/" + encodeURIComponent(session.browseCurrentCategory) +
              "?sort=" + sort + "&limit=" + lim +
              (horsStock && horsStock.checked ? "&in_stock_only=true" : "");
    apiFetch(url, key).then(function (data) {
      session.brDraft = null;
      brRenderGrille(data.hits || [], false);
      brRafraichirPipeline(data);
    }).catch(function () {});
  }

  var boEditingProductId = null; // produit en cours de modification (priorites par produit), null = ajout/duplication
  var barEditingKey = null; // {field, value} en cours de modification (regles par attribut), null = ajout/duplication

  // Correctif B3 (audit UX console, 17 aout 2026) : meme cause que
  // Search Overrides -- "Priorites par produit" n'etait jamais rafraichie
  // pendant qu'un brouillon etait en cours (brAction, brDeplacer,
  // browse-override-form), seulement au chargement initial et apres
  // publication reussie. Fonction de rendu PURE extraite (aucun appel
  // reseau), reutilisee par refreshBrowseOverrides (donnees serveur) et
  // tous les points de mutation du brouillon (donnees de session.brDraft).
  function brRenderReglesTable(liste, enBrouillon) {
    renderTable("browse-overrides-table", "browse-overrides-empty", liste, function (o) {
      // Correctif (21 aout 2026) : le nom du produit, expose par le
      // moteur depuis ce soir, remplace l'identifiant technique. Une
      // regle disait `demo-gen-000016` la ou la grille juste a gauche
      // montre un nom -- il fallait recroiser a l'oeil.
      //
      // Nom ABSENT : le produit n'est plus indexe, la regle ne
      // s'appliquera jamais. Signale plutot que masque -- on en a trouve
      // une en production, creee avec un nom saisi dans le champ
      // identifiant.
      return "<td>" + produitCell(o.product_id, o.product_name) +
        (o.product_name ? "" : " <span class='br-regle-orpheline' title='" + escAttr(T("Ce produit n'est plus dans le catalogue : la règle ne s'applique pas.")) + "'>&#9888;</span>") +
        "</td><td>" + T(o.action === "pin" ? "Épingler" : "Reléguer") +
        "</td><td>" + (o.position || "–") + "</td><td style='white-space:nowrap;'>" +
        "<button type='button' class='catalog-rule-remove' data-edit-override='1' data-product-id='" + esc(o.product_id) + "' data-product-name='" + escAttr(o.product_name || "") + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' aria-label='" + T("Modifier") + "' title='" + T("Modifier") + "' style='margin-right:6px;'>&#9998;</button>" +
        "<button type='button' class='catalog-rule-remove' data-duplicate-override='1' data-product-id='" + esc(o.product_id) + "' data-product-name='" + escAttr(o.product_name || "") + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' aria-label='" + T("Dupliquer") + "' title='" + T("Dupliquer") + "' style='margin-right:6px;'>&#10697;</button>" +
        "<button type='button' class='catalog-rule-remove' data-remove-override='" + esc(o.product_id) + "' aria-label='" + T("Retirer") + "'>&times;</button></td>";
    });
    var panneau = document.getElementById("bo-rules-panel");
    if (panneau) panneau.classList.toggle("so-rules-draft", !!enBrouillon);
    brMajCompteRegles();
  }

  function refreshBrowseOverrides(key) {
    var url = "/v1/browse/" + encodeURIComponent(session.browseCurrentCatalog) + "/" + encodeURIComponent(session.browseCurrentCategory) + "/overrides";
    apiFetch(url, key).then(function (data) {
      brRenderReglesTable(data.overrides, false);
    }).catch(function () {});
  }

  function refreshBrowseAttributeRules(key) {
    var url = "/v1/browse/" + encodeURIComponent(session.browseCurrentCatalog) + "/" + encodeURIComponent(session.browseCurrentCategory) + "/attribute-rules";
    apiFetch(url, key).then(function (data) {
      renderTable("browse-attribute-rules-table", "browse-attribute-rules-empty", data.rules, function (r) {
        return "<td class='mono'>" + esc(r.field) + "</td><td class='mono'>" + esc(r.value) + "</td><td>" +
          // Brief §4.2 : l'intensite n'est affichee que sur un boost --
          // stockee mais jamais lue sur une relegation, l'afficher
          // laisserait croire a un effet inexistant.
          T(r.action === "boost" ? "Booster" : "Reléguer") +
          (r.action === "boost" && r.intensite && r.intensite !== "moyen"
            ? " <span class='so-regle-indicateur'>" + esc(T(r.intensite)) + "</span>" : "") +
          "</td><td style='white-space:nowrap;'>" +
          "<button type='button' class='catalog-rule-remove' data-edit-attribute='1' data-field='" + esc(r.field) + "' data-value='" + esc(r.value) + "' data-action='" + esc(r.action) + "' data-intensite='" + esc(r.intensite || "moyen") + "' aria-label='" + T("Modifier") + "' title='" + T("Modifier") + "' style='margin-right:6px;'>&#9998;</button>" +
          "<button type='button' class='catalog-rule-remove' data-duplicate-attribute='1' data-field='" + esc(r.field) + "' data-value='" + esc(r.value) + "' data-action='" + esc(r.action) + "' data-intensite='" + esc(r.intensite || "moyen") + "' aria-label='" + T("Dupliquer") + "' title='" + T("Dupliquer") + "' style='margin-right:6px;'>&#10697;</button>" +
          "<button type='button' class='catalog-rule-remove' " +
          "data-remove-attribute-field='" + esc(r.field) + "' data-remove-attribute-value='" + esc(r.value) + "' aria-label='" + T("Retirer") + "'>&times;</button></td>";
      });
      // Le compteur couvre les deux volets : il se recalcule apres
      // CHAQUE rendu, sinon il decrirait un etat partiel.
      brMajCompteRegles();
    }).catch(function () {});
  }

  function resetBrowseOverrideForm() {
    boEditingProductId = null;
    document.getElementById("browse-override-product-id").value = "";
    // Le champ VISIBLE aussi : sans cela le nom du produit restait
    // affiche apres annulation, alors que l'identifiant sous-jacent
    // etait vide -- le formulaire paraissait rempli sans l'etre.
    var champVisibleReset = document.getElementById("bo-product-search");
    if (champVisibleReset) champVisibleReset.value = "";
    document.getElementById("browse-override-action").value = "pin";
    document.getElementById("browse-override-position").value = "";
    document.getElementById("bo-form-title").textContent = T("Ajouter une règle");
    document.getElementById("bo-submit-btn").textContent = T("Ajouter la règle");
    document.getElementById("bo-cancel-edit-btn").hidden = true;
  }

  function resetAttributeRuleForm() {
    barEditingKey = null;
    document.getElementById("browse-attribute-field").value = "";
    document.getElementById("browse-attribute-field-search").value = "";
    document.getElementById("browse-attribute-intensite").value = "moyen";
    majVisibiliteIntensite();
    document.getElementById("browse-attribute-value").value = "";
    document.getElementById("browse-attribute-action").value = "boost";
    document.getElementById("bar-form-title").textContent = T("Ajouter une règle");
    document.getElementById("bar-submit-btn").textContent = T("Ajouter la règle");
    document.getElementById("bar-cancel-edit-btn").hidden = true;
  }

  function wireBrowseForms(key) {
    if (browseFormsWired) return;
    browseFormsWired = true;

    // Correctif (19 aout 2026, retour Alexis) : l'ancien ecouteur
    // "change" sur le <select> n'a plus lieu d'etre (champ cache
    // desormais, jamais d'interaction directe) -- onBrowseCategoryChange
    // est appele directement depuis la selection dans le panneau.
    wireBrowseCategorieAutocomplete(key);
    wireBrowseEditeur(key);

    // Correctif (19 aout 2026, brief §4.2 "Etat vide avec issue"). Le
    // vrai selecteur de catalogue vit en haut de page (global-catalog,
    // verifie avant de construire) -- scrollIntoView + focus, pas
    // seulement focus, pour le cas ou l'utilisateur a deja scrolle vers
    // le bas de la page Browse.
    var boutonAutreCatalogue = document.getElementById("browse-choisir-autre-catalogue-btn");
    if (boutonAutreCatalogue) boutonAutreCatalogue.addEventListener("click", function () {
      var selecteur = document.getElementById("global-catalog");
      if (selecteur) {
        selecteur.scrollIntoView({ behavior: "smooth", block: "center" });
        selecteur.focus();
      }
    });
    var browseLim = document.getElementById("browse-preview-limit");
    if (browseLim) browseLim.addEventListener("change", function () { refreshBrowsePreview(key); });
    var brVisuels = document.getElementById("br-visuels");
    if (brVisuels) brVisuels.addEventListener("change", function () { refreshBrowsePreview(key); });
    var brStock = document.getElementById("browse-in-stock");
    if (brStock) brStock.addEventListener("change", function () {
      if (session.brDraft) brSimuler(key); else refreshBrowsePreview(key);
    });
    document.getElementById("browse-sort-select").addEventListener("change", function () { refreshBrowsePreview(key); });
    wireBrowseAttributeFieldAutocomplete();
    document.getElementById("browse-attribute-action").addEventListener("change", majVisibiliteIntensite);
    majVisibiliteIntensite();
    document.getElementById("bo-cancel-edit-btn").addEventListener("click", resetBrowseOverrideForm);
    document.getElementById("bar-cancel-edit-btn").addEventListener("click", resetAttributeRuleForm);

    document.getElementById("browse-override-form").addEventListener("submit", function (e) {
      e.preventDefault();
      // Correctif C9 (audit UX console, 17 aout 2026, meme cause que
      // so-form) : ce formulaire faisait un POST direct, totalement
      // ignore de session.brDraft -- silencieusement supprime au
      // prochain "Publier sur {catalogue}" si un brouillon etait deja
      // actif. Ajoute desormais au brouillon, meme mecanisme que brAction
      // (grille) : brAvecBrouillon amorce session.brDraft si besoin, puis
      // la regle y est fusionnee -- plus jamais de second chemin
      // d'ecriture parallele.
      var status = document.getElementById("browse-override-status");
      var productId = document.getElementById("browse-override-product-id").value.trim();
      var action = document.getElementById("browse-override-action").value;
      var positionInput = document.getElementById("browse-override-position").value;
      if (!productId) return;

      var submitBtn = document.getElementById("bo-submit-btn");
      submitBtn.disabled = true;
      status.textContent = T("Ajout au brouillon…"); status.className = "catalog-rule-status";

      brAvecBrouillon(key, function () {
        // Meme cle de fusion que le nettoyage manuel (identifiant produit
        // change en cours de modification) que l'ancien POST direct gerait.
        var ancienId = boEditingProductId && boEditingProductId !== productId ? boEditingProductId : null;
        session.brDraft = session.brDraft.filter(function (r) {
          if (ancienId && r.product_id === ancienId) return false;
          return r.product_id !== productId;
        });
        var regle = { product_id: productId, action: action };
        if (positionInput) regle.position = parseInt(positionInput, 10);
        session.brDraft.push(regle);
        brSimuler(key);
        status.textContent = T("Ajoutée au brouillon — publiez pour l'appliquer.");
        status.className = "catalog-rule-status ok";
        resetBrowseOverrideForm();
        submitBtn.disabled = false;
        // Pas de second callback d'erreur ici : brAvecBrouillon() a son
        // propre .catch() interne qui appelle toujours suite() (avec un
        // brouillon vide en cas d'echec reseau) -- jamais de vraie
        // propagation d'erreur possible, contrairement a
        // soConstruireBrouillon(). Un onErr ici ne serait donc jamais
        // reellement appele -- retire plutot que de garder du code
        // trompeur qui laisserait croire a une gestion d'erreur reelle.
      });
    });

    document.getElementById("browse-overrides-table").querySelector("tbody").addEventListener("click", function (e) {
      var editBtn = e.target.closest("[data-edit-override]");
      var dupBtn = e.target.closest("[data-duplicate-override]");
      var delBtn = e.target.closest("[data-remove-override]");

      if (editBtn || dupBtn) {
        var src = editBtn || dupBtn;
        boEditingProductId = editBtn ? src.getAttribute("data-product-id") : null;
        document.getElementById("browse-override-product-id").value = src.getAttribute("data-product-id");
        var champVisible = document.getElementById("bo-product-search");
        if (champVisible) {
          // Repli sur l'identifiant : une regle orpheline n'a pas de nom.
          champVisible.value = src.getAttribute("data-product-name") || src.getAttribute("data-product-id");
        }
        document.getElementById("browse-override-action").value = src.getAttribute("data-action");
        document.getElementById("browse-override-position").value = src.getAttribute("data-position") || "";
        document.getElementById("bo-form-title").textContent = editBtn ? T("Modifier la règle") : T("Dupliquer — modifiez au moins un champ");
        document.getElementById("bo-submit-btn").textContent = editBtn ? T("Enregistrer les modifications") : T("Créer cette règle");
        document.getElementById("bo-cancel-edit-btn").hidden = false;
        document.getElementById("bo-product-search").scrollIntoView({ behavior: "smooth", block: "center" });
        if (dupBtn) { document.getElementById("bo-product-search").focus(); document.getElementById("browse-override-product-id").select(); }
        return;
      }
      if (delBtn) {
        var pid = delBtn.getAttribute("data-remove-override");
        var url = "/v1/browse/" + encodeURIComponent(session.browseCurrentCatalog) + "/" + encodeURIComponent(session.browseCurrentCategory) + "/overrides/" + encodeURIComponent(pid);
        apiFetch(url, key, { method: "DELETE" }).then(function () { refreshBrowseOverrides(key); refreshBrowsePreview(key); }).catch(function () {});
      }
    });

    document.getElementById("browse-attribute-rule-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var status = document.getElementById("browse-attribute-rule-status");
      var field = document.getElementById("browse-attribute-field").value.trim();
      var value = document.getElementById("browse-attribute-value").value.trim();
      var action = document.getElementById("browse-attribute-action").value;
      var intensite = document.getElementById("browse-attribute-intensite").value;
      if (!field || !value) return;
      var base = "/v1/browse/" + encodeURIComponent(session.browseCurrentCatalog) + "/" + encodeURIComponent(session.browseCurrentCategory) + "/attribute-rules";

      var needsCleanup = barEditingKey && (barEditingKey.field !== field || barEditingKey.value !== value);
      var chain = needsCleanup
        ? apiFetch(base + "?field=" + encodeURIComponent(barEditingKey.field) + "&value=" + encodeURIComponent(barEditingKey.value), key, { method: "DELETE" })
            .then(function () { return apiFetch(base, key, { method: "POST", body: { field: field, value: value, action: action, intensite: intensite } }); })
        : apiFetch(base, key, { method: "POST", body: { field: field, value: value, action: action, intensite: intensite } });

      chain.then(function () {
        status.textContent = T("Règle d'attribut enregistrée."); status.className = "catalog-rule-status ok";
        resetAttributeRuleForm();
        refreshBrowseAttributeRules(key); refreshBrowsePreview(key);
      }).catch(function (err) {
        status.textContent = (err && err.message) || T("Échec."); status.className = "catalog-rule-status err";
      });
    });

    document.getElementById("browse-attribute-rules-table").querySelector("tbody").addEventListener("click", function (e) {
      var editBtn = e.target.closest("[data-edit-attribute]");
      var dupBtn = e.target.closest("[data-duplicate-attribute]");
      var delBtn = e.target.closest("[data-remove-attribute-field]");

      if (editBtn || dupBtn) {
        var src = editBtn || dupBtn;
        barEditingKey = editBtn ? { field: src.getAttribute("data-field"), value: src.getAttribute("data-value") } : null;
        document.getElementById("browse-attribute-field").value = src.getAttribute("data-field");
        document.getElementById("browse-attribute-field-search").value = src.getAttribute("data-field");
        document.getElementById("browse-attribute-value").value = src.getAttribute("data-value");
        document.getElementById("browse-attribute-action").value = src.getAttribute("data-action");
        document.getElementById("browse-attribute-intensite").value = src.getAttribute("data-intensite") || "moyen";
        majVisibiliteIntensite();
        document.getElementById("bar-form-title").textContent = editBtn ? T("Modifier la règle") : T("Dupliquer — modifiez au moins un champ");
        document.getElementById("bar-submit-btn").textContent = editBtn ? T("Enregistrer les modifications") : T("Créer cette règle");
        document.getElementById("bar-cancel-edit-btn").hidden = false;
        // Correctif (19 aout 2026) : cible le champ VISIBLE -- l'ancien
        // id porte desormais un <input type=hidden>, sur lequel
        // scrollIntoView/focus/select n'ont aucun effet.
        document.getElementById("browse-attribute-field-search").scrollIntoView({ behavior: "smooth", block: "center" });
        if (dupBtn) { document.getElementById("browse-attribute-field-search").focus(); document.getElementById("browse-attribute-field-search").select(); }
        return;
      }
      if (delBtn) {
        var field = delBtn.getAttribute("data-remove-attribute-field"), value = delBtn.getAttribute("data-remove-attribute-value");
        var url = "/v1/browse/" + encodeURIComponent(session.browseCurrentCatalog) + "/" + encodeURIComponent(session.browseCurrentCategory) +
          "/attribute-rules?field=" + encodeURIComponent(field) + "&value=" + encodeURIComponent(value);
        apiFetch(url, key, { method: "DELETE" }).then(function () { refreshBrowseAttributeRules(key); refreshBrowsePreview(key); }).catch(function () {});
      }
    });
  }

  // ---------------- Carte d'activation (2 août, points 5+6) ----------------
  //
  // Quatre signaux, tous réellement calculables depuis l'API -- rien
  // d'inventé : catalogs_used, first_search_at ET désormais
  // first_browse_at (palier 4, ajouté le même jour côté moteur) viennent
  // tous de la même réponse /v1/usage déjà chargée par loadDashboard (pas
  // d'appel supplémentaire pour ce quatrième signal) -- seule la clé
  // publique nécessite un appel séparé.
  //
  // JAMAIS BLOQUANTE : aucun autre endroit de la console ne lit l'état de
  // cette carte. Réductible, choix mémorisé dans localStorage -- un
  // client déjà actif qui ferme la carte ne la revoit pas en pleine
  // largeur à chaque connexion.
  var ACTIVATION_REDUITE_KEY = "heurix_activation_reduite";

  function majCarteActivation(usage, key) {
    var carte = document.getElementById("activation-card");
    var boutonRestore = document.getElementById("activation-restore-btn");
    if (!carte) return;

    // Si les quatre étapes sont déjà faites, plus la peine d'afficher la
    // carte du tout, réduite ou pas -- elle n'apporte plus rien.
    var indexeFait = (usage.catalogs_used || 0) > 0;
    var rechercheFaite = !!usage.first_search_at;
    var browseFait = !!usage.first_browse_at;

    apiFetch("/v1/keys/public", key).then(function (data) {
      // Correctif (21 aout 2026, bug signale par Alexis : l'etape restait
      // "en attente" malgre une cle publique bien creee). L'endpoint
      // renvoie {"keys": [...]} -- verifie dans admin.py -- et le code
      // lisait data.public_keys, toujours undefined. L'etape ne pouvait
      // donc JAMAIS se valider, quel que soit le nombre de cles.
      //
      // Le tableau des cles publiques, lui, lisait deja data.keys
      // correctement : l'erreur etait isolee a cette seule ligne.
      var cleFaite = !!(data.keys && data.keys.length > 0);
      var toutFait = indexeFait && rechercheFaite && cleFaite && browseFait;

      majItemActivation("activation-item-index", indexeFait);
      majItemActivation("activation-item-search", rechercheFaite);
      majItemActivation("activation-item-pubkey", cleFaite);
      majItemActivation("activation-item-browse", browseFait);

      if (toutFait) {
        carte.hidden = true;
        boutonRestore.hidden = true;
        return;
      }
      // Le bouton porte la progression : replie, il devient la seule
      // trace de la checklist a l'ecran -- autant qu'il dise ou l'on en
      // est plutot que d'inviter a rouvrir pour le decouvrir.
      var n = [indexeFait, rechercheFaite, cleFaite, browseFait].filter(Boolean).length;
      boutonRestore.textContent = T("Voir ma progression ({0}/4)", n);
      // Correctif (21 aout 2026, audit passe 4) : a 3 etapes sur 4, la
      // carte occupait encore tout le premier ecran. Elle se replie
      // d'elle-meme des que la majorite est faite -- l'utilisateur sait
      // deja ou il en est, le bouton "Voir ma progression" reste a un
      // clic. On ne force jamais l'inverse : un choix de reduction
      // explicite est conserve tel quel.
      var faites = [indexeFait, rechercheFaite, cleFaite, browseFait].filter(Boolean).length;
      var reduite = localStorage.getItem(ACTIVATION_REDUITE_KEY) === "1" || faites >= 3;
      carte.hidden = reduite;
      boutonRestore.hidden = !reduite;
    }).catch(function () {
      // Échec de CE SEUL appel : pas de raison de priver l'utilisateur des
      // trois autres signaux, déjà connus via `usage`.
      majItemActivation("activation-item-index", indexeFait);
      majItemActivation("activation-item-search", rechercheFaite);
      majItemActivation("activation-item-browse", browseFait);
      var reduite = localStorage.getItem(ACTIVATION_REDUITE_KEY) === "1";
      carte.hidden = reduite;
      boutonRestore.hidden = !reduite;
    });
  }

  function majItemActivation(id, fait) {
    var item = document.getElementById(id);
    if (!item) return;
    item.classList.toggle("fait", fait);
    var statut = item.querySelector(".console-activation-statut");
    if (statut) statut.textContent = fait ? "fait" : "en attente";
  }

  var activationReduceBtn = document.getElementById("activation-reduce-btn");
  var activationRestoreBtn = document.getElementById("activation-restore-btn");
  if (activationReduceBtn) {
    activationReduceBtn.addEventListener("click", function () {
      document.getElementById("activation-card").hidden = true;
      activationRestoreBtn.hidden = false;
      localStorage.setItem(ACTIVATION_REDUITE_KEY, "1");
    });
  }
  if (activationRestoreBtn) {
    activationRestoreBtn.addEventListener("click", function () {
      document.getElementById("activation-card").hidden = false;
      activationRestoreBtn.hidden = true;
      localStorage.removeItem(ACTIVATION_REDUITE_KEY);
    });
  }

  // C1 (25 aout 2026). loadDashboard faisait DEUX choses de nature
  // differente : elle CHARGEAIT des donnees, ce qui doit pouvoir se
  // repeter, et elle CABLAIT des ecouteurs, ce qui ne doit se faire qu'une
  // fois. Elle avait quatre appelants, dont appliquerCatalogue -- qu'elle
  // declenchait elle-meme, via wireGlobalCatalog. Chaque rappel recablait
  // tout, et c'est de la que venaient les doubles ecouteurs releves au
  // getEventListeners du 21 et du 22 aout, les appels reseau en double du
  // 20 aout, et la garde par attribut posee sur le bouton Reglages.
  //
  // Les deux moities portent desormais le nom de ce qu'elles font.

  // Appelee UNE SEULE FOIS par session. Aucun appel reseau ici : que des
  // ecouteurs. C'est ce qui rend toute garde ad hoc inutile -- il n'y a
  // plus de second passage a empecher.
  function cablerConsole(key) {
    cablerSelecteurCatalogue(key);
    wireBilling(key);
    brCablerOngletsRegles();
    brCablerReglages();
    wireSuggestionsSynonymes(key);
    wireBrowseForms(key);
    wireSearchOverridesPane(key);
    wirePublicKeys(key);
    cablerVuesCategories(key);
    wireRelatedProducts(key);
    wireTutoEditeur(["so-tuto", "br-tuto"]);
    // Meme autocomplete que la page soeur, sur les champs de la
    // categorie : le formulaire attendait un identifiant tape a la
    // main, sans aucune aide.
    wireSoProductAutocomplete(key, {
      champ: "bo-product-search",
      cache: "browse-override-product-id",
      panneau: "bo-product-panel",
    });
  }

  // Rejouable autant qu'on veut : changement de periode, changement de
  // catalogue, reconnexion. Ne pose aucun ecouteur.
  function chargerDonnees(key, days) {
    dashLoading.hidden = false;
    dashContent.hidden = true;
    // L'ORDRE EST LE CHANTIER. Le catalogue actif est resolu AVANT que les
    // URL d'analytics ne soient composees : elles partent filtrees du
    // premier coup, il n'y a plus de second chargement a declencher, donc
    // plus de cycle a garder.
    // Le catalogue n'a besoin d'etre RESOLU qu'au premier chargement. Ensuite
    // il est connu -- soit memorise, soit choisi par l'utilisateur -- et le
    // resoudre a nouveau relancerait /v1/index/catalogs pour rien. C'est la
    // moitie des appels en double que ce chantier doit supprimer.
    var pret = session.catalogueActif
      ? Promise.resolve(null)
      : resoudreCatalogueActif(key).then(function (catalogues) {
          appliquerEtatCatalogue(key);
          return catalogues;
        });
    return pret
      .then(function (catalogues) { return chargerTableauDeBord(key, days, catalogues); })
      .catch(function () {
        dashLoading.hidden = true;
        localStorage.removeItem(SESSION_STORAGE_KEY);
        session.activeKey = null;
        setAuthMode("login");
        showLogin(L.loginErrorNetwork);
      });
  }

  function chargerTableauDeBord(key, days, catalogues) {
    // `catalogues` vient de resoudreCatalogueActif : plus d'appel a
    // /v1/index/catalogs ici. Si la resolution a echoue, on affiche le
    // contenu normal plutot que de laisser l'ecran vide sur une erreur
    // secondaire -- meme repli qu'avant, sans le second appel.
    var aDesCatalogues = !catalogues || (catalogues.catalogs && catalogues.catalogs.length > 0);
    document.getElementById("overview-empty-state").hidden = aDesCatalogues;
    document.getElementById("overview-stats-content").hidden = !aDesCatalogues;

    // Correctif B5 (audit UX console, 17 aout 2026) : le catalogue actif
    // n'etait jamais transmis a ces trois endpoints -- toutes les
    // recherches/erreurs d'un compte se melangeaient entre catalogues,
    // quel que soit le catalogue selectionne ici. session.catalogueActif
    // sert deja pour d'autres appels (synonymes) plus bas dans ce fichier.
    // Correctif (21 aout 2026) : le filtre devient conditionnel. Chaine
    // vide sur "Tous les catalogues" -- le backend agrege alors, ce qui
    // est son comportement par defaut depuis toujours.
    //
    // summary rejoint les trois autres : il n'etait PAS filtre jusqu'ici,
    // si bien que le taux sans resultat portait sur tous les catalogues
    // pendant que les listes en dessous portaient sur un seul. Mesure en
    // production : 5,2% affiche pour public-demo, qui n'a en realite
    // aucun echec.
    var catalogQS = catalogueQS();
    // `return` : l'echec remonte a chargerDonnees, qui porte desormais la
    // seule politique d'erreur (deconnexion). Deux .catch pour le meme cas
    // auraient diverge tot ou tard.
    return Promise.all([
      apiFetch("/v1/analytics/summary?days=" + days + catalogQS, key),
      apiFetch("/v1/analytics/top-queries?days=" + days + "&limit=15" + catalogQS, key),
      apiFetch("/v1/analytics/zero-results?days=" + days + "&limit=15" + catalogQS, key),
      apiFetch("/v1/analytics/errors?days=" + days + "&limit=10" + catalogQS, key),
      apiFetch("/v1/usage", key),
    ]).then(function (results) {
      var summary = results[0], topQueries = results[1].queries, zeroResults = results[2].queries,
          errors = results[3].errors, usage = results[4];

      renderStats(summary, usage);
      renderChart(summary.daily_searches);

      majCompteurOnglet("obs-tab-populaires-count", (topQueries || []).length);
      majCompteurOnglet("obs-tab-sans-resultat-count", (zeroResults || []).length);
      renderTable("top-queries-table", "top-queries-empty", topQueries, function (q) {
        // Brief §4.5 : "idem depuis Recherches populaires". Colonne
        // d'action ajoutee au tableau (il n'en avait aucune).
        return "<td>" + esc(q.query) + "</td><td class='num'>" + q.count + "</td><td>" + q.avg_results + "</td>" +
               "<td><button type='button' class='zr-vers-regle' data-goto-pane='pane-search-overrides' " +
               "data-prefill-query='" + esc(q.query) + "'>" + T("Mettre en avant") + "</button></td>";
      });
      renderTable("zero-results-table", "zero-results-empty", zeroResults, function (q) {
        return "<td>" + esc(q.query) + "</td><td class='num'>" + q.count +
               "</td><td class='zr-action-cell'>" +
               "<button type='button' class='zr-suggerer' data-terme='" +
               esc(q.query) + "'>" + T("Corriger") + "</button>" +
               // Brief §4.5 : le passage de l'observation a l'action.
               // Complementaire de "Corriger", qui propose un synonyme :
               // ici on va poser une regle de mise en avant sur cette
               // requete precise, sans avoir a la retaper.
               "<button type='button' class='zr-vers-regle' data-goto-pane='pane-search-overrides' " +
               "data-prefill-query='" + esc(q.query) + "'>" + T("Mettre en avant") + "</button>" +
               "<span class='zr-suggestions' hidden></span></td>";
      });
      _dernieresErreurs = errors || [];
      majSignalementErreurs(errors);
      majKpiErreurs(errors);
      renderTable("errors-table", "errors-empty", errors, function (e) {
        var t = traduireErreur(e);
        var html = "<td class='err-cell'>" +
          "<span class='err-phrase'>" + esc(t.texte) + "</span>";
        if (t.aide) html += "<span class='err-aide'>" + esc(t.aide) + "</span>";
        if (t.action) {
          html += "<button type='button' class='err-action' data-goto-pane='" +
            t.action.pane + "'>" + esc(t.action.libelle) + "</button>";
        }
        // Le detail technique est REPLIE, pas supprime : un developpeur en a
        // besoin, un responsable e-commerce non.
        html += "<details class='err-detail'><summary>" + T("Détail technique") + "</summary>" +
          "<span class='mono'>" + esc(e.endpoint) + " — HTTP " + e.status_code + "</span>" +
          (t.brut ? "" : "<span class='mono'>" + esc(e.message || "") + "</span>") +
          "</details>";
        html += "</td><td class='err-quand'>" + L.when(e.at) + "</td>";
        return html;
      });

      dashLoading.hidden = true;
      dashContent.hidden = false;
      renderApiKey(key);
      loadCatalogs(key);
      loadAccountInfo();
      majCarteActivation(usage, key);
      loadConversionData(key);
      loadBrowseCatalogs(key);
      loadSearchOverridesCatalogs(key);
      if (catalogues) chargerVuesCategories(key, catalogues);
      session.cleCourante = key;
      // EXPOSITION POUR LES MODULES. L'import CSV est un module ES,
      // chargé séparément : il n'a pas accès aux variables de cette
      // fonction anonyme. Sans cela, il utilisait le jeton de SESSION,
      // qui n'autorise pas l'indexation — « Invalid API key ».
      window.HEURIX_CLE_API = key;
      // Permet aux modules ES — l'import CSV — de rafraichir la liste des
      // catalogues apres avoir cree le leur, sans recharger la page.
      window.HEURIX_RECHARGER_CATALOGUES = function () { loadCatalogs(key); };
      // HISTOIRE, conservee au passe (C1, 25 aout 2026). Il y avait ici un
      // drapeau `session.cablageFait` qui n'autorisait le cablage qu'au
      // premier passage. Il repondait a un vrai symptome -- DEUX ecouteurs
      // de clic sur le bouton Reglages, releves au getEventListeners du
      // 22 aout, le premier ouvrant le panneau et le second le refermant
      // aussitot -- et au meme phenomene cote reseau le 20 aout : synonyms,
      // custom-rules, usage et catalogs partant en double au changement de
      // catalogue.
      //
      // Trois symptomes, une seule cause : cette fonction cablait a chaque
      // chargement. Le drapeau la traitait par ses effets. Le cablage vit
      // maintenant dans cablerConsole, appelee une fois : il n'y a plus de
      // second passage a interdire.
    });
  }

  var AVAILABLE_RULEPACKS = [];

  function synGroupChipsHtml(groups) {
    return groups.map(function (g, i) {
      // Correctif (21 aout 2026) : tolere les deux formes. L'API renvoie
      // aujourd'hui des listes -- dump() garde son contrat public pour ne
      // pas casser cet affichage -- mais le stockage porte desormais le
      // sens. Le jour ou la reponse l'expose, l'affichage suivra sans
      // nouveau correctif.
      //
      // Sens ecrit en MOTS plutot qu'en fleche : un signe demande d'etre
      // decode, et il faut distinguer deux regles d'apparence identique
      // au comportement different -- les anciennes sont bidirectionnelles,
      // les nouvelles unidirectionnelles par defaut.
      var termes = Array.isArray(g) ? g : (g.termes || []);
      var bidir = Array.isArray(g) ? null : !!g.bidirectionnel;
      var libelle = termes.length > 1 && bidir !== null
        ? esc(termes[0]) + " <em>" + (bidir ? T("équivaut à") : T("trouve")) + "</em> " + esc(termes.slice(1).join(", "))
        : esc(termes.join(", "));
      return '<span class="catalog-synonym-group" data-idx="' + i + '">' + libelle +
        '<button type="button" class="catalog-synonym-remove" data-idx="' + i + '" aria-label="Retirer ce groupe">&times;</button></span>';
    }).join("");
  }

  function updateCardMeta(cardEl, catalog) {
    var meta = cardEl.querySelector(".catalog-card-meta");
    // Cet element n'existe que dans une carte catalogue. Depuis que les
    // synonymes vivent aussi sous Personnalisation, la fonction est appelee
    // avec un conteneur qui n'en a pas : sans cette garde, l'exception
    // interrompait saveGroups AVANT render(), et l'ajout n'apparaissait
    // qu'apres rechargement de la page alors qu'il etait bien enregistre.
    if (!meta) return;
    meta.textContent = catalog.products + " produit" + (catalog.products > 1 ? "s" : "") + " · " +
      catalog.annotations + " annotations · " + catalog.synonym_groups + " groupe" + (catalog.synonym_groups > 1 ? "s" : "") + " de synonymes";
  }

  // Alimente l'etat vide des synonymes depuis les recherches sans
  // resultat (21 aout 2026). Endpoint deja existant et deja utilise par
  // l'ecran d'amorce -- rien a ajouter cote moteur.
  //
  // Cliquer un candidat le pose dans le champ de saisie plutot que de
  // creer le groupe directement : un synonyme se definit par PLUSIEURS
  // mots, le marchand doit encore dire a quoi celui-ci correspond.
  function chargerCandidatsSynonymes(catalogName, key, input) {
    var hote = document.getElementById("syn-vide-candidats");
    if (!hote) return;
    apiFetch("/v1/analytics/zero-results?catalog=" + encodeURIComponent(catalogName) + "&limit=6", key)
      .then(function (data) {
        var requetes = (data.queries || []).slice(0, 6);
        if (!requetes.length) return;
        hote.innerHTML = "<p class='syn-vide-label'>" + T("Recherches sans résultat à corriger") + "</p>" +
          requetes.map(function (r) {
            return "<button type='button' class='so-amorce-chip syn-candidat' data-syn-candidat='" +
              escAttr(r.query) + "'>" + esc(r.query) + "</button>";
          }).join("");
        hote.querySelectorAll("[data-syn-candidat]").forEach(function (b) {
          b.addEventListener("click", function () {
            if (!input) return;
            input.value = b.getAttribute("data-syn-candidat") + ", ";
            input.focus();
          });
        });
      })
      .catch(function () { /* suggestion facultative : jamais bloquante */ });
  }

  function wireSynonymControls(cardEl, catalog, key) {
    var catalogName = catalog.catalog;
    var groupsEl = cardEl.querySelector(".catalog-synonym-groups");
    var input = cardEl.querySelector(".catalog-synonym-input");
    var addBtn = cardEl.querySelector(".catalog-synonym-add-btn");
    var caseBidir = cardEl.querySelector(".syn-bidirectionnel");
    var apercu = cardEl.querySelector("#syn-apercu");

    // L'apercu se reecrit a chaque frappe : le marchand voit l'effet de
    // sa regle avant de valider.
    function majApercu() {
      if (!apercu) return;
      var mots = input.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
      if (mots.length < 2) { apercu.textContent = ""; return; }
      var source = mots[0], cibles = mots.slice(1).join(", ");
      apercu.textContent = (caseBidir && caseBidir.checked)
        ? T("« {0} » et « {1} » se trouveront mutuellement.", source, cibles)
        : T("Chercher « {0} » trouvera aussi « {1} ».", source, cibles);
    }
    if (input) input.addEventListener("input", majApercu);
    if (caseBidir) caseBidir.addEventListener("change", majApercu);
    var currentGroups = [];

    function render() {
      // Correctif (21 aout 2026, audit passe 4). L'onglet etait vide avec
      // un simple champ de saisie : rien n'indiquait par ou commencer.
      // Les recherches SANS RESULTAT sont les meilleurs candidats -- ce
      // sont exactement les mots que le moteur ne comprend pas. On relie
      // ainsi deux ecrans qui s'ignoraient.
      if (!currentGroups.length) {
        groupsEl.innerHTML = "<div class='syn-vide' id='syn-vide'>" +
          "<p class='syn-vide-titre'>" + T("Aucun synonyme pour l'instant") + "</p>" +
          "<p class='syn-vide-texte'>" + T("Un synonyme relie des mots que vos visiteurs emploient pour désigner le même produit. Les recherches sans résultat sont vos meilleurs candidats : ce sont les mots que le moteur ne reconnaît pas encore.") + "</p>" +
          "<div class='syn-vide-candidats' id='syn-vide-candidats'></div>" +
        "</div>";
        chargerCandidatsSynonymes(catalogName, key, input);
        return;
      }
      groupsEl.innerHTML = synGroupChipsHtml(currentGroups);
      wireRemoveButtons();
    }

    function saveGroups(next) {
      return apiFetch("/v1/index/" + encodeURIComponent(catalogName) + "/synonyms", key, {
        method: "PUT", body: { groups: next },
      }).then(function (data) {
        currentGroups = data.groups;
        catalog.synonym_groups = data.groups.length;
        updateCardMeta(cardEl, catalog);
        render();
      });
    }

    function wireRemoveButtons() {
      cardEl.querySelectorAll(".catalog-synonym-remove").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.getAttribute("data-idx"), 10);
          var groupe = (currentGroups[idx] || []).join(", ");
          confirmerSuppression(
            "Supprimer le groupe de synonymes <strong>« " + esc(groupe) + " »</strong> ?",
            btn,
            function () {
              saveGroups(currentGroups.filter(function (_, i) { return i !== idx; })).catch(function () {});
            }
          );
        });
      });
    }

    var synStatus = cardEl.querySelector(".catalog-synonym-status");

    addBtn.addEventListener("click", function () {
      var terms = input.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
      // Un groupe rapproche des mots ENTRE EUX : il en faut au moins deux.
      // L'ancienne version se contentait de refocaliser le champ, sans un
      // mot -- l'utilisateur cliquait et « rien ne se passait ».
      if (terms.length < 2) {
        if (synStatus) {
          synStatus.className = "catalog-rule-status err";
          synStatus.textContent = terms.length === 1
            ? T("Un synonyme relie des mots entre eux : ajoutez-en au moins un second, séparé par une virgule (ex. vis, boulon).")
            : T("Saisissez au moins deux mots séparés par une virgule.");
        }
        input.focus();
        return;
      }
      if (synStatus) { synStatus.className = "catalog-rule-status"; synStatus.textContent = ""; }
      addBtn.disabled = true;
      // Le moteur accepte les deux formes ; on envoie toujours l'objet
      // portant le sens, meme bidirectionnel -- une liste nue laisserait
      // le serveur deviner, et son defaut de compatibilite (bidirection-
      // nel) masquerait un choix explicite de sens unique.
      var regle = { termes: terms, bidirectionnel: !!(caseBidir && caseBidir.checked) };
      saveGroups(currentGroups.concat([regle]))
        .then(function () {
          input.value = "";
          if (synStatus) {
            synStatus.className = "catalog-rule-status ok";
            synStatus.textContent = T("Groupe ajouté.");
          }
        })
        .catch(function () {})
        .then(function () { addBtn.disabled = false; });

    });

    apiFetch("/v1/index/" + encodeURIComponent(catalogName) + "/synonyms", key)
      .then(function (data) { currentGroups = data.groups; render(); })
      .catch(function () { groupsEl.innerHTML = ""; });
  }

  function ruleDescription(rule) {
    if (rule.rule_type === "keyword") {
      return T("Si le texte contient {0} → {1}", rule.keywords.map(function (k) { return "« " + esc(k) + " »"; }).join(", "), esc(rule.tag));
    }
    return T("Si « {0} » est suivi d'un nombre (ex. {0}8) → {1}", esc(rule.prefix), esc(rule.tag)) + "<em>" + T("nombre") + "</em>";
  }

  function customRulesListHtml(rules) {
    if (!rules.length) return '<p class="catalog-rules-empty">' + T("Aucune reconnaissance personnalisée pour l'instant.") + '</p>';
    return rules.map(function (r) {
      var kw = (r.keywords || []).join(", ");
      return '<div class="catalog-rule-row" data-id="' + r.id + '">' +
        '<div><strong>' + esc(r.label) + '</strong><span class="catalog-rule-desc">' + ruleDescription(r) + '</span></div>' +
        '<div style="white-space:nowrap;">' +
        '<button type="button" class="catalog-rule-remove" data-edit-rule="1" data-id="' + r.id + '" data-rule-type="' + esc(r.rule_type) + '" data-label="' + esc(r.label) + '" data-keywords="' + esc(kw) + '" data-prefix="' + esc(r.prefix || "") + '" aria-label="' + T("Modifier") + '" title="' + T("Modifier") + '" style="margin-right:6px;">&#9998;</button>' +
        '<button type="button" class="catalog-rule-remove" data-duplicate-rule="1" data-rule-type="' + esc(r.rule_type) + '" data-label="' + esc(r.label) + '" data-keywords="' + esc(kw) + '" data-prefix="' + esc(r.prefix || "") + '" aria-label="' + T("Dupliquer") + '" title="' + T("Dupliquer") + '" style="margin-right:6px;">&#10697;</button>' +
        '<button type="button" class="catalog-rule-remove" data-id="' + r.id + '" aria-label="' + T("Retirer cette reconnaissance") + '">&times;</button>' +
        '</div>' +
      '</div>';
    }).join("");
  }

  function wireCustomRuleControls(cardEl, catalog, key) {
    var catalogName = catalog.catalog;
    var listEl = cardEl.querySelector(".catalog-rules-list");
    var typeSelect = cardEl.querySelector(".catalog-rule-type");
    var labelInput = cardEl.querySelector(".catalog-rule-label");
    var keywordsInput = cardEl.querySelector(".catalog-rule-keywords");
    var prefixInput = cardEl.querySelector(".catalog-rule-prefix");
    var addBtn = cardEl.querySelector(".catalog-rule-add-btn");
    var cancelBtn = cardEl.querySelector(".catalog-rule-cancel-edit-btn");
    var formTitle = cardEl.querySelector(".catalog-rule-form-title");
    var status = cardEl.querySelector(".catalog-rule-status");
    var editingRuleId = null; // id en cours de modification, null = ajout ou duplication

    function resetForm() {
      editingRuleId = null;
      typeSelect.value = "keyword";
      keywordsInput.hidden = false; prefixInput.hidden = true;
      labelInput.value = ""; keywordsInput.value = ""; prefixInput.value = "";
      formTitle.textContent = T("Ajouter une reconnaissance");
      addBtn.textContent = T("Créer la reconnaissance");
      cancelBtn.hidden = true;
      status.textContent = "";
    }

    function fillForm(d) {
      typeSelect.value = d.ruleType;
      keywordsInput.hidden = d.ruleType !== "keyword";
      prefixInput.hidden = d.ruleType === "keyword";
      labelInput.value = d.label;
      keywordsInput.value = d.keywords || "";
      prefixInput.value = d.prefix || "";
    }

    function loadRules() {
      apiFetch("/v1/index/" + encodeURIComponent(catalogName) + "/custom-rules", key)
        .then(function (data) {
          listEl.innerHTML = customRulesListHtml(data.rules);

          listEl.querySelectorAll("[data-edit-rule], [data-duplicate-rule]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var isEdit = btn.hasAttribute("data-edit-rule");
              editingRuleId = isEdit ? btn.getAttribute("data-id") : null;
              fillForm({
                ruleType: btn.getAttribute("data-rule-type"), label: btn.getAttribute("data-label"),
                keywords: btn.getAttribute("data-keywords"), prefix: btn.getAttribute("data-prefix"),
              });
              formTitle.textContent = isEdit ? T("Modifier la reconnaissance") : T("Dupliquer — modifiez au moins un champ");
              addBtn.textContent = isEdit ? T("Enregistrer les modifications") : T("Créer cette reconnaissance");
              cancelBtn.hidden = false;
              labelInput.scrollIntoView({ behavior: "smooth", block: "center" });
              if (!isEdit) { labelInput.focus(); labelInput.select(); }
            });
          });

          listEl.querySelectorAll(".catalog-rule-remove[data-id]:not([data-edit-rule])").forEach(function (btn) {
            btn.addEventListener("click", function () {
              btn.disabled = true;
              apiFetch("/v1/index/" + encodeURIComponent(catalogName) + "/custom-rules/" + btn.getAttribute("data-id"), key, { method: "DELETE" })
                .then(function () {
                  loadRules();
                  return apiFetch("/v1/index/" + encodeURIComponent(catalogName) + "/stats", key);
                })
                .then(function (stats) { catalog.annotations = stats.annotations; updateCardMeta(cardEl, catalog); })
                .catch(function () { btn.disabled = false; });
            });
          });
        })
        .catch(function () { listEl.innerHTML = ""; });
    }

    typeSelect.addEventListener("change", function () {
      var isKeyword = typeSelect.value === "keyword";
      keywordsInput.hidden = !isKeyword;
      prefixInput.hidden = isKeyword;
    });

    cancelBtn.addEventListener("click", resetForm);

    addBtn.addEventListener("click", function () {
      var body = { rule_type: typeSelect.value, label: labelInput.value.trim() };
      if (typeSelect.value === "keyword") {
        body.keywords = keywordsInput.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
      } else {
        body.prefix = prefixInput.value.trim();
      }
      if (!body.label) { labelInput.focus(); return; }
      addBtn.disabled = true; status.textContent = T("Enregistrement…"); status.className = "catalog-rule-status";

      // Pas d'endpoint de mise a jour cote moteur (GET/POST/DELETE
      // uniquement) -- une modification retire l'ancienne regle avant de
      // creer la nouvelle. Une duplication (editingRuleId=null) ne
      // touche jamais a la regle d'origine.
      var createNew = function () {
        return apiFetch("/v1/index/" + encodeURIComponent(catalogName) + "/custom-rules", key, { method: "POST", body: body });
      };
      var chain = editingRuleId
        ? apiFetch("/v1/index/" + encodeURIComponent(catalogName) + "/custom-rules/" + editingRuleId, key, { method: "DELETE" }).then(createNew)
        : createNew();

      chain.then(function () {
        status.textContent = T("Reconnaissance personnalisée enregistrée."); status.className = "catalog-rule-status ok";
        resetForm();
        loadRules();
        return apiFetch("/v1/index/" + encodeURIComponent(catalogName) + "/stats", key);
      }).then(function (stats) { catalog.annotations = stats.annotations; updateCardMeta(cardEl, catalog); })
        .catch(function (err) {
          status.textContent = (err && err.message) || T("Échec de l'enregistrement.");
          status.className = "catalog-rule-status err";
        })
        .then(function () { addBtn.disabled = false; });
    });

    loadRules();
  }

  // Recommandation de pack d'apres le contenu du catalogue.
  //
  // Rien n'aidait l'utilisateur a choisir : un catalogue de vetements pouvait
  // rester sur le pack outillage sans avertissement -- c'est le cas de
  // boutique-demo, zero annotation sur trois produits.
  //
  // ON AFFICHE, ON N'APPLIQUE PAS. Le bouton propose, l'utilisateur decide :
  // changer le pack modifierait ses resultats de recherche en production.
  function chargerSuggestionPack(cardEl, catalogue, key) {
    var zone = cardEl.querySelector(".pack-suggestion");
    if (!zone) return;
    apiFetch("/v1/index/" + encodeURIComponent(catalogue) + "/rulepack-suggestion", key)
      .then(function (d) {
        if (!d.recommande) {
          // On affiche quand meme le constat quand aucun pack ne reconnait
          // rien : un catalogue a zero annotation est un probleme, meme sans
          // meilleur candidat.
          var meilleur = d.meilleur || {};
          if (meilleur.produits_annotes === 0) {
            zone.hidden = false;
            zone.className = "pack-suggestion pack-suggestion-alerte";
            zone.innerHTML = "<strong>" + T("Aucun attribut reconnu") + "</strong> " +
              T("sur cet échantillon. Vos produits ne bénéficient d'aucune annotation — vérifiez que le pack correspond bien à votre secteur, ou créez des reconnaissances personnalisées.");
          } else {
            zone.hidden = true;
          }
          return;
        }
        var actuel = d.actuel || { produits_annotes: 0 };
        var meilleur = d.meilleur;
        zone.hidden = false;
        zone.className = "pack-suggestion";
        zone.innerHTML =
          "<p class='pack-suggestion-titre'>" + T("Le pack <strong>{0}</strong> semble mieux adapté", esc(d.recommande)) + "</p>" +
          "<p class='pack-suggestion-detail'>" + T("Sur {0} produits : <strong>{1}</strong> annotés avec « {2} », contre <strong>{3}</strong> avec « {4} ».",
            d.echantillon, meilleur.produits_annotes, esc(d.recommande), actuel.produits_annotes, esc(d.pack_actuel || T("aucun"))) + "</p>" +
          "<button type='button' class='pack-suggestion-appliquer' data-pack='" +
            esc(d.recommande) + "'>" + T("Présélectionner le pack {0}", esc(d.recommande)) + "</button>" +
          // Correctif (20 aout 2026, audit passe 3 §3) : le bouton
          // annoncait "Selectionner le pack" en style primaire, mais ne
          // fait que preselectionner dans la liste -- il fallait ensuite
          // enregistrer, puis reimporter. Un bouton primaire doit faire
          // ce qu'il annonce.
          //
          // Ecart assume avec l'audit, qui proposait d'ajouter un
          // primaire "Reimporter avec le pack" : la reimportation part de
          // l'API du client, la console ne peut pas la declencher. Ce
          // bouton promettrait ce qu'on ne peut pas tenir. On corrige donc
          // le libelle et le style, sans inventer une action impossible.
          "<span class='pack-suggestion-note'>" + T("Ce bouton présélectionne le pack.") + " " +
            T("<strong>Les annotations sont calculées à l'indexation</strong> : pour qu'elles changent, réimportez votre catalogue en déclarant le nouveau pack.") +
            " <a href='../docs.html#ep-items' target='_blank' rel='noopener'>" + T("Voir la marche à suivre") + "</a>.</span>";

        var bouton = zone.querySelector(".pack-suggestion-appliquer");
        bouton.addEventListener("click", function () {
          // On pre-selectionne SANS enregistrer : l'utilisateur voit son
          // choix et confirme par le bouton d'enregistrement existant.
          var select = cardEl.querySelector(".catalog-rulepack-select");
          if (select) {
            select.value = d.recommande;
            select.dispatchEvent(new (select.ownerDocument.defaultView || window).Event("change", { bubbles: true }));
          }
          zone.hidden = true;
        });
      })
      .catch(function () { /* la suggestion est un bonus, jamais bloquante */ });
  }

  function wireCatalogCard(cardEl, catalog, key) {
    chargerSuggestionPack(cardEl, catalog.catalog, key);

    // SUPPRESSION D'UN CATALOGUE (29 juillet).
    //
    // Rien ne permettait de supprimer un catalogue : un import raté
    // obligeait à en créer un autre sous un nom différent, et l'ancien
    // continuait de consommer le quota du plan.
    //
    // Double garde-fou : la modale habituelle, PUIS la saisie du nom.
    // L'opération efface produits, priorités, règles et synonymes — et
    // rien ne permet de revenir en arrière.
    var btnSupprimer = cardEl.querySelector(".catalog-delete");
    if (btnSupprimer) {
      btnSupprimer.addEventListener("click", function () {
        var nom = catalog.catalog;
        confirmerSuppression(
          T("Supprimer le catalogue <strong>{0}</strong> et ses {1} produits ?<br>Les règles, reconnaissances personnalisées et synonymes seront perdus. <strong>Cette action est irréversible.</strong>",
            esc(nom), catalog.products || 0),
          btnSupprimer,
          function () {
            var saisi = window.prompt(T("Confirmez en recopiant le nom du catalogue :"), "");
            if (saisi !== nom) {
              if (saisi !== null) window.alert(T("Le nom ne correspond pas. Rien n'a été supprimé."));
              return;
            }
            btnSupprimer.disabled = true;
            apiFetch("/v1/index/" + encodeURIComponent(nom) +
                     "?confirm=" + encodeURIComponent(nom), key, { method: "DELETE" })
              .then(function () { loadCatalogs(key); })
              .catch(function (e) {
                btnSupprimer.disabled = false;
                window.alert(T("Suppression impossible : {0}", e.message || e));
              });
          }
        );
      });
    }
    // Bascule bac a sable. Les deux refus possibles (plan insuffisant,
    // plafond atteint) viennent du moteur avec leur message : on les affiche
    // tels quels plutot que de dupliquer la regle cote client, ou elle
    // divergerait.
    var sandboxToggle = cardEl.querySelector(".catalog-sandbox-toggle");
    var sandboxStatus = cardEl.querySelector(".catalog-sandbox-status");
    if (sandboxToggle) sandboxToggle.addEventListener("change", function () {
      var voulu = sandboxToggle.checked;
      sandboxToggle.disabled = true;
      if (sandboxStatus) { sandboxStatus.className = "catalog-rule-status"; sandboxStatus.textContent = "…"; }
      apiFetch("/v1/index/" + encodeURIComponent(catalog.catalog) + "/sandbox", key, {
        method: "PUT", body: { sandbox: voulu },
      }).then(function () {
        catalog.sandbox = voulu;
        if (sandboxStatus) {
          sandboxStatus.className = "catalog-rule-status ok";
          sandboxStatus.textContent = voulu ? T("Bac à sable activé.") : T("Catalogue redevenu facturé.");
        }
        if (typeof rechargerCatalogues === "function") rechargerCatalogues(key);
      }).catch(function (err) {
        sandboxToggle.checked = !voulu;
        if (sandboxStatus) {
          sandboxStatus.className = "catalog-rule-status err";
          sandboxStatus.textContent = (err && err.message) || T("Impossible de modifier ce réglage.");
        }
      }).then(function () { sandboxToggle.disabled = false; });
    });


    var select = cardEl.querySelector(".catalog-rulepack-select");
    var saveBtn = cardEl.querySelector(".catalog-rulepack-save");
    var status = cardEl.querySelector(".catalog-rulepack-status");
    saveBtn.addEventListener("click", function () {
      if (select.value === catalog.rulepack) return;
      saveBtn.disabled = true;
      status.className = "catalog-rulepack-status"; status.textContent = T("Réindexation…");
      apiFetch("/v1/index/" + encodeURIComponent(catalog.catalog) + "/config", key, {
        method: "PUT", body: { rulepack: select.value },
      }).then(function (data) {
        catalog.rulepack = data.rulepack;
        catalog.products = data.products; catalog.annotations = data.annotations; catalog.synonym_groups = data.synonym_groups;
        status.className = "catalog-rulepack-status ok"; status.textContent = T("Enregistré — produits réindexés.");
        updateCardMeta(cardEl, catalog);
      }).catch(function () {
        status.className = "catalog-rulepack-status err"; status.textContent = T("Échec — réessayez.");
      }).then(function () { saveBtn.disabled = false; });
    });
    // Synonymes et regles personnalisees ne sont plus dans la carte : les
    // cabler ici cherchait des elements absents, levait une TypeError, et
    // faisait echouer le rendu de TOUS les catalogues -- d'ou une section
    // « Mes catalogues » vide. Ils sont desormais cables par
    // wireCustomRulesPane, sous Personnalisation.
  }

  function catalogCardHtml(c) {
    var options = AVAILABLE_RULEPACKS.map(function (rp) {
      return '<option value="' + esc(rp) + '"' + (rp === c.rulepack ? " selected" : "") + '>' + esc(rp) + '</option>';
    }).join("");
    return '<div class="catalog-card" data-catalog-card="' + esc(c.catalog) + '">' +
      '<div class="catalog-card-head"><span class="catalog-card-name">' + esc(c.catalog) + '</span></div>' +
      '<div class="catalog-card-meta">' + T(c.products > 1 ? "{0} produits" : "{0} produit", c.products) + ' · ' +
        T("{0} annotations", c.annotations) + ' · ' + T(c.synonym_groups > 1 ? "{0} groupes de synonymes" : "{0} groupe de synonymes", c.synonym_groups) + '</div>' +
      '<div class="catalog-card-row">' +
        '<label>' + T("Pack de règles") + '</label>' +
        '<select class="catalog-rulepack-select">' + options + '</select>' +
        '<button type="button" class="catalog-rulepack-save">' + T("Enregistrer") + '</button>' +
        '<span class="catalog-rulepack-status"></span>' +
      '</div>' +
      '<div class="pack-suggestion" hidden></div>' +
      '<div class="catalog-card-row" style="margin-top:16px;">' +
        '<label class="br-stock-toggle" style="margin:0;">' +
          '<input type="checkbox" class="catalog-sandbox-toggle"' + (c.sandbox ? ' checked' : '') + '>' +
          '<span>' + T("Bac à sable — ne pas facturer ce catalogue") + '</span>' +
        '</label>' +
        '<span class="catalog-sandbox-status catalog-rule-status"></span>' +
      '</div>' +
      '<div class="catalog-synonyms-label" style="margin-top:22px;">' + T("Synonymes et reconnaissances personnalisées") + '</div>' +
      '<p class="console-panel-note" style="margin:6px 0 0;">' + T("Gérés depuis") + ' <button type="button" class="catalog-goto-rules" data-goto-pane="pane-vocabulaire">' + T("Optimiser → Vocabulaire du moteur") + '</button>.</p>' +
      // Correctif (20 aout 2026, audit passe 3 §3, partiel). L'audit
      // decrit "un bouton a contour rouge au fil du contenu, sans
      // confirmation annoncee" et demande une confirmation par saisie du
      // nom. VERIFIE AVANT DE CODER : elle existe deja, et a trois
      // niveaux -- message annoncant l'irreversibilite et le nombre de
      // produits perdus, recopie du nom exact, puis parametre confirm
      // verifie par le moteur. Ce point de l'audit a ete decrit sans
      // cliquer ; rien n'est change de ce cote.
      //
      // Ce qui manquait reellement : le titre de section. Le bouton
      // apparaissait sous un simple filet, sans dire ou l'on entre.
      '<div class="catalog-card-danger">' +
        '<div class="catalog-danger-titre">' + T("Zone sensible") + '</div>' +
        '<button type="button" class="catalog-delete">' + T("Supprimer ce catalogue") + '</button>' +
      '</div>' +
    '</div>';
  }

  function verifierQuotaCatalogues(key) {
    var zone = document.getElementById("catalogs-quota-alerte");
    if (!zone) return;
    apiFetch("/v1/usage", key).then(function (d) {
      var utilise = d.catalogs_used, plafond = d.catalogs_limit;
      if (utilise === undefined || !plafond) { zone.hidden = true; return; }

      var restants = plafond - utilise;
      // On alerte au DERNIER catalogue disponible, pas seulement au plafond :
      // prevenir apres coup n'a plus d'interet.
      if (restants > 1) { zone.hidden = true; return; }

      zone.hidden = false;
      var atteint = restants <= 0;
      zone.className = "quota-alerte" + (atteint ? " quota-alerte-critique" : "");
      zone.innerHTML =
        "<div class='quota-alerte-texte'>" +
          "<strong>" + T(atteint
            ? "Vous avez atteint la limite de votre formule"
            : "Il vous reste un catalogue disponible") + "</strong>" +
          "<span>" + T(utilise > 1 ? "{0} catalogues sur {1}" : "{0} catalogue sur {1}", utilise, plafond) +
            " " + T("avec la formule {0}.", esc(PLAN_LIBELLES[d.plan] || d.plan || T("actuelle"))) + " " +
            T(atteint
              ? "La création d'un nouveau catalogue sera refusée."
              : "Au-delà, la création sera refusée.") +
          "</span>" +
        "</div>" +
        "<button type='button' class='btn quota-alerte-action' data-goto-pane='pane-billing'>" +
          T("Voir les formules") + "</button>";
    }).catch(function () { /* l'alerte est un bonus, jamais bloquante */ });
  }

  function loadCatalogs(key) {
    var loading = document.getElementById("catalogs-loading");
    var list = document.getElementById("catalogs-list");
    var empty = document.getElementById("catalogs-empty");
    loading.hidden = false; list.innerHTML = ""; empty.hidden = true;

    // SIGNAL PROACTIF sur le quota de catalogues (audit UX, point 2).
    //
    // Alexis a decouvert le plafond de 2 catalogues par un MESSAGE D'ERREUR,
    // en tentant d'en creer un troisieme. Le prevenir en amont evite la
    // decouverte par l'echec -- et transforme une frustration en occasion de
    // montee en gamme.
    verifierQuotaCatalogues(key);

    Promise.all([
      apiFetch("/v1/index/catalogs", key),
      AVAILABLE_RULEPACKS.length ? Promise.resolve({ rulepacks: AVAILABLE_RULEPACKS.map(function (n) { return { name: n }; }) }) : apiFetch("/v1/rulepacks", key),
    ]).then(function (results) {
      var catalogs = results[0].catalogs;
      AVAILABLE_RULEPACKS = results[1].rulepacks.map(function (r) { return r.name; });
      loading.hidden = true;
      if (!catalogs.length) {
        empty.hidden = false;
        return;
      }
      list.innerHTML = catalogs.map(catalogCardHtml).join("");
      var cardEls = list.querySelectorAll(".catalog-card");
      catalogs.forEach(function (c, i) { wireCatalogCard(cardEls[i], c, key); });

      // Correctif (18 aout 2026, brief §3.1) : le vrai selecteur vit
      // desormais sur la page elle-meme (catalog-list-selector), plus
      // dans la sidebar (sidebar-catalog-items retire). Meme
      // comportement "un seul catalogue visible a la fois" -- chaque
      // carte est un vrai bloc substantiel, en empiler plusieurs serait
      // long a parcourir.
      var selecteur = document.getElementById("catalog-list-selector");
      var titre = document.getElementById("catalog-pane-title");
      selecteur.hidden = catalogs.length < 2;
      selecteur.innerHTML = catalogs.map(function (c, i) {
        return '<button type="button" class="catalog-list-pill' + (i === 0 ? ' catalog-list-pill-on' : '') +
          '" data-catalog-select="' + esc(c.catalog) + '">' + esc(c.catalog) + '</button>';
      }).join("");
      function afficherCatalogue(nom) {
        cardEls.forEach(function (card) { card.hidden = card.getAttribute("data-catalog-card") !== nom; });
        selecteur.querySelectorAll(".catalog-list-pill").forEach(function (p) {
          p.classList.toggle("catalog-list-pill-on", p.getAttribute("data-catalog-select") === nom);
        });
        if (titre) titre.textContent = catalogs.length > 1 ? T("Mes catalogues") : T("Mon catalogue");
      }
      selecteur.addEventListener("click", function (e) {
        var pill = e.target.closest("[data-catalog-select]");
        if (!pill) return;
        var nom = pill.getAttribute("data-catalog-select");
        afficherCatalogue(nom);
        // Correctif (20 aout 2026, audit passe 3 §2). Cliquer une
        // pastille ne mettait PAS a jour le selecteur du haut : les deux
        // restaient visibles a l'ecran avec des valeurs differentes, sans
        // le moindre signal. Risque concret -- editer le pack de regles
        // du mauvais catalogue en croyant travailler sur l'autre.
        //
        // Un seul catalogue actif fait desormais foi. On passe par le
        // selecteur global plutot que d'ecrire session.catalogueActif
        // directement : son ecouteur "change" porte deja la memorisation
        // et la propagation a tous les ecrans.
        var global = document.getElementById("global-catalog");
        if (global && global.value !== nom) {
          global.value = nom;
          global.dispatchEvent(new Event("change"));
        }
      });
      // Correctif (20 aout 2026) : la page ouvrait toujours sur le
      // PREMIER catalogue, meme si le catalogue actif etait un autre --
      // le commentaire precedent evoquait cette possibilite sans jamais
      // l'implementer. Le catalogue actif fait foi ; repli sur le premier
      // s'il n'est pas dans la liste (compte neuf, catalogue supprime).
      var voulu = catalogueCourant();
      var connu = catalogs.some(function (c) { return c.catalog === voulu; });
      afficherCatalogue(connu ? voulu : catalogs[0].catalog);
    }).catch(function () {
      loading.hidden = true;
      empty.hidden = false;
      empty.textContent = T("Impossible de charger vos catalogues pour le moment.");
    });
  }

  function startSession(sessionToken, key) {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionToken);
    session.activeKey = key;
    showDashboard();
    cablerConsole(key);
    chargerDonnees(key, periodSelect.value);
    dashboard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function endSession() {
    var token = localStorage.getItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    if (token) {
      fetch(API_BASE + "/v1/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + token } }).catch(function () {});
    }
    // REMISE A ZERO DE L'ETAT DE SESSION (chantier S6, 5 aout 2026).
    //
    // Un seul bloc plutot qu'une liste de reaffectations individuelles :
    // un nouvel etat de session ajoute a etatInitial() est remis a zero
    // automatiquement ici, sans ligne supplementaire a se souvenir d'ecrire
    // -- c'etait la fuite documentee (un oubli = etat du compte precedent
    // visible par le suivant sur un poste partage).
    session = etatInitial();

    // Le menu entreprise vit dans l'en-tete du SITE, pas dans la section
    // tableau de bord : masquer celle-ci ne le fait donc pas disparaitre. Il
    // continuait d'afficher la raison sociale apres deconnexion, ce qui
    // laissait croire a une session encore active.
    var orgDrop = document.querySelector(".console-org-drop");
    if (orgDrop) orgDrop.hidden = true;
    var orgBtn = document.getElementById("console-org-btn");
    if (orgBtn) orgBtn.textContent = T("Mon compte");

    var globalSelect = document.getElementById("global-catalog");
    if (globalSelect) { globalSelect.innerHTML = ""; globalSelect.disabled = true; }
    var banniere = document.getElementById("sandbox-banner");
    if (banniere) banniere.hidden = true;

    setAuthMode("login");
    loginForm.reset();
    showLogin();
  }

  // ---------------- Connexion ----------------
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginBtn.disabled = true;
    loginBtn.textContent = T("Connexion…");
    loginError.hidden = true;
    apiPost("/v1/auth/login", { email: loginEmail.value.trim(), password: loginPassword.value })
      .then(function (data) {
        if (!data.keys || !data.keys.length) {
          showLogin(T("Ce compte n'a pas encore de clé API associée. Contactez le support."));
          return;
        }
        startSession(data.session_token, data.keys[0].key);
      })
      .catch(function (err) {
        var reason = err && err.status === 401 ? L.loginErrorInvalid : L.loginErrorNetwork;
        loginError.textContent = reason;
        loginError.hidden = false;
      })
      .then(function () {
        loginBtn.disabled = false;
        loginBtn.textContent = T("Se connecter");
      });
  });

  // ---------------- Création de compte ----------------
  signupForm.addEventListener("submit", function (e) {
    e.preventDefault();
    signupBtn.disabled = true;
    signupBtn.textContent = T("Création…");
    signupError.hidden = true;
    apiPost("/v1/auth/signup", {
      email: signupEmail.value.trim(), password: signupPassword.value,
      raison_sociale: signupRaisonSociale.value.trim(),
      numero_tva: signupTva.value.trim() || null,
    })
      .then(function (data) {
        showPostSignupScreen(data.session_token, data.key, signupEmail.value.trim());
      })
      .catch(function (err) {
        signupError.textContent = (err && err.status) ? err.message : L.loginErrorNetwork;
        signupError.hidden = false;
      })
      .then(function () {
        signupBtn.disabled = false;
        signupBtn.textContent = T("Créer mon compte et obtenir ma clé");
      });
  });

  // ---------------- Écran clé (après inscription uniquement) ----------------
  // N'intervient QUE juste après une inscription -- startSession() (donc
  // showDashboard()) reste strictement inchangée pour la connexion
  // normale. Cet écran ne fait que RETARDER de quelques secondes l'appel
  // à startSession(), jamais le conditionner à quoi que ce soit : le
  // bouton "continuer" l'appelle exactement comme le faisait l'ancien
  // code directement après le POST /v1/auth/signup.
  var postSignupScreen = document.getElementById("post-signup-screen");
  var postSignupEmail = document.getElementById("post-signup-email");
  var postSignupKeyValue = document.getElementById("post-signup-key-value");
  var postSignupCopyBtn = document.getElementById("post-signup-copy-btn");
  var postSignupCopyConfirm = document.getElementById("post-signup-copy-confirm");
  var postSignupContinueBtn = document.getElementById("post-signup-continue-btn");
  var segSecteur = document.getElementById("seg-secteur");
  var segPlateforme = document.getElementById("seg-plateforme");

  function showPostSignupScreen(sessionToken, key, email) {
    AUTH_FORMS.forEach(function (f) { f.hidden = true; });
    loginScreen.hidden = true;
    authLinks.hidden = true;
    authBack.hidden = true;
    postSignupEmail.textContent = email;
    postSignupKeyValue.textContent = key;
    postSignupCopyConfirm.hidden = true;
    if (segSecteur) segSecteur.value = "";
    if (segPlateforme) segPlateforme.value = "";
    postSignupScreen.hidden = false;
    postSignupContinueBtn.onclick = function () {
      // Segmentation (2 août, point 4) -- facultative, jamais bloquante :
      // le bouton fait EXACTEMENT la même chose qu'on ait répondu ou non.
      // La requête part en tâche de fond (pas de await, pas de .then
      // avant startSession) -- même si elle échoue ou traîne, l'accès au
      // tableau de bord ne dépend jamais d'elle.
      var secteur = segSecteur && segSecteur.value ? segSecteur.value : null;
      var plateforme = segPlateforme && segPlateforme.value ? segPlateforme.value : null;
      if (secteur || plateforme) {
        apiPost("/v1/auth/onboarding-profile", { secteur: secteur, plateforme: plateforme })
          .catch(function () { /* tache de fond : un echec ici n'affecte jamais l'acces au tableau de bord */ });
      }
      postSignupScreen.hidden = true;
      startSession(sessionToken, key);
    };
  }

  if (postSignupCopyBtn) {
    postSignupCopyBtn.addEventListener("click", function () {
      navigator.clipboard.writeText(postSignupKeyValue.textContent).then(function () {
        postSignupCopyConfirm.hidden = false;
      });
    });
  }

  // ---------------- Acceptation d'une invitation d'équipe ----------------
  var inviteTokenFromUrl = new URLSearchParams(window.location.search).get("invite");

  acceptInviteForm.addEventListener("submit", function (e) {
    e.preventDefault();
    acceptInviteBtn.disabled = true;
    acceptInviteBtn.textContent = T("Connexion…");
    acceptInviteError.hidden = true;
    apiPost("/v1/auth/accept-invite", { token: inviteTokenFromUrl, password: acceptInvitePassword.value })
      .then(function (data) {
        history.replaceState(null, "", window.location.pathname);
        startSession(data.session_token, data.keys[0].key);
      })
      .catch(function (err) {
        acceptInviteError.textContent = (err && err.status) ? err.message : L.loginErrorNetwork;
        acceptInviteError.hidden = false;
      })
      .then(function () {
        acceptInviteBtn.disabled = false;
        acceptInviteBtn.textContent = T("Rejoindre l'équipe");
      });
  });

  // ---------------- Mot de passe oublié ----------------
  resetRequestForm.addEventListener("submit", function (e) {
    e.preventDefault();
    resetRequestBtn.disabled = true;
    resetRequestBtn.textContent = T("Envoi…");
    apiPost("/v1/auth/request-password-reset", { email: resetEmail.value.trim() })
      .then(function () {
        resetRequestMsg.textContent = T("Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.");
        resetRequestMsg.hidden = false;
        resetRequestForm.reset();
      })
      .catch(function () {
        resetRequestMsg.textContent = L.loginErrorNetwork;
        resetRequestMsg.hidden = false;
      })
      .then(function () {
        resetRequestBtn.disabled = false;
        resetRequestBtn.textContent = T("Envoyer le lien");
      });
  });

  // ---------------- Nouveau mot de passe (lien reçu par email) ----------------
  var resetTokenFromUrl = new URLSearchParams(window.location.search).get("reset");

  resetConfirmForm.addEventListener("submit", function (e) {
    e.preventDefault();
    resetConfirmBtn.disabled = true;
    resetConfirmBtn.textContent = T("Réinitialisation…");
    resetConfirmError.hidden = true;
    apiPost("/v1/auth/confirm-password-reset", { token: resetTokenFromUrl, password: resetNewPassword.value })
      .then(function () {
        history.replaceState(null, "", window.location.pathname);
        setAuthMode("login");
        loginError.textContent = T("Mot de passe mis à jour — vous pouvez vous connecter.");
        loginError.hidden = false;
      })
      .catch(function (err) {
        resetConfirmError.textContent = (err && err.status) ? err.message : L.loginErrorNetwork;
        resetConfirmError.hidden = false;
      })
      .then(function () {
        resetConfirmBtn.disabled = false;
        resetConfirmBtn.textContent = T("Réinitialiser mon mot de passe");
      });
  });

  // ---------------- Bascule entre les modes ----------------
  showSignupLink.addEventListener("click", function (e) { e.preventDefault(); setAuthMode("signup"); });
  showResetLink.addEventListener("click", function (e) { e.preventDefault(); setAuthMode("reset-request"); });
  showLoginLink.addEventListener("click", function (e) { e.preventDefault(); setAuthMode("login"); });

  logoutBtn.addEventListener("click", endSession);

  periodSelect.addEventListener("change", function () {
    // Changement de periode : DONNEES seules. C'etait deja l'intention, mais
    // loadDashboard recablait au passage.
    if (session.activeKey) chargerDonnees(session.activeKey, periodSelect.value);
  });

  // ---------------- Point d'entrée ----------------
  wireExportsCSV();

  if (inviteTokenFromUrl) {
    // Une invitation prime aussi — quelqu'un qui clique un lien d'équipe
    // ne doit jamais retomber sur un vieux formulaire de connexion.
    setAuthMode("accept-invite");
    fetch(API_BASE + "/v1/auth/invite/" + encodeURIComponent(inviteTokenFromUrl))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        acceptInviteIntro.textContent = data.raison_sociale
          ? T("Vous rejoignez l'équipe de {0} ({1}).", data.raison_sociale, data.email)
          : T("Invitation pour {0}.", data.email);
      })
      .catch(function () {
        acceptInviteIntro.textContent = T("Ce lien d'invitation semble invalide ou expiré.");
      });
    showLogin();
  } else if (resetTokenFromUrl) {
    // Un lien de réinitialisation prime sur toute session existante.
    setAuthMode("reset-confirm");
    showLogin();
  } else {
    var existingSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existingSession) {
      apiFetch("/v1/auth/me", existingSession)
        .then(function (data) {
          if (!data.keys || !data.keys.length) { throw new Error("no_key"); }
          session.activeKey = data.keys[0].key;
          showDashboard();
          cablerConsole(session.activeKey);
          chargerDonnees(session.activeKey, periodSelect.value);
        })
        .catch(function () {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setAuthMode("login");
          showLogin();
        });
    } else {
      setAuthMode("login");
    }
  }
})();

