/* ============================================================
   동네친구들 — 공통 코어 (site-core.js)
   ------------------------------------------------------------
   8개 페이지에 똑같이 복붙돼 있던 것을 한 곳으로 모은 파일이다.
   여기가 정본이고, 페이지에 다시 복사하지 않는다.

   담는 것
     ① 서버 접속 정보 (window.SUPA)
     ② 방문자 카운터
     ③ 모달 포커스 가두기

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
          document.body.appendChild(ta); ta.select();
          var ok = document.execCommand("copy"); document.body.removeChild(ta);
          return ok ? "copy" : "fail";
        } catch (e) { return "fail"; }
      });
    }
    function share(opts) {
      opts = opts || {};
      var url = opts.url || location.href;
      var image = opts.imageUrl || (location.origin + "/assets/og.jpg?v=2");
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
    /* 결과를 사람 말로 */
    function message(result) {
      return { kakao: "", share: "", abort: "", copy: "링크를 복사했습니다. 채팅창에 붙여넣어 주세요.", fail: "복사에 실패했습니다. 주소창에서 직접 복사해 주세요." }[result] || "";
    }
    return { share: share, message: message, available: function () { return !!(window.KAKAO && window.KAKAO.jsKey); } };
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
          if (!box.contains(document.activeElement)) {
            beforeModal = document.activeElement;
            var items = itemsIn(box);
            // 페이지가 이미 특정 칸에 포커스를 주는 경우가 많아 조금 기다린다
            if (items.length) setTimeout(function (f, b) {
              return function () { if (!b.contains(document.activeElement)) f.focus(); };
            }(items[0], box), 80);
          }
        } else if (beforeModal && document.body.contains(beforeModal)) {
          // 닫으면 열기 전 자리로 돌려준다. 안 그러면 포커스가 문서 맨 앞으로 튄다.
          beforeModal.focus();
          beforeModal = null;
        }
      }
    });
    for (var i = 0; i < boxes.length; i++) {
      ob.observe(boxes[i], { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  function start() {
    startVisitCounter();
    watchModals();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
