/* ============================================================
   assets/art.js — 페이지 히어로에 들어가는 손으로 그린 장면 한 벌

   아이콘(assets/icons.js)은 24px 자리에 쓰는 기호다. 여기 있는 것은
   그보다 크고, 글자를 한 자도 쓰지 않고 그 페이지가 무엇을 하는지
   형태로만 말하는 그림이다.

   이미지 생성 도구가 없어서 벡터를 쓰는 게 아니다. 고급 제품 사이트의
   히어로 그림도 대개 손으로 짠 벡터다 — 어느 화면 배율에서도 또렷하고,
   용량이 몇 KB고, 색을 팔레트에 정확히 맞출 수 있다.

   쓰는 법:
     <svg class="hero-art" viewBox="0 0 440 360" role="img" aria-label="...">
       <use href="#art-guide" />
     </svg>
   viewBox 는 전부 0 0 440 360 으로 맞춰 두었다.

   기법 하나: 그라데이션·클립·필터 정의는 스프라이트 맨 앞에 한 벌만 두고
   여섯 장면이 공유한다. <use> 로 불러도 같은 문서 안이라 id 가 그대로 닿는다.
   ============================================================ */
(function () {
  "use strict";

  var VB = '0 0 440 360';

  /* 공용 정의 — 여기 색이 팔레트의 그것과 어긋나면 그림만 따로 논다.
     --deep-*, --brass-*, --lavender-bright 와 같은 값을 쓴다. */
  var DEFS =
    '<radialGradient id="aGlow" cx="0.5" cy="0.44" r="0.7">' +
      '<stop offset="0" stop-color="#9A6FD6" stop-opacity="0.36"/>' +
      '<stop offset="0.42" stop-color="#8C5FCE" stop-opacity="0.2"/>' +
      '<stop offset="0.72" stop-color="#7A50BE" stop-opacity="0.07"/>' +
      '<stop offset="1" stop-color="#7A50BE" stop-opacity="0"/>' +
    '</radialGradient>' +
    '<linearGradient id="aPaper" x1="0" y1="0" x2="0.6" y2="1">' +
      '<stop offset="0" stop-color="#FFFDFA"/><stop offset="1" stop-color="#F3EDE3"/>' +
    '</linearGradient>' +
    '<linearGradient id="aHead" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#3A2068"/><stop offset="1" stop-color="#4B2A82"/>' +
    '</linearGradient>' +
    '<linearGradient id="aBrass" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#E4CB92"/><stop offset="1" stop-color="#C08F3F"/>' +
    '</linearGradient>' +
    '<filter id="aDrop" x="-40%" y="-30%" width="180%" height="190%">' +
      '<feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#0A0514" flood-opacity="0.5"/>' +
    '</filter>';

  /* 자주 쓰는 조각 — 같은 말을 여섯 번 적지 않는다 */
  function glow(cx, cy, rx, ry) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="url(#aGlow)"/>';
  }
  // 흐릿한 유리판 (뒤에 깔리는 패널)
  function glass(x, y, w, h, r) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="#FFFFFF" fill-opacity="0.07"/>' +
           '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="none" stroke="#FFFFFF" stroke-opacity="0.19"/>';
  }
  // 글자 대신 놓는 막대
  function bar(x, y, w, h, fill, op) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (h / 2) +
           '" fill="' + fill + '" fill-opacity="' + op + '"/>';
  }
  var W = "#FFFFFF", D = "#2E1B45";
  // 체크 배지 (완료)
  function check(x, y) {
    return '<g transform="translate(' + x + ' ' + y + ')">' +
      '<circle cx="19" cy="19" r="19" fill="#0D7A55"/>' +
      '<circle cx="19" cy="19" r="19" fill="none" stroke="#9DF3CC" stroke-opacity="0.34"/>' +
      '<path d="m12 19.4 4.6 4.6 10-10.4" stroke="#EBFFF6" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</g>';
  }

  var ART = {};

  /* ── 필독 — 규칙 카드 세 장이 쌓여 있고, 앞장은 다 체크되어 있다 ── */
  ART.guide =
    glow(220, 178, 218, 178) +
    '<g class="a-float" transform="rotate(-6 150 120)">' + glass(56, 34, 250, 172, 24) +
      bar(80, 62, 120, 9, W, 0.42) + bar(80, 82, 168, 8, W, 0.22) + bar(80, 100, 96, 8, W, 0.22) +
    '</g>' +
    '<g transform="rotate(3 230 170)">' + glass(120, 62, 244, 168, 24) + '</g>' +
    '<g filter="url(#aDrop)" transform="rotate(-1.5 250 240)">' +
      '<rect x="112" y="128" width="268" height="196" rx="26" fill="url(#aPaper)"/>' +
      '<rect x="112" y="128" width="268" height="196" rx="26" fill="none" stroke="#1A1024" stroke-opacity="0.14"/>' +
      bar(140, 156, 104, 11, D, 0.34) +
      // 체크된 줄 셋 — 가운데 것만 놋빛으로 지금 읽는 자리를 짚는다
      '<circle cx="150" cy="200" r="10" fill="none" stroke="#2E1B45" stroke-opacity="0.3" stroke-width="2"/>' +
      '<path d="m145 200 3.8 3.8 7.4-8" stroke="#2E1B45" stroke-opacity="0.45" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      bar(170, 195, 136, 10, D, 0.26) +
      '<circle cx="150" cy="238" r="10" fill="url(#aBrass)"/>' +
      '<path d="m145 238 3.8 3.8 7.4-8" stroke="#3A2A08" stroke-opacity="0.72" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      bar(170, 233, 174, 10, D, 0.4) +
      '<circle cx="150" cy="276" r="10" fill="none" stroke="#2E1B45" stroke-opacity="0.3" stroke-width="2"/>' +
      '<path d="m145 276 3.8 3.8 7.4-8" stroke="#2E1B45" stroke-opacity="0.45" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      bar(170, 271, 112, 10, D, 0.26) +
    '</g>' +
    // 책갈피
    '<g class="a-float-2"><path d="M348 74v66l17-14 17 14V74z" fill="url(#aBrass)"/></g>';

  /* ── 정산기 — 영수증 한 장이 세 몫으로 갈라진다 ── */
  ART.calc =
    glow(220, 178, 218, 178) +
    '<g class="a-float" transform="rotate(-4 130 170)">' +
      '<path d="M48 62a16 16 0 0 1 16-16h116a16 16 0 0 1 16 16v212l-19-13-19 13-19-13-19 13-19-13-19 13-19-13-15 13z" fill="url(#aPaper)"/>' +
      '<path d="M48 62a16 16 0 0 1 16-16h116a16 16 0 0 1 16 16v212l-19-13-19 13-19-13-19 13-19-13-19 13-19-13-15 13z" fill="none" stroke="#1A1024" stroke-opacity="0.14"/>' +
      bar(74, 78, 84, 10, D, 0.36) +
      bar(74, 112, 96, 8, D, 0.2) + bar(142, 112, 32, 8, D, 0.32) +
      bar(74, 138, 74, 8, D, 0.2) + bar(146, 138, 28, 8, D, 0.32) +
      bar(74, 164, 88, 8, D, 0.2) + bar(140, 164, 34, 8, D, 0.32) +
      '<line x1="74" y1="194" x2="174" y2="194" stroke="#2E1B45" stroke-opacity="0.16" stroke-dasharray="4 5"/>' +
      bar(74, 212, 48, 10, D, 0.28) + '<rect x="124" y="206" width="52" height="16" rx="8" fill="url(#aBrass)"/>' +
    '</g>' +
    // 갈라지는 선
    '<path d="M214 170h22M236 170v-64h18M236 170v64h18M236 170h18" stroke="url(#aBrass)" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    // 세 사람 몫
    '<g class="a-float-2">' +
      glass(262, 82, 152, 50, 18) + '<circle cx="288" cy="107" r="11" fill="#C8A2E8" fill-opacity="0.66"/>' +
      bar(308, 96, 44, 8, W, 0.42) + bar(308, 112, 70, 9, W, 0.7) +
    '</g>' +
    glass(262, 146, 152, 50, 18) + '<circle cx="288" cy="171" r="11" fill="#E9D2AE" fill-opacity="0.66"/>' +
    bar(308, 160, 56, 8, W, 0.42) + bar(308, 176, 58, 9, W, 0.7) +
    glass(262, 210, 152, 50, 18) + '<circle cx="288" cy="235" r="11" fill="#A9E3CB" fill-opacity="0.66"/>' +
    bar(308, 224, 38, 8, W, 0.42) + bar(308, 240, 66, 9, W, 0.7) +
    check(384, 216);

  /* ── 소식 — 게시판에 쪽지 세 장이 붙어 있다 ── */
  ART.news =
    glow(220, 178, 218, 178) +
    glass(44, 44, 352, 272, 26) +
    '<g class="a-float" transform="rotate(-5 140 130)">' +
      '<rect x="74" y="80" width="140" height="104" rx="16" fill="url(#aPaper)"/>' +
      bar(94, 102, 76, 9, D, 0.36) + bar(94, 122, 100, 8, D, 0.2) + bar(94, 140, 64, 8, D, 0.2) +
      '<circle cx="144" cy="80" r="7" fill="url(#aBrass)"/>' +
    '</g>' +
    '<g transform="rotate(4 296 132)">' +
      glass(228, 76, 140, 104, 16) +
      bar(248, 98, 62, 9, W, 0.44) + bar(248, 118, 94, 8, W, 0.24) + bar(248, 136, 52, 8, W, 0.24) +
    '</g>' +
    '<g class="a-float-2" transform="rotate(-2 220 254)">' +
      glass(140, 204, 172, 82, 16) +
      bar(162, 224, 88, 9, W, 0.44) + bar(162, 244, 124, 8, W, 0.24) +
    '</g>' +
    // 반응 배지 — 하트 하나
    '<g transform="translate(316 216)">' +
      '<rect width="70" height="38" rx="19" fill="#FFFFFF" fill-opacity="0.14"/>' +
      '<rect width="70" height="38" rx="19" fill="none" stroke="#FFFFFF" stroke-opacity="0.22"/>' +
      '<path d="M22 27s-8-5.4-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.6-8 11-8 11z" fill="#E88AA8"/>' +
      bar(40, 14, 18, 10, W, 0.7) +
    '</g>';

  /* ── 맛집 — 지도 위에 핀이 서 있고, 그중 하나가 펼쳐져 있다 ── */
  ART.places =
    glow(220, 178, 218, 178) +
    glass(40, 48, 360, 264, 26) +
    // 길
    '<g stroke="#FFFFFF" stroke-opacity="0.13" stroke-width="9" stroke-linecap="round" fill="none">' +
      '<path d="M40 138h150l46 48h164"/><path d="M148 48v90"/><path d="M236 186v126"/><path d="M290 48v84h110"/>' +
    '</g>' +
    // 작은 핀 둘
    '<g fill="none" stroke="#C8A2E8" stroke-opacity="0.75" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M104 196c0 0 14-12.6 14-22.8A14 14 0 0 0 90 173.2C90 183.4 104 196 104 196z"/><circle cx="104" cy="173" r="5"/>' +
      '<path d="M330 252c0 0 12-10.8 12-19.6a12 12 0 0 0-24 0c0 8.8 12 19.6 12 19.6z"/><circle cx="330" cy="232" r="4.3"/>' +
    '</g>' +
    // 펼쳐진 한 곳 — 핀보다 위에 둔다. 겹쳐 놓으면 핀이 별점을 가린다.
    '<g filter="url(#aDrop)">' +
      '<rect x="182" y="74" width="186" height="108" rx="20" fill="url(#aPaper)"/>' +
      '<rect x="182" y="74" width="186" height="108" rx="20" fill="none" stroke="#1A1024" stroke-opacity="0.14"/>' +
      bar(204, 98, 88, 11, D, 0.36) + bar(204, 122, 128, 8, D, 0.2) +
      // 별점 — 셋은 채우고 하나는 비운다
      '<g fill="url(#aBrass)">' +
        '<circle cx="209" cy="153" r="6"/><circle cx="227" cy="153" r="6"/><circle cx="245" cy="153" r="6"/>' +
      '</g>' +
      '<circle cx="263" cy="153" r="6" fill="#2E1B45" fill-opacity="0.16"/>' +
      bar(286, 148, 56, 10, D, 0.24) +
    '</g>' +
    // 큰 핀 — 길이 만나는 자리에 꽂는다
    '<g class="a-float"><path d="M236 248s23-20.4 23-36.8A23 23 0 0 0 213 211.2C213 227.6 236 248 236 248z" fill="url(#aBrass)"/>' +
      '<circle cx="236" cy="211" r="7.6" fill="#2A1A0A" fill-opacity="0.5"/></g>';

  /* ── 대시보드 — 막대와 추세선, 그리고 올라간 폭 ── */
  ART.report =
    glow(220, 178, 218, 178) +
    '<g class="a-float" transform="rotate(-3 150 150)">' + glass(44, 48, 268, 214, 24) +
      bar(70, 74, 88, 9, W, 0.38) +
      '<g>' +
        '<rect x="70" y="182" width="26" height="46" rx="8" fill="#FFFFFF" fill-opacity="0.2"/>' +
        '<rect x="110" y="158" width="26" height="70" rx="8" fill="#FFFFFF" fill-opacity="0.26"/>' +
        '<rect x="150" y="170" width="26" height="58" rx="8" fill="#FFFFFF" fill-opacity="0.22"/>' +
        '<rect x="190" y="130" width="26" height="98" rx="8" fill="url(#aBrass)"/>' +
        '<rect x="230" y="166" width="26" height="62" rx="8" fill="#FFFFFF" fill-opacity="0.22"/>' +
        '<rect x="270" y="192" width="26" height="36" rx="8" fill="#FFFFFF" fill-opacity="0.18"/>' +
      '</g>' +
      '<line x1="62" y1="240" x2="300" y2="240" stroke="#FFFFFF" stroke-opacity="0.18"/>' +
    '</g>' +
    '<g filter="url(#aDrop)" transform="rotate(2 300 260)">' +
      '<rect x="196" y="176" width="204" height="148" rx="24" fill="url(#aPaper)"/>' +
      '<rect x="196" y="176" width="204" height="148" rx="24" fill="none" stroke="#1A1024" stroke-opacity="0.14"/>' +
      bar(220, 200, 66, 9, D, 0.3) +
      '<path d="M222 286l34-26 30 14 32-38 32 12" stroke="#4B2A82" stroke-opacity="0.75" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="222" cy="286" r="4.4" fill="#4B2A82" fill-opacity="0.5"/>' +
      '<circle cx="318" cy="236" r="4.4" fill="#4B2A82" fill-opacity="0.5"/>' +
      '<circle cx="350" cy="248" r="6" fill="#C08F3F"/>' +
    '</g>' +
    // 오름폭 배지
    '<g class="a-float-2" transform="translate(316 96)">' +
      '<rect width="98" height="40" rx="20" fill="#0D7A55"/>' +
      '<path d="M22 25l8-9 6 5 8-10" stroke="#9DF3CC" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      bar(56, 15, 26, 10, W, 0.84) +
    '</g>';

  /* ── 내 벙비 — 내 몫 한 장과, 보내고 나면 붙는 체크 ── */
  ART.settle =
    glow(220, 178, 218, 178) +
    '<g class="a-float" transform="rotate(-3 210 60)">' + glass(90, 30, 252, 76, 22) +
      '<circle cx="124" cy="68" r="15" fill="#C8A2E8" fill-opacity="0.6"/>' +
      bar(150, 54, 82, 9, W, 0.4) + bar(150, 72, 120, 8, W, 0.22) +
    '</g>' +
    '<g filter="url(#aDrop)">' +
      '<rect x="72" y="118" width="296" height="196" rx="26" fill="url(#aPaper)"/>' +
      '<rect x="72" y="118" width="296" height="196" rx="26" fill="none" stroke="#1A1024" stroke-opacity="0.14"/>' +
      '<path d="M72 144a26 26 0 0 1 26-26h244a26 26 0 0 1 26 26v18H72z" fill="url(#aHead)"/>' +
      bar(98, 134, 78, 10, W, 0.9) +
      // 내 몫 — 이 그림에서 가장 큰 덩어리
      bar(100, 190, 52, 9, D, 0.26) +
      '<rect x="100" y="210" width="156" height="26" rx="13" fill="url(#aBrass)"/>' +
      '<line x1="100" y1="258" x2="340" y2="258" stroke="#2E1B45" stroke-opacity="0.14" stroke-dasharray="4 5"/>' +
      bar(100, 276, 96, 9, D, 0.22) + bar(262, 274, 78, 12, D, 0.3) +
    '</g>' +
    // 화살표를 카드 안에 하나 얹어 뒀는데, 가리키는 데가 없어 장식으로만 떠 있었다.
    // 다 보냈다는 말은 체크 배지 하나로 충분하다.
    check(324, 262);

  function inject() {
    if (document.getElementById("excer-art")) return;
    var parts = ['<defs>' + DEFS + '</defs>'];
    Object.keys(ART).forEach(function (k) {
      parts.push('<symbol id="art-' + k + '" viewBox="' + VB + '">' + ART[k] + "</symbol>");
    });
    // document.createElement("svg") 는 SVG 네임스페이스가 아니라 이름만 svg 인
    // HTML 요소를 만든다. 그 안에서는 symbol 도 rect 도 그려지지 않는다.
    // div 를 만들고 innerHTML 에 xmlns 가 붙은 svg 문자열을 넣어야 파서가
    // 제대로 된 SVG 요소로 만들어 준다 (icons.js 와 같은 방식).
    var host = document.createElement("div");
    host.id = "excer-art";
    host.setAttribute("aria-hidden", "true");
    // display:none 으로 숨기면 일부 브라우저가 그 안의 symbol 을 못 찾는 일이 있다.
    host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + parts.join("") + "</svg>";
    if (document.body) document.body.insertBefore(host, document.body.firstChild);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject);
  else inject();

  window.EXCER_ART = Object.keys(ART);
})();
