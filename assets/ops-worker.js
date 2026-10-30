/* 운영 대시보드: 대화 파일 분석을 화면과 따로 돌린다(수백 MB 파일도 화면이 멈추지 않게) */
importScripts("chat-parser.js?v=10", "ops-lang.js?v=1", "ops-analyzer.js?v=7");
self.onmessage = function (e) {
  var d = e.data || {};
  var last = 0;
  OpsAnalyzer.runFiles(d.files || [], {
    links: d.links || {},
    lang: d.lang || {},   // 채팅 언어 단어 목록 설정(끈 항목, 켠 항목, 더한 말, 예외 말)
    onProgress: function (p) { if (p - last >= 0.01 || p >= 1) { last = p; self.postMessage({ type: "progress", p: p }); } }
  }).then(function (r) { self.postMessage({ type: "done", r: r }); })
    .catch(function (err) { self.postMessage({ type: "error", message: String((err && err.message) || err) }); });
};
