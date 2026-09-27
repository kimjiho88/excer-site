/* ============================================================
   ops-sheet.js : 운영 대시보드의 구글 시트 해석 (ops.html 에서만 읽는다)
   ------------------------------------------------------------
   입력: 시트 판 하나(탭마다 보이는 값의 2차원 배열)와 교정 규칙.
   출력: 멤버, 벙, 이슈, 사람별 참석 집계, 관리 점검, 입력 확인 목록. 그리고 두 판의 차이와 반영 보류 판정.

   손으로 적는 시트라서 생기는 일을 전제로 한다
   - 머리 줄이 위에 있지 않을 수 있다(멤버 탭은 중간에 있다). 머리 줄은 글자로 찾고, 칸도 머리 글자로 찾는다.
   - 적다가 멈춘 줄: 날짜만 있거나 사람만 있는 줄은 세지 않고 '작성 중'으로 둔다. 시트가 한동안 그대로면
     '적다가 멈춘 줄'로 올린다.
   - 오타, 게스트 표기, 참여자 칸의 메모, 같은 이름 두 사람, 같은 벙 두 줄, 날짜 오타를 가려 낸다.
   - 멤버 탭의 벙참 횟수(시트 수식 값)는 믿지 않고 벙 탭에서 다시 센다. 다르면 알려 준다.
   - 교정 규칙(이름 바꿔 읽기, 줄 빼기)은 줄 번호가 아니라 내용에 붙인다. 줄을 끼워 넣거나 정렬해도 따라간다.
   ============================================================ */
(function (global) {
  "use strict";
  var DAY = 86400000;
  function clean(s) { return String(s == null ? "" : s).replace(/[​-‍﻿]/g, "").replace(/ /g, " ").trim(); }
  function squash(s) { return clean(s).replace(/\s+/g, " "); }
  function tight(s) { return clean(s).replace(/\s+/g, "").toLowerCase(); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function colName(i) { var s = ""; i += 1; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function iso(y, m, d) {
    if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    var t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCMonth() === m - 1 ? y + "-" + pad2(m) + "-" + pad2(d) : null;
  }
  function dnum(d) { return Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / DAY); }
  function dateOf(n) { var t = new Date(n * DAY); return t.getUTCFullYear() + "-" + pad2(t.getUTCMonth() + 1) + "-" + pad2(t.getUTCDate()); }
  // 한 달 전 같은 날(시트의 EDATE 와 같게 달 끝은 맞춘다)
  function edate(d, k) {
    var y = +d.slice(0, 4), m = +d.slice(5, 7) - 1 + k, day = +d.slice(8, 10);
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return y + "-" + pad2(m + 1) + "-" + pad2(Math.min(day, last));
  }
  // 날짜 읽기: 2026. 8. 3 / 2026-08-03 / 2026/8/3 / 2026년 8월 3일 / 2026. 8. 3 (월) / 20260803 / 260803 / 26.8.3
  function parseDate(s) {
    var t = clean(s); if (!t) return null;
    var m = t.match(/^(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})\s*[.일]?\s*(?:[(（][^)）]*[)）])?$/);
    if (m) return iso(+m[1], +m[2], +m[3]);
    m = t.match(/^(\d{4})(\d{2})(\d{2})$/); if (m) return iso(+m[1], +m[2], +m[3]);
    m = t.match(/^(\d{2})(\d{2})(\d{2})$/); if (m) return iso(2000 + +m[1], +m[2], +m[3]);
    m = t.match(/^(\d{2})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})\.?$/); if (m) return iso(2000 + +m[1], +m[2], +m[3]);
    return null;
  }
  function toInt(s) { var t = clean(s); if (!t) return null; var m = t.match(/^-?\d+/); return m ? +m[0] : NaN; }
  function splitList(s) { return clean(s).split(/\s*[,，、\/]\s*|\n+/).map(squash).filter(Boolean); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  /* ── 한글 자모로 가까운 이름 찾기(한 글자 오타) ── */
  var CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ", JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ", JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";
  function jamo(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i) - 0xAC00;
      if (c >= 0 && c < 11172) { out += CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + (c % 28 ? JONG[c % 28] : ""); }
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

  /* ── 탭과 머리 줄 찾기 ── */
  var SPEC = {
    member: { tab: /멤버|회원|명단/, need: ["name", "birth", "sex"], cols: {
      name: ["이름", "닉네임", "닉"], birth: ["나이", "출생", "출생연도", "년생", "생년"], sex: ["성별"], region: ["거주지", "지역", "동네", "사는곳"],
      dislike: ["싫어하는사람", "불편한사람", "싫어하는멤버"], note: ["비고", "메모", "특이사항"], nalte: ["날떼여부", "날떼", "날짜떼기"],
      status: ["활동중여부", "활동여부", "상태", "활동상태"], lastBung: ["마지막벙참날짜", "마지막벙참", "최근벙참"], total: ["총벙참회수", "총벙참횟수", "총벙참"],
      month: ["근한달간벙참횟수", "한달간벙참횟수", "최근한달벙참"], hosted: ["벙주횟수", "벙주회수"], couple: ["커플여부", "커플"],
      warn: ["경고여부", "경고횟수", "경고회수", "경고수", "경고"], warnWhy: ["경고사유"], warnAt: ["경고일", "경고날짜", "경고일자"], outs: ["나간횟수", "나간회수", "퇴장횟수"] } },
    bung: { tab: /벙|모임|참석/, need: ["date", "host"], cols: {
      date: ["날짜", "일자", "벙날짜"], title: ["벙제", "벙제목", "제목", "벙이름"], place: ["장소", "가게"], host: ["벙주", "주최"], people: ["참여자", "참석자", "참가자"] } },
    issue: { tab: /이슈|사건/, need: ["action"], cols: { date: ["날짜", "일자"], text: ["내용", "이슈", "사건"], action: ["조치"], notice: ["공지", "공지문"] } }
  };
  var LABEL = { name: "이름", birth: "나이", sex: "성별", region: "거주지", dislike: "싫어하는 사람", note: "비고", nalte: "날떼여부", status: "활동중 여부", lastBung: "마지막 벙참 날짜", total: "총 벙참회수", month: "근 한달간 벙참 횟수", hosted: "벙주횟수", couple: "커플여부", warn: "경고여부", warnWhy: "경고사유", warnAt: "경고일", outs: "나간횟수", date: "날짜", title: "벙제", place: "장소", host: "벙주", people: "참여자", action: "조치", text: "내용", notice: "공지" };
  function findHeader(values, spec) {
    var best = null;
    var lim = Math.min(values.length, 500);
    for (var r = 0; r < lim; r++) {
      var row = values[r] || [], map = {}, hits = 0;
      for (var c = 0; c < row.length; c++) {
        var t = tight(row[c]); if (!t || t.length > 20) continue;
        for (var k in spec.cols) if (map[k] == null && spec.cols[k].indexOf(t) >= 0) { map[k] = c; hits += 1; break; }
      }
      if (!spec.need.every(function (k) { return map[k] != null; })) continue;
      if (!best || hits > best.hits) best = { row: r, map: map, hits: hits };
    }
    return best;
  }
  function locate(tabs) {
    var found = {}, used = {};
    ["member", "bung", "issue"].forEach(function (kind) {
      var spec = SPEC[kind], cands = [];
      tabs.forEach(function (t, i) {
        if (used[i] || !t || !Array.isArray(t.values)) return;
        var h = findHeader(t.values, spec);
        if (h) cands.push({ i: i, h: h, named: spec.tab.test(String(t.name || "")) });
      });
      cands.sort(function (a, b) { return (b.named - a.named) || (b.h.hits - a.h.hits); });
      if (cands.length) { found[kind] = { tab: tabs[cands[0].i], idx: cands[0].i, h: cands[0].h }; used[cands[0].i] = true; }
    });
    return found;
  }

  /* ── 시트 판 하나 읽기 ── */
  function parse(tabs, opts) {
    opts = opts || {};
    var fixes = opts.fixes || {}, alias = fixes.alias || {}, ignore = fixes.ignore || {};
    var snapDate = opts.snapDate || opts.today || dateOf(Math.floor(Date.now() / DAY));
    var today = opts.today || snapDate;
    var set = Object.assign({ firstMeetDays: 14, regularDays: 60, idleMin: 30 }, opts.settings || {});
    var probs = [];
    var P = function (o) { o.id = [o.tab, o.row, o.col, o.code, o.value || ""].join("|"); probs.push(o); return o; };
    var loc = locate(Array.isArray(tabs) ? tabs : []);
    var structure = { ok: true, missing: [], tabs: {} };
    ["member", "bung", "issue"].forEach(function (k) {
      if (loc[k]) structure.tabs[k] = { name: loc[k].tab.name, headerRow: loc[k].h.row + 1, cols: Object.keys(loc[k].h.map).reduce(function (o, c) { o[c] = colName(loc[k].h.map[c]); return o; }, {}) };
    });
    if (!loc.member) { structure.ok = false; structure.missing.push("멤버 탭(이름, 나이, 성별 머리)"); }
    if (!loc.bung) { structure.ok = false; structure.missing.push("벙 탭(날짜, 벙주 머리)"); }
    var out = { structure: structure, members: [], bungs: [], issues: [], problems: probs, snapDate: snapDate, today: today, settings: set, ignored: [] };
    if (!structure.ok) return out;

    /* 멤버 */
    var mt = loc.member, mh = mt.h, mv = mt.tab.values, TN = mt.tab.name;
    var computed = {}; ["lastBung", "total", "month", "hosted"].forEach(function (k) { if (mh.map[k] != null) computed[mh.map[k]] = true; });
    var mapped = {}; Object.keys(mh.map).forEach(function (k) { mapped[mh.map[k]] = k; });
    var hdrRow = mv[mh.row] || [];
    var byId = {}, members = [];
    for (var r = 0; r < mv.length; r++) {
      if (r === mh.row) continue;
      var row = mv[r] || [];
      var g = function (k) { var i = mh.map[k]; return i == null ? "" : clean(row[i]); };
      var name = squash(g("name"));
      var content = row.some(function (v, i) { var t = clean(v); return t && !(computed[i] && /^0?$/.test(t)); });
      if (!content) continue;
      if (!name) {
        var only = row.map(clean).filter(Boolean);
        if (only.length === 1 && /\d+\s*명\s*\(/.test(only[0])) continue;   // 성별 요약 같은 줄
        if (row.every(function (v, i) { return !clean(v) || computed[i]; })) continue;
        P({ tab: TN, row: r + 1, col: colName(mh.map.name), level: "watch", code: "m_noname", msg: "이름이 빈 줄", value: only.slice(0, 3).join(", "), draft: true });
        continue;
      }
      if (SPEC.member.cols.name.indexOf(tight(name)) >= 0) continue;   // 머리 줄을 한 번 더 둔 경우
      var m = { row: r + 1, name: name, rows: [r + 1] };
      var b2 = tight(g("birth"));
      if (/^\d{2}$/.test(b2)) { m.birth = b2; m.birthYear = +b2 >= 30 ? 1900 + +b2 : 2000 + +b2; }
      else if (/^(19|20)\d{2}$/.test(b2)) { m.birth = b2.slice(2); m.birthYear = +b2; }
      else if (b2) P({ tab: TN, row: r + 1, col: colName(mh.map.birth), level: "watch", code: "m_birth", msg: "나이 칸이 두 자리 출생연도가 아님", value: g("birth"), who: name });
      else P({ tab: TN, row: r + 1, col: colName(mh.map.birth), level: "info", code: "m_birth_empty", msg: "나이 칸이 빔", who: name });
      if (m.birthYear && (m.birthYear < 1960 || m.birthYear > +snapDate.slice(0, 4) - 18)) P({ tab: TN, row: r + 1, col: colName(mh.map.birth), level: "watch", code: "m_birth_odd", msg: "출생연도로 보기 어려움", value: g("birth"), who: name });
      var sx = tight(g("sex"));
      m.sex = /^(남|남자|m|male)$/.test(sx) ? "남" : /^(여|여자|f|female)$/.test(sx) ? "여" : "";
      if (!m.sex) P({ tab: TN, row: r + 1, col: colName(mh.map.sex), level: sx ? "watch" : "info", code: "m_sex", msg: sx ? "성별 칸을 읽지 못함" : "성별 칸이 빔", value: g("sex"), who: name });
      m.region = squash(g("region"));
      m.dislike = splitList(g("dislike"));
      m.note = g("note");
      var nal = tight(g("nalte"));
      if (/^\d{3,4}$/.test(nal)) {
        var md4 = nal.length === 3 ? "0" + nal : nal, mm = +md4.slice(0, 2), dd = +md4.slice(2);
        if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
          m.newbie = true; m.joinMD = md4;
          var y = +today.slice(0, 4), j = iso(y, mm, dd) || iso(y, mm, 28);
          if (j > today) j = iso(y - 1, mm, dd) || iso(y - 1, mm, 28);
          m.joinDate = j;
        } else P({ tab: TN, row: r + 1, col: colName(mh.map.nalte), level: "watch", code: "m_nalte", msg: "날떼여부의 입장일이 날짜가 아님", value: g("nalte"), who: name });
      } else if (nal) P({ tab: TN, row: r + 1, col: colName(mh.map.nalte), level: "info", code: "m_nalte_odd", msg: "날떼여부 값을 모름", value: g("nalte"), who: name });
      var st = tight(g("status")), stRaw = squash(g("status"));
      var aw = st.match(/^외출(\d*)/);
      m.statusRaw = stRaw;
      m.status = !st ? "active" : /^(나감|퇴장|탈퇴)$/.test(st) ? "left" : /^(강퇴|내보냄|추방)$/.test(st) ? "kicked" : /^비활성/.test(st) ? "inactive" : aw ? "away" : "other";
      if (aw) m.awayN = aw[1] ? +aw[1] : 1;
      if (m.status === "other") P({ tab: TN, row: r + 1, col: colName(mh.map.status), level: "watch", code: "m_status", msg: "활동중 여부 값을 모름", value: stRaw, who: name });
      m.sheet = { lastBung: parseDate(g("lastBung")), total: toInt(g("total")), month: toInt(g("month")), hosted: toInt(g("hosted")) };
      m.couple = !!g("couple") && !/^(x|n|no|아니오|아님|0)$/i.test(g("couple"));
      var wn = toInt(g("warn"));
      if (wn !== null && isNaN(wn)) { P({ tab: TN, row: r + 1, col: colName(mh.map.warn), level: "watch", code: "m_warn", msg: "경고여부가 숫자가 아님", value: g("warn"), who: name }); wn = null; }
      var why = splitList(g("warnWhy"));
      var atRaw = clean(g("warnAt")).split(/[,，\s]+/).filter(Boolean), at = [];
      atRaw.forEach(function (x) { var d = parseDate(x); if (d) at.push(d); else P({ tab: TN, row: r + 1, col: colName(mh.map.warnAt), level: "watch", code: "m_warnat", msg: "경고일을 날짜로 읽지 못함", value: x, who: name }); });
      var wN = Math.max(wn || 0, why.length, at.length);
      m.warnN = wn || 0;
      m.warnings = [];
      for (var w = 0; w < wN; w++) m.warnings.push({ n: w + 1, reason: why[w] || "", date: at[w] || "" });
      if ((wn || 0) && why.length && why.length !== wn) P({ tab: TN, row: r + 1, col: colName(mh.map.warnWhy), level: "info", code: "m_warn_n", msg: "경고 " + wn + "회인데 사유 " + why.length + "개", who: name });
      if ((wn || 0) && at.length < wn) P({ tab: TN, row: r + 1, col: colName(mh.map.warnAt), level: "info", code: "m_warn_at", msg: "경고일이 " + (wn - at.length) + "개 비어 있음", who: name });
      if (!wn && (why.length || at.length)) P({ tab: TN, row: r + 1, col: colName(mh.map.warn), level: "watch", code: "m_warn_0", msg: "경고사유나 경고일은 있는데 경고여부가 비었음", who: name });
      var o = toInt(g("outs")); m.outs = o === null || isNaN(o) ? 0 : o;
      if (o !== null && isNaN(o)) P({ tab: TN, row: r + 1, col: colName(mh.map.outs), level: "watch", code: "m_outs", msg: "나간횟수가 숫자가 아님", value: g("outs"), who: name });
      if (m.birthYear) m.outLimit = m.birthYear <= 1981 ? 1 : 3;
      m.extra = {};
      row.forEach(function (v, i) { var t = clean(v); if (t && mapped[i] == null && !clean(hdrRow[i])) m.extra[colName(i)] = t; });
      m.id = "m:" + name + "|" + (m.birth || "?") + "|" + (m.sex || "?");
      if (byId[m.id]) {
        // 같은 사람(이름, 나이, 성별이 같음)이 두 줄: 활동 중인 줄을 앞세운다(재입장으로 보임)
        var a = byId[m.id], keepNew = a.status !== "active" && a.status !== "away" && (m.status === "active" || m.status === "away");
        var prim = keepNew ? m : a, sec = keepNew ? a : m;
        prim.rows = a.rows.concat(m.rows).sort(function (x, y) { return x - y; });
        prim.older = (prim.older || []).concat([{ row: sec.row, statusRaw: sec.statusRaw, note: sec.note, joinMD: sec.joinMD }]);
        if (!prim.note && sec.note) prim.note = sec.note;
        P({ tab: TN, row: m.row, col: colName(mh.map.name), level: "info", code: "m_dup", msg: "같은 사람이 두 줄(" + prim.rows.join(", ") + "행)", who: name });
        if (keepNew) { members[members.indexOf(a)] = m; byId[m.id] = m; }
        continue;
      }
      byId[m.id] = m; members.push(m);
    }
    out.members = members;

    /* 이름 찾기: 같은 이름이 여럿이면 나가지 않은 사람, 그래도 여럿이면 정하지 않는다 */
    var byName = {};
    members.forEach(function (m) { var k = tight(m.name); (byName[k] = byName[k] || []).push(m); });
    function lookup(t) {
      var c = byName[tight(t)] || [];
      if (c.length <= 1) return c.length ? { id: c[0].id } : null;
      var live = c.filter(function (m) { return m.status !== "left" && m.status !== "kicked"; });
      return live.length === 1 ? { id: live[0].id } : { amb: (live.length ? live : c).map(function (m) { return m.id; }) };
    }
    var names = Object.keys(byName);
    function suggest(t) {
      var k = tight(t), jk = jamo(k), res = [];
      // 이름 뒤에 '이'를 붙여 적은 경우를 먼저
      if (k.length >= 2 && k.slice(-1) === "이" && byName[k.slice(0, -1)]) res.push({ n: byName[k.slice(0, -1)][0].name, jd: -1 });
      names.forEach(function (n) {
        if (res.length && res[0].n === (byName[n] || [])[0].name) return;
        if (Math.abs(n.length - k.length) > 1) return;
        var sd = lev(k, n); if (sd > 1) return;
        var jd = lev(jk, jamo(n));
        if (jd <= (k.length <= 1 ? 1 : 2)) res.push({ n: byName[n][0].name, jd: jd });
      });
      return res.sort(function (a, b) { return a.jd - b.jd; }).slice(0, 3).map(function (x) { return x.n; });
    }
    var memberIds = {}; members.forEach(function (m) { memberIds[m.id] = m; });
    function classify(text) {
      var t = squash(text); if (!t) return null;
      var raw = t, al = alias[tight(t)];
      if (al) { if (memberIds[al]) return { k: "member", id: al, raw: raw, via: "alias" }; t = squash(al); }
      var gm = t.match(/^(게스트|게)\s*(\d*)\s*(?:[(（]\s*(.*?)\s*[)）])?$/);
      if (gm) return { k: "guest", raw: raw, who: gm[3] || "" };
      var lk = lookup(t);
      if (lk && lk.id) return { k: "member", id: lk.id, raw: raw, via: al ? "alias" : "" };
      if (lk && lk.amb) return { k: "amb", ids: lk.amb, raw: raw };
      var ns = t.match(/^(.+?)\s*(노쇼|불참|펑크|안\s*옴|안\s*왔음|빠짐)$/);
      if (ns) { var n1 = lookup(ns[1]); if (n1 && n1.id) return { k: "noshow", id: n1.id, raw: raw }; }
      var pm = t.match(/^([^\s()（）]+)\s*[(（]\s*(.+?)\s*[)）]$/);
      if (pm) { var n2 = lookup(pm[1]); if (n2 && n2.id) return { k: "member", id: n2.id, raw: raw, memo: pm[2] }; }
      if (t.length > 12 || t.split(/\s+/).length >= 3) return { k: "note", raw: raw };
      return { k: "unknown", raw: raw, suggest: suggest(t) };
    }

    /* 벙 */
    var bt = loc.bung, bh = bt.h, bv = bt.tab.values, BN = bt.tab.name;
    var pStart = bh.map.people != null ? bh.map.people : bh.map.host + 1;
    var bungs = [], seenKey = {};
    for (var r2 = bh.row + 1; r2 < bv.length; r2++) {
      var row2 = bv[r2] || [];
      var g2 = function (k) { var i = bh.map[k]; return i == null ? "" : clean(row2[i]); };
      var dateRaw = g2("date"), title = squash(g2("title")), place = squash(g2("place")), hostRaw = squash(g2("host"));
      var cells = []; for (var c2 = pStart; c2 < row2.length; c2++) cells.push({ c: c2, t: squash(row2[c2]) });
      var filled = cells.filter(function (x) { return x.t; });
      if (!dateRaw && !title && !place && !hostRaw && !filled.length) continue;
      var sig = "b|" + tight(dateRaw) + "|" + tight(title) + "|" + tight(hostRaw);
      var bg = { row: r2 + 1, sig: sig, dateRaw: dateRaw, date: parseDate(dateRaw), title: title, place: place, hostRaw: hostRaw, host: "", people: [], guests: [], noshows: [], notes: [], unknown: [], amb: [], flags: [] };
      if (ignore[sig]) { bg.state = "ignored"; out.ignored.push(bg); bungs.push(bg); continue; }
      var R = r2 + 1, seen = {};
      var add = function (tok, colI, isHost) {
        if (!tok) return;
        if (tok.k === "member") {
          if (isHost) { bg.host = tok.id; seen[tok.id] = "host"; return; }
          if (seen[tok.id]) { P({ tab: BN, row: R, col: colName(colI), level: "info", code: seen[tok.id] === "host" ? "b_hostdup" : "b_dup", msg: seen[tok.id] === "host" ? "벙주를 참여자 칸에 또 적음" : "같은 사람을 두 번 적음", value: tok.raw }); return; }
          seen[tok.id] = "p"; bg.people.push(tok.id);
          if (tok.via === "alias") bg.flags.push("alias");
          if (tok.memo) bg.notes.push(tok.raw);
        } else if (tok.k === "guest") bg.guests.push(tok.raw);
        else if (tok.k === "noshow") { bg.noshows.push(tok.id); }
        else if (tok.k === "note") { bg.notes.push(tok.raw); P({ tab: BN, row: R, col: colName(colI), level: "info", code: "b_note", msg: "참여자 칸의 메모(세지 않음)", value: tok.raw }); }
        else if (tok.k === "amb") { bg.amb.push(tok.raw); P({ tab: BN, row: R, col: colName(colI), level: "watch", code: "b_amb", msg: "같은 이름이 둘이라 누구인지 모름", value: tok.raw, ids: tok.ids, fix: "alias" }); }
        else { bg.unknown.push(tok.raw); P({ tab: BN, row: R, col: colName(colI), level: "watch", code: "b_unknown", msg: "멤버 탭에 없는 이름", value: tok.raw, suggest: tok.suggest, fix: "alias" }); }
      };
      add(classify(hostRaw), bh.map.host, true);
      filled.forEach(function (x) { add(classify(x.t), x.c, false); });
      var anyone = bg.host || bg.people.length || bg.guests.length;
      if (!dateRaw || !anyone) {
        bg.state = "draft";
        P({ tab: BN, row: R, col: colName(!dateRaw ? bh.map.date : pStart), level: "info", code: "b_draft", msg: !dateRaw ? "날짜가 빈 줄" : "사람이 빈 줄", value: [dateRaw, title].filter(Boolean).join(" "), draft: true, sig: sig, fix: "ignore" });
      } else if (!bg.date) {
        bg.state = "bad";
        P({ tab: BN, row: R, col: colName(bh.map.date), level: "watch", code: "b_date", msg: "날짜를 읽지 못함", value: dateRaw, sig: sig, fix: "ignore" });
      } else if (bg.date > today) {
        bg.state = "bad";
        P({ tab: BN, row: R, col: colName(bh.map.date), level: "watch", code: "b_future", msg: "오늘보다 뒤 날짜", value: dateRaw, sig: sig, fix: "ignore" });
      } else if (bg.date < "2024-01-01") {
        bg.state = "bad";
        P({ tab: BN, row: R, col: colName(bh.map.date), level: "watch", code: "b_old", msg: "너무 이른 날짜", value: dateRaw, sig: sig, fix: "ignore" });
      } else {
        bg.state = "ok";
        if (!hostRaw) P({ tab: BN, row: R, col: colName(bh.map.host), level: "watch", code: "b_nohost", msg: "벙주가 빔", value: title });
        var key = bg.date + "|" + tight(title) + "|" + (bg.host || tight(hostRaw));
        if (seenKey[key]) { bg.state = "dup"; P({ tab: BN, row: R, col: colName(bh.map.title), level: "watch", code: "b_twice", msg: "같은 벙이 두 줄(" + seenKey[key] + "행과 같음, 한 번만 셈)", value: title, sig: sig, fix: "ignore" }); }
        else seenKey[key] = R;
      }
      bungs.push(bg);
    }
    // 앞뒤 줄보다 크게 이른 날짜(월을 잘못 친 경우)
    var okRows = bungs.filter(function (b) { return b.state === "ok"; });
    okRows.forEach(function (b, i) {
      var p = okRows[i - 1], n = okRows[i + 1];
      if (p && n && dnum(b.date) < dnum(p.date) - 7 && dnum(b.date) < dnum(n.date) - 7) P({ tab: BN, row: b.row, col: colName(bh.map.date), level: "info", code: "b_order", msg: "앞뒤 줄보다 크게 이른 날짜", value: b.dateRaw });
    });
    out.bungs = bungs;
    var drafts = bungs.filter(function (b) { return b.state === "draft"; });

    /* 이슈 */
    if (loc.issue) {
      var it = loc.issue, ih = it.h, iv = it.tab.values, IN = it.tab.name, map = Object.assign({}, ih.map);
      var dataRows = []; for (var r3 = ih.row + 1; r3 < iv.length; r3++) if ((iv[r3] || []).some(function (v) { return clean(v); })) dataRows.push(r3);
      var width = Math.max.apply(null, [0].concat(iv.map(function (x) { return (x || []).length; })));
      if (map.date == null) { var bestC = -1, bestN = 0; for (var c3 = 0; c3 < width; c3++) { if (c3 === map.action) continue; var n3 = dataRows.filter(function (rr) { return parseDate(iv[rr][c3]); }).length; if (n3 > bestN) { bestN = n3; bestC = c3; } } if (bestC >= 0) map.date = bestC; }
      if (map.text == null) { var bt3 = -1, bl = 0; for (var c4 = 0; c4 < map.action; c4++) { if (c4 === map.date) continue; var l4 = dataRows.reduce(function (a, rr) { return a + clean(iv[rr][c4]).length; }, 0); if (l4 > bl) { bl = l4; bt3 = c4; } } if (bt3 >= 0) map.text = bt3; }
      if (map.notice == null && map.action + 1 < width) map.notice = map.action + 1;
      dataRows.forEach(function (rr) {
        var row3 = iv[rr];
        var gi = function (k) { return map[k] == null ? "" : clean(row3[map[k]]); };
        var e = { row: rr + 1, dateRaw: gi("date"), date: parseDate(gi("date")), text: gi("text"), action: squash(gi("action")), notice: gi("notice"), persons: [] };
        if (!e.text && !e.action && !e.notice) return;
        if (!e.date) P({ tab: IN, row: rr + 1, col: colName(map.date == null ? 1 : map.date), level: "info", code: "i_date", msg: e.dateRaw ? "날짜를 읽지 못함" : "날짜가 빔", value: e.dateRaw || e.text.slice(0, 20) });
        out.issues.push(e);
      });
      // 이슈 글에 나오는 멤버. 한 글자 이름은 뒤에 이가, 형, 누나 같은 말이 붙을 때만
      var nameList = members.map(function (m) { return m.name; }).filter(function (n, i, a) { return a.indexOf(n) === i; }).sort(function (a, b) { return b.length - a.length; });
      out.issues.forEach(function (e) {
        var hay = e.text, hit = {};
        nameList.forEach(function (n) {
          var re = n.length >= 2 ? new RegExp("(^|[^가-힣])" + reEsc(n)) : new RegExp("(^|[^가-힣])" + reEsc(n) + "(이가|이는|이랑|이를|이한테|이도|이에게|이네|이랑|형|누나|언니|오빠|님|씨|쌤)");
          if (re.test(hay)) { var lk = lookup(n); if (lk && lk.id && !hit[lk.id]) { hit[lk.id] = 1; e.persons.push(lk.id); } }
        });
        e.warn = /경고/.test(e.action);
      });
    }

    /* 사람마다 참석 집계(세는 줄: 날짜가 맞고, 두 번째 줄이 아니고, 빼지 않은 줄) */
    var monthFrom = edate(snapDate, -1), d30 = dateOf(dnum(today) - 30);
    var S = {}; members.forEach(function (m) { S[m.id] = { attend: [], hosted: 0, noshows: [], co: {} }; });
    var counted = bungs.filter(function (b) { return b.state === "ok"; });
    counted.forEach(function (b, bi) {
      var all = (b.host ? [b.host] : []).concat(b.people);
      all.forEach(function (id) {
        var s = S[id]; if (!s) return;
        s.attend.push({ date: b.date, row: b.row, title: b.title, host: id === b.host });
        if (id === b.host) s.hosted += 1;
        all.forEach(function (o) { if (o !== id) s.co[o] = (s.co[o] || 0) + 1; });
      });
      b.noshows.forEach(function (id) { if (S[id]) S[id].noshows.push({ date: b.date, row: b.row, title: b.title }); });
    });
    var coverFrom = counted.length ? counted.reduce(function (a, b) { return b.date < a ? b.date : a; }, counted[0].date) : "";
    var coverTo = counted.length ? counted.reduce(function (a, b) { return b.date > a ? b.date : a; }, counted[0].date) : "";
    out.cover = { from: coverFrom, to: coverTo, days: coverFrom ? dnum(today) - dnum(coverFrom) : 0, rows: counted.length };
    members.forEach(function (m) {
      var s = S[m.id];
      s.attend.sort(function (a, b) { return a.date.localeCompare(b.date) || a.row - b.row; });
      m.attend = s.attend;
      m.total = s.attend.length;
      m.month = s.attend.filter(function (a) { return a.date >= monthFrom && a.date <= snapDate; }).length;
      m.d30 = s.attend.filter(function (a) { return a.date > d30 && a.date <= today; }).length;
      m.hosted = s.hosted;
      m.last = s.attend.length ? s.attend[s.attend.length - 1].date : "";
      m.first = s.attend.length ? s.attend[0].date : "";
      m.noshows = s.noshows;
      m.co = Object.keys(s.co).map(function (id) { return { id: id, n: s.co[id] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
      // 시트 수식 값과 다시 센 값
      var diff = [];
      if (m.sheet.total !== null && !isNaN(m.sheet.total) && m.sheet.total !== m.total) diff.push("총 벙참 시트 " + m.sheet.total + ", 다시 셈 " + m.total);
      if (m.sheet.month !== null && !isNaN(m.sheet.month) && m.sheet.month !== m.month) diff.push("한 달 시트 " + m.sheet.month + ", 다시 셈 " + m.month);
      if (m.sheet.hosted !== null && !isNaN(m.sheet.hosted) && m.sheet.hosted !== m.hosted) diff.push("벙주 시트 " + m.sheet.hosted + ", 다시 셈 " + m.hosted);
      if ((m.sheet.lastBung || "") !== m.last && (m.sheet.lastBung || m.last)) diff.push("마지막 벙참 시트 " + (m.sheet.lastBung || "없음") + ", 다시 셈 " + (m.last || "없음"));
      m.calcDiff = diff;
      if (diff.length) P({ tab: TN, row: m.row, col: colName(mh.map.total != null ? mh.map.total : mh.map.name), level: "info", code: "m_calc", msg: "시트 계산 값과 다름", value: diff.join(", "), who: m.name });
      // 이슈의 경고가 멤버 탭 경고일에 있는지
      m.issues = out.issues.filter(function (e) { return e.persons.indexOf(m.id) >= 0; }).map(function (e) { return { row: e.row, date: e.date, action: e.action, warn: e.warn }; });
      m.issues.forEach(function (e) {
        if (e.warn && e.date && !m.warnings.some(function (w) { return w.date === e.date; })) P({ tab: TN, row: m.row, col: colName(mh.map.warnAt != null ? mh.map.warnAt : mh.map.name), level: "info", code: "m_issue_warn", msg: "이슈 탭 경고(" + e.date + ")가 경고일에 없음", who: m.name });
      });
    });

    /* 관리 점검: 처음 2주, 2개월에 1회, 경고, 노쇼, 나간횟수 */
    var coverOk = out.cover.days >= set.regularDays;
    members.forEach(function (m) {
      var ck = [];
      m.checks = ck;
      if (m.status === "left" || m.status === "kicked") return;
      var on = m.status === "active" || m.status === "other";
      if (m.newbie && on) {
        var since = dnum(today) - dnum(m.joinDate), after = m.attend.filter(function (a) { return a.date >= m.joinDate; });
        if (!after.length) {
          if (since > set.firstMeetDays) ck.push({ c: "first_late", l: "rule", t: "첫 모임 " + set.firstMeetDays + "일 넘김", x: "입장 " + m.joinDate + ", " + since + "일" });
          else ck.push({ c: "first_wait", l: "info", t: "첫 모임 기다림", x: "입장 " + m.joinDate + ", " + (set.firstMeetDays - since) + "일 남음" });
        } else ck.push({ c: "nalte", l: "watch", t: "벙에 왔는데 날떼여부에 입장일", x: "첫 벙 " + after[0].date });
      }
      if (on && !m.newbie) {
        var gap = m.last ? dnum(today) - dnum(m.last) : null;
        if (m.last && gap > set.regularDays) ck.push({ c: "regular", l: "rule", t: set.regularDays + "일 넘게 벙 없음", x: "마지막 " + m.last });
        else if (!m.last && coverOk) ck.push({ c: "regular", l: "rule", t: set.regularDays + "일 넘게 벙 없음", x: "기록 " + coverFrom + "부터 없음" });
        else if (!m.last) ck.push({ c: "no_record", l: "watch", t: "벙 기록 없음", x: "기록 " + (coverFrom || "없음") + "부터 " + out.cover.days + "일" });
        else if (gap > set.regularDays - 15) ck.push({ c: "regular_soon", l: "watch", t: "곧 " + set.regularDays + "일", x: "마지막 " + m.last + ", " + gap + "일" });
      }
      var wn2 = Math.max(m.warnN, m.warnings.length);
      if (wn2 >= 3) ck.push({ c: "warn3", l: "rule", t: "경고 " + wn2 + "회(강제퇴장 단계)", x: m.warnings.map(function (w) { return w.reason || "사유 없음"; }).join(", ") });
      else if (wn2 === 2) ck.push({ c: "warn2", l: "watch", t: "경고 2회(다음은 강제퇴장)", x: m.warnings.map(function (w) { return w.reason || "사유 없음"; }).join(", ") });
      else if (wn2 === 1) ck.push({ c: "warn1", l: "info", t: "경고 1회(다음은 면담)", x: m.warnings[0] && m.warnings[0].reason || "" });
      if (m.noshows.length >= 2) ck.push({ c: "noshow", l: "watch", t: "노쇼 " + m.noshows.length + "회", x: m.noshows.map(function (n) { return n.date; }).join(", ") });
      else if (m.noshows.length === 1) ck.push({ c: "noshow1", l: "info", t: "노쇼 1회", x: m.noshows[0].date });
      if (m.outLimit != null && m.outs > m.outLimit) ck.push({ c: "outs", l: "rule", t: "나간횟수 한도 초과", x: m.outs + "회, 한도 " + m.outLimit + "회" });
    });

    /* 서로 불편한 사이와 같은 벙 */
    var pairs = [];
    members.forEach(function (m) {
      m.dislike.forEach(function (n) {
        var lk = lookup(n);
        if (!lk || !lk.id) { if (!lk || !lk.amb) P({ tab: TN, row: m.row, col: colName(mh.map.dislike), level: "info", code: "m_dislike", msg: "싫어하는 사람 칸의 이름이 멤버 탭에 없음", value: n, who: m.name }); return; }
        var both = counted.filter(function (b) { var all = [b.host].concat(b.people); return all.indexOf(m.id) >= 0 && all.indexOf(lk.id) >= 0; });
        pairs.push({ a: m.id, b: lk.id, mutual: false, together: both.length, last: both.length ? both[both.length - 1].date : "" });
      });
    });
    pairs.forEach(function (p) { p.mutual = pairs.some(function (q) { return q.a === p.b && q.b === p.a; }); });
    out.pairs = pairs;

    /* 적다가 멈춘 줄: 시트가 한동안 그대로인데 남아 있는 작성 중 줄 */
    var idle = opts.idleMin != null ? opts.idleMin : 0;
    probs.forEach(function (p) { if (p.draft && idle >= set.idleMin) { p.level = "watch"; p.msg = "적다가 멈춘 줄(" + p.msg + ")"; p.stalled = true; } });
    out.drafts = drafts.length;
    out.counted = counted.length;
    out.byId = memberIds;
    return out;
  }

  /* ── 두 판의 차이(멤버 칸, 벙 줄, 이슈 줄) ── */
  var MFIELDS = ["region", "statusRaw", "joinMD", "note", "dislike", "couple", "warnN", "warnings", "outs", "extra", "birth", "sex"];
  function diff(a, b) {
    var res = { members: { added: [], removed: [], changed: [] }, bungs: { added: [], removed: [], changed: [] }, issues: { added: [], removed: [], changed: [] } };
    if (!a || !b) return res;
    var am = {}, bm = {};
    (a.members || []).forEach(function (m) { am[m.id] = m; });
    (b.members || []).forEach(function (m) { bm[m.id] = m; });
    Object.keys(bm).forEach(function (id) {
      if (!am[id]) { res.members.added.push({ id: id, name: bm[id].name, row: bm[id].row }); return; }
      var f = MFIELDS.filter(function (k) { return JSON.stringify(am[id][k] == null ? "" : am[id][k]) !== JSON.stringify(bm[id][k] == null ? "" : bm[id][k]); });
      if (f.length) res.members.changed.push({ id: id, name: bm[id].name, row: bm[id].row, fields: f.map(function (k) { return { k: k, from: am[id][k], to: bm[id][k] }; }) });
    });
    Object.keys(am).forEach(function (id) { if (!bm[id]) res.members.removed.push({ id: id, name: am[id].name, row: am[id].row }); });
    var bk = function (list) {
      var o = {}, n = {};
      (list || []).forEach(function (x) { if (x.state === "draft") return; var k = (x.date || x.dateRaw) + "|" + tight(x.title) + "|" + (x.host || tight(x.hostRaw)); n[k] = (n[k] || 0) + 1; o[k + "#" + n[k]] = x; });
      return o;
    };
    var ab = bk(a.bungs), bb = bk(b.bungs);
    Object.keys(bb).forEach(function (k) {
      if (!ab[k]) { res.bungs.added.push(bb[k]); return; }
      var x = ab[k], y = bb[k];
      var px = [x.host].concat(x.people, x.guests, x.noshows).join(","), py = [y.host].concat(y.people, y.guests, y.noshows).join(",");
      if (px !== py || x.place !== y.place || x.state !== y.state) res.bungs.changed.push({ from: x, to: y, plus: y.people.filter(function (p) { return x.people.indexOf(p) < 0; }), minus: x.people.filter(function (p) { return y.people.indexOf(p) < 0; }) });
    });
    Object.keys(ab).forEach(function (k) { if (!bb[k]) res.bungs.removed.push(ab[k]); });
    var ik = function (list) { var o = {}; (list || []).forEach(function (e) { o[(e.date || e.dateRaw) + "|" + tight(e.text).slice(0, 40)] = e; }); return o; };
    var ai = ik(a.issues), bi = ik(b.issues);
    Object.keys(bi).forEach(function (k) { if (!ai[k]) res.issues.added.push(bi[k]); else if (ai[k].action !== bi[k].action || ai[k].notice !== bi[k].notice) res.issues.changed.push({ from: ai[k], to: bi[k] }); });
    Object.keys(ai).forEach(function (k) { if (!bi[k]) res.issues.removed.push(ai[k]); });
    return res;
  }

  /* ── 반영 판정: 구조가 깨졌거나 한꺼번에 많이 사라지면 바로 반영하지 않는다 ── */
  function guard(prev, next) {
    if (!next || !next.structure.ok) return { state: "broken", why: next ? next.structure.missing : ["읽지 못함"] };
    if (!prev || !prev.structure.ok) return { state: "ok" };
    var d = diff(prev, next), why = [];
    var pm = prev.members.length, pb = prev.bungs.filter(function (x) { return x.state !== "draft"; }).length;
    var rm = d.members.removed.length, rb = d.bungs.removed.length;
    if (rm >= 3 && rm / Math.max(1, pm) >= 0.1) why.push("멤버 " + rm + "명이 사라짐");
    if (rb >= 3 && rb / Math.max(1, pb) >= 0.1) why.push("벙 " + rb + "줄이 사라짐");
    if (pm && !next.members.length) why.push("멤버가 하나도 없음");
    if (pb && !next.bungs.length) why.push("벙이 하나도 없음");
    return why.length ? { state: "hold", why: why, diff: d } : { state: "ok", diff: d };
  }

  /* ── 붙여넣기(탭으로 나뉜 글)를 칸으로 ── */
  function fromPaste(text) {
    var t = String(text || "").replace(/\r\n?/g, "\n");
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"' && cell === "") { q = true; continue; }
      if (ch === "\t") { row.push(cell); cell = ""; continue; }
      if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
      cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  var OpsSheet = { parse: parse, diff: diff, guard: guard, fromPaste: fromPaste, parseDate: parseDate, edate: edate, colName: colName, dnum: dnum, dateOf: dateOf, jamo: jamo, LABEL: LABEL };
  if (typeof module !== "undefined" && module.exports) module.exports = OpsSheet;
  else global.OpsSheet = OpsSheet;
})(typeof self !== "undefined" ? self : this);
