// Cifratura dei backup con password, tutta nel browser (Web Crypto).
// AES-GCM 256 con chiave derivata da PBKDF2-SHA256.

import { FORMATO_CIFRATO } from './merge.js';

const ITERAZIONI = 310000;

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}
const daB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function chiave(password, salt, iterazioni) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iterazioni, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function cifra(oggetto, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await chiave(password, salt, ITERAZIONI);
  const dati = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(oggetto)));
  return { formato: FORMATO_CIFRATO, algoritmo: 'AES-GCM-256/PBKDF2-SHA256', iterazioni: ITERAZIONI, salt: b64(salt), iv: b64(iv), dati: b64(dati) };
}

export async function decifra(pacchetto, password) {
  try {
    const k = await chiave(password, daB64(pacchetto.salt), pacchetto.iterazioni || ITERAZIONI);
    const chiaro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daB64(pacchetto.iv) }, k, daB64(pacchetto.dati));
    return JSON.parse(new TextDecoder().decode(chiaro));
  } catch {
    throw new Error('Password sbagliata o file danneggiato.');
  }
}
