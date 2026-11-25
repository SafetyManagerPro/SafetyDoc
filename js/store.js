// Strato dati di safetyDoc.
// Oggi salva nel database del browser (IndexedDB). In futuro questo è l'unico file
// da sostituire per passare a Supabase: il resto dell'app usa solo queste funzioni.

const DB_NOME = 'safetydoc';
const DB_VERSIONE = 5;
const STORES = ['profilo', 'adempimenti', 'lavoratori', 'registri', 'attrezzature', 'controlli', 'prodotti', 'eventi', 'archivio', 'allegati', 'meta'];
export const ID_PROFILO = 'profilo-impresa';

let dbPromise;

function apri() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NOME, DB_VERSIONE);
      req.onupgradeneeded = () => {
        for (const nome of STORES) {
          if (!req.result.objectStoreNames.contains(nome)) {
            req.result.createObjectStore(nome, { keyPath: 'id' });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function op(store, modo, fn) {
  const db = await apri();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, modo);
    const risultato = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(risultato?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const tutti = (store) => op(store, 'readonly', (s) => s.getAll());
export const leggi = (store, id) => op(store, 'readonly', (s) => s.get(id));
const scrivi = (store, record) => op(store, 'readwrite', (s) => s.put(record));

export async function scriviMolti(store, records) {
  const db = await apri();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    for (const r of records) tx.objectStore(store).put(r);
    tx.oncomplete = () => resolve(records.length);
    tx.onerror = () => reject(tx.error);
  });
}

export function nuovoId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Identificativo di questa postazione, creato una sola volta. */
export async function idPostazione() {
  const meta = await leggi('meta', 'postazione');
  if (meta) return meta.valore;
  const valore = nuovoId();
  await scrivi('meta', { id: 'postazione', valore });
  return valore;
}

async function timbra(record) {
  return { ...record, updatedAt: new Date().toISOString(), deviceId: await idPostazione() };
}

export async function leggiProfilo() {
  return (await leggi('profilo', ID_PROFILO)) || { id: ID_PROFILO, risposte: {}, deleted: false };
}

export async function salvaRisposte(risposte) {
  const profilo = await leggiProfilo();
  await scrivi('profilo', await timbra({ ...profilo, risposte, deleted: false }));
}

export async function salvaAdempimento(record) {
  const base = record.id ? record : { ...record, id: nuovoId(), deleted: false };
  const timbrato = await timbra(base);
  await scrivi('adempimenti', timbrato);
  return timbrato;
}

/** Le cancellazioni non cancellano: il record resta, segnato come eliminato. */
export async function eliminaAdempimento(record) {
  await scrivi('adempimenti', await timbra({ ...record, deleted: true }));
}

/** Salva un record di una collezione qualsiasi (lavoratori, registri), con id, data e postazione. */
export async function salva(store, record) {
  const base = record.id ? record : { ...record, id: nuovoId(), deleted: false };
  const timbrato = await timbra(base);
  await scrivi(store, timbrato);
  return timbrato;
}

export async function elimina(store, record) {
  await scrivi(store, await timbra({ ...record, deleted: true }));
}

export async function salvaAnagrafica(anagrafica) {
  const profilo = await leggiProfilo();
  await scrivi('profilo', await timbra({ ...profilo, anagrafica, deleted: false }));
}

/** Recapito di chi aiuta l'impresa (consulente, associazione): nome, telefono, whatsapp, email. */
export async function salvaConsulente(consulente) {
  const profilo = await leggiProfilo();
  await scrivi('profilo', await timbra({ ...profilo, consulente, deleted: false }));
}

/** Chi riceve i promemoria delle scadenze (RSPP, consulente o datore di lavoro). */
export async function salvaResponsabile(responsabile) {
  const profilo = await leggiProfilo();
  await scrivi('profilo', await timbra({ ...profilo, responsabile, deleted: false }));
}

export async function leggiMeta(chiave) {
  return (await leggi('meta', chiave))?.valore;
}

export async function scriviMeta(chiave, valore) {
  await scrivi('meta', { id: chiave, valore });
}

/** Chiede al browser di non cancellare i dati quando lo spazio scarseggia. */
export async function chiediMemoriaPersistente() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* non supportato */
  }
  return false;
}
