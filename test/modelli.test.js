import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODELLI, modelliDisponibili, modelloPerLavoratore, generaDocumento } from '../js/modelli.js';
import { creaContesto } from '../js/engine.js';

const questionario = JSON.parse(readFileSync(new URL('../data/questionario.json', import.meta.url)));
const defLav = JSON.parse(readFileSync(new URL('../data/lavoratori.json', import.meta.url)));
const anagrafica = { ragioneSociale: 'Falegnameria Rossi', titolare: 'Luca Rossi', sede: 'Via Roma 1', comune: 'Avellino' };
const lavoratore = { id: 'l1', nome: 'Mario', cognome: 'Bianchi', mansione: 'Falegname', ruoli: ['preposto', 'primo_soccorso', 'tratta_dati'] };

test('ogni modello si genera senza errori, anche senza dati', () => {
  const ids = new Set();
  for (const m of MODELLI) {
    assert.ok(!ids.has(m.id), `id duplicato ${m.id}`);
    ids.add(m.id);
    for (const dati of [{ anagrafica, lavoratore, oggi: '2026-11-24' }, { oggi: '2026-11-24', lavoratore: m.ambito === 'lavoratore' ? {} : null }]) {
      const { html } = generaDocumento(m.id, dati);
      assert.ok(html.includes('<h1>'), `${m.id}: manca il titolo`);
    }
  }
});

test('i modelli usano i dati e li proteggono', () => {
  const html = generaDocumento('nomina-preposto', { anagrafica, lavoratore, oggi: '2026-11-24' }).html;
  assert.ok(html.includes('Mario Bianchi') && html.includes('Falegnameria Rossi') && html.includes('24/11/2026'));
  const cattivo = generaDocumento('informativa-lavoratori', { anagrafica: { ragioneSociale: '<script>x</script>' }, lavoratore, oggi: '2026-11-24' }).html;
  assert.ok(!cattivo.includes('<script>'));
});

test('verbale DPI elenca i dispositivi registrati', () => {
  const html = generaDocumento('consegna-dpi', { anagrafica, lavoratore, oggi: '2026-11-24', registro: { data: '2026-11-20', dettagli: 'Scarpe S3, guanti; occhiali' } }).html;
  for (const x of ['Scarpe S3', 'guanti', 'occhiali', '20/11/2026']) assert.ok(html.includes(x), `manca ${x}`);
});

test('modelli proposti secondo le risposte e i ruoli', () => {
  const solo = modelliDisponibili(creaContesto({ composizione: 'solo' }, questionario)).map((m) => m.id);
  assert.ok(solo.includes('informativa-clienti'));
  assert.ok(!solo.includes('nomina-preposto'));
  const dlRspp = modelliDisponibili(creaContesto({ composizione: 'dipendenti', dl_rspp: true }, questionario)).map((m) => m.id);
  assert.ok(dlRspp.includes('dichiarazione-dl-rspp') && !dlRspp.includes('nomina-rspp-esterno'));
  const preposto = MODELLI.find((m) => m.id === 'nomina-preposto');
  assert.ok(modelloPerLavoratore(preposto, lavoratore));
  assert.ok(!modelloPerLavoratore(preposto, { ruoli: [] }));
  for (const r of defLav.requisiti.filter((x) => x.modello)) assert.ok(MODELLI.some((m) => m.id === r.modello), `${r.id}: modello inesistente`);
});

test('bozza di DVR: pericoli presenti dalle risposte, mansioni dai lavoratori', () => {
  const dvr = JSON.parse(readFileSync(new URL('../data/dvr.json', import.meta.url)));
  const catalogo = JSON.parse(readFileSync(new URL('../data/catalogo.json', import.meta.url)));
  for (const p of dvr.pericoli) if (p.schedaId) assert.ok(catalogo.schede.some((s) => s.id === p.schedaId), `${p.id}: scheda ${p.schedaId} inesistente`);
  const ctx = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 3, sede: true, rumore_vibrazioni: true, quota: true, dl_rspp: true }, questionario);
  const html = generaDocumento('dvr-bozza', { anagrafica, oggi: '2026-11-24', dvr, ctx, lavoratori: [{ mansione: 'Falegname' }, { mansione: 'Falegname' }, { mansione: 'Magazziniere' }], attivita: 'Falegnameria' }).html;
  for (const x of ['Modulo 1.1', 'Modulo 2', 'Modulo 3', 'Falegname', 'Magazziniere', 'Rumore', 'Cadute dall', 'Stress lavoro-correlato', 'Luca Rossi (datore di lavoro)']) assert.ok(html.includes(x), `manca ${x}`);
  assert.equal(html.split('<tr><td>Falegname</td>').length, 2, 'le mansioni non si ripetono');
  assert.ok(html.includes('R = 6') && html.includes('Medio-alto'), 'rumore: P 3 x D 2');
  assert.ok(html.includes('doc__matrice'), 'matrice dei rischi');
  const mod3 = html.split('Modulo 3')[1];
  assert.ok(!mod3.includes('Atmosfere esplosive'), 'i pericoli assenti non vanno nel modulo 3');
});

test('stato della sicurezza riporta voci, date e allegati', () => {
  const piano = [
    { scheda: { id: 'dvr', titolo: 'Valutazione dei rischi' }, colore: 'verde', motivo: 'In regola', stato: { id: 'x1', fatto: true, dataFatto: '2025-03-01' }, prossimaScadenza: null },
    { scheda: { id: 'rspp', titolo: 'Nomina RSPP' }, colore: 'rosso', motivo: 'Da fare', stato: null },
    { scheda: { id: 'inf', titolo: 'Infortunio' }, colore: 'info', motivo: '', stato: null }
  ];
  const html = generaDocumento('stato-sicurezza', { anagrafica, oggi: '2026-11-24', piano, allegati: { 'adempimento:x1': 2 } }).html;
  for (const x of ['Valutazione dei rischi', '01/03/2025', 'Nomina RSPP', 'Da fare', '>2<', 'Infortunio', '24/11/2026']) assert.ok(html.includes(x), `manca ${x}`);
});

test('DVR: valutazione personalizzata di P e D e misure programmate', async () => {
  const { valutazioniPersonalizzate, generaDocumento, MODELLI } = await import('../js/modelli.js');
  const { creaContesto } = await import('../js/engine.js');
  const { readFileSync } = await import('node:fs');
  const j = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
  const p = valutazioniPersonalizzate([
    { rischio: 'rumore', p: '3', d: '', misura: 'Misura fonometrica', incaricato: 'RSPP', entro: '31/01/2027' },
    { rischio: 'rumore', p: '1', d: '4', misura: 'Cuffie nuove' },
    { rischio: '', p: '4', misura: 'ignorata' },
    { rischio: 'mmc', p: '9', d: 'x', misura: '' }
  ]);
  assert.deepEqual(p.rumore, { p: 3, d: 4, misure: [{ misura: 'Misura fonometrica', incaricato: 'RSPP', entro: '31/01/2027' }, { misura: 'Cuffie nuove', incaricato: '', entro: '' }] });
  assert.deepEqual(p.mmc, { p: null, d: null, misure: [] }, 'valori fuori scala ignorati');
  assert.equal(Object.keys(p).length, 2);

  const dvr = j('dvr.json');
  const ctx = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 2, sede: true, rumore_vibrazioni: true }, j('questionario.json'), j('ateco.json'));
  const m = MODELLI.find((x) => x.id === 'dvr-bozza');
  const campo = m.opzioni({ dvr, ctx }).find((c) => c.id === 'valutazioni');
  assert.ok(campo.iniziali.some((r) => r.rischio === 'rumore'));
  assert.ok(campo.colonne.find((c) => c.id === 'misura').suggerimenti.length > 5);
  const html = generaDocumento('dvr-bozza', { anagrafica: {}, oggi: '2026-11-25', dvr, ctx, lavoratori: [], opzioni: { valutazioni: [{ rischio: 'rumore', p: '4', d: '3', misura: 'Misura fonometrica', incaricato: 'RSPP', entro: '31/01/2027' }] } }).html;
  assert.match(html, /R = 12/);
  assert.match(html, /Valori confermati dopo il sopralluogo/);
  assert.match(html, /Misura fonometrica – incaricato: RSPP – entro il 31\/01\/2027/);
  assert.match(html, /<td>Misura fonometrica<br><small>Rischio: Rumore<\/small><\/td><td>Programmata<\/td><td>31\/01\/2027<\/td><td>RSPP<\/td>/);
});

test('i campi di ogni modello si preparano anche senza dati e i valori iniziali generano il documento', () => {
  for (const m of MODELLI.filter((x) => x.opzioni)) {
    const defs = m.opzioni({});
    const opzioni = Object.fromEntries(defs.map((c) => [c.id, c.tipo === 'tabella' ? c.iniziali || [] : c.valore ?? '']));
    const { html } = generaDocumento(m.id, { anagrafica, oggi: '2026-11-27', opzioni, perAnno: { 2024: { infortunio: 0, medicazione: 0, quasi_incidente: 0 }, 2025: { infortunio: 1, medicazione: 0, quasi_incidente: 2 }, 2026: { infortunio: 0, medicazione: 1, quasi_incidente: 0 } } });
    assert.ok(html.includes('<h1>'), m.id);
    assert.ok(!/undefined|NaN/.test(html.replace(/<[^>]+>/g, ' ')), `${m.id}: testo con undefined o NaN`);
  }
});

test('valutazioni con calcolo automatico: rumore, vibrazioni, chimico, biologico, microclima, stress', () => {
  const g = (id, opzioni, extra = {}) => generaDocumento(id, { anagrafica, oggi: '2026-11-27', opzioni, ...extra }).html;
  const rumore = g('valutazione-rumore', { righe: [{ attivita: 'Sega', livello: '95', ore: '2', picco: '138', lceq: '98' }, { attivita: 'Resto', livello: '70', ore: '6' }], dpiTipo: 'cuffie', dpiSnr: '28', incertezza: '1,5' });
  assert.match(rumore, /LEX,8h = 89 dB\(A\)/);
  assert.match(rumore, /con incertezza 90,5/);
  assert.match(rumore, /Picco massimo 138 dB\(C\)/);
  assert.match(rumore, /LEX,8h con i DPI = /);
  const vib = g('valutazione-vibrazioni', { righe: [{ attrezzo: 'Martello', sistema: 'HAV', accelerazione: '8', incertezza: '2', ore: '1' }] });
  assert.match(vib, /<strong>10<\/strong>/, 'a + K');
  assert.match(vib, /0,5 \/ 2/, 'ore massime azione / limite');
  const chim = g('valutazione-chimico-movarisch', { righe: [{ prodotto: 'Diluente', frasiH: 'H225 H336', stato: 'liquido_alta', quantita: 'da_1_a_10', uso: 'dispersivo', controllo: 'manipolazione', tempo: 'oltre_6h', distanza: 'meno_1', contatto: 'esteso' }] });
  assert.match(chim, /P 3,5/);
  assert.match(chim, /Rischio (superiore all|elevato|grave)/);
  const bio = g('valutazione-biologico', { tipo: 'potenziale', agenti: [{ agente: 'Virus dell\'epatite B (HBV)', gruppo: '3', probabilita: '2', vaccino: 'si', via: 'sangue' }] }, { dvr: JSON.parse(readFileSync(new URL('../data/dvr.json', import.meta.url))) });
  assert.match(bio, /<strong>6<\/strong>/);
  assert.match(bio, /art\. 280/);
  const micro = g('valutazione-microclima', { moderati: [{ ambiente: 'Ufficio', ta: '22', tr: '22', ur: '60', vel: '0,1', met: '1.2', clo: '0.5' }], caldi: [{ posto: 'Tetto', tnw: '26', tg: '40', ta: '33', sole: 'si', classe: '3', acclimatati: 'no' }] });
  assert.match(micro, /−0,75|-0,75/);
  assert.match(micro, /stress termico/);
  const stress = g('stress-preliminare', { lav0: '4', lav1: '4', lav2: '4', eventi: [{ a0: '0', a1: '1', a2: '2' }], crit_ambiente: '3' }, { perAnno: { 2024: { infortunio: 0 }, 2025: { infortunio: 1 }, 2026: { infortunio: 2 } } });
  assert.match(stress, /Aumentato/);
  assert.match(stress, /Completa i dati/);
});

test('autocontrollo HACCP: piano per attività e registri con esito automatico', () => {
  const ctx = creaContesto({ alimenti: true, attivita: 'ristorazione' }, questionario);
  const piano = generaDocumento('piano-haccp', { anagrafica, oggi: '2026-11-27', ctx, opzioni: {} }).html;
  assert.match(piano, /Cottura/);
  assert.match(piano, /\+75 °C/);
  const negozio = generaDocumento('piano-haccp', { anagrafica, oggi: '2026-11-27', ctx: creaContesto({ alimenti: true, attivita: 'commercio_ufficio' }, questionario), opzioni: {} }).html;
  assert.ok(!negozio.includes('Raffreddamento rapido'));
  const ric = generaDocumento('registro-ricevimento', { anagrafica, oggi: '2026-11-27', opzioni: { consegne: [{ fornitore: 'Carni Srl', prodotto: 'Macinato', categoria: 'macinate', temperatura: '5' }, { prodotto: 'Piselli', categoria: 'surgelati', temperatura: '-20' }] } }).html;
  assert.match(ric, /Non conforme/);
  assert.match(ric, /Conforme \(≤ -18 °C\)/);
  const cot = generaDocumento('registro-cotture', { anagrafica, oggi: '2026-11-27', opzioni: { misure: [{ prodotto: 'Ragù', tipo: 'abbattimento', temperatura: '3', minuti: '80' }] } }).html;
  assert.match(cot, /doc__esito--verde/);
  const temp = generaDocumento('registro-temperature', { anagrafica, oggi: '2026-11-27', opzioni: { apparecchi: [{ nome: 'Vetrina', max: '4' }], letture: [{ giorno: '3', apparecchio: 'vetrina', temperatura: '7' }] } }).html;
  assert.match(temp, /Vetrina<br><small>max 4/);
  assert.match(temp, /Fuori limite/);
  const disp = modelliDisponibili(creaContesto({ alimenti: true, attivita: 'commercio_ufficio' }, questionario)).map((m) => m.id);
  assert.ok(disp.includes('piano-haccp') && disp.includes('registro-ricevimento') && !disp.includes('registro-cotture'));
});
