// Collegamento al servizio online (Supabase) con chiamate dirette: nessuna libreria esterna.
// Qui passano solo accesso, dispositivi e ticket. I dati dell'impresa restano nel dispositivo (store.js).

import { CONFIG } from './config.js';
import { tokenDaRinnovare, messaggioErrore } from './accesso.js';

const CHIAVE_SESSIONE = 'safetydoc-sessione';
const CHIAVE_ACCESSO = 'safetydoc-accesso';

const leggiLocale = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null');
  } catch {
    return null;
  }
};
const scriviLocale = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* memoria del browser non disponibile */
  }
};

export const sessione = () => leggiLocale(CHIAVE_SESSIONE);
export const accesso = () => leggiLocale(CHIAVE_ACCESSO);
export const salvaAccesso = (a) => scriviLocale(CHIAVE_ACCESSO, a);

export class ErroreCloud extends Error {
  constructor(messaggio, stato, dettaglio) {
    super(messaggio);
    this.stato = stato;
    this.dettaglio = dettaglio;
  }
}

async function chiama(percorso, { metodo = 'GET', corpo, token, intestazioni = {} } = {}) {
  let r;
  try {
    r = await fetch(CONFIG.supabaseUrl + percorso, {
      method: metodo,
      headers: {
        apikey: CONFIG.supabaseKey,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...intestazioni
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo)
    });
  } catch (e) {
    throw new ErroreCloud(messaggioErrore(e), 0);
  }
  const testo = await r.text();
  const dati = testo ? JSON.parse(testo) : null;
  if (!r.ok) throw new ErroreCloud(messaggioErrore(dati), r.status, dati);
  return dati;
}

function salvaSessione(d) {
  const s = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    user: { id: d.user?.id, email: d.user?.email }
  };
  scriviLocale(CHIAVE_SESSIONE, s);
  return s;
}

export async function accedi(email, password) {
  const d = await chiama('/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email: email.trim().toLowerCase(), password } });
  return salvaSessione(d);
}

/** Token valido, rinnovato se serve. Null se non c'è sessione o il rinnovo è rifiutato. */
export async function token() {
  const s = sessione();
  if (!s) return null;
  if (!tokenDaRinnovare(s)) return s.access_token;
  try {
    return salvaSessione(await chiama('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', corpo: { refresh_token: s.refresh_token } })).access_token;
  } catch (e) {
    if (e.stato >= 400 && e.stato < 500) scriviLocale(CHIAVE_SESSIONE, null);
    throw e;
  }
}

export async function esci() {
  const s = sessione();
  scriviLocale(CHIAVE_SESSIONE, null);
  scriviLocale(CHIAVE_ACCESSO, null);
  if (s) await chiama('/auth/v1/logout', { metodo: 'POST', token: s.access_token }).catch(() => {});
}

async function conToken(percorso, opzioni = {}) {
  const t = await token();
  if (!t) throw new ErroreCloud('Accedi di nuovo con il tuo account.', 401);
  return chiama(percorso, { ...opzioni, token: t });
}

export const rpc = (nome, argomenti = {}) => conToken(`/rest/v1/rpc/${nome}`, { metodo: 'POST', corpo: argomenti });

/** Impronta del dispositivo: hash dell'identificativo casuale della postazione. */
export async function impronta(idPostazione) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`safetydoc:${idPostazione}`));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function nomeDispositivo() {
  const ua = navigator.userAgent;
  const sistema = /iphone|ipad/i.test(ua) ? 'iPhone/iPad' : /android/i.test(ua) ? 'Android' : /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'Mac' : 'Altro';
  const browser = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'browser';
  return `${sistema} · ${browser}`;
}

// ---------- ticket ----------

const sel = 'id,argomento,scheda_id,stato,impresa,contatto,user_email,contesto,created_at,updated_at';

export const ticketMiei = () => conToken(`/rest/v1/sd_tickets?select=${sel}&order=updated_at.desc&limit=100`);

/** Per gli operatori: tutti i ticket, quelli in attesa per primi. */
export const ticketTutti = (stato) =>
  conToken(`/rest/v1/sd_tickets?select=${sel}${stato ? `&stato=eq.${encodeURIComponent(stato)}` : ''}&order=updated_at.desc&limit=200`);

export async function ticket(id) {
  const [t] = await conToken(`/rest/v1/sd_tickets?select=${sel}&id=eq.${encodeURIComponent(id)}`);
  if (!t) return null;
  t.messaggi = await conToken(`/rest/v1/sd_ticket_messaggi?select=id,testo,da_operatore,created_at&ticket_id=eq.${encodeURIComponent(id)}&order=created_at.asc`);
  return t;
}

export async function apriTicket({ argomento, testo, schedaId, impresa, contatto, contesto }) {
  const [t] = await conToken('/rest/v1/sd_tickets', {
    metodo: 'POST',
    corpo: { argomento, scheda_id: schedaId || null, impresa: impresa || null, contatto: contatto || null, contesto: contesto || {} },
    intestazioni: { Prefer: 'return=representation' }
  });
  await scriviMessaggio(t.id, testo);
  return t;
}

export const scriviMessaggio = (ticketId, testo) =>
  conToken('/rest/v1/sd_ticket_messaggi', { metodo: 'POST', corpo: { ticket_id: ticketId, testo }, intestazioni: { Prefer: 'return=minimal' } });

export const impostaStato = (ticketId, stato) => rpc('sd_imposta_stato_ticket', { p_ticket: ticketId, p_stato: stato });
