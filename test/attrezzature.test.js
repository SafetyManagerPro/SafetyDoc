import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creaContesto, situazioneAttrezzatura, urgenzeAttrezzature, attrezzatureAttive } from '../js/engine.js';

const defAttr = JSON.parse(readFileSync(new URL('../data/attrezzature.json', import.meta.url)));
const questionario = JSON.parse(readFileSync(new URL('../data/questionario.json', import.meta.url)));
const ateco = JSON.parse(readFileSync(new URL('../data/ateco.json', import.meta.url)));
const oggi = '2026-11-24';
const mesiVerifica = (attrezzatura, risposte) =>
  situazioneAttrezzatura({ attrezzatura, defAttr, controlli: [], ctx: creaContesto(risposte, questionario, ateco), oggi }).voci.find((v) => v.controllo.id === 'verifica-periodica')?.controllo.periodicitaMesi;

test('ogni tipo di attrezzatura ha controlli validi', () => {
  const ids = new Set();
  for (const t of defAttr.tipi) {
    assert.ok(!ids.has(t.id)); ids.add(t.id);
    assert.ok(t.controlli.length, `${t.id}: nessun controllo`);
    for (const c of t.controlli) {
      assert.ok(['una_tantum', 'periodica', 'manuale'].includes(c.tipoScadenza), `${t.id}/${c.id}`);
      if (c.tipoScadenza === 'periodica') assert.ok(c.periodicitaMesi > 0, `${t.id}/${c.id}: periodicità`);
    }
  }
  assert.ok(ids.has('altro'));
});

test('periodicità delle verifiche secondo Allegato VII: settore ed età', () => {
  assert.equal(mesiVerifica({ id: 'a', tipo: 'ple' }, {}), 12);
  assert.equal(mesiVerifica({ id: 'a', tipo: 'ponte_sospeso' }, {}), 24);
  // gru mobile: ogni anno in edilizia, ogni 2 anni altrove se ha meno di 10 anni
  assert.equal(mesiVerifica({ id: 'a', tipo: 'gru_mobile', annoFabbricazione: 2022 }, { ateco: '43.99' }), 12);
  assert.equal(mesiVerifica({ id: 'a', tipo: 'gru_mobile', annoFabbricazione: 2022 }, { ateco: '46.73' }), 24);
  assert.equal(mesiVerifica({ id: 'a', tipo: 'gru_mobile', annoFabbricazione: 2010 }, { ateco: '46.73' }), 12);
  assert.equal(mesiVerifica({ id: 'a', tipo: 'gru_mobile', annoFabbricazione: 2022 }, { attivita: 'edilizia' }), 12);
  // apparecchi fissi: 1, 2 o 3 anni
  assert.equal(mesiVerifica({ id: 'a', tipo: 'sollevamento_fisso', annoFabbricazione: 2010 }, { ateco: '41.00' }), 12);
  assert.equal(mesiVerifica({ id: 'a', tipo: 'sollevamento_fisso', annoFabbricazione: 2022 }, { ateco: '41.00' }), 24);
  assert.equal(mesiVerifica({ id: 'a', tipo: 'sollevamento_fisso', annoFabbricazione: 2010 }, { ateco: '25.11' }), 24);
  assert.equal(mesiVerifica({ id: 'a', tipo: 'sollevamento_fisso', annoFabbricazione: 2022 }, { ateco: '25.11' }), 36);
  assert.equal(mesiVerifica({ id: 'a', tipo: 'carrello' }, {}), undefined, 'il muletto non ha verifiche Allegato VII');
});

test('semaforo e urgenze delle attrezzature', () => {
  const ctx = creaContesto({ ateco: '43.21' }, questionario, ateco);
  const attrezzature = [
    { id: 'p1', nome: 'Piattaforma', tipo: 'ple' },
    { id: 's1', nome: 'Scala', tipo: 'scala' },
    { id: 'x', nome: 'Vecchia', tipo: 'scala', dismessa: true },
    { id: 'y', nome: 'Cancellata', tipo: 'scala', deleted: true }
  ];
  assert.deepEqual(attrezzatureAttive(attrezzature).map((a) => a.id), ['p1', 's1']);
  const controlli = [
    { id: 'c1', attrezzaturaId: 'p1', controlloId: 'verifica-periodica', data: '2025-12-10' },
    { id: 'c2', attrezzaturaId: 'p1', controlloId: 'prima-verifica', data: '2024-01-01' },
    { id: 'c3', attrezzaturaId: 's1', controlloId: 'controllo', data: '2026-06-01' }
  ];
  const s = situazioneAttrezzatura({ attrezzatura: attrezzature[0], defAttr, controlli, ctx, oggi });
  const col = Object.fromEntries(s.voci.map((v) => [v.controllo.id, v.colore]));
  assert.equal(col['verifica-periodica'], 'giallo', 'scade il 10/12/2026');
  assert.equal(col['prima-verifica'], 'verde');
  assert.equal(col.manutenzione, 'rosso');
  const urg = urgenzeAttrezzature({ attrezzature, defAttr, controlli, ctx, oggi });
  assert.ok(urg.every((u) => u.attrezzatura.id === 'p1'));
  assert.equal(urg[0].colore, 'rosso');
});
