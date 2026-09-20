/* 동네친구들 — 서비스 워커
   홈 화면에 추가(설치)를 위한 최소 구성이다. 아무것도 저장(캐시)하지 않는다.
   배포가 잦아 오래된 파일이 남는 일을 피하려고 모든 요청을 그대로 네트워크로 보낸다. */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (e) { e.respondWith(fetch(e.request)); });
