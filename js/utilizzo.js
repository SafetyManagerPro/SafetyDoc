// Dati di utilizzo anonimi (fase A). Si inviano SOLO se l'utente ha detto sì.
// Nessun nome, nessun dato dell'impresa o dei lavoratori: un codice casuale del dispositivo, la versione,
// il tipo di dispositivo, la divisione ATECO (2 cifre), la fascia di lavoratori e quali schermate e documenti si usano.
// I dati vanno nello schema «safetydoc» del progetto Supabase SafetyManagerPro tramite la funzione
// public.safetydoc_registra, che può solo scrivere (vedi supabase/migrations).

import { rpc as chiamaRpc } from './supabase.js';
export { SUPABASE_URL, SUPABASE_CHIAVE_PUBBLICA } from './supabase.js';

export const TIPI_EVENTO = ['apertura', 'schermata', 'documento', 'promemoria', 'backup', 'ricerca', 'firma'];
export const MAX_CODA = 300;
export const MAX_PER_INVIO = 100;

/** Nome di schermata o documento ammesso dal database: minuscole, cifre, «:» e «-», al massimo 40 caratteri. */
export const nomePulito = (n) =>
  String(n ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9:-]/g, '')
    .slice(0, 40);

export function fasciaLavoratori(numero) {
  const n = Number(numero);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n <= 5) return '1-5';
  if (n <= 9) return '6-9';
  if (n <= 15) return '10-15';
  if (n <= 49) return '16-49';
  return '50+';
}

/** Divisione ATECO (prime due cifre), o null. */
export const divisioneAteco = (ateco) => {
  const m = String(ateco ?? '').match(/^\s*(\d{2})/);
  return m ? m[1] : null;
};

export function piattaforma(ua = '') {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/windows/i.test(ua)) return 'windows';
  if (/macintosh|mac os x/i.test(ua)) return 'mac';
  if (/linux/i.test(ua)) return 'linux';
  return 'altro';
}

/** Aggiunge un evento alla coda (senza duplicare la stessa schermata aperta due volte di fila). */
export function accoda(coda, tipo, nome, ora = new Date().toISOString()) {
  if (!TIPI_EVENTO.includes(tipo)) return coda;
  const e = { ts: ora, t: tipo, n: nomePulito(nome) };
  const ultimo = coda[coda.length - 1];
  if (ultimo && ultimo.t === e.t && ultimo.n === e.n && tipo === 'schermata') return coda;
  return [...coda, e].slice(-MAX_CODA);
}

/** Corpo dell'invio: dati del dispositivo e al massimo MAX_PER_INVIO eventi. */
export function pacchetto({ id, versione, ua, installata, ateco, numeroLavoratori, coda }) {
  return {
    id,
    versione: String(versione || '').slice(0, 20),
    piattaforma: piattaforma(ua),
    installata: Boolean(installata),
    ateco: divisioneAteco(ateco),
    fascia: fasciaLavoratori(numeroLavoratori),
    eventi: (coda || []).slice(0, MAX_PER_INVIO)
  };
}

const rpc = (funzione, corpo, fetchFn) => chiamaRpc(funzione, corpo, { fetchFn });

export const invia = (dati, fetchFn) => rpc('safetydoc_registra', { dati }, fetchFn);
export const cancellaDati = (id, fetchFn) => rpc('safetydoc_cancella', { id }, fetchFn);
