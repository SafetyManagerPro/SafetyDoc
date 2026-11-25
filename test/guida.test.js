import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rottaDa, valePer, vociPer, testoCorrisponde, erroriGuida, sigleCliccabili, regexSigle, eventoGuida } from '../js/guida.js';

const guida = JSON.parse(readFileSync(new URL('../data/guida.json', import.meta.url)));
const conoscenza = JSON.parse(readFileSync(new URL('../data/conoscenza.json', import.meta.url)));

test('il file degli aiuti è completo e coerente', () => {
  assert.deepEqual(erroriGuida(guida.voci), []);
  assert.ok(guida.voci.length >= 55);
  assert.deepEqual(erroriGuida([{ id: 'X', rotta: 'oggi' }, { id: 'ok-id', rotta: 'oggi', sel: 'h1', titolo: 't', cosa: 'c', perche: 'p', dopo: 'd', link: { href: 'https://x' } }]).length, 7);
});

test('ogni aiuto produce un evento di utilizzo accettato dal database', () => {
  for (const v of guida.voci) assert.match(eventoGuida('guida', v.id), /^[a-z0-9:-]{0,40}$/, v.id);
  assert.equal(eventoGuida('sigla', 'PiMUS'), 'sigla:pimus');
});

test('schermata dall\'indirizzo e voci che la riguardano', () => {
  assert.equal(rottaDa('#/'), 'oggi');
  assert.equal(rottaDa(''), 'oggi');
  assert.equal(rottaDa('#/documento/dvr-bozza'), 'documento:dvr-bozza');
  assert.equal(rottaDa('#/lavoratore-modifica/l1'), 'lavoratore-modifica');
  assert.ok(valePer({ rotta: 'documento:*' }, 'documento:pos-bozza'));
  assert.ok(!valePer({ rotta: 'documento:*' }, 'documenti'));
  assert.ok(valePer({ rotta: ['dati', 'oggi'] }, 'oggi'));
  assert.ok(vociPer(guida.voci, 'documento:dvr-bozza').some((v) => v.id === 'dvr-valutazioni'));
  assert.ok(!vociPer(guida.voci, 'documento:pos-bozza').some((v) => v.id === 'dvr-valutazioni'));
  assert.ok(testoCorrisponde({ testo: 'Salva una copia' }, '  salva  una copia '));
  assert.ok(!testoCorrisponde({ testo: 'Carica' }, 'Salva una copia'));
});

test('sigle cliccabili: solo sigle vere e come parole intere', () => {
  const s = sigleCliccabili(conoscenza.glossario);
  assert.ok(s.some((g) => g.sigla === 'RSPP') && s.some((g) => g.sigla === 'DUVRI'));
  assert.ok(!s.some((g) => g.sigla === 'DL' || g.sigla.includes(' ')));
  const re = regexSigle(s);
  assert.equal('Nomina dell\'RSPP esterno'.match(re)[2], 'RSPP');
  assert.equal('Il DUVRI va firmato'.match(re)[2], 'DUVRI');
  assert.equal('RSPPX e ARSPP'.match(re), null);
  assert.equal(regexSigle([]), null);
});
