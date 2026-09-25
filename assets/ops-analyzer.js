/* ============================================================
   ops-analyzer.js : 운영 대시보드 전용 분석 (ops.html 에서만 읽는다)
   ------------------------------------------------------------
   입력: 대화 파일(runFiles, 조각씩 읽어 한 번 훑는다) 또는 파싱한 메시지 배열(analyze, 시험용).
   출력: 방 전체 흐름, 사람별 원장, 신호(좋은 쪽, 나쁜 쪽)와 근거 줄 발췌.
   브라우저 안에서만 돈다. 서버에는 이 결과만 저장하고 대화 원문 전체는 보내지 않는다.
   파일이 수백 MB 여도 메시지를 쌓아 두지 않고 사람별 집계만 들고 가므로 폰에서도 돈다.

   오픈채팅 닉네임 표시 규칙(중요)
   - 한 사람의 예전 메시지는 모두 지금 닉네임으로 보인다. 나갔다가 다른 닉네임으로 다시 들어오면
     예전 기간의 메시지까지 새 닉네임으로 바뀐다. 그래서 파일 안에서 메시지는 한 사람 한 이름이다.
   - 실제 내보내기(2025-01 ~ 2026-09, 216만 줄)에서 들어옴, 나감, 내보냄 줄도 지금 닉네임으로 남아 있었다
     (파일 중간에 처음 말한 724명 중 720명이 같은 이름의 들어옴 줄을 가짐). 그래서 줄은 이름이 같은 사람에게만 잇고,
     못 이은 줄은 운영자가 직접 잇는다. 기본 프로필 이름(뽀뽀하는 어피치 등)은 여러 사람이 같이 쓰므로 따로 센다.
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
    t = t.replace(/(^|[^\d\/=._%-])(01[016789])[-\s.]?(\d{3,4})[-\s.]?(\d{4})(?!\d)/g, function (_, pre, a, b, c) { return pre + a + "-" + b.slice(0, 1) + "***-**" + c.slice(2); });
    return t.length > 80 ? t.slice(0, 80) + "(생략)" : t;
  }
  function hash(str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

  /* ── 닉네임 양식: 닉네임 지역 성별 출생연도(두 자리) 입장일(월일 네 자리) ──
     끝의 하트는 양식 밖의 표시다(색 하트는 방 안 커플, 흰 하트는 방 밖 사람과 만남).
     입장일 칸이 없는 것은 따로 표시만 하고, 적용 시작일 뒤에 들어온 사람만 규칙으로 본다(대시보드 설정) */
  var HEART_RE = /\s*((?:\u2764\uFE0F?|\u2665\uFE0F?|\uD83E\uDDE1|\uD83D\uDC9B|\uD83D\uDC9A|\uD83D\uDC99|\uD83D\uDC9C|\uD83E\uDD0E|\uD83D\uDDA4|\uD83E\uDD0D|\uD83E\uDE77|\uD83E\uDE75|\uD83E\uDE76|\uD83D\uDC97|\uD83D\uDC96|\uD83D\uDC95|\uD83D\uDC98|\uD83D\uDC9D|\uD83D\uDC93|\uD83D\uDC9E)+)\s*$/;
  var WHITE_HEART = "\uD83E\uDD0D";
  function isBot(name) { var n = norm(name); return /(^|[\s_])bot$/i.test(n) || /봇$/.test(n); }
  function nickParts(name) {
    var raw = norm(name), heart = "";
    var hm = raw.match(HEART_RE);
    if (hm && hm.index > 0) { heart = hm[1].replace(/\uFE0F/g, ""); raw = raw.slice(0, hm.index).trim(); }
    var t = raw.split(" ").filter(Boolean);
    var out = { tokens: t.length, nick: t[0] || "", region: "", sex: "", birth: "", day: "", heart: heart, heartKind: heart ? (heart.indexOf(WHITE_HEART) >= 0 ? "out" : "in") : "", issues: [] };
    var sexI = t.findIndex(function (x) { return x === "남" || x === "여"; });
    var birthI = t.findIndex(function (x) { return /^\d{2}$/.test(x); });
    var dayI = t.findIndex(function (x) { return /^\d{4}$/.test(x); });
    if (sexI >= 0) out.sex = t[sexI];
    if (birthI >= 0) out.birth = t[birthI];
    if (dayI >= 0) out.day = t[dayI];
    if (t.length >= 2 && sexI !== 1 && birthI !== 1 && dayI !== 1) out.region = t[1];
    if (!/[가-힣A-Za-z0-9]/.test(raw)) out.issues.push("글자 없이 기호나 이모지만");
    if (t.length === 1) out.issues.push("이름만");
    else if (t.length !== (out.day ? 5 : 4)) out.issues.push("칸 " + t.length + "개");
    if (!out.sex) out.issues.push("성별 칸 없음");
    if (!out.birth) out.issues.push("출생연도 두 자리 없음");
    if (out.day) { var mm = +out.day.slice(0, 2), dd = +out.day.slice(2); if (mm < 1 || mm > 12 || dd < 1 || dd > 31) out.issues.push("입장일 날짜가 아님"); }
    if (out.sex && out.birth && t.length >= 4 && !(sexI === 2 && birthI === 3 && (!out.day || dayI === 4))) out.issues.push("순서가 다름");
    out.dayMissing = t.length > 1 && !out.day;
    out.ok = out.issues.length === 0;
    if (out.birth) { var yy = +out.birth; out.birthYear = yy >= 30 ? 1900 + yy : 2000 + yy; out.reentryLimit = out.birthYear <= 1981 ? 1 : 3; }
    return out;
  }

  /* ── 단어 신호 ── */
  var SIG = {
    other_room: { level: "watch", label: "다른 오픈채팅 링크", re: /open\.kakao\.com\/(o|me)\//i, url: true },
    promo: { level: "watch", label: "다른 방 홍보, 초대", re: /(방\s*홍보|채팅방?\s*홍보|단톡\s*홍보|초대\s*할게|초대해\s*(드릴|줄)|이\s*방\s*들어오세요|방\s*링크\s*(드릴|줄|보내)|단톡방?\s*(있어요|만들었|새로\s*팠))/ },
    contact: { level: "watch", label: "연락처(전화번호, 아이디)", re: /((^|[^\d])01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}(?!\d)|카톡\s*(아이디|id)\s*[:은는]|인스타\s*(아이디|계정)\s*[:은는@]|insta(gram)?\s*[:@])/i },
    private: { level: "watch", label: "번호, 연락처 요청", re: /(번호\s*(좀|알려|주세요|줄래|줄\s*수|교환|따도)|연락처\s*(좀|알려|주세요|줄래|교환)|카톡\s*아이디\s*(좀|알려|주세요))/, not: /(계좌|방|주문|대기|룸|좌석|송장|운송장|선생님|사업자|비밀)\s*번호|번호표/ },
    bibung: { level: "watch", label: "비벙, 후일담", re: /((^|[\s,.!?~ㅋㅎ(\[])비벙|후일담)/, not: /(금지|안\s*돼|안\s*되|안돼|안되|지양|하지\s*마|자제|올리면\s*안|규칙)/ },
    married: { level: "watch", label: "기혼 관련 표현", re: /((제|내|우리)\s*(와이프|아내|마누라|남편|신랑)|(저|나)\s*유부|유부(남|녀)\s*(이에요|입니다|인데|이라)|(저|나|제가|내가)\s*(는|도)?\s*결혼\s*했|기혼\s*(이에요|입니다|인데))/ },
    abuse: { level: "watch", label: "욕설, 비하 표현", re: /(시발|씨발|ㅅㅂ|병신|ㅂㅅ|개새|좆|닥쳐|(^|\s)꺼져($|[\s!.~ㅋ])|미친놈|미친년|지랄|ㅈㄹ|찐따|한남(충|새끼|들)|김치녀|꼴페미)/ },
    sexual: { level: "watch", label: "성적 표현", re: /(섹스|야동|가슴\s*크|몸매\s*좋|원나잇|ㅅㅅ하)/, not: /(온\s*더\s*(비치|시티)|애프[터타]\s*섹스|섹스\s*앤\s*더\s*시티|섹스\s*피스톨즈)/ }
  };

  var RE_WELCOME = /(환영|반가워|반갑습|어서\s*오|안녕하세요|안녕하세여|하이|ㅎㅇ|잘\s*부탁)/;
  var RE_THANKS = /(고마워|고맙|감사|땡큐|덕분|최고예요|최고에요|짱이)/;
  var RE_MEETUP = /((벙|모임).{0,8}(할까|하실|모집|열어|열게|올렸|올릴|구해|가실|갈\s*사람|해요|하자)|(같이|함께).{0,6}(가실|갈\s*분|하실\s*분|드실\s*분))/;
  var RE_INFO = /(맛집|추천|정보|할인|행사|전시|공연|오픈했|새로\s*생겼)/;
  var RE_QUESTION = /(\?|까요|나요|가요\?|인가요|있나요|어때요|어디예요|어디에요|언제예요)\s*$/;
  var RE_NEG = /(왜\s*그래|뭐래|어이없|그만\s*해|짜증|기분\s*나쁘|무례|예의|선\s*넘|싸우|시비|정\s*떨어|어쩌라고|니가|너가)/;

  /* ── 카카오 기본 프로필 이름(여러 사람이 같은 이름을 쓴다) ── */
  var RE_DEFAULT_CHAR = /^(어피치|라이언|춘식이|죠르디|스카피|무지|프렌즈|네오|팬더주니어|팬다주니어|제이지|프로도|튜브|니니즈|앙몬드|콘|케로|베로니|콥|빠냐|브라운|코니|샐리|초이)$/;
  function isDefaultName(name) {
    var t = norm(name).split(" ");
    if (!/[가-힣A-Za-z0-9]/.test(name)) return true;
    return t.length >= 2 && !/\d/.test(name) && RE_DEFAULT_CHAR.test(t[t.length - 1]);
  }

  /* ── 한 번 훑는 분석기: 메시지를 시간 순서로 하나씩 받는다 ── */
  function createAnalyzer(opts) {
    opts = opts || {};
    var links = opts.links || {};   // 운영자가 직접 이은 줄: 줄 열쇠 -> 지금 이름
    var people = Object.create(null), names = [], byHead = Object.create(null), namesByLen = null;
    var events = [], evByName = Object.create(null);
    var months = Object.create(null);
    var hours = new Array(24).fill(0), weekdays = new Array(7).fill(0), gridM = Object.create(null);   // 달마다 요일 x 시간
    var totalN = 0, first = null, lastDate = null, fileStartT = null;
    var lastMin = -Infinity, sub = 0, curMinSigs = Object.create(null), boundary = null;
    var recentJoins = [], prev = null, pendingQ = [], unanswered = [], conflicts = [], run = null;
    var sysSeen = Object.create(null), sysCount = { hidden: 0, notice: 0, policy: 0, rename: 0, role: 0, lock: 0, bot: 0, other: 0 }, hiddenMsgs = 0, unread = [], roles = [];

    function M(date) { var k = date.slice(0, 7); return months[k] || (months[k] = { m: k, joins: 0, leaves: 0, kicks: 0, msgs: 0, hidden: 0, speakers: Object.create(null) }); }
    function sigOf(m) { return m.kind + "|" + (m.name || "") + "|" + (m.len || 0) + "|" + (m.how || ""); }
    // 근거 줄은 종류마다 가장 최근 6개, 사람마다 40개까지
    function addEv(p, code, m, text) {
      var firstOfCode = -1, cnt = 0;
      for (var i = 0; i < p.ev.length; i++) if (p.ev[i].c === code) { cnt += 1; if (firstOfCode < 0) firstOfCode = i; }
      if (cnt >= 6) p.ev.splice(firstOfCode, 1);
      else if (p.ev.length >= 40) p.ev.shift();
      p.ev.push({ c: code, d: m.date, t: hm(m), x: snip(text) });
    }
    function flag(p, code, m, text) {
      p.signals[code] = (p.signals[code] || 0) + 1;
      var sd = p.sigDays[code] || (p.sigDays[code] = []); sd.push(dnum(m.date)); if (sd.length > 50) sd.shift();
      addEv(p, code, m, text);
    }
    function mentionTargets(text) {
      var out = [], re = /@([^\n@]{1,40})/g, mm;
      while ((mm = re.exec(text))) {
        if (!namesByLen) namesByLen = names.slice().sort(function (a, b) { return b.length - a.length; });
        var after = mm[1], hit = null;
        for (var i = 0; i < namesByLen.length; i++) { if (after.indexOf(namesByLen[i]) === 0) { hit = namesByLen[i]; break; } }
        if (!hit) { var h = headOf(after); if (byHead[h] && byHead[h].length === 1) hit = byHead[h][0]; }
        if (hit && out.indexOf(hit) < 0) out.push(hit);
      }
      return out;
    }
    function endRun(r) {
      if (r.switches >= 10 && r.n >= 20 && r.neg >= 2) {
        conflicts.push({ a: r.pair[0], b: r.pair[1], d: r.start.date, t: hm(r.start), n: r.n, neg: r.neg });
        r.pair.forEach(function (who, i) { flag(people[who], "conflict", r.start, r.pair[1 - i] + "님과 " + r.n + "번 주고받음, 부정 표현 " + r.neg + "번"); });
      }
    }

    // 다음 파일이 앞 파일과 겹치면(같은 대화를 다시 내보낸 파일, 나눠 올린 파일의 경계) 이미 받은 시각까지는 건너뛴다
    function beginFile() { boundary = { min: lastMin, sigs: curMinSigs }; curMinSigs = Object.create(null); for (var k in boundary.sigs) curMinSigs[k] = boundary.sigs[k]; }

    function add(m) {
      if (!m || !m.date || !m.kind) return;
      var mt = ts(m);
      if (boundary) {
        if (mt < boundary.min) return;
        if (mt === boundary.min) { var bs = sigOf(m); if (boundary.sigs[bs] > 0) { boundary.sigs[bs] -= 1; return; } }
        else boundary = null;
      }
      // 같은 분 안의 순서는 파일 순서(마지막 말과 나감이 같은 분이어도 앞뒤가 맞게)
      var t;
      if (mt > lastMin) { lastMin = mt; sub = 0; curMinSigs = Object.create(null); t = mt; }
      else if (mt === lastMin) { sub += 1; t = mt + Math.min(sub, 59999); }
      else t = mt;
      if (mt === lastMin) { var cs = sigOf(m); curMinSigs[cs] = (curMinSigs[cs] || 0) + 1; }
      if (isBot(m.name)) return;
      if (first === null) { first = m.date; fileStartT = t; }
      if (!lastDate || m.date > lastDate) lastDate = m.date;
      if (m.kind === "join" || m.kind === "leave") addEvent(m, t);
      else if (m.name) addMsg(m, t);
    }

    function addEvent(m, t) {
      var name = norm(m.name);
      var e = { kind: m.kind, name: name, how: m.how || "", by: m.by || "", date: m.date, t: t, hm: hm(m) };
      e.key = e.kind + "|" + e.date + "|" + e.hm + "|" + e.name;
      e.who = links[e.key] ? norm(links[e.key]) : name;
      e.via = links[e.key] ? "manual" : "name";
      events.push(e);
      (evByName[e.who] = evByName[e.who] || []).push(e);
      var r = M(m.date); if (e.kind === "join") r.joins += 1; else if (e.how === "kick") r.kicks += 1; else r.leaves += 1;
      if (e.kind === "join") recentJoins.push(e);
    }

    function addMsg(m, t) {
      var name = norm(m.name);
      var p = people[name];
      if (!p) {
        p = people[name] = {
          name: name, head: headOf(name), n: 0, kinds: { photo: 0, video: 0, emoticon: 0, link: 0, file: 0, voice: 0, deleted: 0 },
          textLen: 0, textN: 0, days: 0, lastDay: "", weeks: Object.create(null), night: 0,
          firstT: t, lastT: t, firstDate: m.date, lastDate: m.date, byDay: Object.create(null),
          starts: 0, replies: 0, welcomes: 0, thanksGiven: 0, thanksGot: 0, mentionsOut: Object.create(null), mentionsIn: 0,
          info: 0, meetup: 0, sig: [], signals: Object.create(null), sigDays: Object.create(null), mentionDays: Object.create(null), ev: [], floods: 0, maxGap: 0, fw: { ts: [], on: false }
        };
        names.push(name); (byHead[p.head] = byHead[p.head] || []).push(name); namesByLen = null;
      }
      // 들어옴, 나감 뒤 첫 말: 나감 뒤에 들어옴 줄 없이 다시 말하면 재입장, 들어온 뒤 7일 안의 첫 말
      var evs = evByName[name];
      if (evs && evs.length) {
        var le = evs[evs.length - 1];
        if (le.kind === "leave" && le.t > p.lastT && p.n > 0 && !le.gapAfter) le.gapAfter = m.date;
        for (var k = evs.length - 1; k >= 0; k--) { var j = evs[k]; if (j.kind !== "join") continue; if (j.spoke != null) break; j.spoke = t - j.t <= 7 * DAY; }
      }
      if (t < p.firstT) { p.firstT = t; p.firstDate = m.date; }
      if (t >= p.lastT) { var g = dnum(m.date) - dnum(p.lastDate); if (g > p.maxGap) p.maxGap = g; p.lastT = t; p.lastDate = m.date; }
      p.n += 1; totalN += 1;
      if (p.kinds[m.kind] != null) p.kinds[m.kind] += 1;
      if (m.kind === "text" || m.kind === "link") { p.textLen += m.len || 0; p.textN += 1; }
      if (p.lastDay !== m.date) { if (!p.byDay[m.date]) p.days += 1; p.lastDay = m.date; }
      p.weeks[Math.floor(dnum(m.date) / 7)] = 1;
      p.byDay[m.date] = (p.byDay[m.date] || 0) + 1;
      if (m.hour >= 1 && m.hour < 5) p.night += 1;
      if (p.sig.length < 12) p.sig.push(m.date + "|" + hm(m) + "|" + m.kind + "|" + (m.len || 0));
      var mo = M(m.date); mo.msgs += 1; mo.speakers[name] = 1;
      hours[m.hour] += 1; weekdays[m.weekday] += 1;
      var gm = gridM[m.date.slice(0, 7)] || (gridM[m.date.slice(0, 7)] = new Array(168).fill(0)); gm[m.weekday * 24 + m.hour] += 1;

      while (recentJoins.length && t - recentJoins[0].t > 60 * 60000) recentJoins.shift();
      // 답 없는 질문: 30분 안에 다른 사람의 말이 오면 답
      if (pendingQ.length) {
        var keep = [];
        pendingQ.forEach(function (q) { if (t - q.t > 30 * 60000) unanswered.push(q.o); else if (q.name !== name) { /* 답함 */ } else keep.push(q); });
        pendingQ = keep;
      }
      var gap = prev ? (t - prev.t) / 60000 : Infinity;
      if (gap >= 60) p.starts += 1;
      else if (prev && prev.name !== name && gap <= 5) p.replies += 1;
      var text = m.kind === "text" || m.kind === "link" ? String(m.text || "") : "";
      var neg = 0;
      if (text) {
        if (recentJoins.length && RE_WELCOME.test(text)) {
          recentJoins.forEach(function (j) { if (j.name !== name && headOf(j.name) !== p.head) { j.welcomed = true; if (!j.welcomers) j.welcomers = Object.create(null); if (!j.welcomers[name]) { j.welcomers[name] = 1; p.welcomes += 1; } } });
        }
        var targets = text.indexOf("@") >= 0 ? mentionTargets(text).filter(function (n) { return n !== name; }) : [];
        targets.forEach(function (n) { p.mentionsOut[n] = (p.mentionsOut[n] || 0) + 1; people[n].mentionsIn += 1; var md = p.mentionDays[n] || (p.mentionDays[n] = []); md.push(dnum(m.date)); if (md.length > 60) md.shift(); });
        if (RE_THANKS.test(text)) {
          p.thanksGiven += 1;
          targets.forEach(function (n) { people[n].thanksGot += 1; });
          // 멘션 없이 감사하면 바로 앞 다른 사람의 말(5분 안)에 대한 감사로 본다
          if (!targets.length && prev && prev.name !== name && gap <= 5) people[prev.name].thanksGot += 1;
        }
        if (RE_MEETUP.test(text)) { p.meetup += 1; addEv(p, "meetup", m, text); }
        if (m.kind === "link" || RE_INFO.test(text)) p.info += 1;
        var plain = text.indexOf("http") >= 0 ? text.replace(/https?:\/\/\S+/g, " ") : text;
        for (var code in SIG) { var sg = SIG[code], tx2 = sg.url ? text : plain; if (sg.re.test(tx2) && !(sg.not && sg.not.test(tx2))) flag(p, code, m, text); }
        if (RE_QUESTION.test(text.trim())) pendingQ.push({ t: t, name: name, o: { d: m.date, t: hm(m), hour: m.hour, name: name, x: snip(text) } });
        neg = RE_NEG.test(text) || SIG.abuse.re.test(text) ? 1 : 0;
      }
      if (m.kind === "deleted") flag(p, "deleted", m, "삭제된 메시지");
      // 도배: 같은 사람 3분 안에 30건 이상(실제 대화에서 20건은 흔한 빠른 대화였다)(한 번 걸리면 그 묶음이 끝날 때까지 한 번만)
      var w = p.fw; w.ts.push(t); while (w.ts.length && t - w.ts[0] > 3 * 60000) w.ts.shift();
      if (w.ts.length >= 30 && !w.on) { w.on = true; p.floods += 1; flag(p, "flood", m, "3분 안에 " + w.ts.length + "건 이상"); }
      if (w.ts.length < 10) w.on = false;
      // 감정싸움 후보: 두 사람이 2분 간격 안으로 번갈아 10번 넘게, 20건 넘게 주고받고 부정 표현이 2번 이상
      if (prev) {
        var ok = t - prev.t <= 2 * 60000;
        if (run && ok && (run.pair[0] === name || run.pair[1] === name)) { run.n += 1; run.neg += neg; if (name !== run.last) { run.switches += 1; run.last = name; } }
        else { if (run) endRun(run); run = ok && prev.name !== name ? { pair: [prev.name, name], n: 2, switches: 1, neg: prev.neg + neg, start: prev.m, last: name } : null; }
      }
      prev = { t: t, name: name, neg: neg, m: { date: m.date, hour: m.hour, min: m.min } };
    }

    function addSys(s) {
      if (!s) return;
      var k = s.date + "|" + s.hour + "|" + s.min + "|" + s.text;
      if (sysSeen[k]) return; sysSeen[k] = 1;
      sysCount[s.type] = (sysCount[s.type] || 0) + 1;
      var tx = String(s.text || "");
      if (s.type === "hidden") { var n = +((tx.match(/(\d+)개의/) || [])[1] || 1); hiddenMsgs += n; if (s.date) M(s.date).hidden += n; }
      var r;
      if ((r = tx.match(/^(.+?)님이\s*부방장이\s*되었습니다/))) roles.push({ d: s.date, name: norm(r[1]), act: "sub_on" });
      else if ((r = tx.match(/^(.+?)님이\s*부방장에서\s*해제되었습니다/))) roles.push({ d: s.date, name: norm(r[1]), act: "sub_off" });
      else if ((r = tx.match(/^방장이\s*(.+?)님에서\s*(.+?)님으로\s*변경되었습니다/))) roles.push({ d: s.date, name: norm(r[2]), from: norm(r[1]), act: "owner" });
      if (s.type === "other" && unread.length < 50) unread.push({ d: s.date, x: tx.slice(0, 80) });
    }

    function finish() {
      if (!first) return null;
      if (run) endRun(run);
      pendingQ.forEach(function (q) { unanswered.push(q.o); });
      var endN = dnum(lastDate);
      // 지금 방장, 부방장
      var owner = "", subs = Object.create(null);
      roles.slice().sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; }).forEach(function (r) { if (r.act === "owner") { owner = r.name; delete subs[r.name]; } else if (r.act === "sub_on") subs[r.name] = 1; else if (r.act === "sub_off") delete subs[r.name]; });
      var ledger = names.map(function (n) {
        var p = people[n];
        var evs = evByName[n] || [];
        var joins = evs.filter(function (e) { return e.kind === "join"; });
        var leaves = evs.filter(function (e) { return e.kind === "leave"; });
        var re = [];
        // 앞선 머묾(일): 바로 앞 들어옴에서 그 뒤 나감까지. 하루 안에 드나든 것인지 보려고 붙인다
        var stayBefore = function (t) {
          var l = null, j0 = null;
          for (var i = evs.length - 1; i >= 0; i--) { var e = evs[i]; if (e.t >= t) continue; if (!l) { if (e.kind === "leave") l = e; else break; } else if (e.kind === "join") { j0 = e; break; } }
          return l && j0 ? Math.floor((l.t - j0.t) / DAY) : null;
        };
        joins.forEach(function (j) {
          var spokeBefore = p.firstT < j.t;
          var leftBefore = leaves.some(function (l) { return l.t < j.t; });
          if (spokeBefore || leftBefore) re.push({ d: j.date, via: j.via, name: j.name, stay: stayBefore(j.t), key: j.key });
        });
        // 나감 줄 뒤에 들어옴 줄 없이 다시 말했으면 들어옴 줄 없는 재입장
        leaves.forEach(function (l) { if (l.gapAfter && !joins.some(function (j) { return j.t > l.t && j.date <= l.gapAfter; })) re.push({ d: l.gapAfter, via: "gap", name: "", stay: stayBefore(l.t + 1), key: l.key + "|gap" }); });
        var lastLeave = leaves.length ? leaves[leaves.length - 1] : null;
        var lastJoin = joins.length ? joins[joins.length - 1] : null;
        var out = lastLeave && lastLeave.t > p.lastT && (!lastJoin || lastLeave.t > lastJoin.t);
        var status = out ? (lastLeave.how === "kick" ? "kicked" : "left") : "in";
        var joinedAt = lastJoin ? lastJoin.date : "";
        // 내보낸 뒤 다시 들어온 때(규칙 기준일과 견주려고 날짜를 남긴다)
        var kickReturns = [];
        leaves.forEach(function (l) {
          if (l.how !== "kick") return;
          var back = null; for (var i = 0; i < joins.length; i++) if (joins[i].t > l.t) { back = joins[i].date; break; }
          if (!back && l.gapAfter) back = l.gapAfter;
          if (back) kickReturns.push({ kick: l.date, back: back });
        });
        var kickedThenBack = kickReturns.length > 0;
        var sysNames = evs.map(function (e) { return e.name; }).filter(function (x, i, a) { return x !== n && a.indexOf(x) === i; });
        var roleHist = roles.filter(function (r) { return r.name === n || r.from === n; }).map(function (r) { return { d: r.d, act: r.name === n ? r.act : "owner_off" }; });
        var parts = nickParts(n);
        var inWin = function (days) { var from = endN - days + 1, c = 0; for (var d in p.byDay) if (dnum(d) >= from) c += p.byDay[d]; return c; };
        var d30 = inWin(30), d60 = inWin(60), d90 = inWin(90), d7 = inWin(7);
        // 최근 12주 주별 메시지(시트의 작은 추이 선)
        var wk = new Array(12).fill(0);
        for (var dd in p.byDay) { var wi = Math.floor((endN - dnum(dd)) / 7); if (wi >= 0 && wi < 12) wk[11 - wi] += p.byDay[dd]; }
        var prev60 = d90 - d30;
        var flags = [];
        function F(code, level, label, extra) { flags.push({ c: code, l: level, t: label, x: extra || "" }); }
        if (!parts.ok) F("fmt", "rule", "닉네임 양식", parts.issues.join(", "));
        if (joinedAt && parts.day) {
          var real = joinedAt.slice(5, 7) + joinedAt.slice(8, 10);
          var diff = Math.abs(dnum(joinedAt) - dnum(joinedAt.slice(0, 4) + "-" + parts.day.slice(0, 2) + "-" + parts.day.slice(2)));
          if (real !== parts.day && diff > 1) F("day", "info", "닉네임 입장일과 실제가 다름", "닉네임 " + parts.day + ", 실제 들어옴 " + dot(joinedAt));
        }
        var limit = parts.reentryLimit || null;
        if (re.length && limit != null && re.length > limit) F("reentry", "rule", "재입장 한도 초과", re.length + "회, 한도 " + limit + "회");
        else if (re.length) F("reentry_info", "info", "재입장 " + re.length + "회", re.length + "회, " + (limit != null ? "한도 " + limit + "회" : "출생연도를 몰라 한도 판정 못 함"));
        if (kickedThenBack) F("kick_return", "rule", "내보낸 뒤 다시 들어옴");
        if (p.kinds.deleted) F("deleted", "rule", "메시지 삭제", p.kinds.deleted + "회");
        if (sysNames.length) F("names", "info", "다른 이름 기록", sysNames.join(", "));
        // 살필 신호는 최근 90일 안에 있을 때만 올린다(전체 기간 수는 함께 보여 주고, 확인함은 전체 수로 맞춘다)
        var recent = function (code, days) { var a = p.sigDays[code] || [], c = 0; for (var i = 0; i < a.length; i++) if (a[i] > endN - days) c += 1; return c; };
        var W = function (code, label) { var r90 = recent(code, 90), all = p.signals[code] || 0; if (r90) { F(code, "watch", label, "최근 90일 " + r90 + "회, 전체 " + all + "회"); flags[flags.length - 1].k = all + "회"; } };
        Object.keys(SIG).forEach(function (code) { W(code, SIG[code].label); });
        W("flood", "도배"); W("conflict", "감정싸움 후보");
        var inDays = function (a, days) { var c = 0; (a || []).forEach(function (d) { if (d > endN - days) c += 1; }); return c; };
        Object.keys(p.mentionDays).forEach(function (to) {
          var c30 = inDays(p.mentionDays[to], 30), back = people[to] ? inDays(people[to].mentionDays[n], 30) : 0;
          if (c30 >= 10 && back <= 2) { F("mention_focus", "watch", "한 사람에게 쏠린 멘션", "최근 30일 " + to + "님에게 " + c30 + "회"); flags[flags.length - 1].k = to; }
        });
        if (status === "in" && prev60 >= 20 && d30 < (prev60 / 2) * 0.3) F("drop", "watch", "대화 급감", "최근 30일 " + d30 + "건, 그 전 60일 " + prev60 + "건");
        if (status === "in" && endN - dnum(p.lastDate) > 60) F("silent", "watch", "60일 넘게 대화 없음", "마지막 " + dot(p.lastDate));
        if (p.welcomes >= 3) F("welcomer", "good", "신입 환영", p.welcomes + "번");
        if (p.thanksGot >= 3) F("thanked", "good", "감사 받음", p.thanksGot + "번");
        if (p.meetup >= 2) F("organizer", "good", "모임 제안", p.meetup + "번");
        if (p.info >= 5) F("sharer", "good", "정보 공유", p.info + "번");
        var weeks = Object.keys(p.weeks).map(Number).sort(function (a, b) { return a - b; });
        var streak = 0, best = 0; weeks.forEach(function (w, i) { streak = i && w === weeks[i - 1] + 1 ? streak + 1 : 1; if (streak > best) best = streak; });
        if (best >= 8) F("steady", "good", "꾸준함", best + "주 연속");
        return {
          name: n, head: p.head, dflt: isDefaultName(n), parts: { region: parts.region, sex: parts.sex, birth: parts.birth, birthYear: parts.birthYear || null, day: parts.day, heart: parts.heart, heartKind: parts.heartKind },
          fmtOk: parts.ok, fmtIssues: parts.issues, limit: limit,
          status: status, outDate: out ? lastLeave.date : "", outBy: out && lastLeave.by ? lastLeave.by : "", joinedAt: joinedAt, firstJoin: joins.length ? joins[0].date : "", joins: joins.length, joinedBeforeFile: !lastJoin && p.firstT <= fileStartT + 7 * DAY, kickedThenBack: kickedThenBack, kickReturns: kickReturns,
          role: owner === n && status === "in" ? "owner" : subs[n] && status === "in" ? "sub" : "", roles: roleHist,
          reentries: re.sort(function (a, b) { return a.d < b.d ? -1 : 1; }), sysNames: sysNames,
          events: evs.slice(-40).map(function (e) { return { k: e.kind, d: e.date, t: e.hm, how: e.how, by: e.by, name: e.name, via: e.via, key: e.key }; }),
          first: p.firstDate, last: p.lastDate, n: p.n, d7: d7, d30: d30, d60: d60, d90: d90, wk: wk, activeDays: p.days, maxGap: p.maxGap,
          kinds: p.kinds, avgLen: p.textN ? Math.round(p.textLen / p.textN) : 0, nightShare: p.n ? Math.round((p.night / p.n) * 100) : 0,
          starts: p.starts, replies: p.replies, welcomes: p.welcomes, thanksGot: p.thanksGot, thanksGiven: p.thanksGiven,
          mentionsIn: p.mentionsIn, mentionsOut: Object.keys(p.mentionsOut).map(function (k) { return { to: k, c: p.mentionsOut[k] }; }).sort(function (a, b) { return b.c - a.c; }).slice(0, 5),
          meetup: p.meetup, info: p.info, share: totalN ? Math.round((p.n / totalN) * 1000) / 10 : 0,
          flags: flags, ev: p.ev,
          fp: hash(p.sig.slice(0, 8).join(";")), sig: p.sig
        };
      }).sort(function (a, b) { return b.n - a.n; });

      var monthList = Object.keys(months).sort().map(function (k) { var r = months[k]; return { m: k, joins: r.joins, leaves: r.leaves, kicks: r.kicks, net: r.joins - r.leaves - r.kicks, msgs: r.msgs, hidden: r.hidden, speakers: Object.keys(r.speakers).length }; });
      // 신입 흐름: 파일 안의 들어옴마다
      var joinsAll = events.filter(function (e) { return e.kind === "join"; });
      var funnel = { joined: joinsAll.length, spoke7: 0, stay30: 0, base30: 0, stay60: 0, base60: 0, stay90: 0, base90: 0, left7: 0, silentLeft: 0, welcomed: 0 };
      joinsAll.forEach(function (j) {
        if (j.welcomed) funnel.welcomed += 1;
        if (j.spoke) funnel.spoke7 += 1;
        var leaveAfter = null, evs = evByName[j.who] || [];
        for (var i = 0; i < evs.length; i++) if (evs[i].kind === "leave" && evs[i].t > j.t) { leaveAfter = evs[i]; break; }
        var jn = dnum(j.date);
        if (leaveAfter && dnum(leaveAfter.date) - jn <= 7) funnel.left7 += 1;
        if (leaveAfter && !people[j.who]) funnel.silentLeft += 1;
        [30, 60, 90].forEach(function (d) {
          if (jn + d > endN) return;
          funnel["base" + d] += 1;
          if (!leaveAfter || dnum(leaveAfter.date) > jn + d) funnel["stay" + d] += 1;
        });
      });
      var sortedN = ledger.map(function (r) { return r.n; }).sort(function (a, b) { return b - a; });
      var top10 = sortedN.slice(0, Math.max(1, Math.ceil(sortedN.length * 0.1))).reduce(function (a, b) { return a + b; }, 0);
      // 사람에게 잇지 못한 줄: 기본 프로필 이름은 수만 센다
      var unlinked = [], dflt = { lines: 0, joins: 0, leaves: 0, kicks: 0, names: 0 }, dNames = Object.create(null);
      events.forEach(function (e) {
        if (people[e.who]) return;
        if (isDefaultName(e.name)) { dflt.lines += 1; if (e.kind === "join") dflt.joins += 1; else if (e.how === "kick") dflt.kicks += 1; else dflt.leaves += 1; if (!dNames[e.name]) { dNames[e.name] = 1; dflt.names += 1; } return; }
        unlinked.push({ k: e.kind, d: e.date, t: e.hm, name: e.name, how: e.how, key: e.key });
      });
      return {
        v: 2,
        range: { from: first, to: lastDate },
        totals: { messages: totalN, people: ledger.length, joins: joinsAll.length, leaves: events.filter(function (e) { return e.kind === "leave" && e.how !== "kick"; }).length, kicks: events.filter(function (e) { return e.how === "kick"; }).length, hiddenMsgs: hiddenMsgs },
        inRoom: ledger.filter(function (r) { return r.status === "in"; }).length,
        months: monthList,
        funnel: funnel,
        unanswered: { count: unanswered.length, byHour: unanswered.reduce(function (a, q) { a[q.hour] += 1; return a; }, new Array(24).fill(0)), recent: unanswered.slice(-20) },
        conflicts: conflicts.slice(-30),
        concentration: totalN ? Math.round((top10 / totalN) * 100) : 0,
        hours: hours, weekdays: weekdays,
        grid: (function () {
          var ks = Object.keys(gridM).sort(), rec = ks.slice(-3), sum = function (list) { var g = new Array(168).fill(0); list.forEach(function (k) { gridM[k].forEach(function (v, i) { g[i] += v; }); }); return g; };
          return { recent: sum(rec), recentFrom: rec[0] || "", all: sum(ks) };
        })(),
        sys: sysCount, unread: unread,
        roles: roles.slice(-100), staff: { owner: ledger.some(function (r) { return r.role === "owner"; }) ? owner : "", subs: ledger.filter(function (r) { return r.role === "sub"; }).map(function (r) { return r.name; }) },
        unlinked: unlinked.slice(-2000), defaultNames: dflt,
        people: ledger
      };
    }
    return { beginFile: beginFile, add: add, addSys: addSys, finish: finish };
  }

  /* ── 배열로 받은 메시지(시험용): 시간순으로 정렬해 분석기에 넣는다 ── */
  function analyze(input) {
    var A = createAnalyzer({ links: input && input.links });
    var list = ((input && input.messages) || []).map(function (m, i) { return { m: m, i: i, t: ts(m) }; }).sort(function (a, b) { return a.t - b.t || a.i - b.i; });
    list.forEach(function (x) { A.add(x.m); });
    ((input && input.sys) || []).forEach(A.addSys);
    return A.finish();
  }

  /* ── 파일에서 바로: 조각씩 읽어 줄 단위로 끊고, 2만 줄씩 파싱해 분석기에 넣는다 ──
     여러 파일이면 첫 메시지 시각 순서로 읽고, 앞 파일과 겹치는 부분은 건너뛴다 */
  var RE_START = /^(\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*(오전|오후)|\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?\s*(오전|오후)|\[[^\]]+\]\s\[(오전|오후)|-{3,}\s*\d{4}년)/;
  var RE_PC_DAY = /^-{3,}\s*\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*[월화수목금토일]요일\s*-{3,}$/;
  function streamFile(file, onBatch, onBytes) {
    var CHUNK = 4 * 1024 * 1024, BATCH = 20000;
    var dec = new TextDecoder("utf-8");
    var carry = "", batch = [], pcDay = "", pcDayAtStart = "";
    function flush() {
      if (!batch.length) return;
      var headLine = pcDayAtStart && !RE_PC_DAY.test(batch[0].trim()) ? pcDayAtStart + "\n" : "";
      onBatch(headLine + batch.join("\n"));
      batch = []; pcDayAtStart = pcDay;
    }
    function eat(lines) {
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (batch.length >= BATCH && RE_START.test(line)) flush();
        batch.push(line);
        if (line.charCodeAt(0) === 45 && RE_PC_DAY.test(line.trim())) pcDay = line;
      }
    }
    var pos = 0;
    function step() {
      if (pos >= file.size) { if (carry) eat([carry]); carry = ""; flush(); return Promise.resolve(); }
      var end = Math.min(file.size, pos + CHUNK);
      return file.slice(pos, end).arrayBuffer().then(function (buf) {
        var text = carry + dec.decode(new Uint8Array(buf), { stream: end < file.size });
        var lines = text.split("\n");
        carry = lines.pop();
        for (var i = 0; i < lines.length; i++) if (lines[i].charCodeAt(lines[i].length - 1) === 13) lines[i] = lines[i].slice(0, -1);
        eat(lines);
        pos = end;
        if (onBytes) onBytes(end);
        return step();
      });
    }
    return step();
  }
  function firstTime(file) {
    return file.slice(0, 256 * 1024).arrayBuffer().then(function (buf) {
      var text = new TextDecoder("utf-8").decode(new Uint8Array(buf));
      var r = P.parse(text.slice(0, text.lastIndexOf("\n") + 1));
      return r.messages.length ? ts(r.messages[0]) : Infinity;
    });
  }
  function runFiles(files, opts) {
    opts = opts || {};
    P = P || global.ChatParser;
    var list = Array.prototype.slice.call(files || []);
    var A = createAnalyzer({ links: opts.links });
    var total = list.reduce(function (a, f) { return a + f.size; }, 0) || 1, done = 0;
    return Promise.all(list.map(firstTime)).then(function (t0) {
      var order = list.map(function (f, i) { return { f: f, t0: t0[i] }; }).sort(function (a, b) { return a.t0 - b.t0 || b.f.size - a.f.size; });   // 시작이 같으면 큰 파일(나중에 내보낸 파일)부터
      var chain = Promise.resolve();
      order.forEach(function (o) {
        chain = chain.then(function () {
          A.beginFile();
          return streamFile(o.f, function (text) {
            var r = P.parse(text, { keepSystem: true });
            for (var i = 0; i < r.messages.length; i++) A.add(r.messages[i]);
            (r.meta.sys || []).forEach(A.addSys);
          }, function (bytes) { if (opts.onProgress) opts.onProgress((done + bytes) / total); }).then(function () { done += o.f.size; });
        });
      });
      return chain.then(function () { return A.finish(); });
    });
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

  var OpsAnalyzer = { analyze: analyze, createAnalyzer: createAnalyzer, runFiles: runFiles, nickParts: nickParts, isBot: isBot, isDefaultName: isDefaultName, matchPrevious: matchPrevious, SIG: SIG };
  global.OpsAnalyzer = OpsAnalyzer;
  if (typeof module !== "undefined" && module.exports) module.exports = OpsAnalyzer;
})(typeof window !== "undefined" ? window : globalThis);
