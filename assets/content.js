/* ============================================================
   동네친구들 — 콘텐츠 양식 (assets/content.js)
   ------------------------------------------------------------
   맛집과 소식을 화면에 그릴 때 "무엇을 어떤 순서로 보여 주는가"를 한 곳에 둔다.
   홈·맛집·소식 세 화면이 같은 함수를 쓰므로 목록과 상세, 홈 미리보기가 어긋나지 않는다.
   규칙 문서: docs/CONTENT_FORMAT.md

   · placeView(row)   서버 행(site_places_v) → 표시용 객체 (지역·가격·메뉴·팁·한줄평 정리)
   · noteView(row, note) 한줄평 하나 → { review, menu, tip, original, source }
       우선순위: 작성자가 수정한 서버 값(menu/tip 있음) > 정리본(data/places-curated.json) > 원문
   · loadCurated()    정리본 파일을 한 번 읽어 둔다. 실패하면 원문만 쓴다
   · postView(row)    소식 행(site_posts_v) → 유형별 항목(facts)·목록 보조 줄(subline)
   · caps()           서버가 새 형식(추천 메뉴·유형별 항목)을 받는지 확인 (site_schema_v)

   site-core.js 뒤에 읽는다 (window.SUPA 를 쓴다).
   ============================================================ */
(function () {
  "use strict";

  var AREAS = ["논현/신사", "역삼/선릉", "강남역", "압구정/청담", "삼성/대치", "서초/교대", "도곡/양재", "잠실/송파", "그 외"];
  var CATS = ["고기", "한식", "일식", "중식", "양식/퓨전", "술집/포차", "카페/디저트", "분식/면"];
  var PRICE_TEXT = ["가격 미등록", "1인 1만원 이하", "1인 1만원대", "1인 2만원대", "1인 3만원 이상"];
  /* 종류별 아이콘(assets/icons.js 이름)과 색 — 목록 행·지도 핀·차트가 같은 것을 쓴다 */
  var CAT_ICON = { "고기": "meat", "한식": "bowl", "일식": "fish", "중식": "dumpling", "양식/퓨전": "pasta", "술집/포차": "glass", "카페/디저트": "cup", "분식/면": "noodle" };
  var CAT_COLOR = { "고기": "#A9502D", "한식": "#4B2A82", "일식": "#3F6E86", "중식": "#B23B3B", "양식/퓨전": "#6D4AAE", "술집/포차": "#7E5F25", "카페/디저트": "#8A5A7E", "분식/면": "#2F7A6B" };
  function catIcon(c) { return CAT_ICON[slash(c)] || "utensils"; }
  function catColor(c) { return CAT_COLOR[slash(c)] || "#4B2A82"; }
  /* 종류별 그림(assets/img/food-<slug>-160/320.webp) — 2세대 스티커 8장. 없는 종류는 null → 선 아이콘만 */
  var CAT_IMG = { "고기": "meat", "한식": "korean", "일식": "japanese", "중식": "chinese", "양식/퓨전": "western", "술집/포차": "pub", "카페/디저트": "cafe", "분식/면": "bunsik" };
  function catImg(c) { var s = CAT_IMG[slash(c)]; return s ? "food-" + s : null; }

  /* ── 초성 검색 ── "ㅇㅎㄱ" → 유쾌한그집. 검색어가 초성으로만 되어 있을 때 쓴다 */
  var CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  function chosung(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code >= 0xAC00 && code <= 0xD7A3) out += CHO[Math.floor((code - 0xAC00) / 588)];
      else if (!/\s/.test(s[i])) out += s[i];
    }
    return out;
  }
  function isChosungQuery(q) { return !!q && /^[ㄱ-ㅎ]+$/.test(q.replace(/\s+/g, "")); }

  /* ── 닉네임 자동완성 ── 기존 작성자 이름을 <datalist> 로 붙인다.
     같은 사람이 띄어쓰기·오타로 둘로 갈리는 일을 줄인다. 이름은 화면에 있는 것만(서버에 새로 묻지 않음) */
  function nickSuggest(input, names) {
    if (!input || !names || !names.length) return;
    var id = (input.id || "nick") + "-list";
    var dl = document.getElementById(id);
    if (!dl) { dl = document.createElement("datalist"); dl.id = id; document.body.appendChild(dl); }
    var seen = {};
    dl.innerHTML = names.map(function (n) { return String(n || "").trim(); })
      .filter(function (n) { if (!n || seen[n]) return false; seen[n] = true; return true; })
      .slice(0, 80)
      .map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join("");
    input.setAttribute("list", id);
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c];
    });
  }
  function slash(v) { return String(v == null ? "" : v).replace(/·/g, "/"); }
  function normName(v) { return String(v == null ? "" : v).toLowerCase().replace(/\s+/g, ""); }
  function trim(v) { return String(v == null ? "" : v).trim(); }
  /* 필터·선택지에 쓰는 지역 이름. "그 외"는 분류일 뿐이라 "그 외 지역"으로 읽는다 */
  function areaLabel(a) { return a === "그 외" ? "그 외 지역" : (a || ""); }
  /* 메뉴 이름이 글 안에 이미 있는가 — 공백·대소문자를 무시하고 본다 ("육회 한상" ⊂ "신선한 육회 한상.") */
  function textHas(text, menu) {
    var t = normName(text), m = normName(menu);
    return !!m && !!t && t.indexOf(m) >= 0;
  }
  /* "생태탕, 오징어제육" → ["생태탕", "오징어제육"] */
  function menuItems(menu) {
    return String(menu == null ? "" : menu).split(/[,，·]/).map(trim).filter(Boolean);
  }
  /* 메뉴 칸의 메뉴가 전부 글 안에 있는가 — 있으면 글 아래에 메뉴를 다시 적지 않는다 */
  function menusIn(text, menu) {
    var items = menuItems(menu);
    return items.length > 0 && items.every(function (m) { return textHas(text, m); });
  }

  /* ── 날짜 ── */
  var DOW = ["일", "월", "화", "수", "목", "금", "토"];
  function ymdParts(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function kstToday() {
    try { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  /* 지금 시각 "HH:MM" (한국 시간). 오늘 모임이 이미 시작했는지 볼 때 쓴다 */
  function kstNowHM() {
    var d = new Date();
    try {
      var s = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
      if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5) === "24:00" ? "00:00" : s.slice(0, 5);
    } catch (e) {}
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }
  /* "9월 5일" / withYear → "2026년 9월 5일" / withDow → "9월 5일 (목)" */
  function dateText(v, opts) {
    opts = opts || {};
    var p = ymdParts(v);
    if (!p) return "";
    var s = (opts.withYear ? p.y + "년 " : "") + p.m + "월 " + p.d + "일";
    if (opts.withDow) {
      var d = new Date(Date.UTC(p.y, p.m - 1, p.d));
      s += " (" + DOW[d.getUTCDay()] + ")";
    }
    return s;
  }
  /* 목록의 시각 표시: 하루 안은 상대, 그 뒤는 날짜. 소식·홈이 같은 단계를 쓴다 */
  function relTime(iso) {
    if (!iso) return "";
    var t = new Date(iso).getTime();
    if (!t) return "";
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return "방금 전";
    if (s < 3600) return Math.floor(s / 60) + "분 전";
    if (s < 86400) return Math.floor(s / 3600) + "시간 전";
    if (s < 86400 * 7) return Math.floor(s / 86400) + "일 전";
    var d = new Date(t);
    var thisYear = d.getFullYear() === new Date().getFullYear();
    return (thisYear ? "" : d.getFullYear() + "년 ") + (d.getMonth() + 1) + "월 " + d.getDate() + "일";
  }
  function daysFromToday(ymd, today) {
    var a = Date.parse(ymd + "T00:00:00Z"), n = Date.parse((today || kstToday()) + "T00:00:00Z");
    if (isNaN(a) || isNaN(n)) return null;
    return Math.round((a - n) / 86400000);
  }

  /* ── 정리본 (data/places-curated.json) ── */
  var curatedMap = null;        // key → 항목
  var curatedPromise = null;
  function curatedKey(name, area, original) {
    return normName(name) + "|" + slash(area) + "|" + trim(original);
  }
  function loadCurated() {
    if (curatedPromise) return curatedPromise;
    curatedPromise = fetch("data/places-curated.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (j) {
        var map = {};
        (Array.isArray(j.notes) ? j.notes : []).forEach(function (n) {
          map[curatedKey(n.place, n.area, n.original)] = n;
        });
        curatedMap = map;
        return map;
      })
      .catch(function () { curatedMap = {}; return curatedMap; });   // 못 읽으면 원문으로 보여 준다
    return curatedPromise;
  }

  /* ── 한줄평 하나의 표시용 값 ──
     source: "server"(작성자가 메뉴·팁까지 저장) | "curated"(정리본) | "original"(원문 그대로) */
  function noteView(place, n) {
    n = n || {};
    var text = trim(n.text);
    var out = {
      id: n.id, by: trim(n.by), date: n.date || "", per_person: Number(n.per_person) || 0, again: !!n.again,
      created_at: n.created_at || "",
      review: text, menu: "", tip: "", original: text, source: "original", pending: false
    };
    if (trim(n.menu) || trim(n.tip)) {
      out.menu = trim(n.menu); out.tip = trim(n.tip); out.source = "server";
      return out;
    }
    var c = curatedMap && curatedMap[curatedKey(place.name, place.area, text)];
    if (c) {
      if (c.status === "pending") { out.pending = true; return out; }
      out.review = trim(c.review); out.menu = trim(c.menu); out.tip = trim(c.tip);
      out.source = "curated";
    }
    return out;
  }

  /* ── 가격 ── */
  function priceLevel(p) {
    if (p.price_level >= 1 && p.price_level <= 4) return p.price_level;
    // 금액 기록이 있으면 중앙값으로 정한다 — 한 번의 단체 회식이 전체 인상을 왜곡하지 않게
    var nums = (Array.isArray(p.notes) ? p.notes : []).map(function (n) { return Number(n && n.per_person) || 0; })
      .filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
    if (!nums.length) return 0;
    var mid = nums[Math.floor((nums.length - 1) / 2)];
    return mid <= 10000 ? 1 : mid <= 20000 ? 2 : mid <= 30000 ? 3 : 4;
  }
  function priceText(lv) { return PRICE_TEXT[lv] || PRICE_TEXT[0]; }

  /* 도로명·번지 꼴이면 주소, 아니면 위치 메모 */
  function looksLikeAddress(s) {
    s = trim(s);
    return !!s && /(로|길)\s*\d|\d+(-\d+)?번지|\d+\s*(동|호)\b/.test(s);
  }
  function mapUrl(p) {
    if (p.map_url) return p.map_url;
    var q = (p.area && p.area !== "그 외" ? slash(p.area).split("/")[0] + " " : "") + (p.name || "");
    return "https://map.kakao.com/?q=" + encodeURIComponent(q.trim());
  }
  function uniqPush(arr, v) { if (v && arr.indexOf(v) < 0) arr.push(v); }
  /* 한줄평 하나가 화면에 내는 글: 한줄평이 있으면 그것, 메뉴만 있으면 "추천 메뉴 …" */
  function noteText(n) { return n.review || (n.menu ? "추천 메뉴 " + n.menu : ""); }
  /* 한줄평의 가장 최근 날짜 — 방문일이 있으면 방문일, 없으면 작성일. 정렬 "최근 한줄평순"의 기준 */
  function noteDate(n) { return n.date || String(n.created_at || "").slice(0, 10); }

  /* ── 가게 하나의 표시용 객체 ── */
  function placeView(row) {
    var p = Object.assign({}, row);
    p.area = slash(p.area); p.category = slash(p.category);
    var notes = (Array.isArray(row.notes) ? row.notes : []).map(function (n) { return noteView(p, n); });
    var menus = [], tips = [], menuNotes = 0;
    notes.forEach(function (n) {
      if (n.menu) menuNotes++;
      menuItems(n.menu).forEach(function (m) { uniqPush(menus, m); });
      if (n.tip) tips.push({ text: n.tip, by: n.by });
    });
    var reviews = notes.filter(function (n) { return n.review; });
    var latest = reviews[0] || null;                    // 뷰가 방문일·작성일 내림차순으로 준다
    var lv = priceLevel(row);
    var detail = trim(p.area_detail);
    var address = looksLikeAddress(detail) ? detail : "";
    var locationNote = address ? "" : detail;
    var again = notes.length >= 2
      ? { yes: notes.filter(function (n) { return n.again; }).length, all: notes.length } : null;
    // 어느 후기 글에도 안 나오는 메뉴 — 이런 메뉴가 있거나 메뉴를 적은 사람이 둘 이상일 때만 상세에 '추천 메뉴' 항목을 따로 둔다
    var uncovered = menus.filter(function (m) { return !notes.some(function (n) { return textHas(noteText(n), m); }); });
    var lastNoted = "";
    notes.forEach(function (n) { var d = noteDate(n); if (d > lastNoted) lastNoted = d; });
    var lat = Number(p.lat), lng = Number(p.lng);
    var hasCoords = isFinite(lat) && isFinite(lng) && p.lat != null && p.lng != null && !(lat === 0 && lng === 0);
    return {
      id: p.id, name: p.name, area: p.area, areaLabel: areaLabel(p.area), category: p.category,
      catIcon: catIcon(p.category), catColor: catColor(p.category), catImg: catImg(p.category),
      lat: hasCoords ? lat : null, lng: hasCoords ? lng : null, hasCoords: hasCoords,
      chosung: chosung(String(p.name || "")),
      /* 화면에 쓰는 지역: "그 외"에 실제 위치 메모가 있으면 그 위치("용산 이태원")만. "그 외 지역"은 필터에서만 쓴다 */
      areaText: p.area === "그 외" && locationNote ? locationNote : areaLabel(p.area),
      address: address,
      locationNote: locationNote,
      priceLevel: lv, priceText: priceText(lv), priceNote: trim(p.price_note),
      closed: !!p.closed, author: trim(p.author), created_at: p.created_at || "",
      visitCount: Number(p.visit_count) || 0, lastVisit: p.last_visit || "",
      mapUrl: mapUrl(p), hasMapLink: !!p.map_url,
      notes: notes, reviews: reviews, latest: latest, menus: menus, tips: tips, again: again,
      menuNotes: menuNotes, showMenuSection: uncovered.length > 0 || menuNotes >= 2,
      lastNoted: lastNoted,
      curatedCount: notes.filter(function (n) { return n.source === "curated"; }).length,
      pendingCount: notes.filter(function (n) { return n.pending; }).length,
      raw: row
    };
  }

  /* 목록 한 줄에 쓰는 한줄평 자리: 한줄평 → 없으면 추천 메뉴 → 없으면 '한줄평 없음'.
     menuLine: 한줄평 글에 안 들어 있는 추천 메뉴가 있을 때만 "추천 메뉴 …" 한 줄을 앞에 둔다 (겹치면 한쪽만) */
  function placeLine(v) {
    if (v.latest) {
      // 규칙(CONTENT_FORMAT 1.2-5): 한줄평 글에 안 들어 있는 메뉴가 하나라도 있으면 추천 메뉴 전체를 한 줄로. 전부 들어 있으면(겹치면) 줄을 두지 않는다
      var extra = v.menus.some(function (m) { return !textHas(v.latest.review, m); });
      return { kind: "review", text: v.latest.review, by: v.latest.by, date: v.latest.date, menuLine: extra ? v.menus.join(", ") : "" };
    }
    if (v.menus.length) return { kind: "menu", text: "추천 메뉴 " + v.menus.join(", "), by: (v.notes[0] && v.notes[0].by) || "", date: (v.notes[0] && v.notes[0].date) || "", menuLine: "" };
    return { kind: "empty", text: "한줄평 없음", by: "", date: "", menuLine: "" };
  }

  /* ── 소식 ── */
  var POST_TYPES = {
    "공지":   { kind: "notice", label: "공지" },
    "벙 소식": { kind: "bung",   label: "모임 모집" },
    "후기":   { kind: "review", label: "모임 후기" },
    "정보":   { kind: "info",   label: "정보" },
    "자유":   { kind: "free",   label: "자유" }
  };
  function postType(cat) { return POST_TYPES[cat] || POST_TYPES["자유"]; }
  function catLabel(cat) { return postType(cat).label; }
  /* 카테고리와 kind 가 맞는 meta 만 쓴다. 옛 글의 meta 는 kind 가 bung 뿐이다 */
  function postMeta(post) {
    var m = post && post.meta;
    if (!m || typeof m !== "object") return null;
    var t = postType(post.category);
    if (t.kind === "free") return null;
    if (m.kind && m.kind !== t.kind) return null;
    return m;
  }
  function bungState(m, today) {
    if (!m || !m.date) { var c0 = !!(m && m.status === "closed"); return { days: null, label: c0 ? "모집 마감" : "날짜 미정", past: false, closed: c0 }; }
    var d = daysFromToday(m.date, today);
    var past = d !== null && d < 0;
    var closed = m.status === "closed";
    var label = past ? "지난 모임" : closed ? "모집 마감" : d === 0 ? "오늘" : d === 1 ? "내일" : d > 1 ? "D-" + d : "";
    return { days: d, label: label, past: past, closed: closed };
  }
  /* 홈의 '다가오는 모임' 조건 — 소식 글쓰기 안내문(news.html TYPE_DESC)과 같은 말로 유지한다:
     모임 모집 글 + 모임 날짜가 오늘 이후 + 마감 아님. 오늘 모임은 시간이 아직 지나지 않은 것만. 시간이 없으면 그날 하루 종일 */
  function isUpcoming(v, today, nowHM) {
    if (!v || v.kind !== "bung" || !v.meta || !v.meta.date) return false;
    if (v.meta.status === "closed" || v.meta.date < today) return false;
    if (v.meta.date === today && nowHM && /^\d{2}:\d{2}$/.test(String(v.meta.time || "")) && v.meta.time < nowHM) return false;
    return true;
  }
  /* 상세에 표 형태로 놓는 사실 항목. 있는 것만 담긴다 */
  function postFacts(post, today) {
    var m = postMeta(post);
    if (!m) return [];
    var t = postType(post.category).kind, f = [];
    if (t === "bung") {
      var when = m.date ? dateText(m.date, { withDow: true }) + (m.time ? " " + m.time : "") : (m.time || "");
      if (when) f.push({ key: "when", label: "날짜와 시간", value: when });
      if (m.place) f.push({ key: "place", label: "장소", value: m.place });
      if (m.cap) f.push({ key: "cap", label: "모집 인원", value: m.cap + "명" });
      if (m.cost) f.push({ key: "cost", label: "예상 비용", value: m.cost });
      f.push({ key: "host", label: "모임장", value: post.author || "" });
      f.push({ key: "apply", label: "신청 방법", value: m.apply || "오픈채팅 공지의 참석 버튼" });
      if (m.bring) f.push({ key: "bring", label: "준비물과 유의사항", value: m.bring });
      if (m.status) f.push({ key: "status", label: "모집 상태", value: m.status === "closed" ? "마감" : "모집 중" });
    } else if (t === "notice") {
      if (m.audience) f.push({ key: "audience", label: "적용 대상", value: m.audience });
      var period = m.from ? dateText(m.from, { withYear: true }) + (m.to ? " ~ " + dateText(m.to, { withYear: true }) : "부터") : (m.to ? dateText(m.to, { withYear: true }) + "까지" : "");
      if (period) f.push({ key: "period", label: m.from && m.to ? "적용 기간" : "적용일", value: period });
      if (m.action) f.push({ key: "action", label: "필요한 행동", value: m.action });
    } else if (t === "review") {
      if (m.activity) f.push({ key: "activity", label: "모임이나 활동", value: m.activity });
      if (m.date) f.push({ key: "date", label: "날짜", value: dateText(m.date, { withYear: true, withDow: true }) });
      if (m.place) f.push({ key: "place", label: "장소", value: m.place });
      if (m.link) f.push({ key: "link", label: "관련 링크", value: m.link, href: m.link });
    } else if (t === "info") {
      if (m.source) f.push({ key: "source", label: "출처", value: m.source });
      if (m.link) f.push({ key: "link", label: "관련 링크", value: m.link, href: m.link });
      if (m.until) f.push({ key: "until", label: "유효 기간", value: dateText(m.until, { withYear: true }) + "까지" });
    }
    return f;
  }
  /* 목록의 보조 한 줄. 유형마다 가장 먼저 궁금한 것 하나 */
  function postSubline(post, today) {
    var m = postMeta(post);
    var t = postType(post.category).kind;
    if (t === "bung" && m) {
      var st = bungState(m, today);
      var bits = [];
      if (m.date) bits.push(dateText(m.date, { withDow: true }) + (m.time ? " " + m.time : ""));
      else if (m.time) bits.push(m.time);
      if (m.place) bits.push(m.place);
      return { text: bits.join(", "), state: st.label, past: st.past || st.closed };
    }
    if (t === "notice" && m) {
      if (m.summary) return { text: m.summary, state: m.from ? dateText(m.from) + "부터" : "", past: false };
      if (m.from) return { text: dateText(m.from, { withYear: true }) + "부터", state: "", past: false };
    }
    if (t === "info" && m) {
      var s = m.summary || "";
      var untilPast = m.until && daysFromToday(m.until, today) < 0;
      return { text: s, state: m.until ? dateText(m.until) + "까지" : "", past: !!untilPast };
    }
    if (t === "review" && m) {
      var r = [];
      if (m.activity) r.push(m.activity);
      if (m.date) r.push(dateText(m.date));
      if (m.place) r.push(m.place);
      if (r.length) return { text: r.join(", "), state: "", past: false };
    }
    return { text: "", state: "", past: false };
  }
  function excerpt(body, max) {
    var t = String(body == null ? "" : body).replace(/\s+/g, " ").trim();
    max = max || 90;
    return t.length > max ? t.slice(0, max) + "..." : t;
  }
  function postView(post, today) {
    today = today || kstToday();
    var m = postMeta(post);
    var sub = postSubline(post, today);
    return {
      id: post.id, category: post.category, kind: postType(post.category).kind, label: catLabel(post.category),
      title: post.title || "", body: post.body || "", author: post.author || "", pinned: !!post.pinned,
      created_at: post.created_at, updated_at: post.updated_at,
      meta: m, facts: postFacts(post, today), subline: sub, excerpt: excerpt(post.body),
      bung: postType(post.category).kind === "bung" && m ? bungState(m, today) : null,
      comment_count: Number(post.comment_count) || 0, reaction_count: Number(post.reaction_count) || 0,
      raw: post
    };
  }

  /* ── 서버 형식 확인 ── */
  var capsPromise = null;
  function caps() {
    if (capsPromise) return capsPromise;
    var S = window.SUPA;
    if (!S) { capsPromise = Promise.resolve({ contentFormat: 1 }); return capsPromise; }
    capsPromise = fetch(S.url + "/rest/v1/site_schema_v?select=key,value", {
      headers: { apikey: S.anon, Authorization: "Bearer " + S.anon }
    }).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (rows) {
        var v = 1, loc = false;
        (Array.isArray(rows) ? rows : []).forEach(function (x) {
          if (x.key === "content_format") v = Number(x.value) || 1;
          if (x.key === "places_location") loc = Number(x.value) >= 1;
        });
        return { contentFormat: v, location: loc };
      })
      .catch(function () { return { contentFormat: 1, location: false }; });
    return capsPromise;
  }

  /* ── 이번 주 글감 — ISO 주차로 돌아가며 하나씩. 소식(글감 카드)과 홈(글감 줄)이 같은 것을 보여 준다 ── */
  var PROMPTS = [
    { cat: "자유", title: "요즘 자주 가는 동네 가게" },
    { cat: "후기", title: "최근 다녀온 모임 한 줄 후기" },
    { cat: "정보", title: "이번 주말 가 볼 만한 곳" },
    { cat: "자유", title: "동네에서 발견한 산책 코스" },
    { cat: "정보", title: "혼자 가기 좋은 밥집" },
    { cat: "자유", title: "요즘 빠져 있는 취미" },
    { cat: "벙 소식", title: "이런 모임 열어 볼까요?" },
    { cat: "정보", title: "동네 행사와 축제 소식" },
    { cat: "자유", title: "지난 모임에서 가장 웃겼던 순간" },
    { cat: "정보", title: "요즘 볼만한 영화와 전시" },
    { cat: "자유", title: "새로 온 멤버에게 해 주고 싶은 말" },
    { cat: "후기", title: "이번 달 모임 정리" }
  ];
  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }
  function weeklyPrompt(date) { return PROMPTS[isoWeek(date || new Date()) % PROMPTS.length]; }

  window.EXCER_CONTENT = {
    AREAS: AREAS, CATS: CATS, POST_TYPES: POST_TYPES, CAT_COLOR: CAT_COLOR, PROMPTS: PROMPTS, weeklyPrompt: weeklyPrompt,
    catIcon: catIcon, catColor: catColor, catImg: catImg, chosung: chosung, isChosungQuery: isChosungQuery, nickSuggest: nickSuggest,
    esc: esc, slash: slash, areaLabel: areaLabel, priceText: priceText, priceLevel: priceLevel, textHas: textHas, menuItems: menuItems, menusIn: menusIn,
    dateText: dateText, relTime: relTime, kstToday: kstToday, kstNowHM: kstNowHM, daysFromToday: daysFromToday,
    loadCurated: loadCurated, curatedKey: curatedKey, noteView: noteView, noteText: noteText, noteDate: noteDate,
    placeView: placeView, placeLine: placeLine, mapUrl: mapUrl,
    looksLikeAddress: looksLikeAddress,
    postType: postType, catLabel: catLabel, postMeta: postMeta, postFacts: postFacts, postSubline: postSubline, postView: postView,
    bungState: bungState, isUpcoming: isUpcoming, excerpt: excerpt, caps: caps
  };
})();
