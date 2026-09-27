/* ============================================================
   운영 대시보드 시트 연동 (구글 앱스 스크립트)
   ------------------------------------------------------------
   하는 일: 구글 시트의 탭(멤버, 벙, 이슈)마다 보이는 값을 통째로 운영 대시보드 서버에 보낸다.
     시트가 바뀔 때마다(변경 트리거) 보내고, 5분마다 한 번 더 본다. 바뀐 것이 없어도 10분마다 한 번 알린다.
     통째로 보내므로 몇 번 빠져도 다음 한 번에 전부 따라잡는다.
     날짜 칸은 표시 형식과 상관없이 2026-09-27 꼴로, 병합한 칸은 병합한 범위 전체에 같은 값으로 보낸다.
     숨긴 탭과 차트 탭은 보내지 않는다. 멤버, 벙, 이슈라는 이름의 탭이 있으면 그 탭들만 보낸다.
   가진 것: 연동 토큰 하나(스크립트 속성 SYNC_TOKEN). 운영진 비밀번호는 여기에 두지 않는다.
     이 토큰으로는 시트 판을 넣는 것 말고 서버에서 아무것도 읽지 못한다.

   설치(한 번)
   1. script.google.com 에서 새 프로젝트를 만들고 이 파일 내용을 붙여넣는다(운영 대시보드 > 시트 > 연동 설정의 복사 단추).
      시트의 확장 프로그램 > Apps Script(시트에 붙인 스크립트)에는 넣지 않는다. 시트를 고칠 수 있는 사람 누구나
      그 스크립트를 고쳐 설치한 사람의 권한으로 돌릴 수 있기 때문이다.
   2. 프로젝트 설정 > 스크립트 속성에 둘을 넣는다.
        SYNC_TOKEN : 운영 대시보드 > 시트 > 연동 설정에서 만든 토큰
        SHEET_ID   : 시트 주소의 /d/ 와 /edit 사이 글자
   3. (권장) 프로젝트 설정에서 'appsscript.json 매니페스트 파일 표시'를 켜고, 편집기의 appsscript.json 을
      대시보드에서 복사한 매니페스트로 바꾼다. 권한이 시트, 외부 연결, 트리거 셋으로 정해진다.
      (시트를 ID 로 여는 openById 는 읽기 전용 권한으로는 안 된다. 이 스크립트는 시트를 읽기만 하고 고치지 않는다.)
   4. 위의 함수 고르기에서 install 을 고르고 실행한다. 권한을 물으면 허용한다.
      실행 기록에 '보냄' 이 보이면 끝이다. 대시보드 시트 탭에 바로 나타난다.
   멈추려면 uninstall, 지금 한 번 보내려면 syncNow 를 실행한다. 이 파일을 새 판으로 바꿨으면 install 을 한 번 다시 실행한다.
   ============================================================ */

var CFG = {
  url: "https://drggzlnzwvkhtalvkqyo.supabase.co",
  keySource: "https://excer-site.vercel.app/assets/site-core.js",   // 공개 접속 키(anon)는 사이트에서 읽어 온다. 긴 키를 코드에 붙여넣지 않는다
  heartbeatMs: 10 * 60 * 1000,
  tabs: ["멤버", "벙", "이슈"],   // 이 이름의 탭이 있으면 이 탭들만 보낸다(다른 탭은 서버에 남기지 않음)
  version: "3"
};

function install() {
  uninstall();
  var id = prop_("SHEET_ID");
  if (!id) throw new Error("스크립트 속성에 SHEET_ID 를 먼저 넣어 주세요");
  // 시트가 바뀔 때마다(누가 고치든) 보내고, 5분마다 한 번 더 본다. 1분 트리거보다 하루 실행 시간 한도에 여유가 있다
  ScriptApp.newTrigger("onSheetChange").forSpreadsheet(id).onChange().create();
  ScriptApp.newTrigger("sync").timeBased().everyMinutes(5).create();
  var r = sync_(true);
  Logger.log(r);
}

function uninstall() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === "sync" || f === "onSheetChange") ScriptApp.deleteTrigger(t);
  });
}

function syncNow() { Logger.log(sync_(true)); }
function sync() { sync_(false); }
// 바뀜 표시를 남기고 보낸다. 다른 실행이 보내는 중이면 그 실행이 끝에서 한 번 더 보낸다
function onSheetChange() { PropertiesService.getScriptProperties().setProperty("DIRTY", "1"); sync_(false); }

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function sync_(force) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(force ? 20000 : 2000)) return "다른 실행이 보내는 중(끝나면 한 번 더 보냄)";
  var props = PropertiesService.getScriptProperties(), res = "", rounds = 0;
  try {
    do { props.deleteProperty("DIRTY"); res = send_(props, force); force = false; rounds += 1; }
    while (props.getProperty("DIRTY") && rounds < 3);
    return res;
  } finally {
    lock.releaseLock();
  }
}

function send_(props, force) {
  var token = props.getProperty("SYNC_TOKEN");
  try {
    if (!token) throw new Error("NO_TOKEN: 스크립트 속성에 SYNC_TOKEN 이 없습니다");
    var id = props.getProperty("SHEET_ID");
    if (!id) throw new Error("스크립트 속성에 SHEET_ID 가 없습니다");
    var ss = SpreadsheetApp.openById(id);

    var now = Date.now();
    var lastAt = +(props.getProperty("LAST_SENT_AT") || 0);
    var t0 = Date.now();
    var tz = ss.getSpreadsheetTimeZone();
    var sheets = ss.getSheets().filter(function (sh) { return !sh.isSheetHidden() && sh.getType() === SpreadsheetApp.SheetType.GRID; });
    var named = sheets.filter(function (sh) { return CFG.tabs.indexOf(sh.getName().replace(/\s+/g, "")) >= 0; });
    if (named.length) sheets = named;
    var tabs = sheets.map(function (sh) { return { name: sh.getName(), values: trim_(read_(sh, tz)) }; });
    var body = JSON.stringify(tabs);
    var hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, body, Utilities.Charset.UTF_8));
    if (!force && hash === props.getProperty("LAST_HASH") && now - lastAt < CFG.heartbeatMs) return "바뀐 것 없음";
    var meta = { v: CFG.version, title: ss.getName(), tz: tz, sentAt: new Date().toISOString(), readMs: Date.now() - t0,
      fails: +(props.getProperty("FAILS") || 0), lastError: props.getProperty("LAST_ERROR") || "" };
    var r = post_({ p_token: token, p_tabs: tabs, p_meta: meta });
    if (!r.ok) throw new Error("서버가 받지 않았습니다: " + (r.error || "알 수 없음"));
    props.setProperties({ LAST_HASH: hash, LAST_SENT_AT: String(now), FAILS: "0", LAST_ERROR: "" });
    return r.changed ? "보냄(새 판 " + r.id + ")" : "보냄(바뀐 것 없음, 받은 시각만 알림)";
  } catch (e) {
    var msg = String(e && e.message || e).slice(0, 400);
    props.setProperties({ FAILS: String(+(props.getProperty("FAILS") || 0) + 1), LAST_ERROR: msg });
    // 오류도 서버에 남겨 대시보드에서 보이게 한다. 토큰이 틀렸거나 막힌 것은 같은 토큰으로 또 보내면 막힘만 길어지므로 보내지 않는다
    if (token && !/BAD_TOKEN|LOCKED|NO_TOKEN/.test(msg)) { try { post_({ p_token: token, p_tabs: null, p_meta: { v: CFG.version, error: msg, at: new Date().toISOString() } }); } catch (e2) {} }
    Logger.log("오류: " + msg);
    return "오류: " + msg;
  }
}

/* 탭 하나 읽기: 보이는 값. 날짜 칸은 2026-09-27 꼴로, 병합한 칸은 범위 전체에 왼쪽 위 값 */
function read_(sh, tz) {
  var rg = sh.getDataRange(), disp = rg.getDisplayValues(), vals = rg.getValues();
  for (var r = 0; r < vals.length; r++) for (var c = 0; c < vals[r].length; c++) {
    var v = vals[r][c];
    if (Object.prototype.toString.call(v) === "[object Date]" && v.getFullYear() >= 1990) disp[r][c] = Utilities.formatDate(v, tz, "yyyy-MM-dd");
  }
  rg.getMergedRanges().forEach(function (m) {
    var r0 = m.getRow() - 1, c0 = m.getColumn() - 1, top = (disp[r0] || [])[c0];
    for (var i = 0; i < m.getNumRows(); i++) for (var j = 0; j < m.getNumColumns(); j++) if (disp[r0 + i] && (i || j)) disp[r0 + i][c0 + j] = top;
  });
  return disp;
}

/* 뒤쪽의 빈 줄과 빈 칸은 뺀다 */
function trim_(rows) {
  var last = rows.length;
  while (last > 0 && rows[last - 1].join("").trim() === "") last--;
  rows = rows.slice(0, last);
  var w = 0;
  rows.forEach(function (r) { for (var i = r.length - 1; i >= w; i--) if (String(r[i]).trim() !== "") { w = i + 1; break; } });
  return rows.map(function (r) { return r.slice(0, w); });
}

/* 공개 접속 키(anon): 사이트의 site-core.js 에서 읽어 스크립트 속성 ANON_KEY 에 둔다 */
function anonKey_(fresh) {
  var props = PropertiesService.getScriptProperties();
  var k = props.getProperty("ANON_KEY");
  if (k && !fresh) return k;
  var res = UrlFetchApp.fetch(CFG.keySource, { muteHttpExceptions: true });
  var m = res.getResponseCode() === 200 && res.getContentText().match(/anon:\s*"([A-Za-z0-9._-]{40,})"/);
  if (!m) throw new Error("사이트에서 접속 키를 읽지 못했습니다(HTTP " + res.getResponseCode() + ")");
  props.setProperty("ANON_KEY", m[1]);
  return m[1];
}

/* 보내기: 연결이 흔들리면 3번까지(2초, 5초 쉬고) 다시. 키가 틀렸다고 하면 사이트에서 한 번 다시 읽는다 */
function post_(payload) {
  var waits = [0, 2000, 5000], last = null, refetch = false, refreshed = false;
  for (var i = 0; i < waits.length; i++) {
    if (waits[i]) Utilities.sleep(waits[i]);
    try {
      var key = anonKey_(refetch); refetch = false;
      var res = UrlFetchApp.fetch(CFG.url + "/rest/v1/rpc/ops_sheet_push", { method: "post", contentType: "application/json", muteHttpExceptions: true,
        payload: JSON.stringify(payload), headers: { apikey: key, Authorization: "Bearer " + key } });
      var code = res.getResponseCode();
      if (code >= 200 && code < 300) return JSON.parse(res.getContentText() || "{}");
      last = "HTTP " + code + " " + res.getContentText().slice(0, 200);
      if (code === 401 && !refreshed) { refreshed = true; refetch = true; continue; }
      if (code < 500 && code !== 429) break;   // 요청이 틀린 것은 다시 해도 같다
    } catch (e) { last = String(e && e.message || e); }
  }
  throw new Error(last || "보내지 못했습니다");
}
