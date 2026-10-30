/* ============================================================
   ops_scan.js : 태블릿(Termux 의 node)에서 카카오톡 대화 내보내기 파일을 운영 대시보드와 같은 분석기로 읽는다.
   ------------------------------------------------------------
   봇(tools/excer_bot.py)이 하루 한 번 방의 대화 내용을 내보낸 뒤 이 파일을 node 로 돌리고, 결과 JSON 만 서버에 올린다.
   사용: node ops_scan.js <대화.txt> <결과.json> [설정.json] [자산 폴더]
     설정.json: { lang: { off, on, add, allow }, links: { 줄 열쇠: 지금 이름 } } (운영 화면이 서버 botcfg 에 둔 것. 없으면 기본 단어 목록)
     자산 폴더: chat-parser.js, ops-lang.js, ops-analyzer.js 가 있는 곳(없으면 이 파일의 폴더). 봇이 사이트에서 받아 둔다.
   결과: { v, scan, at, file: { bytes, lines }, range, totals, people, hits, ledger, lang }. 대화 원문은 넣지 않는다(분석기 결과 그대로:
     사람별 집계와 신호 발췌 80자, 언어 점검의 걸린 줄 발췌 80자). 파일은 조각씩 읽어 메모리에 다 올리지 않는다(170MB 도 폰에서 돈다).
   끝 코드: 0 됨, 2 사용법, 3 파일 없음, 4 대화를 찾지 못함, 5 그 밖의 오류(메시지는 stderr 한 줄)
   ============================================================ */
"use strict";
var VERSION = "2026-10-31";
var fs = require("fs"), path = require("path");
var argv = process.argv.slice(2);
if (argv.length < 2) { process.stderr.write("usage: node ops_scan.js <chat.txt> <out.json> [cfg.json] [asset_dir]\n"); process.exit(2); }
var src = argv[0], out = argv[1], cfgPath = argv[2] || "", dir = argv[3] || __dirname;
if (!fs.existsSync(src)) { process.stderr.write("no file: " + src + "\n"); process.exit(3); }
function need(name) {
  var p = path.join(dir, name);
  if (!fs.existsSync(p)) { process.stderr.write("no asset: " + p + "\n"); process.exit(5); }
  return require(p);
}
need("chat-parser.js");                     // globalThis.ChatParser
var OpsLang = need("ops-lang.js");          // globalThis.OpsLang
var OpsAnalyzer = need("ops-analyzer.js");  // 읽을 때 ChatParser 와 OpsLang 을 잡는다
var cfg = {};
if (cfgPath) {
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) || {}; } catch (e) { process.stderr.write("bad cfg: " + e.message + "\n"); process.exit(5); }
}
var A = OpsAnalyzer.createAnalyzer({ links: cfg.links || {}, lang: cfg.lang || {} });
var feed = OpsAnalyzer.lineFeeder(A);
var dec = new TextDecoder("utf-8");
var carry = "", lines = 0, bytes = 0, first = true;
A.beginFile();
var rs = fs.createReadStream(src, { highWaterMark: 4 * 1024 * 1024 });
rs.on("data", function (buf) {
  bytes += buf.length;
  var text = carry + dec.decode(buf, { stream: true });
  if (first) { text = text.replace(/^﻿/, ""); first = false; }
  var parts = text.split("\n");
  carry = parts.pop();
  for (var i = 0; i < parts.length; i++) { var l = parts[i]; if (l.charCodeAt(l.length - 1) === 13) l = l.slice(0, -1); feed.push(l); lines += 1; }
});
rs.on("error", function (e) { process.stderr.write("read error: " + e.message + "\n"); process.exit(5); });
rs.on("end", function () {
  var tail = carry + dec.decode();
  if (tail) { feed.push(tail.replace(/\r$/, "")); lines += 1; }
  feed.end();
  var r = A.finish();
  if (!r || !r.range || !r.range.from) { process.stderr.write("no messages\n"); process.exit(4); }
  var lang = r.lang || null; delete r.lang;
  var res = { v: 1, scan: VERSION, lex: OpsLang.VERSION, at: new Date().toISOString(), file: { bytes: bytes, lines: lines },
    range: r.range, totals: r.totals, people: r.people.length, hits: lang ? lang.all : 0, ledger: r, lang: lang };
  var tmp = out + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(res));
  fs.renameSync(tmp, out);
  process.stdout.write(JSON.stringify({ ok: true, range: r.range, messages: r.totals.messages, people: r.people.length, hits: res.hits, lines: lines, bytes: bytes }) + "\n");
});
