const CACHE_NAME = 'vision-guide-v1';

// Initial cache of the shell and external CDNs
const PRECACHE_URLS = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  // Network-First strategy with Dynamic Caching
  // This ensures we get the latest 'hashed' JS files from the server, 
  // but save them to cache for offline use immediately.
  
  // Skip cross-origin requests that aren't in our precache list (optional safety)
  // but for simplicity, we try to cache everything that returns 200 OK.
  
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // If network fetch works, cache it and return it
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        
        // Clone the response because it can only be consumed once
        const responseToCache = networkResponse.clone();
        
        caches.open(CACHE_NAME).then(cache => {
          // Don't cache POST requests or API calls if we had them
          if (event.request.method === 'GET') {
             try {
                cache.put(event.request, responseToCache);
             } catch (err) {
                // Ignore cache errors (e.g. quota exceeded)
             }
          }
        });
        
        return networkResponse;
      })
      .catch(() => {
        // If network fails (offline), return from cache
        return caches.match(event.request);
      })
  );
});