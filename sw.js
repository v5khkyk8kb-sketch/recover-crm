/* Service worker mínimo: hace instalable la app y guarda la "carcasa" (HTML, JS, CSS, logo) para abrir rápido.
   NUNCA guarda datos: todo lo que no sea de esta misma página (Supabase, Google, CDN) va directo a la red.
   Estrategia: primero la red (así siempre ves la última versión); si no hay conexión, usa lo guardado. */
const VERSION = 'recover-crm-v1';
const CARCASA = ['./', 'index.html', 'app.js', 'ui.js', 'secciones.js', 'styles.css', 'logo.png', 'manifest.webmanifest', 'icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CARCASA)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/data/')) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
