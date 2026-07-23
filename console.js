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
  var signupEmail = document.getElementById("signup-email");
  var signupPassword = document.getElementById("signup-password");
  var signupError = document.getElementById("signup-error");
  var signupBtn = document.getElementById("signup-btn");

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

  var AUTH_FORMS = [loginForm, signupForm, resetRequestForm, resetConfirmForm];
  var AUTH_COPY = {
    "login": ["Votre tableau de bord.", "Mots les plus recherchés, recherches sans résultat, erreurs récentes, consommation — connectez-vous pour les consulter."],
    "signup": ["Créer votre compte.", "Un email, un mot de passe — votre clé API est générée immédiatement et envoyée par email."],
    "reset-request": ["Mot de passe oublié ?", "Indiquez votre email, on vous envoie un lien pour en choisir un nouveau."],
    "reset-confirm": ["Nouveau mot de passe.", "Choisissez un nouveau mot de passe pour votre compte."]
  };
  function setAuthMode(mode) {
    AUTH_FORMS.forEach(function (f) { f.hidden = true; });
    loginError.hidden = true; signupError.hidden = true; resetConfirmError.hidden = true;
    resetRequestMsg.hidden = true;
    if (mode === "login") { loginForm.hidden = false; authLinks.hidden = false; authBack.hidden = true; }
    if (mode === "signup") { signupForm.hidden = false; authLinks.hidden = false; authBack.hidden = true; }
    if (mode === "reset-request") { resetRequestForm.hidden = false; authLinks.hidden = true; authBack.hidden = false; }
    if (mode === "reset-confirm") { resetConfirmForm.hidden = false; authLinks.hidden = true; authBack.hidden = true; }
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
  }

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
    }).catch(function () {
      dashLoading.hidden = true;
      localStorage.removeItem(SESSION_STORAGE_KEY);
      activeKey = null;
      setAuthMode("login");
      showLogin(L.loginErrorNetwork);
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
    apiPost("/v1/auth/signup", { email: signupEmail.value.trim(), password: signupPassword.value })
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
  if (resetTokenFromUrl) {
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

