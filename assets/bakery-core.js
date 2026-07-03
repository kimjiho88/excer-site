/* ===================================================================
   엑서 빵집 타이쿤 — 공용 코어 엔진 (window.BakeryCore / module.exports)
   -------------------------------------------------------------------
   순수 함수 모음. 브라우저(bakery.html)와 노드(sim/simulate.js)가
   같은 코드를 사용한다. 모든 수치는 data/*.json 에서 주입받는다
   (이 파일에 밸런스 매직넘버를 두지 않는다 — §15 검수 기준).

   data 인자 형태:
     { balance, recipes, equipment, levels, customers, members }
     (각각 data/balance.json 등의 파싱 결과 그대로)

   시간 단위: 초. 시각은 epoch 초(서버 시간 기준) — 엔진은 시각을
   만들지 않고 경과 초(elapsedSec)만 받는다.
   =================================================================== */
(function (global) {
  "use strict";

  /* ---------- 조회 헬퍼 ---------- */
  function recipeById(data, id) {
    var rs = data.recipes.recipes;
    for (var i = 0; i < rs.length; i++) if (rs[i].id === id) return rs[i];
    return null;
  }
  function equipById(data, id) {
    var es = data.equipment.equipment;
    for (var i = 0; i < es.length; i++) if (es[i].id === id) return es[i];
    return null;
  }

  /* ---------- 경험치 / 레벨 ---------- */
  // XP_need(n) = round(A * n^B) — 레벨 n → n+1 필요 경험치
  function xpNeed(data, level) {
    var c = data.balance.xpCurve;
    if (level >= c.maxLevel) return Infinity;
    return Math.round(c.A * Math.pow(level, c.B));
  }
  // xp 추가 → 레벨업 목록 반환(연쇄 레벨업 포함)
  function addXp(data, state, amount) {
    var ups = [];
    state.xp += amount;
    while (state.level < data.balance.xpCurve.maxLevel && state.xp >= xpNeed(data, state.level)) {
      state.xp -= xpNeed(data, state.level);
      state.level += 1;
      ups.push(state.level);
    }
    return ups;
  }

  /* ---------- 등급 ---------- */
  function gradeForLevel(data, level) {
    var list = data.balance.grades.list, g = list[0];
    for (var i = 0; i < list.length; i++) if (level >= list[i].minLevel) g = list[i];
    return g;
  }

  /* ---------- 장비 효과 (equipment.json params 기반) ---------- */
  function equipLevel(state, id) { return (state.equip && state.equip[id]) || 1; }
  function ovenTimeMult(data, state) {
    var p = equipById(data, "oven").params;
    return Math.pow(p.timeMultPerLevel, equipLevel(state, "oven") - 1);
  }
  function stockCap(data, state) {
    var p = equipById(data, "display").params;
    return p.capBase + p.capPerLevel * (equipLevel(state, "display") - 1);
  }
  function counterMult(data, state) {
    var p = equipById(data, "counter").params;
    return 1 + p.sellMultPerLevel * (equipLevel(state, "counter") - 1);
  }
  function signMult(data, state) {
    var p = equipById(data, "sign").params;
    return 1 + p.visitMultPerLevel * (equipLevel(state, "sign") - 1);
  }
  function upgradeCost(data, id, curLevel) {
    var e = equipById(data, id);
    if (!e || curLevel >= e.maxLevel) return null;
    return e.costs[curLevel - 1]; // costs[0] = Lv.1→2
  }

  /* ---------- 제작 ---------- */
  function hasCoffeeMachine(data, state) {
    return state.level >= data.balance.stations.coffee.machineUnlockLevel;
  }
  function craftSeconds(data, state, recipe) {
    var t = recipe.craftSec;
    if (recipe.station === "oven") t *= ovenTimeMult(data, state);
    else if (recipe.station === "coffee" && hasCoffeeMachine(data, state))
      t *= data.balance.stations.coffee.machineTimeMult;
    return t;
  }
  function stationUnlocked(data, state, station) {
    var st = data.balance.stations[station];
    return st ? state.level >= st.unlockLevel : false;
  }
  function recipeUnlocked(data, state, recipe) {
    if (state.level < recipe.unlockLevel) return false;
    if (!stationUnlocked(data, state, recipe.station)) return false;
    if (recipe.requiresMachine && !hasCoffeeMachine(data, state)) return false;
    return true;
  }
  function unlockedRecipes(data, state) {
    return data.recipes.recipes.filter(function (r) { return recipeUnlocked(data, state, r); });
  }

  // 대기열에 배치 1개 추가. 성공 시 true.
  function enqueue(data, state, recipeId) {
    var r = recipeById(data, recipeId);
    if (!r || !recipeUnlocked(data, state, r)) return false;
    var q = state.queues[r.station];
    if (!q || q.length >= data.balance.queue.slotsPerStation) return false;
    // remain 은 잡이 헤드가 될 때 확정(장비 업그레이드 반영). 대기 중엔 null.
    q.push({ r: recipeId, remain: q.length === 0 && !state.buffer[r.station] ? craftSeconds(data, state, r) : null });
    return true;
  }

  /* ---------- 숙련도(P1) / 가격 ---------- */
  function masteryBonusPct(data, state, recipeId) {
    var m = data.recipes.mastery;
    if (!m) return 0;
    var sold = (state.sold && state.sold[recipeId]) || 0, pct = 0;
    for (var i = 0; i < m.thresholds.length; i++) if (sold >= m.thresholds[i]) pct = m.priceBonusPct[i];
    return pct;
  }
  function unitPrice(data, state, recipe) {
    return Math.round(recipe.price * (1 + masteryBonusPct(data, state, recipe.id) / 100));
  }
  function tipAmount(data, price) {
    var t = data.balance.tips;
    return Math.max(t.min, Math.round(price * t.pctOfPrice));
  }

  /* ---------- 판매 속도 모델 ----------
     온라인: 메뉴별 demandPerMin/60 × 계산대 × 간판  (개/초)
     오프라인: unitsPerHourBase/3600 × 간판 을 재고 메뉴의 demand 가중치로 배분 */
  function saleRatePerSec(data, state, recipe, mode, stockedDemandSum) {
    if (mode === "online") {
      return (recipe.demandPerMin / 60) * counterMult(data, state) * signMult(data, state);
    }
    var total = (data.balance.offline.unitsPerHourBase / 3600) * signMult(data, state);
    if (!stockedDemandSum) return 0;
    return total * (recipe.demandPerMin / stockedDemandSum);
  }

  /* ---------- 핵심: 시간 전진 시뮬레이션 ----------
     advance(data, state, seconds, mode, rng)
       mode: "online" | "offline"
       rng: 팁 판정용 난수 함수(생략 시 기대값 방식 — 시뮬레이터/오프라인 정산용)
     반환 summary:
       { coins, xp, tips, sold, soldBy:{id:n}, produced:{id:n},
         levelUps:[lv...], repGained, lostDemand } */
  function advance(data, state, seconds, mode, rng) {
    var sum = { coins: 0, xp: 0, tips: 0, sold: 0, soldBy: {}, produced: {}, levelUps: [], repGained: 0, lostDemand: 0 };
    if (seconds <= 0) return sum;
    var bal = data.balance;
    var stations = Object.keys(state.queues);
    var left = seconds;

    while (left > 0) {
      var dt = Math.min(left, 30); // 최대 30초 스텝(재고 상한·큐 상호작용 정확도)
      left -= dt;

      /* 1) 생산: 완충(buffer) → 진열 이동 시도, 시간 예산 내 다중 완성 처리 */
      for (var si = 0; si < stations.length; si++) {
        var st = stations[si];
        // 완성 대기분 진열 시도(진열대에 공간이 생기는 대로)
        flushBuffer(data, state, st, sum);
        // 시간 예산(dt)을 소진하며 제작 — 짧은 배치는 한 스텝에 여러 개 완성 가능
        var budget = dt, guard = 0;
        while (budget > 0 && !state.buffer[st] && state.queues[st].length > 0 && guard++ < 200) {
          var job = state.queues[st][0];
          var jr = recipeById(data, job.r);
          if (job.remain == null) job.remain = craftSeconds(data, state, jr);
          var use = Math.min(budget, job.remain);
          job.remain -= use; budget -= use;
          if (job.remain <= 0) {
            state.queues[st].shift();
            state.buffer[st] = { r: job.r, n: jr.batch };
            if (state.queues[st].length > 0) state.queues[st][0].remain = null;
            flushBuffer(data, state, st, sum); // 공간 있으면 즉시 진열 → 다음 잡 계속
          }
        }
      }

      /* 2) 판매: 재고 메뉴가 saleRate 로 소진 */
      var stocked = [], demandSum = 0;
      for (var ri = 0; ri < data.recipes.recipes.length; ri++) {
        var rec = data.recipes.recipes[ri];
        if ((state.stock[rec.id] || 0) > 0) { stocked.push(rec); demandSum += rec.demandPerMin; }
      }
      for (var k = 0; k < stocked.length; k++) {
        var r2 = stocked[k];
        var rate = saleRatePerSec(data, state, r2, mode, demandSum);
        state.sellAcc[r2.id] = (state.sellAcc[r2.id] || 0) + rate * dt;
        var want = Math.floor(state.sellAcc[r2.id]);
        if (want <= 0) continue;
        var can = Math.min(want, state.stock[r2.id]);
        if (can < want) sum.lostDemand += (want - can); // 품절 기회 손실(소프트 실패)
        state.sellAcc[r2.id] -= want;
        if (can <= 0) continue;

        var price = unitPrice(data, state, r2);
        state.stock[r2.id] -= can;
        sum.coins += price * can;
        state.coins += price * can;
        sum.xp += r2.xp * can;
        sum.sold += can;
        sum.soldBy[r2.id] = (sum.soldBy[r2.id] || 0) + can;
        state.sold[r2.id] = (state.sold[r2.id] || 0) + can;
        state.totalSold += can;
        state.daily.sold += can;
        state.daily.soldBy[r2.id] = (state.daily.soldBy[r2.id] || 0) + can;

        // 팁: rng 있으면 개당 판정, 없으면 기대값 누적 (둘 다 항아리 상한 적용)
        var tipEach = tipAmount(data, price);
        if (rng) {
          for (var u = 0; u < can; u++) {
            if (rng() < bal.tips.chance) {
              var room = bal.tips.jarCap - state.tipsJar;
              if (room > 0) { var add = Math.min(room, tipEach); state.tipsJar += add; sum.tips += add; }
            }
          }
        } else {
          state.tipAcc = (state.tipAcc || 0) + can * bal.tips.chance * tipEach;
          var whole = Math.floor(state.tipAcc);
          if (whole > 0) {
            state.tipAcc -= whole;
            var room2 = bal.tips.jarCap - state.tipsJar;
            var add2 = Math.max(0, Math.min(room2, whole));
            state.tipsJar += add2; sum.tips += add2;
          }
        }

        // 평판: perSales 개당 +1
        state.repProgress = (state.repProgress || 0) + can;
        while (state.repProgress >= bal.reputation.perSales) {
          state.repProgress -= bal.reputation.perSales;
          state.rep += 1; sum.repGained += 1;
        }
      }
    }

    var ups = addXp(data, state, sum.xp);
    for (var li = 0; li < ups.length; li++) sum.levelUps.push(ups[li]);
    return sum;
  }

  function totalStock(state) {
    var n = 0;
    for (var k in state.stock) n += state.stock[k];
    return n;
  }

  // 완충(완성 대기) 물량을 진열대 공간이 허용하는 만큼 이동
  function flushBuffer(data, state, st, sum) {
    var buf = state.buffer[st];
    if (!buf) return;
    var space = stockCap(data, state) - totalStock(state);
    if (space <= 0) return;
    var mv = Math.min(space, buf.n);
    state.stock[buf.r] = (state.stock[buf.r] || 0) + mv;
    if (sum) sum.produced[buf.r] = (sum.produced[buf.r] || 0) + mv;
    buf.n -= mv;
    if (buf.n <= 0) state.buffer[st] = null;
  }

  /* ---------- 스크립트 판매 (FTUE 첫 손님 등 연출용 확정 구매) ----------
     판매 속도 모델을 우회해 n개를 즉시 판매. 코인/XP/평판은 동일 규칙. */
  function sellUnits(data, state, recipeId, n, withTip, rng) {
    var r = recipeById(data, recipeId);
    if (!r) return null;
    var can = Math.min(n, state.stock[recipeId] || 0);
    if (can <= 0) return null;
    var price = unitPrice(data, state, r);
    state.stock[recipeId] -= can;
    state.coins += price * can;
    state.totalSold += can;
    state.sold[recipeId] = (state.sold[recipeId] || 0) + can;
    state.daily.sold += can;
    state.daily.soldBy[recipeId] = (state.daily.soldBy[recipeId] || 0) + can;
    var tip = 0;
    if (withTip) {
      var each = tipAmount(data, price);
      var room = data.balance.tips.jarCap - state.tipsJar;
      tip = Math.max(0, Math.min(room, each));
      state.tipsJar += tip;
    }
    state.repProgress = (state.repProgress || 0) + can;
    var rep = 0;
    while (state.repProgress >= data.balance.reputation.perSales) {
      state.repProgress -= data.balance.reputation.perSales;
      state.rep += 1; rep += 1;
    }
    var ups = addXp(data, state, r.xp * can);
    return { sold: can, coins: price * can, xp: r.xp * can, tip: tip, repGained: rep, levelUps: ups };
  }

  /* ---------- 오프라인 정산 ---------- */
  // 부재 초만큼 offline 모드로 전진. 보고서 반환(복귀 팝업용).
  function offlineSettle(data, state, awaySec) {
    var bal = data.balance;
    if (awaySec < bal.offline.minAwaySec) return null;
    var sum = advance(data, state, awaySec, "offline", null);
    return {
      awaySec: awaySec,
      coins: sum.coins, xp: sum.xp, tips: sum.tips,
      sold: sum.sold, soldBy: sum.soldBy, produced: sum.produced,
      levelUps: sum.levelUps, repGained: sum.repGained
    };
  }

  /* ---------- 초기 상태 ---------- */
  function newState(data, nowSec) {
    return {
      v: data.balance.schemaVersion,
      name: "",
      level: 1, xp: 0,
      coins: data.balance.economy.startCoins,
      rep: 0, repProgress: 0,
      tipsJar: 0, tipAcc: 0,
      stock: {}, sellAcc: {},
      queues: { oven: [], coffee: [] },
      buffer: { oven: null, coffee: null },
      equip: { oven: 1, display: 1, counter: 1, sign: 1 },
      sold: {}, totalSold: 0,
      daily: { date: "", sold: 0, soldBy: {}, upgrades: 0, claimed: {} },
      regulars: {}, seenMembers: {},
      ftue: { done: false, step: 0 },
      lastSeenAt: nowSec || 0,
      createdAt: nowSec || 0
    };
  }

  /* ---------- 마이그레이션 (schema_version) ---------- */
  var MIGRATIONS = {
    // 1: 최초 버전 — 마이그레이션 없음. 다음 버전 예: 2: function(s){ ... return s; }
  };
  function migrate(data, state) {
    if (!state || typeof state !== "object") return null;
    var v = state.v || 1;
    while (v < data.balance.schemaVersion) {
      var fn = MIGRATIONS[v + 1];
      if (!fn) break;
      state = fn(state); v = state.v;
    }
    return state;
  }

  /* ---------- 다음 목표 (헤더 상시 노출용) ---------- */
  function nextUnlock(data, level) {
    var lv = data.levels.levels.concat(data.levels.roadmap || []);
    var best = null;
    for (var i = 0; i < lv.length; i++) {
      if (lv[i].level > level && (best === null || lv[i].level < best.level)) best = lv[i];
    }
    return best; // {level, headline, ...}
  }

  /* ---------- 일일 리셋 ---------- */
  function resetDaily(state, dateStr) {
    state.daily = { date: dateStr, sold: 0, soldBy: {}, upgrades: 0, claimed: {} };
  }

  var Core = {
    xpNeed: xpNeed, addXp: addXp,
    gradeForLevel: gradeForLevel,
    equipLevel: equipLevel, ovenTimeMult: ovenTimeMult, stockCap: stockCap,
    counterMult: counterMult, signMult: signMult, upgradeCost: upgradeCost,
    hasCoffeeMachine: hasCoffeeMachine, craftSeconds: craftSeconds,
    recipeUnlocked: recipeUnlocked, unlockedRecipes: unlockedRecipes,
    enqueue: enqueue, masteryBonusPct: masteryBonusPct, unitPrice: unitPrice,
    tipAmount: tipAmount, saleRatePerSec: saleRatePerSec,
    advance: advance, totalStock: totalStock, sellUnits: sellUnits, offlineSettle: offlineSettle,
    newState: newState, migrate: migrate, nextUnlock: nextUnlock, resetDaily: resetDaily,
    recipeById: recipeById, equipById: equipById
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Core;
  else global.BakeryCore = Core;
})(typeof window !== "undefined" ? window : globalThis);
