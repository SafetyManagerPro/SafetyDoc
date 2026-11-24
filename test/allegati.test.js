import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dimensioniRidotte, dimensioneLeggibile, blobInBase64, base64InBlob, allegatoPerExport, allegatoDaImport } from '../js/allegati.js';
import { validaExport, COLLEZIONI } from '../js/merge.js';

test('le foto grandi vengono rimpicciolite mantenendo le proporzioni', () => {
  assert.deepEqual(dimensioniRidotte(4000, 3000), { larghezza: 1600, altezza: 1200 });
  assert.deepEqual(dimensioniRidotte(3000, 4000), { larghezza: 1200, altezza: 1600 });
  assert.deepEqual(dimensioniRidotte(800, 600), { larghezza: 800, altezza: 600 });
});

test('dimensioni leggibili', () => {
  assert.equal(dimensioneLeggibile(500), '500 B');
  assert.equal(dimensioneLeggibile(2048), '2 KB');
  assert.equal(dimensioneLeggibile(1.5 * 1024 * 1024), '1,5 MB');
});

test('un allegato passa dal backup senza perdere byte', async () => {
  const byte = new Uint8Array(70000).map((_, i) => i % 256);
  const originale = { id: 'a1', nome: 'attestato.pdf', tipo: 'application/pdf', dimensione: byte.length, file: new Blob([byte], { type: 'application/pdf' }) };
  const esportato = await allegatoPerExport(originale);
  assert.equal(esportato.file, undefined);
  assert.equal(typeof esportato.datiBase64, 'string');
  const json = JSON.parse(JSON.stringify(esportato));
  const ripreso = allegatoDaImport(json);
  assert.equal(ripreso.datiBase64, undefined);
  assert.deepEqual(new Uint8Array(await ripreso.file.arrayBuffer()), byte);
  assert.equal(ripreso.file.type, 'application/pdf');
  assert.equal(await blobInBase64(base64InBlob(esportato.datiBase64)), esportato.datiBase64);
});

test('gli allegati cancellati non portano il contenuto nel backup', async () => {
  const e = await allegatoPerExport({ id: 'x', deleted: true, file: new Blob(['abc']) });
  assert.equal(e.datiBase64, undefined);
});

test('i backup delle versioni precedenti ricevono le nuove collezioni', () => {
  const dati = validaExport({ formato: 'safetydoc-export', schemaVersion: 2, collezioni: { profilo: [], adempimenti: [], lavoratori: [], registri: [] } });
  for (const c of COLLEZIONI) assert.ok(Array.isArray(dati.collezioni[c]), c);
});
