/* ============================================================
   운영 대시보드 시트 연동 (구글 앱스 스크립트)
   ------------------------------------------------------------
   하는 일: 구글 시트의 탭마다 보이는 값을 통째로 운영 대시보드 서버에 보낸다.
     1분마다 시트가 바뀌었는지 보고, 바뀌었을 때만 보낸다. 바뀐 것이 없어도 10분마다 한 번 알린다.
     통째로 보내므로 몇 번 빠져도 다음 한 번에 전부 따라잡는다.
   가진 것: 연동 토큰 하나(스크립트 속성 SYNC_TOKEN). 운영진 비밀번호는 여기에 두지 않는다.
     이 토큰으로는 시트 판을 넣는 것 말고 서버에서 아무것도 읽지 못한다.

   설치(한 번)
   1. script.google.com 에서 새 프로젝트를 만들고 이 파일 내용을 붙여넣는다(운영 대시보드 > 시트 > 연동 설정의 복사 단추).
      (시트 편집 권한이 있으면 시트의 확장 프로그램 > Apps Script 에 붙여넣어도 된다.)
   2. 프로젝트 설정 > 스크립트 속성에 둘을 넣는다.
        SYNC_TOKEN : 운영 대시보드 > 시트 > 연동 설정에서 만든 토큰
        SHEET_ID   : 시트 주소의 /d/ 와 /edit 사이 글자 (시트에 붙인 스크립트면 비워도 된다)
   3. (권장) 프로젝트 설정에서 'appsscript.json 매니페스트 파일 표시'를 켜고, 편집기의 appsscript.json 을
      대시보드에서 복사한 매니페스트로 바꾼다. 권한이 시트, 외부 연결, 트리거 셋으로 정해진다.
      (시트를 ID 로 여는 openById 는 읽기 전용 권한으로는 안 된다. 이 스크립트는 시트를 읽기만 하고 고치지 않는다.)
   4. 위의 함수 고르기에서 install 을 고르고 실행한다. 권한을 물으면 허용한다.
      실행 기록에 '보냄' 이 보이면 끝이다. 대시보드 시트 탭에 바로 나타난다.
   멈추려면 uninstall, 지금 한 번 보내려면 syncNow 를 실행한다.
   ============================================================ */

var CFG = {
  url: "https://drggzlnzwvkhtalvkqyo.supabase.co",
  anon: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyZ2d6bG56d3ZraHRhbHZrcXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjI1MzcsImV4cCI6MjA5NzUzODUzN30.PRxFdiwhVNUoyLbOkiyJ_9PxX6QXFyI_6NMLHPmOr_E",
  heartbeatMs: 10 * 60 * 1000,
  version: "1"
};

function install() {
  uninstall();
  ScriptApp.newTrigger("sync").timeBased().everyMinutes(1).create();
  // 시트에 붙인 스크립트면 고칠 때마다 바로 보낸다(1분을 기다리지 않음)
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss && !prop_("SHEET_ID")) ScriptApp.newTrigger("onSheetChange").forSpreadsheet(ss).onChange().create();
  } catch (e) {}
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
function onSheetChange() { Utilities.sleep(3000); sync_(false); }   // 붙여넣기처럼 여러 칸이 한꺼번에 바뀔 때를 위해 잠깐 기다린다

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function sync_(force) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return "다른 실행이 보내는 중";
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("SYNC_TOKEN");
  try {
    if (!token) throw new Error("스크립트 속성에 SYNC_TOKEN 이 없습니다");
    var id = props.getProperty("SHEET_ID");
    var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error("시트를 찾지 못했습니다. 스크립트 속성 SHEET_ID 를 확인해 주세요");

    var now = Date.now();
    var lastAt = +(props.getProperty("LAST_SENT_AT") || 0);
    var t0 = Date.now();
    var tabs = ss.getSheets().map(function (sh) {
      return { name: sh.getName(), hidden: sh.isSheetHidden(), values: trim_(sh.getDataRange().getDisplayValues()) };
    });
    var body = JSON.stringify(tabs);
    var hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, body, Utilities.Charset.UTF_8));
    if (!force && hash === props.getProperty("LAST_HASH") && now - lastAt < CFG.heartbeatMs) return "바뀐 것 없음";
    var meta = { v: CFG.version, title: ss.getName(), tz: ss.getSpreadsheetTimeZone(), sentAt: new Date().toISOString(), readMs: Date.now() - t0,
      fails: +(props.getProperty("FAILS") || 0), lastError: props.getProperty("LAST_ERROR") || "" };
    var r = post_({ p_token: token, p_tabs: tabs, p_meta: meta });
    if (!r.ok) throw new Error("서버가 받지 않았습니다: " + (r.error || "알 수 없음"));
    props.setProperties({ LAST_HASH: hash, LAST_SENT_AT: String(now), FAILS: "0", LAST_ERROR: "" });
    return r.changed ? "보냄(새 판 " + r.id + ")" : "보냄(바뀐 것 없음, 받은 시각만 알림)";
  } catch (e) {
    var msg = String(e && e.message || e).slice(0, 400);
    props.setProperties({ FAILS: String(+(props.getProperty("FAILS") || 0) + 1), LAST_ERROR: msg });
    // 오류도 서버에 남겨 대시보드에서 보이게 한다. 이것마저 실패하면 다음 실행에서 다시 한다
    if (token) { try { post_({ p_token: token, p_tabs: null, p_meta: { v: CFG.version, error: msg, at: new Date().toISOString() } }); } catch (e2) {} }
    Logger.log("오류: " + msg);
    return "오류: " + msg;
  } finally {
    lock.releaseLock();
  }
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

/* 보내기: 연결이 흔들리면 3번까지(2초, 5초 쉬고) 다시 */
function post_(payload) {
  var opts = { method: "post", contentType: "application/json", muteHttpExceptions: true, payload: JSON.stringify(payload),
    headers: { apikey: CFG.anon, Authorization: "Bearer " + CFG.anon } };
  var waits = [0, 2000, 5000], last = null;
  for (var i = 0; i < waits.length; i++) {
    if (waits[i]) Utilities.sleep(waits[i]);
    try {
      var res = UrlFetchApp.fetch(CFG.url + "/rest/v1/rpc/ops_sheet_push", opts);
      var code = res.getResponseCode();
      if (code >= 200 && code < 300) return JSON.parse(res.getContentText() || "{}");
      last = "HTTP " + code + " " + res.getContentText().slice(0, 200);
      if (code < 500 && code !== 429) break;   // 요청이 틀린 것은 다시 해도 같다
    } catch (e) { last = String(e && e.message || e); }
  }
  throw new Error(last || "보내지 못했습니다");
}
