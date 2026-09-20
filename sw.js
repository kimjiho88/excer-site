/* 동네친구들 — 서비스 워커
   홈 화면에 추가(설치)를 위한 최소 구성이다. 페이지와 데이터는 저장(캐시)하지 않고 늘 네트워크로 보낸다 —
   배포가 잦아 오래된 파일이 남는 일을 피하기 위해서다.
   저장하는 것은 offline.html 한 장뿐이고, 연결이 없을 때 '페이지 이동' 요청에만 그것을 돌려준다.
   그 밖의 요청(스크립트·그림·데이터)은 서비스 워커를 거치지 않는다(respondWith 를 부르지 않으면 브라우저가 평소처럼 처리). */
var CACHE = "excer-offline-v1";
var OFFLINE = "/offline.html";

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.add(new Request(OFFLINE, { cache: "reload" })); })
      .catch(function () {})
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(function () {
      return caches.match(OFFLINE).then(function (r) { return r || Response.error(); });
    })
  );
});
