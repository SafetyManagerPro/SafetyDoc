// Esportazione delle scadenze in un file di calendario (.ics), che il telefono apre
// aggiungendo gli eventi con i promemoria. Modulo puro: testabile con Node.

const CRLF = '\r\n';

/** Testo sicuro per un campo iCalendar (RFC 5545). */
export function testoIcs(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Spezza le righe oltre i 75 byte, come vuole lo standard. */
export function piega(riga) {
  const enc = new TextEncoder();
  if (enc.encode(riga).length <= 75) return riga;
  const parti = [];
  let corrente = '';
  let byte = 0;
  for (const ch of riga) {
    const n = enc.encode(ch).length;
    const limite = parti.length ? 74 : 75; // le righe di continuazione iniziano con uno spazio
    if (byte + n > limite) {
      parti.push(corrente);
      corrente = '';
      byte = 0;
    }
    corrente += ch;
    byte += n;
  }
  parti.push(corrente);
  return parti.join(CRLF + ' ');
}

const dataIcs = (iso) => iso.slice(0, 10).replace(/-/g, '');

function giornoDopo(iso) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * eventi: [{ uid, data: 'YYYY-MM-DD', titolo, descrizione }]
 * Ogni evento dura tutto il giorno e ha due promemoria: 30 giorni e 7 giorni prima.
 */
export function generaIcs(eventi, { ora, nomeCalendario = 'safetyDoc – scadenze' } = {}) {
  const stamp = (ora || new Date().toISOString()).replace(/[-:]/g, '').replace(/\.\d{3}/, '').slice(0, 15) + 'Z';
  const righe = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//safetyDoc//Scadenze sicurezza//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${testoIcs(nomeCalendario)}`
  ];
  for (const e of eventi) {
    if (!e?.data || !/^\d{4}-\d{2}-\d{2}/.test(e.data)) continue;
    righe.push(
      'BEGIN:VEVENT',
      `UID:${testoIcs(e.uid)}@safetydoc`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dataIcs(e.data)}`,
      `DTEND;VALUE=DATE:${dataIcs(giornoDopo(e.data))}`,
      `SUMMARY:${testoIcs(e.titolo)}`,
      `DESCRIPTION:${testoIcs(e.descrizione || '')}`,
      'TRANSP:TRANSPARENT'
    );
    for (const giorni of [30, 7]) {
      righe.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${testoIcs(e.titolo)}`, `TRIGGER:-P${giorni}D`, 'END:VALARM');
    }
    righe.push('END:VEVENT');
  }
  righe.push('END:VCALENDAR');
  return righe.map(piega).join(CRLF) + CRLF;
}

/** Raccoglie le scadenze future (o già scadute) dal piano e dai lavoratori. */
export function eventiScadenze({ piano, situazioni, nomeCompleto, macchine, archivio }) {
  const eventi = [];
  for (const v of piano || []) {
    if (!v.prossimaScadenza) continue;
    eventi.push({
      uid: `impresa-${v.scheda.id}`,
      data: v.prossimaScadenza,
      titolo: `Sicurezza: ${v.scheda.titolo}`,
      descrizione: `${v.scheda.quando}\nApri safetyDoc per i passi da fare.`
    });
  }
  for (const s of situazioni || []) {
    for (const v of s.voci) {
      if (!v.prossimaScadenza) continue;
      eventi.push({
        uid: `lavoratore-${s.lavoratore.id}-${v.requisito.id}`,
        data: v.prossimaScadenza,
        titolo: `${nomeCompleto(s.lavoratore)}: ${v.requisito.titolo}`,
        descrizione: 'Scadenza registrata in safetyDoc.'
      });
    }
  }
  for (const m of macchine || []) {
    for (const v of m.voci) {
      if (!v.prossimaScadenza) continue;
      eventi.push({
        uid: `attrezzatura-${m.attrezzatura.id}-${v.controllo.id}`,
        data: v.prossimaScadenza,
        titolo: `${m.attrezzatura.nome}: ${v.controllo.titolo}`,
        descrizione: 'Scadenza registrata in safetyDoc.'
      });
    }
  }
  for (const r of archivio || []) {
    if (!r.scadenza || r.sostituitoDa || r.deleted || r.dismesso) continue;
    eventi.push({
      uid: `archivio-${r.id}`,
      data: r.scadenza,
      titolo: `Scadenza documento: ${r.titolo}`,
      descrizione: 'Carica in safetyDoc la versione rinnovata del documento.'
    });
  }
  return eventi.sort((a, b) => a.data.localeCompare(b.data));
}
