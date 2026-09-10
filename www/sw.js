const CACHE_NAME = 'umbral-shell-v24';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=10',
  './app.js?v=19',
  './smart-lights-config.js',
  './supabase-config.js',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  const isDocument = event.request.mode === 'navigate' || event.request.url.endsWith('.html') || event.request.url.endsWith('.js');
  event.respondWith((isDocument ? fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return response;
  }) : caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return response;
  }))).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html'))));
});
