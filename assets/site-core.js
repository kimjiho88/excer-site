/* ============================================================
   동네친구들 — 공통 코어 (site-core.js)
   ------------------------------------------------------------
   8개 페이지에 똑같이 복붙돼 있던 것을 한 곳으로 모은 파일이다.
   여기가 정본이고, 페이지에 다시 복사하지 않는다.

   담는 것
     ① 서버 접속 정보 (window.SUPA)
     ② 방문자 카운터

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
     ② 방문자 카운터
     서버는 (날짜, 기기키) 한 쌍을 하루에 하나만 남긴다.
     today = 오늘 찍힌 기기 수, total = 지금까지 쌓인 모든 (날짜,기기) 수.
     그래서 total 은 '사람 수'가 아니라 '들른 횟수'다 — 문구도 그렇게 쓴다.
     ────────────────────────────────────────────────────────── */
  var DEVICE_KEY = "excer_device_key";
  var COUNTED_KEY = "excer_visit_counted";

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

  function deviceKey() {
    var k = null;
    try { k = localStorage.getItem(DEVICE_KEY); } catch (e) {}
    if (!k || !/^[a-z0-9]{16,40}$/.test(k)) {
      k = "";
      var s = "abcdefghijklmnopqrstuvwxyz0123456789";
      for (var i = 0; i < 24; i++) k += s[Math.floor(Math.random() * s.length)];
      try { localStorage.setItem(DEVICE_KEY, k); } catch (e) {}
    }
    return k;
  }

  function startVisitCounter() {
    var box = document.getElementById("visitBox");
    if (!box) return;
    var elToday = document.getElementById("visitToday");
    var elTotal = document.getElementById("visitTotal");

    var counted = false;
    try { counted = sessionStorage.getItem(COUNTED_KEY) === "1"; } catch (e) {}

    fetch(SUPA.url + "/rest/v1/rpc/visit_ping", {
      method: "POST",
      headers: {
        apikey: SUPA.anon,
        Authorization: "Bearer " + SUPA.anon,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_device: deviceKey(), p_count: !counted })
    })
      .then(function (r) { if (!r.ok) throw new Error("visit_ping"); return r.json(); })
      .then(function (d) {
        try { sessionStorage.setItem(COUNTED_KEY, "1"); } catch (e) {}
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startVisitCounter);
  } else {
    startVisitCounter();
  }
})();
