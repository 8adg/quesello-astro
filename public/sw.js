const CACHE_NAME = 'quesello-pwa-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/iconos/92.png',
        '/iconos/144.png',
        '/iconos/192.png',
        '/iconos/512.png',
        '/logo.svg'
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

self.addEventListener('fetch', (event) => {
  // Solo procesar solicitudes GET
  if (event.request.method !== 'GET') return;

  // No cachear llamadas a APIs o servicios externos
  const url = event.request.url;
  if (
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
        // Clonar y guardar en caché solo si es una respuesta de nuestro origen
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback al caché si no hay internet (offline)
        return caches.match(event.request);
      })
  );
});
