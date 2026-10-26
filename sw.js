const CACHE_NAME = 'umbral-shell-v98';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=73',
  './scene.js?v=13',
  './store.js?v=2',
  './push.js?v=1',
  './shopping.js?v=5',
  './tasks.js?v=8',
  './notes.js?v=3',
  './pending.js?v=4',
  './plants.js?v=5',
  './money.js?v=5',
  './bank-import.js?v=1',
  './personal.js?v=7',
  './media.js?v=2',
  './kitchen.js?v=4',
  './nosotros.js?v=11',
  './trips.js?v=1',
  './upkeep.js?v=1',
  './documents.js?v=4',
  './avatars.js?v=7',
  './sims-world.js?v=18',
  './sims-places.js?v=2',
  './garden.js?v=4',
  './sims.js?v=21',
  './sims-life.js?v=6',
  './sims-build.js?v=1',
  './sims-music.js?v=1',
  './sims-mind.js?v=3',
  './assets/sims/ines.png?v=1',
  './assets/sims/matteo.png?v=2',
  './assets/sims/ines-faces.png?v=1',
  './assets/sims/matteo-faces.png?v=1',
  './assets/sims/house-floors.png?v=1',
  './app.js?v=55',
  './summary.js?v=4',
  './today.js?v=1',
  './energy.js?v=4',
  './appliances.js?v=3',
  './assistant.js?v=3',
  './ux.js?v=2',
  './native.js?v=1',
  './smart-lights-config.js',
  './supabase-config.js',
  './mobile-bridge.js',
  './vendor/icons.js?v=2',
  './vendor/supabase-2.117.3.js',
  './manifest.webmanifest',
  './icon.svg',
  './assets/app/icon.svg',
  './assets/app/icon-180.png',
  './assets/app/icon-512.png'
];

self.addEventListener('install', (event) => {
  // Al instalar una versión nueva, todo directo del servidor (no de la caché del navegador).
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  const request = event.request;
  const isDocument = request.mode === 'navigate' || request.url.endsWith('.html') || request.url.endsWith('.js');
  // Solo se guardan respuestas buenas (antes un 404 se quedaba guardado para siempre).
  const save = (response) => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
    }
    return response;
  };
  const fallback = () => caches.match(request).then((cached) => cached || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
  if (isDocument) {
    // La página y el código, del servidor (comprobando la versión, sin la caché del navegador).
    // Con mala cobertura no se espera más de 4 s: se abre la copia guardada y la nueva se
    // guarda igualmente para la próxima vez.
    const network = fetch(request, { cache: 'no-cache' }).then(save);
    event.respondWith(new Promise((resolve) => {
      let done = false;
      const finish = (response) => { if (!done && response) { done = true; resolve(response); } };
      const timer = setTimeout(() => fallback().then((cached) => { if (cached && cached.type !== 'error') finish(cached); }), 4000);
      network.then((response) => { clearTimeout(timer); finish(response); })
        .catch(() => { clearTimeout(timer); fallback().then(finish); });
    }));
    event.waitUntil(network.catch(() => {}));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then(save)).catch(fallback));
});

// Avisos push enviados por la función notify-household.
self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : '' };
  }
  // Si el aviso trae el número de cosas pendientes, se pone en el icono de la app.
  if (Number.isFinite(Number(message.badge)) && self.navigator.setAppBadge) self.navigator.setAppBadge(Number(message.badge)).catch(() => {});
  event.waitUntil(self.registration.showNotification(message.title || 'Umbral', {
    body: message.body || '',
    icon: './assets/app/icon-180.png',
    badge: './assets/app/icon-180.png',
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
