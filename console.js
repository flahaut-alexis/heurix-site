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
      if (pct === null || pct === undefined) { el.hidden = true; return; }
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
    document.getElementById("stat-errors").textContent = summary.total_errors.toLocaleString(LOCALE);
    document.getElementById("stat-usage").textContent = usage.requests.toLocaleString(LOCALE);
    // La comparaison est un appel distinct : elle ne doit pas retarder
    // l'affichage des chiffres principaux.
    if (typeof session.activeKey !== "undefined" && session.activeKey) {
      var jours = (document.getElementById("period-select") || {}).value || 30;
      apiFetch("/v1/analytics/comparison?days=" + jours, session.activeKey)
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

  function exporterTableauCSV(tableId, nomFichier) {
    var table = document.getElementById(tableId);
    if (!table) return;
    var lignes = [];
    var entetes = Array.prototype.map.call(table.querySelectorAll("thead th"), function (th) {
      return th.textContent.trim();
    });
    lignes.push(entetes);
    Array.prototype.forEach.call(table.querySelectorAll("tbody tr"), function (tr) {
      var cellules = Array.prototype.map.call(tr.querySelectorAll("td"), function (td) {
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
  function wireCategoryViews(key) {
    var select = document.getElementById("cv-catalog");
    var contenu = document.getElementById("cv-content");
    var vide = document.getElementById("cv-empty");
    if (!select) return;

    function charger() {
      var catalogue = select.value;
      if (!catalogue) return;
      contenu.innerHTML = "<p class='console-panel-note'>" + T("Chargement…") + "</p>";
      vide.hidden = true;
      apiFetch("/v1/analytics/category-views/" + encodeURIComponent(catalogue), key)
        .then(function (data) {
          var cats = data.categories || [];
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

    // Les catalogues sont deja connus ailleurs dans la console : on
    // reutilise la meme source plutot que de refaire un appel.
    apiFetch("/v1/index/catalogs", key).then(function (data) {
      var noms = (data.catalogs || []).map(function (c) { return c.catalog; });
      select.innerHTML = noms.map(function (n) {
        return "<option value='" + esc(n) + "'>" + esc(n) + "</option>";
      }).join("");
      if (noms.length) charger();
    }).catch(function () {});

    select.addEventListener("change", charger);
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
        var vide = document.getElementById("seg-empty");
        vide.hidden = !!data.courant.total_visiteurs;

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
      if (orgBtn) orgBtn.textContent = company.raison_sociale || T("Mon compte");
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

  var ALL_PANE_IDS = ["pane-overview", "pane-guides", "pane-top-queries", "pane-zero-results", "pane-errors", "pane-search-overrides", "pane-category-views", "pane-related-products", "pane-segmentation",
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

  function catalogueCourant() { return session.catalogueActif; }

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

  function wireGlobalCatalog(key) {
    var select = document.getElementById("global-catalog");
    if (!select) return;

    apiFetch("/v1/index/catalogs", key).then(function (data) {
      session.catalogueListe = (data.catalogs || []).map(function (c) { return c.catalog; });
      session.catalogueSandbox = {};
      (data.catalogs || []).forEach(function (c) { session.catalogueSandbox[c.catalog] = !!c.sandbox; });

      if (!session.catalogueListe.length) {
        // Compte neuf : rien a choisir. On le dit plutot que d'afficher une
        // liste vide, qui laisserait croire a une panne.
        select.innerHTML = '<option value="">' + T("Aucun catalogue") + '</option>';
        select.disabled = true;
        return;
      }
      select.disabled = false;
      select.innerHTML = session.catalogueListe.map(function (n) {
        return "<option value='" + esc(n) + "'>" + esc(n) +
          (session.catalogueSandbox[n] ? " — " + T("bac à sable") : "") + "</option>";
      }).join("");

      // La grande majorite des comptes n'a qu'un catalogue : on le
      // selectionne d'office plutot que d'imposer un choix sans alternative.
      var memoire = localStorage.getItem("heurix_catalogue_actif");
      session.catalogueActif = (memoire && session.catalogueListe.indexOf(memoire) !== -1)
        ? memoire : session.catalogueListe[0];
      select.value = session.catalogueActif;
      appliquerCatalogue(key);
      // Un nouveau client ne devine pas que ce choix porte sur TOUTE la
      // console -- il peut le prendre pour un filtre local. On l'explique
      // une fois, s'il a plus d'un catalogue (avec un seul, le selecteur
      // n'a rien d'ambigu).
      if (session.catalogueListe.length > 1) expliquerCatalogueGlobal();
    }).catch(function () {});

    select.addEventListener("change", function () {
      session.catalogueActif = select.value;
      localStorage.setItem("heurix_catalogue_actif", session.catalogueActif);
      appliquerCatalogue(key);
    });
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

  function appliquerCatalogue(key) {
    majBandeauSandbox();
    session.soCurrentCatalog = session.catalogueActif;
    session.browseCurrentCatalog = session.catalogueActif;
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
    chargerSegmentation(key);

    if (ouvert === "pane-search-overrides") {
      var contenu = document.getElementById("so-content");
      if (contenu) contenu.hidden = !session.catalogueActif;
      if (session.catalogueActif) {
        soAnimerPlaceholder();
        refreshSoTable(key);
        refreshSoPreview(key);
        chargerSynonymesEtRegles(key);
      }
    } else if (ouvert === "pane-browse") {
      onBrowseCatalogChange(key);
    } else if (ouvert === "pane-category-views") {
      wireCategoryViews(key);
    } else if (ouvert === "pane-related-products") {
      rpReinitialiser();
    }
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
    ALL_PANE_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = id !== paneId;
    });
    document.querySelectorAll(".console-sidebar-item").forEach(function (btn) {
      btn.classList.toggle("console-sidebar-item-on", btn.getAttribute("data-pane") === paneId && !btn.hasAttribute("data-catalog"));
    });
    // L'effet de frappe part a l'OUVERTURE du panneau, pas au cablage :
    // celui-ci s'execute a la connexion, alors que le pave est encore
    // masque -- l'animation se terminait sans que personne ne la voie.
    // Le catalogue etant global, ouvrir un ecran suffit a le charger : plus
    // besoin de resaisir le catalogue a chaque fois.
    if (typeof appliquerCatalogueOuverture === "function") appliquerCatalogueOuverture(paneId);
    if (paneId === "pane-billing" && session.cleCourante) renderBilling(session.cleCourante);
    // Consulter les erreurs les marque vues : le badge s'eteint.
    if (paneId === "pane-errors" && typeof _dernieresErreurs !== "undefined") {
      marquerErreursVues(_dernieresErreurs);
      var b = document.getElementById("nav-badge-erreurs");
      if (b) b.hidden = true;
    }
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
      apiFetch("/v1/analytics/top-products?days=" + periodSelect.value + "&sort_by=" + sortBy + "&limit=10", key),
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

  function resetSoForm() {
    soEditingKey = null;
    document.getElementById("so-query").value = "";
    document.getElementById("so-product-id").value = "";
    document.getElementById("so-action").value = "pin";
    document.getElementById("so-position").hidden = false;
    document.getElementById("so-position").value = "";
    document.getElementById("so-form-title").textContent = T("Ajouter une priorité");
    document.getElementById("so-submit-btn").textContent = T("Ajouter la priorité");
    document.getElementById("so-cancel-edit-btn").hidden = true;
    document.getElementById("so-status").textContent = "";
  }

  function fillSoForm(o) {
    document.getElementById("so-query").value = o.query;
    document.getElementById("so-product-id").value = o.productId;
    document.getElementById("so-action").value = o.action;
    document.getElementById("so-position").hidden = o.action !== "pin";
    document.getElementById("so-position").value = o.position || "";
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

  function simuBarUpdate(prefix, draft) {
    var bar = document.getElementById(prefix + "-simu-bar");
    var texte = document.getElementById(prefix + "-simu-text");
    var n = (draft || []).length;
    if (bar) bar.hidden = !draft || n === 0;
    if (texte) {
      texte.textContent = T(n > 1 ? "{0} changements non publiés. Vos visiteurs voient toujours le classement actuel." : "{0} changement non publié. Vos visiteurs voient toujours le classement actuel.", n);
    }
  }

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

  function refreshSoPreview(key) {
    var champ = document.getElementById("so-preview-query");
    var vide = document.getElementById("so-preview-empty");
    var grille = document.getElementById("so-preview-grid");
    var legende = document.getElementById("so-preview-caption");
    if (!champ || !session.soCurrentCatalog) return;

    var q = champ.value.trim();
    // Requete vide = vue du catalogue. Le moteur accepte q="" (mode
    // parcours) et renvoie tout ; on trie alors par nom, ce qui donne une
    // vue stable et lisible pour se reperer avant de tester quoi que ce soit.
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
          var badge = h.pinned
            ? "<span class='so-card-badge so-card-badge-pin'>" + T("Épinglé") + "</span>"
            : h.buried ? "<span class='so-card-badge so-card-badge-bury'>" + T("Relégué") + "</span>" : "";
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
          var pourquoi = (q && (h.matched || []).length)
            ? "<div class='so-card-why'>" + esc(h.matched.slice(0, 2).join(" · ")) + "</div>"
            : (q && h.pinned ? "<div class='so-card-why'>" + T("Injecté par une règle") + "</div>" : "");

          var pid = esc(p.id);
          var ICONE = ICONES_FICHE;
          var actions = "<div class='so-card-actions'>";
          var bloque = soFiltres.length ? " disabled" : "";
          actions += "<button type='button'" + bloque + " data-so-act='up' data-pid='" + pid + "' title='" + escAttr(T("Monter d'une place")) + "' aria-label='" + T("Monter {0}", esc(p.name || p.id)) + "'>" + ICONE.up + "</button>" +
                     "<button type='button'" + bloque + " data-so-act='down' data-pid='" + pid + "' title='" + escAttr(T("Descendre d'une place")) + "' aria-label='" + T("Descendre {0}", esc(p.name || p.id)) + "'>" + ICONE.down + "</button>";
          if (h.pinned) {
            actions += "<button type='button' data-so-act='retirer' data-pid='" + pid + "' title='" + escAttr(T("Retirer l'épinglage")) + "' aria-label='" + T("Retirer l'épinglage de {0}", esc(p.name || p.id)) + "'>" + ICONE.off + "</button>";
          } else {
            actions += "<button type='button' data-so-act='pin' data-pid='" + pid + "' title='" + T("Mettre en tête") + "' aria-label='" + T("Mettre {0} en tête", esc(p.name || p.id)) + "'>" + ICONE.pin + "</button>";
          }
          actions += "</div>";

          return "<div class='" + classes + "'" + " draggable='true' data-pid='" + pid + "'" + ">" +
            (q ? "<span class='so-card-rank'>" + (i + 1) + "</span>" : "") +
            badge +
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
  function soRenderReglesTable(liste, enBrouillon) {
    // Note : renderTable() cree elle-meme la balise <tr>, soRowHtml() ne
    // construit que son contenu interieur -- pas de vraie classe par
    // ligne possible sans modifier renderTable(), vraie fonction
    // generique reutilisee ailleurs. L'indicateur visuel "brouillon"
    // s'appuie donc uniquement sur .so-rules-draft, posee plus bas sur
    // le panneau parent -- suffisant, pas besoin de toucher chaque ligne.
    renderTable("so-table", "so-empty", liste, soRowHtml);
    var compteur = document.getElementById("so-count");
    if (compteur) {
      var n = (liste || []).length;
      compteur.hidden = n === 0;
      compteur.textContent = enBrouillon
        ? T(n > 1 ? "{0} règles en brouillon" : "{0} règle en brouillon", n)
        : T(n > 1 ? "{0} règles actives" : "{0} règle active", n);
    }
    var panneau = document.getElementById("so-rules-panel");
    if (panneau) panneau.classList.toggle("so-rules-draft", !!enBrouillon);
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
      apiFetch("/v1/index/" + encodeURIComponent(session.catalogueActif) +
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
      apiFetch("/v1/index/" + encodeURIComponent(session.catalogueActif) + "/synonyms", key)
        .then(function (d) {
          var groupes = (d.groups || []).slice();
          groupes.push([de, vers]);
          return apiFetch("/v1/index/" + encodeURIComponent(session.catalogueActif) + "/synonyms",
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

  function wireSoPreview(key) {
    var stock = document.getElementById("so-in-stock");
    if (stock) stock.addEventListener("change", function () { refreshSoPreview(key); });
    var grouper = document.getElementById("so-grouper");
    if (grouper) grouper.addEventListener("change", function () { refreshSoPreview(key); });
    var limite = document.getElementById("so-preview-limit");
    if (limite) limite.addEventListener("change", function () { refreshSoPreview(key); });
    var champ = document.getElementById("so-preview-query");
    if (!champ) return;
    champ.addEventListener("input", function () {
      clearTimeout(soPreviewTimer);
      soPreviewTimer = setTimeout(function () { refreshSoPreview(key); }, 250);
    });
  }

  // ---------------- Brouillon : simulation avant enregistrement ----------------
  //
  // Le formulaire alimente un BROUILLON plutot que d'enregistrer directement.
  // Le brouillon est la liste complete des priorites telles qu'elles seraient
  // apres application : les regles deja enregistrees, plus (ou moins) celle en
  // cours d'edition. Le moteur remplace l'ensemble persiste par cette liste
  // pour l'appel de simulation -- sans rien ecrire.
  function soLireFormulaire() {
    var q = document.getElementById("so-query").value.trim();
    var pid = document.getElementById("so-product-id").value.trim();
    if (!q || !pid) return null;
    var action = document.getElementById("so-action").value;
    var pos = document.getElementById("so-position").value;
    var regle = { query: q, product_id: pid, action: action };
    if (action === "pin" && pos) regle.position = parseInt(pos, 10);
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
        var existantes = (data.overrides || []).map(function (o) {
          return { query: o.query, product_id: o.product_id, action: o.action, position: o.position || undefined };
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

  function soAction(key, action, pid) {
    var q = soRequeteCourante();
    if (!q) return;  // garde-fou : voir soVerifierRequete

    soAvecBrouillon(key, function () {
      var i = soTrouver(q, pid);
      if (action === "retirer") {
        if (i !== -1) session.soDraft.splice(i, 1);
      } else if (i !== -1) {
        session.soDraft[i].action = action;
        if (action === "bury") delete session.soDraft[i].position;
      } else {
        var regle = { query: q, product_id: pid, action: action };
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
  function soDeplacer(key, pid, sens) {
    var q = soRequeteCourante();
    if (!q || !soOrdreAffiche.length) return;
    var i = soOrdreAffiche.indexOf(pid);
    var cible = i + sens;
    if (i === -1 || cible < 0 || cible >= soOrdreAffiche.length) return;

    soAvecBrouillon(key, function () {
      // On retire une eventuelle regle existante sur ce produit, puis on
      // pose le rang voulu. Les autres produits ne sont pas touches.
      session.soDraft = session.soDraft.filter(function (r) {
        return !(r.query === q && r.product_id === pid);
      });
      session.soDraft.push({ query: q, product_id: pid, action: "pin", position: cible + 1 });
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
        T("pour épingler ou reléguer : une priorité se déclenche sur une recherche précise, elle n'existe pas en dehors d'une requête.");
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

    grille.addEventListener("dragstart", function (e) {
      var carte = e.target.closest(".so-card[draggable='true']");
      if (!carte) return;
      depuis = carte.getAttribute("data-pid");
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
      session.soDraft.push({ query: q, product_id: depuis, action: "pin", position: iV + 1 });
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
      if (act === "up") soDeplacer(key, pid, -1);
      else if (act === "down") soDeplacer(key, pid, 1);
      else soAction(key, act, pid);
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
  function crMarkup() {
    return '<div class="catalog-synonyms-label">' + T("Synonymes") + '</div>' +
      '<div class="catalog-synonym-groups"></div>' +
      '<div class="catalog-synonym-add">' +
        '<input type="text" placeholder="' + T("ex. vis, boulon, screw") + '" class="catalog-synonym-input">' +
        '<button type="button" class="catalog-synonym-add-btn">' + T("Ajouter un groupe") + '</button>' +
        '<span class="catalog-synonym-status catalog-rule-status"></span>' +
      '</div>' +
      '<div class="catalog-synonyms-label" style="margin-top:22px;">' + T("Règles personnalisées") + '</div>' +
      '<div class="catalog-rules-list"></div>' +
      '<div class="catalog-synonyms-label catalog-rule-form-title" style="margin-top:14px; font-size:12.5px;">' + T("Ajouter une règle") + '</div>' +
      '<div class="catalog-rule-add">' +
        '<div class="catalog-rule-add-row">' +
          '<select class="catalog-rule-type">' +
            '<option value="keyword">' + T("Mot-clé → étiquette") + '</option>' +
            '<option value="prefix_number">' + T("Préfixe + nombre → étiquette") + '</option>' +
          '</select>' +
          '<input type="text" placeholder="' + T("Nom de la règle, ex. Cheville") + '" class="catalog-rule-label">' +
        '</div>' +
        '<input type="text" placeholder="' + T("Mots équivalents, ex. placo, cheville, molly") + '" class="catalog-rule-keywords">' +
        '<input type="text" placeholder="' + T("Préfixe à reconnaître, ex. M (pour M8, M10…)") + '" class="catalog-rule-prefix" hidden>' +
        '<button type="button" class="catalog-rule-add-btn">' + T("Créer la règle") + '</button>' +
        '<button type="button" class="btn btn-ghost catalog-rule-cancel-edit-btn" hidden style="margin-left:8px;">' + T("Annuler la modification") + '</button>' +
        '<span class="catalog-rule-status"></span>' +
      '</div>';
  }

  function wireCustomRulesPane(key) {
    // Plus de selecteur local : le catalogue vient du choix global.
    chargerSynonymesEtRegles(key);
  }

  function chargerSynonymesEtRegles(key) {
    var host = document.getElementById("cr-host");
    var invite = document.getElementById("cr-hint");
    if (!host) return;
    var catalogue = catalogueCourant();
    if (!catalogue) {
      host.innerHTML = "";
      if (invite) invite.hidden = false;
      return;
    }
    if (invite) invite.hidden = true;
    // On reconstruit a chaque changement de catalogue : le cablage attache
    // ses ecouteurs aux elements, les recreer evite qu'ils pointent vers le
    // catalogue precedent.
    host.innerHTML = crMarkup();
    // Les deux fonctions lisent `catalog.catalog` : elles attendent un objet.
    var objetCatalogue = { catalog: catalogue };
    wireSynonymControls(host, objetCatalogue, key);
    wireCustomRuleControls(host, objetCatalogue, key);
  }


  function wireSearchOverridesPane(key) {
    wireSoPreview(key);
    wireSoDraft(key);
    wireSoGridActions(key);
    if (soFormWired) return;
    soFormWired = true;

    document.getElementById("so-action").addEventListener("change", function (e) {
      document.getElementById("so-position").hidden = e.target.value !== "pin";
    });
    document.getElementById("so-cancel-edit-btn").addEventListener("click", resetSoForm);

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
      if (!query || !productId) return;
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

    document.querySelector("#so-table tbody").addEventListener("click", function (e) {
      var editBtn = e.target.closest("[data-so-edit]");
      var dupBtn = e.target.closest("[data-so-duplicate]");
      var delBtn = e.target.closest("[data-so-delete]");

      if (editBtn) {
        soEditingKey = { query: editBtn.getAttribute("data-query"), productId: editBtn.getAttribute("data-product-id") };
        fillSoForm({
          query: editBtn.getAttribute("data-query"), productId: editBtn.getAttribute("data-product-id"),
          action: editBtn.getAttribute("data-action"), position: editBtn.getAttribute("data-position"),
        });
        document.getElementById("so-form-title").textContent = T("Modifier la priorité");
        document.getElementById("so-submit-btn").textContent = T("Enregistrer les modifications");
        document.getElementById("so-cancel-edit-btn").hidden = false;
        document.getElementById("so-query").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (dupBtn) {
        soEditingKey = null; // duplication : cree une NOUVELLE regle, ne remplace pas l'originale
        fillSoForm({
          query: dupBtn.getAttribute("data-query"), productId: dupBtn.getAttribute("data-product-id"),
          action: dupBtn.getAttribute("data-action"), position: dupBtn.getAttribute("data-position"),
        });
        document.getElementById("so-form-title").textContent = T("Dupliquer une priorité — modifiez au moins un champ");
        document.getElementById("so-submit-btn").textContent = T("Créer cette priorité");
        document.getElementById("so-cancel-edit-btn").hidden = false;
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
    var categorySelect = document.getElementById("browse-category-select");
    // On masque les RESULTATS, pas le panneau : les selecteurs de catalogue
    // et de categorie y vivent desormais, les cacher rendrait impossible de
    // choisir quoi que ce soit.
    document.getElementById("browse-results").hidden = true;
    document.getElementById("browse-hint").hidden = false;
    document.getElementById("browse-no-categories").hidden = true;
    if (!catalog) {
      categorySelect.disabled = true;
      categorySelect.innerHTML = '<option value="">' + T("— Choisir un catalogue d'abord —") + '</option>';
      return;
    }
    categorySelect.disabled = false;
    categorySelect.innerHTML = '<option value="">' + T("Chargement…") + '</option>';
    Promise.all([
      apiFetch("/v1/index/" + encodeURIComponent(catalog) + "/browse-categories", key),
      apiFetch("/v1/index/" + encodeURIComponent(catalog) + "/browse-attributes", key),
    ]).then(function (results) {
      var categories = results[0].categories;
      browseAttributesCache = results[1].attributes;
      if (!categories.length) {
        categorySelect.innerHTML = '<option value="">' + T("— Aucune catégorie —") + '</option>';
        document.getElementById("browse-no-categories").hidden = false;
        return;
      }
      categorySelect.innerHTML = '<option value="">' + T("— Choisir —") + '</option>' + categories.map(function (c) {
        return "<option value='" + esc(c.category) + "'>" + esc(c.category) + " (" + c.products + ")</option>";
      }).join("");
      document.getElementById("browse-known-fields").innerHTML = browseAttributesCache.map(function (a) {
        return "<option value='" + esc(a.field) + "'>";
      }).join("");
    }).catch(function () {
      categorySelect.innerHTML = '<option value="">' + T("— Erreur de chargement —") + '</option>';
    });
  }

  function onBrowseFieldInput() {
    var field = document.getElementById("browse-attribute-field").value.trim();
    var entry = browseAttributesCache.filter(function (a) { return a.field === field; })[0];
    document.getElementById("browse-known-values").innerHTML = entry
      ? entry.values.map(function (v) { return "<option value='" + esc(v.value) + "'>"; }).join("")
      : "";
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
      var badge = h.pinned ? "<span class='so-card-badge so-card-badge-pin'>" + T("Épinglé") + "</span>"
        : h.boosted ? "<span class='so-card-badge so-card-badge-pin'>" + T("Boosté") + "</span>"
        : h.buried ? "<span class='so-card-badge so-card-badge-bury'>" + T("Relégué") + "</span>" : "";
      // Correctif B1 (audit UX console, 17 aout 2026). Meme correctif que
      // Search Overrides : h.in_stock plutot que p.stock === 0.
      var enRupture = h.in_stock === false;
      var stock = h.in_stock === undefined ? "" :
        "<span class='so-card-stock" + (enRupture ? " rupture" : "") + "'>" +
        (enRupture ? T("Rupture") : T("En stock")) + "</span>";
      var prix = (p.price !== undefined && p.price !== null)
        ? "<span class='so-card-price'>" + Number(p.price).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €</span>" : "";

      var actions = "<div class='so-card-actions'>" +
        "<button type='button' data-br-act='up' data-pid='" + pid + "' title='" + escAttr(T("Monter d'une place")) + "' aria-label='" + T("Monter {0}", esc(p.name || p.id)) + "'>" + ICONES_FICHE.up + "</button>" +
        "<button type='button' data-br-act='down' data-pid='" + pid + "' title='" + escAttr(T("Descendre d'une place")) + "' aria-label='" + T("Descendre {0}", esc(p.name || p.id)) + "'>" + ICONES_FICHE.down + "</button>" +
        (h.pinned
          ? "<button type='button' data-br-act='retirer' data-pid='" + pid + "' title='" + escAttr(T("Retirer l'épinglage")) + "' aria-label='" + T("Retirer l'épinglage") + "'>" + ICONES_FICHE.off + "</button>"
          : "<button type='button' data-br-act='pin' data-pid='" + pid + "' title='" + T("Mettre en tête") + "' aria-label='" + T("Mettre en tête") + "'>" + ICONES_FICHE.pin + "</button>") +
        "</div>";

      return "<div class='" + classes + "'" + " draggable='true' data-pid='" + pid + "'" + ">" +
        "<span class='so-card-rank'>" + (i + 1) + "</span>" + badge +
        "<div class='so-card-name'>" + esc(p.name || p.id) + "</div>" +
        "<div class='so-card-ref'>" + esc(p.ref || p.id) + "</div>" +
        "<div class='so-card-foot'>" + prix + stock + "</div>" + actions + "</div>";
    }).join("");

    if (legende) {
      legende.textContent = T(hits.length > 1 ? "{0} produits dans « {1} »" : "{0} produit dans « {1} »", hits.length, session.browseCurrentCategory) +
        (simule ? " — " + T("classement simulé") : "");
    }
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

  function brAction(key, action, pid) {
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
      } else {
        var regle = { product_id: pid, action: action };
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
  function brDeplacer(key, pid, sens) {
    if (!brOrdreAffiche.length) return;
    var i = brOrdreAffiche.indexOf(pid);
    var cible = i + sens;
    if (i === -1 || cible < 0 || cible >= brOrdreAffiche.length) return;

    brAvecBrouillon(key, function () {
      session.brDraft = session.brDraft.filter(function (r) { return r.product_id !== pid; });
      session.brDraft.push({ product_id: pid, action: "pin", position: cible + 1 });
      brSimuler(key);
    });
  }


  function brSimuler(key) {
    if (!session.browseCurrentCatalog || !session.browseCurrentCategory) return;
    var champLim = document.getElementById("browse-preview-limit");
    var lim = champLim ? parseInt(champLim.value, 10) : 20;
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

    grille.addEventListener("dragstart", function (e) {
      var carte = e.target.closest(".so-card[draggable='true']");
      if (!carte) return;
      depuis = carte.getAttribute("data-pid");
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
        session.brDraft = session.brDraft.filter(function (r) { return !(r.product_id === deplace); });
        session.brDraft.push({ product_id: deplace, action: "pin", position: iV + 1 });
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
      if (act === "up") brDeplacer(key, pid, -1);
      else if (act === "down") brDeplacer(key, pid, 1);
      else brAction(key, act, pid);
    });
    var appliquer = document.getElementById("br-simu-apply");
    if (appliquer) appliquer.addEventListener("click", function () { brAppliquerBrouillon(key); });
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

  function refreshBrowsePreview(key) {
    var sort = document.getElementById("browse-sort-select").value;
    var champLim = document.getElementById("browse-preview-limit");
    var lim = champLim ? parseInt(champLim.value, 10) : 20;
    var horsStock = document.getElementById("browse-in-stock");
    var url = "/v1/browse/" + encodeURIComponent(session.browseCurrentCatalog) + "/" + encodeURIComponent(session.browseCurrentCategory) +
              "?sort=" + sort + "&limit=" + lim +
              (horsStock && horsStock.checked ? "&in_stock_only=true" : "");
    apiFetch(url, key).then(function (data) {
      session.brDraft = null;
      brRenderGrille(data.hits || [], false);
      renderTable("browse-preview-table", "browse-preview-empty", data.hits, function (h) {
        var status = h.pinned ? "Épinglé" : h.boosted ? "Boosté" : h.buried ? "Relégué" : "—";
        return "<td>" + produitCell(h.product.id, h.product.name, h.product.price) + "</td><td class='num'>" +
          (h.product.stock !== undefined ? h.product.stock : "–") + "</td><td>" + status + "</td>";
      });
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
      return "<td class='mono'>" + esc(o.product_id) + "</td><td>" + T(o.action === "pin" ? "Épingler" : "Reléguer") +
        "</td><td>" + (o.position || "–") + "</td><td style='white-space:nowrap;'>" +
        "<button type='button' class='catalog-rule-remove' data-edit-override='1' data-product-id='" + esc(o.product_id) + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' aria-label='" + T("Modifier") + "' title='" + T("Modifier") + "' style='margin-right:6px;'>&#9998;</button>" +
        "<button type='button' class='catalog-rule-remove' data-duplicate-override='1' data-product-id='" + esc(o.product_id) + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' aria-label='" + T("Dupliquer") + "' title='" + T("Dupliquer") + "' style='margin-right:6px;'>&#10697;</button>" +
        "<button type='button' class='catalog-rule-remove' data-remove-override='" + esc(o.product_id) + "' aria-label='" + T("Retirer") + "'>&times;</button></td>";
    });
    var panneau = document.getElementById("bo-rules-panel");
    if (panneau) panneau.classList.toggle("so-rules-draft", !!enBrouillon);
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
          T(r.action === "boost" ? "Booster" : "Reléguer") + "</td><td style='white-space:nowrap;'>" +
          "<button type='button' class='catalog-rule-remove' data-edit-attribute='1' data-field='" + esc(r.field) + "' data-value='" + esc(r.value) + "' data-action='" + esc(r.action) + "' aria-label='" + T("Modifier") + "' title='" + T("Modifier") + "' style='margin-right:6px;'>&#9998;</button>" +
          "<button type='button' class='catalog-rule-remove' data-duplicate-attribute='1' data-field='" + esc(r.field) + "' data-value='" + esc(r.value) + "' data-action='" + esc(r.action) + "' aria-label='" + T("Dupliquer") + "' title='" + T("Dupliquer") + "' style='margin-right:6px;'>&#10697;</button>" +
          "<button type='button' class='catalog-rule-remove' " +
          "data-remove-attribute-field='" + esc(r.field) + "' data-remove-attribute-value='" + esc(r.value) + "' aria-label='" + T("Retirer") + "'>&times;</button></td>";
      });
    }).catch(function () {});
  }

  function resetBrowseOverrideForm() {
    boEditingProductId = null;
    document.getElementById("browse-override-product-id").value = "";
    document.getElementById("browse-override-action").value = "pin";
    document.getElementById("browse-override-position").value = "";
    document.getElementById("bo-form-title").textContent = T("Ajouter une priorité");
    document.getElementById("bo-submit-btn").textContent = T("Ajouter la priorité");
    document.getElementById("bo-cancel-edit-btn").hidden = true;
  }

  function resetAttributeRuleForm() {
    barEditingKey = null;
    document.getElementById("browse-attribute-field").value = "";
    document.getElementById("browse-attribute-value").value = "";
    document.getElementById("browse-attribute-action").value = "boost";
    document.getElementById("bar-form-title").textContent = T("Ajouter une règle");
    document.getElementById("bar-submit-btn").textContent = T("Ajouter la règle");
    document.getElementById("bar-cancel-edit-btn").hidden = true;
  }

  function wireBrowseForms(key) {
    if (browseFormsWired) return;
    browseFormsWired = true;

    document.getElementById("browse-category-select").addEventListener("change", function () { onBrowseCategoryChange(key); });
    wireBrowseEditeur(key);
    var browseLim = document.getElementById("browse-preview-limit");
    if (browseLim) browseLim.addEventListener("change", function () { refreshBrowsePreview(key); });
    var brStock = document.getElementById("browse-in-stock");
    if (brStock) brStock.addEventListener("change", function () {
      if (session.brDraft) brSimuler(key); else refreshBrowsePreview(key);
    });
    document.getElementById("browse-sort-select").addEventListener("change", function () { refreshBrowsePreview(key); });
    document.getElementById("browse-attribute-field").addEventListener("input", onBrowseFieldInput);
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
        document.getElementById("browse-override-action").value = src.getAttribute("data-action");
        document.getElementById("browse-override-position").value = src.getAttribute("data-position") || "";
        document.getElementById("bo-form-title").textContent = editBtn ? T("Modifier la priorité") : T("Dupliquer — modifiez au moins un champ");
        document.getElementById("bo-submit-btn").textContent = editBtn ? T("Enregistrer les modifications") : T("Créer cette priorité");
        document.getElementById("bo-cancel-edit-btn").hidden = false;
        document.getElementById("browse-override-product-id").scrollIntoView({ behavior: "smooth", block: "center" });
        if (dupBtn) { document.getElementById("browse-override-product-id").focus(); document.getElementById("browse-override-product-id").select(); }
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
      if (!field || !value) return;
      var base = "/v1/browse/" + encodeURIComponent(session.browseCurrentCatalog) + "/" + encodeURIComponent(session.browseCurrentCategory) + "/attribute-rules";

      var needsCleanup = barEditingKey && (barEditingKey.field !== field || barEditingKey.value !== value);
      var chain = needsCleanup
        ? apiFetch(base + "?field=" + encodeURIComponent(barEditingKey.field) + "&value=" + encodeURIComponent(barEditingKey.value), key, { method: "DELETE" })
            .then(function () { return apiFetch(base, key, { method: "POST", body: { field: field, value: value, action: action } }); })
        : apiFetch(base, key, { method: "POST", body: { field: field, value: value, action: action } });

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
        document.getElementById("browse-attribute-value").value = src.getAttribute("data-value");
        document.getElementById("browse-attribute-action").value = src.getAttribute("data-action");
        document.getElementById("bar-form-title").textContent = editBtn ? T("Modifier la règle") : T("Dupliquer — modifiez au moins un champ");
        document.getElementById("bar-submit-btn").textContent = editBtn ? T("Enregistrer les modifications") : T("Créer cette règle");
        document.getElementById("bar-cancel-edit-btn").hidden = false;
        document.getElementById("browse-attribute-field").scrollIntoView({ behavior: "smooth", block: "center" });
        if (dupBtn) { document.getElementById("browse-attribute-field").focus(); document.getElementById("browse-attribute-field").select(); }
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
      var cleFaite = !!(data.public_keys && data.public_keys.length > 0);
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
      var reduite = localStorage.getItem(ACTIVATION_REDUITE_KEY) === "1";
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

  function loadDashboard(key, days) {
    dashLoading.hidden = false;
    dashContent.hidden = true;

    apiFetch("/v1/index/catalogs", key).then(function (data) {
      var hasCatalogs = data.catalogs && data.catalogs.length > 0;
      document.getElementById("overview-empty-state").hidden = hasCatalogs;
      document.getElementById("overview-stats-content").hidden = !hasCatalogs;
    }).catch(function () {
      // En cas d'echec de cet appel precis, ne bloque pas le reste du
      // dashboard -- on affiche le contenu normal par defaut plutot que
      // de laisser l'ecran vide sur une erreur secondaire.
      document.getElementById("overview-empty-state").hidden = true;
      document.getElementById("overview-stats-content").hidden = false;
    });

    // Correctif B5 (audit UX console, 17 aout 2026) : le catalogue actif
    // n'etait jamais transmis a ces trois endpoints -- toutes les
    // recherches/erreurs d'un compte se melangeaient entre catalogues,
    // quel que soit le catalogue selectionne ici. session.catalogueActif
    // sert deja pour d'autres appels (synonymes) plus bas dans ce fichier.
    var catalogQS = "&catalog=" + encodeURIComponent(session.catalogueActif);
    Promise.all([
      apiFetch("/v1/analytics/summary?days=" + days, key),
      apiFetch("/v1/analytics/top-queries?days=" + days + "&limit=15" + catalogQS, key),
      apiFetch("/v1/analytics/zero-results?days=" + days + "&limit=15" + catalogQS, key),
      apiFetch("/v1/analytics/errors?days=" + days + "&limit=10" + catalogQS, key),
      apiFetch("/v1/usage", key),
    ]).then(function (results) {
      var summary = results[0], topQueries = results[1].queries, zeroResults = results[2].queries,
          errors = results[3].errors, usage = results[4];

      renderStats(summary, usage);
      renderChart(summary.daily_searches);

      renderTable("top-queries-table", "top-queries-empty", topQueries, function (q) {
        return "<td>" + esc(q.query) + "</td><td class='num'>" + q.count + "</td><td>" + q.avg_results + "</td>";
      });
      renderTable("zero-results-table", "zero-results-empty", zeroResults, function (q) {
        return "<td>" + esc(q.query) + "</td><td class='num'>" + q.count +
               "</td><td class='zr-action-cell'>" +
               "<button type='button' class='zr-suggerer' data-terme='" +
               esc(q.query) + "'>" + T("Corriger") + "</button>" +
               "<span class='zr-suggestions' hidden></span></td>";
      });
      wireSuggestionsSynonymes(key);
      _dernieresErreurs = errors || [];
      majSignalementErreurs(errors);
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
      wireBrowseForms(key);
      loadSearchOverridesCatalogs(key);
      wireSearchOverridesPane(key);
      wirePublicKeys(key);
      wireCategoryViews(key);
      wireRelatedProducts(key);
      wireTutoEditeur(["so-tuto", "br-tuto"]);
      session.cleCourante = key;
      // EXPOSITION POUR LES MODULES. L'import CSV est un module ES,
      // chargé séparément : il n'a pas accès aux variables de cette
      // fonction anonyme. Sans cela, il utilisait le jeton de SESSION,
      // qui n'autorise pas l'indexation — « Invalid API key ».
      window.HEURIX_CLE_API = key;
      // Permet aux modules ES — l'import CSV — de rafraichir la liste des
      // catalogues apres avoir cree le leur, sans recharger la page.
      window.HEURIX_RECHARGER_CATALOGUES = function () { loadCatalogs(key); };
      wireGlobalCatalog(key);
      wireBilling(key);
      wireCustomRulesPane(key);
    }).catch(function () {
      dashLoading.hidden = true;
      localStorage.removeItem(SESSION_STORAGE_KEY);
      session.activeKey = null;
      setAuthMode("login");
      showLogin(L.loginErrorNetwork);
    });
  }

  var AVAILABLE_RULEPACKS = [];

  function synGroupChipsHtml(groups) {
    return groups.map(function (g, i) {
      return '<span class="catalog-synonym-group" data-idx="' + i + '">' + esc(g.join(", ")) +
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

  function wireSynonymControls(cardEl, catalog, key) {
    var catalogName = catalog.catalog;
    var groupsEl = cardEl.querySelector(".catalog-synonym-groups");
    var input = cardEl.querySelector(".catalog-synonym-input");
    var addBtn = cardEl.querySelector(".catalog-synonym-add-btn");
    var currentGroups = [];

    function render() { groupsEl.innerHTML = synGroupChipsHtml(currentGroups); wireRemoveButtons(); }

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
      saveGroups(currentGroups.concat([terms]))
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
    if (!rules.length) return '<p class="catalog-rules-empty">' + T("Aucune règle personnalisée pour l'instant.") + '</p>';
    return rules.map(function (r) {
      var kw = (r.keywords || []).join(", ");
      return '<div class="catalog-rule-row" data-id="' + r.id + '">' +
        '<div><strong>' + esc(r.label) + '</strong><span class="catalog-rule-desc">' + ruleDescription(r) + '</span></div>' +
        '<div style="white-space:nowrap;">' +
        '<button type="button" class="catalog-rule-remove" data-edit-rule="1" data-id="' + r.id + '" data-rule-type="' + esc(r.rule_type) + '" data-label="' + esc(r.label) + '" data-keywords="' + esc(kw) + '" data-prefix="' + esc(r.prefix || "") + '" aria-label="' + T("Modifier") + '" title="' + T("Modifier") + '" style="margin-right:6px;">&#9998;</button>' +
        '<button type="button" class="catalog-rule-remove" data-duplicate-rule="1" data-rule-type="' + esc(r.rule_type) + '" data-label="' + esc(r.label) + '" data-keywords="' + esc(kw) + '" data-prefix="' + esc(r.prefix || "") + '" aria-label="' + T("Dupliquer") + '" title="' + T("Dupliquer") + '" style="margin-right:6px;">&#10697;</button>' +
        '<button type="button" class="catalog-rule-remove" data-id="' + r.id + '" aria-label="' + T("Retirer cette règle") + '">&times;</button>' +
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
      formTitle.textContent = T("Ajouter une règle");
      addBtn.textContent = T("Créer la règle");
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
              formTitle.textContent = isEdit ? T("Modifier la règle") : T("Dupliquer — modifiez au moins un champ");
              addBtn.textContent = isEdit ? T("Enregistrer les modifications") : T("Créer cette règle");
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
        status.textContent = T("Règle personnalisée enregistrée."); status.className = "catalog-rule-status ok";
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
              T("sur cet échantillon. Vos produits ne bénéficient d'aucune annotation — vérifiez que le pack correspond bien à votre secteur, ou créez des règles personnalisées.");
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
            esc(d.recommande) + "'>" + T("Sélectionner le pack {0}", esc(d.recommande)) + "</button>" +
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
          T("Supprimer le catalogue <strong>{0}</strong> et ses {1} produits ?<br>Les priorités, règles personnalisées et synonymes seront perdus. <strong>Cette action est irréversible.</strong>",
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
      '<div class="catalog-synonyms-label" style="margin-top:22px;">' + T("Synonymes et règles personnalisées") + '</div>' +
      '<p class="console-panel-note" style="margin:6px 0 0;">' + T("Gérés depuis") + ' <button type="button" class="catalog-goto-rules" data-goto-pane="pane-search-overrides">' + T("Configurer → Règles") + '</button>.</p>' +
      '<div class="catalog-card-danger">' +
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
        var sidebarSublabelVide = document.getElementById("sidebar-catalog-sublabel");
        if (sidebarSublabelVide) sidebarSublabelVide.hidden = true;
        return;
      }
      list.innerHTML = catalogs.map(catalogCardHtml).join("");
      var cardEls = list.querySelectorAll(".catalog-card");
      catalogs.forEach(function (c, i) { wireCatalogCard(cardEls[i], c, key); });

      var sidebarItems = document.getElementById("sidebar-catalog-items");
      var sidebarSublabel = document.getElementById("sidebar-catalog-sublabel");
      // Chantier navigation (8 août 2026) : separation visuelle entre
      // "Importer un fichier" (une action ponctuelle) et cette liste (une
      // vraie navigation vers chaque catalogue) -- jamais affiche sans
      // catalogue derriere, sinon un titre de section flotterait sans rien
      // dessous.
      if (sidebarSublabel) sidebarSublabel.hidden = false;
      sidebarItems.innerHTML = catalogs.map(function (c, i) {
        return '<button type="button" class="console-sidebar-item' + (i === 0 ? ' console-sidebar-item-on' : '') +
          '" data-pane="pane-catalog-list" data-catalog="' + esc(c.catalog) + '">' + esc(c.catalog) + '</button>';
      }).join("");
      // Un seul catalogue visible par defaut (le premier) -- coherent avec
      // le principe general "un pave a la fois", pas juste pour l'aide.
      cardEls.forEach(function (card, i) { card.hidden = i !== 0; });
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
    loadDashboard(key, periodSelect.value);
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
    if (session.activeKey) loadDashboard(session.activeKey, periodSelect.value);
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
          loadDashboard(session.activeKey, periodSelect.value);
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

