/* ============================================================
   모임 자리 게임 v2 (98차): 공통 부분
   명단과 사람마다 색, 효과음(WebAudio 로 그 자리에서 합성), 진동, 색종이, 게임 화면 틀
   (전체 화면, 뒤로 가기, 확인 창, 스플래시, 결과 팝업), 저장(명단은 이 기기, 진행 중인 판은 이 탭).
   세 게임은 party-games.js 가 P.games 에 얹는다. 화면 모양은 party.css
   ============================================================ */
(function () {
  "use strict";
  var P = window.PARTY = { games: {}, roster: [], bung: null, prefs: {}, cur: null, st: null, busy: false };
  var $ = function (id) { return document.getElementById(id); };
  var doc = document, root = document.documentElement;

  /* ── 작은 도구 ── */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function shuffle(a) { var r = a.slice(); for (var i = r.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = r[i]; r[i] = r[j]; r[j] = t; } return r; }
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function nickKey(s) { return String(s || "").normalize("NFC").trim().replace(/\s+/g, "").toLowerCase(); }
  function jong(w) { w = String(w || ""); var c = w.charCodeAt(w.length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; }
  function josa(w, a, b) { return w + (jong(w) ? a : b); }
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(mq && mq.matches); }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fmtTime(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }

  var toastEl = $("toast"), toastT = null;
  function toast(msg) { if (!toastEl || !msg) return; toastEl.textContent = msg; toastEl.classList.add("is-visible"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("is-visible"); }, 2600); }
  function say(t) { var l = $("live"); if (!l || !t) return; l.textContent = ""; setTimeout(function () { l.textContent = t; }, 60); }
  var topnav = $("topnav");
  function syncNav() { if (topnav) topnav.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", syncNav, { passive: true }); syncNav();

  function supaFetch(path, init) {
    var C = window.SUPA;
    if (!C || !C.url || !C.anon) return Promise.reject(new Error("no server"));
    return fetch(C.url + path, Object.assign({ headers: { apikey: C.anon, Authorization: "Bearer " + C.anon, "Content-Type": "application/json" } }, init || {}))
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (t) { return t ? JSON.parse(t) : null; });
  }

  /* ── 선 아이콘(24 칸) ── */
  var ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    sound: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 7.8"/><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L3.5 9"/><path d="M3.5 4v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.5l1.9-2.5"/><path d="M20.5 20v-5h-5"/>',
    shuffle: '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h2a4 4 0 0 0 3.3-1.7l5.4-8.6A4 4 0 0 1 16 6h6"/><path d="M2 6h2a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6a4 4 0 0 1-3.3-1.8l-.4-.5"/>',
    order: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 5l1.5-1v6"/><path d="M3.5 14.5a1.5 1.5 0 0 1 3 .5c0 1.5-3 2-3 4h3"/>',
    team: '<circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 20a5 5 0 0 1 10 0M12 20a5 5 0 0 1 10 0"/>',
    cards: '<rect x="8" y="5" width="12" height="16" rx="2.5"/><path d="M15.5 3.4 6.3 2.6A2.5 2.5 0 0 0 3.6 4.9L2.7 15.4A2.5 2.5 0 0 0 5 18.1l1 .1"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    share: '<path d="M12 15V3.5"/><path d="m7.5 8 4.5-4.5L16.5 8"/><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
    home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v10h12V10"/>',
    next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    pause: '<path d="M8.5 5v14M15.5 5v14"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2"/><path d="M9.5 2.5h5"/>',
    trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 14v4M8.5 20.5h7"/>',
    eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    swap: '<path d="M4 8h14l-3.5-3.5"/><path d="M20 16H6l3.5 3.5"/>',
    userx: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="m17 8 4 4M21 8l-4 4"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    star: '<path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
    bolt: '<path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"/>',
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20.5l1.4-5.1A8.5 8.5 0 1 1 21 11.5z"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5v-6a1.5 1.5 0 0 1 3 0v6"/><path d="M14 10.5V6a1.5 1.5 0 0 1 3 0v6"/><path d="M17 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L3.7 15a1.5 1.5 0 0 1 2.3-1.9L8 15"/>',
    pass: '<path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M11 17h2"/><path d="M2 9.5 4 12l-2 2.5M22 9.5 20 12l2 2.5"/>',
    plus1: '<path d="M4 12h6M7 9v6"/><path d="M14 8.5l3-2v11"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.3-2.4 3.8"/><path d="M12 17h.01"/>'
  };
  function ic(name, cls) { return '<svg class="ic' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>"; }
  var FP = '<svg class="fp" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4.5a7.5 7.5 0 0 0-7.5 7.5v1.5"/><path d="M19.5 12a7.5 7.5 0 0 0-4.2-6.7"/><path d="M8 18.5c.6-1.6 1-3.6 1-6.5a3 3 0 0 1 6 0c0 1.2-.1 2.4-.2 3.5"/><path d="M12 12c0 3.4-.6 6.2-1.8 8.5"/><path d="M15.6 18.6c.4-1.1.7-2.4.9-3.6"/><path d="M19.4 15.5c.1-.8.1-1.6.1-2.5"/><path d="M5.3 17c.3-.9.7-2.4.7-4"/></svg>';

  /* ── 게임 그림(SVG). 같은 쪽에 여러 번 그려도 그라데이션 이름이 겹치지 않게 번호를 붙인다 ── */
  var artSeq = 0;
  function pt(r, deg) { var a = deg * Math.PI / 180; return [+(r * Math.sin(a)).toFixed(2), +(-r * Math.cos(a)).toFixed(2)]; }
  function slicePath(r, a0, a1) { var p0 = pt(r, a0), p1 = pt(r, a1); return "M0 0L" + p0[0] + " " + p0[1] + "A" + r + " " + r + " 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + p1[0] + " " + p1[1] + "Z"; }
  function spark(x, y, s, fill) { return '<path transform="translate(' + x + " " + y + ") scale(" + s + ')" d="M0-10 2.4-2.4 10 0 2.4 2.4 0 10-2.4 2.4-10 0-2.4-2.4z" fill="' + fill + '"/>'; }
  function art(kind) {
    var u = "pa" + (++artSeq), d = '<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">';
    if (kind === "logo") {
      return '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs>'
        + '<linearGradient id="' + u + 'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C4B5FD"/><stop offset=".5" stop-color="#8B5CF6"/><stop offset="1" stop-color="#EC4899"/></linearGradient>'
        + '<linearGradient id="' + u + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>'
        + '<rect x="7" y="11" width="50" height="50" rx="15" fill="#3B1777"/><rect x="7" y="6" width="50" height="50" rx="15" fill="url(#' + u + 'a)"/>'
        + '<path d="M22 6h20a15 15 0 0 1 15 15v1c-16-6-34-6-50 2v-3A15 15 0 0 1 22 6z" fill="url(#' + u + 'b)"/>'
        + '<g fill="#fff"><circle cx="21" cy="20" r="4.6"/><circle cx="43" cy="20" r="4.6"/><circle cx="32" cy="31" r="4.6"/><circle cx="21" cy="42" r="4.6"/><circle cx="43" cy="42" r="4.6"/></g>'
        + spark(56, 6.5, 0.55, "#FDE047") + "</svg>";
    }
    if (kind === "pick") {
      var cols = ["#FB923C", "#FDE047", "#F472B6", "#A78BFA", "#34D399", "#60A5FA"], s = "", b = "";
      for (var i = 0; i < 6; i++) s += '<path d="' + slicePath(41, i * 60 - 30, i * 60 + 30) + '" fill="' + cols[i] + '"/>';
      for (var j = 0; j < 12; j++) { var q = pt(46, j * 30); b += '<circle cx="' + (60 + q[0]) + '" cy="' + (62 + q[1]) + '" r="2.5" fill="#FFFBEB"/>'; }
      return d + '<defs><linearGradient id="' + u + 'r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDE68A"/><stop offset="1" stop-color="#C2410C"/></linearGradient>'
        + '<radialGradient id="' + u + 'h" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FDBA74"/></radialGradient></defs>'
        + '<circle cx="60" cy="67" r="51" fill="#431407" opacity=".5"/><circle cx="60" cy="62" r="51" fill="url(#' + u + 'r)"/>'
        + '<g transform="translate(60 62) rotate(-14)">' + s + '<g stroke="#fff" stroke-width="1.6" opacity=".9">' + [0, 60, 120, 180, 240, 300].map(function (a) { var e = pt(41, a + 30); return '<line x1="0" y1="0" x2="' + e[0] + '" y2="' + e[1] + '"/>'; }).join("") + "</g></g>"
        + b + '<circle cx="60" cy="62" r="9.5" fill="url(#' + u + 'h)" stroke="#9A3412" stroke-width="2.2"/>'
        + '<path d="M60 27 51.8 13.2A9.5 9.5 0 1 1 68.2 13.2z" fill="#EF4444" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><circle cx="60" cy="9" r="3" fill="#fff"/>'
        + spark(106, 18, 0.7, "#FDE047") + spark(14, 104, 0.5, "#fff") + "</svg>";
    }
    if (kind === "balance") {
      return d + '<defs><linearGradient id="' + u + 'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C4B5FD"/><stop offset="1" stop-color="#6D28D9"/></linearGradient>'
        + '<linearGradient id="' + u + 'b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FDA4AF"/><stop offset="1" stop-color="#E11D48"/></linearGradient></defs>'
        + '<g transform="rotate(-12 30 60)"><rect x="4" y="29" width="52" height="68" rx="14" fill="#1E0B4B" opacity=".5"/><rect x="4" y="24" width="52" height="68" rx="14" fill="url(#' + u + 'a)" stroke="#fff" stroke-width="3"/>'
        + '<text x="27" y="70" text-anchor="middle" font-family="Black Han Sans, sans-serif" font-size="32" fill="#fff">A</text></g>'
        + '<g transform="rotate(12 90 60)"><rect x="64" y="29" width="52" height="68" rx="14" fill="#4C0519" opacity=".5"/><rect x="64" y="24" width="52" height="68" rx="14" fill="url(#' + u + 'b)" stroke="#fff" stroke-width="3"/>'
        + '<text x="93" y="70" text-anchor="middle" font-family="Black Han Sans, sans-serif" font-size="32" fill="#fff">B</text></g>'
        + '<circle cx="60" cy="82" r="17" fill="#120B2C" stroke="#FDE047" stroke-width="3.5"/>'
        + '<text x="60" y="88.5" text-anchor="middle" font-family="Black Han Sans, sans-serif" font-size="16" fill="#FDE047">VS</text>'
        + spark(16, 16, 0.7, "#FDE047") + spark(106, 108, 0.55, "#fff") + "</svg>";
    }
    if (kind === "liar") {
      return d + '<defs><linearGradient id="' + u + 'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7DD3FC"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient>'
        + '<linearGradient id="' + u + 'b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FDA4AF"/><stop offset="1" stop-color="#BE123C"/></linearGradient></defs>'
        + '<g transform="rotate(14 78 56)"><rect x="52" y="18" width="52" height="72" rx="13" fill="url(#' + u + 'b)" stroke="#fff" stroke-width="3"/>'
        + '<text x="78" y="66" text-anchor="middle" font-family="Black Han Sans, sans-serif" font-size="32" fill="#fff">?</text></g>'
        + '<g transform="rotate(-9 48 66)"><rect x="18" y="31" width="60" height="80" rx="14" fill="#0B1A4A" opacity=".5"/><rect x="18" y="26" width="60" height="80" rx="14" fill="url(#' + u + 'a)" stroke="#fff" stroke-width="3"/>'
        + '<path d="M28 63c0-6 6-9 13-9 4 0 6 2 7 2s3-2 7-2c7 0 13 3 13 9 0 7-5 12-12 12-5 0-6-4-8-4s-3 4-8 4c-7 0-12-5-12-12z" fill="#fff"/>'
        + '<ellipse cx="38.5" cy="64" rx="4.4" ry="3" fill="#1D4ED8"/><ellipse cx="57.5" cy="64" rx="4.4" ry="3" fill="#1D4ED8"/></g>'
        + '<circle cx="100" cy="22" r="12" fill="#FDE047" stroke="#120B2C" stroke-width="2.5"/><text x="100" y="29" text-anchor="middle" font-family="Black Han Sans, sans-serif" font-size="18" fill="#120B2C">?</text>'
        + spark(12, 22, 0.6, "#fff") + spark(110, 100, 0.5, "#7DD3FC") + "</svg>";
    }
    return "";
  }

  /* ── 효과음: 파일 없이 WebAudio 로 합성한다. 처음 누를 때 깨우고, 끄면 아무것도 만들지 않는다 ── */
  var SOUND_KEY = "excer_party_sound";
  var soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== "0"; } catch (e) {}
  var AU = { ctx: null, out: null, verb: null, nb: null, lastTick: 0 };
  function audio() {
    if (AU.ctx) return AU.ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      var ctx = new AC();
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      var out = ctx.createGain(); out.gain.value = 0.6;
      out.connect(comp); comp.connect(ctx.destination);
      var len = Math.floor(ctx.sampleRate * 1.3), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) { var dd = ir.getChannelData(c); for (var i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
      var verb = ctx.createConvolver(); verb.buffer = ir;
      var wet = ctx.createGain(); wet.gain.value = 0.25;
      verb.connect(wet); wet.connect(comp);
      var nl = Math.floor(ctx.sampleRate * 1.2), nb = ctx.createBuffer(1, nl, ctx.sampleRate), nd = nb.getChannelData(0);
      for (var k = 0; k < nl; k++) nd[k] = Math.random() * 2 - 1;
      AU.ctx = ctx; AU.out = out; AU.verb = verb; AU.nb = nb;
    } catch (e) { return null; }
    return AU.ctx;
  }
  function unlockAudio() {
    if (!soundOn) return;
    var ctx = audio();
    if (ctx && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
  }
  function env(g, t0, v, a, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  function route(node, o) {
    node.connect(AU.out);
    if (o.verb) { var s = AU.ctx.createGain(); s.gain.value = o.verb; node.connect(s); s.connect(AU.verb); }
  }
  function tone(o) {
    var ctx = AU.ctx, t0 = ctx.currentTime + (o.t || 0) + 0.005;
    var osc = ctx.createOscillator(); osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.glide || o.d));
    var g = ctx.createGain(); env(g, t0, o.v || 0.2, o.a || 0.006, o.d);
    var last = osc;
    if (o.lp) { var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; osc.connect(f); last = f; }
    last.connect(g); route(g, o);
    if (o.vib) { var l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = o.f * 0.03; l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + o.d + 0.05); }
    osc.start(t0); osc.stop(t0 + o.d + 0.05);
  }
  function noise(o) {
    var ctx = AU.ctx, t0 = ctx.currentTime + (o.t || 0) + 0.005;
    var src = ctx.createBufferSource(); src.buffer = AU.nb;
    var f = ctx.createBiquadFilter(); f.type = o.ft || "bandpass"; f.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d);
    f.Q.value = o.q || 1;
    var g = ctx.createGain(); env(g, t0, o.v || 0.2, o.a || 0.004, o.d);
    src.connect(f); f.connect(g); route(g, o);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + o.d + 0.05);
  }
  function sparkle(t0, v) { [2093, 2637, 3136, 2349, 3520, 2794, 4186, 3136].forEach(function (f, i) { tone({ f: f, t: t0 + i * 0.055, d: 0.2, v: v || 0.03, verb: 0.6 }); }); }
  var SFX = {
    tap: function () { tone({ f: 1150, f2: 720, d: 0.05, type: "triangle", v: 0.06 }); },
    select: function () { tone({ f: 660, d: 0.1, type: "triangle", v: 0.15 }); tone({ f: 990, t: 0.06, d: 0.16, type: "triangle", v: 0.15, verb: 0.2 }); },
    tick: function () { noise({ f: 2800, q: 5, d: 0.035, v: 0.32 }); tone({ f: 1500, f2: 900, d: 0.03, type: "square", v: 0.035 }); },
    whoosh: function () { noise({ f: 280, f2: 2600, q: 0.9, d: 0.4, v: 0.2, a: 0.15 }); },
    rise: function () { tone({ f: 240, f2: 960, d: 0.45, v: 0.1, verb: 0.35, glide: 0.4 }); noise({ f: 500, f2: 4200, q: 0.8, d: 0.42, v: 0.07, a: 0.22 }); },
    flip: function () { noise({ f: 2600, f2: 800, q: 1.4, d: 0.13, v: 0.28 }); tone({ f: 380, f2: 240, d: 0.09, v: 0.09 }); },
    deal: function () { noise({ f: 1600, f2: 4000, q: 1, d: 0.14, v: 0.18 }); },
    shuffle: function () { for (var i = 0; i < 7; i++) noise({ f: 2200 + Math.random() * 1200, q: 2, t: i * 0.045, d: 0.04, v: 0.13 }); },
    pop: function () { tone({ f: 380, f2: 1150, d: 0.12, v: 0.24, glide: 0.06 }); },
    coin: function () { tone({ f: 988, d: 0.09, type: "square", v: 0.06, lp: 4200 }); tone({ f: 1319, t: 0.08, d: 0.45, type: "square", v: 0.06, lp: 4200, verb: 0.25 }); },
    beep: function () { tone({ f: 784, d: 0.2, type: "triangle", v: 0.22, verb: 0.2 }); },
    go: function () { tone({ f: 1047, d: 0.55, type: "triangle", v: 0.2, verb: 0.35 }); tone({ f: 1568, d: 0.5, v: 0.07, verb: 0.35 }); },
    win: function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, t: i * 0.085, d: 0.28, type: "triangle", v: 0.16, verb: 0.3 }); });
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f) { tone({ f: f, t: 0.36, d: 1, type: "triangle", v: 0.07, verb: 0.45 }); tone({ f: f * 2, t: 0.36, d: 0.8, v: 0.025, verb: 0.5 }); });
      sparkle(0.42);
    },
    sly: function () {
      [[587.33, 0, 0.16], [554.37, 0.16, 0.16], [587.33, 0.32, 0.16], [739.99, 0.5, 0.2], [698.46, 0.72, 0.5]].forEach(function (n) { tone({ f: n[0], t: n[1], d: n[2], type: "square", v: 0.06, lp: 2200, verb: 0.25 }); });
      tone({ f: 146.83, t: 0.72, d: 0.6, type: "triangle", v: 0.16 });
    },
    lose: function () { [[392, 0, 0.27], [370, 0.29, 0.27], [349.2, 0.58, 0.27], [329.6, 0.87, 0.8]].forEach(function (n, i) { tone({ f: n[0], t: n[1], d: n[2], type: "sawtooth", v: 0.07, lp: 1200, vib: i === 3 ? 6 : 0 }); }); },
    drum: function (dur) { dur = dur || 1.4; var n = Math.floor(dur / 0.045); for (var i = 0; i < n; i++) { var p = i / n; noise({ ft: "bandpass", f: 200 + p * 90, q: 0.9, t: i * 0.045, d: 0.07, v: 0.08 + p * 0.26 }); } },
    crash: function () { noise({ ft: "highpass", f: 3800, d: 1.3, v: 0.28, verb: 0.4 }); tone({ f: 120, f2: 40, d: 0.36, v: 0.55 }); },
    stamp: function () { tone({ f: 165, f2: 45, d: 0.24, v: 0.6 }); noise({ ft: "lowpass", f: 1400, d: 0.09, v: 0.42 }); },
    alarm: function () { for (var i = 0; i < 3; i++) { tone({ f: 880, t: i * 0.32, d: 0.13, type: "square", v: 0.07, lp: 2400 }); tone({ f: 660, t: i * 0.32 + 0.15, d: 0.13, type: "square", v: 0.07, lp: 2400 }); } },
    wood: function () { tone({ f: 540, f2: 470, d: 0.09, type: "triangle", v: 0.2 }); noise({ f: 1900, q: 3, d: 0.03, v: 0.15 }); },
    hurry: function () { tone({ f: 1250, d: 0.05, type: "square", v: 0.045, lp: 3000 }); },
    right: function () { tone({ f: 880, d: 0.12, type: "triangle", v: 0.18 }); tone({ f: 1318.5, t: 0.1, d: 0.4, type: "triangle", v: 0.18, verb: 0.3 }); sparkle(0.2, 0.02); },
    wrong: function () { tone({ f: 155, d: 0.42, type: "square", v: 0.08, lp: 900 }); tone({ f: 147, d: 0.42, type: "square", v: 0.08, lp: 900 }); }
  };
  function sfx(name, arg) {
    if (!soundOn || !SFX[name]) return;
    var ctx = audio();
    if (!ctx) return;
    if (ctx.state !== "running") { if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} } return; }
    if (name === "tick") { var now = ctx.currentTime; if (now - AU.lastTick < 0.028) return; AU.lastTick = now; }
    try { SFX[name](arg); } catch (e) {}
  }
  function syncSound() {
    ["soundBtn", "pgSound"].forEach(function (id) {
      var b = $(id); if (!b) return;
      b.setAttribute("aria-pressed", String(soundOn));
      b.title = soundOn ? "소리 켜짐" : "소리 꺼짐";
      b.innerHTML = ic(soundOn ? "sound" : "mute");
    });
  }
  function toggleSound() {
    soundOn = !soundOn;
    try { localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0"); } catch (e) {}
    syncSound();
    if (soundOn) { unlockAudio(); setTimeout(function () { sfx("select"); }, 30); }
    toast(soundOn ? "소리를 켰어요." : "소리를 껐어요.");
  }

  /* ── 색종이(캔버스). 움직임 줄이기 설정이면 쏘지 않는다 ── */
  var CF = { raf: 0, parts: [], last: 0 };
  function confetti(o) {
    o = o || {};
    if (reduced()) return;
    var cv = $("pgConfetti"); if (!cv || !cv.getContext || play.hidden) return;
    var dpr = Math.min(1.5, window.devicePixelRatio || 1), w = cv.clientWidth || window.innerWidth, h = cv.clientHeight || window.innerHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var cols = o.colors || ["#FDE047", "#F472B6", "#A78BFA", "#34D399", "#60A5FA", "#FB923C", "#FFFFFF"];
    var slow = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    var n = Math.round((o.n || 150) * (slow ? 0.6 : 1)), sp = Math.max(13, h / 52);
    for (var i = 0; i < n; i++) {
      var p = { c: rnd(cols), s: Math.random() < 0.18 ? 2 : Math.random() < 0.5 ? 1 : 0, w: 7 + Math.random() * 6, h: 10 + Math.random() * 8, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, f: Math.random() * 6.28, vf: 0.08 + Math.random() * 0.14, life: 0, max: 150 + Math.random() * 60 };
      if (o.from === "top") { p.x = Math.random() * w; p.y = -20 - Math.random() * h * 0.4; p.vx = (Math.random() - 0.5) * 3; p.vy = 2 + Math.random() * 3; }
      else {
        var side = i % 2 ? 1 : -1, th = 0.22 + Math.random() * 0.55, v = sp * (0.75 + Math.random() * 0.55);
        p.x = side < 0 ? -8 : w + 8; p.y = h * 0.8; p.vx = -side * v * Math.sin(th); p.vy = -v * Math.cos(th);
      }
      CF.parts.push(p);
    }
    if (!CF.raf) { CF.last = performance.now(); CF.raf = requestAnimationFrame(cfStep); }
  }
  function cfStep(now) {
    var cv = $("pgConfetti"), ctx = cv.getContext("2d"), dpr = cv.width / (cv.clientWidth || 1);
    var dt = Math.min(2.5, (now - CF.last) / 16.67); CF.last = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var h = cv.clientHeight, alive = [];
    for (var i = 0; i < CF.parts.length; i++) {
      var p = CF.parts[i];
      p.life += dt; p.vy += 0.3 * dt; p.vx *= Math.pow(0.986, dt); p.vy *= Math.pow(0.986, dt);
      p.vy = Math.min(p.vy, 5.5); p.x += (p.vx + Math.sin(p.f) * 0.6) * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.f += p.vf * dt;
      if (p.y > h + 40 || p.life > p.max) continue;
      alive.push(p);
      ctx.save(); ctx.globalAlpha = p.life > p.max - 30 ? Math.max(0, (p.max - p.life) / 30) : 1;
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.cos(p.f)); ctx.fillStyle = p.c;
      if (p.s === 0) ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      else if (p.s === 1) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2.4, 0, 6.283); ctx.fill(); }
      else ctx.fillRect(-1.6, -p.h, 3.2, p.h * 2);
      ctx.restore();
    }
    CF.parts = alive;
    if (alive.length) CF.raf = requestAnimationFrame(cfStep);
    else { CF.raf = 0; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
  }
  function confettiStop() {
    if (CF.raf) cancelAnimationFrame(CF.raf);
    CF.raf = 0; CF.parts = [];
    var cv = $("pgConfetti"); if (cv && cv.getContext) cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
  }

  /* ── 명단과 색 ── */
  var ROSTER_KEY = "excer_party_roster", COLOR_KEY = "excer_party_colors", STATE_KEY = "excer_party_v2", NICK_KEY = "excer_news_nick", MAX = 40;
  var PALETTE = ["#A78BFA", "#F472B6", "#FBBF24", "#34D399", "#60A5FA", "#FB923C", "#2DD4BF", "#F87171", "#A3E635", "#22D3EE", "#E879F9", "#FDE047"];
  var colors = {}, DISP = {};
  function hashIdx(s) { var h = 0; Array.from(String(s || "")).forEach(function (ch) { h = (h * 31 + ch.codePointAt(0)) % 9973; }); return h % PALETTE.length; }
  function ensureColor(n) {
    var k = nickKey(n), c = colors[k];
    if (typeof c === "number" && c >= 0 && c < PALETTE.length) return;
    var used = PALETTE.map(function () { return 0; });
    P.roster.forEach(function (x) { var v = colors[nickKey(x)]; if (typeof v === "number" && used[v] != null) used[v]++; });
    var best = 0; for (var i = 1; i < used.length; i++) if (used[i] < used[best]) best = i;
    colors[k] = best;
  }
  function color(n) { var c = colors[nickKey(n)]; return PALETTE[typeof c === "number" && PALETTE[c] ? c : hashIdx(nickKey(n))]; }
  // 짧은 이름 후보: 첫 낱말, 첫 낱말과 끝 낱말('가온 95'), 앞 두 낱말, 전체. 명단 안에서 겹치지 않는 첫 후보를 쓴다
  var WAYS = [
    function (w) { return w[0]; },
    function (w) { return w.length > 1 ? w[0] + " " + w[w.length - 1] : w[0]; },
    function (w) { return w.slice(0, 2).join(" "); },
    function (w) { return w.join(" "); }
  ];
  function rebuildDisp() {
    DISP = {};
    var words = function (n) { return String(n).trim().split(/\s+/); };
    var counts = WAYS.map(function (f) { var m = {}; P.roster.forEach(function (n) { var x = f(words(n)); m[x] = (m[x] || 0) + 1; }); return m; });
    P.roster.forEach(function (n) {
      var w = words(n), pick = w.join(" ");
      for (var i = 0; i < WAYS.length; i++) { var x = WAYS[i](w); if (counts[i][x] === 1) { pick = x; break; } }
      DISP[n] = pick;
    });
  }
  function disp(n) { return DISP[n] || String(n || "").trim().split(/\s+/)[0] || String(n || ""); }
  function initial(n) { var m = SLOT_RE.exec(disp(n)); return m ? m[1] : Array.from(disp(n))[0] || "?"; }   // 'N번'은 수 전체(10번이 1번처럼 보이지 않게)
  function tok(n, size, cls) { return '<span class="tok' + (size ? " is-" + size : "") + (cls ? " " + cls : "") + '" style="--c:' + color(n) + '" aria-hidden="true">' + esc(initial(n)) + "</span>"; }
  function loadRoster() {
    try { var r = JSON.parse(localStorage.getItem(ROSTER_KEY) || "[]"); if (Array.isArray(r)) P.roster = r.filter(function (x) { return typeof x === "string" && x.trim(); }).slice(0, MAX); } catch (e) {}
    try { var c = JSON.parse(localStorage.getItem(COLOR_KEY) || "{}"); if (c && typeof c === "object" && !Array.isArray(c)) colors = c; } catch (e) {}
    P.roster.forEach(ensureColor);
    rebuildDisp();
  }
  function saveRoster() {
    var keep = {};
    P.roster.forEach(function (n) { var k = nickKey(n); if (colors[k] != null) keep[k] = colors[k]; });
    colors = keep;
    try { localStorage.setItem(ROSTER_KEY, JSON.stringify(P.roster)); localStorage.setItem(COLOR_KEY, JSON.stringify(colors)); } catch (e) {}
  }
  var addFail = "";   // 넣지 못한 까닭: dup(이미 있음), cap(40명)
  function addName(raw, quiet) {
    var n = String(raw || "").normalize("NFC").trim().replace(/\s+/g, " ").slice(0, 24);
    addFail = "";
    if (!n) return false;
    if (P.roster.some(function (x) { return nickKey(x) === nickKey(n); })) { addFail = "dup"; if (!quiet) toast("이미 있는 이름이에요."); return false; }
    if (P.roster.length >= MAX) { addFail = "cap"; if (!quiet) toast("플레이어는 " + MAX + "명까지예요."); return false; }
    P.roster.push(n); ensureColor(n); return true;
  }
  function savedNick() { try { return (localStorage.getItem(NICK_KEY) || "").trim(); } catch (e) { return ""; } }
  function changed() { saveRoster(); rebuildDisp(); renderLobby(); if (!sheet.hidden) renderSheet(); saveSession(); }

  /* ── 참여 인원 +/- (게임 앱의 인원 정하기). + 는 'N번'을 넣고(N 은 지금 인원 다음 수, 있으면 그다음),
     - 는 번호 이름부터 뒤에서 하나(없으면 맨 뒤 사람)를 뺀다. min 아래로는 빼지 않는다(게임 안에서는 그 게임의 최소 인원) ── */
  var SLOT_RE = /^(\d{1,2})번$/;
  function isSlot(n) { return SLOT_RE.test(String(n || "")); }
  function slotName() {
    var k = P.roster.length + 1;
    while (P.roster.some(function (x) { return nickKey(x) === nickKey(k + "번"); })) k++;
    return k + "번";
  }
  function people(d, min) {
    var n = P.roster.length;
    if (d > 0) {
      if (n >= MAX) { toast("플레이어는 " + MAX + "명까지예요."); return false; }
      var nm = slotName(); P.roster.push(nm); ensureColor(nm);
      sfx("pop"); changed(); say(nm + " 들어옴, " + P.roster.length + "명");
      return true;
    }
    if (n <= (min || 0)) return false;
    var i = n - 1;
    for (var k = n - 1; k >= 0; k--) if (isSlot(P.roster[k])) { i = k; break; }
    var gone = P.roster[i], label = disp(gone);
    P.roster.splice(i, 1); sfx("tap"); changed();
    if (!isSlot(gone)) toast(label + " 님을 뺐어요.");
    say(label + " 빠짐, " + P.roster.length + "명");
    return true;
  }
  function stepper(min) {
    var n = P.roster.length;
    return '<div class="pstep" role="group" aria-label="참여 인원" data-min="' + (min || 0) + '">'
      + '<button type="button" class="pstep-b" data-act="ppl" data-d="-1" aria-label="한 명 빼기"' + (n <= (min || 0) ? " disabled" : "") + ">" + ic("minus") + "</button>"
      + '<span class="pstep-n"><b>' + n + "</b>명</span>"
      + '<button type="button" class="pstep-b is-plus" data-act="ppl" data-d="1" aria-label="한 명 더하기"' + (n >= MAX ? " disabled" : "") + ">" + ic("plus") + "</button></div>";
  }
  function facesHTML() {
    var n = P.roster.length, cap = 9, list = P.roster.slice(0, n > cap ? cap - 1 : cap);
    return list.map(function (x) { return tok(x, "sm"); }).join("") + (n > list.length ? '<span class="tok is-sm is-more">+' + (n - list.length) + "</span>" : "");
  }
  function bump(el) { el.classList.remove("is-bump"); void el.offsetWidth; el.classList.add("is-bump"); }
  // 쪽 안의 모든 인원 단추(로비, 게임 설정)를 지금 인원에 맞춘다. 누르던 단추가 막히면 초점은 반대쪽 단추로
  function syncPpl() {
    var n = P.roster.length, ae = doc.activeElement;
    Array.prototype.forEach.call(doc.querySelectorAll(".pstep"), function (el) {
      var min = Number(el.getAttribute("data-min")) || 0, m = el.querySelector('[data-d="-1"]'), p = el.querySelector('[data-d="1"]'), c = el.querySelector(".pstep-n b");
      if (!m || !p || !c) return;
      m.disabled = n <= min; p.disabled = n >= MAX;
      if (c.textContent !== String(n)) { c.textContent = n; bump(c); }
      if ((ae === m && m.disabled) || (ae === p && p.disabled)) { try { (ae === m ? p : m).focus({ preventScroll: true }); } catch (e) {} }
    });
    Array.prototype.forEach.call(doc.querySelectorAll(".ppl-faces"), function (el) { el.innerHTML = facesHTML(); });
  }

  /* ── 로비 ── */
  var CARDS = [
    { id: "pick", title: "뽑기", tag: "누가 할지, 순서, 팀을 정하고 카드도 뽑아요", meta: ["2명부터", "몇 초면 끝"] },
    { id: "balance", title: "밸런스 게임", tag: "둘 중 하나를 몰래 고르고 다 같이 공개해요", meta: ["2명부터", "한 판 5~15분"] },
    { id: "liar", title: "라이어 게임", tag: "제시어를 모르는 한 사람을 찾아요", meta: ["3명부터", "한 판 5분"] }
  ];
  var shown = null;
  function renderLobby() {
    var n = P.roster.length, ul = $("tokens");
    var empty = $("paEmpty");
    if (!empty) {
      empty = doc.createElement("div"); empty.className = "pa-empty"; empty.id = "paEmpty";
      empty.innerHTML = ic("users", "is-lg") + "<b>함께할 사람을 추가해 주세요</b><p>모임 글에서 열면 참석 명단이 그대로 들어와요.<br>이름 없이 아래 + 버튼으로 인원만 정해도 돼요.</p>"
        + '<button type="button" class="pa-btn is-primary is-sm" data-act="open-sheet">' + ic("plus", "is-sm") + "이름 추가</button>";
      ul.parentNode.insertBefore(empty, ul.nextSibling);
    }
    empty.hidden = !!n; ul.hidden = !n; $("editBtn").hidden = !n;
    // 두 줄까지만 보이고 나머지는 '더 보기'(게임 카드가 첫 화면에 들어오게)
    var cols = Math.max(4, Math.floor(((ul.clientWidth || 326) + 4) / 62)), tiles = cols * 2;
    var LIM = n + 1 <= tiles ? n : tiles - 2, list = P.roster.slice(0, LIM), more = n - LIM;
    var first = shown === null, prev = shown || {}, k = 0;
    shown = {};
    ul.innerHTML = list.map(function (name) {
      var key = nickKey(name), isNew = first || !prev[key];
      shown[key] = 1;
      return "<li" + (isNew ? ' class="is-new" style="--i:' + (k++) + '"' : "") + '><button type="button" class="pa-tok-btn" data-act="edit" aria-haspopup="dialog" aria-label="' + esc(name) + '">' + tok(name, "md") + '<span class="nm">' + esc(disp(name)) + "</span></button></li>";
    }).join("")
      + (more > 0 ? '<li><button type="button" class="pa-tok-btn is-more" data-act="edit" aria-haspopup="dialog" aria-label="나머지 ' + more + '명 보기"><span class="tok is-md">+' + more + '</span><span class="nm">더 보기</span></button></li>' : "")
      + '<li><button type="button" class="pa-tok-btn is-add" data-act="open-sheet" aria-haspopup="dialog" aria-label="플레이어 추가"><span class="tok is-md">' + ic("plus") + '</span><span class="nm">추가</span></button></li>';
    var b = $("bungLine");
    if (P.bung) {
      b.hidden = false;
      b.innerHTML = ic("calendar", "is-sm") + '<a href="news.html?cat=bung#post-' + Number(P.bung.id) + '">' + esc(P.bung.title || "모임 글") + "</a>"
        + "<span>" + (P.bung.n != null ? "참석 " + P.bung.n + "명" : "불러오는 중") + "</span>"
        + '<button type="button" class="pa-link is-icon" data-act="reload-bung" aria-label="참석 명단 다시 불러오기" title="다시 불러오기">' + ic("refresh", "is-sm") + "</button>";
    } else b.hidden = true;
    $("games").innerHTML = CARDS.map(function (c) {
      var g = P.games[c.id], need = g ? g.min - n : 0;
      return '<button type="button" class="pa-game' + (need > 0 ? " is-locked" : "") + '" data-game="' + c.id + '" data-act="open-game">'
        + '<span class="pa-game-text"><span class="pa-game-title">' + c.title + '</span><span class="pa-game-tag">' + c.tag + "</span>"
        + '<span class="pa-game-meta">' + (need > 0 ? '<i class="is-lock">' + ic("lock") + need + "명 더 필요</i>" + "<i>" + c.meta[1] + "</i>" : c.meta.map(function (m) { return "<i>" + m + "</i>"; }).join("")) + "</span></span>"
        + '<span class="pa-game-art">' + art(c.id) + "</span></button>";
    }).join("");
    syncPpl();
  }

  /* ── 플레이어 창(아래에서 올라오는 창. 뒤로 가기와 끌어 닫기, 초점은 site-core) ── */
  var sheet = $("addSheet"), sheetShown = null, sheetOpener = null;
  function openSheet(focusInput) {
    if (!sheet.hidden) return;
    sheetOpener = doc.activeElement;
    sheetShown = null; renderSheet(); $("addSuggest").innerHTML = suggestHTML([]);
    sheet.hidden = false; root.classList.add("pa-sheet-open");
    // 아이폰은 누른 그 순간에 초점을 줘야 자판이 올라온다
    if (focusInput) { try { $("addInput").focus(); } catch (e) {} }
  }
  function closeSheet() {
    if (sheet.hidden) return;
    sheet.hidden = true; root.classList.remove("pa-sheet-open");
    var o = sheetOpener; sheetOpener = null;
    if (o && doc.body.contains(o) && !play.contains(o)) { try { o.focus({ preventScroll: true }); } catch (e) {} }
  }
  function renderSheet() {
    var n = P.roster.length;
    $("sheetCount").textContent = n;
    $("clearAll").hidden = !n;
    var first = sheetShown === null, prev = sheetShown || {};
    sheetShown = {};
    $("addList").innerHTML = n ? P.roster.map(function (name, i) {
      var key = nickKey(name), isNew = !first && !prev[key];
      sheetShown[key] = 1;
      return "<li" + (isNew ? ' class="is-new"' : "") + ">" + tok(name, "sm") + '<span class="nm">' + esc(name) + '</span><button type="button" class="rm" data-rm="' + i + '" aria-label="' + esc(name) + ' 빼기">' + ic("x", "is-sm") + "</button></li>";
    }).join("") : '<li class="pa-roster-empty">아직 아무도 없어요. 위 칸에 이름을 적어 주세요.</li>';
  }
  function suggestHTML(names) {
    var me = savedNick(), has = function (x) { return P.roster.some(function (y) { return nickKey(y) === nickKey(x); }); };
    var out = "";
    if (me && !has(me) && !names.some(function (x) { return nickKey(x) === nickKey(me); })) out += '<button type="button" class="pa-sug is-me" data-sug="' + esc(me) + '" aria-label="내 닉네임 ' + esc(me) + ' 넣기">' + tok(me, "xs") + "<span>" + esc(me) + "</span><em>나</em></button>";
    names.forEach(function (x) { if (!has(x)) out += '<button type="button" class="pa-sug" data-sug="' + esc(x) + '" aria-label="' + esc(x) + ' 넣기">' + tok(x, "xs") + "<span>" + esc(x) + "</span></button>"; });
    return out;
  }
  $("addForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var inp = $("addInput");
    if (addName(inp.value)) { inp.value = ""; $("addSuggest").innerHTML = suggestHTML([]); sfx("pop"); changed(); scrollRosterEnd(); }
    try { inp.focus(); } catch (er) {}
  });
  function scrollRosterEnd() { var l = $("addList"); if (l) l.scrollTop = l.scrollHeight; }
  var memT = null, memCache = {}, memQ = "";
  $("addInput").addEventListener("input", function () {
    var q = this.value.trim(); clearTimeout(memT); memQ = q;
    if (!q) { $("addSuggest").innerHTML = suggestHTML([]); return; }
    memT = setTimeout(function () {
      if (memCache[q]) { if (memQ === q) $("addSuggest").innerHTML = suggestHTML(memCache[q]); return; }
      supaFetch("/rest/v1/rpc/member_find", { method: "POST", body: JSON.stringify({ p_q: q }) })
        .then(function (rows) {
          var names = (rows || []).map(function (r) { return r && r.name; }).filter(function (x) { return typeof x === "string" && x.trim(); }).slice(0, 8);
          memCache[q] = names;
          if (memQ === q) $("addSuggest").innerHTML = suggestHTML(names);
        }).catch(function () {});
    }, 220);
  });
  sheet.addEventListener("click", function (e) {
    if (e.target === sheet || e.target.closest(".modal-close, [data-close]")) { closeSheet(); return; }
    var rm = e.target.closest("[data-rm]");
    if (rm) {
      var i = Number(rm.getAttribute("data-rm")), name = P.roster[i];
      if (name == null) return;
      P.roster.splice(i, 1); sfx("tap"); changed();
      var btns = $("addList").querySelectorAll(".rm");
      var nx = btns[Math.min(i, btns.length - 1)];
      try { (nx || $("addInput")).focus({ preventScroll: true }); } catch (er) {}
      say(name + " 빠짐");
      return;
    }
    var sg = e.target.closest("[data-sug]");
    if (sg) {
      if (addName(sg.getAttribute("data-sug"))) { sfx("pop"); changed(); scrollRosterEnd(); $("addInput").value = ""; memQ = ""; $("addSuggest").innerHTML = suggestHTML([]); }
      try { $("addInput").focus({ preventScroll: true }); } catch (er) {}
      return;
    }
    if (e.target.closest("#clearAll")) {
      var n = P.roster.length; if (!n) return;
      confirm({ title: "명단을 모두 비울까요?", text: n + "명이 모두 빠져요.", yes: "비우기", no: "그대로 두기", danger: true }).then(function (ok) {
        if (!ok) return;
        P.roster = []; changed(); toast("명단을 비웠어요.");
        try { $("addInput").focus(); } catch (er) {}
      });
    }
  });

  /* 모임 글의 참석 명단 불러오기(?bung=글번호). 명단은 사이트에 이미 공개된 것과 같다 */
  // 명단을 마지막으로 불러온 모임 글. 다른 모임 글에서 열면 명단을 그 모임 참석자로 바꾼다(지난 모임 사람이 섞이지 않게)
  var FROM_KEY = "excer_party_from";
  function fromBung() { try { return Number(localStorage.getItem(FROM_KEY)) || 0; } catch (e) { return 0; } }
  function loadBung(id, again) {
    id = Number(id); if (!(id > 0)) return;
    if (!(P.bung && P.bung.id === id)) { P.bung = { id: id, title: "", n: null }; renderLobby(); }
    Promise.all([
      supaFetch("/rest/v1/site_posts_v?id=eq." + id + "&select=id,title,category").then(function (r) { return r && r[0]; }),
      supaFetch("/rest/v1/site_bung_attend_v?post_id=eq." + id + "&select=nick,created_at&order=created_at.asc")
    ]).then(function (res) {
      var post = res[0], list = res[1] || [];
      if (!post) { P.bung = null; saveSession(); renderLobby(); toast("그 모임 글을 찾지 못했어요."); return; }
      P.bung = { id: id, title: post.title || "모임 글", n: list.length };
      var swap = list.length > 0 && P.roster.length > 0 && fromBung() !== id;
      if (swap) P.roster = [];
      var added = 0, dup = 0, cap = 0;
      list.forEach(function (x) { if (!x) return; if (addName(x.nick, true)) added++; else if (addFail === "dup") dup++; else if (addFail === "cap") cap++; });
      if (list.length) { try { localStorage.setItem(FROM_KEY, String(id)); } catch (e) {} }
      changed();
      if (!list.length) toast("아직 참석한 사람이 없어요. 이름을 적거나 인원만 정해 주세요.");
      else if (swap) { toast("이 모임 참석자 " + added + "명으로 명단을 바꿨어요." + (cap ? " " + MAX + "명이 넘어 " + cap + "명은 못 넣었어요." : "")); sfx("coin"); }
      else if (added) {
        toast((added === list.length ? "참석 명단 " + list.length + "명을 넣었어요." : "참석 명단 " + list.length + "명 중 " + added + "명을 넣었어요.")
          + (dup ? " 이미 있던 " + dup + "명은 그대로예요." : "") + (cap ? " " + MAX + "명이 넘어 " + cap + "명은 못 넣었어요." : ""));
        sfx("coin");
      }
      else if (cap) toast("플레이어가 " + MAX + "명이라 더 넣지 못했어요.");
      else if (again) toast("참석 명단이 이미 다 들어 있어요.");
    }).catch(function () {
      toast(again ? "명단을 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요." : "명단을 불러오지 못했어요. 이름을 직접 적을 수 있어요.");
      if (P.bung && P.bung.n == null) P.bung.n = 0;
      renderLobby();
    });
  }

  $("main").addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b || !$("main").contains(b)) return;
    var a = b.getAttribute("data-act");
    if (a === "open-sheet") openSheet(true);
    else if (a === "edit") openSheet(false);
    else if (a === "reload-bung" && P.bung) loadBung(P.bung.id, true);
    else if (a === "open-game") openGame(b.getAttribute("data-game"), { opener: b });
    else if (a === "ppl") people(Number(b.getAttribute("data-d")), 0);
  });
  $("editBtn").addEventListener("click", function () { openSheet(false); });
  var rzW = window.innerWidth, rzT = 0;
  window.addEventListener("resize", function () { if (window.innerWidth === rzW) return; rzW = window.innerWidth; clearTimeout(rzT); rzT = setTimeout(renderLobby, 150); }, { passive: true });
  $("soundBtn").addEventListener("click", toggleSound);
  $("pgSound").addEventListener("click", toggleSound);

  /* ── 질문 묶음: 파일을 읽고, 못 읽으면 안에 든 작은 묶음으로 ── */
  var FALLBACK = {
    balance: {
      "음식": [["탕수육 부먹", "탕수육 찍먹"], ["물냉면", "비빔냉면"], ["평생 삼겹살만", "평생 치킨만"], ["밀떡볶이", "쌀떡볶이"], ["김치찌개", "된장찌개"], ["짜장면", "짬뽕"]],
      "일상": [["아침형 인간", "올빼미형 인간"], ["평생 여름만", "평생 겨울만"], ["산", "바다"], ["계획형 여행", "즉흥형 여행"], ["영화관에서 영화", "집에서 영화"], ["메시지로 연락", "전화로 연락"]]
    },
    liar: { "음식": ["삼겹살", "치킨", "떡볶이", "김치찌개", "냉면", "초밥", "피자", "라면"], "장소": ["노래방", "볼링장", "한강공원", "영화관", "편의점", "카페", "찜질방", "헬스장"] },
    missions: ["다음 건배사 맡기", "2차 장소 고르기", "옆 사람 칭찬 한 가지 하기(외모 말고)", "최근 가 본 맛집 하나 추천하기", "다음 메뉴 주문 맡기", "오늘 가장 웃겼던 순간 꼽기"],
    talk: ["요즘 제일 빠져 있는 것은?", "이 동네에서 제일 좋아하는 길은?", "최근에 제일 잘 산 물건은?", "올해 가장 잘한 일 하나는?", "요즘 자주 듣는 노래는?", "다음에 가 보고 싶은 동네 가게는?"]
  };
  var packs = null;
  fetch("data/party-packs.json?v=2").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (j) { if (j && j.balance && j.liar && j.missions && j.talk) packs = j; }).catch(function () {});
  function pack() { return packs || FALLBACK; }
  // 한 바퀴 돌기 전에는 같은 것이 다시 나오지 않게 뽑는다
  function draw(list, used, key) {
    key = key || String;
    var pool = list.filter(function (x) { return used.indexOf(key(x)) < 0; });
    if (!pool.length) { used.length = 0; pool = list.slice(); }
    var x = rnd(pool); used.push(key(x));
    if (used.length > 300) used.splice(0, used.length - 300);
    return x;
  }

  /* ── 확인 창 ── */
  var dlg = { el: $("paDialog"), res: null, back: false, prev: null };
  function confirm(o) {
    return new Promise(function (resolve) {
      if (dlg.res) dlg.res(false);
      $("paDialogTitle").textContent = o.title || "";
      var tx = $("paDialogText"); tx.textContent = o.text || ""; tx.hidden = !o.text;
      var yes = $("paDialogYes"), no = $("paDialogNo");
      yes.textContent = o.yes || "확인"; no.textContent = o.no || "취소";
      yes.className = "pa-btn " + (o.danger ? "is-danger" : "is-primary");
      dlg.back = !!o.backMeansYes; dlg.prev = doc.activeElement;
      dlg.el.hidden = false;
      dlg.res = function (v) {
        dlg.res = null; dlg.el.hidden = true;
        if (dlg.prev && doc.body.contains(dlg.prev) && !v) { try { dlg.prev.focus({ preventScroll: true }); } catch (e) {} }
        resolve(v);
      };
      setTimeout(function () { try { no.focus(); } catch (e) {} }, 40);
      sfx("pop");
    });
  }
  $("paDialogYes").addEventListener("click", function () { if (dlg.res) dlg.res(true); });
  $("paDialogNo").addEventListener("click", function () { if (dlg.res) dlg.res(false); });
  dlg.el.addEventListener("click", function (e) { if (e.target === dlg.el && dlg.res) dlg.res(false); });
  // 창이 떠 있는 동안 Tab 과 Esc 는 창 안에서만(뒤쪽 창의 초점 가두기보다 먼저 잡는다)
  window.addEventListener("keydown", function (e) {
    if (dlg.el.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (dlg.res) dlg.res(false); }
    else if (e.key === "Tab") {
      e.preventDefault(); e.stopPropagation();
      var a = [$("paDialogNo"), $("paDialogYes")], i = a.indexOf(doc.activeElement);
      a[i < 0 ? 0 : (i + 1) % 2].focus();
    }
  }, true);

  /* ── 게임 화면 틀 ── */
  var play = $("play"), gBody = $("pgBody"), gFoot = $("pgFoot"), gProg = $("pgProgress"), gPop = $("pgPop"), gSplash = $("pgSplash");
  /* 기록(history) 칸 둘: 1 은 받침, 2 는 게임. 뒤로 가기 한 번은 게임에서 받침으로(진행 중이면 묻기),
     묻는 중에 한 번 더 뒤로 가면 받침에서 쪽으로 내려와 나간다. 쪽(로비)은 그대로 남는다 */
  var opener = null, ignorePop = 0, paintAt = 0, hideT = 0, popOpen = false, popT = 0, keep = false;
  function G() { return P.cur ? P.games[P.cur] : null; }
  // 게임 화면이 떠 있는 동안 뒤쪽(로비, 메뉴)은 화면 읽기와 초점에서 빼고, 알림 칸은 게임 화면 안으로 옮긴다(aria-modal 밖은 읽지 않는 브라우저)
  function behind(on) {
    [$("main"), $("topnav"), doc.querySelector(".site-footer"), doc.querySelector(".bottom-tabbar"), doc.querySelector(".skip-link")].forEach(function (el) {
      if (!el) return;
      if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert");
    });
    var host = on ? play : doc.body;
    [$("live"), $("toast")].forEach(function (el) { if (el && el.parentNode !== host) host.appendChild(el); });
  }
  function histDepth() { try { return (history.state && history.state.excerParty) || 0; } catch (e) { return 0; } }
  function pushTo(n) { try { for (var d = histDepth() + 1; d <= n; d++) history.pushState({ excerParty: d }, "", location.href); } catch (e) {} }
  function unwind() { var d = histDepth(); if (d > 0) { ignorePop++; try { history.go(-d); } catch (e) { ignorePop--; } } }
  function openGame(id, o) {
    o = o || {};
    var g = P.games[id]; if (!g) return;
    var need = g.min - P.roster.length;
    if (need > 0) {
      toast(josa(g.title, "은", "는") + " " + g.min + "명부터 할 수 있어요. " + need + "명 더 추가해 주세요.");
      sfx("pop"); openSheet(true); return;
    }
    closeSheet();
    clearTimeout(hideT); play.classList.remove("is-out");
    P.cur = id; P.busy = false;
    play.setAttribute("data-theme", id);
    $("pgTitle").textContent = g.title;
    $("pgArt").innerHTML = art(id);
    syncSound();
    opener = o.opener || doc.activeElement;
    play.hidden = false; root.classList.add("is-playing");
    play.classList.remove("is-in"); void play.offsetWidth; play.classList.add("is-in");
    behind(true);
    pushTo(2);
    P.st = o.state || g.fresh(P.prefs[id] || {});
    try { g.show(P.st, !!o.restored); }
    catch (e) { P.st = g.fresh(P.prefs[id] || {}); g.show(P.st, false); }   // 이어 하기 저장이 깨져 있으면 처음 화면으로
    wake(true);
    if (!o.restored) sfx("whoosh");
  }
  function leaveGame(o) {
    o = o || {};
    var g = G(); if (!g) return;
    if (g.stop) { try { g.stop(P.st); } catch (e) {} }
    if (g.prefs) { try { P.prefs[P.cur] = g.prefs(P.st); } catch (e) {} }
    P.cur = null; P.st = null; P.busy = false;
    popClose(true); splashKill(); confettiStop();
    root.classList.remove("is-playing"); behind(false);
    // 게임 화면은 잠깐 흐려지며 사라진다
    play.classList.add("is-out");
    hideT = setTimeout(function () { play.hidden = true; play.classList.remove("is-out"); gBody.innerHTML = ""; gFoot.innerHTML = ""; gProg.hidden = true; }, reduced() ? 0 : 160);
    wake(false); saveSession();
    unwind();
    renderLobby();
    var back = opener && doc.body.contains(opener) ? opener : doc.querySelector('.pa-game[data-game="' + (o.id || "") + '"]');
    if (back) { try { back.focus({ preventScroll: true }); } catch (e) {} }
  }
  function dirty() { var g = G(); return !!(g && g.dirty && g.dirty(P.st)); }
  function askExit() {
    return confirm({ title: "게임을 그만할까요?", text: "지금 하던 판은 사라져요.", yes: "그만하기", no: "계속하기", danger: true, backMeansYes: true }).then(function (yes) {
      if (!P.cur) return;
      if (yes) leaveGame({ id: P.cur }); else pushTo(2);
    });
  }
  function requestClose() {
    if (!P.cur) return;
    if (popOpen) { popClose(); return; }
    if (dirty()) askExit(); else leaveGame({ id: P.cur });
  }
  window.addEventListener("popstate", function () {
    if (ignorePop > 0) { ignorePop--; return; }
    if (!P.cur) { if (dlg.res) dlg.res(false); return; }
    if (histDepth() >= 2) return;
    if (dlg.res) { dlg.res(dlg.back); return; }       // 묻는 중에 한 번 더 뒤로 가면 그만하기
    if (popOpen) { popClose(); pushTo(2); return; }
    if (dirty()) askExit(); else leaveGame({ id: P.cur });
  });
  $("pgClose").addEventListener("click", requestClose);

  function progress(pr) {
    if (!pr || !pr.n) { gProg.hidden = true; gProg.innerHTML = ""; return; }
    var s = ""; for (var k = 0; k < pr.n; k++) s += "<i" + (k < pr.i ? ' class="on"' : k === pr.i ? ' class="now"' : "") + "></i>";
    gProg.innerHTML = s; gProg.hidden = false;
    gProg.setAttribute("aria-hidden", "true");
  }
  function focusTitle() { try { $("pgTitle").focus({ preventScroll: true }); } catch (e) {} }
  // 한 화면을 그린다: 몸통(차례로 떠오름), 아래 단추 줄, 위 진행 막대
  // keep(인원을 바꿔 그 자리에서 다시 그릴 때): 떠오르는 움직임, 스크롤 맨 위로, 읽어 주기, 제목 초점, 두 번 누름 막기를 하지 않는다
  function screen(o) {
    if (!P.cur) return;
    gBody.innerHTML = '<div class="pg-in' + (keep ? " is-still" : "") + (o.cls ? " " + o.cls : "") + '">' + (o.body || "") + "</div>";
    var kids = gBody.firstChild.children;
    for (var i = 0; i < kids.length; i++) kids[i].style.setProperty("--i", Math.min(i, 8));
    gFoot.innerHTML = o.foot ? '<div class="pg-foot-in">' + o.foot + "</div>" : "";
    progress(o.prog);
    if (o.title) $("pgTitle").textContent = o.title;
    if (!keep) {
      paintAt = performance.now();
      gBody.scrollTop = 0;
      if (o.say) say(o.say);
      var ae = doc.activeElement;
      if (!ae || ae === doc.body || !play.contains(ae)) focusTitle();
    }
    saveSession();
  }
  // 인원을 바꾼 뒤: 설정 화면은 단추와 얼굴 줄만 고치고(g.people), 뽑기처럼 화면이 이름으로 그려지면 그 자리에서 다시 그린다
  function refresh(b, had) {
    var g = G(); if (!g) return;
    if (g.people) { g.people(P.st); return; }
    var y = gBody.scrollTop, d = b.getAttribute("data-d");
    keep = true;
    try { g.show(P.st); } finally { keep = false; }
    gBody.scrollTop = y;
    var nb = gBody.querySelector('.pstep [data-d="' + d + '"]');
    if (nb && nb.disabled) nb = gBody.querySelector('.pstep [data-d="' + (-Number(d)) + '"]');
    if (had && nb) { try { nb.focus({ preventScroll: true }); } catch (e) {} }
    var c = gBody.querySelector(".pstep-n b"); if (c) bump(c);
  }
  // 몸통은 그대로 두고 아래 단추 줄만 바꾼다
  function setFoot(html) { gFoot.innerHTML = html ? '<div class="pg-foot-in">' + html + "</div>" : ""; }

  /* 스플래시: 화면 전체에 크게 한 장(또는 여러 장을 차례로). 누르면 건너뛴다 */
  var spl = { t: 0, h: 0, done: null, fin: null };
  function splash(o) {
    o = o || {};
    var seq = o.seq || [o], step = o.ms || (seq.length > 1 ? 720 : 1150);
    if (reduced()) step = Math.min(step, 650);
    splashKill();
    return new Promise(function (resolve) {
      var i = 0, finished = false;
      gSplash.classList.remove("is-out"); gSplash.hidden = false;
      function show(s) {
        gSplash.innerHTML = '<div class="rays"></div><div class="glow"></div><div class="ring"></div><div class="in">'
          + (s.k ? '<span class="k">' + esc(s.k) + "</span>" : "")
          + '<span class="big' + (s.word ? " is-word" : "") + '" data-t="' + esc(s.big) + '"><span>' + esc(s.big) + "</span></span>"
          + (s.sub ? '<span class="sub">' + esc(s.sub) + "</span>" : "")
          + (s.note ? '<span class="note">' + s.note + "</span>" : "") + "</div>";
        if (s.sound !== false) sfx(s.sound || "rise");
        if (s.buzz) buzz(s.buzz);
      }
      function next() {
        if (finished) return;
        i++;
        if (i < seq.length) { show(seq[i]); spl.t = setTimeout(next, step); }
        else end();
      }
      function end() {
        if (finished) return;
        finished = true; clearTimeout(spl.t); spl.done = null;
        gSplash.classList.add("is-out");
        spl.fin = function () { spl.fin = null; clearTimeout(spl.h); gSplash.hidden = true; gSplash.classList.remove("is-out"); gSplash.innerHTML = ""; resolve(); };
        spl.h = setTimeout(spl.fin, 200);
      }
      spl.done = end;
      show(seq[0]);
      spl.t = setTimeout(next, step);
    });
  }
  // 떠 있거나 사라지는 중인 스플래시를 바로 치운다(기다리던 쪽은 바로 이어 간다)
  function splashKill() { clearTimeout(spl.t); if (spl.done) spl.done(); if (spl.fin) spl.fin(); }
  gSplash.addEventListener("click", function () { if (spl.done) spl.done(); });

  /* 결과 팝업 */
  function pop(html, label) {
    clearTimeout(popT); gPop.classList.remove("is-out");
    gPop.innerHTML = '<div class="pg-pop-card" role="group" aria-label="' + esc(label || "결과") + '">' + html + "</div>";
    gPop.hidden = false; popOpen = true; paintAt = performance.now();
    setTimeout(function () { var b = gPop.querySelector(".pa-btn"); if (b) { try { b.focus({ preventScroll: true }); } catch (e) {} } }, 60);
  }
  function popClose(now) {
    if (!popOpen) return;
    popOpen = false;
    var fin = function () { gPop.hidden = true; gPop.classList.remove("is-out"); gPop.innerHTML = ""; };
    if (now || reduced()) fin(); else { gPop.classList.add("is-out"); popT = setTimeout(fin, 150); }
    var g = G(); if (g && g.popClosed) g.popClosed(P.st);
  }
  gPop.addEventListener("click", function (e) { if (e.target === gPop) popClose(); });

  // 게임 안의 단추는 모두 data-act 로 받아 그 게임에 넘긴다
  play.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b || !play.contains(b) || b.disabled) return;
    // 화면이 바뀐 직후의 누름은 버린다(두 번 누르면 다음 화면의 같은 자리 단추까지 눌리던 것)
    if (performance.now() - paintAt < 400) return;
    var g = G(); if (!g) return;
    var a = b.getAttribute("data-act");
    if (a === "pop-close") { popClose(); return; }
    if (a === "leave") { leaveGame({ id: P.cur }); return; }
    if (P.busy) return;
    if (a === "ppl") {
      var had = !!(doc.activeElement && doc.activeElement.closest && doc.activeElement.closest("#pgBody .pstep"));   // 고치기 전에 잰다(빼기가 꺼지면 초점이 옮겨 가므로)
      if (people(Number(b.getAttribute("data-d")), g.min)) refresh(b, had);
      return;
    }
    g.act(a, b, P.st, e);
  });
  // 게임 화면 안에서의 Tab(빠져나가지 않게)과 Esc(팝업 닫기, 그다음 나가기)
  doc.addEventListener("keydown", function (e) {
    if (!dlg.el.hidden) return;
    if (play.hidden) { if (e.key === "Escape" && !sheet.hidden) { e.preventDefault(); closeSheet(); } return; }
    if (e.key === "Escape") {
      e.preventDefault();
      if (!gSplash.hidden) { if (spl.done) spl.done(); return; }
      requestClose();
      return;
    }
    if (e.key !== "Tab") return;
    var box = popOpen ? gPop : play;
    var items = Array.prototype.filter.call(box.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'), function (el) { return el.offsetWidth || el.offsetHeight || el.getClientRects().length; });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1], here = doc.activeElement, inside = box.contains(here);
    if (e.shiftKey ? (here === first || !inside) : (here === last || !inside)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  });

  /* 누르는 소리: 단추를 누르는 순간 짧게. 처음 누를 때 소리 장치를 깨운다(브라우저 약속) */
  doc.addEventListener("pointerdown", function (e) {
    unlockAudio();
    var t = e.target.closest && e.target.closest(".pa-btn, .pchip, .seg button, .pa-icon, .pg-icon, .pa-link, .pa-tok-btn, .pa-game");
    if (t && !t.disabled && !t.hasAttribute("data-quiet")) sfx("tap");
  }, true);
  doc.addEventListener("keydown", function () { unlockAudio(); }, true);
  doc.addEventListener("touchend", function () { unlockAudio(); }, { capture: true, passive: true });

  /* 화면 꺼짐 막기: 게임 화면이 떠 있는 동안만 */
  var wl = null, wlWant = false;
  function wake(on) {
    wlWant = on;
    if (!("wakeLock" in navigator)) return;
    if (on && !wl && doc.visibilityState === "visible") {
      navigator.wakeLock.request("screen").then(function (l) { wl = l; l.addEventListener("release", function () { if (wl === l) wl = null; }); if (!wlWant) { try { l.release(); } catch (e) {} } }).catch(function () {});
    } else if (!on && wl) { try { wl.release(); } catch (e) {} wl = null; }
  }
  doc.addEventListener("visibilitychange", function () {
    if (doc.visibilityState === "visible" && wlWant) wake(true);
    var g = G(); if (g && g.wake) g.wake(P.st, doc.visibilityState === "visible");
  });

  /* ── 저장: 명단은 이 기기(localStorage), 진행 중인 판은 이 탭(sessionStorage) ── */
  function saveSession() {
    try {
      var g = G();
      sessionStorage.setItem(STATE_KEY, JSON.stringify({ v: 2, bung: P.bung, prefs: P.prefs, game: P.cur, st: g ? (g.snap ? g.snap(P.st) : P.st) : null }));
    } catch (e) {}
  }

  /* ── 공유와 복사 ── */
  var SITE = "https://excer-site.vercel.app";
  function share(o) {
    var base = /^https?:\/\/(127\.|localhost)/.test(location.origin) ? location.origin : SITE;
    if (!window.KSHARE) { copy(base + "/party.html"); return; }
    window.KSHARE.share({
      title: o.title, description: o.desc,
      url: base + "/party.html", imageUrl: base + "/assets/og-party.jpg?v=1", buttonTitle: "우리도 해 보기"
    }).then(function (r) { if (r === "copy") { toast("링크를 복사했어요. 채팅방에 붙여 넣어 주세요."); return; } var m = window.KSHARE.message(r); if (m) toast(m); });
  }
  function copy(text) {
    var done = function () { toast("복사했어요. 채팅방에 붙여 넣어 주세요."); sfx("coin"); };
    var p = navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(text) : Promise.reject();
    p.then(done).catch(function () {
      try {
        var ta = doc.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
        play.appendChild(ta); ta.select(); var ok = doc.execCommand("copy"); play.removeChild(ta);
        if (ok) done(); else toast("복사하지 못했어요.");
      } catch (e) { toast("복사하지 못했어요."); }
    });
  }

  /* ── 게임 쪽에 넘기는 것 ── */
  P.h = { esc: esc, shuffle: shuffle, rnd: rnd, clamp: clamp, josa: josa, buzz: buzz, wait: wait, fmtTime: fmtTime, ic: ic, FP: FP, art: art, tok: tok, disp: disp, color: color, initial: initial, nickKey: nickKey, reduced: reduced, toast: toast, say: say, draw: draw, pt: pt, slicePath: slicePath, PALETTE: PALETTE,
    stepper: stepper, faces: facesHTML, syncPpl: syncPpl };
  P.sfx = sfx; P.confetti = confetti; P.confettiStop = confettiStop; P.splash = splash; P.screen = screen; P.setFoot = setFoot; P.pop = pop; P.popClose = popClose;
  P.confirm = confirm; P.save = saveSession; P.leave = function () { leaveGame({ id: P.cur }); }; P.share = share; P.copy = copy; P.pack = pack;
  P.focusTitle = focusTitle; P.body = gBody; P.foot = gFoot;

  /* ── 시작 ── */
  function boot() {
    $("paLogo").innerHTML = art("logo");
    syncSound();
    loadRoster();
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || "null"); } catch (e) {}
    if (saved && saved.v === 2) {
      if (saved.bung && saved.bung.id) P.bung = saved.bung;
      if (saved.prefs && typeof saved.prefs === "object") P.prefs = saved.prefs;
    }
    renderLobby();
    var qs = new URLSearchParams(location.search), bung = Number(qs.get("bung"));
    if (bung > 0) {
      loadBung(bung, false);
      // 한 번 넣은 뒤에는 주소에서 뺀다. 새로고침 때 손으로 뺀 사람이 다시 들어오지 않게(다시 넣기는 모임 줄의 단추)
      try { qs.delete("bung"); history.replaceState(history.state, "", location.pathname + (qs.toString() ? "?" + qs : "") + location.hash); } catch (e) {}
    }
    // 다른 모임 글에서 들어왔으면 이 탭에 남은 지난 판은 이어 하지 않는다(명단이 바뀐다)
    var other = bung > 0 && !(saved && saved.bung && Number(saved.bung.id) === bung);
    var g = !other && saved && saved.game && P.games[saved.game], st = null;
    if (g && P.roster.length >= g.min && g.restore) { try { st = g.restore(saved.st, P.prefs[saved.game] || {}); } catch (e) { st = null; } }
    if (st) openGame(saved.game, { state: st, restored: true });
    else unwind();   // 게임 없이 남은 기록 칸에서 다시 열렸으면 쪽 칸으로
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);
})();
