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
  function pick(arr, n) { return arr[n % arr.length]; }
  function darken(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, ((n >> 16) & 255) * f) | 0, g = Math.min(255, ((n >> 8) & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0;
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function lighten(hex, amt) {
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
      skin: pick(SKINS, h), hair: (h >> 3) % 7, hairC: pick(HAIRC, h >> 6), iris: pick(IRIS, h >> 8),
      top: (h >> 9) % 4, topC: pick(CLOTH, h >> 12), pantsC: pick(PANTS, h >> 15),
      glasses: ((h >> 18) % 10) < 3, hat: ((h >> 21) % 10) < 2, bag: ((h >> 24) % 10) < 3,
      hatC: pick(CLOTH, h >> 26)
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
  // 베이커: 크림 셔츠 + 브라운 앞치마 + 밀가루, busy 시 땀방울+반죽
  function bakerSVG(busy) {
    var look = { skin: SKINS[1], hair: 0, hairC: HAIRC[2], iris: IRIS[0], top: 0, topC: "#f6eedd", pantsC: "#6b4426", glasses: false, hat: false, bag: false, hatC: "#fff" };
    return '<span class="staffwrap' + (busy ? " working" : " idlebob") + '">' +
      charSVG(look, { apron: true, apronC: "#c99a6d", chefHat: true, flour: true, sweat: !!busy, mood: busy ? "open" : "happy", scale: 0.95 }) + "</span>";
  }
  // 바리스타: 민트 앞치마 + 코랄 셔츠 + 수건
  function baristaSVG(busy) {
    var look = { skin: SKINS[0], hair: 3, hairC: HAIRC[5], iris: IRIS[2], top: 0, topC: "#e98f7f", pantsC: "#39506e", glasses: false, hat: false, bag: false, hatC: "#fff" };
    return '<span class="staffwrap' + (busy ? " working" : " idlebob") + '">' +
      charSVG(look, { apron: true, apronC: "#9fd8c3", towel: true, sweat: !!busy, mood: "happy", scale: 0.92 }) + "</span>";
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
    var body = uid(), chrome = uid();
    return '<svg width="88" height="80" viewBox="0 0 88 80" style="overflow:visible">' + base +
      '<defs>' + lgrad(body, "#faf1e0", "#e2cba6", true) + lgrad(chrome, "#eef0f4", "#9a9aa8", true) + '</defs>' + contactShadow(44, 75, 32) +
      '<path d="M8 42 L44 33 L80 42 L44 51 Z" fill="url(#' + top + ')"' + FO + '/>' +
      '<path d="M8 42 L8 64 L44 73 L44 51Z" fill="url(#' + fL + ')"' + FO + '/><path d="M80 42 L80 64 L44 73 L44 51Z" fill="url(#' + fR + ')"' + FO + '/>' +
      '<rect x="18" y="6" width="50" height="30" rx="6" fill="url(#' + body + ')"' + FO + '/>' +
      '<rect x="18" y="6" width="50" height="8" rx="4" fill="rgba(255,255,255,.55)"/>' +
      '<rect x="18" y="28" width="50" height="8" rx="4" fill="url(#' + chrome + ')" stroke="' + T.out + '" stroke-width="1.4"/>' +
      '<rect x="26" y="36" width="8" height="8" fill="url(#' + chrome + ')"' + FO + '/><rect x="48" y="36" width="8" height="8" fill="url(#' + chrome + ')"' + FO + '/>' +
      (busy ? '<path d="M30 44 L30 48 M52 44 L52 48" stroke="#6b4426" stroke-width="2.2" stroke-linecap="round"/>' : "") +
      '<rect x="24" y="44" width="16" height="4.5" rx="2" fill="' + T.paper + '"' + FO + '/><rect x="46" y="44" width="16" height="4.5" rx="2" fill="' + T.paper + '"' + FO + '/>' +
      '<circle cx="61" cy="20" r="4.2" fill="#fff" stroke="' + T.out + '" stroke-width="1.4"/><path d="M61 20 L63.4 17.8" stroke="' + T.coral + '" stroke-width="1.4" stroke-linecap="round"/>' +
      '<circle cx="27" cy="20" r="2.8" fill="' + T.coral + '" stroke="' + T.out + '" stroke-width="1.2"/>' +
      '<ellipse cx="38" cy="8" rx="6" ry="2.4" fill="' + T.paper + '"' + FO + '/><ellipse cx="52" cy="8" rx="6" ry="2.4" fill="' + T.paper + '"' + FO + '/>' +
      steam + '</svg>';
  }

  // 카운터: 우드그레인 + POS(활성 플래시) + 영수증 + 동전 + 메뉴 카드 + 팁 항아리
  function counterSVG(tips, active) {
    var top = uid(), fL = uid(), fR = uid(), scr = uid();
    var jar = '<g' + (tips > 0 ? ' class="jarshine"' : "") + '>' +
      '<path d="M62 22 Q58.5 22 58.5 26.5 L58.5 34 Q58.5 37.5 63 37.5 L71 37.5 Q75.5 37.5 75.5 34 L75.5 26.5 Q75.5 22 72 22 Z" fill="rgba(220,238,250,.72)" stroke="#fff" stroke-width="1.8"/>' +
      '<path d="M60.5 24 L61.5 35" stroke="rgba(255,255,255,.75)" stroke-width="2"/>' +
      (tips > 0 ? '<circle cx="63.5" cy="33.5" r="2.6" fill="' + T.caramel + '" stroke="#c9922e" stroke-width=".8"/><circle cx="69" cy="34.5" r="2.6" fill="' + T.caramel + '" stroke="#c9922e" stroke-width=".8"/><circle cx="66.5" cy="30" r="2.6" fill="#f4d27e" stroke="#c9922e" stroke-width=".8"/>' : "") +
      "</g>";
    return '<svg width="100" height="82" viewBox="0 0 100 82" style="overflow:visible"><defs>' +
      lgrad(top, "#f0d5ae", "#d3ab7c") + lgrad(fL, "#b08356", T.woodDk, true) + lgrad(fR, T.woodDk2, "#74502f", true) +
      lgrad(scr, "#c8f4da", "#7fd6a4", true) +
      '</defs>' + contactShadow(50, 77, 40) +
      '<path d="M6 38 L50 25 L94 38 L50 51 Z" fill="url(#' + top + ')"' + FO + '/>' +
      '<path d="M6 38 L6 62 L50 75 L50 51 Z" fill="url(#' + fL + ')"' + FO + '/>' +
      '<path d="M94 38 L94 62 L50 75 L50 51 Z" fill="url(#' + fR + ')"' + FO + '/>' +
      '<path d="M10 46 L46 57 M10 54 L46 65 M28 42 L28 70" stroke="rgba(70,40,15,.2)" stroke-width="2"/>' +
      '<path d="M58 56 L88 47 M58 66 L88 57" stroke="rgba(70,40,15,.18)" stroke-width="2"/>' +
      '<path d="M10 37 L48 25.8" stroke="' + T.hi + '" stroke-width="2.2" stroke-linecap="round"/>' +
      // POS + 영수증
      '<rect x="22" y="12" width="20" height="15" rx="2.6" fill="#4a5058"' + FO + '/>' +
      '<rect x="24" y="14" width="16" height="8" rx="1.6" fill="url(#' + scr + ')"' + (active ? ' class="posflash"' : "") + '/>' +
      '<rect x="27" y="27" width="9" height="4.4" fill="#3c4148"/><rect x="24" y="30.6" width="15" height="3" rx="1.4" fill="#5b6470"/>' +
      '<path d="M42 15 L47 14 L47.6 24 L42.6 25 Z" fill="#fffdf6" stroke="#e2d2b8" stroke-width="1"/><path d="M43.4 17 L46 16.6 M43.6 19.4 L46.2 19 M43.8 21.8 L46.4 21.4" stroke="#cbb892" stroke-width=".9"/>' +
      // 메뉴 카드 + 동전
      '<path d="M14 34 L24 31.4 L25 38 L15 40.6 Z" fill="' + T.paper + '"' + FO + '/><path d="M16.4 34.6 L22 33.2 M16.8 36.4 L22.4 35" stroke="#c9a06e" stroke-width="1.1"/>' +
      '<ellipse cx="50" cy="30" rx="3" ry="1.6" fill="' + T.caramel + '" stroke="#c9922e" stroke-width=".8"/><ellipse cx="50" cy="28.4" rx="3" ry="1.6" fill="#f4d27e" stroke="#c9922e" stroke-width=".8"/>' +
      jar + '</svg>';
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

  global.BakeryArt = {
    TOKENS: T,
    bushSVG: bushSVG, aboardSVG: aboardSVG, catSVG: catSVG, shelfSVG: shelfSVG,
    lookFromSeed: lookFromSeed, randomLook: randomLook, charSVG: charSVG,
    bakerSVG: bakerSVG, baristaSVG: baristaSVG, cashierSVG: cashierSVG,
    ovenSVG: ovenSVG, displaySVG: displaySVG, coffeeSVG: coffeeSVG, counterSVG: counterSVG,
    tableSVG: tableSVG, tableCoupleSVG: tableCoupleSVG, sofaSVG: sofaSVG, parasolSVG: parasolSVG,
    doorSVG: doorSVG, windowSVG: windowSVG, lampSVG: lampSVG
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.BakeryArt;
})(typeof window !== "undefined" ? window : globalThis);
