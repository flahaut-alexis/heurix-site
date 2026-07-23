// Heurix — Console client (FR)
// Se connecte avec une vraie clé API et appelle le vrai moteur en
// production (https://api.heurix.fr) — aucune donnée simulée ici,
// contrairement au widget de démonstration de la page d'accueil.
(function () {
  "use strict";

  var API_BASE = "https://api.heurix.fr";
  var SESSION_STORAGE_KEY = "heurix_console_session";

  var L = {
    loading: "Chargement des données…",
    loginErrorInvalid: "Email ou mot de passe incorrect.",
    loginErrorNetwork: "Impossible de joindre api.heurix.fr. Le service est peut-être temporairement indisponible.",
    zeroRate: function (n) { return Math.round(n * 100) + " %"; },
    dashTitle: function (label) { return label ? "Bonjour, " + label : "Tableau de bord"; },
    when: function (iso) {
      try {
        var d = new Date(iso);
        return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " à " +
               d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      } catch (e) { return iso; }
    }
  };

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

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
    "login": ["Votre tableau de bord.", "Mots les plus recherchés, recherches sans résultat, erreurs récentes, consommation — connectez-vous pour les consulter."],
    "signup": ["Créer votre compte.", "Une entreprise, un email, un mot de passe — votre clé API est générée immédiatement et envoyée par email."],
    "reset-request": ["Mot de passe oublié ?", "Indiquez votre email, on vous envoie un lien pour en choisir un nouveau."],
    "reset-confirm": ["Nouveau mot de passe.", "Choisissez un nouveau mot de passe pour votre compte."],
    "accept-invite": ["Rejoindre votre équipe.", "Dernière étape : choisissez votre mot de passe."]
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
    if (message) {
      loginError.textContent = message;
      loginError.hidden = false;
    }
  }

  function showDashboard() {
    loginScreen.hidden = true;
    dashboard.hidden = false;
  }

  function renderStats(summary, usage) {
    document.getElementById("stat-searches").textContent = summary.total_searches.toLocaleString("fr-FR");
    document.getElementById("stat-zero-rate").textContent = L.zeroRate(summary.zero_result_rate);
    document.getElementById("stat-errors").textContent = summary.total_errors.toLocaleString("fr-FR");
    document.getElementById("stat-usage").textContent = usage.requests.toLocaleString("fr-FR");
    var emailEl = document.getElementById("account-email");
    emailEl.textContent = usage.account_email ? "Connecté en tant que " + usage.account_email : "";
  }

  var keyDisplayWired = false;
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
        toggleBtn.setAttribute("aria-label", shown ? "Masquer la clé" : "Afficher la clé");
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
      var roleLabel = t.role === "admin" ? "Administrateur" : "Membre";
      var actions = "";
      if (isAdmin && t.email !== myEmail) {
        var toggleLabel = t.role === "admin" ? "Rétrograder" : "Promouvoir admin";
        var toggleRole = t.role === "admin" ? "member" : "admin";
        actions = '<div class="console-team-actions">' +
          '<button type="button" class="console-team-action" data-action="role" data-id="' + t.id + '" data-role="' + toggleRole + '">' + toggleLabel + '</button>' +
          '<button type="button" class="console-team-action console-team-action-danger" data-action="remove" data-id="' + t.id + '" data-email="' + esc(t.email) + '">Retirer</button>' +
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
          btn.disabled = true; btn.textContent = "Envoi…";
          inviteStatus.hidden = true;
          apiFetch("/v1/auth/invite", localStorage.getItem(SESSION_STORAGE_KEY), { method: "POST", body: { email: emailInput.value.trim() } })
            .then(function (r) {
              inviteStatus.textContent = "Invitation envoyée à " + r.invited + ".";
              inviteStatus.hidden = false;
              emailInput.value = "";
            })
            .catch(function (err) {
              inviteStatus.textContent = (err && err.message) || "Échec de l'envoi.";
              inviteStatus.hidden = false;
            })
            .then(function () { btn.disabled = false; btn.textContent = "Inviter"; });
        });
      }

      if (!companyFormWired) {
        companyFormWired = true;
        document.getElementById("company-form").addEventListener("submit", function (e) {
          e.preventDefault();
          var status = document.getElementById("company-status");
          companySaveBtn.disabled = true; companySaveBtn.textContent = "Enregistrement…";
          status.hidden = true;
          apiFetch("/v1/auth/company", localStorage.getItem(SESSION_STORAGE_KEY), {
            method: "PUT", body: { raison_sociale: raisonInput.value.trim(), numero_tva: tvaInput.value.trim() || null },
          }).then(function () {
            status.textContent = "Informations enregistrées.";
            status.hidden = false;
          }).catch(function (err) {
            status.textContent = (err && err.message) || "Échec de l'enregistrement.";
            status.hidden = false;
          }).then(function () {
            companySaveBtn.disabled = false; companySaveBtn.textContent = "Enregistrer";
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
            if (!window.confirm("Retirer " + email + " de l'équipe ? Cette personne perdra immédiatement l'accès.")) return;
            btn.disabled = true;
            apiFetch("/v1/auth/team/" + userId, token, { method: "DELETE" })
              .then(function () { loadAccountInfo(); })
              .catch(function () { btn.disabled = false; });
          }
        });
      }
    }).catch(function () {});
  }

  var ALL_PANE_IDS = ["pane-overview", "pane-top-queries", "pane-zero-results", "pane-errors", "pane-conversion",
    "pane-catalog-help", "pane-catalog-list", "pane-company", "pane-team", "pane-key", "pane-feedback"];

  function showPane(paneId) {
    ALL_PANE_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = id !== paneId;
    });
    document.querySelectorAll(".console-sidebar-item").forEach(function (btn) {
      btn.classList.toggle("console-sidebar-item-on", btn.getAttribute("data-pane") === paneId && !btn.hasAttribute("data-catalog"));
    });
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

  document.getElementById("feedback-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var status = document.getElementById("feedback-status");
    var btn = document.getElementById("feedback-submit-btn");
    var messageInput = document.getElementById("feedback-message");
    var message = messageInput.value.trim();
    if (!message) { messageInput.focus(); return; }
    btn.disabled = true; btn.textContent = "Envoi…";
    status.hidden = true;
    apiFetch("/v1/feedback", localStorage.getItem(SESSION_STORAGE_KEY), {
      method: "POST",
      body: { category: document.getElementById("feedback-category").value, message: message },
    }).then(function () {
      status.textContent = "Message envoyé — une réponse vous revient directement par email.";
      status.className = "console-form-status ok";
      status.hidden = false;
      messageInput.value = "";
    }).catch(function (err) {
      status.textContent = (err && err.message) || "Échec de l'envoi — réessayez, ou écrivez directement à contact@heurix.fr.";
      status.className = "console-form-status err";
      status.hidden = false;
    }).then(function () {
      btn.disabled = false; btn.textContent = "Envoyer";
    });
  });

  function renderChart(daily) {
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
    return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
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
      document.getElementById("conv-margin").textContent = summary.total_margin !== null ? eur(summary.total_margin) : "–";
      document.getElementById("conv-products").textContent = summary.products_purchased.toLocaleString("fr-FR");
      renderTable("top-products-table", "top-products-empty", products, function (p) {
        return "<td class='mono'>" + esc(p.product_id) + "</td><td class='num'>" + p.volume +
          "</td><td class='num'>" + eur(p.revenue) + "</td><td class='num'>" + (p.margin !== null ? eur(p.margin) : "–") + "</td>";
      });
    }).catch(function () {});

    if (!convSortWired) {
      convSortWired = true;
      document.getElementById("conv-sort-select").addEventListener("change", function () {
        if (activeKey) loadConversionData(activeKey);
      });
    }
  }

  function loadDashboard(key, days) {
    dashLoading.hidden = false;
    dashContent.hidden = true;

    Promise.all([
      apiFetch("/v1/analytics/summary?days=" + days, key),
      apiFetch("/v1/analytics/top-queries?days=" + days + "&limit=15", key),
      apiFetch("/v1/analytics/zero-results?days=" + days + "&limit=15", key),
      apiFetch("/v1/analytics/errors?days=" + days + "&limit=10", key),
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
        return "<td>" + esc(q.query) + "</td><td class='num'>" + q.count + "</td>";
      });
      renderTable("errors-table", "errors-empty", errors, function (e) {
        return "<td class='mono'>" + esc(e.endpoint) + "</td><td>" + e.status_code + "</td><td>" + esc(e.message) + "</td><td>" + L.when(e.at) + "</td>";
      });

      dashLoading.hidden = true;
      dashContent.hidden = false;
      renderApiKey(key);
      loadCatalogs(key);
      loadAccountInfo();
      loadConversionData(key);
    }).catch(function () {
      dashLoading.hidden = true;
      localStorage.removeItem(SESSION_STORAGE_KEY);
      activeKey = null;
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
          saveGroups(currentGroups.filter(function (_, i) { return i !== idx; })).catch(function () {});
        });
      });
    }

    addBtn.addEventListener("click", function () {
      var terms = input.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
      if (terms.length < 2) { input.focus(); return; }
      addBtn.disabled = true;
      saveGroups(currentGroups.concat([terms]))
        .then(function () { input.value = ""; })
        .catch(function () {})
        .then(function () { addBtn.disabled = false; });

    });

    apiFetch("/v1/index/" + encodeURIComponent(catalogName) + "/synonyms", key)
      .then(function (data) { currentGroups = data.groups; render(); })
      .catch(function () { groupsEl.innerHTML = ""; });
  }

  function ruleDescription(rule) {
    if (rule.rule_type === "keyword") {
      return "Si le texte contient " + rule.keywords.map(function (k) { return "« " + esc(k) + " »"; }).join(", ") + " → " + esc(rule.tag);
    }
    return "Si « " + esc(rule.prefix) + " » est suivi d'un nombre (ex. " + esc(rule.prefix) + "8) → " + esc(rule.tag) + "<em>nombre</em>";
  }

  function customRulesListHtml(rules) {
    if (!rules.length) return '<p class="catalog-rules-empty">Aucune règle personnalisée pour l\'instant.</p>';
    return rules.map(function (r) {
      return '<div class="catalog-rule-row" data-id="' + r.id + '">' +
        '<div><strong>' + esc(r.label) + '</strong><span class="catalog-rule-desc">' + ruleDescription(r) + '</span></div>' +
        '<button type="button" class="catalog-rule-remove" data-id="' + r.id + '" aria-label="Retirer cette règle">&times;</button>' +
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
    var status = cardEl.querySelector(".catalog-rule-status");

    function loadRules() {
      apiFetch("/v1/index/" + encodeURIComponent(catalogName) + "/custom-rules", key)
        .then(function (data) {
          listEl.innerHTML = customRulesListHtml(data.rules);
          listEl.querySelectorAll(".catalog-rule-remove").forEach(function (btn) {
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

    addBtn.addEventListener("click", function () {
      var body = { rule_type: typeSelect.value, label: labelInput.value.trim() };
      if (typeSelect.value === "keyword") {
        body.keywords = keywordsInput.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
      } else {
        body.prefix = prefixInput.value.trim();
      }
      if (!body.label) { labelInput.focus(); return; }
      addBtn.disabled = true; status.textContent = "Création…"; status.className = "catalog-rule-status";
      apiFetch("/v1/index/" + encodeURIComponent(catalogName) + "/custom-rules", key, { method: "POST", body: body })
        .then(function () {
          status.textContent = "Règle créée — produits réindexés."; status.className = "catalog-rule-status ok";
          labelInput.value = ""; keywordsInput.value = ""; prefixInput.value = "";
          loadRules();
          return apiFetch("/v1/index/" + encodeURIComponent(catalogName) + "/stats", key);
        })
        .then(function (stats) { catalog.annotations = stats.annotations; updateCardMeta(cardEl, catalog); })
        .catch(function (err) {
          status.textContent = (err && err.message) || "Échec de la création.";
          status.className = "catalog-rule-status err";
        })
        .then(function () { addBtn.disabled = false; });
    });

    loadRules();
  }

  function wireCatalogCard(cardEl, catalog, key) {
    var select = cardEl.querySelector(".catalog-rulepack-select");
    var saveBtn = cardEl.querySelector(".catalog-rulepack-save");
    var status = cardEl.querySelector(".catalog-rulepack-status");
    saveBtn.addEventListener("click", function () {
      if (select.value === catalog.rulepack) return;
      saveBtn.disabled = true;
      status.className = "catalog-rulepack-status"; status.textContent = "Réindexation…";
      apiFetch("/v1/index/" + encodeURIComponent(catalog.catalog) + "/config", key, {
        method: "PUT", body: { rulepack: select.value },
      }).then(function (data) {
        catalog.rulepack = data.rulepack;
        catalog.products = data.products; catalog.annotations = data.annotations; catalog.synonym_groups = data.synonym_groups;
        status.className = "catalog-rulepack-status ok"; status.textContent = "Enregistré — produits réindexés.";
        updateCardMeta(cardEl, catalog);
      }).catch(function () {
        status.className = "catalog-rulepack-status err"; status.textContent = "Échec — réessayez.";
      }).then(function () { saveBtn.disabled = false; });
    });
    wireSynonymControls(cardEl, catalog, key);
    wireCustomRuleControls(cardEl, catalog, key);
  }

  function catalogCardHtml(c) {
    var options = AVAILABLE_RULEPACKS.map(function (rp) {
      return '<option value="' + esc(rp) + '"' + (rp === c.rulepack ? " selected" : "") + '>' + esc(rp) + '</option>';
    }).join("");
    return '<div class="catalog-card" data-catalog-card="' + esc(c.catalog) + '">' +
      '<div class="catalog-card-head"><span class="catalog-card-name">' + esc(c.catalog) + '</span></div>' +
      '<div class="catalog-card-meta">' + c.products + ' produit' + (c.products > 1 ? 's' : '') + ' · ' +
        c.annotations + ' annotations · ' + c.synonym_groups + ' groupe' + (c.synonym_groups > 1 ? 's' : '') + ' de synonymes</div>' +
      '<div class="catalog-card-row">' +
        '<label>Pack de règles</label>' +
        '<select class="catalog-rulepack-select">' + options + '</select>' +
        '<button type="button" class="catalog-rulepack-save">Enregistrer</button>' +
        '<span class="catalog-rulepack-status"></span>' +
      '</div>' +
      '<div class="catalog-synonyms-label">Synonymes</div>' +
      '<div class="catalog-synonym-groups"></div>' +
      '<div class="catalog-synonym-add">' +
        '<input type="text" placeholder="ex. vis, boulon, screw" class="catalog-synonym-input">' +
        '<button type="button" class="catalog-synonym-add-btn">Ajouter un groupe</button>' +
      '</div>' +
      '<div class="catalog-synonyms-label" style="margin-top:22px;">Règles personnalisées</div>' +
      '<div class="catalog-rules-list"></div>' +
      '<div class="catalog-rule-add">' +
        '<div class="catalog-rule-add-row">' +
          '<select class="catalog-rule-type">' +
            '<option value="keyword">Mot-clé → étiquette</option>' +
            '<option value="prefix_number">Préfixe + nombre → étiquette</option>' +
          '</select>' +
          '<input type="text" placeholder="Nom de la règle, ex. Cheville" class="catalog-rule-label">' +
        '</div>' +
        '<input type="text" placeholder="Mots équivalents, ex. placo, cheville, molly" class="catalog-rule-keywords">' +
        '<input type="text" placeholder="Préfixe à reconnaître, ex. M (pour M8, M10…)" class="catalog-rule-prefix" hidden>' +
        '<button type="button" class="catalog-rule-add-btn">Créer la règle</button>' +
        '<span class="catalog-rule-status"></span>' +
      '</div>' +
    '</div>';
  }

  function loadCatalogs(key) {
    var loading = document.getElementById("catalogs-loading");
    var list = document.getElementById("catalogs-list");
    var empty = document.getElementById("catalogs-empty");
    loading.hidden = false; list.innerHTML = ""; empty.hidden = true;

    Promise.all([
      apiFetch("/v1/index/catalogs", key),
      AVAILABLE_RULEPACKS.length ? Promise.resolve({ rulepacks: AVAILABLE_RULEPACKS.map(function (n) { return { name: n }; }) }) : apiFetch("/v1/rulepacks", key),
    ]).then(function (results) {
      var catalogs = results[0].catalogs;
      AVAILABLE_RULEPACKS = results[1].rulepacks.map(function (r) { return r.name; });
      loading.hidden = true;
      if (!catalogs.length) { empty.hidden = false; return; }
      list.innerHTML = catalogs.map(catalogCardHtml).join("");
      var cardEls = list.querySelectorAll(".catalog-card");
      catalogs.forEach(function (c, i) { wireCatalogCard(cardEls[i], c, key); });

      var sidebarItems = document.getElementById("sidebar-catalog-items");
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
      empty.textContent = "Impossible de charger vos catalogues pour le moment.";
    });
  }

  var activeKey = null;

  function startSession(sessionToken, key) {
    localStorage.setItem(SESSION_STORAGE_KEY, sessionToken);
    activeKey = key;
    showDashboard();
    loadDashboard(key, periodSelect.value);
    dashboard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function endSession() {
    var token = localStorage.getItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    activeKey = null;
    if (token) {
      fetch(API_BASE + "/v1/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + token } }).catch(function () {});
    }
    setAuthMode("login");
    loginForm.reset();
    showLogin();
  }

  // ---------------- Connexion ----------------
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginBtn.disabled = true;
    loginBtn.textContent = "Connexion…";
    loginError.hidden = true;
    apiPost("/v1/auth/login", { email: loginEmail.value.trim(), password: loginPassword.value })
      .then(function (data) {
        if (!data.keys || !data.keys.length) {
          showLogin("Ce compte n'a pas encore de clé API associée. Contactez le support.");
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
        loginBtn.textContent = "Se connecter";
      });
  });

  // ---------------- Création de compte ----------------
  signupForm.addEventListener("submit", function (e) {
    e.preventDefault();
    signupBtn.disabled = true;
    signupBtn.textContent = "Création…";
    signupError.hidden = true;
    apiPost("/v1/auth/signup", {
      email: signupEmail.value.trim(), password: signupPassword.value,
      raison_sociale: signupRaisonSociale.value.trim(),
      numero_tva: signupTva.value.trim() || null,
    })
      .then(function (data) {
        startSession(data.session_token, data.key);
      })
      .catch(function (err) {
        signupError.textContent = (err && err.message) || L.loginErrorNetwork;
        signupError.hidden = false;
      })
      .then(function () {
        signupBtn.disabled = false;
        signupBtn.textContent = "Créer mon compte";
      });
  });

  // ---------------- Acceptation d'une invitation d'équipe ----------------
  var inviteTokenFromUrl = new URLSearchParams(window.location.search).get("invite");

  acceptInviteForm.addEventListener("submit", function (e) {
    e.preventDefault();
    acceptInviteBtn.disabled = true;
    acceptInviteBtn.textContent = "Connexion…";
    acceptInviteError.hidden = true;
    apiPost("/v1/auth/accept-invite", { token: inviteTokenFromUrl, password: acceptInvitePassword.value })
      .then(function (data) {
        history.replaceState(null, "", window.location.pathname);
        startSession(data.session_token, data.keys[0].key);
      })
      .catch(function (err) {
        acceptInviteError.textContent = (err && err.message) || L.loginErrorNetwork;
        acceptInviteError.hidden = false;
      })
      .then(function () {
        acceptInviteBtn.disabled = false;
        acceptInviteBtn.textContent = "Rejoindre l'équipe";
      });
  });

  // ---------------- Mot de passe oublié ----------------
  resetRequestForm.addEventListener("submit", function (e) {
    e.preventDefault();
    resetRequestBtn.disabled = true;
    resetRequestBtn.textContent = "Envoi…";
    apiPost("/v1/auth/request-password-reset", { email: resetEmail.value.trim() })
      .then(function () {
        resetRequestMsg.textContent = "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.";
        resetRequestMsg.hidden = false;
        resetRequestForm.reset();
      })
      .catch(function () {
        resetRequestMsg.textContent = L.loginErrorNetwork;
        resetRequestMsg.hidden = false;
      })
      .then(function () {
        resetRequestBtn.disabled = false;
        resetRequestBtn.textContent = "Envoyer le lien";
      });
  });

  // ---------------- Nouveau mot de passe (lien reçu par email) ----------------
  var resetTokenFromUrl = new URLSearchParams(window.location.search).get("reset");

  resetConfirmForm.addEventListener("submit", function (e) {
    e.preventDefault();
    resetConfirmBtn.disabled = true;
    resetConfirmBtn.textContent = "Réinitialisation…";
    resetConfirmError.hidden = true;
    apiPost("/v1/auth/confirm-password-reset", { token: resetTokenFromUrl, password: resetNewPassword.value })
      .then(function () {
        history.replaceState(null, "", window.location.pathname);  // retire ?reset=... de l'URL
        setAuthMode("login");
        loginError.textContent = "Mot de passe mis à jour — vous pouvez vous connecter.";
        loginError.hidden = false;
      })
      .catch(function (err) {
        resetConfirmError.textContent = (err && err.message) || L.loginErrorNetwork;
        resetConfirmError.hidden = false;
      })
      .then(function () {
        resetConfirmBtn.disabled = false;
        resetConfirmBtn.textContent = "Réinitialiser mon mot de passe";
      });
  });

  // ---------------- Bascule entre les modes ----------------
  showSignupLink.addEventListener("click", function (e) { e.preventDefault(); setAuthMode("signup"); });
  showResetLink.addEventListener("click", function (e) { e.preventDefault(); setAuthMode("reset-request"); });
  showLoginLink.addEventListener("click", function (e) { e.preventDefault(); setAuthMode("login"); });

  logoutBtn.addEventListener("click", endSession);

  periodSelect.addEventListener("change", function () {
    if (activeKey) loadDashboard(activeKey, periodSelect.value);
  });

  // ---------------- Point d'entrée ----------------
  if (inviteTokenFromUrl) {
    // Une invitation prime aussi — quelqu'un qui clique un lien d'équipe
    // ne doit jamais retomber sur un vieux formulaire de connexion.
    setAuthMode("accept-invite");
    fetch(API_BASE + "/v1/auth/invite/" + encodeURIComponent(inviteTokenFromUrl))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        acceptInviteIntro.textContent = data.raison_sociale
          ? "Vous rejoignez l'équipe de " + data.raison_sociale + " (" + data.email + ")."
          : "Invitation pour " + data.email + ".";
      })
      .catch(function () {
        acceptInviteIntro.textContent = "Ce lien d'invitation semble invalide ou expiré.";
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
          activeKey = data.keys[0].key;
          showDashboard();
          loadDashboard(activeKey, periodSelect.value);
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

