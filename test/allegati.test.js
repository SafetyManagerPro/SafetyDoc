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

import { paginePdf, MAX_PAGINE_PDF } from '../js/allegati.js';
import { readFileSync } from 'node:fs';
import { generaDocumento, rifAllegati, appendiceAllegati } from '../js/modelli.js';

test('pagine da stampare dei PDF', () => {
  assert.deepEqual(paginePdf('1-3, 7', 20), [1, 2, 3, 7]);
  assert.deepEqual(paginePdf('5 2 2', 10), [2, 5]);
  assert.deepEqual(paginePdf('8-12', 10), [8, 9, 10], 'oltre il totale si scarta');
  assert.deepEqual(paginePdf('', 4), [1, 2, 3, 4]);
  assert.equal(paginePdf('', 200).length, MAX_PAGINE_PDF);
  assert.deepEqual(paginePdf('abc, 0, 3', 5), [3]);
});

test('allegati nei documenti: riferimenti numerati e sezione finale', () => {
  const allegatiDoc = [
    { id: 'x1', n: 'A1', origine: 'attrezzatura', collegatoId: 'm1', titolo: 'Betoniera', categoria: "Libretto d'uso e manutenzione", nome: 'libretto.pdf' },
    { id: 'x2', n: 'A2', origine: 'prodotto', collegatoId: 'p1', titolo: 'Malta', categoria: 'Scheda di sicurezza', nome: 'sds.pdf' }
  ];
  assert.ok(rifAllegati(allegatiDoc, 'attrezzatura', 'm1').includes('All. A1'));
  assert.equal(rifAllegati(allegatiDoc, 'attrezzatura', 'altro'), '');
  assert.ok(appendiceAllegati(allegatiDoc).includes('data-allegato="x2"'));
  assert.equal(appendiceAllegati([]), '');
  const dvr = JSON.parse(readFileSync(new URL('../data/dvr.json', import.meta.url)));
  const html = generaDocumento('dvr-bozza', {
    anagrafica: {}, oggi: '2026-11-24', dvr, lavoratori: [], allegatiDoc,
    etichettePericoli: { taglio: 'Tagli e abrasioni' },
    macchine: [{ attrezzatura: { id: 'm1', nome: 'Betoniera', pericoli: ['taglio'], dpi: ['Guanti'], istruzioni: 'Mai mettere le mani nel tamburo' }, tipo: { etichetta: 'Macchina' }, voci: [] }],
    prodotti: [{ id: 'p1', nome: 'Malta' }]
  }).html;
  for (const x of ['Tagli e abrasioni', 'DPI: Guanti', 'Mai mettere le mani', 'All. A1', 'All. A2', 'Allegato A1']) assert.ok(html.includes(x), `manca ${x}`);
});
