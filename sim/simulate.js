#!/usr/bin/env node
/* ===================================================================
   엑서 빵집 타이쿤 — D1~D14 페이싱 시뮬레이터 (§3.3 검증 의무)
   -------------------------------------------------------------------
   가정: 하루 3세션(아침 08:30 10분 / 점심 12:30 8분 / 저녁 22:00 10분).
   플레이어 정책(합리적 초보):
     - 세션 중 큐를 항상 채운다 (재고/수요 비율이 가장 낮은 메뉴 우선)
     - 팁은 세션 시작·종료 시 수금
     - 여유 코인이 있으면 업그레이드 구매 (가장 싼 것부터, 세션당 최대 2회)
     - 일일퀘스트 달성분은 세션 종료 시 수령
   출력: 일자별 레벨/코인/장비, 페이백 추정, §2.5 페이싱 목표 PASS/FAIL.
   사용법: node sim/simulate.js [--days 14] [--verbose]
   =================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const Core = require("../assets/bakery-core.js");

const DATA_DIR = path.join(__dirname, "..", "data");
function loadJson(f) { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8")); }
const data = {
  balance: loadJson("balance.json"),
  recipes: loadJson("recipes.json"),
  equipment: loadJson("equipment.json"),
  levels: loadJson("levels.json"),
  customers: loadJson("customers.json"),
  members: loadJson("members.json")
};

const argv = process.argv.slice(2);
const DAYS = argv.includes("--days") ? +argv[argv.indexOf("--days") + 1] : 14;
const VERBOSE = argv.includes("--verbose");

const H = 3600, MIN = 60;
const SESSIONS = [
  { at: 8.5 * H, len: 10 * MIN, name: "아침" },
  { at: 12.5 * H, len: 8 * MIN, name: "점심" },
  { at: 22 * H, len: 10 * MIN, name: "저녁" }
];

/* ---------- 플레이어 정책 ---------- */
function fillQueues(state) {
  const unlocked = Core.unlockedRecipes(data, state);
  if (!unlocked.length) return;
  let guard = 0;
  while (guard++ < 20) {
    // 재고+생산중 물량이 수요 대비 가장 부족한 메뉴 선택
    let best = null, bestRatio = Infinity;
    for (const r of unlocked) {
      const pending = pendingUnits(state, r.id);
      const ratio = ((state.stock[r.id] || 0) + pending) / r.demandPerMin;
      if (ratio < bestRatio) { bestRatio = ratio; best = r; }
    }
    if (!best || !Core.enqueue(data, state, best.id)) break;
  }
}
function pendingUnits(state, recipeId) {
  let n = 0;
  for (const st in state.queues)
    for (const job of state.queues[st])
      if (job.r === recipeId) n += Core.recipeById(data, recipeId).batch;
  for (const st in state.buffer)
    if (state.buffer[st] && state.buffer[st].r === recipeId) n += state.buffer[st].n;
  return n;
}
function collectTips(state) { state.coins += state.tipsJar; state.tipsJar = 0; }

const purchases = [];
// 구매 정책: 감당 가능한 후보 전부의 페이백을 추정해 가장 좋은 것을 산다.
// 페이백이 PB_BUY_LIMIT(24h)보다 나쁘면 저축(합리적 플레이어 근사).
const PB_BUY_LIMIT = 12;
function tryUpgrade(state, dayIdx, boughtThisSession) {
  if (boughtThisSession.n >= 2) return;
  const reserve = 20;
  let best = null;
  for (const e of data.equipment.equipment) {
    if (state.level < e.unlockLevel) continue;
    const cost = Core.upgradeCost(data, e.id, Core.equipLevel(state, e.id));
    if (cost == null || state.coins - cost < reserve) continue;
    const pb = estimatePayback(state, e.id, cost);
    if (pb <= PB_BUY_LIMIT && (!best || pb < best.pb)) best = { id: e.id, cost, pb };
  }
  if (!best) return;
  state.coins -= best.cost;
  state.equip[best.id] = Core.equipLevel(state, best.id) + 1;
  state.daily.upgrades += 1;
  boughtThisSession.n += 1;
  purchases.push({ day: dayIdx + 1, id: best.id, toLv: state.equip[best.id], cost: best.cost, paybackH: best.pb });
}
// 페이백 추정: 업그레이드 전/후로 '표준 하루'(세션 3회 + 오프라인)를 돌려
// 하루 수익 차이를 측정 → 시간당 증가 수익 기준 회수 시간(§3.2 페이백 규칙).
function estimatePayback(state, equipId, cost) {
  const runDay = (upgraded) => {
    const c = JSON.parse(JSON.stringify(state));
    if (upgraded) c.equip[equipId] = Core.equipLevel(c, equipId) + 1;
    c.coins = 0; c.tipsJar = 0;
    let earned = 0, tc = 0;
    for (const s of SESSIONS) {
      // 세션 전 오프라인 구간
      const gap = s.at - tc < 0 ? s.at + 86400 - tc : s.at - tc;
      earned += Core.advance(data, c, Math.min(gap, 12 * H), "offline", null).coins;
      tc = s.at;
      // 세션: 15초 스텝 + 큐 유지
      let el = 0;
      while (el < s.len) {
        fillQueuesFor(c);
        earned += Core.advance(data, c, 15, "online", null).coins;
        el += 15;
      }
      earned += c.tipsJar; c.tipsJar = 0;
      fillQueuesFor(c);
      tc = s.at + s.len;
    }
    // 마지막 세션 후 자정+아침까지 오프라인
    earned += Core.advance(data, c, 10.5 * H, "offline", null).coins;
    return earned;
  };
  const gainPerDay = runDay(true) - runDay(false);
  if (gainPerDay <= 0) return Infinity;
  return +(cost / (gainPerDay / 24)).toFixed(1);
}
// estimatePayback 클론 전용 큐 채우기 (fillQueues와 동일 정책, data 클로저 공유)
function fillQueuesFor(c) {
  const unlocked = Core.unlockedRecipes(data, c);
  if (!unlocked.length) return;
  let guard = 0;
  while (guard++ < 20) {
    let best = null, bestRatio = Infinity;
    for (const r of unlocked) {
      let pending = 0;
      for (const st in c.queues) for (const j of c.queues[st]) if (j.r === r.id) pending += r.batch;
      for (const st in c.buffer) if (c.buffer[st] && c.buffer[st].r === r.id) pending += c.buffer[st].n;
      const ratio = ((c.stock[r.id] || 0) + pending) / r.demandPerMin;
      if (ratio < bestRatio) { bestRatio = ratio; best = r; }
    }
    if (!best || !Core.enqueue(data, c, best.id)) break;
  }
}

/* ---------- 일일퀘스트 ---------- */
function claimQuests(state) {
  const qs = data.balance.quests.daily;
  const unlocked = Core.unlockedRecipes(data, state);
  for (const q of qs) {
    if (state.daily.claimed[q.id]) continue;
    let done = false;
    if (q.type === "sell_any") done = state.daily.sold >= q.target;
    else if (q.type === "sell_menu") {
      const menu = unlocked[0]; // 사이클 단순화: 첫 해금 메뉴
      done = menu && (state.daily.soldBy[menu.id] || 0) >= q.target;
    } else if (q.type === "upgrade") done = state.daily.upgrades >= q.target;
    if (done) {
      state.daily.claimed[q.id] = true;
      state.coins += q.rewardCoins;
      state.rep += q.rewardRep;
      Core.addXp(data, state, q.rewardXp);
    }
  }
}

/* ---------- 시뮬레이션 본체 ---------- */
const state = Core.newState(data, 0);
state.name = "시뮬 빵집";
Core.resetDaily(state, "day1");

let firstSaleSec = null, lv2Sec = null;
const lvAt = {};   // 레벨 → 도달 시각(초)
const dayEnd = []; // 일자별 스냅샷

function noteSummary(sum, t) {
  if (firstSaleSec === null && sum.sold > 0) firstSaleSec = t;
  for (const lv of sum.levelUps) if (!(lv in lvAt)) { lvAt[lv] = t; if (lv === 2) lv2Sec = t; }
}

let t = 0; // 전역 시각(초). day d 의 0시 = d*86400
for (let d = 0; d < DAYS; d++) {
  Core.resetDaily(state, "day" + (d + 1));
  for (let si = 0; si < SESSIONS.length; si++) {
    const s = SESSIONS[si];
    const sessionStart = d * 86400 + s.at;
    // 오프라인 구간 정산
    if (sessionStart > t) {
      const sum = Core.advance(data, state, sessionStart - t, "offline", null);
      noteSummary(sum, sessionStart);
      t = sessionStart;
    }
    collectTips(state);
    const bought = { n: 0 };
    // FTUE: 첫 세션 첫 1분은 튜토리얼(5초 단축 베이킹 + 첫 판매 보너스 XP)
    if (d === 0 && si === 0 && !state.ftue.done) {
      // 튜토리얼: 5초 베이킹 → 첫 손님(호스트 멤버)이 4개 확정 구매 + 보너스 XP
      state.queues.oven.push({ r: "morning_roll", remain: data.balance.ftue.tutorialCraftSec });
      const sum = Core.advance(data, state, 30, "online", null);
      const scripted = Core.sellUnits(data, state, "morning_roll", 4, true, null);
      Core.addXp(data, state, data.balance.ftue.firstSaleBonusXp);
      if (firstSaleSec === null && scripted) firstSaleSec = t + 30;
      noteSummary(sum, t + 30);
      if (scripted) for (const lv of scripted.levelUps) if (!(lv in lvAt)) { lvAt[lv] = t + 30; if (lv === 2) lv2Sec = t + 30; }
      const sum2 = Core.advance(data, state, 30, "online", null);
      noteSummary(sum2, t + 60);
      t += 60;
      state.ftue.done = true;
    }
    // 세션 본문: 15초 스텝
    const end = sessionStart + s.len;
    while (t < end) {
      fillQueues(state);
      const step = Math.min(15, end - t);
      const sum = Core.advance(data, state, step, "online", null);
      t += step;
      noteSummary(sum, t);
      if (Math.round(t) % 60 === 0) tryUpgrade(state, d, bought);
    }
    collectTips(state);
    claimQuests(state);
    // 이탈 전 큐 리필(방치 생산)
    fillQueues(state);
  }
  // 자정까지 오프라인 → 일말 스냅샷
  const midnight = (d + 1) * 86400;
  const sum = Core.advance(data, state, midnight - t, "offline", null);
  noteSummary(sum, midnight);
  t = midnight;
  dayEnd.push({
    day: d + 1, level: state.level, xp: state.xp, coins: state.coins, rep: state.rep,
    totalSold: state.totalSold,
    equip: JSON.parse(JSON.stringify(state.equip))
  });
}

/* ---------- 오프라인 상한(재고 소진 시간) 계산 ---------- */
function selloutHours(equipLv) {
  const s = Core.newState(data, 0);
  s.equip = { oven: equipLv, display: equipLv, counter: equipLv, sign: equipLv };
  s.level = 10;
  const cap = Core.stockCap(data, s);
  const perHour = data.balance.offline.unitsPerHourBase * Core.signMult(data, s);
  return cap / perHour;
}

/* ---------- 리포트 ---------- */
const fmtMin = sec => (sec / 60).toFixed(1) + "분";
console.log("═══ 엑서 빵집 타이쿤 페이싱 시뮬레이션 (D1~D" + DAYS + ") ═══");
console.log("XP 곡선: A=" + data.balance.xpCurve.A + ", B=" + data.balance.xpCurve.B);
console.log("");
console.log("일자 | 레벨 | 코인   | 평판 | 누적판매 | 장비(오븐/진열/계산/간판)");
for (const r of dayEnd) {
  console.log(
    String(r.day).padStart(3) + "  |  " + String(r.level).padStart(2) + "  | " +
    String(r.coins).padStart(6) + " | " + String(r.rep).padStart(3) + "  | " +
    String(r.totalSold).padStart(7) + "  | " +
    r.equip.oven + "/" + r.equip.display + "/" + r.equip.counter + "/" + r.equip.sign);
}
console.log("");
console.log("레벨 도달 시각:");
for (const lv of Object.keys(lvAt).map(Number).sort((a, b) => a - b)) {
  const sec = lvAt[lv];
  console.log("  Lv." + lv + "  D" + (Math.floor(sec / 86400) + 1) + " " + ((sec % 86400) / 3600).toFixed(1) + "h" + (lv <= 2 ? " (게임 시작 후 " + fmtMin(sec - 8.5 * H) + ")" : ""));
}
if (VERBOSE) {
  console.log("\n업그레이드 구매 로그 (페이백 추정):");
  for (const p of purchases)
    console.log("  D" + p.day + "  " + p.id + " → Lv." + p.toLv + "  비용 " + p.cost + "  페이백 ≈ " + p.paybackH + "h");
}
console.log("\n오프라인 상한(재고 만재 → 소진 시간):");
console.log("  초기(전 장비 Lv.1): " + selloutHours(1).toFixed(1) + "h  (목표 ≈ " + data.balance.pacingTargets.offlineCapHoursEarly + "h)");
console.log("  만렙(전 장비 Lv.10): " + selloutHours(10).toFixed(1) + "h  (목표 ≈ " + data.balance.pacingTargets.offlineCapHoursLate + "h)");

/* ---------- PASS/FAIL ---------- */
const T = data.balance.pacingTargets;
const checks = [];
function check(name, ok, detail) { checks.push({ name, ok, detail }); }

const startOfPlay = 8.5 * H;
check("첫 판매 ≤ " + T.firstSaleWithinMin + "분", firstSaleSec !== null && firstSaleSec - startOfPlay <= T.firstSaleWithinMin * 60,
  firstSaleSec === null ? "판매 없음" : fmtMin(firstSaleSec - startOfPlay));
check("Lv.2 ≤ " + T.level2WithinMin + "분", lv2Sec !== null && lv2Sec - startOfPlay <= T.level2WithinMin * 60,
  lv2Sec === null ? "미도달" : fmtMin(lv2Sec - startOfPlay));
const d1 = dayEnd[0], d3 = dayEnd[2], d7 = dayEnd[6];
check("D1 종료 Lv." + T.d1Level + " (±1)", d1 && Math.abs(d1.level - T.d1Level) <= 1, d1 ? "Lv." + d1.level : "-");
check("D3 Lv." + T.d3LevelMin + "~" + T.d3LevelMax, d3 && d3.level >= T.d3LevelMin && d3.level <= T.d3LevelMax, d3 ? "Lv." + d3.level : "-");
check("D7 Lv." + T.d7Level + " (허용 " + T.d7Level + "~" + (T.d7Level + 1) + ")", d7 && d7.level >= T.d7Level && d7.level <= T.d7Level + 1, d7 ? "Lv." + d7.level : "-");
check("초기 오프라인 상한 ≈ " + T.offlineCapHoursEarly + "h (±25%)",
  Math.abs(selloutHours(1) - T.offlineCapHoursEarly) <= T.offlineCapHoursEarly * 0.25, selloutHours(1).toFixed(1) + "h");
check("후반 오프라인 상한 ≈ " + T.offlineCapHoursLate + "h (±25%)",
  Math.abs(selloutHours(10) - T.offlineCapHoursLate) <= T.offlineCapHoursLate * 0.25, selloutHours(10).toFixed(1) + "h");
// 페이백 규칙(§3.2): 초반(첫 8회 구매) 페이백 중앙값 2~4h(허용 1~6h — 즉각 보상감),
// 후반은 길어져도 되나 전 구매가 유한해야 함(회수 불가능한 업그레이드 금지).
const earlyPbs = purchases.slice(0, 8).map(p => p.paybackH).filter(x => isFinite(x)).sort((a, b) => a - b);
const medPb = earlyPbs.length ? earlyPbs[Math.floor(earlyPbs.length / 2)] : null;
check("초반 업그레이드 페이백 중앙값 " + data.balance.economy.paybackTargetHoursMin + "~" + data.balance.economy.paybackTargetHoursMax + "h (허용 1~6h)",
  medPb !== null && medPb >= 1 && medPb <= 6, medPb === null ? "-" : medPb + "h");
check("모든 업그레이드 페이백 유한(회수 가능)", purchases.every(p => isFinite(p.paybackH)),
  purchases.filter(p => !isFinite(p.paybackH)).map(p => p.id + "L" + p.toLv).join(",") || "OK");

console.log("\n═══ §2.5 페이싱 목표 검증 ═══");
let fails = 0;
for (const c of checks) {
  console.log("  " + (c.ok ? "✅ PASS" : "❌ FAIL") + "  " + c.name + "  → " + c.detail);
  if (!c.ok) fails++;
}
console.log(fails === 0 ? "\n🎉 전체 통과 — balance.json 확정 가능" : "\n⚠️  " + fails + "건 실패 — balance.json 조정 필요");
process.exit(fails === 0 ? 0 : 1);
