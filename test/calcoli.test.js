import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lex8h, fasciaRumore, a8, fasciaVibrazioni, niosh, fasciaNiosh, costantePeso, fattoreFrequenza, pericolositaSalute, esposizioneChimica, esitoChimico, bassoRischioIncendio } from '../js/calcoli.js';

test('rumore: LEX,8h e fasce', () => {
  assert.equal(lex8h([{ livello: 85, ore: 8 }]), 85);
  assert.equal(lex8h([{ livello: 90, ore: 2 }, { livello: 75, ore: 6 }]), 84.4);
  assert.equal(lex8h([{ livello: '88,5', ore: '4' }]), 85.5, 'accetta la virgola');
  assert.equal(lex8h([{ livello: '', ore: 2 }]), null);
  assert.equal(fasciaRumore(79).colore, 'verde');
  assert.equal(fasciaRumore(82).colore, 'giallo');
  assert.equal(fasciaRumore(86).colore, 'rosso');
  assert.match(fasciaRumore(90).testo, /87/);
});

test('vibrazioni: A(8) separato per mano-braccio e corpo intero', () => {
  const righe = [{ accelerazione: 5, ore: 2, sistema: 'HAV' }, { accelerazione: 0.8, ore: 4, sistema: 'WBV' }];
  assert.equal(a8(righe, 'HAV'), 2.5);
  assert.equal(a8(righe, 'WBV'), 0.57);
  assert.equal(a8([], 'HAV'), null);
  assert.equal(fasciaVibrazioni(2.5, 'HAV').colore, 'verde');
  assert.equal(fasciaVibrazioni(3, 'HAV').colore, 'giallo');
  assert.equal(fasciaVibrazioni(1.2, 'WBV').colore, 'rosso');
});

test('NIOSH: costanti di peso, fattori e indice', () => {
  assert.equal(costantePeso('uomo', 'adulto'), 25);
  assert.equal(costantePeso('donna', 'adulto'), 20);
  assert.equal(costantePeso('uomo', 'giovane_anziano'), 20);
  assert.equal(costantePeso('donna', 'giovane_anziano'), 15);
  assert.equal(fattoreFrequenza(1, 'lunga'), 0.75);
  assert.equal(fattoreFrequenza(0.1, 'breve'), 1);
  assert.equal(fattoreFrequenza(20, 'breve'), 0);
  const ideale = niosh({ peso: 10, altezza: 75, distanza: 25, dislocazione: 25, angolo: 0, frequenza: 0.2, durata: 'breve', presa: 'buona', genere: 'uomo', fascia: 'adulto' });
  assert.equal(ideale.rwl, 25);
  assert.equal(ideale.indice, 0.4);
  const gravoso = niosh({ peso: 20, altezza: 20, distanza: 50, dislocazione: 100, angolo: 45, frequenza: 4, durata: 'lunga', presa: 'scarsa', genere: 'uomo', fascia: 'adulto' });
  assert.ok(gravoso.indice > 3, `indice ${gravoso.indice}`);
  assert.equal(fasciaNiosh(gravoso.indice).colore, 'rosso');
  assert.equal(fasciaNiosh(0.9).colore, 'giallo');
  assert.equal(niosh({ peso: 10, altezza: 180, distanza: 25, dislocazione: 25 }).indice, null, 'altezza oltre i limiti');
  assert.equal(niosh({ peso: '' }), null);
  const due = niosh({ peso: 10, altezza: 75, distanza: 25, dislocazione: 25, frequenza: 0.2, durata: 'breve', dueOperatori: true });
  assert.equal(due.rwl, 21.25);
});

test('rischio chimico: pericolosità, esposizione ed esito', () => {
  assert.equal(pericolositaSalute('H225 H350'), 'cmr');
  assert.equal(pericolositaSalute('H314'), 'alta');
  assert.equal(pericolositaSalute('H336'), 'media');
  assert.equal(pericolositaSalute('H315 H319'), 'bassa');
  assert.equal(pericolositaSalute('H225'), 'nessuna');
  assert.equal(esposizioneChimica({ quantita: 'piccola', frequenza: 'occasionale', modalita: 'controllato', ventilazione: 'generale' }), 'bassa');
  assert.equal(esposizioneChimica({ quantita: 'grande', frequenza: 'quotidiana', modalita: 'dispersivo', ventilazione: 'nessuna' }), 'alta');
  assert.equal(esposizioneChimica({ quantita: 'grande', frequenza: 'quotidiana', modalita: 'chiuso' }), 'bassa', 'sistema chiuso');
  assert.equal(esitoChimico('bassa', 'bassa').colore, 'verde');
  assert.equal(esitoChimico('alta', 'media').colore, 'rosso');
  assert.equal(esitoChimico('cmr', 'bassa').colore, 'rosso');
});

test('incendio: criteri del basso rischio', () => {
  const ok = { soggetta: 'no', persone: '30', superficie: '200', quote: 'si', combustibili: 'no', sostanze: 'no', lavorazioni: 'no' };
  assert.equal(bassoRischioIncendio(ok).basso, true);
  assert.equal(bassoRischioIncendio({ ...ok, persone: '150' }).basso, false);
  assert.equal(bassoRischioIncendio({ ...ok, superficie: '' }).basso, false, 'senza superficie non si può dire');
  assert.equal(bassoRischioIncendio({ ...ok, soggetta: 'si' }).basso, false);
  assert.equal(bassoRischioIncendio(ok).criteri.length, 7);
});
