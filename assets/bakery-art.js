/* ===================================================================
   엑서 빵집 타이쿤 — 아트 팩토리 v3 (window.BakeryArt)
   -------------------------------------------------------------------
   아트 디렉션: cozy premium bakery — 웜 파스텔, 핸드페인트 벡터,
   소프트 셀 셰이딩, 웜 브라운 아웃라인, 좌상단 광원, 접지 그림자.
   모든 색·규격은 TOKENS에서 시작한다 (docs/ART_GUIDE.md §2).
   애니메이션 클래스(.shimmer .ovenglow .sweat .opensign …)는
   bakery.html CSS keyframes가 구동한다 — transform/opacity 전용.
   =================================================================== */
(function (global) {
  "use strict";

  /* ---------- 디자인 토큰 ---------- */
  var T = {
    out: "#5b3a26",                    // 공통 아웃라인(웜 브라운 — 검정 금지)
    outW: 2,                           // 설비 아웃라인 두께
    shadow: "rgba(96,56,16,.30)",      // 접지 그림자(웜)
    hi: "rgba(255,244,214,.55)",       // 좌상단 하이라이트
    cream: "#fdf6ec", paper: "#f6eedd",
    butter: "#f6d98a", caramel: "#e8b64c",
    wood: "#c99e6d", woodHi: "#e2bd8f", woodDk: "#96693f", woodDk2: "#845a35",
    brick: "#c96a4a", brickHi: "#d98a66", brickDk: "#a34e33",
    stone: "#e6cf9f", stoneHi: "#f4e6c2", stoneDk: "#d1b681", stoneDk2: "#bfa06a", mortar: "rgba(120,90,45,.28)",
    coral: "#e98f7f", mint: "#9fd8c3", mintDk: "#6db9a0",
    glow: "#ff9d3b", glowHi: "#ffd875",
    apricot: "#f7c896", warmGray: "#b0a494"
  };
  var uidc = 0;
  function uid() { return "bk" + (uidc++); }

  /* ---------- 팔레트 (캐릭터) ---------- */
  var SKINS = ["#ffe3c6", "#f7d1ab", "#eabc8d", "#cf9663", "#a97a44"];
  var HAIRC = ["#2d2320", "#4a3421", "#6b4426", "#8a5a33", "#b5793d", "#c94f4f", "#e2b04a", "#8d8d95"];
  var IRIS = ["#5a3a24", "#3f6a48", "#4a6aa8", "#6b4a86", "#7a5535"];
  var CLOTH = ["#e06d6d", "#5f8fd9", "#4cae7d", "#e8b64c", "#9a6bc9", "#e77fb3", "#5bbcc4", "#96a24f"];
  var PANTS = ["#4a4a58", "#6b4426", "#39506e", "#7a5d8a", "#8b5f52"];

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function pick(arr, n) { return arr[(n >>> 0) % arr.length]; } // >>>0: 음수 인덱스 방지
  function darken(hex, f) {
    if (!hex || hex.charAt(0) !== "#") hex = "#c99e6d";
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, ((n >> 16) & 255) * f) | 0, g = Math.min(255, ((n >> 8) & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0;
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function lighten(hex, amt) {
    if (!hex || hex.charAt(0) !== "#") hex = "#c99e6d";
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, ((n >> 16) & 255) + amt), g = Math.min(255, ((n >> 8) & 255) + amt), b = Math.min(255, (n & 255) + amt);
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function lgrad(id, c1, c2, vertical) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (vertical ? "0" : "1") + '" y2="' + (vertical ? "1" : "0.35") + '">' +
      '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>';
  }
  function rgrad(id, c1, c2) {
    return '<radialGradient id="' + id + '" cx="0.35" cy="0.3" r="0.9">' +
      '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></radialGradient>';
  }
  function contactShadow(cx, cy, rx) {
    var g = uid();
    return '<radialGradient id="' + g + '"><stop offset="0" stop-color="' + T.shadow + '"/><stop offset="1" stop-color="rgba(96,56,16,0)"/></radialGradient>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + (rx * 0.32) + '" fill="url(#' + g + ')"/>';
  }
  var FO = ' stroke="' + T.out + '" stroke-width="' + T.outW + '" stroke-linejoin="round"';

  // 아이소 박스(top/left/right 면) 공통 빌더 — 설비 몸체 중복 제거
  function isoBox(x0, yTop, w2, hBody, topC, leftC, rightC) {
    var top = uid(), fL = uid(), fR = uid();
    var cx = x0 + w2, topY = yTop, midY = yTop + w2 * 0.28;
    var defs = lgrad(top, lighten(topC, 14), darken(topC, 0.94)) +
      lgrad(fL, leftC, darken(leftC, 0.85), true) + lgrad(fR, rightC, darken(rightC, 0.85), true);
    var html =
      '<path d="M' + x0 + ' ' + midY + ' L' + cx + ' ' + topY + ' L' + (cx + w2) + ' ' + midY + ' L' + cx + ' ' + (midY + (midY - topY)) + ' Z" fill="url(#' + top + ')"' + FO + '/>' +
      '<path d="M' + x0 + ' ' + midY + ' L' + x0 + ' ' + (midY + hBody) + ' L' + cx + ' ' + (midY + (midY - topY) + hBody) + ' L' + cx + ' ' + (midY + (midY - topY)) + ' Z" fill="url(#' + fL + ')"' + FO + '/>' +
      '<path d="M' + (cx + w2) + ' ' + midY + ' L' + (cx + w2) + ' ' + (midY + hBody) + ' L' + cx + ' ' + (midY + (midY - topY) + hBody) + ' L' + cx + ' ' + (midY + (midY - topY)) + ' Z" fill="url(#' + fR + ')"' + FO + '/>' +
      '<path d="M' + (x0 + 4) + ' ' + (midY - 1) + ' L' + (cx - 2) + ' ' + (topY + 1.4) + '" stroke="' + T.hi + '" stroke-width="2.2" stroke-linecap="round"/>';
    return { defs: defs, html: html, cx: cx, midY: midY, botY: midY + (midY - topY) };
  }

  /* ---------- 외모 ---------- */
  function lookFromSeed(seed) {
    var h = hash(String(seed));
    return {
      skin: pick(SKINS, h), hair: (h >>> 3) % 7, hairC: pick(HAIRC, h >>> 6), iris: pick(IRIS, h >>> 8),
      top: (h >>> 9) % 4, topC: pick(CLOTH, h >>> 12), pantsC: pick(PANTS, h >>> 15),
      glasses: ((h >>> 18) % 10) < 3, hat: ((h >>> 21) % 10) < 2, bag: ((h >>> 24) % 10) < 3,
      hatC: pick(CLOTH, h >>> 26)
    };
  }
  function randomLook(rng) {
    rng = rng || Math.random;
    return {
      skin: SKINS[(rng() * SKINS.length) | 0], hair: (rng() * 7) | 0, hairC: HAIRC[(rng() * HAIRC.length) | 0],
      iris: IRIS[(rng() * IRIS.length) | 0],
      top: (rng() * 4) | 0, topC: CLOTH[(rng() * CLOTH.length) | 0], pantsC: PANTS[(rng() * PANTS.length) | 0],
      glasses: rng() < 0.25, hat: rng() < 0.18, bag: rng() < 0.25,
      hatC: CLOTH[(rng() * CLOTH.length) | 0]
    };
  }

  /* ---------- 헤어 ---------- */
  function hairSVG(look) {
    var c = look.hairC, d = darken(c, 0.72);
    var shine = '<path d="M22 12 Q28 9 36 10" stroke="rgba(255,255,255,.42)" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    var o = ' stroke="' + T.out + '" stroke-width="1.8" stroke-linejoin="round"';
    var back = "", front = "";
    switch (look.hair) {
      case 0:
        front = '<path d="M15 25 Q14 6 32 6 Q50 6 49 25 Q49 15 43 15 Q40 8 30 10 Q19 12 18 18 Q15 19 15 25Z" fill="' + c + '"' + o + '/>' + shine;
        break;
      case 1:
        back = '<path d="M14 22 Q12 44 19 46 L23 30 L41 30 L45 46 Q52 44 50 22 Q49 5 32 5 Q15 5 14 22Z" fill="' + d + '"' + o + '/>';
        front = '<path d="M15 25 Q15 6 32 6 Q49 6 49 25 Q46 13 38 14 Q34 8 25 12 Q17 14 15 25Z" fill="' + c + '"' + o + '/>' + shine;
        break;
      case 2:
        back = '<path d="M14 22 Q11 54 21 58 L26 34 L38 34 L43 58 Q53 54 50 22 Q49 5 32 5 Q15 5 14 22Z" fill="' + d + '"' + o + '/>';
        front = '<path d="M15 26 Q15 6 32 6 Q49 6 49 26 Q45 12 36 13 Q30 8 24 13 Q17 15 15 26Z" fill="' + c + '"' + o + '/>' + shine;
        break;
      case 3:
        back = '<path d="M46 15 Q60 21 55 45 Q53 54 48 51 Q53 34 44 23Z" fill="' + d + '"' + o + '/>';
        front = '<path d="M15 25 Q15 6 32 6 Q49 6 49 25 Q47 12 38 13 Q32 7 24 12 Q17 14 15 25Z" fill="' + c + '"' + o + '/>' +
          '<circle cx="46" cy="17" r="2.6" fill="' + darken(c, 0.6) + '"/>' + shine;
        break;
      case 4:
        front = '<g' + o + ' fill="' + c + '"><circle cx="20" cy="16" r="7.5"/><circle cx="31" cy="10" r="8.5"/><circle cx="43" cy="14" r="7.5"/><circle cx="48" cy="23" r="5.5"/><circle cx="16" cy="24" r="5.5"/></g>' + shine;
        break;
      case 5:
        front = '<path d="M15 27 Q13 5 32 5 Q51 5 49 27 Q48 13 40 16 Q43 9 33 8 Q25 8 26 15 Q17 14 15 27Z" fill="' + c + '"' + o + '/>' + shine;
        break;
      default:
        front = '<path d="M16 20 Q18 8 32 8 Q46 8 48 20 Q40 12 32 12 Q24 12 16 20Z" fill="' + c + '"' + o + '/>';
    }
    return { back: back, front: front };
  }

  /* ---------- 얼굴 ---------- */
  function faceSVG(look, mood) {
    var iris = (look && look.iris) || IRIS[0];
    var browC = look ? darken(look.hairC, 0.75) : T.out;
    var eyes, brows, mouth;
    if (mood === "sad") {
      brows = '<path d="M21 19 L28 21.6" stroke="' + browC + '" stroke-width="1.8" stroke-linecap="round"/><path d="M43 19 L36 21.6" stroke="' + browC + '" stroke-width="1.8" stroke-linecap="round"/>';
      eyes = '<path d="M22 26 Q25 23.4 28 26" stroke="' + T.out + '" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M36 26 Q39 23.4 42 26" stroke="' + T.out + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
      mouth = '<path d="M27.5 34.5 Q32 30.5 36.5 34.5" stroke="#8a4a3a" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    } else if (mood === "tired") {
      brows = '<path d="M21 19 Q24.5 20 28 19.4" stroke="' + browC + '" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M36 19.4 Q39.5 20 43 19" stroke="' + browC + '" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
      eyes = '<path d="M22 25 L28 25" stroke="' + T.out + '" stroke-width="2.2" stroke-linecap="round"/><path d="M36 25 L42 25" stroke="' + T.out + '" stroke-width="2.2" stroke-linecap="round"/>';
      mouth = '<path d="M29 33 L35 33" stroke="#8a4a3a" stroke-width="1.8" stroke-linecap="round"/>';
    } else {
      brows = '<path d="M21 18.6 Q24.5 17 28 18.4" stroke="' + browC + '" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M36 18.4 Q39.5 17 43 18.6" stroke="' + browC + '" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
      eyes =
        '<ellipse cx="25" cy="25" rx="3.9" ry="4.6" fill="#fff" stroke="' + T.out + '" stroke-width="1.1"/>' +
        '<ellipse cx="39" cy="25" rx="3.9" ry="4.6" fill="#fff" stroke="' + T.out + '" stroke-width="1.1"/>' +
        '<circle cx="25.5" cy="25.6" r="2.5" fill="' + iris + '"/><circle cx="39.5" cy="25.6" r="2.5" fill="' + iris + '"/>' +
        '<circle cx="25.5" cy="25.6" r="1.2" fill="#1d130c"/><circle cx="39.5" cy="25.6" r="1.2" fill="#1d130c"/>' +
        '<circle cx="26.4" cy="24.4" r=".9" fill="#fff"/><circle cx="40.4" cy="24.4" r=".9" fill="#fff"/>' +
        '<circle cx="24.6" cy="26.8" r=".45" fill="#fff" opacity=".8"/><circle cx="38.6" cy="26.8" r=".45" fill="#fff" opacity=".8"/>';
      mouth = mood === "open"
        ? '<path d="M28 31.5 Q32 31 36 31.5 Q35.4 36.8 32 36.8 Q28.6 36.8 28 31.5Z" fill="#8a4a3a"/><path d="M29.6 35.4 Q32 36.6 34.4 35.4 L34 36.2 Q32 37.4 30 36.2Z" fill="#e88a8a"/>'
        : '<path d="M27.5 31.5 Q32 36.5 36.5 31.5" stroke="#8a4a3a" stroke-width="1.9" fill="none" stroke-linecap="round"/>';
    }
    var nose = '<path d="M31.4 28.6 Q32.6 29.4 31.8 30.2" stroke="rgba(120,70,40,.5)" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
    var blushId = uid();
    var blush = '<radialGradient id="' + blushId + '"><stop offset="0" stop-color="rgba(244,140,140,.6)"/><stop offset="1" stop-color="rgba(244,140,140,0)"/></radialGradient>' +
      '<ellipse cx="20.5" cy="30" rx="3.4" ry="2.1" fill="url(#' + blushId + ')"/><ellipse cx="43.5" cy="30" rx="3.4" ry="2.1" fill="url(#' + blushId + ')"/>';
    var glasses = look && look.glasses
      ? '<g stroke="#3c2e24" stroke-width="1.6" fill="rgba(210,235,250,.28)"><rect x="19.5" y="20.5" width="11" height="9" rx="4"/><rect x="33.5" y="20.5" width="11" height="9" rx="4"/><path d="M30.5 24.5 L33.5 24.5" fill="none"/></g>'
      : "";
    return brows + eyes + nose + mouth + blush + glasses;
  }

  /* ---------- 의상 ---------- */
  function outfitSVG(look) {
    var c = look.topC, d = darken(c, 0.78), g = uid();
    var o = ' stroke="' + T.out + '" stroke-width="1.8" stroke-linejoin="round"';
    var defs = lgrad(g, lighten(c, 18), d, true);
    switch (look.top) {
      case 1:
        return defs + '<path d="M24 45 L40 45 L46 68 L18 68 Z" fill="url(#' + g + ')"' + o + '/>' +
          '<path d="M24 45 L40 45 L41 51 L23 51Z" fill="' + d + '" opacity=".5"/>' +
          '<path d="M27 55 L26 66 M32 54 L32 67 M37 55 L38 66" stroke="rgba(60,30,10,.18)" stroke-width="1.4"/>';
      case 2:
        return defs + '<rect x="21.5" y="44" width="21" height="22" rx="6.5" fill="url(#' + g + ')"' + o + '/>' +
          '<path d="M24 45 Q32 53 40 45 L40 49 Q32 56 24 49Z" fill="' + d + '"/>' +
          '<path d="M32 55 L32 64" stroke="' + d + '" stroke-width="1.6"/><circle cx="29" cy="52" r="1.1" fill="' + d + '"/><circle cx="35" cy="52" r="1.1" fill="' + d + '"/>';
      case 3:
        return defs + '<rect x="21.5" y="44" width="21" height="22" rx="5.5" fill="url(#' + g + ')"' + o + '/>' +
          '<path d="M29 44 L32 51 L35 44 Z" fill="#fff7ea" stroke="' + T.out + '" stroke-width="1.2"/>' +
          '<path d="M21.5 45 L27.5 45 L26 65 L21.5 62Z" fill="' + d + '"/><path d="M42.5 45 L36.5 45 L38 65 L42.5 62Z" fill="' + d + '"/>' +
          '<circle cx="32" cy="55" r="1" fill="' + d + '"/><circle cx="32" cy="60" r="1" fill="' + d + '"/>';
      default:
        return defs + '<rect x="21.5" y="44" width="21" height="22" rx="6.5" fill="url(#' + g + ')"' + o + '/>' +
          '<path d="M25 50 Q27 53 26 57 M39 50 Q37 53 38 57" stroke="rgba(60,30,10,.16)" stroke-width="1.4" fill="none"/>' +
          '<path d="M26 46 Q32 50 38 46" stroke="' + d + '" stroke-width="1.6" fill="none"/>';
    }
  }

  /* ---------- 캐릭터 ----------
     opts: {mood:happy|open|sad|tired, apron, apronC, chefHat, towel, scale, sweat, flour} */
  function charSVG(look, opts) {
    opts = opts || {};
    var mood = opts.mood || "happy";
    var hair = hairSVG(look);
    var skin = look.skin, skinG = uid();
    var isDress = look.top === 1 && !opts.apron;
    var legY = 65, legLen = isDress ? 9 : 13;
    var o = ' stroke="' + T.out + '" stroke-width="1.6" stroke-linejoin="round"';
    var apronC = opts.apronC || "#fff8ec";
    var apronD = darken(apronC, 0.86);

    var apron = opts.apron
      ? '<path d="M24 47 L40 47 L42.5 65 L21.5 65 Z" fill="' + apronC + '"' + o + '/>' +
        '<path d="M27 47 L27 44 L37 44 L37 47" stroke="' + apronC + '" stroke-width="2.6" fill="none"/>' +
        '<path d="M25.5 54 L38.5 54" stroke="' + apronD + '" stroke-width="1.3"/>' +
        '<path d="M29 58 Q32 60 35 58" stroke="' + apronD + '" stroke-width="1.2" fill="none"/>' +
        (opts.flour ? '<circle cx="27" cy="57" r="1.1" fill="#fff" opacity=".9"/><circle cx="34" cy="61" r=".9" fill="#fff" opacity=".8"/><circle cx="31" cy="52.5" r=".7" fill="#fff" opacity=".85"/>' : "")
      : "";
    var towel = opts.towel
      ? '<path d="M38 44 L44 44 L45 56 L39 56 Z" fill="#fdf3e4"' + o + '/><path d="M39.5 47 L44 47 M39.8 50 L44.4 50 M40 53 L44.7 53" stroke="#e2c9a8" stroke-width="1.1"/>'
      : "";
    var chefHat = opts.chefHat
      ? '<path d="M19 13 Q16 2 26 4 Q28 -3 36 0 Q45 -2 45 7 Q52 8 47 15 L45 19 L20 19 Z" fill="#fff"' + o + '/>' +
        '<rect x="19.5" y="14.5" width="26" height="5.5" rx="2.5" fill="#f0e8da" stroke="' + T.out + '" stroke-width="1.4"/>'
      : "";
    var capHat = (look.hat && !opts.chefHat)
      ? '<path d="M15 17 Q15 5 32 5 Q49 5 49 17 L53.5 19.5 Q54.5 22 50 21.8 L15 20.5 Z" fill="' + look.hatC + '"' + o + '/>' +
        '<path d="M20 9 Q26 6 33 6.5" stroke="rgba(255,255,255,.35)" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
      : "";
    var bag = look.bag
      ? '<path d="M40 45 L25 63" stroke="' + darken(look.pantsC, 0.85) + '" stroke-width="2.6"/>' +
        '<rect x="19.5" y="58" width="12.5" height="10" rx="3.4" fill="' + darken(look.topC, 0.62) + '"' + o + '/>' +
        '<path d="M19.5 62 L32 62" stroke="rgba(0,0,0,.2)" stroke-width="1.4"/><circle cx="26" cy="63.6" r="1.1" fill="' + T.caramel + '"/>'
      : "";
    var sweat = opts.sweat
      ? '<g class="sweatdrop"><path d="M50 14 Q53 18.5 50 20.5 Q47 18.5 50 14Z" fill="#9fd4f2" stroke="#6aa8cc" stroke-width="1"/></g>'
      : "";
    var armC = opts.apron ? apronC : look.topC;
    var arms =
      '<g class="arm armL" style="transform-origin:23px 47px">' +
      '<path d="M23 46 Q18.4 53 20.6 59.6" stroke="' + T.out + '" stroke-width="7.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M23 46 Q19 53 21 59" stroke="' + armC + '" stroke-width="4.8" fill="none" stroke-linecap="round"/>' +
      '<circle cx="21" cy="60.5" r="3" fill="' + skin + '"' + o + '/></g>' +
      '<g class="arm armR" style="transform-origin:41px 47px">' +
      '<path d="M41 46 Q45.6 53 43.4 59.6" stroke="' + T.out + '" stroke-width="7.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M41 46 Q45 53 43 59" stroke="' + armC + '" stroke-width="4.8" fill="none" stroke-linecap="round"/>' +
      '<circle cx="43" cy="60.5" r="3" fill="' + skin + '"' + o + '/></g>';
    var shoeG = uid();
    var legs =
      lgrad(shoeG, "#5a4436", "#33241a", true) +
      '<g class="leg legL" style="transform-origin:28px ' + legY + 'px"><rect x="25" y="' + legY + '" width="6" height="' + legLen + '" rx="2.8" fill="' + look.pantsC + '"' + o + '/>' +
      '<ellipse cx="28" cy="' + (legY + legLen + 1.6) + '" rx="4.8" ry="2.9" fill="url(#' + shoeG + ')"' + o + '/></g>' +
      '<g class="leg legR" style="transform-origin:36px ' + legY + 'px"><rect x="33" y="' + legY + '" width="6" height="' + legLen + '" rx="2.8" fill="' + darken(look.pantsC, 0.82) + '"' + o + '/>' +
      '<ellipse cx="36" cy="' + (legY + legLen + 1.6) + '" rx="4.8" ry="2.9" fill="url(#' + shoeG + ')"' + o + '/></g>';
    var s = opts.scale || 1;
    return '<svg class="chibi" width="' + (54 * s) + '" height="' + (76 * s) + '" viewBox="0 0 64 92" style="overflow:visible">' +
      '<defs>' + rgrad(skinG, lighten(skin, 14), darken(skin, 0.9)) + '</defs>' +
      contactShadow(32, 84, 16) +
      hair.back + bag + legs +
      '<g class="torso breath">' + outfitSVG(look) + apron + towel + arms + '</g>' +
      '<g class="headg breath2"><circle cx="32" cy="26" r="17" fill="url(#' + skinG + ')" stroke="' + T.out + '" stroke-width="2"/>' +
      '<path d="M17.5 31 Q22 39.5 32 39.5 Q42 39.5 46.5 31 Q44 42 32 42 Q20 42 17.5 31Z" fill="' + darken(skin, 0.86) + '" opacity=".4"/>' +
      hair.front + capHat + chefHat +
      '<g class="face">' + faceSVG(look, mood) + '</g></g>' +
      sweat +
      '</svg>';
  }

  /* ---------- 직원 2종 ---------- */
  // 베이커 v4 — 레퍼런스 전용 치비: 큰 셰프 모자 + 갈색 앞치마+리본 + 흰 셔츠 + 손 흔들기
  function bakerSVG(busy) {
    var co = ' stroke="' + T.out + '" stroke-width="1.7" stroke-linejoin="round"';
    var skin = "#ffe1c4", skinD = "#eec09a", hair = "#7a4a28", hairHi = "#9a6636";
    var apG = uid(), pantG = uid(), shirtC = "#fdf8ee";
    var defs = '<defs>' + lgrad(apG, "#b98a52", "#8f5f30", true) + lgrad(pantG, "#7a5230", "#5d3c20", true) + '</defs>';
    var sweat = busy ? '<g class="sweatdrop"><path d="M50 40 Q53 44.5 50 46.5 Q47 44.5 50 40Z" fill="#9fd4f2" stroke="#6aa8cc" stroke-width="1"/></g>' : "";
    return '<span class="staffwrap' + (busy ? " working" : " idlebob") + '">' +
      '<svg class="baker" width="54" height="86" viewBox="0 0 66 104" style="overflow:visible">' + defs +
      contactShadow(33, 100, 16) +
      // 다리(바지) + 신발
      '<rect x="26" y="86" width="6.4" height="13" rx="2.6" fill="url(#' + pantG + ')"' + co + '/>' +
      '<rect x="33.6" y="86" width="6.4" height="13" rx="2.6" fill="url(#' + pantG + ')"' + co + '/>' +
      '<ellipse cx="28.5" cy="100.5" rx="5.2" ry="3.1" fill="#8a5a33"' + co + '/><ellipse cx="37.5" cy="100.5" rx="5.2" ry="3.1" fill="#8a5a33"' + co + '/>' +
      // 흰 셔츠 몸통
      '<path d="M23 66 Q22 63 26 63 L40 63 Q44 63 43 66 L45 88 L21 88 Z" fill="' + shirtC + '"' + co + '/>' +
      // 오른팔(허리에 손) — 흰 롤업 소매 + 살구 손
      '<path d="M42 68 Q49 71 47 80" stroke="' + T.out + '" stroke-width="7.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M42 68 Q48.4 71 46.6 79.4" stroke="' + shirtC + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<rect x="43.5" y="76" width="7" height="4" rx="2" fill="#efe6d4"' + co + '/><circle cx="46" cy="81.5" r="3.2" fill="' + skin + '"' + co + '/>' +
      // 앞치마(갈색) + 어깨끈 + 밀가루
      '<path d="M27 66 L33 74 L39 66" stroke="url(#' + apG + ')" stroke-width="3.4" fill="none"/>' +
      '<path d="M25 72 Q24 70 27 69 L39 69 Q42 70 41 72 L44 90 Q44 92 41 92 L25 92 Q22 92 22 90 Z" fill="url(#' + apG + ')"' + co + '/>' +
      '<rect x="28" y="80" width="10" height="9" rx="1.6" fill="none" stroke="rgba(60,35,15,.28)" stroke-width="1.2"/>' +
      // 허리 리본
      '<path d="M33 84 L26 81 L28 87 Z" fill="#8a5a30"' + co + '/><path d="M33 84 L40 81 L38 87 Z" fill="#8a5a30"' + co + '/><circle cx="33" cy="84" r="2.4" fill="#7d4f28"' + co + '/>' +
      '<circle cx="36" cy="86" r=".9" fill="#fff" opacity=".85"/><circle cx="30" cy="83" r=".7" fill="#fff" opacity=".8"/><circle cx="39" cy="75" r=".7" fill="#fff" opacity=".8"/>' +
      // 왼팔 흔들기 — 롤업 소매 + 펼친 손
      '<g class="bakerwave" style="transform-origin:24px 68px">' +
      '<path d="M24 68 Q16 60 17 48" stroke="' + T.out + '" stroke-width="7.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M24 68 Q16.6 60 17.6 48.6" stroke="' + shirtC + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<rect x="14" y="47" width="7" height="4.4" rx="2" fill="#efe6d4"' + co + '/>' +
      '<circle cx="17" cy="43" r="4" fill="' + skin + '"' + co + '/>' +
      '<path d="M14 41 L13.6 37 M16 40 L16 36 M18 40 L18.4 36 M20 41 L20.8 37.6" stroke="' + skin + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M14 41 L13.6 37 M16 40 L16 36 M18 40 L18.4 36 M20 41 L20.8 37.6" stroke="' + T.out + '" stroke-width="0.5" fill="none" opacity=".5"/>' +
      '</g>' +
      // 밀가루 퍼프
      '<circle cx="9" cy="42" r="2.4" fill="#fff" opacity=".85"/><circle cx="12" cy="38" r="1.8" fill="#fff" opacity=".7"/><circle cx="7" cy="46" r="1.4" fill="#fff" opacity=".7"/>' +
      // 머리
      '<circle cx="33" cy="50" r="15.5" fill="' + skin + '"' + co + '/>' +
      '<path d="M20 55 Q25 62 33 62 Q41 62 46 55 Q43 64 33 64 Q23 64 20 55Z" fill="' + skinD + '" opacity=".35"/>' +
      '<ellipse cx="18.5" cy="51" rx="2.4" ry="3.2" fill="' + skin + '"' + co + '/><ellipse cx="47.5" cy="51" rx="2.4" ry="3.2" fill="' + skin + '"' + co + '/>' +
      // 앞머리(갈색)
      '<path d="M19 46 Q17 36 27 35 Q30 30 34 34 Q40 31 45 36 Q49 38 47 47 Q45 39 39 40 Q40 35 34 37 Q28 36 29 41 Q23 40 22 47 Q20 44 19 46Z" fill="' + hair + '"' + co + '/>' +
      '<path d="M25 39 Q30 36 36 38" stroke="' + hairHi + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      // 눈썹 + 큰 눈 + 볼터치 + 코 + 웃는 입
      '<path d="M22 45 Q26 43 30 45" stroke="' + darken(hair, 0.8) + '" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M36 45 Q40 43 44 45" stroke="' + darken(hair, 0.8) + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="27" cy="52" rx="4.2" ry="5.4" fill="#fff" stroke="' + T.out + '" stroke-width="1.1"/><ellipse cx="39" cy="52" rx="4.2" ry="5.4" fill="#fff" stroke="' + T.out + '" stroke-width="1.1"/>' +
      '<circle cx="27.4" cy="52.6" r="3" fill="#6a4a2a"/><circle cx="39.4" cy="52.6" r="3" fill="#6a4a2a"/>' +
      '<circle cx="27.4" cy="52.8" r="1.4" fill="#2a1a0e"/><circle cx="39.4" cy="52.8" r="1.4" fill="#2a1a0e"/>' +
      '<circle cx="28.6" cy="51" r="1.2" fill="#fff"/><circle cx="40.6" cy="51" r="1.2" fill="#fff"/><circle cx="26" cy="54" r=".6" fill="#fff" opacity=".8"/><circle cx="38" cy="54" r=".6" fill="#fff" opacity=".8"/>' +
      '<ellipse cx="21.5" cy="57" rx="2.8" ry="1.7" fill="#f4a3a3" opacity=".6"/><ellipse cx="44.5" cy="57" rx="2.8" ry="1.7" fill="#f4a3a3" opacity=".6"/>' +
      '<path d="M32.4 55.5 Q33 56.4 32.2 57" stroke="rgba(120,70,40,.5)" stroke-width="1.1" fill="none" stroke-linecap="round"/>' +
      '<path d="M29 59 Q33 63 37 59 Q36 61.5 33 61.5 Q30 61.5 29 59Z" fill="#8a4a3a"/><path d="M30.6 60.4 Q33 61.6 35.4 60.4 L35 61.2 Q33 62 31 61.2Z" fill="#e88a8a"/>' +
      // 큰 셰프 모자 (퍼프 + 밴드)
      '<path d="M14 33 Q7 20 20 16 Q22 5 33 8 Q44 4 50 14 Q63 15 56 30 Q60 34 51 34 L16 34 Q12 34 14 33Z" fill="#fdfaf3"' + co + '/>' +
      '<path d="M25 12 Q24 24 25.5 33 M40 11 Q41.5 24 40 33 M20 19 Q22 28 21 33 M49 17 Q48 27 49.5 33" stroke="rgba(200,188,170,.55)" stroke-width="1.4" fill="none"/>' +
      '<path d="M20 12 Q26 8 33 10" stroke="rgba(255,255,255,.7)" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M16 32 Q15 30 18 30 L48 30 Q51 30 50 32 L50 37 Q50 39 47 39 L19 39 Q16 39 16 37 Z" fill="#f4eee2"' + co + '/>' +
      '<path d="M19 33.5 L47 33.5" stroke="rgba(200,188,170,.5)" stroke-width="1.2"/>' +
      sweat +
      '</svg></span>';
  }
  // 바리스타 v4 — 레퍼런스 전용 치비: 셰프 모자 + 긴 웨이브 머리 + 코랄 셔츠 +
  // 민트 앞치마+리본 + 어깨 수건 + 커피컵. 한 손 허리.
  function baristaSVG(busy) {
    var co = ' stroke="' + T.out + '" stroke-width="1.7" stroke-linejoin="round"';
    var skin = "#ffe1c4", skinD = "#eec09a", hair = "#8a5730", hairHi = "#a97244", hairD = "#6e4526";
    var apG = uid(), pantG = uid(), shirtC = "#ec8a72", shirtD = "#d16f57", mint = "#a9dcb8", mintD = "#7fbf93";
    var defs = '<defs>' + lgrad(apG, mint, mintD, true) + lgrad(pantG, "#d9bd8e", "#b6975f", true) + '</defs>';
    var sweat = busy ? '<g class="sweatdrop"><path d="M52 42 Q55 46.5 52 48.5 Q49 46.5 52 42Z" fill="#9fd4f2" stroke="#6aa8cc" stroke-width="1"/></g>' : "";
    return '<span class="staffwrap' + (busy ? " working" : " idlebob") + '">' +
      '<svg class="baker" width="54" height="86" viewBox="0 0 66 104" style="overflow:visible">' + defs +
      contactShadow(33, 100, 16) +
      // 뒤로 흐르는 긴 웨이브 머리 (머리 뒤 레이어)
      '<path d="M17 44 Q10 60 15 78 Q17 86 22 84 Q17 70 22 56 Z" fill="' + hairD + '"' + co + '/>' +
      '<path d="M49 44 Q57 58 53 80 Q51 88 45 85 Q51 70 46 54 Z" fill="' + hairD + '"' + co + '/>' +
      '<path d="M20 58 Q18 70 22 80 M46 58 Q49 70 45 80" stroke="' + hair + '" stroke-width="2" fill="none" opacity=".6"/>' +
      // 다리(베이지 롤업 팬츠) + 흰 스니커즈
      '<rect x="26" y="86" width="6.6" height="13" rx="2.6" fill="url(#' + pantG + ')"' + co + '/>' +
      '<rect x="33.4" y="86" width="6.6" height="13" rx="2.6" fill="url(#' + pantG + ')"' + co + '/>' +
      '<rect x="25.6" y="95" width="7.4" height="3.6" rx="1.6" fill="#e8cca0"/>' +
      '<rect x="33" y="95" width="7.4" height="3.6" rx="1.6" fill="#e8cca0"/>' +
      '<ellipse cx="28.6" cy="100.5" rx="5.4" ry="3.2" fill="#fdf8ee"' + co + '/><ellipse cx="37.4" cy="100.5" rx="5.4" ry="3.2" fill="#fdf8ee"' + co + '/>' +
      '<path d="M25 100 Q28.6 98.4 32 100" stroke="#d9cbb2" stroke-width="1" fill="none"/><path d="M34 100 Q37.4 98.4 41 100" stroke="#d9cbb2" stroke-width="1" fill="none"/>' +
      // 코랄 셔츠 몸통
      '<path d="M23 66 Q22 63 26 63 L40 63 Q44 63 43 66 L45 88 L21 88 Z" fill="' + shirtC + '"' + co + '/>' +
      '<path d="M33 64 L33 84" stroke="' + shirtD + '" stroke-width="1.2"/><circle cx="33" cy="70" r=".9" fill="#fff"/><circle cx="33" cy="76" r=".9" fill="#fff"/>' +
      // 오른팔(허리에 손) — 코랄 롤업 소매 + 손
      '<path d="M42 68 Q49 71 47 80" stroke="' + T.out + '" stroke-width="7.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M42 68 Q48.4 71 46.6 79.4" stroke="' + shirtC + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<rect x="43.5" y="76" width="7" height="4" rx="2" fill="#f6d9cf"' + co + '/><circle cx="46" cy="81.5" r="3.2" fill="' + skin + '"' + co + '/>' +
      // 민트 앞치마 + 어깨끈 + 주머니 + 리본
      '<path d="M27 66 L33 74 L39 66" stroke="url(#' + apG + ')" stroke-width="3.4" fill="none"/>' +
      '<path d="M25 72 Q24 70 27 69 L39 69 Q42 70 41 72 L44 90 Q44 92 41 92 L25 92 Q22 92 22 90 Z" fill="url(#' + apG + ')"' + co + '/>' +
      '<rect x="34" y="80" width="8" height="8" rx="1.4" fill="none" stroke="' + mintD + '" stroke-width="1.2"/>' +
      '<path d="M33 84 L25 80 L28 88 Z" fill="' + mint + '"' + co + '/><path d="M33 84 L41 80 L38 88 Z" fill="' + mint + '"' + co + '/><circle cx="33" cy="84" r="2.6" fill="' + mintD + '"' + co + '/>' +
      // 어깨 수건(오른 어깨)
      '<path d="M41 64 L48 66 L46 80 L42 79 Z" fill="#fdf6ea"' + co + '/><path d="M42 72 L47 73 M42 75 L47 76" stroke="' + shirtC + '" stroke-width="1.2"/>' +
      // 왼팔 — 커피컵 들기 (소매 + 손 + 테이크아웃 컵)
      '<g class="baristahold" style="transform-origin:24px 68px">' +
      '<path d="M24 68 Q17 62 18 53" stroke="' + T.out + '" stroke-width="7.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M24 68 Q17.6 62 18.6 53.6" stroke="' + shirtC + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<rect x="15" y="50" width="7" height="4.4" rx="2" fill="#f6d9cf"' + co + '/>' +
      '<circle cx="18" cy="48" r="3.4" fill="' + skin + '"' + co + '/>' +
      // 테이크아웃 컵
      '<path d="M12 40 L24 40 L22.5 51 Q22 53 17.6 53 Q13 53 12.6 51 Z" fill="#fdf6ea"' + co + '/>' +
      '<rect x="11.4" y="43.5" width="13.2" height="4.4" rx="1.4" fill="#c99a5e"' + co + '/>' +
      '<path d="M13 40 L23 40 L23 38.5 Q23 37 21 37 L15 37 Q13 37 13 38.5 Z" fill="#8a5a33"' + co + '/>' +
      '<path d="M25 38 Q28 35 26 32" stroke="#e8e0d2" stroke-width="1.6" fill="none" stroke-linecap="round" class="smoke"/>' +
      '</g>' +
      // 머리(앞) + 얼굴
      '<circle cx="33" cy="50" r="15.5" fill="' + skin + '"' + co + '/>' +
      '<path d="M20 55 Q25 62 33 62 Q41 62 46 55 Q43 64 33 64 Q23 64 20 55Z" fill="' + skinD + '" opacity=".35"/>' +
      '<ellipse cx="18.5" cy="51" rx="2.4" ry="3.2" fill="' + skin + '"' + co + '/><ellipse cx="47.5" cy="51" rx="2.4" ry="3.2" fill="' + skin + '"' + co + '/>' +
      // 옆으로 흐르는 앞머리 웨이브(얼굴 프레임)
      '<path d="M18 48 Q15 34 28 33 Q31 28 35 33 Q42 30 47 36 Q51 40 48 50 Q47 41 41 41 Q35 33 30 37 Q23 37 22 46 Q19 45 18 48Z" fill="' + hair + '"' + co + '/>' +
      '<path d="M18 49 Q13 58 16 66 Q19 60 21 52 Z" fill="' + hair + '"' + co + '/><path d="M48 49 Q53 58 50 68 Q47 60 45 52 Z" fill="' + hair + '"' + co + '/>' +
      '<path d="M26 38 Q32 34 39 37" stroke="' + hairHi + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      // 눈썹 + 큰 눈(속눈썹) + 볼터치 + 코 + 활짝 웃는 입
      '<path d="M22 44 Q26 42 30 44" stroke="' + hairD + '" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M36 44 Q40 42 44 44" stroke="' + hairD + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="27" cy="52" rx="4.3" ry="5.6" fill="#fff" stroke="' + T.out + '" stroke-width="1.1"/><ellipse cx="39" cy="52" rx="4.3" ry="5.6" fill="#fff" stroke="' + T.out + '" stroke-width="1.1"/>' +
      '<circle cx="27.4" cy="52.6" r="3.1" fill="#6a4a2a"/><circle cx="39.4" cy="52.6" r="3.1" fill="#6a4a2a"/>' +
      '<circle cx="27.4" cy="52.8" r="1.5" fill="#2a1a0e"/><circle cx="39.4" cy="52.8" r="1.5" fill="#2a1a0e"/>' +
      '<circle cx="28.6" cy="51" r="1.3" fill="#fff"/><circle cx="40.6" cy="51" r="1.3" fill="#fff"/><circle cx="26" cy="54" r=".6" fill="#fff" opacity=".8"/><circle cx="38" cy="54" r=".6" fill="#fff" opacity=".8"/>' +
      '<path d="M22.6 47.6 L24.4 46.4 M43.4 47.6 L41.6 46.4" stroke="' + T.out + '" stroke-width="1.2" stroke-linecap="round"/>' +
      '<ellipse cx="21.5" cy="57" rx="2.8" ry="1.7" fill="#f4a3a3" opacity=".6"/><ellipse cx="44.5" cy="57" rx="2.8" ry="1.7" fill="#f4a3a3" opacity=".6"/>' +
      '<path d="M32.4 55.5 Q33 56.4 32.2 57" stroke="rgba(120,70,40,.5)" stroke-width="1.1" fill="none" stroke-linecap="round"/>' +
      '<path d="M28 59 Q33 65 38 59 Q37 62 33 62 Q29 62 28 59Z" fill="#8a4a3a"/><path d="M30 60.6 Q33 62.2 36 60.6 L35.4 61.6 Q33 62.8 30.6 61.6Z" fill="#e88a8a"/>' +
      // 셰프 모자
      '<path d="M14 33 Q7 20 20 16 Q22 5 33 8 Q44 4 50 14 Q63 15 56 30 Q60 34 51 34 L16 34 Q12 34 14 33Z" fill="#fdfaf3"' + co + '/>' +
      '<path d="M25 12 Q24 24 25.5 33 M40 11 Q41.5 24 40 33 M20 19 Q22 28 21 33 M49 17 Q48 27 49.5 33" stroke="rgba(200,188,170,.55)" stroke-width="1.4" fill="none"/>' +
      '<path d="M20 12 Q26 8 33 10" stroke="rgba(255,255,255,.7)" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M16 32 Q15 30 18 30 L48 30 Q51 30 50 32 L50 37 Q50 39 47 39 L19 39 Q16 39 16 37 Z" fill="#f4eee2"' + co + '/>' +
      sweat +
      '</svg></span>';
  }
  function cashierSVG() { return baristaSVG(false); } // 하위 호환

  /* ===================================================================
     설비 v3
     =================================================================== */

  // 벽돌 오븐 v4 — 크림 사암 화덕(레퍼런스 재현): 아치 화구+장작불, 상단 빵 트레이·
  // 항아리·뚜껑 냄비, 좌측 빵 삽, 우측 장작 바구니, 하단 아궁이. busy 시 발광 pulse+연기.
  function ovenSVG(busy) {
    var glow = uid(), bodyG = uid(), riserG = uid(), potG = uid();
    var defs = lgrad(bodyG, T.stoneHi, T.stoneDk, true) + lgrad(riserG, T.stone, T.stoneDk2, true) +
      lgrad(potG, "#d99a55", "#a86a2f", true) +
      '<radialGradient id="' + glow + '"><stop offset="0" stop-color="#fff0b0"/><stop offset=".5" stop-color="' + T.glow + '"/><stop offset="1" stop-color="rgba(176,66,31,0)"/></radialGradient>';
    // 화구 내부(장작+불)
    var mouthDark = '<path d="M30 80 Q30 52 46 52 Q62 52 62 80 Z" fill="#25150c"/>';
    var logs = '<ellipse cx="41" cy="76" rx="7" ry="2.6" fill="#7a4a2a" stroke="#5d3720" stroke-width="1"/><ellipse cx="51" cy="77" rx="6" ry="2.4" fill="#8a5730" stroke="#5d3720" stroke-width="1"/><circle cx="35" cy="75.5" r="2" fill="#6b4426"/><circle cx="57" cy="76" r="2" fill="#6b4426"/>';
    var fire = busy
      ? '<g class="ovenglow"><ellipse cx="46" cy="70" rx="17" ry="16" fill="url(#' + glow + ')"/></g>' + logs +
        '<g class="fireflick"><path d="M39 75 Q34 62 40 53 Q43 60 47 55 Q52 62 47 71 Q45 76 39 75Z" fill="#ff9d3b"/>' +
        '<path d="M46 74 Q42 64 46 57 Q49 63 52 58 Q55 65 51 72 Q49 76 46 74Z" fill="#ffce54"/>' +
        '<path d="M43 72 Q41 66 43.6 62 Q45 65 46.6 63 Q48.4 67 46 71 Q45 73 43 72Z" fill="#fff3b0"/></g>'
      : logs + '<path d="M34 74 Q46 70 58 74" stroke="rgba(255,180,90,.18)" stroke-width="2.5" fill="none"/>';
    var smoke = busy
      ? '<g class="smoke"><circle cx="52" cy="46" r="3.6" fill="#e3d9cb" opacity=".7"/><circle cx="55" cy="39" r="4.6" fill="#ece4d8" opacity=".5"/></g>' : "";
    return '<svg width="116" height="108" viewBox="0 0 116 108" style="overflow:visible"><defs>' + defs + '</defs>' +
      contactShadow(58, 102, 50) +
      // 뒤쪽 냄비 받침(작은 벽돌 단)
      '<path d="M70 24 L98 24 L100 44 L68 44 Z" fill="url(#' + riserG + ')"' + FO + '/>' +
      '<path d="M70 30 L98 30 M70 37 L99 37" stroke="' + T.mortar + '" stroke-width="1.4"/>' +
      // 뚜껑 냄비(구리 돔)
      '<ellipse cx="84" cy="24" rx="15" ry="5.5" fill="' + T.stone + '"' + FO + '/>' +
      '<path d="M71 23 Q71 10 84 10 Q97 10 97 23 Z" fill="url(#' + potG + ')"' + FO + '/>' +
      '<path d="M74 15 Q79 11 85 11.5" stroke="rgba(255,255,255,.45)" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<circle cx="84" cy="8" r="2.6" fill="#c98b45"' + FO + '/><path d="M84 5.5 L84 3" stroke="' + T.out + '" stroke-width="1.6"/>' + smoke +
      // 본체(크림 사암)
      '<path d="M12 52 Q12 44 20 43 L94 43 Q102 44 102 52 L102 96 Q102 102 96 102 L18 102 Q12 102 12 96 Z" fill="url(#' + bodyG + ')"' + FO + '/>' +
      // 상단 면(밝은 슬래브)
      '<ellipse cx="57" cy="45" rx="46" ry="10.5" fill="' + T.stoneHi + '"' + FO + '/>' +
      // 벽돌 이음선
      '<path d="M14 60 L100 60 M14 72 L28 72 M64 72 L100 72 M14 84 L100 84 M14 96 L100 96 M40 60 L40 43 M74 60 L74 43 M22 84 L22 96 M50 84 L50 96 M78 84 L78 96 M90 72 L90 84" stroke="' + T.mortar + '" stroke-width="1.5"/>' +
      // 좌상단 하이라이트
      '<path d="M18 47 Q34 40 54 40" stroke="' + T.hi + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      // 아치 화구: voussoir 링
      '<path d="M22 82 Q22 44 46 44 Q70 44 70 82 L62 82 Q62 52 46 52 Q30 52 30 82 Z" fill="' + T.stoneDk + '" stroke="' + T.out + '" stroke-width="2"/>' +
      '<path d="M26 70 L34 66 M28 58 L36 57 M46 46.5 L46 54 M64 58 L57 57 M66 70 L58 66" stroke="' + T.mortar + '" stroke-width="1.4"/>' +
      mouthDark + fire +
      // 하단 아궁이 + 장작
      '<path d="M34 101 Q34 88 46 88 Q58 88 58 101 Z" fill="#3a2418"' + FO + '/>' +
      '<ellipse cx="42" cy="98" rx="5" ry="2" fill="#c99e6d"/><ellipse cx="50" cy="99" rx="4.4" ry="1.8" fill="#b98a58"/><circle cx="42" cy="98" r="1.2" fill="#e2bd8f"/><circle cx="50" cy="99" r="1" fill="#d1b681"/>' +
      // 좌측 빵 삽(peel)
      '<g transform="rotate(-12 12 70)"><rect x="8" y="60" width="7" height="42" rx="3" fill="' + T.woodHi + '"' + FO + '/><ellipse cx="11.5" cy="58" rx="9" ry="7" fill="' + T.wood + '"' + FO + '/><ellipse cx="11.5" cy="56.5" rx="5.5" ry="4" fill="' + T.woodHi + '"/></g>' +
      // 우측 장작 바구니
      '<path d="M92 78 L112 78 L110 100 L94 100 Z" fill="' + T.wood + '"' + FO + '/>' +
      '<path d="M94 82 L110 82 M94 88 L110 88 M94 94 L110 94 M98 78 L97 100 M102 78 L102 100 M106 78 L107 100" stroke="' + T.woodDk + '" stroke-width="1.2"/>' +
      '<ellipse cx="97" cy="77" rx="3.4" ry="2.4" fill="#e2c39a" stroke="#b98a58" stroke-width="1"/><ellipse cx="104" cy="76" rx="3.4" ry="2.4" fill="#d9b487" stroke="#b98a58" stroke-width="1"/><circle cx="97" cy="77" r="1.1" fill="#c9a06e"/><circle cx="104" cy="76" r="1" fill="#c9a06e"/>' +
      // 상단 빵 트레이(갓 구운 롤)
      '<ellipse cx="42" cy="40" rx="15" ry="5.5" fill="' + T.woodDk + '"/><ellipse cx="42" cy="38.4" rx="15" ry="5.5" fill="' + T.wood + '"' + FO + '/><ellipse cx="42" cy="37.6" rx="12.5" ry="4" fill="' + T.woodHi + '"/>' +
      '<ellipse cx="35" cy="36.5" rx="4.4" ry="2.8" fill="#e8b062"/><path d="M32 35.6 Q35 33.6 38 35.6" stroke="#c9803e" stroke-width="1.2" fill="none"/>' +
      '<ellipse cx="43" cy="37.5" rx="4.4" ry="2.8" fill="#e2a95e"/><path d="M40 36.6 Q43 34.6 46 36.6" stroke="#c1852f" stroke-width="1.2" fill="none"/>' +
      '<ellipse cx="49" cy="36" rx="4" ry="2.6" fill="#e8b062"/><path d="M46 35.2 Q49 33.4 52 35.2" stroke="#c9803e" stroke-width="1.1" fill="none"/>' +
      // 항아리 + 초록잎
      '<path d="M60 40 Q58 42 58.6 45 Q59 48 62 48 L68 48 Q71 48 71.4 45 Q72 42 70 40 Z" fill="#f2e8d4"' + FO + '/>' +
      '<path d="M61 39.5 L69 39.5 L68.6 41 L61.4 41 Z" fill="#d9c4a0"' + FO + '/><path d="M62 43 Q65 44.5 68 43" stroke="#c9a06e" stroke-width="1.1" fill="none"/>' +
      '<path d="M58 41 Q54 39 55 35 Q57 38 59 37" stroke="#7aab5a" stroke-width="1.6" fill="#8fc06a"/><circle cx="55" cy="35.5" r="1.6" fill="#f2a3b8"/>' +
      '</svg>';
  }

  // 유리 쇼케이스 v4 — 레퍼런스 재현: 곡면 유리 진열장 + 2단 선반(실제 재고) +
  // 상단 케이크돔·빵트레이·브레드스틱 컵 + 원목 수납장 베이스. 상태(ok/low/empty).
  function displaySVG(items, ratio) {
    var frameG = uid(), baseG = uid(), gl = uid(), domeG = uid();
    var state = (!items.length) ? "empty" : (ratio < 0.25 ? "low" : "ok");
    // 재고 진열: 위/아래 2단, 단당 3칸 (실제 재고 이모지)
    var goods = "", tags = "";
    for (var i = 0; i < Math.min(items.length, 6); i++) {
      var shelf = i < 3 ? 0 : 1;
      var slot = i % 3;
      var gx = 20 + slot * 20, gy = shelf === 0 ? 47 : 63;
      goods += '<text x="' + (gx - 6) + '" y="' + gy + '" font-size="12.5">' + items[i].emoji + '</text>';
      tags += '<rect x="' + (gx - 8) + '" y="' + (gy + 2.5) + '" width="11" height="4.5" rx="1.5" fill="#fdf6ea" stroke="#e2cba6" stroke-width=".8"/>';
    }
    var stateTag = state === "empty"
      ? '<text x="26" y="56" font-size="9" fill="#a5895e" font-weight="800" transform="rotate(-4 26 56)">SOLD OUT</text>'
      : (state === "low" ? '<circle cx="70" cy="40" r="3.2" fill="' + T.coral + '" stroke="#fff" stroke-width="1.2" class="warnpulse"/>' : "");
    return '<svg width="100" height="98" viewBox="0 0 100 98" style="overflow:visible"><defs>' +
      lgrad(frameG, T.woodHi, T.woodDk, true) + lgrad(baseG, "#b5824f", "#7d5330", true) + lgrad(domeG, "#e8c98a", "#cf9a4f", true) +
      '<linearGradient id="' + gl + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgba(240,250,255,.55)"/><stop offset=".45" stop-color="rgba(228,244,252,.16)"/><stop offset="1" stop-color="rgba(208,234,248,.32)"/></linearGradient>' +
      '</defs>' + contactShadow(50, 93, 44) +
      // 원목 수납장 베이스 (판넬 도어 2개 + 아치 컷 + 손잡이)
      '<path d="M12 66 L88 66 L84 92 L16 92 Z" fill="url(#' + baseG + ')"' + FO + '/>' +
      '<path d="M10 62 L90 62 L88 68 L12 68 Z" fill="' + T.cream + '"' + FO + '/>' +
      '<rect x="20" y="70" width="26" height="18" rx="2.5" fill="none" stroke="' + T.woodDk + '" stroke-width="1.6"/>' +
      '<rect x="52" y="70" width="26" height="18" rx="2.5" fill="none" stroke="' + T.woodDk + '" stroke-width="1.6"/>' +
      '<path d="M30 86 Q41 82 50 86" stroke="' + T.woodDk + '" stroke-width="1.4" fill="none"/>' +
      '<circle cx="44" cy="79" r="1.6" fill="' + T.caramel + '"/><circle cx="54" cy="79" r="1.6" fill="' + T.caramel + '"/>' +
      // 유리 케이스 몸통 (곡면 상단 우측)
      '<path d="M14 34 Q14 24 26 24 L74 24 Q86 24 86 40 L86 62 L14 62 Z" fill="' + T.cream + '"' + FO + '/>' +
      // 내부 어둑 + 선반
      '<rect x="17" y="30" width="66" height="30" rx="3" fill="' + (state === "empty" ? "rgba(90,60,30,.14)" : "rgba(120,90,50,.10)") + '"/>' +
      '<path d="M17 50 L83 50" stroke="' + T.wood + '" stroke-width="2.4"/>' +
      goods + tags + stateTag +
      // 유리 전면(반사 + shimmer) — 우측 곡면 프레임
      '<path d="M14 34 Q14 24 26 24 L74 24 Q86 24 86 40 L86 62 L14 62 Z" fill="url(#' + gl + ')"/>' +
      '<path d="M14 34 Q14 24 26 24 L74 24 Q86 24 86 40 L86 62" fill="none" stroke="' + T.wood + '" stroke-width="3.4"/>' +
      '<path d="M78 26 Q85 30 85 42 L85 60" fill="none" stroke="' + T.woodHi + '" stroke-width="2.6"/>' +
      '<g class="shimmer"><path d="M24 27 L20 59 M30 27 L27 59" stroke="rgba(255,255,255,.4)" stroke-width="3.5"/></g>' +
      '<path d="M20 28 L74 26" stroke="' + T.hi + '" stroke-width="2" stroke-linecap="round"/>' +
      // 상단 좌: 딸기 케이크 유리돔
      '<ellipse cx="30" cy="24" rx="12" ry="4" fill="' + T.woodHi + '"' + FO + '/>' +
      '<path d="M20 22 Q20 8 30 8 Q40 8 40 22 Z" fill="rgba(226,244,252,.5)" stroke="#fff" stroke-width="1.6"/>' +
      '<path d="M26 20 L26 15 L34 15 L34 20Z" fill="#fff3e8"/><path d="M26 17.5 L34 17.5" stroke="#f2c0a0" stroke-width="1"/><circle cx="30" cy="13.5" r="2" fill="#e0555f"/>' +
      '<circle cx="30" cy="6.5" r="1.8" fill="' + T.caramel + '"' + FO + '/>' +
      // 상단 우: 빵 트레이(크루아상)
      '<path d="M46 24 L74 20 L78 22 L50 26 Z" fill="' + T.woodDk + '"/><path d="M46 22 L74 18 L78 20 L50 24 Z" fill="' + T.wood + '"' + FO + '/>' +
      '<path d="M52 20.5 Q56 17.5 60 20 Q57 21.5 53 21.5 Z" fill="#e2a95e" stroke="#c1852f" stroke-width=".8"/>' +
      '<path d="M62 19.5 Q66 16.5 70 19 Q67 20.5 63 20.5 Z" fill="#e8b062" stroke="#c9803e" stroke-width=".8"/>' +
      // 우측: 브레드스틱 컵
      '<path d="M80 22 L90 22 L89 30 L81 30 Z" fill="' + T.woodHi + '"' + FO + '/>' +
      '<path d="M82 22 L82 15 M84.5 22 L84.5 14 M87 22 L87 15 M89 22 L88.6 16" stroke="#e2b06a" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
  }

  // 커피: 핸드드립 → 에스프레소 머신(크림+크롬)
  function coffeeSVG(machine, busy) {
    var top = uid(), fL = uid(), fR = uid();
    var steam = busy ? '<g class="smoke"><circle cx="46" cy="10" r="4" fill="#eee6da" opacity=".75"/><circle cx="51" cy="3" r="5.5" fill="#f4ede2" opacity=".5"/></g>' : "";
    var base = '<defs>' + lgrad(top, T.woodHi, "#c09468") + lgrad(fL, "#b08356", T.woodDk, true) + lgrad(fR, T.woodDk2, "#74502f", true) + '</defs>';
    if (!machine) {
      return '<svg width="82" height="76" viewBox="0 0 82 76" style="overflow:visible">' + base + contactShadow(41, 71, 30) +
        '<path d="M8 38 L41 29 L74 38 L41 47 Z" fill="url(#' + top + ')"' + FO + '/>' +
        '<path d="M8 38 L8 60 L41 69 L41 47Z" fill="url(#' + fL + ')"' + FO + '/><path d="M74 38 L74 60 L41 69 L41 47Z" fill="url(#' + fR + ')"' + FO + '/>' +
        '<path d="M30 20 L50 20 L46.6 33 L33.4 33 Z" fill="rgba(232,242,248,.85)" stroke="#fff" stroke-width="1.6"/>' +
        '<path d="M33 22 L39 31" stroke="rgba(255,255,255,.7)" stroke-width="2.6"/>' +
        '<path d="M36 26 L44 26 L43 31 L37 31Z" fill="#6b4426"/>' +
        '<rect x="33.5" y="33" width="13" height="3.4" rx="1.4" fill="#8a5a33"' + FO + '/>' +
        '<path d="M16 16 Q16 8 24 8 L29 8 L29 21 L21 23 Q16 23 16 16Z" fill="#5b6470"' + FO + '/><path d="M29 10.5 Q38 10.5 36 17.5" stroke="#5b6470" stroke-width="3.4" fill="none"/>' +
        '<path d="M18 11 Q21 9 25 9.6" stroke="rgba(255,255,255,.5)" stroke-width="1.8" fill="none"/>' +
        steam + '</svg>';
    }
    // 에스프레소 머신 v4 — 레퍼런스 재현: 크림 바디 + 골드 게이지/버튼 + 은색 그룹헤드 2개
    // + 상단 컵 2개·밀크저그 + 하단 트레이 컵 2개(커피 추출) + 원목 베이스
    var body = uid(), head = uid(), chrome = uid(), gold = uid(), woodB = uid();
    var extract = busy
      ? '<path d="M30 55 L30 60 M52 55 L52 60" stroke="#7a4a2a" stroke-width="1.8" stroke-linecap="round"/>'
      : "";
    var espG = busy ? '#c9803e' : '#dda15e';
    return '<svg width="96" height="88" viewBox="0 0 96 88" style="overflow:visible">' + base +
      '<defs>' + lgrad(body, "#faf2df", "#e6d4b2", true) + lgrad(head, "#f2ecdf", "#d8c8ac", true) +
      lgrad(chrome, "#f0f2f6", "#a6a8b4", true) + lgrad(gold, "#f2d488", "#c99a3e", true) + lgrad(woodB, T.wood, T.woodDk, true) + '</defs>' +
      contactShadow(48, 83, 40) +
      // 원목 베이스
      '<path d="M14 74 L82 74 L79 84 L17 84 Z" fill="url(#' + woodB + ')"' + FO + '/>' +
      // 하단 드립 트레이 (은색 그릴)
      '<path d="M12 62 L84 62 L82 76 L14 76 Z" fill="url(#' + chrome + ')"' + FO + '/>' +
      '<path d="M20 66 L76 66 M20 69 L75 69 M21 72 L74 72" stroke="#b6b8c2" stroke-width="1.4"/>' +
      // 몸통 하부(그룹헤드 영역)
      '<rect x="16" y="40" width="64" height="24" rx="4" fill="url(#' + body + ')"' + FO + '/>' +
      // 상부 헤드 박스
      '<rect x="14" y="14" width="68" height="28" rx="7" fill="url(#' + head + ')"' + FO + '/>' +
      '<rect x="14" y="14" width="68" height="8" rx="6" fill="rgba(255,255,255,.5)"/>' +
      '<rect x="16" y="16" width="64" height="24" rx="5" fill="none" stroke="' + T.caramel + '" stroke-width="1.2" opacity=".6"/>' +
      // 압력 게이지(골드) + 버튼 4개(골드)
      '<circle cx="40" cy="30" r="7.5" fill="url(#' + gold + ')"' + FO + '/><circle cx="40" cy="30" r="5.2" fill="#fbf3df"/>' +
      '<path d="M40 30 L43.5 27.5" stroke="' + T.coral + '" stroke-width="1.4" stroke-linecap="round"/><circle cx="40" cy="30" r="1" fill="' + T.out + '"/>' +
      '<circle cx="26" cy="28" r="2.4" fill="url(#' + gold + ')"' + FO + '/><circle cx="26" cy="34" r="2.4" fill="url(#' + gold + ')"' + FO + '/>' +
      '<circle cx="54" cy="28" r="2.4" fill="url(#' + gold + ')"' + FO + '/><circle cx="54" cy="34" r="2.4" fill="url(#' + gold + ')"' + FO + '/>' +
      // 우측 스팀 노브(은색)
      '<circle cx="72" cy="31" r="4.4" fill="url(#' + chrome + ')"' + FO + '/><circle cx="72" cy="31" r="1.6" fill="#8a8c98"/>' +
      // 그룹헤드 2개(은색 포터필터 + 우드 핸들) + 추출
      '<rect x="27" y="42" width="9" height="8" rx="1.6" fill="url(#' + chrome + ')"' + FO + '/><rect x="24" y="50" width="15" height="4" rx="2" fill="url(#' + chrome + ')"' + FO + '/>' +
      '<rect x="12" y="49" width="16" height="4.4" rx="2.2" fill="' + T.wood + '"' + FO + '/><circle cx="12" cy="51.2" r="3" fill="' + T.caramel + '"' + FO + '/>' +
      '<rect x="49" y="42" width="9" height="8" rx="1.6" fill="url(#' + chrome + ')"' + FO + '/><rect x="46" y="50" width="15" height="4" rx="2" fill="url(#' + chrome + ')"' + FO + '/>' +
      '<rect x="58" y="49" width="16" height="4.4" rx="2.2" fill="' + T.wood + '"' + FO + '/><circle cx="74" cy="51.2" r="3" fill="' + T.caramel + '"' + FO + '/>' +
      extract +
      // 하단 트레이 컵 2개(커피)
      '<path d="M25 56 L37 56 L35.5 63 Q35 65 31 65 Q27 65 26.5 63 Z" fill="#fdf6ea"' + FO + '/><ellipse cx="31" cy="56" rx="6" ry="1.8" fill="' + espG + '"/><path d="M37 57 Q40 57 39 60" stroke="' + T.out + '" stroke-width="1.4" fill="none"/>' +
      '<path d="M47 56 L59 56 L57.5 63 Q57 65 53 65 Q49 65 48.5 63 Z" fill="#fdf6ea"' + FO + '/><ellipse cx="53" cy="56" rx="6" ry="1.8" fill="' + espG + '"/><path d="M59 57 Q62 57 61 60" stroke="' + T.out + '" stroke-width="1.4" fill="none"/>' +
      // 상단: 컵 2개 + 밀크저그
      '<path d="M40 8 L50 8 L49 14 Q49 15 44.5 15 Q40 15 40 14 Z" fill="#fdf6ea"' + FO + '/><path d="M50 9 Q53 9 52 12" stroke="' + T.out + '" stroke-width="1.3" fill="none"/>' +
      '<path d="M54 8 L64 8 L63 14 Q63 15 58.5 15 Q54 15 54 14 Z" fill="#fdf6ea"' + FO + '/><path d="M64 9 Q67 9 66 12" stroke="' + T.out + '" stroke-width="1.3" fill="none"/>' +
      '<path d="M26 6 Q26 3 30 3 L34 3 Q35 3 35 6 L35 13 Q35 15 30.5 15 Q26 15 26 13 Z" fill="#f2ede0"' + FO + '/><path d="M35 8 L38 6 L38 9 L35 10Z" fill="#f2ede0"' + FO + '/><circle cx="30.5" cy="2" r="1.6" fill="' + T.caramel + '"' + FO + '/>' +
      steam + '</svg>';
  }

  // 카운터 v4 — 레퍼런스 재현: 원목 수납장(판넬 도어+아치 통풍구) + 크림 대리석 상판
  // + POS 계산기(초록 화면·컬러 키패드·영수증·서랍) + 유리 팁 항아리(금화) + 동전 + 브레드스틱 컵 + 메뉴 카드
  function counterSVG(tips, active) {
    var woodF = uid(), woodR = uid(), topG = uid(), posG = uid(), scr = uid();
    // 팁 항아리(코르크 뚜껑 + 금화 + 초록잎)
    var jar = '<g' + (tips > 0 ? ' class="jarshine"' : "") + '>' +
      '<path d="M54 34 Q51 34 51 39 L51 50 Q51 55 57 55 L67 55 Q73 55 73 50 L73 39 Q73 34 70 34 Z" fill="rgba(224,240,250,.66)" stroke="#fff" stroke-width="1.8"/>' +
      '<ellipse cx="62" cy="34" rx="9" ry="2.6" fill="#d9a55e"/><ellipse cx="62" cy="32.5" rx="9" ry="2.6" fill="#e8b96e"' + FO + '/><circle cx="62" cy="30" r="2.4" fill="#c98b45"' + FO + '/>' +
      (tips > 0
        ? '<ellipse cx="58" cy="50" rx="3.4" ry="1.8" fill="' + T.caramel + '" stroke="#c9922e" stroke-width=".7"/><ellipse cx="65" cy="51" rx="3.4" ry="1.8" fill="#f4d27e" stroke="#c9922e" stroke-width=".7"/><ellipse cx="61" cy="47" rx="3.4" ry="1.8" fill="' + T.caramel + '" stroke="#c9922e" stroke-width=".7"/><path d="M56 44 Q59 42 61 44" stroke="#7aab5a" stroke-width="2" fill="#8fc06a"/>'
        : "") +
      '<path d="M55 37 L56 52" stroke="rgba(255,255,255,.6)" stroke-width="1.8"/>' +
      (tips > 0 ? '<path class="shimmer" d="M74 30 l2 -3 l1 3 l3 1 l-3 1 l-1 3 l-2 -3 l-3 -1 Z" fill="#fff3b0"/>' : "") +
      "</g>";
    return '<svg width="108" height="94" viewBox="0 0 108 94" style="overflow:visible"><defs>' +
      lgrad(woodF, T.woodHi, T.woodDk, true) + lgrad(woodR, T.woodDk, "#6f4a29", true) +
      lgrad(topG, "#f6eed8", "#e2d2b0", true) + lgrad(posG, "#f4ede0", "#ddd0bb", true) +
      lgrad(scr, "#bfe3a8", "#8cc072", true) +
      '</defs>' + contactShadow(54, 90, 48) +
      // 원목 수납장 (전면 + 우측면)
      '<path d="M14 52 L84 52 L84 88 L14 88 Z" fill="url(#' + woodF + ')"' + FO + '/>' +
      '<path d="M84 52 L96 47 L96 83 L84 88 Z" fill="url(#' + woodR + ')"' + FO + '/>' +
      '<path d="M11 86 L87 86 L87 92 L11 92 Z" fill="' + T.woodDk + '"' + FO + '/><path d="M87 86 L98 81 L98 87 L87 92 Z" fill="#6f4a29"' + FO + '/>' +
      // 판넬 도어 2개 + 손잡이 + 아치 통풍구
      '<rect x="20" y="58" width="28" height="24" rx="3" fill="none" stroke="' + T.woodDk + '" stroke-width="1.6"/>' +
      '<rect x="50" y="58" width="28" height="24" rx="3" fill="none" stroke="' + T.woodDk + '" stroke-width="1.6"/>' +
      '<path d="M50 78 Q64 73 78 78" stroke="' + T.woodDk + '" stroke-width="1.3" fill="none"/><path d="M56 79 L56 76 M60 78.4 L60 75.4 M64 78 L64 75 M68 78.4 L68 75.4 M72 79 L72 76" stroke="' + T.woodDk + '" stroke-width="1" stroke-linecap="round"/>' +
      '<path d="M45 66 Q47 68 45 71" stroke="' + T.caramel + '" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M53 66 Q51 68 53 71" stroke="' + T.caramel + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      // 크림 대리석 상판 (전면 립 + 상단면 + 우측면)
      '<path d="M6 44 L86 44 L98 39 L18 39 Z" fill="' + T.cream + '"' + FO + '/>' +
      '<path d="M6 44 Q6 41 9 41 L86 41 Q90 41 90 45 L90 52 Q90 54 87 54 L9 54 Q6 54 6 51 Z" fill="url(#' + topG + ')"' + FO + '/>' +
      '<path d="M90 45 L98 40 L98 48 L90 52 Z" fill="#e2d2b0"' + FO + '/>' +
      '<path d="M14 47 Q30 45 46 47 M52 48 Q66 46 80 48" stroke="rgba(180,150,100,.3)" stroke-width="1.3" fill="none"/>' +
      '<path d="M10 43 L84 43" stroke="' + T.hi + '" stroke-width="2" stroke-linecap="round"/>' +
      // 우측: 메뉴 카드 스탠드
      '<path d="M92 30 L100 30 L99 41 L91 41 Z" fill="#fdf6ea"' + FO + '/><path d="M100 30 L102 34 L101 43 L99 41 Z" fill="#ece0c8"' + FO + '/>' +
      '<path d="M93.5 33 L98 33 M93.5 35.5 L98 35.5 M93.5 38 L97 38" stroke="#d9b487" stroke-width="1"/><circle cx="95.5" cy="31.5" r="1.4" fill="' + T.caramel + '"/>' +
      // 우측: 브레드스틱 컵
      '<path d="M78 36 L88 36 L87 44 L79 44 Z" fill="' + T.wood + '"' + FO + '/>' +
      '<path d="M80 36 L80 29 M82.5 36 L82.5 28 M85 36 L85 29 M87 36 L86.6 30" stroke="#e2b06a" stroke-width="1.5" stroke-linecap="round"/>' +
      // 바닥 동전 무더기
      '<ellipse cx="76" cy="50" rx="3.6" ry="1.9" fill="' + T.caramel + '" stroke="#c9922e" stroke-width=".7"/><ellipse cx="76" cy="48.2" rx="3.6" ry="1.9" fill="#f4d27e" stroke="#c9922e" stroke-width=".7"/>' +
      jar +
      // POS 계산기 (몸통 + 초록 디스플레이 라이저 + 키패드 + 영수증 + 서랍)
      '<rect x="16" y="30" width="34" height="18" rx="3.5" fill="url(#' + posG + ')"' + FO + '/>' +
      '<rect x="18" y="43" width="30" height="6" rx="2" fill="#e2d2b8" stroke="' + T.out + '" stroke-width="1"/><rect x="28" y="45" width="10" height="2" rx="1" fill="#b89c78"/>' +   // 서랍
      '<rect x="19" y="33" width="13" height="8" rx="1.6" fill="url(#' + scr + ')"' + (active ? ' class="posflash"' : "") + '/>' +   // 키패드 화면
      '<g>' +
        '<rect x="34" y="33" width="4" height="3.4" rx="1" fill="#f2e8d0"/><rect x="39" y="33" width="4" height="3.4" rx="1" fill="#f2c060"/><rect x="44" y="33" width="4" height="3.4" rx="1" fill="#e88a5a"/>' +
        '<rect x="34" y="37" width="4" height="3.4" rx="1" fill="#f2e8d0"/><rect x="39" y="37" width="4" height="3.4" rx="1" fill="#a8d49a"/><rect x="44" y="37" width="4" height="3.4" rx="1" fill="#f2c060"/>' +
      '</g>' +
      '<path d="M22 30 L22 16 Q22 12 26 12 L40 12 Q44 12 44 16 L44 24 L22 24" fill="url(#' + posG + ')"' + FO + '/>' +  // 디스플레이 넥
      '<rect x="24" y="15" width="18" height="7" rx="2" fill="url(#' + scr + ')"' + (active ? ' class="posflash"' : "") + '/>' +
      '<path d="M24 17 L40 17" stroke="rgba(255,255,255,.5)" stroke-width="1"/>' +
      // 영수증
      '<path d="M45 26 Q52 25 51 33 L48 33 Q49 27 45 28 Z" fill="#fffdf6" stroke="#e2d2b8" stroke-width="1"/><path d="M46.4 29 L50 28.6 M46.6 31 L50.2 30.6" stroke="#cbb892" stroke-width=".8"/>' +
      '</svg>';
  }

  /* ---------- 가구 ---------- */
  function tableSVG() {
    var top = uid();
    return '<svg width="74" height="66" viewBox="0 0 74 66" style="overflow:visible"><defs>' + rgrad(top, "#ecc898", "#c99e6d") + '</defs>' +
      contactShadow(37, 60, 26) +
      '<ellipse cx="37" cy="27" rx="27" ry="12.5" fill="#a87c50"/><ellipse cx="37" cy="23.5" rx="27" ry="12.5" fill="url(#' + top + ')"' + FO + '/>' +
      '<ellipse cx="37" cy="23.5" rx="19" ry="8.4" fill="none" stroke="rgba(140,90,45,.35)" stroke-width="1.4"/>' +
      '<ellipse cx="37" cy="23.5" rx="11" ry="4.6" fill="none" stroke="rgba(140,90,45,.28)" stroke-width="1.2"/>' +
      // 접시 + 부스러기 + 컵
      '<ellipse cx="30" cy="21" rx="6.5" ry="2.8" fill="#fffdf6" stroke="#e2d2b8" stroke-width="1.2"/><circle cx="29" cy="20.6" r="1" fill="#d9a45e"/><circle cx="32" cy="21.4" r=".7" fill="#c98b45"/>' +
      '<ellipse cx="46" cy="24" rx="3" ry="1.7" fill="#fffdf6" stroke="#e2d2b8" stroke-width="1"/><ellipse cx="46" cy="23" rx="2" ry="1" fill="#8a5a33"/>' +
      '<path d="M34.6 34 L34.6 52 L39.4 52 L39.4 34Z" fill="#8a5f3d"' + FO + '/>' +
      '<ellipse cx="37" cy="53.5" rx="10" ry="3.8" fill="#8a5f3d"' + FO + '/>' +
      '<ellipse cx="30" cy="18.6" rx="8" ry="3" fill="rgba(255,255,255,.4)"/></svg>';
  }
  function tableCoupleSVG() {
    var top = uid();
    return '<svg width="92" height="70" viewBox="0 0 92 70" style="overflow:visible"><defs>' + lgrad(top, "#ecc898", "#cfa473") + '</defs>' +
      contactShadow(46, 64, 34) +
      '<path d="M8 26 L46 15 L84 26 L46 37Z" fill="url(#' + top + ')"' + FO + '/>' +
      '<path d="M8 26 L8 32 L46 43 L46 37Z" fill="#b08356"' + FO + '/><path d="M84 26 L84 32 L46 43 L46 37Z" fill="#9c7047"' + FO + '/>' +
      '<path d="M14 32 L14 52 M78 32 L78 52 M46 43 L46 60" stroke="#8a5f3d" stroke-width="4.4" stroke-linecap="round"/>' +
      '<ellipse cx="34" cy="23" rx="5" ry="2.6" fill="#fff" opacity=".85"/><path d="M32 21 Q34 18.6 36 21" stroke="' + T.coral + '" stroke-width="2" fill="none"/>' +
      '<path d="M12 25.5 L44 16.2" stroke="' + T.hi + '" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  function sofaSVG() {
    var body = uid();
    return '<svg width="88" height="66" viewBox="0 0 88 66" style="overflow:visible"><defs>' + lgrad(body, "#d97f6c", "#b04a37", true) + '</defs>' +
      contactShadow(44, 61, 34) +
      '<path d="M13 18 Q11 7 21 7 L67 7 Q77 7 75 18 L75 34 L13 34 Z" fill="url(#' + body + ')"' + FO + '/>' +
      '<path d="M10 29 Q3 29 5.5 40 L10 53 L78 53 L82.5 40 Q85 29 78 29 L78 42 L10 42 Z" fill="#c25a45"' + FO + '/>' +
      '<rect x="12" y="30" width="64" height="14" rx="7" fill="#e08d78"' + FO + '/>' +
      '<path d="M44 32 L44 43" stroke="rgba(120,40,25,.4)" stroke-width="1.8"/>' +
      '<path d="M18 13 Q28 10 39 12 M49 12 Q60 10 70 13" stroke="rgba(255,255,255,.35)" stroke-width="2.4" fill="none"/>' +
      '<path d="M16 53 L16 59 M72 53 L72 59" stroke="#6b4426" stroke-width="4" stroke-linecap="round"/></svg>';
  }
  function parasolSVG() {
    var top = uid();
    return '<svg width="92" height="102" viewBox="0 0 92 102" style="overflow:visible"><defs>' + rgrad(top, "#ecc898", "#c99e6d") + '</defs>' +
      contactShadow(46, 96, 34) +
      '<path d="M46 5 Q79 9 82 36 L10 36 Q13 9 46 5Z" fill="#e06d6d"' + FO + '/>' +
      '<path d="M27 8 Q36 5 46 5 Q56 5 65 8 L61 36 L31 36Z" fill="#fff3ea"' + FO + '/>' +
      '<path d="M46 5 L46 36 M27 8.5 L31 36 M65 8.5 L61 36" stroke="rgba(120,50,35,.3)" stroke-width="1.4"/>' +
      '<circle cx="46" cy="4" r="2.6" fill="' + T.caramel + '"' + FO + '/>' +
      '<path d="M44.8 36 L44.8 64 L47.2 64 L47.2 36Z" fill="#8a5f3d"/>' +
      '<ellipse cx="46" cy="66" rx="23" ry="9.5" fill="#a87c50"/><ellipse cx="46" cy="62.5" rx="23" ry="9.5" fill="url(#' + top + ')"' + FO + '/>' +
      '<path d="M44.8 72 L44.8 86 L47.2 86 L47.2 72Z" fill="#8a5f3d"/><ellipse cx="46" cy="88" rx="9" ry="3.4" fill="#8a5f3d"' + FO + '/></svg>';
  }
  function doorSVG() {
    var body = uid();
    return '<svg width="48" height="78" viewBox="0 0 48 78" style="overflow:visible"><defs>' + lgrad(body, "#a97a4a", "#7d5230", true) + '</defs>' +
      '<rect x="1.5" y="1.5" width="45" height="75" rx="4" fill="#6b4426"' + FO + '/>' +
      '<rect x="5" y="5" width="38" height="68" rx="3" fill="url(#' + body + ')"/>' +
      '<rect x="9" y="9" width="30" height="24" rx="3" fill="rgba(212,238,250,.8)" stroke="#fff" stroke-width="1.8"/>' +
      '<path d="M12 12 L20 30" stroke="rgba(255,255,255,.65)" stroke-width="3"/>' +
      '<rect x="9" y="39" width="30" height="13" rx="2.5" fill="rgba(0,0,0,.12)"/><rect x="9" y="56" width="30" height="13" rx="2.5" fill="rgba(0,0,0,.12)"/>' +
      '<circle cx="38" cy="46" r="2.8" fill="' + T.caramel + '" stroke="#a5762a" stroke-width="1"/>' +
      '<g class="opensign"><rect x="14" y="33.5" width="20" height="7" rx="2" fill="#fff3e0" stroke="' + T.out + '" stroke-width="1.2"/>' +
      '<text x="17.5" y="39" font-size="5.4" font-weight="900" fill="#8a5a33">OPEN</text></g></svg>';
  }
  function windowSVG() {
    var sky = uid();
    return '<svg width="54" height="44" viewBox="0 0 54 44"><defs>' +
      '<linearGradient id="' + sky + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f2"/><stop offset="1" stop-color="#e8f4f8"/></linearGradient></defs>' +
      '<rect x="1.5" y="1.5" width="51" height="41" rx="4" fill="#8a6a48" stroke="' + T.out + '" stroke-width="1.8"/>' +
      '<rect x="5" y="5" width="44" height="34" rx="3" fill="url(#' + sky + ')"/>' +
      '<ellipse cx="16" cy="14" rx="6" ry="2.6" fill="#fff" opacity=".9"/><ellipse cx="34" cy="10" rx="4.4" ry="2" fill="#fff" opacity=".7"/>' +
      '<path d="M27 5 L27 39 M5 22 L49 22" stroke="#8a6a48" stroke-width="2.6"/>' +
      '<path d="M8 34 L18 8" stroke="rgba(255,255,255,.55)" stroke-width="3"/>' +
      '<rect x="3" y="40" width="48" height="3" rx="1.5" fill="#75573a"/></svg>';
  }
  function lampSVG() {
    var shade = uid(), halo = uid();
    return '<svg width="34" height="52" viewBox="0 0 34 52" style="overflow:visible"><defs>' +
      lgrad(shade, "#f2c765", "#cf9a35", true) +
      '<radialGradient id="' + halo + '"><stop offset="0" stop-color="rgba(255,235,170,.85)"/><stop offset="1" stop-color="rgba(255,235,170,0)"/></radialGradient></defs>' +
      '<path d="M17 0 L17 15" stroke="#5d4530" stroke-width="2.4"/>' +
      '<path d="M6 29 Q6 16 17 16 Q28 16 28 29 Z" fill="url(#' + shade + ')" stroke="' + T.out + '" stroke-width="1.8"/>' +
      '<path d="M9 24 Q10 18.5 15 17.6" stroke="rgba(255,255,255,.55)" stroke-width="2" fill="none"/>' +
      '<g class="lampglow"><circle cx="17" cy="34" r="11" fill="url(#' + halo + ')"/></g>' +
      '<circle cx="17" cy="31.5" r="4" fill="#ffefb2"/></svg>';
  }

  /* ---------- 앰비언트 데코 (목업 밀도 재현: 식물·입간판·선반·고양이) ---------- */
  function bushSVG(size, flowers) {
    var s = size || 56, g = uid();
    return '<svg width="' + s + '" height="' + (s * 0.8) + '" viewBox="0 0 70 56" style="overflow:visible"><defs>' + rgrad(g, "#9fc86a", "#6a9a44") + '</defs>' +
      contactShadow(35, 52, 26) +
      '<circle cx="20" cy="36" r="15" fill="url(#' + g + ')"' + FO + '/><circle cx="40" cy="28" r="18" fill="url(#' + g + ')"' + FO + '/><circle cx="55" cy="38" r="13" fill="url(#' + g + ')"' + FO + '/>' +
      '<path d="M14 30 Q20 24 27 27 M33 20 Q40 15 48 19" stroke="rgba(255,255,255,.35)" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      (flowers ? '<circle cx="24" cy="30" r="3" fill="#f2a3b8"/><circle cx="24" cy="30" r="1.2" fill="#fff3b0"/><circle cx="46" cy="24" r="3" fill="#fff"/><circle cx="46" cy="24" r="1.2" fill="#f6d98a"/><circle cx="55" cy="33" r="2.6" fill="#f2a3b8"/><circle cx="55" cy="33" r="1" fill="#fff3b0"/>' : "") +
      '</svg>';
  }
  function aboardSVG() {
    return '<svg width="52" height="62" viewBox="0 0 52 62" style="overflow:visible">' +
      contactShadow(26, 58, 20) +
      '<path d="M10 8 L42 8 L46 52 L38 52 L35 16 L17 16 L14 52 L6 52 Z" fill="#8a5f3d"' + FO + '/>' +
      '<rect x="12" y="6" width="28" height="40" rx="3" fill="#6b4426"' + FO + '/>' +
      '<rect x="15" y="9" width="22" height="34" rx="2" fill="#3d4a3e"/>' +
      '<text x="17.5" y="21" font-size="7" font-weight="900" fill="#fff3e0" font-style="italic">Welcome</text>' +
      '<path d="M20 28 Q22 25 24 28 Q26 31 28 28" stroke="#f2a3b8" stroke-width="1.4" fill="none"/>' +
      '<ellipse cx="26" cy="35" rx="5" ry="3" fill="none" stroke="#e8d9c0" stroke-width="1.3"/><path d="M31 34 Q34 34 33 37" stroke="#e8d9c0" stroke-width="1.3" fill="none"/>' +
      '<path d="M23 32 Q24 30 25 32 M27 31.4 Q28 29.4 29 31.4" stroke="#e8d9c0" stroke-width="1" fill="none"/>' +
      '</svg>';
  }
  function catSVG() {
    var g = uid();
    return '<svg width="46" height="42" viewBox="0 0 56 50" style="overflow:visible"><defs>' + rgrad(g, "#ffe9cf", "#f2c896") + '</defs>' +
      contactShadow(28, 46, 17) +
      '<g class="cattail" style="transform-origin:44px 36px"><path d="M44 36 Q56 32 52 20" stroke="#e8b06a" stroke-width="5.5" fill="none" stroke-linecap="round"/><path d="M52 24 Q53 20 51.5 18" stroke="#c98b45" stroke-width="5.5" stroke-linecap="round"/></g>' +
      '<ellipse cx="30" cy="34" rx="16" ry="12" fill="url(#' + g + ')"' + FO + '/>' +
      '<path d="M14 15 L11 4 L21 9 Z" fill="#f2c896"' + FO + '/><path d="M30 15 L35 5 L24 9 Z" fill="#f2c896"' + FO + '/>' +
      '<path d="M13.6 12.6 L12.4 7.6 L17 10 Z" fill="#f2a3b8"/><path d="M29 12.6 L31.6 7.8 L26 10 Z" fill="#f2a3b8"/>' +
      '<circle cx="22" cy="19" r="12.5" fill="url(#' + g + ')"' + FO + '/>' +
      '<path d="M28 10 Q34 12 33 18 Q29 15 28 10Z" fill="#e8a45e"/>' +
      '<g class="catface"><path d="M16 18.6 Q17.6 17 19.2 18.6" stroke="' + T.out + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M24.6 18.6 Q26.2 17 27.8 18.6" stroke="' + T.out + '" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>' +
      '<path d="M21 21.6 L22.8 21.6 L21.9 23 Z" fill="#e88a8a"/>' +
      '<path d="M21.9 23 Q21.9 25 19.9 25.2 M21.9 23 Q21.9 25 23.9 25.2" stroke="' + T.out + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M12 21 L7 20 M12 23 L7.6 23.6 M32 21 L37 20 M32 23 L36.4 23.6" stroke="rgba(91,58,38,.6)" stroke-width="1" stroke-linecap="round"/>' +
      '<path d="M15 27.5 Q22 30 29 27.5" stroke="#e06d6d" stroke-width="3.4" fill="none" stroke-linecap="round"/><circle cx="22" cy="29.4" r="1.8" fill="#f6d98a" stroke="#c9922e" stroke-width=".8"/>' +
      '</svg>';
  }
  function shelfSVG() {
    var g = uid();
    return '<svg width="64" height="40" viewBox="0 0 64 40"><defs>' + lgrad(g, "#c99e6d", "#a87c50", true) + '</defs>' +
      '<rect x="2" y="26" width="60" height="6" rx="2.5" fill="url(#' + g + ')" stroke="' + T.out + '" stroke-width="1.6"/>' +
      '<path d="M8 32 L8 38 M56 32 L56 38" stroke="#8a5f3d" stroke-width="3"/>' +
      '<path d="M8 8 Q8 4 12 4 L16 4 Q20 4 20 8 L20 26 L8 26 Z" fill="rgba(228,196,150,.9)" stroke="' + T.out + '" stroke-width="1.5"/><rect x="9.5" y="12" width="9" height="8" rx="1" fill="#c9803e"/>' +
      '<path d="M26 10 Q26 6 30 6 L34 6 Q38 6 38 10 L38 26 L26 26 Z" fill="rgba(214,232,220,.9)" stroke="' + T.out + '" stroke-width="1.5"/><rect x="27.5" y="13" width="9" height="7" rx="1" fill="#7aab6a"/>' +
      '<path d="M44 12 Q44 8 48 8 L50 8 Q54 8 54 12 L54 26 L44 26 Z" fill="rgba(246,220,190,.9)" stroke="' + T.out + '" stroke-width="1.5"/><rect x="45.5" y="15" width="7" height="6" rx="1" fill="#e08d5a"/>' +
      '<rect x="10" y="6" width="8" height="2.4" rx="1.2" fill="#8a5f3d"/><rect x="28" y="8" width="8" height="2.4" rx="1.2" fill="#8a5f3d"/><rect x="45.5" y="10" width="7" height="2.4" rx="1.2" fill="#8a5f3d"/>' +
      '</svg>';
  }

  /* ---------- 신규 스테이션: 주스바 / 브런치 키친 / 아이스 스테이션 ---------- */
  function juiceSVG(busy) {
    var b = isoBox(10, 26, 33, 26, "#e8c98a", T.wood, T.woodDk);
    var whirl = busy ? '<circle cx="59" cy="18" r="4.5" fill="#ffd9a3" opacity=".85"><animate attributeName="r" values="4.5;3.2;4.5" dur="0.5s" repeatCount="indefinite"/></circle>' : '<circle cx="59" cy="18" r="4.5" fill="#ffd9a3"/>';
    return '<svg width="92" height="82" viewBox="0 0 92 82" style="overflow:visible"><defs>' + b.defs + '</defs>' +
      contactShadow(46, 76, 34) + b.html +
      '<rect x="14" y="6" width="30" height="9" rx="4" fill="#e2574c"' + FO + '/><rect x="18" y="6" width="7" height="9" fill="#fdf6ec"/><rect x="32" y="6" width="7" height="9" fill="#fdf6ec"/>' +
      '<circle cx="22" cy="24" r="7" fill="#f5a03c"' + FO + '/><circle cx="20" cy="21.6" r="2" fill="#ffd9a3"/>' +
      '<circle cx="34" cy="21" r="6" fill="#e8564f"' + FO + '/><path d="M32.7 15.5 L34 12.6 L35.4 15.5" fill="#5f9e4e"/>' +
      '<circle cx="44" cy="25" r="5.4" fill="#f6d34c"' + FO + '/>' +
      '<path d="M53 10 L65 10 L63 30 L55 30 Z" fill="rgba(214,239,255,.85)"' + FO + '/>' + whirl +
      '<rect x="53.5" y="30" width="11" height="5" rx="2" fill="#8a6a4a"' + FO + '/>' +
      '<path d="M18 40 L30 37 L30 47 L18 50 Z" fill="#fff3d9" stroke="#d9b183" stroke-width="1.5"/>' +
      '<text x="24" y="46" font-size="7" text-anchor="middle" fill="#a8642a" font-weight="bold">JUICE</text></svg>';
  }
  function brunchSVG(busy) {
    var b = isoBox(8, 30, 36, 24, "#d9d2c6", T.wood, T.woodDk);
    var steam = busy ? '<g class="smoke"><circle cx="34" cy="14" r="4" fill="#f4ede2" opacity=".7"/><circle cx="39" cy="7" r="5" fill="#f4ede2" opacity=".45"/></g>' : "";
    return '<svg width="96" height="84" viewBox="0 0 96 84" style="overflow:visible"><defs>' + b.defs + '</defs>' +
      contactShadow(48, 78, 36) + b.html +
      '<ellipse cx="34" cy="24" rx="12" ry="6" fill="#3f3a34"' + FO + '/><ellipse cx="34" cy="22.6" rx="9.5" ry="4.4" fill="#57504a"/>' +
      '<circle cx="34" cy="22" r="4" fill="#ffe9ad"/><circle cx="34" cy="22" r="2" fill="#f5b93c"/>' + steam +
      '<path d="M52 22 L70 17 L70 24 L52 29 Z" fill="#f2b23c"' + FO + '/>' +
      '<path d="M52 18 L70 13 L70 17 L52 22 Z" fill="#7fae5f"' + FO + '/>' +
      '<path d="M52 14 L70 9 L70 13 L52 18 Z" fill="#fdf6ec"' + FO + '/>' +
      '<rect x="74" y="20" width="10" height="14" rx="2" fill="#cf4f42"' + FO + '/><rect x="76" y="23" width="6" height="3" fill="#fdf6ec"/>' +
      '<path d="M14 42 L28 38.5 L28 49 L14 52.5 Z" fill="#fff3d9" stroke="#d9b183" stroke-width="1.5"/>' +
      '<text x="21" y="48" font-size="6.4" text-anchor="middle" fill="#a8642a" font-weight="bold">BRUNCH</text></svg>';
  }
  function icecreamSVG(busy) {
    var b = isoBox(9, 28, 34, 25, "#cfe8ef", "#a8d4de", "#8dbfca");
    var frost = busy ? '<g class="smoke"><circle cx="30" cy="12" r="3.5" fill="#e8f6fb" opacity=".8"/><circle cx="60" cy="10" r="4" fill="#e8f6fb" opacity=".6"/></g>' : "";
    return '<svg width="94" height="82" viewBox="0 0 94 82" style="overflow:visible"><defs>' + b.defs + '</defs>' +
      contactShadow(47, 76, 34) + b.html +
      '<path d="M24 22 L30 8 L36 22 Z" fill="#e8c290"' + FO + '/><circle cx="30" cy="8.5" r="5.5" fill="#fdf0f4"' + FO + '/><circle cx="30" cy="5" r="3.4" fill="#f4a9be"/>' +
      '<path d="M44 21 L49 10 L54 21 Z" fill="#e8c290"' + FO + '/><circle cx="49" cy="10" r="5" fill="#e9d9f6"' + FO + '/>' +
      '<circle cx="63" cy="18" r="6.5" fill="#fff6ea"' + FO + '/><path d="M56.5 18 A6.5 6.5 0 0 1 69.5 18" fill="#9fd8c3"/>' + frost +
      '<rect x="16" y="36" width="26" height="8" rx="3" fill="rgba(214,243,251,.85)" stroke="#8dbfca" stroke-width="1.5"/>' +
      '<path d="M60 40 L74 36.5 L74 46 L60 49.5 Z" fill="#fff3d9" stroke="#d9b183" stroke-width="1.5"/>' +
      '<text x="67" y="45.5" font-size="6.2" text-anchor="middle" fill="#3d8a9e" font-weight="bold">ICE</text></svg>';
  }
  function grillSVG(busy) {
    var b = isoBox(8, 28, 36, 26, "#4a443e", "#6b5f52", "#3a332c");
    var flame = busy
      ? '<path d="M30 20 Q28 14 31 11 Q31 15 34 13 Q35 17 32 20 Z" fill="#ff9d3b"><animate attributeName="opacity" values="1;.6;1" dur="0.4s" repeatCount="indefinite"/></path>'
      : '';
    var steam = busy ? '<g class="smoke"><circle cx="52" cy="10" r="4" fill="#f4ede2" opacity=".65"/><circle cx="57" cy="4" r="5" fill="#f4ede2" opacity=".4"/></g>' : "";
    return '<svg width="96" height="86" viewBox="0 0 96 86" style="overflow:visible"><defs>' + b.defs + '</defs>' +
      contactShadow(48, 80, 36) + b.html +
      '<ellipse cx="31" cy="24" rx="11" ry="5.5" fill="#2e2925"' + FO + '/>' +
      '<path d="M22 22 L40 22 M23 24.5 L39 24.5 M24 27 L38 27" stroke="#57504a" stroke-width="1.6"/>' + flame +
      '<ellipse cx="55" cy="21" rx="10" ry="5" fill="#e8e2d6"' + FO + '/>' +
      '<ellipse cx="53" cy="20" rx="5" ry="2.8" fill="#a8503c"/><ellipse cx="59" cy="21.5" rx="3" ry="1.6" fill="#7fae5f"/>' + steam +
      '<path d="M68 18 L83 14 L83 20 L68 24 Z" fill="#c9922e"' + FO + '/><ellipse cx="75.5" cy="18" rx="4.4" ry="2.2" fill="#ffdf94"/>' +
      '<rect x="14" y="42" width="26" height="8" rx="3" fill="#fff3d9" stroke="#d9b183" stroke-width="1.5"/>' +
      '<text x="27" y="48.5" font-size="6.4" text-anchor="middle" fill="#a8642a" font-weight="bold">GRILL</text></svg>';
  }
  // 스테이션 id → 아트 (신규 스테이션 공용 진입점)
  function stationSVG(id, busy) {
    if (id === "grill") return grillSVG(busy);
    if (id === "juice") return juiceSVG(busy);
    if (id === "brunch") return brunchSVG(busy);
    if (id === "icecream") return icecreamSVG(busy);
    return coffeeSVG(false, busy);
  }



  /* ---------- 펫(애견카페): 크림/까망 고양이 · 시바견 · 말티즈 · 토끼 ---------- */
  function petSVG(type) {
    var wag = '<animateTransform attributeName="transform" type="rotate" values="-14 0 0;16 0 0;-14 0 0" dur="0.9s" repeatCount="indefinite"/>';
    var o = ' stroke="' + T.out + '" stroke-width="1.6" stroke-linejoin="round"';
    function cat(body, belly, stripe) {
      return '<svg width="38" height="34" viewBox="0 0 44 40" style="overflow:visible">' +
        '<ellipse cx="22" cy="37" rx="13" ry="3.4" fill="rgba(96,56,16,.22)"/>' +
        '<g transform="translate(37,26)"><path d="M0 0 Q9 -3 8 -12 Q12 -4 4 3 Z" fill="' + body + '"' + o + '>' + wag + '</path></g>' +
        '<path d="M10 22 Q10 12 22 12 Q34 12 34 22 Q34 32 22 33 Q10 32 10 22 Z" fill="' + body + '"' + o + '/>' +
        (stripe ? '<path d="M14 15 L17 19 M22 13 L22 18 M30 15 L27 19" stroke="' + stripe + '" stroke-width="2" stroke-linecap="round"/>' : '') +
        '<path d="M12 12 L10 4 L17 9 Z" fill="' + body + '"' + o + '/><path d="M32 12 L34 4 L27 9 Z" fill="' + body + '"' + o + '/>' +
        '<path d="M12.8 10 L11.8 6.4 L15 8.6 Z" fill="#f4a9be"/><path d="M31.2 10 L32.2 6.4 L29 8.6 Z" fill="#f4a9be"/>' +
        '<ellipse cx="22" cy="27" rx="7' + '" ry="5" fill="' + belly + '"/>' +
        '<circle cx="17.5" cy="21" r="1.7" fill="' + T.out + '"/><circle cx="26.5" cy="21" r="1.7" fill="' + T.out + '"/>' +
        '<path d="M20.6 24.4 L23.4 24.4 L22 26 Z" fill="#e88a8a"/>' +
        '<path d="M22 26 Q22 27.6 20 27.9 M22 26 Q22 27.6 24 27.9" stroke="' + T.out + '" stroke-width="1.1" fill="none" stroke-linecap="round"/>' +
        '<path d="M12 23 L7 22 M12 25 L7.6 26 M32 23 L37 22 M32 25 L36.4 26" stroke="rgba(91,58,38,.55)" stroke-width=".9" stroke-linecap="round"/>' +
        '</svg>';
    }
    if (type === "cat_cream") return cat("#f2dcb6", "#fdf3dd", "#dcbe8c");
    if (type === "cat_black") return cat("#4a4348", "#6b6068", null);
    if (type === "dog_shiba") {
      return '<svg width="40" height="36" viewBox="0 0 46 42" style="overflow:visible">' +
        '<ellipse cx="23" cy="39" rx="14" ry="3.6" fill="rgba(96,56,16,.22)"/>' +
        '<g transform="translate(38,24)"><path d="M0 2 Q8 0 7 -9 Q13 -2 4 5 Z" fill="#e8a35c"' + o + '>' + wag + '</path></g>' +
        '<path d="M9 24 Q9 13 23 13 Q37 13 37 24 Q37 34 23 35 Q9 34 9 24 Z" fill="#e8a35c"' + o + '/>' +
        '<path d="M12 14 L9 5 L18 10 Z" fill="#e8a35c"' + o + '/><path d="M34 14 L37 5 L28 10 Z" fill="#e8a35c"' + o + '/>' +
        '<path d="M13 12.6 L11.4 7.6 L16.4 10.4 Z" fill="#f7d3ae"/><path d="M33 12.6 L34.6 7.6 L29.6 10.4 Z" fill="#f7d3ae"/>' +
        '<path d="M14 24 Q14 18 23 18 Q32 18 32 24 Q32 31 23 32 Q14 31 14 24 Z" fill="#fdf0dd"/>' +
        '<circle cx="18" cy="21.6" r="1.8" fill="' + T.out + '"/><circle cx="28" cy="21.6" r="1.8" fill="' + T.out + '"/>' +
        '<ellipse cx="23" cy="25.4" rx="2.2" ry="1.7" fill="' + T.out + '"/>' +
        '<path d="M23 27 Q23 29 20.6 29.3 M23 27 Q23 29 25.4 29.3" stroke="' + T.out + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
        '<path d="M19 30.5 Q23 32.4 27 30.5" stroke="#e88a8a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '</svg>';
    }
    if (type === "dog_white") {
      return '<svg width="38" height="34" viewBox="0 0 44 40" style="overflow:visible">' +
        '<ellipse cx="22" cy="37" rx="13" ry="3.4" fill="rgba(96,56,16,.22)"/>' +
        '<g transform="translate(36,25)"><path d="M0 1 Q7 0 6 -8 Q11 -1 3 4 Z" fill="#fdf6ec"' + o + '>' + wag + '</path></g>' +
        '<g' + o + ' fill="#fdf6ec"><circle cx="15" cy="16" r="6"/><circle cx="29" cy="16" r="6"/><circle cx="22" cy="13" r="7"/><path d="M9 24 Q9 15 22 15 Q35 15 35 24 Q35 33 22 34 Q9 33 9 24 Z"/></g>' +
        '<path d="M10 16 Q6 18 7 24 Q10 26 12 23 Z" fill="#f3e6d0"' + o + '/><path d="M34 16 Q38 18 37 24 Q34 26 32 23 Z" fill="#f3e6d0"' + o + '/>' +
        '<circle cx="17.5" cy="22" r="1.7" fill="' + T.out + '"/><circle cx="26.5" cy="22" r="1.7" fill="' + T.out + '"/>' +
        '<ellipse cx="22" cy="25.6" rx="2" ry="1.5" fill="' + T.out + '"/>' +
        '<path d="M18.6 28.6 Q22 30.6 25.4 28.6" stroke="#e88a8a" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
        '<circle cx="22" cy="10" r="2.2" fill="#f4a9be" stroke="#d98aa2" stroke-width="1"/>' +
        '</svg>';
    }
    // rabbit
    return '<svg width="36" height="40" viewBox="0 0 42 48" style="overflow:visible">' +
      '<ellipse cx="21" cy="45" rx="12" ry="3.2" fill="rgba(96,56,16,.22)"/>' +
      '<path d="M14 20 Q11 4 16.5 3 Q21 3 19.5 19 Z" fill="#fdf3f6"' + o + '/><path d="M28 20 Q31 4 25.5 3 Q21 3 22.5 19 Z" fill="#fdf3f6"' + o + '/>' +
      '<path d="M15.6 16 Q14.4 6.6 16.8 6 Q18.8 6.4 18 16 Z" fill="#f4b9cb"/><path d="M26.4 16 Q27.6 6.6 25.2 6 Q23.2 6.4 24 16 Z" fill="#f4b9cb"/>' +
      '<path d="M9 31 Q9 18 21 18 Q33 18 33 31 Q33 41 21 42 Q9 41 9 31 Z" fill="#fdf3f6"' + o + '/>' +
      '<ellipse cx="21" cy="35" rx="6.4" ry="4.6" fill="#fff"/>' +
      '<circle cx="16.5" cy="28" r="1.7" fill="' + T.out + '"/><circle cx="25.5" cy="28" r="1.7" fill="' + T.out + '"/>' +
      '<path d="M19.8 31 L22.2 31 L21 32.4 Z" fill="#e88a8a"/>' +
      '<path d="M21 32.4 Q21 34 19.2 34.3 M21 32.4 Q21 34 22.8 34.3" stroke="' + T.out + '" stroke-width="1.1" fill="none" stroke-linecap="round"/>' +
      '<circle cx="13" cy="31.5" r="1.6" fill="#f4b9cb" opacity=".8"/><circle cx="29" cy="31.5" r="1.6" fill="#f4b9cb" opacity=".8"/>' +
      '</svg>';
  }

  global.BakeryArt = {
    TOKENS: T,
    bushSVG: bushSVG, aboardSVG: aboardSVG, catSVG: catSVG, shelfSVG: shelfSVG,
    lookFromSeed: lookFromSeed, randomLook: randomLook, charSVG: charSVG,
    bakerSVG: bakerSVG, baristaSVG: baristaSVG, cashierSVG: cashierSVG,
    ovenSVG: ovenSVG, displaySVG: displaySVG, coffeeSVG: coffeeSVG, counterSVG: counterSVG,
    stationSVG: stationSVG, petSVG: petSVG,

    tableSVG: tableSVG, tableCoupleSVG: tableCoupleSVG, sofaSVG: sofaSVG, parasolSVG: parasolSVG,
    doorSVG: doorSVG, windowSVG: windowSVG, lampSVG: lampSVG
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.BakeryArt;
})(typeof window !== "undefined" ? window : globalThis);
