/**
 * Service Worker: offline caching for Report UAV PWA.
 * Сервісний воркер: кешування для офлайн-роботи PWA.
 *
 * Install: caches all ASSETS. Fetch: serve from cache, fallback to network.
 * Встановлення: кешує всі ASSETS. Fetch: віддає з кешу, інакше — мережа.
 */
const CACHE_NAME = 'uav-report-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './config.json',
  './icon.png',
  './js/app.js',
  './js/constants.js',
  './js/utils.js',
  './js/counter.js',
  './js/coords.js',
  './js/clipboard.js',
  './js/config.js',
  './js/history.js',
  './js/longPressEdit.js',
  './js/generate.js'
];

// Install: cache all assets / Установка: кешуємо всі ресурси
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Fetch: serve from cache, then network / Запити: спочатку кеш, потім мережа
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
