/* ============================================================
   동네친구들 — 공통 코어 (site-core.js)
   ------------------------------------------------------------
   8개 페이지에 똑같이 복붙돼 있던 것을 한 곳으로 모은 파일이다.
   여기가 정본이고, 페이지에 다시 복사하지 않는다.

   담는 것
     ① 서버 접속 정보 (window.SUPA)
     ② 방문자 카운터
     ③ 모달 포커스 가두기
     ④ 누름 모양과 입력 중 탭바
     ⑤ 창과 뒤로 가기(뒤로 가기는 창만 닫는다), 폰 시트 끌어 닫기
     ⑥ 맨 위로 단추
     ⑦ 뒤로 와도 보던 자리로 (window.EXCER_SCROLL)

   이 파일은 <head> 에서 defer 없이 불러야 한다.
   페이지 안의 인라인 스크립트가 window.SUPA 를 바로 쓰기 때문이다.
   (defer 를 붙이면 인라인 스크립트가 먼저 돌아 SUPA 가 undefined 가 된다)
   DOM 이 필요한 부분은 이 파일 안에서 DOMContentLoaded 를 기다린다.
   ============================================================ */
(function () {
  "use strict";

  /* ──────────────────────────────────────────────────────────
     ① 서버 접속 정보
     anon 키는 브라우저가 직접 쓰라고 만든 공개 값이다. 숨기는 값이 아니다.
     테이블은 전부 잠겨 있고 읽기는 뷰로, 쓰기는 함수로만 열려 있어서
     이 키로 할 수 있는 일은 열어 둔 함수 목록이 전부다.
     키를 바꿀 일이 생기면 이제 이 한 곳만 고치면 된다(예전엔 11개 파일이었다).
     ────────────────────────────────────────────────────────── */
  var SUPA = {
    url: "https://drggzlnzwvkhtalvkqyo.supabase.co",
    anon: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyZ2d6bG56d3ZraHRhbHZrcXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjI1MzcsImV4cCI6MjA5NzUzODUzN30.PRxFdiwhVNUoyLbOkiyJ_9PxX6QXFyI_6NMLHPmOr_E"
  };
  window.SUPA = SUPA;

  /* ──────────────────────────────────────────────────────────
     ①-2 카카오맵 JavaScript 키 (맛집의 지도·장소 검색)
     Kakao Developers > 앱(excer) > 앱 > 플랫폼 키 > JavaScript 키(Default JS Key).
     그 키의 "JavaScript SDK 도메인"에 https://excer-site.vercel.app 이 등록되어 있고,
     제품 설정 > 카카오맵 > 사용 설정이 ON 이어야 지도가 뜬다.
     브라우저용 공개 키라 여기 두어도 된다(등록한 도메인에서만 동작). 비워 두면 지도·장소 검색은 조용히 숨고 목록은 그대로 동작한다.
     ────────────────────────────────────────────────────────── */
  window.KAKAO = { jsKey: "e4503a6007811a4348ad6a777230cb5f" };

  /* ──────────────────────────────────────────────────────────
     ①-3 카카오톡 공유 (window.KSHARE)
     카카오 JavaScript SDK 는 공유 버튼을 처음 누를 때만 읽는다(지도 SDK 와 별개 파일).
     같은 JavaScript 키·같은 도메인 등록으로 동작한다.
     SDK 를 못 읽거나 키가 없으면 기기 공유 창(navigator.share) → 링크 복사 순으로 물러선다.
     share(opts) → Promise<"kakao" | "share" | "copy" | "abort" | "fail">
       opts: { title, description, url, imageUrl, buttonTitle }
     모임 카드(소식 화면의 채팅방에 공유): 소식 화면이 뜰 때 load() 로 SDK 를 미리 읽고, 누를 때 sendNow(opts). 그림은 벙 사진(assets/bung) 이나 날짜 그림(assets/cal), 글 부분은 항목 칸
     ────────────────────────────────────────────────────────── */
  var KSHARE = (function () {
    var SDK = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
    var loading = null;
    function loadSdk() {
      if (window.Kakao && window.Kakao.Share) { init(); return Promise.resolve(window.Kakao); }
      if (loading) return loading;
      loading = new Promise(function (resolve, reject) {
        if (!window.KAKAO || !window.KAKAO.jsKey) { reject(new Error("no key")); return; }
        var s = document.createElement("script");
        s.src = SDK; s.async = true;
        var t = setTimeout(function () { reject(new Error("timeout")); }, 8000);
        s.onload = function () { clearTimeout(t); try { init(); resolve(window.Kakao); } catch (e) { reject(e); } };
        s.onerror = function () { clearTimeout(t); reject(new Error("load")); };
        document.head.appendChild(s);
      });
      loading.catch(function () { loading = null; });
      return loading;
    }
    function init() { if (window.Kakao && !window.Kakao.isInitialized()) window.Kakao.init(window.KAKAO.jsKey); }
    function copy(text) {
      var p = navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(text) : Promise.reject();
      return p.then(function () { return "copy"; }).catch(function () {
        try {
          var ta = document.createElement("textarea");
          ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
          // 모달 대화상자가 열려 있으면 바깥은 비활성이라 선택이 안 된다. 열린 대화상자 안에 잠깐 넣는다
          var host = document.querySelector("dialog[open]") || document.body;
          host.appendChild(ta); ta.select();
          var ok = document.execCommand("copy"); host.removeChild(ta);
          return ok ? "copy" : "fail";
        } catch (e) { return "fail"; }
      });
    }
    function share(opts) {
      opts = opts || {};
      var url = opts.url || location.href;
      // 카드 그림: 따로 주지 않으면 그 페이지의 미리보기 그림(og:image)을 쓴다. 붙여 넣은 링크 미리보기와 같은 그림이 되게
      var og = document.querySelector('meta[property="og:image"]');
      var image = opts.imageUrl || (og && og.content) || (location.origin + "/assets/og.jpg?v=3");
      return loadSdk().then(function (Kakao) {
        Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: opts.title || document.title,
            description: opts.description || "",
            imageUrl: image,
            link: { mobileWebUrl: url, webUrl: url }
          },
          buttons: [{ title: opts.buttonTitle || "자세히 보기", link: { mobileWebUrl: url, webUrl: url } }]
        });
        return "kakao";
      }).catch(function () {
        if (navigator.share) {
          return navigator.share({ title: opts.title || document.title, text: opts.description || "", url: url })
            .then(function () { return "share"; })
            .catch(function (e) { return e && e.name === "AbortError" ? "abort" : copy(url); });
        }
        return copy(url);
      });
    }
    /* 이 기기에서 그린 그림(모임 달력 카드)을 카카오 서버에 올려 공유 카드에 쓸 주소를 받는다. 못 올리면 거절 */
    function upload(blob) {
      return loadSdk().then(function (Kakao) {
        if (!Kakao.Share.uploadImage) throw new Error("no upload");
        var file = new File([blob], "card.png", { type: blob.type || "image/png" });
        return Kakao.Share.uploadImage({ file: [file] });
      }).then(function (res) {
        var u = res && res.infos && res.infos.original && res.infos.original.url;
        if (!u) throw new Error("no url");
        return u;
      });
    }
    /* 이미 읽은 SDK 로 그 자리에서 보낸다. 카카오톡을 여는 일이라 누른 그때 불러야 막히지 않는다(SDK 는 미리 load 로). 못 보내면 false
       opts: { title, description, url, imageUrl, imageWidth, imageHeight, buttonTitle,
               itemContent(카카오 피드 항목 칸), social(좋아요, 댓글 수), buttons: [{ title, url }] 두 개까지 } */
    function sendNow(opts) {
      opts = opts || {};
      var K = window.Kakao;
      if (!(K && K.Share && K.isInitialized && K.isInitialized())) return false;
      var url = opts.url || location.href;
      var content = { title: opts.title || document.title, imageUrl: opts.imageUrl, link: { mobileWebUrl: url, webUrl: url } };
      if (opts.description) content.description = opts.description;
      if (opts.imageWidth && opts.imageHeight) { content.imageWidth = opts.imageWidth; content.imageHeight = opts.imageHeight; }
      var btns = (opts.buttons && opts.buttons.length ? opts.buttons : [{ title: opts.buttonTitle || "자세히 보기", url: url }]).slice(0, 2);
      var tpl = { objectType: "feed", content: content, buttons: btns.map(function (b) { var u = b.url || url; return { title: b.title, link: { mobileWebUrl: u, webUrl: u } }; }) };
      if (opts.itemContent) tpl.itemContent = opts.itemContent;
      if (opts.social) tpl.social = opts.social;
      try {
        K.Share.sendDefault(tpl);
        return true;
      } catch (e) { return false; }
    }
    /* 결과를 사람 말로 */
    function message(result) {
      return { kakao: "", share: "", abort: "", copy: "링크를 복사했습니다. 채팅창에 붙여넣어 주세요.", fail: "복사에 실패했습니다. 주소창에서 직접 복사해 주세요." }[result] || "";
    }
    return { share: share, message: message, upload: upload, sendNow: sendNow, load: loadSdk, available: function () { return !!(window.KAKAO && window.KAKAO.jsKey); } };
  })();
  window.KSHARE = KSHARE;

  /* ──────────────────────────────────────────────────────────
     ①-4 홈 화면에 추가(설치) — 매니페스트는 각 페이지 <head>, 서비스 워커는 /sw.js
     로컬 검증(127.0.0.1·localhost)에서는 등록하지 않는다(요청 가로채기 검사와 겹치지 않게).
     ────────────────────────────────────────────────────────── */
  if ("serviceWorker" in navigator && !/^(127\.|localhost$|0\.0\.0\.0)/.test(location.hostname) && location.protocol === "https:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }

  /* ──────────────────────────────────────────────────────────
     ② 입장 횟수 카운터 (상단 내비의 알약)
     today = 오늘(KST) 링크를 타고 사이트에 들어온 횟수, total = 그것의 누적.
     '들어온 한 번'은 브라우저 탭(세션) 하나가 처음 열릴 때다 — 카카오톡에서 링크를
     누를 때마다 새 탭이 열리니 그때마다 +1. 같은 탭에서 홈→맛집으로 옮기거나
     새로고침하는 건 한 번의 입장 안이라 세지 않는다(sessionStorage 표시).
     같은 사람이 하루에 세 번 들어오면 3 — 사람 수가 아니라 횟수다.
     서버(visit_hit)는 부를 때마다 +1 만 하고, 언제 부를지는 여기서 정한다.
     (2026-09-21, 기기당 하루 1회 방식에서 바꿈. sql/2026-09-21-visit-hits.sql)
     ────────────────────────────────────────────────────────── */
  var COUNTED_KEY = "excer_visit_counted";   // 이 탭에서 이미 입장으로 셌는가

  function thousands(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function reduceMotion() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { return false; }
  }

  /* 숫자가 0에서 올라가는 연출. 페이지마다 따로 있던 countUp 에 기대지 않고
     이 파일 안에서 끝낸다 — 공통 파일이 페이지 전역 함수에 의존하면
     한 페이지만 고쳐도 다른 페이지가 조용히 깨진다. */
  function countTo(el, to, ms) {
    if (!el) return;
    to = to || 0;
    if (reduceMotion() || !window.requestAnimationFrame) {
      el.textContent = thousands(to);
      return;
    }
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / ms);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = thousands(to * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function startVisitCounter() {
    var box = document.getElementById("visitBox");
    if (!box) return;
    var elToday = document.getElementById("visitToday");
    var elTotal = document.getElementById("visitTotal");

    var counted = false;
    try { counted = sessionStorage.getItem(COUNTED_KEY) === "1"; } catch (e) {}
    // 이 탭에서 처음이면 +1(visit_hit), 이미 셌으면 숫자만 읽는다(visit_ping 의 읽기 전용 경로)
    var path = counted ? "/rest/v1/rpc/visit_ping" : "/rest/v1/rpc/visit_hit";
    var body = counted ? { p_device: "readonly", p_count: false } : {};

    fetch(SUPA.url + path, {
      method: "POST",
      headers: {
        apikey: SUPA.anon,
        Authorization: "Bearer " + SUPA.anon,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    })
      .then(function (r) { if (!r.ok) throw new Error(path); return r.json(); })
      .then(function (d) {
        if (!d || typeof d.today !== "number" || typeof d.total !== "number") throw new Error("visit shape");
        try { sessionStorage.setItem(COUNTED_KEY, "1"); } catch (e) {}   // 성공했을 때만 표시 — 실패하면 다음 페이지에서 다시 센다
        box.hidden = false;
        countTo(elToday, d.today, 700);
        countTo(elTotal, d.total, 700);
      })
      .catch(function () {
        /* 예전에는 여기서 이 기기만의 localStorage 집계를 같은 자리에 그렸다.
           처음 온 사람에게 '오늘 1 · 누적 1'이 뜨는 셈이라, 살아있다는 신호가
           오히려 죽은 사이트처럼 보였고 서버 값과 구분되지 않아
           장애가 나도 아무도 몰랐다. 이제는 조용히 숨긴다 —
           숫자를 지어내느니 칸을 비우는 편이 낫다. */
        box.hidden = true;
      });
  }

  /* ──────────────────────────────────────────────────────────
     ③ 모달 포커스 가두기
     모달이 열려 있어도 탭이 뒤쪽 페이지로 빠져나가고 있었다(25번 중 15~22번).
     키보드로 쓰는 사람은 모달이 떠 있는데 보이지 않는 곳을 더듬게 된다.

     페이지마다 고치지 않고 여기서 한 번에 처리한다 — 모든 모달이
     .modal-backdrop + [hidden] 이라는 같은 약속을 쓰고 있어서 가능하다.
     페이지 쪽 코드는 손대지 않는다.
     ────────────────────────────────────────────────────────── */
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]),' +
                  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var beforeModal = null;   // 모달을 열기 직전에 포커스가 있던 곳

  function openModals() {
    var all = document.querySelectorAll(".modal-backdrop");
    var out = [];
    for (var i = 0; i < all.length; i++) if (!all[i].hidden) out.push(all[i]);
    return out;
  }

  function itemsIn(box) {
    var all = box.querySelectorAll(FOCUSABLE);
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      // 숨겨진 칸(예: 수정할 때 감추는 닉네임 칸)은 건너뛴다
      if (el.offsetWidth || el.offsetHeight || el.getClientRects().length) out.push(el);
    }
    return out;
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    var open = openModals();
    if (!open.length) return;
    var box = open[open.length - 1];        // 겹쳐 있으면 가장 위에 열린 것
    var items = itemsIn(box);
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    var here = document.activeElement;
    var inside = box.contains(here);
    if (e.shiftKey ? (here === first || !inside) : (here === last || !inside)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  });

  /* 열리고 닫히는 것을 hidden 속성 변화로 안다.
     페이지들이 backdrop.hidden = true/false 로만 여닫기 때문에,
     여는 함수를 일일이 고치지 않아도 여기서 잡힌다. */
  function watchModals() {
    var boxes = document.querySelectorAll(".modal-backdrop");
    if (!boxes.length || !window.MutationObserver) return;
    var ob = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var box = list[i].target;
        if (!box.classList || !box.classList.contains("modal-backdrop")) continue;
        if (!box.hidden) {
          onSheetOpen(box);
          if (!box.contains(document.activeElement)) {
            beforeModal = document.activeElement;
            var items = itemsIn(box);
            // 페이지가 이미 특정 칸에 포커스를 주는 경우가 많아 조금 기다린다
            if (items.length) setTimeout(function (f, b) {
              return function () { if (!b.contains(document.activeElement)) f.focus(); };
            }(items[0], box), 80);
          }
        } else {
          onSheetClose(box);
          if (beforeModal && document.body.contains(beforeModal)) {
            // 닫으면 열기 전 자리로 돌려준다. 안 그러면 포커스가 문서 맨 앞으로 튄다.
            // 창 안 입력칸이 focusout 없이 숨으면 is-typing 이 남아 떠 있는 글쓰기 버튼이 숨은 채라 포커스를 못 받는다
            if (!isTyping(beforeModal)) setTyping(false);
            beforeModal.focus();
            beforeModal = null;
          }
          if (unwinding > 0) pendingFocus = document.activeElement !== document.body ? document.activeElement : null;
        }
      }
    });
    for (var i = 0; i < boxes.length; i++) {
      ob.observe(boxes[i], { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  /* ──────────────────────────────────────────────────────────
     ④ 누름 모양과 입력 중 탭바
     아이폰 사파리는 페이지에 터치 리스너가 하나라도 있어야 누르는 동안의 모양(:active)을 그린다.
     글을 입력하는 동안에는 html 에 is-typing 을 붙여 아래 탭바를 숨긴다(site.css) —
     키보드가 화면을 줄이는 안드로이드 카카오톡에서 탭바가 키보드 위에 올라앉아 입력칸과 검색 결과를 가리던 것.
     안드로이드에서 뒤로 가기로 키보드만 닫으면 포커스가 입력칸에 남는다 → 화면 높이가 돌아온 것을 보고 다시 보인다.
     ────────────────────────────────────────────────────────── */
  document.addEventListener("touchstart", function () {}, { passive: true });
  var TYPING = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="color"]), textarea, select';
  function isTyping(el) { return !!(el && el.matches && el.matches(TYPING)); }
  function setTyping(on) { document.documentElement.classList.toggle("is-typing", on); }
  var fullH = window.innerHeight, lastW = window.innerWidth, kbUp = false;
  document.addEventListener("focusin", function (e) { if (isTyping(e.target)) setTyping(true); });
  document.addEventListener("focusout", function () { kbUp = false; setTyping(false); });
  window.addEventListener("resize", function () {
    var h = window.innerHeight;
    if (window.innerWidth !== lastW) { lastW = window.innerWidth; fullH = h; return; }   // 방향이 바뀌면 기준 높이를 새로
    if (h > fullH) fullH = h;
    if (!isTyping(document.activeElement)) return;
    if (h < fullH - 150) { kbUp = true; setTyping(true); }        // 키보드가 올라와 화면이 줄었다
    else if (kbUp && h >= fullH - 80) { kbUp = false; setTyping(false); }   // 키보드만 내려갔다
  }, { passive: true });

  /* ──────────────────────────────────────────────────────────
     ⑤ 창과 뒤로 가기 (95차)
     창(.modal-backdrop)이 열리면 기록(history)에 칸 하나를 넣는다. 그래서 안드로이드 뒤로 가기 단추나 아이폰의
     쓸어 넘기기는 창만 닫고, 쪽을 나가지 않는다(카카오톡 안에서 뒤로 가기가 곧장 화면을 닫던 것).
     X 나 취소로 닫으면 그 칸을 되돌려(history.back) 다음 뒤로 가기가 전처럼 동작하게 한다. 겹친 창은 위부터 닫는다.
     여닫는 것은 ③ 과 같은 hidden 변화로 알고, 닫을 때는 그 창의 닫기 단추(.modal-close)를 눌러 쪽의 정리 코드를 그대로 탄다.
     새로고침 뒤 남은 칸은 다음에 여는 창이 다시 쓴다.
     ────────────────────────────────────────────────────────── */
  var SHEET_KEY = "excerSheet";
  var sheets = [];                 // 열려 있는 창(아래부터 위)
  var unwinding = 0;               // 우리가 부른 back 으로 생길 popstate 수
  var reuseEntry = false;
  try { reuseEntry = !!(history.state && history.state[SHEET_KEY]); } catch (e) {}
  function sheetDepth() { try { return (history.state && history.state[SHEET_KEY]) || 0; } catch (e) { return 0; } }
  function sheetMark(d) { var s = {}; s[SHEET_KEY] = d; return s; }
  var pendingFocus = null;         // 되돌린 뒤 초점이 날아가면 되돌려 줄 곳
  function onSheetOpen(box) {
    if (sheets.indexOf(box) >= 0) return;
    sheets.push(box);
    try {
      // 칸 사이를 오갈 때 브라우저가 스크롤 자리를 되돌리지 않게(창을 닫을 때 쪽이 튀고, 스크롤에 반응하는 목록이 다시 그려지던 것). 다 닫히면 auto 로
      if (sheets.length === 1 && "scrollRestoration" in history) history.scrollRestoration = "manual";
      if (reuseEntry) { reuseEntry = false; history.replaceState(sheetMark(sheets.length), "", location.href); }
      else history.pushState(sheetMark(sheets.length), "", location.href);
    } catch (e) {}
  }
  function sheetsDone() { try { if (!sheets.length && "scrollRestoration" in history) history.scrollRestoration = "auto"; } catch (e) {} }
  function onSheetClose(box) {
    var i = sheets.indexOf(box); if (i < 0) return;   // 뒤로 가기로 닫은 창은 popstate 에서 이미 목록에서 뺐다
    sheets.splice(i, 1);
    // 손으로 닫았다: 우리가 넣은 칸이 아직 위에 있으면 되돌린다
    if (sheetDepth() > sheets.length) { unwinding++; try { history.back(); } catch (e) { unwinding--; sheetsDone(); } }
    else sheetsDone();
  }
  function closeSheet(box) {
    var btn = null, all = box.querySelectorAll(".modal-close, [data-close]");
    for (var i = 0; i < all.length; i++) if (all[i].offsetWidth || all[i].offsetHeight) { btn = all[i]; break; }
    if (btn) btn.click();
    if (!box.hidden) box.hidden = true;   // 닫기 단추가 없거나 안 닫혔으면 바로
  }
  window.addEventListener("popstate", function () {
    if (unwinding > 0) {
      unwinding--;
      sheetsDone();
      // 되돌린 뒤 초점이 문서 맨 앞으로 튀었으면 닫기 직후 자리로
      var el = pendingFocus; pendingFocus = null;
      setTimeout(function () { if (el && document.activeElement === document.body && document.body.contains(el)) { try { el.focus({ preventScroll: true }); } catch (e) {} } }, 0);
      return;
    }
    var d = sheetDepth();
    while (sheets.length > d) {
      var box = sheets.pop();   // 목록에서 먼저 빼야 닫힘을 본 관찰자(onSheetClose)가 되돌리기를 또 부르지 않는다
      closeSheet(box);
    }
    sheetsDone();
  });

  /* 폰 시트: 머리 부분을 아래로 끌면 닫는다(스크롤이 맨 위일 때). 손잡이 모양은 site.css */
  (function bindSheetSwipe() {
    var y0 = null, x0 = 0, dy = 0, modal = null, box = null;
    document.addEventListener("touchstart", function (e) {
      var head = e.target.closest && e.target.closest(".modal-backdrop.is-sheet .modal-head");
      if (!head || e.target.closest("button, a, input, select, textarea")) { y0 = null; return; }
      modal = head.closest(".modal"); box = head.closest(".modal-backdrop");
      if (!modal || modal.scrollTop > 0) { y0 = null; return; }
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0;
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (y0 === null) return;
      var t = e.touches[0]; dy = t.clientY - y0;
      if (dy > 0 && dy > Math.abs(t.clientX - x0)) modal.style.transform = "translateY(" + dy + "px)";
    }, { passive: true });
    function end() {
      if (y0 === null) return;
      var b = box; y0 = null;
      if (dy > 70) { modal.style.transition = "transform .15s ease"; modal.style.transform = "translateY(100%)";
        setTimeout(function () { closeSheet(b); modal.style.transform = ""; modal.style.transition = ""; }, 140); }
      else { modal.style.transition = "transform .15s ease"; modal.style.transform = ""; setTimeout(function () { modal.style.transition = ""; }, 160); }
    }
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", end, { passive: true });
  })();

  /* ──────────────────────────────────────────────────────────
     ⑥ 맨 위로: 아래 탭바가 있는 쪽에서 한 화면 반 넘게 내려가면 오른쪽 아래에 단추
     ────────────────────────────────────────────────────────── */
  function mountToTop() {
    if (!document.querySelector(".bottom-tabbar") || document.querySelector(".to-top")) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "to-top"; b.setAttribute("aria-label", "맨 위로"); b.tabIndex = -1;
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>';
    document.body.appendChild(b);
    b.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
      b.blur();
    });
    var shown = false, waiting = false;
    function check() {
      waiting = false;
      var on = window.scrollY > window.innerHeight * 1.5;
      if (on === shown) return;
      shown = on; b.classList.toggle("is-on", on); b.tabIndex = on ? 0 : -1;
    }
    window.addEventListener("scroll", function () { if (!waiting) { waiting = true; requestAnimationFrame(check); } }, { passive: true });
    check();
  }

  /* ──────────────────────────────────────────────────────────
     ⑦ 뒤로 와도 보던 자리로: 목록을 서버에서 읽은 뒤에 그리는 쪽은 브라우저가 스크롤 자리를 못 돌려준다.
     나갈 때 자리를 적어 두고, 뒤로(또는 앞으로) 와서 처음 그린 뒤에 쪽이 restore() 를 부르면 그 자리로 간다.
     ────────────────────────────────────────────────────────── */
  var SCROLL_KEY = "excer_scroll:" + location.pathname + location.search;
  window.addEventListener("pagehide", function () { try { sessionStorage.setItem(SCROLL_KEY, String(Math.round(window.scrollY))); } catch (e) {} });
  function isBackForward() {
    try {
      if (window.navigation && navigation.activation && navigation.activation.navigationType) return navigation.activation.navigationType === "traverse";
      var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      if (nav) return nav.type === "back_forward";
      return !!(performance.navigation && performance.navigation.type === 2);
    } catch (e) { return false; }
  }
  function restoreScroll() {
    try {
      if (!isBackForward() || location.hash) return false;
      var y = Number(sessionStorage.getItem(SCROLL_KEY));
      if (!(y > 0)) return false;
      var root = document.documentElement, prev = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto"; window.scrollTo(0, y); root.style.scrollBehavior = prev;
      return true;
    } catch (e) { return false; }
  }
  window.EXCER_SCROLL = { restore: restoreScroll, isBack: isBackForward };

  /* ──────────────────────────────────────────────────────────
     ⑧ 떠 있는 단추(.fab)는 아래로 내리는 동안 숨고 위로 올리면 다시 보인다(2026-10-18).
     목록 줄 오른쪽의 참석 단추와 카드의 공유 단추를 덮지 않게. 맨 위 가까이에서는 늘 보인다
     ────────────────────────────────────────────────────────── */
  function mountFabHide() {
    var fab = document.querySelector(".fab");
    if (!fab) return;
    var last = window.scrollY, acc = 0, waiting = false;
    function check() {
      waiting = false;
      var y = window.scrollY, dy = y - last;
      last = y;
      if (y < 120) { fab.classList.remove("is-away"); acc = 0; return; }
      acc = (dy > 0) === (acc > 0) ? acc + dy : dy;             // 같은 방향으로 쌓이고 방향이 바뀌면 처음부터
      if (acc > 24) fab.classList.add("is-away");
      else if (acc < -24) fab.classList.remove("is-away");
    }
    window.addEventListener("scroll", function () { if (!waiting) { waiting = true; requestAnimationFrame(check); } }, { passive: true });
  }

  function start() {
    startVisitCounter();
    watchModals();
    mountToTop();
    mountFabHide();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
