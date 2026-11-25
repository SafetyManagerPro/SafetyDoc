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
