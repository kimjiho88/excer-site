/* 운영 대시보드: 대화 파일 분석을 화면과 따로 돌린다(수백 MB 파일도 화면이 멈추지 않게) */
importScripts("chat-parser.js?v=8", "ops-analyzer.js?v=4");
self.onmessage = function (e) {
  var d = e.data || {};
  var last = 0;
  OpsAnalyzer.runFiles(d.files || [], {
    links: d.links || {},
    onProgress: function (p) { if (p - last >= 0.01 || p >= 1) { last = p; self.postMessage({ type: "progress", p: p }); } }
  }).then(function (r) { self.postMessage({ type: "done", r: r }); })
    .catch(function (err) { self.postMessage({ type: "error", message: String((err && err.message) || err) }); });
};
