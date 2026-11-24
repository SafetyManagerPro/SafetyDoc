// Service worker: rende l'app utilizzabile anche senza connessione.
// Cambiare VERSIONE a ogni rilascio per aggiornare i file in cache.
const VERSIONE = 'safetydoc-v0.10.0';
const FILE = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/engine.js',
  'js/merge.js',
  'js/store.js',
  'js/cifratura.js',
  'js/modelli.js',
  'js/calendario.js',
  'js/allegati.js',
  'js/aiuto.js',
  'data/questionario.json',
  'data/catalogo.json',
  'data/lavoratori.json',
  'data/dvr.json',
  'data/ateco.json',
  'data/attrezzature.json',
  'data/settori.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== VERSIONE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rete prima, cache come riserva: così catalogo e app restano aggiornati quando c'è connessione.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((risposta) => {
        const copia = risposta.clone();
        caches.open(VERSIONE).then((c) => c.put(e.request, copia));
        return risposta;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
