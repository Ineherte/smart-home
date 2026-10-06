const CACHE_NAME = 'umbral-shell-v61';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=42',
  './scene.js?v=11',
  './store.js?v=1',
  './push.js?v=1',
  './shopping.js?v=4',
  './tasks.js?v=5',
  './pending.js?v=3',
  './plants.js?v=5',
  './money.js?v=3',
  './bank-import.js?v=1',
  './personal.js?v=2',
  './media.js?v=1',
  './kitchen.js?v=3',
  './nosotros.js?v=5',
  './avatars.js?v=6',
  './sims-world.js?v=6',
  './sims-places.js?v=2',
  './garden.js?v=1',
  './sims.js?v=7',
  './assets/sims/ines.png?v=1',
  './assets/sims/matteo.png?v=2',
  './assets/sims/ines-faces.png?v=1',
  './assets/sims/matteo-faces.png?v=1',
  './app.js?v=45',
  './smart-lights-config.js',
  './supabase-config.js',
  './mobile-bridge.js',
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

// Avisos push enviados por la función notify-household.
self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(message.title || 'Umbral', {
    body: message.body || '',
    icon: './icon.svg',
    badge: './icon.svg',
    tag: message.tag,
    renotify: Boolean(message.tag),
    data: { url: message.url || './' }
  }));
});

// Al tocar el aviso: abre Umbral (o la trae al frente) en la sección correspondiente.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './', self.registration.scope);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const open = windows.find((client) => client.url.startsWith(self.registration.scope));
    if (!open) return self.clients.openWindow(url.href);
    open.postMessage({ type: 'umbral:open', target: url.searchParams.get('abrir') });
    return open.focus();
  }));
});
