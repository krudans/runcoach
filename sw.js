/* 가지런 서비스워커 — 네트워크 우선, 실패하면 캐시.
   깃허브 페이지스가 보내는 캐시 헤더 때문에 새 버전이 안 들어오던 문제를 막고,
   신호 없는 곳에서도 앱이 열리게 한다.
   외부 호출(api.anthropic.com 등)은 손대지 않는다. */
const CACHE = 'runcoach';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let u;
  try { u = new URL(req.url); } catch (err) { return; }
  if (u.origin !== self.location.origin) return;

  e.respondWith((async () => {
    try {
      const net = await fetch(req, { cache: 'no-store' });
      if (net && net.ok) {
        const c = await caches.open(CACHE);
        c.put(req, net.clone());
      }
      return net;
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      const idx = await caches.match('./index.html');
      if (idx && req.mode === 'navigate') return idx;
      throw err;
    }
  })());
});
