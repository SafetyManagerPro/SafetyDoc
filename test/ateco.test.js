import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cercaAteco, creaContesto, generaPiano } from '../js/engine.js';

const ateco = JSON.parse(readFileSync(new URL('../data/ateco.json', import.meta.url)));
const questionario = JSON.parse(readFileSync(new URL('../data/questionario.json', import.meta.url)));
const catalogo = JSON.parse(readFileSync(new URL('../data/catalogo.json', import.meta.url)));

test('la tabella ATECO 2025 è completa e coerente', () => {
  const divisioni = Object.keys(ateco.divisioni);
  assert.equal(divisioni.length, 87);
  assert.ok(!divisioni.includes('45'), 'la divisione 45 non esiste più in ATECO 2025');
  const opzioni = new Set(questionario.domande.find((d) => d.id === 'attivita').opzioni.map((o) => o.valore));
  for (const [d, v] of Object.entries(ateco.divisioni)) {
    assert.ok(['basso', 'medio', 'alto'].includes(v.classe), `${d}: classe`);
    assert.ok(ateco.sezioni[v.sezione], `${d}: sezione`);
  }
  for (const [pref, settore] of Object.entries(ateco.settori)) {
    assert.ok(opzioni.has(settore), `${pref}: settore ${settore} sconosciuto`);
    assert.ok(ateco.divisioni[pref.slice(0, 2)], `${pref}: divisione inesistente`);
  }
});

test('riconosce i codici in ogni formato e collega il settore', () => {
  const casi = {
    '43.21.01': ['impianti', 'alto', 12],
    '432101': ['impianti', 'alto', 12],
    '43.31': ['edilizia', 'alto', 12],
    '96.21.00': ['acconciatura_estetica', 'basso', 4],
    '95.31': ['autoriparazione', 'basso', 4],
    '10.71.10': ['alimentare_produzione', 'alto', 12],
    '16.23': ['legno', 'alto', 12],
    '49.41': ['trasporto', 'medio', 8],
    '01.13': ['agricoltura', 'medio', 8],
    '81.30': ['agricoltura', 'basso', 4],
    '81.21': ['pulizie', 'basso', 4],
    '56.10.11': ['ristorazione', 'basso', 4],
    '62.01': ['commercio_ufficio', 'basso', 4],
    '86.21': [null, 'alto', 12],
    '88.10': [null, 'medio', 8]
  };
  for (const [codice, [settore, classe, ore]] of Object.entries(casi)) {
    const r = cercaAteco(codice, ateco);
    assert.equal(r.valido, true, codice);
    assert.equal(r.settore, settore, `${codice}: settore`);
    assert.equal(r.classe, classe, `${codice}: classe`);
    assert.equal(r.ore, ore, `${codice}: ore`);
  }
  assert.equal(cercaAteco('43.21.01', ateco).codice, '43.21.01');
  assert.equal(cercaAteco('45.20', ateco).valido, false);
  assert.equal(cercaAteco('4', ateco), null);
  assert.equal(cercaAteco('', ateco), null);
});

test('la classe di rischio segue il codice ATECO, poi il settore', () => {
  const conAteco = creaContesto({ ateco: '62.01', attivita: 'edilizia' }, questionario, ateco).fatti;
  assert.equal(conAteco.classeRischio, 'basso');
  assert.equal(conAteco.fonteClasse, 'ateco');
  assert.equal(conAteco.oreFormazioneSpecifica, 4);
  const soloSettore = creaContesto({ attivita: 'edilizia' }, questionario, ateco).fatti;
  assert.equal(soloSettore.classeRischio, 'alto');
  assert.equal(soloSettore.fonteClasse, 'attivita');
  const nulla = creaContesto({}, questionario, ateco).fatti;
  assert.equal(nulla.classeRischio, 'da_verificare');
});

test('il settore suggerito dal codice ATECO attiva i requisiti professionali', () => {
  const r = { composizione: 'solo', ateco: '95.31' };
  const ids = generaPiano({ catalogo, questionario, risposte: r, adempimenti: [], oggi: '2026-11-24', ateco }).map((v) => v.scheda.id);
  assert.ok(ids.includes('requisiti-professionali'));
});
