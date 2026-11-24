// Regole di accesso e contesto dei ticket. Modulo puro: testabile con Node.

/** Si può usare l'app senza connessione? Solo se l'ultimo controllo riuscito è abbastanza recente. */
export function accessoOfflineValido(accesso, adesso = new Date(), giorni = 30) {
  if (!accesso?.userId || !accesso.ultimoOk) return false;
  const passati = (adesso.getTime() - Date.parse(accesso.ultimoOk)) / 86400000;
  return passati >= 0 && passati <= giorni;
}

/** Il token va rinnovato se scade entro un minuto. */
export function tokenDaRinnovare(sessione, adessoSec = Date.now() / 1000) {
  return !sessione?.expires_at || sessione.expires_at - adessoSec < 60;
}

/** Messaggi d'errore del servizio di accesso in italiano semplice. */
export function messaggioErrore(e) {
  const t = String(e?.message || e?.error_description || e?.msg || e || '').toLowerCase();
  if (t.includes('invalid login credentials') || t.includes('invalid_grant')) return 'Email o password non corretti.';
  if (t.includes('email not confirmed')) return "L'email non è ancora stata confermata: controlla la posta.";
  if (t.includes('failed to fetch') || t.includes('network')) return 'Connessione assente. Riprova quando sei online.';
  if (t.includes('rate limit') || t.includes('too many')) return 'Troppi tentativi. Aspetta qualche minuto e riprova.';
  return 'Non è stato possibile completare l’operazione. Riprova più tardi.';
}

/**
 * Contesto allegato a un ticket: aiuta l'operatore a rispondere senza chiedere tutto da capo.
 * Contiene solo dati dell'impresa, mai nomi dei lavoratori o dati sanitari.
 */
export function contestoTicket({ fatti, risposte, scheda, voce, versioneApp }) {
  const f = fatti || {};
  const c = {
    versioneApp,
    ateco: f.ateco ? `${f.ateco.codice} ${f.ateco.descrizione}` : null,
    classeRischio: f.classeRischio || null,
    lavoratori: f.lavoratori ?? null,
    composizione: risposte?.composizione || null,
    attivita: risposte?.attivita || null
  };
  if (scheda) {
    c.scheda = scheda.titolo;
    if (voce) c.statoVoce = voce.motivo + (voce.prossimaScadenza ? ` (scadenza ${voce.prossimaScadenza})` : '');
  }
  for (const k of Object.keys(c)) if (c[k] === null || c[k] === undefined || c[k] === '') delete c[k];
  return c;
}

export const STATI_TICKET = {
  aperto: 'In attesa di risposta',
  risposto: 'Risposta ricevuta',
  chiuso: 'Chiuso'
};
