/* Kickbet – Offline Spielgeld-Fußballwetten.
   Keine Server, kein Tracking. Alles bleibt lokal im Browser-/WebView-Storage. */
(function () {
  "use strict";

  var STORE = "kickbet.v1";
  var START_BALANCE = 1000;

  var TEAMS = [
    "Sturm Graz", "Rapid Wien", "Austria Wien", "RB Salzburg", "LASK",
    "Wolfsberg", "Hartberg", "Klagenfurt", "Altach", "Blau-Weiß Linz",
    "Bayern", "Dortmund", "Leipzig", "Leverkusen", "Frankfurt", "Stuttgart",
    "Real Madrid", "Barcelona", "Man City", "Liverpool", "Inter", "Juventus"
  ];
  var LEAGUES = ["Bundesliga", "Champions League", "Cup", "Topspiel"];
  var DAYS = ["Sa", "So", "Fr", "Mi", "Di"];

  /* ---------- State ---------- */
  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (raw) {
        var s = JSON.parse(raw);
        if (typeof s.balance === "number" && Array.isArray(s.matches)) return s;
      }
    } catch (e) { /* ignore */ }
    return { balance: START_BALANCE, matches: [], slip: {}, history: [] };
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- Spiele erzeugen ---------- */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function makeMatch(id) {
    var home, away;
    do { home = pick(TEAMS); away = pick(TEAMS); } while (home === away);

    // Grund-Stärken -> realistische, gemischte Quoten mit Buchmacher-Marge.
    var sHome = rnd(0.9, 2.6) + 0.25; // Heimvorteil
    var sAway = rnd(0.9, 2.6);
    var sDraw = rnd(1.1, 1.7);
    var sum = sHome + sAway + sDraw;
    var pH = sHome / sum, pA = sAway / sum, pD = sDraw / sum;

    var margin = 1.08; // ~8% Marge
    function quote(p) { return Math.max(1.05, Math.round((1 / (p * margin)) * 20) / 20); }

    return {
      id: id,
      league: pick(LEAGUES),
      kickoff: pick(DAYS) + " " + (15 + Math.floor(Math.random() * 6)) + ":" +
               (Math.random() < 0.5 ? "00" : "30"),
      home: home, away: away,
      odds: { "1": quote(pH), "X": quote(pD), "2": quote(pA) },
      // wahre Wahrscheinlichkeiten (ohne Marge) für die Simulation
      prob: { "1": pH, "X": pD, "2": pA }
    };
  }

  function refillMatches() {
    var nextId = state.matches.reduce(function (m, x) { return Math.max(m, x.id); }, 0) + 1;
    while (state.matches.length < 6) {
      state.matches.push(makeMatch(nextId++));
    }
  }

  /* ---------- DOM ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var matchesEl = $("tab-matches");
  var slipListEl = $("slipList");
  var historyListEl = $("historyList");

  function fmt(n) { return Math.round(n).toLocaleString("de-DE"); }

  function renderBalance() { $("balance").textContent = fmt(state.balance); }

  function renderMatches() {
    refillMatches();
    matchesEl.innerHTML = "";
    state.matches.forEach(function (m) {
      var sel = state.slip[m.id];
      var card = document.createElement("div");
      card.className = "match";
      card.innerHTML =
        '<div class="match-top"><span class="league">' + m.league +
        '</span><span class="kickoff">' + m.kickoff + '</span></div>' +
        '<div class="teams"><span>' + m.home + '</span><span class="vs">vs</span><span>' +
        m.away + '</span></div>' +
        '<div class="odds">' +
        oddBtn(m, "1", "Heim", sel) +
        oddBtn(m, "X", "Remis", sel) +
        oddBtn(m, "2", "Gast", sel) +
        '</div>';
      matchesEl.appendChild(card);
    });
    matchesEl.querySelectorAll(".odd").forEach(function (b) {
      b.addEventListener("click", function () {
        togglePick(+b.dataset.match, b.dataset.k);
      });
    });
  }

  function oddBtn(m, k, label, sel) {
    var on = sel === k ? " sel" : "";
    return '<div class="odd' + on + '" data-match="' + m.id + '" data-k="' + k + '">' +
      '<span class="lbl">' + label + '</span>' +
      '<span class="val">' + m.odds[k].toFixed(2) + '</span></div>';
  }

  function togglePick(matchId, k) {
    if (state.slip[matchId] === k) delete state.slip[matchId];
    else state.slip[matchId] = k;
    save();
    renderMatches();
    renderSlip();
    updateSlipBadge();
  }

  function slipLegs() {
    var legs = [];
    Object.keys(state.slip).forEach(function (id) {
      var m = state.matches.find(function (x) { return x.id === +id; });
      if (m) legs.push({ match: m, k: state.slip[id] });
    });
    return legs;
  }

  function totalOdds() {
    return slipLegs().reduce(function (acc, l) { return acc * l.match.odds[l.k]; }, 1);
  }

  function renderSlip() {
    var legs = slipLegs();
    slipListEl.innerHTML = "";
    var has = legs.length > 0;
    $("slipEmpty").classList.toggle("hidden", has);
    $("slipFooter").classList.toggle("hidden", !has);

    var pickName = { "1": "Heimsieg", "X": "Unentschieden", "2": "Auswärtssieg" };
    legs.forEach(function (l) {
      var row = document.createElement("div");
      row.className = "slip-item";
      row.innerHTML =
        '<div><div class="pick">' + pickName[l.k] + '</div>' +
        '<div class="mt">' + l.match.home + ' – ' + l.match.away + '</div></div>' +
        '<div class="o">' + l.match.odds[l.k].toFixed(2) + '</div>' +
        '<button class="rm" data-id="' + l.match.id + '">&times;</button>';
      slipListEl.appendChild(row);
    });
    slipListEl.querySelectorAll(".rm").forEach(function (b) {
      b.addEventListener("click", function () {
        delete state.slip[+b.dataset.id]; save();
        renderMatches(); renderSlip(); updateSlipBadge();
      });
    });

    if (has) updatePayout();
  }

  function updatePayout() {
    var t = totalOdds();
    $("totalOdds").textContent = t.toFixed(2);
    var stake = clampStake();
    $("potWin").textContent = fmt(stake * t);
    $("placeBet").disabled = !(stake > 0 && stake <= state.balance);
    $("placeBet").textContent = stake > state.balance
      ? "Nicht genug Coins" : "Wette platzieren (" + fmt(stake) + ")";
  }

  function clampStake() {
    var v = parseInt($("stake").value, 10);
    if (isNaN(v) || v < 0) v = 0;
    return v;
  }

  function updateSlipBadge() {
    $("slipCount").textContent = Object.keys(state.slip).length;
  }

  /* ---------- Wette abrechnen ---------- */
  function settle(outcome, prob) {
    var r = Math.random();
    if (r < prob["1"]) return "1";
    if (r < prob["1"] + prob["X"]) return "X";
    return "2";
  }

  function placeBet() {
    var legs = slipLegs();
    if (!legs.length) return;
    var stake = clampStake();
    if (stake <= 0 || stake > state.balance) return;

    state.balance -= stake;
    var t = totalOdds();
    var won = true;
    var resultLegs = legs.map(function (l) {
      var res = settle(l.k, l.match.prob);
      var legWon = res === l.k;
      if (!legWon) won = false;
      return {
        teams: l.match.home + " – " + l.match.away,
        pick: l.k, odd: l.match.odds[l.k], result: res, won: legWon
      };
    });

    var payout = won ? stake * t : 0;
    state.balance += payout;

    state.history.unshift({
      time: timestamp(),
      stake: stake, total: t, won: won, payout: payout, legs: resultLegs
    });
    if (state.history.length > 50) state.history.pop();

    // Bespielte Partien entfernen, neue nachladen.
    var betIds = legs.map(function (l) { return l.match.id; });
    state.matches = state.matches.filter(function (m) { return betIds.indexOf(m.id) < 0; });
    state.slip = {};
    save();

    renderBalance(); renderMatches(); renderSlip(); updateSlipBadge(); renderHistory();
    switchTab("history");

    if (won) toast("🎉 Gewonnen! +" + fmt(payout) + " Coins");
    else toast("Knapp daneben – kein Gewinn. Nächstes Mal!");
  }

  function timestamp() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + ". " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  /* ---------- Verlauf ---------- */
  function renderHistory() {
    var h = state.history;
    historyListEl.innerHTML = "";
    $("historyEmpty").classList.toggle("hidden", h.length > 0);

    var rn = { "1": "1", "X": "X", "2": "2" };
    h.forEach(function (b) {
      var legsHtml = b.legs.map(function (l) {
        return '<div class="leg"><span>' + l.teams +
          ' <em style="color:var(--muted)">(Tipp ' + rn[l.pick] + ' @ ' + l.odd.toFixed(2) +
          ')</em></span><span class="res ' + (l.won ? "win" : "lose") + '">' +
          (l.won ? "✓ " : "✗ ") + "Erg. " + rn[l.result] + '</span></div>';
      }).join("");

      var el = document.createElement("div");
      el.className = "hist";
      el.innerHTML =
        '<div class="hist-top"><span>' + b.time + '</span><span>Quote ' + b.total.toFixed(2) +
        ' · Einsatz ' + fmt(b.stake) + '</span></div>' +
        '<div class="legs">' + legsHtml + '</div>' +
        '<div class="hist-bottom"><span class="tag ' + (b.won ? "win" : "lose") + '">' +
        (b.won ? "Gewonnen" : "Verloren") + '</span><span>' +
        (b.won ? "Auszahlung " + fmt(b.payout) + " Coins" : "-" + fmt(b.stake) + " Coins") +
        '</span></div>';
      historyListEl.appendChild(el);
    });
  }

  /* ---------- Tabs / UI ---------- */
  function switchTab(name) {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.tab === name);
    });
    document.querySelectorAll(".tabpanel").forEach(function (p) {
      p.classList.toggle("active", p.id === "tab-" + name);
    });
  }

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---------- Events ---------- */
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () { switchTab(t.dataset.tab); });
  });
  $("stake").addEventListener("input", updatePayout);
  document.querySelectorAll(".quick-stakes button").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.dataset.stake === "max") $("stake").value = state.balance;
      else $("stake").value = b.dataset.stake;
      updatePayout();
    });
  });
  $("placeBet").addEventListener("click", placeBet);
  $("resetAccount").addEventListener("click", function () {
    state = { balance: START_BALANCE, matches: [], slip: {}, history: [] };
    save();
    renderBalance(); renderMatches(); renderSlip(); updateSlipBadge(); renderHistory();
    switchTab("matches");
    toast("Konto zurückgesetzt – " + fmt(START_BALANCE) + " Coins");
  });

  /* ---------- Start ---------- */
  renderBalance();
  renderMatches();
  renderSlip();
  updateSlipBadge();
  renderHistory();
})();
