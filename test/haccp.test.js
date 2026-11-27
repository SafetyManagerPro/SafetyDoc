import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIE_MERCI, esitoTemperatura, esitoProcesso, FASI_HACCP, PREREQUISITI, fasiPerAttivita } from '../js/haccp.js';

test('ricevimento merci: limiti per categoria', () => {
  assert.equal(esitoTemperatura('carni', '6,5').colore, 'verde');
  assert.equal(esitoTemperatura('carni', 8).colore, 'rosso');
  assert.equal(esitoTemperatura('macinate', 3).colore, 'rosso');
  assert.equal(esitoTemperatura('surgelati', -20).colore, 'verde');
  assert.equal(esitoTemperatura('surgelati', -16).colore, 'giallo', 'breve rialzo nel trasporto');
  assert.equal(esitoTemperatura('surgelati', -12).colore, 'rosso');
  assert.equal(esitoTemperatura('ambiente', '').colore, 'verde');
  assert.equal(esitoTemperatura('carni', ''), null);
  assert.equal(esitoTemperatura('inesistente', 3), null);
  assert.ok(CATEGORIE_MERCI.every((c) => c.rif));
});

test('punti critici: cottura, abbattimento, mantenimento e olio', () => {
  assert.equal(esitoProcesso('cottura', { temperatura: 78 }).colore, 'verde');
  assert.equal(esitoProcesso('cottura', { temperatura: 70 }).colore, 'rosso');
  assert.equal(esitoProcesso('abbattimento', { temperatura: 3, minuti: 85 }).colore, 'verde');
  assert.equal(esitoProcesso('abbattimento', { temperatura: 3, minuti: 120 }).colore, 'rosso');
  assert.equal(esitoProcesso('surgelazione', { temperatura: -18, minuti: 240 }).colore, 'verde');
  assert.equal(esitoProcesso('mantenimento', { temperatura: '58' }).colore, 'rosso');
  assert.equal(esitoProcesso('olio', { temperatura: 27 }).colore, 'rosso');
  assert.equal(esitoProcesso('olio', { temperatura: 20 }).colore, 'verde');
  assert.equal(esitoProcesso('abbattimento', { temperatura: 3 }), null);
  assert.equal(esitoProcesso('altro', {}), null);
});

test('fasi del piano e prerequisiti', () => {
  const ids = new Set(FASI_HACCP.map((f) => f.id));
  assert.equal(ids.size, FASI_HACCP.length, 'id unici');
  for (const f of FASI_HACCP) for (const k of ['fase', 'pericolo', 'controllo', 'limite', 'correttiva', 'registrazione']) assert.ok(f[k], `${f.id}: ${k}`);
  for (const a of ['ristorazione', 'alimentare_produzione', 'trasporto', 'commercio_ufficio', 'altro']) fasiPerAttivita(a).forEach((id) => assert.ok(ids.has(id), `${a}: ${id}`));
  assert.ok(fasiPerAttivita('ristorazione').includes('cottura'));
  assert.ok(!fasiPerAttivita('commercio_ufficio').includes('cottura'));
  assert.ok(PREREQUISITI.length >= 8);
});
