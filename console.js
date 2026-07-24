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

  var ALL_PANE_IDS = ["pane-overview", "pane-guides", "pane-top-queries", "pane-zero-results", "pane-errors", "pane-search-overrides", "pane-conversion",
    "pane-browse", "pane-catalog-help", "pane-catalog-list", "pane-company", "pane-team", "pane-key", "pane-feedback"];

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
      document.getElementById("conv-products").textContent = summary.products_purchased.toLocaleString("fr-FR");

      var attributedEl = document.getElementById("conv-attributed");
      var attributedLabel = document.getElementById("conv-attributed-label");
      if (summary.attributed_revenue === null) {
        attributedEl.textContent = "–";
        attributedLabel.textContent = "CA réellement attribué (tracker non installé)";
      } else {
        attributedEl.textContent = eur(summary.attributed_revenue);
        attributedLabel.textContent = "CA réellement attribué";
      }

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

  // ---------------- Browse & Discovery ----------------
  var browseCatalogsLoaded = false;
  var browseCurrentCatalog = "";
  var browseCurrentCategory = "";
  var browseAttributesCache = [];
  var browseFormsWired = false;

  // ---------------- Search : priorites de requete ----------------
  var soCatalogsLoaded = false;
  var soCurrentCatalog = "";
  var soEditingKey = null; // {query, product_id} si en cours de modification, sinon null (ajout ou duplication)
  var soFormWired = false;

  function loadSearchOverridesCatalogs(key) {
    if (soCatalogsLoaded) return;
    soCatalogsLoaded = true;
    apiFetch("/v1/index/catalogs", key).then(function (data) {
      var select = document.getElementById("so-catalog-select");
      data.catalogs.forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c.catalog; opt.textContent = c.catalog;
        select.appendChild(opt);
      });
    }).catch(function () {});
  }

  function resetSoForm() {
    soEditingKey = null;
    document.getElementById("so-query").value = "";
    document.getElementById("so-product-id").value = "";
    document.getElementById("so-action").value = "pin";
    document.getElementById("so-position").hidden = false;
    document.getElementById("so-position").value = "";
    document.getElementById("so-form-title").textContent = "Ajouter une priorité";
    document.getElementById("so-submit-btn").textContent = "Ajouter la priorité";
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
    var actionLabel = o.action === "pin" ? "Épingler" : "Reléguer";
    return "<td class='mono'>" + esc(o.query) + "</td>" +
      "<td class='mono'>" + esc(o.product_id) + "</td>" +
      "<td>" + actionLabel + "</td>" +
      "<td>" + (o.position || "–") + "</td>" +
      "<td style='white-space:nowrap;'>" +
        "<button type='button' class='catalog-rule-remove' data-so-edit='1' data-query='" + esc(o.query) + "' data-product-id='" + esc(o.product_id) + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' aria-label='Modifier' title='Modifier' style='margin-right:6px;'>&#9998;</button>" +
        "<button type='button' class='catalog-rule-remove' data-so-duplicate='1' data-query='" + esc(o.query) + "' data-product-id='" + esc(o.product_id) + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' aria-label='Dupliquer' title='Dupliquer comme nouvelle règle' style='margin-right:6px;'>&#10697;</button>" +
        "<button type='button' class='catalog-rule-remove' data-so-delete='1' data-query='" + esc(o.query) + "' data-product-id='" + esc(o.product_id) + "' aria-label='Supprimer'>&times;</button>" +
      "</td>";
  }

  function refreshSoTable(key) {
    apiFetch("/v1/index/" + encodeURIComponent(soCurrentCatalog) + "/search-overrides", key)
      .then(function (data) { renderTable("so-table", "so-empty", data.overrides, soRowHtml); })
      .catch(function () {});
  }

  function onSoCatalogChange(key) {
    soCurrentCatalog = document.getElementById("so-catalog-select").value;
    var content = document.getElementById("so-content");
    if (!soCurrentCatalog) { content.hidden = true; return; }
    content.hidden = false;
    resetSoForm();
    refreshSoTable(key);
  }

  function wireSearchOverridesPane(key) {
    if (soFormWired) return;
    soFormWired = true;

    document.getElementById("so-catalog-select").addEventListener("change", function () { onSoCatalogChange(key); });
    document.getElementById("so-action").addEventListener("change", function (e) {
      document.getElementById("so-position").hidden = e.target.value !== "pin";
    });
    document.getElementById("so-cancel-edit-btn").addEventListener("click", resetSoForm);

    document.getElementById("so-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var status = document.getElementById("so-status");
      var query = document.getElementById("so-query").value.trim();
      var productId = document.getElementById("so-product-id").value.trim();
      var action = document.getElementById("so-action").value;
      if (!query || !productId) return;
      var body = { query: query, product_id: productId, action: action };
      if (action === "pin") {
        var pos = parseInt(document.getElementById("so-position").value, 10);
        if (!pos) { document.getElementById("so-position").focus(); return; }
        body.position = pos;
      }

      var submitBtn = document.getElementById("so-submit-btn");
      submitBtn.disabled = true;
      status.textContent = "Enregistrement…"; status.className = "catalog-rule-status";

      var createOrUpdate = function () {
        return apiFetch("/v1/index/" + encodeURIComponent(soCurrentCatalog) + "/search-overrides", key, { method: "POST", body: body });
      };

      // Modification ou l'utilisateur a change la requete/le produit : l'ancienne
      // cle n'existe plus sous ce nom, il faut la retirer avant de creer la nouvelle
      // (sinon deux regles distinctes coexistent au lieu d'une seule modifiee).
      var needsCleanupFirst = soEditingKey && (soEditingKey.query !== query || soEditingKey.productId !== productId);
      var chain = needsCleanupFirst
        ? apiFetch("/v1/index/" + encodeURIComponent(soCurrentCatalog) + "/search-overrides" +
            "?query=" + encodeURIComponent(soEditingKey.query) + "&product_id=" + encodeURIComponent(soEditingKey.productId),
            key, { method: "DELETE" }).then(createOrUpdate)
        : createOrUpdate();

      chain
        .then(function () {
          status.textContent = "Enregistré."; status.className = "catalog-rule-status ok";
          resetSoForm();
          refreshSoTable(key);
        })
        .catch(function (err) {
          status.textContent = (err && err.message) || "Échec de l'enregistrement.";
          status.className = "catalog-rule-status err";
        })
        .then(function () { submitBtn.disabled = false; });
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
        document.getElementById("so-form-title").textContent = "Modifier la priorité";
        document.getElementById("so-submit-btn").textContent = "Enregistrer les modifications";
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
        document.getElementById("so-form-title").textContent = "Dupliquer une priorité — modifiez au moins un champ";
        document.getElementById("so-submit-btn").textContent = "Créer cette priorité";
        document.getElementById("so-cancel-edit-btn").hidden = false;
        document.getElementById("so-query").focus();
        document.getElementById("so-query").select();
        return;
      }
      if (delBtn) {
        delBtn.disabled = true;
        var url = "/v1/index/" + encodeURIComponent(soCurrentCatalog) + "/search-overrides" +
          "?query=" + encodeURIComponent(delBtn.getAttribute("data-query")) +
          "&product_id=" + encodeURIComponent(delBtn.getAttribute("data-product-id"));
        apiFetch(url, key, { method: "DELETE" }).then(function () { refreshSoTable(key); }).catch(function () { delBtn.disabled = false; });
      }
    });
  }

  function loadBrowseCatalogs(key) {
    if (browseCatalogsLoaded) return;
    browseCatalogsLoaded = true;
    apiFetch("/v1/index/catalogs", key).then(function (data) {
      var select = document.getElementById("browse-catalog-select");
      data.catalogs.forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c.catalog; opt.textContent = c.catalog;
        select.appendChild(opt);
      });
    }).catch(function () {});
  }

  function onBrowseCatalogChange(key) {
    var catalog = document.getElementById("browse-catalog-select").value;
    browseCurrentCatalog = catalog; browseCurrentCategory = "";
    var categorySelect = document.getElementById("browse-category-select");
    document.getElementById("browse-content").hidden = true;
    document.getElementById("browse-no-categories").hidden = true;
    if (!catalog) {
      categorySelect.disabled = true;
      categorySelect.innerHTML = '<option value="">— Choisir un catalogue d\'abord —</option>';
      return;
    }
    categorySelect.disabled = false;
    categorySelect.innerHTML = '<option value="">Chargement…</option>';
    Promise.all([
      apiFetch("/v1/index/" + encodeURIComponent(catalog) + "/browse-categories", key),
      apiFetch("/v1/index/" + encodeURIComponent(catalog) + "/browse-attributes", key),
    ]).then(function (results) {
      var categories = results[0].categories;
      browseAttributesCache = results[1].attributes;
      if (!categories.length) {
        categorySelect.innerHTML = '<option value="">— Aucune catégorie —</option>';
        document.getElementById("browse-no-categories").hidden = false;
        return;
      }
      categorySelect.innerHTML = '<option value="">— Choisir —</option>' + categories.map(function (c) {
        return "<option value='" + esc(c.category) + "'>" + esc(c.category) + " (" + c.products + ")</option>";
      }).join("");
      document.getElementById("browse-known-fields").innerHTML = browseAttributesCache.map(function (a) {
        return "<option value='" + esc(a.field) + "'>";
      }).join("");
    }).catch(function () {
      categorySelect.innerHTML = '<option value="">— Erreur de chargement —</option>';
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
    browseCurrentCategory = document.getElementById("browse-category-select").value;
    var content = document.getElementById("browse-content");
    if (!browseCurrentCategory) { content.hidden = true; return; }
    content.hidden = false;
    resetBrowseOverrideForm();
    resetAttributeRuleForm();
    refreshBrowseAll(key);
  }

  function refreshBrowseAll(key) {
    refreshBrowsePreview(key);
    refreshBrowseOverrides(key);
    refreshBrowseAttributeRules(key);
  }

  function refreshBrowsePreview(key) {
    var sort = document.getElementById("browse-sort-select").value;
    var url = "/v1/browse/" + encodeURIComponent(browseCurrentCatalog) + "/" + encodeURIComponent(browseCurrentCategory) + "?sort=" + sort;
    apiFetch(url, key).then(function (data) {
      renderTable("browse-preview-table", "browse-preview-empty", data.hits, function (h) {
        var status = h.pinned ? "Épinglé" : h.boosted ? "Boosté" : h.buried ? "Relégué" : "—";
        return "<td class='mono'>" + esc(h.product.id) + "</td><td class='num'>" +
          (h.product.stock !== undefined ? h.product.stock : "–") + "</td><td>" + status + "</td>";
      });
    }).catch(function () {});
  }

  var boEditingProductId = null; // produit en cours de modification (priorites par produit), null = ajout/duplication
  var barEditingKey = null; // {field, value} en cours de modification (regles par attribut), null = ajout/duplication

  function refreshBrowseOverrides(key) {
    var url = "/v1/browse/" + encodeURIComponent(browseCurrentCatalog) + "/" + encodeURIComponent(browseCurrentCategory) + "/overrides";
    apiFetch(url, key).then(function (data) {
      renderTable("browse-overrides-table", "browse-overrides-empty", data.overrides, function (o) {
        return "<td class='mono'>" + esc(o.product_id) + "</td><td>" + (o.action === "pin" ? "Épingler" : "Reléguer") +
          "</td><td>" + (o.position || "–") + "</td><td style='white-space:nowrap;'>" +
          "<button type='button' class='catalog-rule-remove' data-edit-override='1' data-product-id='" + esc(o.product_id) + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' aria-label='Modifier' title='Modifier' style='margin-right:6px;'>&#9998;</button>" +
          "<button type='button' class='catalog-rule-remove' data-duplicate-override='1' data-product-id='" + esc(o.product_id) + "' data-action='" + esc(o.action) + "' data-position='" + (o.position || "") + "' aria-label='Dupliquer' title='Dupliquer' style='margin-right:6px;'>&#10697;</button>" +
          "<button type='button' class='catalog-rule-remove' data-remove-override='" + esc(o.product_id) + "' aria-label='Retirer'>&times;</button></td>";
      });
    }).catch(function () {});
  }

  function refreshBrowseAttributeRules(key) {
    var url = "/v1/browse/" + encodeURIComponent(browseCurrentCatalog) + "/" + encodeURIComponent(browseCurrentCategory) + "/attribute-rules";
    apiFetch(url, key).then(function (data) {
      renderTable("browse-attribute-rules-table", "browse-attribute-rules-empty", data.rules, function (r) {
        return "<td class='mono'>" + esc(r.field) + "</td><td class='mono'>" + esc(r.value) + "</td><td>" +
          (r.action === "boost" ? "Booster" : "Reléguer") + "</td><td style='white-space:nowrap;'>" +
          "<button type='button' class='catalog-rule-remove' data-edit-attribute='1' data-field='" + esc(r.field) + "' data-value='" + esc(r.value) + "' data-action='" + esc(r.action) + "' aria-label='Modifier' title='Modifier' style='margin-right:6px;'>&#9998;</button>" +
          "<button type='button' class='catalog-rule-remove' data-duplicate-attribute='1' data-field='" + esc(r.field) + "' data-value='" + esc(r.value) + "' data-action='" + esc(r.action) + "' aria-label='Dupliquer' title='Dupliquer' style='margin-right:6px;'>&#10697;</button>" +
          "<button type='button' class='catalog-rule-remove' " +
          "data-remove-attribute-field='" + esc(r.field) + "' data-remove-attribute-value='" + esc(r.value) + "' aria-label='Retirer'>&times;</button></td>";
      });
    }).catch(function () {});
  }

  function resetBrowseOverrideForm() {
    boEditingProductId = null;
    document.getElementById("browse-override-product-id").value = "";
    document.getElementById("browse-override-action").value = "pin";
    document.getElementById("browse-override-position").value = "";
    document.getElementById("bo-form-title").textContent = "Ajouter une priorité";
    document.getElementById("bo-submit-btn").textContent = "Ajouter la priorité";
    document.getElementById("bo-cancel-edit-btn").hidden = true;
  }

  function resetAttributeRuleForm() {
    barEditingKey = null;
    document.getElementById("browse-attribute-field").value = "";
    document.getElementById("browse-attribute-value").value = "";
    document.getElementById("browse-attribute-action").value = "boost";
    document.getElementById("bar-form-title").textContent = "Ajouter une règle";
    document.getElementById("bar-submit-btn").textContent = "Ajouter la règle";
    document.getElementById("bar-cancel-edit-btn").hidden = true;
  }

  function wireBrowseForms(key) {
    if (browseFormsWired) return;
    browseFormsWired = true;

    document.getElementById("browse-catalog-select").addEventListener("change", function () { onBrowseCatalogChange(key); });
    document.getElementById("browse-category-select").addEventListener("change", function () { onBrowseCategoryChange(key); });
    document.getElementById("browse-sort-select").addEventListener("change", function () { refreshBrowsePreview(key); });
    document.getElementById("browse-attribute-field").addEventListener("input", onBrowseFieldInput);
    document.getElementById("bo-cancel-edit-btn").addEventListener("click", resetBrowseOverrideForm);
    document.getElementById("bar-cancel-edit-btn").addEventListener("click", resetAttributeRuleForm);

    document.getElementById("browse-override-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var status = document.getElementById("browse-override-status");
      var productId = document.getElementById("browse-override-product-id").value.trim();
      var action = document.getElementById("browse-override-action").value;
      var positionInput = document.getElementById("browse-override-position").value;
      if (!productId) return;
      var body = { product_id: productId, action: action };
      if (positionInput) body.position = parseInt(positionInput, 10);
      var base = "/v1/browse/" + encodeURIComponent(browseCurrentCatalog) + "/" + encodeURIComponent(browseCurrentCategory) + "/overrides";

      // Modification en changeant l'identifiant produit : l'ancienne cle n'existe
      // plus sous ce nom, il faut la retirer avant de creer la nouvelle.
      var needsCleanup = boEditingProductId && boEditingProductId !== productId;
      var chain = needsCleanup
        ? apiFetch(base + "/" + encodeURIComponent(boEditingProductId), key, { method: "DELETE" })
            .then(function () { return apiFetch(base, key, { method: "POST", body: body }); })
        : apiFetch(base, key, { method: "POST", body: body });

      chain.then(function () {
        status.textContent = "Enregistrée."; status.className = "catalog-rule-status ok";
        resetBrowseOverrideForm();
        refreshBrowseOverrides(key); refreshBrowsePreview(key);
      }).catch(function (err) {
        status.textContent = (err && err.message) || "Échec."; status.className = "catalog-rule-status err";
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
        document.getElementById("bo-form-title").textContent = editBtn ? "Modifier la priorité" : "Dupliquer — modifiez au moins un champ";
        document.getElementById("bo-submit-btn").textContent = editBtn ? "Enregistrer les modifications" : "Créer cette priorité";
        document.getElementById("bo-cancel-edit-btn").hidden = false;
        document.getElementById("browse-override-product-id").scrollIntoView({ behavior: "smooth", block: "center" });
        if (dupBtn) { document.getElementById("browse-override-product-id").focus(); document.getElementById("browse-override-product-id").select(); }
        return;
      }
      if (delBtn) {
        var pid = delBtn.getAttribute("data-remove-override");
        var url = "/v1/browse/" + encodeURIComponent(browseCurrentCatalog) + "/" + encodeURIComponent(browseCurrentCategory) + "/overrides/" + encodeURIComponent(pid);
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
      var base = "/v1/browse/" + encodeURIComponent(browseCurrentCatalog) + "/" + encodeURIComponent(browseCurrentCategory) + "/attribute-rules";

      var needsCleanup = barEditingKey && (barEditingKey.field !== field || barEditingKey.value !== value);
      var chain = needsCleanup
        ? apiFetch(base + "?field=" + encodeURIComponent(barEditingKey.field) + "&value=" + encodeURIComponent(barEditingKey.value), key, { method: "DELETE" })
            .then(function () { return apiFetch(base, key, { method: "POST", body: { field: field, value: value, action: action } }); })
        : apiFetch(base, key, { method: "POST", body: { field: field, value: value, action: action } });

      chain.then(function () {
        status.textContent = "Enregistrée."; status.className = "catalog-rule-status ok";
        resetAttributeRuleForm();
        refreshBrowseAttributeRules(key); refreshBrowsePreview(key);
      }).catch(function (err) {
        status.textContent = (err && err.message) || "Échec."; status.className = "catalog-rule-status err";
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
        document.getElementById("bar-form-title").textContent = editBtn ? "Modifier la règle" : "Dupliquer — modifiez au moins un champ";
        document.getElementById("bar-submit-btn").textContent = editBtn ? "Enregistrer les modifications" : "Créer cette règle";
        document.getElementById("bar-cancel-edit-btn").hidden = false;
        document.getElementById("browse-attribute-field").scrollIntoView({ behavior: "smooth", block: "center" });
        if (dupBtn) { document.getElementById("browse-attribute-field").focus(); document.getElementById("browse-attribute-field").select(); }
        return;
      }
      if (delBtn) {
        var field = delBtn.getAttribute("data-remove-attribute-field"), value = delBtn.getAttribute("data-remove-attribute-value");
        var url = "/v1/browse/" + encodeURIComponent(browseCurrentCatalog) + "/" + encodeURIComponent(browseCurrentCategory) +
          "/attribute-rules?field=" + encodeURIComponent(field) + "&value=" + encodeURIComponent(value);
        apiFetch(url, key, { method: "DELETE" }).then(function () { refreshBrowseAttributeRules(key); refreshBrowsePreview(key); }).catch(function () {});
      }
    });
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
      loadBrowseCatalogs(key);
      wireBrowseForms(key);
      loadSearchOverridesCatalogs(key);
      wireSearchOverridesPane(key);
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

