// Scadenzario: raccoglie in un unico elenco tutte le scadenze dell'impresa (adempimenti, lavoratori,
// attrezzature, certificati in archivio, revisioni dei documenti, denunce INAIL), le calcola secondo la
// norma di riferimento e prepara promemoria e notifiche per il responsabile. Modulo puro, testabile con Node.

import { aggiungiMesi, situazioneEvento, eventiAttivi, archivioAttuale } from './engine.js';

export const SOGLIE_NOTIFICA = [30, 7, 0];

export function aggiungiGiorni(iso, giorni) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

export const giorniTra = (da, a) => Math.round((Date.parse(a.slice(0, 10)) - Date.parse(da.slice(0, 10))) / 86400000);

const leggibile = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

// ---------- certificati in archivio ----------

/** Durata normativa scelta per un tipo di certificato (la prima se non indicata). */
export function durataArchivio(tipoDef, idDurata) {
  const durate = tipoDef?.durate || [];
  return durate.find((d) => d.id === idDurata) || durate[0] || null;
}

/** Scadenza calcolata di un certificato dalla data di rilascio e dalla durata prevista dalla norma. */
export function scadenzaArchivio(tipoDef, dataRilascio, idDurata) {
  const d = durataArchivio(tipoDef, idDurata);
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(dataRilascio || '')) return null;
  const scadenza = d.giorni ? aggiungiGiorni(dataRilascio, d.giorni) : aggiungiMesi(dataRilascio, d.mesi);
  return { scadenza, durata: d };
}

// ---------- documenti prodotti dall'app ----------

export const chiaveDocumento = (modelloId) => `doc:${modelloId}`;

/**
 * Prossima revisione di un documento dalla sua data e dalla regola di revisione.
 * regola: { mesi, norma, obbligo, nota } | { evento, norma } | { scheda }  (le schede le calcola il piano)
 */
export function revisioneDocumento(regola, dataDocumento) {
  if (!regola) return { tipo: 'nessuna' };
  if (regola.scheda) return { tipo: 'scheda', scheda: regola.scheda };
  if (regola.evento) return { tipo: 'evento', nota: regola.evento, norma: regola.norma || '' };
  if (!regola.mesi) return { tipo: 'nessuna' };
  if (!dataDocumento) return { tipo: 'periodica', scadenza: null, mesi: regola.mesi, norma: regola.norma || '', obbligo: regola.obbligo || 'legge', nota: regola.nota || '' };
  return { tipo: 'periodica', scadenza: aggiungiMesi(dataDocumento, regola.mesi), mesi: regola.mesi, norma: regola.norma || '', obbligo: regola.obbligo || 'legge', nota: regola.nota || '' };
}

// ---------- raccolta ----------

export const AREE = {
  impresa: 'Adempimenti dell\'impresa',
  lavoratori: 'Lavoratori',
  attrezzature: 'Macchine e attrezzature',
  archivio: 'Certificati e documenti in archivio',
  documenti: 'Documenti da rivedere',
  eventi: 'Infortuni'
};

/** La scheda dice che la scadenza è una buona prassi e non un obbligo di legge? */
const prassi = (s) => /consigliat|buona prassi|non fissa|non fissa una scadenza/i.test(`${s?.notaScadenza || ''}`);

/**
 * Tutte le scadenze, comprese quelle senza data (mai fatte o data mancante).
 * Ogni voce: { id, area, data|null, titolo, riservato (senza nomi di persone), cosa, norma, obbligo, href, stato }
 */
export function raccogliScadenze({ piano, situazioni, macchine, archivio, defArchivio, documenti, eventi, catalogo, nomeCompleto = (l) => l?.nome || '', oggi }) {
  const out = [];
  const riferimento = (schedaId) => catalogo?.schede?.find((s) => s.id === schedaId)?.riferimento || '';
  const aggiungi = (v) => out.push({ ...v, stato: statoScadenza(v.data, oggi, v.senzaData) });

  for (const v of piano || []) {
    if (v.colore === 'info') continue; // «quando capita»: non ha una scadenza
    if (!v.prossimaScadenza && v.colore === 'verde') continue; // fatto una volta per tutte
    aggiungi({
      id: `impresa:${v.scheda.id}`,
      area: 'impresa',
      data: v.prossimaScadenza || null,
      senzaData: v.prossimaScadenza ? null : v.motivo,
      titolo: v.scheda.titolo,
      riservato: v.scheda.titolo,
      cosa: v.prossimaScadenza ? v.scheda.quando || '' : v.motivo,
      norma: v.scheda.riferimento || '',
      obbligo: prassi(v.scheda) ? 'prassi' : 'legge',
      href: `#/scheda/${v.scheda.id}`
    });
  }

  for (const s of situazioni || []) {
    for (const v of s.voci || []) {
      if (v.colore === 'info' || (!v.prossimaScadenza && v.colore === 'verde')) continue;
      const nome = nomeCompleto(s.lavoratore);
      aggiungi({
        id: `lavoratore:${s.lavoratore.id}:${v.requisito.id}`,
        area: 'lavoratori',
        data: v.prossimaScadenza || null,
        senzaData: v.prossimaScadenza ? null : v.motivo,
        titolo: `${nome}: ${v.requisito.titolo}`,
        riservato: `${v.requisito.titolo} (un lavoratore)`,
        persona: nome,
        cosa: v.requisito.aiuto || '',
        norma: riferimento(v.requisito.schedaId),
        obbligo: 'legge',
        href: `#/registro/${s.lavoratore.id}/${v.requisito.id}`
      });
    }
  }

  for (const m of macchine || []) {
    for (const v of m.voci || []) {
      if (!v.prossimaScadenza && v.colore !== 'rosso') continue;
      const verifica = /verifica|prima-verifica/.test(v.controllo.id);
      aggiungi({
        id: `attrezzatura:${m.attrezzatura.id}:${v.controllo.id}`,
        area: 'attrezzature',
        data: v.prossimaScadenza || null,
        senzaData: v.prossimaScadenza ? null : v.motivo,
        titolo: `${m.attrezzatura.nome}: ${v.controllo.titolo}`,
        riservato: `${m.attrezzatura.nome}: ${v.controllo.titolo}`,
        cosa: v.controllo.aiuto || '',
        norma: verifica ? 'D.Lgs. 81/2008 art. 71 c. 11 e Allegato VII; DM 11/04/2011' : 'D.Lgs. 81/2008 art. 71 c. 4; libretto del fabbricante',
        obbligo: 'legge',
        href: `#/attrezzatura/${m.attrezzatura.id}`
      });
    }
  }

  for (const r of archivioAttuale(archivio, 'certificato')) {
    if (!r.scadenza) continue;
    const tipo = defArchivio?.certificati?.find((t) => t.id === r.tipo);
    const d = r.durata ? durataArchivio(tipo, r.durata) : null;
    aggiungi({
      id: `archivio:${r.id}`,
      area: 'archivio',
      data: r.scadenza,
      titolo: r.titolo || tipo?.etichetta || 'Documento',
      riservato: tipo?.etichetta || r.titolo || 'Documento',
      cosa: d ? d.etichetta : 'Carica la versione rinnovata quando la ricevi.',
      norma: d?.norma || '',
      obbligo: d?.obbligo || 'legge',
      href: `#/archivio-voce/${r.id}`
    });
  }

  for (const x of documenti || []) {
    const rev = revisioneDocumento(x.regola, x.data);
    if (rev.tipo !== 'periodica' || !rev.scadenza) continue;
    aggiungi({
      id: `documento:${x.modello.id}`,
      area: 'documenti',
      data: rev.scadenza,
      titolo: `Revisione: ${x.modello.titolo}`,
      riservato: `Revisione: ${x.modello.titolo}`,
      cosa: rev.nota || `Documento del ${leggibile(x.data)}: da rivedere ogni ${rev.mesi % 12 ? `${rev.mesi} mesi` : `${rev.mesi / 12} anni`}.`,
      norma: rev.norma,
      obbligo: rev.obbligo,
      href: `#/documento/${x.modello.id}`
    });
  }

  for (const e of eventiAttivi(eventi)) {
    const s = situazioneEvento(e, oggi);
    const a = s.azioni.find((x) => x.scadenza);
    if (!a) continue;
    aggiungi({
      id: `evento:${e.id}`,
      area: 'eventi',
      data: a.scadenza,
      titolo: `${a.motivo} (infortunio del ${leggibile(e.data)})`,
      riservato: a.motivo,
      cosa: 'Entro 2 giorni dal ricevimento del certificato medico, online sul portale INAIL.',
      norma: 'DPR 1124/1965 art. 53; D.Lgs. 81/2008 art. 18 c. 1 lett. r',
      obbligo: 'legge',
      href: `#/evento/${e.id}`
    });
  }

  return ordina(out);
}

const ORDINE_STATO = { scaduta: 0, entro30: 1, dafare: 2, entro90: 3, oltre: 4 };

export function statoScadenza(data, oggi, senzaData) {
  if (!data) return 'dafare';
  const g = giorniTra(oggi, data);
  if (g < 0) return 'scaduta';
  if (g <= 30) return 'entro30';
  if (g <= 90) return 'entro90';
  return 'oltre';
}

export function ordina(lista) {
  return [...lista].sort((a, b) => ORDINE_STATO[a.stato] - ORDINE_STATO[b.stato] || String(a.data || '').localeCompare(String(b.data || '')) || a.titolo.localeCompare(b.titolo, 'it'));
}

export const GRUPPI = {
  scaduta: 'Scadute',
  entro30: 'Entro 30 giorni',
  dafare: 'Da fare o senza data',
  entro90: 'Entro 90 giorni',
  oltre: 'Più avanti'
};

export function raggruppaScadenze(lista) {
  return Object.keys(GRUPPI)
    .map((stato) => ({ stato, titolo: GRUPPI[stato], voci: lista.filter((x) => x.stato === stato) }))
    .filter((g) => g.voci.length);
}

export function conteggiScadenze(lista) {
  const c = { scaduta: 0, dafare: 0, entro30: 0, entro90: 0, oltre: 0 };
  for (const x of lista) c[x.stato]++;
  return c;
}

// ---------- promemoria per il responsabile ----------

/**
 * Testo del promemoria: scadute, da fare e in scadenza entro «giorni». Con conNomi=false i nomi dei
 * lavoratori non compaiono (per canali non riservati).
 */
export function testoPromemoria(lista, { impresa = '', oggi, giorni = 60, conNomi = false, responsabile = '' } = {}) {
  const limite = aggiungiGiorni(oggi, giorni);
  const scelte = lista.filter((x) => x.stato === 'scaduta' || x.stato === 'dafare' || (x.data && x.data <= limite));
  const riga = (x) => `- ${x.data ? `${leggibile(x.data)} ` : ''}${conNomi ? x.titolo : x.riservato}${x.norma ? ` [${x.norma}]` : ''}`;
  const blocco = (titolo, voci) => (voci.length ? `${titolo} (${voci.length})\n${voci.map(riga).join('\n')}\n` : '');
  const oggetto = `Scadenze sicurezza${impresa ? ` – ${impresa}` : ''} al ${leggibile(oggi)}`;
  if (!scelte.length) return { oggetto, testo: `${responsabile ? `Ciao ${responsabile},\n\n` : ''}nessuna scadenza nei prossimi ${giorni} giorni.\n\nPromemoria preparato con safetyDoc.`, numero: 0 };
  const corpo = [
    responsabile ? `Ciao ${responsabile},\n` : '',
    `queste sono le scadenze sulla sicurezza${impresa ? ` di ${impresa}` : ''} al ${leggibile(oggi)}:\n`,
    blocco('SCADUTE', scelte.filter((x) => x.stato === 'scaduta')),
    blocco(`IN SCADENZA ENTRO ${giorni} GIORNI`, scelte.filter((x) => x.data && x.stato !== 'scaduta')),
    blocco('DA FARE O SENZA DATA', scelte.filter((x) => x.stato === 'dafare')),
    'Promemoria preparato con safetyDoc. Le date sono calcolate sulle norme indicate tra parentesi: verificale con il consulente.'
  ]
    .filter(Boolean)
    .join('\n');
  return { oggetto, testo: corpo, numero: scelte.length };
}

// ---------- notifiche sul dispositivo ----------

/**
 * Scadenze da notificare: ogni voce viene notificata una volta quando mancano 30 giorni, una quando
 * ne mancano 7 e una il giorno della scadenza (o dopo, se il dispositivo era spento).
 * notificate: Set di chiavi «id|soglia|data».
 */
export function daNotificare(lista, oggi, notificate = new Set()) {
  const out = [];
  for (const x of lista) {
    if (!x.data) continue;
    const g = giorniTra(oggi, x.data);
    const soglia = SOGLIE_NOTIFICA.filter((s) => g <= s).pop();
    if (soglia === undefined) continue;
    const chiave = `${x.id}|${soglia}|${x.data}`;
    if (!notificate.has(chiave)) out.push({ voce: x, soglia, chiave, giorni: g });
  }
  return out;
}

/** Titolo e testo di una notifica che riassume più scadenze, senza nomi di persone. */
export function testoNotifica(nuove) {
  const scadute = nuove.filter((n) => n.giorni < 0).length;
  const titolo = nuove.length === 1 ? (nuove[0].giorni < 0 ? 'Scadenza superata' : nuove[0].giorni === 0 ? 'Scade oggi' : `Scade tra ${nuove[0].giorni} giorni`) : `${nuove.length} scadenze sulla sicurezza${scadute ? ` (${scadute} superate)` : ''}`;
  const corpo = nuove
    .slice(0, 4)
    .map((n) => `${leggibile(n.voce.data)} · ${n.voce.riservato}`)
    .join('\n');
  return { titolo, corpo: nuove.length > 4 ? `${corpo}\n…e altre ${nuove.length - 4}` : corpo };
}

/** Elenco minimo da passare al service worker per le notifiche ad app chiusa (senza nomi). */
export const perServiceWorker = (lista) => lista.filter((x) => x.data).map((x) => ({ id: x.id, data: x.data, riservato: x.riservato }));
