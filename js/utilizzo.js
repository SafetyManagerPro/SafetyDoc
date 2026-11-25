// Dati di utilizzo anonimi (fase A). Si inviano SOLO se l'utente ha detto sì.
// Nessun nome, nessun dato dell'impresa o dei lavoratori: un codice casuale del dispositivo, la versione,
// il tipo di dispositivo, la divisione ATECO (2 cifre), la fascia di lavoratori e quali schermate e documenti si usano.
// I dati vanno nello schema «safetydoc» del progetto Supabase SafetyManagerPro tramite la funzione
// public.safetydoc_registra, che può solo scrivere (vedi supabase/migrations).

export const SUPABASE_URL = 'https://gblcedkfnasqlnrxupzx.supabase.co';
// Chiave pubblica (ruolo anon): non è segreta, la protezione sta nelle regole del database.
export const SUPABASE_CHIAVE_PUBBLICA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdibGNlZGtmbmFzcWxucnh1cHp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDU3NzksImV4cCI6MjA5NzMyMTc3OX0.KKt8nVCPnYsdHBITY0w901CvLweIVdmxJWVgEVCPDNs';

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

async function rpc(funzione, corpo, fetchFn = fetch) {
  const r = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/${funzione}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_CHIAVE_PUBBLICA, Authorization: `Bearer ${SUPABASE_CHIAVE_PUBBLICA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    keepalive: true
  });
  if (!r.ok) throw new Error(`Invio non riuscito (${r.status})`);
}

export const invia = (dati, fetchFn) => rpc('safetydoc_registra', { dati }, fetchFn);
export const cancellaDati = (id, fetchFn) => rpc('safetydoc_cancella', { id }, fetchFn);
