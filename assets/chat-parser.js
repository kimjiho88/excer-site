/* ============================================================
   chat-parser.js — 카카오톡 대화 내보내기(.txt) 파서 + v2 통계 집계
   · 브라우저: window.ChatParser / node: module.exports
   · 지원 포맷(자동 감지, 한 텍스트에 섞여 있어도 동작):
     - Android: "2026년 6월 1일 오후 9:03, 닉네임 : 메시지"
     - iOS:     "2026. 6. 1. 오후 9:03, 닉네임 : 메시지"
     - PC:      "--------------- 2026년 6월 1일 월요일 ---------------"
                "[닉네임] [오후 9:03] 메시지"
   · aggregate() 는 항상 v:2 통계 스키마를 산출한다
     (스키마 계약: 일 단위 시계열 days[] + 멤버별 daily[] 로
      기간 필터를 대시보드가 클라이언트에서 계산).
   · 개인정보: parse() 가 내부적으로 text 를 들고 있는 것은
     aggregate() 의 키워드/휴리스틱 추출용일 뿐, aggregate() 결과(통계 JSON)에는
     대화 원문 문장이 절대 포함되지 않는다. 퇴장·강퇴는 개수만 세고
     누가 나갔는지는 어디에도 남기지 않는다.
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
  // 반환: { messages:[{date,hour,min,weekday,name,kind,len,text}], meta:{joins,leaves,format} }
  // · 입장/퇴장 이벤트는 kind:"join"/"leave" 로 messages 에 포함되지만
  //   (기간별 새 멤버 집계용) aggregate() 는 이를 일반 메시지로 세지 않는다.
  // · join 이벤트는 입장자 닉네임을 name 에 담는다 — 환영(welcome) 휴리스틱의
  //   "본인 제외" 판정용이며, aggregate() 결과에는 절대 노출되지 않는다.
  // · 퇴장/강퇴는 개수만 세고 누가 나갔는지는 어디에도 남기지 않는다 (name:"").
  function parse(rawText) {
    var lines = String(rawText || "").replace(/\r\n?/g, "\n").split("\n");
    var messages = [];
    var meta = { joins: 0, leaves: 0, format: "unknown" };
    var counts = { android: 0, ios: 0, pc: 0 };
    var curDate = null; // PC 포맷용 현재 날짜
    var last = null;    // 멀티라인 연속용 직전 메시지

    function pushMsg(dateStr, hour, min, name, body) {
      var kind = classify(body);
      var msg = {
        date: dateStr,
        hour: hour,
        min: min == null ? 0 : +min,
        weekday: weekdayOf(dateStr),
        name: String(name).trim(),
        kind: kind,
        len: kind === "text" || kind === "link" ? String(body).length : 0,
        text: kind === "text" || kind === "link" ? String(body) : ""
      };
      messages.push(msg);
      last = msg;
    }

    function pushSystem(dateStr, hour, min, body) {
      var kind = null, who = "";
      if (RE_JOIN.test(body)) {
        meta.joins += 1; kind = "join";
        // 입장자 닉네임 추출 (초대 문구 포함) — welcome '본인 제외' 판정 전용
        var jm = body.match(/님이\s*(.+?)님을\s*초대했습니다/) ||
                 body.match(/^(.+?)님이\s*(?:들어왔습니다|초대되었습니다)/);
        if (jm) who = jm[1].trim();
      } else if (RE_LEAVE.test(body)) {
        meta.leaves += 1; kind = "leave";
        // 퇴장/강퇴자 닉네임 추출 — '현재 방 멤버 자동 감지'(membership) 전용.
        // 이 이름은 parse() 내부 메시지 객체에만 남고, aggregate() 통계 JSON 에는
        // 절대 노출되지 않는다(aggregate 는 leave 를 세지도 출력하지도 않음).
        var lm = body.match(/^(.+?)님이\s*나갔습니다/) ||
                 body.match(/^(.+?)님을\s*내보냈습니다/);
        if (lm) who = lm[1].trim();
      }
      if (kind && dateStr) {
        messages.push({
          date: dateStr, hour: hour == null ? 12 : hour, min: min == null ? 0 : +min,
          weekday: weekdayOf(dateStr),
          name: who, kind: kind, len: 0, text: ""
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
        pushMsg(d1, toHour24(m[4], m[5]), m[6], m[7], m[8]);
        continue;
      }

      // 4) iOS 메시지
      m = line.match(RE_IOS_MSG);
      if (m) {
        var d2 = toDateStr(m[1], m[2], m[3]);
        curDate = d2; counts.ios += 1;
        pushMsg(d2, toHour24(m[4], m[5]), m[6], m[7], m[8]);
        continue;
      }

      // 5) PC 메시지 (날짜 구분선 이후에만 유효)
      m = line.match(RE_PC_MSG);
      if (m && curDate) {
        counts.pc += 1;
        pushMsg(curDate, toHour24(m[2], m[3]), m[4], m[1], m[5]);
        continue;
      }

      // 6) Android/iOS 시스템 행 (날짜+시각 프리픽스는 있지만 " : " 가 없는 행)
      m = t.match(RE_ANDROID_SYS) || t.match(RE_IOS_SYS);
      if (m) {
        var d3 = toDateStr(m[1], m[2], m[3]);
        curDate = d3;
        pushSystem(d3, toHour24(m[4], m[5]), m[6], m[7] || "");
        continue;
      }

      // 7) 날짜만 있는 행 (날짜 변경선)
      m = t.match(RE_DATE_ONLY);
      if (m) { curDate = toDateStr(m[1], m[2], m[3]); last = null; continue; }

      // 8) 프리픽스 없는 시스템 행 (PC 포맷의 입장/퇴장 등)
      if (RE_JOIN.test(t) || RE_LEAVE.test(t)) { pushSystem(curDate, null, null, t); continue; }
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

  /* ── v2 휴리스틱 정의 ───────────────────────────────────────
     모든 휴리스틱 카운트(q/a/welcome/kw/emojiStats)는
     시스템·미디어 메시지 제외 원칙: kind === "text" 만 검사한다.
     (photo/video/emoticon/link 는 media 자체 카운트로만 집계) */

  // 질문(q): 텍스트 끝이 '?'/'？'(연속 포함) 이거나
  //          "~나요/~까요" 로 끝나거나 "어때/궁금" 패턴을 포함
  var RE_Q_TAIL = /[?？]\s*$/;
  var RE_Q_ENDING = /(나요|까요)[\s.!~ㅠㅜ]*$/;
  var RE_Q_WORD = /어때|궁금/;
  function isQuestion(text) {
    var t = String(text || "").trim();
    if (!t) return false;
    return RE_Q_TAIL.test(t) || RE_Q_ENDING.test(t) || RE_Q_WORD.test(t);
  }

  // 답변·반응(a):
  //  ① 다른 멤버의 메시지(종류 무관) 후 5분 이내에 보낸 텍스트 메시지, 또는
  //  ② 짧은 리액션 패턴 (ㅋㅋ+, ㄹㅇ, 굿, 오~, 맞아, 축하, 화이팅 등 —
  //     리액션 어휘로 시작하고 나머지가 감탄 부호/자모 뿐인 짧은 메시지)
  //  한 메시지는 최대 1회만 a 로 센다.
  var RE_REACTION = /^(ㅋ{2,}|ㅎ{2,}|ㅠ{2,}|ㄹㅇ|ㅇㅈ|인정|굿+|굳+|오+|와+|우와+|(맞아)+|맞네|맞지|맞죠|좋아+|좋네|좋다|최고+|대박+|짱+|헐+|축하(해+요*|합니다|드려요)?|ㅊㅋ+|화이팅|파이팅|응원(해요|합니다)?|고고+|가즈아+|넵+|넹+|네네|ㅇㅋ|오케이?|나이스|nice|good|okay|ok)[!?~^.,\sㅋㅎㅠㅜ]*$/i;

  // 환영(welcome): join 이벤트 후 60분 이내의
  //   "환영/어서오/반갑/안녕하세요" 포함 텍스트 메시지 (입장 당사자 본인 제외).
  //   입장자 이름을 모르는 join 이면 '데이터 전체에서 그 멤버의 첫 메시지'를
  //   본인 인사로 추정해 제외한다. 한 메시지는 최대 1회만 센다.
  var RE_WELCOME = /환영|어서오|반갑|안녕하세요/;

  // emojiStats (메시지 단위 카운트 — 한 메시지가 각 항목에 최대 1씩 기여):
  //   laugh = ㅋ 2개 이상 연속 또는 😂/🤣
  //   cheer = 화이팅/파이팅/응원/축하/👏
  //   heart = ❤/♥/💜/좋아
  var RE_LAUGH = /ㅋ{2,}|😂|🤣/;
  var RE_CHEER = /화이팅|파이팅|응원|축하|👏/;
  var RE_HEART = /❤|♥|💜|좋아/;

  // 키워드 카테고리 사전 (넉넉히) — 단어/문장에 사전 항목이 '포함'되면 해당 카테고리.
  //   · 멤버별 kw: 텍스트 메시지에서 카테고리 사전 항목의 언급 횟수 합
  //   · keywords[].cat: 추출된 키워드가 처음 매칭되는 카테고리 (없으면 null)
  //   판정 우선순위: 운동 → 식단 → 벙 → 정보
  var KW_CAT_ORDER = ["운동", "식단", "벙", "정보"];
  var KW_CATEGORIES = {
    "운동": [
      "러닝", "조깅", "마라톤", "달리기", "헬스", "웨이트", "등산", "트레킹", "요가",
      "필라테스", "크로스핏", "유산소", "근력", "근육", "운동", "수영", "클라이밍",
      "볼더링", "자전거", "라이딩", "사이클", "배드민턴", "테니스", "탁구", "축구",
      "풋살", "농구", "야구", "볼링", "골프", "스쿼트", "데드리프트", "벤치프레스",
      "푸시업", "팔굽혀펴기", "풀업", "턱걸이", "런지", "플랭크", "버피", "케틀벨",
      "덤벨", "바벨", "오운완", "득근", "체지방", "인바디", "바디프로필", "코어",
      "하체", "상체", "스트레칭", "헬스장", "체육관", "피티", "홈트", "만보", "걷기"
    ],
    "식단": [
      "식단", "다이어트", "단백질", "프로틴", "닭가슴살", "샐러드", "도시락", "칼로리",
      "치팅", "치팅데이", "저탄고지", "키토", "간헐적단식", "단식", "탄수화물", "영양제",
      "보충제", "쉐이크", "오트밀", "고구마", "현미", "잡곡", "브로콜리", "야식",
      "폭식", "식욕", "체중", "감량", "벌크업", "커팅", "클린식", "저염", "제로칼로리",
      "제로콜라", "비건", "영양성분", "식비"
    ],
    "벙": [
      "벙", "모임", "정모", "번개", "정산", "벙비", "회비", "참석", "불참", "참여",
      "공지", "장소", "벙주", "신청", "마감", "명단", "예약", "일정", "투표",
      "뒤풀이", "집결", "모집", "합류", "출첵", "출석", "노쇼"
    ],
    "정보": [
      "정보", "링크", "공유", "추천", "후기", "꿀팁", "리뷰", "자료", "참고",
      "가이드", "소식", "뉴스", "이벤트", "할인", "쿠폰", "세일", "특가",
      "블로그", "유튜브", "기사", "영상추천", "앱추천"
    ]
  };
  var KW_CAT_RE = {};
  KW_CAT_ORDER.forEach(function (cat) {
    KW_CAT_RE[cat] = new RegExp(KW_CATEGORIES[cat].join("|"), "g");
  });

  // 텍스트 한 건에서 카테고리별 언급 횟수를 kw 에 누적
  function countCategoryMentions(text, kw) {
    for (var i = 0; i < KW_CAT_ORDER.length; i++) {
      var cat = KW_CAT_ORDER[i];
      var hits = String(text).match(KW_CAT_RE[cat]);
      if (hits) kw[cat] += hits.length;
    }
  }

  // 추출 키워드 1개의 카테고리 판정 (첫 매칭 카테고리, 없으면 null)
  function categorizeWord(word) {
    var w = String(word).toLowerCase();
    for (var i = 0; i < KW_CAT_ORDER.length; i++) {
      var cat = KW_CAT_ORDER[i], terms = KW_CATEGORIES[cat];
      for (var j = 0; j < terms.length; j++) {
        if (w.indexOf(terms[j]) !== -1) return cat;
      }
    }
    return null;
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

  // 메시지의 절대 분(minute) 좌표 — 5분/60분 윈도 휴리스틱용.
  // min 필드가 없는 메시지(구버전 저장분 등)는 0분으로 취급한다.
  function epochMin(m) {
    var p = m.date.split("-");
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 60000) + m.hour * 60 + (m.min || 0);
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

  /* ── aggregate (v2 통계 스키마) ─────────────────────────────
     opts: { from, to ("YYYY-MM-DD"), exclude:[닉네임], keywordLimit(기본 40),
             maskNames(true 면 members[].name 을 집계 단계에서 "첫 글자+*" 로 치환),
             dropKeywords:[단어], periodLabel(강제 라벨),
             format("android"|"ios"|"pc"|"mixed"), files(병합 파일 수) }
     반환: v:2 통계 JSON — 일 단위 시계열(days[], members[].daily[])을 담아
           대시보드가 기간 필터(오늘/이번 주/이번 달/직접 선택)를 클라이언트에서
           계산할 수 있게 한다. 대화 원문 문장은 절대 포함하지 않는다. */
  function aggregate(allMessages, opts) {
    opts = opts || {};
    var exclude = Object.create(null);
    (opts.exclude || []).forEach(function (n) { exclude[String(n).trim()] = 1; });

    var inRange = function (d) {
      if (opts.from && d < opts.from) return false;
      if (opts.to && d > opts.to) return false;
      return true;
    };

    var msgs = [];       // 일반 메시지(집계 대상)
    var joinEvents = []; // 범위 내 입장 이벤트 (이름은 welcome 판정에만 쓰고 미출력)
    (allMessages || []).forEach(function (m) {
      if (!m || !m.date || !inRange(m.date)) return;
      if (m.kind === "join") { joinEvents.push(m); return; }
      if (m.kind === "leave") return; // 공개 통계 미포함(운영 민감 정보)
      if (exclude[m.name]) return;
      msgs.push(m);
    });

    // 응답(5분)/환영(60분) 윈도 판정을 위해 시간순 정렬
    var chrono = function (a, b) { return epochMin(a) - epochMin(b); };
    msgs = msgs.slice().sort(chrono);
    joinEvents = joinEvents.slice().sort(chrono);

    var generatedAt = new Date().toISOString();
    if (!msgs.length) {
      return {
        v: 2,
        periodLabel: opts.periodLabel || "",
        range: { from: opts.from || "", to: opts.to || "" },
        generatedAt: generatedAt,
        maskNames: !!opts.maskNames,
        days: [], members: [], heatmap: grid7x24(),
        keywords: [], weeklyKeywords: [],
        emojiStats: { laugh: 0, cheer: 0, heart: 0 },
        newMembers: { count: joinEvents.length, avgFirstWeekMsgs: 0 },
        meta: { format: opts.format || "unknown", files: opts.files || 1, totalMessages: 0 }
      };
    }

    // 실제 데이터 범위 (정렬됐으므로 양끝)
    var from = opts.from || msgs[0].date;
    var to = opts.to || msgs[msgs.length - 1].date;
    var span = dayDiff(from, to) + 1;
    if (span < 1) span = 1;
    if (span > 400) span = 400; // 방어: 비정상 범위

    // ── 방 단위 일별 시계열 (빈 날도 0 으로 채움 — 기간 필터의 근간) ──
    var days = [], dayIdx = Object.create(null), cursor = from;
    for (var i = 0; i < span; i++) {
      days.push({ d: cursor, c: 0, byHour: zeros(24), joins: 0 });
      dayIdx[cursor] = i;
      cursor = addDays(cursor, 1);
    }
    joinEvents.forEach(function (j) {
      if (dayIdx[j.date] != null) days[dayIdx[j.date]].joins += 1;
    });

    var heatmap = grid7x24();
    var emojiStats = { laugh: 0, cheer: 0, heart: 0 };
    var byMember = Object.create(null);
    var firstMsgIdx = Object.create(null); // 멤버별 데이터 전체 첫 메시지 인덱스

    function statOf(m) {
      var st = byMember[m.name];
      if (!st) {
        st = byMember[m.name] = {
          name: m.name, count: 0, daily: zeros(span),
          hours: zeros(24), weekdays: zeros(7),
          q: 0, a: 0, welcome: 0,
          media: { photo: 0, video: 0, emoticon: 0, link: 0 },
          textLen: 0, textCount: 0, dates: Object.create(null),
          kw: { "운동": 0, "식단": 0, "벙": 0, "정보": 0 },
          firstDate: m.date, lastDate: m.date
        };
      }
      return st;
    }

    var prev = null; // 직전 일반 메시지(발신자 무관) — 응답 판정용
    msgs.forEach(function (m, idx) {
      var di = dayIdx[m.date];
      if (di != null) { days[di].c += 1; days[di].byHour[m.hour] += 1; }
      heatmap[m.weekday][m.hour] += 1;
      if (firstMsgIdx[m.name] == null) firstMsgIdx[m.name] = idx;

      var st = statOf(m);
      st.count += 1;
      if (di != null) st.daily[di] += 1;
      st.hours[m.hour] += 1;
      st.weekdays[m.weekday] += 1;
      st.dates[m.date] = 1;
      if (m.date < st.firstDate) st.firstDate = m.date;
      if (m.date > st.lastDate) st.lastDate = m.date;

      if (m.kind === "photo") st.media.photo += 1;
      else if (m.kind === "video") st.media.video += 1;
      else if (m.kind === "emoticon") st.media.emoticon += 1;
      else if (m.kind === "link") st.media.link += 1;
      if (m.kind === "text" || m.kind === "link") { st.textLen += m.len; st.textCount += 1; }

      // 휴리스틱 카운트 — 텍스트만 (시스템·미디어 제외 원칙)
      if (m.kind === "text") {
        var t = String(m.text || "").trim();
        if (isQuestion(t)) st.q += 1;                                  // 질문(q)
        var gap = prev ? epochMin(m) - epochMin(prev) : -1;
        var isReply = prev && prev.name !== m.name && gap >= 0 && gap <= 5; // 타인 메시지 5분 내 응답
        if (isReply || RE_REACTION.test(t)) st.a += 1;                 // 답변·반응(a)
        if (RE_LAUGH.test(t)) emojiStats.laugh += 1;
        if (RE_CHEER.test(t)) emojiStats.cheer += 1;
        if (RE_HEART.test(t)) emojiStats.heart += 1;
        countCategoryMentions(t, st.kw);                               // 카테고리 키워드 언급
      }
      prev = m;
    });

    // ── 환영(welcome): join 후 60분 내 환영 표현, 본인 제외, 메시지당 1회 ──
    var epochs = msgs.map(epochMin);
    var welcomed = Object.create(null);
    var scanFrom = 0;
    joinEvents.forEach(function (j) {
      var t0 = epochMin(j), t1 = t0 + 60;
      while (scanFrom < msgs.length && epochs[scanFrom] < t0) scanFrom += 1;
      for (var k = scanFrom; k < msgs.length && epochs[k] <= t1; k++) {
        var m = msgs[k];
        if (m.kind !== "text" || welcomed[k]) continue;
        if (!RE_WELCOME.test(m.text)) continue;
        if (j.name && m.name === j.name) continue;          // 입장 당사자 제외
        if (!j.name && firstMsgIdx[m.name] === k) continue; // 이름 미상 join: 첫 메시지=본인 인사 추정
        welcomed[k] = 1;
        byMember[m.name].welcome += 1;
      }
    });

    // ── 멤버 목록 (count 내림차순, 최대 60명) ──
    var totalCount = msgs.length;
    var memberList = Object.keys(byMember).map(function (name) {
      var st = byMember[name];
      return {
        name: st.name,
        count: st.count,
        daily: st.daily,
        hours: st.hours,
        weekdays: st.weekdays,
        q: st.q,
        a: st.a,
        welcome: st.welcome,
        media: st.media,
        avgLen: st.textCount ? Math.round((st.textLen / st.textCount) * 10) / 10 : 0,
        streak: longestStreak(st.dates),
        activeDays: Object.keys(st.dates).length,
        kw: st.kw,
        firstDate: st.firstDate,
        lastDate: st.lastDate
      };
    }).sort(function (a, b) { return b.count - a.count || (a.name < b.name ? -1 : 1); });

    // ── 신규 적응 지표(개인 식별 없음):
    //    count = 범위 내 입장 이벤트 수,
    //    avgFirstWeekMsgs = firstDate 가 범위 시작 이후(중도 합류)인 멤버들의
    //                       첫 7일(입장일 포함) 메시지 수 평균 ──
    var joinsInRange = 0;
    days.forEach(function (d) { joinsInRange += d.joins; });
    var newcomers = memberList.filter(function (m) { return m.firstDate > from; });
    var avgFirstWeekMsgs = 0;
    if (newcomers.length) {
      var sumFW = 0;
      newcomers.forEach(function (m) {
        var i0 = dayIdx[m.firstDate] || 0;
        var end = Math.min(i0 + 7, m.daily.length);
        for (var k = i0; k < end; k++) sumFW += m.daily[k];
      });
      avgFirstWeekMsgs = Math.round(sumFW / newcomers.length);
    }

    // ── 키워드 (상위 40 기본, 발행 전 dropKeywords 로 편집 가능) ──
    var memberNames = memberList.map(function (m) { return m.name; });
    var keywords = extractKeywords(msgs, memberNames, opts.keywordLimit || 40, opts.dropKeywords)
      .map(function (k) { return { w: k.w, c: k.c, cat: categorizeWord(k.w) }; });

    // ── 주차별 키워드 (월요일 경계 주 단위, 주당 상위 3) — 주제 변화 추이 ──
    var weeklyKeywords = [];
    var ws = from;
    while (ws <= to) {
      var we = addDays(ws, 6 - weekdayOf(ws)); // 그 주 일요일
      if (we > to) we = to;
      var wStart = ws, wEnd = we;
      var weekMsgs = msgs.filter(function (m) { return m.date >= wStart && m.date <= wEnd; });
      if (weekMsgs.length) {
        weeklyKeywords.push({
          week: weekLabel(wStart, wEnd),
          top: extractKeywords(weekMsgs, memberNames, 3, opts.dropKeywords)
            .map(function (k) { return k.w; })
        });
      }
      ws = addDays(we, 1);
    }

    var members = memberList.slice(0, 60);

    // ── 닉네임 마스킹: 집계 단계에서 치환(원본은 결과에 남지 않아 복원 불가).
    //    "첫 글자 + *" — 첫 글자가 겹치면 숫자 접미로만 구분 (예: 민*, 민*2) ──
    if (opts.maskNames) {
      var used = Object.create(null);
      members.forEach(function (m) {
        var base = (String(m.name).trim().charAt(0) || "?") + "*";
        var out = base, n = 2;
        while (used[out]) { out = base + n; n += 1; }
        used[out] = 1;
        m.name = out;
      });
    }

    return {
      v: 2,
      periodLabel: opts.periodLabel || autoPeriodLabel(from, to),
      range: { from: from, to: to },
      generatedAt: generatedAt,
      maskNames: !!opts.maskNames,
      days: days,
      members: members,
      heatmap: heatmap,
      keywords: keywords,
      weeklyKeywords: weeklyKeywords,
      emojiStats: emojiStats,
      newMembers: { count: joinsInRange, avgFirstWeekMsgs: avgFirstWeekMsgs },
      meta: {
        format: opts.format || "unknown",
        files: opts.files || 1,
        totalMessages: totalCount
      }
    };
  }

  // "6/23~6/29" 형태의 주 라벨
  function weekLabel(ws, we) {
    var a = ws.split("-"), b = we.split("-");
    return (+a[1]) + "/" + (+a[2]) + "~" + (+b[1]) + "/" + (+b[2]);
  }

  /* ── 중복 업로드 감지/병합 헬퍼 ─────────────────────────────
     서명 = (date, hour, name, len, kind). 같은 내보내기를 두 번 올리거나
     날짜 범위가 겹치는 파일을 병합할 때 이중 집계를 막는다. */

  // 두 메시지 목록이 겹치는 날짜(YYYY-MM-DD) 목록 (정렬됨)
  function detectOverlap(messagesA, messagesB) {
    var inA = Object.create(null), both = Object.create(null);
    (messagesA || []).forEach(function (m) { if (m && m.date) inA[m.date] = 1; });
    (messagesB || []).forEach(function (m) { if (m && m.date && inA[m.date]) both[m.date] = 1; });
    return Object.keys(both).sort();
  }

  // 여러 목록 병합: 동일 서명 메시지는 파일 간 중복 제거.
  // · 한 파일 안의 같은 서명 반복(예: 같은 시간대 "ㅋㅋ" 두 번)은 정상 데이터로 보존
  //   — 서명별로 '한 파일 내 최대 등장 횟수'만큼 유지한다.
  // · 동수/그 이상이면 나중 파일 우선. 결과는 시간순 정렬.
  function mergeMessages() {
    var lists = Array.prototype.slice.call(arguments);
    if (lists.length === 1 && Array.isArray(lists[0]) && lists[0].length && Array.isArray(lists[0][0])) {
      lists = lists[0]; // mergeMessages([listA, listB]) 형태도 허용
    }
    var sigOf = function (m) {
      return m.date + "|" + m.hour + "|" + (m.name || "") + "|" + (m.len || 0) + "|" + m.kind;
    };
    var groups = Object.create(null); // 서명 → 채택된 메시지 배열
    lists.forEach(function (list) {
      var local = Object.create(null);
      (list || []).forEach(function (m) {
        if (!m || !m.date || !m.kind) return;
        var s = sigOf(m);
        (local[s] = local[s] || []).push(m);
      });
      Object.keys(local).forEach(function (s) {
        if (!groups[s] || local[s].length >= groups[s].length) groups[s] = local[s];
      });
    });
    var merged = [];
    Object.keys(groups).forEach(function (s) {
      merged.push.apply(merged, groups[s]);
    });
    merged.sort(function (a, b) { return epochMin(a) - epochMin(b); });
    return merged;
  }

  /* ── 현재 방 멤버 자동 감지 (membership) ─────────────────────
     퇴장/강퇴 시스템 메시지를 근거로 "지금 방에 없는 사람"을 추정한다.
     각 닉네임의 마지막 사건(메시지 / 입장 / 퇴장)을 시간순으로 보고,
     마지막이 '퇴장'이면 나간 것으로 본다(그 뒤 재입장·발화가 있으면 다시 '있음').
     · 대화 내보내기에 퇴장 메시지가 없으면(오래된 내역·초대 전 등) 감지가 안 될 수
       있으므로, 결과는 '자동 제외 후보'로만 쓰고 운영진이 최종 확인한다.
     · 이 함수는 판정에만 쓰이고, 통계 JSON 에는 누가 나갔는지 남기지 않는다.
     반환: { leftNames:[닉], joins:n, leaves:n } */
  function membership(allMessages) {
    // 카톡 타임스탬프는 분 단위라 같은 분에 발생한 나감·재입장·발화의 실제 순서는
    // 시각만으로 알 수 없다. 대신 내보내기 파일의 등장 순서가 곧 실제 순서이므로,
    // '시각(분) 기준 안정 정렬 + 등장 인덱스 타이브레이크'로 파일 순서를 보존한다.
    // → '나갈게요(발화)+나감'(같은 분)은 나감이 뒤라 out, '나감+재입장+발화'는 발화가 뒤라 in.
    var evs = [];
    var joins = 0, leaves = 0;
    (allMessages || []).forEach(function (m, idx) {
      if (!m || !m.date || !m.name) return;
      var isLeave = m.kind === "leave";
      if (m.kind === "join") joins += 1;
      else if (isLeave) leaves += 1;
      evs.push({ name: m.name, t: epochMin(m), idx: idx, leave: isLeave });
    });
    evs.sort(function (a, b) { return a.t - b.t || a.idx - b.idx; });
    var state = Object.create(null); // 닉 → "in" | "out"
    evs.forEach(function (e) { state[e.name] = e.leave ? "out" : "in"; });
    var leftNames = Object.keys(state).filter(function (n) { return state[n] === "out"; });
    return { leftNames: leftNames, joins: joins, leaves: leaves };
  }

  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function grid7x24() { var g = []; for (var i = 0; i < 7; i++) g.push(zeros(24)); return g; }

  var ChatParser = {
    parse: parse,
    aggregate: aggregate,
    membership: membership,
    detectOverlap: detectOverlap,
    mergeMessages: mergeMessages,
    classify: classify,
    toHour24: toHour24,
    weekdayOf: weekdayOf,
    autoPeriodLabel: autoPeriodLabel
  };

  global.ChatParser = ChatParser;
  // 테스트(노드 등)용 export — stage2/cloudsave.js 와 동일 패턴
  if (typeof module !== "undefined" && module.exports) module.exports = ChatParser;
})(typeof window !== "undefined" ? window : globalThis);
