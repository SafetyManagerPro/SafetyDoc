// Account dell'impresa: attivazione con il link mandato dall'amministratore, verifica giornaliera, blocco.
// Modulo puro (le chiamate al database sono in supabase.js), testabile con Node.

/** Senza connessione l'app resta usabile per 24 ore dall'ultima verifica riuscita (scelta del 25/11/2026). */
export const GRAZIA_MS = 24 * 60 * 60 * 1000;
/** Con connessione si riverifica al massimo ogni 10 minuti (aperture e cambi di schermata). */
export const RIVERIFICA_MS = 10 * 60 * 1000;

/** Rotte usabili anche senza account attivo. */
export const ROTTE_LIBERE = new Set(['invito', 'admin', 'termini']);

/**
 * Decide se l'app è usabile.
 * account: { dispositivo, chiave, verificatoIl (ms), stato: 'attivo'|'sospeso'|'bloccato', motivo }
 * adminValido: sessione dell'amministratore valida su questo dispositivo
 * Restituisce 'ok' | 'attivazione' | 'bloccato' | 'serve-rete'.
 */
export function decidiAccesso({ account, adminValido = false, adesso = Date.now() }) {
  if (adminValido) return 'ok';
  if (!account?.chiave) return 'attivazione';
  if (account.stato === 'sospeso' || account.stato === 'bloccato') return 'bloccato';
  if (!account.verificatoIl || adesso - account.verificatoIl > GRAZIA_MS) return 'serve-rete';
  return 'ok';
}

/** Serve una nuova verifica con il server? */
export const daRiverificare = (account, adesso = Date.now()) => !account?.controllatoIl || adesso - account.controllatoIl > RIVERIFICA_MS;

/** Aggiorna l'account con l'esito della verifica (null = server non raggiungibile). */
export function applicaVerifica(account, esito, adesso = Date.now()) {
  if (!esito) return { ...account, controllatoIl: adesso };
  if (esito.stato === 'sconosciuto') return null; // dispositivo eliminato dall'amministratore: va riattivato
  return {
    ...account,
    stato: esito.stato,
    motivo: esito.motivo || '',
    impresa: esito.impresa || account.impresa,
    risposte: Number(esito.risposte_da_leggere) || 0,
    controllatoIl: adesso,
    verificatoIl: esito.stato === 'attivo' ? adesso : account.verificatoIl
  };
}

/** Messaggio leggibile per gli errori di attivazione restituiti dal database. */
export function erroreAttivazione(messaggio = '') {
  if (/link non valido/.test(messaggio)) return 'Questo link non è più valido: chiedi un nuovo link di attivazione.';
  if (/impresa sospesa/.test(messaggio)) return 'L\'accesso di questa impresa è sospeso.';
  if (/termini/.test(messaggio)) return 'Per continuare devi accettare termini d\'uso e informativa.';
  if (/troppi dispositivi/.test(messaggio)) return 'È stato raggiunto il numero massimo di dispositivi per questa impresa: chiedi all\'amministratore.';
  if (/check constraint|violates/.test(messaggio)) return 'Controlla i dati: partita IVA di 11 cifre, provincia di 2 lettere (es. AV).';
  return 'Attivazione non riuscita: controlla la connessione e riprova.';
}

/** Dati dell'impresa inseriti nel modulo di attivazione, ripuliti. */
export function datiAttivazione(form) {
  const t = (k) => String(form[k] ?? '').trim();
  return {
    ragione_sociale: t('ragione_sociale'),
    partita_iva: t('partita_iva').replace(/\D/g, ''),
    codice_fiscale: t('codice_fiscale').toUpperCase(),
    ateco: t('ateco'),
    comune: t('comune'),
    provincia: t('provincia').toUpperCase(),
    email: t('email'),
    telefono: t('telefono'),
    referente: t('referente'),
    termini: Boolean(form.termini)
  };
}

/** Controlli del modulo prima dell'invio. */
export function erroriAttivazione(d) {
  const e = [];
  if (d.ragione_sociale.length < 2) e.push('Scrivi la ragione sociale.');
  if (d.partita_iva && !/^\d{11}$/.test(d.partita_iva)) e.push('La partita IVA ha 11 cifre.');
  if (d.provincia && !/^[A-Z]{2}$/.test(d.provincia)) e.push('La provincia va scritta con 2 lettere (es. AV).');
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) e.push('Controlla l\'indirizzo email.');
  if (!d.termini) e.push('Devi accettare termini d\'uso e informativa.');
  return e;
}

// ---------- amministrazione ----------

export const linkInvito = (token, base) => `${String(base).replace(/#.*$/, '').replace(/\/?$/, '/')}#/invito/${token}`;

/** Numero in formato internazionale per wa.me (prefisso italiano se manca). */
export function numeroWhatsApp(t) {
  const n = String(t || '').replace(/[^\d+]/g, '');
  if (n.startsWith('+')) return n.slice(1);
  if (n.startsWith('00')) return n.slice(2);
  return n.startsWith('39') && n.length > 10 ? n : `39${n}`;
}

export function messaggioInvito(impresa, link) {
  return `Ciao${impresa?.referente ? ` ${impresa.referente}` : ''}, ecco il link per attivare safetyDoc${impresa?.ragione_sociale ? ` per ${impresa.ragione_sociale}` : ''}:\n${link}\n\nAprilo dal telefono o dal computer che userai: ti chiederà di confermare i dati dell'impresa. Se lo perdi, scrivimi e te ne mando uno nuovo.`;
}

export const urlWhatsApp = (telefono, testo) => `https://wa.me/${telefono ? numeroWhatsApp(telefono) : ''}?text=${encodeURIComponent(testo)}`;

const cella = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV (separatore «;», per Excel in italiano) con una riga per impresa. */
export function csvImprese(imprese) {
  const colonne = ['ragione_sociale', 'partita_iva', 'codice_fiscale', 'ateco', 'comune', 'provincia', 'email', 'telefono', 'referente', 'stato', 'motivo_sospensione', 'creata_il', 'termini_accettati_il', 'ultimo_accesso', 'accessi_30', 'dispositivi', 'note'];
  const righe = (imprese || []).map((m) => colonne.map((c) => cella(c === 'dispositivi' ? (m.dispositivi || []).length : m[c])).join(';'));
  return `﻿${colonne.join(';')}\n${righe.join('\n')}\n`;
}

/** Sessione dell'amministratore ancora valida (con margine di un minuto). */
export const sessioneValida = (s, adesso = Date.now()) => Boolean(s?.accessToken) && s.scade - 60000 > adesso;
