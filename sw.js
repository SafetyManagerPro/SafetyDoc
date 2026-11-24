// Service worker: rende safetyDoc un'app installabile che funziona anche senza connessione.
// Cambiare VERSIONE a ogni rilascio: i file vengono scaricati di nuovo e la vecchia cache eliminata.
// Il test test/pwa.test.js controlla che qui ci siano tutti i file usati dall'app.
const VERSIONE = 'safetydoc-v0.15.0';

const FILE = [
  './',
  'index.html',
  'manifest.webmanifest',
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
  'js/lingue.js',
  'js/calcoli.js',
  'js/vendor/pdfjs/pdf.min.mjs',
  'js/vendor/pdfjs/pdf.worker.min.mjs',
  'data/questionario.json',
  'data/catalogo.json',
  'data/lavoratori.json',
  'data/dvr.json',
  'data/ateco.json',
  'data/attrezzature.json',
  'data/settori.json',
  'data/lavorazioni.json',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

// Oltre questo tempo senza risposta dalla rete si usa la copia salvata (connessione lenta o instabile).
const ATTESA_RETE_MS = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSIONE)
      .then((c) => c.addAll(FILE.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k.startsWith('safetydoc-') && k !== VERSIONE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function conTempoMassimo(promessa, ms) {
  return new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error('tempo scaduto')), ms);
    promessa.then(
      (r) => {
        clearTimeout(t);
        ok(r);
      },
      (err) => {
        clearTimeout(t);
        ko(err);
      }
    );
  });
}

// Rete prima (così app e catalogo restano aggiornati), copia salvata se la rete manca o è troppo lenta.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const pagina = req.mode === 'navigate';
  const dallaRete = fetch(req).then((risposta) => {
    if (risposta.ok && risposta.type === 'basic') {
      const copia = risposta.clone();
      caches.open(VERSIONE).then((c) => c.put(pagina ? 'index.html' : req, copia));
    }
    return risposta;
  });
  e.respondWith(
    conTempoMassimo(dallaRete, ATTESA_RETE_MS)
      .catch(async () => (await caches.match(pagina ? 'index.html' : req, { ignoreSearch: pagina })) || dallaRete)
      .catch(async () => (pagina ? caches.match('index.html') : Response.error()))
  );
  e.waitUntil(dallaRete.catch(() => {}));
});

self.addEventListener('message', (e) => {
  if (e.data === 'versione') e.source?.postMessage({ versione: VERSIONE });
});
