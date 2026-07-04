/* ===================================================================
   엑서 빵집 타이쿤 — 아트 팩토리 (window.BakeryArt)
   -------------------------------------------------------------------
   외부 에셋 없이 코드 생성 SVG만으로 캐릭터·설비를 그린다.
   - 캐릭터: 치비 페이퍼돌(피부/헤어/의상/소품 레이어 조합) + 걷기/표정
   - 멤버: id 시드 → 항상 같은 외모 (커뮤니티 정체성)
   - 설비: 오븐/쇼케이스/커피/카운터/가구 — 유사 아이소 SVG
   =================================================================== */
(function (global) {
  "use strict";

  /* ---------- 팔레트 ---------- */
  var SKINS = ["#ffe3c6", "#f7d1ab", "#eabc8d", "#cf9663", "#a97a44"];
  var HAIRC = ["#2d2320", "#4a3421", "#6b4426", "#8a5a33", "#b5793d", "#d94f4f", "#e2b04a", "#8d8d95"];
  var CLOTH = ["#e06d6d", "#5f8fd9", "#4cae7d", "#e8b64c", "#9a6bc9", "#e77fb3", "#5bbcc4", "#96a24f"];
  var PANTS = ["#4a4a58", "#6b4426", "#39506e", "#7a5d8a", "#555"];

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function pick(arr, n) { return arr[n % arr.length]; }

  /* ---------- 외모 정의 ---------- */
  // seed 문자열(멤버 id) → 항상 같은 외모
  function lookFromSeed(seed) {
    var h = hash(String(seed));
    return {
      skin: pick(SKINS, h), hair: (h >> 3) % 7, hairC: pick(HAIRC, h >> 6),
      top: (h >> 9) % 4, topC: pick(CLOTH, h >> 12), pantsC: pick(PANTS, h >> 15),
      glasses: ((h >> 18) % 10) < 3, hat: ((h >> 21) % 10) < 2, bag: ((h >> 24) % 10) < 3,
      hatC: pick(CLOTH, h >> 26)
    };
  }
  function randomLook(rng) {
    rng = rng || Math.random;
    return {
      skin: SKINS[(rng() * SKINS.length) | 0], hair: (rng() * 7) | 0, hairC: HAIRC[(rng() * HAIRC.length) | 0],
      top: (rng() * 4) | 0, topC: CLOTH[(rng() * CLOTH.length) | 0], pantsC: PANTS[(rng() * PANTS.length) | 0],
      glasses: rng() < 0.25, hat: rng() < 0.18, bag: rng() < 0.25,
      hatC: CLOTH[(rng() * CLOTH.length) | 0]
    };
  }

  /* ---------- 캐릭터 SVG ----------
     viewBox 0 0 64 88, 치비 비율(머리 큼). mood: happy|neutral|sad
     .walk 상태에서 팔다리 스윙(CSS keyframes는 클라이언트에서 주입) */
  function darken(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, ((n >> 16) & 255) * f) | 0, g = Math.max(0, ((n >> 8) & 255) * f) | 0, b = Math.max(0, (n & 255) * f) | 0;
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function hairSVG(look) {
    var c = look.hairC, d = darken(c, 0.8);
    var back = "", front = "";
    switch (look.hair) {
      case 0: // 숏컷
        front = '<path d="M15 24 Q15 7 32 7 Q49 7 49 24 Q49 16 44 15 Q40 8 30 10 Q20 11 19 17 Q15 18 15 24Z" fill="' + c + '"/>';
        break;
      case 1: // 단발(보브)
        back = '<path d="M14 22 Q13 42 18 44 L22 30 L42 30 L46 44 Q51 42 50 22 Q49 6 32 6 Q15 6 14 22Z" fill="' + d + '"/>';
        front = '<path d="M15 24 Q15 7 32 7 Q49 7 49 24 Q46 14 38 14 Q34 9 26 12 Q18 14 15 24Z" fill="' + c + '"/>';
        break;
      case 2: // 긴 생머리
        back = '<path d="M14 22 Q12 52 20 56 L26 34 L38 34 L44 56 Q52 52 50 22 Q49 6 32 6 Q15 6 14 22Z" fill="' + d + '"/>';
        front = '<path d="M15 25 Q15 7 32 7 Q49 7 49 25 Q45 13 36 13 Q30 9 24 13 Q17 15 15 25Z" fill="' + c + '"/>';
        break;
      case 3: // 포니테일
        back = '<path d="M46 16 Q58 22 54 44 Q52 52 48 50 Q52 34 44 24Z" fill="' + d + '"/>';
        front = '<path d="M15 24 Q15 7 32 7 Q49 7 49 24 Q47 13 38 13 Q32 8 24 12 Q17 14 15 24Z" fill="' + c + '"/>';
        break;
      case 4: // 곱슬
        front = '<circle cx="20" cy="16" r="7" fill="' + c + '"/><circle cx="30" cy="11" r="8" fill="' + c + '"/><circle cx="42" cy="14" r="7" fill="' + c + '"/><circle cx="47" cy="22" r="5" fill="' + c + '"/><circle cx="16" cy="23" r="5" fill="' + c + '"/>';
        break;
      case 5: // 가르마 앞머리
        front = '<path d="M15 26 Q14 6 32 6 Q50 6 49 26 Q48 14 40 16 Q42 10 33 9 Q26 9 26 15 Q18 14 15 26Z" fill="' + c + '"/>';
        break;
      default: // 삭발/스포츠
        front = '<path d="M17 20 Q19 9 32 9 Q45 9 47 20 Q40 13 32 13 Q24 13 17 20Z" fill="' + c + '"/>';
    }
    return { back: back, front: front };
  }

  function faceSVG(look, mood) {
    var mouth;
    if (mood === "sad") mouth = '<path d="M27 33 Q32 29 37 33" stroke="#7a4a35" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    else if (mood === "open") mouth = '<ellipse cx="32" cy="32.5" rx="3.4" ry="2.6" fill="#8a4a3a"/>';
    else mouth = '<path d="M27 31 Q32 36 37 31" stroke="#7a4a35" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    var eyes = mood === "sad"
      ? '<path d="M22 24 Q25 22 28 24" stroke="#33220f" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M36 24 Q39 22 42 24" stroke="#33220f" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
      : '<circle cx="25" cy="24.5" r="2.3" fill="#33220f"/><circle cx="39" cy="24.5" r="2.3" fill="#33220f"/><circle cx="25.8" cy="23.7" r=".8" fill="#fff"/><circle cx="39.8" cy="23.7" r=".8" fill="#fff"/>';
    var blush = '<ellipse cx="21" cy="29" rx="2.6" ry="1.5" fill="#f4a3a3" opacity=".55"/><ellipse cx="43" cy="29" rx="2.6" ry="1.5" fill="#f4a3a3" opacity=".55"/>';
    var glasses = look && look.glasses
      ? '<circle cx="25" cy="24.5" r="5" fill="none" stroke="#4a3a30" stroke-width="1.4"/><circle cx="39" cy="24.5" r="5" fill="none" stroke="#4a3a30" stroke-width="1.4"/><path d="M30 24.5 L34 24.5" stroke="#4a3a30" stroke-width="1.4"/>'
      : "";
    return eyes + mouth + blush + glasses;
  }

  function outfitSVG(look) {
    var c = look.topC, d = darken(c, 0.82);
    switch (look.top) {
      case 1: // 원피스
        return '<path d="M24 44 L40 44 L45 66 L19 66 Z" fill="' + c + '"/><path d="M24 44 L40 44 L41 50 L23 50Z" fill="' + d + '"/>';
      case 2: // 후드
        return '<rect x="22" y="43" width="20" height="21" rx="6" fill="' + c + '"/><path d="M24 44 Q32 52 40 44 L40 48 Q32 55 24 48Z" fill="' + d + '"/><circle cx="32" cy="56" r="1.2" fill="' + d + '"/><circle cx="32" cy="60" r="1.2" fill="' + d + '"/>';
      case 3: // 셔츠+조끼
        return '<rect x="22" y="43" width="20" height="21" rx="5" fill="' + c + '"/><path d="M29 43 L32 49 L35 43 Z" fill="#fff"/><path d="M22 43 L28 43 L26 62 L22 60Z" fill="' + d + '"/><path d="M42 43 L36 43 L38 62 L42 60Z" fill="' + d + '"/>';
      default: // 티셔츠
        return '<rect x="22" y="43" width="20" height="21" rx="6" fill="' + c + '"/><path d="M22 47 L18 52 L21 54 L23 51Z" fill="' + c + '"/><path d="M42 47 L46 52 L43 54 L41 51Z" fill="' + c + '"/>';
    }
  }

  // opts: {mood, apron, chefHat, capHat, scale, id}
  function charSVG(look, opts) {
    opts = opts || {};
    var mood = opts.mood || "happy";
    var hair = hairSVG(look);
    var skin = look.skin, skinD = darken(skin, 0.88);
    var isDress = look.top === 1 && !opts.apron;
    var legY = 64, legLen = isDress ? 9 : 13;
    var apron = opts.apron
      ? '<path d="M24 46 L40 46 L42 63 L22 63 Z" fill="#fff8ec"/><path d="M27 46 L27 43 L37 43 L37 46" stroke="#fff8ec" stroke-width="2.4" fill="none"/><path d="M26 52 L38 52" stroke="#e8d9c0" stroke-width="1.2"/>'
      : "";
    var chefHat = opts.chefHat
      ? '<path d="M20 12 Q18 2 27 4 Q29 -2 36 1 Q44 -1 44 7 Q50 8 46 14 L44 18 L20 18 Z" fill="#fff"/><rect x="20" y="14" width="25" height="5" rx="2" fill="#f0e8da"/>'
      : "";
    var capHat = (look.hat && !opts.chefHat)
      ? '<path d="M15 17 Q15 6 32 6 Q49 6 49 17 L52 19 Q53 21 49 21 L15 20 Z" fill="' + look.hatC + '"/>'
      : "";
    var bag = look.bag
      ? '<path d="M40 44 L26 62" stroke="' + darken(look.pantsC, 0.9) + '" stroke-width="2.4"/><rect x="21" y="58" width="11" height="9" rx="3" fill="' + darken(look.topC, 0.7) + '"/>'
      : "";
    var arms =
      '<g class="arm armL" style="transform-origin:23px 46px"><path d="M23 45 Q19 52 21 58" stroke="' + (opts.apron ? "#fff8ec" : look.topC) + '" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="21" cy="59" r="2.6" fill="' + skin + '"/></g>' +
      '<g class="arm armR" style="transform-origin:41px 46px"><path d="M41 45 Q45 52 43 58" stroke="' + (opts.apron ? "#fff8ec" : look.topC) + '" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="43" cy="59" r="2.6" fill="' + skin + '"/></g>';
    var legs =
      '<g class="leg legL" style="transform-origin:28px ' + legY + 'px"><rect x="25.4" y="' + legY + '" width="5.4" height="' + legLen + '" rx="2.6" fill="' + look.pantsC + '"/><ellipse cx="28" cy="' + (legY + legLen + 1.5) + '" rx="4.4" ry="2.6" fill="#3a2c22"/></g>' +
      '<g class="leg legR" style="transform-origin:36px ' + legY + 'px"><rect x="33.2" y="' + legY + '" width="5.4" height="' + legLen + '" rx="2.6" fill="' + darken(look.pantsC, 0.85) + '"/><ellipse cx="36" cy="' + (legY + legLen + 1.5) + '" rx="4.4" ry="2.6" fill="#3a2c22"/></g>';
    var s = opts.scale || 1;
    return '<svg class="chibi" width="' + (52 * s) + '" height="' + (72 * s) + '" viewBox="0 0 64 88" style="overflow:visible">' +
      '<ellipse cx="32" cy="83" rx="15" ry="4.2" fill="rgba(60,30,5,.22)"/>' +
      hair.back + bag +
      legs +
      '<g class="torso">' + outfitSVG(look) + apron + arms + '</g>' +
      '<circle cx="32" cy="25" r="16.5" fill="' + skin + '"/>' +
      '<path d="M18 30 Q22 38 32 38 Q42 38 46 30 Q44 41 32 41 Q20 41 18 30Z" fill="' + skinD + '" opacity=".35"/>' +
      hair.front + capHat + chefHat +
      '<g class="face">' + faceSVG(look, mood) + '</g>' +
      '</svg>';
  }

  /* ---------- 직원 ---------- */
  function bakerSVG(busy) {
    var look = { skin: SKINS[1], hair: 0, hairC: HAIRC[2], top: 0, topC: "#f0f0f0", pantsC: "#4a4a58", glasses: false, hat: false, bag: false, hatC: "#fff" };
    return '<span class="staffwrap' + (busy ? " working" : "") + '">' + charSVG(look, { apron: true, chefHat: true, mood: busy ? "open" : "happy", scale: 0.92 }) + "</span>";
  }
  function cashierSVG() {
    var look = { skin: SKINS[0], hair: 3, hairC: HAIRC[5], top: 0, topC: "#e8b64c", pantsC: "#39506e", glasses: false, hat: false, bag: false, hatC: "#fff" };
    return '<span class="staffwrap idlebob">' + charSVG(look, { apron: true, mood: "happy", scale: 0.9 }) + "</span>";
  }

  /* ---------- 설비 (유사 아이소) ---------- */
  function shadow(w) { return '<ellipse cx="' + (w / 2) + '" cy="96%" rx="' + (w * 0.42) + '" ry="7" fill="rgba(60,30,5,.20)"/>'; }

  // 벽돌 오븐: busy 시 불꽃+연기
  function ovenSVG(busy) {
    var fire = busy
      ? '<g class="fireflick"><path d="M44 54 Q40 46 44 40 Q46 45 49 42 Q52 47 49 53 Q47 57 44 54Z" fill="#ff9d3b"/><path d="M45 52 Q43 47 45.5 44 Q47 47 48.5 45.5 Q50 49 48 52 Q46.5 54 45 52Z" fill="#ffd23b"/></g>'
      : '<circle cx="46" cy="49" r="4" fill="#3a2318"/>';
    var smoke = busy
      ? '<g class="smoke"><circle cx="78" cy="14" r="5" fill="#dcd2c4" opacity=".8"/><circle cx="82" cy="6" r="6.5" fill="#e7dfd4" opacity=".6"/></g>'
      : "";
    return '<svg width="96" height="86" viewBox="0 0 96 86" style="overflow:visible">' +
      shadow(96) +
      '<rect x="70" y="10" width="12" height="18" rx="2" fill="#6e4a35"/>' + smoke +
      '<path d="M10 30 L48 18 L86 30 L48 42 Z" fill="#b98a63"/>' +
      '<path d="M10 30 L10 70 L48 82 L48 42 Z" fill="#9c6f4c"/>' +
      '<path d="M86 30 L86 70 L48 82 L48 42 Z" fill="#8a5f40"/>' +
      // 벽돌 라인
      '<path d="M14 42 L44 52 M14 54 L44 64 M60 52 L82 44 M60 64 L82 56" stroke="rgba(60,30,10,.25)" stroke-width="2"/>' +
      // 아치 화구
      '<path d="M56 60 Q56 40 68 44 Q78 47 76 64 L58 68 Z" fill="#2c1a10"/>' +
      '<g transform="translate(14,-6)">' + fire + '</g>' +
      '</svg>';
  }

  // 유리 쇼케이스: items=[{emoji,n}] 실제 재고 노출, ratio 채움 정도
  function displaySVG(items, ratio) {
    var rows = "";
    var maxShow = 4;
    for (var i = 0; i < Math.min(items.length, maxShow); i++) {
      var it = items[i];
      var y = 34 + (i % 2) * 17, x = 22 + Math.floor(i / 2) * 30;
      var cnt = Math.max(1, Math.min(3, Math.ceil(it.n / 8)));
      for (var k = 0; k < cnt; k++)
        rows += '<text x="' + (x + k * 11) + '" y="' + y + '" font-size="13">' + it.emoji + "</text>";
    }
    var emptyTag = (!items.length) ? '<text x="30" y="42" font-size="10" fill="#a1876a" font-weight="800">텅 비었어요</text>' : "";
    return '<svg width="92" height="78" viewBox="0 0 92 78" style="overflow:visible">' +
      shadow(92) +
      '<path d="M8 24 L46 14 L84 24 L46 34 Z" fill="#c9a06e"/>' +
      '<path d="M8 24 L8 62 L46 72 L46 34 Z" fill="#a87c50"/>' +
      '<path d="M84 24 L84 62 L46 72 L46 34 Z" fill="#96693f"/>' +
      '<rect x="14" y="20" width="64" height="40" rx="4" fill="rgba(210,235,250,.55)" stroke="#fff" stroke-width="2"/>' +
      '<path d="M16 40 L76 40" stroke="rgba(255,255,255,.8)" stroke-width="2"/>' +
      rows + emptyTag +
      '<rect x="14" y="20" width="64" height="40" rx="4" fill="url(#none)" stroke="rgba(255,255,255,.9)" stroke-width="1"/>' +
      '</svg>';
  }

  // 커피: 핸드드립 → 에스프레소 머신
  function coffeeSVG(machine, busy) {
    var steam = busy ? '<g class="smoke"><circle cx="46" cy="12" r="4" fill="#e7dfd4" opacity=".7"/><circle cx="50" cy="5" r="5" fill="#efe8de" opacity=".5"/></g>' : "";
    if (!machine) {
      return '<svg width="78" height="72" viewBox="0 0 78 72" style="overflow:visible">' +
        shadow(78) +
        '<path d="M8 34 L39 26 L70 34 L39 42 Z" fill="#c9a06e"/><path d="M8 34 L8 58 L39 66 L39 42Z" fill="#a87c50"/><path d="M70 34 L70 58 L39 66 L39 42Z" fill="#96693f"/>' +
        '<path d="M30 20 L48 20 L45 32 L33 32 Z" fill="rgba(230,240,248,.8)" stroke="#fff" stroke-width="1.5"/>' +
        '<rect x="33" y="32" width="12" height="3" fill="#8a5a33"/>' +
        '<path d="M18 18 Q18 10 26 10 L30 10 L30 22 L22 24 Q18 24 18 18Z" fill="#5b6470"/><path d="M30 12 Q38 12 36 18" stroke="#5b6470" stroke-width="3" fill="none"/>' +
        steam + '</svg>';
    }
    return '<svg width="84" height="76" viewBox="0 0 84 76" style="overflow:visible">' +
      shadow(84) +
      '<path d="M8 38 L42 30 L76 38 L42 46 Z" fill="#c9a06e"/><path d="M8 38 L8 62 L42 70 L42 46Z" fill="#a87c50"/><path d="M76 38 L76 62 L42 70 L42 46Z" fill="#96693f"/>' +
      '<rect x="20" y="8" width="44" height="26" rx="5" fill="#b8412f"/>' +
      '<rect x="20" y="8" width="44" height="8" rx="4" fill="#d4553f"/>' +
      '<rect x="30" y="34" width="7" height="8" fill="#6e6e78"/><rect x="46" y="34" width="7" height="8" fill="#6e6e78"/>' +
      '<rect x="26" y="42" width="14" height="4" rx="2" fill="#e8e2d8"/>' +
      '<circle cx="58" cy="21" r="3.4" fill="#ffd23b"/><circle cx="26" cy="21" r="2.4" fill="#fff" opacity=".7"/>' +
      steam + '</svg>';
  }

  // 카운터: POS + 팁 항아리
  function counterSVG(tips) {
    var jar = '<g' + (tips > 0 ? ' class="jarshine"' : "") + '>' +
      '<path d="M60 24 Q57 24 57 28 L57 34 Q57 37 61 37 L69 37 Q73 37 73 34 L73 28 Q73 24 70 24 Z" fill="rgba(215,235,248,.75)" stroke="#fff" stroke-width="1.4"/>' +
      (tips > 0 ? '<circle cx="62" cy="33" r="2.4" fill="#e8b64c"/><circle cx="67" cy="34" r="2.4" fill="#e8b64c"/><circle cx="65" cy="30" r="2.4" fill="#f4d27e"/>' : "") + "</g>";
    return '<svg width="96" height="78" viewBox="0 0 96 78" style="overflow:visible">' +
      shadow(96) +
      '<path d="M6 36 L48 24 L90 36 L48 48 Z" fill="#d8b285"/>' +
      '<path d="M6 36 L6 60 L48 72 L48 48 Z" fill="#b08356"/>' +
      '<path d="M90 36 L90 60 L48 72 L48 48 Z" fill="#9c7047"/>' +
      '<path d="M10 44 L44 54 M10 52 L44 62" stroke="rgba(70,40,15,.18)" stroke-width="2"/>' +
      '<rect x="22" y="14" width="18" height="14" rx="2.5" fill="#4a5058"/><rect x="24" y="16" width="14" height="7" rx="1.5" fill="#9fe8b8"/><rect x="27" y="29" width="8" height="4" fill="#3c4148"/>' +
      jar + '</svg>';
  }

  /* ---------- 가구 ---------- */
  function tableSVG() {
    return '<svg width="70" height="62" viewBox="0 0 70 62" style="overflow:visible">' + shadow(70) +
      '<ellipse cx="35" cy="24" rx="26" ry="12" fill="#c9a06e"/><ellipse cx="35" cy="21" rx="26" ry="12" fill="#e0bd8c"/>' +
      '<path d="M33 32 L33 50 L37 50 L37 32Z" fill="#96693f"/><ellipse cx="35" cy="51" rx="9" ry="3.4" fill="#96693f"/>' +
      '<ellipse cx="35" cy="19" rx="9" ry="4" fill="#fff" opacity=".5"/></svg>';
  }
  function tableCoupleSVG() {
    return '<svg width="86" height="66" viewBox="0 0 86 66" style="overflow:visible">' + shadow(86) +
      '<path d="M9 24 L43 14 L77 24 L43 34Z" fill="#e0bd8c"/><path d="M9 24 L9 30 L43 40 L43 34Z" fill="#c9a06e"/><path d="M77 24 L77 30 L43 40 L43 34Z" fill="#b08356"/>' +
      '<path d="M14 30 L14 48 M72 30 L72 48 M43 40 L43 56" stroke="#96693f" stroke-width="4"/>' +
      '<text x="26" y="26" font-size="12">🌼</text></svg>';
  }
  function sofaSVG() {
    return '<svg width="84" height="64" viewBox="0 0 84 64" style="overflow:visible">' + shadow(84) +
      '<path d="M12 18 Q10 8 20 8 L64 8 Q74 8 72 18 L72 34 L12 34 Z" fill="#c96a5a"/>' +
      '<path d="M10 30 Q4 30 6 40 L10 52 L74 52 L78 40 Q80 30 74 30 L74 42 L10 42 Z" fill="#b8523f"/>' +
      '<rect x="12" y="30" width="60" height="13" rx="6" fill="#d97f6c"/>' +
      '<rect x="16" y="14" width="24" height="14" rx="6" fill="#d97f6c" opacity=".7"/><rect x="44" y="14" width="24" height="14" rx="6" fill="#d97f6c" opacity=".7"/></svg>';
  }
  function parasolSVG() {
    return '<svg width="86" height="96" viewBox="0 0 86 96" style="overflow:visible">' + shadow(86) +
      '<path d="M43 6 Q73 10 76 34 L10 34 Q13 10 43 6Z" fill="#e06d6d"/>' +
      '<path d="M25 9 Q34 6 43 6 Q52 6 61 9 L58 34 L28 34Z" fill="#fff3ea"/>' +
      '<path d="M42 34 L42 62 L44 62 L44 34Z" fill="#96693f"/>' +
      '<ellipse cx="43" cy="62" rx="22" ry="9" fill="#e0bd8c"/><ellipse cx="43" cy="59" rx="22" ry="9" fill="#f0d3a4"/>' +
      '<path d="M42 68 L42 82 L44 82 L44 68Z" fill="#96693f"/><ellipse cx="43" cy="84" rx="8" ry="3" fill="#96693f"/></svg>';
  }
  function doorSVG() {
    return '<svg width="46" height="74" viewBox="0 0 46 74" style="overflow:visible">' +
      '<rect x="2" y="2" width="42" height="70" rx="4" fill="#8a5a33"/>' +
      '<rect x="6" y="6" width="34" height="62" rx="3" fill="#a06b3d"/>' +
      '<rect x="10" y="10" width="26" height="22" rx="3" fill="rgba(220,240,250,.75)" stroke="#fff" stroke-width="1.5"/>' +
      '<circle cx="36" cy="44" r="2.6" fill="#e8b64c"/>' +
      '<rect x="8" y="36" width="30" height="1.6" fill="rgba(60,30,10,.3)"/></svg>';
  }
  function windowSVG() {
    return '<svg width="52" height="42" viewBox="0 0 52 42">' +
      '<rect x="1" y="1" width="50" height="40" rx="4" fill="#8a6a48"/>' +
      '<rect x="4" y="4" width="44" height="34" rx="3" fill="#cde8f2"/>' +
      '<path d="M26 4 L26 38 M4 21 L48 21" stroke="#8a6a48" stroke-width="2.5"/>' +
      '<path d="M8 30 Q16 22 24 30" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/></svg>';
  }
  function lampSVG() {
    return '<svg width="30" height="46" viewBox="0 0 30 46"><path d="M15 0 L15 16" stroke="#6a4e30" stroke-width="2"/>' +
      '<path d="M5 28 Q5 16 15 16 Q25 16 25 28 Z" fill="#e8b64c"/><circle cx="15" cy="31" r="4" fill="#ffe9a8"><animate attributeName="opacity" values="1;.75;1" dur="2.4s" repeatCount="indefinite"/></circle></svg>';
  }

  global.BakeryArt = {
    lookFromSeed: lookFromSeed, randomLook: randomLook, charSVG: charSVG,
    bakerSVG: bakerSVG, cashierSVG: cashierSVG,
    ovenSVG: ovenSVG, displaySVG: displaySVG, coffeeSVG: coffeeSVG, counterSVG: counterSVG,
    tableSVG: tableSVG, tableCoupleSVG: tableCoupleSVG, sofaSVG: sofaSVG, parasolSVG: parasolSVG,
    doorSVG: doorSVG, windowSVG: windowSVG, lampSVG: lampSVG
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.BakeryArt;
})(typeof window !== "undefined" ? window : globalThis);
