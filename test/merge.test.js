import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unisciCollezione, creaExport, validaExport, FORMATO_CIFRATO } from '../js/merge.js';

const rec = (id, updatedAt, extra = {}) => ({ id, updatedAt, deviceId: 'pc-1', deleted: false, ...extra });

test('aggiunge i record nuovi', () => {
  const { daSalvare, riepilogo } = unisciCollezione([rec('a', '2026-01-01')], [rec('b', '2026-01-02')]);
  assert.deepEqual(daSalvare.map((r) => r.id), ['b']);
  assert.equal(riepilogo.aggiunti, 1);
});

test('vince la modifica più recente', () => {
  const locale = rec('a', '2026-01-01T10:00:00Z', { note: 'vecchia' });
  const remoto = rec('a', '2026-02-01T10:00:00Z', { note: 'nuova', deviceId: 'tel-2' });
  const r1 = unisciCollezione([locale], [remoto]);
  assert.equal(r1.daSalvare[0].note, 'nuova');
  assert.equal(r1.riepilogo.aggiornati, 1);

  const r2 = unisciCollezione([remoto], [locale]);
  assert.equal(r2.daSalvare.length, 0, 'un file più vecchio non sovrascrive');
  assert.equal(r2.riepilogo.conflitti.length, 1);
});

test('una cancellazione più recente non viene annullata da un file vecchio', () => {
  const cancellato = rec('a', '2026-03-01T00:00:00Z', { deleted: true });
  const vecchio = rec('a', '2026-01-01T00:00:00Z');
  const { daSalvare } = unisciCollezione([cancellato], [vecchio]);
  assert.equal(daSalvare.length, 0);
});

test('a parità di data il risultato è lo stesso su entrambe le postazioni', () => {
  const a = rec('x', '2026-01-01T00:00:00Z', { deviceId: 'aaa', note: '1' });
  const b = rec('x', '2026-01-01T00:00:00Z', { deviceId: 'bbb', note: '2' });
  const suA = unisciCollezione([a], [b]).daSalvare[0] || a;
  const suB = unisciCollezione([b], [a]).daSalvare[0] || b;
  assert.equal(suA.note, suB.note);
});

test('record identici non contano come modifiche', () => {
  const a = rec('a', '2026-01-01');
  const { riepilogo } = unisciCollezione([a], [{ ...a, updatedAt: '2026-05-01', deviceId: 'altro' }]);
  assert.equal(riepilogo.invariati, 1);
  assert.equal(riepilogo.conflitti.length, 0);
});

test('export e validazione', () => {
  const exp = creaExport({ collezioni: { profilo: [], adempimenti: [rec('a', '2026-01-01')] }, deviceId: 'pc-1', versioneApp: '0.1.0', ora: '2026-11-23T00:00:00Z' });
  assert.equal(validaExport(exp).collezioni.adempimenti.length, 1);
  assert.throws(() => validaExport({ formato: 'altro' }));
  assert.throws(() => validaExport({ ...exp, schemaVersion: 99 }), /versione più recente/);
  assert.throws(() => validaExport({ formato: FORMATO_CIFRATO }), /CIFRATO/);
});

test('i backup della versione 1 si leggono ancora', () => {
  const vecchio = { formato: 'safetydoc-export', schemaVersion: 1, collezioni: { profilo: [], adempimenti: [] } };
  const dati = validaExport(vecchio);
  assert.deepEqual(dati.collezioni.lavoratori, []);
  assert.deepEqual(dati.collezioni.registri, []);
});

test('backup: i dati compilati nei documenti viaggiano con la copia e si uniscono', async () => {
  const { creaExport, validaExport, unisciDocumenti } = await import('../js/merge.js');
  const doc = { id: 'opzioni:dvr-bozza', valore: { valutazioni: [{ rischio: 'rumore', p: '3' }] }, updatedAt: '2026-11-20T10:00:00Z' };
  const e = creaExport({ collezioni: {}, deviceId: 'x', versioneApp: '0.18.1', documenti: [doc, { id: 'postazione', valore: 'segreto' }] });
  const v = validaExport(JSON.parse(JSON.stringify(e)));
  assert.deepEqual(v.documenti.map((d) => d.id), ['opzioni:dvr-bozza'], 'solo i dati dei documenti, non l\'identificativo della postazione');
  assert.deepEqual(validaExport({ ...e, documenti: undefined }).documenti, [], 'backup vecchi senza documenti');
  assert.throws(() => validaExport({ ...e, documenti: 'x' }), /danneggiato/);
  // vince la modifica più recente
  assert.deepEqual(unisciDocumenti([], [doc]).map((d) => d.id), ['opzioni:dvr-bozza']);
  assert.deepEqual(unisciDocumenti([{ ...doc, updatedAt: '2026-11-21T00:00:00Z' }], [doc]), []);
  assert.equal(unisciDocumenti([{ ...doc, updatedAt: undefined }], [doc]).length, 1, 'locale senza data: vince il backup');
  // i registri dei promemoria si fondono
  const loc = { id: 'promemoria:inviati', valore: [{ data: '2026-11-01T08:00:00Z', canale: 'email', numero: 3 }] };
  const imp = { id: 'promemoria:inviati', valore: [{ data: '2026-11-10T08:00:00Z', canale: 'WhatsApp', numero: 4 }, loc.valore[0]] };
  const u = unisciDocumenti([loc], [imp]);
  assert.deepEqual(u[0].valore.map((x) => x.canale), ['WhatsApp', 'email']);
  assert.deepEqual(unisciDocumenti([u[0]], [imp]), [], 'nessun cambiamento se già uniti');
});
