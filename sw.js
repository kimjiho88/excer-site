/* 동네친구들 — 서비스 워커
   홈 화면에 추가(설치)를 위한 최소 구성이다. 페이지와 데이터는 저장(캐시)하지 않고 늘 네트워크로 보낸다 —
   배포가 잦아 오래된 파일이 남는 일을 피하기 위해서다.
   저장하는 것은 offline.html 한 장과 그 안의 그림 한 장뿐이고, 연결이 없을 때 '페이지 이동' 요청에만 offline.html 을 돌려준다.
   그 밖의 요청(스크립트·그림·데이터)은 서비스 워커를 거치지 않는다(respondWith 를 부르지 않으면 브라우저가 평소처럼 처리). */
var VERSION = "2026-09-24a";            // offline.html 이나 그 그림을 고치면 이 값을 올린다 — 그래야 설치된 브라우저에 새 판이 저장된다
var CACHE = "excer-offline-" + VERSION;
var OFFLINE = "/offline.html";
var OFFLINE_IMG = "/assets/img/offline-spot-240.webp";   // offline.html 이 쓰는 그림. 없어도 페이지는 아이콘으로 동작한다

self.addEventListener("install", function (e) {
  // offline.html 을 저장하지 못하면 설치를 실패로 둔다 — 그래야 브라우저가 이전 워커와 저장본을 그대로 두고 다음에 다시 설치한다.
  // (실패를 삼키고 활성화하면 activate 가 멀쩡한 옛 저장본을 지워 오프라인 페이지가 사라진다.) 그림은 없어도 되므로 그 실패만 삼킨다.
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        return c.add(new Request(OFFLINE, { cache: "reload" }))
          .then(function () { return c.add(new Request(OFFLINE_IMG, { cache: "reload" })).catch(function () {}); });
      })
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
  // 오프라인 페이지의 그림 하나만 저장본 우선(그 페이지가 뜨는 순간엔 네트워크가 없다)
  if (e.request.mode !== "navigate") {
    if (new URL(e.request.url).pathname === OFFLINE_IMG) {
      e.respondWith(caches.match(OFFLINE_IMG).then(function (r) { return r || fetch(e.request); }));
    }
    return;
  }
  e.respondWith(
    fetch(e.request).catch(function () {
      return caches.match(OFFLINE).then(function (r) { return r || Response.error(); });
    })
  );
});
