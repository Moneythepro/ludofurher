const CACHE = 'ludo-lite-v1';
const toCache = ['.','index.html','styles.css','app.js','manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(toCache))); });
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(resp => resp || fetch(e.request)));
});
