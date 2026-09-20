/* ============================================================
   assets/images.js — 사이트가 쓰는 그림의 목록과 자리 채우기

   그림 파일은 assets/img/ 에 둔다. 경로·용도·대체 텍스트·비율을 여기
   한곳에서만 관리해서, 파일을 바꿔 끼울 때 HTML 을 뒤지지 않게 한다.

   파일이 아직 없는 그림은 ready 를 false 로 둔다. 그러면 브라우저가
   그 파일을 요청하지 않는다 — 깨진 그림 아이콘도, 404 도 생기지 않는다.
   파일을 assets/img/ 에 넣은 뒤 ready: true 로 바꾸면 그때부터 불러온다.
   혹시 true 인데 파일이 없으면 한 번만 실패하고 단색 자리로 되돌아간다.

   쓰는 법 (HTML):
     <figure class="img-slot" data-img="neighborhood-hero" data-eager></figure>
   data-eager 가 붙은 것만 바로 불러오고, 나머지는 화면에 가까워질 때 불러온다.
   ============================================================ */
(function () {
  "use strict";

  var BASE = "assets/img/";

  var IMAGES = {
    // 홈 대표 영역 (4:3). 동네 풍경. 정보를 전달하므로 alt 를 쓴다.
    "neighborhood-hero": {
      file: "neighborhood-hero.webp", ready: false, ratio: "4/3", icon: "home",
      alt: "골목과 낮은 건물, 나무가 있는 동네 풍경 일러스트",
      role: "홈 대표 이미지"
    },
    // 활동 일러스트 (4:3). 카드에 붙는 장식이라 alt 는 비운다.
    "activity-dining":    { file: "activity-dining.webp",    ready: false, ratio: "4/3", icon: "utensils", alt: "", role: "함께 식사하는 장면" },
    "activity-walking":   { file: "activity-walking.webp",   ready: false, ratio: "4/3", icon: "walk",     alt: "", role: "함께 산책하는 장면" },
    "activity-culture":   { file: "activity-culture.webp",   ready: false, ratio: "4/3", icon: "frame",    alt: "", role: "전시·문화생활 장면" },
    "activity-boardgame": { file: "activity-boardgame.webp", ready: false, ratio: "4/3", icon: "dice",     alt: "", role: "보드게임 장면" }
  };

  function iconSvg(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + (name || "frame") + '"/></svg>';
  }

  function placeholder(slot, def) {
    slot.innerHTML = '<span class="img-ph">' + iconSvg(def.icon) + "</span>";
    slot.setAttribute("data-state", "empty");
    // 장식 자리는 읽는 장치에 알릴 것이 없다. 정보 그림 자리는 alt 를 라벨로 남긴다.
    if (def.alt) slot.setAttribute("aria-label", def.alt + " (준비 중)");
    else slot.setAttribute("aria-hidden", "true");
  }

  function fill(slot) {
    var key = slot.getAttribute("data-img");
    var def = IMAGES[key];
    if (!def) { slot.setAttribute("aria-hidden", "true"); return; }
    if (def.ratio === "3/2") slot.classList.add("is-3x2");
    if (def.ratio === "1/1") slot.classList.add("is-1x1");
    if (!def.ready) { placeholder(slot, def); return; }

    var img = document.createElement("img");
    img.src = BASE + def.file;
    img.alt = def.alt || "";
    img.decoding = "async";
    if (!slot.hasAttribute("data-eager")) img.loading = "lazy";
    // 비율은 CSS 가 잡아 두므로 늦게 와도 화면이 밀리지 않는다
    img.onerror = function () { placeholder(slot, def); };
    img.onload = function () { slot.setAttribute("data-state", "ready"); slot.removeAttribute("aria-hidden"); };
    slot.innerHTML = "";
    slot.appendChild(img);
    if (!def.alt) slot.setAttribute("aria-hidden", "true");
  }

  function run() {
    var slots = document.querySelectorAll(".img-slot[data-img]");
    for (var i = 0; i < slots.length; i++) fill(slots[i]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();

  window.EXCER_IMAGES = { base: BASE, list: IMAGES, refresh: run };
})();
