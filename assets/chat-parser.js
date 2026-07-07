/* ============================================================
   chat-parser.js — 카카오톡 대화 내보내기(.txt) 파서 + 집계
   · 브라우저: window.ChatParser / node: module.exports
   · 지원 포맷(자동 감지, 한 텍스트에 섞여 있어도 동작):
     - Android: "2026년 6월 1일 오후 9:03, 닉네임 : 메시지"
     - iOS:     "2026. 6. 1. 오후 9:03, 닉네임 : 메시지"
     - PC:      "--------------- 2026년 6월 1일 월요일 ---------------"
                "[닉네임] [오후 9:03] 메시지"
   · 개인정보: parse() 가 내부적으로 text 를 들고 있는 것은
     aggregate() 의 키워드 추출용일 뿐, aggregate() 결과(통계 JSON)에는
     대화 원문 문장이 절대 포함되지 않는다.
   ============================================================ */
(function (global) {
  "use strict";

  /* ── 정규식 ─────────────────────────────────────────────── */
  // Android 메시지: 2026년 6월 1일 오후 9:03, 닉네임 : 메시지
  var RE_ANDROID_MSG = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s:\s([\s\S]*)$/;
  // Android 시스템/날짜 행: 2026년 6월 1일 오후 9:03, 누구님이 들어왔습니다.
  var RE_ANDROID_SYS = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2}),?\s*(.*)$/;
  // iOS 메시지: 2026. 6. 1. 오후 9:03, 닉네임 : 메시지
  var RE_IOS_MSG = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s:\s([\s\S]*)$/;
  var RE_IOS_SYS = /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(오전|오후)\s*(\d{1,2}):(\d{2}),?\s*(.*)$/;
  // PC 날짜 구분선: --------------- 2026년 6월 1일 월요일 ---------------
  var RE_PC_DATE = /^-{3,}\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*[월화수목금토일]요일\s*-{3,}$/;
  // PC 메시지: [닉네임] [오후 9:03] 메시지
  var RE_PC_MSG = /^\[(.+?)\]\s\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s?([\s\S]*)$/;
  // 날짜만 있는 행 (Android/iOS 날짜 변경선)
  var RE_DATE_ONLY = /^(\d{4})(?:년|\.)\s*(\d{1,2})(?:월|\.)\s*(\d{1,2})(?:일|\.?)\s*([월화수목금토일]요일)?\s*$/;
  // 파일 머리말
  var RE_HEADER = /(카카오톡\s*대화|^저장한\s*날짜\s*[:：])/;

  // 시스템 메시지
  var RE_JOIN = /님이\s*들어왔습니다|님을\s*초대했습니다|님이\s*초대되었습니다/;
  var RE_LEAVE = /님이\s*나갔습니다|님을\s*내보냈습니다/;
  var RE_SYS_ETC = /^(채팅방\s*관리자가|운영정책을|메시지가\s*가려졌습니다|채팅방\s*이름을|공지가\s*등록되었습니다)/;

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function toDateStr(y, m, d) { return y + "-" + pad2(+m) + "-" + pad2(+d); }

  // 오전/오후 h:mm → 0~23 (오후 12시=12, 오전 12시=0)
  function toHour24(ampm, h) {
    h = +h;
    if (ampm === "오후") return h === 12 ? 12 : h + 12;
    return h === 12 ? 0 : h;
  }

  // 0=월 … 6=일
  function weekdayOf(dateStr) {
    var p = dateStr.split("-");
    var js = new Date(+p[0], +p[1] - 1, +p[2]).getDay(); // 0=일
    return (js + 6) % 7;
  }

  /* ── 메시지 종류 분류 ───────────────────────────────────── */
  function classify(text) {
    var t = String(text || "").trim();
    if (/^사진(\s*\d+\s*장)?$/.test(t)) return "photo";
    if (/^동영상$/.test(t)) return "video";
    if (/^이모티콘$/.test(t)) return "emoticon";
    if (/^파일[:：]?\s/.test(t) || /^파일$/.test(t)) return "file";
    if (/^음성\s*메시지$/.test(t) || /^음성메시지$/.test(t)) return "voice";
    if (/^삭제된 메시지입니다\.?$/.test(t)) return "deleted";
    if (/https?:\/\//.test(t) || /\bwww\./.test(t)) return "link";
    return "text";
  }

  /* ── parse ──────────────────────────────────────────────── */
  // 반환: { messages:[{date,hour,weekday,name,kind,len,text}], meta:{joins,leaves,format} }
  // · 입장/퇴장 이벤트는 kind:"join"/"leave" 로 messages 에 포함되지만
  //   (기간별 새 멤버 집계용) aggregate() 는 이를 일반 메시지로 세지 않는다.
  // · 퇴장/강퇴는 개수만 세고 누가 나갔는지는 어디에도 남기지 않는다.
  function parse(rawText) {
    var lines = String(rawText || "").replace(/\r\n?/g, "\n").split("\n");
    var messages = [];
    var meta = { joins: 0, leaves: 0, format: "unknown" };
    var counts = { android: 0, ios: 0, pc: 0 };
    var curDate = null; // PC 포맷용 현재 날짜
    var last = null;    // 멀티라인 연속용 직전 메시지

    function pushMsg(dateStr, hour, name, body) {
      var kind = classify(body);
      var msg = {
        date: dateStr,
        hour: hour,
        weekday: weekdayOf(dateStr),
        name: String(name).trim(),
        kind: kind,
        len: kind === "text" || kind === "link" ? String(body).length : 0,
        text: kind === "text" || kind === "link" ? String(body) : ""
      };
      messages.push(msg);
      last = msg;
    }

    function pushSystem(dateStr, hour, body) {
      var kind = null;
      if (RE_JOIN.test(body)) { meta.joins += 1; kind = "join"; }
      else if (RE_LEAVE.test(body)) { meta.leaves += 1; kind = "leave"; }
      if (kind && dateStr) {
        messages.push({
          date: dateStr, hour: hour == null ? 12 : hour, weekday: weekdayOf(dateStr),
          name: "", kind: kind, len: 0, text: ""
        });
      }
      last = null; // 시스템 행 뒤의 프리픽스 없는 줄은 이어붙이지 않음
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var t = line.trim();
      if (!t) { last = null; continue; }

      var m;

      // 1) PC 날짜 구분선
      m = t.match(RE_PC_DATE);
      if (m) { curDate = toDateStr(m[1], m[2], m[3]); counts.pc += 0.5; last = null; continue; }

      // 2) 파일 머리말
      if (RE_HEADER.test(t) && !RE_ANDROID_MSG.test(t) && !RE_IOS_MSG.test(t) && !RE_PC_MSG.test(t)) {
        last = null; continue;
      }

      // 3) Android 메시지
      m = line.match(RE_ANDROID_MSG);
      if (m) {
        var d1 = toDateStr(m[1], m[2], m[3]);
        curDate = d1; counts.android += 1;
        pushMsg(d1, toHour24(m[4], m[5]), m[7], m[8]);
        continue;
      }

      // 4) iOS 메시지
      m = line.match(RE_IOS_MSG);
      if (m) {
        var d2 = toDateStr(m[1], m[2], m[3]);
        curDate = d2; counts.ios += 1;
        pushMsg(d2, toHour24(m[4], m[5]), m[7], m[8]);
        continue;
      }

      // 5) PC 메시지 (날짜 구분선 이후에만 유효)
      m = line.match(RE_PC_MSG);
      if (m && curDate) {
        counts.pc += 1;
        pushMsg(curDate, toHour24(m[2], m[3]), m[1], m[5]);
        continue;
      }

      // 6) Android/iOS 시스템 행 (날짜+시각 프리픽스는 있지만 " : " 가 없는 행)
      m = t.match(RE_ANDROID_SYS) || t.match(RE_IOS_SYS);
      if (m) {
        var d3 = toDateStr(m[1], m[2], m[3]);
        curDate = d3;
        pushSystem(d3, toHour24(m[4], m[5]), m[7] || "");
        continue;
      }

      // 7) 날짜만 있는 행 (날짜 변경선)
      m = t.match(RE_DATE_ONLY);
      if (m) { curDate = toDateStr(m[1], m[2], m[3]); last = null; continue; }

      // 8) 프리픽스 없는 시스템 행 (PC 포맷의 입장/퇴장 등)
      if (RE_JOIN.test(t) || RE_LEAVE.test(t)) { pushSystem(curDate, null, t); continue; }
      if (RE_SYS_ETC.test(t)) { last = null; continue; }

      // 9) 그 외: 직전 메시지의 연속(멀티라인)
      if (last && (last.kind === "text" || last.kind === "link")) {
        last.text += "\n" + line;
        last.len = last.text.length;
        if (last.kind === "text" && classify(line) === "link") last.kind = "link";
      }
      // 직전 메시지가 없으면(파일 맨 앞의 잡음 등) 조용히 무시
    }

    var best = "unknown", bestN = 0, mixed = 0;
    ["android", "ios", "pc"].forEach(function (k) {
      if (counts[k] > 0) mixed += 1;
      if (counts[k] > bestN) { bestN = counts[k]; best = k; }
    });
    meta.format = mixed > 1 ? "mixed" : best;
    return { messages: messages, meta: meta };
  }

  /* ── 키워드 추출 ────────────────────────────────────────── */
  var STOPWORDS = [
    // 접속/부사/감탄
    "그리고", "그래서", "그러면", "그런데", "근데", "그럼", "그냥", "진짜", "정말", "완전",
    "너무", "엄청", "되게", "약간", "조금", "좀더", "많이", "빨리", "일단", "혹시", "아마",
    "역시", "다시", "계속", "바로", "이제", "아직", "벌써", "먼저", "같이", "함께", "서로",
    "제일", "가장", "특히", "그때", "이때", "요즘", "최근", "당장", "매우", "무조건",
    // 대명사/의존명사
    "저희", "우리", "제가", "저는", "저도", "너희", "니가", "네가", "누구", "여기", "저기",
    "거기", "어디", "이거", "그거", "저거", "이건", "그건", "저건", "이게", "그게", "저게",
    "뭔가", "뭐지", "뭐야", "그렇게", "이렇게", "저렇게", "어떻게", "얼마나", "때문", "정도",
    "경우", "자체", "동안", "만큼", "수도", "수가", "다들", "모두", "전부", "혼자", "자기",
    // 시간 일반어
    "오늘", "내일", "어제", "모레", "지금", "아까", "이따", "이번", "저번", "다음", "지난",
    "올해", "작년", "내년", "이번주", "다음주", "저번주", "주말", "평일", "요일", "시간",
    "오전", "오후", "저녁", "아침", "점심", "새벽", "하루", "이틀",
    // 동사/형용사 활용 빈출
    "하는", "하고", "하면", "해서", "해요", "했어", "했어요", "합니다", "하네요", "하죠",
    "하니까", "할게요", "할까요", "하세요", "됩니다", "되는", "되면", "돼요", "됐어요",
    "있는", "있어요", "있으면", "있네요", "없는", "없어요", "같아요", "같은", "같이가요",
    "좋아요", "좋은", "좋네요", "싫어요", "가는", "가요", "가서", "갈게요", "갑니다",
    "와요", "왔어요", "올게요", "봐요", "봤어요", "볼게요", "보면", "보고", "주세요",
    "드려요", "드립니다", "합니당", "해주세요", "부탁드려요", "감사합니다", "감사해요",
    "고마워요", "죄송해요", "죄송합니다", "안녕하세요", "반갑습니다", "반가워요",
    "환영해요", "환영합니다", "축하해요", "축하합니다", "고생하셨습니다", "수고하셨습니다",
    "괜찮아요", "괜찮은", "아니에요", "아닌데", "아니고", "아니라", "맞아요", "맞네요",
    "그래요", "그러네요", "그렇죠", "그니까", "그러니까", "글쿤요", "그렇군요",
    // 채팅 빈출 잡어
    "ㅋㅋㅋ", "ㅎㅎㅎ", "ㅠㅠㅠ", "네네", "넵넵", "넹넹", "누가", "무슨", "어떤", "몇시",
    "몇명", "인원", "이상", "이하", "가능", "불가", "확인", "혹은", "또는", "그중", "중에",
    "한테", "에게", "부터", "까지", "처럼", "보다", "대신", "말고", "빼고", "포함",
    "the", "and", "for", "you", "that", "this", "with", "are", "was", "have", "not"
  ];

  var PARTICLES = [
    "에서는", "에서도", "이라고", "라고요", "인데요", "이에요", "예요", "이라", "라고",
    "에서", "으로", "이랑", "하고", "한테", "에게", "부터", "까지", "처럼", "보다",
    "은", "는", "이", "가", "을", "를", "도", "만", "의", "에", "와", "과", "랑", "로",
    "요", "죠", "님", "들", "께", "임"
  ];

  function stripParticle(word) {
    if (!/[가-힣]$/.test(word)) return word;
    for (var i = 0; i < PARTICLES.length; i++) {
      var p = PARTICLES[i];
      if (word.length - p.length >= 2 && word.slice(-p.length) === p) {
        return word.slice(0, -p.length);
      }
    }
    return word;
  }

  function extractKeywords(msgs, memberNames, limit, extraStop) {
    var stop = Object.create(null);
    STOPWORDS.forEach(function (w) { stop[w] = 1; });
    (extraStop || []).forEach(function (w) { if (w) stop[String(w).toLowerCase()] = 1; });
    // 닉네임과 닉네임 구성 토큰 제거
    (memberNames || []).forEach(function (n) {
      stop[String(n).toLowerCase()] = 1;
      String(n).split(/\s+/).forEach(function (tok) {
        if (tok.length >= 2) stop[tok.toLowerCase()] = 1;
      });
    });

    var freq = Object.create(null);
    msgs.forEach(function (msg) {
      if (msg.kind !== "text") return; // 시스템/미디어/링크 제외
      var tokens = String(msg.text).match(/[가-힣a-zA-Z]{2,}/g);
      if (!tokens) return;
      tokens.forEach(function (raw) {
        var w = stripParticle(raw);
        if (w.length < 2) return;
        // 한 글자 반복(ㅋㅋ류는 자모라 이미 제외) / 같은 글자 반복어 제거
        if (/^(.)\1+$/.test(w)) return;
        var key = /[a-zA-Z]/.test(w) ? w.toLowerCase() : w;
        if (stop[key] || stop[raw.toLowerCase ? raw.toLowerCase() : raw]) return;
        freq[key] = (freq[key] || 0) + 1;
      });
    });

    return Object.keys(freq)
      .map(function (w) { return { w: w, c: freq[w] }; })
      .filter(function (k) { return k.c >= 2; })
      .sort(function (a, b) { return b.c - a.c || (a.w < b.w ? -1 : 1); })
      .slice(0, limit || 30);
  }

  /* ── 날짜 유틸 ──────────────────────────────────────────── */
  function addDays(dateStr, n) {
    var p = dateStr.split("-");
    var dt = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return toDateStr(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }

  function dayDiff(a, b) { // b - a (일 수)
    var pa = a.split("-"), pb = b.split("-");
    return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  }

  function autoPeriodLabel(from, to) {
    var pf = from.split("-"), pt = to.split("-");
    var lastDay = new Date(+pt[0], +pt[1], 0).getDate();
    if (pf[0] === pt[0] && pf[1] === pt[1] && +pf[2] === 1 && +pt[2] === lastDay) {
      return +pf[0] + "년 " + (+pf[1]) + "월";
    }
    if (pf[0] === pt[0] && pf[1] === pt[1] && pf[2] === pt[2]) {
      return +pf[0] + "년 " + (+pf[1]) + "월 " + (+pf[2]) + "일";
    }
    return (+pf[0]) + "." + (+pf[1]) + "." + (+pf[2]) + " ~ " + (+pt[0]) + "." + (+pt[1]) + "." + (+pt[2]);
  }

  function longestStreak(datesSet) {
    var dates = Object.keys(datesSet).sort();
    var best = 0, run = 0, prev = null;
    dates.forEach(function (d) {
      run = (prev && dayDiff(prev, d) === 1) ? run + 1 : 1;
      if (run > best) best = run;
      prev = d;
    });
    return best;
  }

  /* ── aggregate ──────────────────────────────────────────── */
  // opts: { from, to ("YYYY-MM-DD"), exclude:[닉네임], keywordLimit,
  //         periodLabel(강제 라벨), dropKeywords:[단어] }
  // 반환 통계 JSON — 대화 원문 문장은 포함하지 않는다.
  function aggregate(allMessages, opts) {
    opts = opts || {};
    var exclude = Object.create(null);
    (opts.exclude || []).forEach(function (n) { exclude[String(n).trim()] = 1; });

    var inRange = function (d) {
      if (opts.from && d < opts.from) return false;
      if (opts.to && d > opts.to) return false;
      return true;
    };

    var msgs = [];   // 일반 메시지(집계 대상)
    var joins = 0;
    (allMessages || []).forEach(function (m) {
      if (!m || !m.date || !inRange(m.date)) return;
      if (m.kind === "join") { joins += 1; return; }
      if (m.kind === "leave") return; // 공개 통계 미포함(운영 민감 정보)
      if (exclude[m.name]) return;
      msgs.push(m);
    });

    var empty = {
      v: 1, periodLabel: opts.periodLabel || "", range: { from: opts.from || "", to: opts.to || "" },
      generatedAt: new Date().toISOString(),
      totals: { messages: 0, activeMembers: 0, days: 0, avgPerDay: 0, newMembers: joins, photos: 0, videos: 0, emoticons: 0, links: 0 },
      members: [], hourly: zeros(24), weekdays: zeros(7), heatmap: grid7x24(), daily: [],
      peaks: { bestDay: null, quietDay: null, bestHour: null }, keywords: []
    };
    if (!msgs.length) return empty;

    // 실제 데이터 범위
    var minD = msgs[0].date, maxD = msgs[0].date;
    msgs.forEach(function (m) { if (m.date < minD) minD = m.date; if (m.date > maxD) maxD = m.date; });
    var from = opts.from || minD, to = opts.to || maxD;

    var hourly = zeros(24), weekdays = zeros(7), heatmap = grid7x24();
    var dailyMap = Object.create(null);
    var byMember = Object.create(null);
    var totals = { photos: 0, videos: 0, emoticons: 0, links: 0 };

    msgs.forEach(function (m) {
      hourly[m.hour] += 1;
      weekdays[m.weekday] += 1;
      heatmap[m.weekday][m.hour] += 1;
      dailyMap[m.date] = (dailyMap[m.date] || 0) + 1;

      var st = byMember[m.name];
      if (!st) {
        st = byMember[m.name] = {
          name: m.name, count: 0, hours: zeros(24), weekdays: zeros(7),
          dates: Object.create(null), media: { photo: 0, video: 0, emoticon: 0, link: 0 },
          textLen: 0, textCount: 0, firstDate: m.date, lastDate: m.date
        };
      }
      st.count += 1;
      st.hours[m.hour] += 1;
      st.weekdays[m.weekday] += 1;
      st.dates[m.date] = 1;
      if (m.date < st.firstDate) st.firstDate = m.date;
      if (m.date > st.lastDate) st.lastDate = m.date;
      if (m.kind === "photo") { st.media.photo += 1; totals.photos += 1; }
      else if (m.kind === "video") { st.media.video += 1; totals.videos += 1; }
      else if (m.kind === "emoticon") { st.media.emoticon += 1; totals.emoticons += 1; }
      else if (m.kind === "link") { st.media.link += 1; totals.links += 1; }
      if (m.kind === "text" || m.kind === "link") { st.textLen += m.len; st.textCount += 1; }
    });

    var totalCount = msgs.length;
    var members = Object.keys(byMember).map(function (name) {
      var st = byMember[name];
      return {
        name: st.name,
        count: st.count,
        share: Math.round((st.count / totalCount) * 1000) / 10,
        hours: st.hours,
        weekdays: st.weekdays,
        activeDays: Object.keys(st.dates).length,
        media: st.media,
        avgLen: st.textCount ? Math.round(st.textLen / st.textCount) : 0,
        streak: longestStreak(st.dates),
        firstDate: st.firstDate,
        lastDate: st.lastDate
      };
    }).sort(function (a, b) { return b.count - a.count || (a.name < b.name ? -1 : 1); });

    // 일별 (범위 내 모든 날짜 0 채움)
    var daily = [];
    var span = dayDiff(from, to) + 1;
    if (span < 1) span = 1;
    if (span > 400) span = 400; // 방어: 비정상 범위
    var cursor = from;
    for (var i = 0; i < span; i++) {
      daily.push({ d: cursor, c: dailyMap[cursor] || 0 });
      cursor = addDays(cursor, 1);
    }

    var bestDay = daily[0], quietDay = daily[0];
    daily.forEach(function (e) {
      if (e.c > bestDay.c) bestDay = e;
      if (e.c < quietDay.c) quietDay = e;
    });
    var bestHour = 0;
    hourly.forEach(function (c, h) { if (c > hourly[bestHour]) bestHour = h; });

    var keywords = extractKeywords(
      msgs,
      members.map(function (m) { return m.name; }),
      opts.keywordLimit || 30,
      opts.dropKeywords
    );

    return {
      v: 1,
      periodLabel: opts.periodLabel || autoPeriodLabel(from, to),
      range: { from: from, to: to },
      generatedAt: new Date().toISOString(),
      totals: {
        messages: totalCount,
        activeMembers: members.length,
        days: span,
        avgPerDay: Math.round(totalCount / span),
        newMembers: joins,
        photos: totals.photos,
        videos: totals.videos,
        emoticons: totals.emoticons,
        links: totals.links
      },
      members: members,
      hourly: hourly,
      weekdays: weekdays,
      heatmap: heatmap,
      daily: daily,
      peaks: { bestDay: { d: bestDay.d, c: bestDay.c }, quietDay: { d: quietDay.d, c: quietDay.c }, bestHour: bestHour },
      keywords: keywords
    };
  }

  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function grid7x24() { var g = []; for (var i = 0; i < 7; i++) g.push(zeros(24)); return g; }

  var ChatParser = {
    parse: parse,
    aggregate: aggregate,
    classify: classify,
    toHour24: toHour24,
    weekdayOf: weekdayOf,
    autoPeriodLabel: autoPeriodLabel
  };

  global.ChatParser = ChatParser;
  // 테스트(노드 등)용 export — stage2/cloudsave.js 와 동일 패턴
  if (typeof module !== "undefined" && module.exports) module.exports = ChatParser;
})(typeof window !== "undefined" ? window : globalThis);
