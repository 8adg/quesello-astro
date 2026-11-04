const CACHE_NAME = 'quesello-pwa-v3';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/admin-manifest.json',
        '/iconos/92.png',
        '/iconos/144.png',
        '/iconos/192.png',
        '/iconos/512.png',
        '/logo.svg',
        '/iso-color.svg'
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// ==========================================
// NOTIFICACIONES WEB PUSH (NATIVAS EN CELULAR)
// ==========================================
self.addEventListener('push', (event) => {
  let payload = {
    title: '📦 ¡Nuevo Pedido Web!',
    body: 'Recibiste un nuevo pedido en Queselló.',
    url: '/admin/presupuestos',
    tag: 'quesello-order-' + Date.now()
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch (e) {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: '/iconos/192.png',
    badge: '/iconos/92.png',
    vibrate: [250, 120, 250, 120, 400],
    tag: payload.tag || 'quesello-order',
    renotify: true,
    requireInteraction: true,
    data: {
      url: payload.url || '/admin/presupuestos',
      orderNumber: payload.orderNumber || null
    },
    actions: [
      { action: 'open', title: 'Ver presupuesto' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/admin/presupuestos';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/admin') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Solo procesar solicitudes GET
  if (event.request.method !== 'GET') return;

  // No cachear llamadas a APIs, admin en vivo o servicios externos
  const url = event.request.url;
  if (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('/admin') ||
    url.includes('supabase.co') || 
    url.includes('google-analytics.com') || 
    url.includes('googletagmanager.com') || 
    url.includes('firestore.googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
