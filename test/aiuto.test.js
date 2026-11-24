import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numeroInternazionale, linkAiuto, testoRichiesta } from '../js/aiuto.js';
import { vociControlloIniziale, dataDaMese } from '../js/engine.js';

test('numeri di telefono in formato internazionale', () => {
  assert.equal(numeroInternazionale('0825 123 456'), '+390825123456');
  assert.equal(numeroInternazionale('+39 333-1234567'), '+393331234567');
  assert.equal(numeroInternazionale('0039 333 1234567'), '+393331234567');
  assert.equal(numeroInternazionale(''), '');
});

test('link solo per i recapiti presenti, messaggio senza dati dei lavoratori', () => {
  assert.deepEqual(linkAiuto({ contatto: {} }), {});
  const l = linkAiuto({ contatto: { telefono: '0825 1', email: 'a@b.it' }, impresa: 'Edil Rossi', argomento: 'DVR' });
  assert.equal(l.telefono, 'tel:+3908251');
  assert.ok(l.whatsapp.startsWith('https://wa.me/3908251?text='));
  assert.ok(l.email.startsWith('mailto:a%40b.it?subject='));
  assert.ok(decodeURIComponent(l.whatsapp).includes('Edil Rossi') && decodeURIComponent(l.whatsapp).includes('DVR'));
  const w = linkAiuto({ contatto: { telefono: '0825 1', whatsapp: '333 9' } });
  assert.ok(w.whatsapp.startsWith('https://wa.me/393339'));
  assert.ok(testoRichiesta({}).includes('sicurezza sul lavoro'));
});

test('controllo iniziale: solo voci rosse non fatte e non "quando capita", per priorità', () => {
  const v = (id, colore, priorita, extra = {}) => ({ scheda: { id, priorita, tipoScadenza: 'una_tantum', ...extra }, colore, stato: null });
  const piano = [v('a', 'rosso', 3), v('b', 'verde', 1), v('c', 'rosso', 1), v('d', 'info', 1, { tipoScadenza: 'evento' }), { ...v('e', 'rosso', 1), stato: { fatto: true } }];
  assert.deepEqual(vociControlloIniziale(piano).map((x) => x.scheda.id), ['c', 'a']);
});

test('data da mese', () => {
  assert.equal(dataDaMese('2024-03'), '2024-03-01');
  assert.equal(dataDaMese('2024-03-15'), '2024-03-15');
  assert.equal(dataDaMese('marzo'), null);
});

test('presentazione nel messaggio', () => {
  assert.ok(testoRichiesta({ impresa: 'Edil Rossi' }).includes("scrivo per l'impresa Edil Rossi."));
  assert.ok(testoRichiesta({ impresa: 'Edil Rossi', titolare: 'Luca' }).includes("sono Luca dell'impresa Edil Rossi."));
});
