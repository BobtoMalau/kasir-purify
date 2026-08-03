const CACHE_NAME = 'purify-cashier-v1';
const CACHE_NAME = 'purify-cashier-v2'; // Ubah v1 menjadi v2 agar sistem tahu ada update
const urlsToCache = [
  '/kasir-purify/',
  '/kasir-purify/index.html',
  '/kasir-purify/style.css',
  '/kasir-purify/script.js',
  '/kasir-purify/manifest.json'
];

// Proses Install: Menyimpan file ke cache (penyimpanan offline)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Proses Fetch: Mengambil data dari cache jika offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Gunakan file offline
        }
        return fetch(event.request); // Ambil dari internet jika ada
      })
  );
});
