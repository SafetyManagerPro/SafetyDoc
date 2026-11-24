import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generaIcs, eventiScadenze, testoIcs, piega } from '../js/calendario.js';

test('file di calendario valido con promemoria', () => {
  const ics = generaIcs([{ uid: 'impresa-dvr', data: '2027-03-15', titolo: 'Sicurezza: DVR, revisione', descrizione: 'riga 1\nriga 2' }], { ora: '2026-11-24T10:00:00.000Z' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20270315'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20270316'));
  assert.ok(ics.includes('SUMMARY:Sicurezza: DVR\\, revisione'));
  assert.ok(ics.includes('DESCRIPTION:riga 1\\nriga 2'));
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.ok(ics.includes('DTSTAMP:20261124T100000Z'));
  for (const r of ics.split('\r\n')) assert.ok(new TextEncoder().encode(r).length <= 75, `riga troppo lunga: ${r}`);
});

test('righe lunghe e caratteri accentati', () => {
  const lunga = 'SUMMARY:' + 'àèìòù'.repeat(30);
  const piegata = piega(lunga);
  assert.equal(piegata.replace(/\r\n /g, ''), lunga);
  assert.equal(testoIcs('a;b,c\\d'), String.raw`a\;b\,c\\d`);
});

test('eventi da piano e lavoratori, in ordine di data', () => {
  const eventi = eventiScadenze({
    piano: [
      { scheda: { id: 'preposto', titolo: 'Preposto', quando: 'ogni 2 anni' }, prossimaScadenza: '2027-05-01' },
      { scheda: { id: 'dvr', titolo: 'DVR', quando: '' }, prossimaScadenza: null }
    ],
    situazioni: [{ lavoratore: { id: 'l1', nome: 'Anna' }, voci: [{ requisito: { id: 'visita-medica', titolo: 'Visita medica' }, prossimaScadenza: '2027-01-10' }] }],
    nomeCompleto: (l) => l.nome
  });
  assert.deepEqual(eventi.map((e) => e.uid), ['lavoratore-l1-visita-medica', 'impresa-preposto']);
  assert.equal(eventi[0].titolo, 'Anna: Visita medica');
});
