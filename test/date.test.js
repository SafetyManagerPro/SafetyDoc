import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oggiLocale, formattaData, interpretaData, mascheraData, erroreData } from '../js/date.js';

test('oggi secondo l\'ora locale, anche dopo mezzanotte', () => {
  const dopoMezzanotte = new Date(2026, 10, 25, 0, 30); // 25 novembre alle 00:30 ora locale
  assert.equal(oggiLocale(dopoMezzanotte), '2026-11-25');
  assert.equal(oggiLocale(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('lettura delle date scritte a mano', () => {
  const oggi = '2026-11-24';
  assert.equal(interpretaData('15/03/2019', oggi), '2019-03-15');
  assert.equal(interpretaData('5/3/2019', oggi), '2019-03-05');
  assert.equal(interpretaData('15-03-19', oggi), '2019-03-15');
  assert.equal(interpretaData('15.03.2019', oggi), '2019-03-15');
  assert.equal(interpretaData('15032019', oggi), '2019-03-15');
  assert.equal(interpretaData('150319', oggi), '2019-03-15');
  assert.equal(interpretaData('01/01/85', oggi), '1985-01-01', 'anno a due cifre nel passato');
  assert.equal(interpretaData('01/01/35', oggi), '2035-01-01', 'scadenze future');
  assert.equal(interpretaData('2024-02-29', oggi), '2024-02-29');
  assert.equal(interpretaData('29/02/2025', oggi), null, 'non bisestile');
  assert.equal(interpretaData('31/04/2026', oggi), null);
  assert.equal(interpretaData('15/13/2026', oggi), null);
  assert.equal(interpretaData('ieri', oggi), null);
  assert.equal(interpretaData('', oggi), null);
});

test('formattazione e barre automatiche', () => {
  assert.equal(formattaData('2026-03-15'), '15/03/2026');
  assert.equal(formattaData(''), '');
  assert.equal(mascheraData('1'), '1');
  assert.equal(mascheraData('1503'), '15/03');
  assert.equal(mascheraData('150320'), '15/03/20');
  assert.equal(mascheraData('15032019'), '15/03/2019');
  assert.equal(mascheraData('150320199'), '15/03/2019');
  assert.equal(mascheraData('15/03'), '15/03');
  assert.equal(mascheraData('01/122'), '01/12/2', 'cifre digitate una alla volta');
  assert.equal(mascheraData('15/032019'), '15/03/2019');
  assert.equal(mascheraData('15/'), '15', 'cancellando sparisce la barra');
  assert.equal(mascheraData('5/3/2019'), '5/3/2019', 'barre messe dall\'utente');
  assert.equal(mascheraData('15-03-2019'), '15-03-2019');
  // simulazione della digitazione carattere per carattere
  let v = '';
  for (const ch of '15032019') v = mascheraData(v + ch);
  assert.equal(v, '15/03/2019');
});

test('messaggi per date fuori dai limiti', () => {
  assert.equal(erroreData('2026-12-01', { max: '2026-11-24' }), 'La data non può essere dopo il 24/11/2026.');
  assert.equal(erroreData('2020-01-01', { min: '2021-01-01' }), 'La data non può essere prima del 01/01/2021.');
  assert.equal(erroreData(null, { obbligatoria: true }), 'Inserisci la data.');
  assert.match(erroreData(null, { testo: '32/01/2020' }), /non valida/);
  assert.equal(erroreData(null, {}), '');
  assert.equal(erroreData('2026-01-01', { max: '2026-11-24' }), '');
});
