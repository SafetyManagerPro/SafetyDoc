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
