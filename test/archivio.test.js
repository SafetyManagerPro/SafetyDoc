import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { archivioAttuale, versioniPrecedenti, situazioneArchivio, urgenzeArchivio, rinnovaAdempimento } from '../js/engine.js';
import { eventiScadenze } from '../js/calendario.js';
import { generaDocumento } from '../js/modelli.js';
import { migra, COLLEZIONI } from '../js/merge.js';

const json = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const oggi = '2026-11-25';
const archivio = [
  { id: 'v1', genere: 'certificato', tipo: 'verifica-terra', titolo: 'Messa a terra', dataRilascio: '2016-05-01', scadenza: '2021-05-01', sostituitoDa: 'v2' },
  { id: 'v2', genere: 'certificato', tipo: 'verifica-terra', titolo: 'Messa a terra', dataRilascio: '2021-05-01', scadenza: '2026-12-20', sostituisce: 'v1', sostituitoDa: 'v3' },
  { id: 'v3', genere: 'certificato', tipo: 'verifica-terra', titolo: 'Messa a terra', dataRilascio: '2026-11-20', scadenza: '2031-11-20', sostituisce: 'v2' },
  { id: 'c1', genere: 'certificato', tipo: 'cpi', titolo: 'SCIA antincendio', scadenza: '2026-01-10' },
  { id: 'p1', genere: 'planimetria', tipo: 'emergenza', titolo: 'Piano terra' },
  { id: 'x', genere: 'certificato', tipo: 'altro', titolo: 'Eliminato', deleted: true }
];

test('archivio: versioni in uso e storico delle versioni', () => {
  assert.deepEqual(archivioAttuale(archivio).map((r) => r.id), ['v3', 'c1', 'p1']);
  assert.deepEqual(archivioAttuale(archivio, 'planimetria').map((r) => r.id), ['p1']);
  assert.deepEqual(versioniPrecedenti(archivio[2], archivio).map((r) => r.id), ['v2', 'v1']);
  assert.deepEqual(versioniPrecedenti({ id: 'a', sostituisce: 'a' }, [{ id: 'a', sostituisce: 'a' }]).length, 1, 'niente cicli infiniti');
});

test('archivio: semaforo e urgenze', () => {
  assert.equal(situazioneArchivio(archivio[3], oggi).colore, 'rosso');
  assert.equal(situazioneArchivio({ scadenza: '2026-12-20' }, oggi).colore, 'giallo');
  assert.equal(situazioneArchivio(archivio[2], oggi).colore, 'verde');
  assert.equal(situazioneArchivio({}, oggi, 0).motivo, 'Manca il file del documento');
  assert.equal(situazioneArchivio(archivio[1], oggi).colore, 'info', 'versione superata');
  assert.deepEqual(urgenzeArchivio(archivio, oggi).map((s) => s.voce.id), ['c1'], 'la versione superata in scadenza non conta');
});

test('rinnovo di un adempimento: la registrazione precedente va nello storico', () => {
  const prima = { id: 'a1', schedaId: 'messa-terra', fatto: true, dataFatto: '2021-05-01', scadenzaManuale: null, note: 'Ditta X' };
  const dopo = rinnovaAdempimento(prima, { fatto: true, dataFatto: '2026-11-20', note: 'Ditta Y' }, oggi);
  assert.equal(dopo.dataFatto, '2026-11-20');
  assert.equal(dopo.id, 'a1');
  assert.deepEqual(dopo.storico, [{ dataFatto: '2021-05-01', scadenzaManuale: null, note: 'Ditta X', sostituitoIl: oggi }]);
  const ancora = rinnovaAdempimento(dopo, { fatto: true, dataFatto: '2031-11-01' }, '2031-11-01');
  assert.equal(ancora.storico.length, 2);
  assert.equal(ancora.storico[0].dataFatto, '2026-11-20');
  assert.equal(rinnovaAdempimento(prima, { fatto: true, dataFatto: '2021-05-01' }, oggi).storico.length, 0, 'stessa data: nessuno storico');
  assert.equal(rinnovaAdempimento(null, { fatto: true, dataFatto: oggi }, oggi).storico.length, 0);
});

test('calendario: scadenze dei documenti in uso', () => {
  const ev = eventiScadenze({ piano: [], archivio: archivioAttuale(archivio) });
  assert.deepEqual(ev.map((e) => e.uid), ['archivio-c1', 'archivio-v3']);
});

test('backup: collezione archivio e migrazione dei file vecchi', () => {
  assert.ok(COLLEZIONI.includes('archivio'));
  assert.deepEqual(migra({ schemaVersion: 4, collezioni: { profilo: [] } }).collezioni.archivio, []);
});

test('tipi di archivio validi', () => {
  const d = json('archivio.json');
  for (const elenco of [d.certificati, d.planimetrie]) {
    const ids = elenco.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const t of elenco) assert.ok(t.etichetta && t.gruppo, t.id);
  }
});

test('DVR e piano di emergenza: certificati in archivio e planimetrie allegate', () => {
  const dvr = json('dvr.json');
  const allegatiDoc = [{ id: 'f1', n: 'A1', origine: 'archivio', collegatoId: 'p1', titolo: 'Piano terra', categoria: 'Planimetria di emergenza', nome: 'pt.pdf' }];
  const html = generaDocumento('dvr-bozza', { anagrafica: {}, oggi, dvr, lavoratori: [], allegatiDoc, archivio: archivioAttuale(archivio) }).html;
  for (const x of ['Piano terra (', 'All. A1', 'Messa a terra', '20/11/2031', 'SCIA antincendio', 'SCADUTO']) assert.ok(html.includes(x), `manca ${x}`);
  assert.ok(!html.includes('01/05/2021') || html.indexOf('01/05/2021') < 0, 'le versioni superate non compaiono');
  const em = generaDocumento('piano-emergenza-doc', { anagrafica: {}, oggi, lavoratori: [], allegatiDoc, opzioni: {} }).html;
  assert.ok(em.includes('Piano terra (') && em.includes('esposte nei locali'));
  const stato = generaDocumento('stato-sicurezza', { anagrafica: {}, oggi, piano: [], archivio: archivioAttuale(archivio) }).html;
  assert.ok(stato.includes('Certificati e documenti in archivio') && stato.includes('SCIA antincendio'));
});
