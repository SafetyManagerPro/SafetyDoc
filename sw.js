// Service worker: rende safetyDoc un'app installabile che funziona anche senza connessione.
// Cambiare VERSIONE a ogni rilascio: i file vengono scaricati di nuovo e la vecchia cache eliminata.
// Il test test/pwa.test.js controlla che qui ci siano tutti i file usati dall'app.
const VERSIONE = 'safetydoc-v0.20.0';

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
  'js/date.js',
  'js/conoscenza.js',
  'js/scadenzario.js',
  'js/utilizzo.js',
  'js/supabase.js',
  'js/account.js',
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
  'data/archivio.json',
  'data/conoscenza.json',
  'data/legale.json',
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

// ---------- promemoria delle scadenze ad app chiusa ----------
// Con l'app installata, Chrome su Android può svegliare il service worker una volta al giorno
// (periodic background sync). L'app salva in «meta» l'elenco delle scadenze senza nomi di persone;
// qui si confronta con la data di oggi e si mostra una notifica a 30 giorni, a 7 giorni e alla scadenza.

const SOGLIE = [30, 7, 0];

function leggiMetaSw(db, chiave) {
  return new Promise((ok) => {
    const r = db.transaction('meta').objectStore('meta').get(chiave);
    r.onsuccess = () => ok(r.result?.valore);
    r.onerror = () => ok(undefined);
  });
}

function scriviMetaSw(db, chiave, valore) {
  return new Promise((ok) => {
    const t = db.transaction('meta', 'readwrite');
    t.objectStore('meta').put({ id: chiave, valore });
    t.oncomplete = ok;
    t.onerror = ok;
  });
}

async function apriDbSw() {
  if (indexedDB.databases) {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === 'safetydoc')) return null; // non creare un database vuoto
  }
  return new Promise((ok) => {
    const r = indexedDB.open('safetydoc');
    r.onsuccess = () => (r.result.objectStoreNames.contains('meta') ? ok(r.result) : (r.result.close(), ok(null)));
    r.onerror = () => ok(null);
    r.onupgradeneeded = () => r.transaction.abort();
  });
}

const oggiSw = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const giorniSw = (da, a) => Math.round((Date.parse(a) - Date.parse(da)) / 86400000);
const leggibileSw = (iso) => iso.split('-').reverse().join('/');

async function controllaScadenzeSw() {
  const db = await apriDbSw();
  if (!db) return;
  try {
    const lista = (await leggiMetaSw(db, 'scadenzario:prossime')) || [];
    const notificate = new Set((await leggiMetaSw(db, 'scadenzario:notificate')) || []);
    const oggi = oggiSw();
    const nuove = [];
    for (const x of lista) {
      const g = giorniSw(oggi, x.data);
      const soglia = SOGLIE.filter((s) => g <= s).pop();
      if (soglia === undefined) continue;
      const chiave = `${x.id}|${soglia}|${x.data}`;
      if (!notificate.has(chiave)) nuove.push({ x, g, chiave });
    }
    if (!nuove.length) return;
    const superate = nuove.filter((n) => n.g < 0).length;
    const titolo = nuove.length === 1 ? (nuove[0].g < 0 ? 'Scadenza superata' : nuove[0].g === 0 ? 'Scade oggi' : `Scade tra ${nuove[0].g} giorni`) : `${nuove.length} scadenze sulla sicurezza${superate ? ` (${superate} superate)` : ''}`;
    const corpo = nuove.slice(0, 4).map((n) => `${leggibileSw(n.x.data)} · ${n.x.riservato}`).join('\n') + (nuove.length > 4 ? `\n…e altre ${nuove.length - 4}` : '');
    await self.registration.showNotification(titolo, { body: corpo, tag: 'safetydoc-scadenze', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: '#/scadenzario' } });
    await scriviMetaSw(db, 'scadenzario:notificate', [...notificate, ...nuove.map((n) => n.chiave)].slice(-500));
  } finally {
    db.close();
  }
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'scadenze') e.waitUntil(controllaScadenzeSw());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '#/scadenzario', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((finestre) => {
      const f = finestre[0];
      if (f) return f.navigate(url).then((x) => (x || f).focus());
      return self.clients.openWindow(url);
    })
  );
});
