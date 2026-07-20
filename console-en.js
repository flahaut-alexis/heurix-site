// Heurix — Client console (EN)
// Se connecte avec une vraie clé API et appelle le vrai moteur en
// production (https://api.heurix.fr) — aucune donnée simulée ici,
// contrairement au widget de démonstration de la page d'accueil.
(function () {
  "use strict";

  var API_BASE = "https://api.heurix.fr";
  var STORAGE_KEY = "heurix_console_key";

  var L = {
    loading: "Loading data…",
    loginErrorInvalid: "Invalid key or server unreachable. Check the key and try again.",
    loginErrorNetwork: "Couldn't reach api.heurix.fr. The service may be temporarily unavailable.",
    zeroRate: function (n) { return Math.round(n * 100) + "%"; },
    dashTitle: function (label) { return label ? "Hi, " + label : "Dashboard"; },
    when: function (iso) {
      try {
        var d = new Date(iso);
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " at " +
               d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      } catch (e) { return iso; }
    }
  };

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function apiFetch(path, key) {
    return fetch(API_BASE + path, { headers: { Authorization: "Bearer " + key } })
      .then(function (r) {
        if (!r.ok) {
          var err = new Error("HTTP " + r.status);
          err.status = r.status;
          throw err;
        }
        return r.json();
      });
  }

  var loginScreen = document.getElementById("login-screen");
  var dashboard = document.getElementById("dashboard");
  var loginForm = document.getElementById("login-form");
  var loginError = document.getElementById("login-error");
  var loginBtn = document.getElementById("login-btn");
  var apiKeyInput = document.getElementById("api-key");
  var toggleKeyBtn = document.getElementById("toggle-key-visibility");
  var logoutBtn = document.getElementById("logout-btn");
  var periodSelect = document.getElementById("period-select");
  var dashLoading = document.getElementById("dash-loading");
  var dashContent = document.getElementById("dash-content");
  var chart = null;

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
    document.getElementById("stat-searches").textContent = summary.total_searches.toLocaleString("en-GB");
    document.getElementById("stat-zero-rate").textContent = L.zeroRate(summary.zero_result_rate);
    document.getElementById("stat-errors").textContent = summary.total_errors.toLocaleString("en-GB");
    document.getElementById("stat-usage").textContent = usage.requests.toLocaleString("en-GB");
  }

  function renderChart(daily) {
    var ctx = document.getElementById("searches-chart").getContext("2d");
    var labels = daily.map(function (d) {
      var parts = d.day.split("-");
      return parts[2] + "/" + parts[1];
    });
    var data = daily.map(function (d) { return d.count; });
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{ data: data, backgroundColor: "#5468FF", borderRadius: 4, maxBarThickness: 28 }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { displayColors: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#EEF1FF" } },
          x: { grid: { display: false } },
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
        return "<td>" + esc(q.query) + "</td><td>" + q.count + "</td><td>" + q.avg_results + "</td>";
      });
      renderTable("zero-results-table", "zero-results-empty", zeroResults, function (q) {
        return "<td>" + esc(q.query) + "</td><td>" + q.count + "</td>";
      });
      renderTable("errors-table", "errors-empty", errors, function (e) {
        return "<td class='mono'>" + esc(e.endpoint) + "</td><td>" + e.status_code + "</td><td>" + esc(e.message) + "</td><td>" + L.when(e.at) + "</td>";
      });

      dashLoading.hidden = true;
      dashContent.hidden = false;
    }).catch(function () {
      dashLoading.hidden = true;
      showLogin(L.loginErrorNetwork);
      sessionStorage.removeItem(STORAGE_KEY);
    });
  }

  function tryLogin(key) {
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in…";
    loginError.hidden = true;
    apiFetch("/v1/usage", key)
      .then(function () {
        sessionStorage.setItem(STORAGE_KEY, key);
        showDashboard();
        loadDashboard(key, periodSelect.value);
      })
      .catch(function (err) {
        var reason = err && err.status
          ? "The server responded " + err.status + "."
          : "No response from the server (network).";
        showLogin(reason + " Key sent (" + key.length + " characters): \u201c" + key + "\u201d");
      })
      .then(function () {
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign in";
      });
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var key = apiKeyInput.value.replace(/\s+/g, "");  // retire tout espace invisible, pas seulement en debut/fin
    if (key) tryLogin(key);
  });

  toggleKeyBtn.addEventListener("click", function () {
    var showing = apiKeyInput.type === "text";
    apiKeyInput.type = showing ? "password" : "text";
    toggleKeyBtn.setAttribute("aria-label", showing ? "Show key" : "Hide key");
  });

  logoutBtn.addEventListener("click", function () {
    sessionStorage.removeItem(STORAGE_KEY);
    apiKeyInput.value = "";
    showLogin();
  });

  periodSelect.addEventListener("change", function () {
    var key = sessionStorage.getItem(STORAGE_KEY);
    if (key) loadDashboard(key, periodSelect.value);
  });

  // Reprise de session : si une clé est déjà en mémoire pour cet onglet,
  // on saute directement au tableau de bord.
  var existingKey = sessionStorage.getItem(STORAGE_KEY);
  if (existingKey) {
    showDashboard();
    loadDashboard(existingKey, periodSelect.value);
  }
})();
