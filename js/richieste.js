// Richieste delle imprese (ticket): tipi, stati, controlli e testi. Modulo puro, testabile con Node.

export const TIPI_RICHIESTA = {
  aiuto: 'Ho bisogno di aiuto',
  informazione: 'Richiesta di informazioni',
  errore: 'Qualcosa non funziona',
  modifica: 'Richiesta di modifica',
  miglioria: 'Proposta di miglioramento'
};

export const STATI_RICHIESTA = {
  aperta: ['giallo', 'In attesa di risposta'],
  in_lavorazione: ['info', 'In lavorazione'],
  risposta: ['verde', 'Risposta ricevuta'],
  chiusa: ['grigio', 'Chiusa']
};

/** Dati del modulo di una nuova richiesta, ripuliti. */
export function datiRichiesta(form) {
  const t = (k) => String(form[k] ?? '').trim();
  return { tipo: t('tipo'), oggetto: t('oggetto').slice(0, 140), testo: t('testo').slice(0, 4000), schermata: t('schermata').slice(0, 60) };
}

export function erroriRichiesta(d) {
  const e = [];
  if (!TIPI_RICHIESTA[d.tipo]) e.push('Scegli il tipo di richiesta.');
  if (d.oggetto.length < 3) e.push('Scrivi un oggetto di almeno 3 caratteri.');
  if (d.testo.length < 5) e.push('Descrivi la richiesta.');
  return e;
}

/** Messaggio leggibile per gli errori del database. */
export function erroreRichiesta(e) {
  const m = e?.message || '';
  if (e?.codice === 'PGRST202' || e?.stato === 404) return 'Il servizio richieste non è ancora attivo: riprova più tardi.';
  if (/dispositivo non attivo/.test(m)) return 'Questo dispositivo non è attivo: controlla l\'attivazione.';
  if (/troppe richieste|troppi messaggi/.test(m)) return 'Hai inviato molte richieste oggi: riprova domani.';
  if (/richiesta non trovata/.test(m)) return 'Richiesta non trovata.';
  return 'Invio non riuscito: controlla la connessione e riprova.';
}

/** Richieste con risposte non ancora lette (dal punto di vista di chi legge). */
export const daLeggere = (richieste) => (richieste || []).filter((r) => r.letta === false).length;

/** Testo per avvisare l'impresa su WhatsApp che c'è una risposta. */
export function avvisoRisposta(r) {
  return `Ciao${r?.impresa?.referente ? ` ${r.impresa.referente}` : ''}, ho risposto alla tua richiesta n. ${r?.numero} «${r?.oggetto}» su safetyDoc. La trovi in Dati → Richieste e assistenza.`;
}
