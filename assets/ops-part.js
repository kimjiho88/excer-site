/* ============================================================
   ops-part.js : 운영 대시보드의 모임 참여 (ops.html 에서만 읽는다)
   ------------------------------------------------------------
   벙 기록은 소식의 모임 모집 글과 참석 명단이 원본이고, 사람은 대화 기록(원장)의 사람이다.
   build(o) 의 o
     posts: 모임 글 [{ id, title, author, pinned, meta: { date, time, end, place, cap } }]
     att: 참석 명단 { 글 id: [{ nick, at, host }] }
     now: 지금(한국 시각 "YYYY-MM-DDTHH:MM")
     people: 대화 기록의 사람 [{ pid, name, names(이력), inRoom, joinedAt, joinedBeforeFile, joins, re(재입장 수), parts: { sex, birth, birthYear, day }, d30(대화), first(첫 대화) }]
     alias: 이름 규칙 { 붙인 이름: pid | "guest" | "skip" }, ignore: 세지 않는 글 { 글 id: 1 }
     exc: 모임 점검에서 뺀 사람 { pid: "YYYY-MM-DD"(이 날까지) }, settings: { firstMeetDays, regularDays }, nickParts: 닉네임 칸 나누기
   - 시작한 글만 센다(시각이 없으면 그날 23:59 뒤). 모임장은 글쓴이, 참여자는 참석 명단(모임장 빼고).
     '게스트'로 적은 이름은 게스트. 모임장 말고 참석자가 없으면 세지 않는다.
   - 이름 찾기 차례: 이름 규칙, 게스트, 지금 닉네임, 닉네임 이력, 닉네임 첫 칸과 출생연도와 성별.
     찾지 못하거나 둘 이상에 맞는 이름은 적힌 그대로 한 사람으로 센다(열쇠 "n:" + 붙인 이름).
   ============================================================ */
(function (global) {
  "use strict";
  var DAY = 86400000;
  var DRE = /^\d{4}-\d{2}-\d{2}$/, HM = /^\d{2}:\d{2}$/;
  var GUEST_RE = /^(게스트|게)\s*\d*\s*(?:[(（].*[)）])?$/;
  function clean(s) { var t = String(s == null ? "" : s); if (t.normalize) t = t.normalize("NFC"); return t.replace(/[\u00AD\u200B-\u200F\u2060-\u206F\uFEFF]/g, "").replace(/[\u00A0\u3000]/g, " ").trim(); }
  function squash(s) { return clean(s).replace(/\s+/g, " "); }
  function tight(s) { return clean(s).replace(/\s+/g, "").toLowerCase(); }
  // 이름 열쇠: 끝의 하트나 이모지는 떼고(닉네임에 붙였다 뗐다 한다), 공백 없이 작은 글자로
  function bare(s) { var t = squash(s); try { t = t.replace(/[\s\uFE0F\u200D\p{Extended_Pictographic}]+$/u, ""); } catch (e) {} return tight(t || s); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function dnum(d) { return Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY); }
  function dateOf(n) { var t = new Date(n * DAY); return t.getUTCFullYear() + "-" + pad2(t.getUTCMonth() + 1) + "-" + pad2(t.getUTCDate()); }
  function iso(y, m, d) {
    if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
    var t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCMonth() === m - 1 ? y + "-" + pad2(m) + "-" + pad2(d) : "";
  }
  // 닉네임의 입장일(월일 네 자리): 올해, 오늘보다 뒤면 지난해
  function dayDate(md4, today) {
    var mm = +md4.slice(0, 2), dd = +md4.slice(2), y = +today.slice(0, 4), j = iso(y, mm, dd);
    if (!j) return "";
    return j > today ? iso(y - 1, mm, dd) : j;
  }
  function mdot(d, today) { return d ? (d.slice(0, 4) !== String(today || "").slice(0, 4) ? d.slice(0, 4) + "." : "") + +d.slice(5, 7) + "." + +d.slice(8, 10) : ""; }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  /* 한글 자모로 가까운 이름(한 글자 오타) */
  var CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ", JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ", JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
  function jamo(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i) - 0xAC00;
      if (c >= 0 && c < 11172) out += CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + (c % 28 ? JONG[c % 28] : "");
      else out += s[i];
    }
    return out;
  }
  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length, prev = [], cur = [];
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      cur = [i];
      for (var k = 1; k <= n; k++) cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function nickOf(NP, s) { try { return NP(s) || {}; } catch (e) { return {}; } }

  /* 이름 찾기: 같은 이름이 여럿이면 방에 있는 사람, 그래도 여럿이면 정하지 않는다 */
  function resolver(people, alias, NP) {
    var byName = Object.create(null), byHist = Object.create(null), byHead = Object.create(null), byPid = Object.create(null), memo = Object.create(null);
    var push = function (map, k, p) { if (!k) return; var l = map[k] || (map[k] = []); if (l.indexOf(p) < 0) l.push(p); };
    people.forEach(function (p) {
      byPid[p.pid] = p;
      var k = bare(p.name);
      push(byName, k, p);
      (p.names || []).forEach(function (n) { var kk = bare(n); if (kk && kk !== k) push(byHist, kk, p); });
      [p.name].concat(p.names || []).forEach(function (n) { push(byHead, tight(nickOf(NP, n).nick), p); });
    });
    var one = function (list, via) {
      if (!list || !list.length) return null;
      if (list.length === 1) return { k: "member", id: list[0].pid, via: via };
      var l = list.filter(function (p) { return p.inRoom; });
      return l.length === 1 ? { k: "member", id: l[0].pid, via: via } : { k: "amb", ids: (l.length ? l : list).map(function (p) { return p.pid; }) };
    };
    var heads = Object.keys(byHead);
    // 첫 칸이 한 글자 다른 사람(방에 있는 사람 먼저), 세 명까지
    var suggest = function (h) {
      if (!h) return [];
      var jh = jamo(h), res = [];
      heads.forEach(function (x) {
        if (Math.abs(x.length - h.length) > 1 || lev(h, x) > 1) return;
        var jd = lev(jh, jamo(x));
        if (jd <= (h.length <= 1 ? 1 : 2)) byHead[x].forEach(function (p) { res.push({ id: p.pid, d: x === h ? -1 : jd, l: p.inRoom ? 1 : 0 }); });
      });
      var seen = {};
      return res.sort(function (a, b) { return a.d - b.d || b.l - a.l; }).filter(function (x) { if (seen[x.id]) return false; seen[x.id] = 1; return true; }).slice(0, 3).map(function (x) { return x.id; });
    };
    var find = function (raw) {
      var t = squash(raw), key = bare(t);
      var al = Object.prototype.hasOwnProperty.call(alias, key) ? alias[key] : null;
      if (al === "guest") return { k: "guest", via: "alias" };
      if (al === "skip") return { k: "skip", via: "alias" };
      if (al && byPid[al]) return { k: "member", id: al, via: "alias" };
      if (GUEST_RE.test(t)) return { k: "guest" };
      var r = one(byName[key], "name") || one(byHist[key], "history");
      var b = nickOf(NP, t), h = tight(b.nick);
      if (!r && h) {
        var c = (byHead[h] || []).filter(function (p) { var pp = p.parts || {}; return (!b.birth || !pp.birth || pp.birth === b.birth) && (!b.sex || !pp.sex || pp.sex === b.sex); });
        r = one(c, t.indexOf(" ") > 0 ? "bits" : "head");
      }
      if (r && r.k === "member") return r;
      if (r) { r.id = "n:" + key; return r; }
      return { k: "unknown", id: "n:" + key, suggest: suggest(h || key) };
    };
    return function (raw) { var k = bare(raw); if (!k) return { k: "none" }; return memo[k] || (memo[k] = find(raw)); };
  }

  function whoOf(b) { return (b.host ? [b.host] : []).concat(b.people); }
  function okBungs(P) { return P.bungs.filter(function (b) { return b.state === "ok"; }); }

  function build(o) {
    o = o || {};
    var G = typeof globalThis !== "undefined" ? globalThis : global;
    var NP = o.nickParts || (G.OpsAnalyzer && G.OpsAnalyzer.nickParts) || function (s) { return { nick: squash(s).split(" ")[0] || "" }; };
    var now = String(o.now || ""), today = now.slice(0, 10), T = dnum(today);
    var set = { firstMeetDays: 14, regularDays: 60 };
    Object.keys(o.settings || {}).forEach(function (k) { var v = Math.round(+o.settings[k]); if (v > 0 && k in set) set[k] = v; });
    var people = (o.people || []).filter(function (p) { return p && p.pid; });
    var alias = o.alias || {}, ign = o.ignore || {}, exc = o.exc || {};
    var who = resolver(people, alias, NP), byPid = Object.create(null);
    people.forEach(function (p) { byPid[p.pid] = p; });
    var P = { today: today, now: now, settings: set, bungs: [], stats: Object.create(null), checks: Object.create(null), names: [], byPid: byPid, raw: Object.create(null), who: who, nickParts: NP };
    var names = Object.create(null);
    var useName = function (raw, r, b, role) {
      var key = bare(raw), e = names[key] || (names[key] = { key: key, id: r.id, raw: squash(raw), k: r.k, ids: r.ids || [], suggest: r.suggest || [], host: 0, attend: 0, last: "", posts: [] });
      e[role] += 1;
      if (b.date && b.date >= e.last) { e.last = b.date; e.raw = squash(raw); }
      if (e.posts.indexOf(b.post) < 0) e.posts.push(b.post);
    };
    (o.posts || []).forEach(function (p) {
      if (!p || p.id == null) return;
      var m = p.meta || {}, list = (o.att && o.att[p.id]) || [];
      var date = DRE.test(String(m.date || "")) ? m.date : "", time = HM.test(m.time || "") ? m.time : "";
      var b = { post: p.id, date: date, time: time, end: HM.test(m.end || "") ? m.end : "", title: squash(p.title), place: squash(m.place), cap: +m.cap > 0 ? +m.cap : 0, pinned: !!p.pinned,
        hostRaw: squash(p.author), host: "", hostK: "none", people: [], guests: [], att: [], signed: list.length, state: "" };
      var h = b.hostRaw ? who(b.hostRaw) : { k: "none" }, seen = Object.create(null);
      b.hostK = h.k;
      if (h.id) { b.host = h.id; seen[h.id] = 1; if (!P.raw[h.id]) P.raw[h.id] = b.hostRaw; }
      list.forEach(function (a) {
        var nk = squash(a && a.nick), r = who(nk);
        b.att.push({ nick: nk, at: (a && a.at) || "", host: !!(a && a.host), id: r.id || "", k: r.k });
        if (!nk || r.k === "skip" || r.k === "none") return;
        if (bare(nk) === bare(b.hostRaw) || (r.id && r.id === b.host)) return;   // 글쓴이 본인의 참석
        if (r.k === "guest") { b.guests.push(nk); return; }
        if (seen[r.id]) return;
        seen[r.id] = 1; b.people.push(r.id);
        if (!P.raw[r.id]) P.raw[r.id] = nk;
      });
      b.state = !date ? "nodate" : ign[p.id] ? "ignored" : date + "T" + (time || "23:59") > now ? "upcoming" : b.people.length + b.guests.length ? "ok" : "empty";
      if (b.state !== "ignored" && b.state !== "nodate") {
        if (h.k === "unknown" || h.k === "amb") useName(b.hostRaw, h, b, "host");
        b.att.forEach(function (a) { if ((a.k === "unknown" || a.k === "amb") && bare(a.nick) !== bare(b.hostRaw)) useName(a.nick, who(a.nick), b, "attend"); });
      }
      P.bungs.push(b);
    });
    P.bungs.sort(function (x, y) { return (x.date || "9999").localeCompare(y.date || "9999") || x.time.localeCompare(y.time) || (x.post > y.post ? 1 : x.post < y.post ? -1 : 0); });
    P.names = Object.keys(names).map(function (k) { return names[k]; }).sort(function (a, b) { return (b.host + b.attend) - (a.host + a.attend) || b.last.localeCompare(a.last); });

    /* 사람마다 참석(센 모임만) */
    var ok = okBungs(P), C0 = ok.length ? dnum(ok[0].date) : T;
    P.cover = { from: ok.length ? ok[0].date : "", to: ok.length ? ok[ok.length - 1].date : "", days: ok.length ? T - C0 : 0, n: ok.length };
    var st = P.stats;
    var S = function (id) { return st[id] || (st[id] = { id: id, attend: [], total: 0, hosted: 0, d30: 0, prev30: 0, last: "", first: "", co: Object.create(null), wk: [0, 0, 0, 0, 0, 0, 0, 0] }); };
    ok.forEach(function (b) {
      var all = whoOf(b), age = T - dnum(b.date);
      all.forEach(function (id) {
        var s = S(id);
        s.attend.push({ date: b.date, time: b.time, post: b.post, title: b.title, host: id === b.host });
        s.total += 1;
        if (id === b.host) s.hosted += 1;
        if (age >= 0 && age < 30) s.d30 += 1; else if (age >= 30 && age < 60) s.prev30 += 1;
        var wi = 7 - Math.floor(age / 7); if (age >= 0 && wi >= 0 && wi < 8) s.wk[wi] += 1;
        all.forEach(function (x) { if (x !== id) s.co[x] = (s.co[x] || 0) + 1; });
      });
    });
    Object.keys(st).forEach(function (id) {
      var s = st[id], n = s.attend.length;
      s.first = n ? s.attend[0].date : ""; s.last = n ? s.attend[n - 1].date : "";
      s.co = Object.keys(s.co).map(function (x) { return { id: x, n: s.co[x] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    });

    /* 점검(방에 있는 사람): 첫 모임(닉네임에 입장일이 있거나 기록이 시작된 뒤 처음 들어온 사람), 정기 참여, 닉네임 입장일 */
    var R = set.regularDays, F = set.firstMeetDays;
    people.forEach(function (p) {
      if (!p.inRoom) return;
      var ck = P.checks[p.pid] = [];
      var ex = exc[p.pid];
      if (ex && DRE.test(ex) && ex >= today) { ck.push({ c: "exc", l: "info", t: "모임 점검에서 뺌", x: mdot(ex, today) + "까지", d: { until: ex } }); return; }
      var s = st[p.pid], att = s ? s.attend : [], pp = p.parts || {};
      var day = /^\d{4}$/.test(pp.day || "") ? pp.day : "";
      var J = p.joinedAt || (day ? dayDate(day, today) : "");
      var after = J ? att.filter(function (a) { return a.date >= J; }) : att;
      var firstTime = !p.joinedBeforeFile && !!p.joinedAt && !(p.re > 0) && (p.joins || 1) <= 1;
      var newbie = false;
      if (day && J) {
        if (after.length) ck.push({ c: "nalte", l: "watch", t: "모임에 왔는데 닉네임에 입장일", x: "첫 모임 " + mdot(after[0].date, today), d: { join: J, first: after[0].date } });
        else newbie = true;
      } else if (firstTime && J && ok.length && dnum(J) >= C0 && !after.length) newbie = true;
      if (newbie) {
        var since = Math.max(0, T - dnum(J));
        if (since > F) ck.push({ c: "first_late", l: "rule", t: "첫 모임 " + F + "일 넘김", x: "입장 " + mdot(J, today) + ", " + since + "일", d: { join: J, since: since } });
        else ck.push({ c: "first_wait", l: "info", t: "첫 모임 기다림", x: "입장 " + mdot(J, today) + ", " + (F - since) + "일 남음", d: { join: J, since: since, left: F - since } });
        return;
      }
      if (!ok.length) return;
      // 정기 참여: 마지막 모임에서 센다. 다시 들어왔으면 들어온 날부터(그 앞 모임은 세지 않음). 기록이 없으면 기록 첫날이나 들어온 날부터
      var last = after.length ? after[after.length - 1].date : "";
      if (last) {
        var gap = T - dnum(last);
        if (gap > R) ck.push({ c: "regular", l: "rule", t: R + "일 넘게 모임 없음", x: "마지막 " + mdot(last, today) + ", " + gap + "일", d: { last: last, gap: gap } });
        else if (gap > R - 15) ck.push({ c: "regular_soon", l: "watch", t: "곧 " + R + "일", x: "마지막 " + mdot(last, today) + ", " + gap + "일", d: { last: last, gap: gap } });
      } else {
        var from = Math.max(C0, J ? dnum(J) : C0), span = Math.max(0, T - from), fx = mdot(dateOf(from), today);
        var why = J && dnum(J) >= C0 ? "들어온 " + fx : "기록 " + fx;
        if (span > R) ck.push({ c: "regular", l: "rule", t: R + "일 넘게 모임 없음", x: why + "부터 없음", d: { from: dateOf(from), span: span } });
        else ck.push({ c: "no_record", l: span > R - 15 ? "watch" : "info", t: "모임 기록 없음", x: why + "부터 " + span + "일", d: { from: dateOf(from), span: span } });
      }
    });
    return P;
  }

  // 열쇠의 이름: 대화 기록의 사람은 지금 닉네임, 찾지 못한 이름은 적힌 그대로
  function label(P, id) { var p = P.byPid[id]; return p ? p.name : P.raw[id] || String(id).replace(/^n:/, ""); }
  // 성별과 출생연도: 대화 기록의 사람은 닉네임 칸, 찾지 못한 이름도 적힌 닉네임 칸으로
  function partsOf(P, id) { var p = P.byPid[id]; if (p) return p.parts || {}; return nickOf(P.nickParts, P.raw[id] || ""); }

  // 순위: by 는 "count"(모임 수) 또는 "days"(간 날 수). 같으면 다른 기준으로, 그것도 같으면 공동 순위
  function rank(P, o) {
    var st = Object.create(null);
    okBungs(P).forEach(function (b) {
      if (b.date < o.from || b.date > o.to) return;
      whoOf(b).forEach(function (id) {
        if (o.ids && !o.ids[id]) return;
        var s = st[id] || (st[id] = { id: id, count: 0, dayset: {}, hosted: 0, last: "" });
        s.count += 1; s.dayset[b.date] = 1; if (id === b.host) s.hosted += 1; if (b.date > s.last) s.last = b.date;
      });
    });
    var k1 = o.by === "days" ? "days" : "count", k2 = k1 === "days" ? "count" : "days";
    var list = Object.keys(st).map(function (id) { var s = st[id]; return { id: id, count: s.count, days: Object.keys(s.dayset).length, hosted: s.hosted, last: s.last }; });
    list.sort(function (a, b) { return b[k1] - a[k1] || b[k2] - a[k2] || label(P, a.id).localeCompare(label(P, b.id), "ko"); });
    list.forEach(function (x, i) { var p = list[i - 1]; x.rank = p && p[k1] === x[k1] && p[k2] === x[k2] ? p.rank : i + 1; });
    list.forEach(function (x) { x.tie = list.filter(function (y) { return y.rank === x.rank; }).length > 1; });
    return list;
  }

  /* 인사이트: 최근 30일(요일은 기록 전체). o.live: 지금 멤버 열쇠 { id: 1 }(대화 기록이 없으면 최근 90일에 온 사람), o.kindOf: 모임 종류 */
  function insights(P, o) {
    o = o || {};
    var today = P.today, T = dnum(today), B = okBungs(P), C0 = P.cover.from ? dnum(P.cover.from) : T;
    var live = o.live || {}, liveIds = Object.keys(live);
    var within = function (days, off) { return B.filter(function (b) { var n = dnum(b.date); return n > T - days - off && n <= T - off; }); };
    var heads = function (bs) { return bs.reduce(function (a, b) { return a + whoOf(b).length; }, 0); };
    var cnt = function (bs, onlyHost) { var c = Object.create(null); bs.forEach(function (b) { (onlyHost ? (b.host ? [b.host] : []) : whoOf(b)).forEach(function (id) { c[id] = (c[id] || 0) + 1; }); }); return c; };
    var cur = within(30, 0), prv = within(30, 30);
    var out = { today: today, cover: P.cover };
    var curDays = P.cover.from ? Math.max(1, Math.min(30, T - C0 + 1)) : 0;
    var prvDays = Math.max(0, Math.min(30, T - 30 - (C0 - 1)));
    out.win = { bungs: cur.length, heads: heads(cur), people: Object.keys(cnt(cur)).length, curDays: curDays, prevBungs: prv.length, prevHeads: heads(prv), prevDays: prvDays,
      hosts: Object.keys(cnt(cur, true)).length, avgSize: cur.length ? Math.round((heads(cur) / cur.length) * 10) / 10 : 0 };
    // 주별(최근 8주, 오늘까지 7일씩)
    out.weeks = [];
    for (var i = 7; i >= 0; i--) {
      var lo = T - 7 * (i + 1), hi = T - 7 * i;
      var bs = B.filter(function (b) { var n = dnum(b.date); return n > lo && n <= hi; });
      out.weeks.push({ from: dateOf(lo + 1), to: dateOf(hi), bungs: bs.length, heads: heads(bs), people: Object.keys(cnt(bs)).length, partial: lo + 1 < C0 });
    }
    // 요일(기록 전체): 그 요일이 기록 안에 몇 번 있었는지로 나눈 하루 평균
    var wd = [0, 0, 0, 0, 0, 0, 0], wdN = [0, 0, 0, 0, 0, 0, 0], wdH = [0, 0, 0, 0, 0, 0, 0];
    if (P.cover.from) for (var d = C0; d <= T; d++) wdN[(new Date(d * DAY).getUTCDay() + 6) % 7] += 1;
    B.forEach(function (b) { var k = (new Date(dnum(b.date) * DAY).getUTCDay() + 6) % 7; wd[k] += 1; wdH[k] += whoOf(b).length; });
    out.weekday = wd.map(function (n, k) { return { n: n, days: wdN[k], avg: wdN[k] ? Math.round((n / wdN[k]) * 10) / 10 : 0, heads: wdH[k] }; });
    // 참여 분포(지금 멤버, 최근 30일)와 쏠림
    var c30 = cnt(cur);
    out.tiers = [["0번", 0, 0], ["1~2번", 1, 2], ["3~5번", 3, 5], ["6~10번", 6, 10], ["11번 이상", 11, 9999]].map(function (t) { return { l: t[0], v: liveIds.filter(function (id) { var n = c30[id] || 0; return n >= t[1] && n <= t[2]; }).length }; });
    var memHeads = Object.keys(c30).map(function (id) { return c30[id]; }).sort(function (a, b) { return b - a; });
    out.conc = { total: memHeads.reduce(function (a, b) { return a + b; }, 0), people: memHeads.length, top10: memHeads.slice(0, 10).reduce(function (a, b) { return a + b; }, 0) };
    // 늘어난 멤버, 줄어든 멤버: 같은 길이의 두 기간(최근 L일과 그 앞 L일, L은 30일까지). 기록이 짧으면 L을 줄이고 14일 밑이면 견주지 않음
    var L = P.cover.from ? Math.min(30, Math.floor((T - C0 + 1) / 2)) : 0;
    out.chgDays = L;
    var cn = L >= 14 ? cnt(within(L, 0)) : {}, cp = L >= 14 ? cnt(within(L, L)) : {};
    var change = L < 14 ? [] : liveIds.map(function (id) { return { id: id, now: cn[id] || 0, before: cp[id] || 0 }; }).filter(function (x) { return x.now || x.before; });
    change.forEach(function (x) { x.d = x.now - x.before; });
    out.up = change.filter(function (x) { return x.d > 0; }).sort(function (a, b) { return b.d - a.d || b.now - a.now; }).slice(0, 6);
    out.down = change.filter(function (x) { return x.d < 0; }).sort(function (a, b) { return a.d - b.d || b.before - a.before; }).slice(0, 6);
    // 모임장(최근 30일)과 자주 오지만 모임장 기록이 없는 사람
    var h30 = cnt(cur, true);
    out.hosts = Object.keys(h30).map(function (id) { return { id: id, n: h30[id] }; }).sort(function (a, b) { return b.n - a.n || label(P, a.id).localeCompare(label(P, b.id), "ko"); });
    out.hostTop5 = out.hosts.slice(0, 5).reduce(function (a, x) { return a + x.n; }, 0);
    out.potential = liveIds.filter(function (id) { return (c30[id] || 0) >= 5 && !(P.stats[id] && P.stats[id].hosted); }).map(function (id) { return { id: id, n: c30[id] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    // 같이 다니는 둘(최근 30일, 지금 멤버): 함께 간 모임 수와, 둘 중 적게 간 사람 기준 비율
    var pc = Object.create(null);
    cur.forEach(function (b) { var w = whoOf(b).filter(function (id) { return live[id]; }).sort(); for (var x = 0; x < w.length; x++) for (var y = x + 1; y < w.length; y++) { var k = w[x] + "\u0000" + w[y]; pc[k] = (pc[k] || 0) + 1; } });
    out.pairs = Object.keys(pc).map(function (k) { var ab = k.split("\u0000"), mn = Math.min(c30[ab[0]] || 0, c30[ab[1]] || 0); return { a: ab[0], b: ab[1], n: pc[k], share: mn ? Math.round((pc[k] / mn) * 100) : 0 }; })
      .filter(function (x) { return x.n >= 3; }).sort(function (a, b) { return b.n - a.n || b.share - a.share; }).slice(0, 10);
    // 구성: 지금 멤버와 최근 30일 참석의 성별, 나이대(닉네임 칸)
    var bands = [["80년생 전", 1900, 1979], ["80~84년생", 1980, 1984], ["85~89년생", 1985, 1989], ["90~94년생", 1990, 1994], ["95~99년생", 1995, 1999], ["00년생 이후", 2000, 2099]];
    var bandOf = function (pp) { var y = pp.birthYear; for (var q = 0; q < bands.length; q++) if (y >= bands[q][1] && y <= bands[q][2]) return bands[q][0]; return ""; };
    var headBy = function (fn) { var r = {}; cur.forEach(function (b) { whoOf(b).forEach(function (id) { var k = fn(partsOf(P, id)); if (k) r[k] = (r[k] || 0) + 1; }); }); return r; };
    var sexH = headBy(function (pp) { return pp.sex; }), bandH = headBy(bandOf);
    var memBy = function (fn, v) { return liveIds.filter(function (id) { return fn(partsOf(P, id)) === v; }).length; };
    out.sex = { members: { 남: memBy(function (pp) { return pp.sex; }, "남"), 여: memBy(function (pp) { return pp.sex; }, "여") }, heads: { 남: sexH["남"] || 0, 여: sexH["여"] || 0 } };
    out.bands = bands.map(function (b) { return { l: b[0], members: memBy(bandOf, b[0]), heads: bandH[b[0]] || 0 }; });
    // 모임 크기(최근 30일, 게스트 포함)
    var sizes = cur.map(function (b) { return whoOf(b).length + b.guests.length; });
    out.sizes = [["2명 이하", 0, 2], ["3~4명", 3, 4], ["5~7명", 5, 7], ["8~11명", 8, 11], ["12명 이상", 12, 9999]].map(function (t) { return { l: t[0], v: sizes.filter(function (n) { return n >= t[1] && n <= t[2]; }).length }; });
    out.sizeMid = median(sizes);
    // 자주 간 곳(최근 30일)
    var pl = Object.create(null);
    cur.forEach(function (b) { var k = tight(b.place); if (!k) return; var e = pl[k] || (pl[k] = { n: 0, names: Object.create(null) }); e.n += 1; e.names[b.place] = (e.names[b.place] || 0) + 1; });
    out.places = Object.keys(pl).map(function (k) { var e = pl[k], nm = Object.keys(e.names).sort(function (a, b) { return e.names[b] - e.names[a]; })[0]; return { l: nm, n: e.n }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    out.placeN = Object.keys(pl).length;
    // 시작 시각, 참석 신청 시점(모임장이 적은 이름 빼고), 정원, 종류(최근 30일)
    var hb = [0, 0, 0, 0, 0, 0], lead = [0, 0, 0, 0, 0], kinds = Object.create(null);
    cur.forEach(function (b) {
      if (b.time) { var hh = +b.time.slice(0, 2); hb[hh >= 23 || hh < 6 ? 5 : hh < 11 ? 0 : hh < 14 ? 1 : hh < 17 ? 2 : hh < 20 ? 3 : 4] += 1; }
      var s0 = b.time ? Date.UTC(+b.date.slice(0, 4), +b.date.slice(5, 7) - 1, +b.date.slice(8, 10), +b.time.slice(0, 2) - 9, +b.time.slice(3, 5)) : null;
      b.att.forEach(function (a) {
        if (s0 == null || a.host || !a.at || bare(a.nick) === bare(b.hostRaw) || a.k === "skip") return;
        var t = Date.parse(a.at); if (isNaN(t)) return;
        var h = (s0 - t) / 3600000; lead[h >= 72 ? 0 : h >= 24 ? 1 : h >= 3 ? 2 : h >= 0 ? 3 : 4] += 1;
      });
      if (o.kindOf) { var k = o.kindOf(b) || "기타"; kinds[k] = (kinds[k] || 0) + 1; }
    });
    out.board = { n: cur.length,
      hours: ["6~11시", "11~14시", "14~17시", "17~20시", "20~23시", "23~6시"].map(function (l, q) { return { l: l, v: hb[q] }; }),
      lead: ["3일 넘게 전", "1~3일 전", "3~24시간 전", "3시간 안", "시작 뒤"].map(function (l, q) { return { l: l, v: lead[q] }; }),
      cap: cur.filter(function (b) { return b.cap; }).length, full: cur.filter(function (b) { return b.cap && b.signed >= b.cap; }).length,
      empty: P.bungs.filter(function (b) { var n = b.date ? dnum(b.date) : 0; return b.state === "empty" && n > T - 30 && n <= T; }).length,
      kinds: Object.keys(kinds).map(function (k) { return { l: k, n: kinds[k] }; }).sort(function (a, b) { return b.n - a.n || (a.l === "기타") - (b.l === "기타") || a.l.localeCompare(b.l, "ko"); }).slice(0, 8) };
    // 신입 첫 모임과 흐름: 기록이 시작된 뒤 처음 들어온 사람(대화 기록의 입장일)
    var nb = [];
    Object.keys(P.byPid).forEach(function (pid) {
      var p = P.byPid[pid];
      if (p.joinedBeforeFile || !p.joinedAt || p.re > 0 || (p.joins || 1) > 1 || !P.cover.from || p.joinedAt < P.cover.from || p.joinedAt > today) return;
      var att = (P.stats[pid] ? P.stats[pid].attend : []).filter(function (a) { return a.date >= p.joinedAt; });
      var J = dnum(p.joinedAt), f = att[0], g = f ? dnum(f.date) - J : null;
      nb.push({ id: pid, join: p.joinedAt, first: f ? f.date : "", gap: g, second: att[1] ? dnum(att[1].date) - J : null, gone: !p.inRoom, spoke: p.first && p.first >= p.joinedAt ? dnum(p.first) - J : null, age: T - J });
    });
    out.newbies = nb.sort(function (a, b) { return b.join.localeCompare(a.join); });
    out.newMid = median(nb.filter(function (x) { return x.gap != null; }).map(function (x) { return x.gap; }));
    var fBase = function (days) { return nb.filter(function (x) { return x.age >= days; }); };
    var chatTo = o.chatTo || today, chatT = dnum(chatTo);
    var b7 = nb.filter(function (x) { return dnum(x.join) + 7 <= chatT; }), b14 = fBase(14), b60 = fBase(60);
    out.funnel = { joined: nb.length,
      spoke7: { n: b7.filter(function (x) { return x.spoke != null && x.spoke <= 7; }).length, base: b7.length },
      met14: { n: b14.filter(function (x) { return x.gap != null && x.gap <= 14; }).length, base: b14.length },
      met30: { n: fBase(30).filter(function (x) { return x.gap != null && x.gap <= 30; }).length, base: fBase(30).length },
      twice60: { n: b60.filter(function (x) { return x.second != null && x.second <= 60; }).length, base: b60.length } };
    // 대화와 모임(지금 멤버, 최근 30일): 둘 다, 대화만, 모임만, 둘 다 없음
    var chat30 = o.chat30 || function () { return 0; }, q4 = { both: [], chat: [], meet: [], none: [] };
    liveIds.forEach(function (id) { var c = chat30(id) > 0, m = (c30[id] || 0) > 0; q4[c && m ? "both" : c ? "chat" : m ? "meet" : "none"].push(id); });
    out.quad = q4;
    return out;
  }

  var OpsPart = { build: build, rank: rank, insights: insights, label: label, partsOf: partsOf, whoOf: whoOf, key: bare, tight: tight, squash: squash, dnum: dnum, dateOf: dateOf, mdot: mdot, dayDate: dayDate, jamo: jamo };
  if (typeof module !== "undefined" && module.exports) module.exports = OpsPart;
  else global.OpsPart = OpsPart;
})(typeof self !== "undefined" ? self : this);
