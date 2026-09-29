/* ============================================================
   excer-bot: 사이트의 모임 모집(벙) 글을 읽어 오픈채팅방에 알린다
   ------------------------------------------------------------
   돌리는 곳: 안드로이드 폰의 메신저봇R. 봇 전용 카카오 계정으로 로그인한 카카오톡의 알림을 받아 그 알림으로 답한다.
   하는 일
     1. 사이트에 새 벙이 올라오면 방에 알린다. 날짜, 시간, 장소가 바뀌거나 마감되면 그것도 알린다.
     2. 매일 정한 시각(DIGEST_AT) 뒤 첫 메시지에 다가오는 벙 목록을 보낸다.
     3. 방에서 누가 !벙, /벙, 벙 일정, 벙 확인 이라고 치면 다가오는 벙 목록으로 답한다.
   방에 메시지가 올 때 함께 확인한다(CHECK_MIN 분에 한 번). 그래서 봇을 끄면 확실히 멈추고, 방이 조용하면 알림이 조금 늦다.
   방 공지 등록은 하지 못한다(카카오톡에 그런 연결이 없다). 봇이 보낸 목록을 방장이나 부방장이 길게 눌러 공지로 올린다.
   가진 것: 없음. 사이트의 공개 글만 읽는다. 공개 접속 키는 사이트에서 읽어 온다. 운영진 비밀번호는 여기에 두지 않는다.

   설치(한 번)
   1. 봇 계정으로 카카오톡에 로그인한 안드로이드 폰에 메신저봇R 을 깔고 알림 접근 권한을 준다.
      배터리 최적화에서 메신저봇R 과 카카오톡을 뺀다. 봇 계정 카카오톡에서 이 방의 알림을 켠다(끄면 봇이 메시지를 못 받는다).
   2. 메신저봇R 에서 봇을 새로 만들고 이 파일 내용을 통째로 붙여넣는다. 레거시 API, API2 둘 다 된다.
   3. 컴파일하고 켠 뒤 방에서 !방이름 이라고 친다. 봇이 방 이름을 답하면 아래 CFG.ROOM 의 따옴표 안에 그대로 넣고 다시 컴파일한다.
      방 이름을 바꾸면 여기도 바꾼다. 처음 켤 때 이미 올라와 있던 글은 알리지 않는다.
   ============================================================ */

var CFG = {
  ROOM: "",                                   // 알릴 방 이름. 비워 두면 !방이름 에만 답한다
  SITE: "https://excer-site.vercel.app",
  SUPA: "https://drggzlnzwvkhtalvkqyo.supabase.co",
  CHECK_MIN: 3,                               // 새 벙을 몇 분에 한 번 볼지
  DIGEST_AT: "10:00",                         // 매일 목록을 보낼 시각(한국 시간). "" 이면 보내지 않는다
  DIGEST_LATE_MIN: 180,                       // 이 시각에서 이만큼 지나도록 메시지가 없으면 그날 목록은 건너뛴다
  DIGEST_EMPTY: true,                         // 다가오는 벙이 없어도 매일 목록을 보낼지
  MAX_LINES: 15,                              // 목록 줄 수 한도(넘으면 "외 N건")
  QUIET: ["00:00", "07:00"],                  // 이 사이에는 알리지 않는다(끝난 뒤 첫 메시지에 몰아서). [] 이면 없음
  COMMANDS: ["!벙", "/벙", "벙일정", "!벙일정", "벙확인"],   // 띄어쓰기는 보지 않는다
  COOLDOWN_SEC: 30,                           // 명령에 다시 답하기까지
  NOTIFY_NEW: true, NOTIFY_CHANGE: true, NOTIFY_CLOSED: true,
  STATE_FILE: "/sdcard/msgbot/excer-bot.json"
};

var DOW = ["일", "월", "화", "수", "목", "금", "토"];
var mem = { st: null, key: "", posts: null, postsAt: 0, failAt: 0, lastCheck: 0, cmdAt: 0, lastKey: "", lastKeyAt: 0 };

/* ── 시각(한국 시간) ── */
function pad(n) { return (n < 10 ? "0" : "") + n; }
function kst() {
  var d = new Date(Date.now() + 9 * 3600000);
  return { ymd: d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()), hm: pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) };
}
function mins(hm) { var p = String(hm).split(":"); return (+p[0]) * 60 + (+p[1]); }
function md(ymd) {
  var p = ymd.split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return (+p[1]) + "/" + (+p[2]) + "(" + DOW[d.getUTCDay()] + ")";
}
function inQuiet(hm) {
  var q = CFG.QUIET;
  if (!q || q.length !== 2 || q[0] === q[1]) return false;
  return q[0] < q[1] ? (hm >= q[0] && hm < q[1]) : (hm >= q[0] || hm < q[1]);
}

/* ── 기록(봇 폰의 파일 하나) ── */
function load() {
  if (mem.st) return mem.st;
  var st = null;
  try { var s = FileStream.read(CFG.STATE_FILE); if (s) st = JSON.parse(String(s)); } catch (e) { st = null; }
  if (!st || typeof st !== "object") st = {};
  if (!st.known || typeof st.known !== "object") st.known = {};
  mem.st = st;
  return st;
}
function save(st) { try { FileStream.write(CFG.STATE_FILE, JSON.stringify(st)); } catch (e) { log("기록 저장 실패: " + e); } }
function log(s) { try { Log.i("[excer-bot] " + s); } catch (e) {} }

/* ── 사이트 읽기 ── */
function http(url, key) {
  var c = org.jsoup.Jsoup.connect(url).ignoreContentType(true).ignoreHttpErrors(true).timeout(10000).maxBodySize(0);
  if (key) c = c.header("apikey", key).header("Authorization", "Bearer " + key);
  var res = c.execute();
  return { code: Number(res.statusCode()), body: String(res.body()) };
}
function anonKey(fresh) {
  if (mem.key && !fresh) return mem.key;
  var r = http(CFG.SITE + "/assets/site-core.js", "");
  var m = r.code === 200 && /anon:\s*"([A-Za-z0-9._-]{40,})"/.exec(r.body);
  if (!m) throw new Error("사이트에서 접속 키를 읽지 못함(HTTP " + r.code + ")");
  mem.key = m[1];
  return mem.key;
}
function clean(s, n) {
  var t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "..." : t;
}
function norm(p) {
  if (!p || p.id == null) return null;
  var m = p.meta && typeof p.meta === "object" ? p.meta : {};
  if (m.kind && m.kind !== "bung") m = {};
  return {
    id: String(p.id), title: clean(p.title, 40) || "제목 없음", author: clean(p.author, 20),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(m.date || "")) ? String(m.date) : "",
    time: /^\d{2}:\d{2}$/.test(String(m.time || "")) ? String(m.time) : "",
    place: clean(m.place, 40), cap: +m.cap > 0 ? Math.round(+m.cap) : 0, closed: m.status === "closed"
  };
}
/* 모임 모집 글 최근 100개. 1분 안에 읽은 것이 있으면 그것을 쓰고, 실패하면 1분 동안 다시 읽지 않는다 */
function getPosts() {
  var t = Date.now();
  if (mem.posts && t - mem.postsAt < 60000) return mem.posts;
  if (t - mem.failAt < 60000) return null;
  try {
    var url = CFG.SUPA + "/rest/v1/site_posts_v?select=id,title,author,meta,created_at&category=eq." + encodeURIComponent("벙 소식") + "&order=created_at.desc&limit=100";
    var r = http(url, anonKey(false));
    if (r.code === 401) r = http(url, anonKey(true));
    if (r.code < 200 || r.code >= 300) throw new Error("HTTP " + r.code + " " + r.body.slice(0, 120));
    var rows = JSON.parse(r.body);
    if (!Array.isArray(rows)) throw new Error("모양이 다름");
    mem.posts = rows.map(norm).filter(function (v) { return v; });
    mem.postsAt = Date.now();
    return mem.posts;
  } catch (e) {
    mem.failAt = Date.now();
    log("읽기 실패: " + e);
    return null;
  }
}

/* ── 문구 ── */
function upcoming(v, now) {
  if (!v.date || v.closed || v.date < now.ymd) return false;
  return !(v.date === now.ymd && v.time && v.time < now.hm);
}
function cmp(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  var ta = a.time || "99:99", tb = b.time || "99:99";
  if (ta !== tb) return ta < tb ? -1 : 1;
  return +a.id - +b.id;
}
function head(v) { return (v.date ? md(v.date) : "날짜 미정") + (v.time ? " " + v.time : "") + " " + v.title; }
function line(v) { return head(v) + (v.place ? ", " + v.place : ""); }
function postLink(v) { return CFG.SITE + "/news.html#post-" + v.id; }
function allLink() { return CFG.SITE + "/bung"; }
function listText(posts, now, always) {
  var up = posts.filter(function (v) { return upcoming(v, now); }).sort(cmp);
  if (!up.length && !always && !CFG.DIGEST_EMPTY) return "";
  var out = ["[벙 일정] " + md(now.ymd) + " 기준 " + (up.length ? up.length + "건" : "올라온 벙 없음")];
  up.slice(0, CFG.MAX_LINES).forEach(function (v) { out.push(line(v)); });
  if (up.length > CFG.MAX_LINES) out.push("외 " + (up.length - CFG.MAX_LINES) + "건");
  out.push((up.length ? "전체 " : "벙 올리기 ") + allLink());
  return out.join("\n");
}
function newText(v) {
  var info = [];
  if (v.place) info.push("장소 " + v.place);
  if (v.cap) info.push("인원 " + v.cap + "명");
  if (v.author) info.push("벙주 " + v.author);
  return "[새 벙] " + head(v) + (info.length ? "\n" + info.join(", ") : "") + "\n" + postLink(v);
}
function sig(v) { return { d: v.date, t: v.time, p: v.place, c: v.closed ? 1 : 0 }; }

/* 지난번에 본 글과 견준다. 처음(기록 없음)에는 기억만 하고 알리지 않는다 */
function diff(st, posts, now) {
  var cur = {}, news = [], chg = [], cls = [];
  posts.forEach(function (v) {
    cur[v.id] = sig(v);
    if (!st.init) return;
    var o = st.known[v.id];
    if (!o) { if (!v.closed && (!v.date || upcoming(v, now))) news.push(v); return; }
    if (v.date && v.date < now.ymd) return;                 // 지난 벙은 알리지 않는다
    if (v.closed) { if (!o.c) cls.push(v); return; }
    var parts = [];
    if (o.d !== v.date) parts.push("날짜 " + (o.d ? md(o.d) : "없음") + " 에서 " + (v.date ? md(v.date) : "없음"));
    if (o.t !== v.time) parts.push("시간 " + (o.t || "없음") + " 에서 " + (v.time || "없음"));
    if (o.p !== v.place) parts.push("장소 " + (o.p || "없음") + " 에서 " + (v.place || "없음"));
    if (o.c) parts.push("마감 풀림");
    if (parts.length) chg.push({ v: v, parts: parts });
  });
  // 목록(최근 100개) 밖으로 밀려난 글 중 날짜가 남은 것은 기억해 둔다. 다시 보여도 새 글로 알리지 않게
  Object.keys(st.known).forEach(function (id) { var o = st.known[id]; if (!cur[id] && o && o.d && o.d >= now.ymd) cur[id] = o; });
  st.known = cur;
  st.init = true;

  var out = [];
  news.sort(cmp);
  if (CFG.NOTIFY_NEW && news.length > 3) out.push(["[새 벙 " + news.length + "건]"].concat(news.map(line), ["전체 " + allLink()]).join("\n"));
  else if (CFG.NOTIFY_NEW) news.forEach(function (v) { out.push(newText(v)); });
  if (CFG.NOTIFY_CHANGE && chg.length > 3) out.push(["[벙 변경 " + chg.length + "건]"].concat(chg.map(function (c) { return head(c.v) + " (" + c.parts.join(", ") + ")"; })).join("\n"));
  else if (CFG.NOTIFY_CHANGE) chg.forEach(function (c) { out.push("[벙 변경] " + head(c.v) + "\n" + c.parts.join(", ") + "\n" + postLink(c.v)); });
  if (CFG.NOTIFY_CLOSED && cls.length > 1) out.push(["[벙 마감 " + cls.length + "건]"].concat(cls.map(head)).join("\n"));
  else if (CFG.NOTIFY_CLOSED && cls.length) out.push("[벙 마감] " + head(cls[0]));
  return out;
}
function digestDue(st, now) {
  if (!CFG.DIGEST_AT || st.lastDigest === now.ymd) return false;
  var late = mins(now.hm) - mins(CFG.DIGEST_AT);
  if (late < 0) return false;
  if (late > CFG.DIGEST_LATE_MIN) { st.lastDigest = now.ymd; save(st); return false; }
  return true;
}

/* ── 보내기 ── */
function sendAll(replier, list) {
  list.filter(function (s) { return s; }).forEach(function (s, i) {
    if (i) { try { java.lang.Thread.sleep(900); } catch (e) {} }
    replier.reply(s);
  });
}
var LOCK = null, busy = false;
try { LOCK = new java.util.concurrent.atomic.AtomicBoolean(false); } catch (e) { LOCK = null; }
function lock() { if (LOCK) return LOCK.compareAndSet(false, true); if (busy) return false; busy = true; return true; }
function unlock() { if (LOCK) LOCK.set(false); else busy = false; }

/* 메시지 하나가 올 때마다 */
function onMessage(room, msg, sender, replier) {
  room = String(room); msg = String(msg == null ? "" : msg);
  var t = Date.now(), dk = room + "\n" + sender + "\n" + msg;
  if (dk === mem.lastKey && t - mem.lastKeyAt < 1500) return;   // 같은 알림이 두 길로 들어온 것
  mem.lastKey = dk; mem.lastKeyAt = t;
  var cmd = msg.replace(/\s+/g, "");
  if (!CFG.ROOM) { if (cmd === "!방이름") replier.reply(room); return; }
  if (room !== CFG.ROOM) return;

  if (CFG.COMMANDS.indexOf(cmd) >= 0 && t - mem.cmdAt >= CFG.COOLDOWN_SEC * 1000) {
    mem.cmdAt = t;
    var ps = getPosts();
    replier.reply(ps ? listText(ps, kst(), true) : "[벙 일정] 지금은 읽지 못했습니다\n" + allLink());
  }

  if (!lock()) return;
  try {
    var now = kst(), st = load();
    if (inQuiet(now.hm)) return;
    var needCheck = t - mem.lastCheck >= CFG.CHECK_MIN * 60000, needDigest = digestDue(st, now);
    if (!needCheck && !needDigest) return;
    var posts = getPosts();
    if (!posts) return;
    mem.lastCheck = t;
    var out = diff(st, posts, now);
    if (needDigest) {
      var sameAsCmd = t - mem.cmdAt < 5000;                  // 방금 명령으로 같은 목록을 보냈으면 다시 보내지 않는다
      if (!sameAsCmd) out.push(listText(posts, now, false));
      st.lastDigest = now.ymd;
    }
    save(st);
    sendAll(replier, out);
  } catch (e) {
    log("오류: " + e);
  } finally {
    unlock();
  }
}

/* 레거시 API */
function response(room, msg, sender, isGroupChat, replier) { onMessage(room, msg, sender, replier); }

/* API2 */
(function () {
  var bot = null;
  try { bot = BotManager.getCurrentBot(); } catch (e) { bot = null; }
  if (!bot) return;
  try {
    bot.addListener(Event.MESSAGE, function (m) {
      onMessage(m.room, m.content, m.author ? m.author.name : "", { reply: function (s) { m.reply(s); } });
    });
  } catch (e) { log("API2 연결 실패: " + e); }
})();
