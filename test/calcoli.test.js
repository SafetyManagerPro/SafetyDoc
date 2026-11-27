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

import {
  oreMassimeRumore, contributiRumore, piccoMassimo, fasciaPicco, livelloConDpi, adeguatezzaDpi, lex8hConDpi,
  accelerazioneEfficace, wbvDaAssi, oreMassimeVibrazioni, nioshComposito, indicePericolo, movarisch, fasciaMovarisch,
  rischioBiologico, obblighiBiologici, pmvPpd, fasciaPmv, wbgt, wbgtRiferimento, fasciaWbgt, esitoIlluminazione,
  andamentoIndicatore, stressInail, fasciaStress, righeRumoreDaLibretti, righeVibrazioniDaLibretti, vibrazioneDaLibretto, riepilogoEmissioni
} from '../js/calcoli.js';

test('rumore: tempi massimi, quote, picco e DPI', () => {
  assert.equal(oreMassimeRumore(88), 4, 'a 88 dB(A) si arriva a 85 in 4 ore');
  assert.equal(oreMassimeRumore(80), null, 'sotto la soglia anche in 8 ore');
  assert.deepEqual(contributiRumore([{ livello: 90, ore: 1 }, { livello: 80, ore: 1 }, { livello: '', ore: 2 }]), [91, 9, null]);
  assert.equal(piccoMassimo([{ picco: '130' }, { picco: '138,5' }, {}]), 138.5);
  assert.equal(fasciaPicco(136).colore, 'giallo');
  assert.equal(fasciaPicco(141).colore, 'rosso');
  assert.equal(fasciaPicco(null), null);
  assert.equal(livelloConDpi({ livello: 95, lceq: 98 }, { tipo: 'cuffie', snr: 28 }), 77, 'LCeq − 0,75·SNR');
  assert.equal(livelloConDpi({ livello: 95 }, { tipo: 'inserti_espandibili', snr: 30 }), 80, 'senza LCeq usa LAeq');
  assert.equal(livelloConDpi({ livello: 95 }, { tipo: '', snr: 30 }), null);
  assert.equal(adeguatezzaDpi(82).colore, 'rosso');
  assert.equal(adeguatezzaDpi(72).testo, 'Buona');
  assert.match(adeguatezzaDpi(60).testo, /protettivo/);
  const righe = [{ livello: 95, ore: 4, lceq: 98 }, { livello: 70, ore: 4 }];
  assert.ok(lex8h(righe) > 87);
  assert.ok(lex8hConDpi(righe, { tipo: 'cuffie', snr: 28 }) < 80);
});

test('vibrazioni: incertezza, fattore di correzione, assi e tempi', () => {
  assert.equal(accelerazioneEfficace({ accelerazione: '4', incertezza: '1', fattore: '1,5' }), 7.5);
  assert.equal(accelerazioneEfficace({ accelerazione: 4 }), 4);
  assert.equal(accelerazioneEfficace({ accelerazione: '' }), null);
  assert.equal(wbvDaAssi(0.4, 0.3, 0.5), 0.56);
  assert.equal(wbvDaAssi('', '', ''), null);
  assert.equal(oreMassimeVibrazioni(5, 'HAV', 'azione'), 2);
  assert.equal(oreMassimeVibrazioni(10, 'HAV', 'limite'), 2);
  assert.equal(oreMassimeVibrazioni(2, 'HAV', 'azione'), null);
  assert.equal(a8([{ accelerazione: 4, incertezza: 1, ore: 2, sistema: 'HAV' }], 'HAV'), 2.5, 'A(8) con K');
});

test('NIOSH: indice composito con più sollevamenti', () => {
  const comuni = { genere: 'uomo', fascia: 'adulto' };
  const c = nioshComposito(
    [
      { compito: 'Scatole', peso: 15, altezza: 75, distanza: 25, dislocazione: 25, frequenza: 1, durata: 'media' },
      { compito: 'Sacchi', peso: 10, altezza: 30, distanza: 40, dislocazione: 50, frequenza: 4, durata: 'media' }
    ],
    comuni
  );
  assert.deepEqual(c.ordine, ['Sacchi', 'Scatole']);
  assert.equal(c.frequenzaTotale, 5);
  const singoli = [niosh({ peso: 10, altezza: 30, distanza: 40, dislocazione: 50, frequenza: 4, durata: 'media', ...comuni }).indice];
  assert.ok(c.indice > singoli[0], 'il composito supera il singolo più gravoso');
  assert.equal(nioshComposito([{ peso: 10, altezza: 75, distanza: 25, dislocazione: 25 }], comuni), null, 'serve più di un sollevamento');
});

test('MoVaRisCh: punteggi P dalle frasi H', () => {
  assert.equal(indicePericolo('H225 H314 H335').P, 6.25, 'H314 senza categoria = 1A');
  assert.equal(indicePericolo('H314 1C').P, 5.5);
  assert.equal(indicePericolo('H330 cat. 2').P, 7.5);
  assert.equal(indicePericolo('H317 (1B), EUH066').P, 4.5);
  assert.equal(indicePericolo('H361d').P, 7.5);
  assert.equal(indicePericolo('H225').P, 1, 'nessuna frase per la salute');
  assert.equal(indicePericolo('H225').classificato, false);
  assert.equal(indicePericolo('H350').cmr, true);
  assert.equal(indicePericolo('H360Df').cmr, true);
});

test('MoVaRisCh: matrici di inalazione e contatto e fasce', () => {
  const m = movarisch({ frasiH: 'H315 H319 H336', stato: 'liquido_alta', quantita: 'da_1_a_10', uso: 'controllato', controllo: 'ventilazione', tempo: 'da_15m_a_2h', distanza: 'meno_1', contatto: 'discontinuo' });
  assert.deepEqual([m.P, m.D, m.U, m.C, m.I], [3.5, 3, 3, 3, 7]);
  assert.equal(m.Rinal, 24.5);
  assert.equal(m.Rcute, 24.5);
  assert.equal(m.Rcum, 34.65);
  const basso = movarisch({ frasiH: 'H319', stato: 'solido', quantita: 'meno_0_1', uso: 'chiuso', controllo: 'contenimento', tempo: 'meno_15m', distanza: 'da_3_a_5', contatto: 'nessuno' });
  assert.equal(basso.Rinal, 1.5);
  assert.equal(basso.Rcute, null, 'nessun contatto: niente rischio cutaneo');
  assert.equal(fasciaMovarisch(basso.R).colore, 'verde');
  assert.equal(fasciaMovarisch(18).colore, 'giallo');
  assert.equal(fasciaMovarisch(25).colore, 'rosso');
  assert.match(fasciaMovarisch(5, true).testo, /Capo II/);
  assert.equal(movarisch({ frasiH: 'H319' }).Rinal, null, 'dati incompleti');
});

test('rischio biologico: R = P × gruppo e obblighi del Titolo X', () => {
  assert.deepEqual(rischioBiologico({ gruppo: '3', probabilita: '2' }), { D: 3, P: 2, R: 6 });
  assert.equal(rischioBiologico({ gruppo: '5', probabilita: '2' }), null);
  const o = obblighiBiologici([{ gruppo: '3', vaccino: 'si' }]);
  assert.ok(o.some((x) => /art\. 280/.test(x)), 'registro esposti per il gruppo 3');
  assert.ok(o.some((x) => /vaccinazioni/.test(x)));
  assert.ok(!obblighiBiologici([{ gruppo: '2' }]).some((x) => /art\. 280/.test(x)));
  assert.ok(obblighiBiologici([{ gruppo: '2' }], true).some((x) => /art\. 269/.test(x)), 'uso deliberato: comunicazione');
  assert.ok(obblighiBiologici([{ gruppo: '4' }], true).some((x) => /art\. 270/.test(x)), 'gruppo 4: autorizzazione');
  assert.deepEqual(obblighiBiologici([]), []);
});

test('microclima: PMV e PPD come negli esempi della UNI EN ISO 7730', () => {
  assert.deepEqual(pmvPpd({ ta: 22, tr: 22, vel: 0.1, ur: 60, met: 1.2, clo: 0.5 }), { pmv: -0.75, ppd: 17 });
  assert.deepEqual(pmvPpd({ ta: 27, tr: 27, vel: 0.1, ur: 60, met: 1.2, clo: 0.5 }), { pmv: 0.77, ppd: 17 });
  assert.equal(pmvPpd({ ta: '' }), null);
  assert.equal(fasciaPmv(0.3).colore, 'verde');
  assert.equal(fasciaPmv(-0.6).colore, 'giallo');
  assert.match(fasciaPmv(1.2).testo, /caldo/);
});

test('stress termico WBGT e illuminazione', () => {
  assert.equal(wbgt({ tnw: 25, tg: 35 }), 28);
  assert.equal(wbgt({ tnw: 25, tg: 35, ta: 30, sole: true }), 27.5);
  assert.equal(wbgt({ tnw: 25, tg: 35, cav: 3 }), 31);
  assert.equal(wbgtRiferimento('2', true), 28.2);
  assert.equal(wbgtRiferimento('2', false), 25);
  assert.equal(fasciaWbgt(29, 28.2).colore, 'rosso');
  assert.equal(fasciaWbgt(27, 28.2).colore, 'giallo');
  assert.equal(esitoIlluminazione('ufficio', 520).colore, 'verde');
  assert.equal(esitoIlluminazione('ufficio', 420).colore, 'giallo');
  assert.equal(esitoIlluminazione('ufficio', 200).colore, 'rosso');
  assert.equal(esitoIlluminazione('ufficio', ''), null);
});

test('stress lavoro-correlato: andamenti e punteggio INAIL', () => {
  assert.equal(andamentoIndicatore([1, 1, 3], [10, 10, 10]), 'aumentato');
  assert.equal(andamentoIndicatore([2, 2, 2], [10, 10, 10]), 'inalterato');
  assert.equal(andamentoIndicatore([3, 2, 0], [10, 10, 10]), 'diminuito', 'zero = diminuito');
  assert.equal(andamentoIndicatore([1, 1, 2], [5, 5, 20]), 'diminuito', 'rapportato ai lavoratori');
  assert.equal(andamentoIndicatore([1, '', 2], [5, 5, 5]), null);
  const tutti = (v) => Object.fromEntries(['infortuni', 'malattia', 'assenze', 'ferie', 'trasferimenti', 'rotazione', 'disciplinari', 'visite'].map((k) => [k, v]));
  const crit = { ambiente: 2, pianificazione: 1, carico: 2, orario: 1, funzione: 2, ruolo: 0, carriera: 1, autonomia: 1, rapporti: 0 };
  const r = stressInail({ eventi: tutti([1, 1, 1]), lavoratori: [5, 5, 5], criticita: crit, interfaccia: 0 });
  assert.equal(r.sommaA, 8);
  assert.equal(r.areaA, 0);
  assert.equal(r.areaB, 17, 'media di 15, 17, 22, 13');
  assert.equal(r.areaC, 10, 'media di 18, 0, 33, 20, 0 meno 4');
  assert.equal(r.totale, 27);
  assert.equal(r.livello, 'non rilevante');
  const alto = stressInail({ eventi: tutti([0, 1, 3]), lavoratori: [5, 5, 5], lamentele: true, criticita: { ...crit, ambiente: 13, carico: 9 }, interfaccia: 2 });
  assert.equal(alto.areaA, 16);
  assert.equal(stressInail({}).totale, null);
  assert.equal(fasciaStress('medio').colore, 'giallo');
});

test('dati dei libretti nelle valutazioni', () => {
  const attr = [
    { nome: 'Scala', emissioni: null, tipo: 'Scale' },
    { nome: 'Flessibile', emissioni: { lpa: '92', krumore: '3', lcpeak: '120', vib: 'HAV', ahv: '6,5', kvib: '1,5' }, tipo: 'Utensili' },
    { nome: 'Carrello', emissioni: { vib: 'WBV', awx: '0,3', awy: '0,2', awz: '0,5' }, tipo: 'Carrelli elevatori' }
  ];
  const rum = righeRumoreDaLibretti(attr);
  assert.equal(rum[0].attivita, 'Flessibile', 'prima quelle con i dati');
  assert.equal(rum[0].livello, '95');
  assert.equal(rum[0].picco, '120');
  assert.match(rum[0].fonte, /Libretto/);
  const vib = righeVibrazioniDaLibretti(attr);
  assert.deepEqual(vib.map((x) => [x.attrezzo, x.sistema, x.accelerazione]), [['Flessibile', 'HAV', '6,5'], ['Carrello', 'WBV', '0,5']]);
  assert.equal(vibrazioneDaLibretto({ vib: 'WBV', awx: 0.5, awz: 0.6 }), 0.7);
  assert.equal(vibrazioneDaLibretto({ vib: '', ahv: 3 }), null);
  const r = riepilogoEmissioni(attr[1].emissioni);
  assert.equal(r.length, 2);
  assert.match(r[0], /95 dB\(A\)/);
  assert.match(r[1], /mano-braccio 8 m\/s²/);
  assert.deepEqual(riepilogoEmissioni({}), []);
});
