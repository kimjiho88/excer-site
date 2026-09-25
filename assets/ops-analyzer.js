/* ============================================================
   ops-analyzer.js : 운영 대시보드 전용 분석 (ops.html 에서만 읽는다)
   ------------------------------------------------------------
   입력: ChatParser.parse(text, { keepSystem: true }) 결과(여러 파일이면 합친 메시지와 sys).
   출력: 방 전체 흐름, 사람별 원장, 신호(좋은 쪽, 나쁜 쪽)와 근거 줄 발췌.
   브라우저 안에서만 돈다. 서버에는 이 결과만 저장하고 대화 원문 전체는 보내지 않는다.

   오픈채팅 닉네임 표시 규칙(중요)
   - 한 사람의 예전 메시지는 모두 지금 닉네임으로 보인다. 나갔다가 다른 닉네임으로 다시 들어오면
     예전 기간의 메시지까지 새 닉네임으로 바뀐다. 그래서 파일 안에서 메시지는 한 사람 한 이름이다.
   - 들어옴, 나감 줄은 그 순간의 이름으로 남아 있을 수 있다. 그래서 이 줄들을 사람에게 이을 때
     같은 이름, 앞 이름(첫 칸), 시점(메시지가 끊기고 다시 시작하는 때) 순서로 잇고, 이은 방법을 함께 남긴다.
   ============================================================ */
(function (global) {
  "use strict";
  var DAY = 86400000;
  var P = global.ChatParser;

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function ts(m) { return Date.UTC(+m.date.slice(0, 4), +m.date.slice(5, 7) - 1, +m.date.slice(8, 10), m.hour || 0, m.min || 0); }
  function dnum(date) { return Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / DAY); }
  function dateOf(n) { var d = new Date(n * DAY); return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate()); }
  function dot(date) { return date ? +date.slice(0, 4) + "." + +date.slice(5, 7) + "." + +date.slice(8, 10) : ""; }
  function hm(m) { return pad2(m.hour || 0) + ":" + pad2(m.min || 0); }
  function norm(s) { return String(s || "").trim().replace(/\s+/g, " "); }
  function headOf(name) { return (P && P.headName ? P.headName(norm(name)) : norm(name).split(" ")[0]).toLowerCase(); }
  // 발췌: 80자까지, 전화번호는 가운데를 가린다
  function snip(text) {
    var t = norm(String(text || "").replace(/\n/g, " "));
    t = t.replace(/(01[016789])[-\s.]?(\d{3,4})[-\s.]?(\d{4})/g, function (_, a, b, c) { return a + "-" + b.slice(0, 1) + "***-**" + c.slice(2); });
    return t.length > 80 ? t.slice(0, 80) + "(생략)" : t;
  }
  function hash(str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

  /* ── 닉네임 양식: 닉네임 지역 성별 출생연도(두 자리) 입장일(월일 네 자리) ── */
  function nickParts(name) {
    var t = norm(name).split(" ").filter(Boolean);
    var out = { tokens: t.length, nick: t[0] || "", region: "", sex: "", birth: "", day: "", issues: [] };
    var sexI = t.findIndex(function (x) { return x === "남" || x === "여"; });
    var birthI = t.findIndex(function (x) { return /^\d{2}$/.test(x); });
    var dayI = t.findIndex(function (x) { return /^\d{4}$/.test(x); });
    if (sexI >= 0) out.sex = t[sexI];
    if (birthI >= 0) out.birth = t[birthI];
    if (dayI >= 0) out.day = t[dayI];
    if (t.length >= 2 && sexI !== 1 && birthI !== 1 && dayI !== 1) out.region = t[1];
    if (!/[가-힣A-Za-z0-9]/.test(name)) out.issues.push("글자 없이 기호나 이모지만");
    if (t.length === 1) out.issues.push("이름만");
    else if (t.length !== 5) out.issues.push("칸 " + t.length + "개(다섯 칸이어야 함)");
    if (!out.sex) out.issues.push("성별 칸 없음");
    if (!out.birth) out.issues.push("출생연도 두 자리 없음");
    if (!out.day) out.issues.push("입장일 네 자리 없음");
    else { var mm = +out.day.slice(0, 2), dd = +out.day.slice(2); if (mm < 1 || mm > 12 || dd < 1 || dd > 31) out.issues.push("입장일 날짜가 아님"); }
    if (t.length === 5 && !(sexI === 2 && birthI === 3 && dayI === 4)) out.issues.push("순서가 다름");
    out.ok = out.issues.length === 0;
    if (out.birth) { var yy = +out.birth; out.birthYear = yy >= 30 ? 1900 + yy : 2000 + yy; out.reentryLimit = out.birthYear <= 1981 ? 1 : 3; }
    return out;
  }

  /* ── 단어 신호 ── */
  var SIG = {
    other_room: { level: "watch", label: "다른 오픈채팅 링크", re: /open\.kakao\.com\/(o|me)\//i },
    promo: { level: "watch", label: "홍보, 초대 표현", re: /(홍보|초대\s*할게|초대해\s*드|들어오세요|방\s*링크|단톡방?\s*(있|만들))/ },
    contact: { level: "watch", label: "연락처(전화번호, 아이디)", re: /(01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|카톡\s*아이디|카톡\s*id|인스타\s*(아이디|계정)|insta(gram)?\s*[:@])/i },
    private: { level: "watch", label: "따로 연락 표현", re: /(번호\s*(좀|알려|주세요|줄래|줄\s*수)|갠톡|개인\s*톡|따로\s*(만나|연락|보자|봐요)|1\s*:\s*1\s*(로|톡))/ },
    bibung: { level: "watch", label: "비벙, 후일담", re: /(비벙|후일담)/ },
    married: { level: "watch", label: "기혼 관련 표현", re: /(와이프|아내가|남편이|남편은|기혼|결혼\s*했|애\s*아빠|애\s*엄마|우리\s*애가|유부)/ },
    abuse: { level: "watch", label: "욕설, 비하 표현", re: /(시발|씨발|ㅅㅂ|병신|ㅂㅅ|개새|좆|닥쳐|꺼져|미친놈|미친년|지랄|ㅈㄹ|찐따|한남|김치녀|꼴페미)/ },
    sexual: { level: "watch", label: "성적 표현", re: /(섹스|야동|가슴\s*크|몸매\s*좋|잠자리|모텔\s*가|원나잇|ㅅㅅ하)/ }
  };
  var RE_WELCOME = /(환영|반가워|반갑습|어서\s*오|안녕하세요|안녕하세여|하이|ㅎㅇ|잘\s*부탁)/;
  var RE_THANKS = /(고마워|고맙|감사|땡큐|덕분|최고예요|최고에요|짱이)/;
  var RE_MEETUP = /((벙|모임).{0,8}(할까|하실|모집|열어|열게|올렸|올릴|구해|가실|갈\s*사람|해요|하자)|(같이|함께).{0,6}(가실|갈\s*분|하실\s*분|드실\s*분))/;
  var RE_INFO = /(맛집|추천|정보|할인|행사|전시|공연|오픈했|새로\s*생겼)/;
  var RE_QUESTION = /(\?|까요|나요|가요\?|인가요|있나요|어때요|어디예요|어디에요|언제예요)\s*$/;
  var RE_NEG = /(왜\s*그래|뭐래|어이없|그만\s*해|짜증|기분\s*나쁘|무례|예의|선\s*넘|싸우|시비|정\s*떨어|어쩌라고|니가|너가)/;

  function analyze(input) {
    var msgsAll = (input && input.messages) || [];
    var sys = (input && input.sys) || [];
    var now = input && input.today;
    var links = (input && input.links) || {};   // 운영자가 직접 이은 줄: 줄 열쇠 -> 지금 이름
    // 시간순(같은 분이면 파일 순서)
    var list = msgsAll.map(function (m, i) { return { m: m, i: i, t: ts(m) }; }).sort(function (a, b) { return a.t - b.t || a.i - b.i; });
    if (!list.length) return null;
    var first = list[0].m.date, last = list[list.length - 1].m.date;
    var endN = dnum(last);

    /* ── 사람(메시지를 보낸 이름) ── */
    var people = Object.create(null);
    var events = [];   // 들어옴, 나감
    var normal = [];
    list.forEach(function (x) {
      var m = x.m;
      if (m.kind === "join" || m.kind === "leave") { events.push({ kind: m.kind, name: norm(m.name), how: m.how || "", by: m.by || "", date: m.date, t: x.t, hm: hm(m) }); return; }
      if (!m.name) return;
      normal.push(x);
      var name = norm(m.name);
      var p = people[name];
      if (!p) {
        p = people[name] = {
          name: name, head: headOf(name), n: 0, kinds: { photo: 0, video: 0, emoticon: 0, link: 0, file: 0, voice: 0, deleted: 0 },
          textLen: 0, textN: 0, days: Object.create(null), weeks: Object.create(null), night: 0,
          firstT: x.t, lastT: x.t, firstDate: m.date, lastDate: m.date, byDay: Object.create(null),
          starts: 0, replies: 0, welcomes: 0, thanksGiven: 0, thanksGot: 0, mentionsOut: Object.create(null), mentionsIn: 0,
          info: 0, meetup: 0, sig: [], signals: Object.create(null), ev: [], floods: 0, gaps: 0, maxGap: 0, tsList: []
        };
      }
      p.tsList.push(x.t);
      if (x.t < p.firstT) { p.firstT = x.t; p.firstDate = m.date; }
      if (x.t >= p.lastT) { var g = dnum(m.date) - dnum(p.lastDate); if (g > p.maxGap) p.maxGap = g; p.lastT = x.t; p.lastDate = m.date; }
      p.n += 1;
      if (p.kinds[m.kind] != null) p.kinds[m.kind] += 1;
      if (m.kind === "text" || m.kind === "link") { p.textLen += m.len || 0; p.textN += 1; }
      p.days[m.date] = 1;
      p.weeks[Math.floor(dnum(m.date) / 7)] = 1;
      p.byDay[m.date] = (p.byDay[m.date] || 0) + 1;
      if (m.hour >= 1 && m.hour < 5) p.night += 1;
      if (p.sig.length < 12) p.sig.push(m.date + "|" + hm(m) + "|" + m.kind + "|" + (m.len || 0));
    });
    var names = Object.keys(people);
    var byHead = Object.create(null);
    names.forEach(function (n) { (byHead[people[n].head] = byHead[people[n].head] || []).push(n); });

    function addEv(p, code, m, text) {
      var cnt = p.ev.filter(function (e) { return e.c === code; }).length;
      if (cnt >= 6 || p.ev.length >= 40) return;
      p.ev.push({ c: code, d: m.date, t: hm(m), x: snip(text) });
    }
    function flag(p, code, m, text) {
      p.signals[code] = (p.signals[code] || 0) + 1;
      addEv(p, code, m, text);
    }

    /* ── 멘션 대상 찾기: "@" 뒤 글이 어떤 사람 이름으로 시작하는지(가장 긴 이름), 아니면 앞 이름 ── */
    var namesByLen = names.slice().sort(function (a, b) { return b.length - a.length; });
    function mentionTargets(text) {
      var out = [];
      var re = /@([^\n@]{1,40})/g, mm;
      while ((mm = re.exec(text))) {
        var after = mm[1];
        var hit = null;
        for (var i = 0; i < namesByLen.length; i++) { if (after.indexOf(namesByLen[i]) === 0) { hit = namesByLen[i]; break; } }
        if (!hit) { var h = headOf(after); if (byHead[h] && byHead[h].length === 1) hit = byHead[h][0]; }
        if (hit && out.indexOf(hit) < 0) out.push(hit);
      }
      return out;
    }

    /* ── 메시지 한 줄씩: 대화 시작, 답, 환영, 감사, 멘션, 신호, 도배, 답 없는 질문 ── */
    var joinTimes = events.filter(function (e) { return e.kind === "join"; });
    var ji = 0, recentJoins = [];
    var prev = null;
    var floodWin = Object.create(null);
    var questions = [];
    normal.forEach(function (x, idx) {
      var m = x.m, p = people[norm(m.name)];
      // 들어온 지 60분 안의 입장들
      while (ji < joinTimes.length && joinTimes[ji].t <= x.t) { recentJoins.push(joinTimes[ji]); ji += 1; }
      recentJoins = recentJoins.filter(function (j) { return x.t - j.t <= 60 * 60000; });
      var gap = prev ? (x.t - prev.t) / 60000 : Infinity;
      if (gap >= 60) p.starts += 1;
      else if (prev && norm(prev.m.name) !== p.name && gap <= 5) p.replies += 1;
      var text = m.kind === "text" || m.kind === "link" ? String(m.text || "") : "";
      if (text) {
        if (recentJoins.length && RE_WELCOME.test(text)) {
          recentJoins.forEach(function (j) { if (j.name !== p.name && headOf(j.name) !== p.head) { j.welcomed = true; if (!j.welcomers) j.welcomers = Object.create(null); if (!j.welcomers[p.name]) { j.welcomers[p.name] = 1; p.welcomes += 1; } } });
        }
        var targets = mentionTargets(text).filter(function (n) { return n !== p.name; });
        targets.forEach(function (n) { p.mentionsOut[n] = (p.mentionsOut[n] || 0) + 1; people[n].mentionsIn += 1; });
        if (RE_THANKS.test(text)) {
          p.thanksGiven += 1;
          targets.forEach(function (n) { people[n].thanksGot += 1; });
          // 멘션 없이 감사하면 바로 앞 다른 사람의 말(5분 안)에 대한 감사로 본다
          if (!targets.length && prev && norm(prev.m.name) !== p.name && gap <= 5) people[norm(prev.m.name)].thanksGot += 1;
        }
        if (RE_MEETUP.test(text)) { p.meetup += 1; addEv(p, "meetup", m, text); }
        if (m.kind === "link" || RE_INFO.test(text)) { p.info += 1; }
        Object.keys(SIG).forEach(function (code) { if (SIG[code].re.test(text)) flag(p, code, m, text); });
        if (RE_QUESTION.test(text.trim())) questions.push({ x: x, idx: idx, name: p.name });
      }
      if (m.kind === "deleted") flag(p, "deleted", m, "삭제된 메시지");
      // 도배: 같은 사람 3분 안에 10건 이상(한 번 걸리면 그 묶음이 끝날 때까지 한 번만)
      var w = floodWin[p.name] || (floodWin[p.name] = { ts: [], on: false });
      w.ts.push(x.t); while (w.ts.length && x.t - w.ts[0] > 3 * 60000) w.ts.shift();
      if (w.ts.length >= 10 && !w.on) { w.on = true; p.floods += 1; flag(p, "flood", m, "3분 안에 " + w.ts.length + "건 이상"); }
      if (w.ts.length < 5) w.on = false;
      prev = x;
    });
    // 답 없는 질문: 30분 안에 다른 사람의 말이 없음
    var unanswered = [];
    questions.forEach(function (q) {
      var answered = false;
      for (var k = q.idx + 1; k < normal.length; k++) {
        var y = normal[k]; if (y.t - q.x.t > 30 * 60000) break;
        if (norm(y.m.name) !== q.name) { answered = true; break; }
      }
      if (!answered) unanswered.push({ d: q.x.m.date, t: hm(q.x.m), hour: q.x.m.hour, name: q.name, x: snip(q.x.m.text) });
    });

    /* ── 감정싸움 후보: 두 사람이 2분 간격 안으로 번갈아 10번 넘게, 20건 넘게 주고받고 부정 표현이 2번 이상 ── */
    var conflicts = [];
    (function () {
      var neg = function (x) { return RE_NEG.test(x.m.text || "") || SIG.abuse.re.test(x.m.text || "") ? 1 : 0; };
      var run = null;
      function end(r) {
        if (r.switches >= 10 && r.n >= 20 && r.neg >= 2) {
          conflicts.push({ a: r.pair[0], b: r.pair[1], d: r.start.m.date, t: hm(r.start.m), n: r.n, neg: r.neg });
          r.pair.forEach(function (who, i) { flag(people[who], "conflict", r.start.m, r.pair[1 - i] + "님과 " + r.n + "번 주고받음, 부정 표현 " + r.neg + "번"); });
        }
      }
      for (var k = 1; k < normal.length; k++) {
        var a = normal[k - 1], b = normal[k];
        var an = norm(a.m.name), bn = norm(b.m.name);
        var ok = b.t - a.t <= 2 * 60000;
        if (run && ok && run.pair.indexOf(bn) >= 0) {
          run.n += 1; run.neg += neg(b);
          if (bn !== run.last) { run.switches += 1; run.last = bn; }
          continue;
        }
        if (run) end(run);
        run = ok && an !== bn ? { pair: [an, bn], n: 2, switches: 1, neg: neg(a) + neg(b), start: a, last: bn } : null;
      }
      if (run) end(run);
    })();

    /* ── 들어옴, 나감 줄을 사람에게 잇기 ──
       1) 이름이 같으면 잇는다.
       2) 앞 이름(첫 칸)이 같고 시점이 맞는 사람이 한 명뿐이면 잇는다.
       3) 이름이 전혀 달라도(닉네임을 바꿔 다시 들어온 경우) 시점이 딱 맞는 사람이 한 명뿐이면 잇는다.
       시점: 나감은 그 사람의 말이 나감 전 며칠 안에 끊기고, 다시 말하면 그 사이가 7일 이상.
             들어옴은 그 사람의 말이 들어옴 뒤 며칠 안에 시작되고, 그 전에 말했다면 7일 이상 쉬었던 뒤 */
    // 그 사람의 메시지 시각(정렬됨)에서 t 이전 마지막, t 이후 처음
    function lowerIdx(a, t) { var lo = 0, hi = a.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (a[mid] < t) lo = mid + 1; else hi = mid; } return lo; }
    function nearestBefore(p, t) { var i = lowerIdx(p.tsList, t + 1) - 1; return i >= 0 ? p.tsList[i] : -Infinity; }
    function nearestAfter(p, t) { var i = lowerIdx(p.tsList, t); return i < p.tsList.length ? p.tsList[i] : Infinity; }
    function fits(p, e, win) {
      if (e.kind === "leave") {
        var bf = nearestBefore(p, e.t), af = nearestAfter(p, e.t + 1);
        return bf !== -Infinity && e.t - bf <= win && (af === Infinity || af - e.t >= 7 * DAY) ? e.t - bf : -1;
      }
      var af2 = nearestAfter(p, e.t), bf2 = nearestBefore(p, e.t - 1);
      return af2 !== Infinity && af2 - e.t <= win && (bf2 === -Infinity || e.t - bf2 >= 7 * DAY) ? af2 - e.t : -1;
    }
    // 이미 이 경계(앞뒤 메시지 사이)에 같은 종류의 줄이 이어진 사람은 후보에서 뺀다
    var linked = Object.create(null);
    function link(e, who, via) { e.who = who; e.via = via; (linked[who] = linked[who] || []).push(e); }
    function taken(n, e) {
      var L = linked[n]; if (!L) return false;
      var p = people[n];
      var lo = e.kind === "join" ? nearestBefore(p, e.t - 1) : nearestBefore(p, e.t);
      var hi = e.kind === "join" ? nearestAfter(p, e.t) : nearestAfter(p, e.t + 1);
      return L.some(function (x) { return x.kind === e.kind && x.t > lo && x.t < hi; });
    }
    function pick(cands, e, win) {
      var scored = cands.filter(function (n) { return !taken(n, e); }).map(function (n) { return { n: n, d: fits(people[n], e, win) }; }).filter(function (c) { return c.d >= 0; }).sort(function (a, b) { return a.d - b.d; });
      if (!scored.length) return null;
      if (scored.length > 1 && scored[1].d - scored[0].d < DAY) return null;   // 둘이 비슷하면 잇지 않는다(운영자가 직접)
      return scored[0].n;
    }
    events.forEach(function (e) {
      e.key = e.kind + "|" + e.date + "|" + e.hm + "|" + e.name;
      if (links[e.key] && people[links[e.key]]) link(e, links[e.key], "manual");
      else if (people[e.name]) link(e, e.name, "name");
    });
    events.forEach(function (e) {
      if (e.who) return;
      var who = pick(byHead[headOf(e.name)] || [], e, 30 * DAY);
      if (who) link(e, who, "head");
    });
    events.forEach(function (e) {
      if (e.who) return;
      // 이름이 다른 나감은 다시 돌아온 사람에게만 잇는다(떠나고 끝난 사람은 나감 줄 이름과 메시지 이름이 같다)
      var cands = e.kind === "leave" ? names.filter(function (n) { return nearestAfter(people[n], e.t + 1) !== Infinity; }) : names;
      var who = pick(cands, e, e.kind === "leave" ? 7 * DAY : 3 * DAY);
      if (who) link(e, who, "time");
    });

    /* ── 사람마다 머문 기간, 재입장, 상태 ── */
    var fileStartT = list[0].t;
    names.forEach(function (n) {
      var p = people[n];
      var evs = events.filter(function (e) { return e.who === n; });
      var joins = evs.filter(function (e) { return e.kind === "join"; });
      var leaves = evs.filter(function (e) { return e.kind === "leave"; });
      var re = [];
      joins.forEach(function (j) {
        var spokeBefore = p.firstT < j.t - 60000;
        var leftBefore = leaves.some(function (l) { return l.t < j.t; });
        if (spokeBefore || leftBefore) re.push({ d: j.date, via: j.via, name: j.name });
      });
      // 나감 줄 뒤에 다시 말했는데 그 사이 들어옴 줄이 없으면 들어옴 줄 없는 재입장
      leaves.forEach(function (l) {
        var after = nearestAfter(p, l.t);
        if (after === Infinity) return;
        var hasJoin = joins.some(function (j) { return j.t > l.t && j.t <= after; });
        if (!hasJoin) re.push({ d: dateOf(Math.floor(after / DAY)), via: "gap", name: "" });
      });
      var lastLeave = leaves.length ? leaves[leaves.length - 1] : null;
      var lastJoin = joins.length ? joins[joins.length - 1] : null;
      var out = lastLeave && lastLeave.t > p.lastT && (!lastJoin || lastLeave.t > lastJoin.t);
      p.status = out ? (lastLeave.how === "kick" ? "kicked" : "left") : "in";
      p.outDate = out ? lastLeave.date : "";
      p.outBy = out && lastLeave.by ? lastLeave.by : "";
      p.joinedAt = lastJoin ? lastJoin.date : "";
      p.joinedBeforeFile = !lastJoin && p.firstT <= fileStartT + 7 * DAY;
      p.reentries = re.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
      p.kickedThenBack = leaves.some(function (l) { return l.how === "kick" && (nearestAfter(p, l.t + 1) !== Infinity || joins.some(function (j) { return j.t > l.t; })); });
      p.sysNames = evs.map(function (e) { return e.name; }).filter(function (x, i, a) { return x !== n && a.indexOf(x) === i; });
      p.events = evs.map(function (e) { return { k: e.kind, d: e.date, t: e.hm, how: e.how || "", by: e.by || "", name: e.name, via: e.via, key: e.key }; });
    });

    /* ── 사람마다 정리(원장 한 줄) ── */
    var endT = list[list.length - 1].t;
    var totalN = normal.length;
    var ledger = names.map(function (n) {
      var p = people[n];
      var parts = nickParts(n);
      var inWin = function (days) { var from = endN - days + 1, c = 0; Object.keys(p.byDay).forEach(function (d) { if (dnum(d) >= from) c += p.byDay[d]; }); return c; };
      var d30 = inWin(30), d60 = inWin(60), d90 = inWin(90);
      var prev60 = d90 - d30;
      var flags = [];
      function F(code, level, label, extra) { flags.push({ c: code, l: level, t: label, x: extra || "" }); }
      if (!parts.ok) F("fmt", "rule", "닉네임 양식", parts.issues.join(", "));
      if (p.joinedAt && parts.day) {
        var real = p.joinedAt.slice(5, 7) + p.joinedAt.slice(8, 10);
        var diff = Math.abs(dnum(p.joinedAt) - dnum(p.joinedAt.slice(0, 4) + "-" + parts.day.slice(0, 2) + "-" + parts.day.slice(2)));
        if (real !== parts.day && diff > 1) F("day", "rule", "입장일 불일치", "닉네임 " + parts.day + ", 실제 들어옴 " + dot(p.joinedAt));
      }
      var limit = parts.reentryLimit || null;
      if (p.reentries.length && limit != null && p.reentries.length > limit) F("reentry", "rule", "재입장 한도 초과", p.reentries.length + "회, 한도 " + limit + "회");
      else if (p.reentries.length) F("reentry_info", "info", "재입장 " + p.reentries.length + "회", p.reentries.length + "회, " + (limit != null ? "한도 " + limit + "회" : "출생연도를 몰라 한도 판정 못 함"));
      if (p.kickedThenBack) F("kick_return", "rule", "내보낸 뒤 다시 들어옴");
      if (p.kinds.deleted) F("deleted", "rule", "메시지 삭제", p.kinds.deleted + "회");
      if (p.sysNames.length) F("names", "info", "다른 이름 기록", p.sysNames.join(", "));
      Object.keys(SIG).forEach(function (code) { if (p.signals[code]) F(code, "watch", SIG[code].label, p.signals[code] + "회"); });
      if (p.floods) F("flood", "watch", "도배", p.floods + "번");
      if (p.signals.conflict) F("conflict", "watch", "감정싸움 후보", p.signals.conflict + "번");
      // 한 사람에게 쏠린 멘션: 최근 30일 10회 이상, 상대는 2회 이하
      Object.keys(p.mentionsOut).forEach(function (to) {
        if (p.mentionsOut[to] >= 10 && ((people[to] && people[to].mentionsOut[n]) || 0) <= 2) F("mention_focus", "watch", "한 사람에게 쏠린 멘션", to + "님에게 " + p.mentionsOut[to] + "회");
      });
      if (p.status === "in" && prev60 >= 20 && d30 < (prev60 / 2) * 0.3) F("drop", "watch", "대화 급감", "최근 30일 " + d30 + "건, 그 전 60일 " + prev60 + "건");
      if (p.status === "in" && endN - dnum(p.lastDate) > 60) F("silent", "watch", "60일 넘게 대화 없음", "마지막 " + dot(p.lastDate));
      if (p.welcomes >= 3) F("welcomer", "good", "신입 환영", p.welcomes + "번");
      if (p.thanksGot >= 3) F("thanked", "good", "감사 받음", p.thanksGot + "번");
      if (p.meetup >= 2) F("organizer", "good", "모임 제안", p.meetup + "번");
      if (p.info >= 5) F("sharer", "good", "정보 공유", p.info + "번");
      var weeks = Object.keys(p.weeks).map(Number).sort(function (a, b) { return a - b; });
      var streak = 0, best = 0; weeks.forEach(function (w, i) { streak = i && w === weeks[i - 1] + 1 ? streak + 1 : 1; if (streak > best) best = streak; });
      if (best >= 8) F("steady", "good", "꾸준함", best + "주 연속");
      return {
        name: n, head: p.head, parts: { region: parts.region, sex: parts.sex, birth: parts.birth, birthYear: parts.birthYear || null, day: parts.day },
        fmtOk: parts.ok, fmtIssues: parts.issues, limit: limit,
        status: p.status, outDate: p.outDate, outBy: p.outBy, joinedAt: p.joinedAt, joinedBeforeFile: p.joinedBeforeFile, kickedThenBack: p.kickedThenBack,
        reentries: p.reentries, sysNames: p.sysNames, events: p.events.slice(-20),
        first: p.firstDate, last: p.lastDate, n: p.n, d30: d30, d60: d60, d90: d90, activeDays: Object.keys(p.days).length, maxGap: p.maxGap,
        kinds: p.kinds, avgLen: p.textN ? Math.round(p.textLen / p.textN) : 0, nightShare: p.n ? Math.round((p.night / p.n) * 100) : 0,
        starts: p.starts, replies: p.replies, welcomes: p.welcomes, thanksGot: p.thanksGot, thanksGiven: p.thanksGiven,
        mentionsIn: p.mentionsIn, mentionsOut: Object.keys(p.mentionsOut).map(function (k) { return { to: k, c: p.mentionsOut[k] }; }).sort(function (a, b) { return b.c - a.c; }).slice(0, 5),
        meetup: p.meetup, info: p.info, share: totalN ? Math.round((p.n / totalN) * 1000) / 10 : 0,
        flags: flags, ev: p.ev,
        fp: hash(p.sig.slice(0, 8).join(";")), sig: p.sig
      };
    }).sort(function (a, b) { return b.n - a.n; });

    /* ── 방 전체 ── */
    var months = Object.create(null);
    function M(date) { var k = date.slice(0, 7); return months[k] || (months[k] = { m: k, joins: 0, leaves: 0, kicks: 0, msgs: 0, speakers: Object.create(null) }); }
    events.forEach(function (e) { var r = M(e.date); if (e.kind === "join") r.joins += 1; else if (e.how === "kick") r.kicks += 1; else r.leaves += 1; });
    normal.forEach(function (x) { var r = M(x.m.date); r.msgs += 1; r.speakers[norm(x.m.name)] = 1; });
    var monthList = Object.keys(months).sort().map(function (k) { var r = months[k]; return { m: k, joins: r.joins, leaves: r.leaves, kicks: r.kicks, net: r.joins - r.leaves - r.kicks, msgs: r.msgs, speakers: Object.keys(r.speakers).length }; });
    // 신입 흐름: 파일 안의 들어옴마다
    var joinsAll = events.filter(function (e) { return e.kind === "join"; });
    var funnel = { joined: joinsAll.length, spoke7: 0, stay30: 0, base30: 0, stay60: 0, base60: 0, stay90: 0, base90: 0, left7: 0, silentLeft: 0, welcomed: 0 };
    joinsAll.forEach(function (j) {
      var p = j.who ? people[j.who] : null;
      if (j.welcomed) funnel.welcomed += 1;
      if (p && nearestAfter(p, j.t) - j.t <= 7 * DAY) funnel.spoke7 += 1;
      var leaveAfter = events.filter(function (e) { return e.kind === "leave" && e.t > j.t && ((j.who && e.who === j.who) || e.name === j.name); })[0];
      var jn = dnum(j.date);
      if (leaveAfter && dnum(leaveAfter.date) - jn <= 7) funnel.left7 += 1;
      if (leaveAfter && !p) funnel.silentLeft += 1;
      [30, 60, 90].forEach(function (d) {
        if (jn + d > endN) return;
        funnel["base" + d] += 1;
        if (!leaveAfter || dnum(leaveAfter.date) > jn + d) funnel["stay" + d] += 1;
      });
    });
    var hours = new Array(24).fill(0), weekdays = new Array(7).fill(0);
    normal.forEach(function (x) { hours[x.m.hour] += 1; weekdays[x.m.weekday] += 1; });
    var sortedN = ledger.map(function (r) { return r.n; }).sort(function (a, b) { return b - a; });
    var top10 = sortedN.slice(0, Math.max(1, Math.ceil(sortedN.length * 0.1))).reduce(function (a, b) { return a + b; }, 0);
    var sysCount = { hidden: 0, notice: 0, policy: 0, rename: 0, role: 0, other: 0 };
    var unread = [];
    sys.forEach(function (s) { sysCount[s.type] = (sysCount[s.type] || 0) + 1; if (s.type === "other" && unread.length < 50) unread.push({ d: s.date, x: String(s.text).slice(0, 80) }); });
    var unlinked = events.filter(function (e) { return !e.who; }).map(function (e) { return { k: e.kind, d: e.date, t: e.hm, name: e.name, how: e.how, key: e.key }; });

    return {
      v: 1,
      range: { from: first, to: last },
      totals: { messages: totalN, people: ledger.length, joins: joinsAll.length, leaves: events.filter(function (e) { return e.kind === "leave" && e.how !== "kick"; }).length, kicks: events.filter(function (e) { return e.how === "kick"; }).length },
      inRoom: ledger.filter(function (r) { return r.status === "in"; }).length,
      months: monthList,
      funnel: funnel,
      unanswered: { count: unanswered.length, byHour: unanswered.reduce(function (a, q) { a[q.hour] += 1; return a; }, new Array(24).fill(0)), recent: unanswered.slice(-20) },
      conflicts: conflicts.slice(-30),
      concentration: totalN ? Math.round((top10 / totalN) * 100) : 0,
      hours: hours, weekdays: weekdays,
      sys: sysCount, unread: unread,
      unlinked: unlinked.slice(-1000),
      people: ledger
    };
  }

  /* ── 지난 저장본과 비교: 지문이 같은데 이름이 다르면 닉네임을 바꾼 것 ── */
  function matchPrevious(people, prevPeople) {
    var byFp = Object.create(null), bySig = Object.create(null);
    (prevPeople || []).forEach(function (q) { byFp[q.fp] = q; (q.sig || []).forEach(function (s) { (bySig[s] = bySig[s] || []).push(q); }); });
    return people.map(function (r) {
      var q = byFp[r.fp];
      if (!q) {
        var votes = Object.create(null), best = null, bestN = 0;
        (r.sig || []).forEach(function (s) { (bySig[s] || []).forEach(function (c) { votes[c.fp] = (votes[c.fp] || 0) + 1; if (votes[c.fp] > bestN) { bestN = votes[c.fp]; best = c; } }); });
        if (best && bestN >= 5) q = best;
      }
      return { name: r.name, prev: q || null };
    });
  }

  var OpsAnalyzer = { analyze: analyze, nickParts: nickParts, matchPrevious: matchPrevious, SIG: SIG };
  global.OpsAnalyzer = OpsAnalyzer;
  if (typeof module !== "undefined" && module.exports) module.exports = OpsAnalyzer;
})(typeof window !== "undefined" ? window : globalThis);
