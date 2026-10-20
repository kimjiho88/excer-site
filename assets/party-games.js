/* ============================================================
   모임 자리 게임 v2 (98차): 세 게임
   뽑기(돌림판, 슬롯, 순서, 팀, 카드), 밸런스 게임, 라이어 게임.
   틀과 도구(명단, 소리, 화면 그리기)는 party-core.js 의 window.PARTY
   ============================================================ */
(function () {
  "use strict";
  var P = window.PARTY; if (!P) return;
  var H = P.h, esc = H.esc, ic = H.ic, tok = H.tok, disp = H.disp;
  var $ = function (id) { return document.getElementById(id); };
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  // 게임을 나가거나 바꾼 뒤에는 돌지 않는 setTimeout
  function later(s, ms, fn) { return setTimeout(function () { if (P.st === s) fn(); }, ms); }
  function btn(act, label, cls, extra) { return '<button type="button" class="pa-btn ' + (cls || "is-primary") + '" data-act="' + act + '"' + (extra || "") + ">" + label + "</button>"; }
  function dots(n, i) { var s = ""; for (var k = 0; k < n; k++) s += "<i" + (k < i ? ' class="on"' : k === i ? ' class="now"' : "") + "></i>"; return '<div class="dots" aria-hidden="true">' + s + "</div>"; }
  function intro(kind, title, text) { return '<div class="pg-intro"><div class="pg-intro-art">' + H.art(kind) + '</div><h3 class="pg-h">' + title + '</h3><p class="pg-p">' + text + "</p></div>"; }
  function steps(list) { return '<ol class="pg-steps">' + list.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ol>"; }
  function sect(title, inner) { return '<div class="pg-sect"><h3>' + title + "</h3>" + inner + "</div>"; }
  function handHTML(who, msg, n, i) {
    return '<div class="hand"><span class="pass">' + ic("pass", "is-sm") + "폰을 넘겨 주세요</span>" + tok(who, "xl")
      + '<p class="hand-who">' + esc(disp(who)) + ' 님</p><p class="msg">' + msg + "</p>" + (n ? dots(n, i) : "") + "</div>";
  }
  // 참여 인원 +/-: 뽑기는 갈래 단추 아래 한 줄, 밸런스와 라이어는 설정 화면의 한 칸(얼굴 줄과 함께). 누르면 party-core 가 명단을 고치고 다시 그린다
  function pplBar(min) { return '<div class="ppl-bar"><span class="ppl-lb" aria-hidden="true">참여 인원</span>' + H.stepper(min) + "</div>"; }
  function pplSect(min) { return '<div class="pg-sect pg-ppl"><div class="ppl-bar"><h3>참여 인원</h3>' + H.stepper(min) + '</div><div class="ppl-faces" aria-hidden="true">' + H.faces() + "</div></div>"; }
  function inRoster(n) { return P.roster.indexOf(n) >= 0; }
  function sameSet(a, b) { if (!Array.isArray(a) || a.length !== b.length) return false; var m = {}; b.forEach(function (x) { m[x] = 1; }); return a.every(function (x) { return m[x] === 1 && (m[x] = 2); }); }
  function fillBars() { requestAnimationFrame(function () { requestAnimationFrame(function () { each(P.body.querySelectorAll("[data-w]"), function (el) { el.style.width = el.getAttribute("data-w") + "%"; }); }); }); }
  function countUp(el, to, ms, delay) {
    if (!el) return;
    if (H.reduced()) { el.textContent = to + "%"; return; }
    setTimeout(function () {
      var t0 = performance.now();
      (function step(now) { var p = Math.min(1, (now - t0) / ms); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + "%"; if (p < 1 && document.body.contains(el)) requestAnimationFrame(step); })(t0);
    }, delay || 0);
  }
  function siteUrl() { return location.origin + "/party.html"; }
  var CROWN = '<svg viewBox="0 0 44 32" aria-hidden="true" focusable="false"><path d="M4 25 2 7l11 8 9-13 9 13 11-8-2 18z" fill="currentColor" stroke="#7C4A03" stroke-width="2" stroke-linejoin="round"/><rect x="4" y="25" width="36" height="5.5" rx="2" fill="currentColor" stroke="#7C4A03" stroke-width="2"/><circle cx="22" cy="17" r="2.6" fill="#7C4A03"/><circle cx="2" cy="7" r="2" fill="currentColor"/><circle cx="42" cy="7" r="2" fill="currentColor"/><circle cx="22" cy="2" r="2" fill="currentColor"/></svg>';
  function mask(fill, eye) { return '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M6 28c0-8 8-12 17-12 5 0 8 3 9 3s4-3 9-3c9 0 17 4 17 12 0 10-7 17-16 17-7 0-8-5-10-5s-3 5-10 5C13 45 6 38 6 28z" fill="' + fill + '"/><ellipse cx="20" cy="29" rx="5.5" ry="3.8" fill="' + eye + '"/><ellipse cx="44" cy="29" rx="5.5" ry="3.8" fill="' + eye + '"/></svg>'; }

  /* 같은 점수는 같은 등수, 순서는 점수 다음 앉은 순서 */
  function ranking(players, scores) {
    var arr = players.map(function (n, i) { return { n: n, p: scores[n] || 0, o: i }; });
    arr.sort(function (a, b) { return b.p - a.p || a.o - b.o; });
    arr.forEach(function (x) { x.pos = 1 + arr.filter(function (y) { return y.p > x.p; }).length; });
    return arr;
  }
  function boardHTML(rk, top3) {
    var max = Math.max(1, rk[0] ? rk[0].p : 1);
    var list = top3 ? rk.filter(function (x) { return x.pos <= 3; }).slice(0, 5) : rk, rest = rk.length - list.length;
    return '<ol class="board">' + list.map(function (x) {
      return '<li' + (x.pos === 1 && x.p > 0 ? ' class="is-top"' : "") + '><span class="fill" data-w="' + Math.round(x.p / max * 100) + '"></span>'
        + '<span class="pos">' + x.pos + '<span class="pa-sr">등</span></span>' + tok(x.n, "sm") + '<span class="nm">' + esc(disp(x.n)) + "</span>"
        + '<span class="pts">' + x.p + '<span class="pa-sr">점</span></span></li>';
    }).join("") + "</ol>" + (rest > 0 ? '<p class="board-more">외 ' + rest + "명</p>" : "");
  }

  /* ============================================================
     뽑기: 한 명(돌림판 12명까지, 그보다 많으면 슬롯), 순서, 팀, 카드
     ============================================================ */
  var MODES = [["one", "한 명", "target"], ["order", "순서", "order"], ["team", "팀", "team"], ["card", "카드", "cards"]];
  var TEAMS = [["보라", "#A78BFA"], ["주황", "#FB923C"], ["초록", "#34D399"], ["파랑", "#60A5FA"], ["분홍", "#F472B6"], ["노랑", "#FDE047"]];
  var DECKS = {
    missions: { cls: "is-mission", name: "미션 카드", lb: "미션", icon: "bolt", sub: "가벼운 미션" },
    talk: { cls: "is-talk", name: "이야기 카드", lb: "이야기", icon: "chat", sub: "대화 주제" }
  };
  var SP = { raf: 0, t: 0 };
  function stopSpin() { if (SP.raf) cancelAnimationFrame(SP.raf); SP.raf = 0; clearTimeout(SP.t); SP.t = 0; }
  function poolOf(s) { return P.roster.filter(function (n) { return s.out.indexOf(n) < 0; }); }
  function coarse() { return !(window.matchMedia && window.matchMedia("(pointer: fine)").matches); }

  var pick = P.games.pick = {
    title: "뽑기", min: 2,
    fresh: function (pf) {
      return { mode: /^(one|order|team|card)$/.test(pf.mode) ? pf.mode : "one", teamN: pf.teamN || 2, out: [], rot: 0, last: null, order: null, teams: null,
        deck: null, card: null, cardFor: null, usedM: Array.isArray(pf.usedM) ? pf.usedM : [], usedT: Array.isArray(pf.usedT) ? pf.usedT : [] };
    },
    prefs: function (s) { return { mode: s.mode, teamN: s.teamN, usedM: s.usedM, usedT: s.usedT }; },
    restore: function (v, pf) {
      if (!v || typeof v !== "object") return null;
      var s = pick.fresh(pf);
      ["mode", "teamN", "out", "rot", "last", "order", "teams", "deck", "card", "cardFor", "usedM", "usedT"].forEach(function (k) { if (v[k] !== undefined && v[k] !== null) s[k] = v[k]; });
      return s;
    },
    dirty: function () { return false; },
    show: function (s) { pickClean(s); pickRender(s); },
    stop: stopSpin,
    popClosed: function () { var b = P.foot.querySelector('[data-act="spin"]'); if (b) { try { b.focus({ preventScroll: true }); } catch (e) {} } },
    act: pickAct
  };
  function pickClean(s) {
    if (!/^(one|order|team|card)$/.test(s.mode)) s.mode = "one";
    s.out = Array.isArray(s.out) ? s.out.filter(inRoster) : [];
    if (poolOf(s).length < 2) s.out = [];
    if (typeof s.rot !== "number" || !isFinite(s.rot)) s.rot = 0;
    if (s.last && !inRoster(s.last)) s.last = null;
    if (s.order && !sameSet(s.order, P.roster)) s.order = null;
    if (s.teams && !(Array.isArray(s.teams) && s.teams.length === s.teamN && sameSet([].concat.apply([], s.teams), P.roster))) s.teams = null;
    if (!DECKS[s.deck] || typeof s.card !== "string") { s.deck = null; s.card = null; }
    if (s.cardFor && !inRoster(s.cardFor)) s.cardFor = null;
  }
  function segHTML(s) {
    return '<div class="seg" role="group" aria-label="뽑기 종류" style="--n:4">' + MODES.map(function (m) {
      return '<button type="button" aria-pressed="' + (s.mode === m[0]) + '" data-act="mode" data-mode="' + m[0] + '">' + ic(m[2]) + m[1] + "</button>";
    }).join("") + "</div>" + pplBar(pick.min);
  }
  function pickRender(s, fx) {
    if (s.mode === "order") return pickOrder(s);
    if (s.mode === "team") return pickTeams(s);
    if (s.mode === "card") return pickCard(s, fx);
    return pickOne(s);
  }
  function pickAct(a, el, s) {
    if (a === "mode") { var m = el.getAttribute("data-mode"); if (m === s.mode) return; stopSpin(); s.mode = m; pickRender(s); P.sfx("select"); return; }
    if (a === "spin") { doSpin(s, {}); return; }
    if (a === "reset-out") { s.out = []; pickRender(s); P.sfx("pop"); H.toast("모두 다시 넣었어요."); return; }
    if (a === "mission") {
      var t = H.draw(P.pack().missions, s.usedM), box = $("popMission");
      if (box) box.innerHTML = '<div class="mission"><small>미션</small><b>' + esc(t) + "</b></div>";
      el.innerHTML = ic("refresh") + "다른 미션";
      P.sfx("flip"); H.say("미션. " + t); P.save(); return;
    }
    if (a === "again") { P.popClose(); doSpin(s, {}); return; }
    if (a === "exclude") {
      if (s.last && s.out.indexOf(s.last) < 0) s.out.push(s.last);
      P.popClose(); pickRender(s); H.toast(disp(s.last) + " 님을 빼고 다시 돌려요.");
      SP.t = later(s, 420, function () { doSpin(s, {}); });
      return;
    }
    if (a === "shuffle-order") { orderShuffle(s); return; }
    if (a === "copy-order") { P.copy("순서\n" + s.order.map(function (n, i) { return (i + 1) + ". " + disp(n); }).join("\n")); return; }
    if (a === "team-n") { var k = Number(el.getAttribute("data-n")); if (k === s.teamN) return; s.teamN = k; s.teams = null; pickRender(s); return; }
    if (a === "deal-teams") { dealTeams(s); return; }
    if (a === "copy-teams") { P.copy(s.teams.map(function (t, i) { return TEAMS[i][0] + "팀: " + t.map(disp).join(", "); }).join("\n")); return; }
    if (a === "deck") { s.deck = el.getAttribute("data-deck"); drawCard(s); return; }
    if (a === "card-next") { drawCard(s); return; }
    if (a === "card-who") { rollWho(s); return; }
    if (a === "card-back") { s.card = null; s.deck = null; s.cardFor = null; pickRender(s); return; }
  }

  /* 한 명: 돌림판. 이름은 바퀴를 따라 눕고, 멈출 자리에서 아래쪽에 오는 이름은 뒤집어 거꾸로 서지 않게 */
  function labT(i, a, rT, R) { var w = (((i * a + R) % 360) + 360) % 360; return "rotate(" + (i * a).toFixed(2) + ") translate(0 " + (-rT) + ")" + (w > 95 && w < 265 ? " rotate(180)" : ""); }
  function orient(stage, R) {
    var a = Number(stage.getAttribute("data-a")), rT = Number(stage.getAttribute("data-r"));
    each(stage.querySelectorAll(".lab"), function (t) { t.setAttribute("transform", labT(Number(t.getAttribute("data-i")), a, rT, R)); });
  }
  function wheelHTML(list, rot) {
    var n = list.length, a = 360 / n, sl = "", lb = "", pg = "", bl = "";
    var rT = n <= 3 ? 50 : n <= 6 ? 60 : 66, fs0 = n <= 4 ? 18 : n <= 6 ? 16 : n <= 8 ? 14 : n <= 10 ? 12.5 : 11.5;
    var room = Math.min(120, 2 * Math.PI * rT / n * 0.84), used = {};
    var cols = list.map(function (nm) { var c = H.color(nm); if (used[c]) { c = H.PALETTE.filter(function (x) { return !used[x]; })[0] || c; } used[c] = 1; return c; });
    for (var i = 0; i < n; i++) {
      var name = list[i], ch = Array.from(disp(name)), fs = Math.min(fs0, room / (ch.length * 0.98));
      if (fs < 9) { fs = 9; ch = ch.slice(0, Math.max(2, Math.floor(room / (9 * 0.98)))); }
      sl += '<path class="slice" data-i="' + i + '" d="' + H.slicePath(92, i * a - a / 2, i * a + a / 2) + '" fill="' + cols[i] + '"/>';
      lb += '<text class="lab" data-i="' + i + '" transform="' + labT(i, a, rT, rot) + '" font-size="' + fs.toFixed(1) + '">' + esc(ch.join("")) + "</text>";
      var p = H.pt(86, i * a + a / 2); pg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.7"/>';
    }
    for (var j = 0; j < 20; j++) { var q = H.pt(96, j * 18); bl += '<circle class="bulb" cx="' + q[0] + '" cy="' + q[1] + '" r="2.6"/>'; }
    return '<div class="wheel-stage" id="wheelStage" role="img" aria-label="돌림판, ' + n + '명" data-a="' + a + '" data-r="' + rT + '">'
      + '<div class="wheel-glow"></div>'
      + '<div class="wheel-rot" id="wheelRot" style="transform:rotate(' + rot.toFixed(2) + 'deg)"><svg class="wheel" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">'
      + '<defs><radialGradient id="whShade" cx="0" cy="0" r="92" gradientUnits="userSpaceOnUse"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".24"/></radialGradient>'
      + '<radialGradient id="whGloss" cx="-30" cy="-40" r="110" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
      + '<g class="slices">' + sl + '</g><circle r="92" fill="url(#whShade)"/><g class="labs">' + lb + '</g><g class="pegs">' + pg + "</g></svg></div>"
      + '<div class="wheel-rim"><svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false"><defs>'
      + '<linearGradient id="whRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDE68A"/><stop offset=".5" stop-color="#F59E0B"/><stop offset="1" stop-color="#9A3412"/></linearGradient>'
      + '<radialGradient id="whHub" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#FDBA74"/></radialGradient></defs>'
      + '<circle r="92" fill="url(#whGloss)"/><circle r="96" fill="none" stroke="url(#whRim)" stroke-width="9"/><circle r="91.3" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.4"/>'
      + bl + '<circle r="17" fill="url(#whHub)" stroke="#9A3412" stroke-width="3"/><circle r="6.5" fill="#EA580C"/><circle r="2.4" cx="-2" cy="-2" fill="#FFEDD5"/></svg></div>'
      + '<div class="wheel-pin" id="wheelPin"><svg viewBox="0 0 46 58" aria-hidden="true" focusable="false"><path d="M23 56 9.36 26.24A15 15 0 1 1 36.64 26.24z" fill="#EF4444" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle cx="23" cy="20" r="5.5" fill="#fff"/></svg></div>'
      + "</div>";
  }
  function slotRow(n) { return "<div>" + tok(n, "sm") + "<span>" + esc(disp(n)) + "</span></div>"; }
  function slotHTML(list, cur) {
    var c = cur && list.indexOf(cur) >= 0 ? cur : list[0], i = list.indexOf(c);
    var rows = [list[(i + list.length - 1) % list.length], c, list[(i + 1) % list.length]];
    return '<div class="slot" id="slot" role="img" aria-label="이름 슬롯, ' + list.length + '명"><div class="slot-frame"></div><div class="slot-reel" id="reel">' + rows.map(slotRow).join("") + "</div></div>";
  }
  function pickOne(s) {
    var list = poolOf(s), wheel = list.length <= 12;
    P.screen({
      body: segHTML(s) + '<div class="pg-mid">' + (wheel ? wheelHTML(list, s.rot) : slotHTML(list, s.last))
        + '<p class="pg-hint" id="spinHint">' + (wheel ? (coarse() ? "돌림판을 손가락으로 세게 밀거나 아래 버튼을 눌러요" : "돌림판을 끌어서 돌리거나 아래 버튼을 눌러요") : "버튼을 누르면 이름이 돌다가 멈춰요") + "</p></div>"
        + (s.out.length ? '<div class="pick-out"><button type="button" class="pchip" data-act="reset-out">' + ic("undo", "is-sm") + '뺀 사람 다시 넣기 <span class="n">' + s.out.length + "</span></button></div>" : ""),
      foot: '<button type="button" class="pa-btn is-primary is-lg is-glow" data-act="spin">' + ic("refresh") + "돌리기</button>",
      say: "한 명 뽑기. 후보 " + list.length + "명."
    });
    if (wheel) bindWheel(s);
  }
  // 돌림판을 손으로 돌리기: 끌면 따라 돌고, 놓는 순간의 빠르기로 돌아간다. 살짝 누르면 단추와 같다
  function bindWheel(s) {
    var stage = $("wheelStage"), rotEl = $("wheelRot"); if (!stage) return;
    var d = null;
    function ang(e) { var r = stage.getBoundingClientRect(); return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI; }
    stage.addEventListener("pointerdown", function (e) {
      if (P.busy || (e.pointerType === "mouse" && e.button !== 0)) return;
      var r = stage.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      d = { id: e.pointerId, last: ang(e), r0: s.rot, acc: 0, x: e.clientX, y: e.clientY, hist: [[performance.now(), s.rot]], moved: false, near: Math.hypot(dx, dy) < r.width * 0.12 };
      try { stage.setPointerCapture(e.pointerId); } catch (er) {}
    });
    stage.addEventListener("pointermove", function (e) {
      if (!d || e.pointerId !== d.id) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moved = true;
      if (!d.moved || d.near) return;
      var a = ang(e), dl = a - d.last; dl = ((dl + 540) % 360) - 180; d.last = a; d.acc += dl;
      var n = poolOf(s).length, sa = 360 / n, before = Math.floor((s.rot + sa / 2) / sa);
      s.rot = d.r0 + d.acc; rotEl.style.transform = "rotate(" + s.rot.toFixed(2) + "deg)";
      if (Math.floor((s.rot + sa / 2) / sa) !== before) P.sfx("tick");
      var now = performance.now(); d.hist.push([now, s.rot]);
      while (d.hist.length > 2 && now - d.hist[0][0] > 110) d.hist.shift();
    });
    function up(e) {
      if (!d || e.pointerId !== d.id) return;
      var g = d; d = null;
      if (!g.moved) { doSpin(s, {}); return; }
      var h = g.hist, v = 0;
      if (h.length >= 2) { var dt = (h[h.length - 1][0] - h[0][0]) / 1000; if (dt > 0) v = (h[h.length - 1][1] - h[0][1]) / dt; }
      if (performance.now() - h[h.length - 1][0] > 120) v = 0;
      if (Math.abs(v) >= 260) doSpin(s, { v: v });
      else { orient(stage, s.rot); var hint = $("spinHint"); if (hint) hint.textContent = "조금 더 세게 밀어 보세요"; P.save(); }
    }
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", function () { d = null; });
  }
  function doSpin(s, o) {
    if (P.busy) return;
    var list = poolOf(s); if (list.length < 2) return;
    if (list.length > 12) { slotSpin(s, list); return; }
    var stage = $("wheelStage"), rotEl = $("wheelRot"), pin = $("wheelPin");
    if (!stage) return;
    P.busy = true; stopSpin();
    var n = list.length, a = 360 / n, win = Math.floor(Math.random() * n), dir = o.v < 0 ? -1 : 1, v0 = Math.abs(o.v || 0), K = 3;
    var turns = H.reduced() ? 1 : v0 ? H.clamp(v0 / 330, 3, 8) : 5 + Math.random() * 1.5;
    var target = -(win * a) - (Math.random() - 0.5) * a * 0.72;
    var cur = s.rot, base = cur + dir * turns * 360, delta = (((target - base) % 360) + 360) % 360;
    var F = dir > 0 ? base + delta : base - ((360 - delta) % 360);
    var dur = v0 ? H.clamp(K * Math.abs(F - cur) / v0 * 1000, 2800, 6800) : 4300 + Math.random() * 900;
    if (H.reduced()) dur = 900;
    each(stage.querySelectorAll(".win, .dim"), function (el) { el.classList.remove("win", "dim"); });
    orient(stage, F);
    stage.classList.remove("is-done"); stage.classList.add("is-spinning");
    var sb = P.foot.querySelector('[data-act="spin"]'); if (sb) sb.disabled = true;
    var hint = $("spinHint"); if (hint) hint.textContent = "두근두근";
    P.sfx("whoosh");
    var t0 = performance.now(), lastK = Math.floor((cur + a / 2) / a), lastT = t0;
    function step(now) {
      var p = Math.min(1, (now - t0) / dur), R = cur + (F - cur) * (1 - Math.pow(1 - p, K));
      rotEl.style.transform = "rotate(" + R.toFixed(2) + "deg)";
      var k = Math.floor((R + a / 2) / a);
      if (k !== lastK) {
        lastK = k; P.sfx("tick");
        if (pin) { pin.style.transition = "none"; pin.style.transform = "rotate(" + (-22 * dir) + "deg)"; requestAnimationFrame(function () { pin.style.transition = ""; pin.style.transform = ""; }); }
        if (now - lastT > 90) H.buzz(4);
        lastT = now;
      }
      if (p < 1) { SP.raf = requestAnimationFrame(step); return; }
      SP.raf = 0;
      s.rot = ((F % 360) + 360) % 360; rotEl.style.transform = "rotate(" + s.rot.toFixed(2) + "deg)";
      landed(s, list[win], function () {
        stage.classList.remove("is-spinning"); stage.classList.add("is-done");
        each(stage.querySelectorAll(".slice, .lab"), function (el) { el.classList.add(Number(el.getAttribute("data-i")) === win ? "win" : "dim"); });
        var w = stage.querySelector('.slice[data-i="' + win + '"]'); if (w) w.parentNode.appendChild(w);
      });
    }
    SP.raf = requestAnimationFrame(step);
  }
  function slotSpin(s, list) {
    var reel = $("reel"), slot = $("slot"); if (!reel) return;
    P.busy = true; stopSpin();
    var win = Math.floor(Math.random() * list.length), name = list[win], seq = [], want = H.reduced() ? 8 : 30;
    while (seq.length < want) seq = seq.concat(H.shuffle(list));
    seq = seq.slice(0, Math.max(want, Math.min(seq.length, 45)));
    var cur = s.last && list.indexOf(s.last) >= 0 ? s.last : list[0];
    var rows = [H.rnd(list), cur].concat(seq, [name, H.rnd(list)]), K = rows.length - 2;
    reel.innerHTML = rows.map(slotRow).join(""); reel.style.transform = "translateY(0px)";
    slot.classList.remove("is-done");
    var sb = P.foot.querySelector('[data-act="spin"]'); if (sb) sb.disabled = true;
    P.sfx("whoosh");
    var to = 72 - 72 * K, dur = H.reduced() ? 900 : 3600, t0 = performance.now(), lastR = 1;
    function step(now) {
      var p = Math.min(1, (now - t0) / dur), y = to * (1 - Math.pow(1 - p, 3.4));
      reel.style.transform = "translateY(" + y.toFixed(1) + "px)";
      var r = Math.round((72 - y) / 72);
      if (r !== lastR) { lastR = r; P.sfx("tick"); }
      if (p < 1) { SP.raf = requestAnimationFrame(step); return; }
      SP.raf = 0;
      landed(s, name, function () { slot.classList.add("is-done"); });
    }
    SP.raf = requestAnimationFrame(step);
  }
  function landed(s, name, mark) {
    s.last = name; mark();
    P.sfx("win"); H.buzz([40, 60, 90]); P.confetti({ n: 110 });
    var hint = $("spinHint"); if (hint) hint.textContent = disp(name) + " 님!";
    P.save();
    SP.t = later(s, H.reduced() ? 200 : 760, function () {
      P.busy = false;
      var sb = P.foot.querySelector('[data-act="spin"]'); if (sb) sb.disabled = false;
      pickResult(s, name);
    });
  }
  function pickResult(s, name) {
    var left = poolOf(s).length;
    var w0 = name.split(/\s+/)[0], twin = P.roster.some(function (o) { return o !== name && o.split(/\s+/)[0] === w0; });
    P.pop('<p class="k">뽑혔어요</p>' + tok(name, "xl") + '<p class="big">' + esc(disp(name)) + "</p>" + (twin && disp(name) !== name ? '<p class="full">' + esc(name) + "</p>" : "")
      + '<div id="popMission"></div><div class="acts">'
      + btn("mission", ic("bolt") + "미션 카드 주기", "is-primary")
      + '<div class="pg-row">' + btn("again", ic("refresh", "is-sm") + "다시 돌리기", "is-ghost is-sm") + btn("exclude", ic("userx", "is-sm") + "빼고 돌리기", "is-ghost is-sm", left <= 2 ? " disabled" : "") + "</div>"
      + btn("pop-close", "닫기", "is-text") + "</div>", "뽑힌 사람");
    H.say(disp(name) + " 님이 뽑혔어요.");
  }

  /* 순서: 세 번 섞는 모습을 보여 주고 1번부터 차례로 불을 켠다 */
  function pickOrder(s) {
    var list = s.order || P.roster, lit = !!s.order;
    P.screen({
      body: segHTML(s) + '<ol class="ord" id="ordList">' + list.map(function (n, i) {
        return '<li data-k="' + esc(H.nickKey(n)) + '"><span class="n' + (lit ? " is-on" : "") + '">' + (i + 1) + "</span>" + tok(n, "sm") + '<span class="nm">' + esc(disp(n)) + "</span></li>";
      }).join("") + "</ol>" + (lit ? "" : '<p class="pg-hint">아래 버튼을 누르면 순서가 정해져요</p>'),
      foot: orderFoot(s),
      say: "순서 정하기. " + P.roster.length + "명."
    });
  }
  function orderFoot(s) {
    return s.order ? '<div class="pg-row">' + btn("copy-order", ic("copy", "is-sm") + "복사", "is-ghost") + btn("shuffle-order", ic("shuffle") + "다시 섞기", "is-primary") + "</div>"
      : btn("shuffle-order", ic("shuffle") + "순서 섞기", "is-primary is-lg is-glow");
  }
  function flip(ol, order, ms) {
    var lis = Array.prototype.slice.call(ol.children), map = {}, top = [];
    lis.forEach(function (li) { map[li.getAttribute("data-k")] = li; top.push(li.getBoundingClientRect().top); });
    order.forEach(function (n, i) { var li = map[H.nickKey(n)]; if (!li) return; ol.appendChild(li); li.querySelector(".n").textContent = i + 1; });
    var now = lis.map(function (li) { return li.getBoundingClientRect().top; });
    lis.forEach(function (li, i) { var dy = top[i] - now[i]; li.style.transition = "none"; li.style.transform = dy ? "translateY(" + dy + "px)" : ""; });
    void ol.offsetHeight;
    lis.forEach(function (li) { li.style.transition = "transform " + ms + "ms cubic-bezier(.2,.8,.2,1)"; li.style.transform = ""; });
    return H.wait(ms);
  }
  function orderShuffle(s) {
    var ol = $("ordList"); if (!ol) return;
    P.busy = true;
    var fin = H.shuffle(P.roster), seq = H.reduced() ? [fin] : [H.shuffle(P.roster), H.shuffle(P.roster), fin];
    each(ol.querySelectorAll(".n"), function (n) { n.classList.remove("is-on"); });
    var hint = P.body.querySelector(".pg-hint"); if (hint) hint.remove();
    P.setFoot('<button type="button" class="pa-btn is-primary is-lg" disabled>' + ic("shuffle") + "섞는 중</button>");
    var chain = Promise.resolve();
    seq.forEach(function (o, i) { chain = chain.then(function () { if (P.st !== s) return; P.sfx("shuffle"); return flip(ol, o, i === seq.length - 1 ? 460 : 200); }); });
    chain.then(function () {
      if (P.st !== s) return;
      var ns = ol.querySelectorAll(".n"), gap = H.reduced() ? 0 : Math.max(55, Math.min(110, 1200 / ns.length));
      each(ns, function (n, i) { later(s, i * gap, function () { n.classList.add("is-on"); P.sfx(i === 0 ? "coin" : "tick"); }); });
      later(s, ns.length * gap + 120, function () {
        s.order = fin; P.busy = false; P.setFoot(orderFoot(s)); H.buzz(30); P.save(); P.confetti({ n: 60, from: "top" });
        H.say("순서. " + fin.slice(0, 5).map(function (n, i) { return (i + 1) + "번 " + disp(n); }).join(", "));
      });
    });
  }

  /* 팀: 몇 팀인지 고르고, 카드 돌리듯 한 사람씩 팀에 넣는다 */
  function teamsHTML(teams, delays, n) {
    var per = Math.ceil(n / teams.length);
    return teams.map(function (m, t) {
      var c = TEAMS[t][1], ph = "";
      if (!m.length) for (var k = 0; k < per; k++) ph += '<li class="ph" aria-hidden="true"></li>';
      return '<div class="team" style="border-color:' + c + "66;background:linear-gradient(180deg," + c + "30," + c + '0A)"><h4><i style="background:' + c + ";color:" + c + '"></i>' + TEAMS[t][0] + "팀"
        + (m.length ? '<span class="n">' + m.length + "명</span>" : "") + "</h4><ul>"
        + m.map(function (x, j) { return "<li" + (delays ? ' style="animation-delay:' + delays[t][j] + 'ms"' : "") + '><span class="tok is-xs" style="--c:' + c + '" aria-hidden="true">' + esc(H.initial(x)) + "</span><span>" + esc(disp(x)) + "</span></li>"; }).join("") + ph + "</ul></div>";
    }).join("");
  }
  function pickTeams(s) {
    var n = P.roster.length;
    if (n < 4) {
      P.screen({ body: segHTML(s) + '<div class="pg-card"><p class="pg-p">팀 나누기는 4명부터 할 수 있어요. 참여 인원을 ' + (4 - n) + "명 더 늘려 주세요.</p></div>", foot: "", say: "팀 나누기는 4명부터예요." });
      return;
    }
    var maxT = Math.min(6, Math.floor(n / 2)), chips = "";
    if (s.teamN > maxT || s.teamN < 2) { s.teamN = Math.min(Math.max(2, s.teamN), maxT); s.teams = null; }
    for (var k = 2; k <= maxT; k++) chips += '<button type="button" class="pchip" data-act="team-n" data-n="' + k + '" aria-pressed="' + (k === s.teamN) + '">' + k + "팀</button>";
    var empty = []; for (var t = 0; t < s.teamN; t++) empty.push([]);
    P.screen({
      body: segHTML(s) + sect("팀 수", '<div class="pchips">' + chips + "</div>") + '<div class="teams" id="teamsBox">' + teamsHTML(s.teams || empty, null, n) + "</div>",
      foot: teamFoot(s),
      say: "팀 나누기. " + n + "명을 " + s.teamN + "팀으로."
    });
  }
  function teamFoot(s) {
    return s.teams ? '<div class="pg-row">' + btn("copy-teams", ic("copy", "is-sm") + "복사", "is-ghost") + btn("deal-teams", ic("shuffle") + "다시 나누기", "is-primary") + "</div>"
      : btn("deal-teams", ic("shuffle") + "팀 나누기", "is-primary is-lg is-glow");
  }
  function dealTeams(s) {
    var box = $("teamsBox"); if (!box) return;
    P.busy = true;
    var sh = H.shuffle(P.roster), T = s.teamN, teams = [], delays = [];
    for (var t = 0; t < T; t++) { teams.push([]); delays.push([]); }
    var gap = H.reduced() ? 0 : Math.max(70, Math.min(140, 1700 / sh.length));
    sh.forEach(function (m, k) { teams[k % T].push(m); delays[k % T].push(k * gap); });
    box.innerHTML = teamsHTML(teams, delays, sh.length);
    P.setFoot('<button type="button" class="pa-btn is-primary is-lg" disabled>' + ic("shuffle") + "나누는 중</button>");
    P.sfx("shuffle");
    sh.forEach(function (m, k) { later(s, k * gap + 40, function () { P.sfx("deal"); }); });
    later(s, sh.length * gap + 260, function () {
      s.teams = teams; P.busy = false; P.sfx("coin"); H.buzz(30); P.setFoot(teamFoot(s)); P.save(); P.confetti({ n: 60, from: "top", colors: TEAMS.slice(0, T).map(function (x) { return x[1]; }).concat(["#FFFFFF"]) });
      H.say(teams.map(function (m, i) { return TEAMS[i][0] + "팀 " + m.map(disp).join(", "); }).join(". "));
    });
  }

  /* 카드: 더미 둘(미션, 이야기). 한 장 돌리고 뒤집는다. 받을 사람은 따로 뽑는다 */
  function pickCard(s, fx) {
    var pk = P.pack();
    if (!s.card) {
      P.screen({
        body: segHTML(s) + '<div class="pg-mid"><div class="decks">' + ["missions", "talk"].map(function (d) {
          var D = DECKS[d];
          return '<button type="button" class="deck ' + D.cls + '" data-act="deck" data-deck="' + d + '"><span class="stack" aria-hidden="true"><i></i><i></i><i>' + ic(D.icon) + "</i></span>"
            + "<b>" + D.name + "</b><span>" + D.sub + " " + pk[d].length + "장</span></button>";
        }).join("") + '</div><p class="pg-hint">카드 더미를 누르면 한 장 뽑아요. 하기 싫으면 다음 카드를 눌러요.</p></div>',
        foot: "", say: "카드 뽑기. 미션 카드와 이야기 카드."
      });
      return;
    }
    var D = DECKS[s.deck];
    P.screen({
      body: segHTML(s) + '<div class="cardv ' + D.cls + (fx ? " is-deal" : " is-open") + '" id="cardv"><div class="in"><div class="face back"><span class="emb">' + ic(D.icon) + '</span></div><div class="face front">' + cardFront(s) + "</div></div></div>"
        + '<div class="who-roll" id="whoRoll" hidden></div>',
      foot: '<div class="pg-row">' + btn("card-who", ic("target", "is-sm") + "받을 사람 뽑기", "is-ghost") + btn("card-next", ic("cards", "is-sm") + "다음 카드", "is-primary") + "</div>" + btn("card-back", "더미로 돌아가기", "is-text"),
      say: D.lb + " 카드. " + s.card
    });
    if (fx) {
      P.sfx("deal");
      later(s, H.reduced() ? 60 : 520, function () { var c = $("cardv"); if (c) { c.classList.add("is-open"); P.sfx("flip"); } });
    }
  }
  function cardFront(s) {
    var D = DECKS[s.deck];
    return '<span class="lb">' + ic(D.icon, "is-sm") + D.lb + '</span><p class="tx">' + esc(s.card) + "</p>" + (s.cardFor ? '<span class="for">' + tok(s.cardFor, "sm") + esc(disp(s.cardFor)) + " 님</span>" : "");
  }
  function drawCard(s) {
    if (!DECKS[s.deck]) return;
    s.card = H.draw(P.pack()[s.deck], s.deck === "missions" ? s.usedM : s.usedT);
    s.cardFor = null;
    pickRender(s, true);
  }
  function rollWho(s) {
    var box = $("whoRoll"); if (!box) return;
    P.busy = true;
    var list = P.roster, win = Math.floor(Math.random() * list.length);
    box.hidden = false; box.innerHTML = list.map(function (n) { return tok(n, "md"); }).join("");
    var toks = box.children, len = list.length, total = H.reduced() ? win : win + len * Math.max(1, Math.ceil(16 / len)), t = 0, prev = null;
    for (var j = 0; j <= total; j++) {
      t += (2200 / Math.max(1, total)) * (0.4 + 1.8 * Math.pow(j / Math.max(1, total), 2));
      (function (j, at) {
        later(s, at, function () {
          if (prev) prev.classList.remove("is-hit");
          prev = toks[j % list.length]; prev.classList.add("is-hit");
          if (j < total) P.sfx("tick");
          else {
            s.cardFor = list[win]; P.busy = false; P.sfx("coin"); H.buzz(30);
            var f = P.body.querySelector("#cardv .front"); if (f) f.innerHTML = cardFront(s);
            H.say(disp(list[win]) + " 님이 받아요."); P.save();
          }
        });
      })(j, t);
    }
  }

  /* ============================================================
     밸런스 게임: 문제, 한 사람씩 몰래 고르기, 3 2 1 공개, 다수 쪽 1점, 공감왕
     ============================================================ */
  var bal = P.games.balance = {
    title: "밸런스 게임", min: 2,
    fresh: function (pf) {
      return { phase: "setup", cats: Array.isArray(pf.cats) ? pf.cats : null, rounds: [5, 10, 15].indexOf(pf.rounds) >= 0 ? pf.rounds : 10, used: Array.isArray(pf.used) ? pf.used : [],
        round: 0, q: null, qc: "", i: 0, players: [], picks: {}, scores: {}, hist: [] };
    },
    prefs: function (s) { return { cats: s.cats, rounds: s.rounds, used: s.used }; },
    dirty: function (s) { return !/^(setup|final)$/.test(s.phase); },
    restore: function (v, pf) {
      if (!v || typeof v !== "object") return null;
      var s = bal.fresh(pf);
      ["cats", "rounds", "used", "round", "q", "qc", "i", "players", "picks", "scores", "hist", "phase"].forEach(function (k) { if (v[k] !== undefined && v[k] !== null) s[k] = v[k]; });
      var ok = Array.isArray(s.players) && s.players.length >= 2 && s.players.every(inRoster) && Array.isArray(s.hist) && s.picks && s.scores;
      if (!/^(setup|q|hand|choose|wait|reveal|final)$/.test(s.phase)) s.phase = "setup";
      if (s.phase !== "setup" && !ok) return Object.assign(bal.fresh(pf), { cats: s.cats, rounds: s.rounds });
      if (/^(q|hand|choose|wait)$/.test(s.phase) && !(Array.isArray(s.q) && s.q.length === 2)) s.phase = "setup";
      if (s.phase === "choose") s.phase = "hand";
      if (s.phase === "reveal" && !s.hist.length) s.phase = "wait";
      if (s.phase === "final" && !s.hist.length) s.phase = "setup";
      s.i = H.clamp(s.i | 0, 0, s.players.length);
      return s;
    },
    show: function (s) { balShow(s, false); },
    people: function () { H.syncPpl(); },
    act: balAct
  };
  function selCats(s) {
    var pk = P.pack().balance, all = Object.keys(pk);
    var sel = Array.isArray(s.cats) ? s.cats.filter(function (c) { return pk[c]; }) : [];
    return sel.length ? sel : all;
  }
  function balShow(s, fx) {
    var prog = { n: s.rounds, i: s.round - 1 };
    if (s.phase === "setup") return balSetup(s);
    if (s.phase === "q") {
      P.screen({
        body: balMeta(s) + '<div class="pg-mid"><div class="bq"><div class="bq-opt is-a"><small>A</small>' + esc(s.q[0]) + '</div><div class="vs" aria-hidden="true">VS</div><div class="bq-opt is-b"><small>B</small>' + esc(s.q[1]) + "</div></div>"
          + '<p class="pg-hint">다 같이 읽고, 폰을 ' + esc(disp(s.players[0])) + " 님에게 넘겨요</p></div>",
        foot: btn("begin", "고르기 시작" + ic("next"), "is-primary is-lg is-glow") + (s.i === 0 ? btn("swap", ic("swap", "is-sm") + "다른 문제로", "is-text") : ""),
        prog: prog, say: "문제 " + s.round + ". A " + s.q[0] + ", B " + s.q[1]
      });
      return;
    }
    if (s.phase === "hand") {
      var who = s.players[s.i];
      P.screen({
        body: handHTML(who, "혼자 보고 하나만 골라요", s.players.length, s.i),
        foot: btn("got", "받았어요", "is-primary is-lg") + (s.i > 0 ? btn("undo", ic("undo", "is-sm") + "앞사람이 다시 고르기", "is-text") : ""),
        prog: prog, say: disp(who) + " 님 차례예요. 폰을 받으면 받았어요 버튼을 눌러 주세요."
      });
      P.sfx("wood");
      return;
    }
    if (s.phase === "choose") {
      var me = s.players[s.i];
      P.screen({
        body: '<p class="chooser">' + tok(me, "sm") + "<span><b>" + esc(disp(me)) + "</b> 님의 선택</span></p>"
          + '<div class="bq is-choose"><button type="button" class="bq-opt is-a" data-act="pick" data-v="0"><small>A</small>' + esc(s.q[0]) + '</button><div class="vs" aria-hidden="true">VS</div>'
          + '<button type="button" class="bq-opt is-b" data-act="pick" data-v="1"><small>B</small>' + esc(s.q[1]) + "</button></div>"
          + '<p class="pg-hint">고르면 바로 다음 사람에게 넘어가요</p>',
        foot: "", prog: prog, say: disp(me) + " 님, A와 B 중 하나를 골라 주세요."
      });
      return;
    }
    if (s.phase === "wait") {
      var n = s.players.length;
      P.screen({
        body: '<div class="hand"><span class="pass">' + ic("check", "is-sm") + '모두 골랐어요</span><div class="pg-intro-art">' + H.art("balance") + '</div><p class="hand-who">결과 공개</p><p class="msg">폰을 가운데 두고 같이 봐요</p>' + dots(n, n) + "</div>",
        foot: btn("reveal", ic("eye") + "결과 공개", "is-primary is-lg is-glow") + btn("undo", ic("undo", "is-sm") + "앞사람이 다시 고르기", "is-text"),
        prog: prog, say: "모두 골랐어요. 결과 공개를 눌러 주세요."
      });
      P.sfx("coin");
      return;
    }
    if (s.phase === "reveal") return balRevealScreen(s, fx);
    if (s.phase === "final") return balFinal(s, fx);
  }
  function balMeta(s) { return '<div class="bq-meta"><span class="bq-cat">' + ic("star", "is-sm") + esc(s.qc) + '</span><span class="pg-kicker">문제 ' + s.round + " / " + s.rounds + "</span></div>"; }
  function balSetup(s) {
    var pk = P.pack().balance, cats = Object.keys(pk), sel = selCats(s);
    P.screen({
      body: intro("balance", "밸런스 게임", "둘 중 하나를 몰래 고르고 다 같이 공개해요.")
        + pplSect(bal.min)
        + sect("문제 종류", '<div class="pchips">' + cats.map(function (c) { return '<button type="button" class="pchip" data-act="cat" data-cat="' + esc(c) + '" aria-pressed="' + (sel.indexOf(c) >= 0) + '">' + esc(c) + ' <span class="n">' + pk[c].length + "</span></button>"; }).join("") + "</div>")
        + sect("문제 수", '<div class="seg" style="--n:3" role="group" aria-label="문제 수">' + [5, 10, 15].map(function (k) { return '<button type="button" aria-pressed="' + (s.rounds === k) + '" data-act="rounds" data-n="' + k + '">' + k + "문제</button>"; }).join("") + "</div>")
        + sect("하는 법", steps(["문제를 같이 읽어요", "폰을 돌려 가며 혼자 몰래 골라요", "다 고르면 한꺼번에 공개하고, 다수 쪽이 1점을 받아요"])),
      foot: btn("start", ic("play") + "시작하기", "is-primary is-lg is-glow"),
      say: "밸런스 게임. 문제 종류와 수를 고르고 시작해요."
    });
  }
  function balAct(a, el, s) {
    if (a === "cat") {
      var pk = P.pack().balance, c = el.getAttribute("data-cat"), sel = selCats(s).slice(), i = sel.indexOf(c);
      if (i >= 0) { if (sel.length === 1) { H.toast("한 가지는 골라 주세요."); return; } sel.splice(i, 1); } else sel.push(c);
      s.cats = sel.length === Object.keys(pk).length ? null : sel;
      el.setAttribute("aria-pressed", String(i < 0)); P.sfx("select"); P.save(); return;
    }
    if (a === "rounds") { s.rounds = Number(el.getAttribute("data-n")); each(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", String(b === el)); }); P.sfx("select"); P.save(); return; }
    if (a === "start" || a === "again") { balStart(s); return; }
    if (a === "swap") { balPickQ(s); balShow(s); P.sfx("flip"); return; }
    if (a === "begin") { s.i = 0; s.phase = "hand"; balShow(s); return; }
    if (a === "got") { s.phase = "choose"; balShow(s); return; }
    if (a === "pick") { balPick(s, el); return; }
    if (a === "undo") { if (s.i > 0) { s.i--; delete s.picks[s.players[s.i]]; s.phase = "hand"; balShow(s); } return; }
    if (a === "reveal") { balReveal(s); return; }
    if (a === "next") { balNextQ(s); return; }
    if (a === "final") { s.phase = "final"; balShow(s, true); return; }
    if (a === "share") { P.share({ title: "밸런스 게임 한 판 끝", desc: s.players.length + "명이 " + s.hist.length + "문제로 밸런스 게임을 했어요. 모임 자리에서 폰 하나로 하는 게임" }); return; }
    if (a === "copy") {
      var rk = ranking(s.players, s.scores);
      var lines = duoOf(s) ? [s.players.map(disp).join(", ") + " 둘이 통한 문제 " + agreeOf(s) + "개"] : rk.map(function (x) { return x.pos + "등 " + disp(x.n) + " " + x.p + "점"; });
      P.copy(["밸런스 게임 결과 (" + s.hist.length + "문제)"].concat(lines, ["", "동네친구들 모임 자리 게임 " + siteUrl()]).join("\n"));
    }
  }
  function balStart(s) {
    s.players = P.roster.slice(); s.scores = {}; s.players.forEach(function (n) { s.scores[n] = 0; });
    s.hist = []; s.round = 0;
    balNextQ(s);
  }
  function balPickQ(s) {
    var pk = P.pack().balance, all = [];
    selCats(s).forEach(function (c) { pk[c].forEach(function (q) { all.push([c, q]); }); });
    var x = H.draw(all, s.used, function (y) { return y[0] + "|" + y[1][0] + "|" + y[1][1]; });
    s.qc = x[0]; s.q = [x[1][0], x[1][1]]; s.picks = {}; s.i = 0;
  }
  function balNextQ(s) {
    s.round++; balPickQ(s); s.phase = "q";
    P.busy = true; P.save();
    P.splash({ k: "문제", big: String(s.round), sub: "총 " + s.rounds + "문제" }).then(function () { if (P.st !== s) return; P.busy = false; balShow(s); });
  }
  function balPick(s, el) {
    var v = Number(el.getAttribute("data-v")), who = s.players[s.i];
    P.busy = true;
    each(P.body.querySelectorAll(".bq-opt"), function (o, k) { o.classList.add(k === v ? "is-picked" : "is-other"); });
    el.insertAdjacentHTML("beforeend", '<span class="chk">' + ic("check") + "</span>");
    P.sfx("select"); H.buzz(18);
    later(s, H.reduced() ? 150 : 560, function () {
      s.picks[who] = v; s.i++; s.phase = s.i < s.players.length ? "hand" : "wait"; P.busy = false; balShow(s);
    });
  }
  function balReveal(s) {
    P.busy = true;
    P.splash({ seq: [{ k: "결과 공개", big: "3", sound: "beep" }, { k: "결과 공개", big: "2", sound: "beep" }, { k: "결과 공개", big: "1", sound: "beep" }], ms: 640 }).then(function () {
      if (P.st !== s) return;
      var A = s.players.filter(function (n) { return s.picks[n] === 0; }), B = s.players.filter(function (n) { return s.picks[n] === 1; });
      var maj = A.length > B.length ? 0 : B.length > A.length ? 1 : -1;
      if (maj >= 0) (maj ? B : A).forEach(function (n) { s.scores[n] = (s.scores[n] || 0) + 1; });
      s.hist.push({ q: s.q, c: s.qc, a: A, b: B, maj: maj });
      s.phase = "reveal"; P.busy = false;
      balShow(s, true);
    });
  }
  // 둘이 할 때: 다수 쪽 1점은 늘 같은 점수가 되므로, 같은 쪽을 고른 문제(통한 문제)를 센다
  function duoOf(s) { return s.players.length === 2; }
  var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20.6s-7.6-4.6-7.6-10.1A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.6 2.8c0 5.5-7.6 10.1-7.6 10.1z" fill="#F472B6" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  // 둘이 한 판의 끝: 두 사람 동그라미와 하트, 문제마다 통했는지(같으면 고른 쪽, 갈리면 누가 무엇을)
  function duoHTML(s) {
    return '<div class="duo-pair">' + tok(s.players[0], "lg") + '<span class="duo-heart">' + HEART + "</span>" + tok(s.players[1], "lg") + "</div>";
  }
  function duoList(s) {
    return '<ol class="duo-list">' + s.hist.map(function (h, i) {
      var same = h.maj >= 0;
      var t = same ? "둘 다 " + h.q[h.maj] : disp(h.a[0]) + " " + h.q[0] + ", " + disp(h.b[0]) + " " + h.q[1];
      return '<li class="' + (same ? "is-same" : "is-diff") + '"><span class="n">' + (i + 1) + '</span><span class="q">' + esc(t) + '</span><span class="r">' + (same ? ic("check", "is-sm") + "통함" : "갈림") + "</span></li>";
    }).join("") + "</ol>";
  }
  function agreeOf(s) { return s.hist.filter(function (h) { return h.maj >= 0; }).length; }
  function balRevealScreen(s, fx) {
    var h = s.hist[s.hist.length - 1], A = h.a, B = h.b, tot = A.length + B.length, duo = duoOf(s);
    var pa = tot ? Math.round(A.length / tot * 100) : 0, pb = tot ? 100 - pa : 0, last = s.round >= s.rounds;
    function side(list, k) {
      var maj = h.maj === k, pct = k ? pb : pa;
      return '<div class="side2 is-' + (k ? "b" : "a") + '">' + (duo ? "" : h.maj === -1 ? '<span class="stamp is-tie">동률</span>' : maj ? '<span class="stamp">다수</span>' : "")
        + '<span class="lb">' + (k ? "B " : "A ") + esc(h.q[k]) + '</span><span class="pct" data-to="' + pct + '">' + (fx ? 0 : pct) + '%</span><span class="cnt">' + list.length + "명</span>"
        + (list.length ? "<ul>" + list.map(function (n, i) { return '<li style="--i:' + i + '">' + tok(n, "xs") + "<span>" + esc(disp(n)) + "</span>" + (maj && !duo ? '<b class="plus1" aria-hidden="true">+1</b>' : "") + "</li>"; }).join("") + "</ul>" : '<p class="none">아무도 없어요</p>') + "</div>";
    }
    var award = duo ? (h.maj === -1 ? '<p class="award is-tie">서로 다른 쪽을 골랐어요.</p>' : '<p class="award">둘이 같은 쪽을 골랐어요. 통했어요!</p>')
      : h.maj === -1 ? '<p class="award is-tie">반반으로 나뉘었어요. 이번 문제는 점수가 없어요.</p>'
      : '<p class="award">다수 쪽 ' + (h.maj ? B : A).length + "명이 1점씩 받아요</p>";
    P.screen({
      body: balMeta(s) + '<div class="bar2" role="img" aria-label="A ' + pa + "퍼센트, B " + pb + '퍼센트"><i class="a" data-w="' + pa + '"></i><i class="b" data-w="' + pb + '"></i></div>'
        + '<div class="sides2">' + side(A, 0) + side(B, 1) + "</div>" + award
        + (duo ? sect("통한 문제", '<p class="duo-n"><b>' + agreeOf(s) + "</b> / " + s.hist.length + "</p>") : sect("지금 순위", boardHTML(ranking(s.players, s.scores), 3))),
      foot: last ? btn("final", ic("trophy") + "최종 결과", "is-primary is-lg is-glow") : btn("next", "다음 문제" + ic("next"), "is-primary is-lg"),
      prog: { n: s.rounds, i: s.round },
      say: "A " + A.length + "명, B " + B.length + "명. " + (duo ? (h.maj === -1 ? "서로 다른 쪽을 골랐어요." : "둘이 같은 쪽을 골랐어요.") : h.maj === -1 ? "동률이에요." : (h.maj ? "B" : "A") + " 쪽이 다수예요.")
    });
    fillBars();
    if (fx) {
      each(P.body.querySelectorAll(".pct"), function (el) { countUp(el, Number(el.getAttribute("data-to")), 900, 80); });
      P.sfx("crash"); H.buzz(40);
      later(s, 1100, function () { P.sfx("stamp"); });
      if (h.maj >= 0) { later(s, 1200, function () { P.confetti({ n: 80 }); }); later(s, 1550, function () { P.sfx("coin"); }); }
    }
  }
  function podiumHTML(rk) {
    var slots = [rk[1], rk[0], rk[2]], dl = [0.75, 1.0, 0.5], gd = [0.15, 0.3, 0];
    return '<div class="podium">' + slots.map(function (x, i) {
      if (!x) return '<div class="pod" aria-hidden="true"></div>';
      var c = x.pos === 1 ? "p1" : x.pos === 2 ? "p2" : "p3";
      return '<div class="pod ' + c + '" style="--dl:' + dl[i] + "s;--gd:" + gd[i] + 's">' + (x.pos === 1 && x.p > 0 ? '<span class="crown">' + CROWN + "</span>" : "")
        + tok(x.n, i === 1 ? "lg" : "md") + '<span class="nm">' + esc(disp(x.n)) + '</span><span class="pts">' + x.p + '점</span><div class="blk">' + x.pos + "</div></div>";
    }).join("") + "</div>";
  }
  function balFinal(s, fx) {
    var rk = ranking(s.players, s.scores), champs = rk.filter(function (x) { return x.pos === 1 && x.p > 0; }), allSame = champs.length === rk.length || !champs.length;
    var names = champs.length > 2 ? disp(champs[0].n) + " 외 " + (champs.length - 1) + "명" : champs.map(function (x) { return disp(x.n); }).join(", ");
    var duo = duoOf(s), agree = agreeOf(s), all = s.hist.length;
    var head = duo
      ? '<div class="champ"><span class="k">둘이 통한 문제</span>' + duoHTML(s) + '<p class="big">' + agree + " / " + all + '</p><p class="pg-p">' + (agree === all ? "모든 문제에서 같은 쪽을 골랐어요." : !agree ? "한 번도 같은 쪽을 고르지 않았어요." : "같은 쪽을 고른 문제예요.") + "</p></div>"
      : allSame
      ? '<div class="champ"><span class="k">이번 판은</span><p class="big">모두 같은 점수예요</p></div>'
      : '<div class="champ"><span class="k">공감왕</span><p class="big">' + esc(names) + '</p><p class="pg-p">' + (champs.length > 1 ? "공동 1등이에요. " : "") + "다수 쪽을 가장 많이 골랐어요.</p></div>";
    P.screen({
      body: head + (duo || allSame ? "" : podiumHTML(rk)) + (duo ? sect("문제별로", duoList(s)) : sect("전체 순위", boardHTML(rk)))
        + '<div class="pg-share">' + btn("share", ic("share", "is-sm") + "카카오톡 공유", "is-ghost is-sm") + btn("copy", ic("copy", "is-sm") + "결과 복사", "is-ghost is-sm") + "</div>",
      foot: '<div class="pg-row">' + btn("leave", ic("home", "is-sm") + "처음으로", "is-ghost") + btn("again", ic("refresh") + "한 판 더", "is-primary is-wide") + "</div>",
      say: duo ? all + "문제 중 " + agree + "문제가 통했어요." : allSame ? "모두 같은 점수예요." : "공감왕은 " + champs.map(function (x) { return disp(x.n); }).join(", ") + " 님이에요."
    });
    fillBars();
    var big = duo ? agree * 2 > all : !allSame;
    if (fx) { P.sfx("win"); H.buzz([60, 40, 120]); P.confetti({ n: big ? 190 : 90 }); if (big) later(s, 950, function () { P.confetti({ from: "top", n: 110 }); }); }
  }

  /* ============================================================
     라이어 게임: 몰래 카드 확인, 토론(타이머), 지목, 판정, 라이어의 마지막 기회
     ============================================================ */
  var TM = { iv: 0, sec: -1 }, CIRC = 628.32;
  function timerStop() { clearInterval(TM.iv); TM.iv = 0; }
  var liar = P.games.liar = {
    title: "라이어 게임", min: 3,
    fresh: function (pf) {
      return { phase: "setup", cat: typeof pf.cat === "string" ? pf.cat : "", timer: [0, 120, 180, 300].indexOf(pf.timer) >= 0 ? pf.timer : 180, mode: pf.mode === "fool" ? "fool" : "normal", fake: "",
        tally: pf.tally && typeof pf.tally === "object" ? { c: pf.tally.c | 0, l: pf.tally.l | 0 } : { c: 0, l: 0 }, round: pf.round | 0, used: Array.isArray(pf.used) ? pf.used : [],
        players: [], liar: "", word: "", topic: "", i: 0, seen: false, order: [], total: 0, endAt: 0, left: 0, running: false, chosen: "", caught: false, opts: [], guess: "", win: "", counted: false };
    },
    prefs: function (s) { return { cat: s.cat, timer: s.timer, mode: s.mode, tally: s.tally, round: s.round, used: s.used }; },
    dirty: function (s) { return !/^(setup|result)$/.test(s.phase); },
    restore: function (v, pf) {
      if (!v || typeof v !== "object") return null;
      var s = liar.fresh(pf);
      Object.keys(s).forEach(function (k) { if (v[k] !== undefined && v[k] !== null) s[k] = v[k]; });
      if (!/^(setup|hand|card|talk|vote|verdict|guess|result)$/.test(s.phase)) s.phase = "setup";
      if (s.mode !== "fool") s.mode = "normal";
      var ok = Array.isArray(s.players) && s.players.length >= 3 && s.players.every(inRoster) && s.players.indexOf(s.liar) >= 0 && s.word && s.topic && sameSet(s.order, s.players)
        && (!s.fake || (typeof s.fake === "string" && s.fake !== s.word));
      if (s.phase !== "setup" && !ok) return Object.assign(liar.fresh(pf), { cat: s.cat, timer: s.timer, mode: s.mode, tally: s.tally, round: s.round, used: s.used });
      if (s.phase === "card") { s.phase = "hand"; s.seen = false; }
      if (/^(verdict|guess|result)$/.test(s.phase) && s.players.indexOf(s.chosen) < 0) s.phase = "vote";
      if (s.phase === "guess" && s.guess && s.win) {   // 답을 고른 뒤 새로고침했으면 다시 고르지 않게
        s.phase = "result";
        if (!s.counted) { s.counted = true; if (s.win === "liar") s.tally.l++; else s.tally.c++; }
      }
      if (s.phase === "result" && !s.win) s.phase = "vote";
      s.i = H.clamp(s.i | 0, 0, s.players.length - 1);
      if (s.running) { if (s.endAt > Date.now()) s.left = (s.endAt - Date.now()) / 1000; else { s.left = 0; s.running = false; s.endAt = 0; } }
      return s;
    },
    show: function (s) { liarShow(s, false); },
    people: function () { H.syncPpl(); },
    stop: timerStop,
    wake: function (s) { if (s.phase === "talk") timerTick(s, true); },
    act: liarAct
  };
  function liarShow(s, fx) {
    timerStop();
    if (s.phase === "setup") return liarSetup(s);
    if (s.phase === "hand") {
      var who = s.players[s.i];
      P.screen({ body: handHTML(who, "혼자 카드를 확인해요", s.players.length, s.i), foot: btn("got", "받았어요", "is-primary is-lg"), say: disp(who) + " 님 차례예요. 폰을 받으면 받았어요 버튼을 눌러 주세요." });
      P.sfx("wood");
      return;
    }
    if (s.phase === "card") return liarCard(s);
    if (s.phase === "talk") return liarTalk(s);
    if (s.phase === "vote") return liarVote(s);
    if (s.phase === "verdict") return liarVerdict(s, fx);
    if (s.phase === "guess") return liarGuess(s);
    if (s.phase === "result") return liarResult(s, fx);
  }
  function tallyHTML(s, up) {
    return '<div class="tally"><div class="sd is-citizen' + (up === "citizen" ? " is-up" : "") + '"><small>시민</small><b>' + s.tally.c + '</b></div><span class="colon" aria-hidden="true">:</span>'
      + '<div class="sd is-liar' + (up === "liar" ? " is-up" : "") + '"><small>라이어</small><b>' + s.tally.l + "</b></div></div>";
  }
  // 바보 모드(라이어 게임 앱에서 흔한 규칙): 라이어도 같은 주제의 다른 제시어를 받아 자기가 라이어인 줄 모른다
  var MODE_DESC = { normal: "라이어는 제시어 대신 라이어 카드를 받아요.", fool: "라이어도 같은 주제의 다른 제시어를 받아요. 자기가 라이어인 줄 몰라요." };
  function liarSetup(s) {
    var pk = P.pack().liar, cats = Object.keys(pk);
    if (s.cat && !pk[s.cat]) s.cat = "";
    var chips = '<button type="button" class="pchip" data-act="cat" data-cat="" aria-pressed="' + (!s.cat) + '">아무거나</button>'
      + cats.map(function (c) { return '<button type="button" class="pchip" data-act="cat" data-cat="' + esc(c) + '" aria-pressed="' + (s.cat === c) + '">' + esc(c) + "</button>"; }).join("");
    var seg = '<div class="seg" style="--n:4" role="group" aria-label="토론 시간">' + [[0, "없음"], [120, "2분"], [180, "3분"], [300, "5분"]].map(function (t) {
      return '<button type="button" aria-pressed="' + (s.timer === t[0]) + '" data-act="timer" data-t="' + t[0] + '">' + t[1] + "</button>";
    }).join("") + "</div>";
    var modes = '<div class="seg" style="--n:2" role="group" aria-label="모드">' + [["normal", "일반"], ["fool", "바보"]].map(function (m) {
      return '<button type="button" aria-pressed="' + (s.mode === m[0]) + '" data-act="lmode" data-m="' + m[0] + '">' + m[1] + "</button>";
    }).join("") + '</div><p class="mode-desc" id="modeDesc">' + MODE_DESC[s.mode] + "</p>";
    P.screen({
      body: intro("liar", "라이어 게임", "한 사람만 다른 카드를 받아요. 대화로 라이어를 찾아요.")
        + pplSect(liar.min)
        + (s.tally.c + s.tally.l ? sect("지금까지 전적", tallyHTML(s, "")) : "")
        + sect("모드", modes) + sect("주제", '<div class="pchips">' + chips + "</div>") + sect("토론 시간", seg)
        + sect("하는 법", steps(["폰을 돌려 가며 몰래 카드를 확인해요", "한 사람씩 제시어를 한마디로 설명해요", "다 같이 라이어를 지목해요"])),
      foot: btn("start", ic("play") + "시작하기", "is-primary is-lg is-glow"),
      say: "라이어 게임. 주제와 토론 시간을 고르고 시작해요."
    });
  }
  function liarAct(a, el, s) {
    if (a === "cat") { s.cat = el.getAttribute("data-cat"); each(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", String(b === el)); }); P.sfx("select"); P.save(); return; }
    if (a === "timer") { s.timer = Number(el.getAttribute("data-t")); each(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", String(b === el)); }); P.sfx("select"); P.save(); return; }
    if (a === "lmode") {
      s.mode = el.getAttribute("data-m") === "fool" ? "fool" : "normal";
      each(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", String(b === el)); });
      var md = $("modeDesc"); if (md) md.textContent = MODE_DESC[s.mode];
      P.sfx("select"); P.save(); return;
    }
    if (a === "start" || a === "again") { liarStart(s); return; }
    if (a === "got") { s.phase = "card"; s.seen = false; liarShow(s); return; }
    if (a === "card-next") {
      if (!s.seen) return;
      s.i++;
      if (s.i < s.players.length) { s.phase = "hand"; s.seen = false; liarShow(s); return; }
      s.phase = "talk"; s.total = s.left = s.timer; s.running = false; s.endAt = 0;
      P.busy = true; P.save();
      P.splash({ big: "토론 시작", word: true, sub: disp(s.order[0]) + " 님부터", sound: "go" }).then(function () {
        if (P.st !== s) return;
        P.busy = false;
        if (s.timer) { s.running = true; s.endAt = Date.now() + s.left * 1000; }
        liarShow(s);
      });
      return;
    }
    if (a === "timer-toggle") {
      if (s.left <= 0 && !s.running) { s.total = s.left = s.timer || 60; }
      if (s.running) { s.left = Math.max(0, (s.endAt - Date.now()) / 1000); s.running = false; s.endAt = 0; }
      else { s.running = true; s.endAt = Date.now() + s.left * 1000; }
      timerTick(s, true); P.save(); return;
    }
    if (a === "timer-add") {
      if (s.running) { s.endAt += 60000; s.total += 60; }
      else if (s.left <= 0) { s.total = s.left = 60; s.running = true; s.endAt = Date.now() + 60000; }
      else { s.left += 60; s.total += 60; }
      timerTick(s, true); P.sfx("coin"); H.toast("1분 늘렸어요."); P.save(); return;
    }
    if (a === "to-vote") { if (s.running) { s.left = Math.max(0, (s.endAt - Date.now()) / 1000); s.running = false; s.endAt = 0; } s.phase = "vote"; liarShow(s); P.sfx("whoosh"); return; }
    if (a === "to-talk") { s.phase = "talk"; liarShow(s); return; }
    if (a === "vote") {
      s.chosen = s.players[Number(el.getAttribute("data-i"))] || "";
      each(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", String(b === el)); });
      P.setFoot(decideBtn(s)); P.sfx("select"); P.save(); return;
    }
    if (a === "decide") { if (!s.chosen) return; s.caught = s.chosen === s.liar; s.phase = "verdict"; liarShow(s, true); return; }
    if (a === "to-guess") { s.phase = "guess"; liarShow(s); return; }
    if (a === "guess") { liarGuessPick(s, el); return; }
    if (a === "to-result") { s.win = "liar"; liarResultEnter(s); return; }
    if (a === "share") { P.share({ title: "라이어 게임 한 판 끝", desc: "시민 " + s.tally.c + " 대 라이어 " + s.tally.l + ". 모임 자리에서 폰 하나로 하는 게임" }); return; }
  }
  // 너무 비슷해 한마디 설명으로 갈리지 않는 낱말 묶음(질문 묶음의 liarClose). 바보 모드의 라이어 제시어와 마지막 기회 보기에서 뺀다
  function closeTo(topic, w) {
    var out = [];
    ((P.pack().liarClose || {})[topic] || []).forEach(function (g) { if (Array.isArray(g) && g.indexOf(w) >= 0) out = out.concat(g); });
    return out;
  }
  function liarStart(s) {
    var pk = P.pack().liar, topics = Object.keys(pk), topic = s.cat && pk[s.cat] ? s.cat : H.rnd(topics);
    s.topic = topic;
    s.word = H.draw(pk[topic], s.used, function (w) { return topic + "|" + w; });
    var near = closeTo(topic, s.word), others = pk[topic].filter(function (w) { return w !== s.word && near.indexOf(w) < 0; });
    if (!others.length) others = pk[topic].filter(function (w) { return w !== s.word; });
    s.fake = s.mode === "fool" && others.length ? H.rnd(others) : "";
    s.players = P.roster.slice(); s.liar = H.rnd(s.players); s.i = 0; s.seen = false;
    var f = Math.floor(Math.random() * s.players.length);
    s.order = s.players.slice(f).concat(s.players.slice(0, f));
    s.chosen = ""; s.caught = false; s.opts = []; s.guess = ""; s.win = ""; s.counted = false; s.running = false; s.endAt = 0; s.total = s.left = s.timer;
    s.round++; s.phase = "hand";
    P.busy = true; P.save();
    P.splash({ k: "라운드 " + s.round, big: "라이어", word: true, sub: "주제는 " + topic, note: s.fake ? "바보 모드" : "" }).then(function () { if (P.st !== s) return; P.busy = false; liarShow(s); });
  }
  // 라이어 카드와 시민 카드는 모양과 색이 같다(멀리서 보고 라이어를 알아채지 못하게). 글자만 다르다.
  // 바보 모드의 라이어는 다른 제시어가 적힌, 시민 카드와 똑같은 카드를 받는다
  function frontHTML(s, who) {
    var L = who === s.liar && !s.fake, w = who === s.liar && s.fake ? s.fake : s.word;
    return '<span class="tp">주제: ' + esc(s.topic) + '</span><p class="wd">' + (L ? "라이어" : esc(w)) + '</p><p class="tip">' + (L ? "들키지 않게 묻어가며 제시어를 알아내요" : "라이어가 눈치채지 못하게 설명해요") + "</p>";
  }
  function liarCard(s) {
    var who = s.players[s.i], last = s.i === s.players.length - 1;
    P.screen({
      body: '<p class="chooser">' + tok(who, "sm") + "<span><b>" + esc(disp(who)) + "</b> 님의 카드</span></p>"
        + '<div class="lc" id="lc"><div class="in"><div class="face back"><span class="emb">' + mask("#fff", "#1E3A8A") + '</span><p>누르고 있는 동안 보여요</p></div><div class="face front" id="lcFront"></div></div></div>'
        + '<div class="holdz"><button type="button" class="hold" id="holdBtn" data-quiet aria-label="누르고 있는 동안 카드 보기"><svg class="ring" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle cx="60" cy="60" r="54"/></svg>' + H.FP + "</button>"
        + '<span class="lb" id="holdLb">' + (s.seen ? "확인했어요. 다시 볼 수 있어요" : "길게 눌러 카드 보기") + "</span></div>",
      foot: '<button type="button" class="pa-btn is-primary is-lg" data-act="card-next" id="cardNext"' + (s.seen ? "" : " disabled") + ">" + (last ? "모두 확인했어요" : "다음 사람에게") + ic("next") + "</button>",
      say: disp(who) + " 님 카드. 가운데 버튼을 누르고 있는 동안만 보여요."
    });
    bindHold(s, who);
  }
  // 누르고 있는 동안만 카드가 뒤집히고, 그동안만 제시어가 화면에 글자로 있다(손을 떼면 지운다)
  function bindHold(s, who) {
    var b = $("holdBtn"), lc = $("lc"), front = $("lcFront"); if (!b) return;
    var on = false, t1 = 0, t2 = 0, t3 = 0;
    function open() {
      if (on) return; on = true; b.classList.add("is-holding");
      clearTimeout(t3);
      t1 = setTimeout(function () {
        front.innerHTML = frontHTML(s, who);
        lc.classList.add("is-open"); P.sfx("flip"); H.buzz(12);
        t2 = setTimeout(function () {
          if (s.seen) return;
          s.seen = true; P.save();
          var n = $("cardNext"); if (n) n.disabled = false;
          var l = $("holdLb"); if (l) l.textContent = "확인했어요. 다시 볼 수 있어요";
        }, 600);
      }, 140);
    }
    function close() {
      if (!on) return; on = false; b.classList.remove("is-holding");
      clearTimeout(t1); clearTimeout(t2);
      if (lc.classList.contains("is-open")) { lc.classList.remove("is-open"); P.sfx("flip"); }
      t3 = setTimeout(function () { if (!on) front.innerHTML = ""; }, 470);
    }
    b.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse" && e.button !== 0) return; e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (er) {} open(); });
    b.addEventListener("pointerup", close);
    b.addEventListener("pointercancel", close);
    b.addEventListener("lostpointercapture", close);
    b.addEventListener("keydown", function (e) { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); open(); } });
    b.addEventListener("keyup", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); close(); } });
    b.addEventListener("blur", close);
    b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }
  function liarTalk(s) {
    var first = s.order[0];
    var timer = s.timer
      ? '<div class="rt" id="rt"><svg viewBox="0 0 220 220" aria-hidden="true" focusable="false"><defs><linearGradient id="rtGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#67E8F9"/><stop offset="1" stop-color="#2563EB"/></linearGradient></defs>'
        + '<circle class="trk" cx="110" cy="110" r="100"/><circle class="bar" id="rtBar" cx="110" cy="110" r="100" stroke-dasharray="' + CIRC + '" stroke-dashoffset="0"/></svg>'
        + '<div class="t"><b id="rtNum">' + H.fmtTime(Math.ceil(s.left)) + '</b><small id="rtLb">남은 시간</small></div></div>'
        + '<div class="pg-row is-center"><button type="button" class="pa-btn is-ghost is-sm" data-act="timer-toggle" id="tmToggle"></button><button type="button" class="pa-btn is-ghost is-sm" data-act="timer-add">' + ic("plus", "is-sm") + "1분</button></div>"
      : '<p class="pg-hint">시간 제한 없이 이야기해요</p>';
    P.screen({
      body: '<div class="spot">' + tok(first, "md") + "<div><small>첫 번째로 말할 사람</small><b>" + esc(disp(first)) + " 님</b></div></div>"
        + '<div class="orderline">' + s.order.map(function (n, k) { return "<span>" + tok(n, "sm") + "<em>" + esc(disp(n)) + "</em><i>" + (k + 1) + "번</i></span>"; }).join("") + "</div>"
        + timer + '<p class="pg-p pg-center">한 사람씩 제시어를 한마디로 설명해요. ' + (s.fake ? "이번 판은 바보 모드라 라이어도 자기가 라이어인 줄 몰라요." : "라이어는 들키지 않게 묻어가요.") + " 한 바퀴 돌면 투표해요.</p>",
      foot: btn("to-vote", ic("hand") + "투표하기", "is-primary is-lg" + (s.timer && s.left <= 0 ? " is-glow" : "")),
      say: "토론 시작. " + disp(first) + " 님부터 말해요."
    });
    if (s.timer) {
      TM.sec = -1; timerTick(s, true);
      TM.iv = setInterval(function () { if (P.st !== s || s.phase !== "talk") { timerStop(); return; } timerTick(s, false); }, 250);
    }
  }
  function timerTick(s, quiet) {
    if (s.running) {
      s.left = Math.max(0, (s.endAt - Date.now()) / 1000);
      if (s.left <= 0) {
        s.running = false; s.endAt = 0; P.save();
        if (!quiet) { P.sfx("alarm"); H.buzz([200, 100, 200, 100, 400]); H.say("시간이 끝났어요. 투표해요."); }
        var v = P.foot.querySelector('[data-act="to-vote"]'); if (v) v.classList.add("is-glow");
      }
    }
    var num = $("rtNum"); if (!num) return;
    var sec = Math.ceil(s.left - 0.001);
    num.textContent = H.fmtTime(sec);
    $("rtBar").style.strokeDashoffset = (CIRC * (1 - s.left / (s.total || 1))).toFixed(1);
    var rt = $("rt");
    rt.classList.toggle("is-hurry", s.running && sec <= 10 && sec > 0);
    rt.classList.toggle("is-done", s.left <= 0);
    $("rtLb").textContent = s.left <= 0 ? "시간 끝" : s.running ? "남은 시간" : "멈춤";
    if (s.running && sec <= 10 && sec > 0 && TM.sec !== -1 && sec !== TM.sec && !quiet) P.sfx("hurry");
    TM.sec = sec;
    var tg = $("tmToggle");
    if (tg) tg.innerHTML = s.running ? ic("pause", "is-sm") + "잠깐 멈추기" : s.left <= 0 ? ic("refresh", "is-sm") + "다시 재기" : ic("play", "is-sm") + (s.left < s.total ? "계속" : "시작");
  }
  function decideBtn(s) {
    return '<button type="button" class="pa-btn is-danger is-lg" data-act="decide"' + (s.chosen ? "" : " disabled") + ">" + (s.chosen ? '<span class="cut">' + esc(disp(s.chosen)) + "</span> 님으로 결정" : "한 사람을 골라 주세요") + "</button>";
  }
  function liarVote(s) {
    P.screen({
      body: '<h3 class="pg-h pg-center">누가 라이어일까요?</h3><p class="pg-p pg-center">하나, 둘, 셋 하면 다 같이 손가락으로 가리켜요. 가장 많이 지목된 사람을 골라 주세요. 동점이면 한 번 더 가리키고, 그래도 같으면 ' + esc(disp(s.order[0])) + " 님이 정해요.</p>"
        + '<div class="vote" role="group" aria-label="지목할 사람">' + s.players.map(function (n, k) {
          return '<button type="button" data-act="vote" data-i="' + k + '" aria-pressed="' + (s.chosen === n) + '">' + tok(n, "md") + "<span>" + esc(disp(n)) + "</span></button>";
        }).join("") + "</div>" + '<div class="pg-share">' + btn("to-talk", ic("timer", "is-sm") + "토론으로 돌아가기", "is-text") + "</div>",
      foot: decideBtn(s),
      say: "누가 라이어일까요? 가장 많이 지목된 사람을 골라 주세요."
    });
  }
  function liarVerdict(s, fx) {
    var c = s.caught;
    var foot = c ? btn("to-guess", "제시어 맞히기" + ic("next"), "is-primary is-lg") : btn("to-result", "결과 보기" + ic("next"), "is-primary is-lg");
    var stamp = '<span class="bigstamp ' + (c ? "is-liar" : "is-citizen") + '" style="--sd:0s">' + (c ? "라이어!" : "시민") + "</span>";
    var box = c ? '<div class="reveal-box" style="--rd:.6s"><span class="k">라이어의 마지막 기회</span><b>제시어를 맞히면 라이어가 이겨요</b></div>'
      : '<div class="reveal-box" style="--rd:.6s"><span class="k">진짜 라이어는</span>' + tok(s.liar, "lg") + "<b>" + esc(disp(s.liar)) + ' 님</b><span class="kw">' + esc(s.word) + "</span>" + fakeLine(s) + "</div>";
    P.screen({
      body: '<div class="verdict' + (fx ? " is-drum" : "") + '" id="verdict"><span class="k">지목된 사람은</span><span class="shake" style="--kd:0s">' + tok(s.chosen, "xl") + "</span>"
        + '<p class="nm">' + esc(disp(s.chosen)) + " 님</p>" + (fx ? '<span class="drum">두구두구</span>' : stamp) + "</div>" + (fx ? "" : box),
      foot: fx ? "" : foot,
      say: fx ? "" : disp(s.chosen) + " 님은 " + (c ? "라이어였어요." : "시민이었어요.")
    });
    if (fx) {
      P.busy = true; P.sfx("drum", 1.4);
      later(s, 1500, function () {
        var v = $("verdict"); if (!v) return;
        v.classList.remove("is-drum");
        var d = v.querySelector(".drum"); if (d) d.outerHTML = stamp;
        v.insertAdjacentHTML("afterend", box);
        P.sfx("stamp"); P.sfx(c ? "crash" : "wrong"); H.buzz(c ? [60, 40, 120] : 200); H.say(disp(s.chosen) + " 님은 " + (c ? "라이어였어요." : "시민이었어요."));
      });
      later(s, 2300, function () { P.busy = false; P.setFoot(foot); var b = P.foot.querySelector(".pa-btn"); if (b) { try { b.focus({ preventScroll: true }); } catch (e) {} } P.save(); });
    }
  }
  function fakeLine(s) { return s.fake ? '<span class="fake">라이어가 받은 제시어 <b>' + esc(s.fake) + "</b></span>" : ""; }
  function liarGuess(s) {
    if (!(Array.isArray(s.opts) && s.opts.length && s.opts.indexOf(s.word) >= 0)) {
      var pk = P.pack().liar, near = closeTo(s.topic, s.word), ok = function (w) { return w !== s.word && w !== s.fake && near.indexOf(w) < 0; };
      var same = (pk[s.topic] || []).filter(ok);
      if (same.length < 3) Object.keys(pk).forEach(function (t) { pk[t].forEach(function (w) { if (ok(w) && same.indexOf(w) < 0) same.push(w); }); });
      s.opts = H.shuffle(H.shuffle(same).slice(0, 3).concat([s.word]));
    }
    P.screen({
      body: '<p class="chooser">' + tok(s.liar, "sm") + "<span><b>" + esc(disp(s.liar)) + "</b> 님의 마지막 기회</span></p>"
        + '<h3 class="pg-h pg-center">제시어는 무엇일까요?</h3><p class="pg-p pg-center">주제는 ' + esc(H.josa(s.topic, "이에요", "예요")) + ". 보기 4개 중 하나를 골라요.</p>"
        + '<div class="opts">' + s.opts.map(function (w, k) { return '<button type="button" data-act="guess" data-k="' + k + '">' + esc(w) + "</button>"; }).join("") + "</div>",
      say: disp(s.liar) + " 님, 제시어를 골라 주세요. 주제는 " + H.josa(s.topic, "이에요", "예요") + "."
    });
  }
  function liarGuessPick(s, el) {
    var w = s.opts[Number(el.getAttribute("data-k"))]; if (!w) return;
    P.busy = true; s.guess = w;
    var right = w === s.word;
    s.win = right ? "liar" : "citizen"; P.save();
    each(P.body.querySelectorAll(".opts button"), function (b, k) { if (s.opts[k] === s.word) b.classList.add("is-right"); else if (b === el) b.classList.add("is-wrong"); b.disabled = true; });
    el.insertAdjacentHTML("beforeend", '<span class="guess-stamp' + (right ? "" : " is-wrong") + '">' + (right ? "정답!" : "땡") + "</span>");
    if (!right) el.classList.add("shake");
    P.sfx(right ? "right" : "wrong"); H.buzz(right ? 30 : 160);
    later(s, H.reduced() ? 300 : 1300, function () { P.busy = false; liarResultEnter(s); });
  }
  function liarResultEnter(s) {
    if (!s.counted) { s.counted = true; if (s.win === "liar") s.tally.l++; else s.tally.c++; }
    s.phase = "result"; liarShow(s, true);
  }
  function liarResult(s, fx) {
    var L = s.win === "liar";
    var why = !s.caught ? "지목된 " + disp(s.chosen) + " 님은 시민이었어요." : L ? "라이어가 제시어를 맞혀 역전했어요." : "라이어를 찾아냈고 제시어도 지켰어요.";
    P.screen({
      body: '<p class="banner ' + (L ? "is-liar" : "is-citizen") + '" data-t="' + (L ? "라이어 승리" : "시민 승리") + '"><span>' + (L ? "라이어 승리" : "시민 승리") + '</span></p><p class="pg-p pg-center">' + esc(why) + "</p>"
        + '<div class="reveal-box" style="--rd:.35s"><span class="k">이번 판의 라이어</span>' + tok(s.liar, "lg") + "<b>" + esc(disp(s.liar)) + ' 님</b><span class="kw">' + esc(s.word) + "</span>" + fakeLine(s) + "</div>"
        + tallyHTML(s, fx ? s.win : "") + '<div class="pg-share">' + btn("share", ic("share", "is-sm") + "카카오톡 공유", "is-ghost is-sm") + "</div>",
      foot: '<div class="pg-row">' + btn("leave", ic("home", "is-sm") + "처음으로", "is-ghost") + btn("again", ic("refresh") + "다음 판", "is-primary is-wide") + "</div>",
      say: (L ? "라이어 승리. " : "시민 승리. ") + why + " 제시어는 " + s.word + "."
    });
    if (fx) {
      if (L) { P.sfx("sly"); P.confetti({ n: 150, colors: ["#FB7185", "#F43F5E", "#FDA4AF", "#FDE047", "#FFFFFF"] }); }
      else { P.sfx("win"); P.confetti({ n: 150, colors: ["#7DD3FC", "#38BDF8", "#67E8F9", "#A78BFA", "#FFFFFF", "#FDE047"] }); }
      H.buzz([50, 40, 100]);
    }
  }
})();
