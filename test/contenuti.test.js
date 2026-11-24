import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { frasiCmr, situazioneProdotto, situazioneEvento, urgenzeEventi, eventiPerAnno, creaContesto } from '../js/engine.js';
import { generaDocumento, modelliDisponibili, ALLERGENI, RISCHI_MATERNITA } from '../js/modelli.js';
import { COLLEZIONI, migra, SCHEMA_VERSION } from '../js/merge.js';

const json = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const questionario = json('questionario.json');
const ateco = json('ateco.json');
const dvr = json('dvr.json');
const anagrafica = { ragioneSociale: 'Edil Rossi', titolare: 'Luca Rossi', comune: 'Avellino' };

test('frasi H per cancerogeni, mutageni e tossici per la riproduzione', () => {
  assert.deepEqual(frasiCmr('H225 H319 h350i H360FD'), ['H350I', 'H360FD']);
  assert.deepEqual(frasiCmr('H315 H317'), []);
});

test('semaforo dei prodotti', () => {
  assert.equal(situazioneProdotto({ nome: 'X' }).colore, 'rosso');
  assert.equal(situazioneProdotto({ nome: 'X' }, 1).colore, 'verde');
  assert.equal(situazioneProdotto({ nome: 'X', dataSds: '2025-01-01', frasiH: 'H350' }).colore, 'giallo');
});

test('infortuni: denuncia INAIL, comunicazione statistica e misure', () => {
  const oggi = '2026-11-24';
  const grave = situazioneEvento({ tipo: 'infortunio', data: '2026-11-20', dataCertificato: '2026-11-23', giorniPrognosi: 10 }, oggi);
  assert.equal(grave.colore, 'rosso');
  assert.equal(grave.scadenza, '2026-11-25');
  assert.match(grave.motivo, /Denuncia/);
  const lieve = situazioneEvento({ tipo: 'infortunio', data: '2026-11-23', giorniPrognosi: 2 }, oggi);
  assert.equal(lieve.colore, 'giallo');
  assert.match(lieve.motivo, /fini statistici/);
  const tardi = situazioneEvento({ tipo: 'infortunio', data: '2026-11-01', giorniPrognosi: 2 }, oggi);
  assert.equal(tardi.colore, 'rosso');
  assert.equal(situazioneEvento({ tipo: 'infortunio', data: '2026-11-01' }, oggi).motivo, 'Scrivi i giorni di prognosi del certificato medico');
  const chiuso = situazioneEvento({ tipo: 'infortunio', data: '2026-11-01', giorniPrognosi: 5, dataDenuncia: '2026-11-02', misureFatte: true }, oggi);
  assert.equal(chiuso.colore, 'verde');
  assert.equal(situazioneEvento({ tipo: 'quasi_incidente', data: '2026-11-01' }, oggi).colore, 'giallo');
  assert.equal(urgenzeEventi([{ tipo: 'quasi_incidente', data: '2026-11-01', misureFatte: true }, { tipo: 'quasi_incidente', data: '2026-11-01', deleted: true }], oggi).length, 0);
});

test('eventi per anno', () => {
  const r = eventiPerAnno([{ tipo: 'infortunio', data: '2025-03-01' }, { tipo: 'infortunio', data: '2025-05-01' }, { tipo: 'quasi_incidente', data: '2026-01-01' }, { tipo: 'infortunio', data: '2020-01-01' }], [2024, 2025, 2026]);
  assert.equal(r[2025].infortunio, 2);
  assert.equal(r[2026].quasi_incidente, 1);
  assert.equal(r[2024].infortunio, 0);
});

test('backup: le nuove raccolte esistono e i vecchi file vengono migrati', () => {
  assert.equal(SCHEMA_VERSION, 4);
  for (const c of ['prodotti', 'eventi']) assert.ok(COLLEZIONI.includes(c));
  const m = migra({ schemaVersion: 3, collezioni: { profilo: [] } });
  assert.deepEqual(m.collezioni.prodotti, []);
  assert.deepEqual(m.collezioni.eventi, []);
});

test('modelli disponibili secondo le risposte', () => {
  const base = { composizione: 'dipendenti', numero_lavoratori: 4, ateco: '56.10' };
  const ids = (r) => modelliDisponibili(creaContesto({ ...base, ...r }, questionario, ateco)).map((m) => m.id);
  assert.ok(ids({}).includes('informativa-lavoratrici-madri'));
  assert.ok(!ids({}).includes('cartello-allergeni'));
  assert.ok(ids({ alimenti: true }).includes('cartello-allergeni'));
  assert.ok(ids({ alimenti: true }).includes('registro-temperature'));
  assert.ok(ids({ cantiere: true }).includes('pos-bozza'));
  assert.ok(ids({ lavori_presso_clienti: true }).includes('autocertificazione-idoneita'));
  assert.ok(ids({ appalti_in_sede: true }).includes('duvri-bozza'));
  assert.ok(ids({ minori: true }).includes('informativa-minori'));
});

test('informativa lavoratrici: solo i rischi presenti, più quelli sempre validi', () => {
  const ctx = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 3, carichi: true, notte_guida: false }, questionario, ateco);
  const html = generaDocumento('informativa-lavoratrici-madri', { anagrafica, oggi: '2026-11-24', dvr, ctx, lavoratori: [] }).html;
  assert.ok(html.includes('Sollevamento e trasporto di pesi'));
  assert.ok(html.includes('Lavoro in piedi'));
  assert.ok(!html.includes('Lavoro notturno'));
  for (const r of RISCHI_MATERNITA) if (r.pericolo) assert.ok(dvr.pericoli.some((p) => p.id === r.pericolo), `pericolo ${r.pericolo} inesistente`);
});

test('POS, registri, allergeni e stress si compilano con i dati', () => {
  const ctx = creaContesto({ composizione: 'dipendenti', numero_lavoratori: 2, cantiere: true }, questionario, ateco);
  const lavoratori = [{ id: 'l1', nome: 'Mario', cognome: 'Bianchi', mansione: 'Muratore', ruoli: ['preposto'] }];
  const pos = generaDocumento('pos-bozza', { anagrafica, oggi: '2026-11-24', ctx, lavoratori, attrezzature: [{ nome: 'Trabattello' }], prodotti: [{ nome: 'Malta', pittogrammi: ['GHS05'] }], ruoli: { preposto: 'Preposto' } }).html;
  for (const x of ['Bianchi Mario', 'Muratore', 'Preposto', 'Trabattello', 'Malta', 'GHS05', 'Allegato XV']) assert.ok(pos.includes(x) || pos.includes('Mario Bianchi'), x);
  const reg = generaDocumento('registro-eventi', { anagrafica, oggi: '2026-11-24', lavoratori, eventi: [{ id: 'e1', tipo: 'infortunio', data: '2026-11-20', lavoratoreId: 'l1', giorniPrognosi: 5, dataDenuncia: '2026-11-21', misure: 'Nuova scala', misureFatte: true }] }).html;
  assert.ok(reg.includes('5 gg') && reg.includes('21/11/2026') && reg.includes('Nuova scala ✓'));
  const all = generaDocumento('cartello-allergeni', { anagrafica, oggi: '2026-11-24' }).html;
  assert.equal(ALLERGENI.length, 14);
  assert.ok(all.includes('Molluschi'));
  const stress = generaDocumento('stress-preliminare', { anagrafica, oggi: '2026-11-24', perAnno: { 2024: { infortunio: 0 }, 2025: { infortunio: 3 }, 2026: { infortunio: 1 } } }).html;
  assert.ok(stress.includes('<th>2025</th>') && stress.includes('<td>3</td>'));
});

test('esempi per settore: un pacchetto per ogni attività e tipi di attrezzatura validi', () => {
  const settori = json('settori.json').settori;
  const tipi = new Set(json('attrezzature.json').tipi.map((t) => t.id));
  const attivita = questionario.domande.find((d) => d.id === 'attivita').opzioni.map((o) => o.valore);
  for (const a of attivita) assert.ok(settori[a], `manca il settore ${a}`);
  for (const [k, s] of Object.entries(settori)) {
    for (const a of s.attrezzature) assert.ok(tipi.has(a.tipo), `${k}: tipo ${a.tipo}`);
    assert.equal(new Set(s.attrezzature.map((a) => a.nome)).size, s.attrezzature.length, `${k}: doppioni`);
  }
});

import { confrontaVersioni, domandeSenzaRisposta, schermataSenzaRisposta, novitaDaMostrare } from '../js/engine.js';
import { LINGUE, TESTI } from '../js/lingue.js';

test('versioni, novità e domande nuove', () => {
  assert.ok(confrontaVersioni('0.10.0', '0.9.0') > 0);
  assert.equal(confrontaVersioni('0.6.0', '0.6'), 0);
  const catalogo = json('catalogo.json');
  const n = novitaDaMostrare(catalogo, '0.5.0', ['duvri', 'dvr']);
  assert.equal(n.length, 1);
  assert.deepEqual(n[0].schede, ['duvri']);
  assert.equal(novitaDaMostrare(catalogo, catalogo.versione, ['duvri']).length, 0);
  const ids = new Set(catalogo.schede.map((s) => s.id));
  for (const x of catalogo.novita) for (const id of x.schede) assert.ok(ids.has(id), id);
  const vecchie = { __completato: true, nome_impresa: 'X', ateco: '', attivita: 'altro', forma_giuridica: 'individuale', artigiano: false, composizione: 'solo', sede: true, rischio_incendio: 'no', rifiuti_pericolosi: 'no' };
  const mancanti = domandeSenzaRisposta(questionario, vecchie).map((d) => d.id);
  assert.ok(mancanti.includes('alimenti') && mancanti.includes('lavori_presso_clienti'));
  assert.ok(!mancanti.includes('minori'), 'solo per chi ha dipendenti');
  const i = schermataSenzaRisposta(questionario, vecchie);
  assert.ok(i > 0);
  const tutte = Object.fromEntries(mancanti.map((id) => [id, false]));
  assert.equal(schermataSenzaRisposta(questionario, { ...vecchie, ...tutte }), -1);
});

test('regole tradotte: stesse voci in tutte le lingue', () => {
  for (const k of Object.keys(LINGUE)) {
    assert.ok(TESTI[k], k);
    assert.equal(TESTI[k].regole.length, TESTI.it.regole.length, k);
    for (const campo of Object.keys(TESTI.it)) assert.ok(TESTI[k][campo], `${k}.${campo}`);
  }
  const html = generaDocumento('regole-lavoratore', { anagrafica, oggi: '2026-11-24', lavoratore: { nome: 'Ahmed', cognome: 'Karim', lingua: 'ar' }, lavoratori: [] }).html;
  assert.ok(html.includes('dir="rtl"') && html.includes('Regole di sicurezza sul lavoro'));
});
