const CACHE_NAME = 'gold-price-v34-yahoo-github-mirror';
const STATIC_CACHE = [
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_CACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))));
  self.clients.claim();
});

function isApiRequest(req){
  return /gold-api|open\.er-api|currency-api|finance\/chart|corsproxy|allorigins|codetabs|isomorphic-git|firebaseio|gstatic\.com\/firebase/i.test(req.url);
}

function isYahooDataFile(url){
  return url.origin === self.location.origin && /\/data\/yahoo-gold\.json$/i.test(url.pathname);
}

async function networkFirst(request){
  const cache = await caches.open(CACHE_NAME);
  try{
    const fresh = await fetch(request, { cache:'no-store' });
    if(fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  }catch(_){
    return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
  }
}

async function staleWhileRevalidate(request){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const update = fetch(request).then(res => {
    if(res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  return cached || update || fetch(request);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // v34: Yahoo file is same-origin but must be fresh because GitHub Action updates it.
  if(isYahooDataFile(url)){
    event.respondWith(networkFirst(req));
    return;
  }

  // Never cache prices, chart APIs, exchange rates, proxy attempts, or Firebase data.
  if(isApiRequest(req)){
    event.respondWith(fetch(req, { cache:'no-store' }).catch(() => Response.error()));
    return;
  }

  if(req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/' || url.pathname.endsWith('/gold/')){
    event.respondWith(networkFirst(req));
    return;
  }

  if(url.origin === self.location.origin || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')){
    event.respondWith(staleWhileRevalidate(req));
  }
});
