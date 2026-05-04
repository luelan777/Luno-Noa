const CACHE_NAME = 'luno-pwa-v2';
const RUNTIME_CACHE = 'luno-runtime-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
                console.log('Cache addAll error:', err);
                return Promise.resolve();
            });
        }).then(() => {
            self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            self.clients.claim();
        })
    );
});

// Fetch event - network first for API, cache first for static
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    if (!url.protocol.startsWith('http')) return;

    // API requests - network first
    if (url.pathname.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const responseToCache = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then((cachedResponse) => {
                        return cachedResponse || new Response(
                            JSON.stringify({ error: 'Offline - sin respuesta en caché' }),
                            { status: 503, statusText: 'Service Unavailable', headers: new Headers({ 'Content-Type': 'application/json' }) }
                        );
                    });
                })
        );
        return;
    }

    // Static assets - network first with cache fallback (to avoid stale UI)
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(request).then((cachedResponse) => {
                    return cachedResponse || new Response(
                        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Offline</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0d0f1a;color:#ede8f5;"><div style="text-align:center;"><h1>Sin Conexión</h1><p>Revisa tu conexión e intenta de nuevo.</p></div></body></html>',
                        { status: 503, statusText: 'Service Unavailable', headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }) }
                    );
                });
            })
    );
});

// Background sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-messages') {
        event.waitUntil(Promise.resolve());
    }
});

// Push notifications
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'Nuevo mensaje de Noa 💕',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><circle cx="96" cy="96" r="90" fill="%23e8559a"/></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="45" fill="%23e8559a"/></svg>',
            tag: 'noa-notification',
            requireInteraction: false,
            actions: [
                { action: 'open', title: 'Abrir' },
                { action: 'close', title: 'Cerrar' }
            ]
        };

        event.waitUntil(
            self.registration.showNotification('Noa', options)
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if ('focus' in client) return client.focus();
                }
                if (clients.openWindow) return clients.openWindow('./');
            })
        );
    }
});

// Message handling
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
