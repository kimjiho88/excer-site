#!/usr/bin/env node
/* ===================================================================
   levels.json 동기화 도구
   - balance.json 의 xpCurve 공식으로 xpTable(Lv.1~49 필요 경험치)을 재생성
   - 검수 규칙(§5.1): MVP 레벨(1~10)은 눈에 보이는 변화 1개 이상 보유해야 함
   사용법: node sim/sync-levels.js
   =================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const DATA = path.join(__dirname, "..", "data");
const balance = JSON.parse(fs.readFileSync(path.join(DATA, "balance.json"), "utf8"));
const levelsPath = path.join(DATA, "levels.json");
const levels = JSON.parse(fs.readFileSync(levelsPath, "utf8"));

const { A, B, maxLevel } = balance.xpCurve;
levels.xpTable = [];
for (let n = 1; n < maxLevel; n++) levels.xpTable.push(Math.round(A * Math.pow(n, B)));

// 검수: 레벨업마다 보이는 변화 1개 이상 (§5.1 / §15)
let bad = [];
for (const lv of levels.levels) {
  if (lv.level === 1) continue; // 시작 레벨은 레벨업이 아님
  const u = lv.unlocks || {};
  const visible = (u.menus || []).length + (u.slots || []).length + (u.furniture || []).length +
    (u.customers || []).length + ((u.features || []).length ? 1 : 0) + (lv.appearance ? 1 : 0);
  if (visible === 0) bad.push(lv.level);
}
if (bad.length) {
  console.error("❌ 보이는 변화가 없는 레벨: " + bad.join(", "));
  process.exit(1);
}

fs.writeFileSync(levelsPath, JSON.stringify(levels, null, 2) + "\n", "utf8");
console.log("✅ levels.json xpTable 갱신 (A=" + A + ", B=" + B + ", Lv.1~" + (maxLevel - 1) + ")");
console.log("   Lv.1→2: " + levels.xpTable[0] + " XP … Lv.9→10: " + levels.xpTable[8] + " XP … Lv.49→50: " + levels.xpTable[48] + " XP");
console.log("✅ 레벨업 가시 변화 검수 통과 (MVP Lv.2~10)");
