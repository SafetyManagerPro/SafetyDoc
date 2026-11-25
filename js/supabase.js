// Collegamento al progetto Supabase SafetyManagerPro (schema separato «safetydoc»), senza librerie esterne.
// La chiave è quella pubblica (ruolo anon): non è segreta, la protezione sta nelle regole del database.

export const SUPABASE_URL = 'https://gblcedkfnasqlnrxupzx.supabase.co';
export const SUPABASE_CHIAVE_PUBBLICA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdibGNlZGtmbmFzcWxucnh1cHp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDU3NzksImV4cCI6MjA5NzMyMTc3OX0.KKt8nVCPnYsdHBITY0w901CvLweIVdmxJWVgEVCPDNs';

export class ErroreSupabase extends Error {
  constructor(messaggio, stato, codice) {
    super(messaggio);
    this.stato = stato;
    this.codice = codice;
  }
}

/** Chiama una funzione del database (rpc). Con accessToken agisce come l'utente collegato (amministratore). */
export async function rpc(funzione, corpo = {}, { accessToken, fetchFn = fetch, timeoutMs = 10000 } = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const r = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/${funzione}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_CHIAVE_PUBBLICA, Authorization: `Bearer ${accessToken || SUPABASE_CHIAVE_PUBBLICA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      keepalive: true,
      signal: ctrl?.signal
    });
    const testo = await r.text();
    const dati = testo ? JSON.parse(testo) : null;
    if (!r.ok) throw new ErroreSupabase(dati?.message || `Errore ${r.status}`, r.status, dati?.code);
    return dati;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Accesso dell'amministratore con email e password (Supabase Auth). */
export async function accedi(email, password, fetchFn = fetch) {
  return sessione(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { email, password }, fetchFn);
}

export async function rinnova(refreshToken, fetchFn = fetch) {
  return sessione(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { refresh_token: refreshToken }, fetchFn);
}

async function sessione(url, corpo, fetchFn) {
  const r = await fetchFn(url, { method: 'POST', headers: { apikey: SUPABASE_CHIAVE_PUBBLICA, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErroreSupabase(d.error_description || d.msg || d.message || 'Accesso non riuscito', r.status, d.error_code || d.error);
  return { accessToken: d.access_token, refreshToken: d.refresh_token, scade: Date.now() + (Number(d.expires_in) || 3600) * 1000, email: d.user?.email || '' };
}
